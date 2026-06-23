export const MAX_REGEN_COUNT = 5;

export type RegenCapReachedError = {
  code: "REGEN_CAP_REACHED";
  message: string;
};

export function isRegenCapReachedError(err: unknown): err is RegenCapReachedError {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as RegenCapReachedError).code === "REGEN_CAP_REACHED"
  );
}

export function remainingRegenerations(regenCount: number): number {
  return Math.max(0, MAX_REGEN_COUNT - (regenCount ?? 0));
}

export function isRegenCapReached(regenCount: number): boolean {
  return (regenCount ?? 0) >= MAX_REGEN_COUNT;
}

export function regenCapMessage(): string {
  return "Plan limit reached — you've used all 5 generations for this trip.";
}

/** Label shown near Generate / Regenerate buttons. Returns null when cap is reached (caller shows cap message). */
export function regenCounterLabel(regenCount: number): string | null {
  if (isRegenCapReached(regenCount)) return null;
  const n = remainingRegenerations(regenCount);
  const copy = `${n} of ${MAX_REGEN_COUNT} free regenerations left`;
  if (n === 1) return `${copy} — use it wisely`;
  return copy;
}

/** Inline copy for the outdated banner body. */
export function regenRemainingBannerFragment(regenCount: number): string {
  if (isRegenCapReached(regenCount)) return regenCapMessage();
  const n = remainingRegenerations(regenCount);
  return `${n} of ${MAX_REGEN_COUNT} free regenerations left`;
}
