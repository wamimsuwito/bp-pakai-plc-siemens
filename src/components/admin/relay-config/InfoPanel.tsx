import React from "react";
import { AlertTriangle } from "lucide-react";

export const InfoPanel: React.FC = () => {
  return (
    <div className="bg-[#fefce8] border border-[#fef08a] rounded-[6px] p-2.5 text-slate-800 font-sans shadow-xs shrink-0 select-none text-left flex flex-col justify-between max-h-[140px] overflow-y-auto">
      <div className="flex items-center gap-1.5 text-[#ca8a04] shrink-0">
        <AlertTriangle size={13} className="shrink-0" />
        <span className="text-[10.5px] font-sans font-black tracking-wide uppercase">
          PENTING - SOLENOID PINTU MIXER:
        </span>
      </div>

      <ul className="mt-1 space-y-1 pl-4 list-disc text-[9.5px] leading-tight text-slate-700 flex-1">
        <li>
          <strong className="text-slate-850">Buka (Relay #14, #28, #29):</strong> Buka Bertahap (1 m³, 2 m³, 3.5 m³)
          <div className="pl-3 text-[9px] text-slate-600 leading-normal">
            <strong>Timer 1, 3, 5:</strong> Buka ON (ms) / <strong>Timer 2, 4, 6:</strong> Diam (ms)
            <div className="text-[#b45309] font-semibold">Sequence: 7cm → diam → 24cm → diam → 30cm → diam</div>
          </div>
        </li>
        <li>
          <strong className="text-slate-850">Tutup (Relay #15):</strong> Tutup Penuh
          <div className="pl-3 text-[9px] text-slate-600 leading-normal">
            <strong>Timer 1:</strong> Tutup ON (ms) <span className="text-slate-500 italic">(Aktif setelah siklus buka selesai)</span>
          </div>
        </li>
      </ul>
    </div>
  );
};
