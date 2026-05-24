import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { DuoButton } from "../components/DuoButton";
import { setUserProfile, hasCompletedOnboarding } from "../../services/userProfileService";

/**
 * One-time onboarding screen that collects the user's display name.
 *
 * Visited automatically by Root.tsx when no local profile exists. The user
 * can revisit later (e.g. from Profile → "Edit name") via direct navigation,
 * which is why we still let them submit even if a profile already exists —
 * `setUserProfile` updates in place rather than creating a new identity.
 *
 * Visual language matches the rest of the app's Duolingo-inspired UI:
 * mascot greeting, oversized rounded input with focus ring, and a primary
 * green button that disables until at least 1 character has been typed.
 */
export default function OnboardingNameScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0;

  // Autofocus on mount so users can start typing immediately. Wrapped in a
  // microtask to dodge the brief mobile keyboard race that can swallow focus.
  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, []);

  // If the user already onboarded and somehow lands here (e.g. typed the URL),
  // pre-fill the input with their existing name so editing reads as an update.
  useEffect(() => {
    if (hasCompletedOnboarding()) {
      // Lazy import to avoid pulling the helper into every render.
      import("../../services/userProfileService").then(({ getUserName }) => {
        const current = getUserName("");
        if (current) setName(current);
      });
    }
  }, []);

  const handleSubmit = () => {
    if (!canSubmit) return;
    setUserProfile(trimmed);
    // Honor a `?next=/foo` query param for deep-link recovery, otherwise home.
    const params = new URLSearchParams(location.search);
    const next = params.get("next");
    navigate(next && next.startsWith("/") ? next : "/", { replace: true });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-[#FFF8F0] to-[#F0FFF4]">
      {/* Mascot / hero block */}
      <div className="flex flex-col items-center px-6 pt-16 pb-6 text-center">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#58CC02] to-[#46A302] flex items-center justify-center shadow-[0_6px_0_#2D7800] mb-5">
          <span className="text-4xl" aria-hidden>
            🌍
          </span>
        </div>
        <h1 className="text-[#3C3C3C] font-black text-2xl leading-tight">
          Welcome to your trip planner!
        </h1>
        <p className="text-[#7C7C7C] font-bold text-sm mt-2 max-w-[280px]">
          What should we call you? Your friends will see this name when you
          plan trips together.
        </p>
      </div>

      {/* Name input */}
      <div className="px-6">
        <label className="block text-xs font-black uppercase tracking-[0.6px] text-[#AFAFAF] mb-2">
          Your name
        </label>
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          autoComplete="given-name"
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSubmit) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="e.g. Sandra"
          className="w-full px-4 py-4 text-base font-bold text-[#3C3C3C] placeholder:text-[#AFAFAF] bg-white border-2 border-[#E5E5E5] rounded-2xl shadow-[0_3px_0_#D4D4D4] focus:outline-none focus:border-[#58CC02] focus:shadow-[0_3px_0_#46A302]"
        />
        <p className="text-xs font-bold text-[#AFAFAF] mt-2">
          You can change this later in your profile.
        </p>
      </div>

      {/* Spacer pushes the button to the bottom on tall screens */}
      <div className="flex-1" />

      <div className="px-6 pb-10">
        <DuoButton
          variant="primary"
          fullWidth
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="py-4 text-base"
        >
          Let&rsquo;s go!
        </DuoButton>
      </div>
    </div>
  );
}
