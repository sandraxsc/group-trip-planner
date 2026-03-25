export type GooglePlacesSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText?: string;
  fullText: string;
};

function getGooglePlacesApiKey(): string {
  /**
   * Configure your Google Places API key here:
   * - Create a Google Cloud project, enable the "Places API" (Places API (New))
   * - Create an API key
   * - Add it to a local `.env` file as:
   *     VITE_GOOGLE_PLACES_API_KEY="YOUR_KEY"
   *
   * Note: Any `VITE_*` env var is embedded in the frontend bundle. For a real
   * production app, proxy this request through a backend to keep your key secret.
   */
  const key = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined;
  if (!key) {
    throw new Error(
      "Missing VITE_GOOGLE_PLACES_API_KEY. Add it to your .env file and restart the dev server."
    );
  }
  return key;
}

type PlacesAutocompleteApiResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
};

export async function getPlaceAutocompleteSuggestions(params: {
  input: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<GooglePlacesSuggestion[]> {
  const { input, limit = 7, signal } = params;
  const trimmed = input.trim();
  if (trimmed.length < 2) return [];

  const apiKey = getGooglePlacesApiKey();

  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      // Keep the response small; adjust as needed.
      "X-Goog-FieldMask":
        "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
    },
    body: JSON.stringify({
      input: trimmed,
      languageCode: "en",
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Google Places autocomplete failed (${res.status}). ${text || res.statusText}`
    );
  }

  const data = (await res.json()) as PlacesAutocompleteApiResponse;
  const suggestions = (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter(Boolean)
    .map((p) => {
      const placeId = p?.placeId ?? "";
      const primaryText = p?.structuredFormat?.mainText?.text?.trim() ?? "";
      const secondaryText = p?.structuredFormat?.secondaryText?.text?.trim() ?? undefined;
      const fullText = p?.text?.text?.trim() ?? primaryText;
      return { placeId, primaryText, secondaryText, fullText };
    })
    .filter((s) => s.placeId && (s.primaryText || s.fullText));

  return suggestions.slice(0, limit);
}

