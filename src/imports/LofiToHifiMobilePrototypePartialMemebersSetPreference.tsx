import svgPaths from "./svg-6d12winif7";
import imgImg from "figma:asset/048f76d83c4784673fac5aa2133afa0ba7f280f3.png";

function P() {
  return (
    <div className="h-[16px] relative shrink-0 w-[139.234px]" data-name="p">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Nunito:Black',sans-serif] font-black leading-[16px] relative shrink-0 text-[#afafaf] text-[12px] tracking-[0.3px] uppercase whitespace-nowrap">Planning progress</p>
      </div>
    </div>
  );
}

function P1() {
  return (
    <div className="h-[24px] relative shrink-0 w-[34.641px]" data-name="p">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Nunito:Black',sans-serif] font-black leading-[24px] left-0 text-[#58cc02] text-[16px] top-0 whitespace-nowrap">50%</p>
      </div>
    </div>
  );
}

function Container4() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-[322px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-between relative size-full">
        <P />
        <P1 />
      </div>
    </div>
  );
}

function Container6() {
  return <div className="bg-gradient-to-b from-[#58cc02] h-[16px] rounded-[33554400px] shrink-0 to-[#89e219] w-full" data-name="Container" />;
}

function Container5() {
  return (
    <div className="bg-[#e5e5e5] h-[16px] relative rounded-[33554400px] shrink-0 w-[322px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start overflow-clip pr-[161px] relative rounded-[inherit] size-full">
        <Container6 />
      </div>
    </div>
  );
}

function P2() {
  return (
    <div className="h-[16px] relative shrink-0 w-[322px]" data-name="p">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="flex-[1_0_0] font-['Nunito:Bold',sans-serif] font-bold leading-[16px] min-h-px min-w-px relative text-[#afafaf] text-[12px]">2 of 4 members completed</p>
      </div>
    </div>
  );
}

function Container3() {
  return (
    <div className="content-stretch flex flex-col gap-[8px] h-[72px] items-start relative shrink-0 w-full" data-name="Container">
      <Container4 />
      <Container5 />
      <P2 />
    </div>
  );
}

function Container2() {
  return (
    <div className="bg-white h-[112px] relative rounded-[16px] shrink-0 w-[362px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-2 border-[#46a302] border-solid inset-0 pointer-events-none rounded-[16px] shadow-[0px_4px_0px_0px_#46a302]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pb-[2px] pt-[20px] px-[20px] relative size-full">
        <Container3 />
      </div>
    </div>
  );
}

function Users() {
  return (
    <div className="absolute left-0 size-[18px] top-[3px]" data-name="Users">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 18">
        <g id="Users">
          <path d={svgPaths.pd2eb480} id="Vector" stroke="var(--stroke-0, #CE82FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          <path d={svgPaths.p19685c00} id="Vector_2" stroke="var(--stroke-0, #CE82FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          <path d={svgPaths.p226d9800} id="Vector_3" stroke="var(--stroke-0, #CE82FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          <path d={svgPaths.p2a5062c0} id="Vector_4" stroke="var(--stroke-0, #CE82FF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </g>
      </svg>
    </div>
  );
}

function H1() {
  return (
    <div className="h-[24px] relative shrink-0 w-[109.625px]" data-name="h2">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Users />
        <p className="absolute font-['Nunito:Black',sans-serif] font-black leading-[24px] left-[26px] text-[#3c3c3c] text-[16px] top-0 tracking-[0.4px] uppercase whitespace-nowrap">{` Members`}</p>
      </div>
    </div>
  );
}

function Button() {
  return (
    <div className="h-[20px] relative shrink-0 w-[48.109px]" data-name="button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Nunito:Bold',sans-serif] font-bold leading-[20px] relative shrink-0 text-[#1cb0f6] text-[14px] text-center whitespace-nowrap">Invite +</p>
      </div>
    </div>
  );
}

function Container8() {
  return (
    <div className="content-stretch flex h-[24px] items-center justify-between relative shrink-0 w-full" data-name="Container">
      <H1 />
      <Button />
    </div>
  );
}

function Span() {
  return (
    <div className="h-[16px] relative shrink-0 w-[16.922px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Nunito:Black',sans-serif] font-black leading-[16px] relative shrink-0 text-[12px] text-white whitespace-nowrap">SN</p>
      </div>
    </div>
  );
}

function Container11() {
  return (
    <div className="bg-[#58cc02] flex-[1_0_0] min-h-px min-w-px relative rounded-[33554400px] w-[48px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-3 border-[#58cc02] border-solid inset-0 pointer-events-none rounded-[33554400px] shadow-[0px_3px_0px_0px_rgba(0,0,0,0.13)]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center pl-[3px] pr-[3.016px] py-[3px] relative size-full">
        <Span />
      </div>
    </div>
  );
}

function Span1() {
  return (
    <div className="h-[16px] relative shrink-0 w-[39.578px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Nunito:Bold',sans-serif] font-bold leading-[16px] relative shrink-0 text-[#afafaf] text-[12px] whitespace-nowrap">Sandra</p>
      </div>
    </div>
  );
}

function CheckCircle() {
  return (
    <div className="relative shrink-0 size-[14px]" data-name="CheckCircle2">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14 14">
        <g clipPath="url(#clip0_6_1951)" id="CheckCircle2">
          <path d={svgPaths.pc012c00} fill="var(--fill-0, #58CC02)" id="Vector" stroke="var(--stroke-0, #58CC02)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
          <g id="Vector_2">
            <path d={svgPaths.p24f94f00} fill="var(--fill-0, #58CC02)" />
            <path d={svgPaths.p24f94f00} stroke="var(--stroke-0, #58CC02)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
          </g>
        </g>
        <defs>
          <clipPath id="clip0_6_1951">
            <rect fill="white" height="14" width="14" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Container10() {
  return (
    <div className="h-[86px] relative shrink-0 w-[48px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[4px] items-center relative size-full">
        <Container11 />
        <Span1 />
        <CheckCircle />
      </div>
    </div>
  );
}

function Span2() {
  return (
    <div className="h-[16px] relative shrink-0 w-[18.875px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Nunito:Black',sans-serif] font-black leading-[16px] relative shrink-0 text-[12px] text-white whitespace-nowrap">MC</p>
      </div>
    </div>
  );
}

function Container13() {
  return (
    <div className="bg-[#1cb0f6] flex-[1_0_0] min-h-px min-w-px relative rounded-[33554400px] w-[48px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-3 border-[#c3c3c3] border-solid inset-0 pointer-events-none rounded-[33554400px] shadow-[0px_3px_0px_0px_rgba(0,0,0,0.13)]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center p-[3px] relative size-full">
        <Span2 />
      </div>
    </div>
  );
}

function Span3() {
  return (
    <div className="h-[16px] relative shrink-0 w-[34.047px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Nunito:Bold',sans-serif] font-bold leading-[16px] relative shrink-0 text-[#afafaf] text-[12px] whitespace-nowrap">Marco</p>
      </div>
    </div>
  );
}

function Circle() {
  return (
    <div className="relative shrink-0 size-[14px]" data-name="Circle">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14 14">
        <g clipPath="url(#clip0_12_128)" id="Circle">
          <path d={svgPaths.pc012c00} fill="var(--fill-0, #FFD900)" id="Vector" stroke="var(--stroke-0, #FFD900)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
        </g>
        <defs>
          <clipPath id="clip0_12_128">
            <rect fill="white" height="14" width="14" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Container12() {
  return (
    <div className="h-[86px] relative shrink-0 w-[48px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[4px] items-center relative size-full">
        <Container13 />
        <Span3 />
        <Circle />
      </div>
    </div>
  );
}

function Span4() {
  return (
    <div className="h-[16px] relative shrink-0 w-[14.813px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Nunito:Black',sans-serif] font-black leading-[16px] relative shrink-0 text-[12px] text-white whitespace-nowrap">LC</p>
      </div>
    </div>
  );
}

function Container15() {
  return (
    <div className="bg-[#ce82ff] flex-[1_0_0] min-h-px min-w-px relative rounded-[33554400px] w-[48px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-3 border-[#c3c3c3] border-solid inset-0 pointer-events-none rounded-[33554400px] shadow-[0px_3px_0px_0px_rgba(0,0,0,0.13)]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center p-[3px] relative size-full">
        <Span4 />
      </div>
    </div>
  );
}

function Span5() {
  return (
    <div className="h-[16px] relative shrink-0 w-[28.875px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Nunito:Bold',sans-serif] font-bold leading-[16px] relative shrink-0 text-[#afafaf] text-[12px] whitespace-nowrap">Lucia</p>
      </div>
    </div>
  );
}

function Container16() {
  return (
    <div className="relative rounded-[33554400px] shrink-0 size-[14px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-2 border-[#d3d8cf] border-solid inset-0 pointer-events-none rounded-[33554400px]" />
    </div>
  );
}

function Container14() {
  return (
    <div className="h-[86px] relative shrink-0 w-[48px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[4px] items-center relative size-full">
        <Container15 />
        <Span5 />
        <Container16 />
      </div>
    </div>
  );
}

function Span6() {
  return (
    <div className="h-[16px] relative shrink-0 w-[18.344px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Nunito:Black',sans-serif] font-black leading-[16px] relative shrink-0 text-[12px] text-white whitespace-nowrap">TM</p>
      </div>
    </div>
  );
}

function Container18() {
  return (
    <div className="bg-[#ff4b4b] flex-[1_0_0] min-h-px min-w-px relative rounded-[33554400px] w-[48px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-3 border-[#ff4b4b] border-solid inset-0 pointer-events-none rounded-[33554400px] shadow-[0px_3px_0px_0px_rgba(0,0,0,0.13)]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center p-[3px] relative size-full">
        <Span6 />
      </div>
    </div>
  );
}

function Span7() {
  return (
    <div className="h-[16px] relative shrink-0 w-[23.953px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Nunito:Bold',sans-serif] font-bold leading-[16px] relative shrink-0 text-[#afafaf] text-[12px] whitespace-nowrap">Tom</p>
      </div>
    </div>
  );
}

function CheckCircle1() {
  return (
    <div className="relative shrink-0 size-[14px]" data-name="CheckCircle2">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14 14">
        <g clipPath="url(#clip0_6_1951)" id="CheckCircle2">
          <path d={svgPaths.pc012c00} fill="var(--fill-0, #58CC02)" id="Vector" stroke="var(--stroke-0, #58CC02)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
          <g id="Vector_2">
            <path d={svgPaths.p24f94f00} fill="var(--fill-0, #58CC02)" />
            <path d={svgPaths.p24f94f00} stroke="var(--stroke-0, #58CC02)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
          </g>
        </g>
        <defs>
          <clipPath id="clip0_6_1951">
            <rect fill="white" height="14" width="14" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Container17() {
  return (
    <div className="h-[86px] relative shrink-0 w-[48px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[4px] items-center relative size-full">
        <Container18 />
        <Span7 />
        <CheckCircle1 />
      </div>
    </div>
  );
}

function Container9() {
  return (
    <div className="content-stretch flex gap-[12px] h-[86px] items-start relative shrink-0 w-full" data-name="Container">
      <Container10 />
      <Container12 />
      <Container14 />
      <Container17 />
    </div>
  );
}

function Container7() {
  return (
    <div className="h-[122px] relative shrink-0 w-[362px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[12px] items-start relative size-full">
        <Container8 />
        <Container9 />
      </div>
    </div>
  );
}

function H2() {
  return (
    <div className="h-[24px] relative shrink-0 w-full" data-name="h2">
      <p className="absolute font-['Nunito:Black',sans-serif] font-black leading-[24px] left-0 text-[#3c3c3c] text-[16px] top-0 tracking-[0.4px] uppercase whitespace-nowrap">📋 Planning Steps</p>
    </div>
  );
}

function CheckCircle2() {
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

function Span8() {
  return (
    <div className="flex-[1_0_0] h-[24px] min-h-px min-w-px opacity-60 relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="[text-decoration-skip-ink:none] absolute decoration-solid font-['Nunito:Bold',sans-serif] font-bold leading-[24px] left-0 line-through text-[#3c3c3c] text-[16px] top-0 whitespace-nowrap">Invite members</p>
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

function Button1() {
  return (
    <div className="bg-[#f0fde4] flex-[1_0_0] min-h-px min-w-px relative rounded-[16px] w-[362px]" data-name="button">
      <div aria-hidden="true" className="absolute border-2 border-[#58cc02] border-solid inset-0 pointer-events-none rounded-[16px] shadow-[0px_3px_0px_0px_#46a302]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[12px] items-center px-[20px] py-[2px] relative size-full">
        <CheckCircle2 />
        <Span8 />
        <ChevronRight />
      </div>
    </div>
  );
}

function Container21() {
  return (
    <div className="h-[64px] relative shrink-0 w-[362px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative size-full">
        <Button1 />
      </div>
    </div>
  );
}

function CheckCircle3() {
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

function Span9() {
  return (
    <div className="flex-[1_0_0] h-[24px] min-h-px min-w-px opacity-60 relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="[text-decoration-skip-ink:none] absolute decoration-solid font-['Nunito:Bold',sans-serif] font-bold leading-[24px] left-0 line-through text-[#3c3c3c] text-[16px] top-0 whitespace-nowrap">Set your trip preference</p>
      </div>
    </div>
  );
}

function ChevronRight1() {
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

function Button2() {
  return (
    <div className="bg-[#f0fde4] flex-[1_0_0] min-h-px min-w-px relative rounded-[16px] w-[362px]" data-name="button">
      <div aria-hidden="true" className="absolute border-2 border-[#58cc02] border-solid inset-0 pointer-events-none rounded-[16px] shadow-[0px_3px_0px_0px_#46a302]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[12px] items-center px-[20px] py-[2px] relative size-full">
        <CheckCircle3 />
        <Span9 />
        <ChevronRight1 />
      </div>
    </div>
  );
}

function Container22() {
  return (
    <div className="h-[64px] relative shrink-0 w-[362px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative size-full">
        <Button2 />
      </div>
    </div>
  );
}

function MaterialSymbolsLock() {
  return (
    <div className="absolute left-[3px] size-[16px] top-[3px]" data-name="material-symbols:lock">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="material-symbols:lock">
          <path d={svgPaths.p50aed00} fill="var(--fill-0, #B4B4B4)" id="Vector" />
        </g>
      </svg>
    </div>
  );
}

function Div1() {
  return (
    <div className="bg-[#f2f2f2] relative rounded-[33554400px] shrink-0 size-[22px]" data-name="div">
      <div aria-hidden="true" className="absolute border-3 border-[#e5e5e5] border-solid inset-0 pointer-events-none rounded-[33554400px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <MaterialSymbolsLock />
      </div>
    </div>
  );
}

function Span10() {
  return (
    <div className="flex-[1_0_0] h-[24px] min-h-px min-w-px relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Nunito:Bold',sans-serif] font-bold leading-[24px] left-0 text-[#3c3c3c] text-[16px] top-0 whitespace-nowrap">Vote on activities</p>
      </div>
    </div>
  );
}

function ChevronRight2() {
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

function Button3() {
  return (
    <div className="bg-white h-[64px] relative rounded-[16px] shrink-0 w-[362px]" data-name="button">
      <div aria-hidden="true" className="absolute border-2 border-[#e5e5e5] border-solid inset-0 pointer-events-none rounded-[16px] shadow-[0px_3px_0px_0px_#d4d4d4]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[12px] items-center px-[20px] py-[2px] relative size-full">
        <Div1 />
        <Span10 />
        <ChevronRight2 />
      </div>
    </div>
  );
}

function Container23() {
  return (
    <div className="relative shrink-0 w-[362px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative w-full">
        <Button3 />
      </div>
    </div>
  );
}

function MaterialSymbolsLock1() {
  return (
    <div className="absolute left-[3px] size-[16px] top-[3px]" data-name="material-symbols:lock">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="material-symbols:lock">
          <path d={svgPaths.p50aed00} fill="var(--fill-0, #B4B4B4)" id="Vector" />
        </g>
      </svg>
    </div>
  );
}

function Div2() {
  return (
    <div className="bg-[#f2f2f2] relative rounded-[33554400px] shrink-0 size-[22px]" data-name="div">
      <div aria-hidden="true" className="absolute border-3 border-[#e5e5e5] border-solid inset-0 pointer-events-none rounded-[33554400px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <MaterialSymbolsLock1 />
      </div>
    </div>
  );
}

function Span11() {
  return (
    <div className="flex-[1_0_0] h-[24px] min-h-px min-w-px relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Nunito:Bold',sans-serif] font-bold leading-[24px] left-0 text-[#3c3c3c] text-[16px] top-0 whitespace-nowrap">Generate Trip Itinerary</p>
      </div>
    </div>
  );
}

function ChevronRight3() {
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

function Button4() {
  return (
    <div className="bg-white flex-[1_0_0] min-h-px min-w-px relative rounded-[16px] w-[362px]" data-name="button">
      <div aria-hidden="true" className="absolute border-2 border-[#e5e5e5] border-solid inset-0 pointer-events-none rounded-[16px] shadow-[0px_3px_0px_0px_#d4d4d4]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[12px] items-center px-[20px] py-[2px] relative size-full">
        <Div2 />
        <Span11 />
        <ChevronRight3 />
      </div>
    </div>
  );
}

function Container24() {
  return (
    <div className="h-[64px] relative shrink-0 w-[362px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative size-full">
        <Button4 />
      </div>
    </div>
  );
}

function Container20() {
  return (
    <div className="content-stretch flex flex-col gap-[8px] h-[327px] items-start relative shrink-0 w-full" data-name="Container">
      <Container21 />
      <Container22 />
      <Container23 />
      <Container24 />
    </div>
  );
}

function Container19() {
  return (
    <div className="h-[363px] relative shrink-0 w-[362px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[12px] items-start relative size-full">
        <H2 />
        <Container20 />
      </div>
    </div>
  );
}

function Container1() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[20px] h-[657px] items-start left-0 pl-[20px] pt-[20px] top-[208px] w-[402px]" data-name="Container">
      <Container2 />
      <Container7 />
      <Container19 />
    </div>
  );
}

function Img() {
  return (
    <div className="absolute h-[208px] left-0 top-0 w-[402px]" data-name="img">
      <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgImg} />
    </div>
  );
}

function Container26() {
  return <div className="absolute bg-gradient-to-b from-[rgba(0,0,0,0.3)] h-[208px] left-0 to-[rgba(0,0,0,0.6)] top-0 w-[402px]" data-name="Container" />;
}

function ArrowLeft() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="ArrowLeft">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="ArrowLeft">
          <path d={svgPaths.p33f6b680} id="Vector" stroke="var(--stroke-0, #4B4B4B)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d="M15.8333 10H4.16667" id="Vector_2" stroke="var(--stroke-0, #4B4B4B)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
        </g>
      </svg>
    </div>
  );
}

function Button5() {
  return (
    <div className="absolute bg-[rgba(255,255,255,0.9)] content-stretch flex items-center justify-center left-[16px] rounded-[14px] shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)] size-[40px] top-[48px]" data-name="button">
      <ArrowLeft />
    </div>
  );
}

function H() {
  return (
    <div className="content-stretch flex h-[32px] items-start relative shrink-0 w-full" data-name="h1">
      <p className="flex-[1_0_0] font-['Nunito:Black',sans-serif] font-black leading-[32px] min-h-px min-w-px relative text-[24px] text-white">Bali Adventure 🌴</p>
    </div>
  );
}

function MapPin() {
  return (
    <div className="relative shrink-0 size-[13px]" data-name="MapPin">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 13 13">
        <g id="MapPin">
          <path d={svgPaths.p1d79ab00} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.8" strokeWidth="1.08333" />
          <path d={svgPaths.p37a0d000} id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.8" strokeWidth="1.08333" />
        </g>
      </svg>
    </div>
  );
}

function Span12() {
  return (
    <div className="flex-[1_0_0] h-[16px] min-h-px min-w-px relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Nunito:Bold',sans-serif] font-bold leading-[16px] relative shrink-0 text-[12px] text-[rgba(255,255,255,0.8)] whitespace-nowrap">Bali, Indonesia</p>
      </div>
    </div>
  );
}

function Container29() {
  return (
    <div className="h-[16px] relative shrink-0 w-[98.469px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[4px] items-center relative size-full">
        <MapPin />
        <Span12 />
      </div>
    </div>
  );
}

function CalendarDays() {
  return (
    <div className="relative shrink-0 size-[13px]" data-name="CalendarDays">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 13 13">
        <g id="CalendarDays">
          <path d="M4.33333 1.08333V3.25" id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.8" strokeWidth="1.08333" />
          <path d="M8.66667 1.08333V3.25" id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.8" strokeWidth="1.08333" />
          <path d={svgPaths.p3b7aed80} id="Vector_3" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.8" strokeWidth="1.08333" />
          <path d="M1.625 5.41667H11.375" id="Vector_4" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.8" strokeWidth="1.08333" />
          <path d="M4.33333 7.58333H4.33875" id="Vector_5" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.8" strokeWidth="1.08333" />
          <path d="M6.5 7.58333H6.50542" id="Vector_6" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.8" strokeWidth="1.08333" />
          <path d="M8.66667 7.58333H8.67208" id="Vector_7" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.8" strokeWidth="1.08333" />
          <path d="M4.33333 9.75H4.33875" id="Vector_8" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.8" strokeWidth="1.08333" />
          <path d="M6.5 9.75H6.50542" id="Vector_9" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.8" strokeWidth="1.08333" />
          <path d="M8.66667 9.75H8.67208" id="Vector_10" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.8" strokeWidth="1.08333" />
        </g>
      </svg>
    </div>
  );
}

function Span13() {
  return (
    <div className="flex-[1_0_0] h-[16px] min-h-px min-w-px relative" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Nunito:Bold',sans-serif] font-bold leading-[16px] relative shrink-0 text-[12px] text-[rgba(255,255,255,0.8)] whitespace-nowrap">May 21–25</p>
      </div>
    </div>
  );
}

function Container30() {
  return (
    <div className="h-[16px] relative shrink-0 w-[78.297px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[4px] items-center relative size-full">
        <CalendarDays />
        <Span13 />
      </div>
    </div>
  );
}

function Container28() {
  return (
    <div className="content-stretch flex gap-[12px] h-[16px] items-center relative shrink-0 w-full" data-name="Container">
      <Container29 />
      <Container30 />
    </div>
  );
}

function Container27() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[4px] h-[52px] items-start left-[20px] top-[140px] w-[362px]" data-name="Container">
      <H />
      <Container28 />
    </div>
  );
}

function Container25() {
  return (
    <div className="absolute h-[208px] left-0 top-0 w-[402px]" data-name="Container">
      <Img />
      <Container26 />
      <Button5 />
      <Container27 />
    </div>
  );
}

function Container() {
  return (
    <div className="bg-white h-[961px] relative shrink-0 w-[402px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid overflow-clip relative rounded-[inherit] size-full">
        <Container1 />
        <Container25 />
      </div>
    </div>
  );
}

function Div() {
  return (
    <div className="bg-[#f7f7f7] content-stretch flex h-[961px] items-center justify-center relative shrink-0 w-full" data-name="div">
      <Container />
    </div>
  );
}

function Body() {
  return (
    <div className="absolute bg-white content-stretch flex flex-col h-[944px] items-start left-0 top-0 w-[1534px]" data-name="Body">
      <Div />
    </div>
  );
}

function Icon() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-[24px]" data-name="Icon">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid overflow-clip relative rounded-[inherit] size-full">
        <div className="absolute bottom-[12.5%] left-[37.5%] right-[37.5%] top-1/2" data-name="Vector">
          <div className="absolute inset-[-11.11%_-16.67%]">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 8 11">
              <path d={svgPaths.p3ff7f900} id="Vector" stroke="var(--stroke-0, #AFAFAF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </div>
        </div>
        <div className="absolute inset-[8.34%_12.5%_12.5%_12.5%]" data-name="Vector">
          <div className="absolute inset-[-5.26%_-5.56%]">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20.9995">
              <path d={svgPaths.p282f8f00} id="Vector" stroke="var(--stroke-0, #AFAFAF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function Span14() {
  return (
    <div className="h-[16px] relative shrink-0 w-[33.219px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Nunito:Bold',sans-serif] font-bold leading-[16px] relative shrink-0 text-[#afafaf] text-[12px] text-center whitespace-nowrap">Home</p>
      </div>
    </div>
  );
}

function Button6() {
  return (
    <div className="h-[52px] relative rounded-[14px] shrink-0 w-[57.219px]" data-name="button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[4px] items-center py-[4px] relative size-full">
        <Icon />
        <Span14 />
      </div>
    </div>
  );
}

function Icon1() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-[24px]" data-name="Icon">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid overflow-clip relative rounded-[inherit] size-full">
        <div className="absolute inset-[13.48%_12.5%]" data-name="Vector">
          <div className="absolute inset-[-7.13%_-6.94%]">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20.5 20.0289">
              <path d={svgPaths.pf305ff0} fill="var(--fill-0, #58CC02)" id="Vector" stroke="var(--stroke-0, #58CC02)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
            </svg>
          </div>
        </div>
        <div className="absolute inset-[24.02%_37.5%_13.48%_62.5%]" data-name="Vector">
          <div className="absolute inset-[-8.33%_-1.25px]">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 2.5 17.5">
              <g id="Vector">
                <path d="M1.25 1.25V16.25Z" fill="var(--fill-0, #58CC02)" />
                <path d="M1.25 1.25V16.25" stroke="var(--stroke-0, #58CC02)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
              </g>
            </svg>
          </div>
        </div>
        <div className="absolute inset-[13.48%_62.5%_24.02%_37.5%]" data-name="Vector">
          <div className="absolute inset-[-8.33%_-1.25px]">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 2.5 17.5">
              <g id="Vector">
                <path d="M1.25 1.25V16.25Z" fill="var(--fill-0, #58CC02)" />
                <path d="M1.25 1.25V16.25" stroke="var(--stroke-0, #58CC02)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function Span15() {
  return (
    <div className="h-[16px] relative shrink-0 w-[27.344px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Nunito:Bold',sans-serif] font-bold leading-[16px] relative shrink-0 text-[#58cc02] text-[12px] text-center whitespace-nowrap">Trips</p>
      </div>
    </div>
  );
}

function Button7() {
  return (
    <div className="h-[52px] relative rounded-[14px] shrink-0 w-[51.344px]" data-name="button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[4px] items-center py-[4px] relative size-full">
        <Icon1 />
        <Span15 />
      </div>
    </div>
  );
}

function Icon2() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-[24px]" data-name="Icon">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid overflow-clip relative rounded-[inherit] size-full">
        <div className="absolute inset-[8.33%_8.33%_12.2%_8.33%]" data-name="Vector">
          <div className="absolute inset-[-5.24%_-5%]">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 22.0018 21.0721">
              <path d={svgPaths.p18eb980} id="Vector" stroke="var(--stroke-0, #AFAFAF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function Span16() {
  return (
    <div className="h-[16px] relative shrink-0 w-[42.719px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Nunito:Bold',sans-serif] font-bold leading-[16px] relative shrink-0 text-[#afafaf] text-[12px] text-center whitespace-nowrap">Explore</p>
      </div>
    </div>
  );
}

function Button8() {
  return (
    <div className="h-[52px] relative rounded-[14px] shrink-0 w-[66.719px]" data-name="button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[4px] items-center py-[4px] relative size-full">
        <Icon2 />
        <Span16 />
      </div>
    </div>
  );
}

function Icon3() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-[24px]" data-name="Icon">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid overflow-clip relative rounded-[inherit] size-full">
        <div className="absolute inset-[62.5%_20.83%_12.5%_20.83%]" data-name="Vector">
          <div className="absolute inset-[-16.67%_-7.14%]">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 8">
              <path d={svgPaths.p11b86180} id="Vector" stroke="var(--stroke-0, #AFAFAF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </div>
        </div>
        <div className="absolute inset-[12.5%_33.33%_54.17%_33.33%]" data-name="Vector">
          <div className="absolute inset-[-12.5%]">
            <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 10 10">
              <path d={svgPaths.pb08b100} id="Vector" stroke="var(--stroke-0, #AFAFAF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function Span17() {
  return (
    <div className="h-[16px] relative shrink-0 w-[36.781px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Nunito:Bold',sans-serif] font-bold leading-[16px] relative shrink-0 text-[#afafaf] text-[12px] text-center whitespace-nowrap">Profile</p>
      </div>
    </div>
  );
}

function Button9() {
  return (
    <div className="h-[52px] relative rounded-[14px] shrink-0 w-[60.781px]" data-name="button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[4px] items-center py-[4px] relative size-full">
        <Icon3 />
        <Span17 />
      </div>
    </div>
  );
}

function Div3() {
  return (
    <div className="absolute bg-white content-stretch flex h-[70px] items-center justify-between left-[566px] pl-[32.734px] pr-[32.75px] pt-[2px] top-[874px] w-[402px]" data-name="div">
      <div aria-hidden="true" className="absolute border-[#e5e5e5] border-solid border-t-2 inset-0 pointer-events-none" />
      <Button6 />
      <Button7 />
      <Button8 />
      <Button9 />
    </div>
  );
}

export default function LofiToHifiMobilePrototypePartialMemebersSetPreference() {
  return (
    <div className="bg-white relative size-full" data-name="Lofi to Hifi Mobile Prototype - partial memebers set preference">
      <Body />
      <Div3 />
    </div>
  );
}