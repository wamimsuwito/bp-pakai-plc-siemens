export interface RelayRow {
  name: string;
  relay: number;
  modbusCoil: string;
  arduinoPin: string;
  timer1: string;
  timer2: string;
  timer3: string;
  timer4: string;
  timer5: string;
  timer6: string;
}

const STORAGE_KEY = "hmi_relay_configuration";

export const DEFAULT_RELAY_DATA: RelayRow[] = [
  { name: "Mixer", relay: 1, modbusCoil: "0", arduinoPin: "22", timer1: "0", timer2: "", timer3: "", timer4: "", timer5: "", timer6: "" },
  { name: "Konveyor atas", relay: 2, modbusCoil: "1", arduinoPin: "24", timer1: "1000", timer2: "", timer3: "", timer4: "", timer5: "", timer6: "" },
  { name: "Konveyor bawah", relay: 3, modbusCoil: "2", arduinoPin: "26", timer1: "1000", timer2: "", timer3: "", timer4: "", timer5: "", timer6: "" },
  { name: "Kompressor", relay: 4, modbusCoil: "3", arduinoPin: "28", timer1: "0", timer2: "", timer3: "", timer4: "", timer5: "", timer6: "" },
  { name: "Pintu pasir 1", relay: 5, modbusCoil: "4", arduinoPin: "30", timer1: "0", timer2: "", timer3: "", timer4: "", timer5: "", timer6: "" },
  { name: "Pintu pasir 2", relay: 6, modbusCoil: "5", arduinoPin: "32", timer1: "0", timer2: "", timer3: "", timer4: "", timer5: "", timer6: "" },
  { name: "Pintu batu 1", relay: 7, modbusCoil: "6", arduinoPin: "34", timer1: "0", timer2: "", timer3: "", timer4: "", timer5: "", timer6: "" },
  { name: "Pintu batu 2", relay: 8, modbusCoil: "7", arduinoPin: "36", timer1: "0", timer2: "", timer3: "", timer4: "", timer5: "", timer6: "" },
  { name: "Dump material", relay: 9, modbusCoil: "8", arduinoPin: "38", timer1: "0", timer2: "", timer3: "", timer4: "", timer5: "", timer6: "" },
  { name: "Dump material 2", relay: 10, modbusCoil: "9", arduinoPin: "40", timer1: "0", timer2: "", timer3: "", timer4: "", timer5: "", timer6: "" },
  { name: "Vibrator", relay: 11, modbusCoil: "10", arduinoPin: "42", timer1: "0", timer2: "", timer3: "", timer4: "", timer5: "", timer6: "" },
  { name: "Tuang air", relay: 12, modbusCoil: "11", arduinoPin: "44", timer1: "0", timer2: "", timer3: "", timer4: "", timer5: "", timer6: "" },
  { name: "Tuang additive", relay: 13, modbusCoil: "12", arduinoPin: "48", timer1: "0", timer2: "", timer3: "", timer4: "", timer5: "", timer6: "" },
  { name: "Pintu mixer buka 1 m³", relay: 14, modbusCoil: "13", arduinoPin: "50", timer1: "2000", timer2: "5000", timer3: "2000", timer4: "5000", timer5: "2000", timer6: "5000" },
  { name: "Pintu mixer buka 2 m³", relay: 28, modbusCoil: "13", arduinoPin: "50", timer1: "2000", timer2: "5000", timer3: "2000", timer4: "5000", timer5: "2000", timer6: "5000" },
  { name: "Pintu mixer buka 3.5 m³", relay: 29, modbusCoil: "13", arduinoPin: "50", timer1: "2000", timer2: "5000", timer3: "2000", timer4: "5000", timer5: "2000", timer6: "5000" },
  { name: "Pintu mixer tutup", relay: 15, modbusCoil: "14", arduinoPin: "52", timer1: "4000", timer2: "", timer3: "", timer4: "", timer5: "", timer6: "" },
  { name: "Klakson", relay: 16, modbusCoil: "15", arduinoPin: "33", timer1: "0", timer2: "", timer3: "", timer4: "", timer5: "", timer6: "" },
  { name: "Silo 1", relay: 17, modbusCoil: "16", arduinoPin: "31", timer1: "0", timer2: "", timer3: "", timer4: "", timer5: "", timer6: "" },
  { name: "Silo 2", relay: 18, modbusCoil: "17", arduinoPin: "35", timer1: "0", timer2: "", timer3: "", timer4: "", timer5: "", timer6: "" },
  { name: "Silo 3", relay: 19, modbusCoil: "18", arduinoPin: "37", timer1: "0", timer2: "", timer3: "", timer4: "", timer5: "", timer6: "" },
  { name: "Silo 4", relay: 20, modbusCoil: "19", arduinoPin: "39", timer1: "0", timer2: "", timer3: "", timer4: "", timer5: "", timer6: "" },
  { name: "Silo 5", relay: 21, modbusCoil: "20", arduinoPin: "41", timer1: "0", timer2: "", timer3: "", timer4: "", timer5: "", timer6: "" },
  { name: "Silo 6", relay: 22, modbusCoil: "21", arduinoPin: "43", timer1: "0", timer2: "", timer3: "", timer4: "", timer5: "", timer6: "" },
  { name: "Dump semen", relay: 23, modbusCoil: "22", arduinoPin: "45", timer1: "0", timer2: "", timer3: "", timer4: "", timer5: "", timer6: "" },
  { name: "Pintu waiting hopper", relay: 24, modbusCoil: "23", arduinoPin: "47", timer1: "0", timer2: "", timer3: "", timer4: "", timer5: "", timer6: "" },
  { name: "Spare 3", relay: 25, modbusCoil: "24", arduinoPin: "49", timer1: "0", timer2: "", timer3: "", timer4: "", timer5: "", timer6: "" },
  { name: "Spare 4", relay: 26, modbusCoil: "25", arduinoPin: "51", timer1: "0", timer2: "", timer3: "", timer4: "", timer5: "", timer6: "" },
  { name: "Spare 5", relay: 27, modbusCoil: "26", arduinoPin: "53", timer1: "0", timer2: "", timer3: "", timer4: "", timer5: "", timer6: "" }
];

export const loadRelayConfig = (): RelayRow[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return DEFAULT_RELAY_DATA.map((def) => {
        const matching = parsed.find((p: any) => p.relay === def.relay);
        if (matching) {
          return {
            ...def,
            ...matching,
            name: def.name,
            arduinoPin: matching.arduinoPin !== undefined ? matching.arduinoPin : def.arduinoPin
          };
        }
        return def;
      });
    }
  } catch (e) {
    console.error("Gagal memuat konfigurasi relay dari localStorage:", e);
  }
  return DEFAULT_RELAY_DATA;
};

export const saveRelayConfig = (data: RelayRow[]): boolean => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error("Gagal mengekalkan konfigurasi relay ke dalam localStorage:", e);
    return false;
  }
};
