/**
 * AI Planning Pair-Comparison Evaluator
 *
 * Each test is a PAIR of trips (A = baseline, B = variant) differing on ONE dimension.
 * The report shows inputs side-by-side and the full itinerary (activities + themes)
 * side-by-side so you can directly compare planning decisions.
 *
 * For day-reasoning pairs the script calls BOTH:
 *   1. itinerary-day-reasoning  → theme + reasoning per day
 *   2. holistic-day-assignment  → which activities fill each day slot
 * then merges them into one unified itinerary view per trip.
 *
 * Tests:
 *   1. Group Type          — meetup vs close_friends (Kyoto)
 *   2. Mixed Budget        — uniform vs 1 low + 2 high members (Barcelona)
 *   3. Preference Conflict — majority outdoor vs outdoor deal breaker (Seoul)
 *   4. Split Plan Logic    — divergent preferences vs convergent (NYC)
 *   5. Weekday vs Weekend  — Monday start vs Saturday start (Paris)
 *   6. MBTI Conflict       — introvert/high-split vs extrovert/low-split (Amsterdam)
 *
 * Usage:
 *   node scripts/ai-planning-eval.mjs              # Render + LLM judge
 *   node scripts/ai-planning-eval.mjs --local      # localhost:3001
 *   node scripts/ai-planning-eval.mjs --fast       # skip LLM judge
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function loadEnv() {
  try {
    const content = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
      if (m && !process.env[m[1]])
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  } catch (_) {}
}
loadEnv();

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const USE_LOCAL  = process.argv.includes("--local");
const FAST       = process.argv.includes("--fast");
const BASE       = USE_LOCAL ? "http://localhost:3001" : "https://group-trip-api.onrender.com";

if (!OPENAI_KEY && !FAST) {
  console.error("OPENAI_API_KEY missing. Use --fast to skip LLM judge.");
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const GROUP_DIRECTIVE = {
  couple:       "Romantic couple — prioritise scenic, intimate, elevated venues; fine-dining dinner; spa welcome.",
  family:       "Family with children — child-safe venues; kid stop each day; early dinners; no nightlife.",
  colleagues:   "Professional team offsite — collaborative workshops; semi-formal; no late-night activities.",
  close_friends:"Close friends — high-energy and adventure welcome; nightlife fine; split encouraged when interests diverge.",
  meetup:       "Strangers via shared interest — public neutral venues; structured icebreaker activities; optional participation.",
  new_friends:  "Getting-to-know friends — group dining; conversation-friendly; avoid niche/demanding activities.",
};

const mem = (id, name, role = "member") => ({ id, name, role });

const pref = (memberId, { budget="moderate", energy="moderate", activeHours="morning_afternoon",
  activityTypes=["sightseeing","food"], dealBreakers=[], mbti=null } = {}) =>
  ({ memberId, budgetLevel:budget, energyLevel:energy, activeHours, activityTypes, activityTypesOther:null, dealBreakers, mbti });

function groupCtx({ groupType, members, prefs, budget="moderate", energy="moderate",
  activeHours="morning_afternoon", excludedTags=[], activityTypes=["sightseeing","food"],
  candidatesBrief=[], splitPlanSummary=null, memberPersonalities=[], groupPlanningStyleVariance=null,
  groupSplitComfort=null, tripStartDate=null, tripWeekdays=null,
  dailyCapacityReasoning="3-4 non-meal stops per day." }) {
  return {
    members, joinedMemberCount:members.length, expectedGroupSize:members.length,
    memberPreferences:prefs,
    aggregateProfile:{ groupBudgetLevel:budget, groupEnergyLevel:energy, commonActiveHours:activeHours, excludedTags, commonActivityTypes:activityTypes },
    groupType, groupTypePlanningDirective:GROUP_DIRECTIVE[groupType]??null,
    splitPlanSummary, dailyCapacityReasoning, candidatesBrief,
    memberPersonalities, groupPlanningStyleVariance, groupSplitComfort, tripStartDate, tripWeekdays,
  };
}

const days = (n, energy="moderate") => Array.from({length:n},(_,i)=>({
  dayNumber:i+1, energyLevel:energy, maxNonMealActivities:4,
  experienceMix:["culture","food","sightseeing"], honoredPreferenceNames:[],
  hasLunch:true, hasDinner:true, nonMealStopCount:3,
}));

// ── API callers ───────────────────────────────────────────────────────────────

async function post(path_, body) {
  const res = await fetch(`${BASE}${path_}`, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body), signal:AbortSignal.timeout(70_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path_}: ${(await res.text().catch(()=>"")).slice(0,200)}`);
  return res.json();
}

const callDayReasoning   = p => post("/api/openai/itinerary-day-reasoning", p);
const callHolistic       = p => post("/api/openai/holistic-day-assignment", p);
const callSplitPlan      = p => post("/api/openai/split-group-plan", p);

const JUDGE_SYSTEM_PROMPT = `You are a senior travel planning expert. Evaluate TRIP A and TRIP B SEPARATELY and INDEPENDENTLY using this rubric.

Score each criterion 0–100 for EACH trip. For every score include a "good" reason (what the trip did well) AND a "bad" reason (what it missed or did poorly). Be specific — cite actual activities or decisions.

Criteria and weights:
1. individual_satisfaction (30%) — Did each traveler get activities matching preferences? Deal breakers respected?
2. group_fairness (20%) — Relatively equal value for all members? Nobody completely ignored?
3. logistics_quality (15%) — No cross-city backtracking, proper meal timing (~noon lunch, ~7pm dinner), respects opening hours/closures
4. budget_fit (10%) — Activity costs match stated budget per member; low-budget members not forced into expensive options
5. pace_energy (10%) — Reasonable daily energy curve, not overloaded, rest for low-energy members
6. flexibility (5%) — Adapts to closures, calendar constraints (weekday vs weekend)
7. conflict_resolution (10%) — Competing preferences resolved via compromise, rotation, or split; decision justified in reasoning

WEIGHTED TOTAL = (IndSat×0.30)+(Fair×0.20)+(Logis×0.15)+(Budget×0.10)+(Pace×0.10)+(Flex×0.05)+(Conflict×0.10)
RECOMMENDATION: 85–100=Excellent | 70–84=Good | 55–69=Acceptable | 40–54=Needs Revision | 0–39=Poor

Respond ONLY in valid JSON (no markdown wrapper):
{
  "trip_a": {
    "scores": {
      "individual_satisfaction": { "score": <0-100>, "good": "<specific evidence Trip A did well>", "bad": "<specific gap or miss>" },
      "group_fairness":          { "score": <0-100>, "good": "...", "bad": "..." },
      "logistics_quality":       { "score": <0-100>, "good": "...", "bad": "..." },
      "budget_fit":              { "score": <0-100>, "good": "...", "bad": "..." },
      "pace_energy":             { "score": <0-100>, "good": "...", "bad": "..." },
      "flexibility":             { "score": <0-100>, "good": "...", "bad": "..." },
      "conflict_resolution":     { "score": <0-100>, "good": "...", "bad": "..." }
    },
    "total": <0-100 weighted>,
    "recommendation": "Excellent|Good|Acceptable|Needs Revision|Poor",
    "per_traveler": [
      { "member": "<name>", "preferences": "<what they wanted>", "got": "<matched activities>", "missed": "<unmet preferences>", "satisfied": true }
    ],
    "top_improvements": ["<most impactful fix for Trip A>", "...", "...", "...", "..."]
  },
  "trip_b": {
    "scores": { <same structure> },
    "total": <0-100>,
    "recommendation": "...",
    "per_traveler": [...],
    "top_improvements": [...]
  },
  "comparison": "<2-3 sentences: which trip better addresses the test dimension and why>",
  "summary": "<1-2 sentence overall assessment of both trips>"
}`;

const SPLIT_JUDGE_SYSTEM_PROMPT = `You are a senior travel planning expert. Evaluate TRIP A and TRIP B split decisions SEPARATELY and INDEPENDENTLY.

Score each criterion 0–100 for EACH trip. For every score include a "good" reason AND a "bad" reason — be specific, cite actual activities or decisions.

Criteria and weights:
1. split_necessity (30%) — Was split/no-split decision correct for this scenario? (Wrong direction = low score)
2. activity_segregation (25%) — When split: do sub-groups get GENUINELY different activities? (Same places = low score)
3. group_cohesion (20%) — Is shared "together" time preserved even when splitting?
4. reasoning_quality (15%) — Does reasoning explicitly cite the specific conflict, personality signals, or split-comfort level?
5. personality_influence (10%) — Does decision reflect MBTI/personality (introvert/extrovert, groupOrientation, split-comfort)?

WEIGHTED TOTAL = (Split×0.30)+(Seg×0.25)+(Coh×0.20)+(Reas×0.15)+(Pers×0.10)
RECOMMENDATION: 85–100=Excellent | 70–84=Good | 55–69=Acceptable | 40–54=Needs Revision | 0–39=Poor

Respond ONLY in valid JSON (no markdown wrapper):
{
  "trip_a": {
    "scores": {
      "split_necessity":       { "score": <0-100>, "good": "<specific evidence>", "bad": "<specific gap>" },
      "activity_segregation":  { "score": <0-100>, "good": "...", "bad": "..." },
      "group_cohesion":        { "score": <0-100>, "good": "...", "bad": "..." },
      "reasoning_quality":     { "score": <0-100>, "good": "...", "bad": "..." },
      "personality_influence": { "score": <0-100>, "good": "...", "bad": "..." }
    },
    "total": <0-100>,
    "recommendation": "...",
    "assessment": "<1-2 sentence assessment of Trip A's split decision>",
    "top_improvements": ["...", "...", "...", "...", "..."]
  },
  "trip_b": { <same structure> },
  "comparison": "<2-3 sentences: which trip better demonstrates the test dimension>",
  "summary": "<1-2 sentence overall assessment>"
}`;

async function callLlmJudge(prompt, systemPrompt = JUDGE_SYSTEM_PROMPT) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method:"POST", headers:{"Content-Type":"application/json","Authorization":`Bearer ${OPENAI_KEY}`},
    body:JSON.stringify({
      model:"gpt-4o-mini",
      response_format:{ type:"json_object" },
      messages:[
        { role:"system", content:systemPrompt },
        { role:"user", content:prompt },
      ],
      temperature:0.2,
    }),
    signal:AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`LLM judge HTTP ${res.status}`);
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content ?? "(no response)";
  let structured = null;
  try { structured = JSON.parse(text); } catch(_) {}
  // score = average of trip_a and trip_b totals for summary stat
  const tA = structured?.trip_a?.total ?? null;
  const tB = structured?.trip_b?.total ?? null;
  const score = (tA != null && tB != null) ? Math.round((tA + tB) / 2) : (tA ?? tB ?? null);
  return { text, structured, score };
}

// ── Candidate libraries ───────────────────────────────────────────────────────

const KYOTO_NONFOOD = [
  { placeId:"ky1", name:"Fushimi Inari Shrine (thousands of torii gates)", category:"culture", tags:["landmark","spiritual","walking"], intensity:"moderate", costLevel:"free" },
  { placeId:"ky2", name:"Arashiyama Bamboo Grove", category:"nature", tags:["scenic","walking","nature"], intensity:"low", costLevel:"free" },
  { placeId:"ky3", name:"Kinkaku-ji Golden Pavilion", category:"culture", tags:["landmark","temple","iconic"], intensity:"low", costLevel:"low" },
  { placeId:"ky4", name:"Gion Geisha District evening walk", category:"culture", tags:["nightlife","atmospheric","traditional"], intensity:"low", costLevel:"free" },
  { placeId:"ky5", name:"Tea ceremony & matcha workshop (Urasenke)", category:"culture", tags:["experience","traditional","indoor"], intensity:"low", costLevel:"moderate" },
  { placeId:"ky6", name:"Philosopher's Path canal walk", category:"nature", tags:["scenic","walking","relaxed"], intensity:"low", costLevel:"free" },
  { placeId:"ky7", name:"Nijo Castle", category:"culture", tags:["history","landmark","indoor"], intensity:"low", costLevel:"moderate" },
  { placeId:"ky8", name:"Sake tasting at Fushimi brewery district", category:"social", tags:["drinking","local","social","nightlife"], intensity:"low", costLevel:"moderate" },
  { placeId:"ky9", name:"Pontocho Alley izakaya bar-hop", category:"nightlife", tags:["nightlife","social","bar","evening"], intensity:"low", costLevel:"moderate" },
  { placeId:"ky10", name:"Bicycle rental: temples loop (Kinkaku-ji → Ryoan-ji → Ninna-ji)", category:"outdoor", tags:["active","cycling","scenic"], intensity:"moderate", costLevel:"low" },
];
const KYOTO_FOOD = [
  { placeId:"kf1", name:"Nishiki Market street food walk", category:"food", tags:["market","local","lunch"] },
  { placeId:"kf2", name:"Kaiseki multi-course dinner", category:"food", tags:["fine-dining","traditional","dinner"], costLevel:"high" },
  { placeId:"kf3", name:"Ramen at Kyoto Ramen Koji", category:"food", tags:["casual","ramen","lunch"] },
  { placeId:"kf4", name:"Tofu kaiseki at Nanzenji", category:"food", tags:["vegetarian","traditional","dinner"] },
  { placeId:"kf5", name:"Izakaya dinner with craft sake", category:"food", tags:["casual","social","dinner"] },
];

const BARCELONA_NONFOOD = [
  { placeId:"ba1", name:"Sagrada Família guided tour", category:"culture", tags:["landmark","architecture","iconic"], intensity:"low", costLevel:"moderate" },
  { placeId:"ba2", name:"Park Güell Gaudí gardens", category:"culture", tags:["art","outdoor","scenic"], intensity:"moderate", costLevel:"moderate" },
  { placeId:"ba3", name:"Gothic Quarter neighbourhood walk", category:"culture", tags:["historic","walking","free"], intensity:"low", costLevel:"free" },
  { placeId:"ba4", name:"Barceloneta Beach afternoon", category:"outdoor", tags:["beach","free","relaxed"], intensity:"low", costLevel:"free" },
  { placeId:"ba5", name:"Palau de la Música Catalana concert", category:"culture", tags:["music","art","evening"], intensity:"low", costLevel:"moderate" },
  { placeId:"ba6", name:"Casa Batlló interior tour", category:"culture", tags:["architecture","art","indoor"], intensity:"low", costLevel:"high" },
  { placeId:"ba7", name:"Rooftop cocktail bar El Nacional", category:"nightlife", tags:["bar","rooftop","nightlife","expensive"], intensity:"low", costLevel:"high" },
  { placeId:"ba8", name:"Free street art Raval neighbourhood", category:"culture", tags:["art","street","free","walking"], intensity:"low", costLevel:"free" },
  { placeId:"ba9", name:"Camp Nou stadium tour", category:"sports", tags:["sports","museum","moderate"], intensity:"low", costLevel:"moderate" },
];
const BARCELONA_FOOD = [
  { placeId:"bf1", name:"La Boqueria Market tapas tasting", category:"food", tags:["market","tapas","lunch"], costLevel:"low" },
  { placeId:"bf2", name:"Michelin-star tasting menu at Disfrutar", category:"food", tags:["fine-dining","expensive","dinner"], costLevel:"very_high" },
  { placeId:"bf3", name:"Bodega tapas bar in El Born", category:"food", tags:["tapas","casual","affordable","dinner"], costLevel:"low" },
  { placeId:"bf4", name:"Paella at Barceloneta seafront", category:"food", tags:["seafood","lunch","moderate"], costLevel:"moderate" },
  { placeId:"bf5", name:"Sunday brunch at Federal Café", category:"food", tags:["brunch","cafe","weekend"], costLevel:"low" },
];

const PARIS_NONFOOD = [
  { placeId:"pa1", name:"Louvre Museum (CLOSED Tuesdays)", category:"culture", openingNotes:"Closed every Tuesday", closedDays:"Tuesday", tags:["art","museum","iconic"], intensity:"moderate", costLevel:"moderate" },
  { placeId:"pa2", name:"Musée d'Orsay Impressionism (CLOSED Mondays)", category:"culture", openingNotes:"Closed every Monday", closedDays:"Monday", tags:["art","impressionism","museum"], intensity:"moderate", costLevel:"moderate" },
  { placeId:"pa3", name:"Eiffel Tower observation deck", category:"landmark", tags:["iconic","view","romantic"], intensity:"low", costLevel:"moderate" },
  { placeId:"pa4", name:"Marché Bastille (Thu & Sun mornings ONLY)", category:"market", openingNotes:"Open Thursday and Sunday mornings only", closedDays:"Monday, Tuesday, Wednesday, Friday, Saturday", tags:["market","local","food","weekend"], intensity:"low", costLevel:"free", timeSensitive:true },
  { placeId:"pa5", name:"Montmartre neighbourhood & Sacré-Cœur", category:"culture", tags:["scenic","artistic","walking"], intensity:"moderate", costLevel:"free" },
  { placeId:"pa6", name:"Le Marais & Place des Vosges stroll", category:"culture", tags:["historic","walking","romantic"], intensity:"low", costLevel:"free" },
  { placeId:"pa7", name:"Centre Pompidou modern art (CLOSED Tuesdays)", category:"culture", openingNotes:"Closed Tuesdays", closedDays:"Tuesday", tags:["modern-art","museum"], intensity:"low", costLevel:"moderate" },
  { placeId:"pa8", name:"Seine riverside walk & Île de la Cité", category:"outdoor", tags:["scenic","walking","romantic","free"], intensity:"low", costLevel:"free" },
  { placeId:"pa9", name:"Versailles Palace day trip (open daily)", category:"culture", openingNotes:"Open daily", tags:["day-trip","palace","romantic"], intensity:"moderate", costLevel:"high" },
];
const PARIS_FOOD = [
  { placeId:"pf1", name:"Weekend brunch at Café de Flore", category:"food", openingNotes:"Brunch popular on weekends", tags:["brunch","iconic","weekend"], costLevel:"moderate" },
  { placeId:"pf2", name:"Classic French bistro dinner", category:"food", tags:["french","dinner","romantic"], costLevel:"moderate" },
  { placeId:"pf3", name:"Croissant & café breakfast at local boulangerie", category:"food", tags:["breakfast","local","free"], costLevel:"low" },
  { placeId:"pf4", name:"Cheese & wine picnic by the Seine", category:"food", tags:["romantic","picnic","afternoon"], costLevel:"low" },
  { placeId:"pf5", name:"Fine-dining dinner at Le Grand Véfour", category:"food", tags:["fine-dining","romantic","expensive","dinner"], costLevel:"very_high" },
];

// placeId → display name for all candidate sets
const CANDIDATE_NAMES = {};
[...KYOTO_NONFOOD, ...KYOTO_FOOD, ...BARCELONA_NONFOOD, ...BARCELONA_FOOD, ...PARIS_NONFOOD, ...PARIS_FOOD,
].forEach(c => { CANDIDATE_NAMES[c.placeId] = c.name; });
// Seoul from earlier
Object.assign(CANDIDATE_NAMES, {
  outdoor1:"Bukhansan Mountain Hike", outdoor2:"Han River Kayaking", outdoor3:"Olympic Park Trail",
  shop1:"Myeongdong Shopping Street", shop2:"Dongdaemun Design Plaza",
  culture1:"Gyeongbokgung Palace", culture2:"Insadong Art Street", culture3:"Bukchon Hanok Village",
  food1:"Gwangjang Market street food", food2:"Korean BBQ", food3:"Kalguksu Noodles",
});

const expandId = id => CANDIDATE_NAMES[id] ?? id;

// ── Build holistic payload from groupCtx + candidates ─────────────────────────

function buildDayWeekdays(tripStartDate, tripDays) {
  if (!tripStartDate) return undefined;
  const WDAY = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const start = new Date(tripStartDate + "T00:00:00Z");
  const arr = [""];
  for (let i = 0; i < tripDays; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    arr.push(WDAY[d.getUTCDay()]);
  }
  return arr;
}

function computeEligibleDayIndices(closedDaysStr, dayWeekdays) {
  if (!closedDaysStr || !dayWeekdays || dayWeekdays.length < 2) return undefined;
  const WDAY_IDX = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };
  const closedSet = new Set();
  closedDaysStr.split(/[,;]+/).forEach(s => {
    const idx = WDAY_IDX[s.trim().toLowerCase()];
    if (idx !== undefined) closedSet.add(idx);
  });
  if (closedSet.size === 0) return undefined;
  const result = [];
  for (let i = 1; i < dayWeekdays.length; i++) {
    const wdIdx = WDAY_IDX[dayWeekdays[i]?.toLowerCase() ?? ""];
    if (wdIdx !== undefined && !closedSet.has(wdIdx)) result.push(i);
  }
  return result.length > 0 ? result : undefined;
}

function makeHolisticPayload(tripId, tripDays, destination, groupCtxObj, nonFood, food, memberPersonalities) {
  const persList = memberPersonalities ?? groupCtxObj.memberPersonalities ?? [];
  const dayWeekdays = buildDayWeekdays(groupCtxObj.tripStartDate, tripDays);
  return {
    tripId, tripDays, destination,
    tripStartDate: groupCtxObj.tripStartDate ?? undefined,
    dayWeekdays,
    groupProfile: {
      groupType: groupCtxObj.groupType,
      groupTypePlanningDirective: groupCtxObj.groupTypePlanningDirective,
      groupBudgetLevel: groupCtxObj.aggregateProfile.groupBudgetLevel,
      groupEnergyLevel: groupCtxObj.aggregateProfile.groupEnergyLevel,
      commonActiveHours: groupCtxObj.aggregateProfile.commonActiveHours,
      excludedTags: groupCtxObj.aggregateProfile.excludedTags,
      commonActivityTypes: groupCtxObj.aggregateProfile.commonActivityTypes,
      memberPreferences: groupCtxObj.memberPreferences,
      members: groupCtxObj.members,
    },
    maxPerDayByDayIndex: Array.from({length:tripDays}, () => 4),
    nonFoodCandidates: nonFood.map(c => {
      if (!c.closedDays || !dayWeekdays) return c;
      const eligibleDays = computeEligibleDayIndices(c.closedDays, dayWeekdays);
      return eligibleDays ? { ...c, eligibleDays } : c;
    }),
    foodCandidates: food,
    memberPersonalities: persList,
  };
}

// ── Candidate map + scheduling helpers ───────────────────────────────────────

function buildCandidateMap() {
  const map = new Map();
  const all = [...KYOTO_NONFOOD,...KYOTO_FOOD,...BARCELONA_NONFOOD,...BARCELONA_FOOD,...PARIS_NONFOOD,...PARIS_FOOD];
  for (const c of all) map.set(c.placeId, c);
  // Seoul, NYC, Amsterdam inline candidates
  const extra = [
    { placeId:"outdoor1", name:"Bukhansan Mountain Hike", category:"outdoor_adventure", intensity:"high", costLevel:"free" },
    { placeId:"outdoor2", name:"Han River Kayaking", category:"outdoor_adventure", intensity:"high", costLevel:"moderate" },
    { placeId:"outdoor3", name:"Olympic Park Trail", category:"outdoor", intensity:"moderate", costLevel:"free" },
    { placeId:"shop1", name:"Myeongdong Shopping Street", category:"shopping", intensity:"low", costLevel:"moderate" },
    { placeId:"shop2", name:"Dongdaemun Design Plaza", category:"shopping", intensity:"low", costLevel:"low" },
    { placeId:"culture1", name:"Gyeongbokgung Palace", category:"culture", intensity:"low", costLevel:"low" },
    { placeId:"culture2", name:"Insadong Art Street", category:"culture", intensity:"low", costLevel:"free" },
    { placeId:"culture3", name:"Bukchon Hanok Village", category:"culture", intensity:"moderate", costLevel:"free" },
    { placeId:"food1", name:"Gwangjang Market street food", category:"food", costLevel:"low" },
    { placeId:"food2", name:"Korean BBQ", category:"food", costLevel:"moderate" },
    { placeId:"food3", name:"Kalguksu Noodles", category:"food", costLevel:"low" },
    { placeId:"adv1", name:"Brooklyn Boulders Rock Climbing", category:"outdoor_adventure", intensity:"high", costLevel:"moderate" },
    { placeId:"adv2", name:"Brooklyn Bridge Bike Ride", category:"outdoor", intensity:"moderate", costLevel:"low" },
    { placeId:"adv3", name:"Hudson River Kayaking", category:"outdoor_adventure", intensity:"high", costLevel:"moderate" },
    { placeId:"adv4", name:"Central Park trail run", category:"outdoor", intensity:"moderate", costLevel:"free" },
    { placeId:"art1", name:"MoMA — Museum of Modern Art", category:"art_culture", intensity:"low", costLevel:"moderate" },
    { placeId:"art2", name:"Metropolitan Museum of Art", category:"art_culture", intensity:"low", costLevel:"moderate" },
    { placeId:"art3", name:"Whitney Museum American Art", category:"art_culture", intensity:"low", costLevel:"moderate" },
    { placeId:"neutral1", name:"Central Park stroll", category:"parks", intensity:"low", costLevel:"free" },
    { placeId:"neutral2", name:"Brooklyn Bridge walk", category:"outdoor", intensity:"low", costLevel:"free" },
    { placeId:"food_nyc1", name:"Brunch at local diner", category:"food", costLevel:"low" },
    { placeId:"n1", name:"Vondelpark afternoon stroll", category:"parks", intensity:"low", costLevel:"free" },
    { placeId:"n2", name:"Amsterdam canal cruise", category:"sightseeing", intensity:"low", costLevel:"moderate" },
    { placeId:"n3", name:"Jordaan neighbourhood food walk", category:"food", intensity:"low", costLevel:"moderate" },
    { placeId:"a1", name:"Amsterdam Forest bike ride", category:"outdoor", intensity:"high", costLevel:"low" },
    { placeId:"a2", name:"Zandvoort beach & surf lesson", category:"outdoor_adventure", intensity:"high", costLevel:"moderate" },
    { placeId:"c1", name:"Rijksmuseum (Dutch Masters)", category:"art_culture", intensity:"low", costLevel:"moderate" },
    { placeId:"c2", name:"Van Gogh Museum", category:"art_culture", intensity:"low", costLevel:"moderate" },
    { placeId:"c3", name:"Anne Frank House", category:"culture_historical", intensity:"low", costLevel:"moderate" },
  ];
  for (const c of extra) if (!map.has(c.placeId)) map.set(c.placeId, c);
  return map;
}

const DURATION_BY_INTENSITY = { high:120, moderate:90, low:60 };
const DURATION_BY_CATEGORY  = { museum:120, art_culture:120, culture:90, market:60, food:30, parks:60, outdoor:120, outdoor_adventure:150, shopping:90, sightseeing:75, landmark:60, nightlife:60, social:60, parks:60, culture_historical:90, sports:90 };
const TRANSIT_MINS = 25;

// holistic-day-assignment activities entries are { placeId, travelModeFromPrevious }
// objects; older responses (or splitGroupPlan's own activities[]) may still be
// plain placeId strings — accept both.
function activityId(entry) {
  return typeof entry === "string" ? entry : (entry?.placeId ?? null);
}

function estimateDaySchedule(activities, lunch, dinner, candidateMap) {
  const slots = [];
  let hour = 9, min = 0;
  const time = () => `${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
  const advance = (m) => { min += m; hour += Math.floor(min/60); min = min%60; };

  const nonMeal = [...(activities||[])].map(activityId).filter(Boolean);
  const half = Math.ceil(nonMeal.length / 2);
  const morning = nonMeal.slice(0, half);
  const afternoon = nonMeal.slice(half);

  for (let i=0; i<morning.length; i++) {
    const id = morning[i];
    const c = candidateMap.get(id);
    const dur = DURATION_BY_INTENSITY[c?.intensity] ?? DURATION_BY_CATEGORY[c?.category] ?? 75;
    slots.push({ id, name:c?.name??id, time:time(), durationMins:dur, category:c?.category, intensity:c?.intensity, costLevel:c?.costLevel, openingNotes:c?.openingNotes, type:'activity' });
    advance(dur);
    if (i < morning.length-1) { slots.push({ type:'transit', mins:TRANSIT_MINS }); advance(TRANSIT_MINS); }
  }

  if (hour < 12) { hour = 12; min = 0; } else if (morning.length) { slots.push({ type:'transit', mins:TRANSIT_MINS }); advance(TRANSIT_MINS); }
  if (lunch) {
    const c = candidateMap.get(lunch);
    slots.push({ id:lunch, name:c?.name??lunch, time:time(), durationMins:60, type:'lunch', category:'food', costLevel:c?.costLevel });
    advance(60);
  }

  if (afternoon.length) { slots.push({ type:'transit', mins:TRANSIT_MINS }); advance(TRANSIT_MINS); }
  for (let i=0; i<afternoon.length; i++) {
    const id = afternoon[i];
    const c = candidateMap.get(id);
    const dur = DURATION_BY_INTENSITY[c?.intensity] ?? DURATION_BY_CATEGORY[c?.category] ?? 75;
    slots.push({ id, name:c?.name??id, time:time(), durationMins:dur, category:c?.category, intensity:c?.intensity, costLevel:c?.costLevel, openingNotes:c?.openingNotes, type:'activity' });
    advance(dur);
    if (i < afternoon.length-1) { slots.push({ type:'transit', mins:TRANSIT_MINS }); advance(TRANSIT_MINS); }
  }

  if (dinner) {
    if (hour < 19) { hour = 19; min = 0; } else { slots.push({ type:'transit', mins:TRANSIT_MINS }); advance(TRANSIT_MINS); }
    const c = candidateMap.get(dinner);
    slots.push({ id:dinner, name:c?.name??dinner, time:time(), durationMins:90, type:'dinner', category:'food', costLevel:c?.costLevel });
  }
  return slots;
}

function formatItineraryForJudge(out, candidateMap) {
  if (!out?.days?.length) return "(no output)";
  return out.days.map(d => {
    const dayNum = d.dayIndex ?? d.dayNumber ?? "?";
    const slots = estimateDaySchedule(d.activities||[], d.lunch, d.dinner, candidateMap);
    const schedule = slots.map(s => {
      if (s.type === 'transit') return `  ↓ ${s.mins}min transit`;
      const label = s.type==='lunch' ? '[LUNCH]' : s.type==='dinner' ? '[DINNER]' : '      ';
      const note = s.openingNotes ? ` ⚠ ${s.openingNotes}` : '';
      const cost = s.costLevel ? ` [${s.costLevel}]` : '';
      const dur = s.durationMins ? ` (${s.durationMins}min)` : '';
      return `  ${s.time} ${label} ${s.name}${dur}${cost}${note}`;
    }).join('\n');
    return `Day ${dayNum}${d.theme ? ` — ${d.theme}` : ''}\n${schedule}\n  Reasoning: ${d.dayReasoning ?? '(none)'}`;
  }).join('\n\n');
}

// ── Test Pair Definitions ─────────────────────────────────────────────────────

const PAIRS = [

  // ── 1. Group Type ───────────────────────────────────────────────────────────
  {
    id: "group_type",
    label: "1 · Group Type Effect",
    subtitle: "Meetup (strangers) vs Close Friends — same Kyoto trip, same budget, same activities",
    endpoint: "day+holistic",
    tripA: {
      label: "Trip A — Meetup (strangers)",
      tripName:"Kyoto Trip", destination:"Kyoto, Japan", tripDays:3,
      scheduledDays: days(3),
      groupContext: groupCtx({
        groupType:"meetup",
        members:[mem("m1","Alex","organizer"),mem("m2","Jordan"),mem("m3","Sam"),mem("m4","Taylor")],
        prefs:[
          pref("m1",{activityTypes:["culture","food","sightseeing"]}),
          pref("m2",{activityTypes:["culture","food","sightseeing"]}),
          pref("m3",{activityTypes:["culture","food","sightseeing"]}),
          pref("m4",{activityTypes:["culture","food","sightseeing"]}),
        ],
        budget:"moderate", energy:"moderate", activityTypes:["culture","food","sightseeing"],
        tripStartDate:"2026-08-15", tripWeekdays:["Saturday"],
        candidatesBrief: KYOTO_NONFOOD.map(c=>({placeId:c.placeId,name:c.name,source:"fsq",costLevel:c.costLevel})),
      }),
      inputSummary:{ groupType:"meetup (strangers)", destination:"Kyoto", budget:"moderate", energy:"moderate", activities:"culture, food, sightseeing", members:4, start:"Saturday" },
    },
    tripB: {
      label: "Trip B — Close Friends",
      tripName:"Kyoto Trip", destination:"Kyoto, Japan", tripDays:3,
      scheduledDays: days(3),
      groupContext: groupCtx({
        groupType:"close_friends",
        members:[mem("m1","Alex","organizer"),mem("m2","Jordan"),mem("m3","Sam"),mem("m4","Taylor")],
        prefs:[
          pref("m1",{activityTypes:["culture","food","sightseeing"]}),
          pref("m2",{activityTypes:["culture","food","sightseeing"]}),
          pref("m3",{activityTypes:["culture","food","sightseeing"]}),
          pref("m4",{activityTypes:["culture","food","sightseeing"]}),
        ],
        budget:"moderate", energy:"moderate", activityTypes:["culture","food","sightseeing"],
        tripStartDate:"2026-08-15", tripWeekdays:["Saturday"],
        candidatesBrief: KYOTO_NONFOOD.map(c=>({placeId:c.placeId,name:c.name,source:"fsq",costLevel:c.costLevel})),
      }),
      inputSummary:{ groupType:"close_friends", destination:"Kyoto", budget:"moderate", energy:"moderate", activities:"culture, food, sightseeing", members:4, start:"Saturday" },
    },
    get holisticPayloadA() {
      return makeHolisticPayload("eval-gt-a", 3, "Kyoto, Japan", this.tripA.groupContext, KYOTO_NONFOOD, KYOTO_FOOD);
    },
    get holisticPayloadB() {
      return makeHolisticPayload("eval-gt-b", 3, "Kyoto, Japan", this.tripB.groupContext, KYOTO_NONFOOD, KYOTO_FOOD);
    },
    judgePrompt: (outA, outB) => {
      const cm = buildCandidateMap();
      return `GROUP PROFILE
4 people, 3 days in Kyoto, Japan.
Members: Alex (organizer), Jordan, Sam, Taylor
Budget: moderate | Energy: moderate | Activities: culture, food, sightseeing

TRIP CONSTRAINTS
Trip A — group_type = "meetup" (strangers meeting for the first time via a shared interest)
  → Expected: structured, neutral public venues; guided tours; icebreaker-friendly activities; no nightlife pressure
Trip B — group_type = "close_friends" (long-time friends)
  → Expected: lively spots welcome; bar-hops (ky9), sake tasting (ky8), nightlife ok; spontaneous choices

TRIP A ITINERARY
${formatItineraryForJudge(outA, cm)}

TRIP B ITINERARY
${formatItineraryForJudge(outB, cm)}

COMPARISON QUESTION: Does group_type meaningfully change BOTH the activity selection (A=structured/public vs B=lively/social) AND the day reasoning tone? Nightlife candidates (sake bar ky8, izakaya bar-hop ky9) should appear more in B than A.`;
    },
    checks: [
      { desc:"Both return 3 days", fn:(a,b) => a?.days?.length===3 && b?.days?.length===3 },
      { desc:"A reasoning reflects meetup tone", fn:(a) => /public|neutral|structured|icebreak|group|shared|meet/i.test(JSON.stringify(a?.days)) },
      { desc:"B reasoning reflects friends tone", fn:(_,b) => /fun|friend|spontan|nightlife|adventure|local|vibrant|enjoy/i.test(JSON.stringify(b?.days)) },
    ],
  },

  // ── 2. Mixed Budget ─────────────────────────────────────────────────────────
  {
    id: "mixed_budget",
    label: "2 · Mixed Budget Members",
    subtitle: "All moderate budget vs 1 low-budget + 2 high-budget — same Barcelona trip",
    endpoint: "day+holistic",
    tripA: {
      label: "Trip A — All moderate budget",
      tripName:"Barcelona Trip", destination:"Barcelona, Spain", tripDays:3,
      scheduledDays: days(3),
      groupContext: groupCtx({
        groupType:"close_friends",
        members:[mem("m1","Alex","organizer"),mem("m2","Jordan"),mem("m3","Sam")],
        prefs:[
          pref("m1",{budget:"moderate",activityTypes:["culture","food","nightlife"]}),
          pref("m2",{budget:"moderate",activityTypes:["culture","food","nightlife"]}),
          pref("m3",{budget:"moderate",activityTypes:["culture","food","nightlife"]}),
        ],
        budget:"moderate", energy:"high", activityTypes:["culture","food","nightlife"],
        tripStartDate:"2026-09-12", tripWeekdays:["Saturday"],
        candidatesBrief: BARCELONA_NONFOOD.map(c=>({placeId:c.placeId,name:c.name,source:"fsq",costLevel:c.costLevel})),
      }),
      inputSummary:{ groupType:"close_friends", destination:"Barcelona", memberBudgets:"all moderate", aggregateBudget:"moderate", activities:"culture, food, nightlife" },
    },
    tripB: {
      label: "Trip B — Alex (low) + Jordan & Sam (high)",
      tripName:"Barcelona Trip", destination:"Barcelona, Spain", tripDays:3,
      scheduledDays: days(3),
      groupContext: groupCtx({
        groupType:"close_friends",
        members:[mem("m1","Alex","organizer"),mem("m2","Jordan"),mem("m3","Sam")],
        prefs:[
          pref("m1",{budget:"low",activityTypes:["culture","food","nightlife"]}),
          pref("m2",{budget:"high",activityTypes:["culture","food","nightlife"]}),
          pref("m3",{budget:"high",activityTypes:["culture","food","nightlife"]}),
        ],
        budget:"moderate", energy:"high", activityTypes:["culture","food","nightlife"],
        tripStartDate:"2026-09-12", tripWeekdays:["Saturday"],
        candidatesBrief: BARCELONA_NONFOOD.map(c=>({placeId:c.placeId,name:c.name,source:"fsq",costLevel:c.costLevel})),
        memberPersonalities:[
          { memberId:"m1", name:"Alex", signals:{ planningStyle:"flexible", groupOrientation:"together", energyFromPeople:"charges", conflictApproach:"compromising", scheduleRigidity:"flexible" }, budgetLevel:"low", dealBreakers:[] },
          { memberId:"m2", name:"Jordan", signals:{ planningStyle:"spontaneous", groupOrientation:"together", energyFromPeople:"charges", conflictApproach:"direct", scheduleRigidity:"flexible" }, budgetLevel:"high", dealBreakers:[] },
          { memberId:"m3", name:"Sam", signals:{ planningStyle:"flexible", groupOrientation:"together", energyFromPeople:"charges", conflictApproach:"compromising", scheduleRigidity:"flexible" }, budgetLevel:"high", dealBreakers:[] },
        ],
      }),
      inputSummary:{ groupType:"close_friends", destination:"Barcelona", memberBudgets:"Alex=low, Jordan=high, Sam=high", aggregateBudget:"moderate (conflict)", activities:"culture, food, nightlife" },
    },
    get holisticPayloadA() {
      return makeHolisticPayload("eval-mb-a", 3, "Barcelona, Spain", this.tripA.groupContext, BARCELONA_NONFOOD, BARCELONA_FOOD);
    },
    get holisticPayloadB() {
      return makeHolisticPayload("eval-mb-b", 3, "Barcelona, Spain", this.tripB.groupContext, BARCELONA_NONFOOD, BARCELONA_FOOD);
    },
    judgePrompt: (outA, outB) => {
      const cm = buildCandidateMap();
      return `GROUP PROFILE
3 close friends, 3 days in Barcelona, Spain.
Members: Alex (m1 — LOW budget), Jordan (m2 — HIGH budget), Sam (m3 — HIGH budget)
Activities: culture, food, nightlife

TRIP CONSTRAINTS
Trip A: All 3 members have moderate budget.
Trip B: Alex has LOW budget, Jordan & Sam have HIGH budget.
  → High-cost activities available: Michelin-star Disfrutar (bf2, very_high), Rooftop bar El Nacional (ba7, high), Casa Batlló (ba6, high)
  → Free/low activities available: Gothic Quarter walk (ba3, free), Street art Raval (ba8, free), Barceloneta beach (ba4, free), La Boqueria (bf1, low), Bodega tapas (bf3, low)
  → Expected for Trip B: remove or replace very-expensive items to protect Alex; prefer inclusive options; reasoning acknowledges budget gap

TRIP A ITINERARY (all moderate budget)
${formatItineraryForJudge(outA, cm)}

TRIP B ITINERARY (mixed budget — protect Alex)
${formatItineraryForJudge(outB, cm)}

COMPARISON QUESTION: Did Trip B successfully protect Alex's budget by removing/replacing high-cost activities? Does the reasoning explicitly mention the budget disparity and inclusive choices?`;
    },
    checks: [
      { desc:"Both return 3 days", fn:(a,b) => a?.days?.length===3 && b?.days?.length===3 },
      { desc:"B reasoning mentions budget/cost/affordable", fn:(_,b) => /budget|cost|afford|price|access|inclus|low|free/i.test(JSON.stringify(b?.days)) },
      { desc:"B includes fewer high-cost activities than A", fn:(a,b) => {
        const highCostIds = ["ba6","ba7","bf2"];
        const count = out => (out?.days||[]).reduce((s,d)=>{
          const hits = [...(d.activities||[]).map(activityId), d.lunch, d.dinner].filter(Boolean).filter(id=>highCostIds.includes(id));
          return s+hits.length;
        },0);
        return count(b) <= count(a);
      }},
    ],
  },

  // ── 3. Preference Conflict ──────────────────────────────────────────────────
  {
    id: "preference_conflict",
    label: "3 · Activity Preference: Majority vs Deal Breaker",
    subtitle: "2 vote outdoor + 1 votes shopping vs 2 vote outdoor + 1 has outdoor as deal breaker (Seoul)",
    endpoint: "holistic",
    tripA: {
      label: "Trip A — 2 outdoor + 1 shopping voter",
      inputSummary:{ m1:"outdoor_adventure ✓ voted", m2:"outdoor_adventure ✓ voted", m3:"shopping ✓ voted", m3_dealBreaker:"none", expect:"outdoor dominates, shopping gets a slot" },
    },
    tripB: {
      label: "Trip B — 2 outdoor + 1 outdoor deal breaker",
      inputSummary:{ m1:"outdoor_adventure ✓ voted", m2:"outdoor_adventure ✓ voted", m3:"shopping ✓ voted", m3_dealBreaker:"outdoor / adventure / hiking / physical", expect:"outdoor de-emphasised, culture/shopping prioritised" },
    },
    holisticPayloadA: {
      tripId:"eval-pref-a", tripDays:3, destination:"Seoul, South Korea",
      maxPerDayByDayIndex:[3,3,3],
      groupProfile:{
        groupType:"close_friends", groupBudgetLevel:"moderate", groupEnergyLevel:"high",
        commonActiveHours:"morning_afternoon_evening", excludedTags:[], commonActivityTypes:["outdoor","shopping","culture"],
        memberPreferences:[
          { memberId:"m1", budgetLevel:"moderate", energyLevel:"high", activityTypes:["outdoor_adventure"], dealBreakers:[] },
          { memberId:"m2", budgetLevel:"moderate", energyLevel:"high", activityTypes:["outdoor_adventure"], dealBreakers:[] },
          { memberId:"m3", budgetLevel:"moderate", energyLevel:"moderate", activityTypes:["shopping"], dealBreakers:[] },
        ],
        members:[{id:"m1",name:"Alex"},{id:"m2",name:"Jordan"},{id:"m3",name:"Sam"}],
      },
      nonFoodCandidates:[
        { placeId:"outdoor1", name:"Bukhansan Mountain Hike", category:"outdoor_adventure", tags:["hiking","outdoor","adventure","strenuous"], intensity:"high", costLevel:"free", voterMemberIds:["m1","m2"] },
        { placeId:"outdoor2", name:"Han River Kayaking", category:"outdoor_adventure", tags:["water","outdoor","adventure","physical"], intensity:"high", costLevel:"moderate", voterMemberIds:["m1","m2"] },
        { placeId:"outdoor3", name:"Olympic Park Running Trail", category:"outdoor", tags:["outdoor","fitness","active"], intensity:"moderate", costLevel:"free", voterMemberIds:["m1","m2"] },
        { placeId:"shop1",   name:"Myeongdong Shopping Street", category:"shopping", tags:["shopping","retail"], intensity:"low", costLevel:"moderate", voterMemberIds:["m3"] },
        { placeId:"shop2",   name:"Dongdaemun Design Plaza & Market", category:"shopping", tags:["shopping","design"], intensity:"low", costLevel:"low", voterMemberIds:["m3"] },
        { placeId:"culture1",name:"Gyeongbokgung Palace", category:"culture", tags:["history","landmark"], intensity:"low", costLevel:"low", voterMemberIds:["m1","m2","m3"] },
        { placeId:"culture2",name:"Insadong Art Street", category:"culture", tags:["art","culture"], intensity:"low", costLevel:"free", voterMemberIds:["m1","m2","m3"] },
        { placeId:"culture3",name:"Bukchon Hanok Village", category:"culture", tags:["history","village"], intensity:"moderate", costLevel:"free", voterMemberIds:["m2","m3"] },
      ],
      foodCandidates:[
        { placeId:"food1", name:"Gwangjang Market street food", category:"food", voterMemberIds:["m1","m2","m3"] },
        { placeId:"food2", name:"Korean BBQ Samgyeopsal", category:"food", voterMemberIds:["m1","m2","m3"] },
        { placeId:"food3", name:"Myeongdong Kalguksu noodles", category:"food", voterMemberIds:["m3"] },
      ],
    },
    holisticPayloadB: {
      tripId:"eval-pref-b", tripDays:3, destination:"Seoul, South Korea",
      maxPerDayByDayIndex:[3,3,3],
      groupProfile:{
        groupType:"close_friends", groupBudgetLevel:"moderate", groupEnergyLevel:"high",
        commonActiveHours:"morning_afternoon_evening", excludedTags:["adventure","outdoor"],
        commonActivityTypes:["culture","shopping","food"],
        memberPreferences:[
          { memberId:"m1", budgetLevel:"moderate", energyLevel:"high", activityTypes:["outdoor_adventure"], dealBreakers:[] },
          { memberId:"m2", budgetLevel:"moderate", energyLevel:"high", activityTypes:["outdoor_adventure"], dealBreakers:[] },
          { memberId:"m3", budgetLevel:"moderate", energyLevel:"moderate", activityTypes:["shopping","culture"], dealBreakers:["adventure","outdoor","hiking","physical","strenuous"] },
        ],
        members:[{id:"m1",name:"Alex"},{id:"m2",name:"Jordan"},{id:"m3",name:"Sam"}],
      },
      nonFoodCandidates:[
        { placeId:"outdoor1", name:"Bukhansan Mountain Hike", category:"outdoor_adventure", tags:["hiking","outdoor","adventure","strenuous"], intensity:"high", costLevel:"free", voterMemberIds:["m1","m2"], excludedForMemberIds:["m3"] },
        { placeId:"outdoor2", name:"Han River Kayaking", category:"outdoor_adventure", tags:["water","outdoor","adventure","physical"], intensity:"high", costLevel:"moderate", voterMemberIds:["m1","m2"], excludedForMemberIds:["m3"] },
        { placeId:"outdoor3", name:"Olympic Park Running Trail", category:"outdoor", tags:["outdoor","fitness","active"], intensity:"moderate", costLevel:"free", voterMemberIds:["m1","m2"], excludedForMemberIds:["m3"] },
        { placeId:"shop1",   name:"Myeongdong Shopping Street", category:"shopping", tags:["shopping","retail"], intensity:"low", costLevel:"moderate", voterMemberIds:["m3"] },
        { placeId:"shop2",   name:"Dongdaemun Design Plaza & Market", category:"shopping", tags:["shopping","design"], intensity:"low", costLevel:"low", voterMemberIds:["m3"] },
        { placeId:"culture1",name:"Gyeongbokgung Palace", category:"culture", tags:["history","landmark"], intensity:"low", costLevel:"low", voterMemberIds:["m1","m2","m3"] },
        { placeId:"culture2",name:"Insadong Art Street", category:"culture", tags:["art","culture"], intensity:"low", costLevel:"free", voterMemberIds:["m1","m2","m3"] },
        { placeId:"culture3",name:"Bukchon Hanok Village", category:"culture", tags:["history","village"], intensity:"moderate", costLevel:"free", voterMemberIds:["m2","m3"] },
      ],
      foodCandidates:[
        { placeId:"food1", name:"Gwangjang Market street food", category:"food", voterMemberIds:["m1","m2","m3"] },
        { placeId:"food2", name:"Korean BBQ Samgyeopsal", category:"food", voterMemberIds:["m1","m2","m3"] },
        { placeId:"food3", name:"Myeongdong Kalguksu noodles", category:"food", voterMemberIds:["m3"] },
      ],
    },
    judgePrompt: (outA, outB) => {
      const cm = buildCandidateMap();
      const fmtSplit = (o, label) => {
        const rows = (o?.days||[]).map(d => {
          const acts = (d.activities||[]).map(activityId).map(id => { const c=cm.get(id); return `${c?.name??id} [${c?.category??'?'}]`; });
          return `Day ${d.dayIndex??d.dayNumber}: ${acts.join(' → ')} | Lunch: ${cm.get(d.lunch)?.name??d.lunch??'—'} | Dinner: ${cm.get(d.dinner)?.name??d.dinner??'—'}`;
        }).join('\n');
        return `=== ${label} ===\n${rows}`;
      };
      return `GROUP PROFILE
3 close friends, 3 days in Seoul, South Korea.
Members: Alex (m1), Jordan (m2), Sam (m3)
Budget: moderate | Energy: high

TRIP CONSTRAINTS
Alex & Jordan (m1, m2): prefer outdoor_adventure — voted Bukhansan Hike (outdoor1), Han River Kayaking (outdoor2), Olympic Trail (outdoor3)
Sam (m3):
  Trip A: prefers shopping. NO deal breakers — outdoor activities are allowed.
  Trip B: HAS DEAL BREAKERS on outdoor/adventure/hiking/strenuous/physical — all outdoor candidates are excludedForMemberIds=["m3"]
  → Trip B expected: outdoor activities removed (Sam can't participate); culture + shopping fill the gap

${fmtSplit(outA, "Trip A — Sam has no deal breaker")}

${fmtSplit(outB, "Trip B — Sam's deal breaker removes outdoor")}

COMPARISON QUESTION: In Trip B, did Sam's deal breaker actually REMOVE outdoor activities (Bukhansan, Kayaking, Olympic Trail)? Were they replaced by culture/shopping activities? Is the 2-vs-1 majority conflict resolved fairly without ignoring Alex & Jordan entirely?`;
    },
    checks: [
      { desc:"Both return 3 days", fn:(a,b) => a?.days?.length===3 && b?.days?.length===3 },
      { desc:"A includes outdoor activities", fn:(a) => (a?.days||[]).some(d=>(d.activities||[]).map(activityId).some(id=>id?.startsWith("outdoor"))) },
      { desc:"B has fewer outdoor activities than A", fn:(a,b) => {
        const n = o => (o?.days||[]).reduce((s,d)=>s+(d.activities||[]).map(activityId).filter(id=>id?.startsWith("outdoor")).length,0);
        return n(b) <= n(a);
      }},
      { desc:"B includes culture/shopping activities", fn:(_,b) => (b?.days||[]).some(d=>(d.activities||[]).map(activityId).some(id=>id?.startsWith("shop")||id?.startsWith("culture"))) },
    ],
  },

  // ── 4. Split Plan Logic ─────────────────────────────────────────────────────
  {
    id: "split_plan",
    label: "4 · Split Plan Logic",
    subtitle: "Divergent prefs (adventure vs art/culture) should split; convergent (both adventure) should not",
    endpoint: "split",
    tripA: {
      label: "Trip A — Divergent: adventure vs art → SPLIT expected",
      inputSummary:{ m1:"outdoor_adventure, hates museums", m2:"art/culture, hates physical", candidates:"climbing/kayaking/cycling for m1; MoMA/Met/Whitney for m2", groupSplitComfort:"high", expect:"needsSplit=true, genuinely different activities per group" },
    },
    tripB: {
      label: "Trip B — Convergent: both adventure → NO SPLIT expected",
      inputSummary:{ m1:"outdoor_adventure", m2:"outdoor_adventure", candidates:"all outdoor shared (climbing, kayaking, bike)", groupSplitComfort:"low", expect:"needsSplit=false, everyone does the same activities" },
    },
    splitPayloadA: {
      tripId:"eval-split-a", tripDays:2, memberIds:["m1","m2"],
      conflicts:[
        { type:"activity_preference", description:"Alex strongly prefers outdoor adventure (climbing, kayaking, cycling). Morgan strongly prefers art and culture (galleries, museums). Minimal activity overlap." },
        { type:"energy_level", description:"Alex wants high-intensity physical days. Morgan prefers relaxed low-intensity cultural experiences." },
      ],
      groupCandidates:[
        { placeId:"neutral1", name:"Central Park stroll", category:"parks", intensity:"low" },
        { placeId:"neutral2", name:"Brooklyn Bridge walk", category:"outdoor", intensity:"low" },
        { placeId:"food_nyc1", name:"Brunch at local diner", category:"food", intensity:"low" },
      ],
      splitCandidates:[
        { placeId:"adv1", name:"Brooklyn Boulders Rock Climbing", memberId:"m1", category:"outdoor_adventure", intensity:"high" },
        { placeId:"adv2", name:"Brooklyn Bridge Bike Ride", memberId:"m1", category:"outdoor", intensity:"moderate" },
        { placeId:"adv3", name:"Hudson River Kayaking", memberId:"m1", category:"outdoor_adventure", intensity:"high" },
        { placeId:"art1", name:"MoMA — Museum of Modern Art", memberId:"m2", category:"art_culture", intensity:"low" },
        { placeId:"art2", name:"Metropolitan Museum of Art", memberId:"m2", category:"art_culture", intensity:"low" },
        { placeId:"art3", name:"Whitney Museum American Art", memberId:"m2", category:"art_culture", intensity:"low" },
      ],
      groupProfile:{
        groupType:"close_friends", groupBudgetLevel:"moderate", groupEnergyLevel:"mixed",
        memberPreferences:[
          { memberId:"m1", energyLevel:"high", activityTypes:["outdoor_adventure"], dealBreakers:["museums","galleries","art"] },
          { memberId:"m2", energyLevel:"low", activityTypes:["art_culture"], dealBreakers:["physical","strenuous","hiking","climbing","kayaking"] },
        ],
        members:[{id:"m1",name:"Alex"},{id:"m2",name:"Morgan"}],
      },
      groupSplitComfort:"high",
    },
    splitPayloadB: {
      tripId:"eval-split-b", tripDays:2, memberIds:["m1","m2"],
      conflicts:[
        { type:"minor_timing", description:"Alex and Morgan both love outdoor adventure. Minor timing disagreement — Alex prefers mornings, Morgan prefers afternoons. Very minor conflict." },
      ],
      groupCandidates:[
        { placeId:"adv1", name:"Brooklyn Boulders Rock Climbing", category:"outdoor_adventure", intensity:"high" },
        { placeId:"adv2", name:"Brooklyn Bridge Bike Ride", category:"outdoor", intensity:"moderate" },
        { placeId:"adv3", name:"Hudson River Kayaking", category:"outdoor_adventure", intensity:"high" },
        { placeId:"adv4", name:"Central Park trail run", category:"outdoor", intensity:"moderate" },
        { placeId:"food_nyc1", name:"Post-hike burger joint", category:"food", intensity:"low" },
      ],
      splitCandidates:[],
      groupProfile:{
        groupType:"close_friends", groupBudgetLevel:"moderate", groupEnergyLevel:"high",
        memberPreferences:[
          { memberId:"m1", energyLevel:"high", activityTypes:["outdoor_adventure"], dealBreakers:[] },
          { memberId:"m2", energyLevel:"high", activityTypes:["outdoor_adventure"], dealBreakers:[] },
        ],
        members:[{id:"m1",name:"Alex"},{id:"m2",name:"Morgan"}],
      },
      groupSplitComfort:"low",
    },
    judgePrompt: (outA, outB) => `GROUP PROFILE
2 close friends, 2 days in New York City.
Members: Alex (m1), Morgan (m2)

TRIP CONSTRAINTS
Trip A: Alex = outdoor adventure (deal breaker: museums/galleries). Morgan = art/culture (deal breaker: physical/strenuous/hiking).
  Very divergent → SPLIT EXPECTED. Ideal: Alex does climbing/kayaking while Morgan visits MoMA/Met.
Trip B: Both Alex AND Morgan love outdoor adventure. Only minor timing difference.
  Convergent → NO SPLIT. Everyone does the same outdoor activities together.

TRIP A SPLIT DECISION
needsSplit: ${outA.needsSplit} | splitDays: ${outA.splitDays} | personalityInfluenced: ${outA.personalityInfluenced}
Together activities: ${JSON.stringify(outA.groupActivities)}
Group 1 [${(outA.splitGroups?.[0]?.memberIds||[]).join(',')}] ${outA.splitGroups?.[0]?.timeWindow?.start??'?'}–${outA.splitGroups?.[0]?.timeWindow?.end??'?'}: ${(outA.splitGroups?.[0]?.activities||[]).join(', ')||'(none)'}
Group 2 [${(outA.splitGroups?.[1]?.memberIds||[]).join(',')}] ${outA.splitGroups?.[1]?.timeWindow?.start??'?'}–${outA.splitGroups?.[1]?.timeWindow?.end??'?'}: ${(outA.splitGroups?.[1]?.activities||[]).join(', ')||'(none)'}
Reasoning: ${outA.reasoning}

TRIP B SPLIT DECISION
needsSplit: ${outB.needsSplit} | splitDays: ${outB.splitDays}
Together activities: ${JSON.stringify(outB.groupActivities)}
Split groups: ${outB.splitGroups?.length ? JSON.stringify(outB.splitGroups.map(g=>({members:g.memberIds,acts:g.activities}))) : '(none)'}
Reasoning: ${outB.reasoning}

COMPARISON QUESTION: Did Trip A correctly split divergent preferences into genuinely different sub-group activities (adventure vs art museums)? Did Trip B correctly keep everyone together for shared outdoor adventures?`,
    checks: [
      { desc:"A: needsSplit=true (divergent prefs should split)", fn:(a) => a?.needsSplit===true },
      { desc:"B: needsSplit=false (convergent prefs should not split)", fn:(_,b) => b?.needsSplit===false },
      { desc:"A: split groups have different activities (not same place)", fn:(a) => {
        if (!a?.splitGroups?.length || a.splitGroups.length < 2) return false;
        const g0 = (a.splitGroups[0]?.activities||[]).join(",");
        const g1 = (a.splitGroups[1]?.activities||[]).join(",");
        return g0 !== g1 && g0.length>0 && g1.length>0;
      }},
    ],
  },

  // ── 5. Weekday vs Weekend ───────────────────────────────────────────────────
  {
    id: "weekday_weekend",
    label: "5 · Weekday vs Weekend Start",
    subtitle: "Monday start (museum closures) vs Saturday start (markets, brunch) — Paris couple",
    endpoint: "day+holistic",
    tripA: {
      label: "Trip A — Monday start",
      tripName:"Paris Trip", destination:"Paris, France", tripDays:3,
      scheduledDays: days(3),
      groupContext: groupCtx({
        groupType:"couple",
        members:[mem("m1","Alex","organizer"),mem("m2","Jordan")],
        prefs:[
          pref("m1",{activityTypes:["culture","food","art"],budget:"moderate"}),
          pref("m2",{activityTypes:["culture","food","art"],budget:"moderate"}),
        ],
        budget:"moderate", energy:"moderate", activityTypes:["culture","food","art"],
        tripStartDate:"2026-09-07", tripWeekdays:["Monday"],
        candidatesBrief: PARIS_NONFOOD.map(c=>({placeId:c.placeId,name:c.name,source:"fsq",openingNotes:c.openingNotes,costLevel:c.costLevel})),
        dailyCapacityReasoning:"Day 1 = Monday (Musée d'Orsay CLOSED on Mondays). Day 2 = Tuesday (Louvre CLOSED on Tuesdays). Plan must avoid closed venues on those days.",
      }),
      inputSummary:{ groupType:"couple", destination:"Paris", startDate:"Mon 2026-09-07", day1:"Monday (Orsay closed)", day2:"Tuesday (Louvre closed)", day3:"Wednesday (all open)", activities:"culture, food, art" },
    },
    tripB: {
      label: "Trip B — Saturday start",
      tripName:"Paris Trip", destination:"Paris, France", tripDays:3,
      scheduledDays: days(3),
      groupContext: groupCtx({
        groupType:"couple",
        members:[mem("m1","Alex","organizer"),mem("m2","Jordan")],
        prefs:[
          pref("m1",{activityTypes:["culture","food","art"],budget:"moderate"}),
          pref("m2",{activityTypes:["culture","food","art"],budget:"moderate"}),
        ],
        budget:"moderate", energy:"moderate", activityTypes:["culture","food","art"],
        tripStartDate:"2026-09-05", tripWeekdays:["Saturday"],
        candidatesBrief: PARIS_NONFOOD.map(c=>({placeId:c.placeId,name:c.name,source:"fsq",openingNotes:c.openingNotes,costLevel:c.costLevel})),
        dailyCapacityReasoning:"Day 1 = Saturday (Marché Bastille open!). Day 2 = Sunday (Marché Bastille open again Thu/Sun). Weekend = busier museums; book ahead. Weekend brunch culture is vibrant.",
      }),
      inputSummary:{ groupType:"couple", destination:"Paris", startDate:"Sat 2026-09-05", day1:"Saturday (Bastille Market open, weekend vibe)", day2:"Sunday (all museums open, brunch culture)", day3:"Monday (Orsay closed — plan accordingly)", activities:"culture, food, art" },
    },
    get holisticPayloadA() {
      return makeHolisticPayload("eval-ww-a", 3, "Paris, France", this.tripA.groupContext, PARIS_NONFOOD, PARIS_FOOD);
    },
    get holisticPayloadB() {
      return makeHolisticPayload("eval-ww-b", 3, "Paris, France", this.tripB.groupContext, PARIS_NONFOOD, PARIS_FOOD);
    },
    judgePrompt: (outA, outB) => {
      const cm = buildCandidateMap();
      return `GROUP PROFILE
Couple, 3 days in Paris, France.
Members: Alex, Jordan
Budget: moderate | Energy: moderate | Activities: culture, food, art

TRIP CONSTRAINTS
Trip A starts Monday 2026-09-07:
  Day 1 = Monday → Musée d'Orsay (pa2) CLOSED. Use Louvre (pa1) or outdoor alternatives.
  Day 2 = Tuesday → Louvre (pa1) CLOSED. Use Orsay (pa2) or alternatives.
  Day 3 = Wednesday → everything open.

Trip B starts Saturday 2026-09-05:
  Day 1 = Saturday → Marché Bastille (pa4) OPEN (Thu & Sun mornings — wait, Saturday: closed! Correct: Marché Bastille opens Thu & Sun only). Weekend brunch (pf1) is popular.
  Day 2 = Sunday → Marché Bastille OPEN (pa4). All museums open. Brunch culture strong.
  Day 3 = Monday → Musée d'Orsay (pa2) CLOSED on Mondays.

NOTE: pa4 (Marché Bastille) opens THURSDAY and SUNDAY mornings only. So for Trip B:
  Saturday (Day 1): Bastille market is NOT open — lean into weekend brunch and Eiffel/Montmartre vibes
  Sunday (Day 2): Bastille market IS open — ideal slot for pa4

TRIP A ITINERARY (Monday start)
${formatItineraryForJudge(outA, cm)}

TRIP B ITINERARY (Saturday start)
${formatItineraryForJudge(outB, cm)}

COMPARISON QUESTION: Did both itineraries correctly avoid scheduling closed venues on those days? Did Trip B leverage the weekend calendar (Sunday market, brunch culture) in its activity selection and reasoning? Are the two plans clearly differentiated by their calendar constraints?`;
    },
    checks: [
      { desc:"Both return 3 days", fn:(a,b) => a?.days?.length===3 && b?.days?.length===3 },
      { desc:"A reasoning acknowledges weekday/closure schedule", fn:(a) => /monday|tuesday|weekday|clos|open|hour/i.test(JSON.stringify(a?.days)) },
      { desc:"B reasoning acknowledges weekend/market/Saturday", fn:(_,b) => /saturday|weekend|market|brunch|lively|sunday|bastille/i.test(JSON.stringify(b?.days)) },
      { desc:"B includes Marché Bastille (pa4) on Day 2 (Sunday, not Saturday)", fn:(_,b) => {
        const d2 = (b?.days||[]).find(d=>d.dayIndex===2||d.dayNumber===2);
        return (d2?.activities||[]).map(activityId).includes("pa4");
      }},
    ],
  },

  // ── 6. MBTI Conflict ────────────────────────────────────────────────────────
  {
    id: "mbti_conflict",
    label: "6 · MBTI Personality — Same Conflict, Different Resolution",
    subtitle: "Introvert + high split-comfort → split encouraged; Extrovert + low split-comfort → compromise",
    endpoint: "split",
    tripA: {
      label: "Trip A — Riley is introvert, high split-comfort",
      inputSummary:{ conflict:"Alex=adventure, Riley=culture (identical)", riley_mbti:"energyFromPeople=drains (INTROVERT), groupOrientation=independent", groupSplitComfort:"high", groupPlanningStyleVariance:"high", expect:"needsSplit=true — introvert benefits from solo cultural time" },
    },
    tripB: {
      label: "Trip B — Riley is extrovert, low split-comfort",
      inputSummary:{ conflict:"Alex=adventure, Riley=culture (identical)", riley_mbti:"energyFromPeople=charges (EXTROVERT), groupOrientation=together", groupSplitComfort:"low", groupPlanningStyleVariance:"low", expect:"needsSplit=false — extrovert prefers staying with group, find compromise" },
    },
    splitPayloadA: {
      tripId:"eval-mbti-a", tripDays:2, memberIds:["m1","m2"],
      conflicts:[{ type:"activity_preference", description:"Alex prefers outdoor adventure. Riley prefers art/culture galleries. Direct preference conflict, no natural overlap activity." }],
      groupCandidates:[
        { placeId:"n1", name:"Vondelpark afternoon stroll", category:"parks", intensity:"low" },
        { placeId:"n2", name:"Amsterdam canal cruise", category:"sightseeing", intensity:"low" },
        { placeId:"n3", name:"Jordaan neighbourhood food walk", category:"food", intensity:"low" },
      ],
      splitCandidates:[
        { placeId:"a1", name:"Amsterdam Forest bike ride", memberId:"m1", category:"outdoor", intensity:"high" },
        { placeId:"a2", name:"Zandvoort beach & surf lesson", memberId:"m1", category:"outdoor_adventure", intensity:"high" },
        { placeId:"c1", name:"Rijksmuseum (Dutch Masters)", memberId:"m2", category:"art_culture", intensity:"low" },
        { placeId:"c2", name:"Van Gogh Museum", memberId:"m2", category:"art_culture", intensity:"low" },
        { placeId:"c3", name:"Anne Frank House", memberId:"m2", category:"culture_historical", intensity:"low" },
      ],
      groupProfile:{
        groupType:"close_friends", groupBudgetLevel:"moderate", groupEnergyLevel:"mixed",
        memberPreferences:[
          { memberId:"m1", energyLevel:"high", activityTypes:["outdoor_adventure"], dealBreakers:["museums"] },
          { memberId:"m2", energyLevel:"low", activityTypes:["art_culture"], dealBreakers:["strenuous","physical"] },
        ],
        members:[{id:"m1",name:"Alex"},{id:"m2",name:"Riley"}],
      },
      memberPersonalities:[
        { memberId:"m1", name:"Alex", signals:{ planningStyle:"spontaneous", groupOrientation:"together", energyFromPeople:"charges", conflictApproach:"direct", scheduleRigidity:"flexible" }},
        { memberId:"m2", name:"Riley", signals:{ planningStyle:"structured", groupOrientation:"independent", energyFromPeople:"drains", conflictApproach:"avoidant", scheduleRigidity:"rigid" }},
      ],
      groupPlanningStyleVariance:"high",
      groupSplitComfort:"high",
      personalityPromptAppendix:`Member personality signals:\n- Alex:\n    planning style: spontaneous,\n    group orientation: together,\n    energy from people: charges,\n    conflict approach: direct,\n    schedule rigidity: flexible\n- Riley:\n    planning style: structured,\n    group orientation: independent,\n    energy from people: drains,\n    conflict approach: avoidant,\n    schedule rigidity: rigid\n\nGroup split comfort: high\nPlanning style variance: high\n\nRiley's energy drains from group time — solo cultural time is restorative, not isolating. Split comfort is high so both are comfortable splitting.`,
    },
    splitPayloadB: {
      tripId:"eval-mbti-b", tripDays:2, memberIds:["m1","m2"],
      conflicts:[{ type:"activity_preference", description:"Alex prefers outdoor adventure, Riley prefers art/culture galleries. Mild preference divergence — group candidates (park stroll, canal cruise, food walk) offer viable compromise activities for both." }],
      groupCandidates:[
        { placeId:"n1", name:"Vondelpark afternoon stroll", category:"parks", intensity:"low" },
        { placeId:"n2", name:"Amsterdam canal cruise", category:"sightseeing", intensity:"low" },
        { placeId:"n3", name:"Jordaan neighbourhood food walk", category:"food", intensity:"low" },
      ],
      splitCandidates:[
        { placeId:"a1", name:"Amsterdam Forest bike ride", memberId:"m1", category:"outdoor", intensity:"high" },
        { placeId:"a2", name:"Zandvoort beach & surf lesson", memberId:"m1", category:"outdoor_adventure", intensity:"high" },
        { placeId:"c1", name:"Rijksmuseum (Dutch Masters)", memberId:"m2", category:"art_culture", intensity:"low" },
        { placeId:"c2", name:"Van Gogh Museum", memberId:"m2", category:"art_culture", intensity:"low" },
        { placeId:"c3", name:"Anne Frank House", memberId:"m2", category:"culture_historical", intensity:"low" },
      ],
      groupProfile:{
        groupType:"close_friends", groupBudgetLevel:"moderate", groupEnergyLevel:"mixed",
        memberPreferences:[
          { memberId:"m1", energyLevel:"high", activityTypes:["outdoor_adventure"], dealBreakers:["museums"] },
          { memberId:"m2", energyLevel:"moderate", activityTypes:["art_culture"], dealBreakers:["strenuous"] },
        ],
        members:[{id:"m1",name:"Alex"},{id:"m2",name:"Riley"}],
      },
      memberPersonalities:[
        { memberId:"m1", name:"Alex", signals:{ planningStyle:"spontaneous", groupOrientation:"together", energyFromPeople:"charges", conflictApproach:"direct", scheduleRigidity:"flexible" }},
        { memberId:"m2", name:"Riley", signals:{ planningStyle:"flexible", groupOrientation:"together", energyFromPeople:"charges", conflictApproach:"compromising", scheduleRigidity:"flexible" }},
      ],
      groupPlanningStyleVariance:"low",
      groupSplitComfort:"low",
      personalityOverride:"together",
      personalityPromptAppendix:`Member personality signals:\n- Alex:\n    planning style: spontaneous,\n    group orientation: together,\n    energy from people: charges,\n    conflict approach: direct,\n    schedule rigidity: flexible\n- Riley:\n    planning style: flexible,\n    group orientation: together,\n    energy from people: charges,\n    conflict approach: compromising,\n    schedule rigidity: flexible\n\nGroup split comfort: low\nPlanning style variance: low\n\nBoth members prefer being together (groupOrientation=together) and gain energy from the group. Split comfort is low — strongly prefer compromise over splitting. Only split if absolutely no shared activity exists.`,
    },
    judgePrompt: (outA, outB) => `GROUP PROFILE
2 close friends, 2 days in Amsterdam.
Members: Alex (m1), Riley (m2)
SAME activity conflict in both trips: Alex=outdoor adventure, Riley=art/culture

TRIP CONSTRAINTS
Trip A: Riley is an INTROVERT (energyFromPeople=drains, groupOrientation=independent). Group split comfort = HIGH.
  → Riley recharges with solo time → split is ideal → EXPECTED: needsSplit=true, personalityInfluenced=true
Trip B: Riley is an EXTROVERT (energyFromPeople=charges, groupOrientation=together). Group split comfort = LOW.
  → Riley prefers group time → compromise/together is ideal → EXPECTED: needsSplit=false

TRIP A SPLIT DECISION
needsSplit: ${outA.needsSplit} | splitDays: ${outA.splitDays} | personalityInfluenced: ${outA.personalityInfluenced}
Together activities: ${JSON.stringify(outA.groupActivities)}
Group 1 [${(outA.splitGroups?.[0]?.memberIds||[]).join(',')}] ${outA.splitGroups?.[0]?.timeWindow?.start??'?'}–${outA.splitGroups?.[0]?.timeWindow?.end??'?'}: ${(outA.splitGroups?.[0]?.activities||[]).join(', ')||'(none)'}
Group 2 [${(outA.splitGroups?.[1]?.memberIds||[]).join(',')}] ${outA.splitGroups?.[1]?.timeWindow?.start??'?'}–${outA.splitGroups?.[1]?.timeWindow?.end??'?'}: ${(outA.splitGroups?.[1]?.activities||[]).join(', ')||'(none)'}
Reasoning: ${outA.reasoning}

TRIP B SPLIT DECISION
needsSplit: ${outB.needsSplit} | splitDays: ${outB.splitDays} | personalityInfluenced: ${outB.personalityInfluenced}
Together activities: ${JSON.stringify(outB.groupActivities)}
Split groups: ${outB.splitGroups?.length ? JSON.stringify(outB.splitGroups.map(g=>({members:g.memberIds,acts:g.activities}))) : '(none)'}
Reasoning: ${outB.reasoning}

COMPARISON QUESTION: Did the MBTI/personality signals meaningfully change the split decision? Trip A should split (introvert benefits from solo time). Trip B should stay together (extrovert prefers group). Does reasoning explicitly reference personality signals, or is it generic conflict logic?`,
    checks: [
      { desc:"A: needsSplit=true (introvert + high split-comfort)", fn:(a) => a?.needsSplit===true },
      { desc:"B: needsSplit=false (extrovert + low split-comfort)", fn:(_,b) => b?.needsSplit===false },
      { desc:"A: personalityInfluenced=true", fn:(a) => a?.personalityInfluenced===true },
    ],
  },
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function runPair(pair) {
  console.log(`\n── ${pair.label} ──`);
  const t0 = Date.now();
  let outA=null, outB=null, holisticA=null, holisticB=null, err=null;

  try {
    if (pair.endpoint === "day+holistic") {
      const [drA, drB, hA, hB] = await Promise.all([
        callDayReasoning({ tripDays:pair.tripA.tripDays, tripName:pair.tripA.tripName, destination:pair.tripA.destination, groupContext:pair.tripA.groupContext, scheduledDays:pair.tripA.scheduledDays }),
        callDayReasoning({ tripDays:pair.tripB.tripDays, tripName:pair.tripB.tripName, destination:pair.tripB.destination, groupContext:pair.tripB.groupContext, scheduledDays:pair.tripB.scheduledDays }),
        callHolistic(pair.holisticPayloadA),
        callHolistic(pair.holisticPayloadB),
      ]);
      // Merge: attach theme/reasoning to holistic days by dayIndex
      outA = mergeOutputs(drA, hA);
      outB = mergeOutputs(drB, hB);
      holisticA = hA; holisticB = hB;
    } else if (pair.endpoint === "holistic") {
      [holisticA, holisticB] = await Promise.all([
        callHolistic(pair.holisticPayloadA),
        callHolistic(pair.holisticPayloadB),
      ]);
      outA = holisticA; outB = holisticB;
    } else if (pair.endpoint === "split") {
      [outA, outB] = await Promise.all([
        callSplitPlan(pair.splitPayloadA),
        callSplitPlan(pair.splitPayloadB),
      ]);
    }
  } catch(e) {
    err = e.message;
    console.log(`  API error: ${err}`);
  }

  const checkResults = (outA && outB) ? pair.checks.map(c => {
    let pass=false;
    try { pass = c.fn(outA, outB); } catch(_) {}
    return {...c, pass};
  }) : [];
  checkResults.forEach(c => console.log(`  ${c.pass?"✓":"✗"} ${c.desc}`));

  let judgeResult=null;
  if (outA && outB && !FAST && OPENAI_KEY) {
    try {
      console.log(`  Running LLM judge…`);
      const sysPrompt = pair.endpoint === 'split' ? SPLIT_JUDGE_SYSTEM_PROMPT : JUDGE_SYSTEM_PROMPT;
      judgeResult = await callLlmJudge(pair.judgePrompt(outA, outB), sysPrompt);
      console.log(`  Score: ${judgeResult.score??'?'}/100`);
    } catch(e) {
      judgeResult = { text:`Error: ${e.message}`, score:null };
    }
  }

  return { ...pair, outA, outB, holisticA, holisticB, err, checkResults, judgeResult, durationMs:Date.now()-t0 };
}

function mergeOutputs(dayReasoning, holistic) {
  // Build a map dayIndex → { theme, dayReasoning } from dayReasoning.days
  const themeMap = new Map();
  for (const d of (dayReasoning?.days??[])) themeMap.set(d.dayNumber??d.dayIndex, d);
  // Attach to holistic days
  const merged = (holistic?.days??[]).map(hd => {
    const dr = themeMap.get(hd.dayIndex) ?? themeMap.get(hd.dayIndex+1) ?? {};
    return { ...hd, theme:dr.theme??"", dayReasoning:dr.dayReasoning??"" };
  });
  // If holistic is empty, fall back to day-reasoning days
  if (!merged.length) {
    return { days: (dayReasoning?.days??[]).map(d=>({...d, activities:[], lunch:null, dinner:null})) };
  }
  return { days: merged };
}

// ── HTML Report ───────────────────────────────────────────────────────────────

const esc = s => String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const scoreColor = s => s==null?"#888":s>=80?"#16a34a":s>=60?"#ca8a04":"#dc2626";

function renderInputTable(a, b) {
  const keys = [...new Set([...Object.keys(a.inputSummary), ...Object.keys(b.inputSummary)])];
  return `<table class="input-table">
    <thead><tr><th>Field</th><th>Trip A — ${esc(a.label)}</th><th>Trip B — ${esc(b.label)}</th></tr></thead>
    <tbody>${keys.map(k=>{
      const va=String(a.inputSummary[k]??"—"), vb=String(b.inputSummary[k]??"—"), diff=va!==vb;
      return `<tr${diff?' class="diff-row"':''}><td class="key">${esc(k)}</td><td class="${diff?"diff-cell":""}">${esc(va)}</td><td class="${diff?"diff-cell":""}">${esc(vb)}</td></tr>`;
    }).join("")}</tbody>
  </table>`;
}

const CAT_COLOR = {
  culture:'#7c3aed', art_culture:'#7c3aed', culture_historical:'#6d28d9',
  outdoor:'#15803d', outdoor_adventure:'#166534',
  food:'#c2410c', market:'#b45309',
  shopping:'#be185d', nightlife:'#4338ca', social:'#4f46e5',
  parks:'#16a34a', sightseeing:'#0284c7', landmark:'#0369a1',
  museum:'#7e22ce', sports:'#0d9488',
};
const COST_LABEL = { free:'Free', low:'$', moderate:'$$', high:'$$$', very_high:'$$$$' };
const INTENS_ICON = { low:'🧘', moderate:'🚶', high:'💪' };

function renderTimeline(slots) {
  return `<div class="tl-wrap">${slots.map(s => {
    if (s.type === 'transit') return `<div class="tl-transit"><div class="tl-transit-line"></div><span class="tl-transit-lbl">🚌 ${s.mins} min</span></div>`;
    const isMeal = s.type === 'lunch' || s.type === 'dinner';
    const cc = isMeal ? '#c2410c' : (CAT_COLOR[s.category] ?? '#6b7280');
    const bg = cc + '18';
    const mealIcon = s.type==='lunch' ? '🍽' : '🌙';
    const mealLbl = s.type==='lunch' ? 'LUNCH' : 'DINNER';
    const catStr = (s.category??'').replace(/_/g,' ');
    return `<div class="tl-row">
      <div class="tl-time">${esc(s.time)}</div>
      <div class="tl-dot-col"><div class="tl-dot" style="background:${cc}"></div><div class="tl-stem"></div></div>
      <div class="tl-card" style="border-left:3px solid ${cc}">
        <div class="tl-card-top">
          ${isMeal
            ? `<span class="tl-badge" style="background:${bg};color:${cc}">${mealIcon} ${mealLbl}</span>`
            : `<span class="tl-badge" style="background:${bg};color:${cc}">${esc(catStr)}</span>`}
          ${s.openingNotes ? `<span class="tl-warn">⚠ ${esc(s.openingNotes)}</span>` : ''}
        </div>
        <div class="tl-name">${esc(s.name)}</div>
        <div class="tl-meta">
          ${s.durationMins ? `<span class="tl-pill">⏱ ${s.durationMins}min</span>` : ''}
          ${s.costLevel ? `<span class="tl-pill">${esc(COST_LABEL[s.costLevel]??s.costLevel)}</span>` : ''}
          ${s.intensity ? `<span class="tl-pill">${INTENS_ICON[s.intensity]??''} ${esc(s.intensity)}</span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function renderItineraryCol(out, label) {
  if (!out?.days?.length) return `<div class="output-col error-box">No output</div>`;
  const cm = buildCandidateMap();
  return `<div class="output-col">
    <div class="output-label">${esc(label)}</div>
    ${out.days.map(d => {
      const dayNum = d.dayIndex ?? d.dayNumber ?? "?";
      const slots = estimateDaySchedule(d.activities||[], d.lunch, d.dinner, cm);
      return `<div class="day-block">
        <div class="day-title">Day ${dayNum}${d.theme ? ` — <em>${esc(d.theme)}</em>` : ''}</div>
        ${slots.length ? renderTimeline(slots) : '<div class="no-acts">No activities assigned</div>'}
        ${d.dayReasoning ? `<details class="reasoning-details"><summary>Why this day?</summary><div class="reasoning">${esc(d.dayReasoning)}</div></details>` : ''}
      </div>`;
    }).join('')}
  </div>`;
}

function renderSplitCol(out, label) {
  if (!out) return `<div class="output-col error-box">No output</div>`;
  return `<div class="output-col">
    <div class="output-label">${esc(label)}</div>
    <div class="split-badge-row">
      ${out.needsSplit ? `<span class="split-yes">✂ SPLIT PLAN</span>` : `<span class="split-no">✓ TOGETHER</span>`}
      <span class="split-meta">splitDays: ${esc(String(out.splitDays??0))} · personality: ${out.personalityInfluenced?"yes":"no"}</span>
    </div>
    ${(out.splitGroups?.length) ? `<div class="split-groups">${out.splitGroups.map((g,i)=>`
      <div class="split-group">
        <strong>Group ${i+1}</strong> [${(g.memberIds||[]).join(", ")}]
        <span class="split-time">${g.timeWindow?.start||""}–${g.timeWindow?.end||""}</span>
        <div class="act-list">${(g.activities||[]).map(a=>`<span class="act-chip">${esc(a)}</span>`).join('<span class="act-arrow">→</span>')}</div>
      </div>`).join("")}</div>` : ""}
    ${(out.groupActivities?.length) ? `<div class="day-block"><strong>Together:</strong><div class="act-list">${out.groupActivities.map(a=>`<span class="act-chip together">${esc(a)}</span>`).join('<span class="act-arrow">→</span>')}</div></div>` : ""}
    <div class="reasoning">${esc(out.reasoning)}</div>
  </div>`;
}

function renderOutputRow(result) {
  if (result.err) return `<div class="error-box">Error: ${esc(result.err)}</div>`;
  if (result.endpoint==="split") {
    return `<div class="output-row">${renderSplitCol(result.outA, result.tripA.label)}${renderSplitCol(result.outB, result.tripB.label)}</div>`;
  }
  return `<div class="output-row">${renderItineraryCol(result.outA, result.tripA.label)}${renderItineraryCol(result.outB, result.tripB.label)}</div>`;
}

function renderChecks(checks) {
  if (!checks.length) return "";
  const p=checks.filter(c=>c.pass).length;
  return `<div class="checks-bar">
    <span class="checks-summary ${p===checks.length?"all-pass":"some-fail"}">${p}/${checks.length} checks</span>
    ${checks.map(c=>`<span class="check-chip ${c.pass?"pass":"fail"}">${c.pass?"✓":"✗"} ${esc(c.desc)}</span>`).join("")}
  </div>`;
}

const RECO_COLOR = { Excellent:'#16a34a', Good:'#22c55e', Acceptable:'#ca8a04', 'Needs Revision':'#ea580c', Poor:'#dc2626' };
const ITINERARY_CRITERIA = [
  ['individual_satisfaction','Individual Satisfaction','30%'],
  ['group_fairness','Group Fairness','20%'],
  ['logistics_quality','Logistics Quality','15%'],
  ['budget_fit','Budget Fit','10%'],
  ['pace_energy','Pace & Energy','10%'],
  ['flexibility','Flexibility','5%'],
  ['conflict_resolution','Conflict Resolution','10%'],
];
const SPLIT_CRITERIA = [
  ['split_necessity','Split Necessity','30%'],
  ['activity_segregation','Activity Segregation','25%'],
  ['group_cohesion','Group Cohesion','20%'],
  ['reasoning_quality','Reasoning Quality','15%'],
  ['personality_influence','Personality Influence','10%'],
];

function renderTripEval(tripData, tripLabel, criteria) {
  if (!tripData) return `<div class="trip-eval-col"><div class="trip-eval-label">${esc(tripLabel)}</div><p style="color:#aaa;font-size:11px">No data</p></div>`;
  const total = tripData.total;
  const reco = tripData.recommendation;
  const recoColor = RECO_COLOR[reco] ?? '#6b7280';
  const totalColor = total>=80?'#16a34a':total>=60?'#ca8a04':'#dc2626';

  const barHtml = (n) => {
    const c = n>=80?'#16a34a':n>=60?'#ca8a04':'#dc2626';
    return `<div class="score-bar-wrap"><div class="score-bar" style="width:${n}%;background:${c}"></div></div>`;
  };

  const scoresHtml = criteria.map(([key,lbl,wt]) => {
    const entry = tripData.scores?.[key] ?? {};
    const v = entry.score ?? 0;
    const vc = v>=80?'#16a34a':v>=60?'#ca8a04':'#dc2626';
    return `<div class="crit-row">
      <div class="crit-meta">
        <span class="crit-lbl">${lbl}</span>
        <span class="crit-wt">${wt}</span>
        <span class="crit-val" style="color:${vc}">${v}</span>
      </div>
      ${barHtml(v)}
      ${entry.good ? `<div class="crit-evidence good">✓ ${esc(entry.good)}</div>` : ''}
      ${entry.bad  ? `<div class="crit-evidence bad">✗ ${esc(entry.bad)}</div>`  : ''}
    </div>`;
  }).join('');

  const ptHtml = tripData.per_traveler?.length ? `
    <div class="judge-section">
      <div class="judge-section-title">Per-traveler</div>
      <table class="pt-table">
        <thead><tr><th>Member</th><th>Wanted</th><th>Got</th><th>Missed</th><th></th></tr></thead>
        <tbody>${tripData.per_traveler.map(pt=>`<tr>
          <td><strong>${esc(pt.member??'')}</strong></td>
          <td>${esc(pt.preferences??'')}</td>
          <td>${esc(pt.got??'')}</td>
          <td class="${pt.missed&&pt.missed!=='none'&&pt.missed!=='—'?'missed':''}">${esc(pt.missed??'—')}</td>
          <td>${pt.satisfied?'<span class="sat-yes">✓</span>':'<span class="sat-no">✗</span>'}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>` : '';

  const assessHtml = tripData.assessment ? `<p class="judge-prose" style="margin-top:6px">${esc(tripData.assessment)}</p>` : '';

  const improvHtml = tripData.top_improvements?.length ? `
    <div class="judge-section">
      <div class="judge-section-title">Top Improvements</div>
      <ol class="judge-list">${tripData.top_improvements.map(i=>`<li>${esc(i)}</li>`).join('')}</ol>
    </div>` : '';

  return `<div class="trip-eval-col">
    <div class="trip-eval-header">
      <span class="trip-eval-label">${esc(tripLabel)}</span>
      <div style="display:flex;align-items:center;gap:6px">
        ${reco ? `<span class="judge-reco" style="background:${recoColor}18;color:${recoColor};border-color:${recoColor}50">${esc(reco)}</span>` : ''}
        ${total!=null ? `<span class="judge-score" style="color:${totalColor}">${total}/100</span>` : ''}
      </div>
    </div>
    <div class="judge-criteria">${scoresHtml}</div>
    ${ptHtml}
    ${assessHtml}
    ${improvHtml}
  </div>`;
}

function renderJudge(j) {
  if (!j) return "";
  const s = j.structured;

  if (!s) {
    const total = j.score;
    const totalColor = total>=80?'#16a34a':total>=60?'#ca8a04':'#dc2626';
    return `<div class="judge-box">
      <div class="judge-header"><span class="judge-label">AI Evaluation</span>${total!=null?`<span class="judge-score" style="color:${totalColor}">${total}/100</span>`:""}</div>
      <pre class="judge-text">${esc(j.text)}</pre>
    </div>`;
  }

  // Detect which criteria set to use
  const sampleScores = s.trip_a?.scores ?? s.trip_b?.scores ?? {};
  const criteria = 'individual_satisfaction' in sampleScores ? ITINERARY_CRITERIA
                 : 'split_necessity' in sampleScores ? SPLIT_CRITERIA : ITINERARY_CRITERIA;

  const compareHtml = s.comparison ? `<div class="judge-compare"><div class="judge-section-title">Comparison</div><p class="judge-prose">${esc(s.comparison)}</p></div>` : '';
  const summaryHtml = s.summary ? `<p class="judge-summary">${esc(s.summary)}</p>` : '';

  return `<div class="judge-box">
    <div class="judge-header"><span class="judge-label">AI Evaluation</span></div>
    ${summaryHtml}
    <div class="judge-trips-grid">
      ${renderTripEval(s.trip_a, 'Trip A', criteria)}
      ${renderTripEval(s.trip_b, 'Trip B', criteria)}
    </div>
    ${compareHtml}
  </div>`;
}

function renderPair(r) {
  const p=r.checkResults.filter(c=>c.pass).length, t=r.checkResults.length;
  const s=r.judgeResult?.score;
  const cls=r.err?"error":p<t?"warn":"ok";
  return `<div class="pair-card ${cls}">
    <div class="pair-header">
      <div><div class="pair-title">${esc(r.label)}</div><div class="pair-subtitle">${esc(r.subtitle)}</div></div>
      <div class="pair-badges">
        <span class="badge ep">${esc(r.endpoint)}</span>
        <span class="badge ${p===t?"all-pass":"some-fail"}">${p}/${t} checks</span>
        ${(()=>{ const tA=r.judgeResult?.structured?.trip_a?.total; const tB=r.judgeResult?.structured?.trip_b?.total; return (tA!=null||tB!=null)?`<span class="badge score" style="background:#6b728015;color:#374151;border-color:#d1d5db">A:${tA??'?'} B:${tB??'?'}</span>`:""; })()}
        <span class="badge time">${r.durationMs}ms</span>
      </div>
    </div>
    <h4 class="section-label">Input Comparison</h4>
    ${renderInputTable(r.tripA, r.tripB)}
    <h4 class="section-label">Itinerary Comparison</h4>
    ${renderOutputRow(r)}
    ${renderChecks(r.checkResults)}
    ${renderJudge(r.judgeResult)}
  </div>`;
}

function buildHtml(results, ms) {
  const pc=results.reduce((s,r)=>s+r.checkResults.filter(c=>c.pass).length,0);
  const tc=results.reduce((s,r)=>s+r.checkResults.length,0);
  const scores=results.map(r=>r.judgeResult?.score).filter(s=>s!=null);
  const avg=scores.length?(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1):null;
  const ts=new Date().toLocaleString();
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI Planning Eval — ${ts}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#ececec;color:#111;font-size:14px}
.header{background:#111;color:#fff;padding:20px 28px}
.header h1{font-size:19px;font-weight:800}
.header .meta{font-size:11px;color:#888;margin-top:4px}
.summary{display:flex;gap:16px;padding:14px 28px;background:#fff;border-bottom:1px solid #ddd;flex-wrap:wrap}
.stat{text-align:center;min-width:80px}
.stat .val{font-size:26px;font-weight:800}
.stat .lbl{font-size:11px;color:#666;margin-top:2px}
.stat.pass .val{color:#16a34a}.stat.warn .val{color:#ca8a04}.stat.fail .val{color:#dc2626}
.content{max-width:1200px;margin:20px auto;padding:0 14px 60px}

/* pair card */
.pair-card{background:#fff;border-radius:12px;padding:20px;margin-bottom:22px;border:1px solid #ddd;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.pair-card.error{border-left:4px solid #dc2626}
.pair-card.warn{border-left:4px solid #ca8a04}
.pair-card.ok{border-left:4px solid #16a34a}
.pair-header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px}
.pair-title{font-size:16px;font-weight:800}
.pair-subtitle{font-size:12px;color:#666;margin-top:3px}
.pair-badges{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}
.badge{font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;border:1px solid;white-space:nowrap}
.badge.ep{background:#f0f9ff;color:#0369a1;border-color:#bae6fd}
.badge.all-pass{background:#f0fdf4;color:#16a34a;border-color:#bbf7d0}
.badge.some-fail{background:#fff7ed;color:#c2410c;border-color:#fed7aa}
.badge.time{background:#f9fafb;color:#6b7280;border-color:#e5e7eb}
.section-label{font-size:11px;font-weight:700;text-transform:uppercase;color:#999;margin:14px 0 7px;letter-spacing:.06em}

/* input table */
.input-table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:4px}
.input-table th{background:#f9fafb;padding:7px 10px;text-align:left;border-bottom:2px solid #e0e0e0;font-weight:700;font-size:11px;color:#555;white-space:nowrap}
.input-table td{padding:5px 10px;border-bottom:1px solid #f0f0f0;vertical-align:top}
.input-table td.key{font-weight:600;color:#444;width:170px;white-space:nowrap}
.diff-row td{background:#fffbeb}
.diff-cell{font-weight:700;color:#92400e}

/* output */
.output-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:6px}
.output-col{border:1px solid #e5e7eb;border-radius:8px;padding:12px;background:#fafafa;min-width:0;overflow:hidden}
.output-label{font-size:12px;font-weight:700;color:#444;margin-bottom:10px;padding-bottom:7px;border-bottom:1px solid #e5e7eb}
.day-block{margin-bottom:12px;background:#fff;border-radius:8px;padding:10px;border:1px solid #f0f0f0}
.day-title{font-size:12px;font-weight:700;margin-bottom:8px;color:#1a1a1a}
.day-title em{font-style:italic;font-weight:500;color:#444}
.no-acts{font-size:11px;color:#aaa;padding:6px 0}

/* timeline */
.tl-wrap{display:flex;flex-direction:column;gap:0}
.tl-row{display:flex;gap:6px;align-items:flex-start}
.tl-time{font-size:10px;font-weight:700;color:#888;width:38px;flex-shrink:0;padding-top:6px;font-family:monospace}
.tl-dot-col{display:flex;flex-direction:column;align-items:center;width:12px;flex-shrink:0}
.tl-dot{width:10px;height:10px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 2px currentColor;flex-shrink:0;margin-top:6px}
.tl-stem{width:2px;flex:1;min-height:8px;background:#e5e7eb;margin-top:2px}
.tl-card{flex:1;min-width:0;padding:5px 8px;border-radius:0 6px 6px 0;margin-bottom:2px;background:#fff}
.tl-card-top{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:3px}
.tl-badge{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:1px 6px;border-radius:8px;white-space:nowrap}
.tl-warn{font-size:9px;color:#b45309;background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:1px 5px;white-space:nowrap}
.tl-name{font-size:11px;font-weight:700;color:#1a1a1a;line-height:1.3;margin-bottom:3px}
.tl-meta{display:flex;gap:4px;flex-wrap:wrap}
.tl-pill{font-size:9px;color:#6b7280;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;padding:1px 5px;white-space:nowrap}
.tl-transit{display:flex;align-items:center;gap:6px;padding:2px 0 2px 56px}
.tl-transit-line{width:2px;height:16px;background:#e5e7eb}
.tl-transit-lbl{font-size:9px;color:#aaa;font-style:italic}

/* reasoning details */
.reasoning-details{margin-top:6px}
.reasoning-details summary{font-size:10px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.04em;cursor:pointer;padding:3px 0;list-style:none}
.reasoning-details summary::-webkit-details-marker{display:none}
.reasoning{font-size:11px;color:#555;line-height:1.6;margin-top:4px;padding:6px 8px;background:#f9fafb;border-radius:5px;white-space:pre-wrap}

/* split */
.act-list{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:5px 0}
.act-chip{background:#dbeafe;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:12px;padding:2px 8px;font-size:11px;font-weight:600;white-space:nowrap}
.act-chip.together{background:#dcfce7;color:#166534;border-color:#bbf7d0}
.act-arrow{color:#9ca3af;font-size:12px;margin:0 1px}

/* split */
.split-badge-row{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.split-yes{background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:8px;padding:4px 12px;font-size:13px;font-weight:800}
.split-no{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;border-radius:8px;padding:4px 12px;font-size:13px;font-weight:800}
.split-meta{font-size:11px;color:#666}
.split-groups{margin-bottom:10px}
.split-group{border:1px solid #e0e0e0;border-radius:6px;padding:8px 10px;margin-bottom:6px;background:#fff}
.split-group strong{font-size:12px;display:inline-block;margin-right:6px}
.split-time{font-size:11px;color:#888;border:1px solid #e0e0e0;border-radius:8px;padding:1px 6px;margin-left:4px}

/* checks */
.checks-bar{margin:10px 0;display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.checks-summary{font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;border:1px solid}
.checks-summary.all-pass{background:#f0fdf4;color:#16a34a;border-color:#bbf7d0}
.checks-summary.some-fail{background:#fff7ed;color:#c2410c;border-color:#fed7aa}
.check-chip{font-size:11px;padding:2px 8px;border-radius:12px;border:1px solid}
.check-chip.pass{background:#f0fdf4;color:#166534;border-color:#bbf7d0}
.check-chip.fail{background:#fef2f2;color:#991b1b;border-color:#fecaca}

/* judge */
.judge-box{margin-top:12px;border:1px solid #e5e7eb;border-radius:8px;padding:14px;background:#fafafa}
.judge-header{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
.judge-header-right{display:flex;align-items:center;gap:8px}
.judge-label{font-size:11px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.05em}
.judge-score{font-size:18px;font-weight:800;flex-shrink:0}
.judge-reco{font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;border:1px solid;white-space:nowrap}
.judge-summary{font-size:12px;color:#444;line-height:1.6;margin-bottom:10px;padding:8px;background:#fff;border-radius:6px;border:1px solid #e5e7eb}
.judge-text{font-size:11px;color:#444;white-space:pre-wrap;font-family:inherit;line-height:1.7}
/* two-column trip layout */
.judge-trips-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
.trip-eval-col{border:1px solid #e5e7eb;border-radius:7px;padding:10px;background:#fff;min-width:0}
.trip-eval-header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #f0f0f0}
.trip-eval-label{font-size:11px;font-weight:700;color:#444;white-space:nowrap}
/* criteria */
.judge-criteria{display:flex;flex-direction:column;gap:6px;margin-bottom:8px}
.crit-row{display:flex;flex-direction:column;gap:2px}
.crit-meta{display:flex;align-items:center;gap:4px}
.crit-lbl{font-size:10px;font-weight:600;color:#333;flex:1}
.crit-wt{font-size:9px;color:#bbb;width:26px;text-align:right;flex-shrink:0}
.crit-val{font-size:12px;font-weight:800;width:26px;text-align:right;flex-shrink:0}
.score-bar-wrap{height:4px;background:#f0f0f0;border-radius:3px;overflow:hidden;margin-bottom:2px}
.score-bar{height:100%;border-radius:3px}
.crit-evidence{font-size:9.5px;line-height:1.4;padding:1px 0}
.crit-evidence.good{color:#166534}
.crit-evidence.bad{color:#991b1b}
/* sections */
.judge-section{margin-top:8px}
.judge-section-title{font-size:9px;font-weight:700;text-transform:uppercase;color:#bbb;letter-spacing:.05em;margin-bottom:4px}
.judge-compare{margin-top:10px;padding-top:10px;border-top:1px solid #f0f0f0}
.judge-prose{font-size:11px;color:#444;line-height:1.6}
.judge-list{font-size:10.5px;color:#444;line-height:1.7;padding-left:16px;margin-top:2px}
.pt-table{width:100%;border-collapse:collapse;font-size:10px}
.pt-table th{background:#f9fafb;padding:3px 6px;text-align:left;font-size:9px;font-weight:700;color:#888;border-bottom:1px solid #e5e7eb}
.pt-table td{padding:3px 6px;border-bottom:1px solid #f5f5f5;vertical-align:top}
.pt-table td.missed{color:#dc2626}
.sat-yes{color:#16a34a;font-weight:800}.sat-no{color:#dc2626;font-weight:800}
@media(max-width:900px){.judge-trips-grid{grid-template-columns:1fr}}
.error-box{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px;font-size:12px;color:#dc2626}
@media(max-width:760px){.output-row{grid-template-columns:1fr}}
</style></head>
<body>
<div class="header">
  <h1>AI Planning Pair-Comparison Report</h1>
  <div class="meta">Run: ${ts} · Backend: ${esc(BASE)} · ${(ms/1000).toFixed(1)}s${FAST?" · fast mode":""}</div>
</div>
<div class="summary">
  <div class="stat ${pc===tc?"pass":pc/tc>0.7?"warn":"fail"}"><div class="val">${pc}/${tc}</div><div class="lbl">Checks passed</div></div>
  <div class="stat"><div class="val">${results.length}</div><div class="lbl">Pairs</div></div>
  ${avg!=null?`<div class="stat ${Number(avg)>=80?"pass":Number(avg)>=60?"warn":"fail"}"><div class="val">${avg}/100</div><div class="lbl">Avg score</div></div>`:""}
  <div class="stat"><div class="val">${FAST?"—":scores.length}</div><div class="lbl">LLM evals</div></div>
</div>
<div class="content">${results.map(renderPair).join("\n")}</div>
</body></html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`AI Planning Pair Evaluator · ${BASE} · pairs:${PAIRS.length} fast:${FAST}`);
  const t0=Date.now(), results=[];
  for (const pair of PAIRS) results.push(await runPair(pair));
  const ms=Date.now()-t0;
  fs.mkdirSync(path.join(ROOT,"reports"),{recursive:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,"-").slice(0,19);
  const out=path.join(ROOT,"reports",`ai-planning-eval-${stamp}.html`);
  fs.writeFileSync(out,buildHtml(results,ms));
  const pc=results.reduce((s,r)=>s+r.checkResults.filter(c=>c.pass).length,0);
  const tc=results.reduce((s,r)=>s+r.checkResults.length,0);
  console.log(`\n✓ Report: ${out}`);
  console.log(`  Checks: ${pc}/${tc}`);
  const bad=results.filter(r=>r.checkResults.some(c=>!c.pass));
  if (bad.length) console.log(`  Issues: ${bad.map(r=>r.label).join(", ")}`);
  else console.log(`  All checks passed.`);
}

main().catch(e=>{console.error("Fatal:",e);process.exit(1);});
