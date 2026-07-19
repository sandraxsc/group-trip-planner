/**
 * Pill badge with five fixed variants and a 200ms scale-in mount animation
 * (0.7 → 1.05 → 1). Wrapped in `aria-live="polite"` so the next status update
 * is announced by screen readers without interrupting the current speech.
 *
 * The variant → className map is hardcoded so Tailwind's class scanner picks
 * up every utility at build time — never build a class string by interpolating
 * the variant name.
 */
export type DuoBadgeVariant = "done" | "progress" | "locked" | "next" | "warning";

interface DuoBadgeProps {
  label: string;
  variant: DuoBadgeVariant;
}

const VARIANT_CLASSES: Record<DuoBadgeVariant, string> = {
  done: "bg-[#D7FFB8] text-[#2D7A00] border border-[#10B954]",
  progress: "bg-[#FFF0D4] text-[#8A5A00] border border-[#FFB000]",
  locked: "bg-[#F0F0F0] text-[#6B7280] border border-[#E8E8E8]",
  next: "bg-[#DDF4FF] text-[#005F8A] border border-[#1CB0F6]",
  warning: "bg-[#FFE8E8] text-[#9E0000] border border-[#FF5C5C]",
};

const POP_KEYFRAMES = `
@keyframes duo-badge-pop {
  0%   { transform: scale(0.7);  opacity: 0; }
  60%  { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(1);    opacity: 1; }
}
`;

export function DuoBadge({ label, variant }: DuoBadgeProps) {
  return (
    <span aria-live="polite" className="inline-flex">
      <style>{POP_KEYFRAMES}</style>
      <span
        className={`inline-block rounded-full font-bold text-[11px] px-[10px] py-[2px] ${VARIANT_CLASSES[variant]}`}
        style={{
          animation: "duo-badge-pop 200ms cubic-bezier(0.4, 0, 0.2, 1) both",
          transformOrigin: "center",
        }}
      >
        {label}
      </span>
    </span>
  );
}
