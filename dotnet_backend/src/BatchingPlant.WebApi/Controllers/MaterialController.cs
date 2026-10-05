using BatchingPlant.Application.DTOs;
using BatchingPlant.Application.Services;
using BatchingPlant.Domain.Enums;
using Microsoft.AspNetCore.Mvc;

namespace BatchingPlant.WebApi.Controllers;

[ApiController]
[Route("api/materials")]
public class MaterialController : ControllerBase
{
    private readonly IJmfService _jmfService;

    public MaterialController(IJmfService jmfService)
    {
        _jmfService = jmfService;
    }

    private (bool Allowed, string? ErrorMessage) CheckRolePermission(string requiredRole = "SUPERVISOR")
    {
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
        var list = await _jmfService.GetMaterialsAsync(activeOnly, ct);
        return Ok(list);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(string id, CancellationToken ct)
    {
        var mat = await _jmfService.GetMaterialByIdAsync(id, ct);
        if (mat == null)
            return NotFound(new { success = false, errorCode = "NOT_FOUND", message = $"Material dengan ID '{id}' tidak ditemukan." });

        return Ok(mat);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateMaterialRequest request, CancellationToken ct)
    {
        var (allowed, errorMsg) = CheckRolePermission("SUPERVISOR");
        if (!allowed)
            return StatusCode(403, new { success = false, errorCode = "FORBIDDEN", message = errorMsg });

        try
        {
            var created = await _jmfService.CreateMaterialAsync(request, GetUsername(), ct);
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
    public async Task<IActionResult> Update(string id, [FromBody] UpdateMaterialRequest request, CancellationToken ct)
    {
        var (allowed, errorMsg) = CheckRolePermission("SUPERVISOR");
        if (!allowed)
            return StatusCode(403, new { success = false, errorCode = "FORBIDDEN", message = errorMsg });

        try
        {
            var updated = await _jmfService.UpdateMaterialAsync(id, request, GetUsername(), ct);
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
}
