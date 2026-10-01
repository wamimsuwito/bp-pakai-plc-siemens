using System.Text.Json;
using BatchingPlant.Domain.Entities;
using BatchingPlant.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace BatchingPlant.Infrastructure.Persistence.Repositories;

public class BatchRepository : IBatchRepository
{
    private readonly LocalDbContext _context;

    public BatchRepository(LocalDbContext context)
    {
        _context = context;
    }

    public async Task<BatchLog?> GetByIdAsync(string id)
    {
        return await _context.BatchLogs.FirstOrDefaultAsync(b => b.Id == id || b.BatchNumber == id);
    }

    public async Task<IEnumerable<BatchLog>> GetRecentBatchesAsync(int limit = 50)
    {
        return await _context.BatchLogs
            .OrderByDescending(b => b.StartTime)
            .Take(limit)
            .ToListAsync();
    }

    public async Task<IEnumerable<BatchLog>> SearchBatchesAsync(string? keyword, DateTime? fromDate, DateTime? toDate)
    {
        var query = _context.BatchLogs.AsQueryable();

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var term = keyword.Trim().ToLower();
            query = query.Where(b => b.BatchNumber.ToLower().Contains(term) ||
                                     b.RecipeName.ToLower().Contains(term) ||
                                     b.Pelanggan.ToLower().Contains(term) ||
                                     b.Sopir.ToLower().Contains(term) ||
                                     b.NoKendaraan.ToLower().Contains(term));
        }

        if (fromDate.HasValue)
        {
            query = query.Where(b => b.StartTime >= fromDate.Value);
        }

        if (toDate.HasValue)
        {
            query = query.Where(b => b.StartTime <= toDate.Value);
        }

        return await query.OrderByDescending(b => b.StartTime).ToListAsync();
    }

    public async Task AddBatchLogAsync(BatchLog log)
    {
        await _context.BatchLogs.AddAsync(log);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateBatchLogAsync(BatchLog log)
    {
        _context.BatchLogs.Update(log);
        await _context.SaveChangesAsync();
    }
}

public class SyncEngine : ISyncEngine
{
    private readonly LocalDbContext _localContext;
    private readonly CentralDbContext _centralContext;

    public SyncEngine(LocalDbContext localContext, CentralDbContext centralContext)
    {
        _localContext = localContext;
        _centralContext = centralContext;
    }

    public async Task EnqueueAsync(string entityType, string entityId, object payload)
    {
        var item = new SyncQueueItem
        {
            EntityType = entityType,
            EntityId = entityId,
            PayloadJson = JsonSerializer.Serialize(payload),
            CreatedAt = DateTime.UtcNow,
            IsProcessed = false
        };

        await _localContext.SyncQueueItems.AddAsync(item);
        await _localContext.SaveChangesAsync();
    }

    public async Task<int> ProcessSyncQueueAsync(CancellationToken ct = default)
    {
        var pendingItems = await _localContext.SyncQueueItems
            .Where(x => !x.IsProcessed && x.RetryCount < 5)
            .OrderBy(x => x.CreatedAt)
            .Take(50)
            .ToListAsync(ct);

        if (!pendingItems.Any()) return 0;

        int processed = 0;
        foreach (var item in pendingItems)
        {
            try
            {
                if (item.EntityType == "BatchLog")
                {
                    var log = JsonSerializer.Deserialize<BatchLog>(item.PayloadJson);
                    if (log != null)
                    {
                        var exists = await _centralContext.CentralProductionLogs
                            .AnyAsync(x => x.Id == log.Id, ct);

                        if (!exists)
                        {
                            await _centralContext.CentralProductionLogs.AddAsync(log, ct);
                        }
                        else
                        {
                            _centralContext.CentralProductionLogs.Update(log);
                        }
                    }
                }

                item.IsProcessed = true;
                item.ProcessedAt = DateTime.UtcNow;
                processed++;
            }
            catch (Exception ex)
            {
                item.RetryCount++;
                item.LastError = ex.Message;
            }
        }

        await _centralContext.SaveChangesAsync(ct);
        await _localContext.SaveChangesAsync(ct);
        return processed;
    }

    public async Task<bool> PingCentralPostgresAsync(CancellationToken ct = default)
    {
        try
        {
            return await _centralContext.Database.CanConnectAsync(ct);
        }
        catch
        {
            return false;
        }
    }
}
