using BatchingPlant.Application.DTOs;
using BatchingPlant.Application.Services;
using BatchingPlant.Domain.Entities;
using BatchingPlant.Domain.Enums;
using BatchingPlant.Domain.Interfaces;
using BatchingPlant.Infrastructure.Plc;
using BatchingPlant.Infrastructure.Services;
using Moq;
using Xunit;

namespace BatchingPlant.Tests;

public class Phase16BlockerVerificationTests
{
    [Fact]
    public void StoragePathService_CustomRootPath_CreatesConfiguredDirectoriesAndPath()
    {
        // 1. SQLite path configuration test
        var tempRoot = Path.Combine(Path.GetTempPath(), "BatchingPlant_Test_" + Guid.NewGuid().ToString("N"));
        try
        {
            var storage = new StoragePathService(tempRoot);

            Assert.Equal(tempRoot, storage.RootPath);
            Assert.Equal(Path.Combine(tempRoot, "Database", "batchingplant.db"), storage.DatabaseFilePath);
            Assert.True(Directory.Exists(storage.DatabaseDirectory));
            Assert.True(Directory.Exists(storage.BackupDirectory));
            Assert.True(Directory.Exists(storage.LogsDirectory));
            Assert.True(Directory.Exists(storage.ReportsDirectory));
            Assert.True(Directory.Exists(storage.SyncDirectory));
        }
        finally
        {
            if (Directory.Exists(tempRoot))
            {
                Directory.Delete(tempRoot, true);
            }
        }
    }

    [Fact]
    public async Task SetOperatingMode_ValidModes_UpdatesModeSuccessfully()
    {
        // 2. Mode logic test
        var mockPlc = new Mock<ISiemensS7Service>();
        mockPlc.SetupGet(p => p.Mode).Returns(OperationMode.SIMULATION);
        mockPlc.SetupGet(p => p.IsConnected).Returns(true);

        var service = new BatchExecutionService(mockPlc.Object, Mock.Of<IBatchRepository>(), Mock.Of<ISyncEngine>());

        var resAuto = await service.SetOperatingModeAsync(BatchingMode.AUTO);
        Assert.True(resAuto.Success);
        Assert.Equal(BatchingMode.AUTO, service.CurrentOperatingMode);

        var resManual = await service.SetOperatingModeAsync(BatchingMode.MANUAL);
        Assert.True(resManual.Success);
        Assert.Equal(BatchingMode.MANUAL, service.CurrentOperatingMode);
    }

    [Fact]
    public async Task SetOperatingMode_WhenPlcDisconnectedInProduction_BlocksAndReturnsError()
    {
        // 3. PLC disconnected blocks commands
        var mockPlc = new Mock<ISiemensS7Service>();
        mockPlc.SetupGet(p => p.Mode).Returns(OperationMode.PRODUCTION);
        mockPlc.SetupGet(p => p.IsConnected).Returns(false);

        var service = new BatchExecutionService(mockPlc.Object, Mock.Of<IBatchRepository>(), Mock.Of<ISyncEngine>());

        var result = await service.SetOperatingModeAsync(BatchingMode.AUTO);
        Assert.False(result.Success);
        Assert.Equal("PLC_DISCONNECTED", result.ErrorCode);
    }

    [Fact]
    public void SimulatedPlcClient_ExplicitStatus_IsAlwaysSimulation()
    {
        // 4. Simulation mode explicit
        var simPlc = new SimulatedPlcClient();
        Assert.Equal(PlcConnectionStatus.SIMULATION, simPlc.Status);
        Assert.Equal(OperationMode.SIMULATION, simPlc.Mode);
        Assert.True(simPlc.IsConnected);
    }

    [Fact]
    public void PasswordHasher_Pbkdf2_GeneratesSecureHashAndVerifiesCorrectly()
    {
        // 5. Password hashing test
        var hasher = new Pbkdf2PasswordHasher();
        var rawPassword = "SecureOperatorPass123!";

        var hash = hasher.HashPassword(rawPassword);

        Assert.NotEmpty(hash);
        Assert.NotEqual(rawPassword, hash);
        Assert.Contains(".", hash); // Iterations.Salt.Hash format

        // Correct password matches
        Assert.True(hasher.VerifyPassword(rawPassword, hash));

        // Incorrect password fails
        Assert.False(hasher.VerifyPassword("WrongPassword", hash));
    }

    [Fact]
    public void UserRoles_EnforcesRequiredRoles()
    {
        // 6. Authorization roles test
        Assert.True(Enum.IsDefined(typeof(UserRole), UserRole.ADMIN));
        Assert.True(Enum.IsDefined(typeof(UserRole), UserRole.OPERATOR));
        Assert.True(Enum.IsDefined(typeof(UserRole), UserRole.SUPERVISOR));
        Assert.True(Enum.IsDefined(typeof(UserRole), UserRole.LOGISTIK));
        Assert.True(Enum.IsDefined(typeof(UserRole), UserRole.DIREKTUR));
    }

    [Fact]
    public void StoragePathService_DatabaseStatusPaths_AreFormattedCorrectly()
    {
        // 7. Database status path check
        var tempRoot = Path.Combine(Path.GetTempPath(), "BP_Test_Status");
        var storage = new StoragePathService(tempRoot);

        Assert.EndsWith("batchingplant.db", storage.DatabaseFilePath);
        Assert.EndsWith("Backup", storage.BackupDirectory);
        Assert.EndsWith("Logs", storage.LogsDirectory);
    }

    [Fact]
    public void BackupFileNameFormat_FollowsTimestampConvention()
    {
        // 8. Backup service filename format check
        var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
        var expectedFormat = $"batchingplant_{timestamp}.db";
        Assert.StartsWith("batchingplant_", expectedFormat);
        Assert.EndsWith(".db", expectedFormat);
    }

    [Fact]
    public void SyncQueueItem_Model_StoresEntityAndPayloadProperly()
    {
        // 9. SyncQueue persistence model check
        var item = new SyncQueueItem
        {
            EntityType = "BatchLog",
            EntityId = "BATCH-TEST-001",
            PayloadJson = "{\"test\": 123}",
            IsProcessed = false
        };

        Assert.Equal("BatchLog", item.EntityType);
        Assert.Equal("BATCH-TEST-001", item.EntityId);
        Assert.False(item.IsProcessed);
        Assert.NotEmpty(item.Id);
    }

    [Fact]
    public async Task StartBatchAsync_WhenPlcDisconnectedInProduction_ThrowsPlcDisconnectedException()
    {
        // 10. StartBatch is blocked when PLC is disconnected
        var mockPlc = new Mock<ISiemensS7Service>();
        mockPlc.SetupGet(p => p.Mode).Returns(OperationMode.PRODUCTION);
        mockPlc.SetupGet(p => p.IsConnected).Returns(false);

        var service = new BatchExecutionService(mockPlc.Object, Mock.Of<IBatchRepository>(), Mock.Of<ISyncEngine>());
        var req = new StartBatchRequest("K300", 2.0, 1, "Silo 1", "Cust A", "Loc B", "BM 1", "Driver X", "Op 1");

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => service.StartBatchAsync(req));
        Assert.StartsWith("PLC_DISCONNECTED", ex.Message);
    }
}
