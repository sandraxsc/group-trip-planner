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
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-[#E6F4EA] to-[#FFF8E1] items-center justify-center px-5">
      {/* Success Illustration */}
      <div className="mb-8 relative">
        <div className="w-40 h-40 bg-white rounded-3xl border-4 border-[#10B954] shadow-[0_8px_0_#0D9443] flex items-center justify-center">
          <PartyPopper size={80} className="text-[#10B954]" strokeWidth={1.5} />
        </div>
        {/* Confetti dots */}
        <div className="absolute -top-4 -left-4 w-6 h-6 rounded-full bg-[#FFB000] shadow-[0_3px_0_#CC8C00]" />
        <div className="absolute -top-2 -right-6 w-8 h-8 rounded-full bg-[#1CB0F6] shadow-[0_4px_0_#0A91D1]" />
        <div className="absolute -bottom-3 -left-6 w-7 h-7 rounded-full bg-[#A78BFA] shadow-[0_3px_0_#7C3AED]" />
        <div className="absolute -bottom-4 -right-4 w-5 h-5 rounded-full bg-[#FF5C5C] shadow-[0_3px_0_#CC3333]" />
      </div>

      {/* Success Message */}
      <div className="text-center mb-10">
        <h1 className="font-black text-[#1F302E] text-2xl mb-3">
          You Successfully
        </h1>
        <h1 className="font-black text-[#10B954] text-2xl mb-2">
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
      <p className="mt-6 text-xs text-[#6B7280] font-bold text-center">
        Automatically redirecting in {countdown} seconds...
      </p>
    </div>
  );
}