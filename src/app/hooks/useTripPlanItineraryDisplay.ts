import { useEffect, useMemo, useState } from "react";
import { upsertItineraryTransitSnapshot } from "../../services/itineraryService";
import { getTripById } from "../../services/tripService";
import { getFlightDayConstraints, getTripFlights, hydrateTripFlightsFromCloud } from "../../services/flightService";
import { hydrateTripHotelsFromCloud } from "../../services/hotelService";
import { subscribeTripAuxSync } from "../../services/cloudHydrateService";
import { getApproxTransitInfo, type TransitInfo } from "../../services/transitService";
import type { Itinerary, ItineraryDay } from "../../types/itinerary";
import type { TripFlight } from "../../types/trip";
import { useHotelsByDayWithLocations } from "./useHotelsByDayWithLocations";
import { useAirportLocations } from "./useAirportLocations";
import { itineraryToDisplayDays } from "../utils/itineraryToDisplayDays";
import { buildDayTimeline } from "../utils/buildDayTimeline";
import type { DisplayDay } from "../utils/itineraryToDisplayDays";
import {
  dayReasoningBullets,
  minutesToTimeLabel,
  parseTimeLabelToMinutes,
} from "../utils/itineraryDisplayHelpers";

export { dayReasoningBullets };

export function useTripPlanItineraryDisplay(tripId: string | null, itinerary: Itinerary | null) {
  const [flights, setFlights] = useState<TripFlight[]>([]);
  const [hotelsRefreshKey, setHotelsRefreshKey] = useState(0);
  const [transitByDay, setTransitByDay] = useState<Record<number, TransitInfo[]>>({});
  const [adjustedStartByDay, setAdjustedStartByDay] = useState<Record<number, string[]>>({});

  const hotelsByDay = useHotelsByDayWithLocations(tripId, hotelsRefreshKey);
  const tripForDisplay = tripId ? getTripById(tripId) : null;

  useEffect(() => {
    if (!tripId) {
      setFlights([]);
      return;
    }
    setFlights(getTripFlights(tripId));
    void hydrateTripHotelsFromCloud(tripId);
    void hydrateTripFlightsFromCloud(tripId).then(() => {
      setFlights(getTripFlights(tripId));
    });
  }, [tripId]);

  useEffect(() => {
    if (!tripId) return;
    return subscribeTripAuxSync(tripId, (table) => {
      if (table === "trip_hotels") {
        void hydrateTripHotelsFromCloud(tripId).then(() => {
          setHotelsRefreshKey((n) => n + 1);
        });
      } else if (table === "trip_flights") {
        void hydrateTripFlightsFromCloud(tripId).then(() => {
          setFlights(getTripFlights(tripId));
        });
      }
    });
  }, [tripId]);

  const flightConstraintsBase = useMemo(
    () => (tripId ? getFlightDayConstraints(tripId) : undefined),
    [tripId, flights]
  );

  const airportLocations = useAirportLocations(flightConstraintsBase);
  const flightConstraints = useMemo(() => {
    if (!flightConstraintsBase) return undefined;
    return {
      ...flightConstraintsBase,
      ...(airportLocations.day1 ? { day1AirportLocation: airportLocations.day1 } : {}),
      ...(airportLocations.lastDay
        ? { lastDayAirportLocation: airportLocations.lastDay }
        : {}),
    };
  }, [flightConstraintsBase, airportLocations]);

  const displayDays = useMemo((): DisplayDay[] => {
    if (!itinerary || !tripForDisplay) return [];
    return itineraryToDisplayDays(
      itinerary,
      tripForDisplay.name,
      tripForDisplay.createdAt,
      hotelsByDay,
      flightConstraints
    );
  }, [
    itinerary,
    tripForDisplay?.id,
    tripForDisplay?.name,
    tripForDisplay?.createdAt,
    hotelsByDay,
    flightConstraints,
  ]);

  const totalActivities = displayDays.reduce((acc, d) => acc + d.events.length, 0);

  const itineraryDayByIndex = useMemo(() => {
    const m = new Map<number, ItineraryDay>();
    for (const d of itinerary?.days ?? []) m.set(d.dayIndex, d);
    return m;
  }, [itinerary?.days]);

  const timelineByDay = useMemo(() => {
    if (!itinerary?.splitPlan?.needsSplit) return null;
    const out = new Map<number, ReturnType<typeof buildDayTimeline>>();
    for (const day of displayDays) {
      out.set(
        day.day,
        buildDayTimeline({
          events: day.events,
          itineraryDay: itineraryDayByIndex.get(day.day),
          splitPlan: itinerary.splitPlan,
        })
      );
    }
    return out;
  }, [displayDays, itinerary?.splitPlan, itineraryDayByIndex]);

  const useSplitTimelineView = itinerary?.splitPlan?.needsSplit === true;

  const transitLayoutFingerprint = useMemo(() => {
    const r = (n: number) => n.toFixed(4);
    return `v2:${displayDays
      .map((d) =>
        `${d.day}:${d.events
          .map(
            (e) =>
              `${e.time}|${e.durationMinutes}|${e.location ? `${r(e.location.lat)},${r(e.location.lng)}` : "-"}`
          )
          .join(",")}`
      )
      .join("|")}`;
  }, [displayDays]);

  useEffect(() => {
    if (!itinerary || displayDays.length === 0) {
      setTransitByDay((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      setAdjustedStartByDay((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }

    const snap = itinerary.transitSnapshot;
    if (snap && snap.layoutFingerprint === transitLayoutFingerprint) {
      const transitMap: Record<number, TransitInfo[]> = {};
      for (const [k, v] of Object.entries(snap.transitByDay)) {
        transitMap[Number(k)] = v as TransitInfo[];
      }
      const adjustedMap: Record<number, string[]> = {};
      for (const [k, v] of Object.entries(snap.adjustedStartByDay)) {
        adjustedMap[Number(k)] = v;
      }
      for (const day of displayDays) {
        const arr = adjustedMap[day.day];
        if (!arr) continue;
        for (let i = 0; i < day.events.length; i++) {
          const ev = day.events[i];
          if (!ev) continue;
          if (ev.id.endsWith("-lunch") || ev.id.endsWith("-dinner")) {
            const current = arr[i];
            const currentMin = current ? parseTimeLabelToMinutes(current) : -Infinity;
            const anchorMin = parseTimeLabelToMinutes(ev.time);
            if (currentMin < anchorMin) arr[i] = minutesToTimeLabel(anchorMin);
          }
        }
      }
      setTransitByDay((prev) =>
        JSON.stringify(prev) === JSON.stringify(transitMap) ? prev : transitMap
      );
      setAdjustedStartByDay((prev) =>
        JSON.stringify(prev) === JSON.stringify(adjustedMap) ? prev : adjustedMap
      );
      return;
    }

    let cancelled = false;
    const run = async () => {
      const layoutFp = transitLayoutFingerprint;
      const transitMap: Record<number, TransitInfo[]> = {};
      const adjustedMap: Record<number, string[]> = {};

      for (const day of displayDays) {
        const transits: TransitInfo[] = [];
        for (let i = 0; i < day.events.length - 1; i++) {
          const current = day.events[i];
          const next = day.events[i + 1];
          if (current.location && next.location) {
            const info = await getApproxTransitInfo(current.location, next.location);
            transits.push(info);
          } else {
            transits.push({ method: "drive", minutes: 10, source: "heuristic" });
          }
        }
        transitMap[day.day] = transits;

        if (day.events.length > 0) {
          const starts: string[] = [];
          let t = parseTimeLabelToMinutes(day.events[0].time);
          starts.push(minutesToTimeLabel(t));
          for (let i = 1; i < day.events.length; i++) {
            const prevEv = day.events[i - 1];
            const currEv = day.events[i];
            const transit = transits[i - 1]?.minutes ?? 0;
            t = t + (prevEv.durationMinutes ?? 60) + transit;
            if (currEv.id.endsWith("-lunch") || currEv.id.endsWith("-dinner")) {
              t = Math.max(t, parseTimeLabelToMinutes(currEv.time));
            }
            starts.push(minutesToTimeLabel(t));
          }
          adjustedMap[day.day] = starts;
        }
      }

      if (cancelled) return;
      setTransitByDay(transitMap);
      setAdjustedStartByDay(adjustedMap);
      if (tripId) {
        void upsertItineraryTransitSnapshot({
          tripId,
          layoutFingerprint: layoutFp,
          transitByDay: transitMap,
          adjustedStartByDay: adjustedMap,
        });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [transitLayoutFingerprint, itinerary, displayDays, tripId]);

  return {
    displayDays,
    totalActivities,
    transitByDay,
    adjustedStartByDay,
    timelineByDay,
    useSplitTimelineView,
  };
}
