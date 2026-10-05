using System.Runtime.InteropServices;
using BatchingPlant.Domain.Interfaces;
using Microsoft.Extensions.Configuration;
using Serilog;

namespace BatchingPlant.Infrastructure.Services;

public class StoragePathService : IStoragePathService
{
    private readonly ILogger _logger = Log.ForContext<StoragePathService>();
    public string RootPath { get; }
    public string DatabaseDirectory => Path.Combine(RootPath, "Database");
    public string DatabaseFilePath => Path.Combine(DatabaseDirectory, "batchingplant.db");
    public string BackupDirectory => Path.Combine(RootPath, "Backup");
    public string LogsDirectory => Path.Combine(RootPath, "Logs");
    public string ReportsDirectory => Path.Combine(RootPath, "Reports");
    public string ExportsDirectory => Path.Combine(RootPath, "Exports");
    public string ImportDirectory => Path.Combine(RootPath, "Import");
    public string ConfigDirectory => Path.Combine(RootPath, "Config");
    public string SyncDirectory => Path.Combine(RootPath, "Sync");

    public StoragePathService(IConfiguration configuration)
    {
        var configuredRoot = configuration["BatchingPlant:Storage:RootPath"];

        if (!string.IsNullOrWhiteSpace(configuredRoot))
        {
            RootPath = configuredRoot;
        }
        else
        {
            RootPath = @"D:\BatchingPlant";
        }

        EnsureDirectoriesCreated();
    }

    public StoragePathService(string customRootPath)
    {
        RootPath = customRootPath;
        EnsureDirectoriesCreated();
    }

    public void EnsureDirectoriesCreated()
    {
        try
        {
            var directories = new[]
            {
                RootPath,
                DatabaseDirectory,
                BackupDirectory,
                LogsDirectory,
                ReportsDirectory,
                ExportsDirectory,
                ImportDirectory,
                ConfigDirectory,
                SyncDirectory
            };

            foreach (var dir in directories)
            {
                if (!Directory.Exists(dir))
                {
                    Directory.CreateDirectory(dir);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.Warning("Storage directory creation check notice: {Message}. Storage path: {RootPath}", ex.Message, RootPath);
        }
    }
}
