import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { duoUi } from "../constants/duoUi";
import { getTripById, getTripMembers } from "../../services/tripService";
import { getMemberPreference } from "../../services/preferenceService";
import { fetchPlaceDetails } from "../../services/placeService";
import { isLikelyGooglePlaceId } from "../utils/memberPreferenceDisplay";
import type { Trip, TripMember } from "../../types/trip";
import type { MemberPreference } from "../../types/preference";

const DEFAULT_PLACE_IMAGE =
  "https://images.unsplash.com/photo-1516426122078-c23e76319801?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";

type ResolvedPlace = {
  token: string;
  name: string;
  address?: string;
  imageUrl?: string | null;
};

export default function MemberPreferenceViewScreen() {
  const navigate = useNavigate();
  const { tripId, memberId } = useParams<{ tripId?: string; memberId?: string }>();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [member, setMember] = useState<TripMember | null>(null);
  const [pref, setPref] = useState<MemberPreference | null>(null);
  const [resolvedPlaces, setResolvedPlaces] = useState<ResolvedPlace[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);

  const sessionMemberId =
    typeof window !== "undefined" ? sessionStorage.getItem("currentMemberId") : null;
  const isSelf = Boolean(memberId && sessionMemberId && memberId === sessionMemberId);

  useEffect(() => {
    if (!tripId || !memberId) return;
    const t = getTripById(tripId);
    const members = t ? getTripMembers(t.id) : [];
    const m = members.find((mm) => mm.id === memberId) ?? null;
    setTrip(t ?? null);
    setMember(m);
    setPref(getMemberPreference(tripId, memberId));
  }, [tripId, memberId]);

  const placeTokens = pref?.selectedPlaces ?? [];

  useEffect(() => {
    if (placeTokens.length === 0) {
      setResolvedPlaces([]);
      setPlacesLoading(false);
      return;
    }

    let cancelled = false;
    setPlacesLoading(true);

    void (async () => {
      const results: ResolvedPlace[] = [];
      for (const token of placeTokens) {
        if (cancelled) return;
        const trimmed = token.trim();
        if (!trimmed) continue;

        if (isLikelyGooglePlaceId(trimmed)) {
          const details = await fetchPlaceDetails(trimmed);
          results.push({
            token: trimmed,
            name: details?.name?.trim() || "Saved place",
            address: details?.formattedAddress,
            imageUrl: details?.imageUrl ?? DEFAULT_PLACE_IMAGE,
          });
        } else {
          results.push({
            token: trimmed,
            name: trimmed,
            imageUrl: DEFAULT_PLACE_IMAGE,
          });
        }
      }

      if (!cancelled) {
        setResolvedPlaces(results);
        setPlacesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pref?.selectedPlaces]);

  if (!tripId || !trip || !member) {
    return (
      <div className="flex flex-col min-h-screen bg-white items-center justify-center px-5">
        <p className="font-bold text-[#1F302E]">Member not found</p>
        <button
          type="button"
          onClick={() => (tripId ? navigate(`/trips/${tripId}`) : navigate("/"))}
          className="mt-4 text-[#1CB0F6] font-bold text-sm"
        >
          Back to trip
        </button>
      </div>
    );
  }

  const profilePath = `/trips/${tripId}/members/${memberId}`;

  return (
    <div className={`flex flex-col min-h-screen ${duoUi.pageBgDefault} pb-8`}>
      <div className="bg-white px-4 pt-12 pb-4 border-b-2 border-[#E8E8E8] flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(profilePath)}
          className="w-10 h-10 rounded-xl bg-white border-2 border-[#E8E8E8] flex items-center justify-center shadow-[0_3px_0_#C4C4C4] active:translate-y-0.5 active:shadow-none transition-all"
          aria-label="Back to member profile"
        >
          <ArrowLeft size={20} className="text-[#6B7280]" />
        </button>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-black text-[#6B7280] uppercase tracking-[0.3px]">
            {isSelf ? "Your preferences" : `${member.name}'s preferences`}
          </span>
          <span className="text-sm font-black text-[#1F302E] truncate">Must-see places & more</span>
        </div>
      </div>

      <div className={`${duoUi.sectionX} mt-5 flex flex-col gap-4`}>
        {!isSelf && (
          <div className={`${duoUi.alertAmber} text-xs font-bold text-[#6B5A00]`}>
            View only — only {member.name} can change these preferences.
          </div>
        )}

        <div className={`${duoUi.card} p-4`}>
          <p className="text-xs font-black text-[#6B7280] uppercase tracking-[0.4px] mb-3">
            Must-see places
          </p>

          {placeTokens.length === 0 ? (
            <p className="text-sm font-bold text-[#6B7280]">No places saved yet.</p>
          ) : placesLoading ? (
            <p className="text-sm font-bold text-[#6B7280]">Loading place names…</p>
          ) : (
            <div className="flex flex-col gap-2">
              {resolvedPlaces.map((place) => (
                <div
                  key={place.token}
                  className="flex items-center gap-3 rounded-xl border-2 border-[#E8E8E8] bg-[#F7F7F6] p-2.5"
                >
                  <img
                    src={place.imageUrl ?? DEFAULT_PLACE_IMAGE}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover border border-[#E8E8E8] shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-[#1F302E] text-sm leading-snug truncate">
                      {place.name}
                    </p>
                    {place.address && (
                      <p className="text-xs font-bold text-[#6B7280] mt-0.5 line-clamp-2">
                        {place.address}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        <button
          type="button"
          onClick={() => navigate(profilePath)}
          className="text-sm font-black text-[#1CB0F6] text-center py-2"
        >
          ← Back to {isSelf ? "your" : `${member.name}'s`} profile
        </button>
      </div>
    </div>
  );
}
