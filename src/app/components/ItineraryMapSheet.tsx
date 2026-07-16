import { useEffect, useMemo, useState } from "react";
import { Drawer } from "vaul";
import { Map as MapIcon, X, ChevronLeft, Star } from "lucide-react";
import { GoogleMap, MarkerF, PolylineF, useJsApiLoader } from "@react-google-maps/api";
import { getGoogleMapsApiKey } from "../../config/googleMaps";
import { getTripById } from "../../services/tripService";
import { getRoutePolyline, type RoutePolylineResult } from "../../services/transitService";
import { itineraryToDisplayDays, type DisplayDayEvent } from "../utils/itineraryToDisplayDays";
import type { Itinerary } from "../../types/itinerary";

const MAP_LIBRARIES: never[] = [];

const MODE_COLOR: Record<RoutePolylineResult["method"], string> = {
  walk: "#58CC02",
  drive: "#1CB0F6",
  transit: "#CE82FF",
};

const DASHED_LINE_ICONS = [
  {
    icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
    offset: "0",
    repeat: "12px",
  },
];

const SNAP_POINTS = [0.5, 0.92];

interface ItineraryMapSheetProps {
  tripId: string;
  itinerary: Itinerary;
}

/**
 * FAB + draggable bottom-sheet map view for a finalized trip plan.
 *
 * A full-viewport Google Map sits as a fixed base layer behind a vaul
 * bottom sheet (day switcher + per-day activity list). Dragging the sheet
 * down shrinks it and reveals more of the map underneath; dragging it up
 * expands it toward a near-full-screen list, which reads as "the normal
 * itinerary page" with only a sliver of map showing. An explicit close
 * button fully exits map mode back to the plain TripPlanScreen.
 *
 * Hidden entirely when VITE_GOOGLE_MAPS_API_KEY isn't configured.
 */
export function ItineraryMapSheet({ tripId, itinerary }: ItineraryMapSheetProps) {
  const apiKey = getGoogleMapsApiKey();
  const { isLoaded } = useJsApiLoader({
    id: "itinerary-map-sheet",
    googleMapsApiKey: apiKey ?? "",
    libraries: MAP_LIBRARIES,
  });

  const [open, setOpen] = useState(false);
  const [activeDayNumber, setActiveDayNumber] = useState(1);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [routeSegments, setRouteSegments] = useState<Map<string, RoutePolylineResult>>(new Map());

  const trip = tripId ? getTripById(tripId) : null;

  const displayDays = useMemo(() => {
    if (!open) return [];
    return itineraryToDisplayDays(itinerary, trip?.name ?? "", trip?.startDate);
  }, [open, itinerary, trip?.name, trip?.startDate]);

  const activeDay = displayDays.find((d) => d.day === activeDayNumber) ?? displayDays[0] ?? null;
  const locatedEvents = useMemo(
    () => (activeDay?.events ?? []).filter((e): e is DisplayDayEvent & { location: { lat: number; lng: number } } => Boolean(e.location)),
    [activeDay]
  );
  const selectedEvent = activeDay?.events.find((e) => e.id === selectedEventId) ?? null;

  // Reset to day 1 and clear any open detail each time the sheet opens.
  useEffect(() => {
    if (open) {
      setActiveDayNumber(1);
      setSelectedEventId(null);
    }
  }, [open]);

  // Fetch per-leg polylines for the active day using the AI-decided travel
  // mode carried on each event (falls back to distance-based straight line
  // inside getRoutePolyline when a leg has no decided mode).
  useEffect(() => {
    if (!open || !isLoaded || !activeDay) return;
    let cancelled = false;
    (async () => {
      const segments = new Map<string, RoutePolylineResult>();
      for (let i = 0; i < locatedEvents.length - 1; i++) {
        const from = locatedEvents[i]!;
        const to = locatedEvents[i + 1]!;
        const result = await getRoutePolyline(from.location, to.location, to.travelModeFromPrevious ?? undefined);
        if (cancelled) return;
        segments.set(to.id, result);
      }
      if (!cancelled) setRouteSegments(segments);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, isLoaded, activeDay, locatedEvents]);

  if (!apiKey) return null;

  const mapCenter = locatedEvents[0]?.location ?? { lat: 0, lng: 0 };

  return (
    <>
      <div
        className="fixed bottom-24 right-4 max-w-[402px] z-30"
        style={{ right: "calc(50% - 201px + 16px)" }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open map view"
          className="w-14 h-14 rounded-full bg-[#1CB0F6] shadow-[0_4px_0_#1899D6] flex items-center justify-center active:translate-y-1 active:shadow-none transition-all"
        >
          <MapIcon size={24} className="text-white" strokeWidth={2.5} />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40">
          <div className="w-full max-w-[402px] mx-auto h-full relative">
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={{ width: "100%", height: "100%" }}
                center={mapCenter}
                zoom={13}
                options={{
                  disableDefaultUI: true,
                  zoomControl: true,
                  clickableIcons: false,
                }}
              >
                {locatedEvents.map((event, idx) => (
                  <MarkerF
                    key={event.id}
                    position={event.location}
                    label={{ text: String(idx + 1), color: "#FFFFFF", fontWeight: "700", fontSize: "13px" }}
                    icon={{
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 15,
                      fillColor: "#58CC02",
                      fillOpacity: 1,
                      strokeColor: "#FFFFFF",
                      strokeWeight: 2,
                    }}
                    onClick={() => setSelectedEventId(event.id)}
                  />
                ))}

                {locatedEvents.slice(1).map((event) => {
                  const segment = routeSegments.get(event.id);
                  if (!segment) return null;
                  const isRoad = segment.source === "api";
                  return (
                    <PolylineF
                      key={`route-${event.id}`}
                      path={segment.path}
                      options={{
                        strokeColor: MODE_COLOR[segment.method],
                        strokeOpacity: isRoad ? 0.9 : 0,
                        strokeWeight: isRoad ? 4 : 0,
                        icons: isRoad ? undefined : DASHED_LINE_ICONS,
                      }}
                    />
                  );
                })}
              </GoogleMap>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#E5F6FF]">
                <p className="text-sm font-bold text-[#1CB0F6]">Loading map…</p>
              </div>
            )}
          </div>
        </div>
      )}

      <Drawer.Root
        open={open}
        onOpenChange={setOpen}
        modal={false}
        snapPoints={SNAP_POINTS}
        activeSnapPoint={SNAP_POINTS[0]}
      >
        <Drawer.Portal>
          <Drawer.Content
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[402px] z-50 flex flex-col rounded-t-3xl bg-white border-t-2 border-x-2 border-[#E5E5E5] shadow-[0_-4px_0_#D4D4D4] outline-none"
            style={{ height: "92vh" }}
          >
            <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-[#E5E5E5]" />
            <Drawer.Title className="sr-only">Map view</Drawer.Title>
            <Drawer.Description className="sr-only">
              Browse this trip's itinerary on a map, switch days, and tap a pin to see activity details.
            </Drawer.Description>

            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              {selectedEvent ? (
                <button
                  type="button"
                  onClick={() => setSelectedEventId(null)}
                  className="flex items-center gap-1 text-sm font-bold text-[#777777]"
                >
                  <ChevronLeft size={18} />
                  Back
                </button>
              ) : (
                <span className="text-sm font-black text-[#4B4B4B]">Map view</span>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close map view"
                className="w-8 h-8 rounded-full bg-[#F7F7F7] flex items-center justify-center"
              >
                <X size={16} className="text-[#4B4B4B]" />
              </button>
            </div>

            {selectedEvent ? (
              <ActivityDetailPane event={selectedEvent} />
            ) : (
              <>
                <div className="px-4 pb-2 flex gap-1 overflow-x-auto no-scrollbar">
                  {displayDays.map((d) => (
                    <button
                      key={d.day}
                      type="button"
                      onClick={() => setActiveDayNumber(d.day)}
                      className={`duo-focusable rounded-xl py-2 px-3 font-bold text-[13px] whitespace-nowrap transition-all duration-[150ms] ${
                        d.day === activeDayNumber
                          ? "bg-[#58CC02] text-white"
                          : "bg-[#F7F7F7] text-[#777777]"
                      }`}
                    >
                      Day {d.day}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto mobile-sheet-scroll px-4 pb-6">
                  {(activeDay?.events ?? []).map((event, idx) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => event.location && setSelectedEventId(event.id)}
                      disabled={!event.location}
                      className="w-full flex items-center gap-3 py-3 border-b border-[#F0F0F0] text-left disabled:opacity-50"
                    >
                      <span className="w-6 h-6 shrink-0 rounded-full bg-[#58CC02] text-white text-[12px] font-black flex items-center justify-center">
                        {idx + 1}
                      </span>
                      {event.image && (
                        <img
                          src={event.image}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-[14px] text-[#4B4B4B] truncate">{event.title}</p>
                        <p className="text-[12px] font-bold text-[#AFAFAF]">{event.time}</p>
                      </div>
                    </button>
                  ))}
                  {activeDay && activeDay.events.length === 0 && (
                    <p className="text-sm font-bold text-[#AFAFAF] text-center py-8">No activities this day.</p>
                  )}
                </div>
              </>
            )}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}

function ActivityDetailPane({ event }: { event: DisplayDayEvent }) {
  return (
    <div className="flex-1 overflow-y-auto mobile-sheet-scroll px-4 pb-6">
      {event.image && (
        <img src={event.image} alt="" className="w-full h-40 rounded-2xl object-cover mb-3" />
      )}
      <span
        className="inline-block text-[11px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full mb-2"
        style={{ color: event.categoryColor, backgroundColor: event.categoryBg }}
      >
        {event.type}
      </span>
      <h3 className="font-black text-lg text-[#4B4B4B]">{event.title}</h3>
      <div className="flex items-center gap-3 mt-1 text-[13px] font-bold text-[#777777]">
        <span>{event.time}</span>
        <span>·</span>
        <span>{event.duration}</span>
        <span>·</span>
        <span>{event.cost}</span>
        {event.savedRating != null && (
          <>
            <span>·</span>
            <span className="flex items-center gap-0.5">
              <Star size={13} className="fill-[#FFD700] text-[#FFD700]" />
              {event.savedRating.toFixed(1)}
            </span>
          </>
        )}
      </div>
      {event.savedDescription && (
        <p className="text-sm text-[#4B4B4B] mt-3 leading-relaxed">{event.savedDescription}</p>
      )}
    </div>
  );
}
