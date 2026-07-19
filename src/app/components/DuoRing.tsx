/**
 * Circular SVG progress ring. The arc is drawn via `strokeDasharray`/
 * `strokeDashoffset` on a full-circle circle element, rotated -90deg so
 * progress starts at 12 o'clock. `color` accepts any CSS color string
 * (not a fixed variant set) so callers can match whichever Duo accent
 * the surrounding context uses.
 */
interface DuoRingProps {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  label: string;
  sublabel?: string;
}

export function DuoRing({
  value,
  max,
  size = 72,
  stroke = 6,
  color = "#10B954",
  trackColor = "#E8E8E8",
  label,
  sublabel,
}: DuoRingProps) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="absolute -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct)}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 500ms ease" }}
          />
        </svg>
        <span className="relative text-base font-black" style={{ color }}>
          {label}
        </span>
      </div>
      {sublabel && (
        <span className="text-[9px] font-bold text-[#6B7280]">{sublabel}</span>
      )}
    </div>
  );
}
