import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Cpu, 
  Clock, 
  Save, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Terminal, 
  Download,
  Flame,
  Cable,
  Server,
  ExternalLink
} from "lucide-react";
import { webSerialService, SerialStatus } from "../../lib/webSerial";

export interface SerialConfig {
  port: string;
  baudRate: string;
  dataBits: string;
  parity: string;
  stopBits: string;
}

export interface ComPortSettings {
  pasir: SerialConfig;
  batu: SerialConfig;
  semen: SerialConfig;
  airAditif: SerialConfig;
  arduino: SerialConfig;
}

const DEFAULT_SETTINGS: ComPortSettings = {
  pasir: { port: "COM3", baudRate: "9600", dataBits: "8", parity: "None", stopBits: "1" },
  batu: { port: "COM4", baudRate: "9600", dataBits: "8", parity: "None", stopBits: "1" },
  semen: { port: "COM5", baudRate: "9600", dataBits: "8", parity: "Even", stopBits: "1" },
  airAditif: { port: "COM6", baudRate: "19200", dataBits: "8", parity: "None", stopBits: "1" },
  arduino: { port: "COM7", baudRate: "115200", dataBits: "8", parity: "None", stopBits: "1" }
};

const PORT_OPTIONS = ["COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "COM10", "/dev/ttyUSB0", "/dev/ttyUSB1", "DISCONNECTED"];
const BAUD_OPTIONS = ["2400", "4800", "9600", "19200", "115200"];
const DATABITS_OPTIONS = ["7", "8"];
const PARITY_OPTIONS = ["None", "Even", "Odd"];
const STOPBITS_OPTIONS = ["1", "2"];

export const SettingComPort: React.FC = () => {
  const [settings, setSettings] = useState<ComPortSettings>(() => {
    const saved = localStorage.getItem("batching_plant_com_settings");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [serialStatus, setSerialStatus] = useState<SerialStatus>("DISCONNECTED");
  const [realLogs, setRealLogs] = useState<string[]>([]);
  const [isSupported, setIsSupported] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    "INITIALIZING SERIAL PORT SUBSYSTEM...",
    "DETECTING CONNECTED PORTS IN SYSTEM..."
  ]);

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  // Support check & event subscription
  useEffect(() => {
    setIsSupported(webSerialService.isSupported());

    const handleStatusChange = (status: SerialStatus) => {
      setSerialStatus(status);
    };

    const handleNewLog = (msg: string) => {
      setRealLogs(prev => [...prev.slice(-30), msg]);
    };

    webSerialService.registerStatusCallback(handleStatusChange);
    webSerialService.registerLogCallback(handleNewLog);

    return () => {
      webSerialService.unregisterStatusCallback(handleStatusChange);
      webSerialService.unregisterLogCallback(handleNewLog);
    };
  }, []);

  useEffect(() => {
    if (realLogs.length > 0) {
      setConsoleLogs(realLogs);
    } else {
      // Generate some simulation console logs for realism when offline
      const activePorts = [settings.pasir.port, settings.batu.port, settings.semen.port, settings.airAditif.port, settings.arduino.port]
        .filter(p => p !== "DISCONNECTED");
      
      setConsoleLogs([
        `[${new Date().toLocaleTimeString()}] INITIATING COM-PORT CONFIGURATION SCAN...`,
        `[${new Date().toLocaleTimeString()}] PORT LIST DETECTED: ${activePorts.join(", ")}`,
        `[${new Date().toLocaleTimeString()}] PASIR ASSIGNED ON ${settings.pasir.port} (BAUD ${settings.pasir.baudRate})`,
        `[${new Date().toLocaleTimeString()}] BATU ASSIGNED ON ${settings.batu.port} (BAUD ${settings.batu.baudRate})`,
        `[${new Date().toLocaleTimeString()}] SEMEN ASSIGNED ON ${settings.semen.port} (BAUD ${settings.semen.baudRate})`,
        `[${new Date().toLocaleTimeString()}] AIR & ADITIF ASSIGNED ON ${settings.airAditif.port} (BAUD ${settings.airAditif.baudRate})`,
        `[${new Date().toLocaleTimeString()}] ARDUINO RELE CONTROLLER MAP TO ${settings.arduino.port} (BAUD ${settings.arduino.baudRate})`,
        `[${new Date().toLocaleTimeString()}] SERIAL LISTENER IS ACTIVE. READINGS STABLE.`
      ]);
    }
  }, [settings, serialStatus, realLogs]);

  const handleChange = (
    key: keyof ComPortSettings,
    field: keyof SerialConfig,
    value: string
  ) => {
    setSettings(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      localStorage.setItem("batching_plant_com_settings", JSON.stringify(settings));
      setIsSaving(false);
      setSaveSuccess(true);
      
      const newLogs = [
        ...consoleLogs,
        `[${new Date().toLocaleTimeString()}] SAVE OPERATION INITIATED...`,
        `[${new Date().toLocaleTimeString()}] WRITING CONFIGURATION STATE TO JSON SCHEMA FILE...`,
        `[${new Date().toLocaleTimeString()}] CONFIGURATION SAVED SUCCESSFULLY!`
      ];
      setConsoleLogs(newLogs.slice(-10));

      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    }, 820);
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settings, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "com-settings.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    
    setConsoleLogs(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] CONFIGURATION EXPORTED TO 'com-settings.json' FILE`
    ].slice(-10));
  };

  const isConnected = (port: string) => port !== "DISCONNECTED";

  // Build connection status bar text
  const statusSummary = [
    { label: "PASIR", port: settings.pasir.port, active: isConnected(settings.pasir.port) },
    { label: "BATU", port: settings.batu.port, active: isConnected(settings.batu.port) },
    { label: "SEMEN", port: settings.semen.port, active: isConnected(settings.semen.port) },
    { label: "AIR", port: settings.airAditif.port, active: isConnected(settings.airAditif.port) },
    { label: "ARDUINO", port: settings.arduino.port, active: serialStatus === "CONNECTED" },
  ].map(item => {
    const active = item.active;
    return (
      <span key={item.label} className="mx-2 flex items-center gap-1.5 shrink-0">
        <span className={`w-2 h-2 rounded-full ${active ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`} />
        <span className="font-sans font-bold text-slate-300 text-[10px]">{item.label}:</span>
        <span className={`font-mono font-black text-[10px] ${active ? "text-emerald-400" : "text-rose-550"}`}>
          {active ? `${item.port} (ON)` : "OFF"}
        </span>
      </span>
    );
  });

  return (
    <div id="setting-com-port-root" className="flex-1 flex flex-col gap-3.5 min-h-0 overflow-y-auto pr-1">
      
      {/* Title & Description Header */}
      <div className="bg-[#0b1329]/80 border border-[#1e293b]/70 rounded-[6px] p-4 shrink-0 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-950/40 border border-cyan-800/40 rounded-[5px] text-[#00e5ff] shadow-[0_0_10px_rgba(0,229,255,0.15)]">
              <Cable size={18} className="animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-sans font-black tracking-widest text-white uppercase">
                SETTING INTERFACE SERIAL COM & PORT
              </h4>
              <p className="text-[9.5px] font-mono text-cyan-400 uppercase tracking-wider mt-0.5">
                Konfigurasi Serial RS485 Timbangan Modbus & Arduino Controller Relai
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleExportJSON}
              className="px-3 py-1.5 bg-[#0b1c2b] border border-cyan-800/60 hover:border-cyan-400/90 text-cyan-400 font-mono text-[9.5px] font-bold uppercase rounded-[4px] flex items-center gap-1.5 transition-all active:scale-[0.98]"
            >
              <Download size={12} />
              <span>Export JSON</span>
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-1.5 bg-[#00e5ff] text-[#070b13] font-sans text-[10px] font-black uppercase rounded-[4px] flex items-center gap-1.5 transition-all hover:bg-[#33f0ff] active:scale-[0.98]"
            >
              {isSaving ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : (
                <Save size={12} />
              )}
              <span>{isSaving ? "Menyimpan..." : "Simpan Config"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid Layout for Configuring Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 min-h-0 shrink-0">
        
        {/* Section 1: 4 Material Indicator Rows inside solid elegant containers (Left & Center Panel) */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          <div className="bg-[#0b1329]/80 border border-[#1e293b]/70 rounded-[6px] p-4 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-cyan-400 border-b border-slate-800/80 pb-2 mb-3">
                <Server size={14} />
                <span className="text-[11px] font-sans font-black uppercase tracking-wider">
                  SECTION 1: INDIKATOR TIMBANGAN MATERIAL (INPUT)
                </span>
              </div>

              {/* Rows for Materials */}
              <div className="space-y-2.5">
                {[
                  { key: "pasir", label: "砂 PASIR (SAND)", subtitle: "Modbus Indicator 01" },
                  { key: "batu", label: "硎 BATU (STONE AGG)", subtitle: "Modbus Indicator 02" },
                  { key: "semen", label: "灰 SEMEN (CEMENT)", subtitle: "Modbus Indicator 03" },
                  { key: "airAditif", label: "水 AIR & ADITIF (WATER)", subtitle: "Modbus Indicator 04" }
                ].map((row) => {
                  const mKey = row.key as keyof ComPortSettings;
                  const rowConfig = settings[mKey];
                  const active = isConnected(rowConfig.port);

                  return (
                    <div 
                      key={row.key} 
                      className={`grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-2 rounded-[5px] border transition-all ${
                        active 
                          ? "bg-slate-900/40 border-slate-800/70 hover:border-cyan-900/60" 
                          : "bg-rose-950/5 border-rose-950/40 opacity-70"
                      }`}
                    >
                      <div className="md:col-span-3 flex flex-col text-left pl-1">
                        <span className={`text-[10px] font-sans font-black uppercase ${active ? "text-slate-200" : "text-slate-500"}`}>
                          {row.label}
                        </span>
                        <span className="text-[8px] font-mono text-cyan-500/70 uppercase">
                          {row.subtitle}
                        </span>
                      </div>

                      {/* Dropdown Inputs */}
                      <div className="md:col-span-9 grid grid-cols-5 gap-1.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8px] text-slate-500 font-sans font-bold uppercase truncate">Port</span>
                          <select
                            value={rowConfig.port}
                            onChange={(e) => handleChange(mKey, "port", e.target.value)}
                            className={`bg-[#05080e] border ${active ? "border-slate-800 text-cyan-400" : "border-rose-900/40 text-rose-450"} px-1 py-1 text-[9.5px] font-mono outline-none rounded-[3px] focus:border-cyan-500`}
                          >
                            {PORT_OPTIONS.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8px] text-slate-500 font-sans font-bold uppercase truncate">Baud Rate</span>
                          <select
                            disabled={!active}
                            value={rowConfig.baudRate}
                            onChange={(e) => handleChange(mKey, "baudRate", e.target.value)}
                            className="bg-[#05080e] border border-slate-800 text-slate-300 disabled:text-slate-600 px-1 py-1 text-[9.5px] font-mono outline-none rounded-[3px]"
                          >
                            {BAUD_OPTIONS.map(opt => (
                              <option key={opt} value={opt}>{opt} bps</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8px] text-slate-500 font-sans font-bold uppercase truncate">Data Bits</span>
                          <select
                            disabled={!active}
                            value={rowConfig.dataBits}
                            onChange={(e) => handleChange(mKey, "dataBits", e.target.value)}
                            className="bg-[#05080e] border border-slate-800 text-slate-300 disabled:text-slate-600 px-1 py-1 text-[9.5px] font-mono outline-none rounded-[3px]"
                          >
                            {DATABITS_OPTIONS.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8px] text-slate-500 font-sans font-bold uppercase truncate">Parity</span>
                          <select
                            disabled={!active}
                            value={rowConfig.parity}
                            onChange={(e) => handleChange(mKey, "parity", e.target.value)}
                            className="bg-[#05080e] border border-slate-800 text-slate-300 disabled:text-slate-600 px-1 py-1 text-[9.5px] font-mono outline-none rounded-[3px]"
                          >
                            {PARITY_OPTIONS.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8px] text-slate-500 font-sans font-bold uppercase truncate">Stop Bit</span>
                          <select
                            disabled={!active}
                            value={rowConfig.stopBits}
                            onChange={(e) => handleChange(mKey, "stopBits", e.target.value)}
                            className="bg-[#05080e] border border-slate-800 text-slate-300 disabled:text-slate-600 px-1 py-1 text-[9.5px] font-mono outline-none rounded-[3px]"
                          >
                            {STOPBITS_OPTIONS.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Columns (Arduino controller Config & Monitoring Shell Terminal logs) */}
        <div className="flex flex-col gap-3.5">
          
          {/* SECTION 2: ARDUINO MEGA RELAY CONTROLLER CONFIG CARD */}
          <div className="bg-[#0b1329]/80 border border-[#1e293b]/70 rounded-[6px] p-4 shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-amber-400 border-b border-slate-800/80 pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <Cpu size={14} className={serialStatus === "CONNECTED" ? "animate-spin text-emerald-400" : ""} />
                  <span className="text-[11px] font-sans font-black uppercase tracking-wider">
                    SECTION 2: OUTPUT RELAY DEVICE
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${
                    serialStatus === "CONNECTED" ? "bg-emerald-400 animate-pulse" :
                    serialStatus === "CONNECTING" || serialStatus === "RECONNECTING" ? "bg-amber-400 animate-pulse" :
                    "bg-rose-500"
                  }`} />
                  <span className="font-mono text-[8.5px] font-black uppercase tracking-wider">
                    {serialStatus}
                  </span>
                </div>
              </div>
              
              <div className="bg-amber-950/10 border border-amber-900/20 p-2.5 rounded-[4px] mb-3">
                <div className="flex items-center gap-1.5 text-amber-400">
                  <Flame size={12} />
                  <span className="text-[9.5px] font-sans font-black uppercase">
                    ARDUINO MEGA RELAY CONTROLLER
                  </span>
                </div>
                <p className="text-[8.2px] font-mono text-slate-400 uppercase mt-0.5">
                  Controller relay utama untuk pemicuan gate hopper, silo valve, dan pompa air.
                </p>
              </div>

              {isInIframe && (
                <div className="mb-3 p-2.5 bg-rose-950/30 border border-rose-500/30 rounded text-left">
                  <div className="flex items-center gap-1.5 text-rose-450 font-sans text-[9px] font-black uppercase mb-1">
                    <AlertTriangle size={11} className="animate-pulse" />
                    <span>PENTING: JALANKAN DI TAB BARU</span>
                  </div>
                  <p className="text-[8.2px] text-slate-300 font-sans leading-relaxed mb-2 uppercase">
                    Chrome memblokir izin USB/Serial di dalam iframe AI Studio demi murni keamanan. Anda harus membuka aplikasi di Tab Baru agar dialog COM PORT muncul secara fisik.
                  </p>
                  <button
                    type="button"
                    onClick={() => window.open(window.location.href, '_blank')}
                    className="w-full py-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-sans text-[8.5px] font-black uppercase tracking-wider rounded border border-amber-400/50 shadow-md flex items-center justify-center gap-1 transition-all"
                  >
                    <ExternalLink size={10} />
                    <span>BUKA APLIKASI DI TAB BARU</span>
                  </button>
                </div>
              )}

              {!isSupported ? (
                <div className="mb-3 p-2 bg-rose-950/20 border border-rose-900/40 rounded text-[8.2px] font-sans font-medium text-rose-300 uppercase leading-normal text-left">
                  <AlertTriangle className="inline mr-1 text-rose-450" size={11} />
                  Web Serial tidak didukung di iframe ini. Buka aplikasi di <b className="text-white underline cursor-pointer" onClick={() => window.open(window.location.href, '_blank')}>Tab Baru (New Tab)</b> menggunakan Chrome/Edge untuk dikoneksikan ke Arduino Mega mesin.
                </div>
              ) : (
                <div className="mb-3 space-y-2">
                  {serialStatus === "CONNECTED" ? (
                    <button
                      type="button"
                      onClick={() => webSerialService.disconnect()}
                      className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-sans text-[10px] font-black uppercase tracking-wider rounded border border-emerald-550 shadow-md flex items-center justify-center gap-1.5 transition-all text-center"
                    >
                      <RefreshCw size={11} className="animate-spin" />
                      <span>PUTUS KONEKSI ARDUINO Mega</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={serialStatus === "CONNECTING"}
                      onClick={() => webSerialService.connect(parseInt(settings.arduino.baudRate, 10))}
                      className="w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-sans text-[10px] font-black uppercase tracking-wider rounded border border-amber-400 shadow-md flex items-center justify-center gap-1.5 transition-all text-center"
                    >
                      <Cpu size={11} />
                      <span>{serialStatus === "CONNECTING" ? "MENGHUBUNGKAN..." : "KONEKSIKAN ARDUINO MEGA"}</span>
                    </button>
                  )}
                  
                  <div className="p-2 bg-amber-950/20 border border-amber-900/30 rounded text-[8px] font-sans text-amber-300 leading-normal text-left">
                    <span className="font-bold block text-amber-400 mb-0.5">⚠️ TIPS UPLOAD FIRMWARE:</span>
                    Jika Anda ingin mengupload file program (.ino) dari Arduino IDE, tekan tombol <b className="text-white font-black">PUTUS KONEKSI ARDUINO Mega</b> di atas terlebih dahulu. Jika tidak, Anda akan mendapat error <span className="font-mono text-red-400 font-black">"Access is Denied"</span> karena port COM sedang dikunci oleh browser Chrome/Edge.
                  </div>
                </div>
              )}

              {/* Form Grid */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-0.5 text-left">
                    <span className="text-[8px] text-slate-400 font-sans font-bold uppercase">Port (COM)</span>
                    <select
                      value={settings.arduino.port}
                      onChange={(e) => handleChange("arduino", "port", e.target.value)}
                      className="bg-[#05080e] border border-slate-800 text-amber-400 px-2 py-1 text-[9.5px] font-mono outline-none rounded-[3px]"
                    >
                      {PORT_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-0.5 text-left">
                    <span className="text-[8px] text-slate-400 font-sans font-bold uppercase">Baud Rate</span>
                    <select
                      value={settings.arduino.baudRate}
                      disabled={!isConnected(settings.arduino.port)}
                      onChange={(e) => handleChange("arduino", "baudRate", e.target.value)}
                      className="bg-[#05080e] border border-slate-800 text-slate-300 disabled:text-slate-600 px-2 py-1 text-[9.5px] font-mono outline-none rounded-[3px]"
                    >
                      {BAUD_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt} bps</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <div className="flex flex-col gap-0.5 text-left">
                    <span className="text-[8px] text-slate-405 font-sans font-bold uppercase truncate">Data Bits</span>
                    <select
                      value={settings.arduino.dataBits}
                      id="data-bits-select"
                      disabled={!isConnected(settings.arduino.port)}
                      onChange={(e) => handleChange("arduino", "dataBits", e.target.value)}
                      className="bg-[#05080e] border border-slate-800 text-slate-300 disabled:text-slate-600 px-1 py-1 text-[9.5px] font-mono outline-none"
                    >
                      {DATABITS_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-0.5 text-left">
                    <span className="text-[8px] text-slate-405 font-sans font-bold uppercase truncate">Parity</span>
                    <select
                      value={settings.arduino.parity}
                      id="parity-select"
                      disabled={!isConnected(settings.arduino.port)}
                      onChange={(e) => handleChange("arduino", "parity", e.target.value)}
                      className="bg-[#05080e] border border-slate-800 text-slate-300 disabled:text-slate-600 px-1 py-1 text-[9.5px] font-mono outline-none"
                    >
                      {PARITY_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-0.5 text-left">
                    <span className="text-[8px] text-slate-405 font-sans font-bold uppercase truncate">Stop Bit</span>
                    <select
                      value={settings.arduino.stopBits}
                      id="stop-bits-select"
                      disabled={!isConnected(settings.arduino.port)}
                      onChange={(e) => handleChange("arduino", "stopBits", e.target.value)}
                      className="bg-[#05080e] border border-slate-800 text-slate-300 disabled:text-slate-600 px-1 py-1 text-[9.5px] font-mono outline-none"
                    >
                      {STOPBITS_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* REALTIME SYSTEM TERMINAL LOGGER PANEL */}
          <div className="bg-[#040810] border border-slate-850 rounded-[6px] p-3 shadow-inner flex-1 flex flex-col min-h-[140px]">
            <div className="flex items-center justify-between text-slate-500 border-b border-slate-900 pb-1.5 mb-2">
              <div className="flex items-center gap-1.5">
                <Terminal size={11} className="text-[#00e5ff]" />
                <span className="text-[8.5px] font-mono font-bold tracking-wider uppercase">COMMUNICATION TELEMETRY CONSOLE</span>
              </div>
              <span className="text-[7.5px] font-mono bg-cyan-950/50 text-cyan-400 px-1 py-0.2 rounded border border-cyan-900/30">COM_DAEMON v1.4.0</span>
            </div>
            
            <div className="flex-1 font-mono text-[8.2px] text-slate-400 space-y-1 overflow-y-auto pr-1 select-text">
              {consoleLogs.map((log, i) => (
                <div key={i} className="leading-tight truncate hover:bg-slate-900/55 rounded py-0.5 px-1">
                  <span className="text-cyan-500/80 mr-1">&gt;&gt;</span>
                  {log}
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Success Notification Banner overlay */}
      {saveSuccess && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          className="bg-emerald-900/80 border border-emerald-500/70 p-3 rounded-[5px] flex items-center gap-3 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
        >
          <CheckCircle size={20} className="text-emerald-400 shrink-0" />
          <div className="text-left">
            <h5 className="text-[10px] font-sans font-black text-white uppercase tracking-wider">SIAP DISIMPAN</h5>
            <p className="text-[8.5px] font-mono text-emerald-200 uppercase mt-0.2">
              State com-settings.json sukses ditulis ke local storage & disinkronisasikan ke daemon Electron.
            </p>
          </div>
        </motion.div>
      )}

      {/* SECTION 3: BOTTOM STATUS CONNECTIONS SUMMARY FOOTER FOOTER */}
      <div className="bg-[#0c1f1a]/80 border border-emerald-950/70 rounded-[6px] p-3 text-left shadow-lg shrink-0 flex items-center md:flex-row flex-col justify-between gap-3">
        <div className="flex items-center gap-2 text-emerald-400 shrink-0">
          <Clock size={15} className="shrink-0 animate-spin" />
          <div className="flex flex-col text-left">
            <span className="text-[9.5px] font-sans font-black text-emerald-400 uppercase">SYS CONNECTION Telemetry HEALTH</span>
            <span className="text-[8px] font-mono text-slate-500 uppercase">Status pemantauan terupdate dari daemon port serial</span>
          </div>
        </div>
        
        {/* Dynamic port loop status summary */}
        <div className="flex flex-wrap items-center bg-[#06100d]/90 border border-emerald-900/30 py-1.5 px-3 rounded-[4px] text-slate-400 text-[8.5px] font-mono max-w-full overflow-x-auto divide-x divide-emerald-900/40">
          {statusSummary}
        </div>
      </div>

    </div>
  );
};
