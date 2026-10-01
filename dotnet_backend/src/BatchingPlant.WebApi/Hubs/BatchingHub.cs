using Microsoft.AspNetCore.SignalR;

namespace BatchingPlant.WebApi.Hubs;

public interface IBatchingHubClient
{
    Task ReceiveTelemetry(object telemetry);
    Task ReceiveActuatorState(object actuatorState);
    Task ReceiveBatchProgress(object progress);
    Task ReceiveAlarm(object alarm);
}

public class BatchingHub : Hub<IBatchingHubClient>
{
    public async Task SendManualCommand(string actuatorKey, bool state)
    {
        // Operator manual trigger from UI
        await Clients.Others.ReceiveActuatorState(new { key = actuatorKey, state });
    }
}
