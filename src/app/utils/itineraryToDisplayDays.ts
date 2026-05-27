import { getPrimaryCategory } from "../../services/activityEngine";
import type { PrimaryCategory } from "../../services/activityEngine";
import type { FlightDayConstraints } from "../../services/flightService";
import type {
  Itinerary,
  ItineraryDay,
  ItineraryEditRow,
  ScheduledActivity,
} from "../../types/itinerary";

export interface DisplayDayEvent {
  id: string;
  time: string;
  title: string;
  type: string;
  categoryColor: string;
  categoryBg: string;
  duration: string;
  durationMinutes: number;
  cost: string;
  votes: number;
  image: string | null;
  location?: { lat: number; lng: number };
  /** UI: hotel placeholder row */
  isHotel?: boolean;
  /** UI: airport bookend row — first event of Day 1 (arrival) or last event of
   * the final day (departure). Inserted by the display layer when flight data
   * is available; not editable / not part of the saved edit rows. */
  isAirport?: boolean;
  /** IATA airport code for airport rows (e.g. "DCA"). Undefined otherwise. */
  airportCode?: string;
  /** UI: user-added activity stub */
  isPlaceholder?: boolean;
  /** When event.id is an edit-row id (not placeId), use this for place details / Google id */
  detailPlaceId?: string;
  /** From saved itinerary — avoids Places GET when opening the detail sheet */
  savedDescription?: string | null;
  savedCategoryLabel?: string | null;
  savedRating?: number;
}

export interface DisplayDay {
  day: number;
  date: string;
  emoji: string;
  title: string;
  /** AI planning rationale (not a play-by-play); shown under "Why this day?" */
  dayReasoning?: string;
  /** Inline explainer when this day's window was clamped by a flight. */
  flightNote?: string;
  events: DisplayDayEvent[];
}

function formatTimeForDisplay(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (h === 0 && m === 0) return "12:00 AM";
  if (h < 12) return `${h}:${String(m ?? 0).padStart(2, "0")} AM`;
  if (h === 12) return `12:${String(m ?? 0).padStart(2, "0")} PM`;
  return `${h - 12}:${String(m ?? 0).padStart(2, "0")} PM`;
}

function flightClampToNote(day: ItineraryDay): string | undefined {
  const clamp = day.flightClamp;
  if (!clamp) return undefined;
  const pretty = formatTimeForDisplay(clamp.time);
  return clamp.reason === "arrival"
    ? `Starts at ${pretty} — after the latest arriving flight.`
    : `Ends by ${pretty} — before the earliest departing flight.`;
}

const TYPE_LABELS: Record<string, { type: string; color: string; bg: string }> = {
  food: { type: "🍜 Food", color: "#FF4B4B", bg: "#FFE5E5" },
  culture: { type: "🏛️ Culture", color: "#FFD700", bg: "#FFF8DC" },
  nature: { type: "🌿 Nature", color: "#58CC02", bg: "#F0FDE4" },
  shopping: { type: "🛍️ Shopping", color: "#CE82FF", bg: "#F9F0FF" },
  nightlife: { type: "🎉 Nightlife", color: "#00BFFF", bg: "#E0FFFF" },
  wellness: { type: "💆 Wellness", color: "#FF69B4", bg: "#FFEBE9" },
  entertainment: { type: "✨ Entertainment", color: "#FF6347", bg: "#FFECDB" },
  other: { type: "✨ Activity", color: "#AFAFAF", bg: "#F7F7F7" },
};

const HOTEL_STYLE = { type: "🛏️ Hotel", color: "#1CB0F6", bg: "#E8F7FF" };
const AIRPORT_STYLE = { type: "✈️ Airport", color: "#1CB0F6", bg: "#DDF4FF" };

/**
 * Build an airport bookend event for the start of Day 1 (`reason="arrival"`)
 * or end of the last day (`reason="departure"`). Inserted by the display
 * layer when flight data is available — not saved in the itinerary, so the
 * card updates the instant the user adds / changes / removes a flight.
 */
function buildAirportEvent(args: {
  dayIndex: number;
  reason: "arrival" | "departure";
  airportCode: string;
  time: string; // "HH:MM" 24h
}): DisplayDayEvent {
  const { dayIndex, reason, airportCode, time } = args;
  const title =
    reason === "arrival"
      ? `Arrive at ${airportCode}`
      : `Depart from ${airportCode}`;
  return {
    id: `airport-${reason}-${dayIndex}`,
    time: formatTimeForDisplay(time),
    title,
    type: AIRPORT_STYLE.type,
    categoryColor: AIRPORT_STYLE.color,
    categoryBg: AIRPORT_STYLE.bg,
    duration: "—",
    durationMinutes: 0,
    cost: "",
    votes: 0,
    image: null,
    isAirport: true,
    airportCode,
  };
}

function getType(sa: ScheduledActivity): { type: string; color: string; bg: string } {
  if (sa.blockLabel === "lunch" || sa.blockLabel === "dinner") return TYPE_LABELS.food;
  const primary = (sa.activity && getPrimaryCategory(sa.activity)) as PrimaryCategory | undefined;
  return TYPE_LABELS[primary ?? "other"] ?? TYPE_LABELS.other;
}

function durationStr(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return `${h} hr${h > 1 ? "s" : ""}`;
  return `${h}–${h + 1} hrs`;
}

function costFromActivity(sa: ScheduledActivity): string {
  const pl = sa.activity?.priceLevel;
  if (pl === 0 || pl === 1) return "$";
  if (pl === 2) return "$$";
  if (pl === 3) return "$$$";
  if (pl === 4) return "$$$$";
  const cl = sa.activity?.costLevel;
  if (cl === "low") return "$";
  if (cl === "medium") return "$$";
  if (cl === "high") return "$$$";
  return "$$";
}

const EMOJIS = ["🌴", "⛰️", "🏄", "🎨", "🍜", "🌅"];

/** All scheduled activities addressable by display id (placeId or placeId-lunch / -dinner). */
export function flattenScheduledActivitiesByKey(days: ItineraryDay[]): Map<string, ScheduledActivity> {
  const m = new Map<string, ScheduledActivity>();
  for (const d of days) {
    for (const block of d.blocks) {
      for (const sa of block.activities) {
        m.set(sa.placeId, sa);
      }
    }
    if (d.lunchSlot.activity) {
      m.set(`${d.lunchSlot.activity.placeId}-lunch`, d.lunchSlot.activity);
    }
    if (d.dinnerSlot.activity) {
      m.set(`${d.dinnerSlot.activity.placeId}-dinner`, d.dinnerSlot.activity);
    }
  }
  return m;
}

function lookupActivityKey(row: ItineraryEditRow): string | null {
  if (row.kind !== "activity" || !row.placeId) return null;
  if (row.mealSlot === "lunch") return `${row.placeId}-lunch`;
  if (row.mealSlot === "dinner") return `${row.placeId}-dinner`;
  return row.placeId;
}

function scheduledToDisplayEvent(sa: ScheduledActivity, id: string): DisplayDayEvent {
  const style = getType(sa);
  return {
    id,
    time: formatTimeForDisplay(sa.startTime),
    title: sa.name,
    type: style.type,
    categoryColor: style.color,
    categoryBg: style.bg,
    duration: durationStr(sa.durationMinutes),
    durationMinutes: sa.durationMinutes,
    cost: costFromActivity(sa),
    votes: 0,
    image: sa.activity?.imageUrl ?? null,
    location: sa.activity?.location,
    savedDescription: sa.activity?.description ?? null,
    savedCategoryLabel: sa.activity?.displayCategoryLabel ?? null,
    savedRating: sa.activity?.rating,
  };
}

function sortEventsByTime(events: DisplayDayEvent[]): DisplayDayEvent[] {
  return [...events].sort((a, b) => {
    const toMin = (t: string) => {
      if (t === "--") return -1;
      const parts = t.split(" ");
      const timePart = parts[0] ?? "0:00";
      const period = parts[1] ?? "AM";
      const [h, m] = timePart.split(":").map(Number);
      let hh = h ?? 0;
      if (period === "PM" && hh !== 12) hh += 12;
      if (period === "AM" && hh === 12) hh = 0;
      return hh * 60 + (m ?? 0);
    };
    return toMin(a.time) - toMin(b.time);
  });
}

/**
 * Build display days from raw itinerary blocks (no editRows).
 */
export function buildDisplayDaysFromBlocks(
  itinerary: Itinerary,
  tripName: string,
  startDateIso?: string,
  flightConstraints?: FlightDayConstraints
): DisplayDay[] {
  const baseDate = startDateIso ? new Date(startDateIso) : null;
  const lastDayIndex = itinerary.days.length;
  return itinerary.days.map((d, i) => {
    const events: DisplayDayEvent[] = [];
    for (const block of d.blocks) {
      for (const sa of block.activities) {
        events.push(scheduledToDisplayEvent(sa, sa.placeId));
      }
    }
    if (d.lunchSlot.activity) {
      const sa = d.lunchSlot.activity;
      events.push(scheduledToDisplayEvent(sa, `${sa.placeId}-lunch`));
    }
    if (d.dinnerSlot.activity) {
      const sa = d.dinnerSlot.activity;
      events.push(scheduledToDisplayEvent(sa, `${sa.placeId}-dinner`));
    }
    const sorted = sortEventsByTime(events);
    // Bookend airports: prepend arrival on Day 1, append departure on the
    // last day. Done after sorting so the airport events sit at the true
    // start / end positions regardless of activity times around them.
    if (d.dayIndex === 1 && flightConstraints?.day1Start && flightConstraints.day1AirportCode) {
      sorted.unshift(
        buildAirportEvent({
          dayIndex: d.dayIndex,
          reason: "arrival",
          airportCode: flightConstraints.day1AirportCode,
          time: flightConstraints.day1Start,
        })
      );
    }
    if (
      d.dayIndex === lastDayIndex &&
      flightConstraints?.lastDayEnd &&
      flightConstraints.lastDayAirportCode
    ) {
      sorted.push(
        buildAirportEvent({
          dayIndex: d.dayIndex,
          reason: "departure",
          airportCode: flightConstraints.lastDayAirportCode,
          time: flightConstraints.lastDayEnd,
        })
      );
    }
    return {
      day: d.dayIndex,
      date:
        baseDate && !Number.isNaN(baseDate.getTime())
          ? new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })
          : `Day ${d.dayIndex}`,
      emoji: EMOJIS[i % EMOJIS.length] ?? "✨",
      title: d.dayTheme?.trim() || `${tripName} · Day ${d.dayIndex}`,
      dayReasoning: d.dayReasoning?.trim() || undefined,
      flightNote: flightClampToNote(d),
      events: sorted,
    };
  });
}

function buildDisplayDaysFromEditRows(
  itinerary: Itinerary,
  tripName: string,
  startDateIso?: string,
  hotelsByDay?: Record<number, DayHotelRowAssignment>,
  flightConstraints?: FlightDayConstraints
): DisplayDay[] {
  const baseDate = startDateIso ? new Date(startDateIso) : null;
  const byKey = flattenScheduledActivitiesByKey(itinerary.days);
  const edit = itinerary.editRowsByDay ?? {};
  const lastDayIndex = itinerary.days.length;

  return itinerary.days.map((d, i) => {
    let rows = edit[String(d.dayIndex)];
    if (!rows?.length) {
      rows = buildDefaultEditRows(itinerary, tripName, startDateIso, hotelsByDay)[String(d.dayIndex)] ?? [];
    }
    const dayHotels = hotelsByDay?.[d.dayIndex];
    const events: DisplayDayEvent[] = [];
    for (const row of rows) {
      if (row.kind === "hotel") {
        // Pull location/placeId from the trip-level hotelsByDay map so
        // transit can use real coordinates. Prefer morning for hotel-start
        // rows and evening for hotel-end rows; fall back to row.placeId for
        // free-text edited rows.
        const isHotelStart = row.id.startsWith("hotel-start-");
        const isHotelEnd = row.id.startsWith("hotel-end-");
        const assigned = isHotelStart
          ? dayHotels?.morning
          : isHotelEnd
            ? dayHotels?.evening
            : undefined;
        // When the saved/edited row's placeId matches the assigned hotel, use
        // the assigned location. Otherwise honor whatever the row itself says
        // (free-text or manual edit may diverge).
        const placeIdForRow = row.placeId?.trim() || assigned?.placeId || "";
        const matchAssigned = assigned && assigned.placeId === placeIdForRow;
        events.push({
          id: row.id,
          time: "--",
          title: row.hotelLabel?.trim() ? row.hotelLabel : "Add your hotel",
          type: HOTEL_STYLE.type,
          categoryColor: HOTEL_STYLE.color,
          categoryBg: HOTEL_STYLE.bg,
          duration: "—",
          durationMinutes: 0,
          cost: "",
          votes: 0,
          image: null,
          isHotel: true,
          ...(placeIdForRow ? { detailPlaceId: placeIdForRow } : {}),
          ...(matchAssigned && assigned.location ? { location: assigned.location } : {}),
        });
        continue;
      }
      const key = lookupActivityKey(row);
      if (!key) continue;
      const sa = byKey.get(key);
      if (sa) {
        events.push(scheduledToDisplayEvent(sa, row.id));
        continue;
      }
      const pending = Boolean(row.placeId?.startsWith("pending-"));
      const hasRealPlace = Boolean(row.placeId && !pending);
      const meal = row.mealSlot === "lunch" || row.mealSlot === "dinner";
      // Editable stub, or AI/user-picked Google place not yet in the generated itinerary blocks.
      if (hasRealPlace || pending || row.isPlaceholder) {
        const title = row.activityLabel?.trim() ? row.activityLabel : "New activity";
        events.push({
          id: row.id,
          detailPlaceId: hasRealPlace ? row.placeId : undefined,
          time: "--",
          title,
          type: meal && hasRealPlace ? "🍜 Food" : "📍 Activity",
          categoryColor: meal && hasRealPlace ? "#FF4B4B" : "#AFAFAF",
          categoryBg: meal && hasRealPlace ? "#FFE5E5" : "#F7F7F7",
          duration: "—",
          durationMinutes: 60,
          cost: "$$",
          votes: 0,
          image: null,
          isPlaceholder: !hasRealPlace,
        });
      }
    }

    // Airport bookends — see comment in buildDisplayDaysFromBlocks. Edit-row
    // ordering is preserved (we never persist airports into editRowsByDay),
    // we just prepend / append at render time.
    if (d.dayIndex === 1 && flightConstraints?.day1Start && flightConstraints.day1AirportCode) {
      events.unshift(
        buildAirportEvent({
          dayIndex: d.dayIndex,
          reason: "arrival",
          airportCode: flightConstraints.day1AirportCode,
          time: flightConstraints.day1Start,
        })
      );
    }
    if (
      d.dayIndex === lastDayIndex &&
      flightConstraints?.lastDayEnd &&
      flightConstraints.lastDayAirportCode
    ) {
      events.push(
        buildAirportEvent({
          dayIndex: d.dayIndex,
          reason: "departure",
          airportCode: flightConstraints.lastDayAirportCode,
          time: flightConstraints.lastDayEnd,
        })
      );
    }

    return {
      day: d.dayIndex,
      date:
        baseDate && !Number.isNaN(baseDate.getTime())
          ? new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })
          : `Day ${d.dayIndex}`,
      emoji: EMOJIS[i % EMOJIS.length] ?? "✨",
      title: d.dayTheme?.trim() || `${tripName} · Day ${d.dayIndex}`,
      dayReasoning: d.dayReasoning?.trim() || undefined,
      flightNote: flightClampToNote(d),
      events,
    };
  });
}

/** One assigned hotel as it appears on a day's hotel-start / hotel-end edit row. */
export interface DayHotelRowAssignmentEntry {
  placeId: string;
  hotelLabel: string;
  /** Resolved Google Places coordinates for transit calculations. Optional —
   * the row still renders without them, just without an accurate transit leg. */
  location?: { lat: number; lng: number };
}

/** One day's hotel autofill: morning (wake-up) and evening (sleep) may differ on transition days. */
export interface DayHotelRowAssignment {
  morning?: DayHotelRowAssignmentEntry;
  evening?: DayHotelRowAssignmentEntry;
}

/**
 * Default edit rows: hotel (start) + activities in block order + hotel (end).
 *
 * `hotelsByDay` lets the caller pre-fill the hotel placeholder rows with the
 * hotels assigned to that day (from the trip's HOTELS section). Because hotel
 * stays use check-in/check-out semantics, on a transition day the morning
 * hotel (wake-up) and the evening hotel (sleep) are different — so the map
 * carries both per day. When a day isn't covered by any hotel the rows stay
 * empty (existing behavior).
 */
export function buildDefaultEditRows(
  itinerary: Itinerary,
  tripName: string,
  startDateIso?: string,
  hotelsByDay?: Record<number, DayHotelRowAssignment>
): Record<string, ItineraryEditRow[]> {
  const display = buildDisplayDaysFromBlocks(itinerary, tripName, startDateIso);
  const out: Record<string, ItineraryEditRow[]> = {};
  for (const d of display) {
    const rows: ItineraryEditRow[] = [];
    const dayHotels = hotelsByDay?.[d.day];
    const morning = dayHotels?.morning;
    const evening = dayHotels?.evening;
    rows.push({
      id: `hotel-start-${d.day}`,
      kind: "hotel",
      hotelLabel: morning?.hotelLabel ?? "",
      ...(morning?.placeId ? { placeId: morning.placeId } : {}),
    });
    for (const e of d.events) {
      const lunch = e.id.endsWith("-lunch");
      const dinner = e.id.endsWith("-dinner");
      const placeId = lunch || dinner ? e.id.replace(/-(lunch|dinner)$/, "") : e.id;
      rows.push({
        id: e.id,
        kind: "activity",
        placeId,
        mealSlot: lunch ? "lunch" : dinner ? "dinner" : undefined,
      });
    }
    rows.push({
      id: `hotel-end-${d.day}`,
      kind: "hotel",
      hotelLabel: evening?.hotelLabel ?? "",
      ...(evening?.placeId ? { placeId: evening.placeId } : {}),
    });
    out[String(d.day)] = rows;
  }
  return out;
}

/**
 * Convert a saved Itinerary to display-ready days (for Trip Plan and Trip Detail).
 */
export function itineraryToDisplayDays(
  itinerary: Itinerary,
  tripName: string,
  startDateIso?: string,
  hotelsByDay?: Record<number, DayHotelRowAssignment>,
  flightConstraints?: FlightDayConstraints
): DisplayDay[] {
  if (itinerary.editRowsByDay && Object.keys(itinerary.editRowsByDay).length > 0) {
    return buildDisplayDaysFromEditRows(
      itinerary,
      tripName,
      startDateIso,
      hotelsByDay,
      flightConstraints
    );
  }
  // No saved row order yet — but if hotels were added on the trip detail
  // screen we still want hotel-start / hotel-end rows in the display so the
  // user immediately sees "depart from hotel" / "back to hotel" framing.
  // Synthesize a default edit-row layout pre-filled with the assigned hotel
  // per day; falls through to the block-only display when no hotels exist.
  if (hotelsByDay && Object.keys(hotelsByDay).length > 0) {
    const synth: Itinerary = {
      ...itinerary,
      editRowsByDay: buildDefaultEditRows(itinerary, tripName, startDateIso, hotelsByDay),
    };
    return buildDisplayDaysFromEditRows(
      synth,
      tripName,
      startDateIso,
      hotelsByDay,
      flightConstraints
    );
  }
  return buildDisplayDaysFromBlocks(itinerary, tripName, startDateIso, flightConstraints);
}
