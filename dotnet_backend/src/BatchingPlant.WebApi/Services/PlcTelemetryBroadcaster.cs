using BatchingPlant.Application.Services;
using BatchingPlant.Domain.Interfaces;
using BatchingPlant.WebApi.Hubs;
using Microsoft.AspNetCore.SignalR;
using Serilog;

namespace BatchingPlant.WebApi.Services;

public class PlcTelemetryBroadcaster : BackgroundService
{
    private readonly ISiemensS7Service _plcService;
    private readonly IBatchExecutionService _batchService;
    private readonly IHubContext<BatchingHub, IBatchingHubClient> _hubContext;
    private readonly Serilog.ILogger _logger = Log.ForContext<PlcTelemetryBroadcaster>();

    public PlcTelemetryBroadcaster(
        ISiemensS7Service plcService,
        IBatchExecutionService batchService,
        IHubContext<BatchingHub, IBatchingHubClient> hubContext)
    {
        _plcService = plcService;
        _batchService = batchService;
        _hubContext = hubContext;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.Information("PLC Telemetry Broadcaster initialized (10 Hz rate).");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Read live analog loadcells and digital inputs from S7-1200 DB3
                var telemetry = await _plcService.ReadTelemetryAsync(stoppingToken);
                var ioStatus = await _plcService.ReadIoStatusAsync(stoppingToken);
                var batchProgress = _batchService.GetCurrentProgress();

                // Broadcast live state to React HMI via SignalR
                await _hubContext.Clients.All.ReceiveTelemetry(new
                {
                    weights = new
                    {
                        aggregate = telemetry.WeightAggregate,
                        cement = telemetry.WeightCement,
                        water = telemetry.WeightWater,
                        additive = telemetry.WeightAdditive,
                        waitingHopper = telemetry.WeightWaitingHopper
                    },
                    ampere = telemetry.MixerCurrentAmpere,
                    pressure = telemetry.AirPressureBar,
                    slump = telemetry.EstimatedSlumpCm,
                    estop = telemetry.EmergencyStopActive,
                    truck = telemetry.TruckPresent,
                    driver = telemetry.DriverDischargeButton
                });

                await _hubContext.Clients.All.ReceiveActuatorState(ioStatus);
                await _hubContext.Clients.All.ReceiveBatchProgress(batchProgress);
            }
            catch (Exception ex)
            {
                _logger.Verbose("Broadcast tick exception: {Message}", ex.Message);
            }

            // 100 ms period = 10 Hz high-speed update rate for industrial SCADA
            await Task.Delay(100, stoppingToken);
        }
    }
}
