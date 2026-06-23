import { useEffect, useRef, useState } from "react";

/**
 * Tab switcher specific to the trip-detail page (NOT the global BottomNav).
 *
 * Duolingo-style: a pill track with equal-width buttons. The active tab
 * gets a solid green fill + white text; the inactive tab is transparent with
 * muted gray text. An optional `planBadge` (e.g. "1/4") renders as small
 * muted text next to the "Plan" label — no colored chip, no warning glyphs.
 *
 * In `executingMode`, renders three tabs (Itinerary / Alternates / Logistics)
 * in a horizontal flex row that scrolls when space is tight.
 *
 * A11y:
 * - `role="tablist"` / `role="tab"` with `aria-selected` and `aria-controls`
 *   wired to panel IDs — the parent must render matching panel elements.
 * - A visually-hidden `aria-live="polite"` region announces tab changes after
 *   the initial mount (so the first render isn't read out as a "switch").
 */
export type TripTab = "plan" | "logistics" | "itinerary" | "alternates";

interface TripTabBarProps {
  activeTab: TripTab;
  onChange: (tab: TripTab) => void;
  /** Optional progress hint for the Plan tab, e.g. "1/4". Renders inline as muted text. */
  planBadge?: string;
  /** When true, show Itinerary / Alternates / Logistics instead of Plan / Logistics. */
  executingMode?: boolean;
  /** Badge count on the Alternates tab when > 0 (executing mode only). */
  alternatesCount?: number;
}

function tabClass(isActive: boolean, executing = false): string {
  return `duo-focusable rounded-xl py-[10px] px-3 font-bold text-[14px] transition-all duration-[150ms] flex items-center justify-center gap-[6px] min-h-[44px] ${
    executing ? "flex-1 min-w-[90px]" : ""
  } ${
    isActive ? "bg-[#58CC02] text-white" : "bg-transparent text-[#777777]"
  }`;
}

const TAB_LABELS: Record<TripTab, string> = {
  plan: "Plan",
  logistics: "Logistics",
  itinerary: "Itinerary",
  alternates: "Alternates",
};

export function TripTabBar({
  activeTab,
  onChange,
  planBadge,
  executingMode = false,
  alternatesCount = 0,
}: TripTabBarProps) {
  const isFirstRender = useRef(true);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const tabName = TAB_LABELS[activeTab] ?? activeTab;
    setAnnouncement(`Switched to ${tabName} tab.`);
  }, [activeTab]);

  if (executingMode) {
    return (
      <div className="w-full">
        <div
          role="tablist"
          aria-label="Trip sections"
          className="w-full bg-white rounded-2xl border-2 border-[#E5E5E5] shadow-[0_4px_0_#E5E5E5] p-1 flex flex-row gap-1 overflow-x-auto no-scrollbar"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "itinerary"}
            aria-controls="itinerary-panel"
            onClick={() => onChange("itinerary")}
            className={tabClass(activeTab === "itinerary", true)}
            style={{ touchAction: "manipulation" }}
          >
            <span>Itinerary</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "alternates"}
            aria-controls="alternates-panel"
            onClick={() => onChange("alternates")}
            className={tabClass(activeTab === "alternates", true)}
            style={{ touchAction: "manipulation" }}
          >
            <span>Alternates</span>
            {alternatesCount > 0 && (
              <span
                className={`font-normal text-[12px] rounded-full px-1.5 min-w-[1.25rem] text-center ${
                  activeTab === "alternates" ? "bg-white/25 text-white" : "bg-[#E5E5E5] text-[#777777]"
                }`}
              >
                {alternatesCount}
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "logistics"}
            aria-controls="logistics-panel"
            onClick={() => onChange("logistics")}
            className={tabClass(activeTab === "logistics", true)}
            style={{ touchAction: "manipulation" }}
          >
            <span>Logistics</span>
          </button>
        </div>

        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div
        role="tablist"
        aria-label="Trip sections"
        className="w-full bg-white rounded-2xl border-2 border-[#E5E5E5] shadow-[0_4px_0_#E5E5E5] p-1 grid grid-cols-2 gap-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "plan"}
          aria-controls="plan-panel"
          onClick={() => onChange("plan")}
          className={tabClass(activeTab === "plan")}
          style={{ touchAction: "manipulation" }}
        >
          <span>Plan</span>
          {planBadge && (
            <span className="font-normal text-[12px] opacity-70">{planBadge}</span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "logistics"}
          aria-controls="logistics-panel"
          onClick={() => onChange("logistics")}
          className={tabClass(activeTab === "logistics")}
          style={{ touchAction: "manipulation" }}
        >
          <span>Logistics</span>
        </button>
      </div>

      {/* Visually-hidden live region — announces tab changes only after the
          initial mount, never on first render. */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}
