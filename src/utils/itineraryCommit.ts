import type { Itinerary } from "../types/itinerary";

/** Legacy rows without `isCommitted` are treated as saved plans. */
export function isItineraryCommitted(itinerary: Itinerary | null | undefined): boolean {
  if (!itinerary) return false;
  return itinerary.isCommitted !== false;
}
