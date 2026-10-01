// Sync Service Architecture for Multi-Plant Management & Cloud Monitoring Integration
// Maintains offline-first queues and handles future cloud synchronizations.

export interface PlantIdentity {
  plantCompany: string;
  plantId: string;
  plantName: string;
  plantAddress?: string;
  registeredAt: string;
}

export interface SyncRecord {
  id: string;
  type: "production" | "relay_log" | "stock" | "alarm" | "user_action";
  plantId: string;
  plantName: string;
  timestamp: string;
  payload: any;
  synced: boolean;
}

export const getPlantIdentity = (): PlantIdentity | null => {
  const registered = localStorage.getItem("plant_registered") === "true";
  if (!registered) return null;
  return {
    plantCompany: localStorage.getItem("plant_company") || "PT Farika Riau Perkasa",
    plantId: localStorage.getItem("plant_id") || "PKU01",
    plantName: localStorage.getItem("plant_name") || "Pekanbaru",
    plantAddress: localStorage.getItem("plant_address") || "",
    registeredAt: localStorage.getItem("plant_registered_at") || new Date().toISOString(),
  };
};

export const savePlantIdentity = (identity: PlantIdentity) => {
  localStorage.setItem("plant_company", identity.plantCompany);
  localStorage.setItem("plant_id", identity.plantId);
  localStorage.setItem("plant_name", identity.plantName);
  localStorage.setItem("plant_address", identity.plantAddress || "");
  localStorage.setItem("plant_registered_at", identity.registeredAt || new Date().toISOString());
  localStorage.setItem("plant_registered", "true");
  
  // Custom dispatch for real-time reactivity
  window.dispatchEvent(new Event("plant_identity_updated"));
};

// Simulation of Future Sync Queue Database
export const queueForCloudSync = (type: SyncRecord["type"], payload: any) => {
  const plant = getPlantIdentity();
  const plantId = plant?.plantId || "PKU01";
  const plantName = plant?.plantName || "Pekanbaru";

  const queueStr = localStorage.getItem("cloud_sync_queue") || "[]";
  let queue: SyncRecord[] = [];
  try {
    queue = JSON.parse(queueStr);
  } catch (e) {
    queue = [];
  }

  const newRecord: SyncRecord = {
    id: "SYNC-" + Math.random().toString(36).substring(7).toUpperCase(),
    type,
    plantId,
    plantName,
    timestamp: new Date().toISOString(),
    payload,
    synced: false
  };

  // Push to queue and slice to avoid overflow in local storage preview (keep last 500)
  queue.push(newRecord);
  if (queue.length > 500) {
    queue.shift();
  }

  localStorage.setItem("cloud_sync_queue", JSON.stringify(queue));
  window.dispatchEvent(new Event("cloud_sync_queue_updated"));
};

// Get Synchronization stats for the Cloud Monitoring interface
export const getSyncStats = () => {
  const queueStr = localStorage.getItem("cloud_sync_queue") || "[]";
  let queue: SyncRecord[] = [];
  try {
    queue = JSON.parse(queueStr);
  } catch (e) {}

  const pending = queue.filter(r => !r.synced).length;
  const synced = queue.filter(r => r.synced).length;
  
  return {
    totalRecords: queue.length,
    pendingRecords: pending,
    syncedRecords: synced,
    status: pending > 0 ? "pending_sync" : "synced"
  };
};
