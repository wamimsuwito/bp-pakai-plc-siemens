import React from "react";
import { Factory, Droplet, Users, Radio } from "lucide-react";

interface DashboardCardsProps {
  isSystemOnline?: boolean;
  totalBatch?: number;
  totalVolume?: number;
  totalCustomer?: number;
}

export const DashboardCards: React.FC<DashboardCardsProps> = ({
  isSystemOnline = true,
  totalBatch = 0,
  totalVolume = 0,
  totalCustomer = 0
}) => {
  return (
    <div className="grid grid-cols-4 gap-4 w-full select-none shrink-0">
      {/* 1. Produksi Hari Ini */}
      <div className="bg-[#0b1329]/80 border border-[#1e293b]/70 hover:border-cyan-500/20 rounded-[6px] p-4.5 flex flex-col justify-between relative overflow-hidden transition-all duration-300 shadow-md">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <span className="text-[11px] font-sans font-bold tracking-wider text-slate-300 uppercase">
              Produksi Hari Ini
            </span>
            <span className="text-xl font-sans font-black text-white mt-1">
              {totalBatch} Batch
            </span>
          </div>
          <Factory size={16} className="text-slate-400 opacity-60 mt-0.5" />
        </div>
        <span className="text-[9px] font-sans font-medium text-slate-500 uppercase tracking-wide mt-2">
          Total mixing hari ini
        </span>
      </div>

      {/* 2. Volume Hari Ini */}
      <div className="bg-[#0b1329]/80 border border-[#1e293b]/70 hover:border-cyan-500/20 rounded-[6px] p-4.5 flex flex-col justify-between relative overflow-hidden transition-all duration-300 shadow-md">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <span className="text-[11px] font-sans font-bold tracking-wider text-slate-300 uppercase">
              Volume Hari Ini
            </span>
            <span className="text-xl font-sans font-black text-white mt-1">
              {totalVolume.toFixed(1)} M³
            </span>
          </div>
          <Droplet size={16} className="text-[#00ffd0] opacity-60 mt-0.5" />
        </div>
        <span className="text-[9px] font-sans font-medium text-slate-500 uppercase tracking-wide mt-2">
          Total volume beton
        </span>
      </div>

      {/* 3. Customer Aktif */}
      <div className="bg-[#0b1329]/80 border border-[#1e293b]/70 hover:border-cyan-500/20 rounded-[6px] p-4.5 flex flex-col justify-between relative overflow-hidden transition-all duration-300 shadow-md">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <span className="text-[11px] font-sans font-bold tracking-wider text-slate-300 uppercase">
              Customer Aktif
            </span>
            <span className="text-xl font-sans font-black text-white mt-1">
              {totalCustomer}
            </span>
          </div>
          <Users size={16} className="text-slate-400 opacity-60 mt-0.5" />
        </div>
        <span className="text-[9px] font-sans font-medium text-slate-500 uppercase tracking-wide mt-2">
          Pelanggan hari ini
        </span>
      </div>

      {/* 4. Status Sistem */}
      <div className="bg-[#0b1329]/80 border border-[#1e293b]/70 hover:border-cyan-500/20 rounded-[6px] p-4.5 flex flex-col justify-between relative overflow-hidden transition-all duration-300 shadow-md">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <span className="text-[11px] font-sans font-bold tracking-wider text-slate-300 uppercase">
              Status Sistem
            </span>
            <span className={`text-xl font-sans font-black tracking-wide mt-1 ${isSystemOnline ? 'text-emerald-400' : 'text-red-400'}`}>
              {isSystemOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          {/* Circular flashing indicator dot */}
          <div className="flex items-center gap-1.5 pt-1.5">
            <span className={`w-2 h-2 rounded-full ${isSystemOnline ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]' : 'bg-red-500 animate-pulse shadow-[0_0_8px_#f87171]'}`} />
          </div>
        </div>
        <span className="text-[9px] font-sans font-medium text-slate-500 uppercase tracking-wide mt-2">
          {isSystemOnline ? 'Sistem berjalan normal' : 'Hubungan terputus'}
        </span>
      </div>
    </div>
  );
};
