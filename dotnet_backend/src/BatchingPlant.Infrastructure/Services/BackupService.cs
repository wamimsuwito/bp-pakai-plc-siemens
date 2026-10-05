using BatchingPlant.Domain.Interfaces;
using BatchingPlant.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace BatchingPlant.Infrastructure.Services;

public class BackupService : IBackupService
{
    private readonly LocalDbContext _context;
    private readonly IStoragePathService _storagePath;
    private readonly ILogger _logger = Log.ForContext<BackupService>();

    public BackupService(LocalDbContext context, IStoragePathService storagePath)
    {
        _context = context;
        _storagePath = storagePath;
    }

    public async Task<string> CreateBackupAsync(string? targetDirectory = null)
    {
        var targetDir = string.IsNullOrWhiteSpace(targetDirectory)
            ? _storagePath.BackupDirectory
            : targetDirectory;

        if (!Directory.Exists(targetDir))
        {
            Directory.CreateDirectory(targetDir);
        }

        var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
        var backupFileName = $"batchingplant_{timestamp}.db";
        var backupPath = Path.Combine(targetDir, backupFileName);

        _logger.Information("Initiating SQLite atomic VACUUM INTO backup to {Path}", backupPath);

        // Safe atomic SQLite snapshot without shutting down the database
        // SQLite VACUUM INTO grammar requires a literal string path, parameters are not supported by SQLite syntax
#pragma warning disable EF1002
        var sanitizedPath = backupPath.Replace("'", "''");
        await _context.Database.ExecuteSqlRawAsync($"VACUUM INTO '{sanitizedPath}'");
#pragma warning restore EF1002

        _logger.Information("SUCCESS: SQLite backup created at {Path}", backupPath);
        return backupPath;
    }
}
