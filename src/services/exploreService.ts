import { getApiProxyBase } from "../config/apiProxy";

export type ExploreCategory = "restaurants" | "attractions" | "nearby_towns";

export interface ExplorePlaceSuggestion {
  /** Specific real-world venue or town name (display label). */
  name: string;
  /** One-sentence reason this place is recommended. */
  blurb: string;
  /** 3-7 word query suitable for Google Places searchText to resolve a real placeId. */
  searchQuery: string;
}

export interface ExploreRecommendationsResponse {
  /** Short conversational paragraph (2-3 sentences) introducing the category in this destination. */
  intro: string;
  places: ExplorePlaceSuggestion[];
}

export interface ExploreRecommendationsRequest {
  destination: string;
  category: ExploreCategory;
  /** Names of places the traveler has already added — the model will skip duplicates. */
  alreadyAdded?: string[];
  signal?: AbortSignal;
}

function isValidPlace(p: unknown): p is ExplorePlaceSuggestion {
  if (!p || typeof p !== "object") return false;
  const o = p as Partial<ExplorePlaceSuggestion>;
  return (
    typeof o.name === "string" &&
    o.name.trim().length > 0 &&
    typeof o.blurb === "string" &&
    typeof o.searchQuery === "string" &&
    o.searchQuery.trim().length > 0
  );
}

function validateResponse(data: unknown): ExploreRecommendationsResponse {
  if (!data || typeof data !== "object") {
    return { intro: "", places: [] };
  }
  const maybe = data as Partial<ExploreRecommendationsResponse>;
  const intro = typeof maybe.intro === "string" ? maybe.intro : "";
  const places = Array.isArray(maybe.places) ? maybe.places.filter(isValidPlace) : [];
  return { intro, places };
}

/**
 * Ask the AI for a short intro paragraph + a list of must-go places in the
 * destination for the given category (restaurants / attractions / nearby_towns).
 * Throws on transport failure; caller is expected to handle errors and show a
 * fallback UI.
 */
export async function fetchExploreRecommendations(
  params: ExploreRecommendationsRequest
): Promise<ExploreRecommendationsResponse> {
  const { destination, category, alreadyAdded, signal } = params;
  const base = getApiProxyBase();
  const url = `${base}/api/openai/explore-recommendations`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      destination,
      category,
      alreadyAdded: alreadyAdded ?? [],
    }),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Explore recommendations failed (${res.status}): ${text || res.statusText}`);
  }
  const data = (await res.json()) as unknown;
  return validateResponse(data);
}
