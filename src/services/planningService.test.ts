import { describe, it, expect } from "vitest";
import { overlappingActiveHours } from "./planningService";

describe("overlappingActiveHours", () => {
  it("returns default when no member windows", () => {
    expect(overlappingActiveHours([])).toEqual({ start: "09:00", end: "21:00" });
  });

  it("intersects overlapping same-day windows (latest start, earliest end)", () => {
    expect(
      overlappingActiveHours([
        { start: "09:00", end: "18:00" },
        { start: "10:00", end: "21:00" },
      ])
    ).toEqual({ start: "10:00", end: "18:00" });
  });

  it("falls back to 09:00–21:00 when member windows do not overlap", () => {
    expect(
      overlappingActiveHours([
        { start: "09:00", end: "12:00" },
        { start: "18:00", end: "21:00" },
      ])
    ).toEqual({ start: "09:00", end: "21:00" });
  });
});
