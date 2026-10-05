using BatchingPlant.Domain.Entities;
using BatchingPlant.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BatchingPlant.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RecipeController : ControllerBase
{
    private readonly LocalDbContext _context;

    public RecipeController(LocalDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var list = await _context.JobMixFormulas.Where(r => r.IsActive).ToListAsync();
        return Ok(list);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] JobMixFormula formula)
    {
        formula.Id = Guid.NewGuid().ToString();
        formula.CreatedAt = DateTime.UtcNow;
        await _context.JobMixFormulas.AddAsync(formula);
        await _context.SaveChangesAsync();
        return Ok(formula);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] JobMixFormula formula)
    {
        var existing = await _context.JobMixFormulas.FindAsync(id);
        if (existing == null) return NotFound();

        existing.MutuBeton = formula.MutuBeton;
        existing.Pasir1Target = formula.Pasir1Target;
        existing.Pasir2Target = formula.Pasir2Target;
        existing.Batu1Target = formula.Batu1Target;
        existing.Batu2Target = formula.Batu2Target;
        existing.SemenTarget = formula.SemenTarget;
        existing.AirTarget = formula.AirTarget;
        existing.AdditiveTarget = formula.AdditiveTarget;
        existing.TargetSlumpCm = formula.TargetSlumpCm;
        existing.MixingTimeSec = formula.MixingTimeSec;
        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(existing);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var existing = await _context.JobMixFormulas.FindAsync(id);
        if (existing == null) return NotFound();

        existing.IsActive = false;
        await _context.SaveChangesAsync();
        return Ok(new { success = true });
    }
}

[ApiController]
[Route("api/[controller]")]
public class PlcController : ControllerBase
{
    private readonly Domain.Interfaces.ISiemensS7Service _plcService;

    public PlcController(Domain.Interfaces.ISiemensS7Service plcService)
    {
        _plcService = plcService;
    }

    [HttpGet("status")]
    public async Task<IActionResult> GetStatus(CancellationToken ct)
    {
        var telemetry = await _plcService.ReadTelemetryAsync(ct);
        var ioStatus = await _plcService.ReadIoStatusAsync(ct);
        return Ok(new
        {
            connected = _plcService.IsConnected,
            status = _plcService.IsConnected ? "CONNECTED" : "PLC_DISCONNECTED",
            mode = _plcService.Mode.ToString(),
            telemetry,
            ioStatus
        });
    }

    [HttpPost("connect")]
    public async Task<IActionResult> Connect([FromQuery] string ip = "192.168.0.1", [FromQuery] int rack = 0, [FromQuery] int slot = 1)
    {
        var ok = await _plcService.ConnectAsync(ip, rack, slot);
        return Ok(new { success = ok, ip, rack, slot });
    }
}

[ApiController]
[Route("api/[controller]")]
public class SyncController : ControllerBase
{
    private readonly Domain.Interfaces.ISyncEngine _syncEngine;

    public SyncController(Domain.Interfaces.ISyncEngine syncEngine)
    {
        _syncEngine = syncEngine;
    }

    [HttpGet("status")]
    public async Task<IActionResult> GetStatus(CancellationToken ct)
    {
        var canConnect = await _syncEngine.PingCentralPostgresAsync(ct);
        return Ok(new
        {
            centralConnected = canConnect,
            status = canConnect ? "ONLINE_SYNCED" : "OFFLINE_LOCAL_FIRST"
        });
    }

    [HttpPost("trigger")]
    public async Task<IActionResult> TriggerSync(CancellationToken ct)
    {
        var processed = await _syncEngine.ProcessSyncQueueAsync(ct);
        return Ok(new { success = true, processedRecords = processed });
    }
}
