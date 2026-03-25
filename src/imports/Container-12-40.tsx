function Span() {
  return (
    <div className="h-[16px] relative shrink-0 w-[139.234px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-start relative size-full">
        <p className="font-['Nunito:Black',sans-serif] font-black leading-[16px] relative shrink-0 text-[#afafaf] text-[12px] tracking-[0.3px] uppercase whitespace-nowrap">Planning progress</p>
      </div>
    </div>
  );
}

function Span1() {
  return (
    <div className="h-[24px] relative shrink-0 w-[34.641px]" data-name="span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Nunito:Black',sans-serif] font-black leading-[24px] left-0 text-[#58cc02] text-[16px] top-0 whitespace-nowrap">40%</p>
      </div>
    </div>
  );
}

function Container1() {
  return (
    <div className="content-stretch flex h-[24px] items-center justify-between relative shrink-0 w-full" data-name="Container">
      <Span />
      <Span1 />
    </div>
  );
}

function Container3() {
  return <div className="bg-gradient-to-b from-[#58cc02] h-[16px] rounded-[33554400px] shrink-0 to-[#89e219] w-full" data-name="Container" />;
}

function Container2() {
  return (
    <div className="bg-[#e5e5e5] h-[16px] relative rounded-[33554400px] shrink-0 w-full" data-name="Container">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col items-start pr-[195.609px] relative size-full">
          <Container3 />
        </div>
      </div>
    </div>
  );
}

function P() {
  return (
    <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full" data-name="p">
      <p className="flex-[1_0_0] font-['Nunito:Bold',sans-serif] font-bold leading-[16px] min-h-px min-w-px relative text-[#afafaf] text-[12px]">2 of 5 steps completed</p>
    </div>
  );
}

export default function Container() {
  return (
    <div className="bg-white content-stretch flex flex-col gap-[8px] items-start pb-[2px] pt-[18px] px-[18px] relative rounded-[16px] size-full" data-name="Container">
      <div aria-hidden="true" className="absolute border-2 border-[#46a302] border-solid inset-0 pointer-events-none rounded-[16px] shadow-[0px_4px_0px_0px_#46a302]" />
      <Container1 />
      <Container2 />
      <P />
    </div>
  );
}