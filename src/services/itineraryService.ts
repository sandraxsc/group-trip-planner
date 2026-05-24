import { getApiProxyBase } from "../config/apiProxy";
import { getTripById, getTripMembers } from "./tripService";
import { getRankedVoteCandidates } from "./activityEngine";
import { getPrimaryCategory } from "./activityEngine";
import { generateGroupPlanningProfile } from "./planningService";
import { getMemberPreferencesByTripId } from "./preferenceService";
import { getAggregatedVotesByTripId, getVotesByTripId } from "./voteService";
import { getAIVotingRecommendations } from "./votingRecommendationService";
import { evaluateSplitGroupPlan } from "./splitGroupPlanService";
import {
  evaluateDailyCapacity,
  totalNonMealSlotsAcrossTrip,
} from "./dailyCapacityService";
import { expandFoodActivitiesWithAiMealGap } from "./mealFoodGapFillService";
import {
  buildItinerarySchedulerPersonalityPromptSection,
  buildScheduledDaysForSchedulerPayload,
  buildSchedulerGroupContextPayload,
  candidatesBriefFromPool,
  fetchItinerarySchedulerDayInsights,
} from "./itineraryDayReasoningService";
import type { RankedCandidate } from "../types/activity";
import type { GroupPlanningProfile } from "../types/preference";
import type { SplitGroupPlanEvaluation } from "../types/splitGroupPlan";
import type {
  HolisticDayAssignmentInput,
  HolisticDayAssignmentResult,
  Itinerary,
  ItineraryBlock,
  ItineraryDay,
  ItineraryTransitLeg,
  ItineraryTransitSnapshot,
  MealBlock,
  ScheduledActivity,
  TimeBlockLabel,
} from "../types/itinerary";
import { cloudUpsertTripItinerary, isItineraryCloudEnabled } from "./itineraryCloudStore";
import type { TransitInfo } from "./transitService";
import { isFoodActivity } from "../utils/activityClassifier";
import { minutesToTime, timeToMinutes } from "../utils/timeUtils";
import {
  intersectBlockWithVenueWindows,
  isVenueOpenOnWeekday,
  weekdayForDayIndex,
} from "../utils/openingHours";

/**
 * Maps 0-based dayIndex to a JS weekday (0=Sun..6=Sat) when the trip has a real
 * start date, otherwise returns null. Schedulers call this once per day to know
 * whether to apply weekday-specific opening-hour filtering.
 */
type WeekdayProvider = (dayIdx0: number) => number | null;

const NULL_WEEKDAY_PROVIDER: WeekdayProvider = () => null;

const MEAL_SLOT_MINUTES = 60;
const LUNCH_START = "12:00";
const DINNER_START = "19:00";
/** Max distance in km to consider two activities "nearby" for clustering (Haversine approx). */
const NEARBY_KM = 2.5;

/** Dev always; production only if `VITE_DEBUG_ITINERARY=true` (e.g. on Vercel) — logs food/meal pipeline. */
function itineraryDebugEnabled(): boolean {
  const v = import.meta.env?.VITE_DEBUG_ITINERARY;
  return import.meta.env.DEV || v === "true" || v === "1";
}

/**
 * Re-rank activities by vote results. Each member's vote contributes (up = +1, down = -1).
 * Weighted: we use simple sum; extensible for future weight per member.
 */
export function rankActivitiesFromVotes(
  candidates: RankedCandidate[],
  tripId: string
): RankedCandidate[] {
  const agg = getAggregatedVotesByTripId(tripId);
  const scored = candidates.map((c) => {
    const v = agg[c.placeId] ?? { up: 0, down: 0 };
    const voteScore = v.up - v.down;
    return { candidate: c, voteScore };
  });
  scored.sort((a, b) => b.voteScore - a.voteScore);
  if (itineraryDebugEnabled()) {
    // Log ranking based purely on votes before itinerary generation trims / clusters.
    // Higher voteScore means more up-votes relative to down-votes.
    // This is the first pass of ranking after voting is submitted.
    // eslint-disable-next-line no-console
    console.log(
      "[itinerary] vote-based ranking",
      scored.map((s, idx) => ({
        index: idx + 1,
        placeId: s.candidate.placeId,
        name: s.candidate.name,
        voteScore: s.voteScore,
      }))
    );
  }
  return scored.map((s) => s.candidate);
}

function normalizePickLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesGooglePlaceRef(selected: string, placeId: string): boolean {
  const t = String(selected).trim();
  if (!t) return false;
  const nid = t.replace(/^places\//, "");
  if (t.startsWith("places/") || nid.startsWith("ChIJ")) {
    return nid === placeId || placeId.includes(nid) || nid.includes(placeId);
  }
  return false;
}

function wasExplicitlyBackedByMemberPrefs(
  c: RankedCandidate,
  tripId: string,
  profile: GroupPlanningProfile
): boolean {
  if (c.isSelectedByAnyMember || c.selectedCount > 0) return true;
  const normName = normalizePickLabel(c.name);
  for (const place of profile.candidatePlaces ?? []) {
    if (normalizePickLabel(String(place)) === normName) return true;
  }
  for (const pref of getMemberPreferencesByTripId(tripId)) {
    for (const sp of pref.selectedPlaces ?? []) {
      const raw = String(sp).trim();
      if (!raw) continue;
      if (normalizePickLabel(raw) === normName) return true;
      if (matchesGooglePlaceRef(raw, c.placeId)) return true;
    }
  }
  return false;
}

function partitionVoteCandidatesForItinerary(
  voteRanked: RankedCandidate[],
  tripId: string,
  profile: GroupPlanningProfile
): { groupCandidates: RankedCandidate[]; splitCandidates: RankedCandidate[]; removedPlaceIds: string[] } {
  const agg = getAggregatedVotesByTripId(tripId);
  const groupCandidates: RankedCandidate[] = [];
  const splitCandidates: RankedCandidate[] = [];
  const removedPlaceIds: string[] = [];

  for (const c of voteRanked) {
    const v = agg[c.placeId] ?? { up: 0, down: 0 };
    const total = v.up + v.down;
    const downRatio = total === 0 ? 0 : v.down / total;
    const excludedFromGroup = total > 0 && downRatio > 0.5;
    const stamped: RankedCandidate = { ...c, excludedFromGroup };

    if (!excludedFromGroup) {
      groupCandidates.push({ ...stamped, excludedFromGroup: false });
    } else if (wasExplicitlyBackedByMemberPrefs(c, tripId, profile)) {
      splitCandidates.push(stamped);
    } else {
      removedPlaceIds.push(c.placeId);
    }
  }
  return { groupCandidates, splitCandidates, removedPlaceIds };
}

async function ensureGroupNonFoodPoolMeetsDays(args: {
  tripId: string;
  groupCandidates: RankedCandidate[];
  minNonFoodSlots: number;
  removedPlaceIds: string[];
  /** Trip vote pool from generateItinerary (avoids re-fetch inside getAIVotingRecommendations). */
  rankedCandidates?: RankedCandidate[];
}): Promise<RankedCandidate[]> {
  const minNonFood = Math.max(1, args.minNonFoodSlots);
  const group = [...args.groupCandidates];
  const nonFoodCount = () => group.filter((a) => !isFoodActivity(a)).length;
  if (nonFoodCount() >= minNonFood) return group;

  const MAX_GAP_FILL_ROUNDS = 2;

  for (let round = 0; round < MAX_GAP_FILL_ROUNDS; round++) {
    if (nonFoodCount() >= minNonFood) break;

    const nonFoodDeficit = Math.max(0, minNonFood - nonFoodCount());
    const minRecommendationCount = Math.min(Math.max(1, nonFoodDeficit), 10);
    const excludePlaceIds =
      round === 0
        ? [...new Set(args.removedPlaceIds)]
        : [
            ...new Set([
              ...args.removedPlaceIds,
              ...group.map((g) => g.placeId),
            ]),
          ];

    const additions = await getAIVotingRecommendations(args.tripId, {
      excludePlaceIds,
      minRecommendationCount,
      nonFoodDeficit,
      baseCandidates: args.rankedCandidates,
    });
    const nonFoodAdditions = additions.filter((row) => !isFoodActivity(row));
    const foodAdditions = additions.filter((row) => isFoodActivity(row));
    const orderedAdditions = [...nonFoodAdditions, ...foodAdditions];

    let additionsFullyConsumed = true;
    for (const row of orderedAdditions) {
      if (group.some((g) => g.placeId === row.placeId)) continue;
      group.push({ ...row, excludedFromGroup: false });
      if (nonFoodCount() >= minNonFood) {
        additionsFullyConsumed = false;
        break;
      }
    }

    if (nonFoodCount() >= minNonFood) break;
    if (!additionsFullyConsumed) break;
    // Round 0 exhausted all additions but still short — retry once with broader excludes.
  }

  return group;
}

/**
 * Haversine distance in km between two lat/lng points.
 */
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Cluster activities by location. Returns groups of placeIds that are nearby.
 * Activities without location are in a separate "noLocation" group.
 */
export function clusterActivitiesByLocation(
  activities: RankedCandidate[]
): { clusters: string[][]; noLocation: string[] } {
  const withLoc = activities.filter((a) => a.location?.lat != null && a.location?.lng != null);
  const noLocation = activities.filter((a) => !a.location?.lat || !a.location?.lng).map((a) => a.placeId);
  const used = new Set<string>();
  const clusters: string[][] = [];

  for (const a of withLoc) {
    if (used.has(a.placeId)) continue;
    const cluster: string[] = [a.placeId];
    used.add(a.placeId);
    const lat = a.location!.lat;
    const lng = a.location!.lng;
    for (const b of withLoc) {
      if (used.has(b.placeId)) continue;
      if (haversineKm(lat, lng, b.location!.lat, b.location!.lng) <= NEARBY_KM) {
        cluster.push(b.placeId);
        used.add(b.placeId);
      }
    }
    clusters.push(cluster);
  }
  return { clusters, noLocation };
}

/**
 * Reserve lunch and dinner slots for a day. Each slot is 60 minutes.
 */
export function reserveMealSlotsForDay(
  dayStart: string,
  dayEnd: string
): { lunch: MealBlock; dinner: MealBlock } {
  const lunchStart = timeToMinutes(LUNCH_START);
  const dinnerStart = timeToMinutes(DINNER_START);
  return {
    lunch: {
      label: "lunch",
      startTime: LUNCH_START,
      endTime: minutesToTime(lunchStart + MEAL_SLOT_MINUTES),
    },
    dinner: {
      label: "dinner",
      startTime: DINNER_START,
      endTime: minutesToTime(dinnerStart + MEAL_SLOT_MINUTES),
    },
  };
}

/**
 * Check if an activity of given duration fits in a time block given existing scheduled activities.
 */
export function canActivityFitInBlock(
  blockStart: string,
  blockEnd: string,
  durationMinutes: number,
  existingActivities: ScheduledActivity[]
): boolean {
  const blockStartMin = timeToMinutes(blockStart);
  const blockEndMin = timeToMinutes(blockEnd);
  let nextFree = blockStartMin;
  const sorted = [...existingActivities].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );
  for (const a of sorted) {
    const start = timeToMinutes(a.startTime);
    const end = timeToMinutes(a.endTime);
    if (start > nextFree && start - nextFree >= durationMinutes) {
      return true;
    }
    nextFree = Math.max(nextFree, end);
  }
  return blockEndMin - nextFree >= durationMinutes;
}

/**
 * Find the next available start time in a block for an activity of given duration.
 */
function nextSlotInBlock(
  blockStart: string,
  blockEnd: string,
  durationMinutes: number,
  existingActivities: ScheduledActivity[]
): string | null {
  const blockStartMin = timeToMinutes(blockStart);
  const blockEndMin = timeToMinutes(blockEnd);
  let nextFree = blockStartMin;
  const sorted = [...existingActivities].sort(
    (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
  );
  for (const a of sorted) {
    const start = timeToMinutes(a.startTime);
    const end = timeToMinutes(a.endTime);
    if (start >= nextFree && start - nextFree >= durationMinutes) {
      return minutesToTime(nextFree);
    }
    nextFree = Math.max(nextFree, end);
  }
  if (blockEndMin - nextFree >= durationMinutes) return minutesToTime(nextFree);
  return null;
}

/**
 * Build day structure with blocks and meal slots from commonActivityHours.
 */
function getDayStructure(
  dayStart: string,
  dayEnd: string
): { blocks: { label: TimeBlockLabel; start: string; end: string }[]; lunch: MealBlock; dinner: MealBlock } {
  const { lunch, dinner } = reserveMealSlotsForDay(dayStart, dayEnd);
  const dayStartMin = timeToMinutes(dayStart);
  const lunchStartMin = timeToMinutes(lunch.startTime);
  const lunchEndMin = timeToMinutes(lunch.endTime);
  const dinnerStartMin = timeToMinutes(dinner.startTime);
  const dinnerEndMin = timeToMinutes(dinner.endTime);
  const dayEndMin = timeToMinutes(dayEnd);

  const blocks: { label: TimeBlockLabel; start: string; end: string }[] = [];
  if (lunchStartMin > dayStartMin) {
    blocks.push({
      label: "morning",
      start: dayStart,
      end: lunch.startTime,
    });
  }
  if (dinnerStartMin > lunchEndMin) {
    blocks.push({
      label: "afternoon",
      start: lunch.endTime,
      end: dinner.startTime,
    });
  }
  if (dayEndMin > dinnerEndMin) {
    blocks.push({
      label: "evening",
      start: dinner.endTime,
      end: dayEnd,
    });
  }
  if (blocks.length === 0) {
    blocks.push({ label: "morning", start: dayStart, end: dayEnd });
  }
  return { blocks, lunch, dinner };
}

/** How `timeWindow` maps to internal morning/afternoon/evening blocks for placement. */
type AssignActivitiesWindowMode = "common_hours" | "split_subgroup";

/**
 * For subgroup windows, avoid global lunch/dinner boundaries leaking outside the window;
 * use one schedulable span so activities stay within [start, end].
 */
function getSplitSubgroupSchedulingBlocks(
  winStart: string,
  winEnd: string
): { label: TimeBlockLabel; start: string; end: string }[] {
  if (timeToMinutes(winEnd) <= timeToMinutes(winStart)) {
    return [{ label: "morning", start: winStart, end: winEnd }];
  }
  return [{ label: "morning", start: winStart, end: winEnd }];
}

function inferBlockLabelForCommonDay(
  startTime: string,
  blocks: { label: TimeBlockLabel; start: string; end: string }[]
): TimeBlockLabel {
  const sm = timeToMinutes(startTime);
  for (const b of blocks) {
    const bs = timeToMinutes(b.start);
    const be = timeToMinutes(b.end);
    if (sm >= bs && sm < be) return b.label;
  }
  return blocks.length > 0 ? blocks[blocks.length - 1]!.label : "afternoon";
}

function splitWindowBlockers(
  splitPlan: Extract<SplitGroupPlanEvaluation, { needsSplit: true }>
): ScheduledActivity[] {
  return splitPlan.splitGroups
    .map((sg, idx): ScheduledActivity | null => {
      const start = typeof sg.timeWindow?.start === "string" ? sg.timeWindow.start.trim() : "";
      const end = typeof sg.timeWindow?.end === "string" ? sg.timeWindow.end.trim() : "";
      if (!start || !end || timeToMinutes(end) <= timeToMinutes(start)) return null;
      return {
        placeId: `split-window-${idx}`,
        name: "Split group window",
        startTime: start,
        endTime: end,
        durationMinutes: timeToMinutes(end) - timeToMinutes(start),
        blockLabel: "afternoon" as const,
        activity: {} as ScheduledActivity["activity"],
      };
    })
    .filter((row): row is ScheduledActivity => row != null);
}

function keepCommonActivitiesOutsideSplitWindows(
  activities: ScheduledActivity[],
  splitPlan: Extract<SplitGroupPlanEvaluation, { needsSplit: true }>,
  dayStart: string,
  dayEnd: string,
  weekday: number | null = null
): ScheduledActivity[] {
  if (activities.length === 0) return activities;

  const blockers = splitWindowBlockers(splitPlan);
  const splitClaimedIds = new Set(splitPlan.splitGroups.flatMap((sg) => sg.activities ?? []));
  const commonBlocks = getDayStructure(dayStart, dayEnd).blocks;

  const sorted = [...activities].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  const splitItems: ScheduledActivity[] = [];
  const commonItems: ScheduledActivity[] = [];
  for (const a of sorted) {
    if (splitClaimedIds.has(a.placeId)) splitItems.push(a);
    else commonItems.push(a);
  }

  const placed: ScheduledActivity[] = [];

  // The candidate-aware variant: only consider sub-windows of `block` that the
  // venue is actually open during on this weekday. Falls back to the full block
  // if we don't have hours data.
  const nextStartFor = (item: ScheduledActivity): string | null => {
    const duration = item.durationMinutes;
    const occupied = [...placed, ...blockers, ...splitItems];
    for (const block of commonBlocks) {
      const blockExisting = occupied.filter((a) =>
        timeRangesOverlap(a.startTime, a.endTime, block.start, block.end)
      );
      const subWindows = item.activity
        ? intersectBlockWithVenueWindows(block.start, block.end, item.activity, weekday)
        : [{ start: block.start, end: block.end }];
      for (const w of subWindows) {
        const slot = nextSlotInBlock(w.start, w.end, duration, blockExisting);
        if (slot == null) continue;
        const slotEnd = minutesToTime(timeToMinutes(slot) + duration);
        const collides = occupied.some((a) =>
          timeRangesOverlap(slot, slotEnd, a.startTime, a.endTime)
        );
        if (!collides) return slot;
      }
    }
    return null;
  };

  for (const item of commonItems) {
    // If the venue is closed on this weekday entirely, drop it from this day.
    if (item.activity && !isVenueOpenOnWeekday(item.activity, weekday)) {
      if (itineraryDebugEnabled()) {
        // eslint-disable-next-line no-console
        console.log("[itinerary] common-activity drop — closed weekday", {
          weekday,
          placeId: item.placeId,
          name: item.name,
        });
      }
      continue;
    }
    const nextStart = nextStartFor(item);
    if (!nextStart) {
      // Keeping the original time here can preserve the exact conflict this
      // cleanup pass is supposed to fix (for example two common activities both
      // at 09:00, or an activity outside its open hours). If no valid slot exists,
      // leave it off this generated day instead of rendering an impossible plan.
      if (itineraryDebugEnabled()) {
        // eslint-disable-next-line no-console
        console.log("[itinerary] common-activity drop — no valid open slot", {
          weekday,
          placeId: item.placeId,
          name: item.name,
          originalStart: item.startTime,
          originalEnd: item.endTime,
        });
      }
      continue;
    }
    placed.push({
      ...item,
      startTime: nextStart,
      endTime: minutesToTime(timeToMinutes(nextStart) + item.durationMinutes),
    });
  }

  return [...placed, ...splitItems];
}

/**
 * Assign non-food activities to day blocks (morning/afternoon/evening), respecting duration and max per day.
 * `timeWindow` is the schedulable clock span for this batch (group = common overlap; split = subgroup window).
 * `windowMode` selects how that span is subdivided into blocks.
 */
function assignActivitiesToDays(
  activities: RankedCandidate[],
  tripDays: number,
  timeWindow: { start: string; end: string },
  maxPerDayByDayIndex: readonly number[],
  windowMode: AssignActivitiesWindowMode,
  weekdayProvider: WeekdayProvider = NULL_WEEKDAY_PROVIDER,
  /**
   * Activities already scheduled for each day before this pass runs. They are
   * not re-scheduled or returned, but they DO occupy time so this pass won't
   * place a new activity overlapping with them. This is what prevents a split
   * subgroup activity and a common group activity from independently claiming
   * the same clock slot (e.g. both at 1:00 PM) and then colliding when merged.
   */
  preExistingByDay?: Map<number, ScheduledActivity[]>
): Map<number, ScheduledActivity[]> {
  const { start: dayStart, end: dayEnd } = timeWindow;
  const blocks =
    windowMode === "common_hours"
      ? getDayStructure(dayStart, dayEnd).blocks
      : getSplitSubgroupSchedulingBlocks(dayStart, dayEnd);

  // Seed each day with anything already placed by an earlier pass so the slot
  // search treats those time ranges as occupied. The pre-existing entries are
  // stripped from the returned map below to avoid double-merging by the caller.
  const byDay = new Map<number, ScheduledActivity[]>();
  for (let d = 0; d < tripDays; d++) {
    byDay.set(d, [...(preExistingByDay?.get(d) ?? [])]);
  }

  const used: boolean[] = new Array(activities.length).fill(false);

  for (let dayIdx = 0; dayIdx < tripDays; dayIdx++) {
    const dayActivities = byDay.get(dayIdx)!;
    let count = 0;
    const dayCap =
      maxPerDayByDayIndex[dayIdx] ??
      maxPerDayByDayIndex[maxPerDayByDayIndex.length - 1] ??
      3;
    const weekday = weekdayProvider(dayIdx);

    for (const block of blocks) {
      if (count >= dayCap) break;

      let placedInThisBlock = true;
      while (placedInThisBlock && count < dayCap) {
        placedInThisBlock = false;
        let chosenIndex = -1;
        let chosenSlot: string | null = null;
        let chosenDuration = 0;

        for (let i = 0; i < activities.length; i++) {
          if (used[i]) continue;
          const candidate = activities[i]!;
          if (isFoodActivity(candidate)) continue;

          // Skip venues we know are closed on this weekday entirely.
          if (!isVenueOpenOnWeekday(candidate, weekday)) {
            if (itineraryDebugEnabled()) {
              // eslint-disable-next-line no-console
              console.log("[itinerary] non-food scheduling skip — closed weekday", {
                day: dayIdx + 1,
                weekday,
                placeId: candidate.placeId,
                name: candidate.name,
              });
            }
            continue;
          }

          const duration = candidate.estimatedDuration ?? 120;
          // Time-overlap rather than block-label match: a pre-existing activity
          // (e.g. a split subgroup window placed earlier) may have been tagged
          // with a different block label but still occupies time inside this
          // block's clock range. Block-label-only filtering misses that, which
          // is how two activities ended up at the same start time.
          const bStartMin = timeToMinutes(block.start);
          const bEndMin = timeToMinutes(block.end);
          const existing = dayActivities.filter((a) => {
            const aStart = timeToMinutes(a.startTime);
            const aEnd = timeToMinutes(a.endTime);
            return aStart < bEndMin && aEnd > bStartMin;
          });
          // Constrain the block to the candidate's open hours for this weekday and
          // try each resulting sub-window in order (handles split shifts and
          // partial-block availability like "open until 17:00").
          const subWindows = intersectBlockWithVenueWindows(
            block.start,
            block.end,
            candidate,
            weekday
          );
          let slot: string | null = null;
          for (const w of subWindows) {
            slot = nextSlotInBlock(w.start, w.end, duration, existing);
            if (slot) break;
          }

          if (itineraryDebugEnabled()) {
            // eslint-disable-next-line no-console
            console.log("[itinerary] non-food scheduling attempt", {
              day: dayIdx + 1,
              block: block.label,
              placeId: candidate.placeId,
              name: candidate.name,
              durationMinutes: duration,
              weekday,
              openSubWindows: subWindows,
              canFit: !!slot,
            });
          }

          if (slot) {
            chosenIndex = i;
            chosenSlot = slot;
            chosenDuration = duration;
            break; // take the first ranked activity that fits this block
          }
        }

        if (chosenIndex === -1 || !chosenSlot) {
          // No remaining candidate can fit in this block; move to next block.
          break;
        }

        const endMin = timeToMinutes(chosenSlot) + chosenDuration;
        const endTime = minutesToTime(endMin);

        dayActivities.push({
          placeId: activities[chosenIndex]!.placeId,
          name: activities[chosenIndex]!.name,
          startTime: chosenSlot,
          endTime,
          durationMinutes: chosenDuration,
          blockLabel: block.label,
          activity: activities[chosenIndex]!,
        });

        used[chosenIndex] = true;
        count++;
        placedInThisBlock = true;
      }
    }
  }

  // No pre-existing seed → caller is the only contributor, return as-is.
  if (!preExistingByDay) return byDay;

  // Caller passed in already-scheduled activities to act as time blockers.
  // Strip them out of the return so the caller's existing merge logic doesn't
  // append them a second time on top of what's already in nonFoodByDay.
  const result = new Map<number, ScheduledActivity[]>();
  for (let d = 0; d < tripDays; d++) {
    const preIds = new Set((preExistingByDay.get(d) ?? []).map((a) => a.placeId));
    result.set(d, (byDay.get(d) ?? []).filter((a) => !preIds.has(a.placeId)));
  }
  return result;
}

/**
 * Last non-food activity that ends at or before lunch start (closest to lunch from the morning side).
 */
function getReferenceActivityBeforeLunch(
  dayNonFood: ScheduledActivity[],
  lunchStartTime: string
): ScheduledActivity | undefined {
  const lunchMin = timeToMinutes(lunchStartTime);
  let best: ScheduledActivity | undefined;
  let bestEnd = -1;
  for (const a of dayNonFood) {
    const end = timeToMinutes(a.endTime);
    if (end <= lunchMin && end >= bestEnd) {
      bestEnd = end;
      best = a;
    }
  }
  return best;
}

/**
 * First non-food activity that starts at or after dinner end (closest after dinner).
 */
function getReferenceActivityAfterDinner(
  dayNonFood: ScheduledActivity[],
  dinnerEndTime: string
): ScheduledActivity | undefined {
  const dinnerEndMin = timeToMinutes(dinnerEndTime);
  let best: ScheduledActivity | undefined;
  let bestStart = Number.POSITIVE_INFINITY;
  for (const a of dayNonFood) {
    const start = timeToMinutes(a.startTime);
    if (start >= dinnerEndMin && start < bestStart) {
      bestStart = start;
      best = a;
    }
  }
  return best;
}

const MEAL_PROXIMITY_PREFER_KM = 1.5;

function timeRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  const as = timeToMinutes(aStart);
  const ae = timeToMinutes(aEnd);
  const bs = timeToMinutes(bStart);
  const be = timeToMinutes(bEnd);
  return as < be && ae > bs;
}

function mealSlotOverlapsPreferredWindow(
  food: RankedCandidate,
  mealSlot: { start: string; end: string }
): boolean {
  const tw = food.preferredTimeWindow;
  if (!tw) return false;
  return timeRangesOverlap(mealSlot.start, mealSlot.end, tw.start, tw.end);
}

function applySplitGroupPreferredMealWindows(
  foodActivities: RankedCandidate[],
  splitPlan: Extract<SplitGroupPlanEvaluation, { needsSplit: true }>
): RankedCandidate[] {
  const byPlaceId = new Map(foodActivities.map((f, i) => [f.placeId, i] as const));
  const next = foodActivities.map((f) => ({ ...f }));

  for (const sg of splitPlan.splitGroups) {
    const tw = sg.timeWindow;
    const wStart =
      typeof tw?.start === "string" && tw.start.trim() ? tw.start.trim() : null;
    const wEnd = typeof tw?.end === "string" && tw.end.trim() ? tw.end.trim() : null;
    if (!wStart || !wEnd || timeToMinutes(wEnd) <= timeToMinutes(wStart)) continue;

    const window = { start: wStart, end: wEnd };
    for (const placeId of sg.activities ?? []) {
      const idx = byPlaceId.get(placeId);
      if (idx == null) continue;
      const row = next[idx];
      if (!row || !isFoodActivity(row)) continue;
      next[idx] = { ...row, preferredTimeWindow: window };
    }
  }

  return next;
}

function foodDistanceToRefKm(food: RankedCandidate, ref: ScheduledActivity): number {
  const rLoc = ref.activity?.location;
  const fLoc = food.location;
  if (
    !rLoc ||
    typeof rLoc.lat !== "number" ||
    typeof rLoc.lng !== "number" ||
    !fLoc ||
    typeof fLoc.lat !== "number" ||
    typeof fLoc.lng !== "number"
  ) {
    return Number.POSITIVE_INFINITY;
  }
  return haversineKm(rLoc.lat, rLoc.lng, fLoc.lat, fLoc.lng);
}

/**
 * Pick best food index among candidates: proximity to ref when ref has coordinates; otherwise lowest index.
 */
function pickBestFoodIndexAmong(
  foodActivities: RankedCandidate[],
  candidateIndices: number[],
  ref: ScheduledActivity | undefined
): number | null {
  if (candidateIndices.length === 0) return null;

  const refHasCoords = Boolean(
    ref?.activity?.location &&
      typeof ref.activity.location.lat === "number" &&
      typeof ref.activity.location.lng === "number"
  );

  if (!refHasCoords) {
    return Math.min(...candidateIndices);
  }

  const scored = candidateIndices.map((i) => ({
    i,
    dKm: foodDistanceToRefKm(foodActivities[i]!, ref!),
  }));

  scored.sort((a, b) => {
    const aIn = a.dKm <= MEAL_PROXIMITY_PREFER_KM;
    const bIn = b.dKm <= MEAL_PROXIMITY_PREFER_KM;
    if (aIn !== bIn) return aIn ? -1 : 1;
    if (a.dKm !== b.dKm) return a.dKm - b.dKm;
    return a.i - b.i;
  });

  return scored[0]!.i;
}

/**
 * Pick next unused food index: by proximity to ref when ref has coordinates; otherwise earliest unused index (priority order).
 * When mealSlot is set, unused foods with preferredTimeWindow overlapping that slot win as a tie-breaker first.
 */
function pickNextFoodIndexForMealSlot(
  foodActivities: RankedCandidate[],
  usedFoodIndices: Set<number>,
  ref: ScheduledActivity | undefined,
  mealSlot?: { start: string; end: string },
  weekday: number | null = null
): number | null {
  const indices: number[] = [];
  for (let i = 0; i < foodActivities.length; i++) {
    if (usedFoodIndices.has(i)) continue;
    const c = foodActivities[i]!;
    // Restaurant must be open on this weekday, and — if a meal slot was given —
    // open at least partially during it. We use intersectBlockWithVenueWindows
    // to detect coverage; an empty result means the venue is closed at meal time.
    if (mealSlot) {
      const overlap = intersectBlockWithVenueWindows(
        mealSlot.start,
        mealSlot.end,
        c,
        weekday
      );
      if (overlap.length === 0) continue;
    } else if (!isVenueOpenOnWeekday(c, weekday)) {
      continue;
    }
    indices.push(i);
  }
  if (indices.length === 0) return null;

  if (mealSlot) {
    const preferredInWindow = indices.filter((i) =>
      mealSlotOverlapsPreferredWindow(foodActivities[i]!, mealSlot)
    );
    if (preferredInWindow.length > 0) {
      const picked = pickBestFoodIndexAmong(foodActivities, preferredInWindow, ref);
      if (picked != null) return picked;
    }
  }

  return pickBestFoodIndexAmong(foodActivities, indices, ref);
}

/**
 * Assign food activities to lunch and dinner slots across days.
 */
function assignFoodActivitiesToMealSlots(
  foodActivities: RankedCandidate[],
  nonFoodByDay: Map<number, ScheduledActivity[]>,
  tripDays: number,
  dayStart: string,
  dayEnd: string,
  weekdayProvider: WeekdayProvider = NULL_WEEKDAY_PROVIDER
): Map<number, { lunch?: ScheduledActivity; dinner?: ScheduledActivity }> {
  const result = new Map<number, { lunch?: ScheduledActivity; dinner?: ScheduledActivity }>();
  for (let d = 0; d < tripDays; d++) result.set(d, {});
  const { lunch, dinner } = reserveMealSlotsForDay(dayStart, dayEnd);
  const usedFoodIndices = new Set<number>();

  for (let dayIdx = 0; dayIdx < tripDays; dayIdx++) {
    const day = result.get(dayIdx)!;
    const dayNonFood = [...(nonFoodByDay.get(dayIdx) ?? [])].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    );
    const weekday = weekdayProvider(dayIdx);

    const lunchRef = getReferenceActivityBeforeLunch(dayNonFood, lunch.startTime);
    const lunchIdx = pickNextFoodIndexForMealSlot(foodActivities, usedFoodIndices, lunchRef, {
      start: lunch.startTime,
      end: lunch.endTime,
    }, weekday);
    if (lunchIdx != null) {
      const c = foodActivities[lunchIdx]!;
      usedFoodIndices.add(lunchIdx);
      if (itineraryDebugEnabled()) {
        // eslint-disable-next-line no-console
        console.log("[itinerary] food scheduling (lunch)", {
          day: dayIdx + 1,
          placeId: c.placeId,
          name: c.name,
          primaryCategory: getPrimaryCategory(c),
          classifiedAsFood: true,
          proximityRef: lunchRef
            ? { placeId: lunchRef.placeId, name: lunchRef.name, hasCoords: Boolean(lunchRef.activity?.location) }
            : null,
          distanceKm:
            lunchRef && lunchRef.activity?.location && c.location
              ? foodDistanceToRefKm(c, lunchRef)
              : null,
        });
      }
      day.lunch = {
        placeId: c.placeId,
        name: c.name,
        startTime: lunch.startTime,
        endTime: lunch.endTime,
        durationMinutes: MEAL_SLOT_MINUTES,
        blockLabel: "lunch",
        activity: c,
      };
    }

    const dinnerRef = getReferenceActivityAfterDinner(dayNonFood, dinner.endTime);
    const dinnerIdx = pickNextFoodIndexForMealSlot(foodActivities, usedFoodIndices, dinnerRef, {
      start: dinner.startTime,
      end: dinner.endTime,
    }, weekday);
    if (dinnerIdx != null) {
      const c = foodActivities[dinnerIdx]!;
      usedFoodIndices.add(dinnerIdx);
      if (itineraryDebugEnabled()) {
        // eslint-disable-next-line no-console
        console.log("[itinerary] food scheduling (dinner)", {
          day: dayIdx + 1,
          placeId: c.placeId,
          name: c.name,
          primaryCategory: getPrimaryCategory(c),
          classifiedAsFood: true,
          proximityRef: dinnerRef
            ? { placeId: dinnerRef.placeId, name: dinnerRef.name, hasCoords: Boolean(dinnerRef.activity?.location) }
            : null,
          distanceKm:
            dinnerRef && dinnerRef.activity?.location && c.location
              ? foodDistanceToRefKm(c, dinnerRef)
              : null,
        });
      }
      day.dinner = {
        placeId: c.placeId,
        name: c.name,
        startTime: dinner.startTime,
        endTime: dinner.endTime,
        durationMinutes: MEAL_SLOT_MINUTES,
        blockLabel: "dinner",
        activity: c,
      };
    }
  }
  return result;
}

function splitPlanUsesSubgroupWindows(
  splitPlan: SplitGroupPlanEvaluation
): splitPlan is Extract<SplitGroupPlanEvaluation, { needsSplit: true }> {
  return (
    splitPlan.needsSplit === true &&
    Array.isArray(splitPlan.splitGroups) &&
    splitPlan.splitGroups.length > 0
  );
}

/**
 * Safely coerce a raw AI response into a HolisticDayAssignmentResult.
 * Mirrors the defensive style of normalizeDailyCapacityResponse — type-guard
 * every field, skip malformed entries, never throw, and return null when the
 * payload is unusable so callers can fall back to deterministic scheduling.
 */
function normalizeHolisticDayAssignment(
  data: unknown,
  tripDays: number
): HolisticDayAssignmentResult | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (!Array.isArray(o.days)) return null;

  const days: HolisticDayAssignmentResult["days"] = [];
  for (const raw of o.days) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const dayIndex =
      typeof r.dayIndex === "number" ? Math.floor(r.dayIndex) : -1;
    if (dayIndex < 1 || dayIndex > tripDays) continue;
    const activities = Array.isArray(r.activities)
      ? r.activities.filter((x): x is string => typeof x === "string")
      : [];
    const lunch = typeof r.lunch === "string" ? r.lunch : null;
    const dinner = typeof r.dinner === "string" ? r.dinner : null;
    days.push({ dayIndex, activities, lunch, dinner });
  }

  if (days.length === 0) return null;
  return { days };
}

/**
 * Call the OpenAI proxy `/api/openai/holistic-day-assignment` to get a
 * whole-trip day plan in one shot. Mirrors evaluateDailyCapacity's proxy
 * contract: never throws, returns null on HTTP error, proxy error payload,
 * or shape mismatch (via normalizeHolisticDayAssignment).
 */
async function fetchHolisticDayAssignment(
  input: HolisticDayAssignmentInput,
  tripDays: number
): Promise<HolisticDayAssignmentResult | null> {
  const base = getApiProxyBase();
  try {
    const res = await fetch(`${base}/api/openai/holistic-day-assignment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      console.warn("[holisticDayAssignment] HTTP", res.status);
      return null;
    }
    const data = (await res.json()) as unknown;
    if (data && typeof data === "object" && "error" in (data as object)) {
      console.warn("[holisticDayAssignment] proxy error", data);
      return null;
    }
    return normalizeHolisticDayAssignment(data, tripDays);
  } catch (e) {
    console.warn("[holisticDayAssignment] request failed", e);
    return null;
  }
}

/**
 * Filter the AI assignment against the actual candidate pools and per-day caps.
 * Drops unknown placeIds, duplicates across the trip, and overflow beyond a day's
 * non-meal capacity; lunch/dinner are validated separately against the food pool.
 * Returns the cleaned result plus a droppedRatio (dropped / expected slots) so the
 * caller can decide whether the AI output is trustworthy enough to use.
 */
function validateHolisticAssignment(
  result: HolisticDayAssignmentResult,
  validNonFoodIds: Set<string>,
  validFoodIds: Set<string>,
  maxPerDayByDayIndex: readonly number[]
): { cleaned: HolisticDayAssignmentResult; droppedRatio: number } {
  const allAssignedIds = new Set<string>();
  let totalExpected = 0;
  let totalDropped = 0;

  const cleanedDays = result.days.map((day) => {
    const cap = maxPerDayByDayIndex[day.dayIndex - 1] ?? 3;
    totalExpected += cap + 2;

    const activities: string[] = [];
    for (const id of day.activities) {
      if (!validNonFoodIds.has(id))   { totalDropped++; continue; }
      if (allAssignedIds.has(id))     { totalDropped++; continue; }
      if (activities.length >= cap)   { totalDropped++; continue; }
      activities.push(id);
      allAssignedIds.add(id);
    }

    let lunch = day.lunch;
    if (lunch !== null) {
      if (!validFoodIds.has(lunch) || allAssignedIds.has(lunch)) {
        lunch = null;
        totalDropped++;
      } else {
        allAssignedIds.add(lunch);
      }
    }

    let dinner = day.dinner;
    if (dinner !== null) {
      if (!validFoodIds.has(dinner) || allAssignedIds.has(dinner)) {
        dinner = null;
        totalDropped++;
      } else {
        allAssignedIds.add(dinner);
      }
    }

    return { ...day, activities, lunch, dinner };
  });

  const droppedRatio =
    totalExpected > 0 ? totalDropped / totalExpected : 0;
  return { cleaned: { days: cleanedDays }, droppedRatio };
}

/**
 * Convert a validated holistic AI assignment into the per-day ScheduledActivity
 * map the downstream pipeline expects. Reuses nextSlotInBlock / getDayStructure /
 * getSplitSubgroupSchedulingBlocks so block boundaries and start/end times match
 * what assignActivitiesToDays would produce — only the day grouping comes from
 * the AI instead of the greedy fill.
 */
function applyHolisticAssignmentToNonFood(
  cleanedResult: HolisticDayAssignmentResult,
  candidatesByPlaceId: Map<string, RankedCandidate>,
  tripDays: number,
  dayStart: string,
  dayEnd: string,
  windowMode: AssignActivitiesWindowMode,
  weekdayProvider: WeekdayProvider = NULL_WEEKDAY_PROVIDER
): Map<number, ScheduledActivity[]> {
  const blocks =
    windowMode === "common_hours"
      ? getDayStructure(dayStart, dayEnd).blocks
      : getSplitSubgroupSchedulingBlocks(dayStart, dayEnd);

  const byDay = new Map<number, ScheduledActivity[]>();
  for (let d = 0; d < tripDays; d++) byDay.set(d, []);

  for (const day of cleanedResult.days) {
    const dayIdx = day.dayIndex - 1;
    const dayActivities: ScheduledActivity[] = [];
    const weekday = weekdayProvider(dayIdx);

    for (const placeId of day.activities) {
      const candidate = candidatesByPlaceId.get(placeId);
      if (!candidate) continue;
      // The AI may pick a venue that's actually closed on this weekday; drop it
      // here rather than show a wrongly-timed card. The legacy fallback path or
      // a later regen can reuse the venue on a different day.
      if (!isVenueOpenOnWeekday(candidate, weekday)) {
        if (itineraryDebugEnabled()) {
          // eslint-disable-next-line no-console
          console.log("[itinerary] holistic-nonfood skip — closed weekday", {
            day: dayIdx + 1,
            weekday,
            placeId: candidate.placeId,
            name: candidate.name,
          });
        }
        continue;
      }

      const duration = candidate.estimatedDuration ?? 120;
      let placed = false;
      for (const block of blocks) {
        const existing = dayActivities.filter(
          (a) => a.blockLabel === block.label
        );
        const subWindows = intersectBlockWithVenueWindows(
          block.start,
          block.end,
          candidate,
          weekday
        );
        for (const w of subWindows) {
          const slot = nextSlotInBlock(w.start, w.end, duration, existing);
          if (slot) {
            const endMin = timeToMinutes(slot) + duration;
            dayActivities.push({
              placeId: candidate.placeId,
              name: candidate.name,
              startTime: slot,
              endTime: minutesToTime(endMin),
              durationMinutes: duration,
              blockLabel: block.label,
              activity: candidate,
            });
            placed = true;
            break;
          }
        }
        if (placed) break;
      }
    }

    byDay.set(dayIdx, dayActivities);
  }

  return byDay;
}

/**
 * Convert validated AI lunch/dinner placeIds into the meal map the downstream
 * pipeline expects. Mirrors assignFoodActivitiesToMealSlots: reuses the day's
 * reserved lunch/dinner windows and MEAL_SLOT_MINUTES so meal times match the
 * deterministic slot layout — only the food choice comes from the AI.
 */
function applyHolisticAssignmentToFood(
  cleanedResult: HolisticDayAssignmentResult,
  candidatesByPlaceId: Map<string, RankedCandidate>,
  tripDays: number,
  dayStart: string,
  dayEnd: string,
  weekdayProvider: WeekdayProvider = NULL_WEEKDAY_PROVIDER
): Map<number, { lunch?: ScheduledActivity; dinner?: ScheduledActivity }> {
  const result = new Map<
    number,
    { lunch?: ScheduledActivity; dinner?: ScheduledActivity }
  >();
  for (let d = 0; d < tripDays; d++) result.set(d, {});

  const { lunch, dinner } = reserveMealSlotsForDay(dayStart, dayEnd);

  for (const day of cleanedResult.days) {
    const dayIdx = day.dayIndex - 1;
    const slot: { lunch?: ScheduledActivity; dinner?: ScheduledActivity } = {};
    const weekday = weekdayProvider(dayIdx);

    if (day.lunch) {
      const c = candidatesByPlaceId.get(day.lunch);
      // Only use the AI's pick if the venue is open during the lunch window on
      // this weekday; otherwise leave the slot empty so the fallback picker can
      // try again from the broader food pool.
      if (
        c &&
        intersectBlockWithVenueWindows(lunch.startTime, lunch.endTime, c, weekday).length > 0
      ) {
        slot.lunch = {
          placeId: c.placeId,
          name: c.name,
          startTime: lunch.startTime,
          endTime: lunch.endTime,
          durationMinutes: MEAL_SLOT_MINUTES,
          blockLabel: "lunch",
          activity: c,
        };
      }
    }

    if (day.dinner) {
      const c = candidatesByPlaceId.get(day.dinner);
      if (
        c &&
        intersectBlockWithVenueWindows(dinner.startTime, dinner.endTime, c, weekday).length > 0
      ) {
        slot.dinner = {
          placeId: c.placeId,
          name: c.name,
          startTime: dinner.startTime,
          endTime: dinner.endTime,
          durationMinutes: MEAL_SLOT_MINUTES,
          blockLabel: "dinner",
          activity: c,
        };
      }
    }

    result.set(dayIdx, slot);
  }

  return result;
}

/**
 * Generate full itinerary: load candidates, re-rank by votes, split majority-downvoted
 * places into group vs member-split pools, optionally AI gap-fill for the group pool,
 * then split food vs non-food and assign to days with blocks and meal slots.
 */
export async function generateItinerary(tripId: string): Promise<Itinerary | null> {
  const trip = getTripById(tripId);
  const profile = generateGroupPlanningProfile(tripId);
  if (!trip || !profile) return null;

  const candidates = await getRankedVoteCandidates(tripId);
  if (candidates.length === 0) return null;

  const voteRanked = rankActivitiesFromVotes(candidates, tripId);

  const tripDays = Math.max(1, trip.tripDays ?? 3);
  // Map dayIndex (0-based here) → JS weekday using the trip's stored start date
  // (legacy trips without a start date opt out and weekday-aware filtering is a no-op).
  const weekdayProvider: WeekdayProvider = (dayIdx0: number) =>
    weekdayForDayIndex(trip.startDate, dayIdx0 + 1);
  let dayStart = profile.commonActiveHours?.start ?? "09:00";
  let dayEnd = profile.commonActiveHours?.end ?? "21:00";
  if (timeToMinutes(dayStart) >= timeToMinutes(dayEnd)) {
    if (itineraryDebugEnabled()) {
      // eslint-disable-next-line no-console
      console.warn("[itinerary] invalid commonActiveHours (empty overlap?), using 09:00–21:00", {
        tripId,
        was: { dayStart, dayEnd },
      });
    }
    dayStart = "09:00";
    dayEnd = "21:00";
  }
  const energyLevel = (profile.groupEnergyLevel ?? "medium").toLowerCase() as "low" | "medium" | "high";

  const { groupCandidates: groupPartitioned, splitCandidates, removedPlaceIds } =
    partitionVoteCandidatesForItinerary(voteRanked, tripId, profile);

  const splitPlan = await evaluateSplitGroupPlan(tripId, groupPartitioned, splitCandidates, profile);
  const splitExists = splitPlanUsesSubgroupWindows(splitPlan);

  let schedulingPool = [...groupPartitioned, ...splitCandidates];
  if (schedulingPool.length === 0) return null;

  let dailyCapacity = await evaluateDailyCapacity(profile, tripDays, schedulingPool, splitExists);
  let minNonFoodSlots = Math.max(1, totalNonMealSlotsAcrossTrip(dailyCapacity, tripDays));

  const groupCandidates = await ensureGroupNonFoodPoolMeetsDays({
    tripId,
    groupCandidates: groupPartitioned,
    minNonFoodSlots,
    removedPlaceIds,
    rankedCandidates: candidates,
  });

  if (groupCandidates.length !== groupPartitioned.length) {
    schedulingPool = [...groupCandidates, ...splitCandidates];
    dailyCapacity = await evaluateDailyCapacity(profile, tripDays, schedulingPool, splitExists);
    minNonFoodSlots = Math.max(1, totalNonMealSlotsAcrossTrip(dailyCapacity, tripDays));
  } else {
    schedulingPool = [...groupCandidates, ...splitCandidates];
  }


  if (itineraryDebugEnabled()) {
    // eslint-disable-next-line no-console
    console.log("[itinerary] daily non-meal capacity", {
      tripId,
      tripDays,
      source: dailyCapacity.source,
      maxActivitiesPerDay: dailyCapacity.maxActivitiesPerDay,
      dayVariance: dailyCapacity.dayVariance,
      maxPerDay: dailyCapacity.maxPerDayByDayIndex,
      minNonFoodSlots,
      reasoning: dailyCapacity.reasoning,
    });
    // eslint-disable-next-line no-console
    console.log(
      "[itinerary] food classification snapshot",
      schedulingPool.map((a) => ({
        placeId: a.placeId,
        name: a.name,
        primaryCategory: getPrimaryCategory(a),
        classifiedAsFood: isFoodActivity(a),
      }))
    );
    // eslint-disable-next-line no-console
    console.log("[itinerary] vote trim: group vs split pools", {
      tripId,
      groupCount: groupCandidates.length,
      splitCount: splitCandidates.length,
      removedMajorityDown: removedPlaceIds.length,
      aiGapFilled: groupCandidates.length - groupPartitioned.length,
      splitPlanNeedsSplit: splitPlan.needsSplit,
    });
    // eslint-disable-next-line no-console
    console.log(
      "[itinerary] scheduling pool (group then split)",
      schedulingPool.map((a, idx) => ({
        index: idx + 1,
        placeId: a.placeId,
        name: a.name,
        excludedFromGroup: a.excludedFromGroup ?? false,
      }))
    );
  }

  let foodActivities = schedulingPool.filter(isFoodActivity);
  foodActivities = await expandFoodActivitiesWithAiMealGap({
    destination: profile.destination,
    profile,
    tripDays,
    foodActivities,
  });
  let nonFoodActivities = schedulingPool.filter((a) => !isFoodActivity(a));

  if (itineraryDebugEnabled()) {
    // eslint-disable-next-line no-console
    console.log("[itinerary] meal pipeline split", {
      tripId,
      schedulingPool: schedulingPool.length,
      foodPlaces: foodActivities.length,
      nonFoodPlaces: nonFoodActivities.length,
      note:
        foodActivities.length === 0
          ? "No food in voted list — lunch/dinner depend on Places restaurant search (API key + searchText must work)."
          : "Food from votes fills some meal slots; empty slots use restaurant search.",
    });
  }

  const splitClaimedIds = splitPlanUsesSubgroupWindows(splitPlan)
    ? new Set(
        splitPlan.splitGroups.flatMap((sg) => sg.activities ?? [])
      )
    : new Set<string>();

  const groupNonFood = nonFoodActivities.filter(
    (a) => !splitClaimedIds.has(a.placeId)
  );

  const allCandidatesByPlaceId = new Map(
    schedulingPool.map((a) => [a.placeId, a])
  );

  const holisticInput: HolisticDayAssignmentInput = {
    tripId,
    tripDays,
    destination: profile.destination,
    groupProfile: {
      energyLevel: energyLevel,
      activeHours: { start: dayStart, end: dayEnd },
      budgetLevel: profile.groupBudgetLevel ?? "moderate",
      planningStyleVariance: profile.groupPlanningStyleVariance,
      splitComfort: profile.groupSplitComfort,
    },
    memberPersonalities: profile.memberPersonalities,
    maxPerDayByDayIndex: dailyCapacity.maxPerDayByDayIndex,
    nonFoodCandidates: groupNonFood.map((c) => ({
      placeId: c.placeId,
      name: c.name,
      category: getPrimaryCategory(c),
      intensity: c.intensity ?? null,
      durationMinutes: c.estimatedDuration ?? 120,
      location: c.location ?? null,
      voteScore:
        (c as RankedCandidate & { voteScore?: number }).voteScore ?? 0,
    })),
    foodCandidates: foodActivities.map((c) => ({
      placeId: c.placeId,
      name: c.name,
      category: getPrimaryCategory(c),
      location: c.location ?? null,
    })),
  };

  const validNonFoodIds = new Set(groupNonFood.map((a) => a.placeId));
  const validFoodIds = new Set(foodActivities.map((a) => a.placeId));

  let holisticResult: HolisticDayAssignmentResult | null = null;

  for (let attempt = 0; attempt <= 1; attempt++) {
    const raw = await fetchHolisticDayAssignment(holisticInput, tripDays);
    if (!raw) break;

    const { cleaned, droppedRatio } = validateHolisticAssignment(
      raw,
      validNonFoodIds,
      validFoodIds,
      dailyCapacity.maxPerDayByDayIndex
    );

    if (droppedRatio <= 0.3) {
      holisticResult = cleaned;
      break;
    }

    if (attempt < 1) {
      holisticInput.validationErrors = raw.days.flatMap((day) =>
        day.activities
          .filter((id) => !validNonFoodIds.has(id))
          .map((id) => ({
            dayIndex: day.dayIndex,
            type: "unknown_placeId" as const,
            placeId: id,
          }))
      );
    }
  }

  let nonFoodByDay: Map<number, ScheduledActivity[]>;
  let foodByDay: Map<number, { lunch?: ScheduledActivity; dinner?: ScheduledActivity }>;

  if (holisticResult) {
    nonFoodByDay = applyHolisticAssignmentToNonFood(
      holisticResult,
      allCandidatesByPlaceId,
      tripDays,
      dayStart,
      dayEnd,
      "common_hours",
      weekdayProvider
    );
    foodByDay = applyHolisticAssignmentToFood(
      holisticResult,
      allCandidatesByPlaceId,
      tripDays,
      dayStart,
      dayEnd,
      weekdayProvider
    );
  } else {
    const { clusters, noLocation } =
      clusterActivitiesByLocation(nonFoodActivities);
    const byPlaceId = new Map(nonFoodActivities.map((a) => [a.placeId, a]));
    const ordered: RankedCandidate[] = [];
    for (const placeIds of clusters) {
      for (const id of placeIds) {
        const a = byPlaceId.get(id);
        if (a) ordered.push(a);
      }
    }
    for (const id of noLocation) {
      const a = byPlaceId.get(id);
      if (a) ordered.push(a);
    }
    const nonFoodOrdered =
      ordered.length > 0 ? ordered : nonFoodActivities;
    nonFoodByDay = assignActivitiesToDays(
      nonFoodOrdered,
      tripDays,
      { start: dayStart, end: dayEnd },
      dailyCapacity.maxPerDayByDayIndex,
      "common_hours",
      weekdayProvider
    );
    foodByDay = assignFoodActivitiesToMealSlots(
      foodActivities,
      nonFoodByDay,
      tripDays,
      dayStart,
      dayEnd,
      weekdayProvider
    );
  }

  if (splitPlanUsesSubgroupWindows(splitPlan)) {
    const sp = splitPlan;
    const displayBlockDefs = getDayStructure(dayStart, dayEnd).blocks;
    const assignedPlaceIds = new Set<string>(
      [...nonFoodByDay.values()].flatMap((acts) => acts.map((a) => a.placeId))
    );

    const mergeMaps = (m: Map<number, ScheduledActivity[]>) => {
      for (let d = 0; d < tripDays; d++) {
        const add = m.get(d) ?? [];
        if (add.length === 0) continue;
        const cur = nonFoodByDay.get(d) ?? [];
        cur.push(...add);
        nonFoodByDay.set(d, cur);
        for (const a of add) assignedPlaceIds.add(a.placeId);
      }
    };

    for (const sg of sp.splitGroups) {
      const tw = sg.timeWindow;
      const wStart =
        typeof tw?.start === "string" && tw.start.trim()
          ? tw.start.trim()
          : dayStart;
      const wEnd =
        typeof tw?.end === "string" && tw.end.trim()
          ? tw.end.trim()
          : dayEnd;
      if (timeToMinutes(wEnd) <= timeToMinutes(wStart)) continue;

      const splitActs = nonFoodActivities.filter((a) =>
        (sg.activities ?? []).includes(a.placeId)
      );
      if (splitActs.length === 0) continue;

      mergeMaps(
        assignActivitiesToDays(
          splitActs,
          tripDays,
          { start: wStart, end: wEnd },
          dailyCapacity.maxPerDayByDayIndex,
          "split_subgroup",
          weekdayProvider,
          // Treat group activities already on the day as occupied time so a
          // subgroup window can't independently claim a slot they already use.
          nonFoodByDay
        )
      );
    }

    const orphanNonFood = nonFoodActivities.filter(
      (a) => !assignedPlaceIds.has(a.placeId)
    );
    if (orphanNonFood.length > 0) {
      mergeMaps(
        assignActivitiesToDays(
          orphanNonFood,
          tripDays,
          { start: dayStart, end: dayEnd },
          dailyCapacity.maxPerDayByDayIndex,
          "common_hours",
          weekdayProvider,
          // Same reasoning as above: orphan non-food items must dodge whatever
          // group + split activities are already on the day.
          nonFoodByDay
        )
      );
    }

    for (let d = 0; d < tripDays; d++) {
      const list = keepCommonActivitiesOutsideSplitWindows(
        nonFoodByDay.get(d) ?? [],
        sp,
        dayStart,
        dayEnd,
        weekdayProvider(d)
      );
      list.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
      for (const a of list) {
        a.blockLabel = inferBlockLabelForCommonDay(a.startTime, displayBlockDefs);
      }
      nonFoodByDay.set(d, list);
    }

    foodActivities = applySplitGroupPreferredMealWindows(foodActivities, sp);

    const fallbackFood = assignFoodActivitiesToMealSlots(
      foodActivities,
      nonFoodByDay,
      tripDays,
      dayStart,
      dayEnd,
      weekdayProvider
    );
    for (let d = 0; d < tripDays; d++) {
      const existing = foodByDay.get(d) ?? {};
      const fallback = fallbackFood.get(d) ?? {};
      foodByDay.set(d, {
        lunch: existing.lunch ?? fallback.lunch,
        dinner: existing.dinner ?? fallback.dinner,
      });
    }
  }

  if (holisticResult && !splitPlanUsesSubgroupWindows(splitPlan)) {
    const fallbackFood = assignFoodActivitiesToMealSlots(
      foodActivities,
      nonFoodByDay,
      tripDays,
      dayStart,
      dayEnd,
      weekdayProvider
    );
    for (let d = 0; d < tripDays; d++) {
      const existing = foodByDay.get(d) ?? {};
      const fallback = fallbackFood.get(d) ?? {};
      foodByDay.set(d, {
        lunch: existing.lunch ?? fallback.lunch,
        dinner: existing.dinner ?? fallback.dinner,
      });
    }
  }

  const structure = getDayStructure(dayStart, dayEnd);
  const days: ItineraryDay[] = [];

  for (let i = 0; i < tripDays; i++) {
    const dayNonFood = nonFoodByDay.get(i) ?? [];
    const dayFood = foodByDay.get(i) ?? {};
    const blocks: ItineraryBlock[] = structure.blocks.map((b) => ({
      label: b.label,
      startTime: b.start,
      endTime: b.end,
      activities: dayNonFood.filter((a) => a.blockLabel === b.label),
    }));
    days.push({
      dayIndex: i + 1,
      startTime: dayStart,
      endTime: dayEnd,
      blocks,
      lunchSlot: { ...structure.lunch, activity: dayFood.lunch },
      dinnerSlot: { ...structure.dinner, activity: dayFood.dinner },
      energyLevel,
      maxNonMealActivities: dailyCapacity.maxPerDayByDayIndex[i] ?? dailyCapacity.maxActivitiesPerDay,
    });
  }

  const votes = getVotesByTripId(tripId);
  const members = getTripMembers(tripId);
  const memberPrefs = getMemberPreferencesByTripId(tripId);
  const scheduledPayload = buildScheduledDaysForSchedulerPayload(tripId, days, votes, members);
  const groupPayload = buildSchedulerGroupContextPayload({
    tripId,
    profile,
    splitPlan,
    dailyCapacityReasoning: dailyCapacity.reasoning,
    members,
    memberPreferences: memberPrefs,
    candidatesBrief: candidatesBriefFromPool(schedulingPool),
  });

  const personalityPromptAppendix = buildItinerarySchedulerPersonalityPromptSection(profile);

  const insights = await fetchItinerarySchedulerDayInsights({
    tripDays,
    tripName: trip.name,
    destination: profile.destination,
    groupContext: groupPayload,
    scheduledDays: scheduledPayload,
    personalityPromptAppendix,
  });

  let finalDays = days;
  if (insights && insights.length === tripDays) {
    const byNum = new Map(insights.map((x) => [x.dayNumber, x]));
    finalDays = days.map((d) => {
      const ins = byNum.get(d.dayIndex);
      if (!ins) return d;
      return {
        ...d,
        dayTheme: ins.theme,
        dayReasoning: ins.dayReasoning,
      };
    });
  }

  return {
    tripId,
    days: finalDays,
    splitPlan,
  };
}

const ITINERARY_STORAGE_KEY = "tripItineraries";

function getItinerariesStorage(): Itinerary[] {
  try {
    const raw = localStorage.getItem(ITINERARY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setItinerariesStorage(list: Itinerary[]) {
  localStorage.setItem(ITINERARY_STORAGE_KEY, JSON.stringify(list));
}

/**
 * Merge itinerary from cloud when newer than local (by updatedAt / savedAt ISO).
 * Does not push to cloud (avoids loops). Returns true if local storage was updated.
 */
export function mergeItineraryFromCloudIfNewer(incoming: Itinerary): boolean {
  const local = getItinerary(incoming.tripId);
  const inT = incoming.updatedAt ?? incoming.savedAt ?? "";
  const loT = local?.updatedAt ?? local?.savedAt ?? "";
  if (!local) {
    const list = getItinerariesStorage().filter((i) => i.tripId !== incoming.tripId);
    list.push(incoming);
    setItinerariesStorage(list);
    return true;
  }
  if (inT && (!loT || inT > loT)) {
    const list = getItinerariesStorage().filter((i) => i.tripId !== incoming.tripId);
    list.push(incoming);
    setItinerariesStorage(list);
    return true;
  }
  return false;
}

/**
 * Persist computed inter-stop transit on the itinerary (local + cloud when enabled).
 * Skips if snapshot for this layout is already stored.
 */
export function upsertItineraryTransitSnapshot(args: {
  tripId: string;
  layoutFingerprint: string;
  transitByDay: Record<number, TransitInfo[]>;
  adjustedStartByDay: Record<number, string[]>;
}): void {
  const it = getItinerary(args.tripId);
  if (!it) return;
  if (it.transitSnapshot?.layoutFingerprint === args.layoutFingerprint) return;

  const transitByDay: Record<string, ItineraryTransitLeg[]> = {};
  for (const [k, v] of Object.entries(args.transitByDay)) {
    transitByDay[String(k)] = v.map((leg) => ({
      minutes: leg.minutes,
      method: leg.method,
      source: leg.source,
    }));
  }
  const adjustedStartByDay: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(args.adjustedStartByDay)) {
    adjustedStartByDay[String(k)] = v;
  }
  const transitSnapshot: ItineraryTransitSnapshot = {
    layoutFingerprint: args.layoutFingerprint,
    transitByDay,
    adjustedStartByDay,
  };
  saveItinerary({ ...it, transitSnapshot });
}

/**
 * Save generated itinerary for a trip (overwrites existing for that tripId).
 */
export function saveItinerary(itinerary: Itinerary): void {
  const now = new Date().toISOString();
  const list = getItinerariesStorage().filter((i) => i.tripId !== itinerary.tripId);
  const withMeta: Itinerary = {
    ...itinerary,
    savedAt: itinerary.savedAt ?? now,
    updatedAt: now,
  };
  list.push(withMeta);
  setItinerariesStorage(list);

  if (isItineraryCloudEnabled()) {
    void cloudUpsertTripItinerary(withMeta);
  }
}

/**
 * Get itinerary for a trip if it exists.
 */
export function getItinerary(tripId: string): Itinerary | null {
  return getItinerariesStorage().find((i) => i.tripId === tripId) ?? null;
}
