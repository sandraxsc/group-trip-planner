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
    green: "border-2 border-[#0D9443] shadow-[0_4px_0_#0D9443]",
    blue: "border-2 border-[#0A91D1] shadow-[0_4px_0_#0A91D1]",
    purple: "border-2 border-[#7C3AED] shadow-[0_4px_0_#7C3AED]",
    yellow: "border-2 border-[#CC8C00] shadow-[0_4px_0_#CC8C00]",
    default: "border-2 border-[#E8E8E8] shadow-[0_4px_0_#C4C4C4]",
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
