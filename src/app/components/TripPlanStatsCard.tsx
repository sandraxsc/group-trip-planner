interface TripPlanStatsCardProps {
  tripDaysCount: number;
  totalActivities: number;
  membersCount: number;
  estPerPerson: string;
  /** Neutral border for candidate (unselected) plans. */
  variant?: "selected" | "candidate";
}

export function TripPlanStatsCard({
  tripDaysCount,
  totalActivities,
  membersCount,
  estPerPerson,
  variant = "selected",
}: TripPlanStatsCardProps) {
  const isSelected = variant === "selected";
  return (
    <div
      className={`bg-white rounded-2xl border-2 p-4 ${
        isSelected
          ? "border-[#10B954] shadow-[0_4px_0_#0D9443]"
          : "border-[#E8E8E8] shadow-[0_4px_0_#C4C4C4]"
      }`}
    >
      <div className="flex justify-around">
        <div className="text-center">
          <div className="font-black text-[#1F302E] text-2xl">{tripDaysCount}</div>
          <div className="text-xs font-bold text-[#6B7280]">Days</div>
        </div>
        <div className="w-px bg-[#E8E8E8]" />
        <div className="text-center">
          <div className="font-black text-[#1F302E] text-2xl">{totalActivities}</div>
          <div className="text-xs font-bold text-[#6B7280]">Activities</div>
        </div>
        <div className="w-px bg-[#E8E8E8]" />
        <div className="text-center">
          <div className="font-black text-[#1F302E] text-2xl">{membersCount}</div>
          <div className="text-xs font-bold text-[#6B7280]">Members</div>
        </div>
        <div className="w-px bg-[#E8E8E8]" />
        <div className="text-center">
          <div className="font-black text-[#10B954] text-2xl">{estPerPerson}</div>
          <div className="text-xs font-bold text-[#6B7280]">Est./person</div>
        </div>
      </div>
    </div>
  );
}
