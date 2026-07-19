import { useCallback, useEffect, useMemo, useState } from "react";
import { Brain, RotateCcw } from "lucide-react";
import { DuoButton } from "./DuoButton";
import {
  MBTI_DICHOTOMIES,
  MBTI_TYPE_PROFILES,
  axesToMbtiType,
  emptyMbtiAxes,
  parseMbtiTypeToAxes,
  type MbtiAxisId,
  type MbtiAxisLetter,
  type MbtiAxes,
  type MbtiType,
} from "../../constants/mbti";

const AXIS_IDS: MbtiAxisId[] = ["ei", "sn", "tf", "jp"];

export interface MbtiTypeSelectorProps {
  /** Pre-fill from saved preference (e.g. "INTJ"). */
  initialType?: string | null;
  onConfirm: (type: MbtiType) => void;
  /** Skip without selecting a type (saves null). */
  onSkip?: () => void;
  skipLabel?: string;
  className?: string;
}

function DichotomyButton(props: {
  letter: MbtiAxisLetter;
  word: string;
  selected: boolean;
  accent: string;
  border: string;
  bg: string;
  onClick: () => void;
}) {
  const { letter, word, selected, accent, border, bg, onClick } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex-1 min-h-[56px] rounded-2xl border-2 border-b-4 px-2 py-3 flex flex-col items-center justify-center gap-0.5 transition-all touch-manipulation active:border-b-2 active:translate-y-0.5 ${
        selected
          ? ""
          : "bg-white border-[#E8E8E8] shadow-[0_4px_0_#C4C4C4]"
      }`}
      style={
        selected
          ? {
              backgroundColor: bg,
              borderColor: border,
              boxShadow: `0 4px 0 ${border}`,
            }
          : undefined
      }
    >
      <span
        className="font-black text-2xl leading-none"
        style={{ color: selected ? border : accent }}
      >
        {letter}
      </span>
      <span
        className={`font-bold text-[11px] leading-tight text-center ${
          selected ? "text-[#1F302E]" : "text-[#6B7280]"
        }`}
      >
        {word}
      </span>
    </button>
  );
}

export function MbtiTypeSelector({
  initialType,
  onConfirm,
  onSkip,
  skipLabel = "Not sure / skip this step",
  className = "",
}: MbtiTypeSelectorProps) {
  const [axes, setAxes] = useState<MbtiAxes>(emptyMbtiAxes);
  const [popGen, setPopGen] = useState<Record<MbtiAxisId, number>>({
    ei: 0,
    sn: 0,
    tf: 0,
    jp: 0,
  });
  const [overlayType, setOverlayType] = useState<MbtiType | null>(null);

  useEffect(() => {
    if (!initialType) return;
    const parsed = parseMbtiTypeToAxes(initialType);
    if (parsed) setAxes(parsed);
  }, [initialType]);

  const assembledType = useMemo(() => axesToMbtiType(axes), [axes]);
  const isComplete = assembledType !== null;

  const pickAxis = useCallback((axisId: MbtiAxisId, letter: MbtiAxisLetter) => {
    setAxes((prev) => {
      const next = { ...prev };
      if (prev[axisId] === letter) {
        next[axisId] = null;
        return next;
      }
      next[axisId] = letter;
      setPopGen((g) => ({ ...g, [axisId]: g[axisId] + 1 }));
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setAxes(emptyMbtiAxes());
    setOverlayType(null);
  }, []);

  const handleConfirm = () => {
    if (!assembledType) return;
    setOverlayType(assembledType);
  };

  const handleOverlaySave = () => {
    if (!overlayType) return;
    onConfirm(overlayType);
  };

  const profile = overlayType ? MBTI_TYPE_PROFILES[overlayType] : null;

  return (
    <div className={`w-full max-w-[375px] mx-auto ${className}`}>
      {/* Illustration + live type */}
      <div className="mb-6 flex flex-col items-center">
        <div className="relative mb-4">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center border-4 border-[#A78BFA] shadow-[0_6px_0_#7C3AED]">
            <Brain size={48} className="text-[#A78BFA]" strokeWidth={2} aria-hidden />
          </div>
          <div className="absolute -top-2 -right-2 text-2xl select-none" aria-hidden>
            ✨
          </div>
          <div className="absolute -bottom-2 -left-2 text-xl select-none" aria-hidden>
            🧠
          </div>
        </div>

        <p className="text-xs font-black uppercase tracking-[0.5px] text-[#6B7280] mb-2">
          Your type
        </p>

        <div
          className="flex items-center justify-center gap-1 min-h-[44px]"
          aria-live="polite"
          aria-label={isComplete ? `Type ${assembledType}` : "Pick all four dimensions"}
        >
          {AXIS_IDS.map((axisId) => {
            const letter = axes[axisId];
            return letter ? (
              <span
                key={`${axisId}-${letter}-${popGen[axisId]}`}
                className="font-black text-4xl text-[#1F302E] tracking-wide mbti-letter-pop"
              >
                {letter}
              </span>
            ) : (
              <span key={axisId} className="font-black text-4xl text-[#6B7280]">
                ?
              </span>
            );
          })}
        </div>

        {isComplete && assembledType && (
          <p className="text-center mt-2 text-sm font-bold text-[#6B7280]">
            {MBTI_TYPE_PROFILES[assembledType].name}
          </p>
        )}
      </div>

      {/* Dichotomy rows */}
      <div className="flex flex-col gap-4">
        {MBTI_DICHOTOMIES.map((row) => (
          <section key={row.id} aria-label={row.label}>
            <p className="text-xs font-black uppercase tracking-[0.5px] text-[#6B7280] mb-2 px-0.5">
              {row.label}
            </p>
            <div className="flex gap-2">
              <DichotomyButton
                letter={row.left.letter}
                word={row.left.word}
                selected={axes[row.id] === row.left.letter}
                accent={row.accent}
                border={row.border}
                bg={row.bg}
                onClick={() => pickAxis(row.id, row.left.letter)}
              />
              <DichotomyButton
                letter={row.right.letter}
                word={row.right.word}
                selected={axes[row.id] === row.right.letter}
                accent={row.accent}
                border={row.border}
                bg={row.bg}
                onClick={() => pickAxis(row.id, row.right.letter)}
              />
            </div>
          </section>
        ))}
      </div>

      {/* Skip + confirm */}
      <div className="mt-6 flex flex-col gap-3">
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="w-full py-3 text-center font-bold text-[#6B7280] text-sm touch-manipulation"
          >
            {skipLabel}
          </button>
        )}
        <DuoButton
          onClick={handleConfirm}
          variant="primary"
          fullWidth
          disabled={!isComplete}
          className={`py-4 text-base transition-all ${
            !isComplete ? "!bg-[#E8E8E8] !text-[#6B7280] !border-[#C4C4C4] !border-b-[#C4C4C4] shadow-none" : ""
          }`}
        >
          Confirm type
        </DuoButton>
        {!isComplete && (
          <p className="text-center text-xs font-bold text-[#6B7280]">
            Pick one option in each row
          </p>
        )}
      </div>

      {/* Result overlay */}
      {overlayType && profile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-[#121212]/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mbti-result-title"
        >
          <div className="w-full max-w-[375px] bg-white rounded-3xl border-2 border-[#E8E8E8] shadow-[0_8px_0_#C4C4C4] p-6 text-center">
            <p className="text-xs font-black uppercase tracking-[0.6px] text-[#6B7280] mb-2">
              You are
            </p>
            <p
              id="mbti-result-title"
              className="font-black text-5xl text-[#1F302E] tracking-wide mb-1"
            >
              {overlayType}
            </p>
            <p className="font-black text-xl text-[#A78BFA] mb-3">{profile.name}</p>
            <p className="text-sm font-bold text-[#6B7280] leading-relaxed mb-6 px-1">
              {profile.tagline}
            </p>

            <DuoButton
              onClick={handleOverlaySave}
              variant="primary"
              fullWidth
              className="py-4 text-base mb-3"
            >
              Looks good →
            </DuoButton>

            <button
              type="button"
              onClick={resetAll}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-[#E8E8E8] bg-[#F7F7F6] font-bold text-[#6B7280] text-sm touch-manipulation active:translate-y-0.5"
            >
              <RotateCcw size={16} aria-hidden />
              Choose again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
