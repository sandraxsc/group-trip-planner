import type { MemberPreference } from "../../types/preference";

export const PREF_BUDGET_LABELS: Record<string, string> = {
  budget: "Budget",
  moderate: "Moderate",
  luxury: "Luxury",
};

export const PREF_ENERGY_LABELS: Record<string, string> = {
  low: "Peaceful",
  medium: "Balanced",
  high: "High energy",
};

export const PREF_ACTIVITY_LABELS: Record<string, string> = {
  beach: "Beach",
  hiking: "Hiking",
  culture: "Culture",
  food: "Food",
  nightlife: "Nightlife",
  shopping: "Shopping",
  spa: "Wellness",
  adventure: "Adventure",
  photography: "Photography",
  wildlife: "Wildlife",
  history: "History",
  other: "Other",
};

export type PreferenceDisplayRow = {
  label: string;
  value: string;
  kind: "text";
};

/** Summary rows for profile — excludes must-see places (use a dedicated link). */
export function formatPreferenceSummaryRows(
  pref: MemberPreference | null
): PreferenceDisplayRow[] {
  if (!pref) return [];

  const rows: PreferenceDisplayRow[] = [];

  if (pref.budgetLevel) {
    rows.push({
      label: "Budget",
      value: PREF_BUDGET_LABELS[pref.budgetLevel] ?? pref.budgetLevel,
      kind: "text",
    });
  }
  if (pref.energyLevel) {
    rows.push({
      label: "Energy",
      value: PREF_ENERGY_LABELS[pref.energyLevel] ?? pref.energyLevel,
      kind: "text",
    });
  }
  if (pref.activeHours?.start && pref.activeHours?.end) {
    rows.push({
      label: "Active hours",
      value: `${pref.activeHours.start} – ${pref.activeHours.end}`,
      kind: "text",
    });
  }
  const activities = (pref.activityTypes ?? [])
    .filter((id) => id !== "other")
    .map((id) => PREF_ACTIVITY_LABELS[id] ?? id);
  if (pref.activityTypesOther?.trim()) {
    activities.push(pref.activityTypesOther.trim());
  }
  if (activities.length > 0) {
    rows.push({ label: "Interests", value: activities.join(", "), kind: "text" });
  }
  const dealBreakerParts = (pref.dealBreakers ?? []).flatMap((d) => {
    const tags = [...d.tags];
    if (d.note?.trim()) tags.push(d.note.trim());
    return tags;
  });
  if (dealBreakerParts.length > 0) {
    rows.push({ label: "Deal breakers", value: dealBreakerParts.join(", "), kind: "text" });
  }
  if (pref.mbti !== undefined) {
    rows.push({ label: "MBTI", value: pref.mbti ?? "Skipped", kind: "text" });
  }

  return rows;
}

export function isLikelyGooglePlaceId(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.includes(" ") && trimmed.length < 48) return false;
  return /^[A-Za-z0-9_-]{12,}$/.test(trimmed);
}

export function displayLabelForPlaceToken(
  token: string,
  resolvedNames: Record<string, string>
): string {
  const trimmed = token.trim();
  if (!trimmed) return "Unknown place";
  return resolvedNames[trimmed] ?? (isLikelyGooglePlaceId(trimmed) ? "Place" : trimmed);
}
