import React from "react";

interface TimerInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const TimerInput: React.FC<TimerInputProps> = ({
  value,
  onChange,
  placeholder = "ms",
  disabled = false
}) => {
  return (
    <div className="relative w-full min-w-[70px] select-none">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          // Allow only numeric digits or empty value
          const cleanVal = e.target.value.replace(/[^0-9]/g, "");
          onChange(cleanVal);
        }}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full h-[26px] bg-[#070b13] border border-slate-800/85 hover:border-slate-700/90 focus:border-cyan-400 focus:shadow-[0_0_8px_rgba(34,211,238,0.2)] text-white text-[10.5px] font-mono rounded-[4px] px-2 text-center outline-hidden transition-all disabled:opacity-40 disabled:cursor-not-allowed placeholder:text-slate-600 placeholder:italic placeholder:font-sans"
      />
    </div>
  );
};
