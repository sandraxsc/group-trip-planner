import svgPaths from "./svg-lx20s33svc";

function Frame2() {
  return (
    <div className="content-stretch flex flex-col font-['Balsamiq_Sans:Regular',sans-serif] items-start not-italic relative shrink-0 w-full" data-name="Frame">
      <p className="leading-[24px] relative shrink-0 text-[#1a1a1a] text-[20px] w-full">Title</p>
      <p className="leading-[20px] relative shrink-0 text-[#666] text-[14px] w-full">Supporting or descriptive text for the card goes here.</p>
    </div>
  );
}

function Frame1() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col items-start min-h-px min-w-px relative" data-name="Frame">
      <Frame2 />
    </div>
  );
}

function Frame() {
  return (
    <div className="content-stretch flex gap-[16px] items-center px-[16px] relative shrink-0 w-[328px]" data-name="Frame">
      <Frame1 />
      <div className="overflow-clip relative shrink-0 size-[80px]" data-name="Image">
        <div className="absolute bg-[#f2f2f2] inset-0" data-name="Base" />
        <div className="-translate-x-1/2 -translate-y-1/2 absolute h-[60px] left-1/2 top-1/2 w-[68px]" data-name="Vector">
          <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 68 60">
            <path clipRule="evenodd" d={svgPaths.p19b72700} fill="var(--fill-0, #B3B3B3)" fillRule="evenodd" id="Vector" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Overflow() {
  return (
    <div className="h-[24px] relative shrink-0 w-[16px]" data-name="Overflow">
      <div className="absolute left-[-4px] overflow-clip size-[24px] top-0" data-name="more_vert">
        <div className="absolute inset-[16.67%_41.67%]" data-name="Vector">
          <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 4 16">
            <path d={svgPaths.p56f6880} fill="var(--fill-0, #1A1A1A)" id="Vector" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Actions() {
  return (
    <div className="absolute content-stretch flex gap-[24px] items-start right-[16px] top-[16px]" data-name="Actions">
      <div className="overflow-clip relative shrink-0 size-[24px]" data-name="Trailing Icon 1">
        <div className="absolute inset-[10.42%_8.33%]" data-name="Vector">
          <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 19">
            <path d={svgPaths.p1b31ad40} fill="var(--fill-0, #1A1A1A)" id="Vector" />
          </svg>
        </div>
      </div>
      <div className="overflow-clip relative shrink-0 size-[24px]" data-name="Trailing Icon 2">
        <div className="absolute inset-[10.42%_8.33%]" data-name="Vector">
          <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 19">
            <path d={svgPaths.p1b31ad40} fill="var(--fill-0, #1A1A1A)" id="Vector" />
          </svg>
        </div>
      </div>
      <div className="overflow-clip relative shrink-0 size-[24px]" data-name="Trailing Icon 3">
        <div className="absolute inset-[10.42%_8.33%]" data-name="Vector">
          <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 19">
            <path d={svgPaths.p1b31ad40} fill="var(--fill-0, #1A1A1A)" id="Vector" />
          </svg>
        </div>
      </div>
      <Overflow />
    </div>
  );
}

function Actions1() {
  return (
    <div className="absolute content-stretch flex items-start left-[16px] top-[16px]" data-name="Actions">
      <div className="overflow-clip relative shrink-0 size-[24px]" data-name="menu">
        <div className="absolute bottom-1/4 left-[12.5%] right-[12.5%] top-1/4" data-name="Vector">
          <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 12">
            <path d={svgPaths.p6b54880} fill="var(--fill-0, #1A1A1A)" id="Vector" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Actions2() {
  return (
    <div className="absolute content-stretch flex gap-[24px] items-start right-[16px] top-[16px]" data-name="Actions">
      <div className="overflow-clip relative shrink-0 size-[24px]" data-name="Trailing Icon 1">
        <div className="absolute inset-[10.42%_8.33%]" data-name="Vector">
          <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 19">
            <path d={svgPaths.p1b31ad40} fill="var(--fill-0, #1A1A1A)" id="Vector" />
          </svg>
        </div>
      </div>
      <div className="overflow-clip relative shrink-0 size-[24px]" data-name="Trailing Icon 2">
        <div className="absolute inset-[10.42%_8.33%]" data-name="Vector">
          <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 19">
            <path d={svgPaths.p1b31ad40} fill="var(--fill-0, #1A1A1A)" id="Vector" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Actions3() {
  return (
    <div className="absolute content-stretch flex items-start left-[16px] top-[16px]" data-name="Actions">
      <div className="overflow-clip relative shrink-0 size-[24px]" data-name="menu">
        <div className="absolute bottom-1/4 left-[12.5%] right-[12.5%] top-1/4" data-name="Vector">
          <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 18 12">
            <path d={svgPaths.p6b54880} fill="var(--fill-0, #1A1A1A)" id="Vector" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function FabRegular() {
  return (
    <div className="-translate-x-1/2 absolute left-1/2 size-[56px] top-[-28px]" data-name="FAB : Regular">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 56 56">
        <circle cx="28" cy="28" fill="var(--fill-0, #1A1A1A)" id="Ellipse" r="28" />
      </svg>
      <div className="-translate-x-1/2 -translate-y-1/2 absolute left-1/2 overflow-clip size-[24px] top-1/2" data-name="add">
        <div className="absolute inset-[20.83%]" data-name="Vector">
          <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14 14">
            <path d={svgPaths.p38adf480} fill="var(--fill-0, #F2F2F2)" id="Vector" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Frame3() {
  return (
    <div className="relative shrink-0 w-full" data-name="Frame">
      <div className="content-stretch flex flex-col font-['Balsamiq_Sans:Regular',sans-serif] gap-[4px] items-start not-italic px-[16px] relative w-full">
        <p className="leading-[24px] relative shrink-0 text-[#1a1a1a] text-[20px] w-full">Title</p>
        <p className="leading-[20px] relative shrink-0 text-[#666] text-[14px] w-full">Subtitle</p>
      </div>
    </div>
  );
}

function Frame4() {
  return (
    <div className="relative shrink-0 w-full" data-name="Frame">
      <div className="content-stretch flex items-start px-[16px] relative w-full">
        <p className="flex-[1_0_0] font-['Balsamiq_Sans:Regular',sans-serif] leading-[20px] min-h-px min-w-px not-italic relative text-[#666] text-[14px]">Supporting or descriptive text for the card goes here like a pro.</p>
      </div>
    </div>
  );
}

function Frame6() {
  return (
    <div className="content-stretch flex items-center px-[16px] py-[10px] relative shrink-0" data-name="Frame">
      <p className="font-['Balsamiq_Sans:Regular',sans-serif] leading-[16px] not-italic relative shrink-0 text-[14px] text-white uppercase whitespace-nowrap">Button</p>
    </div>
  );
}

function MinWidth() {
  return <div className="h-0 shrink-0 w-[64px]" data-name="Min Width 64" />;
}

function Frame7() {
  return (
    <div className="content-stretch flex items-center px-[16px] py-[10px] relative shrink-0" data-name="Frame">
      <p className="font-['Balsamiq_Sans:Regular',sans-serif] leading-[16px] not-italic relative shrink-0 text-[14px] text-white uppercase whitespace-nowrap">Button</p>
    </div>
  );
}

function MinWidth1() {
  return <div className="h-0 shrink-0 w-[64px]" data-name="Min Width 64" />;
}

function Frame5() {
  return (
    <div className="relative shrink-0 w-full" data-name="Frame">
      <div className="content-stretch flex gap-[12px] items-start px-[16px] relative w-full">
        <div className="bg-[#1a1a1a] content-stretch flex flex-col items-center justify-center relative rounded-[4px] shrink-0" data-name="Button - Small">
          <Frame6 />
          <MinWidth />
        </div>
        <div className="bg-[#1a1a1a] content-stretch flex flex-col items-center justify-center relative rounded-[4px] shrink-0" data-name="Button - Small">
          <Frame7 />
          <MinWidth1 />
        </div>
      </div>
    </div>
  );
}

function Frame10() {
  return (
    <div className="content-stretch flex flex-col font-['Balsamiq_Sans:Regular',sans-serif] items-start not-italic relative shrink-0 w-full" data-name="Frame">
      <p className="leading-[24px] relative shrink-0 text-[#1a1a1a] text-[20px] w-full">Title</p>
      <p className="leading-[20px] relative shrink-0 text-[#666] text-[14px] w-full">Supporting or descriptive text for the card goes here.</p>
    </div>
  );
}

function Frame9() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col items-start min-h-px min-w-px relative" data-name="Frame">
      <Frame10 />
    </div>
  );
}

function Frame8() {
  return (
    <div className="content-stretch flex gap-[16px] items-center px-[16px] relative shrink-0 w-[328px]" data-name="Frame">
      <Frame9 />
      <div className="overflow-clip relative shrink-0 size-[80px]" data-name="Image">
        <div className="absolute bg-[#f2f2f2] inset-0" data-name="Base" />
        <div className="-translate-x-1/2 -translate-y-1/2 absolute h-[60px] left-1/2 top-1/2 w-[68px]" data-name="Vector">
          <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 68 60">
            <path clipRule="evenodd" d={svgPaths.p19b72700} fill="var(--fill-0, #B3B3B3)" fillRule="evenodd" id="Vector" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function FrondPage() {
  return (
    <div className="bg-white relative size-full" data-name="frond page">
      <div className="absolute bg-white left-[17px] rounded-[8px] top-[775px] w-[360px]" data-name="Card - Small">
        <div className="content-stretch flex flex-col items-start overflow-clip py-[16px] relative rounded-[inherit] w-full">
          <Frame />
        </div>
        <div aria-hidden="true" className="absolute border-2 border-[#1a1a1a] border-solid inset-0 pointer-events-none rounded-[8px]" />
      </div>
      <div className="absolute bg-[#f2f2f2] h-[56px] left-0 top-0 w-[402px]" data-name="App Bar - Bottom">
        <Actions />
        <Actions1 />
      </div>
      <div className="absolute h-[56px] left-0 top-[818px] w-[402px]" data-name="App Bar - Bottom FAB">
        <div className="absolute bg-[#f2f2f2] inset-0" data-name="Fill" />
        <Actions2 />
        <Actions3 />
        <FabRegular />
      </div>
      <div className="absolute bg-white left-[21px] rounded-[8px] top-[234px] w-[360px]" data-name="Card - Large">
        <div className="content-stretch flex flex-col gap-[16px] items-start overflow-clip pb-[16px] relative rounded-[inherit] w-full">
          <div className="h-[184px] overflow-clip relative shrink-0 w-full" data-name="Image">
            <div className="absolute bg-[#f2f2f2] inset-0" data-name="Base" />
            <div className="-translate-x-1/2 -translate-y-1/2 absolute h-[60px] left-1/2 top-1/2 w-[68px]" data-name="Vector">
              <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 68 60">
                <path clipRule="evenodd" d={svgPaths.p19b72700} fill="var(--fill-0, #B3B3B3)" fillRule="evenodd" id="Vector" />
              </svg>
            </div>
          </div>
          <Frame3 />
          <Frame4 />
          <Frame5 />
        </div>
        <div aria-hidden="true" className="absolute border-2 border-[#1a1a1a] border-solid inset-0 pointer-events-none rounded-[8px]" />
      </div>
      <p className="absolute font-['Lato:Medium',sans-serif] leading-[20px] left-[24px] not-italic text-[14px] text-black top-[208px] tracking-[0.1px] whitespace-nowrap">on-going planning</p>
      <p className="absolute font-['Lato:Medium',sans-serif] leading-[20px] left-[25px] not-italic text-[14px] text-black top-[618px] tracking-[0.1px] whitespace-nowrap">Past plans</p>
      <div className="absolute bg-white left-[21px] rounded-[8px] top-[649px] w-[360px]" data-name="Card - Small">
        <div className="content-stretch flex flex-col items-start overflow-clip py-[16px] relative rounded-[inherit] w-full">
          <Frame8 />
        </div>
        <div aria-hidden="true" className="absolute border-2 border-[#1a1a1a] border-solid inset-0 pointer-events-none rounded-[8px]" />
      </div>
      <p className="absolute font-['Lato:Regular',sans-serif] leading-[52px] left-[24px] not-italic text-[45px] text-black top-[80px] w-[294px]">Welcome! Sandra</p>
    </div>
  );
}