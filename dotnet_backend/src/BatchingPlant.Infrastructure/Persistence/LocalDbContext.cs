using BatchingPlant.Domain.Entities;
using BatchingPlant.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace BatchingPlant.Infrastructure.Persistence;

public class LocalDbContext : DbContext
{
    public DbSet<JobMixFormula> JobMixFormulas => Set<JobMixFormula>();
    public DbSet<Material> Materials => Set<Material>();
    public DbSet<Jmf> Jmfs => Set<Jmf>();
    public DbSet<JmfVersion> JmfVersions => Set<JmfVersion>();
    public DbSet<RecipeComponent> RecipeComponents => Set<RecipeComponent>();
    public DbSet<BatchJmfSnapshot> BatchJmfSnapshots => Set<BatchJmfSnapshot>();
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

        // Material
        modelBuilder.Entity<Material>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasIndex(x => x.Code).IsUnique();
            b.HasIndex(x => x.MaterialType);
            b.HasIndex(x => x.IsActive);
        });

        // Jmf
        modelBuilder.Entity<Jmf>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasIndex(x => x.Code).IsUnique();
            b.HasIndex(x => x.IsActive);
            b.HasMany(x => x.Versions)
             .WithOne(v => v.Jmf)
             .HasForeignKey(v => v.JmfId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // JmfVersion
        modelBuilder.Entity<JmfVersion>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasIndex(x => new { x.JmfId, x.VersionNumber }).IsUnique();
            b.HasIndex(x => x.Status);
            b.HasMany(x => x.RecipeComponents)
             .WithOne(c => c.JmfVersion)
             .HasForeignKey(c => c.JmfVersionId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // RecipeComponent
        modelBuilder.Entity<RecipeComponent>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasIndex(x => new { x.JmfVersionId, x.MaterialId }).IsUnique();
            b.Property(x => x.TargetQuantity).HasPrecision(18, 4);
            b.HasOne(x => x.Material)
             .WithMany()
             .HasForeignKey(x => x.MaterialId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // BatchJmfSnapshot
        modelBuilder.Entity<BatchJmfSnapshot>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasIndex(x => x.BatchLogId);
            b.HasIndex(x => x.JmfId);
            b.HasIndex(x => x.JmfVersionId);
            b.Property(x => x.TargetVolumeM3).HasPrecision(18, 4);
        });

        // BatchLog
        modelBuilder.Entity<BatchLog>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasIndex(x => x.BatchNumber).IsUnique();
            b.HasIndex(x => x.StartTime);
            b.HasIndex(x => x.IsSyncedToCentral);
            b.HasOne(x => x.JmfSnapshot)
             .WithMany()
             .HasForeignKey(x => x.JmfSnapshotId)
             .OnDelete(DeleteBehavior.SetNull);
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
