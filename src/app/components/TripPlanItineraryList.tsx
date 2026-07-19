import { Fragment, useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Clock } from "lucide-react";
import { DaySplitTimeline } from "./DaySplitTimeline";
import { buildDayTimeline } from "../utils/buildDayTimeline";
import { dayReasoningBullets } from "../utils/itineraryDisplayHelpers";
import type { DisplayDay } from "../utils/itineraryToDisplayDays";
import type { TransitInfo } from "../../services/transitService";
import type { TripMember } from "../../types/trip";
import {
  getInsightProgress,
  subscribeInsightProgress,
  type DayInsightProgress,
} from "../../utils/itineraryGenerationStatus";

interface TripPlanItineraryListProps {
  displayDays: DisplayDay[];
  members: TripMember[];
  transitByDay: Record<number, TransitInfo[]>;
  adjustedStartByDay: Record<number, string[]>;
  timelineByDay: Map<number, ReturnType<typeof buildDayTimeline>> | null;
  useSplitTimelineView: boolean;
  loading?: boolean;
  loadError?: string | null;
  emptyMessage?: string;
  onBackToTrip?: () => void;
  /** Extra bottom padding when a sticky footer sits below this list. */
  contentPaddingBottom?: boolean;
  /** Controlled expanded day; defaults to internal state starting at day 1. */
  expandedDay?: number | null;
  onExpandedDayChange?: (day: number | null) => void;
  /** When provided, day reasoning is read live from the insightProgress bus first. */
  tripId?: string;
}

export function TripPlanItineraryList({
  displayDays,
  members,
  transitByDay,
  adjustedStartByDay,
  timelineByDay,
  useSplitTimelineView,
  loading = false,
  loadError = null,
  emptyMessage = "No itinerary yet. Generate a plan from the trip page.",
  onBackToTrip,
  contentPaddingBottom = false,
  expandedDay: expandedDayProp,
  onExpandedDayChange,
  tripId,
}: TripPlanItineraryListProps) {
  const [internalExpandedDay, setInternalExpandedDay] = useState<number | null>(1);
  const [whyDayOpen, setWhyDayOpen] = useState<Record<number, boolean>>({});
  const [liveInsights, setLiveInsights] = useState<DayInsightProgress[]>(
    tripId ? getInsightProgress(tripId) : []
  );

  useEffect(() => {
    if (!tripId) return;
    setLiveInsights(getInsightProgress(tripId));
    return subscribeInsightProgress((changedId) => {
      if (changedId === tripId) setLiveInsights(getInsightProgress(tripId));
    });
  }, [tripId]);

  const expandedDay = expandedDayProp !== undefined ? expandedDayProp : internalExpandedDay;
  const setExpandedDay = (day: number | null) => {
    if (onExpandedDayChange) onExpandedDayChange(day);
    else setInternalExpandedDay(day);
  };

  return (
    <div className={`flex flex-col gap-3 ${contentPaddingBottom ? "pb-36" : ""}`}>
      <h2 className="font-black text-[#1F302E] text-base uppercase tracking-[0.4px]">
        🗺️ ITINERARY
      </h2>
      {loading ? (
        <div className="bg-white rounded-2xl border-2 border-[#E8E8E8] p-6 text-center">
          <p className="text-[#6B7280] font-bold text-sm">Loading plan…</p>
        </div>
      ) : loadError ? (
        <div className="bg-white rounded-2xl border-2 border-[#E8E8E8] p-6 text-center">
          <p className="text-[#6B7280] font-bold text-sm">{loadError}</p>
        </div>
      ) : displayDays.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-[#E8E8E8] p-6 text-center">
          <p className="text-[#6B7280] font-bold text-sm">{emptyMessage}</p>
          {onBackToTrip && (
            <button
              type="button"
              onClick={onBackToTrip}
              className="mt-4 text-sm font-black text-[#1CB0F6]"
            >
              Back to trip
            </button>
          )}
        </div>
      ) : (
        displayDays.map((day) => {
          const isExpanded = expandedDay === day.day;
          const dayTimeline = timelineByDay?.get(day.day);
          const showSplitTimeline = Boolean(useSplitTimelineView && dayTimeline?.hasSplit);
          return (
            <div
              key={day.day}
              className={`bg-white rounded-2xl border-2 overflow-hidden transition-all ${
                isExpanded
                  ? "border-[#10B954] shadow-[0_4px_0_#0D9443]"
                  : "border-[#E8E8E8] shadow-[0_4px_0_#C4C4C4]"
              }`}
            >
              <button
                className="w-full flex items-center gap-3 p-4"
                onClick={() => setExpandedDay(isExpanded ? null : day.day)}
              >
                <div
                  className={`w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0 text-xl border-2 ${
                    isExpanded
                      ? "bg-[#E6F4EA] border-[#0D9443]"
                      : "bg-[#F7F7F6] border-[#E8E8E8]"
                  }`}
                >
                  {day.emoji}
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-black uppercase tracking-[0.6px] ${
                        isExpanded ? "text-[#10B954]" : "text-[#6B7280]"
                      }`}
                    >
                      Day {day.day}
                    </span>
                    <span className="text-xs font-bold text-[#6B7280]">·</span>
                    <span className="text-xs font-bold text-[#6B7280]">{day.date}</span>
                    {showSplitTimeline && (
                      <span className="text-[10px] font-black uppercase tracking-[0.4px] text-[#FF9F1C] bg-[#FFF8E6] border border-[#FFB000] rounded-full px-2 py-0.5 flex-shrink-0">
                        Split day
                      </span>
                    )}
                  </div>
                  <h3 className="font-black text-[#1F302E] text-lg leading-[27px]">{day.title}</h3>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-bold text-[#6B7280]">
                    {day.events.length} stops
                  </span>
                  {isExpanded ? (
                    <ChevronUp size={18} className="text-[#10B954]" />
                  ) : (
                    <ChevronDown size={18} className="text-[#6B7280]" />
                  )}
                </div>
              </button>

              {day.flightNote && (
                <div className="mx-4 mb-3 flex items-start gap-2 rounded-2xl border-2 border-[#84D8FF] bg-[#E5F6FF] px-3 py-2">
                  <span className="text-base leading-none">✈️</span>
                  <p className="text-[12px] font-bold leading-snug text-[#1B7DB5]">{day.flightNote}</p>
                </div>
              )}

              {(() => {
                const reasoning =
                  liveInsights.find((ins) => ins.dayNumber === day.day)?.dayReasoning ??
                  day.dayReasoning;
                if (!reasoning) return null;
                return (
                  <div className="px-4 pb-1 border-t border-[#F0F0F0]">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between gap-2 py-2.5 text-left"
                      onClick={() =>
                        setWhyDayOpen((prev) => ({ ...prev, [day.day]: !prev[day.day] }))
                      }
                    >
                      <span className="text-[11px] font-black uppercase tracking-[0.5px] text-[#6B7280]">
                        Why this day?
                      </span>
                      {whyDayOpen[day.day] ? (
                        <ChevronUp size={16} className="text-[#6B7280] flex-shrink-0" />
                      ) : (
                        <ChevronDown size={16} className="text-[#6B7280] flex-shrink-0" />
                      )}
                    </button>
                    {whyDayOpen[day.day] && (
                      <ul className="space-y-1.5 pb-3 pr-1">
                        {dayReasoningBullets(reasoning).map((line, idx) => (
                          <li
                            key={`${day.day}-why-${idx}`}
                            className="flex gap-2 text-xs font-bold text-[#6B7280] leading-snug"
                          >
                            <span className="mt-[0.45em] h-1.5 w-1.5 rounded-full bg-[#C4C4C4] flex-shrink-0" />
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })()}

              {isExpanded && day.events.length > 0 && showSplitTimeline && dayTimeline ? (
                <DaySplitTimeline
                  rows={dayTimeline.rows}
                  members={members}
                  adjustedTimes={adjustedStartByDay[day.day] ?? []}
                  transitByDay={transitByDay[day.day] ?? []}
                  onOpenEvent={() => {}}
                />
              ) : (
                isExpanded &&
                day.events.length > 0 && (
                  <div className="border-t-2 border-[#F0F0F0]">
                    {day.events.map((event, idx) => (
                      <Fragment key={event.id}>
                        <div
                          className={`flex items-start gap-3 p-4 ${
                            idx !== day.events.length - 1 ? "border-b border-[#F0F0F0]" : ""
                          }`}
                        >
                          <div className="flex flex-col items-center w-5 flex-shrink-0 pt-1">
                            <div
                              className={`w-3 h-3 rounded-full border-2 border-white ${
                                event.isAirport
                                  ? "bg-[#1CB0F6] shadow-[0_0_0_2px_#1CB0F6]"
                                  : "bg-[#10B954] shadow-[0_0_0_2px_#10B954]"
                              }`}
                            />
                            {idx !== day.events.length - 1 && (
                              <div className="w-0.5 flex-1 bg-[#E8E8E8] mt-1 min-h-[40px]" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-xs font-black text-[#6B7280] flex-shrink-0">
                                  {adjustedStartByDay[day.day]?.[idx] ?? event.time}
                                </span>
                                <span
                                  className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                                  style={{
                                    color: event.categoryColor,
                                    backgroundColor: event.categoryBg,
                                  }}
                                >
                                  {event.type}
                                </span>
                              </div>
                              <h4 className="font-black text-[#1F302E] text-base leading-snug break-words">
                                {event.title}
                              </h4>
                              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                {event.duration && (
                                  <div className="flex items-center gap-1">
                                    <Clock size={11} className="text-[#6B7280]" />
                                    <span className="text-xs font-bold text-[#6B7280]">
                                      {event.duration}
                                    </span>
                                  </div>
                                )}
                                {event.cost && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs font-bold text-[#6B7280]">
                                      💵 {event.cost}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {event.image && (
                              <img
                                src={event.image}
                                alt={event.title}
                                className="w-16 h-16 aspect-square object-cover rounded-xl flex-shrink-0"
                              />
                            )}
                          </div>
                        </div>
                        {idx < day.events.length - 1 && transitByDay[day.day]?.[idx] && (
                          <div className="px-4 h-8 flex items-center">
                            <div className="ml-8 text-[11px] font-bold text-[#6B7280] flex items-center gap-2">
                              <span>
                                {transitByDay[day.day][idx]!.method === "walk"
                                  ? "🚶"
                                  : transitByDay[day.day][idx]!.method === "transit"
                                    ? "🚌"
                                    : "🚗"}
                              </span>
                              <span>
                                {transitByDay[day.day][idx]!.source === "heuristic" ? "~" : ""}
                                {transitByDay[day.day][idx]!.minutes} min transit
                              </span>
                            </div>
                          </div>
                        )}
                      </Fragment>
                    ))}
                  </div>
                )
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
