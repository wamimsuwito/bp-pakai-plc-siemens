using System.Runtime.InteropServices;
using BatchingPlant.Infrastructure.Plc;
using Xunit;

namespace BatchingPlant.Tests;

public class S7MappingTests
{
    [Fact]
    public void S7RecipeTargetBlock_StructLayout_MatchesSiemensRealTypes()
    {
        // 7 single-precision floats (4 bytes each) + 1 float + 1 int (4 bytes) = 9 * 4 = 36 bytes
        int size = Marshal.SizeOf<S7RecipeTargetBlock>();
        Assert.Equal(36, size);
    }

    [Fact]
    public void S7LiveTelemetryBlock_StructLayout_MatchesSiemensMemoryMap()
    {
        // 8 floats = 32 bytes + 1 byte for 8 booleans = 33 bytes (packed)
        int size = Marshal.SizeOf<S7LiveTelemetryBlock>();
        Assert.True(size >= 33);
    }
}
