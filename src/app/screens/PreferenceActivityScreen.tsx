import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { ArrowLeft } from "lucide-react";
import { DuoButton } from "../components/DuoButton";
import { getMemberPreference, saveMemberPreference } from "../../services/preferenceService";
import { PreferenceProgressHeader } from "../components/PreferenceProgressHeader";
import {
  ACTIVITY_TYPE_OTHER_ID,
  buildActivityTypesPreference,
  parseActivityTypesPreference,
} from "../../types/preference";

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
  { id: ACTIVITY_TYPE_OTHER_ID, emoji: "✍️", label: "Other" },
];

const colors = [
  { bg: "#E6F4EA", border: "#0D9443", text: "#2D7800" },
  { bg: "#E8F7FF", border: "#0A91D1", text: "#085F8A" },
  { bg: "#F5F3FF", border: "#7C3AED", text: "#7C3AED" },
  { bg: "#FFF8E1", border: "#CC8C00", text: "#9B8000" },
  { bg: "#FFF0F0", border: "#CC3333", text: "#8A1F1F" },
];

export default function PreferenceActivityScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as { tripId?: string; memberId?: string }) ?? {};
  const [selected, setSelected] = useState<string[]>([]);
  const [otherNote, setOtherNote] = useState("");

  const persist = (ids: string[], note: string) => {
    if (!state.tripId || !state.memberId) return;
    saveMemberPreference(state.tripId, state.memberId, buildActivityTypesPreference(ids, note));
  };

  useEffect(() => {
    if (!state.tripId || !state.memberId) return;
    const pref = getMemberPreference(state.tripId, state.memberId);
    if (!pref) return;
    const parsed = parseActivityTypesPreference(pref);
    if (parsed.selectedIds.length) setSelected(parsed.selectedIds);
    if (parsed.otherNote) setOtherNote(parsed.otherNote);
  }, [state.tripId, state.memberId]);

  useEffect(() => {
    if (!state.tripId || !state.memberId) return;
    const t = window.setTimeout(() => {
      persist(selected, otherNote);
    }, 300);
    return () => window.clearTimeout(t);
  }, [selected, otherNote, state.tripId, state.memberId]);

  const toggle = (id: string) => {
    if (id === ACTIVITY_TYPE_OTHER_ID && selected.includes(ACTIVITY_TYPE_OTHER_ID)) {
      setOtherNote("");
    }
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const otherSelected = selected.includes(ACTIVITY_TYPE_OTHER_ID);
  const canContinue = selected.length > 0;

  const handleContinue = () => {
    if (state?.tripId && state?.memberId) {
      persist(selected, otherNote);
    }
    navigate("/preference-place", { state });
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <PreferenceProgressHeader
        currentStep={4}
        totalSteps={7}
        title={"What do you love?"}
        subtitle={"Pick all the activities you enjoy"}
        leftSlot={
          <button
            onClick={() => navigate("/preference-budget", { state })}
            className="w-10 h-10 rounded-xl bg-white border-2 border-[#E8E8E8] flex items-center justify-center shadow-[0_3px_0_#C4C4C4] active:translate-y-0.5 active:shadow-none transition-all"
          >
            <ArrowLeft size={20} className="text-[#6B7280]" />
          </button>
        }
      />

      <div className="px-5 flex flex-col flex-1">
        <div className="mb-6 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-[#E8F7FF] rounded-full flex items-center justify-center border-4 border-[#1CB0F6] shadow-[0_4px_0_#0A91D1]">
            <span className="text-4xl">🎯</span>
          </div>
          <p className="text-[#6B7280] font-bold text-sm">
            {selected.length > 0 && (
              <span className="text-[#10B954]">({selected.length} selected)</span>
            )}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {activities.map((act, i) => {
            const colorSet = colors[i % colors.length];
            const isSelected = selected.includes(act.id);
            return (
              <button
                key={act.id}
                type="button"
                onClick={() => toggle(act.id)}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl border-2 border-b-4 transition-all active:border-b-2 active:translate-y-0.5"
                style={
                  isSelected
                    ? {
                        backgroundColor: colorSet.bg,
                        borderColor: colorSet.border,
                        boxShadow: `0 4px 0 ${colorSet.border}`,
                      }
                    : {
                        backgroundColor: "white",
                        borderColor: "#E8E8E8",
                        boxShadow: "0 4px 0 #C4C4C4",
                      }
                }
              >
                <span className="text-3xl">{act.emoji}</span>
                <span
                  className="text-xs font-black"
                  style={{ color: isSelected ? colorSet.text : "#6B7280" }}
                >
                  {act.label}
                </span>
              </button>
            );
          })}
        </div>

        {otherSelected && (
          <textarea
            value={otherNote}
            onChange={(e) => setOtherNote(e.target.value)}
            placeholder="Describe other activities you enjoy (e.g. pottery, live music, cycling)"
            rows={3}
            className="w-full rounded-2xl border-2 border-[#E8E8E8] bg-white px-4 py-3 text-[#1F302E] font-bold text-sm placeholder:text-[#6B7280] focus:outline-none focus:border-[#1CB0F6] resize-none mb-4"
          />
        )}

        {selected.filter((id) => id !== ACTIVITY_TYPE_OTHER_ID).length >= 3 && (
          <div className="bg-[#E6F4EA] rounded-2xl p-3 border-2 border-[#10B954] flex items-center gap-3 mb-4">
            <span className="text-2xl">🏆</span>
            <p className="text-sm font-bold text-[#2D7800]">
              Great picks! You'll earn <span className="font-black">+50 XP</span> for setting
              preferences.
            </p>
          </div>
        )}

        <div className="mt-auto pb-8">
          <DuoButton
            onClick={handleContinue}
            variant="primary"
            fullWidth
            className="py-4 text-base"
            disabled={!canContinue}
          >
            Continue →
          </DuoButton>
        </div>
      </div>
    </div>
  );
}

