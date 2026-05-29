import { useEffect, useState } from "react";
import { fetchAirportLocation } from "../../services/placeService";
import type { FlightDayConstraints } from "../../services/flightService";

/**
 * Resolved coordinates for the two airport bookends a trip can have: the
 * Day 1 arrival airport and the last-day departure airport. Either side
 * may be undefined if no flight is on file for that direction, or if
 * Google Places couldn't resolve the IATA code.
 */
export interface AirportLocations {
  day1?: { lat: number; lng: number };
  lastDay?: { lat: number; lng: number };
}

/**
 * Resolve IATA codes from `FlightDayConstraints` into real lat / lng pairs
 * via Google Places, so the airport bookend rows on Trip Plan / Trip Detail
 * can carry a `location` and the transit pipeline can compute a real
 * driving leg between the airport and the first / last stop of the day
 * (instead of falling back to the fixed 10-minute heuristic).
 *
 * Mirrors the shape of `useHotelsByDayWithLocations` — the airport coords
 * service caches in localStorage so repeat lookups are free after the
 * first resolution per IATA code.
 *
 * Returns an empty object until the resolutions complete, so callers can
 * spread it into `flightConstraints` without conditional logic.
 */
export function useAirportLocations(
  flightConstraints: FlightDayConstraints | undefined
): AirportLocations {
  const [locations, setLocations] = useState<AirportLocations>({});

  const day1Code = flightConstraints?.day1AirportCode;
  const lastDayCode = flightConstraints?.lastDayAirportCode;

  useEffect(() => {
    let cancelled = false;
    if (!day1Code && !lastDayCode) {
      setLocations({});
      return;
    }
    void (async () => {
      const [day1Loc, lastDayLoc] = await Promise.all([
        day1Code ? fetchAirportLocation(day1Code) : Promise.resolve(null),
        lastDayCode ? fetchAirportLocation(lastDayCode) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      setLocations({
        ...(day1Loc ? { day1: day1Loc } : {}),
        ...(lastDayLoc ? { lastDay: lastDayLoc } : {}),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [day1Code, lastDayCode]);

  return locations;
}
