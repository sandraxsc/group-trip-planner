import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Trip, TripMember } from "../types/trip";
import { getTripPlanningProgressPercent } from "./tripPlanningProgress";

vi.mock("../services/itineraryService", () => ({
  getItinerary: vi.fn(() => null),
}));

import { getItinerary } from "../services/itineraryService";

const trip: Trip = {
  id: "t1",
  name: "Test",
  destination: "X",
  maxGuests: 2,
  createdAt: new Date().toISOString(),
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

describe("getTripPlanningProgressPercent", () => {
  beforeEach(() => {
    vi.mocked(getItinerary).mockReturnValue(null);
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

  it("is 50% when invite + all preferences complete (vote never counts)", () => {
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

  it("is 75% when itinerary exists and prefs + invite done", () => {
    vi.mocked(getItinerary).mockReturnValue({ tripId: "t1", days: [] } as never);
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
});
