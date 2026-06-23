/**
 * Shared Duolingo-style layout tokens used across full-screen flows.
 * Tailwind classes stay inline in JSX; this file keeps screens consistent.
 */
export const duoUi = {
  pageBgSuccess: "bg-gradient-to-br from-[#F7FFF0] to-[#FFF8E7]",
  pageBgPreferenceAccent: "bg-gradient-to-br from-[#F9F0FF] to-[#E8F7FF]",
  pageBgDefault: "bg-[#F7F7F7]",
  pageBgJoin: "bg-gradient-to-br from-[#FFF8F0] to-[#F0FFF4]",
  contentWidth: "max-w-[402px] mx-auto w-full",
  sectionX: "px-5",
  headerBlock: "px-4 pt-12 pb-4",
  card: "bg-white rounded-2xl border-2 border-[#E5E5E5] shadow-[0_4px_0_#D4D4D4]",
  cardGreen: "bg-white rounded-2xl border-2 border-[#58CC02] shadow-[0_4px_0_#C8EDA0]",
  input:
    "w-full rounded-2xl border-2 border-[#E5E5E5] px-4 py-3 font-bold text-[#3C3C3C] text-sm shadow-[0_3px_0_#D4D4D4] focus:outline-none focus:border-[#1CB0F6]",
  stickyFooter:
    "fixed inset-x-0 bottom-0 z-40 px-5 pb-6 pt-3 border-t-2 border-[#E5E5E5] bg-white/95 backdrop-blur-sm",
  alertAmber:
    "rounded-2xl bg-[#FFF8D6] border-2 border-[#FFD900] px-3 py-2.5 shadow-[0_3px_0_#E5C400]",
  alertGreen:
    "rounded-2xl bg-[#F0FDE4] border-2 border-[#58CC02] px-3 py-2.5 shadow-[0_3px_0_#C8EDA0]",
  progressTrack:
    "h-2.5 bg-[#E5E5E5] rounded-full overflow-hidden border border-[#DADADA]",
  progressFill: "h-full bg-gradient-to-r from-[#58CC02] to-[#89E219] rounded-full transition-all",
  sheetPrimaryBtn:
    "flex-1 py-3 rounded-2xl border-2 border-[#1899D6] bg-[#1CB0F6] text-white font-black text-sm shadow-[0_3px_0_#1899D6] active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50",
  sheetSecondaryBtn:
    "flex-1 py-3 rounded-2xl border-2 border-[#E5E5E5] bg-white font-black text-sm shadow-[0_3px_0_#D4D4D4] active:translate-y-0.5 active:shadow-none transition-all",
} as const;
