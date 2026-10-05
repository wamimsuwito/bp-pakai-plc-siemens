using BatchingPlant.Domain.Enums;

namespace BatchingPlant.Domain.Entities;

public abstract class BaseEntity
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}

public class JobMixFormula : BaseEntity
{
    public string MutuBeton { get; set; } = string.Empty; // e.g. "K225", "K300"
    public double Pasir1Target { get; set; } // kg per m3
    public double Pasir2Target { get; set; }
    public double Batu1Target { get; set; }
    public double Batu2Target { get; set; }
    public double SemenTarget { get; set; }
    public double AirTarget { get; set; }
    public double AdditiveTarget { get; set; }
    public double TargetSlumpCm { get; set; } = 12.0;
    public int MixingTimeSec { get; set; } = 15;
    public bool IsActive { get; set; } = true;
}

public class BatchLog : BaseEntity
{
    public string BatchNumber { get; set; } = string.Empty;
    public string RecipeId { get; set; } = string.Empty;
    public string RecipeName { get; set; } = string.Empty;
    public double OrderedVolume { get; set; } // m3
    public int MixingCycles { get; set; } = 1;
    public double SlumpActual { get; set; }
    public string SiloSemenUsed { get; set; } = "Silo 1";
    
    // Customer and Dispatch Metadata
    public string Pelanggan { get; set; } = string.Empty;
    public string Lokasi { get; set; } = string.Empty;
    public string NoKendaraan { get; set; } = string.Empty;
    public string Sopir { get; set; } = string.Empty;
    public string OperatorName { get; set; } = string.Empty;
    public BatchingMode Mode { get; set; } = BatchingMode.AUTO;
    public BatchStatus Status { get; set; } = BatchStatus.COMPLETED;

    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }

    // Aggregate, Cement, Water, Additive targets (kg)
    public double TargetPasir1 { get; set; }
    public double TargetPasir2 { get; set; }
    public double TargetBatu1 { get; set; }
    public double TargetBatu2 { get; set; }
    public double TargetSemen { get; set; }
    public double TargetAir { get; set; }
    public double TargetAdditive { get; set; }

    // Actual weighed quantities (kg)
    public double ActualPasir1 { get; set; }
    public double ActualPasir2 { get; set; }
    public double ActualBatu1 { get; set; }
    public double ActualBatu2 { get; set; }
    public double ActualSemen { get; set; }
    public double ActualAir { get; set; }
    public double ActualAdditive { get; set; }

    // Moisture Correction Percentages (%)
    public double MoisturePasir1Pct { get; set; }
    public double MoisturePasir2Pct { get; set; }
    public double MoistureBatu1Pct { get; set; }
    public double MoistureBatu2Pct { get; set; }

    // Quarry source traceability
    public string QuarryPasir1 { get; set; } = string.Empty;
    public string QuarryPasir2 { get; set; } = string.Empty;
    public string QuarryBatu1 { get; set; } = string.Empty;
    public string QuarryBatu2 { get; set; } = string.Empty;

    // Plant multi-tenant / multi-plant identity
    public string PlantId { get; set; } = "PKU01";
    public string PlantName { get; set; } = "Pekanbaru";
    public string PlantCompany { get; set; } = "PT Farika Riau Perkasa";
    
    // Cloud Synchronization flag
    public bool IsSyncedToCentral { get; set; } = false;
    public DateTime? SyncedAt { get; set; }

    // Immutable JMF Snapshot link
    public string? JmfSnapshotId { get; set; }
    public BatchJmfSnapshot? JmfSnapshot { get; set; }
}

public class Material : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public MaterialType MaterialType { get; set; } = MaterialType.AGGREGATE;
    public string Unit { get; set; } = "kg";
    public bool IsActive { get; set; } = true;
}

public class Jmf : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public double TargetVolumeM3 { get; set; } = 1.0;
    public bool IsActive { get; set; } = true;
    public string? CurrentVersionId { get; set; }
    public List<JmfVersion> Versions { get; set; } = new();
}

public class JmfVersion : BaseEntity
{
    public string JmfId { get; set; } = string.Empty;
    public Jmf? Jmf { get; set; }
    public int VersionNumber { get; set; } = 1;
    public JmfStatus Status { get; set; } = JmfStatus.DRAFT;
    public double TargetSlumpCm { get; set; } = 12.0;
    public int MixingTimeSec { get; set; } = 15;
    public string Notes { get; set; } = string.Empty;
    public bool IsUsedInProduction { get; set; } = false;
    public DateTime? ActivatedAt { get; set; }
    public List<RecipeComponent> RecipeComponents { get; set; } = new();
}

public class RecipeComponent : BaseEntity
{
    public string JmfVersionId { get; set; } = string.Empty;
    public JmfVersion? JmfVersion { get; set; }
    public string MaterialId { get; set; } = string.Empty;
    public Material? Material { get; set; }
    public decimal TargetQuantity { get; set; }
    public string Unit { get; set; } = "kg";
    public int SequenceOrder { get; set; } = 1;
    public double TolerancePercentage { get; set; } = 2.0;
}

public class BatchJmfSnapshot : BaseEntity
{
    public string BatchLogId { get; set; } = string.Empty;
    public string JmfId { get; set; } = string.Empty;
    public string JmfCode { get; set; } = string.Empty;
    public string JmfName { get; set; } = string.Empty;
    public string JmfVersionId { get; set; } = string.Empty;
    public int VersionNumber { get; set; }
    public double TargetVolumeM3 { get; set; } = 1.0;
    public string ComponentsJson { get; set; } = "[]";
}

public record RecipeComponentSnapshotItem(
    string MaterialId,
    string MaterialCode,
    string MaterialName,
    MaterialType MaterialType,
    decimal TargetQuantity,
    string Unit,
    int SequenceOrder,
    double TolerancePercentage
);

public class UserAccount : BaseEntity
{
    public string Nama { get; set; } = string.Empty;
    public string Nik { get; set; } = string.Empty;
    public UserRole Jabatan { get; set; } = UserRole.OPERATOR;
    public string PasswordHash { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public class SiloInventory : BaseEntity
{
    public int SiloIndex { get; set; } // 1 to 6
    public string SiloName { get; set; } = string.Empty;
    public string MaterialType { get; set; } = "SEMEN";
    public double CurrentStockKg { get; set; }
    public double CapacityKg { get; set; } = 80000;
}

public class ScaleCalibration : BaseEntity
{
    public string ScaleType { get; set; } = string.Empty; // "AGGREGATE", "CEMENT", "WATER", "ADDITIVE"
    public double RawZeroAdc { get; set; }
    public double RawSpanAdc { get; set; }
    public double CalibratedSpanKg { get; set; }
    public double FilterAlpha { get; set; } = 0.15;
    public double ZeroDeadbandKg { get; set; } = 2.0;
}

public class AlarmLog : BaseEntity
{
    public string AlarmCode { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public AlarmSeverity Severity { get; set; } = AlarmSeverity.WARNING;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public bool IsAcknowledged { get; set; }
    public DateTime? AcknowledgedAt { get; set; }
    public string? AcknowledgedBy { get; set; }
}

public class SyncQueueItem : BaseEntity
{
    public string EntityType { get; set; } = string.Empty; // "BatchLog", "AlarmLog", "InventoryUpdate"
    public string EntityId { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = string.Empty;
    public int RetryCount { get; set; } = 0;
    public string? LastError { get; set; }
    public bool IsProcessed { get; set; } = false;
    public DateTime? ProcessedAt { get; set; }
}
