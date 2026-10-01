using BatchingPlant.Application.Services;
using BatchingPlant.Domain.Entities;
using BatchingPlant.Domain.Enums;
using BatchingPlant.Domain.Interfaces;
using BatchingPlant.Infrastructure.Persistence;
using BatchingPlant.Infrastructure.Persistence.Repositories;
using BatchingPlant.Infrastructure.Plc;
using BatchingPlant.Infrastructure.Services;
using BatchingPlant.Infrastructure.Sync;
using BatchingPlant.WebApi.Hubs;
using BatchingPlant.WebApi.Services;
using Microsoft.EntityFrameworkCore;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// 1. Storage Paths Initialization & Directory Creation
var storagePath = new StoragePathService(builder.Configuration);
builder.Services.AddSingleton<IStoragePathService>(storagePath);

// 2. Serilog Setup with Console & Rolling File Sinks in D:\BatchingPlant\Logs\
var logFilePattern = Path.Combine(storagePath.LogsDirectory, "batching-hmi-.log");
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .WriteTo.Console()
    .WriteTo.File(logFilePattern, rollingInterval: RollingInterval.Day, retainedFileCountLimit: 30)
    .CreateLogger();

builder.Host.UseSerilog();

Log.Information("Batching Plant Storage Root initialized at: {RootPath}", storagePath.RootPath);
Log.Information("SQLite Database Target Path: {DatabasePath}", storagePath.DatabaseFilePath);
Log.Information("Logs Target Path: {LogsPath}", logFilePattern);

// 3. Database Registration (Local SQLite on D:\BatchingPlant\Database\batchingplant.db + Central PostgreSQL)
var sqliteConn = $"Data Source={storagePath.DatabaseFilePath};Cache=Shared;Mode=ReadWriteCreate";
builder.Services.AddDbContext<LocalDbContext>(options =>
    options.UseSqlite(sqliteConn));

var postgresConn = builder.Configuration.GetConnectionString("CentralPostgres") ?? "Host=localhost;Database=batching_central;Username=postgres;Password=postgres";
builder.Services.AddDbContext<CentralDbContext>(options =>
    options.UseNpgsql(postgresConn));

// 4. Security & Password Hashing
builder.Services.AddSingleton<IPasswordHasher, Pbkdf2PasswordHasher>();

// 5. Register Domain & Infrastructure Services via Dependency Injection
var explicitSim = builder.Configuration.GetValue<bool>("BatchingPlant:Control:ExplicitSimulationMode", false);
var legacyArduino = builder.Configuration.GetValue<bool>("BatchingPlant:Control:LegacyArduinoControlEnabled", false);

Log.Information("Machine Control Configuration: ExplicitSimulationMode={Sim}, LegacyArduinoControlEnabled={Arduino}", 
    explicitSim, legacyArduino);

if (explicitSim)
{
    Log.Warning("CAUTION: Running in EXPLICIT SIMULATION MODE. Physical S7-1200 communication is bypassed.");
    builder.Services.AddSingleton<SimulatedPlcClient>();
    builder.Services.AddSingleton<IPlcClient>(sp => sp.GetRequiredService<SimulatedPlcClient>());
    builder.Services.AddSingleton<ISiemensS7Service>(sp => (ISiemensS7Service)sp.GetRequiredService<SiemensS71200Driver>());
}
else
{
    builder.Services.AddSingleton<SiemensS71200Driver>();
    builder.Services.AddSingleton<ISiemensS7Service>(sp => sp.GetRequiredService<SiemensS71200Driver>());
    builder.Services.AddSingleton<IPlcClient>(sp => sp.GetRequiredService<SiemensS71200Driver>());
}

builder.Services.AddScoped<IBatchRepository, BatchRepository>();
builder.Services.AddScoped<IAuditRepository, AuditRepository>();
builder.Services.AddScoped<ICalibrationRepository, CalibrationRepository>();
builder.Services.AddScoped<IBackupService, BackupService>();
builder.Services.AddScoped<LegacyStorageMigrationService>();
builder.Services.AddScoped<ISyncEngine, SyncEngine>();
builder.Services.AddSingleton<IBatchExecutionService, BatchExecutionService>();

// 6. Background Services (Replication & PLC High-Speed Telemetry Broadcaster)
builder.Services.AddHostedService<AutoSyncBackgroundService>();
builder.Services.AddHostedService<PlcTelemetryBroadcaster>();

// 7. SignalR for real-time SCADA animation & Web API
builder.Services.AddSignalR();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// 8. CORS Policy for React HMI on Vite & Electron
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowHmiClients", policy =>
    {
        policy.WithOrigins("http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// 9. Database Initialization & Secure Seeding on Startup
using (var scope = app.Services.CreateScope())
{
    var localDb = scope.ServiceProvider.GetRequiredService<LocalDbContext>();
    var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();

    localDb.Database.EnsureCreated();

    // Seed default JMF recipes if empty
    if (!localDb.JobMixFormulas.Any())
    {
        localDb.JobMixFormulas.AddRange(
            new JobMixFormula { MutuBeton = "K225", Pasir1Target = 520, Pasir2Target = 150, Batu1Target = 650, Batu2Target = 330, SemenTarget = 300, AirTarget = 150, AdditiveTarget = 1.5 },
            new JobMixFormula { MutuBeton = "K250", Pasir1Target = 550, Pasir2Target = 170, Batu1Target = 680, Batu2Target = 300, SemenTarget = 350, AirTarget = 160, AdditiveTarget = 2.0 },
            new JobMixFormula { MutuBeton = "K300", Pasir1Target = 650, Pasir2Target = 120, Batu1Target = 780, Batu2Target = 350, SemenTarget = 400, AirTarget = 180, AdditiveTarget = 2.5 }
        );
    }

    // Seed default User Accounts if empty with PBKDF2 cryptographic hashes
    if (!localDb.UserAccounts.Any())
    {
        localDb.UserAccounts.AddRange(
            new UserAccount { Nama = "Administrator Utama", Nik = "12001", Jabatan = UserRole.ADMIN, PasswordHash = hasher.HashPassword("admin") },
            new UserAccount { Nama = "Andi Saputra", Nik = "12002", Jabatan = UserRole.OPERATOR, PasswordHash = hasher.HashPassword("1234") },
            new UserAccount { Nama = "Direktur Farika", Nik = "12004", Jabatan = UserRole.DIREKTUR, PasswordHash = hasher.HashPassword("dir") }
        );
    }
    else
    {
        // Automatically upgrade any legacy unhashed accounts
        var unhashed = localDb.UserAccounts.Where(u => !u.PasswordHash.Contains('.')).ToList();
        foreach (var u in unhashed)
        {
            u.PasswordHash = hasher.HashPassword(u.PasswordHash);
        }
    }

    localDb.SaveChanges();
}

app.UseSerilogRequestLogging();
app.UseCors("AllowHmiClients");

app.MapControllers();
app.MapHub<BatchingHub>("/hubs/batching");

// Connect to Siemens S7-1200 PLC on startup (if not in explicit simulation)
if (!explicitSim)
{
    var plcService = app.Services.GetRequiredService<ISiemensS7Service>();
    var s7Config = app.Configuration.GetSection("SiemensS7");
    var plcIp = s7Config["IpAddress"] ?? "192.168.0.1";
    var plcRack = int.Parse(s7Config["Rack"] ?? "0");
    var plcSlot = int.Parse(s7Config["Slot"] ?? "1");
    _ = Task.Run(async () => await plcService.ConnectAsync(plcIp, plcRack, plcSlot));
}

Log.Information("ASP.NET Core .NET 10 Batching Plant Production Backend running.");
app.Run();
