import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { hasCompletedOnboarding } from "../services/userProfileService";

/**
 * Routes that don't require a completed onboarding profile.
 *
 * - `/onboarding` is the screen that creates the profile.
 * - `/join/:token` is a deep link a user hits before they have an account on
 *   this device; we want them to see the join screen first and only nudge
 *   them through onboarding after the join flow finishes.
 */
const ONBOARDING_BYPASS_PREFIXES = ["/onboarding", "/join/"];

function isOnboardingBypassed(pathname: string): boolean {
  return ONBOARDING_BYPASS_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix)
  );
}

export default function Root() {
  const navigate = useNavigate();
  const location = useLocation();

  // First-run gate: if no local profile exists and we're not on a bypassed
  // route, redirect to /onboarding while preserving the originally requested
  // path in `?next=` so we can return there on submit. The check runs on
  // every navigation so a user clearing storage mid-session is also caught.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasCompletedOnboarding()) return;
    if (isOnboardingBypassed(location.pathname)) return;
    const target = `${location.pathname}${location.search}` || "/";
    const search = target === "/" ? "" : `?next=${encodeURIComponent(target)}`;
    navigate(`/onboarding${search}`, { replace: true });
  }, [location.pathname, location.search, navigate]);

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center">
      <div className="w-full max-w-[402px] min-h-screen bg-white relative overflow-x-hidden">
        <Outlet />
      </div>
    </div>
  );
}
