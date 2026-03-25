import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { ArrowLeft, MapPin, X, Plus } from "lucide-react";
import { DuoButton } from "../components/DuoButton";
import { PreferenceProgressHeader } from "../components/PreferenceProgressHeader";

interface Place {
  id: string;
  name: string;
  subtitle: string;
  image: string;
}

export default function PreferencePlaceScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as { tripId?: string; memberId?: string }) ?? {};
  const [addedPlaces, setAddedPlaces] = useState<Place[]>([]);

  // Load places from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem("selectedPlaces");
    if (stored) {
      setAddedPlaces(JSON.parse(stored));
    }
  }, []);

  // Save to sessionStorage whenever addedPlaces changes
  useEffect(() => {
    sessionStorage.setItem("selectedPlaces", JSON.stringify(addedPlaces));
  }, [addedPlaces]);

  const removePlace = (id: string) => {
    setAddedPlaces((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-[#FFF8F0] to-[#F0FFF4]">
      <PreferenceProgressHeader
        currentStep={5}
        totalSteps={6}
        title={"Add some places that you want to go"}
        leftSlot={
          <button
            onClick={() => navigate("/preference-time", { state })}
            className="w-10 h-10 rounded-xl bg-white border-2 border-[#E5E5E5] flex items-center justify-center shadow-[0_3px_0_#D4D4D4] active:translate-y-0.5 active:shadow-none transition-all"
          >
            <ArrowLeft size={20} className="text-[#4B4B4B]" />
          </button>
        }
      />

      {/* Avatar Area */}
      <div className="flex items-center justify-center px-5 pb-6">
        <div className="relative">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center border-4 border-[#CE82FF] shadow-[0_4px_0_#A760D8]">
            <MapPin size={32} className="text-[#CE82FF]" strokeWidth={2} />
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="px-5 mb-2" />

      {/* Added Places */}
      <div className="flex-1 px-5 pb-6 overflow-y-auto">
        {addedPlaces.map((place) => (
          <div
            key={place.id}
            className="bg-white rounded-2xl border-2 border-[#E5E5E5] shadow-[0_4px_0_#D4D4D4] p-4 mb-3 flex items-center gap-4"
          >
            {/* Content */}
            <div className="flex-1">
              <h3 className="font-black text-[#3C3C3C] text-lg mb-1">
                {place.name}
              </h3>
              <p className="font-bold text-[#AFAFAF] text-sm">
                {place.subtitle}
              </p>
            </div>

            {/* Image */}
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#F0F0F0] flex-shrink-0">
              <img
                src={place.image}
                alt={place.name}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Remove Button */}
            <button
              onClick={() => removePlace(place.id)}
              className="w-8 h-8 rounded-full bg-[#F0F0F0] hover:bg-[#FF4B4B] hover:text-white text-[#3C3C3C] flex items-center justify-center transition-colors flex-shrink-0"
            >
              <X size={18} strokeWidth={3} />
            </button>
          </div>
        ))}

        {/* Add Button */}
        <button
          onClick={() => navigate("/preference-place-search")}
          className="w-full border-2 border-dashed border-[#1CB0F6] rounded-2xl p-6 flex flex-col items-center justify-center gap-2 bg-[#F0F9FF] transition-all"
        >
          <div className="w-12 h-12 rounded-full bg-[#1CB0F6] flex items-center justify-center transition-colors">
            <Plus
              size={24}
              className="text-white transition-colors"
              strokeWidth={3}
            />
          </div>
          <p className="font-bold text-[#1CB0F6] text-sm transition-colors">
            Add places you're interested in
          </p>
        </button>
      </div>

      {/* Continue Button */}
      <div className="px-5 pb-8">
        <DuoButton
          onClick={() => navigate("/preference-deal-breaker", { state })}
          variant="primary"
          fullWidth
          className="py-4 text-base"
          disabled={addedPlaces.length === 0}
        >
          Continue →
        </DuoButton>
      </div>
    </div>
  );
}