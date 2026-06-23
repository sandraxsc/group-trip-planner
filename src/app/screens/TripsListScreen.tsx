import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Plus, MapPin, Calendar, Users, CheckCircle2 } from "lucide-react";
import { BottomNav } from "../components/BottomNav";
import { getTrips, getTripMembers } from "../../services/tripService";
import {
  hasCachedActiveItinerary,
  prefetchActiveItineraries,
} from "../../services/itineraryCloudStore";
import { subscribeTripCloudSync } from "../../services/cloudHydrateService";
import { getTripPlanningProgressPercent } from "../../utils/tripPlanningProgress";
import type { Trip } from "../../types/trip";

type Tab = "ongoing" | "completed";

/**
 * Format a YYYY-MM-DD start date + tripDays into a friendly date range string,
 * e.g. "May 24 – May 28". Falls back to the trip's createdAt timestamp when
 * startDate is missing (legacy trips created before the field existed).
 */
function formatTripDateRange(trip: Trip): string {
  const days = Math.max(1, trip.tripDays ?? 1);
  if (trip.startDate && /^\d{4}-\d{2}-\d{2}$/.test(trip.startDate)) {
    const [y, m, d] = trip.startDate.split("-").map(Number);
    if (y && m && d) {
      const start = new Date(y, m - 1, d);
      const end = new Date(start);
      end.setDate(start.getDate() + days - 1);
      const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
      const startLabel = start.toLocaleDateString("en-US", opts);
      const endLabel = end.toLocaleDateString("en-US", opts);
      return days === 1 ? startLabel : `${startLabel} – ${endLabel}`;
    }
  }
  return new Date(trip.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Pick a coarse emoji based on destination keywords; pure presentational sugar. */
function destinationEmoji(destination: string): string {
  const d = destination.toLowerCase();
  if (/(tokyo|kyoto|japan|osaka)/.test(d)) return "🏯";
  if (/(bali|beach|cancun|hawaii|maldives)/.test(d)) return "🏖️";
  if (/(swiss|alps|patagonia|mountain|fuji)/.test(d)) return "🏔️";
  if (/(paris|rome|london|new york|nyc|barcelona|berlin)/.test(d)) return "🗼";
  if (/(forest|jungle|amazon)/.test(d)) return "🌲";
  return "🌍";
}

export default function TripsListScreen() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tab, setTab] = useState<Tab>("ongoing");
  /** Bumps when any trip-scoped cloud sync resolves so progress % updates. */
  const [, setSyncRev] = useState(0);
  const [itineraryCacheRev, setItineraryCacheRev] = useState(0);

  useEffect(() => {
    setTrips(getTrips());
  }, []);

  useEffect(() => {
    if (trips.length === 0) return;
    void prefetchActiveItineraries(trips.map((t) => t.id)).then(() => {
      setItineraryCacheRev((n) => n + 1);
    });
  }, [trips]);

  // Re-load on focus so changes from other screens (new trip, completed plan,
  // deletion) are reflected immediately when the user lands here.
  useEffect(() => {
    const onFocus = () => setTrips(getTrips());
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  // Subscribe to per-trip cloud sync for ongoing trips so the progress bar
  // updates when a teammate completes their preferences from another device.
  // We re-subscribe whenever the trip set changes; the unsub function from
  // each subscription is collected and torn down together.
  const ongoingTripIds = useMemo(() => {
    void itineraryCacheRev;
    return trips.filter((t) => !hasCachedActiveItinerary(t.id)).map((t) => t.id);
  }, [trips, itineraryCacheRev]);
  useEffect(() => {
    if (ongoingTripIds.length === 0) return;
    const unsubs = ongoingTripIds.map((id) =>
      subscribeTripCloudSync(id, () => {
        setSyncRev((n) => n + 1);
        setTrips(getTrips());
      })
    );
    return () => {
      for (const u of unsubs) u();
    };
  }, [ongoingTripIds.join("|")]);

  const { ongoing, completed } = useMemo(() => {
    void itineraryCacheRev;
    const ongoing: Trip[] = [];
    const completed: Trip[] = [];
    // Most-recent first within each bucket.
    const sorted = [...trips].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1
    );
    for (const t of sorted) {
      if (hasCachedActiveItinerary(t.id)) completed.push(t);
      else ongoing.push(t);
    }
    return { ongoing, completed };
  }, [trips, itineraryCacheRev]);

  const visible = tab === "ongoing" ? ongoing : completed;

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F7F7] pb-24">
      {/* Tabs (top of page; new-trip CTA lives inline at the right) */}
      <div className="px-5 pt-12">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white rounded-2xl border-2 border-[#E5E5E5] shadow-[0_3px_0_#D4D4D4] p-1 flex">
            {(
              [
                { id: "ongoing" as const, label: "Ongoing", count: ongoing.length },
                { id: "completed" as const, label: "Completed", count: completed.length },
              ]
            ).map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex-1 py-2 rounded-xl font-black text-sm tracking-[0.3px] transition-colors ${
                    active
                      ? "bg-[#58CC02] text-white shadow-[0_2px_0_#46A302]"
                      : "text-[#AFAFAF]"
                  }`}
                >
                  {t.label}
                  <span
                    className={`ml-1.5 text-[11px] font-black ${
                      active ? "text-white/90" : "text-[#AFAFAF]"
                    }`}
                  >
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => navigate("/create-trip")}
            aria-label="Create new trip"
            className="w-10 h-10 rounded-xl bg-[#58CC02] flex items-center justify-center shadow-[0_3px_0_#46A302] active:translate-y-0.5 active:shadow-none transition-all flex-shrink-0"
          >
            <Plus size={20} className="text-white" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="px-5 pt-4 flex flex-col gap-3">
        {visible.length === 0 && (
          <div className="bg-white rounded-2xl border-2 border-dashed border-[#E5E5E5] p-8 text-center mt-2">
            <p className="text-3xl mb-2" aria-hidden>
              {tab === "ongoing" ? "🗺️" : "🏁"}
            </p>
            <p className="text-[#3C3C3C] font-black text-sm">
              {tab === "ongoing"
                ? "No trips in active planning"
                : "No completed trips yet"}
            </p>
            <p className="text-[#AFAFAF] font-bold text-xs mt-1">
              {tab === "ongoing"
                ? "Start planning a new adventure with your friends."
                : "Once you finish planning a trip it will appear here."}
            </p>
            {tab === "ongoing" && (
              <button
                type="button"
                onClick={() => navigate("/create-trip")}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#58CC02] text-white font-black text-sm shadow-[0_3px_0_#46A302] active:translate-y-0.5 active:shadow-none transition-all"
              >
                <Plus size={16} strokeWidth={2.5} />
                Create a trip
              </button>
            )}
          </div>
        )}

        {visible.map((trip) => {
          const members = getTripMembers(trip.id);
          const isCompleted = tab === "completed";
          const progressPct = isCompleted
            ? 100
            : getTripPlanningProgressPercent(trip, members);
          return (
            <button
              key={trip.id}
              type="button"
              onClick={() => navigate(`/trips/${trip.id}`)}
              className={`text-left bg-white rounded-2xl border-2 ${
                isCompleted ? "border-[#E5E5E5]" : "border-[#58CC02]"
              } shadow-[0_4px_0_${
                isCompleted ? "#D4D4D4" : "#46A302"
              }] p-4 active:translate-y-0.5 active:shadow-none transition-all`}
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#F7F7F7] border-2 border-[#E5E5E5] flex items-center justify-center text-2xl flex-shrink-0">
                  <span aria-hidden>{destinationEmoji(trip.destination)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={`text-[10px] font-black uppercase tracking-[0.5px] px-2 py-0.5 rounded-full border ${
                        isCompleted
                          ? "text-[#46A302] bg-[#E8F8DA] border-[#9AE16A]"
                          : "text-[#FF9F1C] bg-[#FFF8E6] border-[#FFD900]"
                      }`}
                    >
                      {isCompleted ? "Completed" : "Planning"}
                    </span>
                    {isCompleted && (
                      <CheckCircle2 size={14} className="text-[#58CC02]" fill="#58CC02" />
                    )}
                  </div>
                  <h3 className="font-black text-[#3C3C3C] text-base leading-snug break-words">
                    {trip.name}
                  </h3>
                  <div className="flex items-center gap-1 mt-1">
                    <MapPin size={12} className="text-[#AFAFAF]" />
                    <span className="text-xs font-bold text-[#AFAFAF] truncate">
                      {trip.destination}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-3 mb-2">
                <div className="flex items-center gap-1">
                  <Calendar size={12} className="text-[#AFAFAF]" />
                  <span className="text-[11px] font-bold text-[#AFAFAF]">
                    {formatTripDateRange(trip)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Users size={12} className="text-[#AFAFAF]" />
                  <span className="text-[11px] font-bold text-[#AFAFAF]">
                    {members.length} {members.length === 1 ? "member" : "members"}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] font-bold text-[#AFAFAF] uppercase tracking-[0.4px]">
                    {isCompleted ? "Itinerary" : "Planning progress"}
                  </span>
                  <span
                    className={`text-[11px] font-black ${
                      isCompleted ? "text-[#46A302]" : "text-[#58CC02]"
                    }`}
                  >
                    {isCompleted ? "Ready" : `${progressPct}%`}
                  </span>
                </div>
                <div className="h-2 bg-[#E5E5E5] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#58CC02] to-[#89E219] rounded-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
}
