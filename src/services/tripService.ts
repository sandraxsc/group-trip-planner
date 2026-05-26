import type { Trip, TripInvite, TripMember } from "../types/trip";
import {
  cloudAddTripMember,
  cloudCreateTripBundle,
  cloudGetInviteByToken,
  cloudGetTripById,
  cloudGetTripMembers,
  cloudUpdateMemberPreferenceStatus,
  cloudUpdateTrip,
  isCloudEnabled,
} from "./tripCloudStore";

const STORAGE_KEYS = {
  TRIPS: "trips",
  TRIP_INVITES: "tripInvites",
  TRIP_MEMBERS: "tripMembers",
} as const;

function getTripsStorage(): Trip[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRIPS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setTripsStorage(trips: Trip[]) {
  localStorage.setItem(STORAGE_KEYS.TRIPS, JSON.stringify(trips));
}

function getInvitesStorage(): TripInvite[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRIP_INVITES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setInvitesStorage(invites: TripInvite[]) {
  localStorage.setItem(STORAGE_KEYS.TRIP_INVITES, JSON.stringify(invites));
}

function getMembersStorage(): TripMember[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRIP_MEMBERS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setMembersStorage(members: TripMember[]) {
  localStorage.setItem(STORAGE_KEYS.TRIP_MEMBERS, JSON.stringify(members));
}

function upsertTripLocal(trip: Trip) {
  const trips = getTripsStorage();
  const idx = trips.findIndex((t) => t.id === trip.id);
  if (idx === -1) trips.unshift(trip);
  else trips[idx] = { ...trips[idx], ...trip };
  setTripsStorage(trips);
}

function upsertInviteLocal(invite: TripInvite) {
  const invites = getInvitesStorage();
  const idx = invites.findIndex((i) => i.token === invite.token);
  if (idx === -1) invites.push(invite);
  else invites[idx] = { ...invites[idx], ...invite };
  setInvitesStorage(invites);
}

function upsertMembersLocal(tripId: string, incoming: TripMember[]) {
  if (!incoming.length) return;
  const existing = getMembersStorage();
  const byId = new Map(existing.map((m) => [m.id, m]));
  for (const m of incoming) {
    if (m.tripId !== tripId) continue;
    const prev = byId.get(m.id);
    byId.set(m.id, prev ? { ...prev, ...m } : m);
  }
  setMembersStorage(Array.from(byId.values()));
}

function hydrateLocalTripBundle(bundle: { trip: Trip; invite: TripInvite; members: TripMember[] }) {
  upsertTripLocal(bundle.trip);
  upsertInviteLocal(bundle.invite);
  upsertMembersLocal(bundle.trip.id, bundle.members);
}

function generateId(): string {
  return crypto.randomUUID?.() ?? `t-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function generateToken(): string {
  return `inv-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function getJoinUrlBase(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/join`;
}

/**
 * Create a new trip with default invite and owner as first member.
 * Trip name is generated as "${destination} Trip".
 * maxGuests controls how many members can join (including owner); falls back to MAX_TRIP_MEMBERS.
 * tripDays controls how many days the trip spans; used for itinerary summaries.
 */
export function createTrip(
  destination: string,
  ownerName: string,
  maxGuests?: number,
  tripDays?: number,
  startDate?: string
): Trip {
  const trimmed = destination.trim();
  if (!trimmed) throw new Error("Destination is required");

  const tripId = generateId();
  const now = new Date().toISOString();
  const name = `${trimmed} Trip`;

  const trip: Trip = {
    id: tripId,
    name,
    destination: trimmed,
    tripDays: tripDays && tripDays > 0 ? tripDays : undefined,
    maxGuests: maxGuests && maxGuests > 0 ? Math.min(maxGuests, MAX_TRIP_MEMBERS) : undefined,
    startDate: startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : undefined,
    createdAt: now,
  };

  const token = generateToken();
  const joinUrl = `${getJoinUrlBase()}/${token}`;

  const invite: TripInvite = {
    tripId,
    token,
    joinUrl,
    createdAt: now,
    isActive: true,
  };

  const ownerId = generateId();
  const owner: TripMember = {
    id: ownerId,
    tripId,
    name: ownerName,
    joinedAt: now,
    role: "owner",
    preferenceStatus: "not_started",
  };

  const trips = getTripsStorage();
  trips.unshift(trip);
  setTripsStorage(trips);

  const invites = getInvitesStorage();
  invites.push(invite);
  setInvitesStorage(invites);

  const members = getMembersStorage();
  members.push(owner);
  setMembersStorage(members);

  // Best-effort cloud sync (enables cross-device invites when Supabase env vars are set).
  // This is intentionally fire-and-forget so the UI remains snappy.
  if (isCloudEnabled()) {
    void cloudCreateTripBundle({ trip, invite, owner });
  }

  return trip;
}

export function getTrips(): Trip[] {
  const trips = getTripsStorage();
  return [...trips].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
}

export function getTripById(tripId: string): Trip | null {
  const trips = getTripsStorage();
  return trips.find((t) => t.id === tripId) ?? null;
}

export function getInviteByTripId(tripId: string): TripInvite | null {
  const invites = getInvitesStorage();
  return invites.find((i) => i.tripId === tripId && i.isActive) ?? null;
}

export function getInviteByToken(token: string): TripInvite | null {
  const invites = getInvitesStorage();
  return invites.find((i) => i.token === token && i.isActive) ?? null;
}

export function getTripMembers(tripId: string): TripMember[] {
  const members = getMembersStorage();
  return members
    .filter((m) => m.tripId === tripId)
    .map((m) => ({
      ...m,
      preferenceStatus: m.preferenceStatus ?? "not_started",
    }));
}

/** Max member seats per trip; when full, invite step is complete and Invite+ is disabled */
export const MAX_TRIP_MEMBERS = 6;

/**
 * Patch editable fields on a trip (title / days / guest capacity / start date /
 * destination). Persists to localStorage immediately and best-effort syncs to
 * Supabase. Returns the updated Trip, or `null` if no trip with that id exists.
 *
 * Validation is intentionally permissive — caller is expected to clamp values
 * (e.g. max guests vs current member count) before calling. We only sanitize
 * obvious junk (empty title, zero/negative days, oversized guests).
 */
export function updateTrip(
  tripId: string,
  patch: Partial<Pick<Trip, "name" | "tripDays" | "maxGuests" | "startDate" | "destination">>
): Trip | null {
  const trips = getTripsStorage();
  const idx = trips.findIndex((t) => t.id === tripId);
  if (idx === -1) return null;

  const sanitized: Partial<Trip> = {};
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (trimmed) sanitized.name = trimmed;
  }
  if (patch.destination !== undefined) {
    const trimmed = patch.destination.trim();
    if (trimmed) sanitized.destination = trimmed;
  }
  if (patch.tripDays !== undefined) {
    if (patch.tripDays > 0 && Number.isFinite(patch.tripDays)) {
      sanitized.tripDays = Math.round(patch.tripDays);
    }
  }
  if (patch.maxGuests !== undefined) {
    if (patch.maxGuests > 0 && Number.isFinite(patch.maxGuests)) {
      sanitized.maxGuests = Math.min(Math.round(patch.maxGuests), MAX_TRIP_MEMBERS);
    }
  }
  if (patch.startDate !== undefined) {
    if (patch.startDate && /^\d{4}-\d{2}-\d{2}$/.test(patch.startDate)) {
      sanitized.startDate = patch.startDate;
    }
  }

  if (!Object.keys(sanitized).length) return trips[idx];

  const updated: Trip = { ...trips[idx], ...sanitized };
  trips[idx] = updated;
  setTripsStorage(trips);

  if (isCloudEnabled()) {
    void cloudUpdateTrip({ tripId, patch: sanitized });
  }

  return updated;
}

export function updateMemberPreferenceStatus(
  memberId: string,
  status: TripMember["preferenceStatus"]
): void {
  const members = getMembersStorage();
  const idx = members.findIndex((m) => m.id === memberId);
  if (idx === -1) return;
  const updated = { ...members[idx], preferenceStatus: status };
  members[idx] = updated;
  setMembersStorage(members);

  if (isCloudEnabled()) {
    void cloudUpdateMemberPreferenceStatus({
      memberId: updated.id,
      tripId: updated.tripId,
      preferenceStatus: status,
    });
  }
}

export function addTripMember(tripId: string, name: string): TripMember {
  const members = getMembersStorage();
  const currentCount = members.filter((m) => m.tripId === tripId).length;
  const trip = getTripById(tripId);
  const capacity = trip?.maxGuests && trip.maxGuests > 0 ? trip.maxGuests : MAX_TRIP_MEMBERS;
  if (currentCount >= capacity) {
    throw new Error("Trip is full");
  }
  const now = new Date().toISOString();
  const newMember: TripMember = {
    id: generateId(),
    tripId,
    name,
    joinedAt: now,
    role: "member",
    preferenceStatus: "not_started",
  };
  members.push(newMember);
  setMembersStorage(members);

  if (isCloudEnabled()) {
    void cloudAddTripMember(newMember);
  }

  return newMember;
}

/**
 * Cloud-first helpers used by the join page so invite links work across devices.
 * Falls back to localStorage when Supabase isn't configured.
 */
export async function resolveInviteBundleByToken(
  token: string
): Promise<{ invite: TripInvite | null; trip: Trip | null; members: TripMember[] }> {
  // If cloud is enabled, try it first. If it fails, gracefully fall back to local.
  if (isCloudEnabled()) {
    const inv = await cloudGetInviteByToken(token);
    if (inv.ok && inv.data) {
      const tripId = inv.data.tripId;
      const [tripRes, membersRes] = await Promise.all([cloudGetTripById(tripId), cloudGetTripMembers(tripId)]);
      const trip = tripRes.ok ? tripRes.data : null;
      const members = membersRes.ok ? membersRes.data : [];
      if (trip) {
        try {
          hydrateLocalTripBundle({ invite: inv.data, trip, members });
        } catch {
          // ignore localStorage failures (private mode etc.)
        }
        return { invite: inv.data, trip, members };
      }
    }
  }

  // Local fallback
  const invite = getInviteByToken(token);
  const trip = invite ? getTripById(invite.tripId) : null;
  const members = trip ? getTripMembers(trip.id) : [];
  return { invite, trip, members };
}

/**
 * Permanently delete a trip and all related data from localStorage.
 * Does not clear sessionStorage; caller should clear currentTripId/currentMemberId if needed.
 */
export function deleteTrip(tripId: string): void {
  const trips = getTripsStorage().filter((t) => t.id !== tripId);
  setTripsStorage(trips);

  const members = getMembersStorage().filter((m) => m.tripId !== tripId);
  setMembersStorage(members);

  const invites = getInvitesStorage().filter((i) => i.tripId !== tripId);
  setInvitesStorage(invites);
}
