import type { CandidateActivity } from "../types/activity";
import { timeToMinutes } from "./timeUtils";

/**
 * Opening-hour helpers for the itinerary scheduler.
 *
 * Two pieces of data:
 *  - `Trip.startDate` → optional `YYYY-MM-DD`. Lets us map a 1-based dayIndex to a
 *    real weekday so we can honor weekday-specific closures.
 *  - `CandidateActivity.weeklyHours` → 7-entry array (0 = Sunday) of either `null`
 *    (closed all day) or `{start,end}[]` HH:mm windows.
 *
 * If either is missing, we degrade gracefully: weekday filtering is skipped and we
 * fall back to the older `openHours` single-window check (or no constraint at all).
 */

/** Get JS weekday (0=Sun..6=Sat) for a 1-based dayIndex relative to a YYYY-MM-DD start. */
export function weekdayForDayIndex(
  startDate: string | undefined,
  dayIndex: number
): number | null {
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null;
  if (!Number.isFinite(dayIndex) || dayIndex < 1) return null;
  const [y, m, d] = startDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  // Construct in local time so the weekday matches the user's perceived calendar day.
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + (dayIndex - 1));
  return date.getDay();
}

/** Resolve which opening windows apply to a given weekday for a candidate. */
export function getCandidateWindowsForWeekday(
  candidate: Pick<CandidateActivity, "weeklyHours" | "openHours">,
  weekday: number | null
): { start: string; end: string }[] | null {
  if (weekday !== null && Array.isArray(candidate.weeklyHours)) {
    const entry = candidate.weeklyHours[weekday];
    if (entry === null) return null;
    if (Array.isArray(entry) && entry.length > 0) return entry;
    // entry is undefined/empty → fall through to legacy openHours
  }
  if (candidate.openHours?.start && candidate.openHours?.end) {
    return [{ start: candidate.openHours.start, end: candidate.openHours.end }];
  }
  // No data → treat as always open.
  return [{ start: "00:00", end: "23:59" }];
}

/**
 * Determine if the candidate is operationally open on the given weekday at all.
 * Returns false ONLY when we have explicit weekly data showing it is closed; absence
 * of data returns true (we don't want to drop venues we have no info on).
 */
export function isVenueOpenOnWeekday(
  candidate: Pick<CandidateActivity, "weeklyHours" | "openHours">,
  weekday: number | null
): boolean {
  return getCandidateWindowsForWeekday(candidate, weekday) !== null;
}

/**
 * Intersect a `[blockStart, blockEnd)` window (HH:mm) with the candidate's available
 * opening windows for the given weekday. Returns the resulting allowed sub-windows
 * sorted ascending by start. Empty array means the candidate cannot be placed
 * anywhere inside the block (closed during it).
 */
export function intersectBlockWithVenueWindows(
  blockStart: string,
  blockEnd: string,
  candidate: Pick<CandidateActivity, "weeklyHours" | "openHours">,
  weekday: number | null
): { start: string; end: string }[] {
  const windows = getCandidateWindowsForWeekday(candidate, weekday);
  if (windows === null) return [];
  const bs = timeToMinutes(blockStart);
  const be = timeToMinutes(blockEnd);
  if (be <= bs) return [];
  const result: { start: string; end: string }[] = [];
  for (const w of windows) {
    const ws = timeToMinutes(w.start);
    const we = timeToMinutes(w.end);
    const start = Math.max(bs, ws);
    const end = Math.min(be, we);
    if (end - start >= 1) {
      result.push({
        start: minutesToHm(start),
        end: minutesToHm(end),
      });
    }
  }
  return result.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
}

/** Local helper: minutes-since-midnight → HH:mm (zero-padded hour). */
function minutesToHm(min: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.floor(min)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** True if a `[startTime, startTime+duration)` slot fits inside the venue's hours. */
export function slotFitsVenue(
  startTime: string,
  durationMinutes: number,
  candidate: Pick<CandidateActivity, "weeklyHours" | "openHours">,
  weekday: number | null
): boolean {
  const windows = getCandidateWindowsForWeekday(candidate, weekday);
  if (windows === null) return false;
  const sm = timeToMinutes(startTime);
  const em = sm + durationMinutes;
  for (const w of windows) {
    const ws = timeToMinutes(w.start);
    const we = timeToMinutes(w.end);
    if (sm >= ws && em <= we) return true;
  }
  return false;
}
