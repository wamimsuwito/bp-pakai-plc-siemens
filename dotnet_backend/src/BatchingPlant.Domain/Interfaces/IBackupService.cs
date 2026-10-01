namespace BatchingPlant.Domain.Interfaces;

public interface IBackupService
{
    Task<string> CreateBackupAsync(string? targetDirectory = null);
}
