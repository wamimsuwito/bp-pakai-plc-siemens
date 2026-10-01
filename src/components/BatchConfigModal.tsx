import React, { useState, useEffect } from "react";
import { X, AlertTriangle, ChevronDown } from "lucide-react";
import { motion } from "motion/react";

export interface Recipe {
  id: string;
  name: string;
  targets: Record<string, number>;
}

interface BatchConfigModalProps {
  recipes: Recipe[];
  onClose: () => void;
  siloWeights?: number[];
  jumlahSilo?: number;
  onConfirm: (config: {
    recipe: Recipe;
    volume: number;
    mixingCycles: number;
    slump: string;
    siloSemen: string;
    mixingTime: number;
    pelanggan: string;
    lokasi: string;
    noKendaraan: string;
    sopir: string;
  }) => void;
}

export const BatchConfigModal: React.FC<BatchConfigModalProps> = ({
  recipes,
  onClose,
  siloWeights,
  jumlahSilo = 6,
  onConfirm,
}) => {
  // State variables for fields
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>("");
  const [volume, setVolume] = useState<string>("");
  const [jumlahMixing, setJumlahMixing] = useState<string>("");
  const [slump, setSlump] = useState<string>("12 cm");
  const [siloSemen, setSiloSemen] = useState<string>(() => {
    return localStorage.getItem('active_silo_semen') || "Silo 3 - 28.290 kg";
  });

  useEffect(() => {
    const match = siloSemen.match(/Silo\s*(\d+)/i);
    if (match && siloWeights) {
      const idx = parseInt(match[1], 10) - 1;
      if (idx >= 0 && idx < jumlahSilo) {
        const currentWeight = siloWeights[idx];
        setSiloSemen(`Silo ${idx + 1} - ${currentWeight.toLocaleString('id-ID')} kg`);
      }
    }
  }, [siloWeights]);

  const [mixingTime, setMixingTime] = useState<string>(() => {
    return localStorage.getItem('active_mixing_time') || "10";
  });

  // Save mixingTime to localStorage when changed
  useEffect(() => {
    if (mixingTime) {
      localStorage.setItem('active_mixing_time', mixingTime);
    }
  }, [mixingTime]);
  const [pelanggan, setPelanggan] = useState<string>("");
  const [lokasi, setLokasi] = useState<string>("");
  const [noKendaraan, setNoKendaraan] = useState<string>("");
  const [sopir, setSopir] = useState<string>("");

  // Manage whether volume-to-mixing auto-calculation has been manually overridden
  const [isMixingOverridden, setIsMixingOverridden] = useState(false);

  // Auto calculate "Jumlah Mixing" from "Volume" unless overridden
  useEffect(() => {
    if (!isMixingOverridden) {
      const volNum = parseFloat(volume);
      if (!isNaN(volNum) && volNum > 0) {
        // Mixer Twin Shaft memiliki kapasitas maksimal: 3.5 m³ per mixing
        const autoMixing = Math.ceil(volNum / 3.5);
        setJumlahMixing(autoMixing.toString());
      } else {
        setJumlahMixing("");
      }
    }
  }, [volume, isMixingOverridden]);

  // Validation
  const missingFields: string[] = [];
  if (!selectedRecipeId) missingFields.push("Mutu Beton");
  if (!volume || isNaN(parseFloat(volume)) || parseFloat(volume) <= 0) missingFields.push("Volume");
  if (!jumlahMixing || isNaN(parseInt(jumlahMixing)) || parseInt(jumlahMixing) <= 0) missingFields.push("Jumlah Mixing");
  if (!slump) missingFields.push("Slump");
  if (!siloSemen) missingFields.push("Pilih Silo Semen");
  if (!mixingTime || isNaN(parseInt(mixingTime)) || parseInt(mixingTime) <= 0) missingFields.push("Waktu Mixing");

  const isFormComplete = missingFields.length === 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormComplete) return;

    const recipe = recipes.find((r) => r.id === selectedRecipeId);
    if (!recipe) return;

    onConfirm({
      recipe,
      volume: parseFloat(volume),
      mixingCycles: parseInt(jumlahMixing),
      slump,
      siloSemen,
      mixingTime: parseInt(mixingTime),
      pelanggan,
      lokasi,
      noKendaraan,
      sopir,
    });
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: "spring", duration: 0.4 }}
        className="relative w-full max-w-[430px] h-[92vh] max-h-[820px] bg-[#0c111e] border border-slate-800 rounded-[8px] shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden text-left"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800/80 sticky top-0 bg-[#0c111e] z-10 shrink-0">
          <h2 className="text-white font-sans font-black text-[15px] tracking-wide uppercase select-none">
            Konfigurasi Batch
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer p-0.5"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Container Form */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-slate-900/60"
        >
          {/* Mutu Beton Dropdown */}
          <div className="space-y-1.5">
            <label className="block text-slate-350 text-[11.5px] font-bold font-sans">
              Mutu Beton <span className="text-red-500 font-black">*</span>
            </label>
            <div className="relative">
              <select
                value={selectedRecipeId}
                onChange={(e) => setSelectedRecipeId(e.target.value)}
                className="w-full h-[38px] bg-[#070b13] border border-slate-800 hover:border-slate-700 focus:border-cyan-400 focus:shadow-[0_0_8px_rgba(34,211,238,0.25)] text-white text-[12px] font-sans rounded-[4px] px-3.5 pr-10 outline-hidden appearance-none transition-all cursor-pointer"
              >
                <option value="" disabled className="text-slate-500 italic bg-[#0c111e]">Pilih mutu beton</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id} className="text-white bg-[#0c111e] py-1.5">
                    {r.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3.5 top-[12px] text-slate-500 pointer-events-none"
              />
            </div>
          </div>

          {/* Volume and Jumlah Mixing Row */}
          <div className="grid grid-cols-2 gap-3.5">
            {/* Volume */}
            <div className="space-y-1.5">
              <label className="block text-slate-350 text-[11.5px] font-bold font-sans">
                Volume (m³) <span className="text-red-500 font-black">*</span>
              </label>
              <input
                type="text"
                placeholder="Masukkan volume"
                value={volume}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9.]/g, "");
                  setVolume(cleaned);
                }}
                className="w-full h-[38px] bg-[#070b13] border border-slate-800 hover:border-slate-700 focus:border-cyan-400 focus:shadow-[0_0_8px_rgba(34,211,238,0.25)] text-white text-[12px] font-mono rounded-[4px] px-3 outline-hidden transition-all placeholder:text-slate-600 placeholder:italic placeholder:font-sans"
              />
            </div>

            {/* Jumlah Mixing */}
            <div className="space-y-1.5">
              <label className="block text-slate-350 text-[11.5px] font-bold font-sans">
                Jumlah Mixing <span className="text-red-500 font-black">*</span>
              </label>
              <input
                type="text"
                value={jumlahMixing}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9]/g, "");
                  setJumlahMixing(cleaned);
                  setIsMixingOverridden(true);
                }}
                className="w-full h-[38px] bg-[#070b13] border border-slate-800 hover:border-slate-700 focus:border-cyan-400 focus:shadow-[0_0_8px_rgba(34,211,238,0.25)] text-white text-[12px] font-mono rounded-[4px] px-3 outline-hidden transition-all"
              />
              <span className="block text-[9.5px] font-sans text-slate-500 mt-0.5 select-none font-medium italic">
                ↑ auto dari volume
              </span>
            </div>
          </div>

          {/* Slump Dropdown */}
          <div className="space-y-1.5">
            <label className="block text-slate-350 text-[11.5px] font-bold font-sans">
              Slump <span className="text-red-500 font-black">*</span>
            </label>
            <div className="relative">
              <select
                value={slump}
                onChange={(e) => setSlump(e.target.value)}
                className="w-full h-[38px] bg-[#070b13] border border-slate-800 hover:border-slate-700 focus:border-cyan-400 focus:shadow-[0_0_8px_rgba(34,211,238,0.25)] text-white text-[12px] font-sans rounded-[4px] px-3.5 pr-10 outline-hidden appearance-none transition-all cursor-pointer"
              >
                <option value="8 cm" className="bg-[#0c111e]">8 cm</option>
                <option value="10 cm" className="bg-[#0c111e]">10 cm</option>
                <option value="12 cm" className="bg-[#0c111e]">12 cm</option>
                <option value="14 cm" className="bg-[#0c111e]">14 cm</option>
                <option value="16 cm" className="bg-[#0c111e]">16 cm</option>
                <option value="18 cm" className="bg-[#0c111e]">18 cm</option>
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3.5 top-[12px] text-slate-500 pointer-events-none"
              />
            </div>
          </div>

          {/* Pilih Silo Semen Dropdown */}
          <div className="space-y-1.5">
            <label className="block text-slate-350 text-[11.5px] font-bold font-sans">
              Pilih Silo Semen <span className="text-red-500 font-black">*</span>
            </label>
            <div className="relative">
              <select
                value={siloSemen}
                onChange={(e) => setSiloSemen(e.target.value)}
                className="w-full h-[38px] bg-[#070b13] border border-slate-800 hover:border-slate-700 focus:border-cyan-400 focus:shadow-[0_0_8px_rgba(34,211,238,0.25)] text-white text-[12px] font-sans rounded-[4px] px-3.5 pr-10 outline-hidden appearance-none transition-all cursor-pointer"
              >
                {[...Array(jumlahSilo)].map((_, idx) => {
                  const weightVal = siloWeights && siloWeights[idx] !== undefined ? siloWeights[idx] : [85000, 110000, 45000, 95000, 60000, 30000, 50000, 40000][idx];
                  const valStr = `Silo ${idx + 1} - ${weightVal.toLocaleString('id-ID')} kg`;
                  return (
                    <option key={idx} value={valStr} className="bg-[#0c111e]">
                      {valStr}
                    </option>
                  );
                })}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3.5 top-[12px] text-slate-500 pointer-events-none"
              />
            </div>
          </div>

          {/* Waktu Mixing (detik) */}
          <div className="space-y-1.5">
            <label className="block text-slate-350 text-[11.5px] font-bold font-sans">
              Waktu Mixing (detik) <span className="text-red-500 font-black">*</span>
            </label>
            <input
              type="text"
              value={mixingTime}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^0-9]/g, "");
                setMixingTime(cleaned);
              }}
              className="w-full h-[38px] bg-[#070b13] border border-slate-800 hover:border-slate-700 focus:border-cyan-400 focus:shadow-[0_0_8px_rgba(34,211,238,0.25)] text-white text-[12px] font-mono rounded-[4px] px-3 outline-hidden transition-all"
            />
          </div>

          {/* Divider line before extra fields */}
          <div className="border-t border-slate-800/60 my-5 pt-3">
            <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-3.5">
              Data Transaksi / Pengiriman
            </h3>
          </div>

          {/* Pelanggan */}
          <div className="space-y-1.5">
            <label className="block text-slate-350 text-[11.5px] font-bold font-sans">
              Pelanggan
            </label>
            <input
              type="text"
              placeholder="Masukkan nama pelanggan"
              value={pelanggan}
              onChange={(e) => setPelanggan(e.target.value)}
              className="w-full h-[38px] bg-[#070b13] border border-slate-800 hover:border-slate-700 focus:border-cyan-400 focus:shadow-[0_0_8px_rgba(34,211,238,0.25)] text-white text-[12px] font-sans rounded-[4px] px-3 outline-hidden transition-all placeholder:text-slate-650"
            />
          </div>

          {/* Lokasi */}
          <div className="space-y-1.5">
            <label className="block text-slate-350 text-[11.5px] font-bold font-sans">
              Lokasi
            </label>
            <input
              type="text"
              placeholder="Masukkan lokasi"
              value={lokasi}
              onChange={(e) => setLokasi(e.target.value)}
              className="w-full h-[38px] bg-[#070b13] border border-slate-800 hover:border-slate-700 focus:border-cyan-400 focus:shadow-[0_0_8px_rgba(34,211,238,0.25)] text-white text-[12px] font-sans rounded-[4px] px-3 outline-hidden transition-all placeholder:text-slate-650"
            />
          </div>

          {/* No. Kendaraan */}
          <div className="space-y-1.5">
            <label className="block text-slate-350 text-[11.5px] font-bold font-sans">
              No. Kendaraan
            </label>
            <input
              type="text"
              placeholder="Masukkan no. kendaraan"
              value={noKendaraan}
              onChange={(e) => setNoKendaraan(e.target.value)}
              className="w-full h-[38px] bg-[#070b13] border border-slate-800 hover:border-slate-700 focus:border-cyan-400 focus:shadow-[0_0_8px_rgba(34,211,238,0.25)] text-white text-[12px] font-sans rounded-[4px] px-3 outline-hidden transition-all placeholder:text-slate-650"
            />
          </div>

          {/* Sopir */}
          <div className="space-y-1.5">
            <label className="block text-slate-350 text-[11.5px] font-bold font-sans">
              Sopir
            </label>
            <input
              type="text"
              placeholder="Masukkan nama sopir"
              value={sopir}
              onChange={(e) => setSopir(e.target.value)}
              className="w-full h-[38px] bg-[#070b13] border border-slate-800 hover:border-slate-700 focus:border-cyan-400 focus:shadow-[0_0_8px_rgba(34,211,238,0.25)] text-white text-[12px] font-sans rounded-[4px] px-3 outline-hidden transition-all placeholder:text-slate-650"
            />
          </div>

          {/* Bottom spacer for scroll room */}
          <div className="h-4" />
        </form>

        {/* Action Button & Incomplete Alert sticky at bottom */}
        <div className="p-4 bg-[#0c111e] border-t border-slate-800/80 sticky bottom-0 z-10 space-y-3.5 shrink-0 select-none">
          {/* Missing Validation Box */}
          {!isFormComplete && (
            <div className="bg-[#241315] border border-[#521c25] rounded-[4px] p-2.5 flex items-start gap-2 text-[#f43f5e] animate-pulse">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#f43f5e]" />
              <p className="text-[10.5px] font-sans font-bold leading-relaxed text-left text-rose-300">
                Lengkapi field berikut:{" "}
                <span className="font-extrabold text-rose-100">{missingFields.join(", ")}</span>
              </p>
            </div>
          )}

          {/* Confirm Button */}
          {isFormComplete ? (
            <button
              type="button"
              onClick={handleSubmit}
              className="w-full h-[40px] bg-[#00ffd0] hover:bg-[#00e5ff] text-slate-950 font-sans font-black text-[12px] uppercase tracking-wider rounded-[4px] flex items-center justify-center gap-1.5 transition-all shadow-[0_4px_15px_rgba(0,255,208,0.3)] hover:shadow-[0_4px_22px_rgba(0,229,255,0.45)] active:scale-98 cursor-pointer"
            >
              Mulai Batching
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="w-full h-[40px] bg-[#082a35] text-cyan-400/50 font-sans font-black text-[12px] uppercase tracking-wider rounded-[4px] flex items-center justify-center transition-colors border border-cyan-950 opacity-90 cursor-not-allowed"
            >
              Lengkapi Form ({missingFields.length} field)
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
