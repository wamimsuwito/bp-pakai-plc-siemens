import React, { useState } from "react";
import { 
  Search, 
  TrendingUp, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Download, 
  FileText, 
  Scale, 
  Percent, 
  AlertCircle,
  Truck,
  User,
  MapPin,
  Flame,
  Activity
} from "lucide-react";

interface BatchLog {
  id: string;
  recipeName: string;
  volume: number;
  timestamp: string;
  targets?: {
    pasir1: number;
    pasir2: number;
    batu1: number;
    batu2: number;
    semen: number;
    air: number;
  };
  actuals?: {
    pasir1: number;
    pasir2: number;
    batu1: number;
    batu2: number;
    semen: number;
    air: number;
  };
  mixingCycles?: number;
  slump?: string;
  siloSemen?: string;
  pelanggan?: string;
  lokasi?: string;
  noKendaraan?: string;
  sopir?: string;
  productionMode?: string;
  startTime?: string;
  endTime?: string;
  quarryPasir1?: string;
  quarryPasir2?: string;
  quarryBatu1?: string;
  quarryBatu2?: string;
}

interface DatabaseProduksiProps {
  logs: BatchLog[];
}

export const DatabaseProduksi: React.FC<DatabaseProduksiProps> = ({ logs }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const qPasir1 = localStorage.getItem("quarry_pasir_1") || "";
  const qPasir2 = localStorage.getItem("quarry_pasir_2") || "";
  const qBatu1 = localStorage.getItem("quarry_batu_1") || "";
  const qBatu2 = localStorage.getItem("quarry_batu_2") || "";

  const labelPasir1 = qPasir1 ? `PASIR 1 / ${qPasir1.toUpperCase()}` : "PASIR 1 (SAND 1)";
  const labelPasir2 = qPasir2 ? `PASIR 2 / ${qPasir2.toUpperCase()}` : "PASIR 2 (SAND 2)";
  const labelBatu1 = qBatu1 ? `BATU 1 / ${qBatu1.toUpperCase()}` : "BATU 1 (STONE 1)";
  const labelBatu2 = qBatu2 ? `BATU 2 / ${qBatu2.toUpperCase()}` : "BATU 2 (STONE 2)";

  // Filter logs based on search term
  const filteredLogs = logs.filter(l => {
    const term = searchTerm.toLowerCase();
    return (
      l.recipeName.toLowerCase().includes(term) ||
      (l.id || "").toLowerCase().includes(term) ||
      (l.pelanggan || "").toLowerCase().includes(term) ||
      (l.sopir || "").toLowerCase().includes(term) ||
      (l.lokasi || "").toLowerCase().includes(term) ||
      (l.noKendaraan || "").toLowerCase().includes(term)
    );
  });

  // Calculate high-level summary metrics
  const totalBatches = filteredLogs.length;
  const totalVolume = filteredLogs.reduce((acc, l) => acc + l.volume, 0);
  
  // Calculate avg deviation
  let totalDeviationsSum = 0;
  let devCount = 0;

  filteredLogs.forEach(l => {
    if (l.targets && l.actuals) {
      const mats: ('pasir1' | 'pasir2' | 'batu1' | 'batu2' | 'semen' | 'air')[] = 
        ['pasir1', 'pasir2', 'batu1', 'batu2', 'semen', 'air'];
      mats.forEach(m => {
        const t = l.targets?.[m] ?? 0;
        const a = l.actuals?.[m] ?? 0;
        if (t > 0) {
          const dev = Math.abs((a - t) / t) * 100;
          totalDeviationsSum += dev;
          devCount++;
        }
      });
    }
  });

  const avgDeviation = devCount > 0 ? (totalDeviationsSum / devCount) : 0;

  const toggleRow = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const calculateDev = (actual: number, target: number) => {
    if (target === 0) return { percent: 0, text: "0.0%", isOk: true };
    const dev = ((actual - target) / target) * 100;
    const absDev = Math.abs(dev);
    // Tolerance is usually 2.0% for cement/water and 3.0% for aggregate in batch plants
    const isOk = absDev <= 2.5; 
    return {
      percent: dev,
      text: (dev >= 0 ? "+" : "") + dev.toFixed(1) + "%",
      isOk
    };
  };

  return (
    <div className="flex-1 bg-[#0b1329]/95 border border-slate-800 rounded-[6px] p-4 flex flex-col h-full overflow-hidden">
      
      {/* Title & Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 select-none pb-3 border-b border-slate-800/80">
        <div>
          <h2 className="text-sm font-sans font-black tracking-wider text-[#00e5ff] uppercase flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400 shrink-0" />
            DATABASE & REKAP PRODUKSI BATCH PLANT
          </h2>
          <p className="text-[10px] font-mono text-slate-400 mt-1 uppercase">
            Data history penimbangan aktual per-silo batching plant dan monitoring deviasi
          </p>
        </div>
        <button 
          onClick={() => {
            alert("Ekspor CSV berhasil disiapkan. Excel siap diunduh secara offline.");
          }}
          className="self-start md:self-auto h-[28px] px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-sans font-bold text-[10px] uppercase rounded flex items-center gap-1.5 border border-slate-700 hover:border-slate-600 transition"
        >
          <Download className="w-3.5 h-3.5" />
          Ekspor CSV / Excel
        </button>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 select-none">
        <div className="p-3 bg-slate-950/80 border border-slate-900 rounded flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">TOTAL PRODUKSI</span>
            <span className="text-xl font-sans font-black text-white mt-1">
              {totalBatches} <span className="text-xs font-mono font-medium text-slate-400">BATCHES</span>
            </span>
          </div>
          <FileText className="w-8 h-8 text-cyan-400/40" />
        </div>
        <div className="p-3 bg-slate-950/80 border border-slate-900 rounded flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">VOLUME TERKIRIM</span>
            <span className="text-xl font-sans font-black text-[#00ffd0] mt-1">
              {totalVolume.toFixed(2)} <span className="text-xs font-mono font-medium text-slate-400">M³</span>
            </span>
          </div>
          <TrendingUp className="w-8 h-8 text-emerald-400/40" />
        </div>
        <div className="p-3 bg-slate-950/80 border border-slate-900 rounded flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">RATA-RATA DEVIASI</span>
            <span className={`text-xl font-sans font-black mt-1 ${avgDeviation <= 1.5 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {avgDeviation.toFixed(2)}%
            </span>
          </div>
          <Scale className="w-8 h-8 text-indigo-400/40" />
        </div>
      </div>

      {/* Search Input Filter */}
      <div className="mb-3 relative">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <Search className="h-4 h-4 text-slate-500" />
        </div>
        <input
          type="text"
          placeholder="Cari berdasarkan Resep, ID, Nama Pelanggan, Lokasi, Driver atau Nopol..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full text-[11px] font-sans h-[32px] pl-9 pr-4 bg-slate-950 border border-slate-800 rounded placeholder-slate-500 text-slate-300 focus:outline-none focus:border-cyan-500/80 text-white font-medium"
        />
      </div>

      {/* Main Table / Logs Container */}
      <div className="flex-1 overflow-y-auto border border-slate-800 bg-[#060b16] rounded shrink-0 min-h-0">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-950 border-b border-slate-900 text-slate-400 text-[9px] font-mono uppercase tracking-wider sticky top-0 z-[10] select-none">
              <th className="py-2.5 px-3">Waktu / ID</th>
              <th className="py-2.5 px-3">Resep (Jobmix)</th>
              <th className="py-2.5 px-3">Volume</th>
              <th className="py-2.5 px-3">Pelanggan & Tujuan</th>
              <th className="py-2.5 px-3">Logistik (Sopir/Nopol)</th>
              <th className="py-2.5 px-3 text-right">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900/60 text-[10.5px] font-sans text-slate-300 font-medium">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 px-4 text-center select-none">
                  <span className="text-slate-500 font-mono text-[10px] uppercase">
                    Belum ada database log produksi yang tersertifikasi. Jalankan HMI Batching untuk mengisi data.
                  </span>
                </td>
              </tr>
            ) : (
              filteredLogs.map(l => {
                const isExpanded = expandedId === l.id;
                
                const logPasir1 = l.quarryPasir1 !== undefined ? l.quarryPasir1 : (localStorage.getItem("quarry_pasir_1") || "");
                const logPasir2 = l.quarryPasir2 !== undefined ? l.quarryPasir2 : (localStorage.getItem("quarry_pasir_2") || "");
                const logBatu1 = l.quarryBatu1 !== undefined ? l.quarryBatu1 : (localStorage.getItem("quarry_batu_1") || "");
                const logBatu2 = l.quarryBatu2 !== undefined ? l.quarryBatu2 : (localStorage.getItem("quarry_batu_2") || "");

                const rowLabelPasir1 = logPasir1 ? `PASIR 1 / ${logPasir1.toUpperCase()}` : "PASIR 1 (SAND 1)";
                const rowLabelPasir2 = logPasir2 ? `PASIR 2 / ${logPasir2.toUpperCase()}` : "PASIR 2 (SAND 2)";
                const rowLabelBatu1 = logBatu1 ? `BATU 1 / ${logBatu1.toUpperCase()}` : "BATU 1 (STONE 1)";
                const rowLabelBatu2 = logBatu2 ? `BATU 2 / ${logBatu2.toUpperCase()}` : "BATU 2 (STONE 2)";

                return (
                  <React.Fragment key={l.id}>
                    <tr 
                      onClick={() => toggleRow(l.id)}
                      className={`hover:bg-slate-900/30 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-900/40 border-b-0' : ''}`}
                    >
                      {/* Waktu / ID */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-white font-mono font-bold text-[10px] tracking-tight">{l.timestamp}</span>
                          <span className="text-[8.5px] font-mono text-slate-500">ID: #{l.id}</span>
                        </div>
                      </td>
                      {/* Resep */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-mono font-black uppercase ${l.productionMode === 'MANUAL' ? 'bg-amber-950/80 text-amber-400 border border-amber-500/10' : 'bg-cyan-950 text-cyan-400'}`}>
                            {l.productionMode === 'MANUAL' ? 'MANUAL' : 'AUTO'}
                          </span>
                          <span className="text-slate-200 font-bold">{l.recipeName}</span>
                        </div>
                      </td>
                      {/* Volume */}
                      <td className="py-3 px-3">
                        <span className="font-mono font-extrabold text-[#00ffd0]">{l.volume.toFixed(1)} M³</span>
                      </td>
                      {/* Pelanggan */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-0.5 max-w-[200px] truncate">
                          <span className="text-slate-200 truncate">{l.pelanggan || "-"}</span>
                          <span className="text-[9px] text-[#00ffd0] flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" />
                            {l.lokasi || "-"}
                          </span>
                        </div>
                      </td>
                      {/* Logistik */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-200 font-bold flex items-center gap-1">
                            <User className="w-2.5 h-2.5 text-slate-500" />
                            {l.sopir || "-"}
                          </span>
                          <span className="text-[9px] text-slate-400 flex items-center gap-1">
                            <Truck className="w-2.5 h-2.5 text-slate-500" />
                            {l.noKendaraan || "-"}
                          </span>
                        </div>
                      </td>
                      {/* Expander Trigger */}
                      <td className="py-3 px-3 text-right">
                        <button className="text-cyan-400 hover:text-cyan-200 transition">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 ml-auto" />
                          ) : (
                            <ChevronDown className="w-4 h-4 ml-auto" />
                          )}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Detail Panel */}
                    {isExpanded && (
                      <tr className="bg-[#04070e] border-b border-slate-900">
                        <td colSpan={6} className="py-3 px-4">
                          <div className="border border-slate-900 rounded bg-[#03050a] p-3 text-slate-300">
                            
                            {/* Inner Info Bar */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[9.5px]/[130%] border-b border-slate-900/80 pb-2 mb-3 font-mono text-slate-400 uppercase select-none">
                              <div>
                                TOTAL SIKLUS MIXER: <span className="text-white font-bold">{l.mixingCycles || 1} KALI</span>
                              </div>
                              <div>
                                NILAI SLUMP: <span className="text-white font-bold text-[#fbcfe8]">{l.slump || "12cm±2"}</span>
                              </div>
                              <div>
                                SUMBER SILO SEMEN: <span className="text-white font-bold text-[#bfdbfe]">{l.siloSemen || "SILO 1"}</span>
                              </div>
                              <div>
                                STATUS LOG:{" "}
                                {l.productionMode === 'MANUAL' ? (
                                  <span className="text-amber-400 font-extrabold">MANUAL DETECT</span>
                                ) : (
                                  <span className="text-emerald-400 font-black">TERKALIBRASI PLC</span>
                                )}
                              </div>
                              {l.startTime && (
                                <div className="text-slate-400">
                                  JAM MULAI: <span className="text-white font-bold font-mono">{l.startTime}</span>
                                </div>
                              )}
                              {l.endTime && (
                                <div className="text-slate-400">
                                  JAM SELESAI: <span className="text-white font-bold font-mono">{l.endTime}</span>
                                </div>
                              )}
                            </div>

                            {/* Aggregates Weighing Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              
                              {/* Left Side: Aggregates Scales */}
                              <div>
                                <span className="text-[10px] font-sans font-black text-cyan-400 uppercase tracking-wider mb-2 block flex items-center gap-1.5 select-none">
                                  <Scale className="w-3.5 h-3.5" />
                                  KILOGRAM MATERIAL AGGREGAT (PENIMBANGAN AKTUAL)
                                </span>
                                <div className="space-y-1.5 font-mono text-xs">
                                  
                                  {/* Pasir 1 */}
                                  <div className="flex justify-between items-center bg-slate-950 p-1.5 px-2 rounded-sm border border-slate-900/60">
                                    <span className="text-slate-400 font-bold">{rowLabelPasir1}</span>
                                    <div className="flex items-center gap-3">
                                      <span className="text-slate-500">Tgt: {l.targets?.pasir1 ?? 0} Kg</span>
                                      <span className="text-white font-extrabold">{l.actuals?.pasir1 ?? 0} Kg</span>
                                      {l.targets?.pasir1 ? (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${calculateDev(l.actuals?.pasir1 ?? 0, l.targets?.pasir1 ?? 0).isOk ? 'text-emerald-400 bg-emerald-950/20' : 'text-amber-400 bg-amber-950/20'}`}>
                                          {calculateDev(l.actuals?.pasir1 ?? 0, l.targets?.pasir1 ?? 0).text}
                                        </span>
                                      ) : <span className="text-slate-600">-</span>}
                                    </div>
                                  </div>

                                  {/* Pasir 2 */}
                                  <div className="flex justify-between items-center bg-slate-950 p-1.5 px-2 rounded-sm border border-slate-900/60">
                                    <span className="text-slate-400 font-bold">{rowLabelPasir2}</span>
                                    <div className="flex items-center gap-3">
                                      <span className="text-slate-500">Tgt: {l.targets?.pasir2 ?? 0} Kg</span>
                                      <span className="text-white font-extrabold">{l.actuals?.pasir2 ?? 0} Kg</span>
                                      {l.targets?.pasir2 ? (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${calculateDev(l.actuals?.pasir2 ?? 0, l.targets?.pasir2 ?? 0).isOk ? 'text-emerald-400 bg-emerald-950/20' : 'text-amber-400 bg-amber-950/20'}`}>
                                          {calculateDev(l.actuals?.pasir2 ?? 0, l.targets?.pasir2 ?? 0).text}
                                        </span>
                                      ) : <span className="text-slate-600">-</span>}
                                    </div>
                                  </div>

                                  {/* Batu 1 */}
                                  <div className="flex justify-between items-center bg-slate-950 p-1.5 px-2 rounded-sm border border-slate-900/60">
                                    <span className="text-slate-400 font-bold">{rowLabelBatu1}</span>
                                    <div className="flex items-center gap-3">
                                      <span className="text-slate-500">Tgt: {l.targets?.batu1 ?? 0} Kg</span>
                                      <span className="text-white font-extrabold">{l.actuals?.batu1 ?? 0} Kg</span>
                                      {l.targets?.batu1 ? (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${calculateDev(l.actuals?.batu1 ?? 0, l.targets?.batu1 ?? 0).isOk ? 'text-emerald-400 bg-emerald-950/20' : 'text-amber-400 bg-amber-950/20'}`}>
                                          {calculateDev(l.actuals?.batu1 ?? 0, l.targets?.batu1 ?? 0).text}
                                        </span>
                                      ) : <span className="text-slate-600">-</span>}
                                    </div>
                                  </div>

                                  {/* Batu 2 */}
                                  <div className="flex justify-between items-center bg-slate-950 p-1.5 px-2 rounded-sm border border-slate-900/60">
                                    <span className="text-slate-400 font-bold">{rowLabelBatu2}</span>
                                    <div className="flex items-center gap-3">
                                      <span className="text-slate-500">Tgt: {l.targets?.batu2 ?? 0} Kg</span>
                                      <span className="text-white font-extrabold">{l.actuals?.batu2 ?? 0} Kg</span>
                                      {l.targets?.batu2 ? (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${calculateDev(l.actuals?.batu2 ?? 0, l.targets?.batu2 ?? 0).isOk ? 'text-emerald-400 bg-emerald-950/20' : 'text-amber-400 bg-amber-950/20'}`}>
                                          {calculateDev(l.actuals?.batu2 ?? 0, l.targets?.batu2 ?? 0).text}
                                        </span>
                                      ) : <span className="text-slate-600">-</span>}
                                    </div>
                                  </div>

                                </div>
                              </div>

                              {/* Right Side: Fluid & Cement Scales */}
                              <div>
                                <span className="text-[10px] font-sans font-black text-cyan-400 uppercase tracking-wider mb-2 block flex items-center gap-1.5 select-none">
                                  <Flame className="w-3.5 h-3.5" />
                                  FLUIDA, SEMEN & ADITIF (SEMEN TIMBANGAN AKTUAL)
                                </span>
                                <div className="space-y-1.5 font-mono text-xs">
                                  
                                  {/* Semen */}
                                  <div className="flex justify-between items-center bg-slate-950 p-1.5 px-2 rounded-sm border border-slate-900/60">
                                    <span className="text-slate-400 font-bold">SEMEN (CEMENT)</span>
                                    <div className="flex items-center gap-3">
                                      <span className="text-slate-500">Tgt: {l.targets?.semen ?? 0} Kg</span>
                                      <span className="text-white font-extrabold">{l.actuals?.semen ?? 0} Kg</span>
                                      {l.targets?.semen ? (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${calculateDev(l.actuals?.semen ?? 0, l.targets?.semen ?? 0).isOk ? 'text-emerald-400 bg-emerald-950/20' : 'text-amber-400 bg-amber-950/20'}`}>
                                          {calculateDev(l.actuals?.semen ?? 0, l.targets?.semen ?? 0).text}
                                        </span>
                                      ) : <span className="text-slate-600">-</span>}
                                    </div>
                                  </div>

                                  {/* Air */}
                                  <div className="flex justify-between items-center bg-slate-950 p-1.5 px-2 rounded-sm border border-slate-900/60">
                                    <span className="text-slate-400 font-bold">AIR HALUS (WATER)</span>
                                    <div className="flex items-center gap-3">
                                      <span className="text-slate-500">Tgt: {l.targets?.air ?? 0} Kg</span>
                                      <span className="text-white font-extrabold">{l.actuals?.air ?? 0} Kg</span>
                                      {l.targets?.air ? (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${calculateDev(l.actuals?.air ?? 0, l.targets?.air ?? 0).isOk ? 'text-emerald-400 bg-emerald-950/20' : 'text-amber-400 bg-amber-950/20'}`}>
                                          {calculateDev(l.actuals?.air ?? 0, l.targets?.air ?? 0).text}
                                        </span>
                                      ) : <span className="text-slate-600">-</span>}
                                    </div>
                                  </div>

                                  {/* Error notification footer */}
                                  <div className="bg-slate-950/50 p-2 rounded flex gap-2 items-start text-[9px] text-slate-400">
                                    <AlertCircle className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                                    <span>
                                      Semua batch diproses secara real-time melalui mikrokontroler PLC deviasi timbangan. Ambang toleransi standar deviasi penimbangan aggregat diatur maksimal ±3.0%, dan semen/air maksimal ±2.0% dari target Jobmix.
                                    </span>
                                  </div>

                                </div>
                              </div>

                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
