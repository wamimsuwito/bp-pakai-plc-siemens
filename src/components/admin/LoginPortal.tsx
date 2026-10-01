import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ShieldCheck, 
  ShieldAlert, 
  KeyRound, 
  User, 
  Lock, 
  Terminal, 
  Server, 
  Activity, 
  Compass, 
  Clock 
} from "lucide-react";

interface LoginPortalProps {
  onSuccess: (matchedUser: any) => void;
  plantId: string;
  plantName: string;
}

export const LoginPortal: React.FC<LoginPortalProps> = ({ onSuccess, plantId, plantName }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [systemLogs, setSystemLogs] = useState<string[]>([
    "SYS LNK... OK",
    "CONN MODBUS PROTOCOL... STABLE",
    "ENTERING SECURE ERP INTEGRATED NODE..."
  ]);

  const getRegisteredUsers = () => {
    const saved = localStorage.getItem("batching_plant_users");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    const defaultList = [
      {
        nama: "Administrator Utama",
        nik: "12001",
        jabatan: "ADMIN",
        password: "admin"
      },
      {
        nama: "Andi Saputra",
        nik: "12002",
        jabatan: "OPERATOR",
        password: "1234"
      },
      {
        nama: "Direktur Farika",
        nik: "12004",
        jabatan: "DIREKTUR",
        password: "dir"
      },
      {
        nama: "Logistik Farika",
        nik: "12005",
        jabatan: "LOGISTIK",
        password: "log"
      },
      {
        nama: "Supervisor Farika",
        nik: "12006",
        jabatan: "SUPERVISOR",
        password: "spv"
      }
    ];
    localStorage.setItem("batching_plant_users", JSON.stringify(defaultList));
    return defaultList;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const inputUser = username.trim().toLowerCase();
    const inputPass = password.trim();

    if (!inputUser || !inputPass) {
      setError("Silakan isi username / NIK dan password.");
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const registeredUsers = getRegisteredUsers();
      
      // Look for match by NIK or Nama (case-insensitive)
      let matchedUser = registeredUsers.find(
        (u: any) => 
          (String(u.nik).toLowerCase() === inputUser || String(u.nama).toLowerCase() === inputUser) && 
          String(u.password) === inputPass
      );

      // Support fallback default 'admin'
      if (!matchedUser && inputUser === "admin" && inputPass === "admin") {
        matchedUser = registeredUsers.find((u: any) => u.jabatan?.toUpperCase() === "ADMIN") || {
          nama: "Administrator Utama",
          nik: "12001",
          jabatan: "ADMIN",
          password: "admin"
        };
      }

      if (matchedUser) {
        localStorage.setItem("batching_plant_active_user", JSON.stringify(matchedUser));
        if (matchedUser.jabatan?.toUpperCase() !== "OPERATOR") {
          localStorage.setItem("admin_session", "true");
        } else {
          localStorage.setItem("admin_session", "false");
        }
        window.dispatchEvent(new Event("active_user_session_sync"));
        onSuccess(matchedUser);
      } else {
        setError("NIK / Username atau Password salah.");
        setSystemLogs(prev => [
          `[FAIL] Gagal Otorisasi NIK "${inputUser}" -> Akses Ditolak`,
          ...prev.slice(0, 4)
        ]);
      }
      setIsLoading(false);
    }, 600);
  };

  const companyLogo = localStorage.getItem('company_logo') || "";

  return (
    <div className="h-screen w-screen bg-[#050810] text-[#cbd5e1] font-sans flex flex-col justify-between overflow-hidden p-6 select-none relative">
      {/* Background Cyber Mesh */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(6,182,212,0.02)_1px,transparent_1px)] bg-[size:100%_12px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.03),transparent_70%)] pointer-events-none" />

      {/* Top Header Information Hub */}
      <div className="flex items-center justify-between border-b border-[#1e293b]/70 pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <Terminal size={22} className="text-[#00e5ff] animate-pulse" />
          <div className="flex flex-col">
            <span className="text-[14px] font-sans font-black tracking-widest text-[#00ffd0] uppercase leading-none">
              SCADA & ERP CENTRAL GATEWAY
            </span>
            <span className="text-[8.5px] font-mono tracking-wider font-bold text-slate-500 uppercase leading-none mt-1.5">
              Secure Terminal Node Integrated Multi-Plant Network
            </span>
          </div>
        </div>

        {/* Plant Metadata */}
        <div className="flex items-center gap-4 bg-slate-950/40 border border-slate-900 px-3.5 py-1.5 rounded-[4px] font-mono text-[9.5px]">
          <div className="flex items-center gap-1.5 border-r border-slate-800 pr-3 text-slate-400">
            <Compass size={11} className="text-cyan-400" />
            <span>HQ BRANCH ID:</span>
            <span className="text-amber-400 font-extrabold">{plantId || "PKU01"}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Server size={11} className="text-emerald-400" />
            <span>PLANT LOCATION:</span>
            <span className="text-[#00ffd0] font-bold">{plantName || "PEKANBARU"}</span>
          </div>
        </div>
      </div>

      {/* Center Unified Login Component */}
      <div className="flex-1 flex items-center justify-center relative z-10 py-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-[480px] bg-[#0c1322] border-2 border-[#00e5ff]/90 rounded-[8px] p-8 shadow-[0_0_50px_rgba(6,182,212,0.15)] flex flex-col gap-6 relative"
        >
          {/* Aesthetic corner accents */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#00ffd0] to-[#00e5ff]" />

          <div className="flex flex-col items-center gap-2 text-center">
            <div className="w-[84px] h-[84px] rounded-full bg-[#05080f] border-2 border-[#00e5ff]/30 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.2)] overflow-hidden">
              {companyLogo ? (
                <img 
                  src={companyLogo} 
                  alt="Corporate Logo" 
                  className="w-full h-full object-contain p-2" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="font-sans font-black text-xs text-[#00ffd0] tracking-tighter uppercase p-1 text-center leading-none">
                  PT. FARIKA
                </div>
              )}
            </div>
            <h2 className="text-sm font-sans font-black tracking-widest text-[#00ffd0] uppercase mt-3">
              OTENTIKASI AKSES BATCHING PLANT
            </h2>
            <p className="text-[9px] font-mono uppercase text-slate-400 max-w-xs leading-relaxed">
              Masukkan Username / NIK dan PIN keamananan untuk mengaktifkan antarmuka kerja Anda.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* Input NIK / Username */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-sans font-black text-slate-400 uppercase tracking-wider">
                User ID / NIK Karyawan
              </label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="MASUKKAN USER ID ATAU NIK"
                  autoFocus
                  className="w-full bg-[#05080f]/90 border border-[#1e293b] hover:border-slate-700 focus:border-[#00e5ff] text-slate-200 placeholder:text-slate-600 rounded-[4px] pl-10 pr-4 py-2.5 text-xs font-mono tracking-wider outline-none uppercase transition-all"
                />
              </div>
            </div>

            {/* Input PIN / Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-sans font-black text-slate-400 uppercase tracking-wider">
                Password / PIN Keamanan
              </label>
              <div className="relative">
                <KeyRound size={14} className="absolute left-3 top-3 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#05080f]/90 border border-[#1e293b] hover:border-slate-700 focus:border-[#00e5ff] text-slate-200 placeholder:text-slate-650 rounded-[4px] pl-10 pr-4 py-2.5 text-xs tracking-wider outline-none transition-all"
                />
              </div>
            </div>

            {/* Error Container */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="bg-rose-950/30 border border-rose-500 rounded p-3.5 flex items-start gap-3 shadow-[0_0_15px_rgba(239,68,68,0.1)] animate-bounce"
                >
                  <ShieldAlert size={16} className="text-rose-500 shrink-0 mt-0.5" />
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] font-sans font-black tracking-wider text-rose-500 uppercase leading-none">
                      Akses Ditolak
                    </span>
                    <span className="text-[9.5px] font-mono text-rose-300 uppercase leading-relaxed mt-1">
                      {error}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Login button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 disabled:opacity-50 text-white font-sans font-black text-[10.5px] tracking-widest uppercase py-3.5 rounded-[4px] transition-all cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.15)] hover:shadow-[0_0_25px_rgba(6,182,212,0.3)] active:scale-98 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin shrink-0" />
                  <span>MEMVERIFIKASI OTORITAS...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={13} className="text-[#00ffd0]" />
                  <span>MASUK KE SISTEM NAVIGASI</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Info References */}
          <div className="border-t border-[#1e293b]/70 pt-4 flex justify-between text-[8px] font-mono text-slate-500 uppercase leading-none">
            <span>SISTEM INTEGRASI: SCADA HMI v2.4a</span>
            <span>PROTECTED NODE ACTIVE</span>
          </div>
        </motion.div>
      </div>

      {/* Footer System Console logs */}
      <div className="border-t border-[#1e293b]/50 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-[8.5px] font-mono uppercase text-slate-500 relative z-10 shrink-0">
        <div className="flex items-center gap-2.5">
          <Activity size={10} className="text-cyan-400 rotate-90" />
          <span>PORTAL VERTIKAL:</span>
          {systemLogs.map((log, idx) => (
            <span key={idx} className={idx === 0 ? "text-cyan-400 font-bold" : "hidden md:inline text-slate-600"}>
              {idx > 0 && " | "} {log}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-slate-500 font-bold select-none">
          <Clock size={11} className="text-cyan-400" />
          <span>UTC SENSORS TIMESTAMPS SYNC</span>
        </div>
      </div>
    </div>
  );
};
