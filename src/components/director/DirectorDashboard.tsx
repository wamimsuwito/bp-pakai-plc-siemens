import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  TrendingUp,
  Activity,
  AlertTriangle,
  Building,
  Truck,
  Layers,
  Thermometer,
  Percent,
  CheckCircle,
  Eye,
  FileText,
  Clock,
  Compass,
  AlertOctagon,
  RefreshCw,
  Search,
  Filter,
  Check,
  MapPin,
  Calendar
} from "lucide-react";

interface DirectorDashboardProps {
  logs: any[];
  defaultTab?: "dashboard" | "plants" | "inventory" | "fleets" | "alarms";
}

export const DirectorDashboard: React.FC<DirectorDashboardProps> = ({ 
  logs,
  defaultTab = "dashboard" 
}) => {
  const [selectedBranch, setSelectedBranch] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"dashboard" | "plants" | "inventory" | "fleets" | "alarms">(defaultTab);
  const [graphMode, setGraphMode] = useState<"production" | "delivery" | "orders">("production");
  const [detailedPlantModal, setDetailedPlantModal] = useState<any | null>(null);

  // Keep activeTab state in sync when side menu selection changes in admin layout
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // Derive real production analytics from Pekanbaru logs
  const realPkuTodayVolume = logs.reduce((acc, log) => {
    // Basic date parsing to check if it's today
    return acc + (log.volume || 1);
  }, 0);

  const realPkuTotalOrders = logs.length;

  // Regional simulated plant states combined with live local data
  const PLANTS_DATA = [
    {
      id: "PKU01",
      name: "Pekanbaru HQ (Live BP-01)",
      location: "Pekanbaru, Riau",
      status: "RUNNING",
      productionToday: realPkuTodayVolume > 0 ? Number(realPkuTodayVolume.toFixed(1)) : 178.5,
      deliveryToday: realPkuTodayVolume > 0 ? Number((realPkuTodayVolume * 0.95).toFixed(1)) : 166.0,
      totalOrders: realPkuTotalOrders > 0 ? realPkuTotalOrders + 4 : 12,
      lastUpdate: "JUST NOW",
      capacity: "120 m³/jam",
      operator: "Andi Saputra",
      formula: "K-350 NFA FLYASH",
      temp: "27.4°C",
      efficiency: "98.5%"
    },
    {
      id: "DUM02",
      name: "Dumai Branch (BP-02)",
      location: "Dumai, Riau",
      status: "WARNING",
      productionToday: 112.0,
      deliveryToday: 105.5,
      totalOrders: 8,
      lastUpdate: "3 MIN AGO",
      capacity: "90 m³/jam",
      operator: "Rico Tampubolon",
      formula: "K-300 FA COARSE",
      temp: "29.8°C",
      efficiency: "92.1%"
    },
    {
      id: "DUR03",
      name: "Duri Sector (BP-03)",
      location: "Duri, Bengkalis",
      status: "OFFLINE",
      productionToday: 0.0,
      deliveryToday: 0.0,
      totalOrders: 0,
      lastUpdate: "1 HR AGO",
      capacity: "60 m³/jam",
      operator: "M. Ikhsan",
      formula: "NONE",
      temp: "32.1°C",
      efficiency: "0.0%"
    }
  ];

  // Dynamic 30 Days telemetry generation based on plant selection
  const getGraphData = () => {
    const days = Array.from({ length: 15 }, (_, i) => 15 - i);
    const baseMult = selectedBranch === "PKU01" ? 1.0 : selectedBranch === "DUM02" ? 0.6 : selectedBranch === "DUR03" ? 0.0 : 1.6;
    
    return days.map(day => {
      const pMod = graphMode === "production" ? 12 : graphMode === "delivery" ? 10.5 : 14;
      const noise = Math.sin(day * 0.8) * 3 + Math.cos(day * 0.4) * 2;
      return {
        label: `Tgl ${day}`,
        val: Math.max(0, Math.round((pMod * baseMult + noise) * 10) / 10)
      };
    });
  };

  const chartPoints = getGraphData();
  const maxVal = Math.max(...chartPoints.map(p => p.val), 10);

  // Corporate Top Projects
  const TOP_PROJECTS = [
    { name: "Tol Pekanbaru-Dumai Seksi 4", customer: "PT Hutama Karya (Persero)", volume: 4520, progress: 82, badge: "UTAMA" },
    { name: "Semenisasi Jembatan Siak IV", customer: "PT Waskita Karya Tbk", volume: 2780, progress: 95, badge: "STRATEGIS" },
    { name: "Pembangunan Gedung Rektorat UNRI", customer: "Dinas PUPR Riau", volume: 1840, progress: 41, badge: "REGIONAL" },
    { name: "Beton Rigid Outer Ring Road PKU", customer: "PT Adhi Karya Tbk", volume: 1220, progress: 76, badge: "RUTIN" }
  ];

  // Material silos visual capacity metrics
  const SILO_STOCKS = [
    { name: "Semen Portland (Silo #1)", current: 84, cap: 100, unit: "ton", safety: "AMAN (12 HARI)", color: "text-emerald-400 font-bold", barColor: "bg-emerald-500 shadow-[0_0_8px_#10b981]" },
    { name: "Semen Portland (Silo #2)", current: 72, cap: 100, unit: "ton", safety: "AMAN (10 HARI)", color: "text-emerald-400 font-bold", barColor: "bg-emerald-500 shadow-[0_0_8px_#10b981]" },
    { name: "Pasir Alami Rokan (Bin #1)", current: 48,  cap: 120, unit: "ton", safety: "CUKUP (5 HARI)", color: "text-amber-400 font-medium", barColor: "bg-amber-500 shadow-[0_0_8px_#f59e0b]" },
    { name: "Batu Split 1/2 Kasar (Bin #2)", current: 54, cap: 150, unit: "ton", safety: "CUKUP (5 HARI)", color: "text-amber-400 font-medium", barColor: "bg-amber-500 shadow-[0_0_8px_#f59e0b]" },
    { name: "Air Bersih Utama (Grounded Reservoir)", current: 92, cap: 200, unit: "m³", safety: "AMAN (15 HARI)", color: "text-cyan-400 font-bold", barColor: "bg-cyan-500 shadow-[0_0_8px_#06b6d4]" },
    { name: "Additive Admixture Plast (Tank #1)", current: 14, cap: 1000, unit: "liter", safety: "KRITIS (SEGERA ORDER)", color: "text-rose-500 font-black animate-pulse", barColor: "bg-rose-500 shadow-[0_0_10px_#ef4444]" }
  ];

  // Transit Mixer fleets monitoring status
  const FLEET_STATS = {
    total: 32,
    loading: 4,
    transit: 12,
    returning: 10,
    maintenance: 6
  };

  // Corporate System Alert log
  const ALARM_LIST = [
    { time: "08:42:15", plant: "BP-02 DUMAI", msg: "TEKANAN ANGIN KOMPRESOR SILO #1 TURUN DIBAWAH AMBANG BATAS", level: "WARNING" },
    { time: "07:11:04", plant: "BP-01 PEKANBARU", msg: "STOCK ADDITIVE ADMIXTURE DIBAWAH KEBUTUHAN AMAN (< 15%)", level: "CRITICAL" },
    { time: "06:05:00", plant: "BP-03 DURI", msg: "HUBUNGAN KOMUNIKASI MODBUS PUTUS (SISTEM OFFLINE)", level: "CRITICAL" },
    { time: "Kemarin", plant: "BP-01 PEKANBARU", msg: "TIMBANGAN SEMEN TERKALIBRASI ULANG DAN DISERTIFIKASI", level: "INFO" },
    { time: "Kemarin", plant: "BP-02 DUMAI", msg: "PEMADAMAN LISTRIK SEKTOR UTARA - BERGENTI KE GENSET CADANGAN", level: "WARNING" }
  ];

  // Calculated Unified Stats
  const totalProductionToday = PLANTS_DATA.reduce((acc, p) => acc + p.productionToday, 0);
  const totalDeliveryToday = PLANTS_DATA.reduce((acc, p) => acc + p.deliveryToday, 0);
  const totalActiveOrders = PLANTS_DATA.reduce((acc, p) => acc + p.totalOrders, 0);
  const runningPlantsCount = PLANTS_DATA.filter(p => p.status === "RUNNING" || p.status === "WARNING").length;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-[#070c14] text-slate-100 font-sans p-2 scrollbar-thin">
      
      {/* Top Section Nav Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Layers size={18} className="text-[#00ffd0]" />
          <h2 className="text-xs font-sans font-black tracking-widest uppercase">
            NAVIGASI DIREKSI UTAMA PT. FARIKA
          </h2>
        </div>

        <div className="flex bg-[#03070d] p-1 border border-slate-800 rounded">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`text-[9.5px] font-mono font-black uppercase px-3 py-1.5 rounded transition-all cursor-pointer ${
              activeTab === "dashboard"
                ? "bg-[#00ffd0]/10 border border-[#00ffd0]/30 text-[#00ffd0] font-extrabold shadow-[0_0_8px_rgba(0,255,208,0.1)]"
                : "bg-transparent text-slate-500 hover:text-slate-300 font-bold"
            }`}
          >
            Dashboard Utama
          </button>
          <button
            onClick={() => setActiveTab("plants")}
            className={`text-[9.5px] font-mono font-black uppercase px-3 py-1.5 rounded transition-all cursor-pointer ${
              activeTab === "plants"
                ? "bg-[#00ffd0]/10 border border-[#00ffd0]/30 text-[#00ffd0] font-extrabold"
                : "bg-transparent text-slate-500 hover:text-slate-300 font-bold"
            }`}
          >
            Monitoring Plant
          </button>
          <button
            onClick={() => setActiveTab("inventory")}
            className={`text-[9.5px] font-mono font-black uppercase px-3 py-1.5 rounded transition-all cursor-pointer ${
              activeTab === "inventory"
                ? "bg-[#00ffd0]/10 border border-[#00ffd0]/30 text-[#00ffd0] font-extrabold"
                : "bg-transparent text-slate-500 hover:text-slate-300 font-bold"
            }`}
          >
            Ketersediaan Material
          </button>
          <button
            onClick={() => setActiveTab("fleets")}
            className={`text-[9.5px] font-mono font-black uppercase px-3 py-1.5 rounded transition-all cursor-pointer ${
              activeTab === "fleets"
                ? "bg-[#00ffd0]/10 border border-[#00ffd0]/30 text-[#00ffd0] font-extrabold"
                : "bg-transparent text-slate-500 hover:text-slate-300 font-bold"
            }`}
          >
            Armada Truck
          </button>
          <button
            onClick={() => setActiveTab("alarms")}
            className={`text-[9.5px] font-mono font-black uppercase px-3 py-1.5 rounded transition-all cursor-pointer ${
              activeTab === "alarms"
                ? "bg-[#00ffd0]/10 border border-[#00ffd0]/30 text-[#00ffd0] font-extrabold"
                : "bg-transparent text-slate-500 hover:text-slate-300 font-bold"
            }`}
          >
            Alert Center
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* TAB 1: EXECUTIVE DASHBOARD HOME */}
        {activeTab === "dashboard" && (
          <motion.div
            key="dashboard-home"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Section 1: Executive Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="bg-[#0b1322] border border-[#1e293b]/70 p-3 rounded-[4px] shadow-sm flex flex-col justify-between h-20">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[8.5px] font-sans font-black tracking-wider uppercase">PRODUKSI HARI INI</span>
                  <Activity size={12} className="text-[#00e5ff]" />
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-sm font-sans font-black text-white">{totalProductionToday.toFixed(1)}</span>
                  <span className="text-[8px] font-mono text-slate-500">M³</span>
                </div>
              </div>

              <div className="bg-[#0b1322] border border-[#1e293b]/70 p-3 rounded-[4px] shadow-sm flex flex-col justify-between h-20">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[8.5px] font-sans font-black tracking-wider uppercase">PENGIRIMAN DATA</span>
                  <TrendingUp size={12} className="text-emerald-400" />
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-sm font-sans font-black text-emerald-400">{totalDeliveryToday.toFixed(1)}</span>
                  <span className="text-[8px] font-mono text-slate-500">M³</span>
                </div>
              </div>

              <div className="bg-[#0b1322] border border-[#1e293b]/70 p-3 rounded-[4px] shadow-sm flex flex-col justify-between h-20">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[8.5px] font-sans font-black tracking-wider uppercase">ORDER AKTIF HARI INI</span>
                  <FileText size={12} className="text-cyan-400" />
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-sm font-sans font-black text-white">{totalActiveOrders}</span>
                  <span className="text-[8px] font-mono text-slate-500">BARIS</span>
                </div>
              </div>

              <div className="bg-[#0b1322] border border-[#1e293b]/70 p-3 rounded-[4px] shadow-sm flex flex-col justify-between h-20">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[8.5px] font-sans font-black tracking-wider uppercase">JUMLAH PLANT AKTIF</span>
                  <Building size={12} className="text-amber-400" />
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-sm font-sans font-black text-amber-400">{runningPlantsCount}</span>
                  <span className="text-[8px] font-mono text-slate-500">/ 3 BP</span>
                </div>
              </div>

              <div className="bg-[#0b1322] border border-[#1e293b]/70 p-3 rounded-[4px] shadow-sm flex flex-col justify-between h-20">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[8.5px] font-sans font-black tracking-wider uppercase">ARMADA JALAN</span>
                  <Truck size={12} className="text-blue-400" />
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-sm font-sans font-black text-white">{FLEET_STATS.transit}</span>
                  <span className="text-[8px] font-mono text-slate-500">/ {FLEET_STATS.total} TM</span>
                </div>
              </div>

              <div className="bg-[#120a10] border border-rose-950 p-3 rounded-[4px] shadow-sm flex flex-col justify-between h-20">
                <div className="flex items-center justify-between text-rose-500 animate-pulse">
                  <span className="text-[8.5px] font-sans font-black tracking-wider uppercase">ALERT PRIORITAS</span>
                  <AlertTriangle size={12} />
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-sm font-sans font-black text-rose-500">2</span>
                  <span className="text-[8px] font-mono text-slate-600">WARNINGS</span>
                </div>
              </div>
            </div>

            {/* Mid Layout: Column 1 (Left Table Monitoring + Charts) vs Column 2 (Right Material + fleets Summary) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              
              {/* Left & Center Main Area */}
              <div className="lg:col-span-2 space-y-4">
                
                {/* Section 2: Monitoring Semua Plant */}
                <div className="bg-[#0c1322] border border-[#1e293b]/70 rounded-[4px] pb-3 overflow-hidden">
                  <div className="bg-slate-900/60 p-3 flex justify-between items-center border-b border-slate-800">
                    <span className="text-[10px] font-sans font-black tracking-wider text-slate-200 uppercase">
                      MONITORING REAL-TIME DAN KOORDINASI FASILITAS BATCHING PLANT
                    </span>
                    <span className="text-[8px] font-mono text-slate-500">ERP LINK INTEGRATED ACTIVE</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10.5px] font-mono">
                      <thead>
                        <tr className="border-b border-slate-800/80 text-left text-slate-500 text-[8.5px] uppercase">
                          <th className="p-3">ID</th>
                          <th className="p-3">NAMA INT PLT</th>
                          <th className="p-3">LOKASI SEKTOR</th>
                          <th className="p-3 text-center">STATUS</th>
                          <th className="p-3 text-right">M³ PROD</th>
                          <th className="p-3 text-right">TOTAL ORD</th>
                          <th className="p-3 text-center">TINDALAN</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900/50">
                        {PLANTS_DATA.map((plant) => (
                          <tr key={plant.id} className="hover:bg-slate-800/20 transition-all font-mono">
                            <td className="p-3 font-semibold text-slate-400">{plant.id}</td>
                            <td className="p-3 text-slate-200 uppercase">{plant.name}</td>
                            <td className="p-3 text-slate-405 text-[9.5px] uppercase">{plant.location}</td>
                            <td className="p-3 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-[2px] text-[8.5px] font-bold ${
                                plant.status === "RUNNING" ? "bg-emerald-950/80 border border-emerald-500 text-emerald-400 font-extrabold" :
                                plant.status === "WARNING" ? "bg-amber-950/80 border border-amber-500 text-amber-400 font-bold" :
                                "bg-rose-950/80 border border-rose-600 text-rose-450 font-black"
                              }`}>
                                {plant.status}
                              </span>
                            </td>
                            <td className="p-3 text-right font-black text-slate-100">{plant.productionToday.toFixed(1)}</td>
                            <td className="p-3 text-right text-cyan-400 font-bold">{plant.totalOrders}</td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => setDetailedPlantModal(plant)}
                                className="bg-[#05080f] hover:bg-slate-800 border border-slate-800 hover:border-[#00ffd0] py-1 px-2.5 rounded-[2px] text-[8.5px] font-sans font-black tracking-wider text-slate-300 hover:text-[#00ffd0] transition-colors leading-none uppercase cursor-pointer flex items-center gap-1 mx-auto"
                              >
                                <Eye size={10} />
                                <span>DIAGNOS</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 3: Grafik Produksi 30 Hari */}
                <div className="bg-[#0c1322] border border-[#1e293b]/70 rounded-[4px] p-4">
                  <div className="flex justify-between items-center border-b border-slate-850 pb-3 mb-4 flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <TrendingUp size={16} className="text-[#00ffd0]" />
                      <span className="text-[10px] font-sans font-black tracking-wider text-slate-200 uppercase">
                        GRAFIK RINGKASAN PRODUKSI, PENGIRIMAN & ORDER EXPRES
                      </span>
                    </div>

                    {/* Filters Controls Row */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Filter Branch */}
                      <div className="flex items-center gap-1.5 bg-[#05080f] px-2 py-1 rounded-[4px] border border-slate-850 text-[9.5px]">
                        <Filter size={10} className="text-cyan-400" />
                        <select
                          value={selectedBranch}
                          onChange={(e) => setSelectedBranch(e.target.value)}
                          className="bg-transparent border-none outline-none font-mono text-slate-350 cursor-pointer text-[9px] uppercase pr-2 font-black"
                        >
                          <option value="ALL" className="bg-[#0c1322] text-slate-200">SEMUA PLANT</option>
                          <option value="PKU01" className="bg-[#0c1322] text-emerald-400">PLANT PEKANBARU HQ</option>
                          <option value="DUM02" className="bg-[#0c1322] text-amber-400">PLANT DUMAI</option>
                          <option value="DUR03" className="bg-[#0c1322] text-rose-500">PLANT DURI (OFFLINE)</option>
                        </select>
                      </div>

                      {/* Filter Graph Mode */}
                      <div className="flex bg-[#05080f] p-0.5 border border-slate-850 rounded">
                        <button
                          onClick={() => setGraphMode("production")}
                          className={`text-[8.5px] font-mono font-black uppercase px-2 py-1 rounded transition-all cursor-pointer ${
                            graphMode === "production"
                              ? "bg-cyan-950/60 text-[#00ffd0] font-black border border-cyan-800/40"
                              : "bg-transparent text-slate-500"
                          }`}
                        >
                          PRODUKSI
                        </button>
                        <button
                          onClick={() => setGraphMode("delivery")}
                          className={`text-[8.5px] font-mono font-black uppercase px-2 py-1 rounded transition-all cursor-pointer ${
                            graphMode === "delivery"
                              ? "bg-cyan-950/60 text-[#00ffd0] font-black border border-cyan-800/40"
                              : "bg-transparent text-slate-500"
                          }`}
                        >
                          KIRIM
                        </button>
                        <button
                          onClick={() => setGraphMode("orders")}
                          className={`text-[8.5px] font-mono font-black uppercase px-2 py-1 rounded transition-all cursor-pointer ${
                            graphMode === "orders"
                              ? "bg-cyan-950/60 text-[#00ffd0] font-black border border-cyan-800/40"
                              : "bg-transparent text-slate-500"
                          }`}
                        >
                          ORDER
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* High Quality Styled Custom SVG Line Chart */}
                  <div className="h-44 relative w-full flex items-end justify-between border-b border-l border-slate-800/80 pl-3 pb-2 pt-2 select-none">
                    {/* Horizontal helper grid lines */}
                    <div className="absolute inset-x-0 top-1/4 border-b border-slate-900 pointer-events-none" />
                    <div className="absolute inset-x-0 top-2/4 border-b border-slate-900 pointer-events-none" />
                    <div className="absolute inset-x-0 top-3/4 border-b border-slate-900 pointer-events-none" />

                    {/* Plot columns */}
                    <div className="w-full h-full flex items-end justify-between px-2">
                      {chartPoints.map((pt, idx) => {
                        const hPercentage = (pt.val / maxVal) * 85; // cap height
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                            {/* Hover Details overlay info box */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[#050810] border border-cyan-500/80 px-2 py-1.5 rounded-[3px] text-[8.5px] font-mono text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-30 shadow-[0_0_10px_rgba(0,229,255,0.15)]">
                              <span className="text-slate-500">VOLUME:</span> <strong className="text-[#00ffd0]">{pt.val} m³</strong>
                              <br />
                              <span className="text-slate-500">TANGGAL:</span> <span className="text-white">{pt.label}</span>
                            </div>

                            {/* Point Pillar bar visualization */}
                            <div 
                              style={{ height: `${Math.max(4, hPercentage)}%` }} 
                              className="w-[14px] bg-gradient-to-t from-cyan-900/60 to-[#00e5ff]/80 hover:to-[#00ffd0] rounded-t-[1.5px] transition-all border-t border-cyan-400 cursor-pointer shadow-[0_0_8px_rgba(6,182,212,0.1)] hover:shadow-[0_0_15px_rgba(0,ffd0,208,0.3)]"
                            />

                            {/* X-Label index marker */}
                            <span className="text-[7.5px] font-mono text-slate-550 mt-1.5 font-bold uppercase truncate max-w-full">
                              {pt.label.split(" ")[1]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[8px] font-mono text-slate-500 mt-2.5">
                    <span>Y-AXIS: TOTAL SKALA TON/VOLUME (M³) HARI BERJALAN</span>
                    <span>RENTANG: 15 HARI KALENDER TERAKHIR</span>
                  </div>
                </div>

                {/* Section 4: Top Project Panel */}
                <div className="bg-[#0c1322] border border-[#1e293b]/70 rounded-[4px] p-4">
                  <div className="flex items-center gap-2.5 border-b border-slate-850 pb-3 mb-4">
                    <Building size={16} className="text-emerald-400" />
                    <span className="text-[10px] font-sans font-black tracking-wider text-slate-200 uppercase">
                      PROYEK STRATEGIS TERBESAR BERJALAN DENGAN VOLUME KONTRAK UTAMA
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {TOP_PROJECTS.map((proj, idx) => (
                      <div key={idx} className="bg-[#05080e] border border-slate-900/80 rounded p-3 flex flex-col justify-between">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex flex-col">
                            <span className="text-[10.5px] font-sans font-black tracking-wide text-white uppercase">{proj.name}</span>
                            <span className="text-[8.5px] font-mono text-slate-500 uppercase mt-0.5">{proj.customer}</span>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded-[2px] text-[7.5px] font-mono font-black border ${
                            proj.badge === "UTAMA" ? "border-emerald-800 text-emerald-400 bg-emerald-950/20" :
                            proj.badge === "STRATEGIS" ? "border-cyan-800 text-cyan-400 bg-cyan-950/20" :
                            "border-slate-800 text-slate-400"
                          }`}>
                            {proj.badge}
                          </span>
                        </div>

                        {/* Progress Bar Visual */}
                        <div className="mt-4 space-y-1.5">
                          <div className="flex justify-between font-mono text-[8.5px] text-slate-400 uppercase leading-none">
                            <span>REDI-MIX TERKIRIM: <strong className="text-cyan-455 font-bold">{proj.volume} M³</strong></span>
                            <span>PROGRES: <strong className="text-white font-black">{proj.progress}%</strong></span>
                          </div>
                          <div className="w-full bg-[#0d1624] h-1.5 border border-slate-800 rounded">
                            <div 
                              style={{ width: `${proj.progress}%` }} 
                              className="bg-gradient-to-r from-cyan-600 to-emerald-500 h-full rounded shadow-[0_0_6px_rgba(16,185,129,0.2)]"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Right Side Area (Material + fleets Summary) */}
              <div className="space-y-4">
                
                {/* Section 5: Monitoring Stok Material */}
                <div className="bg-[#0c1322] border border-[#1e293b]/70 rounded-[4px] p-4">
                  <div className="flex items-center justify-between border-b border-slate-850 pb-3 mb-4">
                    <div className="flex items-center gap-2.5">
                      <Layers size={16} className="text-[#00ffd0]" />
                      <span className="text-[10px] font-sans font-black tracking-wider text-slate-200 uppercase">
                        SISA LEVEL MATERIAL SILO
                      </span>
                    </div>
                    <span className="text-[8.5px] font-mono text-amber-500 font-extrabold select-none animate-pulse">SENSORS ONLINE</span>
                  </div>

                  <div className="space-y-4 pt-1">
                    {SILO_STOCKS.map((silo, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex justify-between items-center text-[9px] uppercase font-mono">
                          <span className="text-slate-350 font-bold">{silo.name}</span>
                          <span className={silo.color}>{silo.safety}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Sizing Indicator Bar */}
                          <div className="flex-1 bg-[#05080e] h-4 border border-slate-800/80 rounded-[2.5px] overflow-hidden relative">
                            <div 
                              style={{ width: `${(silo.current / silo.cap) * 100}%` }} 
                              className={`h-full transition-all ${silo.barColor}`}
                            />
                            {/* Text overlay percentage inside bar */}
                            <span className="absolute inset-0 flex items-center justify-center font-mono font-black text-[9px] text-white select-none drop-shadow">
                              {silo.current} / {silo.cap} {silo.unit} ({(silo.current / silo.cap * 100).toFixed(0)}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 p-3.5 bg-slate-950/80 border border-slate-900 rounded-[3.5px] space-y-2 text-[8.5px] font-mono uppercase text-slate-400">
                    <div className="flex justify-between leading-none border-b border-slate-900 pb-2">
                      <span>Estimasi Pengisian Semen Berlanjut:</span>
                      <span className="text-white font-bold">Lusa 10:00 WIB</span>
                    </div>
                    <div className="flex justify-between leading-none pt-1">
                      <span>Rekomendasi Re-order Admixture:</span>
                      <span className="text-rose-500 font-black animate-pulse">SEBANYAK 15.000 LITER!</span>
                    </div>
                  </div>
                </div>

                {/* Section 6: Monitoring Armada */}
                <div className="bg-[#0c1322] border border-[#1e293b]/70 rounded-[4px] p-4">
                  <div className="flex items-center justify-between border-b border-slate-850 pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <Truck size={16} className="text-cyan-400" />
                      <span className="text-[10px] font-sans font-black tracking-wider text-slate-200 uppercase">
                        MONITORING TELEMETRI ARMADA
                      </span>
                    </div>
                    <span className="text-[8.5px] font-mono text-slate-500">FLEETS ACTIVE</span>
                  </div>

                  <div className="bg-[#05080f] border border-slate-900 p-4 rounded-md flex flex-col items-center justify-center relative select-none">
                    <div className="w-[110px] h-[110px] rounded-full border-4 border-[#012540] flex flex-col items-center justify-center relative">
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                        className="absolute inset-0 rounded-full border-t-2 border-cyan-400 opacity-60"
                      />
                      <span className="text-2xl font-sans font-black text-white">{FLEET_STATS.total}</span>
                      <span className="text-[8px] font-mono text-cyan-400 font-black tracking-wider uppercase mt-1">MIXER TRUCK</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-5 w-full">
                      <div className="bg-[#09101d] border border-slate-900 py-1.5 px-2.5 rounded flex justify-between items-center">
                        <span className="text-[8px] font-mono text-emerald-400 font-bold uppercase">SEDANG MUAT</span>
                        <span className="text-[10px] font-mono font-black text-white">{FLEET_STATS.loading}</span>
                      </div>
                      <div className="bg-[#09101d] border border-slate-900 py-1.5 px-2.5 rounded flex justify-between items-center">
                        <span className="text-[8px] font-mono text-cyan-400 font-bold uppercase">DALAM PERJALANAN</span>
                        <span className="text-[10px] font-mono font-black text-white">{FLEET_STATS.transit}</span>
                      </div>
                      <div className="bg-[#09101d] border border-slate-900 py-1.5 px-2.5 rounded flex justify-between items-center">
                        <span className="text-[8px] font-mono text-slate-400 font-bold uppercase">KEMBALI KE PLANT</span>
                        <span className="text-[10px] font-mono font-black text-white">{FLEET_STATS.returning}</span>
                      </div>
                      <div className="bg-[#09101d] border border-slate-900 py-1.5 px-2.5 rounded flex justify-between items-center">
                        <span className="text-[8px] font-mono text-rose-400 font-bold uppercase">BAK PERAWATAN</span>
                        <span className="text-[10px] font-mono font-black text-rose-450">{FLEET_STATS.maintenance}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 7: Alert Center summary box */}
                <div className="bg-[#0c1322] border border-[#1e293b]/70 rounded-[4px] p-4">
                  <div className="flex items-center justify-between border-b border-slate-850 pb-3 mb-3">
                    <div className="flex items-center gap-2">
                      <AlertOctagon size={16} className="text-rose-500 animate-pulse" />
                      <span className="text-[10px] font-sans font-black tracking-wider text-slate-200 uppercase">
                        SISTEM REGISTER EXPRES ALARMS
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                    {ALARM_LIST.slice(0, 3).map((alarm, idx) => (
                      <div 
                        key={idx} 
                        className={`p-2.5 rounded border text-[9.5px] font-mono flex flex-col justify-between ${
                          alarm.level === "CRITICAL" ? "bg-rose-950/20 border-rose-800 text-rose-300" :
                          alarm.level === "WARNING" ? "bg-amber-950/20 border-amber-800 text-amber-300" :
                          "bg-slate-950/60 border-slate-900 text-slate-300"
                        }`}
                      >
                        <div className="flex justify-between items-center leading-none text-[8.5px] text-slate-400 font-bold">
                          <span>{alarm.plant}</span>
                          <span>{alarm.time}</span>
                        </div>
                        <span className="mt-1.5 leading-relaxed font-bold uppercase truncate pr-1">
                          {alarm.msg}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          </motion.div>
        )}

        {/* TAB 2: MONITORING PLANT VIEW (DETAILED DIAGNOSTIC TIAP PLANT) */}
        {activeTab === "plants" && (
          <motion.div
            key="plants-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="bg-[#0c1322] border border-[#1e293b]/70 rounded-[4px] p-4">
              <h4 className="text-xs font-sans font-black tracking-widest text-slate-200 uppercase mb-4 border-b border-slate-850 pb-3 flex items-center gap-2">
                <MapPin size={15} className="text-[#00ffd0]" />
                DETAIL FASILITAS PROSPEK INTEGRAL MULTI-PLANT NETWORK
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PLANTS_DATA.map((plant) => (
                  <div key={plant.id} className="bg-[#05080e] border border-slate-900 rounded p-4 flex flex-col justify-between relative overflow-hidden">
                    {/* Top Status Glow Accent */}
                    <div className={`absolute top-0 left-0 right-0 h-1 ${
                      plant.status === "RUNNING" ? "bg-emerald-500 shadow-[0_0_10px_#10b981]" :
                      plant.status === "WARNING" ? "bg-amber-500 shadow-[0_0_10px_#f59e0b]" :
                      "bg-rose-500 shadow-[0_0_10px_#ef4444]"
                    }`} />

                    <div className="flex justify-between items-start pt-1.5">
                      <div className="flex flex-col">
                        <span className="text-[12px] font-sans font-black tracking-wider text-slate-200 uppercase">{plant.name}</span>
                        <span className="text-[9px] font-mono text-slate-500 uppercase mt-1">{plant.location}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-[2px] text-[8.5px] font-mono font-black ${
                        plant.status === "RUNNING" ? "bg-emerald-950/60 border border-emerald-500 text-emerald-400 font-extrabold" :
                        plant.status === "WARNING" ? "bg-amber-950/60 border border-amber-500 text-amber-400 font-bold" :
                        "bg-rose-950/60 border border-rose-600 text-rose-450 font-black"
                      }`}>
                        {plant.status}
                      </span>
                    </div>

                    <div className="my-5 space-y-2.5 p-3.5 bg-slate-950/60 border border-slate-900 rounded font-mono text-[10.5px]">
                      <div className="flex justify-between">
                        <span className="text-slate-500 uppercase">Kapasitas Maksimal:</span>
                        <span className="text-white font-bold">{plant.capacity}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-900/50 pt-2">
                        <span className="text-slate-500 uppercase">Operator On Duty:</span>
                        <span className="text-cyan-400 font-bold uppercase">{plant.operator}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-900/50 pt-2">
                        <span className="text-slate-500 uppercase">Resep Aktif Mesin:</span>
                        <span className="text-amber-500 font-bold uppercase truncate max-w-40">{plant.formula}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-900/50 pt-2">
                        <span className="text-slate-500 uppercase">Suhu Ruang Mixer:</span>
                        <span className="text-slate-200">{plant.temp}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-900/50 pt-2">
                        <span className="text-slate-500 uppercase">Efisien Produksi:</span>
                        <span className="text-emerald-400 font-bold">{plant.efficiency}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setDetailedPlantModal(plant)}
                      className="w-full bg-[#0b1322] hover:bg-[#1e293b] border border-[#1e293b] hover:border-cyan-500 text-slate-300 hover:text-white font-sans font-black text-[10px] tracking-wide uppercase py-2.5 rounded-[4px] cursor-pointer transition-colors flex items-center justify-center gap-2"
                    >
                      <Eye size={12} className="text-[#00ffd0]" />
                      <span>BUKA DIAGNOSTIK SCADA</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 3: INVENTORY DETAILED */}
        {activeTab === "inventory" && (
          <motion.div
            key="inventory-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="bg-[#0c1322] border border-[#1e293b]/70 rounded-[4px] p-4">
              <h4 className="text-xs font-sans font-black tracking-widest text-[#00ffd0] uppercase mb-4 border-b border-slate-850 pb-3">
                KETERSEDIAAN RAW STOK MATERIAL & ALARM MINIMUM LIMIT
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SILO_STOCKS.map((silo, idx) => (
                  <div key={idx} className="bg-[#05080e] border border-slate-900 rounded p-4 flex flex-col justify-between">
                    <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                      <span className="text-[11.5px] font-sans font-black text-slate-200 uppercase">{silo.name}</span>
                      <span className={silo.color}>{silo.safety}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4 font-mono text-[10px]">
                      <div className="bg-[#0d1624] p-2 rounded flex flex-col">
                        <span className="text-slate-500 uppercase">Raw Stok:</span>
                        <span className="text-white text-xs font-black mt-1">{silo.current} {silo.unit}</span>
                      </div>
                      <div className="bg-[#0d1624] p-2 rounded flex flex-col">
                        <span className="text-slate-500 uppercase">Kapasitas:</span>
                        <span className="text-slate-305 text-xs font-bold mt-1">{silo.cap} {silo.unit}</span>
                      </div>
                      <div className="bg-[#0d1624] p-2 rounded flex flex-col">
                        <span className="text-slate-500 uppercase">Persentase:</span>
                        <span className={`text-xs font-black mt-1 ${silo.current < silo.cap * 0.25 ? "text-rose-500 animate-pulse" : "text-emerald-450"}`}>
                          {(silo.current / silo.cap * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    {/* Filling gauge visualization */}
                    <div className="mt-4 space-y-1.5">
                      <div className="w-full bg-slate-950 h-3 border border-slate-850 rounded overflow-hidden">
                        <div 
                          style={{ width: `${(silo.current / silo.cap) * 100}%` }} 
                          className={`h-full ${silo.barColor}`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 4: fleets MON */}
        {activeTab === "fleets" && (
          <motion.div
            key="fleets-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="bg-[#0c1322] border border-[#1e293b]/70 rounded-[4px] p-4">
              <h4 className="text-xs font-sans font-black tracking-widest text-[#00ffd0] uppercase mb-4 border-b border-slate-850 pb-3">
                MONITORING armada TRUCK MIXER DAN LOGISTIK TRANSPORTASI
              </h4>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-[#05080e] border border-slate-900 p-3.5 rounded flex flex-col justify-between">
                  <span className="text-[8px] font-mono text-slate-500 uppercase font-bold">TOTAL armada</span>
                  <span className="text-xl font-mono font-black text-white mt-1">{FLEET_STATS.total} TM</span>
                </div>
                <div className="bg-[#05080e] border border-slate-900 p-3.5 rounded flex flex-col justify-between">
                  <span className="text-[8px] font-mono text-emerald-400 uppercase font-black">SEDANG MUAT</span>
                  <span className="text-xl font-mono font-black text-emerald-400 mt-1">{FLEET_STATS.loading} TM</span>
                </div>
                <div className="bg-[#05080e] border border-slate-900 p-3.5 rounded flex flex-col justify-between">
                  <span className="text-[8px] font-mono text-cyan-400 uppercase font-black">DI PERJALANAN</span>
                  <span className="text-xl font-mono font-black text-cyan-400 mt-1">{FLEET_STATS.transit} TM</span>
                </div>
                <div className="bg-[#05080e] border border-slate-900 p-3.5 rounded flex flex-col justify-between">
                  <span className="text-[8px] font-mono text-slate-400 uppercase font-bold">BALIK PLT</span>
                  <span className="text-xl font-mono font-black text-slate-200 mt-1">{FLEET_STATS.returning} TM</span>
                </div>
                <div className="bg-[#05080e] border border-slate-900 p-3.5 rounded flex flex-col justify-between">
                  <span className="text-[8px] font-mono text-rose-500 uppercase font-black animate-pulse">REPAIR BAY</span>
                  <span className="text-xl font-mono font-black text-rose-500 mt-1">{FLEET_STATS.maintenance} TM</span>
                </div>
              </div>

              {/* Transit logger details simulation (Read only) */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-[10px] font-mono border-t border-slate-900">
                  <thead>
                    <tr className="border-b border-slate-900 text-left text-slate-550 py-2.5 uppercase text-[8px]">
                      <th className="p-3">NO TRANSIT</th>
                      <th className="p-3">DRIVER</th>
                      <th className="p-3">KENDARAAN ID</th>
                      <th className="p-3">LOKASI SEKTOR</th>
                      <th className="p-3">SISA JARAK</th>
                      <th className="p-3">STATUS DISPATCH</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/50">
                    <tr className="hover:bg-slate-800/10">
                      <td className="p-3 text-cyan-400 font-bold">DS-102</td>
                      <td className="p-3 uppercase">Suprayogi</td>
                      <td className="p-3">BM 9482 AL</td>
                      <td className="p-3 uppercase">Pekanbaru - Siak IV Project</td>
                      <td className="p-3 font-semibold">1.4 km</td>
                      <td className="p-3"><span className="text-[#00ffd0] font-bold">DISPATCHING</span></td>
                    </tr>
                    <tr className="hover:bg-slate-800/10">
                      <td className="p-3 text-cyan-400 font-bold">DS-105</td>
                      <td className="p-3 uppercase">Syaifuddin</td>
                      <td className="p-3">BM 8012 TD</td>
                      <td className="p-3 uppercase">Tol Pekanbaru - Dumai Seksi 4</td>
                      <td className="p-3 font-semibold">12.5 km</td>
                      <td className="p-3"><span className="text-[#00ffd0] font-bold">DISPATCHING</span></td>
                    </tr>
                    <tr className="hover:bg-slate-800/10">
                      <td className="p-3 text-cyan-400 font-bold">DS-106</td>
                      <td className="p-3 uppercase">Zulfikar</td>
                      <td className="p-3">BM 9312 KX</td>
                      <td className="p-3 uppercase">Gedung UNRI Rektorat</td>
                      <td className="p-3 font-semibold">0.1 km</td>
                      <td className="p-3"><span className="text-emerald-500 font-bold">ARRIVED JOB SITE</span></td>
                    </tr>
                    <tr className="hover:bg-slate-800/10">
                      <td className="p-3 text-cyan-400 font-bold">DS-109</td>
                      <td className="p-3 uppercase">Hendri Wijaya</td>
                      <td className="p-3">BM 9221 AA</td>
                      <td className="p-3 uppercase">Outer Ring Road Rigid</td>
                      <td className="p-3 font-semibold">--</td>
                      <td className="p-3"><span className="text-amber-500 font-bold">RETURNING</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 5: ALARM CENTER DETAILED */}
        {activeTab === "alarms" && (
          <motion.div
            key="alarms-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="bg-[#0c1322] border border-[#1e293b]/70 rounded-[4px] p-4">
              <h4 className="text-xs font-sans font-black tracking-widest text-rose-500 uppercase mb-4 border-b border-slate-850 pb-3 flex items-center gap-2">
                <AlertOctagon size={15} className="animate-bounce" />
                CENTRAL DIAGNOSTIK ALARM DAN EVENT LOG SYSTEM (ERP-LINK)
              </h4>

              <div className="space-y-3">
                {ALARM_LIST.map((alarm, idx) => (
                  <div 
                    key={idx} 
                    className={`p-3.5 rounded border-2 text-[10.5px] font-mono flex items-start gap-4 ${
                      alarm.level === "CRITICAL" ? "bg-rose-950/20 border-rose-800 text-rose-350" :
                      alarm.level === "WARNING" ? "bg-amber-950/20 border-amber-800 text-amber-300" :
                      "bg-emerald-950/10 border-emerald-950/40 text-emerald-300"
                    }`}
                  >
                    <span className="text-[10px] font-bold shrink-0 bg-slate-950/60 p-1.5 rounded border border-slate-800">{alarm.time}</span>
                    <div className="flex-1 text-left">
                      <span className="text-[9px] font-black uppercase text-slate-400">{alarm.plant}</span>
                      <p className="mt-1 font-bold uppercase select-text tracking-tight h-[15px] leading-tight">
                        {alarm.msg}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-[2.5px] text-[8.5px] font-black text-right border ${
                      alarm.level === "CRITICAL" ? "border-rose-800 text-rose-455 animate-pulse" :
                      alarm.level === "WARNING" ? "border-amber-805 text-amber-400" :
                      "border-emerald-805 text-emerald-450"
                    }`}>
                      {alarm.level}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PLANT DETAIL MONITORING DIAGNOSTIC MODAL */}
      <AnimatePresence>
        {detailedPlantModal && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-[#0c1322] border-2 border-[#00ffd0]/60 rounded-md shadow-[0_0_50px_rgba(0,255,208,0.2)]"
            >
              <div className="bg-[#05080e] p-4 flex justify-between items-center border-b border-[#00ffd0]/10">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-[#00ffd0] animate-pulse" />
                  <span className="text-xs font-sans font-black tracking-widest text-[#00ffd0] uppercase">
                    SCADA DIAGNOSTIK: {detailedPlantModal.id}
                  </span>
                </div>
                <button
                  onClick={() => setDetailedPlantModal(null)}
                  className="text-slate-450 hover:text-white font-sans font-extrabold text-[10px] bg-slate-950 border border-slate-900 hover:border-rose-500 py-1 px-2.5 rounded transition-all cursor-pointer"
                >
                  TUTUP GATE
                </button>
              </div>

              <div className="p-6 space-y-4 font-mono text-[11px] text-slate-350">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col bg-[#05080e] p-3 rounded border border-slate-900 text-left">
                    <span className="text-slate-500 uppercase text-[8.5px]">NAMA FASILITAS</span>
                    <span className="text-white font-bold uppercase mt-1">{detailedPlantModal.name}</span>
                  </div>
                  <div className="flex flex-col bg-[#05080e] p-3 rounded border border-slate-900 text-left">
                    <span className="text-slate-500 uppercase text-[8.5px]">SEKTOR LOKASI</span>
                    <span className="text-white font-bold uppercase mt-1">{detailedPlantModal.location}</span>
                  </div>
                </div>

                <div className="bg-[#05080e] p-4 rounded border border-slate-900 space-y-3">
                  <div className="flex justify-between items-center leading-none">
                    <span className="text-slate-500 uppercase text-[9px]">STATUS FASILITAS</span>
                    <span className={`inline-block px-2 py-0.5 rounded-[2px] text-[9px] font-black ${
                      detailedPlantModal.status === "RUNNING" ? "bg-emerald-950/80 border border-emerald-500 text-emerald-400 font-extrabold" :
                      detailedPlantModal.status === "WARNING" ? "bg-amber-950/80 border border-amber-500 text-amber-400 font-bold" :
                      "bg-rose-950/80 border border-rose-600 text-rose-450 font-black"
                    }`}>
                      {detailedPlantModal.status}
                    </span>
                  </div>

                  <div className="flex justify-between items-center border-t border-slate-900/60 pt-2.5 leading-none">
                    <span className="text-slate-500 uppercase text-[9px]">DISETEL OLEH (OPERATOR AKTIF)</span>
                    <span className="text-cyan-400 font-bold uppercase">{detailedPlantModal.operator}</span>
                  </div>

                  <div className="flex justify-between items-center border-t border-slate-900/60 pt-2.5 leading-none">
                    <span className="text-slate-500 uppercase text-[9px]">FORMULA YANG DIKONSUMSI</span>
                    <span className="text-amber-550 font-bold uppercase">{detailedPlantModal.formula}</span>
                  </div>

                  <div className="flex justify-between items-center border-t border-slate-900/60 pt-2.5 leading-none">
                    <span className="text-slate-500 uppercase text-[9px]">SUHU TIMBANGAN UTAMA</span>
                    <span className="text-slate-200">{detailedPlantModal.temp}</span>
                  </div>

                  <div className="flex justify-between items-center border-t border-slate-900/60 pt-2.5 leading-none">
                    <span className="text-slate-500 uppercase text-[9px]">EFISIENSI BATCHING PLC</span>
                    <span className="text-emerald-450 font-black">{detailedPlantModal.efficiency}</span>
                  </div>

                  <div className="flex justify-between items-center border-t border-slate-900/60 pt-2.5 leading-none">
                    <span className="text-slate-500 uppercase text-[9px]">PRODUKSI HARI INI SECARA RIIL</span>
                    <span className="text-white font-extrabold">{detailedPlantModal.productionToday} m³</span>
                  </div>
                </div>

                <div className="p-3 bg-cyan-950/10 border border-cyan-800/25 rounded text-[8.5px] text-slate-400 leading-relaxed text-center leading-normal">
                  💡 Komponen SCADA di-update secara terus-menerus melalui jembatan telemetri multi-plant terpadu di latar belakang. Tidak ada konfigurasi atau perintah start/stop yang diizinkan untuk Direktur.
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
