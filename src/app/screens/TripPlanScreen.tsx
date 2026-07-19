/**
 * Plan detail screen — `/trips/:tripId/plans/:planId`
 *
 * Renders a hero banner with trip metadata, then delegates all plan content
 * and actions to {@link TripPlanDetailView}. The back button always returns
 * to the plans list, preserving `entrySource` in navigation state so the list
 * screen knows whether the user arrived from the "generate" or "select" flow.
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router";
import { ArrowLeft, MapPin, CalendarDays, Share2, Download } from "lucide-react";
import { TripPlanDetailView } from "../components/TripPlanDetailView";
import { ItineraryMapSheet } from "../components/ItineraryMapSheet";
import { getTripById } from "../../services/tripService";
import { fetchDestinationCoverPhoto } from "../../services/placeService";
import { getPlanById, syncMissingPlansFromActiveItinerary } from "../../services/tripPlanService";
import { isGoogleMapsConfigured } from "../../config/googleMaps";
import type { TripPlan } from "../../types/itinerary";
import { parsePlanListEntrySource } from "../../types/planList";

const DEFAULT_HERO_IMG =
  "https://images.unsplash.com/photo-1682321297712-acaa3ea203c5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYWxpJTIwaW5kb25lc2lhJTIwcmljZSUyMHRlcnJhY2UlMjBhZXJpYWx8ZW58MXx8fHwxNzcyODMxMTI0fDA&ixlib=rb-4.1.0&q=80&w=1080";

export default function TripPlanScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tripId, planId } = useParams<{ tripId: string; planId: string }>();

  const entrySource = parsePlanListEntrySource(
    (location.state as { entrySource?: unknown } | null)?.entrySource
  );

  const [tripName, setTripName] = useState("");
  const [tripDestination, setTripDestination] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState(DEFAULT_HERO_IMG);
  const [tripDaysCount, setTripDaysCount] = useState(3);
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPlan = useCallback(() => {
    if (!tripId || !planId) {
      setLoadError("Missing trip or plan ID.");
      setLoading(false);
      return;
    }
    syncMissingPlansFromActiveItinerary(tripId);
    const trip = getTripById(tripId);
    if (trip) {
      setTripName(trip.name);
      setTripDestination(trip.destination);
    }
    const plan = getPlanById(tripId, planId);
    if (!plan) {
      setLoadError("That plan could not be found.");
      setLoading(false);
      return;
    }
    const days = plan.itinerary.days.length > 0
      ? plan.itinerary.days.length
      : Math.max(1, trip?.tripDays ?? 3);
    setTripDaysCount(days);
    setTripPlan(plan);
    setLoading(false);
  }, [tripId, planId]);

  useEffect(() => {
    if (tripId && typeof window !== "undefined") {
      sessionStorage.setItem("currentTripId", tripId);
    }
    loadPlan();
  }, [tripId, planId, loadPlan]);

  useEffect(() => {
    if (!tripDestination) return;
    void fetchDestinationCoverPhoto(tripDestination).then((url) => {
      if (url) setHeroImageUrl(url);
    });
  }, [tripDestination]);

  const handleBack = () => {
    if (tripId) navigate(`/trips/${tripId}/plans`, { state: { entrySource } });
    else navigate("/trips");
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F7F6]">
      {/* Hero */}
      <div className="relative w-full h-56">
        <img src={heroImageUrl} alt={tripDestination} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/70" />

        <button
          onClick={handleBack}
          className="absolute top-12 left-4 w-10 h-10 rounded-xl bg-white/90 backdrop-blur flex items-center justify-center shadow-lg"
        >
          <ArrowLeft size={20} className="text-[#6B7280]" />
        </button>

        <div className="absolute top-12 right-4 flex gap-2">
          <button className="w-10 h-10 rounded-xl bg-white/90 backdrop-blur flex items-center justify-center shadow-lg">
            <Share2 size={18} className="text-[#6B7280]" />
          </button>
          <button className="w-10 h-10 rounded-xl bg-white/90 backdrop-blur flex items-center justify-center shadow-lg">
            <Download size={18} className="text-[#6B7280]" />
          </button>
        </div>

        <div className="absolute bottom-4 left-5 right-5">
          <h1 className="text-white font-black text-2xl">{tripName} 🌴</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {tripDestination && (
              <div className="flex items-center gap-1">
                <MapPin size={13} className="text-white/80" />
                <span className="text-white/80 text-xs font-bold">{tripDestination}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <CalendarDays size={13} className="text-white/80" />
              <span className="text-white/80 text-xs font-bold">{tripDaysCount} days</span>
            </div>
          </div>
        </div>
      </div>

      {tripPlan && tripId ? (
        <TripPlanDetailView
          tripId={tripId}
          tripPlan={tripPlan}
          entrySource={entrySource}
          layout="page"
          loading={loading}
          loadError={loadError}
          onPlanChange={setTripPlan}
        />
      ) : (
        <div className="px-5 pt-10 text-center">
          {loadError ? (
            <p className="font-bold text-[#FF5C5C] text-sm leading-snug">{loadError}</p>
          ) : (
            <p className="font-bold text-[#6B7280] text-sm">Loading plan…</p>
          )}
        </div>
      )}

      {tripPlan && tripId && isGoogleMapsConfigured() && (
        <ItineraryMapSheet tripId={tripId} itinerary={tripPlan.itinerary} />
      )}
    </div>
  );
}
