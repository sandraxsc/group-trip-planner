import svgPaths from "./svg-ua59d5hvyl";

function Frame() {
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

function Frame1() {
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

function Frame2() {
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

function Frame3() {
  return (
    <div className="absolute border border-black border-dashed h-[108px] left-[21px] overflow-clip rounded-[8px] top-[342px] w-[350px]">
      <p className="absolute font-['Balsamiq_Sans:Regular',sans-serif] leading-[24px] left-[62px] not-italic text-[16px] text-black top-[41px] whitespace-nowrap">add places you’re interested in</p>
    </div>
  );
}

export default function SetPreferencecStep() {
  return (
    <div className="bg-white relative size-full" data-name="set preferencec-step 6">
      <div className="absolute bg-white content-stretch flex flex-col items-center justify-center left-[30px] rounded-[4px] top-[26px]" data-name="Button - Small">
        <div aria-hidden="true" className="absolute border-2 border-[#1a1a1a] border-solid inset-0 pointer-events-none rounded-[4px]" />
        <Frame />
      </div>
      <div className="absolute bg-[#1a1a1a] content-stretch flex flex-col items-center justify-center left-[17px] rounded-[4px] top-[812px] w-[328px]" data-name="Button - Large">
        <Frame1 />
      </div>
      <div className="absolute bg-white content-stretch flex flex-col items-center justify-center left-[344px] rounded-[4px] top-[26px]" data-name="Button - Small">
        <div aria-hidden="true" className="absolute border-2 border-[#1a1a1a] border-solid inset-0 pointer-events-none rounded-[4px]" />
        <Frame2 />
      </div>
      <p className="absolute font-['Balsamiq_Sans:Regular',sans-serif] leading-[24px] left-[24px] not-italic text-[20px] text-black top-[300px] whitespace-nowrap">add some places that you want to go</p>
      <Frame3 />
      <div className="absolute bg-[#d9d9d9] h-[122px] left-[133px] top-[136px] w-[141px]" />
      <p className="absolute font-['Balsamiq_Sans:Regular',sans-serif] leading-[24px] left-[152px] not-italic text-[16px] text-black top-[196px] whitespace-nowrap">Illustration</p>
    </div>
  );
}