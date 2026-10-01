import React from "react";
import { Save, Download } from "lucide-react";

interface ActionButtonsProps {
  onSave: () => void;
  onExport: () => void;
  isSaving?: boolean;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onSave,
  onExport,
  isSaving = false
}) => {
  return (
    <div className="flex items-center justify-end gap-3 shrink-0 py-2 mt-1 select-none">
      {/* Export Configuration Button */}
      <button
        type="button"
        onClick={onExport}
        className="px-4.5 py-2 bg-[#1e293b]/70 hover:bg-[#1e293b]/95 border border-slate-700/80 hover:border-slate-600 rounded-[5px] text-white font-sans font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md active:scale-97 cursor-pointer"
      >
        <Download size={13} className="text-slate-300" />
        <span>Export Config</span>
      </button>

      {/* Save Settings Button */}
      <button
        type="button"
        disabled={isSaving}
        onClick={onSave}
        className="px-5 py-2 bg-[#00ffd0] hover:bg-[#00e5ff] disabled:bg-[#00ffd0]/50 text-black font-sans font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(0,255,208,0.25)] hover:shadow-[0_0_16px_rgba(0,229,255,0.4)] active:scale-97 cursor-pointer"
      >
        {isSaving ? (
          <>
            <span className="w-3 h-3 rounded-full border-2 border-black border-t-transparent animate-spin inline-block" />
            <span>Menyimpan...</span>
          </>
        ) : (
          <>
            <Save size={13} />
            <span>Simpan Pengaturan</span>
          </>
        )}
      </button>
    </div>
  );
};
