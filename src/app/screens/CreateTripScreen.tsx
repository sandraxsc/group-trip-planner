import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, MapPin, CalendarDays, Users, ChevronRight, Globe } from "lucide-react";
import { DuoButton } from "../components/DuoButton";
import { DuoDatePicker } from "../components/DuoDatePicker";
import { format } from "date-fns";
import { createTrip, getTripMembers } from "../../services/tripService";
import { getPlaceAutocompleteSuggestions } from "../services/googlePlaces";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

const destinations = [
  { emoji: "🌴", name: "Bali, Indonesia" },
  { emoji: "🗼", name: "Paris, France" },
  { emoji: "🗻", name: "Swiss Alps" },
  { emoji: "🏯", name: "Tokyo, Japan" },
  { emoji: "🏖️", name: "Cancun, Mexico" },
  { emoji: "🏔️", name: "Patagonia" },
];

export default function CreateTripScreen() {
  const navigate = useNavigate();
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [guests, setGuests] = useState(2);
  const [showDestinations, setShowDestinations] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isAutocompleteLoading, setIsAutocompleteLoading] = useState(false);
  const [autoSuggestions, setAutoSuggestions] = useState<
    Array<{ placeId: string; primaryText: string; secondaryText?: string; fullText: string }>
  >([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const destinationInputRef = useRef<HTMLInputElement | null>(null);

  const debouncedDestination = useDebouncedValue(destination, 300);

  const handleDateSelect = (start: Date | null, end: Date | null) => {
    setStartDate(start);
    setEndDate(end);
  };

  const formatDateRange = () => {
    if (!startDate) return "";
    if (!endDate || startDate === endDate) {
      return format(startDate, "MMM d");
    }
    return `${format(startDate, "MMM d")}–${format(endDate, "d")}`;
  };

  const handleCreate = () => {
    if (!destination.trim()) return;
    // Compute trip days from selected dates (inclusive); fallback to 3 if not selected.
    let tripDays: number | undefined;
    if (startDate && endDate) {
      const msPerDay = 1000 * 60 * 60 * 24;
      const diff = Math.round((endDate.getTime() - startDate.getTime()) / msPerDay);
      tripDays = Math.max(1, diff + 1);
    }
    const trip = createTrip(destination.trim(), "Me", guests, tripDays);
    const owner = getTripMembers(trip.id)[0];
    if (owner) {
      sessionStorage.setItem("currentMemberId", owner.id);
      sessionStorage.setItem("currentTripId", trip.id);
    }
    navigate(`/trip-success/${trip.id}`);
  };

  useEffect(() => {
    const q = debouncedDestination.trim();
    if (q.length < 2) {
      setAutoSuggestions([]);
      setIsAutocompleteLoading(false);
      setHighlightedIndex(0);
      return;
    }

    const controller = new AbortController();
    setIsAutocompleteLoading(true);
    setHighlightedIndex(0);

    getPlaceAutocompleteSuggestions({
      input: q,
      limit: 7,
      signal: controller.signal,
    })
      .then((s) => {
        setAutoSuggestions(s);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setAutoSuggestions([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsAutocompleteLoading(false);
      });

    return () => controller.abort();
  }, [debouncedDestination]);

  const handlePickDestination = (value: string) => {
    setDestination(value);
    setShowDestinations(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <div className="flex items-center px-4 pt-12 pb-4 gap-3">
        <button
          onClick={() => navigate("/")}
          className="w-10 h-10 rounded-xl bg-white border-2 border-[#E5E5E5] flex items-center justify-center shadow-[0_3px_0_#D4D4D4] active:translate-y-0.5 active:shadow-none transition-all"
        >
          <ArrowLeft size={20} className="text-[#4B4B4B]" />
        </button>
        <h1 className="font-black text-[#3C3C3C] text-xl flex-1 text-center pr-10">
          Plan a Trip 🗺️
        </h1>
      </div>

      {/* Hero illustration area */}
      <div className="mx-5 mb-6 bg-gradient-to-br from-[#DFF6FF] to-[#EBF8FF] rounded-2xl p-6 border-2 border-[#1CB0F6] flex flex-col items-center">
        <Globe size={64} className="text-[#1CB0F6] mb-2" strokeWidth={1.5} />
        <p className="text-[#1CB0F6] font-black text-center text-sm">
          Start your next adventure!
        </p>
      </div>

      {/* Form */}
      <div className="px-5 flex flex-col gap-4">
        {/* Destination */}
        <div>
          <label className="text-xs font-black text-[#AFAFAF] uppercase tracking-wider mb-2 block">
            Destination
          </label>
          <div
            className="w-full flex items-center gap-3 px-4 py-4 bg-white border-2 border-[#E5E5E5] rounded-2xl shadow-[0_3px_0_#D4D4D4] active:translate-y-0.5 active:shadow-none transition-all"
          >
            <div className="w-9 h-9 rounded-xl bg-[#DFF6FF] flex items-center justify-center">
              <MapPin size={18} className="text-[#1CB0F6]" />
            </div>
            <input
              ref={destinationInputRef}
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value);
                setShowDestinations(true);
              }}
              onFocus={() => setShowDestinations(true)}
              onBlur={() => {
                // allow click to register before closing
                window.setTimeout(() => setShowDestinations(false), 120);
              }}
              onKeyDown={(e) => {
                if (!showDestinations) return;
                const q = destination.trim();
                if (q.length < 2) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setHighlightedIndex((i) => Math.min(autoSuggestions.length - 1, i + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setHighlightedIndex((i) => Math.max(0, i - 1));
                } else if (e.key === "Enter") {
                  if (autoSuggestions[highlightedIndex]) {
                    e.preventDefault();
                    handlePickDestination(autoSuggestions[highlightedIndex].fullText);
                  }
                } else if (e.key === "Escape") {
                  setShowDestinations(false);
                }
              }}
              placeholder="Enter destination"
              className={`flex-1 text-left font-bold bg-transparent outline-none ${
                destination ? "text-[#3C3C3C]" : "text-[#AFAFAF]"
              }`}
            />
            <ChevronRight size={18} className="text-[#AFAFAF]" />
          </div>

          {showDestinations && (
            <div className="mt-2 bg-white border-2 border-[#E5E5E5] rounded-2xl shadow-[0_4px_0_#D4D4D4] overflow-hidden">
              {destination.trim().length >= 2 ? (
                <>
                  {isAutocompleteLoading && (
                    <div className="px-4 py-3 text-xs font-bold text-[#AFAFAF]">
                      Searching…
                    </div>
                  )}
                  {!isAutocompleteLoading && autoSuggestions.length === 0 && (
                    <div className="px-4 py-3 text-xs font-bold text-[#AFAFAF]">
                      No places found
                    </div>
                  )}
                  {!isAutocompleteLoading &&
                    autoSuggestions.map((s, idx) => (
                      <button
                        key={s.placeId}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handlePickDestination(s.fullText)}
                        className={`w-full flex flex-col items-start gap-0 px-4 py-3 hover:bg-[#F7FFF0] transition-colors border-b border-[#F0F0F0] last:border-0 ${
                          idx === highlightedIndex ? "bg-[#F0FDE4]" : ""
                        }`}
                      >
                        <span className="font-black text-[#3C3C3C]">{s.primaryText}</span>
                        {s.secondaryText && (
                          <span className="text-xs font-bold text-[#AFAFAF] mt-0.5">
                            {s.secondaryText}
                          </span>
                        )}
                      </button>
                    ))}
                </>
              ) : (
                destinations.map((dest) => (
                  <button
                    key={dest.name}
                    onClick={() => handlePickDestination(dest.name)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F7FFF0] transition-colors border-b border-[#F0F0F0] last:border-0"
                  >
                    <span className="text-xl">{dest.emoji}</span>
                    <span className="font-bold text-[#3C3C3C]">{dest.name}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Dates */}
        <div>
          <label className="text-xs font-black text-[#AFAFAF] uppercase tracking-wider mb-2 block">
            Dates
          </label>
          <div className="w-full flex items-center gap-3 px-4 py-4 bg-white border-2 border-[#E5E5E5] rounded-2xl shadow-[0_3px_0_#D4D4D4]">
            <div className="w-9 h-9 rounded-xl bg-[#FFF8E7] flex items-center justify-center">
              <CalendarDays size={18} className="text-[#FFB800]" />
            </div>
            <button
              onClick={() => setShowDatePicker(true)}
              className="flex-1 font-bold text-left text-[#3C3C3C] bg-transparent outline-none"
            >
              <span className={formatDateRange() ? "text-[#3C3C3C]" : "text-[#AFAFAF]"}>
                {formatDateRange() || "Select dates (e.g. May 21–25)"}
              </span>
            </button>
          </div>

          <DuoDatePicker
            isOpen={showDatePicker}
            onClose={() => setShowDatePicker(false)}
            onSelect={handleDateSelect}
            startDate={startDate}
            endDate={endDate}
          />
        </div>

        {/* Guests */}
        <div>
          <label className="text-xs font-black text-[#AFAFAF] uppercase tracking-wider mb-2 block">
            Guests
          </label>
          <div className="w-full flex items-center gap-3 px-4 py-4 bg-white border-2 border-[#E5E5E5] rounded-2xl shadow-[0_3px_0_#D4D4D4]">
            <div className="w-9 h-9 rounded-xl bg-[#F4ECFF] flex items-center justify-center">
              <Users size={18} className="text-[#CE82FF]" />
            </div>
            <span className="flex-1 font-bold text-[#3C3C3C]">
              {guests} {guests === 1 ? "guest" : "guests"}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setGuests(Math.max(1, guests - 1))}
                className="w-8 h-8 rounded-xl bg-[#F7F7F7] border-2 border-[#E5E5E5] flex items-center justify-center font-black text-[#3C3C3C] active:bg-[#E5E5E5] transition-colors"
              >
                −
              </button>
              <span className="font-black text-[#3C3C3C] w-4 text-center">{guests}</span>
              <button
                onClick={() => setGuests(Math.min(10, guests + 1))}
                className="w-8 h-8 rounded-xl bg-[#58CC02] border-2 border-[#46A302] flex items-center justify-center font-black text-white active:bg-[#46A302] transition-colors"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Invite tip */}
        <div className="bg-[#F4ECFF] rounded-2xl p-3 border-2 border-[#CE82FF] flex items-center gap-3">
          <span className="text-2xl">💡</span>
          <p className="text-sm font-bold text-[#7A4B9A]">
            Invite friends after creating your trip to vote together!
          </p>
        </div>
      </div>

      {/* Create button */}
      <div className="px-5 mt-auto pb-8 pt-6">
        <DuoButton
          onClick={handleCreate}
          variant="primary"
          fullWidth
          className="py-4 text-base"
          disabled={!destination.trim()}
        >
          🚀 Create Trip
        </DuoButton>
      </div>
    </div>
  );
}