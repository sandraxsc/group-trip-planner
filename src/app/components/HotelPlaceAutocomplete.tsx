import { useEffect, useRef, useState } from "react";
import { fetchHotelPlaceSuggestions, type HotelPlaceSuggestion } from "../../services/placeService";

const DEBOUNCE_MS = 320;

export function HotelPlaceAutocomplete({
  destination,
  value,
  onChange,
  onPick,
  placeholder = "Add your hotel",
  inputClassName = "",
  disabled = false,
}: {
  destination: string;
  value: string;
  onChange: (label: string) => void;
  onPick: (placeId: string, name: string) => void;
  placeholder?: string;
  inputClassName?: string;
  disabled?: boolean;
}) {
  const [debounced, setDebounced] = useState("");
  const [suggestions, setSuggestions] = useState<HotelPlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [value]);

  useEffect(() => {
    if (debounced.trim().length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const ac = new AbortController();
    let cancelled = false;
    setLoading(true);

    fetchHotelPlaceSuggestions({
      query: debounced,
      destination,
      maxResults: 8,
      signal: ac.signal,
    })
      .then((rows) => {
        if (cancelled) return;
        setSuggestions(rows);
        setHighlight(-1);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      ac.abort();
    };
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

  const showList = open && (suggestions.length > 0 || loading);

  const pick = (s: HotelPlaceSuggestion) => {
    onPick(s.placeId, s.name);
    setSuggestions([]);
    setOpen(false);
    setHighlight(-1);
  };

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
        onFocus={() => setOpen(true)}
        onBlur={() => {
          /* dropdown picks use mousedown preventDefault */
        }}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter" && highlight >= 0 && suggestions[highlight]) {
            e.preventDefault();
            pick(suggestions[highlight]!);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className={inputClassName}
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={showList ? "hotel-place-suggestions" : undefined}
      />

      {showList && (
        <ul
          id="hotel-place-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-52 overflow-y-auto rounded-xl border border-[#ECECEC] bg-white py-1 shadow-lg"
        >
          {loading && suggestions.length === 0 && (
            <li className="px-3 py-2 text-xs font-bold text-[#AFAFAF]">Searching…</li>
          )}
          {suggestions.map((s, i) => (
            <li key={s.placeId} role="option" aria-selected={highlight === i}>
              <button
                type="button"
                className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm ${
                  highlight === i ? "bg-[#E8F7FF]" : "hover:bg-[#F7F7F7]"
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
              >
                <span className="font-black text-[#3C3C3C]">{s.name}</span>
                {s.formattedAddress && (
                  <span className="text-[11px] font-bold leading-tight text-[#AFAFAF]">
                    {s.formattedAddress}
                  </span>
                )}
              </button>
            </li>
          ))}
          {!loading && suggestions.length === 0 && debounced.trim().length >= 2 && (
            <li className="px-3 py-2 text-xs font-bold text-[#AFAFAF]">No hotels found — try another name</li>
          )}
        </ul>
      )}
    </div>
  );
}
