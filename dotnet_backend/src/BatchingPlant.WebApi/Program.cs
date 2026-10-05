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

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = AppContext.BaseDirectory
});

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
builder.Services.AddScoped<IJmfService, JmfService>();
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

    // Incremental SQLite schema setup for Phase 2.1 tables if database was created by previous phase
    localDb.Database.ExecuteSqlRaw(@"
        CREATE TABLE IF NOT EXISTS ""Materials"" (
            ""Id"" TEXT NOT NULL CONSTRAINT ""PK_Materials"" PRIMARY KEY,
            ""Code"" TEXT NOT NULL,
            ""Name"" TEXT NOT NULL,
            ""MaterialType"" INTEGER NOT NULL,
            ""Unit"" TEXT NOT NULL,
            ""IsActive"" INTEGER NOT NULL,
            ""CreatedAt"" TEXT NOT NULL,
            ""UpdatedAt"" TEXT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Materials_Code"" ON ""Materials"" (""Code"");

        CREATE TABLE IF NOT EXISTS ""Jmfs"" (
            ""Id"" TEXT NOT NULL CONSTRAINT ""PK_Jmfs"" PRIMARY KEY,
            ""Code"" TEXT NOT NULL,
            ""Name"" TEXT NOT NULL,
            ""Description"" TEXT NOT NULL,
            ""TargetVolumeM3"" REAL NOT NULL,
            ""IsActive"" INTEGER NOT NULL,
            ""CurrentVersionId"" TEXT NULL,
            ""CreatedAt"" TEXT NOT NULL,
            ""UpdatedAt"" TEXT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Jmfs_Code"" ON ""Jmfs"" (""Code"");

        CREATE TABLE IF NOT EXISTS ""JmfVersions"" (
            ""Id"" TEXT NOT NULL CONSTRAINT ""PK_JmfVersions"" PRIMARY KEY,
            ""JmfId"" TEXT NOT NULL,
            ""VersionNumber"" INTEGER NOT NULL,
            ""Status"" INTEGER NOT NULL,
            ""TargetSlumpCm"" REAL NOT NULL,
            ""MixingTimeSec"" INTEGER NOT NULL,
            ""Notes"" TEXT NOT NULL,
            ""IsUsedInProduction"" INTEGER NOT NULL,
            ""ActivatedAt"" TEXT NULL,
            ""CreatedAt"" TEXT NOT NULL,
            ""UpdatedAt"" TEXT NULL,
            CONSTRAINT ""FK_JmfVersions_Jmfs_JmfId"" FOREIGN KEY (""JmfId"") REFERENCES ""Jmfs"" (""Id"") ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ""IX_JmfVersions_JmfId_VersionNumber"" ON ""JmfVersions"" (""JmfId"", ""VersionNumber"");

        CREATE TABLE IF NOT EXISTS ""RecipeComponents"" (
            ""Id"" TEXT NOT NULL CONSTRAINT ""PK_RecipeComponents"" PRIMARY KEY,
            ""JmfVersionId"" TEXT NOT NULL,
            ""MaterialId"" TEXT NOT NULL,
            ""TargetQuantity"" TEXT NOT NULL,
            ""Unit"" TEXT NOT NULL,
            ""SequenceOrder"" INTEGER NOT NULL,
            ""TolerancePercentage"" REAL NOT NULL,
            ""CreatedAt"" TEXT NOT NULL,
            ""UpdatedAt"" TEXT NULL,
            CONSTRAINT ""FK_RecipeComponents_JmfVersions_JmfVersionId"" FOREIGN KEY (""JmfVersionId"") REFERENCES ""JmfVersions"" (""Id"") ON DELETE CASCADE,
            CONSTRAINT ""FK_RecipeComponents_Materials_MaterialId"" FOREIGN KEY (""MaterialId"") REFERENCES ""Materials"" (""Id"") ON DELETE RESTRICT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ""IX_RecipeComponents_JmfVersionId_MaterialId"" ON ""RecipeComponents"" (""JmfVersionId"", ""MaterialId"");

        CREATE TABLE IF NOT EXISTS ""BatchJmfSnapshots"" (
            ""Id"" TEXT NOT NULL CONSTRAINT ""PK_BatchJmfSnapshots"" PRIMARY KEY,
            ""BatchLogId"" TEXT NOT NULL,
            ""JmfId"" TEXT NOT NULL,
            ""JmfCode"" TEXT NOT NULL,
            ""JmfName"" TEXT NOT NULL,
            ""JmfVersionId"" TEXT NOT NULL,
            ""VersionNumber"" INTEGER NOT NULL,
            ""TargetVolumeM3"" REAL NOT NULL,
            ""ComponentsJson"" TEXT NOT NULL,
            ""CreatedAt"" TEXT NOT NULL,
            ""UpdatedAt"" TEXT NULL
        );
        CREATE INDEX IF NOT EXISTS ""IX_BatchJmfSnapshots_BatchLogId"" ON ""BatchJmfSnapshots"" (""BatchLogId"");
    ");

    try {
        localDb.Database.ExecuteSqlRaw(@"ALTER TABLE ""BatchLogs"" ADD COLUMN ""JmfSnapshotId"" TEXT NULL;");
    } catch { /* Column already exists */ }

    // Seed default Materials if empty
    if (!localDb.Materials.Any())
    {
        var matPasir1 = new Material { Id = "MAT-PASIR-1", Code = "PASIR-1", Name = "Pasir Kasar Cor", MaterialType = MaterialType.AGGREGATE, Unit = "kg", IsActive = true };
        var matPasir2 = new Material { Id = "MAT-PASIR-2", Code = "PASIR-2", Name = "Pasir Halus", MaterialType = MaterialType.AGGREGATE, Unit = "kg", IsActive = true };
        var matBatu1 = new Material { Id = "MAT-BATU-1", Code = "BATU-1", Name = "Split 1-2 (Batu Pecah)", MaterialType = MaterialType.AGGREGATE, Unit = "kg", IsActive = true };
        var matBatu2 = new Material { Id = "MAT-BATU-2", Code = "BATU-2", Name = "Screening 0.5-1", MaterialType = MaterialType.AGGREGATE, Unit = "kg", IsActive = true };
        var matSemen = new Material { Id = "MAT-SEMEN", Code = "SEMEN", Name = "Semen Portland Tipe 1", MaterialType = MaterialType.CEMENT, Unit = "kg", IsActive = true };
        var matAir = new Material { Id = "MAT-AIR", Code = "AIR", Name = "Air Bersih Batching", MaterialType = MaterialType.WATER, Unit = "kg", IsActive = true };
        var matAdmix = new Material { Id = "MAT-ADMIX", Code = "ADMIX", Name = "Sika ViscoCrete", MaterialType = MaterialType.ADMIXTURE, Unit = "liter", IsActive = true };

        localDb.Materials.AddRange(matPasir1, matPasir2, matBatu1, matBatu2, matSemen, matAir, matAdmix);
        localDb.SaveChanges();
    }

    // Seed default JMFs with Version 1 and components if empty
    if (!localDb.Jmfs.Any())
    {
        void AddDefaultJmf(string code, string name, decimal p1, decimal p2, decimal b1, decimal b2, decimal sem, decimal air, decimal adm)
        {
            var jmfId = Guid.NewGuid().ToString();
            var verId = Guid.NewGuid().ToString();

            var version = new JmfVersion
            {
                Id = verId,
                JmfId = jmfId,
                VersionNumber = 1,
                Status = JmfStatus.ACTIVE,
                TargetSlumpCm = 12.0,
                MixingTimeSec = 15,
                Notes = "Standard mix release",
                IsUsedInProduction = false,
                ActivatedAt = DateTime.UtcNow,
                RecipeComponents = new List<RecipeComponent>
                {
                    new() { JmfVersionId = verId, MaterialId = "MAT-PASIR-1", TargetQuantity = p1, Unit = "kg", SequenceOrder = 1, TolerancePercentage = 2.0 },
                    new() { JmfVersionId = verId, MaterialId = "MAT-PASIR-2", TargetQuantity = p2, Unit = "kg", SequenceOrder = 2, TolerancePercentage = 2.0 },
                    new() { JmfVersionId = verId, MaterialId = "MAT-BATU-1", TargetQuantity = b1, Unit = "kg", SequenceOrder = 3, TolerancePercentage = 2.0 },
                    new() { JmfVersionId = verId, MaterialId = "MAT-BATU-2", TargetQuantity = b2, Unit = "kg", SequenceOrder = 4, TolerancePercentage = 2.0 },
                    new() { JmfVersionId = verId, MaterialId = "MAT-SEMEN", TargetQuantity = sem, Unit = "kg", SequenceOrder = 5, TolerancePercentage = 1.0 },
                    new() { JmfVersionId = verId, MaterialId = "MAT-AIR", TargetQuantity = air, Unit = "kg", SequenceOrder = 6, TolerancePercentage = 1.5 },
                    new() { JmfVersionId = verId, MaterialId = "MAT-ADMIX", TargetQuantity = adm, Unit = "liter", SequenceOrder = 7, TolerancePercentage = 3.0 }
                }
            };

            var jmf = new Jmf
            {
                Id = jmfId,
                Code = code,
                Name = name,
                Description = $"Standar Mutu Beton {code}",
                TargetVolumeM3 = 1.0,
                IsActive = true,
                CurrentVersionId = verId,
                Versions = new List<JmfVersion> { version }
            };

            localDb.Jmfs.Add(jmf);
        }

        AddDefaultJmf("K225", "Mutu Beton K-225 Slump 12", 520, 150, 650, 330, 300, 150, 1.5m);
        AddDefaultJmf("K250", "Mutu Beton K-250 Slump 12", 550, 170, 680, 300, 350, 160, 2.0m);
        AddDefaultJmf("K300", "Mutu Beton K-300 Slump 12", 650, 120, 780, 350, 400, 180, 2.5m);
        localDb.SaveChanges();
    }

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
        var unhashed = localDb.UserAccounts.AsEnumerable().Where(u => !u.PasswordHash.Contains('.')).ToList();
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
