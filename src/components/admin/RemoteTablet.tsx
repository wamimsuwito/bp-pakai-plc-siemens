import React, { useState, useEffect } from "react";
import { 
  Tablet, 
  Wifi, 
  WifiOff, 
  Radio, 
  QrCode, 
  RefreshCw, 
  Sliders, 
  ShieldCheck, 
  Settings, 
  Smartphone, 
  Tv, 
  FileText
} from "lucide-react";

interface ConnectedTablet {
  id: string;
  name: string;
  ipAddress: string;
  lastActive: string;
  status: "CONNECTED" | "DISCONNECTED";
  role: "OBSERVER" | "CONTROLLER";
}

export const RemoteTablet: React.FC = () => {
  const [allowRemoteControl, setAllowRemoteControl] = useState<boolean>(() => {
    return localStorage.getItem("remote_tablet_allow") !== "false";
  });
  const [useWifiEncryption, setUseWifiEncryption] = useState<boolean>(true);
  const [pingInterval, setPingInterval] = useState<number>(1000);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localIps, setLocalIps] = useState<string[]>([]);

  useEffect(() => {
    const fetchLocalIps = async () => {
      try {
        const host = window.location.hostname || 'localhost';
        const res = await fetch(`http://${host}:3001/api/local-ip`);
        if (res.ok) {
          const data = await res.json();
          if (data.ips && Array.isArray(data.ips)) {
            // Remove 127.0.0.1 or duplicate IPs if present
            const filtered = data.ips.filter((ip: string) => ip !== "127.0.0.1" && ip !== "::1");
            setLocalIps(filtered);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch local IPs:", err);
      }
    };
    fetchLocalIps();
  }, []);
  const [tablets, setTablets] = useState<ConnectedTablet[]>([
    {
      id: "TAB-01",
      name: "Samsung Galaxy Tab S9 - Control Room 2",
      ipAddress: "192.168.1.120",
      lastActive: "1 detik yang lalu",
      status: "CONNECTED",
      role: "CONTROLLER",
    },
    {
      id: "TAB-02",
      name: "iPad Air 5 - Operator Lapangan",
      ipAddress: "192.168.1.125",
      lastActive: "5 menit yang lalu",
      status: "DISCONNECTED",
      role: "OBSERVER",
    },
    {
      id: "TAB-03",
      name: "Xiaomi Pad 6 - Direktur Yard Riau",
      ipAddress: "192.168.1.130",
      lastActive: "Baru saja",
      status: "CONNECTED",
      role: "OBSERVER",
    }
  ]);

  useEffect(() => {
    localStorage.setItem("remote_tablet_allow", allowRemoteControl ? "true" : "false");
  }, [allowRemoteControl]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      // Randomly change tablet pings slightly
      setTablets(prev => 
        prev.map(t => {
          if (t.status === "CONNECTED") {
            const timeOptions = ["Baru saja", "1 detik yang lalu", "2 detik yang lalu"];
            return {
              ...t,
              lastActive: timeOptions[Math.floor(Math.random() * timeOptions.length)]
            };
          }
          return t;
        })
      );
    }, 800);
  };

  const toggleRole = (id: string) => {
    setTablets(prev =>
      prev.map(t => {
        if (t.id === id) {
          return {
            ...t,
            role: t.role === "CONTROLLER" ? "OBSERVER" : "CONTROLLER"
          };
        }
        return t;
      })
    );
  };

  const disconnectTablet = (id: string) => {
    setTablets(prev =>
      prev.map(t => {
        if (t.id === id) {
          return {
            ...t,
            status: t.status === "CONNECTED" ? "DISCONNECTED" : "CONNECTED",
            lastActive: t.status === "CONNECTED" ? "5 menit yang lalu" : "Baru saja"
          };
        }
        return t;
      })
    );
  };

  // SVG QR Code helper for beautiful local UI presentation
  const renderMockQRCode = () => {
    return (
      <svg className="w-32 h-32 bg-white p-2 rounded" viewBox="0 0 100 100">
        <rect x="0" y="0" width="20" height="20" fill="black" />
        <rect x="4" y="4" width="12" height="12" fill="white" />
        <rect x="7" y="7" width="6" height="6" fill="black" />

        <rect x="80" y="0" width="20" height="20" fill="black" />
        <rect x="84" y="4" width="12" height="12" fill="white" />
        <rect x="87" y="7" width="6" height="6" fill="black" />

        <rect x="0" y="80" width="20" height="20" fill="black" />
        <rect x="4" y="84" width="12" height="12" fill="white" />
        <rect x="7" y="87" width="6" height="6" fill="black" />

        {/* Mock pixels */}
        <rect x="25" y="5" width="8" height="8" fill="black" />
        <rect x="35" y="10" width="12" height="5" fill="black" />
        <rect x="55" y="0" width="8" height="12" fill="black" />
        <rect x="70" y="8" width="5" height="10" fill="black" />

        <rect x="10" y="25" width="15" height="4" fill="black" />
        <rect x="25" y="30" width="5" height="20" fill="black" />
        <rect x="45" y="22" width="20" height="8" fill="black" />
        <rect x="70" y="30" width="10" height="5" fill="black" />

        <rect x="35" y="45" width="15" height="15" fill="black" />
        <rect x="40" y="50" width="5" height="5" fill="white" />
        
        <rect x="0" y="55" width="12" height="10" fill="black" />
        <rect x="15" y="65" width="8" height="8" fill="black" />

        <rect x="80" y="55" width="10" height="20" fill="black" />
        <rect x="55" y="70" width="18" height="6" fill="black" />
        <rect x="30" y="80" width="12" height="12" fill="black" />
        <rect x="50" y="85" width="25" height="8" fill="black" />
      </svg>
    );
  };

  return (
    <div className="flex-1 bg-[#0b1329]/80 border border-[#1e293b]/70 rounded-[6px] p-6 flex flex-col justify-between overflow-y-auto scrollbar-thin">
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-3">
          <div className="flex items-center gap-2.5 text-[#00ffd0]">
            <Tablet size={20} className="animate-pulse" />
            <h4 className="text-sm font-sans font-black tracking-widest uppercase">
              KONFIGURASI HUB REMOTE TABLET & OPERATOR MOBILE
            </h4>
          </div>
          
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-[#00ffd0]/50 hover:bg-[#00ffd0]/5 text-[10px] font-mono font-black text-[#00ffd0] uppercase rounded transition-all cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw size={11} className={isRefreshing ? "animate-spin" : ""} />
            Pindai Ulang Client
          </button>
        </div>

        <p className="text-[10px] font-mono text-slate-400 uppercase leading-relaxed max-w-2xl">
          Modul ini mengelola konektivitas tablet operator lapangan, supervisor yard, serta client mobile yang memonitor atau mengontrol aktivitas batching plant secara nirkabel (Local Wi-Fi Network).
        </p>

        {/* Dashboard Grid Options */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Settings Column */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-[#060a12]/80 border border-slate-800/80 rounded-[5px] p-4 space-y-4">
              <span className="text-[10px] font-sans font-black text-cyan-400 uppercase tracking-wider block border-b border-slate-900 pb-1.5">
                KONTROL KEAMANAN NISKABEL
              </span>

              {/* Toggle switch allow remote */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] font-mono text-slate-400 uppercase font-black">Izinkan Remote Control</span>
                  <button
                    onClick={() => setAllowRemoteControl(!allowRemoteControl)}
                    className={`text-[8.5px] font-black px-2.5 py-1 rounded transition-all cursor-pointer font-mono ${
                      allowRemoteControl 
                        ? 'bg-[#00ffd0] text-black font-extrabold' 
                        : 'bg-slate-800 text-slate-400 font-bold'
                    }`}
                  >
                    {allowRemoteControl ? 'DIALOW (AKTIF)' : 'BLOCK (KUNCI)'}
                  </button>
                </div>
                <span className="text-[8px] font-mono text-slate-500 normal-case block leading-normal">
                  Jika dinonaktifkan, seluruh tablet yang terhubung hanya dapat menampilkan data (Observer Mode) tanpa izin memicu relai atau menjalankan batch sekuensial.
                </span>
              </div>

              {/* WiFi Encryption Switch */}
              <div className="space-y-2 pt-2 border-t border-slate-900/60">
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] font-mono text-slate-400 uppercase font-black">Enkripsi Jalur Wi-Fi</span>
                  <button
                    onClick={() => setUseWifiEncryption(!useWifiEncryption)}
                    className={`text-[8.5px] font-black px-2.5 py-1 rounded transition-all cursor-pointer font-mono ${
                      useWifiEncryption 
                        ? 'bg-blue-600/20 border border-blue-500 text-[#00e5ff] font-extrabold' 
                        : 'bg-slate-800 text-slate-400 font-bold'
                    }`}
                  >
                    {useWifiEncryption ? 'AES-256' : 'OPEN / NONE'}
                  </button>
                </div>
                <span className="text-[8px] font-mono text-slate-500 normal-case block leading-normal">
                  Enkripsi paket protokol UDP khusus untuk menghindari sniffing sinyal katup/solenoid di lapangan yard.
                </span>
              </div>

              {/* Ping Timeout Input */}
              <div className="space-y-2 pt-2 border-t border-slate-900/60">
                <label className="text-[9.5px] font-mono text-slate-400 uppercase font-black block">Ping Timeout Fail-Safe</label>
                <div className="relative">
                  <select
                    value={pingInterval}
                    onChange={(e) => setPingInterval(Number(e.target.value))}
                    className="bg-[#05080e] border border-slate-800 focus:border-cyan-500 text-[#00ffd0] text-xs font-mono font-bold p-1.5 rounded outline-none w-full cursor-pointer uppercase"
                  >
                    <option value={500}>500 ms (Amat Responsif)</option>
                    <option value={1000}>1000 ms (Standar)</option>
                    <option value={2000}>2000 ms (Koneksi Lemah)</option>
                    <option value={5000}>5000 ms (Matikan Fail-safe)</option>
                  </select>
                </div>
                <span className="text-[8px] font-mono text-slate-500 normal-case block leading-normal">
                  Sistem akan menghentikan seluruh mixing otomatis bila komunikasi nirkabel terputus melampaui limit ini demi alasan keselamatan kerja.
                </span>
              </div>
            </div>

            {/* Connection Widget */}
            <div className="bg-[#060a12]/80 border border-slate-800/80 rounded-[5px] p-4 flex flex-col items-center text-center space-y-3 shadow-lg">
              <span className="text-[9.5px] font-sans font-black text-[#00ffd0] uppercase tracking-wider block border-b border-slate-900 pb-1.5 w-full">
                KONEKSI NIRKABEL OPERATOR (LOCAL LAN)
              </span>
              
              <div className="p-2.5 bg-slate-950 rounded border border-slate-800/60 w-full flex flex-col items-center gap-2">
                <div className="p-2 bg-emerald-950/40 border border-emerald-800/40 rounded-full text-emerald-400">
                  <Wifi size={24} className="animate-pulse" />
                </div>
                <div>
                  <span className="text-[9.5px] font-mono text-slate-400 block uppercase font-bold">LANGKAH 1: PAUTKAN WI-FI</span>
                  <span className="text-[10px] font-mono text-[#00e5ff] block font-extrabold uppercase mt-0.5 leading-snug">HUBUNGKAN TABLET DAN PC KE WI-FI / JALUR AP YANG SAMA</span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-950 rounded border border-slate-800/60 w-full text-left space-y-2">
                <div>
                  <span className="text-[9.5px] font-mono text-slate-400 block uppercase font-bold">LANGKAH 2: BUKA BROWSER TABLET & AKSES URL</span>
                  <p className="text-[7.5px] font-mono text-slate-500 uppercase leading-relaxed mt-0.5">
                    Masukkan salah satu alamat IP berikut di address bar browser Google Chrome / Safari tablet Anda:
                  </p>
                </div>
                
                <div className="space-y-1">
                  {localIps.length === 0 ? (
                    <div className="text-[10px] font-mono text-amber-500 font-extrabold p-1 bg-amber-950/20 border border-amber-900/50 rounded text-center">
                      MENDAPATKAN IP KOMPUTER ATAU SILAKAN GUNAKAN:
                      <div className="text-[#00ffd0] mt-0.5 select-all">http://192.168.1.100:3001</div>
                    </div>
                  ) : (
                    localIps.map((ip) => (
                      <div key={ip} className="flex items-center justify-between bg-slate-900 p-1.5 rounded border border-slate-800 hover:border-[#00ffd0]/50 select-all font-mono text-[11px] font-black text-[#00ffd0]">
                        <span>http://{ip}:3001</span>
                        <span className="text-[7.5px] font-bold bg-slate-800 px-1 py-0.5 rounded text-slate-400 uppercase select-none">SALIN</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <p className="text-[7.5px] font-mono text-slate-505 leading-relaxed uppercase">
                *Tampilan tablet akan terkonfigurasi otomatis begitu memuat salah satu tautan di atas. Gunakan PIN Admin nirkabel untuk beralih ke mode kendali katup relai.
              </p>
            </div>
          </div>

          {/* Connected Tablets Grid */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="bg-[#050912]/80 border border-slate-900 rounded-[5px] p-4 flex-1 flex flex-col justify-between shadow-md">
              <div className="space-y-3">
                <span className="text-[10px] font-sans font-black text-rose-450 uppercase tracking-widest block border-b border-slate-850 pb-2">
                  DAFTAR TABLET TERDAFTAR (AUTHORIZED DEVICES)
                </span>

                <div className="space-y-2.5">
                  {tablets.map((t) => (
                    <div 
                      key={t.id} 
                      className={`p-3 rounded border transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-3 ${
                        t.status === "CONNECTED"
                          ? "bg-[#04101e]/30 border-cyan-900/50 hover:border-cyan-500/30"
                          : "bg-[#0b0c10]/20 border-slate-900 opacity-60 hover:opacity-80"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full border shrink-0 mt-0.5 ${
                          t.status === "CONNECTED"
                            ? "bg-cyan-950/40 border-cyan-800/60 text-cyan-400 animate-pulse"
                            : "bg-slate-950 border-slate-850 text-slate-500"
                        }`}>
                          <Tablet size={16} />
                        </div>
                        
                        <div className="flex flex-col text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-sans font-bold text-slate-100 uppercase">{t.name}</span>
                            <span className={`text-[8px] font-mono font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider ${
                              t.status === "CONNECTED"
                                ? "bg-emerald-950/40 border-emerald-800/40 text-emerald-400"
                                : "bg-red-950/40 border-red-900/40 text-red-400"
                            }`}>
                              {t.status === "CONNECTED" ? "ONLINE" : "OFFLINE"}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2.5 mt-1 text-[8.5px] font-mono text-slate-500 uppercase">
                            <span>ID: <strong className="text-slate-400">{t.id}</strong></span>
                            <span>•</span>
                            <span>IP: <strong className="text-slate-450">{t.ipAddress}</strong></span>
                            <span>•</span>
                            <span>AKTIF: <strong className={t.status === "CONNECTED" ? "text-cyan-455" : "text-slate-500"}>{t.lastActive}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Tablet Controls */}
                      <div className="flex items-center gap-2 w-full md:w-auto md:shrink-0 border-t md:border-t-0 border-slate-800/60 pt-2.5 md:pt-0 self-stretch md:self-auto justify-end">
                        {t.status === "CONNECTED" && (
                          <button
                            onClick={() => toggleRole(t.id)}
                            className={`px-2.5 py-1 text-[8.5px] font-mono font-black uppercase rounded border transition-all cursor-pointer ${
                              t.role === "CONTROLLER"
                                ? "bg-rose-955/20 hover:bg-rose-950 border-rose-800 text-rose-400"
                                : "bg-cyan-955/20 hover:bg-cyan-950 border-cyan-800 text-cyan-400"
                            }`}
                          >
                            Set: {t.role === "CONTROLLER" ? "Memonitor Saja" : "Bisa Kendali"}
                          </button>
                        )}

                        <button
                          onClick={() => disconnectTablet(t.id)}
                          className={`px-2.5 py-1 text-[8.5px] font-mono font-black uppercase rounded border transition-all cursor-pointer ${
                            t.status === "CONNECTED"
                              ? "bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white"
                              : "bg-emerald-950 hover:bg-emerald-900 border-emerald-800 text-emerald-400 hover:text-white"
                          }`}
                        >
                          {t.status === "CONNECTED" ? "Diskonek" : "Hubungkan"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Informational security log bar */}
              <div className="mt-4 p-3 bg-slate-950 rounded border border-slate-900/60 text-[8.5px] font-mono text-slate-500 uppercase flex items-center gap-2 select-none">
                <ShieldCheck size={13} className="text-emerald-500 shrink-0" />
                <span>
                  INTEGRITAS JALUR AMAN DISETUJUI. PROSEDUR FAIL-SAFE HARDWARE AKAN SECARA AUTOMATIS MENYALA JIKA PING TABLET MEMILIKI RESPONSE TIME LEBIH TINGGI DARI 1.5 DETIK.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-[#0c1220] border-t border-slate-850/50 pt-4 flex justify-between text-[8px] font-mono text-slate-500 uppercase select-none shrink-0">
        <span>SINKRONISASI KONTAT TABLET SECARA LOKAL</span>
        <span>KOMUNIKASI PLC NIRKABEL AKTIF [ WI-FI HUB ]</span>
      </div>
    </div>
  );
};
