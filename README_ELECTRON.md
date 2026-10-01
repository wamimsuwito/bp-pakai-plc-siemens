# 🖥️ Panduan Integrasi & Build Aplikasi Desktop Electron (Offline-First)

Aplikasi HMI Batching Plant **PT. Farika Riau Perkasa** telah sepenuhnya dikonfigurasi dan disiapkan agar siap dibuild menjadi aplikasi desktop native menggunakan **Electron**. 

Semua sistem dioptimalkan agar berjalan **100% Offline** dengan menggunakan **Local Storage** berkinerja tinggi guna menyimpan konfigurasi formula, logs produksi, driver, dan urutan pencampuran (*mixing sequence*).

---

## 🛠️ Perubahan yang Telah Dilakukan

1. **Konfigurasi Path Relatif (`base: './'`)**
   - Diperbarui pada `vite.config.ts`. Ini memastikan Electron dapat membaca aset statis (`js`, `css`, gambar) menggunakan protokol lokal `file://` dari dalam paket desktop tanpa ada error path absolut.
2. **Setup Script Utama Electron (`electron.cjs`)**
   - Menambahkan proses utama Electron untuk menetapkan ukuran window default (1280x800), memuat file build statis, menonaktifkan bilah menu default (agar terlihat seperti HMI Touchscreen profesional), dan mengaktifkan render akselerasi hardware.
3. **Konfigurasi Keamanan (`preload.cjs`)**
   - Menambahkan script preload agar aman dan terisolasi dari ancaman injeksi script luar (`contextIsolation` bernilai `true`).
4. **Penyimpanan Lokal Persisten Otomatis**
   - Seluruh status input (seperti *Volume*, *Jumlah Mixing*, *Batas Slump*, *Data Supir*, *No Kendaraan*, *Pelanggan*, *Lokasi Proyek*, serta *Mixing Sequence* dan *Batch Logs*) otomatis tercatat & dipulihkan dari `localStorage` komputer pengguna saat aplikasi dijalankan kembali.
5. **Konfigurasi Build Metadata di `package.json`**
   - Menambahkan skrip perintah eksekusi desktop serta instruksi kompilasi installer otomatis (`dist-electron/`) untuk Windows (`.exe` NSIS), macOS (`.dmg`), dan Linux (`.AppImage`).

---

## 🚀 Cara Menjalankan & Membangun (Build) Aplikasi di Komputer Lokal

Ikuti langkah-langkah di bawah ini pada komputer Anda untuk menjalankan HMI Desktop:

### 1. Prasyarat
Pastikan Anda sudah menginstal **Node.js** (versi 18 ke atas disarankan) di komputer Anda.

### 2. Instalasi Dependensi
Buka terminal/command prompt di direktori project, lalu jalankan:
```bash
npm install
```

### 3. Menjalankan Mode Pengembangan Dekstop (Electron Dev)
Untuk menjalankan aplikasi HMI di dalam jendela Electron desktop dengan fitur live reload, jalankan perintah:

*Terminal 1 (Jalankan server Vite):*
```bash
npm run dev
```

*Terminal 2 (Jalankan Electron):*
```bash
npx cross-env NODE_ENV=development electron .
```
Atau cukup gunakan skrip jalan cepat yang telah disediakan di `package.json`:
```bash
npm run electron:start
```

---

## 📦 Mengemas Aplikasi Menjadi Installer Desktop (.EXE / .DMG / .AppImage)

Untuk mengompilasi kode web menjadi penginstal aplikasi desktop native yang mandiri (*standalone installer*), Anda cukup menjalankan satu perintah berikut:

```bash
npm run electron:pack
```

### Hasil Output Build:
Perintah di atas akan melakukan instalasi build Vite, mengemas file, dan menghasilkan folder baru bernama **`dist-electron/`**:
- 🪟 **Windows**: Menghasilkan installer `.exe` berbasis NSIS (siap dipasang di PC industri batching plant).
- 🍎 **macOS**: Menghasilkan file `.dmg` siap pakai.
- 🐧 **Linux**: Menghasilkan bundel portable `.AppImage`.

---

## 💾 Mekanisme Penyimpanan Offline (Local Storage)
Karena aplikasi dirancang khusus untuk bekerja di area tanpa internet/batching plant lapangan, sistem penyimpanan kami menggunakan **Local Storage**. Informasi berikut disimpan secara permanen di komputer operator:
- **`hmi_batch_logs`**: Menyimpan semua daftar riwayat cetak resep dan batch log produksi yang sukses/gagal.
- **`hmi_mixing_sequence`**: Urutan penuaian material (pasir, semen, batu, air) beserta delay timernya.
- **`active_volume`, `active_mixing_count`, dll**: Keadaan terakhir dari form pengisian batching plant agar operator tidak perlu menginput data yang sama berulang kali setelah aplikasi dibuka kembali.
