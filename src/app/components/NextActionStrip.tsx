import { useRef } from "react";
import { ChevronRight } from "lucide-react";
import type { KeyboardEventHandler, ReactNode } from "react";

/**
 * A dark "what's next" CTA strip — sits above content blocks to nudge the
 * user toward the most important pending action. Visual pulse on the left
 * accent bar draws attention until the user actually engages with it; once
 * clicked the pulse stops permanently for that mount.
 *
 * Implementation notes:
 * - The pulse runs as a CSS @keyframes animation injected via a `<style>` tag
 *   so the component is fully self-contained (no global CSS dependency).
 * - "Stop pulsing after first click" is implemented with a `useRef` boolean
 *   flag + an imperative DOM mutation on the accent bar, which avoids
 *   triggering any React re-render of this component on click.
 * - `role="button"` + `tabIndex={0}` + Enter/Space key handling make the
 *   non-button container fully keyboard-operable; touch-action: manipulation
 *   removes the 300ms tap-delay on touchscreens.
 */
interface NextActionStripProps {
  icon: ReactNode;
  label: string;
  action: string;
  hint?: string;
  onClick: () => void;
}

const PULSE_KEYFRAMES = `
@keyframes next-action-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.5; }
}
`;

export function NextActionStrip({
  icon,
  label,
  action,
  hint,
  onClick,
}: NextActionStripProps) {
  const hasClickedRef = useRef(false);
  const accentBarRef = useRef<HTMLSpanElement>(null);

  const activate = () => {
    if (!hasClickedRef.current) {
      hasClickedRef.current = true;
      // Imperatively stop the pulse — no re-render needed.
      if (accentBarRef.current) {
        accentBarRef.current.style.animation = "none";
      }
    }
    onClick();
  };

  const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  };

  // The trailing → in `hint` is decorative; drop it from the aria-label so a
  // screen reader doesn't announce "right arrow" mid-sentence.
  const cleanHint = hint?.replace(/\s*→\s*$/, "").trim();
  const ariaLabel = cleanHint
    ? `Next step: ${action}. ${cleanHint}.`
    : `Next step: ${action}.`;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={activate}
      onKeyDown={handleKeyDown}
      style={{ touchAction: "manipulation" }}
      className="duo-focusable w-full rounded-xl cursor-pointer select-none bg-[#1F302E] hover:bg-[#0d3d26] active:scale-[0.99] transition-all duration-[150ms] p-[12px_14px] flex items-center gap-3"
    >
      <style>{PULSE_KEYFRAMES}</style>

      <span
        ref={accentBarRef}
        aria-hidden
        className="w-1 self-stretch rounded-l-[4px] bg-[#10B954]"
        style={{ animation: "next-action-pulse 2.5s ease-in-out infinite" }}
      />

      <span className="w-9 h-9 rounded-lg bg-[rgba(88,204,2,0.15)] flex items-center justify-center flex-shrink-0">
        {icon}
      </span>

      <span className="flex-1 min-w-0">
        <span className="block font-bold text-[10px] text-[rgba(255,255,255,0.5)] uppercase tracking-[0.06em]">
          {label}
        </span>
        <span className="block font-black text-[14px] text-white">{action}</span>
        {hint && (
          <span className="block font-normal text-[11px] text-[rgba(255,255,255,0.5)]">
            {hint}
          </span>
        )}
      </span>

      <ChevronRight size={16} style={{ color: "rgba(255,255,255,0.4)" }} />
    </div>
  );
}
