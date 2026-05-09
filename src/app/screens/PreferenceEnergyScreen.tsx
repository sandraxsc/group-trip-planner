import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { DuoButton } from "../components/DuoButton";
import { getMemberPreference, saveMemberPreference } from "../../services/preferenceService";
import { PreferenceProgressHeader } from "../components/PreferenceProgressHeader";
import type { EnergyLevel } from "../../types/preference";

function mapEnergyOptionToLevel(id: string): EnergyLevel {
  if (id === "peace" || id === "walk") return "low";
  if (id === "balanced") return "medium";
  if (id === "athlete") return "high";
  return "medium";
}

const energyLevels = [
  { 
    id: "peace", 
    label: "Peace", 
    emoji: "🧘", 
    desc: "Relaxing and slow-paced",
    color: "#CE82FF",
    border: "#A760D8",
    bg: "#F4ECFF",
  },
  { 
    id: "walk", 
    label: "Walk", 
    emoji: "🚶", 
    desc: "Leisurely exploration",
    color: "#1CB0F6",
    border: "#0B8FCC",
    bg: "#E8F7FF",
  },
  { 
    id: "balanced", 
    label: "Balanced", 
    emoji: "⚖️", 
    desc: "Mix of activity and rest",
    color: "#58CC02",
    border: "#46A302",
    bg: "#F0FDE4",
  },
  { 
    id: "athlete", 
    label: "Athlete", 
    emoji: "🏃", 
    desc: "High energy adventures",
    color: "#FF4B4B",
    border: "#CC3C3C",
    bg: "#FFEBEB",
  },
];

export default function PreferenceEnergyScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as { tripId?: string; memberId?: string }) ?? {};
  const [selected, setSelected] = useState<string | null>(null);

  // Prefill from saved progress (auto-resume)
  useEffect(() => {
    if (!state.tripId || !state.memberId) return;
    const pref = getMemberPreference(state.tripId, state.memberId);
    if (pref?.energyLevel) {
      const mapped =
        pref.energyLevel === "low"
          ? "peace"
          : pref.energyLevel === "high"
            ? "athlete"
            : "balanced";
      setSelected(mapped);
    }
  }, [state.tripId, state.memberId]);

  // Auto-save (debounced) as user selects
  useEffect(() => {
    if (!selected || !state.tripId || !state.memberId) return;
    const t = window.setTimeout(() => {
      saveMemberPreference(state.tripId!, state.memberId!, {
        energyLevel: mapEnergyOptionToLevel(selected),
      });
    }, 250);
    return () => window.clearTimeout(t);
  }, [selected, state.tripId, state.memberId]);

  const selectedOption = energyLevels.find((e) => e.id === selected);

  const handleContinue = () => {
    if (selected && state?.tripId && state?.memberId) {
      saveMemberPreference(state.tripId, state.memberId, {
        energyLevel: mapEnergyOptionToLevel(selected),
      });
    }
    navigate("/preference-time", { state });
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <PreferenceProgressHeader
        currentStep={2}
        totalSteps={6}
        title={"Energy level"}
        subtitle={"How active do you want to be?"}
        leftSlot={
          <button
            onClick={() => navigate("/preference-budget", { state })}
            className="w-10 h-10 rounded-xl bg-white border-2 border-[#E5E5E5] flex items-center justify-center shadow-[0_3px_0_#D4D4D4] active:translate-y-0.5 active:shadow-none transition-all"
          >
            <ArrowLeft size={20} className="text-[#4B4B4B]" />
          </button>
        }
        rightSlot={
          <button
            onClick={() => selected && handleContinue()}
            className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 shadow-[0_3px_0_#D4D4D4] active:translate-y-0.5 active:shadow-none transition-all ${
              selected
                ? "bg-[#1CB0F6] border-[#0B8FCC] shadow-[0_3px_0_#0B8FCC]"
                : "bg-white border-[#E5E5E5] opacity-50"
            }`}
            disabled={!selected}
          >
            <ArrowRight size={20} className={selected ? "text-white" : "text-[#4B4B4B]"} />
          </button>
        }
      />

      <div className="px-5 flex flex-col flex-1">
        {/* Title */}
        <div className="mb-8 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-[#E8F7FF] rounded-full flex items-center justify-center border-4 border-[#1CB0F6] shadow-[0_4px_0_#0B8FCC] relative">
            <span className="text-4xl">
              {selectedOption?.emoji || "😊"}
            </span>
            {/* Decorative elements */}
            {selected && (
              <>
                <div className="absolute -top-2 -right-2 w-10 h-10 bg-[#FFD900] rounded-full shadow-[0_3px_0_#E5C400] flex items-center justify-center animate-bounce">
                  <span className="text-xl">✨</span>
                </div>
                <div className="absolute -bottom-2 -left-2 w-8 h-8 bg-[#CE82FF] rounded-full shadow-[0_3px_0_#A760D8]" />
              </>
            )}
          </div>
          {/* Title moved to shared header */}
        </div>

        {/* Options */}
        <div className="flex flex-col gap-3 mb-8">
          {energyLevels.map((opt) => {
            const isSelected = selected === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setSelected(opt.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-b-4 transition-all active:border-b-2 active:translate-y-0.5 text-left
                  ${isSelected
                    ? `border-[${opt.border}] shadow-[0_4px_0_${opt.border}]`
                    : "border-[#E5E5E5] shadow-[0_4px_0_#D4D4D4]"
                  }`}
                style={
                  isSelected
                    ? { backgroundColor: opt.bg, borderColor: opt.border, boxShadow: `0 4px 0 ${opt.border}` }
                    : {}
                }
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ backgroundColor: isSelected ? opt.bg : "#F7F7F7", border: isSelected ? `2px solid ${opt.border}` : "2px solid #E5E5E5" }}
                >
                  {opt.emoji}
                </div>
                <div className="flex-1">
                  <span className="font-black text-[#3C3C3C] block">{opt.label}</span>
                  <p className="text-xs font-bold text-[#AFAFAF] mt-0.5">{opt.desc}</p>
                </div>
                <div
                  className={`w-6 h-6 rounded-full border-[3px] flex items-center justify-center flex-shrink-0 transition-all`}
                  style={{ borderColor: isSelected ? opt.color : "#E5E5E5", backgroundColor: isSelected ? opt.color : "transparent" }}
                >
                  {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-auto pb-8">
          <DuoButton
            onClick={handleContinue}
            variant="primary"
            fullWidth
            className="py-4 text-base"
            disabled={!selected}
          >
            Continue →
          </DuoButton>
        </div>
      </div>
    </div>
  );
}