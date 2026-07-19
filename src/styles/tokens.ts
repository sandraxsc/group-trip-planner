/**
 * Design tokens — typed mirror of the values that already ship inline across
 * the app (e.g. `bg-[#58CC02]`, `shadow-[0_4px_0_#46A302]`). Tailwind classes
 * remain the source of truth; this file exists so TypeScript callers can
 * reference the same values without magic strings.
 *
 * Adding a token here does NOT register a Tailwind utility — keep the inline
 * `bg-[#…]` / `shadow-[…]` classes in JSX as they are today.
 */
export const tokens = {
  colors: {
    green: "#10B954",
    greenDark: "#0D9443",
    greenBg: "#E6F4EA",
    blue: "#1CB0F6",
    blueDark: "#0A91D1",
    blueBg: "#DDF4FF",
    amber: "#FFB000",
    amberDark: "#CC8C00",
    red: "#FF5C5C",
    purple: "#A78BFA",
    purpleDark: "#7C3AED",
    purpleBg: "#F5F3FF",
    surface: "#FFFFFF",
    bg: "#F7F7F6",
    border: "#E8E8E8",
    borderStrong: "#C4C4C4",
    textPrimary: "#1F302E",
    textSecondary: "#6B7280",
    deepGreen: "#1F302E",
  },
  shadows: {
    card: "0 4px 0 #C4C4C4",
    green: "0 4px 0 #0D9443",
    greenMuted: "0 4px 0 #B4E3C2",
    amber: "0 4px 0 #CC8C00",
    blue: "0 4px 0 #A8DCFF",
    purple: "0 4px 0 #7C3AED",
  },
  motion: {
    fast: "150ms",
    normal: "200ms",
    easing: "cubic-bezier(0.4, 0, 0.2, 1)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
} as const;

export type Tokens = typeof tokens;
export type TokenColor = keyof Tokens["colors"];
export type TokenShadow = keyof Tokens["shadows"];
export type TokenMotion = keyof Tokens["motion"];
