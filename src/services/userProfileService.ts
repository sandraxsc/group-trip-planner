import type { UserProfile } from "../types/userProfile";
import { cloudUpsertUserProfile, isUserProfileCloudEnabled } from "./userProfileCloudStore";

/**
 * Single-device user profile service.
 *
 * Storage strategy:
 * - Local storage (`STORAGE_KEY`) is the source of truth: synchronous reads,
 *   survives page reloads, available immediately on app start.
 * - Supabase cloud is a best-effort mirror — fire-and-forget on save so the
 *   UI never blocks waiting on the network.
 *
 * The profile is lazily-created (no row until the user submits the
 * onboarding form), so absence of a profile is the signal "show onboarding".
 */
const STORAGE_KEY = "userProfile.v1";

/** Trim, collapse interior whitespace, and clamp to a sane max length. */
function sanitizeName(raw: string): string {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  return collapsed.slice(0, 40);
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID — good enough for a
  // local device id; never used as a security boundary.
  return `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getUserProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    if (!parsed?.id || !parsed?.name) return null;
    return {
      id: String(parsed.id),
      name: String(parsed.name),
      createdAt: String(parsed.createdAt ?? new Date().toISOString()),
      updatedAt: String(parsed.updatedAt ?? new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

export function getUserName(fallback: string = "Traveler"): string {
  const p = getUserProfile();
  const name = p?.name?.trim();
  return name && name.length > 0 ? name : fallback;
}

/**
 * Two-letter avatar initials for the user.
 *
 * - Two or more words → first letter of first word + first letter of last word.
 * - Single word → first two letters.
 * - Empty / undefined → fallback "U".
 *
 * Always uppercase. Defensive against whitespace and emoji-only names.
 */
export function getInitialsFromName(name: string | undefined | null): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "U";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]!.charAt(0);
    const b = parts[parts.length - 1]!.charAt(0);
    return (a + b).toUpperCase();
  }
  return parts[0]!.slice(0, 2).toUpperCase();
}

/**
 * Persist a profile name to local storage and (best-effort) to Supabase.
 * Creates a profile on first save, updates the existing one otherwise.
 * Returns the resulting profile so callers can use the canonical id/timestamps.
 */
export function setUserProfile(name: string): UserProfile {
  if (typeof window === "undefined") {
    // SSR / non-browser: best we can do is return an in-memory record.
    return {
      id: generateId(),
      name: sanitizeName(name),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  const cleanName = sanitizeName(name);
  const existing = getUserProfile();
  const now = new Date().toISOString();
  const profile: UserProfile = existing
    ? { ...existing, name: cleanName, updatedAt: now }
    : { id: generateId(), name: cleanName, createdAt: now, updatedAt: now };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Storage may be unavailable (private mode quota, etc.) — non-fatal.
  }

  if (isUserProfileCloudEnabled()) {
    void cloudUpsertUserProfile(profile);
  }

  return profile;
}

export function hasCompletedOnboarding(): boolean {
  return getUserProfile() !== null;
}
