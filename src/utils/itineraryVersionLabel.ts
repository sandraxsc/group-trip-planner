import type { ItineraryGenerationContext } from "../types/itinerary";

function formatMemberNames(names: string[]): string {
  if (names.length === 0) return "Group preferences";
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

function formatLogisticsSummary(ctx: ItineraryGenerationContext): string | null {
  const parts: string[] = [];
  if (ctx.groupFlightCount > 0) {
    parts.push(`${ctx.groupFlightCount} group flight${ctx.groupFlightCount === 1 ? "" : "s"}`);
  }
  if (ctx.groupHotelCount > 0) {
    parts.push(`${ctx.groupHotelCount} group hotel${ctx.groupHotelCount === 1 ? "" : "s"}`);
  }
  if (ctx.personalFlightCount > 0) {
    parts.push(`${ctx.personalFlightCount} personal flight${ctx.personalFlightCount === 1 ? "" : "s"}`);
  }
  if (ctx.personalHotelCount > 0) {
    parts.push(`${ctx.personalHotelCount} personal hotel${ctx.personalHotelCount === 1 ? "" : "s"}`);
  }
  if (parts.length === 0) return "preferences only";
  return parts.join(", ");
}

export type ItineraryVersionLabel = {
  title: string;
  subtitle?: string;
};

export function formatItineraryVersionLabel(
  ctx: ItineraryGenerationContext | null | undefined,
  resolvedFallback?: ItineraryGenerationContext | null
): ItineraryVersionLabel {
  const effective = ctx ?? resolvedFallback ?? null;
  if (!effective) {
    return { title: "Earlier plan" };
  }

  const membersPart = formatMemberNames(effective.memberNames);
  const logisticsPart = formatLogisticsSummary(effective);
  const title = `${membersPart} · ${logisticsPart}`;

  const subtitle =
    effective.completedMembers < effective.totalMembers
      ? `${effective.completedMembers} of ${effective.totalMembers} members had finished preferences`
      : effective.memberNames.length < effective.totalMembers
        ? `${effective.memberNames.length} of ${effective.totalMembers} members included`
        : undefined;

  return { title, subtitle };
}

export function formatItineraryVersionLabelLine(
  ctx: ItineraryGenerationContext | null | undefined,
  resolvedFallback?: ItineraryGenerationContext | null
): string {
  const { title, subtitle } = formatItineraryVersionLabel(ctx, resolvedFallback);
  return [title, subtitle].filter(Boolean).join(" · ");
}
