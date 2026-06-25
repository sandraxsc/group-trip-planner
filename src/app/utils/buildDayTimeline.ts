import type { DisplayDayEvent } from "./itineraryToDisplayDays";
import type { ItineraryDay } from "../../types/itinerary";
import type { SplitGroupPlanEvaluation } from "../../types/splitGroupPlan";
import { timeToMinutes } from "../../utils/timeUtils";

export type DaySlot = {
  placeId: string;
  startTime: string;
  endTime: string;
  type: "activity" | "meal";
  eventId: string;
};

export type SplitTimelineCard = {
  groupIndex: number;
  memberIds: string[];
  placeId: string | null;
  event: DisplayDayEvent | null;
  eventIndex: number;
  title: string;
  typeLabel: string;
  categoryColor: string;
  categoryBg: string;
  windowStart: string;
  windowEnd: string;
};

export type TimelineRow =
  | {
      kind: "solo";
      sortMinutes: number;
      timeLabel: string;
      event: DisplayDayEvent;
      eventIndex: number;
      allTogether: boolean;
    }
  | {
      kind: "split";
      sortMinutes: number;
      timeLabel: string;
      left: SplitTimelineCard;
      right: SplitTimelineCard;
      samePlace: boolean;
    }
  | {
      kind: "reunion";
      sortMinutes: number;
    };

/** Group activity at/before split start — renders above the split row. */
const SORT_GROUP_SOLO_BEFORE_SPLIT = 0;
/** Reunion marker — immediately before the next together / solo stop. */
const SORT_REUNION = 1;
const SORT_SOLO = 2;
const SORT_SPLIT = 3;

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd);
}

export function formatHhmmForDisplay(hhmm: string): string {
  const [hRaw, mRaw] = hhmm.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw ?? 0);
  if (h === 0 && m === 0) return "12:00 AM";
  if (h < 12) return `${h}:${String(m).padStart(2, "0")} AM`;
  if (h === 12) return `12:${String(m).padStart(2, "0")} PM`;
  return `${h - 12}:${String(m).padStart(2, "0")} PM`;
}

export function formatWindowChip(start: string, end: string): string {
  return `${start} – ${end}`;
}

export function extractDaySlots(day: ItineraryDay): DaySlot[] {
  const slots: DaySlot[] = [];
  for (const block of day.blocks) {
    for (const sa of block.activities) {
      slots.push({
        placeId: sa.placeId,
        startTime: sa.startTime,
        endTime: sa.endTime,
        type: "activity",
        eventId: sa.placeId,
      });
    }
  }
  if (day.lunchSlot.activity) {
    const sa = day.lunchSlot.activity;
    slots.push({
      placeId: sa.placeId,
      startTime: sa.startTime,
      endTime: sa.endTime,
      type: "meal",
      eventId: `${sa.placeId}-lunch`,
    });
  }
  if (day.dinnerSlot.activity) {
    const sa = day.dinnerSlot.activity;
    slots.push({
      placeId: sa.placeId,
      startTime: sa.startTime,
      endTime: sa.endTime,
      type: "meal",
      eventId: `${sa.placeId}-dinner`,
    });
  }
  return slots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

function resolveEvent(
  slot: DaySlot | undefined,
  events: DisplayDayEvent[]
): { event: DisplayDayEvent; index: number } | null {
  if (!slot) return null;
  const idx = events.findIndex((e) => e.id === slot.eventId || e.id === slot.placeId);
  if (idx < 0) return null;
  return { event: events[idx]!, index: idx };
}

function cardFromGroup(
  groupIndex: number,
  sg: { memberIds: string[]; activities: string[]; timeWindow: { start: string; end: string } },
  slot: DaySlot | undefined,
  events: DisplayDayEvent[]
): SplitTimelineCard {
  const resolved = resolveEvent(slot, events);
  const placeId = slot?.placeId ?? sg.activities[0] ?? null;
  const event = resolved?.event ?? null;
  return {
    groupIndex,
    memberIds: sg.memberIds ?? [],
    placeId,
    event,
    eventIndex: resolved?.index ?? -1,
    title: event?.title ?? "Activity",
    typeLabel: event?.type ?? "✨ Activity",
    categoryColor: event?.categoryColor ?? "#AFAFAF",
    categoryBg: event?.categoryBg ?? "#F7F7F7",
    windowStart: sg.timeWindow.start,
    windowEnd: sg.timeWindow.end,
  };
}

type SortableItem = TimelineRow & { sortTier: number };

function splitPlanActive(
  splitPlan: SplitGroupPlanEvaluation | undefined
): splitPlan is Extract<SplitGroupPlanEvaluation, { needsSplit: true }> {
  return (
    !!splitPlan &&
    splitPlan.needsSplit === true &&
    Array.isArray(splitPlan.splitGroups) &&
    splitPlan.splitGroups.length >= 1
  );
}

/**
 * Build chronological timeline rows for a day (solo, split columns, reunion markers).
 */
export function buildDayTimeline(args: {
  events: DisplayDayEvent[];
  itineraryDay?: ItineraryDay;
  splitPlan?: SplitGroupPlanEvaluation;
}): { rows: TimelineRow[]; hasSplit: boolean } {
  const { events, itineraryDay, splitPlan } = args;

  if (!splitPlanActive(splitPlan)) {
    return {
      hasSplit: false,
      rows: events.map((event, eventIndex) => ({
        kind: "solo" as const,
        sortMinutes: displayTimeToMinutes(event.time),
        timeLabel: event.time,
        event,
        eventIndex,
        allTogether: false,
      })),
    };
  }

  const daySlots = itineraryDay ? extractDaySlots(itineraryDay) : [];
  const splitGroups = splitPlan.splitGroups;
  const splitClaimed = new Set(splitGroups.flatMap((g) => g.activities ?? []));
  const groupIds = new Set(splitPlan.groupActivities ?? []);

  const items: SortableItem[] = [];
  const earliestSplitStart = Math.min(
    ...splitGroups.map((sg) => timeToMinutes(sg.timeWindow.start))
  );

  for (const slot of daySlots) {
    if (splitClaimed.has(slot.placeId)) continue;
    const resolved = resolveEvent(slot, events);
    if (!resolved) continue;
    const overlapsSplit = splitGroups.some((sg) =>
      rangesOverlap(slot.startTime, slot.endTime, sg.timeWindow.start, sg.timeWindow.end)
    );
    const allTogether = groupIds.has(slot.placeId) && overlapsSplit;
    const beforeSplitGroup =
      allTogether && timeToMinutes(slot.startTime) <= earliestSplitStart;
    items.push({
      kind: "solo",
      sortMinutes: timeToMinutes(slot.startTime),
      timeLabel: formatHhmmForDisplay(slot.startTime),
      event: resolved.event,
      eventIndex: resolved.index,
      allTogether,
      sortTier: beforeSplitGroup ? SORT_GROUP_SOLO_BEFORE_SPLIT : SORT_SOLO,
    });
  }

  if (daySlots.length === 0) {
    for (let eventIndex = 0; eventIndex < events.length; eventIndex++) {
      const event = events[eventIndex]!;
      const basePlaceId = event.id.replace(/-(lunch|dinner)$/, "");
      if (splitClaimed.has(basePlaceId)) continue;
      items.push({
        kind: "solo",
        sortMinutes: displayTimeToMinutes(event.time),
        timeLabel: event.time,
        event,
        eventIndex,
        allTogether: groupIds.has(basePlaceId),
        sortTier: SORT_SOLO,
      });
    }
  }

  const splitStarts = new Map<number, boolean>();
  for (const sg of splitGroups) {
    const startMin = timeToMinutes(sg.timeWindow.start);
    const hasToday = daySlots.some((s) => (sg.activities ?? []).includes(s.placeId));
    if (!hasToday) continue;
    splitStarts.set(startMin, true);
  }

  const sortedSplitStarts = [...splitStarts.keys()].sort((a, b) => a - b);
  for (const startMin of sortedSplitStarts) {
    const g0 = splitGroups[0]!;
    const g1 = splitGroups[1] ?? splitGroups[0]!;
    const leftSlot = daySlots.find((s) => (g0.activities ?? []).includes(s.placeId));
    const rightSlot = daySlots.find((s) => (g1.activities ?? []).includes(s.placeId));
    const left = cardFromGroup(0, g0, leftSlot, events);
    const right = cardFromGroup(1, g1, rightSlot, events);
    const samePlace = Boolean(left.placeId && right.placeId && left.placeId === right.placeId);

    if (samePlace && left.event) {
      // Both groups assigned to the same place — show as a regular together stop.
      items.push({
        kind: "solo",
        sortMinutes: startMin,
        timeLabel: formatHhmmForDisplay(g0.timeWindow.start),
        event: left.event,
        eventIndex: left.eventIndex,
        allTogether: true,
        sortTier: SORT_SPLIT,
      });
    } else {
      items.push({
        kind: "split",
        sortMinutes: startMin,
        timeLabel: formatHhmmForDisplay(g0.timeWindow.start),
        left,
        right,
        samePlace,
        sortTier: SORT_SPLIT,
      });

      const endMin = Math.max(
        timeToMinutes(g0.timeWindow.end),
        timeToMinutes(g1.timeWindow.end)
      );
      if (endMin > startMin) {
        items.push({
          kind: "reunion",
          sortMinutes: endMin,
          sortTier: SORT_REUNION,
        });
      }
    }
  }

  items.sort((a, b) => {
    if (a.sortMinutes !== b.sortMinutes) return a.sortMinutes - b.sortMinutes;
    return a.sortTier - b.sortTier;
  });

  const rows: TimelineRow[] = items.map(({ sortTier: _t, ...row }) => row);
  const hasSplit = rows.some((r) => r.kind === "split");
  return { rows, hasSplit };
}

function displayTimeToMinutes(label: string): number {
  if (!label?.trim() || label === "--") return 9 * 60;
  const [timePart, periodRaw] = label.split(" ");
  const period = periodRaw?.toUpperCase() ?? "AM";
  const [hRaw, mRaw] = (timePart ?? "00:00").split(":");
  let h = Number(hRaw);
  const m = Number(mRaw);
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

export function dayHasSplitTimeline(
  itineraryDay: ItineraryDay | undefined,
  splitPlan: SplitGroupPlanEvaluation | undefined
): boolean {
  if (!splitPlanActive(splitPlan) || !itineraryDay) return false;
  const claimed = new Set(splitPlan.splitGroups.flatMap((g) => g.activities ?? []));
  const slots = extractDaySlots(itineraryDay);
  return slots.some((s) => claimed.has(s.placeId));
}
