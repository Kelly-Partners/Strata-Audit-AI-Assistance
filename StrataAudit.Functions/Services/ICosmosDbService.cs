using System.Text.Json;

namespace StrataAudit.Functions.Services;

public interface ICosmosDbService
{
    Task UpsertPlanAsync(string planId, string userId, JsonElement planData);
    Task<List<JsonElement>> GetPlansForUserAsync(string userId);
    Task DeletePlanAsync(string planId, string userId);
}
