/**
 * Web Serial API Manager for Concrete Batching Plant HMI
 * Enables native real-time connection from the web browser to an Arduino Mega 2560/2580.
 * Controls 18 physical relays sequentially aligned with the batching flow.
 */

export type SerialStatus = "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "ERROR" | "RECONNECTING";
export type TelemetryCallback = (data: any) => void;

export interface LogCallback {
  (message: string, type: "info" | "success" | "warning" | "error" | "rx" | "tx"): void;
}

export interface StatusCallback {
  (status: SerialStatus): void;
}

class WebSerialManager {
  private port: any | null = null;
  private reader: any | null = null;
  private writer: any | null = null;
  private status: SerialStatus = "DISCONNECTED";
  private logCallbacks: Set<LogCallback> = new Set();
  private statusCallbacks: Set<StatusCallback> = new Set();
  private telemetryCallbacks: Set<TelemetryCallback> = new Set();
  private isReading: boolean = false;
  private lastSentFrame: string = "";

  // Heartbeat and Reconnect handles
  private heartbeatInterval: any = null;
  private reconnectTimeout: any = null;
  private lastReceivedTime: number = 0;
  private isAttemptingConnection: boolean = false;
  private commandQueue: string[] = [];
  private lastRelaysState: boolean[] | null = null;
  private hasRegisteredListeners: boolean = false;

  // Pin description label map
  public static RELAY_LABELS = [
    "Silo Pasir Utama (Pin 22)",
    "Silo Pasir 1 (Pin 23)",
    "Silo Pasir 2 (Pin 24)",
    "Silo Batu Utama (Pin 25)",
    "Silo Batu 1 (Pin 26)",
    "Silo Batu 2 (Pin 27)",
    "Screw Conveyor Semen (Pin 28)",
    "Valve Air Timbang (Pin 29)",
    "Discharge Pasir Hopper (Pin 30)",
    "Discharge Batu Hopper (Pin 31)",
    "Discharge Semen Hopper (Pin 32)",
    "Discharge Air Hopper (Pin 33)",
    "Conveyor Belt Bawah (Pin 34)",
    "Conveyor Belt Atas (Pin 35)",
    "Motor Twin Shaft Mixer (Pin 36)",
    "Discharge Pintu Mixer 1 (Pin 37)",
    "Discharge Pintu Mixer 2 (Pin 38)",
    "Discharge Pintu Mixer 3 (Pin 39)",
  ];

  /**
   * LEGACY MACHINE CONTROL FLAG
   * Default: false (Isolated from production machine control)
   * Production control strictly runs via ASP.NET Core & Siemens S7-1200 / SimulatedPlcClient.
   * Arduino Relay writing is disabled in production.
   */
  public static LegacyArduinoControlEnabled: boolean = false;

  public isLegacyControlEnabled(): boolean {
    return WebSerialManager.LegacyArduinoControlEnabled;
  }

  public setLegacyControlEnabled(enabled: boolean): void {
    WebSerialManager.LegacyArduinoControlEnabled = enabled;
  }

  constructor() {
    this.registerPhysicalUSBListeners();
    this.triggerAutoReconnectBackground();
  }

  /**
   * Registers connect/disconnect events from physical USB ports.
   */
  private registerPhysicalUSBListeners() {
    if (!this.isSupported() || this.hasRegisteredListeners) return;

    try {
      (navigator as any).serial.addEventListener("connect", (event: any) => {
        this.addLog("USB SERI/ARDUINO BERHASIL TERPASANG KE PORT!", "info");
        // Auto scan & connect on USB insert
        this.triggerAutoReconnectBackground();
      });

      (navigator as any).serial.addEventListener("disconnect", (event: any) => {
        this.addLog("USB SERI/ARDUINO TERLEPAS SECARA FISIK!", "warning");
        if (this.status === "CONNECTED") {
          this.handleDisconnectTransition();
        }
      });

      this.hasRegisteredListeners = true;
    } catch (err) {
      console.error("Failed to register physical serial event listeners:", err);
    }
  }

  /**
   * Background scan for previously authorized COM ports and auto-connect.
   */
  private triggerAutoReconnectBackground() {
    if (!this.isSupported()) return;

    setTimeout(async () => {
      const lastUsed = localStorage.getItem("arduino_last_used");
      if (lastUsed === "true") {
        this.addLog("Mendeteksi status terhubung sebelumnya, memindai COM Port...", "info");
        await this.attemptBackgroundReconnect();
      }
    }, 400);
  }

  /**
   * Checks if standard Web Serial is supported by the current browser.
   */
  public isSupported(): boolean {
    return typeof navigator !== "undefined" && "serial" in navigator;
  }

  public getStatus(): SerialStatus {
    return this.status;
  }

  private setStatus(newStatus: SerialStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusCallbacks.forEach(cb => {
        try {
          cb(this.status);
        } catch (e) {
          console.error("Status callback error:", e);
        }
      });
    }
  }

  public registerLogCallback(cb: LogCallback) {
    this.logCallbacks.add(cb);
  }

  public unregisterLogCallback(cb: LogCallback) {
    this.logCallbacks.delete(cb);
  }

  public registerStatusCallback(cb: StatusCallback) {
    this.statusCallbacks.add(cb);
    // Push immediate state
    cb(this.status);
  }

  public unregisterStatusCallback(cb: StatusCallback) {
    this.statusCallbacks.delete(cb);
  }

  public registerTelemetryCallback(cb: TelemetryCallback) {
    this.telemetryCallbacks.add(cb);
  }

  public unregisterTelemetryCallback(cb: TelemetryCallback) {
    this.telemetryCallbacks.delete(cb);
  }

  private addLog(msg: string, type: "info" | "success" | "warning" | "error" | "rx" | "tx") {
    const timestamped = `[${new Date().toLocaleTimeString()}] ${msg}`;
    this.logCallbacks.forEach(cb => {
      try {
        cb(timestamped, type);
      } catch (e) {
        console.error("Log callback error:", e);
      }
    });
  }

  /**
   * Request serial port from user and establish connection
   */
  public async connect(baudRate: number = 115200): Promise<boolean> {
    if (!this.isSupported()) {
      this.addLog("Error: Browser tidak mendukung Web Serial API. Gunakan Chrome/Edge/Opera.", "error");
      this.setStatus("ERROR");
      return false;
    }

    if (this.status === "CONNECTED" || this.isAttemptingConnection) {
      this.addLog("Sambungan aktif terdeteksi. Menolak inisialisasi ulang COM Port.", "warning");
      return true;
    }

    this.isAttemptingConnection = true;

    try {
      this.setStatus("CONNECTING");
      this.addLog("Menunggu pemilihan COM Port di browser...", "info");
      
      // Stop reconnect loops and timers prior to interactive request
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      await this.cleanup();
      
      const requestedPort = await (navigator as any).serial.requestPort();
      this.port = requestedPort;
      this.addLog(`Port disetujui. Membuka koneksi dengan Baud Rate ${baudRate} bps...`, "info");
      
      try {
        await this.port.open({ baudRate });
      } catch (openErr: any) {
        if (openErr.name === "InvalidStateError" || openErr.message?.includes("already open")) {
          this.addLog("COM Port sudah terbuka di background database. Melanjutkan...", "info");
        } else {
          throw openErr;
        }
      }

      this.setStatus("CONNECTED");
      this.addLog("KONEKSI SERIAL SUKSES TERHUBUNG KE ARDUINO MEGA!", "success");
      
      // Record VID/PID & Baud for subsequent auto reconnects
      this.saveLastConnectedDetails(this.port, baudRate);

      // Start async serial reading, heartbeats and flush command queue
      this.lastReceivedTime = Date.now();
      this.startReading();
      this.startHeartbeat();
      this.flushCommandQueue();

      this.isAttemptingConnection = false;
      return true;
    } catch (err: any) {
      console.error("Connection failed:", err);
      this.addLog(`Gagal menghubungkan: ${err.message || err}`, "error");
      this.setStatus("ERROR");
      this.isAttemptingConnection = false;
      return false;
    }
  }

  /**
   * Close connection and release ports gracefully
   */
  public async disconnect(): Promise<void> {
    this.addLog("Menutup koneksi serial secara aman atas permintan pengguna...", "info");
    
    // Clear last used flag to prevent unexpected background reconnects when turned off manually
    localStorage.setItem("arduino_last_used", "false");
    
    this.setStatus("DISCONNECTED");
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    await this.cleanup();
    this.addLog("Port serial selesai diputus dari sistem.", "warning");
  }

  /**
   * Save last connected port details to local storage
   */
  private saveLastConnectedDetails(port: any, baudRate: number) {
    try {
      const info = port.getInfo();
      const vid = info.usbVendorId ? info.usbVendorId.toString() : "";
      const pid = info.usbProductId ? info.usbProductId.toString() : "";
      localStorage.setItem("last_arduino_vid", vid);
      localStorage.setItem("last_arduino_pid", pid);
      localStorage.setItem("last_arduino_baud", baudRate.toString());
      localStorage.setItem("arduino_last_used", "true");
    } catch (err) {
      console.error("Could not write port details to cache:", err);
    }
  }

  /**
   * Low-level resources cleanup to enforce safe serial state transitions
   */
  private async cleanup(): Promise<void> {
    this.stopHeartbeat();
    this.isReading = false;

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch (err) {}
      this.reader = null;
    }

    if (this.writer) {
      try {
        this.writer.releaseLock();
      } catch (err) {}
      this.writer = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch (err) {}
      this.port = null;
    }
  }

  /**
   * Graceful transition when physical wiggles or internal telemetry timeouts happen
   */
  private async handleDisconnectTransition() {
    this.setStatus("RECONNECTING");
    this.addLog("Komunikasi dengan Arduino terputus. Memulai siklus auto-reconnect...", "warning");
    await this.cleanup();
    this.scheduleReconnect();
  }

  /**
   * Scheduling reconnection with 2 seconds interval delay
   */
  private scheduleReconnect() {
    if (this.reconnectTimeout) return;
    if (this.status === "DISCONNECTED") return;

    this.setStatus("RECONNECTING");
    this.addLog("Menjadwalkan otomatisasi koneksi ulang dalam 2 detik...", "info");

    this.reconnectTimeout = setTimeout(async () => {
      this.reconnectTimeout = null;
      if (this.status === "DISCONNECTED") return;

      this.addLog("Mencoba auto-reconnect ke Arduino...", "info");
      const connected = await this.attemptBackgroundReconnect();
      if (!connected) {
        // Reschedule on failure
        this.scheduleReconnect();
      }
    }, 2000);
  }

  /**
   * Background reconnect scan via WebSerial list of authorized ports
   */
  private async attemptBackgroundReconnect(): Promise<boolean> {
    if (this.isAttemptingConnection) return false;
    this.isAttemptingConnection = true;

    try {
      await this.cleanup();

      if (!this.isSupported()) {
        this.isAttemptingConnection = false;
        return false;
      }

      const authorizedPorts = await (navigator as any).serial.getPorts();
      if (authorizedPorts.length === 0) {
        this.addLog("Auto Scan: Tidak ada COM Port berlisensi/diizinkan oleh pengguna.", "warning");
        this.isAttemptingConnection = false;
        return false;
      }

      const savedVid = localStorage.getItem("last_arduino_vid");
      const savedPid = localStorage.getItem("last_arduino_pid");
      const savedBaudStr = localStorage.getItem("last_arduino_baud");
      const baudRate = savedBaudStr ? parseInt(savedBaudStr, 10) : 115200;

      let matchedPort = null;

      // Scan ports to find previously used VID/PID
      if (savedVid && savedPid) {
        for (const p of authorizedPorts) {
          const info = p.getInfo();
          if (
            info.usbVendorId?.toString() === savedVid &&
            info.usbProductId?.toString() === savedPid
          ) {
            matchedPort = p;
            break;
          }
        }
      }

      // Fallback: use first authorized port available (helps when COM port index shifts or standard clone boards)
      if (!matchedPort && authorizedPorts.length > 0) {
        matchedPort = authorizedPorts[0];
      }

      if (!matchedPort) {
        this.addLog("Auto Scan: Gagal menemukan Arduino yang valid di daftar port terpercaya.", "warning");
        this.isAttemptingConnection = false;
        return false;
      }

      this.port = matchedPort;
      this.addLog(`Auto Scan: Menemukan Arduino. Membuka koneksi HMI (Baud: ${baudRate})...`, "info");
      
      try {
        await this.port.open({ baudRate });
      } catch (openErr: any) {
        if (openErr.name === "InvalidStateError" || openErr.message?.includes("already open")) {
          this.addLog("Port sudah terbuka di thread lain. Melanjutkan...", "info");
        } else {
          throw openErr;
        }
      }

      this.setStatus("CONNECTED");
      this.addLog("KONEKSI SERIAL RE-ESTABLISHED TERHUBUNG KE ARDUINO MEGA!", "success");

      // Reset timers, start worker daemon, flush queue state
      this.lastReceivedTime = Date.now();
      this.startReading();
      this.startHeartbeat();
      this.flushCommandQueue();

      this.isAttemptingConnection = false;
      return true;
    } catch (err: any) {
      console.error("Auto background reconnect attempt failed:", err);
      this.addLog(`Auto-reconnect gagal: ${err.message || err}`, "error");
      this.isAttemptingConnection = false;
      return false;
    }
  }

  /**
   * Heartbeat ping system running every 1 second
   */
  private startHeartbeat() {
    this.stopHeartbeat();
    this.lastReceivedTime = Date.now();

    this.heartbeatInterval = setInterval(async () => {
      if (this.status !== "CONNECTED" || !this.port) return;

      // 1. Transmit heartbeats over Serial channel
      const pingCommand = "PING_HB\n";
      try {
        const encoder = new TextEncoder();
        const outputStream = this.port.writable;
        if (outputStream) {
          const tempWriter = outputStream.getWriter();
          await tempWriter.write(encoder.encode(pingCommand));
          tempWriter.releaseLock();
          // Resetting lastReceivedTime on successful write as a transmission heartbeat fallback
          this.lastReceivedTime = Date.now();
        }
      } catch (err) {
        console.error("Failed to transmit heartbeat pulse:", err);
      }

      // 2. Validate heartbeat read timeouts (> 3 seconds)
      const elapsedSinceLastMessage = Date.now() - this.lastReceivedTime;
      if (elapsedSinceLastMessage > 3000) {
        this.addLog(`HEARTBEAT TIMEOUT (>3 detik tanpa data). Memulai auto-reconnect...`, "warning");
        await this.handleDisconnectTransition();
      }
    }, 1000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Writes states vector representing the 18 relays to the Arduino
   */
  public async sendRelaysState(states: boolean[]): Promise<void> {
    this.lastRelaysState = states;

    // SAFETY ENFORCEMENT: Legacy Arduino relay control is isolated and disabled by default in production.
    if (!WebSerialManager.LegacyArduinoControlEnabled) {
      return;
    }

    if (this.status !== "CONNECTED" || !this.port) {
      // Buffer the command payload inside queue if we are disconnected or reconnecting
      return;
    }

    // Convert booleans array to ASCII character sequence '0' or '1'
    const commandPayload = states.map(b => (b ? "1" : "0")).join(",");
    const dataToSend = `RELAY:${commandPayload}\n`;

    // Only transmit over Serial if state payload differs (limits heavy buffers)
    if (dataToSend === this.lastSentFrame) return;

    try {
      const encoder = new TextEncoder();
      const outputStream = this.port.writable;
      if (!outputStream) return;

      this.writer = outputStream.getWriter();
      await this.writer.write(encoder.encode(dataToSend));
      this.writer.releaseLock();
      this.writer = null;

      this.lastSentFrame = dataToSend;
      this.lastReceivedTime = Date.now(); // reset timeout on successful write
      this.addLog(`Data Terkirim -> Pin 22-39: [${commandPayload}]`, "tx");
    } catch (err: any) {
      console.error("Write error:", err);
      this.addLog(`Kesalahan pengiriman serial: ${err.message || err}`, "error");
      
      // Instantly handle write drop-outs by calling redirect transition
      this.handleDisconnectTransition();
    }
  }

  /**
   * Direct arbitrary command sending method (with queuing support)
   */
  public async sendCommand(command: string): Promise<void> {
    const formatted = command.endsWith("\n") ? command : `${command}\n`;

    if (this.status !== "CONNECTED" || !this.port) {
      this.commandQueue.push(formatted);
      this.addLog(`Arduino Offline. Menyimpan [${formatted.trim()}] ke antrean perintah...`, "warning");
      return;
    }

    try {
      const encoder = new TextEncoder();
      const outputStream = this.port.writable;
      if (!outputStream) return;

      const tempWriter = outputStream.getWriter();
      await tempWriter.write(encoder.encode(formatted));
      tempWriter.releaseLock();

      this.lastReceivedTime = Date.now();
      this.addLog(`Data Terkirim -> ${formatted.trim()}`, "tx");
    } catch (err: any) {
      console.error("SendCommand error:", err);
      this.commandQueue.push(formatted);
      this.handleDisconnectTransition();
    }
  }

  /**
   * Flush all buffered commands and targets upon a successful connection
   */
  private flushCommandQueue() {
    // 1. Flush any customized text commands
    if (this.commandQueue.length > 0) {
      this.addLog(`Mengeluarkan ${this.commandQueue.length} data instruksi dari antrean...`, "info");
      while (this.commandQueue.length > 0) {
        const cmd = this.commandQueue.shift();
        if (cmd) {
          this.sendCommand(cmd);
        }
      }
    }

    // 2. Flush last known relay state target
    if (this.lastRelaysState) {
      this.addLog("Menyelaraskan state Relay HMI terbaru ke Arduino...", "info");
      this.sendRelaysState(this.lastRelaysState);
    }
  }

  /**
   * Active read daemon parsing feedback from the Arduino processor
   */
  private async startReading() {
    if (this.isReading) return;
    this.isReading = true;

    const decoder = new TextDecoder();
    let localBuffer = "";

    try {
      while (this.isReading && this.port && this.port.readable) {
        try {
          this.reader = this.port.readable.getReader();
        } catch (lockErr) {
          console.error("Failed to acquire reading lock:", lockErr);
          break;
        }
        
        try {
          while (true) {
            const { value, done } = await this.reader.read();
            if (done) break;

            const textChunk = decoder.decode(value);
            localBuffer += textChunk;

            // Split on newline to read full string telegrams
            const lines = localBuffer.split(/\r?\n/);
            localBuffer = lines.pop() || ""; // keep remainder

            for (const line of lines) {
              const cleaned = line.trim();
              if (cleaned.length > 0) {
                // Update timestamp showing physical signal alive!
                this.lastReceivedTime = Date.now();
                
                // Try parsing as JSON for direct telemetry (e.g. {"mixerAmp": 102.4})
                if (cleaned.startsWith("{") && cleaned.endsWith("}")) {
                  try {
                    const parsed = JSON.parse(cleaned);
                    this.telemetryCallbacks.forEach(cb => {
                      try {
                        cb(parsed);
                      } catch (telemetryErr) {
                        console.error("Error in telemetry delivery:", telemetryErr);
                      }
                    });
                  } catch (jsonErr) {
                    // Not valid JSON or parsing failed, fallback to log
                  }
                }
                
                this.addLog(`Arduino: ${cleaned}`, "rx");
              }
            }
          }
        } catch (err: any) {
          console.error("Read cycle error:", err);
          break;
        } finally {
          if (this.reader) {
            try {
              this.reader.releaseLock();
            } catch (err) {}
            this.reader = null;
          }
        }
      }
    } catch (majorErr: any) {
      console.error("Major reading thread error", majorErr);
      this.addLog(`Pembaca HMI terputus tiba-tiba: ${majorErr.message || majorErr}`, "error");
    } finally {
      this.isReading = false;
      // Reconnect if we were disconnected abruptly during processing
      if (this.status === "CONNECTED") {
        this.handleDisconnectTransition();
      }
    }
  }
}

// Export a single global instance for applicationwide consistency
export const webSerialService = new WebSerialManager();
