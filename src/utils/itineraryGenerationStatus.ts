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
