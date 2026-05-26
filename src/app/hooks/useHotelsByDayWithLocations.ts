import { useEffect, useMemo, useState } from "react";
import { getTripHotels } from "../../services/hotelService";
import type { TripHotel } from "../../types/trip";
import { fetchPlaceDetails } from "../../services/placeService";
import type { DayHotelRowAssignment } from "../utils/itineraryToDisplayDays";

/**
 * Resolve a trip's hotels into a `hotelsByDay` map (morning / evening per day,
 * matching `DayHotelRowAssignment`) with each entry enriched by the hotel's
 * real Google Places coordinates. The coordinates let the downstream transit
 * pipeline compute proper hotel ↔ activity leg times instead of falling back
 * to the ~10 minute heuristic.
 *
 * The hook is intentionally read-only and re-reads `getTripHotels` whenever
 * `tripId` (or the `refreshKey`) changes. Pass `refreshKey` from the caller
 * (e.g. a bump counter after editing a hotel) to force a re-read without
 * having to remount.
 */
export function useHotelsByDayWithLocations(
  tripId: string | null | undefined,
  refreshKey: number = 0
): Record<number, DayHotelRowAssignment> {
  const [hotels, setHotels] = useState<TripHotel[]>([]);
  const [locations, setLocations] = useState<
    Record<string, { lat: number; lng: number }>
  >({});

  useEffect(() => {
    if (!tripId) {
      setHotels([]);
      return;
    }
    setHotels(getTripHotels(tripId));
  }, [tripId, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    const idsToFetch = new Set<string>();
    for (const h of hotels) {
      if (h.placeId && !locations[h.placeId]) idsToFetch.add(h.placeId);
    }
    if (!idsToFetch.size) return;
    void (async () => {
      const updates: Record<string, { lat: number; lng: number }> = {};
      await Promise.all(
        [...idsToFetch].map(async (placeId) => {
          try {
            const details = await fetchPlaceDetails(placeId);
            if (details?.location) updates[placeId] = details.location;
          } catch {
            /* ignore — transit will fall back to heuristic */
          }
        })
      );
      if (!cancelled && Object.keys(updates).length) {
        setLocations((prev) => ({ ...prev, ...updates }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotels, locations]);

  return useMemo(() => {
    const map: Record<number, DayHotelRowAssignment> = {};
    for (const h of hotels) {
      const summary = {
        placeId: h.placeId,
        hotelLabel: h.name,
        location: h.placeId ? locations[h.placeId] : undefined,
      };
      // Nights covered by this hotel: [dayStart, dayEnd - 1].
      // Morning of day N is the hotel that covered night N-1; evening is
      // the hotel that covers night N.
      for (let night = h.dayStart; night <= h.dayEnd - 1; night++) {
        const eveDay = map[night] ?? {};
        eveDay.evening = summary;
        map[night] = eveDay;
        const morningDay = night + 1;
        const morn = map[morningDay] ?? {};
        morn.morning = summary;
        map[morningDay] = morn;
      }
    }
    return map;
  }, [hotels, locations]);
}
