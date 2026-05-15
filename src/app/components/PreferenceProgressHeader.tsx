import { ReactNode } from "react";

export function PreferenceProgressHeader(props: {
  currentStep: number;
  totalSteps?: number;
  title: string;
  subtitle?: ReactNode;
  leftSlot: ReactNode;
  rightSlot?: ReactNode;
}) {
  const {
    currentStep,
    totalSteps = 7,
    title,
    subtitle,
    leftSlot,
    rightSlot = <div className="w-10" />,
  } = props;

  const clampedStep = Math.min(Math.max(currentStep, 1), totalSteps);
  const progressPercent = Math.round((clampedStep / totalSteps) * 100);

  return (
    <div className="px-4 pt-12 pb-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-shrink-0">{leftSlot}</div>

        <div className="flex-1 min-w-0 flex flex-col items-center">
          <span className="text-xs font-bold text-[#AFAFAF]">
            Step {clampedStep} of {totalSteps}
          </span>
          <div className="mt-2 w-full max-w-[220px] h-2.5 bg-[#E5E5E5] rounded-full overflow-hidden border border-[#DADADA]">
            <div
              className="h-full bg-gradient-to-r from-[#58CC02] to-[#89E219] rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="flex-shrink-0">{rightSlot}</div>
      </div>

      <div className="mt-4 px-1 text-center">
        <h1 className="font-black text-[#3C3C3C] text-2xl leading-tight">
          {title}
        </h1>
        {subtitle && (
          <div className="mt-1 text-[#AFAFAF] font-bold text-sm leading-snug">{subtitle}</div>
        )}
      </div>
    </div>
  );
}

