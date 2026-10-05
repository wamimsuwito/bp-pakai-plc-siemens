using BatchingPlant.Application.DTOs;
using BatchingPlant.Domain.Entities;
using BatchingPlant.Domain.Enums;
using BatchingPlant.Domain.Interfaces;
using BatchingPlant.Infrastructure.Persistence;
using BatchingPlant.Infrastructure.Persistence.Repositories;
using BatchingPlant.Infrastructure.Services;
using BatchingPlant.WebApi.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace BatchingPlant.Tests;

public class Phase21JmfFoundationTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly LocalDbContext _context;
    private readonly IAuditRepository _audit;
    private readonly JmfService _jmfService;

    public Phase21JmfFoundationTests()
    {
        // Setup in-memory SQLite connection for isolated, genuine database testing
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<LocalDbContext>()
            .UseSqlite(_connection)
            .Options;

        _context = new LocalDbContext(options);
        _context.Database.EnsureCreated();

        _audit = new AuditRepository(_context);
        _jmfService = new JmfService(_context, _audit);

        // Seed basic materials
        _context.Materials.AddRange(
            new Material { Id = "MAT-P1", Code = "PASIR-1", Name = "Pasir 1", MaterialType = MaterialType.AGGREGATE, Unit = "kg", IsActive = true },
            new Material { Id = "MAT-P2", Code = "PASIR-2", Name = "Pasir 2", MaterialType = MaterialType.AGGREGATE, Unit = "kg", IsActive = true },
            new Material { Id = "MAT-B1", Code = "BATU-1", Name = "Split 1-2", MaterialType = MaterialType.AGGREGATE, Unit = "kg", IsActive = true },
            new Material { Id = "MAT-SEM", Code = "SEMEN", Name = "Semen OPC", MaterialType = MaterialType.CEMENT, Unit = "kg", IsActive = true },
            new Material { Id = "MAT-AIR", Code = "AIR", Name = "Air", MaterialType = MaterialType.WATER, Unit = "kg", IsActive = true },
            new Material { Id = "MAT-INACTIVE", Code = "INACTIVE-MAT", Name = "Material Nonaktif", MaterialType = MaterialType.ADMIXTURE, Unit = "kg", IsActive = false }
        );
        _context.SaveChanges();
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Close();
        _connection.Dispose();
    }

    #region A. Material Tests

    [Fact]
    public async Task CreateMaterial_WithValidData_Succeeds()
    {
        var req = new CreateMaterialRequest("MAT-ADMIX-NEW", "Admixture Baru", MaterialType.ADMIXTURE, "liter");
        var res = await _jmfService.CreateMaterialAsync(req, "ADMIN");

        Assert.NotNull(res);
        Assert.Equal("MAT-ADMIX-NEW", res.Code);
        Assert.True(res.IsActive);

        var saved = await _context.Materials.FirstOrDefaultAsync(m => m.Code == "MAT-ADMIX-NEW");
        Assert.NotNull(saved);
    }

    [Fact]
    public async Task CreateMaterial_WithMissingFields_ThrowsValidationException()
    {
        var reqEmptyCode = new CreateMaterialRequest("", "Name", MaterialType.AGGREGATE, "kg");
        await Assert.ThrowsAsync<ArgumentException>(() => _jmfService.CreateMaterialAsync(reqEmptyCode));

        var reqEmptyName = new CreateMaterialRequest("CODE", "", MaterialType.AGGREGATE, "kg");
        await Assert.ThrowsAsync<ArgumentException>(() => _jmfService.CreateMaterialAsync(reqEmptyName));
    }

    [Fact]
    public async Task CreateMaterial_DuplicateCode_ThrowsException()
    {
        var req = new CreateMaterialRequest("PASIR-1", "Duplicate Pasir", MaterialType.AGGREGATE, "kg");
        await Assert.ThrowsAsync<InvalidOperationException>(() => _jmfService.CreateMaterialAsync(req));
    }

    #endregion

    #region B. JMF Creation Tests

    [Fact]
    public async Task CreateJmf_WithValidData_CreatesJmfAndInitialVersion()
    {
        var req = new CreateJmfRequest(
            Code: "K350",
            Name: "Mutu Beton K-350",
            Description: "Untuk balok jembatan",
            TargetVolumeM3: 1.0,
            InitialComponents: new List<CreateRecipeComponentItem>
            {
                new("MAT-P1", 600m, "kg", 1, 2.0),
                new("MAT-B1", 700m, "kg", 2, 2.0),
                new("MAT-SEM", 420m, "kg", 3, 1.0),
                new("MAT-AIR", 170m, "kg", 4, 1.5)
            }
        );

        var jmf = await _jmfService.CreateJmfAsync(req, "SUPERVISOR");

        Assert.NotNull(jmf);
        Assert.Equal("K350", jmf.Code);
        Assert.Equal(1, jmf.VersionsCount);

        var versions = (await _jmfService.GetVersionsAsync(jmf.Id)).ToList();
        Assert.Single(versions);
        Assert.Equal(1, versions[0].VersionNumber);
        Assert.Equal(JmfStatus.DRAFT, versions[0].Status);
        Assert.Equal(4, versions[0].Components.Count);
    }

    [Fact]
    public async Task CreateJmf_WithMissingCodeOrName_ThrowsException()
    {
        var missingCode = new CreateJmfRequest("", "Name", "Desc", 1.0);
        await Assert.ThrowsAsync<ArgumentException>(() => _jmfService.CreateJmfAsync(missingCode));

        var missingName = new CreateJmfRequest("K400", "", "Desc", 1.0);
        await Assert.ThrowsAsync<ArgumentException>(() => _jmfService.CreateJmfAsync(missingName));

        var invalidVolume = new CreateJmfRequest("K400", "K400", "Desc", 0.0);
        await Assert.ThrowsAsync<ArgumentException>(() => _jmfService.CreateJmfAsync(invalidVolume));
    }

    #endregion

    #region C. JMF Versioning & Component Validation

    [Fact]
    public async Task CreateVersion_IncrementsVersionNumberAutomatically()
    {
        var jmf = await _jmfService.CreateJmfAsync(new CreateJmfRequest("K225", "Beton K225"));

        var v2 = await _jmfService.CreateVersionAsync(jmf.Id, new CreateJmfVersionRequest(
            TargetSlumpCm: 14.0,
            MixingTimeSec: 20,
            Notes: "Revisi slump musim hujan",
            Components: new List<CreateRecipeComponentItem>
            {
                new("MAT-P1", 520m, "kg", 1, 2.0),
                new("MAT-SEM", 320m, "kg", 2, 1.0)
            }
        ));

        Assert.Equal(2, v2.VersionNumber);
        Assert.Equal(JmfStatus.DRAFT, v2.Status);
        Assert.Equal(2, v2.Components.Count);
    }

    [Fact]
    public async Task CreateVersion_WithNegativeQuantity_ThrowsException()
    {
        var jmf = await _jmfService.CreateJmfAsync(new CreateJmfRequest("K250", "Beton K250"));

        var invalidReq = new CreateJmfVersionRequest(
            Components: new List<CreateRecipeComponentItem>
            {
                new("MAT-P1", -50m, "kg") // Negative quantity!
            }
        );

        await Assert.ThrowsAsync<ArgumentException>(() => _jmfService.CreateVersionAsync(jmf.Id, invalidReq));
    }

    [Fact]
    public async Task CreateVersion_WithDuplicateComponent_ThrowsException()
    {
        var jmf = await _jmfService.CreateJmfAsync(new CreateJmfRequest("K275", "Beton K275"));

        var duplicateReq = new CreateJmfVersionRequest(
            Components: new List<CreateRecipeComponentItem>
            {
                new("MAT-P1", 500m, "kg", 1),
                new("MAT-P1", 200m, "kg", 2) // Duplicate material!
            }
        );

        await Assert.ThrowsAsync<InvalidOperationException>(() => _jmfService.CreateVersionAsync(jmf.Id, duplicateReq));
    }

    #endregion

    #region D. Activation & Deactivation Tests

    [Fact]
    public async Task ActivateVersion_WithValidComponents_SetsActiveAndUpdatesCurrentVersion()
    {
        var jmf = await _jmfService.CreateJmfAsync(new CreateJmfRequest(
            "K300", "K300 Standard", "", 1.0,
            InitialComponents: new List<CreateRecipeComponentItem>
            {
                new("MAT-P1", 650m, "kg", 1),
                new("MAT-SEM", 400m, "kg", 2)
            }
        ));

        var v1 = (await _jmfService.GetVersionsAsync(jmf.Id)).First();
        var activated = await _jmfService.ActivateVersionAsync(jmf.Id, v1.Id, "SUPERVISOR");

        Assert.Equal(JmfStatus.ACTIVE, activated.Status);
        Assert.NotNull(activated.ActivatedAt);

        var refreshedJmf = await _jmfService.GetJmfByIdAsync(jmf.Id);
        Assert.Equal(v1.Id, refreshedJmf!.CurrentVersionId);
        Assert.Equal(1, refreshedJmf.CurrentVersion!.VersionNumber);
    }

    [Fact]
    public async Task ActivateVersion_WithEmptyComponents_ThrowsException()
    {
        var jmf = await _jmfService.CreateJmfAsync(new CreateJmfRequest("K175", "K175 Kosong"));
        var v1 = (await _jmfService.GetVersionsAsync(jmf.Id)).First();

        // Cannot activate empty version
        await Assert.ThrowsAsync<InvalidOperationException>(() => _jmfService.ActivateVersionAsync(jmf.Id, v1.Id));
    }

    [Fact]
    public async Task ActivateVersion_WithInactiveMaterial_ThrowsException()
    {
        var jmf = await _jmfService.CreateJmfAsync(new CreateJmfRequest("K500", "Beton Khusus"));
        var v2 = await _jmfService.CreateVersionAsync(jmf.Id, new CreateJmfVersionRequest(
            Components: new List<CreateRecipeComponentItem>
            {
                new("MAT-P1", 500m, "kg"),
                new("MAT-INACTIVE", 5m, "kg") // Inactive material!
            }
        ));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => _jmfService.ActivateVersionAsync(jmf.Id, v2.Id));
        Assert.Contains("INACTIVE_MATERIAL", ex.Message);
    }

    [Fact]
    public async Task ActivateVersion_WhenJmfIsInactive_ThrowsException()
    {
        var jmf = await _jmfService.CreateJmfAsync(new CreateJmfRequest(
            "K600", "Beton Nonaktif", "", 1.0,
            InitialComponents: new List<CreateRecipeComponentItem> { new("MAT-P1", 500m, "kg") }
        ));

        // Deactivate JMF
        await _jmfService.UpdateJmfAsync(jmf.Id, new UpdateJmfRequest("Beton Nonaktif", "", 1.0, false));

        var v1 = (await _jmfService.GetVersionsAsync(jmf.Id)).First();
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => _jmfService.ActivateVersionAsync(jmf.Id, v1.Id));
        Assert.Contains("INACTIVE_JMF", ex.Message);
    }

    [Fact]
    public async Task ActivateVersion_DeactivatesPreviousActiveVersionAtomically()
    {
        var jmf = await _jmfService.CreateJmfAsync(new CreateJmfRequest(
            "K350_MULTI", "Mutu Beton Multi Version", "", 1.0,
            InitialComponents: new List<CreateRecipeComponentItem> { new("MAT-P1", 500m, "kg") }
        ));

        var v1 = (await _jmfService.GetVersionsAsync(jmf.Id)).First();
        await _jmfService.ActivateVersionAsync(jmf.Id, v1.Id);

        // Create Version 2
        var v2 = await _jmfService.CreateVersionAsync(jmf.Id, new CreateJmfVersionRequest(
            Components: new List<CreateRecipeComponentItem> { new("MAT-P1", 520m, "kg"), new("MAT-SEM", 380m, "kg") }
        ));

        // Activate Version 2
        await _jmfService.ActivateVersionAsync(jmf.Id, v2.Id);

        var versions = (await _jmfService.GetVersionsAsync(jmf.Id)).ToList();
        var updatedV1 = versions.First(v => v.Id == v1.Id);
        var updatedV2 = versions.First(v => v.Id == v2.Id);

        Assert.Equal(JmfStatus.INACTIVE, updatedV1.Status);
        Assert.Equal(JmfStatus.ACTIVE, updatedV2.Status);

        var refreshedJmf = await _jmfService.GetJmfByIdAsync(jmf.Id);
        Assert.Equal(v2.Id, refreshedJmf!.CurrentVersionId);
    }

    #endregion

    #region E. Immutability Tests

    [Fact]
    public async Task UpdateVersion_WhenUsedInProduction_ThrowsImmutabilityException()
    {
        var jmf = await _jmfService.CreateJmfAsync(new CreateJmfRequest(
            "K350_PROD", "Beton Produksi", "", 1.0,
            InitialComponents: new List<CreateRecipeComponentItem> { new("MAT-P1", 500m, "kg") }
        ));

        var v1 = (await _jmfService.GetVersionsAsync(jmf.Id)).First();
        await _jmfService.ActivateVersionAsync(jmf.Id, v1.Id);

        // Mark as used in production (e.g. by creating a batch snapshot)
        await _jmfService.CreateBatchSnapshotAsync("BATCH-TEST-001", jmf.Code, 2.0);

        // Attempt to modify used version destructively
        var updateReq = new UpdateJmfVersionRequest(
            TargetSlumpCm: 16.0,
            MixingTimeSec: 30,
            Notes: "Percobaan ubah",
            Components: new List<CreateRecipeComponentItem> { new("MAT-P1", 550m, "kg") }
        );

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => _jmfService.UpdateVersionAsync(jmf.Id, v1.Id, updateReq));
        Assert.Contains("IMMUTABLE_VERSION", ex.Message);
    }

    #endregion

    #region F. Snapshot Reproducibility Tests

    [Fact]
    public async Task BatchSnapshot_PreservesHistoricalVersionEvenWhenJmfAdvances()
    {
        // 1. Create JMF with Version 1 (Sand 500kg, Cement 350kg)
        var jmf = await _jmfService.CreateJmfAsync(new CreateJmfRequest(
            "K300_HIST", "Beton Historis", "", 1.0,
            InitialComponents: new List<CreateRecipeComponentItem>
            {
                new("MAT-P1", 500m, "kg", 1),
                new("MAT-SEM", 350m, "kg", 2)
            }
        ));

        var v1 = (await _jmfService.GetVersionsAsync(jmf.Id)).First();
        await _jmfService.ActivateVersionAsync(jmf.Id, v1.Id);

        // 2. Create Batch #1001 using Version 1
        var batchLogId = "BATCH-LOG-1001";
        var snapshot = await _jmfService.CreateBatchSnapshotAsync(batchLogId, jmf.Code, 3.0);

        Assert.NotNull(snapshot);
        Assert.Equal(1, snapshot.VersionNumber);
        Assert.Equal("K300_HIST", snapshot.JmfCode);

        // 3. Subsequently, engineer creates Version 2 with Sand 580kg, Cement 420kg and activates it
        var v2 = await _jmfService.CreateVersionAsync(jmf.Id, new CreateJmfVersionRequest(
            Components: new List<CreateRecipeComponentItem>
            {
                new("MAT-P1", 580m, "kg", 1),
                new("MAT-SEM", 420m, "kg", 2)
            }
        ));
        await _jmfService.ActivateVersionAsync(jmf.Id, v2.Id);

        // 4. Verify Batch #1001 snapshot STILL contains EXACT Version 1 data
        var savedSnapshot = await _jmfService.GetSnapshotByBatchLogIdAsync(batchLogId);
        Assert.NotNull(savedSnapshot);
        Assert.Equal(1, savedSnapshot.VersionNumber);

        var sandComp = savedSnapshot.Components.First(c => c.MaterialId == "MAT-P1");
        var cementComp = savedSnapshot.Components.First(c => c.MaterialId == "MAT-SEM");

        Assert.Equal(500m, sandComp.TargetQuantity); // UNCHANGED!
        Assert.Equal(350m, cementComp.TargetQuantity); // UNCHANGED!
    }

    #endregion

    #region G. Authorization & RBAC Tests

    [Fact]
    public async Task JmfController_OperatorRole_CannotCreateOrActivateJmf()
    {
        var controller = new JmfController(_jmfService)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

        // Caller is OPERATOR
        controller.HttpContext.Request.Headers["X-User-Role"] = "OPERATOR";

        var createRes = await controller.Create(new CreateJmfRequest("K350_AUTH", "Auth Test"), CancellationToken.None);
        var objectRes = Assert.IsType<ObjectResult>(createRes);
        Assert.Equal(403, objectRes.StatusCode);

        var activateRes = await controller.ActivateVersion("any-id", "any-ver-id", CancellationToken.None);
        var activateObjRes = Assert.IsType<ObjectResult>(activateRes);
        Assert.Equal(403, activateObjRes.StatusCode);
    }

    [Fact]
    public async Task JmfController_SupervisorOrAdmin_CanCreateJmf()
    {
        var controller = new JmfController(_jmfService)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

        controller.HttpContext.Request.Headers["X-User-Role"] = "SUPERVISOR";
        controller.HttpContext.Request.Headers["X-User-Name"] = "Budi_Supervisor";

        var createRes = await controller.Create(new CreateJmfRequest("K450_AUTH", "Auth Success Test"), CancellationToken.None);
        Assert.IsType<CreatedAtActionResult>(createRes);
    }

    #endregion

    #region H. Audit Log Tests

    [Fact]
    public async Task JmfLifecycle_GeneratesAuditRecordsProperly()
    {
        // 1. Create JMF
        var jmf = await _jmfService.CreateJmfAsync(new CreateJmfRequest(
            "K225_AUDIT", "Audit Test", "", 1.0,
            InitialComponents: new List<CreateRecipeComponentItem> { new("MAT-P1", 500m, "kg") }
        ), "Supervisor_Dedi");

        // 2. Activate Version 1
        var v1 = (await _jmfService.GetVersionsAsync(jmf.Id)).First();
        await _jmfService.ActivateVersionAsync(jmf.Id, v1.Id, "Supervisor_Dedi");

        // 3. Deactivate Version 1
        await _jmfService.DeactivateVersionAsync(jmf.Id, v1.Id, "Admin_Rudi");

        var recentLogs = (await _audit.GetRecentLogsAsync(20)).ToList();

        Assert.Contains(recentLogs, l => l.Action == "JMF_CREATED" && l.Username == "Supervisor_Dedi");
        Assert.Contains(recentLogs, l => l.Action == "JMF_VERSION_ACTIVATED" && l.Username == "Supervisor_Dedi");
        Assert.Contains(recentLogs, l => l.Action == "JMF_VERSION_DEACTIVATED" && l.Username == "Admin_Rudi");
    }

    #endregion

    #region I. SQLite Persistence Test

    [Fact]
    public async Task JmfData_PersistsAcrossFreshDbContextInstances()
    {
        // 1. Write data using existing context
        var jmf = await _jmfService.CreateJmfAsync(new CreateJmfRequest(
            "K350_PERSIST", "Persist JMF", "Testing DB persistence", 1.0,
            InitialComponents: new List<CreateRecipeComponentItem>
            {
                new("MAT-P1", 520m, "kg", 1),
                new("MAT-SEM", 380m, "kg", 2)
            }
        ));

        var v1 = (await _jmfService.GetVersionsAsync(jmf.Id)).First();
        await _jmfService.ActivateVersionAsync(jmf.Id, v1.Id);
        await _jmfService.CreateBatchSnapshotAsync("BATCH-PERSIST-001", jmf.Code, 2.5);

        // 2. Create FRESH DbContext instance pointing to the same SQLite connection
        var options = new DbContextOptionsBuilder<LocalDbContext>()
            .UseSqlite(_connection)
            .Options;

        using var freshContext = new LocalDbContext(options);
        var freshAudit = new AuditRepository(freshContext);
        var freshJmfService = new JmfService(freshContext, freshAudit);

        // 3. Query from fresh service
        var loadedJmf = await freshJmfService.GetJmfByCodeAsync("K350_PERSIST");
        Assert.NotNull(loadedJmf);
        Assert.Equal("K350_PERSIST", loadedJmf.Code);
        Assert.True(loadedJmf.IsActive);
        Assert.NotNull(loadedJmf.CurrentVersion);
        Assert.Equal(2, loadedJmf.CurrentVersion!.Components.Count);

        var loadedSnapshot = await freshJmfService.GetSnapshotByBatchLogIdAsync("BATCH-PERSIST-001");
        Assert.NotNull(loadedSnapshot);
        Assert.Equal(1, loadedSnapshot.VersionNumber);
        Assert.Equal(2.5, loadedSnapshot.TargetVolumeM3);
        Assert.Equal(2, loadedSnapshot.Components.Count);
    }

    #endregion
}
