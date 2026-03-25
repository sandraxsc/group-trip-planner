import svgPaths from "./svg-pwy0uwuh45";

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

function Button() {
  return (
    <div className="bg-white relative rounded-[14px] shrink-0 size-[40px]" data-name="button">
      <div aria-hidden="true" className="absolute border-2 border-[#e5e5e5] border-solid inset-0 pointer-events-none rounded-[14px] shadow-[0px_3px_0px_0px_#d4d4d4]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center p-[2px] relative size-full">
        <ArrowLeft />
      </div>
    </div>
  );
}

function Container4() {
  return <div className="bg-[#58cc02] flex-[1_0_0] h-[8px] min-h-px min-w-px rounded-[33554400px]" data-name="Container" />;
}

function Container5() {
  return <div className="bg-[#e5e5e5] h-[8px] rounded-[33554400px] shrink-0 w-[24px]" data-name="Container" />;
}

function Container6() {
  return <div className="bg-[#e5e5e5] h-[8px] rounded-[33554400px] shrink-0 w-[24px]" data-name="Container" />;
}

function Container3() {
  return (
    <div className="h-[8px] relative shrink-0 w-[88px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[4px] items-start relative size-full">
        <Container4 />
        <Container5 />
        <Container6 />
      </div>
    </div>
  );
}

function Span() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-[61.141px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Nunito:Bold',sans-serif] font-bold leading-[16px] relative shrink-0 text-[#afafaf] text-[12px] whitespace-nowrap">Step 1 of 3</p>
      </div>
    </div>
  );
}

function Container2() {
  return (
    <div className="flex-[1_0_0] h-[28px] min-h-px min-w-px relative" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[4px] items-center relative size-full">
        <Container3 />
        <Span />
      </div>
    </div>
  );
}

function Container1() {
  return (
    <div className="h-[104px] relative shrink-0 w-[402px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[12px] items-center px-[16px] relative size-full">
        <Button />
        <Container2 />
      </div>
    </div>
  );
}

function Span1() {
  return (
    <div className="h-[40px] relative shrink-0 w-[49.438px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['Nunito:Regular',sans-serif] font-normal leading-[40px] left-[25px] text-[#0a0a0a] text-[36px] text-center top-[-1px] whitespace-nowrap">💰</p>
      </div>
    </div>
  );
}

function Container9() {
  return (
    <div className="absolute bg-[#fff8e7] content-stretch flex items-center justify-center left-[141px] p-[4px] rounded-[33554400px] size-[80px] top-0" data-name="Container">
      <div aria-hidden="true" className="absolute border-4 border-[#ffd900] border-solid inset-0 pointer-events-none rounded-[33554400px] shadow-[0px_4px_0px_0px_#e5c400]" />
      <Span1 />
    </div>
  );
}

function H() {
  return (
    <div className="absolute content-stretch flex h-[32px] items-start left-0 top-[96px] w-[362px]" data-name="h1">
      <p className="flex-[1_0_0] font-['Nunito:Black',sans-serif] font-black leading-[32px] min-h-px min-w-px relative text-[#3c3c3c] text-[24px] text-center">{`What's your budget?`}</p>
    </div>
  );
}

function P() {
  return (
    <div className="absolute content-stretch flex h-[20px] items-start left-0 top-[136px] w-[362px]" data-name="p">
      <p className="flex-[1_0_0] font-['Nunito:Bold',sans-serif] font-bold leading-[20px] min-h-px min-w-px relative text-[#afafaf] text-[14px] text-center">Choose a budget level that fits your style</p>
    </div>
  );
}

function Container8() {
  return (
    <div className="absolute h-[156px] left-[20px] top-0 w-[362px]" data-name="Container">
      <Container9 />
      <H />
      <P />
    </div>
  );
}

function Div() {
  return (
    <div className="bg-[#f7f7f7] relative rounded-[16px] shrink-0 size-[56px]" data-name="div">
      <div aria-hidden="true" className="absolute border-2 border-[#e5e5e5] border-solid inset-0 pointer-events-none rounded-[16px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center p-[2px] relative size-full">
        <p className="font-['Nunito:Medium',sans-serif] font-medium leading-[32px] relative shrink-0 text-[#0a0a0a] text-[24px] whitespace-nowrap">🎒</p>
      </div>
    </div>
  );
}

function Span2() {
  return (
    <div className="h-[24px] relative shrink-0 w-[56.422px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Nunito:Black',sans-serif] font-black leading-[24px] left-0 text-[#3c3c3c] text-[16px] top-0 whitespace-nowrap">Budget</p>
      </div>
    </div>
  );
}

function Span3() {
  return (
    <div className="bg-[#f7f7f7] h-[24px] relative rounded-[33554400px] shrink-0 w-[76.391px]" data-name="span">
      <div aria-hidden="true" className="absolute border-2 border-[#e5e5e5] border-solid inset-0 pointer-events-none rounded-[33554400px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start px-[10px] py-[4px] relative size-full">
        <p className="font-['Nunito:Black',sans-serif] font-black leading-[16px] relative shrink-0 text-[#afafaf] text-[12px] whitespace-nowrap">{`< $50/day`}</p>
      </div>
    </div>
  );
}

function Container11() {
  return (
    <div className="content-stretch flex h-[24px] items-center justify-between relative shrink-0 w-full" data-name="Container">
      <Span2 />
      <Span3 />
    </div>
  );
}

function P1() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Nunito:Bold',sans-serif] font-bold leading-[16px] min-h-px min-w-px relative text-[#afafaf] text-[12px]">{`Hostels, street food & free activities`}</p>
    </div>
  );
}

function Div1() {
  return (
    <div className="flex-[1_0_0] h-[42px] min-h-px min-w-px relative" data-name="div">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[2px] items-start relative size-full">
        <Container11 />
        <P1 />
      </div>
    </div>
  );
}

function Div2() {
  return (
    <div className="relative rounded-[33554400px] shrink-0 size-[24px]" data-name="div">
      <div aria-hidden="true" className="absolute border-3 border-[#e5e5e5] border-solid inset-0 pointer-events-none rounded-[33554400px]" />
    </div>
  );
}

function Button1() {
  return (
    <div className="bg-[rgba(255,255,255,0)] h-[94px] relative rounded-[16px] shrink-0 w-[362px]" data-name="button">
      <div aria-hidden="true" className="absolute border-[#e5e5e5] border-b-4 border-l-2 border-r-2 border-solid border-t-2 inset-0 pointer-events-none rounded-[16px] shadow-[0px_4px_0px_0px_#d4d4d4]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[16px] items-center pb-[4px] pt-[2px] px-[18px] relative size-full">
        <Div />
        <Div1 />
        <Div2 />
      </div>
    </div>
  );
}

function Div3() {
  return (
    <div className="bg-[#f7f7f7] relative rounded-[16px] shrink-0 size-[56px]" data-name="div">
      <div aria-hidden="true" className="absolute border-2 border-[#e5e5e5] border-solid inset-0 pointer-events-none rounded-[16px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center p-[2px] relative size-full">
        <p className="font-['Nunito:Medium',sans-serif] font-medium leading-[32px] relative shrink-0 text-[#0a0a0a] text-[24px] whitespace-nowrap">🏨</p>
      </div>
    </div>
  );
}

function Span4() {
  return (
    <div className="h-[24px] relative shrink-0 w-[74.156px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Nunito:Black',sans-serif] font-black leading-[24px] left-0 text-[#3c3c3c] text-[16px] top-0 whitespace-nowrap">Moderate</p>
      </div>
    </div>
  );
}

function Span5() {
  return (
    <div className="bg-[#f7f7f7] h-[24px] relative rounded-[33554400px] shrink-0 w-[100.563px]" data-name="span">
      <div aria-hidden="true" className="absolute border-2 border-[#e5e5e5] border-solid inset-0 pointer-events-none rounded-[33554400px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start px-[10px] py-[4px] relative size-full">
        <p className="font-['Nunito:Black',sans-serif] font-black leading-[16px] relative shrink-0 text-[#afafaf] text-[12px] whitespace-nowrap">$50–$150/day</p>
      </div>
    </div>
  );
}

function Container12() {
  return (
    <div className="content-stretch flex h-[24px] items-center justify-between relative shrink-0 w-full" data-name="Container">
      <Span4 />
      <Span5 />
    </div>
  );
}

function P2() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="font-['Nunito:Bold',sans-serif] font-bold leading-[16px] relative shrink-0 text-[#afafaf] text-[12px] whitespace-nowrap">{`Mid-range hotels & local restaurants`}</p>
    </div>
  );
}

function Div4() {
  return (
    <div className="flex-[1_0_0] h-[42px] min-h-px min-w-px relative" data-name="div">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[2px] items-start relative size-full">
        <Container12 />
        <P2 />
      </div>
    </div>
  );
}

function Div5() {
  return (
    <div className="relative rounded-[33554400px] shrink-0 size-[24px]" data-name="div">
      <div aria-hidden="true" className="absolute border-3 border-[#e5e5e5] border-solid inset-0 pointer-events-none rounded-[33554400px]" />
    </div>
  );
}

function Button2() {
  return (
    <div className="bg-[rgba(255,255,255,0)] h-[94px] relative rounded-[16px] shrink-0 w-[362px]" data-name="button">
      <div aria-hidden="true" className="absolute border-[#e5e5e5] border-b-4 border-l-2 border-r-2 border-solid border-t-2 inset-0 pointer-events-none rounded-[16px] shadow-[0px_4px_0px_0px_#d4d4d4]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[16px] items-center pb-[4px] pt-[2px] px-[18px] relative size-full">
        <Div3 />
        <Div4 />
        <Div5 />
      </div>
    </div>
  );
}

function Div6() {
  return (
    <div className="bg-[#f7f7f7] relative rounded-[16px] shrink-0 size-[56px]" data-name="div">
      <div aria-hidden="true" className="absolute border-2 border-[#e5e5e5] border-solid inset-0 pointer-events-none rounded-[16px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center p-[2px] relative size-full">
        <p className="font-['Nunito:Medium',sans-serif] font-medium leading-[32px] relative shrink-0 text-[#0a0a0a] text-[24px] whitespace-nowrap">✨</p>
      </div>
    </div>
  );
}

function Span6() {
  return (
    <div className="h-[24px] relative shrink-0 w-[53.672px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Nunito:Black',sans-serif] font-black leading-[24px] left-0 text-[#3c3c3c] text-[16px] top-0 whitespace-nowrap">Luxury</p>
      </div>
    </div>
  );
}

function Span7() {
  return (
    <div className="bg-[#f7f7f7] h-[24px] relative rounded-[33554400px] shrink-0 w-[80.156px]" data-name="span">
      <div aria-hidden="true" className="absolute border-2 border-[#e5e5e5] border-solid inset-0 pointer-events-none rounded-[33554400px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start px-[10px] py-[4px] relative size-full">
        <p className="font-['Nunito:Black',sans-serif] font-black leading-[16px] relative shrink-0 text-[#afafaf] text-[12px] whitespace-nowrap">$150+/day</p>
      </div>
    </div>
  );
}

function Container13() {
  return (
    <div className="content-stretch flex h-[24px] items-center justify-between relative shrink-0 w-full" data-name="Container">
      <Span6 />
      <Span7 />
    </div>
  );
}

function P3() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Nunito:Bold',sans-serif] font-bold leading-[16px] min-h-px min-w-px relative text-[#afafaf] text-[12px]">{`Premium hotels & fine dining`}</p>
    </div>
  );
}

function Div7() {
  return (
    <div className="flex-[1_0_0] h-[42px] min-h-px min-w-px relative" data-name="div">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[2px] items-start relative size-full">
        <Container13 />
        <P3 />
      </div>
    </div>
  );
}

function Div8() {
  return (
    <div className="relative rounded-[33554400px] shrink-0 size-[24px]" data-name="div">
      <div aria-hidden="true" className="absolute border-3 border-[#e5e5e5] border-solid inset-0 pointer-events-none rounded-[33554400px]" />
    </div>
  );
}

function Button3() {
  return (
    <div className="bg-[rgba(255,255,255,0)] flex-[1_0_0] min-h-px min-w-px relative rounded-[16px] w-[362px]" data-name="button">
      <div aria-hidden="true" className="absolute border-[#e5e5e5] border-b-4 border-l-2 border-r-2 border-solid border-t-2 inset-0 pointer-events-none rounded-[16px] shadow-[0px_4px_0px_0px_#d4d4d4]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[16px] items-center pb-[4px] pt-[2px] px-[18px] relative size-full">
        <Div6 />
        <Div7 />
        <Div8 />
      </div>
    </div>
  );
}

function Container10() {
  return (
    <div className="absolute content-stretch flex flex-col gap-[12px] h-[306px] items-start left-[20px] top-[188px] w-[362px]" data-name="Container">
      <Button1 />
      <Button2 />
      <Button3 />
    </div>
  );
}

function Button4() {
  return (
    <div className="absolute bg-[#58cc02] border-[#46a302] border-b-4 border-solid h-[60px] left-[20px] opacity-50 rounded-[16px] top-[748px] w-[362px]" data-name="button">
      <p className="-translate-x-1/2 absolute font-['Nunito:Bold','Noto_Sans_Symbols:Bold',sans-serif] font-bold leading-[24px] left-[181.92px] text-[16px] text-center text-white top-[16px] tracking-[0.4px] uppercase whitespace-nowrap">Continue →</p>
    </div>
  );
}

function Container7() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-[402px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Container8 />
        <Container10 />
        <Button4 />
      </div>
    </div>
  );
}

export default function Container() {
  return (
    <div className="bg-white content-stretch flex flex-col items-start relative size-full" data-name="Container">
      <Container1 />
      <Container7 />
    </div>
  );
}