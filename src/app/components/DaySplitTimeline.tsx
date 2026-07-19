import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import type { TripMember } from "../../types/trip";
import type { TransitInfo } from "../../services/transitService";
import type { DisplayDayEvent } from "../utils/itineraryToDisplayDays";
import type { TimelineRow, SplitTimelineCard } from "../utils/buildDayTimeline";
const TIMELINE_LINE_LEFT = "left-[26px]";
const TIMELINE_LINE_CLASS = "absolute w-0.5 bg-[#E8E8E8]";

function MemberNameTags({
  memberIds,
  members,
  variant,
}: {
  memberIds: string[];
  members: TripMember[];
  variant: "sky" | "violet";
}) {
  const shown = memberIds
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is TripMember => !!m);
  const tagClass =
    variant === "sky"
      ? "bg-[#E8F7FF] text-[#1CB0F6] border-[#B3E4FF]"
      : "bg-[#F5F3FF] text-[#A78BFA] border-[#E8D4FF]";

  if (shown.length === 0) {
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tagClass}`}>
        Group
      </span>
    );
  }
  return (
    <div className="flex flex-row flex-wrap gap-1">
      {shown.map((m) => (
        <span
          key={m.id}
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 max-w-full truncate ${tagClass}`}
          title={m.name}
        >
          {m.name}
        </span>
      ))}
    </div>
  );
}

function SplitDivider({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-black text-[#6B7280]">{label}</span>
      <div className="flex items-center gap-2">
        <span className="h-px flex-1 bg-amber-200" aria-hidden />
        <span className="text-xs font-black text-amber-500 flex-shrink-0 uppercase tracking-[0.4px]">
          Split
        </span>
        <span className="h-px flex-1 bg-amber-200" aria-hidden />
      </div>
    </div>
  );
}

function ReunionMarker() {
  const [pulse, setPulse] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setPulse(false), 700);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className={`flex items-center gap-2 py-2 ${pulse ? "animate-pulse" : ""}`}>
      <span className="h-px flex-1 bg-green-200" aria-hidden />
      <span className="text-xs font-black text-[#10B954] flex-shrink-0">{"\u2713"} Back together</span>
      <span className="h-px flex-1 bg-green-200" aria-hidden />
    </div>
  );
}

function SplitCard({
  card,
  members,
  variant,
  samePlace,
  onOpen,
  columnClassName = "",
}: {
  card: SplitTimelineCard;
  members: TripMember[];
  variant: "sky" | "violet";
  samePlace: boolean;
  onOpen: (event: DisplayDayEvent, eventIndex: number) => void;
  columnClassName?: string;
}) {
  const canOpen = card.event && !card.event.isHotel && !card.event.isPlaceholder;
  const image = card.event?.image;

  // Compact horizontal layout: small square thumbnail next to the text column.
  // Member tags wrap to a second line under the title to avoid crowding the
  // narrow split column on mobile.
  const inner = (
    <>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <span
            className="inline-block self-start text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ color: card.categoryColor, backgroundColor: card.categoryBg }}
          >
            {card.typeLabel}
          </span>
          <h4 className="font-black text-[#1F302E] text-sm leading-snug break-words">
            {card.title}
          </h4>
        </div>
        {image && (
          <img
            src={image}
            alt={card.title}
            className="w-12 h-12 aspect-square object-cover rounded-lg flex-shrink-0"
          />
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <MemberNameTags memberIds={card.memberIds} members={members} variant={variant} />
        {samePlace && (
          <span className="text-[10px] font-bold text-[#6B7280] bg-[#F7F7F6] rounded-full px-2 py-0.5 border border-[#E8E8E8]">
            Same place
          </span>
        )}
      </div>
    </>
  );

  const cardClass = `flex-1 min-w-0 text-left ${columnClassName}`.trim();

  if (canOpen && card.event) {
    return (
      <button
        type="button"
        onClick={() => onOpen(card.event!, card.eventIndex)}
        className={`${cardClass} active:opacity-80`}
      >
        {inner}
      </button>
    );
  }
  return <div className={cardClass}>{inner}</div>;
}

export function DaySplitTimeline({
  rows,
  members,
  adjustedTimes,
  transitByDay,
  onOpenEvent,
}: {
  rows: TimelineRow[];
  members: TripMember[];
  adjustedTimes: string[];
  transitByDay: TransitInfo[];
  onOpenEvent: (event: DisplayDayEvent, eventIndex: number) => void;
}) {
  let lastSoloIndex = -1;

  return (
    <div className="border-t-2 border-[#F0F0F0]">
      {rows.map((row, rowIdx) => {
        const showConnectorTop = rowIdx > 0;
        const showConnectorBottom = rowIdx < rows.length - 1;

        if (row.kind === "solo") {
          const event = row.event;
          const idx = row.eventIndex;
          const transit =
            lastSoloIndex >= 0 && idx >= 0 ? transitByDay[lastSoloIndex] : undefined;
          lastSoloIndex = idx;

          return (
            <div key={`solo-${event.id}-${rowIdx}`} className="relative">
              {showConnectorTop && (
                <div className={`${TIMELINE_LINE_CLASS} ${TIMELINE_LINE_LEFT} top-0 h-[28px]`} />
              )}
              {showConnectorBottom && (
                <div className={`${TIMELINE_LINE_CLASS} ${TIMELINE_LINE_LEFT} top-[28px] bottom-0`} />
              )}
              {transit && (
                <div className="px-4 h-8 flex items-center">
                  <div className="ml-8 text-[11px] font-bold text-[#6B7280] flex items-center gap-2 leading-none">
                    <span>
                      {transit.method === "walk"
                        ? "\u{1F6B6}"
                        : transit.method === "transit"
                          ? "\u{1F68C}"
                          : "\u{1F697}"}
                    </span>
                    <span>
                      {transit.source === "heuristic" ? "~" : ""}
                      {transit.minutes} min transit
                    </span>
                  </div>
                </div>
              )}
              <div className="w-full flex gap-3 p-4">
                <div className="flex flex-col items-center w-5 flex-shrink-0 pt-1 relative z-10">
                  <div className="w-3 h-3 rounded-full bg-[#10B954] border-2 border-white shadow-[0_0_0_2px_#10B954]" />
                </div>
                <button
                  type="button"
                  onClick={() => onOpenEvent(event, idx)}
                  className="flex-1 min-w-0 text-left flex items-start gap-3"
                  disabled={event.isHotel || event.isPlaceholder}
                >
                  {/*
                    Horizontal row: text column on the left, small 1:1 thumbnail
                    on the right. This replaces the previous full-width 128px-tall
                    image stack, which forced excessive vertical scrolling on
                    mobile when the day had many activities.
                  */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-black text-[#6B7280] flex-shrink-0">
                        {adjustedTimes[idx] ?? row.timeLabel}
                      </span>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ color: event.categoryColor, backgroundColor: event.categoryBg }}
                      >
                        {event.type}
                      </span>
                      {row.allTogether && (
                        <span className="text-[10px] font-bold text-[#6B7280] bg-[#F7F7F6] border border-[#E8E8E8] rounded-full px-2 py-0.5 flex-shrink-0">
                          All together
                        </span>
                      )}
                    </div>
                    <h4 className="font-black text-[#1F302E] text-base leading-snug break-words">
                      {event.title}
                    </h4>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {event.duration && (
                        <div className="flex items-center gap-1">
                          <Clock size={11} className="text-[#6B7280]" />
                          <span className="text-xs font-bold text-[#6B7280]">{event.duration}</span>
                        </div>
                      )}
                      {event.cost && (
                        <span className="text-xs font-bold text-[#6B7280]">{"\u{1F4B5}"} {event.cost}</span>
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
              </div>
            </div>
          );
        }

        if (row.kind === "reunion") {
          return (
            <div key={`reunion-${rowIdx}`} className="relative">
              {showConnectorTop && (
                <div className={`${TIMELINE_LINE_CLASS} ${TIMELINE_LINE_LEFT} top-0 h-[28px]`} />
              )}
              {showConnectorBottom && (
                <div className={`${TIMELINE_LINE_CLASS} ${TIMELINE_LINE_LEFT} top-[28px] bottom-0`} />
              )}
              <div className="px-4 pb-1">
                <div className="ml-8">
                  <ReunionMarker />
                </div>
              </div>
            </div>
          );
        }

        return (
          <div key={`split-${row.sortMinutes}-${rowIdx}`} className="relative">
            {showConnectorTop && (
              <div className={`${TIMELINE_LINE_CLASS} ${TIMELINE_LINE_LEFT} top-0 h-[28px]`} />
            )}
            {showConnectorBottom && (
              <div className={`${TIMELINE_LINE_CLASS} ${TIMELINE_LINE_LEFT} top-[28px] bottom-0`} />
            )}
            <div className="w-full flex gap-3 p-4">
              <div className="flex flex-col items-center w-5 flex-shrink-0 pt-1 relative z-10">
                <div className="w-3 h-3 rounded-full bg-amber-400 border-2 border-white shadow-[0_0_0_2px_#F59E0B]" />
              </div>
              <div className="flex-1 min-w-0">
                <SplitDivider label={row.timeLabel} />
                <div className="flex mt-2 items-stretch">
                  <SplitCard
                    card={row.left}
                    members={members}
                    variant="sky"
                    samePlace={row.samePlace}
                    onOpen={onOpenEvent}
                    columnClassName="pr-3"
                  />
                  <div className="w-px bg-[#E8E8E8] flex-shrink-0 self-stretch" aria-hidden />
                  <SplitCard
                    card={row.right}
                    members={members}
                    variant="violet"
                    samePlace={row.samePlace}
                    onOpen={onOpenEvent}
                    columnClassName="pl-3"
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
