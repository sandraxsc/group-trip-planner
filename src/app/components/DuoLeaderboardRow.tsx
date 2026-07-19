import { Zap } from "lucide-react";

/**
 * Ranked leaderboard row. `avatar` is a free slot (pass a `DuoAvatar`, a flag
 * emoji, or anything else) rather than a fixed prop shape, since leaderboard
 * identity varies by context (trip member vs. league opponent).
 */
interface DuoLeaderboardRowProps {
  rank: number;
  name: string;
  xp: number;
  avatar: React.ReactNode;
  isYou?: boolean;
}

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function DuoLeaderboardRow({
  rank,
  name,
  xp,
  avatar,
  isYou = false,
}: DuoLeaderboardRowProps) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 ${
        isYou
          ? "bg-[#E6F4EA] border-[#10B954] shadow-[0_2px_0_#0D9443]"
          : "bg-white border-[#E8E8E8] shadow-[0_2px_0_#E8E8E8]"
      }`}
    >
      <span className="text-sm font-black w-6 text-center">
        {MEDALS[rank] ?? `#${rank}`}
      </span>
      {avatar}
      <span
        className={`flex-1 text-sm font-bold ${isYou ? "text-[#1F302E]" : "text-[#1F302E]"}`}
      >
        {name}
        {isYou && (
          <span className="ml-1 text-xs font-black text-[#10B954]">(You)</span>
        )}
      </span>
      <div className="flex items-center gap-1">
        <Zap size={12} color="#FFB000" fill="#FFB000" />
        <span className="text-sm font-black text-[#1F302E]">
          {xp.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
