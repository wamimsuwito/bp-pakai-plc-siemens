using BatchingPlant.Application.DTOs;
using BatchingPlant.Application.Services;
using BatchingPlant.Domain.Entities;
using BatchingPlant.Domain.Enums;
using BatchingPlant.Domain.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace BatchingPlant.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BatchController : ControllerBase
{
    private readonly IBatchExecutionService _batchService;
    private readonly IBatchRepository _batchRepository;

    public BatchController(IBatchExecutionService batchService, IBatchRepository batchRepository)
    {
        _batchService = batchService;
        _batchRepository = batchRepository;
    }

    [HttpPost("start")]
    public async Task<IActionResult> Start([FromBody] StartBatchRequest request, CancellationToken ct)
    {
        try
        {
            var batchNumber = await _batchService.StartBatchAsync(request, ct);
            return Ok(new { success = true, batchNumber });
        }
        catch (InvalidOperationException ex)
        {
            string errorCode = ex.Message.StartsWith("PLC_DISCONNECTED") ? "PLC_DISCONNECTED"
                : ex.Message.StartsWith("EMERGENCY_STOP") ? "EMERGENCY_STOP_ACTIVE"
                : ex.Message.StartsWith("AIR_PRESSURE") ? "AIR_PRESSURE_LOW"
                : "BATCH_START_FAILED";

            return BadRequest(new { success = false, errorCode, message = ex.Message });
        }
        catch (Exception ex)
        {
            return BadRequest(new { success = false, errorCode = "UNEXPECTED_ERROR", message = ex.Message });
        }
    }

    [HttpPost("pause")]
    public async Task<IActionResult> Pause(CancellationToken ct)
    {
        try
        {
            await _batchService.PauseBatchAsync(ct);
            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            return BadRequest(new { success = false, errorCode = "PAUSE_FAILED", message = ex.Message });
        }
    }

    [HttpPost("resume")]
    public async Task<IActionResult> Resume(CancellationToken ct)
    {
        try
        {
            await _batchService.ResumeBatchAsync(ct);
            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            return BadRequest(new { success = false, errorCode = "RESUME_FAILED", message = ex.Message });
        }
    }

    [HttpPost("abort")]
    public async Task<IActionResult> Abort([FromBody] string reason, CancellationToken ct)
    {
        try
        {
            await _batchService.AbortBatchAsync(reason, ct);
            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            return BadRequest(new { success = false, errorCode = "ABORT_FAILED", message = ex.Message });
        }
    }

    [HttpPost("mode")]
    public async Task<IActionResult> SetMode([FromBody] SetModeRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request?.Mode) || 
            !Enum.TryParse<BatchingMode>(request.Mode, true, out var mode))
        {
            return BadRequest(new 
            { 
                success = false, 
                errorCode = "INVALID_MODE", 
                message = $"Mode '{request?.Mode}' tidak valid. Pilihan: MANUAL, AUTO, SEMI_AUTO" 
            });
        }

        var (success, errorCode, message) = await _batchService.SetOperatingModeAsync(mode, ct);
        if (!success)
        {
            return BadRequest(new 
            { 
                success = false, 
                errorCode = errorCode ?? "MODE_CHANGE_FAILED", 
                message = message ?? "Gagal mengubah mode batching" 
            });
        }

        return Ok(new { success = true, mode = mode.ToString() });
    }

    [HttpPost("manual-actuator")]
    public async Task<IActionResult> ToggleActuator([FromBody] ManualActuatorRequest request, CancellationToken ct)
    {
        try
        {
            await _batchService.ToggleManualDeviceAsync(request.ActuatorKey, request.TargetState, ct);
            return Ok(new { success = true });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new 
            { 
                success = false, 
                errorCode = "ACTUATOR_COMMAND_LOCKED", 
                message = ex.Message 
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new 
            { 
                success = false, 
                errorCode = "MANUAL_TOGGLE_FAILED", 
                message = ex.Message 
            });
        }
    }

    [HttpGet("history")]
    public async Task<IActionResult> GetHistory([FromQuery] int limit = 50, [FromQuery] string? search = null)
    {
        var logs = await _batchRepository.SearchBatchesAsync(search, null, null);
        return Ok(logs);
    }

    [HttpGet("ticket/{id}")]
    public async Task<IActionResult> GetTicket(string id)
    {
        var batch = await _batchRepository.GetByIdAsync(id);
        if (batch == null) return NotFound(new { success = false, errorCode = "NOT_FOUND", message = "Batch tidak ditemukan" });

        var ticket = new TicketPrintDto(
            BatchNumber: batch.BatchNumber,
            DateFormatted: batch.StartTime.ToString("dd/MM/yyyy"),
            TimeFormatted: batch.StartTime.ToString("HH:mm:ss"),
            CompanyName: batch.PlantCompany,
            PlantName: batch.PlantName,
            RecipeName: batch.RecipeName,
            OrderedVolumeM3: batch.OrderedVolume,
            Pelanggan: batch.Pelanggan,
            Lokasi: batch.Lokasi,
            NoKendaraan: batch.NoKendaraan,
            Sopir: batch.Sopir,
            Operator: batch.OperatorName,
            TargetWeightsKg: new Dictionary<string, double>
            {
                ["Pasir 1"] = batch.TargetPasir1,
                ["Pasir 2"] = batch.TargetPasir2,
                ["Batu 1"] = batch.TargetBatu1,
                ["Batu 2"] = batch.TargetBatu2,
                ["Semen"] = batch.TargetSemen,
                ["Air"] = batch.TargetAir,
                ["Additive"] = batch.TargetAdditive
            },
            ActualWeightsKg: new Dictionary<string, double>
            {
                ["Pasir 1"] = batch.ActualPasir1,
                ["Pasir 2"] = batch.ActualPasir2,
                ["Batu 1"] = batch.ActualBatu1,
                ["Batu 2"] = batch.ActualBatu2,
                ["Semen"] = batch.ActualSemen,
                ["Air"] = batch.ActualAir,
                ["Additive"] = batch.ActualAdditive
            },
            DeviationsPct: new Dictionary<string, double>
            {
                ["Pasir 1"] = CalculateDeviation(batch.TargetPasir1, batch.ActualPasir1),
                ["Semen"] = CalculateDeviation(batch.TargetSemen, batch.ActualSemen),
                ["Air"] = CalculateDeviation(batch.TargetAir, batch.ActualAir)
            },
            SlumpCm: batch.SlumpActual
        );

        return Ok(ticket);
    }

    private static double CalculateDeviation(double target, double actual)
    {
        if (target <= 0) return 0.0;
        return Math.Round(((actual - target) / target) * 100.0, 2);
    }
}
