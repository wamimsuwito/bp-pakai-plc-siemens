using BatchingPlant.Application.DTOs;
using BatchingPlant.Domain.Entities;
using BatchingPlant.Domain.Enums;
using BatchingPlant.Domain.Interfaces;

namespace BatchingPlant.Application.Services;

public interface IBatchExecutionService
{
    BatchingMode CurrentOperatingMode { get; }
    Task<string> StartBatchAsync(StartBatchRequest request, CancellationToken ct = default);
    Task PauseBatchAsync(CancellationToken ct = default);
    Task ResumeBatchAsync(CancellationToken ct = default);
    Task AbortBatchAsync(string reason, CancellationToken ct = default);
    Task<(bool Success, string? ErrorCode, string? Message)> SetOperatingModeAsync(BatchingMode mode, CancellationToken ct = default);
    Task ToggleManualDeviceAsync(string actuatorKey, bool state, CancellationToken ct = default);
    BatchProgressUpdateDto GetCurrentProgress();
}

public class BatchExecutionService : IBatchExecutionService
{
    private readonly ISiemensS7Service _plcService;
    private readonly IBatchRepository _batchRepository;
    private readonly ISyncEngine _syncEngine;

    private BatchLog? _currentBatch;
    private BatchStatus _status = BatchStatus.IDLE;
    private BatchingMode _currentOperatingMode = BatchingMode.AUTO;
    private int _currentCycleIndex = 0;
    private int _totalCycles = 1;
    private double _volumePerCycle = 1.0;

    public BatchingMode CurrentOperatingMode => _currentOperatingMode;

    public BatchExecutionService(
        ISiemensS7Service plcService,
        IBatchRepository batchRepository,
        ISyncEngine syncEngine)
    {
        _plcService = plcService;
        _batchRepository = batchRepository;
        _syncEngine = syncEngine;
    }

    public async Task<(bool Success, string? ErrorCode, string? Message)> SetOperatingModeAsync(BatchingMode mode, CancellationToken ct = default)
    {
        if (_plcService.Mode == OperationMode.PRODUCTION && !_plcService.IsConnected)
        {
            return (false, "PLC_DISCONNECTED", "Siemens S7-1200 is disconnected. Mode change command locked.");
        }

        _currentOperatingMode = mode;
        try
        {
            await _plcService.SendStartCommandAsync(mode, ct);
        }
        catch (Exception ex)
        {
            if (_plcService.Mode == OperationMode.PRODUCTION)
            {
                return (false, "PLC_COMMUNICATION_ERROR", ex.Message);
            }
        }

        return (true, null, null);
    }

    public async Task<string> StartBatchAsync(StartBatchRequest request, CancellationToken ct = default)
    {
        if (_status != BatchStatus.IDLE && _status != BatchStatus.COMPLETED && _status != BatchStatus.ABORTED)
        {
            throw new InvalidOperationException("Batching sedang berlangsung! Tidak dapat memulai batch baru.");
        }

        if (_plcService.Mode == OperationMode.PRODUCTION && !_plcService.IsConnected)
        {
            throw new InvalidOperationException("PLC_DISCONNECTED: Siemens S7-1200 is disconnected. Machine command locked.");
        }

        // 1. Safety & Interlock Check via Siemens S7-1200
        var telemetry = await _plcService.ReadTelemetryAsync(ct);
        if (telemetry.EmergencyStopActive)
        {
            throw new InvalidOperationException("EMERGENCY_STOP_ACTIVE: Emergency Stop aktif! Lepaskan tombol darurat fisik terlebih dahulu.");
        }

        if (telemetry.AirPressureBar < 5.5) // Min 80 PSI / 5.5 Bar
        {
            throw new InvalidOperationException($"AIR_PRESSURE_LOW: Tekanan kompresor rendah ({telemetry.AirPressureBar:F1} Bar)! Interlock keselamatan aktif.");
        }

        // 2. Cycle Calculation & Moisture Compensation
        _totalCycles = Math.Max(1, request.MixingCycles);
        _volumePerCycle = request.TargetVolumeM3 / _totalCycles;
        _currentCycleIndex = 1;

        // Create base recipe targets scaled to volume per cycle
        var targetPasir1Dry = 550.0 * _volumePerCycle;
        var waterInPasir1 = targetPasir1Dry * (request.MoisturePasir1Pct / 100.0);
        var targetPasir1Wet = targetPasir1Dry + waterInPasir1;

        var targetWaterBase = 160.0 * _volumePerCycle;
        var targetWaterCompensated = Math.Max(20.0, targetWaterBase - waterInPasir1);

        var formula = new JobMixFormula
        {
            MutuBeton = request.RecipeId,
            Pasir1Target = targetPasir1Wet,
            Pasir2Target = 150.0 * _volumePerCycle,
            Batu1Target = 680.0 * _volumePerCycle,
            Batu2Target = 300.0 * _volumePerCycle,
            SemenTarget = 350.0 * _volumePerCycle,
            AirTarget = targetWaterCompensated,
            AdditiveTarget = 2.0 * _volumePerCycle
        };

        // 3. Write target DB to Siemens S7-1200 PLC
        await _plcService.WriteBatchRecipeTargetsAsync(formula, _volumePerCycle, ct);

        // 4. Send Hardware Start Pulse to S7-1200
        await _plcService.SendStartCommandAsync(request.Mode, ct);

        // 5. Initialize Batch Log Record with JMF Snapshot
        _currentBatch = new BatchLog
        {
            BatchNumber = "BATCH-" + DateTime.Now.ToString("yyyyMMdd-HHmmss"),
            RecipeId = request.RecipeId,
            RecipeName = request.RecipeId,
            OrderedVolume = request.TargetVolumeM3,
            MixingCycles = _totalCycles,
            SiloSemenUsed = request.SiloSemen,
            Pelanggan = request.Pelanggan,
            Lokasi = request.Lokasi,
            NoKendaraan = request.NoKendaraan,
            Sopir = request.Sopir,
            OperatorName = request.OperatorName,
            Mode = request.Mode,
            Status = BatchStatus.WEIGHING,
            StartTime = DateTime.UtcNow,
            TargetPasir1 = formula.Pasir1Target * _totalCycles,
            TargetPasir2 = formula.Pasir2Target * _totalCycles,
            TargetBatu1 = formula.Batu1Target * _totalCycles,
            TargetBatu2 = formula.Batu2Target * _totalCycles,
            TargetSemen = formula.SemenTarget * _totalCycles,
            TargetAir = formula.AirTarget * _totalCycles,
            TargetAdditive = formula.AdditiveTarget * _totalCycles,
            MoisturePasir1Pct = request.MoisturePasir1Pct,
            MoisturePasir2Pct = request.MoisturePasir2Pct,
            MoistureBatu1Pct = request.MoistureBatu1Pct,
            MoistureBatu2Pct = request.MoistureBatu2Pct
        };

        _status = BatchStatus.WEIGHING;

        // Save initial state locally
        await _batchRepository.AddBatchLogAsync(_currentBatch);

        return _currentBatch.BatchNumber;
    }

    public async Task PauseBatchAsync(CancellationToken ct = default)
    {
        _status = BatchStatus.PAUSED;
        await _plcService.SendPauseCommandAsync(ct);
        if (_currentBatch != null)
        {
            _currentBatch.Status = BatchStatus.PAUSED;
            await _batchRepository.UpdateBatchLogAsync(_currentBatch);
        }
    }

    public async Task ResumeBatchAsync(CancellationToken ct = default)
    {
        _status = BatchStatus.WEIGHING;
        await _plcService.SendResumeCommandAsync(ct);
        if (_currentBatch != null)
        {
            _currentBatch.Status = BatchStatus.WEIGHING;
            await _batchRepository.UpdateBatchLogAsync(_currentBatch);
        }
    }

    public async Task AbortBatchAsync(string reason, CancellationToken ct = default)
    {
        _status = BatchStatus.ABORTED;
        await _plcService.SendEmergencyStopCommandAsync(ct);
        if (_currentBatch != null)
        {
            _currentBatch.Status = BatchStatus.ABORTED;
            _currentBatch.EndTime = DateTime.UtcNow;
            await _batchRepository.UpdateBatchLogAsync(_currentBatch);
            await _syncEngine.EnqueueAsync("BatchLog", _currentBatch.Id, _currentBatch);
        }
    }

    public async Task ToggleManualDeviceAsync(string actuatorKey, bool state, CancellationToken ct = default)
    {
        await _plcService.WriteManualManualActuatorToggleAsync(actuatorKey, state, ct);
    }

    public BatchProgressUpdateDto GetCurrentProgress()
    {
        return new BatchProgressUpdateDto(
            BatchId: _currentBatch?.BatchNumber ?? "STANDBY",
            Status: _status,
            CurrentCycle: _currentCycleIndex,
            TotalCycles: _totalCycles,
            CurrentCycleVolumeM3: _volumePerCycle,
            PasirActual: 0.0,
            BatuActual: 0.0,
            SemenActual: 0.0,
            AirActual: 0.0,
            AdditiveActual: 0.0,
            SlumpEstimated: 12.0,
            MixerAmpere: 45.0,
            AirPressureBar: 6.8,
            EmergencyStop: false
        );
    }
}
