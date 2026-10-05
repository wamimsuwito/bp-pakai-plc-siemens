using System.Text.Json;
using BatchingPlant.Application.DTOs;
using BatchingPlant.Application.Services;
using BatchingPlant.Domain.Entities;
using BatchingPlant.Domain.Enums;
using BatchingPlant.Domain.Interfaces;
using BatchingPlant.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BatchingPlant.Infrastructure.Services;

public class JmfService : IJmfService
{
    private readonly LocalDbContext _context;
    private readonly IAuditRepository _audit;

    public JmfService(LocalDbContext context, IAuditRepository audit)
    {
        _context = context;
        _audit = audit;
    }

    #region Material Management

    public async Task<IEnumerable<MaterialDto>> GetMaterialsAsync(bool? activeOnly = null, CancellationToken ct = default)
    {
        var query = _context.Materials.AsNoTracking();
        if (activeOnly.HasValue)
        {
            query = query.Where(m => m.IsActive == activeOnly.Value);
        }

        var list = await query.OrderBy(m => m.MaterialType).ThenBy(m => m.Name).ToListAsync(ct);
        return list.Select(MapToMaterialDto);
    }

    public async Task<MaterialDto?> GetMaterialByIdAsync(string id, CancellationToken ct = default)
    {
        var mat = await _context.Materials.AsNoTracking().FirstOrDefaultAsync(m => m.Id == id, ct);
        return mat != null ? MapToMaterialDto(mat) : null;
    }

    public async Task<MaterialDto> CreateMaterialAsync(CreateMaterialRequest request, string username = "OPERATOR", CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Code))
            throw new ArgumentException("VALIDATION_ERROR: Material Code wajib diisi.");
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("VALIDATION_ERROR: Material Name wajib diisi.");
        if (string.IsNullOrWhiteSpace(request.Unit))
            throw new ArgumentException("VALIDATION_ERROR: Material Unit wajib diisi.");

        var trimmedCode = request.Code.Trim().ToUpper();
        var exists = await _context.Materials.AnyAsync(m => m.Code == trimmedCode, ct);
        if (exists)
            throw new InvalidOperationException($"DUPLICATE_CODE: Material dengan kode '{trimmedCode}' sudah ada.");

        var material = new Material
        {
            Id = Guid.NewGuid().ToString(),
            Code = trimmedCode,
            Name = request.Name.Trim(),
            MaterialType = request.MaterialType,
            Unit = request.Unit.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        await _context.Materials.AddAsync(material, ct);
        await _context.SaveChangesAsync(ct);

        await _audit.LogAsync("MATERIAL_CREATED", $"Material {material.Code} ({material.Name}) created.", username, material.Id);

        return MapToMaterialDto(material);
    }

    public async Task<MaterialDto> UpdateMaterialAsync(string id, UpdateMaterialRequest request, string username = "OPERATOR", CancellationToken ct = default)
    {
        var material = await _context.Materials.FirstOrDefaultAsync(m => m.Id == id, ct);
        if (material == null)
            throw new KeyNotFoundException($"NOT_FOUND: Material with ID '{id}' tidak ditemukan.");

        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("VALIDATION_ERROR: Material Name wajib diisi.");
        if (string.IsNullOrWhiteSpace(request.Unit))
            throw new ArgumentException("VALIDATION_ERROR: Material Unit wajib diisi.");

        material.Name = request.Name.Trim();
        material.MaterialType = request.MaterialType;
        material.Unit = request.Unit.Trim();
        material.IsActive = request.IsActive;
        material.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);
        await _audit.LogAsync("MATERIAL_UPDATED", $"Material {material.Code} updated. Active={material.IsActive}", username, material.Id);

        return MapToMaterialDto(material);
    }

    #endregion

    #region JMF Management

    public async Task<IEnumerable<JmfDto>> GetAllJmfsAsync(bool? activeOnly = null, CancellationToken ct = default)
    {
        var query = _context.Jmfs
            .Include(j => j.Versions)
                .ThenInclude(v => v.RecipeComponents)
                    .ThenInclude(c => c.Material)
            .AsNoTracking();

        if (activeOnly.HasValue)
        {
            query = query.Where(j => j.IsActive == activeOnly.Value);
        }

        var list = await query.OrderBy(j => j.Code).ToListAsync(ct);
        return list.Select(MapToJmfDto);
    }

    public async Task<JmfDto?> GetJmfByIdAsync(string id, CancellationToken ct = default)
    {
        var jmf = await _context.Jmfs
            .Include(j => j.Versions)
                .ThenInclude(v => v.RecipeComponents)
                    .ThenInclude(c => c.Material)
            .AsNoTracking()
            .FirstOrDefaultAsync(j => j.Id == id, ct);

        return jmf != null ? MapToJmfDto(jmf) : null;
    }

    public async Task<JmfDto?> GetJmfByCodeAsync(string code, CancellationToken ct = default)
    {
        var trimmed = code.Trim().ToUpper();
        var jmf = await _context.Jmfs
            .Include(j => j.Versions)
                .ThenInclude(v => v.RecipeComponents)
                    .ThenInclude(c => c.Material)
            .AsNoTracking()
            .FirstOrDefaultAsync(j => j.Code.ToUpper() == trimmed, ct);

        return jmf != null ? MapToJmfDto(jmf) : null;
    }

    public async Task<JmfDto> CreateJmfAsync(CreateJmfRequest request, string username = "OPERATOR", CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Code))
            throw new ArgumentException("VALIDATION_ERROR: JMF Code wajib diisi.");
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("VALIDATION_ERROR: JMF Name wajib diisi.");
        if (request.TargetVolumeM3 <= 0)
            throw new ArgumentException("VALIDATION_ERROR: TargetVolumeM3 harus lebih besar dari 0.");

        var trimmedCode = request.Code.Trim().ToUpper();
        var exists = await _context.Jmfs.AnyAsync(j => j.Code == trimmedCode, ct);
        if (exists)
            throw new InvalidOperationException($"DUPLICATE_CODE: JMF dengan kode '{trimmedCode}' sudah ada.");

        var jmfId = Guid.NewGuid().ToString();
        var jmf = new Jmf
        {
            Id = jmfId,
            Code = trimmedCode,
            Name = request.Name.Trim(),
            Description = request.Description.Trim(),
            TargetVolumeM3 = request.TargetVolumeM3,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        // Create initial Version 1
        var versionId = Guid.NewGuid().ToString();
        var version = new JmfVersion
        {
            Id = versionId,
            JmfId = jmfId,
            VersionNumber = 1,
            Status = JmfStatus.DRAFT,
            TargetSlumpCm = request.TargetSlumpCm,
            MixingTimeSec = request.MixingTimeSec,
            Notes = "Versi awal",
            CreatedAt = DateTime.UtcNow
        };

        if (request.InitialComponents != null && request.InitialComponents.Count > 0)
        {
            await ValidateAndAttachComponentsAsync(version, request.InitialComponents, ct);
        }

        jmf.Versions.Add(version);

        await _context.Jmfs.AddAsync(jmf, ct);
        await _context.SaveChangesAsync(ct);

        await _audit.LogAsync("JMF_CREATED", $"JMF {jmf.Code} ({jmf.Name}) created with Version 1.", username, jmf.Id);

        return MapToJmfDto(jmf);
    }

    public async Task<JmfDto> UpdateJmfAsync(string id, UpdateJmfRequest request, string username = "OPERATOR", CancellationToken ct = default)
    {
        var jmf = await _context.Jmfs
            .Include(j => j.Versions)
                .ThenInclude(v => v.RecipeComponents)
                    .ThenInclude(c => c.Material)
            .FirstOrDefaultAsync(j => j.Id == id, ct);

        if (jmf == null)
            throw new KeyNotFoundException($"NOT_FOUND: JMF dengan ID '{id}' tidak ditemukan.");

        if (string.IsNullOrWhiteSpace(request.Name))
            throw new ArgumentException("VALIDATION_ERROR: JMF Name wajib diisi.");
        if (request.TargetVolumeM3 <= 0)
            throw new ArgumentException("VALIDATION_ERROR: TargetVolumeM3 harus lebih besar dari 0.");

        jmf.Name = request.Name.Trim();
        jmf.Description = request.Description?.Trim() ?? "";
        jmf.TargetVolumeM3 = request.TargetVolumeM3;
        jmf.IsActive = request.IsActive;
        jmf.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);
        await _audit.LogAsync("JMF_UPDATED", $"JMF {jmf.Code} updated. Active={jmf.IsActive}", username, jmf.Id);

        return MapToJmfDto(jmf);
    }

    #endregion

    #region JMF Version Management

    public async Task<IEnumerable<JmfVersionDto>> GetVersionsAsync(string jmfId, CancellationToken ct = default)
    {
        var versions = await _context.JmfVersions
            .Include(v => v.RecipeComponents)
                .ThenInclude(c => c.Material)
            .AsNoTracking()
            .Where(v => v.JmfId == jmfId)
            .OrderByDescending(v => v.VersionNumber)
            .ToListAsync(ct);

        return versions.Select(MapToJmfVersionDto);
    }

    public async Task<JmfVersionDto?> GetVersionByIdAsync(string jmfId, string versionId, CancellationToken ct = default)
    {
        var version = await _context.JmfVersions
            .Include(v => v.RecipeComponents)
                .ThenInclude(c => c.Material)
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.JmfId == jmfId && v.Id == versionId, ct);

        return version != null ? MapToJmfVersionDto(version) : null;
    }

    public async Task<JmfVersionDto> CreateVersionAsync(string jmfId, CreateJmfVersionRequest request, string username = "OPERATOR", CancellationToken ct = default)
    {
        var jmf = await _context.Jmfs.FirstOrDefaultAsync(j => j.Id == jmfId, ct);
        if (jmf == null)
            throw new KeyNotFoundException($"NOT_FOUND: JMF dengan ID '{jmfId}' tidak ditemukan.");

        var existingVersions = await _context.JmfVersions
            .Where(v => v.JmfId == jmfId)
            .Select(v => v.VersionNumber)
            .ToListAsync(ct);

        int nextVersionNumber = existingVersions.Count > 0 ? existingVersions.Max() + 1 : 1;

        var version = new JmfVersion
        {
            Id = Guid.NewGuid().ToString(),
            JmfId = jmfId,
            VersionNumber = nextVersionNumber,
            Status = JmfStatus.DRAFT,
            TargetSlumpCm = request.TargetSlumpCm,
            MixingTimeSec = request.MixingTimeSec,
            Notes = request.Notes?.Trim() ?? "",
            CreatedAt = DateTime.UtcNow
        };

        if (request.Components != null && request.Components.Count > 0)
        {
            await ValidateAndAttachComponentsAsync(version, request.Components, ct);
        }

        await _context.JmfVersions.AddAsync(version, ct);
        await _context.SaveChangesAsync(ct);

        await _audit.LogAsync("JMF_VERSION_CREATED", $"JMF {jmf.Code} Version {version.VersionNumber} created as DRAFT.", username, version.Id);

        return (await GetVersionByIdAsync(jmfId, version.Id, ct))!;
    }

    public async Task<JmfVersionDto> UpdateVersionAsync(string jmfId, string versionId, UpdateJmfVersionRequest request, string username = "OPERATOR", CancellationToken ct = default)
    {
        var version = await _context.JmfVersions
            .Include(v => v.RecipeComponents)
            .FirstOrDefaultAsync(v => v.JmfId == jmfId && v.Id == versionId, ct);

        if (version == null)
            throw new KeyNotFoundException($"NOT_FOUND: JMF Version dengan ID '{versionId}' tidak ditemukan.");

        // IMMUTABILITY RULE: Cannot destructively edit a version that has already been used in production batch!
        if (version.IsUsedInProduction)
        {
            throw new InvalidOperationException("IMMUTABLE_VERSION: Version ini sudah digunakan dalam batch produksi dan tidak boleh diubah. Buat version baru untuk resep yang direvisi.");
        }

        version.TargetSlumpCm = request.TargetSlumpCm;
        version.MixingTimeSec = request.MixingTimeSec;
        version.Notes = request.Notes?.Trim() ?? "";
        version.UpdatedAt = DateTime.UtcNow;

        if (request.Components != null)
        {
            _context.RecipeComponents.RemoveRange(version.RecipeComponents);
            version.RecipeComponents.Clear();
            await ValidateAndAttachComponentsAsync(version, request.Components, ct);
        }

        await _context.SaveChangesAsync(ct);
        await _audit.LogAsync("JMF_VERSION_UPDATED", $"JMF Version {version.VersionNumber} updated.", username, version.Id);

        return (await GetVersionByIdAsync(jmfId, version.Id, ct))!;
    }

    public async Task<JmfVersionDto> ActivateVersionAsync(string jmfId, string versionId, string username = "OPERATOR", CancellationToken ct = default)
    {
        var jmf = await _context.Jmfs
            .Include(j => j.Versions)
                .ThenInclude(v => v.RecipeComponents)
                    .ThenInclude(c => c.Material)
            .FirstOrDefaultAsync(j => j.Id == jmfId, ct);

        if (jmf == null)
            throw new KeyNotFoundException($"NOT_FOUND: JMF dengan ID '{jmfId}' tidak ditemukan.");

        // Rule: Inactive JMF cannot activate production version
        if (!jmf.IsActive)
        {
            throw new InvalidOperationException("INACTIVE_JMF: JMF induk sedang nonaktif. Aktifkan JMF terlebih dahulu sebelum mengaktifkan version.");
        }

        var targetVersion = jmf.Versions.FirstOrDefault(v => v.Id == versionId);
        if (targetVersion == null)
            throw new KeyNotFoundException($"NOT_FOUND: Version dengan ID '{versionId}' tidak ditemukan pada JMF '{jmf.Code}'.");

        // Validation: Version must have valid components before activation
        if (targetVersion.RecipeComponents == null || targetVersion.RecipeComponents.Count == 0)
        {
            throw new InvalidOperationException("EMPTY_COMPONENTS: Recipe Version harus memiliki minimal satu komponen material sebelum dapat diaktifkan.");
        }

        // Validation: Materials must all be active
        foreach (var comp in targetVersion.RecipeComponents)
        {
            var mat = comp.Material ?? await _context.Materials.FindAsync(new object[] { comp.MaterialId }, ct);
            if (mat == null || !mat.IsActive)
            {
                throw new InvalidOperationException($"INACTIVE_MATERIAL: Komponen '{mat?.Name ?? comp.MaterialId}' dalam status nonaktif. Semua material harus aktif.");
            }
        }

        // Atomic Transaction: Deactivate previous current version, activate target version
        foreach (var v in jmf.Versions)
        {
            if (v.Status == JmfStatus.ACTIVE)
            {
                v.Status = JmfStatus.INACTIVE;
                v.UpdatedAt = DateTime.UtcNow;
            }
        }

        targetVersion.Status = JmfStatus.ACTIVE;
        targetVersion.ActivatedAt = DateTime.UtcNow;
        targetVersion.UpdatedAt = DateTime.UtcNow;
        jmf.CurrentVersionId = targetVersion.Id;
        jmf.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);

        await _audit.LogAsync("JMF_VERSION_ACTIVATED", $"JMF {jmf.Code} Version {targetVersion.VersionNumber} activated for production.", username, targetVersion.Id);

        return MapToJmfVersionDto(targetVersion);
    }

    public async Task<JmfVersionDto> DeactivateVersionAsync(string jmfId, string versionId, string username = "OPERATOR", CancellationToken ct = default)
    {
        var jmf = await _context.Jmfs
            .Include(j => j.Versions)
                .ThenInclude(v => v.RecipeComponents)
                    .ThenInclude(c => c.Material)
            .FirstOrDefaultAsync(j => j.Id == jmfId, ct);

        if (jmf == null)
            throw new KeyNotFoundException($"NOT_FOUND: JMF dengan ID '{jmfId}' tidak ditemukan.");

        var targetVersion = jmf.Versions.FirstOrDefault(v => v.Id == versionId);
        if (targetVersion == null)
            throw new KeyNotFoundException($"NOT_FOUND: Version dengan ID '{versionId}' tidak ditemukan.");

        targetVersion.Status = JmfStatus.INACTIVE;
        targetVersion.UpdatedAt = DateTime.UtcNow;

        if (jmf.CurrentVersionId == targetVersion.Id)
        {
            jmf.CurrentVersionId = null;
            jmf.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(ct);

        await _audit.LogAsync("JMF_VERSION_DEACTIVATED", $"JMF {jmf.Code} Version {targetVersion.VersionNumber} deactivated.", username, targetVersion.Id);

        return MapToJmfVersionDto(targetVersion);
    }

    #endregion

    #region Immutable Batch Snapshot

    public async Task<BatchJmfSnapshot> CreateBatchSnapshotAsync(string batchLogId, string jmfIdOrCode, double targetVolumeM3, CancellationToken ct = default)
    {
        var jmf = await _context.Jmfs
            .Include(j => j.Versions)
                .ThenInclude(v => v.RecipeComponents)
                    .ThenInclude(c => c.Material)
            .FirstOrDefaultAsync(j => j.Id == jmfIdOrCode || j.Code.ToUpper() == jmfIdOrCode.Trim().ToUpper(), ct);

        if (jmf == null)
        {
            // Fallback for legacy JobMixFormula
            var legacy = await _context.JobMixFormulas.FirstOrDefaultAsync(r => r.Id == jmfIdOrCode || r.MutuBeton.ToUpper() == jmfIdOrCode.Trim().ToUpper(), ct);
            if (legacy != null)
            {
                return await CreateLegacySnapshotAsync(batchLogId, legacy, targetVolumeM3, ct);
            }
            throw new InvalidOperationException($"JMF_NOT_FOUND: JMF '{jmfIdOrCode}' tidak ditemukan di database.");
        }

        if (!jmf.IsActive)
        {
            throw new InvalidOperationException($"INACTIVE_JMF: JMF '{jmf.Code}' sedang nonaktif dan tidak dapat digunakan untuk produksi.");
        }

        // Find active version
        var activeVersion = jmf.Versions.FirstOrDefault(v => v.Id == jmf.CurrentVersionId) 
            ?? jmf.Versions.FirstOrDefault(v => v.Status == JmfStatus.ACTIVE)
            ?? jmf.Versions.OrderByDescending(v => v.VersionNumber).FirstOrDefault();

        if (activeVersion == null || activeVersion.RecipeComponents.Count == 0)
        {
            throw new InvalidOperationException($"NO_ACTIVE_VERSION: JMF '{jmf.Code}' tidak memiliki versi aktif dengan komponen material yang valid.");
        }

        // Lock version from destructive modification
        activeVersion.IsUsedInProduction = true;

        var snapshotComponents = activeVersion.RecipeComponents
            .OrderBy(c => c.SequenceOrder)
            .Select(c => new RecipeComponentSnapshotItem(
                c.MaterialId,
                c.Material?.Code ?? "",
                c.Material?.Name ?? "",
                c.Material?.MaterialType ?? MaterialType.AGGREGATE,
                c.TargetQuantity,
                c.Unit,
                c.SequenceOrder,
                c.TolerancePercentage
            ))
            .ToList();

        var snapshot = new BatchJmfSnapshot
        {
            Id = Guid.NewGuid().ToString(),
            BatchLogId = batchLogId,
            JmfId = jmf.Id,
            JmfCode = jmf.Code,
            JmfName = jmf.Name,
            JmfVersionId = activeVersion.Id,
            VersionNumber = activeVersion.VersionNumber,
            TargetVolumeM3 = targetVolumeM3,
            ComponentsJson = JsonSerializer.Serialize(snapshotComponents),
            CreatedAt = DateTime.UtcNow
        };

        await _context.BatchJmfSnapshots.AddAsync(snapshot, ct);
        await _context.SaveChangesAsync(ct);

        return snapshot;
    }

    private async Task<BatchJmfSnapshot> CreateLegacySnapshotAsync(string batchLogId, JobMixFormula legacy, double targetVolumeM3, CancellationToken ct)
    {
        var components = new List<RecipeComponentSnapshotItem>
        {
            new("MAT-PASIR-1", "PASIR-1", "Pasir 1", MaterialType.AGGREGATE, (decimal)legacy.Pasir1Target, "kg", 1, 2.0),
            new("MAT-PASIR-2", "PASIR-2", "Pasir 2", MaterialType.AGGREGATE, (decimal)legacy.Pasir2Target, "kg", 2, 2.0),
            new("MAT-BATU-1", "BATU-1", "Batu 1", MaterialType.AGGREGATE, (decimal)legacy.Batu1Target, "kg", 3, 2.0),
            new("MAT-BATU-2", "BATU-2", "Batu 2", MaterialType.AGGREGATE, (decimal)legacy.Batu2Target, "kg", 4, 2.0),
            new("MAT-SEMEN", "SEMEN", "Semen OPC", MaterialType.CEMENT, (decimal)legacy.SemenTarget, "kg", 5, 1.0),
            new("MAT-AIR", "AIR", "Air Bersih Batching", MaterialType.WATER, (decimal)legacy.AirTarget, "kg", 6, 1.5),
            new("MAT-ADMIX", "ADMIX", "Admixture", MaterialType.ADMIXTURE, (decimal)legacy.AdditiveTarget, "liter", 7, 3.0)
        };

        var snapshot = new BatchJmfSnapshot
        {
            Id = Guid.NewGuid().ToString(),
            BatchLogId = batchLogId,
            JmfId = legacy.Id,
            JmfCode = legacy.MutuBeton,
            JmfName = legacy.MutuBeton,
            JmfVersionId = "LEGACY-V1",
            VersionNumber = 1,
            TargetVolumeM3 = targetVolumeM3,
            ComponentsJson = JsonSerializer.Serialize(components),
            CreatedAt = DateTime.UtcNow
        };

        await _context.BatchJmfSnapshots.AddAsync(snapshot, ct);
        await _context.SaveChangesAsync(ct);
        return snapshot;
    }

    public async Task<BatchJmfSnapshotDto?> GetSnapshotByBatchLogIdAsync(string batchLogId, CancellationToken ct = default)
    {
        var snapshot = await _context.BatchJmfSnapshots
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.BatchLogId == batchLogId, ct);

        if (snapshot == null) return null;

        var components = JsonSerializer.Deserialize<List<RecipeComponentSnapshotItem>>(snapshot.ComponentsJson) ?? new();

        return new BatchJmfSnapshotDto(
            snapshot.Id,
            snapshot.BatchLogId,
            snapshot.JmfId,
            snapshot.JmfCode,
            snapshot.JmfName,
            snapshot.JmfVersionId,
            snapshot.VersionNumber,
            snapshot.TargetVolumeM3,
            components,
            snapshot.CreatedAt
        );
    }

    #endregion

    #region Helper Methods

    private async Task ValidateAndAttachComponentsAsync(JmfVersion version, List<CreateRecipeComponentItem> items, CancellationToken ct)
    {
        var seenMaterials = new HashSet<string>();

        foreach (var item in items)
        {
            if (string.IsNullOrWhiteSpace(item.MaterialId))
                throw new ArgumentException("VALIDATION_ERROR: MaterialId wajib diisi.");

            if (item.TargetQuantity < 0)
                throw new ArgumentException($"VALIDATION_ERROR: TargetQuantity untuk material '{item.MaterialId}' tidak boleh negatif.");

            if (seenMaterials.Contains(item.MaterialId))
                throw new InvalidOperationException($"DUPLICATE_COMPONENT: Material '{item.MaterialId}' terdaftar ganda dalam recipe version.");

            seenMaterials.Add(item.MaterialId);

            var material = await _context.Materials.FindAsync(new object[] { item.MaterialId }, ct);
            if (material == null)
            {
                material = await _context.Materials.FirstOrDefaultAsync(m => m.Code == item.MaterialId.ToUpper(), ct);
                if (material == null)
                    throw new KeyNotFoundException($"NOT_FOUND: Material dengan ID atau Kode '{item.MaterialId}' tidak ditemukan.");
            }

            var comp = new RecipeComponent
            {
                Id = Guid.NewGuid().ToString(),
                JmfVersionId = version.Id,
                MaterialId = material.Id,
                Material = material,
                TargetQuantity = item.TargetQuantity,
                Unit = string.IsNullOrWhiteSpace(item.Unit) ? material.Unit : item.Unit.Trim(),
                SequenceOrder = item.SequenceOrder > 0 ? item.SequenceOrder : 1,
                TolerancePercentage = item.TolerancePercentage >= 0 ? item.TolerancePercentage : 2.0
            };

            version.RecipeComponents.Add(comp);
        }
    }

    private static MaterialDto MapToMaterialDto(Material m) =>
        new(m.Id, m.Code, m.Name, m.MaterialType, m.Unit, m.IsActive, m.CreatedAt, m.UpdatedAt);

    private static RecipeComponentDto MapToRecipeComponentDto(RecipeComponent c) =>
        new(
            c.Id,
            c.MaterialId,
            c.Material?.Code ?? "",
            c.Material?.Name ?? "",
            c.Material?.MaterialType ?? MaterialType.AGGREGATE,
            c.TargetQuantity,
            c.Unit,
            c.SequenceOrder,
            c.TolerancePercentage
        );

    private static JmfVersionDto MapToJmfVersionDto(JmfVersion v) =>
        new(
            v.Id,
            v.JmfId,
            v.VersionNumber,
            v.Status,
            v.TargetSlumpCm,
            v.MixingTimeSec,
            v.Notes,
            v.IsUsedInProduction,
            v.ActivatedAt,
            v.CreatedAt,
            v.UpdatedAt,
            v.RecipeComponents?.OrderBy(c => c.SequenceOrder).Select(MapToRecipeComponentDto).ToList() ?? new()
        );

    private static JmfDto MapToJmfDto(Jmf j)
    {
        var currentVersion = j.Versions.FirstOrDefault(v => v.Id == j.CurrentVersionId)
            ?? j.Versions.FirstOrDefault(v => v.Status == JmfStatus.ACTIVE);

        return new JmfDto(
            j.Id,
            j.Code,
            j.Name,
            j.Description,
            j.TargetVolumeM3,
            j.IsActive,
            j.CurrentVersionId,
            currentVersion != null ? MapToJmfVersionDto(currentVersion) : null,
            j.Versions.Count,
            j.CreatedAt,
            j.UpdatedAt
        );
    }

    #endregion
}
