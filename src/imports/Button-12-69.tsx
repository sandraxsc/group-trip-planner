import svgPaths from "./svg-rb6s76y328";

function CheckCircle() {
  return (
    <div className="relative shrink-0 size-[22px]" data-name="CheckCircle2">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 22 22">
        <g clipPath="url(#clip0_12_73)" id="CheckCircle2">
          <path d={svgPaths.p34f9e600} fill="var(--fill-0, #58CC02)" id="Vector" stroke="var(--stroke-0, #58CC02)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.83333" />
          <g id="Vector_2">
            <path d={svgPaths.p31e27380} fill="var(--fill-0, #58CC02)" />
            <path d={svgPaths.p31e27380} stroke="var(--stroke-0, #58CC02)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.83333" />
          </g>
        </g>
        <defs>
          <clipPath id="clip0_12_73">
            <rect fill="white" height="22" width="22" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Span() {
  return (
    <div className="flex-[1_0_0] h-[24px] min-h-px min-w-px opacity-60 relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="[text-decoration-skip-ink:none] absolute decoration-solid font-['Nunito:Bold',sans-serif] font-bold leading-[24px] left-0 line-through text-[#3c3c3c] text-[16px] top-0 whitespace-nowrap">Set budget preferences</p>
      </div>
    </div>
  );
}

function ChevronRight() {
  return (
    <div className="relative shrink-0 size-[18px]" data-name="ChevronRight">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 18">
        <g id="ChevronRight">
          <path d="M6.75 13.5L11.25 9L6.75 4.5" id="Vector" stroke="var(--stroke-0, #AFAFAF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </g>
      </svg>
    </div>
  );
}

export default function Button() {
  return (
    <div className="bg-[#f0fde4] content-stretch flex gap-[12px] items-center px-[18px] py-[2px] relative rounded-[16px] size-full" data-name="button">
      <div aria-hidden="true" className="absolute border-2 border-[#58cc02] border-solid inset-0 pointer-events-none rounded-[16px] shadow-[0px_3px_0px_0px_#46a302]" />
      <CheckCircle />
      <Span />
      <ChevronRight />
    </div>
  );
}