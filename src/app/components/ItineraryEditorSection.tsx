import type { Dispatch, SetStateAction } from "react";
import { ChevronDown, ChevronUp, Clock, GripVertical, Trash2 } from "lucide-react";
import { HotelPlaceAutocomplete } from "./HotelPlaceAutocomplete";
import { ActivityPlaceAutocomplete } from "./ActivityPlaceAutocomplete";
import { DaySplitTimeline } from "./DaySplitTimeline";
import { fetchPlaceDetails } from "../../services/placeService";
import type { AiEnhanceProposal } from "../../types/aiEnhance";
import type { ItineraryEditRow } from "../../types/itinerary";
import type { Trip, TripMember } from "../../types/trip";
import type { DisplayDay } from "../utils/itineraryToDisplayDays";
import type { TransitInfo } from "../../services/transitService";
import type { buildDayTimeline } from "../utils/buildDayTimeline";

type ActivityEvent = {
  id: string;
  title: string;
  image?: string | null;
  duration: string;
  durationMinutes?: number;
  cost: string;
  isHotel?: boolean;
  isPlaceholder?: boolean;
  detailPlaceId?: string;
  savedDescription?: string | null;
  savedCategoryLabel?: string | null;
  savedRating?: number;
};

export type ItineraryEditorSectionProps = {
  aiSummary: string | null;
  aiProposals: AiEnhanceProposal[];
  aiSelectedProposalIds: Record<string, boolean>;
  setAiSelectedProposalIds: Dispatch<SetStateAction<Record<string, boolean>>>;
  handleApplySelectedAiChanges: () => void;
  displayDays: DisplayDay[];
  expandedDay: number | null;
  setExpandedDay: Dispatch<SetStateAction<number | null>>;
  whyDayOpen: Record<number, boolean>;
  setWhyDayOpen: Dispatch<SetStateAction<Record<number, boolean>>>;
  dayReasoningBullets: (text: string) => string[];
  timelineByDay: Map<number, ReturnType<typeof buildDayTimeline>> | null;
  useSplitTimelineView: boolean;
  members: TripMember[];
  adjustedStartByDay: Record<number, string[]>;
  transitByDay: Record<number, TransitInfo[]>;
  openActivityDetail: (event: ActivityEvent, day: number, index: number) => void;
  handleEditMoveRow: (fromDay: number, fromIndex: number, toDay: number, toIndex: number) => void;
  openTimePicker: (day: number, idx: number, currentLabel: string) => void;
  editRowsDraft: Record<string, ItineraryEditRow[]>;
  trip: Trip | null;
  updateHotelRow: (
    dayNum: number,
    rowId: string,
    patch: { hotelLabel?: string; placeId?: string | undefined }
  ) => void;
  updateActivityRow: (
    dayNum: number,
    rowId: string,
    patch: {
      activityLabel?: string;
      placeId?: string | undefined;
      isPlaceholder?: boolean;
      location?: { lat: number; lng: number } | undefined;
    }
  ) => void;
  handleRemoveEditRow: (dayNum: number, index: number) => void;
  handleAddActivityRow: (dayNum: number) => void;
};

export function ItineraryEditorSection({
  aiSummary,
  aiProposals,
  aiSelectedProposalIds,
  setAiSelectedProposalIds,
  handleApplySelectedAiChanges,
  displayDays,
  expandedDay,
  setExpandedDay,
  whyDayOpen,
  setWhyDayOpen,
  dayReasoningBullets,
  timelineByDay,
  useSplitTimelineView,
  members,
  adjustedStartByDay,
  transitByDay,
  openActivityDetail,
  handleEditMoveRow,
  openTimePicker,
  editRowsDraft,
  trip,
  updateHotelRow,
  updateActivityRow,
  handleRemoveEditRow,
  handleAddActivityRow,
}: ItineraryEditorSectionProps) {
  const itineraryEditMode = true;
  return (
    <div className="flex flex-col gap-3">
            <h2 className="font-black text-[#3C3C3C] text-base uppercase tracking-[0.4px]">
              🗺️ ITINERARY
            </h2>
            {itineraryEditMode && aiSummary && (
              <div className="bg-[#E8F7FF] border-2 border-[#B3E4FF] rounded-2xl p-3">
                <p className="text-[11px] font-black uppercase text-[#1CB0F6] mb-1">AI summary</p>
                <p className="text-sm font-bold text-[#3C3C3C]">{aiSummary}</p>
              </div>
            )}
            {itineraryEditMode && aiProposals.length > 0 && (
              <div className="bg-white border-2 border-[#E5E5E5] rounded-2xl p-3 flex flex-col gap-2">
                <p className="text-[11px] font-black uppercase text-[#AFAFAF]">Proposed changes</p>
                {aiProposals.map((proposal) => (
                  <label
                    key={proposal.id}
                    className="flex items-start gap-2 rounded-xl border border-[#ECECEC] px-2.5 py-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={!!aiSelectedProposalIds[proposal.id]}
                      onChange={(e) =>
                        setAiSelectedProposalIds((prev) => ({ ...prev, [proposal.id]: e.target.checked }))
                      }
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-black text-[#3C3C3C]">{proposal.title}</p>
                      <p className="text-xs font-bold text-[#AFAFAF]">{proposal.reason}</p>
                    </div>
                  </label>
                ))}
                <button
                  type="button"
                  onClick={handleApplySelectedAiChanges}
                  className="mt-1 w-full py-2.5 rounded-xl border-2 border-[#1CB0F6] text-[#1CB0F6] font-black text-sm bg-white shadow-[0_3px_0_#B3E4FF]"
                >
                  Apply selected changes
                </button>
                <p className="text-[11px] font-bold text-[#AFAFAF]">
                  Applies directly to your saved itinerary.
                </p>
              </div>
            )}
            {displayDays.map((day) => {
              const isExpanded = expandedDay === day.day;
              const dayExpanded = itineraryEditMode || isExpanded;
              const dayTimeline = timelineByDay?.get(day.day);
              const showSplitTimeline = Boolean(
                useSplitTimelineView && dayTimeline?.hasSplit
              );
              return (
                <div
                  key={day.day}
                  className={`bg-white rounded-2xl border-2 overflow-hidden transition-all ${
                    dayExpanded
                      ? "border-[#58CC02] shadow-[0_4px_0_#46A302]"
                      : "border-[#E5E5E5] shadow-[0_4px_0_#D4D4D4]"
                  }`}
                >
                  <button
                    type="button"
                    className="w-full flex flex-col gap-2 p-4 text-left disabled:opacity-100"
                    onClick={() => !itineraryEditMode && setExpandedDay(isExpanded ? null : day.day)}
                    disabled={itineraryEditMode}
                  >
                    <div className="w-full flex items-start gap-3">
                      <div
                        className={`w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0 text-xl border-2 ${
                          dayExpanded
                            ? "bg-[#F0FDE4] border-[#46A302]"
                            : "bg-[#F7F7F7] border-[#E5E5E5]"
                        }`}
                      >
                        {day.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span
                          className={`text-xs font-black uppercase tracking-[0.6px] ${
                            dayExpanded ? "text-[#58CC02]" : "text-[#AFAFAF]"
                          }`}
                        >
                          Day {day.day}
                        </span>
                        {day.date && (
                          <span className="block text-xs font-bold text-[#AFAFAF] leading-tight">
                            {day.date}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 pt-1">
                        <span className="text-xs font-bold text-[#AFAFAF]">
                          {day.events.length} stops
                        </span>
                        {itineraryEditMode ? (
                          <span className="text-[10px] font-black uppercase text-[#58CC02]">Edit</span>
                        ) : isExpanded ? (
                          <ChevronUp size={18} className="text-[#58CC02]" />
                        ) : (
                          <ChevronDown size={18} className="text-[#AFAFAF]" />
                        )}
                      </div>
                    </div>
                    <h3 className="font-black text-[#3C3C3C] text-lg leading-snug break-words pl-[56px]">
                      {itineraryEditMode ? "Reorder your day" : day.title}
                    </h3>
                  </button>

                  {!itineraryEditMode && day.dayReasoning && (
                    <div className="px-4 pb-1 border-t border-[#F0F0F0]">
                      <button
                        type="button"
                        className="w-full flex items-center justify-between gap-2 py-2.5 text-left"
                        onClick={() =>
                          setWhyDayOpen((prev) => ({ ...prev, [day.day]: !prev[day.day] }))
                        }
                      >
                        <span className="text-[11px] font-black uppercase tracking-[0.5px] text-[#AFAFAF]">
                          Why this day?
                        </span>
                        {whyDayOpen[day.day] ? (
                          <ChevronUp size={16} className="text-[#AFAFAF] flex-shrink-0" />
                        ) : (
                          <ChevronDown size={16} className="text-[#AFAFAF] flex-shrink-0" />
                        )}
                      </button>
                      {whyDayOpen[day.day] && (
                        <ul className="space-y-1.5 pb-3 pr-1">
                          {dayReasoningBullets(day.dayReasoning).map((line, idx) => (
                            <li
                              key={`${day.day}-why-${idx}`}
                              className="flex gap-2 text-xs font-bold text-[#777777] leading-snug"
                            >
                              <span className="mt-[0.45em] h-1.5 w-1.5 rounded-full bg-[#AFAFAF] flex-shrink-0" />
                              <span>{line}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {dayExpanded && day.events.length > 0 && showSplitTimeline && dayTimeline ? (
                    <DaySplitTimeline
                      rows={dayTimeline.rows}
                      members={members}
                      adjustedTimes={adjustedStartByDay[day.day] ?? []}
                      transitByDay={transitByDay[day.day] ?? []}
                      onOpenEvent={(event, idx) =>
                        openActivityDetail(
                          {
                            id: event.id,
                            title: event.title,
                            image: event.image,
                            duration: event.duration,
                            durationMinutes: event.durationMinutes,
                            cost: event.cost,
                            isHotel: event.isHotel,
                            isPlaceholder: event.isPlaceholder,
                            detailPlaceId: event.detailPlaceId,
                            savedDescription: event.savedDescription,
                            savedCategoryLabel: event.savedCategoryLabel,
                            savedRating: event.savedRating,
                          },
                          day.day,
                          idx
                        )
                      }
                    />
                  ) : dayExpanded && day.events.length > 0 ? (
                    <div className="border-t-2 border-[#F0F0F0]">
                      {day.events.map((event, idx) => (
                        <div
                          key={event.id}
                          className="relative"
                          draggable={itineraryEditMode}
                          onDragStart={
                            itineraryEditMode
                              ? (e) => {
                                  e.dataTransfer.setData(
                                    "application/json",
                                    JSON.stringify({ day: day.day, index: idx })
                                  );
                                  e.dataTransfer.effectAllowed = "move";
                                }
                              : undefined
                          }
                          onDragOver={itineraryEditMode ? (e) => e.preventDefault() : undefined}
                          onDrop={
                            itineraryEditMode
                              ? (e) => {
                                  e.preventDefault();
                                  try {
                                    const raw = e.dataTransfer.getData("application/json");
                                    const data = JSON.parse(raw) as { day: number; index: number };
                                    if (data.day == null || data.index == null) return;
                                    if (data.day === day.day && data.index === idx) return;
                                    handleEditMoveRow(data.day, data.index, day.day, idx);
                                  } catch {
                                    /* ignore */
                                  }
                                }
                              : undefined
                          }
                        >
                          {!itineraryEditMode && idx > 0 && (
                            <div className="absolute left-[26px] top-0 h-[28px] w-0.5 bg-[#E5E5E5]" />
                          )}
                          {!itineraryEditMode && idx < day.events.length - 1 && (
                            <div className="absolute left-[26px] top-[28px] bottom-0 w-0.5 bg-[#E5E5E5]" />
                          )}
                          <div
                            className={`w-full flex gap-3 p-4 ${itineraryEditMode ? "" : ""}`}
                          >
                            <div className="flex flex-col items-center w-5 flex-shrink-0 pt-1 relative z-10">
                              {itineraryEditMode ? (
                                <GripVertical size={18} className="text-[#AFAFAF]" aria-hidden />
                              ) : (
                                <div className="w-3 h-3 rounded-full bg-[#58CC02] border-2 border-white shadow-[0_0_0_2px_#58CC02]" />
                              )}
                </div>
                            {itineraryEditMode ? (
                              <div className="flex-1 min-w-0 text-left">
                                <div className="flex items-start gap-2 mb-1 flex-wrap">
                                  {event.isHotel || event.isPlaceholder ? (
                                    <span className="text-xs font-black text-[#AFAFAF] flex-shrink-0">
                                      {adjustedStartByDay[day.day]?.[idx] ?? event.time}
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openTimePicker(day.day, idx, event.time);
                                      }}
                                      className="text-xs font-black text-[#1CB0F6] flex-shrink-0 underline decoration-dotted underline-offset-[3px]"
                                      aria-label="Edit start time"
                                    >
                                      {adjustedStartByDay[day.day]?.[idx] ?? event.time}
                                    </button>
                                  )}
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
                                {event.isHotel ? (
                                  <HotelPlaceAutocomplete
                                    destination={trip?.destination ?? ""}
                                    value={
                                      editRowsDraft[String(day.day)]?.[idx]?.hotelLabel ?? ""
                                    }
                                    onChange={(label) =>
                                      updateHotelRow(day.day, event.id, {
                                        hotelLabel: label,
                                        placeId: undefined,
                                      })
                                    }
                                    onPick={(placeId, name) =>
                                      updateHotelRow(day.day, event.id, {
                                        hotelLabel: name,
                                        placeId,
                                      })
                                    }
                                    placeholder="Add your hotel"
                                    inputClassName="w-full mt-1 font-black text-[#3C3C3C] text-base bg-[#F7F7F7] border border-[#ECECEC] rounded-xl px-3 py-2"
                                  />
                                ) : event.isPlaceholder ? (
                                  <ActivityPlaceAutocomplete
                                    destination={trip?.destination ?? ""}
                                    value={
                                      editRowsDraft[String(day.day)]?.[idx]?.activityLabel ?? ""
                                    }
                                    onChange={(label) =>
                                      updateActivityRow(day.day, event.id, {
                                        activityLabel: label,
                                      })
                                    }
                                    onPick={(placeId, name) => {
                                      // Same two-step write as the hotel autocomplete:
                                      // synchronously commit the label / placeId, then
                                      // resolve coordinates from Places so the transit
                                      // pipeline can compute real walk / drive legs
                                      // between this stop and its neighbors.
                                      updateActivityRow(day.day, event.id, {
                                        activityLabel: name,
                                        placeId,
                                        isPlaceholder: true,
                                        location: undefined,
                                      });
                                      void fetchPlaceDetails(placeId)
                                        .then((details) => {
                                          if (!details?.location) return;
                                          updateActivityRow(day.day, event.id, {
                                            location: details.location,
                                          });
                                        })
                                        .catch(() => {
                                          /* transit will fall back to heuristic */
                                        });
                                    }}
                                    placeholder="Enter location or place name"
                                    inputClassName="w-full mt-1 font-black text-[#3C3C3C] text-base bg-[#F7F7F7] border border-[#ECECEC] rounded-xl px-3 py-2"
                                  />
                                ) : (
                                  <h4 className="font-black text-[#3C3C3C] text-base">{event.title}</h4>
                                )}
            </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  openActivityDetail(
                                    {
                                      id: event.id,
                                      title: event.title,
                                      image: event.image,
                                      duration: event.duration,
                                      durationMinutes: event.durationMinutes,
                                      cost: event.cost,
                                      isHotel: event.isHotel,
                                      isPlaceholder: event.isPlaceholder,
                                      detailPlaceId: event.detailPlaceId,
                                      savedDescription: event.savedDescription,
                                      savedCategoryLabel: event.savedCategoryLabel,
                                      savedRating: event.savedRating,
                                    },
                                    day.day,
                                    idx
                                  )
                                }
                                className="flex-1 min-w-0 text-left flex items-start gap-3"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start gap-2 mb-1 flex-wrap">
                                    <span className="text-xs font-black text-[#AFAFAF] flex-shrink-0">
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
                                  <h4 className="font-black text-[#3C3C3C] text-base leading-snug break-words">
                                    {event.title}
                                  </h4>
                                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                    {event.duration && (
                                      <div className="flex items-center gap-1">
                                        <Clock size={11} className="text-[#AFAFAF]" />
                                        <span className="text-xs font-bold text-[#AFAFAF]">
                                          {event.duration}
                                        </span>
                                      </div>
                                    )}
                                    {event.cost && (
                                      <span className="text-xs font-bold text-[#AFAFAF]">
                                        💵 {event.cost}
                                      </span>
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
                              </button>
                            )}
                            {itineraryEditMode && (
                              <button
                                type="button"
                                aria-label="Remove stop"
                                className="w-9 h-9 flex-shrink-0 rounded-xl border-2 border-[#FFD6D6] text-[#FF4B4B] flex items-center justify-center"
                                onClick={() => handleRemoveEditRow(day.day, idx)}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                          {!itineraryEditMode && idx < day.events.length - 1 && transitByDay[day.day]?.[idx] && (
                            <div className="px-4 h-8 flex items-center">
                              <div className="ml-8 text-[11px] font-bold text-[#AFAFAF] flex items-center gap-2 leading-none">
                                <span>
                                  {transitByDay[day.day]?.[idx]?.method === "walk" ? "🚶" : "🚗"}
                                </span>
                                <span>
                                  {transitByDay[day.day]?.[idx]?.source === "heuristic" ? "~" : ""}
                                  {transitByDay[day.day]?.[idx]?.minutes} min transit
                                </span>
                                <span className="text-[#D4D4D4]">•</span>
                                <span className="uppercase">{transitByDay[day.day]?.[idx]?.method}</span>
                                {transitByDay[day.day]?.[idx]?.source === "heuristic" && (
                                  <>
                                    <span className="text-[#D4D4D4]">•</span>
                                    <span className="uppercase">EST.</span>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {itineraryEditMode && (
                        <>
                          <div
                            className="h-10 border-t border-dashed border-[#E5E5E5] flex items-center justify-center text-[11px] font-bold text-[#AFAFAF]"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              try {
                                const raw = e.dataTransfer.getData("application/json");
                                const data = JSON.parse(raw) as { day: number; index: number };
                                if (data.day == null || data.index == null) return;
                                const len = (editRowsDraft[String(day.day)] ?? []).length;
                                handleEditMoveRow(data.day, data.index, day.day, len);
                              } catch {
                                /* ignore */
                              }
                            }}
                          >
                            Drop here to move to end of day
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddActivityRow(day.day)}
                            className="w-full py-3 text-sm font-black text-[#1CB0F6] border-t-2 border-[#F0F0F0] active:bg-[#F7F7F7]"
                          >
                            + Add activity
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
    </div>
  );
}
