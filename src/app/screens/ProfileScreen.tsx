import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { MapPin, Users, Settings, Share2, Star, Heart } from "lucide-react";
import { BottomNav } from "../components/BottomNav";
import { DuoButton } from "../components/DuoButton";
import { getTrips, getTripMembers } from "../../services/tripService";
import { getMemberPreferencesByTripId } from "../../services/preferenceService";
import { getUserName, getInitialsFromName } from "../../services/userProfileService";
import type { Trip } from "../../types/trip";

export default function ProfileScreen() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);

  useEffect(() => {
    setTrips(getTrips());
  }, []);

  const username = getUserName("Traveler");
  const initials = getInitialsFromName(username);
  const age = 28; // placeholder
  const gender = "She / Her"; // placeholder

  const totalFollowers = 12; // placeholder
  const createdTrips = trips.length;

  // Count saved preference flows across all trips
  let savedPreferencesCount = 0;
  trips.forEach((trip) => {
    const members = getTripMembers(trip.id);
    members.forEach((member) => {
      const pref = getMemberPreferencesByTripId(trip.id).find(
        (p) => p.memberId === member.id
      );
      if (pref) savedPreferencesCount += 1;
    });
  });

  return (
    <div className="flex flex-col min-h-screen bg-white pb-24">
      {/* Avatar + basic info */}
      <div className="px-5 pt-12">
        <div className="bg-white rounded-2xl border-2 border-[#E5E5E5] shadow-[0_4px_0_#D4D4D4] p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#58CC02] to-[#46A302] flex items-center justify-center shadow-[0_4px_0_#2D7800]">
            <span className="text-white font-black text-lg">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-[#3C3C3C] text-lg truncate">
              {username}
            </p>
            <p className="text-xs font-bold text-[#AFAFAF]">
              {age} • {gender}
            </p>
          </div>
          <button
            type="button"
            className="w-9 h-9 rounded-xl bg-[#F7F7F7] border-2 border-[#E5E5E5] flex items-center justify-center"
          >
            <Settings size={18} className="text-[#AFAFAF]" />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-5 mt-4">
        <div className="bg-white rounded-2xl border-2 border-[#F0F0F0] shadow-[0_3px_0_#D4D4D4] p-4 flex justify-around">
          <div className="text-center">
            <div className="font-black text-[#3C3C3C] text-xl">
              {totalFollowers}
            </div>
            <div className="text-[11px] font-bold text-[#AFAFAF]">
              Followers
            </div>
          </div>
          <div className="w-px bg-[#E5E5E5]" />
          <div className="text-center">
            <div className="font-black text-[#3C3C3C] text-xl">
              {createdTrips}
            </div>
            <div className="text-[11px] font-bold text-[#AFAFAF]">
              Trips
            </div>
          </div>
          <div className="w-px bg-[#E5E5E5]" />
          <div className="text-center">
            <div className="font-black text-[#3C3C3C] text-xl">
              {savedPreferencesCount}
            </div>
            <div className="text-[11px] font-bold text-[#AFAFAF]">
              Saved prefs
            </div>
          </div>
        </div>
      </div>

      {/* Recent activity / created trips card */}
      <div className="px-5 mt-4 flex-1">
        <div className="bg-white rounded-2xl border-2 border-[#E5E5E5] shadow-[0_3px_0_#D4D4D4] p-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={16} className="text-[#1CB0F6]" />
            <h2 className="font-black text-[#3C3C3C] text-sm uppercase tracking-[0.4px]">
              Created trips
            </h2>
          </div>
          {trips.length === 0 && (
            <p className="text-xs font-bold text-[#AFAFAF]">
              You haven’t created any trips yet. Start one from the Home tab!
            </p>
          )}
          {trips.slice(0, 3).map((trip) => {
            const members = getTripMembers(trip.id);
            return (
              <button
                key={trip.id}
                type="button"
                onClick={() => navigate(`/trips/${trip.id}`)}
                className="w-full mt-2 bg-[#F7F7F7] rounded-2xl border-2 border-[#E5E5E5] px-4 py-3 flex items-center justify-between active:translate-y-0.5 active:shadow-none transition-all"
              >
                <div className="flex flex-col text-left">
                  <span className="text-sm font-black text-[#3C3C3C] truncate">
                    {trip.name}
                  </span>
                  <span className="text-[11px] font-bold text-[#AFAFAF] flex items-center gap-1">
                    <Users size={12} className="text-[#AFAFAF]" />
                    {members.length} travelers
                  </span>
                </div>
                <span className="text-xs font-bold text-[#AFAFAF]">
                  {new Date(trip.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="px-5 pt-4 pb-4 flex flex-col gap-3">
        <DuoButton
          variant="primary"
          fullWidth
          className="py-3.5 text-base flex items-center justify-center gap-2"
          onClick={() => {
            // placeholder: later use navigator.share or copy profile link
            console.debug("Share profile clicked");
          }}
        >
          <Share2 size={18} />
          Share profile
        </DuoButton>

        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-white border-2 border-[#E5E5E5] shadow-[0_3px_0_#D4D4D4] text-[#3C3C3C] font-bold text-sm active:translate-y-0.5 active:shadow-none transition-all"
        >
          <span className="flex items-center gap-2">
            <Star size={18} className="text-[#FFD900]" />
            Edit profile details
          </span>
        </button>

        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-white border-2 border-[#E5E5E5] shadow-[0_3px_0_#D4D4D4] text-[#3C3C3C] font-bold text-sm active:translate-y-0.5 active:shadow-none transition-all"
        >
          <span className="flex items-center gap-2">
            <Heart size={18} className="text-[#FF4B4B]" />
            Feedback
          </span>
        </button>

        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-white border-2 border-[#FF4B4B] shadow-[0_3px_0_#FFB3B3] text-[#FF4B4B] font-bold text-sm active:translate-y-0.5 active:shadow-none transition-all"
        >
          <span>Log out</span>
        </button>
      </div>

      <BottomNav />
    </div>
  );
}

