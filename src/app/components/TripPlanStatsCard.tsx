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
          ? "border-[#58CC02] shadow-[0_4px_0_#46A302]"
          : "border-[#E5E5E5] shadow-[0_4px_0_#D4D4D4]"
      }`}
    >
      <div className="flex justify-around">
        <div className="text-center">
          <div className="font-black text-[#3C3C3C] text-2xl">{tripDaysCount}</div>
          <div className="text-xs font-bold text-[#AFAFAF]">Days</div>
        </div>
        <div className="w-px bg-[#E5E5E5]" />
        <div className="text-center">
          <div className="font-black text-[#3C3C3C] text-2xl">{totalActivities}</div>
          <div className="text-xs font-bold text-[#AFAFAF]">Activities</div>
        </div>
        <div className="w-px bg-[#E5E5E5]" />
        <div className="text-center">
          <div className="font-black text-[#3C3C3C] text-2xl">{membersCount}</div>
          <div className="text-xs font-bold text-[#AFAFAF]">Members</div>
        </div>
        <div className="w-px bg-[#E5E5E5]" />
        <div className="text-center">
          <div className="font-black text-[#58CC02] text-2xl">{estPerPerson}</div>
          <div className="text-xs font-bold text-[#AFAFAF]">Est./person</div>
        </div>
      </div>
    </div>
  );
}
