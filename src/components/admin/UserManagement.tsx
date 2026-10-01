import React, { useState, useEffect, useMemo } from "react";
import { 
  Users, 
  Search, 
  Trash2, 
  Edit2, 
  Save, 
  Undo, 
  Check, 
  AlertTriangle, 
  ShieldAlert,
  UserCheck, 
  Lock,
  Eye,
  EyeOff,
  User,
  Shield,
  KeyRound,
  FileCheck
} from "lucide-react";
import { dotNetBackendService } from "../../lib/dotnetBackendService";

// Structure of user data specified by requirements:
export interface UserData {
  nama: string;
  nik: string;
  jabatan: "ADMIN" | "DIREKTUR" | "SUPERVISOR" | "LOGISTIK" | "OPERATOR" | "Admin" | "Operator";
  password: string;
  createdAt?: string;
  updatedAt?: string;
}

// Initial default users
const DEFAULT_USER_LIST: UserData[] = [
  {
    nama: "Administrator Utama",
    nik: "12001",
    jabatan: "ADMIN",
    password: "admin",
    createdAt: "2026-05-26 12:00",
    updatedAt: "2026-05-26 12:00"
  },
  {
    nama: "Andi Saputra",
    nik: "12002",
    jabatan: "OPERATOR",
    password: "1234",
    createdAt: "2026-05-26 12:00",
    updatedAt: "2026-05-26 12:00"
  },
  {
    nama: "Direktur Farika",
    nik: "12004",
    jabatan: "DIREKTUR",
    password: "dir",
    createdAt: "2026-06-05 08:00",
    updatedAt: "2026-06-05 08:00"
  },
  {
    nama: "Logistik Farika",
    nik: "12005",
    jabatan: "LOGISTIK",
    password: "log",
    createdAt: "2026-06-05 08:00",
    updatedAt: "2026-06-05 08:00"
  },
  {
    nama: "Supervisor Farika",
    nik: "12006",
    jabatan: "SUPERVISOR",
    password: "spv",
    createdAt: "2026-06-05 08:00",
    updatedAt: "2026-06-05 08:00"
  }
];

export const UserManagement: React.FC = () => {
  // Load users database from localStorage or default
  const [users, setUsers] = useState<UserData[]>(() => {
    const saved = localStorage.getItem("batching_plant_users");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (err) {}
    }
    return DEFAULT_USER_LIST;
  });

  // Save to DB (local storage) on changes
  useEffect(() => {
    localStorage.setItem("batching_plant_users", JSON.stringify(users));
    
    // Sync to .NET backend SQLite database
    dotNetBackendService.migrateLegacyData('users', users.map(u => ({
      nama: u.nama,
      nik: u.nik,
      jabatan: u.jabatan === "ADMIN" ? 0 : u.jabatan === "OPERATOR" ? 1 : 2,
      passwordHash: u.password
    }))).catch(() => {});

    // Immediately dispatch a custom event to update other session managers
    window.dispatchEvent(new Event("user_database_updated"));
  }, [users]);

  // Form states
  const [nama, setNama] = useState("");
  const [nik, setNik] = useState("");
  const [jabatan, setJabatan] = useState<UserData["jabatan"]>("OPERATOR");
  const [password, setPassword] = useState("");

  // Editing state - tracks index or NIK as key
  const [editNikKey, setEditNikKey] = useState<string | null>(null);

  // Search, view indicators
  const [searchQuery, setSearchQuery] = useState("");
  const [showRealPasswords, setShowRealPasswords] = useState<Record<string, boolean>>({});

  // Message notifications
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteConfNik, setDeleteConfNik] = useState<string | null>(null);

  // Auto clear message loops
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  // Form Reset
  const handleReset = () => {
    setNama("");
    setNik("");
    setJabatan("OPERATOR");
    setPassword("");
    setEditNikKey(null);
  };

  // Submit flow (SAVE / UPDATE)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validation
    const trimmedNama = nama.trim();
    const trimmedNik = nik.trim().replace(/\s+/g, "");
    const trimmedPassword = password.trim();

    if (!trimmedNama) {
      setErrorMsg("Nama Lengkap tidak boleh kosong");
      return;
    }
    if (!trimmedNik) {
      setErrorMsg("Nomor Induk Karyawan (NIK) tidak boleh kosong");
      return;
    }
    if (!trimmedPassword) {
      setErrorMsg("Password keamanan tidak boleh kosong");
      return;
    }
    if (password.length < 4) {
      setErrorMsg("Password minimal harus terdiri dari 4 karakter");
      return;
    }

    // NIK Duplication Fail-Safe check (excluding current editing user NIK key)
    const duplicateUser = users.find(u => u.nik === trimmedNik && u.nik !== editNikKey);
    if (duplicateUser) {
      setErrorMsg(`User dengan NIK "${trimmedNik}" sudah terdaftar (Nama: ${duplicateUser.nama})`);
      return;
    }

    const now = new Date();
    const dateStr = now.getFullYear() + "-" + 
                    String(now.getMonth() + 1).padStart(2, '0') + "-" + 
                    String(now.getDate()).padStart(2, '0') + " " + 
                    String(now.getHours()).padStart(2, '0') + ":" + 
                    String(now.getMinutes()).padStart(2, '0');

    if (editNikKey) {
      // Edit / Update mode
      setUsers(prev => prev.map(u => {
        if (u.nik === editNikKey) {
          return {
            nama: trimmedNama,
            nik: trimmedNik,
            jabatan,
            password: trimmedPassword,
            createdAt: u.createdAt || dateStr,
            updatedAt: dateStr
          };
        }
        return u;
      }));
      setSuccessMsg(`Data user ${trimmedNama} berhasil diperbarui.`);
      
      // Update local storage session if user edited their own active account details
      const currentActiveUserStr = localStorage.getItem("batching_plant_active_user");
      if (currentActiveUserStr) {
        try {
          const activeUserObj = JSON.parse(currentActiveUserStr);
          if (activeUserObj.nik === editNikKey) {
            localStorage.setItem("batching_plant_active_user", JSON.stringify({
              nama: trimmedNama,
              nik: trimmedNik,
              jabatan,
              password: trimmedPassword
            }));
            window.dispatchEvent(new Event("active_user_session_sync"));
          }
        } catch (e) {}
      }

    } else {
      // Save / Insert mode
      const newUser: UserData = {
        nama: trimmedNama,
        nik: trimmedNik,
        jabatan,
        password: trimmedPassword,
        createdAt: dateStr,
        updatedAt: dateStr
      };
      setUsers(prev => [newUser, ...prev]);
      setSuccessMsg(`User baru ${trimmedNama} berhasil didaftarkan ke PLC database.`);
    }

    handleReset();
  };

  // Populate form for Editing
  const handleEditTrigger = (u: UserData) => {
    setEditNikKey(u.nik);
    setNama(u.nama);
    setNik(u.nik);
    setJabatan(u.jabatan);
    setPassword(u.password);
  };

  // Delete Action Trigger & Confirmation
  const handleDeleteTrigger = (nikVal: string) => {
    // Basic fail-safe to prevent user deleting the very last Admin user in system
    const targetUser = users.find(u => u.nik === nikVal);
    const isTargetAdmin = targetUser?.jabatan === "Admin" || targetUser?.jabatan === "ADMIN";
    if (isTargetAdmin) {
      const adminsCount = users.filter(u => u.jabatan === "Admin" || u.jabatan === "ADMIN").length;
      if (adminsCount <= 1) {
        setErrorMsg("Sistem menolak: Minimal harus ada satu akun Administrator aktif.");
        return;
      }
    }
    setDeleteConfNik(nikVal);
  };

  const handleConfirmDelete = () => {
    if (deleteConfNik) {
      const match = users.find(u => u.nik === deleteConfNik);
      setUsers(prev => prev.filter(u => u.nik !== deleteConfNik));
      
      // If the deleted user matches current active user, logout immediately
      const currentActiveUserStr = localStorage.getItem("batching_plant_active_user");
      if (currentActiveUserStr) {
        try {
          const activeUserObj = JSON.parse(currentActiveUserStr);
          if (activeUserObj.nik === deleteConfNik) {
            localStorage.removeItem("admin_session");
            localStorage.removeItem("batching_plant_active_user");
            window.location.reload();
          }
        } catch (e) {}
      }

      if (match) {
        setSuccessMsg(`Akun user ${match.nama} telah dinonaktifkan.`);
      }
      setDeleteConfNik(null);
    }
  };

  // Toggle reveal password temporarily per user item
  const toggleRevealPassword = (nikVal: string) => {
    setShowRealPasswords(prev => ({
      ...prev,
      [nikVal]: !prev[nikVal]
    }));
  };

  // Filter & Search Logic
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(u => 
      u.nama.toLowerCase().includes(q) || 
      u.nik.toLowerCase().includes(q) ||
      u.jabatan.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  return (
    <div id="user-management-scada" className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto pr-1">
      
      {/* HEADER SECTION */}
      <div className="bg-[#0b1329]/80 border border-[#1e293b]/70 rounded-[6px] p-4 shrink-0 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#020617] border border-[#1e293b] rounded-[5px] text-[#00ffd0] shadow-[0_0_10px_rgba(34,211,238,0.25)]">
              <Users size={18} />
            </div>
            <div>
              <h4 className="text-sm font-sans font-black tracking-widest text-white uppercase flex items-center gap-2">
                SINKRONISASI MANAJEMEN USER & OTORITAS SKADA
                <span className="text-[7.5px] font-mono font-bold text-cyan-400 bg-cyan-950/45 border border-cyan-800/40 px-1.5 py-0.5 rounded uppercase">
                  ACTIVE DIRECTORY
                </span>
              </h4>
              <p className="text-[9.5px] font-mono text-cyan-500 uppercase tracking-wider mt-0.5">
                Konfigurasi Akses Keamanan Operator Batching Plant dan Pembatasan Fitur Kontrol PLC
              </p>
            </div>
          </div>
          
          <div className="bg-slate-900 border border-slate-800 px-3 py-1 rounded flex items-center gap-2">
            <span className="text-[8px] font-mono text-slate-500 uppercase font-black">TOTAL REGISTRASI</span>
            <span className="font-mono text-xs font-bold text-cyan-400">{users.length} USER</span>
          </div>
        </div>
      </div>

      {/* CORE SYSTEM PANELS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* LEFT PANEL: SUBMIT / EDIT FORM */}
        <div className="lg:col-span-4 bg-[#080d1a]/95 border border-[#1e293b]/50 rounded-[6px] p-4 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-3">
            <span className="text-[10px] font-sans font-black tracking-widest text-slate-100 uppercase flex items-center gap-1.5">
              <Shield size={11.5} className="text-cyan-400 animate-pulse" />
              {editNikKey ? "UBAH INFORMASI USER" : "DAFTAR USER BARU PLC"}
            </span>
            {editNikKey && (
              <button 
                onClick={handleReset}
                className="text-[8.5px] font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1 shrink-0 uppercase cursor-pointer"
              >
                <Undo size={10} /> RESET FORM
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            {/* Field: Nama */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9.5px] font-sans font-black text-slate-400 uppercase tracking-wider">
                Nama Lengkap Karyawan <span className="text-rose-500">*</span>
              </span>
              <div className="relative">
                <User size={12} className="absolute left-3 top-3 text-cyan-500" />
                <input
                  type="text"
                  placeholder="Contoh: Budi Prasetyo"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  maxLength={30}
                  required
                  className="bg-[#020617] border border-slate-800 text-slate-200 pl-9 pr-3 py-2 rounded-[4px] text-xs font-mono font-bold uppercase focus:border-cyan-400 outline-none w-full"
                />
              </div>
            </div>

            {/* Field: NIK */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9.5px] font-sans font-black text-slate-400 uppercase tracking-wider">
                NIK (Nomor Induk Karyawan) <span className="text-rose-500">*</span>
              </span>
              <div className="relative">
                <FileCheck size={12} className="absolute left-3 top-3 text-cyan-500" />
                <input
                  type="text"
                  placeholder="Contoh: 12001"
                  value={nik}
                  onChange={(e) => setNik(e.target.value)}
                  maxLength={15}
                  required
                  disabled={editNikKey !== null} // Lock NIK identifier during modifications to keep database integrity safe
                  className={`bg-[#020617] border border-slate-800 text-slate-200 pl-9 pr-3 py-2 rounded-[4px] text-xs font-mono font-bold focus:border-cyan-400 outline-none w-full ${
                    editNikKey !== null ? "opacity-55 cursor-not-allowed text-slate-500" : ""
                  }`}
                />
              </div>
            </div>

            {/* Field: Jabatan (Dropdown Otoritas) */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9.5px] font-sans font-black text-slate-400 uppercase tracking-wider">
                Jabatan / Hak Otoritas <span className="text-rose-500">*</span>
              </span>
              <div className="relative">
                <select
                  value={jabatan}
                  onChange={(e) => setJabatan(e.target.value as any)}
                  className="bg-[#020617] border border-slate-800 text-cyan-400 px-3.5 py-2 rounded-[4px] text-xs font-mono font-black uppercase focus:border-cyan-400 outline-none w-full appearance-none cursor-pointer"
                >
                  <option value="ADMIN" className="bg-[#020617] text-[#00ffd0]">
                    ADMIN [ AKSES PENUH ]
                  </option>
                  <option value="DIREKTUR" className="bg-[#020617] text-teal-400">
                    DIREKTUR [ MONITORING & DASHBOARD ]
                  </option>
                  <option value="SUPERVISOR" className="bg-[#020617] text-blue-400">
                    SUPERVISOR [ MONITORING PLANT ]
                  </option>
                  <option value="LOGISTIK" className="bg-[#020617] text-amber-550">
                    LOGISTIK [ STOK & MATERIAL ]
                  </option>
                  <option value="OPERATOR" className="bg-[#020617] text-slate-300">
                    OPERATOR [ PRODUKSI UTAMA ]
                  </option>
                  <option value="Admin" className="hidden">Admin</option>
                  <option value="Operator" className="hidden">Operator</option>
                </select>
                <div className="absolute right-3.5 top-[13px] pointer-events-none w-2 h-2 border-r-2 border-b-2 border-cyan-400 rotate-45" />
              </div>
            </div>

            {/* Field: Password */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9.5px] font-sans font-black text-slate-400 uppercase tracking-wider">
                Password Keamanan (Min 4 Karakter) <span className="text-rose-500">*</span>
              </span>
              <div className="relative">
                <KeyRound size={12} className="absolute left-3 top-3 text-cyan-500" />
                <input
                  type="password"
                  placeholder="Min 4 digit keamanan"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  maxLength={20}
                  required
                  className="bg-[#020617] border border-slate-800 text-slate-200 pl-9 pr-3 py-2 rounded-[4px] text-xs font-mono font-bold focus:border-cyan-400 outline-none w-full"
                />
              </div>
            </div>

            {/* Actions Buttons */}
            <div className="flex gap-2 pt-3 border-t border-slate-900">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white font-sans text-[10px] uppercase font-black tracking-wider rounded transition-colors cursor-pointer"
              >
                RESET
              </button>
              <button
                type="submit"
                className="flex-[2] py-2 bg-cyan-400 hover:bg-cyan-300 text-black font-sans text-[10px] uppercase font-black tracking-wider rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
              >
                <Save size={12} />
                {editNikKey ? "UPDATE USER" : "SIMPAN USER"}
              </button>
            </div>
          </form>

          {/* Messages Alert Block */}
          {successMsg && (
            <div className="mt-3.5 bg-emerald-950/45 border border-emerald-800/60 p-2.5 rounded text-[9.5px] font-mono text-emerald-300 text-left flex items-start gap-1.5 uppercase leading-normal">
              <Check size={11.5} className="shrink-0 mt-0.5 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="mt-3.5 bg-rose-950/45 border border-rose-800/60 p-2.5 rounded text-[9.5px] font-mono text-rose-300 text-left flex items-start gap-1.5 uppercase leading-normal">
              <AlertTriangle size={11.5} className="shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: REGISTERED USERS DIRECTORY VIEW */}
        <div className="lg:col-span-8 bg-[#080d1a]/95 border border-[#1e293b]/50 rounded-[6px] p-4 flex flex-col min-h-0 overflow-hidden">
          
          {/* SEARCH BOX & DESCRIPTIONS */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-b border-slate-900 pb-3 mb-3">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <div className="relative w-full">
                <Search size={12} className="absolute left-2.5 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Cari nama, NIK, atau jabatan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#020617] border border-slate-800 text-slate-200 pl-8 pr-3 py-1.5 rounded-[4px] text-xs font-mono focus:border-cyan-400 outline-none"
                />
              </div>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-[9px] font-mono text-slate-550 hover:text-slate-300 uppercase shrink-0"
                >
                  Clear
                </button>
              )}
            </div>

            <span className="text-[8.5px] font-mono text-cyan-500 uppercase tracking-widest font-black shrink-0">
              ⚡ LIVE INTEGRATION: MEMORY OMRON PLC ACTIVE
            </span>
          </div>

          {/* USER DIRECTORY DATATABLE */}
          <div className="flex-1 overflow-x-auto min-h-0">
            {filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <ShieldAlert size={28} className="text-amber-500/50 mb-2" />
                <span className="font-mono text-[9px] uppercase">User / Pekerja tidak ditemukan dalam database lokal HMI.</span>
              </div>
            ) : (
              <table className="w-full text-left font-mono text-[10px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 uppercase text-[9px] font-black">
                    <th className="py-2.5 px-2">Nama Lengkap</th>
                    <th className="py-2.5">NIK Karyawan</th>
                    <th className="py-2.5">Jabatan / Otoritas</th>
                    <th className="py-2.5">Password Key</th>
                    <th className="py-2.5 text-center px-1">Tindakan Kontrol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 text-slate-300">
                  {filteredUsers.map((item) => {
                    const isEditingThisUser = editNikKey === item.nik;
                    const showPass = !!showRealPasswords[item.nik];

                    return (
                      <tr 
                        key={item.nik} 
                        className={`transition-colors hover:bg-slate-900/40 ${
                          isEditingThisUser ? "bg-cyan-950/25 border-l-2 border-cyan-400" : ""
                        }`}
                      >
                        {/* Nama */}
                        <td className="py-3 px-2 text-white font-bold flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            (item.jabatan === "Admin" || item.jabatan === "ADMIN") ? "bg-[#00ffd0] shadow-[0_0_6px_rgba(34,211,238,0.7)]" : "bg-slate-500"
                          }`} />
                          <span className="uppercase">{item.nama}</span>
                        </td>
                        
                        {/* NIK */}
                        <td className="py-3 text-slate-300 font-bold uppercase">{item.nik}</td>
                        
                        {/* Jabatan with Badge */}
                        <td className="py-3">
                          <span className={`inline-block text-[8px] font-sans font-black px-2 py-0.5 rounded tracking-widest uppercase ${
                            (item.jabatan === "Admin" || item.jabatan === "ADMIN") 
                              ? "bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 shadow-[0_0_4px_rgba(6,182,212,0.15)]" 
                              : item.jabatan === "DIREKTUR"
                              ? "bg-teal-950/80 text-teal-400 border border-teal-800"
                              : item.jabatan === "SUPERVISOR"
                              ? "bg-blue-950/80 text-blue-400 border border-blue-800"
                              : item.jabatan === "LOGISTIK"
                              ? "bg-amber-950/80 text-amber-500 border border-amber-800"
                              : "bg-slate-900 text-slate-400 border border-slate-800"
                          }`}>
                            {item.jabatan}
                          </span>
                        </td>

                        {/* Password Key masked/obscured securely */}
                        <td className="py-3">
                          <div className="flex items-center gap-1.5 min-w-[100px]">
                            <span className="text-slate-450 tracking-wider">
                              {showPass ? item.password : "••••••••"}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleRevealPassword(item.nik)}
                              title="Tampil / Sembunyikan Password"
                              className="text-slate-500 hover:text-cyan-400 p-0.5"
                            >
                              {showPass ? <EyeOff size={11} /> : <Eye size={11} />}
                            </button>
                          </div>
                        </td>

                        {/* Edit & Delete Action Row Buttons */}
                        <td className="py-3 text-center px-2">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditTrigger(item)}
                              title="Ubah data keamanan akun"
                              className="p-1 px-1.5 text-slate-400 hover:text-cyan-400 bg-slate-900 border border-slate-850 hover:border-cyan-950 rounded transition-all cursor-pointer flex items-center justify-center"
                            >
                              <Edit2 size={10} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTrigger(item.nik)}
                              title="Hapus user akun dari PLC"
                              className="p-1 px-1.5 text-rose-500 hover:text-rose-400 bg-slate-900 border border-slate-850 hover:border-rose-950 rounded transition-all cursor-pointer flex items-center justify-center"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* SCADA SECURITY LOCK FOOTNOTE INSTRUCTION */}
          <div className="mt-4 p-3 bg-slate-950 border border-slate-900 rounded-[4px] text-left">
            <span className="text-[8px] font-mono text-cyan-500 uppercase font-black tracking-wider block">ℹ SECURITY CORE AUDIT NOTE</span>
            <p className="text-[8.5px] font-mono text-slate-400 leading-normal mt-1 uppercase">
              SEMUA USER TERINTEGRASI SECARA INSTAN PADA DIALOG LOGIN SECURITY TERPUSAT. APABILA OPERATOR MASUK DENGAN ROLE "OPERATOR", MEREKA HANYA DAPAT MENJALANKAN PENGAWASAN DAN PRODUKSI BATCHING AGREGAT PADA LAYAR UTAMA (HMI), DAN TIDAK DAPAT MENGUBAH SETELAN PORT PLC ATAU ADMIN SENSITIF LAINNYA.
            </p>
          </div>

        </div>

      </div>

      {/* CONFIRM DELETE MODAL BACKDROP OVERLAY */}
      {deleteConfNik && (
        <div className="fixed inset-0 z-[400] bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0b1329] border-2 border-rose-500/70 rounded-[6px] p-5 max-w-sm w-full shadow-[0_0_20px_rgba(239,68,68,0.25)] select-none">
            <h5 className="text-[11px] font-sans font-black text-rose-500 uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle size={15} />
              KONFIRMASI NONAKTIFKAN USER!
            </h5>
            <p className="text-[10px] font-mono text-slate-300 uppercase leading-relaxed mt-2.5 text-left">
              Yakin ingin menghapus user ini? Akun karyawan ini tidak akan bisa digunakan kembali untuk login ke panel kontrol Batching Plant SCADA.
            </p>
            <div className="flex gap-2.5 mt-4 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfNik(null)}
                className="px-4 py-1.5 bg-slate-900 border border-slate-800 text-slate-300 font-sans text-[8.5px] font-extrabold uppercase rounded cursor-pointer transition-colors"
              >
                BATAL
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-sans text-[8.5px] font-extrabold uppercase rounded cursor-pointer transition-colors shadow-sm"
              >
                HAPUS USER
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
