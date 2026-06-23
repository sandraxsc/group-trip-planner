export interface GroupFlight {
  id: string;
  tripId: string;
  direction: "arrival" | "departure";
  origin?: string;
  destination?: string;
  date?: string;
  arrivalTime?: string;
  airline?: string;
  flightNumber?: string;
  durationMinutes?: number;
}

export interface GroupHotel {
  id: string;
  tripId: string;
  placeId?: string;
  name: string;
  address?: string;
  dayStart?: number;
  dayEnd?: number;
}

export interface MemberLogisticsConfirmation {
  id: string;
  tripId: string;
  memberId: string;
  logisticsType: "flight" | "hotel";
  logisticsId: string;
  confirmed: boolean;
  separateDate?: string;
  separateArrivalTime?: string;
  separateAirline?: string;
  separateFlightNumber?: string;
  separateHotelName?: string;
  separateHotelAddress?: string;
}
