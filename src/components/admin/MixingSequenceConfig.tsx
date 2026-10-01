import React, { useState } from "react";
import { Sliders, AlertTriangle, Play, CheckCircle, Info, Zap, HelpCircle, ArrowRight, ShieldAlert } from "lucide-react";

export interface MixingSequenceItem {
  nomor: 1 | 2; // 1 = ON_SAND_DISCHARGE_START, 2 = ON_SAND_DISCHARGE_COMPLETE
  timer: number; // in seconds
}

export interface MixingSequence {
  pasir: MixingSequenceItem;
  air: MixingSequenceItem;
  semen: MixingSequenceItem;
  batu: MixingSequenceItem;
}

interface MixingSequenceConfigProps {
  mixingSequence: MixingSequence;
  setMixingSequence: React.Dispatch<React.SetStateAction<MixingSequence>>;
}

// Subcomponent 1: TimerInput (Glossy industrial numeric control)
interface TimerInputProps {
  value: number;
  onChange: (val: number) => void;
  disabled?: boolean;
}

const TimerInput: React.FC<TimerInputProps> = ({ value, onChange, disabled = false }) => {
  return (
    <div className={`flex items-center bg-[#070b13] border border-slate-800 rounded-[4px] p-0.5 ${disabled ? "opacity-40" : "hover:border-[#00e5ff]/50 transition-colors"}`}>
      <button
        onClick={() => !disabled && onChange(Math.max(0, value - 1))}
        disabled={disabled}
        className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-[#00e5ff] hover:bg-slate-900 rounded-[3px] font-bold text-xs select-none transition-all cursor-pointer"
        title="Kurangi 1 detik"
      >
        -
      </button>
      <input
        type="number"
        value={value}
        min={0}
        disabled={disabled}
        onChange={(e) => {
          const val = parseInt(e.target.value);
          if (!isNaN(val)) onChange(Math.max(0, val));
        }}
        className="w-12 bg-transparent text-center font-mono text-xs font-black text-cyan-400 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0"
      />
      <button
        onClick={() => !disabled && onChange(value + 1)}
        disabled={disabled}
        className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-[#00e5ff] hover:bg-slate-900 rounded-[3px] font-bold text-xs select-none transition-all cursor-pointer"
        title="Tambah 1 detik"
      >
        +
      </button>
    </div>
  );
};

// Subcomponent 2: ProductionEventManager (Internal PLC logic signals view)
const ProductionEventManager: React.FC = () => {
  return (
    <div className="bg-[#0b1322] border border-slate-850 rounded-[4px] p-4 flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2 text-cyan-400 mb-1">
          <Zap size={14} className="animate-pulse" />
          <h5 className="text-[10px] font-sans font-black tracking-wider uppercase">Sistem Event PLC Internal</h5>
        </div>
        <p className="text-[9px] font-mono text-slate-400 uppercase leading-relaxed mb-4">
          Status trigger sequensial timbangan dan gate hopper di modul relay utama.
        </p>

        <div className="space-y-3">
          {/* Event 1 */}
          <div className="flex items-center justify-between bg-[#04080e]/60 border border-slate-900 rounded-[4px] p-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-[8px] font-mono font-black text-cyan-400">
                E1
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-mono font-black text-slate-200">ON_SAND_DISCHARGE_START</span>
                <span className="text-[8px] font-mono text-slate-500">Dicuat saat gate Pasir mulai buka</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded-[4px]">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-[7.5px] font-mono font-black text-cyan-400">READY</span>
            </div>
          </div>

          {/* Event 2 */}
          <div className="flex items-center justify-between bg-[#04080e]/60 border border-slate-900 rounded-[4px] p-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-amber-950 border border-amber-500/50 flex items-center justify-center text-[8px] font-mono font-black text-amber-400">
                E2
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-mono font-black text-slate-200">ON_SAND_DISCHARGE_COMPLETE</span>
                <span className="text-[8px] font-mono text-slate-500">Dicuat saat berat Pasir habis (0 kg)</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded-[4px]">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span className="text-[7.5px] font-mono font-black text-amber-500">STANDBY</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-900 flex items-center gap-2 text-[8px] font-mono text-slate-500 uppercase leading-snug">
        <Info size={12} className="text-cyan-400 shrink-0" />
        <span>Sistem event didukung relay interlock otomatis di bus data RS485 PLC OMRON.</span>
      </div>
    </div>
  );
};

// Subcomponent 3: DischargeScheduler (Dynamic visual Gantt-style timing map)
interface DischargeSchedulerProps {
  mixingSequence: MixingSequence;
}

const DischargeScheduler: React.FC<DischargeSchedulerProps> = ({ mixingSequence }) => {
  // We simulate a grid of 12 seconds.
  const secondsMax = 12;
  const timeLabels = Array.from({ length: secondsMax + 1 }, (_, i) => `${i}s`);

  // To make the visualization beautiful, we assume fixed drainage operations length:
  // Pasir: ~4s, Air: ~3s, Semen: ~4s, Batu: ~3s
  const operationDurations = {
    pasir: 4,
    air: 3,
    semen: 4,
    batu: 3
  };

  const calculateTiming = (mat: 'pasir' | 'air' | 'semen' | 'batu') => {
    const item = mixingSequence[mat];
    let startSec = 0;
    
    if (mat === 'pasir') {
      startSec = 0;
    } else {
      if (item.nomor === 1) {
        startSec = item.timer;
      } else {
        // Starts after sand finishes. Sand duration is 4 seconds.
        startSec = 4 + item.timer;
      }
    }

    const duration = operationDurations[mat];
    return { startSec, duration };
  };

  const materialsList: { id: 'pasir' | 'air' | 'semen' | 'batu'; label: string; color: string }[] = [
    { id: 'pasir', label: 'PASIR', color: '#eab308' },  // Yellow
    { id: 'air', label: 'AIR & ADITIF', color: '#2563eb' }, // Blue
    { id: 'semen', label: 'SEMEN', color: '#94a3b8' }, // Slate gray
    { id: 'batu', label: 'BATU CRUSHED', color: '#ef4444' } // Red
  ];

  return (
    <div className="bg-[#0a0f1d] border border-slate-800 rounded-[4px] p-4 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5 text-cyan-400">
            <Sliders size={14} className="text-cyan-400 animate-pulse" />
            <span className="text-[10px] font-sans font-black tracking-wider uppercase">PETA ESTIMASI WAKTU DISCHARGE</span>
          </div>
          <span className="text-[8px] font-mono text-slate-500 uppercase mt-0.5">Representasi visual urutan pelepasan material di hopper</span>
        </div>
        <div className="flex gap-2.5 text-[8px] font-mono">
          <div className="flex items-center gap-1 text-slate-400">
            <span className="w-2.5 h-1.5 bg-[#122] border border-cyan-800/80 rounded-[1.5px]" />
            <span>DELAY TRANSIT</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <span className="w-2.5 h-1.5 bg-cyan-400 rounded-[1.5px]" />
            <span>OPEN GATE FLOW</span>
          </div>
        </div>
      </div>

      {/* Grid Timeline Scheduler */}
      <div className="flex-1 flex flex-col justify-between mt-2 font-mono text-[9px] relative select-none">
        {/* Timeline Header Labels */}
        <div className="flex border-b border-slate-900 pb-1.5">
          <div className="w-20 text-slate-500 text-left font-black shrink-0">MATERIAL</div>
          <div className="flex-1 grid grid-cols-13 text-center text-slate-500 text-[8px] font-bold">
            {timeLabels.map((lbl, idx) => (
              <span key={idx} className="border-l border-slate-900/40 first:border-l-0">{lbl}</span>
            ))}
          </div>
        </div>

        {/* Timelines list */}
        <div className="flex-1 py-3 flex flex-col justify-around gap-2.5">
          {materialsList.map((m) => {
            const { startSec, duration } = calculateTiming(m.id);
            const rawTimerVal = mixingSequence[m.id].timer;
            const mode = mixingSequence[m.id].nomor;

            // Percentage limits
            const totalSecLimit = secondsMax;
            const startPct = Math.min(100, (startSec / totalSecLimit) * 100);
            const durationPct = Math.min(100 - startPct, (duration / totalSecLimit) * 100);

            // Compute delay segments if applicable
            let delayPct = 0;
            let delayStartPct = 0;
            if (m.id !== 'pasir') {
              if (mode === 1) {
                delayStartPct = 0;
                delayPct = Math.min(100, (rawTimerVal / totalSecLimit) * 105);
              } else {
                // Starts after Pasir ends (at 4s), with delay.
                delayStartPct = (4 / totalSecLimit) * 100;
                delayPct = Math.min(100 - delayStartPct, (rawTimerVal / totalSecLimit) * 100);
              }
            }

            return (
              <div key={m.id} className="flex items-center">
                {/* Material Prefix Label */}
                <div className="w-20 text-left pr-2 text-slate-300 font-extrabold uppercase text-[8.5px] truncate flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                  <span>{m.label}</span>
                </div>

                {/* Progress bar line */}
                <div className="flex-1 bg-slate-950/65 h-6 rounded-[3px] border border-slate-900 relative overflow-hidden flex items-center">
                  
                  {/* Grid grid-lines indicators */}
                  <div className="absolute inset-0 grid grid-cols-13 pointer-events-none">
                    {Array.from({ length: secondsMax + 1 }).map((_, i) => (
                      <div key={i} className="h-full border-r border-[#ffffff04] last:border-r-0" />
                    ))}
                  </div>

                  {/* Delay gray bar */}
                  {delayPct > 0 && (
                    <div
                      className="absolute h-3/5 bg-slate-900/90 border border-dashed border-cyan-900/50 rounded-[2px] transition-all duration-300 ease-out flex items-center justify-center"
                      style={{
                        left: `${delayStartPct}%`,
                        width: `${delayPct}%`
                      }}
                    >
                      <span className="text-[6.5px] text-cyan-400 font-bold tracking-tighter shrink-0 select-none">
                        DLY: {rawTimerVal}s
                      </span>
                    </div>
                  )}

                  {/* Active flow solid color bar */}
                  <div
                    className="absolute h-4/5 rounded-[2px] shadow-sm flex items-center justify-center text-[7px] text-white font-black overflow-hidden transition-all duration-300 ease-out"
                    style={{
                      left: `${startPct}%`,
                      width: `${durationPct}%`,
                      backgroundColor: m.color,
                      boxShadow: `0 0 10px ${m.color}1e`
                    }}
                  >
                    <span className="truncate px-1 tracking-tighter drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)] uppercase flex items-center gap-0.5 leading-none">
                      <Play size={6} className="fill-white" /> FLOW ({m.id === 'pasir' ? '0.0' : startSec.toFixed(1)}s)
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Subcomponent 4: MaterialSequenceEngine (Relational logic diagram)
interface MaterialSequenceEngineProps {
  mixingSequence: MixingSequence;
}

const MaterialSequenceEngine: React.FC<MaterialSequenceEngineProps> = ({ mixingSequence }) => {
  return (
    <div className="bg-[#0b1322] border border-slate-850 rounded-[4px] p-4 flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2 text-cyan-400 mb-1">
          <Sliders size={14} />
          <h5 className="text-[10px] font-sans font-black tracking-wider uppercase">Skema Ketergantungan (Relational)</h5>
        </div>
        <p className="text-[9px] font-mono text-slate-400 uppercase leading-relaxed mb-4">
          Visualisasi dependensi relay kontroler timing berdasarkan data register input saat ini.
        </p>

        <div className="flex flex-col gap-3 font-mono text-[9px]">
          {/* Master trigger */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-[3px] p-2 flex items-center justify-between">
            <span className="text-yellow-400 font-bold">1. PASIR DISCHARGE (M1)</span>
            <span className="text-[7.5px] font-bold text-slate-400 bg-slate-900 border border-slate-800 px-1 py-0.5 rounded uppercase">TRIGGER UTAMA</span>
          </div>

          <div className="flex justify-center -my-1 text-cyan-400/60 font-bold">&#x2193;</div>

          {/* Node Air */}
          <div className="bg-[#060b13] border border-slate-850 rounded-[3px] p-2 flex items-center gap-2">
            <div className="text-[8px] bg-blue-900/50 border border-blue-800/80 text-blue-300 px-1 py-0.5 rounded font-black shrink-0 uppercase">2. AIR</div>
            <ArrowRight size={10} className="text-slate-500" />
            <div className="text-[8.5px] text-left leading-normal text-slate-300 uppercase">
              Urutan: {mixingSequence.air.nomor === 1 ? 'Mulai Pasir' : 'Pasir Selesai'} 
              <span className="text-cyan-400 font-bold font-mono"> +{mixingSequence.air.timer} Detik</span>
            </div>
          </div>

          {/* Node Semen */}
          <div className="bg-[#060b13] border border-slate-850 rounded-[3px] p-2 flex items-center gap-2">
            <div className="text-[8px] bg-slate-900/50 border border-slate-800 text-slate-300 px-1 py-0.5 rounded font-black shrink-0 uppercase">3. SEMEN</div>
            <ArrowRight size={10} className="text-slate-500" />
            <div className="text-[8.5px] text-left leading-normal text-slate-300 uppercase">
              Urutan: {mixingSequence.semen.nomor === 1 ? 'Mulai Pasir' : 'Pasir Selesai'} 
              <span className="text-cyan-400 font-bold font-mono"> +{mixingSequence.semen.timer} Detik</span>
            </div>
          </div>

          {/* Node Batu */}
          <div className="bg-[#060b13] border border-slate-850 rounded-[3px] p-2 flex items-center gap-2">
            <div className="text-[8px] bg-red-900/50 border border-red-850/80 text-red-300 px-1 py-0.5 rounded font-black shrink-0 uppercase">4. BATU</div>
            <ArrowRight size={10} className="text-slate-500" />
            <div className="text-[8.5px] text-left leading-normal text-slate-300 uppercase">
              Urutan: {mixingSequence.batu.nomor === 1 ? 'Mulai Pasir' : 'Pasir Selesai'} 
              <span className="text-cyan-400 font-bold font-mono"> +{mixingSequence.batu.timer} Detik</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-cyan-950/20 border border-cyan-900/30 rounded-[4px] p-2 mt-4 flex items-center gap-2 text-[8px] font-mono text-slate-400">
        <HelpCircle size={12} className="text-[#00e5ff] shrink-0" />
        <span className="text-left leading-normal">
          Ubah isian "Nomor" dan "Timer" pada tabel kustomisasi untuk mengarahkan ulang korelasi diagram logic di sebelah kiri.
        </span>
      </div>
    </div>
  );
};

// Subcomponent 5: MixingSequenceTable (The core interactive card configurator)
export const MixingSequenceTable: React.FC<MixingSequenceConfigProps> = ({
  mixingSequence,
  setMixingSequence
}) => {
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const materials: { id: 'pasir' | 'air' | 'semen' | 'batu'; label: string }[] = [
    { id: 'pasir', label: 'PASIR (M1)' },
    { id: 'air', label: 'AIR & ADITIF (M2)' },
    { id: 'semen', label: 'SEMEN (M3)' },
    { id: 'batu', label: 'BATU / KRIS (M4)' }
  ];

  const handleModeChange = (mat: 'pasir' | 'air' | 'semen' | 'batu', mode: 1 | 2) => {
    // Validation: Pasir must be Mode 1
    if (mat === 'pasir' && mode !== 1) {
      triggerWarning("URUTAN PASIR MUTLAK BERDASARKAN EVENT AWAL (NOMOR = 1). TIDAK BISA DIREFERENSIKAN KEPADA DIRINYA SENDIRI.");
      return;
    }
    
    setMixingSequence(prev => {
      const updated = {
        ...prev,
        [mat]: { ...prev[mat], nomor: mode }
      };
      localStorage.setItem('hmi_mixing_sequence', JSON.stringify(updated));
      return updated;
    });
    setWarningMessage(null);
  };

  const handleTimerChange = (mat: 'pasir' | 'air' | 'semen' | 'batu', seconds: number) => {
    // Validation: Pasir must be 0
    if (mat === 'pasir' && seconds !== 0) {
      triggerWarning("CO-EFFICIENT INTEGRAL TIMER UNTUK PASIR HARUS BERNILAI 0 SEBAGAI BASELINE PROSES SEQUENSING.");
      return;
    }

    if (seconds < 0) {
      triggerWarning("NILAI KOEFISIEN TIMER TIDAK BOLEH BERNILAI NEGATIF.");
      return;
    }

    setMixingSequence(prev => {
      const updated = {
        ...prev,
        [mat]: { ...prev[mat], timer: seconds }
      };
      localStorage.setItem('hmi_mixing_sequence', JSON.stringify(updated));
      return updated;
    });
    setWarningMessage(null);
  };

  const triggerWarning = (msg: string) => {
    setWarningMessage(msg);
    // Auto clear warning after 5 seconds
    setTimeout(() => {
      setWarningMessage((curr) => (curr === msg ? null : curr));
    }, 6000);
  };

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
      {/* Table grid layout card */}
      <div className="bg-[#0b1322] border border-slate-850 rounded-[4px] p-4 flex flex-col relative">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-900">
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-2 text-cyan-400">
              <Sliders size={15} className="text-[#00e5ff]" />
              <h4 className="text-xs font-sans font-black tracking-widest uppercase">Tabel Konfigurasi Urutan Mixing</h4>
            </div>
            <span className="text-[8.5px] font-mono text-slate-500 uppercase mt-1 leading-normal">
              Parameter waktu tunda dan mode discharge yang berjalan pada PLC sequencer mikro.
            </span>
          </div>
          <div className="flex items-center gap-1 bg-[#102a3a]/80 border border-cyan-800/60 px-2 py-0.5 rounded-[3px]">
            <CheckCircle size={10} className="text-[#00e5ff]" />
            <span className="text-[7.5px] font-mono font-black text-cyan-400">PLC SYNC ONLINE</span>
          </div>
        </div>

        {/* Industrial style Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-[10px] border-collapse">
            <thead>
              <tr className="border-b border-slate-900 text-slate-500 text-[8.5px] font-black uppercase">
                <th className="py-2.5 px-2">Material / Aktuator</th>
                <th className="py-2.5 px-2 text-center w-36">Nomor (Mode Trigger)</th>
                <th className="py-2.5 px-2 text-center w-36">Timer (Detik Delay)</th>
                <th className="py-2.5 px-2 text-right">Deskripsi Alur Kejadian</th>
              </tr>
            </thead>
            <tbody className="text-slate-300 divide-y divide-slate-900">
              {materials.map((m) => {
                const item = mixingSequence[m.id];
                const isPasir = m.id === "pasir";
                
                return (
                  <tr key={m.id} className="hover:bg-slate-900/35 transition-colors group">
                    {/* Material Column */}
                    <td className="py-3 px-2 font-bold text-slate-100 uppercase flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 group-hover:animate-ping" />
                      <span>{m.label}</span>
                    </td>

                    {/* Mode Selector Option Column */}
                    <td className="py-3 px-2 text-center">
                      <div className="flex items-center justify-center">
                        <select
                          value={item.nomor}
                          disabled={isPasir}
                          onChange={(e) => handleModeChange(m.id, parseInt(e.target.value) as 1 | 2)}
                          className={`bg-[#05080e] border ${isPasir ? 'border-slate-900 text-slate-500 cursor-not-allowed' : 'border-slate-800 hover:border-cyan-400/50 cursor-pointer text-cyan-400'} text-center font-bold px-2 py-1 rounded-[4px] text-xs font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500 w-32`}
                        >
                          <option value={1}>1 (Mulai Pasir)</option>
                          <option value={2}>2 (Pasir Habis)</option>
                        </select>
                      </div>
                    </td>

                    {/* Timer Numeric Selector Column */}
                    <td className="py-3 px-2">
                      <div className="flex items-center justify-center">
                        <TimerInput
                          value={item.timer}
                          disabled={isPasir}
                          onChange={(val) => handleTimerChange(m.id, val)}
                        />
                      </div>
                    </td>

                    {/* Description Text Column */}
                    <td className="py-3 px-2 text-right text-slate-400 text-[9px] group-hover:text-slate-200 transition-colors uppercase">
                      {isPasir ? (
                        <span className="text-amber-500 font-bold bg-amber-500/5 border border-amber-500/20 px-1.5 py-0.5 rounded-[4px]">
                          BASELINE UTAMA (DETIK 0)
                        </span>
                      ) : (
                        <span>
                          {m.label.split(' ')[0]} mengalir{" "}
                          <span className="text-cyan-400 font-extrabold font-mono">{item.timer} detik</span> setelah{" "}
                          {item.nomor === 1 ? 'pasir dibuka' : 'pasir kosong penuh'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Warning Toast (Industrial Design style) */}
        {warningMessage && (
          <div className="absolute bottom-4 left-4 right-4 bg-[#291e1a] border-2 border-amber-600 rounded-[4px] p-2.5 flex items-start gap-2.5 animate-bounce shadow-[0_4px_12px_rgba(0,0,0,0.5)] z-20">
            <ShieldAlert size={16} className="text-amber-500 mt-0.5 animate-ping shrink-0" />
            <div className="flex flex-col text-left">
              <span className="text-[9px] font-sans font-black text-amber-500 uppercase tracking-widest">PLC LOGICAL EXCEPTION INTERRUPT</span>
              <span className="text-[8px] font-mono text-amber-200 uppercase mt-0.5 leading-snug">{warningMessage}</span>
            </div>
          </div>
        )}
      </div>

      {/* Grid containing related signal analysis subpanels */}
      <div className="grid grid-cols-2 gap-4">
        {/* Dynamic event diagnostic board */}
        <ProductionEventManager />

        {/* Relational logic schema graph representation */}
        <MaterialSequenceEngine mixingSequence={mixingSequence} />
      </div>
    </div>
  );
};

// Main Integrated Config Panel View
export const MixingSequenceConfig: React.FC<MixingSequenceConfigProps> = ({
  mixingSequence,
  setMixingSequence
}) => {
  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-hidden">
      {/* Top scheduler timeline Gantt chart map */}
      <div className="shrink-0">
        <DischargeScheduler mixingSequence={mixingSequence} />
      </div>

      {/* Main configuration grid table */}
      <div className="flex-1 min-h-0 flex flex-col">
        <MixingSequenceTable
          mixingSequence={mixingSequence}
          setMixingSequence={setMixingSequence}
        />
      </div>
    </div>
  );
};
