import React, { useState } from "react";
import {
  Search,
  Printer,
  Calendar,
  User,
  Truck,
  MapPin,
  Check,
  AlertCircle,
  FileText,
  Clock,
  Download,
  Info
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
  productionMode?: string;
  startTime?: string;
  endTime?: string;
  quarryPasir1?: string;
  quarryPasir2?: string;
  quarryBatu1?: string;
  quarryBatu2?: string;
}

interface PrintTiketProps {
  logs: BatchLog[];
  companyName: string;
  companyTagline: string;
  companyLogo: string;
}

export const PrintTiket: React.FC<PrintTiketProps> = ({
  logs,
  companyName,
  companyTagline,
  companyLogo
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDay, setFilterDay] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [activePrintLog, setActivePrintLog] = useState<BatchLog | null>(null);

  // Helper inside component to parse log history date
  const parseLogDate = (timestamp: string) => {
    if (!timestamp) return { day: "", month: "", year: "" };
    try {
      const dStr = timestamp.split(',')[0].trim();
      let day = "";
      let month = "";
      let year = "";

      if (dStr.includes("/")) {
        const parts = dStr.split("/");
        if (parts.length >= 3) {
          day = String(parseInt(parts[0], 10));
          month = String(parseInt(parts[1], 10));
          year = parts[2];
        }
      } else if (dStr.includes("-")) {
        const parts = dStr.split("-");
        if (parts.length >= 3) {
          if (parts[0].length === 4) {
            year = parts[0];
            month = String(parseInt(parts[1], 10));
            day = String(parseInt(parts[2], 10));
          } else {
            day = String(parseInt(parts[0], 10));
            month = String(parseInt(parts[1], 10));
            year = parts[2];
          }
        }
      } else {
        const parsedDate = new Date(timestamp);
        if (!isNaN(parsedDate.getTime())) {
          day = String(parsedDate.getDate());
          month = String(parsedDate.getMonth() + 1);
          year = String(parsedDate.getFullYear());
        }
      }

      return { day, month, year };
    } catch (e) {
      return { day: "", month: "", year: "" };
    }
  };

  const INDONESIAN_MONTHS = [
    { value: "1", label: "Januari" },
    { value: "2", label: "Februari" },
    { value: "3", label: "Maret" },
    { value: "4", label: "April" },
    { value: "5", label: "Mei" },
    { value: "6", label: "Juni" },
    { value: "7", label: "Juli" },
    { value: "8", label: "Agustus" },
    { value: "9", label: "September" },
    { value: "10", label: "Oktober" },
    { value: "11", label: "November" },
    { value: "12", label: "Desember" }
  ];

  const daysArray = Array.from({ length: 31 }, (_, i) => String(i + 1));

  // Extract unique years present dynamically
  const uniqueYears = Array.from(
    new Set(
      logs
        .map((l) => parseLogDate(l.timestamp).year)
        .filter((y) => y !== "")
    )
  ).sort((a, b) => String(b).localeCompare(String(a))) as string[];

  const yearsOptions = uniqueYears.length > 0 ? uniqueYears : [new Date().getFullYear().toString()];

  // Filter logs based on word and date choices
  const filteredLogs = logs.filter((l) => {
    const term = searchTerm.toLowerCase();
    const matchesText =
      l.recipeName.toLowerCase().includes(term) ||
      (l.id || "").toLowerCase().includes(term) ||
      (l.pelanggan || "").toLowerCase().includes(term) ||
      (l.sopir || "").toLowerCase().includes(term) ||
      (l.lokasi || "").toLowerCase().includes(term) ||
      (l.noKendaraan || "").toLowerCase().includes(term);

    const { day, month, year } = parseLogDate(l.timestamp);

    const matchesDay = filterDay === "all" || day === filterDay;
    const matchesMonth = filterMonth === "all" || month === filterMonth;
    const matchesYear = filterYear === "all" || year === filterYear;

    return matchesText && matchesDay && matchesMonth && matchesYear;
  });

  const handleResetFilters = () => {
    setSearchTerm("");
    setFilterDay("all");
    setFilterMonth("all");
    setFilterYear("all");
  };

  const hasActiveFilters = searchTerm !== "" || filterDay !== "all" || filterMonth !== "all" || filterYear !== "all";

  const PrintTicketModal = ({ log, onClose }: { log: BatchLog; onClose: () => void }) => {
    const defaultTargets = { pasir1: 0, pasir2: 0, batu1: 0, batu2: 0, semen: 0, air: 0 };
    const defaultActuals = { pasir1: 0, pasir2: 0, batu1: 0, batu2: 0, semen: 0, air: 0 };

    const targets = log.targets || defaultTargets;
    const actuals = log.actuals || defaultActuals;

    // Preserve historical quarry name context completely
    const qPasir1 = log.quarryPasir1 !== undefined ? log.quarryPasir1 : (localStorage.getItem("quarry_pasir_1") || "");
    const qPasir2 = log.quarryPasir2 !== undefined ? log.quarryPasir2 : (localStorage.getItem("quarry_pasir_2") || "");
    const qBatu1 = log.quarryBatu1 !== undefined ? log.quarryBatu1 : (localStorage.getItem("quarry_batu_1") || "");
    const qBatu2 = log.quarryBatu2 !== undefined ? log.quarryBatu2 : (localStorage.getItem("quarry_batu_2") || "");

    const labelPasir1 = qPasir1 ? `Pasir 1 / ${qPasir1}` : "Pasir 1";
    const labelPasir2 = qPasir2 ? `Pasir 2 / ${qPasir2}` : "Pasir 2";
    const labelBatu1 = qBatu1 ? `Batu 1 / ${qBatu1}` : "Batu 1";
    const labelBatu2 = qBatu2 ? `Batu 2 / ${qBatu2}` : "Batu 2";

    const computeDev = (act: number, tgt: number) => {
      if (tgt === 0 && act === 0) return 0;
      return act - tgt;
    };

    const devPasir1 = computeDev(actuals.pasir1, targets.pasir1);
    const devPasir2 = computeDev(actuals.pasir2, targets.pasir2);
    const devBatu1 = computeDev(actuals.batu1, targets.batu1);
    const devBatu2 = computeDev(actuals.batu2, targets.batu2);
    const devSemen = computeDev(actuals.semen, targets.semen);
    const devAir = computeDev(actuals.air, targets.air);

    const formatDev = (val: number) => {
      if (val === 0) return "0";
      return val > 0 ? `+${val}` : `${val}`;
    };

    const isAutoMode = (log.productionMode || "AUTO").toUpperCase() === "AUTO";

    const printTime = new Date().toLocaleString("id-ID", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }).replace(/\./g, ":");

    let dateStr = "";
    if (log.timestamp) {
      const dt = typeof log.timestamp === "string" ? new Date(log.timestamp) : log.timestamp;
      if (dt instanceof Date && !isNaN(dt.getTime())) {
        dateStr = `${dt.getDate()}/${dt.getMonth() + 1}/${dt.getFullYear()}`;
      } else {
        dateStr = String(log.timestamp).split(",")[0];
      }
    } else {
      const d = new Date();
      dateStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    }

    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto print:p-0 print:bg-white print:backdrop-blur-none">
        <style dangerouslySetInnerHTML={{
          __html: `
          @media print {
            body * {
              visibility: hidden !important;
            }
            #print-ticket-re-sheet, #print-ticket-re-sheet * {
              visibility: visible !important;
            }
            #print-ticket-re-sheet {
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
            #print-re-controls {
              display: none !important;
            }
          }
        `}} />

        <div className="flex flex-col gap-3 w-full max-w-[700px] h-fit max-h-[95vh] print:max-h-none print:w-full">
          <div id="print-re-controls" className="flex items-center justify-between bg-slate-900 border border-slate-800 p-3 rounded-[6px] shadow-lg shrink-0 select-none">
            <span className="text-[11px] font-sans font-black tracking-wider text-cyan-400 uppercase flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping"></span>
              REPRINT BUKTI TIMBANG SYSTEM BP#1
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-mono font-black uppercase px-4 py-1.5 rounded transition-all cursor-pointer shadow-[0_0_8px_rgba(34,211,238,0.3)] flex items-center gap-1 leading-none"
              >
                Cetak Tiket
              </button>
              <button
                onClick={onClose}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-black uppercase px-3 py-1.5 rounded transition-all cursor-pointer leading-none"
              >
                Tutup
              </button>
            </div>
          </div>

          <div
            id="print-ticket-re-sheet"
            className="w-full bg-white text-slate-900 p-6 md:p-8 border border-slate-300 shadow-2xl rounded-[4px] font-sans overflow-y-auto flex flex-col justify-between"
            style={{ color: "#1e293b" }}
          >
            <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="shrink-0 scale-[1.1] origin-left select-none">
                  {companyLogo ? (
                    <img
                      src={companyLogo}
                      alt="Company Logo"
                      className="w-[50px] h-[50px] rounded-full object-cover bg-white border-2 border-slate-300"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-[50px] h-[50px] rounded-full border-4 border-blue-800 flex items-center justify-center p-0.5 font-bold text-center">
                      <span className="text-blue-800 text-[8px] font-semibold tracking-tighter leading-none">
                        PT FARIKA<br /><span className="text-red-500 font-black text-[9px] block">RIAU</span>PERKASA
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col text-left">
                  <h2 className="text-[16px] font-sans font-black tracking-tight text-blue-900 leading-none uppercase">
                    {companyName || "PT FARIKA RIAU PERKASA"}
                  </h2>
                  <span className="text-[10px] font-sans font-extrabold tracking-wide text-slate-700 uppercase mt-1 leading-none">
                    {companyTagline || "ONE STOP CONCRETE SOLUTION"}
                  </span>
                  <span className="text-[8px] font-mono font-medium text-slate-500 uppercase mt-0.5 leading-none">
                    Jl Soekarno - Hatta Komplek SKA Blok E 62 Telp. 0761-571655
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end text-right font-mono text-[9px] text-slate-500 select-none">
                <span>No. Seri:</span>
                <span className="text-[10.5px] font-mono font-black text-slate-900 uppercase">
                  BP-PKU-BP#1-{log.id || "000000"}
                </span>
              </div>
            </div>

            <div className="my-4 bg-slate-100 border border-slate-200 py-1.5 text-center flex items-center justify-center gap-3.5 rounded-[3px] select-none">
              <span className="text-slate-800 font-sans font-black tracking-widest text-[12.5px] uppercase">
                SALINAN BUKTI TIMBANG (BP#1)
              </span>
              <span className="text-[9px] font-mono font-black text-white bg-slate-900 border border-slate-800 px-2 py-0.5 rounded leading-none">
                {isAutoMode ? "AUTO" : "MANUAL"}
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
                  <span className="font-semibold text-slate-800 uppercase">{log.pelanggan || "-"}</span>
                </div>
                <div className="flex">
                  <span className="w-24 text-slate-500 font-medium">Lokasi Proyek</span>
                  <span className="mr-2">:</span>
                  <span className="font-semibold text-slate-800 uppercase">{log.lokasi || "-"}</span>
                </div>
                <div className="flex">
                  <span className="w-24 text-slate-500 font-medium">Mutu Beton</span>
                  <span className="mr-2">:</span>
                  <span className="font-black text-blue-900 uppercase">{log.recipeName || "-"}</span>
                </div>
              </div>

              <div className="space-y-1 text-left pl-4 border-l border-slate-200">
                <div className="flex">
                  <span className="w-24 text-slate-500 font-medium">Jam Mulai</span>
                  <span className="mr-2">:</span>
                  <span className="font-mono text-slate-800">{log.startTime || "-"}</span>
                </div>
                <div className="flex">
                  <span className="w-24 text-slate-500 font-medium">Jam Selesai</span>
                  <span className="mr-2">:</span>
                  <span className="font-mono text-slate-800">{log.endTime || "-"}</span>
                </div>
                <div className="flex">
                  <span className="w-24 text-slate-500 font-medium">Nama Sopir</span>
                  <span className="mr-2">:</span>
                  <span className="font-semibold text-slate-800 uppercase">{log.sopir || "-"}</span>
                </div>
                <div className="flex">
                  <span className="w-24 text-slate-500 font-medium">Nomor Mobil</span>
                  <span className="mr-2">:</span>
                  <span className="font-mono font-bold text-slate-800 uppercase">{log.noKendaraan || "-"}</span>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <span className="block text-[8.5px] font-mono font-black text-slate-400 uppercase tracking-wide text-center mb-1 select-none">
                Aktual penimbangan (Kg)
              </span>
              <table className="w-full text-[10.5px] border-collapse border border-slate-400 text-slate-800 text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-400 select-none">
                    <th className="border-r border-slate-400 p-1.5 py-2 text-left font-black tracking-wider w-1/4">Material</th>
                    <th className="border-r border-slate-400 p-1.5 py-2 text-center font-black tracking-wider w-1/4">Target</th>
                    <th className="border-r border-slate-400 p-1.5 py-2 text-center font-black tracking-wider w-1/4">Realisasi</th>
                    <th className="p-1.5 py-2 text-center font-black tracking-wider w-1/4">Deviasi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-400">
                    <td className="border-r border-slate-400 p-1.5 font-bold text-left">{labelPasir1}</td>
                    <td className="border-r border-slate-400 p-1.5 font-mono text-center">{targets.pasir1}</td>
                    <td className="border-r border-slate-400 p-1.5 font-mono text-center">{actuals.pasir1}</td>
                    <td className={`p-1.5 font-mono font-bold text-center ${devPasir1 !== 0 ? "text-red-650" : ""}`}>{formatDev(devPasir1)}</td>
                  </tr>
                  <tr className="border-b border-slate-400">
                    <td className="border-r border-slate-400 p-1.5 font-bold text-left">{labelPasir2}</td>
                    <td className="border-r border-slate-400 p-1.5 font-mono text-center">{targets.pasir2}</td>
                    <td className="border-r border-slate-400 p-1.5 font-mono text-center">{actuals.pasir2}</td>
                    <td className={`p-1.5 font-mono font-bold text-center ${devPasir2 !== 0 ? "text-red-520" : ""}`}>{formatDev(devPasir2)}</td>
                  </tr>
                  <tr className="border-b border-slate-400">
                    <td className="border-r border-slate-400 p-1.5 font-bold text-left">{labelBatu1}</td>
                    <td className="border-r border-slate-400 p-1.5 font-mono text-center">{targets.batu1}</td>
                    <td className="border-r border-slate-400 p-1.5 font-mono text-center">{actuals.batu1}</td>
                    <td className={`p-1.5 font-mono font-bold text-center ${devBatu1 !== 0 ? "text-red-520" : ""}`}>{formatDev(devBatu1)}</td>
                  </tr>
                  <tr className="border-b border-slate-400">
                    <td className="border-r border-slate-400 p-1.5 font-bold text-left">{labelBatu2}</td>
                    <td className="border-r border-slate-400 p-1.5 font-mono text-center">{targets.batu2}</td>
                    <td className="border-r border-slate-400 p-1.5 font-mono text-center">{actuals.batu2}</td>
                    <td className={`p-1.5 font-mono font-bold text-center ${devBatu2 !== 0 ? "text-red-520" : ""}`}>{formatDev(devBatu2)}</td>
                  </tr>
                  <tr className="border-b border-slate-400">
                    <td className="border-r border-slate-400 p-1.5 font-bold text-left">Semen (Cement)</td>
                    <td className="border-r border-slate-400 p-1.5 font-mono text-center">{targets.semen}</td>
                    <td className="border-r border-slate-400 p-1.5 font-mono text-center">{actuals.semen}</td>
                    <td className={`p-1.5 font-mono font-bold text-center ${devSemen !== 0 ? "text-red-520" : ""}`}>{formatDev(devSemen)}</td>
                  </tr>
                  <tr>
                    <td className="border-r border-slate-400 p-1.5 font-bold text-left">Air (Water)</td>
                    <td className="border-r border-slate-400 p-1.5 font-mono text-center">{targets.air}</td>
                    <td className="border-r border-slate-400 p-1.5 font-mono text-center">{actuals.air}</td>
                    <td className={`p-1.5 font-mono font-bold text-center ${devAir !== 0 ? "text-red-520" : ""}`}>{formatDev(devAir)}</td>
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

            <div className="mt-6 border-t border-slate-200 pt-3 text-center text-[7.5px] font-medium text-slate-500 space-y-0.5 col-span-full select-none">
              <p>Dokumen ini dicetak ulang secara otomatis melalui SCADA Admin Panel.</p>
              <p className="font-mono">Waktu Cetak Ulang: {printTime}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 bg-[#0b1329]/95 border border-slate-800 rounded-[6px] p-4 flex flex-col h-full overflow-hidden">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 select-none pb-3 border-b border-slate-800/80">
        <div>
          <h2 className="text-sm font-sans font-black tracking-wider text-cyan-400 uppercase flex items-center gap-2">
            <Printer className="w-4 h-4 text-[#00ffd0] shrink-0" />
            REPRINT HISTORI BUKTI TIMBANG (TIKET PRINT)
          </h2>
          <p className="text-[10px] font-mono text-slate-400 mt-1 uppercase">
            Cari, pratinjau, dan cetak ulang salinan tiket pengiriman beton untuk sopir kapanpun diperlukan
          </p>
        </div>
      </div>

      {/* Search Input & Dropdowns Filters Row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 mb-3 shrink-0 select-none">
        {/* Search */}
        <div className="md:col-span-5 relative">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-500" />
          </div>
          <input
            type="text"
            placeholder="Cari ID, Pelanggan, Mutu, Supir, Nopol..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-[11px] font-sans h-[32px] pl-9 pr-4 bg-slate-950 border border-slate-800 rounded placeholder-slate-550 text-slate-200 focus:outline-none focus:border-cyan-500/80 text-white font-medium shadow-inner"
          />
        </div>

        {/* Tanggal Dropdown */}
        <div className="md:col-span-2 relative">
          <select
            value={filterDay}
            onChange={(e) => setFilterDay(e.target.value)}
            className="w-full text-[10.5px] font-mono h-[32px] px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-300 focus:outline-none focus:border-cyan-500/80 cursor-pointer font-bold appearance-none"
            style={{
              backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2500/svg' viewBox='0 0 24 24' fill='none' stroke='%2300ffd0' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
              backgroundPosition: "right 8px center",
              backgroundSize: "11px",
              backgroundRepeat: "no-repeat",
              paddingRight: "24px"
            }}
          >
            <option value="all">📅 SEMUA TANGGAL</option>
            {daysArray.map((d) => (
              <option key={d} value={d} className="bg-[#0b1329] text-white">
                TGL {d.padStart(2, "0")}
              </option>
            ))}
          </select>
        </div>

        {/* Bulan Dropdown */}
        <div className="md:col-span-2 relative">
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="w-full text-[10.5px] font-sans h-[32px] px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-300 focus:outline-none focus:border-cyan-500/80 cursor-pointer font-bold appearance-none"
            style={{
              backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2500/svg' viewBox='0 0 24 24' fill='none' stroke='%2300ffd0' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
              backgroundPosition: "right 8px center",
              backgroundSize: "11px",
              backgroundRepeat: "no-repeat",
              paddingRight: "24px"
            }}
          >
            <option value="all">🌙 SEMUA BULAN</option>
            {INDONESIAN_MONTHS.map((m) => (
              <option key={m.value} value={m.value} className="bg-[#0b1329] text-white">
                {m.label.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Tahun Dropdown */}
        <div className="md:col-span-2 relative">
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="w-full text-[10.5px] font-mono h-[32px] px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-300 focus:outline-none focus:border-cyan-500/80 cursor-pointer font-bold appearance-none"
            style={{
              backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2300ffd0' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
              backgroundPosition: "right 8px center",
              backgroundSize: "11px",
              backgroundRepeat: "no-repeat",
              paddingRight: "24px"
            }}
          >
            <option value="all">⭐ SEMUA TAHUN</option>
            {yearsOptions.map((y) => (
              <option key={y} value={y} className="bg-[#0b1329] text-white">
                THN {y}
              </option>
            ))}
          </select>
        </div>

        {/* Reset Button */}
        <div className="md:col-span-1">
          <button
            onClick={handleResetFilters}
            disabled={!hasActiveFilters}
            className={`w-full h-[32px] text-[10px] font-sans font-black uppercase rounded transition flex items-center justify-center cursor-pointer select-none ${
              hasActiveFilters
                ? "bg-rose-950 hover:bg-rose-900 border border-rose-800/80 text-rose-300 hover:text-white"
                : "bg-slate-900/40 border border-slate-900 text-slate-650 cursor-not-allowed"
            }`}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Table Logs */}
      <div className="flex-1 overflow-y-auto border border-slate-800 bg-[#060b16] rounded min-h-0">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-950 border-b border-slate-900 text-slate-400 text-[9px] font-mono uppercase tracking-wider sticky top-0 z-[10] select-none">
              <th className="py-2.5 px-3">No Seri Tiket / Tanggal</th>
              <th className="py-2.5 px-3">Mutu Beton</th>
              <th className="py-2.5 px-3">Volume</th>
              <th className="py-2.5 px-3">Pelanggan & Tujuan</th>
              <th className="py-2.5 px-3">Logistik (Sopir/Nopol)</th>
              <th className="py-2.5 px-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900/60 text-[10.5px] font-sans text-slate-300 font-medium">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 px-4 text-center select-none">
                  <div className="flex flex-col items-center gap-2">
                    <Info className="w-6 h-6 text-slate-600" />
                    <span className="text-slate-500 font-mono text-[10px] uppercase">
                      Tidak ada histori tiket yang cocok atau terSimpan dalam data produksi.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredLogs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-900/30 transition-colors">
                  {/* Waktu / ID */}
                  <td className="py-3 px-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-white font-mono font-bold text-[10px] tracking-tight">
                        BP#1-{l.id || "0000"}
                      </span>
                      <span className="text-[8.5px] font-mono text-slate-500">
                        Date: {l.timestamp}
                      </span>
                    </div>
                  </td>
                  {/* Resep */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1 py-0.5 rounded text-[8px] font-mono font-black uppercase ${
                        l.productionMode === "MANUAL"
                        ? "bg-amber-950/85 text-amber-400 border border-amber-900/30"
                        : "bg-cyan-950 text-cyan-400 border border-cyan-900/30"
                      }`}>
                        {l.productionMode === "MANUAL" ? "MAN" : "AUTO"}
                      </span>
                      <span className="text-slate-200 font-bold">{l.recipeName}</span>
                    </div>
                  </td>
                  {/* Volume */}
                  <td className="py-3 px-3">
                    <span className="font-mono font-extrabold text-[#00ffd0]">
                      {l.volume.toFixed(1)} M³
                    </span>
                  </td>
                  {/* Pelanggan */}
                  <td className="py-3 px-3">
                    <div className="flex flex-col gap-0.5 max-w-[200px] truncate">
                      <span className="text-slate-200 truncate">{l.pelanggan || "-"}</span>
                      <span className="text-[9px] text-[#00ffd0] flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{l.lokasi || "-"}</span>
                      </span>
                    </div>
                  </td>
                  {/* Logistik */}
                  <td className="py-3 px-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-slate-200 font-bold flex items-center gap-1">
                        <User className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                        {l.sopir || "-"}
                      </span>
                      <span className="text-[9px] text-slate-400 flex items-center gap-1">
                        <Truck className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                        {l.noKendaraan || "-"}
                      </span>
                    </div>
                  </td>
                  {/* Action */}
                  <td className="py-3 px-3 text-right">
                    <button
                      onClick={() => setActivePrintLog(l)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[9.5px] font-mono font-black bg-cyan-950 hover:bg-cyan-900/90 border border-cyan-800/50 hover:border-cyan-400 text-cyan-400 rounded cursor-pointer transition uppercase"
                    >
                      <Printer className="w-3 h-3 shrink-0" />
                      Cetak Ulang
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {activePrintLog && (
        <PrintTicketModal log={activePrintLog} onClose={() => setActivePrintLog(null)} />
      )}
    </div>
  );
};
