using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using StrataAudit.Functions.Services;

namespace StrataAudit.Functions.Functions;

public sealed class PlanFunctions(
    ICosmosDbService cosmosDb,
    IConfiguration config,
    ILogger<PlanFunctions> logger)
{
    /// <summary>
    /// PUT /api/plans/{planId} — Create or update a plan document.
    /// </summary>
    [Function("UpsertPlan")]
    public async Task<IActionResult> UpsertPlan(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "plans/{planId}")] HttpRequest req,
        string planId,
        CancellationToken ct)
    {
        try
        {
            var userId = await TokenHelper.ExtractUserIdAsync(req, config);
            using var doc = await JsonDocument.ParseAsync(req.Body, cancellationToken: ct);
            await cosmosDb.UpsertPlanAsync(planId, userId, doc.RootElement);
            return new OkObjectResult(new { id = planId, success = true });
        }
        catch (UnauthorizedAccessException ex)
        {
            logger.LogWarning(ex, "Unauthorized plan upsert attempt");
            return new UnauthorizedResult();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to upsert plan {PlanId}", planId);
            return new ObjectResult(new { error = ex.Message }) { StatusCode = 500 };
        }
    }

    /// <summary>
    /// GET /api/plans — List all plans for the authenticated user.
    /// </summary>
    [Function("GetPlans")]
    public async Task<IActionResult> GetPlans(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "plans")] HttpRequest req,
        CancellationToken ct)
    {
        try
        {
            var userId = await TokenHelper.ExtractUserIdAsync(req, config);
            var plans = await cosmosDb.GetPlansForUserAsync(userId);
            return new OkObjectResult(plans);
        }
        catch (UnauthorizedAccessException ex)
        {
            logger.LogWarning(ex, "Unauthorized plan list attempt");
            return new UnauthorizedResult();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to get plans");
            return new ObjectResult(new { error = ex.Message }) { StatusCode = 500 };
        }
    }

    /// <summary>
    /// DELETE /api/plans/{planId} — Delete a plan document.
    /// </summary>
    [Function("DeletePlan")]
    public async Task<IActionResult> DeletePlan(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "plans/{planId}")] HttpRequest req,
        string planId,
        CancellationToken ct)
    {
        try
        {
            var userId = await TokenHelper.ExtractUserIdAsync(req, config);
            await cosmosDb.DeletePlanAsync(planId, userId);
            return new OkObjectResult(new { success = true });
        }
        catch (UnauthorizedAccessException ex)
        {
            logger.LogWarning(ex, "Unauthorized plan delete attempt");
            return new UnauthorizedResult();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to delete plan {PlanId}", planId);
            return new ObjectResult(new { error = ex.Message }) { StatusCode = 500 };
        }
    }
}
