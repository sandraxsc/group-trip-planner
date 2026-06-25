import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  Clock,
  Home,
  Hotel as HotelIcon,
  Plane,
  Plus,
} from "lucide-react";
import type { TripFlight, TripHotel, TripMember } from "../../types/trip";
import { DuoAvatar } from "./DuoAvatar";
import type { DuoAvatarColorKey } from "./DuoAvatar";
import { DuoBadge } from "./DuoBadge";

/**
 * "Logistics" tab on the trip detail screen — displays the shared hotel
 * stay(s) and one flight per trip member. Pure presentation: all CRUD state
 * (sheets, form fields, validation) lives in TripDetailScreen, and this
 * component fires callbacks back up.
 *
 * The bottom "arrival insight" card surfaces the latest known arrival time
 * across all entered flights so the planner / user can avoid scheduling
 * Day 1 activities before everyone has actually landed.
 */
interface LogisticsTabProps {
  // Hotel ─────────────────────────────────────────────────────
  hotels: TripHotel[];
  tripDays: number;
  onAddHotel: () => void;
  onEditHotel: (hotel: TripHotel) => void;
  // Flights ───────────────────────────────────────────────────
  members: TripMember[];
  flights: TripFlight[];
  /** Opens the flight sheet in "add" mode — the sheet itself picks who. */
  onAddFlight: () => void;
  onEditFlight: (flightId: string) => void;
  /**
   * Personal-view host toggle. When provided, the flights section shows a
   * "I live here" option and a "Local host" status card when enabled.
   */
  isViewerHost?: boolean;
  onToggleViewerHost?: () => void;
  /** Member IDs who are local hosts — used in the group view to show host cards. */
  hostMemberIds?: string[];
}

const FLIGHT_AVATAR_COLORS: DuoAvatarColorKey[] = ["green", "blue", "coral", "amber"];

function avatarColorFor(index: number): DuoAvatarColorKey {
  return FLIGHT_AVATAR_COLORS[index % FLIGHT_AVATAR_COLORS.length] ?? "green";
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatFlightDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Pick the latest "HH:MM" string across the given arriving flights,
 * lexicographically (24-hour times sort correctly as strings). Returns
 * `null` if no arriving flight has an arrivalTime. Departure rows are
 * intentionally excluded — the insight card is about Day 1 schedule slack.
 */
function latestArrival(flights: TripFlight[]): string | null {
  let latest: string | null = null;
  for (const f of flights) {
    if (f.direction !== "arrival") continue;
    const t = f.arrivalTime?.trim();
    if (!t) continue;
    if (!latest || t > latest) latest = t;
  }
  return latest;
}

/* ─────────────────────────────────────────────────────────────────────────
   HOTEL SECTION
   ───────────────────────────────────────────────────────────────────────── */
function HotelSection({
  hotels,
  onAddHotel,
  onEditHotel,
  isViewerHost = false,
}: {
  hotels: TripHotel[];
  onAddHotel: () => void;
  onEditHotel: (h: TripHotel) => void;
  isViewerHost?: boolean;
}) {
  const hasAny = hotels.length > 0;

  return (
    <section>
      {/* Section header — orange hotel icon, bold black "HOTELS" title, blue
          "Add +" link on the right (matches the legacy in-app design system). */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <HotelIcon size={20} className="text-[#FF9600]" />
          <h2 className="font-black text-[#3C3C3C] text-base">HOTELS</h2>
        </div>
        <button
          type="button"
          onClick={onAddHotel}
          className="duo-focusable text-[#1CB0F6] font-bold text-sm cursor-pointer"
          style={{ touchAction: "manipulation" }}
        >
          Add +
        </button>
      </div>

      {hasAny ? (
        <div className="flex flex-col gap-2">
          {hotels.map((hotel) => {
            const nights = Math.max(0, hotel.dayEnd - hotel.dayStart);
            return (
              <div
                key={hotel.id}
                role="button"
                tabIndex={0}
                aria-label={`Edit hotel ${hotel.name}`}
                onClick={() => onEditHotel(hotel)}
                onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onEditHotel(hotel);
                  }
                }}
                className="duo-focusable bg-white border-2 border-[#58CC02] shadow-[0_4px_0_#C8EDA0] rounded-2xl p-4 cursor-pointer active:translate-y-0.5 active:shadow-none transition-all duration-[150ms]"
                style={{ touchAction: "manipulation" }}
              >
                <div className="flex items-center gap-2">
                  <HotelIcon size={18} className="text-[#FF9600] flex-shrink-0" />
                  <div className="flex-1 min-w-0 font-black text-[15px] text-[#3C3C3C] truncate">
                    {hotel.name}
                  </div>
                  <DuoBadge label="✓ Added" variant="done" />
                </div>

                <div className="flex items-center gap-3 mt-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-normal text-[10px] text-[#777777] uppercase tracking-[0.06em]">
                      CHECK IN
                    </div>
                    <div className="font-bold text-[14px] text-[#3C3C3C]">
                      Day {hotel.dayStart}
                    </div>
                  </div>
                  <span aria-hidden className="text-[#AFAFAF] font-bold text-[16px]">→</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-normal text-[10px] text-[#777777] uppercase tracking-[0.06em]">
                      CHECK OUT
                    </div>
                    <div className="font-bold text-[14px] text-[#3C3C3C]">
                      Day {hotel.dayEnd}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <div className="font-normal text-[10px] text-[#777777] uppercase tracking-[0.06em]">
                      NIGHTS
                    </div>
                    <div className="font-bold text-[14px] text-[#3C3C3C]">
                      {nights} night{nights === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Empty state — left-aligned dashed card with a rounded plus icon
        // tile, bold "Add a hotel" title, and a wrapping subtitle. Matches
        // the design system used in the legacy hotel section.
        <button
          type="button"
          onClick={onAddHotel}
          className="duo-focusable w-full border-2 border-dashed border-[#E5E5E5] rounded-2xl p-4 flex items-center gap-3 active:translate-y-0.5 transition-all text-left"
          style={{ touchAction: "manipulation" }}
        >
          <div className="w-10 h-10 rounded-xl border-2 border-[#E5E5E5] flex items-center justify-center flex-shrink-0">
            <Plus size={20} className="text-[#AFAFAF]" strokeWidth={3} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-[#3C3C3C] text-sm">
              {isViewerHost ? "Staying with the group?" : "Add a hotel"}
            </p>
            <p className="font-bold text-[#AFAFAF] text-xs">
              {isViewerHost
                ? "Optional · add a hotel if you're joining friends at their stay"
                : "Set check-in/out so trip plans start & end at your stay"}
            </p>
          </div>
        </button>
      )}
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   FLIGHTS SECTION

   Mirrors the Hotel section visually: orange-equivalent (blue) section icon,
   bold black title, blue "Add +" link, dashed empty state, and one card per
   saved flight. Each saved flight card shows the member it belongs to (avatar
   + name) so the user can tell whose ticket it is when several are listed.
   ───────────────────────────────────────────────────────────────────────── */
function FlightCard({
  flight,
  member,
  memberIndex,
  onEditFlight,
}: {
  flight: TripFlight;
  member: TripMember;
  memberIndex: number;
  onEditFlight: (flightId: string) => void;
}) {
  // Animate the dashed route line + plane icon from 0 → 100% width on mount.
  const [routeProgress, setRouteProgress] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setRouteProgress(1));
    return () => cancelAnimationFrame(id);
  }, [flight.id]);

  const colorKey = avatarColorFor(memberIndex);
  const initials = getInitials(member.name);

  // Sublabel: "Mar 4 · Delta DL273 · lands 14:30" (or "departs 09:15" for
  // outbound rows).
  // Airline + flight number are both optional labels — skip whichever is
  // missing so the sublabel doesn't show stray separators like "Mar 4 ·  · …".
  const airline = flight.airline?.trim();
  const flightNumber = flight.flightNumber?.trim();
  const airlineLabel = airline && flightNumber
    ? `${airline} ${flightNumber}`
    : airline || flightNumber || "";
  const sublabelParts = [formatFlightDate(flight.date)];
  if (airlineLabel) sublabelParts.push(airlineLabel);
  if (flight.arrivalTime) {
    sublabelParts.push(
      flight.direction === "arrival"
        ? `lands ${flight.arrivalTime}`
        : `departs ${flight.arrivalTime}`
    );
  }
  const directionLabel = flight.direction === "arrival" ? "Arriving" : "Departing";

  return (
    <div className="bg-white border-2 border-[#58CC02] shadow-[0_4px_0_#C8EDA0] rounded-2xl p-4 flex items-center gap-3">
      <DuoAvatar initials={initials} colorKey={colorKey} size="md" />
      <div className="flex-1 min-w-0">
        <div className="font-bold text-[11px] text-[#777777] truncate">
          {member.name} · {directionLabel}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="font-black text-[16px] text-[#3C3C3C]">{flight.origin}</span>
          <div className="flex-1 border-t border-dashed border-[#AFAFAF] mx-2 relative h-0">
            <div
              className="absolute top-0 left-0 border-t-2 border-[#58CC02] h-0"
              style={{
                width: `${routeProgress * 100}%`,
                transition: "width 400ms ease-out",
              }}
            />
            <Plane
              size={14}
              className="text-[#1CB0F6] absolute top-0 -translate-y-1/2"
              style={{
                left: `${routeProgress * 100}%`,
                transform: "translate(-50%, -50%)",
                transition: "left 400ms ease-out",
              }}
            />
          </div>
          <span className="font-black text-[16px] text-[#3C3C3C]">{flight.destination}</span>
        </div>
        <div className="font-normal text-[11px] text-[#777777] mt-0.5 truncate">
          {sublabelParts.join(" · ")}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onEditFlight(flight.id)}
        className="duo-focusable text-[#1CB0F6] font-bold text-[13px] cursor-pointer flex-shrink-0"
        style={{ touchAction: "manipulation" }}
      >
        Edit
      </button>
    </div>
  );
}

function LocalHostCard({
  onAddFlightAnyway,
  onRemoveHost,
}: {
  onAddFlightAnyway: () => void;
  onRemoveHost: () => void;
}) {
  return (
    <div className="bg-white border-2 border-[#58CC02] shadow-[0_4px_0_#C8EDA0] rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#F0FDE4] flex items-center justify-center flex-shrink-0">
          <Home size={20} className="text-[#58CC02]" strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-[#3C3C3C] text-sm leading-tight">Local host</p>
          <p className="font-bold text-[#777777] text-xs mt-0.5">No flight needed · you live here</p>
        </div>
        <DuoBadge label="✓ Set" variant="done" />
      </div>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#E5E5E5]">
        <button
          type="button"
          onClick={onAddFlightAnyway}
          className="duo-focusable text-[#1CB0F6] font-bold text-xs cursor-pointer"
          style={{ touchAction: "manipulation" }}
        >
          Add a departure flight
        </button>
        <button
          type="button"
          onClick={onRemoveHost}
          className="duo-focusable text-[#AFAFAF] font-bold text-xs cursor-pointer ml-auto"
          style={{ touchAction: "manipulation" }}
        >
          I need a flight
        </button>
      </div>
    </div>
  );
}

function FlightsSection({
  members,
  flights,
  onAddFlight,
  onEditFlight,
  isViewerHost = false,
  onToggleViewerHost,
  hostMemberIds = [],
}: {
  members: TripMember[];
  flights: TripFlight[];
  onAddFlight: () => void;
  onEditFlight: (flightId: string) => void;
  isViewerHost?: boolean;
  onToggleViewerHost?: () => void;
  hostMemberIds?: string[];
}) {
  // Members who need flights but haven't added one yet (exclude hosts).
  const hostSet = new Set(hostMemberIds);
  const missingMembers = members.filter(
    (m) => !hostSet.has(m.id) && !flights.some((f) => f.memberId === m.id)
  );
  const missingMemberLabel =
    missingMembers.length === 0
      ? null
      : missingMembers.length <= 2
        ? `Waiting on ${missingMembers.map((m) => m.name).join(" & ")}`
        : `Waiting on ${missingMembers[0]!.name} +${missingMembers.length - 1}`;

  const memberIndexById = new Map<string, number>();
  members.forEach((m, i) => memberIndexById.set(m.id, i));

  const hasFlights = flights.length > 0;

  // Host members in the group view who have no flight.
  const hostMembersWithNoFlight = members.filter(
    (m) => hostSet.has(m.id) && !flights.some((f) => f.memberId === m.id)
  );

  const showPersonalEmptyState = !hasFlights && !isViewerHost;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Plane size={20} className="text-[#1CB0F6]" />
          <h2 className="font-black text-[#3C3C3C] text-base">FLIGHTS</h2>
        </div>
        {(!isViewerHost || hasFlights) && (
          <button
            type="button"
            onClick={onAddFlight}
            className="duo-focusable text-[#1CB0F6] font-bold text-sm cursor-pointer"
            style={{ touchAction: "manipulation" }}
          >
            Add +
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {/* Personal host status card */}
        {isViewerHost && (
          <LocalHostCard
            onAddFlightAnyway={onAddFlight}
            onRemoveHost={onToggleViewerHost ?? (() => {})}
          />
        )}

        {/* Group-view host member cards */}
        {hostMembersWithNoFlight.map((m, i) => (
          <div
            key={m.id}
            className="bg-white border-2 border-[#E5E5E5] rounded-2xl p-3 flex items-center gap-3"
          >
            <DuoAvatar
              initials={getInitials(m.name)}
              colorKey={avatarColorFor(memberIndexById.get(m.id) ?? i)}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[#777777] text-[11px]">{m.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Home size={12} className="text-[#58CC02]" strokeWidth={2.5} />
                <p className="font-black text-[#3C3C3C] text-[13px]">Local host · no flight</p>
              </div>
            </div>
          </div>
        ))}

        {/* Flight cards */}
        {flights.map((f) => {
          const member = members.find((m) => m.id === f.memberId);
          if (!member) return null;
          return (
            <FlightCard
              key={f.id}
              flight={f}
              member={member}
              memberIndex={memberIndexById.get(f.memberId) ?? 0}
              onEditFlight={onEditFlight}
            />
          );
        })}

        {/* Personal empty state — two options: add flight OR mark as host */}
        {showPersonalEmptyState && onToggleViewerHost !== undefined && (
          <>
            <button
              type="button"
              onClick={onAddFlight}
              className="duo-focusable w-full border-2 border-dashed border-[#E5E5E5] rounded-2xl p-4 flex items-center gap-3 active:translate-y-0.5 transition-all text-left"
              style={{ touchAction: "manipulation" }}
            >
              <div className="w-10 h-10 rounded-xl border-2 border-[#E5E5E5] flex items-center justify-center flex-shrink-0">
                <Plane size={18} className="text-[#AFAFAF]" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-[#3C3C3C] text-sm">Add a flight</p>
                <p className="font-bold text-[#AFAFAF] text-xs">
                  We&apos;ll plan Day 1 around your landing time
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={onToggleViewerHost}
              className="duo-focusable w-full border-2 border-dashed border-[#E5E5E5] rounded-2xl p-4 flex items-center gap-3 active:translate-y-0.5 transition-all text-left"
              style={{ touchAction: "manipulation" }}
            >
              <div className="w-10 h-10 rounded-xl border-2 border-[#E5E5E5] flex items-center justify-center flex-shrink-0">
                <Home size={18} className="text-[#AFAFAF]" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-[#3C3C3C] text-sm">I live here — no flight needed</p>
                <p className="font-bold text-[#AFAFAF] text-xs">
                  Mark yourself as the local host
                </p>
              </div>
            </button>
          </>
        )}

        {/* Group empty state (no personal toggle) */}
        {showPersonalEmptyState && onToggleViewerHost === undefined && (
          <button
            type="button"
            onClick={onAddFlight}
            className="duo-focusable w-full border-2 border-dashed border-[#E5E5E5] rounded-2xl p-4 flex items-center gap-3 active:translate-y-0.5 transition-all text-left"
            style={{ touchAction: "manipulation" }}
          >
            <div className="w-10 h-10 rounded-xl border-2 border-[#E5E5E5] flex items-center justify-center flex-shrink-0">
              <Plus size={20} className="text-[#AFAFAF]" strokeWidth={3} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-[#3C3C3C] text-sm">Add a flight</p>
              <p className="font-bold text-[#AFAFAF] text-xs">
                Pick a guest (or all) so we can plan around landing times
              </p>
            </div>
          </button>
        )}

        {/* "Add another" tile when group members still need flights */}
        {hasFlights && missingMemberLabel && (
          <button
            type="button"
            onClick={onAddFlight}
            className="duo-focusable w-full border-2 border-dashed border-[#E5E5E5] rounded-2xl p-3 flex items-center gap-3 active:translate-y-0.5 transition-all text-left"
            style={{ touchAction: "manipulation" }}
          >
            <div className="w-8 h-8 rounded-xl border-2 border-[#E5E5E5] flex items-center justify-center flex-shrink-0">
              <Plus size={16} className="text-[#AFAFAF]" strokeWidth={3} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-[#3C3C3C] text-sm">Add another flight</p>
              <p className="font-bold text-[#AFAFAF] text-xs">{missingMemberLabel}</p>
            </div>
          </button>
        )}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   ARRIVAL INSIGHT
   ───────────────────────────────────────────────────────────────────────── */
function ArrivalInsightCard({ flights }: { flights: TripFlight[] }) {
  if (flights.length < 2) return null;
  const latest = latestArrival(flights);
  if (!latest) return null;
  return (
    <div className="bg-[#F0FAFF] border-2 border-[#1CB0F6] shadow-[0_4px_0_#A8DCFF] rounded-2xl p-4 flex gap-3 items-start">
      <Clock size={20} className="text-[#1CB0F6] mt-0.5 flex-shrink-0" />
      <p className="font-normal text-[12px] text-[#3C3C3C] leading-snug">
        Plan your first activity after <span className="font-bold">{latest}</span>
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   PUBLIC COMPONENT
   ───────────────────────────────────────────────────────────────────────── */
export function LogisticsTab({
  hotels,
  tripDays: _tripDays,
  onAddHotel,
  onEditHotel,
  members,
  flights,
  onAddFlight,
  onEditFlight,
  isViewerHost,
  onToggleViewerHost,
  hostMemberIds,
}: LogisticsTabProps) {
  return (
    <div className="flex flex-col gap-5">
      <HotelSection
        hotels={hotels}
        onAddHotel={onAddHotel}
        onEditHotel={onEditHotel}
        isViewerHost={isViewerHost}
      />
      <FlightsSection
        members={members}
        flights={flights}
        onAddFlight={onAddFlight}
        onEditFlight={onEditFlight}
        isViewerHost={isViewerHost}
        onToggleViewerHost={onToggleViewerHost}
        hostMemberIds={hostMemberIds}
      />
      <ArrivalInsightCard flights={flights} />
    </div>
  );
}
