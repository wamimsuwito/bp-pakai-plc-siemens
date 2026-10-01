import React, { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { DashboardCards } from "./DashboardCards";
import { ChartPanel } from "./ChartPanel";
import { SystemStatus } from "./SystemStatus";
import { RelayConfigView } from "./relay-config/RelayConfigView";
import { MixingSequenceConfig, MixingSequence } from "./MixingSequenceConfig";
import { SettingComPort } from "./SettingComPort";
import { JogingMaterial } from "./JogingMaterial";
import { SlumpCalibration } from "./SlumpCalibration";
import { JobMixFormula } from "./JobMixFormula";
import { UserManagement } from "./UserManagement";
import { DatabaseProduksi } from "./DatabaseProduksi";
import { PrintTiket } from "./PrintTiket";
import { RemoteTablet } from "./RemoteTablet";
import { DirectorDashboard } from "../director/DirectorDashboard";
import { TanpaOperator } from "./TanpaOperator";
import { getSyncStats, savePlantIdentity, getPlantIdentity, queueForCloudSync } from "../../lib/syncService";
import {
  BookOpen,
  Layout,
  Settings,
  Cpu,
  Tv,
  Users2,
  AlertOctagon,
  FileCheck,
  Zap,
  Clock,
  Wrench,
  Compass,
  Database,
  Globe,
  Cloud,
  Laptop,
  Building2
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
}

interface FlowControlSetting {
  gateOnTime: number;
  gateOffTime: number;
}

type FlowControlGatesConfig = Record<'pasir1' | 'pasir2' | 'batu1' | 'batu2', FlowControlSetting>;

interface AdminDashboardProps {
  onLogout: () => void;
  logs: BatchLog[];
  mixingSequence: MixingSequence;
  setMixingSequence: React.Dispatch<React.SetStateAction<MixingSequence>>;
  activePins?: Record<string, boolean>;
  batchingPlantMode?: 'SYSTEM_1' | 'SYSTEM_2' | 'SYSTEM_3';
  setBatchingPlantMode?: (mode: 'SYSTEM_1' | 'SYSTEM_2' | 'SYSTEM_3') => void;
  flowControlGates?: FlowControlGatesConfig;
  setFlowControlGates?: (config: FlowControlGatesConfig) => void;
  waitingHopperEnabled?: boolean;
  setWaitingHopperEnabled?: (enabled: boolean) => void;
  waitingHopperPulseOn?: number;
  setWaitingHopperPulseOn?: React.Dispatch<React.SetStateAction<number>>;
  waitingHopperPulseOff?: number;
  setWaitingHopperPulseOff?: React.Dispatch<React.SetStateAction<number>>;
  waitingHopperWaterDelay?: number;
  setWaitingHopperWaterDelay?: React.Dispatch<React.SetStateAction<number>>;
  waitingHopperWaterPrecharge?: number;
  setWaitingHopperWaterPrecharge?: React.Dispatch<React.SetStateAction<number>>;
  operationMode?: 'SIMULASI' | 'PRODUKSI';
  setOperationMode?: (mode: 'SIMULASI' | 'PRODUKSI') => void;
  scaleCapacities?: { pasir: number; batu: number; semen: number; air: number; mixerGeometris?: number; mixerMaxMixing?: number };
  setScaleCapacities?: React.Dispatch<React.SetStateAction<any>>;
  companyName: string;
  setCompanyName: (name: string) => void;
  companyTagline: string;
  setCompanyTagline: (tagline: string) => void;
  companyLogo: string;
  setCompanyLogo: (logo: string) => void;
  jumlahSilo?: number;
  setJumlahSilo?: (num: number) => void;
  tanpaOperator?: boolean;
  setTanpaOperator?: (val: boolean) => void;
  truckPresenceRequired?: boolean;
  setTruckPresenceRequired?: (val: boolean) => void;
  driverDischargeRequired?: boolean;
  setDriverDischargeRequired?: (val: boolean) => void;
  minAirPressure?: number;
  setMinAirPressure?: (val: number) => void;
  pressureLimitEnabled?: boolean;
  setPressureLimitEnabled?: (val: boolean) => void;
  isTruckPresent?: boolean;
  setIsTruckPresent?: React.Dispatch<React.SetStateAction<boolean>>;
  driverBtnPressed?: boolean;
  setDriverBtnPressed?: React.Dispatch<React.SetStateAction<boolean>>;
  airPressure?: number;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onLogout,
  logs,
  mixingSequence,
  setMixingSequence,
  activePins,
  batchingPlantMode = 'SYSTEM_1',
  setBatchingPlantMode,
  flowControlGates,
  setFlowControlGates,
  waitingHopperEnabled = false,
  setWaitingHopperEnabled,
  waitingHopperPulseOn = 1.5,
  setWaitingHopperPulseOn,
  waitingHopperPulseOff = 1.5,
  setWaitingHopperPulseOff,
  waitingHopperWaterDelay = 3,
  setWaitingHopperWaterDelay,
  waitingHopperWaterPrecharge = 40,
  setWaitingHopperWaterPrecharge,
  operationMode = 'SIMULASI',
  setOperationMode,
  scaleCapacities,
  setScaleCapacities,
  companyName,
  setCompanyName,
  companyTagline,
  setCompanyTagline,
  companyLogo,
  setCompanyLogo,
  jumlahSilo = 6,
  setJumlahSilo,
  tanpaOperator = false,
  setTanpaOperator,
  truckPresenceRequired = false,
  setTruckPresenceRequired,
  driverDischargeRequired = false,
  setDriverDischargeRequired,
  minAirPressure = 80.0,
  setMinAirPressure,
  pressureLimitEnabled = false,
  setPressureLimitEnabled,
  isTruckPresent = false,
  setIsTruckPresent,
  driverBtnPressed = false,
  setDriverBtnPressed,
  airPressure = 0.0
}) => {
  const [activeMenu, setActiveMenu] = useState(() => {
    const saved = localStorage.getItem("batching_plant_active_user");
    if (saved) {
      try {
        const u = JSON.parse(saved);
        if (u.jabatan?.toUpperCase() === "DIREKTUR") {
          return "Dashboard Direktur";
        }
      } catch (err) {}
    }
    return "Dashboard";
  });
  const [settingTab, setSettingTab] = useState<'system' | 'capacity'>('system');

  // Local plant identity form states linked to syncService
  const [plantIdState, setPlantIdState] = useState(() => localStorage.getItem("plant_id") || "PKU01");
  const [plantNameState, setPlantNameState] = useState(() => localStorage.getItem("plant_name") || "Pekanbaru");
  const [plantCompanyState, setPlantCompanyState] = useState(() => localStorage.getItem("plant_company") || "PT Farika Riau Perkasa");
  const [plantAddressState, setPlantAddressState] = useState(() => localStorage.getItem("plant_address") || "");
  const [isSyncingSimulated, setIsSyncingSimulated] = useState(false);
  const [syncHistoryLogs, setSyncHistoryLogs] = useState<string[]>(() => {
    return [
      `[${new Date().toLocaleTimeString()}] SISTEM INS-INITIALIZED. Menunggu sinkronisasi data pertama.`,
      `[${new Date().toLocaleTimeString()}] DATABASE LOKAL AKTIF: Mengantre data offline.`
    ];
  });

  const [currentUser, setCurrentUser] = useState<any>(() => {
    const saved = localStorage.getItem("batching_plant_active_user");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (err) {}
    }
    return { nama: "Administrator", nik: "12001", jabatan: "Admin" };
  });

  // Keep state sync in case user is updated inside user management
  useEffect(() => {
    const handleSync = () => {
      const saved = localStorage.getItem("batching_plant_active_user");
      if (saved) {
        try {
          setCurrentUser(JSON.parse(saved));
        } catch (err) {}
      }
    };
    window.addEventListener("active_user_session_sync", handleSync);
    window.addEventListener("user_database_updated", handleSync);
    return () => {
      window.removeEventListener("active_user_session_sync", handleSync);
      window.removeEventListener("user_database_updated", handleSync);
    };
  }, []);

  const RESTRICTED_ADMIN_MENUS = [
    "Manajemen User",
    "Setting Com dan Port",
    "Pengaturan Relay & Pintu Mixer",
    "Urutan Mixing",
    "Penamaan BP",
    "Pengaturan Perusahaan",
    "Kalibrasi Slump",
    "Pengaturan Plant",
    "Tanpa Operator"
  ];

  // Helper to render Access Denied SCADA block
  const renderAccessDenied = (menuName: string) => {
    return (
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="bg-[#150a0f]/90 border-2 border-rose-500/50 rounded-[6px] p-6 flex flex-col items-center justify-center text-center overflow-hidden max-w-md w-full shadow-[0_0_25px_rgba(239,68,68,0.2)] relative">
          {/* Neon border strip */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-pink-600 to-rose-500" />
          
          <div className="p-4 bg-rose-950/40 border border-rose-500/30 rounded-full text-rose-500 animate-pulse mb-4">
            <AlertOctagon size={32} />
          </div>

          <h4 className="text-xs font-sans font-black tracking-widest text-[#ef4444] uppercase">
            AKSES DITOLAK: PRIVILEGE ADMIN DIBUTUHKAN
          </h4>
          <span className="text-[8px] font-mono font-bold text-rose-300 bg-rose-950 border border-rose-800/40 px-2 py-0.5 mt-2 rounded uppercase tracking-wider">
            Otoritas Terbatas [ Operator ]
          </span>

          <div className="mt-5 p-3.5 bg-slate-950/95 border border-slate-900 rounded-md text-left w-full space-y-2.5">
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-slate-500 uppercase">Nama:</span>
              <span className="text-slate-200 font-bold uppercase">{currentUser?.nama || "Unknown User"}</span>
            </div>
            <div className="flex justify-between text-[10px] font-mono border-t border-slate-900 pt-2">
              <span className="text-slate-500 uppercase">NIK Karyawan:</span>
              <span className="text-cyan-400 font-bold">{currentUser?.nik || "12000"}</span>
            </div>
            <div className="flex justify-between text-[10px] font-mono border-t border-slate-900 pt-2">
              <span className="text-slate-500 uppercase">Status Role:</span>
              <span className="text-[#ef4444] font-extrabold uppercase">{currentUser?.jabatan || "Operator"}</span>
            </div>
          </div>

          <p className="text-[9.5px] font-mono text-slate-400 uppercase leading-relaxed mt-5">
            Akun Operator Anda dibatasi dan tidak diizinkan membuka menu "{menuName}". Setelan sensitif mesin PLC hanya dapat dimodifikasi oleh Administrator Utama.
          </p>
        </div>
      </div>
    );
  };

  // Calculate live statistics based on real HMI batch logs if any exist
  const totalBatch = logs.length;
  const totalVolume = logs.reduce((acc, curr) => acc + curr.volume, 0);

  // Helper for role based access validation
  const hasMenuAccess = (role: string, menuName: string): boolean => {
    const isUAdmin = role === "Admin" || role === "ADMIN";
    if (isUAdmin) return true; // ADMIN gets 100% full access

    if (role === "DIREKTUR") {
      return [
        "Dashboard Direktur", 
        "Monitoring Plant", 
        "Database Produksi", 
        "Monitoring Stok", 
        "Monitoring Armada", 
        "Alert Center"
      ].includes(menuName);
    }
    if (role === "SUPERVISOR") {
      return ["Dashboard", "Database Produksi", "Print Tiket", "Pengaturan Alert"].includes(menuName);
    }
    if (role === "LOGISTIK") {
      return ["Dashboard", "Database Produksi", "Setting", "Joging Material"].includes(menuName);
    }
    if (role === "OPERATOR" || role === "Operator") {
      return !RESTRICTED_ADMIN_MENUS.includes(menuName);
    }
    return false; // Restrict by default
  };

  // Helper to render dynamic view based on sidebar selection
  const renderContent = () => {
    // Check access restriction
    const uRole = currentUser?.jabatan || "Operator";
    if (!hasMenuAccess(uRole, activeMenu)) {
      return renderAccessDenied(activeMenu);
    }

    switch (activeMenu) {
      case "Tanpa Operator":
        return (
          <TanpaOperator
            tanpaOperator={tanpaOperator}
            setTanpaOperator={setTanpaOperator || (() => {})}
            truckPresenceRequired={truckPresenceRequired}
            setTruckPresenceRequired={setTruckPresenceRequired || (() => {})}
            driverDischargeRequired={driverDischargeRequired}
            setDriverDischargeRequired={setDriverDischargeRequired || (() => {})}
            minAirPressure={minAirPressure}
            setMinAirPressure={setMinAirPressure || (() => {})}
            pressureLimitEnabled={pressureLimitEnabled}
            setPressureLimitEnabled={setPressureLimitEnabled || (() => {})}
            isTruckPresent={isTruckPresent}
            setIsTruckPresent={setIsTruckPresent || (() => {})}
            driverBtnPressed={driverBtnPressed}
            setDriverBtnPressed={setDriverBtnPressed || (() => {})}
            airPressure={airPressure}
            operationMode={operationMode}
          />
        );

      case "Dashboard Direktur":
        return <DirectorDashboard logs={logs} defaultTab="dashboard" />;

      case "Monitoring Plant":
        return <DirectorDashboard logs={logs} defaultTab="plants" />;

      case "Monitoring Stok":
        return <DirectorDashboard logs={logs} defaultTab="inventory" />;

      case "Monitoring Armada":
        return <DirectorDashboard logs={logs} defaultTab="fleets" />;

      case "Alert Center":
        return <DirectorDashboard logs={logs} defaultTab="alarms" />;

      case "Dashboard":
        return (
          <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-hidden">
            {/* Top Stat Level Cards */}
            <DashboardCards
              totalBatch={totalBatch}
              totalVolume={totalVolume}
              totalCustomer={totalBatch > 0 ? 1 : 0}
              isSystemOnline={true}
            />

            {/* Middle Graphs/Chart row */}
            <ChartPanel logs={logs} />

            {/* Bottom Status panel */}
            <SystemStatus username={currentUser?.nama || "Guest Operator"} role={currentUser?.jabatan || "Operator"} />
          </div>
        );

      case "Penamaan BP":
        return (
          <div className="flex-1 bg-[#0b1329]/80 border border-[#1e293b]/70 rounded-[6px] p-6 flex flex-col justify-between overflow-hidden">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 text-[#00e5ff]">
                <Settings size={20} className="animate-spin" />
                <h4 className="text-sm font-sans font-black tracking-widest uppercase">
                  PENGATURAN PENAMAAN BATCHING PLANT
                </h4>
              </div>
              <p className="text-[10px] font-mono text-slate-405 uppercase">
                Ubah identitas system HMI dan Header yang ditayangkan pada Monitor Utama.
              </p>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-sans font-bold text-slate-400 uppercase">Nama Perusahaan</span>
                  <input
                    type="text"
                    defaultValue="PT. FARIKA RIAU PERKASA"
                    disabled
                    className="bg-[#05080e] border border-slate-800 text-slate-300 p-2.5 rounded-[4px] text-xs font-mono font-bold cursor-not-allowed uppercase"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-sans font-bold text-slate-400 uppercase">Nama Batching Plant</span>
                  <input
                    type="text"
                    defaultValue="BATCHING PLANT BP-01 PKU"
                    disabled
                    className="bg-[#05080e] border border-slate-800 text-slate-300 p-2.5 rounded-[4px] text-xs font-mono font-bold cursor-not-allowed uppercase"
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#1e1e10]/30 border-2 border-amber-500/30 rounded-[4px] p-3 flex items-start gap-2.5">
              <AlertOctagon size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="flex flex-col text-left">
                <span className="text-[9.5px] font-sans font-black text-amber-500 uppercase">HARDWARE INTERLOCK ACTIVE</span>
                <span className="text-[8.5px] font-mono text-slate-400 uppercase mt-1 leading-relaxed">
                  Konfigurasi penamaan terkunci oleh PLC hardware key. Hubungi vendor teknisi lapang untuk membuka gembok.
                </span>
              </div>
            </div>
          </div>
        );

      case "Job Mix Formula":
        return (
          <JobMixFormula />
        );

      case "Manajemen User":
        return (
          <UserManagement />
        );

      case "Urutan Mixing":
        return (
          <MixingSequenceConfig
            mixingSequence={mixingSequence}
            setMixingSequence={setMixingSequence}
          />
        );

      case "Pengaturan Relay & Pintu Mixer":
        return <RelayConfigView activePins={activePins} />;

      case "Setting Com dan Port":
        return (
          <SettingComPort />
        );

      case "Joging Material":
        return (
          <JogingMaterial />
        );

      case "Setting":
        return (
          <div className="flex-1 bg-[#0b1329]/85 border border-[#1e293b]/80 rounded-[6px] p-6 flex flex-col justify-between overflow-y-auto scrollbar-thin">
            <div className="space-y-6">
              {/* Header Title with Tab Switcher */}
              <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3 flex-wrap">
                <div className="flex items-center gap-2.5 text-[#00ffd0]">
                  <Settings size={20} className="animate-pulse" />
                  <h4 className="text-sm font-sans font-black tracking-widest uppercase">
                    {settingTab === 'system' ? "PENGATURAN TIPE SISTEM BATCHING PLANT" : "PENGATURAN KAPASITAS TIMBANGAN"}
                  </h4>
                </div>
                
                {/* Visual Tab Switcher */}
                <div className="flex bg-[#05080e] p-1 border border-slate-800 rounded">
                  <button
                    onClick={() => setSettingTab('system')}
                    className={`text-[9.5px] font-mono font-black uppercase px-2.5 py-1 rounded transition-all cursor-pointer ${
                      settingTab === 'system'
                        ? 'bg-[#00ffd0]/10 border border-[#00ffd0]/30 text-[#00ffd0] font-extrabold shadow-[0_0_8px_rgba(0,255,208,0.1)]'
                        : 'bg-transparent text-slate-500 hover:text-slate-300 font-bold'
                    }`}
                  >
                    Tipe Sistem & Hopper
                  </button>
                  <button
                    onClick={() => setSettingTab('capacity')}
                    className={`text-[9.5px] font-mono font-black uppercase px-2.5 py-1 rounded transition-all cursor-pointer flex items-center gap-1 ${
                      settingTab === 'capacity'
                        ? 'bg-[#00ffd0]/10 border border-[#00ffd0]/30 text-[#00ffd0] font-extrabold shadow-[0_0_8px_rgba(0,255,208,0.1)]'
                        : 'bg-transparent text-slate-500 hover:text-slate-300 font-bold'
                    }`}
                  >
                    Kapasitas Timbangan
                  </button>
                </div>
              </div>

              {settingTab === 'system' ? (
                <>
                  <p className="text-[10px] font-mono text-slate-400 uppercase leading-relaxed max-w-2xl">
                    Konfigurasi ini menentukan diagram SCADA, jalur pipa timbangan, rute konveyor, sensor loadcell sisa berat material, serta logika penimbangan aggregate paralel/serial dan kendali pulse flow gate.
                  </p>

              {/* System Selector Card */}
              <div className="bg-[#060a12]/80 border border-slate-800/80 rounded-[5px] p-4 space-y-4">
                <div className="flex flex-col gap-1.5 max-w-md">
                  <label className="text-[9.5px] font-sans font-black text-cyan-400 uppercase">
                    PILIH TIPE ARSITEKTUR WEIGHING:
                  </label>
                  <select
                    value={batchingPlantMode}
                    onChange={(e) => {
                      const modeVal = e.target.value as 'SYSTEM_1' | 'SYSTEM_2' | 'SYSTEM_3';
                      setBatchingPlantMode?.(modeVal);
                    }}
                    className="bg-[#0a0f18] border border-cyan-800/60 hover:border-cyan-400 text-slate-200 p-2 rounded-[4px] text-xs font-mono font-bold uppercase transition-colors outline-none cursor-pointer"
                  >
                    <option value="SYSTEM_1">SYSTEM 1: DUAL AGGREGATE SCALE (Terpisah / Paralel)</option>
                    <option value="SYSTEM_2">SYSTEM 2: ACCUMULATIVE AGGREGATE SCALE (1 Timbangan Tunggal / Akumulatif Serial)</option>
                    <option value="SYSTEM_3">SYSTEM 3: BIN LOADCELL LOSS-IN-WEIGHT (Sisa Berat / Pulse Flow Gate Serial)</option>
                  </select>
                </div>

                {/* Explanation block of chosen system */}
                <div className="p-3 bg-slate-900/30 border border-slate-850/55 rounded text-[10px] font-mono uppercase space-y-1.5 leading-relaxed">
                  <span className="text-[#00ffd0] font-bold">DESKRIPSI INTEGRASI SISTEM:</span>
                  {batchingPlantMode === 'SYSTEM_1' && (
                    <p className="text-slate-400">
                      Sistem Multi-Hopper konvensional. Pasir dan Batu ditimbang secara bersamaan (paralel) menggunakan 2 hopper timbangan terpisah dengan indikator pembacaan mandiri dari sensor loadcell.
                    </p>
                  )}
                  {batchingPlantMode === 'SYSTEM_2' && (
                    <p className="text-slate-400">
                      Sistem Akumulatif Tunggal. Seluruh aggregate (Pasir 1, Pasir 2, Batu 1, Batu 2) dikerjakan satu per satu secara berurutan masuk ke satu timbangan aggregate memanjang di bawah bin, berat dihitung secara kumulatif bertambah.
                    </p>
                  )}
                  {batchingPlantMode === 'SYSTEM_3' && (
                    <p className="text-slate-400">
                      Sistem Loss-In-Weight. Aggregate didefinisikan per grup (Grup Pasir & Batu). Berat material di dalam bin dibaca langsung oleh loadcell penyangga. Berat awal berkurang saat pintu gate dibuka secara berdenyut (Pulse Flow Gate ON/OFF) langsung menuju sabuk conveyor.
                    </p>
                  )}
                </div>
              </div>

              {/* Config fields for System 3 if selected */}
              {batchingPlantMode === 'SYSTEM_3' && flowControlGates && setFlowControlGates && (
                <div className="bg-[#060a12]/80 border border-cyan-900/40 rounded-[5px] p-4 space-y-4">
                  <div className="border-b border-cyan-950/70 pb-2">
                    <span className="text-[10px] font-sans font-black text-rose-400 uppercase tracking-wider block">
                      PENGATURAN PULSE FLOW GATE CONTROL (SYSTEM 3)
                    </span>
                    <span className="text-[8.5px] font-mono text-slate-500 uppercase block mt-1">
                      Durasi katup solenoid ON (membuka) dan OFF (menutup sementara) untuk mencegah overload conveyor.
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(['pasir1', 'pasir2', 'batu1', 'batu2'] as const).map((key) => {
                      const gateLabel = key === 'pasir1' ? 'GATE PASIR 1' :
                                        key === 'pasir2' ? 'GATE PASIR 2' :
                                        key === 'batu1' ? 'GATE BATU 1' : 'GATE BATU 2';
                      return (
                        <div key={key} className="p-3 bg-slate-950 rounded border border-slate-900 flex flex-col gap-2.5">
                          <span className="text-[9px] font-sans font-black text-slate-400 block border-b border-slate-900 pb-1">{gateLabel}</span>
                          
                          <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-mono text-slate-500 font-bold uppercase">Gate ON (ms)</span>
                            <input
                              type="number"
                              min="100"
                              max="15000"
                              step="50"
                              value={flowControlGates[key].gateOnTime}
                              onChange={(e) => {
                                const val = Math.max(100, parseInt(e.target.value) || 0);
                                setFlowControlGates({
                                  ...flowControlGates,
                                  [key]: {
                                    ...flowControlGates[key],
                                    gateOnTime: val
                                  }
                                });
                              }}
                              className="bg-[#05080e] border border-slate-800 hover:border-cyan-800 text-emerald-400 text-xs font-mono font-bold p-1 px-1.5 rounded outline-none"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-mono text-slate-500 font-bold uppercase">Gate OFF (ms)</span>
                            <input
                              type="number"
                              min="100"
                              max="15000"
                              step="50"
                              value={flowControlGates[key].gateOffTime}
                              onChange={(e) => {
                                const val = Math.max(100, parseInt(e.target.value) || 0);
                                setFlowControlGates({
                                  ...flowControlGates,
                                  [key]: {
                                    ...flowControlGates[key],
                                    gateOffTime: val
                                  }
                                });
                              }}
                              className="bg-[#05080e] border border-slate-800 hover:border-cyan-800 text-rose-400 text-xs font-mono font-bold p-1 px-1.5 rounded outline-none"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* System Waiting Hopper Settings */}
              <div className="bg-[#060a12]/80 border border-slate-800/80 rounded-[5px] p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 flex-wrap gap-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-sans font-black text-[#00ffd0] uppercase tracking-wider">
                      SISTEM WAITING HOPPER CONFIGURATION
                    </span>
                    <span className="text-[8.5px] font-mono text-slate-500 uppercase">
                      Konfigurasi penyangga aggregate sementara di atas twin-shaft mixer (Chute/Waiting Hopper).
                    </span>
                  </div>
                  <button
                    onClick={() => setWaitingHopperEnabled?.(!waitingHopperEnabled)}
                    className={`text-[9px] font-black px-3 py-1 rounded transition-all cursor-pointer select-none leading-none ${
                      waitingHopperEnabled 
                        ? 'bg-[#00ffd0] hover:bg-[#00e5ff] text-black font-mono font-black' 
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-400 font-mono font-bold'
                    }`}
                  >
                    {waitingHopperEnabled ? 'AKTIF (ENABLED)' : 'BYPASS (NORMAL)'}
                  </button>
                </div>

                {waitingHopperEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[9px] font-sans font-medium">
                    {/* Gate Pulse ON Time */}
                    <div className="p-3 bg-slate-950 rounded border border-slate-900 flex flex-col gap-2">
                      <div className="flex justify-between text-slate-400 border-b border-slate-900/50 pb-1 items-center select-none">
                        <span className="font-bold">PULSA VALVE ON</span>
                        <span className="text-[#00ffd0] font-black font-mono text-xs">{waitingHopperPulseOn}s</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setWaitingHopperPulseOn?.(p => Math.max(0.5, parseFloat((p - 0.5).toFixed(1))))}
                          className="w-5 h-5 bg-slate-800 hover:bg-slate-700 rounded flex items-center justify-center font-extrabold text-white text-xs select-none"
                        >-</button>
                        <input 
                          type="range" min="0.5" max="5" step="0.5"
                          value={waitingHopperPulseOn} 
                          onChange={(e) => setWaitingHopperPulseOn?.(parseFloat(e.target.value))}
                          className="flex-1 accent-[#00ffd0] h-1 bg-slate-900 rounded appearance-none cursor-pointer"
                        />
                        <button 
                          onClick={() => setWaitingHopperPulseOn?.(p => Math.min(5, parseFloat((p + 0.5).toFixed(1))))}
                          className="w-5 h-5 bg-slate-800 hover:bg-slate-700 rounded flex items-center justify-center font-extrabold text-white text-xs select-none"
                        >+</button>
                      </div>
                    </div>

                    {/* Gate Pulse OFF Time */}
                    <div className="p-3 bg-slate-950 rounded border border-slate-900 flex flex-col gap-2">
                      <div className="flex justify-between text-slate-400 border-b border-slate-900/50 pb-1 items-center select-none">
                        <span className="font-bold">PULSA VALVE OFF</span>
                        <span className="text-[#00ffd0] font-black font-mono text-xs">{waitingHopperPulseOff}s</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setWaitingHopperPulseOff?.(p => Math.max(0.5, parseFloat((p - 0.5).toFixed(1))))}
                          className="w-5 h-5 bg-slate-800 hover:bg-slate-700 rounded flex items-center justify-center font-extrabold text-white text-xs select-none"
                        >-</button>
                        <input 
                          type="range" min="0.5" max="5" step="0.5"
                          value={waitingHopperPulseOff} 
                          onChange={(e) => setWaitingHopperPulseOff?.(parseFloat(e.target.value))}
                          className="flex-1 accent-[#00ffd0] h-1 bg-slate-900 rounded appearance-none cursor-pointer"
                        />
                        <button 
                          onClick={() => setWaitingHopperPulseOff?.(p => Math.min(5, parseFloat((p + 0.5).toFixed(1))))}
                          className="w-5 h-5 bg-slate-800 hover:bg-slate-700 rounded flex items-center justify-center font-extrabold text-white text-xs select-none"
                        >+</button>
                      </div>
                    </div>

                    {/* Delay After Water Discharge */}
                    <div className="p-3 bg-slate-950 rounded border border-slate-900 flex flex-col gap-2">
                      <div className="flex justify-between text-slate-400 border-b border-slate-900/50 pb-1 items-center select-none">
                        <span className="font-bold">JEDA SETELAH AIR TUANG (SELESAI)</span>
                        <span className="text-[#00ffd0] font-black font-mono text-xs">{waitingHopperWaterDelay}s</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setWaitingHopperWaterDelay?.(p => Math.max(1, p - 1))}
                          className="w-5 h-5 bg-slate-800 hover:bg-slate-700 rounded flex items-center justify-center font-extrabold text-white text-xs select-none"
                        >-</button>
                        <input 
                          type="range" min="1" max="15" step="1"
                          value={waitingHopperWaterDelay} 
                          onChange={(e) => setWaitingHopperWaterDelay?.(parseInt(e.target.value))}
                          className="flex-1 accent-[#00ffd0] h-1 bg-slate-900 rounded appearance-none cursor-pointer"
                        />
                        <button 
                          onClick={() => setWaitingHopperWaterDelay?.(p => Math.min(15, p + 1))}
                          className="w-5 h-5 bg-slate-800 hover:bg-slate-700 rounded flex items-center justify-center font-extrabold text-white text-xs select-none"
                        >+</button>
                      </div>
                    </div>

                    {/* Water Precharge Percentage */}
                    <div className="p-3 bg-slate-950 rounded border border-slate-900 flex flex-col gap-2">
                      <div className="flex justify-between text-slate-400 border-b border-slate-900/50 pb-1 items-center select-none">
                        <span className="font-bold">VOLUME AIR PRECHARGE</span>
                        <span className="text-[#00ffd0] font-black font-mono text-xs">{waitingHopperWaterPrecharge}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setWaitingHopperWaterPrecharge?.(p => Math.max(10, p - 5))}
                          className="w-5 h-5 bg-slate-800 hover:bg-slate-700 rounded flex items-center justify-center font-extrabold text-white text-xs select-none"
                        >-</button>
                        <input 
                          type="range" min="10" max="100" step="5"
                          value={waitingHopperWaterPrecharge} 
                          onChange={(e) => setWaitingHopperWaterPrecharge?.(parseInt(e.target.value))}
                          className="flex-1 accent-[#00ffd0] h-1 bg-slate-900 rounded appearance-none cursor-pointer"
                        />
                        <button 
                          onClick={() => setWaitingHopperWaterPrecharge?.(p => Math.min(100, p + 5))}
                          className="w-5 h-5 bg-slate-800 hover:bg-slate-700 rounded flex items-center justify-center font-extrabold text-white text-xs select-none"
                        >+</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SENSOR LOADCELL / OPERATIONAL MODE */}
              <div className="bg-[#060a12]/80 border border-slate-800/80 rounded-[5px] p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 flex-wrap gap-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-sans font-black text-rose-400 uppercase tracking-wider">
                      MODE OPERASI SISTEM HMI
                    </span>
                    <span className="text-[8.5px] font-mono text-slate-500 uppercase">
                      PILIH SUMBER DATA VISUALISASI FILLING/LEVEL TIMBAGAN (LOADCELL SIMULATOR / HARDWARE NYATA).
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setOperationMode?.('SIMULASI')}
                      className={`text-[9.5px] font-black px-3 py-1 rounded transition-all cursor-pointer select-none font-mono ${
                        operationMode === 'SIMULASI'
                          ? 'bg-amber-500 hover:bg-amber-400 text-black font-black'
                          : 'bg-[#121c32] hover:bg-slate-800 text-slate-400 border border-slate-800 font-bold'
                      }`}
                    >
                      SIMULASI (SIMULATOR)
                    </button>
                    <button
                      onClick={() => setOperationMode?.('PRODUKSI')}
                      className={`text-[9.5px] font-black px-3 py-1 rounded transition-all cursor-pointer select-none font-mono ${
                        operationMode === 'PRODUKSI'
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-black font-black'
                          : 'bg-[#121c32] hover:bg-slate-800 text-slate-400 border border-slate-800 font-bold'
                      }`}
                    >
                      PRODUKSI NYATA (LOADCELL)
                    </button>
                  </div>
                </div>

                 <div className="p-3 bg-slate-900/30 border border-slate-850/55 rounded text-[10px] font-mono uppercase space-y-1.5 leading-relaxed">
                  <span className="text-cyan-400 font-bold col-span-full">DESKRIPSI SUMBER DATA OPERASIONAL:</span>
                  {operationMode === 'SIMULASI' ? (
                    <p className="text-slate-400 normal-case leading-normal mt-1">
                      Sistem berjalan menggunakan simulator berat virtual. Nilai timbangan aggregate, semen, air, dan waiting hopper dihitung secara bertahap oleh timer software. Cocok untuk demo, test, training operator, dan troubleshooting tanpa hardware.
                    </p>
                  ) : (
                    <p className="text-slate-400 normal-case leading-normal mt-1">
                      Sistem membaca berat aktual dan status level langsung dari Sensor Loadcell yang dikomunikasikan oleh modul Arduino Mega via port serial secara realtime. Animasi timbangan mengikuti pergerakan angka sensor nyata secara presisi.
                    </p>
                  )}
                </div>
              </div>

              {/* PENGATURAN JUMLAH SILO BATCHING PLANT */}
              <div id="setting-jumlah-silo" className="bg-[#060a12]/80 border border-slate-800/80 rounded-[5px] p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 flex-wrap gap-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-sans font-black text-[#00ffd0] uppercase tracking-wider">
                      KONFIGURASI JUMLAH SILO SEMEN
                    </span>
                    <span className="text-[8.5px] font-mono text-slate-500 uppercase">
                      TENTUKAN JUMLAH SILO AKTIF PADA BATCHING PLANT (1 S/D 8). SILO AKAN DISELARASKAN POSISINYA SEJAJAR DI TENGAH TIMBANGAN SEMEN (CENTER ALIGN).
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={() => setJumlahSilo?.(Math.max(1, (jumlahSilo ?? 6) - 1))}
                      className="w-6 h-6 bg-slate-800 hover:bg-slate-700 rounded flex items-center justify-center font-extrabold text-white text-sm select-none cursor-pointer"
                    >-</button>
                    
                    <span className="text-[#00ffd0] font-mono font-black text-xs px-2 w-16 text-center border border-slate-800 bg-slate-950 py-1 rounded">
                      {jumlahSilo} SILO
                    </span>
                    
                    <button 
                      type="button"
                      onClick={() => setJumlahSilo?.(Math.min(8, (jumlahSilo ?? 6) + 1))}
                      className="w-6 h-6 bg-slate-800 hover:bg-slate-700 rounded flex items-center justify-center font-extrabold text-white text-sm select-none cursor-pointer"
                    >+</button>
                  </div>
                </div>

                <div className="p-3 bg-slate-900/30 border border-slate-850/55 rounded text-[10px] font-mono uppercase space-y-1.5 leading-relaxed">
                  <span className="text-cyan-400 font-bold col-span-full">VISUALISASI AKUMULATIF SILO:</span>
                  <p className="text-slate-400 normal-case leading-normal mt-1">
                    Posisi silo semen akan diatur secara otomatis agar senantiasa simetris dan terpusat di atas timbangan semen. Jumlah pilihan silo pada form pendaftaran batch juga akan menyesuaikan dengan pengaturan ini secara dinamis.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-6">
              <p className="text-[10px] font-mono text-slate-400 uppercase leading-relaxed max-w-2xl">
                Nilai kapasitas timbangan adalah rasio absolut pembagi level visualisasi SCADA (Maximum Scale Capacity) guna memastikan penunjukan grafis sesuai spesifikasi fisik loadcell di lapangan.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Pasir */}
                <div className="p-4 bg-[#060a12]/80 border border-slate-800/80 rounded-[5px] flex flex-col justify-between gap-3 shadow-lg">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-[10px] font-sans font-black text-[#00ffd0] uppercase flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00ffd0] animate-pulse"></span>
                      1. KAPASITAS TIMBANGAN PASIR
                    </span>
                    <span className="text-[7.5px] font-mono text-slate-500 font-bold uppercase">SAND SCALE</span>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8.5px] font-mono text-slate-400 uppercase font-black block">Spesifikasi Kapasitas (kg)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        step="100"
                        value={scaleCapacities?.pasir || 1000}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 0);
                          setScaleCapacities?.(prev => ({ ...prev, pasir: val }));
                        }}
                        className="bg-[#05080e] border border-cyan-900/40 hover:border-[#00ffd0]/45 focus:border-[#00ffd0] text-cyan-405 text-xs font-mono font-extrabold p-2 px-3 pr-10 rounded outline-none w-full transition-all"
                      />
                      <span className="absolute right-3 top-2.5 text-[8.5px] font-mono text-slate-500 font-extrabold">KG</span>
                    </div>
                  </div>
                  <p className="text-[8px] font-mono text-slate-500 normal-case leading-relaxed">
                    Kapasitas ini digunakan sebagai pembagi maksimum untuk menghitung tinggi level tumpukan pasir pada diagram utama.
                  </p>
                </div>

                {/* Batu */}
                <div className="p-4 bg-[#060a12]/80 border border-slate-800/80 rounded-[5px] flex flex-col justify-between gap-3 shadow-lg">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-[10px] font-sans font-black text-amber-450 uppercase flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                      2. KAPASITAS TIMBANGAN BATU
                    </span>
                    <span className="text-[7.5px] font-mono text-slate-500 font-bold uppercase">STONE SCALE</span>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8.5px] font-mono text-slate-404 uppercase font-black block">Spesifikasi Kapasitas (kg)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        step="100"
                        value={scaleCapacities?.batu || 1000}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 0);
                          setScaleCapacities?.(prev => ({ ...prev, batu: val }));
                        }}
                        className="bg-[#05080e] border border-cyan-900/40 hover:border-[#00ffd0]/45 focus:border-[#00ffd0] text-cyan-405 text-xs font-mono font-extrabold p-2 px-3 pr-10 rounded outline-none w-full transition-all"
                      />
                      <span className="absolute right-3 top-2.5 text-[8.5px] font-mono text-slate-500 font-extrabold">KG</span>
                    </div>
                  </div>
                  <p className="text-[8px] font-mono text-slate-500 normal-case leading-relaxed">
                    Kapasitas ini digunakan sebagai pembagi maksimum untuk menghitung tinggi level tumpukan batu pada diagram utama.
                  </p>
                </div>

                {/* Semen */}
                <div className="p-4 bg-[#060a12]/80 border border-slate-800/80 rounded-[5px] flex flex-col justify-between gap-3 shadow-lg">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-[10px] font-sans font-black text-slate-300 uppercase flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse"></span>
                      3. KAPASITAS TIMBANGAN SEMEN
                    </span>
                    <span className="text-[7.5px] font-mono text-slate-500 font-bold uppercase">CEMENT SCALE</span>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8.5px] font-mono text-slate-404 uppercase font-black block">Spesifikasi Kapasitas (kg)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        step="100"
                        value={scaleCapacities?.semen || 800}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 0);
                          setScaleCapacities?.(prev => ({ ...prev, semen: val }));
                        }}
                        className="bg-[#05080e] border border-cyan-900/40 hover:border-[#00ffd0]/45 focus:border-[#00ffd0] text-cyan-405 text-xs font-mono font-extrabold p-2 px-3 pr-10 rounded outline-none w-full transition-all"
                      />
                      <span className="absolute right-3 top-2.5 text-[8.5px] font-mono text-slate-500 font-extrabold">KG</span>
                    </div>
                  </div>
                  <p className="text-[8px] font-mono text-slate-500 normal-case leading-relaxed">
                    Kapasitas ini digunakan sebagai pembagi maksimum untuk menghitung tinggi level pengisian tabung timbangan semen.
                  </p>
                </div>

                {/* Air */}
                <div className="p-4 bg-[#060a12]/80 border border-slate-800/80 rounded-[5px] flex flex-col justify-between gap-3 shadow-lg">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-[10px] font-sans font-black text-emerald-450 uppercase flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      4. KAPASITAS TIMBANGAN AIR & ADDITIVE
                    </span>
                    <span className="text-[7.5px] font-mono text-slate-500 font-bold uppercase">WATER SCALE</span>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8.5px] font-mono text-slate-404 uppercase font-black block">Spesifikasi Kapasitas (kg)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        step="10"
                        value={scaleCapacities?.air || 400}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value) || 0);
                          setScaleCapacities?.(prev => ({ ...prev, air: val }));
                        }}
                        className="bg-[#05080e] border border-cyan-900/40 hover:border-[#00ffd0]/45 focus:border-[#00ffd0] text-cyan-405 text-xs font-mono font-extrabold p-2 px-3 pr-10 rounded outline-none w-full transition-all"
                      />
                      <span className="absolute right-3 top-2.5 text-[8.5px] font-mono text-slate-500 font-extrabold">KG</span>
                    </div>
                  </div>
                  <p className="text-[8px] font-mono text-slate-500 normal-case leading-relaxed">
                    Kapasitas ini digunakan sebagai pembagi maksimum untuk menghitung tinggi level air/additive dalam tabung timbangan air.
                  </p>
                </div>

                {/* Kapasitas Geometris Mixer */}
                <div className="p-4 bg-[#060a12]/80 border border-slate-800/80 rounded-[5px] flex flex-col justify-between gap-3 shadow-lg">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-[10px] font-sans font-black text-cyan-400 uppercase flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                      5. KAPASITAS GEOMETRIS MIXER
                    </span>
                    <span className="text-[7.5px] font-mono text-slate-500 font-bold uppercase">GEOMETRIC MIXER CAPACITY</span>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8.5px] font-mono text-slate-404 uppercase font-black block">Spesifikasi Kapasitas (m³)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0.1"
                        max="10.0"
                        step="0.1"
                        value={scaleCapacities?.mixerGeometris || 4.0}
                        onChange={(e) => {
                          const val = Math.max(0.1, parseFloat(e.target.value) || 0);
                          setScaleCapacities?.(prev => ({ ...prev, mixerGeometris: val }));
                        }}
                        className="bg-[#05080e] border border-cyan-900/40 hover:border-[#00ffd0]/45 focus:border-[#00ffd0] text-[#00ffd0] text-xs font-mono font-extrabold p-2 px-3 pr-10 rounded outline-none w-full transition-all"
                      />
                      <span className="absolute right-3 top-2.5 text-[8.5px] font-mono text-slate-500 font-extrabold">M³</span>
                    </div>
                  </div>
                  <p className="text-[8px] font-mono text-slate-500 normal-case leading-relaxed">
                    Volume kontainer fisik/geometric keseluruhan untuk ruang internal Twin Shaft Mixer (Default: 4.0 m³).
                  </p>
                </div>

                {/* Kapasitas Maksimum Mixing */}
                <div className="p-4 bg-[#060a12]/80 border border-slate-800/80 rounded-[5px] flex flex-col justify-between gap-3 shadow-lg">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-[10px] font-sans font-black text-indigo-400 uppercase flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                      6. KAPASITAS MAKSIMUM MIXING
                    </span>
                    <span className="text-[7.5px] font-mono text-slate-500 font-bold uppercase">MAX MIXING CAPACITY</span>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8.5px] font-mono text-slate-404 uppercase font-black block">Spesifikasi Kapasitas (m³)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0.1"
                        max="10.0"
                        step="0.1"
                        value={scaleCapacities?.mixerMaxMixing || 3.5}
                        onChange={(e) => {
                          const val = Math.max(0.1, parseFloat(e.target.value) || 0);
                          setScaleCapacities?.(prev => ({ ...prev, mixerMaxMixing: val }));
                        }}
                        className="bg-[#05080e] border border-cyan-900/40 hover:border-[#00ffd0]/45 focus:border-[#00ffd0] text-[#00ffd0] text-xs font-mono font-extrabold p-2 px-3 pr-10 rounded outline-none w-full transition-all"
                      />
                      <span className="absolute right-3 top-2.5 text-[8.5px] font-mono text-slate-500 font-extrabold">M³</span>
                    </div>
                  </div>
                  <p className="text-[8px] font-mono text-slate-500 normal-case leading-relaxed">
                    Kapasitas maksimum pengadukan beton basah aman (Default: 3.5 m³) agar material tidak meluber melampaui batas geometric mixer.
                  </p>
                </div>
              </div>

              {/* Informational Guidelines Banner */}
              <div className="bg-[#050912]/80 border border-slate-900 rounded-[5px] p-4 text-[10px] font-mono uppercase space-y-2 leading-relaxed shadow-md">
                <span className="text-[#00ffd0] font-bold block">INFO REKAYASA SISTEM SCADA:</span>
                <p className="text-slate-400 normal-case leading-relaxed">
                  Semua visualisasi level filling dan level material timbangan dihitung secara matematis proporsional berdasarkan kapasitas maksimum yang diset di atas. Formula SCADA:
                </p>
                <div className="p-2.5 bg-slate-950 rounded text-center text-[#00ffd0] text-xs font-bold border border-slate-800 font-mono tracking-wider">
                  TINGGI FILLING LEVEL ANIMASI (%) = (BERAT AKTUAL / KAPASITAS TIMBANGAN) x 100%
                </div>
                <p className="text-slate-500 text-[9px] lowercase leading-normal text-left">
                  * perubahan kapasitas ini akan tersimpan permanen dan langsung disinkronkan ke seluruh visualisasi timbangan (System 1, System 2, dan System 3) secara real time tanpa perlu restart.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 bg-[#0c1220] border-t border-slate-850/50 pt-4 flex justify-between text-[8px] font-mono text-slate-500 uppercase select-none">
              <span>Mencakup 3 Modul Model Dinamis PLC</span>
              <span>SINKRONISASI AKTIF LUAR JARINGAN</span>
            </div>
          </div>
        );

      case "Database Produksi":
        return (
          <DatabaseProduksi logs={logs} />
        );

      case "Print Tiket":
        return (
          <PrintTiket
            logs={logs}
            companyName={companyName}
            companyTagline={companyTagline}
            companyLogo={companyLogo}
          />
        );

      case "Kalibrasi Slump":
        return (
          <SlumpCalibration />
        );

      case "Pengaturan Perusahaan":
        return (
          <div className="flex-1 bg-[#0b1329]/80 border border-[#1e293b]/70 rounded-[6px] p-6 flex flex-col justify-between overflow-y-auto scrollbar-thin">
            <div className="space-y-6">
              <div className="flex items-center gap-2.5 text-[#00e5ff]">
                <Settings size={20} className="animate-spin" />
                <h4 className="text-sm font-sans font-black tracking-widest uppercase">
                  PENGATURAN LOGO DAN PROFIL PERUSAHAAN (BUKTI TIMBANG)
                </h4>
              </div>
              <p className="text-[10px] font-mono text-slate-400 uppercase leading-relaxed">
                Konfigurasikan informasi identitas perusahaan yang dicetak pada Bukti Timbang (Tiket Cetak) otomatis SCADA.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                
                {/* Bagian Kiri: Input Form Nama & Penegasan */}
                <div className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-sans font-black text-slate-400 uppercase">Nama Perusahaan</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCompanyName(val);
                        localStorage.setItem('company_name', val);
                      }}
                      className="bg-[#05080e] border border-slate-800 focus:border-[#00ffd0] hover:border-slate-700 text-slate-200 p-2.5 rounded-[4px] text-xs font-mono font-bold uppercase transition-all outline-none"
                      placeholder="CONTOH: PT FARIKA RIAU PERKASA"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-sans font-black text-slate-400 uppercase">Penegasan / Slogan Perusahaan</label>
                    <input
                      type="text"
                      value={companyTagline}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCompanyTagline(val);
                        localStorage.setItem('company_tagline', val);
                      }}
                      className="bg-[#05080e] border border-slate-800 focus:border-[#00ffd0] hover:border-slate-700 text-slate-200 p-2.5 rounded-[4px] text-xs font-mono font-bold uppercase transition-all outline-none"
                      placeholder="CONTOH: ONE STOP CONCRETE SOLUTION"
                    />
                  </div>

                  <div className="bg-[#1e1e10]/30 border-2 border-cyan-500/30 rounded-[4px] p-3 flex items-start gap-2.5">
                    <AlertOctagon size={16} className="text-cyan-500 shrink-0 mt-0.5" />
                    <div className="flex flex-col text-left">
                      <span className="text-[9.5px] font-sans font-black text-cyan-400 uppercase">SINKRONISASI AKTIF</span>
                      <span className="text-[8.5px] font-mono text-slate-400 uppercase mt-1 leading-relaxed">
                        Perubahan profil ini disimpan secara lokal di mesin SCADA HMI dan akan langsung memperbarui header utama serta format cetak Bukti Timbang (Tiket Print).
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bagian Kanan: Upload Logo */}
                <div className="bg-[#070b13] border border-slate-800 p-4 rounded-[4px] flex flex-col gap-4">
                  <span className="text-[9px] font-sans font-black text-slate-400 uppercase block border-b border-slate-900 pb-1">
                    LOGO PERUSAHAAN (BUKTI TIMBANG)
                  </span>

                  <div className="flex items-center gap-4">
                    {/* Preview Logo */}
                    <div className="w-20 h-20 bg-white rounded-full border-2 border-slate-800 flex items-center justify-center p-1 shadow-md relative group shrink-0 overflow-hidden">
                      {companyLogo ? (
                        <img 
                          src={companyLogo} 
                          alt="Company Logo Preview" 
                          className="w-full h-full rounded-full object-cover bg-white"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="text-center flex flex-col items-center justify-center select-none">
                          <span className="text-blue-800 text-[6px] font-black leading-none uppercase tracking-tighter">
                            DEFAULT<br/>FARIKA
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 flex flex-col gap-2">
                      <span className="text-[8.5px] font-mono text-slate-505 normal-case leading-relaxed">
                        Unggah logo baru untuk mengganti logo default pada tiket bukti timbang. Format JPEG/PNG direkomendasikan dengan rasio 1:1 (circular).
                      </span>
                      
                      <div className="flex items-center gap-2">
                        <label className="bg-cyan-600 hover:bg-cyan-500 text-black text-[9px] font-sans font-black uppercase px-3 py-2 rounded transition-all cursor-pointer inline-block shadow-md">
                          Pilih File Logo
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const result = event.target?.result as string;
                                  setCompanyLogo(result);
                                  localStorage.setItem('company_logo', result);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>

                        {companyLogo && (
                          <button
                            onClick={() => {
                              setCompanyLogo("");
                              localStorage.removeItem('company_logo');
                            }}
                            className="bg-red-950/40 hover:bg-red-900 border border-red-900/60 text-red-400 hover:text-white text-[9px] font-sans font-black uppercase px-3 py-2 rounded transition-all cursor-pointer"
                          >
                            Hapus Logo
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Logo Display Example in Print Layout */}
                  <div className="p-3 bg-slate-950 rounded border border-slate-900">
                    <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest block mb-1.5">Simulasi Print-Out Header:</span>
                    <div className="flex items-center gap-3 bg-white p-3 rounded text-slate-900 border border-slate-300">
                      <div className="w-10 h-10 rounded-full border-2 border-blue-800 flex items-center justify-center p-0.5 overflow-hidden">
                        {companyLogo ? (
                          <img src={companyLogo} alt="Logo" className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="text-blue-800 text-[6px] font-bold leading-none tracking-tighter">FARIKA</span>
                        )}
                      </div>
                      <div className="text-left">
                        <div className="text-[10px] font-black text-blue-900 uppercase leading-none">{companyName || 'PT FARIKA RIAU PERKASA'}</div>
                        <div className="text-[7.5px] font-bold text-slate-700 uppercase mt-1 leading-none">{companyTagline || 'ONE STOP CONCRETE SOLUTION'}</div>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            </div>

            <div className="mt-6 bg-[#0c1220] border-t border-slate-850/50 pt-4 flex justify-between text-[8px] font-mono text-slate-500 uppercase select-none shrink-0">
              <span>Mencakup Pengaturan Profil & Visual Logo</span>
              <span>SINKRONISASI AMAN SECARA LOKAL</span>
            </div>
          </div>
        );

      case "Pengaturan Plant":
        return (
          <div className="flex-1 bg-[#0b1329]/80 border border-[#1e293b]/70 rounded-[6px] p-6 flex flex-col justify-between overflow-y-auto scrollbar-thin">
            <div className="space-y-6">
              {/* Header Title */}
              <div className="flex items-center gap-2.5 text-[#00ffd0]">
                <Globe size={20} className="animate-pulse" />
                <h4 className="text-sm font-sans font-black tracking-widest uppercase">
                  PENGATURAN PLANT IDENTITY & CLOUD MONITORING
                </h4>
              </div>
              <p className="text-[10px] font-mono text-slate-400 uppercase leading-relaxed max-w-4xl">
                Tentukan identitas unik untuk komputer HMI ini (tidak menggunakan nama device Windows bawaan). Data produksi, sisa stok harian, alarm, serta aktivitas operator akan dibungkus dengan ID unik ini sebelum diantrekan secara offline untuk disinkronkan ke cloud secara aman.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                {/* Kolom Kiri: Form Identitas */}
                <div className="bg-[#05080e]/90 border border-slate-800 rounded p-5 space-y-4 shadow-lg">
                  <span className="text-[10px] font-sans font-black text-[#00ffd0] tracking-wider uppercase border-b border-slate-800 pb-2 block">
                    1. IDENTITAS LOKAL BATCHING PLANT
                  </span>

                  <div className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-sans font-black text-slate-400 uppercase">Perusahaan Induk</label>
                      <input
                        type="text"
                        value={plantCompanyState}
                        onChange={(e) => setPlantCompanyState(e.target.value)}
                        className="bg-[#0b1220] border border-slate-800 focus:border-[#00ffd0] hover:border-slate-700 text-slate-200 p-2.5 rounded-[4px] text-xs font-mono font-bold uppercase transition-all outline-none"
                        placeholder="Contoh: PT Farika Riau Perkasa"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-sans font-black text-amber-500 uppercase">KODE / ID PLANT (UNIK)</label>
                        <input
                          type="text"
                          value={plantIdState}
                          onChange={(e) => setPlantIdState(e.target.value)}
                          className="bg-[#0b1220] border border-slate-800 focus:border-[#00ffd0] hover:border-slate-700 text-amber-400 p-2.5 rounded-[4px] text-xs font-mono font-black uppercase transition-all outline-none"
                          placeholder="Contoh: PKU01"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] font-sans font-black text-[#00ffd0] uppercase">NAMA CABANG / PLANT</label>
                        <input
                          type="text"
                          value={plantNameState}
                          onChange={(e) => setPlantNameState(e.target.value)}
                          className="bg-[#0b1220] border border-slate-800 focus:border-[#00ffd0] hover:border-slate-700 text-[#00ffd0] p-2.5 rounded-[4px] text-xs font-mono font-extrabold uppercase transition-all outline-none"
                          placeholder="Contoh: Pekanbaru"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] font-sans font-black text-slate-400 uppercase">Alamat Plant (Opsional)</label>
                      <textarea
                        value={plantAddressState}
                        onChange={(e) => setPlantAddressState(e.target.value)}
                        className="bg-[#0b1220] border border-slate-800 focus:border-[#00ffd0] hover:border-slate-700 text-slate-200 p-2.5 rounded-[4px] text-xs font-mono font-bold uppercase transition-all outline-none h-20 resize-none"
                        placeholder="Contoh: Jl. Raya Pekanbaru - Dumai KM 12"
                      />
                    </div>

                    <button
                      onClick={() => {
                        savePlantIdentity({
                          plantCompany: plantCompanyState,
                          plantId: plantIdState,
                          plantName: plantNameState,
                          plantAddress: plantAddressState,
                          registeredAt: new Date().toISOString()
                        });
                        
                        localStorage.setItem('plant_id', plantIdState);
                        localStorage.setItem('plant_name', plantNameState);
                        localStorage.setItem('plant_company', plantCompanyState);
                        localStorage.setItem('plant_address', plantAddressState);
                        localStorage.setItem('plant_registered', 'true');
                        
                        alert("Sukses! Identitas plant berhasil diperbarui secara lokal.");
                        setSyncHistoryLogs(prev => [
                          `[${new Date().toLocaleTimeString()}] IDENTITAS DIPERBARUI -> ID: ${plantIdState}, Lokasi: ${plantNameState}`,
                          ...prev
                        ]);
                      }}
                      className="w-full bg-[#00ffd0]/10 hover:bg-[#00ffd0]/20 border border-[#00ffd0]/30 hover:border-[#00ffd0] text-[#00ffd0] font-sans font-black text-[10px] tracking-widest uppercase py-3 rounded transition-all cursor-pointer shadow-[0_0_8px_rgba(0,255,208,0.1)] hover:shadow-[0_0_15px_rgba(0,255,208,0.3)] font-black"
                    >
                      SIMPAN PERUBAHAN IDENTITAS PLANT
                    </button>
                    
                    <p className="text-[8px] font-mono text-slate-500 uppercase leading-relaxed text-center mt-1">
                      ⚠️ Mengubah ID plant akan mengelompokkan data cloud monitoring berikutnya ke ID cabang yang baru.
                    </p>
                  </div>
                </div>

                {/* Kolom Kanan: Cloud Sync & Monitoring Layer */}
                <div className="bg-[#05080e]/90 border border-slate-800 rounded p-5 space-y-4 flex flex-col justify-between shadow-lg">
                  <div>
                    <span className="text-[10px] font-sans font-black text-rose-500 tracking-wider uppercase border-b border-slate-800 pb-2 block">
                      2. DESKTOP LOCAL DB TO CLOUD SYNC ENGINE
                    </span>

                    {/* Sync Telemetry Panel */}
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="p-3 bg-slate-950 border border-slate-850 rounded">
                        <span className="text-[8px] text-slate-500 font-sans font-black uppercase">Fase Koneksi</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" />
                          <span className="text-[#00ffd0] font-mono text-[9px] font-black uppercase">DESKTOP OFFLINE-READY</span>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-950 border border-slate-850 rounded">
                        <span className="text-[8px] text-slate-500 font-sans font-black uppercase">Perekaman Telemetri</span>
                        <div className="flex items-center gap-1 mt-1 text-slate-200">
                          <span className="text-[9px] font-mono font-black text-cyan-400">AUTOMATED SENSORS SYSTEM</span>
                        </div>
                      </div>
                    </div>

                    {/* Sync Stats Database */}
                    <div className="p-4 bg-slate-950/80 border border-slate-850 rounded text-slate-300 font-mono text-[10px] space-y-2 uppercase mt-4">
                      <div className="flex items-center justify-between">
                        <span>Database Utama</span>
                        <span className="text-slate-200 font-bold">SQL / LocalStorage Schema</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Antrean Offline (Pending)</span>
                        <span className="text-amber-500 font-black">{isSyncingSimulated ? 0 : getSyncStats().pendingRecords} File</span>
                      </div>
                      <div className="flex items-center justify-between flex-wrap">
                        <span>Sistem Cloud Target</span>
                        <span className="text-cyan-400 font-bold">Future API Endpoint Layer</span>
                      </div>
                    </div>

                    {/* Simu Log Console */}
                    <div className="mt-4 p-3 bg-[#030712] border border-slate-900 rounded font-mono text-[9px] text-[#00ffcc] space-y-1 h-[95px] overflow-y-auto scrollbar-thin">
                      {syncHistoryLogs.map((logLine, idx) => (
                        <div key={idx} className="truncate select-none">{logLine}</div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        if (isSyncingSimulated) return;
                        setIsSyncingSimulated(true);
                        setSyncHistoryLogs(prev => [
                          `[${new Date().toLocaleTimeString()}] MEMULAI PILAR SINKRONISASI CLOUD...`,
                          `[${new Date().toLocaleTimeString()}] MENGHUBUNGKAN KE SERVER PEMANTAUAN UTAMA: PT FARIKA CLOUD`,
                          ...prev
                        ]);

                        setTimeout(() => {
                          const queueStr = localStorage.getItem("cloud_sync_queue") || "[]";
                          let queue = [];
                          try {
                            queue = JSON.parse(queueStr);
                          } catch (e) {}

                          // Mark all as synced
                          const updatedQueue = queue.map((r: any) => ({ ...r, synced: true }));
                          localStorage.setItem("cloud_sync_queue", JSON.stringify(updatedQueue));
                          window.dispatchEvent(new Event("cloud_sync_queue_updated"));

                          setIsSyncingSimulated(false);
                          setSyncHistoryLogs(prev => [
                            `[${new Date().toLocaleTimeString()}] SENSORS DATA TRANSMITTED SUCCESSFULLY! ✅`,
                            `[${new Date().toLocaleTimeString()}] SINKRONISASI SELESAI. ${updatedQueue.length} records sukses disimpan ke Cloud.`,
                            ...prev
                          ]);
                          alert(`Simulasi Sukses! ${updatedQueue.length} unit data produksi dan relai terkirim ke Cloud Monitoring Server.`);
                        }, 1800);
                      }}
                      disabled={isSyncingSimulated}
                      className="w-full bg-blue-950/40 hover:bg-blue-900/60 disabled:opacity-50 border border-blue-800 text-blue-400 font-sans font-black text-[10px] tracking-widest uppercase py-3 rounded transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isSyncingSimulated ? (
                        <>
                          <div className="w-3.5 h-3.5 border-t-2 border-r-2 border-cyan-400 rounded-full animate-spin shrink-0" />
                          <span>MENSINKRONKAN DATA KE CLOUD...</span>
                        </>
                      ) : (
                        <>
                          <Cloud size={12} className="text-[#00ffd0]" />
                          <span>SIMULASIKAN SINKRONISASI SEKARANG</span>
                        </>
                      )}
                    </button>
                    
                    <div className="p-3 bg-blue-950/10 border border-blue-900/25 rounded text-[8.5px] text-slate-400 font-mono uppercase leading-relaxed text-center animate-pulse">
                      🔐 Sistem HMI berjalan 100% offline secara lokal. Sinkronisasi dilakukan secara asinkron di latar belakang saat terminal memiliki akses internet.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-[#0c1220] border-t border-slate-850/50 pt-4 flex justify-between text-[8px] font-mono text-slate-500 uppercase select-none shrink-0">
              <span>SINKRONISASI ASINKRON: PEMBUNGKUS MULTI-PLANT AUTOMATIC INTEGRATED CONCRETE</span>
              <span>VERSI SISTEM: SCADA v2.4a-CLOUD</span>
            </div>
          </div>
        );

      case "Remote Tablet":
        return (
          <RemoteTablet />
        );

      default:
        return (
          <div className="flex-1 bg-[#0b1329]/80 border border-[#1e293b]/70 rounded-[6px] p-6 flex flex-col items-center justify-center text-center overflow-hidden">
            <Wrench size={36} className="text-cyan-400 opacity-60 animate-bounce" />
            <span className="text-[12px] font-sans font-black text-[#00e5ff] tracking-widest uppercase mt-4">
              KONTROL PANEL [{activeMenu.toUpperCase()}]
            </span>
            <span className="text-[10px] font-mono text-slate-400 uppercase mt-2 max-w-sm leading-relaxed">
              Modul setelan admin ini sedang berada dalam masa sinkronisasi atau penyesuaian hardware pembacaan PLC internal.
            </span>
          </div>
        );
    }
  };

  const uRole = (currentUser?.jabatan || "Operator").toUpperCase();

  return (
    <div className="fixed inset-0 z-[250] bg-[#070b13] p-3 flex flex-col h-screen select-none font-sans overflow-hidden">
      
      {/* Top Header Panel */}
      <div className="h-[48px] bg-[#0c1220] border border-slate-800/80 rounded-[6px] flex items-center justify-between px-4 mb-3 shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <Layout size={18} className="text-[#00e5ff] drop-shadow-[0_0_5px_rgba(0,229,255,0.4)]" />
          <span className="text-[12px] font-sans font-black tracking-widest text-white uppercase flex items-center gap-2">
            {uRole === "DIREKTUR" ? "BATCH PLANT - EXECUTIVE DASHBOARD" :
             uRole === "SUPERVISOR" ? "BATCH PLANT - SUPERVISOR DASHBOARD" :
             uRole === "LOGISTIK" ? "BATCH PLANT - LOGISTICS DASHBOARD" :
             "BATCH PLANT - ADMINISTRATION DASHBOARD"}
            <span className="text-[7.5px] font-mono font-bold text-cyan-400 bg-cyan-900/45 border border-cyan-800/50 px-1.5 py-0.5 rounded-[3.5px] uppercase select-none tracking-normal">
              {uRole} MODE
            </span>
          </span>
        </div>

        {/* Current visual active menu breadcrumb */}
        <div className="flex items-center gap-1.5 font-mono text-[9px] text-slate-400 uppercase font-black bg-slate-900/60 px-2 py-1 rounded-[4px] border border-slate-850">
          <Compass size={10} className="text-cyan-400" />
          <span>SYS</span>
          <span className="text-slate-600 font-bold">&gt;</span>
          <span className="text-[#00ffd0]">{activeMenu}</span>
        </div>
      </div>

      {/* Main Dual-Layout View */}
      <div className="flex-1 flex gap-3 min-h-0 overflow-hidden">
        {/* Left Side menu Bar */}
        <Sidebar
          activeMenu={activeMenu}
          setActiveMenu={setActiveMenu}
          onLogout={onLogout}
          userRole={currentUser?.jabatan}
        />

        {/* Right Dynamic Contents Panel Container */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};
