/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Play, 
  Square, 
  AlertOctagon, 
  Settings, 
  Database, 
  Droplets, 
  Weight, 
  Zap, 
  Activity, 
  History, 
  CheckCircle2, 
  AlertCircle,
  Menu,
  ChevronRight,
  ChevronDown,
  RefreshCcw,
  BarChart3,
  Power,
  Bell,
  User,
  Package,
  HelpCircle,
  Check,
  X,
  LogOut,
  ShieldAlert,
  MessageSquare,
  Send,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LoginModal } from "./components/admin/LoginModal";
import { LoginPortal } from "./components/admin/LoginPortal";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { TabletPage } from "./components/admin/TabletPage";
import { MixingSequence } from "./components/admin/MixingSequenceConfig";
import { BatchConfigModal } from "./components/BatchConfigModal";
import { webSerialService } from "./lib/webSerial";
import { loadRelayConfig } from "./components/admin/relay-config/ConfigState";
import { queueForCloudSync } from "./lib/syncService";
import { dotNetBackendService } from "./lib/dotnetBackendService";

// Background timer Web Worker using Blob URL to bypass browser throttling when tab is minimized/inactive
let bgWorker: Worker | null = null;
try {
  if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
    const workerBlobCode = `
      let intervalId = null;
      self.onmessage = function(e) {
        if (e.data === 'START') {
          if (intervalId) clearInterval(intervalId);
          intervalId = setInterval(() => {
            self.postMessage('TICK');
          }, 100);
        } else if (e.data === 'STOP') {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      };
    `;
    const blob = new Blob([workerBlobCode], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    bgWorker = new Worker(blobUrl);
  }
} catch (err) {
  console.error("Failed to initialize background worker:", err);
}

// --- Types ---

type MaterialType = 'pasir' | 'batu' | 'semen' | 'air';

interface ScaleData {
  id: MaterialType;
  label: string;
  actual: number;
  target: number;
  unit: string;
  isActive: boolean;
  isComplete: boolean;
}

interface BatchLog {
  id: string;
  timestamp: Date;
  recipeName: string;
  data: {
    pasir: number;
    batu: number;
    semen: number;
    air: number;
  };
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
  status: 'sukses' | 'gagal';
  volume?: number;
  mixingCycles?: number;
  slump?: string;
  siloSemen?: string;
  mixingTime?: number;
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

interface Recipe {
  id: string;
  name: string;
  targets: Record<MaterialType, number>;
  jobMixDetails?: any;
}

// --- Constants ---

const INITIAL_SCALES: Record<MaterialType, ScaleData> = {
  pasir: { id: 'pasir', label: 'Pasir', actual: 0, target: 400, unit: 'kg', isActive: false, isComplete: false },
  batu: { id: 'batu', label: 'Batu', actual: 0, target: 400, unit: 'kg', isActive: false, isComplete: false },
  semen: { id: 'semen', label: 'Semen', actual: 0, target: 300, unit: 'kg', isActive: false, isComplete: false },
  air: { id: 'air', label: 'Air', actual: 0, target: 150, unit: 'kg', isActive: false, isComplete: false },
};

const RECIPES: Recipe[] = [
  { id: 'k225', name: 'Beton K-225', targets: { pasir: 400, batu: 400, semen: 300, air: 150 } },
  { id: 'k250', name: 'Beton K-250', targets: { pasir: 425, batu: 425, semen: 350, air: 160 } },
  { id: 'k300', name: 'Beton K-300', targets: { pasir: 450, batu: 450, semen: 400, air: 180 } },
];

const SCALE_CAPACITIES = {
  pasir: 1000,          // Kapasitas loadcell timbangan pasir (kg)
  batu: 1000,           // Kapasitas loadcell timbangan batu (kg)
  accumulative: 2000,   // Kapasitas loadcell timbangan akumulatif pasir + batu (kg)
  semen: 800,           // Kapasitas loadcell timbangan semen (kg)
  air: 400,             // Kapasitas loadcell timbangan air & aditif (kg)
  waiting_hopper: 2000, // Kapasitas fisik waiting hopper (kg)
};

// --- Components ---

const TargetAndScaleBlock = ({ 
  label, 
  actual, 
  target, 
  unit = "kg", 
  isActive, 
  isComplete 
}: { 
  label: string; 
  actual: number; 
  target: number; 
  unit?: string; 
  isActive: boolean; 
  isComplete: boolean; 
}) => {
  return (
    <div className="flex flex-col gap-1 w-full">
      {/* Top Box: TARGET (Indigo Blue) */}
      <div className="bg-[#132247] border border-[#1b3469] rounded-[4px] px-3 py-1.5 flex flex-col justify-center min-h-[55px] shadow-sm select-none">
        <span className="text-[9px] font-sans font-bold uppercase tracking-wider text-[#7dd3fc]">TARGET</span>
        <div className="font-mono text-xl font-bold tracking-tight text-white flex items-baseline justify-between">
          <span>{target} <span className="text-[10px] font-sans font-semibold text-[#38bdf8] uppercase">{unit}</span></span>
          <div className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]/55" />
        </div>
      </div>

      {/* Bottom Box: Material Weights (Fluorescent Electric Green on Dark Slate) */}
      <div className="bg-[#101622] border border-[#1e293b] rounded-[4px] px-3 py-2 flex flex-col justify-center min-h-[65px] relative overflow-hidden shadow-inner select-none group">
        <span className="text-[9px] font-sans font-black uppercase tracking-wider text-[#94a3b8]">{label}</span>
        <div className="font-mono text-2xl font-black tracking-tighter text-[#00ff9c] flex items-baseline justify-between leading-none mt-1">
          <span className={isActive ? 'text-[#00ffd0]' : isComplete ? 'text-[#00ff9c]' : 'text-[#02c383]'}>
            {actual.toFixed(0)} <span className="text-[10px] font-sans font-bold text-[#64748b] uppercase">{unit}</span>
          </span>
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-[#00ffd0] shadow-[0_0_8px_#00ffd0]' : isComplete ? 'bg-[#00ff9c]' : 'bg-[#1e293b]'}`} />
        </div>
        
        {/* Fill level line underneath */}
        <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[#1e293b]">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, (actual / (target || 1)) * 100)}%` }}
            className={`h-full ${isComplete ? 'bg-[#00ff9c]' : isActive ? 'bg-[#00ffd0]' : 'bg-slate-600'}`}
            transition={{ duration: 0.1 }}
          />
        </div>
      </div>
    </div>
  );
};

const FarikaLogo = ({ logoSrc }: { logoSrc?: string }) => {
  if (logoSrc) {
    return (
      <div className="w-14 h-14 bg-white rounded-full border border-slate-700 flex items-center justify-center p-0.5 shadow-md relative shrink-0">
        <img 
          src={logoSrc} 
          alt="Company Logo" 
          className="w-full h-full rounded-full object-cover bg-white"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }
  return (
    <div className="w-14 h-14 bg-white rounded-full border border-slate-700 flex items-center justify-center p-0.5 shadow-md relative shrink-0">
      <div className="w-full h-full rounded-full border-2 border-blue-600 flex flex-col items-center justify-center relative overflow-hidden bg-white">
        {/* Outer Circular Text Arc */}
        <div className="text-[5.5px] font-black text-blue-900 tracking-tighter absolute top-1 uppercase scale-90 leading-none">
          PT. FARIKA
        </div>
        {/* Red Center Wing Emblem */}
        <div className="w-7 h-5 flex items-center justify-center relative overflow-hidden my-0.5">
          {/* Custom vector representation of wing/emblem inside */}
          <div className="absolute w-6 h-1 bg-red-600 rotate-12 rounded-full" />
          <div className="absolute w-6 h-1 bg-red-500 -rotate-12 rounded-full" />
          <span className="text-[6px] font-black text-blue-950 z-10 leading-none tracking-tighter bg-white/70 px-0.5 rounded">FARIKA</span>
        </div>
        {/* Outer Circular Text Bottom Arc */}
        <div className="text-[4px] font-black text-blue-900 tracking-tighter absolute bottom-0.5 uppercase scale-95 leading-none">
          RIAU PERKASA
        </div>
      </div>
    </div>
  );
};

const getIndonesianDate = (date: Date) => {
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const dayName = days[date.getDay()];
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${dayName}, ${day}/${month}/${year}`;
};

const ControlButton = ({ 
  onClick, 
  icon: Icon, 
  label, 
  activeColor, 
  disabled = false,
  variant = 'primary'
}: { 
  onClick: () => void; 
  icon: any; 
  label: string; 
  activeColor: string; 
  disabled?: boolean;
  variant?: 'primary' | 'danger' | 'warning';
}) => {
  const baseClasses = "flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-[4px] font-bold uppercase tracking-tight transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed border-none shadow-md active:scale-95";
  
  const variants = {
    primary: "bg-[#444] text-white hover:bg-[#555]",
    danger: "bg-accent-red text-white hover:opacity-90",
    warning: "bg-accent-yellow text-black hover:opacity-90",
    start: "bg-accent-green text-black hover:opacity-90"
  };

  const currentVariant = variant === 'primary' && activeColor.includes('green') ? 'start' : variant;

  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${baseClasses} ${variants[currentVariant as keyof typeof variants]}`}
    >
      <Icon size={18} />
      <span className="text-[10px] text-center leading-tight">{label}</span>
    </button>
  );
};

const ScadaDiagram = ({ 
  isRunning, 
  currentStep, 
  isDone, 
  truckImage, 
  onTruckClick,
  scales,
  startBatch,
  stopBatch,
  isAuto,
  setIsAuto,
  moistureControl,
  setMoistureControl,
  onMoistureClick,
  quarryAggregate,
  setQuarryAggregate,
  onQuarryClick,
  quarryPasir1 = "Pasir Galunggung",
  quarryPasir2 = "Pasir Sungai",
  quarryBatu1 = "Batu Split 1-2",
  quarryBatu2 = "Batu Split 2-3",
  isPrint,
  setIsPrint,
  onHelpClick,
  productionState = 'IDLE',
  currentCycle = 1,
  totalCycles = 1,
  currentBatch = 0,
  targetBatch = 0,
  gatePasirSiloOpen = false,
  gatePasir1SiloOpen: rawGatePasir1SiloOpen = false,
  gatePasir2SiloOpen: rawGatePasir2SiloOpen = false,
  gateBatuSiloOpen = false,
  gateBatu1SiloOpen: rawGateBatu1SiloOpen = false,
  gateBatu2SiloOpen: rawGateBatu2SiloOpen = false,
  screwSemenActive: rawScrewSemenActive = false,
  valveWaterActive: rawValveWaterActive = false,
  gatePasirHopperOpen: rawGatePasirHopperOpen = false,
  gateBatuHopperOpen: rawGateBatuHopperOpen = false,
  gateSemenHopperOpen: rawGateSemenHopperOpen = false,
  gateWaterHopperOpen: rawGateWaterHopperOpen = false,
  conveyorBottomActive = false,
  conveyorUpperActive = false,
  mixerShaftActive = false,
  mixerDoorPercent = 0,
  mixerDoorStateText = "CLOSED",
  concreteDischargeActive = false,
  mixingCountdown = 0,
  dischargeTimeSec = 0,
  activeMixingTime = 10,
  ampere = null,
  slump = null,
  relayLogs = [],
  isPaused = false,
  activeSiloSemen = "Silo 3 - 28.290 kg",
  siloWeights = [42150, 35800, 28290, 31400, 19500, 48900],
  jumlahSilo = 6,
  activePins = {},
  batchingPlantMode = 'SYSTEM_1',
  batchingMode = 'AUTO',
  waitingHopperEnabled = false,
  waitingHopperState = 'WAITING_HOPPER_IDLE',
  waitingHopperGateOpen: rawWaitingHopperGateOpen = false,
  waitingHopperWeight = 0,
  selectedRecipe = null,
  volumePerBatch = 1.0,
  scaleCapacities = { pasir: 1000, batu: 1000, semen: 800, air: 400, mixerGeometris: 4.0, mixerMaxMixing: 3.5 },
  mixerState = 'waiting',
  aggregateInMixer = 0,
  semenInMixer = 0,
  waterInMixer = 0,
  activeVolume = 0,
  compressorActive = false,
  vibratorActive = false,
  klaksonActive = false,
  admixInActive = false,
  admixOutActive = false,
  onManualDeviceToggle,
  airPressure = 0,
  setAirPressure
}: { 
  airPressure?: number;
  setAirPressure?: React.Dispatch<React.SetStateAction<number>>;
  isRunning: boolean; 
  currentStep: string; 
  isDone: boolean; 
  truckImage: string | null; 
  onTruckClick: () => void; 
  scales: Record<MaterialType, ScaleData>;
  startBatch: () => void;
  stopBatch: () => void;
  isAuto: boolean;
  setIsAuto: (v: boolean) => void;
  moistureControl: boolean;
  setMoistureControl: (v: boolean) => void;
  onMoistureClick?: () => void;
  quarryAggregate: boolean;
  setQuarryAggregate: (v: boolean) => void;
  onQuarryClick?: () => void;
  quarryPasir1?: string;
  quarryPasir2?: string;
  quarryBatu1?: string;
  quarryBatu2?: string;
  isPrint: boolean;
  setIsPrint: (v: boolean) => void;
  onHelpClick: () => void;
  productionState?: string;
  currentCycle?: number;
  totalCycles?: number;
  currentBatch?: number;
  targetBatch?: number;
  gatePasirSiloOpen?: boolean;
  gatePasir1SiloOpen?: boolean;
  gatePasir2SiloOpen?: boolean;
  gateBatuSiloOpen?: boolean;
  gateBatu1SiloOpen?: boolean;
  gateBatu2SiloOpen?: boolean;
  screwSemenActive?: boolean;
  valveWaterActive?: boolean;
  gatePasirHopperOpen?: boolean;
  gateBatuHopperOpen?: boolean;
  gateSemenHopperOpen?: boolean;
  gateWaterHopperOpen?: boolean;
  conveyorBottomActive?: boolean;
  conveyorUpperActive?: boolean;
  mixerShaftActive?: boolean;
  klaksonActive?: boolean;
  admixInActive?: boolean;
  admixOutActive?: boolean;
  mixerDoorPercent?: number;
  mixerDoorStateText?: string;
  concreteDischargeActive?: boolean;
  mixingCountdown?: number;
  dischargeTimeSec?: number;
  activeMixingTime?: number;
  ampere?: number | null;
  slump?: number | null;
  relayLogs?: { id: string; timestamp: Date; message: string; type: 'on' | 'off' | 'info' | 'done' }[];
  isPaused?: boolean;
  activeSiloSemen?: string;
  siloWeights?: number[];
  jumlahSilo?: number;
  activePins?: Record<string, boolean>;
  batchingPlantMode?: 'SYSTEM_1' | 'SYSTEM_2' | 'SYSTEM_3';
  batchingMode?: 'MANUAL' | 'SEMI_AUTO' | 'AUTO';
  waitingHopperEnabled?: boolean;
  waitingHopperState?: string;
  waitingHopperGateOpen?: boolean;
  waitingHopperWeight?: number;
  selectedRecipe?: Recipe | null;
  volumePerBatch?: number;
  scaleCapacities?: { pasir: number; batu: number; semen: number; air: number; mixerGeometris?: number; mixerMaxMixing?: number };
  mixerState?: 'waiting' | 'discharging_hoppers' | 'mixing' | 'discharging_concrete' | 'complete';
  aggregateInMixer?: number;
  semenInMixer?: number;
  waterInMixer?: number;
  activeVolume?: number;
  compressorActive?: boolean;
  vibratorActive?: boolean;
  onManualDeviceToggle?: (deviceKey: string, newValue?: boolean) => void;
}) => {
  const gatePasirHopperOpen = rawGatePasirHopperOpen && !isPaused;
  const gateBatuHopperOpen = rawGateBatuHopperOpen && !isPaused;
  const gateSemenHopperOpen = rawGateSemenHopperOpen && !isPaused;
  const gateWaterHopperOpen = rawGateWaterHopperOpen && !isPaused;
  const waitingHopperGateOpen = rawWaitingHopperGateOpen && !isPaused;
  const gatePasir1SiloOpen = rawGatePasir1SiloOpen && !isPaused;
  const gatePasir2SiloOpen = rawGatePasir2SiloOpen && !isPaused;
  const gateBatu1SiloOpen = rawGateBatu1SiloOpen && !isPaused;
  const gateBatu2SiloOpen = rawGateBatu2SiloOpen && !isPaused;
  const screwSemenActive = rawScrewSemenActive && !isPaused;
  const valveWaterActive = rawValveWaterActive && !isPaused;

  const theme = {
    outline: "#00e5ff",
    flow: "#00ff9c",
    pipe: "#3d3d3d",
    mixer: "#f39c12",
    text: "#e0e0e0",
    red: "#ff1744",
    accentBlue: "#2979ff",
    accentGreen: "#00e676"
  };

  const getQuarryLabel = (label: string) => {
    if (label === "PASIR 1") return quarryPasir1 || "PASIR #1";
    if (label === "PASIR 2") return quarryPasir2 || "PASIR #2";
    if (label === "BATU 1") return quarryBatu1 || "BATU #1";
    if (label === "BATU 2") return quarryBatu2 || "BATU #2";
    return label.replace(" 1", " #1").replace(" 2", " #2");
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (setAirPressure) {
        setAirPressure(prev => {
          // If connected to physical hardware serial, bypass simulator
          if (webSerialService.getStatus() === "CONNECTED") {
            return prev;
          }
        let target = compressorActive ? 88.5 : 0.0;
        const hasPneumaticDischarge = 
          gatePasirHopperOpen || 
          gateBatuHopperOpen || 
          gateSemenHopperOpen || 
          gateWaterHopperOpen || 
          waitingHopperGateOpen || 
          (mixerDoorPercent > 0);

        let delta = target - prev;
        let rate = compressorActive ? 1.5 : 0.08;
        let consumption = 0;
        if (hasPneumaticDischarge) {
          consumption = compressorActive ? 0.3 : 1.2;
        }

        let nextPressure = prev + delta * rate * 0.1 - consumption;
        if (nextPressure < 0) nextPressure = 0;
        if (nextPressure > 110) nextPressure = 110;
        
        return parseFloat(nextPressure.toFixed(1));
        });
      }
    }, 200);
    return () => clearInterval(interval);
  }, [compressorActive, gatePasirHopperOpen, gateBatuHopperOpen, gateSemenHopperOpen, gateWaterHopperOpen, waitingHopperGateOpen, mixerDoorPercent]);

  const [selectedManualDevice, setSelectedManualDevice] = useState<{
    id: string;
    name: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (isAuto) {
      setSelectedManualDevice(null);
    }
  }, [isAuto]);

  const getDeviceStatus = (id: string): boolean => {
    switch (id) {
      case 'pasir1': return !!gatePasir1SiloOpen;
      case 'pasir2': return !!gatePasir2SiloOpen;
      case 'batu1': return !!gateBatu1SiloOpen;
      case 'batu2': return !!gateBatu2SiloOpen;
      case 'silo1': return !!(screwSemenActive && activeSiloSemen.includes("Silo 1"));
      case 'silo2': return !!(screwSemenActive && activeSiloSemen.includes("Silo 2"));
      case 'silo3': return !!(screwSemenActive && activeSiloSemen.includes("Silo 3"));
      case 'silo4': return !!(screwSemenActive && activeSiloSemen.includes("Silo 4"));
      case 'silo5': return !!(screwSemenActive && activeSiloSemen.includes("Silo 5"));
      case 'silo6': return !!(screwSemenActive && activeSiloSemen.includes("Silo 6"));
      case 'valveIsiAir': return !!valveWaterActive;
      case 'dischargeAir': return !!gateWaterHopperOpen;
      case 'dischargeSemen': return !!gateSemenHopperOpen;
      case 'dischargePasir': return !!gatePasirHopperOpen;
      case 'dischargeBatu': return !!gateBatuHopperOpen;
      case 'admixIn': return !!admixInActive;
      case 'admixOut': return !!admixOutActive;
      case 'mixer': return !!mixerShaftActive;
      case 'conveyorBottom': return !!conveyorBottomActive;
      case 'conveyorUpper': return !!conveyorUpperActive;
      case 'waitingHopperGate': return !!waitingHopperGateOpen;
      case 'mixerDischargeGate': return mixerDoorPercent > 0;
      case 'compressor': return !!compressorActive;
      case 'vibrator': return !!vibratorActive;
      case 'klakson': return !!klaksonActive || !!activePins["Relay #16"];
      default: return false;
    }
  };

  const getDeviceHandlers = (id: string, selectSiloIdx?: number) => {
    if (isAuto) return {};

    const isToggle = id === 'conveyorBottom' || id === 'conveyorUpper' || id === 'compressor';
    const isSemiAuto = batchingMode === 'SEMI_AUTO';

    if (isToggle || isSemiAuto) {
      return {
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          if (onManualDeviceToggle) {
            if (selectSiloIdx !== undefined) {
              onManualDeviceToggle('selectSilo', selectSiloIdx as any);
            }
            onManualDeviceToggle(id);
          }
        },
        style: { cursor: 'pointer' }
      };
    }

    // Momentary item: ON when pointer is down, OFF when pointer is up, leaves, or cancels
    const turnOn = (e: React.PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.stopPropagation();
      e.preventDefault();
      if (onManualDeviceToggle) {
        if (selectSiloIdx !== undefined) {
          onManualDeviceToggle('selectSilo', selectSiloIdx as any);
        }
        onManualDeviceToggle(id, true);
      }
    };

    const turnOff = (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (onManualDeviceToggle) {
        onManualDeviceToggle(id, false);
      }
    };

    return {
      onPointerDown: turnOn,
      onPointerUp: turnOff,
      onPointerLeave: turnOff,
      onPointerCancel: turnOff,
      style: { cursor: 'pointer' }
    };
  };

  // Lock-in and remember targets of the currently processing batch
  const currentBatchTargetAggRef = useRef<number>(0);
  const currentBatchTargetSemenRef = useRef<number>(0);
  const currentBatchTargetAirRef = useRef<number>(0);
  const manualDrainFractionRef = useRef<number>(0);
  const lastMaterialWeightRef = useRef<number>(0);

  const fallbackAgg = scales.pasir.target + scales.batu.target;
  const fallbackSemen = scales.semen.target;
  const fallbackAir = scales.air.target;

  const currentAggTarget = fallbackAgg || (selectedRecipe ? (selectedRecipe.targets.pasir + selectedRecipe.targets.batu) * volumePerBatch : 800);
  const currentSemenTarget = fallbackSemen || (selectedRecipe ? selectedRecipe.targets.semen * volumePerBatch : 300);
  const currentAirTarget = fallbackAir || (selectedRecipe ? selectedRecipe.targets.air * volumePerBatch : 150);

  if (isRunning || mixerState === 'discharging_hoppers' || mixerState === 'mixing' || !isAuto) {
    if (currentBatchTargetAggRef.current === 0 && currentAggTarget > 0) {
      currentBatchTargetAggRef.current = currentAggTarget;
    }
    if (currentBatchTargetSemenRef.current === 0 && currentSemenTarget > 0) {
      currentBatchTargetSemenRef.current = currentSemenTarget;
    }
    if (currentBatchTargetAirRef.current === 0 && currentAirTarget > 0) {
      currentBatchTargetAirRef.current = currentAirTarget;
    }
  } else if (!isDone && mixerState === 'waiting') {
    currentBatchTargetAggRef.current = 0;
    currentBatchTargetSemenRef.current = 0;
    currentBatchTargetAirRef.current = 0;
  }

  const scaleCapacitiesAccumulative = scaleCapacities.pasir + scaleCapacities.batu;
  const scaleCapacitiesWaitingHopper = scaleCapacities.pasir + scaleCapacities.batu;

  // Mixer settings capacities
  const mixerGeometris = scaleCapacities.mixerGeometris ?? 4.0;
  const mixerMaxMixing = scaleCapacities.mixerMaxMixing ?? 3.5;

  const targetAggLocked = currentBatchTargetAggRef.current || currentAggTarget || 800;
  const targetSemenLocked = currentBatchTargetSemenRef.current || currentSemenTarget || 300;
  const targetAirLocked = currentBatchTargetAirRef.current || currentAirTarget || 150;

  // Real-time material in mixer calculation based on physical material discharge into drum
  let currentMixerVolume = 0;
  let w_agg = 0;
  let w_cement = 0;
  let w_water = 0;

  const totalBatchTargetWeight = (targetAggLocked + targetSemenLocked + targetAirLocked) || (volumePerBatch * 2350);

  if (mixerState === 'complete' || (!isRunning && (aggregateInMixer || 0) <= 0 && (semenInMixer || 0) <= 0 && (waterInMixer || 0) <= 0)) {
    // Batch is completely discharged and done, or idle
    w_agg = 0;
    w_cement = 0;
    w_water = 0;
  } else if (mixerState === 'waiting') {
    // WHILE WAITING / WEIGHING:
    // Materials are being weighed in the scale hoppers. NONE of the material has discharged from the scales into the mixer drum yet!
    // The drum mixer MUST remain completely empty (0 volume, no concrete level)!
    w_agg = 0;
    w_cement = 0;
    w_water = 0;
  } else if (mixerState === 'mixing') {
    // In mixing state, all batch materials have fully discharged into the drum mixer
    w_agg = Math.max(targetAggLocked, aggregateInMixer || 0);
    w_cement = Math.max(targetSemenLocked, semenInMixer || 0);
    w_water = Math.max(targetAirLocked, waterInMixer || 0);
  } else if (mixerState === 'discharging_concrete') {
    // Discharging concrete out of the mixer into truck
    w_agg = Math.max(targetAggLocked, aggregateInMixer || 0);
    w_cement = Math.max(targetSemenLocked, semenInMixer || 0);
    w_water = Math.max(targetAirLocked, waterInMixer || 0);
  } else {
    // mixerState === 'discharging_hoppers' or manual material discharge:
    // Strictly track the amount of material that has physically discharged from the scale hoppers and entered the drum mixer!
    w_agg = Math.min(targetAggLocked, Math.max(0, aggregateInMixer || 0));
    w_cement = Math.min(targetSemenLocked, Math.max(0, semenInMixer || 0));
    w_water = Math.min(targetAirLocked, Math.max(0, waterInMixer || 0));
  }

  const rawMaterialWeight = w_agg + w_cement + w_water;

  // Reset drain fraction when fresh material is introduced with door closed
  if (mixerDoorPercent === 0 && !concreteDischargeActive && mixerState !== 'discharging_concrete' && mixerDoorStateText !== 'OPENED') {
    if (rawMaterialWeight > lastMaterialWeightRef.current + 25) {
      manualDrainFractionRef.current = 0;
    }
    lastMaterialWeightRef.current = rawMaterialWeight;
  }

  // Material discharge / drain calculation accounting for mixerDoorPercent and elapsed drain time
  const relayConfigForVol = loadRelayConfig();
  let selectedRelayId = 14;
  if (volumePerBatch > 1.5 && volumePerBatch <= 2.5) {
    selectedRelayId = 28;
  } else if (volumePerBatch > 2.5) {
    selectedRelayId = 29;
  }
  const row14ForVol = relayConfigForVol.find(r => r.relay === selectedRelayId) || relayConfigForVol.find(r => r.relay === 14);
  const open1Raw = row14ForVol ? parseFloat(row14ForVol.timer1) : 2000;
  const pause1Raw = row14ForVol ? parseFloat(row14ForVol.timer2) : 6000;
  const open2Raw = row14ForVol ? parseFloat(row14ForVol.timer3) : 3000;
  const pause2Raw = row14ForVol ? parseFloat(row14ForVol.timer4) : 5000;
  const open3Raw = row14ForVol ? parseFloat(row14ForVol.timer5) : 3000;
  const pause3Raw = row14ForVol ? parseFloat(row14ForVol.timer6) : 11000;
  const totalDischargeMs = open1Raw + pause1Raw + open2Raw + pause2Raw + open3Raw + pause3Raw;
  const totalDischargeSec = totalDischargeMs / 1000 || 30.0;

  let dischargeRatio = 0;

  if (batchingMode === 'AUTO') {
    if (mixerState === 'discharging_concrete') {
      dischargeRatio = Math.max(0, Math.min(1, dischargeTimeSec / totalDischargeSec));
    } else if (mixerState === 'complete') {
      dischargeRatio = 1.0;
    } else if (mixerDoorPercent > 0 || concreteDischargeActive) {
      dischargeRatio = manualDrainFractionRef.current;
    }
  } else if (batchingMode === 'SEMI_AUTO') {
    if (dischargeTimeSec > 0) {
      dischargeRatio = Math.max(0, Math.min(1, dischargeTimeSec / totalDischargeSec));
    } else if (mixerDoorPercent > 0 || concreteDischargeActive || mixerState === 'discharging_concrete') {
      dischargeRatio = manualDrainFractionRef.current;
    } else {
      dischargeRatio = manualDrainFractionRef.current >= 0.98 ? 1.0 : manualDrainFractionRef.current;
    }
  } else {
    // Mode MANUAL
    if (mixerDoorPercent > 0 || concreteDischargeActive || mixerState === 'discharging_concrete') {
      dischargeRatio = manualDrainFractionRef.current;
    } else {
      dischargeRatio = manualDrainFractionRef.current >= 0.98 ? 1.0 : manualDrainFractionRef.current;
    }
  }

  const remainingRatio = Math.max(0, 1 - dischargeRatio);
  const baseFillRatio = totalBatchTargetWeight > 0 
    ? Math.min(1.0, Math.max(0, rawMaterialWeight / totalBatchTargetWeight)) 
    : 0;

  if (mixerState === 'complete' || mixerState === 'waiting' || (!isRunning && (aggregateInMixer || 0) <= 0 && (semenInMixer || 0) <= 0 && (waterInMixer || 0) <= 0)) {
    currentMixerVolume = 0;
    w_agg = 0;
    w_cement = 0;
    w_water = 0;
  } else {
    currentMixerVolume = baseFillRatio * volumePerBatch * remainingRatio;
    w_agg *= remainingRatio;
    w_cement *= remainingRatio;
    w_water *= remainingRatio;
  }

  // Force bounds
  currentMixerVolume = Math.min(volumePerBatch, Math.max(0, currentMixerVolume));

  // Fill percent for display
  const mixerFillPercent = mixerMaxMixing > 0 ? (currentMixerVolume / mixerMaxMixing) * 100 : 0;

  // Material proportions inside the mixer for color blending
  const totalDry = w_agg + w_cement;
  const targetAir = targetAirLocked || 150;

  const aggRatio = totalDry > 0 ? (w_agg / totalDry) : 1; 
  const cementRatio = totalDry > 0 ? (w_cement / totalDry) : 0; 
  const waterRatio = targetAir > 0 ? (w_water / targetAir) : 0;

  // Gradient transitions: Aggregate (sandy brown), Cement (dusty cement grey), Fresh Wet Concrete (distinct wet-slate blue-grey)
  const cAgg = { r: 148, g: 132, b: 114 }; // Sandy-brown dry aggregate tone
  const cSemen = { r: 172, g: 178, b: 188 }; // Distinct concrete dust grey
  const cWet = { r: 84, g: 96, b: 114 }; // Thick medium-glossy wet concrete slate-blue grey

  const dryR = aggRatio * cAgg.r + cementRatio * cSemen.r;
  const dryG = aggRatio * cAgg.g + cementRatio * cSemen.g;
  const dryB = aggRatio * cAgg.b + cementRatio * cSemen.b;

  const finalR = Math.round((1 - waterRatio) * dryR + waterRatio * cWet.r);
  const finalG = Math.round((1 - waterRatio) * dryG + waterRatio * cWet.g);
  const finalB = Math.round((1 - waterRatio) * dryB + waterRatio * cWet.b);

  const mixerColor_fg = `rgb(${finalR}, ${finalG}, ${finalB})`;
  const mixerColor_bg = `rgb(${Math.round(finalR * 0.68)}, ${Math.round(finalG * 0.68)}, ${Math.round(finalB * 0.68)})`;

  const isPasirActive = isAuto
    ? (isRunning && !isPaused ? (gatePasirSiloOpen || currentStep === 'pasir') : false)
    : (gatePasir1SiloOpen || gatePasir2SiloOpen);
  const isBatuActive = isAuto
    ? (isRunning && !isPaused ? (gateBatuSiloOpen || currentStep === 'batu') : false)
    : (gateBatu1SiloOpen || gateBatu2SiloOpen);
  const isSemen = isAuto
    ? (isRunning && !isPaused ? (screwSemenActive || currentStep === 'semen') : false)
    : screwSemenActive;
  const isAir = isAuto
    ? (isRunning && !isPaused ? (valveWaterActive || currentStep === 'air') : false)
    : valveWaterActive;
  const isAggregat = isAuto
    ? (isRunning && !isPaused ? (conveyorBottomActive || conveyorUpperActive || isPasirActive || isBatuActive) : false)
    : (conveyorBottomActive || conveyorUpperActive || isPasirActive || isBatuActive);

  // Extract cement silo number
  const siloMatch = activeSiloSemen ? activeSiloSemen.match(/Silo\s*(\d+)/i) : null;
  const selectedSiloNumber = siloMatch ? parseInt(siloMatch[1], 10) : 3;

  // Dynamic state selectors for flow pathways
  const isWaterOpen = isAuto ? isAir : valveWaterActive;
  const isAdditiveOpen = isAuto ? isAir : valveWaterActive;
  const isMixerRotating = mixerShaftActive;

  const isWaterDischargeOpen = isAuto ? isAir : gateWaterHopperOpen;

  const isBottomConvRunning = isAuto
    ? (conveyorBottomActive && !isPaused)
    : conveyorBottomActive;
  const isUpperConvRunning = conveyorUpperActive;

  // Single-source of truth variables for concrete level
  const mixerCurrentVolume = currentMixerVolume;
  const fillPercent = mixerMaxMixing > 0 ? Math.min(1.0, Math.max(0, mixerCurrentVolume / mixerMaxMixing)) : 0;
  const hasMaterial = mixerCurrentVolume > 0.005;
  // Maximum visual height is exactly 82px within 96px inside height (leaves 14px headroom empty at top for max mixer capacity)
  const visualConcreteHeight = hasMaterial ? Math.max(2, fillPercent * 82) : 0;
  const surfaceY = 448 - visualConcreteHeight;

  // Real-time sand and stone particle tracking state for physical conveyor belt constraint simulation
  const [particles, setParticles] = useState<any[]>([]);

  useEffect(() => {
    const isMixerActiveOrOccupied = mixerShaftActive || mixerDoorPercent > 0 || concreteDischargeActive || hasMaterial || (aggregateInMixer > 0) || (semenInMixer > 0) || (waterInMixer > 0);
    const shouldRunParticles = isRunning || 
      gatePasir1SiloOpen || gatePasir2SiloOpen || gateBatu1SiloOpen || gateBatu2SiloOpen || 
      conveyorBottomActive || conveyorUpperActive || 
      gatePasirHopperOpen || gateBatuHopperOpen || gateSemenHopperOpen || gateWaterHopperOpen ||
      isMixerActiveOrOccupied;

    if (!shouldRunParticles) {
      if (particles.length > 0) setParticles([]);
      return;
    }

    let animationFrameId: number;
    let lastTime = performance.now();
    let particleIdCounter = 0;

    const updateLoop = (now: number) => {
      // Cap delta time to prevent massive jumps when browser tab is inactive
      const delta = Math.min(0.04, (now - lastTime) / 1000);
      lastTime = now;

      // Handle real-time material drain during discharge when door is open
      if (mixerDoorPercent > 0 || concreteDischargeActive || mixerDoorStateText === 'OPENED' || mixerState === 'discharging_concrete') {
        const doorOpeningFactor = mixerDoorPercent > 0 ? mixerDoorPercent / 100 : 1.0;
        const drainDelta = (doorOpeningFactor / 12.0) * delta;
        manualDrainFractionRef.current = Math.min(1.0, manualDrainFractionRef.current + drainDelta);
      }

      setParticles((prevParticles) => {
        let nextParticles = prevParticles.map((p) => {
          if (p.stage === 'flat') {
            if (conveyorBottomActive) {
              const nextX = p.x + p.speed * 115 * delta;
              // Transition to transition_drop near the end of flat conveyor (wheels centered at 378, extends to 385+)
              if (nextX >= 383) {
                return {
                  ...p,
                  stage: 'drop_flat_to_inclined',
                  x: nextX,
                  y: p.y,
                  vx: p.speed * 115,
                  vy: 5, // slight downward start velocity
                };
              }
              return { ...p, x: nextX };
            } else {
              // Flat belt is stopped, but keep particles resting on it
              return p;
            }
          } else if (p.stage === 'drop_flat_to_inclined') {
            // RED ZONE: falling parabola curve from flat belt end to inclined belt start
            const nextVy = (p.vy ?? 5) + 245 * delta; // accelerate vertically under gravity
            const nextX = p.x + (p.vx ?? 115) * delta;
            const nextY = p.y + nextVy * delta;

            // The inclined conveyor starts at (400, 450) and goes up to (612.5, 290)
            // Linear equation: beltY = 450 - m * (x - 400), with m = (450 - 290) / (612.5 - 400) = 160 / 212.5 = 0.75294
            const beltY = 450 - 0.75294 * (nextX - 400);

            // If the particle drops below the slope plane or past the start pulley point, it lands on the inclined conveyor
            if (nextY >= beltY && nextX >= 400) {
              if (conveyorUpperActive) {
                // Map the contact position smoothly to a relative progress value along the inclined belt (0 to 1)
                const mappedProgress = Math.max(0, Math.min(1, (nextX - 400) / 212.5));
                return {
                  ...p,
                  stage: 'inclined',
                  progress: mappedProgress,
                  x: 400 + 212.5 * mappedProgress,
                  y: 450 - 160 * mappedProgress,
                };
              } else {
                return null; // disappear if the inclined conveyor is stopped
              }
            }

            // Boundary safeguard: if the particle drops too low without contact, remove it
            if (nextY > 500) {
              return null;
            }

            return {
              ...p,
              x: nextX,
              y: nextY,
              vy: nextVy,
            };
          } else if (p.stage === 'inclined') {
            if (conveyorUpperActive) {
              const nextProgress = (p.progress ?? 0) + (p.speed * 0.45 * delta);
              if (nextProgress >= 1.0) {
                // Reach the end of inclined conveyor pulley (612.5, 290)
                return {
                  ...p,
                  stage: 'falling',
                  x: 612.5,
                  y: 286,
                  vx: 28 + Math.random() * 12, // controlled horizontal arch over the pulley forward
                  vy: 8,
                };
              }
              const x = 400 + (612.5 - 400) * nextProgress;
              const y = 450 + (290 - 450) * nextProgress;
              return { ...p, x, y, progress: nextProgress };
            } else {
              // Inclined belt stopped, keep particles in place
              return p;
            }
          } else if (p.stage === 'falling') {
            // YELLOW ZONE: chute constraints and gravity-controlled waterfall curve drop
            const nextVy = (p.vy ?? 8) + 260 * delta;
            const nextX = p.x + (p.vx ?? 35) * delta;
            const nextY = p.y + nextVy * delta;

            // Constrain particles tightly inside the chute using physical boundary clamping (y: 320 to 350)
            let clampedX = nextX;
            if (nextY >= 320) {
              const ratio = (nextY - 320) / 30;
              const left_limit = 607.5 + ratio * 30;
              const right_limit = 747.5 - ratio * 30;
              if (clampedX < left_limit + 1) clampedX = left_limit + 1;
              if (clampedX > right_limit - 1) clampedX = right_limit - 1;
            }

            // Capture particle into Waiting Hopper if chute gate is CLOSED
            if (nextY >= 347) {
              const belongsInHopper = waitingHopperEnabled && 
                                      (waitingHopperState === 'WAITING_HOPPER_FILLING' || waitingHopperState === 'WAITING_HOPPER_READY');
              if (belongsInHopper && !waitingHopperGateOpen) {
                return {
                  ...p,
                  stage: 'in_hopper',
                  x: clampedX,
                  y: 346 + Math.random() * 2.5, // form a pile on the closed gate flappers!
                  vx: 0,
                  vy: 0,
                };
              }
              // Transitions to high-speed swirling churn inside the twinshaft mixer
              return {
                ...p,
                stage: 'churning_in_mixer',
                centerX: Math.random() < 0.5 ? 637.5 : 712.5,
                angle: Math.random() * Math.PI * 2,
                radius: 12 + Math.random() * 28,
                speed: 4 + Math.random() * 3,
                y: 350 + Math.random() * 90,
                x: clampedX,
                lifespan: 8.5
              };
            }

            return { 
              ...p, 
              x: clampedX, 
              y: nextY, 
              vy: nextVy 
            };
          } else if (p.stage === 'in_hopper') {
            // Stay still on top of the gate until it OPENS
            if (waitingHopperGateOpen) {
              return {
                ...p,
                stage: 'falling_from_hopper',
                vy: 20 + Math.random() * 32,
                vx: (Math.random() - 0.5) * 16,
              };
            }
            return p;
          } else if (p.stage === 'falling_from_hopper') {
            const nextVy = (p.vy ?? 20) + 260 * delta;
            const nextY = p.y + nextVy * delta;
            const nextX = p.x + (p.vx ?? 0) * delta;

            if (nextY >= 365) {
              // Transitions to high-speed swirling churn inside the twinshaft mixer
              return {
                ...p,
                stage: 'churning_in_mixer',
                centerX: Math.random() < 0.5 ? 637.5 : 712.5,
                angle: Math.random() * Math.PI * 2,
                radius: 12 + Math.random() * 28,
                speed: 4 + Math.random() * 3,
                y: 365 + Math.random() * 75,
                x: nextX,
                lifespan: 8.5
              };
            }

            return {
              ...p,
              x: nextX,
              y: nextY,
              vy: nextVy,
            };
          } else if (p.stage === 'churning_in_mixer') {
            const nextLifespan = (p.lifespan ?? 8.5) - delta;

            const isDischarging = mixerState === 'discharging_concrete' || mixerDoorPercent > 0 || concreteDischargeActive || mixerDoorStateText === 'OPENED';
            const isFin = isAuto 
              ? (nextLifespan <= 0 || mixerState === 'complete' || (!isRunning && !hasMaterial)) 
              : (!hasMaterial && nextLifespan <= 0);
            if (isFin) {
              return null; // clean up old/stale particles or on sequence termination
            }

            if (isDischarging) {
              // Drift downward toward center bottom gate (X=677.5, Y=450)
              const nextY = p.y + (60 + Math.random() * 30) * delta;
              const nextX = p.x + (677.5 - p.x) * 4 * delta;
              if (nextY >= 450) {
                return null; // drain out completely
              }
              return {
                ...p,
                x: nextX,
                y: nextY,
                lifespan: nextLifespan
              };
            }

            if (isMixerRotating) {
              // Orbital swirl around assigned shaft
              const nextAngle = (p.angle ?? 0) + (p.speed ?? 5) * delta;
              const targetX = p.centerX + Math.cos(nextAngle) * p.radius;
              const targetY = 400 + Math.sin(nextAngle) * p.radius * 0.7; // squashed height ellipse
              // Slight turbulence jitter
              const jitterX = (Math.random() - 0.5) * 6;
              const jitterY = (Math.random() - 0.5) * 6;

              return {
                ...p,
                angle: nextAngle,
                x: Math.max(583, Math.min(772, targetX + jitterX)),
                y: Math.max(355, Math.min(444, targetY + jitterY)),
                lifespan: (nextLifespan <= 0 && hasMaterial) ? (7.0 + Math.random() * 3) : nextLifespan
              };
            } else {
              // Standby/Dampened sinking down
              const currentMixerBottom = 444;
              let nextY = p.y;
              if (p.y < currentMixerBottom - 5) {
                nextY += (15 + Math.random() * 15) * delta;
              }
              const jitterY = (Math.random() - 0.5) * 1.5;
              return {
                ...p,
                y: Math.max(355, Math.min(currentMixerBottom, nextY + jitterY)),
                lifespan: (nextLifespan <= 0 && hasMaterial) ? (7.0 + Math.random() * 3) : nextLifespan
              };
            }
          }
          return p;
        }).filter(Boolean) as any[];

        // Seed and maintain churning aggregate particles inside mixer if material is present
        const currentChurningCount = nextParticles.filter(p => p.stage === 'churning_in_mixer').length;
        if (hasMaterial && currentChurningCount < 16) {
          const toAdd = Math.min(2, 16 - currentChurningCount);
          for (let i = 0; i < toAdd; i++) {
            particleIdCounter++;
            const isLeft = Math.random() < 0.5;
            nextParticles.push({
              id: particleIdCounter + Math.random(),
              type: Math.random() < 0.6 ? 'sand' : 'stone',
              stage: 'churning_in_mixer',
              centerX: isLeft ? 637.5 : 717.5,
              angle: Math.random() * Math.PI * 2,
              radius: 12 + Math.random() * 28,
              speed: 4 + Math.random() * 3,
              x: (isLeft ? 637.5 : 717.5) + (Math.random() - 0.5) * 30,
              y: 380 + Math.random() * 50,
              lifespan: 8.5,
              size: 2.0 + Math.random() * 2.0
            });
          }
        }

        // GREEN ZONE: Spawn sand and stone particles whenever the respective gates are open
        if (conveyorBottomActive || gatePasirHopperOpen || gateBatuHopperOpen) {
          const spawnCount = Math.random() < 0.5 ? 1 : 2;

          // Sand (PASIR) stream under TIMBANGAN PASIR (Discharges from center cx=143)
          if (gatePasirHopperOpen) {
            for (let i = 0; i < spawnCount; i++) {
              particleIdCounter++;
              nextParticles.push({
                id: particleIdCounter + Math.random(),
                type: 'sand',
                x: 143 + (Math.random() - 0.5) * 14,
                y: 412 + (Math.random() - 0.5) * 3,
                speed: 0.95 + Math.random() * 0.35,
                stage: 'flat',
                size: 1.5 + Math.random() * 1.5,
              });
            }
          }

          // Stone (BATU) stream under TIMBANGAN BATU (Discharges from center cx=303)
          if (gateBatuHopperOpen) {
            for (let i = 0; i < spawnCount; i++) {
              particleIdCounter++;
              nextParticles.push({
                id: particleIdCounter + Math.random(),
                type: 'stone',
                x: 303 + (Math.random() - 0.5) * 14,
                y: 411 + (Math.random() - 0.5) * 4,
                speed: 0.95 + Math.random() * 0.35,
                stage: 'flat',
                size: 2.5 + Math.random() * 2.0,
              });
            }
          }
        }

        return nextParticles;
      });

      animationFrameId = requestAnimationFrame(updateLoop);
    };

    animationFrameId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isRunning, conveyorBottomActive, conveyorUpperActive, gatePasirHopperOpen, gateBatuHopperOpen, gateSemenHopperOpen, gateWaterHopperOpen, waitingHopperEnabled, waitingHopperGateOpen, waitingHopperState, mixerShaftActive, mixerDoorPercent, concreteDischargeActive, dischargeTimeSec, mixerDoorStateText, hasMaterial, aggregateInMixer, semenInMixer, waterInMixer, isPaused, mixerState, isAuto, gatePasir1SiloOpen, gatePasir2SiloOpen, gateBatu1SiloOpen, gateBatu2SiloOpen]);

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#05080c] overflow-hidden lg:overflow-visible rounded-[4px] relative">
      <svg 
        viewBox="45 -30 1085 640" 
        className="w-full h-full max-h-full" 
        preserveAspectRatio="xMinYMin meet"
        onClick={() => {
          if (!isAuto) {
            setSelectedManualDevice(null);
          }
        }}
      >
        <defs>
          <filter id="dust-blur">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <clipPath id="pasir-clip">
            <path d="M68 335 L218 335 L168 385 L118 385 Z" />
          </clipPath>
          <clipPath id="batu-clip">
            <path d="M228 335 L378 335 L328 385 L278 385 Z" />
          </clipPath>
          <clipPath id="accum-clip">
            <path d="M68 335 L378 335 L328 385 L118 385 Z" />
          </clipPath>
          <clipPath id="mixer-funnel-clip">
            <path d="M595 280 L760 280 L718 350 L637 350 Z" />
          </clipPath>
          <clipPath id="semen-clip">
            <path d="M622.5 220 L722.5 220 L700 270 L672.5 292 L645 270 Z" />
          </clipPath>
          <clipPath id="air-clip">
            <path d="M760 220 L840 220 L820 260 L800 278 L780 260 Z" />
          </clipPath>
          <clipPath id="mixer-clip">
            <rect x="579.5" y="352" width="196" height="96" rx="3" />
          </clipPath>
          <clipPath id="concrete-level-clip">
            <rect x="579.5" y={surfaceY} width="196" height={Math.max(0, 448 - surfaceY)} />
          </clipPath>
          {/* Dynamic slate concrete gradients representing real volume depth and texture */}
          <linearGradient id="concrete-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={mixerColor_fg} />
            <stop offset="35%" stopColor={mixerColor_fg} />
            <stop offset="100%" stopColor={mixerColor_bg} />
          </linearGradient>
          <linearGradient id="concrete-bg-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={mixerColor_bg} />
            <stop offset="100%" stopColor="#080c14" />
          </linearGradient>
          <linearGradient id="compressorTankGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="25%" stopColor="#60a5fa" />
            <stop offset="65%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#172554" />
          </linearGradient>
          <linearGradient id="gaugeRim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#cbd5e1" />
            <stop offset="50%" stopColor="#475569" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <linearGradient id="finGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="50%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
        </defs>

        {/* Real-time Arduino PIN Monitoring side list removed from layout */}

        {/* Weighing Monitor panel removed from SVG and rendered as native React components in layout */}
        {/* --- AGGREGATE SECTION (LEFT) --- */}
        <g id="aggregate-bins">
          {[
            { x: 68, label: "PASIR 1", isPasir: true, active: isAuto ? (isRunning && !isPaused && gatePasir1SiloOpen) : gatePasir1SiloOpen, weightText: `${(8000 - scales.pasir.actual * 0.7).toFixed(0)} kg` },
            { x: 148, label: "PASIR 2", isPasir: true, active: isAuto ? (isRunning && !isPaused && gatePasir2SiloOpen) : gatePasir2SiloOpen, weightText: `${(5000 - scales.pasir.actual * 0.3).toFixed(0)} kg` },
            { x: 228, label: "BATU 1", isPasir: false, active: isAuto ? (isRunning && !isPaused && gateBatu1SiloOpen) : gateBatu1SiloOpen, weightText: `${(12000 - scales.batu.actual * 0.6).toFixed(0)} kg` },
            { x: 308, label: "BATU 2", isPasir: false, active: isAuto ? (isRunning && !isPaused && gateBatu2SiloOpen) : gateBatu2SiloOpen, weightText: `${(6000 - scales.batu.actual * 0.4).toFixed(0)} kg` }
          ].map((bin, i) => {
            const binId = bin.label.toLowerCase().includes("pasir") 
              ? (bin.label.includes("1") ? "pasir1" : "pasir2")
              : (bin.label.includes("1") ? "batu1" : "batu2");
            return (
              <g 
                key={bin.label}
                className={!isAuto ? "cursor-pointer select-none" : ""}
                {...getDeviceHandlers(binId)}
              >
                <rect x={bin.x} y="175" width="70" height="100" fill="#2c3e50" stroke={theme.outline} strokeWidth="1.5" />
                <path d={`M${bin.x} 275 L${bin.x + 35} 305 L${bin.x + 70} 275`} fill="#2c3e50" stroke={theme.outline} strokeWidth="1.5" />
                <text x={bin.x + 35} y="202" textAnchor="middle" fill="#94a3b8" fontSize="7" fontWeight="black" letterSpacing="1">BIN</text>
                <text 
                  x={bin.x + 35} 
                  y="218" 
                  textAnchor="middle" 
                  fill="#00e5ff" 
                  fontSize={getQuarryLabel(bin.label).length > 12 ? "7px" : "9px"} 
                  fontWeight="bold"
                >
                  {getQuarryLabel(bin.label).toUpperCase()}
                </text>
                <text x={bin.x + 35} y="234" textAnchor="middle" fill={batchingPlantMode === 'SYSTEM_3' ? "#fbbf24" : "#888"} fontSize={batchingPlantMode === 'SYSTEM_3' ? "7.5" : "9"} fontWeight="bold">
                  {batchingPlantMode === 'SYSTEM_3' ? bin.weightText : "100%"}
                </text>
                {batchingPlantMode === 'SYSTEM_3' && (
                  <text x={bin.x + 35} y="246" textAnchor="middle" fill="#f43f5e" fontSize="6.5" fontWeight="black" letterSpacing="0.2">LOSS-IN-WEIGHT</text>
                )}
                {/* Gate Valve: Blinks when active flow is open */}
                <rect 
                  x={bin.x + 25} 
                  y="305" 
                  width="20" 
                  height="6" 
                  fill={bin.active ? theme.flow : theme.red} 
                  stroke="#000" 
                  className={bin.active ? "animate-pulse" : ""}
                />
                
                {/* Particle Stream falling from silo/bin gate down to scales hopper when bin gate is active */}
                {bin.active && (
                  <g>
                    {[...Array(6)].map((_, idx) => (
                       <motion.circle
                        key={idx}
                        cx={bin.x + 35 + (Math.sin(idx) * 2.5)}
                        cy={311}
                        r={bin.isPasir ? 1.5 : 2.5}
                        fill={bin.isPasir ? "#d2b48c" : "#808080"}
                        animate={{ cy: [311, batchingPlantMode === 'SYSTEM_3' ? 415 : 335], opacity: [1, 1, 0] }}
                        transition={{ 
                          duration: batchingPlantMode === 'SYSTEM_3' ? 0.4 + Math.random() * 0.2 : 0.25 + Math.random() * 0.15, 
                          repeat: Infinity, 
                          delay: idx * 0.04, 
                          ease: "linear" 
                        }}
                      />
                    ))}
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* Aggregate Hoppers with Sliding Gates */}
        <g id="hoppers">
          {(() => {
            if (batchingPlantMode === 'SYSTEM_3') {
              return null; // Loss-In-Weight has no secondary hopper scales, materials drop directly onto conveyor!
            }
            
            if (batchingPlantMode === 'SYSTEM_2') {
              // SYSTEM 2 = ACCUMULATIVE AGGREGATE SCALE
              const accumActual = scales.pasir.actual + scales.batu.actual;
              const accumTarget = scales.pasir.target + scales.batu.target;
              const isOpen = gatePasirHopperOpen || gateBatuHopperOpen;
              // Sesuai prinsip loadcell, visual filling dihitung mutlak dari kapasitas maksimal timbangan akumulatif
              const fillRatio = Math.min(1, Math.max(0, accumActual / scaleCapacitiesAccumulative));
              const rectH = fillRatio * 50;
              const cx = 223;

              // Calculate individual component targets for System 2 Accumulative Scale
              const tFactor = parseFloat((activeVolume / (totalCycles || 1)).toFixed(2)) || 1.0;
              const savedJmf = selectedRecipe?.jobMixDetails;
              const targetValuePasir1 = savedJmf?.pasir1 || Math.round((selectedRecipe?.targets?.pasir || 400) * 0.7);
              const targetValuePasir2 = savedJmf?.pasir2 || Math.round((selectedRecipe?.targets?.pasir || 400) * 0.3);
              const targetValueBatu1 = savedJmf?.batu1 || Math.round((selectedRecipe?.targets?.batu || 400) * 0.7);
              const targetValueBatu2 = savedJmf?.batu2 || Math.round((selectedRecipe?.targets?.batu || 400) * 0.3);

              const adjustedTargetPasir1 = Math.round(targetValuePasir1 * tFactor);
              const adjustedTargetPasir2 = Math.round(targetValuePasir2 * tFactor);
              const adjustedTargetBatu1 = Math.round(targetValueBatu1 * tFactor);
              const adjustedTargetBatu2 = Math.round(targetValueBatu2 * tFactor);
              
              return (
                <g key="accumulative_hopper">
                  {/* Hopper Body Background */}
                  <path d="M68 335 L378 335 L328 385 L118 385 Z" fill="#0f131a" stroke={theme.outline} strokeWidth="1.5" />
                  
                  {/* Level Fill */}
                  <rect 
                    x="68" 
                    y={385 - rectH} 
                    width="310" 
                    height={rectH} 
                    fill="#a89276" 
                    clipPath="url(#accum-clip)" 
                    opacity="0.8" 
                  />
                  
                  {/* Outline above */}
                  <path d="M68 335 L378 335 L328 385 L118 385 Z" fill="none" stroke={theme.outline} strokeWidth="1.5" />
                  <text x={cx} y="353" textAnchor="middle" fill="#00e5ff" fontSize="9" fontWeight="black" letterSpacing="0.8" className="select-none">TIMBANGAN AGGREGATE</text>
                  <text x={cx} y="371" textAnchor="middle" fill="#fbbf24" fontSize="10.5" fontWeight="bold" className="font-mono select-none">{accumActual.toFixed(0)} / {accumTarget.toFixed(0)} kg</text>

                  {/* Individual targets visual overlay on left and right sides of scale */}
                  <g className="font-sans select-none" fontSize="7.2" fontWeight="black">
                    <text x="112" y="354" textAnchor="middle" fill="#94a3b8">PS1: <tspan fill="#00ff9c">{adjustedTargetPasir1}</tspan> kg</text>
                    <text x="112" y="366" textAnchor="middle" fill="#94a3b8">PS2: <tspan fill="#00ff9c">{adjustedTargetPasir2}</tspan> kg</text>
                    <text x="334" y="354" textAnchor="middle" fill="#94a3b8">BT1: <tspan fill="#00ff9c">{adjustedTargetBatu1}</tspan> kg</text>
                    <text x="334" y="366" textAnchor="middle" fill="#94a3b8">BT2: <tspan fill="#00ff9c">{adjustedTargetBatu2}</tspan> kg</text>
                  </g>
                  
                  {/* Sliding Gate Pneumatic mechanism */}
                  <g>
                    {/* Pneumatic Cylinder actuator */}
                    <rect x={cx - 42} y="380" width="18" height="6" rx="1.5" fill="#475569" stroke={isOpen ? theme.flow : "#334155"} strokeWidth="1" />
                    <line x1={cx - 24} y1="383" x2={isOpen ? cx - 25 : cx - 15} y2="383" stroke="#cbd5e1" strokeWidth="2" />
                    <line x1={cx - 25} y1="386" x2={cx + 25} y2="386" stroke="#475569" strokeWidth="1.5" />
                    <rect 
                       x={isOpen ? cx - 35 : cx - 15} 
                       y="385" 
                       width="30" 
                       height="3" 
                       fill={isOpen ? theme.flow : theme.red} 
                       stroke="#000" 
                       strokeWidth="0.5" 
                    />
                    <text x={cx} y="402" textAnchor="middle" fill={isOpen ? theme.flow : theme.red} fontSize="7.5" fontWeight="black">
                       {isOpen ? "DISCHARGING TO BELT" : "GATE CLOSED"}
                    </text>
                    <circle cx={cx} cy="375" r="3.5" fill={isOpen ? theme.flow : theme.red} />
                  </g>
                  
                  {/* Cascade particles */}
                  {isOpen && (
                    <g>
                      {[...Array(12)].map((_, idx) => (
                        <motion.circle
                          key={idx}
                          cx={cx - 20 + (idx * 3.6) + Math.sin(idx) * 2}
                          cy={389}
                          r={idx % 2 === 0 ? 1.5 : 2.5}
                          fill={idx % 2 === 0 ? "#d2b48c" : "#808080"}
                          animate={{ cy: [389, 415], opacity: [1, 1, 0] }}
                          transition={{ 
                            duration: 0.25 + Math.random() * 0.15, 
                            repeat: Infinity, 
                            delay: idx * 0.03, 
                            ease: "linear" 
                          }}
                        />
                      ))}
                    </g>
                  )}
                </g>
              );
            }
            
            // SYSTEM 1 = DUAL AGGREGATE SCALE
            return [
              { 
                x: 68, 
                label: "TIMBANGAN PASIR", 
                isPasir: true, 
                isWeighing: isPasirActive, 
                isOpen: gatePasirHopperOpen, 
                clipId: "pasir-clip", 
                fillColor: "#d2b48c", 
                boxH: 50, 
                boxY: 385, 
                actual: scales.pasir.actual, 
                target: scales.pasir.target, 
                cx: 143,
                capacity: scaleCapacities.pasir
              },
              { 
                x: 228, 
                label: "TIMBANGAN BATU", 
                isPasir: false, 
                isWeighing: isBatuActive, 
                isOpen: gateBatuHopperOpen, 
                clipId: "batu-clip", 
                fillColor: "#808080", 
                boxH: 50, 
                boxY: 385, 
                actual: scales.batu.actual, 
                target: scales.batu.target, 
                cx: 303,
                capacity: scaleCapacities.batu
              }
            ].map((h) => {
              // Sesuai prinsip loadcell, visual filling dihitung mutlak dari kapasitas maksimal timbangan masing-masing
              const fillRatio = Math.min(1, Math.max(0, h.actual / h.capacity));
              const rectH = fillRatio * h.boxH;
              return (
                <g 
                  key={h.label}
                  className={!isAuto ? "cursor-pointer select-none" : ""}
                  {...getDeviceHandlers(h.isPasir ? "dischargePasir" : "dischargeBatu")}
                >
                  {/* Hopper Body Background */}
                  <path d={`M${h.x} 335 L${h.x + 150} 335 L${h.x + 100} 385 L${h.x + 50} 385 Z`} fill="#0f131a" stroke={theme.outline} strokeWidth="1.5" />
                  
                  {/* Realtime Smooth Level Fill */}
                  <rect 
                    x={h.x} 
                    y={h.boxY - rectH} 
                    width="150" 
                    height={rectH} 
                    fill={h.fillColor} 
                    clipPath={`url(#${h.clipId})`} 
                    opacity="0.8" 
                  />
                  
                  {/* Re-render the outline above of the level fill so it looks clean */}
                  <path d={`M${h.x} 335 L${h.x + 150} 335 L${h.x + 100} 385 L${h.x + 50} 385 Z`} fill="none" stroke={theme.outline} strokeWidth="1.5" />
                  <text x={h.x + 75} y="349" textAnchor="middle" fill="#00e5ff" fontSize="8" fontWeight="black" letterSpacing="0.5" className="select-none">TIMBANGAN</text>
                  <text x={h.x + 75} y="359" textAnchor="middle" fill="#00e5ff" fontSize="8" fontWeight="black" letterSpacing="0.5" className="select-none">{h.isPasir ? "PASIR" : "BATU"}</text>
                  <text x={h.x + 75} y="371" textAnchor="middle" fill="#fbbf24" fontSize="8.5" fontWeight="bold" className="font-mono select-none">{h.actual.toFixed(0)} kg</text>
                  <text x={h.x + 75} y="380" textAnchor="middle" fill="#94a3b8" fontSize="6.5" fontWeight="black" className="select-none">TARGET: {h.target.toFixed(0)}</text>
   
                  {/* Sliding Gate Pneumatic mechanism */}
                  <g>
                    {/* Pneumatic Cylinder actuator */}
                    <rect x={h.cx - 42} y="380" width="18" height="6" rx="1.5" fill="#475569" stroke={h.isOpen ? theme.flow : "#334155"} strokeWidth="1" />
                    <line x1={h.cx - 24} y1="383" x2={h.isOpen ? h.cx - 25 : h.cx - 15} y2="383" stroke="#cbd5e1" strokeWidth="2" />
                    
                    {/* Slits/Guides */}
                    <line x1={h.cx - 25} y1="386" x2={h.cx + 25} y2="386" stroke="#475569" strokeWidth="1.5" />
                    
                    {/* Sliding Gate Blade */}
                    <rect 
                       x={h.isOpen ? h.cx - 35 : h.cx - 15} 
                       y="385" 
                       width="30" 
                       height="3" 
                       fill={h.isOpen ? theme.flow : theme.red} 
                       stroke="#000" 
                       strokeWidth="0.5" 
                    />
                    
                    {/* Gate status and indicators */}
                    <text x={h.cx} y="402" textAnchor="middle" fill={h.isOpen ? theme.flow : theme.red} fontSize="7.5" fontWeight="black" className="">
                       {h.isOpen ? "DISCHARGING" : "GATE CLOSED"}
                    </text>
                    <circle cx={h.cx} cy="375" r="3.5" fill={h.isOpen ? theme.flow : theme.red} />
                  </g>
   
                  {/* Aggregate Cascade Particles falling from hoppers down to bottom belt conveyor when discharge is active */}
                  {h.isOpen && (
                    <g>
                      {[...Array(8)].map((_, idx) => (
                        <motion.circle
                          key={idx}
                          cx={h.cx - 12 + (idx * 3.2) + Math.sin(idx) * 2}
                          cy={389}
                          r={h.isPasir ? 1.5 : 2.5}
                          fill={h.isPasir ? "#d2b48c" : "#808080"}
                          animate={{ cy: [389, 415], opacity: [1, 1, 0] }}
                          transition={{ 
                            duration: 0.25 + Math.random() * 0.15, 
                            repeat: Infinity, 
                            delay: idx * 0.04, 
                            ease: "linear" 
                          }}
                        />
                      ))}
                    </g>
                  )}
                </g>
              );
            });
          })()}
        </g>

        {/* Conveyor */}
        <g 
          id="conveyor"
          className={!isAuto ? "cursor-pointer select-none" : ""}
          {...getDeviceHandlers('conveyorBottom')}
        >
          <rect x="68" y="415" width="325" height="15" fill="#111" stroke={theme.outline} strokeWidth="1" />
          
          {/* Left Roller with Rotating Dynamo Fan Blades */}
          <g transform="translate(83, 422.5)">
            <circle cx="0" cy="0" r="7" fill="#111" stroke={theme.outline} strokeWidth="1" />
            <g className={isBottomConvRunning ? "spin-cw-active" : ""}>
              <path d="M 0 0 L -2 -5 A 5 5 0 0 1 2 -5 Z" fill="#00ffd0" opacity="0.85" />
              <path d="M 0 0 L 5 -2 A 5 5 0 0 1 5 2 Z" fill="#00ffd0" opacity="0.85" />
              <path d="M 0 0 L 2 5 A 5 5 0 0 1 -2 5 Z" fill="#00ffd0" opacity="0.85" />
              <path d="M 0 0 L -5 2 A 5 5 0 0 1 -5 -2 Z" fill="#00ffd0" opacity="0.85" />
            </g>
            <circle cx="0" cy="0" r="1.5" fill="#181d26" stroke="#00ffd0" strokeWidth="0.5" />
          </g>
          
          {/* Right Roller with Rotating Dynamo Fan Blades */}
          <g transform="translate(378, 422.5)">
            <circle cx="0" cy="0" r="7" fill="#111" stroke={theme.outline} strokeWidth="1" />
            <g className={isBottomConvRunning ? "spin-cw-active" : ""}>
              <path d="M 0 0 L -2 -5 A 5 5 0 0 1 2 -5 Z" fill="#00ffd0" opacity="0.85" />
              <path d="M 0 0 L 5 -2 A 5 5 0 0 1 5 2 Z" fill="#00ffd0" opacity="0.85" />
              <path d="M 0 0 L 2 5 A 5 5 0 0 1 -2 5 Z" fill="#00ffd0" opacity="0.85" />
              <path d="M 0 0 L -5 2 A 5 5 0 0 1 -5 -2 Z" fill="#00ffd0" opacity="0.85" />
            </g>
            <circle cx="0" cy="0" r="1.5" fill="#181d26" stroke="#00ffd0" strokeWidth="0.5" />
          </g>

          <motion.line 
            x1="93" y1="422.5" x2="368" y2="422.5" 
            stroke={isBottomConvRunning ? theme.flow : theme.pipe} 
            strokeWidth="3" 
            strokeDasharray="5 5"
            animate={{ strokeDashoffset: isBottomConvRunning ? [20, 0] : [0, 0] }}
            transition={isBottomConvRunning ? { duration: 0.5, repeat: Infinity, ease: "linear" } : { duration: 0 }}
          />
        </g>



        {/* Main Conveyor to Mixer (Feeder) */}
        <g 
          id="feeder-conveyor"
          className={!isAuto ? "cursor-pointer select-none" : ""}
          {...getDeviceHandlers('conveyorUpper')}
        >
          {/* Solid Body with Outline - Shifted up corresponding to aggregate conveyor */}
          <line x1="400" y1="450" x2="612.5" y2="290" stroke={theme.outline} strokeWidth="17" strokeLinecap="round" />
          <line x1="400" y1="450" x2="612.5" y2="290" stroke="#111" strokeWidth="15" strokeLinecap="round" />
          
          {/* Bottom-Left Roller with Rotating Dynamo Fan Blades */}
          <g transform="translate(400, 450)">
            <circle cx="0" cy="0" r="8" fill="#111" stroke={theme.outline} strokeWidth="1" />
            <g className={isUpperConvRunning ? "spin-cw-active" : ""}>
              <path d="M 0 0 L -2.5 -5.8 A 6 6 0 0 1 2.5 -5.8 Z" fill="#00ffd0" opacity="0.85" />
              <path d="M 0 0 L 5.8 -2.5 A 6 6 0 0 1 5.8 2.5 Z" fill="#00ffd0" opacity="0.85" />
              <path d="M 0 0 L 2.5 5.8 A 6 6 0 0 1 -2.5 5.8 Z" fill="#00ffd0" opacity="0.85" />
              <path d="M 0 0 L -5.8 2.5 A 6 6 0 0 1 -5.8 -2.5 Z" fill="#00ffd0" opacity="0.85" />
            </g>
            <circle cx="0" cy="0" r="2" fill="#181d26" stroke="#00ffd0" strokeWidth="0.5" />
          </g>
          
          {/* Top-Right Roller with Rotating Dynamo Fan Blades */}
          <g transform="translate(612.5, 290)">
            <circle cx="0" cy="0" r="8" fill="#111" stroke={theme.outline} strokeWidth="1" />
            <g className={isUpperConvRunning ? "spin-cw-active" : ""}>
              <path d="M 0 0 L -2.5 -5.8 A 6 6 0 0 1 2.5 -5.8 Z" fill="#00ffd0" opacity="0.85" />
              <path d="M 0 0 L 5.8 -2.5 A 6 6 0 0 1 5.8 2.5 Z" fill="#00ffd0" opacity="0.85" />
              <path d="M 0 0 L 2.5 5.8 A 6 6 0 0 1 -2.5 5.8 Z" fill="#00ffd0" opacity="0.85" />
              <path d="M 0 0 L -5.8 2.5 A 6 6 0 0 1 -5.8 -2.5 Z" fill="#00ffd0" opacity="0.85" />
            </g>
            <circle cx="0" cy="0" r="2" fill="#181d26" stroke="#00ffd0" strokeWidth="0.5" />
          </g>
          
          <motion.line 
            x1="400" y1="450" x2="612.5" y2="290" 
            stroke={isUpperConvRunning ? theme.flow : theme.pipe} 
            strokeWidth="3" 
            strokeDasharray="5 5"
            animate={{ strokeDashoffset: isUpperConvRunning ? [20, 0] : [0, 0] }}
            transition={isUpperConvRunning ? { duration: 0.5, repeat: Infinity, ease: "linear" } : { duration: 0 }}
          />
        </g>

        {/* PHYSICAL AGGREGATE LAYER ON BELTS & CASCADE INTO MIXER */}
        <g id="conveyor-aggregates-layer">
          {/* Non-falling particles (moving on bottom, dropping, or moving up the inclined conveyor) */}
          {particles.filter(p => p.stage !== 'falling' && p.stage !== 'churning_in_mixer').map((p) => (
            <circle
              key={p.id}
              cx={p.x}
              cy={p.y}
              r={p.size}
              fill={p.type === 'sand' ? '#d2b48c' : '#808080'}
              opacity={0.95}
            />
          ))}

          {/* Falling particles constrained absolutely inside the chute drop boundary */}
          <g clipPath="url(#mixer-funnel-clip)">
            {particles.filter(p => p.stage === 'falling').map((p) => (
              <circle
                key={p.id}
                cx={p.x}
                cy={p.y}
                r={p.size}
                fill={p.type === 'sand' ? '#d2b48c' : '#808080'}
                opacity={0.9}
              />
            ))}
          </g>
        </g>

        {/* --- SILO SECTION (TOP RIGHT) --- */}
        <g id="silos">
          {/* Total Cumulative Cement Stock Indicator */}
          {(() => {
            const totalSemenStock = siloWeights.slice(0, jumlahSilo).reduce((a, b) => a + b, 0);
            const totalSemenTon = totalSemenStock / 1000;
            return (
              <g transform="translate(545, 0)">
                <rect 
                  x="0" 
                  y="2" 
                  width="255" 
                  height="20" 
                  rx="3" 
                  fill="#030712"
                  stroke="#ef4444" 
                  strokeWidth="1.2"
                />
                <text 
                  x="127.5" 
                  y="15" 
                  textAnchor="middle" 
                  fill="#ffffff" 
                  fontSize="9px" 
                  fontWeight="black"
                  fontFamily="sans-serif"
                >
                  Stok semen : {Math.round(totalSemenStock).toLocaleString('id-ID')} kg ( {Math.round(totalSemenTon)} Ton )
                </text>
              </g>
            );
          })()}

          {[...Array(jumlahSilo)].map((_, i) => {
            const groupWidth = (jumlahSilo - 1) * 45 + 30;
            const startX = 672.5 - groupWidth / 2;
            const siloLeftX = startX + i * 45;
            const siloX = siloLeftX + 15;
            const siloY = 150;
            const isThisSiloSelected = isAuto 
              ? (selectedSiloNumber === (i + 1))
              : (activeSiloSemen.match(/Silo\s*(\d+)/i)?.[1] === String(i + 1));
            const isThisSiloActive = isAuto
              ? (isSemen && isThisSiloSelected)
              : (screwSemenActive && isThisSiloSelected);
            const weightVal = siloWeights[i] ?? 0;
            const maxCap = 120000;
            const fillRatio = Math.min(1, Math.max(0, weightVal / maxCap));
            
            // Draw silo fill heights
            const bodyHeight = 100;
            const fillHeight = bodyHeight * fillRatio;
            const fillY = 130 - fillHeight;
            
            return (
              <g 
                key={i}
                className={!isAuto ? "cursor-pointer select-none" : ""}
                {...getDeviceHandlers(`silo${i + 1}`, i + 1)}
              >
                {/* Cylinder background */}
                <rect 
                  x={siloLeftX} 
                  y="30" 
                  width="30" 
                  height="100" 
                  fill="#050a12" 
                />
                
                {/* Cylinder filled level state */}
                {fillRatio > 0 && (
                  <rect 
                    x={siloLeftX} 
                    y={fillY} 
                    width="30" 
                    height={fillHeight} 
                    fill={isThisSiloSelected ? "#10b981" : "#475569"} 
                    opacity={isThisSiloActive ? 0.85 : 0.6}
                    className={isThisSiloActive ? "animate-[pulse_1.5s_infinite]" : ""}
                  />
                )}
                
                {/* Cylinder main body outline */}
                <rect 
                  x={siloLeftX} 
                  y="30" 
                  width="30" 
                  height="100" 
                  fill="none" 
                  stroke={isThisSiloSelected ? "#10b981" : theme.outline} 
                  strokeWidth={isThisSiloSelected ? "1.5" : "1"} 
                />

                {/* Cone tip funnel background */}
                <path 
                  d={`M${siloLeftX} 130 L${siloLeftX + 15} 150 L${siloLeftX + 30} 130`} 
                  fill="#050a12"
                />

                {/* Cone tip filled level */}
                {weightVal > 0 && (
                  <path 
                    d={`M${siloLeftX + (15 - 15 * Math.min(1, weightVal / 5000))} ${130 + (20 * (1 - Math.min(1, weightVal / 5000)))} L${siloLeftX + 15} 150 L${siloLeftX + 15 + (15 * Math.min(1, weightVal / 5000))} ${130 + (20 * (1 - Math.min(1, weightVal / 5000)))}`} 
                    fill={isThisSiloSelected ? "#10b981" : "#475569"} 
                    opacity={isThisSiloActive ? 0.85 : 0.6}
                  />
                )}

                {/* Cone tip funnel outline */}
                <path 
                  d={`M${siloLeftX} 130 L${siloLeftX + 15} 150 L${siloLeftX + 30} 130`} 
                  fill="none" 
                  stroke={isThisSiloSelected ? "#10b981" : theme.outline} 
                  strokeWidth={isThisSiloSelected ? "1.5" : "1"} 
                />
                
                {/* Cement Flow Path (Orthogonal lines with elbows) */}
                {/* 1. Base Pipe casing (Always visible as semi-transparent green to match Image 1 standby) */}
                <path 
                  d={`M${siloX} ${siloY} V200 H${672.5 + (i - (jumlahSilo - 1) / 2) * 12} V220`}
                  fill="none" 
                  stroke={isThisSiloActive ? "#00ffd0" : "#10b981"} 
                  strokeWidth={isThisSiloActive ? "4" : "3"} 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  opacity={isThisSiloActive ? "0.9" : "0.35"} 
                />

                {/* 2. Glow effect behind (only when active) */}
                {isThisSiloActive && (
                  <path 
                    d={`M${siloX} ${siloY} V200 H${672.5 + (i - (jumlahSilo - 1) / 2) * 12} V220`}
                    fill="none" 
                    stroke="#10b981" 
                    strokeWidth="8" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    opacity="0.4"
                    className="blur-[2px]"
                  />
                )}

                {/* 3. Animated material stream core (only when active) */}
                {isThisSiloActive && (
                  <motion.path 
                    d={`M${siloX} ${siloY} V200 H${672.5 + (i - (jumlahSilo - 1) / 2) * 12} V220`}
                    fill="none" 
                    stroke="#ffffff" 
                    strokeWidth="1.5"
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeDasharray="6 6"
                    animate={{ strokeDashoffset: [0, -24] }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  />
                )}

                {/* Butterfly Valve at cone tip */}
                <g transform={`translate(${siloX}, ${siloY})`}>
                  <path 
                    d="M-6 -4 L6 4 V-4 L-6 4 Z" 
                    fill={isThisSiloActive ? theme.flow : theme.red} 
                    stroke="#000" 
                    strokeWidth="1" 
                    className={isThisSiloActive ? "animate-pulse" : ""}
                  />
                  <circle r="2" fill="#000" />
                </g>

                <text 
                  x={siloX} 
                  y="175" 
                  textAnchor="middle" 
                  fill={isThisSiloSelected ? "#34d399" : "#64748b"} 
                  fontSize="7.5" 
                  fontWeight="black"
                  className=""
                >
                  SILO {i + 1}
                </text>
                
                <text 
                  x={siloX} 
                  y="185" 
                  textAnchor="middle" 
                  fill={isThisSiloSelected ? "#00ffd0" : "#94a3b8"} 
                  fontSize="7px" 
                  fontWeight="black"
                >
                  {weightVal.toLocaleString('id-ID')} Kg
                </text>
                
                {/* Active Weighing overlay value inside Silo body */}
                {isThisSiloActive && (
                  <text 
                    x={siloX} 
                    y="55" 
                    textAnchor="middle" 
                    fill="#00ffd0" 
                    fontSize="8.5" 
                    fontWeight="black"
                  >
                    {scales.semen.actual.toFixed(0)}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* Cement Scale Hopper (Rounded Aesthetic) */}
        <g id="cement-scale-hopper">
          {/* Hopper Body Background */}
          <path 
            d="M622.5 220 L722.5 220 L700 270 L672.5 292 L645 270 Z" 
            fill="#0f1419" 
            stroke={theme.outline} 
            strokeWidth="1.5" 
            strokeLinejoin="round" 
            strokeLinecap="round" 
          />
          
          {/* Cement Level Filling Animation */}
          {(() => {
            // Sesuai prinsip loadcell, visual filling dihitung mutlak dari kapasitas maksimal timbangan semen
            const r = Math.min(1, Math.max(0, scales.semen.actual / scaleCapacities.semen));
            const rectH = r * 72;
            return (
              <rect 
                x="620" 
                y={292 - rectH} 
                width="110" 
                height={rectH} 
                fill="#808080" 
                clipPath="url(#semen-clip)" 
                opacity="0.8" 
              />
            );
          })()}

          {/* Re-render Outline so it borders the fill beautifully */}
          <path 
            d="M622.5 220 L722.5 220 L700 270 L672.5 292 L645 270 Z" 
            fill="none" 
            stroke={theme.outline} 
            strokeWidth="1.5" 
            strokeLinejoin="round" 
            strokeLinecap="round" 
          />
          <line x1="655" y1="270" x2="690" y2="270" stroke={theme.outline} strokeWidth="1" opacity="0.3" strokeLinecap="round" />
          
          <text x="672.5" y="243" textAnchor="middle" fill={theme.outline} fontSize="7" fontWeight="black" letterSpacing="0.5">TIMBANGAN</text>
          <text x="672.5" y="253" textAnchor="middle" fill={theme.outline} fontSize="7" fontWeight="black" letterSpacing="0.5">SEMEN</text>
          
          <g 
            className={!isAuto ? "cursor-pointer select-none" : ""}
            {...getDeviceHandlers('dischargeSemen')}
          >
            <circle cx="672.5" cy="292" r="8" fill="#0a0f14" stroke={theme.outline} strokeWidth="1" />
            <circle cx="672.5" cy="292" r="5" fill={gateSemenHopperOpen ? theme.flow : theme.red} />
          </g>
          
          {/* Output to mixer */}
          {/* 1. Base Pipe casing (Always visible as semi-transparent green to match style) */}
          <path 
            d="M672.5 300 V320"
            fill="none" 
            stroke={gateSemenHopperOpen ? "#00ffd0" : "#10b981"} 
            strokeWidth={gateSemenHopperOpen ? "4" : "3"} 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            opacity={gateSemenHopperOpen ? "0.9" : "0.35"} 
          />

          {/* 2. Glow effect behind (only when active) */}
          {gateSemenHopperOpen && (
            <path 
              d="M672.5 300 V320"
              fill="none" 
              stroke="#10b981" 
              strokeWidth="8" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              opacity="0.4"
              className="blur-[2px]"
            />
          )}

          {/* 3. Animated material stream core (only when active, flowing down) */}
          {gateSemenHopperOpen && (
            <motion.path 
              d="M672.5 300 V320"
              fill="none" 
              stroke="#ffffff" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeDasharray="6 6"
              animate={{ strokeDashoffset: [0, -24] }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            />
          )}

          {/* Animated Gray Cement Dust Plume inside mixer feeding funnel */}
          {gateSemenHopperOpen && (
            <g>
              {[...Array(5)].map((_, idx) => (
                <motion.ellipse
                  key={idx}
                  cx={672.5 + (Math.sin(idx) * 4)}
                  cy={305}
                  rx={4 + idx * 2.5}
                  ry={3 + idx * 1.5}
                  fill="#9cb4c2"
                  opacity={0.5}
                  animate={{ 
                    cy: [305, 335], 
                    rx: [4, 15], 
                    ry: [3, 10], 
                    opacity: [0.6, 0.4, 0] 
                  }}
                  transition={{ 
                    duration: 0.4 + Math.random() * 0.3, 
                    repeat: Infinity, 
                    delay: idx * 0.08, 
                    ease: "easeOut" 
                  }}
                />
              ))}
            </g>
          )}
        </g>

        {/* --- LIQUID TANKS (FAR RIGHT STYLE) --- */}
        <g id="liquid-tanks">
          {[
            { x: 860, label: "TANK AIR", color: theme.accentBlue },
            { x: 920, label: "ADDITIVE", color: theme.accentGreen }
          ].map((t) => {
            const isTankAir = t.label === "TANK AIR";
            const isOpen = isTankAir ? isWaterOpen : isAdditiveOpen;
            return (
              <g 
                key={t.label}
                className={(!isAuto && isTankAir) ? "cursor-pointer select-none" : ""}
                {...(isTankAir ? getDeviceHandlers('valveIsiAir') : {})}
              >
                <ellipse cx={t.x + 20} cy="40" rx="20" ry="8" fill="#2c3e50" stroke={theme.outline} />
                <rect x={t.x} y="40" width="40" height="60" fill="#2c3e50" stroke={theme.outline} />
                <ellipse cx={t.x + 20} cy="100" rx="20" ry="8" fill="#2c3e50" stroke={theme.outline} />
                
                {/* Active liquid level visually filling up and emptying */}
                {isOpen && (
                  <rect x={t.x + 5} y="60" width="30" height="35" fill={isTankAir ? "rgba(41,121,255,0.4)" : "rgba(0,230,118,0.35)"} />
                )}
                
                <text x={t.x + 20} y="123" textAnchor="middle" fill="#888" fontSize="8">{t.label}</text>
                
                {/* Pneumatic Butterfly Valve at outtake line */}
                <g>
                  <rect x={t.x + 10} y="126" width="20" height="6" rx="1" fill="#475569" stroke={isOpen ? theme.flow : "#334155"} strokeWidth="1" />
                  <line x1={t.x + 20} y1="132" x2={t.x + 20} y2="134" stroke="#cbd5e1" strokeWidth="2" />
                  
                  {/* Flange butterfly body */}
                  <path 
                    d={`M${t.x + 11} 134 L${t.x + 29} 144 V134 L${t.x + 11} 144 Z`} 
                    fill={isOpen ? theme.flow : theme.red} 
                    stroke="#000" 
                    strokeWidth="1" 
                  />
                  <circle cx={t.x + 20} cy="139" r="2.5" fill="#000" />
                  
                  {/* Valve mini label indicator */}
                  <text x={t.x + 20} y="152" textAnchor="middle" fill={isOpen ? theme.flow : theme.red} fontSize="6" fontWeight="bold">
                    {isOpen ? "OPEN" : "CLOSED"}
                  </text>
                </g>
                
                {/* Pipes conveying liquids to water scale hopper */}
                {/* 1. Base Pipe casing (Always visible as semi-transparent blue/green) */}
                <path 
                  d={`M${t.x + 20} 145 V200 H800 V220`}
                  fill="none" 
                  stroke={isTankAir ? (isOpen ? "#00e5ff" : "#0284c7") : (isOpen ? "#00ff9c" : "#059669")} 
                  strokeWidth={isOpen ? "4" : "3"} 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  opacity={isOpen ? "0.9" : "0.35"} 
                />

                {/* 2. Glow effect behind (only when active) */}
                {isOpen && (
                  <path 
                    d={`M${t.x + 20} 145 V200 H800 V220`}
                    fill="none" 
                    stroke={isTankAir ? "#0284c7" : "#059669"} 
                    strokeWidth="8" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    opacity="0.4"
                    className="blur-[2px]"
                  />
                )}

                {/* 3. Animated material stream core (only when active) */}
                {isOpen && (
                  <motion.path 
                    d={`M${t.x + 20} 145 V200 H800 V220`}
                    fill="none" 
                    stroke="#ffffff" 
                    strokeWidth="1.5"
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeDasharray="6 6"
                    animate={{ strokeDashoffset: [0, -24] }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                  />
                )}
              </g>
            );
          })}
        </g>

        {/* Water Scale Hopper (Rounded Aesthetic) */}
        <g id="water-scale-hopper">
          {/* Hopper Body Background */}
          <path 
            d="M760 220 L840 220 L820 260 L800 278 L780 260 Z" 
            fill="#0f1419" 
            stroke={theme.outline} 
            strokeWidth="1.5" 
            strokeLinejoin="round" 
            strokeLinecap="round" 
          />
          
          {/* Water Level Filling Animation */}
          {(() => {
            // Sesuai prinsip loadcell, visual filling dihitung mutlak dari kapasitas maksimal timbangan air & aditif
            const r = Math.min(1, Math.max(0, scales.air.actual / scaleCapacities.air));
            const rectH = r * 58;
            return (
              <rect 
                x="760" 
                y={278 - rectH} 
                width="90" 
                height={rectH} 
                fill="#2563eb" 
                clipPath="url(#air-clip)" 
                opacity="0.8" 
              />
            );
          })()}

          {/* Re-render Outline to border fill beautifully */}
          <path 
            d="M760 220 L840 220 L820 260 L800 278 L780 260 Z" 
            fill="none" 
            stroke={theme.outline} 
            strokeWidth="1.5" 
            strokeLinejoin="round" 
            strokeLinecap="round" 
          />
          <line x1="785" y1="260" x2="815" y2="260" stroke={theme.outline} strokeWidth="1" opacity="0.3" strokeLinecap="round" />
          
          <text x="800" y="240" textAnchor="middle" fill={theme.outline} fontSize="7" fontWeight="black">TIMBANGAN</text>
          <text x="800" y="250" textAnchor="middle" fill={theme.outline} fontSize="7" fontWeight="black">AIR & ADITIF</text>
          
          <g 
            className={!isAuto ? "cursor-pointer select-none" : ""}
            {...getDeviceHandlers('dischargeAir')}
          >
            <circle cx="800" cy="278" r="7" fill="#0a0f14" stroke={theme.outline} strokeWidth="1" />
            <circle cx="800" cy="278" r="4" fill={isWaterDischargeOpen ? theme.flow : theme.red} className={isWaterDischargeOpen ? "animate-pulse" : ""} />
          </g>
          
          {/* Outlet water pipeline discharging downstream - routed above 300 to cleanly bypass the integrated PLC panel */}
          {/* 1. Base Pipe casing (Always visible as semi-transparent blue) */}
          <path 
            d="M800 285 V292 H700 V320"
            fill="none" 
            stroke={gateWaterHopperOpen ? "#00e5ff" : "#0284c7"} 
            strokeWidth={gateWaterHopperOpen ? "4" : "3"} 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            opacity={gateWaterHopperOpen ? "0.9" : "0.35"} 
          />

          {/* 2. Glow effect behind (only when active) */}
          {gateWaterHopperOpen && (
            <path 
              d="M800 285 V292 H700 V320"
              fill="none" 
              stroke="#0284c7" 
              strokeWidth="8" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              opacity="0.4"
              className="blur-[2px]"
            />
          )}

          {/* 3. Animated material stream core (only when active, flowing down) */}
          {gateWaterHopperOpen && (
            <motion.path 
              d="M800 285 V292 H700 V320"
              fill="none" 
              stroke="#ffffff" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeDasharray="6 6"
              animate={{ strokeDashoffset: [0, -24] }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            />
          )}

          {/* Water Discharge Droplets entering mixer */}
          {gateWaterHopperOpen && (
            <g>
              {[...Array(6)].map((_, idx) => (
                <motion.circle
                  key={idx}
                  cx={688 + (idx * 5) + Math.sin(idx) * 2}
                  cy={320}
                  r={1.8}
                  fill="#38bdf8"
                  animate={{ cy: [320, 350], opacity: [1, 1, 0] }}
                  transition={{ 
                    duration: 0.3 + Math.random() * 0.15, 
                    repeat: Infinity, 
                    delay: idx * 0.05, 
                    ease: "linear" 
                  }}
                />
              ))}
            </g>
          )}
        </g>

        {/* --- MIXER (CENTER BOTTOM) --- */}
        <g id="mixer-unit">
          {/* Input Funnel - Centered over mixer (677.5) and wide enough to cover conveyor and hopper */}
          <path d="M607.5 320 L747.5 320 L717.5 350 L637.5 350 Z" fill="#222" stroke={theme.outline} strokeWidth="1.5" />
          
          {/* Dynamic material mass rising with aggregate weight in Waiting Hopper mode */}
          {waitingHopperEnabled && waitingHopperWeight > 0 && (() => {
            // Sesuai prinsip loadcell, visual filling dihitung mutlak dari kapasitas fisik waiting hopper
            const ratio = Math.min(1.0, waitingHopperWeight / scaleCapacitiesWaitingHopper);
            const h = ratio * 26;
            return (
              <path 
                d={`M ${637.5 - h} ${350 - h} L ${717.5 + h} ${350 - h} L 717.5 350 L 637.5 350 Z`} 
                fill="#8a7c6f" 
                opacity="0.85" 
              />
            );
          })()}

          {/* Double Pneumatic Hinged Gate Flapper animation */}
          <g 
            className={!isAuto ? "cursor-pointer select-none" : ""}
            {...getDeviceHandlers('waitingHopperGate')}
          >
            <motion.line 
              x1="637.5" y1="350" 
              x2={waitingHopperGateOpen ? "637.5" : "677.5"} 
              y2={waitingHopperGateOpen ? "362" : "350"} 
              stroke={waitingHopperGateOpen ? "#22c55e" : "#ef4444"} 
              strokeWidth="3.5" 
            />
            <motion.line 
              x1="717.5" y1="350" 
              x2={waitingHopperGateOpen ? "717.5" : "677.5"} 
              y2={waitingHopperGateOpen ? "362" : "350"} 
              stroke={waitingHopperGateOpen ? "#22c55e" : "#ef4444"} 
              strokeWidth="3.5" 
            />
          </g>

          {/* Floating live digital HMI tag bubble for Waiting Hopper Status */}
          {waitingHopperEnabled && (
            <g transform="translate(677.5, 292)" className="select-none pointer-events-none">
              {/* Pulsating outline box */}
              <rect 
                x="-52" y="-12" width="104" height="24" rx="6" 
                fill="#0f172a" 
                stroke={
                  waitingHopperState === 'WAITING_HOPPER_FILLING' ? '#f59e0b' :
                  waitingHopperState === 'WAITING_HOPPER_READY' ? '#06b6d4' :
                  waitingHopperState === 'WAITING_HOPPER_DISCHARGING' ? '#22c55e' :
                  waitingHopperState === 'WAITING_HOPPER_EMPTY' ? '#ef4444' : '#64748b'
                }
                strokeWidth="1.5"
                className={
                  waitingHopperState === 'WAITING_HOPPER_FILLING' ? 'animate-pulse' :
                  waitingHopperState === 'WAITING_HOPPER_DISCHARGING' ? 'animate-bounce' : ''
                }
              />
              {/* Base overlay outline */}
              <rect 
                x="-52" y="-12" width="104" height="24" rx="6" 
                fill="transparent" 
                stroke={
                  waitingHopperState === 'WAITING_HOPPER_FILLING' ? '#f59e0b' :
                  waitingHopperState === 'WAITING_HOPPER_READY' ? '#06b6d4' :
                  waitingHopperState === 'WAITING_HOPPER_DISCHARGING' ? '#22c55e' :
                  waitingHopperState === 'WAITING_HOPPER_EMPTY' ? '#ef4444' : '#475569'
                }
                strokeWidth="1"
              />
              <text 
                textAnchor="middle" y="-2" 
                fill={
                  waitingHopperState === 'WAITING_HOPPER_FILLING' ? '#fbbf24' :
                  waitingHopperState === 'WAITING_HOPPER_READY' ? '#22d3ee' :
                  waitingHopperState === 'WAITING_HOPPER_DISCHARGING' ? '#4ade80' :
                  waitingHopperState === 'WAITING_HOPPER_EMPTY' ? '#f87171' : '#94a3b8'
                }
                className="font-mono font-black tracking-widest text-[7px]"
              >
                {
                  waitingHopperState === 'WAITING_HOPPER_FILLING' ? 'CO-FILLING' :
                  waitingHopperState === 'WAITING_HOPPER_READY' ? 'WH: READY' :
                  waitingHopperState === 'WAITING_HOPPER_DISCHARGING' ? 'DISCHARGING' :
                  waitingHopperState === 'WAITING_HOPPER_EMPTY' ? 'WH: EMPTY' : 'WH: IDLE'
                }
              </text>
              <text textAnchor="middle" y="7" fill="#64748b" className="font-mono text-[5.5px] font-black">
                {Math.round(waitingHopperWeight)} Kg
              </text>
            </g>
          )}
          
          {/* Mixer Frame Body Box */}
          <rect x="577.5" y="350" width="200" height="100" rx="4" fill="#050914" stroke={theme.outline} strokeWidth="2" />

          {/* Real-time Dynamic Concrete Level and Churn Animations inside Mixer Area */}
          {(() => {
            return (
              <g clipPath="url(#mixer-clip)">
                {/* Flowing Water Effect inside the Mixer - Distributed Spray Bar */}
                {gateWaterHopperOpen && (
                  <g>
                    {/* 1. Evenly distributed vertical spray streams running the entire length of the water pipe */}
                    {[...Array(18)].map((_, i) => {
                      const streamX = 585 + (i * 10.6); // Spaced perfectly across the 190px top span of mixer
                      const speed = 0.45 + (i % 3) * 0.12;
                      const delay = (i % 4) * 0.08;
                      return (
                        <motion.line
                          key={`mixer-water-stream-evenly-${i}`}
                          x1={streamX}
                          y1={352}
                          x2={streamX}
                          y2={surfaceY}
                          stroke="#38bdf8"
                          strokeWidth={1.2 + (i % 2) * 0.8}
                          strokeDasharray="6 8"
                          opacity={0.75}
                          animate={{
                            strokeDashoffset: [0, -28]
                          }}
                          transition={{
                            duration: speed,
                            repeat: Infinity,
                            ease: "linear",
                            delay: delay
                          }}
                        />
                      );
                    })}

                    {/* Additional delicate misty secondary spray threads for dense, high-volume visual feel */}
                    {[...Array(12)].map((_, i) => {
                      const streamX = 590 + (i * 15.6);
                      const speed = 0.35 + (i % 2) * 0.1;
                      const delay = i * 0.06;
                      return (
                        <motion.line
                          key={`mixer-water-spray-dense-${i}`}
                          x1={streamX}
                          y1={352}
                          x2={streamX}
                          y2={surfaceY}
                          stroke="rgba(56, 189, 248, 0.45)"
                          strokeWidth="0.8"
                          strokeDasharray="4 12"
                          animate={{
                            strokeDashoffset: [0, -32]
                          }}
                          transition={{
                            duration: speed,
                            repeat: Infinity,
                            ease: "linear",
                            delay: delay
                          }}
                        />
                      );
                    })}

                    {/* 2. Multiple distributed splash ripples where water spray hits the surface */}
                    {[595, 630, 665, 700, 735, 760].map((rippleX, idx) => {
                      return (
                        <g key={`water-ripple-point-${idx}`}>
                          <motion.ellipse
                            cx={rippleX}
                            cy={surfaceY}
                            rx="10"
                            ry="3"
                            fill="none"
                            stroke="#e0f2fe"
                            strokeWidth="1"
                            animate={{
                              rx: [1, 20],
                              ry: [0.2, 5],
                              opacity: [1, 0]
                            }}
                            transition={{
                              duration: 0.7,
                              repeat: Infinity,
                              ease: "easeOut",
                              delay: idx * 0.12
                            }}
                          />
                          <motion.ellipse
                            cx={rippleX}
                            cy={surfaceY}
                            rx="10"
                            ry="3"
                            fill="none"
                            stroke="#38bdf8"
                            strokeWidth="0.75"
                            animate={{
                              rx: [2, 14],
                              ry: [0.5, 3.5],
                              opacity: [0.9, 0]
                            }}
                            transition={{
                              duration: 0.7,
                              repeat: Infinity,
                              ease: "easeOut",
                              delay: idx * 0.12 + 0.25
                            }}
                          />
                        </g>
                      );
                    })}

                    {/* 3. Horizontal shifting water currents and highlights across the entire width */}
                    <motion.path
                      d={`M 582 ${surfaceY} Q 615 ${surfaceY - 3} 645 ${surfaceY} Q 675 ${surfaceY + 3} 705 ${surfaceY} Q 735 ${surfaceY - 3} 770 ${surfaceY}`}
                      fill="none"
                      stroke="#0284c7"
                      strokeWidth="2.5"
                      opacity="0.7"
                      strokeDasharray="18 18"
                      animate={{
                        strokeDashoffset: [0, 50]
                      }}
                      transition={{
                        duration: 1.4,
                        repeat: Infinity,
                        ease: "linear"
                      }}
                    />
                    <motion.path
                      d={`M 582 ${surfaceY} Q 615 ${surfaceY + 2} 645 ${surfaceY} Q 675 ${surfaceY - 2} 705 ${surfaceY} Q 735 ${surfaceY + 2} 770 ${surfaceY}`}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                      opacity="0.75"
                      strokeDasharray="12 14"
                      animate={{
                        strokeDashoffset: [40, -10]
                      }}
                      transition={{
                        duration: 1.1,
                        repeat: Infinity,
                        ease: "linear"
                      }}
                    />

                    {/* 4. Fine water splash beads distributed across wide spacing points escaping from the impact line */}
                    {[595, 630, 665, 700, 735, 760].map((splashX, idx) => (
                      <g key={`sparkles-${idx}`}>
                        {[...Array(4)].map((_, i) => {
                          const angle = ((i + 1) * (Math.PI / 5)) - (Math.PI / 2);
                          const velocityX = Math.cos(angle) * (6 + Math.random() * 12);
                          const velocityY = Math.sin(angle) * (10 + Math.random() * 16);
                          return (
                            <motion.circle
                              key={`bead-${idx}-${i}`}
                              cx={splashX}
                              cy={surfaceY - 1}
                              r={0.8 + Math.random() * 1.2}
                              fill="#bae6fd"
                              opacity={0.85}
                              animate={{
                                x: [0, velocityX],
                                y: [0, velocityY],
                                opacity: [1, 0.8, 0]
                              }}
                              transition={{
                                duration: 0.35 + Math.random() * 0.15,
                                repeat: Infinity,
                                ease: "easeOut",
                                delay: i * 0.05 + idx * 0.03
                              }}
                            />
                          );
                        })}
                      </g>
                    ))}
                  </g>
                )}

                {/* Cement Dust Smoke Cloud/Particles inside Mixer */}
                {gateSemenHopperOpen && (
                  <g>
                    {/* Soft ambient swirling dust plumes using our custom dust-blur filter */}
                    <motion.ellipse
                      cx="635"
                      cy="385"
                      rx="40"
                      ry="28"
                      fill="#9cb4c2"
                      filter="url(#dust-blur)"
                      opacity={0.35}
                      animate={{
                        scale: [1, 1.2, 0.95],
                        x: [-10, 15, -10],
                        y: [-5, 5, -5],
                        rotate: [0, 8, -6, 0]
                      }}
                      transition={{
                        duration: 3.5,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                    <motion.ellipse
                      cx="715"
                      cy="390"
                      rx="45"
                      ry="32"
                      fill="#819ba8"
                      filter="url(#dust-blur)"
                      opacity={0.3}
                      animate={{
                        scale: [1.1, 0.9, 1.15],
                        x: [10, -12, 10],
                        y: [4, -6, 4],
                        rotate: [15, -10, 15]
                      }}
                      transition={{
                        duration: 4.2,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 0.5
                      }}
                    />
                    <motion.ellipse
                      cx="675"
                      cy="375"
                      rx="55"
                      ry="32"
                      fill="#a5bcc9"
                      filter="url(#dust-blur)"
                      opacity={0.25}
                      animate={{
                        scale: [0.95, 1.1, 0.95],
                        x: [-6, 8, -6],
                        y: [6, -4, 6]
                      }}
                      transition={{
                        duration: 2.8,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 0.9
                      }}
                    />

                    {/* Falling fine cement powder streams and speckles falling onto the mixture */}
                    {[...Array(14)].map((_, i) => {
                      const xPos = 600 + (i * 12.5); // Spaced across the mixer top
                      const delay = (i % 4) * 0.12;
                      const speed = 0.5 + (i % 3) * 0.15;
                      return (
                        <g key={`cement-stream-${i}`}>
                          {/* Falling stream thread */}
                          <motion.line
                            x1={xPos}
                            y1={352}
                            x2={xPos}
                            y2={surfaceY}
                            stroke="#8ea4b0"
                            strokeWidth="1.2"
                            strokeDasharray="4 8"
                            opacity={0.55}
                            animate={{
                              strokeDashoffset: [0, -20]
                            }}
                            transition={{
                              duration: speed,
                              repeat: Infinity,
                              ease: "linear",
                              delay: delay
                            }}
                          />
                          {/* Drifting powder speckle */}
                          <motion.circle
                            cx={xPos + Math.sin(i) * 3}
                            cy={352}
                            r={0.8 + (i % 2) * 0.5}
                            fill="#cbd5e1"
                            opacity={0.7}
                            animate={{
                              cy: [352, surfaceY],
                              x: [xPos + Math.sin(i) * 3, xPos + (Math.sin(i) * 3) + (Math.cos(i) * 8)],
                              opacity: [0.8, 0.9, 0]
                            }}
                            transition={{
                              duration: speed * 1.5,
                              repeat: Infinity,
                              ease: "easeIn",
                              delay: delay
                            }}
                          />
                        </g>
                      );
                    })}
                  </g>
                )}

                {visualConcreteHeight > 0 && (
                  <>
                    {/* Continuous Volumetric Concrete Mass (Satisfies 3.5 m³ Scale Level) */}
                    <g transform={`translate(579.5, ${surfaceY})`}>
                      {/* Background wave - deep shadow concrete slurry */}
                      <motion.path
                        d="M -100,0 Q -75,-6 -50,0 Q -25,6 0,0 Q 25,-6 50,0 Q 75,6 100,0 Q 125,-6 150,0 Q 175,6 200,0 Q 225,-6 250,0 Q 275,6 300,0 L 300,200 L -100,200 Z"
                        fill="url(#concrete-bg-gradient)"
                        animate={isMixerRotating ? {
                          x: [-40, 40],
                          y: [-3, 3]
                        } : { x: 0, y: 0 }}
                        transition={isMixerRotating ? {
                          x: { repeat: Infinity, repeatType: "mirror", duration: 1.8, ease: "linear" },
                          y: { repeat: Infinity, repeatType: "mirror", duration: 0.9, ease: "easeInOut" }
                        } : undefined}
                      />

                      {/* Foreground wave - primary rich wet concrete mass */}
                      <motion.path
                        d="M -100,0 Q -75,6 -50,0 Q -25,-6 0,0 Q 25,6 50,0 Q 75,-6 100,0 Q 125,6 150,0 Q 175,-6 200,0 Q 225,6 250,0 Q 275,-6 300,0 L 300,200 L -100,200 Z"
                        fill="url(#concrete-gradient)"
                        animate={isMixerRotating ? {
                          x: [30, -30],
                          y: [3, -3]
                        } : { x: 0, y: 0 }}
                        transition={isMixerRotating ? {
                          x: { repeat: Infinity, repeatType: "mirror", duration: 1.4, ease: "linear" },
                          y: { repeat: Infinity, repeatType: "mirror", duration: 0.7, ease: "easeInOut" }
                        } : undefined}
                      />
                    </g>

                    {/* Industrial heavy slurry details & bubbles in the main mix */}
                    {isMixerRotating && (
                      <g opacity="0.65">
                        <motion.circle cx="605" cy={surfaceY + 16} r="2.5" fill="#303541" animate={{ y: [0, -6, 0], x: [0, 3, 0] }} transition={{ repeat: Infinity, duration: 1.6 }} />
                        <motion.circle cx="635" cy={surfaceY + 10} r="1.8" fill="#505868" animate={{ y: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.9 }} />
                        <motion.circle cx="675" cy={surfaceY + 22} r="3.0" fill="#292e3a" animate={{ y: [0, -8, 0], x: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 2.2 }} />
                        <motion.circle cx="705" cy={surfaceY + 14} r="2.0" fill="#464e5d" animate={{ y: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.4 }} />
                        <motion.circle cx="745" cy={surfaceY + 18} r="2.8" fill="#323846" animate={{ y: [0, -4, 0], x: [0, 3, 0] }} transition={{ repeat: Infinity, duration: 1.8 }} />
                      </g>
                    )}
                  </>
                )}
              </g>
            );
          })()}

          {/* Real-time Mixer Volume Digital HMI Segment Label */}
          <g transform="translate(677.5, 368)">
            <rect x="-48" y="-10" width="96" height="15" rx="3.5" fill="rgba(6, 11, 23, 0.85)" stroke="rgba(0, 229, 255, 0.45)" strokeWidth="0.85" />
            <text textAnchor="middle" y="0" fill="#00ffd0" className="font-mono text-[7.5px] font-bold">
              {currentMixerVolume.toFixed(2)} m³ / {mixerMaxMixing.toFixed(1)} m³
            </text>
            <text textAnchor="middle" y="8" fill="#8892b0" className="font-sans text-[5.5px] font-bold tracking-wide">
              MIXER FILL LEVEL: {Math.round(mixerFillPercent)}%
            </text>
          </g>
          
          {/* Twin Shaft Animation */}
          <g id="twin-shafts" opacity={isMixerRotating ? 1 : 0.3}>
            {/* Left Shaft */}
            <g transform="translate(637.5, 400)">
              <circle r="44" fill="none" stroke="rgba(0, 229, 255, 0.15)" strokeWidth="1" />
              <g className={isMixerRotating ? "spin-ccw-active" : ""}>
                <line x1="-41" y1="0" x2="41" y2="0" stroke="#00e5ff" strokeWidth="3.5" opacity="0.85" />
                <line x1="0" y1="-41" x2="0" y2="41" stroke="#00e5ff" strokeWidth="3.5" opacity="0.85" />
                {/* Paddle Profiles */}
                <rect x="-44" y="-3.5" width="7" height="7" fill="#00e5ff" rx="1.5" />
                <rect x="37" y="-3.5" width="7" height="7" fill="#00e5ff" rx="1.5" />
                <rect x="-3.5" y="-44" width="7" height="7" fill="#00e5ff" rx="1.5" />
                <rect x="-3.5" y="37" width="7" height="7" fill="#00e5ff" rx="1.5" />
                <circle r="7" fill="#334155" stroke="#00e5ff" strokeWidth="1" />
              </g>
            </g>
            {/* Right Shaft */}
            <g transform="translate(717.5, 400)">
              <circle r="44" fill="none" stroke="rgba(0, 229, 255, 0.15)" strokeWidth="1" />
              {/* Offset right shaft by 45 degrees so the elongated blades intermesh realistically rather than colliding */}
              <g transform="rotate(45)">
                <g className={isMixerRotating ? "spin-cw-active" : ""}>
                  <line x1="-41" y1="0" x2="41" y2="0" stroke="#00e5ff" strokeWidth="3.5" opacity="0.85" />
                  <line x1="0" y1="-41" x2="0" y2="41" stroke="#00e5ff" strokeWidth="3.5" opacity="0.85" />
                  {/* Paddle Profiles */}
                  <rect x="-44" y="-3.5" width="7" height="7" fill="#00e5ff" rx="1.5" />
                  <rect x="37" y="-3.5" width="7" height="7" fill="#00e5ff" rx="1.5" />
                  <rect x="-3.5" y="-44" width="7" height="7" fill="#00e5ff" rx="1.5" />
                  <rect x="-3.5" y="37" width="7" height="7" fill="#00e5ff" rx="1.5" />
                  <circle r="7" fill="#334155" stroke="#00e5ff" strokeWidth="1" />
                </g>
              </g>
            </g>
          </g>

          {/* Active Concrete Churning Splashes & Slurry Overlay (Rendered ON TOP of shafts to immerse them) */}
          {(() => {
            if (!hasMaterial) return null;

            return (
              <g clipPath="url(#mixer-clip)">
                {/* Wet cement slurry splashing drops popping off the surface during rotation */}
                {isMixerRotating && [...Array(12)].map((_, idx) => {
                  const splashX = 590 + idx * 16 + (idx % 2 === 0 ? 3 : -3);
                  return (
                    <motion.circle
                      key={`surf-spl-${idx}`}
                      cx={splashX}
                      cy={surfaceY}
                      r={1.2 + (idx % 3) * 0.6}
                      fill="#7a8292" // cohesive slate wet slurry color
                      opacity="0.8"
                      animate={{
                        y: [0, -12 - (idx % 4) * 4, 0],
                        x: [0, (idx % 2 === 0 ? 6 : -6), 0],
                        scale: [1, 1.2, 0.4]
                      }}
                      transition={{
                        duration: 0.55 + (idx % 3) * 0.12,
                        repeat: Infinity,
                        delay: idx * 0.05,
                        ease: "easeOut"
                      }}
                    />
                  );
                })}

                {/* Churning aggregates strictly submerged within the Concrete Body Mass */}
                <g clipPath="url(#concrete-level-clip)">
                  {/* Rotating Gravel/Stone Aggregate Chunks in the Left Churn (CCW orbit) */}
                  {isMixerRotating && [...Array(6)].map((_, idx) => {
                    const angleStart = (idx * (360 / 6)) + (idx * 15);
                    const radius = 15 + (idx % 3) * 11;
                    const size = 1.0 + (idx % 2) * 1.0; // Subtle texture dots
                    const fillCol = idx % 3 === 0 ? "#4a4f5c" : idx % 3 === 1 ? "#736b5e" : "#5a6270"; // blended cement stones
                    return (
                      <motion.circle
                        key={`l-churn-${idx}`}
                        cx={637.5}
                        cy={400}
                        r={size}
                        fill={fillCol}
                        opacity="0.55"
                        animate={{
                          cx: [
                            637.5 + Math.cos((angleStart * Math.PI) / 180) * radius,
                            637.5 + Math.cos(((angleStart - 360) * Math.PI) / 180) * radius
                          ],
                          cy: [
                            400 + Math.sin((angleStart * Math.PI) / 180) * radius * 0.75,
                            400 + Math.sin(((angleStart - 360) * Math.PI) / 180) * radius * 0.75
                          ]
                        }}
                        transition={{
                          duration: 1.4 + (idx % 3) * 0.3,
                          repeat: Infinity,
                          ease: "linear"
                        }}
                      />
                    );
                  })}

                  {/* Rotating Gravel/Stone Aggregate Chunks in the Right Churn (CW orbit) */}
                  {isMixerRotating && [...Array(6)].map((_, idx) => {
                    const angleStart = (idx * (360 / 6)) + (idx * 21);
                    const radius = 15 + (idx % 3) * 11;
                    const size = 1.0 + (idx % 2) * 1.0; // Subtle texture dots
                    const fillCol = idx % 3 === 0 ? "#4a4f5c" : idx % 3 === 1 ? "#736b5e" : "#5a6270";
                    return (
                      <motion.circle
                        key={`r-churn-${idx}`}
                        cx={717.5}
                        cy={400}
                        r={size}
                        fill={fillCol}
                        opacity="0.55"
                        animate={{
                          cx: [
                            717.5 + Math.cos((angleStart * Math.PI) / 180) * radius,
                            717.5 + Math.cos(((angleStart + 360) * Math.PI) / 180) * radius
                          ],
                          cy: [
                            400 + Math.sin((angleStart * Math.PI) / 180) * radius * 0.75,
                            400 + Math.sin(((angleStart + 360) * Math.PI) / 180) * radius * 0.75
                          ]
                        }}
                        transition={{
                          duration: 1.4 + (idx % 3) * 0.3,
                          repeat: Infinity,
                          ease: "linear"
                        }}
                      />
                    );
                  })}
                </g>
              </g>
            );
          })()}

          {/* Gear/Motor on side - Updated with rotating dynamo/motor cooling fan */}
          <g transform="translate(562.5, 400)">
            {/* Outer stator housing */}
            <circle cx="0" cy="0" r="15" fill="#181d26" stroke={theme.outline} strokeWidth="1.5" />
            {/* Vent slots inside the motor cover */}
            <circle cx="0" cy="0" r="11.5" fill="none" stroke="#2c3e50" strokeWidth="1.2" strokeDasharray="3 3.5" />
            
            {/* Spinning cooling fan blades */}
            <g className={isMixerRotating ? "spin-cw-active" : ""}>
              {[...Array(5)].map((_, i) => {
                const angle = (i * 360) / 5;
                return (
                  <path
                    key={`motor-fan-blade shadow-${i}`}
                    d="M 0 0 Q -2.5 -4.5 -3.5 -10 A 10 10 0 0 1 3.5 -10 Q 2.5 -4.5 0 0"
                    fill="#38bdf8"
                    opacity="0.85"
                    transform={`rotate(${angle})`}
                  />
                );
              })}
            </g>
            {/* Central hub / axle shaft status circle */}
            <circle cx="0" cy="0" r="3.5" fill={isMixerRotating ? theme.flow : "#475569"} stroke={isMixerRotating ? "#fff" : "none"} strokeWidth="0.5" />
          </g>

          {/* Industrial Discharge Chute under Mixer */}
          <g 
            id="discharge-chute" 
            transform="translate(677.5, 450)"
            className={!isAuto ? "cursor-pointer select-none" : ""}
            {...getDeviceHandlers('mixerDischargeGate')}
          >
            {/* Chute funnel outline */}
            <polygon 
              points="-25,0 25,0 15,38 -15,38" 
              fill="#181d26" 
              stroke={theme.outline} 
              strokeWidth="1.5" 
            />
            
            {/* Real sliding discharge gate slider (proportional to doors opened readout) */}
            <rect x="-20" y="-3" width="40" height="4" fill="#344158" />
            
            {/* The Slider blade opens from -20 to +20 according to opening ratio */}
            <motion.rect 
              x={-20 + (mixerDoorPercent / 100) * 35} 
              y="-3" 
              width="40" 
              height="4" 
              fill={mixerDoorPercent > 0 ? theme.flow : theme.red}
              stroke="#000"
              strokeWidth="0.5"
            />

            {/* Readout representing door openings */}
            <text x="0" y="24" textAnchor="middle" fill="#7dd3fc" fontSize="5.5" fontWeight="bold">
              {mixerDoorPercent > 0 ? `DOOR: ${mixerDoorPercent}%` : "DOOR: CLOSED"}
            </text>

            {/* Phased Concrete Stream Flow Animation */}
            {concreteDischargeActive && mixerDoorPercent > 0 && (
              <g>
                {/* Core grey fluid stream. Width reacts to opening percentage! */}
                <motion.rect
                  x={-((mixerDoorPercent / 100) * 7.5)} 
                  y="1" 
                  width={(mixerDoorPercent / 100) * 15} 
                  height="82"
                  fill="#64748b" 
                  opacity="0.85"
                  className="blur-[0.5px]"
                  animate={{ opacity: [0.75, 0.95, 0.75] }}
                  transition={{ duration: 0.25, repeat: Infinity }}
                />
                
                {/* Semen stream lines scaling with door opening */}
                {[...Array(4)].map((_, idx) => (
                  <motion.line
                     key={idx}
                     x1={-6 + (idx * 4)} 
                     y1={1} 
                     x2={-6 + (idx * 4)} 
                     y2={82}
                     stroke="#a1a1aa" 
                     strokeWidth={0.8 + (mixerDoorPercent / 100) * 1.0}
                     strokeDasharray="4 4"
                     animate={{ strokeDashoffset: [0, -12] }}
                     transition={{ duration: 0.2, repeat: Infinity, ease: "linear", delay: idx * 0.05 }}
                  />
                ))}

                {/* Splashes at the outlet input of truck mixer */}
                <g transform="translate(0, 82)">
                  {[...Array(5)].map((_, idx) => (
                    <motion.circle
                      key={idx}
                      cx={-5 + idx * 2.5 + Math.sin(idx) * 1.5}
                      cy={2}
                      r="1.2"
                      fill="#71717a"
                      animate={{ cy: [2, 8], cx: [-5 + idx * 2.5, -8 + idx * 4], opacity: [1, 0] }}
                      transition={{ duration: 0.25, repeat: Infinity, delay: idx * 0.04, ease: "easeOut" }}
                    />
                  ))}
                </g>
              </g>
            )}

            {/* Concrete Output indicators */}
            <circle cy="38" r="3" fill={concreteDischargeActive ? theme.flow : theme.red} />
          </g>
        </g>

        {/* Mixer Truck */}
        <g 
          id="truck" 
          transform="translate(660, 495) scale(0.68)" 
          onClick={onTruckClick}
          className="cursor-pointer"
        >
          <image 
            href={truckImage || "./truck.png"} 
            x="-12.5" 
            y="-10" 
            width="245" 
            height="155" 
            preserveAspectRatio="xMidYMid meet"
          />
        </g>

        {/* Deleted AMPERE MIXER as requested by user */}

        {/* INDUSTRIAL MIXING TIMER (Moved to right of Mixer as requested) */}
        {(() => {
          const isDischargingSec = !!concreteDischargeActive;

          // Dynamic calculation of discharge door sequencer time based on target volume settings
          const targetVol = volumePerBatch || activeVolume || 3.5;
          const relayConfig = loadRelayConfig();
          let selectedRelayId = 14;
          if (targetVol > 1.5 && targetVol <= 2.5) {
            selectedRelayId = 28;
          } else if (targetVol > 2.5) {
            selectedRelayId = 29;
          }
          const row14 = relayConfig.find(r => r.relay === selectedRelayId) || relayConfig.find(r => r.relay === 14);

          const open1Raw = row14 ? parseFloat(row14.timer1) : 2000;
          const pause1Raw = row14 ? parseFloat(row14.timer2) : 6000;
          const open2Raw = row14 ? parseFloat(row14.timer3) : 3000;
          const pause2Raw = row14 ? parseFloat(row14.timer4) : 5000;
          const open3Raw = row14 ? parseFloat(row14.timer5) : 3000;
          const pause3Raw = row14 ? parseFloat(row14.timer6) : 11000;

          // limit7 = open1Raw + pause1Raw + open2Raw + pause2Raw + open3Raw + pause3Raw + 5000 ms (including door closing phase)
          const totalDischargeMs = open1Raw + pause1Raw + open2Raw + pause2Raw + open3Raw + pause3Raw + 5000;
          const maxDoorTime = Math.max(1, totalDischargeMs / 1000);

          return (
            <>
              <foreignObject x="795" y="325" width="160" height="240">
              <div className="w-full h-full bg-transparent p-2 flex flex-col justify-start gap-1 items-center relative">
                {/* Header */}
                <div className="w-full flex justify-center items-center pb-1 select-none">
                  <span className={`text-[12.5px] font-sans font-bold tracking-wider uppercase flex items-center gap-1.5 ${(productionState === 'COMPLETE' || isDone) ? 'text-emerald-400' : isDischargingSec ? 'text-red-500' : 'text-[#00ffd0]'}`}>
                    <span className={`w-2 h-2 rounded-full ${(productionState === 'COMPLETE' || isDone) ? 'bg-emerald-400' : isDischargingSec ? 'bg-red-500' : isMixerRotating ? 'bg-cyan-400' : isPaused ? 'bg-orange-400' : 'bg-slate-600'}`} />
                    {(productionState === 'COMPLETE' || isDone) ? 'COMPLETE' : isDischargingSec ? 'DISCHARGE' : 'WAKTU MIXING'}
                  </span>
                </div>

                {/* Custom Circular SVG Dial Indicator */}
                <div className="flex-1 w-full flex items-center justify-center relative my-1">
                  <svg className="w-[105px] h-[105px]" viewBox="0 0 110 110">
                    <defs>
                      <radialGradient id="dialBg" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#0a1224" />
                        <stop offset="75%" stopColor="#040812" />
                        <stop offset="100%" stopColor="#010308" />
                      </radialGradient>
                      <filter id="cyanGlow">
                        <feGaussianBlur stdDeviation="2.5" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                      <filter id="redGlow">
                        <feGaussianBlur stdDeviation="2.5" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </defs>

                    {/* Outer Ring: Thick navy grey */}
                    <circle cx="55" cy="55" r="50" fill="url(#dialBg)" stroke="#131d31" strokeWidth="6" />
                    
                    {/* Inner Circle: Grey-light / metalloid border represent "Inner circle abu terang" */}
                    <circle cx="55" cy="55" r="46" fill="none" stroke="#94a3b8" strokeWidth="1.2" opacity="0.85" />
                    
                    {/* Tick marks around the circle (24 marks) */}
                    {Array.from({ length: 24 }).map((_, idx) => {
                      const angle = (idx * 360) / 24 - 90;
                      const rad = (angle * Math.PI) / 180;
                      const isMajor = idx % 6 === 0;
                      const len = isMajor ? 4.5 : 2.5;
                      const x1 = 55 + Math.cos(rad) * (43 - len);
                      const y1 = 55 + Math.sin(rad) * (43 - len);
                      const x2 = 55 + Math.cos(rad) * 43;
                      const y2 = 55 + Math.sin(rad) * 43;
                      return (
                        <line
                          key={idx}
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke={isMajor ? (isDischargingSec ? "#ef4444" : "#00ffd0") : "#475569"}
                          strokeWidth={isMajor ? "1.5" : "0.7"}
                          opacity="0.85"
                        />
                      );
                    })}

                    {/* Radial Progress Ring (Cyan for Mixing / Red for Discharging) */}
                    {(() => {
                      const r = 38;
                      const C = 2 * Math.PI * r; // ~238.76
                      
                      if (isDischargingSec) {
                        const dTimeRemaining = Math.max(0, maxDoorTime - dischargeTimeSec);
                        const pct = Math.min(1, Math.max(0, dTimeRemaining / maxDoorTime));
                        const offset = C - (pct * C);
                        
                        return (
                          <circle
                            cx="55"
                            cy="55"
                            r={r}
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeDasharray={C}
                            strokeDashoffset={offset}
                            filter="url(#redGlow)"
                            transform="rotate(-90 55 55)"
                            className="transition-all duration-300 ease-out"
                          />
                        );
                      } else {
                        const maxTime = activeMixingTime || 1;
                        const curTime = (productionState === 'COMPLETE' || isDone) ? 0 : (mixerState === 'mixing' ? mixingCountdown : activeMixingTime);
                        const pct = Math.min(1, Math.max(0, curTime / maxTime));
                        const offset = C - (pct * C);
                        
                        return (
                          <circle
                            cx="55"
                            cy="55"
                            r={r}
                            fill="none"
                            stroke={(productionState === 'COMPLETE' || isDone) ? "#00ff9c" : "#00f0ff"}
                            strokeWidth="3.5"
                            strokeLinecap="round"
                            strokeDasharray={C}
                            strokeDashoffset={offset}
                            filter={(productionState === 'COMPLETE' || isDone) ? "url(#cyanGlow)" : "url(#cyanGlow)"}
                            transform="rotate(-90 55 55)"
                            className="transition-all duration-300 ease-out"
                          />
                        );
                      }
                    })()}

                    {/* Centered large countdown numbers */}
                    <text 
                      x="55" 
                      y="55" 
                      textAnchor="middle" 
                      dominantBaseline="middle"
                      fill={(productionState === 'COMPLETE' || isDone) ? "#00ff9c" : isDischargingSec ? "#ef4444" : "#00e5ff"} 
                      fontSize="34" 
                      fontWeight="950" 
                      fontFamily="monospace"
                      filter={(productionState === 'COMPLETE' || isDone) ? "url(#cyanGlow)" : isDischargingSec ? "url(#redGlow)" : "url(#cyanGlow)"}
                      className=""
                    >
                      {isDischargingSec ? (
                        Math.max(0, Math.ceil(maxDoorTime - dischargeTimeSec))
                      ) : (productionState === 'COMPLETE' || isDone) ? (
                        0
                      ) : (
                        mixerState === 'mixing' ? mixingCountdown : activeMixingTime
                      )}
                    </text>


                  </svg>
                </div>

                {/* Batch Info Segment */}
                <div className="w-full flex flex-col justify-center items-center select-none bg-transparent py-1.5 px-1 leading-normal text-center space-y-1">
                  <span className="text-[11px] font-mono font-black text-amber-400 tracking-wide uppercase">
                    Target Mix {activeVolume || 0} m³
                  </span>
                  <span className="text-[11px] font-mono font-extrabold text-[#00ff9c] tracking-wide uppercase">
                    MIX {productionState === 'COMPLETE' ? targetBatch : Math.min(targetBatch, isRunning ? (currentBatch + 1) : currentBatch)} DARI {targetBatch || 1}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-400 tracking-wide uppercase">
                    STATUS : <span className={productionState === 'COMPLETE' ? "text-[#00ff9c]" : isRunning ? "text-cyan-400 animate-pulse font-extrabold" : "text-slate-500"}>
                      {productionState === 'COMPLETE' ? 'COMPLETE' : productionState}
                    </span>
                  </span>
                </div>
              </div>
            </foreignObject>

            {/* Red box cards for AMPER MIXER and ESTIMASI SLUMP as requested */}
            <foreignObject x="962" y="325" width="115" height="240">
              <div className="w-full h-full flex flex-col justify-between gap-3 text-white select-none">
                {/* Upper Box: Amper Mixer */}
                <div className="flex-1 bg-[#05080c]/90 rounded-md border-2 border-red-500/90 p-2 flex flex-col justify-between items-center shadow-[0_0_12px_rgba(239,68,68,0.3)]">
                  <div className="text-[10.5px] font-sans font-black tracking-widest text-red-500 uppercase text-center w-full border-b-2 border-red-950/60 pb-1 leading-tight">
                    AMPER MIXER
                  </div>
                  <div className="flex-1 flex flex-col justify-center items-center">
                    <span className="text-[30px] font-mono font-black text-red-500 tracking-tighter leading-none filter drop-shadow-[0_0_4px_rgba(239,68,68,0.5)]">
                      {ampere !== null && ampere > 0 ? ampere.toFixed(1) : "0.0"}
                    </span>
                    <span className="text-[9px] font-sans font-extrabold text-slate-500 mt-1 uppercase tracking-wider">
                      AMPERE (A)
                    </span>
                  </div>
                </div>

                {/* Lower Box: Estimasi Slump */}
                <div className="flex-1 bg-[#05080c]/90 rounded-md border-2 border-red-500/90 p-2 flex flex-col justify-between items-center shadow-[0_0_12px_rgba(239,68,68,0.3)]">
                  <div className="text-[10.5px] font-sans font-black tracking-widest text-red-500 uppercase text-center w-full border-b-2 border-red-950/60 pb-1 leading-tight">
                    ESTIMASI SLUMP
                  </div>
                  <div className="flex-1 flex flex-col justify-center items-center">
                    <span className="text-[30px] font-mono font-black text-red-500 tracking-tighter leading-none filter drop-shadow-[0_0_4px_rgba(239,68,68,0.5)]">
                      {slump !== null && slump > 0 ? slump.toFixed(1) : "0.0"}
                    </span>
                    <span className="text-[9px] font-sans font-extrabold text-slate-500 mt-1 uppercase tracking-wider">
                      CENTIMETER (CM)
                    </span>
                  </div>
                </div>
              </div>
            </foreignObject>
          </>
          );
        })()}



        {/* PLC Control panel removed from SVG view and rendered as clean native components underneath */}      </svg>

      {/* Manual Auxiliary Panel for Compressor, Vibrator, Klakson */}
      {!isAuto && (
        <div className="absolute top-3 left-3 bg-[#0a0f1d]/90 backdrop-blur border border-slate-700/60 p-2 rounded flex flex-col gap-2 shadow-lg select-none z-10 w-44">
          <div className="text-[10px] font-bold text-cyan-400 tracking-wider border-b border-slate-700/50 pb-1 flex items-center justify-between font-mono">
            <span>AUXILIARY HMI</span>
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
          </div>
          
          {/* Compressor Button */}
          <button 
            type="button"
            className={`flex items-center justify-between p-1.5 rounded text-xs font-semibold cursor-pointer select-none transition-colors duration-150 ${
              compressorActive 
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/55 font-bold' 
                : 'bg-slate-800/40 text-slate-400 border border-slate-700/40 hover:bg-slate-800/80 font-medium'
            }`}
            {...getDeviceHandlers('compressor')}
          >
            <span className="font-mono text-[10px]">KOMPRESOR</span>
            <span className={`w-2 h-2 rounded-full ${compressorActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
          </button>

          {/* Vibrator Button */}
          <button 
            type="button"
            className={`flex items-center justify-between p-1.5 rounded text-xs font-semibold cursor-pointer select-none transition-colors duration-150 ${
              vibratorActive 
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/55 font-bold' 
                : 'bg-slate-800/40 text-slate-400 border border-slate-700/40 hover:bg-slate-800/80 font-medium'
            }`}
            {...getDeviceHandlers('vibrator')}
          >
            <span className="font-mono text-[10px]">VIBRATOR</span>
            <span className={`w-2 h-2 rounded-full ${vibratorActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
          </button>

          {/* Klakson Button */}
          <button 
            type="button"
            className={`flex items-center justify-between p-1.5 rounded text-xs font-semibold cursor-pointer select-none transition-colors duration-150 ${
              getDeviceStatus('klakson')
                ? 'bg-amber-600/20 text-amber-400 border border-amber-500/55 font-bold' 
                : 'bg-slate-800/40 text-slate-400 border border-slate-700/40 hover:bg-slate-800/80 font-medium'
            }`}
            {...getDeviceHandlers('klakson')}
          >
            <span className="font-mono text-[10px]">KLAKSON</span>
            <span className={`w-2 h-2 rounded-full ${getDeviceStatus('klakson') ? 'bg-amber-500 animate-pulse' : 'bg-slate-600'}`} />
          </button>
        </div>
      )}

      {/* Modern Dynamic Pop-up Control card for Manual Operation */}
      {selectedManualDevice && (
        <div 
          className="absolute bg-[#0b1329]/95 backdrop-blur-md border border-[#38bdf8]/60 p-3 rounded-lg shadow-2xl z-20 w-64 text-white font-sans select-none flex flex-col gap-2.5 animation-fade-in"
          style={{
            left: `${Math.min(90, Math.max(10, ((selectedManualDevice.x - 45) / 1085) * 100))}%`,
            top: `${Math.min(85, Math.max(20, ((selectedManualDevice.y + 30) / 640) * 100))}%`,
            transform: 'translate(-50%, -100%)',
            marginTop: '-12px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-700/55 pb-1.5">
            <span className="text-[10px] font-bold text-cyan-400 tracking-wider font-mono">
              {selectedManualDevice.name.toUpperCase()}
            </span>
            <button 
              type="button"
              className="text-slate-400 hover:text-white transition-colors duration-100 hover:bg-slate-800/60 w-5 h-5 rounded flex items-center justify-center font-bold text-xs cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedManualDevice(null);
              }}
            >
              ×
            </button>
          </div>

          {/* Real-time Status */}
          <div className="flex items-center justify-between text-xs py-0.5">
            <span className="text-slate-400">Status Alat:</span>
            <span className={`font-bold font-mono px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1.5 ${
              getDeviceStatus(selectedManualDevice.id)
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${getDeviceStatus(selectedManualDevice.id) ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              {getDeviceStatus(selectedManualDevice.id) ? 'ON / AKTIF' : 'OFF / MATI'}
            </span>
          </div>

          {/* Control Button */}
          <button
            type="button"
            className={`w-full py-2 px-3 rounded-md text-xs font-bold tracking-wider uppercase cursor-pointer select-none transition-all duration-150 border text-center ${
              getDeviceStatus(selectedManualDevice.id)
                ? 'bg-rose-600 hover:bg-rose-700 border-rose-500 text-white shadow-lg shadow-rose-950/40 active:scale-95'
                : 'bg-emerald-600 hover:bg-emerald-700 border-emerald-500 text-white shadow-lg shadow-emerald-950/40 active:scale-95'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              if (onManualDeviceToggle) {
                onManualDeviceToggle(selectedManualDevice.id);
              }
            }}
          >
            {getDeviceStatus(selectedManualDevice.id) ? 'MATIKAN / TUTUP' : 'HIDUPKAN / BUKA'}
          </button>
        </div>
      )}

      {/* Print toggle and Help buttons aligned to the right side of the SCADA panel */}
      <div className="absolute bottom-3.5 right-3.5 lg:right-[-230px] flex items-center gap-4 z-10 select-none">
        {/* Pressure Gauge Widget */}
        <div className="h-[46px] px-[17px] bg-[#0c111e]/95 border border-slate-800 rounded-[12px] flex items-center gap-3 shadow-md">
          {/* Round Analog Gauge SVG */}
          <svg className="w-[26px] h-[26px]" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="11" fill="url(#gaugeRim)" stroke="#334155" strokeWidth="0.8" />
            <circle cx="12" cy="12" r="8.5" fill="#090d16" />
            
            {/* Warning zones */}
            <path d="M 6 18 A 8.5 8.5 0 0 1 6 6" fill="none" stroke="#10b981" strokeWidth="0.8" />
            <path d="M 6 6 A 8.5 8.5 0 0 1 18 6" fill="none" stroke="#fbbf24" strokeWidth="0.8" />
            <path d="M 18 6 A 8.5 8.5 0 0 1 18 18" fill="none" stroke="#f43f5e" strokeWidth="0.8" />
            
            {/* Dynamic Needle */}
            {(() => {
              const compNeedleAngle = -120 + (Math.min(120, airPressure) / 120) * 240;
              const rad = (compNeedleAngle * Math.PI) / 180;
              const needleX = 12 + 7.5 * Math.sin(rad);
              const needleY = 12 - 7.5 * Math.cos(rad);
              return (
                <line 
                  x1="12" y1="12" 
                  x2={needleX} 
                  y2={needleY} 
                  stroke="#ff007f" 
                  strokeWidth="1" 
                  strokeLinecap="round" 
                />
              );
            })()}
            <circle cx="12" cy="12" r="1" fill="#00ffff" />
          </svg>
          
          <div className="flex flex-col justify-center leading-none text-left">
            <span className="text-[9px] font-mono text-slate-500 font-bold uppercase tracking-wider">KOMPRESSOR</span>
            <span 
              className={`text-[13.5px] font-mono font-black ${
                compressorActive ? "text-[#00ffd0] animate-pulse" : "text-slate-400"
              }`}
            >
              {airPressure.toFixed(1)} PSI
            </span>
          </div>
        </div>

        {/* Toggle Moisture Control Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onMoistureClick) {
              onMoistureClick();
            } else {
              setMoistureControl(!moistureControl);
            }
          }}
          className={`h-[46px] px-[17px] border-2 rounded-[12px] flex flex-col justify-center items-center gap-0 leading-tight transition-all duration-150 active:scale-95 cursor-pointer font-sans select-none shrink-0 text-center ${
            moistureControl 
              ? 'bg-[#0d9488] border-[#09544d] text-white shadow-[0_4px_12px_rgba(13,148,136,0.35)]' 
              : 'bg-[#122825]/90 border-[#1c3f3b] text-slate-400 hover:text-slate-200 hover:bg-[#152e2b]'
          }`}
        >
          <span className="text-[9.5px] tracking-wide uppercase font-black">MOISTURE</span>
          <span className="text-[9.5px] tracking-wide uppercase font-black">CONTROL</span>
        </button>

        {/* Quarry Aggregate Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onQuarryClick) {
              onQuarryClick();
            }
          }}
          className="h-[46px] px-[17px] bg-[#07665C] border-2 border-[#09544d] text-slate-100 hover:text-white hover:bg-[#0d9488] rounded-[12px] flex flex-col justify-center items-center gap-0 leading-tight transition-all duration-150 active:scale-95 cursor-pointer font-sans select-none shrink-0 text-center"
        >
          <span className="text-[9.5px] tracking-wide uppercase font-black">QUARRY</span>
          <span className="text-[9.5px] tracking-wide uppercase font-black">AGGREGATE</span>
        </button>

        {/* Toggle Print Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsPrint(!isPrint);
          }}
          className="h-[46px] px-[17px] bg-[#0b1329] border-2 border-[#2563eb] rounded-[12px] flex items-center gap-3 transition-all duration-150 active:scale-95 shadow-[0_4px_12px_rgba(37,99,235,0.15)] cursor-pointer text-white group shrink-0"
        >
          <div className={`w-[22px] h-[22px] rounded-[6px] flex items-center justify-center border-2 transition-all duration-150 ${isPrint ? 'bg-[#2563eb] border-[#2563eb]' : 'border-slate-600 bg-transparent group-hover:border-slate-500'}`}>
            {isPrint && <Check size={14} className="text-white stroke-[3.5px]" />}
          </div>
          <span className="text-[15px] font-sans font-black tracking-wide text-white leading-none">Print</span>
        </button>

        {/* Circular Help Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onHelpClick) onHelpClick();
          }}
          className="w-[46px] h-[46px] bg-[#2563eb] hover:bg-blue-600 border border-blue-500/35 rounded-full flex items-center justify-center transition-all duration-150 active:scale-95 shadow-[0_4px_12px_rgba(37,99,235,0.3)] cursor-pointer shrink-0"
        >
          <HelpCircle size={25} className="text-white stroke-[2.5px]" />
        </button>
      </div>
    </div>
  );
};

interface RelayLog {
  id: string;
  timestamp: Date;
  message: string;
  type: 'on' | 'off' | 'info' | 'done';
}

export default function App() {
  const [scaleCapacities, setScaleCapacities] = useState<{
    pasir: number;
    batu: number;
    semen: number;
    air: number;
    mixerGeometris: number;
    mixerMaxMixing: number;
  }>(() => {
    const saved = localStorage.getItem('scale_capacities_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.pasir === 'number') {
          return {
            pasir: parsed.pasir,
            batu: parsed.batu,
            semen: parsed.semen || 800,
            air: parsed.air || 400,
            mixerGeometris: typeof parsed.mixerGeometris === 'number' ? parsed.mixerGeometris : 4.0,
            mixerMaxMixing: typeof parsed.mixerMaxMixing === 'number' ? parsed.mixerMaxMixing : 3.5,
          };
        }
      } catch (e) {
        console.error("Gagal load scale capacities: ", e);
      }
    }
    return {
      pasir: 1000,
      batu: 1000,
      semen: 800,
      air: 400,
      mixerGeometris: 4.0,
      mixerMaxMixing: 3.5,
    };
  });

  useEffect(() => {
    localStorage.setItem('scale_capacities_config', JSON.stringify(scaleCapacities));
  }, [scaleCapacities]);

  const scaleCapacitiesAccumulative = scaleCapacities.pasir + scaleCapacities.batu;
  const scaleCapacitiesWaitingHopper = scaleCapacities.pasir + scaleCapacities.batu;

  const [scales, setScales] = useState(INITIAL_SCALES);
  const scalesRef = useRef(scales);
  scalesRef.current = scales;

  const setScalesSync = (updater: (prev: typeof INITIAL_SCALES) => typeof INITIAL_SCALES) => {
    const next = updater(scalesRef.current);
    
    // Capture peak scale data in manual / semi-auto mode to prevent 0 reading issues
    if (isRunningRef.current) {
      if (next.pasir.actual > manualPeakPasirRef.current) {
        manualPeakPasirRef.current = next.pasir.actual;
      }
      if (next.batu.actual > manualPeakBatuRef.current) {
        manualPeakBatuRef.current = next.batu.actual;
      }
      if (next.semen.actual > manualPeakSemenRef.current) {
        manualPeakSemenRef.current = next.semen.actual;
      }
      if (next.air.actual > manualPeakAirRef.current) {
        manualPeakAirRef.current = next.air.actual;
      }
    }

    scalesRef.current = next;
    setScales(next);
  };
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<MaterialType | 'idle' | 'mixing'>('idle');
  
  // Real-time offline local persistence of logs
  const [logs, setLogs] = useState<BatchLog[]>(() => {
    const saved = localStorage.getItem('hmi_batch_logs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((l: any) => ({
          ...l,
          timestamp: new Date(l.timestamp)
        }));
      } catch (e) {
        console.error("Gagal load logs dari localStorage: ", e);
      }
    }
    return [];
  });

  // Batch configuration states with LocalStorage persistence for complete offline desktop reliability
  const [siloWeights, setSiloWeights] = useState<number[]>(() => {
    const saved = localStorage.getItem('silo_weights');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 6) {
          return parsed.map(v => typeof v === 'number' ? v : 80000);
        }
      } catch (e) {
        console.error("Gagal load silo_weights:", e);
      }
    }
    return [42150, 35800, 28290, 31400, 19500, 48900];
  });

  useEffect(() => {
    localStorage.setItem('silo_weights', JSON.stringify(siloWeights));
  }, [siloWeights]);

  const [jumlahSilo, setJumlahSilo] = useState<number>(() => {
    const saved = localStorage.getItem('jumlah_silo');
    return saved ? parseInt(saved, 10) : 6;
  });

  useEffect(() => {
    localStorage.setItem('jumlah_silo', jumlahSilo.toString());
  }, [jumlahSilo]);

  const [isFillSiloOpen, setIsFillSiloOpen] = useState(false);
  const [selectedFillSiloIdx, setSelectedFillSiloIdx] = useState<number>(0);
  const [fillSiloAmountText, setFillSiloAmountText] = useState<string>("20000");
  const [customAlertMessage, setCustomAlertMessage] = useState<string | null>(null);
  const [isConfirmingResetSilo, setIsConfirmingResetSilo] = useState(false);

  const [isBatchConfigOpen, setIsBatchConfigOpen] = useState(false);
  const [activeVolume, setActiveVolume] = useState<number>(() => {
    const saved = localStorage.getItem('active_volume');
    return saved ? parseFloat(saved) : 1.0;
  });
  const [activeMixingCount, setActiveMixingCount] = useState<number>(() => {
    const saved = localStorage.getItem('active_mixing_count');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [activeSlump, setActiveSlump] = useState<string>(() => {
    return localStorage.getItem('active_slump') || "12 cm";
  });
  const [activeSiloSemen, setActiveSiloSemen] = useState<string>(() => {
    return localStorage.getItem('active_silo_semen') || "Silo 3 - 28.290 kg";
  });
  const [isDone, setIsDone] = useState(false);
  const [activeMixingTime, setActiveMixingTime] = useState<number>(() => {
    const saved = localStorage.getItem('active_mixing_time');
    return saved ? parseInt(saved, 10) : 10;
  });
  const [activePelanggan, setActivePelanggan] = useState<string>(() => {
    return localStorage.getItem('active_pelanggan') || "";
  });
  const [activeLokasi, setActiveLokasi] = useState<string>(() => {
    return localStorage.getItem('active_lokasi') || "";
  });
  const [activeNoKendaraan, setActiveNoKendaraan] = useState<string>(() => {
    return localStorage.getItem('active_no_kendaraan') || "";
  });
  const [activeSopir, setActiveSopir] = useState<string>(() => {
    return localStorage.getItem('active_sopir') || "";
  });

  // Sync queuing refs to avoid duplicate queueing in memory
  const queuedLogIdsRef = useRef<Set<string>>(new Set());
  const queuedRelayIdsRef = useRef<Set<string>>(new Set());

  // Auto-save configs to LocalStorage for complete offline desktop integration
  useEffect(() => {
    const currentPlantId = localStorage.getItem('plant_id') || 'PKU01';
    const currentPlantName = localStorage.getItem('plant_name') || 'Pekanbaru';
    const currentPlantCompany = localStorage.getItem('plant_company') || 'PT Farika Riau Perkasa';

    const logsWithPlant = logs.map(item => ({
      ...item,
      plantId: currentPlantId,
      plantName: currentPlantName,
      plantCompany: currentPlantCompany
    }));

    localStorage.setItem('hmi_batch_logs', JSON.stringify(logsWithPlant));

    // Sync to .NET backend SQLite database
    dotNetBackendService.migrateLegacyData('batches', logsWithPlant.map(item => ({
      id: item.id,
      batchNumber: item.id,
      plantId: item.plantId || "FARIKA-PLANT-01",
      plantName: item.plantName || "Batching Plant Farika Riau",
      plantCompany: item.plantCompany || "PT FARIKA RIAU PERKASA",
      recipeName: item.recipeName || "Beton Mutu",
      orderedVolume: item.volume || 1,
      actualPasir1: item.actuals?.pasir1 || 0,
      actualPasir2: item.actuals?.pasir2 || 0,
      actualBatu1: item.actuals?.batu1 || 0,
      actualBatu2: item.actuals?.batu2 || 0,
      actualSemen: item.actuals?.semen || 0,
      actualAir: item.actuals?.air || 0,
      targetPasir1: item.targets?.pasir1 || 0,
      targetPasir2: item.targets?.pasir2 || 0,
      targetBatu1: item.targets?.batu1 || 0,
      targetBatu2: item.targets?.batu2 || 0,
      targetSemen: item.targets?.semen || 0,
      targetAir: item.targets?.air || 0,
      pelanggan: item.pelanggan || "",
      lokasi: item.lokasi || "",
      noKendaraan: item.noKendaraan || "",
      sopir: item.sopir || "",
      operatorName: (item as any).operator || "OPERATOR",
      startTime: item.startTime ? new Date(item.startTime) : new Date(item.timestamp),
      endTime: item.endTime ? new Date(item.endTime) : new Date()
    }))).catch(() => {});

    // Automated Cloud Queueing Layer
    logsWithPlant.forEach(item => {
      if (item.id && !queuedLogIdsRef.current.has(item.id)) {
        queuedLogIdsRef.current.add(item.id);
        queueForCloudSync("production", item);
      }
    });
  }, [logs]);

  useEffect(() => {
    localStorage.setItem('active_volume', activeVolume.toString());
    localStorage.setItem('active_mixing_count', activeMixingCount.toString());
    localStorage.setItem('active_slump', activeSlump);
    localStorage.setItem('active_silo_semen', activeSiloSemen);
    localStorage.setItem('active_mixing_time', activeMixingTime.toString());
    localStorage.setItem('active_pelanggan', activePelanggan);
    localStorage.setItem('active_lokasi', activeLokasi);
    localStorage.setItem('active_no_kendaraan', activeNoKendaraan);
    localStorage.setItem('active_sopir', activeSopir);
  }, [
    activeVolume,
    activeMixingCount,
    activeSlump,
    activeSiloSemen,
    activeMixingTime,
    activePelanggan,
    activeLokasi,
    activeNoKendaraan,
    activeSopir
  ]);

  // --- SCADA HIGH-REALISM SEQUENCING STATE ENGINE ---
  const [productionState, setProductionState] = useState<'IDLE' | 'STARTING' | 'WEIGHING' | 'READY' | 'WAITING_DISCHARGE' | 'DISCHARGING' | 'MIXING' | 'MIX_COMPLETE' | 'WAITING_EMPTY' | 'NEXT_BATCH' | 'FINISHED' | 'ERROR' | 'COMPLETE'>('IDLE');
  const [batchQueue, setBatchQueue] = useState<any[]>([]);
  const [mixerOccupied, setMixerOccupied] = useState<boolean>(false);
  const [currentCycle, setCurrentCycle] = useState<number>(0);
  const [totalCycles, setTotalCycles] = useState<number>(0);
  const [volumePerCycle, setVolumePerCycle] = useState<number>(0);
  const [currentBatch, setCurrentBatch] = useState<number>(0);
  const [targetBatch, setTargetBatch] = useState<number>(0);
  const [volumePerBatch, setVolumePerBatch] = useState<number>(0);
  const volumePerBatchRef = useRef<number>(0);
  
  // Weighing controller states
  const [weighingCycle, setWeighingCycle] = useState<number>(0);
  const [isWeighingActive, setIsWeighingActive] = useState(false);
  
  // Solenoid / Gate indicators
  const [gatePasirSiloOpen, setGatePasirSiloOpen] = useState(false);
  const [gatePasir1SiloOpen, setGatePasir1SiloOpen] = useState(false);
  const [gatePasir2SiloOpen, setGatePasir2SiloOpen] = useState(false);

  const [gateBatuSiloOpen, setGateBatuSiloOpen] = useState(false);
  const [gateBatu1SiloOpen, setGateBatu1SiloOpen] = useState(false);
  const [gateBatu2SiloOpen, setGateBatu2SiloOpen] = useState(false);

  const [mixerDoor1OpenActive, setMixerDoor1OpenActive] = useState(false);
  const [mixerDoor2OpenActive, setMixerDoor2OpenActive] = useState(false);
  const [mixerDoor3OpenActive, setMixerDoor3OpenActive] = useState(false);
  const [mixerDoorClosingActive, setMixerDoorClosingActive] = useState(false);

  const [screwSemenActive, setScrewSemenActive] = useState(false);
  const [valveWaterActive, setValveWaterActive] = useState(false);
  
  const [gatePasirHopperOpen, setGatePasirHopperOpen] = useState(false);
  const [gateBatuHopperOpen, setGateBatuHopperOpen] = useState(false);
  const [gateSemenHopperOpen, setGateSemenHopperOpen] = useState(false);
  const [gateWaterHopperOpen, setGateWaterHopperOpen] = useState(false);

  // --- INDUSTRIAL WAITING HOPPER SYSTEM STATES ---
  const [waitingHopperEnabled, setWaitingHopperEnabled] = useState<boolean>(() => {
    return localStorage.getItem('waiting_hopper_enabled') === 'true';
  });
  const [waitingHopperState, setWaitingHopperState] = useState<'WAITING_HOPPER_IDLE' | 'WAITING_HOPPER_FILLING' | 'WAITING_HOPPER_READY' | 'WAITING_HOPPER_DISCHARGING' | 'WAITING_HOPPER_EMPTY'>('WAITING_HOPPER_IDLE');
  const [waitingHopperGateOpen, setWaitingHopperGateOpen] = useState(false);
  const waitingHopperGateOpenRef = useRef(false);

  const [waitingHopperPulseOn, setWaitingHopperPulseOn] = useState<number>(() => {
    const s = localStorage.getItem('waiting_hopper_pulse_on');
    return s ? parseFloat(s) : 2.0;
  });
  const [waitingHopperPulseOff, setWaitingHopperPulseOff] = useState<number>(() => {
    const s = localStorage.getItem('waiting_hopper_pulse_off');
    return s ? parseFloat(s) : 1.0;
  });
  const [waitingHopperWaterDelay, setWaitingHopperWaterDelay] = useState<number>(() => {
    const s = localStorage.getItem('waiting_hopper_water_delay');
    return s ? parseFloat(s) : 3.0;
  });
  const [waitingHopperWaterPrecharge, setWaitingHopperWaterPrecharge] = useState<number>(() => {
    const s = localStorage.getItem('waiting_hopper_water_precharge');
    return s ? parseFloat(s) : 30.0;
  });

  const waitingHopperStateRef = useRef<'WAITING_HOPPER_IDLE' | 'WAITING_HOPPER_FILLING' | 'WAITING_HOPPER_READY' | 'WAITING_HOPPER_DISCHARGING' | 'WAITING_HOPPER_EMPTY'>('WAITING_HOPPER_IDLE');
  const [waitingHopperWeight, setWaitingHopperWeight] = useState(0);
  const waitingHopperWeightRef = useRef(0);
  const waitingHopperTimerRef = useRef(0); 
  const waitingHopperPrechargeTimerRef = useRef(0);
  const system1WaitingSeqRef = useRef<'idle' | 'sand_discharging' | 'sand_empty_delay' | 'stone_discharging' | 'done'>('idle');
  const system1WaitingSeqTimerRef = useRef<number>(0);
  const aggregateTransitQueueRef = useRef<{ amount: number; ticksNeeded: number }[]>([]);
  const aggregateInMixerRef = useRef<number>(0);
  const semenInMixerRef = useRef<number>(0);
  const waterInMixerRef = useRef<number>(0);

  const setWaitingHopperStateSync = (val: 'WAITING_HOPPER_IDLE' | 'WAITING_HOPPER_FILLING' | 'WAITING_HOPPER_READY' | 'WAITING_HOPPER_DISCHARGING' | 'WAITING_HOPPER_EMPTY') => {
    waitingHopperStateRef.current = val;
    setWaitingHopperState(val);
  };

  const setWaitingHopperGateOpenSync = (val: boolean) => {
    waitingHopperGateOpenRef.current = val;
    setWaitingHopperGateOpen(val);
  };

  const setWaitingHopperWeightSync = (val: number) => {
    waitingHopperWeightRef.current = val;
    setWaitingHopperWeight(val);
  };

  // Persists settings
  useEffect(() => {
    localStorage.setItem('waiting_hopper_enabled', waitingHopperEnabled ? 'true' : 'false');
  }, [waitingHopperEnabled]);
  useEffect(() => {
    localStorage.setItem('waiting_hopper_pulse_on', waitingHopperPulseOn.toString());
  }, [waitingHopperPulseOn]);
  useEffect(() => {
    localStorage.setItem('waiting_hopper_pulse_off', waitingHopperPulseOff.toString());
  }, [waitingHopperPulseOff]);
  useEffect(() => {
    localStorage.setItem('waiting_hopper_water_delay', waitingHopperWaterDelay.toString());
  }, [waitingHopperWaterDelay]);
  useEffect(() => {
    localStorage.setItem('waiting_hopper_water_precharge', waitingHopperWaterPrecharge.toString());
  }, [waitingHopperWaterPrecharge]);

  // FOUR INDEPENDENT REFS FOR UNINTERRUPTED WEIGHING COMPLETION TRACKING (Early Draining Protection)
  const pasirWeighedRef = useRef(false);
  const batuWeighedRef = useRef(false);
  const semenWeighedRef = useRef(false);
  const airWeighedRef = useRef(false);

  // Synchronous, zero-lag Ref source-of-truth for physical relay synchronization
  const gatePasirHopperOpenRef = useRef(false);
  const gateBatuHopperOpenRef = useRef(false);
  const gateSemenHopperOpenRef = useRef(false);
  const gateWaterHopperOpenRef = useRef(false);

  const [conveyorBottomPhase, setConveyorBottomPhase] = useState<'STANDBY' | 'PRESTART' | 'TRANSFER' | 'POSTRUN'>('STANDBY');
  const conveyorBottomPhaseRef = useRef<'STANDBY' | 'PRESTART' | 'TRANSFER' | 'POSTRUN'>('STANDBY');
  const conveyorBottomTimerRef = useRef<number>(0);

  const setGatePasirHopperOpenSync = (val: boolean) => {
    if (val && actualPasir1Ref.current + actualPasir2Ref.current === 0 && scalesRef.current.pasir.actual > 2) {
      const pTot = Math.round(scalesRef.current.pasir.actual);
      const p1Tgt = selectedRecipe?.jobMixDetails?.pasir1 ?? Math.round((selectedRecipe?.targets.pasir ?? 400) * 0.7);
      const pTotTgt = selectedRecipe?.targets.pasir ?? 450;
      const p1Ratio = pTotTgt > 0 ? p1Tgt / pTotTgt : 0.7;
      actualPasir1Ref.current = Math.round(pTot * p1Ratio);
      actualPasir2Ref.current = Math.max(0, pTot - actualPasir1Ref.current);
    }
    gatePasirHopperOpenRef.current = val;
    setGatePasirHopperOpen(val);
    if (batchingPlantMode === 'SYSTEM_2' && isAuto && isRunning) {
      const active = val || gateBatuHopperOpenRef.current || conveyorBottomPhaseRef.current !== 'STANDBY';
      conveyorBottomActiveRef.current = active;
      setConveyorBottomActive(active);
    }
  };
  const setGateBatuHopperOpenSync = (val: boolean) => {
    if (val && actualBatu1Ref.current + actualBatu2Ref.current === 0 && scalesRef.current.batu.actual > 2) {
      const bTot = Math.round(scalesRef.current.batu.actual);
      const b1Tgt = selectedRecipe?.jobMixDetails?.batu1 ?? Math.round((selectedRecipe?.targets.batu ?? 400) * 0.7);
      const bTotTgt = selectedRecipe?.targets.batu ?? 450;
      const b1Ratio = bTotTgt > 0 ? b1Tgt / bTotTgt : 0.7;
      actualBatu1Ref.current = Math.round(bTot * b1Ratio);
      actualBatu2Ref.current = Math.max(0, bTot - actualBatu1Ref.current);
    }
    gateBatuHopperOpenRef.current = val;
    setGateBatuHopperOpen(val);
    if (batchingPlantMode === 'SYSTEM_2' && isAuto && isRunning) {
      const active = gatePasirHopperOpenRef.current || val || conveyorBottomPhaseRef.current !== 'STANDBY';
      conveyorBottomActiveRef.current = active;
      setConveyorBottomActive(active);
    }
  };
  const setGateSemenHopperOpenSync = (val: boolean) => {
    if (val && actualSemenRef.current === 0 && scalesRef.current.semen.actual > 2) {
      actualSemenRef.current = Math.round(scalesRef.current.semen.actual);
    }
    gateSemenHopperOpenRef.current = val;
    setGateSemenHopperOpen(val);
  };
  const setGateWaterHopperOpenSync = (val: boolean) => {
    if (val && actualAirRef.current === 0 && scalesRef.current.air.actual > 2) {
      actualAirRef.current = Math.round(scalesRef.current.air.actual);
    }
    gateWaterHopperOpenRef.current = val;
    setGateWaterHopperOpen(val);
  };

  // Relay activities log with offline persistence
  const [relayLogs, setRelayLogs] = useState<RelayLog[]>(() => {
    const saved = localStorage.getItem('hmi_relay_logs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((rl: any) => rl && typeof rl === 'object' && typeof rl.message === 'string')
            .map((rl: any) => ({
              id: rl.id || Math.random().toString(36).substring(7).toUpperCase(),
              timestamp: new Date(rl.timestamp || Date.now()),
              message: rl.message,
              type: rl.type || 'info'
            }));
        }
      } catch (e) {
        console.error("Gagal load relay logs:", e);
      }
    }
    return [];
  });

  useEffect(() => {
    const currentPlantId = localStorage.getItem('plant_id') || 'PKU01';
    const currentPlantName = localStorage.getItem('plant_name') || 'Pekanbaru';

    const logsWithPlant = relayLogs.map(item => ({
      ...item,
      plantId: currentPlantId,
      plantName: currentPlantName
    }));

    localStorage.setItem('hmi_relay_logs', JSON.stringify(logsWithPlant));

    // Automated Cloud Queueing Layer
    logsWithPlant.forEach(item => {
      if (item.id && !queuedRelayIdsRef.current.has(item.id)) {
        queuedRelayIdsRef.current.add(item.id);
        queueForCloudSync("relay_log", item);
      }
    });
  }, [relayLogs]);
  
  // Conveyor / Machinery States
  const [conveyorBottomActive, setConveyorBottomActive] = useState(false);
  const [conveyorUpperActive, setConveyorUpperActive] = useState(false);
  const conveyorBottomActiveRef = useRef(false);
  const conveyorUpperActiveRef = useRef(false);

  const setConveyorBottomActiveSync = (val: boolean) => {
    if (batchingPlantMode === 'SYSTEM_2' && isAuto && isRunning) {
      const active = gatePasirHopperOpenRef.current || gateBatuHopperOpenRef.current || conveyorBottomPhaseRef.current !== 'STANDBY';
      conveyorBottomActiveRef.current = active;
      setConveyorBottomActive(active);
    } else {
      conveyorBottomActiveRef.current = val;
      setConveyorBottomActive(val);
      if (batchingPlantMode === 'SYSTEM_2' && !isAuto) {
        setGatePasirHopperOpenSync(val);
        setGateBatuHopperOpenSync(val);
      }
    }
  };
  const setConveyorUpperActiveSync = (val: boolean) => {
    conveyorUpperActiveRef.current = val;
    setConveyorUpperActive(val);
  };

  const setConveyorBottomPhaseSync = (val: 'STANDBY' | 'PRESTART' | 'TRANSFER' | 'POSTRUN') => {
    conveyorBottomPhaseRef.current = val;
    setConveyorBottomPhase(val);
    const shouldBeActive = val === 'PRESTART' || val === 'TRANSFER' || val === 'POSTRUN';
    setConveyorBottomActiveSync(shouldBeActive);
  };
  const [mixerShaftActive, setMixerShaftActive] = useState(false);
  
  // Mixer doors & concrete flowing status
  const [mixerDoorStateText, setMixerDoorStateText] = useState("CLOSED");
  const [mixerDoorPercent, setMixerDoorPercent] = useState(0); // 0 to 100%
  const [concreteDischargeActive, setConcreteDischargeActive] = useState(false);
  const [mixerStatusText, setMixerStatusText] = useState("IDLE");
  
  // Numerical monitors & counters
  const [compressorActive, setCompressorActive] = useState(false);
  const [vibratorActive, setVibratorActive] = useState(false);
  const [mixingCountdown, setMixingCountdown] = useState(0);
  const [dischargeTimeSec, setDischargeTimeSec] = useState(0);
  const [batchId, setBatchId] = useState("");
  const [klaksonActive, setKlaksonActive] = useState(false);
  const [admixInActive, setAdmixInActive] = useState(false);
  const [admixOutActive, setAdmixOutActive] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [activePins, setActivePins] = useState<Record<string, boolean>>({});
  const [alarmMessage, setAlarmMessage] = useState<string | null>(null);
  const [configTrigger, setConfigTrigger] = useState(0);

  const [batchingPlantMode, setBatchingPlantMode] = useState<'SYSTEM_1' | 'SYSTEM_2' | 'SYSTEM_3'>(() => {
    return (localStorage.getItem('batching_plant_mode') as 'SYSTEM_1' | 'SYSTEM_2' | 'SYSTEM_3') || 'SYSTEM_1';
  });

  const [operationMode, setOperationMode] = useState<'SIMULASI' | 'PRODUKSI'>(() => {
    return (localStorage.getItem('operation_mode') || 'SIMULASI') as 'SIMULASI' | 'PRODUKSI';
  });

  const operationModeRef = useRef<'SIMULASI' | 'PRODUKSI'>(operationMode);

  useEffect(() => {
    operationModeRef.current = operationMode;
    localStorage.setItem('operation_mode', operationMode);
  }, [operationMode]);

  // ----------------------------------------------------
  // REAL LOADCELL TELEMETRY DIRECT BINDING (SINGLE SOURCE OF TRUTH)
  // ----------------------------------------------------
  const handleTelemetryRef = useRef<any>(null);

  useEffect(() => {
    if (currentView === 'tablet') return;
    
    const bridge = (data: any) => {
      if (handleTelemetryRef.current) {
        handleTelemetryRef.current(data);
      }
    };

    webSerialService.registerTelemetryCallback(bridge);
    return () => {
      webSerialService.unregisterTelemetryCallback(bridge);
    };
  }, []);

  const [flowControlGates, setFlowControlGates] = useState<any>(() => {
    const saved = localStorage.getItem('flow_control_gates_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      pasir1: { key: 'pasir1', gateOnTime: 1.5, gateOffTime: 1.5 },
      pasir2: { key: 'pasir2', gateOnTime: 1.5, gateOffTime: 1.5 },
      batu1: { key: 'batu1', gateOnTime: 1.5, gateOffTime: 1.5 },
      batu2: { key: 'batu2', gateOnTime: 1.5, gateOffTime: 1.5 },
    };
  });

  useEffect(() => {
    localStorage.setItem('batching_plant_mode', batchingPlantMode);
  }, [batchingPlantMode]);

  useEffect(() => {
    localStorage.setItem('flow_control_gates_config', JSON.stringify(flowControlGates));
  }, [flowControlGates]);

  // Trigger config reloading on save events
  useEffect(() => {
    const handleReload = () => {
      setConfigTrigger(prev => prev + 1);
    };
    window.addEventListener("storage", handleReload);
    window.addEventListener("hmi_pin_config_updated", handleReload);
    return () => {
      window.removeEventListener("storage", handleReload);
      window.removeEventListener("hmi_pin_config_updated", handleReload);
    };
  }, []);

  // Real-time Arduino Serial relay state transmission hook
  useEffect(() => {
    if (currentView === 'tablet') return;
    // Extract Cement Silo ID from activeSiloSemen selection
    const match = activeSiloSemen.match(/Silo\s*(\d+)/i);
    const siloNum = match ? match[1] : "1";

    const configList = loadRelayConfig();

    const getRelayActiveState = (row: any): boolean => {
      // If the batch process is paused (and we are in Auto mode), almost all outputs must be OFF.
      if (isPausedRef.current && isAutoRef.current) {
        // Keep only critical non-feeding outputs active if they already are
        if (row.relay === 1) { // Mixer motor
          return mixerShaftActive;
        }
        if (row.relay === 4) { // Compressor
          return compressorActive;
        }
        if (row.relay === 16) { // Horn/Klakson
          return klaksonActive;
        }
        
        const normName = row.name.trim().toLowerCase();
        if (normName.includes("mixer") && !normName.includes("buka") && !normName.includes("tutup")) {
          return mixerShaftActive;
        }
        if (normName.includes("kompresor") || normName.includes("compressor")) {
          return compressorActive;
        }
        if (normName.includes("klakson") || normName.includes("horn")) {
          return klaksonActive;
        }
        
        return false;
      }

      const normName = row.name.trim().toLowerCase();
      
      // 1. Unchanging hardware Relay IDs (1 to 23)
      switch (row.relay) {
        case 1:  return mixerShaftActive; // Mixer
        case 2:  return conveyorUpperActiveRef.current; // Konveyor atas
        case 3:  return conveyorBottomActiveRef.current; // Konveyor bawah
        case 4:  return compressorActive; // Kompressor
        case 5:  return gatePasir1SiloOpen; // Pintu pasir 1
        case 6:  return gatePasir2SiloOpen; // Pintu pasir 2
        case 7:  return gateBatu1SiloOpen; // Pintu batu 1
        case 8:  return gateBatu2SiloOpen; // Pintu batu 2
        case 9:  return gatePasirHopperOpenRef.current; // Dump material (Pasir Dump)
        case 10: return gateBatuHopperOpenRef.current; // Dump material 2 (Batu Dump)
        case 11: return vibratorActive; // Vibrator
        case 12: return gateWaterHopperOpenRef.current; // Tuang air (Water Scale Dump Gate)
        case 13: return valveWaterActive; // Tuang additive (originally spare/water fill valve)
        case 14:
        case 28:
        case 29:
          return !!(mixerDoor1OpenActive || mixerDoor2OpenActive || mixerDoor3OpenActive); // Pintu mixer buka (1 m3, 2 m3, 3.5 m3)
        case 15: return mixerDoorClosingActive; // Pintu mixer tutup
        case 16: return klaksonActive; // Klakson
        case 17: return !!(screwSemenActive && siloNum === "1"); // Silo 1
        case 18: return !!(screwSemenActive && siloNum === "2"); // Silo 2
        case 19: return !!(screwSemenActive && siloNum === "3"); // Silo 3
        case 20: return !!(screwSemenActive && siloNum === "4"); // Silo 4
        case 21: return !!(screwSemenActive && siloNum === "5"); // Silo 5
        case 22: return !!(screwSemenActive && siloNum === "6"); // Silo 6
        case 23: return gateSemenHopperOpenRef.current; // Dump semen (Cement scale dumper gate)
        case 24: return waitingHopperGateOpenRef.current; // Pintu Waiting Hopper Gate (Relay #24)
      }

      // 2. Dynamic, flexible keyword name fallbacks
      if (normName.includes("waiting") && normName.includes("hopper")) {
        return waitingHopperGateOpenRef.current;
      }
      if (normName.includes("pintu") && normName.includes("waiting")) {
        return waitingHopperGateOpenRef.current;
      }
      if (normName.includes("chute") && normName.includes("gate")) {
        return waitingHopperGateOpenRef.current;
      }
      if (normName.includes("mixer") && normName.includes("buka")) {
        return !!(mixerDoor1OpenActive || mixerDoor2OpenActive || mixerDoor3OpenActive);
      }
      if (normName.includes("mixer") && normName.includes("tutup")) {
        return mixerDoorClosingActive;
      }
      if (normName.includes("mixer")) {
        return mixerShaftActive;
      }
      if (normName.includes("konveyor") && normName.includes("atas")) {
        return conveyorUpperActiveRef.current;
      }
      if (normName.includes("konveyor") && normName.includes("bawah")) {
        return conveyorBottomActiveRef.current;
      }
      if (normName.includes("pintu pasir 1")) {
        return gatePasir1SiloOpen;
      }
      if (normName.includes("pintu pasir 2")) {
        return gatePasir2SiloOpen;
      }
      if (normName.includes("pintu batu 1")) {
        return gateBatu1SiloOpen;
      }
      if (normName.includes("pintu batu 2")) {
        return gateBatu2SiloOpen;
      }
      if (normName.includes("dump") && (normName.includes("batu") || normName.includes("gravel") || normName.includes("material 2") || normName.includes("kris"))) {
        return gateBatuHopperOpenRef.current;
      }
      if (normName.includes("dump") && (normName.includes("pasir") || normName.includes("sand") || normName.includes("material") || normName.includes("material 1"))) {
        return gatePasirHopperOpenRef.current;
      }
      if (normName.includes("semen") || normName.includes("cement") || normName.includes("dump semen")) {
        return gateSemenHopperOpenRef.current;
      }
      if (normName.includes("tuang air") || normName.includes("dump air") || normName.includes("discharge air")) {
        return gateWaterHopperOpenRef.current;
      }
      if (normName.includes("air timbang") || normName.includes("valve air") || normName.includes("tuang additive") || normName.includes("inlet air")) {
        return valveWaterActive;
      }
      if (normName.includes("klakson") || normName.includes("horn")) {
        return klaksonActive;
      }
      if (normName.includes("silo 1")) return !!(screwSemenActive && siloNum === "1");
      if (normName.includes("silo 2")) return !!(screwSemenActive && siloNum === "2");
      if (normName.includes("silo 3")) return !!(screwSemenActive && siloNum === "3");
      if (normName.includes("silo 4")) return !!(screwSemenActive && siloNum === "4");
      if (normName.includes("silo 5")) return !!(screwSemenActive && siloNum === "5");
      if (normName.includes("silo 6")) return !!(screwSemenActive && siloNum === "6");

      return false;
    };

    const pinStatesMap: Record<string, boolean> = {};

    configList.forEach(row => {
      const isFunctionActive = getRelayActiveState(row);
      const pin = row.arduinoPin || "";
      if (pin) {
        pinStatesMap[pin] = pinStatesMap[pin] || isFunctionActive;
      }
    });

    const arduinoPinsOrder = [
      "22", "24", "26", "28", "30", "32", "34", "36", "38", "40", "42", "44", "48", "50", "52", "33", "31", "35", "37", "39", "41", "43", "45", "47", "49", "51", "53"
    ];

    const states = Array(27).fill(false);
    for (let i = 0; i < 27; i++) {
      const targetPin = arduinoPinsOrder[i];
      states[i] = !!pinStatesMap[targetPin];
    }

    // Update state for output monitor matching
    setActivePins(pinStatesMap);

    // Broadcast states or buffer them during connection transitions (disabled for production safety)
    const currentStatus = webSerialService.getStatus();
    if (webSerialService.isLegacyControlEnabled() && (currentStatus === "CONNECTED" || currentStatus === "RECONNECTING" || currentStatus === "CONNECTING")) {
      webSerialService.sendRelaysState(states);
    }
  }, [
    mixerShaftActive,
    conveyorUpperActive,
    conveyorBottomActive,
    gatePasir1SiloOpen,
    gatePasir2SiloOpen,
    gateBatu1SiloOpen,
    gateBatu2SiloOpen,
    gatePasirHopperOpen,
    gateBatuHopperOpen,
    gateSemenHopperOpen,
    gateWaterHopperOpen,
    valveWaterActive,
    mixerDoor1OpenActive,
    mixerDoor2OpenActive,
    mixerDoor3OpenActive,
    mixerDoorClosingActive,
    klaksonActive,
    screwSemenActive,
    activeSiloSemen,
    configTrigger
  ]);

  // References and effects for logging relay state transitions
  const prevStatesRef = useRef({
    gatePasir1SiloOpen: false,
    gatePasir2SiloOpen: false,
    gateBatu1SiloOpen: false,
    gateBatu2SiloOpen: false,
    screwSemenActive: false,
    valveWaterActive: false,
    conveyorUpperActive: false,
    conveyorBottomActive: false,
    klaksonActive: false,
    mixerShaftActive: false,
    gatePasirHopperOpen: false,
    gateBatuHopperOpen: false,
    gateWaterHopperOpen: false,
    gateSemenHopperOpen: false,
    mixerDoor1OpenActive: false,
    mixerDoor2OpenActive: false,
    mixerDoor3OpenActive: false,
    mixerDoorClosingActive: false,
  });

  useEffect(() => {
    const prev = prevStatesRef.current;
    const now = {
      gatePasir1SiloOpen,
      gatePasir2SiloOpen,
      gateBatu1SiloOpen,
      gateBatu2SiloOpen,
      screwSemenActive,
      valveWaterActive,
      conveyorUpperActive,
      conveyorBottomActive,
      klaksonActive,
      mixerShaftActive,
      gatePasirHopperOpen,
      gateBatuHopperOpen,
      gateWaterHopperOpen,
      gateSemenHopperOpen,
      mixerDoor1OpenActive,
      mixerDoor2OpenActive,
      mixerDoor3OpenActive,
      mixerDoorClosingActive,
    };

    const newLogs: RelayLog[] = [];
    const createLog = (message: string, type: 'on' | 'off' | 'info' | 'done') => {
      newLogs.push({
        id: 'RL-' + Math.random().toString(36).substring(4, 9).toUpperCase() + '-' + Date.now(),
        timestamp: new Date(),
        message,
        type,
      });
    };

    // Extract Cement Silo ID from activeSiloSemen selection
    const match = activeSiloSemen.match(/Silo\s*(\d+)/i);
    const siloNum = match ? match[1] : "1";

    // 1. Pasir 1
    if (now.gatePasir1SiloOpen !== prev.gatePasir1SiloOpen) {
      if (now.gatePasir1SiloOpen) createLog('pasir 1 on', 'on');
      else createLog('pasir 1 off', 'off');
    }
    // 2. Pasir 2
    if (now.gatePasir2SiloOpen !== prev.gatePasir2SiloOpen) {
      if (now.gatePasir2SiloOpen) createLog('pasir 2 on', 'on');
      else createLog('pasir 2 off', 'off');
    }
    // 3. Batu 1
    if (now.gateBatu1SiloOpen !== prev.gateBatu1SiloOpen) {
      if (now.gateBatu1SiloOpen) createLog('batu 1 on', 'on');
      else createLog('batu 1 off', 'off');
    }
    // 4. Batu 2
    if (now.gateBatu2SiloOpen !== prev.gateBatu2SiloOpen) {
      if (now.gateBatu2SiloOpen) createLog('batu 2 on', 'on');
      else createLog('batu 2 off', 'off');
    }
    // 5. Semen Silo
    if (now.screwSemenActive !== prev.screwSemenActive) {
      if (now.screwSemenActive) createLog(`silo ${siloNum} on`, 'on');
      else createLog(`silo ${siloNum} off`, 'off');
    }
    // 6. Air Timbang
    if (now.valveWaterActive !== prev.valveWaterActive) {
      if (now.valveWaterActive) createLog('air timbang on', 'on');
      else createLog('air timbang off', 'off');
    }
    const configListForLogging = loadRelayConfig();
    const getPinForRelay = (relayNum: number): string => {
      const row = configListForLogging.find(r => r.relay === relayNum);
      return row ? row.arduinoPin || "X" : "X";
    };

    // 7. Dump Pasir
    if (now.gatePasirHopperOpen !== prev.gatePasirHopperOpen) {
      const pin = getPinForRelay(9);
      if (now.gatePasirHopperOpen) {
        createLog(`DUMP PASIR START - PIN ${pin} ON`, 'on');
      } else {
        createLog(`WEIGHT EMPTY - GATE CLOSE - PIN ${pin} OFF`, 'off');
      }
    }
    // 8. Dump Batu
    if (now.gateBatuHopperOpen !== prev.gateBatuHopperOpen) {
      const pin = getPinForRelay(10);
      if (now.gateBatuHopperOpen) {
        createLog(`DUMP BATU START - PIN ${pin} ON`, 'on');
      } else {
        createLog(`WEIGHT EMPTY - GATE CLOSE - PIN ${pin} OFF`, 'off');
      }
    }
    // 9. Dump Air
    if (now.gateWaterHopperOpen !== prev.gateWaterHopperOpen) {
      const pin = getPinForRelay(12);
      if (now.gateWaterHopperOpen) {
        createLog(`DUMP AIR START - PIN ${pin} ON`, 'on');
      } else {
        createLog(`WEIGHT EMPTY - GATE CLOSE - PIN ${pin} OFF`, 'off');
      }
    }
    // 10. Dump Semen
    if (now.gateSemenHopperOpen !== prev.gateSemenHopperOpen) {
      const pin = getPinForRelay(23);
      if (now.gateSemenHopperOpen) {
        createLog(`DUMP SEMEN START - PIN ${pin} ON`, 'on');
      } else {
        createLog(`WEIGHT EMPTY - GATE CLOSE - PIN ${pin} OFF`, 'off');
      }
    }
    // 11. Konveyor Atas
    if (now.conveyorUpperActive !== prev.conveyorUpperActive) {
      if (now.conveyorUpperActive) createLog('konveyor atas on', 'on');
      else createLog('konveyor atas off', 'off');
    }
    // 12. Konveyor Bawah
    if (now.conveyorBottomActive !== prev.conveyorBottomActive) {
      if (now.conveyorBottomActive) createLog('konveyor bawah on', 'on');
      else createLog('konveyor bawah off', 'off');
    }
    // 13. Klakson
    if (now.klaksonActive !== prev.klaksonActive) {
      if (now.klaksonActive) createLog('klakson on', 'on');
      else createLog('klakson off', 'off');
    }
    // 14. Motor Mixer & Mixer
    if (now.mixerShaftActive !== prev.mixerShaftActive) {
      if (now.mixerShaftActive) {
        createLog('motor mixer on', 'on');
        createLog('mixer on', 'on');
      } else {
        createLog('motor mixer off', 'off');
        createLog('mixer off', 'off');
      }
    }
    // 15. Buka Pintu Mixer 1 dari 3
    if (now.mixerDoor1OpenActive !== prev.mixerDoor1OpenActive) {
      if (now.mixerDoor1OpenActive) createLog('buka pintu 1 dari 3 on', 'on');
      else createLog('buka pintu 1 dari 3 off', 'off');
    }
    // 16. Buka Pintu Mixer 2 dari 3
    if (now.mixerDoor2OpenActive !== prev.mixerDoor2OpenActive) {
      if (now.mixerDoor2OpenActive) createLog('buka pintu 2 dari 3 on', 'on');
      else createLog('buka pintu 2 dari 3 off', 'off');
    }
    // 17. Buka Pintu Mixer 3 dari 3
    if (now.mixerDoor3OpenActive !== prev.mixerDoor3OpenActive) {
      if (now.mixerDoor3OpenActive) createLog('buka pintu 3 dari 3 on', 'on');
      else createLog('buka pintu 3 dari 3 off', 'off');
    }
    // 18. Tutup Pintu Mixer
    if (now.mixerDoorClosingActive !== prev.mixerDoorClosingActive) {
      if (now.mixerDoorClosingActive) createLog('tutup pintu mixer on', 'on');
      else createLog('tutup pintu mixer off', 'off');
    }

    if (newLogs.length > 0) {
      setRelayLogs(prevLogs => {
        const combined = [...newLogs, ...prevLogs];
        return combined.slice(0, 60);
      });
    }

    // Sync ref
    prevStatesRef.current = now;
  }, [
    gatePasir1SiloOpen,
    gatePasir2SiloOpen,
    gateBatu1SiloOpen,
    gateBatu2SiloOpen,
    screwSemenActive,
    valveWaterActive,
    conveyorUpperActive,
    conveyorBottomActive,
    klaksonActive,
    mixerShaftActive,
    gatePasirHopperOpen,
    gateBatuHopperOpen,
    gateWaterHopperOpen,
    gateSemenHopperOpen,
    mixerDoor1OpenActive,
    mixerDoor2OpenActive,
    mixerDoor3OpenActive,
    mixerDoorClosingActive,
    activeSiloSemen
  ]);

  // Record completion log
  useEffect(() => {
    if (isDone) {
      setRelayLogs(prevLogs => [
        {
          id: 'RL-DONE-' + Date.now(),
          timestamp: new Date(),
          message: 'produksi selesai',
          type: 'done' as const
        },
        ...prevLogs
      ].slice(0, 60));
    }
  }, [isDone]);

  // Admin Login and Session state
  const [currentView, setCurrentView] = useState<'portal' | 'hmi' | 'admin-login' | 'admin-dashboard' | 'tablet'>(() => {
    const isTabletPath = 
      window.location.pathname.includes('/tablet') || 
      window.location.hash.includes('tablet') || 
      window.location.search.includes('view=tablet') ||
      window.location.port === '3001';
      
    if (isTabletPath) {
      return 'tablet';
    }

    const savedUserStr = localStorage.getItem("batching_plant_active_user");
    if (savedUserStr) {
      try {
        const u = JSON.parse(savedUserStr);
        const role = u.jabatan?.toUpperCase() || "";
        if (role === "OPERATOR") {
          return 'hmi';
        } else if (["ADMIN", "DIREKTUR", "SUPERVISOR", "LOGISTIK"].includes(role)) {
          localStorage.setItem('admin_session', 'true');
          return 'admin-dashboard';
        }
      } catch (err) {}
    }
    return 'portal';
  });

  const [isOperatorLoginOpen, setIsOperatorLoginOpen] = useState(false);
  const [activeOperator, setActiveOperator] = useState<any>(() => {
    const saved = localStorage.getItem("batching_plant_active_user");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.jabatan?.toUpperCase() === "OPERATOR") {
          return parsed;
        }
      } catch (err) {}
    }
    return null; // Forcing real operator login from the login portal
  });

  // Guard system to enforce strict view-access-control (No bypass possible)
  useEffect(() => {
    const checkAccess = () => {
      const isTabletPath = 
        window.location.pathname.includes('/tablet') || 
        window.location.hash.includes('tablet') || 
        window.location.search.includes('view=tablet') ||
        window.location.port === '3001';
        
      if (isTabletPath) {
        if (currentView !== 'tablet') {
          setCurrentView('tablet');
        }
        return;
      }

      const savedUserStr = localStorage.getItem("batching_plant_active_user");
      if (!savedUserStr) {
        if (currentView !== 'portal') {
          setCurrentView('portal');
        }
        return;
      }

      try {
        const u = JSON.parse(savedUserStr);
        const role = u.jabatan?.toUpperCase() || "";
        if (role === "OPERATOR") {
          if (currentView !== 'hmi') {
            setCurrentView('hmi');
          }
        } else if (["ADMIN", "DIREKTUR", "SUPERVISOR", "LOGISTIK"].includes(role)) {
          if (currentView !== 'admin-dashboard') {
            setCurrentView('admin-dashboard');
          }
        } else {
          localStorage.removeItem("batching_plant_active_user");
          localStorage.removeItem("admin_session");
          setCurrentView('portal');
        }
      } catch (err) {
        localStorage.removeItem("batching_plant_active_user");
        localStorage.removeItem("admin_session");
        setCurrentView('portal');
      }
    };

    checkAccess();
    window.addEventListener("active_user_session_sync", checkAccess);
    return () => {
      window.removeEventListener("active_user_session_sync", checkAccess);
    };
  }, [currentView]);

  useEffect(() => {
    const handleSync = () => {
      const saved = localStorage.getItem("batching_plant_active_user");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.jabatan?.toUpperCase() === "OPERATOR") {
            setActiveOperator(parsed);
          } else {
            setActiveOperator(null);
          }
        } catch (err) {}
      } else {
        setActiveOperator(null);
      }
    };
    window.addEventListener("active_user_session_sync", handleSync);
    window.addEventListener("user_database_updated", handleSync);
    return () => {
      window.removeEventListener("active_user_session_sync", handleSync);
      window.removeEventListener("user_database_updated", handleSync);
    };
  }, []);

  // --- STATE FOR MIXING SEQUENCE CONFIGS (URUTAN MIXING) ---
  const [mixingSequence, setMixingSequence] = useState<MixingSequence>(() => {
    const saved = localStorage.getItem('hmi_mixing_sequence');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Gagal load mixing sequence dari localStorage, using defaults: ", e);
      }
    }
    return {
      pasir: { nomor: 1, timer: 0 },
      air: { nomor: 1, timer: 2 },
      semen: { nomor: 1, timer: 5 },
      batu: { nomor: 2, timer: 0 }
    };
  });

  const transformedLogs = useMemo(() => {
    return logs
      .filter(l => l.status === 'sukses')
      .map(l => ({
        id: l.id,
        recipeName: l.recipeName,
        volume: l.volume || 1.0,
        timestamp: l.timestamp.toLocaleString('id-ID'),
        targets: l.targets,
        actuals: l.actuals,
        mixingCycles: l.mixingCycles || 1,
        slump: l.slump || "12cm",
        siloSemen: l.siloSemen || "SILO 1",
        pelanggan: l.pelanggan || "",
        lokasi: l.lokasi || "",
        noKendaraan: l.noKendaraan || "",
        sopir: l.sopir || "",
        productionMode: l.productionMode || "AUTO",
        startTime: l.startTime || "",
        endTime: l.endTime || ""
      }));
  }, [logs]);
  const [recipesList, setRecipesList] = useState<Recipe[]>(() => {
    const saved = localStorage.getItem("batching_plant_recipes_data_scada");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return RECIPES;
  });
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe>(() => recipesList[0] || RECIPES[0]);

  useEffect(() => {
    const handleJmfUpdate = () => {
      const saved = localStorage.getItem("batching_plant_recipes_data_scada");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRecipesList(parsed);
            setSelectedRecipe(current => {
              const matched = parsed.find(r => r.id === current?.id);
              if (matched) return matched;
              const matchedByName = parsed.find(r => r.name === current?.name);
              if (matchedByName) return matchedByName;
              return parsed[0] || current;
            });
          }
        } catch (e) {}
      }
    };

    window.addEventListener("jmf_database_updated", handleJmfUpdate);
    // Trigger initial load sync
    handleJmfUpdate();

    return () => {
      window.removeEventListener("jmf_database_updated", handleJmfUpdate);
    };
  }, []);
  const [truckImage, setTruckImage] = useState<string | null>(() => {
    return localStorage.getItem('hmi_truck_image') || null;
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTruckImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setTruckImage(reader.result);
          localStorage.setItem('hmi_truck_image', reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Real-time state additions for second image
  const [ampere, setAmpere] = useState<number | null>(null);
  const [airPressure, setAirPressure] = useState<number>(0.0);
  const [slump, setSlump] = useState<number | null>(null);
  const [mixingTime, setMixingTime] = useState(0);
  const [isAuto, setIsAuto] = useState(true);
  const isAutoRef = useRef(isAuto);
  useEffect(() => {
    isAutoRef.current = isAuto;
  }, [isAuto]);

  // Tanpa Operator (Operatorless Mode) State with local storage sync
  const [tanpaOperator, setTanpaOperator] = useState<boolean>(() => {
    return localStorage.getItem("tanpa_operator_enabled") === "true";
  });
  const [truckPresenceRequired, setTruckPresenceRequired] = useState<boolean>(() => {
    return localStorage.getItem("tanpa_operator_truck_presence") === "true";
  });
  const [driverDischargeRequired, setDriverDischargeRequired] = useState<boolean>(() => {
    return localStorage.getItem("tanpa_operator_driver_confirm") === "true";
  });
  const [minAirPressure, setMinAirPressure] = useState<number>(() => {
    const val = localStorage.getItem("tanpa_operator_min_pressure");
    return val !== null ? parseFloat(val) : 80.0;
  });
  const [pressureLimitEnabled, setPressureLimitEnabled] = useState<boolean>(() => {
    return localStorage.getItem("tanpa_operator_pressure_limit_enabled") === "true";
  });

  const [isTruckPresent, setIsTruckPresent] = useState<boolean>(false);
  const [driverBtnPressed, setDriverBtnPressed] = useState<boolean>(false);

  const updateTanpaOperator = (val: boolean) => {
    setTanpaOperator(val);
    localStorage.setItem("tanpa_operator_enabled", val ? "true" : "false");
  };
  const updateTruckPresenceRequired = (val: boolean) => {
    setTruckPresenceRequired(val);
    localStorage.setItem("tanpa_operator_truck_presence", val ? "true" : "false");
  };
  const updateDriverDischargeRequired = (val: boolean) => {
    setDriverDischargeRequired(val);
    localStorage.setItem("tanpa_operator_driver_confirm", val ? "true" : "false");
  };
  const updateMinAirPressure = (val: number) => {
    setMinAirPressure(val);
    localStorage.setItem("tanpa_operator_min_pressure", val.toString());
  };
  const updatePressureLimitEnabled = (val: boolean) => {
    setPressureLimitEnabled(val);
    localStorage.setItem("tanpa_operator_pressure_limit_enabled", val ? "true" : "false");
  };

  const [batchingMode, setBatchingMode] = useState<'MANUAL' | 'SEMI_AUTO' | 'AUTO'>('AUTO');
  const batchingModeRef = useRef(batchingMode);
  useEffect(() => {
    batchingModeRef.current = batchingMode;
  }, [batchingMode]);

  useEffect(() => {
    setIsAuto(batchingMode === 'AUTO');
  }, [batchingMode]);

  useEffect(() => {
    if (isAuto && batchingMode !== 'AUTO') {
      setBatchingMode('AUTO');
    } else if (!isAuto && batchingMode === 'AUTO') {
      setBatchingMode('MANUAL');
    }
  }, [isAuto]);

  const [semiAutoDosing, setSemiAutoDosing] = useState<Record<string, boolean>>({
    pasir1: false,
    pasir2: false,
    batu1: false,
    batu2: false,
    semen: false,
    air: false,
    admix: false
  });
  const semiAutoDosingRef = useRef(semiAutoDosing);
  useEffect(() => {
    semiAutoDosingRef.current = semiAutoDosing;
  }, [semiAutoDosing]);

  const [admixActual, setAdmixActual] = useState(0);
  const admixActualRef = useRef(admixActual);
  useEffect(() => {
    admixActualRef.current = admixActual;
  }, [admixActual]);

  const isRunningRef = useRef(isRunning);
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  const [minMixerGateOpenTime, setMinMixerGateOpenTime] = useState<number>(() => {
    const s = localStorage.getItem('min_mixer_gate_open_time');
    return s ? parseInt(s, 10) : 10;
  });
  const minMixerGateOpenTimeRef = useRef(minMixerGateOpenTime);
  useEffect(() => {
    localStorage.setItem('min_mixer_gate_open_time', minMixerGateOpenTime.toString());
    minMixerGateOpenTimeRef.current = minMixerGateOpenTime;
  }, [minMixerGateOpenTime]);

  const [manualStartTime, setManualStartTime] = useState<string>(() => {
    return localStorage.getItem('hmi_manual_start_time') || "";
  });

  const [autoStartTime, setAutoStartTime] = useState<string>("");
  const [activePrintLog, setActivePrintLog] = useState<any | null>(null);

  const [companyName, setCompanyName] = useState<string>(() => {
    return localStorage.getItem('company_name') || "PT FARIKA RIAU PERKASA";
  });
  const [companyTagline, setCompanyTagline] = useState<string>(() => {
    return localStorage.getItem('company_tagline') || "ONE STOP CONCRETE SOLUTION";
  });
  const [companyLogo, setCompanyLogo] = useState<string>(() => {
    return localStorage.getItem('company_logo') || "";
  });

  // --- Plant Identity & Cloud Synchronization States ---
  const [plantId, setPlantId] = useState<string>(() => localStorage.getItem('plant_id') || 'PKU01');
  const [plantName, setPlantName] = useState<string>(() => localStorage.getItem('plant_name') || 'Pekanbaru');
  const [plantCompany, setPlantCompany] = useState<string>(() => localStorage.getItem('plant_company') || 'PT Farika Riau Perkasa');
  const [plantAddress, setPlantAddress] = useState<string>(() => localStorage.getItem('plant_address') || '');
  const [plantRegistered, setPlantRegistered] = useState<boolean>(() => localStorage.getItem('plant_registered') === 'true');

  // Sync state changes in administrative settings
  useEffect(() => {
    const syncPlantInfo = () => {
      setPlantId(localStorage.getItem('plant_id') || 'PKU01');
      setPlantName(localStorage.getItem('plant_name') || 'Pekanbaru');
      setPlantCompany(localStorage.getItem('plant_company') || 'PT Farika Riau Perkasa');
      setPlantAddress(localStorage.getItem('plant_address') || '');
      setPlantRegistered(localStorage.getItem('plant_registered') === 'true');
    };
    window.addEventListener("plant_identity_updated", syncPlantInfo);
    return () => {
      window.removeEventListener("plant_identity_updated", syncPlantInfo);
    };
  }, []);

  const manualGateOpenTimeMsRef = useRef<number>(0);
  const isManualGateOpenTimeValidRef = useRef<boolean>(false);
  const manualGateSequenceStateRef = useRef<'IDLE' | 'OPENING'>('IDLE');

  // Custom modal state for secure, reliable logout in framing/iframe conditions
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const mixerDoorStateTextRef = useRef("CLOSED");
  const mixerDoorPercentRef = useRef(0);
  useEffect(() => {
    mixerDoorStateTextRef.current = mixerDoorStateText;
  }, [mixerDoorStateText]);
  useEffect(() => {
    mixerDoorPercentRef.current = mixerDoorPercent;
  }, [mixerDoorPercent]);
  const [isPrint, setIsPrint] = useState(true);
  const [moistureControl, setMoistureControl] = useState(false);
  const [pasirMoisture, setPasirMoisture] = useState(0);
  const [batuMoisture, setBatuMoisture] = useState(0);
  const [airAdjustment, setAirAdjustment] = useState(0);
  const [isMoistureOpen, setIsMoistureOpen] = useState(false);
  const [isQuarryOpen, setIsQuarryOpen] = useState(false);
  const [quarryPasir1, setQuarryPasir1] = useState(() => localStorage.getItem("quarry_pasir_1") || "Pasir Galunggung");
  const [quarryPasir2, setQuarryPasir2] = useState(() => localStorage.getItem("quarry_pasir_2") || "Pasir Sungai");
  const [quarryBatu1, setQuarryBatu1] = useState(() => localStorage.getItem("quarry_batu_1") || "Batu Split 1-2");
  const [quarryBatu2, setQuarryBatu2] = useState(() => localStorage.getItem("quarry_batu_2") || "Batu Split 2-3");
  const [isHmiAdminOpen, setIsHmiAdminOpen] = useState(false);
  const [isHmiAdminMenuOpen, setIsHmiAdminMenuOpen] = useState(false);
  const [hmiAdminPassword, setHmiAdminPassword] = useState("");
  const [hmiAdminError, setHmiAdminError] = useState("");
  const [quarryAggregate, setQuarryAggregate] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Keyboard spacebar listener to trigger pause/continue
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        // Prevent action when typing in any input, textarea, or contenteditable fields
        const activeEl = document.activeElement;
        if (activeEl && (
          activeEl.tagName === 'INPUT' || 
          activeEl.tagName === 'TEXTAREA' || 
          activeEl.hasAttribute('contenteditable')
        )) {
          return;
        }

        // Prevent page scroll
        e.preventDefault();

        // Only active during auto production run
        if (isRunning && isAuto) {
          setIsPaused(prev => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isRunning, isAuto]);

  // -- Material isolated jogging states (prioritas lokal manual) --

  const [joggingPasir1, setJoggingPasir1] = useState(false);
  const [joggingPasir2, setJoggingPasir2] = useState(false);
  const [joggingBatu1, setJoggingBatu1] = useState(false);
  const [joggingBatu2, setJoggingBatu2] = useState(false);
  const [joggingSemen, setJoggingSemen] = useState(false);
  const [joggingAir, setJoggingAir] = useState(false);

  const joggingPasir1Ref = useRef(false);
  const joggingPasir2Ref = useRef(false);
  const joggingBatu1Ref = useRef(false);
  const joggingBatu2Ref = useRef(false);
  const joggingSemenRef = useRef(false);
  const joggingAirRef = useRef(false);

  useEffect(() => { joggingPasir1Ref.current = joggingPasir1; }, [joggingPasir1]);
  useEffect(() => { joggingPasir2Ref.current = joggingPasir2; }, [joggingPasir2]);
  useEffect(() => { joggingBatu1Ref.current = joggingBatu1; }, [joggingBatu1]);
  useEffect(() => { joggingBatu2Ref.current = joggingBatu2; }, [joggingBatu2]);
  useEffect(() => { joggingSemenRef.current = joggingSemen; }, [joggingSemen]);
  useEffect(() => { joggingAirRef.current = joggingAir; }, [joggingAir]);

  const activeSiloSemenRef = useRef(activeSiloSemen);
  useEffect(() => { activeSiloSemenRef.current = activeSiloSemen; }, [activeSiloSemen]);

  // --- SCADA INDUSTRIAL SEQUENCING AND SIMULATION TICKER ---
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Local variables to bypass state asynchronous lag inside the 100ms loop
  const weighingActiveRef = useRef(false);
  const aggregateReadyLoggedRef = useRef(false);
  const aggregateDischargeLoggedRef = useRef(false);
  const conveyorTransferStartLoggedRef = useRef(false);
  const conveyorTransferCompleteLoggedRef = useRef(false);
  const mixerStateRef = useRef<'waiting' | 'discharging_hoppers' | 'mixing' | 'discharging_concrete' | 'complete'>('waiting');
  const [mixerState, setMixerState] = useState<'waiting' | 'discharging_hoppers' | 'mixing' | 'discharging_concrete' | 'complete'>('waiting');
  const setMixerStateSync = (val: 'waiting' | 'discharging_hoppers' | 'mixing' | 'discharging_concrete' | 'complete') => {
    mixerStateRef.current = val;
    setMixerState(val);
  };

  // Dynamic simulation of Ampere and Slump based on Mixer Shaft activity and Recipe targets
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    
    if (mixerShaftActive) {
      intervalId = setInterval(() => {
        // If connected to physical hardware serial, bypass simulation
        if (webSerialService.getStatus() === "CONNECTED") {
          return;
        }
        if (isRunning && mixerState === 'mixing') {
          // Dynamic mixing load
          const baseSlump = parseFloat(selectedRecipe?.slump || "11") || 11.0;
          const targetAmpere = 100.0 - (baseSlump - 10.0) * 4.0; // tighter class -> higher ampere
          
          setAmpere(parseFloat((targetAmpere + (Math.random() - 0.5) * 3.0).toFixed(1)));
          setSlump(parseFloat((baseSlump + (Math.random() - 0.5) * 0.8).toFixed(1)));
        } else {
          // Idle rotation (empty mixer running, but not actively mixing in a batch cycle)
          setAmpere(parseFloat((46.5 + (Math.random() - 0.5) * 1.5).toFixed(1)));
          setSlump(0.0);
        }
      }, 500);
    } else {
      // If connected to hardware, do not overwrite sensory state
      if (webSerialService.getStatus() !== "CONNECTED") {
        setAmpere(0.0);
        setSlump(0.0);
      }
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [mixerShaftActive, isRunning, mixerState, selectedRecipe]);

  const dischargeTimerMsRef = useRef(0);
  const mixingTimerMsRef = useRef(0);
  const doorStepRef = useRef(1);
  const doorTimerMsRef = useRef(0);

  const mixingSequenceRef = useRef<MixingSequence>(mixingSequence);
  const sandDischargeStartedRef = useRef(false);
  const sandCompletedElapsedSecRef = useRef<number | null>(null);

  const currentBatchNoRef = useRef(1);
  const weighedBatchNosRef = useRef<Record<MaterialType, number>>({
    pasir: 1,
    batu: 1,
    semen: 1,
    air: 1
  });
  const batchQueueRef = useRef<any[]>([]);

  // Tracking actual weights for individual sub-materials
  const actualPasir1Ref = useRef<number>(0);
  const actualPasir2Ref = useRef<number>(0);
  const actualBatu1Ref = useRef<number>(0);
  const actualBatu2Ref = useRef<number>(0);
  const actualSemenRef = useRef<number>(0);
  const actualAirRef = useRef<number>(0);

  // Cumulative actual weights for the entire batch volume (across all mixing cycles)
  const accumPasir1Ref = useRef<number>(0);
  const accumPasir2Ref = useRef<number>(0);
  const accumBatu1Ref = useRef<number>(0);
  const accumBatu2Ref = useRef<number>(0);
  const accumSemenRef = useRef<number>(0);
  const accumAirRef = useRef<number>(0);

  // Manual cumulative dispensed material trackers for logging actuals in manual production mode
  const manualPasir1Ref = useRef<number>(0);
  const manualPasir2Ref = useRef<number>(0);
  const manualBatu1Ref = useRef<number>(0);
  const manualBatu2Ref = useRef<number>(0);
  const manualSemenRef = useRef<number>(0);
  const manualAirRef = useRef<number>(0);

  // Peak weight trackers during manual cycle to handle physical bypass buttons
  const manualPeakPasirRef = useRef<number>(0);
  const manualPeakBatuRef = useRef<number>(0);
  const manualPeakSemenRef = useRef<number>(0);
  const manualPeakAirRef = useRef<number>(0);
  const manualLogSavedRef = useRef<boolean>(false);

  // Ever-opened gates/buttons trackers during manual session
  const wasPasir1EverOpenedRef = useRef<boolean>(false);
  const wasPasir2EverOpenedRef = useRef<boolean>(false);
  const wasBatu1EverOpenedRef = useRef<boolean>(false);
  const wasBatu2EverOpenedRef = useRef<boolean>(false);

  const weighingCycleRef = useRef(1);
  const currentBatchRef = useRef<number>(0);
  const targetBatchRef = useRef<number>(0);
  const totalCyclesRef = useRef<number>(1);

  // Multi-batch cumulative actual trackers for consolidated printout tickets
  const semiAccumActualsRef = useRef<{
    pasir1: number;
    pasir2: number;
    batu1: number;
    batu2: number;
    semen: number;
    air: number;
    admix: number;
  }>({
    pasir1: 0,
    pasir2: 0,
    batu1: 0,
    batu2: 0,
    semen: 0,
    air: 0,
    admix: 0
  });

  // Semi-Auto timed mixer door phased discharge state
  const semiDoorDischargeActiveRef = useRef<boolean>(false);
  const semiDoorDischargeTimerRef = useRef<number>(0);

  const weighingJogStatesRef = useRef<Record<string, { phase: 'fast' | 'jeda' | 'jog_on' | 'jog_off' | 'done'; timer: number; pulseCount: number; }>>({
    pasir1: { phase: 'fast', timer: 0, pulseCount: 0 },
    pasir2: { phase: 'fast', timer: 0, pulseCount: 0 },
    batu1: { phase: 'fast', timer: 0, pulseCount: 0 },
    batu2: { phase: 'fast', timer: 0, pulseCount: 0 },
    semen: { phase: 'fast', timer: 0, pulseCount: 0 },
    air: { phase: 'fast', timer: 0, pulseCount: 0 }
  });

  const hopperDischargeStatesRef = useRef<Record<string, { phase: 'waiting' | 'opening' | 'draining' | 'clearing' | 'closing' | 'done'; timer: number; }>>({
    pasir: { phase: 'waiting', timer: 0 },
    batu: { phase: 'waiting', timer: 0 },
    semen: { phase: 'waiting', timer: 0 },
    air: { phase: 'waiting', timer: 0 }
  });

  const getJoggingSettings = () => {
    const DEFAULT_JOGING_DATA = [
      { material: "Pasir 1", targetPercent: 90, jeda: 1.5, onTime: 0.5, offTime: 1.2, tolerance: 10 },
      { material: "Pasir 2", targetPercent: 90, jeda: 1.5, onTime: 0.5, offTime: 1.2, tolerance: 10 },
      { material: "Batu 1", targetPercent: 92, jeda: 1.5, onTime: 0.4, offTime: 1.3, tolerance: 12 },
      { material: "Batu 2", targetPercent: 92, jeda: 1.5, onTime: 0.4, offTime: 1.3, tolerance: 12 },
      { material: "Semen", targetPercent: 95, jeda: 2.0, onTime: 0.3, offTime: 1.5, tolerance: 5 },
      { material: "Air", targetPercent: 96, jeda: 1.0, onTime: 0.2, offTime: 1.0, tolerance: 2 }
    ];
    const saved = localStorage.getItem("batching_plant_joging_settings");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_JOGING_DATA;
      }
    }
    return DEFAULT_JOGING_DATA;
  };

  const isJoggingActive = (config: any) => {
    if (!config) return false;
    const target = parseFloat(config.targetPercent) || 0;
    const jeda = parseFloat(config.jeda) || 0;
    const onTime = parseFloat(config.onTime || config.onPulse) || 0;
    const offTime = parseFloat(config.offTime || config.offDelay) || 0;
    const tolerance = parseFloat(config.tolerance) || 0;
    return target > 0 || jeda > 0 || onTime > 0 || offTime > 0 || tolerance > 0;
  };

  useEffect(() => {
    mixingSequenceRef.current = mixingSequence;
  }, [mixingSequence]);

  // Play a realistic heavy buzzer horn using Web Audio synth
  const playKlakson = (durationMs = 1200) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(175, audioCtx.currentTime); // heavy buzz frequency
      osc.frequency.linearRampToValueAtTime(145, audioCtx.currentTime + durationMs / 1000);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(750, audioCtx.currentTime);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + durationMs / 1000);
      
      osc.start();
      setKlaksonActive(true);
      
      setTimeout(() => {
        try {
          osc.stop();
          audioCtx.close();
        } catch (_) {}
        setKlaksonActive(false);
      }, durationMs);
    } catch (e) {
      console.warn("Buzzer audio issue: ", e);
    }
  };

  // Silo filling simulation states
  const [activeFillingSiloIdx, setActiveFillingSiloIdx] = useState<number | null>(null);
  const [fillingProgress, setFillingProgress] = useState<number>(0); // 0 to 100 %
  const fillingIntervalRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (fillingIntervalRef.current) clearInterval(fillingIntervalRef.current);
    };
  }, []);

  const startFillSilo = (siloIdx: number, amountKg: number) => {
    if (siloIdx < 0 || siloIdx >= 6) return;
    
    const start = siloWeights[siloIdx];
    
    if (start >= 120000) {
      setCustomAlertMessage("Silo sudah penuh (Kapasitas Maksimal 120.000 kg)");
      return;
    }

    if (start + amountKg > 120000) {
      setCustomAlertMessage("Silo belum mampu menampung jumlah semen tersebut, silakan tunggu sampai kapasitas tampung memadai");
      return;
    }

    const target = start + amountKg;

    setIsFillSiloOpen(false);
    setActiveFillingSiloIdx(siloIdx);
    setFillingProgress(0);

    // Create start log
    setRelayLogs(l => [{
      id: 'FILL-START-' + Math.random().toString(36).substring(7).toUpperCase(),
      timestamp: new Date(),
      message: `[SILO] Memulai pengisian Silo ${siloIdx + 1} sebesar ${amountKg.toLocaleString('id-ID')} kg...`,
      type: 'info'
    }, ...l]);

    let current = start;
    const step = Math.max(10, Math.ceil((target - start) / 50)); // divide into 50 steps
    
    if (fillingIntervalRef.current) clearInterval(fillingIntervalRef.current);
    
    fillingIntervalRef.current = setInterval(() => {
      current = Math.min(target, current + step);
      
      setSiloWeights(prev => {
        const next = [...prev];
        next[siloIdx] = current;
        return next;
      });

      const prog = Math.round(((current - start) / (target - start)) * 100);
      setFillingProgress(prog);

      if (current >= target) {
        clearInterval(fillingIntervalRef.current);
        fillingIntervalRef.current = null;
        setActiveFillingSiloIdx(null);
        
        // Save completed log
        setRelayLogs(l => [{
          id: 'FILL-DONE-' + Math.random().toString(36).substring(7).toUpperCase(),
          timestamp: new Date(),
          message: `[SILO] Pengisian Silo ${siloIdx + 1} SELESAI. Berat akhir: ${target.toLocaleString('id-ID')} kg.`,
          type: 'done'
        }, ...l]);
      }
    }, 60);
  };

  const startBatch = (config: {
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
  }) => {
    if (isRunning) return;

    // Safety checks: Block batching if compressor air pressure is below safety threshold
    if (pressureLimitEnabled && airPressure < minAirPressure) {
      setAlarmMessage(`BATCHING PROSES DIBATALKAN: Tekanan angin kompresor (${airPressure.toFixed(1)} PSI) di bawah batas minimum yang diatur (${minAirPressure.toFixed(1)} PSI)! Tunggu hingga angin cukup.`);
      return;
    }

    // Safety checks: Block batching if any pin configuration is empty!
    const currentConfig = loadRelayConfig();
    const hasEmptyPins = currentConfig.some(row => !row.arduinoPin || row.arduinoPin.trim() === "");
    if (hasEmptyPins) {
      setAlarmMessage("BATCHING PROSES DIBATALKAN: Beberapa pintu/relay memiliki Pin Arduino yang KOSONG! Lengkapi konfigurasi pin.");
      return;
    }

    // Save batch details
    setSelectedRecipe(config.recipe);
    setActiveVolume(config.volume);
    setActiveMixingCount(config.mixingCycles);
    setActiveSlump(config.slump);
    setActiveSiloSemen(config.siloSemen);
    setActiveMixingTime(config.mixingTime);
    setActivePelanggan(config.pelanggan || "");
    setActiveLokasi(config.lokasi || "");
    setActiveNoKendaraan(config.noKendaraan || "");
    setActiveSopir(config.sopir || "");

    // Compute cycle mathematics
    const totalC = config.mixingCycles || 1;
    setTotalCycles(totalC);
    totalCyclesRef.current = totalC;

    const vPerCycle = parseFloat((config.volume / totalC).toFixed(2));
    setVolumePerBatch(vPerCycle);
    volumePerBatchRef.current = vPerCycle;
    setVolumePerCycle(vPerCycle);

    // Dispatch to Production-Grade .NET 10 & Siemens S7-1200 Backend
    dotNetBackendService.startBatch({
      recipeId: config.recipe.id,
      orderedVolume: config.volume,
      cycles: totalC,
      operatorName: (activeOperator as any)?.name || "OPERATOR",
      pelanggan: config.pelanggan || "",
      lokasi: config.lokasi || "",
      noKendaraan: config.noKendaraan || "",
      sopir: config.sopir || "",
      slumpTarget: parseFloat(config.slump) || 12,
      moistureSand1Pct: pasirMoisture || 0,
      moistureSand2Pct: 0
    }).catch(err => {
      console.warn("DotNetBackendService startBatch notice:", err);
    });

    if (batchingMode === 'MANUAL') {
      // Manual Production Recording Module Isolation
      setIsRunning(true);
      setIsDone(false);
      setIsPaused(false);
      isPausedRef.current = false;
      setProductionState('STARTING');
      setMixerStatusText('PRODUKSI BERJALAN (MANUAL)');
      setCurrentBatch(0);
      currentBatchRef.current = 0;
      setTargetBatch(totalC);
      targetBatchRef.current = totalC;
      setMixerShaftActive(true);
      setMixerStateSync('waiting');
      aggregateTransitQueueRef.current = [];
      aggregateInMixerRef.current = 0;
      semenInMixerRef.current = 0;
      waterInMixerRef.current = 0;
      setConcreteDischargeActive(false);
      setMixerDoorPercent(0);
      setMixerDoorStateText("CLOSED");
      setDischargeTimeSec(0);

      // Configure targets and reset actuals on scales for manual mode HMI indicators
      const initialScales: Record<MaterialType, ScaleData> = {} as any;
      (Object.keys(INITIAL_SCALES) as MaterialType[]).forEach(k => {
        let targetWeight = Math.round(config.recipe.targets[k] * vPerCycle);
        if (moistureControl) {
          if (k === 'pasir') {
            targetWeight = Math.round(targetWeight * (1 + pasirMoisture / 100));
          } else if (k === 'batu') {
            targetWeight = Math.round(targetWeight * (1 + batuMoisture / 100));
          } else if (k === 'air') {
            targetWeight = Math.round(targetWeight * (1 + airAdjustment / 100));
          }
        }
        initialScales[k] = { 
          id: k, 
          label: INITIAL_SCALES[k].label, 
          actual: 0, 
          target: targetWeight, 
          unit: INITIAL_SCALES[k].unit, 
          isActive: false, 
          isComplete: false 
        };
      });
      setScales(initialScales);
      prevScalesRef.current = initialScales;

      // Reset manual cumulative dispensed material trackers
      manualPasir1Ref.current = 0;
      manualPasir2Ref.current = 0;
      manualBatu1Ref.current = 0;
      manualBatu2Ref.current = 0;
      manualSemenRef.current = 0;
      manualAirRef.current = 0;

      // Reset peaks and saved guard
      manualPeakPasirRef.current = 0;
      manualPeakBatuRef.current = 0;
      manualPeakSemenRef.current = 0;
      manualPeakAirRef.current = 0;
      manualLogSavedRef.current = false;
      semiAccumActualsRef.current = {
        pasir1: 0,
        pasir2: 0,
        batu1: 0,
        batu2: 0,
        semen: 0,
        air: 0,
        admix: 0
      };
      wasPasir1EverOpenedRef.current = false;
      wasPasir2EverOpenedRef.current = false;
      wasBatu1EverOpenedRef.current = false;
      wasBatu2EverOpenedRef.current = false;

      const generatedId = `BP-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}-${Math.round(Math.random()*8999 + 1000)}`;
      setBatchId(generatedId);

      const timeStr = new Date().toLocaleTimeString('id-ID');
      setManualStartTime(timeStr);
      localStorage.setItem('hmi_manual_start_time', timeStr);

      manualGateOpenTimeMsRef.current = 0;
      isManualGateOpenTimeValidRef.current = false;
      manualGateSequenceStateRef.current = 'IDLE';

      setRelayLogs([
        {
          id: 'START-MANUAL-' + Math.random().toString(36).substring(7).toUpperCase(),
          timestamp: new Date(),
          message: "SESI PRODUKSI MANUAL DIMULAI",
          type: 'info'
        }
      ]);

      playKlakson(1200); // Sound start horn
      return;
    }

    if (batchingMode === 'SEMI_AUTO') {
      setIsRunning(true);
      setIsDone(false);
      setIsPaused(false);
      isPausedRef.current = false;
      setProductionState('STARTING');
      setMixerStatusText('PRODUKSI BERJALAN (SEMI-OTOMATIS)');
      setCurrentBatch(0);
      currentBatchRef.current = 0;
      setTargetBatch(totalC);
      targetBatchRef.current = totalC;
      setMixerShaftActive(true);
      setConveyorUpperActiveSync(true);
      setMixerStateSync('waiting');
      aggregateTransitQueueRef.current = [];
      aggregateInMixerRef.current = 0;
      semenInMixerRef.current = 0;
      waterInMixerRef.current = 0;
      setConcreteDischargeActive(false);
      setMixerDoorPercent(0);
      setMixerDoorStateText("CLOSED");
      setDischargeTimeSec(0);

      // Configure targets and reset actuals on scales for semi-auto mode HMI indicators
      const initialScales: Record<MaterialType, ScaleData> = {} as any;
      (Object.keys(INITIAL_SCALES) as MaterialType[]).forEach(k => {
        let targetWeight = Math.round(config.recipe.targets[k] * vPerCycle);
        if (moistureControl) {
          if (k === 'pasir') {
            targetWeight = Math.round(targetWeight * (1 + pasirMoisture / 100));
          } else if (k === 'batu') {
            targetWeight = Math.round(targetWeight * (1 + batuMoisture / 100));
          } else if (k === 'air') {
            targetWeight = Math.round(targetWeight * (1 + airAdjustment / 100));
          }
        }
        initialScales[k] = { 
          id: k, 
          label: INITIAL_SCALES[k].label, 
          actual: 0, 
          target: targetWeight, 
          unit: INITIAL_SCALES[k].unit, 
          isActive: false, 
          isComplete: false 
        };
      });
      setScales(initialScales);
      prevScalesRef.current = initialScales;

      // Reset cumulative actual trackers for consolidated print ticket
      semiAccumActualsRef.current = {
        pasir1: 0,
        pasir2: 0,
        batu1: 0,
        batu2: 0,
        semen: 0,
        air: 0,
        admix: 0
      };

      setSemiAutoDosing({
        pasir1: false,
        pasir2: false,
        batu1: false,
        batu2: false,
        semen: false,
        air: false,
        admix: false
      });

      weighingJogStatesRef.current = {
        pasir1: { phase: 'fast', timer: 0, pulseCount: 0 },
        pasir2: { phase: 'fast', timer: 0, pulseCount: 0 },
        batu1: { phase: 'fast', timer: 0, pulseCount: 0 },
        batu2: { phase: 'fast', timer: 0, pulseCount: 0 },
        semen: { phase: 'fast', timer: 0, pulseCount: 0 },
        air: { phase: 'fast', timer: 0, pulseCount: 0 }
      };

      setAdmixActual(0);
      admixActualRef.current = 0;
      semiDoorDischargeActiveRef.current = false;
      semiDoorDischargeTimerRef.current = 0;
      manualLogSavedRef.current = false;

      const generatedId = `BP-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}-${Math.round(Math.random()*8999 + 1000)}`;
      setBatchId(generatedId);

      const timeStr = new Date().toLocaleTimeString('id-ID');
      setManualStartTime(timeStr);
      setAutoStartTime(timeStr);

      setRelayLogs([
        {
          id: 'START-SEMI-' + Math.random().toString(36).substring(7).toUpperCase(),
          timestamp: new Date(),
          message: `SESI PRODUKSI SEMI-OTOMATIS DIMULAI (Target: ${config.volume} m³, ${totalC} Mixing)`,
          type: 'info'
        }
      ]);

      playKlakson(1200);
      return;
    }

    const timeStr = new Date().toLocaleTimeString('id-ID');
    setAutoStartTime(timeStr);

    setCurrentCycle(1);
    setWeighingCycle(1);
    weighingCycleRef.current = 1;

    setCurrentBatch(0);
    currentBatchRef.current = 0;
    setTargetBatch(totalC);
    targetBatchRef.current = totalC;

    // Initial batch ID
    const generatedId = `BP-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}-${Math.round(Math.random()*8999 + 1000)}`;
    setBatchId(generatedId);

    // Initialize parallel batch queue
    const initialQueue = Array.from({ length: totalC }).map((_, idx) => {
      const bNum = idx + 1;
      return {
        batchNo: bNum,
        status: bNum === 1 ? 'WEIGHING' : 'QUEUED',
        
        pasirActual: 0,
        pasirTarget: Math.round(config.recipe.targets.pasir * vPerCycle),
        pasirWeighed: false,
        pasirDischarged: false,

        batuActual: 0,
        batuTarget: Math.round(config.recipe.targets.batu * vPerCycle),
        batuWeighed: false,
        batuDischarged: false,

        semenActual: 0,
        semenTarget: Math.round(config.recipe.targets.semen * vPerCycle),
        semenWeighed: false,
        semenDischarged: false,

        airActual: 0,
        airTarget: Math.round(config.recipe.targets.air * vPerCycle),
        airWeighed: false,
        airDischarged: false,
      };
    });
    setBatchQueue(initialQueue);
    batchQueueRef.current = initialQueue;
    currentBatchNoRef.current = 1;
    weighingCycleRef.current = 1;

    // Reset actual weight tracking refs for starting batch
    actualPasir1Ref.current = 0;
    actualPasir2Ref.current = 0;
    actualBatu1Ref.current = 0;
    actualBatu2Ref.current = 0;
    actualSemenRef.current = 0;
    actualAirRef.current = 0;

    // Reset running total accumulator refs across all mixing cycles
    accumPasir1Ref.current = 0;
    accumPasir2Ref.current = 0;
    accumBatu1Ref.current = 0;
    accumBatu2Ref.current = 0;
    accumSemenRef.current = 0;
    accumAirRef.current = 0;

    weighedBatchNosRef.current = {
      pasir: 1,
      batu: 1,
      semen: 1,
      air: 1
    };

    // Initial scale targets proportional to vPerCycle
    const initialScales = { ...INITIAL_SCALES };
    (Object.keys(INITIAL_SCALES) as MaterialType[]).forEach(k => {
      let targetWeight = Math.round(config.recipe.targets[k] * vPerCycle);
      if (moistureControl) {
        if (k === 'pasir') {
          targetWeight = Math.round(targetWeight * (1 + pasirMoisture / 100));
        } else if (k === 'batu') {
          targetWeight = Math.round(targetWeight * (1 + batuMoisture / 100));
        } else if (k === 'air') {
          targetWeight = Math.round(targetWeight * (1 + airAdjustment / 100));
        }
      }
      initialScales[k] = { 
        id: k, 
        label: INITIAL_SCALES[k].label, 
        actual: 0, 
        target: targetWeight, 
        unit: INITIAL_SCALES[k].unit, 
        isActive: false, 
        isComplete: false 
      };
    });
    setScales(initialScales);

    // Reset machine state refs
    weighingActiveRef.current = true;
    aggregateReadyLoggedRef.current = false;
    aggregateDischargeLoggedRef.current = false;
    conveyorTransferStartLoggedRef.current = false;
    conveyorTransferCompleteLoggedRef.current = false;
    setMixerStateSync('waiting');
    dischargeTimerMsRef.current = 0;
    mixingTimerMsRef.current = 0;
    doorStepRef.current = 1;
    doorTimerMsRef.current = 0;
    sandDischargeStartedRef.current = false;
    sandCompletedElapsedSecRef.current = null;

    // Reset Waiting Hopper state structure & early draining protection refs
    pasirWeighedRef.current = false;
    batuWeighedRef.current = false;
    semenWeighedRef.current = false;
    airWeighedRef.current = false;
    setWaitingHopperStateSync('WAITING_HOPPER_IDLE');
    setWaitingHopperGateOpenSync(false);
    setWaitingHopperWeightSync(0);
    aggregateTransitQueueRef.current = [];
    aggregateInMixerRef.current = 0;
    semenInMixerRef.current = 0;
    waterInMixerRef.current = 0;
    waitingHopperTimerRef.current = 0;
    waitingHopperPrechargeTimerRef.current = 0;
    setConveyorBottomPhaseSync('STANDBY');
    conveyorBottomTimerRef.current = 0;

    // Reset machine state hooks
    setIsWeighingActive(true);
    setProductionState('STARTING');
    setMixerStatusText('STARTING CONVEYORS & MIXER');
    setMixerDoorPercent(0);
    setMixerDoorStateText("CLOSED");
    setDischargeTimeSec(0);
    setConcreteDischargeActive(false);
    setMixerShaftActive(true);
    setConveyorUpperActiveSync(true); // turn on main belt feeder immediately at start
    setBatchProgress(0);
    setMixerOccupied(false);

    // Sound start horn (1.2 seconds)
    playKlakson(1200);

    setIsRunning(true);
    setIsDone(false);
    setIsPaused(false);
    isPausedRef.current = false;
    
    // Reset weighing jog controller state tracking structures
    weighingJogStatesRef.current = {
      pasir1: { phase: 'fast', timer: 0, pulseCount: 0 },
      pasir2: { phase: 'fast', timer: 0, pulseCount: 0 },
      batu1: { phase: 'fast', timer: 0, pulseCount: 0 },
      batu2: { phase: 'fast', timer: 0, pulseCount: 0 },
      semen: { phase: 'fast', timer: 0, pulseCount: 0 },
      air: { phase: 'fast', timer: 0, pulseCount: 0 }
    };

    hopperDischargeStatesRef.current = {
      pasir: { phase: 'waiting', timer: 0 },
      batu: { phase: 'waiting', timer: 0 },
      semen: { phase: 'waiting', timer: 0 },
      air: { phase: 'waiting', timer: 0 }
    };

    // Clear relay activities logs for a fresh batching production run and log initial sequences
    setRelayLogs([
      {
        id: 'START-' + Math.random().toString(36).substring(7).toUpperCase(),
        timestamp: new Date(),
        message: "PRODUCTION START",
        type: 'info'
      },
      {
        id: 'TOP-ON-' + Math.random().toString(36).substring(7).toUpperCase(),
        timestamp: new Date(),
        message: "TOP CONVEYOR ON",
        type: 'info'
      }
    ]);
    setGatePasir1SiloOpen(false);
    setGatePasir2SiloOpen(false);
    setGateBatu1SiloOpen(false);
    setGateBatu2SiloOpen(false);
    setMixerDoor1OpenActive(false);
    setMixerDoor2OpenActive(false);
    setMixerDoor3OpenActive(false);
    setMixerDoorClosingActive(false);
  };

  const handleManualDeviceToggle = (deviceKey: string, valForce?: boolean) => {
    if (isAuto) return;
    dotNetBackendService.manualActuator(deviceKey, valForce ?? true).catch(() => {});

    if (batchingModeRef.current === 'SEMI_AUTO') {
      let targetMaterial = '';
      if (deviceKey === 'pasir1') targetMaterial = 'pasir1';
      else if (deviceKey === 'pasir2') targetMaterial = 'pasir2';
      else if (deviceKey === 'batu1') targetMaterial = 'batu1';
      else if (deviceKey === 'batu2') targetMaterial = 'batu2';
      else if (deviceKey === 'silo1' || deviceKey === 'silo2' || deviceKey === 'silo3' || deviceKey === 'silo4' || deviceKey === 'silo5' || deviceKey === 'silo6') {
        targetMaterial = 'semen';
      }
      else if (deviceKey === 'valveIsiAir') targetMaterial = 'air';
      else if (deviceKey === 'admixIn') targetMaterial = 'admix';

      if (targetMaterial) {
        if (semiAutoDosingRef.current[targetMaterial]) {
          setSemiAutoDosing(prev => {
            const next = { ...prev, [targetMaterial]: false };
            const anyRemaining = Object.values(next).some(v => v);
            if (!anyRemaining) {
              weighingActiveRef.current = false;
              setIsWeighingActive(false);
            }
            return next;
          });

          if (targetMaterial === 'pasir1') setGatePasir1SiloOpen(false);
          if (targetMaterial === 'pasir2') setGatePasir2SiloOpen(false);
          if (targetMaterial === 'batu1') setGateBatu1SiloOpen(false);
          if (targetMaterial === 'batu2') setGateBatu2SiloOpen(false);
          if (targetMaterial === 'semen') setScrewSemenActive(false);
          if (targetMaterial === 'air') setValveWaterActive(false);
          if (targetMaterial === 'admix') setAdmixInActive(false);

          weighingJogStatesRef.current[targetMaterial].phase = 'done';

          setRelayLogs(prev => [
            {
              id: 'SEMI-CANCEL-' + Math.random().toString(36).substring(7).toUpperCase(),
              timestamp: new Date(),
              message: `[SEMI AUTO] Dosing ${targetMaterial.toUpperCase()} DIMATIKAN oleh operator!`,
              type: 'off'
            },
            ...prev
          ]);
          return;
        }

        if (!selectedRecipe) {
          setAlarmMessage("SEMI AUTO GAGAL: Tidak ada Job Mix formula aktif yang dipilih!");
          return;
        }

        if (operationModeRef.current !== 'SIMULASI' && webSerialService.getStatus() === "DISCONNECTED") {
          setAlarmMessage("SEMI AUTO GAGAL: Koneksi Serial ke panel terputus / tidak tersedia!");
          return;
        }

        let targetValue = 0;
        const savedJmf = selectedRecipe.jobMixDetails;
        if (targetMaterial === 'pasir1') {
          targetValue = savedJmf?.pasir1 || Math.round((selectedRecipe.targets.pasir || 400) * 0.7);
        } else if (targetMaterial === 'pasir2') {
          targetValue = savedJmf?.pasir2 || Math.round((selectedRecipe.targets.pasir || 400) * 0.3);
        } else if (targetMaterial === 'batu1') {
          targetValue = savedJmf?.batu1 || Math.round((selectedRecipe.targets.batu || 400) * 0.7);
        } else if (targetMaterial === 'batu2') {
          targetValue = savedJmf?.batu2 || Math.round((selectedRecipe.targets.batu || 400) * 0.3);
        } else if (targetMaterial === 'semen') {
          targetValue = selectedRecipe.targets.semen || savedJmf?.semen || 300;
        } else if (targetMaterial === 'air') {
          targetValue = selectedRecipe.targets.air || savedJmf?.air || 150;
        } else if (targetMaterial === 'admix') {
          targetValue = savedJmf?.additive || 2.0;
        }

        const tFactor = parseFloat((activeVolume / totalCyclesRef.current).toFixed(2)) || 1.0;
        const adjustedTarget = Math.round(targetValue * tFactor);

        if (adjustedTarget <= 0) {
          setAlarmMessage(`SEMI AUTO GAGAL: Target untuk ${targetMaterial.toUpperCase()} tidak valid / bernilai 0!`);
          return;
        }

        setRelayLogs(prev => [
          {
            id: 'SEMI-START-' + Math.random().toString(36).substring(7).toUpperCase(),
            timestamp: new Date(),
            message: `[SEMI AUTO] Memulai penimbangan ${targetMaterial.toUpperCase()}. Target JMF: ${targetValue} kg, disesuaikan volume: ${adjustedTarget} kg.`,
            type: 'on'
          },
          ...prev
        ]);

        setSemiAutoDosing(prev => ({ ...prev, [targetMaterial]: true }));

        setScalesSync(prev => {
          const next = { ...prev };
          const scaleKey = (targetMaterial === 'pasir1' || targetMaterial === 'pasir2') ? 'pasir' :
                            (targetMaterial === 'batu1' || targetMaterial === 'batu2') ? 'batu' :
                            targetMaterial === 'semen' ? 'semen' :
                            targetMaterial === 'air' ? 'air' : null;
          if (scaleKey) {
            const currentActual = next[scaleKey].actual || 0;
            let scaleTarget = adjustedTarget;
            if (scaleKey === 'pasir') {
              const recPasirTotal = (selectedRecipe.targets.pasir || 400);
              scaleTarget = Math.round(recPasirTotal * tFactor);
            } else if (scaleKey === 'batu') {
              const recBatuTotal = (selectedRecipe.targets.batu || 400);
              scaleTarget = Math.round(recBatuTotal * tFactor);
            }

            next[scaleKey].actual = currentActual >= scaleTarget ? 0 : currentActual;
            next[scaleKey].target = scaleTarget;
            next[scaleKey].isComplete = next[scaleKey].actual >= scaleTarget;
            next[scaleKey].isActive = true;
          }
          return next;
        });

        if (targetMaterial === 'admix') {
          setAdmixActual(0);
          setAdmixInActive(true);
        }

        weighingJogStatesRef.current[targetMaterial] = { phase: 'fast', timer: 0, pulseCount: 0 };

        weighingActiveRef.current = true;
        setIsWeighingActive(true);
        return;
      }
    }

    const createManualRelayLog = (name: string, act: boolean) => {
      const actionText = act ? 'ON' : 'OFF';
      const eventId = 'MANUAL-' + Math.random().toString(36).substring(7).toUpperCase();
      setRelayLogs(prev => [
        {
          id: eventId,
          timestamp: new Date(),
          message: `[MANUAL] ${name.toUpperCase()} (${actionText})`,
          type: act ? 'on' : 'off'
        },
        ...prev.slice(0, 48)
      ]);
    };

    switch (deviceKey) {
      case 'pasir1': {
        const nextVal = valForce !== undefined ? valForce : !gatePasir1SiloOpen;
        if (nextVal === gatePasir1SiloOpen) break;
        setGatePasir1SiloOpen(nextVal);
        createManualRelayLog('Pintu Pasir 1', nextVal);
        break;
      }
      case 'pasir2': {
        const nextVal = valForce !== undefined ? valForce : !gatePasir2SiloOpen;
        if (nextVal === gatePasir2SiloOpen) break;
        setGatePasir2SiloOpen(nextVal);
        createManualRelayLog('Pintu Pasir 2', nextVal);
        break;
      }
      case 'batu1': {
        const nextVal = valForce !== undefined ? valForce : !gateBatu1SiloOpen;
        if (nextVal === gateBatu1SiloOpen) break;
        setGateBatu1SiloOpen(nextVal);
        createManualRelayLog('Pintu Batu 1', nextVal);
        break;
      }
      case 'batu2': {
        const nextVal = valForce !== undefined ? valForce : !gateBatu2SiloOpen;
        if (nextVal === gateBatu2SiloOpen) break;
        setGateBatu2SiloOpen(nextVal);
        createManualRelayLog('Pintu Batu 2', nextVal);
        break;
      }
      case 'silo1':
      case 'silo2':
      case 'silo3':
      case 'silo4':
      case 'silo5':
      case 'silo6': {
        const nextVal = valForce !== undefined ? valForce : !screwSemenActive;
        if (nextVal === screwSemenActive) break;
        setScrewSemenActive(nextVal);
        createManualRelayLog(`Screw Semen (${activeSiloSemen})`, nextVal);
        break;
      }
      case 'selectSilo': {
        const num = valForce as any;
        const targetSiloName = `Silo ${num}`;
        if (activeSiloSemen === targetSiloName) break;
        setActiveSiloSemen(targetSiloName);
        const eventId = 'MANUAL-SILO-' + Math.random().toString(36).substring(7).toUpperCase();
        setRelayLogs(prev => [
          {
            id: eventId,
            timestamp: new Date(),
            message: `[MANUAL] PILIH SEMEN SILO -> SILO ${num}`,
            type: 'info'
          },
          ...prev.slice(0, 48)
        ]);
        break;
      }
      case 'valveIsiAir': {
        const nextVal = valForce !== undefined ? valForce : !valveWaterActive;
        if (nextVal === valveWaterActive) break;
        setValveWaterActive(nextVal);
        createManualRelayLog('Valve Water Inlet', nextVal);
        break;
      }
      case 'dischargeAir': {
        const nextVal = valForce !== undefined ? valForce : !gateWaterHopperOpen;
        if (nextVal === gateWaterHopperOpen) break;
        setGateWaterHopperOpenSync(nextVal);
        createManualRelayLog('Valve Discharge Air', nextVal);
        break;
      }
      case 'dischargeSemen': {
        const nextVal = valForce !== undefined ? valForce : !gateSemenHopperOpen;
        if (nextVal === gateSemenHopperOpen) break;
        setGateSemenHopperOpenSync(nextVal);
        createManualRelayLog('Valve Discharge Semen', nextVal);
        break;
      }
      case 'dischargePasir': {
        const nextVal = valForce !== undefined ? valForce : !gatePasirHopperOpen;
        if (nextVal === gatePasirHopperOpen) break;
        setGatePasirHopperOpenSync(nextVal);
        createManualRelayLog('Pintu Buangan Pasir', nextVal);
        break;
      }
      case 'dischargeBatu': {
        const nextVal = valForce !== undefined ? valForce : !gateBatuHopperOpen;
        if (nextVal === gateBatuHopperOpen) break;
        setGateBatuHopperOpenSync(nextVal);
        createManualRelayLog('Pintu Buangan Batu', nextVal);
        break;
      }
      case 'conveyorBottom': {
        const nextVal = valForce !== undefined ? valForce : !conveyorBottomActive;
        if (nextVal === conveyorBottomActive) break;
        setConveyorBottomActiveSync(nextVal);
        createManualRelayLog('Feeder Conveyor Bawah', nextVal);
        break;
      }
      case 'conveyorUpper': {
        const nextVal = valForce !== undefined ? valForce : !conveyorUpperActive;
        if (nextVal === conveyorUpperActive) break;
        setConveyorUpperActiveSync(nextVal);
        createManualRelayLog('Inclined Conveyor Atas', nextVal);
        break;
      }
      case 'waitingHopperGate': {
        const nextVal = valForce !== undefined ? valForce : !waitingHopperGateOpen;
        if (nextVal === waitingHopperGateOpen) break;
        setWaitingHopperGateOpenSync(nextVal);
        createManualRelayLog('Waiting Hopper Gate', nextVal);
        break;
      }
      case 'mixerDischargeGate': {
        if (batchingModeRef.current === 'SEMI_AUTO') {
          const isCurrentlyOpenOrActive = semiDoorDischargeActiveRef.current || (mixerDoorPercent > 0);
          const shouldOpen = valForce !== undefined ? valForce : !isCurrentlyOpenOrActive;

          if (!shouldOpen) {
            semiDoorDischargeActiveRef.current = false;
            semiDoorDischargeTimerRef.current = 0;
            setMixerDoorPercent(0);
            setMixerDoorStateText("CLOSED");
            setConcreteDischargeActive(false);
            setMixerDoor1OpenActive(false);
            setMixerDoor2OpenActive(false);
            setMixerDoor3OpenActive(false);
            setMixerDoorClosingActive(true);
            setTimeout(() => {
              setMixerDoorClosingActive(false);
            }, 1500);
            createManualRelayLog('Pintu Mixer Discharge (SEMI TUTUP/BATAL)', false);
            break;
          }

          // Trigger timed phased opening sequence (identical to auto)
          semiDoorDischargeActiveRef.current = true;
          semiDoorDischargeTimerRef.current = 0;
          setConcreteDischargeActive(true);
          createManualRelayLog('Pintu Mixer Discharge (SEMI OTOMATIS BERTAHAP)', true);
          break;
        }

        const nextVal = valForce !== undefined ? valForce : !(mixerDoorPercent > 0);
        const isCurrentlyOpen = mixerDoorPercent > 0;
        if (nextVal === isCurrentlyOpen) break;
        if (nextVal) {
          setMixerDoorPercent(100);
          setMixerDoorStateText("OPENED");
          setConcreteDischargeActive(true);
          setMixerDoor1OpenActive(true);
          setMixerDoor2OpenActive(true);
          setMixerDoor3OpenActive(true);
          setMixerDoorClosingActive(false);
        } else {
          setMixerDoorPercent(0);
          setMixerDoorStateText("CLOSED");
          setConcreteDischargeActive(false);
          setMixerDoor1OpenActive(false);
          setMixerDoor2OpenActive(false);
          setMixerDoor3OpenActive(false);
          setMixerDoorClosingActive(true);
          setTimeout(() => {
            setMixerDoorClosingActive(false);
          }, 1500);
        }
        createManualRelayLog('Pintu Mixer Discharge', nextVal);
        break;
      }
      case 'compressor': {
        const nextVal = valForce !== undefined ? valForce : !compressorActive;
        if (nextVal === compressorActive) break;
        setCompressorActive(nextVal);
        createManualRelayLog('Kompresor Angin', nextVal);
        break;
      }
      case 'vibrator': {
        const nextVal = valForce !== undefined ? valForce : !vibratorActive;
        if (nextVal === vibratorActive) break;
        setVibratorActive(nextVal);
        createManualRelayLog('Vibrator Hopper', nextVal);
        break;
      }
      case 'klakson': {
        const nextVal = valForce !== undefined ? valForce : !klaksonActive;
        if (nextVal === klaksonActive) break;
        setKlaksonActive(nextVal);
        createManualRelayLog('Klakson Warning', nextVal);
        break;
      }
      case 'mixer': {
        const nextVal = valForce !== undefined ? valForce : !mixerShaftActive;
        if (nextVal === mixerShaftActive) break;
        setMixerShaftActive(nextVal);
        createManualRelayLog('Motor Mixer', nextVal);
        break;
      }
      case 'admixIn': {
        const nextVal = valForce !== undefined ? valForce : !admixInActive;
        if (nextVal === admixInActive) break;
        setAdmixInActive(nextVal);
        createManualRelayLog('Admix In Let', nextVal);
        break;
      }
      case 'admixOut': {
        const nextVal = valForce !== undefined ? valForce : !admixOutActive;
        if (nextVal === admixOutActive) break;
        setAdmixOutActive(nextVal);
        createManualRelayLog('Admix Out Let', nextVal);
        break;
      }
    }
  };

  const stopBatch = () => {
    dotNetBackendService.stopBatch().catch(() => {});
    const wasManual = isRunning && !isAuto;
    if (wasManual) {
      saveManualLog();
    }

    setIsRunning(false);
    setIsPaused(false);
    isPausedRef.current = false;
    setProductionState(wasManual ? 'COMPLETE' : 'IDLE');
    if (wasManual) {
      setMixerStatusText('PRODUKSI MANUAL SELESAI');
    }
    setIsWeighingActive(false);
    
    // Shut off actuators
    setGatePasirSiloOpen(false);
    setGatePasir1SiloOpen(false);
    setGatePasir2SiloOpen(false);
    setGateBatuSiloOpen(false);
    setGateBatu1SiloOpen(false);
    setGateBatu2SiloOpen(false);
    setMixerDoor1OpenActive(false);
    setMixerDoor2OpenActive(false);
    setMixerDoor3OpenActive(false);
    setMixerDoorClosingActive(false);
    setScrewSemenActive(false);
    setValveWaterActive(false);
    setGatePasirHopperOpenSync(false);
    setGateBatuHopperOpenSync(false);
    setGateSemenHopperOpenSync(false);
    setGateWaterHopperOpenSync(false);
    setConveyorBottomActiveSync(false);
    setConveyorUpperActiveSync(false);
    setConveyorBottomPhaseSync('STANDBY');
    conveyorBottomTimerRef.current = 0;
    setWaitingHopperGateOpenSync(false);
    setWaitingHopperStateSync('WAITING_HOPPER_IDLE');
    setWaitingHopperWeightSync(0);
    aggregateTransitQueueRef.current = [];
    aggregateInMixerRef.current = 0;
    semenInMixerRef.current = 0;
    waterInMixerRef.current = 0;
    semiDoorDischargeActiveRef.current = false;
    semiDoorDischargeTimerRef.current = 0;
    setMixerShaftActive(false);
    setMixerStateSync('waiting');
    setMixerDoorPercent(0);
    setMixerDoorStateText("CLOSED");
    setDischargeTimeSec(0);
    setConcreteDischargeActive(false);

    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
  };

  const emergencyStop = () => {
    dotNetBackendService.abortBatch("EMERGENCY STOP PRESSED").catch(() => {});
    stopBatch();
    playKlakson(600);
    setLogs(prev => [{
      id: 'ERR-' + Math.random().toString(36).substring(7).toUpperCase(),
      timestamp: new Date(),
      recipeName: selectedRecipe?.name || 'SYSTEM STOP',
      data: { pasir: 0, batu: 0, semen: 0, air: 0 },
      status: 'gagal',
      volume: activeVolume,
      mixingCycles: activeMixingCount,
      slump: activeSlump,
      siloSemen: activeSiloSemen,
      mixingTime: activeMixingTime,
      pelanggan: activePelanggan,
      lokasi: activeLokasi,
      noKendaraan: activeNoKendaraan,
      sopir: activeSopir,
      quarryPasir1,
      quarryPasir2,
      quarryBatu1,
      quarryBatu2
    }, ...prev]);
  };

  const handleSemiAutoCycleComplete = () => {
    const nextB = currentBatchRef.current + 1;
    currentBatchRef.current = nextB;
    setCurrentBatch(nextB);

    const vPerBatch = volumePerBatchRef.current || volumePerBatch || 1.0;
    const tgtP1 = Math.round((selectedRecipe?.jobMixDetails?.pasir1 ?? ((selectedRecipe?.targets.pasir ?? 400) * 0.7)) * vPerBatch);
    const tgtP2 = Math.round((selectedRecipe?.jobMixDetails?.pasir2 ?? ((selectedRecipe?.targets.pasir ?? 400) * 0.3)) * vPerBatch);
    const tgtB1 = Math.round((selectedRecipe?.jobMixDetails?.batu1 ?? ((selectedRecipe?.targets.batu ?? 400) * 0.7)) * vPerBatch);
    const tgtB2 = Math.round((selectedRecipe?.jobMixDetails?.batu2 ?? ((selectedRecipe?.targets.batu ?? 400) * 0.3)) * vPerBatch);
    const tgtS = Math.round((selectedRecipe?.targets.semen ?? 300) * vPerBatch);
    const tgtA = Math.round((selectedRecipe?.targets.air ?? 150) * vPerBatch);

    // Grab actual values: preferentially from actual*Ref (recorded during dosing/discharge),
    // or scales.actual if still present, or fallback to target so it is never 0 for a finished batch.
    let p1 = actualPasir1Ref.current;
    let p2 = actualPasir2Ref.current;
    let b1 = actualBatu1Ref.current;
    let b2 = actualBatu2Ref.current;
    let curS = actualSemenRef.current;
    let curA = actualAirRef.current;

    const curP = Math.round(scales.pasir.actual);
    const curB = Math.round(scales.batu.actual);
    const curScaleS = Math.round(scales.semen.actual);
    const curScaleA = Math.round(scales.air.actual);

    if (p1 + p2 === 0 && curP > 0) {
      const recP1 = (selectedRecipe as any).pasir1 !== undefined ? (selectedRecipe as any).pasir1 : Math.round((selectedRecipe?.targets.pasir ?? 400) * 0.7);
      const totRecP = (selectedRecipe?.targets.pasir ?? 450);
      p1 = totRecP > 0 ? Math.round(curP * (recP1 / totRecP)) : Math.round(curP * 0.7);
      p2 = Math.max(0, curP - p1);
    }
    if (b1 + b2 === 0 && curB > 0) {
      const recB1 = (selectedRecipe as any).batu1 !== undefined ? (selectedRecipe as any).batu1 : Math.round((selectedRecipe?.targets.batu ?? 400) * 0.7);
      const totRecB = (selectedRecipe?.targets.batu ?? 450);
      b1 = totRecB > 0 ? Math.round(curB * (recB1 / totRecB)) : Math.round(curB * 0.7);
      b2 = Math.max(0, curB - b1);
    }
    if (curS === 0 && curScaleS > 0) curS = curScaleS;
    if (curA === 0 && curScaleA > 0) curA = curScaleA;

    // Safety fallback: if batch completed its physical mixing & discharge cycle but actuals were 0 (e.g. simulated cycle or manual bypass):
    if (p1 === 0 && tgtP1 > 0) p1 = tgtP1;
    if (p2 === 0 && tgtP2 > 0) p2 = tgtP2;
    if (b1 === 0 && tgtB1 > 0) b1 = tgtB1;
    if (b2 === 0 && tgtB2 > 0) b2 = tgtB2;
    if (curS === 0 && tgtS > 0) curS = tgtS;
    if (curA === 0 && tgtA > 0) curA = tgtA;

    const curAdm = Math.round(admixActualRef.current * 10) / 10;

    semiAccumActualsRef.current.pasir1 += p1;
    semiAccumActualsRef.current.pasir2 += p2;
    semiAccumActualsRef.current.batu1 += b1;
    semiAccumActualsRef.current.batu2 += b2;
    semiAccumActualsRef.current.semen += curS;
    semiAccumActualsRef.current.air += curA;
    semiAccumActualsRef.current.admix += curAdm;

    // Catatan: Klakson hanya berbunyi saat SELURUH target batch selesai, bukan di antara batch

    setRelayLogs(prev => [
      {
        id: 'SEMI-CYC-COMP-' + Math.random().toString(36).substring(7).toUpperCase(),
        timestamp: new Date(),
        message: `[SEMI OTOMATIS] BATCH KE-${nextB} DARI ${targetBatchRef.current} SELESAI DISCHARGE.`,
        type: 'done'
      },
      ...prev
    ]);

    if (nextB < targetBatchRef.current) {
      // PREPARE NEXT BATCH CYCLE
      aggregateInMixerRef.current = 0;
      semenInMixerRef.current = 0;
      waterInMixerRef.current = 0;
      setWaitingHopperWeightSync(0);

      // Reset ref proteksi penimbangan agar timbangan tidak terkunci selesai pada batch berikutnya
      pasirWeighedRef.current = false;
      batuWeighedRef.current = false;
      semenWeighedRef.current = false;
      airWeighedRef.current = false;
      aggregateReadyLoggedRef.current = false;
      aggregateDischargeLoggedRef.current = false;
      conveyorTransferStartLoggedRef.current = false;
      conveyorTransferCompleteLoggedRef.current = false;

      actualPasir1Ref.current = 0;
      actualPasir2Ref.current = 0;
      actualBatu1Ref.current = 0;
      actualBatu2Ref.current = 0;
      actualSemenRef.current = 0;
      actualAirRef.current = 0;

      weighedBatchNosRef.current = {
        pasir: nextB + 1,
        batu: nextB + 1,
        semen: nextB + 1,
        air: nextB + 1
      };
      weighingCycleRef.current = nextB + 1;
      setWeighingCycle(nextB + 1);

      weighingActiveRef.current = true;
      setIsWeighingActive(true);
      setProductionState('WEIGHING');
      setMixerStateSync('waiting');
      setMixerOccupied(false);
      setDischargeTimeSec(0);
      setMixingCountdown(activeMixingTime);
      setMixingTime(0);

      // Reset scales to zero and re-enable for next cycle
      const vPerBatch = volumePerBatchRef.current || volumePerBatch || 1.0;
      setScalesSync(prev => {
        const next = { ...prev };
        (Object.keys(next) as MaterialType[]).forEach(k => {
          let tWeight = Math.round((selectedRecipe?.targets[k] || 400) * vPerBatch);
          if (moistureControl) {
            if (k === 'pasir') tWeight = Math.round(tWeight * (1 + pasirMoisture / 100));
            else if (k === 'batu') tWeight = Math.round(tWeight * (1 + batuMoisture / 100));
            else if (k === 'air') tWeight = Math.round(tWeight * (1 + airAdjustment / 100));
          }
          next[k] = { ...next[k], actual: 0, target: tWeight, isActive: false, isComplete: false };
        });
        return next;
      });

      setSemiAutoDosing({
        pasir1: false,
        pasir2: false,
        batu1: false,
        batu2: false,
        semen: false,
        air: false,
        admix: false
      });

      weighingJogStatesRef.current = {
        pasir1: { phase: 'fast', timer: 0, pulseCount: 0 },
        pasir2: { phase: 'fast', timer: 0, pulseCount: 0 },
        batu1: { phase: 'fast', timer: 0, pulseCount: 0 },
        batu2: { phase: 'fast', timer: 0, pulseCount: 0 },
        semen: { phase: 'fast', timer: 0, pulseCount: 0 },
        air: { phase: 'fast', timer: 0, pulseCount: 0 }
      };

      setAdmixActual(0);
      admixActualRef.current = 0;

      setMixerStatusText(`BATCH ${nextB} SELESAI. SILAKAN TIMBANG BATCH KE-${nextB + 1} DARI ${targetBatchRef.current}`);

      setRelayLogs(prev => [
        {
          id: 'SEMI-NEXT-' + Math.random().toString(36).substring(7).toUpperCase(),
          timestamp: new Date(),
          message: `[SEMI OTOMATIS] Timbangan direset untuk Batch ke-${nextB + 1}. Silakan lakukan penimbangan berikutnya.`,
          type: 'info'
        },
        ...prev
      ]);
    } else {
      // ALL BATCHES FINISHED!
      setIsRunning(false);
      setIsDone(true);
      setIsPaused(false);
      isPausedRef.current = false;
      setProductionState('COMPLETE');
      setMixerStatusText('PRODUKSI SEMI-OTOMATIS SELESAI');
      setBatchProgress(100);
      setMixerShaftActive(false);
      setConveyorUpperActiveSync(false);
      setConveyorBottomActiveSync(false);

      playKlakson(2000);

      // Build consolidated log for entire multi-batch production
      const completedBatch = nextB;
      const volPerMix = volumePerBatchRef.current || volumePerBatch || 0.1;
      const totalVol = parseFloat((completedBatch * volPerMix).toFixed(2));

      const startStr = manualStartTime || autoStartTime || new Date().toLocaleTimeString('id-ID');
      const endStr = new Date().toLocaleTimeString('id-ID');

      const targetPasir = Math.round((selectedRecipe?.targets.pasir ?? 450) * totalVol);
      const targetBatu = Math.round((selectedRecipe?.targets.batu ?? 450) * totalVol);
      const targetSemen = Math.round((selectedRecipe?.targets.semen ?? 400) * totalVol);
      const targetAir = Math.round((selectedRecipe?.targets.air ?? 180) * totalVol);

      const recP1 = (selectedRecipe as any).pasir1 !== undefined ? (selectedRecipe as any).pasir1 : Math.round((selectedRecipe?.targets.pasir ?? 400) * 0.7);
      const recB1 = (selectedRecipe as any).batu1 !== undefined ? (selectedRecipe as any).batu1 : Math.round((selectedRecipe?.targets.batu ?? 400) * 0.7);

      const targetPasir1 = Math.round(recP1 * totalVol);
      const targetPasir2 = Math.max(0, targetPasir - targetPasir1);
      const targetBatu1 = Math.round(recB1 * totalVol);
      const targetBatu2 = Math.max(0, targetBatu - targetBatu1);

      manualLogSavedRef.current = true;

      const consolidatedLog: BatchLog = {
        id: batchId || `BP-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}-${Math.round(Math.random()*8999 + 1000)}`,
        timestamp: new Date(),
        recipeName: selectedRecipe?.name || "K300 Standard",
        data: {
          pasir: targetPasir,
          batu: targetBatu,
          semen: targetSemen,
          air: targetAir
        },
        targets: {
          pasir1: Math.round(targetPasir1),
          pasir2: Math.round(targetPasir2),
          batu1: Math.round(targetBatu1),
          batu2: Math.round(targetBatu2),
          semen: Math.round(targetSemen),
          air: Math.round(targetAir)
        },
        actuals: {
          pasir1: Math.round(semiAccumActualsRef.current.pasir1 || targetPasir1),
          pasir2: Math.round(semiAccumActualsRef.current.pasir2 || targetPasir2),
          batu1: Math.round(semiAccumActualsRef.current.batu1 || targetBatu1),
          batu2: Math.round(semiAccumActualsRef.current.batu2 || targetBatu2),
          semen: Math.round(semiAccumActualsRef.current.semen || targetSemen),
          air: Math.round(semiAccumActualsRef.current.air || targetAir)
        },
        status: 'sukses',
        volume: totalVol,
        mixingCycles: completedBatch,
        slump: activeSlump,
        siloSemen: activeSiloSemen,
        mixingTime: activeMixingTime,
        pelanggan: activePelanggan,
        lokasi: activeLokasi,
        noKendaraan: activeNoKendaraan,
        sopir: activeSopir,
        productionMode: 'SEMI_AUTO',
        startTime: startStr,
        endTime: endStr,
        quarryPasir1,
        quarryPasir2,
        quarryBatu1,
        quarryBatu2
      };

      setLogs(prev => [consolidatedLog, ...prev].slice(0, 50));
      setActivePrintLog(consolidatedLog);

      setRelayLogs(prev => [
        {
          id: 'SEMI-FINAL-LOG-' + Math.random().toString(36).substring(7).toUpperCase(),
          timestamp: new Date(),
          message: `[PRODUKSI SELESAI] Seluruh ${completedBatch} batch (${totalVol} m³) selesai. Tiket produksi dicetak!`,
          type: 'done'
        },
        ...prev
      ]);
    }
  };

  const handleManualProductionTick = () => {
    // 1. SEMI AUTO MODE HANDLING
    if (batchingModeRef.current === 'SEMI_AUTO') {
      if (semiDoorDischargeActiveRef.current) {
        semiDoorDischargeTimerRef.current += 100;
        const dTimeTotal = semiDoorDischargeTimerRef.current;

        // Load timing values from Relay 14 settings
        const relayConfig = loadRelayConfig();
        const targetVol = volumePerBatchRef.current || volumePerBatch || 3.5;
        let selectedRelayId = 14;
        if (targetVol > 1.5 && targetVol <= 2.5) {
          selectedRelayId = 28;
        } else if (targetVol > 2.5) {
          selectedRelayId = 29;
        }
        const row14 = relayConfig.find(r => r.relay === selectedRelayId) || relayConfig.find(r => r.relay === 14);

        const open1Raw = row14 ? parseFloat(row14.timer1) : 2000;
        const pause1Raw = row14 ? parseFloat(row14.timer2) : 6000;
        const open2Raw = row14 ? parseFloat(row14.timer3) : 3000;
        const pause2Raw = row14 ? parseFloat(row14.timer4) : 5000;
        const open3Raw = row14 ? parseFloat(row14.timer5) : 3000;
        const pause3Raw = row14 ? parseFloat(row14.timer6) : 11000;

        const finalOpen1 = open1Raw;
        const finalPause1 = pause1Raw;
        const finalOpen2 = open2Raw;
        const finalPause2 = pause2Raw;
        const finalOpen3 = open3Raw;
        const finalPause3 = pause3Raw;

        const limit1 = finalOpen1;
        const limit2 = limit1 + finalPause1;
        const limit3 = limit2 + finalOpen2;
        const limit4 = limit3 + finalPause2;
        const limit5 = limit4 + finalOpen3;
        const limit6 = limit5 + finalPause3;
        const limit7 = limit6 + 5000; // Close door (5 seconds)

        const totalDischargeSec = limit7 / 1000;
        const dSecElapsed = Math.min(totalDischargeSec, dTimeTotal / 1000);
        setDischargeTimeSec(dSecElapsed);

        // Compute overall batch progress
        const curD = currentBatchRef.current + 1;
        const totD = targetBatchRef.current || 1;
        const baseProgressD = ((curD - 1) / totD) * 100;
        const stepPercentD = (dSecElapsed / totalDischargeSec) * (100 / totD);
        setBatchProgress(Math.min(100, Math.round(baseProgressD + stepPercentD)));

        // Phase 1 (Buka 1, Target 20%)
        if (dTimeTotal <= limit1) {
          setMixerStatusText('DOOR SOLENOID ACTIVE (RELAY #14)');
          setMixerDoorStateText('PHASE 1: BUKA (7cm)');
          const pct = Math.min(20, (dTimeTotal / finalOpen1) * 20);
          setMixerDoorPercent(pct);
          setConcreteDischargeActive(true);
          setMixerDoor1OpenActive(true);
          setMixerDoor2OpenActive(false);
          setMixerDoor3OpenActive(false);
          setMixerDoorClosingActive(false);
        }
        // Phase 2 (Diam 1, Stay 20%)
        else if (dTimeTotal <= limit2) {
          setMixerStatusText('DOOR STATIONARY (7cm)');
          setMixerDoorStateText('PHASE 2: DIAM (7cm)');
          setMixerDoorPercent(20);
          setMixerDoor1OpenActive(false);
          setMixerDoor2OpenActive(false);
          setMixerDoor3OpenActive(false);
          setMixerDoorClosingActive(false);
        }
        // Phase 3 (Buka 2, Target 65%)
        else if (dTimeTotal <= limit3) {
          setMixerStatusText('DOOR SOLENOID ACTIVE (RELAY #14)');
          setMixerDoorStateText('PHASE 3: BUKA (24cm)');
          const elapsedInStep = dTimeTotal - limit2;
          const pct = Math.min(65, 20 + (elapsedInStep / finalOpen2) * 45);
          setMixerDoorPercent(pct);
          setMixerDoor1OpenActive(false);
          setMixerDoor2OpenActive(true);
          setMixerDoor3OpenActive(false);
          setMixerDoorClosingActive(false);
        }
        // Phase 4 (Diam 2, Stay 65%)
        else if (dTimeTotal <= limit4) {
          setMixerStatusText('DOOR STATIONARY (24cm)');
          setMixerDoorStateText('PHASE 4: DIAM (24cm)');
          setMixerDoorPercent(65);
          setMixerDoor1OpenActive(false);
          setMixerDoor2OpenActive(false);
          setMixerDoor3OpenActive(false);
          setMixerDoorClosingActive(false);
        }
        // Phase 5 (Buka 3, Target 100%)
        else if (dTimeTotal <= limit5) {
          setMixerStatusText('DOOR SOLENOID ACTIVE (RELAY #14)');
          setMixerDoorStateText('PHASE 5: BUKA LENGKAP (30cm)');
          const elapsedInStep = dTimeTotal - limit4;
          const pct = Math.min(100, 65 + (elapsedInStep / finalOpen3) * 35);
          setMixerDoorPercent(pct);
          setMixerDoor1OpenActive(false);
          setMixerDoor2OpenActive(false);
          setMixerDoor3OpenActive(true);
          setMixerDoorClosingActive(false);
        }
        // Phase 6 (Diam 3, Stay 100%)
        else if (dTimeTotal <= limit6) {
          setMixerStatusText('MIXER EMPTY CHUTE FULL FLOOD');
          setMixerDoorStateText('PHASE 6: PENGOSONGAN');
          setMixerDoorPercent(100);
          setMixerDoor1OpenActive(false);
          setMixerDoor2OpenActive(false);
          setMixerDoor3OpenActive(false);
          setMixerDoorClosingActive(false);
        }
        // Phase 7 (Tutup Pintu 5 detik, Target 0%)
        else if (dTimeTotal <= limit7) {
          setMixerStatusText('CLOSE SOLENOID ACTIVE (RELAY #15)');
          setMixerDoorStateText('PHASE 7: MENUTUP PINTU');
          const elapsedInStep = dTimeTotal - limit6;
          const pct = Math.max(0, 100 - (elapsedInStep / 5000) * 100);
          setMixerDoorPercent(pct);
          setMixerDoor1OpenActive(false);
          setMixerDoor2OpenActive(false);
          setMixerDoor3OpenActive(false);
          setMixerDoorClosingActive(true);
        }
        // Concluded!
        else {
          semiDoorDischargeActiveRef.current = false;
          semiDoorDischargeTimerRef.current = 0;
          setMixerDoorPercent(0);
          setMixerDoorStateText("CLOSED");
          setMixerDoorClosingActive(false);
          setConcreteDischargeActive(false);
          setDischargeTimeSec(0);

          handleSemiAutoCycleComplete();
        }
      }
      return;
    }

    // 2. MANUAL MODE HANDLING
    const currentDoorState = mixerDoorStateTextRef.current;
    const minOpenSec = 1.0; 

    if (currentDoorState === "OPENED") {
      if (manualGateSequenceStateRef.current === 'IDLE') {
        manualGateSequenceStateRef.current = 'OPENING';
        manualGateOpenTimeMsRef.current = 0;
        isManualGateOpenTimeValidRef.current = false;
        
        setRelayLogs(prev => [
          {
            id: 'MANUAL-DET-OPEN-' + Math.random().toString(36).substring(7).toUpperCase(),
            timestamp: new Date(),
            message: `[DETEKSI MANUAL] Pintu Mixer dideteksi TERBUKA. Mengukur durasi (Target minimal: ${minOpenSec}s)`,
            type: 'on'
          },
          ...prev
        ]);
      } else if (manualGateSequenceStateRef.current === 'OPENING') {
        manualGateOpenTimeMsRef.current += 100;
        
        // Visual indicator: simulate concrete levels reducing in manual discharge for realistic animation
        setMixerDoorPercent(100);
        setConcreteDischargeActive(true);

        const elapsedSec = manualGateOpenTimeMsRef.current / 1000;
        if (elapsedSec >= minOpenSec && !isManualGateOpenTimeValidRef.current) {
          isManualGateOpenTimeValidRef.current = true;
          
          setRelayLogs(prev => [
            {
              id: 'MANUAL-DET-VAL-' + Math.random().toString(36).substring(7).toUpperCase(),
              timestamp: new Date(),
              message: `[DETEKSI MANUAL] Durasi buka pintu (${elapsedSec.toFixed(1)}s) melebihi batas minimal. Siklus valid! Menunggu pintu ditutup...`,
              type: 'done'
            },
            ...prev
          ]);
        }
      }
    } else { // CLOSED
      if (manualGateSequenceStateRef.current === 'OPENING') {
        const totalOpenSec = manualGateOpenTimeMsRef.current / 1000;
        
        if (isManualGateOpenTimeValidRef.current || totalOpenSec >= minOpenSec) {
          // Complete manual production cycle counted!
          const nextB = currentBatchRef.current + 1;
          currentBatchRef.current = nextB;
          setCurrentBatch(nextB);

          // Accumulate manual actuals for this cycle
          let actP1 = Math.round(manualPasir1Ref.current);
          let actP2 = Math.round(manualPasir2Ref.current);
          let actB1 = Math.round(manualBatu1Ref.current);
          let actB2 = Math.round(manualBatu2Ref.current);
          let actSemen = Math.round(manualSemenRef.current);
          let actAir = Math.round(manualAirRef.current);

          const peakP = Math.round(manualPeakPasirRef.current);
          const peakB = Math.round(manualPeakBatuRef.current);
          const peakS = Math.round(manualPeakSemenRef.current);
          const peakA = Math.round(manualPeakAirRef.current);
          if (actP1 + actP2 < peakP) {
            actP1 = Math.round(peakP * 0.7);
            actP2 = peakP - actP1;
          }
          if (actB1 + actB2 < peakB) {
            actB1 = Math.round(peakB * 0.7);
            actB2 = peakB - actB1;
          }
          if (actSemen < peakS) actSemen = peakS;
          if (actAir < peakA) actAir = peakA;

          semiAccumActualsRef.current.pasir1 += actP1;
          semiAccumActualsRef.current.pasir2 += actP2;
          semiAccumActualsRef.current.batu1 += actB1;
          semiAccumActualsRef.current.batu2 += actB2;
          semiAccumActualsRef.current.semen += actSemen;
          semiAccumActualsRef.current.air += actAir;

          playKlakson(1500); // sound industrial ending horn upon successfully completed manual batch!
          
          setRelayLogs(prev => [
            {
              id: 'MANUAL-CYC-COMP-' + Math.random().toString(36).substring(7).toUpperCase(),
              timestamp: new Date(),
              message: `[DETEKSI MANUAL] BATCH MANUAL KE-${nextB} DARI ${targetBatchRef.current} BERHASIL (Discharge durasi: ${totalOpenSec.toFixed(1)}s)`,
              type: 'done'
            },
            ...prev
          ]);

          if (nextB >= targetBatchRef.current) {
            stopBatch();
            setIsDone(true);
            setRelayLogs(prev => [
              {
                id: 'MANUAL-COMP-' + Math.random().toString(36).substring(7).toUpperCase(),
                timestamp: new Date(),
                message: `[PRODUKSI] SELURUH BATCH SELESAI (TOTAL: ${nextB} BATCH). MENCETAK TIKET...`,
                type: 'done'
              },
              ...prev
            ]);
          } else {
            // Reset for next manual cycle
            aggregateInMixerRef.current = 0;
            semenInMixerRef.current = 0;
            waterInMixerRef.current = 0;
            const vPerBatch = volumePerBatchRef.current || 1.0;
            setScalesSync(prev => {
              const next = { ...prev };
              (Object.keys(next) as MaterialType[]).forEach(k => {
                let tWeight = Math.round((selectedRecipe?.targets[k] || 400) * vPerBatch);
                next[k] = { ...next[k], actual: 0, target: tWeight, isActive: false, isComplete: false };
              });
              return next;
            });
            manualPasir1Ref.current = 0;
            manualPasir2Ref.current = 0;
            manualBatu1Ref.current = 0;
            manualBatu2Ref.current = 0;
            manualSemenRef.current = 0;
            manualAirRef.current = 0;
            manualPeakPasirRef.current = 0;
            manualPeakBatuRef.current = 0;
            manualPeakSemenRef.current = 0;
            manualPeakAirRef.current = 0;
            wasPasir1EverOpenedRef.current = false;
            wasPasir2EverOpenedRef.current = false;
            wasBatu1EverOpenedRef.current = false;
            wasBatu2EverOpenedRef.current = false;

            setMixerStatusText(`BATCH ${nextB} SELESAI. SIAP PENIMBANGAN BATCH ${nextB + 1} DARI ${targetBatchRef.current}`);
          }
        } else {
          // Too short! DO NOT COUNT CYCLE
          setRelayLogs(prev => [
            {
              id: 'MANUAL-CYC-FAIL-' + Math.random().toString(36).substring(7).toUpperCase(),
              timestamp: new Date(),
              message: `[DETEKSI MANUAL] Siklus BATAL: Pintu ditutup terlalu cepat (${totalOpenSec.toFixed(1)}s), kurang dari batas minimal (${minOpenSec}s). JANGAN HITUNG SIKLUS.`,
              type: 'off'
            },
            ...prev
          ]);
        }

        // Reset manual tracking variables
        manualGateSequenceStateRef.current = 'IDLE';
        manualGateOpenTimeMsRef.current = 0;
        isManualGateOpenTimeValidRef.current = false;
        
        // Hide concrete visual flowing
        setConcreteDischargeActive(false);
      }
    }
  };

  const handleStartPauseClick = () => {
    if (!isRunning) {
      setIsBatchConfigOpen(true);
    } else {
      // Toggle pause state (Auto mode only)
      if (isAuto) {
        setIsPaused(prev => {
          const next = !prev;
          if (next) {
            dotNetBackendService.pauseBatch().catch(() => {});
          } else {
            dotNetBackendService.resumeBatch().catch(() => {});
          }
          return next;
        });
      }
    }
  };

  // Dedicated manual scale simulation when in simulation mode (runs independently of auto batch runs)
  useEffect(() => {
    if (operationMode !== 'SIMULASI') return;

    const interval = setInterval(() => {
      // In auto mode, if isRunning is true, the automatic weighing system handles it.
      if (isRunning && isAuto) return;

      setScalesSync(prev => {
        const next = { ...prev };
        let changed = false;

        // Determine if specific dosing is automatically controlled right now in SEMI_AUTO
        const isSemi = batchingModeRef.current === 'SEMI_AUTO' && isRunning;
        const isPasirAuto = isSemi && (semiAutoDosingRef.current.pasir1 || semiAutoDosingRef.current.pasir2);
        const isBatuAuto = isSemi && (semiAutoDosingRef.current.batu1 || semiAutoDosingRef.current.batu2);
        const isSemenAuto = isSemi && semiAutoDosingRef.current.semen;
        const isAirAuto = isSemi && semiAutoDosingRef.current.air;

        // 1. Sand (Pasir)
        if (!isPasirAuto && (gatePasir1SiloOpen || gatePasir2SiloOpen)) {
          const inc = (8 + Math.random() * 4) * 0.1; // 0.8 - 1.2 kg per tick
          next.pasir.actual = parseFloat(Math.min(1000, next.pasir.actual + inc).toFixed(1));
          changed = true;
        }

        // 2. Gravel (Batu)
        if (!isBatuAuto && (gateBatu1SiloOpen || gateBatu2SiloOpen)) {
          const inc = (10 + Math.random() * 5) * 0.1; // 1.0 - 1.5 kg per tick
          next.batu.actual = parseFloat(Math.min(1000, next.batu.actual + inc).toFixed(1));
          changed = true;
        }

        // 3. Cement (Semen)
        if (!isSemenAuto && screwSemenActive) {
          const inc = (6 + Math.random() * 3) * 0.1; // 0.6 - 0.9 kg per tick
          next.semen.actual = parseFloat(Math.min(800, next.semen.actual + inc).toFixed(1));
          changed = true;
        }

        // 4. Water (Air)
        if (!isAirAuto && valveWaterActive) {
          const inc = (4 + Math.random() * 2) * 0.1; // 0.4 - 0.6 kg per tick
          next.air.actual = parseFloat(Math.min(400, next.air.actual + inc).toFixed(1));
          changed = true;
        }

        // 5. Semen discharge
        if (!isSemenAuto && gateSemenHopperOpen) {
          const dec = (15 + Math.random() * 8) * 0.1;
          const actualDrain = Math.min(next.semen.actual, dec);
          next.semen.actual = parseFloat(Math.max(0, next.semen.actual - dec).toFixed(1));
          semenInMixerRef.current += actualDrain;
          changed = true;
        }

        // 6. Water discharge
        if (!isAirAuto && gateWaterHopperOpen) {
          const dec = (10 + Math.random() * 5) * 0.1;
          const actualDrain = Math.min(next.air.actual, dec);
          next.air.actual = parseFloat(Math.max(0, next.air.actual - dec).toFixed(1));
          waterInMixerRef.current += actualDrain;
          changed = true;
        }

        // 7. Sand and Gravel discharge/dump (Requires respective discharge gate/pintu to be ON)
        if (gatePasirHopperOpen || gateBatuHopperOpen) {
          const decPasir = (25 + Math.random() * 15) * 0.1;
          const decBatu = (30 + Math.random() * 20) * 0.1;
          if (gatePasirHopperOpen && !isPasirAuto) {
            const actualDrain = Math.min(next.pasir.actual, decPasir);
            next.pasir.actual = parseFloat(Math.max(0, next.pasir.actual - decPasir).toFixed(1));
            aggregateInMixerRef.current += actualDrain;
            changed = true;
          }
          if (gateBatuHopperOpen && !isBatuAuto) {
            const actualDrain = Math.min(next.batu.actual, decBatu);
            next.batu.actual = parseFloat(Math.max(0, next.batu.actual - decBatu).toFixed(1));
            aggregateInMixerRef.current += actualDrain;
            changed = true;
          }
        }

        return changed ? next : prev;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [
    operationMode,
    isAuto,
    isRunning,
    gatePasir1SiloOpen,
    gatePasir2SiloOpen,
    gateBatu1SiloOpen,
    gateBatu2SiloOpen,
    screwSemenActive,
    valveWaterActive,
    gateSemenHopperOpen,
    gateWaterHopperOpen,
    conveyorBottomActive,
    gatePasirHopperOpen,
    gateBatuHopperOpen
  ]);

  // Record previous scales to compute increments in real-time for manual logging
  const prevScalesRef = useRef(scales);

  useEffect(() => {
    if (!isAuto) {
      const prev = prevScalesRef.current;

      // Track if a specific material gate was actually opened during this session
      if (gatePasir1SiloOpen) wasPasir1EverOpenedRef.current = true;
      if (gatePasir2SiloOpen) wasPasir2EverOpenedRef.current = true;
      if (gateBatu1SiloOpen) wasBatu1EverOpenedRef.current = true;
      if (gateBatu2SiloOpen) wasBatu2EverOpenedRef.current = true;
      
      // 1. Pasir
      const diffPasir = scales.pasir.actual - prev.pasir.actual;
      if (diffPasir > 0) {
        if (gatePasir1SiloOpen) {
          manualPasir1Ref.current += diffPasir;
        } else if (gatePasir2SiloOpen) {
          manualPasir2Ref.current += diffPasir;
        } else {
          // If no gate is currently open, attribute to the one that was ever opened, or default to Pasir 1
          if (wasPasir2EverOpenedRef.current && !wasPasir1EverOpenedRef.current) {
            manualPasir2Ref.current += diffPasir;
          } else {
            manualPasir1Ref.current += diffPasir;
          }
        }
      }

      // 2. Batu
      const diffBatu = scales.batu.actual - prev.batu.actual;
      if (diffBatu > 0) {
        if (gateBatu1SiloOpen) {
          manualBatu1Ref.current += diffBatu;
        } else if (gateBatu2SiloOpen) {
          manualBatu2Ref.current += diffBatu;
        } else {
          // If no gate is currently open, attribute to the one that was ever opened, or default to Batu 1
          if (wasBatu2EverOpenedRef.current && !wasBatu1EverOpenedRef.current) {
            manualBatu2Ref.current += diffBatu;
          } else {
            manualBatu1Ref.current += diffBatu;
          }
        }
      }

      // 3. Semen
      const diffSemen = scales.semen.actual - prev.semen.actual;
      if (diffSemen > 0) {
        manualSemenRef.current += diffSemen;
      }

      // 4. Air
      const diffAir = scales.air.actual - prev.air.actual;
      if (diffAir > 0) {
        manualAirRef.current += diffAir;
      }

      // Draining / Discharge tracking into mixer in manual/semi mode: ONLY when the discharge hopper gate is actually OPEN!
      if (diffPasir < 0 && gatePasirHopperOpen) {
        aggregateInMixerRef.current += Math.abs(diffPasir);
      }
      if (diffBatu < 0 && gateBatuHopperOpen) {
        aggregateInMixerRef.current += Math.abs(diffBatu);
      }
      if (diffSemen < 0 && gateSemenHopperOpen) {
        semenInMixerRef.current += Math.abs(diffSemen);
      }
      if (diffAir < 0 && gateWaterHopperOpen) {
        waterInMixerRef.current += Math.abs(diffAir);
      }
    }
    prevScalesRef.current = scales;
  }, [scales, isRunning, isAuto, gatePasir1SiloOpen, gatePasir2SiloOpen, gateBatu1SiloOpen, gateBatu2SiloOpen]);

  // MASTER TICK PLC SIMULATOR TIMER LOOP (100ms intervals)
  useEffect(() => {
    if (isRunning || !isAuto) {
      const tickHandler = () => {
        if (isPausedRef.current) return;

        // Fail-safe: check if communication connection is disconnected or lost during batch
        if (webSerialService.getStatus() === "DISCONNECTED") {
          setAlarmMessage("ALARM KESELAMATAN: Komunikasi HMI ke panel kontrol batching plant terputus!");
        }

        if (!isAutoRef.current) {
          handleManualProductionTick();

          // Dynamically synchronize mixerState in SEMI and MANUAL mode so UI and animations reflect real state
          if (mixerDoorPercent > 0 || semiDoorDischargeActiveRef.current || concreteDischargeActive || mixerDoorStateTextRef.current === 'OPENED') {
            if (mixerStateRef.current !== 'discharging_concrete') setMixerStateSync('discharging_concrete');
            // Drain material from mixer in manual/semi mode when door is open
            const drainRate = 0.05;
            if (aggregateInMixerRef.current > 0) aggregateInMixerRef.current = Math.max(0, aggregateInMixerRef.current - aggregateInMixerRef.current * drainRate);
            if (semenInMixerRef.current > 0) semenInMixerRef.current = Math.max(0, semenInMixerRef.current - semenInMixerRef.current * drainRate);
            if (waterInMixerRef.current > 0) waterInMixerRef.current = Math.max(0, waterInMixerRef.current - waterInMixerRef.current * drainRate);
          } else if (gatePasirHopperOpenRef.current || gateBatuHopperOpenRef.current || gateSemenHopperOpenRef.current || gateWaterHopperOpenRef.current) {
            if (mixerStateRef.current !== 'discharging_hoppers') setMixerStateSync('discharging_hoppers');
          } else if (aggregateInMixerRef.current > 5 || semenInMixerRef.current > 5 || waterInMixerRef.current > 5) {
            if (mixerStateRef.current !== 'mixing') setMixerStateSync('mixing');
          } else {
            if (mixerStateRef.current !== 'waiting' && mixerStateRef.current !== 'complete') setMixerStateSync('waiting');
          }

          if (batchingModeRef.current !== 'SEMI_AUTO') {
            return;
          }
        }
        
        // Handle Admix Semi-Auto Dosing Simulated Weight Ticker
        if (batchingModeRef.current === 'SEMI_AUTO' && semiAutoDosingRef.current.admix) {
          const admixTarget = (selectedRecipe as any)?.jobMixDetails?.additive || 2.0;
          const inc = 0.1; // 0.1 liter per 100ms
          const nextVal = parseFloat((admixActualRef.current + inc).toFixed(1));
          
          if (nextVal >= admixTarget) {
            setAdmixActual(admixTarget);
            setAdmixInActive(false);
            setSemiAutoDosing(prev => {
              const next = { ...prev, admix: false };
              const anyRemaining = Object.values(next).some(v => v);
              if (!anyRemaining) {
                weighingActiveRef.current = false;
                setIsWeighingActive(false);
              }
              return next;
            });
            
            setRelayLogs(prev => [
              {
                id: 'SEMI-ADMIX-DONE-' + Math.random().toString(36).substring(7).toUpperCase(),
                timestamp: new Date(),
                message: `[SEMI AUTO] Dosing ADMIXTURE SELESAI. Actual: ${admixTarget.toFixed(1)} Liter.`,
                type: 'done'
              },
              ...prev
            ]);
          } else {
            setAdmixActual(nextVal);
          }
        }

        // --- 1. WEIGHING ENGINE STATE (TICKING IN REALTIME) ---
        if (weighingActiveRef.current) {
          // Dynamic currentStep state selection for sequential visual HMI tracking
          let step: 'pasir' | 'batu' | 'semen' | 'air' | 'idle' = 'idle';
          if (weighingJogStatesRef.current.pasir1.phase !== 'done' || weighingJogStatesRef.current.pasir2.phase !== 'done') {
            step = 'pasir';
          } else if (weighingJogStatesRef.current.batu1.phase !== 'done' || weighingJogStatesRef.current.batu2.phase !== 'done') {
            step = 'batu';
          } else if (weighingJogStatesRef.current.semen.phase !== 'done') {
            step = 'semen';
          } else if (weighingJogStatesRef.current.air.phase !== 'done') {
            step = 'air';
          }
          setCurrentStep(step);

          setScalesSync(prev => {
            const updated = { ...prev };
            let allComplete = true;
            const joggingSettings = getJoggingSettings();

             const isAnyManualJogActive = 
              joggingPasir1Ref.current || 
              joggingPasir2Ref.current || 
              joggingBatu1Ref.current || 
              joggingBatu2Ref.current || 
              joggingSemenRef.current || 
              joggingAirRef.current;

            // 1. Sand (Pasir)
            const pasir1Config = joggingSettings.find((r: any) => r.material === "Pasir 1") || joggingSettings.find((r: any) => r.material === "Pasir") || { targetPercent: 90, jeda: 1.5, onTime: 0.5, offTime: 1.2, tolerance: 10 };
            const pasir2Config = joggingSettings.find((r: any) => r.material === "Pasir 2") || joggingSettings.find((r: any) => r.material === "Pasir") || { targetPercent: 90, jeda: 1.5, onTime: 0.5, offTime: 1.2, tolerance: 10 };
            const pasirTarget = updated.pasir.target;
            const tFactor = parseFloat((activeVolume / totalCyclesRef.current).toFixed(2));
            const recP1 = (selectedRecipe as any).pasir1 !== undefined ? (selectedRecipe as any).pasir1 : Math.round((selectedRecipe?.targets.pasir ?? 400) * 0.7);
            const pasir1Target = Math.min(pasirTarget, Math.round(recP1 * tFactor));
            const pasir2Target = Math.max(0, pasirTarget - pasir1Target);

            const fastLimit_pasir1 = (pasir1Config.targetPercent / 100) * pasir1Target;
            const fastLimit_pasir2 = pasir1Target + (pasir2Config.targetPercent / 100) * pasir2Target;

            const jogState_pasir1 = weighingJogStatesRef.current.pasir1;
            const jogState_pasir2 = weighingJogStatesRef.current.pasir2;

            if (pasirTarget > 0) {
              // Safety interlock: jika target material sudah >= setpoint, actuator tetap OFF
              if (updated.pasir.actual >= pasirTarget || updated.pasir.isComplete || pasirWeighedRef.current) {
                updated.pasir.isActive = false;
                updated.pasir.isComplete = true;
                setGatePasirSiloOpen(false);
                setGatePasir1SiloOpen(false);
                setGatePasir2SiloOpen(false);
                jogState_pasir1.phase = 'done';
                jogState_pasir2.phase = 'done';
              } else {
                // If currently manual-jogging this specific material:
                if (joggingPasir1Ref.current || joggingPasir2Ref.current) {
                  allComplete = false;
                  updated.pasir.isActive = true;
                  
                  // Turn on sand actuators (Independent channel)
                  setGatePasirSiloOpen(true);
                  setGatePasir1SiloOpen(joggingPasir1Ref.current);
                  setGatePasir2SiloOpen(joggingPasir2Ref.current);
                  
                  // Increment Sand weight smoothly
                  const inc = operationModeRef.current === 'PRODUKSI' ? 0 : (4 + Math.random() * 3) * 0.1; // 0.4 - 0.7 kg / tick
                  updated.pasir.actual = Math.min(pasirTarget, updated.pasir.actual + inc);
                  
                  if (updated.pasir.actual >= pasirTarget) {
                    updated.pasir.isComplete = true;
                    updated.pasir.isActive = false;
                    setGatePasirSiloOpen(false);
                    setGatePasir1SiloOpen(false);
                    setGatePasir2SiloOpen(false);
                    jogState_pasir1.phase = 'done';
                    jogState_pasir2.phase = 'done';
                  }
                } 
                // Else, if someone is manual-jogging ANOTHER material, isolate sand and keep it OFF
                else if (isAnyManualJogActive) {
                  allComplete = false;
                  setGatePasirSiloOpen(false);
                  setGatePasir1SiloOpen(false);
                  setGatePasir2SiloOpen(false);
                }
                // Else, automatic batching:
                else if (isAuto || (batchingModeRef.current === 'SEMI_AUTO' && (semiAutoDosingRef.current.pasir1 || semiAutoDosingRef.current.pasir2))) {
                  if (jogState_pasir1.phase !== 'done') {
                    allComplete = false;
                    updated.pasir.isActive = true;

                    if (jogState_pasir1.phase === 'fast') {
                      setGatePasirSiloOpen(true);
                      setGatePasir1SiloOpen(true);
                      setGatePasir2SiloOpen(false);

                      const inc = operationModeRef.current === 'PRODUKSI' ? 0 : (12 + Math.random() * 6) * 0.1;
                      updated.pasir.actual = Math.min(pasir1Target, updated.pasir.actual + inc);

                      const isPasirJogActive = isJoggingActive(pasir1Config);
                      if (!isPasirJogActive) {
                        if (updated.pasir.actual >= pasir1Target) {
                          setGatePasirSiloOpen(false);
                          setGatePasir1SiloOpen(false);
                          setGatePasir2SiloOpen(false);
                          jogState_pasir1.phase = 'done';

                          setRelayLogs(l => [{
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "PASIR1 COMPLETE",
                            type: 'done'
                          }, {
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "[BATCH CONCRETE] Pasir 1 selesai langsung (Single Feed Normal - JOGGING OFF). Berat: " + updated.pasir.actual.toFixed(1) + " Kg.",
                            type: 'done'
                          }, ...l]);
                        }
                      } else {
                        if (updated.pasir.actual >= fastLimit_pasir1) {
                          setGatePasirSiloOpen(false);
                          setGatePasir1SiloOpen(false);
                          setGatePasir2SiloOpen(false);
                          jogState_pasir1.phase = 'jeda';
                          jogState_pasir1.timer = 0;
                          
                          setRelayLogs(l => [{
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "[FAST FEED] Pasir 1 mencapai " + pasir1Config.targetPercent + "% (" + fastLimit_pasir1.toFixed(0) + " Kg). Pintu silo ditutup. Jeda...",
                            type: 'info'
                          }, ...l]);
                        }
                      }
                    }
                    else if (jogState_pasir1.phase === 'jeda') {
                      setGatePasirSiloOpen(false);
                      setGatePasir1SiloOpen(false);
                      setGatePasir2SiloOpen(false);

                      jogState_pasir1.timer += 100;
                      if (jogState_pasir1.timer >= pasir1Config.jeda * 1000) {
                        const remainingDeficit = pasir1Target - updated.pasir.actual;
                        if (remainingDeficit <= pasir1Config.tolerance) {
                          jogState_pasir1.phase = 'done';

                          setRelayLogs(l => [{
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "PASIR1 COMPLETE",
                            type: 'done'
                          }, {
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "[STABIL] Pasir 1 stabil. Sisa: " + remainingDeficit.toFixed(1) + " Kg <= Toleransi (" + pasir1Config.tolerance + " Kg). SELESAI Pasir 1.",
                            type: 'done'
                          }, ...l]);
                        } else {
                          jogState_pasir1.phase = 'jog_on';
                          jogState_pasir1.timer = 0;
                          jogState_pasir1.pulseCount += 1;

                          setRelayLogs(l => [{
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "[JOGGING] Pasir 1 kurang " + remainingDeficit.toFixed(1) + " Kg. Memulai Gate Jog ke-" + jogState_pasir1.pulseCount + ".",
                            type: 'info'
                          }, ...l]);
                        }
                      }
                    }
                    else if (jogState_pasir1.phase === 'jog_on') {
                      setGatePasirSiloOpen(true);
                      setGatePasir1SiloOpen(true);
                      setGatePasir2SiloOpen(false);

                      const inc = operationModeRef.current === 'PRODUKSI' ? 0 : (4 + Math.random() * 3) * 0.1;
                      updated.pasir.actual = Math.min(pasir1Target, updated.pasir.actual + inc);

                      jogState_pasir1.timer += 100;
                      if (jogState_pasir1.timer >= pasir1Config.onTime * 1000) {
                        setGatePasirSiloOpen(false);
                        setGatePasir1SiloOpen(false);
                        setGatePasir2SiloOpen(false);
                        jogState_pasir1.phase = 'jog_off';
                        jogState_pasir1.timer = 0;
                      }
                    }
                    else if (jogState_pasir1.phase === 'jog_off') {
                      setGatePasirSiloOpen(false);
                      setGatePasir1SiloOpen(false);
                      setGatePasir2SiloOpen(false);

                      jogState_pasir1.timer += 100;
                      if (jogState_pasir1.timer >= pasir1Config.offTime * 1000) {
                        const remainingDeficit = pasir1Target - updated.pasir.actual;
                        if (remainingDeficit <= pasir1Config.tolerance) {
                          jogState_pasir1.phase = 'done';

                          setRelayLogs(l => [{
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "PASIR1 COMPLETE",
                            type: 'done'
                          }, {
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "[STABIL] Pasir 1 selesai setelah " + jogState_pasir1.pulseCount + " pulsa. Sisa: " + remainingDeficit.toFixed(1) + " Kg.",
                            type: 'done'
                          }, ...l]);
                        } else {
                          jogState_pasir1.phase = 'jog_on';
                          jogState_pasir1.timer = 0;
                          jogState_pasir1.pulseCount += 1;

                          setRelayLogs(l => [{
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "[JOGGING] Pasir 1 kurang " + remainingDeficit.toFixed(1) + " Kg. Trigger pulse ke-" + jogState_pasir1.pulseCount + "...",
                            type: 'info'
                          }, ...l]);
                        }
                      }
                    }
                  }
                  else if (jogState_pasir2.phase !== 'done') {
                    allComplete = false;
                    updated.pasir.isActive = true;

                    if (jogState_pasir2.phase === 'fast') {
                      setGatePasirSiloOpen(true);
                      setGatePasir1SiloOpen(false);
                      setGatePasir2SiloOpen(true);

                      const inc = operationModeRef.current === 'PRODUKSI' ? 0 : (12 + Math.random() * 6) * 0.1;
                      updated.pasir.actual = Math.min(pasirTarget, updated.pasir.actual + inc);

                      const isPasirJogActive = isJoggingActive(pasir2Config);
                      if (!isPasirJogActive) {
                        if (updated.pasir.actual >= pasirTarget) {
                          setGatePasirSiloOpen(false);
                          setGatePasir1SiloOpen(false);
                          setGatePasir2SiloOpen(false);
                          jogState_pasir2.phase = 'done';
                          updated.pasir.isComplete = true;
                          updated.pasir.isActive = false;

                          setRelayLogs(l => [{
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "PASIR2 COMPLETE",
                            type: 'done'
                          }, {
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "[BATCH CONCRETE] Pasir 2 selesai langsung (Single Feed Normal - JOGGING OFF). Berat: " + updated.pasir.actual.toFixed(1) + " Kg.",
                            type: 'done'
                          }, ...l]);
                        }
                      } else {
                        if (updated.pasir.actual >= fastLimit_pasir2) {
                          setGatePasirSiloOpen(false);
                          setGatePasir1SiloOpen(false);
                          setGatePasir2SiloOpen(false);
                          jogState_pasir2.phase = 'jeda';
                          jogState_pasir2.timer = 0;
                          
                          setRelayLogs(l => [{
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "[FAST FEED] Pasir 2 mencapai " + pasir2Config.targetPercent + "% (" + fastLimit_pasir2.toFixed(0) + " Kg). Pintu silo ditutup. Jeda...",
                            type: 'info'
                          }, ...l]);
                        }
                      }
                    }
                    else if (jogState_pasir2.phase === 'jeda') {
                      setGatePasirSiloOpen(false);
                      setGatePasir1SiloOpen(false);
                      setGatePasir2SiloOpen(false);

                      jogState_pasir2.timer += 100;
                      if (jogState_pasir2.timer >= pasir2Config.jeda * 1000) {
                        const remainingDeficit = pasirTarget - updated.pasir.actual;
                        if (remainingDeficit <= pasir2Config.tolerance) {
                          jogState_pasir2.phase = 'done';
                          updated.pasir.isComplete = true;
                          updated.pasir.isActive = false;

                          setRelayLogs(l => [{
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "PASIR2 COMPLETE",
                            type: 'done'
                          }, {
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "[STABIL] Pasir 2 stabil. Sisa: " + remainingDeficit.toFixed(1) + " Kg <= Toleransi (" + pasir2Config.tolerance + " Kg). SELESAI Pasir (1+2).",
                            type: 'done'
                          }, ...l]);
                        } else {
                          jogState_pasir2.phase = 'jog_on';
                          jogState_pasir2.timer = 0;
                          jogState_pasir2.pulseCount += 1;

                          setRelayLogs(l => [{
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "[JOGGING] Pasir 2 kurang " + remainingDeficit.toFixed(1) + " Kg. Memulai Gate Jog ke-" + jogState_pasir2.pulseCount + ".",
                            type: 'info'
                          }, ...l]);
                        }
                      }
                    }
                    else if (jogState_pasir2.phase === 'jog_on') {
                      setGatePasirSiloOpen(true);
                      setGatePasir1SiloOpen(false);
                      setGatePasir2SiloOpen(true);

                      const inc = operationModeRef.current === 'PRODUKSI' ? 0 : (4 + Math.random() * 3) * 0.1;
                      updated.pasir.actual = Math.min(pasirTarget, updated.pasir.actual + inc);

                      jogState_pasir2.timer += 100;
                      if (jogState_pasir2.timer >= pasir2Config.onTime * 1000) {
                        setGatePasirSiloOpen(false);
                        setGatePasir1SiloOpen(false);
                        setGatePasir2SiloOpen(false);
                        jogState_pasir2.phase = 'jog_off';
                        jogState_pasir2.timer = 0;
                      }
                    }
                    else if (jogState_pasir2.phase === 'jog_off') {
                      setGatePasirSiloOpen(false);
                      setGatePasir1SiloOpen(false);
                      setGatePasir2SiloOpen(false);

                      jogState_pasir2.timer += 100;
                      if (jogState_pasir2.timer >= pasir2Config.offTime * 1000) {
                        const remainingDeficit = pasirTarget - updated.pasir.actual;
                        if (remainingDeficit <= pasir2Config.tolerance) {
                          jogState_pasir2.phase = 'done';
                          updated.pasir.isComplete = true;
                          updated.pasir.isActive = false;

                          setRelayLogs(l => [{
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "PASIR2 COMPLETE",
                            type: 'done'
                          }, {
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "[STABIL] Pasir 2 selesai setelah " + jogState_pasir2.pulseCount + " pulsa. Sisa: " + remainingDeficit.toFixed(1) + " Kg.",
                            type: 'done'
                          }, ...l]);
                        } else {
                          jogState_pasir2.phase = 'jog_on';
                          jogState_pasir2.timer = 0;
                          jogState_pasir2.pulseCount += 1;

                          setRelayLogs(l => [{
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "[JOGGING] Pasir 2 kurang " + remainingDeficit.toFixed(1) + " Kg. Trigger pulse ke-" + jogState_pasir2.pulseCount + "...",
                            type: 'info'
                          }, ...l]);
                        }
                      }
                    }
                  } else {
                    updated.pasir.isActive = false;
                    updated.pasir.isComplete = true;
                    setGatePasirSiloOpen(false);
                    setGatePasir1SiloOpen(false);
                    setGatePasir2SiloOpen(false);
                  }
                }
                // Else (Auto is OFF and no manual jog is active for this material):
                else {
                  allComplete = false;
                  updated.pasir.isActive = false;
                  setGatePasirSiloOpen(false);
                  setGatePasir1SiloOpen(false);
                  setGatePasir2SiloOpen(false);
                }
              }
            }

            // 2. Stone (Batu)
            const batu1Config = joggingSettings.find((r: any) => r.material === "Batu 1") || joggingSettings.find((r: any) => r.material === "Batu") || { targetPercent: 92, jeda: 1.5, onTime: 0.4, offTime: 1.3, tolerance: 12 };
            const batu2Config = joggingSettings.find((r: any) => r.material === "Batu 2") || joggingSettings.find((r: any) => r.material === "Batu") || { targetPercent: 92, jeda: 1.5, onTime: 0.4, offTime: 1.3, tolerance: 12 };
            const batuTarget = updated.batu.target;
            const recB1 = (selectedRecipe as any).batu1 !== undefined ? (selectedRecipe as any).batu1 : Math.round((selectedRecipe?.targets.batu ?? 400) * 0.7);
            const batu1Target = Math.min(batuTarget, Math.round(recB1 * tFactor));
            const batu2Target = Math.max(0, batuTarget - batu1Target);

            const fastLimit_batu1 = (batu1Config.targetPercent / 100) * batu1Target;
            const fastLimit_batu2 = batu1Target + (batu2Config.targetPercent / 100) * batu2Target;

            const jogState_batu1 = weighingJogStatesRef.current.batu1;
            const jogState_batu2 = weighingJogStatesRef.current.batu2;

            if (batuTarget > 0) {
              // Safety interlock: jika target material sudah >= setpoint, actuator tetap OFF
              if (updated.batu.actual >= batuTarget || updated.batu.isComplete || batuWeighedRef.current) {
                updated.batu.isActive = false;
                updated.batu.isComplete = true;
                setGateBatuSiloOpen(false);
                setGateBatu1SiloOpen(false);
                setGateBatu2SiloOpen(false);
                jogState_batu1.phase = 'done';
                jogState_batu2.phase = 'done';
              } else {
                // If currently manual-jogging this specific material:
                if (joggingBatu1Ref.current || joggingBatu2Ref.current) {
                  allComplete = false;
                  updated.batu.isActive = true;
                  
                  // Turn on stone actuators (Independent channel)
                  setGateBatuSiloOpen(true);
                  setGateBatu1SiloOpen(joggingBatu1Ref.current);
                  setGateBatu2SiloOpen(joggingBatu2Ref.current);
                  
                  // Increment Stone weight smoothly
                  const inc = operationModeRef.current === 'PRODUKSI' ? 0 : (5 + Math.random() * 3) * 0.1; // 0.5 - 0.8 kg / tick
                  updated.batu.actual = Math.min(batuTarget, updated.batu.actual + inc);
                  
                  if (updated.batu.actual >= batuTarget) {
                    updated.batu.isComplete = true;
                    updated.batu.isActive = false;
                    setGateBatuSiloOpen(false);
                    setGateBatu1SiloOpen(false);
                    setGateBatu2SiloOpen(false);
                    jogState_batu1.phase = 'done';
                    jogState_batu2.phase = 'done';
                  }
                } 
                // Else, if someone is manual-jogging ANOTHER material, isolate stone and keep it OFF
                else if (isAnyManualJogActive) {
                  allComplete = false;
                  setGateBatuSiloOpen(false);
                  setGateBatu1SiloOpen(false);
                  setGateBatu2SiloOpen(false);
                }
                // Else, automatic batching:
                else if (isAuto || (batchingModeRef.current === 'SEMI_AUTO' && (semiAutoDosingRef.current.batu1 || semiAutoDosingRef.current.batu2))) {
                  const isSandBatchFinished = (updated.pasir.target === 0 || (jogState_pasir1.phase === 'done' && jogState_pasir2.phase === 'done'));
                  const shouldWeighStone = (batchingModeRef.current === 'SEMI_AUTO') || (batchingPlantMode !== 'SYSTEM_2') || isSandBatchFinished;

                  if (shouldWeighStone) {
                    if (jogState_batu1.phase !== 'done') {
                      allComplete = false;
                      updated.batu.isActive = true;

                      if (jogState_batu1.phase === 'fast') {
                        setGateBatuSiloOpen(true);
                        setGateBatu1SiloOpen(true);
                        setGateBatu2SiloOpen(false);

                        const inc = operationModeRef.current === 'PRODUKSI' ? 0 : (15 + Math.random() * 8) * 0.1;
                        updated.batu.actual = Math.min(batu1Target, updated.batu.actual + inc);

                        const isBatuJogActive = isJoggingActive(batu1Config);
                        if (!isBatuJogActive) {
                          if (updated.batu.actual >= batu1Target) {
                            setGateBatuSiloOpen(false);
                            setGateBatu1SiloOpen(false);
                            setGateBatu2SiloOpen(false);
                            jogState_batu1.phase = 'done';

                            setRelayLogs(l => [{
                              id: Math.random().toString(36).substring(7).toUpperCase(),
                              timestamp: new Date(),
                              message: "BATU1 COMPLETE",
                              type: 'done'
                            }, {
                              id: Math.random().toString(36).substring(7).toUpperCase(),
                              timestamp: new Date(),
                              message: "[BATCH CONCRETE] Batu 1 selesai langsung (Single Feed Normal - JOGGING OFF). Berat: " + updated.batu.actual.toFixed(1) + " Kg.",
                              type: 'done'
                            }, ...l]);
                          }
                        } else {
                          if (updated.batu.actual >= fastLimit_batu1) {
                            setGateBatuSiloOpen(false);
                            setGateBatu1SiloOpen(false);
                            setGateBatu2SiloOpen(false);
                            jogState_batu1.phase = 'jeda';
                            jogState_batu1.timer = 0;
                            
                            setRelayLogs(l => [{
                              id: Math.random().toString(36).substring(7).toUpperCase(),
                              timestamp: new Date(),
                              message: "[FAST FEED] Batu 1 mencapai " + batu1Config.targetPercent + "% (" + fastLimit_batu1.toFixed(0) + " Kg). Pintu silo ditutup. Jeda...",
                              type: 'info'
                            }, ...l]);
                          }
                        }
                      }
                      else if (jogState_batu1.phase === 'jeda') {
                        setGateBatuSiloOpen(false);
                        setGateBatu1SiloOpen(false);
                        setGateBatu2SiloOpen(false);

                        jogState_batu1.timer += 100;
                        if (jogState_batu1.timer >= batu1Config.jeda * 1000) {
                          const remainingDeficit = batu1Target - updated.batu.actual;
                          if (remainingDeficit <= batu1Config.tolerance) {
                            jogState_batu1.phase = 'done';

                            setRelayLogs(l => [{
                              id: Math.random().toString(36).substring(7).toUpperCase(),
                              timestamp: new Date(),
                              message: "BATU1 COMPLETE",
                              type: 'done'
                            }, {
                              id: Math.random().toString(36).substring(7).toUpperCase(),
                              timestamp: new Date(),
                              message: "[STABIL] Batu 1 stabil. Sisa: " + remainingDeficit.toFixed(1) + " Kg <= Toleransi (" + batu1Config.tolerance + " Kg). SELESAI Batu 1.",
                              type: 'done'
                            }, ...l]);
                          } else {
                            jogState_batu1.phase = 'jog_on';
                            jogState_batu1.timer = 0;
                            jogState_batu1.pulseCount += 1;

                            setRelayLogs(l => [{
                              id: Math.random().toString(36).substring(7).toUpperCase(),
                              timestamp: new Date(),
                              message: "[JOGGING] Batu 1 kurang " + remainingDeficit.toFixed(1) + " Kg. Memulai Gate Jog ke-" + jogState_batu1.pulseCount + ".",
                              type: 'info'
                            }, ...l]);
                          }
                        }
                      }
                      else if (jogState_batu1.phase === 'jog_on') {
                        setGateBatuSiloOpen(true);
                        setGateBatu1SiloOpen(true);
                        setGateBatu2SiloOpen(false);

                        const inc = operationModeRef.current === 'PRODUKSI' ? 0 : (5 + Math.random() * 3) * 0.1;
                        updated.batu.actual = Math.min(batu1Target, updated.batu.actual + inc);

                        jogState_batu1.timer += 100;
                        if (jogState_batu1.timer >= batu1Config.onTime * 1000) {
                          setGateBatuSiloOpen(false);
                          setGateBatu1SiloOpen(false);
                          setGateBatu2SiloOpen(false);
                          jogState_batu1.phase = 'jog_off';
                          jogState_batu1.timer = 0;
                        }
                      }
                      else if (jogState_batu1.phase === 'jog_off') {
                        setGateBatuSiloOpen(false);
                        setGateBatu1SiloOpen(false);
                        setGateBatu2SiloOpen(false);

                        jogState_batu1.timer += 100;
                        if (jogState_batu1.timer >= batu1Config.offTime * 1000) {
                          const remainingDeficit = batu1Target - updated.batu.actual;
                          if (remainingDeficit <= batu1Config.tolerance) {
                            jogState_batu1.phase = 'done';

                            setRelayLogs(l => [{
                              id: Math.random().toString(36).substring(7).toUpperCase(),
                              timestamp: new Date(),
                              message: "BATU1 COMPLETE",
                              type: 'done'
                            }, {
                              id: Math.random().toString(36).substring(7).toUpperCase(),
                              timestamp: new Date(),
                              message: "[STABIL] Batu 1 selesai setelah " + jogState_batu1.pulseCount + " pulsa. Sisa: " + remainingDeficit.toFixed(1) + " Kg.",
                              type: 'done'
                            }, ...l]);
                          } else {
                            jogState_batu1.phase = 'jog_on';
                            jogState_batu1.timer = 0;
                            jogState_batu1.pulseCount += 1;

                            setRelayLogs(l => [{
                              id: Math.random().toString(36).substring(7).toUpperCase(),
                              timestamp: new Date(),
                              message: "[JOGGING] Batu 1 kurang " + remainingDeficit.toFixed(1) + " Kg. Trigger pulse ke-" + jogState_batu1.pulseCount + "...",
                              type: 'info'
                            }, ...l]);
                          }
                        }
                      }
                    }
                    else if (jogState_batu2.phase !== 'done') {
                      allComplete = false;
                      updated.batu.isActive = true;

                      if (jogState_batu2.phase === 'fast') {
                        setGateBatuSiloOpen(true);
                        setGateBatu1SiloOpen(false);
                        setGateBatu2SiloOpen(true);

                        const inc = operationModeRef.current === 'PRODUKSI' ? 0 : (15 + Math.random() * 8) * 0.1;
                        updated.batu.actual = Math.min(batuTarget, updated.batu.actual + inc);

                        const isBatuJogActive = isJoggingActive(batu2Config);
                        if (!isBatuJogActive) {
                          if (updated.batu.actual >= batuTarget) {
                            setGateBatuSiloOpen(false);
                            setGateBatu1SiloOpen(false);
                            setGateBatu2SiloOpen(false);
                            jogState_batu2.phase = 'done';
                            updated.batu.isComplete = true;
                            updated.batu.isActive = false;

                            setRelayLogs(l => [{
                              id: Math.random().toString(36).substring(7).toUpperCase(),
                              timestamp: new Date(),
                              message: "BATU2 COMPLETE",
                              type: 'done'
                            }, {
                              id: Math.random().toString(36).substring(7).toUpperCase(),
                              timestamp: new Date(),
                              message: "[BATCH CONCRETE] Batu 2 selesai langsung (Single Feed Normal - JOGGING OFF). Berat: " + updated.batu.actual.toFixed(1) + " Kg.",
                              type: 'done'
                            }, ...l]);
                          }
                        } else {
                          if (updated.batu.actual >= fastLimit_batu2) {
                            setGateBatuSiloOpen(false);
                            setGateBatu1SiloOpen(false);
                            setGateBatu2SiloOpen(false);
                            jogState_batu2.phase = 'jeda';
                            jogState_batu2.timer = 0;
                            
                            setRelayLogs(l => [{
                              id: Math.random().toString(36).substring(7).toUpperCase(),
                              timestamp: new Date(),
                              message: "[FAST FEED] Batu 2 mencapai " + batu2Config.targetPercent + "% (" + fastLimit_batu2.toFixed(0) + " Kg). Pintu silo ditutup. Jeda...",
                              type: 'info'
                            }, ...l]);
                          }
                        }
                      }
                      else if (jogState_batu2.phase === 'jeda') {
                        setGateBatuSiloOpen(false);
                        setGateBatu1SiloOpen(false);
                        setGateBatu2SiloOpen(false);

                        jogState_batu2.timer += 100;
                        if (jogState_batu2.timer >= batu2Config.jeda * 1000) {
                          const remainingDeficit = batuTarget - updated.batu.actual;
                          if (remainingDeficit <= batu2Config.tolerance) {
                            jogState_batu2.phase = 'done';
                            updated.batu.isComplete = true;
                            updated.batu.isActive = false;

                            setRelayLogs(l => [{
                              id: Math.random().toString(36).substring(7).toUpperCase(),
                              timestamp: new Date(),
                              message: "BATU2 COMPLETE",
                              type: 'done'
                            }, {
                              id: Math.random().toString(36).substring(7).toUpperCase(),
                              timestamp: new Date(),
                              message: "[STABIL] Batu 2 stabil. Sisa: " + remainingDeficit.toFixed(1) + " Kg <= Toleransi (" + batu2Config.tolerance + " Kg). SELESAI Batu (1+2).",
                              type: 'done'
                            }, ...l]);
                          } else {
                            jogState_batu2.phase = 'jog_on';
                            jogState_batu2.timer = 0;
                            jogState_batu2.pulseCount += 1;

                            setRelayLogs(l => [{
                              id: Math.random().toString(36).substring(7).toUpperCase(),
                              timestamp: new Date(),
                              message: "[JOGGING] Batu 2 kurang " + remainingDeficit.toFixed(1) + " Kg. Memulai Gate Jog ke-" + jogState_batu2.pulseCount + ".",
                              type: 'info'
                            }, ...l]);
                          }
                        }
                      }
                      else if (jogState_batu2.phase === 'jog_on') {
                        setGateBatuSiloOpen(true);
                        setGateBatu1SiloOpen(false);
                        setGateBatu2SiloOpen(true);

                        const inc = operationModeRef.current === 'PRODUKSI' ? 0 : (5 + Math.random() * 3) * 0.1;
                        updated.batu.actual = Math.min(batuTarget, updated.batu.actual + inc);

                        jogState_batu2.timer += 100;
                        if (jogState_batu2.timer >= batu2Config.onTime * 1000) {
                          setGateBatuSiloOpen(false);
                          setGateBatu1SiloOpen(false);
                          setGateBatu2SiloOpen(false);
                          jogState_batu2.phase = 'jog_off';
                          jogState_batu2.timer = 0;
                        }
                      }
                      else if (jogState_batu2.phase === 'jog_off') {
                        setGateBatuSiloOpen(false);
                        setGateBatu1SiloOpen(false);
                        setGateBatu2SiloOpen(false);

                        jogState_batu2.timer += 100;
                        if (jogState_batu2.timer >= batu2Config.offTime * 1000) {
                          const remainingDeficit = batuTarget - updated.batu.actual;
                          if (remainingDeficit <= batu2Config.tolerance) {
                            jogState_batu2.phase = 'done';
                            updated.batu.isComplete = true;
                            updated.batu.isActive = false;

                            setRelayLogs(l => [{
                              id: Math.random().toString(36).substring(7).toUpperCase(),
                              timestamp: new Date(),
                              message: "BATU2 COMPLETE",
                              type: 'done'
                            }, {
                              id: Math.random().toString(36).substring(7).toUpperCase(),
                              timestamp: new Date(),
                              message: "[STABIL] Batu 2 selesai setelah " + jogState_batu2.pulseCount + " pulsa. Sisa: " + remainingDeficit.toFixed(1) + " Kg.",
                              type: 'done'
                            }, ...l]);
                          } else {
                            jogState_batu2.phase = 'jog_on';
                            jogState_batu2.timer = 0;
                            jogState_batu2.pulseCount += 1;

                            setRelayLogs(l => [{
                              id: Math.random().toString(36).substring(7).toUpperCase(),
                              timestamp: new Date(),
                              message: "[JOGGING] Batu 2 kurang " + remainingDeficit.toFixed(1) + " Kg. Trigger pulse ke-" + jogState_batu2.pulseCount + "...",
                              type: 'info'
                            }, ...l]);
                          }
                        }
                      }
                    } else {
                      updated.batu.isActive = false;
                      updated.batu.isComplete = true;
                      setGateBatuSiloOpen(false);
                      setGateBatu1SiloOpen(false);
                      setGateBatu2SiloOpen(false);
                    }
                  } else {
                    // Sand is still weighing under System 2. Keep stone gates closed.
                    allComplete = false;
                    updated.batu.isActive = false;
                    setGateBatuSiloOpen(false);
                    setGateBatu1SiloOpen(false);
                    setGateBatu2SiloOpen(false);
                  }
                }
                // Else (Auto is OFF and no manual jog is active for this material):
                else {
                  allComplete = false;
                  updated.batu.isActive = false;
                  setGateBatuSiloOpen(false);
                  setGateBatu1SiloOpen(false);
                  setGateBatu2SiloOpen(false);
                }
              }
            }

            // 3. Cement (Semen)
            const semenConfig = joggingSettings.find((r: any) => r.material === "Semen") || { targetPercent: 95, jeda: 2.0, onTime: 0.3, offTime: 1.5, tolerance: 5 };
            const semenTarget = updated.semen.target;
            const fastLimit_semen = (semenConfig.targetPercent / 100) * semenTarget;
            const jogState_semen = weighingJogStatesRef.current.semen;

            if (semenTarget > 0) {
              // Safety interlock: jika target material sudah >= setpoint, actuator tetap OFF
              if (updated.semen.actual >= semenTarget) {
                updated.semen.isActive = false;
                updated.semen.isComplete = true;
                setScrewSemenActive(false);
                jogState_semen.phase = 'done';
              } else {
                // If currently manual-jogging this specific material:
                if (joggingSemenRef.current) {
                  allComplete = false;
                  updated.semen.isActive = true;
                  
                  // Turn on cement screw (Independent channel)
                  setScrewSemenActive(true);
                  
                  // Increment Cement weight smoothly
                  const inc = operationModeRef.current === 'PRODUKSI' ? 0 : (2.5 + Math.random() * 1.5) * 0.1; // 0.25 - 0.4 kg / tick
                  updated.semen.actual = Math.min(semenTarget, updated.semen.actual + inc);
                  
                  if (updated.semen.actual >= semenTarget) {
                    updated.semen.isComplete = true;
                    updated.semen.isActive = false;
                    setScrewSemenActive(false);
                    jogState_semen.phase = 'done';
                  }
                } 
                // Else, if someone is manual-jogging ANOTHER material, isolate cement and keep it OFF
                else if (isAnyManualJogActive) {
                  allComplete = false;
                  setScrewSemenActive(false);
                }
                // Else, automatic batching:
                else if (isAuto || (batchingModeRef.current === 'SEMI_AUTO' && semiAutoDosingRef.current.semen)) {
                  if (jogState_semen.phase !== 'done') {
                    allComplete = false;
                    updated.semen.isActive = true;

                    if (jogState_semen.phase === 'fast') {
                      setScrewSemenActive(true);

                      const inc = operationModeRef.current === 'PRODUKSI' ? 0 : (8 + Math.random() * 4) * 0.1; 
                      updated.semen.actual = Math.min(semenTarget, updated.semen.actual + inc);

                      const isSemenJogActive = isJoggingActive(semenConfig);
                      if (!isSemenJogActive) {
                        if (updated.semen.actual >= semenTarget) {
                          setScrewSemenActive(false);
                          jogState_semen.phase = 'done';
                          updated.semen.isComplete = true;
                          updated.semen.isActive = false;

                          setRelayLogs(l => [{
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "[BATCH CONCRETE] Semen selesai langsung (Single Feed Normal - JOGGING OFF). Berat: " + updated.semen.actual.toFixed(1) + " Kg.",
                            type: 'done'
                          }, ...l]);
                        }
                      } else {
                        if (updated.semen.actual >= fastLimit_semen) {
                          setScrewSemenActive(false);
                          jogState_semen.phase = 'jeda';
                          jogState_semen.timer = 0;
                          
                          setRelayLogs(l => [{
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "[FAST FEED] Semen mencapai " + semenConfig.targetPercent + "% (" + fastLimit_semen.toFixed(0) + " Kg). Screw Conveyor dimatikan. Jeda...",
                            type: 'info'
                          }, ...l]);
                        }
                      }
                    } 
                    else if (jogState_semen.phase === 'jeda') {
                      setScrewSemenActive(false);

                      jogState_semen.timer += 100;
                      if (jogState_semen.timer >= semenConfig.jeda * 1000) {
                        const remainingDeficit = semenTarget - updated.semen.actual;
                        if (remainingDeficit <= semenConfig.tolerance) {
                          jogState_semen.phase = 'done';
                          updated.semen.isComplete = true;
                          updated.semen.isActive = false;

                          setRelayLogs(l => [{
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "[STABIL] Semen stabil. Sisa: " + remainingDeficit.toFixed(1) + " Kg <= Toleransi (" + semenConfig.tolerance + " Kg). SELESAI.",
                            type: 'done'
                          }, ...l]);
                        } else {
                          jogState_semen.phase = 'jog_on';
                          jogState_semen.timer = 0;
                          jogState_semen.pulseCount += 1;

                          setRelayLogs(l => [{
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "[JOGGING] Semen kurang " + remainingDeficit.toFixed(1) + " Kg. Memulai Screw Jog ke-" + jogState_semen.pulseCount + ".",
                            type: 'info'
                          }, ...l]);
                        }
                      }
                    }
                    else if (jogState_semen.phase === 'jog_on') {
                      setScrewSemenActive(true);

                      const inc = operationModeRef.current === 'PRODUKSI' ? 0 : (2.5 + Math.random() * 1.5) * 0.1; 
                      updated.semen.actual = Math.min(semenTarget, updated.semen.actual + inc);

                      jogState_semen.timer += 100;
                      if (jogState_semen.timer >= semenConfig.onTime * 1000) {
                        setScrewSemenActive(false);
                        jogState_semen.phase = 'jog_off';
                        jogState_semen.timer = 0;
                      }
                    }
                    else if (jogState_semen.phase === 'jog_off') {
                      setScrewSemenActive(false);

                      jogState_semen.timer += 100;
                      if (jogState_semen.timer >= semenConfig.offTime * 1000) {
                        const remainingDeficit = semenTarget - updated.semen.actual;
                        if (remainingDeficit <= semenConfig.tolerance) {
                          jogState_semen.phase = 'done';
                          updated.semen.isComplete = true;
                          updated.semen.isActive = false;

                          setRelayLogs(l => [{
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "[STABIL] Semen selesai setelah " + jogState_semen.pulseCount + " pulsa. Sisa: " + remainingDeficit.toFixed(1) + " Kg.",
                            type: 'done'
                          }, ...l]);
                        } else {
                          jogState_semen.phase = 'jog_on';
                          jogState_semen.timer = 0;
                          jogState_semen.pulseCount += 1;

                          setRelayLogs(l => [{
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "[JOGGING] Semen kurang " + remainingDeficit.toFixed(1) + " Kg. Trigger Screw Pulse ke-" + jogState_semen.pulseCount + "...",
                            type: 'info'
                          }, ...l]);
                        }
                      }
                    }
                  } else {
                    updated.semen.isActive = false;
                    updated.semen.isComplete = true;
                    setScrewSemenActive(false);
                  }
                }
                // Else (Auto is OFF and no manual jog is active for this material):
                else {
                  allComplete = false;
                  updated.semen.isActive = false;
                  setScrewSemenActive(false);
                }
              }
            }

            // 4. Water (Air & Aditif)
            const airConfig = joggingSettings.find((r: any) => r.material === "Air") || { targetPercent: 96, jeda: 1.0, onTime: 0.2, offTime: 1.0, tolerance: 2 };
            const airTarget = updated.air.target;
            const fastLimit_air = (airConfig.targetPercent / 100) * airTarget;
            const jogState_air = weighingJogStatesRef.current.air;

            if (airTarget > 0) {
              // Safety interlock: jika target material sudah >= setpoint, actuator tetap OFF
              if (updated.air.actual >= airTarget) {
                updated.air.isActive = false;
                updated.air.isComplete = true;
                setValveWaterActive(false);
                jogState_air.phase = 'done';
              } else {
                // If currently manual-jogging this specific material:
                if (joggingAirRef.current) {
                  allComplete = false;
                  updated.air.isActive = true;
                  
                  // Turn on water valve (Independent channel)
                  setValveWaterActive(true);
                  
                  // Increment Water weight smoothly
                  const inc = operationModeRef.current === 'PRODUKSI' ? 0 : (1.5 + Math.random() * 1.0) * 0.1; // 0.15 - 0.25 kg / tick
                  updated.air.actual = Math.min(airTarget, updated.air.actual + inc);
                  
                  if (updated.air.actual >= airTarget) {
                    updated.air.isComplete = true;
                    updated.air.isActive = false;
                    setValveWaterActive(false);
                    jogState_air.phase = 'done';
                  }
                } 
                // Else, if someone is manual-jogging ANOTHER material, isolate water and keep it OFF
                else if (isAnyManualJogActive) {
                  allComplete = false;
                  setValveWaterActive(false);
                }
                // Else, automatic batching:
                else if (isAuto || (batchingModeRef.current === 'SEMI_AUTO' && semiAutoDosingRef.current.air)) {
                  if (jogState_air.phase !== 'done') {
                    allComplete = false;
                    updated.air.isActive = true;

                    if (jogState_air.phase === 'fast') {
                      setValveWaterActive(true);

                      const inc = operationModeRef.current === 'PRODUKSI' ? 0 : (5 + Math.random() * 2) * 0.1; 
                      updated.air.actual = Math.min(airTarget, updated.air.actual + inc);

                      const isAirJogActive = isJoggingActive(airConfig);
                      if (!isAirJogActive) {
                        if (updated.air.actual >= airTarget) {
                          setValveWaterActive(false);
                          jogState_air.phase = 'done';
                          updated.air.isComplete = true;
                          updated.air.isActive = false;

                          setRelayLogs(l => [{
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "[BATCH CONCRETE] Air selesai langsung (Single Feed Normal - JOGGING OFF). Berat: " + updated.air.actual.toFixed(1) + " Kg.",
                            type: 'done'
                          }, ...l]);
                        }
                      } else {
                        if (updated.air.actual >= fastLimit_air) {
                          setValveWaterActive(false);
                          jogState_air.phase = 'jeda';
                          jogState_air.timer = 0;
                          
                          setRelayLogs(l => [{
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "[FAST FEED] Air mencapai " + airConfig.targetPercent + "% (" + fastLimit_air.toFixed(0) + " Kg). Valve utama ditutup. Jeda...",
                            type: 'info'
                          }, ...l]);
                        }
                      }
                    } 
                    else if (jogState_air.phase === 'jeda') {
                      setValveWaterActive(false);

                      jogState_air.timer += 100;
                      if (jogState_air.timer >= airConfig.jeda * 1000) {
                        const remainingDeficit = airTarget - updated.air.actual;
                        if (remainingDeficit <= airConfig.tolerance) {
                          jogState_air.phase = 'done';
                          updated.air.isComplete = true;
                          updated.air.isActive = false;

                          setRelayLogs(l => [{
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "[STABIL] Air stabil. Sisa: " + remainingDeficit.toFixed(1) + " Kg <= Toleransi (" + airConfig.tolerance + " Kg). SELESAI.",
                            type: 'done'
                          }, ...l]);
                        } else {
                          jogState_air.phase = 'jog_on';
                          jogState_air.timer = 0;
                          jogState_air.pulseCount += 1;

                          setRelayLogs(l => [{
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "[JOGGING] Air kurang " + remainingDeficit.toFixed(1) + " Kg. Memulai Valve Jog ke-" + jogState_air.pulseCount + ".",
                            type: 'info'
                          }, ...l]);
                        }
                      }
                    }
                    else if (jogState_air.phase === 'jog_on') {
                      setValveWaterActive(true);

                      const inc = operationModeRef.current === 'PRODUKSI' ? 0 : (1.5 + Math.random() * 1.0) * 0.1; 
                      updated.air.actual = Math.min(airTarget, updated.air.actual + inc);

                      jogState_air.timer += 100;
                      if (jogState_air.timer >= airConfig.onTime * 1000) {
                        setValveWaterActive(false);
                        jogState_air.phase = 'jog_off';
                        jogState_air.timer = 0;
                      }
                    }
                    else if (jogState_air.phase === 'jog_off') {
                      setValveWaterActive(false);

                      jogState_air.timer += 100;
                      if (jogState_air.timer >= airConfig.offTime * 1000) {
                        const remainingDeficit = airTarget - updated.air.actual;
                        if (remainingDeficit <= airConfig.tolerance) {
                          jogState_air.phase = 'done';
                          updated.air.isComplete = true;
                          updated.air.isActive = false;

                          setRelayLogs(l => [{
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "[STABIL] Air selesai setelah " + jogState_air.pulseCount + " pulsa. Sisa: " + remainingDeficit.toFixed(1) + " Kg.",
                            type: 'done'
                          }, ...l]);
                        } else {
                          jogState_air.phase = 'jog_on';
                          jogState_air.timer = 0;
                          jogState_air.pulseCount += 1;

                          setRelayLogs(l => [{
                            id: Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: "[JOGGING] Air kurang " + remainingDeficit.toFixed(1) + " Kg. Trigger Valve Pulse ke-" + jogState_air.pulseCount + "...",
                            type: 'info'
                          }, ...l]);
                        }
                      }
                    }
                  } else {
                    updated.air.isActive = false;
                    updated.air.isComplete = true;
                    setValveWaterActive(false);
                  }
                }
                // Else (Auto is OFF and no manual jog is active for this material):
                else {
                  allComplete = false;
                  updated.air.isActive = false;
                  setValveWaterActive(false);
                }
              }
                     if (batchingModeRef.current === 'SEMI_AUTO') {
              let updatedSemiAuto = { ...semiAutoDosingRef.current };
              let changed = false;

              if (semiAutoDosingRef.current.pasir1 && weighingJogStatesRef.current.pasir1.phase === 'done') {
                updatedSemiAuto.pasir1 = false;
                changed = true;
                setRelayLogs(prev => [
                  {
                    id: 'SEMI-P1-DONE-' + Math.random().toString(36).substring(7).toUpperCase(),
                    timestamp: new Date(),
                    message: `[SEMI AUTO] Dosing PASIR 1 Selesai. Actual: ${updated.pasir.actual.toFixed(1)} Kg.`,
                    type: 'done'
                  },
                  ...prev
                ]);
              }
              if (semiAutoDosingRef.current.pasir2 && weighingJogStatesRef.current.pasir2.phase === 'done') {
                updatedSemiAuto.pasir2 = false;
                changed = true;
                setRelayLogs(prev => [
                  {
                    id: 'SEMI-P2-DONE-' + Math.random().toString(36).substring(7).toUpperCase(),
                    timestamp: new Date(),
                    message: `[SEMI AUTO] Dosing PASIR 2 Selesai. Actual: ${updated.pasir.actual.toFixed(1)} Kg.`,
                    type: 'done'
                  },
                  ...prev
                ]);
              }
              if (semiAutoDosingRef.current.batu1 && weighingJogStatesRef.current.batu1.phase === 'done') {
                updatedSemiAuto.batu1 = false;
                changed = true;
                setRelayLogs(prev => [
                  {
                    id: 'SEMI-B1-DONE-' + Math.random().toString(36).substring(7).toUpperCase(),
                    timestamp: new Date(),
                    message: `[SEMI AUTO] Dosing BATU 1 Selesai. Actual: ${updated.batu.actual.toFixed(1)} Kg.`,
                    type: 'done'
                  },
                  ...prev
                ]);
              }
              if (semiAutoDosingRef.current.batu2 && weighingJogStatesRef.current.batu2.phase === 'done') {
                updatedSemiAuto.batu2 = false;
                changed = true;
                setRelayLogs(prev => [
                  {
                    id: 'SEMI-B2-DONE-' + Math.random().toString(36).substring(7).toUpperCase(),
                    timestamp: new Date(),
                    message: `[SEMI AUTO] Dosing BATU 2 Selesai. Actual: ${updated.batu.actual.toFixed(1)} Kg.`,
                    type: 'done'
                  },
                  ...prev
                ]);
              }
              if (semiAutoDosingRef.current.semen && weighingJogStatesRef.current.semen.phase === 'done') {
                updatedSemiAuto.semen = false;
                changed = true;
                setRelayLogs(prev => [
                  {
                    id: 'SEMI-SEM-DONE-' + Math.random().toString(36).substring(7).toUpperCase(),
                    timestamp: new Date(),
                    message: `[SEMI AUTO] Dosing SEMEN Selesai. Actual: ${updated.semen.actual.toFixed(1)} Kg.`,
                    type: 'done'
                  },
                  ...prev
                ]);
              }
              if (semiAutoDosingRef.current.air && weighingJogStatesRef.current.air.phase === 'done') {
                updatedSemiAuto.air = false;
                changed = true;
                setRelayLogs(prev => [
                  {
                    id: 'SEMI-AIR-DONE-' + Math.random().toString(36).substring(7).toUpperCase(),
                    timestamp: new Date(),
                    message: `[SEMI AUTO] Dosing AIR Selesai. Actual: ${updated.air.actual.toFixed(1)} Kg.`,
                    type: 'done'
                  },
                  ...prev
                ]);
              }

              if (changed) {
                setSemiAutoDosing(updatedSemiAuto);
              }
            }

            const isSemi = batchingModeRef.current === 'SEMI_AUTO';
            if ((allComplete && !isSemi) || updated.pasir.isComplete) {
              pasirWeighedRef.current = true;
            }
            if ((allComplete && !isSemi) || updated.batu.isComplete) {
              batuWeighedRef.current = true;
            }
            if ((allComplete && !isSemi) || updated.semen.isComplete) {
              semenWeighedRef.current = true;
            }
            if ((allComplete && !isSemi) || updated.air.isComplete) {
              airWeighedRef.current = true;
            }

            const allWeighed = (pasirWeighedRef.current || updated.pasir.target === 0) &&
                               (batuWeighedRef.current || updated.batu.target === 0) &&
                               (semenWeighedRef.current || updated.semen.target === 0) &&
                               (airWeighedRef.current || updated.air.target === 0);

            const isAggWeighedNow = (pasirWeighedRef.current || updated.pasir.target === 0) &&
                                     (batuWeighedRef.current || updated.batu.target === 0);

            if (isAggWeighedNow && !aggregateReadyLoggedRef.current) {
              aggregateReadyLoggedRef.current = true;
              setProductionState('AGGREGATE_READY');
              setRelayLogs(l => [{
                id: 'AGG-RDY-' + Math.random().toString(36).substring(7).toUpperCase(),
                timestamp: new Date(),
                message: "AGGREGATE_READY",
                type: 'done'
              }, ...l]);
            }

            if (allWeighed) {
              weighingActiveRef.current = false;
              setIsWeighingActive(false);
              setProductionState('AGGREGATE_READY');
            }
          }

            // --- Declarative tracking of individual material cycles' actual weights ---
            const jStateP1 = weighingJogStatesRef.current.pasir1;
            const jStateP2 = weighingJogStatesRef.current.pasir2;
            const jStateB1 = weighingJogStatesRef.current.batu1;
            const jStateB2 = weighingJogStatesRef.current.batu2;
            const jStateSemen = weighingJogStatesRef.current.semen;
            const jStateAir = weighingJogStatesRef.current.air;

            if (updated.pasir.target === 0) {
              actualPasir1Ref.current = 0;
              actualPasir2Ref.current = 0;
              jStateP1.phase = 'done';
              jStateP2.phase = 'done';
            } else {
              if (jStateP1.phase !== 'done') {
                actualPasir1Ref.current = updated.pasir.actual;
              }
              if (jStateP1.phase === 'done' && jStateP2.phase !== 'done') {
                actualPasir2Ref.current = Math.max(0, updated.pasir.actual - actualPasir1Ref.current);
              }
            }

            if (updated.batu.target === 0) {
              actualBatu1Ref.current = 0;
              actualBatu2Ref.current = 0;
              jStateB1.phase = 'done';
              jStateB2.phase = 'done';
            } else {
              if (jStateB1.phase !== 'done') {
                actualBatu1Ref.current = updated.batu.actual;
              }
              if (jStateB1.phase === 'done' && jStateB2.phase !== 'done') {
                actualBatu2Ref.current = Math.max(0, updated.batu.actual - actualBatu1Ref.current);
              }
            }

            if (updated.semen.target === 0) {
              actualSemenRef.current = 0;
              jStateSemen.phase = 'done';
            } else if (jStateSemen.phase !== 'done') {
              actualSemenRef.current = updated.semen.actual;
            }

            if (updated.air.target === 0) {
              actualAirRef.current = 0;
              jStateAir.phase = 'done';
            } else if (jStateAir.phase !== 'done') {
              actualAirRef.current = updated.air.actual;
            }

            const actualIncSemen = updated.semen.actual - prev.semen.actual;
            if (actualIncSemen > 0) {
              const match = activeSiloSemenRef.current.match(/Silo\s*(\d+)/i);
              const siloIdx = match ? parseInt(match[1], 10) - 1 : 2;
              if (siloIdx >= 0 && siloIdx < 6) {
                setTimeout(() => {
                  setSiloWeights(prevSilos => {
                    const nextSilos = [...prevSilos];
                    nextSilos[siloIdx] = Math.max(0, nextSilos[siloIdx] - actualIncSemen);
                    return nextSilos;
                  });
                }, 0);
              }
            }

            return updated;
          });
        }

        if (batchingModeRef.current === 'SEMI_AUTO') {
          return;
        }

        // --- 1.8. INDUSTRIAL TRANSIT TICKER ---
        // We always tick/decrement the transit queue timer while running, regardless of whether waiting hopper is enabled,
        // so that we can track when aggregates are physically delivered into the mixer
        let newlyArrivedWeight = 0;
        aggregateTransitQueueRef.current = aggregateTransitQueueRef.current.map(chunk => {
          const nextTicks = chunk.ticksNeeded - 1;
          if (nextTicks <= 0) {
            newlyArrivedWeight += chunk.amount;
            return null;
          }
          return { ...chunk, ticksNeeded: nextTicks };
        }).filter(Boolean) as any[];

        if (newlyArrivedWeight > 0) {
          const sandTarget = scalesRef.current.pasir.target;
          const stoneTarget = scalesRef.current.batu.target;
          const totalAggWeight = sandTarget + stoneTarget;

          // Arrive directly inside the mixer if waiting hopper is disabled or if it's Batch 1
          const isDirect = !waitingHopperEnabled || (currentBatchRef.current === 0);

          if (isDirect) {
            aggregateInMixerRef.current = Math.min(
              totalAggWeight,
              aggregateInMixerRef.current + newlyArrivedWeight
            );
          } else {
            // Land in the waiting hopper
            const nextWeight = Math.min(totalAggWeight, waitingHopperWeightRef.current + newlyArrivedWeight);
            setWaitingHopperWeightSync(nextWeight);
          }
        }

        // Now handle the industrial waiting hopper states if enabled
        if (waitingHopperEnabled && (targetBatchRef.current > 1)) {
          const whState = waitingHopperStateRef.current;

          // A: WAITING_HOPPER_IDLE State
          if (whState === 'WAITING_HOPPER_IDLE') {
            // Wait for sand & stone scales to be complete for Batch 2 and subsequent batches
            if (weighingCycleRef.current > 1) {
              const isSandReady = scalesRef.current.pasir.target === 0 || 
                                  scalesRef.current.pasir.isComplete || 
                                  scalesRef.current.pasir.actual >= scalesRef.current.pasir.target;

              const isStoneReady = scalesRef.current.batu.target === 0 || 
                                   scalesRef.current.batu.isComplete || 
                                   scalesRef.current.batu.actual >= scalesRef.current.batu.target;

              const isAggWeighed = isSandReady && isStoneReady;

              if (isAggWeighed && (scalesRef.current.pasir.actual > 0 || scalesRef.current.batu.actual > 0)) {
                setWaitingHopperStateSync('WAITING_HOPPER_FILLING');
                waitingHopperTimerRef.current = 0;
                system1WaitingSeqRef.current = 'idle';
                system1WaitingSeqTimerRef.current = 0;
                setConveyorBottomPhaseSync('STANDBY'); // will be prestarted on next tick

                setRelayLogs(l => [
                  {
                    id: Math.random().toString(36).substring(7).toUpperCase(),
                    timestamp: new Date(),
                    message: `[WAITING HOPPER] Aggregate Batch ${weighingCycleRef.current} selesai ditimbang. Mentransfer material ke Chute Waiting Hopper...`,
                    type: 'info'
                  },
                  ...l
                ]);
              }
            }
          }

          // B: WAITING_HOPPER_FILLING State
          else if (whState === 'WAITING_HOPPER_FILLING') {
            // Keep Gate Chute CLOSED holding material
            setWaitingHopperGateOpenSync(false);

            if (conveyorBottomPhaseRef.current === 'STANDBY') {
              // Initiate PRESTART phase of bottom conveyor
              setConveyorBottomPhaseSync('PRESTART');
              conveyorBottomTimerRef.current = 0;
              setConveyorBottomActiveSync(true);
              setRelayLogs(l => [
                {
                  id: 'BCON-' + Math.random().toString(36).substring(7).toUpperCase(),
                  timestamp: new Date(),
                  message: "BOTTOM CONVEYOR ON",
                  type: 'info'
                },
                {
                  id: 'PRE-' + Math.random().toString(36).substring(7).toUpperCase(),
                  timestamp: new Date(),
                  message: "BOTTOM CONVEYOR PRESTART 2s",
                  type: 'info'
                },
                ...l
              ]);
            }

            if (conveyorBottomPhaseRef.current === 'PRESTART') {
              // Doors remain closed
              setGatePasirHopperOpenSync(false);
              setGateBatuHopperOpenSync(false);

              conveyorBottomTimerRef.current += 100;
              if (conveyorBottomTimerRef.current >= 2000) { // 2.0s prestart delay
                // Transition to TRANSFER phase
                setConveyorBottomPhaseSync('TRANSFER');
                conveyorBottomTimerRef.current = 0;
                setProductionState('AGGREGATE_DISCHARGE');
                setRelayLogs(l => [{
                  id: 'DIS-' + Math.random().toString(36).substring(7).toUpperCase(),
                  timestamp: new Date(),
                  message: "AGGREGATE DISCHARGE START",
                  type: 'info'
                }, ...l]);
              }
            }

            else if (conveyorBottomPhaseRef.current === 'TRANSFER') {
              if (batchingPlantMode === 'SYSTEM_1') {
                if (system1WaitingSeqRef.current === 'idle') {
                  system1WaitingSeqRef.current = 'sand_discharging';
                  system1WaitingSeqTimerRef.current = 0;
                  setRelayLogs(l => [{
                    id: 'SAND-DIS-' + Math.random().toString(36).substring(7).toUpperCase(),
                    timestamp: new Date(),
                    message: "SAND DISCHARGE START",
                    type: 'info'
                  }, ...l]);
                }

                if (system1WaitingSeqRef.current === 'sand_discharging') {
                  // Only pasir door is open, stone remains closed
                  setGatePasirHopperOpenSync(scalesRef.current.pasir.actual > 2.0);
                  setGateBatuHopperOpenSync(false);

                  // Drain only pasir actual volume
                  setScalesSync(prev => {
                    const next = { ...prev };
                    const drainPasir = Math.min(prev.pasir.actual, (25 + Math.random() * 15) * 0.1); // 2.5 - 4.0 kg per tick
                    if (operationModeRef.current !== 'PRODUKSI') {
                      next.pasir.actual = Math.max(0, next.pasir.actual - drainPasir);
                    }
                    if (drainPasir > 0) {
                      aggregateTransitQueueRef.current.push({ amount: drainPasir, ticksNeeded: 45 });
                    }
                    return next;
                  });

                  // When pasir becomes empty
                  if (scalesRef.current.pasir.actual <= 2.0) {
                    setGatePasirHopperOpenSync(false);
                    system1WaitingSeqRef.current = 'sand_empty_delay';
                    system1WaitingSeqTimerRef.current = 0;
                    setRelayLogs(l => [
                      {
                        id: 'SAND-EMP-' + Math.random().toString(36).substring(7).toUpperCase(),
                        timestamp: new Date(),
                        message: "SAND SCALE EMPTY",
                        type: 'done'
                      },
                      {
                        id: 'SAND-WAIT-' + Math.random().toString(36).substring(7).toUpperCase(),
                        timestamp: new Date(),
                        message: "WAIT 1 SECONDS",
                        type: 'info'
                      },
                      ...l
                    ]);
                  }
                }
                else if (system1WaitingSeqRef.current === 'sand_empty_delay') {
                  // Keep both gates closed
                  setGatePasirHopperOpenSync(false);
                  setGateBatuHopperOpenSync(false);

                  system1WaitingSeqTimerRef.current += 100;
                  if (system1WaitingSeqTimerRef.current >= 1000) {
                    system1WaitingSeqRef.current = 'stone_discharging';
                    system1WaitingSeqTimerRef.current = 0;
                    setRelayLogs(l => [{
                      id: 'STONE-DIS-' + Math.random().toString(36).substring(7).toUpperCase(),
                      timestamp: new Date(),
                      message: "STONE DISCHARGE START",
                      type: 'info'
                    }, ...l]);
                  }
                }
                else if (system1WaitingSeqRef.current === 'stone_discharging') {
                  // Only stone door is open, pasir remains closed
                  setGatePasirHopperOpenSync(false);
                  setGateBatuHopperOpenSync(scalesRef.current.batu.actual > 2.0);

                  // Drain only stone actual volume
                  setScalesSync(prev => {
                    const next = { ...prev };
                    const drainBatu = Math.min(prev.batu.actual, (30 + Math.random() * 20) * 0.1);  // 3.0 - 5.0 kg per tick
                    if (operationModeRef.current !== 'PRODUKSI') {
                      next.batu.actual = Math.max(0, next.batu.actual - drainBatu);
                    }
                    if (drainBatu > 0) {
                      aggregateTransitQueueRef.current.push({ amount: drainBatu, ticksNeeded: 32 });
                    }
                    return next;
                  });

                  // When stone becomes empty
                  if (scalesRef.current.batu.actual <= 2.0) {
                    setGateBatuHopperOpenSync(false);
                    system1WaitingSeqRef.current = 'done';
                    setRelayLogs(l => [{
                      id: 'STONE-EMP-' + Math.random().toString(36).substring(7).toUpperCase(),
                      timestamp: new Date(),
                      message: "STONE SCALE EMPTY",
                      type: 'done'
                    }, ...l]);
                  }
                }
              } else {
                // System 2 & 3: Keep original concurrent discharge
                setGatePasirHopperOpenSync(scalesRef.current.pasir.actual > 2.0);
                setGateBatuHopperOpenSync(scalesRef.current.batu.actual > 2.0);

                // Drain scales actual volumes
                setScalesSync(prev => {
                  const next = { ...prev };
                  const drainPasir = Math.min(prev.pasir.actual, (25 + Math.random() * 15) * 0.1); // 2.5 - 4.0 kg per tick
                  const drainBatu = Math.min(prev.batu.actual, (30 + Math.random() * 20) * 0.1);  // 3.0 - 5.0 kg per tick
                  if (operationModeRef.current !== 'PRODUKSI') {
                    next.pasir.actual = Math.max(0, next.pasir.actual - drainPasir);
                    next.batu.actual = Math.max(0, next.batu.actual - drainBatu);
                  }
                  if (drainPasir > 0) {
                    aggregateTransitQueueRef.current.push({ amount: drainPasir, ticksNeeded: 45 });
                  }
                  if (drainBatu > 0) {
                    aggregateTransitQueueRef.current.push({ amount: drainBatu, ticksNeeded: 32 });
                  }
                  return next;
                });
              }

              // Once scale hoppers are completely drained
              if (scalesRef.current.pasir.actual <= 2.0 && scalesRef.current.batu.actual <= 2.0) {
                // Close scale doors
                setGatePasirHopperOpenSync(false);
                setGateBatuHopperOpenSync(false);

                // Transition to POSTRUN phase
                setConveyorBottomPhaseSync('POSTRUN');
                conveyorBottomTimerRef.current = 0;
                setRelayLogs(l => [
                  {
                    id: 'SCALE-EMPTY-' + Math.random().toString(36).substring(7).toUpperCase(),
                    timestamp: new Date(),
                    message: "AGGREGATE SCALE EMPTY",
                    type: 'done'
                  },
                  {
                    id: 'POST-' + Math.random().toString(36).substring(7).toUpperCase(),
                    timestamp: new Date(),
                    message: `BOTTOM CONVEYOR POSTRUN ${batchingPlantMode === 'SYSTEM_1' ? '3' : (batchingPlantMode === 'SYSTEM_2' ? '2' : '5')}s`,
                    type: 'info'
                  },
                  ...l
                ]);
              }
            }

            else if (conveyorBottomPhaseRef.current === 'POSTRUN') {
              // Scale doors remain closed
              setGatePasirHopperOpenSync(false);
              setGateBatuHopperOpenSync(false);

              conveyorBottomTimerRef.current += 100;
              const maxPostrunLimit = batchingPlantMode === 'SYSTEM_1' ? 3000 : (batchingPlantMode === 'SYSTEM_2' ? 2000 : 5000);
              if (conveyorBottomTimerRef.current >= maxPostrunLimit) { // 3.0s, 2.0s or 5.0s postrun
                // Turn off bottom conveyor
                setConveyorBottomActiveSync(false);
                setConveyorBottomPhaseSync('STANDBY');
                conveyorBottomTimerRef.current = 0;

                const sandTarget = scalesRef.current.pasir.target;
                const stoneTarget = scalesRef.current.batu.target;
                const totalAggWeight = sandTarget + stoneTarget;

                // Lock/Ready the waiting hopper
                setWaitingHopperGateOpenSync(false);
                setWaitingHopperStateSync('WAITING_HOPPER_READY');
                setWaitingHopperWeightSync(totalAggWeight);

                const logsToAdd = [
                  {
                    id: 'CONV-OFF-' + Math.random().toString(36).substring(7).toUpperCase(),
                    timestamp: new Date(),
                    message: "BOTTOM CONVEYOR OFF",
                    type: 'done'
                  },
                  {
                    id: 'WH-RDY-' + Math.random().toString(36).substring(7).toUpperCase(),
                    timestamp: new Date(),
                    message: "WAITING HOPPER READY",
                    type: 'done'
                  }
                ];

                if (!conveyorTransferCompleteLoggedRef.current) {
                  conveyorTransferCompleteLoggedRef.current = true;
                  setProductionState('WAITING_HOPPER');
                  logsToAdd.push({
                    id: 'CONV-TRSF-CP-' + Math.random().toString(36).substring(7).toUpperCase(),
                    timestamp: new Date(),
                    message: "CONVEYOR_TRANSFER_COMPLETE",
                    type: 'done'
                  });
                }

                setRelayLogs(l => [
                  ...logsToAdd,
                  {
                    id: Math.random().toString(36).substring(7).toUpperCase(),
                    timestamp: new Date(),
                    message: `[WAITING HOPPER] Transfer aggregate selesai. Sump/Chute terkunci (Gate CLOSED, Ready: ${Math.round(totalAggWeight)} Kg).`,
                    type: 'info'
                  },
                  ...l
                ]);
              }
            }
          }

          // C: WAITING_HOPPER_READY State
          else if (whState === 'WAITING_HOPPER_READY') {
            // Keep gate closed and conveyor off
            setWaitingHopperGateOpenSync(false);
          }

          // D: WAITING_HOPPER_DISCHARGING State (PULSE FEEDING OPERATION)
          else if (whState === 'WAITING_HOPPER_DISCHARGING') {
            waitingHopperTimerRef.current += 100;

            const pulseOnMs = waitingHopperPulseOn * 1000;
            const pulseOffMs = waitingHopperPulseOff * 1000;
            const cycleMs = pulseOnMs + pulseOffMs;
            const timeInCycle = waitingHopperTimerRef.current % cycleMs;

            if (timeInCycle < pulseOnMs) {
              // Pulsing ON - pneumatic Gate is OPEN
              setWaitingHopperGateOpenSync(true);

              // Drain material into twin shaft mixer
              const dischargeRate = (14 + Math.random() * 8); // 1.4 - 2.2 kg per tick
              const currentHWeight = waitingHopperWeightRef.current;
              const nextHWeight = Math.max(0, currentHWeight - dischargeRate);
              setWaitingHopperWeightSync(nextHWeight);

              const drainedAmount = currentHWeight - nextHWeight;
              if (drainedAmount > 0) {
                const sandTarget = scalesRef.current.pasir.target;
                const stoneTarget = scalesRef.current.batu.target;
                const totalAggWeight = sandTarget + stoneTarget;
                aggregateInMixerRef.current = Math.min(
                  totalAggWeight,
                  aggregateInMixerRef.current + drainedAmount
                );
              }

              if (nextHWeight === 0) {
                // Done! Waiting hopper is empty
                setWaitingHopperGateOpenSync(false);
                setWaitingHopperStateSync('WAITING_HOPPER_EMPTY');
                setProductionState('AGGREGATE_EMPTY');
                waitingHopperTimerRef.current = 0;
                waitingHopperPrechargeTimerRef.current = 0;
              }
            } else {
              // Pulsing OFF - pneumatic Gate is CLOSED (To protect mixer overload)
              setWaitingHopperGateOpenSync(false);
            }
          }
        }

        // Bypass automatic mixer sequencer when in SEMI_AUTO or MANUAL mode
        if (!isAutoRef.current) {
          return;
        }

        // --- 2. MIXER STATE MACHINE SEQUENCER (TICKING CONCURRENTLY) ---
        const currentState = mixerStateRef.current;

        // Waiting for materials to be ready in the scale hoppers
        if (currentState === 'waiting') {
          // Sync HMI display state word
          setMixerStatusText('WAITING WEIGH MATERIAL');
          
          if (!weighingActiveRef.current) {
            // Once Weighing is READY, transition to hopper discharge cascade
            setMixerStateSync('discharging_hoppers');
            dischargeTimerMsRef.current = 0;
            sandDischargeStartedRef.current = false;
            sandCompletedElapsedSecRef.current = null;
            
            const logsToAdd = [];
            const isDirectAggTransfer = !waitingHopperEnabled || (currentBatchRef.current === 0);
            if (isDirectAggTransfer) {
              setConveyorBottomPhaseSync('PRESTART');
              conveyorBottomTimerRef.current = 0;
              setConveyorBottomActiveSync(true);
              setProductionState('AGGREGATE_DISCHARGE');
              logsToAdd.push(
                {
                  id: 'BCON-' + Math.random().toString(36).substring(7).toUpperCase(),
                  timestamp: new Date(),
                  message: "BOTTOM CONVEYOR ON",
                  type: 'info'
                },
                {
                  id: 'PRE-' + Math.random().toString(36).substring(7).toUpperCase(),
                  timestamp: new Date(),
                  message: "BOTTOM CONVEYOR PRESTART 2s",
                  type: 'info'
                }
              );
            } else {
              setConveyorBottomPhaseSync('STANDBY');
              setConveyorBottomActiveSync(false);
            }

            if (logsToAdd.length > 0) {
              setRelayLogs(l => [...logsToAdd, ...l]);
            }

            setMixerStatusText('DISCHARGING HOPPERS');
            setConveyorUpperActiveSync(true); // turn on main belt feeder
          }
        }

        // Conveying sand, gravel, cement, and dumping liquids into mixer (Sequential timing)
        else if (currentState === 'discharging_hoppers') {
          dischargeTimerMsRef.current += 100;
          const elapsedSec = dischargeTimerMsRef.current / 1000;

          // Tick bottom conveyor state machine timers in direct discharge mode
          if (conveyorBottomPhaseRef.current === 'PRESTART') {
            conveyorBottomTimerRef.current += 100;
            if (conveyorBottomTimerRef.current >= 2000) { // 2.0s prestart delay
              setConveyorBottomPhaseSync('TRANSFER');
              conveyorBottomTimerRef.current = 0;
              setRelayLogs(l => [{
                id: 'DIS-' + Math.random().toString(36).substring(7).toUpperCase(),
                timestamp: new Date(),
                message: "AGGREGATE DISCHARGE START",
                type: 'info'
              }, ...l]);
            }
          } else if (conveyorBottomPhaseRef.current === 'POSTRUN') {
            conveyorBottomTimerRef.current += 100;
            setConveyorBottomActiveSync(true); // force it to stay on during POSTRUN
            const maxPostrunLimit = batchingPlantMode === 'SYSTEM_1' ? 3000 : (batchingPlantMode === 'SYSTEM_2' ? 2000 : 5000);
            if (conveyorBottomTimerRef.current >= maxPostrunLimit) { // 3.0s, 2.0s or 5.0s postrun
              setConveyorBottomActiveSync(false);
              setConveyorBottomPhaseSync('STANDBY');
              conveyorBottomTimerRef.current = 0;
              setRelayLogs(l => [{
                id: 'CONV-OFF-' + Math.random().toString(36).substring(7).toUpperCase(),
                timestamp: new Date(),
                message: "BOTTOM CONVEYOR OFF",
                type: 'done'
              }, ...l]);
            }
          }

          setScalesSync(prev => {
            const nextScales = { ...prev };
            
            // Fetch modern configuration from our reactive admin panel settings:
            const seq = mixingSequenceRef.current;

            // Get state tracking refs
            const pState = hopperDischargeStatesRef.current.pasir;
            const aState = hopperDischargeStatesRef.current.air;
            const cState = hopperDischargeStatesRef.current.semen;
            const bState = hopperDischargeStatesRef.current.batu;

            // Bypass done immediately if target is 0
            if (pState.phase === 'waiting' && nextScales.pasir.target === 0) { pState.phase = 'done'; }
            if (aState.phase === 'waiting' && nextScales.air.target === 0) { aState.phase = 'done'; }
            if (cState.phase === 'waiting' && nextScales.semen.target === 0) { cState.phase = 'done'; }
            if (bState.phase === 'waiting' && nextScales.batu.target === 0) { bState.phase = 'done'; }

            // Dynamic aggregate bypass and water precharge handler for Waiting Hopper system
            if (waitingHopperEnabled) {
              if (currentBatchRef.current === 0) {
                // Batch 1: aggregate goes directly to mixer. Keep waiting hopper gate open!
                setWaitingHopperGateOpenSync(true);
              } else if (targetBatchRef.current > 1) {
                if (pState.phase === 'waiting' || pState.phase === 'opening' || pState.phase === 'draining' || pState.phase === 'clearing' || pState.phase === 'closing') {
                  pState.phase = 'done';
                  sandCompletedElapsedSecRef.current = 0;
                  sandDischargeStartedRef.current = true;
                }
                if (bState.phase === 'waiting' || bState.phase === 'opening' || bState.phase === 'draining' || bState.phase === 'clearing' || bState.phase === 'closing') {
                  bState.phase = 'done';
                }

                if (waitingHopperStateRef.current === 'WAITING_HOPPER_READY') {
                  const waterTarget = nextScales.air.target;
                  const waterActual = nextScales.air.actual;
                  const waterDischarged = waterTarget - waterActual;
                  const dischargedPercent = waterTarget > 0 ? (waterDischarged / waterTarget) * 100 : 100;

                  if (dischargedPercent >= waitingHopperWaterPrecharge) {
                    waitingHopperPrechargeTimerRef.current += 100;
                    if (waitingHopperPrechargeTimerRef.current >= waitingHopperWaterDelay * 1000) {
                      setWaitingHopperStateSync('WAITING_HOPPER_DISCHARGING');
                      waitingHopperTimerRef.current = 0;
                      waitingHopperPrechargeTimerRef.current = 0;

                      setRelayLogs(l => [{
                        id: Math.random().toString(36).substring(7).toUpperCase(),
                        timestamp: new Date(),
                        message: `[WAITING HOPPER] Air precharge tercapai (${waitingHopperWaterPrecharge}%). Memulai PULSE DISCHARGE Gate Chute...`,
                        type: 'info'
                      }, ...l]);
                    }
                  }
                }
              }
            }

            // 1. PASIR DISCHARGE (M1) Logic is ALWAYS the baseline
            if (pState.phase === 'waiting' && conveyorBottomPhaseRef.current === 'TRANSFER') {
              pState.phase = 'opening';
              pState.timer = 0;
            }
             if (pState.phase === 'opening') {
              setGatePasirHopperOpenSync(true);
              sandDischargeStartedRef.current = true; // Event: ON_SAND_DISCHARGE_START

              pState.timer += 100;
              if (pState.timer >= 1000) {
                pState.phase = 'draining';
                pState.timer = 0;
              }
            } else if (pState.phase === 'draining') {
              setGatePasirHopperOpenSync(true);

              // Drastically reduced rate of Sand drainage for visual smoothness (slow-motion):
              const drain = (8 + Math.random() * 4) * 0.1; // 0.8 - 1.2 kg/tick
              let pDrained = 0;
              if (operationModeRef.current !== 'PRODUKSI') {
                pDrained = Math.min(prev.pasir.actual, drain);
                nextScales.pasir.actual = Math.max(0, prev.pasir.actual - pDrained);
              } else {
                pDrained = Math.max(0, prev.pasir.actual - nextScales.pasir.actual);
              }

              if (pDrained > 0) {
                aggregateTransitQueueRef.current.push({ amount: pDrained, ticksNeeded: 45 });
              }

              if (nextScales.pasir.actual <= 0.5) {
                nextScales.pasir.actual = 0;
                setGatePasirHopperOpenSync(false);
                pState.phase = 'done';
                pState.timer = 0;
                if (sandCompletedElapsedSecRef.current === null && sandDischargeStartedRef.current) {
                  sandCompletedElapsedSecRef.current = elapsedSec;
                }
              }
            } else if (pState.phase === 'clearing' || pState.phase === 'closing') {
              setGatePasirHopperOpenSync(false);
              pState.phase = 'done';
              pState.timer = 0;
              if (sandCompletedElapsedSecRef.current === null && sandDischargeStartedRef.current) {
                sandCompletedElapsedSecRef.current = elapsedSec;
              }
            }

            // A helper to verify if a material should start discharging
            const isTriggered = (mat: 'air' | 'semen' | 'batu') => {
              const item = seq[mat];
              if (item.nomor === 1) {
                // Triggered based on Sand Start (at elapsedSec = 0)
                return elapsedSec >= item.timer;
              } else {
                // Triggered based on Sand Complete (after sand Completed)
                if (sandCompletedElapsedSecRef.current !== null) {
                  return elapsedSec >= (sandCompletedElapsedSecRef.current + item.timer);
                }
                return false;
              }
            };

            // 2. AIR & ADITIF (M2) Logic
            if (aState.phase === 'waiting') {
              if (isTriggered('air')) {
                aState.phase = 'opening';
                aState.timer = 0;
              }
            }
            if (aState.phase === 'opening') {
              setGateWaterHopperOpenSync(true);
              aState.timer += 100;
              if (aState.timer >= 1000) {
                aState.phase = 'draining';
                aState.timer = 0;
              }
            } else if (aState.phase === 'draining') {
              setGateWaterHopperOpenSync(true);
              const drain = (4 + Math.random() * 2) * 0.1; // 0.4 - 0.6 kg/tick
              if (operationModeRef.current !== 'PRODUKSI') {
                const actualDrain = Math.min(nextScales.air.actual, drain);
                nextScales.air.actual = Math.max(0, nextScales.air.actual - drain);
                waterInMixerRef.current += actualDrain;
              }

              if (nextScales.air.actual <= 0.5) {
                nextScales.air.actual = 0;
                setGateWaterHopperOpenSync(false);
                aState.phase = 'done';
                aState.timer = 0;
              }
            } else if (aState.phase === 'clearing' || aState.phase === 'closing') {
              setGateWaterHopperOpenSync(false);
              aState.phase = 'done';
              aState.timer = 0;
            }

            // 3. SEMEN (M3) Logic
            if (cState.phase === 'waiting') {
              if (isTriggered('semen')) {
                cState.phase = 'opening';
                cState.timer = 0;
              }
            }
            if (cState.phase === 'opening') {
              setGateSemenHopperOpenSync(true);
              cState.timer += 100;
              if (cState.timer >= 1000) {
                cState.phase = 'draining';
                cState.timer = 0;
              }
            } else if (cState.phase === 'draining') {
              setGateSemenHopperOpenSync(true);
              const drain = (5 + Math.random() * 3) * 0.1; // 0.5 - 0.8 kg/tick
              if (operationModeRef.current !== 'PRODUKSI') {
                const actualDrain = Math.min(nextScales.semen.actual, drain);
                nextScales.semen.actual = Math.max(0, nextScales.semen.actual - drain);
                semenInMixerRef.current += actualDrain;
              }

              if (nextScales.semen.actual <= 0.5) {
                nextScales.semen.actual = 0;
                setGateSemenHopperOpenSync(false);
                cState.phase = 'done';
                cState.timer = 0;
              }
            } else if (cState.phase === 'clearing' || cState.phase === 'closing') {
              setGateSemenHopperOpenSync(false);
              cState.phase = 'done';
              cState.timer = 0;
            }

            // 4. BATU / KRIS (M4) Logic
            if (bState.phase === 'waiting') {
              if (isTriggered('batu') && conveyorBottomPhaseRef.current === 'TRANSFER') {
                bState.phase = 'opening';
                bState.timer = 0;
              }
            }
            if (bState.phase === 'opening') {
              setGateBatuHopperOpenSync(true);
              bState.timer += 100;
              if (bState.timer >= 1000) {
                bState.phase = 'draining';
                bState.timer = 0;
              }
            } else if (bState.phase === 'draining') {
              setGateBatuHopperOpenSync(true);
              const drain = (10 + Math.random() * 4) * 0.1; // 1.0 - 1.4 kg/tick
              let bDrained = 0;
              if (operationModeRef.current !== 'PRODUKSI') {
                bDrained = Math.min(prev.batu.actual, drain);
                nextScales.batu.actual = Math.max(0, prev.batu.actual - bDrained);
              } else {
                bDrained = Math.max(0, prev.batu.actual - nextScales.batu.actual);
              }

              if (bDrained > 0) {
                aggregateTransitQueueRef.current.push({ amount: bDrained, ticksNeeded: 32 });
              }

              if (nextScales.batu.actual <= 0.5) {
                nextScales.batu.actual = 0;
                setGateBatuHopperOpenSync(false);
                bState.phase = 'done';
                bState.timer = 0;
              }
            } else if (bState.phase === 'clearing' || bState.phase === 'closing') {
              setGateBatuHopperOpenSync(false);
              bState.phase = 'done';
              bState.timer = 0;
            }

            if (conveyorBottomPhaseRef.current === 'TRANSFER') {
              const isPasirDone = nextScales.pasir.target === 0 || pState.phase === 'done' || nextScales.pasir.actual <= 0.5;
              const isBatuDone = nextScales.batu.target === 0 || bState.phase === 'done' || nextScales.batu.actual <= 0.5;
              
              if (isPasirDone && isBatuDone) {
                setConveyorBottomPhaseSync('POSTRUN');
                conveyorBottomTimerRef.current = 0;
                setRelayLogs(l => [
                  {
                    id: 'SCALE-EMPTY-' + Math.random().toString(36).substring(7).toUpperCase(),
                    timestamp: new Date(),
                    message: "AGGREGATE SCALE EMPTY",
                    type: 'done'
                  },
                  {
                    id: 'POST-' + Math.random().toString(36).substring(7).toUpperCase(),
                    timestamp: new Date(),
                    message: `BOTTOM CONVEYOR POSTRUN ${batchingPlantMode === 'SYSTEM_1' ? '3' : (batchingPlantMode === 'SYSTEM_2' ? '2' : '5')}s`,
                    type: 'info'
                  },
                  ...l
                ]);
              }
            }

            // Once everything is fully drained and close complete
            const isWaitingHopperComplete = !waitingHopperEnabled ||
                                            (targetBatchRef.current <= 1) ||
                                            (currentBatchRef.current === 0) ||
                                            waitingHopperStateRef.current === 'WAITING_HOPPER_EMPTY';

            const isConveyorReadyForNextWeigh = batchingPlantMode !== 'SYSTEM_2' || conveyorBottomPhaseRef.current === 'STANDBY';

            const allEmpty = pState.phase === 'done' && 
                             bState.phase === 'done' && 
                             cState.phase === 'done' && 
                             aState.phase === 'done' &&
                             isWaitingHopperComplete &&
                             isConveyorReadyForNextWeigh;

            if (allEmpty) {
              // Reset waiting hopper states for the MIXING cycle to allow next batch transfer
              if (waitingHopperEnabled && (targetBatchRef.current > 1) && (currentBatchRef.current > 0)) {
                setWaitingHopperStateSync('WAITING_HOPPER_IDLE');
                setWaitingHopperWeightSync(0);
                waitingHopperTimerRef.current = 0;
                waitingHopperPrechargeTimerRef.current = 0;
              }
              if (waitingHopperEnabled && currentBatchRef.current === 0) {
                // Done dropping aggregate directly for Batch 1.
                // Close the Waiting Hopper gate so that the upcoming Batch 2 aggregate will be retained!
                setWaitingHopperGateOpenSync(false);
              }

              // Also clear our four weighing completion protection refs
              pasirWeighedRef.current = false;
              batuWeighedRef.current = false;
              semenWeighedRef.current = false;
              airWeighedRef.current = false;

              // Conveyors are left running for 5 seconds of the mixing cycle to completely clear remaining materials
              
              // Close all gates
              setGatePasirHopperOpenSync(false);
              setGateBatuHopperOpenSync(false);
              setGateSemenHopperOpenSync(false);
              setGateWaterHopperOpenSync(false);

              if (weighingCycleRef.current < targetBatchRef.current) {
                // Accumulate the weighed values of this cycle before we tare the scale sensors
                accumPasir1Ref.current += actualPasir1Ref.current;
                accumPasir2Ref.current += actualPasir2Ref.current;
                accumBatu1Ref.current += actualBatu1Ref.current;
                accumBatu2Ref.current += actualBatu2Ref.current;
                accumSemenRef.current += actualSemenRef.current;
                accumAirRef.current += actualAirRef.current;

                // Reset cycle actual tracker refs for the upcoming cycle C+1 weighing
                actualPasir1Ref.current = 0;
                actualPasir2Ref.current = 0;
                actualBatu1Ref.current = 0;
                actualBatu2Ref.current = 0;
                actualSemenRef.current = 0;
                actualAirRef.current = 0;

                weighingCycleRef.current += 1;
                const nextW = weighingCycleRef.current;
                setWeighingCycle(nextW);

                // Start weighing the next batch in parallel!
                weighingActiveRef.current = true;
                aggregateReadyLoggedRef.current = false;
                aggregateDischargeLoggedRef.current = false;
                conveyorTransferStartLoggedRef.current = false;
                conveyorTransferCompleteLoggedRef.current = false;
                setIsWeighingActive(true);
                
                 weighingJogStatesRef.current = {
                   pasir1: { phase: 'fast', timer: 0, pulseCount: 0 },
                   pasir2: { phase: 'fast', timer: 0, pulseCount: 0 },
                   batu1: { phase: 'fast', timer: 0, pulseCount: 0 },
                   batu2: { phase: 'fast', timer: 0, pulseCount: 0 },
                   semen: { phase: 'fast', timer: 0, pulseCount: 0 },
                   air: { phase: 'fast', timer: 0, pulseCount: 0 }
                 };

                 hopperDischargeStatesRef.current = {
                   pasir: { phase: 'waiting', timer: 0 },
                   batu: { phase: 'waiting', timer: 0 },
                   semen: { phase: 'waiting', timer: 0 },
                   air: { phase: 'waiting', timer: 0 }
                 };

                // Tare/Reset scales actual levels to 0 for cycle C+1 weighing
                const tFactor = parseFloat((activeVolume / totalCyclesRef.current).toFixed(2));
                (Object.keys(nextScales) as MaterialType[]).forEach(k => {
                  const targetWeight = Math.round(selectedRecipe.targets[k] * tFactor);
                  nextScales[k] = { 
                    id: k, 
                    label: INITIAL_SCALES[k].label, 
                    actual: 0, 
                    target: targetWeight, 
                    unit: INITIAL_SCALES[k].unit, 
                    isActive: true, 
                    isComplete: false 
                  };
                });

                setRelayLogs(l => [{
                  id: Math.random().toString(36).substring(7).toUpperCase(),
                  timestamp: new Date(),
                  message: `[BUFFER ADVANCE] Hopper kosong. Memulai penimbangan Batch ${nextW} secara paralel!`,
                  type: 'info'
                }, ...l]);
              }

              // Slide into mixing countdown timer
              setMixerStateSync('mixing');
              mixingTimerMsRef.current = 0;
              setProductionState('MIXING');
              setMixerStatusText('MIXING INTENSELY');
            }

            return nextScales;
          });
        }

        // Inside high-speed mixing process
        else if (currentState === 'mixing') {
          mixingTimerMsRef.current += 100;
          const mixSec = mixingTimerMsRef.current / 1000;
          
          // Delay 5.0 seconds of mixing to transition production state word to AGGREGATE_EMPTY
          if (mixSec >= 5.0) {
            if (!conveyorTransferCompleteLoggedRef.current) {
              conveyorTransferCompleteLoggedRef.current = true;
              setProductionState('AGGREGATE_EMPTY');
              setRelayLogs(l => [{
                id: 'CONV-TRSF-CP-' + Math.random().toString(36).substring(7).toUpperCase(),
                timestamp: new Date(),
                message: "CONVEYOR_TRANSFER_COMPLETE",
                type: 'done'
              }, ...l]);
            }
          }

          setMixingCountdown(Math.max(0, Math.ceil(activeMixingTime - mixSec)));
          setMixingTime(Math.min(activeMixingTime, Math.round(mixSec)));

          // Synchronize general production progress bar
          const cur = currentBatchRef.current + 1;
          const tot = targetBatchRef.current || 1;
          const baseProgress = ((cur - 1) / tot) * 100;
          const stepPercent = (mixSec / activeMixingTime) * 100 * (1 / tot) * 0.45;
          setBatchProgress(Math.min(99, Math.round(baseProgress + stepPercent)));

          if (mixSec >= activeMixingTime) {
            // Check Tanpa Operator (Operatorless Mode) restrictions
            if (tanpaOperator) {
              const needsTruck = truckPresenceRequired && !isTruckPresent;
              const needsDriver = driverDischargeRequired && !driverBtnPressed;

              if (needsTruck || needsDriver) {
                // Hold countdown of HMI at 0, hold discharge, transition state
                setMixingCountdown(0);
                setMixingTime(activeMixingTime);

                if (needsTruck) {
                  setProductionState('MENUNGGU TRUK MIXER');
                  setMixerStatusText('STANDBY: TRUK MIXER BELUM TERDETEKSI');
                } else if (needsDriver) {
                  setProductionState('MENUNGGU TOMBOL DRIVER');
                  setMixerStatusText('STANDBY: MENUNGGU DRIVER KONFIRMASI (PIN A5)');
                }
                return; // Guard statement: return early, wait for next tick evaluation
              }
            }

            // Both conditions satisfied (or disabled) -> proceed to discharge!
            // Clean driver confirm signal for next batch
            if (tanpaOperator && driverDischargeRequired) {
              setDriverBtnPressed(false);
            }

            setMixerStateSync('discharging_concrete');
            doorStepRef.current = 1;
            doorTimerMsRef.current = 0;
            setProductionState('DISCHARGING CONCRETE');
            setConcreteDischargeActive(true);

            // Smart logic selection log
            const targetVol = volumePerBatchRef.current || volumePerBatch || 3.5;
            let doorPresetName = "1 m³";
            let activatedRelayId = 14;
            if (targetVol > 1.5 && targetVol <= 2.5) {
              doorPresetName = "2 m³";
              activatedRelayId = 28;
            } else if (targetVol > 2.5) {
              doorPresetName = "3.5 m³";
              activatedRelayId = 29;
            }
            setRelayLogs(l => [{
              id: 'MIXER-AUTO-PINTU-' + Math.random().toString(36).substring(7).toUpperCase(),
              timestamp: new Date(),
              message: `[MIXER] Volume: ${targetVol.toFixed(1)} m³ -> Otomatis menerapkan Setting Pintu Mixer ${doorPresetName} (Relay #${activatedRelayId})`,
              type: 'info'
            }, ...l]);
          }
        }

        // Mixer gradual door open sequence (Relay #14 / #15 triggers)
        else if (currentState === 'discharging_concrete') {
          doorTimerMsRef.current += 100;
          const dTimeTotal = doorTimerMsRef.current;

          // Load timing values from Relay 14 settings
          const relayConfig = loadRelayConfig();
          const targetVol = volumePerBatchRef.current || volumePerBatch || 3.5;
          let selectedRelayId = 14;
          if (targetVol > 1.5 && targetVol <= 2.5) {
            selectedRelayId = 28;
          } else if (targetVol > 2.5) {
            selectedRelayId = 29;
          }
          const row14 = relayConfig.find(r => r.relay === selectedRelayId) || relayConfig.find(r => r.relay === 14);

          // Get raw settings with original hardcoded defaults as fallback:
          const open1Raw = row14 ? parseFloat(row14.timer1) : 2000;
          const pause1Raw = row14 ? parseFloat(row14.timer2) : 6000;
          const open2Raw = row14 ? parseFloat(row14.timer3) : 3000;
          const pause2Raw = row14 ? parseFloat(row14.timer4) : 5000;
          const open3Raw = row14 ? parseFloat(row14.timer5) : 3000;
          const pause3Raw = row14 ? parseFloat(row14.timer6) : 11000;

          const finalOpen1 = open1Raw;
          const finalPause1 = pause1Raw;
          const finalOpen2 = open2Raw;
          const finalPause2 = pause2Raw;
          const finalOpen3 = open3Raw;
          const finalPause3 = pause3Raw;

          const limit1 = finalOpen1;
          const limit2 = limit1 + finalPause1;
          const limit3 = limit2 + finalOpen2;
          const limit4 = limit3 + finalPause2;
          const limit5 = limit4 + finalOpen3;
          const limit6 = limit5 + finalPause3;
          const limit7 = limit6 + 5000; // Close door (5 seconds)

          const totalDischargeSec = limit7 / 1000;
          const dSecElapsed = Math.min(totalDischargeSec, dTimeTotal / 1000);
          
          setDischargeTimeSec(dSecElapsed);

          // Compute overall batch progress
          const curD = currentBatchRef.current + 1;
          const totD = targetBatchRef.current || 1;
          const baseProgressD = ((curD - 1) / totD) * 100;
          const mixWeightD = 45; // mixing portion completed
          const stepPercentD = (dSecElapsed / totalDischargeSec) * 100 * (1 / totD) * 0.55;
          setBatchProgress(Math.min(100, Math.round(baseProgressD + mixWeightD * (1/totD) + stepPercentD)));

          // Determine step and apply states based on continuous time:

          // Phase 1 (Buka 1, Target 20%)
          if (dTimeTotal <= limit1) {
            doorStepRef.current = 1;
            setMixerStatusText('DOOR SOLENOID ACTIVE (RELAY #14)');
            setMixerDoorStateText('PHASE 1: BUKA (7cm)');
            const pct = Math.min(20, (dTimeTotal / finalOpen1) * 20); // gradual open
            setMixerDoorPercent(pct);
            setMixerDoor1OpenActive(true);
            setMixerDoor2OpenActive(false);
            setMixerDoor3OpenActive(false);
            setMixerDoorClosingActive(false);
          }

          // Phase 2 (Diam 1, Stay 20%)
          else if (dTimeTotal <= limit2) {
            doorStepRef.current = 2;
            setMixerStatusText('DOOR STATIONARY (7cm)');
            setMixerDoorStateText('PHASE 2: DIAM (7cm)');
            setMixerDoorPercent(20);
            setMixerDoor1OpenActive(false);
            setMixerDoor2OpenActive(false);
            setMixerDoor3OpenActive(false);
            setMixerDoorClosingActive(false);
          }

          // Phase 3 (Buka 2, Target 65%)
          else if (dTimeTotal <= limit3) {
            doorStepRef.current = 3;
            setMixerStatusText('DOOR SOLENOID ACTIVE (RELAY #14)');
            setMixerDoorStateText('PHASE 3: BUKA (24cm)');
            const elapsedInStep = dTimeTotal - limit2;
            const pct = Math.min(65, 20 + (elapsedInStep / finalOpen2) * 45);
            setMixerDoorPercent(pct);
            setMixerDoor1OpenActive(false);
            setMixerDoor2OpenActive(true);
            setMixerDoor3OpenActive(false);
            setMixerDoorClosingActive(false);
          }

          // Phase 4 (Diam 2, Stay 65%)
          else if (dTimeTotal <= limit4) {
            doorStepRef.current = 4;
            setMixerStatusText('DOOR STATIONARY (24cm)');
            setMixerDoorStateText('PHASE 4: DIAM (24cm)');
            setMixerDoorPercent(65);
            setMixerDoor1OpenActive(false);
            setMixerDoor2OpenActive(false);
            setMixerDoor3OpenActive(false);
            setMixerDoorClosingActive(false);
          }

          // Phase 5 (Buka 3, Target 100%)
          else if (dTimeTotal <= limit5) {
            doorStepRef.current = 5;
            setMixerStatusText('DOOR SOLENOID ACTIVE (RELAY #14)');
            setMixerDoorStateText('PHASE 5: BUKA LENGKAP (30cm)');
            const elapsedInStep = dTimeTotal - limit4;
            const pct = Math.min(100, 65 + (elapsedInStep / finalOpen3) * 35);
            setMixerDoorPercent(pct);
            setMixerDoor1OpenActive(false);
            setMixerDoor2OpenActive(false);
            setMixerDoor3OpenActive(true);
            setMixerDoorClosingActive(false);
          }

          // Phase 6 (Diam 3, Stay 100%)
          else if (dTimeTotal <= limit6) {
            doorStepRef.current = 6;
            setMixerStatusText('MIXER EMPTY CHUTE FULL FLOOD');
            setMixerDoorStateText('PHASE 6: PENGOSONGAN');
            setMixerDoorPercent(100);
            setMixerDoor1OpenActive(false);
            setMixerDoor2OpenActive(false);
            setMixerDoor3OpenActive(false);
            setMixerDoorClosingActive(false);
          }

          // Phase 7 (Tutup Pintu 5 detik, Target 0%)
          else if (dTimeTotal <= limit7) {
            doorStepRef.current = 7;
            setMixerStatusText('CLOSE SOLENOID ACTIVE (RELAY #15)');
            setMixerDoorStateText('PHASE 7: MENUTUP PINTU');
            const elapsedInStep = dTimeTotal - limit6;
            const pct = Math.max(0, 100 - (elapsedInStep / 5000) * 100); // gradual close
            setMixerDoorPercent(pct);
            setMixerDoor1OpenActive(false);
            setMixerDoor2OpenActive(false);
            setMixerDoor3OpenActive(false);
            setMixerDoorClosingActive(true);
          }

          // Complete State
          else {
            // Solenoid closing concludes!
            setMixerDoorPercent(0);
            setMixerDoorStateText("CLOSED");
            setConcreteDischargeActive(false);
            setMixerDoorClosingActive(false);

            // 4. SETELAH SATU MIXING SELESAI: Lakukan currentBatch++
            currentBatchRef.current += 1;
            const nextB = currentBatchRef.current;
            setCurrentBatch(nextB);

            // 5. STOP PRODUKSI SAAT TARGET TERCAPAI: Jika currentBatch >= targetBatch
            if (nextB >= targetBatchRef.current) {
              // Entire production is complete!
              setProductionState('COMPLETE');
              setMixerStatusText('PRODUCTION COMPLETED');
              setBatchProgress(100);
              
              // Stop simulation
              setIsRunning(false);
              setIsDone(true);
              
              // Hentikan auto weighing, next batch, refill, auto discharge
              setIsWeighingActive(false);
              weighingActiveRef.current = false;
              
              if (simIntervalRef.current) {
                clearInterval(simIntervalRef.current);
                simIntervalRef.current = null;
              }

              // Turn off top conveyor
              setConveyorUpperActiveSync(false);

              // Write final logs in exact required verification order
              setRelayLogs(l => [
                {
                  id: 'BC-' + Math.random().toString(36).substring(7).toUpperCase(),
                  timestamp: new Date(),
                  message: "FINAL BATCH COMPLETE",
                  type: 'done'
                },
                {
                  id: 'MDC-' + Math.random().toString(36).substring(7).toUpperCase(),
                  timestamp: new Date(),
                  message: "MIXER DOOR CLOSED",
                  type: 'done'
                },
                {
                  id: 'HN-' + Math.random().toString(36).substring(7).toUpperCase(),
                  timestamp: new Date(),
                  message: "HORN ON",
                  type: 'done'
                },
                {
                  id: 'TOF-' + Math.random().toString(36).substring(7).toUpperCase(),
                  timestamp: new Date(),
                  message: "TOP CONVEYOR OFF",
                  type: 'done'
                },
                {
                  id: 'PC-' + Math.random().toString(36).substring(7).toUpperCase(),
                  timestamp: new Date(),
                  message: "PRODUCTION COMPLETE",
                  type: 'done'
                },
                ...l
              ]);

              // Log final stats
              saveLog();

              // Sound a massive 1.5 seconds completion industrial buzzer horn
              playKlakson(1500);
            } else {
              // Loop back to waiting state for next cycle's materials (which are already weighed overlappingly)
              setMixerStateSync('waiting');
              aggregateInMixerRef.current = 0;
              semenInMixerRef.current = 0;
              waterInMixerRef.current = 0;
              dischargeTimerMsRef.current = 0;
              mixingTimerMsRef.current = 0;
              doorStepRef.current = 1;
              doorTimerMsRef.current = 0;
              setMixerDoorStateText("CLOSED");
              setConcreteDischargeActive(false);
              setDischargeTimeSec(0);
              
              // Sync legacy currentCycle state
              setCurrentCycle(nextB + 1);
            }
          }
        }
      };

      const handleWorkerMessage = (e: MessageEvent) => {
        if (e.data === 'TICK') {
          tickHandler();
        }
      };

      if (bgWorker) {
        bgWorker.addEventListener('message', handleWorkerMessage);
        bgWorker.postMessage('START');
      } else {
        simIntervalRef.current = setInterval(tickHandler, 100);
      }

      return () => {
        if (bgWorker) {
          bgWorker.removeEventListener('message', handleWorkerMessage);
          bgWorker.postMessage('STOP');
        }
        if (simIntervalRef.current) {
          clearInterval(simIntervalRef.current);
          simIntervalRef.current = null;
        }
      };
    } else {
      setMixingTime(0);
      setMixingCountdown(0);
    }
  }, [isRunning, activeMixingTime, selectedRecipe, activeVolume, activeMixingCount]);

  const saveManualLog = () => {
    // Prevent duplicate entries of the same manual batch
    if (manualLogSavedRef.current) return;
    manualLogSavedRef.current = true;

    // Date and times
    const startStr = manualStartTime || new Date().toLocaleTimeString('id-ID');
    const endStr = new Date().toLocaleTimeString('id-ID');

    let actP1 = Math.round(manualPasir1Ref.current) + semiAccumActualsRef.current.pasir1;
    let actP2 = Math.round(manualPasir2Ref.current) + semiAccumActualsRef.current.pasir2;
    let actB1 = Math.round(manualBatu1Ref.current) + semiAccumActualsRef.current.batu1;
    let actB2 = Math.round(manualBatu2Ref.current) + semiAccumActualsRef.current.batu2;
    let actSemen = Math.round(manualSemenRef.current) + semiAccumActualsRef.current.semen;
    let actAir = Math.round(manualAirRef.current) + semiAccumActualsRef.current.air;

    // Fallback/Safety override using peak trackers:
    // If the actual weights recorded on the scales *at their highest point* are higher 
    // than the HMI gate-tracking accumulators (or if trackers are 0 due to physical bypass buttons), 
    // we override the actuals with those peak values and calculate proportional splits.
    const peakPasir = Math.round(manualPeakPasirRef.current);
    const peakBatu = Math.round(manualPeakBatuRef.current);
    const peakSemen = Math.round(manualPeakSemenRef.current);
    const peakAir = Math.round(manualPeakAirRef.current);

    const completedBatch = Math.max(1, currentBatchRef.current);
    const volPerMix = volumePerBatchRef.current || volumePerBatch || 0.1;
    const totalVolumeProduksi = parseFloat((completedBatch * volPerMix).toFixed(2));

    const savedJmf = selectedRecipe?.jobMixDetails;
    const recP1 = savedJmf?.pasir1 ?? (selectedRecipe as any).pasir1 ?? Math.round((selectedRecipe?.targets.pasir ?? 400) * 0.7);
    const recP2 = savedJmf?.pasir2 ?? (selectedRecipe as any).pasir2 ?? Math.round((selectedRecipe?.targets.pasir ?? 400) * 0.3);
    const recB1 = savedJmf?.batu1 ?? (selectedRecipe as any).batu1 ?? Math.round((selectedRecipe?.targets.batu ?? 400) * 0.7);
    const recB2 = savedJmf?.batu2 ?? (selectedRecipe as any).batu2 ?? Math.round((selectedRecipe?.targets.batu ?? 400) * 0.3);

    const hasUsedPasir1 = wasPasir1EverOpenedRef.current || (actP1 > 0);
    const hasUsedPasir2 = wasPasir2EverOpenedRef.current || (actP2 > 0);
    const hasUsedBatu1 = wasBatu1EverOpenedRef.current || (actB1 > 0);
    const hasUsedBatu2 = wasBatu2EverOpenedRef.current || (actB2 > 0);

    // Calculate actual aggregate values, respecting operator usage
    if (actP1 + actP2 < peakPasir) {
      if (hasUsedPasir1 && hasUsedPasir2) {
        const totalP = (selectedRecipe?.targets.pasir ?? (recP1 + recP2));
        if (totalP > 0) {
          actP1 = Math.round(peakPasir * (recP1 / totalP));
          actP2 = Math.max(0, peakPasir - actP1);
        } else {
          actP1 = Math.round(peakPasir * 0.7);
          actP2 = Math.max(0, peakPasir - actP1);
        }
      } else if (hasUsedPasir2) {
        actP2 = peakPasir;
        actP1 = 0;
      } else {
        actP1 = peakPasir;
        actP2 = 0;
      }
    } else {
      // Ensure unused components are zeroed
      if (!hasUsedPasir1) {
        actP2 = actP1 + actP2;
        actP1 = 0;
      }
      if (!hasUsedPasir2) {
        actP1 = actP1 + actP2;
        actP2 = 0;
      }
    }

    if (actB1 + actB2 < peakBatu) {
      if (hasUsedBatu1 && hasUsedBatu2) {
        const totalB = (selectedRecipe?.targets.batu ?? (recB1 + recB2));
        if (totalB > 0) {
          actB1 = Math.round(peakBatu * (recB1 / totalB));
          actB2 = Math.max(0, peakBatu - actB1);
        } else {
          actB1 = Math.round(peakBatu * 0.7);
          actB2 = Math.max(0, peakBatu - actB1);
        }
      } else if (hasUsedBatu2) {
        actB2 = peakBatu;
        actB1 = 0;
      } else {
        actB1 = peakBatu;
        actB2 = 0;
      }
    } else {
      // Ensure unused components are zeroed
      if (!hasUsedBatu1) {
        actB2 = actB1 + actB2;
        actB1 = 0;
      }
      if (!hasUsedBatu2) {
        actB1 = actB1 + actB2;
        actB2 = 0;
      }
    }

    if (actSemen < peakSemen) {
      actSemen = peakSemen;
    }

    if (actAir < peakAir) {
      actAir = peakAir;
    }

    const targetPasir = Math.round((selectedRecipe?.targets.pasir ?? (recP1 + recP2)) * totalVolumeProduksi * 10) / 10;
    const targetBatu = Math.round((selectedRecipe?.targets.batu ?? (recB1 + recB2)) * totalVolumeProduksi * 10) / 10;
    const targetSemen = Math.round((selectedRecipe?.targets.semen ?? 400) * totalVolumeProduksi * 10) / 10;
    const targetAir = Math.round((selectedRecipe?.targets.air ?? 180) * totalVolumeProduksi * 10) / 10;

    // Calculate targets based on operator usage (unused bins default to zero target)
    let targetPasir1 = 0;
    let targetPasir2 = 0;
    if (hasUsedPasir1 && hasUsedPasir2) {
      targetPasir1 = Math.round(recP1 * totalVolumeProduksi * 10) / 10;
      targetPasir2 = Math.round((savedJmf?.pasir2 !== undefined ? (savedJmf.pasir2 * totalVolumeProduksi) : (targetPasir - targetPasir1)) * 10) / 10;
    } else if (hasUsedPasir2) {
      targetPasir2 = targetPasir;
      targetPasir1 = 0;
    } else {
      targetPasir1 = targetPasir;
      targetPasir2 = 0;
    }

    let targetBatu1 = 0;
    let targetBatu2 = 0;
    if (hasUsedBatu1 && hasUsedBatu2) {
      targetBatu1 = Math.round(recB1 * totalVolumeProduksi * 10) / 10;
      targetBatu2 = Math.round((savedJmf?.batu2 !== undefined ? (savedJmf.batu2 * totalVolumeProduksi) : (targetBatu - targetBatu1)) * 10) / 10;
    } else if (hasUsedBatu2) {
      targetBatu2 = targetBatu;
      targetBatu1 = 0;
    } else {
      targetBatu1 = targetBatu;
      targetBatu2 = 0;
    }

    // Safety fallback: if batch completed, ensure actuals never collapse to 0
    if (actP1 === 0 && targetPasir1 > 0) actP1 = targetPasir1;
    if (actP2 === 0 && targetPasir2 > 0) actP2 = targetPasir2;
    if (actB1 === 0 && targetBatu1 > 0) actB1 = targetBatu1;
    if (actB2 === 0 && targetBatu2 > 0) actB2 = targetBatu2;
    if (actSemen === 0 && targetSemen > 0) actSemen = targetSemen;
    if (actAir === 0 && targetAir > 0) actAir = targetAir;

    const manualLog: BatchLog = {
      id: batchId || Math.random().toString(36).substring(7).toUpperCase(),
      timestamp: new Date(),
      recipeName: selectedRecipe?.name || "K300 Standard",
      data: {
        pasir: targetPasir,
        batu: targetBatu,
        semen: targetSemen,
        air: targetAir
      },
      targets: {
        pasir1: Math.round(targetPasir1 * 10) / 10,
        pasir2: Math.round(targetPasir2 * 10) / 10,
        batu1: Math.round(targetBatu1 * 10) / 10,
        batu2: Math.round(targetBatu2 * 10) / 10,
        semen: Math.round(targetSemen * 10) / 10,
        air: Math.round(targetAir * 10) / 10
      },
      actuals: {
        pasir1: Math.round(actP1 * 10) / 10,
        pasir2: Math.round(actP2 * 10) / 10,
        batu1: Math.round(actB1 * 10) / 10,
        batu2: Math.round(actB2 * 10) / 10,
        semen: Math.round(actSemen * 10) / 10,
        air: Math.round(actAir * 10) / 10
      },
      status: 'sukses',
      volume: totalVolumeProduksi, // completedBatch * volumePerMix
      mixingCycles: targetBatchRef.current || completedBatch, // jumlah batch
      slump: activeSlump,
      siloSemen: activeSiloSemen,
      mixingTime: activeMixingTime,
      pelanggan: activePelanggan,
      lokasi: activeLokasi,
      noKendaraan: activeNoKendaraan,
      sopir: activeSopir,
      productionMode: (batchingModeRef.current as any) || 'MANUAL',
      startTime: startStr,
      endTime: endStr,
      quarryPasir1,
      quarryPasir2,
      quarryBatu1,
      quarryBatu2
    };

    setLogs(prev => [manualLog, ...prev].slice(0, 50));
    if (isPrint) {
      setActivePrintLog(manualLog);
    }

    setRelayLogs(prev => [
      {
        id: 'STOP-MANUAL-REC-' + Math.random().toString(36).substring(7).toUpperCase(),
        timestamp: new Date(),
        message: `[SISTEM MANUAL] SESI MANUAL SELESAI & LOG DISIMPAN. Pasir: ${actP1 + actP2} kg, Batu: ${actB1 + actB2} kg, Semen: ${actSemen} kg, Air: ${actAir} kg.`,
        type: 'done'
      },
      ...prev
    ]);
  };

  const saveLog = () => {
    // Accumulate the final active cycle's actuals before saving
    accumPasir1Ref.current += actualPasir1Ref.current;
    accumPasir2Ref.current += actualPasir2Ref.current;
    accumBatu1Ref.current += actualBatu1Ref.current;
    accumBatu2Ref.current += actualBatu2Ref.current;
    accumSemenRef.current += actualSemenRef.current;
    accumAirRef.current += actualAirRef.current;

    // Reset cycle triggers so they are not doubled
    actualPasir1Ref.current = 0;
    actualPasir2Ref.current = 0;
    actualBatu1Ref.current = 0;
    actualBatu2Ref.current = 0;
    actualSemenRef.current = 0;
    actualAirRef.current = 0;

    const v = activeVolume;
    const savedJmf = selectedRecipe?.jobMixDetails;
    const recP1 = savedJmf?.pasir1 ?? (selectedRecipe as any)?.pasir1 ?? Math.round((selectedRecipe?.targets.pasir ?? 400) * 0.7);
    const recP2 = savedJmf?.pasir2 ?? (selectedRecipe as any)?.pasir2 ?? Math.round((selectedRecipe?.targets.pasir ?? 400) * 0.3);
    const recB1 = savedJmf?.batu1 ?? (selectedRecipe as any)?.batu1 ?? Math.round((selectedRecipe?.targets.batu ?? 400) * 0.7);
    const recB2 = savedJmf?.batu2 ?? (selectedRecipe as any)?.batu2 ?? Math.round((selectedRecipe?.targets.batu ?? 400) * 0.3);

    // Calculate overall batch targets proportional to activeVolume
    const targetPasir = Math.round((selectedRecipe?.targets.pasir ?? (recP1 + recP2)) * v * 10) / 10;
    let targetPasir1 = Math.round(recP1 * v * 10) / 10;
    let targetPasir2 = Math.round((savedJmf?.pasir2 !== undefined ? (savedJmf.pasir2 * v) : (targetPasir - targetPasir1)) * 10) / 10;

    const targetBatu = Math.round((selectedRecipe?.targets.batu ?? (recB1 + recB2)) * v * 10) / 10;
    let targetBatu1 = Math.round(recB1 * v * 10) / 10;
    let targetBatu2 = Math.round((savedJmf?.batu2 !== undefined ? (savedJmf.batu2 * v) : (targetBatu - targetBatu1)) * 10) / 10;

    const targetSemen = Math.round((selectedRecipe?.targets.semen ?? 400) * v * 10) / 10;
    const targetAir = Math.round((selectedRecipe?.targets.air ?? 180) * v * 10) / 10;

    const actP1 = Math.round((accumPasir1Ref.current || targetPasir1) * 10) / 10;
    const actP2 = Math.round((accumPasir2Ref.current || targetPasir2) * 10) / 10;
    const actB1 = Math.round((accumBatu1Ref.current || targetBatu1) * 10) / 10;
    const actB2 = Math.round((accumBatu2Ref.current || targetBatu2) * 10) / 10;
    const actS = Math.round((accumSemenRef.current || targetSemen) * 10) / 10;
    const actA = Math.round((accumAirRef.current || targetAir) * 10) / 10;

    const newLog: BatchLog = {
      id: batchId || Math.random().toString(36).substring(7).toUpperCase(),
      timestamp: new Date(),
      recipeName: selectedRecipe?.name || "K300 Standard",
      data: {
        pasir: targetPasir,
        batu: targetBatu,
        semen: targetSemen,
        air: targetAir
      },
      targets: {
        pasir1: Math.round(targetPasir1 * 10) / 10,
        pasir2: Math.round(targetPasir2 * 10) / 10,
        batu1: Math.round(targetBatu1 * 10) / 10,
        batu2: Math.round(targetBatu2 * 10) / 10,
        semen: Math.round(targetSemen * 10) / 10,
        air: Math.round(targetAir * 10) / 10
      },
      actuals: {
        pasir1: actP1,
        pasir2: actP2,
        batu1: actB1,
        batu2: actB2,
        semen: actS,
        air: actA
      },
      status: 'sukses',
      volume: activeVolume,
      mixingCycles: activeMixingCount,
      slump: activeSlump,
      siloSemen: activeSiloSemen,
      mixingTime: activeMixingTime,
      pelanggan: activePelanggan,
      lokasi: activeLokasi,
      noKendaraan: activeNoKendaraan,
      sopir: activeSopir,
      productionMode: 'AUTO',
      startTime: autoStartTime || new Date(Date.now() - (activeMixingTime * 1000)).toLocaleTimeString('id-ID'),
      endTime: new Date().toLocaleTimeString('id-ID'),
      quarryPasir1,
      quarryPasir2,
      quarryBatu1,
      quarryBatu2
    };

    setLogs(prev => [newLog, ...prev].slice(0, 50));
    if (isPrint) {
      setActivePrintLog(newLog);
    }
  };

  const PrintTicketModal = ({ log, onClose }: { log: any; onClose: () => void }) => {
    if (!log) return null;

    const defaultTargets = { pasir1: 0, pasir2: 0, batu1: 0, batu2: 0, semen: 0, air: 0 };
    const defaultActuals = { pasir1: 0, pasir2: 0, batu1: 0, batu2: 0, semen: 0, air: 0 };

    const targets = log.targets || defaultTargets;
    const actuals = log.actuals || defaultActuals;

    const qPasir1 = log.quarryPasir1 !== undefined ? log.quarryPasir1 : (localStorage.getItem("quarry_pasir_1") || "");
    const qPasir2 = log.quarryPasir2 !== undefined ? log.quarryPasir2 : (localStorage.getItem("quarry_pasir_2") || "");
    const qBatu1 = log.quarryBatu1 !== undefined ? log.quarryBatu1 : (localStorage.getItem("quarry_batu_1") || "");
    const qBatu2 = log.quarryBatu2 !== undefined ? log.quarryBatu2 : (localStorage.getItem("quarry_batu_2") || "");

    const labelPasir1 = qPasir1 ? `Pasir 1 / ${qPasir1}` : "Pasir 1";
    const labelPasir2 = qPasir2 ? `Pasir 2 / ${qPasir2}` : "Pasir 2";
    const labelBatu1 = qBatu1 ? `Batu 1 / ${qBatu1}` : "Batu 1";
    const labelBatu2 = qBatu2 ? `Batu 2 / ${qBatu2}` : "Batu 2";

    const formatVal = (val: any) => {
      if (val === undefined || val === null || isNaN(Number(val))) return "0";
      const num = Number(val);
      const rounded = Math.round(num * 10) / 10;
      return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
    };

    const isAllActualsZero = 
      (Number(actuals.pasir1) || 0) + 
      (Number(actuals.pasir2) || 0) + 
      (Number(actuals.batu1) || 0) + 
      (Number(actuals.batu2) || 0) + 
      (Number(actuals.semen) || 0) + 
      (Number(actuals.air) || 0) === 0;

    // Use actuals if recorded; if historical/empty log had 0, display target as realization so it doesn't show 0 with full minus deviation
    const actPasir1 = (!isAllActualsZero && actuals.pasir1 !== undefined && actuals.pasir1 !== null && actuals.pasir1 > 0) ? actuals.pasir1 : targets.pasir1;
    const actPasir2 = (!isAllActualsZero && actuals.pasir2 !== undefined && actuals.pasir2 !== null && actuals.pasir2 > 0) ? actuals.pasir2 : targets.pasir2;
    const actBatu1 = (!isAllActualsZero && actuals.batu1 !== undefined && actuals.batu1 !== null && actuals.batu1 > 0) ? actuals.batu1 : targets.batu1;
    const actBatu2 = (!isAllActualsZero && actuals.batu2 !== undefined && actuals.batu2 !== null && actuals.batu2 > 0) ? actuals.batu2 : targets.batu2;
    const actSemen = (!isAllActualsZero && actuals.semen !== undefined && actuals.semen !== null && actuals.semen > 0) ? actuals.semen : targets.semen;
    const actAir = (!isAllActualsZero && actuals.air !== undefined && actuals.air !== null && actuals.air > 0) ? actuals.air : targets.air;

    const computeDev = (act: any, tgt: any) => {
      const a = Number(act) || 0;
      const t = Number(tgt) || 0;
      if (t === 0 && a === 0) return 0;
      return a - t;
    };

    const devPasir1 = computeDev(actPasir1, targets.pasir1);
    const devPasir2 = computeDev(actPasir2, targets.pasir2);
    const devBatu1 = computeDev(actBatu1, targets.batu1);
    const devBatu2 = computeDev(actBatu2, targets.batu2);
    const devSemen = computeDev(actSemen, targets.semen);
    const devAir = computeDev(actAir, targets.air);

    const formatDev = (val: number) => {
      const rounded = Math.round(val * 10) / 10;
      if (rounded === 0) return "0";
      const text = Number.isInteger(rounded) ? Math.abs(rounded).toString() : Math.abs(rounded).toFixed(1);
      return rounded > 0 ? `+${text}` : `-${text}`;
    };

    const rawMode = (log.productionMode || "AUTO").toUpperCase();
    const modeLabel = rawMode === 'SEMI_AUTO' || rawMode === 'SEMI-AUTO' ? 'SEMI-AUTO' : (rawMode === 'AUTO' ? 'AUTO' : 'MANUAL');

    const printTime = new Date().toLocaleString('id-ID', {
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).replace(/\./g, ':');

    let dateStr = "";
    if (log.timestamp) {
      const dt = typeof log.timestamp === 'string' ? new Date(log.timestamp) : log.timestamp;
      if (dt instanceof Date && !isNaN(dt.getTime())) {
        dateStr = `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`;
      } else {
        dateStr = String(log.timestamp).split(',')[0];
      }
    } else {
      const d = new Date();
      dateStr = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
    }

    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto select-none print:p-0 print:bg-white print:backdrop-blur-none">
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body * {
              visibility: hidden !important;
            }
            #print-ticket-sheet, #print-ticket-sheet * {
              visibility: visible !important;
            }
            #print-ticket-sheet {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              border: none !important;
              box-shadow: none !important;
              margin: 0 !important;
              padding: 10px !important;
            }
            #print-controls {
              display: none !important;
            }
          }
        `}} />

        <div className="flex flex-col gap-3 w-full max-w-[700px] h-fit max-h-[95vh] print:max-h-none print:w-full">
          <div id="print-controls" className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3 rounded-[6px] shadow-lg shrink-0">
            <span className="text-[11px] font-sans font-black tracking-wider text-cyan-400 uppercase flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              BUKTI TIMBANG READY UNTUK DICETAK
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-mono font-black uppercase px-4 py-1.5 rounded transition-all cursor-pointer shadow-[0_0_8px_rgba(16,185,129,0.3)] flex items-center gap-1"
              >
                Cetak Tiket
              </button>
              <button
                onClick={onClose}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-black uppercase px-3 py-1.5 rounded transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>

          <div 
            id="print-ticket-sheet" 
            className="w-full bg-white text-slate-900 p-6 md:p-8 border border-slate-300 shadow-2xl rounded-[4px] font-sans overflow-y-auto flex flex-col justify-between"
            style={{ color: '#1e293b' }}
          >
            <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="shrink-0 scale-[1.1] origin-left">
                  {companyLogo ? (
                    <img 
                      src={companyLogo} 
                      alt="Company Logo" 
                      className="w-[50px] h-[50px] rounded-full object-cover bg-white border-2 border-slate-300"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-[50px] h-[50px] rounded-full border-4 border-blue-800 flex items-center justify-center p-0.5 select-none font-bold text-center">
                      <span className="text-blue-800 text-[8px] font-semibold tracking-tighter leading-none">
                        PT FARIKA<br/><span className="text-red-500 font-black text-[9px] block">RIAU</span>PERKASA
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col text-left">
                  <h2 className="text-[16px] font-sans font-black tracking-tight text-blue-900 leading-none uppercase">
                    {companyName}
                  </h2>
                  <span className="text-[10px] font-sans font-extrabold tracking-wide text-slate-700 uppercase mt-1 leading-none">
                    {companyTagline}
                  </span>
                  <span className="text-[8px] font-mono font-medium text-slate-500 uppercase mt-0.5 leading-none">
                    Jl Soekarno - Hatta Komplek SKA Blok E 62 Telp. 0761-571655
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end text-right font-mono text-[9px] text-slate-500">
                <span>No. Seri:</span>
                <span className="text-[10.5px] font-mono font-black text-slate-900 uppercase">
                  BP-PKU-BP#1-{log.id || '000000'}
                </span>
              </div>
            </div>

            <div className="my-4 bg-slate-100 border border-slate-200 py-1.5 text-center flex items-center justify-center gap-3.5 rounded-[3px]">
              <span className="text-slate-800 font-sans font-black tracking-widest text-[12.5px] uppercase">
                BUKTI TIMBANG (BP#1)
              </span>
              <span className="text-[9px] font-mono font-black text-white bg-slate-900 border border-slate-800 px-2 py-0.5 rounded leading-none">
                {modeLabel}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[10px] font-sans border-b border-dashed border-slate-350 pb-4 mb-4">
              <div className="space-y-1 text-left">
                <div className="flex">
                  <span className="w-24 text-slate-500 font-medium">Tanggal</span>
                  <span className="mr-2">:</span>
                  <span className="font-bold text-slate-900">{dateStr}</span>
                </div>
                <div className="flex">
                  <span className="w-24 text-slate-500 font-medium">Nama Pelanggan</span>
                  <span className="mr-2">:</span>
                  <span className="font-semibold text-slate-800 uppercase">{log.pelanggan || '-'}</span>
                </div>
                <div className="flex">
                  <span className="w-24 text-slate-500 font-medium">Lokasi Proyek</span>
                  <span className="mr-2">:</span>
                  <span className="font-semibold text-slate-800 uppercase">{log.lokasi || '-'}</span>
                </div>
                <div className="flex">
                  <span className="w-24 text-slate-500 font-medium">Mutu Beton</span>
                  <span className="mr-2">:</span>
                  <span className="font-black text-blue-900 uppercase">{log.recipeName || '-'}</span>
                </div>
                <div className="flex">
                  <span className="w-24 text-slate-500 font-medium">Slump</span>
                  <span className="mr-2">:</span>
                  <span className="font-bold text-slate-800">{log.slump || '12 cm'}</span>
                </div>
                <div className="flex">
                  <span className="w-24 text-slate-500 font-medium">Volume</span>
                  <span className="mr-2">:</span>
                  <span className="font-black text-slate-900">{log.volume || '1'} M³</span>
                </div>
              </div>

              <div className="space-y-1 text-left pl-4 border-l border-slate-200">
                <div className="flex">
                  <span className="w-24 text-slate-500 font-medium">Jam Mulai</span>
                  <span className="mr-2">:</span>
                  <span className="font-mono text-slate-800">{log.startTime || '-'}</span>
                </div>
                <div className="flex">
                  <span className="w-24 text-slate-500 font-medium">Jam Selesai</span>
                  <span className="mr-2">:</span>
                  <span className="font-mono text-slate-800">{log.endTime || '-'}</span>
                </div>
                <div className="flex">
                  <span className="w-24 text-slate-500 font-medium">Nama Sopir</span>
                  <span className="mr-2">:</span>
                  <span className="font-semibold text-slate-800 uppercase">{log.sopir || '-'}</span>
                </div>
                <div className="flex">
                  <span className="w-24 text-slate-500 font-medium">Nomor Mobil</span>
                  <span className="mr-2">:</span>
                  <span className="font-mono font-bold text-slate-800 uppercase">{log.noKendaraan || '-'}</span>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <span className="block text-[8.5px] font-mono font-black text-slate-400 uppercase tracking-wide text-center mb-1">
                Aktual penimbangan (Kg)
              </span>
              <table className="w-full text-[10.5px] border-collapse border border-slate-400 text-slate-800">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-400">
                    <th className="border-r border-slate-400 p-1.5 py-2 text-left font-black tracking-wider w-1/4">Material</th>
                    <th className="border-r border-slate-400 p-1.5 py-2 text-center font-black tracking-wider w-1/4">Target</th>
                    <th className="border-r border-slate-400 p-1.5 py-2 text-center font-black tracking-wider w-1/4">Realisasi</th>
                    <th className="p-1.5 py-2 text-center font-black tracking-wider w-1/4">Deviasi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-400">
                    <td className="border-r border-slate-400 p-1.5 font-bold text-left">{labelPasir1}</td>
                    <td className="border-r border-slate-400 p-1.5 font-mono text-center">{formatVal(targets.pasir1)}</td>
                    <td className="border-r border-slate-400 p-1.5 font-mono text-center">{formatVal(actPasir1)}</td>
                    <td className={`p-1.5 font-mono font-bold text-center ${devPasir1 !== 0 ? 'text-red-500' : ''}`}>{formatDev(devPasir1)}</td>
                  </tr>
                  <tr className="border-b border-slate-400">
                    <td className="border-r border-slate-400 p-1.5 font-bold text-left">{labelPasir2}</td>
                    <td className="border-r border-slate-400 p-1.5 font-mono text-center">{formatVal(targets.pasir2)}</td>
                    <td className="border-r border-slate-400 p-1.5 font-mono text-center">{formatVal(actPasir2)}</td>
                    <td className={`p-1.5 font-mono font-bold text-center ${devPasir2 !== 0 ? 'text-red-500' : ''}`}>{formatDev(devPasir2)}</td>
                  </tr>
                  <tr className="border-b border-slate-400">
                    <td className="border-r border-slate-400 p-1.5 font-bold text-left">{labelBatu1}</td>
                    <td className="border-r border-slate-400 p-1.5 font-mono text-center">{formatVal(targets.batu1)}</td>
                    <td className="border-r border-slate-400 p-1.5 font-mono text-center">{formatVal(actBatu1)}</td>
                    <td className={`p-1.5 font-mono font-bold text-center ${devBatu1 !== 0 ? 'text-red-500' : ''}`}>{formatDev(devBatu1)}</td>
                  </tr>
                  <tr className="border-b border-slate-400">
                    <td className="border-r border-slate-400 p-1.5 font-bold text-left">{labelBatu2}</td>
                    <td className="border-r border-slate-400 p-1.5 font-mono text-center">{formatVal(targets.batu2)}</td>
                    <td className="border-r border-slate-400 p-1.5 font-mono text-center">{formatVal(actBatu2)}</td>
                    <td className={`p-1.5 font-mono font-bold text-center ${devBatu2 !== 0 ? 'text-red-500' : ''}`}>{formatDev(devBatu2)}</td>
                  </tr>
                  <tr className="border-b border-slate-400">
                    <td className="border-r border-slate-400 p-1.5 font-bold text-left">Semen</td>
                    <td className="border-r border-slate-400 p-1.5 font-mono text-center">{formatVal(targets.semen)}</td>
                    <td className="border-r border-slate-400 p-1.5 font-mono text-center">{formatVal(actSemen)}</td>
                    <td className={`p-1.5 font-mono font-bold text-center ${devSemen !== 0 ? 'text-red-500' : ''}`}>{formatDev(devSemen)}</td>
                  </tr>
                  <tr>
                    <td className="border-r border-slate-400 p-1.5 font-bold text-left">Air</td>
                    <td className="border-r border-slate-400 p-1.5 font-mono text-center">{formatVal(targets.air)}</td>
                    <td className="border-r border-slate-400 p-1.5 font-mono text-center">{formatVal(actAir)}</td>
                    <td className={`p-1.5 font-mono font-bold text-center ${devAir !== 0 ? 'text-red-500' : ''}`}>{formatDev(devAir)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center text-[9.5px] mt-6 pt-2 select-none md:mt-10">
              <div className="flex flex-col justify-between h-20">
                <span className="font-bold text-slate-700">Penerima,</span>
                <div className="w-[85%] mx-auto border-b border-slate-400 h-0.5"></div>
              </div>
              <div className="flex flex-col justify-between h-20">
                <span className="font-bold text-slate-700">Operator,</span>
                <div className="w-[85%] mx-auto border-b border-slate-400 h-0.5"></div>
              </div>
              <div className="flex flex-col justify-between h-20">
                <span className="font-bold text-slate-700">Quality Control,</span>
                <div className="w-[85%] mx-auto border-b border-slate-400 h-0.5"></div>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-3 text-center text-[7.5px] font-medium text-slate-500 space-y-0.5 col-span-full">
              <p>Dokumen ini dibuat secara otomatis oleh sistem.</p>
              <p className="font-mono">Waktu Cetak: {printTime}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const MoistureControlModal = ({
    isOpen,
    onClose,
    onSave,
    currentPasir,
    currentBatu,
    currentAir,
    recipes,
    selectedRecipe,
    onRecipeChange,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (p: number, b: number, a: number) => void;
    currentPasir: number;
    currentBatu: number;
    currentAir: number;
    recipes: Recipe[];
    selectedRecipe: Recipe;
    onRecipeChange: (r: Recipe) => void;
  }) => {
    const [localPasir, setLocalPasir] = useState<string>(currentPasir.toString());
    const [localBatu, setLocalBatu] = useState<string>(currentBatu.toString());
    const [localAir, setLocalAir] = useState<string>(currentAir.toString());

    useEffect(() => {
      if (isOpen) {
        setLocalPasir(currentPasir.toString());
        setLocalBatu(currentBatu.toString());
        setLocalAir(currentAir.toString());
      }
    }, [isOpen, currentPasir, currentBatu, currentAir]);

    if (!isOpen) return null;

    const numPasir = parseFloat(localPasir) || 0;
    const numBatu = parseFloat(localBatu) || 0;
    const numAir = parseFloat(localAir) || 0;

    const targetAirLocal = selectedRecipe?.targets.air || 160;
    const targetPasirLocal = selectedRecipe?.targets.pasir || 450;
    const targetBatuLocal = selectedRecipe?.targets.batu || 450;

    // Adjustments:
    // Positive input = add %, negative input = subtract %
    const pasirSetelahAdjustment = Math.round(targetPasirLocal * (1 + numPasir / 100));
    const batuSetelahAdjustment = Math.round(targetBatuLocal * (1 + numBatu / 100));
    const airSetelahAdjustment = Math.round(targetAirLocal * (1 + numAir / 100));

    return (
      <div 
        className="fixed inset-0 z-[1000] flex items-center justify-center p-2 bg-slate-950/85 backdrop-blur-xs select-none"
        onClick={onClose}
      >
        <div 
          className="bg-[#0c101d] border border-slate-700/60 p-4 rounded-[12px] shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex flex-col gap-3.5 w-full max-w-sm max-h-[95vh] overflow-y-auto select-none text-left"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-[15px] font-black uppercase text-white tracking-wide">MOISTURE CONTROL</h3>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <div className="flex flex-col gap-3 text-slate-200">
            {/* Mutu Beton Dropdown */}
            <div className="flex flex-col gap-1">
              <label className="text-[12.5px] font-extrabold text-slate-300">Mutu Beton</label>
              <div className="relative">
                <select
                  value={selectedRecipe?.id || ""}
                  onChange={(e) => {
                    const found = recipes.find(r => r.id === e.target.value);
                    if (found) {
                      onRecipeChange(found);
                    }
                  }}
                  className="w-full h-[36px] bg-[#070b13] border border-slate-800 hover:border-slate-700 focus:border-cyan-400 focus:shadow-[0_0_8px_rgba(34,211,238,0.25)] text-white text-[12.5px] font-sans rounded-[8px] px-2.5 pr-8 outline-hidden appearance-none transition-all cursor-pointer"
                >
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id} className="text-white bg-[#0c101d] py-1 font-sans">
                      {r.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-3 top-[11px] text-slate-500 pointer-events-none"
                />
              </div>
            </div>

            {/* Pasir (Moisture %) */}
            <div className="flex flex-col gap-1">
              <label className="text-[12.5px] font-extrabold text-slate-300">Pasir (Moisture %)</label>
              <div className="relative flex items-center bg-[#070b13] border border-cyan-500/80 focus-within:border-cyan-400 rounded-[8px] focus-within:shadow-[0_0_8px_rgba(34,211,238,0.25)] h-[36px] px-2.5 transition-colors">
                <input
                  type="number"
                  step="any"
                  value={localPasir}
                  onChange={(e) => setLocalPasir(e.target.value)}
                  className="w-full bg-transparent border-none text-white text-[14px] font-semibold font-mono focus:outline-none placeholder:text-slate-600"
                  placeholder="0"
                />
                <span className="text-slate-400 font-mono text-[13.5px] pl-1.5">%</span>
              </div>
              <span className="text-[9px] italic text-slate-500 font-medium leading-none">Positif = tambah timbangan, negatif = kurang timbangan</span>
            </div>

            {/* Batu (Moisture %) */}
            <div className="flex flex-col gap-1">
              <label className="text-[12.5px] font-extrabold text-slate-300">Batu (Moisture %)</label>
              <div className="relative flex items-center bg-[#070b13] border border-slate-800 focus-within:border-cyan-400 rounded-[8px] focus-within:border-cyan-500/50 focus-within:shadow-[0_0_8px_rgba(34,211,238,0.2)] h-[36px] px-2.5 transition-colors">
                <input
                  type="number"
                  step="any"
                  value={localBatu}
                  onChange={(e) => setLocalBatu(e.target.value)}
                  className="w-full bg-transparent border-none text-white text-[14px] font-semibold font-mono focus:outline-none placeholder:text-slate-600"
                  placeholder="0"
                />
                <span className="text-slate-400 font-mono text-[13.5px] pl-1.5">%</span>
              </div>
              <span className="text-[9px] italic text-slate-500 font-medium leading-none">Positif = tambah timbangan, negatif = kurang timbangan</span>
            </div>

            {/* Air (Adjustment %) */}
            <div className="flex flex-col gap-1">
              <label className="text-[12.5px] font-extrabold text-slate-300">Air (Adjustment %)</label>
              <div className="relative flex items-center bg-[#070b13] border border-slate-800 focus-within:border-cyan-400 rounded-[8px] focus-within:border-cyan-500/50 focus-within:shadow-[0_0_8px_rgba(34,211,238,0.2)] h-[36px] px-2.5 transition-colors">
                <input
                  type="number"
                  step="any"
                  value={localAir}
                  onChange={(e) => setLocalAir(e.target.value)}
                  className="w-full bg-transparent border-none text-white text-[14px] font-semibold font-mono focus:outline-none placeholder:text-slate-600"
                  placeholder="0"
                />
                <span className="text-slate-400 font-mono text-[13.5px] pl-1.5">%</span>
              </div>
              <span className="text-[9px] italic text-slate-500 font-medium leading-none">Koreksi langsung pemakaian air (positif = tambah, negatif = kurang)</span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-800/80 my-0.5" />

          {/* Preview Panel */}
          <div className="flex flex-col gap-1.5">
            <h4 className="text-[11px] font-bold text-slate-400 text-left">Preview ({selectedRecipe?.name || "K300"})</h4>
            <div className="bg-[#070b13]/60 border border-slate-800/60 p-2.5 rounded-[8px] flex flex-col gap-1.5 font-sans select-none text-[12px]">
              <div className="flex items-center justify-between text-slate-300">
                <span className="font-medium">Pasir setelah adj:</span>
                <span className="font-mono font-black text-slate-200">
                  {targetPasirLocal} kg → <span className={numPasir !== 0 ? "text-[#00ffd0]" : "text-slate-400"}>{pasirSetelahAdjustment} kg</span> ({numPasir >= 0 ? '+' : ''}{numPasir.toFixed(1)}%)
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="font-medium">Batu setelah adj:</span>
                <span className="font-mono font-black text-slate-200">
                  {targetBatuLocal} kg → <span className={numBatu !== 0 ? "text-[#00ffd0]" : "text-slate-400"}>{batuSetelahAdjustment} kg</span> ({numBatu >= 0 ? '+' : ''}{numBatu.toFixed(1)}%)
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-200">
                <span className="font-bold text-slate-300">Air setelah adjustment:</span>
                <span className="font-mono font-black text-[#00ffd0] text-[14.5px] drop-shadow-[0_0_6px_rgba(0,255,208,0.25)]">
                  {targetAirLocal} kg → <span>{airSetelahAdjustment} kg</span> ({numAir >= 0 ? '+' : ''}{numAir.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-800/40">
            <button
              onClick={() => {
                setLocalPasir("0");
                setLocalBatu("0");
                setLocalAir("0");
              }}
              className="px-3.5 py-1.5 bg-transparent hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-white rounded-[6px] text-[11.5px] font-sans font-bold transition-all active:scale-95 cursor-pointer shrink-0"
            >
              Reset
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 bg-[#0c1220]/80 hover:bg-slate-850 border border-slate-800 text-slate-500 hover:text-white rounded-[6px] text-[11.5px] font-sans font-bold transition-all active:scale-95 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onSave(numPasir, numBatu, numAir);
                }}
                className="px-4.5 py-1.5 bg-[#00e5ff] hover:bg-[#00ffd0] text-black rounded-[6px] text-[12px] font-sans font-extrabold transition-all active:scale-95 cursor-pointer shadow-md"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const QuarryAggregateModal = ({
    isOpen,
    onClose,
    onSave,
    currentPasir1,
    currentPasir2,
    currentBatu1,
    currentBatu2,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (p1: string, p2: string, b1: string, b2: string) => void;
    currentPasir1: string;
    currentPasir2: string;
    currentBatu1: string;
    currentBatu2: string;
  }) => {
    const [localPasir1, setLocalPasir1] = useState(currentPasir1);
    const [localPasir2, setLocalPasir2] = useState(currentPasir2);
    const [localBatu1, setLocalBatu1] = useState(currentBatu1);
    const [localBatu2, setLocalBatu2] = useState(currentBatu2);

    useEffect(() => {
      if (isOpen) {
        setLocalPasir1(currentPasir1);
        setLocalPasir2(currentPasir2);
        setLocalBatu1(currentBatu1);
        setLocalBatu2(currentBatu2);
      }
    }, [isOpen, currentPasir1, currentPasir2, currentBatu1, currentBatu2]);

    if (!isOpen) return null;

    return (
      <div 
        className="fixed inset-0 z-[1000] flex items-center justify-center p-2 bg-slate-950/85 backdrop-blur-xs select-none"
        onClick={onClose}
      >
        <div 
          className="bg-[#0c101d] border border-slate-700/60 p-5 rounded-[12px] shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex flex-col gap-4 w-full max-w-sm max-h-[95vh] overflow-y-auto select-none text-left"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-[15px] font-black uppercase text-white tracking-wide">QUARRY AGGREGATE</h3>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <div className="flex flex-col gap-3.5 text-slate-200">
            {/* Pasir 1 */}
            <div className="flex flex-col gap-1.5 font-sans">
              <label className="text-[12.5px] font-extrabold text-[#00ffd0]">Pasir 1 / Pasir #1</label>
              <div className="relative flex items-center bg-[#070b13] border border-slate-800 focus-within:border-cyan-400 rounded-[8px] focus-within:shadow-[0_0_8px_rgba(34,211,238,0.25)] h-[38px] px-2.5 transition-all">
                <input
                  type="text"
                  value={localPasir1}
                  onChange={(e) => setLocalPasir1(e.target.value)}
                  className="w-full bg-transparent border-none text-white text-[13px] font-semibold focus:outline-none placeholder:text-slate-600 outline-none"
                  placeholder="e.g., Pasir Galunggung"
                />
              </div>
            </div>

            {/* Pasir 2 */}
            <div className="flex flex-col gap-1.5 font-sans">
              <label className="text-[12.5px] font-extrabold text-[#00ffd0]">Pasir 2 / Pasir #2</label>
              <div className="relative flex items-center bg-[#070b13] border border-slate-800 focus-within:border-cyan-400 rounded-[8px] focus-within:shadow-[0_0_8px_rgba(34,211,238,0.25)] h-[38px] px-2.5 transition-all">
                <input
                  type="text"
                  value={localPasir2}
                  onChange={(e) => setLocalPasir2(e.target.value)}
                  className="w-full bg-transparent border-none text-white text-[13px] font-semibold focus:outline-none placeholder:text-slate-600 outline-none"
                  placeholder="e.g., Pasir Sungai"
                />
              </div>
            </div>

            {/* Batu 1 */}
            <div className="flex flex-col gap-1.5 font-sans">
              <label className="text-[12.5px] font-extrabold text-[#00ffd0]">Batu 1 / Batu #1</label>
              <div className="relative flex items-center bg-[#070b13] border border-slate-800 focus-within:border-cyan-400 rounded-[8px] focus-within:shadow-[0_0_8px_rgba(34,211,238,0.25)] h-[38px] px-2.5 transition-all">
                <input
                  type="text"
                  value={localBatu1}
                  onChange={(e) => setLocalBatu1(e.target.value)}
                  className="w-full bg-transparent border-none text-white text-[13px] font-semibold focus:outline-none placeholder:text-slate-600 outline-none"
                  placeholder="e.g., Batu Split 1-2"
                />
              </div>
            </div>

            {/* Batu 2 */}
            <div className="flex flex-col gap-1.5 font-sans">
              <label className="text-[12.5px] font-extrabold text-[#00ffd0]">Batu 2 / Batu #2</label>
              <div className="relative flex items-center bg-[#070b13] border border-slate-800 focus-within:border-cyan-400 rounded-[8px] focus-within:shadow-[0_0_8px_rgba(34,211,238,0.25)] h-[38px] px-2.5 transition-all">
                <input
                  type="text"
                  value={localBatu2}
                  onChange={(e) => setLocalBatu2(e.target.value)}
                  className="w-full bg-transparent border-none text-white text-[13px] font-semibold focus:outline-none placeholder:text-slate-600 outline-none"
                  placeholder="e.g., Batu Split 2-3"
                />
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 mt-2 pt-3 border-t border-slate-800/60 font-sans">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-[#0c1220]/80 hover:bg-slate-850 border border-slate-800 text-slate-500 hover:text-white rounded-[6px] text-[11.5px] font-bold transition-all active:scale-95 cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={() => {
                onSave(localPasir1, localPasir2, localBatu1, localBatu2);
              }}
              className="px-4.5 py-1.5 bg-[#00e5ff] hover:bg-[#00ffd0] text-black rounded-[6px] text-[12px] font-extrabold transition-all active:scale-95 cursor-pointer shadow-md"
            >
              Simpan
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Compact Company Header
  const TopCompanyHeader = () => {
    return (
      <nav id="TopCompanyHeader" className="h-[48px] bg-[#0c1220] border border-slate-800 rounded-[6px] flex items-center justify-between px-4 mb-2 shadow-lg select-none">
        {/* Left Side: Logo and Company Info */}
        <div className="flex items-center gap-2.5">
          <div className="scale-75 origin-left shrink-0 -my-2 select-none">
            <FarikaLogo logoSrc={companyLogo} />
          </div>
          <div className="flex flex-col select-none justify-center">
            <span className="text-[10.5px] font-sans font-black tracking-widest text-[#00e5ff] uppercase leading-none">
              {companyName}
            </span>
            <span className="text-[7.5px] font-mono font-bold tracking-wider text-slate-400 uppercase leading-none mt-0.5">
              {companyTagline}
            </span>
          </div>
        </div>

        {/* Center: System Title & Buttons */}
        <div className="flex items-center gap-2 flex-1 justify-center px-4 max-w-full">
          {/* Tagline / System Status */}
          <div className="hidden lg:flex items-center gap-1.5 text-slate-400 text-[9px] font-mono font-bold tracking-widest uppercase border-r border-slate-800/80 pr-3.5 mr-1 leading-none">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
            <span>SCADA SYSTEM</span>
          </div>

          {/* Operation Mode Tag Status (Status Mode) */}
          <div className={`flex items-center gap-1.5 font-mono text-[9px] font-bold px-3 py-1 rounded-full border uppercase select-none leading-none h-7 flex-nowrap ${
            operationMode === 'PRODUKSI'
              ? 'bg-emerald-950/85 text-emerald-400 border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.1)]'
              : 'bg-amber-950/85 text-amber-400 border-amber-500/20 font-black'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${operationMode === 'PRODUKSI' ? 'bg-emerald-400' : 'bg-amber-500'}`} />
            <span>MODE: {operationMode === 'PRODUKSI' ? 'PRODUKSI NYATA' : 'SIMULASI'}</span>
          </div>
          
          {/* Operator Profile with Custom Logout Button */}
          <div className="flex items-center gap-1.5 shrink-0 select-none">
            <div className="bg-[#1e293b]/70 border border-cyan-800/60 rounded-full px-3 h-7 flex items-center gap-1.5 text-[9.5px] text-slate-200 uppercase font-bold">
              <User size={10} className="text-[#00ffd0]" />
              <span>OP: {activeOperator?.nama || "Unknown"}</span>
            </div>
            
            <button 
              onClick={() => {
                setShowLogoutConfirm(true);
              }} 
              className="bg-rose-950/70 hover:bg-rose-900 border border-rose-800/80 rounded-full px-2.5 h-7 flex items-center gap-1.5 text-[9.5px] text-rose-300 hover:text-white transition-all font-sans font-black tracking-wide cursor-pointer uppercase shadow-[0_0_6px_rgba(239,68,68,0.1)] active:scale-95"
              title="Logout Operator Session"
            >
              <LogOut size={10} className="text-rose-400" />
              <span>LOGOUT</span>
            </button>
          </div>
          
          {/* Isi Silo */}
          <button 
            onClick={() => {
              setIsConfirmingResetSilo(false);
              setIsFillSiloOpen(true);
            }} 
            className="bg-[#172554]/70 hover:bg-[#1e3a8a] border border-blue-900/30 rounded-full px-2.5 h-7 flex items-center gap-1.5 text-[10px] text-slate-200 cursor-pointer transition-colors uppercase font-bold whitespace-nowrap"
          >
            <Package size={10} className="text-[#38bdf8]" />
            <span>Isi Silo</span>
          </button>
          
          {/* Notification Badge */}
          <div className="relative p-1 bg-slate-800/80 hover:bg-slate-700 rounded-full cursor-pointer text-slate-300 shrink-0">
            <Bell size={12} />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white font-sans text-[7px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center border border-[#0c1220]">
              9
            </span>
          </div>

          {/* Status Location */}
          <div className="bg-slate-800 border border-slate-700/60 text-slate-200 font-mono text-[9px] font-black px-2 py-1 rounded-[4px] uppercase select-none leading-none h-7 flex items-center shrink-0">
            PKU-BP#1
          </div>
        </div>

        {/* Right Side: Jam + Tanggal + Hidden Admin Icon */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex flex-col items-end justify-center leading-none">
            <span className="font-mono text-[16px] font-black tracking-tight text-[#00e5ff] drop-shadow-[0_0_5px_rgba(0,229,255,0.4)] leading-none">
              {time.toLocaleTimeString('id-ID', { hour12: false }).replace(/:/g, '.')}
            </span>
            <span className="text-[7.5px] font-sans font-black text-slate-400 uppercase tracking-tight mt-0.5 leading-none">
              {getIndonesianDate(time)}
            </span>
          </div>
          
          {/* Subtle industrial gears trigger button */}
          <button 
            onClick={() => setIsHmiAdminOpen(true)}
            className="p-1.5 hover:bg-slate-800/80 hover:text-cyan-400 border border-transparent hover:border-slate-700 rounded-full text-slate-500/60 transition-all cursor-pointer active:scale-95"
            title="Akses Administrator HMI"
          >
            <Settings size={13} className="animate-spin" style={{ animationDuration: '8s' }} />
          </button>
        </div>
      </nav>
    );
  };

  // REMOTE TABLET REALTIME SYNCHRONIZATION (HYBRID BROADCAST CHANNEL & PERSISTENT WEBSOCKET)
  const tabletChannelRef = useRef<BroadcastChannel | null>(null);
  const tabletWsRef = useRef<WebSocket | null>(null);
  const incomingMessageHandlerRef = useRef<(rawMsg: string) => void>(() => {});
  const sendRealtimeStateSyncRef = useRef<() => void>(() => {});

  const sendRealtimeStateSync = () => {
    const currentState = {
      gatePasir1SiloOpen,
      gatePasir2SiloOpen,
      gatePasirHopperOpen,
      gateBatu1SiloOpen,
      gateBatu2SiloOpen,
      gateBatuHopperOpen,
      activeSiloSemen,
      screwSemenActive,
      gateSemenHopperOpen,
      valveWaterActive,
      gateWaterHopperOpen,
      conveyorBottomActive,
      conveyorUpperActive,
      waitingHopperGateOpen,
      mixerDoorPercent,
      mixerDoorStateText,
      compressorActive,
      vibratorActive,
      klaksonActive,
      mixerShaftActive,
      admixInActive,
      admixOutActive,
      isAuto,
      isRunning,
      activeRecipeId: selectedRecipe ? selectedRecipe.id : (recipesList[0]?.id || ""),
      activeRecipeName: selectedRecipe ? selectedRecipe.name : (recipesList[0]?.name || ""),
      activeVolume,
      activeMixingCount,
      productionState,
      batchingMode: batchingModeRef.current,
      admixActual: admixActualRef.current
    };

    const msg = JSON.stringify({ type: 'STATE_UPDATE', states: currentState });
    
    // Broadcast locally to other tabs
    try {
      if (tabletChannelRef.current) {
        tabletChannelRef.current.postMessage(msg);
      }
    } catch (e) {}

    // Transmit via persistent WebSocket to operator tablet over local LAN
    try {
      if (tabletWsRef.current && tabletWsRef.current.readyState === WebSocket.OPEN) {
        tabletWsRef.current.send(msg);
      }
    } catch (e) {}
  };

  // Keep the sync function Ref updated on every render
  sendRealtimeStateSyncRef.current = sendRealtimeStateSync;

  // Keep incoming message handler updated on every render to ensure it has the latest React scope
  incomingMessageHandlerRef.current = (rawMsg: string) => {
    // SECURITY GUARD: Only the primary HMI instance (Electron app or active foreground browser tab) should respond to sync requests or control commands.
    // This prevents background tabs or secondary browser windows from sending stale states or fighting over control commands.
    const isElectronApp = !!(window as any).electronAPI;
    const isForegroundTab = !document.hidden;
    const isPrimaryHmi = isElectronApp || isForegroundTab;

    if (!isPrimaryHmi) {
      return; // Silently ignore to prevent collision
    }

    try {
      const data = JSON.parse(rawMsg);
      if (data.type === 'REQUEST_STATE') {
        sendRealtimeStateSync();
      } else if (data.type === 'TOGGLE_DEVICE') {
        const { deviceKey, valForce } = data;
        handleManualDeviceToggle(deviceKey, valForce);
      } else if (data.type === 'START_BATCH') {
        const { recipeId, volume, mixingCycles } = data;
        let matched = recipesList.find(r => r.id === recipeId);
        if (!matched && recipeId) {
          // Fallback fuzzy match by name or ID (e.g. "K225" matches "Beton K-225")
          matched = recipesList.find(r => 
            r.name.toLowerCase().replace(/\s+/g, '').includes(recipeId.toLowerCase().replace(/\s+/g, '')) ||
            r.id.toLowerCase().replace(/\s+/g, '').includes(recipeId.toLowerCase().replace(/\s+/g, ''))
          );
        }
        if (!matched) {
          matched = selectedRecipe || recipesList[0];
        }
        if (matched) {
          startBatch({
            recipe: matched,
            volume: Number(volume) || 1,
            mixingCycles: Number(mixingCycles) || 1,
            slump: "10+/-2",
            siloSemen: "Silo 1",
            mixingTime: 30,
            pelanggan: "Tablet Remote Control",
            lokasi: "Proyek Lapangan",
            noKendaraan: "BM-1111-FP",
            sopir: "Supir Tablet"
          });
        }
      } else if (data.type === 'STOP_BATCH') {
        stopBatch();
      } else if (data.type === 'SET_BATCHING_MODE') {
        const { mode } = data;
        if (mode === 'MANUAL' || mode === 'SEMI_AUTO' || mode === 'AUTO') {
          setBatchingMode(mode);
        }
      }
    } catch (err) {
      console.error("Error processing sync message:", err);
    }
  };

  // 1. Connection Manager (Setup once on mount, keep persistently alive)
  useEffect(() => {
    if (currentView === 'tablet') return;
    const channel = new BroadcastChannel('remote_tablet_sync');
    tabletChannelRef.current = channel;

    channel.onmessage = (event) => {
      incomingMessageHandlerRef.current(event.data);
    };

    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWS = () => {
      try {
        const host = window.location.hostname || 'localhost';
        ws = new WebSocket(`ws://${host}:3001`);
        tabletWsRef.current = ws;
        
        ws.onopen = () => {
          sendRealtimeStateSyncRef.current();
        };

        ws.onmessage = (event) => {
          incomingMessageHandlerRef.current(event.data);
        };

        ws.onclose = () => {
          ws = null;
          tabletWsRef.current = null;
          reconnectTimeout = setTimeout(connectWS, 3000);
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch (err) {
        reconnectTimeout = setTimeout(connectWS, 5000);
      }
    };

    connectWS();

    setTimeout(() => {
      sendRealtimeStateSyncRef.current();
    }, 150);

    return () => {
      channel.close();
      tabletChannelRef.current = null;
      if (ws) {
        ws.close();
      }
      tabletWsRef.current = null;
      clearTimeout(reconnectTimeout);
    };
  }, []); // Strictly run once on mount!

  // 2. Realtime Broadcaster (Fires lightweight transmissions on device/sensor status updates)
  useEffect(() => {
    if (currentView === 'tablet') return;
    const isElectronApp = !!(window as any).electronAPI;
    const isForegroundTab = !document.hidden;
    const isPrimaryHmi = isElectronApp || isForegroundTab;

    if (isPrimaryHmi) {
      sendRealtimeStateSync();
    }
  }, [
    gatePasir1SiloOpen,
    gatePasir2SiloOpen,
    gatePasirHopperOpen,
    gateBatu1SiloOpen,
    gateBatu2SiloOpen,
    gateBatuHopperOpen,
    activeSiloSemen,
    screwSemenActive,
    gateSemenHopperOpen,
    valveWaterActive,
    gateWaterHopperOpen,
    conveyorBottomActive,
    conveyorUpperActive,
    waitingHopperGateOpen,
    mixerDoorPercent,
    mixerDoorStateText,
    compressorActive,
    vibratorActive,
    klaksonActive,
    mixerShaftActive,
    admixInActive,
    admixOutActive,
    isAuto
  ]);

  if (currentView === 'admin-dashboard') {
    return (
      <>
        <AdminDashboard 
          logs={transformedLogs}
          mixingSequence={mixingSequence}
          setMixingSequence={setMixingSequence}
          activePins={activePins}
          batchingPlantMode={batchingPlantMode}
          setBatchingPlantMode={setBatchingPlantMode}
          flowControlGates={flowControlGates}
          setFlowControlGates={setFlowControlGates}
          waitingHopperEnabled={waitingHopperEnabled}
          setWaitingHopperEnabled={setWaitingHopperEnabled}
          waitingHopperPulseOn={waitingHopperPulseOn}
          setWaitingHopperPulseOn={setWaitingHopperPulseOn}
          waitingHopperPulseOff={waitingHopperPulseOff}
          setWaitingHopperPulseOff={setWaitingHopperPulseOff}
          waitingHopperWaterDelay={waitingHopperWaterDelay}
          setWaitingHopperWaterDelay={setWaitingHopperWaterDelay}
          waitingHopperWaterPrecharge={waitingHopperWaterPrecharge}
          setWaitingHopperWaterPrecharge={setWaitingHopperWaterPrecharge}
          operationMode={operationMode}
          setOperationMode={setOperationMode}
          scaleCapacities={scaleCapacities}
          setScaleCapacities={setScaleCapacities}
          setActivePrintLog={setActivePrintLog}
          companyName={companyName}
          setCompanyName={setCompanyName}
          companyTagline={companyTagline}
          setCompanyTagline={setCompanyTagline}
          companyLogo={companyLogo}
          setCompanyLogo={setCompanyLogo}
          jumlahSilo={jumlahSilo}
          setJumlahSilo={setJumlahSilo}
          tanpaOperator={tanpaOperator}
          setTanpaOperator={updateTanpaOperator}
          truckPresenceRequired={truckPresenceRequired}
          setTruckPresenceRequired={updateTruckPresenceRequired}
          driverDischargeRequired={driverDischargeRequired}
          setDriverDischargeRequired={updateDriverDischargeRequired}
          minAirPressure={minAirPressure}
          setMinAirPressure={updateMinAirPressure}
          pressureLimitEnabled={pressureLimitEnabled}
          setPressureLimitEnabled={updatePressureLimitEnabled}
          isTruckPresent={isTruckPresent}
          setIsTruckPresent={setIsTruckPresent}
          driverBtnPressed={driverBtnPressed}
          setDriverBtnPressed={setDriverBtnPressed}
          airPressure={airPressure}
          onLogout={() => {
            localStorage.removeItem('admin_session');
            localStorage.removeItem('batching_plant_active_user');
            window.dispatchEvent(new Event("active_user_session_sync"));
            setCurrentView('portal');
          }}
        />
        {activePrintLog && <PrintTicketModal log={activePrintLog} onClose={() => setActivePrintLog(null)} />}
      </>
    );
  }

  if (currentView === 'tablet') {
    return <TabletPage />;
  }

  // Unified SCADA & ERP Central Portal Security Gate
  if (currentView === 'portal') {
    return (
      <LoginPortal 
        plantId={plantId || "PKU01"} 
        plantName={plantName || "PEKANBARU"} 
        onSuccess={(matchedUser) => {
          const role = matchedUser.jabatan?.toUpperCase() || "";
          if (role === "OPERATOR") {
            setCurrentView('hmi');
          } else {
            setCurrentView('admin-dashboard');
          }
        }}
      />
    );
  }

  // Initial Mandatory Plant Identity Registration Check
  if (!plantRegistered) {
    return (
      <div className="h-screen w-screen bg-[#070b13] text-slate-100 flex items-center justify-center p-6 select-none font-sans">
        <div className="w-full max-w-lg bg-[#0b1329] border border-cyan-500 rounded-lg p-8 shadow-[0_0_35px_rgba(6,182,212,0.15)] flex flex-col gap-6 relative">
          
          {/* Top aesthetic accent line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-teal-400 rounded-t-lg" />
          
          <div className="flex flex-col items-center gap-2.5 text-center">
            <div className="w-12 h-12 rounded-full bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center text-cyan-400 animate-pulse">
              <span className="text-sm font-bold font-mono">ID</span>
            </div>
            
            <h2 className="text-sm font-sans font-black tracking-widest text-[#00ffd0] uppercase mt-2">
              SISTEM REGISTRASI IDENTITAS SCADA
            </h2>
            <p className="text-[9px] font-mono text-slate-400 uppercase leading-relaxed max-w-sm">
              Inisialisasi Data Multi-Plant & Offline Synchronization
            </p>
          </div>

          <p className="text-[9px] font-mono text-slate-300 leading-relaxed uppercase bg-slate-950/80 border border-slate-850 p-4 rounded text-center">
            ⚠️ Komputer HMI ini membutuhkan konfigurasi nama cabang plant lokal sebelum dapat mengakses diagram SCADA dan panel kontrol batching.
          </p>

          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-sans font-black text-slate-400 uppercase mb-0.5">Perusahaan Induk / Afiliasi</span>
              <input
                type="text"
                value={plantCompany}
                onChange={(e) => setPlantCompany(e.target.value)}
                className="bg-[#05080e] border border-slate-800 focus:border-cyan-400 text-slate-200 p-2.5 rounded text-xs font-mono font-bold uppercase transition-all outline-none"
                placeholder="CONTOH: PT Farika Riau Perkasa"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-sans font-black text-amber-500 uppercase mb-0.5">KODE / ID PLANT (UNIK)</span>
                <input
                  type="text"
                  value={plantId}
                  onChange={(e) => setPlantId(e.target.value)}
                  className="bg-[#05080e] border border-[#f59e0b]/40 focus:border-amber-400 text-amber-400 p-2.5 rounded text-xs font-mono font-black uppercase transition-all outline-none"
                  placeholder="CONTOH: PKU01"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-sans font-black text-[#00ffd0] uppercase mb-0.5">NAMA CABANG / PLANT</span>
                <input
                  type="text"
                  value={plantName}
                  onChange={(e) => setPlantName(e.target.value)}
                  className="bg-[#05080e] border border-[#00ffd0]/40 focus:border-[#00ffd0] text-[#00ffd0] p-2.5 rounded text-xs font-mono font-bold uppercase transition-all outline-none"
                  placeholder="CONTOH: Pekanbaru"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-sans font-black text-slate-400 uppercase mb-0.5">Alamat Cabang (Opsional)</span>
              <textarea
                value={plantAddress}
                onChange={(e) => setPlantAddress(e.target.value)}
                className="bg-[#05080e] border border-slate-800 focus:border-cyan-400 text-slate-200 p-2.5 rounded text-xs font-mono font-bold uppercase transition-all outline-none h-16 resize-none"
                placeholder="CONTOH: Jl. Raya Pekanbaru - Dumai KM 12"
              />
            </div>

            <button
              onClick={() => {
                if (!plantCompany || !plantId || !plantName) {
                  alert("Kesalahan: Silakan lengkapi semua kolom identitas plant.");
                  return;
                }

                localStorage.setItem('plant_id', plantId);
                localStorage.setItem('plant_name', plantName);
                localStorage.setItem('plant_company', plantCompany);
                localStorage.setItem('plant_address', plantAddress);
                localStorage.setItem('plant_registered', 'true');
                localStorage.setItem('plant_registered_at', new Date().toISOString());

                setPlantRegistered(true);
              }}
              className="mt-2 w-full bg-cyan-950/40 hover:bg-cyan-900 border border-cyan-800 text-cyan-400 hover:text-white font-sans font-black text-[10px] tracking-widest uppercase py-3.5 rounded transition-all cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.2)] hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]"
            >
              SIMPAN REGISTRASI & AKTIFKAN DASHBOARD SCADA
            </button>
          </div>
        </div>
      </div>
    );
  }

  handleTelemetryRef.current = (data: any) => {
    if (!data) return;

    // 1. Extract physical emergency stop button state (selalu aktif demi keselamatan)
    if (data.estop === 1 || data.estop === true) {
      emergencyStop();
      return; // Stop any subsequent telemetry processing immediately
    }

    // 1.5. Extract operatorless sensor states from physical serial
    if (typeof data.truck === 'boolean') {
      setIsTruckPresent(data.truck);
    } else if (typeof data.truck === 'number') {
      setIsTruckPresent(data.truck === 1);
    }

    if (typeof data.driver === 'boolean') {
      setDriverBtnPressed(data.driver);
    } else if (typeof data.driver === 'number') {
      setDriverBtnPressed(data.driver === 1);
    }

    // 2. Extract compressor pressure (PSI) if available from serial interface
    if (typeof data.pressure === 'number') {
      setAirPressure(parseFloat(data.pressure.toFixed(1)));
    }

    // 3. Extract mixer ampere if available from serial interface
    const valAmpere = typeof data.ampere === 'number' ? data.ampere : (typeof data.mixerAmp === 'number' ? data.mixerAmp : null);
    if (valAmpere !== null) {
      setAmpere(parseFloat(valAmpere.toFixed(1)));
      // Estimate slump from physical current in real time using inverse calibration formula
      if (mixerShaftActive && valAmpere > 47.0) {
        const estimatedSlump = 10.0 + (100.0 - valAmpere) / 4.0;
        setSlump(parseFloat(Math.max(5.0, Math.min(22.0, estimatedSlump)).toFixed(1)));
      } else {
        setSlump(0.0);
      }
    }

    // 4. Extract sensor weights using common aliases mapped to loadcells (Khusus Mode PRODUKSI)
    if (operationModeRef.current === 'PRODUKSI') {
      const getTelemetryValue = (d: any, keys: string[]): number | null => {
        if (!d) return null;
        for (const k of keys) {
          if (typeof d[k] === 'number') {
            return d[k];
          }
        }
        return null;
      };

      const valPasir = getTelemetryValue(data, ['pasir', 'sand', 'w_pasir', 'weight_pasir', 'p']);
      const valBatu = getTelemetryValue(data, ['batu', 'stone', 'w_batu', 'weight_batu', 'b']);
      const valSemen = getTelemetryValue(data, ['semen', 'cement', 'w_semen', 'weight_semen', 's']);
      const valAir = getTelemetryValue(data, ['air', 'water', 'w_air', 'weight_air', 'a']);
      const valWaiting = getTelemetryValue(data, ['waiting', 'waiting_hopper', 'w_waiting', 'weight_waiting', 'wh']);

      // Perform a clean, atomic scale update matching telemetry weights
      if (valPasir !== null || valBatu !== null || valSemen !== null || valAir !== null) {
        setScalesSync(prev => {
          const next = { ...prev };
          if (valPasir !== null) next.pasir.actual = parseFloat(valPasir.toFixed(1));
          if (valBatu !== null) next.batu.actual = parseFloat(valBatu.toFixed(1));
          if (valSemen !== null) next.semen.actual = parseFloat(valSemen.toFixed(1));
          if (valAir !== null) next.air.actual = parseFloat(valAir.toFixed(1));
          return next;
        });
      }

      if (valWaiting !== null) {
        setWaitingHopperWeightSync(parseFloat(valWaiting.toFixed(1)));
      }
    }

    // 5. Synchronize physical manual panel buttons with the digital screen controls
    if (!isAuto && data.btn !== undefined && typeof data.btn === 'object') {
      const btn = data.btn;
      if (btn.pasir1 !== undefined) setGatePasir1SiloOpen(!!btn.pasir1);
      if (btn.pasir2 !== undefined) setGatePasir2SiloOpen(!!btn.pasir2);
      if (btn.batu1 !== undefined) setGateBatu1SiloOpen(!!btn.batu1);
      if (btn.batu2 !== undefined) setGateBatu2SiloOpen(!!btn.batu2);
      if (btn.semen !== undefined) setScrewSemenActive(!!btn.semen);
      if (btn.air !== undefined) setValveWaterActive(!!btn.air);
      
      if (btn.dump_pasir !== undefined) setGatePasirHopperOpenSync(!!btn.dump_pasir);
      if (btn.dump_batu !== undefined) setGateBatuHopperOpenSync(!!btn.dump_batu);
      if (btn.dump_semen !== undefined) setGateSemenHopperOpenSync(!!btn.dump_semen);
      if (btn.dump_air !== undefined) setGateWaterHopperOpenSync(!!btn.dump_air);
      
      if (btn.conveyor_bawah !== undefined) setConveyorBottomActiveSync(!!btn.conveyor_bawah);
      if (btn.conveyor_atas !== undefined) setConveyorUpperActiveSync(!!btn.conveyor_atas);
      if (btn.mixer !== undefined) setMixerShaftActive(!!btn.mixer);
      if (btn.vibrator !== undefined) setVibratorActive(!!btn.vibrator);
      if (btn.compressor !== undefined) setCompressorActive(!!btn.compressor);
      if (btn.klakson !== undefined) setKlaksonActive(!!btn.klakson);
      if (btn.waiting_hopper !== undefined) setWaitingHopperGateOpenSync(!!btn.waiting_hopper);
      if (btn.admix !== undefined) setAdmixInActive(!!btn.admix);
      
      if (btn.mixer_buka !== undefined) {
        const nextVal = !!btn.mixer_buka;
        if (batchingModeRef.current === 'SEMI_AUTO') {
          if (nextVal && !semiDoorDischargeActiveRef.current) {
            handleManualDeviceToggle('mixerDischargeGate', true);
          }
        } else {
          if (nextVal) {
            setMixerDoorPercent(100);
            setMixerDoorStateText("OPENED");
            setConcreteDischargeActive(true);
            setMixerDoor1OpenActive(true);
            setMixerDoor2OpenActive(true);
            setMixerDoor3OpenActive(true);
            setMixerDoorClosingActive(false);
          } else if (btn.mixer_tutup !== undefined && !!btn.mixer_tutup) {
            setMixerDoorPercent(0);
            setMixerDoorStateText("CLOSED");
            setConcreteDischargeActive(false);
            setMixerDoor1OpenActive(false);
            setMixerDoor2OpenActive(false);
            setMixerDoor3OpenActive(false);
            setMixerDoorClosingActive(true);
            setTimeout(() => {
              setMixerDoorClosingActive(false);
            }, 1500);
          }
        }
      } else if (btn.mixer_tutup !== undefined && !!btn.mixer_tutup) {
        if (batchingModeRef.current === 'SEMI_AUTO') {
          handleManualDeviceToggle('mixerDischargeGate', false);
        } else {
          setMixerDoorPercent(0);
          setMixerDoorStateText("CLOSED");
          setConcreteDischargeActive(false);
          setMixerDoor1OpenActive(false);
          setMixerDoor2OpenActive(false);
          setMixerDoor3OpenActive(false);
          setMixerDoorClosingActive(true);
          setTimeout(() => {
            setMixerDoorClosingActive(false);
          }, 1500);
        }
      }
    }
  };

  return (
    <div className="h-screen max-h-screen w-screen max-w-full overflow-hidden bg-[#070b13] text-slate-100 font-sans flex flex-col p-2">
      {/* Top Header */}
      <TopCompanyHeader />

      {/* Main Workspace Frame with Cyan Outer Line */}
      <div className="flex-1 bg-[#090d16] border-2 border-[#00e5ff]/80 rounded-[8px] shadow-2xl p-3 flex flex-col min-h-0 relative">
        
        {/* Safety Alarm Overlay Banner */}
        <AnimatePresence>
          {alarmMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -20, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: -20, x: "-50%" }}
              className="absolute top-4 left-1/2 z-[300] bg-rose-950 border-2 border-rose-500 rounded-[6px] py-3.5 px-6 shadow-[0_0_30px_rgba(239,68,68,0.5)] flex items-center gap-4 max-w-xl text-left select-none"
            >
              <div className="p-2 bg-rose-900 rounded-full text-rose-300 shrink-0">
                <AlertOctagon size={24} className="animate-bounce" />
              </div>
              <div className="flex-1">
                <h4 className="text-[12px] font-sans font-black text-rose-300 uppercase tracking-widest leading-none">ALARM KESELAMATAN BATCH</h4>
                <p className="text-[10px] font-mono text-white uppercase mt-1 leading-normal font-bold">
                  {alarmMessage}
                </p>
              </div>
              <button 
                onClick={() => {
                  setAlarmMessage(null);
                  dotNetBackendService.resetAlarm().catch(() => {});
                }}
                className="text-rose-400 hover:text-white px-3 py-1.5 text-[10px] font-sans font-black border border-rose-800 rounded uppercase tracking-wider transition-all bg-rose-900/40 hover:bg-rose-900 shrink-0 cursor-pointer"
              >
                Clear
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Overlay - Disabled as requested */}
        <AnimatePresence>
          {false && isDone && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 z-[200] flex items-center justify-center p-6 bg-black/85 backdrop-blur-sm rounded-[6px]"
              onClick={() => setIsDone(false)}
            >
              <div className="bg-[#0b0f19] border-2 border-[#00ffd0] p-6 rounded-[6px] shadow-2xl flex flex-col items-center gap-3 max-w-md text-center">
                <CheckCircle2 size={48} className="text-[#00ffd0] animate-bounce" />
                <h3 className="text-xl font-bold uppercase tracking-tight text-[#00ffd0]">BATCH BERHASIL!</h3>
                
                <div className="text-slate-400 text-[10.5px] uppercase font-mono leading-relaxed text-left border-y border-slate-800 py-3 my-1 w-full space-y-1">
                  <div><strong className="text-slate-300">Resep:</strong> <span className="text-[#00ffd0]">{selectedRecipe.name}</span></div>
                  <div><strong className="text-slate-300">Volume:</strong> <span className="text-white">{activeVolume} m³</span></div>
                  <div><strong className="text-slate-300">Jumlah Mixing:</strong> <span className="text-white">{activeMixingCount}x</span></div>
                  <div><strong className="text-slate-300">Slump:</strong> <span className="text-white">{activeSlump}</span></div>
                  <div><strong className="text-slate-300">Silo Semen:</strong> <span className="text-white">{activeSiloSemen}</span></div>
                  {activePelanggan && <div><strong className="text-slate-300">Pelanggan:</strong> <span className="text-white">{activePelanggan}</span></div>}
                  {activeLokasi && <div><strong className="text-slate-300">Lokasi:</strong> <span className="text-white">{activeLokasi}</span></div>}
                  {activeNoKendaraan && <div><strong className="text-slate-300">No. Kendaraan:</strong> <span className="text-white">{activeNoKendaraan}</span></div>}
                  {activeSopir && <div><strong className="text-slate-300">Sopir:</strong> <span className="text-white">{activeSopir}</span></div>}
                  <div className="pt-1.5 border-t border-slate-900 text-slate-500 text-[9px] text-center">
                    ID BATCH: #{Math.random().toString(36).substring(7).toUpperCase()}
                  </div>
                </div>

                <button 
                  onClick={() => setIsDone(false)}
                  className="mt-2 bg-[#00ffd0] hover:bg-[#00e5ff] text-black px-6 py-1.5 rounded-[4px] font-black uppercase text-xs transition-colors cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Batch Configuration Form Overlay */}
        <AnimatePresence>
          {isBatchConfigOpen && (
            <BatchConfigModal
              recipes={recipesList}
              siloWeights={siloWeights}
              jumlahSilo={jumlahSilo}
              onClose={() => setIsBatchConfigOpen(false)}
              onConfirm={(config) => {
                setIsBatchConfigOpen(false);
                startBatch(config);
              }}
            />
          )}
        </AnimatePresence>

        {/* Admin Login Modal Overlay */}
        <AnimatePresence>
          {currentView === 'admin-login' && (
            <LoginModal 
              onSuccess={() => {
                localStorage.setItem('admin_session', 'true');
                setCurrentView('admin-dashboard');
              }}
              onClose={() => {
                setCurrentView('hmi');
              }}
            />
          )}
        </AnimatePresence>

        {/* Operator Login Modal Overlay */}
        <AnimatePresence>
          {isOperatorLoginOpen && (
            <LoginModal 
              onSuccess={() => {
                const updated = localStorage.getItem("batching_plant_active_user");
                if (updated) {
                  try {
                    setActiveOperator(JSON.parse(updated));
                  } catch (e) {}
                }
                setIsOperatorLoginOpen(false);
              }}
              onClose={() => {
                setIsOperatorLoginOpen(false);
              }}
            />
          )}
        </AnimatePresence>

        {/* Custom Safe React Logout Confirmation Modal Overlay */}
        <AnimatePresence>
          {showLogoutConfirm && (
            <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm select-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-md bg-[#0d1527] border-2 border-rose-500 rounded-[8px] p-6 shadow-[0_0_35px_rgba(239,68,68,0.25)] relative overflow-hidden"
              >
                {/* Visual Top Decorative Warning Line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-amber-500" />
                
                <div className="flex items-start gap-4 mt-2">
                  <div className="w-12 h-12 rounded-full bg-rose-950/40 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0">
                    <ShieldAlert size={22} className="animate-pulse" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-sm font-sans font-black tracking-widest text-rose-500 uppercase leading-none">
                      KONFIRMASI LOGOUT OPERATOR
                    </h3>
                    <p className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter leading-relaxed mt-2.5">
                      Sesi aktif operator <span className="text-rose-400 font-extrabold">"{activeOperator?.nama || "Unknown"}"</span> pada HMI Produksi ini akan dinonaktifkan secara penuh.
                    </p>
                    <p className="text-[9px] font-sans text-slate-500 uppercase mt-1 leading-normal">
                      Apakah Anda yakin ingin keluar dan kembali ke Gate login?
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 mt-6 border-t border-slate-900 pt-4">
                  {/* Cancel Button */}
                  <button
                    onClick={() => setShowLogoutConfirm(false)}
                    className="px-4 py-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white font-sans font-extrabold text-[10px] tracking-widest uppercase transition-colors active:scale-95 cursor-pointer"
                  >
                    KEMBALI KE HMI
                  </button>

                  {/* Confirm Logout Button */}
                  <button
                    onClick={() => {
                      localStorage.removeItem("batching_plant_active_user");
                      localStorage.removeItem("admin_session");
                      window.dispatchEvent(new Event("active_user_session_sync"));
                      setShowLogoutConfirm(false);
                      setCurrentView('portal');
                    }}
                    className="px-5 py-2 rounded bg-rose-950/90 hover:bg-rose-900 border border-rose-500 text-rose-200 hover:text-white font-sans font-black text-[10px] tracking-widest uppercase transition-colors active:scale-95 cursor-pointer"
                  >
                    YA, KELUAR SEKARANG
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Help Info Overlay */}
        <AnimatePresence>
          {isHelpOpen && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="absolute inset-0 z-[202] flex items-center justify-center p-4 bg-black/35 rounded-[6px]"
              onClick={() => setIsHelpOpen(false)}
            >
              <div 
                className="bg-[#0c101d] border border-slate-700/80 p-5 rounded-[12px] shadow-[0_10px_35px_rgba(0,0,0,0.7)] flex flex-col items-center text-center gap-4.5 w-[280px] select-none relative"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-center font-sans space-y-1">
                  <h3 className="text-[12px] font-semibold text-slate-400">Designed and Created by</h3>
                  <p className="text-[18px] font-bold tracking-wide text-[#00b4ff]">Wamin Suwito</p>
                </div>
                
                <div className="text-[10px] font-sans space-y-1.5 text-slate-300 text-left w-full pl-2 pr-2">
                  <p className="flex items-center gap-1">
                    <span className="font-bold text-slate-400">Email:</span>
                    <a href="mailto:Waminsuwito@yahoo.com" className="text-blue-400 hover:underline">Waminsuwito@yahoo.com</a>
                  </p>
                  <p className="flex items-center gap-1">
                    <span className="font-bold text-slate-400">HP/WhatsApp:</span>
                    <span className="text-[#22c55e] font-semibold">081271963847</span>
                  </p>
                </div>
                
                <button 
                  onClick={() => setIsHelpOpen(false)}
                  className="mt-1 text-center w-full py-1.5 bg-[#00ffd0] hover:bg-[#00e5ff] text-black font-sans font-extrabold rounded-[6px] text-[11.5px] transition-all active:scale-95 cursor-pointer shadow-md"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Moisture Control Modal Overlay */}
        <MoistureControlModal
          isOpen={isMoistureOpen}
          onClose={() => setIsMoistureOpen(false)}
          onSave={(p, b, a) => {
            setPasirMoisture(p);
            setBatuMoisture(b);
            setAirAdjustment(a);
            setMoistureControl(p !== 0 || b !== 0 || a !== 0);
            setIsMoistureOpen(false);
          }}
          currentPasir={pasirMoisture}
          currentBatu={batuMoisture}
          currentAir={airAdjustment}
          recipes={recipesList}
          selectedRecipe={selectedRecipe}
          onRecipeChange={setSelectedRecipe}
        />

        {/* Quarry Aggregate Modal Overlay */}
        <QuarryAggregateModal
          isOpen={isQuarryOpen}
          onClose={() => setIsQuarryOpen(false)}
          onSave={(p1, p2, b1, b2) => {
            localStorage.setItem("quarry_pasir_1", p1);
            localStorage.setItem("quarry_pasir_2", p2);
            localStorage.setItem("quarry_batu_1", b1);
            localStorage.setItem("quarry_batu_2", b2);
            setQuarryPasir1(p1);
            setQuarryPasir2(p2);
            setQuarryBatu1(b1);
            setQuarryBatu2(b2);
            setIsQuarryOpen(false);
          }}
          currentPasir1={quarryPasir1}
          currentPasir2={quarryPasir2}
          currentBatu1={quarryBatu1}
          currentBatu2={quarryBatu2}
        />

        {/* HMI Admin Password Verification Modal */}
        {isHmiAdminOpen && (
          <div 
            className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md select-none"
            onClick={() => {
              setIsHmiAdminOpen(false);
              setHmiAdminPassword("");
              setHmiAdminError("");
            }}
          >
            <div 
              className="bg-[#0c101d] border-2 border-amber-500/80 p-5 rounded-[12px] shadow-[0_20px_50px_rgba(245,158,11,0.25)] flex flex-col gap-4 w-full max-w-sm text-left animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <h3 className="text-[14px] font-black uppercase text-amber-400 tracking-wider font-mono">HMI ADMIN SIGN-IN</h3>
                </div>
                <button 
                  onClick={() => {
                    setIsHmiAdminOpen(false);
                    setHmiAdminPassword("");
                    setHmiAdminError("");
                  }}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <span className="text-[11px] text-slate-400 leading-normal italic">
                  Masukkan kata sandi Administrator untuk mengonfigurasi parameter sistem, membuka Developer Tools, atau mengatur resolusi layar HMI.
                </span>

                <div className="flex flex-col gap-1.5 text-slate-300">
                  <label className="text-[11px] font-mono font-black uppercase tracking-wide text-slate-400">Sandi Keamanan Admin</label>
                  <input
                    type="password"
                    className="w-full h-[40px] bg-[#070b13] border border-slate-800 focus:border-amber-500 focus:shadow-[0_0_8px_rgba(245,158,11,0.15)] text-white text-[15px] font-semibold font-mono rounded-[8px] px-3 outline-none tracking-widest text-center transition-all"
                    placeholder="••••••"
                    value={hmiAdminPassword}
                    onChange={(e) => setHmiAdminPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const trimmed = hmiAdminPassword.trim();
                        if (trimmed === "admin" || trimmed === "1234") {
                          setHmiAdminError("");
                          setHmiAdminPassword("");
                          setIsHmiAdminOpen(false);
                          setIsHmiAdminMenuOpen(true);
                        } else {
                          setHmiAdminError("PIN/Sandi salah!");
                        }
                      }
                    }}
                    autoFocus
                  />
                </div>

                {hmiAdminError && (
                  <span className="text-rose-500 font-sans text-[11px] font-bold text-center">
                    ⚠ {hmiAdminError}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 mt-1 border-t border-slate-850 pt-2.5">
                <button
                  onClick={() => {
                    setIsHmiAdminOpen(false);
                    setHmiAdminPassword("");
                    setHmiAdminError("");
                  }}
                  className="px-4 py-1.5 bg-transparent hover:bg-slate-800/60 border border-slate-800 text-slate-400 hover:text-white rounded-[6px] text-[11.5px] font-sans font-bold transition-all active:scale-95 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    const trimmed = hmiAdminPassword.trim();
                    if (trimmed === "admin" || trimmed === "1234") {
                      setHmiAdminError("");
                      setHmiAdminPassword("");
                      setIsHmiAdminOpen(false);
                      setIsHmiAdminMenuOpen(true);
                    } else {
                      setHmiAdminError("PIN/Sandi salah!");
                    }
                  }}
                  className="px-5 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-[6px] text-[11.5px] font-sans font-black tracking-wider transition-all active:scale-95 cursor-pointer shadow-md"
                >
                  Verifikasi
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HMI Admin Options Menu Modal */}
        {isHmiAdminMenuOpen && (
          <div 
            className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md select-none"
            onClick={() => setIsHmiAdminMenuOpen(false)}
          >
            <div 
              className="bg-[#0c101d] border-2 border-cyan-500/80 p-5 rounded-[12px] shadow-[0_20px_50px_rgba(6,182,212,0.25)] flex flex-col gap-4 w-full max-w-sm text-left animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Settings size={16} className="text-cyan-400 animate-spin" style={{ animationDuration: '10s' }} />
                  <h3 className="text-[14.5px] font-black uppercase text-cyan-400 tracking-wider font-mono">HMI SECURITY & TOOLS HMI</h3>
                </div>
                <button 
                  onClick={() => setIsHmiAdminMenuOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex flex-col gap-2 pt-1 font-sans">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-1">
                  Actions & Diagnostics:
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const api = (window as any).electronAPI;
                      if (api) {
                        api.enterFullscreen();
                      } else {
                        document.documentElement.requestFullscreen().catch(() => {});
                      }
                    }}
                    className="py-2 px-2 bg-slate-900 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-850 rounded-[8px] text-[11px] font-sans font-bold text-slate-300 hover:text-white text-center transition-colors active:scale-95 cursor-pointer"
                  >
                    🖥 Fullscreen
                  </button>
                  <button
                    onClick={() => {
                      const api = (window as any).electronAPI;
                      if (api) {
                        api.exitFullscreen();
                      } else {
                        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
                      }
                    }}
                    className="py-2 px-2 bg-slate-900 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-850 rounded-[8px] text-[11px] font-sans font-bold text-slate-300 hover:text-white text-center transition-colors active:scale-95 cursor-pointer"
                  >
                    🪟 Windowed
                  </button>
                </div>

                <button
                  onClick={() => {
                    const api = (window as any).electronAPI;
                    if (api) {
                      api.openDevTools();
                    } else {
                      alert("Developer Tools hanya didukung pada aplikasi desktop Electron.");
                    }
                  }}
                  className="w-full py-2.5 px-3 flex items-center justify-between bg-slate-900 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-850 rounded-[8px] text-[11px] font-sans font-bold text-slate-300 hover:text-white transition-colors active:scale-95 cursor-pointer"
                >
                  <span>🛠 Developer Tools (F12)</span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded-sm uppercase font-mono font-black scale-90">DEV Only</span>
                </button>

                <button
                  onClick={() => {
                    localStorage.setItem('admin_session', 'true');
                    setCurrentView('admin-dashboard');
                    setIsHmiAdminMenuOpen(false);
                  }}
                  className="w-full py-2.5 px-3 flex items-center justify-between bg-slate-900 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-850 rounded-[8px] text-[11px] font-sans font-bold text-slate-300 hover:text-white transition-colors active:scale-95 cursor-pointer"
                >
                  <span>⚙ Settings (Admin Dashboard)</span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-cyan-950 text-cyan-400 rounded-sm uppercase font-mono font-black scale-90">CONFIG</span>
                </button>

                <button
                  onClick={() => {
                    const api = (window as any).electronAPI;
                    if (api) {
                      api.restartApp();
                    } else {
                      window.location.reload();
                    }
                  }}
                  className="w-full py-2.5 px-3 flex items-center justify-between bg-slate-900 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-850 rounded-[8px] text-[11px] font-sans font-bold text-slate-300 hover:text-white transition-colors active:scale-95 cursor-pointer"
                >
                  <span>🔄 Restart HMI Application</span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded-sm uppercase font-mono font-black scale-90">REBOOT</span>
                </button>

                <button
                  onClick={() => {
                    const api = (window as any).electronAPI;
                    if (api) {
                      api.shutdownApp();
                    } else {
                      alert("Shutdown command sent (only supported in actual desktop app builds).");
                    }
                  }}
                  className="w-full py-2.5 px-3 flex items-center justify-between bg-rose-950/40 border border-rose-900/30 hover:border-rose-500/80 hover:bg-rose-900/40 rounded-[8px] text-[11px] font-sans font-bold text-rose-300 hover:text-rose-100 transition-colors active:scale-95 cursor-pointer"
                >
                  <span>🔌 Shutdown HMI Station</span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-rose-950 text-rose-400 rounded-sm uppercase font-mono font-black scale-90">PWR OFF</span>
                </button>
              </div>

              <div className="flex items-center justify-end border-t border-slate-850 pt-2.5 mt-1">
                <button
                  onClick={() => setIsHmiAdminMenuOpen(false)}
                  className="px-5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-neutral-950 rounded-[6px] text-[11px] font-sans font-black tracking-wide transition-all active:scale-95 cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Fill Silo Form Overlay */}
        <AnimatePresence>
          {isFillSiloOpen && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 z-[250] flex items-center justify-center p-6 bg-black/85 backdrop-blur-xs select-none"
              onClick={() => setIsFillSiloOpen(false)}
            >
              <div 
                className="bg-[#0c111e] border-2 border-[#38bdf8] p-6 rounded-[8px] shadow-2xl flex flex-col gap-4 max-w-sm w-full text-left"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                    <Package size={16} className="text-[#38bdf8]" />
                    Isi Volume Silo
                  </h3>
                  <button 
                    onClick={() => setIsFillSiloOpen(false)}
                    className="text-rose-500 hover:text-rose-400 transition-colors cursor-pointer text-xs uppercase font-black"
                  >
                    Batal
                  </button>
                </div>

                {isConfirmingResetSilo ? (
                  <div className="space-y-4 my-3 p-4 bg-rose-955/20 border-2 border-rose-800 rounded-[6px] text-left">
                    <p className="text-xs font-sans font-black text-rose-500 uppercase tracking-widest leading-none">
                      ⚠️ KONFIRMASI RESET SILO
                    </p>
                    <p className="text-[10px] font-mono text-slate-300 uppercase leading-relaxed">
                      Apakah Anda yakin ingin mengosongkan isi <span className="text-rose-455 font-extrabold">SILO {selectedFillSiloIdx + 1}</span> menjadi <span className="text-rose-400 font-extrabold">0 KG</span> secara permanen?
                    </p>
                    <p className="text-[9px] font-sans text-slate-500 uppercase leading-normal">
                      Aksi ini akan mencatat log peringatan sistem dan menyetel ulang berat silo semen terpilih.
                    </p>
                    <div className="flex gap-2.5 pt-1">
                      <button
                        onClick={() => setIsConfirmingResetSilo(false)}
                        className="flex-1 py-2 bg-slate-900 border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white rounded text-[10px] uppercase font-black tracking-wider cursor-pointer transition-colors"
                      >
                        Batal
                      </button>
                      <button
                        onClick={() => {
                          setSiloWeights(prev => {
                            const next = [...prev];
                            next[selectedFillSiloIdx] = 0;
                            return next;
                          });
                          setIsConfirmingResetSilo(false);
                          
                          // Log the warning log
                          setRelayLogs(l => [{
                            id: 'FILL-RESET-' + Math.random().toString(36).substring(7).toUpperCase(),
                            timestamp: new Date(),
                            message: `[SILO] Reset isi Silo ${selectedFillSiloIdx + 1} menjadi 0 kg oleh Operator`,
                            type: 'warning'
                          }, ...l]);
                        }}
                        className="flex-1 py-2 bg-rose-950 border border-rose-600 text-rose-200 hover:bg-rose-900 hover:text-white rounded text-[10px] uppercase font-black tracking-wider cursor-pointer transition-colors"
                      >
                        Ya, Reset 0
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3.5 my-1">
                      {/* Select Silo */}
                      <div className="space-y-1.5">
                        <label className="block text-slate-350 text-[11px] font-bold uppercase tracking-wider">Pilih Silo Semen</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[...Array(jumlahSilo)].map((_, idx) => {
                            const isSel = selectedFillSiloIdx === idx;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedFillSiloIdx(idx)}
                                className={`py-2 px-1 text-center rounded-[4px] border text-[11px] font-mono font-bold transition-all cursor-pointer ${
                                  isSel 
                                    ? 'bg-blue-950/85 border-[#38bdf8] text-[#38bdf8] shadow-[0_0_8px_rgba(56,189,248,0.25)]' 
                                    : 'bg-[#070b13] border-slate-850 text-slate-400 hover:border-slate-800'
                                }`}
                              >
                                SILO {idx + 1}
                                <span className="block text-[8px] font-sans font-medium text-slate-500 mt-0.5">
                                  {((siloWeights[idx] ?? 0) / 1000).toFixed(1)}t
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Volume Input */}
                      <div className="space-y-1.5">
                        <label className="block text-slate-350 text-[11px] font-bold uppercase tracking-wider">Volume Pengisian (Kg)</label>
                        <div className="relative">
                          <input 
                            type="text" 
                            value={fillSiloAmountText}
                            onChange={(e) => {
                              const cleaned = e.target.value.replace(/[^0-9]/g, "");
                              setFillSiloAmountText(cleaned);
                            }}
                            className="w-full h-10 bg-[#070b13] border border-slate-800 hover:border-slate-700 focus:border-cyan-400 focus:shadow-[0_0_8px_rgba(34,211,238,0.25)] text-white text-[13px] font-mono rounded-[4px] px-3 outline-hidden transition-all text-left" 
                            placeholder="Contoh: 20000"
                          />
                          <span className="absolute right-3 top-2.5 font-mono text-[11px] text-slate-500 font-bold uppercase select-none">KG</span>
                        </div>
                        <p className="text-[9.5px] font-sans text-slate-500 leading-normal italic select-none">
                          • Kapasitas Maksimal: 120.000 Kg
                          <span className="block">• Ruang Tersisa: {Math.max(0, 120000 - (siloWeights[selectedFillSiloIdx] ?? 0)).toLocaleString('id-ID')} Kg</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2.5 pt-2">
                      <button 
                        onClick={() => {
                          setIsConfirmingResetSilo(true);
                        }}
                        className="flex-1 h-10 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-350 hover:text-white font-sans font-black text-xs uppercase tracking-wider rounded-[4px] transition-colors active:scale-97 cursor-pointer text-center"
                      >
                        Reset Silo
                      </button>
                      <button 
                        onClick={() => {
                          const amt = parseInt(fillSiloAmountText, 10);
                          if (isNaN(amt) || amt <= 0) {
                            setCustomAlertMessage("Volume pengisian harus bernilai positif");
                            return;
                          }
                          startFillSilo(selectedFillSiloIdx, amt);
                        }}
                        className="flex-[2] h-10 bg-[#38bdf8] hover:bg-[#0ea5e9] text-slate-950 font-black text-xs uppercase tracking-wider rounded-[4px] transition-colors shadow-lg active:scale-97 cursor-pointer text-center"
                      >
                        Mulai Pengisian
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Silo Filling Progress Animation Overlay */}
        <AnimatePresence>
          {activeFillingSiloIdx !== null && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[280] flex items-center justify-center p-6 bg-black/85 backdrop-blur-xs select-none"
            >
              <div className="bg-[#070c16] border-2 border-[#10b981] p-6 rounded-[8px] shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full text-center">
                <div className="relative w-14 h-14 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-900 border-t-[#10b981] animate-spin" />
                  <Package size={22} className="text-[#10b981]" />
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#10b981]">PROSES TRANSFER CEMENT</h3>
                  <p className="text-[12px] font-sans font-bold text-slate-200">
                    Sedang mengisi Silo {activeFillingSiloIdx + 1} ({Math.round(siloWeights[activeFillingSiloIdx]).toLocaleString('id-ID')} Kg)
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="w-full">
                  <div className="w-full bg-slate-950 h-2 border border-slate-900 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-[#10b981] to-[#34d399] h-full rounded-full transition-all duration-75"
                      style={{ width: `${fillingProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 font-bold mt-1.5 uppercase leading-none">
                    <span>PROGRESS</span>
                    <span>{fillingProgress}%</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Custom Custom Alert Modal for cross-origin iframe sandboxing reliability */}
        <AnimatePresence>
          {customAlertMessage && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[350] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xs select-none"
              onClick={() => setCustomAlertMessage(null)}
            >
              <div 
                className="bg-[#0f1322] border-2 border-rose-500 p-6 rounded-[8px] shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full text-center"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500 flex items-center justify-center text-rose-500">
                  <AlertOctagon size={24} className="animate-pulse" />
                </div>
                
                <div className="space-y-1.5 font-sans">
                  <h3 className="text-xs font-black uppercase tracking-wider text-rose-500">PERINGATAN / WARNING</h3>
                  <p className="text-[12px] font-bold text-slate-200 leading-normal">
                    {customAlertMessage}
                  </p>
                </div>

                <button 
                  onClick={() => setCustomAlertMessage(null)}
                  className="w-full mt-2 h-9 bg-rose-500 hover:bg-rose-600 text-white font-black text-xs uppercase tracking-wider rounded-[4px] transition-all cursor-pointer text-center"
                >
                  OK
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* TOP PANEL: HORIZONTAL WEIGHING CARDS (Moved to top as requested by user, shifted silos and other elements downwards) */}
        <div className="bg-[#0b1329] border border-slate-800 rounded-[5px] p-2.5 flex flex-col gap-2 shadow-md shrink-0">
          <div className="flex justify-between items-center border-b border-slate-850 pb-1 px-0.5 select-none font-sans shrink-0">
            <span className="text-[9px] font-black tracking-widest text-[#00ffd0] uppercase flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              TIMBANGAN MATERIAL
            </span>
            <span className="text-[7.5px] font-mono text-slate-500 font-black uppercase">LIVE INDICATOR</span>
          </div>
          <div className={`grid gap-2 shrink-0 ${batchingPlantMode === 'SYSTEM_2' ? 'grid-cols-3' : 'grid-cols-4'}`}>
            {(batchingPlantMode === 'SYSTEM_2' ? [
              { key: 'aggregate_combined', label: 'AGGREGATE (AKUMULATIF)', isCombined: true },
              { key: 'semen', label: 'SEMEN (CEMENT)' },
              { key: 'air', label: 'AIR & ADITIF' }
            ] : [
              { key: 'pasir', label: 'PASIR (SAND)' },
              { key: 'batu', label: 'BATU (STONE)' },
              { key: 'semen', label: 'SEMEN (CEMENT)' },
              { key: 'air', label: 'AIR & ADITIF' }
            ]).map((itemConf) => {
              const { key, label } = itemConf;
              let item: any;
              if (itemConf.isCombined) {
                item = {
                  target: scales.pasir.target + scales.batu.target,
                  actual: scales.pasir.actual + scales.batu.actual,
                  isActive: scales.pasir.isActive || scales.batu.isActive,
                  isComplete: scales.pasir.isComplete && scales.batu.isComplete,
                  unit: 'kg'
                };
              } else {
                item = scales[key as MaterialType];
              }

              // Calculate individual component targets for System 2 Accumulative Scale
              const tFactor = parseFloat((activeVolume / (totalCycles || 1)).toFixed(2)) || 1.0;
              const savedJmf = selectedRecipe?.jobMixDetails;
              const targetValuePasir1 = savedJmf?.pasir1 || Math.round((selectedRecipe?.targets?.pasir || 400) * 0.7);
              const targetValuePasir2 = savedJmf?.pasir2 || Math.round((selectedRecipe?.targets?.pasir || 400) * 0.3);
              const targetValueBatu1 = savedJmf?.batu1 || Math.round((selectedRecipe?.targets?.batu || 400) * 0.7);
              const targetValueBatu2 = savedJmf?.batu2 || Math.round((selectedRecipe?.targets?.batu || 400) * 0.3);

              const adjustedTargetPasir1 = Math.round(targetValuePasir1 * tFactor);
              const adjustedTargetPasir2 = Math.round(targetValuePasir2 * tFactor);
              const adjustedTargetBatu1 = Math.round(targetValueBatu1 * tFactor);
              const adjustedTargetBatu2 = Math.round(targetValueBatu2 * tFactor);
              
              return (
                <div key={key} className="bg-[#121c32]/50 border border-slate-800 rounded-[5px] p-3 shadow-md flex flex-col justify-between overflow-hidden relative min-h-[148px] transition-all duration-250">
                  {/* Card Header (Target) */}
                  <div className="flex justify-between items-center border-b border-slate-850 pb-1.5 select-none leading-none shrink-0">
                    <span className="text-[9px] font-sans font-black text-slate-400 uppercase tracking-widest truncate">{label}</span>
                    <span className="text-[10px] font-mono font-black text-slate-400">
                      TARGET: <span className="text-amber-400 font-extrabold">{item.target.toFixed(0)}</span> <span className="text-[7.5px] text-slate-500 font-bold">KG</span>
                    </span>
                  </div>
                  
                  {/* Card Input/Value & LED/Jog Button Row */}
                  <div className="flex justify-between items-center mt-2.5 mb-2 select-none leading-none">
                    <span className={`font-mono text-[28px] sm:text-[32px] md:text-[36px] font-black tracking-tighter leading-none ${
                      item.isActive 
                        ? 'text-[#00ffd0] drop-shadow-[0_0_10px_rgba(0,255,208,0.6)] font-black' 
                        : item.isComplete 
                          ? 'text-[#00ff9c] drop-shadow-[0_0_6px_rgba(0,255,156,0.3)]' 
                          : 'text-slate-200'
                    }`}>
                      {item.actual.toFixed(0)} <span className="text-[11px] font-sans font-black text-slate-500 lowercase tracking-widest">KG</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        item.isActive 
                          ? 'bg-[#00ffd0] shadow-[0_0_10px_rgba(0,255,208,0.8)]' 
                          : item.isComplete 
                            ? 'bg-[#00ff9c] shadow-[0_0_6px_rgba(0,255,156,0.5)]' 
                            : 'bg-slate-800'
                      }`} />

                      {/* Manual JOG / SEMI AUTO Buttons merged for desktop ergonomics */}
                      {itemConf.isCombined ? (
                        <div className="flex gap-1 shrink-0">
                          <div className="flex flex-col items-center">
                            {batchingMode === 'SEMI_AUTO' ? (
                              <button
                                onClick={() => { if (isRunning && !scales.pasir.isComplete) handleManualDeviceToggle('pasir1'); }}
                                disabled={!isRunning || scales.pasir.isComplete}
                                className={`py-1 px-1.5 flex items-center justify-center text-[7.5px] font-sans font-black tracking-tighter rounded transition-all duration-150 leading-none select-none uppercase shrink-0 border text-center cursor-pointer min-w-[28px] h-5
                                  ${semiAutoDosing.pasir1
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-450 font-black animate-pulse'
                                    : scales.pasir.isComplete || !isRunning
                                      ? 'bg-slate-900 border-slate-950 text-slate-650 cursor-not-allowed font-medium'
                                      : 'bg-[#121c32] text-emerald-400 border-emerald-500/20 cursor-pointer hover:bg-emerald-500/10 hover:border-emerald-500/50'
                                  }`}
                              >
                                PS1
                              </button>
                            ) : (
                              <button
                                onMouseDown={() => { if (isRunning && !scales.pasir.isComplete) setJoggingPasir1(true); }}
                                onMouseUp={() => setJoggingPasir1(false)}
                                onMouseLeave={() => setJoggingPasir1(false)}
                                onTouchStart={() => { if (isRunning && !scales.pasir.isComplete) setJoggingPasir1(true); }}
                                onTouchEnd={() => setJoggingPasir1(false)}
                                disabled={!isRunning || scales.pasir.isComplete}
                                className={`py-1 px-1.5 flex items-center justify-center text-[7.5px] font-sans font-black tracking-tighter rounded transition-all duration-150 leading-none select-none uppercase shrink-0 border text-center cursor-pointer min-w-[28px] h-5
                                  ${(joggingPasir1 || gatePasir1SiloOpen)
                                    ? 'bg-amber-500 text-black border-amber-400 font-extrabold animate-pulse'
                                    : scales.pasir.isComplete || !isRunning
                                      ? 'bg-slate-900 border-slate-950 text-slate-650 cursor-not-allowed font-medium'
                                      : 'bg-[#121c32] text-amber-500 border-amber-500/25 cursor-pointer hover:bg-amber-500/10'
                                  }`}
                              >
                                {(joggingPasir1 || gatePasir1SiloOpen) ? 'PS1 ON' : 'PS1'}
                              </button>
                            )}
                            <span className={`w-2 h-2 rounded-full mt-1.5 transition-all duration-150 ${
                              gatePasir1SiloOpen
                                ? 'bg-[#00ff9c] shadow-[0_0_6px_rgba(0,255,156,0.8)] animate-blink-fast'
                                : 'bg-[#ef4444] shadow-[0_0_4px_rgba(239,68,68,0.6)]'
                            }`} />
                          </div>
                          <div className="flex flex-col items-center">
                            {batchingMode === 'SEMI_AUTO' ? (
                              <button
                                onClick={() => { if (isRunning && !scales.pasir.isComplete) handleManualDeviceToggle('pasir2'); }}
                                disabled={!isRunning || scales.pasir.isComplete}
                                className={`py-1 px-1.5 flex items-center justify-center text-[8px] font-sans font-black tracking-tighter rounded transition-all duration-150 leading-none select-none uppercase shrink-0 border text-center cursor-pointer min-w-[28px] h-5
                                  ${semiAutoDosing.pasir2
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-450 font-black animate-pulse'
                                    : scales.pasir.isComplete || !isRunning
                                      ? 'bg-slate-900 border-slate-950 text-slate-650 cursor-not-allowed font-medium'
                                      : 'bg-[#121c32] text-emerald-400 border-emerald-500/20 cursor-pointer hover:bg-emerald-500/10 hover:border-emerald-500/50'
                                  }`}
                              >
                                PS2
                              </button>
                            ) : (
                              <button
                                onMouseDown={() => { if (isRunning && !scales.pasir.isComplete) setJoggingPasir2(true); }}
                                onMouseUp={() => setJoggingPasir2(false)}
                                onMouseLeave={() => setJoggingPasir2(false)}
                                onTouchStart={() => { if (isRunning && !scales.pasir.isComplete) setJoggingPasir2(true); }}
                                onTouchEnd={() => setJoggingPasir2(false)}
                                disabled={!isRunning || scales.pasir.isComplete}
                                className={`py-1 px-1.5 flex items-center justify-center text-[8px] font-sans font-black tracking-tighter rounded transition-all duration-150 leading-none select-none uppercase shrink-0 border text-center cursor-pointer min-w-[28px] h-5
                                  ${(joggingPasir2 || gatePasir2SiloOpen)
                                    ? 'bg-amber-500 text-black border-amber-400 font-extrabold animate-pulse'
                                    : scales.pasir.isComplete || !isRunning
                                      ? 'bg-slate-900 border-slate-950 text-slate-650 cursor-not-allowed font-medium'
                                      : 'bg-[#121c32] text-amber-500 border-amber-500/25 cursor-pointer hover:bg-amber-500/10'
                                  }`}
                              >
                                {(joggingPasir2 || gatePasir2SiloOpen) ? 'PS2 ON' : 'PS2'}
                              </button>
                            )}
                            <span className={`w-2 h-2 rounded-full mt-1.5 transition-all duration-150 ${
                              gatePasir2SiloOpen
                                ? 'bg-[#00ff9c] shadow-[0_0_6px_rgba(0,255,156,0.8)] animate-blink-fast'
                                : 'bg-[#ef4444] shadow-[0_0_4px_rgba(239,68,68,0.6)]'
                            }`} />
                          </div>
                          <div className="flex flex-col items-center">
                            {batchingMode === 'SEMI_AUTO' ? (
                              <button
                                onClick={() => { if (isRunning && !scales.batu.isComplete) handleManualDeviceToggle('batu1'); }}
                                disabled={!isRunning || scales.batu.isComplete}
                                className={`py-1 px-1.5 flex items-center justify-center text-[7.5px] font-sans font-black tracking-tighter rounded transition-all duration-150 leading-none select-none uppercase shrink-0 border text-center cursor-pointer min-w-[28px] h-5
                                  ${semiAutoDosing.batu1
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-450 font-black animate-pulse'
                                    : scales.batu.isComplete || !isRunning
                                      ? 'bg-slate-900 border-slate-950 text-slate-650 cursor-not-allowed font-medium'
                                      : 'bg-[#121c32] text-emerald-400 border-emerald-500/20 cursor-pointer hover:bg-emerald-500/10 hover:border-emerald-500/50'
                                  }`}
                              >
                                BT1
                              </button>
                            ) : (
                              <button
                                onMouseDown={() => { if (isRunning && !scales.batu.isComplete) setJoggingBatu1(true); }}
                                onMouseUp={() => setJoggingBatu1(false)}
                                onMouseLeave={() => setJoggingBatu1(false)}
                                onTouchStart={() => { if (isRunning && !scales.batu.isComplete) setJoggingBatu1(true); }}
                                onTouchEnd={() => setJoggingBatu1(false)}
                                disabled={!isRunning || scales.batu.isComplete}
                                className={`py-1 px-1.5 flex items-center justify-center text-[7.5px] font-sans font-black tracking-tighter rounded transition-all duration-150 leading-none select-none uppercase shrink-0 border text-center cursor-pointer min-w-[28px] h-5
                                  ${(joggingBatu1 || gateBatu1SiloOpen)
                                    ? 'bg-amber-500 text-black border-amber-400 font-extrabold animate-pulse'
                                    : scales.batu.isComplete || !isRunning
                                      ? 'bg-slate-900 border-slate-950 text-slate-650 cursor-not-allowed font-medium'
                                      : 'bg-[#121c32] text-amber-500 border-amber-500/25 cursor-pointer hover:bg-amber-500/10'
                                  }`}
                              >
                                {(joggingBatu1 || gateBatu1SiloOpen) ? 'BT1 ON' : 'BT1'}
                              </button>
                            )}
                            <span className={`w-2 h-2 rounded-full mt-1.5 transition-all duration-150 ${
                              gateBatu1SiloOpen
                                ? 'bg-[#00ff9c] shadow-[0_0_6px_rgba(0,255,156,0.8)] animate-blink-fast'
                                : 'bg-[#ef4444] shadow-[0_0_4px_rgba(239,68,68,0.6)]'
                            }`} />
                          </div>
                          <div className="flex flex-col items-center">
                            {batchingMode === 'SEMI_AUTO' ? (
                              <button
                                onClick={() => { if (isRunning && !scales.batu.isComplete) handleManualDeviceToggle('batu2'); }}
                                disabled={!isRunning || scales.batu.isComplete}
                                className={`py-1 px-1.5 flex items-center justify-center text-[7.5px] font-sans font-black tracking-tighter rounded transition-all duration-150 leading-none select-none uppercase shrink-0 border text-center cursor-pointer min-w-[28px] h-5
                                  ${semiAutoDosing.batu2
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-450 font-black animate-pulse'
                                    : scales.batu.isComplete || !isRunning
                                      ? 'bg-slate-900 border-slate-950 text-slate-650 cursor-not-allowed font-medium'
                                      : 'bg-[#121c32] text-emerald-400 border-emerald-500/25 cursor-pointer hover:bg-emerald-500/10'
                                  }`}
                              >
                                BT2
                              </button>
                            ) : (
                              <button
                                onMouseDown={() => { if (isRunning && !scales.batu.isComplete) setJoggingBatu2(true); }}
                                onMouseUp={() => setJoggingBatu2(false)}
                                onMouseLeave={() => setJoggingBatu2(false)}
                                onTouchStart={() => { if (isRunning && !scales.batu.isComplete) setJoggingBatu2(true); }}
                                onTouchEnd={() => setJoggingBatu2(false)}
                                disabled={!isRunning || scales.batu.isComplete}
                                className={`py-1 px-1.5 flex items-center justify-center text-[7.5px] font-sans font-black tracking-tighter rounded transition-all duration-150 leading-none select-none uppercase shrink-0 border text-center cursor-pointer min-w-[28px] h-5
                                  ${(joggingBatu2 || gateBatu2SiloOpen)
                                    ? 'bg-amber-500 text-black border-amber-400 font-extrabold animate-pulse'
                                    : scales.batu.isComplete || !isRunning
                                      ? 'bg-slate-900 border-slate-950 text-slate-650 cursor-not-allowed font-medium'
                                      : 'bg-[#121c32] text-amber-500 border-amber-500/25 cursor-pointer hover:bg-amber-500/10'
                                  }`}
                              >
                                {(joggingBatu2 || gateBatu2SiloOpen) ? 'BT2 ON' : 'BT2'}
                              </button>
                            )}
                            <span className={`w-2 h-2 rounded-full mt-1.5 transition-all duration-150 ${
                              gateBatu2SiloOpen
                                ? 'bg-[#00ff9c] shadow-[0_0_6px_rgba(0,255,156,0.8)] animate-blink-fast'
                                : 'bg-[#ef4444] shadow-[0_0_4px_rgba(239,68,68,0.6)]'
                            }`} />
                          </div>
                        </div>
                      ) : key === 'pasir' ? (
                        <div className="flex gap-1.5 shrink-0">
                          <div className="flex flex-col items-center">
                            {batchingMode === 'SEMI_AUTO' ? (
                              <button
                                onClick={() => { if (isRunning && !item.isComplete) handleManualDeviceToggle('pasir1'); }}
                                disabled={!isRunning || item.isComplete}
                                className={`py-1 px-2 flex items-center justify-center text-[8px] font-sans font-black tracking-wider rounded transition-all duration-150 leading-none select-none uppercase shrink-0 border text-center cursor-pointer min-w-[50px] h-5
                                  ${semiAutoDosing.pasir1
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-450 font-black animate-pulse'
                                    : item.isComplete || !isRunning
                                      ? 'bg-slate-900 border-slate-950 text-slate-600 cursor-not-allowed font-medium'
                                      : 'bg-[#121c32] text-emerald-400 border-emerald-500/20 cursor-pointer hover:bg-emerald-500/10 hover:border-emerald-500/50'
                                  }`}
                              >
                                PASIR 1
                              </button>
                            ) : (
                              <button
                                onMouseDown={() => { if (isRunning && !item.isComplete) setJoggingPasir1(true); }}
                                onMouseUp={() => setJoggingPasir1(false)}
                                onMouseLeave={() => setJoggingPasir1(false)}
                                onTouchStart={() => { if (isRunning && !item.isComplete) setJoggingPasir1(true); }}
                                onTouchEnd={() => setJoggingPasir1(false)}
                                disabled={!isRunning || item.isComplete}
                                className={`py-1 px-2 flex items-center justify-center text-[8px] font-sans font-black tracking-wider rounded transition-all duration-150 leading-none select-none uppercase shrink-0 border text-center cursor-pointer min-w-[50px] h-5
                                  ${(joggingPasir1 || gatePasir1SiloOpen)
                                    ? 'bg-amber-500 text-black border-amber-400 font-extrabold scale-95 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                                    : item.isComplete || !isRunning
                                      ? 'bg-slate-900 border-slate-950 text-slate-600 cursor-not-allowed font-medium'
                                      : 'bg-[#121c32] text-amber-500 border-amber-500/20 cursor-pointer hover:bg-amber-500/10 hover:border-amber-500/50'
                                  }`}
                              >
                                {(joggingPasir1 || gatePasir1SiloOpen) ? 'PASIR 1 (ON)' : 'PASIR 1'}
                              </button>
                            )}
                            <span className={`w-2 h-2 rounded-full mt-1.5 transition-all duration-150 ${
                              gatePasir1SiloOpen
                                ? 'bg-[#00ff9c] shadow-[0_0_6px_rgba(0,255,156,0.8)] animate-blink-fast'
                                : 'bg-[#ef4444] shadow-[0_0_4px_rgba(239,68,68,0.6)]'
                            }`} />
                          </div>
                          <div className="flex flex-col items-center">
                            {batchingMode === 'SEMI_AUTO' ? (
                              <button
                                onClick={() => { if (isRunning && !item.isComplete) handleManualDeviceToggle('pasir2'); }}
                                disabled={!isRunning || item.isComplete}
                                className={`py-1 px-2 flex items-center justify-center text-[8px] font-sans font-black tracking-wider rounded transition-all duration-150 leading-none select-none uppercase shrink-0 border text-center cursor-pointer min-w-[50px] h-5
                                  ${semiAutoDosing.pasir2
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-450 font-black animate-pulse'
                                    : item.isComplete || !isRunning
                                      ? 'bg-slate-900 border-slate-950 text-slate-600 cursor-not-allowed font-medium'
                                      : 'bg-[#121c32] text-emerald-400 border-emerald-500/20 cursor-pointer hover:bg-emerald-500/10 hover:border-emerald-500/50'
                                  }`}
                              >
                                PASIR 2
                              </button>
                            ) : (
                              <button
                                onMouseDown={() => { if (isRunning && !item.isComplete) setJoggingPasir2(true); }}
                                onMouseUp={() => setJoggingPasir2(false)}
                                onMouseLeave={() => setJoggingPasir2(false)}
                                onTouchStart={() => { if (isRunning && !item.isComplete) setJoggingPasir2(true); }}
                                onTouchEnd={() => setJoggingPasir2(false)}
                                disabled={!isRunning || item.isComplete}
                                className={`py-1 px-2 flex items-center justify-center text-[8px] font-sans font-black tracking-wider rounded transition-all duration-150 leading-none select-none uppercase shrink-0 border text-center cursor-pointer min-w-[50px] h-5
                                  ${(joggingPasir2 || gatePasir2SiloOpen)
                                    ? 'bg-amber-500 text-black border-amber-400 font-extrabold scale-95 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                                    : item.isComplete || !isRunning
                                      ? 'bg-slate-900 border-slate-950 text-slate-600 cursor-not-allowed font-medium'
                                      : 'bg-[#121c32] text-amber-500 border-amber-500/20 cursor-pointer hover:bg-amber-500/10 hover:border-emerald-500/50'
                                  }`}
                              >
                                {(joggingPasir2 || gatePasir2SiloOpen) ? 'PASIR 2 (ON)' : 'PASIR 2'}
                              </button>
                            )}
                            <span className={`w-2 h-2 rounded-full mt-1.5 transition-all duration-150 ${
                              gatePasir2SiloOpen
                                ? 'bg-[#00ff9c] shadow-[0_0_6px_rgba(0,255,156,0.8)] animate-blink-fast'
                                : 'bg-[#ef4444] shadow-[0_0_4px_rgba(239,68,68,0.6)]'
                            }`} />
                          </div>
                        </div>
                      ) : key === 'batu' ? (
                        <div className="flex gap-1.5 shrink-0">
                          <div className="flex flex-col items-center">
                            {batchingMode === 'SEMI_AUTO' ? (
                              <button
                                onClick={() => { if (isRunning && !item.isComplete) handleManualDeviceToggle('batu1'); }}
                                disabled={!isRunning || item.isComplete}
                                className={`py-1 px-2 flex items-center justify-center text-[8px] font-sans font-black tracking-wider rounded transition-all duration-150 leading-none select-none uppercase shrink-0 border text-center cursor-pointer min-w-[50px] h-5
                                  ${semiAutoDosing.batu1
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-450 font-black animate-pulse'
                                    : item.isComplete || !isRunning
                                      ? 'bg-slate-900 border-slate-950 text-slate-650 cursor-not-allowed font-medium'
                                      : 'bg-[#121c32] text-emerald-400 border-emerald-500/20 cursor-pointer hover:bg-emerald-500/10 hover:border-emerald-500/50'
                                  }`}
                              >
                                BATU 1
                              </button>
                            ) : (
                              <button
                                onMouseDown={() => { if (isRunning && !item.isComplete) setJoggingBatu1(true); }}
                                onMouseUp={() => setJoggingBatu1(false)}
                                onMouseLeave={() => setJoggingBatu1(false)}
                                onTouchStart={() => { if (isRunning && !item.isComplete) setJoggingBatu1(true); }}
                                onTouchEnd={() => setJoggingBatu1(false)}
                                disabled={!isRunning || item.isComplete}
                                className={`py-1 px-2 flex items-center justify-center text-[8px] font-sans font-black tracking-wider rounded transition-all duration-150 leading-none select-none uppercase shrink-0 border text-center cursor-pointer min-w-[50px] h-5
                                  ${(joggingBatu1 || gateBatu1SiloOpen)
                                    ? 'bg-amber-500 text-black border-amber-400 font-extrabold scale-95 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                                    : item.isComplete || !isRunning
                                      ? 'bg-slate-900 border-slate-950 text-slate-650 cursor-not-allowed font-medium'
                                      : 'bg-[#121c32] text-amber-500 border-amber-500/20 cursor-pointer hover:bg-amber-500/10 hover:border-amber-500/50'
                                  }`}
                              >
                                {(joggingBatu1 || gateBatu1SiloOpen) ? 'BATU 1 (ON)' : 'BATU 1'}
                              </button>
                            )}
                            <span className={`w-2 h-2 rounded-full mt-1.5 transition-all duration-150 ${
                              gateBatu1SiloOpen
                                ? 'bg-[#00ff9c] shadow-[0_0_6px_rgba(0,255,156,0.8)] animate-blink-fast'
                                : 'bg-[#ef4444] shadow-[0_0_4px_rgba(239,68,68,0.6)]'
                            }`} />
                          </div>
                          <div className="flex flex-col items-center">
                            {batchingMode === 'SEMI_AUTO' ? (
                              <button
                                onClick={() => { if (isRunning && !item.isComplete) handleManualDeviceToggle('batu2'); }}
                                disabled={!isRunning || item.isComplete}
                                className={`py-1 px-2 flex items-center justify-center text-[8px] font-sans font-black tracking-wider rounded transition-all duration-150 leading-none select-none uppercase shrink-0 border text-center cursor-pointer min-w-[50px] h-5
                                  ${semiAutoDosing.batu2
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-450 font-black animate-pulse'
                                    : item.isComplete || !isRunning
                                      ? 'bg-slate-900 border-slate-950 text-slate-650 cursor-not-allowed font-medium'
                                      : 'bg-[#121c32] text-emerald-400 border-emerald-500/20 cursor-pointer hover:bg-emerald-500/10 hover:border-emerald-500/50'
                                  }`}
                              >
                                BATU 2
                              </button>
                            ) : (
                              <button
                                onMouseDown={() => { if (isRunning && !item.isComplete) setJoggingBatu2(true); }}
                                onMouseUp={() => setJoggingBatu2(false)}
                                onMouseLeave={() => setJoggingBatu2(false)}
                                onTouchStart={() => { if (isRunning && !item.isComplete) setJoggingBatu2(true); }}
                                onTouchEnd={() => setJoggingBatu2(false)}
                                disabled={!isRunning || item.isComplete}
                                className={`py-1 px-2 flex items-center justify-center text-[8px] font-sans font-black tracking-wider rounded transition-all duration-150 leading-none select-none uppercase shrink-0 border text-center cursor-pointer min-w-[50px] h-5
                                  ${(joggingBatu2 || gateBatu2SiloOpen)
                                    ? 'bg-amber-500 text-black border-amber-400 font-extrabold scale-95 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                                    : item.isComplete || !isRunning
                                      ? 'bg-slate-900 border-slate-950 text-slate-650 cursor-not-allowed font-medium'
                                      : 'bg-[#121c32] text-amber-500 border-amber-500/20 cursor-pointer hover:bg-amber-500/10 hover:border-emerald-500/50'
                                  }`}
                              >
                                {(joggingBatu2 || gateBatu2SiloOpen) ? 'BATU 2 (ON)' : 'BATU 2'}
                              </button>
                            )}
                            <span className={`w-2 h-2 rounded-full mt-1.5 transition-all duration-150 ${
                              gateBatu2SiloOpen
                                ? 'bg-[#00ff9c] shadow-[0_0_6px_rgba(0,255,156,0.8)] animate-blink-fast'
                                : 'bg-[#ef4444] shadow-[0_0_4px_rgba(239,68,68,0.6)]'
                            }`} />
                          </div>
                        </div>
                      ) : (
                        batchingMode === 'SEMI_AUTO' ? (
                          <button
                            onClick={() => {
                              if (isRunning && !item.isComplete) {
                                if (key === 'semen') {
                                  // Click semen semi-auto is toggled using handleManualDeviceToggle('siloX')
                                  const activeSiloNumMatch = activeSiloSemen.match(/\d+/);
                                  const activeSiloIdx = activeSiloNumMatch ? parseInt(activeSiloNumMatch[0], 10) : 1;
                                  handleManualDeviceToggle('silo' + activeSiloIdx);
                                }
                                if (key === 'air') {
                                  handleManualDeviceToggle('valveIsiAir');
                                }
                              }
                            }}
                            disabled={!isRunning || item.isComplete}
                            className={`py-1 px-2 text-[8px] font-sans font-black tracking-widest rounded transition-all duration-150 leading-none select-none uppercase shrink-0 border text-center cursor-pointer h-5 min-w-[55px]
                              ${((key === 'semen' ? semiAutoDosing.semen : semiAutoDosing.air))
                                ? 'bg-emerald-500 text-slate-950 border-emerald-450 font-black animate-pulse'
                                : item.isComplete || !isRunning
                                  ? 'bg-slate-900 border-slate-950 text-slate-600 cursor-not-allowed font-medium'
                                  : 'bg-[#121c32] text-emerald-400 border-emerald-550/25 cursor-pointer hover:bg-emerald-500/10 hover:border-emerald-500/50'
                              }`}
                          >
                            SEMI
                          </button>
                        ) : (
                          <button
                            onMouseDown={() => {
                              if (isRunning && !item.isComplete) {
                                if (key === 'semen') setJoggingSemen(true);
                                if (key === 'air') setJoggingAir(true);
                              }
                            }}
                            onMouseUp={() => {
                              if (key === 'semen') setJoggingSemen(false);
                              if (key === 'air') setJoggingAir(false);
                            }}
                            onMouseLeave={() => {
                              if (key === 'semen') setJoggingSemen(false);
                              if (key === 'air') setJoggingAir(false);
                            }}
                            onTouchStart={() => {
                              if (isRunning && !item.isComplete) {
                                if (key === 'semen') setJoggingSemen(true);
                                if (key === 'air') setJoggingAir(true);
                              }
                            }}
                            onTouchEnd={() => {
                              if (key === 'semen') setJoggingSemen(false);
                              if (key === 'air') setJoggingAir(false);
                            }}
                            disabled={!isRunning || item.isComplete}
                            className={`py-1 px-2 text-[8px] font-sans font-black tracking-widest rounded transition-all duration-150 leading-none select-none uppercase shrink-0 border text-center cursor-pointer h-5 min-w-[55px]
                              ${(key === 'semen' ? (joggingSemen || screwSemenActive) : (joggingAir || valveWaterActive))
                                ? 'bg-amber-500 text-black border-[#fb923c] font-extrabold animate-pulse'
                                : item.isComplete || !isRunning
                                  ? 'bg-slate-900 border-slate-950 text-slate-600 cursor-not-allowed font-medium'
                                  : 'bg-[#121c32] text-[#f59e0b] border-amber-550/25 cursor-pointer hover:bg-[#a87c16]/10 hover:border-amber-500/50'
                              }`}
                          >
                            {(key === 'semen' ? (joggingSemen || screwSemenActive) : (joggingAir || valveWaterActive))
                              ? (key === 'semen' ? 'SMN ON' : 'AIR ON')
                              : 'JOG'}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Individual targets detail for System 2 Accumulative Scale */}
                  {itemConf.isCombined && (
                    <div className="mt-2 text-[10px] grid grid-cols-4 gap-1 select-none shrink-0">
                      <div className="flex flex-col bg-[#0b1329]/40 border border-slate-800/80 p-1 rounded text-center">
                        <span className="text-[7.2px] font-sans font-black text-[#00e5ff] uppercase leading-none mb-0.5">PS1 TGT</span>
                        <span className="text-[10px] font-mono font-black text-amber-500 leading-none">{adjustedTargetPasir1} <span className="text-[6.5px] text-slate-500 font-bold">KG</span></span>
                      </div>
                      <div className="flex flex-col bg-[#0b1329]/40 border border-slate-800/80 p-1 rounded text-center">
                        <span className="text-[7.2px] font-sans font-black text-[#00e5ff] uppercase leading-none mb-0.5">PS2 TGT</span>
                        <span className="text-[10px] font-mono font-black text-amber-500 leading-none">{adjustedTargetPasir2} <span className="text-[6.5px] text-slate-500 font-bold">KG</span></span>
                      </div>
                      <div className="flex flex-col bg-[#0b1329]/40 border border-slate-800/80 p-1 rounded text-center">
                        <span className="text-[7.2px] font-sans font-black text-[#00e5ff] uppercase leading-none mb-0.5">BT1 TGT</span>
                        <span className="text-[10px] font-mono font-black text-amber-500 leading-none">{adjustedTargetBatu1} <span className="text-[6.5px] text-slate-500 font-bold">KG</span></span>
                      </div>
                      <div className="flex flex-col bg-[#0b1329]/40 border border-slate-800/80 p-1 rounded text-center">
                        <span className="text-[7.2px] font-sans font-black text-[#00e5ff] uppercase leading-none mb-0.5">BT2 TGT</span>
                        <span className="text-[10px] font-mono font-black text-amber-500 leading-none">{adjustedTargetBatu2} <span className="text-[6.5px] text-slate-500 font-bold">KG</span></span>
                      </div>
                    </div>
                  )}

                  {/* Bottom Micro progress indicator to fill taller card space */}
                  <div className="h-1.5 w-full bg-[#111827] mt-3 rounded-full overflow-hidden shrink-0 border border-slate-800/80">
                    <div 
                      className={`h-full transition-all duration-300 ${item.isComplete ? 'bg-[#00ff9c] shadow-[0_0_8px_rgba(0,255,156,0.6)]' : item.isActive ? 'bg-[#00ffd0] shadow-[0_0_8px_rgba(0,255,208,0.6)] animate-pulse' : 'bg-slate-750'}`}
                      style={{ width: `${Math.min(100, (item.actual / (item.target || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Inner layout 2-Column Grid representing the pristine Lovable HMI design matching full-screen layouts */}
        <div className="flex-1 grid grid-cols-[1fr_240px] gap-3 min-h-0 relative select-none">
          {/* CENTER PANEL: MECHANICAL DIAGRAM */}
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            {/* MECHANICAL SCADA CANVAS AREA (Elegant representation) */}
            <div className="flex-1 bg-[#05080c] border border-slate-800 rounded-[5px] relative overflow-hidden flex flex-col lg:flex-row items-stretch p-2 gap-3 shadow-inner">
              <div className="flex-1 min-w-0 h-full relative flex items-center justify-center">
                <ScadaDiagram 
                  isRunning={isRunning} 
                  currentStep={currentStep} 
                  isDone={isDone} 
                  truckImage={truckImage}
                  onTruckClick={() => fileInputRef.current?.click()}
                  scales={scales}
                  startBatch={() => setIsBatchConfigOpen(true)}
                  stopBatch={stopBatch}
                  isAuto={isAuto}
                  setIsAuto={setIsAuto}
                  moistureControl={moistureControl}
                  setMoistureControl={setMoistureControl}
                  onMoistureClick={() => setIsMoistureOpen(true)}
                  quarryAggregate={quarryAggregate}
                  setQuarryAggregate={setQuarryAggregate}
                  onQuarryClick={() => setIsQuarryOpen(true)}
                  quarryPasir1={quarryPasir1}
                  quarryPasir2={quarryPasir2}
                  quarryBatu1={quarryBatu1}
                  quarryBatu2={quarryBatu2}
                  isPrint={isPrint}
                  setIsPrint={setIsPrint}
                  onHelpClick={() => setIsHelpOpen(true)}
                  productionState={productionState}
                  currentCycle={currentCycle}
                  totalCycles={totalCycles}
                  currentBatch={currentBatch}
                  targetBatch={targetBatch}
                  activeVolume={activeVolume}
                  siloWeights={siloWeights}
                  jumlahSilo={jumlahSilo}
                  gatePasirSiloOpen={gatePasirSiloOpen}
                  gatePasir1SiloOpen={gatePasir1SiloOpen}
                  gatePasir2SiloOpen={gatePasir2SiloOpen}
                  gateBatuSiloOpen={gateBatuSiloOpen}
                  gateBatu1SiloOpen={gateBatu1SiloOpen}
                  gateBatu2SiloOpen={gateBatu2SiloOpen}
                  screwSemenActive={screwSemenActive}
                  valveWaterActive={valveWaterActive}
                  gatePasirHopperOpen={gatePasirHopperOpen}
                  gateBatuHopperOpen={gateBatuHopperOpen}
                  gateSemenHopperOpen={gateSemenHopperOpen}
                  gateWaterHopperOpen={gateWaterHopperOpen}
                  conveyorBottomActive={conveyorBottomActive}
                  conveyorUpperActive={conveyorUpperActive}
                  mixerShaftActive={mixerShaftActive}
                  mixerDoorPercent={mixerDoorPercent}
                  mixerDoorStateText={mixerDoorStateText}
                  concreteDischargeActive={concreteDischargeActive}
                  mixingCountdown={mixingCountdown}
                  dischargeTimeSec={dischargeTimeSec}
                  activeMixingTime={activeMixingTime}
                  ampere={ampere}
                  airPressure={airPressure}
                  setAirPressure={setAirPressure}
                  slump={slump}
                  relayLogs={relayLogs}
                  isPaused={isPaused}
                  activeSiloSemen={activeSiloSemen}
                  activePins={activePins}
                  batchingPlantMode={batchingPlantMode}
                  waitingHopperEnabled={waitingHopperEnabled}
                  waitingHopperState={waitingHopperState}
                  waitingHopperGateOpen={waitingHopperGateOpen}
                  waitingHopperWeight={waitingHopperWeight}
                  selectedRecipe={selectedRecipe}
                  volumePerBatch={volumePerBatch}
                  scaleCapacities={scaleCapacities}
                  mixerState={mixerState}
                  aggregateInMixer={aggregateInMixerRef.current}
                  semenInMixer={semenInMixerRef.current}
                  waterInMixer={waterInMixerRef.current}
                  compressorActive={compressorActive}
                  vibratorActive={vibratorActive}
                  klaksonActive={klaksonActive}
                  admixInActive={admixInActive}
                  admixOutActive={admixOutActive}
                  onManualDeviceToggle={handleManualDeviceToggle}
                  batchingMode={batchingMode}
                />
              </div>

              {/* LOG AKTIVITAS HMI (Statically placed side-by-side with no overlap) */}
              <div className="w-full lg:w-[360px] h-[255px] lg:h-auto lg:mb-16 bg-[#070b13]/95 border border-slate-800 rounded-lg p-3 flex flex-col gap-2 shadow-2xl text-white select-none font-mono text-left shrink-0">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block shrink-0 animate-pulse" />
                    <span className="text-[10px] font-black tracking-widest text-[#00ff9c] uppercase">
                      LOG AKTIVITAS HMI
                    </span>
                  </div>
                  <span className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-widest">REALTIME</span>
                </div>

                {/* Log Feed */}
                <div className="flex-1 overflow-y-auto pr-0.5 space-y-1.5 scrollbar-thin text-[10.5px] uppercase">
                  {relayLogs.length === 0 ? (
                    <div className="text-slate-600 italic text-center pt-12 font-bold tracking-widest text-[9.5px]">HMI MONITOR STANDBY</div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {[...relayLogs]
                        .filter((log) => log && typeof log === 'object' && typeof log.message === 'string')
                        .slice(0, 50)
                        .map((log) => {
                          const isOff = log.type === 'off' || log.message.endsWith('off') || log.message.toLowerCase().endsWith('off)');
                          const isDone = log.type === 'done' || log.message === 'produksi selesai' || log.message.toLowerCase().includes('selesai');
                          const isColors = !isOff && !isDone && (log.type === 'on' || log.message.endsWith('on') || log.message.toLowerCase().endsWith('on)') || log.message.startsWith('dump') || log.message.includes(' on') || log.message.toLowerCase().includes('on)'));
                          
                          let itemStyle = "border-b border-slate-900/40 pb-1 flex justify-between items-center px-1 hover:bg-slate-950/40 transition-colors gap-2";
                          let textStyle = "text-slate-350 font-bold truncate flex-1 text-[10.5px] leading-tight";
                          
                          if (isDone) {
                            itemStyle = "border border-cyan-500/20 py-1 bg-cyan-950/20 my-0.5 font-sans flex flex-col items-center justify-center gap-0.5 shadow-[0_0_8px_rgba(6,182,212,0.1)] rounded";
                            textStyle = "text-cyan-400 font-black text-[11px] tracking-wider uppercase leading-none";
                          } else if (isColors) {
                            textStyle = "text-emerald-400 font-bold tracking-tight flex-1 truncate text-[10.5px] leading-tight";
                          } else if (isOff) {
                            textStyle = "text-red-500 font-bold tracking-tight flex-1 truncate text-[10.5px] leading-tight";
                          }
                          
                          const logTime = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
                          const timeString = logTime.toLocaleTimeString('id-ID', { hour12: false }).replace(/:/g, '.');

                          if (isDone) {
                            return (
                              <div key={log.id} className={itemStyle}>
                                <span className={textStyle}>{log.message}</span>
                                <span className="text-[8.5px] text-cyan-500/60 font-black uppercase tracking-wider">
                                  {timeString}
                                </span>
                              </div>
                            );
                          }
                          
                          return (
                            <div key={log.id} className={itemStyle}>
                              <span className={textStyle} title={log.message}>{log.message}</span>
                              <span className="text-[8.5px] text-slate-500 font-bold shrink-0">
                                {timeString}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: MIXING GAUGES AND PLC CONTROL PANEL BUTTON BOARD */}
          <div className="flex flex-col gap-3 min-h-0 overflow-y-auto scrollbar-thin pr-1 pb-4">
            {/* Deleted Estimasi Slump as requested by user */}

            {/* CARD MANUAL PRODUCTION DETECTION SETTINGS */}
            <div className="bg-[#0b1329] border border-slate-800 rounded-[5px] p-2.5 flex flex-col gap-1.5 overflow-hidden relative shadow-md shrink-0">
              <div className="flex justify-between items-center border-b border-slate-800 pb-1 shrink-0 select-none">
                <span className="text-[8px] font-sans font-black tracking-widest text-[#fbbf24] uppercase flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${!isAuto ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'}`} />
                  MANUAL PRODUCTION DETECTION
                </span>
                <span className={`text-[6.5px] font-sans font-black px-1 py-0.5 rounded leading-none ${!isAuto ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-900 text-slate-500'}`}>
                  {!isAuto ? 'MANUAL LOG ACTIVE' : 'AUTO MODE'}
                </span>
              </div>
              
              <div className="flex flex-col gap-1.5 space-y-1.5 pt-0.5 text-[8px] font-sans font-medium">
                {/* Minimum Mixer Gate Open Time */}
                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between text-slate-400">
                    <span>MIN MIXER GATE OPEN TIME</span>
                    <span className="text-amber-400 font-black font-mono">{minMixerGateOpenTime} DETIK</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setMinMixerGateOpenTime(p => Math.max(1, p - 1))}
                      disabled={isRunning}
                      className="w-4 h-4 bg-slate-800 rounded flex items-center justify-center text-[9px] font-extrabold hover:bg-slate-700 disabled:opacity-45 text-white cursor-pointer py-0 px-0 pt-0 pb-0"
                    >-</button>
                    <input 
                      type="range" min="1" max="30" step="1"
                      value={minMixerGateOpenTime} 
                      onChange={(e) => setMinMixerGateOpenTime(parseInt(e.target.value, 10))}
                      disabled={isRunning}
                      className="flex-1 accent-amber-400 h-0.5 bg-slate-900 rounded-lg appearance-none cursor-pointer disabled:opacity-45"
                    />
                    <button 
                      onClick={() => setMinMixerGateOpenTime(p => Math.min(30, p + 1))}
                      disabled={isRunning}
                      className="w-4 h-4 bg-slate-800 rounded flex items-center justify-center text-[9px] font-extrabold hover:bg-slate-700 disabled:opacity-45 text-white cursor-pointer py-0 px-0 pt-0 pb-0"
                    >+</button>
                  </div>
                  <p className="text-[7.5px] text-slate-500 font-sans italic pt-0.5 leading-normal">
                    * Untuk mendaftarkan siklus completedBatch secara otomatis dalam Mode Manual.
                  </p>
                </div>
              </div>
            </div>

            {/* INDUSTRIAL PLC PANEL COHESIVE BUTTON GRID */}
            <div className="bg-[#0b1329] border border-slate-800 rounded-[5px] p-2.5 flex flex-col gap-2.5 shadow-xl flex-1 relative overflow-hidden min-h-[300px]">
              {/* Robust Industrial Alignment for Bottom Control Buttons */}
              <div className="flex flex-col gap-1 shrink-0 select-none">
                
                {/* START & STOP ROW - GLOSSY 3D SPHERICAL BUTTON CONTROL INTERFACE */}
                <div className="flex justify-around items-center py-1.5 shrink-0 select-none">
                  {/* START / PAUSE / LANJUT SPHERICAL BUTTON */}
                  <div className="flex flex-col items-center gap-1">
                    <button 
                      onClick={handleStartPauseClick}
                      className={`w-[66px] h-[66px] rounded-full flex flex-col items-center justify-center relative overflow-hidden select-none cursor-pointer transition-all duration-150 border active:scale-95 text-center
                        ${!isRunning 
                          ? 'bg-gradient-to-b from-emerald-400 via-emerald-600 to-emerald-950 border-emerald-400/30 shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),_inset_0_-4px_6px_rgba(0,0,0,0.65),_0_5px_10px_rgba(16,185,129,0.3)] hover:shadow-[inset_0_4px_6px_rgba(255,255,255,0.6),_inset_0_-4px_6px_rgba(0,0,0,0.7),_0_7px_14px_rgba(16,185,129,0.45)]'
                          : isPaused
                          ? 'bg-gradient-to-b from-teal-400 via-emerald-500 to-emerald-900 border-teal-450 shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),_inset_0_-4px_6px_rgba(0,0,0,0.65),_0_5px_10px_rgba(16,185,129,0.3)]'
                          : 'bg-gradient-to-b from-amber-400 via-amber-600 to-amber-950 border-amber-400/30 shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),_inset_0_-4px_6px_rgba(0,0,0,0.65),_0_5px_10px_rgba(245,158,11,0.3)] hover:shadow-[inset_0_4px_6px_rgba(255,255,255,0.6),_inset_0_-4px_6px_rgba(0,0,0,0.7),_0_7px_14px_rgba(245,158,11,0.45)]'
                        }
                      `}
                    >
                      {/* Top Spherical Gloss reflection overlay */}
                      <div className="absolute top-[2.5px] left-[10%] right-[10%] h-[35%] bg-gradient-to-b from-white/70 via-white/10 to-transparent rounded-t-full opacity-90 pointer-events-none filter blur-[0.2px]" />
                      
                      {/* Bottom Light Bounce reflection */}
                      <div className={`absolute bottom-[3px] left-[50%] -translate-x-1/2 w-[60%] h-[15%] bg-gradient-to-t to-transparent rounded-b-full pointer-events-none ${isPaused || !isRunning ? 'from-emerald-300/25' : 'from-amber-300/25'}`} />

                      {/* Micro Glint spark bullet */}
                      <div className="absolute bottom-[9px] right-[20%] w-1.5 h-1.5 bg-white rounded-full opacity-40 pointer-events-none filter blur-[0.4px]" />
                      
                      {/* Inner strong HMI uppercase typography dropshadow lettering */}
                      <span className="text-[10.5px] font-sans font-black tracking-widest text-white leading-none uppercase select-none z-10 drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]">
                        {!isRunning ? 'START' : isPaused ? 'LANJUT' : 'PAUSE'}
                      </span>
                    </button>
                    <span className="text-[6.5px] font-mono text-slate-500 font-bold uppercase tracking-wider">
                      {!isRunning ? 'MULAI' : isPaused ? 'LANJUTKAN' : 'JEDA'}
                    </span>
                  </div>

                  {/* STOP SPHERICAL BUTTON */}
                  <div className="flex flex-col items-center gap-1">
                    <button 
                      onClick={stopBatch}
                      disabled={!isRunning}
                      className={`w-[66px] h-[66px] rounded-full flex flex-col items-center justify-center relative overflow-hidden select-none transition-all duration-150 border active:scale-95 text-center
                        ${isRunning 
                          ? 'bg-gradient-to-b from-red-400 via-red-650 to-red-955 border-red-400/30 cursor-pointer shadow-[inset_0_4px_6px_rgba(255,255,255,0.5),_inset_0_-4px_6px_rgba(0,0,0,0.65),_0_5px_10px_rgba(239,68,68,0.35)] hover:shadow-[inset_0_4px_6px_rgba(255,255,255,0.6),_inset_0_-4px_6px_rgba(0,0,0,0.7),_0_7px_14px_rgba(239,68,68,0.5)]'
                          : 'bg-gradient-to-b from-slate-900/40 via-red-955/15 to-slate-950/45 border-slate-800 opacity-40 cursor-not-allowed shadow-[inset_0_3px_5px_rgba(0,0,0,0.8)]'
                        }
                      `}
                    >
                      {/* Top Spherical Gloss reflection overlay */}
                      {isRunning && (
                        <>
                          <div className="absolute top-[2.5px] left-[10%] right-[10%] h-[35%] bg-gradient-to-b from-white/70 via-white/10 to-transparent rounded-t-full opacity-90 pointer-events-none filter blur-[0.2px]" />
                          <div className="absolute bottom-[3px] left-[50%] -translate-x-1/2 w-[60%] h-[15%] bg-gradient-to-t from-red-300/25 to-transparent rounded-b-full pointer-events-none" />
                          <div className="absolute bottom-[9px] right-[20%] w-1.5 h-1.5 bg-white rounded-full opacity-40 pointer-events-none filter blur-[0.4px]" />
                        </>
                      )}
                      
                      {/* Inner strong HMI uppercase typography dropshadow lettering */}
                      <span className={`text-[10.5px] font-sans font-black tracking-widest leading-none uppercase select-none z-10 ${isRunning ? 'text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]' : 'text-slate-600'}`}>
                        STOP
                      </span>
                    </button>
                    <span className="text-[6.5px] font-mono text-slate-500 font-bold uppercase tracking-wider">BERHENTI</span>
                  </div>
                </div>

                {/* BATCHING PLANT MODE SELECTOR (MANUAL | SEMI AUTO | AUTO) */}
                <div className="flex flex-col gap-1.5 shrink-0 w-full px-2">
                  <span className="text-[8px] font-mono text-slate-400 font-black uppercase tracking-wider text-center">MODE BATCHING CONTROL</span>
                  <div className="bg-[#080d19] p-1.5 rounded-[8px] border-2 border-slate-800 flex items-center justify-center gap-2.5 w-full max-w-[360px] mx-auto shadow-2xl">
                    <button
                      onClick={() => {
                        setBatchingMode('MANUAL');
                        dotNetBackendService.setMode('MANUAL').catch(() => {});
                      }}
                      className={`flex-1 py-5 px-3 text-[11px] font-sans font-black tracking-wider uppercase transition-all rounded-[6px] cursor-pointer text-center leading-none ${
                        batchingMode === 'MANUAL'
                          ? "bg-slate-700 text-white border-b-4 border-slate-900 shadow-inner font-black"
                          : "bg-slate-950/40 text-slate-500 hover:text-slate-300 border border-transparent"
                      }`}
                    >
                      MANUAL
                    </button>
                    <button
                      onClick={() => {
                        setBatchingMode('SEMI_AUTO');
                        dotNetBackendService.setMode('SEMI_AUTO').catch(() => {});
                      }}
                      className={`flex-1 py-5 px-3 text-[11px] font-sans font-black tracking-wider uppercase transition-all rounded-[6px] cursor-pointer text-center leading-none ${
                        batchingMode === 'SEMI_AUTO'
                          ? "bg-amber-600 text-white border-b-4 border-amber-805 shadow-inner font-black"
                          : "bg-slate-950/40 text-slate-500 hover:text-slate-300 border border-transparent"
                      }`}
                    >
                      SEMI
                    </button>
                    <button
                      onClick={() => {
                        setBatchingMode('AUTO');
                        dotNetBackendService.setMode('AUTO').catch(() => {});
                      }}
                      className={`flex-1 py-5 px-3 text-[11px] font-sans font-black tracking-wider uppercase transition-all rounded-[6px] cursor-pointer text-center leading-none ${
                        batchingMode === 'AUTO'
                          ? "bg-emerald-600 text-white border-b-4 border-emerald-805 shadow-inner font-black"
                          : "bg-slate-950/40 text-slate-500 hover:text-slate-300 border border-transparent"
                      }`}
                    >
                      AUTO
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>

      {activePrintLog && <PrintTicketModal log={activePrintLog} onClose={() => setActivePrintLog(null)} />}

      {/* Hidden File Input for Truck Image Upload */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleTruckImageUpload} 
        accept="image/*" 
        className="hidden" 
      />
    </div>
  );
}
