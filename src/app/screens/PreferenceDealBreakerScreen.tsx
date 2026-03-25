import { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { DuoButton } from "../components/DuoButton";
import { updateMemberPreferenceStatus } from "../../services/tripService";
import { saveMemberPreference } from "../../services/preferenceService";
import { PreferenceProgressHeader } from "../components/PreferenceProgressHeader";

const DEAL_BREAKERS = [
  {
    id: "crowded",
    emoji: "👥",
    title: "Crowded places",
    description: "Too many tourists",
    color: "#FF4B4B",
  },
  {
    id: "heights",
    emoji: "🏔️",
    title: "Heights",
    description: "Mountain activities, tall buildings",
    color: "#CE82FF",
  },
  {
    id: "water",
    emoji: "🌊",
    title: "Deep water",
    description: "Ocean, diving, swimming",
    color: "#1CB0F6",
  },
  {
    id: "animals",
    emoji: "🐍",
    title: "Wild animals",
    description: "Safaris, snakes, insects",
    color: "#FFD900",
  },
  {
    id: "spicy",
    emoji: "🌶️",
    title: "Spicy food",
    description: "Hot and spicy cuisine",
    color: "#FF6B35",
  },
  {
    id: "long-travel",
    emoji: "🚗",
    title: "Long travel times",
    description: "Extended car/bus rides",
    color: "#58CC02",
  },
];

export default function PreferenceDealBreakerScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { tripId?: string; memberId?: string } | null;
  const tripId = state?.tripId ?? sessionStorage.getItem("currentTripId");
  const memberId = state?.memberId ?? sessionStorage.getItem("currentMemberId");
  const [selected, setSelected] = useState<string | null>(null);

  const finishAndNavigate = (dealBreakerValue: string | null) => {
    if (tripId && memberId) {
      let selectedPlaces: string[] = [];
      try {
        const stored = sessionStorage.getItem("selectedPlaces");
        if (stored) {
          const arr = JSON.parse(stored) as Array<{ id?: string; name?: string }>;
          selectedPlaces = arr.map((p) => p.name || p.id || "").filter(Boolean);
        }
      } catch {
        // ignore
      }
      saveMemberPreference(tripId, memberId, {
        dealBreakers: dealBreakerValue ? [dealBreakerValue] : [],
        selectedPlaces,
      });
    }
    if (memberId) updateMemberPreferenceStatus(memberId, "completed");
    if (tripId) navigate(`/trips/${tripId}`);
    else navigate("/trip-detail");
  };

  const handleContinue = () => {
    if (selected) sessionStorage.setItem("dealBreaker", selected);
    finishAndNavigate(selected ?? null);
  };

  const handleSkip = () => {
    sessionStorage.removeItem("dealBreaker");
    finishAndNavigate(null);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-[#FFF8F0] to-[#F0FFF4]">
      <PreferenceProgressHeader
        currentStep={6}
        totalSteps={6}
        title={"Any deal breakers?"}
        subtitle={"Select 1 thing you'd like to avoid"}
        leftSlot={
          <button
            onClick={() =>
              navigate("/preference-place", { state: { tripId, memberId } })
            }
            className="w-10 h-10 rounded-xl bg-white border-2 border-[#E5E5E5] flex items-center justify-center shadow-[0_3px_0_#D4D4D4] active:translate-y-0.5 active:shadow-none transition-all"
          >
            <ArrowLeft size={20} className="text-[#4B4B4B]" />
          </button>
        }
      />

      {/* Avatar Area */}
      <div className="flex items-center justify-center px-5 pb-6">
        <div className="relative">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center border-4 border-[#FF4B4B] shadow-[0_6px_0_#CC3B3B]">
            <AlertCircle size={48} className="text-[#FF4B4B]" strokeWidth={2} />
          </div>
          {/* Decorative sparkles */}
          <div className="absolute -top-2 -right-2 text-2xl">⚠️</div>
          <div className="absolute -bottom-2 -left-2 text-xl">❌</div>
        </div>
      </div>

      {/* Title */}
      <div className="px-5 mb-2" />

      {/* Deal Breakers Grid */}
      <div className="flex-1 px-5 pb-6 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          {DEAL_BREAKERS.map((item) => {
            const isSelected = selected === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSelected(item.id)}
                className={`relative bg-white rounded-2xl border-2 border-b-4 p-4 transition-all active:border-b-2 active:translate-y-0.5 ${
                  isSelected
                    ? "border-[#FF4B4B] shadow-[0_4px_0_#CC3B3B]"
                    : "border-[#E5E5E5] shadow-[0_4px_0_#D4D4D4]"
                }`}
              >
                {/* Selected indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#FF4B4B] flex items-center justify-center">
                    <span className="text-white text-xs font-black">✓</span>
                  </div>
                )}

                {/* Content */}
                <div className="flex flex-col items-center text-center">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3 text-3xl"
                    style={{
                      backgroundColor: item.color + "20",
                      border: `2px solid ${item.color}40`,
                    }}
                  >
                    {item.emoji}
                  </div>
                  <h3 className="font-black text-[#3C3C3C] text-sm mb-1 leading-tight">
                    {item.title}
                  </h3>
                  <p className="text-[#AFAFAF] font-bold text-xs leading-tight">
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* None option */}
        <button
          onClick={() => setSelected("none")}
          className={`w-full mt-3 bg-white rounded-2xl border-2 border-b-4 p-4 transition-all active:border-b-2 active:translate-y-0.5 ${
            selected === "none"
              ? "border-[#58CC02] shadow-[0_4px_0_#46A302]"
              : "border-[#E5E5E5] shadow-[0_4px_0_#D4D4D4]"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl">😊</span>
            <div className="text-center">
              <h3 className="font-black text-[#3C3C3C] text-base">
                No deal breakers
              </h3>
              <p className="text-[#AFAFAF] font-bold text-sm">
                I'm open to everything!
              </p>
            </div>
            {selected === "none" && (
              <div className="w-6 h-6 rounded-full bg-[#58CC02] flex items-center justify-center ml-auto">
                <span className="text-white text-xs font-black">✓</span>
              </div>
            )}
          </div>
        </button>
      </div>

      {/* Buttons */}
      <div className="px-5 pb-8 flex flex-col gap-3">
        <DuoButton
          onClick={handleContinue}
          variant="primary"
          fullWidth
          className="py-4 text-base"
          disabled={!selected}
        >
          Continue →
        </DuoButton>
        
        <button
          onClick={handleSkip}
          className="py-3 text-center font-bold text-[#AFAFAF] text-sm"
        >
          Skip this step
        </button>
      </div>
    </div>
  );
}