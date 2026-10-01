import React from "react";
import { RelayRow } from "./ConfigState";
import { TimerInput } from "./TimerInput";

interface RelayTableProps {
  rows: RelayRow[];
  onRowChange: (index: number, updatedField: keyof RelayRow, newVal: string) => void;
  activePins?: Record<string, boolean>;
}

export const RelayTable: React.FC<RelayTableProps> = ({ rows, onRowChange, activePins }) => {
  return (
    <div className="flex-1 min-h-[220px] flex flex-col bg-[#0b1329]/95 border border-[#1e293b]/80 rounded-[8px] overflow-hidden shadow-2xl select-none">
      {/* Horizontal Scroll Wrapper to prevent columns squishing */}
      <div className="flex-1 flex flex-col min-h-0 overflow-x-auto scrollbar-thin">
        <div className="min-w-[1050px] flex-1 flex flex-col min-h-0">
          
          {/* Table Headers (Sticky Area) */}
          <div className="w-full bg-[#0c152a] border-b border-slate-800/90 py-2.5 px-4 grid grid-cols-[1.5fr_0.6fr_0.9fr_1.1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 text-slate-400 font-sans font-black text-[9.5px] tracking-wider uppercase select-none">
            <div className="text-left flex items-center">Nama Component</div>
            <div className="text-center flex items-center justify-center">Relay #</div>
            <div className="text-center flex items-center justify-center">Modbus Coil</div>
            <div className="text-center text-cyan-400 font-extrabold flex items-center justify-center">Pin Arduino</div>
            <div className="text-center flex flex-col justify-center">Timer 1 <span className="text-slate-500 font-semibold block text-[7.5px] leading-tight">(Buka 1 - ms)</span></div>
            <div className="text-center flex flex-col justify-center">Timer 2 <span className="text-slate-500 font-semibold block text-[7.5px] leading-tight">(Diam 1 - ms)</span></div>
            <div className="text-center flex flex-col justify-center">Timer 3 <span className="text-slate-500 font-semibold block text-[7.5px] leading-tight">(Buka 2 - ms)</span></div>
            <div className="text-center flex flex-col justify-center">Timer 4 <span className="text-slate-500 font-semibold block text-[7.5px] leading-tight">(Diam 2 - ms)</span></div>
            <div className="text-center flex flex-col justify-center">Timer 5 <span className="text-slate-500 font-semibold block text-[7.5px] leading-tight">(Buka 3 - ms)</span></div>
            <div className="text-center flex flex-col justify-center">Timer 6 <span className="text-slate-500 font-semibold block text-[7.5px] leading-tight">(Diam 3 - ms)</span></div>
          </div>

          {/* Dynamic Scrollable Rows Part */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-900/60">
            {rows.map((row, idx) => {
              const isActive = activePins && row.arduinoPin ? !!activePins[row.arduinoPin] : false;
              return (
                <div
                  key={row.relay}
                  className={`px-4 h-[42px] grid grid-cols-[1.5fr_0.6fr_0.9fr_1.1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 items-center hover:bg-slate-800/15 transition-all text-slate-100 ${
                    isActive ? "bg-emerald-950/10" : ""
                  }`}
                >
                  {/* Relay Name */}
                  <div className="text-left font-sans font-black text-white text-[11px] tracking-wide truncate flex items-center gap-1.5 animate-fade-in">
                    <span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${
                      isActive ? "bg-[#00ffd0] animate-pulse shadow-[0_0_8px_#00ffd0]" : "bg-slate-700"
                    }`} />
                    {row.name}
                  </div>

                  {/* Relay Number */}
                  <div className="flex items-center justify-center">
                    <div className="w-[32px] h-[26px] bg-[#0c1220] border border-slate-800/70 rounded-[4px] font-mono text-[10px] font-black text-slate-400 flex items-center justify-center">
                      #{row.relay}
                    </div>
                  </div>

                  {/* Modbus Coil */}
                  <div className="flex items-center justify-center">
                    <input
                      type="text"
                      value={row.modbusCoil}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        onRowChange(idx, "modbusCoil", val);
                      }}
                      className="w-[60px] h-[26px] bg-white border border-[#cbd5e1] focus:ring-2 focus:ring-[#00e5ff] text-slate-900 font-mono font-black text-[11px] rounded-[3px] text-center outline-hidden transition-all shadow-sm"
                    />
                  </div>

                  {/* Pin Arduino Input */}
                  <div className="flex items-center justify-center">
                    <input
                      type="text"
                      value={row.arduinoPin}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        onRowChange(idx, "arduinoPin", val);
                      }}
                      className="w-[64px] h-[26px] bg-[#070b13] border border-slate-800 focus:border-cyan-400 focus:shadow-[0_0_6px_rgba(34,211,238,0.2)] text-cyan-400 font-mono font-black text-[11px] rounded-[3px] text-center outline-hidden transition-all"
                    />
                  </div>

                  {/* Timer 1 */}
                  <div className="flex items-center justify-center">
                    <TimerInput
                      value={row.timer1}
                      onChange={(val) => onRowChange(idx, "timer1", val)}
                    />
                  </div>

                  {/* Timer 2 */}
                  <div className="flex items-center justify-center">
                    <TimerInput
                      value={row.timer2}
                      onChange={(val) => onRowChange(idx, "timer2", val)}
                    />
                  </div>

                  {/* Timer 3 */}
                  <div className="flex items-center justify-center">
                    <TimerInput
                      value={row.timer3}
                      onChange={(val) => onRowChange(idx, "timer3", val)}
                    />
                  </div>

                  {/* Timer 4 */}
                  <div className="flex items-center justify-center">
                    <TimerInput
                      value={row.timer4}
                      onChange={(val) => onRowChange(idx, "timer4", val)}
                    />
                  </div>

                  {/* Timer 5 */}
                  <div className="flex items-center justify-center">
                    <TimerInput
                      value={row.timer5}
                      onChange={(val) => onRowChange(idx, "timer5", val)}
                    />
                  </div>

                  {/* Timer 6 */}
                  <div className="flex items-center justify-center">
                    <TimerInput
                      value={row.timer6}
                      onChange={(val) => onRowChange(idx, "timer6", val)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
