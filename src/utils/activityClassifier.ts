import { getPrimaryCategory } from "../services/activityEngine";

/** Union of food hints used across itinerary scheduling and meal-gap fill. */
export const FOOD_ACTIVITY_HINTS = [
  "food",
  "meal",
  "restaurant",
  "dining",
  "cafe",
  "coffee",
  "bakery",
  "dessert",
  "bistro",
  "brasserie",
  "diner",
  "pub",
  "bar",
  "eatery",
  "pizza",
  "sushi",
  "ramen",
  "taco",
  "tapas",
  "steak",
  "grill",
  "bbq",
  "barbecue",
  "teppanyaki",
  "izakaya",
  "trattoria",
  "osteria",
  "kitchen",
  "kiosk",
  "brunch",
  "breakfast",
  "lunch",
  "dinner",
] as const;

export type FoodActivityLike = {
  categories?: string[];
  name?: string;
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const FOOD_NAME_WORD_PATTERN = new RegExp(
  `\\b(${FOOD_ACTIVITY_HINTS.map(escapeRegex).join("|")})\\b`,
  "i"
);

/**
 * Whether a vote/itinerary candidate should be treated as food (meals, restaurants, etc.).
 * Uses primary category, category-type hints, and whole-word name hints (avoids "pub" in "Public").
 */
export function isFoodActivity(candidate: FoodActivityLike): boolean {
  const cats = (candidate.categories ?? []).map((c) => c.toLowerCase());
  if (cats.some((c) => FOOD_ACTIVITY_HINTS.some((h) => c.includes(h)))) return true;

  const name = candidate.name ?? "";
  if (name.trim() && FOOD_NAME_WORD_PATTERN.test(name)) return true;

  // Category rules only — getPrimaryCategory(name) uses substring hints that false-positive on "Public".
  if (getPrimaryCategory({ categories: candidate.categories }) === "food") return true;

  return false;
}
