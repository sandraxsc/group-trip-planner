import type { Itinerary, ItineraryEditRow } from "./itinerary";
import type { Trip } from "./trip";

export type AiEnhancePatch =
  | {
      kind: "update_row";
      day: number;
      rowId: string;
      changes: Partial<ItineraryEditRow>;
    }
  | {
      kind: "insert_row";
      day: number;
      index?: number;
      row: ItineraryEditRow;
    }
  | {
      kind: "remove_row";
      day: number;
      rowId: string;
    };

export interface AiEnhanceProposal {
  id: string;
  title: string;
  reason: string;
  patch: AiEnhancePatch;
}

export interface AiEnhanceResponse {
  summary: string;
  proposals: AiEnhanceProposal[];
}

export interface AiEnhanceRequest {
  trip: Pick<Trip, "id" | "name" | "destination" | "tripDays" | "createdAt">;
  itinerary: Pick<Itinerary, "tripId" | "days" | "activityOrder" | "editRowsByDay">;
  currentEditRowsByDay: Record<string, ItineraryEditRow[]>;
  enhanceRequest: string;
  dissatisfaction: string;
}

