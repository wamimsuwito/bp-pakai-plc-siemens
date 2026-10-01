import React from "react";
import {
  LayoutDashboard,
  FileText,
  FlaskConical,
  Sliders,
  Cpu,
  Cable,
  Settings,
  Users,
  RefreshCw,
  Database,
  Printer,
  Gauge,
  BellRing,
  Building,
  LogOut,
  Tablet,
  Globe,
  Truck,
  Layers,
  AlertOctagon,
  UserX
} from "lucide-react";

interface SidebarProps {
  activeMenu: string;
  setActiveMenu: (menu: string) => void;
  onLogout: () => void;
  userRole?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeMenu,
  setActiveMenu,
  onLogout,
  userRole = "Operator"
}) => {
  const currentRole = userRole.toUpperCase();

  // If DIREKTUR, show only restricted reporting & monitoring tabs
  const getMenuItems = () => {
    if (currentRole === "DIREKTUR") {
      return [
        { id: "Dashboard Direktur", label: "Dashboard Direktur", icon: LayoutDashboard },
        { id: "Monitoring Plant", label: "Monitoring Plant", icon: Globe },
        { id: "Database Produksi", label: "Database Produksi (Produksi)", icon: Database },
        { id: "Monitoring Stok", label: "Stok Material", icon: Layers },
        { id: "Monitoring Armada", label: "Monitoring Armada", icon: Truck },
        { id: "Alert Center", label: "Alert Center", icon: AlertOctagon }
      ];
    }

    // Default admin sidebar items
    return [
      { id: "Dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "Penamaan BP", label: "Penamaan BP", icon: FileText },
      { id: "Job Mix Formula", label: "Job Mix Formula", icon: FlaskConical },
      { id: "Urutan Mixing", label: "Urutan Mixing", icon: Sliders },
      { id: "Pengaturan Relay & Pintu Mixer", label: "Pengaturan Relay & Pintu Mixer", icon: Cpu },
      { id: "Setting Com dan Port", label: "Setting Com dan Port", icon: Cable },
      { id: "Setting", label: "Setting", icon: Settings },
      { id: "Manajemen User", label: "Manajemen User", icon: Users },
      { id: "Joging Material", label: "Joging Material", icon: RefreshCw },
      { id: "Database Produksi", label: "Database Produksi", icon: Database },
      { id: "Print Tiket", label: "Print Tiket", icon: Printer },
      { id: "Kalibrasi Slump", label: "Kalibrasi Slump", icon: Gauge },
      { id: "Pengaturan Alert", label: "Pengaturan Alert", icon: BellRing },
      { id: "Pengaturan Perusahaan", label: "Pengaturan Perusahaan", icon: Building },
      { id: "Pengaturan Plant", label: "Pengaturan Plant & Sync", icon: Globe },
      { id: "Remote Tablet", label: "Remote Tablet", icon: Tablet },
      { id: "Tanpa Operator", label: "Tanpa Operator", icon: UserX }
    ];
  };

  const menuItems = getMenuItems();

  return (
    <div className="w-[280px] bg-[#0c1322] border-r border-[#1e293b]/70 flex flex-col justify-between h-full py-4 shrink-0 overflow-y-auto scrollbar-thin select-none">
      <div className="flex flex-col gap-1 px-3">
        {/* Sidebar Header Title */}
        <div className="flex items-center gap-2 px-3 pb-3 mb-2 border-b border-slate-800/80">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse shrink-0" />
          <span className="text-[12px] font-sans font-black tracking-widest text-slate-200 uppercase">
            {currentRole === "DIREKTUR" ? "Portal Komisaris" : "Menu Admin"}
          </span>
        </div>

        {/* Menu Items Loop */}
        <div className="space-y-[2px]">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeMenu === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveMenu(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-[11px] font-sans font-medium rounded-[4px] transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#1e293b] text-white font-extrabold border-l-2 border-[#00e5ff] shadow-[inset_4px_0_8px_rgba(0,229,255,0.05)]"
                    : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
                }`}
              >
                <Icon size={14} className={isActive ? "text-[#00e5ff]" : "text-slate-500"} />
                <span className="truncate text-left">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Logout button at bottom */}
      <div className="px-3 pt-3 border-t border-slate-800/60 mt-4 shrink-0">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 text-[11px] font-sans font-bold text-red-400 hover:bg-red-500/10 rounded-[4px] transition-all cursor-pointer"
        >
          <LogOut size={14} className="text-red-400" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};
