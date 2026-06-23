import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
import { CheckCircle2 } from "lucide-react";
import { DuoButton } from "../components/DuoButton";
import { duoUi } from "../constants/duoUi";
import { resolveInviteBundleByToken } from "../../services/tripService";

export default function JoinSuccessScreen() {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const location = useLocation();
  const state = (location.state as { memberName?: string } | null) ?? null;
  const [loading, setLoading] = useState(true);
  const [tripState, setTripState] = useState<{ id: string; name: string } | null>(null);

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
      const { invite, trip } = await resolveInviteBundleByToken(token);
      if (!alive) return;
      if (!invite || !trip) {
        setTripState(null);
        setLoading(false);
        return;
      }
      setTripState({ id: trip.id, name: trip.name });
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-white items-center justify-center px-5">
        <p className="font-bold text-[#3C3C3C] mb-3">Loading…</p>
      </div>
    );
  }

  if (!tripState) {
    return (
      <div className="flex flex-col min-h-screen bg-white items-center justify-center px-5">
        <p className="font-bold text-[#3C3C3C] mb-3">This invite is no longer valid.</p>
        <DuoButton onClick={() => navigate("/")} variant="primary">
          Back to Home
        </DuoButton>
      </div>
    );
  }

  const handleContinueToPreferences = () => {
    const tripId = tripState.id;
    const memberId =
      typeof window !== "undefined" ? sessionStorage.getItem("currentMemberId") : null;
    if (typeof window !== "undefined") {
      sessionStorage.setItem("currentTripId", tripId);
    }
    navigate("/preference-budget", {
      state: memberId ? { tripId, memberId } : { tripId },
    });
  };

  return (
    <div className={`flex flex-col min-h-screen ${duoUi.pageBgSuccess} items-center justify-center px-5`}>
      <div className="mb-8 relative">
        <div className="w-32 h-32 rounded-full bg-white border-4 border-[#58CC02] shadow-[0_6px_0_#46A302] flex items-center justify-center">
          <CheckCircle2 size={72} className="text-[#58CC02]" />
        </div>
        <div className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-[#FFD900] shadow-[0_3px_0_#E5C400]" />
        <div className="absolute -bottom-2 -left-4 w-5 h-5 rounded-full bg-[#1CB0F6] shadow-[0_3px_0_#0B8FCC]" />
      </div>

      <div className="text-center mb-8 max-w-[402px]">
        <h1 className="font-black text-[#3C3C3C] text-2xl mb-2">
          You&apos;re in!
        </h1>
        <p className="text-[#58CC02] font-black text-lg mb-2">
          {tripState.name}
        </p>
        <p className="text-[#777] font-bold text-sm">
          {state?.memberName
            ? `${state.memberName}, you joined the trip successfully.`
            : "You joined the trip successfully."}
        </p>
        <p className="text-[#AFAFAF] font-bold text-xs mt-2">
          Set your travel preferences so the group can plan together.
        </p>
      </div>

      <div className={duoUi.contentWidth}>
        <DuoButton
          onClick={handleContinueToPreferences}
          variant="primary"
          fullWidth
          className="py-4 text-base"
        >
          Set My Preferences
        </DuoButton>
      </div>
    </div>
  );
}

