import type { Trip, TripInvite, TripMember } from "../types/trip";
import { getSupabaseClient } from "../config/supabaseClient";

type CloudResult<T> = { ok: true; data: T } | { ok: false; error: string };

function sb() {
  return getSupabaseClient();
}

export function isCloudEnabled(): boolean {
  return sb() != null;
}

export async function cloudCreateTripBundle(args: {
  trip: Trip;
  invite: TripInvite;
  owner: TripMember;
}): Promise<CloudResult<null>> {
  const client = sb();
  if (!client) return { ok: false, error: "Cloud disabled" };

  const { error: tripErr } = await client.from("trips").insert(args.trip);
  if (tripErr) return { ok: false, error: tripErr.message };

  const { error: inviteErr } = await client.from("trip_invites").insert(args.invite);
  if (inviteErr) return { ok: false, error: inviteErr.message };

  const { error: ownerErr } = await client.from("trip_members").insert(args.owner);
  if (ownerErr) return { ok: false, error: ownerErr.message };

  return { ok: true, data: null };
}

export async function cloudGetInviteByToken(token: string): Promise<CloudResult<TripInvite | null>> {
  const client = sb();
  if (!client) return { ok: false, error: "Cloud disabled" };

  const { data, error } = await client
    .from("trip_invites")
    .select("*")
    .eq("token", token)
    .eq("isActive", true)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data as TripInvite | null) ?? null };
}

export async function cloudGetTripById(tripId: string): Promise<CloudResult<Trip | null>> {
  const client = sb();
  if (!client) return { ok: false, error: "Cloud disabled" };

  const { data, error } = await client.from("trips").select("*").eq("id", tripId).maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data as Trip | null) ?? null };
}

export async function cloudGetTripMembers(tripId: string): Promise<CloudResult<TripMember[]>> {
  const client = sb();
  if (!client) return { ok: false, error: "Cloud disabled" };

  const { data, error } = await client.from("trip_members").select("*").eq("tripId", tripId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data as TripMember[]) ?? [] };
}

export async function cloudAddTripMember(member: TripMember): Promise<CloudResult<null>> {
  const client = sb();
  if (!client) return { ok: false, error: "Cloud disabled" };

  const { error } = await client.from("trip_members").insert(member);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

