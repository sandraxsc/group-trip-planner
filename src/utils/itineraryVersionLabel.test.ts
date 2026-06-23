import { describe, expect, it } from "vitest";
import { formatItineraryVersionLabel } from "./itineraryVersionLabel";
import { isItineraryCommitted } from "./itineraryCommit";

describe("formatItineraryVersionLabel", () => {
  it("describes members and logistics instead of version number", () => {
    const label = formatItineraryVersionLabel({
      memberNames: ["Alex", "Sam"],
      totalMembers: 3,
      completedMembers: 2,
      groupFlightCount: 2,
      groupHotelCount: 1,
      personalFlightCount: 0,
      personalHotelCount: 0,
    });
    expect(label.title).toBe("Alex, Sam · 2 group flights, 1 group hotel");
    expect(label.subtitle).toBe("2 of 3 members had finished preferences");
  });

  it("uses resolved fallback context instead of version numbers", () => {
    const fallback = {
      memberNames: ["Jordan"],
      totalMembers: 2,
      completedMembers: 2,
      groupFlightCount: 0,
      groupHotelCount: 1,
      personalFlightCount: 1,
      personalHotelCount: 0,
    };
    const label = formatItineraryVersionLabel(undefined, fallback);
    expect(label.title).toBe("Jordan · 1 group hotel, 1 personal flight");
  });
});

describe("isItineraryCommitted", () => {
  it("treats legacy rows without flag as committed", () => {
    expect(isItineraryCommitted({ tripId: "t1", days: [] })).toBe(true);
  });

  it("treats explicit draft as uncommitted", () => {
    expect(isItineraryCommitted({ tripId: "t1", days: [], isCommitted: false })).toBe(false);
  });
});
