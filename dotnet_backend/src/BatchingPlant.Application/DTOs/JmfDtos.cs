using BatchingPlant.Domain.Entities;
using BatchingPlant.Domain.Enums;

namespace BatchingPlant.Application.DTOs;

public record MaterialDto(
    string Id,
    string Code,
    string Name,
    MaterialType MaterialType,
    string Unit,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record CreateMaterialRequest(
    string Code,
    string Name,
    MaterialType MaterialType,
    string Unit = "kg"
);

public record UpdateMaterialRequest(
    string Name,
    MaterialType MaterialType,
    string Unit,
    bool IsActive
);

public record RecipeComponentDto(
    string Id,
    string MaterialId,
    string MaterialCode,
    string MaterialName,
    MaterialType MaterialType,
    decimal TargetQuantity,
    string Unit,
    int SequenceOrder,
    double TolerancePercentage
);

public record CreateRecipeComponentItem(
    string MaterialId,
    decimal TargetQuantity,
    string Unit = "kg",
    int SequenceOrder = 1,
    double TolerancePercentage = 2.0
);

public record JmfVersionDto(
    string Id,
    string JmfId,
    int VersionNumber,
    JmfStatus Status,
    double TargetSlumpCm,
    int MixingTimeSec,
    string Notes,
    bool IsUsedInProduction,
    DateTime? ActivatedAt,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    List<RecipeComponentDto> Components
);

public record CreateJmfVersionRequest(
    double TargetSlumpCm = 12.0,
    int MixingTimeSec = 15,
    string Notes = "",
    List<CreateRecipeComponentItem>? Components = null
);

public record UpdateJmfVersionRequest(
    double TargetSlumpCm,
    int MixingTimeSec,
    string Notes,
    List<CreateRecipeComponentItem>? Components
);

public record JmfDto(
    string Id,
    string Code,
    string Name,
    string Description,
    double TargetVolumeM3,
    bool IsActive,
    string? CurrentVersionId,
    JmfVersionDto? CurrentVersion,
    int VersionsCount,
    DateTime CreatedAt,
    DateTime? UpdatedAt
);

public record CreateJmfRequest(
    string Code,
    string Name,
    string Description = "",
    double TargetVolumeM3 = 1.0,
    List<CreateRecipeComponentItem>? InitialComponents = null,
    double TargetSlumpCm = 12.0,
    int MixingTimeSec = 15
);

public record UpdateJmfRequest(
    string Name,
    string Description,
    double TargetVolumeM3,
    bool IsActive
);

public record BatchJmfSnapshotDto(
    string Id,
    string BatchLogId,
    string JmfId,
    string JmfCode,
    string JmfName,
    string JmfVersionId,
    int VersionNumber,
    double TargetVolumeM3,
    List<RecipeComponentSnapshotItem> Components,
    DateTime CreatedAt
);
