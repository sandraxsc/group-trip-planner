import { useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router";
import { ArrowLeft, QrCode, Share2, Copy, Check } from "lucide-react";
import { DuoButton } from "../components/DuoButton";
import { DuoCard } from "../components/DuoCard";
import { getInviteByTripId } from "../../services/tripService";

export default function InviteFriendsScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tripId: paramTripId } = useParams<{ tripId: string }>();
  const tripId = paramTripId ?? (location.state as { tripId?: string } | null)?.tripId ?? null;
  const invite = tripId ? getInviteByTripId(tripId) : null;
  const joinUrl = invite?.joinUrl ?? "";
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const link = joinUrl || window.location.origin;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSharePlan = () => {
    const link = joinUrl || window.location.origin;
    if (navigator.share) {
      navigator
        .share({
          title: "Join my trip!",
          text: "Come travel with me!",
          url: link,
        })
        .catch(() => {
          navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
    } else {
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleBack = () => (tripId ? navigate(`/trips/${tripId}`) : navigate("/"));
  const handleGoToTrip = () => (tripId ? navigate(`/trips/${tripId}`) : navigate("/"));

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Header */}
      <div className="flex items-center px-4 pt-12 pb-4 gap-3">
        <button
          onClick={handleBack}
          className="w-10 h-10 rounded-xl bg-white border-2 border-[#E8E8E8] flex items-center justify-center shadow-[0_3px_0_#C4C4C4] active:translate-y-0.5 active:shadow-none transition-all"
        >
          <ArrowLeft size={20} className="text-[#6B7280]" />
        </button>
        <h1 className="font-black text-[#1F302E] text-xl flex-1 text-center pr-10">
          Invite Friends 👥
        </h1>
      </div>

      {/* Success message */}
      <div className="px-5 py-4 bg-gradient-to-r from-[#E6F4EA] to-[#FFF8E1] border-b-2 border-[#E8E8E8]">
        <p className="text-center font-bold text-[#1F302E]">
          ✨ Successfully created a trip!
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 py-6">
        <h2 className="font-black text-2xl text-[#1F302E] mb-6 text-center">
          Invite Trip Members
        </h2>

        {/* QR Code Card */}
        <DuoCard className="mb-6 p-8">
          <div className="flex flex-col items-center">
            <div className="w-48 h-48 bg-white border-4 border-[#E8E8E8] rounded-2xl flex items-center justify-center mb-4 overflow-hidden">
              {joinUrl ? (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=192x192&data=${encodeURIComponent(
                    joinUrl
                  )}`}
                  alt="Trip invite QR code"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-center px-4">
                  <QrCode size={64} className="text-[#6B7280] mb-2" strokeWidth={1.5} />
                  <p className="text-xs font-bold text-[#6B7280]">
                    Invite link not available yet
                  </p>
                </div>
              )}
            </div>
            <p className="text-sm font-bold text-[#777] text-center">
              Scan to join the trip
            </p>
          </div>
        </DuoCard>

        {/* Share Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={handleSharePlan}
            className="flex flex-col items-center gap-2 px-4 py-5 bg-[#1CB0F6] border-b-4 border-[#0A91D1] rounded-2xl active:border-b-0 active:mt-1 transition-all"
          >
            <Share2 size={24} className="text-white" strokeWidth={2.5} />
            <span className="text-white font-black text-sm uppercase tracking-wide">
              Share Plan
            </span>
          </button>

          <button
            onClick={handleCopyLink}
            className="flex flex-col items-center gap-2 px-4 py-5 bg-[#A78BFA] border-b-4 border-[#7C3AED] rounded-2xl active:border-b-0 active:mt-1 transition-all relative"
          >
            {copied ? (
              <>
                <Check size={24} className="text-white" strokeWidth={2.5} />
                <span className="text-white font-black text-sm uppercase tracking-wide">
                  Copied!
                </span>
              </>
            ) : (
              <>
                <Copy size={24} className="text-white" strokeWidth={2.5} />
                <span className="text-white font-black text-sm uppercase tracking-wide">
                  Copy Link
                </span>
              </>
            )}
          </button>
        </div>

        {/* Info tip */}
        <div className="bg-[#DFF6FF] rounded-2xl p-4 border-2 border-[#1CB0F6] flex items-center gap-3">
          <span className="text-2xl">💡</span>
          <p className="text-sm font-bold text-[#0A91D1] flex-1">
            Share the QR code or link with your friends to invite them!
          </p>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="px-5 pb-8 pt-4">
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