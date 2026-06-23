import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Plane, Hotel } from "lucide-react";
import { toast } from "sonner";
import { DuoButton } from "../components/DuoButton";
import { DuoDateField } from "../components/DuoDateField";
import { DuoTimeField } from "../components/DuoTimeField";
import { getTripMembers } from "../../services/tripService";
import {
  getGroupFlights,
  getGroupHotels,
  getMemberConfirmations,
  saveMemberConfirmation,
} from "../../services/groupLogisticsService";
import type { GroupFlight, GroupHotel } from "../../types/groupLogistics";
import type { TripMember } from "../../types/trip";
import { MemberPersonalLogisticsPanel } from "../components/MemberPersonalLogisticsPanel";
import { DuoStickyFooter } from "../components/DuoStickyFooter";
import { duoUi } from "../constants/duoUi";

type FlightDraft = {
  confirmed: boolean;
  separateDate: string;
  separateArrivalTime: string;
  separateAirline: string;
  separateFlightNumber: string;
};

type HotelDraft = {
  confirmed: boolean;
  separateHotelName: string;
  separateHotelAddress: string;
};

function emptyFlightDraft(): FlightDraft {
  return {
    confirmed: true,
    separateDate: "",
    separateArrivalTime: "",
    separateAirline: "",
    separateFlightNumber: "",
  };
}

function emptyHotelDraft(): HotelDraft {
  return {
    confirmed: true,
    separateHotelName: "",
    separateHotelAddress: "",
  };
}

function formatFlightSummary(flight: GroupFlight): string {
  const parts: string[] = [];
  if (flight.origin && flight.destination) {
    parts.push(`${flight.origin} → ${flight.destination}`);
  } else if (flight.destination) {
    parts.push(`To ${flight.destination}`);
  } else if (flight.origin) {
    parts.push(`From ${flight.origin}`);
  }
  if (flight.date) parts.push(flight.date);
  if (flight.arrivalTime) parts.push(flight.arrivalTime);
  if (flight.airline || flight.flightNumber) {
    parts.push([flight.airline, flight.flightNumber].filter(Boolean).join(" "));
  }
  return parts.join(" · ") || "Group flight";
}

function formatHotelDates(hotel: GroupHotel): string {
  if (hotel.dayStart != null && hotel.dayEnd != null) {
    return `Days ${hotel.dayStart}–${hotel.dayEnd}`;
  }
  if (hotel.dayStart != null) return `From day ${hotel.dayStart}`;
  if (hotel.dayEnd != null) return `Until day ${hotel.dayEnd}`;
  return "";
}

export default function MemberLogisticsReviewScreen() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const memberId =
    typeof window !== "undefined" ? sessionStorage.getItem("currentMemberId") : null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groupFlights, setGroupFlights] = useState<GroupFlight[]>([]);
  const [groupHotels, setGroupHotels] = useState<GroupHotel[]>([]);
  const [currentMember, setCurrentMember] = useState<TripMember | null>(null);
  const [flightDrafts, setFlightDrafts] = useState<Record<string, FlightDraft>>({});
  const [hotelDrafts, setHotelDrafts] = useState<Record<string, HotelDraft>>({});

  const sortedFlights = useMemo(() => {
    const arrivals = groupFlights.filter((f) => f.direction === "arrival");
    const departures = groupFlights.filter((f) => f.direction === "departure");
    return [...arrivals, ...departures];
  }, [groupFlights]);

  const hasLogistics = groupFlights.length > 0 || groupHotels.length > 0;

  useEffect(() => {
    if (!tripId || !memberId) {
      navigate(tripId ? `/trips/${tripId}` : "/trips", { replace: true });
      return;
    }

    const member = getTripMembers(tripId).find((m) => m.id === memberId);
    if (!member || member.role === "owner") {
      navigate(`/trips/${tripId}`, { replace: true });
      return;
    }
    setCurrentMember(member);

    let cancelled = false;

    void (async () => {
      try {
        const [flights, hotels, confirmations] = await Promise.all([
          getGroupFlights(tripId),
          getGroupHotels(tripId),
          getMemberConfirmations(tripId, memberId),
        ]);
        if (cancelled) return;

        setGroupFlights(flights);
        setGroupHotels(hotels);

        const nextFlights: Record<string, FlightDraft> = {};
        for (const flight of flights) {
          const saved = confirmations.find(
            (c) => c.logisticsType === "flight" && c.logisticsId === flight.id
          );
          nextFlights[flight.id] = saved
            ? {
                confirmed: saved.confirmed,
                separateDate: saved.separateDate ?? "",
                separateArrivalTime: saved.separateArrivalTime ?? "",
                separateAirline: saved.separateAirline ?? "",
                separateFlightNumber: saved.separateFlightNumber ?? "",
              }
            : emptyFlightDraft();
        }

        const nextHotels: Record<string, HotelDraft> = {};
        for (const hotel of hotels) {
          const saved = confirmations.find(
            (c) => c.logisticsType === "hotel" && c.logisticsId === hotel.id
          );
          nextHotels[hotel.id] = saved
            ? {
                confirmed: saved.confirmed,
                separateHotelName: saved.separateHotelName ?? "",
                separateHotelAddress: saved.separateHotelAddress ?? "",
              }
            : emptyHotelDraft();
        }

        setFlightDrafts(nextFlights);
        setHotelDrafts(nextHotels);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tripId, memberId, navigate]);

  const persistConfirmations = async (): Promise<void> => {
    if (!tripId || !memberId) return;

    const flightSaves = groupFlights.map((flight) => {
      const draft = flightDrafts[flight.id] ?? emptyFlightDraft();
      return saveMemberConfirmation({
        tripId,
        memberId,
        logisticsType: "flight",
        logisticsId: flight.id,
        confirmed: draft.confirmed,
        separateDate: draft.confirmed ? undefined : draft.separateDate || undefined,
        separateArrivalTime: draft.confirmed
          ? undefined
          : draft.separateArrivalTime || undefined,
        separateAirline: draft.confirmed ? undefined : draft.separateAirline || undefined,
        separateFlightNumber: draft.confirmed
          ? undefined
          : draft.separateFlightNumber || undefined,
      });
    });

    const hotelSaves = groupHotels.map((hotel) => {
      const draft = hotelDrafts[hotel.id] ?? emptyHotelDraft();
      return saveMemberConfirmation({
        tripId,
        memberId,
        logisticsType: "hotel",
        logisticsId: hotel.id,
        confirmed: draft.confirmed,
        separateHotelName: draft.confirmed ? undefined : draft.separateHotelName || undefined,
        separateHotelAddress: draft.confirmed
          ? undefined
          : draft.separateHotelAddress || undefined,
      });
    });

    await Promise.all([...flightSaves, ...hotelSaves]);
  };

  const handleContinue = async () => {
    if (!tripId || saving) return;
    setSaving(true);
    try {
      await persistConfirmations();
      navigate(`/trips/${tripId}/preference-complete`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save logistics review");
    } finally {
      setSaving(false);
    }
  };

  const updateFlightDraft = (id: string, patch: Partial<FlightDraft>) => {
    setFlightDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? emptyFlightDraft()), ...patch },
    }));
  };

  const updateHotelDraft = (id: string, patch: Partial<HotelDraft>) => {
    setHotelDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? emptyHotelDraft()), ...patch },
    }));
  };

  if (loading) {
    return (
      <div className={`flex flex-col min-h-screen ${duoUi.pageBgDefault} items-center justify-center p-6`}>
        <p className="font-bold text-[#AFAFAF]">Loading group logistics…</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col min-h-screen ${duoUi.pageBgDefault}`}>
      <div className={duoUi.headerBlock}>
        <h1 className="font-black text-[#3C3C3C] text-2xl leading-tight">Review Group Travel</h1>
        <p className="font-bold text-[#AFAFAF] text-sm mt-1 leading-snug">
          {hasLogistics
            ? "Confirm which group flights and hotels apply to you."
            : "Add your travel details, or skip and generate when ready."}
        </p>
      </div>

      <div className={`flex-1 ${duoUi.sectionX} pb-32 overflow-y-auto min-h-0 flex flex-col gap-4`}>
        {!hasLogistics && tripId && currentMember && (
          <MemberPersonalLogisticsPanel tripId={tripId} member={currentMember} />
        )}

        {sortedFlights.map((flight) => {
          const draft = flightDrafts[flight.id] ?? emptyFlightDraft();
          const isArrival = flight.direction === "arrival";
          return (
            <div key={flight.id} className={`${duoUi.card} p-4`}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#E8F7FF] border-2 border-[#1CB0F6] flex items-center justify-center shrink-0">
                  <Plane size={18} className="text-[#1CB0F6]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-[#3C3C3C] text-sm uppercase tracking-wide">
                    {isArrival ? "Arrival flight" : "Departure flight"}
                  </p>
                  <p className="font-bold text-[#4B4B4B] text-sm mt-0.5 break-words">
                    {formatFlightSummary(flight)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => updateFlightDraft(flight.id, { confirmed: !draft.confirmed })}
                className={`w-full rounded-2xl border-2 px-4 py-3 text-left font-black text-sm transition-all active:translate-y-0.5 ${
                  draft.confirmed
                    ? "bg-[#F0FDE4] border-[#58CC02] text-[#2D7800] shadow-[0_3px_0_#C8EDA0]"
                    : "bg-white border-[#E5E5E5] text-[#4B4B4B] shadow-[0_3px_0_#D4D4D4]"
                }`}
              >
                {draft.confirmed ? "I'm on this flight ✓" : "I have a separate ticket"}
              </button>

              {!draft.confirmed && (
                <div className="mt-3 flex flex-col gap-3 pt-3 border-t-2 border-[#F0F0F0]">
                  <div>
                    <p className="font-black text-[#3C3C3C] text-xs mb-2">Date</p>
                    <DuoDateField
                      value={draft.separateDate}
                      onChange={(v) => updateFlightDraft(flight.id, { separateDate: v })}
                      ariaLabel="Separate flight date"
                    />
                  </div>
                  <div>
                    <p className="font-black text-[#3C3C3C] text-xs mb-2">
                      {isArrival ? "Arrival time" : "Departure time"}
                    </p>
                    <DuoTimeField
                      value={draft.separateArrivalTime}
                      onChange={(v) =>
                        updateFlightDraft(flight.id, { separateArrivalTime: v })
                      }
                    />
                  </div>
                  <div>
                    <p className="font-black text-[#3C3C3C] text-xs mb-2">Airline</p>
                    <input
                      type="text"
                      value={draft.separateAirline}
                      onChange={(e) =>
                        updateFlightDraft(flight.id, { separateAirline: e.target.value })
                      }
                      placeholder="e.g. United"
                      className={duoUi.input}
                    />
                  </div>
                  <div>
                    <p className="font-black text-[#3C3C3C] text-xs mb-2">Flight number</p>
                    <input
                      type="text"
                      value={draft.separateFlightNumber}
                      onChange={(e) =>
                        updateFlightDraft(flight.id, { separateFlightNumber: e.target.value })
                      }
                      placeholder="e.g. UA123"
                      className={duoUi.input}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {groupHotels.map((hotel) => {
          const draft = hotelDrafts[hotel.id] ?? emptyHotelDraft();
          const dateLabel = formatHotelDates(hotel);
          return (
            <div key={hotel.id} className={`${duoUi.card} p-4`}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#F9F0FF] border-2 border-[#CE82FF] flex items-center justify-center shrink-0">
                  <Hotel size={18} className="text-[#CE82FF]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-[#3C3C3C] text-sm uppercase tracking-wide">
                    Group hotel
                  </p>
                  <p className="font-bold text-[#4B4B4B] text-sm mt-0.5">{hotel.name}</p>
                  {hotel.address && (
                    <p className="font-bold text-[#AFAFAF] text-xs mt-0.5">{hotel.address}</p>
                  )}
                  {dateLabel && (
                    <p className="font-black text-[#1CB0F6] text-xs mt-1">{dateLabel}</p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => updateHotelDraft(hotel.id, { confirmed: !draft.confirmed })}
                className={`w-full rounded-2xl border-2 px-4 py-3 text-left font-black text-sm transition-all active:translate-y-0.5 ${
                  draft.confirmed
                    ? "bg-[#F0FDE4] border-[#58CC02] text-[#2D7800] shadow-[0_3px_0_#C8EDA0]"
                    : "bg-white border-[#E5E5E5] text-[#4B4B4B] shadow-[0_3px_0_#D4D4D4]"
                }`}
              >
                {draft.confirmed ? "I'm staying here ✓" : "I have my own stay"}
              </button>

              {!draft.confirmed && (
                <div className="mt-3 flex flex-col gap-3 pt-3 border-t-2 border-[#F0F0F0]">
                  <div>
                    <p className="font-black text-[#3C3C3C] text-xs mb-2">Hotel name</p>
                    <input
                      type="text"
                      value={draft.separateHotelName}
                      onChange={(e) =>
                        updateHotelDraft(hotel.id, { separateHotelName: e.target.value })
                      }
                      placeholder="Your hotel"
                      className={duoUi.input}
                    />
                  </div>
                  <div>
                    <p className="font-black text-[#3C3C3C] text-xs mb-2">Address</p>
                    <input
                      type="text"
                      value={draft.separateHotelAddress}
                      onChange={(e) =>
                        updateHotelDraft(hotel.id, { separateHotelAddress: e.target.value })
                      }
                      placeholder="Address"
                      className={duoUi.input}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <DuoStickyFooter>
        <DuoButton fullWidth disabled={saving} onClick={() => void handleContinue()}>
          {saving ? "Saving…" : "Continue"}
        </DuoButton>
      </DuoStickyFooter>
    </div>
  );
}
