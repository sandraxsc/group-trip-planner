import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Calendar, Users, Trash2, UserPlus } from "lucide-react";
import { DuoButton } from "../components/DuoButton";
import { getTripById, getTripMembers } from "../../services/tripService";
import type { Trip, TripMember, PreferenceStatus } from "../../types/trip";

const MEMBER_COLORS = ["#58CC02", "#1CB0F6", "#CE82FF", "#FF4B4B", "#FFD900", "#FF9F1C"];

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function StatusDot({ status }: { status: PreferenceStatus }) {
  if (status === "completed") {
    return (
      <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#58CC02] rounded-full border-2 border-white" />
    );
  }
  if (status === "in_progress") {
    return (
      <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#FFD900] rounded-full border-2 border-white" />
    );
  }
  return (
    <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-[#E5E5E5] bg-[#C3C3C3]" />
  );
}

export default function MemberProfileScreen() {
  const navigate = useNavigate();
  const { tripId, memberId } = useParams<{ tripId?: string; memberId?: string }>();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [member, setMember] = useState<TripMember | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (!tripId || !memberId) return;
    const t = getTripById(tripId);
    const members = t ? getTripMembers(t.id) : [];
    const m = members.find((mm) => mm.id === memberId) ?? null;
    setTrip(t ?? null);
    setMember(m);
  }, [tripId, memberId]);

  if (!tripId || !trip || !member) {
    return (
      <div className="flex flex-col min-h-screen bg-white items-center justify-center px-5">
        <p className="font-bold text-[#3C3C3C]">Member not found</p>
        <button
          onClick={() => (tripId ? navigate(`/trips/${tripId}`) : navigate("/"))}
          className="mt-4 text-[#1CB0F6] font-bold text-sm"
        >
          Back to trip
        </button>
      </div>
    );
  }

  const color = MEMBER_COLORS[(tripId.length + member.name.length) % MEMBER_COLORS.length];

  const joinedLabel = new Date(member.joinedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F7F7] pb-24">
      {/* Header */}
      <div className="bg-white px-4 pt-12 pb-4 border-b-2 border-[#E5E5E5] flex items-center gap-3">
        <button
          onClick={() => navigate(`/trips/${tripId}`)}
          className="w-10 h-10 rounded-xl bg-white border-2 border-[#E5E5E5] flex items-center justify-center shadow-[0_3px_0_#D4D4D4]"
        >
          <ArrowLeft size={20} className="text-[#4B4B4B]" />
        </button>
        <div className="flex flex-col">
          <span className="text-xs font-black text-[#AFAFAF] uppercase tracking-[0.3px]">
            Member profile
          </span>
          <span className="text-sm font-black text-[#3C3C3C] truncate">{member.name}</span>
        </div>
      </div>

      {/* Member card */}
      <div className="px-5 mt-5">
        <div className="bg-white rounded-2xl border-2 border-[#E5E5E5] shadow-[0_4px_0_#D4D4D4] p-5 flex flex-col items-center">
          <div className="relative mb-3">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center font-black text-2xl"
              style={{ backgroundColor: color, color: "#FFF" }}
            >
              {getInitials(member.name)}
            </div>
            <StatusDot status={member.preferenceStatus} />
          </div>
          <p className="font-black text-[#3C3C3C] text-lg mb-1">{member.name}</p>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded-full border-2 border-[#DFF6FF] bg-[#F4FBFF] text-[11px] font-black text-[#1CB0F6]">
              {member.role === "owner" ? "Trip owner" : "Travel buddy"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#AFAFAF]">
            <Calendar size={12} className="text-[#AFAFAF]" />
            <span>Joined {joinedLabel}</span>
          </div>
        </div>
      </div>

      {/* Trip contribution summary */}
      <div className="px-5 pt-5 flex flex-col gap-3">
        <div className="bg-white rounded-2xl border-2 border-[#F0F0F0] shadow-[0_3px_0_#D4D4D4] p-4">
          <p className="text-xs font-black text-[#AFAFAF] uppercase tracking-[0.4px] mb-2">
            Planning status
          </p>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-[#3C3C3C]">Set preferences</span>
            <div className="flex items-center gap-2">
              <StatusDot status={member.preferenceStatus} />
              <span className="text-xs font-bold text-[#AFAFAF]">
                {member.preferenceStatus === "completed"
                  ? "Completed"
                  : member.preferenceStatus === "in_progress"
                  ? "In progress"
                  : "Not started"}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs font-bold text-[#AFAFAF]">
            <Users size={14} className="text-[#CE82FF]" />
            <span>Trip interactions coming soon</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 pt-6 pb-4 flex flex-col gap-3 mt-auto">
        <DuoButton
          variant="primary"
          fullWidth
          className="py-3.5 text-base flex items-center justify-center gap-2"
          onClick={() => {
            setIsFollowing((prev) => !prev);
          }}
        >
          <UserPlus size={18} />
          {isFollowing ? "Following" : "Follow"}
        </DuoButton>

        <button
          type="button"
          className="flex items-center justify-center gap-2 py-3.5 bg-white rounded-2xl border-2 border-[#FF4B4B] shadow-[0_3px_0_#FFB3B3] font-bold text-[#FF4B4B] active:translate-y-0.5 active:shadow-none transition-all"
          onClick={() => {
            // Placeholder: hook up a real remove-member flow later
            console.debug("Remove from trip clicked", { tripId, memberId });
          }}
        >
          <Trash2 size={18} />
          Remove from trip
        </button>

        <p className="text-[11px] font-bold text-[#AFAFAF] text-center">
          Only trip owners can remove members from this trip.
        </p>
      </div>
    </div>
  );
}

