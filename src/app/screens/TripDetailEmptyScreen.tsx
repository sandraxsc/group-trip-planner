import { useNavigate } from "react-router";
import { ArrowLeft, MapPin, Calendar, ChevronRight, Lock } from "lucide-react";
import { DuoButton } from "../components/DuoButton";

const HERO_IMG = "https://images.unsplash.com/photo-1728051767709-32ef3258277c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYWxpJTIwcmljZSUyMHRlcnJhY2UlMjBhZXJpYWwlMjBncmVlbiUyMGxhbmRzY2FwZXxlbnwxfHx8fDE3NzMwMjE4OTF8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral";

const members = [
  { id: 1, name: "Sandra", initials: "SN", bgColor: "#10B954", online: true },
  { id: 2, name: "Lix", initials: "LX", bgColor: "#E8E8E8", online: false },
  { id: 3, name: "Brian", initials: "BA", bgColor: "#E8E8E8", online: false },
  { id: 4, name: "Yulia", initials: "YU", bgColor: "#E8E8E8", online: false },
];

const planningSteps = [
  { id: 1, label: "Invite Friends", completed: false, locked: false },
  { id: 2, label: "Set Preferences", completed: false, locked: false },
  { id: 3, label: "Generate Plans", completed: false, locked: true },
  { id: 4, label: "Select a Plan", completed: false, locked: true },
];

export default function TripDetailEmptyScreen() {
  const navigate = useNavigate();

  const handleStepClick = (step: typeof planningSteps[0]) => {
    if (step.locked) return;
    
    if (step.id === 1) {
      navigate("/invite-friends");
    } else if (step.id === 2) {
      navigate("/preference-budget");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F7F6]">
      {/* Hero Section */}
      <div className="relative w-full h-48">
        <img src={HERO_IMG} alt="Bali" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/60" />
        
        {/* Back button */}
        <button
          onClick={() => navigate("/")}
          className="absolute top-12 left-4 w-10 h-10 rounded-xl bg-white/90 backdrop-blur flex items-center justify-center shadow-lg"
        >
          <ArrowLeft size={20} className="text-[#6B7280]" />
        </button>

        {/* Trip title and info */}
        <div className="absolute bottom-4 left-5 right-5">
          <h1 className="text-white font-black text-2xl mb-1">Bali Adventure 🌴</h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <MapPin size={14} className="text-white/90" />
              <span className="text-white/90 text-xs font-bold">Bali, Indonesia</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar size={14} className="text-white/90" />
              <span className="text-white/90 text-xs font-bold">May 21–25</span>
            </div>
          </div>
        </div>
      </div>

      {/* Set Preference Card */}
      <div className="px-5 mt-4">
        <div className="bg-white rounded-2xl border-2 border-[#10B954] shadow-[0_4px_0_#0D9443] p-5">
          <h3 className="text-[#6B7280] text-xs font-bold uppercase tracking-wide mb-1">
            SET YOUR TRAVEL PREFERENCE
          </h3>
          <p className="text-[#6B7280] text-sm mb-4">
            add your opinion to the group
          </p>
          <DuoButton
            onClick={() => navigate("/preference-budget")}
            variant="primary"
            fullWidth
            className="py-3.5 text-base"
          >
            SET PREFERENCE
          </DuoButton>
        </div>
      </div>

      {/* Members Section */}
      <div className="px-5 pt-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M14.1667 17.5V15.8333C14.1667 14.9493 13.8155 14.1014 13.1904 13.4763C12.5652 12.8512 11.7174 12.5 10.8333 12.5H4.16667C3.28261 12.5 2.43477 12.8512 1.80965 13.4763C1.18453 14.1014 0.833336 14.9493 0.833336 15.8333V17.5" stroke="#A78BFA" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7.50001 9.16667C9.34096 9.16667 10.8333 7.67428 10.8333 5.83333C10.8333 3.99238 9.34096 2.5 7.50001 2.5C5.65906 2.5 4.16667 3.99238 4.16667 5.83333C4.16667 7.67428 5.65906 9.16667 7.50001 9.16667Z" stroke="#A78BFA" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M19.1667 17.5V15.8333C19.1661 15.0948 18.9203 14.3773 18.4679 13.7936C18.0155 13.2099 17.3819 12.793 16.6667 12.6083" stroke="#A78BFA" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M13.3333 2.60834C14.0503 2.79192 14.6858 3.20892 15.1394 3.79359C15.5931 4.37827 15.8394 5.09736 15.8394 5.8375C15.8394 6.57765 15.5931 7.29674 15.1394 7.88141C14.6858 8.46609 14.0503 8.88309 13.3333 9.06667" stroke="#A78BFA" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="font-black text-[#1F302E] text-base">MEMBERS</h2>
          </div>
          <button
            onClick={() => navigate("/invite-friends")}
            className="text-[#1CB0F6] text-sm font-bold"
          >
            Invite +
          </button>
        </div>

        <div className="flex gap-4">
          {members.map((member) => (
            <div key={member.id} className="flex flex-col items-center gap-1">
              <div className="relative">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center font-black text-sm"
                  style={{
                    backgroundColor: member.bgColor,
                    color: member.bgColor === "#10B954" ? "#FFF" : "#6B7280",
                  }}
                >
                  {member.initials}
                </div>
                {member.online && (
                  <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#10B954] rounded-full border-2 border-white" />
                )}
              </div>
              <span className="text-xs text-[#1F302E] font-bold">{member.name}</span>
              {!member.online && (
                <div className="w-2 h-2 rounded-full border-2 border-[#E8E8E8]" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Planning Steps */}
      <div className="px-5 pt-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M14.25 2.25H3.75C2.92157 2.25 2.25 2.92157 2.25 3.75V14.25C2.25 15.0784 2.92157 15.75 3.75 15.75H14.25C15.0784 15.75 15.75 15.0784 15.75 14.25V3.75C15.75 2.92157 15.0784 2.25 14.25 2.25Z" stroke="#8D6E3A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 0.75V3.75" stroke="#8D6E3A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6 0.75V3.75" stroke="#8D6E3A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2.25 6.75H15.75" stroke="#8D6E3A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 className="font-black text-[#1F302E] text-base">PLANNING STEPS</h2>
        </div>

        <div className="flex flex-col gap-2">
          {planningSteps.map((step) => (
            <button
              key={step.id}
              onClick={() => handleStepClick(step)}
              disabled={step.locked}
              className={`bg-white rounded-2xl border-2 border-[#E8E8E8] shadow-[0_3px_0_#C4C4C4] p-4 flex items-center gap-3 transition-all ${
                step.locked ? "opacity-60" : "active:translate-y-0.5 active:shadow-none"
              }`}
            >
              {/* Status icon */}
              <div className="w-[22px] h-[22px] rounded-full border-[3px] border-[#E8E8E8] flex-shrink-0" />

              {/* Label */}
              <span className="flex-1 text-left font-bold text-[#1F302E]">
                {step.label}
              </span>

              {/* Right icon */}
              {step.locked ? (
                <div className="bg-[#f2f2f2] relative rounded-full shrink-0 size-[22px] border-[3px] border-[#E8E8E8] flex items-center justify-center">
                  <Lock size={14} className="text-[#B4B4B4]" />
                </div>
              ) : (
                <ChevronRight size={18} className="text-[#6B7280]" />
              )}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
