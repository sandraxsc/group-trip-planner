import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { ArrowLeft, Clock, X } from "lucide-react";
import { DuoButton } from "../components/DuoButton";
import { getMemberPreference, saveMemberPreference } from "../../services/preferenceService";
import { PreferenceProgressHeader } from "../components/PreferenceProgressHeader";

export default function PreferenceTimeScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as { tripId?: string; memberId?: string }) ?? {};
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("21:00");
  const [showTimePicker, setShowTimePicker] = useState<"start" | "end" | null>(null);
  const [tempHour, setTempHour] = useState(9);
  const [tempMinute, setTempMinute] = useState(0);
  const [tempPeriod, setTempPeriod] = useState<"AM" | "PM">("AM");
  const hourScrollRef = useRef<HTMLDivElement | null>(null);
  const minuteScrollRef = useRef<HTMLDivElement | null>(null);
  const periodScrollRef = useRef<HTMLDivElement | null>(null);

  // Prefill from saved progress (auto-resume)
  useEffect(() => {
    if (!state.tripId || !state.memberId) return;
    const pref = getMemberPreference(state.tripId, state.memberId);
    if (pref?.activeHours?.start) setStartTime(pref.activeHours.start);
    if (pref?.activeHours?.end) setEndTime(pref.activeHours.end);
  }, [state.tripId, state.memberId]);

  // Auto-save time window as it changes (debounced)
  useEffect(() => {
    if (!state.tripId || !state.memberId) return;
    const t = window.setTimeout(() => {
      saveMemberPreference(state.tripId!, state.memberId!, {
        activeHours: { start: startTime, end: endTime },
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [startTime, endTime, state.tripId, state.memberId]);

  const formatTime12h = (time24: string) => {
    const [hours, minutes] = time24.split(":");
    const h = parseInt(hours);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  const handleOpenPicker = (type: "start" | "end") => {
    const time = type === "start" ? startTime : endTime;
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours);
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    
    setTempHour(h12);
    setTempMinute(parseInt(minutes));
    setTempPeriod(period);
    setShowTimePicker(type);
  };

  const handleSaveTime = () => {
    let hour24 = tempHour;
    if (tempPeriod === "PM" && tempHour !== 12) {
      hour24 += 12;
    } else if (tempPeriod === "AM" && tempHour === 12) {
      hour24 = 0;
    }
    
    const timeString = `${hour24.toString().padStart(2, "0")}:${tempMinute.toString().padStart(2, "0")}`;
    
    if (showTimePicker === "start") {
      setStartTime(timeString);
    } else {
      setEndTime(timeString);
    }
    
    setShowTimePicker(null);
  };

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  // When the picker opens, scroll each wheel so the currently selected
  // value is visually centered.
  useEffect(() => {
    if (!showTimePicker) return;
    const rowHeight = 48; // h-12 => 3rem => 48px
    if (hourScrollRef.current) {
      const hourIndex = hours.indexOf(tempHour);
      if (hourIndex >= 0) {
        hourScrollRef.current.scrollTop = hourIndex * rowHeight;
      }
    }
    if (minuteScrollRef.current) {
      const minuteIndex = minutes.indexOf(tempMinute);
      if (minuteIndex >= 0) {
        minuteScrollRef.current.scrollTop = minuteIndex * rowHeight;
      }
    }
    if (periodScrollRef.current) {
      const periodIndex = tempPeriod === "AM" ? 0 : 1;
      periodScrollRef.current.scrollTop = periodIndex * rowHeight;
    }
  }, [showTimePicker, tempHour, tempMinute, tempPeriod, hours, minutes]);

  const handleHourScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const rowHeight = 48;
    const scrollTop = (e.currentTarget as HTMLDivElement).scrollTop;
    const index = Math.round(scrollTop / rowHeight);
    const clamped = Math.max(0, Math.min(hours.length - 1, index));
    const value = hours[clamped];
    if (value !== tempHour) setTempHour(value);
  };

  const handleMinuteScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const rowHeight = 48;
    const scrollTop = (e.currentTarget as HTMLDivElement).scrollTop;
    const index = Math.round(scrollTop / rowHeight);
    const clamped = Math.max(0, Math.min(minutes.length - 1, index));
    const value = minutes[clamped];
    if (value !== tempMinute) setTempMinute(value);
  };

  const handlePeriodScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const rowHeight = 48;
    const scrollTop = (e.currentTarget as HTMLDivElement).scrollTop;
    const index = Math.round(scrollTop / rowHeight);
    const clamped = Math.max(0, Math.min(1, index));
    const value = clamped === 0 ? "AM" : "PM";
    if (value !== tempPeriod) setTempPeriod(value);
  };

  const handleContinue = () => {
    if (state?.tripId && state?.memberId) {
      saveMemberPreference(state.tripId, state.memberId, {
        activeHours: { start: startTime, end: endTime },
      });
    }
    navigate("/preference-activity", { state });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-[#FFF8F0] to-[#F0FFF4]">
      <PreferenceProgressHeader
        currentStep={3}
        totalSteps={6}
        title={"Time preferences"}
        subtitle={"When do you want to start and end your day?"}
        leftSlot={
          <button
            onClick={() => navigate("/preference-energy", { state })}
            className="w-10 h-10 rounded-xl bg-white border-2 border-[#E5E5E5] flex items-center justify-center shadow-[0_3px_0_#D4D4D4] active:translate-y-0.5 active:shadow-none transition-all"
          >
            <ArrowLeft size={20} className="text-[#4B4B4B]" />
          </button>
        }
      />

      {/* Avatar Area */}
      <div className="flex-1 flex items-center justify-center px-5 pb-8">
        <div className="relative">
          {/* Clock Avatar */}
          <div className="w-40 h-40 mx-auto mb-4 bg-white rounded-full flex items-center justify-center border-4 border-[#CE82FF] shadow-[0_6px_0_#A760D8]">
            <Clock size={80} className="text-[#CE82FF]" strokeWidth={1.5} />
          </div>
          {/* Decorative sun/moon */}
          <div className="absolute -top-4 -right-4 w-16 h-16 bg-gradient-to-br from-[#FFD900] to-[#FFA500] rounded-full shadow-[0_4px_0_#E5C400] flex items-center justify-center">
            <span className="text-3xl">☀️</span>
          </div>
          <div className="absolute -bottom-4 -left-4 w-12 h-12 bg-gradient-to-br from-[#1CB0F6] to-[#0088CC] rounded-full shadow-[0_3px_0_#0B8FCC] flex items-center justify-center">
            <span className="text-xl">🌙</span>
          </div>
        </div>
      </div>

      {/* Bottom Card */}
      <div className="bg-white rounded-t-3xl px-5 pt-6 pb-8 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
        <h1 className="font-black text-[#3C3C3C] text-2xl mb-2">Active time</h1>
        <p className="text-[#AFAFAF] font-bold text-sm mb-6">
          When do you prefer to be active?
        </p>

        {/* Time Pickers */}
        <div className="flex flex-col items-center gap-3 mb-6">
          {/* Start Time */}
          <div className="w-full">
            <label className="text-xs font-black text-[#AFAFAF] uppercase tracking-wider mb-2 block">
              Start Time
            </label>
            <button
              onClick={() => handleOpenPicker("start")}
              className="w-full px-4 py-4 text-center text-4xl font-black text-[#3C3C3C] bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl shadow-[0_4px_0_#D4D4D4] focus:outline-none active:translate-y-0.5 active:shadow-none transition-all"
            >
              {formatTime12h(startTime)}
            </button>
          </div>

          {/* "to" divider */}
          <div className="py-2">
            <span className="text-2xl font-black text-[#AFAFAF]">to</span>
          </div>

          {/* End Time */}
          <div className="w-full">
            <label className="text-xs font-black text-[#AFAFAF] uppercase tracking-wider mb-2 block">
              End Time
            </label>
            <button
              onClick={() => handleOpenPicker("end")}
              className="w-full px-4 py-4 text-center text-4xl font-black text-[#3C3C3C] bg-[#F7F7F7] border-2 border-[#E5E5E5] rounded-2xl shadow-[0_4px_0_#D4D4D4] focus:outline-none active:translate-y-0.5 active:shadow-none transition-all"
            >
              {formatTime12h(endTime)}
            </button>
          </div>
        </div>

        {/* Info card */}
        <div className="bg-[#F4ECFF] rounded-2xl p-3 border-2 border-[#CE82FF] flex items-center gap-3 mb-6">
          <span className="text-xl">⏰</span>
          <p className="text-sm font-bold text-[#7A4B9A] flex-1">
            We'll plan activities between {formatTime12h(startTime)} and {formatTime12h(endTime)}
          </p>
        </div>

        <DuoButton
          onClick={handleContinue}
          variant="primary"
          fullWidth
          className="py-4 text-base"
        >
          Continue →
        </DuoButton>
      </div>

      {/* Time Picker Modal */}
      {showTimePicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-md px-5 pt-6 pb-8 shadow-[0_-4px_20px_rgba(0,0,0,0.3)] animate-[slide-up_0.3s_ease-out]">
            <div className="flex flex-col items-center mb-6">
              <h2 className="font-black text-[#3C3C3C] text-xl">
                Time
              </h2>
            </div>

            {/* Time Picker Wheel */}
            <div className="relative mb-8">
              <div className="flex items-center justify-center gap-2 relative">
                {/* Hour */}
                <div className="flex flex-col items-center h-44 overflow-hidden relative">
                  <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white to-transparent z-10 pointer-events-none" />
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent z-10 pointer-events-none" />
                  <div
                    ref={hourScrollRef}
                    className="overflow-y-auto snap-y snap-mandatory h-full py-16 scrollbar-hide"
                    style={{ scrollbarWidth: "none" }}
                    onScroll={handleHourScroll}
                  >
                    {hours.map((h) => (
                      <button
                        key={h}
                        onClick={() => setTempHour(h)}
                        className={`h-12 w-16 flex items-center justify-center snap-center font-black text-3xl transition-all ${
                          tempHour === h ? "text-[#3C3C3C] scale-110" : "text-[#D4D4D4] scale-90"
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>

                <span className="text-3xl font-black text-[#3C3C3C]">:</span>

                {/* Minute */}
                <div className="flex flex-col items-center h-44 overflow-hidden relative">
                  <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white to-transparent z-10 pointer-events-none" />
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent z-10 pointer-events-none" />
                  <div
                    ref={minuteScrollRef}
                    className="overflow-y-auto snap-y snap-mandatory h-full py-16 scrollbar-hide"
                    style={{ scrollbarWidth: "none" }}
                    onScroll={handleMinuteScroll}
                  >
                    {minutes.map((m) => (
                      <button
                        key={m}
                        onClick={() => setTempMinute(m)}
                        className={`h-12 w-16 flex items-center justify-center snap-center font-black text-3xl transition-all ${
                          tempMinute === m ? "text-[#3C3C3C] scale-110" : "text-[#D4D4D4] scale-90"
                        }`}
                      >
                        {m.toString().padStart(2, "0")}
                      </button>
                    ))}
                  </div>
                </div>

                {/* AM/PM */}
                <div className="flex flex-col items-center h-44 overflow-hidden relative">
                  <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white to-transparent z-10 pointer-events-none" />
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent z-10 pointer-events-none" />
                  <div
                    ref={periodScrollRef}
                    className="overflow-y-auto snap-y snap-mandatory h-full py-16 scrollbar-hide"
                    style={{ scrollbarWidth: "none" }}
                    onScroll={handlePeriodScroll}
                  >
                    {["AM", "PM"].map((period) => (
                      <button
                        key={period}
                        onClick={() => setTempPeriod(period as "AM" | "PM")}
                        className={`h-12 w-16 flex items-center justify-center snap-center font-black text-2xl transition-all ${
                          tempPeriod === period ? "text-[#3C3C3C] scale-110" : "text-[#D4D4D4] scale-90"
                        }`}
                      >
                        {period.toLowerCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Presets */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-[#3C3C3C] mb-3">Presets</h3>
              <div className="flex gap-2 flex-wrap">
                {[
                  { hour: 9, minute: 0, period: "AM", label: "9 am" },
                  { hour: 12, minute: 0, period: "PM", label: "12 pm" },
                  { hour: 4, minute: 0, period: "PM", label: "4 pm" },
                  { hour: 6, minute: 0, period: "PM", label: "6 pm" },
                ].map((preset) => {
                  const isActive = tempHour === preset.hour && tempMinute === preset.minute && tempPeriod === preset.period;
                  return (
                    <button
                      key={preset.label}
                      onClick={() => {
                        setTempHour(preset.hour);
                        setTempMinute(preset.minute);
                        setTempPeriod(preset.period as "AM" | "PM");
                      }}
                      className={`px-5 py-2.5 rounded-full font-bold text-sm transition-all ${
                        isActive
                          ? "bg-white border-2 border-[#1CB0F6] text-[#1CB0F6]"
                          : "bg-white border-2 border-[#E5E5E5] text-[#3C3C3C]"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <DuoButton
              onClick={handleSaveTime}
              variant="primary"
              fullWidth
              className="py-4 text-base"
            >
              Done
            </DuoButton>
          </div>
        </div>
      )}
    </div>
  );
}