import fs from "fs";

let body = fs.readFileSync("src/app/components/_itineraryEditorExtract.tsx", "utf8");
body = body.replace(/^\/\* EXTRACT \*\/\n/, "");
body = body.replace(/\n\s+\{\/\* Edit \/ AI Improve at bottom \*\/\}[\s\S]*$/, "");

const header = `import type { Dispatch, SetStateAction } from "react";
import { ChevronDown, ChevronUp, Clock, GripVertical, Trash2 } from "lucide-react";
import { HotelPlaceAutocomplete } from "./HotelPlaceAutocomplete";
import { ActivityPlaceAutocomplete } from "./ActivityPlaceAutocomplete";
import { DaySplitTimeline } from "./DaySplitTimeline";
import { fetchPlaceDetails } from "../../services/placeService";
import type { AiEnhanceProposal } from "../../types/aiEnhance";
import type { ItineraryEditRow } from "../../types/itinerary";
import type { Trip, TripMember } from "../../types/trip";
import type { DisplayDay } from "../utils/itineraryToDisplayDays";
import type { TransitInfo } from "../../services/transitService";
import type { buildDayTimeline } from "../utils/buildDayTimeline";

type ActivityEvent = {
  id: string;
  title: string;
  image?: string | null;
  duration: string;
  durationMinutes?: number;
  cost: string;
  isHotel?: boolean;
  isPlaceholder?: boolean;
  detailPlaceId?: string;
  savedDescription?: string | null;
  savedCategoryLabel?: string | null;
  savedRating?: number;
};

export type ItineraryEditorSectionProps = {
  aiSummary: string | null;
  aiProposals: AiEnhanceProposal[];
  aiSelectedProposalIds: Record<string, boolean>;
  setAiSelectedProposalIds: Dispatch<SetStateAction<Record<string, boolean>>>;
  handleApplySelectedAiChanges: () => void;
  displayDays: DisplayDay[];
  expandedDay: number | null;
  setExpandedDay: Dispatch<SetStateAction<number | null>>;
  whyDayOpen: Record<number, boolean>;
  setWhyDayOpen: Dispatch<SetStateAction<Record<number, boolean>>>;
  dayReasoningBullets: (text: string) => string[];
  timelineByDay: Map<number, ReturnType<typeof buildDayTimeline>> | null;
  useSplitTimelineView: boolean;
  members: TripMember[];
  adjustedStartByDay: Record<number, string[]>;
  transitByDay: Record<number, TransitInfo[]>;
  openActivityDetail: (event: ActivityEvent, day: number, index: number) => void;
  handleEditMoveRow: (fromDay: number, fromIndex: number, toDay: number, toIndex: number) => void;
  openTimePicker: (day: number, idx: number, currentLabel: string) => void;
  editRowsDraft: Record<string, ItineraryEditRow[]>;
  trip: Trip | null;
  updateHotelRow: (
    dayNum: number,
    rowId: string,
    patch: { hotelLabel?: string; placeId?: string | undefined }
  ) => void;
  updateActivityRow: (
    dayNum: number,
    rowId: string,
    patch: {
      activityLabel?: string;
      placeId?: string | undefined;
      isPlaceholder?: boolean;
      location?: { lat: number; lng: number } | undefined;
    }
  ) => void;
  handleRemoveEditRow: (dayNum: number, index: number) => void;
  handleAddActivityRow: (dayNum: number) => void;
};

export function ItineraryEditorSection({
  aiSummary,
  aiProposals,
  aiSelectedProposalIds,
  setAiSelectedProposalIds,
  handleApplySelectedAiChanges,
  displayDays,
  expandedDay,
  setExpandedDay,
  whyDayOpen,
  setWhyDayOpen,
  dayReasoningBullets,
  timelineByDay,
  useSplitTimelineView,
  members,
  adjustedStartByDay,
  transitByDay,
  openActivityDetail,
  handleEditMoveRow,
  openTimePicker,
  editRowsDraft,
  trip,
  updateHotelRow,
  updateActivityRow,
  handleRemoveEditRow,
  handleAddActivityRow,
}: ItineraryEditorSectionProps) {
  const itineraryEditMode = true;
  return (
    <div className="flex flex-col gap-3">
`;

const footer = `
    </div>
  );
}
`;

fs.writeFileSync("src/app/components/ItineraryEditorSection.tsx", header + body + footer);
console.log("Wrote ItineraryEditorSection.tsx");
