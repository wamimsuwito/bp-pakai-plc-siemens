import React from "react";
import { 
  Truck, 
  Settings, 
  Activity, 
  Gauge, 
  AlertTriangle, 
  CheckCircle2, 
  UserMinus, 
  RefreshCw, 
  Wifi,
  Square,
  Play
} from "lucide-react";

interface TanpaOperatorProps {
  tanpaOperator: boolean;
  setTanpaOperator: (val: boolean) => void;
  truckPresenceRequired: boolean;
  setTruckPresenceRequired: (val: boolean) => void;
  driverDischargeRequired: boolean;
  setDriverDischargeRequired: (val: boolean) => void;
  minAirPressure: number;
  setMinAirPressure: (val: number) => void;
  pressureLimitEnabled: boolean;
  setPressureLimitEnabled: (val: boolean) => void;
  isTruckPresent: boolean;
  setIsTruckPresent: React.Dispatch<React.SetStateAction<boolean>>;
  driverBtnPressed: boolean;
  setDriverBtnPressed: React.Dispatch<React.SetStateAction<boolean>>;
  airPressure: number;
  operationMode: 'SIMULASI' | 'PRODUKSI';
}

export const TanpaOperator: React.FC<TanpaOperatorProps> = ({
  tanpaOperator,
  setTanpaOperator,
  truckPresenceRequired,
  setTruckPresenceRequired,
  driverDischargeRequired,
  setDriverDischargeRequired,
  minAirPressure,
  setMinAirPressure,
  pressureLimitEnabled,
  setPressureLimitEnabled,
  isTruckPresent,
  setIsTruckPresent,
  driverBtnPressed,
  setDriverBtnPressed,
  airPressure,
  operationMode
}) => {
  return (
    <div className="flex-1 bg-[#0b1329]/80 border border-[#1e293b]/70 rounded-[6px] p-6 flex flex-col justify-between overflow-y-auto scrollbar-thin select-none">
      <div className="space-y-6">
        {/* Header Area */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-950/50 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <UserMinus size={22} className={tanpaOperator ? "animate-pulse" : ""} />
            </div>
            <div>
              <h4 className="text-sm font-sans font-black tracking-widest text-[#00e5ff] uppercase">
                PENGATURAN MODE TANPA OPERATOR (OFF-OPERATOR MODE)
              </h4>
              <p className="text-[10px] font-mono text-slate-400 uppercase mt-0.5">
                Konfigurasi integrasi sensor keberadaan truk, tombol lepas driver, dan interlock tekanan udara kompresor.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono uppercase px-2 py-0.5 border border-slate-800 rounded bg-[#070b13] text-slate-400">
              SISTEM HARDWARE: 
              <span className={operationMode === 'PRODUKSI' ? "text-emerald-400 font-bold ml-1" : "text-amber-400 font-bold ml-1"}>
                {operationMode}
              </span>
            </span>
          </div>
        </div>

        {/* Master Toggle section */}
        <div className="bg-[#0e172c]/90 border border-slate-800 rounded-md p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className={`w-2.5 h-2.5 rounded-full ${tanpaOperator ? 'bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.6)]' : 'bg-slate-600'}`} />
              <span className="text-xs font-sans font-extrabold text-white uppercase">Aktivasi Mode Tanpa Operator</span>
            </div>
            <p className="text-[9px] font-mono text-slate-400 uppercase leading-relaxed max-w-xl">
              Saat diaktifkan, HMI akan melakukan pengecekan otomatis berlapis sebelum mengizinkan pelepasan beton dari Twin Shaft Mixer. Jika dinonaktifkan, semua aturan di halaman ini diabaikan.
            </p>
          </div>

          <button
            onClick={() => setTanpaOperator(!tanpaOperator)}
            className={`cursor-pointer px-4 py-2 text-[10px] font-mono font-black tracking-widest uppercase border rounded-[4px] transition-all min-w-[120px] text-center ${
              tanpaOperator 
                ? "bg-cyan-500/15 border-cyan-400 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.1)] hover:bg-cyan-500/25" 
                : "bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            {tanpaOperator ? "AKTIF [ON]" : "NON-AKTIF [OFF]"}
          </button>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-all ${tanpaOperator ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
          {/* Column 1: Truck & Driver Gates Security */}
          <div className="space-y-4">
            <div className="border border-slate-800/80 rounded-md bg-[#05080e]/60 p-4 space-y-4">
              <div className="flex items-center gap-2 text-cyan-400">
                <Truck size={16} />
                <span className="text-[10.5px] font-sans font-bold uppercase tracking-wider">Keamanan & Keberadaan Truk Mixer</span>
              </div>

              {/* Toggle Rule */}
              <div className="flex items-center justify-between pointer-events-auto">
                <span className="text-[9.5px] font-mono text-slate-300 uppercase">Wajibkan Deteksi Truk Mixer</span>
                <button
                  onClick={() => setTruckPresenceRequired(!truckPresenceRequired)}
                  className={`cursor-pointer px-2.5 py-1 text-[9px] font-mono font-black border rounded ${
                    truckPresenceRequired 
                      ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400" 
                      : "bg-slate-950 border-slate-800 text-slate-500"
                  }`}
                >
                  {truckPresenceRequired ? "AKTIF" : "DISABLED"}
                </button>
              </div>

              {/* Status Display */}
              <div className="border border-slate-900 bg-slate-950/80 p-3 rounded space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-500 uppercase">Koneksi Hardware (Pin A4):</span>
                  {isTruckPresent ? (
                    <span className="text-emerald-400 font-extrabold flex items-center gap-1.5 animate-pulse">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                      TRUK TERDETEKSI
                    </span>
                  ) : (
                    <span className="text-red-400 font-extrabold flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
                      MENUNGGU TRUK
                    </span>
                  )}
                </div>
                <p className="text-[8.5px] font-mono text-slate-550 uppercase leading-relaxed">
                  Pasang sensor Proximity induktif / Photoelectric limit switch di area pengisian dan hubungkan ke pin analog A4 pada Arduino Mega.
                </p>
              </div>

              {/* Simulator Action (Visible always but highly useful for testing) */}
              <div className="pt-2 border-t border-slate-800/50 flex items-center justify-between">
                <span className="text-[9px] font-mono text-[#00e5ff] uppercase flex items-center gap-1.5">
                  <Activity size={12} /> Mode Simulasi / Override HMI:
                </span>
                <button
                  onClick={() => setIsTruckPresent(prev => !prev)}
                  className="cursor-pointer px-2.5 py-1 bg-cyan-950/50 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 rounded text-[9.5px] font-mono font-black uppercase"
                >
                  Simulasikan {isTruckPresent ? "Truk Keluar" : "Truk Datang"}
                </button>
              </div>
            </div>

            {/* Sub-card: Driver Button */}
            <div className="border border-slate-800/80 rounded-md bg-[#05080e]/60 p-4 space-y-4">
              <div className="flex items-center gap-2 text-cyan-400">
                <Square size={14} className="fill-cyan-400/20 text-[#00ffd0]" />
                <span className="text-[10.5px] font-sans font-bold uppercase tracking-wider">Tombol Konfirmasi Driver (Lepas Beton)</span>
              </div>

              {/* Toggle Rule */}
              <div className="flex items-center justify-between pointer-events-auto">
                <span className="text-[9.5px] font-mono text-slate-300 uppercase">Wajibkan Sinyal Tombol Driver</span>
                <button
                  onClick={() => setDriverDischargeRequired(!driverDischargeRequired)}
                  className={`cursor-pointer px-2.5 py-1 text-[9px] font-mono font-black border rounded ${
                    driverDischargeRequired 
                      ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400" 
                      : "bg-slate-950 border-slate-800 text-slate-500"
                  }`}
                >
                  {driverDischargeRequired ? "AKTIF" : "DISABLED"}
                </button>
              </div>

              {/* Status Display */}
              <div className="border border-slate-900 bg-slate-950/80 p-3 rounded space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-500 uppercase">Sinyal Fisik Driver (Pin A5):</span>
                  {driverBtnPressed ? (
                    <span className="text-emerald-400 font-extrabold flex items-center gap-1.5 animate-pulse">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                      SUDAH DITEKAN [OK]
                    </span>
                  ) : (
                    <span className="text-amber-400 font-extrabold flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
                      MENUNGGU TEKANAN
                    </span>
                  )}
                </div>
                <p className="text-[8.5px] font-mono text-slate-550 uppercase leading-relaxed">
                  Pasang tombol push-button industri 22mm NO di dekat talang pengarah pengisian dan hubungkan ke pin analog A5 pada Arduino Mega.
                </p>
              </div>

              {/* Simulator Action */}
              <div className="pt-2 border-t border-slate-800/50 flex items-center justify-between">
                <span className="text-[9px] font-mono text-[#00ffd0] uppercase flex items-center gap-1.5">
                  <Activity size={12} /> Mode Simulasi / Override HMI:
                </span>
                <button
                  onClick={() => setDriverBtnPressed(prev => !prev)}
                  className="cursor-pointer px-2.5 py-1 bg-cyan-950/50 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 rounded text-[9.5px] font-mono font-black uppercase"
                >
                  {driverBtnPressed ? "Reset Sinyal Tombol" : "Simulasikan Tekanan Tombol"}
                </button>
              </div>
            </div>
          </div>

          {/* Column 2: Compressor Pressure Constraint */}
          <div className="space-y-4">
            <div className="border border-slate-800/80 rounded-md bg-[#05080e]/60 p-4 space-y-4 h-full flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-cyan-400">
                  <Gauge size={16} />
                  <span className="text-[10.5px] font-sans font-bold uppercase tracking-wider">Interlock Batas Tekanan Kompresor</span>
                </div>

                {/* Toggle Rule */}
                <div className="flex items-center justify-between pointer-events-auto">
                  <span className="text-[9.5px] font-mono text-slate-300 uppercase">Aktifkan Proteksi Tekanan Udara</span>
                  <button
                    onClick={() => setPressureLimitEnabled(!pressureLimitEnabled)}
                    className={`cursor-pointer px-2.5 py-1 text-[9px] font-mono font-black border rounded ${
                      pressureLimitEnabled 
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400" 
                        : "bg-slate-950 border-slate-800 text-slate-500"
                    }`}
                  >
                    {pressureLimitEnabled ? "AKTIF" : "DISABLED"}
                  </button>
                </div>

                {/* Pressure Value Configuration */}
                <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded border border-slate-900">
                  <div className="flex flex-col gap-1">
                    <span className="text-[8.5px] font-mono text-slate-500 uppercase">Batasan Minimal (PSI):</span>
                    <div className="flex items-center gap-2 pointer-events-auto">
                      <input
                        type="number"
                        min="0"
                        max="150"
                        value={minAirPressure}
                        onChange={(e) => setMinAirPressure(parseFloat(e.target.value) || 0)}
                        className="bg-slate-900 text-cyan-400 border border-slate-800 text-xs font-mono font-bold py-1 px-2 rounded w-full focus:outline-none focus:border-cyan-400"
                      />
                      <span className="text-[9px] font-mono text-slate-400">PSI</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 border-l border-slate-800/60 pl-3">
                    <span className="text-[8.5px] font-mono text-slate-500 uppercase">Tekanan Sekarang:</span>
                    <span className={`text-base font-sans font-black tracking-tight ${airPressure >= minAirPressure ? 'text-emerald-400' : 'text-rose-500'}`}>
                      {airPressure.toFixed(1)} <span className="text-[10px] font-sans">PSI</span>
                    </span>
                  </div>
                </div>

                {/* Security status block */}
                <div className="p-3 border border-slate-900 rounded bg-[#090b11]">
                  <div className="flex items-center gap-2">
                    { (!pressureLimitEnabled) ? (
                      <>
                        <CheckCircle2 size={16} className="text-slate-500" />
                        <span className="text-[10px] font-sans font-bold text-slate-500 uppercase">PROTEKSI NON-AKTIF</span>
                      </>
                    ) : (airPressure >= minAirPressure) ? (
                      <>
                        <CheckCircle2 size={16} className="text-emerald-400" />
                        <span className="text-[10px] font-sans font-bold text-emerald-400 uppercase">TEKANAN AMAN (KUNCI TERBUKA)</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={16} className="text-rose-500 animate-pulse" />
                        <span className="text-[10px] font-sans font-bold text-rose-500 uppercase animate-pulse">TEKANAN RENDAH (BLOCKED)</span>
                      </>
                    )}
                  </div>
                  <p className="text-[8.5px] font-mono text-slate-400 uppercase mt-1.5 leading-relaxed">
                    Sistem otomatisasi interlock akan memblokir inisiasi tombol **"Mulai Produksi"** apabila nilai kompresor di bawah target limit guna menghindari kegagalan pemicuan pintu katup pneumatic lapangan.
                  </p>
                </div>
              </div>

              {/* Technical instructions block */}
              <div className="text-[8px] font-mono text-slate-500 uppercase leading-normal border-t border-slate-900 pt-3 mt-4">
                * Sensor Tekanan Angin menggunakan Industrial Pressure Transducer 1.2 MPa yang terhubung ke pin Analog **A1** Arduino Mega PLC.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Safety Info Alert Row */}
      <div className="mt-6 border-t border-slate-800/60 pt-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-2 max-w-2xl">
          <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[8.5px] font-mono text-slate-400 uppercase leading-relaxed text-left">
            Pastikan seluruh perkabelan sensor A4 (Truk) dan A5 (Tombol Driver) telah dipasang dengan pull-up internal pada mikrokontroler. Apabila pin tidak terhubung atau mengambang, nilai mungkin melesat dan mempengaruhi presisi trigger real PLC.
          </p>
        </div>
        <div className="text-[9px] font-mono text-slate-500 uppercase select-all shrink-0">
          * GRUP REKAYASA SISTEM FRP
        </div>
      </div>
    </div>
  );
};
