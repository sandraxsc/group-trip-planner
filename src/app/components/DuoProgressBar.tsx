import { useEffect, useState } from "react";
import { tokens } from "../../styles/tokens";

/**
 * Duolingo-style progress bar with a green gradient fill, a continuously
 * sweeping shimmer overlay (until the bar hits 100), and a percentage label
 * that lives inside the fill once it's wide enough (>= 20%) and otherwise
 * sits to the right of the track.
 *
 * The fill animates from 0 to `value` on mount via a controlled state update
 * scheduled in `useEffect`; the actual width tween is a CSS transition so
 * subsequent value changes are also smooth.
 *
 * ARIA: `role="progressbar"` with valuemin / valuenow / valuemax + a label
 * fall-through to "Progress" when none is supplied.
 */
interface DuoProgressBarProps {
  value: number;
  label?: string;
}

const SHIMMER_KEYFRAMES = `
@keyframes duo-progress-shimmer {
  0%   { transform: translateX(-150%); }
  100% { transform: translateX(250%); }
}
`;

export function DuoProgressBar({ value, label }: DuoProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    // Defer to next frame so the browser paints width=0 first; that gives the
    // CSS `transition: width …` something to interpolate from on initial mount.
    const id = requestAnimationFrame(() => setAnimatedValue(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  const showInsideLabel = clamped >= 20;

  return (
    <div className="w-full flex items-center gap-2">
      <style>{SHIMMER_KEYFRAMES}</style>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Progress"}
        className="relative flex-1 h-4 rounded-full bg-[#E5E5E5] border-2 border-[#CECECE] overflow-hidden"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full overflow-hidden"
          style={{
            width: `${animatedValue}%`,
            background: `linear-gradient(90deg, ${tokens.colors.green}, #7AE820)`,
            transition: "width 600ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {clamped < 100 && (
            <span
              aria-hidden
              className="absolute top-0 bottom-0 w-1/3 bg-white/40"
              style={{
                animation: "duo-progress-shimmer 2s linear infinite",
                filter: "blur(2px)",
              }}
            />
          )}
          {showInsideLabel && (
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
              {clamped}%
            </span>
          )}
        </div>
      </div>
      {!showInsideLabel && (
        <span className="text-[10px] font-bold text-[#3C3C3C]">{clamped}%</span>
      )}
    </div>
  );
}
