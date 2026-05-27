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
    green: "#58CC02",
    greenDark: "#46A302",
    greenBg: "#F8FFF0",
    blue: "#1CB0F6",
    blueDark: "#0A91D1",
    blueBg: "#DDF4FF",
    amber: "#FF9600",
    amberDark: "#CC7800",
    red: "#FF4B4B",
    surface: "#FFFFFF",
    bg: "#F7F7F7",
    border: "#E5E5E5",
    borderStrong: "#AFAFAF",
    textPrimary: "#3C3C3C",
    textSecondary: "#777777",
    deepGreen: "#0A3320",
  },
  shadows: {
    card: "0 4px 0 #D4D4D4",
    green: "0 4px 0 #46A302",
    greenMuted: "0 4px 0 #C8EDA0",
    amber: "0 4px 0 #CC7800",
    blue: "0 4px 0 #A8DCFF",
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
