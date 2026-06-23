import { useEffect, useState } from "react";
import { Hotel as HotelIcon, MapPin, Minus, Plane, Plus, Trash2, X as XIcon } from "lucide-react";
import type { Trip, TripFlight, TripHotel, TripMember } from "../../types/trip";
import { getTripById } from "../../services/tripService";
import {
  addTripFlight,
  getMemberFlights,
  hydrateTripFlightsFromCloud,
  removeTripFlight,
  updateTripFlight,
} from "../../services/flightService";
import {
  addTripHotel,
  getTripHotels,
  hydrateTripHotelsFromCloud,
  removeTripHotel,
  updateTripHotel,
  validateHotelDayRange,
} from "../../services/hotelService";
import { fetchPlaceDetails } from "../../services/placeService";
import { LogisticsTab } from "./LogisticsTab";
import { HotelPlaceAutocomplete } from "./HotelPlaceAutocomplete";
import { DuoDateField } from "./DuoDateField";
import { DuoTimeField } from "./DuoTimeField";
import { duoUi } from "../constants/duoUi";

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
          className="w-8 h-8 rounded-xl bg-white border-2 border-[#E5E5E5] flex items-center justify-center shadow-[0_2px_0_#D4D4D4] active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-40"
          aria-label={`Decrease ${label}`}
        >
          <Minus size={14} className="text-[#3C3C3C]" strokeWidth={3} />
        </button>
        <span className="flex-1 text-center font-black text-[#3C3C3C] text-base">{value}</span>
        <button
          type="button"
          onClick={inc}
          disabled={value >= max}
          className="w-8 h-8 rounded-xl bg-white border-2 border-[#E5E5E5] flex items-center justify-center shadow-[0_2px_0_#D4D4D4] active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-40"
          aria-label={`Increase ${label}`}
        >
          <Plus size={14} className="text-[#3C3C3C]" strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}

function computeDefaultHotelRange(tripDays: number, hotels: TripHotel[]): { start: number; end: number } {
  const coveredNights = new Set<number>();
  for (const h of hotels) {
    for (let night = h.dayStart; night <= h.dayEnd - 1; night++) coveredNights.add(night);
  }
  for (let night = 1; night <= tripDays - 1; night++) {
    if (!coveredNights.has(night)) return { start: night, end: night + 1 };
  }
  return { start: 1, end: Math.min(2, Math.max(2, tripDays)) };
}

type MemberPersonalLogisticsPanelProps = {
  tripId: string;
  member: TripMember;
};

export function MemberPersonalLogisticsPanel({
  tripId,
  member,
}: MemberPersonalLogisticsPanelProps) {
  const trip: Trip | null = getTripById(tripId);
  const tripDaysCount = Math.max(1, trip?.tripDays ?? 1);

  const [hotels, setHotels] = useState<TripHotel[]>([]);
  const [flights, setFlights] = useState<TripFlight[]>([]);

  const [hotelSheetOpen, setHotelSheetOpen] = useState(false);
  const [editingHotelId, setEditingHotelId] = useState<string | null>(null);
  const [hotelDraftName, setHotelDraftName] = useState("");
  const [hotelDraftPlaceId, setHotelDraftPlaceId] = useState("");
  const [hotelDraftAddress, setHotelDraftAddress] = useState<string | undefined>();
  const [hotelDraftStart, setHotelDraftStart] = useState(1);
  const [hotelDraftEnd, setHotelDraftEnd] = useState(2);
  const [hotelDraftError, setHotelDraftError] = useState<string | null>(null);

  const [flightSheetOpen, setFlightSheetOpen] = useState(false);
  const [editingFlightId, setEditingFlightId] = useState<string | null>(null);
  const [flightDraftOrigin, setFlightDraftOrigin] = useState("");
  const [flightDraftDestination, setFlightDraftDestination] = useState("");
  const [flightDraftDate, setFlightDraftDate] = useState("");
  const [flightDraftAirline, setFlightDraftAirline] = useState("");
  const [flightDraftNumber, setFlightDraftNumber] = useState("");
  const [flightDraftArrivalTime, setFlightDraftArrivalTime] = useState("");
  const [flightDraftDirection, setFlightDraftDirection] = useState<"arrival" | "departure">("arrival");

  const reloadLocal = () => {
    setHotels(getTripHotels(tripId));
    setFlights(getMemberFlights(tripId, member.id));
  };

  useEffect(() => {
    reloadLocal();
    void hydrateTripHotelsFromCloud(tripId).then(reloadLocal);
    void hydrateTripFlightsFromCloud(tripId).then(reloadLocal);
  }, [tripId, member.id]);

  const openAddHotelSheet = () => {
    const range = computeDefaultHotelRange(tripDaysCount, hotels);
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
    const name = hotelDraftName.trim();
    if (!name) {
      setHotelDraftError("Pick a hotel from search or enter a name.");
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
    reloadLocal();
    closeHotelSheet();
  };

  const handleRemoveHotel = () => {
    if (!editingHotelId) return;
    removeTripHotel(editingHotelId);
    reloadLocal();
    closeHotelSheet();
  };

  const openAddFlightSheet = () => {
    setEditingFlightId(null);
    setFlightDraftOrigin("");
    setFlightDraftDestination("");
    setFlightDraftDate("");
    setFlightDraftAirline("");
    setFlightDraftNumber("");
    setFlightDraftArrivalTime("");
    const hasArrival = flights.some((f) => f.direction === "arrival");
    setFlightDraftDirection(hasArrival ? "departure" : "arrival");
    setFlightSheetOpen(true);
  };

  const openEditFlightSheet = (flightId: string) => {
    const existing = flights.find((f) => f.id === flightId);
    if (!existing) return;
    setEditingFlightId(flightId);
    setFlightDraftOrigin(existing.origin);
    setFlightDraftDestination(existing.destination);
    setFlightDraftDate(existing.date);
    setFlightDraftAirline(existing.airline);
    setFlightDraftNumber(existing.flightNumber ?? "");
    setFlightDraftArrivalTime(existing.arrivalTime ?? "");
    setFlightDraftDirection(existing.direction ?? "arrival");
    setFlightSheetOpen(true);
  };

  const closeFlightSheet = () => {
    setFlightSheetOpen(false);
    setEditingFlightId(null);
  };

  const handleSaveFlight = () => {
    const origin = flightDraftOrigin.trim();
    const destination = flightDraftDestination.trim();
    const date = flightDraftDate.trim();
    const arrivalTime = flightDraftArrivalTime.trim();
    if (!origin || !destination || !date || !arrivalTime) return;

    const payload = {
      origin,
      destination,
      date,
      airline: flightDraftAirline.trim(),
      flightNumber: flightDraftNumber.trim() || undefined,
      arrivalTime,
      direction: flightDraftDirection,
    };

    if (editingFlightId) {
      updateTripFlight(editingFlightId, payload);
    } else {
      const existing = flights.find(
        (f) => f.memberId === member.id && f.direction === flightDraftDirection
      );
      if (existing) {
        updateTripFlight(existing.id, payload);
      } else {
        addTripFlight(tripId, member.id, payload);
      }
    }
    reloadLocal();
    closeFlightSheet();
  };

  const handleRemoveFlight = () => {
    if (!editingFlightId) return;
    removeTripFlight(editingFlightId);
    reloadLocal();
    closeFlightSheet();
  };

  const isEditFlight = editingFlightId !== null;
  const timeFieldLabel =
    flightDraftDirection === "arrival" ? "Arrival time" : "Departure time";
  const canSaveFlight =
    flightDraftOrigin.trim().length > 0 &&
    flightDraftDestination.trim().length > 0 &&
    flightDraftDate.trim().length > 0 &&
    flightDraftArrivalTime.trim().length > 0;

  return (
    <>
      <div className={`${duoUi.alertAmber} mb-4`}>
        <p className="font-black text-[#3C3C3C] text-sm mb-1">Your travel details</p>
        <p className="font-bold text-[#6B5A00] text-xs leading-snug">
          No group logistics yet — add your own flights and hotel so the plan can start and end at
          the right times.
        </p>
      </div>
      <LogisticsTab
          hotels={hotels}
          tripDays={tripDaysCount}
          onAddHotel={openAddHotelSheet}
          onEditHotel={openEditHotelSheet}
          members={[member]}
          flights={flights}
          onAddFlight={openAddFlightSheet}
          onEditFlight={openEditFlightSheet}
        />

      {hotelSheetOpen && trip && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={closeHotelSheet} aria-hidden />
          <div className="relative w-full max-w-[402px] mx-auto bg-white rounded-t-3xl border-t-2 border-x-2 border-[#E5E5E5] shadow-[0_-4px_0_#D4D4D4] max-h-[88vh] flex flex-col">
            <div className="pt-3 pb-2 flex-shrink-0">
              <div className="w-12 h-1 rounded-full bg-[#E5E5E5] mx-auto" aria-hidden />
            </div>
            <div className="px-5 pb-3 flex items-center gap-3 flex-shrink-0">
              <div className="w-10 h-10 rounded-xl bg-[#FFF4E5] flex items-center justify-center flex-shrink-0">
                <HotelIcon size={20} className="text-[#FF9600]" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-[#3C3C3C] text-base leading-tight">
                  {editingHotelId ? "Edit hotel" : "Add your hotel"}
                </p>
                <p className="font-bold text-[#AFAFAF] text-xs">
                  Check-in/out days shape your daily schedule
                </p>
              </div>
              <button
                type="button"
                onClick={closeHotelSheet}
                className="w-8 h-8 rounded-full bg-[#F0F0F0] flex items-center justify-center"
                aria-label="Close"
              >
                <XIcon size={16} className="text-[#3C3C3C]" strokeWidth={3} />
              </button>
            </div>
            <div className="px-5 pb-6 overflow-y-auto">
              <label className="block font-black text-[#3C3C3C] text-xs mb-2">Hotel name</label>
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
                    if (details?.formattedAddress) setHotelDraftAddress(details.formattedAddress);
                  });
                }}
                placeholder={`Search hotels in ${trip.destination || "the destination"}`}
                inputClassName="w-full px-4 py-3 rounded-2xl border-2 border-[#E5E5E5] bg-white text-sm font-bold text-[#3C3C3C] placeholder:text-[#AFAFAF] outline-none focus:border-[#1CB0F6]"
              />
              {hotelDraftAddress && (
                <p className="mt-2 text-xs font-bold text-[#AFAFAF] flex items-start gap-1">
                  <MapPin size={12} className="mt-0.5 flex-shrink-0" />
                  <span className="truncate">{hotelDraftAddress}</span>
                </p>
              )}
              <div className="mt-5 grid grid-cols-2 gap-3">
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
              {hotelDraftError && (
                <div className="mt-3 p-3 rounded-xl bg-[#FFEFEF] border border-[#FFC5C5]">
                  <p className="text-xs font-bold text-[#FF4B4B]">{hotelDraftError}</p>
                </div>
              )}
              <div className="mt-5 flex gap-3">
                {editingHotelId && (
                  <button
                    type="button"
                    onClick={handleRemoveHotel}
                    className="px-4 py-3 rounded-2xl border-2 border-[#FFC5C5] bg-white text-[#FF4B4B] font-black text-sm flex items-center gap-1.5"
                  >
                    <Trash2 size={16} />
                    Remove
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeHotelSheet}
                  className={duoUi.sheetSecondaryBtn}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveHotel}
                  className={duoUi.sheetPrimaryBtn}
                >
                  {editingHotelId ? "Save" : "Add hotel"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {flightSheetOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={closeFlightSheet} aria-hidden />
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
                  {isEditFlight ? "Edit flight" : "Add your flight"}
                </p>
                <p className="font-bold text-[#AFAFAF] text-xs">{member.name}</p>
              </div>
              <button
                type="button"
                onClick={closeFlightSheet}
                className="w-8 h-8 rounded-full bg-[#F0F0F0] flex items-center justify-center"
                aria-label="Close"
              >
                <XIcon size={16} className="text-[#3C3C3C]" strokeWidth={3} />
              </button>
            </div>
            <div className="px-5 pb-6 overflow-y-auto">
              <div
                role="tablist"
                aria-label="Flight direction"
                className="grid grid-cols-2 gap-1 p-1 bg-[#F0F0F0] rounded-2xl mb-4"
              >
                {(["arrival", "departure"] as const).map((dir) => {
                  const selected = flightDraftDirection === dir;
                  return (
                    <button
                      key={dir}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => setFlightDraftDirection(dir)}
                      className={`rounded-xl py-2 font-bold text-[13px] min-h-[36px] ${
                        selected
                          ? "bg-white text-[#3C3C3C] shadow-[0_2px_0_#D4D4D4]"
                          : "bg-transparent text-[#777777]"
                      }`}
                    >
                      {dir === "arrival" ? "Arriving" : "Departing"}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-[#3C3C3C] text-xs mb-2">From (IATA)</label>
                  <input
                    type="text"
                    value={flightDraftOrigin}
                    onChange={(e) => setFlightDraftOrigin(e.target.value.toUpperCase())}
                    maxLength={3}
                    placeholder="DCA"
                    className="w-full px-4 py-3 rounded-2xl border-2 border-[#E5E5E5] text-sm font-bold uppercase outline-none focus:border-[#1CB0F6]"
                  />
                </div>
                <div>
                  <label className="block font-black text-[#3C3C3C] text-xs mb-2">To (IATA)</label>
                  <input
                    type="text"
                    value={flightDraftDestination}
                    onChange={(e) => setFlightDraftDestination(e.target.value.toUpperCase())}
                    maxLength={3}
                    placeholder="CDG"
                    className="w-full px-4 py-3 rounded-2xl border-2 border-[#E5E5E5] text-sm font-bold uppercase outline-none focus:border-[#1CB0F6]"
                  />
                </div>
              </div>
              <label className="block font-black text-[#3C3C3C] text-xs mb-2 mt-4">Travel date</label>
              <DuoDateField
                value={flightDraftDate}
                onChange={setFlightDraftDate}
                placeholder="Pick date"
                ariaLabel="Pick travel date"
              />
              <label className="block font-black text-[#3C3C3C] text-xs mb-2 mt-4">{timeFieldLabel}</label>
              <DuoTimeField value={flightDraftArrivalTime} onChange={setFlightDraftArrivalTime} />
              <label className="block font-black text-[#3C3C3C] text-xs mb-2 mt-4">
                Airline <span className="font-bold text-[#AFAFAF]">(opt)</span>
              </label>
              <input
                type="text"
                value={flightDraftAirline}
                onChange={(e) => setFlightDraftAirline(e.target.value)}
                placeholder="Air France"
                className="w-full px-4 py-3 rounded-2xl border-2 border-[#E5E5E5] text-sm font-bold outline-none focus:border-[#1CB0F6]"
              />
              <label className="block font-black text-[#3C3C3C] text-xs mb-2 mt-4">
                Flight # <span className="font-bold text-[#AFAFAF]">(opt)</span>
              </label>
              <input
                type="text"
                value={flightDraftNumber}
                onChange={(e) => setFlightDraftNumber(e.target.value)}
                placeholder="AF123"
                className="w-full px-4 py-3 rounded-2xl border-2 border-[#E5E5E5] text-sm font-bold outline-none focus:border-[#1CB0F6]"
              />
              <div className="mt-5 flex gap-3">
                {isEditFlight && (
                  <button
                    type="button"
                    onClick={handleRemoveFlight}
                    className="px-4 py-3 rounded-2xl border-2 border-[#FFC5C5] bg-white text-[#FF4B4B] font-black text-sm flex items-center gap-1.5"
                  >
                    <Trash2 size={16} />
                    Remove
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeFlightSheet}
                  className={duoUi.sheetSecondaryBtn}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!canSaveFlight}
                  onClick={handleSaveFlight}
                  className={duoUi.sheetPrimaryBtn}
                >
                  {isEditFlight ? "Save" : "Add flight"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
