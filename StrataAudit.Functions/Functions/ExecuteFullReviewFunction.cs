using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using StrataAudit.Functions.Models;
using StrataAudit.Functions.Services;

namespace StrataAudit.Functions.Functions;

/// <summary>
/// Azure Functions HTTP trigger for AI-powered audit review.
///
/// Endpoint: POST /api/executeFullReview
/// Request body: { files, systemPrompt, fileManifest, previousAudit?, mode?, expectedPlanId? }
/// Response: AuditResponse JSON
/// </summary>
public sealed class ExecuteFullReviewFunction
{
    private readonly IAuditReviewService _reviewService;
    private readonly IConfiguration _config;
    private readonly ILogger<ExecuteFullReviewFunction> _logger;

    public ExecuteFullReviewFunction(
        IAuditReviewService reviewService,
        IConfiguration config,
        ILogger<ExecuteFullReviewFunction> logger)
    {
        _reviewService = reviewService;
        _config = config;
        _logger = logger;
    }

    [Function("executeFullReview")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post")] HttpRequest req,
        CancellationToken cancellationToken)
    {
        try
        {
            // Authenticate: extract userId from Bearer token
            var userId = await TokenHelper.ExtractUserIdAsync(req, _config);

            // Parse request body
            AuditRequest? body;
            try
            {
                body = await JsonSerializer.DeserializeAsync<AuditRequest>(
                    req.Body,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true },
                    cancellationToken);
            }
            catch (JsonException ex)
            {
                _logger.LogWarning("Invalid JSON body: {Error}", ex.Message);
                return new BadRequestObjectResult(new { error = "Missing or invalid JSON body" });
            }

            if (body is null)
            {
                return new BadRequestObjectResult(new { error = "Missing or invalid JSON body" });
            }

            // Validate required fields (same checks as functions/index.js lines 57-72)
            if (string.IsNullOrWhiteSpace(body.SystemPrompt))
            {
                return new BadRequestObjectResult(new { error = "Missing or empty systemPrompt in body" });
            }

            if (body.FileManifest is null)
            {
                return new BadRequestObjectResult(new { error = "Missing or invalid fileManifest in body" });
            }

            if (body.Files is null || body.Files.Count == 0)
            {
                return new BadRequestObjectResult(new { error = "Missing or invalid files array in body" });
            }

            _logger.LogInformation(
                "executeFullReview called by user {UserId}: mode={Mode}, files={FileCount}",
                userId, body.Mode, body.Files.Count);

            // Execute the audit review via GPT-5
            string resultJson = await _reviewService.ExecuteReviewAsync(body, cancellationToken);

            // Return raw JSON (preserves exact schema like the Gemini version)
            return new ContentResult
            {
                Content = resultJson,
                ContentType = "application/json",
                StatusCode = 200,
            };
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Unauthorized executeFullReview attempt");
            return new UnauthorizedResult();
        }
        catch (Exception ex)
        {
            string msg = ex.Message ?? "Audit failed";
            _logger.LogError(ex, "executeFullReview error: {Message}", msg);
            return new ObjectResult(new { error = msg })
            {
                StatusCode = 500,
            };
        }
    }
}
