import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router";
import {
  ArrowLeft,
  MapPin,
  X,
  Plus,
  Sparkles,
  Utensils,
  Landmark,
  Map,
  Check,
  Loader2,
  Star,
} from "lucide-react";
import { DuoButton } from "../components/DuoButton";
import { PreferenceProgressHeader } from "../components/PreferenceProgressHeader";
import { getMemberPreference, saveMemberPreference } from "../../services/preferenceService";
import { getTripById } from "../../services/tripService";
import { fetchPlacesForDestination } from "../../services/placeService";
import {
  fetchExploreRecommendations,
  type ExploreCategory,
  type ExplorePlaceSuggestion,
  type ExploreRecommendationsResponse,
} from "../../services/exploreService";

interface Place {
  id: string;
  name: string;
  subtitle: string;
  image: string;
}

const DEFAULT_PLACE_IMAGE =
  "https://images.unsplash.com/photo-1516426122078-c23e76319801?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";

interface ExploreCategoryDef {
  id: ExploreCategory;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  accent: string;
  bg: string;
  border: string;
}

const EXPLORE_CATEGORIES: ExploreCategoryDef[] = [
  {
    id: "restaurants",
    label: "Restaurants",
    description: "Iconic eateries and local favorites",
    icon: Utensils,
    accent: "#FFB000",
    bg: "#FFF4E5",
    border: "#FFD9A8",
  },
  {
    id: "attractions",
    label: "Attractions",
    description: "Landmarks and must-see sights",
    icon: Landmark,
    accent: "#1CB0F6",
    bg: "#F0F9FF",
    border: "#DFF6FF",
  },
  {
    id: "nearby_towns",
    label: "Nearby Towns",
    description: "Famous side-trips outside the city",
    icon: Map,
    accent: "#10B954",
    bg: "#E6F4EA",
    border: "#D5F4D0",
  },
];

const suggestionKey = (s: ExplorePlaceSuggestion): string =>
  `${s.name}|${s.searchQuery}`.toLowerCase();

/**
 * Real-world Google Places data resolved for an AI suggestion. Loaded eagerly
 * after recommendations come back so the cards can show a thumbnail, rating
 * and price level without the user having to click "Add" first.
 */
interface EnrichedSuggestion {
  status: "loading" | "ready" | "missing";
  /** Real Google placeId once resolved. */
  placeId?: string;
  /** Resolved display name (may differ from AI suggestion.name). */
  name?: string;
  /** Square thumbnail URL from Places photos, or null when none available. */
  imageUrl?: string | null;
  /** Specific category label e.g. "Indonesian restaurant" — overrides AI category context. */
  displayCategoryLabel?: string | null;
  rating?: number;
  /** Google priceLevel: 0 = free, 1-4 increasingly expensive. */
  priceLevel?: number;
}

/** Convert Google priceLevel (0-4) to a "$"…"$$$$" string, or null if unknown. */
function formatPriceLevel(priceLevel: number | undefined): string | null {
  if (typeof priceLevel !== "number" || priceLevel <= 0) return null;
  const clamped = Math.max(1, Math.min(4, Math.round(priceLevel)));
  return "$".repeat(clamped);
}

export default function PreferencePlaceScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as { tripId?: string; memberId?: string }) ?? {};
  const [addedPlaces, setAddedPlaces] = useState<Place[]>([]);

  const dedupeById = (list: Place[]): Place[] => {
    const seen = new Set<string>();
    return list.filter((p) => {
      const key = p?.id;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  useEffect(() => {
    const stored = sessionStorage.getItem("selectedPlaces");
    if (stored) {
      setAddedPlaces(dedupeById(JSON.parse(stored) as Place[]));
      return;
    }
    if (!state.tripId || !state.memberId) return;
    const pref = getMemberPreference(state.tripId, state.memberId);
    if (pref?.selectedPlaces?.length) {
      setAddedPlaces(
        dedupeById(
          pref.selectedPlaces.map((x) => ({
            id: x,
            name: x,
            subtitle: "Saved place",
            image: DEFAULT_PLACE_IMAGE,
          }))
        )
      );
    }
  }, []);

  // Save to sessionStorage whenever addedPlaces changes
  useEffect(() => {
    sessionStorage.setItem("selectedPlaces", JSON.stringify(addedPlaces));
  }, [addedPlaces]);

  useEffect(() => {
    const deduped = dedupeById(addedPlaces);
    if (deduped.length !== addedPlaces.length) {
      setAddedPlaces(deduped);
    }
  }, [addedPlaces]);

  // Persist selected place ids/names into MemberPreference (auto-save)
  useEffect(() => {
    if (!state.tripId || !state.memberId) return;
    const t = window.setTimeout(() => {
      saveMemberPreference(
        state.tripId!,
        state.memberId!,
        { selectedPlaces: addedPlaces.map((p) => p.id || p.name).filter(Boolean) }
      );
    }, 350);
    return () => window.clearTimeout(t);
  }, [addedPlaces, state.tripId, state.memberId]);

  const removePlace = (id: string) => {
    setAddedPlaces((prev) => prev.filter((p) => p.id !== id));
  };

  // ─── Explore (AI recommendations) ────────────────────────────────────────
  const [exploreOpen, setExploreOpen] = useState(false);
  const [exploreCategory, setExploreCategory] = useState<ExploreCategory | null>(null);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [exploreError, setExploreError] = useState<string | null>(null);
  const [exploreData, setExploreData] = useState<ExploreRecommendationsResponse | null>(null);
  const [pendingAddKeys, setPendingAddKeys] = useState<Set<string>>(new Set());
  const [addedSuggestionKeys, setAddedSuggestionKeys] = useState<Set<string>>(new Set());
  const [enrichedById, setEnrichedById] = useState<Record<string, EnrichedSuggestion>>({});
  const [tripDestination, setTripDestination] = useState<string>("");
  const enrichmentAbortRef = useRef<AbortController | null>(null);

  // Resolve trip destination from local trips so we can ground AI recs in
  // the user's actual location. If no trip is found we still allow the sheet
  // to open but show a soft warning.
  useEffect(() => {
    if (!state.tripId) {
      setTripDestination("");
      return;
    }
    const trip = getTripById(state.tripId);
    setTripDestination(trip?.destination?.trim() ?? "");
  }, [state.tripId]);

  const addedPlaceNamesLower = useMemo(
    () => new Set(addedPlaces.map((p) => p.name.toLowerCase())),
    [addedPlaces]
  );

  const isSuggestionAdded = (s: ExplorePlaceSuggestion): boolean => {
    if (addedSuggestionKeys.has(suggestionKey(s))) return true;
    return addedPlaceNamesLower.has(s.name.toLowerCase());
  };

  const openExploreSheet = () => {
    setExploreOpen(true);
    setExploreError(null);
  };

  const closeExploreSheet = () => {
    setExploreOpen(false);
  };

  // Background-resolve an AI suggestion against Google Places so the card can
  // show a thumbnail / rating / price tier. Fire-and-forget; updates
  // enrichedById as each suggestion completes. Aborts cleanly when the user
  // changes category or closes the sheet.
  const enrichSuggestions = (
    suggestions: ExplorePlaceSuggestion[],
    destination: string,
    signal: AbortSignal
  ) => {
    const initial: Record<string, EnrichedSuggestion> = {};
    for (const s of suggestions) initial[suggestionKey(s)] = { status: "loading" };
    setEnrichedById((prev) => ({ ...prev, ...initial }));

    suggestions.forEach((s) => {
      const key = suggestionKey(s);
      fetchPlacesForDestination({
        destination,
        textQuery: `${s.searchQuery} ${destination}`,
        maxResults: 1,
        signal,
      })
        .then((candidates) => {
          if (signal.aborted) return;
          const top = candidates[0];
          if (!top || !top.placeId) {
            setEnrichedById((prev) => ({
              ...prev,
              [key]: { status: "missing" },
            }));
            return;
          }
          setEnrichedById((prev) => ({
            ...prev,
            [key]: {
              status: "ready",
              placeId: top.placeId,
              name: top.name || s.name,
              imageUrl: top.imageUrl ?? null,
              displayCategoryLabel: top.displayCategoryLabel?.trim() || null,
              rating: typeof top.rating === "number" ? top.rating : undefined,
              priceLevel: typeof top.priceLevel === "number" ? top.priceLevel : undefined,
            },
          }));
        })
        .catch((err) => {
          if ((err as { name?: string })?.name === "AbortError") return;
          setEnrichedById((prev) => ({ ...prev, [key]: { status: "missing" } }));
        });
    });
  };

  const handleSelectCategory = async (cat: ExploreCategory) => {
    setExploreCategory(cat);
    setExploreData(null);
    setExploreError(null);
    enrichmentAbortRef.current?.abort();
    enrichmentAbortRef.current = null;

    if (!tripDestination) {
      setExploreError("Trip destination not found — set up the trip first.");
      return;
    }

    setExploreLoading(true);
    try {
      const data = await fetchExploreRecommendations({
        destination: tripDestination,
        category: cat,
        alreadyAdded: addedPlaces.map((p) => p.name),
      });
      setExploreData(data);
      const controller = new AbortController();
      enrichmentAbortRef.current = controller;
      enrichSuggestions(data.places, tripDestination, controller.signal);
    } catch (err) {
      setExploreError(
        err instanceof Error ? err.message : "Could not load recommendations. Try again."
      );
    } finally {
      setExploreLoading(false);
    }
  };

  const handleResetCategory = () => {
    setExploreCategory(null);
    setExploreData(null);
    setExploreError(null);
    enrichmentAbortRef.current?.abort();
    enrichmentAbortRef.current = null;
  };

  useEffect(() => {
    if (!exploreOpen) {
      enrichmentAbortRef.current?.abort();
      enrichmentAbortRef.current = null;
    }
  }, [exploreOpen]);

  // Append a place to addedPlaces. Uses the already-resolved Google Places
  // data when enrichment finished; otherwise falls back to AI-only metadata
  // (with a brief inline lookup) so the user always gets feedback.
  const handleAddSuggestion = async (suggestion: ExplorePlaceSuggestion) => {
    const key = suggestionKey(suggestion);
    if (pendingAddKeys.has(key) || isSuggestionAdded(suggestion)) return;

    setPendingAddKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });

    let resolved: Place | null = null;
    const enriched = enrichedById[key];
    if (enriched?.status === "ready" && enriched.placeId) {
      resolved = {
        id: enriched.placeId,
        name: enriched.name || suggestion.name,
        subtitle: enriched.displayCategoryLabel || suggestion.blurb,
        image: enriched.imageUrl || DEFAULT_PLACE_IMAGE,
      };
    } else if (enriched?.status !== "missing" && tripDestination) {
      try {
        const candidates = await fetchPlacesForDestination({
          destination: tripDestination,
          textQuery: `${suggestion.searchQuery} ${tripDestination}`,
          maxResults: 1,
        });
        const top = candidates[0];
        if (top && top.placeId) {
          resolved = {
            id: top.placeId,
            name: top.name || suggestion.name,
            subtitle: top.displayCategoryLabel?.trim() || suggestion.blurb,
            image: top.imageUrl || DEFAULT_PLACE_IMAGE,
          };
        }
      } catch {
        // Non-fatal: fall back to AI-only metadata below.
      }
    }

    const place: Place =
      resolved ??
      {
        id: `ai:${suggestion.name}`.slice(0, 200),
        name: suggestion.name,
        subtitle: suggestion.blurb,
        image: DEFAULT_PLACE_IMAGE,
      };

    setAddedPlaces((prev) => {
      if (prev.some((p) => p.id === place.id || p.name.toLowerCase() === place.name.toLowerCase())) {
        return prev;
      }
      return [...prev, place];
    });

    setAddedSuggestionKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });

    setPendingAddKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-[#FFF8E1] to-[#E6F4EA]">
      <PreferenceProgressHeader
        currentStep={5}
        totalSteps={7}
        title={"Add some places that you want to go"}
        leftSlot={
          <button
            onClick={() => navigate("/preference-time", { state })}
            className="w-10 h-10 rounded-xl bg-white border-2 border-[#E8E8E8] flex items-center justify-center shadow-[0_3px_0_#C4C4C4] active:translate-y-0.5 active:shadow-none transition-all"
          >
            <ArrowLeft size={20} className="text-[#6B7280]" />
          </button>
        }
      />

      {/* Avatar Area */}
      <div className="flex items-center justify-center px-5 pb-6">
        <div className="relative">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center border-4 border-[#A78BFA] shadow-[0_4px_0_#7C3AED]">
            <MapPin size={32} className="text-[#A78BFA]" strokeWidth={2} />
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="px-5 mb-2" />

      {/* Explore (AI recommendations) — between illustration and add list */}
      <div className="px-5 mb-3 flex justify-center">
        <button
          type="button"
          onClick={openExploreSheet}
          className="inline-flex items-center gap-1.5 text-[#A78BFA] font-black text-sm hover:text-[#7C3AED] active:translate-y-px transition-all"
        >
          <Sparkles size={16} strokeWidth={3} />
          Explore with AI
        </button>
      </div>

      {/* Added Places */}
      <div className="flex-1 px-5 pb-6 overflow-y-auto">
        {addedPlaces.map((place) => (
          <div
            key={place.id}
            className="bg-white rounded-2xl border-2 border-[#E8E8E8] shadow-[0_4px_0_#C4C4C4] p-4 mb-3 flex items-center gap-4"
          >
            {/* Content — `min-w-0` lets flexbox shrink this column so a long
                title (e.g. a raw place ID with no spaces) can't push the
                trailing delete button off the card. The title clamps to two
                lines with ellipsis; the subtitle truncates to one line. */}
            <div className="flex-1 min-w-0">
              <h3
                className="font-black text-[#1F302E] text-lg mb-1 break-words line-clamp-2"
                title={place.name}
              >
                {place.name}
              </h3>
              <p className="font-bold text-[#6B7280] text-sm truncate">
                {place.subtitle}
              </p>
            </div>

            {/* Image */}
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#F0F0F0] flex-shrink-0">
              <img
                src={place.image}
                alt={place.name}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Remove Button */}
            <button
              onClick={() => removePlace(place.id)}
              className="w-8 h-8 rounded-full bg-[#F0F0F0] hover:bg-[#FF5C5C] hover:text-white text-[#1F302E] flex items-center justify-center transition-colors flex-shrink-0"
            >
              <X size={18} strokeWidth={3} />
            </button>
          </div>
        ))}

        {/* Add Button */}
        <button
          onClick={() => navigate("/preference-place-search", { state })}
          className="w-full border-2 border-dashed border-[#1CB0F6] rounded-2xl p-6 flex flex-col items-center justify-center gap-2 bg-[#F0F9FF] transition-all"
        >
          <div className="w-12 h-12 rounded-full bg-[#1CB0F6] flex items-center justify-center transition-colors">
            <Plus
              size={24}
              className="text-white transition-colors"
              strokeWidth={3}
            />
          </div>
          <p className="font-bold text-[#1CB0F6] text-sm transition-colors">
            Add places you're interested in
          </p>
        </button>
      </div>

      {/* Continue Button */}
      <div className="px-5 pb-8">
        <DuoButton
          onClick={() => navigate("/preference-deal-breaker", { state })}
          variant="primary"
          fullWidth
          className="py-4 text-base"
        >
          Continue →
        </DuoButton>
      </div>

      {/* ─── Explore bottom sheet ──────────────────────────────────────── */}
      {exploreOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeExploreSheet}
            aria-hidden
          />
          <div className="relative w-full max-w-[402px] mx-auto bg-white rounded-t-3xl border-t-2 border-x-2 border-[#E8E8E8] shadow-[0_-4px_0_#C4C4C4] max-h-[80vh] flex flex-col">
            {/* Drag handle */}
            <div className="pt-3 pb-2 flex-shrink-0">
              <div className="w-12 h-1 rounded-full bg-[#E8E8E8] mx-auto" aria-hidden />
            </div>

            {/* Header */}
            <div className="px-5 pb-3 flex items-center gap-3 flex-shrink-0">
              {exploreCategory && (
                <button
                  type="button"
                  onClick={handleResetCategory}
                  className="w-8 h-8 rounded-xl bg-white border-2 border-[#E8E8E8] flex items-center justify-center shadow-[0_2px_0_#C4C4C4] active:translate-y-0.5 active:shadow-none transition-all"
                  aria-label="Back to categories"
                >
                  <ArrowLeft size={16} className="text-[#6B7280]" strokeWidth={3} />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-black text-[#1F302E] text-base leading-tight">
                  {exploreCategory
                    ? EXPLORE_CATEGORIES.find((c) => c.id === exploreCategory)?.label
                    : "Explore with AI"}
                </p>
                <p className="font-bold text-[#6B7280] text-xs truncate">
                  {tripDestination
                    ? `Hand-picked in ${tripDestination}`
                    : "Pick a category to discover places"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeExploreSheet}
                className="w-8 h-8 rounded-full bg-[#F0F0F0] hover:bg-[#E8E8E8] flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                <X size={16} className="text-[#1F302E]" strokeWidth={3} />
              </button>
            </div>

            {/* Body — scrollable */}
            <div className="px-5 pb-6 overflow-y-auto">
              {!exploreCategory && (
                <div className="flex flex-col gap-3">
                  {EXPLORE_CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleSelectCategory(cat.id)}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white border-2 shadow-[0_3px_0_#C4C4C4] active:translate-y-0.5 active:shadow-none transition-all text-left"
                        style={{ borderColor: cat.border }}
                      >
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: cat.bg }}
                        >
                          <Icon size={24} style={{ color: cat.accent }} strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-[#1F302E] text-base">{cat.label}</p>
                          <p className="font-bold text-[#6B7280] text-xs">{cat.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {exploreCategory && exploreLoading && (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <Loader2
                    size={32}
                    className="text-[#A78BFA] animate-spin"
                    strokeWidth={2.5}
                  />
                  <p className="font-bold text-[#6B7280] text-sm">
                    Asking the AI for picks…
                  </p>
                </div>
              )}

              {exploreCategory && !exploreLoading && exploreError && (
                <div className="py-8 flex flex-col items-center gap-3 text-center">
                  <p className="font-bold text-[#FF5C5C] text-sm px-4">{exploreError}</p>
                  <button
                    type="button"
                    onClick={() => handleSelectCategory(exploreCategory)}
                    className="px-4 py-2 rounded-xl bg-white border-2 border-[#E8E8E8] shadow-[0_2px_0_#C4C4C4] active:translate-y-0.5 active:shadow-none transition-all text-sm font-black text-[#1F302E]"
                  >
                    Try again
                  </button>
                </div>
              )}

              {exploreCategory && !exploreLoading && !exploreError && exploreData && (
                <div className="flex flex-col gap-4">
                  {exploreData.intro && (
                    <div className="p-4 rounded-2xl bg-[#FAF5FF] border-2 border-[#EFE0FF]">
                      <div className="flex items-start gap-2">
                        <Sparkles
                          size={16}
                          className="text-[#A78BFA] flex-shrink-0 mt-0.5"
                          strokeWidth={3}
                        />
                        <p className="font-bold text-[#1F302E] text-sm leading-snug">
                          {exploreData.intro}
                        </p>
                      </div>
                    </div>
                  )}

                  {exploreData.places.length === 0 && (
                    <p className="py-8 text-center font-bold text-[#6B7280] text-sm">
                      No new picks right now.
                    </p>
                  )}

                  {exploreData.places.map((s) => {
                    const key = suggestionKey(s);
                    const added = isSuggestionAdded(s);
                    const pending = pendingAddKeys.has(key);
                    const enriched = enrichedById[key];
                    const isThumbLoading = !enriched || enriched.status === "loading";
                    const thumbUrl = enriched?.status === "ready" ? enriched.imageUrl : null;
                    const rating = enriched?.status === "ready" ? enriched.rating : undefined;
                    const priceText =
                      enriched?.status === "ready" ? formatPriceLevel(enriched.priceLevel) : null;
                    const hasMeta = typeof rating === "number" || !!priceText;
                    return (
                      <div
                        key={key}
                        className="p-4 rounded-2xl bg-white border-2 border-[#E8E8E8] shadow-[0_3px_0_#C4C4C4]"
                      >
                        <div className="flex items-start gap-3">
                          {/* Thumbnail */}
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#F0F0F0] flex-shrink-0 flex items-center justify-center">
                            {thumbUrl ? (
                              <img
                                src={thumbUrl}
                                alt={s.name}
                                className="w-full h-full object-cover"
                              />
                            ) : isThumbLoading ? (
                              <Loader2
                                size={18}
                                className="text-[#A78BFA] animate-spin"
                                strokeWidth={2.5}
                              />
                            ) : (
                              <MapPin size={20} className="text-[#6B7280]" strokeWidth={2.5} />
                            )}
                          </div>

                          {/* Title + meta */}
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-[#1F302E] text-base leading-tight">
                              {s.name}
                            </p>
                            {hasMeta && (
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {typeof rating === "number" && (
                                  <span className="inline-flex items-center gap-0.5 font-black text-[#1F302E] text-xs">
                                    <Star
                                      size={12}
                                      className="text-[#FFC800] fill-[#FFC800]"
                                      strokeWidth={2}
                                    />
                                    {rating.toFixed(1)}
                                    <span className="font-bold text-[#6B7280]">/5</span>
                                  </span>
                                )}
                                {typeof rating === "number" && priceText && (
                                  <span className="text-[#6B7280] text-xs">·</span>
                                )}
                                {priceText && (
                                  <span className="font-black text-[#10B954] text-xs">
                                    {priceText}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Add button */}
                          <button
                            type="button"
                            onClick={() => handleAddSuggestion(s)}
                            disabled={added || pending}
                            className={[
                              "flex-shrink-0 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl border-2 font-black text-xs transition-all min-w-[72px]",
                              added
                                ? "bg-[#E5F8D5] border-[#B3E68A] text-[#10B954] cursor-default"
                                : pending
                                  ? "bg-white border-[#E8E8E8] text-[#6B7280] cursor-wait"
                                  : "bg-[#1CB0F6] border-[#0A91D1] text-white shadow-[0_3px_0_#0A91D1] active:translate-y-0.5 active:shadow-none",
                            ].join(" ")}
                            aria-label={added ? `${s.name} added` : `Add ${s.name}`}
                          >
                            {added ? (
                              <>
                                <Check size={14} strokeWidth={3} />
                                Added
                              </>
                            ) : pending ? (
                              <>
                                <Loader2 size={14} className="animate-spin" strokeWidth={3} />
                                Adding
                              </>
                            ) : (
                              <>
                                <Plus size={14} strokeWidth={3} />
                                Add
                              </>
                            )}
                          </button>
                        </div>

                        {/* Blurb full-width below the row */}
                        <p className="font-bold text-[#7A7A7A] text-xs leading-snug mt-3">
                          {s.blurb}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}