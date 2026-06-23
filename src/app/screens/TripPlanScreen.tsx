import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useSearchParams, useLocation } from "react-router";
import { ArrowLeft, MapPin, CalendarDays, Share2, Download, Pencil, Sparkles } from "lucide-react";
import { DuoButton } from "../components/DuoButton";
import { DuoStickyFooter } from "../components/DuoStickyFooter";
import { TripPlanDetailView } from "../components/TripPlanDetailView";
import { TripPlanStatsCard } from "../components/TripPlanStatsCard";
import { TripPlanItineraryList } from "../components/TripPlanItineraryList";
import { useTripPlanItineraryDisplay } from "../hooks/useTripPlanItineraryDisplay";
import { formatItineraryVersionLabel } from "../../utils/itineraryVersionLabel";
import { buildItineraryGenerationContextSync } from "../../utils/itineraryGenerationContext";
import { isItineraryCommitted } from "../../utils/itineraryCommit";
import { toast } from "sonner";
import {
  generateItinerary,
  isItineraryGenerationError,
} from "../../services/itineraryService";
import {
  getActiveItinerary,
  getItineraryHistory,
  restoreItineraryVersion,
  commitActiveItinerary,
} from "../../services/itineraryCloudStore";
import { getTripById, getTripMembers } from "../../services/tripService";
import {
  MAX_REGENERATIONS,
  getPlanById,
} from "../../services/tripPlanService";
import type { TripPlan } from "../../types/itinerary";
import { parsePlanListEntrySource } from "../../types/planList";
import { generateGroupPlanningProfile, COST_RANGE_BY_BUDGET } from "../../services/planningService";
import type { Itinerary } from "../../types/itinerary";
import type { ItineraryRecord } from "../../types/itineraryRecord";
import type { TripMember } from "../../types/trip";
import { subscribeTripCloudSync } from "../../services/cloudHydrateService";
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

const BALI_IMG = "https://images.unsplash.com/photo-1682321297712-acaa3ea203c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYWxpJTIwaW5kb25lc2lhJTIwcmljZSUyMHRlcnJhY2UlMjBhZXJpYWx8ZW58MXx8fHwxNzcyODMxMTI0fDA&ixlib=rb-4.1.0&q=80&w=1080";
const RICE_TERRACE_IMG = "https://images.unsplash.com/photo-1537996194471-e657df975ab4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYWxpJTIwcmljZSUyMHRlcnJhY2UlMjBncmVlbnxlbnwxfHx8fDE3NzI4NTk4OTZ8MA&ixlib=rb-4.1.0&q=80&w=1080";
const MOUNT_BATUR_IMG = "https://images.unsplash.com/photo-1712078953326-346a472bddb0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb3VudCUyMGJhdHVyJTIwc3VucmlzZSUyMGhpa2luZyUyMGJhbGl8ZW58MXx8fHwxNzczMDIxNTY1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const TEMPLE_IMG = "https://images.unsplash.com/photo-1693493308351-f9c05a20139a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYWxpJTIwdGVtcGxlJTIwd2F0ZXIlMjBjdWx0dXJlfGVufDF8fHx8MTc3MzAyMTU2NXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const SURF_IMG = "https://images.unsplash.com/photo-1567520595865-0da8e017f2c3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxrdXRhJTIwYmVhY2glMjBzdXJmaW5nJTIwYmFsaXxlbnwxfHx8fDE3NzMwMjE1NjZ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const BEACH_CLUB_IMG = "https://images.unsplash.com/photo-1760869350325-8f015973ffaa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWFjaCUyMGNsdWIlMjBsdW5jaCUyMHRyb3BpY2FsfGVufDF8fHx8MTc3MzAyMTU2Nnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";

const days = [
  {
    day: 1,
    date: "Tue, May 21",
    emoji: "🌴",
    title: "Arrival & Rice Terraces",
    events: [
      {
        id: "e1",
        time: "10:00 AM",
        title: "Arrive at Ngurah Rai Airport",
        type: "✈️ Travel",
        categoryColor: "#CE82FF",
        categoryBg: "#F9F0FF",
        duration: null,
        cost: null,
        votes: 4,
        image: null,
      },
      {
        id: "e2",
        time: "2:00 PM",
        title: "Tegallalang Rice Terrace",
        type: "🌿 Nature",
        categoryColor: "#58CC02",
        categoryBg: "#F0FDE4",
        duration: "2–3 hrs",
        cost: "$$",
        votes: 3,
        image: RICE_TERRACE_IMG,
      },
      {
        id: "e3",
        time: "7:00 PM",
        title: "Dinner at Locavore",
        type: "🍜 Food",
        categoryColor: "#FF4B4B",
        categoryBg: "#FFE5E5",
        duration: "1.5 hrs",
        cost: "$40",
        votes: 4,
        image: null,
      },
    ],
  },
  {
    day: 2,
    date: "Wed, May 22",
    emoji: "⛰️",
    title: "Mountain Adventure",
    events: [
      {
        id: "e4",
        time: "9:00 AM",
        title: "Mount Batur Hiking",
        type: "🏔️ Adventure",
        categoryColor: "#FF6347",
        categoryBg: "#FFECDB",
        duration: "4–5 hrs",
        cost: "$50",
        votes: 5,
        image: MOUNT_BATUR_IMG,
      },
      {
        id: "e5",
        time: "1:00 PM",
        title: "Temple Wat Culcut",
        type: "🏛️ Culture",
        categoryColor: "#FFD700",
        categoryBg: "#FFF8DC",
        duration: "1–2 hrs",
        cost: "$20",
        votes: 4,
        image: TEMPLE_IMG,
      },
    ],
  },
  {
    day: 3,
    date: "Thu, May 23",
    emoji: "🏄",
    title: "Beach & Surf Day",
    events: [
      {
        id: "e6",
        time: "10:00 AM",
        title: "Surfing at Kuta Beach",
        type: "🌊 Water Sports",
        categoryColor: "#00BFFF",
        categoryBg: "#E0FFFF",
        duration: "3–4 hrs",
        cost: "$30",
        votes: 5,
        image: SURF_IMG,
      },
      {
        id: "e7",
        time: "3:00 PM",
        title: "Relax at Beach Club",
        type: "🍹 Relaxation",
        categoryColor: "#FF69B4",
        categoryBg: "#FFEBE9",
        duration: "2–3 hrs",
        cost: "$25",
        votes: 4,
        image: BEACH_CLUB_IMG,
      },
    ],
  },
];

export default function TripPlanScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tripId: routeTripId, planId: routePlanId } = useParams<{
    tripId: string;
    planId?: string;
  }>();
  const [searchParams] = useSearchParams();
  const versionIdParam = searchParams.get("versionId");
  const planIdParam = routePlanId ?? searchParams.get("planId");

  const tripId =
    routeTripId ??
    (typeof window !== "undefined" ? sessionStorage.getItem("currentTripId") : null);

  const isStoredPlanView = Boolean(planIdParam);
  const entrySource = parsePlanListEntrySource(
    (location.state as { entrySource?: unknown } | null)?.entrySource
  );

  const [tripName, setTripName] = useState("");
  const [tripDestination, setTripDestination] = useState("");
  const [tripDaysCount, setTripDaysCount] = useState(3);
  const [membersCount, setMembersCount] = useState(0);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [estPerPerson, setEstPerPerson] = useState<string>("$—");
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);
  const [viewingRecord, setViewingRecord] = useState<ItineraryRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planGenerating, setPlanGenerating] = useState(false);

  const {
    displayDays,
    totalActivities,
    transitByDay,
    adjustedStartByDay,
    timelineByDay,
    useSplitTimelineView,
  } = useTripPlanItineraryDisplay(isStoredPlanView ? null : tripId, isStoredPlanView ? null : itinerary);

  const isReadOnly = viewingRecord != null && !viewingRecord.isActive;
  const isActivePlan = Boolean(viewingRecord?.isActive && !versionIdParam);
  const isCommittedPlan = isItineraryCommitted(itinerary);
  const tripForDisplay = tripId ? getTripById(tripId) : null;
  const regenBlocked = tripForDisplay ? isRegenCapReached(tripForDisplay.regenCount) : false;
  const regensRemainingLabel = tripForDisplay
    ? regenBlocked
      ? regenCapMessage()
      : `${remainingRegenerations(tripForDisplay.regenCount)} of ${MAX_REGENERATIONS} free regenerations remaining`
    : null;
  const tripGenerationContext = tripId ? buildItineraryGenerationContextSync(tripId) : null;
  const planContextLabel = formatItineraryVersionLabel(
    itinerary?.generationContext,
    tripGenerationContext
  );

  const handleSavePlan = async () => {
    if (!tripId || !itinerary || savingPlan || isReadOnly) return;
    // Any trip member can finalize — commitActiveItinerary is not owner-gated in the app layer.
    setSavingPlan(true);
    try {
      const result = await commitActiveItinerary(tripId, itinerary);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setViewingRecord(result.record);
      setItinerary(result.record.payload);
      toast.success("Plan selected for the group!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save plan");
    } finally {
      setSavingPlan(false);
    }
  };

  const openTripEditor = (mode: "edit" | "ai") => {
    if (!tripId) return;
    const q = mode === "edit" ? "editPlan=1" : "aiEnhance=1";
    navigate(`/trips/${tripId}?${q}`);
  };

  const loadItineraryView = useCallback(async () => {
    if (!tripId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    setTripPlan(null);

    const trip = getTripById(tripId);
    if (trip) {
      setTripName(trip.name);
      setTripDestination(trip.destination);
      const tripMembers = getTripMembers(tripId);
      setMembersCount(tripMembers.length);
      setMembers(tripMembers);
    }

    if (planIdParam) {
      const plan = getPlanById(tripId, planIdParam);
      if (!plan) {
        setLoadError("That plan could not be found.");
        setItinerary(null);
        setViewingRecord(null);
        setLoading(false);
        return;
      }
      const days = Math.max(1, plan.itinerary.days?.length ?? trip?.tripDays ?? 3);
      setTripDaysCount(days);
      setTripPlan(plan);
      setItinerary(plan.itinerary);
      setViewingRecord(null);

      try {
        const profile = generateGroupPlanningProfile(tripId);
        if (profile) {
          const budget = (profile.groupBudgetLevel || "moderate").toLowerCase();
          const range = COST_RANGE_BY_BUDGET[budget] ?? COST_RANGE_BY_BUDGET.moderate;
          const perDay =
            range.minPerDay && range.maxPerDay
              ? (range.minPerDay + range.maxPerDay) / 2
              : range.maxPerDay ?? range.minPerDay ?? 100;
          const total = perDay * days;
          const rounded = Math.round(total / 10) * 10;
          setEstPerPerson(`$${rounded}`);
        }
      } catch {
        setEstPerPerson("$—");
      }
      setLoading(false);
      return;
    }

    if (trip) {
      const days = Math.max(1, trip.tripDays ?? 3);
      setTripDaysCount(days);

      try {
        const profile = generateGroupPlanningProfile(tripId);
        if (profile) {
          const budget = (profile.groupBudgetLevel || "moderate").toLowerCase();
          const range = COST_RANGE_BY_BUDGET[budget] ?? COST_RANGE_BY_BUDGET.moderate;
          const perDay =
            range.minPerDay && range.maxPerDay
              ? (range.minPerDay + range.maxPerDay) / 2
              : range.maxPerDay ?? range.minPerDay ?? 100;
          const total = perDay * days;
          const rounded = Math.round(total / 10) * 10;
          setEstPerPerson(`$${rounded}`);
        }
      } catch {
        setEstPerPerson("$—");
      }
    }

    try {
      let record: ItineraryRecord | null = null;

      if (versionIdParam) {
        const history = await getItineraryHistory(tripId);
        record = history.find((r) => r.id === versionIdParam) ?? null;
        if (!record) {
          setLoadError("That plan version could not be found.");
          setItinerary(null);
          setViewingRecord(null);
          return;
        }
      } else {
        record = await getActiveItinerary(tripId);
      }

      if (!record?.payload || !trip) {
        setItinerary(null);
        setViewingRecord(null);
        return;
      }

      setViewingRecord(record);
      setItinerary(record.payload);
    } finally {
      setLoading(false);
    }
  }, [tripId, versionIdParam, planIdParam]);

  useEffect(() => {
    if (!tripId) return;
    let wasGenerating = isItineraryGenerating(tripId);
    setPlanGenerating(wasGenerating);
    return subscribeItineraryGenerating(() => {
      const now = isItineraryGenerating(tripId);
      setPlanGenerating(now);
      if (wasGenerating && !now) {
        void loadItineraryView();
      }
      wasGenerating = now;
    });
  }, [tripId, loadItineraryView]);

  const handleRegeneratePreview = () => {
    if (!tripId || planGenerating || regenBlocked) return;
    void (async () => {
      try {
        await generateItinerary(tripId);
        await loadItineraryView();
        toast.success("Preview updated!");
      } catch (err) {
        if (isRegenCapReachedError(err)) {
          toast.error(err.message);
        } else if (isItineraryGenerationError(err)) {
          toast.error(err.message);
        } else {
          toast.error(err instanceof Error ? err.message : "Failed to regenerate preview");
        }
      }
    })();
  };

  useEffect(() => {
    if (typeof window !== "undefined" && tripId) {
      sessionStorage.setItem("currentTripId", tripId);
    }
    void loadItineraryView();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when trip/version/plan changes only
  }, [tripId, versionIdParam, planIdParam]);

  useEffect(() => {
    if (!tripId || versionIdParam || planIdParam) return;
    return subscribeTripCloudSync(tripId, (result) => {
      if (result.itineraryUpdated) {
        const next = result.activeItinerary?.payload ?? null;
        setItinerary((prev) => {
          if (prev === null && next === null) return prev;
          if (prev === null || next === null) return next;
          return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
        });
        if (result.activeItinerary) {
          setViewingRecord(result.activeItinerary);
        }
      }
    });
  }, [tripId, versionIdParam, planIdParam]);

  const handleRestoreVersion = async () => {
    if (!tripId || !viewingRecord || restoring) return;
    setRestoring(true);
    try {
      await restoreItineraryVersion(tripId, viewingRecord.id);
      toast.success("Earlier plan restored.");
      navigate(`/trips/${tripId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restore version");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F7F7]">
      {/* Hero */}
      <div className="relative w-full h-56">
        <img src={BALI_IMG} alt="Bali" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/70" />
        
        {/* Top buttons */}
        <button
          onClick={() => {
            if (isStoredPlanView && tripId) {
              navigate(`/trips/${tripId}/plans`, { state: { entrySource } });
            } else if (tripId) navigate(`/trips/${tripId}`);
            else navigate("/trip-detail");
          }}
          className="absolute top-12 left-4 w-10 h-10 rounded-xl bg-white/90 backdrop-blur flex items-center justify-center shadow-lg"
        >
          <ArrowLeft size={20} className="text-[#4B4B4B]" />
        </button>

        <div className="absolute top-12 right-4 flex gap-2">
          <button className="w-10 h-10 rounded-xl bg-white/90 backdrop-blur flex items-center justify-center shadow-lg">
            <Share2 size={18} className="text-[#4B4B4B]" />
          </button>
          <button className="w-10 h-10 rounded-xl bg-white/90 backdrop-blur flex items-center justify-center shadow-lg">
            <Download size={18} className="text-[#4B4B4B]" />
          </button>
        </div>

        <div className="absolute bottom-4 left-5 right-5">
          <h1 className="text-white font-black text-2xl">{tripName} 🌴</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <div className="flex items-center gap-1">
              <MapPin size={13} className="text-white/80" />
              <span className="text-white/80 text-xs font-bold">{tripDestination}</span>
            </div>
            <div className="flex items-center gap-1">
              <CalendarDays size={13} className="text-white/80" />
              <span className="text-white/80 text-xs font-bold">{tripDaysCount} days</span>
            </div>
            {isReadOnly && (
              <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#FFD900]/95 border border-[#E5C400] text-[#3C3C3C]">
                Earlier version
              </span>
            )}
            {isActivePlan && !isReadOnly && (
              <span
                className={`text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                  isCommittedPlan
                    ? "bg-[#58CC02]/95 border-[#46A302] text-white"
                    : "bg-[#FFD900]/95 border-[#E5C400] text-[#3C3C3C]"
                }`}
              >
                {isCommittedPlan ? "Active plan" : "Preview"}
              </span>
            )}
          </div>
        </div>
      </div>

      {isStoredPlanView && tripId ? (
        tripPlan ? (
          <TripPlanDetailView
            tripId={tripId}
            tripPlan={tripPlan}
            itinerary={itinerary ?? undefined}
            entrySource={entrySource}
            layout="page"
            loading={loading}
            loadError={loadError}
            onPlanChange={setTripPlan}
          />
        ) : (
          <div className="px-5 pt-5">
            <TripPlanItineraryList
              displayDays={[]}
              members={members}
              transitByDay={{}}
              adjustedStartByDay={{}}
              timelineByDay={null}
              useSplitTimelineView={false}
              loading={loading}
              loadError={loadError}
              onBackToTrip={() => navigate(`/trips/${tripId}`)}
            />
          </div>
        )
      ) : (
        <>
      {/* Alert Banner */}
      {isReadOnly && (
        <div className="mx-5 mt-4 flex flex-col gap-3">
          <div className="bg-[#FFF8D6] rounded-2xl border-2 border-[#FFD900] shadow-[0_3px_0_#E5C400] p-4">
            <p className="text-sm font-bold text-[#4B4B4B]">
              You&apos;re viewing an older version of this plan.
            </p>
          </div>
          <button
            type="button"
            disabled={restoring}
            onClick={() => void handleRestoreVersion()}
            className="w-full py-3.5 rounded-2xl border-2 border-[#1CB0F6] bg-white text-[#1CB0F6] font-black text-sm shadow-[0_3px_0_#B3E4FF] disabled:opacity-50"
          >
            {restoring ? "Restoring…" : "Restore this version"}
          </button>
        </div>
      )}

      {!isReadOnly && itinerary && isActivePlan && !isStoredPlanView && (
        <div className="mx-5 mt-3">
          <p className="text-xs font-bold text-[#777] leading-snug">
            {planContextLabel.title}
            {planContextLabel.subtitle ? ` · ${planContextLabel.subtitle}` : ""}
          </p>
          {!isCommittedPlan && (
            <p className="text-[11px] font-bold text-[#6B5A00] mt-1">
              Save to keep this plan — regenerating replaces an unsaved preview.
            </p>
          )}
        </div>
      )}

      <div className="mx-5 mt-4">
        <TripPlanStatsCard
          tripDaysCount={tripDaysCount}
          totalActivities={totalActivities}
          membersCount={membersCount}
          estPerPerson={estPerPerson}
          variant="selected"
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
          contentPaddingBottom={Boolean(isActivePlan && itinerary)}
          onBackToTrip={tripId ? () => navigate(`/trips/${tripId}`) : undefined}
        />
      </div>
        </>
      )}

      {isActivePlan && itinerary && !isReadOnly && !isStoredPlanView && (
        <DuoStickyFooter>
          {!isCommittedPlan ? (
            <div className="flex flex-col gap-3">
              <DuoButton fullWidth disabled={savingPlan || planGenerating} onClick={() => void handleSavePlan()}>
                {savingPlan ? "Selecting…" : "Select"}
              </DuoButton>
              <DuoButton
                variant="secondary"
                fullWidth
                disabled={planGenerating || regenBlocked || savingPlan}
                onClick={handleRegeneratePreview}
              >
                {planGenerating ? "Generating…" : "Regenerate preview"}
              </DuoButton>
              {regensRemainingLabel && (
                <p className="text-xs font-bold text-[#AFAFAF] text-center">{regensRemainingLabel}</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <DuoButton
                variant="secondary"
                fullWidth
                onClick={() => openTripEditor("edit")}
                className="flex items-center justify-center gap-2"
              >
                <Pencil size={18} />
                Edit plan
              </DuoButton>
              <DuoButton
                fullWidth
                onClick={() => openTripEditor("ai")}
                className="flex items-center justify-center gap-2"
              >
                <Sparkles size={18} />
                AI improve
              </DuoButton>
            </div>
          )}
        </DuoStickyFooter>
      )}

      <div className="h-6" aria-hidden />

    </div>
  );
}