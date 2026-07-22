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
import { getFlightDayConstraints } from "../../services/flightService";
import {
  buildPlaceDetailsFromSavedItinerary,
  fetchPlaceDetails,
  type PlaceDetailsResult,
} from "../../services/placeService";
import { parseTimeLabelToMinutes, minutesToTimeLabel } from "../utils/itineraryDisplayHelpers";
import { itineraryToDisplayDays, type DisplayDayEvent } from "../utils/itineraryToDisplayDays";
import { useHotelsByDayWithLocations } from "../hooks/useHotelsByDayWithLocations";
import { useAirportLocations } from "../hooks/useAirportLocations";
import type { Itinerary } from "../../types/itinerary";

const MAP_LIBRARIES: never[] = [];

/** One color per day, cycling if a trip runs longer than the palette. Shared
 * accent set with the rest of the app (member avatar colors). */
const DAY_COLORS = ["#10B954", "#1CB0F6", "#A78BFA", "#FF5C5C", "#FFB000", "#FF9F1C"];

function dayColorFor(dayNumber: number): string {
  return DAY_COLORS[(dayNumber - 1) % DAY_COLORS.length] ?? DAY_COLORS[0]!;
}

/** Raw path/rect data lifted from lucide-react's Hotel and Plane icons, so
 * the map's hotel/airport pins match the glyphs already used elsewhere in
 * the app (TripDetailScreen's HotelIcon/Plane) instead of a generic dot. */
const HOTEL_ICON_SHAPES: readonly [string, Record<string, string>][] = [
  ["path", { d: "M10 22v-6.57" }],
  ["path", { d: "M12 11h.01" }],
  ["path", { d: "M12 7h.01" }],
  ["path", { d: "M14 15.43V22" }],
  ["path", { d: "M15 16a5 5 0 0 0-6 0" }],
  ["path", { d: "M16 11h.01" }],
  ["path", { d: "M16 7h.01" }],
  ["path", { d: "M8 11h.01" }],
  ["path", { d: "M8 7h.01" }],
  ["rect", { x: "4", y: "2", width: "16", height: "20", rx: "2" }],
];
const PLANE_ICON_SHAPES: readonly [string, Record<string, string>][] = [
  [
    "path",
    {
      d: "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z",
    },
  ],
];

/**
 * Builds a data-URI pin icon: a filled circle (day color, white ring) with
 * a white lucide glyph centered on top — used for hotel/airport stops so
 * they read as a distinct waypoint type instead of just another numbered
 * stop. Mirrors the numbered pin's own sizing so selection feedback (bigger
 * + thicker ring) stays consistent between the two marker styles.
 */
function buildGlyphPinIcon(
  color: string,
  shapes: readonly [string, Record<string, string>][],
  selected: boolean
): { url: string; size: number; anchor: number } {
  const radius = selected ? 19 : 15;
  const strokeWidth = selected ? 5 : 2;
  const size = radius * 2 + strokeWidth * 2;
  const center = size / 2;
  const glyphScale = (radius / 15) * 0.72;
  const glyphOffset = center - (24 * glyphScale) / 2;
  const glyph = shapes
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(" ")} />`)
    .join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<circle cx="${center}" cy="${center}" r="${radius}" fill="${color}" stroke="#FFFFFF" stroke-width="${strokeWidth}" />` +
    `<g transform="translate(${glyphOffset},${glyphOffset}) scale(${glyphScale})" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>` +
    `</svg>`;
  return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, size, anchor: center };
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/**
 * Google's built-in `panTo` animates, but its duration isn't configurable —
 * on a quick swipe it can look laggy or clipped. This interpolates the
 * center manually over a fixed duration so consecutive swipes always get
 * the same smooth ~0.3s pan. Returns a cancel fn so a new selection can
 * stop an in-flight animation instead of fighting it.
 */
function animatePanTo(
  map: google.maps.Map,
  target: { lat: number; lng: number },
  durationMs = 300
): () => void {
  const start = map.getCenter();
  const startLat = start?.lat() ?? target.lat;
  const startLng = start?.lng() ?? target.lng;
  const startTime = performance.now();
  let cancelled = false;
  let frame = 0;

  const step = (now: number) => {
    if (cancelled) return;
    const t = Math.min(1, (now - startTime) / durationMs);
    const eased = easeInOutQuad(t);
    map.setCenter({
      lat: startLat + (target.lat - startLat) * eased,
      lng: startLng + (target.lng - startLng) * eased,
    });
    if (t < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);

  return () => {
    cancelled = true;
    cancelAnimationFrame(frame);
  };
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
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const carouselProgrammaticScrollRef = useRef(false);
  const dayColor = dayColorFor(activeDayNumber);

  const trip = tripId ? getTripById(tripId) : null;

  // Hotel and airport locations aren't on the itinerary payload itself —
  // without these, hotel/airport rows never get a `.location` and silently
  // drop out of the map entirely (no marker, no error). Mirrors the same
  // wiring TripDetailScreen uses for its own itinerary rendering.
  const hotelsByDay = useHotelsByDayWithLocations(tripId);
  const flightConstraintsBase = useMemo(
    () => (tripId ? getFlightDayConstraints(tripId) : undefined),
    [tripId]
  );
  const airportLocations = useAirportLocations(flightConstraintsBase);
  const flightConstraints = useMemo(() => {
    if (!flightConstraintsBase) return undefined;
    return {
      ...flightConstraintsBase,
      ...(airportLocations.day1 ? { day1AirportLocation: airportLocations.day1 } : {}),
      ...(airportLocations.lastDay ? { lastDayAirportLocation: airportLocations.lastDay } : {}),
    };
  }, [flightConstraintsBase, airportLocations]);

  const displayDays = useMemo(() => {
    if (!open) return [];
    return itineraryToDisplayDays(
      itinerary,
      trip?.name ?? "",
      trip?.startDate,
      hotelsByDay,
      flightConstraints
    );
  }, [open, itinerary, trip?.name, trip?.startDate, hotelsByDay, flightConstraints]);

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

  // Recenter the map on whichever stop is now selected — swiping the card
  // carousel calls setSelectedEventId via handleCarouselScroll above, so
  // this keeps the map following the cards without a separate swipe handler.
  // A fresh selection cancels any pan still in flight and starts its own,
  // so rapid swipes stay smooth instead of queuing up animations.
  useEffect(() => {
    if (!mapRef.current || !selectedEvent?.location) return;
    return animatePanTo(mapRef.current, selectedEvent.location, 300);
  }, [selectedEventId]);

  // Show the whole day at a glance when the map first loads and each time a
  // different day is tapped — frames every one of that day's pins instead of
  // just centering on the first stop at a fixed zoom. Doesn't fight the
  // pan-to-selection effect above: switching days changes selectedEvent's
  // day-scoped lookup to null (the id won't match the new day's events), so
  // there's nothing for that effect to pan to.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || locatedEvents.length === 0) return;
    if (locatedEvents.length === 1) {
      map.setCenter(locatedEvents[0]!.location);
      map.setZoom(DEFAULT_ZOOM);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const event of locatedEvents) bounds.extend(event.location);
    // Extra bottom padding keeps pins clear of the day-list drawer, which
    // covers roughly the bottom half of the screen at its default snap point.
    map.fitBounds(bounds, { top: 72, right: 48, bottom: 320, left: 48 });
  }, [activeDayNumber, mapReady, locatedEvents]);

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
                  setMapReady(true);
                }}
                onUnmount={() => {
                  mapRef.current = null;
                  setMapReady(false);
                }}
                onZoomChanged={() => {
                  const current = mapRef.current?.getZoom();
                  if (current != null) setZoom(current);
                }}
                // Tapping empty map space (not a marker — marker clicks don't
                // bubble to this handler) deselects the active pin, which
                // also brings the day-list drawer back.
                onClick={() => setSelectedEventId(null)}
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
                  const glyphShapes = event.isHotel
                    ? HOTEL_ICON_SHAPES
                    : event.isAirport
                      ? PLANE_ICON_SHAPES
                      : null;
                  const glyphIcon = glyphShapes
                    ? buildGlyphPinIcon(dayColor, glyphShapes, isSelected)
                    : null;
                  return (
                    <MarkerF
                      key={event.id}
                      position={event.location}
                      zIndex={isSelected ? 1 : 0}
                      // Hotel/airport stops get a glyph pin instead of a
                      // number — a Maps label can only be plain text, so
                      // there's nothing to overlay on a glyph icon.
                      label={
                        glyphIcon
                          ? undefined
                          : {
                              text: String(eventNumberById.get(event.id) ?? ""),
                              color: "#FFFFFF",
                              fontWeight: "700",
                              fontSize: isSelected ? "15px" : "13px",
                            }
                      }
                      icon={
                        glyphIcon
                          ? {
                              url: glyphIcon.url,
                              scaledSize: new google.maps.Size(glyphIcon.size, glyphIcon.size),
                              anchor: new google.maps.Point(glyphIcon.anchor, glyphIcon.anchor),
                            }
                          : {
                              path: google.maps.SymbolPath.CIRCLE,
                              // Bigger + a thicker white outline ring on tap so the
                              // selected pin reads clearly against the others —
                              // white regardless of day color so it always contrasts.
                              scale: isSelected ? 19 : 15,
                              fillColor: dayColor,
                              fillOpacity: 1,
                              strokeColor: "#FFFFFF",
                              strokeWeight: isSelected ? 5 : 2,
                            }
                      }
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
          drag only). Dismissed by tapping empty map space, not a close
          button — see the GoogleMap onClick above. */}
      {open && selectedEvent && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-full max-w-[402px] px-4">
          <div className="relative">
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
        // Hidden (not just covered) while a pin's card is floating, so it
        // doesn't fight the card for the same screen space; reappears the
        // moment the card is dismissed. Only a genuine user dismiss (drag
        // down, not this programmatic toggle) should close the whole map
        // view, hence the `selectedEvent` guard in onOpenChange.
        open={open && !selectedEvent}
        onOpenChange={(next) => {
          if (!next && !selectedEvent) setOpen(false);
        }}
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
