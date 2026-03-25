import svgPaths from "./svg-4gk0vtnfcf";

function Frame4() {
  return (
    <div className="absolute bg-white h-[357px] left-[51px] overflow-clip shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] top-[218px] w-[299px]">
      <p className="absolute font-['Nunito:Black',sans-serif] font-black leading-[32px] left-[86px] text-[24px] text-black top-[147px] whitespace-nowrap">QR CODE</p>
    </div>
  );
}

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

function Frame3() {
  return (
    <div className="absolute bg-[#d2d2d2] h-[436px] left-0 top-0 w-[402px]">
      <Frame4 />
      <p className="absolute font-['Nunito:Regular',sans-serif] font-normal leading-[32px] left-[66px] text-[24px] text-black top-[105px] w-[312px]">Successfully create a trip!</p>
      <p className="absolute font-['Nunito:Bold',sans-serif] font-bold leading-[32px] left-[74px] text-[24px] text-black top-[173px] w-[285px]">Invite Trip Memebers</p>
      <div className="absolute bg-white content-stretch flex flex-col items-center justify-center left-[30px] rounded-[4px] top-[26px]" data-name="Button - Small">
        <div aria-hidden="true" className="absolute border-2 border-[#1a1a1a] border-solid inset-0 pointer-events-none rounded-[4px]" />
        <Frame />
      </div>
    </div>
  );
}

function Frame1() {
  return (
    <div className="content-stretch flex items-center justify-center pl-[12px] pr-[16px] py-[16px] relative shrink-0" data-name="Frame">
      <p className="font-['Balsamiq_Sans:Regular',sans-serif] leading-[16px] not-italic relative shrink-0 text-[14px] text-white uppercase whitespace-nowrap">sHARE PLAN</p>
    </div>
  );
}

function Frame2() {
  return (
    <div className="content-stretch flex items-center justify-center pl-[12px] pr-[16px] py-[16px] relative shrink-0" data-name="Frame">
      <p className="font-['Balsamiq_Sans:Regular',sans-serif] leading-[16px] not-italic relative shrink-0 text-[14px] text-white uppercase whitespace-nowrap">copy link</p>
    </div>
  );
}

export default function InviteFriends() {
  return (
    <div className="bg-white relative size-full" data-name="invite friends">
      <Frame3 />
      <div className="absolute bg-[#1a1a1a] content-stretch flex flex-col items-center justify-center left-[59px] rounded-[4px] top-[623px] w-[135px]" data-name="Button - Large">
        <Frame1 />
      </div>
      <div className="absolute bg-[#1a1a1a] content-stretch flex flex-col items-center justify-center left-[217px] rounded-[4px] top-[623px] w-[133px]" data-name="Button - Large">
        <Frame2 />
      </div>
    </div>
  );
}