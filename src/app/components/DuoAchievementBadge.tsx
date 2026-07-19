/**
 * Tiered achievement badge (bronze/silver/gold/diamond). Locked badges swap
 * the emoji for a lock glyph and desaturate via `grayscale` — kept as a CSS
 * filter rather than a second icon set so any emoji works without a matching
 * "locked" variant.
 *
 * The tier → className map is static (not built by interpolating the tier
 * name) so Tailwind's class scanner picks up every utility at build time.
 */
export type DuoAchievementTier = "bronze" | "silver" | "gold" | "diamond";

interface DuoAchievementBadgeProps {
  emoji: string;
  label: string;
  tier: DuoAchievementTier;
  unlocked?: boolean;
}

const TIER_CLASSES: Record<DuoAchievementTier, { bg: string; ring: string }> = {
  bronze: { bg: "bg-[#FDF4EC]", ring: "border-[#CD7F32] shadow-[0_4px_0_#CD7F32]" },
  silver: { bg: "bg-[#F7F7F6]", ring: "border-[#C4C4C4] shadow-[0_4px_0_#C4C4C4]" },
  gold: { bg: "bg-[#FFF8E1]", ring: "border-[#FFB000] shadow-[0_4px_0_#FFB000]" },
  diamond: { bg: "bg-[#F5F3FF]", ring: "border-[#A78BFA] shadow-[0_4px_0_#A78BFA]" },
};

const LOCKED_CLASSES = "bg-[#F7F7F6] border-[#E8E8E8] shadow-[0_4px_0_#E8E8E8]";

export function DuoAchievementBadge({
  emoji,
  label,
  tier,
  unlocked = true,
}: DuoAchievementBadgeProps) {
  const t = TIER_CLASSES[tier];

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl ${
          unlocked ? `${t.bg} ${t.ring}` : LOCKED_CLASSES
        }`}
        style={!unlocked ? { filter: "grayscale(1) opacity(0.5)" } : undefined}
      >
        {unlocked ? emoji : "🔒"}
      </div>
      <span
        className={`text-[9px] font-bold text-center w-14 leading-tight ${
          unlocked ? "text-[#1F302E]" : "text-[#6B7280]"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
