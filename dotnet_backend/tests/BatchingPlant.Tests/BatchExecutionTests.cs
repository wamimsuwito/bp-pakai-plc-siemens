using BatchingPlant.Application.DTOs;
using BatchingPlant.Application.Services;
using BatchingPlant.Domain.Entities;
using BatchingPlant.Domain.Enums;
using BatchingPlant.Domain.Interfaces;
using Moq;
using Xunit;

namespace BatchingPlant.Tests;

public class BatchExecutionTests
{
    private readonly Mock<ISiemensS7Service> _mockPlc;
    private readonly Mock<IBatchRepository> _mockRepo;
    private readonly Mock<ISyncEngine> _mockSync;
    private readonly BatchExecutionService _service;

    public BatchExecutionTests()
    {
        _mockPlc = new Mock<ISiemensS7Service>();
        _mockRepo = new Mock<IBatchRepository>();
        _mockSync = new Mock<ISyncEngine>();

        // Default healthy PLC response
        _mockPlc.Setup(p => p.ReadTelemetryAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ScaleTelemetry(0, 0, 0, 0, 0, 6.5, 0, 12.0, false, true, true));

        _service = new BatchExecutionService(_mockPlc.Object, _mockRepo.Object, _mockSync.Object);
    }

    [Fact]
    public async Task StartBatchAsync_WhenEmergencyStopIsActive_ThrowsException()
    {
        // Arrange
        _mockPlc.Setup(p => p.ReadTelemetryAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ScaleTelemetry(0, 0, 0, 0, 0, 6.5, 0, 12.0, true, true, true));

        var req = new StartBatchRequest("K300", 3.0, 1, "Silo 1", "PT Adhi", "Pekanbaru", "BM 1234 XY", "Budi", "Operator 1");

        // Act & Assert
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => _service.StartBatchAsync(req));
        Assert.Contains("Emergency Stop", ex.Message);
    }

    [Fact]
    public async Task StartBatchAsync_WhenAirPressureIsBelowSafetyLimit_ThrowsException()
    {
        // Arrange (e.g. 4.0 Bar, which is below 5.5 Bar / 80 PSI limit)
        _mockPlc.Setup(p => p.ReadTelemetryAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ScaleTelemetry(0, 0, 0, 0, 0, 4.0, 0, 12.0, false, true, true));

        var req = new StartBatchRequest("K300", 3.0, 1, "Silo 1", "PT Adhi", "Pekanbaru", "BM 1234 XY", "Budi", "Operator 1");

        // Act & Assert
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => _service.StartBatchAsync(req));
        Assert.Contains("Tekanan kompresor rendah", ex.Message);
    }

    [Fact]
    public async Task StartBatchAsync_WithMoistureCorrection_AdjustsSandAndWaterCorrectly()
    {
        // Arrange: 10% sand moisture on 1m3 batch
        var req = new StartBatchRequest(
            RecipeId: "K300",
            TargetVolumeM3: 1.0,
            MixingCycles: 1,
            SiloSemen: "Silo 1",
            Pelanggan: "PT Farika",
            Lokasi: "Workshop",
            NoKendaraan: "BM 8888",
            Sopir: "Anto",
            OperatorName: "Op 1",
            Mode: BatchingMode.AUTO,
            MoisturePasir1Pct: 10.0 // 10% water in sand
        );

        JobMixFormula? writtenFormula = null;
        _mockPlc.Setup(p => p.WriteBatchRecipeTargetsAsync(It.IsAny<JobMixFormula>(), It.IsAny<double>(), It.IsAny<CancellationToken>()))
            .Callback<JobMixFormula, double, CancellationToken>((f, v, c) => writtenFormula = f)
            .Returns(Task.CompletedTask);

        // Act
        var batchId = await _service.StartBatchAsync(req);

        // Assert
        Assert.NotNull(batchId);
        Assert.NotNull(writtenFormula);
        
        // Dry sand is 550kg. With 10% moisture: 550 * 1.10 = 605kg
        Assert.Equal(605.0, writtenFormula.Pasir1Target, 1);
        
        // Water is 160kg. Deduct 55kg moisture: 160 - 55 = 105kg
        Assert.Equal(105.0, writtenFormula.AirTarget, 1);
    }
}
