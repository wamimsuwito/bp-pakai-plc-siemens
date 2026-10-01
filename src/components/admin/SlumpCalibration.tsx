import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Gauge, 
  Settings2, 
  PlusCircle, 
  Database, 
  TrendingUp, 
  Binary, 
  Bot, 
  Radio, 
  Sparkles, 
  Trash2, 
  Check, 
  AlertTriangle, 
  RefreshCw,
  Edit2,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  EyeOff,
  Eye
} from "lucide-react";
import { webSerialService } from "../../lib/webSerial";

export interface CalibrationPoint {
  id: string;
  timestamp: string;
  epoch: number;
  operator: string;
  mixDesign: string; // "K225", "K250", "K300", "K350", "K400"
  ampere: number;
  slumpAktual: number;
  estimatedSlump: number;
  error: number;
  ignored: boolean;
  keterangan: string;
}

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

const DEFAULT_POINTS: CalibrationPoint[] = [
  // K-300 default points
  { id: "cal-1", timestamp: "2026-05-26 08:30", epoch: 1779784200000, operator: "admin", mixDesign: "K300", ampere: 98.2, slumpAktual: 13.5, estimatedSlump: 13.2, error: 0.3, ignored: false, keterangan: "Test Lapangan 1" },
  { id: "cal-2", timestamp: "2026-05-26 09:15", epoch: 1779786900000, operator: "admin", mixDesign: "K300", ampere: 104.5, slumpAktual: 11.0, estimatedSlump: 11.1, error: -0.1, ignored: false, keterangan: "Semen agak kering" },
  { id: "cal-3", timestamp: "2026-05-26 10:45", epoch: 1779792300000, operator: "admin", mixDesign: "K300", ampere: 110.1, slumpAktual: 9.0, estimatedSlump: 9.2, error: -0.2, ignored: false, keterangan: "Beton kental" },
  
  // K-250 default points
  { id: "cal-4", timestamp: "2026-05-26 09:00", epoch: 1779786000000, operator: "admin", mixDesign: "K250", ampere: 92.4, slumpAktual: 14.0, estimatedSlump: 13.8, error: 0.2, ignored: false, keterangan: "Normal test" },
  { id: "cal-5", timestamp: "2026-05-26 11:20", epoch: 1779794400000, operator: "admin", mixDesign: "K250", ampere: 102.0, slumpAktual: 10.5, estimatedSlump: 10.8, error: -0.3, ignored: false, keterangan: "Aduk lama" }
];

export const SlumpCalibration: React.FC = () => {
  // Load JMF dynamically from localStorage or defaults
  const [jmfList, setJmfList] = useState<JobMix[]>(() => {
    const saved = localStorage.getItem("batching_plant_jmf_list");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (err) {}
    }
    return DEFAULT_JOB_MIX_LIST;
  });

  // Database State
  const [points, setPoints] = useState<CalibrationPoint[]>(() => {
    const saved = localStorage.getItem("batching_plant_slump_calibration_data");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Normalize older/hardcoded names so they match JMF mutuBeton keys (e.g. K300 instead of K-300 FA)
          return parsed.map((p: any) => {
            let mix = p.mixDesign || "";
            if (mix === "K-300 FA") mix = "K300";
            if (mix === "K-250 NFA") mix = "K250";
            if (mix === "K-350 FA") mix = "K350";
            return { ...p, mixDesign: mix };
          });
        }
      } catch (e) {
        return DEFAULT_POINTS;
      }
    }
    return DEFAULT_POINTS;
  });

  // Active Collapsed Submenus
  const [collapsed, setCollapsed] = useState({
    dashboard: false,
    addCalib: false,
    dataCalib: false,
    graphics: false,
    formula: false,
    learning: false,
    sensor: false
  });

  // Menu toggler
  const toggleCollapse = (menu: keyof typeof collapsed) => {
    setCollapsed(prev => ({ ...prev, [menu]: !prev[menu] }));
  };

  // Form input states
  const [formMixDesign, setFormMixDesign] = useState<string>(() => {
    const saved = localStorage.getItem("batching_plant_jmf_list");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0].mutuBeton;
      } catch (err) {}
    }
    return "K300";
  });
  const [formAmpere, setFormAmpere] = useState("");
  const [formSlump, setFormSlump] = useState("");
  const [formKeterangan, setFormKeterangan] = useState("");
  const [autoLearningActive, setAutoLearningActive] = useState<boolean>(() => {
    return localStorage.getItem("slump_auto_learning") !== "false";
  });

  // Selected mix design for chart filtering
  const [selectedMixForChart, setSelectedMixForChart] = useState<string>(() => {
    const saved = localStorage.getItem("batching_plant_jmf_list");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0].mutuBeton;
      } catch (err) {}
    }
    return "K300";
  });

  // Real-time Ampere and Telemetry States
  const [liveAmpere, setLiveAmpere] = useState<number>(95.0);
  const [serialState, setSerialState] = useState<string>("DISCONNECTED");
  
  // Flash effect on manual get
  const [isFlashingAmpere, setIsFlashingAmpere] = useState(false);
  const [isSavedFlash, setIsSavedFlash] = useState(false);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem("batching_plant_slump_calibration_data", JSON.stringify(points));
  }, [points]);

  useEffect(() => {
    localStorage.setItem("slump_auto_learning", String(autoLearningActive));
  }, [autoLearningActive]);

  // Connect WebSerial telemetry and listen for JMF database updates
  useEffect(() => {
    const handleJmfUpdate = () => {
      const saved = localStorage.getItem("batching_plant_jmf_list");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setJmfList(parsed);
            
            // Validate and adjust selected mix designs if they no longer exist
            const activeMutuList = parsed.map(jmf => jmf.mutuBeton);
            setFormMixDesign(current => {
              if (activeMutuList.includes(current)) return current;
              return parsed[0].mutuBeton;
            });
            setSelectedMixForChart(current => {
              if (activeMutuList.includes(current)) return current;
              return parsed[0].mutuBeton;
            });
          }
        } catch (err) {}
      }
    };

    window.addEventListener("jmf_database_updated", handleJmfUpdate);

    // Read initials
    setSerialState(webSerialService.getStatus());

    // Register status change
    const onStatus = (newStatus: string) => {
      setSerialState(newStatus);
    };

    // Register active telemetry
    const onTelemetry = (data: any) => {
      if (data) {
        const ampVal = typeof data.mixerAmp === "number" ? data.mixerAmp : (typeof data.ampere === "number" ? data.ampere : null);
        if (ampVal !== null) {
          setLiveAmpere(parseFloat(ampVal.toFixed(1)));
        }
      }
    };

    webSerialService.registerStatusCallback(onStatus);
    webSerialService.registerTelemetryCallback(onTelemetry);

    return () => {
      window.removeEventListener("jmf_database_updated", handleJmfUpdate);
      webSerialService.unregisterStatusCallback(onStatus);
      webSerialService.unregisterTelemetryCallback(onTelemetry);
    };
  }, []);

  // Simulator fallbacks (If not connected, simulate twin shaft fluctuations when mixing sequence active)
  useEffect(() => {
    let timer: any = null;
    if (serialState !== "CONNECTED" && serialState !== "RECONNECTING") {
      // Simulate real-time ampere load fluctuation for elegant UI display
      timer = setInterval(() => {
        setLiveAmpere(current => {
          // Centered fluctuation around ~100 A with random noise
          const base = 101.5;
          const fluctuation = Math.sin(Date.now() / 3000) * 4.5 + (Math.random() - 0.5) * 1.5;
          return parseFloat((base + fluctuation).toFixed(1));
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [serialState]);

  // SYSTEM ESTIMATOR LOGIC
  // Calculate Regression Formula coefficients f(Ampere) for each Mix Design
  const activeFormulas = useMemo(() => {
    const designs = jmfList.map(jmf => jmf.mutuBeton);
    const formulas: Record<string, { slope: number; intercept: number; isDefault: boolean; count: number }> = {};

    designs.forEach(mix => {
      // Filter out points for this mix design that are not ignored
      const validPoints = points.filter(p => p.mixDesign === mix && !p.ignored);

      if (validPoints.length >= 2) {
        // Run Simple Least Squares Linear Regression
        const N = validPoints.length;
        let sumX = 0;
        let sumY = 0;
        let sumXY = 0;
        let sumX2 = 0;

        validPoints.forEach(p => {
          sumX += p.ampere;
          sumY += p.slumpAktual;
          sumXY += (p.ampere * p.slumpAktual);
          sumX2 += (p.ampere * p.ampere);
        });

        const denominator = (N * sumX2) - (sumX * sumX);
        if (Math.abs(denominator) > 0.0001) {
          const slope = ((N * sumXY) - (sumX * sumY)) / denominator;
          const intercept = (sumY - (slope * sumX)) / N;
          formulas[mix] = { slope, intercept, isDefault: false, count: N };
        } else {
          // Fallback to default physical estimate values
          formulas[mix] = { slope: -0.18, intercept: 30, isDefault: true, count: N };
        }
      } else {
        // Fallback default formula: higher ampere -> slump drops
        // Formula K300 default: Slump = -0.18A + 30 (e.g., 100A -> 12cm, 110A -> 10.2cm)
        let slope = -0.18;
        let intercept = 30;
        if (mix === "K250") {
          slope = -0.16;
          intercept = 28.5; // K250 lighter loads
        } else if (mix === "K350") {
          slope = -0.20;
          intercept = 32.2; // K350 heavier motor loads
        } else if (mix === "K225") {
          slope = -0.15;
          intercept = 27.0; // K225 lighter loads
        }
        formulas[mix] = { slope, intercept, isDefault: true, count: validPoints.length };
      }
    });

    return formulas;
  }, [points, jmfList]);

  // Live slump estimation function
  const estimateSlumpVal = (amp: number, mix: string): { val: number; confidence: "LOW CONFIDENCE" | "MEDIUM" | "HIGH CONFIDENCE"; formulaText: string } => {
    const formula = activeFormulas[mix] || Object.values(activeFormulas)[0] || { slope: -0.18, intercept: 30, count: 0 };
    const est = (formula.slope * amp) + formula.intercept;
    const boundedEst = Math.max(3, Math.min(24, est)); // Bound physical values 3cm to 24cm slump
    
    let confidence: "LOW CONFIDENCE" | "MEDIUM" | "HIGH CONFIDENCE" = "LOW CONFIDENCE";
    if (formula.count >= 4) {
      confidence = "HIGH CONFIDENCE";
    } else if (formula.count >= 2) {
      confidence = "MEDIUM";
    }

    const formulaText = `Slump = ${formula.slope.toFixed(2)} × Amp + ${formula.intercept.toFixed(1)}`;
    return { val: parseFloat(boundedEst.toFixed(1)), confidence, formulaText };
  };

  // Active Estimation Results for Monitor Dashboard
  const activeEstimatesForDashboard = useMemo(() => {
    return estimateSlumpVal(liveAmpere, formMixDesign);
  }, [liveAmpere, formMixDesign, activeFormulas]);

  // Check if current points are suspicious outliers
  const isSuspicious = (p: CalibrationPoint) => {
    // An outlier is if current estimate differs from actual slump by > 3.0 cm, or if Ampere is extreme (<70 or >140)
    const formula = activeFormulas[p.mixDesign];
    if (!formula) return false;
    const est = (formula.slope * p.ampere) + formula.intercept;
    return Math.abs(est - p.slumpAktual) > 3.0 || p.ampere < 70 || p.ampere > 140;
  };

  // Handlers
  const handleAmbilAmpere = () => {
    setFormAmpere(liveAmpere.toFixed(1));
    setIsFlashingAmpere(true);
    setTimeout(() => setIsFlashingAmpere(false), 800);
  };

  const handleSimpanKalibrasi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAmpere || !formSlump) return;

    const amp = parseFloat(formAmpere);
    const actualSlump = parseFloat(formSlump);
    if (isNaN(amp) || isNaN(actualSlump)) return;

    // Estimate based on previous equations before appending
    const previousEst = estimateSlumpVal(amp, formMixDesign).val;
    const err = parseFloat((previousEst - actualSlump).toFixed(1));

    const now = new Date();
    const timeStr = now.getFullYear() + "-" + 
                    String(now.getMonth() + 1).padStart(2, '0') + "-" + 
                    String(now.getDate()).padStart(2, '0') + " " + 
                    String(now.getHours()).padStart(2, '0') + ":" + 
                    String(now.getMinutes()).padStart(2, '0');

    const newPoint: CalibrationPoint = {
      id: "cal-" + Math.random().toString(36).substring(7).toUpperCase(),
      timestamp: timeStr,
      epoch: Date.now(),
      operator: "admin",
      mixDesign: formMixDesign,
      ampere: amp,
      slumpAktual: actualSlump,
      estimatedSlump: previousEst,
      error: err,
      ignored: false,
      keterangan: formKeterangan || "Kalibrasi test"
    };

    setPoints(prev => [newPoint, ...prev]);
    setFormAmpere("");
    setFormSlump("");
    setFormKeterangan("");
    setIsSavedFlash(true);
    setTimeout(() => setIsSavedFlash(false), 2500);
  };

  const handleDeletePoint = (id: string) => {
    setPoints(prev => prev.filter(p => p.id !== id));
  };

  const toggleIgnorePoint = (id: string) => {
    setPoints(prev => prev.map(p => p.id === id ? { ...p, ignored: !p.ignored } : p));
  };

  // SVG Chart Computations for clean canvas visualization in SCADA style
  const chartData = useMemo(() => {
    const mixPoints = points.filter(p => p.mixDesign === selectedMixForChart && !p.ignored);
    if (mixPoints.length === 0) return { scatter: [], formulaLine: [] };

    // Find min and max boundaries
    const amperes = mixPoints.map(p => p.ampere);
    const slumps = mixPoints.map(p => p.slumpAktual);

    const minAmp = Math.max(60, Math.min(...amperes, 80) - 5);
    const maxAmp = Math.min(150, Math.max(...amperes, 120) + 5);
    const minSlump = Math.max(2, Math.min(...slumps, 8) - 2);
    const maxSlump = Math.min(25, Math.max(...slumps, 18) + 2);

    // Grid coordinates
    const formula = activeFormulas[selectedMixForChart] || { slope: -0.18, intercept: 30 };
    
    // Create line points across the entire Amp range
    const step = (maxAmp - minAmp) / 10;
    const formulaLine = [];
    for (let i = 0; i <= 10; i++) {
      const a = minAmp + (step * i);
      const estS = Math.max(3, Math.min(24, (formula.slope * a) + formula.intercept));
      formulaLine.push({ ampere: a, slump: estS });
    }

    return {
      points: mixPoints,
      formulaLine,
      bounds: { minAmp, maxAmp, minSlump, maxSlump }
    };
  }, [points, selectedMixForChart, activeFormulas]);

  const numSavedCalibrations = points.filter(p => !p.ignored).length;

  return (
    <div id="slump-calibration-dashboard" className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto pr-1">
      
      {/* HEADER SECTION */}
      <div className="bg-[#0b1329]/80 border border-[#1e293b]/70 rounded-[6px] p-4 shrink-0 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#020617] border border-[#1e293b] rounded-[5px] text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)] animate-pulse">
              <Gauge size={18} />
            </div>
            <div>
              <h4 className="text-sm font-sans font-black tracking-widest text-white uppercase flex items-center gap-2">
                KALIBRASI ESTIMASI SLUMP BETON
                <span className="text-[7.5px] font-mono font-bold text-cyan-400 bg-cyan-950/50 border border-cyan-800/40 px-1.5 py-0.5 rounded uppercase">
                  Soft Sensor PLC
                </span>
              </h4>
              <p className="text-[9.5px] font-mono text-cyan-500 uppercase tracking-wider mt-0.5">
                Konversi Ampere Motor Mixer Twin Shaft menjadi Estimasi Nilai Slump Aktual Berdasarkan Regresi Linear
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5">
            <span className={`w-2.5 h-2.5 rounded-full ${
              serialState === "CONNECTED" ? "bg-emerald-400 animate-pulse" :
              serialState === "CONNECTING" || serialState === "RECONNECTING" ? "bg-amber-400 animate-pulse" :
              "bg-rose-500"
            }`} />
            <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-slate-300">
              AMP SENSOR: {serialState === "CONNECTED" ? "ONLINE (ARDUINO)" : `OFFLINE (FALLBACK)`}
            </span>
          </div>
        </div>
      </div>

      {/* CORE ESTIMATION MONITORING CARD */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 shrink-0">
        
        {/* Real-time Ampere */}
        <div className="bg-[#080d1a] border border-[#1e293b]/50 rounded-[4px] p-3 shadow-inner flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[8.5px] font-sans font-black tracking-widest text-slate-400 uppercase">AMPERE MIXER MASTER</span>
            <Radio size={10} className={serialState === "CONNECTED" ? "text-emerald-400 animate-ping" : "text-cyan-500"} />
          </div>
          <div className="my-2.5 flex items-baseline justify-center gap-1.5">
            <span className="font-mono text-2xl font-black text-cyan-400 tracking-tighter glow-cyan drop-shadow-[0_0_6px_rgba(34,211,238,0.3)]">
              {liveAmpere.toFixed(1)}
            </span>
            <span className="font-mono text-[9px] font-bold text-slate-500">A</span>
          </div>
          <div className="text-center">
            <span className="text-[7.5px] font-mono uppercase bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
              {serialState === "CONNECTED" ? "REALTIME HARDWARE" : "SIMULATOR FLUCTUATING"}
            </span>
          </div>
        </div>

        {/* Real-time Slump Assessment */}
        <div className="bg-[#080d1a] border border-[#d946ef]/20 rounded-[4px] p-3 shadow-inner flex flex-col justify-between md:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-[8.5px] font-sans font-black tracking-widest text-slate-400 uppercase">ESTIMASI SLUMP BETON (SOFT SENSOR)</span>
            <Sparkles size={11} className="text-pink-400 animate-pulse" />
          </div>
          <div className="my-1 flex items-center justify-around">
            <div className="flex items-baseline gap-1 bg-[#d946ef]/5 border border-[#d946ef]/10 px-4 py-1.5 rounded">
              <span className="font-mono text-3xl font-black text-pink-400 tracking-tighter">
                {activeEstimatesForDashboard.val.toFixed(1)}
              </span>
              <span className="font-mono text-[10px] font-bold text-slate-400">cm</span>
            </div>
            
            <div className="flex flex-col gap-1 text-left">
              <span className={`text-[9px] font-sans font-black tracking-wider px-2 py-0.5 rounded text-center block ${
                activeEstimatesForDashboard.confidence === "HIGH CONFIDENCE" ? "bg-emerald-900/40 text-emerald-400 border border-emerald-800/50" :
                activeEstimatesForDashboard.confidence === "MEDIUM" ? "bg-amber-950/40 text-amber-400 border border-amber-800/50" :
                "bg-rose-950/40 text-rose-400 border border-rose-800/50"
              }`}>
                {activeEstimatesForDashboard.confidence}
              </span>
              <span className="text-[8px] font-mono text-slate-400 uppercase">
                Job Mix Formula: <span className="text-[#00ffd0] font-bold">{formMixDesign}</span>
              </span>
            </div>
          </div>
          
          <div className="text-center border-t border-slate-900 pt-1.5">
            <span className="text-[8px] font-mono text-slate-500 uppercase tracking-wide block">
              Rumus Aktif: <span className="text-pink-400 font-bold">{activeEstimatesForDashboard.formulaText}</span>
            </span>
          </div>
        </div>

        {/* Database Stats */}
        <div className="bg-[#080d1a] border border-[#1e293b]/50 rounded-[4px] p-3 shadow-inner flex flex-col justify-between">
          <span className="text-[8.5px] font-sans font-black tracking-widest text-slate-400 uppercase text-left">DATABASE SAMPLES</span>
          <div className="my-2.5 flex items-baseline justify-center gap-1">
            <span className="font-mono text-2xl font-black text-emerald-400">
              {numSavedCalibrations}
            </span>
            <span className="font-mono text-[9px] text-slate-500">titik</span>
          </div>
          <div className="text-center">
            {numSavedCalibrations < 2 ? (
              <span className="text-[7.5px] font-mono uppercase bg-rose-950/40 border border-rose-800/40 text-rose-400 px-1 py-0.5 rounded flex items-center gap-1 justify-center">
                <AlertTriangle size={8} /> BUTUH MIN 2 DATA
              </span>
            ) : (
              <span className="text-[7.5px] font-mono uppercase bg-emerald-950/30 border border-emerald-800/30 text-emerald-400 px-1 py-0.5 rounded flex items-center gap-1 justify-center">
                <Check size={8} /> MODEL PREDIKSI OK
              </span>
            )}
          </div>
        </div>
      </div>

      {/* DETAILED WORK PANEL WITH COLLAPSED DIRECTORIES */}
      <div className="space-y-2 select-none">
        
        {/* SUBMENU 1: TAMBAH DATA KALIBRASI LAPANGAN */}
        <div className="bg-[#0b1329]/70 border border-[#1e293b]/60 rounded-[4px]">
          <button
            onClick={() => toggleCollapse("addCalib")}
            className="w-full flex items-center justify-between p-3.5 text-left text-[11px] font-sans font-black uppercase tracking-wider text-slate-100 hover:bg-slate-900/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <PlusCircle size={14} className="text-emerald-400" />
              <span>▶ TAMBAH DATA KALIBRASI LAPANGAN</span>
            </div>
            {collapsed.addCalib ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>

          {!collapsed.addCalib && (
            <div className="p-4 border-t border-slate-900 bg-[#060a12] text-left">
              <form onSubmit={handleSimpanKalibrasi} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                
                {/* Selector Formula */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-sans font-black text-slate-400 uppercase tracking-wider">Job Mix Formula</span>
                  <select
                    value={formMixDesign}
                    onChange={(e) => setFormMixDesign(e.target.value)}
                    className="bg-[#020617] border border-slate-800 text-slate-200 p-2.5 rounded-[4px] text-xs font-mono font-bold uppercase focus:border-cyan-400 outline-none cursor-pointer"
                  >
                    {jmfList.map((jmf) => (
                      <option key={jmf.id} value={jmf.mutuBeton}>
                        MUTU {jmf.mutuBeton.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Real-time Ampere */}
                <div className="flex flex-col gap-1.5 relative">
                  <span className="text-[9px] font-sans font-black text-slate-400 uppercase tracking-wider">Ampere Mixer (A)</span>
                  <div className="flex gap-1.5">
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={formAmpere}
                      onChange={(e) => setFormAmpere(e.target.value)}
                      className={`bg-[#020617] border border-slate-800 text-cyan-400 p-2.5 rounded-[4px] text-xs font-mono font-bold w-full transition-all outline-none text-center focus:border-cyan-400 focus:shadow-[0_0_10px_rgba(34,211,238,0.2)] ${
                        isFlashingAmpere ? "bg-cyan-950 border-cyan-400" : ""
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleAmbilAmpere}
                      title="Ambil ampere realtime yang terbaca di main mixer saat ini"
                      className="px-2.5 bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 hover:border-cyan-600 rounded text-cyan-400 font-mono text-[9px] font-black uppercase transition-all shrink-0 cursor-pointer flex items-center justify-center"
                    >
                      <RefreshCw size={11} className={`mr-1 ${isFlashingAmpere ? "animate-spin" : ""}`} />
                      AMBIL LATEST
                    </button>
                  </div>
                </div>

                {/* Actual Slump */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-sans font-black text-slate-400 uppercase tracking-wider">Slump Aktual Lapangan (cm)</span>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Contoh: 12.0"
                    value={formSlump}
                    onChange={(e) => setFormSlump(e.target.value)}
                    className="bg-[#020617] border border-slate-800 text-pink-400 p-2.5 rounded-[4px] text-xs font-mono font-bold text-center focus:border-pink-500 focus:shadow-[0_0_10px_rgba(217,70,239,0.2)] outline-none"
                    required
                  />
                </div>

                {/* Keterangan */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-sans font-black text-slate-400 uppercase tracking-wider">Keterangan Teknis</span>
                  <input
                    type="text"
                    placeholder="Supir, cuaca, slump cone, dll"
                    value={formKeterangan}
                    onChange={(e) => setFormKeterangan(e.target.value)}
                    className="bg-[#020617] border border-slate-800 text-slate-300 p-2.5 rounded-[4px] text-xs font-sans text-left focus:border-cyan-400 outline-none"
                  />
                </div>

                {/* Actuator Submit Button */}
                <div className="md:col-span-4 flex justify-end mt-2 pt-2 border-t border-slate-900/60">
                  <button
                    type="submit"
                    className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#070b13] font-sans text-[10px] font-black uppercase rounded-[3.5px] tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Database size={12} />
                    SIMPAN DATA KALIBRASI LAPANGAN
                  </button>
                </div>
              </form>

              {isSavedFlash && (
                <div className="bg-emerald-900/40 border border-emerald-500/40 p-2.5 rounded mt-3 text-[10px] font-mono text-emerald-300 uppercase">
                  ✓ DATA KALIBRASI BERHASIL DISIMPAN! Rumus koefisien estimasi slump diperbarui secara live.
                </div>
              )}
            </div>
          )}
        </div>

        {/* SUBMENU 2: TABEL DATABASE HISTORI DATA KALIBRASI */}
        <div className="bg-[#0b1329]/70 border border-[#1e293b]/60 rounded-[4px]">
          <button
            onClick={() => toggleCollapse("dataCalib")}
            className="w-full flex items-center justify-between p-3.5 text-left text-[11px] font-sans font-black uppercase tracking-wider text-slate-100 hover:bg-slate-900/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Database size={14} className="text-cyan-400" />
              <span>▶ DATABASE HISTORI REKAM KALIBRASI LAPANGAN</span>
            </div>
            {collapsed.dataCalib ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>

          {!collapsed.dataCalib && (
            <div className="p-4 border-t border-slate-900 bg-[#060a12] text-left">
              {points.length === 0 ? (
                <div className="text-center py-6">
                  <span className="text-slate-500 font-mono text-[10px]">BELUM ADA DATA KALIBRASI LAPANGAN YANG TERSIMPAN</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-[10px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 uppercase text-[9px] font-black">
                        <th className="py-2.5 px-2">Tanggal / Jam</th>
                        <th className="py-2.5">Operator</th>
                        <th className="py-2.5 text-center">Job Mix Formula</th>
                        <th className="py-2.5 text-center">Ampere Motor</th>
                        <th className="py-2.5 text-center">Slump cone</th>
                        <th className="py-2.5 text-center">Estimasi sitem</th>
                        <th className="py-2.5 text-center">E-selisih</th>
                        <th className="py-2.5">Keterangan</th>
                        <th className="py-2.5 text-center">Status Keaslian</th>
                        <th className="py-2.5 text-center">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900/60">
                      {points.map((p) => {
                        const suspicious = isSuspicious(p);
                        return (
                          <tr key={p.id} className={`hover:bg-slate-900/30 transition-colors ${
                            p.ignored ? "opacity-35 line-through bg-slate-950/40" : ""
                          }`}>
                            <td className="py-2.5 px-2 font-mono text-slate-400">{p.timestamp}</td>
                            <td className="py-2.5 text-slate-300 capitalize">{p.operator}</td>
                            <td className="py-2.5 text-center font-black text-cyan-400">{p.mixDesign}</td>
                            <td className="py-2.5 text-center text-slate-200">{p.ampere.toFixed(1)} A</td>
                            <td className="py-2.5 text-center font-bold text-pink-400">{p.slumpAktual.toFixed(1)} cm</td>
                            <td className="py-2.5 text-center text-slate-200">{p.estimatedSlump.toFixed(1)} cm</td>
                            <td className={`py-2.5 text-center text-[9px] font-black ${
                              Math.abs(p.error) > 2.0 ? "text-rose-400" : "text-emerald-400"
                            }`}>
                              {p.error > 0 ? `+${p.error}` : p.error} cm
                            </td>
                            <td className="py-2.5 text-slate-400 truncate max-w-[150px]" title={p.keterangan}>
                              {p.keterangan}
                            </td>
                            <td className="py-2.5 text-center">
                              {p.ignored ? (
                                <span className="text-[7.5px] font-bold tracking-wider uppercase text-slate-500 bg-slate-950 border border-slate-900 px-1 py-0.5 rounded">
                                  IGNORED
                                </span>
                              ) : suspicious ? (
                                <span className="text-[7.5px] font-bold tracking-wider uppercase text-amber-500 bg-amber-950/40 border border-amber-900/40 px-1 py-0.5 rounded" title="Sample ini menyimpan anomali tinggi dari kurva linear">
                                  SUSPICIOUS SAMPLE
                                </span>
                              ) : (
                                <span className="text-[7.5px] font-bold tracking-wider uppercase text-emerald-400 bg-emerald-950/20 border border-emerald-900/20 px-1 py-0.5 rounded">
                                  GENUINE
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => toggleIgnorePoint(p.id)}
                                  title={p.ignored ? "Gunakan sampel ini ke model" : "Abaikan sampel ini (outlier)"}
                                  className="p-1 text-slate-400 hover:text-white bg-slate-900 border border-slate-850 hover:border-slate-700 rounded transition-all cursor-pointer"
                                >
                                  {p.ignored ? <Eye size={11} /> : <EyeOff size={11} />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePoint(p.id)}
                                  title="Hapus data kalibrasi permanently"
                                  className="p-1 text-rose-500 hover:text-rose-400 bg-slate-900 border border-slate-850 hover:border-rose-950 rounded transition-all cursor-pointer"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SUBMENU 3: GRAFIK KURVA HUBUNGAN AMPERE VS SLUMP */}
        <div className="bg-[#0b1329]/70 border border-[#1e293b]/60 rounded-[4px]">
          <button
            onClick={() => toggleCollapse("graphics")}
            className="w-full flex items-center justify-between p-3.5 text-left text-[11px] font-sans font-black uppercase tracking-wider text-slate-100 hover:bg-slate-900/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-[#d946ef]" />
              <span>▶ GRAFIK KURVA KALIBRASI REGRESI LINEAR (SCADA VIEW)</span>
            </div>
            {collapsed.graphics ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>

          {!collapsed.graphics && (
            <div className="p-4 border-t border-slate-900 bg-[#060a12] text-left">
              
              {/* Graphic filter row */}
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-900">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono text-slate-400 uppercase font-bold">Filter Formula Aktif:</span>
                  <select
                    value={selectedMixForChart}
                    onChange={(e) => setSelectedMixForChart(e.target.value)}
                    className="bg-[#020617] border border-slate-800 text-cyan-400 px-2 py-1 rounded text-[10px] font-mono uppercase font-black focus:border-[#00ffd0] outline-none cursor-pointer"
                  >
                    {jmfList.map((jmf) => (
                      <option key={jmf.id} value={jmf.mutuBeton}>
                        MUTU {jmf.mutuBeton.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                
                <span className="text-[8.5px] font-mono text-slate-500 uppercase">
                  Sumbu Horizontal (X): <span className="text-cyan-400 font-bold">Ampere (A)</span> | Sumbu Vertikal (Y): <span className="text-pink-400 font-bold">Slump (cm)</span>
                </span>
              </div>

              {/* Clean SVG Scorch/Line Chart Canvas */}
              {chartData.points && chartData.points.length === 0 ? (
                <div className="text-center py-10 bg-[#020617]/50 border border-slate-900 rounded">
                  <span className="text-slate-500 font-mono text-[10px] uppercase">
                    Belum cukup data sampel genuine untuk menggambar kurva [{selectedMixForChart}]. Tambahkan minimal 2 titik kalibrasi.
                  </span>
                </div>
              ) : (
                <div className="relative bg-[#020617] border border-slate-900/80 rounded p-4 h-[250px] flex items-center justify-center">
                  
                  {/* SVG Drawing area */}
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200">
                    {/* Definitions for Glow effects */}
                    <defs>
                      <filter id="cyan-glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                      <filter id="pink-glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>

                    {/* Background Grids */}
                    <line x1="40" y1="20" x2="480" y2="20" stroke="#111827" strokeWidth="1" />
                    <line x1="40" y1="60" x2="480" y2="60" stroke="#111827" strokeWidth="1" strokeDasharray="2,2" />
                    <line x1="40" y1="100" x2="480" y2="100" stroke="#1e293b" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="3,3" />
                    <line x1="40" y1="140" x2="480" y2="140" stroke="#111827" strokeWidth="1" strokeDasharray="2,2" />
                    <line x1="40" y1="170" x2="480" y2="170" stroke="#1e293b" strokeWidth="1" />

                    <line x1="40" y1="20" x2="40" y2="170" stroke="#1e293b" strokeWidth="1" />
                    <line x1="260" y1="20" x2="260" y2="170" stroke="#1e293b" strokeOpacity="0.2" strokeWidth="1" strokeDasharray="3,3" />
                    <line x1="480" y1="20" x2="480" y2="170" stroke="#1e293b" strokeWidth="1" />

                    {/* Coordinate Axis Labels */}
                    <text x="35" y="24" textAnchor="end" fill="#64748b" className="font-mono" style={{ fontSize: "8px" }}>
                      {chartData.bounds?.maxSlump.toFixed(0)}
                    </text>
                    <text x="35" y="95" textAnchor="end" fill="#64748b" className="font-mono" style={{ fontSize: "8px" }}>
                      {(((chartData.bounds?.maxSlump || 1) + (chartData.bounds?.minSlump || 0)) / 2).toFixed(0)}
                    </text>
                    <text x="35" y="174" textAnchor="end" fill="#64748b" className="font-mono" style={{ fontSize: "8px" }}>
                      {chartData.bounds?.minSlump.toFixed(0)}
                    </text>

                    {/* X bottom axis ticks */}
                    <text x="40" y="185" textAnchor="middle" fill="#64748b" className="font-mono" style={{ fontSize: "8px" }}>
                      {chartData.bounds?.minAmp.toFixed(1)} A
                    </text>
                    <text x="260" y="185" textAnchor="middle" fill="#64748b" className="font-mono" style={{ fontSize: "8px" }}>
                      {(((chartData.bounds?.maxAmp || 120) + (chartData.bounds?.minAmp || 80)) / 2).toFixed(1)} A
                    </text>
                    <text x="480" y="185" textAnchor="middle" fill="#64748b" className="font-mono" style={{ fontSize: "8px" }}>
                      {chartData.bounds?.maxAmp.toFixed(1)} A
                    </text>

                    {/* Math Helper Mapping scales to SVG bounds: X: 40->480, Y: 170->20 */}
                    {(() => {
                      const getX = (amp: number) => {
                        const min = chartData.bounds?.minAmp || 60;
                        const max = chartData.bounds?.maxAmp || 130;
                        return 40 + ((amp - min) / (max - min)) * (480 - 40);
                      };

                      const getY = (s: number) => {
                        const min = chartData.bounds?.minSlump || 4;
                        const max = chartData.bounds?.maxSlump || 20;
                        return 170 - ((s - min) / (max - min)) * (170 - 20);
                      };

                      // 1. Draw Linear Slope Regression Fit Line
                      const pointsStr = chartData.formulaLine?.map(p => `${getX(p.ampere)},${getY(p.slump)}`).join(" ");
                      
                      return (
                        <>
                          {/* Fit Line */}
                          {pointsStr && (
                            <polyline
                              points={pointsStr}
                              fill="none"
                              stroke="#6366f1"
                              strokeWidth="2.5"
                              strokeDasharray="4,2"
                              opacity={0.8}
                            />
                          )}

                          {/* 2. Plot Real Field points */}
                          {chartData.points?.map((pt, i) => {
                            const cx = getX(pt.ampere);
                            const cy = getY(pt.slumpAktual);
                            return (
                              <g key={pt.id} className="cursor-pointer group">
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r="5"
                                  fill="#d946ef"
                                  stroke="#fff"
                                  strokeWidth="1.5"
                                  filter="url(#pink-glow)"
                                />
                                {/* Tiny value label */}
                                <text
                                  x={cx}
                                  y={cy - 8}
                                  textAnchor="middle"
                                  fill="#fff"
                                  className="font-mono select-none"
                                  style={{ fontSize: "7.5px", fontWeight: "bold" }}
                                >
                                  {pt.slumpAktual.toFixed(1)}
                                </text>
                              </g>
                            );
                          })}

                          {/* Current Real-time Ampere Indicator Ring */}
                          {liveAmpere >= (chartData.bounds?.minAmp || 0) && liveAmpere <= (chartData.bounds?.maxAmp || 150) && (
                            <g>
                              {/* Draw vertically across live */}
                              <line
                                x1={getX(liveAmpere)}
                                y1="20"
                                x2={getX(liveAmpere)}
                                y2="170"
                                stroke="#00ffd0"
                                strokeWidth="1"
                                opacity="0.45"
                                strokeDasharray="3,1"
                              />
                              <circle
                                cx={getX(liveAmpere)}
                                cy={getY(activeEstimatesForDashboard.val)}
                                r="8"
                                fill="none"
                                stroke="#00ffd0"
                                strokeWidth="2.5"
                                filter="url(#cyan-glow)"
                                className="animate-pulse"
                              />
                            </g>
                          )}
                        </>
                      );
                    })()}

                  </svg>
                  
                  {/* Absolute Legend Overlay */}
                  <div className="absolute top-2.5 right-2.5 bg-[#040813]/90 border border-slate-800 p-2 rounded text-[8px] font-mono text-slate-400 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-pink-500 border border-white block" />
                      <span>Sampel Aktual Lapangan</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-4 h-0.5 border-t-2 border-indigo-500 border-dashed block" />
                      <span>Garis Estimasi Regresi</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full border border-cyan-400 animate-ping inline-block" />
                      <span className="text-cyan-400">Pembacaan Real-Time Live</span>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}
        </div>

        {/* SUBMENU 4: RUMUS ESTIMASI AKTIF */}
        <div className="bg-[#0b1329]/70 border border-[#1e293b]/60 rounded-[4px]">
          <button
            onClick={() => toggleCollapse("formula")}
            className="w-full flex items-center justify-between p-3.5 text-left text-[11px] font-sans font-black uppercase tracking-wider text-slate-100 hover:bg-slate-900/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Binary size={14} className="text-[#00ffd0]" />
              <span>▶ RUMUS ESTIMASI AKTIF MATEMATIS</span>
            </div>
            {collapsed.formula ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>

          {!collapsed.formula && (
            <div className="p-4 border-t border-slate-900 bg-[#060a12] text-left">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Object.entries(activeFormulas).map(([mix, item]: [string, any]) => (
                  <div key={mix} className="bg-slate-950/80 border border-slate-900 rounded p-3 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-sans font-extrabold text-white block uppercase tracking-wider">{mix}</span>
                      <span className="text-[8px] font-mono text-slate-500 uppercase block mt-1">
                        SAMPEL DIGUNAKAN: <span className="text-indigo-400 font-bold">{item.count} titik</span>
                      </span>
                    </div>
                    <div className="my-3 bg-[#020617] border border-slate-900 p-2 rounded text-center">
                      <span className="font-mono text-xs font-black text-cyan-400 select-all tracking-wide">
                        Slump = {item.slope.toFixed(3)} × A + {item.intercept.toFixed(1)}
                      </span>
                    </div>
                    <div>
                      {item.isDefault ? (
                        <span className="text-[7.5px] font-mono text-amber-500 bg-amber-950/40 border border-amber-900/30 px-1 py-0.5 rounded block text-center uppercase">
                          DEFAULT FORMULA (BUTUH DATA)
                        </span>
                      ) : (
                        <span className="text-[7.5px] font-mono text-emerald-400 bg-emerald-950/30 border border-emerald-900/30 px-1 py-0.5 rounded block text-center uppercase">
                          ✓ RE-CALIBRATED MATHEMATICALLY
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* SUBMENU 5: MODE INDUCTION AUTO-LEARNING */}
        <div className="bg-[#0b1329]/70 border border-[#1e293b]/60 rounded-[4px]">
          <button
            onClick={() => toggleCollapse("learning")}
            className="w-full flex items-center justify-between p-3.5 text-left text-[11px] font-sans font-black uppercase tracking-wider text-slate-100 hover:bg-slate-900/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Bot size={14} className="text-cyan-400" />
              <span>▶ MODUL AUTO LEARNING & CALIBRATION ADAPTER</span>
            </div>
            {collapsed.learning ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>

          {!collapsed.learning && (
            <div className="p-4 border-t border-slate-900 bg-[#060a12] text-left">
              <div className="bg-slate-950/80 border border-slate-900 rounded p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-cyan-950 text-[#00ffd0] border border-cyan-900 rounded-[5px] shrink-0">
                    <Bot size={22} className={autoLearningActive ? "animate-bounce" : ""} />
                  </div>
                  <div>
                    <h5 className="text-[11px] font-sans font-black text-white uppercase tracking-wider">Metode Auto Learning Adaptif</h5>
                    <p className="text-[9px] font-mono text-slate-400 uppercase leading-relaxed mt-1 max-w-xl">
                      Ketika fitur ini aktif, sistem soft sensor otomatis melatih kembali model perhitungan regresi linear berganda setiap kali ada penambahan atau pengabaian sampel baru. Model secara instan menyesuaikan performa output slump tanpa perlu mereset server atau mikrokontroler.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[9px] font-mono text-slate-400 uppercase font-bold">STATUS PEMBELAJARAN:</span>
                  <button
                    type="button"
                    onClick={() => setAutoLearningActive(!autoLearningActive)}
                    className={`w-[110px] py-2 font-mono text-[9px] font-black uppercase rounded border transition-all cursor-pointer text-center ${
                      autoLearningActive
                        ? "bg-emerald-950 text-emerald-300 border-emerald-500/70 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                        : "bg-slate-900 text-slate-400 border-slate-800"
                    }`}
                  >
                    {autoLearningActive ? "● ACTIVE" : "○ DEACTIVATED"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SUBMENU 6: CONFIGURASI SENSOR DAN TIMBANGAN REAL-TIME */}
        <div className="bg-[#0b1329]/70 border border-[#1e293b]/60 rounded-[4px]">
          <button
            onClick={() => toggleCollapse("sensor")}
            className="w-full flex items-center justify-between p-3.5 text-left text-[11px] font-sans font-black uppercase tracking-wider text-slate-100 hover:bg-slate-900/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings2 size={14} className="text-slate-400" />
              <span>▶ MONITORING DETAIL KOMUNIKASI HARDWARE PLC & PORT</span>
            </div>
            {collapsed.sensor ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>

          {!collapsed.sensor && (
            <div className="p-4 border-t border-slate-900 bg-[#060a12] text-left">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h6 className="text-[10px] font-sans font-black text-white uppercase tracking-wider mb-2">TELEMETRY SENSOR TELEGRAM</h6>
                  <p className="text-[9px] font-mono text-slate-400 uppercase mb-3">
                    Protokol pertukaran data JSON via serial port Arduino Mega 2560/328P. Output raw data sensor:
                  </p>
                  <pre className="bg-[#020617] p-3 rounded font-mono text-[9px] text-[#00ffd0] border border-slate-900/80">
{`{
  "client": "BATCHING_PLANT_BP_01",
  "mixerAmp": ${liveAmpere.toFixed(1)},
  "encoderVal": 2043,
  "weightMeters": {
    "pasir": 0,
    "batu": 0,
    "semen": 0,
    "air": 0
  },
  "status": "READY"
}`}
                  </pre>
                </div>

                <div className="flex flex-col justify-between">
                  <div>
                    <h6 className="text-[10px] font-sans font-black text-white uppercase tracking-wider mb-1">FAIL SAFE HARDWARE LOCKS</h6>
                    <span className="text-[8.5px] font-mono text-slate-500 uppercase leading-relaxed block mb-2.5">
                      Sistem integrasi dilindungi oleh sekring termis over-current pada motor starter mixer.
                    </span>
                    <div className="space-y-1.5 font-mono text-[9px]">
                      <div className="flex justify-between items-center py-1 border-b border-slate-900">
                        <span className="text-slate-400">AMPERE RANGE TOLERANCE</span>
                        <span className="text-[#00ffd5] font-bold">10.0 A ~ 145.0 A</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-slate-900">
                        <span className="text-slate-400">SAMPLE INTERVAL</span>
                        <span className="text-slate-300">100 ms (High Performance)</span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-slate-400">LOW PASS SIGNAL FILTER</span>
                        <span className="text-emerald-400 font-bold">ACTIVE (EMA 0.2)</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#1e1a11]/45 border border-amber-500/20 p-2.5 rounded text-[8.5px] font-mono text-slate-400 uppercase mt-2">
                    <span className="text-amber-400 font-black block mb-0.5">⚠️ PENGERTIAN OPERATOR</span>
                    Jika ampere motor starter melebihi 145 Amper, sistem kontrol HMI otomatis mengaktifkan interlock shutdown demi mengamankan motor twin shaft dari kerusakan akibat beban mekanis ekstrem.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
