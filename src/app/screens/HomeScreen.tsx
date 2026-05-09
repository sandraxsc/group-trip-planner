import { useNavigate } from "react-router";
import { useState, useEffect, useMemo } from "react";
import { Plus, ChevronRight, Flame, MapPin, Users, Clock } from "lucide-react";
import { DuoCard } from "../components/DuoCard";
import { BottomNav } from "../components/BottomNav";
import { getTrips, getTripMembers } from "../../services/tripService";
import { getItinerary } from "../../services/itineraryService";
import { hydrateTripFromCloud } from "../../services/cloudHydrateService";
import { warmApiProxyOncePerSession } from "../../utils/warmApiProxy";
import { getTripPlanningProgressPercent } from "../../utils/tripPlanningProgress";
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
  /** Bumps after cloud hydrate so member preferenceStatus matches trip detail. */
  const [ongoingSyncRev, setOngoingSyncRev] = useState(0);

  useEffect(() => {
    setTrips(getTrips());
  }, []);

  useEffect(() => {
    warmApiProxyOncePerSession();
  }, []);

  const latestOngoingTrip = useMemo(() => {
    const ongoing = trips
      .filter((t) => !getItinerary(t.id))
      .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
    return ongoing[0] ?? null;
  }, [trips]);

  useEffect(() => {
    const id = latestOngoingTrip?.id;
    if (!id) return;
    let cancelled = false;
    const sync = async () => {
      await hydrateTripFromCloud(id);
      if (!cancelled) setOngoingSyncRev((n) => n + 1);
    };
    void sync();
    const interval = setInterval(() => {
      void sync();
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
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
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#58CC02] to-[#46A302] flex items-center justify-center shadow-[0_3px_0_#2d7800]">
              <span className="text-white font-bold text-sm">SN</span>
            </div>
            <div>
              <p className="text-xs text-[#AFAFAF] font-bold uppercase tracking-wider">Welcome back!</p>
              <p className="text-[#3C3C3C] font-black text-lg">Sandra 👋</p>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-[#FFF4CC] px-3 py-1.5 rounded-full border-2 border-[#FFD900]">
            <Flame size={16} className="text-[#FF6B00]" fill="#FF6B00" />
            <span className="text-[#4B4B4B] font-black text-sm">12</span>
          </div>
        </div>
      </div>

      {/* XP Progress Bar */}
      <div className="px-5 mb-6">
        <div className="bg-[#F7F7F7] rounded-2xl p-4 border-2 border-[#E5E5E5]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-[#AFAFAF] uppercase tracking-wide">Trip Explorer</span>
            <span className="text-xs font-black text-[#58CC02]">350 XP</span>
          </div>
          <div className="h-3 bg-[#E5E5E5] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#58CC02] to-[#89E219] rounded-full w-[65%] transition-all" />
          </div>
        </div>
      </div>

      {/* On-going planning */}
      <div className="px-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-black text-[#3C3C3C] text-base uppercase tracking-wide">
            🗺️ On-going trips
          </h2>
          <button className="text-[#1CB0F6] font-bold text-sm">See all</button>
        </div>

        {!latestOngoingTrip ? (
          trips.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-[#E5E5E5] border-dashed p-8 text-center">
              <p className="text-[#AFAFAF] font-bold text-sm">No trips yet. Create one to get started!</p>
              <button
                onClick={() => navigate("/create-trip")}
                className="mt-3 text-[#1CB0F6] font-bold text-sm"
              >
                Create your first trip
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border-2 border-[#E5E5E5] border-dashed p-8 text-center">
              <p className="text-[#AFAFAF] font-bold text-sm">No trips in active planning right now.</p>
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
                  <h3 className="font-black text-[#3C3C3C] text-lg">{latestOngoingTrip.name}</h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin size={12} className="text-[#AFAFAF]" />
                    <span className="text-sm text-[#AFAFAF] font-bold">{latestOngoingTrip.destination}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1">
                    <Clock size={13} className="text-[#AFAFAF]" />
                    <span className="text-xs font-bold text-[#AFAFAF]">
                      {new Date(latestOngoingTrip.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users size={13} className="text-[#AFAFAF]" />
                    <span className="text-xs font-bold text-[#AFAFAF]">
                      {getTripMembers(latestOngoingTrip.id).length} members
                    </span>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-[#AFAFAF]">Planning progress</span>
                    <span className="text-xs font-black text-[#58CC02]">{ongoingPlanningProgressPct}%</span>
                  </div>
                  <div className="h-3 bg-[#E5E5E5] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#58CC02] to-[#89E219] rounded-full transition-all duration-300"
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
          <h2 className="font-black text-[#3C3C3C] text-base uppercase tracking-wide">
            🌤️ Nearby weekend trips
          </h2>
          <button
            type="button"
            onClick={() => setShowAllNearby((v) => !v)}
            className="text-[#1CB0F6] font-bold text-sm flex items-center gap-1"
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
              className="flex-shrink-0 min-w-[180px] max-w-[180px]"
              style={{ scrollSnapAlign: "start" }}
            >
              <DuoCard color="default" className="h-full">
                <div className="flex items-start gap-3 p-3">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-[#F0F0F0]">
                    <img src={t.image} alt={t.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-[#3C3C3C] text-sm leading-[18px] line-clamp-2">
                      {t.title}
                    </h3>
                    <p className="text-xs text-[#AFAFAF] font-bold mt-1 line-clamp-2">
                      {t.description}
                    </p>
                    <div className="mt-2 flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded-full bg-[#F0FDE4] border-2 border-[#58CC02] flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-black text-[#2D7800]">
                          {initials(t.authorName)}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-[#AFAFAF] truncate">
                        {formatRelativeDays(t.createdDaysAgo)}
                      </p>
                    </div>
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
          <h2 className="font-black text-[#3C3C3C] text-base uppercase tracking-wide">
            ⭐ Popular trip ideas
          </h2>
          <button
            type="button"
            onClick={() => setShowAllPopular((v) => !v)}
            className="text-[#1CB0F6] font-bold text-sm flex items-center gap-1"
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
                  <h3 className="font-black text-[#3C3C3C] text-sm leading-[18px] line-clamp-2">
                    {t.title}
                  </h3>
                  <p className="text-xs text-[#AFAFAF] font-bold mt-1 line-clamp-2">{t.description}</p>
                  <div className="mt-2 flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-[#FFF4CC] border-2 border-[#FFD900] flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-black text-[#9B8000]">{initials(t.authorName)}</span>
                    </div>
                    <p className="text-[11px] font-bold text-[#AFAFAF] truncate">
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
          className="w-14 h-14 rounded-full bg-[#58CC02] shadow-[0_4px_0_#46A302] flex items-center justify-center active:translate-y-1 active:shadow-none transition-all"
        >
          <Plus size={28} className="text-white" strokeWidth={3} />
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
