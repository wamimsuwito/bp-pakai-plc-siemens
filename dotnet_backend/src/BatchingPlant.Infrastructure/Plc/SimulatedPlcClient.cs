using BatchingPlant.Domain.Entities;
using BatchingPlant.Domain.Enums;
using BatchingPlant.Domain.Interfaces;
using Serilog;

namespace BatchingPlant.Infrastructure.Plc;

public class SimulatedPlcClient : IPlcClient
{
    private readonly ILogger _logger = Log.ForContext<SimulatedPlcClient>();
    private readonly SemaphoreSlim _lock = new(1, 1);

    public PlcConnectionStatus Status => PlcConnectionStatus.SIMULATION;
    public OperationMode Mode => OperationMode.SIMULATION;
    public bool IsConnected => true;

    private readonly S7LiveTelemetryBlock _simTelemetry = new()
    {
        AirPressureBar = 7.0f,
        MixerAmpere = 52.0f,
        SlumpEstimated = 12.0f,
        EstopInput = false,
        TruckDetected = true,
        DriverConsentButton = true
    };

    private readonly S7ActuatorFeedbackBlock _simActuators = new();

    public Task<bool> ConnectAsync(string ipAddress, int rack = 0, int slot = 1, CancellationToken ct = default)
    {
        _logger.Information("[SIMULATION_MODE] Explicit Simulated PLC Client active.");
        return Task.FromResult(true);
    }

    public Task DisconnectAsync()
    {
        return Task.CompletedTask;
    }

    public Task<ScaleTelemetry> ReadTelemetryAsync(CancellationToken ct = default)
    {
        return Task.FromResult(new ScaleTelemetry(
            _simTelemetry.WeightAggregate,
            _simTelemetry.WeightCement,
            _simTelemetry.WeightWater,
            _simTelemetry.WeightAdditive,
            _simTelemetry.WeightWaitingHopper,
            _simTelemetry.AirPressureBar,
            _simTelemetry.MixerAmpere,
            _simTelemetry.SlumpEstimated,
            _simTelemetry.EstopInput,
            _simTelemetry.TruckDetected,
            _simTelemetry.DriverConsentButton
        ));
    }

    public Task<DigitalIoStatus> ReadIoStatusAsync(CancellationToken ct = default)
    {
        return Task.FromResult(new DigitalIoStatus(
            _simActuators.MixerMotorOn,
            _simActuators.ConveyorUpperOn,
            _simActuators.ConveyorBottomOn,
            _simActuators.CompressorOn,
            _simActuators.GatePasir1Open,
            _simActuators.GatePasir2Open,
            _simActuators.GateBatu1Open,
            _simActuators.GateBatu2Open,
            _simActuators.DumpPasirOpen,
            _simActuators.DumpBatuOpen,
            _simActuators.DumpSemenOpen,
            _simActuators.DumpWaterOpen,
            _simActuators.VibratorOn,
            _simActuators.HornOn,
            _simActuators.WaitingHopperGateOpen,
            _simActuators.MixerDoorOpen,
            _simActuators.MixerDoorClose,
            _simActuators.ActiveSiloNumber
        ));
    }

    public Task WriteBatchRecipeTargetsAsync(JobMixFormula formula, double volumePerCycle, CancellationToken ct = default)
    {
        _logger.Information("[SIMULATION_MODE] Recipe targets stored in simulation memory.");
        return Task.CompletedTask;
    }

    public Task SendStartCommandAsync(BatchingMode mode, CancellationToken ct = default)
    {
        _logger.Information("[SIMULATION_MODE] Start command acknowledged.");
        _simActuators.MixerMotorOn = true;
        _simActuators.CompressorOn = true;
        return Task.CompletedTask;
    }

    public Task SendPauseCommandAsync(CancellationToken ct = default)
    {
        _logger.Information("[SIMULATION_MODE] Pause command acknowledged.");
        return Task.CompletedTask;
    }

    public Task SendResumeCommandAsync(CancellationToken ct = default)
    {
        _logger.Information("[SIMULATION_MODE] Resume command acknowledged.");
        return Task.CompletedTask;
    }

    public Task SendEmergencyStopCommandAsync(CancellationToken ct = default)
    {
        _logger.Warning("[SIMULATION_MODE] EMERGENCY STOP simulation triggered.");
        _simActuators.MixerMotorOn = false;
        _simActuators.ConveyorUpperOn = false;
        _simActuators.ConveyorBottomOn = false;
        _simActuators.GatePasir1Open = false;
        _simActuators.GateBatu1Open = false;
        return Task.CompletedTask;
    }

    public Task WriteManualActuatorToggleAsync(string actuatorName, bool state, CancellationToken ct = default)
    {
        _logger.Information("[SIMULATION_MODE] Actuator {Actuator} -> {State}", actuatorName, state);
        switch (actuatorName.ToLower())
        {
            case "mixer": _simActuators.MixerMotorOn = state; break;
            case "conveyor_atas": _simActuators.ConveyorUpperOn = state; break;
            case "conveyor_bawah": _simActuators.ConveyorBottomOn = state; break;
            case "compressor": _simActuators.CompressorOn = state; break;
            case "pasir1": _simActuators.GatePasir1Open = state; break;
            case "pasir2": _simActuators.GatePasir2Open = state; break;
            case "batu1": _simActuators.GateBatu1Open = state; break;
            case "batu2": _simActuators.GateBatu2Open = state; break;
            case "dump_pasir": _simActuators.DumpPasirOpen = state; break;
            case "dump_batu": _simActuators.DumpBatuOpen = state; break;
            case "dump_semen": _simActuators.DumpSemenOpen = state; break;
            case "dump_air": _simActuators.DumpWaterOpen = state; break;
            case "vibrator": _simActuators.VibratorOn = state; break;
            case "klakson": _simActuators.HornOn = state; break;
            case "waiting_hopper": _simActuators.WaitingHopperGateOpen = state; break;
            case "mixer_buka": _simActuators.MixerDoorOpen = state; break;
            case "mixer_tutup": _simActuators.MixerDoorClose = state; break;
        }
        return Task.CompletedTask;
    }
}
