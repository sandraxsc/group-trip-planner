/** One AI meal suggestion before Places resolution */
export interface MealFoodGapRecommendation {
  name: string;
  searchQuery: string;
  mealType: "lunch" | "dinner" | "both";
  cuisineType: string;
  priceLevel: string;
  whyForThisGroup: string;
}

export interface MealFoodGapFillResponse {
  recommendations: MealFoodGapRecommendation[];
}
