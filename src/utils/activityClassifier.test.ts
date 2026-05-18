import { describe, expect, it } from "vitest";
import { isFoodActivity } from "./activityClassifier";

describe("isFoodActivity", () => {
  it("rejects partial-word false positives on name", () => {
    expect(isFoodActivity({ name: "Public Museum", categories: ["museum"] })).toBe(false);
    expect(isFoodActivity({ name: "BarberShop Gallery", categories: ["art_gallery"] })).toBe(
      false
    );
  });

  it("matches whole-word food hints in name", () => {
    expect(isFoodActivity({ name: "The Red Lion Pub", categories: [] })).toBe(true);
    expect(isFoodActivity({ name: "Sakura Sushi Bar", categories: [] })).toBe(true);
  });

  it("matches food-like categories", () => {
    expect(isFoodActivity({ name: "Local Spot", categories: ["meal_takeaway"] })).toBe(true);
  });
});
