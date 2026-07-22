import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Drawer } from "vaul";
import {
  ArrowLeft,
  Map as MapIcon,
  Minus,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Star,
  Phone,
  Link2,
  MapPin,
  Clock,
} from "lucide-react";
import { GoogleMap, MarkerF, PolylineF, useJsApiLoader } from "@react-google-maps/api";
import { getGoogleMapsApiKey } from "../../config/googleMaps";
import { getTripById } from "../../services/tripService";
import { getRoutePolyline, type RoutePolylineResult } from "../../services/transitService";
import {
  buildPlaceDetailsFromSavedItinerary,
  fetchPlaceDetails,
  type PlaceDetailsResult,
} from "../../services/placeService";
import { parseTimeLabelToMinutes, minutesToTimeLabel } from "../utils/itineraryDisplayHelpers";
import { itineraryToDisplayDays, type DisplayDayEvent } from "../utils/itineraryToDisplayDays";
import type { Itinerary } from "../../types/itinerary";

const MAP_LIBRARIES: never[] = [];

/** One color per day, cycling if a trip runs longer than the palette. Shared
 * accent set with the rest of the app (member avatar colors). */
const DAY_COLORS = ["#10B954", "#1CB0F6", "#A78BFA", "#FF5C5C", "#FFB000", "#FF9F1C"];

function dayColorFor(dayNumber: number): string {
  return DAY_COLORS[(dayNumber - 1) % DAY_COLORS.length] ?? DAY_COLORS[0]!;
}

function isLikelyGooglePlaceId(placeId: string): boolean {
  const id = placeId.trim();
  if (id.length <= 20) return false;
  return id.startsWith("ChIJ") || id.startsWith("GhIJ") || id.startsWith("Eh") || id.startsWith("EkQ");
}

const DASHED_LINE_ICONS = [
  {
    icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
    offset: "0",
    repeat: "12px",
  },
];

const SNAP_POINTS = [0.5, 0.92];
const DEFAULT_ZOOM = 13;
const MIN_ZOOM = 3;
const MAX_ZOOM = 20;

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
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [placeDetail, setPlaceDetail] = useState<PlaceDetailsResult | null>(null);
  const [placeDetailLoading, setPlaceDetailLoading] = useState(false);
  const [routeSegments, setRouteSegments] = useState<Map<string, RoutePolylineResult>>(new Map());
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const mapRef = useRef<google.maps.Map | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const carouselProgrammaticScrollRef = useRef(false);
  const dayColor = dayColorFor(activeDayNumber);

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
  // Number by position in the full events[] array (matching the list below),
  // not position within locatedEvents — otherwise an unlocated stop earlier in
  // the day (e.g. an "Add your hotel" placeholder) shifts every pin number out
  // of sync with the list's numbering.
  const eventNumberById = useMemo(() => {
    const map = new Map<string, number>();
    (activeDay?.events ?? []).forEach((e, idx) => map.set(e.id, idx + 1));
    return map;
  }, [activeDay]);
  const selectedEvent = activeDay?.events.find((e) => e.id === selectedEventId) ?? null;

  // Reset to day 1 and clear any open detail each time the sheet opens.
  useEffect(() => {
    if (open) {
      setActiveDayNumber(1);
      setSelectedEventId(null);
      setZoom(DEFAULT_ZOOM);
    }
  }, [open]);

  const handleZoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, z + 1));
  const handleZoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, z - 1));

  const selectedIndex = locatedEvents.findIndex((e) => e.id === selectedEventId);

  // Swiping the card carousel updates the selected pin; selecting a pin (or
  // a list row) scrolls the carousel to match. The ref flag stops that
  // second effect's own scroll from being read back as a user swipe.
  useEffect(() => {
    const container = carouselRef.current;
    if (!container || selectedIndex === -1) return;
    const target = selectedIndex * container.clientWidth;
    if (Math.abs(container.scrollLeft - target) < 4) return;
    carouselProgrammaticScrollRef.current = true;
    container.scrollTo({ left: target, behavior: "smooth" });
    const t = setTimeout(() => {
      carouselProgrammaticScrollRef.current = false;
    }, 400);
    return () => clearTimeout(t);
  }, [selectedIndex]);

  const handleCarouselScroll = () => {
    if (carouselProgrammaticScrollRef.current) return;
    const container = carouselRef.current;
    if (!container || container.clientWidth === 0) return;
    const idx = Math.round(container.scrollLeft / container.clientWidth);
    const event = locatedEvents[idx];
    if (event && event.id !== selectedEventId) setSelectedEventId(event.id);
  };

  // Collapse any expanded detail card back to compact whenever the selected
  // pin/card changes (swipe, tap a different pin, or tap a list row).
  useEffect(() => {
    setExpandedEventId(null);
    setPlaceDetail(null);
  }, [selectedEventId]);

  // Lazily fetch full Google Places details only when a card is actually
  // expanded, seeded immediately from what the saved itinerary already has
  // so the card isn't blank while the network call is in flight.
  useEffect(() => {
    if (!expandedEventId) return;
    const event = locatedEvents.find((e) => e.id === expandedEventId);
    if (!event) return;
    const placeId = (event.detailPlaceId ?? event.id).replace(/-(lunch|dinner)$/, "");
    const fallback = buildPlaceDetailsFromSavedItinerary(placeId, event);
    setPlaceDetail(fallback);
    if (!isLikelyGooglePlaceId(placeId)) return;
    let cancelled = false;
    setPlaceDetailLoading(true);
    fetchPlaceDetails(placeId)
      .then((detail) => {
        if (cancelled || !detail) return;
        setPlaceDetail((prev) => ({ ...(prev ?? fallback), ...detail }));
      })
      .finally(() => {
        if (!cancelled) setPlaceDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [expandedEventId, locatedEvents]);

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
      {/* `fixed` (not `absolute` inside the centered mobile-width column)
          so the FAB pins to the actual screen's bottom-right corner even
          on wide desktop viewports, where the app column floats centered
          with empty margins on either side. Margin matches Material
          Design's standard FAB spec (16dp from the edge on compact
          layouts) — this screen has no bottom nav bar to clear. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open map view"
        className="fixed z-30 bottom-4 right-4 w-14 h-14 rounded-full bg-[#1CB0F6] shadow-[0_4px_0_#0A91D1] flex items-center justify-center active:translate-y-1 active:shadow-none transition-all"
      >
        <MapIcon size={24} className="text-white" strokeWidth={2.5} />
      </button>

      {open && (
        // vaul sets `document.body.style.pointerEvents = "none"` while the
        // drawer is open (standard Radix/vaul pattern to block background
        // interaction). This map is a sibling of the drawer, not inside its
        // content tree, so it inherits that and would otherwise be frozen —
        // pointer-events: auto overrides the inherited value on this branch.
        <div className="fixed inset-0 z-40" style={{ pointerEvents: "auto" }}>
          <div className="w-full max-w-[402px] mx-auto h-full relative">
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={{ width: "100%", height: "100%" }}
                center={mapCenter}
                zoom={zoom}
                onLoad={(map) => {
                  mapRef.current = map;
                }}
                onUnmount={() => {
                  mapRef.current = null;
                }}
                onZoomChanged={() => {
                  const current = mapRef.current?.getZoom();
                  if (current != null) setZoom(current);
                }}
                options={{
                  disableDefaultUI: true,
                  // Google's own zoom control renders at the bottom of the map
                  // container, which the draggable sheet (z-50) sits directly on
                  // top of — it would be present but permanently hidden behind
                  // the sheet. Custom buttons below (positioned top-right, clear
                  // of the sheet at every snap point) replace it instead.
                  zoomControl: false,
                  clickableIcons: false,
                  // "auto" (default) falls back to requiring ctrl+scroll to zoom
                  // on desktop once the map is embedded in a scrollable page —
                  // this map is always the primary focus when open, so scroll
                  // and one-finger touch should always control it directly.
                  gestureHandling: "greedy",
                }}
              >
                {locatedEvents.map((event) => {
                  const isSelected = event.id === selectedEventId;
                  return (
                    <MarkerF
                      key={event.id}
                      position={event.location}
                      zIndex={isSelected ? 1 : 0}
                      label={{
                        text: String(eventNumberById.get(event.id) ?? ""),
                        color: "#FFFFFF",
                        fontWeight: "700",
                        fontSize: isSelected ? "15px" : "13px",
                      }}
                      icon={{
                        path: google.maps.SymbolPath.CIRCLE,
                        // Bigger + a thicker white outline ring on tap so the
                        // selected pin reads clearly against the others —
                        // white regardless of day color so it always contrasts.
                        scale: isSelected ? 19 : 15,
                        fillColor: dayColor,
                        fillOpacity: 1,
                        strokeColor: "#FFFFFF",
                        strokeWeight: isSelected ? 5 : 2,
                      }}
                      onClick={() => setSelectedEventId(event.id)}
                    />
                  );
                })}

                {locatedEvents.slice(1).map((event) => {
                  const segment = routeSegments.get(event.id);
                  if (!segment) return null;
                  const isRoad = segment.source === "api";
                  return (
                    <PolylineF
                      key={`route-${event.id}`}
                      path={segment.path}
                      options={{
                        // Colored per day (not per travel mode) so switching
                        // days reads as switching routes at a glance.
                        strokeColor: dayColor,
                        // Dashed fallback (straight line, no Routes geometry) draws
                        // entirely via `icons` repeat — strokeWeight must stay > 0
                        // for that path to have anything to anchor to; only
                        // strokeOpacity goes to 0 to hide the underlying solid line.
                        strokeOpacity: isRoad ? 0.9 : 0,
                        strokeWeight: 4,
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

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Back to trip"
              className="absolute top-4 left-4 w-10 h-10 rounded-xl bg-white/90 backdrop-blur flex items-center justify-center shadow-lg"
            >
              <ArrowLeft size={20} className="text-[#6B7280]" />
            </button>

            {isLoaded && (
              <div className="absolute top-4 right-4 flex flex-col rounded-xl bg-white shadow-[0_3px_0_#C4C4C4] overflow-hidden">
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={zoom >= MAX_ZOOM}
                  aria-label="Zoom in"
                  className="w-10 h-10 flex items-center justify-center active:bg-[#F7F7F6] disabled:opacity-40 transition-colors"
                >
                  <Plus size={18} className="text-[#6B7280]" strokeWidth={2.5} />
                </button>
                <div className="h-px bg-[#E8E8E8]" />
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={zoom <= MIN_ZOOM}
                  aria-label="Zoom out"
                  className="w-10 h-10 flex items-center justify-center active:bg-[#F7F7F6] disabled:opacity-40 transition-colors"
                >
                  <Minus size={18} className="text-[#6B7280]" strokeWidth={2.5} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pin-tap card: its own floating element pinned to the bottom of the
          screen (not bottom-sheet content) — sits above the drawer and the
          map, swipeable via native scroll-snap (no arrow buttons; swipe or
          drag only), closable independently of the drawer/day list. */}
      {open && selectedEvent && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-full max-w-[402px] px-4">
          <div className="relative">
            <button
              type="button"
              onClick={() => setSelectedEventId(null)}
              aria-label="Close activity card"
              className="absolute -top-3 -right-1 z-10 w-7 h-7 rounded-full bg-white shadow-[0_2px_0_#C4C4C4] flex items-center justify-center"
            >
              <X size={14} className="text-[#6B7280]" />
            </button>
            <div
              ref={carouselRef}
              onScroll={handleCarouselScroll}
              className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
            >
              {locatedEvents.map((event) => (
                <div key={event.id} className="w-full shrink-0 snap-center max-h-[60vh] overflow-y-auto">
                  <MapActivityCard
                    event={event}
                    number={eventNumberById.get(event.id) ?? 0}
                    dayColor={dayColor}
                    expanded={expandedEventId === event.id}
                    onToggleExpand={() =>
                      setExpandedEventId((cur) => (cur === event.id ? null : event.id))
                    }
                    detail={expandedEventId === event.id ? placeDetail : null}
                    detailLoading={expandedEventId === event.id && placeDetailLoading}
                  />
                </div>
              ))}
            </div>
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
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[402px] z-50 flex flex-col rounded-t-3xl bg-white border-t-2 border-x-2 border-[#E8E8E8] shadow-[0_-4px_0_#C4C4C4] outline-none"
            style={{ height: "92vh" }}
          >
            <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-[#E8E8E8]" />
            <Drawer.Title className="sr-only">Map view</Drawer.Title>
            <Drawer.Description className="sr-only">
              Browse this trip's itinerary on a map, switch days, and tap a pin to see activity details.
            </Drawer.Description>

            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <span className="text-sm font-black text-[#6B7280]">Map view</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close map view"
                className="w-8 h-8 rounded-full bg-[#F7F7F6] flex items-center justify-center"
              >
                <X size={16} className="text-[#6B7280]" />
              </button>
            </div>

            <div className="px-4 pb-2 flex gap-1 overflow-x-auto no-scrollbar">
                  {displayDays.map((d) => {
                    const isActive = d.day === activeDayNumber;
                    const color = dayColorFor(d.day);
                    return (
                      <button
                        key={d.day}
                        type="button"
                        onClick={() => setActiveDayNumber(d.day)}
                        style={isActive ? { backgroundColor: color } : undefined}
                        className={`duo-focusable rounded-xl py-2 px-3 font-bold text-[13px] whitespace-nowrap transition-all duration-[150ms] ${
                          isActive ? "text-white" : "bg-[#F7F7F6] text-[#6B7280]"
                        }`}
                      >
                        Day {d.day}
                      </button>
                    );
                  })}
                </div>

                <div className="flex-1 overflow-y-auto mobile-sheet-scroll px-4 pb-6">
                  {(activeDay?.events ?? []).map((event, idx) => {
                    // Keyed by the "to" event's id (same convention as the
                    // route polylines above), so this only appears between
                    // stops that actually have a computed leg.
                    const segment = idx > 0 ? routeSegments.get(event.id) : undefined;
                    return (
                      <Fragment key={event.id}>
                        {segment && (
                          <div className="pl-9 py-1.5 flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280]">
                            <span>
                              {segment.method === "walk" ? "🚶" : segment.method === "transit" ? "🚌" : "🚗"}
                            </span>
                            <span>
                              {segment.source === "heuristic" ? "~" : ""}
                              {segment.minutes} min transit
                            </span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => event.location && setSelectedEventId(event.id)}
                          disabled={!event.location}
                          className="w-full flex items-center gap-3 py-3 border-b border-[#F0F0F0] text-left disabled:opacity-50"
                        >
                          <span
                            className="w-6 h-6 shrink-0 rounded-full text-white text-[12px] font-black flex items-center justify-center"
                            style={{ backgroundColor: dayColor }}
                          >
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
                            <p className="font-bold text-[14px] text-[#6B7280] truncate">{event.title}</p>
                            <p className="text-[12px] font-bold text-[#6B7280]">{event.time}</p>
                          </div>
                        </button>
                      </Fragment>
                    );
                  })}
                  {activeDay && activeDay.events.length === 0 && (
                    <p className="text-sm font-bold text-[#6B7280] text-center py-8">No activities this day.</p>
                  )}
                </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}

/**
 * One card in the pin-tap swipe carousel. Compact by default (thumbnail,
 * pin number, name, 2-line description, scheduled time range); tapping it
 * expands in place to the full Google Places detail (rating, description,
 * address, phone, website, opening hours) — fetched lazily by the parent
 * only while this card is expanded.
 */
function MapActivityCard({
  event,
  number,
  dayColor,
  expanded,
  onToggleExpand,
  detail,
  detailLoading,
}: {
  event: DisplayDayEvent;
  number: number;
  dayColor: string;
  expanded: boolean;
  onToggleExpand: () => void;
  detail: PlaceDetailsResult | null;
  detailLoading: boolean;
}) {
  const timeRange = (() => {
    if (!event.time || event.time === "--") return null;
    const start = parseTimeLabelToMinutes(event.time);
    const end = start + Math.max(0, event.durationMinutes || 0);
    return end > start ? `${minutesToTimeLabel(start)} – ${minutesToTimeLabel(end)}` : event.time;
  })();
  const description = detail?.description ?? event.savedDescription ?? null;
  const rating = detail?.rating ?? event.savedRating;

  return (
    <div className="bg-white rounded-2xl border-2 border-[#E8E8E8] shadow-[0_4px_0_#C4C4C4] overflow-hidden my-3">
      <button type="button" onClick={onToggleExpand} className="w-full text-left">
        <div className="flex gap-3 p-3">
          {event.image ? (
            <img src={event.image} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-[#F7F7F6] shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span
                className="w-5 h-5 shrink-0 rounded-full text-white text-[11px] font-black flex items-center justify-center"
                style={{ backgroundColor: dayColor }}
              >
                {number}
              </span>
              <p className="font-black text-[14px] text-[#1F302E] truncate">{event.title}</p>
            </div>
            {!expanded && description && (
              <p className="text-[12px] font-bold text-[#6B7280] mt-1 line-clamp-2">{description}</p>
            )}
            {timeRange && <p className="text-[11px] font-bold text-[#6B7280] mt-1">{timeRange}</p>}
          </div>
          <div className="shrink-0 mt-1 text-[#6B7280]">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[#F0F0F0] pt-3 flex flex-col gap-2.5">
          {event.image && (
            <img src={event.image} alt="" className="w-full h-32 rounded-xl object-cover" />
          )}
          <div className="flex items-center gap-3 flex-wrap text-[13px] font-bold text-[#6B7280]">
            {event.duration && event.duration !== "—" && <span>{event.duration}</span>}
            {event.cost && <span>{event.cost}</span>}
            {rating != null && (
              <span className="flex items-center gap-1">
                <Star size={13} className="fill-[#FFD700] text-[#FFD700]" />
                {rating.toFixed(1)}
              </span>
            )}
          </div>
          {description && <p className="text-[13px] text-[#6B7280] leading-relaxed">{description}</p>}
          {detail?.formattedAddress && (
            <div className="flex items-start gap-2 text-[12px] font-bold text-[#6B7280]">
              <MapPin size={14} className="shrink-0 mt-0.5" />
              <span>{detail.formattedAddress}</span>
            </div>
          )}
          {detail?.phone && (
            <a
              href={`tel:${detail.phone}`}
              className="flex items-center gap-2 text-[12px] font-bold text-[#1CB0F6]"
            >
              <Phone size={14} className="shrink-0" />
              {detail.phone}
            </a>
          )}
          {detail?.website && (
            <a
              href={detail.website}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-[12px] font-bold text-[#1CB0F6] min-w-0"
            >
              <Link2 size={14} className="shrink-0" />
              <span className="truncate">{detail.website}</span>
            </a>
          )}
          {detail?.openHoursText && detail.openHoursText.length > 0 && (
            <div className="flex items-start gap-2 text-[12px] font-bold text-[#6B7280]">
              <Clock size={14} className="shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                {detail.openHoursText.map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
              </div>
            </div>
          )}
          {detailLoading && (
            <p className="text-[11px] font-bold text-[#6B7280]">Loading more details…</p>
          )}
        </div>
      )}
    </div>
  );
}
