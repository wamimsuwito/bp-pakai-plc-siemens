# 📋 PANDUAN LENGKAP INSTALASI, PENGKABELAN, DAN INTEGRASI SISTEM
## BATCHING PLANT HMI - ARDUINO MEGA 2560 PLC HYBRID SYSTEM

Panduan ini berisi metode instalasi hardware, skema pengkabelan (*wiring diagram*), spesifikasi sensor, konfigurasi pin, dan langkah-langkah *commissioning* untuk sistem otomatisasi Batching Plant berbasis Web-HMI & Arduino Mega 2560 dengan penambahan **Mode Operatorless (Tanpa Operator)**, **Interlock Tekanan Udara Kompresor**, dan **Keamanan Tombol Darurat Fisik**.

---

## 1. DAFTAR KEBUTUHAN HARDWARE & PERALATAN

Untuk merakit panel kontrol otomatisasi ini, Anda memerlukan komponen-komponen standar industri berikut:

| No | Komponen Utama | Spesifikasi Minimum / Rekomendasi | Fungsi Utama |
| :--- | :--- | :--- | :--- |
| 1 | **Kontroler Utama** | Mikrokontroler Arduino Mega 2560 R3 Original (chip ATMega2560) | Otak pemroses instruksi relai, pembaca tombol fisik panel, dan sensor analog. |
| 2 | **Modul Relai** | Modul Relay Board 27-Saluran atau 4 unit Modul Relay 8-Channel (Aktif LOW, 5VDC optocoupler isolation) | Trigger tegangan AC/DC untuk kontaktor motor, katup gate pneumatik, solenoid. |
| 3 | **Tombol Fisik** | Tombol Push-Button Industri Momentary (Normally Open - NO) diameter 22mm | Override manual fisik untuk operator di panel kontrol luar. |
| 4 | **Tombol Darurat** | Tombol Mushroom Emergency Stop Switch Latching (Kontak NC + NO) | Memutus aliran aliran kontrol utama seketika saat keadaan bahaya. |
| 5 | **Sensor Arus Mixer** | Non-Invasive AC Current Transformer (CT Sensor) SCT-013-000 (0-100A AC) + ADC resistor divider | Mengukur beban kerja motor mixer untuk penaksiran nilai Slump Beton secara real-time. |
| 6 | **Sensor Tekanan** | Industrial Air Pressure Transducer 0-1.2 MPa (174 PSI) dengan output tegangan linear 0.5V - 4.5V | Memonitor tekanan angin pada kompresor angin pneumatik di layar HMI. |
| 7 | **Proximity Truk** | Heavy-duty Inductive/Photoelectric Limit Switch Sensor (Output NPN NO) | Mendeteksi keberadaan truk mixer di area loading talang pengisian. |
| 8 | **Tombol Supir** | Tombol Push-Button Logam Industri 22mm IP67 (Normally Open - NO) | Tombol fisik supir untuk memicu pelepasan beton setelah posisi truk lurus. |
| 9 | **Catu Daya (PSU)** | Switching Power Supply Industri 5VDC (5 Ampere) & 24VDC (sesuai sistem Solenoid Valve) | Menyuplai daya stabil ke Arduino, koil modul relay, dan sensor-sensor pendukung. |

---

## 2. DIAGRAM ARSITEKTUR KONEKSI FISIK (SISTEM HYBRID)

```
                                  [ SERVER KONTROL / PC WINDOWS HMI ]
                                                  |
                                         USB Serial Cable (115200 Bps)
                                                  |
                                     [ ARDUINO MEGA 2560 R3 ] 
                                     /          |           \
                 (Input Analog & Digital)       |        (Output Digital Relai)
                 /          |           \       |                  \
       [SENSOR-SENSOR]  [TOMBOL PANEL]   \   [SAFETY]         [MODUL RELAY 27-CH]
          - CT A0         - Pin 3-21,     \  - Pin 2 (E-Stop)      - Pin 22 - 53
          - Pressure A1     A2, A3        |                        - Kontaktor Motor
                                    [OPERATORLESS]                 - Solenoid Valve
                                    - Pin A4 (Truk)                - Piston Pneumatik
                                    - Pin A5 (Tombol Supir)
```

---

## 3. ALOKASI DETIL PIN ARDUINO MEGA 2560

### BAGIAN A: ANTARMUKA INPUT KESELAMATAN & OTOMATISASI (INPUT_PULLUP)
Seluruh tombol fisik dan sensor proximity di bawah ini menggunakan konfigurasi **INPUT_PULLUP**. Hubungkan pin output sensor / salah satu terminal switch ke Pin Arduino, dan terminal lainnya ke **GROUND (GND)**. Saat aktif (tertutup / terdeteksi), pin bernilai **LOW**.

| Pin Mega | Kunci Data HMI | Detail Sensor / Fungsi Perangkat | Deskripsi Integrasi Fisik |
| :---: | :--- | :--- | :--- |
| **Pin 2** | `estop` | Tombol Emergency Stop Fisik | Memutus seketika semua output relai di tingkat firmware hardware & mematikan siklus HMI. |
| **Pin A4** | `truck` | Sensor Proximity Keberadaan Truk | Sensor logam / infrared dipasang di talang loading. Bernilai `1` ketika truk mixer berada di posisinya. |
| **Pin A5** | `driver` | Tombol Rilis Beton Driver Truk | Tombol pushbutton industri di jangkauan posisi driver untuk memicu pelepasan beton dari twin-shaft. |

---

### BAGIAN B: SENSOR TELEMETRI ANALOG (0 - 5V)

| Pin Mega | Kunci Data HMI | Deskripsi Fungsional Perangkat | Skema Kalibrasi & Nilai Voltase |
| :---: | :--- | :--- | :--- |
| **Pin A0** | `ampere` | Sensor Arus CT Mixer (AC Clamp) | 0V - 5V dipetakan ke 0 - 150 Ampere. Digunakan oleh HMI untuk estimasi nilai Slump beton. |
| **Pin A1** | `pressure` | Transducer Tekanan Angin Kompresor | 0.5V (0 PSI) hingga 4.5V (150 PSI). Dipantau oleh interlock pengaman katup pneumatik. |

---

### BAGIAN C: INPUT PANEL MANUAL OPERATOR (SINKRONISASI TOMBOL LAYAR)
Konfigurasi kabel: Switch Normally Open (NO) menghubungkan Pin Arduino ke **GND** saat ditekan.

| Pin Mega | Kunci Data HMI | Fungsi Tombol Fisik Panel |
| :---: | :--- | :--- |
| **Pin 3** | `pasir1` | Manual Buka Pintu Pasir 1 |
| **Pin 4** | `pasir2` | Manual Buka Pintu Pasir 2 |
| **Pin 5** | `batu1` | Manual Buka Pintu Batu 1 |
| **Pin 6** | `batu2` | Manual Buka Pintu Batu 2 |
| **Pin 7** | `semen` | Manual Jalankan Sekrup/Silo Semen |
| **Pin 8** | `air` | Manual Buka Katup Air |
| **Pin 9** | `dump_pasir` | Manual Tuang Timbangan Pasir ke Conveyor |
| **Pin 10** | `dump_batu` | Manual Tuang Timbangan Batu ke Conveyor |
| **Pin 11** | `dump_semen` | Manual Tuang Timbangan Semen ke Mixer |
| **Pin 12** | `dump_air` | Manual Tuang Timbangan Air ke Mixer |
| **Pin 14** | `conveyor_bawah` | Manual Jalankan Belt Conveyor Bawah |
| **Pin 15** | `conveyor_atas` | Manual Jalankan Belt Conveyor Atas (Inclined) |
| **Pin 16** | `mixer` | Manual Aktifkan Motor Mixer Shaft |
| **Pin 17** | `vibrator` | Manual Aktifkan Vibrator Hopper |
| **Pin 18** | `compressor` | Manual Aktifkan Kompresor Angin |
| **Pin 19** | `klakson` | Manual Bunyikan Sirene Warning |
| **Pin 20** | `waiting_hopper` | Manual Buka Katup Pintu Waiting Hopper |
| **Pin 21** | `admix` | Manual Pemicu Katup Zat Aditif (Additive) |
| **Pin A2** | `mixer_buka` | Manual Buka Pintu Mixer Twin Shaft |
| **Pin A3** | `mixer_tutup` | Manual Tutup Pintu Mixer Twin Shaft |

---

### BAGIAN D: OUTPUT SOLENOID & KONTAKTOR MODUL RELAY 27-KORIDOR (AKTIF-LOW)

| Pin Mega | Output No | Nama Relai Beban Lapangan | Hubungan Beban Kontrol Lapangan |
| :---: | :---: | :--- | :--- |
| **Pin 22** | Relay 1 | Motor Mixer Twin Shaft | Menghubungkan koil kontaktor magnetik motor mixer utama. |
| **Pin 24** | Relay 2 | Belt Conveyor Utama | Menghubungkan koil kontaktor magnetik inclined conveyor. |
| **Pin 26** | Relay 3 | Belt Conveyor Timbangan | Menghubungkan koil kontaktor magnetik conveyor timbangan aggregat. |
| **Pin 28** | Relay 4 | Kompresor Angin | Menghubungkan koil kontaktor daya motor kompresor komersial. |
| **Pin 30** | Relay 5 | Solenoid Katup Pasir 1 | Solenoid katup pneumatik silinder penimbang Pasir #1. |
| **Pin 32** | Relay 6 | Solenoid Katup Pasir 2 | Solenoid katup pneumatik silinder penimbang Pasir #2. |
| **Pin 34** | Relay 7 | Solenoid Katup Batu 1 | Solenoid katup pneumatik silinder penimbang Batu #1. |
| **Pin 36** | Relay 8 | Solenoid Katup Batu 2 | Solenoid katup pneumatik silinder penimbang Batu #2. |
| **Pin 38** | Relay 9 | Katup Pelepasan Pasir | Solenoid katup piston pembuang timbangan aggregat pasir. |
| **Pin 40** | Relay 10 | Katup Pelepasan Batu | Solenoid katup piston pembuang timbangan aggregat batu. |
| **Pin 42** | Relay 11 | Motor Vibrator Hopper | Solenoid dinamo penggetar corong timbangan agar licin. |
| **Pin 44** | Relay 12 | Solenoid Saluran Air | Pompa / Valve pengisian air ke corong timbangan air HMI. |
| **Pin 48** | Relay 13 | Solenoid Saluran Aditif | Valve pengisian air aditif (Admixture) pembantu. |
| **Pin 50** | Relay 14 | Katup Pintu Mixer Buka | Solenoid silinder pneumatic pembuka pintu mixer beton. |
| **Pin 52** | Relay 15 | Katup Pintu Mixer Tutup | Solenoid silinder pneumatic penutup pintu mixer beton. |
| **Pin 33** | Relay 16 | Sirene Klakson HMI | Klakson peringatan awal mulai batching atau darurat. |
| **Pin 31** | Relay 17 | Silo Semen Sekrup 1 | Jalur motor conveyor spiral laras semen Silo #1. |
| **Pin 35** | Relay 18 | Silo Semen Sekrup 2 | Jalur motor conveyor spiral laras semen Silo #2. |
| **Pin 37** | Relay 19 | Silo Semen Sekrup 3 | Jalur motor conveyor spiral laras semen Silo #3. |
| **Pin 39** | Relay 20 | Silo Semen Sekrup 4 | Jalur motor conveyor spiral laras semen Silo #4. |
| **Pin 41** | Relay 21 | Silo Semen Sekrup 5 | Jalur motor conveyor spiral laras semen Silo #5. |
| **Pin 43** | Relay 22 | Silo Semen Sekrup 6 | Jalur motor conveyor spiral laras semen Silo #6. |
| **Pin 45** | Relay 23 | Pembuang Semen Hopper | Silinder pembuang material semen hasil timbang ke mixer. |
| **Pin 47** | Relay 24 | Pelepasan Waiting Hopper | Silinder pneumatic penumpah material di corong tunggu. |
| **Pin 49** | Relay 25 | Spare 3 | Jalur cadangan relai bantu lapangan. |
| **Pin 51** | Relay 26 | Spare 4 | Jalur cadangan relai bantu lapangan. |
| **Pin 53** | Relay 27 | Spare 5 | Jalur cadangan relai bantu lapangan. |

---

## 4. LOGIKA OPERASIONAL & PENJELASAN INTERLOCK BARU

### A. Proteksi Batas Tekanan Udara (Compressor Interlock)
*   **Tujuan**: Menghindari kegagalan duga katup pneumatic/silinder piston akibat kompresor loyo atau bocor (tidak bertenaga membuka pintu baja timbangan).
*   **Logika Kontrol**: Pada halaman **Sistem Admin ➜ Menu Tanpa Operator**, admin dapat mengaktifkan interlock ini dan menyetel parameter minimal (misal: **80.0 PSI**).
*   **Interlock HMI**: Sebelum menekan tombol **"Mulai Produksi"** (baik Otomatis maupun Manual), HMI akan mengecek nilai analog nyata dari Pin A1. Jika tekanan berada di bawah angka settingan, proses start dibatalkan seketika dan HMI akan memunculkan alarm visual besar berbunyi: `"BATCHING PROSES DIBATALKAN: Tekanan angin di bawah batas safety!"`.

### B. Mode Tanpa Operator Sekuensial (Operatorless Flow)
*   **Skenario**: Mengizinkan truk mixer memuat beton secara swadaya dan aman tanpa campur tangan operator HMI di kabin kontrol.
*   **Urutan Keamanan**:
    1.  Penimbangan dan pencampuran batch berjalan otomatis seperti biasa.
    2.  Ketika timer mixing habis, mixer masuk ke fase pelepasan corong beton.
    3.  **Hold Block**: Jika mode **Tanpa Operator** aktif dan opsi **"Deteksi Truk"** diaktifkan, HMI secara cerdas memblokir pembuangan dan menahan pintu gerbang mixer tetap tertutup rapat selama Pin A4 membaca HIGH (tidak terdeteksi truk). Di layar HMI, status berubah menjadi `"MENUNGGU TRUK MIXER"`.
    4.  Setelah Proximity Sensor mendeteksi badan corong truk mixer berada tepat di bawah peluncur pembuangan, Pin A4 menjadi LOW (Truk Ada).
    5.  **Driver Consent**: Jika opsi **"Tombol Driver"** aktif, pelepasan masih ditahan. Driver turun sebentar menuju panel tiang corong, memastikan corong menempel pas ke tangki truk, lalu menekan tombol rilis fisik. Pin A5 menjadi LOW, mengonfirmasikan persetujuan driver. 
    6.  HMI seketika membuka modul Relay gerbang mixer sesuai volume kubikasi, dan beton dimuat dengan selamat tanpa tumpah atau kecelakaan kerja.
    7.  Sinyal driver direset kembali untuk batch siklus berikutnya.

---

## 5. SKEMA PENGKABELAN DETAIL (WIRING DIAGRAM)

### A. Pengkabelan Sensor Tekanan Kompresor (Transducer 3-Wire)
```
[ Tekanan Transducer ]
   - Kabel Merah (VCC)   ➜  Pasang ke 5V DC Out Arduino Mega
   - Kabel Hitam (GND)   ➜  Pasang ke GROUND (GND) Arduino Mega
   - Kabel Kuning (Out)  ➜  Pasang ke Pin INPUT ANALOG A1 Arduino Mega
```

### B. Pengkabelan Sensor Proximity Truk (NPN 3-Wire Open Collector)
```
[ Sensor NPN NO 12-24V ]
   - Kabel Cokelat (VCC) ➜  Pasang ke Positif PSU Luar (+24VDC)
   - Kabel Biru (GND)     ➜  Pasang ke Negatif PSU Luar (-Gnd) ➜ Hubungkan ke GND Arduino Mega
   - Kabel Hitam (Out)    ➜  Hubungkan langsung ke Pin INPUT ANALOG A4 Arduino Mega 
                            (Aman karena Pin dipasang INPUT_PULLUP internal pada chip)
```

### C. Pengkabelan Tombol Fisik Driver & Emergency Stop (Dry Contact Switch)
```
[ Pushbutton / E-Stop Switch ]
   - Terminal Kontak A    ➜  Pin Input Arduino Mega (E-Stop: Pin 2, Tombol Driver: Pin A5)
   - Terminal Kontak B    ➜  GROUND (GND) Arduino Mega
```

---

## 6. INTEGRASI TELE-KONTROL INTERAKTIF (WHATSAPP COMMAND GATEWAY)

Sistem telah dibekali dengan **FRP WhatsApp Tele-Command Gateway** interaktif yang terletak di sudut kosong diagram SCADA untuk mendukung remote control cerdas berbasis chat:

### A. Logika Parsing Pesan WA (Fuzzy matching)
*   **Pola Formula**: Menggunakan pemicu fuzzy, pesanan seperti `"loading K300 3 kubik"`, `"muat k250 5 m3"`, atau `"k350 4 m3"` akan dideteksi secara otomatis dan dicocokkan dengan resep di databank (case-insensitive).
*   **Pola Volume & Siklus**: Teks angka volumetric (dalam satuan `kubik`, `m3`, `m³`) diekstrak secara otomatis. Volume pesanan yang melebihi kapasitas maksimum mixer (contoh: 3.5 m³) akan dipecah menjadi beberapa siklus pengadukan (*mixing cycles*) secara matematis untuk menjaga keawetan tangki serta presisi timbangan aggregator.

### B. Fitur Keamanan HMI & Opsi Konfirmasi
1.  **Dua Mode Eksekusi**:
    *   **Konfirmasi Operator (Default)**: Pesan WA yang masuk ditangguhkan di status `PENDING`. HMI memunculkan kartu persetujuan menyala kuning berbunyi alarm, menunggu operator menekan tombol `✔ SETUJUI & EKSEKUSI` atau `✖ TOLAK`.
    *   **Tanpa Konfirmasi (Fully Automated)**: Sistem standby akan memulai hitung mundur (countdown 5 detik) untuk safety, lalu langsung mengeksekusi resep beton secara otomatis.
2.  **Proteksi Mesin Sibuk**: Jika pesan WA baru masuk saat proses produksi atau penimbangan manual sedang berlangsung (`isRunning` = true), sistem secara aman mengunci rilis otomatis dan memaksa konfirmasi manual untuk mencegah bentrokan bahan baku di corong loading.
3.  **Simulator Chat Terpadu**: Pengguna dapat menguji alur di layar SCADA menggunakan preset quick-load ("K300 3m³", "K250 5m³") maupun mengetik pesan kustom secara langsung di kotak interaktif yang disediakan.

---

## 7. LANGKAH COMMISSIONING & OPERASI

1.  **Langkah Hardware**: Hubungkan Arduino Mega 2560 ke port USB PC Server HMI. Pastikan seluruh catu daya eksternal (5V dan 24V) sudah menyala stabil.
2.  **Langkah Firmware**: Upload sketch `arduino_mega_relay_firmware.ino` menggunakan Arduino IDE atau platform-io.
3.  **Langkah HMI**: Buka aplikasi HMI, navigasikan ke menu **ADMINISTRASI ➜ Setting Com dan Port**, pastikan serial terdeteksi sebagai "CONNECTED".
4.  **Batas Tekanan**: Nyalakan kompresor angin, pastikan jarum tekanan di SCADA HMI bergerak naik seirama deteksi analog. Masuk ke halaman **Tanpa Operator** untuk menetapkan batas minimum pengaman.
5.  **WhatsApp Simulator**: Aktifkan fitur WhatsApp di panel setelan kecil pada overlay SCADA, lalu klik salah satu preset simulasi kirim pesan WA atau ketik kustom untuk memverifikasi kesesuaian parsing volume dan resep beton di lapangan.
6.  **Uji Lapangan**: Coba jalankan batch simulasi skala kecil. Saat mixer selesai mengaduk, verifikasi pintu Mixer tidak akan membuka sebelum truk disimulasikan mendekati sensor (klik override pada HMI untuk memudahkan pengujian simulasi tanpa mesin asli).

---
#### DEPARTEMEN REKAYASA HARDWARE & OTOMATISASI PT. FARIKA RIAU PERKASA
