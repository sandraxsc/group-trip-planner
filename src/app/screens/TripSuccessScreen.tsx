import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { DuoButton } from "../components/DuoButton";
import { PartyPopper } from "lucide-react";

export default function TripSuccessScreen() {
  const navigate = useNavigate();
  const { tripId } = useParams<{ tripId: string }>();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!tripId) navigate("/", { replace: true });
  }, [tripId, navigate]);

  useEffect(() => {
    if (countdown === 0 && tripId) {
      navigate(`/trips/${tripId}/invite`);
    }
  }, [countdown, navigate, tripId]);

  const handleNext = () => {
    if (tripId) navigate(`/trips/${tripId}/invite`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-[#F7FFF0] to-[#FFF8E7] items-center justify-center px-5">
      {/* Success Illustration */}
      <div className="mb-8 relative">
        <div className="w-40 h-40 bg-white rounded-3xl border-4 border-[#58CC02] shadow-[0_8px_0_#46A302] flex items-center justify-center">
          <PartyPopper size={80} className="text-[#58CC02]" strokeWidth={1.5} />
        </div>
        {/* Confetti dots */}
        <div className="absolute -top-4 -left-4 w-6 h-6 rounded-full bg-[#FFD900] shadow-[0_3px_0_#E5C400]" />
        <div className="absolute -top-2 -right-6 w-8 h-8 rounded-full bg-[#1CB0F6] shadow-[0_4px_0_#0B8FCC]" />
        <div className="absolute -bottom-3 -left-6 w-7 h-7 rounded-full bg-[#CE82FF] shadow-[0_3px_0_#A760D8]" />
        <div className="absolute -bottom-4 -right-4 w-5 h-5 rounded-full bg-[#FF4B4B] shadow-[0_3px_0_#CC3B3B]" />
      </div>

      {/* Success Message */}
      <div className="text-center mb-10">
        <h1 className="font-black text-[#3C3C3C] text-2xl mb-3">
          You Successfully
        </h1>
        <h1 className="font-black text-[#58CC02] text-2xl mb-2">
          Created a Trip! 🎉
        </h1>
        <p className="text-[#777] font-bold text-sm">
          Let's invite your travel buddies!
        </p>
      </div>

      {/* Next Button with Countdown */}
      <div className="w-full max-w-sm">
        <DuoButton
          onClick={handleNext}
          variant="primary"
          fullWidth
          className="py-4 text-base"
          disabled={!tripId}
        >
          NEXT ({countdown}s)
        </DuoButton>
      </div>

      {/* Auto-redirect message */}
      <p className="mt-6 text-xs text-[#AFAFAF] font-bold text-center">
        Automatically redirecting in {countdown} seconds...
      </p>
    </div>
  );
}