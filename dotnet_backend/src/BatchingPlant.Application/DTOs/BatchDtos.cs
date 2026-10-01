using BatchingPlant.Domain.Entities;
using BatchingPlant.Domain.Enums;

namespace BatchingPlant.Application.DTOs;

public record StartBatchRequest(
    string RecipeId,
    double TargetVolumeM3,
    int MixingCycles,
    string SiloSemen,
    string Pelanggan,
    string Lokasi,
    string NoKendaraan,
    string Sopir,
    string OperatorName,
    BatchingMode Mode = BatchingMode.AUTO,
    double MoisturePasir1Pct = 0.0,
    double MoisturePasir2Pct = 0.0,
    double MoistureBatu1Pct = 0.0,
    double MoistureBatu2Pct = 0.0
);

public record ManualActuatorRequest(
    string ActuatorKey, // e.g. "pasir1", "batu1", "mixer", "conveyor_bawah"
    bool TargetState
);

public record JobMixFormulaDto(
    string Id,
    string MutuBeton,
    double Pasir1,
    double Pasir2,
    double Batu1,
    double Batu2,
    double Semen,
    double Air,
    double Additive,
    double TargetSlump,
    int MixingTime
);

public record BatchProgressUpdateDto(
    string BatchId,
    BatchStatus Status,
    int CurrentCycle,
    int TotalCycles,
    double CurrentCycleVolumeM3,
    double PasirActual,
    double BatuActual,
    double SemenActual,
    double AirActual,
    double AdditiveActual,
    double SlumpEstimated,
    double MixerAmpere,
    double AirPressureBar,
    bool EmergencyStop
);

public record TicketPrintDto(
    string BatchNumber,
    string DateFormatted,
    string TimeFormatted,
    string CompanyName,
    string PlantName,
    string RecipeName,
    double OrderedVolumeM3,
    string Pelanggan,
    string Lokasi,
    string NoKendaraan,
    string Sopir,
    string Operator,
    Dictionary<string, double> TargetWeightsKg,
    Dictionary<string, double> ActualWeightsKg,
    Dictionary<string, double> DeviationsPct,
    double SlumpCm
);

public record SetModeRequest(
    string Mode
);
