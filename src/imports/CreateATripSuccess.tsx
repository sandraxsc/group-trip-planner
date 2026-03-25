function Frame2() {
  return (
    <div className="absolute bg-white h-[138px] left-[117px] overflow-clip top-[199px] w-[169px]">
      <p className="absolute font-['Nunito:Regular',sans-serif] font-normal leading-[32px] left-[19px] text-[24px] text-black top-[21px] w-[131px] whitespace-pre-wrap">{`Congratulation  illustration`}</p>
    </div>
  );
}

function Frame() {
  return (
    <div className="content-stretch flex items-center justify-center pl-[12px] pr-[16px] py-[16px] relative shrink-0" data-name="Frame">
      <p className="font-['Balsamiq_Sans:Regular',sans-serif] leading-[16px] not-italic relative shrink-0 text-[14px] text-white uppercase whitespace-nowrap">next (3s)</p>
    </div>
  );
}

function Frame1() {
  return (
    <div className="absolute bg-[#d2d2d2] h-[874px] left-0 top-0 w-[402px]">
      <p className="absolute font-['Nunito:Regular',sans-serif] font-normal h-[32px] leading-[32px] left-[66px] text-[24px] text-black top-[421px] w-[312px]">You Successfully create a trip!</p>
      <Frame2 />
      <div className="absolute bg-[#1a1a1a] content-stretch flex flex-col items-center justify-center left-[39px] rounded-[4px] top-[787px] w-[328px]" data-name="Button - Large">
        <Frame />
      </div>
    </div>
  );
}

export default function CreateATripSuccess() {
  return (
    <div className="bg-white relative size-full" data-name="create a trip - success">
      <Frame1 />
    </div>
  );
}