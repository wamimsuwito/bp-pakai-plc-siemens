/**
 * FIRMWARE KONTROLER RELAI & PANEL FISIK ARDUINO MEGA 2560 - BATCHING PLANT HMI
 * 
 * Deskripsi:
 * Sketch ini berfungsi sebagai jembatan kontrol full-stack antara panel operator fisik
 * dengan aplikasi Web HMI. Program ini menangani:
 * 1. Output Relai: Mengontrol 27 relai digital melalui perintah "RELAY:..." dari HMI.
 * 2. Input Tombol Fisik: Membaca panel tombol manual operator berkabel di lapangan,
 *    mengunggah status tombol ke HMI untuk sinkronisasi tombol layar.
 * 3. Sensor analog: Membaca analog CT Ampere sensor (A0) dan analog Pressure Transducer (A1).
 * 4. Sistem Darurat: Membaca tombol fisik Emergency Stop (Pin 2). Jika ditekan, semua output
 *    dimatikan seketika pada tingkat hardware, serta mengirimkan bendera estop ke HMI.
 * 5. Watchdog Keselamatan: Mematikan seluruh mesin secara mandiri jika terputus dari komputer selama 5 detik.
 * 
 * Wiring & Hubungan Kabel Panel:
 * Seluruh tombol input dikonfigurasi sebagai INPUT_PULLUP. Hubungkan salah satu kaki tombol 
 * ke terminal GROUND (GND) dan kaki yang lainnya langsung ke Pin input Arduino di bawah ini.
 * Saat tombol tertutup (ditekan), pin akan berada pada level LOW (aktif).
 * 
 * --- DAFTAR ALOKASI PIN ARDUINO MEGA 2560 ---
 * 
 * A. INPUT DARURAT (EMERGENCY STOP)
 * - Pin 2  : Saklar Emergency Stop (Aktif LOW / Terhubung ke GND saat ditekan)
 * 
 * B. INPUT TOMBOL FISIK MANUAL (PANEL BYPASS OPERATOR)
 * - Pin 3  : Pasir 1
 * - Pin 4  : Pasir 2
 * - Pin 5  : Batu 1
 * - Pin 6  : Batu 2
 * - Pin 7  : Silo Semen (Sekrup Semen)
 * - Pin 8  : Valve Air Timbang
 * - Pin 9  : Pintu Buang Pasir
 * - Pin 10 : Pintu Buang Batu
 * - Pin 11 : Pintu Buang Semen
 * - Pin 12 : Valve Buang Air Timbang
 * - Pin 14 : Feeder Conveyor Bawah
 * - Pin 15 : Inclined Conveyor Atas
 * - Pin 16 : Motor Mixer Shaft
 * - Pin 17 : Vibrator Hopper
 * - Pin 18 : Kompressor Komersial
 * - Pin 19 : Klakson Warning
 * - Pin 20 : Waiting Hopper Gate
 * - Pin 21 : Admix In Valve
 * - Pin A2 (Pin digital 56) : Pintu Mixer Buka
 * - Pin A3 (Pin digital 57) : Pintu Mixer Tutup
 * 
 * C. INPUT SENSOR ANALOG
 * - Pin A0 : Non-invasive AC Current Transformer (CT) - Ampere Mixer (Skala Linear)
 * - Pin A1 : Air Compressor Pressure Transducer (0-1.2 MPa / Skala 0.5V-4.5V = 0-150 PSI)
 * 
 * D. OUTPUT MODUL RELAY (AKTIF LOW BY DEFAULT)
 * - Pin 22 : Relay 1  (Mixer Shaft Motor)
 * - Pin 24 : Relay 2  (Konveyor Atas / Main Feeder)
 * - Pin 26 : Relay 3  (Konveyor Bawah / Bottom Conveyor)
 * - Pin 28 : Relay 4  (Kompressor Angin)
 * - Pin 30 : Relay 5  (Pintu Pasir 1 Gate)
 * - Pin 32 : Relay 6  (Pintu Pasir 2 Gate)
 * - Pin 34 : Relay 7  (Pintu Batu 1 Gate)
 * - Pin 36 : Relay 8  (Pintu Batu 2 Gate)
 * - Pin 38 : Relay 9  (Dump Material Pasir)
 * - Pin 40 : Relay 10 (Dump Material Batu)
 * - Pin 42 : Relay 11 (Vibrator Hopper)
 * - Pin 44 : Relay 12 (Tuang Air Timbang Valve)
 * - Pin 48 : Relay 13 (Tuang Additive Valve)
 * - Pin 50 : Relay 14 (Pintu Mixer Buka)
 * - Pin 52 : Relay 15 (Pintu Mixer Tutup)
 * - Pin 33 : Relay 16 (Klakson Sirene)
 * - Pin 31 : Relay 17 (Katup Silo Semen 1)
 * - Pin 35 : Relay 18 (Katup Silo Semen 2)
 * - Pin 37 : Relay 19 (Katup Silo Semen 3)
 * - Pin 39 : Relay 20 (Katup Silo Semen 4)
 * - Pin 41 : Relay 21 (Katup Silo Semen 5)
 * - Pin 43 : Relay 22 (Katup Silo Semen 6)
 * - Pin 45 : Relay 23 (Spare 1 / Dump Semen Hopper)
 * - Pin 47 : Relay 24 (Pintu Waiting Hopper Gate)
 * - Pin 49 : Relay 25 (Spare 3)
 * - Pin 51 : Relay 26 (Spare 4)
 * - Pin 53 : Relay 27 (Spare 5)
 */

// Konfigurasi Jenis Modul Relai (Ubah ke true jika menggunakan modul relay aktif LOW)
const bool ACTIVE_LOW_RELAYS = true; 

// Output Relays Pin Mapping
const int NUM_RELAYS = 27;
const int relayPins[NUM_RELAYS] = {
  22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 48, 50, 52, 33, 31, 35, 37, 39, 41, 43, 45, 47, 49, 51, 53
};

// Input Emergency Stop Pin
const int ESTOP_PIN = 2;

// Input Manual Panel Buttons Setup
const int NUM_BUTTONS = 20;
const int buttonPins[NUM_BUTTONS] = {
  3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, A2, A3
};

// Keys corresponding to buttons for telemetry mapping
const char* buttonKeys[NUM_BUTTONS] = {
  "pasir1", "pasir2", "batu1", "batu2", "semen", "air", 
  "dump_pasir", "dump_batu", "dump_semen", "dump_air",
  "conveyor_bawah", "conveyor_atas", "mixer", "vibrator", "compressor", "klakson",
  "waiting_hopper", "admix", "mixer_buka", "mixer_tutup"
};

// Status penyimpanan relai
bool currentStates[NUM_RELAYS] = {false};

// LED Indikator Onboard
const int LED_INDICATOR = 13;

// Safety Watchdog (Otomatis MATI jika koneksi terputus)
unsigned long lastHeartbeatTime = 0;
const unsigned long TIMEOUT_THRESHOLD_MS = 5000; // 5 Detik

// Non-blocking Telemetry Interval
unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL_MS = 200; // Transmisi data 5 kali per detik (5 Hz)

void setup() {
  // Inisialisasi komunikasi Serial dengan Baud Rate tinggi
  Serial.begin(115200);
  
  // Konfigurasi seluruh Pin Relai sebagai OUTPUT
  for (int i = 0; i < NUM_RELAYS; i++) {
    pinMode(relayPins[i], OUTPUT);
    digitalWrite(relayPins[i], ACTIVE_LOW_RELAYS ? HIGH : LOW);
  }
  
  // Konfigurasi Pin Emergency Stop dengan Resistor Pull-Up Internal
  pinMode(ESTOP_PIN, INPUT_PULLUP);

  // Konfigurasi Pin Sensor Keberadaan Truk (A4) & Tombol Driver (A5) sebagai INPUT_PULLUP
  pinMode(A4, INPUT_PULLUP);
  pinMode(A5, INPUT_PULLUP);
  
  // Konfigurasi Panel Tombol Fisik berkabel dengan Resistor Pull-Up Internal
  for (int i = 0; i < NUM_BUTTONS; i++) {
    pinMode(buttonPins[i], INPUT_PULLUP);
  }
  
  pinMode(LED_INDICATOR, OUTPUT);
  digitalWrite(LED_INDICATOR, LOW);
  
  lastHeartbeatTime = millis();
  
  // Kirim sinyal boot ke konsol HMI
  Serial.println("ARDUINO MEGA 2560 BATCHING PLANT CONTROLLER READY: OK");
  Serial.print("PIN CONFIGURATION: 22 TO 53. TOTAL RELAY: ");
  Serial.println(NUM_RELAYS);
}

void loop() {
  // --- KESELAMATAN LEVEL PERTAMA: PANTAU TOMBOL EMERGENCY DARURAT ---
  // Karena menggunakan INPUT_PULLUP, saat ditekan maka saklar akan mengalirkan Ground, membaca LOW.
  if (digitalRead(ESTOP_PIN) == LOW) {
    emergencySafetyShutdown();
    // Kirim telemetry estop aktif instan tanpa jeda
    Serial.println("{\"estop\":1,\"pressure\":0.0,\"ampere\":0.0}");
    delay(100);
    return;
  }

  // --- KOMUNIKASI SERIAL: TERIMA PERINTAH DARI HMI ---
  if (Serial.available() > 0) {
    String inputLine = Serial.readStringUntil('\n');
    inputLine.trim();
    
    // Protokol Frame: "RELAY:1,0,0,1,0..."
    if (inputLine.startsWith("RELAY:")) {
      lastHeartbeatTime = millis(); // Segarkan watchdog timer
      digitalWrite(LED_INDICATOR, HIGH); // Flash LED visual
      
      String payload = inputLine.substring(6); // Ambil data setelah "RELAY:"
      parseAndApplyRelays(payload);
      
      // Kirim balik verifikasi status (ACK) ke konsol HMI
      Serial.print("ACK_OK:STATES=");
      Serial.println(payload);
      
      delay(2);
      digitalWrite(LED_INDICATOR, LOW);
    }
  }
  
  // --- TRANSMISI SENSOR & PANEL TELEMETRI (NON-BLOCKING) ---
  unsigned long currentMillis = millis();
  if (currentMillis - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = currentMillis;
    transmitTelemetry();
  }
  
  // --- HARDWARE SAFETY WATCHDOG DISCONNECT CHECKS ---
  if (millis() - lastHeartbeatTime > TIMEOUT_THRESHOLD_MS) {
    bool hasActiveOutputs = false;
    for (int i = 0; i < NUM_RELAYS; i++) {
      if (currentStates[i]) {
        hasActiveOutputs = true;
        break;
      }
    }
    
    if (hasActiveOutputs) {
      emergencySafetyShutdown();
    }
  }
}

/**
 * Membaca sensor analog, tombol manual fisik panel, menyusun JSON, dan mentransmisikannya ke HMI
 */
void transmitTelemetry() {
  // 1. Membaca Ampere Mixer AC CT sensor (Analog A0)
  int rawAmpValue = analogRead(A0);
  float voltageAmp = (rawAmpValue * 5.0) / 1023.0;
  // Kalibrasi standar CT: Misalkan 0V = 0 Ampere, maks 5V = 150 Ampere
  float ampereMixer = voltageAmp * 30.0;
  // Jika mesin mixer mati (pin relay Mixer mati), amankan ampere ke nol (opsional)
  if (!currentStates[0]) {
    ampereMixer = 0.0;
  }
  
  // 2. Membaca Sensor Tekanan Kompresor Pressure Transducer (Analog A1)
  int rawPressValue = analogRead(A1);
  float voltagePress = (rawPressValue * 5.0) / 1023.0;
  // Standar transducer industri: Output 0.5V pada 0 PSI (0 Bar) dan 4.5V pada 150 PSI (10 Bar)
  float pressureCompressor = 0.0;
  if (voltagePress >= 0.5) {
    pressureCompressor = (voltagePress - 0.5) * (150.0 / 4.0);
  }
  if (pressureCompressor < 0.0) pressureCompressor = 0.0;

  // 3. Membaca Sensor Keberadaan Truk (Pin A4) & Tombol Driver (Pin A5)
  bool isTruckOnLoading = (digitalRead(A4) == LOW);
  bool isDriverReleasePressed = (digitalRead(A5) == LOW);
  
  // 4. Membaca tombol-tombol fisik panel operator (Pin 3 - 21, A2, A3)
  // Bentuk JSON manual yang sangat ringan tanpa modul eksternal ArduinoJson agar hemat memori SRAM Mega
  Serial.print("{\"estop\":0,");
  Serial.print("\"pressure\":");
  Serial.print(pressureCompressor, 1);
  Serial.print(",\"ampere\":");
  Serial.print(ampereMixer, 1);
  Serial.print(",\"truck\":");
  Serial.print(isTruckOnLoading ? "1" : "0");
  Serial.print(",\"driver\":");
  Serial.print(isDriverReleasePressed ? "1" : "0");
  Serial.print(",\"btn\":{");
  
  for (int i = 0; i < NUM_BUTTONS; i++) {
    // Dengan INPUT_PULLUP, ditekan terbaca LOW, dilepas terbaca HIGH
    bool isButtonPressed = (digitalRead(buttonPins[i]) == LOW);
    
    Serial.print("\"");
    Serial.print(buttonKeys[i]);
    Serial.print("\":");
    Serial.print(isButtonPressed ? "1" : "0");
    
    if (i < NUM_BUTTONS - 1) {
      Serial.print(",");
    }
  }
  Serial.println("}}");
}

/**
 * Memisahkan baris comma-delimited string dari HMI dan menerapkan output ke pin relay fisik
 */
void parseAndApplyRelays(String data) {
  int relayIndex = 0;
  int strIndex = 0;
  
  while (relayIndex < NUM_RELAYS && strIndex < data.length()) {
    int commaIndex = data.indexOf(',', strIndex);
    String bitValStr;
    
    if (commaIndex == -1) {
      bitValStr = data.substring(strIndex);
      strIndex = data.length();
    } else {
      bitValStr = data.substring(strIndex, commaIndex);
      strIndex = commaIndex + 1;
    }
    
    bitValStr.trim();
    bool stateValue = (bitValStr == "1");
    currentStates[relayIndex] = stateValue;
    
    // Terapkan level tegangan berdasarkan jenis relai (Active-Low/Active-High)
    if (ACTIVE_LOW_RELAYS) {
      digitalWrite(relayPins[relayIndex], stateValue ? LOW : HIGH);
    } else {
      digitalWrite(relayPins[relayIndex], stateValue ? HIGH : LOW);
    }
    
    relayIndex++;
  }
}

/**
 * Mematikan semua relai secara instan jika darurat ditekan atau koneksi serial terputus
 */
void emergencySafetyShutdown() {
  for (int i = 0; i < NUM_RELAYS; i++) {
    currentStates[i] = false;
    digitalWrite(relayPins[i], ACTIVE_LOW_RELAYS ? HIGH : LOW);
  }
  
  // Led berkedip ekstrim cepat tanda shutdown aktif
  digitalWrite(LED_INDICATOR, HIGH);
  delay(50);
  digitalWrite(LED_INDICATOR, LOW);
  delay(50);
  digitalWrite(LED_INDICATOR, HIGH);
  delay(50);
  digitalWrite(LED_INDICATOR, LOW);
  
  Serial.println("[WARNING] KONEKSI PUTUS ATAU EMERGENCY DARURAT AKTIF! SELURUH OUTPUT UNIT DIMATIKAN.");
  lastHeartbeatTime = millis();
}
