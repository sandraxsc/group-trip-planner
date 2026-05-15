import { describe, it, expect } from "vitest";
import { PREFERENCE_BOOST_SCORE, PREFERENCE_INCOMPATIBLE_PENALTY_SCORE } from "../constants/activityMapping";
import {
  activityTagsIntersectExcluded,
  applyDiversityReranking,
  candidateMatchesMemberSelectedPlaces,
  deduplicateActivities,
  getPrimaryCategory,
  hasOpenHoursOverlap,
  rankAndTrimCandidates,
  MAX_DAILY_ACTIVITIES_BY_ENERGY,
} from "./activityEngine";
import type { CandidateActivity, RankedCandidate } from "../types/activity";
import type { MemberPreference } from "../types/preference";
import type { RankingDebugBreakdown } from "./activityEngine";

const commonHours = { start: "09:00", end: "21:00" };

function voteSelectedBoostFromCount(selectedCount: number): number {
  return Math.min(0.25, 0.1 + 0.05 * selectedCount);
}

function candidate(overrides: Partial<CandidateActivity> & { placeId: string; name: string }): CandidateActivity {
  return {
    placeId: overrides.placeId,
    name: overrides.name,
    categories: overrides.categories ?? [],
    estimatedDuration: 120,
    costLevel: overrides.costLevel ?? "medium",
    intensity: overrides.intensity ?? "medium",
    suitableTime: overrides.suitableTime ?? ["morning", "afternoon", "evening"],
    source: overrides.source ?? "system_recommended",
    ...overrides,
  };
}

function memberPref(overrides: Partial<MemberPreference> & { memberId: string; tripId: string }): MemberPreference {
  return {
    memberId: overrides.memberId,
    tripId: overrides.tripId,
    mbti: null,
    ...overrides,
  };
}

function ranked(overrides: Partial<RankedCandidate> & { placeId: string; name: string; finalScore: number }): RankedCandidate {
  return {
    ...candidate(overrides),
    finalScore: overrides.finalScore,
    groupScore: overrides.groupScore ?? overrides.finalScore - 0.1,
    avgMemberScore: overrides.avgMemberScore ?? 0.5,
    minMemberScore: overrides.minMemberScore ?? 0.5,
    selectedCount: overrides.selectedCount ?? 0,
    isSelectedByAnyMember: overrides.isSelectedByAnyMember ?? false,
    ...overrides,
  } as RankedCandidate;
}

describe("Vote page candidate ranking", () => {
  describe("1. Merging selected + recommended candidates", () => {
    it("deduplicateActivities merges user-selected and system-recommended into one list", () => {
      const selected = [
        candidate({ placeId: "ChIJ-A", name: "Museum A", source: "user_selected" }),
      ];
      const recommended = [
        candidate({ placeId: "ChIJ-B", name: "Park B", source: "system_recommended" }),
      ];
      const merged = deduplicateActivities([...selected, ...recommended]);
      expect(merged).toHaveLength(2);
      expect(merged.map((a) => a.placeId).sort()).toEqual(["ChIJ-A", "ChIJ-B"]);
    });
  });

  describe("2. Deduping by placeId", () => {
    it("when same placeId appears from both sources, keeps one with source selected_and_recommended", () => {
      const selected = candidate({
        placeId: "ChIJ-Same",
        name: "Same Place",
        source: "user_selected",
      });
      const recommended = candidate({
        placeId: "ChIJ-Same",
        name: "Same Place",
        source: "system_recommended",
      });
      const deduped = deduplicateActivities([selected, recommended]);
      expect(deduped).toHaveLength(1);
      expect(deduped[0]!.source).toBe("selected_and_recommended");
      expect(deduped[0]!.placeId).toBe("ChIJ-Same");
    });

    it("dedupes by placeId first, then by normalized name", () => {
      const a = candidate({ placeId: "id-1", name: "Place One", source: "user_selected" });
      const b = candidate({ placeId: "id-1", name: "Place One", source: "system_recommended" });
      const c = candidate({ placeId: "id-2", name: "Place Two", source: "system_recommended" });
      const deduped = deduplicateActivities([a, b, c]);
      expect(deduped).toHaveLength(2);
      const same = deduped.find((x) => x.placeId === "id-1");
      expect(same?.source).toBe("selected_and_recommended");
    });
  });

  describe("3. Hard filtering by excludedTags and active hours overlap", () => {
    it("activityTagsIntersectExcluded returns true when activity tags intersect excludedTags", () => {
      const act = candidate({
        placeId: "p1",
        name: "Beach",
        tags: ["water", "sun"],
        source: "system_recommended",
      });
      expect(activityTagsIntersectExcluded(act, ["water"])).toBe(true);
      expect(activityTagsIntersectExcluded(act, ["heights"])).toBe(false);
    });

    it("activityTagsIntersectExcluded infers tags from name for user_selected", () => {
      const act = candidate({
        placeId: "p1",
        name: "Busy Tourist Beach",
        source: "user_selected",
      });
      expect(activityTagsIntersectExcluded(act, ["crowded"])).toBe(true);
      expect(activityTagsIntersectExcluded(act, ["water"])).toBe(true);
    });

    it("rankAndTrimCandidates removes candidates whose tags intersect excludedTags", () => {
      const candidates = [
        candidate({ placeId: "p1", name: "A", tags: ["crowded"], source: "system_recommended" }),
        candidate({ placeId: "p2", name: "B", tags: [], source: "system_recommended" }),
      ];
      const result = rankAndTrimCandidates(
        candidates,
        [],
        commonHours,
        ["crowded"],
        10
      ) as RankedCandidate[];
      expect(result).toHaveLength(1);
      expect(result[0]!.placeId).toBe("p2");
    });

    it("hasOpenHoursOverlap returns false when candidate window does not overlap common hours", () => {
      const act = candidate({
        placeId: "p1",
        name: "Night Club",
        suitableTime: ["evening"],
        openHours: { start: "22:00", end: "02:00" },
        source: "system_recommended",
      });
      expect(hasOpenHoursOverlap(act, { start: "09:00", end: "21:00" })).toBe(false);
    });

    it("hasOpenHoursOverlap returns true when candidate has no openHours/suitableTime (do not exclude)", () => {
      const act = candidate({
        placeId: "p1",
        name: "X",
        suitableTime: [],
        source: "system_recommended",
      });
      expect(hasOpenHoursOverlap(act, commonHours)).toBe(true);
    });

    it("hasOpenHoursOverlap returns true when candidate window overlaps common hours", () => {
      const act = candidate({
        placeId: "p1",
        name: "Museum",
        openHours: { start: "10:00", end: "18:00" },
        source: "system_recommended",
      });
      expect(hasOpenHoursOverlap(act, commonHours)).toBe(true);
    });

    it("rankAndTrimCandidates removes candidates with no open-hours overlap", () => {
      const candidates = [
        candidate({
          placeId: "p1",
          name: "Late Night",
          openHours: { start: "22:00", end: "23:59" },
          source: "system_recommended",
        }),
        candidate({
          placeId: "p2",
          name: "Day Spot",
          openHours: { start: "10:00", end: "18:00" },
          source: "system_recommended",
        }),
      ];
      const result = rankAndTrimCandidates(
        candidates,
        [],
        { start: "09:00", end: "21:00" },
        [],
        10
      ) as RankedCandidate[];
      expect(result).toHaveLength(1);
      expect(result[0]!.placeId).toBe("p2");
    });
  });

  describe("4. Member-level scoring", () => {
    it("rankAndTrimCandidates applies member scoring (typeMatch, budgetMatch, energyMatch, timeMatch, preferenceBoost)", () => {
      const member = memberPref({
        memberId: "m1",
        tripId: "t1",
        budgetLevel: "budget",
        energyLevel: "low",
        activityTypes: ["museum"],
        activeHours: { start: "10:00", end: "18:00" },
        selectedPlaces: ["Perfect Match"],
      });
      const perfect = candidate({
        placeId: "perfect",
        name: "Perfect Match",
        categories: ["museum"],
        costLevel: "low",
        intensity: "low",
        openHours: { start: "10:00", end: "18:00" },
        source: "system_recommended",
      });
      const poor = candidate({
        placeId: "poor",
        name: "Poor Match",
        categories: ["night_club"],
        costLevel: "high",
        intensity: "high",
        source: "system_recommended",
      });
      const result = rankAndTrimCandidates(
        [perfect, poor],
        [member],
        commonHours,
        [],
        10
      ) as RankedCandidate[];
      expect(result).toHaveLength(2);
      expect(result[0]!.placeId).toBe("perfect");
      expect(result[0]!.finalScore).toBeGreaterThan(result[1]!.finalScore);
      expect(result[0]!.avgMemberScore).toBeGreaterThan(0.5);
      expect(result[0]!.groupScore).toBeGreaterThan(result[1]!.groupScore);
    });
  });

  describe("5. Group aggregation (0.7 avg + 0.3 min)", () => {
    it("groupScore = 0.7 * avgMemberScore + 0.3 * minMemberScore", () => {
      const members = [
        memberPref({ memberId: "m1", tripId: "t1" }),
        memberPref({ memberId: "m2", tripId: "t1" }),
      ];
      const act = candidate({
        placeId: "p1",
        name: "Activity",
        source: "system_recommended",
      });
      const result = rankAndTrimCandidates(
        [act],
        members,
        commonHours,
        [],
        10
      ) as RankedCandidate[];
      expect(result).toHaveLength(1);
      const r = result[0]!;
      const expectedGroupScore = 0.7 * r.avgMemberScore + 0.3 * r.minMemberScore;
      expect(r.groupScore).toBeCloseTo(expectedGroupScore, 10);
    });
  });

  describe("6. selectedBoost calculation and cap", () => {
    it("selectedBoost = 0.10 + 0.05 * selectedCount, capped at 0.25", () => {
      const act = candidate({
        placeId: "selected-place",
        name: "Selected Place",
        source: "user_selected",
      });
      const oneMember = memberPref({
        memberId: "m1",
        tripId: "t1",
        selectedPlaces: ["selected-place"],
      });
      const resultOne = rankAndTrimCandidates(
        [act],
        [oneMember],
        commonHours,
        [],
        10
      ) as RankedCandidate[];
      expect(resultOne[0]!.selectedCount).toBe(1);
      expect(resultOne[0]!.isSelectedByAnyMember).toBe(true);
      const boostOne = resultOne[0]!.finalScore - resultOne[0]!.groupScore;
      expect(boostOne).toBeCloseTo(0.1 + 0.05 * 1, 5);

      const threeMembers = [
        memberPref({ memberId: "m1", tripId: "t1", selectedPlaces: ["selected-place"] }),
        memberPref({ memberId: "m2", tripId: "t1", selectedPlaces: ["selected-place"] }),
        memberPref({ memberId: "m3", tripId: "t1", selectedPlaces: ["selected-place"] }),
      ];
      const resultThree = rankAndTrimCandidates(
        [act],
        threeMembers,
        commonHours,
        [],
        10
      ) as RankedCandidate[];
      expect(resultThree[0]!.selectedCount).toBe(3);
      const boostThree = resultThree[0]!.finalScore - resultThree[0]!.groupScore;
      expect(boostThree).toBeLessThanOrEqual(0.25);
      expect(boostThree).toBeCloseTo(0.25, 5);
    });
  });

  describe("6b. Preference → Google Places type boost (union)", () => {
    it("adds PREFERENCE_BOOST_SCORE/100 on top of groupScore when types overlap mapped prefs", () => {
      const museum = candidate({
        placeId: "m1",
        name: "Museum",
        categories: ["museum"],
        source: "system_recommended",
      });
      const member = memberPref({
        memberId: "m1",
        tripId: "t1",
        activityTypes: ["culture"],
      });
      const result = rankAndTrimCandidates(
        [museum],
        [member],
        commonHours,
        [],
        10
      ) as RankedCandidate[];
      const r = result[0]!;
      const selBoost = voteSelectedBoostFromCount(r.selectedCount);
      expect(r.finalScore - r.groupScore - selBoost).toBeCloseTo(PREFERENCE_BOOST_SCORE / 100, 5);
    });

    it("does not apply incompatibility penalty to meal-anchor categories (food mapping)", () => {
      const restaurant = candidate({
        placeId: "r1",
        name: "Lunch",
        categories: ["restaurant"],
        source: "system_recommended",
      });
      const member = memberPref({
        memberId: "m1",
        tripId: "t1",
        activityTypes: ["culture"],
      });
      const result = rankAndTrimCandidates(
        [restaurant],
        [member],
        commonHours,
        [],
        10
      ) as RankedCandidate[];
      const r = result[0]!;
      expect(r.finalScore - r.groupScore - voteSelectedBoostFromCount(r.selectedCount)).toBeCloseTo(0, 5);
    });

    it("soft-penalizes non-meal candidates that do not overlap group boosted types", () => {
      const gym = candidate({
        placeId: "g1",
        name: "Gym",
        categories: ["gym"],
        source: "system_recommended",
      });
      const member = memberPref({
        memberId: "m1",
        tripId: "t1",
        activityTypes: ["culture"],
      });
      const result = rankAndTrimCandidates(
        [gym],
        [member],
        commonHours,
        [],
        10
      ) as RankedCandidate[];
      const r = result[0]!;
      expect(r.finalScore - r.groupScore - voteSelectedBoostFromCount(r.selectedCount)).toBeCloseTo(
        -(PREFERENCE_INCOMPATIBLE_PENALTY_SCORE / 100),
        5
      );
    });

    it("ranks preference-aligned candidate above misaligned when member scores align", () => {
      const aligned = candidate({
        placeId: "aligned",
        name: "Aligned",
        categories: ["museum"],
        source: "system_recommended",
      });
      const misaligned = candidate({
        placeId: "mis",
        name: "Misaligned",
        categories: ["bowling_alley"],
        source: "system_recommended",
      });
      const member = memberPref({
        memberId: "m1",
        tripId: "t1",
        activityTypes: ["culture"],
        budgetLevel: "moderate",
        energyLevel: "medium",
      });
      const result = rankAndTrimCandidates(
        [misaligned, aligned],
        [member],
        commonHours,
        [],
        10
      ) as RankedCandidate[];
      expect(result[0]!.placeId).toBe("aligned");
    });
  });

  describe("7. Top N trimming by tripDays * maxDailyActivities", () => {
    it("candidateLimit trims to top N", () => {
      const candidates = [
        candidate({ placeId: "p1", name: "A", rating: 5, source: "system_recommended" }),
        candidate({ placeId: "p2", name: "B", rating: 4, source: "system_recommended" }),
        candidate({ placeId: "p3", name: "C", rating: 3, source: "system_recommended" }),
        candidate({ placeId: "p4", name: "D", rating: 2, source: "system_recommended" }),
        candidate({ placeId: "p5", name: "E", rating: 1, source: "system_recommended" }),
      ];
      const result = rankAndTrimCandidates(
        candidates,
        [],
        commonHours,
        [],
        2
      ) as RankedCandidate[];
      expect(result).toHaveLength(2);
      expect(result[0]!.placeId).toBe("p1");
      expect(result[1]!.placeId).toBe("p2");
    });

    it("MAX_DAILY_ACTIVITIES_BY_ENERGY maps high=5, medium=3, low=2", () => {
      expect(MAX_DAILY_ACTIVITIES_BY_ENERGY.high).toBe(5);
      expect(MAX_DAILY_ACTIVITIES_BY_ENERGY.medium).toBe(3);
      expect(MAX_DAILY_ACTIVITIES_BY_ENERGY.low).toBe(2);
    });
  });

  describe("8. Safe handling of missing optional fields", () => {
    it("handles empty memberPrefs (uses neutral 0.5 score)", () => {
      const act = candidate({
        placeId: "p1",
        name: "X",
        source: "system_recommended",
      });
      const result = rankAndTrimCandidates(
        [act],
        [],
        commonHours,
        [],
        10
      ) as RankedCandidate[];
      expect(result).toHaveLength(1);
      expect(result[0]!.avgMemberScore).toBe(0.5);
      expect(result[0]!.minMemberScore).toBe(0.5);
      expect(result[0]!.groupScore).toBe(0.5);
    });

    it("handles candidate with minimal fields (no categories, no openHours)", () => {
      const act = candidate({
        placeId: "p1",
        name: "Minimal",
        categories: [],
        suitableTime: [],
        source: "system_recommended",
      });
      const result = rankAndTrimCandidates(
        [act],
        [memberPref({ memberId: "m1", tripId: "t1" })],
        commonHours,
        [],
        10
      ) as RankedCandidate[];
      expect(result).toHaveLength(1);
      expect(result[0]!.finalScore).toBeGreaterThanOrEqual(0);
      expect(result[0]!.finalScore).toBeLessThanOrEqual(1.5);
    });

    it("handles member with no optional prefs (budgetLevel, energyLevel, activityTypes, activeHours, selectedPlaces)", () => {
      const member = memberPref({
        memberId: "m1",
        tripId: "t1",
      });
      const act = candidate({
        placeId: "p1",
        name: "Any",
        source: "system_recommended",
      });
      const result = rankAndTrimCandidates(
        [act],
        [member],
        commonHours,
        [],
        10
      ) as RankedCandidate[];
      expect(result).toHaveLength(1);
      expect(result[0]!.avgMemberScore).toBeDefined();
      expect(Number.isFinite(result[0]!.groupScore)).toBe(true);
    });
  });

  describe("Debug breakdown", () => {
    it("returns debug breakdown when options.debug is true", () => {
      const candidates = [
        candidate({ placeId: "p1", name: "A", tags: ["crowded"], source: "system_recommended" }),
        candidate({ placeId: "p2", name: "B", source: "system_recommended" }),
      ];
      const result = rankAndTrimCandidates(
        candidates,
        [],
        commonHours,
        ["crowded"],
        1,
        { debug: true }
      );
      expect(Array.isArray(result)).toBe(false);
      const { ranked, debug } = result as { ranked: RankedCandidate[]; debug: RankingDebugBreakdown };
      expect(debug.inputCount).toBe(2);
      expect(debug.afterExcludedTagsCount).toBe(1);
      expect(debug.afterOpenHoursCount).toBe(1);
      expect(debug.candidateLimit).toBe(1);
      expect(debug.memberCount).toBe(0);
      expect(debug.rankedCount).toBe(1);
      expect(ranked).toHaveLength(1);
    });
  });

  describe("Diversity re-ranking", () => {
    it("getPrimaryCategory returns expected primary categories", () => {
      expect(getPrimaryCategory({ categories: ["restaurant"] })).toBe("food");
      expect(getPrimaryCategory({ categories: ["cafe", "store"] })).toBe("food");
      expect(getPrimaryCategory({ categories: ["museum"] })).toBe("culture");
      expect(getPrimaryCategory({ categories: ["art_gallery"] })).toBe("culture");
      expect(getPrimaryCategory({ categories: ["park"] })).toBe("nature");
      expect(getPrimaryCategory({ categories: ["shopping_mall"] })).toBe("shopping");
      expect(getPrimaryCategory({ categories: ["night_club"] })).toBe("nightlife");
      expect(getPrimaryCategory({ categories: ["spa"] })).toBe("wellness");
      expect(getPrimaryCategory({ categories: ["zoo"] })).toBe("entertainment");
      expect(getPrimaryCategory({ categories: [] })).toBe("other");
      expect(getPrimaryCategory({ categories: ["unknown_type"] })).toBe("other");
    });

    it("getPrimaryCategory maps restaurant variants and name hints to food (stronger food mapping)", () => {
      expect(getPrimaryCategory({ categories: ["french_restaurant"] })).toBe("food");
      expect(getPrimaryCategory({ categories: ["japanese_restaurant"] })).toBe("food");
      expect(getPrimaryCategory({ categories: ["brasserie"] })).toBe("food");
      expect(getPrimaryCategory({ categories: ["bistro"] })).toBe("food");
      expect(getPrimaryCategory({ categories: ["meal_takeaway"] })).toBe("food");
      expect(getPrimaryCategory({ categories: ["lebanese_restaurant"] })).toBe("food");
      expect(getPrimaryCategory({ categories: ["diner"] })).toBe("food");
      expect(getPrimaryCategory({ categories: ["pub"] })).toBe("food");
      expect(getPrimaryCategory({ name: "Tokyo Sushi Bar" })).toBe("food");
      expect(getPrimaryCategory({ name: "Cafe Central" })).toBe("food");
      expect(getPrimaryCategory({ name: "The Local Bistro", categories: [] })).toBe("food");
    });

    it("getPrimaryCategory does not crash when categories are missing", () => {
      expect(getPrimaryCategory({})).toBe("other");
      expect(getPrimaryCategory({ name: "Some Unknown Place" })).toBe("other");
    });

    it("applyDiversityReranking returns at most candidateLimit items", () => {
      const list = [
        ranked({ placeId: "1", name: "A", finalScore: 0.9 }),
        ranked({ placeId: "2", name: "B", finalScore: 0.8 }),
        ranked({ placeId: "3", name: "C", finalScore: 0.7 }),
      ];
      expect(applyDiversityReranking(list, 2)).toHaveLength(2);
      expect(applyDiversityReranking(list, 10)).toHaveLength(3);
      expect(applyDiversityReranking(list, 1)).toHaveLength(1);
    });

    it("applyDiversityReranking does not crash when categories are missing", () => {
      const list = [
        ranked({ placeId: "1", name: "X", finalScore: 0.8, categories: [] }),
        ranked({ placeId: "2", name: "Y", finalScore: 0.7 }),
      ];
      expect(applyDiversityReranking(list, 2)).toHaveLength(2);
    });

    it("when multiple same-category have similar scores, re-ranked top includes more category variety", () => {
      const foodScore = 0.72;
      const cultureScore = 0.70;
      const natureScore = 0.69;
      const compatibilityRanked: RankedCandidate[] = [
        ranked({ placeId: "f1", name: "Food One", finalScore: foodScore, categories: ["restaurant"] }),
        ranked({ placeId: "f2", name: "Food Two", finalScore: foodScore, categories: ["cafe"] }),
        ranked({ placeId: "f3", name: "Food Three", finalScore: foodScore, categories: ["restaurant"] }),
        ranked({ placeId: "f4", name: "Food Four", finalScore: foodScore, categories: ["bakery"] }),
        ranked({ placeId: "c1", name: "Museum", finalScore: cultureScore, categories: ["museum"] }),
        ranked({ placeId: "c2", name: "Gallery", finalScore: cultureScore, categories: ["art_gallery"] }),
        ranked({ placeId: "n1", name: "Park", finalScore: natureScore, categories: ["park"] }),
      ];
      const result = applyDiversityReranking(compatibilityRanked, 4);
      expect(result).toHaveLength(4);
      const categories = result.map((r) => getPrimaryCategory(r));
      const foodCount = categories.filter((c) => c === "food").length;
      const hasCulture = categories.includes("culture");
      const hasNature = categories.includes("nature");
      expect(foodCount).toBeLessThanOrEqual(2);
      expect(hasCulture || hasNature).toBe(true);
    });

    it("first 6 results do not contain more than 2 food when non-food alternatives are close in score (early-list food cap)", () => {
      const foodScore = 0.72;
      const cultureScore = 0.70;
      const natureScore = 0.69;
      const compatibilityRanked: RankedCandidate[] = [
        ranked({ placeId: "f1", name: "Restaurant One", finalScore: foodScore, categories: ["restaurant"] }),
        ranked({ placeId: "f2", name: "Cafe Two", finalScore: foodScore, categories: ["cafe"] }),
        ranked({ placeId: "f3", name: "Bistro Three", finalScore: foodScore, categories: ["bistro"] }),
        ranked({ placeId: "f4", name: "Food Four", finalScore: foodScore, categories: ["bakery"] }),
        ranked({ placeId: "f5", name: "Diner Five", finalScore: foodScore, categories: ["diner"] }),
        ranked({ placeId: "c1", name: "Museum", finalScore: cultureScore, categories: ["museum"] }),
        ranked({ placeId: "c2", name: "Gallery", finalScore: cultureScore, categories: ["art_gallery"] }),
        ranked({ placeId: "c3", name: "Temple", finalScore: cultureScore, categories: ["temple"] }),
        ranked({ placeId: "n1", name: "Park", finalScore: natureScore, categories: ["park"] }),
        ranked({ placeId: "n2", name: "Beach", finalScore: natureScore, categories: ["beach"] }),
      ];
      const result = applyDiversityReranking(compatibilityRanked, 6);
      expect(result).toHaveLength(6);
      const firstSix = result.slice(0, 6);
      const foodInFirstSix = firstSix.filter((r) => getPrimaryCategory(r) === "food").length;
      expect(foodInFirstSix).toBeLessThanOrEqual(2);
    });

    it("diversity does not override relevance: much higher-scoring candidate still ranks well", () => {
      const compatibilityRanked: RankedCandidate[] = [
        ranked({ placeId: "high", name: "Top Pick", finalScore: 0.95, categories: ["restaurant"] }),
        ranked({ placeId: "f2", name: "Food Two", finalScore: 0.72, categories: ["restaurant"] }),
        ranked({ placeId: "f3", name: "Food Three", finalScore: 0.71, categories: ["cafe"] }),
        ranked({ placeId: "culture", name: "Museum", finalScore: 0.70, categories: ["museum"] }),
      ];
      const result = applyDiversityReranking(compatibilityRanked, 3);
      expect(result[0]!.placeId).toBe("high");
      expect(result.map((r) => r.placeId)).toContain("high");
    });

    it("missing categories still do not crash and fall back to other", () => {
      expect(getPrimaryCategory({})).toBe("other");
      expect(getPrimaryCategory({ categories: [] })).toBe("other");
      const list = [
        ranked({ placeId: "1", name: "Place", finalScore: 0.8 }),
        ranked({ placeId: "2", name: "Other", finalScore: 0.7, categories: [] }),
      ];
      expect(applyDiversityReranking(list, 2)).toHaveLength(2);
    });
  });
});

describe("candidateMatchesMemberSelectedPlaces", () => {
  it("matches placeId, exact name, or name substring (VoteScreen hide-own-picks)", () => {
    expect(
      candidateMatchesMemberSelectedPlaces(["ChIJabc"], { placeId: "ChIJabc", name: "Place" })
    ).toBe(true);
    expect(
      candidateMatchesMemberSelectedPlaces(["Beach Club"], { placeId: "p1", name: "Secret Beach Club" })
    ).toBe(true);
    expect(
      candidateMatchesMemberSelectedPlaces(["zoo"], { placeId: "p1", name: "Museum" })
    ).toBe(false);
    expect(candidateMatchesMemberSelectedPlaces(undefined, { placeId: "p1", name: "X" })).toBe(false);
  });
});
