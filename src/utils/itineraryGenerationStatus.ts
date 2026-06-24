/** Trip-scoped in-flight itinerary generation (survives navigation). */

const inflightTripIds = new Set<string>();
const inflightPromises = new Map<string, Promise<unknown>>();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function isItineraryGenerating(tripId: string): boolean {
  return inflightTripIds.has(tripId);
}

export function subscribeItineraryGenerating(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Run generation work once per trip. Concurrent callers share the same promise.
 */
export async function runTrackedItineraryGeneration<T>(
  tripId: string,
  fn: () => Promise<T>
): Promise<T> {
  const existing = inflightPromises.get(tripId);
  if (existing) return existing as Promise<T>;

  inflightTripIds.add(tripId);
  emit();

  const promise = (async () => {
    try {
      return await fn();
    } finally {
      inflightTripIds.delete(tripId);
      inflightPromises.delete(tripId);
      emit();
    }
  })();

  inflightPromises.set(tripId, promise);
  return promise;
}

// ─── Day insight streaming progress ──────────────────────────────────────────

/** A completed day insight received during streaming generation. */
export type DayInsightProgress = {
  dayNumber: number;
  theme: string;
  dayReasoning: string;
};

const insightProgress = new Map<string, DayInsightProgress[]>();
const insightListeners = new Set<(tripId: string) => void>();

export function getInsightProgress(tripId: string): DayInsightProgress[] {
  return insightProgress.get(tripId) ?? [];
}

export function subscribeInsightProgress(listener: (tripId: string) => void): () => void {
  insightListeners.add(listener);
  return () => insightListeners.delete(listener);
}

export function emitDayInsightProgress(tripId: string, day: DayInsightProgress): void {
  const current = insightProgress.get(tripId) ?? [];
  const idx = current.findIndex((d) => d.dayNumber === day.dayNumber);
  const next = [...current];
  if (idx >= 0) next[idx] = day;
  else next.push(day);
  next.sort((a, b) => a.dayNumber - b.dayNumber);
  insightProgress.set(tripId, next);
  for (const l of insightListeners) l(tripId);
}

export function clearInsightProgress(tripId: string): void {
  insightProgress.delete(tripId);
  for (const l of insightListeners) l(tripId);
}
