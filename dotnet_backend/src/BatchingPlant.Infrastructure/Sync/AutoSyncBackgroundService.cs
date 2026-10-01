using BatchingPlant.Domain.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Serilog;

namespace BatchingPlant.Infrastructure.Sync;

public class AutoSyncBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger _logger = Log.ForContext<AutoSyncBackgroundService>();

    public AutoSyncBackgroundService(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.Information("AutoSync Background Service started. Ready for offline-first replication.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var syncEngine = scope.ServiceProvider.GetRequiredService<ISyncEngine>();

                bool isConnected = await syncEngine.PingCentralPostgresAsync(stoppingToken);
                if (isConnected)
                {
                    int processed = await syncEngine.ProcessSyncQueueAsync(stoppingToken);
                    if (processed > 0)
                    {
                        _logger.Information("Synchronized {Count} offline batch records to Central PostgreSQL.", processed);
                    }
                }
                else
                {
                    _logger.Debug("Central PostgreSQL unreachable. Retaining records in Local SQLite queue.");
                }
            }
            catch (Exception ex)
            {
                _logger.Warning("Sync cycle error: {Message}", ex.Message);
            }

            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }
    }
}
