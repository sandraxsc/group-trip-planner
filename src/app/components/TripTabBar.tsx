import { useEffect, useRef, useState } from "react";

/**
 * Two-tab switcher specific to the trip-detail page (NOT the global BottomNav).
 *
 * Duolingo-style: a pill track with two equal-width buttons. The active tab
 * gets a solid green fill + white text; the inactive tab is transparent with
 * muted gray text. An optional `planBadge` (e.g. "1/4") renders as small
 * muted text next to the "Plan" label — no colored chip, no warning glyphs.
 *
 * A11y:
 * - `role="tablist"` / `role="tab"` with `aria-selected` and `aria-controls`
 *   wired to "plan-panel" / "logistics-panel" — the parent must render the
 *   matching panel elements with those IDs.
 * - A visually-hidden `aria-live="polite"` region announces tab changes after
 *   the initial mount (so the first render isn't read out as a "switch").
 */
type TripTab = "plan" | "logistics";

interface TripTabBarProps {
  activeTab: TripTab;
  onChange: (tab: TripTab) => void;
  /** Optional progress hint for the Plan tab, e.g. "1/4". Renders inline as muted text. */
  planBadge?: string;
}

function tabClass(isActive: boolean): string {
  return `duo-focusable rounded-xl py-[10px] px-3 font-bold text-[14px] transition-all duration-[150ms] flex items-center justify-center gap-[6px] min-h-[44px] ${
    isActive ? "bg-[#58CC02] text-white" : "bg-transparent text-[#777777]"
  }`;
}

export function TripTabBar({ activeTab, onChange, planBadge }: TripTabBarProps) {
  const isFirstRender = useRef(true);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const tabName = activeTab === "plan" ? "Plan" : "Logistics";
    setAnnouncement(`Switched to ${tabName} tab.`);
  }, [activeTab]);

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
