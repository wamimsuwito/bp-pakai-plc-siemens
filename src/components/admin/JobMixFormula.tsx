import React, { useState, useEffect, useMemo } from "react";
import { 
  FlaskConical, 
  Search, 
  Trash2, 
  Edit2, 
  Plus, 
  Save, 
  X, 
  Undo, 
  Check, 
  AlertTriangle, 
  Sparkles, 
  TrendingUp, 
  Calendar,
  FileSpreadsheet,
  ArrowUpDown,
  AlertCircle
} from "lucide-react";
import { dotNetBackendService } from "../../lib/dotnetBackendService";

// The full descriptive structure requested by the user:
export interface JobMix {
  id: string;
  mutuBeton: string; // Mutu Beton (e.g., "K225", "K250", "K300")
  pasir1: number;
  pasir2: number;
  batu1: number;
  batu2: number;
  semen: number;
  air: number;
  additive: number;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_JOB_MIX_LIST: JobMix[] = [
  {
    id: "jmf-1",
    mutuBeton: "K225",
    pasir1: 520,
    pasir2: 150,
    batu1: 650,
    batu2: 330,
    semen: 300,
    air: 150,
    additive: 1.5,
    createdAt: "2026-05-26 12:00",
    updatedAt: "2026-05-26 12:00"
  },
  {
    id: "jmf-2",
    mutuBeton: "K250",
    pasir1: 550,
    pasir2: 170,
    batu1: 680,
    batu2: 300,
    semen: 350,
    air: 160,
    additive: 2.0,
    createdAt: "2026-05-26 12:00",
    updatedAt: "2026-05-26 12:00"
  },
  {
    id: "jmf-3",
    mutuBeton: "K300",
    pasir1: 650,
    pasir2: 120,
    batu1: 780,
    batu2: 350,
    semen: 400,
    air: 180,
    additive: 2.5,
    createdAt: "2026-05-26 12:00",
    updatedAt: "2026-05-26 15:00"
  }
];

export const JobMixFormula: React.FC = () => {
  // Load JMF from localStorage or default
  const [jobMixes, setJobMixes] = useState<JobMix[]>(() => {
    const saved = localStorage.getItem("batching_plant_jmf_list");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (err) {}
    }
    return DEFAULT_JOB_MIX_LIST;
  });

  // Save to DB and publish update to system recipes list
  useEffect(() => {
    localStorage.setItem("batching_plant_jmf_list", JSON.stringify(jobMixes));
    
    // Map JMFs to RECIPES-format for App.tsx compatibility
    const mappedRecipes = jobMixes.map(jmf => ({
      id: jmf.mutuBeton.toLowerCase().replace(/[^a-z0-h0-9]/g, ""),
      name: `Beton ${jmf.mutuBeton}`,
      targets: {
        pasir: jmf.pasir1 + jmf.pasir2,
        batu: jmf.batu1 + jmf.batu2,
        semen: jmf.semen,
        air: jmf.air
      },
      jobMixDetails: jmf
    }));
    localStorage.setItem("batching_plant_recipes_data_scada", JSON.stringify(mappedRecipes));

    // Sync to .NET backend SQLite database
    dotNetBackendService.migrateLegacyData('jmf', jobMixes.map(j => ({
      mutuBeton: j.mutuBeton,
      pasir1Target: j.pasir1,
      pasir2Target: j.pasir2,
      batu1Target: j.batu1,
      batu2Target: j.batu2,
      semenTarget: j.semen,
      airTarget: j.air,
      additiveTarget: j.additive
    }))).catch(() => {});

    // Dispatch custom event to notify App.tsx of recipe database updates immediately
    window.dispatchEvent(new Event("jmf_database_updated"));
  }, [jobMixes]);

  // Form input states
  const [mutuBeton, setMutuBeton] = useState("");
  const [pasir1, setPasir1] = useState("");
  const [pasir2, setPasir2] = useState("");
  const [batu1, setBatu1] = useState("");
  const [batu2, setBatu2] = useState("");
  const [semen, setSemen] = useState("");
  const [air, setAir] = useState("");
  const [additive, setAdditive] = useState("");

  // Edit states
  const [editId, setEditId] = useState<string | null>(null);
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<keyof JobMix>("mutuBeton");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Notifications
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteIdConf, setDeleteIdConf] = useState<string | null>(null);

  // Auto clean notifications
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  // Form Reset
  const handleReset = () => {
    setMutuBeton("");
    setPasir1("");
    setPasir2("");
    setBatu1("");
    setBatu2("");
    setSemen("");
    setAir("");
    setAdditive("");
    setEditId(null);
  };

  // Input numeric parsing fail safe
  const parseInputNumber = (val: string): number => {
    if (!val || val.trim() === "") return 0;
    const num = parseFloat(val);
    if (isNaN(num)) return 0;
    return Math.max(0, num); // Reject negative numbers safely
  };

  // Submit JMF (Save or Update)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedMutu = mutuBeton.trim().toUpperCase();
    if (!trimmedMutu) {
      setErrorMsg("NAMA MUTU BETON TIDAK BOLEH KOSONG");
      return;
    }

    // Dup check
    const dup = jobMixes.find(j => j.mutuBeton.toUpperCase() === trimmedMutu && j.id !== editId);
    if (dup) {
      setErrorMsg(`MUTU BETON "${trimmedMutu}" SUDAH TERDAFTAR DI DATABASE`);
      return;
    }

    const value_p1 = parseInputNumber(pasir1);
    const value_p2 = parseInputNumber(pasir2);
    const value_b1 = parseInputNumber(batu1);
    const value_b2 = parseInputNumber(batu2);
    const value_semen = parseInputNumber(semen);
    const value_air = parseInputNumber(air);
    const value_additive = parseInputNumber(additive);

    // Sum validation
    if (value_p1 + value_p2 + value_b1 + value_b2 + value_semen + value_air === 0) {
      setErrorMsg("JUMLAH MATERIAL FORMULA HARUS LEBIH BESAR DARI 0 KG");
      return;
    }

    const now = new Date();
    const dateStr = now.getFullYear() + "-" + 
                    String(now.getMonth() + 1).padStart(2, '0') + "-" + 
                    String(now.getDate()).padStart(2, '0') + " " + 
                    String(now.getHours()).padStart(2, '0') + ":" + 
                    String(now.getMinutes()).padStart(2, '0');

    if (editId) {
      // Update Mode
      setJobMixes(prev => prev.map(item => {
        if (item.id === editId) {
          return {
            ...item,
            mutuBeton: trimmedMutu,
            pasir1: value_p1,
            pasir2: value_p2,
            batu1: value_b1,
            batu2: value_b2,
            semen: value_semen,
            air: value_air,
            additive: value_additive,
            updatedAt: dateStr
          };
        }
        return item;
      }));
      setSuccessMsg(`FORMULA ${trimmedMutu} BERHASIL DI-UPDATE!`);
    } else {
      // Create Mode
      const newJmf: JobMix = {
        id: "jmf-" + Math.random().toString(36).substring(7).toUpperCase(),
        mutuBeton: trimmedMutu,
        pasir1: value_p1,
        pasir2: value_p2,
        batu1: value_b1,
        batu2: value_b2,
        semen: value_semen,
        air: value_air,
        additive: value_additive,
        createdAt: dateStr,
        updatedAt: dateStr
      };
      setJobMixes(prev => [newJmf, ...prev]);
      setSuccessMsg(`RESEP MUTU ${trimmedMutu} BERHASIL DISIMPAN!`);
    }

    handleReset();
  };

  // Edit trigger
  const handleEditTrigger = (jmf: JobMix) => {
    setEditId(jmf.id);
    setMutuBeton(jmf.mutuBeton);
    setPasir1(jmf.pasir1.toString());
    setPasir2(jmf.pasir2.toString());
    setBatu1(jmf.batu1.toString());
    setBatu2(jmf.batu2.toString());
    setSemen(jmf.semen.toString());
    setAir(jmf.air.toString());
    setAdditive(jmf.additive.toString());
  };

  // Delete Action
  const handleDeleteTrigger = (id: string) => {
    setDeleteIdConf(id);
  };

  const handleConfirmDelete = () => {
    if (deleteIdConf) {
      const match = jobMixes.find(j => j.id === deleteIdConf);
      setJobMixes(prev => prev.filter(j => j.id !== deleteIdConf));
      if (match) {
        setSuccessMsg(`Formula ${match.mutuBeton} Berhasil Dihapus.`);
      }
      setDeleteIdConf(null);
    }
  };

  // Sorting columns
  const handleSort = (col: keyof JobMix) => {
    if (sortBy === col) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDirection("asc");
    }
  };

  // Computed totals for visual feedback
  const totalFormulasCount = jobMixes.length;

  // Filter & Search & Merge list data
  const processedMixes = useMemo(() => {
    let result = [...jobMixes];

    // 1. Search Query
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.filter(jmf => 
        jmf.mutuBeton.toLowerCase().includes(q)
      );
    }

    // 2. Sorting
    result.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (typeof valA === "string") {
        valA = (valA as string).toLowerCase();
        valB = (valB as string).toLowerCase();
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [jobMixes, searchQuery, sortBy, sortDirection]);

  return (
    <div id="job-mix-formula-dashboard" className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto pr-1">
      
      {/* HEADER SCADA STYLE */}
      <div className="bg-[#0b1329]/80 border border-[#1e293b]/70 rounded-[6px] p-4 shrink-0 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#020617] border border-[#1e293b] rounded-[5px] text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]">
              <FlaskConical size={18} />
            </div>
            <div>
              <h4 className="text-sm font-sans font-black tracking-widest text-white uppercase flex items-center gap-2">
                MASTER JOB MIX FORMULA (JMF)
                <span className="text-[7.5px] font-mono font-bold text-cyan-400 bg-cyan-950/50 border border-cyan-800/40 px-1.5 py-0.5 rounded uppercase">
                  Recipe DB PLC
                </span>
              </h4>
              <p className="text-[9.5px] font-mono text-cyan-500 uppercase tracking-wider mt-0.5">
                Konfigurasi Master Berat Agregat, Semen, Air, dan Aditif untuk Kontrol Batching Plant Otomatis
              </p>
            </div>
          </div>
          
          <div className="bg-slate-900 border border-slate-800 px-3 py-1 rounded flex items-center gap-2">
            <span className="text-[8px] font-mono text-slate-500 uppercase font-black">ACTIVE RECIPES</span>
            <span className="font-mono text-xs font-bold text-cyan-400">{totalFormulasCount} RESEP</span>
          </div>
        </div>
      </div>

      {/* TWO PANEL CORE: INPUT FORM & SCADA TABLES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* FORM INPUT COMPONENT - LEFT PANEL */}
        <div className="lg:col-span-4 bg-[#080d1a]/95 border border-[#1e293b]/50 rounded-[6px] p-4 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-3">
            <span className="text-[10px] font-sans font-black tracking-widest text-slate-100 uppercase flex items-center gap-1.5">
              <Sparkles size={11} className="text-cyan-400 animate-pulse" />
              {editId ? "UBAH / EDIT RESEP FORMULA" : "BUAT RESEP FORMULA BARU"}
            </span>
            {editId && (
              <button 
                onClick={handleReset}
                className="text-[8.5px] font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1 shrink-0 uppercase cursor-pointer"
              >
                <Undo size={10} /> BATAL EDIT
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5 text-left">
            {/* Name input */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-sans font-black text-slate-400 uppercase tracking-wider">
                Mutu Beton <span className="text-rose-500 font-bold">*</span>
              </span>
              <input
                type="text"
                placeholder="Contoh: K225, K250, K300, K350"
                value={mutuBeton}
                onChange={(e) => setMutuBeton(e.target.value)}
                maxLength={10}
                required
                className="bg-[#020617] border border-slate-800 text-cyan-400 p-2.5 rounded-[4px] text-xs font-mono font-bold uppercase focus:border-cyan-400 outline-none w-full"
                disabled={editId !== null} // Lock Mutu Beton during edits to avoid identifier sync corruption
              />
            </div>

            {/* Agregat Pasir 1 & Pasir 2 side by side */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-sans font-black text-slate-400 uppercase tracking-wider">Pasir 1 (Kg) &nbsp;<span className="font-mono text-[7.5px] text-slate-500">Fine Grain</span></span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="0"
                  value={pasir1}
                  onChange={(e) => setPasir1(e.target.value)}
                  className="bg-[#020617] border border-slate-800 text-slate-100 p-2 rounded-[4px] text-xs font-mono font-bold text-center focus:border-cyan-500 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-sans font-black text-slate-400 uppercase tracking-wider">Pasir 2 (Kg) &nbsp;<span className="font-mono text-[7.5px] text-slate-500">Coarse Grain</span></span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="0"
                  value={pasir2}
                  onChange={(e) => setPasir2(e.target.value)}
                  className="bg-[#020617] border border-slate-800 text-slate-100 p-2 rounded-[4px] text-xs font-mono font-bold text-center focus:border-cyan-500 outline-none"
                />
              </div>
            </div>

            {/* Agregat Batu 1 & Batu 2 side by side */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-sans font-black text-slate-400 uppercase tracking-wider">Batu 1 / Sirtu (Kg)</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="0"
                  value={batu1}
                  onChange={(e) => setBatu1(e.target.value)}
                  className="bg-[#020617] border border-slate-800 text-slate-100 p-2 rounded-[4px] text-xs font-mono font-bold text-center focus:border-cyan-500 outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-sans font-black text-slate-400 uppercase tracking-wider">Batu 2 / Split (Kg)</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="0"
                  value={batu2}
                  onChange={(e) => setBatu2(e.target.value)}
                  className="bg-[#020617] border border-slate-800 text-slate-100 p-2 rounded-[4px] text-xs font-mono font-bold text-center focus:border-cyan-500 outline-none"
                />
              </div>
            </div>

            {/* Core Bindings: Semen & Air side by side */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-sans font-black text-slate-400 uppercase tracking-wider">Semen PPC (Kg)</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="0"
                  value={semen}
                  onChange={(e) => setSemen(e.target.value)}
                  className="bg-[#020617] border border-slate-800 text-[#00ffd0] p-2 rounded-[4px] text-xs font-mono font-bold text-center focus:border-[#00ffd0] outline-none"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-sans font-black text-slate-400 uppercase tracking-wider">Air Bersih (Kg)</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="0"
                  value={air}
                  onChange={(e) => setAir(e.target.value)}
                  className="bg-[#020617] border border-slate-800 text-blue-400 p-2 rounded-[4px] text-xs font-mono font-bold text-center focus:border-blue-500 outline-none"
                  required
                />
              </div>
            </div>

            {/* Chemical Additives */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-sans font-black text-slate-400 uppercase tracking-wider">Additive / Retarder (Kg)</span>
              <input
                type="number"
                step="0.1"
                min="0"
                placeholder="0.0"
                value={additive}
                onChange={(e) => setAdditive(e.target.value)}
                className="bg-[#020617] border border-slate-800 text-amber-400 p-2.5 rounded-[4px] text-xs font-mono font-bold text-center focus:border-amber-500 outline-none w-full"
              />
            </div>

            {/* Interactive Estimated Totals */}
            <div className="mt-4 p-3 bg-slate-950 rounded-md border border-slate-900 flex justify-between items-center text-left">
              <div>
                <span className="text-[7px] font-mono text-slate-500 uppercase block tracking-wider">TOTAL ESTIMATED TRUCK LOAD</span>
                <span className="text-sm font-mono font-black text-cyan-400">
                  {(parseInputNumber(pasir1) + parseInputNumber(pasir2) + parseInputNumber(batu1) + parseInputNumber(batu2) + parseInputNumber(semen) + parseInputNumber(air)).toLocaleString()} Kg
                </span>
              </div>
              <div className="text-right">
                <span className="text-[7px] font-mono text-slate-500 uppercase block tracking-wider">WATER-CEMENT RATIO</span>
                <span className="text-xs font-mono font-bold text-pink-400">
                  {parseInputNumber(semen) > 0 ? (parseInputNumber(air) / parseInputNumber(semen)).toFixed(2) : "0.00"}
                </span>
              </div>
            </div>

            {/* Actions Submit / Reset buttons */}
            <div className="flex gap-2 pt-2 border-t border-slate-900">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white font-sans text-[10px] uppercase font-black tracking-wider rounded transition-colors cursor-pointer"
              >
                RESET
              </button>
              <button
                type="submit"
                className="flex-[2] py-2 bg-cyan-400 hover:bg-cyan-300 text-black font-sans text-[10px] uppercase font-black tracking-wider rounded transition-all cursor-pointer flex items-center justify-center gap-1 shadow-md"
              >
                <Save size={12} />
                {editId ? "UPDATE JMF" : "SIMPAN JMF"}
              </button>
            </div>
          </form>

          {/* Inline alert boxes */}
          {successMsg && (
            <div className="mt-3 bg-emerald-950/40 border border-emerald-800/60 p-2 rounded text-[9.5px] font-mono text-emerald-300 text-left flex items-start gap-1 uppercase">
              <Check size={11} className="shrink-0 mt-0.5 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="mt-3 bg-rose-950/40 border border-rose-800/60 p-2 rounded text-[9.5px] font-mono text-rose-300 text-left flex items-start gap-1 uppercase">
              <AlertCircle size={11} className="shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* DATABASE RECIPES VIEW - RIGHT PANEL */}
        <div className="lg:col-span-8 bg-[#080d1a]/95 border border-[#1e293b]/50 rounded-[6px] p-4 flex flex-col min-h-0 overflow-hidden">
          
          {/* BAR FILTER SEARCH & ACTIONS */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-b border-slate-900 pb-3 mb-3">
            <div className="flex items-center gap-1.5 flex-1 max-w-sm">
              <div className="relative w-full">
                <Search size={12} className="absolute left-2.5 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Cari Mutu Beton..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#020617] border border-slate-800 text-slate-200 pl-8 pr-3 py-1.5 rounded-[4px] text-xs font-mono focus:border-cyan-400 outline-none"
                />
              </div>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-[9px] font-mono text-slate-550 hover:text-slate-300 uppercase shrink-0"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="text-[8.5px] font-mono text-slate-500 uppercase flex items-center gap-1.5 self-end">
              <Calendar size={10} />
              <span>TIME: 2026-05-26</span>
            </div>
          </div>

          {/* MAIN DATATABLE IN MODERN INDUSTRIAL SCADA STYLE */}
          <div className="flex-1 overflow-x-auto min-h-0">
            {processedMixes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <AlertTriangle size={24} className="text-amber-500/50 mb-2 animate-pulse" />
                <span className="font-mono text-[10px] uppercase">Formula tidak ditemukan. Silakan tambahkan parameter di panel kiri.</span>
              </div>
            ) : (
              <table className="w-full text-left font-mono text-[10px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 uppercase text-[9px] font-black">
                    <th className="py-2.5 px-2 cursor-pointer hover:bg-slate-900 transition-colors" onClick={() => handleSort("mutuBeton")}>
                      <div className="flex items-center gap-1">
                        Mutu Beton
                        <ArrowUpDown size={8} />
                      </div>
                    </th>
                    <th className="py-2.5 text-right">Pasir 1 (Kg)</th>
                    <th className="py-2.5 text-right">Pasir 2 (Kg)</th>
                    <th className="py-2.5 text-right">Batu 1 (Kg)</th>
                    <th className="py-2.5 text-right">Batu 2 (Kg)</th>
                    <th className="py-2.5 text-right text-[#00ffd0]">Semen (Kg)</th>
                    <th className="py-2.5 text-right text-blue-400">Air (Kg)</th>
                    <th className="py-2.5 text-right text-amber-400">Aditif (Kg)</th>
                    <th className="py-2.5 text-center px-1">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 text-slate-300">
                  {processedMixes.map((item) => {
                    const isEditingThis = editId === item.id;
                    return (
                      <tr 
                        key={item.id} 
                        className={`transition-colors hover:bg-slate-900/30 ${
                          isEditingThis ? "bg-cyan-950/20 border-l-2 border-cyan-400" : ""
                        }`}
                      >
                        {/* Mutu design bold heading */}
                        <td className="py-3 px-2 font-black text-white hover:text-cyan-400 transition-colors uppercase">
                          {item.mutuBeton}
                        </td>
                        <td className="py-3 text-right text-slate-300 font-bold">{item.pasir1}</td>
                        <td className="py-3 text-right text-slate-400">{item.pasir2}</td>
                        <td className="py-3 text-right text-slate-300 font-bold">{item.batu1}</td>
                        <td className="py-3 text-right text-slate-400">{item.batu2}</td>
                        <td className="py-3 text-right text-[#00ffd0] font-black">{item.semen}</td>
                        <td className="py-3 text-right text-blue-400 font-black">{item.air}</td>
                        <td className="py-3 text-right text-amber-400 font-black">{item.additive} kg</td>
                        
                        {/* Actions block containing Edit & Delete */}
                        <td className="py-3 text-center px-2">
                          <div className="flex items-center justify-center gap-1 w-full">
                            <button
                              type="button"
                              onClick={() => handleEditTrigger(item)}
                              title="Sunting data material resep"
                              className="p-1 px-1.5 text-slate-400 hover:text-cyan-400 bg-slate-900 border border-slate-850 hover:border-cyan-950 rounded transition-all cursor-pointer flex items-center justify-center"
                            >
                              <Edit2 size={10} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTrigger(item.id)}
                              title="Hapus formula resep master"
                              className="p-1 px-1.5 text-rose-500 hover:text-rose-400 bg-slate-900 border border-slate-850 hover:border-rose-950 rounded transition-all cursor-pointer flex items-center justify-center"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          
          {/* EXPLANATION FOOTNOTE INFO BOX */}
          <div className="mt-4 p-3 bg-slate-950 border border-slate-900 rounded-[4px] text-left">
            <span className="text-[8px] font-mono text-cyan-500 uppercase font-black tracking-wider block">ℹ PLC METADATA SYNC INSTRUCTIONS</span>
            <p className="text-[8.5px] font-mono text-slate-400 leading-normal mt-1 uppercase">
              RESEP INI SECARA INSTAN AKAN BERFUNGSI SEBAGAI TARGET UTAMA PROSES BATCHING AGREGAT DI HALAMAN HOME-SCREEN BATCHING PLANT DAN PROSES PENENTUAN ESTIMASI SLUMP PADA SENSOR AMPERE MIXER.
            </p>
          </div>

        </div>
      </div>

      {/* CONFIRM DELETE MODAL OVERLAY */}
      {deleteIdConf && (
        <div className="fixed inset-0 z-[400] bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0b1329] border-2 border-rose-500/70 rounded-[6px] p-5 max-w-sm w-full shadow-[0_0_20px_rgba(239,68,68,0.25)] select-none">
            <h5 className="text-[11px] font-sans font-black text-rose-500 uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle size={15} />
              KONFIRMASI HAPUS LAYOUT JMF!
            </h5>
            <p className="text-[10px] font-mono text-slate-300 uppercase leading-relaxed mt-2.5 text-left">
              Apakah Anda benar-benar yakin ingin menghapus mutu resep ini dari database Master Batching Plant? Tindakan ini bersifat permanen dan tidak dapat diurungkan.
            </p>
            <div className="flex gap-2.5 mt-4 justify-end">
              <button
                type="button"
                onClick={() => setDeleteIdConf(null)}
                className="px-4 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 font-sans text-[8.5px] font-extrabold uppercase rounded cursor-pointer transition-colors"
              >
                BATAL
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-sans text-[8.5px] font-extrabold uppercase rounded cursor-pointer transition-colors shadow-sm"
              >
                HAPUS SEKARANG
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
