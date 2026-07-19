/**
 * Shared Duolingo-style layout tokens used across full-screen flows.
 * Tailwind classes stay inline in JSX; this file keeps screens consistent.
 */
export const duoUi = {
  pageBgSuccess: "bg-gradient-to-br from-[#E6F4EA] to-[#FFF8E1]",
  pageBgPreferenceAccent: "bg-gradient-to-br from-[#F5F3FF] to-[#DDF4FF]",
  pageBgDefault: "bg-[#F7F7F6]",
  pageBgJoin: "bg-gradient-to-br from-[#FFF8E1] to-[#E6F4EA]",
  contentWidth: "max-w-[402px] mx-auto w-full",
  sectionX: "px-5",
  headerBlock: "px-4 pt-12 pb-4",
  card: "bg-white rounded-2xl border-2 border-[#E8E8E8] shadow-[0_4px_0_#C4C4C4]",
  cardGreen: "bg-white rounded-2xl border-2 border-[#10B954] shadow-[0_4px_0_#B4E3C2]",
  input:
    "w-full rounded-2xl border-2 border-[#E8E8E8] px-4 py-3 font-bold text-[#1F302E] text-sm shadow-[0_3px_0_#C4C4C4] focus:outline-none focus:border-[#1CB0F6]",
  stickyFooter:
    "fixed inset-x-0 bottom-0 z-40 px-5 pb-6 pt-3 border-t-2 border-[#E8E8E8] bg-white/95 backdrop-blur-sm",
  alertAmber:
    "rounded-2xl bg-[#FFF8E1] border-2 border-[#FFB000] px-3 py-2.5 shadow-[0_3px_0_#CC8C00]",
  alertGreen:
    "rounded-2xl bg-[#E6F4EA] border-2 border-[#10B954] px-3 py-2.5 shadow-[0_3px_0_#B4E3C2]",
  progressTrack:
    "h-2.5 bg-[#E8E8E8] rounded-full overflow-hidden border border-[#C4C4C4]",
  progressFill: "h-full bg-gradient-to-r from-[#10B954] to-[#4CD583] rounded-full transition-all",
  sheetPrimaryBtn:
    "flex-1 py-3 rounded-2xl border-2 border-[#0A91D1] bg-[#1CB0F6] text-white font-black text-sm shadow-[0_3px_0_#0A91D1] active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50",
  sheetSecondaryBtn:
    "flex-1 py-3 rounded-2xl border-2 border-[#E8E8E8] bg-white font-black text-sm shadow-[0_3px_0_#C4C4C4] active:translate-y-0.5 active:shadow-none transition-all",
} as const;
