/**
 * Round avatar with the Duolingo "weighted bottom" look — a 3px white outline
 * ring and a 3px solid bottom border in the dark shade of the avatar's color.
 *
 * The colorKey → className mapping is intentionally a static object so Tailwind
 * can statically scan every utility class at build time. Do not interpolate
 * color names into class strings dynamically.
 */
export type DuoAvatarColorKey = "green" | "blue" | "coral" | "amber";
export type DuoAvatarSize = "sm" | "md";
/**
 * Status indicator dot variants. Mirrors the in-app `PreferenceStatus` type
 * but stays string-literal so DuoAvatar doesn't take a hard dep on the
 * `types/trip.ts` domain type (callers do the mapping).
 *  - "complete"    → green
 *  - "in_progress" → yellow
 *  - "not_started" → gray
 */
export type DuoAvatarStatus = "complete" | "in_progress" | "not_started";

interface DuoAvatarProps {
  initials: string;
  colorKey: DuoAvatarColorKey;
  size?: DuoAvatarSize;
  /** Status indicator dot. Omit (or pass `undefined`) to hide the dot. */
  status?: DuoAvatarStatus;
  /**
   * Legacy shortcut: `online === true` is treated as `status="complete"`.
   * Prefer `status` for new code so all three states are reachable.
   */
  online?: boolean;
}

/** bg = main color · border-b = darker bottom edge */
const COLOR_CLASSES: Record<DuoAvatarColorKey, string> = {
  green: "bg-[#10B954] border-b-[#0D9443]",
  blue: "bg-[#1CB0F6] border-b-[#0A91D1]",
  coral: "bg-[#FF5C5C] border-b-[#CC3333]",
  amber: "bg-[#FFB000] border-b-[#CC8C00]",
};

const SIZE_CLASSES: Record<DuoAvatarSize, string> = {
  sm: "w-8 h-8 text-[12px]",
  md: "w-10 h-10 text-[14px]",
};

const STATUS_CLASSES: Record<DuoAvatarStatus, string> = {
  complete: "bg-[#10B954]",
  in_progress: "bg-[#FFB000]",
  not_started: "bg-[#C3C3C3]",
};

const STATUS_LABELS: Record<DuoAvatarStatus, string> = {
  complete: "Preferences complete",
  in_progress: "Preferences in progress",
  not_started: "Preferences not started",
};

export function DuoAvatar({
  initials,
  colorKey,
  size = "md",
  status,
  online = false,
}: DuoAvatarProps) {
  // Resolve the effective status: explicit `status` wins; otherwise the legacy
  // `online` boolean maps to "complete" (preserves prior visuals for callers
  // that haven't migrated yet). Undefined → no dot.
  const effectiveStatus: DuoAvatarStatus | undefined =
    status ?? (online ? "complete" : undefined);

  return (
    <div className="relative inline-block leading-none">
      <div
        aria-label={`Avatar ${initials}`}
        className={`rounded-full flex items-center justify-center font-bold text-white ring-[3px] ring-white border-b-[3px] ${COLOR_CLASSES[colorKey]} ${SIZE_CLASSES[size]}`}
      >
        {initials}
      </div>
      {effectiveStatus && (
        <span
          role="img"
          aria-label={STATUS_LABELS[effectiveStatus]}
          className={`absolute -bottom-0.5 -right-0.5 w-[10px] h-[10px] rounded-full ring-2 ring-white ${STATUS_CLASSES[effectiveStatus]}`}
        />
      )}
    </div>
  );
}
