import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { ArrowLeft } from "lucide-react";
import { DuoButton } from "../components/DuoButton";
import { updateMemberPreferenceStatus } from "../../services/tripService";
import { getMemberPreference, saveMemberPreference } from "../../services/preferenceService";
import { PreferenceProgressHeader } from "../components/PreferenceProgressHeader";
import type { BudgetLevel } from "../../types/preference";

const budgetOptions = [
  {
    id: "budget",
    emoji: "🎒",
    label: "Budget",
    desc: "Hostels, street food & free activities",
    range: "< $50/day",
    color: "#10B954",
    border: "#0D9443",
    bg: "#E6F4EA",
  },
  {
    id: "moderate",
    emoji: "🏨",
    label: "Moderate",
    desc: "Mid-range hotels & local restaurants",
    range: "$50–$150/day",
    color: "#1CB0F6",
    border: "#0A91D1",
    bg: "#E8F7FF",
  },
  {
    id: "luxury",
    emoji: "✨",
    label: "Luxury",
    desc: "Premium hotels & fine dining",
    range: "$150+/day",
    color: "#A78BFA",
    border: "#7C3AED",
    bg: "#F5F3FF",
  },
];

export default function PreferenceBudgetScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { tripId?: string; memberId?: string } | null;
  const tripId = state?.tripId ?? sessionStorage.getItem("currentTripId");
  const memberId = state?.memberId ?? sessionStorage.getItem("currentMemberId");
  const [selected, setSelected] = useState<string | null>(null);

  // Prefill from saved progress (auto-resume)
  useEffect(() => {
    if (!tripId || !memberId) return;
    const pref = getMemberPreference(tripId, memberId);
    if (pref?.budgetLevel) setSelected(pref.budgetLevel);
  }, [tripId, memberId]);

  // Auto-save as user selects (debounced)
  useEffect(() => {
    if (!selected || !tripId || !memberId) return;
    const t = window.setTimeout(() => {
      saveMemberPreference(tripId, memberId, { budgetLevel: selected as BudgetLevel });
    }, 250);
    return () => window.clearTimeout(t);
  }, [selected, tripId, memberId]);

  useEffect(() => {
    if (memberId) updateMemberPreferenceStatus(memberId, "in_progress");
  }, [memberId]);

  const handleBack = () => (tripId ? navigate(`/trips/${tripId}`) : navigate("/trip-detail-empty"));

  const handleContinue = () => {
    if (selected && tripId && memberId) {
      saveMemberPreference(tripId, memberId, {
        budgetLevel: selected as BudgetLevel,
      });
    }
    navigate("/preference-energy", { state: { tripId, memberId } });
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <PreferenceProgressHeader
        currentStep={1}
        totalSteps={7}
        title={"What's your budget?"}
        subtitle={"Choose a budget level that fits your style"}
        leftSlot={
          <button
            onClick={handleBack}
            className="w-10 h-10 rounded-xl bg-white border-2 border-[#E8E8E8] flex items-center justify-center shadow-[0_3px_0_#C4C4C4] active:translate-y-0.5 active:shadow-none transition-all"
          >
            <ArrowLeft size={20} className="text-[#6B7280]" />
          </button>
        }
      />

      <div className="px-5 flex flex-col flex-1">
        {/* Title */}
        <div className="mb-8 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-[#FFF8E1] rounded-full flex items-center justify-center border-4 border-[#FFB000] shadow-[0_4px_0_#CC8C00]">
            <span className="text-4xl">💰</span>
          </div>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-3 mb-8">
          {budgetOptions.map((opt) => {
            const isSelected = selected === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setSelected(opt.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-b-4 transition-all active:border-b-2 active:translate-y-0.5 text-left
                  ${isSelected
                    ? `border-[${opt.border}] shadow-[0_4px_0_${opt.border}]`
                    : "border-[#E8E8E8] shadow-[0_4px_0_#C4C4C4]"
                  }`}
                style={
                  isSelected
                    ? { backgroundColor: opt.bg, borderColor: opt.border, boxShadow: `0 4px 0 ${opt.border}` }
                    : {}
                }
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ backgroundColor: isSelected ? opt.bg : "#F7F7F6", border: isSelected ? `2px solid ${opt.border}` : "2px solid #E8E8E8" }}
                >
                  {opt.emoji}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-[#1F302E]">{opt.label}</span>
                    <span
                      className="text-xs font-black px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: isSelected ? opt.bg : "#F7F7F6", color: isSelected ? opt.color : "#6B7280", border: `2px solid ${isSelected ? opt.border : "#E8E8E8"}` }}
                    >
                      {opt.range}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-[#6B7280] mt-0.5">{opt.desc}</p>
                </div>
                <div
                  className={`w-6 h-6 rounded-full border-[3px] flex items-center justify-center flex-shrink-0 transition-all`}
                  style={{ borderColor: isSelected ? opt.color : "#E8E8E8", backgroundColor: isSelected ? opt.color : "transparent" }}
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