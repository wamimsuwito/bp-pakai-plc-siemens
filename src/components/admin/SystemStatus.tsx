import React from "react";

interface SystemStatusProps {
  username?: string;
  role?: string;
  storageMode?: string;
}

export const SystemStatus: React.FC<SystemStatusProps> = ({
  username = "admin",
  role = "admin",
  storageMode = "Offline - Local Storage"
}) => {
  return (
    <div className="grid grid-cols-2 gap-4 w-full select-none shrink-0">
      {/* Left: Mode Penyimpanan */}
      <div className="bg-[#0b1329]/80 border border-[#1e293b]/70 hover:border-cyan-500/20 rounded-[6px] p-4.5 flex flex-col justify-between transition-all duration-300 shadow-md">
        <div>
          <h4 className="text-[11px] font-sans font-black tracking-wider text-slate-200 uppercase">
            Mode Penyimpanan
          </h4>
          <span className="text-[8.5px] font-sans font-medium text-slate-500 uppercase tracking-wide">
            Lokasi penyimpanan data
          </span>
        </div>

        <div className="mt-4">
          <span className="text-[12px] font-mono font-black text-[#00ffd0] tracking-wide uppercase">
            {storageMode}
          </span>
        </div>
      </div>

      {/* Right: User Login */}
      <div className="bg-[#0b1329]/80 border border-[#1e293b]/70 hover:border-cyan-500/20 rounded-[6px] p-4.5 flex flex-col justify-between transition-all duration-300 shadow-md">
        <div>
          <h4 className="text-[11px] font-sans font-black tracking-wider text-slate-200 uppercase">
            User Login
          </h4>
          <span className="text-[8.5px] font-sans font-medium text-slate-500 uppercase tracking-wide">
            Informasi user aktif
          </span>
        </div>

        <div className="mt-2.5 flex flex-col leading-snug">
          <span className="text-[12px] font-bold text-white uppercase tracking-wider font-mono">
            {username}
          </span>
          <span className="text-[9.5px] font-sans font-bold text-slate-400 capitalize">
            Role: {role}
          </span>
        </div>
      </div>
    </div>
  );
};
