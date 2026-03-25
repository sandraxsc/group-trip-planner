import React from "react";

interface DuoCardProps {
  children: React.ReactNode;
  className?: string;
  color?: "green" | "blue" | "purple" | "yellow" | "default";
  onClick?: () => void;
}

export function DuoCard({
  children,
  className = "",
  color = "default",
  onClick,
}: DuoCardProps) {
  const shadows = {
    green: "border-2 border-[#46A302] shadow-[0_4px_0_#46A302]",
    blue: "border-2 border-[#0B8FCC] shadow-[0_4px_0_#0B8FCC]",
    purple: "border-2 border-[#A355CF] shadow-[0_4px_0_#A355CF]",
    yellow: "border-2 border-[#E5C400] shadow-[0_4px_0_#E5C400]",
    default: "border-2 border-[#E5E5E5] shadow-[0_4px_0_#D4D4D4]",
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl ${shadows[color]} ${onClick ? "cursor-pointer active:translate-y-1 active:shadow-none transition-all" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
