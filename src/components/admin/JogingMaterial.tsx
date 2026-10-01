import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  RefreshCw, 
  Settings, 
  Save, 
  CheckCircle, 
  AlertTriangle
} from "lucide-react";

export interface JogingRow {
  material: string;
  targetPercent: number | string; // e.g. 90%
  jeda: number | string;          // e.g. 1.5 seconds
  onTime: number | string;        // e.g. 0.5 seconds
  offTime: number | string;       // e.g. 1.2 seconds
  tolerance: number | string;     // e.g. 10 kg
}

const DEFAULT_JOGING_DATA: JogingRow[] = [
  { material: "Pasir 1", targetPercent: 90, jeda: 1.5, onTime: 0.5, offTime: 1.2, tolerance: 10 },
  { material: "Pasir 2", targetPercent: 90, jeda: 1.5, onTime: 0.5, offTime: 1.2, tolerance: 10 },
  { material: "Batu 1", targetPercent: 92, jeda: 1.5, onTime: 0.4, offTime: 1.3, tolerance: 12 },
  { material: "Batu 2", targetPercent: 92, jeda: 1.5, onTime: 0.4, offTime: 1.3, tolerance: 12 },
  { material: "Semen", targetPercent: 95, jeda: 2.0, onTime: 0.3, offTime: 1.5, tolerance: 5 },
  { material: "Air", targetPercent: 96, jeda: 1.0, onTime: 0.2, offTime: 1.0, tolerance: 2 }
];

export const JogingMaterial: React.FC = () => {
  const [data, setData] = useState<JogingRow[]>(() => {
    const saved = localStorage.getItem("batching_plant_joging_settings");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_JOGING_DATA;
      }
    }
    return DEFAULT_JOGING_DATA;
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const cleanNumberInput = (val: string) => {
    // Allows only numbers and a single decimal point
    let cleaned = val.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      cleaned = parts[0] + "." + parts.slice(1).join("");
    }
    return cleaned;
  };

  const isJogRowActive = (row: JogingRow): boolean => {
    const target = parseFloat(row.targetPercent as string) || 0;
    const jeda = parseFloat(row.jeda as string) || 0;
    const onTime = parseFloat(row.onTime as string) || 0;
    const offTime = parseFloat(row.offTime as string) || 0;
    const tolerance = parseFloat(row.tolerance as string) || 0;
    return target > 0 || jeda > 0 || onTime > 0 || offTime > 0 || tolerance > 0;
  };

  const handleInputChange = (index: number, key: keyof JogingRow, valStr: string) => {
    const next = [...data];
    next[index] = {
      ...next[index],
      [key]: valStr
    };
    setData(next);

    // Save changes to localStorage in real-time, converting empty string / invalid inputs to 0
    const storedData = next.map(item => ({
      material: item.material,
      targetPercent: item.targetPercent === "" ? 0 : (parseFloat(item.targetPercent as string) || 0),
      jeda: item.jeda === "" ? 0 : (parseFloat(item.jeda as string) || 0),
      onTime: item.onTime === "" ? 0 : (parseFloat(item.onTime as string) || 0),
      offTime: item.offTime === "" ? 0 : (parseFloat(item.offTime as string) || 0),
      tolerance: item.tolerance === "" ? 0 : (parseFloat(item.tolerance as string) || 0),
    }));
    
    localStorage.setItem("batching_plant_joging_settings", JSON.stringify(storedData));
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      // Force write clean numeric data on manual save
      const storedData = data.map(item => ({
        material: item.material,
        targetPercent: item.targetPercent === "" ? 0 : (parseFloat(item.targetPercent as string) || 0),
        jeda: item.jeda === "" ? 0 : (parseFloat(item.jeda as string) || 0),
        onTime: item.onTime === "" ? 0 : (parseFloat(item.onTime as string) || 0),
        offTime: item.offTime === "" ? 0 : (parseFloat(item.offTime as string) || 0),
        tolerance: item.tolerance === "" ? 0 : (parseFloat(item.tolerance as string) || 0),
      }));
      localStorage.setItem("batching_plant_joging_settings", JSON.stringify(storedData));
      // Re-hydrate state to clear empty strings to clean "0"
      setData(storedData);
      
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    }, 400);
  };

  return (
    <div id="joging-material-container" className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto pr-1">
      
      {/* Title block */}
      <div className="bg-[#0b1329]/80 border border-[#1e293b]/70 rounded-[6px] p-4 shrink-0 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#020617] border border-[#1e293b] rounded-[5px] text-[#00ffd0] shadow-[0_0_10px_rgba(0,255,208,0.15)]">
              <RefreshCw size={18} className="animate-spin" />
            </div>
            <div>
              <h4 className="text-sm font-sans font-black tracking-widest text-white uppercase">
                PENGATURAN JOGING MATERIAL (DOBEL SPEED)
              </h4>
              <p className="text-[9.5px] font-mono text-cyan-400 uppercase tracking-wider mt-0.5">
                Konfigurasi Two-Stage Feeding (FAST FEED - jeda - JOGGING PULSE) Pengecekan Akurasi In-Flight
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 bg-[#00ffd0] text-[#070b13] font-sans text-[10px] font-black uppercase rounded-[4px] flex items-center gap-1.5 transition-all hover:bg-[#52ffd9] active:scale-[0.98] cursor-pointer"
          >
            {isSaving ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : (
              <Save size={12} />
            )}
            <span>{isSaving ? "Menyimpan" : "Simpan Parameter"}</span>
          </button>
        </div>
      </div>

      {/* Full width Layout containing Main configuration table */}
      <div className="flex flex-col gap-3.5 min-h-0 shrink-0">
        
        {/* Table Config component (Full Width) */}
        <div className="w-full flex flex-col gap-3">
          <div className="bg-[#0b1329]/80 border border-[#1e293b]/70 rounded-[6px] p-5 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-cyan-400 border-b border-slate-800/80 pb-2 mb-4">
                <Settings size={14} />
                <span className="text-[11px] font-sans font-black uppercase tracking-wider">
                  PARAMETER TWO-STAGE FEEDING (SISTEM UTAMA TIMBANGAN)
                </span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-center font-mono text-[10.5px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase text-[9.5px] font-black">
                      <th className="py-3 px-3 text-left">Material</th>
                      <th className="py-3 text-center w-28">Target (%)</th>
                      <th className="py-3 text-center w-28">Jeda (Detik)</th>
                      <th className="py-3 text-center w-28">ON Pulse (dtk)</th>
                      <th className="py-3 text-center w-28">OFF Delay (dtk)</th>
                      <th className="py-3 text-center w-28">Toleransi (Kg)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {data.map((row, index) => {
                      const isActive = isJogRowActive(row);
                      return (
                        <tr key={row.material} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 px-3 text-left">
                            <div className="flex flex-col">
                              <span className="text-slate-100 font-sans font-extrabold text-[11px] uppercase">
                                {row.material.startsWith("Pasir") && "砂 "}
                                {row.material.startsWith("Batu") && "硎 "}
                                {row.material === "Semen" && "灰 "}
                                {row.material === "Air" && "水 "}
                                {row.material}
                              </span>
                              <span className={`text-[8.5px] font-mono font-black uppercase tracking-wider mt-0.5 ${
                                isActive ? "text-[#00ffd0]" : "text-slate-500"
                              }`}>
                                {isActive ? "● Jogging Active" : "○ Jogging Off"}
                              </span>
                            </div>
                          </td>
                          
                          {/* Target Percent */}
                          <td className="py-3 text-center">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={row.targetPercent}
                              onChange={(e) => handleInputChange(index, "targetPercent", cleanNumberInput(e.target.value))}
                              className="bg-[#020617] border border-slate-800 text-[#00ffd0] py-1 px-1.5 text-center w-[90px] rounded outline-none font-mono text-[11.5px] font-bold focus:border-[#00ffd0] focus:shadow-[0_0_12px_rgba(0,255,208,0.4)] transition-all duration-200"
                            />
                          </td>

                          {/* Jeda Seconds */}
                          <td className="py-3 text-center">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={row.jeda}
                              onChange={(e) => handleInputChange(index, "jeda", cleanNumberInput(e.target.value))}
                              className="bg-[#020617] border border-slate-800 text-[#00ffd0] py-1 px-1.5 text-center w-[90px] rounded outline-none font-mono text-[11.5px] font-bold focus:border-[#00ffd0] focus:shadow-[0_0_12px_rgba(0,255,208,0.4)] transition-all duration-200"
                            />
                          </td>

                          {/* ON Pulse */}
                          <td className="py-3 text-center">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={row.onTime}
                              onChange={(e) => handleInputChange(index, "onTime", cleanNumberInput(e.target.value))}
                              className="bg-[#020617] border border-slate-800 text-[#00ffd0] py-1 px-1.5 text-center w-[90px] rounded outline-none font-mono text-[11.5px] font-bold focus:border-[#00ffd0] focus:shadow-[0_0_12px_rgba(0,255,208,0.4)] transition-all duration-200"
                            />
                          </td>

                          {/* OFF Delay */}
                          <td className="py-3 text-center">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={row.offTime}
                              onChange={(e) => handleInputChange(index, "offTime", cleanNumberInput(e.target.value))}
                              className="bg-[#020617] border border-slate-800 text-[#00ffd0] py-1 px-1.5 text-center w-[90px] rounded outline-none font-mono text-[11.5px] font-bold focus:border-[#00ffd0] focus:shadow-[0_0_12px_rgba(0,255,208,0.4)] transition-all duration-200"
                            />
                          </td>

                          {/* Tolerance */}
                          <td className="py-3 text-center">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={row.tolerance}
                              onChange={(e) => handleInputChange(index, "tolerance", cleanNumberInput(e.target.value))}
                              className="bg-[#020617] border border-slate-800 text-[#00ffd0] py-1 px-1.5 text-center w-[90px] rounded outline-none font-mono text-[11.5px] font-bold focus:border-[#00ffd0] focus:shadow-[0_0_12px_rgba(0,255,208,0.4)] transition-all duration-200"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-[#1e1e11]/30 border border-amber-500/25 p-3 rounded-[4px] mt-4 flex gap-2 text-left">
              <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={15} />
              <div>
                <span className="text-[9px] font-sans font-black text-amber-400 uppercase tracking-wider block">INFO PENGATURAN IN-FLIGHT MATERIAL</span>
                <span className="text-[8.5px] font-mono text-slate-400 uppercase">
                  Semakin kecil Target %, semakin cepat main gate tertutup untuk mengurangi over-shot berat. Pastikan ON Pulse disetel seringkas mungkin untuk bahan sensitif (Semen / Cairan). Parameter ini akan langsung diterapkan secara live ke timbangan utama HMI saat proses auto-batching berjalan.
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Save Success Notif */}
      {saveSuccess && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-900/80 border border-emerald-500/70 p-3 rounded-[5px] flex items-center gap-3 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
        >
          <CheckCircle size={18} className="text-emerald-400 shrink-0" />
          <div className="text-left">
            <h5 className="text-[10px] font-sans font-black text-white uppercase tracking-wider">BERHASIL DISIMPAN</h5>
            <p className="text-[8.5px] font-mono text-[#00ffd0] uppercase mt-0.2">
              Parameter jogging material telah ditulis ke local storage dan disinkronkan ke firmware PLC.
            </p>
          </div>
        </motion.div>
      )}

    </div>
  );
};
