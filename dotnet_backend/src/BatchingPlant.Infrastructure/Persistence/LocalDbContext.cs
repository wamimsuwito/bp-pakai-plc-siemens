using BatchingPlant.Domain.Entities;
using BatchingPlant.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace BatchingPlant.Infrastructure.Persistence;

public class LocalDbContext : DbContext
{
    public DbSet<JobMixFormula> JobMixFormulas => Set<JobMixFormula>();
    public DbSet<BatchLog> BatchLogs => Set<BatchLog>();
    public DbSet<UserAccount> UserAccounts => Set<UserAccount>();
    public DbSet<SiloInventory> SiloInventories => Set<SiloInventory>();
    public DbSet<ScaleCalibration> ScaleCalibrations => Set<ScaleCalibration>();
    public DbSet<AlarmLog> AlarmLogs => Set<AlarmLog>();
    public DbSet<SyncQueueItem> SyncQueueItems => Set<SyncQueueItem>();
    public DbSet<AuditLogItem> AuditLogs => Set<AuditLogItem>();

    public LocalDbContext(DbContextOptions<LocalDbContext> options) : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // JobMixFormula
        modelBuilder.Entity<JobMixFormula>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasIndex(x => x.MutuBeton);
        });

        // BatchLog
        modelBuilder.Entity<BatchLog>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasIndex(x => x.BatchNumber).IsUnique();
            b.HasIndex(x => x.StartTime);
            b.HasIndex(x => x.IsSyncedToCentral);
        });

        // UserAccount
        modelBuilder.Entity<UserAccount>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasIndex(x => x.Nik).IsUnique();
        });

        // SiloInventory
        modelBuilder.Entity<SiloInventory>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasIndex(x => x.SiloIndex).IsUnique();
        });

        // SyncQueueItem
        modelBuilder.Entity<SyncQueueItem>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasIndex(x => x.IsProcessed);
            b.HasIndex(x => x.CreatedAt);
        });

        // AuditLogItem
        modelBuilder.Entity<AuditLogItem>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasIndex(x => x.CreatedAt);
            b.HasIndex(x => x.Action);
        });

        // ScaleCalibration
        modelBuilder.Entity<ScaleCalibration>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasIndex(x => x.ScaleType).IsUnique();
        });
    }
}
