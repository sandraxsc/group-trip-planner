import { useNavigate, useParams } from "react-router";
import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, MapPin, Calendar, Users, CheckCircle2, ChevronRight, ChevronDown, ChevronUp, Lock, MoreVertical, Pencil, HelpCircle, MessageCircle, Trash2, Clock, Star, Phone, Link2, GripVertical } from "lucide-react";
import { BottomNav } from "../components/BottomNav";
import { DuoButton } from "../components/DuoButton";
import { HotelPlaceAutocomplete } from "../components/HotelPlaceAutocomplete";
import { getTripById, getTripMembers, MAX_TRIP_MEMBERS, deleteTrip } from "../../services/tripService";
import { getItinerary, saveItinerary } from "../../services/itineraryService";
import { itineraryToDisplayDays, buildDefaultEditRows } from "../utils/itineraryToDisplayDays";
import type { ItineraryEditRow } from "../../types/itinerary";
import { getApproxTransitInfo, type TransitInfo } from "../../services/transitService";
import { fetchPlaceDetails, type PlaceDetailsResult } from "../../services/placeService";
import type { Trip, TripMember, PreferenceStatus } from "../../types/trip";
import { ActivityPlaceAutocomplete } from "../components/ActivityPlaceAutocomplete";
import { requestAiEnhance } from "../../services/aiEnhanceService";
import type { AiEnhanceProposal } from "../../types/aiEnhance";

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

function StatusDot({ status }: { status: PreferenceStatus }) {
  if (status === "completed") {
    return <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#58CC02] rounded-full border-2 border-white" />;
  }
  if (status === "in_progress") {
    return <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#FFD900] rounded-full border-2 border-white" />;
  }
  return <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-[#E5E5E5] bg-[#C3C3C3]" />;
}

export default function TripDetailScreen() {
  const navigate = useNavigate();
  const { tripId } = useParams<{ tripId?: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
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

  useEffect(() => {
    if (!tripId) return;
    const t = getTripById(tripId);
    setTrip(t ?? null);
    setMembers(t ? getTripMembers(t.id) : []);
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

  useEffect(() => {
    if (tripId === undefined) navigate("/", { replace: true });
  }, [tripId, navigate]);

  const capacity = trip?.maxGuests && trip.maxGuests > 0 ? trip.maxGuests : MAX_TRIP_MEMBERS;
  const inviteStepComplete = members.length >= capacity;
  const allPreferencesComplete = members.length > 0 && members.every((m) => m.preferenceStatus === "completed");
  const voteUnlocked = allPreferencesComplete;
  const currentMemberId = typeof window !== "undefined" ? sessionStorage.getItem("currentMemberId") : null;
  const currentMember = currentMemberId ? members.find((m) => m.id === currentMemberId) : members[0] ?? null;

  const handleInviteClick = () => {
    if (tripId && !inviteStepComplete) navigate(`/trips/${tripId}/invite`);
  };

  const handleSetPreference = () => {
    if (tripId && currentMemberId) {
      navigate("/preference-budget", { state: { tripId, memberId: currentMemberId } });
    } else if (tripId) {
      navigate("/preference-budget", { state: { tripId, memberId: members[0]?.id } });
    }
  };

  const handleVoteClick = () => {
    if (voteUnlocked) {
      navigate("/vote");
    }
  };

  const handleStepClick = (step: "invite" | "preference" | "vote" | "plan") => {
    if (step === "invite") handleInviteClick();
    else if (step === "preference") handleSetPreference();
    else if (step === "vote" && voteUnlocked) navigate("/vote");
    else if (step === "plan" && tripId && getItinerary(tripId)) {
      navigate("/trip-plan");
    }
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
    return itineraryToDisplayDays(merged, trip.name, trip.createdAt);
  }, [trip, savedItinerary, itineraryEditMode, editRowsDraft]);

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

  const openActivityDetail = async (
    event: {
      id: string;
      title: string;
      image?: string | null;
      duration: string;
      cost: string;
      isHotel?: boolean;
      isPlaceholder?: boolean;
      detailPlaceId?: string;
    },
    day: number,
    index: number
  ) => {
    if (event.isHotel || event.isPlaceholder) return;
    const placeId = (event.detailPlaceId ?? event.id).replace(/-(lunch|dinner)$/, "");
    const startTime = adjustedStartByDay[day]?.[index] ?? "";
    setActiveEvent({
      day,
      index,
      id: placeId,
      title: event.title,
      image: event.image,
      duration: event.duration,
      cost: event.cost,
      startTime,
    });
    setEditDuration(event.duration);
    setEditBudget(event.cost);
    setEditDescription(activeDetail?.description ?? "");
    setIsEditingDescription(false);
    setShowDurationPicker(false);
    setShowBudgetPicker(false);
    setDetailExpanded(false);
    setDetailLoading(true);
    const detail = await fetchPlaceDetails(placeId);
    setActiveDetail(detail);
    setEditDescription(detail?.description ?? "No detailed description available.");
    setDetailLoading(false);
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
          const built = buildDefaultEditRows(savedItinerary, trip.name, trip.createdAt)[k];
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
          const built = buildDefaultEditRows(savedItinerary, trip.name, trip.createdAt)[k];
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
        : buildDefaultEditRows(savedItinerary, trip.name, trip.createdAt);
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

  const getCurrentRowsByDay = (): Record<string, ItineraryEditRow[]> => {
    if (Object.keys(editRowsDraft).length > 0) return editRowsDraft;
    if (!savedItinerary || !trip) return {};
    if (savedItinerary.editRowsByDay && Object.keys(savedItinerary.editRowsByDay).length > 0) {
      return savedItinerary.editRowsByDay;
    }
    return buildDefaultEditRows(savedItinerary, trip.name, trip.createdAt);
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
          activityOrder: savedItinerary.activityOrder,
          editRowsByDay: savedItinerary.editRowsByDay,
        },
        currentEditRowsByDay: getCurrentRowsByDay(),
        enhanceRequest: aiEnhanceGoal,
        dissatisfaction: aiDissatisfaction,
      });

      setAiSummary(result.summary || "Here are a few improvements you can apply.");
      setAiProposals(result.proposals ?? []);
      const nextSelected: Record<string, boolean> = {};
      for (const p of result.proposals ?? []) nextSelected[p.id] = false;
      setAiSelectedProposalIds(nextSelected);
      setAiModalOpen(false);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Failed to enhance itinerary.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplySelectedAiChanges = () => {
    const selected = aiProposals.filter((p) => aiSelectedProposalIds[p.id]);
    if (selected.length === 0) return;
    setEditRowsDraft((prev) => {
      const base = Object.keys(prev).length > 0 ? prev : getCurrentRowsByDay();
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
    });
    setItineraryEditMode(true);
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
    if (!hasSavedItinerary || displayDays.length === 0) {
      setTransitByDay((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      setAdjustedStartByDay((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }
    let cancelled = false;
    const run = async () => {
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
            const prev = day.events[i - 1];
            const transit = transits[i - 1]?.minutes ?? 0;
            t = t + (prev.durationMinutes ?? 60) + transit;
            starts.push(minutesToTimeLabel(t));
          }
          adjustedMap[day.day] = starts;
        }
      }
      if (!cancelled) {
        setTransitByDay(transitMap);
        setAdjustedStartByDay(adjustedMap);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [hasSavedItinerary, displayDays, itineraryEditMode]);

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

  const planningSteps = [
    { id: 1, label: "Invite Friend", step: "invite" as const, completed: inviteStepComplete, locked: false },
    { id: 2, label: "Set Your Preference", step: "preference" as const, completed: allPreferencesComplete, locked: false },
    { id: 3, label: "Vote on Activity", step: "vote" as const, completed: false, locked: !voteUnlocked },
    {
      id: 4,
      label: hasSavedItinerary ? "View Trip Itinerary" : "Generate Trip Itinerary",
      step: "plan" as const,
      completed: hasSavedItinerary,
      locked: !hasSavedItinerary,
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F7F7] pb-24">
      {/* Hero (shared) */}
      <div className="relative w-full h-48">
        <img src={DEFAULT_TRIP_IMG} alt={trip.destination} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/60" />
        <button
          onClick={() => navigate("/")}
          className="absolute top-12 left-4 w-10 h-10 rounded-xl bg-white/90 backdrop-blur flex items-center justify-center shadow-lg"
        >
          <ArrowLeft size={20} className="text-[#4B4B4B]" />
        </button>
        <button
          onClick={() => setSheetOpen(true)}
          className="absolute top-12 right-4 w-10 h-10 rounded-xl bg-white/90 backdrop-blur flex items-center justify-center shadow-lg"
          aria-label="More options"
        >
          <MoreVertical size={20} className="text-[#4B4B4B]" />
        </button>
        <div className="absolute bottom-4 left-5 right-5">
          <h1 className="text-white font-black text-2xl mb-1">{trip.name}</h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <MapPin size={14} className="text-white/90" />
              <span className="text-white/90 text-xs font-bold">{trip.destination}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar size={14} className="text-white/90" />
              <span className="text-white/90 text-xs font-bold">
                {new Date(trip.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {hasSavedItinerary && savedItinerary ? (
        /* STATE 2 — Completed Trip State: full saved itinerary */
        <div className={`px-5 mt-4 flex flex-col gap-4 ${itineraryEditMode ? "pb-40" : "pb-6"}`}>
          {/* Full itinerary: days and events */}
          <div className="flex flex-col gap-3">
            <h2 className="font-black text-[#3C3C3C] text-base uppercase tracking-[0.4px]">
              🗺️ ITINERARY
            </h2>
            {aiSummary && (
              <div className="bg-[#E8F7FF] border-2 border-[#B3E4FF] rounded-2xl p-3">
                <p className="text-[11px] font-black uppercase text-[#1CB0F6] mb-1">AI summary</p>
                <p className="text-sm font-bold text-[#3C3C3C]">{aiSummary}</p>
              </div>
            )}
            {aiProposals.length > 0 && (
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
                  Applies to draft only. Use Save itinerary to persist.
                </p>
              </div>
            )}
            {displayDays.map((day) => {
              const isExpanded = expandedDay === day.day;
              const dayExpanded = itineraryEditMode || isExpanded;
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
                    className="w-full flex items-center gap-3 p-4 text-left disabled:opacity-100"
                    onClick={() => !itineraryEditMode && setExpandedDay(isExpanded ? null : day.day)}
                    disabled={itineraryEditMode}
                  >
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
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-black uppercase tracking-[0.6px] ${
                            dayExpanded ? "text-[#58CC02]" : "text-[#AFAFAF]"
                          }`}
                        >
                          Day {day.day}
                        </span>
                        <span className="text-xs font-bold text-[#AFAFAF]">·</span>
                        <span className="text-xs font-bold text-[#AFAFAF]">{day.date}</span>
                      </div>
                      <h3 className="font-black text-[#3C3C3C] text-lg leading-[27px] truncate">
                        {itineraryEditMode ? "Reorder your day" : day.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
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
                  </button>

                  {dayExpanded && day.events.length > 0 && (
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
                                      cost: event.cost,
                                      isHotel: event.isHotel,
                                      isPlaceholder: event.isPlaceholder,
                                      detailPlaceId: event.detailPlaceId,
                                    },
                                    day.day,
                                    idx
                                  )
                                }
                                className="flex-1 min-w-0 text-left"
                              >
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
                                <h4 className="font-black text-[#3C3C3C] text-base">{event.title}</h4>
                                {event.image && (
                                  <img
                                    src={event.image}
                                    alt={event.title}
                                    className="w-full h-32 object-cover rounded-xl mt-2"
                                  />
                                )}
                                <div className="flex items-center gap-3 mt-2">
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
                  )}
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
        <>
          {/* STATE 1 — Planning State */}
          {/* Top CTA card: either Set Preference (for this member) or Vote CTA when all preferences complete */}
          {!allPreferencesComplete && currentMember?.preferenceStatus !== "completed" && (
            <div className="px-5 mt-4">
              <div className="bg-white rounded-2xl border-2 border-[#58CC02] shadow-[0_4px_0_#46A302] p-5">
                <h3 className="text-[#AFAFAF] text-xs font-bold uppercase tracking-wide mb-1">
                  SET YOUR TRAVEL PREFERENCE
                </h3>
                <p className="text-[#AFAFAF] text-sm mb-4">add your opinion to the group</p>
                <DuoButton onClick={handleSetPreference} variant="primary" fullWidth className="py-3.5 text-base">
                  SET PREFERENCE
                </DuoButton>
              </div>
            </div>
          )}

          {allPreferencesComplete && (
            <div className="px-5 mt-4">
              <div className="bg-white rounded-2xl border-2 border-[#58CC02] shadow-[0_4px_0_#46A302] p-5">
                <h3 className="text-[#AFAFAF] text-xs font-bold uppercase tracking-wide mb-1">
                  READY TO VOTE
                </h3>
                <p className="text-[#AFAFAF] text-sm mb-4">
                  Everyone set their preferences. Time to vote on your trip plan!
                </p>
                <DuoButton
                  onClick={handleVoteClick}
                  variant="primary"
                  fullWidth
                  className="py-3.5 text-base"
                  disabled={!voteUnlocked}
                >
                  🗳️ Vote for your trip plan
                </DuoButton>
              </div>
            </div>
          )}

          {/* Members Section */}
          <div className="px-5 pt-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 flex items-center justify-center">
                  <Users size={20} className="text-[#CE82FF]" />
                </div>
                <h2 className="font-black text-[#3C3C3C] text-base">MEMBERS</h2>
              </div>
              <button
                onClick={handleInviteClick}
                disabled={inviteStepComplete}
                className={`text-sm font-bold ${inviteStepComplete ? "text-[#AFAFAF] cursor-not-allowed" : "text-[#1CB0F6]"}`}
              >
                Invite +
              </button>
            </div>

            <div className="flex gap-4 flex-wrap">
              {members.map((member, i) => (
                <div key={member.id} className="flex flex-col items-center gap-1">
                  <button
                    type="button"
                    className="relative"
                    onClick={() => tripId && navigate(`/trips/${tripId}/members/${member.id}`)}
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center font-black text-sm"
                      style={{
                        backgroundColor: MEMBER_COLORS[i % MEMBER_COLORS.length],
                        color: "#FFF",
                      }}
                    >
                      {getInitials(member.name)}
                    </div>
                    <StatusDot status={member.preferenceStatus} />
                  </button>
                  <span className="text-xs text-[#3C3C3C] font-bold mt-1">{member.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Planning Steps */}
          <div className="px-5 pt-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M14.25 2.25H3.75C2.92157 2.25 2.25 2.92157 2.25 3.75V14.25C2.25 15.0784 2.92157 15.75 3.75 15.75H14.25C15.0784 15.75 15.75 15.0784 15.75 14.25V3.75C15.75 2.92157 15.0784 2.25 14.25 2.25Z" stroke="#8D6E3A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 0.75V3.75" stroke="#8D6E3A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M6 0.75V3.75" stroke="#8D6E3A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2.25 6.75H15.75" stroke="#8D6E3A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h2 className="font-black text-[#3C3C3C] text-base">PLANNING STEPS</h2>
            </div>

            <div className="flex flex-col gap-2">
              {planningSteps.map((step) => {
                const isLocked = step.locked;
                const isCompleted = step.completed;
                const canClick = !isLocked && !isCompleted;
                return (
                  <button
                    key={step.id}
                    onClick={() => canClick && handleStepClick(step.step)}
                    disabled={isLocked}
                    className={`bg-white rounded-2xl border-2 shadow-[0_3px_0_#D4D4D4] p-4 flex items-center gap-3 transition-all ${
                      isCompleted
                        ? "border-[#58CC02] shadow-[0_3px_0_#46A302] bg-[#f0fde4]"
                        : isLocked
                          ? "border-[#E5E5E5] opacity-60"
                          : "border-[#E5E5E5] active:translate-y-0.5 active:shadow-none"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 size={22} className="text-[#58CC02] flex-shrink-0" fill="#58CC02" />
                    ) : isLocked ? (
                      <div className="bg-[#f2f2f2] relative rounded-full shrink-0 size-[22px] border-[3px] border-[#e5e5e5] flex items-center justify-center">
                        <Lock size={14} className="text-[#B4B4B4]" />
                      </div>
                    ) : (
                      <div className="w-[22px] h-[22px] rounded-full border-[3px] border-[#E5E5E5] flex-shrink-0" />
                    )}
                    <span className={`flex-1 text-left font-bold text-[#3C3C3C] ${isCompleted ? "opacity-60 line-through" : ""}`}>
                      {step.label}
                    </span>
                    {!isLocked && <ChevronRight size={18} className="text-[#AFAFAF]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
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
                onClick={() => setSheetOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left font-bold text-[#3C3C3C] hover:bg-[#F7F7F7] active:bg-[#F0F0F0] transition-colors"
              >
                <Pencil size={20} className="text-[#AFAFAF]" />
                Edit Title
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
              setActiveEvent(null);
              setActiveDetail(null);
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
                    setActiveEvent(null);
                    setActiveDetail(null);
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

      {!itineraryEditMode && <BottomNav />}

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
