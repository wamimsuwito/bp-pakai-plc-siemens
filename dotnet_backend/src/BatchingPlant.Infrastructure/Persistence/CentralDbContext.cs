using BatchingPlant.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace BatchingPlant.Infrastructure.Persistence;

public class CentralDbContext : DbContext
{
    public DbSet<JobMixFormula> CentralRecipes => Set<JobMixFormula>();
    public DbSet<BatchLog> CentralProductionLogs => Set<BatchLog>();
    public DbSet<AlarmLog> CentralAlarms => Set<AlarmLog>();

    public CentralDbContext(DbContextOptions<CentralDbContext> options) : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.HasDefaultSchema("batching_central");

        modelBuilder.Entity<BatchLog>(b =>
        {
            b.HasKey(x => x.Id);
            b.HasIndex(x => new { x.PlantId, x.BatchNumber }).IsUnique();
            b.HasIndex(x => x.StartTime);
            b.HasIndex(x => x.Pelanggan);
        });
    }
}
