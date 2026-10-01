using BatchingPlant.Domain.Entities;
using BatchingPlant.Domain.Enums;

namespace BatchingPlant.Domain.Interfaces;

public record ScaleTelemetry(
    double AggregateWeightKg,
    double CementWeightKg,
    double WaterWeightKg,
    double AdditiveWeightKg,
    double WaitingHopperWeightKg,
    double AirPressureBar,
    double MixerCurrentAmpere,
    double EstimatedSlumpCm,
    bool EmergencyStopActive,
    bool TruckPresent,
    bool DriverDischargeButton
);

public record DigitalIoStatus(
    bool MixerMotorOn,
    bool ConveyorUpperOn,
    bool ConveyorBottomOn,
    bool CompressorOn,
    bool GatePasir1Open,
    bool GatePasir2Open,
    bool GateBatu1Open,
    bool GateBatu2Open,
    bool DumpPasirOpen,
    bool DumpBatuOpen,
    bool DumpSemenOpen,
    bool DumpWaterOpen,
    bool VibratorOn,
    bool HornOn,
    bool WaitingHopperGateOpen,
    bool MixerDoorOpen,
    bool MixerDoorClose,
    int ActiveCementSilo
);

public interface ISiemensS7Service
{
    bool IsConnected { get; }
    OperationMode Mode { get; }
    Task<bool> ConnectAsync(string ipAddress, int rack = 0, int slot = 1, CancellationToken ct = default);
    Task DisconnectAsync();
    
    // Low-level DB access
    Task<ScaleTelemetry> ReadTelemetryAsync(CancellationToken ct = default);
    Task<DigitalIoStatus> ReadIoStatusAsync(CancellationToken ct = default);
    
    // Command writes to Siemens S7-1200 DB Block
    Task WriteBatchRecipeTargetsAsync(JobMixFormula formula, double volumePerCycle, CancellationToken ct = default);
    Task SendStartCommandAsync(BatchingMode mode, CancellationToken ct = default);
    Task SendPauseCommandAsync(CancellationToken ct = default);
    Task SendResumeCommandAsync(CancellationToken ct = default);
    Task SendEmergencyStopCommandAsync(CancellationToken ct = default);
    Task WriteManualManualActuatorToggleAsync(string actuatorName, bool state, CancellationToken ct = default);
}

public interface IBatchRepository
{
    Task<BatchLog?> GetByIdAsync(string id);
    Task<IEnumerable<BatchLog>> GetRecentBatchesAsync(int limit = 50);
    Task<IEnumerable<BatchLog>> SearchBatchesAsync(string? keyword, DateTime? fromDate, DateTime? toDate);
    Task AddBatchLogAsync(BatchLog log);
    Task UpdateBatchLogAsync(BatchLog log);
}

public interface ISyncEngine
{
    Task EnqueueAsync(string entityType, string entityId, object payload);
    Task<int> ProcessSyncQueueAsync(CancellationToken ct = default);
    Task<bool> PingCentralPostgresAsync(CancellationToken ct = default);
}
