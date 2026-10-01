using System.Text.Json;
using BatchingPlant.Domain.Entities;
using BatchingPlant.Domain.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace BatchingPlant.Infrastructure.Persistence.Repositories;

public class AuditRepository : IAuditRepository
{
    private readonly LocalDbContext _context;

    public AuditRepository(LocalDbContext context)
    {
        _context = context;
    }

    public async Task LogAsync(string action, string message, string? username = null, string? payload = null)
    {
        var log = new AuditLogItem
        {
            Action = action,
            Message = message,
            Username = username ?? "OPERATOR",
            Payload = payload,
            CreatedAt = DateTime.UtcNow
        };
        await _context.AuditLogs.AddAsync(log);
        await _context.SaveChangesAsync();
    }

    public async Task<IEnumerable<AuditLogItem>> GetRecentLogsAsync(int limit = 100)
    {
        return await _context.AuditLogs
            .OrderByDescending(x => x.CreatedAt)
            .Take(limit)
            .ToListAsync();
    }
}

public class CalibrationRepository : ICalibrationRepository
{
    private readonly LocalDbContext _context;

    public CalibrationRepository(LocalDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<ScaleCalibration>> GetAllCalibrationsAsync()
    {
        return await _context.ScaleCalibrations.ToListAsync();
    }

    public async Task<ScaleCalibration?> GetByTypeAsync(string scaleType)
    {
        return await _context.ScaleCalibrations.FirstOrDefaultAsync(x => x.ScaleType.ToUpper() == scaleType.ToUpper());
    }

    public async Task SaveCalibrationAsync(ScaleCalibration calibration)
    {
        var existing = await GetByTypeAsync(calibration.ScaleType);
        if (existing == null)
        {
            await _context.ScaleCalibrations.AddAsync(calibration);
        }
        else
        {
            existing.RawZeroAdc = calibration.RawZeroAdc;
            existing.RawSpanAdc = calibration.RawSpanAdc;
            existing.CalibratedSpanKg = calibration.CalibratedSpanKg;
            existing.FilterAlpha = calibration.FilterAlpha;
            existing.ZeroDeadbandKg = calibration.ZeroDeadbandKg;
            existing.UpdatedAt = DateTime.UtcNow;
            _context.ScaleCalibrations.Update(existing);
        }
        await _context.SaveChangesAsync();
    }
}
