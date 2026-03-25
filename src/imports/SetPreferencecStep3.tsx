import svgPaths from "./svg-rqo85azenl";

function Frame() {
  return (
    <div className="content-stretch flex gap-[8px] items-center justify-center px-[12px] py-[15px] relative shrink-0" data-name="Frame">
      <div className="overflow-clip relative shrink-0 size-[18px]" data-name="Leading Icon">
        <div className="absolute inset-[10.42%_8.33%]" data-name="Vector">
          <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 15 14.25">
            <path d={svgPaths.p1b3883c0} fill="var(--fill-0, white)" id="Vector" />
          </svg>
        </div>
      </div>
      <p className="font-['Balsamiq_Sans:Regular',sans-serif] leading-[16px] not-italic relative shrink-0 text-[14px] text-white uppercase whitespace-nowrap">continue</p>
      <div className="overflow-clip relative shrink-0 size-[18px]" data-name="Trailing Icon">
        <div className="absolute inset-[10.42%_8.33%]" data-name="Vector">
          <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 15 14.25">
            <path d={svgPaths.p1b3883c0} fill="var(--fill-0, white)" id="Vector" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Frame4() {
  return (
    <div className="absolute bg-white h-[560px] left-0 overflow-clip rounded-tl-[16px] rounded-tr-[16px] top-[314px] w-[402px]">
      <p className="absolute font-['Lato:Bold',sans-serif] leading-[28px] left-[37px] not-italic text-[20px] text-black top-[44px] whitespace-nowrap">active time</p>
      <div className="absolute bg-[#1a1a1a] content-stretch flex flex-col items-center justify-center left-[27px] rounded-[4px] top-[486px] w-[328px]" data-name="Button - Large">
        <Frame />
      </div>
      <p className="absolute font-['Lato:Regular',sans-serif] leading-[64px] left-[82px] not-italic text-[57px] text-black top-[130px] tracking-[-0.25px] whitespace-nowrap">9:00 AM</p>
      <p className="absolute font-['Lato:Regular',sans-serif] h-[68px] leading-[64px] left-[92px] not-italic text-[57px] text-black top-[306px] tracking-[-0.25px] w-[214px]">9:00 PM</p>
      <p className="absolute font-['Lato:Regular',sans-serif] leading-[44px] left-[174px] not-italic text-[36px] text-black top-[213px] whitespace-nowrap">to</p>
    </div>
  );
}

function Frame1() {
  return (
    <div className="content-stretch flex items-center p-[9px] relative shrink-0" data-name="Frame">
      <div className="overflow-clip relative shrink-0 size-[18px]" data-name="Leading Icon">
        <div className="absolute inset-[10.42%_8.33%]" data-name="Vector">
          <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 15 14.25">
            <path d={svgPaths.p1b3883c0} fill="var(--fill-0, #1A1A1A)" id="Vector" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Frame2() {
  return (
    <div className="content-stretch flex items-center p-[9px] relative shrink-0" data-name="Frame">
      <div className="overflow-clip relative shrink-0 size-[18px]" data-name="Leading Icon">
        <div className="absolute inset-[16.67%]" data-name="Vector">
          <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12 12">
            <path d={svgPaths.p83cd500} fill="var(--fill-0, #1A1A1A)" id="Vector" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Frame3() {
  return (
    <div className="content-stretch flex items-center p-[9px] relative shrink-0" data-name="Frame">
      <div className="overflow-clip relative shrink-0 size-[18px]" data-name="Leading Icon">
        <div className="absolute inset-[16.67%]" data-name="Vector">
          <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12 12">
            <path d={svgPaths.p1cf2ff00} fill="var(--fill-0, #1A1A1A)" id="Vector" />
          </svg>
        </div>
      </div>
    </div>
  );
}

export default function SetPreferencecStep() {
  return (
    <div className="bg-[#e3e3e3] relative size-full" data-name="set preferencec-step 3">
      <Frame4 />
      <div className="absolute bg-white content-stretch flex flex-col items-center justify-center left-[17px] rounded-[4px] top-[18px]" data-name="Button - Small">
        <div aria-hidden="true" className="absolute border-2 border-[#1a1a1a] border-solid inset-0 pointer-events-none rounded-[4px]" />
        <Frame1 />
      </div>
      <div className="absolute bg-white content-stretch flex flex-col items-center justify-center left-[17px] rounded-[4px] top-[18px]" data-name="Button - Small">
        <div aria-hidden="true" className="absolute border-2 border-[#1a1a1a] border-solid inset-0 pointer-events-none rounded-[4px]" />
        <Frame2 />
      </div>
      <div className="absolute bg-white content-stretch flex flex-col items-center justify-center left-[353px] rounded-[4px] top-[18px]" data-name="Button - Small">
        <div aria-hidden="true" className="absolute border-2 border-[#1a1a1a] border-solid inset-0 pointer-events-none rounded-[4px]" />
        <Frame3 />
      </div>
      <p className="absolute font-['Balsamiq_Sans:Regular',sans-serif] leading-[16px] left-[167px] not-italic text-[14px] text-black top-[165px] uppercase whitespace-nowrap">Avatar</p>
    </div>
  );
}