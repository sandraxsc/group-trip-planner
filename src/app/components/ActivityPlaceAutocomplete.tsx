import { useEffect, useMemo, useRef, useState } from "react";
import { getPlaceAutocompleteSuggestions, type GooglePlacesSuggestion } from "../services/googlePlaces";

const DEBOUNCE_MS = 260;

export function ActivityPlaceAutocomplete({
  destination,
  value,
  onChange,
  onPick,
  placeholder = "Enter location or address",
  inputClassName = "",
  disabled = false,
}: {
  destination: string;
  value: string;
  onChange: (label: string) => void;
  onPick: (placeId: string, label: string) => void;
  placeholder?: string;
  inputClassName?: string;
  disabled?: boolean;
}) {
  const [debounced, setDebounced] = useState(value);
  const [suggestions, setSuggestions] = useState<GooglePlacesSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [value]);

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setHighlight(-1);
      setOpen(false);
      return;
    }

    const ac = new AbortController();
    setLoading(true);
    setOpen(true);

    // Note: Places autocomplete endpoint only takes `input`. We lightly bias with destination words.
    const input = destination?.trim() ? `${q} ${destination}` : q;

    getPlaceAutocompleteSuggestions({ input, limit: 7, signal: ac.signal })
      .then((rows) => {
        setSuggestions(rows);
        setHighlight(-1);
      })
      .catch(() => {
        setSuggestions([]);
        setHighlight(-1);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    return () => ac.abort();
  }, [debounced, destination]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const shown = open && (loading || suggestions.length > 0);

  const pick = (s: GooglePlacesSuggestion) => {
    const label = s.fullText || s.primaryText;
    onPick(s.placeId, label);
    setOpen(false);
    setHighlight(-1);
    setSuggestions([]);
  };

  const options = useMemo(() => suggestions, [suggestions]);

  return (
    <div ref={rootRef} className="relative w-full">
      <input
        type="text"
        autoComplete="off"
        disabled={disabled}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        placeholder={placeholder}
        onFocus={() => {
          const q = value.trim();
          if (q.length >= 2) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!shown) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter" && highlight >= 0 && options[highlight]) {
            e.preventDefault();
            pick(options[highlight]!);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={inputClassName}
      />

      {shown && (
        <ul
          id="activity-place-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-52 overflow-y-auto rounded-xl border border-[#ECECEC] bg-white py-1 shadow-lg"
        >
          {loading && options.length === 0 && (
            <li className="px-3 py-2 text-xs font-bold text-[#6B7280]">Searching…</li>
          )}

          {options.map((s, i) => (
            <li key={s.placeId} role="option" aria-selected={highlight === i}>
              <button
                type="button"
                className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm ${
                  highlight === i ? "bg-[#E8F7FF]" : "hover:bg-[#F7F7F6]"
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
              >
                <span className="font-black text-[#1F302E]">{s.primaryText}</span>
                {s.secondaryText && (
                  <span className="text-[11px] font-bold leading-tight text-[#6B7280]">
                    {s.secondaryText}
                  </span>
                )}
              </button>
            </li>
          ))}

          {!loading && options.length === 0 && debounced.trim().length >= 2 && (
            <li className="px-3 py-2 text-xs font-bold text-[#6B7280]">No matches found</li>
          )}
        </ul>
      )}
    </div>
  );
}

