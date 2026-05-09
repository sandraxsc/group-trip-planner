import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { ArrowLeft } from "lucide-react";
import { DuoButton } from "../components/DuoButton";
import { getMemberPreference, saveMemberPreference } from "../../services/preferenceService";
import { PreferenceProgressHeader } from "../components/PreferenceProgressHeader";

const activities = [
  { id: "beach", emoji: "🏖️", label: "Beach" },
  { id: "hiking", emoji: "🥾", label: "Hiking" },
  { id: "culture", emoji: "🏛️", label: "Culture" },
  { id: "food", emoji: "🍜", label: "Food" },
  { id: "nightlife", emoji: "🎉", label: "Nightlife" },
  { id: "shopping", emoji: "🛍️", label: "Shopping" },
  { id: "spa", emoji: "💆", label: "Wellness" },
  { id: "adventure", emoji: "🪂", label: "Adventure" },
  { id: "photography", emoji: "📸", label: "Photography" },
  { id: "wildlife", emoji: "🦜", label: "Wildlife" },
  { id: "history", emoji: "🏯", label: "History" },
  { id: "water", emoji: "🤿", label: "Water Sports" },
];

const colors = [
  { bg: "#F0FDE4", border: "#46A302", text: "#2D7800" },
  { bg: "#E8F7FF", border: "#0B8FCC", text: "#085F8A" },
  { bg: "#F9F0FF", border: "#A355CF", text: "#6B2F9B" },
  { bg: "#FFF8E7", border: "#E5C400", text: "#9B8000" },
  { bg: "#FFF0F0", border: "#CC3B3B", text: "#8A1F1F" },
];

export default function PreferenceActivityScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as { tripId?: string; memberId?: string }) ?? {};
  const [selected, setSelected] = useState<string[]>([]);

  // Prefill from saved progress (auto-resume)
  useEffect(() => {
    if (!state.tripId || !state.memberId) return;
    const pref = getMemberPreference(state.tripId, state.memberId);
    if (pref?.activityTypes?.length) setSelected(pref.activityTypes);
  }, [state.tripId, state.memberId]);

  // Auto-save (debounced) as user selects
  useEffect(() => {
    if (!state.tripId || !state.memberId) return;
    const t = window.setTimeout(() => {
      saveMemberPreference(state.tripId!, state.memberId!, { activityTypes: selected });
    }, 300);
    return () => window.clearTimeout(t);
  }, [selected, state.tripId, state.memberId]);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleContinue = () => {
    if (state?.tripId && state?.memberId) {
      saveMemberPreference(state.tripId, state.memberId, {
        activityTypes: selected,
      });
    }
    navigate("/preference-place", { state });
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <PreferenceProgressHeader
        currentStep={4}
        totalSteps={6}
        title={"What do you love?"}
        subtitle={"Pick all the activities you enjoy"}
        leftSlot={
          <button
            onClick={() => navigate("/preference-budget", { state })}
            className="w-10 h-10 rounded-xl bg-white border-2 border-[#E5E5E5] flex items-center justify-center shadow-[0_3px_0_#D4D4D4] active:translate-y-0.5 active:shadow-none transition-all"
          >
            <ArrowLeft size={20} className="text-[#4B4B4B]" />
          </button>
        }
      />

      <div className="px-5 flex flex-col flex-1">
        <div className="mb-6 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-[#E8F7FF] rounded-full flex items-center justify-center border-4 border-[#1CB0F6] shadow-[0_4px_0_#0B8FCC]">
            <span className="text-4xl">🎯</span>
          </div>
          <p className="text-[#AFAFAF] font-bold text-sm">
            {selected.length > 0 && (
              <span className="text-[#58CC02]">({selected.length} selected)</span>
            )}
          </p>
        </div>

        {/* Activity grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {activities.map((act, i) => {
            const colorSet = colors[i % colors.length];
            const isSelected = selected.includes(act.id);
            return (
              <button
                key={act.id}
                onClick={() => toggle(act.id)}
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 border-b-4 transition-all active:border-b-2 active:translate-y-0.5`}
                style={
                  isSelected
                    ? {
                        backgroundColor: colorSet.bg,
                        borderColor: colorSet.border,
                        boxShadow: `0 4px 0 ${colorSet.border}`,
                      }
                    : {
                        backgroundColor: "white",
                        borderColor: "#E5E5E5",
                        boxShadow: "0 4px 0 #D4D4D4",
                      }
                }
              >
                <span className="text-3xl">{act.emoji}</span>
                <span
                  className="text-xs font-black"
                  style={{ color: isSelected ? colorSet.text : "#AFAFAF" }}
                >
                  {act.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* XP reward hint */}
        {selected.length >= 3 && (
          <div className="bg-[#F0FDE4] rounded-2xl p-3 border-2 border-[#58CC02] flex items-center gap-3 mb-4">
            <span className="text-2xl">🏆</span>
            <p className="text-sm font-bold text-[#2D7800]">
              Great picks! You'll earn <span className="font-black">+50 XP</span> for setting preferences.
            </p>
          </div>
        )}

        <div className="mt-auto pb-8">
          <DuoButton
            onClick={handleContinue}
            variant="primary"
            fullWidth
            className="py-4 text-base"
            disabled={selected.length === 0}
          >
            Continue →
          </DuoButton>
        </div>
      </div>
    </div>
  );
}
