/** How the user entered the shared plans list (Step 3 vs Step 4). */
export type PlanListEntrySource = "generate" | "select";

export function parsePlanListEntrySource(value: unknown): PlanListEntrySource {
  return value === "select" ? "select" : "generate";
}
