import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Mobile-friendly Duolingo-style date field.
 *
 * - Trigger: rounded-2xl button that shows the selected date in a friendly
 *   format ("Mon, Mar 4, 2026") or the placeholder when empty.
 * - On click the calendar slides in inline below the trigger (no nested
 *   modal), so it works inside bottom sheets without z-index drama.
 * - Calendar grid: month-year header with prev/next arrows, weekday row, and
 *   a 7-col day grid. Selected day is the Duolingo green pill, today gets a
 *   subtle ring, out-of-month padding cells are empty placeholders.
 *
 * Value contract: the native HTML date format `YYYY-MM-DD` so callers can
 * keep the existing `flightDraftDate` string state untouched.
 */
interface DuoDateFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** ARIA label for the trigger button. */
  ariaLabel?: string;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAY_NAMES = ["S", "M", "T", "W", "T", "F", "S"];

function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = parseInt(m[1]!, 10);
  const mo = parseInt(m[2]!, 10) - 1;
  const d = parseInt(m[3]!, 10);
  const date = new Date(y, mo, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatFriendly(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildCalendarGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i += 1) grid.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) grid.push(new Date(year, month, d));
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

export function DuoDateField({
  value,
  onChange,
  placeholder = "Pick a date",
  ariaLabel = "Select date",
}: DuoDateFieldProps) {
  const selected = parseISODate(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [open, setOpen] = useState(false);
  const [viewYM, setViewYM] = useState<{ y: number; m: number }>(() => {
    const seed = selected ?? today;
    return { y: seed.getFullYear(), m: seed.getMonth() };
  });

  // When the user reopens the calendar after picking a date elsewhere, jump
  // the visible month to the selected date so the highlight is in view.
  useEffect(() => {
    if (open && selected) {
      setViewYM({ y: selected.getFullYear(), m: selected.getMonth() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close-on-outside-click for accessibility / mobile UX hygiene. The inline
  // calendar gracefully collapses when the user taps elsewhere on the form.
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapperRef.current) return;
      const target = e.target as Node | null;
      if (target && !wrapperRef.current.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  const goPrev = () =>
    setViewYM(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }));
  const goNext = () =>
    setViewYM(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }));

  const days = buildCalendarGrid(viewYM.y, viewYM.m);
  const headerLabel = `${MONTH_NAMES[viewYM.m]} ${viewYM.y}`;

  const handleSelect = (d: Date) => {
    onChange(formatISODate(d));
    setOpen(false);
  };

  return (
    <div ref={wrapperRef}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="duo-focusable w-full px-4 py-3 rounded-2xl border-2 border-[#E5E5E5] bg-white text-left text-sm font-bold flex items-center justify-between focus:border-[#1CB0F6]"
        style={{ touchAction: "manipulation" }}
      >
        <span className={selected ? "text-[#3C3C3C]" : "text-[#AFAFAF]"}>
          {selected ? formatFriendly(selected) : placeholder}
        </span>
        <Calendar size={18} className="text-[#AFAFAF]" />
      </button>

      {open && (
        <div className="mt-2 bg-white rounded-2xl border-2 border-[#E5E5E5] shadow-[0_4px_0_#E5E5E5] p-3">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous month"
              className="duo-focusable w-9 h-9 rounded-xl bg-[#F0F0F0] flex items-center justify-center active:translate-y-0.5"
              style={{ touchAction: "manipulation" }}
            >
              <ChevronLeft size={18} className="text-[#3C3C3C]" />
            </button>
            <div className="font-black text-[14px] text-[#3C3C3C]">
              {headerLabel}
            </div>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next month"
              className="duo-focusable w-9 h-9 rounded-xl bg-[#F0F0F0] flex items-center justify-center active:translate-y-0.5"
              style={{ touchAction: "manipulation" }}
            >
              <ChevronRight size={18} className="text-[#3C3C3C]" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_NAMES.map((d, i) => (
              <div
                key={`${d}-${i}`}
                className="text-center font-bold text-[10px] text-[#AFAFAF] uppercase"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((cell, i) => {
              if (!cell) return <div key={`pad-${i}`} className="h-9" />;
              const isSelected = !!selected && sameDay(cell, selected);
              const isToday = sameDay(cell, today);
              const baseCell =
                "duo-focusable h-9 rounded-xl font-bold text-[13px] transition-all";
              const variant = isSelected
                ? "bg-[#58CC02] text-white shadow-[0_2px_0_#46A302]"
                : isToday
                  ? "border-2 border-[#58CC02] text-[#3C3C3C] bg-white"
                  : "text-[#3C3C3C] bg-[#F7F7F7] hover:bg-[#EAEAEA]";
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelect(cell)}
                  aria-pressed={isSelected}
                  aria-label={formatFriendly(cell)}
                  className={`${baseCell} ${variant}`}
                  style={{ touchAction: "manipulation" }}
                >
                  {cell.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
