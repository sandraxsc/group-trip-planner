import { Outlet } from "react-router";

export default function Root() {
  return (
    <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center">
      <div className="w-full max-w-[402px] min-h-screen bg-white relative overflow-x-hidden">
        <Outlet />
      </div>
    </div>
  );
}
