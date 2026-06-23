import type { Itinerary } from "./itinerary";

export interface ItineraryRecord {
  id: string;
  tripId: string;
  payload: Itinerary;
  isActive: boolean;
  versionNumber: number;
  generatedAt: string;
  archivedAt?: string;
  restoredFrom?: string;
}
