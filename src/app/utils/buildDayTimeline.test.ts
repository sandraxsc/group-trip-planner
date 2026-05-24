import { describe, expect, it } from "vitest";
import { buildDayTimeline, extractDaySlots } from "./buildDayTimeline";
import type { ItineraryDay } from "../../types/itinerary";
import type { CandidateActivity } from "../../types/activity";
import type { DisplayDayEvent } from "./itineraryToDisplayDays";

function mockCandidate(placeId: string, name: string): CandidateActivity {
  return {
    placeId,
    name,
    categories: [],
    estimatedDuration: 120,
    costLevel: "medium",
    intensity: "medium",
    suitableTime: ["morning"],
    source: "user_selected",
  };
}

function mockEvent(id: string, time: string, title: string): DisplayDayEvent {
  return {
    id,
    time,
    title,
    type: "🏛️ Culture",
    categoryColor: "#FFD700",
    categoryBg: "#FFF8DC",
    duration: "2 hrs",
    durationMinutes: 120,
    cost: "$$",
    votes: 0,
    image: null,
  };
}

function mockDay(slots: Array<{ placeId: string; start: string; end: string }>): ItineraryDay {
  return {
    dayIndex: 1,
    startTime: "09:00",
    endTime: "21:00",
    energyLevel: "medium",
    maxNonMealActivities: 3,
    blocks: [
      {
        label: "morning",
        startTime: "09:00",
        endTime: "12:00",
        activities: slots.map((s) => ({
          placeId: s.placeId,
          name: s.placeId,
          startTime: s.start,
          endTime: s.end,
          durationMinutes: 120,
          blockLabel: "morning" as const,
          activity: mockCandidate(s.placeId, s.placeId),
        })),
      },
    ],
    lunchSlot: { label: "lunch", startTime: "12:00", endTime: "13:00" },
    dinnerSlot: { label: "dinner", startTime: "18:00", endTime: "19:00" },
  };
}

describe("buildDayTimeline", () => {
  it("returns solo rows when no split plan", () => {
    const events = [mockEvent("a", "9:00 AM", "Museum")];
    const { rows, hasSplit } = buildDayTimeline({ events });
    expect(hasSplit).toBe(false);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe("solo");
  });

  it("orders group activity before split at same time", () => {
    const day = mockDay([
      { placeId: "group", start: "09:00", end: "10:00" },
      { placeId: "hike", start: "09:00", end: "12:00" },
      { placeId: "shop", start: "09:00", end: "12:00" },
      { placeId: "lunch", start: "12:30", end: "13:30" },
    ]);
    day.lunchSlot.activity = {
      placeId: "lunch",
      name: "Lunch",
      startTime: "12:30",
      endTime: "13:30",
      durationMinutes: 60,
      blockLabel: "lunch",
      activity: mockCandidate("lunch", "Lunch"),
    };
    const events = [
      mockEvent("group", "9:00 AM", "Together"),
      mockEvent("hike", "9:00 AM", "Hike"),
      mockEvent("shop", "9:00 AM", "Shop"),
      mockEvent("lunch-lunch", "12:30 PM", "Lunch"),
    ];
    const { rows, hasSplit } = buildDayTimeline({
      events,
      itineraryDay: day,
      splitPlan: {
        needsSplit: true,
        splitDays: 1,
        groupActivities: ["group"],
        splitGroups: [
          {
            memberIds: ["m1"],
            activities: ["hike"],
            timeWindow: { start: "09:00", end: "12:00" },
          },
          {
            memberIds: ["m2"],
            activities: ["shop"],
            timeWindow: { start: "09:00", end: "12:00" },
          },
        ],
        reasoning: "test",
        personalityInfluenced: false,
      },
    });
    expect(hasSplit).toBe(true);
    const kinds = rows.map((r) => r.kind);
    expect(kinds.indexOf("solo")).toBeLessThan(kinds.indexOf("split"));
    const groupSolo = rows.find((r) => r.kind === "solo" && r.event.id === "group");
    expect(groupSolo && groupSolo.kind === "solo" && groupSolo.allTogether).toBe(true);
    expect(kinds).toContain("reunion");
    expect(kinds.indexOf("reunion")).toBeLessThan(kinds.lastIndexOf("solo"));
  });

  it("places reunion before post-split together activity at split end", () => {
    const day = mockDay([
      { placeId: "hike", start: "09:00", end: "12:00" },
      { placeId: "shop", start: "09:00", end: "12:00" },
      { placeId: "group", start: "12:00", end: "13:00" },
    ]);
    const events = [
      mockEvent("hike", "9:00 AM", "Hike"),
      mockEvent("shop", "9:00 AM", "Shop"),
      mockEvent("group", "12:00 PM", "Lunch together"),
    ];
    const { rows } = buildDayTimeline({
      events,
      itineraryDay: day,
      splitPlan: {
        needsSplit: true,
        splitDays: 1,
        groupActivities: ["group"],
        splitGroups: [
          {
            memberIds: ["m1"],
            activities: ["hike"],
            timeWindow: { start: "09:00", end: "12:00" },
          },
          {
            memberIds: ["m2"],
            activities: ["shop"],
            timeWindow: { start: "09:00", end: "12:00" },
          },
        ],
        reasoning: "test",
        personalityInfluenced: false,
      },
    });
    const kinds = rows.map((r) => r.kind);
    const reunionIdx = kinds.indexOf("reunion");
    const togetherIdx = rows.findIndex(
      (r) => r.kind === "solo" && r.event.id === "group"
    );
    expect(reunionIdx).toBeGreaterThanOrEqual(0);
    expect(togetherIdx).toBeGreaterThan(reunionIdx);
  });

  it("extractDaySlots includes lunch", () => {
    const day = mockDay([]);
    day.lunchSlot.activity = {
      placeId: "cafe",
      name: "Cafe",
      startTime: "12:00",
      endTime: "13:00",
      durationMinutes: 60,
      blockLabel: "lunch",
      activity: mockCandidate("cafe", "Cafe"),
    };
    const slots = extractDaySlots(day);
    expect(slots.some((s) => s.eventId === "cafe-lunch")).toBe(true);
  });
});
