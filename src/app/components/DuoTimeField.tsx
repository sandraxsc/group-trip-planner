import { Minus, Plus } from "lucide-react";

/**
 * Mobile-friendly Duolingo-style time field.
 *
 * - Hour (1–12) and Min steppers with big +/− tap targets.
 * - Dedicated AM / PM toggle so 12-hour times are never ambiguous.
 * - Value contract: still "HH:MM" 24-hour for storage, or "" when unset.
 */
interface DuoTimeFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Increment/decrement granularity for minutes. Defaults to 5. */
  minuteStep?: number;
}

function parseTime(value: string): { hour24: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(value);
  if (!m) return null;
  const hour24 = Math.max(0, Math.min(23, parseInt(m[1]!, 10)));
  const minute = Math.max(0, Math.min(59, parseInt(m[2]!, 10)));
  if (Number.isNaN(hour24) || Number.isNaN(minute)) return null;
  return { hour24, minute };
}

function formatTime24(hour24: number, minute: number): string {
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** 24h → 12h clock face (1–12) and AM/PM. */
function to12Hour(hour24: number): { hour12: number; period: "AM" | "PM" } {
  const period: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
  const h = hour24 % 12;
  const hour12 = h === 0 ? 12 : h;
  return { hour12, period };
}

/** 12h + period → 24h. */
function to24Hour(hour12: number, period: "AM" | "PM"): number {
  const h = ((hour12 - 1 + 12) % 12) + 1; // clamp to 1..12
  if (period === "AM") return h === 12 ? 0 : h;
  return h === 12 ? 12 : h + 12;
}

/** Sensible default when the user first taps a stepper on an empty field. */
const DEFAULT_HOUR24 = 12;
const DEFAULT_MINUTE = 0;

export function DuoTimeField({
  value,
  onChange,
  minuteStep = 5,
}: DuoTimeFieldProps) {
  const parsed = parseTime(value);
  const isSet = parsed !== null;
  const hour24 = parsed?.hour24 ?? DEFAULT_HOUR24;
  const minute = parsed?.minute ?? DEFAULT_MINUTE;
  const { hour12, period } = to12Hour(hour24);

  const ensureSet = (): { hour24: number; minute: number } => {
    if (parsed) return parsed;
    const initial = { hour24: DEFAULT_HOUR24, minute: DEFAULT_MINUTE };
    onChange(formatTime24(initial.hour24, initial.minute));
    return initial;
  };

  const apply = (h24: number, min: number) => {
    onChange(formatTime24(h24, min));
  };

  const nudgeHour24 = (delta: number) => {
    const { hour24: h, minute: m } = ensureSet();
    const wrapped = ((h + delta) % 24 + 24) % 24;
    apply(wrapped, m);
  };

  const setMinute = (nextMin: number) => {
    const { hour24: h, minute: m } = ensureSet();
    const wrapped = ((nextMin % 60) + 60) % 60;
    apply(h, wrapped);
  };

  const nudgeMinute = (delta: number) => {
    const { hour24: h, minute: m } = ensureSet();
    const wrapped = ((m + delta) % 60 + 60) % 60;
    apply(h, wrapped);
  };

  const setPeriod = (next: "AM" | "PM") => {
    const { hour24: h, minute: m } = ensureSet();
    const { hour12: h12 } = to12Hour(h);
    apply(to24Hour(h12, next), m);
  };

  const displayHour = isSet ? String(hour12) : "—";
  const displayMin = isSet ? String(minute).padStart(2, "0") : "—";

  return (
    <div>
      <div className="flex items-stretch gap-2">
        <Stepper
          label="Hour"
          display={displayHour}
          onIncrement={() => (isSet ? nudgeHour24(1) : ensureSet())}
          onDecrement={() => (isSet ? nudgeHour24(-1) : ensureSet())}
        />
        <Stepper
          label="Min"
          display={displayMin}
          onIncrement={() => (isSet ? nudgeMinute(minuteStep) : ensureSet())}
          onDecrement={() => (isSet ? nudgeMinute(-minuteStep) : ensureSet())}
        />
        <PeriodToggle
          period={isSet ? period : null}
          onSelect={setPeriod}
          disabled={!isSet}
        />
      </div>
    </div>
  );
}

function PeriodToggle({
  period,
  onSelect,
  disabled,
}: {
  period: "AM" | "PM" | null;
  onSelect: (p: "AM" | "PM") => void;
  disabled: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="AM or PM"
      className="flex flex-col gap-1 w-[52px] flex-shrink-0"
    >
      {(["AM", "PM"] as const).map((p) => {
        const selected = period === p;
        return (
          <button
            key={p}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => {
              if (disabled || selected) return;
              onSelect(p);
            }}
            className={`duo-focusable flex-1 min-h-[36px] rounded-xl border-2 font-black text-[12px] transition-all duration-[150ms] ${
              disabled
                ? "border-[#E5E5E5] bg-[#FAFAFA] text-[#AFAFAF] cursor-not-allowed"
                : selected
                  ? "border-[#1899D6] bg-[#1CB0F6] text-white shadow-[0_2px_0_#1899D6]"
                  : "border-[#E5E5E5] bg-white text-[#777777] shadow-[0_2px_0_#D4D4D4] active:translate-y-0.5 active:shadow-none"
            }`}
            style={{ touchAction: "manipulation" }}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}

function Stepper({
  label,
  display,
  onIncrement,
  onDecrement,
}: {
  label: string;
  display: string;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <div className="flex-1 min-w-0 rounded-2xl border-2 border-[#E5E5E5] bg-white px-2 py-1.5 flex items-center gap-1">
      <button
        type="button"
        onClick={onDecrement}
        aria-label={`Decrease ${label.toLowerCase()}`}
        className="duo-focusable w-9 h-9 rounded-xl bg-[#F0F0F0] flex items-center justify-center text-[#3C3C3C] active:translate-y-0.5"
        style={{ touchAction: "manipulation" }}
      >
        <Minus size={16} strokeWidth={3} />
      </button>
      <div className="flex-1 text-center min-w-0">
        <div className="font-normal text-[10px] text-[#777777] uppercase tracking-[0.06em]">
          {label}
        </div>
        <div className="font-black text-[20px] text-[#3C3C3C] leading-none">
          {display}
        </div>
      </div>
      <button
        type="button"
        onClick={onIncrement}
        aria-label={`Increase ${label.toLowerCase()}`}
        className="duo-focusable w-9 h-9 rounded-xl bg-[#F0F0F0] flex items-center justify-center text-[#3C3C3C] active:translate-y-0.5"
        style={{ touchAction: "manipulation" }}
      >
        <Plus size={16} strokeWidth={3} />
      </button>
    </div>
  );
}
