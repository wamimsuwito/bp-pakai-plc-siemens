using BatchingPlant.Domain.Entities;
using BatchingPlant.Domain.Enums;

namespace BatchingPlant.Domain.Interfaces;

public enum PlcConnectionStatus
{
    DISCONNECTED = 0,
    CONNECTED = 1,
    FAULT = 2,
    SIMULATION = 3
}

public enum OperationMode
{
    PRODUCTION = 0,
    SIMULATION = 1,
    DISCONNECTED = 2
}

public interface IPlcClient
{
    PlcConnectionStatus Status { get; }
    OperationMode Mode { get; }
    bool IsConnected { get; }

    Task<bool> ConnectAsync(string ipAddress, int rack = 0, int slot = 1, CancellationToken ct = default);
    Task DisconnectAsync();
    
    Task<ScaleTelemetry> ReadTelemetryAsync(CancellationToken ct = default);
    Task<DigitalIoStatus> ReadIoStatusAsync(CancellationToken ct = default);
    
    Task WriteBatchRecipeTargetsAsync(JobMixFormula formula, double volumePerCycle, CancellationToken ct = default);
    Task SendStartCommandAsync(BatchingMode mode, CancellationToken ct = default);
    Task SendPauseCommandAsync(CancellationToken ct = default);
    Task SendResumeCommandAsync(CancellationToken ct = default);
    Task SendEmergencyStopCommandAsync(CancellationToken ct = default);
    Task WriteManualActuatorToggleAsync(string actuatorName, bool state, CancellationToken ct = default);
}

public interface IAuditRepository
{
    Task LogAsync(string action, string message, string? username = null, string? payload = null);
    Task<IEnumerable<AuditLogItem>> GetRecentLogsAsync(int limit = 100);
}

public class AuditLogItem : BaseEntity
{
    public string Action { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Username { get; set; } = "OPERATOR";
    public string? Payload { get; set; }
}

public interface ICalibrationRepository
{
    Task<IEnumerable<ScaleCalibration>> GetAllCalibrationsAsync();
    Task<ScaleCalibration?> GetByTypeAsync(string scaleType);
    Task SaveCalibrationAsync(ScaleCalibration calibration);
}
