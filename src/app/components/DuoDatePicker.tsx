import { useState } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isWithinInterval, startOfWeek, endOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { DuoButton } from "./DuoButton";

interface DuoDatePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (startDate: Date | null, endDate: Date | null) => void;
  startDate?: Date | null;
  endDate?: Date | null;
}

export function DuoDatePicker({ isOpen, onClose, onSelect, startDate: initialStart, endDate: initialEnd }: DuoDatePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [startDate, setStartDate] = useState<Date | null>(initialStart || null);
  const [endDate, setEndDate] = useState<Date | null>(initialEnd || null);

  if (!isOpen) return null;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const handleDateClick = (date: Date) => {
    if (!startDate || (startDate && endDate)) {
      // Start new selection
      setStartDate(date);
      setEndDate(null);
    } else {
      // Set end date
      if (date < startDate) {
        setEndDate(startDate);
        setStartDate(date);
      } else {
        setEndDate(date);
      }
    }
  };

  const handleDone = () => {
    onSelect(startDate, endDate);
    onClose();
  };

  const handleClear = () => {
    setStartDate(null);
    setEndDate(null);
  };

  const isInRange = (date: Date) => {
    if (!startDate) return false;
    if (!endDate) return isSameDay(date, startDate);
    return isWithinInterval(date, { start: startDate, end: endDate });
  };

  const isRangeStart = (date: Date) => startDate && isSameDay(date, startDate);
  const isRangeEnd = (date: Date) => endDate && isSameDay(date, endDate);

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 z-40 flex items-end justify-center"
        onClick={onClose}
      />

      {/* Bottom Sheet - Mobile Optimized */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center animate-in slide-in-from-bottom duration-300">
        <div className="w-full max-w-md bg-white rounded-t-3xl shadow-[0_-8px_24px_rgba(0,0,0,0.15)] max-h-[85vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b-2 border-[#E5E5E5] px-5 py-4 rounded-t-3xl flex items-center justify-between">
            <h2 className="font-black text-[#3C3C3C] text-lg">
              📅 Select Dates
            </h2>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-[#F7F7F7] border-2 border-[#E5E5E5] flex items-center justify-center active:bg-[#E5E5E5] transition-colors"
            >
              <X size={20} className="text-[#4B4B4B]" />
            </button>
          </div>

          {/* Month Navigation */}
          <div className="px-5 py-4 flex items-center justify-between">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="w-10 h-10 rounded-xl bg-[#DFF6FF] border-2 border-[#1CB0F6] flex items-center justify-center active:bg-[#1CB0F6] active:text-white transition-all"
            >
              <ChevronLeft size={20} className="text-[#1CB0F6]" />
            </button>
            <h3 className="font-black text-[#3C3C3C] text-base">
              {format(currentMonth, "MMMM yyyy")}
            </h3>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="w-10 h-10 rounded-xl bg-[#DFF6FF] border-2 border-[#1CB0F6] flex items-center justify-center active:bg-[#1CB0F6] active:text-white transition-all"
            >
              <ChevronRight size={20} className="text-[#1CB0F6]" />
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="px-5 pb-4">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, idx) => (
                <div key={idx} className="text-center text-xs font-black text-[#AFAFAF] py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, idx) => {
                const inRange = isInRange(day);
                const isStart = isRangeStart(day);
                const isEnd = isRangeEnd(day);
                const inCurrentMonth = isSameMonth(day, currentMonth);
                const isToday = isSameDay(day, new Date());

                return (
                  <button
                    key={idx}
                    onClick={() => handleDateClick(day)}
                    disabled={!inCurrentMonth}
                    className={`
                      aspect-square rounded-xl font-bold text-sm relative
                      transition-all active:scale-95
                      ${!inCurrentMonth ? "text-[#E5E5E5] cursor-not-allowed" : ""}
                      ${inCurrentMonth && !inRange ? "text-[#3C3C3C] hover:bg-[#F7FFF0]" : ""}
                      ${inRange && !isStart && !isEnd ? "bg-[#F7FFF0] text-[#58CC02]" : ""}
                      ${isStart || isEnd ? "bg-[#58CC02] text-white border-2 border-[#46A302] shadow-[0_3px_0_#46A302]" : ""}
                      ${isToday && !inRange ? "border-2 border-[#FFD900]" : ""}
                    `}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Range Display */}
          {(startDate || endDate) && (
            <div className="px-5 py-3 bg-[#F7FFF0] border-t-2 border-[#E5E5E5]">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-black text-[#AFAFAF] uppercase tracking-wider mb-1">
                    Selected
                  </p>
                  <p className="font-black text-[#58CC02]">
                    {startDate && format(startDate, "MMM d")}
                    {endDate && startDate !== endDate && ` – ${format(endDate, "MMM d")}`}
                  </p>
                </div>
                <button
                  onClick={handleClear}
                  className="text-sm font-bold text-[#FF4B4B] underline"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="px-5 pb-6 pt-4 flex gap-3">
            <DuoButton
              onClick={onClose}
              variant="secondary"
              className="flex-1 py-3"
            >
              Cancel
            </DuoButton>
            <DuoButton
              onClick={handleDone}
              variant="primary"
              className="flex-1 py-3"
              disabled={!startDate}
            >
              Done
            </DuoButton>
          </div>
        </div>
      </div>
    </>
  );
}