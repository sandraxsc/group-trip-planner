/** Parse "h:mm AM/PM" labels into minutes-since-midnight. */
export function parseTimeLabelToMinutes(label: string): number {
  if (!label?.trim() || label === "--") return 9 * 60;
  const [timePart, periodRaw] = label.split(" ");
  const period = periodRaw?.toUpperCase() ?? "AM";
  const [hRaw, mRaw] = (timePart ?? "00:00").split(":");
  let h = Number(hRaw);
  const m = Number(mRaw);
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

export function minutesToTimeLabel(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  const period = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 || 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${period}`;
}

export function dayReasoningBullets(text: string): string[] {
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);

  if (lines.length > 1) return lines.slice(0, 2);

  return text
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 2);
}
