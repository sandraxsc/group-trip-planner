import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router";
import { ArrowLeft } from "lucide-react";
import { DuoButton } from "../components/DuoButton";
import { DealBreakerBottomSheet } from "../components/DealBreakerBottomSheet";
import type { DealBreakerSelection as StoredDealBreakerSelection } from "../../types/preference";
import { getMemberPreference, saveMemberPreference } from "../../services/preferenceService";
import { PreferenceProgressHeader } from "../components/PreferenceProgressHeader";

export type DealBreakerTag = {
  id: string;
  label: string;
  hasNote?: boolean;
};

export type DealBreakerCategory = {
  id: string;
  emoji: string;
  /** Short label for the category grid tile */
  label: string;
  title: string;
  subtitle: string;
  hasSheet: boolean;
  tags: DealBreakerTag[];
  hasFreeText?: boolean;
};

const GRID_COLORS = [
  { bg: "#E6F4EA", border: "#0D9443", text: "#2D7800" },
  { bg: "#E8F7FF", border: "#0A91D1", text: "#085F8A" },
  { bg: "#F5F3FF", border: "#7C3AED", text: "#7C3AED" },
  { bg: "#FFF8E1", border: "#CC8C00", text: "#9B8000" },
  { bg: "#FFF0F0", border: "#CC3333", text: "#8A1F1F" },
];

export type DealBreakerSelection = {
  category: string;
  tags: string[];
  note?: string;
};

export const CATEGORIES: DealBreakerCategory[] = [
  {
    id: "dietary",
    emoji: "🍽️",
    label: "Dietary",
    title: "Dietary Restrictions",
    subtitle: "Vegetarian, halal, allergies…",
    hasSheet: true,
    tags: [
      { id: "vegetarian", label: "Vegetarian" },
      { id: "vegan", label: "Vegan" },
      { id: "halal", label: "Halal" },
      { id: "kosher", label: "Kosher" },
      { id: "no_pork", label: "No Pork" },
      { id: "seafood_allergy", label: "Seafood Allergy" },
      { id: "nut_allergy", label: "Nut Allergy" },
      { id: "dairy_free", label: "Dairy-Free" },
      { id: "gluten_free", label: "Gluten-Free" },
      { id: "other_allergy", label: "Other Allergy", hasNote: true },
    ],
  },
  {
    id: "alcohol_nightlife",
    emoji: "🍺",
    label: "Nightlife",
    title: "Alcohol & Nightlife",
    subtitle: "No bars, clubs, drinking experiences",
    hasSheet: true,
    tags: [
      { id: "no_alcohol", label: "No alcohol venues" },
      { id: "avoid_bars_clubs", label: "Avoid bars & clubs" },
      { id: "no_nightlife", label: "No nightlife activities" },
      { id: "avoid_party", label: "Avoid party environments" },
    ],
  },
  {
    id: "physical",
    emoji: "🏃",
    label: "Physical",
    title: "Physical Activity",
    subtitle: "Mobility limits, no strenuous activities",
    hasSheet: true,
    tags: [
      { id: "avoid_long_walking", label: "Avoid long walking" },
      { id: "avoid_hiking", label: "Avoid hiking" },
      { id: "avoid_strenuous", label: "Avoid strenuous activities" },
      { id: "need_rest_breaks", label: "Need frequent rest breaks" },
      { id: "limited_mobility", label: "Limited mobility" },
    ],
  },
  {
    id: "cultural_religious",
    emoji: "🕌",
    label: "Cultural",
    title: "Cultural & Religious",
    subtitle: "Prayer times, modest environments…",
    hasSheet: true,
    tags: [
      { id: "muslim", label: "Muslim" },
      { id: "jewish", label: "Jewish" },
      { id: "hindu", label: "Hindu" },
      { id: "buddhist", label: "Buddhist" },
      { id: "christian", label: "Christian" },
      { id: "observe_prayer_times", label: "Observe prayer times" },
      { id: "modest_environments", label: "Prefer modest environments" },
      { id: "avoid_religious_sites", label: "Avoid religious sites" },
      { id: "other_religion", label: "Other", hasNote: true },
    ],
  },
  {
    id: "schedule",
    emoji: "🌙",
    label: "Schedule",
    title: "Daily Schedule",
    subtitle: "No early mornings, slow pace…",
    hasSheet: true,
    tags: [
      { id: "avoid_early_mornings", label: "Avoid early mornings" },
      { id: "avoid_late_nights", label: "Avoid late-night activities" },
      { id: "flexible_schedule", label: "Prefer flexible schedule" },
      { id: "afternoon_breaks", label: "Need afternoon breaks" },
      { id: "slow_paced", label: "Prefer slow-paced itinerary" },
    ],
  },
  {
    id: "crowds",
    emoji: "👥",
    label: "Crowds",
    title: "Crowds & Environment",
    subtitle: "Quiet places, avoid tourist spots",
    hasSheet: true,
    tags: [
      { id: "avoid_crowded", label: "Avoid crowded places" },
      { id: "avoid_tourist_hotspots", label: "Avoid tourist hotspots" },
      { id: "prefer_quiet", label: "Prefer quiet environments" },
      { id: "avoid_social_heavy", label: "Avoid highly social activities" },
    ],
  },
  {
    id: "accessibility",
    emoji: "♿",
    label: "Access",
    title: "Accessibility Needs",
    subtitle: "Wheelchair, step-free access…",
    hasSheet: true,
    tags: [
      { id: "wheelchair_only", label: "Wheelchair accessible only" },
      { id: "elevator_required", label: "Elevator access required" },
      { id: "avoid_stairs", label: "Avoid stairs" },
      { id: "accessible_transport", label: "Accessible transportation needed" },
    ],
  },
  {
    id: "wild_animals",
    emoji: "🐍",
    label: "Wildlife",
    title: "Wild Animals",
    subtitle: "Safaris, snakes, insects…",
    hasSheet: true,
    tags: [
      { id: "avoid_safaris", label: "Avoid safaris" },
      { id: "avoid_snakes", label: "Avoid snakes & reptiles" },
      { id: "avoid_insects", label: "Avoid insect encounters" },
      { id: "avoid_zoos", label: "Avoid zoos & animal shows" },
    ],
  },
  {
    id: "other",
    emoji: "✍️",
    label: "Other",
    title: "Other Deal Breakers",
    subtitle: "Anything else to avoid",
    hasSheet: true,
    tags: [],
    hasFreeText: true,
  },
];

function categorySelectionCount(sel: DealBreakerSelection | undefined): number {
  if (!sel) return 0;
  const tagCount = sel.tags.length;
  const noteCount = sel.note?.trim() ? 1 : 0;
  return tagCount + noteCount;
}

function totalSelectionCount(selections: DealBreakerSelection[]): number {
  return selections.reduce((sum, s) => sum + categorySelectionCount(s), 0);
}

export default function PreferenceDealBreakerScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { tripId?: string; memberId?: string } | null;
  const tripId = state?.tripId ?? sessionStorage.getItem("currentTripId");
  const memberId = state?.memberId ?? sessionStorage.getItem("currentMemberId");

  const [selections, setSelections] = useState<DealBreakerSelection[]>([]);
  const [activeSheet, setActiveSheet] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId || !memberId) return;
    const pref = getMemberPreference(tripId, memberId);
    const saved = (pref?.dealBreakers ?? []) as StoredDealBreakerSelection[];
    setSelections(saved);
  }, [tripId, memberId]);

  const persistDealBreakers = useCallback(
    (nextSelections: DealBreakerSelection[]) => {
      if (!tripId || !memberId) return;
      saveMemberPreference(tripId, memberId, {
        dealBreakers: nextSelections,
      });
    },
    [tripId, memberId]
  );

  useEffect(() => {
    if (!tripId || !memberId) return;
    const t = window.setTimeout(() => {
      persistDealBreakers(selections);
    }, 300);
    return () => window.clearTimeout(t);
  }, [selections, tripId, memberId, persistDealBreakers]);

  const handleCategorySave = (updated: DealBreakerSelection) => {
    setSelections((prev) => {
      const without = prev.filter((s) => s.category !== updated.category);
      const hasContent = updated.tags.length > 0 || Boolean(updated.note?.trim());
      return hasContent ? [...without, updated] : without;
    });
    setActiveSheet(null);
  };

  const openCategorySheet = (categoryId: string) => {
    setActiveSheet(categoryId);
  };

  const goToMbtiStep = () => {
    if (tripId && memberId) {
      let selectedPlaces: string[] = getMemberPreference(tripId, memberId)?.selectedPlaces ?? [];
      if (selectedPlaces.length === 0) {
        try {
          const stored = sessionStorage.getItem("selectedPlaces");
          if (stored) {
            const arr = JSON.parse(stored) as Array<{ id?: string; name?: string }>;
            selectedPlaces = arr.map((p) => p.id || p.name || "").filter(Boolean);
          }
        } catch {
          // ignore
        }
      }
      persistDealBreakers(selections);
      saveMemberPreference(tripId, memberId, { selectedPlaces });
    }
    navigate("/preference-mbti", { state: { tripId, memberId } });
  };

  const handleContinue = () => {
    goToMbtiStep();
  };

  const handleSkip = () => {
    if (tripId && memberId) {
      saveMemberPreference(tripId, memberId, { dealBreakers: [] });
    }
    goToMbtiStep();
  };

  const activeCategory =
    activeSheet != null
      ? CATEGORIES.find((c) => c.id === activeSheet) ?? null
      : null;

  const selectedTotal = totalSelectionCount(selections);

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <PreferenceProgressHeader
        currentStep={6}
        totalSteps={7}
        title="What are your deal breakers?"
        subtitle="Things the group absolutely cannot do or encounter."
        leftSlot={
          <button
            onClick={() =>
              navigate("/preference-place", { state: { tripId, memberId } })
            }
            className="w-10 h-10 rounded-xl bg-white border-2 border-[#E8E8E8] flex items-center justify-center shadow-[0_3px_0_#C4C4C4] active:translate-y-0.5 active:shadow-none transition-all"
          >
            <ArrowLeft size={20} className="text-[#6B7280]" />
          </button>
        }
      />

      <div className="px-5 flex flex-col flex-1 overflow-y-auto">
        <div className="mb-4 text-center">
          <div className="w-20 h-20 mx-auto mb-3 bg-[#FFF0F0] rounded-full flex items-center justify-center border-4 border-[#FF5C5C] shadow-[0_4px_0_#CC3333]">
            <span className="text-4xl">⚠️</span>
          </div>
          <p className="text-[#6B7280] font-bold text-sm">
            Tap a category to pick restrictions
            {selectedTotal > 0 && (
              <span className="text-[#10B954]"> ({selectedTotal} selected)</span>
            )}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          {CATEGORIES.map((category, i) => {
            const sel = selections.find((s) => s.category === category.id);
            const count = categorySelectionCount(sel);
            const isActive = activeSheet === category.id;
            const isHighlighted = isActive || count > 0;
            const colorSet = GRID_COLORS[i % GRID_COLORS.length];

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => category.hasSheet && openCategorySheet(category.id)}
                className="relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 border-b-4 transition-all active:border-b-2 active:translate-y-0.5"
                style={
                  isHighlighted
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
                {count > 0 && (
                  <span
                    className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                    style={{ backgroundColor: colorSet.border }}
                  >
                    {count}
                  </span>
                )}
                <span className="text-3xl">{category.emoji}</span>
                <span
                  className="text-xs font-black text-center leading-tight"
                  style={{ color: isHighlighted ? colorSet.text : "#6B7280" }}
                >
                  {category.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-auto pb-8 flex flex-col gap-3">
        <DuoButton
          onClick={handleContinue}
          variant="primary"
          fullWidth
          className="py-4 text-base"
        >
          Continue →
        </DuoButton>

        <button
          onClick={handleSkip}
          className="py-3 text-center font-bold text-[#6B7280] text-sm"
        >
          Skip this step
        </button>
        </div>
      </div>

      <DealBreakerBottomSheet
        category={activeCategory}
        selections={selections}
        onSave={handleCategorySave}
        onClose={() => setActiveSheet(null)}
      />
    </div>
  );
}
