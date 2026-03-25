import { useNavigate, useParams, useLocation } from "react-router";
import { CheckCircle2 } from "lucide-react";
import { DuoButton } from "../components/DuoButton";
import { getInviteByToken, getTripById } from "../../services/tripService";

export default function JoinSuccessScreen() {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const location = useLocation();
  const state = (location.state as { memberName?: string } | null) ?? null;

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

  const invite = getInviteByToken(token);
  const trip = invite ? getTripById(invite.tripId) : null;

  if (!invite || !trip) {
    return (
      <div className="flex flex-col min-h-screen bg-white items-center justify-center px-5">
        <p className="font-bold text-[#3C3C3C] mb-3">This invite is no longer valid.</p>
        <DuoButton onClick={() => navigate("/")} variant="primary">
          Back to Home
        </DuoButton>
      </div>
    );
  }

  const handleGoToTrip = () => {
    navigate(`/trips/${trip.id}`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-[#F7FFF0] to-[#FFF8E7] items-center justify-center px-5">
      <div className="mb-8">
        <div className="w-32 h-32 rounded-full bg-white border-4 border-[#58CC02] shadow-[0_6px_0_#46A302] flex items-center justify-center">
          <CheckCircle2 size={72} className="text-[#58CC02]" />
        </div>
      </div>

      <div className="text-center mb-8">
        <h1 className="font-black text-[#3C3C3C] text-2xl mb-2">
          You&apos;re in!
        </h1>
        <p className="text-[#58CC02] font-black text-lg mb-2">
          {trip.name}
        </p>
        <p className="text-[#777] font-bold text-sm">
          {state?.memberName
            ? `${state.memberName}, you joined the trip successfully.`
            : "You joined the trip successfully."}
        </p>
        <p className="text-[#AFAFAF] font-bold text-xs mt-2">
          You can set your travel preferences with the group later.
        </p>
      </div>

      <div className="w-full max-w-sm">
        <DuoButton
          onClick={handleGoToTrip}
          variant="primary"
          fullWidth
          className="py-4 text-base"
        >
          🗺️ Go to Trip
        </DuoButton>
      </div>
    </div>
  );
}

