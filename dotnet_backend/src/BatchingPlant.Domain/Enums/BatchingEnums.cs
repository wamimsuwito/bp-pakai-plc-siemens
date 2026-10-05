namespace BatchingPlant.Domain.Enums;

public enum BatchingMode
{
    MANUAL = 0,
    SEMI_AUTO = 1,
    AUTO = 2
}

public enum BatchStatus
{
    IDLE = 0,
    WEIGHING = 1,
    WAITING_HOPPER = 2,
    MIXING = 3,
    DISCHARGING = 4,
    COMPLETED = 5,
    PAUSED = 6,
    ABORTED = 7
}

public enum UserRole
{
    OPERATOR = 0,
    SUPERVISOR = 1,
    LOGISTIK = 2,
    ADMIN = 3,
    DIREKTUR = 4
}

public enum AlarmSeverity
{
    INFO = 0,
    WARNING = 1,
    CRITICAL = 2,
    EMERGENCY = 3
}

public enum MaterialType
{
    AGGREGATE = 0,
    CEMENT = 1,
    WATER = 2,
    ADMIXTURE = 3
}

public enum JmfStatus
{
    DRAFT = 0,
    ACTIVE = 1,
    INACTIVE = 2,
    ARCHIVED = 3
}
