import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, MapPin, CalendarDays, Clock, Star, ChevronDown, ChevronUp, Share2, Download, Lightbulb, Save } from "lucide-react";
import { BottomNav } from "../components/BottomNav";
import { generateItinerary, getItinerary, saveItinerary } from "../../services/itineraryService";
import { getTripById, getTripMembers } from "../../services/tripService";
import { generateGroupPlanningProfile, COST_RANGE_BY_BUDGET } from "../../services/planningService";
import { itineraryToDisplayDays } from "../utils/itineraryToDisplayDays";
import type { Itinerary } from "../../types/itinerary";
import type { DisplayDay } from "../utils/itineraryToDisplayDays";
import { getVotesByTripId } from "../../services/voteService";
import { subscribeTripCloudSync } from "../../services/cloudHydrateService";

const BALI_IMG = "https://images.unsplash.com/photo-1682321297712-acaa3ea203c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYWxpJTIwaW5kb25lc2lhJTIwcmljZSUyMHRlcnJhY2UlMjBhZXJpYWx8ZW58MXx8fHwxNzcyODMxMTI0fDA&ixlib=rb-4.1.0&q=80&w=1080";
const RICE_TERRACE_IMG = "https://images.unsplash.com/photo-1537996194471-e657df975ab4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYWxpJTIwcmljZSUyMHRlcnJhY2UlMjBncmVlbnxlbnwxfHx8fDE3NzI4NTk4OTZ8MA&ixlib=rb-4.1.0&q=80&w=1080";
const MOUNT_BATUR_IMG = "https://images.unsplash.com/photo-1712078953326-346a472bddb0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb3VudCUyMGJhdHVyJTIwc3VucmlzZSUyMGhpa2luZyUyMGJhbGl8ZW58MXx8fHwxNzczMDIxNTY1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const TEMPLE_IMG = "https://images.unsplash.com/photo-1693493308351-f9c05a20139a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYWxpJTIwdGVtcGxlJTIwd2F0ZXIlMjBjdWx0dXJlfGVufDF8fHx8MTc3MzAyMTU2NXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const SURF_IMG = "https://images.unsplash.com/photo-1567520595865-0da8e017f2c3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxrdXRhJTIwYmVhY2glMjBzdXJmaW5nJTIwYmFsaXxlbnwxfHx8fDE3NzMwMjE1NjZ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";
const BEACH_CLUB_IMG = "https://images.unsplash.com/photo-1760869350325-8f015973ffaa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWFjaCUyMGNsdWIlMjBsdW5jaCUyMHRyb3BpY2FsfGVufDF8fHx8MTc3MzAyMTU2Nnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";

function dayReasoningBullets(text: string): string[] {
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);

  if (lines.length > 1) return lines.slice(0, 2);

  return text
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2);
}

const days = [
  {
    day: 1,
    date: "Tue, May 21",
    emoji: "🌴",
    title: "Arrival & Rice Terraces",
    events: [
      {
        id: "e1",
        time: "10:00 AM",
        title: "Arrive at Ngurah Rai Airport",
        type: "✈️ Travel",
        categoryColor: "#CE82FF",
        categoryBg: "#F9F0FF",
        duration: null,
        cost: null,
        votes: 4,
        image: null,
      },
      {
        id: "e2",
        time: "2:00 PM",
        title: "Tegallalang Rice Terrace",
        type: "🌿 Nature",
        categoryColor: "#58CC02",
        categoryBg: "#F0FDE4",
        duration: "2–3 hrs",
        cost: "$$",
        votes: 3,
        image: RICE_TERRACE_IMG,
      },
      {
        id: "e3",
        time: "7:00 PM",
        title: "Dinner at Locavore",
        type: "🍜 Food",
        categoryColor: "#FF4B4B",
        categoryBg: "#FFE5E5",
        duration: "1.5 hrs",
        cost: "$40",
        votes: 4,
        image: null,
      },
    ],
  },
  {
    day: 2,
    date: "Wed, May 22",
    emoji: "⛰️",
    title: "Mountain Adventure",
    events: [
      {
        id: "e4",
        time: "9:00 AM",
        title: "Mount Batur Hiking",
        type: "🏔️ Adventure",
        categoryColor: "#FF6347",
        categoryBg: "#FFECDB",
        duration: "4–5 hrs",
        cost: "$50",
        votes: 5,
        image: MOUNT_BATUR_IMG,
      },
      {
        id: "e5",
        time: "1:00 PM",
        title: "Temple Wat Culcut",
        type: "🏛️ Culture",
        categoryColor: "#FFD700",
        categoryBg: "#FFF8DC",
        duration: "1–2 hrs",
        cost: "$20",
        votes: 4,
        image: TEMPLE_IMG,
      },
    ],
  },
  {
    day: 3,
    date: "Thu, May 23",
    emoji: "🏄",
    title: "Beach & Surf Day",
    events: [
      {
        id: "e6",
        time: "10:00 AM",
        title: "Surfing at Kuta Beach",
        type: "🌊 Water Sports",
        categoryColor: "#00BFFF",
        categoryBg: "#E0FFFF",
        duration: "3–4 hrs",
        cost: "$30",
        votes: 5,
        image: SURF_IMG,
      },
      {
        id: "e7",
        time: "3:00 PM",
        title: "Relax at Beach Club",
        type: "🍹 Relaxation",
        categoryColor: "#FF69B4",
        categoryBg: "#FFEBE9",
        duration: "2–3 hrs",
        cost: "$25",
        votes: 4,
        image: BEACH_CLUB_IMG,
      },
    ],
  },
];

function buildVoterCountByPlaceId(votes: { placeId: string; memberId: string }[]): Record<string, number> {
  const m = new Map<string, Set<string>>();
  for (const v of votes) {
    if (!v.placeId || !v.memberId) continue;
    const set = m.get(v.placeId) ?? new Set<string>();
    set.add(v.memberId);
    m.set(v.placeId, set);
  }
  const out: Record<string, number> = {};
  for (const [placeId, set] of m.entries()) out[placeId] = set.size;
  return out;
}

function applyVoteProgressToDisplayDays(displayDays: DisplayDay[], voterCountByPlaceId: Record<string, number>): DisplayDay[] {
  return displayDays.map((d) => ({
    ...d,
    events: d.events.map((e) => {
      const placeId = e.detailPlaceId ?? e.id.replace(/-(lunch|dinner)$/, "");
      if (!placeId || placeId === e.id && (e.isHotel || e.isPlaceholder)) return e;
      return { ...e, votes: voterCountByPlaceId[placeId] ?? 0 };
    }),
  }));
}

export default function TripPlanScreen() {
  const navigate = useNavigate();
  const [expandedDay, setExpandedDay] = useState<number | null>(1);
  const [whyDayOpen, setWhyDayOpen] = useState<Record<number, boolean>>({});
  const [displayDays, setDisplayDays] = useState<DisplayDay[]>([]);
  const [tripName, setTripName] = useState("Bali Adventure");
  const [tripDestination, setTripDestination] = useState("Bali, Indonesia");
  const [tripDaysCount, setTripDaysCount] = useState(3);
  const [membersCount, setMembersCount] = useState(4);
  const [membersVoted, setMembersVoted] = useState(0);
  const [estPerPerson, setEstPerPerson] = useState<string>("$—");
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [waitingForVotes, setWaitingForVotes] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState("Save");
  const [showSuccess, setShowSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [saveError, setSaveError] = useState<string | null>(null);

  const tripId = typeof window !== "undefined" ? sessionStorage.getItem("currentTripId") : null;

  useEffect(() => {
    if (import.meta.env?.MODE === "development") {
      // eslint-disable-next-line no-console
      console.debug("[trip-plan] init", {
        tripIdFromSession: tripId,
        rawItineraries: typeof window !== "undefined" ? localStorage.getItem("tripItineraries") : null,
      });
    }
    if (!tripId) return;
    const trip = getTripById(tripId);
    if (trip) {
      setTripName(trip.name);
      setTripDestination(trip.destination);
      const days = Math.max(1, trip.tripDays ?? 3);
      setTripDaysCount(days);
      const members = getTripMembers(tripId);
      setMembersCount(members.length);

      // Estimate cost per person based on group budget and trip length
      try {
        const profile = generateGroupPlanningProfile(tripId);
        const budget = (profile.groupBudgetLevel || "moderate").toLowerCase();
        const range = COST_RANGE_BY_BUDGET[budget] ?? COST_RANGE_BY_BUDGET.moderate;
        const perDay =
          range.minPerDay && range.maxPerDay
            ? (range.minPerDay + range.maxPerDay) / 2
            : range.maxPerDay ?? range.minPerDay ?? 100;
        const total = perDay * days;
        const rounded = Math.round(total / 10) * 10;
        setEstPerPerson(`$${rounded}`);
      } catch {
        setEstPerPerson("$—");
      }
    }
    const stored = getItinerary(tripId);
    if (stored && trip) {
      setItinerary(stored);
      const votesForTrip = getVotesByTripId(tripId);
      const voterCountByPlaceId = buildVoterCountByPlaceId(votesForTrip);
      setDisplayDays(
        applyVoteProgressToDisplayDays(
          itineraryToDisplayDays(stored, trip.name, trip.createdAt),
          voterCountByPlaceId
        )
      );
      setWaitingForVotes(false);
      setAutoGenerating(false);
      const uniqueVoters = new Set(votesForTrip.map((v) => v.memberId));
      setMembersVoted(uniqueVoters.size);
      if (import.meta.env?.MODE === "development") {
        // eslint-disable-next-line no-console
        console.debug("[trip-plan] loaded itinerary", {
          tripIdFromSession: tripId,
          itineraryTripId: stored.tripId,
          savedAt: stored.savedAt,
        });
      }
    } else if (trip) {
      // No saved itinerary yet.
      // If voting isn't complete, don't show demo/fate data; show waiting until the group finishes.
      const members = getTripMembers(tripId);
      const votesForTrip = getVotesByTripId(tripId);
      const uniqueVoters = new Set(votesForTrip.map((v) => v.memberId));
      const allMembersVoted = members.length > 0 && uniqueVoters.size >= members.length;

      setItinerary(null);
      setDisplayDays([]);
      setWaitingForVotes(!allMembersVoted);
      setAutoGenerating(false);
      setMembersVoted(uniqueVoters.size);

      if (import.meta.env?.MODE === "development") {
        // eslint-disable-next-line no-console
        console.debug("[trip-plan] waiting for votes", {
          tripIdFromSession: tripId,
          members: members.length,
          uniqueVoters: uniqueVoters.size,
          allMembersVoted,
        });
      }
    } else if (import.meta.env?.MODE === "development") {
      // eslint-disable-next-line no-console
      console.debug("[trip-plan] no itinerary found for trip", { tripIdFromSession: tripId });
    }
  }, [tripId]);

  // After votes: react to cloud changes (Realtime) instead of polling; still refresh local UI after each hydrate.
  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;
    let generating = false;

    const afterHydrate = () => {
      void (async () => {
        if (cancelled) return;
        const trip = getTripById(tripId);
        if (!trip) return;

        const stored = getItinerary(tripId);
        if (stored) {
          if (cancelled) return;
          setItinerary(stored);
          const votesForTrip = getVotesByTripId(tripId);
          const voterCountByPlaceId = buildVoterCountByPlaceId(votesForTrip);
          setDisplayDays(
            applyVoteProgressToDisplayDays(
              itineraryToDisplayDays(stored, trip.name, trip.createdAt),
              voterCountByPlaceId
            )
          );
          setWaitingForVotes(false);
          setAutoGenerating(false);
          const uniqueVoters = new Set(votesForTrip.map((v) => v.memberId));
          setMembersVoted(uniqueVoters.size);
          return;
        }

        const members = getTripMembers(tripId);
        const votesForTrip = getVotesByTripId(tripId);
        const uniqueVoters = new Set(votesForTrip.map((v) => v.memberId));
        const allMembersVoted = members.length > 0 && uniqueVoters.size >= members.length;
        setMembersVoted(uniqueVoters.size);

        if (!allMembersVoted) {
          setWaitingForVotes(true);
          setAutoGenerating(false);
          return;
        }

        if (generating) return;
        generating = true;
        setAutoGenerating(true);
        setWaitingForVotes(false);
        try {
          const generated = await generateItinerary(tripId);
          if (!generated) return;

          saveItinerary(generated);
          if (cancelled) return;

          const updated = getItinerary(tripId) ?? generated;
          setItinerary(updated);
          const votesAfter = getVotesByTripId(tripId);
          const voterCountByPlaceId = buildVoterCountByPlaceId(votesAfter);
          setDisplayDays(
            applyVoteProgressToDisplayDays(
              itineraryToDisplayDays(updated, trip.name, trip.createdAt),
              voterCountByPlaceId
            )
          );
        } finally {
          generating = false;
          setAutoGenerating(false);
        }
      })();
    };

    const unsub = subscribeTripCloudSync(tripId, (_result) => {
      afterHydrate();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [tripId]);

  // Success countdown tick
  useEffect(() => {
    if (!showSuccess) return;
    if (countdown <= 0) return;
    if (import.meta.env?.MODE === "development") {
      // eslint-disable-next-line no-console
      console.debug("[trip-plan] countdown tick", { countdown });
    }
    const timer = setTimeout(() => {
      setCountdown((c) => c - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [showSuccess, countdown]);

  // Navigate back to trip detail when countdown finishes
  useEffect(() => {
    if (!showSuccess || countdown !== 0) return;
    if (!tripId) return;
    if (import.meta.env?.MODE === "development") {
      // eslint-disable-next-line no-console
      console.debug("[trip-plan] countdown complete, navigating back", {
        tripIdFromSession: tripId,
      });
    }
    navigate(`/trips/${tripId}`);
  }, [showSuccess, countdown, tripId, navigate]);

  const totalActivities = displayDays.reduce((acc, d) => acc + d.events.length, 0);

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F7F7] pb-24">
      {/* Hero */}
      <div className="relative w-full h-56">
        <img src={BALI_IMG} alt="Bali" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/70" />
        
        {/* Top buttons */}
        <button
          onClick={() => (tripId ? navigate(`/trips/${tripId}`) : navigate("/trip-detail"))}
          className="absolute top-12 left-4 w-10 h-10 rounded-xl bg-white/90 backdrop-blur flex items-center justify-center shadow-lg"
        >
          <ArrowLeft size={20} className="text-[#4B4B4B]" />
        </button>

        <div className="absolute top-12 right-4 flex gap-2">
          <button className="w-10 h-10 rounded-xl bg-white/90 backdrop-blur flex items-center justify-center shadow-lg">
            <Share2 size={18} className="text-[#4B4B4B]" />
          </button>
          <button className="w-10 h-10 rounded-xl bg-white/90 backdrop-blur flex items-center justify-center shadow-lg">
            <Download size={18} className="text-[#4B4B4B]" />
          </button>
        </div>

        <div className="absolute bottom-4 left-5 right-5">
          <h1 className="text-white font-black text-2xl">{tripName} 🌴</h1>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1">
              <MapPin size={13} className="text-white/80" />
              <span className="text-white/80 text-xs font-bold">{tripDestination}</span>
            </div>
            <div className="flex items-center gap-1">
              <CalendarDays size={13} className="text-white/80" />
              <span className="text-white/80 text-xs font-bold">{tripDaysCount} days</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      <div className="mx-5 mt-4">
        <div className="bg-white rounded-2xl border-2 border-[#FFD900] shadow-[0_3px_0_#E5C400] p-4">
          <p className="text-sm font-bold text-[#3C3C3C]">
            🎨 Draft itinerary ready. Please review and edit
          </p>
        </div>
      </div>

      {/* Summary bar */}
      <div className="mx-5 mt-4">
        <div className="bg-white rounded-2xl border-2 border-[#58CC02] shadow-[0_4px_0_#46A302] p-4">
          <div className="flex justify-around">
            <div className="text-center">
              <div className="font-black text-[#3C3C3C] text-2xl">{tripDaysCount}</div>
              <div className="text-xs font-bold text-[#AFAFAF]">Days</div>
            </div>
            <div className="w-px bg-[#E5E5E5]" />
            <div className="text-center">
              <div className="font-black text-[#3C3C3C] text-2xl">{totalActivities}</div>
              <div className="text-xs font-bold text-[#AFAFAF]">Activities</div>
            </div>
            <div className="w-px bg-[#E5E5E5]" />
            <div className="text-center">
              <div className="font-black text-[#3C3C3C] text-2xl">{membersCount}</div>
              <div className="text-xs font-bold text-[#AFAFAF]">Members</div>
            </div>
            <div className="w-px bg-[#E5E5E5]" />
            <div className="text-center">
              <div className="font-black text-[#58CC02] text-2xl">{estPerPerson}</div>
              <div className="text-xs font-bold text-[#AFAFAF]">Est./person</div>
            </div>
          </div>
        </div>
      </div>

      {/* Itinerary Section */}
      <div className="px-5 pt-5 flex flex-col gap-3">
        <h2 className="font-black text-[#3C3C3C] text-base uppercase tracking-[0.4px]">
          🗺️ ITINERARY
        </h2>
        {displayDays.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-[#E5E5E5] p-6 text-center">
            <p className="text-[#AFAFAF] font-bold text-sm">
              {autoGenerating
                ? "Generating your trip plan…"
                : waitingForVotes
                  ? "Waiting for everyone to finish voting…"
                  : "No itinerary yet. Complete voting to generate a plan."}
            </p>
            {waitingForVotes && (
              <div className="mt-3">
                <div className="text-xs font-black text-[#2D7800]">
                  Group voting: {membersVoted} / {membersCount} voted
                </div>
                <div className="h-2 bg-[#D4F5B4] rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-[#58CC02] rounded-full transition-all"
                    style={{
                      width:
                        membersCount > 0
                          ? `${Math.max(5, (membersVoted / membersCount) * 100)}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          displayDays.map((day) => {
          const isExpanded = expandedDay === day.day;
          return (
            <div
              key={day.day}
              className={`bg-white rounded-2xl border-2 overflow-hidden transition-all ${
                isExpanded
                  ? "border-[#58CC02] shadow-[0_4px_0_#46A302]"
                  : "border-[#E5E5E5] shadow-[0_4px_0_#D4D4D4]"
              }`}
            >
              {/* Day header */}
              <button
                className="w-full flex items-center gap-3 p-4"
                onClick={() => setExpandedDay(isExpanded ? null : day.day)}
              >
                <div
                  className={`w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0 text-xl border-2 ${
                    isExpanded
                      ? "bg-[#F0FDE4] border-[#46A302]"
                      : "bg-[#F7F7F7] border-[#E5E5E5]"
                  }`}
                >
                  {day.emoji}
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-black uppercase tracking-[0.6px] ${
                        isExpanded ? "text-[#58CC02]" : "text-[#AFAFAF]"
                      }`}
                    >
                      Day {day.day}
                    </span>
                    <span className="text-xs font-bold text-[#AFAFAF]">·</span>
                    <span className="text-xs font-bold text-[#AFAFAF]">
                      {day.date}
                    </span>
                  </div>
                  <h3 className="font-black text-[#3C3C3C] text-lg leading-[27px]">
                    {day.title}
                  </h3>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-bold text-[#AFAFAF]">
                    {day.events.length} stops
                  </span>
                  {isExpanded ? (
                    <ChevronUp size={18} className="text-[#58CC02]" />
                  ) : (
                    <ChevronDown size={18} className="text-[#AFAFAF]" />
                  )}
                </div>
              </button>

              {day.dayReasoning && (
                <div className="px-4 pb-1 border-t border-[#F0F0F0]">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-2 py-2.5 text-left"
                    onClick={() =>
                      setWhyDayOpen((prev) => ({ ...prev, [day.day]: !prev[day.day] }))
                    }
                  >
                    <span className="text-[11px] font-black uppercase tracking-[0.5px] text-[#AFAFAF]">
                      Why this day?
                    </span>
                    {whyDayOpen[day.day] ? (
                      <ChevronUp size={16} className="text-[#AFAFAF] flex-shrink-0" />
                    ) : (
                      <ChevronDown size={16} className="text-[#AFAFAF] flex-shrink-0" />
                    )}
                  </button>
                  {whyDayOpen[day.day] && (
                    <ul className="space-y-1.5 pb-3 pr-1">
                      {dayReasoningBullets(day.dayReasoning).map((line, idx) => (
                        <li
                          key={`${day.day}-why-${idx}`}
                          className="flex gap-2 text-xs font-bold text-[#777777] leading-snug"
                        >
                          <span className="mt-[0.45em] h-1.5 w-1.5 rounded-full bg-[#AFAFAF] flex-shrink-0" />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Events */}
              {isExpanded && day.events.length > 0 && (
                <div className="border-t-2 border-[#F0F0F0]">
                  {day.events.map((event, idx) => (
                    <div
                      key={event.id}
                      className={`flex gap-3 p-4 ${
                        idx !== day.events.length - 1
                          ? "border-b border-[#F0F0F0]"
                          : ""
                      }`}
                    >
                      {/* Timeline dot */}
                      <div className="flex flex-col items-center w-5 flex-shrink-0 pt-1">
                        <div className="w-3 h-3 rounded-full bg-[#58CC02] border-2 border-white shadow-[0_0_0_2px_#58CC02]" />
                        {idx !== day.events.length - 1 && (
                          <div className="w-0.5 flex-1 bg-[#E5E5E5] mt-1 min-h-[40px]" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 mb-1">
                          <span className="text-xs font-black text-[#AFAFAF] flex-shrink-0">
                            {event.time}
                          </span>
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{
                              color: event.categoryColor,
                              backgroundColor: event.categoryBg,
                            }}
                          >
                            {event.type}
                          </span>
                        </div>
                        <h4 className="font-black text-[#3C3C3C] text-base">
                          {event.title}
                        </h4>

                        {event.image && (
                          <img
                            src={event.image}
                            alt={event.title}
                            className="w-full h-32 object-cover rounded-xl mt-2"
                          />
                        )}

                        <div className="flex items-center gap-3 mt-2">
                          {event.duration && (
                            <div className="flex items-center gap-1">
                              <Clock size={11} className="text-[#AFAFAF]" />
                              <span className="text-xs font-bold text-[#AFAFAF]">
                                {event.duration}
                              </span>
                            </div>
                          )}
                          {event.cost && (
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold text-[#AFAFAF]">
                                💵 {event.cost}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Star
                              size={11}
                              className="text-[#FFD900]"
                              fill="#FFD900"
                            />
                            <span className="text-xs font-bold text-[#AFAFAF]">
                              {event.votes}/{membersCount} voted
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
      </div>

      {/* Bottom CTA Buttons */}
      <div className="px-5 pt-6 pb-4 flex gap-3">
        <button className="flex-1 flex items-center justify-center gap-2 py-4 bg-white rounded-2xl border-2 border-[#FFD900] shadow-[0_3px_0_#E5C400] font-bold text-[#3C3C3C] active:translate-y-0.5 active:shadow-none transition-all">
          <Lightbulb size={18} className="text-[#FFD900]" />
          Improve plan
        </button>
        <button
          className="flex-1 flex items-center justify-center gap-2 py-4 bg-[#CE82FF] rounded-2xl border-2 border-[#CE82FF] shadow-[0_3px_0_#A855F7] font-bold text-white active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-60 disabled:shadow-none"
          disabled={!tripId || isSaving || showSuccess}
          onClick={async () => {
            if (!tripId) return;
            setSaveError(null);
            if (import.meta.env?.MODE === "development") {
              // eslint-disable-next-line no-console
              console.debug("[trip-plan] save button clicked", {
                tripIdFromSession: tripId,
                hasItinerary: !!itinerary,
              });
            }
            setIsSaving(true);
            try {
              let toSave = itinerary;
              if (!toSave) {
                toSave = await generateItinerary(tripId);
                if (!toSave) {
                  setSaveError(
                    "No plan generated yet. Vote on activities first, then try Save again."
                  );
                  return;
                }
                setItinerary(toSave);
                const trip = getTripById(tripId);
                if (trip) {
                  const votesForTrip = getVotesByTripId(tripId);
                  const voterCountByPlaceId = buildVoterCountByPlaceId(votesForTrip);
                  setDisplayDays(
                    applyVoteProgressToDisplayDays(
                      itineraryToDisplayDays(toSave, trip.name, trip.createdAt),
                      voterCountByPlaceId
                    )
                  );
                }
              }
              const aligned = { ...toSave, tripId };
              saveItinerary(aligned);
              setItinerary(aligned);
              setSaveLabel("Saved");
              if (import.meta.env?.MODE === "development") {
                // eslint-disable-next-line no-console
                console.debug("[trip-plan] saveItinerary called", {
                  tripIdFromSession: tripId,
                  itineraryTripId: aligned.tripId,
                  rawItineraries: typeof window !== "undefined" ? localStorage.getItem("tripItineraries") : null,
                });
              }
              setShowSuccess(true);
              setCountdown(3);
            } finally {
              setIsSaving(false);
            }
          }}
        >
          <Save size={18} />
          {isSaving ? "Saving..." : saveLabel}
        </button>
      </div>
      {saveError && (
        <div className="px-5 pb-2">
          <p className="text-xs font-bold text-[#FF4B4B] text-center">{saveError}</p>
        </div>
      )}

      {/* Save success overlay with countdown */}
      {showSuccess && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-8 mx-6 text-center border-4 border-[#58CC02] shadow-[0_8px_0_#46A302]">
            <span className="text-6xl block mb-4">✅</span>
            <h2 className="font-black text-[#3C3C3C] text-2xl mb-2">Itinerary saved!</h2>
            <p className="font-bold text-[#AFAFAF] mb-2">
              Returning to your trip in {countdown}…
            </p>
            <p className="text-xs font-bold text-[#AFAFAF]">
              You can view and edit this plan anytime from the trip page.
            </p>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}