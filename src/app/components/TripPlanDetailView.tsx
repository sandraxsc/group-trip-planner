import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Pencil, Sparkles } from "lucide-react";
import { DuoButton } from "./DuoButton";
import { DuoStickyFooter } from "./DuoStickyFooter";
import { TripPlanStatsCard } from "./TripPlanStatsCard";
import { TripPlanItineraryList } from "./TripPlanItineraryList";
import { useTripPlanItineraryDisplay } from "../hooks/useTripPlanItineraryDisplay";
import { loadTripPlanDisplayMeta } from "../utils/tripPlanDisplayUtils";
import {
  commitActiveItinerary,
  updateActiveItineraryPayload,
} from "../../services/itineraryCloudStore";
import {
  generateItinerary,
  isItineraryGenerationError,
} from "../../services/itineraryService";
import { getTripById, updateTrip } from "../../services/tripService";
import {
  getLatestPlan,
  MAX_REGENERATIONS,
  selectPlan,
} from "../../services/tripPlanService";
import type { Itinerary, TripPlan } from "../../types/itinerary";
import type { PlanListEntrySource } from "../../types/planList";
import type { TripMember } from "../../types/trip";
import {
  isRegenCapReached,
  isRegenCapReachedError,
  regenCapMessage,
  remainingRegenerations,
} from "../../utils/regenCap";
import {
  isItineraryGenerating,
  subscribeItineraryGenerating,
} from "../../utils/itineraryGenerationStatus";
import { toast } from "sonner";

export interface TripPlanDetailViewProps {
  tripId: string;
  tripPlan: TripPlan;
  /** Defaults to tripPlan.itinerary */
  itinerary?: Itinerary;
  entrySource?: PlanListEntrySource;
  /** Full page uses fixed sticky footer; embedded renders actions inline. */
  layout?: "page" | "embedded";
  className?: string;
  loading?: boolean;
  loadError?: string | null;
  onPlanChange?: (plan: TripPlan) => void;
}

function PlanStatusBadge({ status }: { status: TripPlan["status"] }) {
  const isSelected = status === "selected";
  return (
    <div className="flex flex-col gap-2">
      <span
        className={`self-start text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full border ${
          isSelected
            ? "bg-[#F0FDE4] border-[#58CC02] text-[#58CC02]"
            : "bg-[#F7F7F7] border-[#E5E5E5] text-[#777777]"
        }`}
      >
        {isSelected ? "Selected plan" : "Saved plan"}
      </span>
      {!isSelected && (
        <div className="bg-[#FFF8D6] rounded-2xl border-2 border-[#FFD900] shadow-[0_3px_0_#E5C400] px-3 py-2">
          <p className="text-xs font-bold text-[#6B5A00] leading-snug">Saved · not yet selected</p>
        </div>
      )}
    </div>
  );
}

function PlanDetailActions({
  tripPlan,
  savingPlan,
  planGenerating,
  regenBlocked,
  regensRemainingLabel,
  onSelect,
  onGenerateAnother,
  onEdit,
  onAiImprove,
}: {
  tripPlan: TripPlan;
  savingPlan: boolean;
  planGenerating: boolean;
  regenBlocked: boolean;
  regensRemainingLabel: string | null;
  onSelect: () => void;
  onGenerateAnother: () => void;
  onEdit: () => void;
  onAiImprove: () => void;
}) {
  const isSelected = tripPlan.status === "selected";
  const isCandidate = tripPlan.status === "candidate";

  if (isSelected) {
    return (
      <div className="flex flex-col gap-3">
        <DuoButton
          variant="secondary"
          fullWidth
          onClick={onEdit}
          className="flex items-center justify-center gap-2"
        >
          <Pencil size={18} />
          Edit plan
        </DuoButton>
        <DuoButton fullWidth onClick={onAiImprove} className="flex items-center justify-center gap-2">
          <Sparkles size={18} />
          AI improve
        </DuoButton>
      </div>
    );
  }

  if (isCandidate) {
    return (
      <div className="flex flex-col gap-3">
        <DuoButton fullWidth disabled={savingPlan || planGenerating} onClick={onSelect}>
          {savingPlan ? "Selecting…" : "Select this plan"}
        </DuoButton>
        <DuoButton
          variant="secondary"
          fullWidth
          disabled={planGenerating || regenBlocked || savingPlan}
          onClick={onGenerateAnother}
        >
          {planGenerating ? "Generating…" : "Generate another plan"}
        </DuoButton>
        {regensRemainingLabel && (
          <p className="text-xs font-bold text-[#AFAFAF] text-center">{regensRemainingLabel}</p>
        )}
      </div>
    );
  }

  return null;
}

export function TripPlanDetailView({
  tripId,
  tripPlan,
  itinerary: itineraryProp,
  entrySource,
  layout = "page",
  className = "",
  loading = false,
  loadError = null,
  onPlanChange,
}: TripPlanDetailViewProps) {
  const navigate = useNavigate();
  const itinerary = itineraryProp ?? tripPlan.itinerary;

  const [tripPlanState, setTripPlanState] = useState(tripPlan);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [tripDaysCount, setTripDaysCount] = useState(1);
  const [membersCount, setMembersCount] = useState(0);
  const [estPerPerson, setEstPerPerson] = useState("$—");
  const [savingPlan, setSavingPlan] = useState(false);
  const [planGenerating, setPlanGenerating] = useState(false);

  useEffect(() => {
    setTripPlanState(tripPlan);
  }, [tripPlan]);

  useEffect(() => {
    const meta = loadTripPlanDisplayMeta(tripId, itinerary);
    setTripDaysCount(meta.tripDaysCount);
    setEstPerPerson(meta.estPerPerson);
    setMembers(meta.members);
    setMembersCount(meta.membersCount);
  }, [tripId, itinerary]);

  const {
    displayDays,
    totalActivities,
    transitByDay,
    adjustedStartByDay,
    timelineByDay,
    useSplitTimelineView,
  } = useTripPlanItineraryDisplay(tripId, itinerary);

  const tripForDisplay = getTripById(tripId);
  const regenBlocked = tripForDisplay ? isRegenCapReached(tripForDisplay.regenCount) : false;
  const regensRemainingLabel = useMemo(() => {
    if (!tripForDisplay) return null;
    if (regenBlocked) return regenCapMessage();
    return `${remainingRegenerations(tripForDisplay.regenCount)} of ${MAX_REGENERATIONS} free regenerations remaining`;
  }, [tripForDisplay, regenBlocked]);

  useEffect(() => {
    let wasGenerating = isItineraryGenerating(tripId);
    setPlanGenerating(wasGenerating);
    return subscribeItineraryGenerating(() => {
      const now = isItineraryGenerating(tripId);
      setPlanGenerating(now);
      wasGenerating = now;
    });
  }, [tripId]);

  const openTripEditor = (mode: "edit" | "ai") => {
    if (tripPlanState.status !== "selected") return;
    const q = mode === "edit" ? "editPlan=1" : "aiEnhance=1";
    navigate(`/trips/${tripId}?${q}`);
  };

  const handleSelect = async () => {
    if (savingPlan) return;
    setSavingPlan(true);
    try {
      const selected = selectPlan(tripId, tripPlanState.id);
      if (!selected) {
        toast.error("Could not select that plan.");
        return;
      }
      setTripPlanState(selected);
      onPlanChange?.(selected);
      await updateActiveItineraryPayload(tripId, selected.itinerary);
      const result = await commitActiveItinerary(tripId, selected.itinerary);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const trip = getTripById(tripId);
      if ((trip?.tripStatus ?? "planning") !== "executing") {
        updateTrip(tripId, { tripStatus: "executing" });
      }
      toast.success("Plan selected for the group!");
      navigate(`/trips/${tripId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to select plan");
    } finally {
      setSavingPlan(false);
    }
  };

  const handleGenerateAnother = () => {
    if (planGenerating || regenBlocked) return;
    void (async () => {
      try {
        await generateItinerary(tripId);
        const newest = getLatestPlan(tripId);
        toast.success("New plan generated!");
        if (newest) {
          navigate(`/trips/${tripId}/plans/${newest.id}`, {
            state: { entrySource, fromGeneration: true },
          });
        } else {
          navigate(`/trips/${tripId}/plans`, { state: { entrySource } });
        }
      } catch (err) {
        if (isRegenCapReachedError(err)) {
          toast.error(err.message);
        } else if (isItineraryGenerationError(err)) {
          toast.error(err.message);
        } else {
          toast.error(err instanceof Error ? err.message : "Failed to generate plan");
        }
      }
    })();
  };

  const actions = (
    <PlanDetailActions
      tripPlan={tripPlanState}
      savingPlan={savingPlan}
      planGenerating={planGenerating}
      regenBlocked={regenBlocked}
      regensRemainingLabel={regensRemainingLabel}
      onSelect={() => void handleSelect()}
      onGenerateAnother={handleGenerateAnother}
      onEdit={() => openTripEditor("edit")}
      onAiImprove={() => openTripEditor("ai")}
    />
  );

  const isPageLayout = layout === "page";
  const statsVariant = tripPlanState.status === "selected" ? "selected" : "candidate";

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="mx-5 mt-4">
        <PlanStatusBadge status={tripPlanState.status} />
      </div>

      <div className="mx-5 mt-4">
        <TripPlanStatsCard
          tripDaysCount={tripDaysCount}
          totalActivities={totalActivities}
          membersCount={membersCount}
          estPerPerson={estPerPerson}
          variant={statsVariant}
        />
      </div>

      <div className="px-5 pt-5">
        <TripPlanItineraryList
          displayDays={displayDays}
          members={members}
          transitByDay={transitByDay}
          adjustedStartByDay={adjustedStartByDay}
          timelineByDay={timelineByDay}
          useSplitTimelineView={useSplitTimelineView}
          loading={loading}
          loadError={loadError}
          contentPaddingBottom={isPageLayout}
          onBackToTrip={() => navigate(`/trips/${tripId}`)}
        />
      </div>

      {isPageLayout ? (
        <DuoStickyFooter>{actions}</DuoStickyFooter>
      ) : (
        <div className="px-5 pb-5 pt-2">{actions}</div>
      )}
    </div>
  );
}
