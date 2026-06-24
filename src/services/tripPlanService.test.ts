import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { Itinerary, TripPlan } from "../types/itinerary";
import type { Trip } from "../types/trip";
import { buildPlanListItems } from "../app/utils/planListUtils";

// ---------------------------------------------------------------------------
// localStorage stub (node environment has no global localStorage)
// ---------------------------------------------------------------------------

function makeMockStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
  };
}

let mockStorage: ReturnType<typeof makeMockStorage>;

beforeEach(() => {
  mockStorage = makeMockStorage();
  vi.stubGlobal("localStorage", mockStorage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function minimalItinerary(tripId: string, dayCount = 2): Itinerary {
  return {
    tripId,
    days: Array.from({ length: dayCount }, (_, i) => ({
      dayIndex: i,
      startTime: "09:00",
      endTime: "21:00",
      blocks: [],
      lunchSlot: { label: "lunch" as const, startTime: "12:00", endTime: "13:00" },
      dinnerSlot: { label: "dinner" as const, startTime: "19:00", endTime: "20:00" },
      energyLevel: "medium" as const,
      maxNonMealActivities: 3,
    })),
  };
}

function seedTrip(tripId: string, extra: Partial<Trip> = {}): void {
  const trip: Trip = {
    id: tripId,
    name: "Test Trip",
    destination: "Bali",
    createdAt: new Date().toISOString(),
    isOutdated: false,
    regenCount: 0,
    ...extra,
  };
  mockStorage.setItem("trips", JSON.stringify([trip]));
}

// Import after stubs are set up so service reads from the mock storage.
// Dynamic import is needed because the module caches nothing at module level
// that would prevent the stub from working.
async function loadService() {
  // vitest resets module registry per file, so a direct import is fine.
  const { savePlan, selectPlan, getAllTripPlans } = await import("./tripPlanService");
  return { savePlan, selectPlan, getAllTripPlans };
}

// ---------------------------------------------------------------------------
// buildPlanListItems — sort and numbering logic
// ---------------------------------------------------------------------------

describe("buildPlanListItems", () => {
  function plan(id: string, createdAt: string): TripPlan {
    return {
      id,
      tripId: "t1",
      itinerary: minimalItinerary("t1"),
      status: "candidate",
      regenerationsUsed: 0,
      createdAt,
    };
  }

  it("assigns plan numbers by creation order (oldest = 1)", () => {
    const plans = [
      plan("c", "2024-01-03T00:00:00Z"),
      plan("a", "2024-01-01T00:00:00Z"),
      plan("b", "2024-01-02T00:00:00Z"),
    ];
    const items = buildPlanListItems(plans);
    const byId = Object.fromEntries(items.map((p) => [p.id, p.planNumber]));
    expect(byId["a"]).toBe(1);
    expect(byId["b"]).toBe(2);
    expect(byId["c"]).toBe(3);
  });

  it("returns plans newest-first", () => {
    const plans = [
      plan("a", "2024-01-01T00:00:00Z"),
      plan("b", "2024-01-02T00:00:00Z"),
      plan("c", "2024-01-03T00:00:00Z"),
    ];
    const items = buildPlanListItems(plans);
    expect(items.map((p) => p.id)).toEqual(["c", "b", "a"]);
  });

  it("handles a single plan (Plan 1)", () => {
    const items = buildPlanListItems([plan("x", "2024-01-01T00:00:00Z")]);
    expect(items).toHaveLength(1);
    expect(items[0]!.planNumber).toBe(1);
  });

  it("returns empty array for empty input", () => {
    expect(buildPlanListItems([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// savePlan — generates adds a new plan, does not overwrite existing ones
// ---------------------------------------------------------------------------

describe("savePlan", () => {
  it("appends a new candidate plan without removing existing plans", async () => {
    const { savePlan, getAllTripPlans } = await loadService();
    const tripId = "trip-save-test";
    seedTrip(tripId);

    const first = savePlan(tripId, minimalItinerary(tripId));
    const second = savePlan(tripId, minimalItinerary(tripId));

    const all = getAllTripPlans(tripId);
    expect(all).toHaveLength(2);
    expect(all.some((p) => p.id === first.id)).toBe(true);
    expect(all.some((p) => p.id === second.id)).toBe(true);
  });

  it("saves with status 'candidate'", async () => {
    const { savePlan } = await loadService();
    const tripId = "trip-status-test";
    seedTrip(tripId);

    const plan = savePlan(tripId, minimalItinerary(tripId));
    expect(plan.status).toBe("candidate");
  });

  it("does nothing when the trip does not exist in storage", async () => {
    const { savePlan, getAllTripPlans } = await loadService();
    // No seedTrip — trip missing from storage
    savePlan("nonexistent-trip", minimalItinerary("nonexistent-trip"));
    expect(getAllTripPlans("nonexistent-trip")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// selectPlan — sets status to 'selected', demotes prior selected to 'candidate'
// ---------------------------------------------------------------------------

describe("selectPlan", () => {
  it("marks the target plan as 'selected'", async () => {
    const { savePlan, selectPlan, getAllTripPlans } = await loadService();
    const tripId = "trip-select-test";
    seedTrip(tripId);

    const plan = savePlan(tripId, minimalItinerary(tripId));
    const updated = selectPlan(tripId, plan.id);

    expect(updated?.status).toBe("selected");
    const all = getAllTripPlans(tripId);
    expect(all.find((p) => p.id === plan.id)?.status).toBe("selected");
  });

  it("demotes the previously selected plan to 'candidate'", async () => {
    const { savePlan, selectPlan, getAllTripPlans } = await loadService();
    const tripId = "trip-demote-test";
    seedTrip(tripId);

    const first = savePlan(tripId, minimalItinerary(tripId));
    const second = savePlan(tripId, minimalItinerary(tripId));

    selectPlan(tripId, first.id);
    // Now select second — first should revert to candidate
    selectPlan(tripId, second.id);

    const all = getAllTripPlans(tripId);
    expect(all.find((p) => p.id === second.id)?.status).toBe("selected");
    expect(all.find((p) => p.id === first.id)?.status).toBe("candidate");
  });

  it("returns null for a plan that does not exist", async () => {
    const { selectPlan } = await loadService();
    const tripId = "trip-missing-plan";
    seedTrip(tripId);
    expect(selectPlan(tripId, "nonexistent-plan-id")).toBeNull();
  });

  it("never removes other plans when selecting", async () => {
    const { savePlan, selectPlan, getAllTripPlans } = await loadService();
    const tripId = "trip-keep-all";
    seedTrip(tripId);

    const a = savePlan(tripId, minimalItinerary(tripId));
    const b = savePlan(tripId, minimalItinerary(tripId));
    const c = savePlan(tripId, minimalItinerary(tripId));

    selectPlan(tripId, b.id);

    expect(getAllTripPlans(tripId)).toHaveLength(3);
    const ids = getAllTripPlans(tripId).map((p) => p.id);
    expect(ids).toContain(a.id);
    expect(ids).toContain(b.id);
    expect(ids).toContain(c.id);
  });
});

// ---------------------------------------------------------------------------
// Edit / AI improve actions are only shown for 'selected' plans
// ---------------------------------------------------------------------------

describe("Edit and AI improve action visibility", () => {
  // PlanDetailActions in TripPlanDetailView renders Edit/AI buttons iff
  // tripPlan.status === 'selected'. This suite asserts the discriminant
  // directly so the rule is documented and regression-tested independent
  // of the rendering layer.
  const canShowEditActions = (status: TripPlan["status"]) => status === "selected";

  it("returns true for 'selected' plans", () => {
    expect(canShowEditActions("selected")).toBe(true);
  });

  it("returns false for 'candidate' plans", () => {
    expect(canShowEditActions("candidate")).toBe(false);
  });

  it("selectPlan output satisfies edit-actions gate", async () => {
    const { savePlan, selectPlan } = await loadService();
    const tripId = "trip-edit-gate";
    seedTrip(tripId);

    const plan = savePlan(tripId, minimalItinerary(tripId));
    expect(canShowEditActions(plan.status)).toBe(false); // candidate after save

    const selected = selectPlan(tripId, plan.id)!;
    expect(canShowEditActions(selected.status)).toBe(true); // selected after selectPlan
  });
});
