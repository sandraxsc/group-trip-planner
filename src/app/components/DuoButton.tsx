import React, { useState } from "react";

interface DuoButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "yellow";
  className?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  /**
   * Optional inline style overrides. Merged on top of the JS-driven press
   * transform so callers can still tune layout (e.g. `marginTop`) without
   * fighting the active state.
   */
  style?: React.CSSProperties;
}

/**
 * Duolingo-style 3D button. The "depth" comes from a 4-pixel bottom border
 * that collapses on press — combined here with a JS-controlled `pressed`
 * state driven by pointer events so the press timing is consistent across
 * mouse, touch and keyboard. The CSS `active:` fallbacks remain as a safety
 * net for keyboard activation and touch devices that don't fire pointer
 * events.
 *
 * `prefers-reduced-motion` is honoured globally via the rule in
 * `src/styles/index.css` (transition-duration collapses to ~0).
 */
export function DuoButton({
  children,
  onClick,
  variant = "primary",
  className = "",
  fullWidth = false,
  disabled = false,
  style,
}: DuoButtonProps) {
  const [pressed, setPressed] = useState(false);

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

  // The press transform sits on top of the existing active: classes for a
  // smoother, more physical feel. Releasing animates back over 80ms.
  const inlineStyle: React.CSSProperties = {
    transform: pressed ? "translateY(2px)" : "translateY(0)",
    transition: "transform 80ms ease, box-shadow 80ms ease",
    boxShadow: pressed
      ? "0 0 0 0 rgba(0,0,0,0)"
      : "0 2px 0 0 rgba(0,0,0,0.06)",
    ...style,
  };

  const release = () => setPressed(false);
  const press = () => {
    if (disabled) return;
    setPressed(true);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onPointerDown={press}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onBlur={release}
      style={inlineStyle}
      className={`
        duo-focusable
        rounded-2xl px-6 py-3 font-bold uppercase tracking-wide cursor-pointer
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
