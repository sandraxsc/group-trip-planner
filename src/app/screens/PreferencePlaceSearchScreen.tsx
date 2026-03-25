import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Search, MapPin, Check } from "lucide-react";
import { DuoButton } from "../components/DuoButton";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import {
  getPlaceAutocompleteSuggestions,
  type GooglePlacesSuggestion,
} from "../services/googlePlaces";
import { fetchPlaceDetails } from "../../services/placeService";

interface Place {
  id: string;
  name: string;
  subtitle: string;
  image: string;
}

const DEFAULT_DYNAMIC_PLACE_IMAGE =
  "https://images.unsplash.com/photo-1516426122078-c23e76319801?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";

const RECOMMENDED_PLACES: Place[] = [
  {
    id: "bali",
    name: "Bali, Indonesia",
    subtitle: "Tropical paradise with temples",
    image: "https://images.unsplash.com/photo-1766854269605-bd06cb72217e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYWxpJTIwdGVtcGxlJTIwc3Vuc2V0JTIwdHJvcGljYWx8ZW58MXx8fHwxNzcyOTQyOTgzfDA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "tokyo",
    name: "Tokyo, Japan",
    subtitle: "Modern city with ancient temples",
    image: "https://images.unsplash.com/photo-1691929607102-5284d991921f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0b2t5byUyMHRvd2VyJTIwY2l0eXNjYXBlfGVufDF8fHx8MTc3Mjk0Mjk3OHww&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "paris",
    name: "Paris, France",
    subtitle: "City of lights and romance",
    image: "https://images.unsplash.com/photo-1720988583730-1191f37e5fcd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwYXJpcyUyMGVpZmZlbCUyMGxhbmRtYXJrfGVufDF8fHx8MTc3Mjk0Mjk3OHww&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "santorini",
    name: "Santorini, Greece",
    subtitle: "Stunning sunsets and white buildings",
    image: "https://images.unsplash.com/photo-1497339047006-39f2b26f005d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzYW50b3JpbmklMjBncmVlY2UlMjB3aGl0ZXdhc2hlZHxlbnwxfHx8fDE3NzI5NDI5Nzl8MA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "newyork",
    name: "New York, USA",
    subtitle: "The city that never sleeps",
    image: "https://images.unsplash.com/photo-1655845836463-facb2826510b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuZXclMjB5b3JrJTIwc2t5bGluZSUyMG1hbmhhdHRhbnxlbnwxfHx8fDE3NzI5MDI0Mjl8MA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "london",
    name: "London, England",
    subtitle: "Historic landmarks and culture",
    image: "https://images.unsplash.com/photo-1676230087975-14bde0752bc6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsb25kb24lMjBiaWclMjBiZW4lMjBhcmNoaXRlY3R1cmV8ZW58MXx8fHwxNzcyOTQyOTgwfDA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    id: "dubai",
    name: "Dubai, UAE",
    subtitle: "Luxury and modern architecture",
    image: "https://images.unsplash.com/photo-1735320864933-601d2cac9371?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkdWJhaSUyMGJ1cmolMjBraGFsaWZhJTIwbW9kZXJufGVufDF8fHx8MTc3Mjk0Mjk4MHww&ixlib=rb-4.1.0&q=80&w=1080",
  },
];

export default function PreferencePlaceSearchScreen() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlaces, setSelectedPlaces] = useState<string[]>([]);
  const [dynamicPlaces, setDynamicPlaces] = useState<Place[]>([]);

  // Autocomplete dropdown state
  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const [suggestions, setSuggestions] = useState<GooglePlacesSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const lastRequestRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Filter places based on search query
  const allPlaces = useMemo(
    () => [...dynamicPlaces, ...RECOMMENDED_PLACES],
    [dynamicPlaces]
  );

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

    getPlaceAutocompleteSuggestions({ input: q, limit: 7, signal: controller.signal })
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
  }, [debouncedQuery]);

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
    // Get selected place data
    const selectedData = allPlaces.filter((p) => selectedPlaces.includes(p.id));
    
    // Store in sessionStorage to pass to PreferencePlaceScreen
    const existing = sessionStorage.getItem("selectedPlaces");
    const existingData = existing ? JSON.parse(existing) : [];
    sessionStorage.setItem(
      "selectedPlaces",
      JSON.stringify([...existingData, ...selectedData])
    );
    
    navigate("/preference-place");
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-[#FFF8F0] to-[#F0FFF4]">
      {/* Header */}
      <div className="flex items-center px-4 pt-12 pb-4">
        <button
          onClick={() => navigate("/preference-place")}
          className="w-10 h-10 rounded-xl bg-white border-2 border-[#E5E5E5] flex items-center justify-center shadow-[0_3px_0_#D4D4D4] active:translate-y-0.5 active:shadow-none transition-all"
        >
          <ArrowLeft size={20} className="text-[#4B4B4B]" />
        </button>
      </div>

      {/* Search Field */}
      <div className="px-5 mb-4">
        <div className="relative">
          <Search
            size={20}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#AFAFAF]"
          />
          <input
            type="text"
            placeholder="Search destinations..."
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
            className="w-full pl-12 pr-4 py-3.5 text-base font-bold text-[#3C3C3C] placeholder:text-[#AFAFAF] bg-white border-2 border-[#E5E5E5] rounded-2xl shadow-[0_3px_0_#D4D4D4] focus:outline-none focus:ring-2 focus:ring-[#1CB0F6]"
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
              className="absolute left-0 right-0 mt-2 bg-white border-2 border-[#E5E5E5] rounded-2xl shadow-[0_6px_0_#D4D4D4] overflow-hidden z-50"
              onMouseDown={(e) => {
                // Prevent input blur while clicking dropdown items
                e.preventDefault();
              }}
            >
              {suggestionsStatus === "loading" && (
                <div className="px-4 py-3 text-sm font-bold text-[#AFAFAF]">
                  Searching…
                </div>
              )}

              {suggestionsStatus === "error" && (
                <div className="px-4 py-3 text-sm font-bold text-[#FF4B4B]">
                  {suggestionsError}
                </div>
              )}

              {suggestionsStatus === "empty" && (
                <div className="px-4 py-3 text-sm font-bold text-[#AFAFAF]">
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
                          isActive ? "bg-[#F7F7F7]" : "bg-white hover:bg-[#F7F7F7]",
                        ].join(" ")}
                        onMouseEnter={() => setActiveSuggestionIndex(idx)}
                        onClick={() => handleSelectSuggestion(s)}
                      >
                        <div className="w-9 h-9 rounded-xl bg-[#F0F9FF] border-2 border-[#DFF6FF] flex items-center justify-center flex-shrink-0">
                          <MapPin size={18} className="text-[#1CB0F6]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-[#3C3C3C] text-sm truncate">
                            {label}
                          </p>
                          {s.secondaryText && (
                            <p className="font-bold text-[#AFAFAF] text-xs truncate">
                              {s.secondaryText}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  <div className="px-4 py-2 bg-[#F7F7F7] border-t border-[#E5E5E5]">
                    <p className="text-[11px] font-bold text-[#AFAFAF]">
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
        <div className="h-1 bg-[#E5E5E5] rounded-full" />
      </div>

      {/* Title */}
      <div className="px-5 mb-3">
        <h2 className="font-black text-[#3C3C3C] text-base">
          {searchQuery.trim() ? "Search Results" : "Recommended for you"}
        </h2>
      </div>

      {/* Places List */}
      <div className="flex-1 px-5 pb-6 overflow-y-auto">
        <div className="bg-white rounded-2xl border-2 border-[#E5E5E5] overflow-hidden">
          {displayedPlaces.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[#AFAFAF] font-bold text-sm">
                No places found
              </p>
            </div>
          ) : (
            displayedPlaces.map((place, index) => (
              <div key={place.id}>
                <button
                  onClick={() => togglePlace(place.id)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-[#F7F7F7] transition-colors"
                >
                  {/* Image */}
                  <div className="relative w-12 h-12 rounded-full overflow-hidden bg-[#F0F0F0] flex-shrink-0">
                    <img
                      src={place.image}
                      alt={place.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-[#CE82FF]/20">
                      <MapPin size={20} className="text-white" />
                    </div>
                  </div>

                  {/* Text */}
                  <div className="flex-1 text-left">
                    <p className="font-black text-[#3C3C3C] text-base leading-tight">
                      {place.name}
                    </p>
                    <p className="font-bold text-[#AFAFAF] text-sm">
                      {place.subtitle}
                    </p>
                  </div>

                  {/* Checkmark */}
                  {selectedPlaces.includes(place.id) && (
                    <div className="w-6 h-6 rounded-full bg-[#58CC02] flex items-center justify-center flex-shrink-0">
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
