import { ArrowLeft, MapPin, Calendar, Users, MoreVertical } from "lucide-react";

/**
 * Top hero panel for a trip page: cover photo with darkening gradient, a back
 * button (top-left), a more-options button (top-right), and a meta strip with
 * title, destination, date and guest count along the bottom.
 *
 * Extracted verbatim from TripDetailScreen so the same hero can be reused on
 * other trip-scoped screens. The only intentional differences from the
 * original are the round 44×44 tap targets and a11y labels on the icon
 * buttons — the visual design is otherwise unchanged.
 */
interface TripHeroProps {
  title: string;
  destination: string;
  /** Pre-formatted "3 days" / "Mar 4, 2026" label rendered next to the calendar icon. */
  dateLabel: string;
  guestCount: number;
  coverImageUrl: string;
  onBack: () => void;
  onMore: () => void;
}

export function TripHero({
  title,
  destination,
  dateLabel,
  guestCount,
  coverImageUrl,
  onBack,
  onMore,
}: TripHeroProps) {
  return (
    <div className="relative w-full h-48">
      <img src={coverImageUrl} alt={destination} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/60" />
      <button
        onClick={onBack}
        aria-label="Back"
        className="absolute top-12 left-4 w-11 h-11 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-lg"
        style={{ touchAction: "manipulation" }}
      >
        <ArrowLeft size={20} className="text-[#4B4B4B]" />
      </button>
      <button
        onClick={onMore}
        aria-label="More options"
        className="absolute top-12 right-4 w-11 h-11 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-lg"
        style={{ touchAction: "manipulation" }}
      >
        <MoreVertical size={20} className="text-[#4B4B4B]" />
      </button>
      <div className="absolute bottom-4 left-5 right-5">
        <h1 className="text-white font-black text-2xl mb-1 break-words">{title}</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <MapPin size={14} className="text-white/90" />
            <span className="text-white/90 text-xs font-bold">{destination}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar size={14} className="text-white/90" />
            <span className="text-white/90 text-xs font-bold">{dateLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users size={14} className="text-white/90" />
            <span className="text-white/90 text-xs font-bold">{guestCount} guests</span>
          </div>
        </div>
      </div>
    </div>
  );
}
