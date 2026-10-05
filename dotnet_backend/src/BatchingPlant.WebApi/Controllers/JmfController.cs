using BatchingPlant.Application.DTOs;
using BatchingPlant.Application.Services;
using BatchingPlant.Domain.Enums;
using Microsoft.AspNetCore.Mvc;

namespace BatchingPlant.WebApi.Controllers;

[ApiController]
[Route("api/jmf")]
public class JmfController : ControllerBase
{
    private readonly IJmfService _jmfService;

    public JmfController(IJmfService jmfService)
    {
        _jmfService = jmfService;
    }

    private (bool Allowed, string? ErrorMessage) CheckRolePermission(string requiredRole = "SUPERVISOR")
    {
        // Extract role from header or query param for RBAC
        var roleHeader = Request.Headers["X-User-Role"].FirstOrDefault() 
            ?? Request.Query["role"].FirstOrDefault() 
            ?? "OPERATOR";

        if (Enum.TryParse<UserRole>(roleHeader.ToUpper(), out var role))
        {
            if (requiredRole == "SUPERVISOR" && (role == UserRole.SUPERVISOR || role == UserRole.ADMIN || role == UserRole.DIREKTUR))
                return (true, null);

            if (requiredRole == "ADMIN" && role == UserRole.ADMIN)
                return (true, null);
        }

        return (false, $"FORBIDDEN_ROLE: Role '{roleHeader}' tidak memiliki izin untuk operasi ini. Memerlukan role {requiredRole} atau lebih tinggi.");
    }

    private string GetUsername()
    {
        return Request.Headers["X-User-Name"].FirstOrDefault() 
            ?? Request.Query["user"].FirstOrDefault() 
            ?? "OPERATOR";
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] bool? activeOnly, CancellationToken ct)
    {
        var list = await _jmfService.GetAllJmfsAsync(activeOnly, ct);
        return Ok(list);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(string id, CancellationToken ct)
    {
        var jmf = await _jmfService.GetJmfByIdAsync(id, ct);
        if (jmf == null)
            return NotFound(new { success = false, errorCode = "NOT_FOUND", message = $"JMF dengan ID '{id}' tidak ditemukan." });

        return Ok(jmf);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateJmfRequest request, CancellationToken ct)
    {
        var (allowed, errorMsg) = CheckRolePermission("SUPERVISOR");
        if (!allowed)
            return StatusCode(403, new { success = false, errorCode = "FORBIDDEN", message = errorMsg });

        try
        {
            var created = await _jmfService.CreateJmfAsync(request, GetUsername(), ct);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { success = false, errorCode = "VALIDATION_ERROR", message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { success = false, errorCode = "OPERATION_ERROR", message = ex.Message });
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] UpdateJmfRequest request, CancellationToken ct)
    {
        var (allowed, errorMsg) = CheckRolePermission("SUPERVISOR");
        if (!allowed)
            return StatusCode(403, new { success = false, errorCode = "FORBIDDEN", message = errorMsg });

        try
        {
            var updated = await _jmfService.UpdateJmfAsync(id, request, GetUsername(), ct);
            return Ok(updated);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { success = false, errorCode = "NOT_FOUND", message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { success = false, errorCode = "VALIDATION_ERROR", message = ex.Message });
        }
    }

    #region Versions

    [HttpGet("{id}/versions")]
    public async Task<IActionResult> GetVersions(string id, CancellationToken ct)
    {
        var versions = await _jmfService.GetVersionsAsync(id, ct);
        return Ok(versions);
    }

    [HttpGet("{id}/versions/{versionId}")]
    public async Task<IActionResult> GetVersionById(string id, string versionId, CancellationToken ct)
    {
        var version = await _jmfService.GetVersionByIdAsync(id, versionId, ct);
        if (version == null)
            return NotFound(new { success = false, errorCode = "NOT_FOUND", message = "Version tidak ditemukan." });

        return Ok(version);
    }

    [HttpPost("{id}/versions")]
    public async Task<IActionResult> CreateVersion(string id, [FromBody] CreateJmfVersionRequest request, CancellationToken ct)
    {
        var (allowed, errorMsg) = CheckRolePermission("SUPERVISOR");
        if (!allowed)
            return StatusCode(403, new { success = false, errorCode = "FORBIDDEN", message = errorMsg });

        try
        {
            var created = await _jmfService.CreateVersionAsync(id, request, GetUsername(), ct);
            return Ok(created);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { success = false, errorCode = "NOT_FOUND", message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { success = false, errorCode = "VALIDATION_ERROR", message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { success = false, errorCode = "OPERATION_ERROR", message = ex.Message });
        }
    }

    [HttpPut("{id}/versions/{versionId}")]
    public async Task<IActionResult> UpdateVersion(string id, string versionId, [FromBody] UpdateJmfVersionRequest request, CancellationToken ct)
    {
        var (allowed, errorMsg) = CheckRolePermission("SUPERVISOR");
        if (!allowed)
            return StatusCode(403, new { success = false, errorCode = "FORBIDDEN", message = errorMsg });

        try
        {
            var updated = await _jmfService.UpdateVersionAsync(id, versionId, request, GetUsername(), ct);
            return Ok(updated);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { success = false, errorCode = "NOT_FOUND", message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { success = false, errorCode = "IMMUTABILITY_ERROR", message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { success = false, errorCode = "VALIDATION_ERROR", message = ex.Message });
        }
    }

    [HttpPost("{id}/versions/{versionId}/activate")]
    public async Task<IActionResult> ActivateVersion(string id, string versionId, CancellationToken ct)
    {
        var (allowed, errorMsg) = CheckRolePermission("SUPERVISOR");
        if (!allowed)
            return StatusCode(403, new { success = false, errorCode = "FORBIDDEN", message = errorMsg });

        try
        {
            var activated = await _jmfService.ActivateVersionAsync(id, versionId, GetUsername(), ct);
            return Ok(new { success = true, version = activated, message = $"Version {activated.VersionNumber} berhasil diaktifkan untuk produksi." });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { success = false, errorCode = "NOT_FOUND", message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { success = false, errorCode = "ACTIVATION_FAILED", message = ex.Message });
        }
    }

    [HttpPost("{id}/versions/{versionId}/deactivate")]
    public async Task<IActionResult> DeactivateVersion(string id, string versionId, CancellationToken ct)
    {
        var (allowed, errorMsg) = CheckRolePermission("SUPERVISOR");
        if (!allowed)
            return StatusCode(403, new { success = false, errorCode = "FORBIDDEN", message = errorMsg });

        try
        {
            var deactivated = await _jmfService.DeactivateVersionAsync(id, versionId, GetUsername(), ct);
            return Ok(new { success = true, version = deactivated, message = $"Version {deactivated.VersionNumber} berhasil dinonaktifkan." });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { success = false, errorCode = "NOT_FOUND", message = ex.Message });
        }
    }

    #endregion

    #region Snapshot

    [HttpGet("snapshot/batch/{batchLogId}")]
    public async Task<IActionResult> GetSnapshot(string batchLogId, CancellationToken ct)
    {
        var snapshot = await _jmfService.GetSnapshotByBatchLogIdAsync(batchLogId, ct);
        if (snapshot == null)
            return NotFound(new { success = false, errorCode = "NOT_FOUND", message = "Snapshot JMF untuk batch ini tidak ditemukan." });

        return Ok(snapshot);
    }

    #endregion
}
