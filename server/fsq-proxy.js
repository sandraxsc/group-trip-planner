/**
 * API proxy (Express) — OpenAI + Foursquare server-side only.
 *
 * Env (never VITE_*): OPENAI_API_KEY, FSQ_API_KEY, GOOGLE_PLACES_API_KEY, ALLOWED_ORIGINS, OPENAI_MODEL, OPENAI_SPLIT_GROUP_MODEL, PORT
 * (Optional) VITE_GOOGLE_PLACES_API_KEY in .env is mirrored for local dev so the proxy can resolve real places without duplicating the key.
 * Dev: npm run dev:server  +  npm run dev (Vite proxies /api → this server)
 *
 * Routes:
 *   GET  /api/health
 *   POST /api/openai/enhance
 *   POST /api/openai/vote-gap-fill
 *   POST /api/openai/vote-gap-replacement
 *   POST /api/openai/split-group-plan
 *   POST /api/openai/daily-capacity
 *   POST /api/openai/holistic-day-assignment
 *   POST /api/openai/itinerary-day-reasoning
 *   POST /api/openai/itinerary-day-reasoning/stream  (SSE)
 *   POST /api/openai/meal-food-gap-fill
 *   POST /api/openai/explore-recommendations
 *   GET  /api/fsq/health
 *   GET  /api/fsq/search
 *   GET  /api/fsq/places/:fsq_id
 */
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { fetchWithTimeout, isUpstreamTimeout } from "./fetchWithTimeout.js";
import { searchTextFirstPlace } from "./placesGoogle.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV !== "production";

try {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^\s*FSQ_API_KEY\s*=\s*(.+?)\s*$/);
      if (m && !process.env.FSQ_API_KEY) process.env.FSQ_API_KEY = m[1].replace(/^["']|["']$/g, "").trim();
      const openAiMatch = line.match(/^\s*OPENAI_API_KEY\s*=\s*(.+?)\s*$/);
      if (openAiMatch && !process.env.OPENAI_API_KEY) {
        process.env.OPENAI_API_KEY = openAiMatch[1].replace(/^["']|["']$/g, "").trim();
      }
      const corsMatch = line.match(/^\s*ALLOWED_ORIGINS\s*=\s*(.+?)\s*$/);
      if (corsMatch && !process.env.ALLOWED_ORIGINS) {
        process.env.ALLOWED_ORIGINS = corsMatch[1].replace(/^["']|["']$/g, "").trim();
      }
      const gpMatch = line.match(/^\s*GOOGLE_PLACES_API_KEY\s*=\s*(.+?)\s*$/);
      if (gpMatch && !process.env.GOOGLE_PLACES_API_KEY) {
        process.env.GOOGLE_PLACES_API_KEY = gpMatch[1].replace(/^["']|["']$/g, "").trim();
      }
      const gpVite = line.match(/^\s*VITE_GOOGLE_PLACES_API_KEY\s*=\s*(.+?)\s*$/);
      if (gpVite && !process.env.GOOGLE_PLACES_API_KEY) {
        process.env.GOOGLE_PLACES_API_KEY = gpVite[1].replace(/^["']|["']$/g, "").trim();
      }
    }
  }
} catch (_) {}

const FSQ_BASE = "https://places-api.foursquare.com";
const OPENAI_BASE = "https://api.openai.com/v1/responses";
const PORT = Number(process.env.PORT) || 3001;
const BODY_TRUNCATE = 500;
const OPENAI_TIMEOUT_MS = 45_000;
const FSQ_TIMEOUT_MS = 10_000;

function getFsqKey() {
  return process.env.FSQ_API_KEY?.trim() || null;
}

function getOpenAiKey() {
  return process.env.OPENAI_API_KEY?.trim() || null;
}

function getPlacesKey() {
  return process.env.GOOGLE_PLACES_API_KEY?.trim() || process.env.VITE_GOOGLE_PLACES_API_KEY?.trim() || null;
}

/** Normalize for comparison (Render env often has trailing slashes or spaces). */
function normalizeOrigin(origin) {
  if (typeof origin !== "string") return "";
  let o = origin.trim();
  if ((o.startsWith("http://") || o.startsWith("https://")) && o.endsWith("/")) {
    o = o.slice(0, -1);
  }
  return o;
}

/** Exact origins plus optional host suffixes (e.g. ".vercel.app" for all Vercel deployments). */
function parseAllowedOriginsConfig() {
  const raw = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const exact = new Set();
  const hostSuffixes = [];
  for (const entry of raw) {
    const lower = entry.toLowerCase();
    if (lower === "*.vercel.app" || lower === "https://*.vercel.app") {
      hostSuffixes.push(".vercel.app");
      continue;
    }
    const n = normalizeOrigin(entry);
    if (n) exact.add(n);
  }
  return { exact, hostSuffixes };
}

function isOriginAllowed(reqOrigin, cfg) {
  const norm = normalizeOrigin(reqOrigin || "");
  if (!norm) return true;
  if (cfg.exact.has(norm)) return true;
  try {
    const host = new URL(reqOrigin).hostname;
    for (const suf of cfg.hostSuffixes) {
      if (host === suf.slice(1) || host.endsWith(suf)) return true;
    }
  } catch (_) {
    /* ignore */
  }
  return false;
}

function truncate(str, max = BODY_TRUNCATE) {
  if (typeof str !== "string") return String(str).slice(0, max);
  return str.length <= max ? str : str.slice(0, max) + "...";
}

const enhanceSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    proposals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          reason: { type: "string" },
          patch: {
            type: "object",
            additionalProperties: false,
            properties: {
              kind: { type: "string", enum: ["update_row", "insert_row", "remove_row"] },
              day: { type: "number" },
              rowId: { type: ["string", "null"] },
              changes: {
                type: "object",
                additionalProperties: false,
                properties: {
                  kind: { type: ["string", "null"] },
                  placeId: { type: ["string", "null"] },
                  mealSlot: { type: ["string", "null"] },
                  hotelLabel: { type: ["string", "null"] },
                  activityLabel: { type: ["string", "null"] },
                  isPlaceholder: { type: ["boolean", "null"] },
                },
                required: ["kind", "placeId", "mealSlot", "hotelLabel", "activityLabel", "isPlaceholder"],
              },
              index: { type: ["number", "null"] },
              row: {
                type: "object",
                additionalProperties: false,
                properties: {
                  id: { type: ["string", "null"] },
                  kind: { type: "string", enum: ["hotel", "activity"] },
                  placeId: { type: ["string", "null"] },
                  mealSlot: { type: ["string", "null"] },
                  hotelLabel: { type: ["string", "null"] },
                  activityLabel: { type: ["string", "null"] },
                  isPlaceholder: { type: ["boolean", "null"] },
                },
                required: ["id", "kind", "placeId", "mealSlot", "hotelLabel", "activityLabel", "isPlaceholder"],
              },
            },
            required: ["kind", "day", "rowId", "changes", "index", "row"],
          },
        },
        required: ["id", "title", "reason", "patch"],
      },
    },
  },
  required: ["summary", "proposals"],
};

const voteGapRecommendationItemSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    searchQuery: { type: "string" },
    reason: { type: "string" },
    fillsGap: { type: "string" },
    upgradeNote: { type: ["string", "null"] },
  },
  required: ["name", "searchQuery", "reason", "fillsGap", "upgradeNote"],
};

const voteGapFillResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    recommendations: {
      type: "array",
      items: voteGapRecommendationItemSchema,
      minItems: 0,
      maxItems: 10,
    },
  },
  required: ["recommendations"],
};

const voteGapReplacementResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    recommendation: voteGapRecommendationItemSchema,
  },
  required: ["recommendation"],
};

const splitGroupTimeWindowSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    start: { type: "string" },
    end: { type: "string" },
  },
  required: ["start", "end"],
};

const splitGroupSubgroupSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    memberIds: {
      type: "array",
      items: { type: "string" },
    },
    activities: {
      type: "array",
      items: { type: "string" },
    },
    timeWindow: splitGroupTimeWindowSchema,
  },
  required: ["memberIds", "activities", "timeWindow"],
};

const splitGroupPlanResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    needsSplit: { type: "boolean" },
    splitDays: { type: "number" },
    groupActivities: {
      type: "array",
      items: { type: "string" },
    },
    splitGroups: {
      type: "array",
      items: splitGroupSubgroupSchema,
    },
    reasoning: { type: "string" },
    personalityInfluenced: { type: "boolean" },
  },
  required: [
    "needsSplit",
    "splitDays",
    "groupActivities",
    "splitGroups",
    "reasoning",
    "personalityInfluenced",
  ],
};

const dailyCapacityPerDayOverrideItemSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    dayNumber: { type: "number" },
    maxActivities: { type: "number" },
  },
  required: ["dayNumber", "maxActivities"],
};

const dailyCapacityResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    maxActivitiesPerDay: { type: "number" },
    reasoning: { type: "string" },
    dayVariance: { type: "boolean" },
    perDayOverride: {
      type: "array",
      items: dailyCapacityPerDayOverrideItemSchema,
      minItems: 0,
      maxItems: 31,
    },
  },
  required: ["maxActivitiesPerDay", "reasoning", "dayVariance", "perDayOverride"],
};

const holisticDayAssignmentDayItemSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    dayIndex: { type: "number" },
    activities: {
      type: "array",
      items: { type: "string" },
    },
    lunch: { type: ["string", "null"] },
    dinner: { type: ["string", "null"] },
  },
  required: ["dayIndex", "activities", "lunch", "dinner"],
};

const holisticDayAssignmentResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    days: {
      type: "array",
      items: holisticDayAssignmentDayItemSchema,
      minItems: 1,
      maxItems: 31,
    },
  },
  required: ["days"],
};

const itinerarySchedulerDayItemSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    dayNumber: { type: "number" },
    theme: { type: "string" },
    dayReasoning: { type: "string" },
  },
  required: ["dayNumber", "theme", "dayReasoning"],
};

const itinerarySchedulerDayOutputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    days: {
      type: "array",
      items: itinerarySchedulerDayItemSchema,
      minItems: 1,
      maxItems: 31,
    },
  },
  required: ["days"],
};

const ITINERARY_SCHEDULER_DAY_INSIGHTS_INSTRUCTIONS =
  "You are the AI co-planner for a **group** trip. The app has already built a concrete day-by-day schedule; your job is only to write **theme** and **dayReasoning** for each calendar day.\n" +
  "User JSON fields:\n" +
  "- tripDays, tripName, destination\n" +
  "- groupContext: members, per-member preferences (budget, energy, activeHours, activityTypes, dealBreakers), aggregateProfile (groupBudgetLevel, groupEnergyLevel, commonActiveHours, excludedTags, commonActivityTypes), splitPlanSummary (if any), dailyCapacityReasoning (optional), candidatesBrief (sources, intensity, cost)\n" +
  "- scheduledDays[]: for each day — dayNumber, energyLevel, maxNonMealActivities, experienceMix (category tokens in time order, includes meal), honoredUpvoterNames (member first names who upvoted a scheduled non-meal stop that day), hasLunch, hasDinner, nonMealStopCount\n\n" +
  "Return JSON `days` with **exactly tripDays** objects, dayNumber 1..tripDays in order.\n" +
  "For each day:\n" +
  "- **theme**: one vivid sentence (tone/mood for the day). Not a list of venues.\n" +
  "- **dayReasoning**: exactly 2 short bullet lines, each starting with \"- \". Each bullet should be 8-14 words. Explain **WHY** this day's **structure** was chosen for **this** group — not **what** is on the schedule.\n" +
  "  dayReasoning rules (required every day; never contradict aggregateProfile or scheduledDays):\n" +
  "  - Across the two bullets, name at least **one specific member** by first name (from groupContext.members or honoredUpvoterNames).\n" +
  "  - Across the two bullets, cite at least **one concrete constraint**: a group conflict (energy/budget spread, active-hours mismatch), a member dealBreaker from preferences, a personality signal (plain language — never MBTI codes), or a budget cap tied to aggregateProfile / candidatesBrief.\n" +
  "  - Tie timing and pacing to facts: activeHours cutoffs, commonActiveHours overlap, splitPlanSummary, maxNonMealActivities, or diversity vs prior days via experienceMix.\n" +
  "  - Keep wording scannable: no long clauses, no multi-sentence bullets, no more than 2 bullets.\n" +
  "  - Do **not** narrate the itinerary (no 'first you…', 'after lunch…', lists of venues). Do not lead with place names.\n" +
  "  - **Banned phrases** (never use): \"a day of\", \"this day was crafted to\", \"ensuring everyone\", \"balances exploration with\", \"something for everyone\", \"good balance\" without a named person and measurable constraint.\n" +
  "  - **Wrong**: \"This day balances exploration with the group's moderate energy level.\"\n" +
  "  - **Right**: \"- Tom's 19:00 cutoff keeps dinner before 18:30.\\n- Low-energy members get five non-meal stops, not seven.\"\n\n" +
  "Output: JSON matching the schema only.";

const DAILY_CAPACITY_INSTRUCTIONS =
  "You are planning a group trip itinerary. Given energy bounds, variance among members, trip length, " +
  "candidate activity intensity (energyCost: low/medium/high), usable active hours from coreStart to commonActiveEnd, and whether split-group subplans exist (when true, shared group time is shorter), " +
  "recommend how many **non-meal** activities to schedule per calendar day.\n" +
  "Rules:\n" +
  "1. maxActivitiesPerDay is the default cap when dayVariance is false.\n" +
  "2. If dayVariance is true, perDayOverride must have exactly tripDays objects with dayNumber 1..tripDays and maxActivities for that day.\n" +
  "3. If dayVariance is false, perDayOverride must be an empty array.\n" +
  "4. Typical caps range 1–6; seldom above 6 unless activeWindowHours is large and energyCeiling is high.\n" +
  "5. reasoning: 1–3 sentences.\n" +
  "Output: JSON matching the schema only.";

const HOLISTIC_DAY_ASSIGNMENT_INSTRUCTIONS =
  "You are a trip itinerary planner. Given a list of activity candidates and restaurant candidates, assign them to days of a trip.\n" +
  "Output valid JSON only — no markdown, no explanation, no code fences.\n\n" +
  "Rules you must follow:\n" +
  "- Every placeId in your response must come exactly from nonFoodCandidates or foodCandidates. Never invent or modify a placeId.\n" +
  "- Each placeId may appear at most once across your entire response.\n" +
  "- activities[] must contain only placeIds from nonFoodCandidates.\n" +
  "- lunch and dinner must be placeIds from foodCandidates, or null if no suitable option exists.\n" +
  "- activities.length for each day must not exceed maxPerDayByDayIndex[dayIndex - 1].\n" +
  "- Group geographically close activities (use location lat/lng) on the same day to minimize travel time between them.\n" +
  "- Balance intensity across days based on group energy level and member MBTI signals — pay attention to planningStyle and energyFromPeople.\n" +
  "- Avoid empty days unless the candidate pool is genuinely exhausted.\n" +
  "- If validationErrors is present, those placeIds were invalid in a previous attempt — do not use them again.\n\n" +
  "Return this JSON shape:\n" +
  "{\n" +
  "  \"days\": [\n" +
  "    {\n" +
  "      \"dayIndex\": 1,\n" +
  "      \"activities\": [\"placeId1\", \"placeId2\"],\n" +
  "      \"lunch\": \"foodPlaceId or null\",\n" +
  "      \"dinner\": \"foodPlaceId or null\"\n" +
  "    }\n" +
  "  ]\n" +
  "}";

const mealFoodGapItemSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    searchQuery: { type: "string" },
    mealType: { type: "string", enum: ["lunch", "dinner", "both"] },
    cuisineType: { type: "string" },
    priceLevel: { type: "string" },
    whyForThisGroup: { type: "string" },
  },
  required: ["name", "searchQuery", "mealType", "cuisineType", "priceLevel", "whyForThisGroup"],
};

const mealFoodGapFillResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    recommendations: {
      type: "array",
      items: mealFoodGapItemSchema,
      minItems: 0,
      maxItems: 60,
    },
  },
  required: ["recommendations"],
};

const MEAL_FOOD_GAP_FILL_INSTRUCTIONS =
  "You fill empty **meal** slots for a group trip. Return real restaurants or food experiences at the destination.\n" +
  "Rules:\n" +
  "1. The user JSON includes remainingSlots — return that many recommendations when possible (fewer only if impossible without breaking rules).\n" +
  "2. searchQuery: 3-7 words for Google Places searchText (include neighbourhood or landmark when helpful).\n" +
  "3. mealType: lunch, dinner, or both if flexible.\n" +
  "4. Respect budgetFloor and excludedTags; never suggest venues or cuisines matching excludedTags.\n" +
  "5. Avoid duplicate or near-duplicate names in alreadySelectedFoodNames.\n" +
  "6. cuisineType: short label (e.g. Italian, ramen). priceLevel: one of free, low, medium, high.\n" +
  "7. whyForThisGroup: one friendly sentence for the itinerary.\n" +
  "Output: JSON matching the schema only.";

const SPLIT_GROUP_PLAN_INSTRUCTIONS =
  "You are a group travel coordinator. The app detected preference conflicts (energy, budget, active hours, and/or contested venues). " +
  "Given group vs split activity candidates, member ids, trip length, and aggregate profile bounds, decide if a **partial split-group itinerary** is needed (some days or windows where subgroups do different activities while others stay together).\n" +
  "The user JSON includes a **conflicts** array — read and apply it first before any supplementary personality block.\n" +
  "Rules:\n" +
  "1. If conflicts are mild or candidates already separate clearly, set needsSplit to false (use splitDays 0, empty groupActivities and splitGroups, brief reasoning).\n" +
  "2. If needsSplit is true, splitDays is how many trip days should include split-group time (0 to tripDays). Use placeIds only from the provided candidate lists.\n" +
  "3. groupActivities: placeIds everyone should do together when not in subgroup slots.\n" +
  "4. splitGroups: one or more subgroups with memberIds from the trip, activities as placeIds from splitCandidates (or groupCandidates if justified), and a same-day HH:mm timeWindow for that split block.\n" +
  "5. Keep reasoning concise (2–4 sentences).\n" +
  "6. personalityInfluenced: set true if member personality signals (when provided) changed your needsSplit, splitDays, splitGroups, or reasoning versus what conflicts and groupProfile alone would imply; otherwise false. When no personality block is appended, personalityInfluenced must be false.\n" +
  "Output: JSON matching the schema only. No prose outside JSON.";

const explorePlaceItemSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    blurb: { type: "string" },
    searchQuery: { type: "string" },
  },
  required: ["name", "blurb", "searchQuery"],
};

const exploreRecommendationsResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    intro: { type: "string" },
    places: {
      type: "array",
      items: explorePlaceItemSchema,
      minItems: 3,
      maxItems: 6,
    },
  },
  required: ["intro", "places"],
};

const EXPLORE_RECOMMENDATIONS_INSTRUCTIONS =
  "You are a friendly local travel guide helping someone planning a trip discover must-go places.\n" +
  "User JSON fields:\n" +
  "- destination: the city/region the traveler is visiting (string)\n" +
  "- category: one of 'restaurants', 'attractions', 'nearby_towns'\n" +
  "- alreadyAdded: array of place names the user has already added (avoid duplicating these)\n\n" +
  "Category meanings:\n" +
  "- restaurants: famous, beloved, or iconic eateries IN the destination — local specialties, signature dishes, or culture-defining food experiences. Include a mix of price points; prefer places known to locals, not just tourist traps.\n" +
  "- attractions: famous landmarks, museums, parks, cultural sights, or experiences IN the destination that travelers regret missing.\n" +
  "- nearby_towns: famous towns / villages / day-trip-worthy areas OUTSIDE the destination city itself but reachable in a reasonable side-trip (typically <2-3 hours one way). NOT neighborhoods inside the city. Pick places known as must-visits when you're already in the region (e.g. Kamakura when in Tokyo, Versailles when in Paris).\n\n" +
  "Output rules:\n" +
  "1. intro: 2-3 sentences in a warm, conversational tone introducing what to expect from this category in this destination. No bullet points, no place names listed.\n" +
  "2. places: 4-5 specific, real, named places (or named towns for nearby_towns). Never generic types ('a sushi place'). Use widely-recognized correct names.\n" +
  "3. Each place's blurb is exactly 1 sentence (12-25 words) explaining why it's recommended — what makes it special / what to try / why locals love it.\n" +
  "4. searchQuery: 3-7 words suitable for a Google Places searchText call to locate the exact venue (include the destination or town name when it improves disambiguation).\n" +
  "5. Skip any place whose name appears in alreadyAdded.\n" +
  "6. Aim for variety (different neighborhoods, different vibes / cuisines / historical periods).\n\n" +
  "Output: JSON matching the schema only. No prose outside JSON.";

async function runOpenAiExploreRecommendations(body) {
  const err = requireFields(body, "destination", "category");
  if (err) return err;

  const destination = String(body.destination ?? "").trim();
  const category = String(body.category ?? "").trim();
  const allowedCategories = new Set(["restaurants", "attractions", "nearby_towns"]);
  if (!destination) {
    return { status: 400, json: { error: "Missing destination" } };
  }
  if (!allowedCategories.has(category)) {
    return {
      status: 400,
      json: { error: "Invalid category", allowed: [...allowedCategories] },
    };
  }

  const alreadyAdded = Array.isArray(body?.alreadyAdded)
    ? body.alreadyAdded.filter((x) => typeof x === "string").slice(0, 50)
    : [];

  const userPayload = JSON.stringify({
    destination,
    category,
    alreadyAdded,
  });

  return openAiJsonSchemaResponse({
    instructions: EXPLORE_RECOMMENDATIONS_INSTRUCTIONS,
    userJson: userPayload,
    schemaName: "explore_recommendations_response",
    schema: exploreRecommendationsResponseSchema,
    temperature: 0.7,
  });
}

const VOTE_GAP_FILL_INSTRUCTIONS =
  "You are a travel recommendation specialist. You receive a gap report and group profile for a trip, and return a list of specific activity recommendations designed to fill exactly those gaps.\n\n" +
  "Rules:\n" +
  "1. Only recommend activities that fill a stated gap (missing category, time slot, or budget tier). Do not pad the list with activities from over-represented categories.\n" +
  "2. Every recommendation must be a real, named place or experience that exists in the destination — not a generic type like \"a museum\". Be specific: \"The Ringling Museum of Art\" not \"an art museum\".\n" +
  "3. Each recommendation must include a searchQuery field (3-6 words) suitable for a Google Places searchText call to find the exact place.\n" +
  "4. Deal-breakers: Never recommend anything that matches a tag in excludedTags. " +
  "Interpret tags semantically — examples: 'alcohol' excludes bars, pubs, breweries, wine tastings, cocktail experiences; " +
  "'intense_physical' excludes hiking, climbing, surfing, extreme sports; 'crowded' excludes major tourist landmarks with long queues; " +
  "'adult_only' excludes venues restricted to adults. When in doubt, skip the activity. " +
  "A recommendation that violates a deal-breaker is worse than having fewer recommendations.\n" +
  "5. Budget: all recommendations must be affordable at budgetFloor. Where a higher-cost version exists, note it in upgradeNote but recommend the base experience.\n" +
  "6. Do not duplicate any place in existingCandidates (check by name similarity).\n" +
  "7. Aim for geographic spread — don't cluster all recommendations in one neighbourhood.\n" +
  "8. Return exactly recommendationCount recommendations in the JSON array, no more, no fewer. " +
  "recommendationCount may be greater than slotsNeeded when the group also has a diversity gap (e.g. missing history). " +
  "If slotsNeeded is 0 but hasDiversityGap is true, recommendationCount is typically 4. " +
  "Always return exactly recommendationCount items.\n" +
  "9. Each recommendation.reason must be 1-2 sentences explaining why this pick fits the group (shown on the voting card).\n" +
  "10. Group preferences: the profile includes commonActivityTypes — a list of activity categories the group has explicitly expressed interest in (e.g. " +
  "['history', 'nature', 'art']). Prioritize recommendations that align with at least one of these types. " +
  "Only recommend activities outside these types if the statedGaps explicitly require a category the group has not expressed a preference for. " +
  "Never recommend food/restaurant/cafe/bar/dining activities unless the statedGaps explicitly mention a food-related gap — the meal pipeline handles food separately.\n\n" +
  "Output: valid JSON matching the schema only. No prose outside JSON.";

const VOTE_GAP_REPLACEMENT_INSTRUCTIONS =
  "You are a travel recommendation specialist. The client's previous suggestion could not be verified in Google Places (wrong name, closed, or not found).\n" +
  "Return ONE replacement recommendation as JSON: a real named venue or experience in the destination with searchQuery (3-6 words) for Google Places searchText.\n" +
  "Deal-breakers: never recommend anything matching excludedTags — interpret tags semantically (e.g. 'alcohol' means no bars/pubs/breweries; 'intense_physical' means no hiking/climbing/extreme sports; 'crowded' means no packed landmark queues; 'adult_only' means no adults-only venues). When in doubt, skip. " +
  "Respect budgetFloor. Do not duplicate existingCandidateNames. reason: 1-2 sentences for the voting card.\n" +
  "Output: JSON matching the schema only.";

function requireFields(body, ...fields) {
  for (const f of fields) {
    if (body?.[f] === undefined || body?.[f] === null) {
      return { status: 400, json: { error: `Missing ${f}` } };
    }
  }
  return null;
}

async function openAiJsonSchemaResponse({ instructions, userJson, schemaName, schema, model, temperature }) {
  const openAiKey = getOpenAiKey();
  if (!openAiKey) {
    return { status: 503, json: { error: "OPENAI_API_KEY not configured" } };
  }
  const resolvedModel = model || process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const openAiPayload = {
    model: resolvedModel,
    input: [
      { role: "system", content: [{ type: "input_text", text: instructions }] },
      { role: "user", content: [{ type: "input_text", text: userJson }] },
    ],
    text: {
      format: {
        type: "json_schema",
        name: schemaName,
        schema,
        strict: true,
      },
    },
  };
  if (typeof temperature === "number" && Number.isFinite(temperature)) {
    openAiPayload.temperature = temperature;
  }

  let upstream;
  try {
    upstream = await fetchWithTimeout(
      OPENAI_BASE,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify(openAiPayload),
      },
      OPENAI_TIMEOUT_MS
    );
  } catch (e) {
    if (isUpstreamTimeout(e)) {
      return { status: 504, json: { error: "Upstream timeout" } };
    }
    throw e;
  }

  if (!upstream.ok) {
    const errorText = await upstream.text().catch(() => "");
    return {
      status: upstream.status || 502,
      json: { error: "OpenAI request failed", body: truncate(errorText) },
    };
  }

  const json = await upstream.json();
  let textOutput = typeof json?.output_text === "string" ? json.output_text : "";
  if (!textOutput) {
    const outputs = Array.isArray(json?.output) ? json.output : [];
    const chunks = [];
    for (const item of outputs) {
      const content = Array.isArray(item?.content) ? item.content : [];
      for (const c of content) {
        if (typeof c?.text === "string" && c.text.trim()) chunks.push(c.text);
      }
    }
    textOutput = chunks.join("\n").trim();
  }
  if (!textOutput) {
    return { status: 502, json: { error: "OpenAI response missing text output" } };
  }

  try {
    const parsed = JSON.parse(textOutput);
    return { status: 200, json: parsed };
  } catch {
    return { status: 502, json: { error: "Failed to parse OpenAI JSON", body: truncate(textOutput) } };
  }
}

async function runOpenAiVoteGapFill(body) {
  const err = requireFields(body, "gapReport", "profile", "existingCandidates");
  if (err) return err;

  const gapReport = body.gapReport;
  const profile = body.profile;
  const existingCandidates = body.existingCandidates;
  let recommendationCount = Number(body?.recommendationCount);

  if (typeof gapReport !== "object") {
    return { status: 400, json: { error: "Missing gapReport" } };
  }
  if (typeof profile !== "object") {
    return { status: 400, json: { error: "Missing profile" } };
  }
  if (!Array.isArray(existingCandidates)) {
    return { status: 400, json: { error: "Missing existingCandidates array" } };
  }
  if (!Number.isFinite(recommendationCount) || recommendationCount < 1) recommendationCount = 1;
  if (recommendationCount > 10) recommendationCount = 10;

  const userPayload = JSON.stringify({
    gapReport,
    profile,
    existingCandidates,
    recommendationCount,
    slotsNeeded: gapReport.slotsNeeded,
    hasDiversityGap: gapReport.hasDiversityGap,
    budgetFloor: gapReport.budgetFloor,
    destination: gapReport.destination || profile.destination,
  });

  const result = await openAiJsonSchemaResponse({
    instructions: VOTE_GAP_FILL_INSTRUCTIONS,
    userJson: userPayload,
    schemaName: "vote_gap_fill_response",
    schema: voteGapFillResponseSchema,
  });
  if (result.status !== 200) return result;
  const recs = Array.isArray(result.json?.recommendations) ? result.json.recommendations : [];
  result.json.recommendations = recs.slice(0, recommendationCount);
  return result;
}

async function runOpenAiVoteGapReplacement(body) {
  const err = requireFields(body, "destination", "failedSuggestion");
  if (err) return err;

  const destination = String(body.destination ?? "").trim();
  const failedSuggestion = body.failedSuggestion;
  if (!destination) {
    return { status: 400, json: { error: "Missing destination" } };
  }
  if (typeof failedSuggestion !== "object") {
    return { status: 400, json: { error: "Missing failedSuggestion" } };
  }

  const userPayload = JSON.stringify({
    destination,
    failedSuggestion,
    excludedTags: Array.isArray(body?.excludedTags) ? body.excludedTags : [],
    statedGaps: Array.isArray(body?.statedGaps) ? body.statedGaps : [],
    budgetFloor: body?.budgetFloor ?? "",
    commonActivityTypes: Array.isArray(body?.commonActivityTypes) ? body.commonActivityTypes : [],
    groupEnergyLevel: body?.groupEnergyLevel ?? "",
    existingCandidateNames: Array.isArray(body?.existingCandidateNames) ? body.existingCandidateNames : [],
  });

  return openAiJsonSchemaResponse({
    instructions: VOTE_GAP_REPLACEMENT_INSTRUCTIONS,
    userJson: userPayload,
    schemaName: "vote_gap_replacement_response",
    schema: voteGapReplacementResponseSchema,
  });
}

async function runOpenAiSplitGroupPlan(body) {
  const err = requireFields(
    body,
    "tripId",
    "tripDays",
    "conflicts",
    "groupProfile",
    "groupCandidates",
    "splitCandidates",
    "memberIds"
  );
  if (err) return err;

  const tripId = String(body.tripId ?? "").trim();
  let tripDays = Number(body.tripDays);
  if (!tripId) {
    return { status: 400, json: { error: "Missing tripId" } };
  }
  if (!Number.isFinite(tripDays) || tripDays < 1) tripDays = 1;
  if (tripDays > 30) tripDays = 30;

  const conflicts = body.conflicts;
  if (!Array.isArray(conflicts) || conflicts.length === 0) {
    return { status: 400, json: { error: "Missing or empty conflicts" } };
  }
  for (const c of conflicts) {
    if (!c || typeof c !== "object" || typeof c.type !== "string" || typeof c.description !== "string") {
      return { status: 400, json: { error: "Invalid conflict entry" } };
    }
  }

  if (typeof body.groupProfile !== "object") {
    return { status: 400, json: { error: "Missing groupProfile" } };
  }
  if (!Array.isArray(body.groupCandidates)) {
    return { status: 400, json: { error: "Missing groupCandidates" } };
  }
  if (!Array.isArray(body.splitCandidates)) {
    return { status: 400, json: { error: "Missing splitCandidates" } };
  }
  if (!Array.isArray(body.memberIds)) {
    return { status: 400, json: { error: "Missing memberIds" } };
  }

  const userPayload = JSON.stringify({
    tripId,
    tripDays,
    conflicts,
    groupCandidates: body.groupCandidates,
    splitCandidates: body.splitCandidates,
    groupProfile: body.groupProfile,
    memberIds: body.memberIds,
    memberPersonalities: body.memberPersonalities ?? [],
    groupPlanningStyleVariance: body.groupPlanningStyleVariance ?? null,
    groupSplitComfort: body.groupSplitComfort ?? null,
  });

  const personalityAppendix =
    typeof body?.personalityPromptAppendix === "string"
      ? body.personalityPromptAppendix.trim()
      : "";
  let instructions = SPLIT_GROUP_PLAN_INSTRUCTIONS;
  if (personalityAppendix) {
    instructions = instructions.replace(
      "Output: JSON matching the schema only. No prose outside JSON.",
      `${personalityAppendix}\n\nOutput: JSON matching the schema only. No prose outside JSON.`
    );
  }

  return openAiJsonSchemaResponse({
    instructions,
    userJson: userPayload,
    schemaName: "split_group_plan_response",
    schema: splitGroupPlanResponseSchema,
    model: process.env.OPENAI_SPLIT_GROUP_MODEL || "gpt-4o",
  });
}

async function runOpenAiDailyCapacity(body) {
  const err = requireFields(body, "candidates");
  if (err) return err;

  let tripDays = Number(body?.tripDays);
  if (!Number.isFinite(tripDays) || tripDays < 1) tripDays = 1;
  if (tripDays > 31) tripDays = 31;

  if (!Array.isArray(body.candidates)) {
    return { status: 400, json: { error: "Missing candidates array" } };
  }

  const userPayload = JSON.stringify({
    tripDays,
    energyFloor: body?.energyFloor ?? "",
    energyCeiling: body?.energyCeiling ?? "",
    energyVariance: body?.energyVariance ?? 0,
    activeWindowHours: body?.activeWindowHours ?? 0,
    coreStart: body?.coreStart ?? "",
    commonActiveEnd: body?.commonActiveEnd ?? "",
    splitPlanExists: body?.splitPlanExists === true,
    candidates: (body?.candidates ?? []).slice(0, 120),
  });

  return openAiJsonSchemaResponse({
    instructions: DAILY_CAPACITY_INSTRUCTIONS,
    userJson: userPayload,
    schemaName: "daily_capacity_response",
    schema: dailyCapacityResponseSchema,
    model: process.env.OPENAI_DAILY_CAPACITY_MODEL || "gpt-4o",
    temperature: 0.2,
  });
}

async function runOpenAiHolisticDayAssignment(body) {
  const err = requireFields(
    body,
    "tripId",
    "tripDays",
    "destination",
    "groupProfile",
    "maxPerDayByDayIndex",
    "nonFoodCandidates",
    "foodCandidates"
  );
  if (err) return err;

  const tripId = String(body.tripId ?? "").trim();
  if (!tripId) {
    return { status: 400, json: { error: "Missing tripId" } };
  }

  let tripDays = Number(body.tripDays);
  if (!Number.isFinite(tripDays) || tripDays < 1) tripDays = 1;
  if (tripDays > 31) tripDays = 31;

  const destination = String(body.destination ?? "").trim();
  if (!destination) {
    return { status: 400, json: { error: "Missing destination" } };
  }

  if (typeof body.groupProfile !== "object") {
    return { status: 400, json: { error: "Missing groupProfile" } };
  }
  if (!Array.isArray(body.maxPerDayByDayIndex)) {
    return { status: 400, json: { error: "Missing maxPerDayByDayIndex array" } };
  }
  if (!Array.isArray(body.nonFoodCandidates)) {
    return { status: 400, json: { error: "Missing nonFoodCandidates array" } };
  }
  if (!Array.isArray(body.foodCandidates)) {
    return { status: 400, json: { error: "Missing foodCandidates array" } };
  }

  const userPayload = JSON.stringify({
    tripId,
    tripDays,
    destination,
    groupProfile: body.groupProfile,
    memberPersonalities: Array.isArray(body.memberPersonalities) ? body.memberPersonalities : [],
    maxPerDayByDayIndex: body.maxPerDayByDayIndex.slice(0, tripDays),
    nonFoodCandidates: body.nonFoodCandidates,
    foodCandidates: body.foodCandidates,
    validationErrors: Array.isArray(body.validationErrors) ? body.validationErrors : undefined,
  });

  return openAiJsonSchemaResponse({
    instructions: HOLISTIC_DAY_ASSIGNMENT_INSTRUCTIONS,
    userJson: userPayload,
    schemaName: "holistic_day_assignment_response",
    schema: holisticDayAssignmentResponseSchema,
    model: process.env.OPENAI_HOLISTIC_DAY_ASSIGNMENT_MODEL || "gpt-4o",
    temperature: 0.2,
  });
}

/** Extract complete day objects from partially-accumulated streaming JSON. */
function tryExtractCompletedDays(text, emittedDays) {
  const results = [];
  let searchFrom = 0;
  while (true) {
    const startIdx = text.indexOf('{"dayNumber":', searchFrom);
    if (startIdx === -1) break;
    let depth = 0;
    let endIdx = -1;
    for (let i = startIdx; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") {
        depth--;
        if (depth === 0) { endIdx = i; break; }
      }
    }
    if (endIdx === -1) break;
    const objStr = text.slice(startIdx, endIdx + 1);
    try {
      const obj = JSON.parse(objStr);
      const dn = typeof obj.dayNumber === "number" ? Math.floor(obj.dayNumber) : NaN;
      if (
        Number.isFinite(dn) && dn >= 1 &&
        typeof obj.theme === "string" &&
        typeof obj.dayReasoning === "string" &&
        !emittedDays.has(dn)
      ) {
        const day = { dayNumber: dn, theme: obj.theme.trim(), dayReasoning: obj.dayReasoning.trim() };
        emittedDays.set(dn, day);
        results.push(day);
      }
    } catch (_) {}
    searchFrom = endIdx + 1;
  }
  return results;
}

async function runOpenAiItineraryDayReasoningStream(req, res) {
  let tripDays = Number(req.body?.tripDays);
  if (!Number.isFinite(tripDays) || tripDays < 1) tripDays = 1;
  if (tripDays > 31) tripDays = 31;

  const tripName = String(req.body?.tripName ?? "").trim() || "Trip";
  const destination = String(req.body?.destination ?? "").trim() || "destination";
  const groupContext = req.body?.groupContext;
  const scheduledDays = Array.isArray(req.body?.scheduledDays) ? req.body.scheduledDays : [];

  if (!groupContext || typeof groupContext !== "object") {
    res.status(400).json({ error: "Missing groupContext" });
    return;
  }
  if (scheduledDays.length !== tripDays) {
    res.status(400).json({ error: "scheduledDays length must equal tripDays" });
    return;
  }

  const openAiKey = getOpenAiKey();
  if (!openAiKey) {
    res.status(503).json({ error: "OPENAI_API_KEY not configured" });
    return;
  }

  const personalityAppendix =
    typeof req.body?.personalityPromptAppendix === "string"
      ? req.body.personalityPromptAppendix.trim()
      : "";
  let instructions = ITINERARY_SCHEDULER_DAY_INSIGHTS_INSTRUCTIONS;
  if (personalityAppendix) {
    instructions = instructions.replace(
      "\n\nOutput: JSON matching the schema only.",
      `\n\n${personalityAppendix}\n\nOutput: JSON matching the schema only.`
    );
  }

  const openAiPayload = {
    model: process.env.OPENAI_ITINERARY_SCHEDULER_MODEL || "gpt-4o",
    input: [
      { role: "system", content: [{ type: "input_text", text: instructions }] },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              tripDays,
              tripName,
              destination,
              groupContext,
              scheduledDays: scheduledDays.slice(0, 31),
            }),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "itinerary_scheduler_day_output",
        schema: itinerarySchedulerDayOutputSchema,
        strict: true,
      },
    },
    temperature: 0.4,
    stream: true,
  };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let upstream;
  try {
    upstream = await fetchWithTimeout(
      OPENAI_BASE,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey}` },
        body: JSON.stringify(openAiPayload),
      },
      90_000
    );
  } catch (e) {
    res.write(
      `data: ${JSON.stringify({ type: "error", message: isUpstreamTimeout(e) ? "Upstream timeout" : "Request failed" })}\n\n`
    );
    res.end();
    return;
  }

  if (!upstream.ok) {
    const errorText = await upstream.text().catch(() => "");
    res.write(
      `data: ${JSON.stringify({ type: "error", message: `OpenAI ${upstream.status}`, body: truncate(errorText) })}\n\n`
    );
    res.end();
    return;
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let accumulatedText = "";
  let lastEventType = "";
  let lineBuffer = "";
  const emittedDays = new Map();

  let aborted = false;
  req.on("close", () => {
    aborted = true;
    reader.cancel().catch(() => {});
  });

  try {
    while (!aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith("event:")) {
          lastEventType = trimmed.slice(6).trim();
        } else if (trimmed.startsWith("data:")) {
          const rawData = trimmed.slice(5).trim();
          if (!rawData || rawData === "[DONE]") continue;
          try {
            const evt = JSON.parse(rawData);
            if (lastEventType === "response.output_text.delta" && typeof evt.delta === "string") {
              accumulatedText += evt.delta;
              const newDays = tryExtractCompletedDays(accumulatedText, emittedDays);
              for (const day of newDays) {
                res.write(
                  `data: ${JSON.stringify({ type: "day", dayNumber: day.dayNumber, theme: day.theme, dayReasoning: day.dayReasoning })}\n\n`
                );
              }
            } else if (lastEventType === "response.output_text.done" && typeof evt.text === "string") {
              accumulatedText = evt.text;
            }
          } catch (_) {}
        }
      }
    }
  } catch (_) {}

  if (!aborted) {
    // Catch any days not emitted during streaming (e.g. last chunk had no newline)
    const remaining = tryExtractCompletedDays(accumulatedText, emittedDays);
    for (const day of remaining) {
      res.write(
        `data: ${JSON.stringify({ type: "day", dayNumber: day.dayNumber, theme: day.theme, dayReasoning: day.dayReasoning })}\n\n`
      );
    }

    // Build normalized output from emitted days + full parse fallback
    const reasonFallback =
      "- Shared timing follows the group's overlapping active-hours window.\n" +
      "- Non-meal pacing stays within the daily capacity cap.";
    const byDay = new Map(emittedDays);
    try {
      const fullParsed = JSON.parse(accumulatedText);
      const raw = Array.isArray(fullParsed?.days) ? fullParsed.days : [];
      for (const row of raw) {
        const dn = typeof row.dayNumber === "number" ? Math.floor(row.dayNumber) : NaN;
        if (!Number.isFinite(dn) || dn < 1 || dn > tripDays) continue;
        if (!byDay.has(dn)) {
          byDay.set(dn, { dayNumber: dn, theme: String(row.theme ?? "").trim(), dayReasoning: String(row.dayReasoning ?? "").trim() });
        }
      }
    } catch (_) {}

    const normalized = [];
    for (let n = 1; n <= tripDays; n++) {
      const cur = byDay.get(n);
      normalized.push({
        dayNumber: n,
        theme: cur?.theme || `${tripName} — day ${n}`,
        dayReasoning: cur?.dayReasoning || reasonFallback,
      });
    }
    res.write(`data: ${JSON.stringify({ type: "done", days: normalized })}\n\n`);
  }
  res.end();
}

async function runOpenAiItineraryDayReasoning(body) {
  let tripDays = Number(body?.tripDays);
  if (!Number.isFinite(tripDays) || tripDays < 1) tripDays = 1;
  if (tripDays > 31) tripDays = 31;

  const tripName = String(body?.tripName ?? "").trim() || "Trip";
  const destination = String(body?.destination ?? "").trim() || "destination";
  const err = requireFields(body, "groupContext");
  if (err) return err;

  const groupContext = body.groupContext;
  const scheduledDays = Array.isArray(body?.scheduledDays) ? body.scheduledDays : [];

  if (typeof groupContext !== "object") {
    return { status: 400, json: { error: "Missing groupContext object" } };
  }
  if (scheduledDays.length !== tripDays) {
    return { status: 400, json: { error: "scheduledDays length must equal tripDays" } };
  }

  const userPayload = JSON.stringify({
    tripDays,
    tripName,
    destination,
    groupContext,
    scheduledDays: scheduledDays.slice(0, 31),
  });

  const personalityAppendix =
    typeof body?.personalityPromptAppendix === "string"
      ? body.personalityPromptAppendix.trim()
      : "";
  let instructions = ITINERARY_SCHEDULER_DAY_INSIGHTS_INSTRUCTIONS;
  if (personalityAppendix) {
    instructions = instructions.replace(
      "\n\nOutput: JSON matching the schema only.",
      `\n\n${personalityAppendix}\n\nOutput: JSON matching the schema only.`
    );
  }

  const result = await openAiJsonSchemaResponse({
    instructions,
    userJson: userPayload,
    schemaName: "itinerary_scheduler_day_output",
    schema: itinerarySchedulerDayOutputSchema,
    model: process.env.OPENAI_ITINERARY_SCHEDULER_MODEL || "gpt-4o",
    temperature: 0.4,
  });

  if (result.status !== 200) return result;

  const raw = Array.isArray(result.json?.days) ? result.json.days : [];
  const byDay = new Map();
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const dn = typeof row.dayNumber === "number" ? Math.floor(row.dayNumber) : NaN;
    if (!Number.isFinite(dn) || dn < 1 || dn > tripDays) continue;
    byDay.set(dn, {
      dayNumber: dn,
      theme: String(row.theme ?? "").trim(),
      dayReasoning: String(row.dayReasoning ?? "").trim(),
    });
  }

  const reasonFallback =
    "- Shared timing follows the group's overlapping active-hours window.\n" +
    "- Non-meal pacing stays within the daily capacity cap.";
  const normalized = [];
  for (let n = 1; n <= tripDays; n++) {
    const cur = byDay.get(n);
    const theme = cur?.theme || `${tripName} — day ${n}`;
    const dayReasoning = cur?.dayReasoning || reasonFallback;
    normalized.push({ dayNumber: n, theme, dayReasoning });
  }
  result.json = { days: normalized };
  return result;
}

async function runOpenAiMealFoodGapFill(body) {
  const err = requireFields(body, "destination", "remainingSlots");
  if (err) return err;

  const destination = String(body.destination ?? "").trim();
  let remainingSlots = Number(body.remainingSlots);
  if (!destination) {
    return { status: 400, json: { error: "Missing destination" } };
  }
  if (!Number.isFinite(remainingSlots) || remainingSlots < 1) {
    return { status: 400, json: { error: "Invalid remainingSlots" } };
  }
  if (remainingSlots > 40) remainingSlots = 40;

  const userPayload = JSON.stringify({
    destination,
    remainingSlots,
    budgetFloor: body?.budgetFloor ?? "",
    excludedTags: Array.isArray(body?.excludedTags) ? body.excludedTags : [],
    alreadySelectedFoodNames: Array.isArray(body?.alreadySelectedFoodNames)
      ? body.alreadySelectedFoodNames
      : [],
  });

  const result = await openAiJsonSchemaResponse({
    instructions: MEAL_FOOD_GAP_FILL_INSTRUCTIONS,
    userJson: userPayload,
    schemaName: "meal_food_gap_fill_response",
    schema: mealFoodGapFillResponseSchema,
    model: process.env.OPENAI_MEAL_FOOD_MODEL || "gpt-4o",
    temperature: 0.3,
  });
  if (result.status === 200 && Array.isArray(result.json?.recommendations)) {
    result.json.recommendations = result.json.recommendations.slice(0, remainingSlots);
  }
  return result;
}

/**
 * Build a Places searchText query and optional includedType for insert_row activity proposals.
 */
function buildPlaceQueryForInsert({ destination, userText, proposalTitle, proposalReason, activityLabel }) {
  const combined = `${userText} ${proposalTitle} ${proposalReason} ${activityLabel ?? ""}`;
  const t = combined.toLowerCase();
  const dest = destination.trim() || "city center";

  if (/\b(lunch)\b/.test(t)) {
    return { textQuery: `${dest} lunch restaurant`, includedType: "restaurant", mealSlot: "lunch" };
  }
  if (/\b(dinner|supper)\b/.test(t)) {
    return { textQuery: `${dest} dinner restaurant`, includedType: "restaurant", mealSlot: "dinner" };
  }
  if (/\b(breakfast|brunch)\b/.test(t)) {
    return { textQuery: `${dest} breakfast cafe brunch`, includedType: "cafe", mealSlot: undefined };
  }
  if (/\b(coffee|cafe|coffee shop)\b/.test(t)) {
    return { textQuery: `${dest} specialty coffee cafe`, includedType: "cafe", mealSlot: undefined };
  }
  if (/\b(restaurant|eat|dining|food|meal|bite)\b/.test(t)) {
    return { textQuery: `${dest} highly rated restaurants`, includedType: "restaurant", mealSlot: undefined };
  }

  const hint = String(activityLabel ?? "")
    .trim()
    .replace(/^recommended\s+/i, "")
    .replace(/\bpending-[a-z0-9-]+\b/gi, "")
    .trim();
  if (hint.length > 2) {
    return { textQuery: `${dest} ${hint.slice(0, 100)}`, includedType: null, mealSlot: undefined };
  }
  return { textQuery: `${dest} popular things to do`, includedType: "tourist_attraction", mealSlot: undefined };
}

/**
 * Replace pending activity rows with real Google place ids + names from searchText (server key).
 */
async function enrichProposalsWithPlaces(parsed, body) {
  const apiKey = getPlacesKey();
  if (!apiKey || !Array.isArray(parsed?.proposals)) return;

  const destination = String(body?.trip?.destination ?? "").trim() || String(body?.trip?.name ?? "").trim();
  const userText = [body?.enhanceRequest, body?.dissatisfaction].filter(Boolean).join(" ");

  for (const p of parsed.proposals) {
    const patch = p.patch;
    if (!patch || patch.kind !== "insert_row" || !patch.row || patch.row.kind !== "activity") continue;
    const row = patch.row;
    const pid = row.placeId;
    if (pid && typeof pid === "string" && !pid.startsWith("pending-")) continue;

    const { textQuery, includedType, mealSlot } = buildPlaceQueryForInsert({
      destination,
      userText,
      proposalTitle: p.title,
      proposalReason: p.reason,
      activityLabel: row.activityLabel,
    });
    if (mealSlot && !row.mealSlot) row.mealSlot = mealSlot;

    let hit = await searchTextFirstPlace({ apiKey, textQuery, includedType, maxResultCount: 5 });
    if (!hit && includedType) {
      hit = await searchTextFirstPlace({ apiKey, textQuery, includedType: null, maxResultCount: 5 });
    }
    if (!hit) continue;

    row.placeId = hit.placeId;
    row.activityLabel = hit.displayName;
    row.isPlaceholder = false;
  }
}

async function runOpenAiEnhance(body) {
  const enhanceRequest = String(body?.enhanceRequest ?? "").trim();
  const dissatisfaction = String(body?.dissatisfaction ?? "").trim();
  if (!enhanceRequest && !dissatisfaction) {
    return { status: 400, json: { error: "Missing enhancement request input" } };
  }

  const openAiKey = getOpenAiKey();
  if (!openAiKey) {
    return { status: 503, json: { error: "OPENAI_API_KEY not configured" } };
  }

  const instructions =
    "You are a trip itinerary enhancement assistant. Return only practical, minimal edits. " +
    "Use day numbers and existing row ids from currentEditRowsByDay whenever possible. " +
    "Do not create large rewrites; propose small selectable changes. " +
    "If user asks for transport/public transit, focus on reordering nearby items and reducing long hops. " +
    "If user says a day is too packed, remove or replace one activity. " +
    "For new restaurants, cafés, or POIs, use insert_row with kind activity, placeId pending-<random>, isPlaceholder true, " +
    "and a short activityLabel hint (e.g. lunch near meeting point). Do not invent real business names or addresses; " +
    "the server resolves pending rows to real Google Places via search.";

  const openAiPayload = {
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    input: [
      { role: "system", content: [{ type: "input_text", text: instructions }] },
      { role: "user", content: [{ type: "input_text", text: JSON.stringify(body) }] },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "itinerary_enhance_response",
        schema: enhanceSchema,
        strict: true,
      },
    },
  };

  let upstream;
  try {
    upstream = await fetchWithTimeout(
      OPENAI_BASE,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify(openAiPayload),
      },
      OPENAI_TIMEOUT_MS
    );
  } catch (e) {
    if (isUpstreamTimeout(e)) {
      return { status: 504, json: { error: "Upstream timeout" } };
    }
    throw e;
  }

  if (!upstream.ok) {
    const errorText = await upstream.text().catch(() => "");
    return {
      status: upstream.status || 502,
      json: { error: "OpenAI request failed", body: truncate(errorText) },
    };
  }

  const json = await upstream.json();
  let textOutput = typeof json?.output_text === "string" ? json.output_text : "";
  if (!textOutput) {
    const outputs = Array.isArray(json?.output) ? json.output : [];
    const chunks = [];
    for (const item of outputs) {
      const content = Array.isArray(item?.content) ? item.content : [];
      for (const c of content) {
        if (typeof c?.text === "string" && c.text.trim()) chunks.push(c.text);
      }
    }
    textOutput = chunks.join("\n").trim();
  }
  if (!textOutput) {
    return { status: 502, json: { error: "OpenAI response missing text output" } };
  }

  try {
    const parsed = JSON.parse(textOutput);
    await enrichProposalsWithPlaces(parsed, body);
    return { status: 200, json: parsed };
  } catch {
    return { status: 502, json: { error: "Failed to parse OpenAI JSON", body: truncate(textOutput) } };
  }
}

async function proxyFsqGet(fsqPath, res, logLabel) {
  const key = getFsqKey();
  if (!key) {
    res.status(503).json({ error: "FSQ_API_KEY not configured" });
    return;
  }
  const url = `${FSQ_BASE}${fsqPath}`;
  if (isDev) console.log(`[api-proxy] ${logLabel} → ${url}`);

  try {
    const proxyRes = await fetchWithTimeout(
      url,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${key}`,
          "X-Places-Api-Version": "2025-06-17",
        },
      },
      FSQ_TIMEOUT_MS
    );
    const body = await proxyRes.text();
    const status = proxyRes.status || 500;
    if (isDev) console.log(`[api-proxy] ${logLabel} ← ${status}`);
    res.status(status).type("application/json").send(body);
  } catch (e) {
    if (isUpstreamTimeout(e)) {
      res.status(504).json({ error: "Upstream timeout" });
      return;
    }
    res.status(502).json({ error: "Proxy upstream error", message: e?.message ?? String(e) });
  }
}

const app = express();
app.use(express.json({ limit: "1mb" }));

const allowedCfg = parseAllowedOriginsConfig();
app.use(
  cors({
    origin(origin, callback) {
      const reqOrigin = normalizeOrigin(origin || "");
      const hasRules = allowedCfg.exact.size > 0 || allowedCfg.hostSuffixes.length > 0;
      if (!hasRules) {
        if (isDev) return callback(null, origin || true);
        if (!reqOrigin) return callback(null, true);
        return callback(
          new Error(
            `CORS: set ALLOWED_ORIGINS on Render (received Origin: ${reqOrigin}). Example: https://group-trip-planner-inky.vercel.app,*.vercel.app`
          )
        );
      }
      if (!reqOrigin) return callback(null, true);
      if (isOriginAllowed(origin || "", allowedCfg)) return callback(null, true);
      const hint =
        allowedCfg.hostSuffixes.includes(".vercel.app") ? "" : " Add *.vercel.app to allow Vercel preview URLs.";
      callback(
        new Error(
          `CORS: origin not allowed (received: ${reqOrigin}).${hint} Update ALLOWED_ORIGINS on Render (production URL + *.vercel.app if you use previews).`
        )
      );
    },
    credentials: true,
  })
);

app.get("/api/health", (_req, res) => {
  res.type("text/plain").send("ok");
});

app.post("/api/openai/enhance", async (req, res) => {
  try {
    const result = await runOpenAiEnhance(req.body);
    res.status(result.status).json(result.json);
  } catch (e) {
    res.status(500).json({ error: "Enhance handler error", message: e?.message ?? String(e) });
  }
});

app.post("/api/openai/vote-gap-fill", async (req, res) => {
  try {
    const result = await runOpenAiVoteGapFill(req.body);
    res.status(result.status).json(result.json);
  } catch (e) {
    res.status(500).json({ error: "vote-gap-fill handler error", message: e?.message ?? String(e) });
  }
});

app.post("/api/openai/vote-gap-replacement", async (req, res) => {
  try {
    const result = await runOpenAiVoteGapReplacement(req.body);
    res.status(result.status).json(result.json);
  } catch (e) {
    res
      .status(500)
      .json({ error: "vote-gap-replacement handler error", message: e?.message ?? String(e) });
  }
});

app.post("/api/openai/split-group-plan", async (req, res) => {
  try {
    const result = await runOpenAiSplitGroupPlan(req.body);
    res.status(result.status).json(result.json);
  } catch (e) {
    res.status(500).json({ error: "split-group-plan handler error", message: e?.message ?? String(e) });
  }
});

app.post("/api/openai/daily-capacity", async (req, res) => {
  try {
    const result = await runOpenAiDailyCapacity(req.body);
    res.status(result.status).json(result.json);
  } catch (e) {
    res.status(500).json({ error: "daily-capacity handler error", message: e?.message ?? String(e) });
  }
});

app.post("/api/openai/holistic-day-assignment", async (req, res) => {
  try {
    const result = await runOpenAiHolisticDayAssignment(req.body);
    res.status(result.status).json(result.json);
  } catch (e) {
    res
      .status(500)
      .json({ error: "holistic-day-assignment handler error", message: e?.message ?? String(e) });
  }
});

app.post("/api/openai/itinerary-day-reasoning", async (req, res) => {
  try {
    const result = await runOpenAiItineraryDayReasoning(req.body);
    res.status(result.status).json(result.json);
  } catch (e) {
    res.status(500).json({ error: "itinerary-day-reasoning handler error", message: e?.message ?? String(e) });
  }
});

app.post("/api/openai/itinerary-day-reasoning/stream", async (req, res) => {
  console.log("[stream] handler invoked", req.method, req.path);
  try {
    await runOpenAiItineraryDayReasoningStream(req, res);
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json({ error: "itinerary-day-reasoning/stream handler error", message: e?.message ?? String(e) });
    } else {
      try { res.write(`data: ${JSON.stringify({ type: "error", message: e?.message ?? String(e) })}\n\n`); } catch (_) {}
      res.end();
    }
  }
});

app.post("/api/openai/meal-food-gap-fill", async (req, res) => {
  try {
    const result = await runOpenAiMealFoodGapFill(req.body);
    res.status(result.status).json(result.json);
  } catch (e) {
    res.status(500).json({ error: "meal-food-gap-fill handler error", message: e?.message ?? String(e) });
  }
});

app.post("/api/openai/explore-recommendations", async (req, res) => {
  try {
    const result = await runOpenAiExploreRecommendations(req.body);
    res.status(result.status).json(result.json);
  } catch (e) {
    res
      .status(500)
      .json({ error: "explore-recommendations handler error", message: e?.message ?? String(e) });
  }
});

app.get("/api/fsq/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/fsq/search", async (req, res) => {
  const query = req.query.query;
  const near = req.query.near;
  if (query == null || String(query).trim() === "") {
    res.status(400).json({ error: "Missing or empty query parameter" });
    return;
  }
  if (near == null || String(near).trim() === "") {
    res.status(400).json({ error: "Missing or empty near parameter" });
    return;
  }
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (Array.isArray(v)) v.forEach((x) => qs.append(k, String(x)));
    else if (v != null) qs.set(k, String(v));
  }
  await proxyFsqGet(`/places/search?${qs.toString()}`, res, "search");
});

app.get("/api/fsq/places/:fsqId", async (req, res) => {
  const fsqId = req.params.fsqId;
  if (!fsqId) {
    res.status(400).json({ error: "Missing fsq_id in path" });
    return;
  }
  await proxyFsqGet(`/places/${encodeURIComponent(fsqId)}`, res, "details");
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found", path: req.path, method: req.method });
});

app.use((err, _req, res, _next) => {
  if (err?.message?.startsWith("CORS")) {
    res.status(403).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: "Server error", message: err?.message ?? String(err) });
});

app.listen(PORT, () => {
  console.log(
    `[api-proxy] Express http://localhost:${PORT} (FSQ: ${getFsqKey() ? "set" : "NOT SET"}, OPENAI: ${getOpenAiKey() ? "set" : "NOT SET"}, PLACES: ${getPlacesKey() ? "set" : "NOT SET"}, CORS: ${[...allowedCfg.exact].join(", ") || "(none)"}${allowedCfg.hostSuffixes.length ? ` + suffix:${allowedCfg.hostSuffixes.join(",")}` : ""}${isDev ? " (dev)" : ""})`
  );
});
