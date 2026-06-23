import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Trip, TripMember } from "../types/trip";
import type { Itinerary } from "../types/itinerary";
import { getTripPlanningProgressPercent } from "./tripPlanningProgress";

vi.mock("../services/itineraryCloudStore", () => ({
  hasCachedActiveItinerary: vi.fn(() => false),
  getCachedActiveItinerary: vi.fn(() => null),
}));

import {
  hasCachedActiveItinerary,
  getCachedActiveItinerary,
} from "../services/itineraryCloudStore";

const trip: Trip = {
  id: "t1",
  name: "Test",
  destination: "X",
  maxGuests: 2,
  createdAt: new Date().toISOString(),
  isOutdated: false,
  regenCount: 0,
};

function member(overrides: Partial<TripMember> = {}): TripMember {
  return {
    id: "m1",
    tripId: "t1",
    name: "A",
    joinedAt: new Date().toISOString(),
    role: "owner",
    preferenceStatus: "not_started",
    ...overrides,
  };
}

const draftItinerary: Itinerary = {
  tripId: "t1",
  days: [],
  isCommitted: false,
};

const committedItinerary: Itinerary = {
  tripId: "t1",
  days: [],
  isCommitted: true,
};

describe("getTripPlanningProgressPercent", () => {
  beforeEach(() => {
    vi.mocked(hasCachedActiveItinerary).mockReturnValue(false);
    vi.mocked(getCachedActiveItinerary).mockReturnValue(null);
  });

  it("is 0% with no members", () => {
    expect(getTripPlanningProgressPercent(trip, [])).toBe(0);
  });

  it("is 25% when invite capacity is met", () => {
    const members = [
      member({ id: "m1" }),
      member({ id: "m2", role: "member", name: "B" }),
    ];
    expect(getTripPlanningProgressPercent(trip, members)).toBe(25);
  });

  it("is 50% when invite + all preferences complete", () => {
    const members = [
      member({ id: "m1", preferenceStatus: "completed" }),
      member({
        id: "m2",
        role: "member",
        name: "B",
        preferenceStatus: "completed",
      }),
    ];
    expect(getTripPlanningProgressPercent(trip, members)).toBe(50);
  });

  it("is 75% when a draft itinerary exists and prefs + invite done", () => {
    vi.mocked(hasCachedActiveItinerary).mockReturnValue(true);
    vi.mocked(getCachedActiveItinerary).mockReturnValue(draftItinerary);
    const members = [
      member({ id: "m1", preferenceStatus: "completed" }),
      member({
        id: "m2",
        role: "member",
        name: "B",
        preferenceStatus: "completed",
      }),
    ];
    expect(getTripPlanningProgressPercent(trip, members)).toBe(75);
  });

  it("stays at 50% when plans exist but preferences changed since generation", () => {
    vi.mocked(hasCachedActiveItinerary).mockReturnValue(true);
    vi.mocked(getCachedActiveItinerary).mockReturnValue(draftItinerary);
    const members = [
      member({ id: "m1", preferenceStatus: "completed" }),
      member({
        id: "m2",
        role: "member",
        name: "B",
        preferenceStatus: "completed",
      }),
    ];
    expect(getTripPlanningProgressPercent({ ...trip, isOutdated: true }, members)).toBe(50);
  });

  it("is 100% when itinerary is committed and prefs + invite done", () => {
    vi.mocked(hasCachedActiveItinerary).mockReturnValue(true);
    vi.mocked(getCachedActiveItinerary).mockReturnValue(committedItinerary);
    const members = [
      member({ id: "m1", preferenceStatus: "completed" }),
      member({
        id: "m2",
        role: "member",
        name: "B",
        preferenceStatus: "completed",
      }),
    ];
    expect(getTripPlanningProgressPercent(trip, members)).toBe(100);
  });
});
