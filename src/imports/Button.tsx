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

function Span() {
  return (
    <div className="h-[24px] relative shrink-0 w-[56.422px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Nunito:Black',sans-serif] font-black leading-[24px] left-0 text-[#3c3c3c] text-[16px] top-0 whitespace-nowrap">Budget</p>
      </div>
    </div>
  );
}

function Span1() {
  return (
    <div className="bg-[#f7f7f7] h-[24px] relative rounded-[33554400px] shrink-0 w-[76.391px]" data-name="span">
      <div aria-hidden="true" className="absolute border-2 border-[#e5e5e5] border-solid inset-0 pointer-events-none rounded-[33554400px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start px-[10px] py-[4px] relative size-full">
        <p className="font-['Nunito:Black',sans-serif] font-black leading-[16px] relative shrink-0 text-[#afafaf] text-[12px] whitespace-nowrap">{`< $50/day`}</p>
      </div>
    </div>
  );
}

function Container() {
  return (
    <div className="content-stretch flex h-[24px] items-center justify-between relative shrink-0 w-full" data-name="Container">
      <Span />
      <Span1 />
    </div>
  );
}

function P() {
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
        <Container />
        <P />
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

export default function Button() {
  return (
    <div className="bg-[rgba(255,255,255,0)] content-stretch flex gap-[16px] items-center pb-[4px] pt-[2px] px-[18px] relative rounded-[16px] size-full" data-name="button">
      <div aria-hidden="true" className="absolute border-[#e5e5e5] border-b-4 border-l-2 border-r-2 border-solid border-t-2 inset-0 pointer-events-none rounded-[16px] shadow-[0px_4px_0px_0px_#d4d4d4]" />
      <Div />
      <Div1 />
      <Div2 />
    </div>
  );
}