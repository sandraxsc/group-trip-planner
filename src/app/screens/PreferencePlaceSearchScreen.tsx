import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { ArrowLeft, Search, MapPin, Check } from "lucide-react";
import { DuoButton } from "../components/DuoButton";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import {
  getPlaceAutocompleteSuggestions,
  type GooglePlacesSuggestion,
  type PlacesAutocompleteScope,
} from "../services/googlePlaces";
import {
  fetchDestinationGeoContext,
  fetchPlaceDetails,
  fetchPersonalizedPlaceRecommendations,
  type DestinationGeoContext,
} from "../../services/placeService";
import { getTripById } from "../../services/tripService";
import { getMemberPreference, saveMemberPreference } from "../../services/preferenceService";
import type { CandidateActivity } from "../../types/activity";

interface Place {
  id: string;
  name: string;
  subtitle: string;
  image: string;
}

const DEFAULT_DYNAMIC_PLACE_IMAGE =
  "https://images.unsplash.com/photo-1516426122078-c23e76319801?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";

function recommendationSubtitle(c: CandidateActivity): string {
  const cat = c.displayCategoryLabel?.trim() || "Place";
  return typeof c.rating === "number" ? `${cat} · ★ ${c.rating.toFixed(1)}` : cat;
}

export default function PreferencePlaceSearchScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefState = (location.state as { tripId?: string; memberId?: string }) ?? {};
  const tripId =
    prefState.tripId ?? (typeof window !== "undefined" ? sessionStorage.getItem("currentTripId") : null);
  const memberId =
    prefState.memberId ?? (typeof window !== "undefined" ? sessionStorage.getItem("currentMemberId") : null);

  const prefNavState =
    tripId && memberId ? { tripId, memberId } : prefState.tripId && prefState.memberId ? prefState : undefined;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlaces, setSelectedPlaces] = useState<string[]>([]);
  const [dynamicPlaces, setDynamicPlaces] = useState<Place[]>([]);
  const [recommendedPlaces, setRecommendedPlaces] = useState<Place[]>([]);
  const [recommendedLoading, setRecommendedLoading] = useState(true);
  const [recommendedError, setRecommendedError] = useState<string | null>(null);
  // Country / viewport context derived from the trip's destination, used to
  // restrict Places autocomplete to the destination region. Resolved once per
  // trip; null until the lookup completes (autocomplete falls back to global
  // suggestions in that brief window).
  const [destinationGeo, setDestinationGeo] = useState<DestinationGeoContext | null>(null);

  // Autocomplete dropdown state
  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const [suggestions, setSuggestions] = useState<GooglePlacesSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const lastRequestRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Prefill selected place ids from saved progress (auto-resume)
  useEffect(() => {
    if (!tripId || !memberId) return;
    const pref = getMemberPreference(tripId, memberId);
    if (pref?.selectedPlaces?.length) {
      setSelectedPlaces(pref.selectedPlaces);
    }
  }, [tripId, memberId]);

  // Auto-save selection as user toggles (debounced)
  useEffect(() => {
    if (!tripId || !memberId) return;
    const t = window.setTimeout(() => {
      saveMemberPreference(tripId, memberId, { selectedPlaces });
    }, 350);
    return () => window.clearTimeout(t);
  }, [tripId, memberId, selectedPlaces]);

  useEffect(() => {
    const controller = new AbortController();
    if (!tripId || !memberId) {
      setRecommendedPlaces([]);
      setRecommendedLoading(false);
      setRecommendedError(null);
      setDestinationGeo(null);
      return () => controller.abort();
    }

    const trip = getTripById(tripId);
    const destination = trip?.destination?.trim() ?? "";
    if (!destination) {
      setRecommendedPlaces([]);
      setRecommendedLoading(false);
      setRecommendedError("Trip destination not found.");
      setDestinationGeo(null);
      return () => controller.abort();
    }

    // Resolve destination → country / viewport in parallel with recommendations
    // so the autocomplete dropdown can restrict to the trip's region as soon
    // as the user starts typing. Errors are non-fatal: autocomplete simply
    // falls back to unbiased suggestions.
    fetchDestinationGeoContext(destination, controller.signal)
      .then((ctx) => {
        if (controller.signal.aborted) return;
        setDestinationGeo(ctx);
      })
      .catch((err) => {
        if ((err as { name?: string })?.name === "AbortError") return;
        setDestinationGeo(null);
      });

    const prefs = getMemberPreference(tripId, memberId);
    setRecommendedLoading(true);
    setRecommendedError(null);

    fetchPersonalizedPlaceRecommendations({
      destination,
      prefs,
      limit: 7,
      signal: controller.signal,
    })
      .then((list) => {
        setRecommendedPlaces(
          list.map((c) => ({
            id: c.placeId,
            name: c.name,
            subtitle: recommendationSubtitle(c),
            image: c.imageUrl ?? DEFAULT_DYNAMIC_PLACE_IMAGE,
          }))
        );
      })
      .catch((err) => {
        if ((err as { name?: string })?.name === "AbortError") return;
        setRecommendedPlaces([]);
        setRecommendedError(err instanceof Error ? err.message : "Could not load recommendations");
      })
      .finally(() => {
        if (!controller.signal.aborted) setRecommendedLoading(false);
      });

    return () => controller.abort();
  }, [tripId, memberId]);

  const allPlaces = useMemo(() => {
    const seen = new Set<string>();
    const out: Place[] = [];
    for (const p of [...dynamicPlaces, ...recommendedPlaces]) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
    }
    return out;
  }, [dynamicPlaces, recommendedPlaces]);

  const displayedPlaces = searchQuery.trim()
    ? allPlaces.filter((place) =>
        place.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allPlaces;

  const togglePlace = (id: string) => {
    setSelectedPlaces((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const ensurePlaceSelected = (id: string) => {
    setSelectedPlaces((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  // Translate the destination's geo context into the shape the autocomplete
  // call expects. Prefer the viewport rectangle (most precise) and fall back
  // to a generous circle around the centroid when only a center is known.
  const autocompleteScope = useMemo<PlacesAutocompleteScope | undefined>(() => {
    if (!destinationGeo) return undefined;
    const scope: PlacesAutocompleteScope = {};
    if (destinationGeo.regionCode) scope.regionCodes = [destinationGeo.regionCode];
    if (destinationGeo.viewport) {
      scope.locationBias = { rectangle: destinationGeo.viewport };
    } else if (destinationGeo.center) {
      // 50 km circle is broad enough to cover a metro area while still
      // ranking nearby options first.
      scope.locationBias = {
        circle: { center: destinationGeo.center, radiusMeters: 50_000 },
      };
    }
    return Object.keys(scope).length > 0 ? scope : undefined;
  }, [destinationGeo]);

  useEffect(() => {
    const q = debouncedQuery.trim();

    // Clear dropdown when query is short
    if (q.length < 2) {
      lastRequestRef.current?.abort();
      lastRequestRef.current = null;
      setSuggestions([]);
      setSuggestionsOpen(false);
      setSuggestionsLoading(false);
      setSuggestionsError(null);
      setActiveSuggestionIndex(-1);
      return;
    }

    const controller = new AbortController();
    lastRequestRef.current?.abort();
    lastRequestRef.current = controller;

    setSuggestionsLoading(true);
    setSuggestionsError(null);

    getPlaceAutocompleteSuggestions({
      input: q,
      limit: 7,
      signal: controller.signal,
      scope: autocompleteScope,
    })
      .then((items) => {
        setSuggestions(items);
        setSuggestionsOpen(true);
        setActiveSuggestionIndex(-1);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setSuggestions([]);
        setSuggestionsOpen(true);
        setActiveSuggestionIndex(-1);
        setSuggestionsError(err instanceof Error ? err.message : "Failed to load suggestions");
      })
      .finally(() => {
        if (!controller.signal.aborted) setSuggestionsLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQuery, autocompleteScope]);

  const suggestionsStatus = useMemo(() => {
    const q = searchQuery.trim();
    if (q.length < 2) return "idle";
    if (suggestionsLoading) return "loading";
    if (suggestionsError) return "error";
    if (suggestions.length === 0) return "empty";
    return "ready";
  }, [searchQuery, suggestionsLoading, suggestionsError, suggestions.length]);

  const handleSelectSuggestion = (s: GooglePlacesSuggestion) => {
    const id = s.placeId;
    const name = s.fullText || s.primaryText;
    const subtitle = s.secondaryText || "Suggested place";

    setSearchQuery(name);
    setSuggestionsOpen(false);
    setSuggestions([]);
    setActiveSuggestionIndex(-1);

    setDynamicPlaces((prev) =>
      prev.some((p) => p.id === id)
        ? prev
        : [
            {
              id,
              name,
              subtitle,
              image: DEFAULT_DYNAMIC_PLACE_IMAGE,
            },
            ...prev,
          ]
    );
    ensurePlaceSelected(id);

    // Fetch real place photo (and optional details) for the card
    fetchPlaceDetails(id).then((details) => {
      if (!details?.imageUrl) return;
      setDynamicPlaces((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                image: details.imageUrl!,
                ...(details.displayCategoryLabel && { subtitle: details.displayCategoryLabel }),
              }
            : p
        )
      );
    });
  };

  const handleAdd = () => {
    const selectedData = allPlaces.filter((p) => selectedPlaces.includes(p.id));

    const existing = sessionStorage.getItem("selectedPlaces");
    const existingData: Array<{ id: string }> = existing ? JSON.parse(existing) : [];
    const merged = [...existingData, ...selectedData];
    const seen = new Set<string>();
    const deduped = merged.filter((p) => {
      const key = p?.id;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    sessionStorage.setItem("selectedPlaces", JSON.stringify(deduped));

    navigate("/preference-place", { state: prefNavState });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-[#FFF8E1] to-[#E6F4EA]">
      {/* Header */}
      <div className="flex items-center px-4 pt-12 pb-4">
        <button
          onClick={() => navigate("/preference-place", { state: prefNavState })}
          className="w-10 h-10 rounded-xl bg-white border-2 border-[#E8E8E8] flex items-center justify-center shadow-[0_3px_0_#C4C4C4] active:translate-y-0.5 active:shadow-none transition-all"
        >
          <ArrowLeft size={20} className="text-[#6B7280]" />
        </button>
      </div>

      {/* Search Field */}
      <div className="px-5 mb-4">
        <div className="relative">
          <Search
            size={20}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B7280]"
          />
          <input
            type="text"
            placeholder="Search places..."
            value={searchQuery}
            ref={inputRef}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSuggestionsError(null);
            }}
            onFocus={() => {
              if (searchQuery.trim().length >= 2) setSuggestionsOpen(true);
            }}
            onBlur={() => {
              // Allow click selection inside dropdown before closing
              window.setTimeout(() => setSuggestionsOpen(false), 120);
            }}
            onKeyDown={(e) => {
              if (!suggestionsOpen) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveSuggestionIndex((prev) =>
                  Math.min(prev + 1, suggestions.length - 1)
                );
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveSuggestionIndex((prev) => Math.max(prev - 1, 0));
              } else if (e.key === "Enter") {
                const s = suggestions[activeSuggestionIndex];
                if (s) {
                  e.preventDefault();
                  handleSelectSuggestion(s);
                }
              } else if (e.key === "Escape") {
                e.preventDefault();
                setSuggestionsOpen(false);
              }
            }}
            className="w-full pl-12 pr-4 py-3.5 text-base font-bold text-[#1F302E] placeholder:text-[#6B7280] bg-white border-2 border-[#E8E8E8] rounded-2xl shadow-[0_3px_0_#C4C4C4] focus:outline-none focus:ring-2 focus:ring-[#1CB0F6]"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={suggestionsOpen}
            aria-controls="places-suggestions"
          />

          {/* Autocomplete dropdown */}
          {suggestionsOpen && searchQuery.trim().length >= 2 && (
            <div
              id="places-suggestions"
              role="listbox"
              className="absolute left-0 right-0 mt-2 bg-white border-2 border-[#E8E8E8] rounded-2xl shadow-[0_6px_0_#C4C4C4] overflow-hidden z-50"
              onMouseDown={(e) => {
                // Prevent input blur while clicking dropdown items
                e.preventDefault();
              }}
            >
              {suggestionsStatus === "loading" && (
                <div className="px-4 py-3 text-sm font-bold text-[#6B7280]">
                  Searching…
                </div>
              )}

              {suggestionsStatus === "error" && (
                <div className="px-4 py-3 text-sm font-bold text-[#FF5C5C]">
                  {suggestionsError}
                </div>
              )}

              {suggestionsStatus === "empty" && (
                <div className="px-4 py-3 text-sm font-bold text-[#6B7280]">
                  No suggestions found
                </div>
              )}

              {suggestionsStatus === "ready" && (
                <>
                  {suggestions.map((s, idx) => {
                    const isActive = idx === activeSuggestionIndex;
                    const label = s.fullText || s.primaryText;
                    return (
                      <button
                        key={s.placeId}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        className={[
                          "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                          isActive ? "bg-[#F7F7F6]" : "bg-white hover:bg-[#F7F7F6]",
                        ].join(" ")}
                        onMouseEnter={() => setActiveSuggestionIndex(idx)}
                        onClick={() => handleSelectSuggestion(s)}
                      >
                        <div className="w-9 h-9 rounded-xl bg-[#F0F9FF] border-2 border-[#DFF6FF] flex items-center justify-center flex-shrink-0">
                          <MapPin size={18} className="text-[#1CB0F6]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-[#1F302E] text-sm truncate">
                            {label}
                          </p>
                          {s.secondaryText && (
                            <p className="font-bold text-[#6B7280] text-xs truncate">
                              {s.secondaryText}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  <div className="px-4 py-2 bg-[#F7F7F6] border-t border-[#E8E8E8]">
                    <p className="text-[11px] font-bold text-[#6B7280]">
                      Suggestions powered by Google Places
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="px-5 mb-3">
        <div className="h-1 bg-[#E8E8E8] rounded-full" />
      </div>

      {/* Title */}
      <div className="px-5 mb-3">
        <h2 className="font-black text-[#1F302E] text-base">
          {searchQuery.trim() ? "Search Results" : "Recommended for you"}
        </h2>
      </div>

      {/* Places List */}
      <div className="flex-1 px-5 pb-6 overflow-y-auto">
        <div className="bg-white rounded-2xl border-2 border-[#E8E8E8] overflow-hidden">
          {!searchQuery.trim() && recommendedLoading && (
            <div className="px-4 py-6 text-center border-b border-[#F0F0F0]">
              <p className="text-[#6B7280] font-bold text-sm">Finding picks for your trip…</p>
            </div>
          )}
          {!searchQuery.trim() && recommendedError && (
            <div className="px-4 py-3 text-center border-b border-[#F0F0F0]">
              <p className="text-[#FF5C5C] font-bold text-xs">{recommendedError}</p>
              <p className="text-[#6B7280] font-bold text-[11px] mt-1">
                Ensure VITE_GOOGLE_PLACES_API_KEY is set (local .env and Vercel env).
              </p>
            </div>
          )}
          {displayedPlaces.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[#6B7280] font-bold text-sm">
                No places found
              </p>
            </div>
          ) : (
            displayedPlaces.map((place, index) => (
              <div key={place.id}>
                <button
                  onClick={() => togglePlace(place.id)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-[#F7F7F6] transition-colors"
                >
                  {/* Image */}
                  <div className="relative w-12 h-12 rounded-full overflow-hidden bg-[#F0F0F0] flex-shrink-0">
                    <img
                      src={place.image}
                      alt={place.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-[#A78BFA]/20">
                      <MapPin size={20} className="text-white" />
                    </div>
                  </div>

                  {/* Text */}
                  <div className="flex-1 text-left">
                    <p className="font-black text-[#1F302E] text-base leading-tight">
                      {place.name}
                    </p>
                    <p className="font-bold text-[#6B7280] text-sm">
                      {place.subtitle}
                    </p>
                  </div>

                  {/* Checkmark */}
                  {selectedPlaces.includes(place.id) && (
                    <div className="w-6 h-6 rounded-full bg-[#10B954] flex items-center justify-center flex-shrink-0">
                      <Check size={16} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                </button>
                {index < displayedPlaces.length - 1 && (
                  <div className="h-px bg-[#F0F0F0] mx-4" />
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Button */}
      {selectedPlaces.length > 0 && (
        <div className="px-5 pb-8">
          <DuoButton
            onClick={handleAdd}
            variant="primary"
            fullWidth
            className="py-4 text-base"
          >
            Add {selectedPlaces.length} Place{selectedPlaces.length > 1 ? "s" : ""}
          </DuoButton>
        </div>
      )}
    </div>
  );
}
