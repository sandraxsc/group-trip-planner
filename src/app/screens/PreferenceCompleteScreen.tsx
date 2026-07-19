import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { DuoButton } from "../components/DuoButton";
import { DuoAvatar } from "../components/DuoAvatar";
import type { DuoAvatarColorKey } from "../components/DuoAvatar";
import { DuoStickyFooter } from "../components/DuoStickyFooter";
import { duoUi } from "../constants/duoUi";
import { getTripById, getTripMembers } from "../../services/tripService";
import { subscribeTripCloudSync } from "../../services/cloudHydrateService";
import { generateItinerary, isItineraryGenerationError } from "../../services/itineraryService";
import { hasCachedActiveItinerary } from "../../services/itineraryCloudStore";
import {
  isRegenCapReached,
  isRegenCapReachedError,
  regenCapMessage,
  regenRemainingBannerFragment,
} from "../../utils/regenCap";
import {
  isItineraryGenerating,
  subscribeItineraryGenerating,
} from "../../utils/itineraryGenerationStatus";
import type { TripMember } from "../../types/trip";

const AVATAR_COLORS: DuoAvatarColorKey[] = ["green", "blue", "coral", "amber"];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function PreferenceCompleteScreen() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [members, setMembers] = useState<TripMember[]>([]);
  const [planGenerating, setPlanGenerating] = useState(false);
  const [generatingModalOpen, setGeneratingModalOpen] = useState(false);
  const leftWhileGeneratingRef = useRef(false);

  const trip = tripId ? getTripById(tripId) : null;

  useEffect(() => {
    if (!tripId) {
      navigate("/trips", { replace: true });
      return;
    }
    const refresh = () => setMembers(getTripMembers(tripId));
    refresh();
    return subscribeTripCloudSync(tripId, refresh);
  }, [tripId, navigate]);

  useEffect(() => {
    if (!tripId) return;
    let wasGenerating = isItineraryGenerating(tripId);
    setPlanGenerating(wasGenerating);
    setGeneratingModalOpen(wasGenerating);
    return subscribeItineraryGenerating(() => {
      const now = isItineraryGenerating(tripId);
      setPlanGenerating(now);
      if (!now) setGeneratingModalOpen(false);
      wasGenerating = now;
    });
  }, [tripId]);

  const completedCount = members.filter((m) => m.preferenceStatus === "completed").length;
  const totalCount = trip?.maxGuests ?? members.length;
  const pendingSlots = Math.max(0, totalCount - members.length);
  const allPreferencesComplete =
    totalCount > 0 && completedCount === totalCount;
  const progressPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const hasSavedItinerary = tripId ? hasCachedActiveItinerary(tripId) : false;
  const regenBlocked = trip ? isRegenCapReached(trip.regenCount) : false;

  const generateLabel = useMemo(() => {
    if (planGenerating) return "Generating…";
    if (hasSavedItinerary && trip?.isOutdated) return "Regenerate Plan";
    if (hasSavedItinerary) return "Regenerate Plan";
    if (!allPreferencesComplete && completedCount > 0) return "Generate Draft Plan";
    return "Generate Plan";
  }, [planGenerating, hasSavedItinerary, trip?.isOutdated, allPreferencesComplete, completedCount]);

  const handleBackToTrip = () => {
    if (!tripId) return;
    navigate(`/trips/${tripId}`);
  };

  const handleLeaveWhileGenerating = () => {
    if (!tripId) return;
    leftWhileGeneratingRef.current = true;
    setGeneratingModalOpen(false);
    toast.info("We're still building your plan. Come back to the trip page anytime to view it.");
    navigate(`/trips/${tripId}`);
  };

  const handleGenerate = () => {
    if (!tripId || planGenerating || regenBlocked) return;
    leftWhileGeneratingRef.current = false;
    setGeneratingModalOpen(true);
    void (async () => {
      try {
        await generateItinerary(tripId);
        if (leftWhileGeneratingRef.current) {
          // Trip page shows progress and toasts when the plan is ready.
        } else {
          toast.success("Plan ready! Open the Plan tab on the trip page to review.");
          navigate(`/trips/${tripId}`);
        }
      } catch (err) {
        setGeneratingModalOpen(false);
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

  return (
    <div className={`flex flex-col min-h-screen ${duoUi.pageBgSuccess}`}>
      <div className={`flex-1 flex flex-col items-center justify-center ${duoUi.sectionX} pb-44 pt-10`}>
        <div className="mb-8 relative">
          <div className="w-40 h-40 bg-white rounded-3xl border-4 border-[#10B954] shadow-[0_8px_0_#0D9443] flex items-center justify-center">
            <Sparkles size={80} className="text-[#10B954]" strokeWidth={1.5} />
          </div>
          <div className="absolute -top-4 -left-4 w-6 h-6 rounded-full bg-[#FFB000] shadow-[0_3px_0_#CC8C00]" />
          <div className="absolute -top-2 -right-6 w-8 h-8 rounded-full bg-[#1CB0F6] shadow-[0_4px_0_#0A91D1]" />
          <div className="absolute -bottom-3 -left-6 w-7 h-7 rounded-full bg-[#A78BFA] shadow-[0_3px_0_#7C3AED]" />
          <div className="absolute -bottom-4 -right-4 w-5 h-5 rounded-full bg-[#FF5C5C] shadow-[0_3px_0_#CC3333]" />
          <div className="absolute -top-3 -right-3 w-12 h-12 rounded-full bg-[#FFB000] border-2 border-white shadow-[0_3px_0_#CC8C00] flex items-center justify-center">
            <CheckCircle2 size={28} className="text-[#1F302E]" />
          </div>
        </div>

        <div className={`text-center mb-6 ${duoUi.contentWidth}`}>
          <h1 className="font-black text-[#1F302E] text-2xl mb-2">Preferences saved!</h1>
          <p className="font-bold text-[#777] text-sm leading-relaxed">
            {allPreferencesComplete
              ? trip?.name
                ? `You're all set for ${trip.name}. Review the trip or generate the group plan when you're ready.`
                : "You're all set. Review the trip or generate the group plan when you're ready."
              : trip?.name
                ? `Your preferences for ${trip.name} are saved. Check group readiness below before generating a plan.`
                : "Your preferences are saved. Check group readiness below before generating a plan."}
          </p>
        </div>

        <div className={`${duoUi.contentWidth} ${duoUi.card} p-4`}>
          <div className="flex items-center justify-between mb-2">
            <p className="font-black text-[#1F302E] text-xs uppercase tracking-wide">
              Group readiness
            </p>
            <p className="font-black text-[#1CB0F6] text-sm">
              {completedCount}/{totalCount || "?"}
            </p>
          </div>
          <div className={`${duoUi.progressTrack} mb-3`}>
            <div className={duoUi.progressFill} style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex flex-col gap-2 mb-3">
            {members.map((m, i) => (
              <div key={m.id} className="flex items-center gap-2">
                <DuoAvatar
                  initials={initials(m.name)}
                  colorKey={AVATAR_COLORS[i % AVATAR_COLORS.length] ?? "green"}
                  size="sm"
                />
                <span className="font-bold text-[#1F302E] text-sm flex-1 truncate">{m.name}</span>
                {m.preferenceStatus === "completed" ? (
                  <span className="text-xs font-black text-[#10B954]">Done</span>
                ) : (
                  <span className="text-xs font-bold text-[#6B7280]">Pending</span>
                )}
              </div>
            ))}
            {Array.from({ length: pendingSlots }).map((_, i) => (
              <div key={`pending-slot-${i}`} className="flex items-center gap-2 opacity-40">
                <div className="w-7 h-7 rounded-full bg-[#E8E8E8] border-2 border-[#C4C4C4] flex-shrink-0" />
                <span className="font-bold text-[#6B7280] text-sm flex-1">Waiting to join…</span>
                <span className="text-xs font-bold text-[#6B7280]">Not joined</span>
              </div>
            ))}
          </div>
          {!allPreferencesComplete && totalCount > 0 && (
            <div className={duoUi.alertAmber}>
              <p className="text-xs font-bold text-[#6B5A00] leading-snug">
                Not all members have completed preferences yet. Wait for them to finish, or
                generate a draft plan based on the preferences shared so far.
              </p>
            </div>
          )}
          {allPreferencesComplete && (
            <div className={duoUi.alertGreen}>
              <p className="text-xs font-bold text-[#2D7800] leading-snug">
                Everyone has shared preferences — great time to generate the group plan.
              </p>
            </div>
          )}
        </div>
      </div>

      <DuoStickyFooter>
        <div className="flex flex-col gap-3">
          <DuoButton
            variant="secondary"
            fullWidth
            onClick={planGenerating ? handleLeaveWhileGenerating : handleBackToTrip}
          >
            {planGenerating ? "Go to trip page" : "Back to Trip Page"}
          </DuoButton>
          <DuoButton fullWidth disabled={planGenerating || regenBlocked} onClick={handleGenerate}>
            {generateLabel}
          </DuoButton>
          {trip && (
            <p className="text-xs font-bold text-[#6B7280] text-center">
              {regenBlocked
                ? regenCapMessage()
                : regenRemainingBannerFragment(trip.regenCount)}
            </p>
          )}
        </div>
      </DuoStickyFooter>

      {generatingModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-5">
          <div className="bg-white rounded-3xl p-8 mx-6 text-center border-4 border-[#10B954] shadow-[0_8px_0_#0D9443] max-w-[402px] w-full">
            <span className="text-5xl block mb-4">✈️</span>
            <h2 className="font-black text-[#1F302E] text-xl mb-2">Generating your plan…</h2>
            <p className="font-bold text-[#6B7280] text-sm leading-relaxed mb-6">
              This can take a few minutes. Feel free to leave — we&apos;ll keep working in the
              background and you can view the plan on the trip page when it&apos;s ready.
            </p>
            <DuoButton variant="secondary" fullWidth onClick={handleLeaveWhileGenerating}>
              Go to trip page
            </DuoButton>
          </div>
        </div>
      )}
    </div>
  );
}
