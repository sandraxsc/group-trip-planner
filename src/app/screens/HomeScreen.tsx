import { useNavigate } from "react-router";
import { useState, useEffect } from "react";
import { Plus, ChevronRight, Flame, MapPin, Users, Clock } from "lucide-react";
import { DuoCard } from "../components/DuoCard";
import { DuoButton } from "../components/DuoButton";
import { BottomNav } from "../components/BottomNav";
import { getTrips, getTripMembers } from "../../services/tripService";
import { getItinerary } from "../../services/itineraryService";
import type { Trip } from "../../types/trip";

const BEACH_IMG =
  "https://images.unsplash.com/photo-1771767643273-15305701890b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0cm9waWNhbCUyMGJlYWNoJTIwdmFjYXRpb24lMjBkZXN0aW5hdGlvbnxlbnwxfHx8fDE3NzI4MzA5ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080";

export default function HomeScreen() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);

  useEffect(() => {
    setTrips(getTrips());
  }, []);

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

        {trips.filter((t) => !getItinerary(t.id)).length === 0 ? (
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
          (() => {
            const ongoingTrips = trips
              .filter((t) => !getItinerary(t.id))
              .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
            const latest = ongoingTrips[0];
            if (!latest) return null;
            return (
            <DuoCard
              color="green"
              onClick={() => navigate(`/trips/${latest.id}`)}
            >
              <div className="overflow-hidden rounded-t-2xl">
                <img
                  src={BEACH_IMG}
                  alt={latest.name}
                  className="w-full h-44 object-cover"
                />
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-black text-[#3C3C3C] text-lg">{latest.name}</h3>
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin size={12} className="text-[#AFAFAF]" />
                      <span className="text-sm text-[#AFAFAF] font-bold">{latest.destination}</span>
                    </div>
                  </div>
                  <div className="bg-[#FFF4CC] px-2 py-1 rounded-xl border-2 border-[#FFD900]">
                    <span className="text-xs font-black text-[#4B4B4B]">
                      New
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1">
                    <Clock size={13} className="text-[#AFAFAF]" />
                    <span className="text-xs font-bold text-[#AFAFAF]">
                      {new Date(latest.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users size={13} className="text-[#AFAFAF]" />
                    <span className="text-xs font-bold text-[#AFAFAF]">
                      {getTripMembers(latest.id).length} members
                    </span>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-[#AFAFAF]">Planning progress</span>
                    <span className="text-xs font-black text-[#58CC02]">0%</span>
                  </div>
                  <div className="h-3 bg-[#E5E5E5] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#58CC02] to-[#89E219] rounded-full transition-all w-0" />
                  </div>
                </div>

                <div className="flex gap-2">
                  <DuoButton
                    onClick={(e) => { (e as React.MouseEvent).stopPropagation(); navigate("/preference-budget"); }}
                    variant="primary"
                    className="flex-1 text-sm py-2"
                  >
                    Set Preferences
                  </DuoButton>
                  <DuoButton
                    onClick={(e) => { (e as React.MouseEvent).stopPropagation(); navigate("/vote"); }}
                    variant="secondary"
                    className="flex-1 text-sm py-2"
                  >
                    Vote 🗳️
                  </DuoButton>
                </div>
              </div>
            </DuoCard>
            );
          })()
        )}
      </div>

      {/* Nearby weekend trips (static feed) */}
      <div className="px-5 mb-5">
        <h2 className="font-black text-[#3C3C3C] text-base uppercase tracking-wide mb-3">
          🌤️ Nearby weekend trips
        </h2>
        <div className="space-y-3">
          <DuoCard color="default">
            <div className="flex items-center gap-3 p-3">
              <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[#F0F0F0]">
                <img
                  src={BEACH_IMG}
                  alt="City break"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-[#3C3C3C] truncate">
                  City break: 2 days in a nearby town
                </h3>
                <p className="text-xs text-[#AFAFAF] font-bold mt-1">
                  Perfect for a quick weekend escape with friends.
                </p>
              </div>
            </div>
          </DuoCard>
          <DuoCard color="default">
            <div className="flex items-center gap-3 p-3">
              <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[#F0F0F0]">
                <img
                  src={BEACH_IMG}
                  alt="Nature retreat"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-[#3C3C3C] truncate">
                  Nature retreat: cabin & hiking
                </h3>
                <p className="text-xs text-[#AFAFAF] font-bold mt-1">
                  Slow mornings, fresh air, and cozy nights.
                </p>
              </div>
            </div>
          </DuoCard>
        </div>
      </div>

      {/* Popular trips (static feed) */}
      <div className="px-5 mb-12">
        <h2 className="font-black text-[#3C3C3C] text-base uppercase tracking-wide mb-3">
          ⭐ Popular trip ideas
        </h2>
        <div className="space-y-3">
          <DuoCard color="default">
            <div className="flex items-center gap-3 p-3">
              <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[#F0F0F0]">
                <img
                  src={BEACH_IMG}
                  alt="Food tour"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-[#3C3C3C] truncate">
                  Street food tour in a new city
                </h3>
                <p className="text-xs text-[#AFAFAF] font-bold mt-1">
                  Discover local favorites and hidden gems.
                </p>
              </div>
            </div>
          </DuoCard>
          <DuoCard color="default">
            <div className="flex items-center gap-3 p-3">
              <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[#F0F0F0]">
                <img
                  src={BEACH_IMG}
                  alt="Culture weekend"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-[#3C3C3C] truncate">
                  Museums & coffee: culture weekend
                </h3>
                <p className="text-xs text-[#AFAFAF] font-bold mt-1">
                  Mix galleries, cozy cafés, and evening walks.
                </p>
              </div>
            </div>
          </DuoCard>
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
