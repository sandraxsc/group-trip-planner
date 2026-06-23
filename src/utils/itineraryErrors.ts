export type ItineraryGenerationError = {
  code:
    | "ITINERARY_CLOUD_REQUIRED"
    | "ITINERARY_SAVE_FAILED"
    | "NO_CANDIDATES"
    | "TRIP_NOT_FOUND";
  message: string;
};

export function isItineraryGenerationError(err: unknown): err is ItineraryGenerationError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as ItineraryGenerationError).message === "string"
  );
}

export const ITINERARY_CLOUD_REQUIRED_MESSAGE =
  "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file (see .env.iteration.example), run the SQL migrations in Supabase, then restart npm run dev.";
