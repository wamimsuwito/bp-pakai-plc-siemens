using BatchingPlant.Domain.Entities;
using BatchingPlant.Domain.Enums;
using BatchingPlant.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace BatchingPlant.Infrastructure.Services;

public class LegacyStorageMigrationService
{
    private readonly LocalDbContext _context;
    private readonly ILogger _logger = Log.ForContext<LegacyStorageMigrationService>();

    public LegacyStorageMigrationService(LocalDbContext context)
    {
        _context = context;
    }

    public async Task<int> MigrateJmfAsync(List<JobMixFormula> legacyList)
    {
        int count = 0;
        foreach (var jmf in legacyList)
        {
            var exists = await _context.JobMixFormulas.AnyAsync(x => x.MutuBeton.ToUpper() == jmf.MutuBeton.ToUpper());
            if (!exists)
            {
                jmf.Id = Guid.NewGuid().ToString();
                jmf.CreatedAt = DateTime.UtcNow;
                await _context.JobMixFormulas.AddAsync(jmf);
                count++;
            }
        }
        if (count > 0) await _context.SaveChangesAsync();
        _logger.Information("LegacyStorageMigration: Migrated {Count} JMF records to SQLite.", count);
        return count;
    }

    public async Task<int> MigrateBatchesAsync(List<BatchLog> legacyBatches)
    {
        int count = 0;
        foreach (var batch in legacyBatches)
        {
            var exists = await _context.BatchLogs.AnyAsync(x => x.BatchNumber == batch.BatchNumber);
            if (!exists)
            {
                if (string.IsNullOrEmpty(batch.Id)) batch.Id = Guid.NewGuid().ToString();
                await _context.BatchLogs.AddAsync(batch);
                count++;
            }
        }
        if (count > 0) await _context.SaveChangesAsync();
        _logger.Information("LegacyStorageMigration: Migrated {Count} Batch records to SQLite.", count);
        return count;
    }

    public async Task<int> MigrateUsersAsync(List<UserAccount> legacyUsers)
    {
        int count = 0;
        foreach (var u in legacyUsers)
        {
            var exists = await _context.UserAccounts.AnyAsync(x => x.Nik == u.Nik);
            if (!exists)
            {
                if (string.IsNullOrEmpty(u.Id)) u.Id = Guid.NewGuid().ToString();
                await _context.UserAccounts.AddAsync(u);
                count++;
            }
        }
        if (count > 0) await _context.SaveChangesAsync();
        _logger.Information("LegacyStorageMigration: Migrated {Count} User records to SQLite.", count);
        return count;
    }
}
