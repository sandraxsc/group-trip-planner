/**
 * Plan list screen — `/trips/:tripId/plans`
 *
 * Shows all generated plans for a trip with stable "Plan N" labels and a
 * "Generate another plan" CTA. Handles two entry sources via location state:
 * - `"generate"` — user is browsing plans after generating one
 * - `"select"` — user needs to pick the group's active plan; if only one plan
 *   exists the screen shortcuts directly to that plan's detail view
 *
 * The CTA fires `generateAndCommitPlan` and navigates to the trip's
 * itinerary tab immediately — generation keeps running there via the
 * tripId-tracked global status, so there's no need to wait on this screen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { DuoBadge } from "../components/DuoBadge";
import { DuoButton } from "../components/DuoButton";
import { DuoStickyFooter } from "../components/DuoStickyFooter";
import { duoUi } from "../constants/duoUi";
import { getActiveItinerary } from "../../services/itineraryCloudStore";
import {
  generateAndCommitPlan,
  isItineraryGenerationError,
} from "../../services/itineraryService";
import { generateGroupPlanningProfile, COST_RANGE_BY_BUDGET } from "../../services/planningService";
import { getTripById } from "../../services/tripService";
import {
  getAllTripPlans,
  MAX_REGENERATIONS,
  selectAndCommitPlan,
  syncMissingPlansFromActiveItinerary,
} from "../../services/tripPlanService";
import { toast } from "sonner";
import type { Itinerary, TripPlan } from "../../types/itinerary";
import {
  parsePlanListEntrySource,
  type PlanListEntrySource,
} from "../../types/planList";
import { buildPlanListItems } from "../utils/planListUtils";
import {
  isRegenCapReached,
  isRegenCapReachedError,
  regenCapMessage,
  remainingRegenerations,
} from "../../utils/regenCap";
import {
  isItineraryGenerating,
  subscribeItineraryGenerating,
  getInsightProgress,
  subscribeInsightProgress,
  type DayInsightProgress,
} from "../../utils/itineraryGenerationStatus";
import { dayReasoningBullets } from "../utils/itineraryDisplayHelpers";

function countItineraryActivities(itinerary: Itinerary): number {
  return itinerary.days.reduce((acc, day) => {
    const blockCount = day.blocks.reduce((sum, block) => sum + block.activities.length, 0);
    const mealCount =
      (day.lunchSlot?.activity ? 1 : 0) + (day.dinnerSlot?.activity ? 1 : 0);
    return acc + blockCount + mealCount;
  }, 0);
}

function estimatePerPerson(tripId: string, dayCount: number): string {
  try {
    const profile = generateGroupPlanningProfile(tripId);
    if (!profile) return "$—";
    const budget = (profile.groupBudgetLevel || "moderate").toLowerCase();
    const range = COST_RANGE_BY_BUDGET[budget] ?? COST_RANGE_BY_BUDGET.moderate;
    const perDay =
      range.minPerDay && range.maxPerDay
        ? (range.minPerDay + range.maxPerDay) / 2
        : range.maxPerDay ?? range.minPerDay ?? 100;
    const total = perDay * Math.max(1, dayCount);
    const rounded = Math.round(total / 10) * 10;
    return `$${rounded}`;
  } catch {
    return "$—";
  }
}


export default function TripPlansListScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tripId: routeTripId } = useParams<{ tripId: string }>();
  const tripId =
    routeTripId ??
    (typeof window !== "undefined" ? sessionStorage.getItem("currentTripId") : null);

  const entrySource: PlanListEntrySource = parsePlanListEntrySource(
    (location.state as { entrySource?: unknown } | null)?.entrySource
  );

  const [tripName, setTripName] = useState("Trip");
  const [regenCount, setRegenCount] = useState(0);
  const [plans, setPlans] = useState<TripPlan[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingInsights, setStreamingInsights] = useState<DayInsightProgress[]>([]);
  const selectShortcutDoneRef = useRef(false);

  const refreshPlans = useCallback(async () => {
    if (!tripId) return [] as TripPlan[];
    await getActiveItinerary(tripId).catch(() => null);
    syncMissingPlansFromActiveItinerary(tripId);
    const trip = getTripById(tripId);
    if (trip) {
      setTripName(trip.name);
      setRegenCount(trip.regenCount ?? 0);
    }
    const next = getAllTripPlans(tripId);
    setPlans(next);
    return next;
  }, [tripId]);

  useEffect(() => {
    if (!tripId) {
      navigate("/trips", { replace: true });
      return;
    }
    if (typeof window !== "undefined") {
      sessionStorage.setItem("currentTripId", tripId);
    }
    void (async () => {
      const loaded = await refreshPlans();
      if (loaded.length !== 1 || selectShortcutDoneRef.current) return;

      if (entrySource === "select") {
        selectShortcutDoneRef.current = true;
        navigate(`/trips/${tripId}/plans/${loaded[0]!.id}`, {
          replace: true,
          state: { entrySource: "select" },
        });
        return;
      }

      // "generate" entry: there's nothing to choose between (only one plan
      // exists) — commit it straight to the trip's active itinerary instead
      // of stopping on this list for an extra tap into "Plan 1".
      if (entrySource === "generate") {
        selectShortcutDoneRef.current = true;
        const result = await selectAndCommitPlan(tripId, loaded[0]!.id);
        if (result.ok) {
          navigate(`/trips/${tripId}`, { replace: true });
        } else {
          selectShortcutDoneRef.current = false;
        }
      }
    })();
  }, [tripId, navigate, refreshPlans, location.key, entrySource]);

  useEffect(() => {
    if (!tripId) return;
    let wasGenerating = isItineraryGenerating(tripId);
    setIsGenerating(wasGenerating);
    return subscribeItineraryGenerating(() => {
      const now = isItineraryGenerating(tripId);
      setIsGenerating(now);
      if (wasGenerating && !now) {
        void refreshPlans();
      }
      wasGenerating = now;
    });
  }, [tripId, refreshPlans]);

  useEffect(() => {
    if (!tripId) return;
    setStreamingInsights(getInsightProgress(tripId));
    return subscribeInsightProgress((changedTripId) => {
      if (changedTripId === tripId) {
        setStreamingInsights(getInsightProgress(tripId));
      }
    });
  }, [tripId]);

  useEffect(() => {
    const MIN_GAP_MS = 90_000;
    let lastRefreshAt = 0;
    const onFocus = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefreshAt < MIN_GAP_MS) return;
      lastRefreshAt = now;
      void refreshPlans();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refreshPlans]);

  const planItems = useMemo(() => buildPlanListItems(plans), [plans]);
  const newestPlanId = planItems[0]?.id ?? null;
  const regenBlocked = isRegenCapReached(regenCount);
  const regensRemaining = remainingRegenerations(regenCount);
  const generateButtonLabel =
    plans.length === 0 ? "Generate a plan" : "Generate another plan";

  const handleGenerate = () => {
    if (!tripId || isGenerating || regenBlocked) return;
    // Generation + commit runs to completion via the tripId-tracked global
    // status in itineraryGenerationStatus.ts, independent of this screen's
    // lifecycle — no need to wait here before navigating to the trip's
    // itinerary tab, which shows the same live "thinking" progress.
    void generateAndCommitPlan(tripId).catch((err) => {
      if (isRegenCapReachedError(err)) toast.error(err.message);
      else if (isItineraryGenerationError(err)) toast.error(err.message);
      else toast.error(err instanceof Error ? err.message : "Failed to generate plan");
    });
    navigate(`/trips/${tripId}`);
  };

  const handleOpenPlan = (planId: string) => {
    if (!tripId) return;
    navigate(`/trips/${tripId}/plans/${planId}`, { state: { entrySource } });
  };

  const handleBack = () => {
    if (tripId) navigate(`/trips/${tripId}`);
    else navigate("/trips");
  };

  return (
    <div className={`flex flex-col min-h-screen ${duoUi.pageBgDefault}`}>
      <div className={`${duoUi.headerBlock} flex items-center gap-3`}>
        <button
          type="button"
          onClick={handleBack}
          className="w-10 h-10 rounded-xl bg-white border-2 border-[#E8E8E8] flex items-center justify-center shadow-[0_3px_0_#C4C4C4] active:translate-y-0.5 active:shadow-none transition-all"
        >
          <ArrowLeft size={20} className="text-[#6B7280]" />
        </button>
        <h1 className="font-black text-[#1F302E] text-xl flex-1 text-center pr-10">
          Plans for {tripName}
        </h1>
      </div>

      <div className={`flex-1 ${duoUi.sectionX} pb-36`}>
        {entrySource === "select" && planItems.length > 0 && (
          <div className="mb-4 bg-[#F0F9FF] border-2 border-[#1CB0F6] rounded-2xl px-4 py-3 shadow-[0_3px_0_#0A91D1]">
            <p className="font-bold text-[#005F8A] text-sm leading-snug text-center">
              Pick the plan everyone will follow
            </p>
          </div>
        )}

        {planItems.length === 0 ? (
          <p className="font-bold text-[#6B7280] text-sm text-center py-10 leading-snug">
            No plans yet — generate your first one below
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {planItems.map((plan) => {
              const dayCount = plan.itinerary.days.length;
              const activityCount = countItineraryActivities(plan.itinerary);
              const estPerPerson = estimatePerPerson(tripId!, dayCount);
              const isHighlighted = plan.id === newestPlanId;
              return (
                <li key={plan.id}>
                  <button
                    type="button"
                    onClick={() => handleOpenPlan(plan.id)}
                    className={`w-full flex items-center gap-3 bg-white rounded-2xl border-2 px-4 py-4 text-left active:translate-y-0.5 transition-all ${
                      isHighlighted
                        ? "border-[#1CB0F6] shadow-[0_4px_0_#80CAFF]"
                        : "border-[#E8E8E8] shadow-[0_4px_0_#C4C4C4] active:shadow-[0_2px_0_#C4C4C4]"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-black text-[#1F302E] text-sm">
                          Plan {plan.planNumber}
                        </span>
                        {plan.id === newestPlanId && (
                          <DuoBadge label="Newest" variant="next" />
                        )}
                      </div>
                      <p className="font-bold text-[#6B7280] text-xs leading-snug">
                        {activityCount} {activityCount === 1 ? "activity" : "activities"} · est.{" "}
                        {estPerPerson}/person
                      </p>
                    </div>
                    <ChevronRight size={18} className="text-[#6B7280] shrink-0 pointer-events-none" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {isGenerating && (
          <div className="mt-4 bg-[#F0F9FF] border-2 border-[#1CB0F6] rounded-2xl p-4 shadow-[0_3px_0_#0A91D1]">
            <p className="font-black text-[#1F302E] text-sm mb-2">Generating your plan…</p>
            {streamingInsights.length === 0 ? (
              <p className="font-bold text-[#6B7280] text-xs leading-snug">
                This can take a few minutes. You&apos;ll land on the new plan when it&apos;s ready.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {streamingInsights.map((insight) => (
                  <div key={insight.dayNumber}>
                    <p className="font-black text-[#1CB0F6] text-[11px] uppercase tracking-wide mb-1">
                      Day {insight.dayNumber} · {insight.theme}
                    </p>
                    <ul className="space-y-1">
                      {dayReasoningBullets(insight.dayReasoning).map((bullet, i) => (
                        <li
                          key={`${insight.dayNumber}-${i}`}
                          className="flex gap-1.5 text-xs font-bold text-[#6B7280] leading-snug"
                        >
                          <span className="mt-[0.45em] h-1.5 w-1.5 rounded-full bg-[#1CB0F6] flex-shrink-0" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <p className="font-bold text-[#6B7280] text-xs leading-snug pt-1 border-t border-[#CCE9FC]">
                  You&apos;ll land on the new plan when it&apos;s ready.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <DuoStickyFooter>
        {regenBlocked ? (
          <p className="font-bold text-[#6B7280] text-sm text-center mb-2 leading-snug">
            {regenCapMessage()}
          </p>
        ) : (
          <DuoButton fullWidth disabled={isGenerating} onClick={handleGenerate}>
            {isGenerating ? "Generating…" : generateButtonLabel}
          </DuoButton>
        )}
        <p className="text-xs font-bold text-[#6B7280] text-center mt-2">
          {regensRemaining} of {MAX_REGENERATIONS} free regenerations remaining
        </p>
      </DuoStickyFooter>
    </div>
  );
}
