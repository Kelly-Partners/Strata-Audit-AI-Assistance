using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using StrataAudit.Functions.Models;
using StrataAudit.Functions.Services;

namespace StrataAudit.Functions.Functions;

public sealed class PlanFileFunctions(
    IBlobStorageService blobService,
    IConfiguration config,
    ILogger<PlanFileFunctions> logger)
{
    /// <summary>
    /// POST /api/plans/{planId}/files — Upload files for a plan.
    /// Body: { "files": [{ "name", "data" (base64), "mimeType" }] }
    /// </summary>
    [Function("UploadPlanFiles")]
    public async Task<IActionResult> UploadFiles(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "plans/{planId}/files")] HttpRequest req,
        string planId,
        CancellationToken ct)
    {
        try
        {
            var userId = await TokenHelper.ExtractUserIdAsync(req, config);

            var body = await JsonSerializer.DeserializeAsync<FileUploadRequest>(req.Body,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }, ct);

            if (body?.Files is null || body.Files.Count == 0)
                return new BadRequestObjectResult(new { error = "At least one file is required." });

            var paths = await blobService.UploadFilesAsync(userId, planId, body.Files);
            return new OkObjectResult(new { filePaths = paths });
        }
        catch (UnauthorizedAccessException ex)
        {
            logger.LogWarning(ex, "Unauthorized file upload attempt");
            return new UnauthorizedResult();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to upload files for plan {PlanId}", planId);
            return new ObjectResult(new { error = ex.Message }) { StatusCode = 500 };
        }
    }

    /// <summary>
    /// POST /api/plans/{planId}/files/load — Load files by blob paths.
    /// Body: { "filePaths": ["users/uid/plans/pid/file.pdf", ...] }
    /// </summary>
    [Function("LoadPlanFiles")]
    public async Task<IActionResult> LoadFiles(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "plans/{planId}/files/load")] HttpRequest req,
        string planId,
        CancellationToken ct)
    {
        try
        {
            var userId = await TokenHelper.ExtractUserIdAsync(req, config);

            var body = await JsonSerializer.DeserializeAsync<FileLoadRequest>(req.Body,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }, ct);

            if (body?.FilePaths is null || body.FilePaths.Count == 0)
                return new OkObjectResult(new { files = Array.Empty<object>() });

            var files = await blobService.LoadFilesAsync(userId, planId, body.FilePaths);
            return new OkObjectResult(new { files });
        }
        catch (UnauthorizedAccessException ex)
        {
            logger.LogWarning(ex, "Unauthorized file load attempt");
            return new UnauthorizedResult();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to load files for plan {PlanId}", planId);
            return new ObjectResult(new { error = ex.Message }) { StatusCode = 500 };
        }
    }

    /// <summary>
    /// POST /api/plans/{planId}/files/url — Generate a time-limited SAS URL for a blob.
    /// Body: { "blobPath": "users/{userId}/plans/{planId}/file.pdf" }
    /// Returns: { "url": "https://...?sv=...&sig=..." }
    /// </summary>
    [Function("GetFileUrl")]
    public async Task<IActionResult> GetFileUrl(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "plans/{planId}/files/url")] HttpRequest req,
        string planId,
        CancellationToken ct)
    {
        try
        {
            var userId = await TokenHelper.ExtractUserIdAsync(req, config);

            var body = await JsonSerializer.DeserializeAsync<FileUrlRequest>(req.Body,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }, ct);

            if (string.IsNullOrWhiteSpace(body?.BlobPath))
                return new BadRequestObjectResult(new { error = "blobPath is required." });

            var url = await blobService.GenerateReadUrlAsync(userId, planId, body.BlobPath);
            return new OkObjectResult(new { url });
        }
        catch (UnauthorizedAccessException ex)
        {
            logger.LogWarning(ex, "Unauthorized file URL request");
            return new UnauthorizedResult();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to generate file URL for plan {PlanId}", planId);
            return new ObjectResult(new { error = ex.Message }) { StatusCode = 500 };
        }
    }

    /// <summary>
    /// DELETE /api/plans/{planId}/files — Delete all files for a plan.
    /// </summary>
    [Function("DeletePlanFiles")]
    public async Task<IActionResult> DeleteFiles(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "plans/{planId}/files")] HttpRequest req,
        string planId,
        CancellationToken ct)
    {
        try
        {
            var userId = await TokenHelper.ExtractUserIdAsync(req, config);
            await blobService.DeletePlanFilesAsync(userId, planId);
            return new OkObjectResult(new { success = true });
        }
        catch (UnauthorizedAccessException ex)
        {
            logger.LogWarning(ex, "Unauthorized file delete attempt");
            return new UnauthorizedResult();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to delete files for plan {PlanId}", planId);
            return new ObjectResult(new { error = ex.Message }) { StatusCode = 500 };
        }
    }
}
