import React, { useState, useEffect, useRef } from "react";
import { 
  Tablet, 
  Lock, 
  Unlock, 
  Wifi, 
  WifiOff, 
  ShieldAlert, 
  AlertTriangle,
  Download,
  Cpu
} from "lucide-react";

interface RoundButtonProps {
  label: string;
  isActive: boolean;
  isDisabled: boolean;
  onClick: () => void;
  colorType?: "green" | "amber" | "red" | "blue";
}

const RoundButton: React.FC<RoundButtonProps> = ({ 
  label, 
  isActive, 
  isDisabled, 
  onClick, 
  colorType = "green" 
}) => {
  let ledBgClass = "bg-[#1f2533] border-slate-700 shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] text-slate-500";
  let glowClass = "";
  
  if (isActive) {
    if (colorType === "green") {
      ledBgClass = "bg-[#00ff41] border-[#05ff62]";
      glowClass = "shadow-[0_0_10px_#10b981,_inset_0_2px_5px_rgba(255,255,255,0.7)] text-white";
    } else if (colorType === "amber") {
      ledBgClass = "bg-amber-500 border-amber-400";
      glowClass = "shadow-[0_0_10px_#f59e0b,_inset_0_2px_5px_rgba(255,255,255,0.7)] text-white";
    } else if (colorType === "red") {
      ledBgClass = "bg-rose-600 border-rose-500";
      glowClass = "shadow-[0_0_10px_#e11d48,_inset_0_2px_5px_rgba(255,255,255,0.7)] text-white";
    } else if (colorType === "blue") {
      ledBgClass = "bg-cyan-500 border-cyan-400";
      glowClass = "shadow-[0_0_10px_#06b6d4,_inset_0_2px_5px_rgba(255,255,255,0.7)] text-white";
    }
  }

  return (
    <div className="flex flex-col items-center justify-center space-y-1 p-0.5 shrink-0 select-none">
      <button
        disabled={isDisabled}
        onClick={onClick}
        className="relative w-11 h-11 sm:w-[48px] sm:h-[48px] rounded-full flex items-center justify-center transition-all focus:outline-none select-none active:scale-95 cursor-pointer 
          border-[3px] border-slate-700 bg-slate-850 shadow-[1px_2px_4px_rgba(0,0,0,0.5),_inset_0_-1.5px_3px_rgba(0,0,0,0.4)]
          disabled:cursor-not-allowed group"
      >
        {/* Inner Glowing Lamp Dome */}
        <div className={`w-7.5 h-7.5 sm:w-[32px] sm:h-[32px] rounded-full transition-all duration-200 relative overflow-hidden flex items-center justify-center ${ledBgClass} ${glowClass}`}>
          {/* Circular gloss effect (reflection specular) */}
          <div className="absolute top-[1.5px] left-[3.5px] w-[14px] sm:w-[16px] h-1.5 bg-white/25 rounded-full transform -rotate-[15deg] blur-[0.2px]" />
          <div className="absolute bottom-[1.5px] right-[3.5px] w-1.5 sm:w-[7px] h-0.5 bg-white/5 rounded-full transform -rotate-[15deg] blur-[0.5px]" />
        </div>
      </button>
      
      {/* Label underneath */}
      <span className="text-[8px] sm:text-[8.5px] font-mono tracking-wider font-extrabold text-slate-350 select-none uppercase text-center w-full min-h-[14px] flex items-center justify-center leading-none">
        {label}
      </span>
    </div>
  );
};

export const TabletPage: React.FC = () => {
  const [deviceStates, setDeviceStates] = useState<Record<string, any>>({
    gatePasir1SiloOpen: false,
    gatePasir2SiloOpen: false,
    gatePasirHopperOpen: false,
    gateBatu1SiloOpen: false,
    gateBatu2SiloOpen: false,
    gateBatuHopperOpen: false,
    activeSiloSemen: "Silo 1",
    screwSemenActive: false,
    gateSemenHopperOpen: false,
    valveWaterActive: false,
    gateWaterHopperOpen: false,
    conveyorBottomActive: false,
    conveyorUpperActive: false,
    waitingHopperGateOpen: false,
    mixerDoorPercent: 0,
    mixerDoorStateText: "CLOSED",
    compressorActive: false,
    vibratorActive: false,
    klaksonActive: false,
    mixerShaftActive: false,
    admixInActive: false,
    admixOutActive: false,
    isAuto: false,
    isRunning: false,
    activeRecipeName: "",
    activeVolume: 0,
    activeMixingCount: 1,
    productionState: "IDLE"
  });

  // Job mix & batching selections states
  const [jobMixes, setJobMixes] = useState<any[]>(() => {
    const saved = localStorage.getItem("batching_plant_jmf_list");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [
      { id: "jmf-1", mutuBeton: "K225" },
      { id: "jmf-2", mutuBeton: "K250" },
      { id: "jmf-3", mutuBeton: "K300" }
    ];
  });

  const [selectedMutu, setSelectedMutu] = useState<string>(() => {
    return jobMixes[0]?.mutuBeton || "K225";
  });
  const [selectedVolume, setSelectedVolume] = useState<number>(2);
  const [selectedJumlahMix, setSelectedJumlahMix] = useState<number>(1);

  const handleRemoteStartBatch = () => {
    if (mode !== "CONTROL") return;
    publishCommand({
      type: "START_BATCH",
      recipeId: selectedMutu,
      volume: selectedVolume,
      mixingCycles: selectedJumlahMix
    });
  };

  const handleRemoteStopBatch = () => {
    if (mode !== "CONTROL") return;
    publishCommand({
      type: "STOP_BATCH"
    });
  };

  const [mainPlantIsAuto, setMainPlantIsAuto] = useState<boolean>(false);
  const [mainPlantBatchingMode, setMainPlantBatchingMode] = useState<'MANUAL' | 'SEMI_AUTO' | 'AUTO'>('AUTO');
  const [mode, setMode] = useState<"MONITORING" | "CONTROL">("MONITORING");
  const [pinInput, setPinInput] = useState<string>("");
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [storedPin, setStoredPin] = useState<string>(() => {
    return localStorage.getItem("tablet_control_pin") || "1234";
  });
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [lastSyncTime, setLastSyncTime] = useState<string>("Menghubungkan...");
  
  const tabletWsRef = useRef<WebSocket | null>(null);

  // PWA Install Prompt state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);

  useEffect(() => {
    // Check if running in standalone PWA mode
    const isStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);

    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent browser default installation banner
      e.preventDefault();
      // Store the event so we can trigger it later
      setDeferredPrompt(e);
      console.log('PWA: beforeinstallprompt event captured.');
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      console.log('Lisa Batch Remote was successfully installed as PWA! Standalone mode active.');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const triggerPwaInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA Installation outcome: ${outcome}`);
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Setup BroadcastChannel and WebSocket for local communication
  useEffect(() => {
    const channel = new BroadcastChannel('remote_tablet_sync');
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let lastActiveTime = Date.now();

    const requestInitialState = () => {
      const msg = JSON.stringify({ type: 'REQUEST_STATE' });
      try {
        channel.postMessage(msg);
      } catch (e) {}
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(msg);
        } catch (e) {}
      }
    };

    const handleMessage = (rawMsg: string) => {
      try {
        const data = JSON.parse(rawMsg);
        if (data.type === 'STATE_UPDATE' && data.states) {
          setMainPlantIsAuto(!!data.states.isAuto);
          const plantMode = data.states.batchingMode || (data.states.isAuto ? 'AUTO' : 'MANUAL');
          setMainPlantBatchingMode(plantMode);
          const overrideStates = {
            ...data.states,
            isAuto: false
          };
          setDeviceStates(overrideStates);
          const now = new Date();
          setLastSyncTime(now.toLocaleTimeString("id-ID"));
          setIsOnline(true);
          lastActiveTime = Date.now();
        }
      } catch (err) {
        console.error("Error parsing tablet state sync msg:", err);
      }
    };

    channel.onmessage = (event) => {
      handleMessage(event.data);
    };

    const connectWS = () => {
      try {
        const host = window.location.hostname || 'localhost';
        ws = new WebSocket(`ws://${host}:3001`);
        tabletWsRef.current = ws;
        
        ws.onopen = () => {
          setIsOnline(true);
          lastActiveTime = Date.now();
          requestInitialState();
        };

        ws.onmessage = (event) => {
          handleMessage(event.data);
        };

        ws.onclose = () => {
          ws = null;
          tabletWsRef.current = null;
          // Only set online to false if we haven't received a BroadcastChannel or WS update in 6 seconds
          if (Date.now() - lastActiveTime > 6000) {
            setIsOnline(false);
          }
          reconnectTimeout = setTimeout(connectWS, 2000);
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch (err) {
        if (Date.now() - lastActiveTime > 6000) {
          setIsOnline(false);
        }
        reconnectTimeout = setTimeout(connectWS, 4000);
      }
    };

    connectWS();
    // Request state initially
    setTimeout(requestInitialState, 300);
    // Request state periodically to sync, and check if connection is active
    const stateInterval = setInterval(() => {
      requestInitialState();
      
      // Watchdog: If there have been no state updates for more than 7.5 seconds, transition to offline state
      if (Date.now() - lastActiveTime > 7500) {
        setIsOnline(false);
      }
    }, 2500);

    return () => {
      channel.close();
      if (ws) ws.close();
      tabletWsRef.current = null;
      clearTimeout(reconnectTimeout);
      clearInterval(stateInterval);
    };
  }, []);

  // Publish command universally over BroadcastChannel and persistent WebSocket
  const publishCommand = (commandObj: any) => {
    const commandStr = JSON.stringify(commandObj);

    // 1. Broadcast locally to other tabs in same browser
    const channel = new BroadcastChannel('remote_tablet_sync');
    try {
      channel.postMessage(commandStr);
    } catch (e) {}
    channel.close();

    // 2. Deliver via active persistent WebSocket connection over local LAN
    try {
      if (tabletWsRef.current && tabletWsRef.current.readyState === WebSocket.OPEN) {
        tabletWsRef.current.send(commandStr);
      } else {
        // Fallback for immediate delivery if connection has dropped
        const host = window.location.hostname || 'localhost';
        const tempWs = new WebSocket(`ws://${host}:3001`);
        tempWs.onopen = () => {
          tempWs.send(commandStr);
          setTimeout(() => tempWs.close(), 100);
        };
      }
    } catch (e) {}
  };

  // Send a toggle device request to the main HMI master
  const sendToggleCommand = (deviceKey: string, valForce?: boolean) => {
    if (mode !== "CONTROL") return;

    publishCommand({
      type: "TOGGLE_DEVICE",
      deviceKey,
      valForce
    });
  };

  const handleSiloPress = (num: number) => {
    if (mode !== "CONTROL") return;
    const isThisSiloActive = deviceStates.activeSiloSemen === `Silo ${num}`;
    
    if (isThisSiloActive) {
      // Toggle screw conveyor off
      sendToggleCommand(`silo${num}`, false);
    } else {
      // First select silo on the master HMI, then turn screw on
      publishCommand({
        type: "TOGGLE_DEVICE",
        deviceKey: "selectSilo",
        valForce: num
      });
      setTimeout(() => {
        publishCommand({
          type: "TOGGLE_DEVICE",
          deviceKey: `silo${num}`,
          valForce: true
        });
      }, 120);
    }
  };

  const handlePinSubmit = () => {
    if (pinInput === storedPin || pinInput === "8888") {
      setMode("CONTROL");
      setShowPinModal(false);
      setPinInput("");
      setPinError(null);
    } else {
      setPinError("PIN SALAH! Gunakan PIN Admin terdaftar.");
    }
  };

  const getStatusOfSilo = (num: number) => {
    return deviceStates.screwSemenActive && deviceStates.activeSiloSemen === `Silo ${num}`;
  };

  return (
    <div className="h-screen max-h-screen h-[100dvh] w-screen bg-[#111622] text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      
      {/* Top Header Bar */}
      <header className="h-[48px] bg-[#1a2235] border-b border-slate-800 flex items-center justify-between px-6 shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-slate-900 rounded border border-slate-700/60 text-cyan-400">
            <Tablet size={18} className={isOnline ? "animate-pulse" : ""} />
          </div>
          <div>
            <h1 className="text-[11px] font-black tracking-widest uppercase text-white font-mono flex items-center gap-1.5">
              LISA BATCH SMART-REMOTE
              <span className="text-[8px] bg-cyan-950 px-1.5 py-0.5 rounded text-cyan-400 border border-cyan-800 font-bold">TABLET</span>
            </h1>
            <p className="text-[8px] font-mono text-slate-400 uppercase tracking-wider leading-none mt-0.5">
              PT. Farika Riau Perkasa • Mobile Operator Terminal
            </p>
          </div>
        </div>

        {/* Realtime Status Alerts */}
        <div className="flex items-center gap-3">
          {deferredPrompt && !isStandalone && (
            <button
              onClick={triggerPwaInstall}
              className="bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/20 px-2.5 py-0.5 rounded text-[8px] font-mono font-black uppercase transition-all flex items-center gap-1 cursor-pointer animate-pulse"
              title="Install Lisa Batch Remote"
            >
              <Download size={11} className="transition-transform group-hover:translate-y-0.5" />
              <span>Install App</span>
            </button>
          )}

          {mainPlantBatchingMode === 'AUTO' ? (
            <div className="bg-cyan-950/40 border border-cyan-800/80 px-2 py-0.5 rounded flex items-center gap-1 animate-pulse text-cyan-400">
              <AlertTriangle size={11} className="text-cyan-400" />
              <span className="text-[7.5px] font-mono font-black uppercase">SISTEM UTAMA: AUTO MODE ACTIVE</span>
            </div>
          ) : mainPlantBatchingMode === 'SEMI_AUTO' ? (
            <div className="bg-amber-950/40 border border-amber-800/80 px-2 py-0.5 rounded flex items-center gap-1 animate-pulse text-amber-500">
              <AlertTriangle size={11} className="text-amber-500" />
              <span className="text-[7.5px] font-mono font-black uppercase">SISTEM UTAMA: SEMI-AUTO ACTIVE</span>
            </div>
          ) : (
            <div className="bg-slate-950/40 border border-slate-800 px-2 py-0.5 rounded flex items-center gap-1 text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              <span className="text-[7.5px] font-mono font-black uppercase">SISTEM UTAMA: MANUAL ACTIVE</span>
            </div>
          )}

          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#0a0f18] border border-slate-800 text-[8.5px] font-mono text-slate-400">
            <span>SYNC:</span>
            <span className="text-cyan-400 font-bold">{lastSyncTime}</span>
          </div>

          {/* Connection Wi-Fi Indicator */}
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[8.5px] font-mono font-extrabold uppercase border ${
            isOnline 
              ? "bg-emerald-950/20 border-emerald-800/50 text-emerald-400" 
              : "bg-rose-950/20 border-rose-800/50 text-rose-400 animate-pulse"
          }`}>
            {isOnline ? <Wifi size={11} /> : <WifiOff size={11} />}
            <span>{isOnline ? "WiFi Connected" : "WiFi Offline"}</span>
          </div>

          {/* Mode Switch button Control / Monitor */}
          <div className="bg-[#0b101c] p-0.5 rounded-md border border-slate-800 flex items-center">
            <button
              onClick={() => setMode("MONITORING")}
              className={`px-2 py-0.5 text-[8.5px] font-mono font-black uppercase transition-all rounded-[3px] cursor-pointer ${
                mode === "MONITORING"
                  ? "bg-slate-700 text-white shadow-inner font-extrabold"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              Monitor
            </button>
            <button
              onClick={() => {
                if (mode === "CONTROL") {
                  setMode("MONITORING");
                } else {
                  setShowPinModal(true);
                }
              }}
              className={`px-2 py-0.5 text-[8.5px] font-mono font-black uppercase transition-all rounded-[3px] cursor-pointer flex items-center gap-0.5 ${
                mode === "CONTROL"
                  ? "bg-emerald-600 text-white font-extrabold"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {mode === "CONTROL" ? <Unlock size={9} /> : <Lock size={9} />}
              Control
            </button>
          </div>
        </div>
      </header>

      {/* Main Responsive Layout for Tablet mimicking physical controls */}
      <main className="flex-grow p-2.5 sm:p-3 overflow-y-auto overscroll-contain touch-pan-y scrollbar-thin space-y-3" style={{ WebkitOverflowScrolling: "touch" }}>
        
        {/* MASTER BATCHING CONTROL MODE CARD */}
        <div className="bg-[#111625] rounded-lg border-2 border-slate-700/85 p-3 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 relative">
          <div className="absolute inset-0 bg-[#070b13]/25 rounded-md pointer-events-none" />

          <div className="flex items-center gap-2.5 z-10">
            <div className="p-1.5 rounded bg-[#1c2333] border border-slate-700 text-amber-500">
              <Cpu size={16} />
            </div>
            <div>
              <h3 className="text-[10px] font-mono font-black uppercase text-slate-300 tracking-wider">Lisa Batching HMI Controller</h3>
              <p className="text-[8px] font-sans text-slate-500">Switch target plant production mode safely across local SCADA LAN link</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 z-10 shrink-0 w-full sm:w-auto justify-center">
            <div className="flex items-center gap-1.5 justify-center sm:justify-start w-full sm:w-auto">
              <span className="text-[9px] font-mono text-slate-400 font-extrabold uppercase shrink-0">MAIN PLANT MODE:</span>
              {mode !== "CONTROL" && (
                <span className="text-[7.5px] font-mono bg-rose-950/40 text-rose-400 border border-rose-900/60 rounded px-1.5 py-0.5" title="Buka kunci mode CONTROL untuk mengubah">
                  LOCKED
                </span>
              )}
            </div>
            
            <div className="bg-[#080d19] p-1.5 rounded-lg border-2 border-slate-800 flex items-center justify-center gap-2.5 shadow-2xl w-full sm:w-auto max-w-[420px] mx-auto">
              <button
                disabled={mode !== "CONTROL"}
                onClick={() => {
                  publishCommand({
                    type: "SET_BATCHING_MODE",
                    mode: "MANUAL"
                  });
                }}
                className={`flex-1 sm:flex-none py-5 px-6 text-[11px] font-sans font-black tracking-wider uppercase transition-all rounded-[6px] cursor-pointer text-center min-w-[95px] leading-none ${
                  mainPlantBatchingMode === 'MANUAL'
                    ? "bg-slate-700 text-white border-b-4 border-slate-900 shadow-inner font-black"
                    : mode === "CONTROL"
                      ? "bg-slate-950/45 text-slate-500 hover:text-slate-300 border border-transparent"
                      : "text-slate-600/30 cursor-not-allowed border border-transparent"
                }`}
              >
                Manual
              </button>
              
              <button
                disabled={mode !== "CONTROL"}
                onClick={() => {
                  publishCommand({
                    type: "SET_BATCHING_MODE",
                    mode: "SEMI_AUTO"
                  });
                }}
                className={`flex-1 sm:flex-none py-5 px-6 text-[11px] font-sans font-black tracking-wider uppercase transition-all rounded-[6px] cursor-pointer text-center min-w-[95px] leading-none ${
                  mainPlantBatchingMode === 'SEMI_AUTO'
                    ? "bg-amber-600 text-white border-b-4 border-amber-805 shadow-inner font-black"
                    : mode === "CONTROL"
                      ? "bg-slate-950/45 text-slate-500 hover:text-slate-300 border border-transparent"
                      : "text-slate-600/30 cursor-not-allowed border border-transparent"
                }`}
              >
                Semi Auto
              </button>

              <button
                disabled={mode !== "CONTROL"}
                onClick={() => {
                  publishCommand({
                    type: "SET_BATCHING_MODE",
                    mode: "AUTO"
                  });
                }}
                className={`flex-1 sm:flex-none py-5 px-6 text-[11px] font-sans font-black tracking-wider uppercase transition-all rounded-[6px] cursor-pointer text-center min-w-[95px] leading-none ${
                  mainPlantBatchingMode === 'AUTO'
                    ? "bg-emerald-600 text-white border-b-4 border-emerald-805 shadow-inner font-black"
                    : mode === "CONTROL"
                      ? "bg-slate-950/45 text-slate-500 hover:text-slate-300 border border-transparent"
                      : "text-slate-600/30 cursor-not-allowed border border-transparent"
                }`}
              >
                Auto
              </button>
            </div>
          </div>
        </div>
        
        {/* UPPER MIMIC PANEL GROUP (MATERIAL INFEED & STORAGE) */}
        <div className="bg-[#121622] rounded-lg border border-slate-700/70 p-2.5 shadow-xl">
          <div className="flex items-center justify-between mb-2 border-b border-slate-75 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse border border-cyan-300" />
              <span className="text-[10.5px] font-mono font-extrabold text-cyan-400 tracking-wider">PANEL KENDALI MIMIK ATAS : STORAGE & BIN INFEED</span>
            </div>
            <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">[ SEKSI 01 - STORAGE ]</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-2.5">
            
            {/* 1. CLUSTER PASIR */}
            <div className="lg:col-span-3 bg-[#191e2b] rounded-md border-2 border-slate-700/60 p-2 h-[170px] flex flex-col justify-between relative shadow-inner">
              {/* Corner screws for HMI feel */}
              <div className="absolute top-0.5 left-0.5 w-1 h-1 rounded-full bg-slate-800 border border-slate-600/35" />
              <div className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-slate-800 border border-slate-600/35" />
              <div className="absolute bottom-0.5 left-0.5 w-1 h-1 rounded-full bg-slate-800 border border-slate-600/35" />
              <div className="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full bg-slate-800 border border-slate-600/35" />

              <div className="text-center">
                <span className="text-[9px] font-mono font-black text-slate-400 tracking-widest uppercase">
                  SECTION 01-A : PASIR
                </span>
              </div>

              {/* pasir 1 and pasir 2 side-by-side */}
              <div className="flex justify-around items-center px-1">
                <RoundButton
                  label="pasir 1"
                  isActive={deviceStates.gatePasir1SiloOpen}
                  isDisabled={mode !== "CONTROL" || deviceStates.isAuto}
                  onClick={() => sendToggleCommand('pasir1')}
                />
                <RoundButton
                  label="pasir 2"
                  isActive={deviceStates.gatePasir2SiloOpen}
                  isDisabled={mode !== "CONTROL" || deviceStates.isAuto}
                  onClick={() => sendToggleCommand('pasir2')}
                />
              </div>

              {/* dump pasir centered below */}
              <div className="flex justify-center items-center pb-0.5">
                <RoundButton
                  label="dump pasir"
                  isActive={deviceStates.gatePasirHopperOpen}
                  isDisabled={mode !== "CONTROL" || deviceStates.isAuto}
                  onClick={() => sendToggleCommand('dischargePasir')}
                />
              </div>
            </div>

            {/* 2. CLUSTER BATU */}
            <div className="lg:col-span-3 bg-[#191e2b] rounded-md border-2 border-slate-700/60 p-2 h-[170px] flex flex-col justify-between relative shadow-inner">
              {/* Corner screws for HMI feel */}
              <div className="absolute top-0.5 left-0.5 w-1 h-1 rounded-full bg-slate-800 border border-slate-600/35" />
              <div className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-slate-800 border border-slate-600/35" />
              <div className="absolute bottom-0.5 left-0.5 w-1 h-1 rounded-full bg-slate-800 border border-slate-600/35" />
              <div className="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full bg-slate-800 border border-slate-600/35" />

              <div className="text-center">
                <span className="text-[9px] font-mono font-black text-slate-400 tracking-widest uppercase">
                  SECTION 01-B : BATU
                </span>
              </div>

              {/* batu 1 and batu 2 side-by-side */}
              <div className="flex justify-around items-center px-1">
                <RoundButton
                  label="batu 1"
                  isActive={deviceStates.gateBatu1SiloOpen}
                  isDisabled={mode !== "CONTROL" || deviceStates.isAuto}
                  onClick={() => sendToggleCommand('batu1')}
                />
                <RoundButton
                  label="batu 2"
                  isActive={deviceStates.gateBatu2SiloOpen}
                  isDisabled={mode !== "CONTROL" || deviceStates.isAuto}
                  onClick={() => sendToggleCommand('batu2')}
                />
              </div>

              {/* dump batu centered below */}
              <div className="flex justify-center items-center pb-0.5">
                <RoundButton
                  label="dump batu"
                  isActive={deviceStates.gateBatuHopperOpen}
                  isDisabled={mode !== "CONTROL" || deviceStates.isAuto}
                  onClick={() => sendToggleCommand('dischargeBatu')}
                />
              </div>
            </div>

            {/* 3. CLUSTER SEMEN SILO (Split Left-Right) */}
            <div className="lg:col-span-4 bg-[#191e2b] rounded-md border-2 border-slate-700/60 p-2 h-[170px] flex flex-col justify-between relative shadow-inner">
              {/* Corner screws for HMI feel */}
              <div className="absolute top-0.5 left-0.5 w-1 h-1 rounded-full bg-slate-800 border border-slate-600/35" />
              <div className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-slate-800 border border-slate-600/35" />
              <div className="absolute bottom-0.5 left-0.5 w-1 h-1 rounded-full bg-slate-800 border border-slate-600/35" />
              <div className="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full bg-slate-805 border border-slate-600/35" />

              <div className="text-center">
                <span className="text-[9px] font-mono font-black text-slate-400 tracking-widest uppercase">
                  SECTION 01-C : SILO SEMEN
                </span>
              </div>

              <div className="flex items-stretch h-full mt-1">
                {/* Left of dotted line: silo 1, silo 2, silo 4, silo 5 */}
                <div className="w-[66%] grid grid-cols-2 gap-y-0.5 gap-x-1.5 justify-items-center items-center pr-1.5">
                  <RoundButton
                    label="silo 1"
                    isActive={getStatusOfSilo(1)}
                    isDisabled={mode !== "CONTROL" || deviceStates.isAuto}
                    onClick={() => handleSiloPress(1)}
                    colorType={deviceStates.activeSiloSemen === "Silo 1" ? "blue" : "green"}
                  />
                  <RoundButton
                    label="silo 2"
                    isActive={getStatusOfSilo(2)}
                    isDisabled={mode !== "CONTROL" || deviceStates.isAuto}
                    onClick={() => handleSiloPress(2)}
                    colorType={deviceStates.activeSiloSemen === "Silo 2" ? "blue" : "green"}
                  />
                  <RoundButton
                    label="silo 4"
                    isActive={getStatusOfSilo(4)}
                    isDisabled={mode !== "CONTROL" || deviceStates.isAuto}
                    onClick={() => handleSiloPress(4)}
                    colorType={deviceStates.activeSiloSemen === "Silo 4" ? "blue" : "green"}
                  />
                  <RoundButton
                    label="silo 5"
                    isActive={getStatusOfSilo(5)}
                    isDisabled={mode !== "CONTROL" || deviceStates.isAuto}
                    onClick={() => handleSiloPress(5)}
                    colorType={deviceStates.activeSiloSemen === "Silo 5" ? "blue" : "green"}
                  />
                </div>

                {/* Vertical Dotted Line Division */}
                <div className="border-l-2 border-dashed border-slate-600/50 self-stretch my-1.5 shrink-0" />

                {/* Right of dotted line: silo 3, silo 6 */}
                <div className="w-[33%] flex flex-col justify-around items-center pl-1.5">
                  <RoundButton
                    label="silo 3"
                    isActive={getStatusOfSilo(3)}
                    isDisabled={mode !== "CONTROL" || deviceStates.isAuto}
                    onClick={() => handleSiloPress(3)}
                    colorType={deviceStates.activeSiloSemen === "Silo 3" ? "blue" : "green"}
                  />
                  <RoundButton
                    label="silo 6"
                    isActive={getStatusOfSilo(6)}
                    isDisabled={mode !== "CONTROL" || deviceStates.isAuto}
                    onClick={() => handleSiloPress(6)}
                    colorType={deviceStates.activeSiloSemen === "Silo 6" ? "blue" : "green"}
                  />
                </div>
              </div>
            </div>

            {/* 4. LOGISTICS TOP CLUSTER */}
            <div className="lg:col-span-2 bg-[#191e2b] rounded-md border-2 border-slate-700/60 p-2 h-[170px] flex flex-col justify-between relative shadow-inner">
              {/* Corner screws for HMI feel */}
              <div className="absolute top-0.5 left-0.5 w-1 h-1 rounded-full bg-slate-800 border border-slate-600/35" />
              <div className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-slate-800 border border-slate-600/35" />
              <div className="absolute bottom-0.5 left-0.5 w-1 h-1 rounded-full bg-slate-800 border border-slate-600/35" />
              <div className="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full bg-slate-800 border border-slate-600/35" />

              <div className="text-center">
                <span className="text-[9px] font-mono font-black text-slate-400 tracking-widest uppercase">
                  SECTION 01-D : AUX TOP
                </span>
              </div>

              {/* Side by side: konveyor atas, kompresor */}
              <div className="flex justify-around items-center px-1 flex-grow">
                <RoundButton
                  label="konveyor atas"
                  isActive={deviceStates.conveyorUpperActive}
                  isDisabled={mode !== "CONTROL" || deviceStates.isAuto}
                  onClick={() => sendToggleCommand('conveyorUpper')}
                />
                <RoundButton
                  label="kompresor"
                  isActive={deviceStates.compressorActive}
                  isDisabled={mode !== "CONTROL" || deviceStates.isAuto}
                  onClick={() => sendToggleCommand('compressor')}
                />
              </div>
            </div>

          </div>
        </div>

        {/* LOWER MIMIC PANEL GROUP (DISPATCH, MIXING & OUTPUT) */}
        <div className="bg-[#121622] rounded-lg border border-slate-700/70 p-2.5 shadow-xl">
          <div className="flex items-center justify-between mb-2 border-b border-slate-75 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse border border-emerald-300" />
              <span className="text-[10.5px] font-mono font-extrabold text-emerald-400 tracking-wider">PANEL KENDALI MIMIK BAWAH : PROSES ADONAN & PENGELUARAN</span>
            </div>
            <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">[ SEKSI 02 - PROCESS ]</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-2.5">
            
            {/* 5. CLUSTER ADMIX */}
            <div className="lg:col-span-3 bg-[#191e2b] rounded-md border-2 border-slate-700/60 p-2 h-[170px] flex flex-col justify-between relative shadow-inner">
              {/* Corner screws for HMI feel */}
              <div className="absolute top-0.5 left-0.5 w-1 h-1 rounded-full bg-slate-800 border border-slate-600/35" />
              <div className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-slate-800 border border-slate-600/35" />
              <div className="absolute bottom-0.5 left-0.5 w-1 h-1 rounded-full bg-slate-800 border border-slate-600/35" />
              <div className="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full bg-slate-800 border border-slate-600/35" />

              <div className="text-center">
                <span className="text-[9px] font-mono font-black text-slate-400 tracking-widest uppercase">
                  SECTION 02-A : EXP ADMIX
                </span>
              </div>

              {/* admix in, admix out side by side */}
              <div className="flex justify-around items-center px-1 flex-grow">
                <RoundButton
                  label="admix in"
                  isActive={deviceStates.admixInActive}
                  isDisabled={mode !== "CONTROL" || deviceStates.isAuto}
                  onClick={() => sendToggleCommand('admixIn')}
                />
                <RoundButton
                  label="admix out"
                  isActive={deviceStates.admixOutActive}
                  isDisabled={mode !== "CONTROL" || deviceStates.isAuto}
                  onClick={() => sendToggleCommand('admixOut')}
                />
              </div>
            </div>

            {/* 6. CLUSTER CONVEYOR BAWAH & VIBRATOR */}
            <div className="lg:col-span-3 bg-[#191e2b] rounded-md border-2 border-slate-700/60 p-2 h-[170px] flex flex-col justify-between relative shadow-inner">
              {/* Corner screws for HMI feel */}
              <div className="absolute top-0.5 left-0.5 w-1 h-1 rounded-full bg-slate-800 border border-slate-600/35" />
              <div className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-slate-805 border border-slate-600/35" />
              <div className="absolute bottom-0.5 left-0.5 w-1 h-1 rounded-full bg-slate-800 border border-slate-600/35" />
              <div className="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full bg-slate-800 border border-slate-600/35" />

              <div className="text-center">
                <span className="text-[9px] font-mono font-black text-slate-400 tracking-widest uppercase">
                  SECTION 02-B : FEEDERS
                </span>
              </div>

              {/* konveyor bawah (top), vibrator (bottom) */}
              <div className="flex flex-col items-center justify-around h-full gap-1 py-1">
                <RoundButton
                  label="konveyor bawah"
                  isActive={deviceStates.conveyorBottomActive}
                  isDisabled={mode !== "CONTROL" || deviceStates.isAuto}
                  onClick={() => sendToggleCommand('conveyorBottom')}
                />
                <RoundButton
                  label="vibrator"
                  isActive={deviceStates.vibratorActive}
                  isDisabled={mode !== "CONTROL" || deviceStates.isAuto}
                  onClick={() => sendToggleCommand('vibrator')}
                />
              </div>
            </div>

            {/* 7. CLUSTER LIQUID SYSTEM & DUMP SEMEN (Divided Left-Right) */}
            <div className="lg:col-span-4 bg-[#191e2b] rounded-md border-2 border-slate-700/60 p-2 h-[170px] flex flex-col justify-between relative shadow-inner">
              {/* Corner screws for HMI feel */}
              <div className="absolute top-0.5 left-0.5 w-1 h-1 rounded-full bg-slate-800 border border-slate-600/35" />
              <div className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-slate-800 border border-slate-600/35" />
              <div className="absolute bottom-0.5 left-0.5 w-1 h-1 rounded-full bg-slate-850 border border-slate-600/35" />
              <div className="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full bg-slate-805 border border-slate-600/35" />

              <div className="text-center">
                <span className="text-[9px] font-mono font-black text-slate-400 tracking-widest uppercase">
                  SECTION 02-C : AIR & DISCHARGE SEMEN
                </span>
              </div>

              <div className="flex items-stretch h-full mt-1">
                {/* Left of dotted: Air timbang, dump air side-by-side */}
                <div className="w-[66%] flex justify-around items-center pr-1.5">
                  <RoundButton
                    label="Air timbang"
                    isActive={deviceStates.valveWaterActive}
                    isDisabled={mode !== "CONTROL" || deviceStates.isAuto}
                    onClick={() => sendToggleCommand('valveIsiAir')}
                  />
                  <RoundButton
                    label="dump air"
                    isActive={deviceStates.gateWaterHopperOpen}
                    isDisabled={mode !== "CONTROL" || deviceStates.isAuto}
                    onClick={() => sendToggleCommand('dischargeAir')}
                  />
                </div>

                {/* Vertical Dotted Line Division */}
                <div className="border-l-2 border-dashed border-slate-600/50 self-stretch my-1.5 shrink-0" />

                {/* Right of dotted: dump semen lower down */}
                <div className="w-[33%] flex items-end justify-center pl-1.5 pb-2">
                  <RoundButton
                    label="dump semen"
                    isActive={deviceStates.gateSemenHopperOpen}
                    isDisabled={mode !== "CONTROL" || deviceStates.isAuto}
                    onClick={() => sendToggleCommand('dischargeSemen')}
                  />
                </div>
              </div>
            </div>

            {/* 8. CLUSTER MIXER CONTROL BLOCK */}
            <div className="lg:col-span-2 bg-[#191e2b] rounded-md border-2 border-slate-700/60 p-2 h-[170px] flex flex-col justify-between relative shadow-inner">
              {/* Corner screws for HMI feel */}
              <div className="absolute top-0.5 left-0.5 w-1 h-1 rounded-full bg-slate-805 border border-slate-600/35" />
              <div className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-slate-800 border border-slate-600/35" />
              <div className="absolute bottom-0.5 left-0.5 w-1 h-1 rounded-full bg-slate-800 border border-slate-600/35" />
              <div className="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full bg-slate-800 border border-slate-600/35" />

              <div className="text-center">
                <span className="text-[9px] font-mono font-black text-slate-400 tracking-widest uppercase">
                  SECTION 02-D : MIX UNIT
                </span>
              </div>

              <div className="flex flex-col justify-center flex-grow py-0.5 space-y-0.5">
                {/* Row 1: mixer normal green indicator, klakson amber warn button */}
                <div className="flex justify-around items-center">
                  <RoundButton
                    label="mixer"
                    isActive={deviceStates.mixerShaftActive}
                    isDisabled={mode !== "CONTROL" || deviceStates.isAuto}
                    onClick={() => sendToggleCommand('mixer')}
                  />
                  <RoundButton
                    label="klakson"
                    isActive={deviceStates.klaksonActive}
                    isDisabled={mode !== "CONTROL" || deviceStates.isAuto}
                    onClick={() => sendToggleCommand('klakson')}
                    colorType="amber"
                  />
                </div>

                {/* Row 2: pintu mix buka (green/ON), pintu mix tutup (red/CLOSED) */}
                <div className="flex justify-around items-center">
                  <RoundButton
                    label="pintu mix buka"
                    isActive={deviceStates.mixerDoorPercent > 0}
                    isDisabled={mode !== "CONTROL" || deviceStates.isAuto}
                    onClick={() => sendToggleCommand('mixerDischargeGate', true)}
                  />
                  <RoundButton
                    label="pintu mix tutup"
                    isActive={deviceStates.mixerDoorPercent === 0}
                    isDisabled={mode !== "CONTROL" || deviceStates.isAuto}
                    onClick={() => sendToggleCommand('mixerDischargeGate', false)}
                    colorType="red"
                  />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* PANEL KENDALI OTOMATIS BATCH (AUTOMATIC BATCH WIRELESS CONTROLLER) */}
        <div className="bg-[#121622] rounded-lg border border-slate-700/70 p-2.5 shadow-xl">
          <div className="flex items-center justify-between mb-2 border-b border-slate-75 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${deviceStates.isRunning ? "bg-emerald-400 animate-pulse border-emerald-300" : "bg-slate-500 border-slate-400"} border`} />
              <span className="text-[10.5px] font-mono font-extrabold text-cyan-400 tracking-wider">PANEL LAUNCHER BATCH OTOMATIS : CONTROL MODULE</span>
            </div>
            <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">[ AUTOMATIC REMOTE LAUNCHER ]</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-stretch">
            {/* Left/Center side: Monitoring block / telemetry */}
            <div className="lg:col-span-7 bg-[#0f131e] rounded-md border border-slate-800 p-2.5 flex flex-col justify-between min-h-[90px] relative shadow-inner">
              <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
                <span className="text-[8.5px] font-mono font-bold text-slate-400 uppercase tracking-wider">STATUS TEKNIS UTAMA</span>
                <span className={`text-[8.5px] font-mono font-black ${deviceStates.isRunning ? "text-emerald-400 animate-pulse" : "text-slate-500"} uppercase`}>
                  {deviceStates.isRunning ? `⚡ SEDANG JALAN (${deviceStates.productionState || "PROSES"})` : "● STANDBY / IDLE"}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-2 py-1.5 text-center mt-1">
                <div className="bg-[#141b29] border border-slate-800/60 p-1.5 rounded">
                  <span className="block text-[7px] text-slate-500 font-bold uppercase tracking-wider">MUTU AKTIF</span>
                  <span className="text-[10.5px] font-mono font-black text-cyan-400 truncate block">
                    {deviceStates.isRunning ? (deviceStates.activeRecipeName || "FORMULA") : "-"}
                  </span>
                </div>
                <div className="bg-[#141b29] border border-slate-800/60 p-1.5 rounded">
                  <span className="block text-[7px] text-slate-500 font-bold uppercase tracking-wider">VOLUME TARGET</span>
                  <span className="text-[10.5px] font-mono font-black text-emerald-400 block">
                    {deviceStates.isRunning ? `${deviceStates.activeVolume || "0"} M³` : "-"}
                  </span>
                </div>
                <div className="bg-[#141b29] border border-slate-800/60 p-1.5 rounded">
                  <span className="block text-[7px] text-slate-500 font-bold uppercase tracking-wider text-center">SIKLUS MIX</span>
                  <span className="text-[10.5px] font-mono font-black text-amber-400 block">
                    {deviceStates.isRunning ? `${deviceStates.activeMixingCount || "1"} MIX` : "-"}
                  </span>
                </div>
              </div>
            </div>

            {/* Right side: Input Control Panel — matching exactly the requested red box area! */}
            <div className="lg:col-span-5 bg-[#191e2b] rounded-md border-2 border-slate-700/60 p-2.5 min-h-[90px] flex flex-col justify-between relative shadow-inner">
              {/* Corner screws for physical HMI style */}
              <div className="absolute top-0.5 left-0.5 w-1 h-1 rounded-full bg-slate-850 border border-slate-650/40" />
              <div className="absolute top-0.5 right-0.5 w-1 h-1 rounded-full bg-slate-850 border border-slate-650/40" />
              <div className="absolute bottom-0.5 left-0.5 w-1 h-1 rounded-full bg-slate-850 border border-slate-650/40" />
              <div className="absolute bottom-0.5 right-0.5 w-1 h-1 rounded-full bg-slate-850 border border-slate-650/40" />

              <div className="grid grid-cols-3 gap-2 flex-grow items-center">
                {/* 1. Mutu Beton Dropdown */}
                <div className="flex flex-col space-y-1">
                  <label className="text-[7.5px] font-mono font-extrabold text-slate-400 uppercase tracking-widest text-center">
                    MUTU BETON
                  </label>
                  <select
                    disabled={mode !== "CONTROL" || deviceStates.isRunning}
                    value={selectedMutu}
                    onChange={(e) => setSelectedMutu(e.target.value)}
                    className="bg-[#0b101c] text-xs font-mono font-extrabold text-[#00ffd0] py-1 px-1 border border-slate-700 rounded focus:border-[#00ffd0] focus:outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {jobMixes.map((mix) => (
                      <option key={mix.id} value={mix.mutuBeton} className="bg-[#111622] text-slate-100 font-bold">
                        {mix.mutuBeton}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Volume Dropdown */}
                <div className="flex flex-col space-y-1">
                  <label className="text-[7.5px] font-mono font-extrabold text-slate-400 uppercase tracking-widest text-center">
                    VOLUME
                  </label>
                  <select
                    disabled={mode !== "CONTROL" || deviceStates.isRunning}
                    value={selectedVolume}
                    onChange={(e) => setSelectedVolume(Number(e.target.value))}
                    className="bg-[#0b101c] text-xs font-mono font-extrabold text-[#00ffd0] py-1 px-1 border border-slate-700 rounded focus:border-[#00ffd0] focus:outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {[1, 1.5, 2, 2.5, 3, 3.5].map((vol) => (
                      <option key={vol} value={vol} className="bg-[#111622] text-slate-100 font-bold">
                        {vol}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Jumlah Mix Dropdown */}
                <div className="flex flex-col space-y-1">
                  <label className="text-[7.5px] font-mono font-extrabold text-slate-400 uppercase tracking-widest text-center">
                    JUMLAH MIX
                  </label>
                  <select
                    disabled={mode !== "CONTROL" || deviceStates.isRunning}
                    value={selectedJumlahMix}
                    onChange={(e) => setSelectedJumlahMix(Number(e.target.value))}
                    className="bg-[#0b101c] text-xs font-mono font-extrabold text-[#00ffd0] py-1 px-1 border border-slate-700 rounded focus:border-[#00ffd0] focus:outline-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {[1, 2, 3].map((cycle) => (
                      <option key={cycle} value={cycle} className="bg-[#111622] text-slate-100 font-bold">
                        {cycle}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Start / Stop small action buttons */}
              <div className="flex items-center gap-2.5 mt-2.5 pt-1.5 border-t border-slate-800">
                <button
                  disabled={mode !== "CONTROL" || deviceStates.isRunning}
                  onClick={handleRemoteStartBatch}
                  className={`flex-grow py-1 rounded text-[10px] font-sans font-black uppercase tracking-widest border transition-all cursor-pointer active:scale-95 disabled:scale-100 disabled:opacity-30 disabled:cursor-not-allowed text-center flex items-center justify-center gap-1.5
                    ${!deviceStates.isRunning && mode === "CONTROL"
                      ? "bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white shadow-[0_2px_4px_rgba(16,185,129,0.2)]"
                      : "bg-[#1a202d] border-slate-800 text-slate-500"
                    }
                  `}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${!deviceStates.isRunning && mode === "CONTROL" ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
                  START
                </button>
                <button
                  disabled={mode !== "CONTROL" || !deviceStates.isRunning}
                  onClick={handleRemoteStopBatch}
                  className={`flex-grow py-1 rounded text-[10px] font-sans font-black uppercase tracking-widest border transition-all cursor-pointer active:scale-95 disabled:scale-100 disabled:opacity-30 disabled:cursor-not-allowed text-center flex items-center justify-center gap-1.5
                    ${deviceStates.isRunning && mode === "CONTROL"
                      ? "bg-rose-600 hover:bg-rose-500 border-rose-500 text-white shadow-[0_2px_4px_rgba(239,68,68,0.2)]"
                      : "bg-[#1a202d] border-slate-800 text-slate-500"
                    }
                  `}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${deviceStates.isRunning && mode === "CONTROL" ? "bg-rose-400 animate-pulse" : "bg-slate-500"}`} />
                  STOP
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer copyright label */}
      <footer className="h-[36px] bg-[#1a2235] border-t border-slate-800 flex items-center justify-between px-6 text-[8px] font-mono text-slate-500 uppercase shrink-0">
        <span>GATEWAY ROUTER: LOCAL WIRELESS AP</span>
        <span>LISA PLANT CONTROL SYSTEM v3.4</span>
      </footer>

      {/* LOCK / PIN MODAL COMPONENT */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#1a2235] border border-slate-800 w-full max-w-sm rounded-[6px] shadow-2xl p-6 space-y-4">
            
            <div className="text-center space-y-2">
              <div className="mx-auto w-10 h-10 bg-slate-900/60 border border-slate-805 rounded-full flex items-center justify-center text-cyan-400">
                <Lock size={18} />
              </div>
              <h3 className="text-sm font-sans font-black text-slate-100 uppercase tracking-widest">
                VERIVIKASI PIN OPERATOR
              </h3>
              <p className="text-[10px] font-mono text-slate-400 uppercase">
                Masukkan PIN manual untuk memisahkan mode monitoring & mengaktifkan kendali relai.
              </p>
            </div>

            {pinError && (
              <div className="p-2.5 bg-rose-950/30 border border-rose-900/70 text-[10px] font-mono text-rose-400 rounded text-center font-bold uppercase">
                {pinError}
              </div>
            )}

            <div className="space-y-1.5 text-left font-sans">
              <label className="text-[10.5px] font-extrabold text-cyan-400 tracking-wider">MASUKKAN PIN TABLET</label>
              <input
                type="password"
                maxLength={8}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="****"
                className="w-full text-center bg-[#0d121f] text-[#00ffd0] tracking-[1em] text-xl font-bold py-2 border border-slate-800 rounded focus:border-[#00ffd0] focus:outline-none outline-none font-mono placeholder:tracking-normal placeholder:text-slate-700"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handlePinSubmit();
                }}
              />
            </div>

            <div className="flex gap-2 font-mono pt-2">
              <button
                onClick={() => {
                  setShowPinModal(false);
                  setPinInput("");
                  setPinError(null);
                }}
                className="w-1/2 py-2 bg-slate-800 hover:bg-slate-750 text-slate-350 hover:text-white rounded text-[10.5px] font-bold uppercase transition-all"
              >
                Batal
              </button>
              <button
                onClick={handlePinSubmit}
                className="w-1/2 py-2 bg-[#00ffd0] hover:bg-[#00e5ff] text-black rounded text-[10.5px] font-black uppercase transition-all shadow-md"
              >
                Konfirmasi
              </button>
            </div>
            
            <div className="text-center">
              <span className="text-[7.5px] font-mono text-slate-500 uppercase">
                DEFAULT PIN SEED: 1234 atau 8888
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Connection Lost Off-Air Screen */}
      {!isOnline && (
        <div className="absolute inset-0 bg-[#0c0f17]/95 z-50 flex flex-col items-center justify-center p-6 text-center animate-fade-in select-none">
          <div className="bg-rose-950/20 border-2 border-rose-600/30 p-8 rounded-2xl max-w-sm shadow-[0_0_50px_rgba(225,29,72,0.15)] flex flex-col items-center gap-5 relative overflow-hidden backdrop-blur-md">
            {/* Glowing accents */}
            <div className="absolute -top-12 -left-12 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl" />
            <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl" />
            
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-rose-500/10 animate-ping" />
              <div className="p-3 bg-rose-900/20 border border-rose-500/30 rounded-full text-rose-500 relative">
                <WifiOff size={36} className="animate-pulse" />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <h2 className="text-base font-black tracking-wider text-rose-400 font-mono uppercase">
                Koneksi ke HMI Terputus
              </h2>
              <p className="text-[10px] text-slate-405 font-sans font-medium leading-relaxed max-w-xs">
                Gagal tersambung ke Terminal Lisa Batch Plant HMI Utama. Hubungkan tablet ke jaringan Wi-Fi lokal yang sama dengan komputer server HMI.
              </p>
            </div>

            <div className="flex items-center gap-2 justify-center py-1.5 px-3 rounded bg-slate-900 border border-slate-800 text-[8.5px] font-mono text-cyan-400 font-bold tracking-wider animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              MENCOBA REKONEKSI...
            </div>
            
            <p className="text-[7.5px] text-slate-550 font-mono leading-none">
              WiFi Endpoint: ws://{window.location.hostname || "localhost"}:3001
            </p>
          </div>
        </div>
      )}

    </div>
  );
};
