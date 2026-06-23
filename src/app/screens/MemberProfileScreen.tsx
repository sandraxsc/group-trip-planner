import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Calendar, MapPin } from "lucide-react";
import { DuoButton } from "../components/DuoButton";
import { DuoAvatar } from "../components/DuoAvatar";
import type { DuoAvatarColorKey } from "../components/DuoAvatar";
import { duoUi } from "../constants/duoUi";
import { getTripById, getTripMembers } from "../../services/tripService";
import { getMemberPreference } from "../../services/preferenceService";
import { formatPreferenceSummaryRows } from "../utils/memberPreferenceDisplay";
import type { Trip, TripMember } from "../../types/trip";
import type { MemberPreference } from "../../types/preference";

const MEMBER_COLOR_KEYS: DuoAvatarColorKey[] = ["green", "blue", "coral", "amber"];

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function memberColorKeyFor(index: number): DuoAvatarColorKey {
  return MEMBER_COLOR_KEYS[index % MEMBER_COLOR_KEYS.length] ?? "green";
}

function PrefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2.5 border-b border-[#F0F0F0] last:border-0">
      <p className="text-sm font-bold text-[#AFAFAF] mb-0.5">{label}</p>
      <p className="text-sm font-black text-[#3C3C3C] leading-snug line-clamp-3 break-words">
        {value}
      </p>
    </div>
  );
}

function PrefPlacesLink({
  count,
  onSeeAll,
}: {
  count: number;
  onSeeAll: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-[#F0F0F0] last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-bold text-[#AFAFAF]">Must-see places</p>
        <p className="text-sm font-black text-[#3C3C3C] mt-0.5">
          {count} place{count === 1 ? "" : "s"} saved
        </p>
      </div>
      <button
        type="button"
        onClick={onSeeAll}
        className="text-sm font-black text-[#1CB0F6] shrink-0 whitespace-nowrap"
      >
        See all
      </button>
    </div>
  );
}

export default function MemberProfileScreen() {
  const navigate = useNavigate();
  const { tripId, memberId } = useParams<{ tripId?: string; memberId?: string }>();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [member, setMember] = useState<TripMember | null>(null);
  const [memberIndex, setMemberIndex] = useState(0);
  const [pref, setPref] = useState<MemberPreference | null>(null);

  const sessionMemberId =
    typeof window !== "undefined" ? sessionStorage.getItem("currentMemberId") : null;
  const isSelf = Boolean(memberId && sessionMemberId && memberId === sessionMemberId);

  useEffect(() => {
    if (!tripId || !memberId) return;
    const t = getTripById(tripId);
    const members = t ? getTripMembers(t.id) : [];
    const idx = members.findIndex((mm) => mm.id === memberId);
    const m = idx >= 0 ? members[idx]! : null;
    setTrip(t ?? null);
    setMember(m);
    setMemberIndex(idx >= 0 ? idx : 0);
    setPref(getMemberPreference(tripId, memberId));
  }, [tripId, memberId]);

  const preferenceRows = useMemo(() => formatPreferenceSummaryRows(pref), [pref]);
  const placeCount = pref?.selectedPlaces?.length ?? 0;
  const preferencesPath =
    tripId && memberId ? `/trips/${tripId}/members/${memberId}/preferences` : null;

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

  const joinedLabel = new Date(member.joinedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const handleEditPreferences = () => {
    if (!tripId || !memberId) return;
    if (typeof window !== "undefined") {
      sessionStorage.setItem("currentTripId", tripId);
      sessionStorage.setItem("currentMemberId", memberId);
    }
    navigate("/preference-budget", { state: { tripId, memberId } });
  };

  return (
    <div className={`flex flex-col min-h-screen ${duoUi.pageBgDefault} pb-8`}>
      <div className="bg-white px-4 pt-12 pb-4 border-b-2 border-[#E5E5E5] flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(`/trips/${tripId}`)}
          className="w-10 h-10 rounded-xl bg-white border-2 border-[#E5E5E5] flex items-center justify-center shadow-[0_3px_0_#D4D4D4] active:translate-y-0.5 active:shadow-none transition-all"
          aria-label="Back to trip"
        >
          <ArrowLeft size={20} className="text-[#4B4B4B]" />
        </button>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-black text-[#AFAFAF] uppercase tracking-[0.3px]">
            {isSelf ? "Your profile" : "Member profile"}
          </span>
          <span className="text-sm font-black text-[#3C3C3C] truncate">{member.name}</span>
        </div>
      </div>

      <div className={`${duoUi.sectionX} mt-5 flex flex-col gap-4`}>
        <div className={`${duoUi.card} p-5 flex flex-col items-center`}>
          <DuoAvatar
            initials={getInitials(member.name)}
            colorKey={memberColorKeyFor(memberIndex)}
            size="md"
            status={
              member.preferenceStatus === "completed"
                ? "complete"
                : member.preferenceStatus === "in_progress"
                  ? "in_progress"
                  : "not_started"
            }
          />
          <p className="font-black text-[#3C3C3C] text-lg mt-3 mb-1">{member.name}</p>
          <span className="px-2 py-0.5 rounded-full border-2 border-[#DFF6FF] bg-[#F4FBFF] text-[11px] font-black text-[#1CB0F6] mb-2">
            {member.role === "owner" ? "Trip owner" : "Travel buddy"}
          </span>
          <div className="flex items-center gap-2 text-xs font-bold text-[#AFAFAF]">
            <Calendar size={12} />
            <span>Joined {joinedLabel}</span>
          </div>
        </div>

        <div className={`${duoUi.card} p-4`}>
          <p className="text-xs font-black text-[#AFAFAF] uppercase tracking-[0.4px] mb-3">
            Travel preferences
          </p>
          {member.preferenceStatus !== "completed" &&
          preferenceRows.length === 0 &&
          placeCount === 0 ? (
            <p className="text-sm font-bold text-[#AFAFAF]">
              {isSelf
                ? "You haven't finished sharing preferences yet."
                : `${member.name} hasn't finished sharing preferences yet.`}
            </p>
          ) : preferenceRows.length === 0 && placeCount === 0 ? (
            <p className="text-sm font-bold text-[#AFAFAF]">No preference details saved yet.</p>
          ) : (
            <div>
              {preferenceRows.map((row) => (
                <PrefRow key={row.label} label={row.label} value={row.value} />
              ))}
              {placeCount > 0 && preferencesPath && (
                <PrefPlacesLink
                  count={placeCount}
                  onSeeAll={() => navigate(preferencesPath)}
                />
              )}
            </div>
          )}
          {!isSelf && (
            <p className="text-[11px] font-bold text-[#AFAFAF] mt-3 flex items-center gap-1">
              <MapPin size={12} className="shrink-0" />
              View only — only {member.name} can edit their preferences.
            </p>
          )}
        </div>

        {isSelf && (
          <DuoButton fullWidth onClick={handleEditPreferences}>
            Edit my preferences
          </DuoButton>
        )}
      </div>
    </div>
  );
}
