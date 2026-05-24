/**
 * Local user profile (the person using this device). Persisted in
 * localStorage and best-effort mirrored to Supabase. We deliberately keep
 * this minimal — no auth, no avatar URL — and let downstream features (trips,
 * preferences) reference the `name` field.
 */
export interface UserProfile {
  /** Stable random id assigned on first save; never changes for this device. */
  id: string;
  /** What the user typed in onboarding. Used as their display name everywhere. */
  name: string;
  /** ISO timestamp of first save. */
  createdAt: string;
  /** ISO timestamp of last update. */
  updatedAt: string;
}
