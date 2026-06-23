import { useNavigate, useLocation } from "react-router";
import { ArrowLeft } from "lucide-react";
import { updateMemberPreferenceStatus, getTripMembers } from "../../services/tripService";
import { getMemberPreference, saveMemberPreference } from "../../services/preferenceService";
import { PreferenceProgressHeader } from "../components/PreferenceProgressHeader";
import { MbtiTypeSelector } from "../components/MbtiTypeSelector";
import { duoUi } from "../constants/duoUi";
import type { MbtiType } from "../../constants/mbti";

export default function PreferenceMbtiScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { tripId?: string; memberId?: string } | null;
  const tripId = state?.tripId ?? sessionStorage.getItem("currentTripId");
  const memberId = state?.memberId ?? sessionStorage.getItem("currentMemberId");

  const savedMbti =
    tripId && memberId ? getMemberPreference(tripId, memberId)?.mbti ?? null : null;

  const finishAndNavigate = async (mbtiValue: string | null) => {
    if (tripId && memberId) {
      saveMemberPreference(tripId, memberId, { mbti: mbtiValue });
    }
    if (memberId) {
      await updateMemberPreferenceStatus(memberId, "completed");
    }
    if (tripId) {
      const members = getTripMembers(tripId);
      const currentMember = memberId ? members.find((m) => m.id === memberId) : null;
      const isOwner = currentMember?.role === "owner";

      if (isOwner) navigate(`/trips/${tripId}/preference-complete`);
      else navigate(`/trips/${tripId}/logistics-review`);
    } else navigate("/trip-detail");
  };

  const handleConfirmType = (type: MbtiType) => {
    void finishAndNavigate(type);
  };

  const handleSkip = () => {
    void finishAndNavigate(null);
  };

  return (
    <div className={`flex flex-col min-h-screen ${duoUi.pageBgPreferenceAccent}`}>
      <PreferenceProgressHeader
        currentStep={7}
        totalSteps={7}
        title="What's your MBTI type?"
        subtitle={
          <>
            Don&apos;t know yours? You can look it up at{" "}
            <a
              href="https://www.16personalities.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1CB0F6] underline underline-offset-2"
            >
              16personalities.com
            </a>
          </>
        }
        leftSlot={
          <button
            type="button"
            onClick={() =>
              navigate("/preference-deal-breaker", { state: { tripId, memberId } })
            }
            className="w-10 h-10 rounded-xl bg-white border-2 border-[#E5E5E5] flex items-center justify-center shadow-[0_3px_0_#D4D4D4] active:translate-y-0.5 active:shadow-none transition-all"
            aria-label="Back"
          >
            <ArrowLeft size={20} className="text-[#4B4B4B]" />
          </button>
        }
      />

      <div className="flex-1 px-5 pb-8 overflow-y-auto min-h-0">
        <MbtiTypeSelector
          initialType={savedMbti}
          onConfirm={handleConfirmType}
          onSkip={handleSkip}
          className="pb-2"
        />
      </div>
    </div>
  );
}
