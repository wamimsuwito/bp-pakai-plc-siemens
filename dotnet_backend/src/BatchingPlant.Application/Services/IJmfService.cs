using BatchingPlant.Application.DTOs;
using BatchingPlant.Domain.Entities;

namespace BatchingPlant.Application.Services;

public interface IJmfService
{
    // Material
    Task<IEnumerable<MaterialDto>> GetMaterialsAsync(bool? activeOnly = null, CancellationToken ct = default);
    Task<MaterialDto?> GetMaterialByIdAsync(string id, CancellationToken ct = default);
    Task<MaterialDto> CreateMaterialAsync(CreateMaterialRequest request, string username = "OPERATOR", CancellationToken ct = default);
    Task<MaterialDto> UpdateMaterialAsync(string id, UpdateMaterialRequest request, string username = "OPERATOR", CancellationToken ct = default);

    // JMF
    Task<IEnumerable<JmfDto>> GetAllJmfsAsync(bool? activeOnly = null, CancellationToken ct = default);
    Task<JmfDto?> GetJmfByIdAsync(string id, CancellationToken ct = default);
    Task<JmfDto?> GetJmfByCodeAsync(string code, CancellationToken ct = default);
    Task<JmfDto> CreateJmfAsync(CreateJmfRequest request, string username = "OPERATOR", CancellationToken ct = default);
    Task<JmfDto> UpdateJmfAsync(string id, UpdateJmfRequest request, string username = "OPERATOR", CancellationToken ct = default);

    // JMF Versions
    Task<IEnumerable<JmfVersionDto>> GetVersionsAsync(string jmfId, CancellationToken ct = default);
    Task<JmfVersionDto?> GetVersionByIdAsync(string jmfId, string versionId, CancellationToken ct = default);
    Task<JmfVersionDto> CreateVersionAsync(string jmfId, CreateJmfVersionRequest request, string username = "OPERATOR", CancellationToken ct = default);
    Task<JmfVersionDto> UpdateVersionAsync(string jmfId, string versionId, UpdateJmfVersionRequest request, string username = "OPERATOR", CancellationToken ct = default);
    Task<JmfVersionDto> ActivateVersionAsync(string jmfId, string versionId, string username = "OPERATOR", CancellationToken ct = default);
    Task<JmfVersionDto> DeactivateVersionAsync(string jmfId, string versionId, string username = "OPERATOR", CancellationToken ct = default);

    // Immutable Snapshot
    Task<BatchJmfSnapshot> CreateBatchSnapshotAsync(string batchLogId, string jmfIdOrCode, double targetVolumeM3, CancellationToken ct = default);
    Task<BatchJmfSnapshotDto?> GetSnapshotByBatchLogIdAsync(string batchLogId, CancellationToken ct = default);
}
