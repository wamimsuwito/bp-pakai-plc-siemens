using BatchingPlant.Application.DTOs;
using BatchingPlant.Application.Services;
using BatchingPlant.Domain.Entities;
using BatchingPlant.Domain.Enums;
using BatchingPlant.Domain.Interfaces;
using BatchingPlant.Infrastructure.Persistence;
using BatchingPlant.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BatchingPlant.WebApi.Controllers;

[ApiController]
[Route("api/health")]
public class HealthController : ControllerBase
{
    private readonly LocalDbContext _db;
    private readonly IPlcClient _plc;
    private readonly ISyncEngine _syncEngine;

    public HealthController(LocalDbContext db, IPlcClient plc, ISyncEngine syncEngine)
    {
        _db = db;
        _plc = plc;
        _syncEngine = syncEngine;
    }

    [HttpGet]
    public async Task<IActionResult> GetHealth(CancellationToken ct)
    {
        bool sqliteOk = false;
        try
        {
            sqliteOk = await _db.Database.CanConnectAsync(ct);
        }
        catch { sqliteOk = false; }

        bool centralDbOk = await _syncEngine.PingCentralPostgresAsync(ct);

        return Ok(new
        {
            backend = "ONLINE",
            sqlite = sqliteOk ? "OK" : "ERROR",
            plc = _plc.Status.ToString(), // CONNECTED, DISCONNECTED, FAULT, SIMULATION
            plcMode = _plc.Mode.ToString(),
            postgresql = centralDbOk ? "CONNECTED" : "OFFLINE",
            sync = centralDbOk ? "IDLE" : "PENDING_OFFLINE",
            timestamp = DateTime.UtcNow
        });
    }
}

[ApiController]
[Route("api/database/status")]
public class DatabaseStatusController : ControllerBase
{
    private readonly LocalDbContext _context;
    private readonly IStoragePathService _storagePath;

    public DatabaseStatusController(LocalDbContext context, IStoragePathService storagePath)
    {
        _context = context;
        _storagePath = storagePath;
    }

    [HttpGet]
    public async Task<IActionResult> GetStatus(CancellationToken ct)
    {
        string dbPath = _storagePath.DatabaseFilePath;
        bool exists = System.IO.File.Exists(dbPath);
        bool canConnect = false;
        long sizeBytes = 0;
        int pendingSync = 0;

        try
        {
            canConnect = await _context.Database.CanConnectAsync(ct);
            if (exists)
            {
                sizeBytes = new FileInfo(dbPath).Length;
            }
            pendingSync = await _context.SyncQueueItems.CountAsync(x => !x.IsProcessed, ct);
        }
        catch
        {
            canConnect = false;
        }

        return Ok(new
        {
            connected = canConnect,
            provider = "SQLite",
            path = dbPath,
            sizeBytes,
            pendingSync
        });
    }
}

[ApiController]
[Route("api/database/backup")]
public class DatabaseBackupController : ControllerBase
{
    private readonly IBackupService _backupService;
    private readonly IAuditRepository _audit;

    public DatabaseBackupController(IBackupService backupService, IAuditRepository audit)
    {
        _backupService = backupService;
        _audit = audit;
    }

    [HttpPost]
    public async Task<IActionResult> TriggerBackup([FromQuery] string? targetDir = null)
    {
        try
        {
            var path = await _backupService.CreateBackupAsync(targetDir);
            long sizeBytes = System.IO.File.Exists(path) ? new FileInfo(path).Length : 0;
            await _audit.LogAsync("BACKUP", $"Created database backup: {path} ({sizeBytes} bytes)");

            return Ok(new
            {
                success = true,
                path,
                sizeBytes
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new
            {
                success = false,
                errorCode = "BACKUP_FAILED",
                error = ex.Message
            });
        }
    }
}

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly LocalDbContext _context;
    private readonly IPasswordHasher _hasher;
    private readonly IAuditRepository _audit;

    public AuthController(LocalDbContext context, IPasswordHasher hasher, IAuditRepository audit)
    {
        _context = context;
        _hasher = hasher;
        _audit = audit;
    }

    public record LoginRequest(string NikOrUsername, string Password);

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request?.NikOrUsername) || string.IsNullOrWhiteSpace(request?.Password))
        {
            return BadRequest(new { success = false, errorCode = "INVALID_INPUT", message = "NIK / Nama dan Password wajib diisi." });
        }

        var input = request.NikOrUsername.Trim().ToLower();
        var user = await _context.UserAccounts
            .FirstOrDefaultAsync(u => u.IsActive && (u.Nik.ToLower() == input || u.Nama.ToLower() == input));

        if (user == null || !_hasher.VerifyPassword(request.Password, user.PasswordHash))
        {
            await _audit.LogAsync("LOGIN_FAILED", $"Failed login attempt for identifier: {request.NikOrUsername}");
            return Unauthorized(new { success = false, errorCode = "INVALID_CREDENTIALS", message = "NIK / Nama atau Password tidak cocok." });
        }

        // Automatic seamless upgrade if legacy plaintext hash was detected and verified
        if (!user.PasswordHash.Contains('.'))
        {
            user.PasswordHash = _hasher.HashPassword(request.Password);
            await _context.SaveChangesAsync();
        }

        await _audit.LogAsync("LOGIN_SUCCESS", $"User {user.Nama} ({user.Nik}) logged in as {user.Jabatan}", user.Nama);

        return Ok(new
        {
            success = true,
            user = new
            {
                id = user.Id,
                nama = user.Nama,
                nik = user.Nik,
                jabatan = user.Jabatan.ToString()
            },
            role = user.Jabatan.ToString()
        });
    }
}

[ApiController]
[Route("api/jmf")]
public class JmfController : ControllerBase
{
    private readonly LocalDbContext _context;
    private readonly IAuditRepository _audit;

    public JmfController(LocalDbContext context, IAuditRepository audit)
    {
        _context = context;
        _audit = audit;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var list = await _context.JobMixFormulas.Where(r => r.IsActive).OrderBy(r => r.MutuBeton).ToListAsync();
        return Ok(list);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(string id)
    {
        var item = await _context.JobMixFormulas.FindAsync(id);
        if (item == null) return NotFound(new { success = false, errorCode = "NOT_FOUND", message = "JMF tidak ditemukan" });
        return Ok(item);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] JobMixFormula formula)
    {
        formula.Id = Guid.NewGuid().ToString();
        formula.CreatedAt = DateTime.UtcNow;
        formula.IsActive = true;
        await _context.JobMixFormulas.AddAsync(formula);
        await _context.SaveChangesAsync();
        await _audit.LogAsync("JMF_CREATE", $"Created JMF formula: {formula.MutuBeton}");
        return Ok(formula);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] JobMixFormula formula)
    {
        var existing = await _context.JobMixFormulas.FindAsync(id);
        if (existing == null) return NotFound(new { success = false, errorCode = "NOT_FOUND", message = "JMF tidak ditemukan" });

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
        await _audit.LogAsync("JMF_UPDATE", $"Updated JMF formula: {formula.MutuBeton}");
        return Ok(existing);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var existing = await _context.JobMixFormulas.FindAsync(id);
        if (existing == null) return NotFound(new { success = false, errorCode = "NOT_FOUND", message = "JMF tidak ditemukan" });

        existing.IsActive = false;
        await _context.SaveChangesAsync();
        await _audit.LogAsync("JMF_DELETE", $"Archived JMF formula: {existing.MutuBeton}");
        return Ok(new { success = true });
    }
}

[ApiController]
[Route("api/users")]
public class UsersController : ControllerBase
{
    private readonly LocalDbContext _context;
    private readonly IAuditRepository _audit;
    private readonly IPasswordHasher _hasher;

    public UsersController(LocalDbContext context, IAuditRepository audit, IPasswordHasher hasher)
    {
        _context = context;
        _audit = audit;
        _hasher = hasher;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var users = await _context.UserAccounts
            .Where(u => u.IsActive)
            .Select(u => new
            {
                u.Id,
                u.Nama,
                u.Nik,
                Jabatan = u.Jabatan.ToString(),
                u.IsActive,
                u.CreatedAt,
                u.UpdatedAt
            })
            .ToListAsync();

        return Ok(users);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UserAccount user)
    {
        if (string.IsNullOrWhiteSpace(user.Nik) || string.IsNullOrWhiteSpace(user.Nama))
        {
            return BadRequest(new { success = false, errorCode = "INVALID_INPUT", message = "NIK dan Nama wajib diisi." });
        }

        user.Id = Guid.NewGuid().ToString();
        user.CreatedAt = DateTime.UtcNow;
        user.IsActive = true;

        // Secure password hashing
        var rawPassword = string.IsNullOrWhiteSpace(user.PasswordHash) ? "1234" : user.PasswordHash;
        user.PasswordHash = _hasher.HashPassword(rawPassword);

        await _context.UserAccounts.AddAsync(user);
        await _context.SaveChangesAsync();
        await _audit.LogAsync("USER_CREATE", $"Created user {user.Nama} ({user.Nik}) with role {user.Jabatan}");

        return Ok(new
        {
            user.Id,
            user.Nama,
            user.Nik,
            Jabatan = user.Jabatan.ToString(),
            user.IsActive
        });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] UserAccount user)
    {
        var existing = await _context.UserAccounts.FindAsync(id);
        if (existing == null) return NotFound(new { success = false, errorCode = "NOT_FOUND", message = "User tidak ditemukan" });

        existing.Nama = user.Nama;
        existing.Nik = user.Nik;
        existing.Jabatan = user.Jabatan;

        if (!string.IsNullOrWhiteSpace(user.PasswordHash))
        {
            // Re-hash updated password
            existing.PasswordHash = _hasher.HashPassword(user.PasswordHash);
        }

        existing.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        await _audit.LogAsync("USER_UPDATE", $"Updated user {existing.Nama} ({existing.Nik})");

        return Ok(new
        {
            existing.Id,
            existing.Nama,
            existing.Nik,
            Jabatan = existing.Jabatan.ToString(),
            existing.IsActive
        });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var existing = await _context.UserAccounts.FindAsync(id);
        if (existing == null) return NotFound(new { success = false, errorCode = "NOT_FOUND", message = "User tidak ditemukan" });

        existing.IsActive = false;
        await _context.SaveChangesAsync();
        await _audit.LogAsync("USER_DELETE", $"Deactivated user {existing.Nama}");
        return Ok(new { success = true });
    }
}

[ApiController]
[Route("api/calibration")]
public class CalibrationController : ControllerBase
{
    private readonly ICalibrationRepository _repo;
    private readonly IAuditRepository _audit;

    public CalibrationController(ICalibrationRepository repo, IAuditRepository audit)
    {
        _repo = repo;
        _audit = audit;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        return Ok(await _repo.GetAllCalibrationsAsync());
    }

    [HttpPost]
    public async Task<IActionResult> Save([FromBody] ScaleCalibration item)
    {
        await _repo.SaveCalibrationAsync(item);
        await _audit.LogAsync("CALIBRATION", $"Updated calibration for scale: {item.ScaleType}");
        return Ok(new { success = true });
    }
}

[ApiController]
[Route("api/alarms")]
public class AlarmsController : ControllerBase
{
    private readonly LocalDbContext _context;
    private readonly IAuditRepository _audit;

    public AlarmsController(LocalDbContext context, IAuditRepository audit)
    {
        _context = context;
        _audit = audit;
    }

    [HttpGet]
    public async Task<IActionResult> GetRecent([FromQuery] int limit = 50)
    {
        var logs = await _context.AlarmLogs.OrderByDescending(x => x.Timestamp).Take(limit).ToListAsync();
        return Ok(logs);
    }

    [HttpPost]
    public async Task<IActionResult> RecordAlarm([FromBody] AlarmLog alarm)
    {
        alarm.Id = Guid.NewGuid().ToString();
        alarm.Timestamp = DateTime.UtcNow;
        await _context.AlarmLogs.AddAsync(alarm);
        await _context.SaveChangesAsync();
        await _audit.LogAsync("ALARM", $"Alarm triggered: {alarm.AlarmCode} - {alarm.Message}");
        return Ok(alarm);
    }

    [HttpPost("acknowledge/{id}")]
    public async Task<IActionResult> Acknowledge(string id, [FromQuery] string user = "OPERATOR")
    {
        var existing = await _context.AlarmLogs.FindAsync(id);
        if (existing == null)
        {
            return NotFound(new { success = false, errorCode = "NOT_FOUND", message = "Alarm tidak ditemukan" });
        }

        existing.IsAcknowledged = true;
        existing.AcknowledgedAt = DateTime.UtcNow;
        existing.AcknowledgedBy = user;
        await _context.SaveChangesAsync();
        await _audit.LogAsync("ALARM_RESET", $"Alarm {existing.AlarmCode} acknowledged by {user}");
        return Ok(new { success = true, alarm = existing });
    }

    [HttpPost("acknowledge/all")]
    public async Task<IActionResult> AcknowledgeAll([FromQuery] string user = "OPERATOR")
    {
        var unack = await _context.AlarmLogs.Where(x => !x.IsAcknowledged).ToListAsync();
        var now = DateTime.UtcNow;
        foreach (var a in unack)
        {
            a.IsAcknowledged = true;
            a.AcknowledgedAt = now;
            a.AcknowledgedBy = user;
        }
        await _context.SaveChangesAsync();
        await _audit.LogAsync("ALARM_RESET_ALL", $"All {unack.Count} alarms acknowledged by {user}");
        return Ok(new { success = true, acknowledgedCount = unack.Count });
    }
}

[ApiController]
[Route("api/audit")]
public class AuditController : ControllerBase
{
    private readonly IAuditRepository _repo;

    public AuditController(IAuditRepository repo)
    {
        _repo = repo;
    }

    [HttpGet]
    public async Task<IActionResult> GetRecent([FromQuery] int limit = 100)
    {
        return Ok(await _repo.GetRecentLogsAsync(limit));
    }
}

[ApiController]
[Route("api/migration")]
public class MigrationController : ControllerBase
{
    private readonly LegacyStorageMigrationService _migrationService;
    private readonly IAuditRepository _audit;

    public MigrationController(LegacyStorageMigrationService migrationService, IAuditRepository audit)
    {
        _migrationService = migrationService;
        _audit = audit;
    }

    [HttpPost("jmf")]
    public async Task<IActionResult> MigrateJmf([FromBody] List<JobMixFormula> list)
    {
        int count = await _migrationService.MigrateJmfAsync(list);
        await _audit.LogAsync("MIGRATION_JMF", $"Migrated {count} JMFs from legacy localStorage");
        return Ok(new { success = true, migrated = count });
    }

    [HttpPost("batches")]
    public async Task<IActionResult> MigrateBatches([FromBody] List<BatchLog> list)
    {
        int count = await _migrationService.MigrateBatchesAsync(list);
        await _audit.LogAsync("MIGRATION_BATCHES", $"Migrated {count} Batches from legacy localStorage");
        return Ok(new { success = true, migrated = count });
    }

    [HttpPost("users")]
    public async Task<IActionResult> MigrateUsers([FromBody] List<UserAccount> list)
    {
        int count = await _migrationService.MigrateUsersAsync(list);
        await _audit.LogAsync("MIGRATION_USERS", $"Migrated {count} Users from legacy localStorage");
        return Ok(new { success = true, migrated = count });
    }
}
