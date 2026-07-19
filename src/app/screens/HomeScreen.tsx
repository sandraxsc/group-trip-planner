import { useNavigate } from "react-router";
import { useState, useEffect, useMemo } from "react";
import { Plus, ChevronRight, Flame, MapPin, Users, Clock, Search } from "lucide-react";
import { DuoCard } from "../components/DuoCard";
import { BottomNav } from "../components/BottomNav";
import plotagoLogo from "../../assets/plotago-logo.png";
import { getTrips, getTripMembers } from "../../services/tripService";
import {
  getActiveItinerary,
  hasCachedActiveItinerary,
  prefetchActiveItineraries,
} from "../../services/itineraryCloudStore";
import { subscribeTripCloudSync } from "../../services/cloudHydrateService";
import { warmApiProxyOncePerSession } from "../../utils/warmApiProxy";
import { getTripPlanningProgressPercent } from "../../utils/tripPlanningProgress";
import { seedEdgeCaseThreePersonTrip } from "../../utils/devSeed";
import { getUserName, getInitialsFromName } from "../../services/userProfileService";
import type { Trip } from "../../types/trip";

const BEACH_IMG =
  "https://images.unsplash.com/photo-1771767643273-15305701890b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0cm9waWNhbCUyMGJlYWNoJTIwdmFjYXRpb24lMjBkZXN0aW5hdGlvbnxlbnwxfHx8fDE3NzI4MzA5ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080";

const CITY_IMG =
  "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const MOUNTAIN_IMG =
  "https://images.unsplash.com/photo-1501785888041-af3ef285b470?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const NIGHT_MARKET_IMG =
  "https://images.unsplash.com/photo-1521017432531-fbd92d768814?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const COFFEE_IMG =
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const FOOD_IMG =
  "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";

export default function HomeScreen() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [showAllNearby, setShowAllNearby] = useState(false);
  const [showAllPopular, setShowAllPopular] = useState(false);
  /** Bumps after cloud hydrate / itinerary cache warm. */
  const [ongoingSyncRev, setOngoingSyncRev] = useState(0);
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

  useEffect(() => {
    warmApiProxyOncePerSession();
  }, []);

  // Read once per render from the local onboarding profile.
  const userDisplayName = getUserName("Traveler");
  const userInitials = getInitialsFromName(userDisplayName);

  const latestOngoingTrip = useMemo(() => {
    void itineraryCacheRev;
    const ongoing = trips
      .filter((t) => !hasCachedActiveItinerary(t.id))
      .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
    return ongoing[0] ?? null;
  }, [trips, itineraryCacheRev]);

  useEffect(() => {
    const id = latestOngoingTrip?.id;
    if (!id) return;
    return subscribeTripCloudSync(id, (_result) => {
      setOngoingSyncRev((n) => n + 1);
    });
  }, [latestOngoingTrip?.id]);

  const ongoingPlanningProgressPct = useMemo(() => {
    if (!latestOngoingTrip) return 0;
    void ongoingSyncRev;
    return getTripPlanningProgressPercent(latestOngoingTrip, getTripMembers(latestOngoingTrip.id));
  }, [latestOngoingTrip, ongoingSyncRev]);

  function initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .map((s) => s[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  function formatRelativeDays(daysAgo: number): string {
    if (daysAgo <= 0) return "today";
    if (daysAgo === 1) return "1 day ago";
    return `${daysAgo} days ago`;
  }

  type Recommendation = {
    id: string;
    image: string;
    title: string;
    description: string;
    authorName: string;
    createdDaysAgo: number;
  };

  const nearbyTrips: Recommendation[] = [
    {
      id: "nb-1",
      image: CITY_IMG,
      title: "Birthday city break: museums + sunset snacks",
      description: "Designed for a chill pace with one “must-try” local dessert.",
      authorName: "Lina",
      createdDaysAgo: 2,
    },
    {
      id: "nb-2",
      image: MOUNTAIN_IMG,
      title: "Sunrise hike + cozy brunch (2 days, low stress)",
      description: "Morning trail, easy viewpoints, and a comfy breakfast spot.",
      authorName: "Noah",
      createdDaysAgo: 5,
    },
    {
      id: "nb-3",
      image: NIGHT_MARKET_IMG,
      title: "Night market nights: street eats + city lights",
      description: "Food first, then stroll. Great for first-time visitors.",
      authorName: "Maya",
      createdDaysAgo: 1,
    },
    {
      id: "nb-4",
      image: COFFEE_IMG,
      title: "Coffee & art weekend: small galleries + slow mornings",
      description: "Meet your crew, grab espresso, and wander without pressure.",
      authorName: "Arjun",
      createdDaysAgo: 3,
    },
    {
      id: "nb-5",
      image: BEACH_IMG,
      title: "Beach afternoon reset: swim, walk, then dinner",
      description: "Light itinerary with a flexible lunch → sunset plan.",
      authorName: "Sarah",
      createdDaysAgo: 7,
    },
    {
      id: "nb-6",
      image: FOOD_IMG,
      title: "Food crawl challenge: 3 neighborhoods, 1 weekend",
      description: "Pick-your-own spots. Everyone votes on the final route.",
      authorName: "Kenji",
      createdDaysAgo: 4,
    },
  ];

  const popularIdeas: Recommendation[] = [
    {
      id: "pp-1",
      image: FOOD_IMG,
      title: "Street food tour with a “signature bite” moment",
      description: "Taste-first route, with time for photos and a friendly pace.",
      authorName: "Ava",
      createdDaysAgo: 6,
    },
    {
      id: "pp-2",
      image: CITY_IMG,
      title: "Museums & coffee: culture weekend, zero rush",
      description: "Mix classic exhibits with cozy cafés and evening walks.",
      authorName: "Theo",
      createdDaysAgo: 2,
    },
    {
      id: "pp-3",
      image: NIGHT_MARKET_IMG,
      title: "Night skyline + market snacks (perfect for groups)",
      description: "One main meeting point, then choose-your-own stalls.",
      authorName: "Zara",
      createdDaysAgo: 3,
    },
    {
      id: "pp-4",
      image: MOUNTAIN_IMG,
      title: "Scenic views + adventure photos",
      description: "A balanced day plan for hikers and casual explorers.",
      authorName: "Ethan",
      createdDaysAgo: 4,
    },
    {
      id: "pp-5",
      image: COFFEE_IMG,
      title: "Slow morning café hopping (one wildcard stop)",
      description: "Simple, cozy, and easy to reorder based on your mood.",
      authorName: "Ivy",
      createdDaysAgo: 1,
    },
    {
      id: "pp-6",
      image: BEACH_IMG,
      title: "Beach-to-dinner combo: swim, walk, repeat",
      description: "Relaxed timing and a restaurant shortlist that gets voted on.",
      authorName: "Luca",
      createdDaysAgo: 8,
    },
  ];

  const visibleNearby = showAllNearby ? nearbyTrips : nearbyTrips.slice(0, 3);
  const visiblePopular = showAllPopular ? popularIdeas : popularIdeas.slice(0, 2);

  return (
    <div className="flex flex-col min-h-screen bg-white pb-24">
      {/* Top bar */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[402px] flex items-center justify-between px-5 pt-5 pb-3 bg-white border-b border-[#E8E8E8] z-40">
        <img src={plotagoLogo} alt="Plotago" className="h-7 w-auto" />
        <button
          type="button"
          aria-label="Search"
          className="w-10 h-10 flex items-center justify-center active:translate-y-0.5 transition-all"
        >
          <Search size={20} className="text-[#6B7280]" />
        </button>
      </div>
      {/* Spacer so fixed top bar doesn't cover the content below it */}
      <div className="h-[60px]" />

      {import.meta.env?.MODE === "development" && (
        <div className="px-5 pt-5">
          <div className="bg-white rounded-2xl border-2 border-[#E8E8E8] p-4">
            <div className="flex flex-col gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black text-[#6B7280] uppercase tracking-wide">Dev</p>
                <p className="font-black text-[#1F302E] text-base">Edge case: 3-person Tokyo trip</p>
                <p className="text-xs font-bold text-[#6B7280] mt-1 leading-snug">
                  Luxury vs budget vs anime/nightlife — all prefs, places, MBTI, and conflicting votes.
                </p>
              </div>
              <ul className="text-[11px] font-bold text-[#6B7280] space-y-1 pl-3 border-l-2 border-[#E8E8E8]">
                <li>
                  <span className="text-[#1F302E]">A</span> — luxury, sushi &amp; hotel, ENTJ
                </li>
                <li>
                  <span className="text-[#1F302E]">B</span> — budget hostels &amp; conbini, ISTJ
                </li>
                <li>
                  <span className="text-[#1F302E]">C</span> — anime shopping &amp; nightlife, ENFP
                </li>
              </ul>
              <button
                type="button"
                className="w-full py-3 rounded-xl bg-[#10B954] text-white font-black text-sm border-b-4 border-[#0D9443] active:border-b-2 active:translate-y-0.5"
                onClick={() => {
                  const { tripId: seededTripId } = seedEdgeCaseThreePersonTrip({ destination: "Tokyo, Japan", tripDays: 4 });
                  navigate(`/trips/${seededTripId}/plans`);
                }}
              >
                Seed edge case &amp; plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#10B954] to-[#0D9443] flex items-center justify-center shadow-[0_3px_0_#2d7800]">
              <span className="text-white font-bold text-sm">{userInitials}</span>
            </div>
            <div>
              <p className="text-xs text-[#6B7280] font-bold uppercase tracking-wider">Welcome back!</p>
              <p className="text-[#1F302E] font-black text-lg">{userDisplayName} 👋</p>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-[#FFF4CC] px-3 py-1.5 rounded-full border-2 border-[#FFB000]">
            <Flame size={16} className="text-[#FF6B00]" fill="#FF6B00" />
            <span className="text-[#6B7280] font-black text-sm">12</span>
          </div>
        </div>
      </div>

      {/* XP Progress Bar */}
      <div className="px-5 mb-6">
        <div className="bg-[#F7F7F6] rounded-2xl p-4 border-2 border-[#E8E8E8]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wide">Trip Explorer</span>
            <span className="text-xs font-black text-[#10B954]">350 XP</span>
          </div>
          <div className="h-3 bg-[#E8E8E8] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#10B954] to-[#4CD583] rounded-full w-[65%] transition-all" />
          </div>
        </div>
      </div>

      {/* On-going planning */}
      <div className="px-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-black text-[#1F302E] text-base uppercase tracking-wide">
            On-going trips
          </h2>
          <button className="text-[#6B7280] font-bold text-sm">See all</button>
        </div>

        {!latestOngoingTrip ? (
          trips.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-[#E8E8E8] border-dashed p-8 text-center">
              <p className="text-[#6B7280] font-bold text-sm">No trips yet. Create one to get started!</p>
              <button
                onClick={() => navigate("/create-trip")}
                className="mt-3 text-[#1CB0F6] font-bold text-sm"
              >
                Create your first trip
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border-2 border-[#E8E8E8] border-dashed p-8 text-center">
              <p className="text-[#6B7280] font-bold text-sm">No trips in active planning right now.</p>
              <button
                type="button"
                onClick={() => navigate("/create-trip")}
                className="mt-3 text-[#1CB0F6] font-bold text-sm"
              >
                Start another trip
              </button>
            </div>
          )
        ) : (
            <DuoCard
              color="green"
              onClick={() => navigate(`/trips/${latestOngoingTrip.id}`)}
            >
              <div className="overflow-hidden rounded-t-2xl">
                <img
                  src={BEACH_IMG}
                  alt={latestOngoingTrip.name}
                  className="w-full h-32 object-cover"
                />
              </div>
              <div className="p-4">
                <div className="mb-2">
                  <h3 className="font-black text-[#1F302E] text-lg">{latestOngoingTrip.name}</h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin size={14} className="text-[#6B7280]" />
                    <span className="text-sm text-[#6B7280] font-bold">{latestOngoingTrip.destination}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1">
                    <Clock size={14} className="text-[#6B7280]" />
                    <span className="text-sm font-bold text-[#6B7280]">
                      {new Date(latestOngoingTrip.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users size={14} className="text-[#6B7280]" />
                    <span className="text-sm font-bold text-[#6B7280]">
                      {getTripMembers(latestOngoingTrip.id).length} members
                    </span>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-[#6B7280]">Planning progress</span>
                    <span className="text-xs font-black text-[#10B954]">{ongoingPlanningProgressPct}%</span>
                  </div>
                  <div className="h-3 bg-[#E8E8E8] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#10B954] to-[#4CD583] rounded-full transition-all duration-300"
                      style={{ width: `${ongoingPlanningProgressPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </DuoCard>
        )}
      </div>

      {/* Nearby weekend trips (static feed) */}
      <div className="px-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-black text-[#1F302E] text-base uppercase tracking-wide">
            Nearby weekend trips
          </h2>
          <button
            type="button"
            onClick={() => setShowAllNearby((v) => !v)}
            className="text-[#6B7280] font-bold text-sm flex items-center gap-1"
          >
            {showAllNearby ? "Show less" : "View more"} <ChevronRight size={16} />
          </button>
        </div>

        <div
          className="flex gap-3 overflow-x-auto pb-2 -mx-1 flex-nowrap no-scrollbar"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {visibleNearby.map((t) => (
            <div
              key={t.id}
              className="flex-shrink-0 min-w-[190px] max-w-[190px]"
              style={{ scrollSnapAlign: "start" }}
            >
              <DuoCard color="default" className="h-full">
                <div className="overflow-hidden rounded-t-2xl">
                  <img src={t.image} alt={t.title} className="w-full h-28 object-cover" />
                </div>
                <div className="p-3">
                  <h3 className="font-black text-[#1F302E] text-sm leading-[18px] line-clamp-2">
                    {t.title}
                  </h3>
                  <p className="text-xs text-[#6B7280] font-bold mt-1 line-clamp-2">
                    {t.description}
                  </p>
                  <div className="mt-2 flex items-center gap-2 min-w-0">
                    <div className="w-5 h-5 rounded-full bg-[#E6F4EA] border-2 border-[#10B954] flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-black text-[#2D7800]">
                        {initials(t.authorName)}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-[#6B7280] truncate">
                      {formatRelativeDays(t.createdDaysAgo)}
                    </p>
                  </div>
                </div>
              </DuoCard>
            </div>
          ))}
        </div>
      </div>

      {/* Popular trips (static feed) */}
      <div className="px-5 mb-12">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-black text-[#1F302E] text-base uppercase tracking-wide">
            Popular trip ideas
          </h2>
          <button
            type="button"
            onClick={() => setShowAllPopular((v) => !v)}
            className="text-[#6B7280] font-bold text-sm flex items-center gap-1"
          >
            {showAllPopular ? "Show less" : "View more"} <ChevronRight size={16} />
          </button>
        </div>

        <div className="space-y-3">
          {visiblePopular.map((t) => (
            <DuoCard key={t.id} color="default">
              <div className="flex items-center gap-3 p-3">
                <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[#F0F0F0]">
                  <img src={t.image} alt={t.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-[#1F302E] text-sm leading-[18px] line-clamp-2">
                    {t.title}
                  </h3>
                  <p className="text-xs text-[#6B7280] font-bold mt-1 line-clamp-2">{t.description}</p>
                  <div className="mt-2 flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-[#FFF4CC] border-2 border-[#FFB000] flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-black text-[#9B8000]">{initials(t.authorName)}</span>
                    </div>
                    <p className="text-[11px] font-bold text-[#6B7280] truncate">
                      by {t.authorName} · {formatRelativeDays(t.createdDaysAgo)}
                    </p>
                  </div>
                </div>
              </div>
            </DuoCard>
          ))}
        </div>
      </div>

      {/* FAB */}
      <div className="fixed bottom-20 right-4 max-w-[402px]" style={{ right: "calc(50% - 201px + 16px)" }}>
        <button
          onClick={() => navigate("/create-trip")}
          className="w-14 h-14 rounded-full bg-[#10B954] shadow-[0_4px_0_#0D9443] flex items-center justify-center active:translate-y-1 active:shadow-none transition-all"
        >
          <Plus size={28} className="text-white" strokeWidth={3} />
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
