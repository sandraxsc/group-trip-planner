import { describe, it, expect } from "vitest";
import {
  buildBoostedPlaceTypesUnion,
  candidateMatchesGroupPreferencePlaceTypes,
} from "./activityMapping";

describe("activityMapping vote filter", () => {
  it("candidateMatchesGroupPreferencePlaceTypes: empty union allows any", () => {
    const empty = new Set<string>();
    expect(candidateMatchesGroupPreferencePlaceTypes(["bowling_alley"], empty)).toBe(true);
  });

  it("matches when categories overlap mapped preference types", () => {
    const group = buildBoostedPlaceTypesUnion(["culture"]);
    expect(candidateMatchesGroupPreferencePlaceTypes(["museum"], group)).toBe(true);
    expect(candidateMatchesGroupPreferencePlaceTypes(["gym"], group)).toBe(false);
  });

  it("meal anchor types always pass when union is non-empty", () => {
    const group = buildBoostedPlaceTypesUnion(["culture"]);
    expect(candidateMatchesGroupPreferencePlaceTypes(["restaurant"], group)).toBe(true);
  });
});
