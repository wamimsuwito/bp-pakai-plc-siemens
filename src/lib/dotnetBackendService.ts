/**
 * Production-Grade .NET 10 & Siemens S7-1200 Backend Bridge
 * Integrates the existing HMI frontend with the new ASP.NET Core Web API, SignalR,
 * SQLite local-first persistence, and Central PostgreSQL replication.
 * 
 * Preserves 100% of the existing UI, layouts, buttons, and workflows.
 */

export interface DotNetServerStatus {
  isOnline: boolean;
  plcConnected: boolean;
  centralDbConnected: boolean;
  activeBatchId: string | null;
  mode: "STANDALONE_HMI" | "DOTNET_S7_1200";
  plcStatus?: string;
  sqliteStatus?: string;
}

export interface IBackendService {
  checkHealth(): Promise<boolean>;
  subscribeStatus(callback: (status: DotNetServerStatus) => void): () => void;
  startBatch(params: any): Promise<{ success: boolean; batchNumber?: string; message?: string }>;
  stopBatch(): Promise<boolean>;
  pauseBatch(): Promise<boolean>;
  resumeBatch(): Promise<boolean>;
  abortBatch(reason: string): Promise<boolean>;
  manualActuator(actuatorKey: string, targetState: boolean): Promise<boolean>;
  setMode(mode: 'AUTO' | 'MANUAL' | 'SEMI_AUTO'): Promise<boolean>;
  resetAlarm(alarmId?: string): Promise<boolean>;
  saveJmf(formula: any): Promise<boolean>;
  getJmf(): Promise<any[]>;
  saveCalibration(item: any): Promise<boolean>;
  getCalibrations(): Promise<any[]>;
  getProductionHistory(limit?: number, search?: string): Promise<any[]>;
  printTicket(batchId: string): Promise<any>;
  userManagement(): Promise<any>;
  getUsers(): Promise<any[]>;
  saveUser(user: any): Promise<boolean>;
  deleteUser(userId: string): Promise<boolean>;
  migrateLegacyData(type: 'jmf' | 'batches' | 'users', data: any[]): Promise<number>;
  connectPlc(ip?: string, rack?: number, slot?: number): Promise<boolean>;
  login(nikOrUsername: string, password: string): Promise<{ success: boolean; user?: any; errorCode?: string; message?: string }>;
  getDatabaseStatus(): Promise<{ connected: boolean; provider: string; path: string; sizeBytes: number; pendingSync: number } | null>;
  createBackup(targetDir?: string): Promise<{ success: boolean; path?: string; sizeBytes?: number; error?: string }>;
}

const DEFAULT_API_BASE = "http://localhost:5000";

class DotNetBackendService implements IBackendService {
  private apiBase: string = DEFAULT_API_BASE;
  private isConnected: boolean = false;
  private currentStatus: DotNetServerStatus = {
    isOnline: false,
    plcConnected: false,
    centralDbConnected: false,
    activeBatchId: null,
    mode: "STANDALONE_HMI",
    plcStatus: "DISCONNECTED",
    sqliteStatus: "IDLE"
  };
  private statusListeners: Set<(status: DotNetServerStatus) => void> = new Set();

  constructor() {
    this.checkHealth();
    // Periodic health check every 10 seconds
    if (typeof window !== "undefined") {
      setInterval(() => this.checkHealth(), 10000);
    }
  }

  public async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.apiBase}/api/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(2000)
      });
      if (res.ok) {
        const data = await res.json();
        this.isConnected = true;
        this.currentStatus = {
          isOnline: true,
          plcConnected: data.plc === "CONNECTED" || data.plc === "SIMULATION",
          centralDbConnected: data.postgresql === "CONNECTED",
          activeBatchId: null,
          mode: "DOTNET_S7_1200",
          plcStatus: data.plc,
          sqliteStatus: data.sqlite
        };
      } else {
        this.isConnected = false;
        this.currentStatus = {
          isOnline: false,
          plcConnected: false,
          centralDbConnected: false,
          activeBatchId: null,
          mode: "STANDALONE_HMI"
        };
      }
    } catch {
      this.isConnected = false;
      this.currentStatus = {
        isOnline: false,
        plcConnected: false,
        centralDbConnected: false,
        activeBatchId: null,
        mode: "STANDALONE_HMI"
      };
    }
    this.notifyListeners(this.currentStatus);
    return this.isConnected;
  }

  public subscribeStatus(callback: (status: DotNetServerStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.currentStatus);
    return () => this.statusListeners.delete(callback);
  }

  private notifyListeners(status: DotNetServerStatus) {
    this.statusListeners.forEach(cb => {
      try {
        cb(status);
      } catch (e) {
        console.error("DotNetBackend listener error:", e);
      }
    });
  }

  // --- API Endpoints matching C# ASP.NET Core Controllers ---
  public async startBatch(params: any): Promise<{ success: boolean; batchNumber?: string; message?: string }> {
    if (!this.isConnected) {
      return { success: false, message: "Backend .NET offline, fallback ke mode lokal" };
    }
    try {
      const res = await fetch(`${this.apiBase}/api/batch/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params)
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  public async stopBatch(): Promise<boolean> {
    return this.abortBatch("User requested STOP");
  }

  public async pauseBatch(): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      const res = await fetch(`${this.apiBase}/api/batch/pause`, { method: "POST" });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async resumeBatch(): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      const res = await fetch(`${this.apiBase}/api/batch/resume`, { method: "POST" });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async abortBatch(reason: string): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      const res = await fetch(`${this.apiBase}/api/batch/abort`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reason)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async manualActuator(actuatorKey: string, targetState: boolean): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      const res = await fetch(`${this.apiBase}/api/batch/manual-actuator`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actuatorKey, targetState })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async setMode(mode: 'AUTO' | 'MANUAL' | 'SEMI_AUTO'): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      const res = await fetch(`${this.apiBase}/api/batch/mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async resetAlarm(alarmId?: string): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      const targetUrl = alarmId 
        ? `${this.apiBase}/api/alarms/acknowledge/${alarmId}?user=OPERATOR`
        : `${this.apiBase}/api/alarms/acknowledge/all?user=OPERATOR`;
      const res = await fetch(targetUrl, { method: "POST" });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async saveJmf(formula: any): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      const method = formula.id ? "PUT" : "POST";
      const url = formula.id ? `${this.apiBase}/api/jmf/${formula.id}` : `${this.apiBase}/api/jmf`;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formula)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async getJmf(): Promise<any[]> {
    if (!this.isConnected) return [];
    try {
      const res = await fetch(`${this.apiBase}/api/jmf`);
      if (res.ok) return await res.json();
      return [];
    } catch {
      return [];
    }
  }

  public async saveCalibration(item: any): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      const res = await fetch(`${this.apiBase}/api/calibration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async getCalibrations(): Promise<any[]> {
    if (!this.isConnected) return [];
    try {
      const res = await fetch(`${this.apiBase}/api/calibration`);
      if (res.ok) return await res.json();
      return [];
    } catch {
      return [];
    }
  }

  public async getProductionHistory(limit: number = 50, search?: string): Promise<any[]> {
    if (!this.isConnected) return [];
    try {
      let url = `${this.apiBase}/api/batch/history?limit=${limit}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      const res = await fetch(url);
      if (res.ok) return await res.json();
      return [];
    } catch {
      return [];
    }
  }

  public async printTicket(batchId: string): Promise<any> {
    if (!this.isConnected) return null;
    try {
      const res = await fetch(`${this.apiBase}/api/batch/ticket/${batchId}`);
      if (res.ok) return await res.json();
      return null;
    } catch {
      return null;
    }
  }

  public async userManagement(): Promise<any> {
    return this.getUsers();
  }

  public async getUsers(): Promise<any[]> {
    if (!this.isConnected) return [];
    try {
      const res = await fetch(`${this.apiBase}/api/users`);
      if (res.ok) return await res.json();
      return [];
    } catch {
      return [];
    }
  }

  public async saveUser(user: any): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      const method = user.id ? "PUT" : "POST";
      const url = user.id ? `${this.apiBase}/api/users/${user.id}` : `${this.apiBase}/api/users`;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async deleteUser(userId: string): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      const res = await fetch(`${this.apiBase}/api/users/${userId}`, { method: "DELETE" });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async migrateLegacyData(type: 'jmf' | 'batches' | 'users', data: any[]): Promise<number> {
    if (!this.isConnected) return 0;
    try {
      const res = await fetch(`${this.apiBase}/api/migration/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        const json = await res.json();
        return json.migrated || 0;
      }
      return 0;
    } catch {
      return 0;
    }
  }

  public async connectPlc(ip: string = "192.168.0.1", rack: number = 0, slot: number = 1): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      const res = await fetch(`${this.apiBase}/api/plc/connect?ip=${ip}&rack=${rack}&slot=${slot}`, {
        method: "POST"
      });
      if (res.ok) {
        const json = await res.json();
        return json.success;
      }
      return false;
    } catch {
      return false;
    }
  }

  public async login(nikOrUsername: string, password: string): Promise<{ success: boolean; user?: any; errorCode?: string; message?: string }> {
    if (!this.isConnected) {
      return { success: false, errorCode: "BACKEND_OFFLINE", message: "Backend .NET offline" };
    }
    try {
      const res = await fetch(`${this.apiBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nikOrUsername, password })
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, errorCode: "NETWORK_ERROR", message: err.message };
    }
  }

  public async getDatabaseStatus(): Promise<{ connected: boolean; provider: string; path: string; sizeBytes: number; pendingSync: number } | null> {
    if (!this.isConnected) return null;
    try {
      const res = await fetch(`${this.apiBase}/api/database/status`);
      if (res.ok) return await res.json();
      return null;
    } catch {
      return null;
    }
  }

  public async createBackup(targetDir?: string): Promise<{ success: boolean; path?: string; sizeBytes?: number; error?: string }> {
    if (!this.isConnected) return { success: false, error: "Backend offline" };
    try {
      const url = targetDir ? `${this.apiBase}/api/database/backup?targetDir=${encodeURIComponent(targetDir)}` : `${this.apiBase}/api/database/backup`;
      const res = await fetch(url, { method: "POST" });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

export const dotNetBackendService: IBackendService = new DotNetBackendService();
