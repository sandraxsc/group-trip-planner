import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Users, MapPin } from "lucide-react";
import { DuoButton } from "../components/DuoButton";
import {
  addTripMember,
  resolveInviteBundleByToken,
} from "../../services/tripService";
import {
  hasCompletedOnboarding,
  setUserProfile,
} from "../../services/userProfileService";

export default function JoinTripScreen() {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [inviteState, setInviteState] = useState<{
    inviteTripId: string;
    token: string;
    tripName: string;
    destination: string;
    memberCount: number;
  } | null>(null);

  if (!token) {
    return (
      <div className="flex flex-col min-h-screen bg-white items-center justify-center px-5">
        <p className="font-bold text-[#3C3C3C] mb-3">Invalid invite link</p>
        <DuoButton onClick={() => navigate("/")} variant="primary">
          Back to Home
        </DuoButton>
      </div>
    );
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void (async () => {
      const { invite, trip, members } = await resolveInviteBundleByToken(token);
      if (!alive) return;
      if (!invite || !trip) {
        setInviteState(null);
        setLoading(false);
        return;
      }
      setInviteState({
        inviteTripId: trip.id,
        token: invite.token,
        tripName: trip.name,
        destination: trip.destination,
        memberCount: members.length,
      });
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-white items-center justify-center px-5">
        <p className="font-bold text-[#3C3C3C] mb-3">Loading invite…</p>
      </div>
    );
  }

  if (!inviteState) {
    return (
      <div className="flex flex-col min-h-screen bg-white items-center justify-center px-5">
        <p className="font-bold text-[#3C3C3C] mb-3">This invite is no longer valid.</p>
        <DuoButton onClick={() => navigate("/")} variant="primary">
          Back to Home
        </DuoButton>
      </div>
    );
  }

  const handleBack = () => navigate("/");

  const handleJoin = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newMember = addTripMember(inviteState.inviteTripId, trimmed);
    // Persist the typed name as this device's user profile so the onboarding
    // gate in Root.tsx doesn't bounce the user to /onboarding after they
    // click "Go to Trip" on the success screen — they already gave us a
    // name here, asking again would be redundant.
    //
    // Only set when no profile exists yet: a returning user with an existing
    // global name shouldn't have it silently overwritten by whatever display
    // name they chose for this particular trip.
    if (!hasCompletedOnboarding()) {
      setUserProfile(trimmed);
    }
    sessionStorage.setItem("currentTripId", inviteState.inviteTripId);
    sessionStorage.setItem("currentMemberId", newMember.id);
    navigate(`/join/${token}/success`, { state: { memberName: trimmed } });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-[#FFF8F0] to-[#F0FFF4]">
      {/* Header */}
      <div className="flex items-center px-4 pt-12 pb-4 gap-3">
        <button
          onClick={handleBack}
          className="w-10 h-10 rounded-xl bg-white border-2 border-[#E5E5E5] flex items-center justify-center shadow-[0_3px_0_#D4D4D4] active:translate-y-0.5 active:shadow-none transition-all"
        >
          <ArrowLeft size={20} className="text-[#4B4B4B]" />
        </button>
        <h1 className="font-black text-[#3C3C3C] text-xl flex-1 text-center pr-10">
          Join the Adventure ✨
        </h1>
      </div>

      <div className="px-5 flex flex-col flex-1 pb-8">
        {/* Trip summary card */}
        <div className="mb-6">
          <div className="bg-white rounded-2xl border-2 border-[#E5E5E5] shadow-[0_4px_0_#D4D4D4] p-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#FFF8E7] flex items-center justify-center border-2 border-[#FFD900]">
              <Users size={28} className="text-[#FFB800]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#AFAFAF] mb-0.5">
                You&apos;re joining
              </p>
              <h2 className="font-black text-[#3C3C3C] text-lg truncate mb-1">
                {inviteState.tripName}
              </h2>
              <div className="flex items-center gap-2 text-xs font-bold text-[#AFAFAF]">
                <div className="flex items-center gap-1">
                  <MapPin size={12} className="text-[#AFAFAF]" />
                  <span className="truncate">{inviteState.destination}</span>
                </div>
                {inviteState.memberCount > 0 && (
                  <span>
                    · {inviteState.memberCount} traveler{inviteState.memberCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Welcome text */}
        <div className="mb-6 text-center">
          <h2 className="font-black text-[#3C3C3C] text-2xl mb-2">
            Join the trip!
          </h2>
          <p className="text-[#AFAFAF] font-bold text-sm">
            Enter your name so your friends know who&apos;s joining.
          </p>
        </div>

        {/* Name input */}
        <div className="mb-4">
          <label className="block text-xs font-black text-[#AFAFAF] uppercase tracking-wide mb-2 text-left">
            Your display name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex, Sam, Jamie"
            className="w-full px-4 py-3.5 rounded-2xl border-2 border-[#E5E5E5] bg-white shadow-[0_3px_0_#D4D4D4] text-base font-bold text-[#3C3C3C] placeholder:text-[#AFAFAF] focus:outline-none focus:ring-2 focus:ring-[#1CB0F6]"
          />
        </div>

        <div className="bg-[#F4ECFF] rounded-2xl p-3 border-2 border-[#CE82FF] mb-8 text-xs font-bold text-[#7A4B9A] text-left">
          You&apos;ll be able to set your travel preferences after you join.
        </div>

        {/* Actions */}
        <div className="mt-auto space-y-3">
          <DuoButton
            onClick={handleJoin}
            variant="primary"
            fullWidth
            className="py-4 text-base"
            disabled={!name.trim()}
          >
            Join Trip
          </DuoButton>
          <button
            onClick={handleBack}
            className="w-full text-center text-[#AFAFAF] font-bold text-sm py-2"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

