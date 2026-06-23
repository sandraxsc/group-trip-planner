import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Lock,
  Map as MapIcon,
  RefreshCw,
  Sliders,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TripMember } from "../../types/trip";
import { DuoAvatar } from "./DuoAvatar";
import type { DuoAvatarColorKey, DuoAvatarStatus } from "./DuoAvatar";
import { DuoBadge } from "./DuoBadge";

/**
 * "Plan" tab for the trip detail page. Owns two sections:
 *   1. Members — horizontal row of DuoAvatars with an "Invite +" header link.
 *   2. Planning steps — heading + large per-step cards with status badge &
 *      affordance.
 *
 * Pure presentation: all business state (which steps are completed, which is
 * locked, etc.) is computed by the parent and threaded in via props. The
 * component never reads from services or storage on its own.
 */

/** Mirrors the legacy MEMBER_COLORS in TripDetailScreen so avatar colors stay consistent. */
const MEMBER_COLORS = [
  "#58CC02",
  "#1CB0F6",
  "#CE82FF",
  "#FF4B4B",
  "#FFD900",
  "#FF9F1C",
] as const;

function memberColorKeyFor(index: number): DuoAvatarColorKey {
  const hex = MEMBER_COLORS[index % MEMBER_COLORS.length];
  if (hex === "#58CC02") return "green";
  if (hex === "#1CB0F6") return "blue";
  if (hex === "#FF4B4B") return "coral";
  return "amber";
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Map the trip-domain `PreferenceStatus` onto the design-system avatar status.
 * Done at the component edge so DuoAvatar stays generic and doesn't import
 * `types/trip.ts`. Unknown values fall through to "not_started" — the most
 * conservative state, which signals "this guest hasn't done anything yet"
 * rather than implying false progress.
 */
function preferenceStatusToDot(
  status: TripMember["preferenceStatus"]
): DuoAvatarStatus {
  if (status === "completed") return "complete";
  if (status === "in_progress") return "in_progress";
  return "not_started";
}

/** Step id (1..4) → lucide icon shown in the active step's status circle. */
const STEP_ICONS: Record<number, LucideIcon> = {
  1: Users,
  2: Sliders,
  3: RefreshCw,
  4: MapIcon,
};

export interface PlanTabStep {
  id: number;
  label: string;
  sublabel?: string;
  completed: boolean;
  locked: boolean;
  linkedTab?: "logistics";
  clickableWhenCompleted?: boolean;
  /** Step 3 active badge override (hidden on row — chevron only per product spec). */
  generateLabel?: "Generate" | "View Plans" | "Regenerate";
  /** Step 4 — no row badge; selection happens inside plan detail. */
  selectLabel?: "Select";
  /** When true, active step shows chevron only (no Generate/Select pill). */
  hideActiveBadge?: boolean;
  /** Override active-step badge (defaults to "Start"). */
  activeBadgeLabel?: string;
  /** When true, render as active (blue) even if `completed` is true — for steps still needing action. */
  displayAsActive?: boolean;
}

interface PlanTabProps {
  members: TripMember[];
  steps: PlanTabStep[];
  completedCount: number;
  totalCount: number;
  onInvite: () => void;
  /** When false, only the members row is shown (itinerary already exists). */
  showPlanningSteps?: boolean;
  /** Fired when a member avatar/name is tapped (edit own prefs or view another member). */
  onMemberTap?: (memberId: string) => void;
  /**
   * When true (e.g. trip is at full capacity), the "Invite +" header link
   * is rendered as a disabled gray button and the click handler is a no-op.
   */
  inviteDisabled?: boolean;
  onStepTap: (stepId: number, linkedTab?: string) => void;
}

type StepStatus = "completed" | "active" | "locked";

function getStatus(step: PlanTabStep): StepStatus {
  if (step.displayAsActive) return "active";
  if (step.completed) return "completed";
  if (step.locked) return "locked";
  return "active";
}

function activeStepBadgeLabel(step: PlanTabStep): string {
  if (step.selectLabel) return step.selectLabel;
  if (step.generateLabel) return step.generateLabel;
  if (step.activeBadgeLabel) return step.activeBadgeLabel;
  return "Start";
}

export function PlanTab({
  members,
  steps,
  completedCount,
  totalCount,
  onInvite,
  showPlanningSteps = true,
  onMemberTap,
  inviteDisabled = false,
  onStepTap,
}: PlanTabProps) {
  const showHorizontalScroll = members.length > 4;

  // ─── Step completion burst ──────────────────────────────────────────
  // Track previous completion state per step id so we can detect the exact
  // false→true transition on the next render and run the green ring burst on
  // the corresponding icon. We intentionally seed `prevCompletedRef` lazily
  // (on first render) so steps that are *already* completed at mount don't
  // fire a burst immediately.
  const prevCompletedRef = useRef<Record<number, boolean> | null>(null);
  const [burstingIds, setBurstingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (prevCompletedRef.current === null) {
      const seed: Record<number, boolean> = {};
      for (const s of steps) seed[s.id] = s.completed;
      prevCompletedRef.current = seed;
      return;
    }
    const prev = prevCompletedRef.current;
    const newlyCompleted: number[] = [];
    for (const s of steps) {
      if (s.completed && !prev[s.id]) newlyCompleted.push(s.id);
      prev[s.id] = s.completed;
    }
    if (newlyCompleted.length === 0) return;
    setBurstingIds((curr) => {
      const next = new Set(curr);
      for (const id of newlyCompleted) next.add(id);
      return next;
    });
    const timer = setTimeout(() => {
      setBurstingIds((curr) => {
        const next = new Set(curr);
        for (const id of newlyCompleted) next.delete(id);
        return next;
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [steps]);

  return (
    <div className="flex flex-col gap-6 pb-6">
      {/* ── Section 1 — Members ────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-[11px] text-[#777777] uppercase tracking-[0.07em]">
            MEMBERS
          </h2>
          <button
            type="button"
            onClick={onInvite}
            disabled={inviteDisabled}
            aria-label={inviteDisabled ? "Trip is full, cannot invite more members" : "Invite a member"}
            className={`duo-focusable font-bold text-[13px] ${
              inviteDisabled
                ? "text-[#AFAFAF] cursor-not-allowed"
                : "text-[#58CC02] cursor-pointer"
            }`}
            style={{ touchAction: "manipulation" }}
          >
            Invite +
          </button>
        </div>
        <div
          className={`flex gap-3 pb-1 ${
            showHorizontalScroll ? "overflow-x-auto no-scrollbar" : ""
          }`}
        >
          {members.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onMemberTap?.(m.id)}
              disabled={!onMemberTap}
              className="duo-focusable flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer disabled:cursor-default active:opacity-80 transition-opacity"
              style={{ touchAction: "manipulation" }}
              aria-label={`View ${m.name}`}
            >
              <DuoAvatar
                initials={getInitials(m.name)}
                colorKey={memberColorKeyFor(i)}
                size="md"
                status={preferenceStatusToDot(m.preferenceStatus)}
              />
              <span className="font-normal text-[11px] text-[#777777] text-center max-w-[72px] truncate">
                {m.name}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Section 2 — Planning steps ─────────────────────────────────── */}
      {showPlanningSteps && (
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-[11px] text-[#777777] uppercase tracking-[0.07em]">
            PLANNING STEPS
          </h2>
          <span
            className="font-normal text-[12px] text-[#777777]"
            aria-label={`${completedCount} of ${totalCount} steps complete`}
          >
            {completedCount}/{totalCount}
          </span>
        </div>
        <div role="list" className="flex flex-col gap-2">
          {steps.map((step) => {
            const status = getStatus(step);
            const isCompleted = status === "completed";
            const isActive = status === "active";
            const isLocked = status === "locked";

            const cardBase =
              "duo-focusable border-2 rounded-2xl p-[12px_14px] flex items-center gap-[10px] transition-all duration-[150ms]";
            const cardVariant = isCompleted
              ? "bg-[#F8FFF0] border-[#58CC02] shadow-[0_4px_0_#C8EDA0]"
              : isActive
                ? "bg-white border-[#1CB0F6] shadow-[0_4px_0_#80CAFF] cursor-pointer active:translate-y-0.5 active:shadow-none"
                : "bg-[#FAFAFA] border-[#E5E5E5] shadow-[0_4px_0_#D4D4D4] opacity-60 cursor-not-allowed";

            const Icon = STEP_ICONS[step.id] ?? Users;
            const isBursting = burstingIds.has(step.id);

            const iconCircle = isCompleted ? (
              <div
                className={`w-6 h-6 rounded-full bg-[#58CC02] flex items-center justify-center flex-shrink-0${
                  isBursting ? " step-burst" : ""
                }`}
              >
                <CheckCircle2 size={16} className="text-white" />
              </div>
            ) : isActive ? (
              <div className="w-6 h-6 rounded-full bg-white border-2 border-[#1CB0F6] flex items-center justify-center flex-shrink-0">
                <Icon size={12} className="text-[#1CB0F6]" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-[#F0F0F0] flex items-center justify-center flex-shrink-0">
                <Lock size={12} style={{ color: "#AFAFAF" }} />
              </div>
            );

            const right = isLocked ? (
              <Lock size={16} className="text-[#E5E5E5] flex-shrink-0" />
            ) : isActive || isCompleted ? (
              <ChevronRight
                size={18}
                className={`flex-shrink-0 pointer-events-none ${
                  isActive ? "text-[#1CB0F6]" : "text-[#AFAFAF]"
                }`}
                aria-hidden
              />
            ) : null;

            const badge = isCompleted ? (
              <DuoBadge label="Done" variant="done" />
            ) : isActive && !step.hideActiveBadge ? (
              <DuoBadge label={activeStepBadgeLabel(step)} variant="next" />
            ) : isLocked ? (
              <DuoBadge label="Locked" variant="locked" />
            ) : null;

            const handleActivate = () => {
              if (isLocked) return;
              onStepTap(step.id, step.linkedTab);
            };

            const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
              if (isLocked) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleActivate();
              }
            };

            return (
              <div
                key={step.id}
                role="listitem"
                aria-label={step.label}
                aria-current={isActive ? "step" : undefined}
                aria-disabled={isLocked || undefined}
                tabIndex={isLocked ? -1 : 0}
                onClick={handleActivate}
                onKeyDown={handleKeyDown}
                className={`${cardBase} ${cardVariant}`}
                style={{ touchAction: "manipulation" }}
              >
                {iconCircle}
                <div className="flex-1 min-w-0">
                  <div
                    className={`font-bold text-[14px] ${
                      isCompleted ? "line-through text-[#AFAFAF]" : "text-[#3C3C3C]"
                    }`}
                  >
                    {step.label}
                  </div>
                  {step.sublabel && (
                    <div className="font-normal text-[12px] text-[#777777] mt-0.5">
                      {step.sublabel}
                    </div>
                  )}
                </div>
                {badge}
                {right}
              </div>
            );
          })}
        </div>
      </section>
      )}
    </div>
  );
}
