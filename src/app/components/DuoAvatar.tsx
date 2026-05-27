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

interface DuoAvatarProps {
  initials: string;
  colorKey: DuoAvatarColorKey;
  size?: DuoAvatarSize;
  online?: boolean;
}

/** bg = main color · border-b = darker bottom edge */
const COLOR_CLASSES: Record<DuoAvatarColorKey, string> = {
  green: "bg-[#58CC02] border-b-[#46A302]",
  blue: "bg-[#1CB0F6] border-b-[#0A91D1]",
  coral: "bg-[#FF4B4B] border-b-[#CC3B3B]",
  amber: "bg-[#FF9600] border-b-[#CC7800]",
};

const SIZE_CLASSES: Record<DuoAvatarSize, string> = {
  sm: "w-8 h-8 text-[12px]",
  md: "w-10 h-10 text-[14px]",
};

export function DuoAvatar({
  initials,
  colorKey,
  size = "md",
  online = false,
}: DuoAvatarProps) {
  return (
    <div className="relative inline-block leading-none">
      <div
        aria-label={`Avatar ${initials}`}
        className={`rounded-full flex items-center justify-center font-bold text-white ring-[3px] ring-white border-b-[3px] ${COLOR_CLASSES[colorKey]} ${SIZE_CLASSES[size]}`}
      >
        {initials}
      </div>
      {online && (
        <span
          aria-hidden
          className="absolute -bottom-0.5 -right-0.5 w-[10px] h-[10px] rounded-full bg-[#58CC02] ring-2 ring-white"
        />
      )}
    </div>
  );
}
