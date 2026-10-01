using BatchingPlant.Domain.Entities;
using BatchingPlant.Domain.Enums;
using BatchingPlant.Domain.Interfaces;
using S7.Net;
using Serilog;

namespace BatchingPlant.Infrastructure.Plc;

public class SiemensS71200Driver : IPlcClient, ISiemensS7Service
{
    private readonly ILogger _logger = Log.ForContext<SiemensS71200Driver>();
    private S7.Net.Plc? _plc;
    private readonly SemaphoreSlim _lock = new(1, 1);
    private string _ip = "192.168.0.1";
    private int _rack = 0;
    private int _slot = 1;

    public PlcConnectionStatus Status { get; private set; } = PlcConnectionStatus.DISCONNECTED;
    public OperationMode Mode { get; private set; } = OperationMode.PRODUCTION;
    public bool IsConnected => _plc != null && _plc.IsConnected && Status == PlcConnectionStatus.CONNECTED;

    public async Task<bool> ConnectAsync(string ipAddress, int rack = 0, int slot = 1, CancellationToken ct = default)
    {
        await _lock.WaitAsync(ct);
        try
        {
            _ip = ipAddress;
            _rack = rack;
            _slot = slot;

            _logger.Information("[PRODUCTION] Connecting to Siemens S7-1200 PLC at {Ip}, Rack: {Rack}, Slot: {Slot}", _ip, _rack, _slot);

            _plc = new S7.Net.Plc(CpuType.S71200, _ip, (short)_rack, (short)_slot);
            try
            {
                await _plc.OpenAsync(ct);
                Status = PlcConnectionStatus.CONNECTED;
                _logger.Information("SUCCESS: Connected to physical Siemens S7-1200 PLC.");
                return true;
            }
            catch (Exception ex)
            {
                // CRITICAL SAFETY RULE:
                // NEVER automatically fallback to simulation in Production mode!
                // Disconnect MUST mean FAULT, with zero actuator movement.
                Status = PlcConnectionStatus.FAULT;
                _logger.Error("PLC COMMUNICATION FAULT at {Ip}: {Message}. Machine control locked out.", _ip, ex.Message);
                return false;
            }
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task DisconnectAsync()
    {
        await _lock.WaitAsync();
        try
        {
            if (_plc != null && _plc.IsConnected)
            {
                _plc.Close();
            }
            _plc = null;
            Status = PlcConnectionStatus.DISCONNECTED;
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<ScaleTelemetry> ReadTelemetryAsync(CancellationToken ct = default)
    {
        await _lock.WaitAsync(ct);
        try
        {
            if (_plc == null || !_plc.IsConnected || Status != PlcConnectionStatus.CONNECTED)
            {
                // If disconnected in production, return zeroed safe telemetry with estop active
                return new ScaleTelemetry(0, 0, 0, 0, 0, 0, 0, 0, true, false, false);
            }

            var block = new S7LiveTelemetryBlock();
            await _plc.ReadClassAsync(block, S7MemoryMap.DB_LIVE_TELEMETRY, 0, ct);

            return new ScaleTelemetry(
                block.WeightAggregate,
                block.WeightCement,
                block.WeightWater,
                block.WeightAdditive,
                block.WeightWaitingHopper,
                block.AirPressureBar,
                block.MixerAmpere,
                block.SlumpEstimated,
                block.EstopInput,
                block.TruckDetected,
                block.DriverConsentButton
            );
        }
        catch (Exception ex)
        {
            Status = PlcConnectionStatus.FAULT;
            _logger.Error("Error reading PLC telemetry: {Message}", ex.Message);
            return new ScaleTelemetry(0, 0, 0, 0, 0, 0, 0, 0, true, false, false);
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<DigitalIoStatus> ReadIoStatusAsync(CancellationToken ct = default)
    {
        await _lock.WaitAsync(ct);
        try
        {
            if (_plc == null || !_plc.IsConnected || Status != PlcConnectionStatus.CONNECTED)
            {
                return new DigitalIoStatus(false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, 1);
            }

            var block = new S7ActuatorFeedbackBlock();
            await _plc.ReadClassAsync(block, S7MemoryMap.DB_ACTUATOR_FEEDBACK, 0, ct);

            return new DigitalIoStatus(
                block.MixerMotorOn,
                block.ConveyorUpperOn,
                block.ConveyorBottomOn,
                block.CompressorOn,
                block.GatePasir1Open,
                block.GatePasir2Open,
                block.GateBatu1Open,
                block.GateBatu2Open,
                block.DumpPasirOpen,
                block.DumpBatuOpen,
                block.DumpSemenOpen,
                block.DumpWaterOpen,
                block.VibratorOn,
                block.HornOn,
                block.WaitingHopperGateOpen,
                block.MixerDoorOpen,
                block.MixerDoorClose,
                block.ActiveSiloNumber
            );
        }
        catch (Exception ex)
        {
            Status = PlcConnectionStatus.FAULT;
            _logger.Error("Error reading PLC IO status: {Message}", ex.Message);
            return new DigitalIoStatus(false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, 1);
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task WriteBatchRecipeTargetsAsync(JobMixFormula formula, double volumePerCycle, CancellationToken ct = default)
    {
        await _lock.WaitAsync(ct);
        try
        {
            if (_plc == null || !_plc.IsConnected || Status != PlcConnectionStatus.CONNECTED)
            {
                throw new InvalidOperationException("PLC FAULT: Cannot write recipe targets when PLC is disconnected.");
            }

            var targetBlock = new S7RecipeTargetBlock
            {
                TargetPasir1 = (float)formula.Pasir1Target,
                TargetPasir2 = (float)formula.Pasir2Target,
                TargetBatu1 = (float)formula.Batu1Target,
                TargetBatu2 = (float)formula.Batu2Target,
                TargetSemen = (float)formula.SemenTarget,
                TargetAir = (float)formula.AirTarget,
                TargetAdditive = (float)formula.AdditiveTarget,
                TargetSlump = (float)formula.TargetSlumpCm,
                MixingTimeSec = formula.MixingTimeSec
            };

            await _plc.WriteClassAsync(targetBlock, S7MemoryMap.DB_RECIPE_TARGETS, 0, ct);
            _logger.Information("DB2 targets sent to S7-1200: P1={P1}, B1={B1}, Semen={Semen}, Air={Air}",
                targetBlock.TargetPasir1, targetBlock.TargetBatu1, targetBlock.TargetSemen, targetBlock.TargetAir);
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task SendStartCommandAsync(BatchingMode mode, CancellationToken ct = default)
    {
        await _lock.WaitAsync(ct);
        try
        {
            if (_plc == null || !_plc.IsConnected || Status != PlcConnectionStatus.CONNECTED)
            {
                throw new InvalidOperationException("PLC FAULT: Cannot send start command when PLC is disconnected.");
            }

            var cmd = new S7ControlStatusBlock
            {
                StartCmd = true,
                ModeAuto = mode == BatchingMode.AUTO,
                ModeSemiAuto = mode == BatchingMode.SEMI_AUTO,
                ModeManual = mode == BatchingMode.MANUAL
            };

            await _plc.WriteClassAsync(cmd, S7MemoryMap.DB_CONTROL_STATUS, 0, ct);
            _logger.Information("PLC Start Command sent with Mode: {Mode}", mode);
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task SendPauseCommandAsync(CancellationToken ct = default)
    {
        await _lock.WaitAsync(ct);
        try
        {
            if (_plc == null || !_plc.IsConnected || Status != PlcConnectionStatus.CONNECTED)
            {
                throw new InvalidOperationException("PLC FAULT: Cannot send pause command when PLC is disconnected.");
            }

            await _plc.WriteBytesAsync(DataType.DataBlock, S7MemoryMap.DB_CONTROL_STATUS, 0, new byte[] { 0x02 });
            _logger.Information("PLC Pause Command sent.");
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task SendResumeCommandAsync(CancellationToken ct = default)
    {
        await _lock.WaitAsync(ct);
        try
        {
            if (_plc == null || !_plc.IsConnected || Status != PlcConnectionStatus.CONNECTED)
            {
                throw new InvalidOperationException("PLC FAULT: Cannot send resume command when PLC is disconnected.");
            }

            await _plc.WriteBytesAsync(DataType.DataBlock, S7MemoryMap.DB_CONTROL_STATUS, 0, new byte[] { 0x04 });
            _logger.Information("PLC Resume Command sent.");
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task SendEmergencyStopCommandAsync(CancellationToken ct = default)
    {
        await _lock.WaitAsync(ct);
        try
        {
            if (_plc != null && _plc.IsConnected)
            {
                await _plc.WriteBytesAsync(DataType.DataBlock, S7MemoryMap.DB_CONTROL_STATUS, 0, new byte[] { 0x08 });
            }
            _logger.Warning("EMERGENCY STOP supervisory command issued to Siemens S7-1200!");
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task WriteManualActuatorToggleAsync(string actuatorName, bool state, CancellationToken ct = default)
    {
        await WriteManualManualActuatorToggleAsync(actuatorName, state, ct);
    }

    public async Task WriteManualManualActuatorToggleAsync(string actuatorName, bool state, CancellationToken ct = default)
    {
        await _lock.WaitAsync(ct);
        try
        {
            if (_plc == null || !_plc.IsConnected || Status != PlcConnectionStatus.CONNECTED)
            {
                throw new InvalidOperationException("PLC FAULT: Cannot toggle manual actuator when PLC is disconnected.");
            }
            _logger.Information("PLC Manual Toggle: {Actuator} -> {State}", actuatorName, state);
            // S7 tag write implementation
        }
        finally
        {
            _lock.Release();
        }
    }
}
