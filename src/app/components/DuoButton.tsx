import React from "react";

interface DuoButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "yellow";
  className?: string;
  fullWidth?: boolean;
  disabled?: boolean;
}

export function DuoButton({
  children,
  onClick,
  variant = "primary",
  className = "",
  fullWidth = false,
  disabled = false,
}: DuoButtonProps) {
  const variants = {
    primary:
      "bg-[#58CC02] text-white border-b-4 border-[#46A302] active:border-b-0 active:mt-1",
    secondary:
      "bg-white text-[#1CB0F6] border-2 border-[#1CB0F6] border-b-4 border-b-[#0B8FCC] active:border-b-2 active:mt-1",
    danger:
      "bg-[#FF4B4B] text-white border-b-4 border-[#CC3B3B] active:border-b-0 active:mt-1",
    yellow:
      "bg-[#FFD900] text-[#4B4B4B] border-b-4 border-[#E5C400] active:border-b-0 active:mt-1",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        rounded-2xl px-6 py-3 font-bold uppercase tracking-wide transition-all duration-100 cursor-pointer
        ${variants[variant]}
        ${fullWidth ? "w-full" : ""}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        ${className}
      `}
    >
      {children}
    </button>
  );
}
