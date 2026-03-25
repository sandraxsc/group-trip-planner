import { useNavigate, useLocation } from "react-router";
import { Home, Map, Star, User } from "lucide-react";

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const items = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Map, label: "Trips", path: "/trip-detail" },
    { icon: Star, label: "Explore", path: "/vote" },
    { icon: User, label: "Profile", path: "/profile" },
  ];

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[402px] bg-white border-t-2 border-[#E5E5E5] flex items-center justify-around px-4 py-2 z-50">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-colors ${
              isActive ? "text-[#58CC02]" : "text-[#AFAFAF]"
            }`}
          >
            <Icon
              size={24}
              strokeWidth={isActive ? 2.5 : 2}
              fill={isActive ? "#58CC02" : "none"}
            />
            <span className={`text-xs font-bold ${isActive ? "text-[#58CC02]" : "text-[#AFAFAF]"}`}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
