import { useNavigate, useParams } from "react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, MapPin, Calendar, Users, CheckCircle2, ChevronRight, ChevronDown, ChevronUp, Lock, MoreVertical, Pencil, HelpCircle, MessageCircle, Trash2, Clock, Star, Phone, Link2, GripVertical, Plus, Minus, Hotel as HotelIcon, X as XIcon, Plane, Sliders, Map as MapIcon } from "lucide-react";
import { DuoButton } from "../components/DuoButton";
import { TripHero } from "../components/TripHero";
import { TripTabBar } from "../components/TripTabBar";
import { DuoDateField } from "../components/DuoDateField";
import { DuoTimeField } from "../components/DuoTimeField";
import { PlanTab } from "../components/PlanTab";
import { LogisticsTab } from "../components/LogisticsTab";
import { HotelPlaceAutocomplete } from "../components/HotelPlaceAutocomplete";
import { getTripById, getTripMembers, MAX_TRIP_MEMBERS, deleteTrip, updateTrip } from "../../services/tripService";
import { subscribeTripAuxSync, subscribeTripCloudSync, hydrateTripFromCloud } from "../../services/cloudHydrateService";
import { getItinerary, saveItinerary, upsertItineraryTransitSnapshot } from "../../services/itineraryService";
import { itineraryToDisplayDays, buildDefaultEditRows } from "../utils/itineraryToDisplayDays";
import { buildDayTimeline } from "../utils/buildDayTimeline";
import { DaySplitTimeline } from "../components/DaySplitTimeline";
import type { ItineraryDay, ItineraryEditRow, ScheduledActivity } from "../../types/itinerary";
import { getApproxTransitInfo, type TransitInfo } from "../../services/transitService";
import {
  buildPlaceDetailsFromSavedItinerary,
  fetchPlaceDetails,
  type PlaceDetailsResult,
} from "../../services/placeService";
import type { GroupType, Trip, TripMember, TripHotel, TripFlight, PreferenceStatus } from "../../types/trip";
import {
  addTripHotel,
  getTripHotels,
  hydrateTripHotelsFromCloud,
  removeTripHotel,
  updateTripHotel,
  validateHotelDayRange,
} from "../../services/hotelService";
import {
  addTripFlight,
  getTripFlights,
  hydrateTripFlightsFromCloud,
  removeTripFlight,
  updateTripFlight,
} from "../../services/flightService";
import { useHotelsByDayWithLocations } from "../hooks/useHotelsByDayWithLocations";
import { ActivityPlaceAutocomplete } from "../components/ActivityPlaceAutocomplete";
import { requestAiEnhance } from "../../services/aiEnhanceService";
import type { AiEnhanceProposal } from "../../types/aiEnhance";
import { generateGroupPlanningProfile, COST_RANGE_BY_BUDGET } from "../../services/planningService";
import { prefetchVoteCandidatesForTrip } from "../../services/voteCandidatesPrefetchService";
import { getUserName } from "../../services/userProfileService";

const DEFAULT_TRIP_IMG = "https://images.unsplash.com/photo-1728051767709-32ef3258277c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYWxpJTIwcmljZSUyMHRlcnJhY2VzJTIwYWVyaWFsJTIwZ3JlZW4lMjBsYW5kc2NhcGV8ZW58MXx8fHwxNzcyODU5ODk2fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";

const MEMBER_COLORS = ["#58CC02", "#1CB0F6", "#CE82FF", "#FF4B4B", "#FFD900", "#FF9F1C"];

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Compact -/+ stepper for picking a 1-based day index. Used by the hotel
 * add/edit sheet for check-in / check-out day selection. Clamps to `[min, max]`
 * and disables the buttons at the edges so the user can't go out of bounds.
 */
function DayStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));
  return (
    <div>
      <p className="font-black text-[#3C3C3C] text-xs mb-2">{label}</p>
      <div className="flex items-center gap-2 bg-white border-2 border-[#E5E5E5] rounded-2xl p-1.5">
        <button
          type="button"
          onClick={dec}
          disabled={value <= min}
          className="w-8 h-8 rounded-xl bg-white border-2 border-[#E5E5E5] flex items-center justify-center shadow-[0_2px_0_#D4D4D4] active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:translate-y-0 disabled:active:shadow-[0_2px_0_#D4D4D4]"
          aria-label={`Decrease ${label}`}
        >
          <Minus size={14} className="text-[#3C3C3C]" strokeWidth={3} />
        </button>
        <span className="flex-1 text-center font-black text-[#3C3C3C] text-base">{value}</span>
        <button
          type="button"
          onClick={inc}
          disabled={value >= max}
          className="w-8 h-8 rounded-xl bg-white border-2 border-[#E5E5E5] flex items-center justify-center shadow-[0_2px_0_#D4D4D4] active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:translate-y-0 disabled:active:shadow-[0_2px_0_#D4D4D4]"
          aria-label={`Increase ${label}`}
        >
          <Plus size={14} className="text-[#3C3C3C]" strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: PreferenceStatus }) {
  if (status === "completed") {
    return <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#58CC02] rounded-full border-2 border-white" />;
  }
  if (status === "in_progress") {
    return <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#FFD900] rounded-full border-2 border-white" />;
  }
  return <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-[#E5E5E5] bg-[#C3C3C3]" />;
}

function isLikelyGooglePlaceId(placeId: string): boolean {
  const id = placeId.trim();
  if (id.length <= 20) return false;
  return id.startsWith("ChIJ") || id.startsWith("GhIJ") || id.startsWith("Eh") || id.startsWith("EkQ");
}

/**
 * 30-minute resolution time options for the inline start-time picker.
 * Generated once at module load and shared across all open-picker sessions.
 * Range mirrors a typical waking-hours itinerary (06:00–23:00).
 */
const TIME_PICKER_OPTIONS: string[] = (() => {
  const out: string[] = [];
  for (let h = 6; h <= 23; h += 1) {
    for (const m of [0, 30]) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
})();

/**
 * Wrapper around the per-tab `<div role="tabpanel">` that adds a one-shot
 * slide-in animation (`animate-tab-enter`) every time the panel mounts.
 * The keyframes are defined in `src/styles/index.css` and respect
 * `prefers-reduced-motion`.
 */
function TabPanel({
  children,
  id,
  labelId,
}: {
  children: ReactNode;
  id: string;
  labelId: string;
}) {
  return (
    <div
      id={id}
      role="tabpanel"
      aria-labelledby={labelId}
      className="animate-tab-enter"
    >
      {children}
    </div>
  );
}

/**
 * Group-type chip options for the edit-trip sheet. Mirrors the array in
 * `CreateTripScreen.tsx` so the leader sees the same labels / sublabels
 * everywhere. If you add a new GroupType, update both lists.
 */
const EDIT_GROUP_TYPE_OPTIONS: Array<{
  value: GroupType;
  emoji: string;
  label: string;
  sublabel: string;
}> = [
  { value: "colleagues", emoji: "🏢", label: "Colleagues", sublabel: "Team building / work trip" },
  { value: "family", emoji: "👨‍👩‍👧", label: "Family", sublabel: "Family trip, may include kids" },
  { value: "couple", emoji: "💑", label: "Couple", sublabel: "Romantic / partner trip" },
  { value: "close_friends", emoji: "🤝", label: "Close Friends", sublabel: "Best friends who know each other" },
  { value: "meetup", emoji: "🌐", label: "Meetup", sublabel: "Strangers or community event" },
  { value: "new_friends", emoji: "👋", label: "New Friends", sublabel: "Friends who are not yet close" },
];

export default function TripDetailScreen() {
  const navigate = useNavigate();
  const { tripId } = useParams<{ tripId?: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  // Edit-trip bottom sheet (title / days / guests). Draft state lives here so we
  // can cancel without persisting partial edits.
  const [editTripOpen, setEditTripOpen] = useState(false);
  const [editTripName, setEditTripName] = useState("");
  const [editTripDays, setEditTripDays] = useState<number>(1);
  const [editTripGuests, setEditTripGuests] = useState<number>(MAX_TRIP_MEMBERS);
  // Group type is set by the leader at create time. Stored on the trip and
  // threaded into the AI scheduler — kept editable here so the leader can
  // correct a wrong pick without recreating the trip.
  const [editGroupType, setEditGroupType] = useState<GroupType | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(1);
  const [transitByDay, setTransitByDay] = useState<Record<number, TransitInfo[]>>({});
  const [adjustedStartByDay, setAdjustedStartByDay] = useState<Record<number, string[]>>({});
  const [activeEvent, setActiveEvent] = useState<{
    day: number;
    index: number;
    id: string;
    title: string;
    image?: string | null;
    duration: string;
    /** Canonical duration in minutes; used to round-trip edits to ScheduledActivity.durationMinutes. */
    durationMinutes: number;
    cost: string;
    startTime: string;
  } | null>(null);
  const [activeDetail, setActiveDetail] = useState<PlaceDetailsResult | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [detailNote, setDetailNote] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editDuration, setEditDuration] = useState("");
  const [editBudget, setEditBudget] = useState("");
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [showBudgetPicker, setShowBudgetPicker] = useState(false);
  // Inline start-time editor (only available while itineraryEditMode is true).
  // We track the targeted row separately so the picker doesn't depend on
  // `activeEvent`, which only exists for the detail bottom sheet.
  const [timePickerDay, setTimePickerDay] = useState<number | null>(null);
  const [timePickerIndex, setTimePickerIndex] = useState<number | null>(null);
  const [timePickerValueHhmm, setTimePickerValueHhmm] = useState<string>("12:00");
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragCurrentY, setDragCurrentY] = useState<number | null>(null);
  const [itineraryEditMode, setItineraryEditMode] = useState(false);
  const [editRowsDraft, setEditRowsDraft] = useState<Record<string, ItineraryEditRow[]>>({});
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiEnhanceGoal, setAiEnhanceGoal] = useState("");
  const [aiDissatisfaction, setAiDissatisfaction] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiProposals, setAiProposals] = useState<AiEnhanceProposal[]>([]);
  const [aiSelectedProposalIds, setAiSelectedProposalIds] = useState<Record<string, boolean>>({});
  /** Bumps when itinerary is saved so getItinerary() result is memoized (avoids new object ref every render → useEffect loop). */
  const [itineraryRev, setItineraryRev] = useState(0);
  const activeDetailPlaceIdRef = useRef<string | null>(null);

  // ─── Hotels (shared per-trip, optional, non-overlapping day ranges) ────
  const [hotels, setHotels] = useState<TripHotel[]>([]);
  // Bump to force the hotelsByDay hook to re-read getTripHotels after the
  // user adds/edits/removes a hotel without remounting the screen.
  const [hotelsRefreshKey, setHotelsRefreshKey] = useState(0);
  // Day index → assigned hotel summary (morning/evening on transition days)
  // with each entry's location resolved via Google Places so the transit
  // pipeline can compute real hotel ↔ activity leg times.
  const hotelsByDay = useHotelsByDayWithLocations(trip?.id ?? null, hotelsRefreshKey);
  const [hotelSheetOpen, setHotelSheetOpen] = useState(false);
  const [editingHotelId, setEditingHotelId] = useState<string | null>(null);
  const [hotelDraftName, setHotelDraftName] = useState("");
  const [hotelDraftPlaceId, setHotelDraftPlaceId] = useState("");
  const [hotelDraftAddress, setHotelDraftAddress] = useState<string | undefined>(undefined);
  const [hotelDraftStart, setHotelDraftStart] = useState(1);
  const [hotelDraftEnd, setHotelDraftEnd] = useState(1);
  const [hotelDraftError, setHotelDraftError] = useState<string | null>(null);

  // ─── Tabs (Plan / Logistics) ──────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"plan" | "logistics">("plan");

  // ─── Flights (per-member, per-direction) ─────────────────────────────
  const [flights, setFlights] = useState<TripFlight[]>([]);
  const [flightSheetOpen, setFlightSheetOpen] = useState(false);
  // null = "Add" mode (sheet picks the member + direction); a flight id =
  // "Edit" mode for that specific row.
  const [editingFlightId, setEditingFlightId] = useState<string | null>(null);
  // Draft state for the FlightSheet form. Pre-populated on open from the
  // flight identified by `editingFlightId` (if any) so editing is in-place.
  const [flightDraftOrigin, setFlightDraftOrigin] = useState("");
  const [flightDraftDestination, setFlightDraftDestination] = useState("");
  const [flightDraftDate, setFlightDraftDate] = useState("");
  const [flightDraftAirline, setFlightDraftAirline] = useState("");
  const [flightDraftNumber, setFlightDraftNumber] = useState("");
  const [flightDraftArrivalTime, setFlightDraftArrivalTime] = useState("");
  // Either the literal sentinel `["everyone"]` (save one flight per trip
  // member) or a non-empty list of member ids (multi-select). Ignored in
  // Edit mode — the sheet locks the assignment to the row being edited.
  const [flightDraftFor, setFlightDraftFor] = useState<string[]>(["everyone"]);
  // Whether the draft represents an arriving (default) or departing flight.
  // Editable in both Add and Edit mode — for Edit, switching direction just
  // patches the field on save.
  const [flightDraftDirection, setFlightDraftDirection] = useState<"arrival" | "departure">("arrival");

  useEffect(() => {
    if (!tripId) return;
    const t = getTripById(tripId);
    setTrip(t ?? null);
    setMembers(t ? getTripMembers(t.id) : []);
    setHotels(t ? getTripHotels(t.id) : []);
    setFlights(t ? getTripFlights(t.id) : []);
    if (t) {
      void hydrateTripHotelsFromCloud(t.id).then(() => {
        setHotels(getTripHotels(t.id));
      });
      void hydrateTripFlightsFromCloud(t.id).then(() => {
        setFlights(getTripFlights(t.id));
      });
    }
    if (t && typeof window !== "undefined") {
      sessionStorage.setItem("currentTripId", t.id);
    }
    if (import.meta.env?.MODE === "development") {
      // eslint-disable-next-line no-console
      console.debug("[trip-detail] load", {
        routeTripId: tripId,
        tripIdFromTrip: t?.id,
        itineraryForTrip: t ? getItinerary(t.id) : null,
        rawItineraries: typeof window !== "undefined" ? localStorage.getItem("tripItineraries") : null,
      });
    }
  }, [tripId]);

  // Keep hotels + flights in sync across devices via Supabase Realtime so
  // another guest adding/removing rows reflects on this screen without a
  // refresh. The aux channel is separate from the main one because hotels
  // and flights live in their own services (hotel/flightService) outside
  // the typed HydrateResult contract used by subscribeTripCloudSync.
  useEffect(() => {
    if (!tripId) return;
    return subscribeTripAuxSync(tripId, (table) => {
      if (table === "trip_hotels") {
        void hydrateTripHotelsFromCloud(tripId).then(() => {
          setHotels(getTripHotels(tripId));
        });
      } else if (table === "trip_flights") {
        void hydrateTripFlightsFromCloud(tripId).then(() => {
          setFlights(getTripFlights(tripId));
        });
      }
    });
  }, [tripId]);

  // Keep members + their preference status in sync across devices (Supabase Realtime + tab focus).
  useEffect(() => {
    if (!tripId) return;
    return subscribeTripCloudSync(tripId, (result) => {
      const t = getTripById(tripId);
      const nextMembers = t ? getTripMembers(t.id) : [];
      // getTripById parses JSON each time — avoid setState when nothing changed (prevents displayDays / transit churn).
      setTrip((prev) => {
        const next = t ?? null;
        if (prev === null && next === null) return prev;
        if (prev === null || next === null) return next;
        if (prev.id !== next.id) return next;
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      });
      setMembers((prev) =>
        prev.length !== nextMembers.length || JSON.stringify(prev) !== JSON.stringify(nextMembers)
          ? nextMembers
          : prev
      );
      if (result.itineraryUpdated) {
        setItineraryRev((n) => n + 1);
      }
    });
  }, [tripId]);

  useEffect(() => {
    if (tripId === undefined) navigate("/", { replace: true });
  }, [tripId, navigate]);

  const capacity = trip?.maxGuests && trip.maxGuests > 0 ? trip.maxGuests : MAX_TRIP_MEMBERS;
  const inviteStepComplete = members.length >= capacity;
  const allPreferencesComplete = members.length > 0 && members.every((m) => m.preferenceStatus === "completed");
  const voteUnlocked = allPreferencesComplete;

  /** Precompute vote list + gap-fill so /vote opens instantly once everyone finishes prefs. */
  useEffect(() => {
    if (!tripId || !allPreferencesComplete) return;
    void hydrateTripFromCloud(tripId, { force: true }).finally(() => {
      void prefetchVoteCandidatesForTrip(tripId);
    });
  }, [tripId, allPreferencesComplete]);
  const currentMemberId = typeof window !== "undefined" ? sessionStorage.getItem("currentMemberId") : null;
  const currentMember = currentMemberId ? members.find((m) => m.id === currentMemberId) : members[0] ?? null;

  useEffect(() => {
    if (!tripId || !currentMember || typeof window === "undefined") return;
    const storedTripId = sessionStorage.getItem("currentTripId");
    const storedMemberId = sessionStorage.getItem("currentMemberId");
    const storedMemberBelongsToTrip = members.some((m) => m.id === storedMemberId);
    if (storedTripId !== tripId || !storedMemberBelongsToTrip) {
      sessionStorage.setItem("currentTripId", tripId);
      sessionStorage.setItem("currentMemberId", currentMember.id);
    }
  }, [tripId, currentMember, members]);

  const handleInviteClick = () => {
    if (tripId && !inviteStepComplete) navigate(`/trips/${tripId}/invite`);
  };

  const handleSetPreference = () => {
    if (!tripId || !currentMember) return;
    if (typeof window !== "undefined") {
      sessionStorage.setItem("currentTripId", tripId);
      sessionStorage.setItem("currentMemberId", currentMember.id);
    }
    navigate("/preference-budget", { state: { tripId, memberId: currentMember.id } });
  };

  const handleVoteClick = () => {
    if (voteUnlocked) {
      navigate("/vote");
    }
  };

  // ─── Hotel sheet helpers ────────────────────────────────────────────────
  const tripDaysCount = Math.max(1, trip?.tripDays ?? 1);

  /**
   * Pick a sensible default day-range for a new hotel (check-in/check-out).
   * Looks for the first night (day N → day N+1) not yet covered by any
   * existing hotel and suggests a one-night stay there. Falls back to a
   * trivial single-night range when the trip is already fully covered
   * (validation will then surface the overlap).
   */
  const computeDefaultRange = (): { start: number; end: number } => {
    const coveredNights = new Set<number>();
    for (const h of hotels) {
      for (let night = h.dayStart; night <= h.dayEnd - 1; night++) coveredNights.add(night);
    }
    for (let night = 1; night <= tripDaysCount - 1; night++) {
      if (!coveredNights.has(night)) return { start: night, end: night + 1 };
    }
    return { start: 1, end: Math.min(2, Math.max(2, tripDaysCount)) };
  };

  const openAddHotelSheet = () => {
    if (!tripId) return;
    const range = computeDefaultRange();
    setEditingHotelId(null);
    setHotelDraftName("");
    setHotelDraftPlaceId("");
    setHotelDraftAddress(undefined);
    setHotelDraftStart(range.start);
    setHotelDraftEnd(range.end);
    setHotelDraftError(null);
    setHotelSheetOpen(true);
  };

  const openEditHotelSheet = (hotel: TripHotel) => {
    setEditingHotelId(hotel.id);
    setHotelDraftName(hotel.name);
    setHotelDraftPlaceId(hotel.placeId);
    setHotelDraftAddress(hotel.address);
    setHotelDraftStart(hotel.dayStart);
    setHotelDraftEnd(hotel.dayEnd);
    setHotelDraftError(null);
    setHotelSheetOpen(true);
  };

  const closeHotelSheet = () => {
    setHotelSheetOpen(false);
    setEditingHotelId(null);
    setHotelDraftError(null);
  };

  const handleSaveHotel = () => {
    if (!tripId) return;
    const name = hotelDraftName.trim();
    if (!name) {
      setHotelDraftError("Pick a hotel from the search results, or enter a name.");
      return;
    }
    const start = Math.max(1, Math.min(tripDaysCount, Math.round(hotelDraftStart)));
    const end = Math.max(1, Math.min(tripDaysCount, Math.round(hotelDraftEnd)));
    const validation = validateHotelDayRange({
      tripId,
      dayStart: start,
      dayEnd: end,
      tripDays: tripDaysCount,
      excludeHotelId: editingHotelId ?? undefined,
    });
    if (!validation.ok) {
      setHotelDraftError(validation.error);
      return;
    }

    if (editingHotelId) {
      updateTripHotel(editingHotelId, {
        name,
        placeId: hotelDraftPlaceId,
        address: hotelDraftAddress,
        dayStart: start,
        dayEnd: end,
      });
    } else {
      addTripHotel({
        tripId,
        name,
        placeId: hotelDraftPlaceId,
        address: hotelDraftAddress,
        dayStart: start,
        dayEnd: end,
      });
    }
    setHotels(getTripHotels(tripId));
    setHotelsRefreshKey((n) => n + 1);
    closeHotelSheet();
  };

  const handleRemoveHotel = () => {
    if (!editingHotelId || !tripId) return;
    removeTripHotel(editingHotelId);
    setHotels(getTripHotels(tripId));
    setHotelsRefreshKey((n) => n + 1);
    closeHotelSheet();
  };

  const handleStepClick = (step: "invite" | "preference" | "vote" | "plan") => {
    if (step === "invite") handleInviteClick();
    else if (step === "preference") handleSetPreference();
    else if (step === "vote" && voteUnlocked) navigate("/vote");
    else if (step === "plan" && tripId && getItinerary(tripId)) {
      navigate("/trip-plan");
    }
  };

  // ─── Flight sheet (Logistics tab) ─────────────────────────────────────
  const closeFlightSheet = () => {
    setFlightSheetOpen(false);
    setEditingFlightId(null);
  };

  // Pre-fill or reset draft fields when the FlightSheet opens. In Edit mode
  // (`editingFlightId` is a string) we load that specific flight row; in Add
  // mode (`null`) we clear the form and default to "everyone" + "arrival".
  // Watching only `flightSheetOpen` and `editingFlightId` keeps user edits
  // from being clobbered by an unrelated `flights` state update.
  useEffect(() => {
    if (!flightSheetOpen) return;
    if (editingFlightId) {
      const existing = flights.find((f) => f.id === editingFlightId);
      setFlightDraftOrigin(existing?.origin ?? "");
      setFlightDraftDestination(existing?.destination ?? "");
      setFlightDraftDate(existing?.date ?? "");
      setFlightDraftAirline(existing?.airline ?? "");
      setFlightDraftNumber(existing?.flightNumber ?? "");
      setFlightDraftArrivalTime(existing?.arrivalTime ?? "");
      setFlightDraftFor(existing?.memberId ? [existing.memberId] : ["everyone"]);
      setFlightDraftDirection(existing?.direction ?? "arrival");
    } else {
      setFlightDraftOrigin("");
      setFlightDraftDestination("");
      setFlightDraftDate("");
      setFlightDraftAirline("");
      setFlightDraftNumber("");
      setFlightDraftArrivalTime("");
      setFlightDraftFor(["everyone"]);
      setFlightDraftDirection("arrival");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightSheetOpen, editingFlightId]);

  const handleSaveFlight = () => {
    if (!tripId) return;
    const origin = flightDraftOrigin.trim();
    const destination = flightDraftDestination.trim();
    const date = flightDraftDate.trim();
    // Arrival time is the only piece of flight data the itinerary actually
    // *uses* (to clamp Day 1's start / last day's end). Origin / destination
    // / date give the row enough identity to display; airline + flight # are
    // labels-only and stay optional.
    const arrivalTime = flightDraftArrivalTime.trim();
    if (!origin || !destination || !date || !arrivalTime) return;
    const airline = flightDraftAirline.trim();
    const flightNumber = flightDraftNumber.trim() || undefined;
    const direction = flightDraftDirection;
    const payload = {
      origin,
      destination,
      date,
      airline,
      flightNumber,
      arrivalTime,
      direction,
    };

    // Edit mode — patch the specific flight identified by `editingFlightId`.
    // Direction is included in the payload so flipping arrival↔departure
    // works in-place.
    if (editingFlightId) {
      updateTripFlight(editingFlightId, payload);
      setFlights(getTripFlights(tripId));
      closeFlightSheet();
      return;
    }

    // Add mode — `flightDraftFor` is either `["everyone"]` or a list of
    // individual member ids. "Everyone" expands to every trip member.
    const isEveryone = flightDraftFor.includes("everyone");
    const targetMemberIds = isEveryone
      ? members.map((m) => m.id)
      : flightDraftFor;
    if (targetMemberIds.length === 0) return;

    for (const memberId of targetMemberIds) {
      // Each (memberId, direction) pair is unique — if there's already a row
      // in this direction for that member, replace it; otherwise insert.
      const existing = flights.find(
        (f) => f.memberId === memberId && f.direction === direction
      );
      if (existing) {
        updateTripFlight(existing.id, payload);
      } else {
        addTripFlight(tripId, memberId, payload);
      }
    }
    setFlights(getTripFlights(tripId));
    closeFlightSheet();
  };

  const handleRemoveFlight = () => {
    if (!tripId || !editingFlightId) return;
    removeTripFlight(editingFlightId);
    setFlights(getTripFlights(tripId));
    closeFlightSheet();
  };

  const openEditTrip = () => {
    if (!trip) return;
    setEditTripName(trip.name);
    // tripDays may be undefined for legacy trips — seed from the itinerary
    // length or the current displayDays so the stepper always has a value.
    const seedDays =
      (typeof trip.tripDays === "number" && trip.tripDays > 0
        ? trip.tripDays
        : savedItinerary?.days?.length) || displayDays.length || 1;
    setEditTripDays(seedDays);
    const seedGuests = trip.maxGuests && trip.maxGuests > 0 ? trip.maxGuests : MAX_TRIP_MEMBERS;
    setEditTripGuests(seedGuests);
    setEditGroupType(trip.groupType ?? null);
    setEditTripOpen(true);
  };

  /**
   * Persist edits to title / days / guests. We deliberately do NOT mutate the
   * itinerary even if the user shrinks `tripDays` — the saved itinerary may
   * already contain real activities for those days and silently dropping them
   * would surprise the user. The metadata simply drives summary counts; the
   * user can regenerate to actually reshape the itinerary.
   */
  const handleSaveEditTrip = () => {
    if (!trip) return;
    const nameTrimmed = editTripName.trim();
    const memberCount = members.length;
    const safeDays = Math.max(1, Math.min(14, Math.round(editTripDays || 1)));
    const safeGuests = Math.max(
      Math.max(1, memberCount),
      Math.min(MAX_TRIP_MEMBERS, Math.round(editTripGuests || MAX_TRIP_MEMBERS))
    );
    const updated = updateTrip(trip.id, {
      name: nameTrimmed || trip.name,
      tripDays: safeDays,
      maxGuests: safeGuests,
      groupType: editGroupType ?? undefined,
    });
    if (updated) setTrip(updated);
    setEditTripOpen(false);
  };

  const handleDeleteConfirm = () => {
    if (!tripId || !trip) return;
    deleteTrip(tripId);
    if (sessionStorage.getItem("currentTripId") === tripId) {
      sessionStorage.removeItem("currentTripId");
      sessionStorage.removeItem("currentMemberId");
    }
    setDeleteModalOpen(false);
    navigate("/");
  };

  const savedItinerary = useMemo(() => {
    if (!trip) return null;
    return getItinerary(trip.id);
  }, [trip?.id, itineraryRev]);

  const hasSavedItinerary = !!savedItinerary;
  const displayDays = useMemo(() => {
    if (!trip || !savedItinerary) return [];
    const merged = {
      ...savedItinerary,
      editRowsByDay:
        itineraryEditMode && Object.keys(editRowsDraft).length > 0
          ? editRowsDraft
          : savedItinerary.editRowsByDay,
    };
    return itineraryToDisplayDays(merged, trip.name, trip.createdAt, hotelsByDay);
    // Primitives only: trip from getTripById is a new object reference on every read even when data is identical.
  }, [trip?.id, trip?.name, trip?.createdAt, savedItinerary, itineraryEditMode, editRowsDraft, hotelsByDay]);

  const itineraryDayByIndex = useMemo(() => {
    const m = new Map<number, ItineraryDay>();
    for (const d of savedItinerary?.days ?? []) m.set(d.dayIndex, d);
    return m;
  }, [savedItinerary?.days]);

  const timelineByDay = useMemo(() => {
    if (!savedItinerary?.splitPlan?.needsSplit) return null;
    const out = new Map<number, ReturnType<typeof buildDayTimeline>>();
    for (const day of displayDays) {
      out.set(
        day.day,
        buildDayTimeline({
          events: day.events,
          itineraryDay: itineraryDayByIndex.get(day.day),
          splitPlan: savedItinerary.splitPlan,
        })
      );
    }
    return out;
  }, [displayDays, savedItinerary?.splitPlan, itineraryDayByIndex]);

  const useSplitTimelineView =
    savedItinerary?.splitPlan?.needsSplit === true && !itineraryEditMode;

  const totalActivities = useMemo(() => {
    return displayDays.reduce((acc, d) => acc + d.events.length, 0);
  }, [displayDays]);

  /**
   * Stable key so transit effect does not re-run when displayDays gets a new
   * array reference with the same layout.
   *
   * The leading `v2:` is a chain-math version tag — bump it whenever the
   * adjusted-start computation changes so older saved snapshots stop matching
   * and get recomputed by the fixed code path. v2 = meal slots anchored to
   * their reserved lunch/dinner windows.
   */
  const transitLayoutFingerprint = useMemo(() => {
    const r = (n: number) => n.toFixed(4);
    return `v2:${displayDays
      .map((d) =>
        `${d.day}:${d.events
          .map(
            (e) =>
              `${e.time}|${e.durationMinutes}|${e.location ? `${r(e.location.lat)},${r(e.location.lng)}` : "-"}`
          )
          .join(",")}`
      )
      .join(";")}`;
  }, [displayDays]);

  const membersCount = members.length;

  const tripDaysCountForEstimate = savedItinerary?.days?.length ?? trip?.tripDays ?? displayDays.length ?? 1;

  const estPerPerson = useMemo(() => {
    if (!trip) return "$—";
    try {
      const profile = generateGroupPlanningProfile(trip.id);
      if (!profile) return "$—";
      const budget = (profile.groupBudgetLevel || "moderate").toLowerCase();
      const range = COST_RANGE_BY_BUDGET[budget] ?? COST_RANGE_BY_BUDGET.moderate;
      const perDay =
        range.minPerDay && range.maxPerDay
          ? (range.minPerDay + range.maxPerDay) / 2
          : range.maxPerDay ?? range.minPerDay ?? 100;
      const total = perDay * Math.max(1, tripDaysCountForEstimate);
      const rounded = Math.round(total / 10) * 10;
      return `$${rounded}`;
    } catch {
      return "$—";
    }
  }, [trip?.id, tripDaysCountForEstimate, itineraryRev]);

  if (import.meta.env?.MODE === "development" && trip) {
    // eslint-disable-next-line no-console
    console.debug("TripDetailState", {
      tripId: trip.id,
      hasSavedItinerary,
    });
  }

  const parseTimeLabelToMinutes = (label: string): number => {
    if (!label?.trim() || label === "--") return 9 * 60;
    const [timePart, periodRaw] = label.split(" ");
    const period = periodRaw?.toUpperCase() ?? "AM";
    const [hRaw, mRaw] = (timePart ?? "00:00").split(":");
    let h = Number(hRaw);
    const m = Number(mRaw);
    if (period === "PM" && h !== 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return h * 60 + m;
  };

  const minutesToTimeLabel = (minutes: number): string => {
    const m = ((minutes % 1440) + 1440) % 1440;
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    const period = hh >= 12 ? "PM" : "AM";
    const h12 = hh % 12 || 12;
    return `${h12}:${String(mm).padStart(2, "0")} ${period}`;
  };

  /**
   * Available durations in the picker chip grid. Order matters — the first
   * option is the default snap target. Keep these in sync with the JSX below.
   */
  const DURATION_PICKER_OPTIONS: ReadonlyArray<{ label: string; minutes: number }> = [
    { label: "30 min", minutes: 30 },
    { label: "45 min", minutes: 45 },
    { label: "1 hr", minutes: 60 },
    { label: "1.5 hr", minutes: 90 },
    { label: "2 hr", minutes: 120 },
    { label: "3 hr", minutes: 180 },
    { label: "4 hr", minutes: 240 },
  ];

  /**
   * Convert a duration picker label like "30 min", "1 hr", or "1.5 hr" back
   * into minutes. Falls back to 60 minutes for unrecognized strings so the
   * caller can keep going without throwing.
   */
  const parseDurationPickerToMinutes = (s: string): number => {
    const exact = DURATION_PICKER_OPTIONS.find((o) => o.label === s);
    if (exact) return exact.minutes;
    const m = s.trim().match(/^(\d+(?:\.\d+)?)\s*(min|minutes?|hr|hrs?|h)$/i);
    if (!m) return 60;
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0) return 60;
    const unit = (m[2] ?? "").toLowerCase();
    return unit.startsWith("min") ? Math.round(n) : Math.round(n * 60);
  };

  /**
   * Map an arbitrary minute value to the closest picker option label. Used
   * to seed `editDuration` when the sheet opens so the matching chip is
   * highlighted rather than an unrelated formatted range like "1–2 hrs".
   */
  const minutesToPickerOption = (min: number): string => {
    const safe = Number.isFinite(min) && min > 0 ? min : 60;
    let best = DURATION_PICKER_OPTIONS[0]!;
    let bestDiff = Math.abs(safe - best.minutes);
    for (const opt of DURATION_PICKER_OPTIONS) {
      const d = Math.abs(safe - opt.minutes);
      if (d < bestDiff) {
        best = opt;
        bestDiff = d;
      }
    }
    return best.label;
  };

  /** "HH:mm" → minutes-since-midnight; tolerant of malformed input. */
  const hhmmToMinutes = (s: string): number => {
    const [h, m] = (s ?? "").split(":").map((v) => Number(v));
    if (!Number.isFinite(h)) return 0;
    const mm = Number.isFinite(m) ? m : 0;
    return Math.max(0, h * 60 + mm);
  };

  /** minutes-since-midnight → zero-padded "HH:mm". Wraps within a day. */
  const minutesToHhmm = (min: number): string => {
    const safe = ((Math.round(min) % 1440) + 1440) % 1440;
    const h = Math.floor(safe / 60);
    const m = safe % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  /**
   * Open the inline time-picker bottom sheet for a given day/event index.
   * Converts the row's current display label (e.g. "7:00 PM") into the 24-hour
   * "HH:mm" key the chip grid uses for selection highlighting.
   */
  const openTimePicker = (day: number, idx: number, currentLabel: string) => {
    if (!itineraryEditMode) return;
    const minutes = parseTimeLabelToMinutes(currentLabel);
    setTimePickerDay(day);
    setTimePickerIndex(idx);
    setTimePickerValueHhmm(minutesToHhmm(minutes));
    setTimePickerOpen(true);
  };

  /**
   * Persist a new start time for the scheduled activity at (dayIndex, eventIdx).
   *
   * Walks the saved itinerary day's blocks + lunch/dinner slots and rewrites
   * `startTime`/`endTime` on the matching `ScheduledActivity` (matched by
   * the row's placeId). Clears the transit snapshot so the chain recomputes
   * the next time the screen leaves edit mode.
   *
   * No-ops for hotel and placeholder rows because they don't map to a
   * persistent `ScheduledActivity`; the calling button is hidden in those
   * cases too, but the guard belt-and-suspenders this against drift.
   */
  const applyTimeEdit = (day: number, idx: number, newHhmm: string) => {
    if (!savedItinerary || !trip) return;
    const dayDisplay = displayDays.find((d) => d.day === day);
    const ev = dayDisplay?.events[idx];
    if (!ev || ev.isHotel || ev.isPlaceholder) return;
    const placeId = (ev.detailPlaceId ?? ev.id).replace(/-(lunch|dinner)$/, "");
    if (!placeId) return;
    const newStartMin = hhmmToMinutes(newHhmm);
    let changed = false;
    const updateSched = (sa: ScheduledActivity): ScheduledActivity => {
      if (sa.placeId !== placeId) return sa;
      if (sa.startTime === newHhmm) return sa;
      changed = true;
      return {
        ...sa,
        startTime: newHhmm,
        endTime: minutesToHhmm(newStartMin + (sa.durationMinutes || 60)),
      };
    };
    const nextDays = savedItinerary.days.map((d) => {
      if (d.dayIndex !== day) return d;
      return {
        ...d,
        blocks: d.blocks.map((b) => ({
          ...b,
          activities: b.activities.map(updateSched),
        })),
        lunchSlot: d.lunchSlot.activity
          ? { ...d.lunchSlot, activity: updateSched(d.lunchSlot.activity) }
          : d.lunchSlot,
        dinnerSlot: d.dinnerSlot.activity
          ? { ...d.dinnerSlot, activity: updateSched(d.dinnerSlot.activity) }
          : d.dinnerSlot,
      };
    });
    if (!changed) return;
    saveItinerary({ ...savedItinerary, days: nextDays, transitSnapshot: undefined });
    setItineraryRev((n) => n + 1);
  };

  const openActivityDetail = async (
    event: {
      id: string;
      title: string;
      image?: string | null;
      duration: string;
      cost: string;
      durationMinutes?: number;
      isHotel?: boolean;
      isPlaceholder?: boolean;
      detailPlaceId?: string;
      savedDescription?: string | null;
      savedCategoryLabel?: string | null;
      savedRating?: number;
    },
    day: number,
    index: number
  ) => {
    if (event.isHotel || event.isPlaceholder) return;
    const placeId = (event.detailPlaceId ?? event.id).replace(/-(lunch|dinner)$/, "");
    activeDetailPlaceIdRef.current = placeId;
    const startTime = adjustedStartByDay[day]?.[index] ?? "";
    const durationMinutes =
      typeof event.durationMinutes === "number" && event.durationMinutes > 0
        ? event.durationMinutes
        : 60;
    setActiveEvent({
      day,
      index,
      id: placeId,
      title: event.title,
      image: event.image,
      duration: event.duration,
      durationMinutes,
      cost: event.cost,
      startTime,
    });
    // Seed the picker with the closest chip option so the current duration is
    // visibly highlighted; using `event.duration` would be a formatted range
    // string like "1–2 hrs" that never matches any chip label.
    setEditDuration(minutesToPickerOption(durationMinutes));
    setEditBudget(event.cost);
    setEditDescription(activeDetail?.description ?? "");
    setIsEditingDescription(false);
    setShowDurationPicker(false);
    setShowBudgetPicker(false);
    setDetailExpanded(false);

    // Render immediately from saved itinerary data, then enrich with Google
    // Places details below. Saved photos/descriptions should be a fallback, not
    // a reason to skip address/phone/website/open-hours hydration.
    const fallback = buildPlaceDetailsFromSavedItinerary(placeId, event);
    setActiveDetail(fallback);
    setEditDescription(fallback.description ?? "No detailed description available.");

    if (!isLikelyGooglePlaceId(placeId)) {
      setDetailLoading(false);
      return;
    }

    setDetailLoading(true);
    try {
      const detail = await fetchPlaceDetails(placeId);
      if (activeDetailPlaceIdRef.current !== placeId) return;
      if (detail) {
        setActiveDetail((prev) => {
          const base = prev ?? fallback;
          return {
            ...base,
            ...detail,
            imageUrl: detail.imageUrl ?? base.imageUrl ?? fallback.imageUrl,
            description: detail.description ?? base.description ?? fallback.description,
            displayCategoryLabel:
              detail.displayCategoryLabel ?? base.displayCategoryLabel ?? fallback.displayCategoryLabel,
            rating: detail.rating ?? base.rating ?? fallback.rating,
            formattedAddress: detail.formattedAddress ?? base.formattedAddress,
            phone: detail.phone ?? base.phone,
            website: detail.website ?? base.website,
            openHoursText: detail.openHoursText ?? base.openHoursText,
            openNow: detail.openNow ?? base.openNow,
            priceLevel: detail.priceLevel ?? base.priceLevel,
            costLevel: detail.costLevel ?? base.costLevel,
            estimatedDurationMinutes: detail.estimatedDurationMinutes ?? base.estimatedDurationMinutes,
          };
        });
        if (detail.description) setEditDescription(detail.description);
      }
    } finally {
      if (activeDetailPlaceIdRef.current === placeId) setDetailLoading(false);
    }
  };

  const handleEditMoveRow = (fromDay: number, fromIndex: number, toDay: number, toIndex: number) => {
    setEditRowsDraft((prev) => {
      const fromKey = String(fromDay);
      const toKey = String(toDay);
      const next = { ...prev };
      if (fromDay === toDay) {
        const list = [...(next[fromKey] ?? [])];
        if (fromIndex < 0 || fromIndex >= list.length) return prev;
        const [item] = list.splice(fromIndex, 1);
        if (!item) return prev;
        let ins = Math.max(0, Math.min(toIndex, list.length));
        if (fromIndex < ins) ins -= 1;
        list.splice(ins, 0, item);
        next[fromKey] = list;
      } else {
        const fromList = [...(next[fromKey] ?? [])];
        const toList = [...(next[toKey] ?? [])];
        if (fromIndex < 0 || fromIndex >= fromList.length) return prev;
        const [item] = fromList.splice(fromIndex, 1);
        if (!item) return prev;
        const ins = Math.max(0, Math.min(toIndex, toList.length));
        toList.splice(ins, 0, item);
        next[fromKey] = fromList;
        next[toKey] = toList;
      }
      return next;
    });
  };

  const handleRemoveEditRow = (dayNum: number, index: number) => {
    setEditRowsDraft((prev) => {
      const k = String(dayNum);
      const list = [...(prev[k] ?? [])];
      list.splice(index, 1);
      return { ...prev, [k]: list };
    });
  };

  const handleAddActivityRow = (dayNum: number) => {
    const id = `new-${dayNum}-${Date.now()}`;
    setEditRowsDraft((prev) => {
      const k = String(dayNum);
      const list = [...(prev[k] ?? [])];
      list.push({
        id,
        kind: "activity",
        placeId: `pending-${id}`,
        isPlaceholder: true,
        activityLabel: "",
      });
      return { ...prev, [k]: list };
    });
  };

  /** Update hotel row; if draft for that day is missing, hydrate from saved/default rows so typing never wipes the day. */
  const updateHotelRow = (
    dayNum: number,
    rowId: string,
    patch: { hotelLabel?: string; placeId?: string | undefined }
  ) => {
    setEditRowsDraft((prev) => {
      const k = String(dayNum);
      let list = prev[k];
      if (!list?.length && trip && savedItinerary) {
        const fromSaved = savedItinerary.editRowsByDay?.[k];
        if (fromSaved?.length) list = [...fromSaved];
        else {
          const built = buildDefaultEditRows(savedItinerary, trip.name, trip.createdAt, hotelsByDay)[k];
          list = built ? [...built] : [];
        }
      }
      if (!list?.length) return prev;
      const list2 = list.map((r) => (r.id === rowId ? { ...r, ...patch } : r));
      return { ...prev, [k]: list2 };
    });
  };

  /** Update activity row (placeholder/new activity editor). */
  const updateActivityRow = (
    dayNum: number,
    rowId: string,
    patch: { activityLabel?: string; placeId?: string | undefined; isPlaceholder?: boolean }
  ) => {
    setEditRowsDraft((prev) => {
      const k = String(dayNum);
      let list = prev[k];
      if (!list?.length && trip && savedItinerary) {
        const fromSaved = savedItinerary.editRowsByDay?.[k];
        if (fromSaved?.length) list = [...fromSaved];
        else {
          const built = buildDefaultEditRows(savedItinerary, trip.name, trip.createdAt, hotelsByDay)[k];
          list = built ? [...built] : [];
        }
      }
      if (!list?.length) return prev;
      const list2 = list.map((r) => (r.id === rowId ? { ...r, ...patch } : r));
      return { ...prev, [k]: list2 };
    });
  };

  const handleStartItineraryEdit = () => {
    if (!savedItinerary || !trip) return;
    const initial =
      savedItinerary.editRowsByDay && Object.keys(savedItinerary.editRowsByDay).length > 0
        ? { ...savedItinerary.editRowsByDay }
        : buildDefaultEditRows(savedItinerary, trip.name, trip.createdAt, hotelsByDay);
    setEditRowsDraft(initial);
    setItineraryEditMode(true);
  };

  const handleSaveItineraryEdit = () => {
    if (!savedItinerary || !trip) return;
    saveItinerary({ ...savedItinerary, editRowsByDay: editRowsDraft });
    setItineraryEditMode(false);
    setEditRowsDraft({});
    setItineraryRev((n) => n + 1);
  };

  /**
   * Persist the duration the user picked in the activity detail sheet.
   *
   * Walks `savedItinerary.days[].blocks[].activities[]` plus the lunch/dinner
   * meal slots, finds entries whose `placeId` matches the open sheet on the
   * matching `dayIndex`, and rewrites both `durationMinutes` and `endTime`
   * (computed as startTime + new duration). The transit snapshot is cleared
   * so the next render recomputes inter-stop timing from the new chain.
   *
   * No-ops when the parsed picker value matches the existing duration so we
   * don't churn storage on a sheet close that didn't change anything.
   */
  const applyDurationEdit = () => {
    if (!savedItinerary || !activeEvent) return;
    const targetMinutes = parseDurationPickerToMinutes(editDuration);
    if (
      !Number.isFinite(targetMinutes) ||
      targetMinutes <= 0 ||
      targetMinutes === activeEvent.durationMinutes
    ) {
      return;
    }
    const targetPlaceId = activeEvent.id;
    const targetDayIndex = activeEvent.day;
    let changed = false;

    const updateScheduled = (sa: ScheduledActivity): ScheduledActivity => {
      if (sa.placeId !== targetPlaceId) return sa;
      changed = true;
      const startM = hhmmToMinutes(sa.startTime);
      return {
        ...sa,
        durationMinutes: targetMinutes,
        endTime: minutesToHhmm(startM + targetMinutes),
      };
    };

    const nextDays = savedItinerary.days.map((d) => {
      if (d.dayIndex !== targetDayIndex) return d;
      return {
        ...d,
        blocks: d.blocks.map((b) => ({
          ...b,
          activities: b.activities.map(updateScheduled),
        })),
        lunchSlot: d.lunchSlot.activity
          ? { ...d.lunchSlot, activity: updateScheduled(d.lunchSlot.activity) }
          : d.lunchSlot,
        dinnerSlot: d.dinnerSlot.activity
          ? { ...d.dinnerSlot, activity: updateScheduled(d.dinnerSlot.activity) }
          : d.dinnerSlot,
      };
    });

    if (!changed) return;
    saveItinerary({ ...savedItinerary, days: nextDays, transitSnapshot: undefined });
    setItineraryRev((n) => n + 1);
    setActiveEvent({ ...activeEvent, durationMinutes: targetMinutes });
  };

  const getCurrentRowsByDay = (): Record<string, ItineraryEditRow[]> => {
    if (Object.keys(editRowsDraft).length > 0) return editRowsDraft;
    if (!savedItinerary || !trip) return {};
    if (savedItinerary.editRowsByDay && Object.keys(savedItinerary.editRowsByDay).length > 0) {
      return savedItinerary.editRowsByDay;
    }
    return buildDefaultEditRows(savedItinerary, trip.name, trip.createdAt, hotelsByDay);
  };

  const applyAiProposalsToRows = (
    base: Record<string, ItineraryEditRow[]>,
    selected: AiEnhanceProposal[]
  ): Record<string, ItineraryEditRow[]> => {
    const next: Record<string, ItineraryEditRow[]> = {};
    for (const [k, rows] of Object.entries(base)) {
      next[k] = rows.map((r) => ({ ...r }));
    }

    for (const proposal of selected) {
      const patch = proposal.patch;
      const key = String(patch.day);
      const rows = next[key] ?? [];

      if (patch.kind === "update_row") {
        next[key] = rows.map((r) => (r.id === patch.rowId ? { ...r, ...patch.changes } : r));
        continue;
      }
      if (patch.kind === "remove_row") {
        next[key] = rows.filter((r) => r.id !== patch.rowId);
        continue;
      }
      if (patch.kind === "insert_row") {
        const insertAt = patch.index == null ? rows.length : Math.max(0, Math.min(patch.index, rows.length));
        const row = { ...patch.row };
        if (!row.id) row.id = `ai-${patch.day}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const copy = [...rows];
        copy.splice(insertAt, 0, row);
        next[key] = copy;
      }
    }

    return next;
  };

  const handleAiEnhance = async () => {
    if (!trip || !savedItinerary) return;
    if (!aiEnhanceGoal.trim() && !aiDissatisfaction.trim()) {
      setAiError("Please tell us what you want to enhance.");
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await requestAiEnhance({
        trip: {
          id: trip.id,
          name: trip.name,
          destination: trip.destination,
          tripDays: trip.tripDays,
          createdAt: trip.createdAt,
        },
        itinerary: {
          tripId: savedItinerary.tripId,
          days: savedItinerary.days,
          editRowsByDay: savedItinerary.editRowsByDay,
        },
        currentEditRowsByDay: getCurrentRowsByDay(),
        enhanceRequest: aiEnhanceGoal,
        dissatisfaction: aiDissatisfaction,
      });

      const proposals = result.proposals ?? [];
      setAiSummary(result.summary || "Here are a few improvements you can apply.");
      setAiProposals(proposals);
      const nextSelected: Record<string, boolean> = {};
      for (const p of proposals) nextSelected[p.id] = false;
      setAiSelectedProposalIds(nextSelected);
      setAiModalOpen(false);

      // Enter itinerary edit mode so the AI Summary + Proposed Changes panels
      // (gated on `itineraryEditMode`) become visible. Hydrate the draft from
      // the saved row order, mirroring `handleStartItineraryEdit`.
      if (proposals.length > 0) {
        const initialRows =
          savedItinerary.editRowsByDay && Object.keys(savedItinerary.editRowsByDay).length > 0
            ? { ...savedItinerary.editRowsByDay }
            : buildDefaultEditRows(savedItinerary, trip.name, trip.createdAt, hotelsByDay);
        setEditRowsDraft(initialRows);
        setItineraryEditMode(true);
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Failed to enhance itinerary.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplySelectedAiChanges = () => {
    if (!savedItinerary || !trip) return;
    const selected = aiProposals.filter((p) => aiSelectedProposalIds[p.id]);
    if (selected.length === 0) return;
    const nextRows = applyAiProposalsToRows(getCurrentRowsByDay(), selected);
    saveItinerary({
      ...savedItinerary,
      editRowsByDay: nextRows,
      transitSnapshot: undefined,
    });
    // Stay in edit mode so the user can review/tweak the applied changes
    // before tapping Save itinerary. The draft mirrors what was just saved.
    setEditRowsDraft(nextRows);
    setItineraryEditMode(true);
    setItineraryRev((n) => n + 1);
    setAiSummary("");
    setAiProposals([]);
    setAiSelectedProposalIds((prev) => {
      const next = { ...prev };
      for (const p of aiProposals) {
        if (prev[p.id]) next[p.id] = false;
      }
      return next;
    });
  };

  useEffect(() => {
    if (itineraryEditMode) {
      setTransitByDay((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      setAdjustedStartByDay((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }
    if (!hasSavedItinerary || displayDays.length === 0 || !savedItinerary) {
      setTransitByDay((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      setAdjustedStartByDay((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }

    const snap = savedItinerary.transitSnapshot;
    if (snap && snap.layoutFingerprint === transitLayoutFingerprint) {
      const transitMap: Record<number, TransitInfo[]> = {};
      for (const [k, v] of Object.entries(snap.transitByDay)) {
        transitMap[Number(k)] = v as TransitInfo[];
      }
      const adjustedMap: Record<number, string[]> = {};
      for (const [k, v] of Object.entries(snap.adjustedStartByDay)) {
        adjustedMap[Number(k)] = v;
      }
      // Defensive self-heal: even if the snapshot fingerprint matches, force
      // any meal-slot row to display at its reserved meal time (or later, if
      // the chain ran past it). Older snapshots may have been computed before
      // meal anchoring existed and would otherwise show 9:10 AM for noon
      // lunch; the version bump in transitLayoutFingerprint mainly catches
      // pre-fix snapshots, this guard keeps display correct if any slip past.
      for (const day of displayDays) {
        const arr = adjustedMap[day.day];
        if (!arr) continue;
        for (let i = 0; i < day.events.length; i++) {
          const ev = day.events[i];
          if (!ev) continue;
          if (ev.id.endsWith("-lunch") || ev.id.endsWith("-dinner")) {
            const current = arr[i];
            const currentMin = current ? parseTimeLabelToMinutes(current) : -Infinity;
            const anchorMin = parseTimeLabelToMinutes(ev.time);
            if (currentMin < anchorMin) arr[i] = minutesToTimeLabel(anchorMin);
          }
        }
      }
      setTransitByDay(transitMap);
      setAdjustedStartByDay(adjustedMap);
      return;
    }

    let cancelled = false;
    const run = async () => {
      const layoutFp = transitLayoutFingerprint;
      const transitMap: Record<number, TransitInfo[]> = {};
      const adjustedMap: Record<number, string[]> = {};

      for (const day of displayDays) {
        const transits: TransitInfo[] = [];
        for (let i = 0; i < day.events.length - 1; i++) {
          const current = day.events[i];
          const next = day.events[i + 1];
          if (current.location && next.location) {
            const info = await getApproxTransitInfo(current.location, next.location);
            transits.push(info);
          } else {
            transits.push({ method: "drive", minutes: 10, source: "heuristic" });
          }
        }
        transitMap[day.day] = transits;

        if (day.events.length > 0) {
          const starts: string[] = [];
          let t = parseTimeLabelToMinutes(day.events[0].time);
          starts.push(minutesToTimeLabel(t));
          for (let i = 1; i < day.events.length; i++) {
            const prevEv = day.events[i - 1];
            const currEv = day.events[i];
            const transit = transits[i - 1]?.minutes ?? 0;
            t = t + (prevEv.durationMinutes ?? 60) + transit;
            // Meal slots are pinned to their reserved window, so never let
            // transit-chain display math pull lunch/dinner earlier than the
            // scheduled slot shown in edit mode.
            if (currEv.id.endsWith("-lunch") || currEv.id.endsWith("-dinner")) {
              t = Math.max(t, parseTimeLabelToMinutes(currEv.time));
            }
            starts.push(minutesToTimeLabel(t));
          }
          adjustedMap[day.day] = starts;
        }
      }
      if (!cancelled) {
        setTransitByDay(transitMap);
        setAdjustedStartByDay(adjustedMap);
        if (trip?.id) {
          upsertItineraryTransitSnapshot({
            tripId: trip.id,
            layoutFingerprint: layoutFp,
            transitByDay: transitMap,
            adjustedStartByDay: adjustedMap,
          });
          setItineraryRev((n) => n + 1);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [
    hasSavedItinerary,
    transitLayoutFingerprint,
    itineraryEditMode,
    savedItinerary,
    displayDays,
    trip?.id,
  ]);

  if (tripId && !trip) {
  return (
      <div className="flex flex-col min-h-screen bg-white items-center justify-center px-5">
        <p className="font-bold text-[#3C3C3C]">Trip not found</p>
        <button onClick={() => navigate("/")} className="mt-4 text-[#1CB0F6] font-bold text-sm">
          Back to home
        </button>
      </div>
    );
  }

  if (!trip) return null;

  // Preference completion is tracked per-member: the current user's status
  // governs whether their own row reads "done", but the row stays clickable so
  // they can re-open the preference flow and tweak their answers — until every
  // member has finished, at which point voting becomes the next gate and we
  // freeze preferences (locking the row).
  const currentMemberPreferenceComplete =
    currentMember?.preferenceStatus === "completed";

  // ─── Optional logistics-tab steps (hotel + flights) ──────────────────
  // Both are optional per design: they don't lock anything downstream and
  // the user can complete the trip without them, but they show up as steps
  // for visibility & to nudge the user toward filling them in.
  const hotelStepComplete = hotels.length > 0;
  const firstHotel = hotels[0];
  const hotelSublabel = hotelStepComplete && firstHotel
    ? `${firstHotel.name} · Day ${firstHotel.dayStart} → Day ${firstHotel.dayEnd}`
    : "Optional · set check-in & check-out";

  const flightDoneCount = members.filter((m) =>
    flights.some((f) => f.memberId === m.id)
  ).length;
  const flightStepComplete =
    members.length > 0 && flightDoneCount === members.length;
  const memberStillNeedingFlight = members.find(
    (m) => !flights.some((f) => f.memberId === m.id)
  );
  const flightSublabel =
    members.length === 0
      ? "Optional · invite members first"
      : flightStepComplete
        ? `${flightDoneCount} of ${members.length} added`
        : flightDoneCount > 0 && memberStillNeedingFlight
          ? `${flightDoneCount} of ${members.length} · ${memberStillNeedingFlight.name} still needed`
          : "Optional · collect each guest's flight";

  const inviteSublabel = inviteStepComplete
    ? `${members.length} member${members.length === 1 ? "" : "s"} joined`
    : undefined;

  const planningSteps = [
    {
      id: 1,
      label: "Invite Friend",
      step: "invite" as const,
      completed: inviteStepComplete,
      sublabel: inviteSublabel,
      locked: false,
      clickableWhenCompleted: false,
    },
    {
      id: 2,
      label: "Add a hotel",
      step: "hotel" as const,
      completed: hotelStepComplete,
      sublabel: hotelSublabel,
      locked: false,
      clickableWhenCompleted: true,
    },
    {
      id: 3,
      label: "Add everyone's flights",
      step: "flight" as const,
      completed: flightStepComplete,
      sublabel: flightSublabel,
      locked: false,
      clickableWhenCompleted: true,
    },
    {
      id: 4,
      label: "Set Your Preference",
      step: "preference" as const,
      completed: currentMemberPreferenceComplete,
      sublabel: undefined,
      locked: allPreferencesComplete,
      clickableWhenCompleted: true,
    },
    {
      id: 5,
      label: "Vote on Activity",
      step: "vote" as const,
      completed: false,
      sublabel: undefined,
      locked: !voteUnlocked,
      clickableWhenCompleted: false,
    },
    {
      id: 6,
      label: hasSavedItinerary ? "View Trip Itinerary" : "Generate Trip Itinerary",
      step: "plan" as const,
      completed: hasSavedItinerary,
      sublabel: undefined,
      locked: !hasSavedItinerary,
      clickableWhenCompleted: false,
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F7F7]">
      <TripHero
        title={trip.name}
        destination={trip.destination}
        dateLabel={trip.tripDays > 0 ? `${trip.tripDays} day${trip.tripDays === 1 ? "" : "s"}`
          : new Date(trip.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        guestCount={trip.maxGuests > 0 ? trip.maxGuests : MAX_TRIP_MEMBERS}
        coverImageUrl={DEFAULT_TRIP_IMG}
        onBack={() => navigate("/")}
        onMore={() => setSheetOpen(true)}
      />

      {hasSavedItinerary && savedItinerary ? (
        /* STATE 2 — Completed Trip State: full saved itinerary */
        <div className={`px-5 mt-4 flex flex-col gap-4 ${itineraryEditMode ? "pb-40" : "pb-6"}`}>
          {/* Full itinerary: days and events */}
          <div className="flex flex-col gap-3">
            {/* Summary bar (also shown on TripPlan -> TripDetail after Save) */}
            <div className="bg-white rounded-2xl border-2 border-[#58CC02] shadow-[0_4px_0_#46A302] p-4">
              <div className="flex justify-around">
                <div className="text-center">
                  <div className="font-black text-[#3C3C3C] text-2xl">{tripDaysCountForEstimate}</div>
                  <div className="text-xs font-bold text-[#AFAFAF]">Days</div>
                </div>
                <div className="w-px bg-[#E5E5E5]" />
                <div className="text-center">
                  <div className="font-black text-[#3C3C3C] text-2xl">{totalActivities}</div>
                  <div className="text-xs font-bold text-[#AFAFAF]">Activities</div>
                </div>
                <div className="w-px bg-[#E5E5E5]" />
                <div className="text-center">
                  <div className="font-black text-[#3C3C3C] text-2xl">{membersCount}</div>
                  <div className="text-xs font-bold text-[#AFAFAF]">Members</div>
                </div>
                <div className="w-px bg-[#E5E5E5]" />
                <div className="text-center">
                  <div className="font-black text-[#58CC02] text-2xl">{estPerPerson}</div>
                  <div className="text-xs font-bold text-[#AFAFAF]">Est./person</div>
                </div>
              </div>
            </div>
            <h2 className="font-black text-[#3C3C3C] text-base uppercase tracking-[0.4px]">
              🗺️ ITINERARY
            </h2>
            {itineraryEditMode && aiSummary && (
              <div className="bg-[#E8F7FF] border-2 border-[#B3E4FF] rounded-2xl p-3">
                <p className="text-[11px] font-black uppercase text-[#1CB0F6] mb-1">AI summary</p>
                <p className="text-sm font-bold text-[#3C3C3C]">{aiSummary}</p>
              </div>
            )}
            {itineraryEditMode && aiProposals.length > 0 && (
              <div className="bg-white border-2 border-[#E5E5E5] rounded-2xl p-3 flex flex-col gap-2">
                <p className="text-[11px] font-black uppercase text-[#AFAFAF]">Proposed changes</p>
                {aiProposals.map((proposal) => (
                  <label
                    key={proposal.id}
                    className="flex items-start gap-2 rounded-xl border border-[#ECECEC] px-2.5 py-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={!!aiSelectedProposalIds[proposal.id]}
                      onChange={(e) =>
                        setAiSelectedProposalIds((prev) => ({ ...prev, [proposal.id]: e.target.checked }))
                      }
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-black text-[#3C3C3C]">{proposal.title}</p>
                      <p className="text-xs font-bold text-[#AFAFAF]">{proposal.reason}</p>
                    </div>
                  </label>
                ))}
                <button
                  type="button"
                  onClick={handleApplySelectedAiChanges}
                  className="mt-1 w-full py-2.5 rounded-xl border-2 border-[#1CB0F6] text-[#1CB0F6] font-black text-sm bg-white shadow-[0_3px_0_#B3E4FF]"
                >
                  Apply selected changes
                </button>
                <p className="text-[11px] font-bold text-[#AFAFAF]">
                  Applies directly to your saved itinerary.
                </p>
              </div>
            )}
            {displayDays.map((day) => {
              const isExpanded = expandedDay === day.day;
              const dayExpanded = itineraryEditMode || isExpanded;
              const dayTimeline = timelineByDay?.get(day.day);
              const showSplitTimeline = Boolean(
                useSplitTimelineView && dayTimeline?.hasSplit
              );
              return (
                <div
                  key={day.day}
                  className={`bg-white rounded-2xl border-2 overflow-hidden transition-all ${
                    dayExpanded
                      ? "border-[#58CC02] shadow-[0_4px_0_#46A302]"
                      : "border-[#E5E5E5] shadow-[0_4px_0_#D4D4D4]"
                  }`}
                >
                  <button
                    type="button"
                    className="w-full flex flex-col gap-2 p-4 text-left disabled:opacity-100"
                    onClick={() => !itineraryEditMode && setExpandedDay(isExpanded ? null : day.day)}
                    disabled={itineraryEditMode}
                  >
                    <div className="w-full flex items-start gap-3">
                      <div
                        className={`w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0 text-xl border-2 ${
                          dayExpanded
                            ? "bg-[#F0FDE4] border-[#46A302]"
                            : "bg-[#F7F7F7] border-[#E5E5E5]"
                        }`}
                      >
                        {day.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span
                          className={`text-xs font-black uppercase tracking-[0.6px] ${
                            dayExpanded ? "text-[#58CC02]" : "text-[#AFAFAF]"
                          }`}
                        >
                          Day {day.day}
                        </span>
                        {day.date && (
                          <span className="block text-xs font-bold text-[#AFAFAF] leading-tight">
                            {day.date}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 pt-1">
                        <span className="text-xs font-bold text-[#AFAFAF]">
                          {day.events.length} stops
                        </span>
                        {itineraryEditMode ? (
                          <span className="text-[10px] font-black uppercase text-[#58CC02]">Edit</span>
                        ) : isExpanded ? (
                          <ChevronUp size={18} className="text-[#58CC02]" />
                        ) : (
                          <ChevronDown size={18} className="text-[#AFAFAF]" />
                        )}
                      </div>
                    </div>
                    <h3 className="font-black text-[#3C3C3C] text-lg leading-snug break-words pl-[56px]">
                      {itineraryEditMode ? "Reorder your day" : day.title}
                    </h3>
                  </button>

                  {dayExpanded && day.events.length > 0 && showSplitTimeline && dayTimeline ? (
                    <DaySplitTimeline
                      rows={dayTimeline.rows}
                      members={members}
                      adjustedTimes={adjustedStartByDay[day.day] ?? []}
                      transitByDay={transitByDay[day.day] ?? []}
                      onOpenEvent={(event, idx) =>
                        openActivityDetail(
                          {
                            id: event.id,
                            title: event.title,
                            image: event.image,
                            duration: event.duration,
                            durationMinutes: event.durationMinutes,
                            cost: event.cost,
                            isHotel: event.isHotel,
                            isPlaceholder: event.isPlaceholder,
                            detailPlaceId: event.detailPlaceId,
                            savedDescription: event.savedDescription,
                            savedCategoryLabel: event.savedCategoryLabel,
                            savedRating: event.savedRating,
                          },
                          day.day,
                          idx
                        )
                      }
                    />
                  ) : dayExpanded && day.events.length > 0 ? (
                    <div className="border-t-2 border-[#F0F0F0]">
                      {day.events.map((event, idx) => (
                        <div
                          key={event.id}
                          className="relative"
                          draggable={itineraryEditMode}
                          onDragStart={
                            itineraryEditMode
                              ? (e) => {
                                  e.dataTransfer.setData(
                                    "application/json",
                                    JSON.stringify({ day: day.day, index: idx })
                                  );
                                  e.dataTransfer.effectAllowed = "move";
                                }
                              : undefined
                          }
                          onDragOver={itineraryEditMode ? (e) => e.preventDefault() : undefined}
                          onDrop={
                            itineraryEditMode
                              ? (e) => {
                                  e.preventDefault();
                                  try {
                                    const raw = e.dataTransfer.getData("application/json");
                                    const data = JSON.parse(raw) as { day: number; index: number };
                                    if (data.day == null || data.index == null) return;
                                    if (data.day === day.day && data.index === idx) return;
                                    handleEditMoveRow(data.day, data.index, day.day, idx);
                                  } catch {
                                    /* ignore */
                                  }
                                }
                              : undefined
                          }
                        >
                          {!itineraryEditMode && idx > 0 && (
                            <div className="absolute left-[26px] top-0 h-[28px] w-0.5 bg-[#E5E5E5]" />
                          )}
                          {!itineraryEditMode && idx < day.events.length - 1 && (
                            <div className="absolute left-[26px] top-[28px] bottom-0 w-0.5 bg-[#E5E5E5]" />
                          )}
                          <div
                            className={`w-full flex gap-3 p-4 ${itineraryEditMode ? "" : ""}`}
                          >
                            <div className="flex flex-col items-center w-5 flex-shrink-0 pt-1 relative z-10">
                              {itineraryEditMode ? (
                                <GripVertical size={18} className="text-[#AFAFAF]" aria-hidden />
                              ) : (
                                <div className="w-3 h-3 rounded-full bg-[#58CC02] border-2 border-white shadow-[0_0_0_2px_#58CC02]" />
                              )}
                </div>
                            {itineraryEditMode ? (
                              <div className="flex-1 min-w-0 text-left">
                                <div className="flex items-start gap-2 mb-1 flex-wrap">
                                  {event.isHotel || event.isPlaceholder ? (
                                    <span className="text-xs font-black text-[#AFAFAF] flex-shrink-0">
                                      {adjustedStartByDay[day.day]?.[idx] ?? event.time}
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openTimePicker(day.day, idx, event.time);
                                      }}
                                      className="text-xs font-black text-[#1CB0F6] flex-shrink-0 underline decoration-dotted underline-offset-[3px]"
                                      aria-label="Edit start time"
                                    >
                                      {adjustedStartByDay[day.day]?.[idx] ?? event.time}
                                    </button>
                                  )}
                                  <span
                                    className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                                    style={{
                                      color: event.categoryColor,
                                      backgroundColor: event.categoryBg,
                                    }}
                                  >
                                    {event.type}
                                  </span>
              </div>
                                {event.isHotel ? (
                                  <HotelPlaceAutocomplete
                                    destination={trip?.destination ?? ""}
                                    value={
                                      editRowsDraft[String(day.day)]?.[idx]?.hotelLabel ?? ""
                                    }
                                    onChange={(label) =>
                                      updateHotelRow(day.day, event.id, {
                                        hotelLabel: label,
                                        placeId: undefined,
                                      })
                                    }
                                    onPick={(placeId, name) =>
                                      updateHotelRow(day.day, event.id, {
                                        hotelLabel: name,
                                        placeId,
                                      })
                                    }
                                    placeholder="Add your hotel"
                                    inputClassName="w-full mt-1 font-black text-[#3C3C3C] text-base bg-[#F7F7F7] border border-[#ECECEC] rounded-xl px-3 py-2"
                                  />
                                ) : event.isPlaceholder ? (
                                  <ActivityPlaceAutocomplete
                                    destination={trip?.destination ?? ""}
                                    value={
                                      editRowsDraft[String(day.day)]?.[idx]?.activityLabel ?? ""
                                    }
                                    onChange={(label) =>
                                      updateActivityRow(day.day, event.id, {
                                        activityLabel: label,
                                      })
                                    }
                                    onPick={(placeId, name) =>
                                      updateActivityRow(day.day, event.id, {
                                        activityLabel: name,
                                        placeId,
                                        isPlaceholder: true,
                                      })
                                    }
                                    placeholder="Enter location or place name"
                                    inputClassName="w-full mt-1 font-black text-[#3C3C3C] text-base bg-[#F7F7F7] border border-[#ECECEC] rounded-xl px-3 py-2"
                                  />
                                ) : (
                                  <h4 className="font-black text-[#3C3C3C] text-base">{event.title}</h4>
                                )}
            </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  openActivityDetail(
                                    {
                                      id: event.id,
                                      title: event.title,
                                      image: event.image,
                                      duration: event.duration,
                                      durationMinutes: event.durationMinutes,
                                      cost: event.cost,
                                      isHotel: event.isHotel,
                                      isPlaceholder: event.isPlaceholder,
                                      detailPlaceId: event.detailPlaceId,
                                      savedDescription: event.savedDescription,
                                      savedCategoryLabel: event.savedCategoryLabel,
                                      savedRating: event.savedRating,
                                    },
                                    day.day,
                                    idx
                                  )
                                }
                                className="flex-1 min-w-0 text-left flex items-start gap-3"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start gap-2 mb-1 flex-wrap">
                                    <span className="text-xs font-black text-[#AFAFAF] flex-shrink-0">
                                      {adjustedStartByDay[day.day]?.[idx] ?? event.time}
                                    </span>
                                    <span
                                      className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                                      style={{
                                        color: event.categoryColor,
                                        backgroundColor: event.categoryBg,
                                      }}
                                    >
                                      {event.type}
                                    </span>
                                  </div>
                                  <h4 className="font-black text-[#3C3C3C] text-base leading-snug break-words">
                                    {event.title}
                                  </h4>
                                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                    {event.duration && (
                                      <div className="flex items-center gap-1">
                                        <Clock size={11} className="text-[#AFAFAF]" />
                                        <span className="text-xs font-bold text-[#AFAFAF]">
                                          {event.duration}
                                        </span>
                                      </div>
                                    )}
                                    {event.cost && (
                                      <span className="text-xs font-bold text-[#AFAFAF]">
                                        💵 {event.cost}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {event.image && (
                                  <img
                                    src={event.image}
                                    alt={event.title}
                                    className="w-16 h-16 aspect-square object-cover rounded-xl flex-shrink-0"
                                  />
                                )}
                              </button>
                            )}
                            {itineraryEditMode && (
                              <button
                                type="button"
                                aria-label="Remove stop"
                                className="w-9 h-9 flex-shrink-0 rounded-xl border-2 border-[#FFD6D6] text-[#FF4B4B] flex items-center justify-center"
                                onClick={() => handleRemoveEditRow(day.day, idx)}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                          {!itineraryEditMode && idx < day.events.length - 1 && transitByDay[day.day]?.[idx] && (
                            <div className="px-4 h-8 flex items-center">
                              <div className="ml-8 text-[11px] font-bold text-[#AFAFAF] flex items-center gap-2 leading-none">
                                <span>
                                  {transitByDay[day.day]?.[idx]?.method === "walk" ? "🚶" : "🚗"}
                                </span>
                                <span>
                                  {transitByDay[day.day]?.[idx]?.source === "heuristic" ? "~" : ""}
                                  {transitByDay[day.day]?.[idx]?.minutes} min transit
                                </span>
                                <span className="text-[#D4D4D4]">•</span>
                                <span className="uppercase">{transitByDay[day.day]?.[idx]?.method}</span>
                                {transitByDay[day.day]?.[idx]?.source === "heuristic" && (
                                  <>
                                    <span className="text-[#D4D4D4]">•</span>
                                    <span className="uppercase">EST.</span>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {itineraryEditMode && (
                        <>
                          <div
                            className="h-10 border-t border-dashed border-[#E5E5E5] flex items-center justify-center text-[11px] font-bold text-[#AFAFAF]"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              try {
                                const raw = e.dataTransfer.getData("application/json");
                                const data = JSON.parse(raw) as { day: number; index: number };
                                if (data.day == null || data.index == null) return;
                                const len = (editRowsDraft[String(day.day)] ?? []).length;
                                handleEditMoveRow(data.day, data.index, day.day, len);
                              } catch {
                                /* ignore */
                              }
                            }}
                          >
                            Drop here to move to end of day
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddActivityRow(day.day)}
                            className="w-full py-3 text-sm font-black text-[#1CB0F6] border-t-2 border-[#F0F0F0] active:bg-[#F7F7F7]"
                          >
                            + Add activity
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Edit / AI Improve at bottom */}
          {!itineraryEditMode && (
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleStartItineraryEdit}
                className="flex-1 py-3.5 rounded-2xl border-2 border-[#58CC02] bg-[#58CC02] text-white font-black text-sm shadow-[0_3px_0_#46A302]"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setAiError(null);
                  setAiModalOpen(true);
                }}
                className="flex-1 py-3.5 rounded-2xl border-2 border-[#1CB0F6] bg-white text-[#1CB0F6] font-black text-sm shadow-[0_3px_0_#B3E4FF]"
              >
                AI Improve
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="px-5 mt-3 flex flex-col gap-3">
          <TripTabBar
            activeTab={activeTab}
            onChange={setActiveTab}
            planBadge={`${planningSteps.filter((s) => s.completed).length}/${planningSteps.length}`}
          />

          {/* Tab panels */}
          {activeTab === "plan" ? (
            <TabPanel id="plan-panel" labelId="tab-plan">
              <PlanTab
                members={members}
                steps={planningSteps.map((s) => ({
                  ...s,
                  // The hotel and flight steps live in the Logistics tab, so
                  // tapping them switches tabs rather than navigating away.
                  linkedTab:
                    s.step === "hotel" || s.step === "flight"
                      ? "logistics"
                      : undefined,
                }))}
                completedCount={planningSteps.filter((s) => s.completed).length}
                totalCount={planningSteps.length}
                onInvite={handleInviteClick}
                inviteDisabled={inviteStepComplete}
                onStepTap={(stepId, linkedTab) => {
                  if (linkedTab) {
                    setActiveTab(linkedTab as "logistics");
                    return;
                  }
                  const s = planningSteps.find((p) => p.id === stepId);
                  if (!s) return;
                  if (s.step === "invite") handleInviteClick();
                  else if (s.step === "preference") handleSetPreference();
                  else if (s.step === "vote") handleVoteClick();
                  else if (s.step === "plan" && !hasSavedItinerary) {
                    navigate(`/trips/${tripId}/plan`);
                  }
                }}
              />
            </TabPanel>
          ) : (
            <TabPanel id="logistics-panel" labelId="tab-logistics">
              <LogisticsTab
                hotels={hotels}
                tripDays={tripDaysCount}
                members={members}
                flights={flights}
                onAddHotel={openAddHotelSheet}
                onEditHotel={openEditHotelSheet}
                onAddFlight={() => {
                  setEditingFlightId(null);
                  setFlightSheetOpen(true);
                }}
                onEditFlight={(flightId) => {
                  setEditingFlightId(flightId);
                  setFlightSheetOpen(true);
                }}
              />
            </TabPanel>
          )}
        </div>
      )}

      {/* Bottom sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSheetOpen(false)}
            aria-hidden
          />
          <div className="relative bg-white rounded-t-3xl border-t-2 border-x-2 border-[#E5E5E5] shadow-[0_-4px_0_#D4D4D4] pb-8 pt-3">
            <div className="w-12 h-1 rounded-full bg-[#E5E5E5] mx-auto mb-4" aria-hidden />
            <div className="px-5 flex flex-col gap-1">
              <button
                onClick={() => {
                  setSheetOpen(false);
                  openEditTrip();
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left font-bold text-[#3C3C3C] hover:bg-[#F7F7F7] active:bg-[#F0F0F0] transition-colors"
              >
                <Pencil size={20} className="text-[#AFAFAF]" />
                Edit Trip Details
              </button>
              <button
                onClick={() => setSheetOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left font-bold text-[#3C3C3C] hover:bg-[#F7F7F7] active:bg-[#F0F0F0] transition-colors"
              >
                <HelpCircle size={20} className="text-[#AFAFAF]" />
                Help
              </button>
              <button
                onClick={() => setSheetOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left font-bold text-[#3C3C3C] hover:bg-[#F7F7F7] active:bg-[#F0F0F0] transition-colors"
              >
                <MessageCircle size={20} className="text-[#AFAFAF]" />
                Feedback
              </button>
              <button
                onClick={() => { setSheetOpen(false); setDeleteModalOpen(true); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left font-bold text-[#FF4B4B] hover:bg-[#FFF0F0] active:bg-[#FFE5E5] transition-colors"
              >
                <Trash2 size={20} />
                Delete
              </button>
      </div>
          </div>
        </div>
      )}

      {/* Activity detail bottom sheet */}
      {activeEvent && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              applyDurationEdit();
              activeDetailPlaceIdRef.current = null;
              setActiveEvent(null);
              setActiveDetail(null);
              setDetailLoading(false);
              setDetailExpanded(false);
            }}
            aria-hidden
          />
          <div
            className={`relative bg-white w-full max-w-[402px] mx-auto border-t-2 border-x-2 border-[#E5E5E5] ${
              detailExpanded
                ? "rounded-none min-h-screen"
                : "rounded-t-3xl shadow-[0_-4px_0_#D4D4D4] max-h-[76vh]"
            } overflow-y-auto mobile-sheet-scroll`}
            onTouchStart={(e) => {
              const y = e.touches[0]?.clientY ?? null;
              setDragStartY(y);
              setDragCurrentY(y);
            }}
            onTouchMove={(e) => setDragCurrentY(e.touches[0]?.clientY ?? null)}
            onTouchEnd={(e) => {
              if (dragStartY === null) return;
              const endY = dragCurrentY ?? e.changedTouches[0]?.clientY ?? dragStartY;
              const delta = dragStartY - endY;
              if (delta > 35) setDetailExpanded(true);
              if (delta < -45) setDetailExpanded(false);
              setDragStartY(null);
              setDragCurrentY(null);
            }}
          >
            <div className="sticky top-0 bg-white z-10 border-b border-[#F0F0F0]">
              <button
                type="button"
                className="w-full pt-2 pb-1 flex items-center justify-center"
                onClick={() => setDetailExpanded((s) => !s)}
                aria-label={detailExpanded ? "Collapse details" : "Expand details"}
              >
                <div className="w-12 h-1 rounded-full bg-[#E5E5E5]" aria-hidden />
              </button>
              <div className="px-4 pb-2.5 flex items-start gap-2">
                <button
                  type="button"
                  aria-label="Back"
                  className="w-9 h-9 rounded-xl border-2 border-[#E5E5E5] flex items-center justify-center text-[#4B4B4B] flex-shrink-0 mt-0.5"
                  onClick={() => {
                    applyDurationEdit();
                    activeDetailPlaceIdRef.current = null;
                    setActiveEvent(null);
                    setActiveDetail(null);
                    setDetailLoading(false);
                    setDetailExpanded(false);
                    setIsEditingDescription(false);
                    setShowDurationPicker(false);
                    setShowBudgetPicker(false);
                  }}
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.6px] font-black text-[#58CC02]">Activity Detail</p>
                  <h3 className="text-[#3C3C3C] font-black text-base leading-tight">{activeEvent.title}</h3>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                  <button
                    type="button"
                    aria-label="Reorder"
                    className="w-9 h-9 rounded-xl border-2 border-[#E5E5E5] flex items-center justify-center text-[#3C3C3C]"
                  >
                    <GripVertical size={18} />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete"
                    className="w-9 h-9 rounded-xl border-2 border-[#FFD6D6] flex items-center justify-center text-[#FF4B4B]"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 flex flex-col gap-3">
              <div className="flex gap-2.5">
                <img
                  src={activeDetail?.imageUrl ?? activeEvent.image ?? DEFAULT_TRIP_IMG}
                  alt={activeDetail?.name ?? activeEvent.title}
                  className={`rounded-xl object-cover border-2 border-[#EDEDED] ${
                    detailExpanded ? "w-24 h-24" : "w-20 h-20"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-[#AFAFAF] font-bold">
                    <Clock size={12} />
                    <span>{activeEvent.startTime || "Time TBD"}</span>
                  </div>
                  <p className="text-xs font-bold text-[#AFAFAF] mt-1">
                    {activeDetail?.displayCategoryLabel ?? "Activity"}
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    <Star size={13} className="text-[#FFD900]" fill="#FFD900" />
                    <span className="text-sm font-black text-[#3C3C3C]">
                      {activeDetail?.rating ? activeDetail.rating.toFixed(1) : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEditingDescription(true)}
                className="bg-[#F7F7F7] rounded-xl p-2.5 border border-[#ECECEC] text-left"
              >
                {isEditingDescription ? (
                  <textarea
                    autoFocus
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    onBlur={() => setIsEditingDescription(false)}
                    className="w-full min-h-[72px] text-xs font-bold text-[#6E6E6E] leading-relaxed bg-transparent outline-none resize-none"
                  />
                ) : (
                  <p className="text-xs font-bold text-[#6E6E6E] leading-relaxed">
                    {detailLoading
                      ? "Loading Google place details..."
                      : editDescription || "No detailed description available."}
                  </p>
                )}
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={!detailExpanded}
                  onClick={() => detailExpanded && setShowDurationPicker(true)}
                  className={`bg-white rounded-xl border border-[#ECECEC] p-2.5 text-left ${
                    detailExpanded ? "" : "opacity-70 cursor-not-allowed"
                  }`}
                >
                  <p className="text-[11px] font-black text-[#AFAFAF] uppercase">Duration</p>
                  <p className="mt-1 w-full text-sm font-bold text-[#3C3C3C]">{editDuration}</p>
                  {!detailExpanded && <p className="text-[10px] font-bold text-[#AFAFAF] mt-1">Expand to edit</p>}
                </button>
                <button
                  type="button"
                  disabled={!detailExpanded}
                  onClick={() => detailExpanded && setShowBudgetPicker(true)}
                  className={`bg-white rounded-xl border border-[#ECECEC] p-2.5 text-left ${
                    detailExpanded ? "" : "opacity-70 cursor-not-allowed"
                  }`}
                >
                  <p className="text-[11px] font-black text-[#AFAFAF] uppercase">Budget</p>
                  <p className="mt-1 w-full text-sm font-bold text-[#3C3C3C]">{editBudget}</p>
                  {!detailExpanded && <p className="text-[10px] font-bold text-[#AFAFAF] mt-1">Expand to edit</p>}
                </button>
              </div>

              <div className="bg-white rounded-xl border border-[#ECECEC] p-2.5 space-y-1.5">
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="text-[#AFAFAF] mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#3C3C3C]">{activeDetail?.formattedAddress ?? "No address"}</p>
                    <button
                      type="button"
                      onClick={() => {
                        const target = activeDetail?.formattedAddress || activeEvent.title;
                        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target)}`;
                        window.open(url, "_blank", "noopener,noreferrer");
                      }}
                      className="text-left text-xs font-bold text-[#1CB0F6] break-all mt-1"
                    >
                      Directions
                    </button>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Phone size={14} className="text-[#AFAFAF] mt-0.5" />
                  <p className="text-xs font-bold text-[#3C3C3C]">{activeDetail?.phone ?? "No phone"}</p>
                </div>
                <div className="flex items-start gap-2">
                  <Link2 size={14} className="text-[#AFAFAF] mt-0.5" />
                  <p className="text-xs font-bold text-[#1CB0F6] break-all">
                    {activeDetail?.website ?? "No website"}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#ECECEC] p-2.5">
                <p className="text-[11px] font-black text-[#AFAFAF] uppercase mb-1">Open hours</p>
                {(activeDetail?.openHoursText ?? []).length > 0 ? (
                  <div className="space-y-1">
                    {(activeDetail?.openHoursText ?? []).slice(0, detailExpanded ? 7 : 3).map((line) => (
                      <p key={line} className="text-xs font-bold text-[#3C3C3C]">{line}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-bold text-[#AFAFAF]">No open hour data</p>
                )}
              </div>

              {detailExpanded && (
                <div className="bg-white rounded-xl border border-[#ECECEC] p-3">
                  <p className="text-[11px] font-black text-[#AFAFAF] uppercase mb-2">Notes</p>
                  <textarea
                    value={detailNote}
                    onChange={(e) => setDetailNote(e.target.value)}
                    placeholder="Add notes for this activity..."
                    className="w-full min-h-[90px] text-sm font-bold text-[#3C3C3C] outline-none resize-none"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Duration picker (only full-page edit mode) */}
      {activeEvent && detailExpanded && showDurationPicker && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDurationPicker(false)} aria-hidden />
          <div className="relative bg-white rounded-t-3xl border-t-2 border-x-2 border-[#E5E5E5] shadow-[0_-4px_0_#D4D4D4] p-4">
            <div className="w-12 h-1 rounded-full bg-[#E5E5E5] mx-auto mb-3" />
            <p className="text-sm font-black text-[#3C3C3C] mb-3">Select duration</p>
            <div className="grid grid-cols-3 gap-2">
              {["30 min", "45 min", "1 hr", "1.5 hr", "2 hr", "3 hr", "4 hr"].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setEditDuration(option);
                    setShowDurationPicker(false);
                  }}
                  className={`py-2 rounded-xl border-2 text-xs font-black ${
                    editDuration === option
                      ? "border-[#58CC02] bg-[#F0FDE4] text-[#46A302]"
                      : "border-[#E5E5E5] text-[#3C3C3C]"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Inline start-time picker (itinerary edit mode only) */}
      {timePickerOpen && itineraryEditMode && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setTimePickerOpen(false)} aria-hidden />
          <div className="relative bg-white rounded-t-3xl border-t-2 border-x-2 border-[#E5E5E5] shadow-[0_-4px_0_#D4D4D4] p-4 max-w-[402px] w-full mx-auto">
            <div className="w-12 h-1 rounded-full bg-[#E5E5E5] mx-auto mb-3" />
            <p className="text-sm font-black text-[#3C3C3C] mb-3">Select start time</p>
            <div className="grid grid-cols-4 gap-2 max-h-[320px] overflow-y-auto pr-1">
              {TIME_PICKER_OPTIONS.map((hhmm) => {
                const label = minutesToTimeLabel(hhmmToMinutes(hhmm));
                const selected = hhmm === timePickerValueHhmm;
                return (
                  <button
                    key={hhmm}
                    type="button"
                    onClick={() => {
                      if (timePickerDay != null && timePickerIndex != null) {
                        applyTimeEdit(timePickerDay, timePickerIndex, hhmm);
                      }
                      setTimePickerValueHhmm(hhmm);
                      setTimePickerOpen(false);
                    }}
                    className={`py-2 rounded-xl border-2 text-xs font-black ${
                      selected
                        ? "border-[#58CC02] bg-[#F0FDE4] text-[#46A302]"
                        : "border-[#E5E5E5] text-[#3C3C3C]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Budget picker (only full-page edit mode) */}
      {activeEvent && detailExpanded && showBudgetPicker && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowBudgetPicker(false)} aria-hidden />
          <div className="relative bg-white rounded-t-3xl border-t-2 border-x-2 border-[#E5E5E5] shadow-[0_-4px_0_#D4D4D4] p-4">
            <div className="w-12 h-1 rounded-full bg-[#E5E5E5] mx-auto mb-3" />
            <p className="text-sm font-black text-[#3C3C3C] mb-3">Select budget</p>
            <div className="grid grid-cols-3 gap-2">
              {["$", "$$", "$$$", "$$$$"].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setEditBudget(option);
                    setShowBudgetPicker(false);
                  }}
                  className={`py-2 rounded-xl border-2 text-xs font-black ${
                    editBudget === option
                      ? "border-[#58CC02] bg-[#F0FDE4] text-[#46A302]"
                      : "border-[#E5E5E5] text-[#3C3C3C]"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit trip details bottom sheet */}
      {editTripOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setEditTripOpen(false)}
            aria-hidden
          />
          <div className="relative bg-white w-full max-w-[402px] mx-auto border-t-2 border-x-2 border-[#E5E5E5] rounded-t-3xl shadow-[0_-4px_0_#D4D4D4] pb-6 pt-3">
            <div className="w-12 h-1 rounded-full bg-[#E5E5E5] mx-auto mb-3" aria-hidden />
            <div className="px-5">
              <h3 className="font-black text-[#3C3C3C] text-lg mb-1">Edit trip</h3>
              <p className="text-xs font-bold text-[#AFAFAF] mb-4">
                Update the basics for this trip.
              </p>

              {/* Trip title */}
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.4px] text-[#AFAFAF]">
                  Trip title
                </span>
                <input
                  type="text"
                  value={editTripName}
                  onChange={(e) => setEditTripName(e.target.value)}
                  placeholder={trip.name}
                  className="mt-1 w-full px-3 py-3 rounded-2xl border-2 border-[#E5E5E5] focus:border-[#1CB0F6] outline-none font-bold text-[#3C3C3C] text-sm"
                />
              </label>

              {/* Trip days stepper */}
              <div className="mt-4">
                <span className="text-[11px] font-black uppercase tracking-[0.4px] text-[#AFAFAF]">
                  Trip days
                </span>
                <div className="mt-1 flex items-center justify-between px-3 py-2.5 rounded-2xl border-2 border-[#E5E5E5]">
                  <span className="font-bold text-[#3C3C3C] text-sm">
                    {editTripDays} {editTripDays === 1 ? "day" : "days"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Decrease days"
                      onClick={() => setEditTripDays((n) => Math.max(1, n - 1))}
                      disabled={editTripDays <= 1}
                      className="w-9 h-9 rounded-xl border-2 border-[#E5E5E5] flex items-center justify-center text-[#3C3C3C] disabled:opacity-40 active:translate-y-0.5"
                    >
                      <Minus size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label="Increase days"
                      onClick={() => setEditTripDays((n) => Math.min(14, n + 1))}
                      disabled={editTripDays >= 14}
                      className="w-9 h-9 rounded-xl border-2 border-[#58CC02] bg-[#58CC02] text-white flex items-center justify-center disabled:opacity-40 active:translate-y-0.5 shadow-[0_2px_0_#46A302]"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Guests stepper */}
              <div className="mt-4">
                <span className="text-[11px] font-black uppercase tracking-[0.4px] text-[#AFAFAF]">
                  Guests
                </span>
                <div className="mt-1 flex items-center justify-between px-3 py-2.5 rounded-2xl border-2 border-[#E5E5E5]">
                  <span className="font-bold text-[#3C3C3C] text-sm">
                    {editTripGuests} {editTripGuests === 1 ? "guest" : "guests"}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Decrease guests"
                      onClick={() =>
                        setEditTripGuests((n) =>
                          Math.max(Math.max(1, members.length), n - 1)
                        )
                      }
                      disabled={editTripGuests <= Math.max(1, members.length)}
                      className="w-9 h-9 rounded-xl border-2 border-[#E5E5E5] flex items-center justify-center text-[#3C3C3C] disabled:opacity-40 active:translate-y-0.5"
                    >
                      <Minus size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label="Increase guests"
                      onClick={() => setEditTripGuests((n) => Math.min(MAX_TRIP_MEMBERS, n + 1))}
                      disabled={editTripGuests >= MAX_TRIP_MEMBERS}
                      className="w-9 h-9 rounded-xl border-2 border-[#58CC02] bg-[#58CC02] text-white flex items-center justify-center disabled:opacity-40 active:translate-y-0.5 shadow-[0_2px_0_#46A302]"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                {members.length > 0 && (
                  <p className="mt-1 text-[11px] font-bold text-[#AFAFAF]">
                    {members.length} already joined — can&apos;t go below.
                  </p>
                )}
              </div>

              {/* Group type — same chip-grid layout as the Create flow. The
                  sheet body scrolls, so we don't fight for height even though
                  there are six options. */}
              <div className="mt-4">
                <span className="text-[11px] font-black uppercase tracking-[0.4px] text-[#AFAFAF]">
                  Who's coming?
                </span>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {EDIT_GROUP_TYPE_OPTIONS.map((opt) => {
                    const isSelected = editGroupType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEditGroupType(opt.value)}
                        className={`
                          flex items-center gap-3 px-3 py-3 rounded-2xl border-2 text-left
                          transition-all duration-150 touch-action-manipulation
                          ${
                            isSelected
                              ? "border-[#58CC02] bg-[#F8FFF0] shadow-[0_4px_0_#46A302]"
                              : "border-[#E5E5E5] bg-white shadow-[0_3px_0_#D4D4D4]"
                          }
                        `}
                        aria-pressed={isSelected}
                      >
                        <span className="text-2xl leading-none flex-shrink-0">{opt.emoji}</span>
                        <div className="min-w-0">
                          <div className="font-black text-[13px] leading-tight text-[#3C3C3C]">
                            {opt.label}
                          </div>
                          <div className="font-normal text-[11px] text-[#AFAFAF] leading-tight mt-0.5 truncate">
                            {opt.sublabel}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditTripOpen(false)}
                  className="flex-1 py-3 rounded-2xl border-2 border-[#E5E5E5] font-black text-[#3C3C3C] bg-white shadow-[0_3px_0_#D4D4D4] active:translate-y-0.5 active:shadow-none transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditTrip}
                  className="flex-1 py-3 rounded-2xl border-2 border-[#58CC02] bg-[#58CC02] text-white font-black shadow-[0_3px_0_#46A302] active:translate-y-0.5 active:shadow-none transition-all"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hotel add/edit bottom sheet */}
      {hotelSheetOpen && trip && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeHotelSheet}
            aria-hidden
          />
          <div className="relative w-full max-w-[402px] mx-auto bg-white rounded-t-3xl border-t-2 border-x-2 border-[#E5E5E5] shadow-[0_-4px_0_#D4D4D4] max-h-[88vh] flex flex-col">
            {/* Drag handle */}
            <div className="pt-3 pb-2 flex-shrink-0">
              <div className="w-12 h-1 rounded-full bg-[#E5E5E5] mx-auto" aria-hidden />
            </div>

            {/* Header */}
            <div className="px-5 pb-3 flex items-center gap-3 flex-shrink-0">
              <div className="w-10 h-10 rounded-xl bg-[#FFF4E5] flex items-center justify-center flex-shrink-0">
                <HotelIcon size={20} className="text-[#FF9600]" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-[#3C3C3C] text-base leading-tight">
                  {editingHotelId ? "Edit hotel" : "Add a hotel"}
                </p>
                <p className="font-bold text-[#AFAFAF] text-xs">
                  Shared with all guests on this trip
                </p>
              </div>
              <button
                type="button"
                onClick={closeHotelSheet}
                className="w-8 h-8 rounded-full bg-[#F0F0F0] hover:bg-[#E5E5E5] flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                <XIcon size={16} className="text-[#3C3C3C]" strokeWidth={3} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 pb-6 overflow-y-auto">
              {/* Hotel autocomplete */}
              <label className="block font-black text-[#3C3C3C] text-xs mb-2">
                Hotel name
              </label>
              <HotelPlaceAutocomplete
                destination={trip.destination ?? ""}
                value={hotelDraftName}
                onChange={(label) => {
                  setHotelDraftName(label);
                  if (label !== hotelDraftName) {
                    setHotelDraftPlaceId("");
                    setHotelDraftAddress(undefined);
                  }
                  setHotelDraftError(null);
                }}
                onPick={(placeId, name) => {
                  setHotelDraftName(name);
                  setHotelDraftPlaceId(placeId);
                  setHotelDraftError(null);
                  void fetchPlaceDetails(placeId).then((details) => {
                    if (details?.formattedAddress) {
                      setHotelDraftAddress(details.formattedAddress);
                    }
                  });
                }}
                placeholder={`Search hotels in ${trip.destination || "the destination"}`}
                inputClassName="w-full px-4 py-3 rounded-2xl border-2 border-[#E5E5E5] bg-white text-sm font-bold text-[#3C3C3C] placeholder:text-[#AFAFAF] outline-none focus:border-[#1CB0F6]"
              />
              {hotelDraftAddress && (
                <p className="mt-2 text-xs font-bold text-[#AFAFAF] flex items-start gap-1">
                  <MapPin size={12} className="text-[#AFAFAF] mt-0.5 flex-shrink-0" />
                  <span className="truncate">{hotelDraftAddress}</span>
                </p>
              )}

              {/* Day range steppers (check-in / check-out) */}
              <div className="mt-5 flex items-center justify-between">
                <p className="font-black text-[#3C3C3C] text-xs">Stay duration</p>
                {(() => {
                  const nights = Math.max(0, hotelDraftEnd - hotelDraftStart);
                  if (nights <= 0) return null;
                  return (
                    <span className="font-black text-[#FF9600] text-xs">
                      {nights} night{nights === 1 ? "" : "s"}
                    </span>
                  );
                })()}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <DayStepper
                  label="Check-in Day"
                  value={hotelDraftStart}
                  min={1}
                  max={Math.max(1, tripDaysCount - 1)}
                  onChange={(n) => {
                    setHotelDraftStart(n);
                    if (hotelDraftEnd <= n) setHotelDraftEnd(Math.min(tripDaysCount, n + 1));
                    setHotelDraftError(null);
                  }}
                />
                <DayStepper
                  label="Check-out Day"
                  value={hotelDraftEnd}
                  min={Math.min(tripDaysCount, hotelDraftStart + 1)}
                  max={tripDaysCount}
                  onChange={(n) => {
                    setHotelDraftEnd(n);
                    setHotelDraftError(null);
                  }}
                />
              </div>
              <p className="mt-2 text-xs font-bold text-[#AFAFAF]">
                Trip is {tripDaysCount} day{tripDaysCount === 1 ? "" : "s"} long. Two hotels
                can share a transition day (check-out / check-in) but can&apos;t share a night.
              </p>

              {hotelDraftError && (
                <div className="mt-3 p-3 rounded-xl bg-[#FFEFEF] border border-[#FFC5C5]">
                  <p className="text-xs font-bold text-[#FF4B4B]">{hotelDraftError}</p>
                </div>
              )}

              {/* Actions */}
              <div className="mt-5 flex gap-3">
                {editingHotelId && (
                  <button
                    type="button"
                    onClick={handleRemoveHotel}
                    className="px-4 py-3 rounded-2xl border-2 border-[#FFC5C5] bg-white text-[#FF4B4B] font-black text-sm shadow-[0_3px_0_#FFC5C5] active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-1.5"
                    aria-label="Remove this hotel"
                  >
                    <Trash2 size={16} strokeWidth={2.5} />
                    Remove
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeHotelSheet}
                  className="flex-1 py-3 rounded-2xl border-2 border-[#E5E5E5] bg-white text-[#3C3C3C] font-black text-sm shadow-[0_3px_0_#D4D4D4] active:translate-y-0.5 active:shadow-none transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveHotel}
                  className="flex-1 py-3 rounded-2xl border-2 border-[#1899D6] bg-[#1CB0F6] text-white font-black text-sm shadow-[0_3px_0_#1899D6] active:translate-y-0.5 active:shadow-none transition-all"
                >
                  {editingHotelId ? "Save" : "Add hotel"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Flight add/edit bottom sheet — mirrors the hotel sheet pattern. */}
      {flightSheetOpen && trip && (() => {
        const isEditMode = editingFlightId !== null;
        const existingFlight = isEditMode
          ? flights.find((f) => f.id === editingFlightId)
          : null;
        const editingMember = existingFlight
          ? members.find((m) => m.id === existingFlight.memberId)
          : null;
        // In add mode the user picks a target via chips. `flightDraftFor`
        // is either `["everyone"]` (mutually exclusive sentinel) or a list
        // of individual member ids.
        const isEveryoneSelected = flightDraftFor.includes("everyone");
        const targetCount = isEditMode
          ? 1
          : isEveryoneSelected
            ? members.length
            : flightDraftFor.length;
        const canSave =
          flightDraftOrigin.trim().length > 0 &&
          flightDraftDestination.trim().length > 0 &&
          flightDraftDate.trim().length > 0 &&
          flightDraftArrivalTime.trim().length > 0 &&
          (isEditMode || targetCount > 0);
        const directionLabel =
          flightDraftDirection === "arrival" ? "Arriving" : "Departing";
        const timeFieldLabel =
          flightDraftDirection === "arrival" ? "Arrival time" : "Departure time";
        const saveButtonLabel = isEditMode
          ? "Save"
          : targetCount > 1
            ? `Add ${targetCount} flights`
            : "Add flight";
        return (
          <div className="fixed inset-0 z-[60] flex flex-col justify-end">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={closeFlightSheet}
              aria-hidden
            />
            <div className="relative w-full max-w-[402px] mx-auto bg-white rounded-t-3xl border-t-2 border-x-2 border-[#E5E5E5] shadow-[0_-4px_0_#D4D4D4] max-h-[88vh] flex flex-col">
              <div className="pt-3 pb-2 flex-shrink-0">
                <div className="w-12 h-1 rounded-full bg-[#E5E5E5] mx-auto" aria-hidden />
              </div>

              <div className="px-5 pb-3 flex items-center gap-3 flex-shrink-0">
                <div className="w-10 h-10 rounded-xl bg-[#DDF4FF] flex items-center justify-center flex-shrink-0">
                  <Plane size={20} className="text-[#1CB0F6]" strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-[#3C3C3C] text-base leading-tight">
                    {isEditMode ? "Edit flight" : "Add flight"}
                  </p>
                  <p className="font-bold text-[#AFAFAF] text-xs">
                    {isEditMode
                      ? editingMember
                        ? `${directionLabel} · ${editingMember.name}`
                        : directionLabel
                      : "Pick direction & who's flying"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeFlightSheet}
                  className="w-8 h-8 rounded-full bg-[#F0F0F0] hover:bg-[#E5E5E5] flex items-center justify-center transition-colors"
                  aria-label="Close"
                >
                  <XIcon size={16} className="text-[#3C3C3C]" strokeWidth={3} />
                </button>
              </div>

              <div className="px-5 pb-6 overflow-y-auto">
                {/* Direction segmented control — Arriving (default) vs
                    Departing. Available in both Add and Edit mode; flipping
                    the toggle in Edit mode just patches the row's direction
                    on save. */}
                <div
                  role="tablist"
                  aria-label="Flight direction"
                  className="grid grid-cols-2 gap-1 p-1 bg-[#F0F0F0] rounded-2xl mb-4"
                >
                  {(["arrival", "departure"] as const).map((dir) => {
                    const selected = flightDraftDirection === dir;
                    const label = dir === "arrival" ? "Arriving" : "Departing";
                    return (
                      <button
                        key={dir}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => setFlightDraftDirection(dir)}
                        className={`duo-focusable rounded-xl py-2 font-bold text-[13px] min-h-[36px] transition-all duration-[150ms] ${
                          selected
                            ? "bg-white text-[#3C3C3C] shadow-[0_2px_0_#D4D4D4]"
                            : "bg-transparent text-[#777777]"
                        }`}
                        style={{ touchAction: "manipulation" }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* "For" picker — only in Add mode. Edit mode shows the member
                    name in the header subtitle and locks the assignment.
                    Selection rules:
                      • Tap "Everyone" → resets to `["everyone"]` (mutually
                        exclusive with any individual chip).
                      • Tap an individual chip → toggles that member in/out
                        of the selection. Picking any individual auto-clears
                        the "Everyone" sentinel.
                      • Tapping the only-selected individual de-selects it,
                        leaving the picker empty (Save disables until at
                        least one chip is on). */}
                {!isEditMode && (
                  <>
                    <label className="block font-black text-[#3C3C3C] text-xs mb-2">
                      For who?
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        key="everyone"
                        type="button"
                        onClick={() => setFlightDraftFor(["everyone"])}
                        aria-pressed={isEveryoneSelected}
                        className={`duo-focusable px-3 py-2 rounded-2xl border-2 font-bold text-xs transition-all ${
                          isEveryoneSelected
                            ? "border-[#1899D6] bg-[#1CB0F6] text-white shadow-[0_3px_0_#1899D6]"
                            : "border-[#E5E5E5] bg-white text-[#3C3C3C] shadow-[0_3px_0_#D4D4D4] active:translate-y-0.5 active:shadow-none"
                        }`}
                        style={{ touchAction: "manipulation" }}
                      >
                        Everyone
                      </button>
                      {members.map((m) => {
                        const selected =
                          !isEveryoneSelected && flightDraftFor.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setFlightDraftFor((current) => {
                                // Coming from Everyone? Start a fresh
                                // individual list with just this member.
                                if (current.includes("everyone")) return [m.id];
                                if (current.includes(m.id)) {
                                  return current.filter((id) => id !== m.id);
                                }
                                return [...current, m.id];
                              });
                            }}
                            aria-pressed={selected}
                            className={`duo-focusable px-3 py-2 rounded-2xl border-2 font-bold text-xs transition-all ${
                              selected
                                ? "border-[#1899D6] bg-[#1CB0F6] text-white shadow-[0_3px_0_#1899D6]"
                                : "border-[#E5E5E5] bg-white text-[#3C3C3C] shadow-[0_3px_0_#D4D4D4] active:translate-y-0.5 active:shadow-none"
                            }`}
                            style={{ touchAction: "manipulation" }}
                          >
                            {m.name}
                          </button>
                        );
                      })}
                    </div>
                    {isEveryoneSelected && members.length > 0 ? (
                      <p className="mt-2 text-xs font-bold text-[#AFAFAF]">
                        Saves the same flight info for all {members.length} guest
                        {members.length === 1 ? "" : "s"}.
                      </p>
                    ) : !isEveryoneSelected && targetCount > 1 ? (
                      <p className="mt-2 text-xs font-bold text-[#AFAFAF]">
                        Saves the same flight info for {targetCount} selected guests.
                      </p>
                    ) : !isEveryoneSelected && targetCount === 0 ? (
                      <p className="mt-2 text-xs font-bold text-[#FF9600]">
                        Pick at least one guest, or tap "Everyone".
                      </p>
                    ) : null}
                  </>
                )}

                <div className={`grid grid-cols-2 gap-3 ${!isEditMode ? "mt-4" : ""}`}>
                  <div>
                    <label className="block font-black text-[#3C3C3C] text-xs mb-2">
                      From (IATA)
                    </label>
                    <input
                      type="text"
                      value={flightDraftOrigin}
                      onChange={(e) => setFlightDraftOrigin(e.target.value.toUpperCase())}
                      maxLength={3}
                      placeholder="DCA"
                      className="w-full px-4 py-3 rounded-2xl border-2 border-[#E5E5E5] bg-white text-sm font-bold text-[#3C3C3C] placeholder:text-[#AFAFAF] outline-none focus:border-[#1CB0F6] uppercase"
                    />
                  </div>
                  <div>
                    <label className="block font-black text-[#3C3C3C] text-xs mb-2">
                      To (IATA)
                    </label>
                    <input
                      type="text"
                      value={flightDraftDestination}
                      onChange={(e) => setFlightDraftDestination(e.target.value.toUpperCase())}
                      maxLength={3}
                      placeholder="CDG"
                      className="w-full px-4 py-3 rounded-2xl border-2 border-[#E5E5E5] bg-white text-sm font-bold text-[#3C3C3C] placeholder:text-[#AFAFAF] outline-none focus:border-[#1CB0F6] uppercase"
                    />
                  </div>
                </div>

                {/* Date and time stacked vertically so each picker gets the
                    full sheet width — the inline calendar / hour-min stepper
                    cramped at 50% width. Time is required because the
                    itinerary clamps Day 1's start / last day's end against
                    these values — without them the trip schedule has nothing
                    to anchor against. */}
                <label className="block font-black text-[#3C3C3C] text-xs mb-2 mt-4">
                  Travel date
                </label>
                <DuoDateField
                  value={flightDraftDate}
                  onChange={setFlightDraftDate}
                  placeholder="Pick date"
                  ariaLabel="Pick travel date"
                />

                <label className="block font-black text-[#3C3C3C] text-xs mb-2 mt-4">
                  {timeFieldLabel}
                </label>
                <DuoTimeField
                  value={flightDraftArrivalTime}
                  onChange={setFlightDraftArrivalTime}
                />
                <p className="mt-2 text-xs font-bold text-[#AFAFAF]">
                  {flightDraftDirection === "arrival"
                    ? "Used to compute the latest arrival across all guests so Day 1 plans start after everyone has landed."
                    : "Used so the last day's plans wrap up before anyone has to be at the airport."}
                </p>

                {/* Airline + Flight # are descriptive labels with no scheduler
                    impact, so they're both optional and stacked vertically
                    below the required fields. */}
                <label className="block font-black text-[#3C3C3C] text-xs mb-2 mt-4">
                  Airline <span className="font-bold text-[#AFAFAF]">(opt)</span>
                </label>
                <input
                  type="text"
                  value={flightDraftAirline}
                  onChange={(e) => setFlightDraftAirline(e.target.value)}
                  placeholder="Air France"
                  className="w-full px-4 py-3 rounded-2xl border-2 border-[#E5E5E5] bg-white text-sm font-bold text-[#3C3C3C] placeholder:text-[#AFAFAF] outline-none focus:border-[#1CB0F6]"
                />

                <label className="block font-black text-[#3C3C3C] text-xs mb-2 mt-4">
                  Flight # <span className="font-bold text-[#AFAFAF]">(opt)</span>
                </label>
                <input
                  type="text"
                  value={flightDraftNumber}
                  onChange={(e) => setFlightDraftNumber(e.target.value)}
                  placeholder="AF65"
                  className="w-full px-4 py-3 rounded-2xl border-2 border-[#E5E5E5] bg-white text-sm font-bold text-[#3C3C3C] placeholder:text-[#AFAFAF] outline-none focus:border-[#1CB0F6]"
                />

                <div className="mt-5 flex gap-3">
                  {existingFlight && (
                    <button
                      type="button"
                      onClick={handleRemoveFlight}
                      className="px-4 py-3 rounded-2xl border-2 border-[#FFC5C5] bg-white text-[#FF4B4B] font-black text-sm shadow-[0_3px_0_#FFC5C5] active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-1.5"
                      aria-label="Remove this flight"
                    >
                      <Trash2 size={16} strokeWidth={2.5} />
                      Remove
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeFlightSheet}
                    className="flex-1 py-3 rounded-2xl border-2 border-[#E5E5E5] bg-white text-[#3C3C3C] font-black text-sm shadow-[0_3px_0_#D4D4D4] active:translate-y-0.5 active:shadow-none transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveFlight}
                    disabled={!canSave}
                    className={`flex-1 py-3 rounded-2xl border-2 font-black text-sm transition-all ${
                      canSave
                        ? "border-[#1899D6] bg-[#1CB0F6] text-white shadow-[0_3px_0_#1899D6] active:translate-y-0.5 active:shadow-none"
                        : "border-[#E5E5E5] bg-[#F0F0F0] text-[#AFAFAF] cursor-not-allowed"
                    }`}
                  >
                    {saveButtonLabel}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete confirmation modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDeleteModalOpen(false)}
            aria-hidden
          />
          <div className="relative bg-white rounded-2xl border-2 border-[#E5E5E5] shadow-[0_6px_0_#D4D4D4] p-6 w-full max-w-sm">
            <h3 className="font-black text-[#3C3C3C] text-lg text-center mb-2">
              Delete &quot;{trip.name}&quot;?
            </h3>
            <p className="text-[#AFAFAF] font-bold text-sm text-center mb-6">
              This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="flex-1 py-3.5 rounded-2xl border-2 border-[#E5E5E5] font-black text-[#3C3C3C] bg-white shadow-[0_3px_0_#D4D4D4] active:translate-y-0.5 active:shadow-none transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 py-3.5 rounded-2xl border-2 border-[#CC3B3B] font-black text-white bg-[#FF4B4B] shadow-[0_3px_0_#CC3B3B] active:translate-y-0.5 active:shadow-none transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {hasSavedItinerary && savedItinerary && itineraryEditMode && (
        <div
          className="fixed inset-x-0 bottom-0 z-[45] flex justify-center px-5 pt-3 pointer-events-none border-t-2 border-[#E5E5E5] bg-[#F7F7F7]/95 backdrop-blur-sm shadow-[0_-6px_16px_rgba(0,0,0,0.06)]"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))" }}
        >
          <button
            type="button"
            onClick={handleSaveItineraryEdit}
            className="pointer-events-auto w-full max-w-[402px] py-3.5 rounded-2xl border-2 border-[#58CC02] bg-[#58CC02] text-white font-black text-sm shadow-[0_4px_0_#46A302] active:translate-y-0.5 active:shadow-none transition-all"
          >
            Save itinerary
          </button>
        </div>
      )}

      {aiModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-0">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAiModalOpen(false)} aria-hidden />
          <div className="relative w-full max-w-[402px] bg-white rounded-t-3xl border-x-2 border-t-2 border-[#E5E5E5] p-4 pb-6">
            <div className="w-12 h-1 rounded-full bg-[#E5E5E5] mx-auto mb-3" />
            <h3 className="text-base font-black text-[#3C3C3C]">AI Enhance</h3>
            <p className="mt-0.5 text-xs font-bold text-[#AFAFAF]">What would you like to enhance?</p>
            <textarea
              value={aiEnhanceGoal}
              onChange={(e) => setAiEnhanceGoal(e.target.value)}
              placeholder="Example: Use more public transit and balance activities."
              className="mt-2 w-full min-h-[88px] rounded-xl border border-[#ECECEC] bg-[#F7F7F7] px-3 py-2 text-sm font-bold text-[#3C3C3C] outline-none resize-none"
            />
            <p className="mt-2 text-xs font-bold text-[#AFAFAF]">What are you not satisfied with?</p>
            <textarea
              value={aiDissatisfaction}
              onChange={(e) => setAiDissatisfaction(e.target.value)}
              placeholder="Example: Day 2 is too packed and has too much driving."
              className="mt-2 w-full min-h-[88px] rounded-xl border border-[#ECECEC] bg-[#F7F7F7] px-3 py-2 text-sm font-bold text-[#3C3C3C] outline-none resize-none"
            />
            {aiError && <p className="mt-2 text-xs font-bold text-[#FF4B4B]">{aiError}</p>}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setAiModalOpen(false)}
                className="flex-1 py-3 rounded-xl border-2 border-[#E5E5E5] bg-white text-[#3C3C3C] font-black text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAiEnhance}
                disabled={aiLoading}
                className={`flex-1 py-3 rounded-xl border-2 font-black text-sm ${
                  aiLoading
                    ? "border-[#E5E5E5] bg-[#E5E5E5] text-[#AFAFAF]"
                    : "border-[#1CB0F6] bg-[#1CB0F6] text-white"
                }`}
              >
                {aiLoading ? "Analyzing..." : "Generate changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
