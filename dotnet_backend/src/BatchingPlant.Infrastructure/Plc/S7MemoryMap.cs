using System.Runtime.InteropServices;

namespace BatchingPlant.Infrastructure.Plc;

public static class S7MemoryMap
{
    // DB Numbers in Siemens S7-1200 TIA Portal
    public const int DB_CONTROL_STATUS = 1;
    public const int DB_RECIPE_TARGETS = 2;
    public const int DB_LIVE_TELEMETRY = 3;
    public const int DB_ACTUATOR_FEEDBACK = 4;
}

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public class S7ControlStatusBlock
{
    public bool StartCmd { get; set; }
    public bool PauseCmd { get; set; }
    public bool ResumeCmd { get; set; }
    public bool EstopCmd { get; set; }
    public bool ModeAuto { get; set; }
    public bool ModeSemiAuto { get; set; }
    public bool ModeManual { get; set; }
    public bool SpareBit7 { get; set; }

    public byte HeartbeatWatchdog { get; set; }
    public ushort StatusCode { get; set; }
    public ushort AlarmCode { get; set; }
}

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public class S7RecipeTargetBlock
{
    public float TargetPasir1 { get; set; }
    public float TargetPasir2 { get; set; }
    public float TargetBatu1 { get; set; }
    public float TargetBatu2 { get; set; }
    public float TargetSemen { get; set; }
    public float TargetAir { get; set; }
    public float TargetAdditive { get; set; }
    public float TargetSlump { get; set; }
    public int MixingTimeSec { get; set; }
}

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public class S7LiveTelemetryBlock
{
    public float WeightAggregate { get; set; }
    public float WeightCement { get; set; }
    public float WeightWater { get; set; }
    public float WeightAdditive { get; set; }
    public float WeightWaitingHopper { get; set; }
    public float AirPressureBar { get; set; }
    public float MixerAmpere { get; set; }
    public float SlumpEstimated { get; set; }

    public bool EstopInput { get; set; }
    public bool TruckDetected { get; set; }
    public bool DriverConsentButton { get; set; }
    public bool SpareInput3 { get; set; }
    public bool SpareInput4 { get; set; }
    public bool SpareInput5 { get; set; }
    public bool SpareInput6 { get; set; }
    public bool SpareInput7 { get; set; }
}

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public class S7ActuatorFeedbackBlock
{
    public bool MixerMotorOn { get; set; }
    public bool ConveyorUpperOn { get; set; }
    public bool ConveyorBottomOn { get; set; }
    public bool CompressorOn { get; set; }
    public bool GatePasir1Open { get; set; }
    public bool GatePasir2Open { get; set; }
    public bool GateBatu1Open { get; set; }
    public bool GateBatu2Open { get; set; }

    public bool DumpPasirOpen { get; set; }
    public bool DumpBatuOpen { get; set; }
    public bool DumpSemenOpen { get; set; }
    public bool DumpWaterOpen { get; set; }
    public bool VibratorOn { get; set; }
    public bool HornOn { get; set; }
    public bool WaitingHopperGateOpen { get; set; }
    public bool MixerDoorOpen { get; set; }

    public bool MixerDoorClose { get; set; }
    public byte ActiveSiloNumber { get; set; }
}
