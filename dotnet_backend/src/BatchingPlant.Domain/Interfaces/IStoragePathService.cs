namespace BatchingPlant.Domain.Interfaces;

public interface IStoragePathService
{
    string RootPath { get; }
    string DatabaseDirectory { get; }
    string DatabaseFilePath { get; }
    string BackupDirectory { get; }
    string LogsDirectory { get; }
    string ReportsDirectory { get; }
    string ExportsDirectory { get; }
    string ImportDirectory { get; }
    string ConfigDirectory { get; }
    string SyncDirectory { get; }

    void EnsureDirectoriesCreated();
}
