using System.Text.Json;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace StrataAudit.Functions.Services;

public sealed class CosmosDbService : ICosmosDbService
{
    private readonly Container _container;
    private readonly ILogger<CosmosDbService> _logger;

    public CosmosDbService(IConfiguration config, ILogger<CosmosDbService> logger)
    {
        _logger = logger;

        var endpoint = config["AZURE_COSMOS_ENDPOINT"]
            ?? throw new InvalidOperationException("AZURE_COSMOS_ENDPOINT not configured.");
        var key = config["AZURE_COSMOS_KEY"]
            ?? throw new InvalidOperationException("AZURE_COSMOS_KEY not configured.");
        var databaseId = config["AZURE_COSMOS_DATABASE"] ?? "strata-audit";

        var client = new CosmosClient(endpoint, key, new CosmosClientOptions
        {
            SerializerOptions = new CosmosSerializationOptions
            {
                PropertyNamingPolicy = CosmosPropertyNamingPolicy.CamelCase
            }
        });
        _container = client.GetContainer(databaseId, "plans");
    }

    public async Task UpsertPlanAsync(string planId, string userId, JsonElement planData)
    {
        // Merge the incoming JSON with required fields (id, userId, updatedAt)
        using var doc = JsonDocument.Parse(planData.GetRawText());
        var dict = new Dictionary<string, object?>();

        foreach (var prop in doc.RootElement.EnumerateObject())
        {
            dict[prop.Name] = prop.Value.Clone();
        }

        dict["id"] = planId;
        dict["userId"] = userId;
        dict["updatedAt"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        var json = JsonSerializer.Serialize(dict);
        using var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(json));

        await _container.UpsertItemStreamAsync(stream, new PartitionKey(userId));
        _logger.LogInformation("Upserted plan {PlanId} for user {UserId}", planId, userId);
    }

    public async Task<List<JsonElement>> GetPlansForUserAsync(string userId)
    {
        var query = new QueryDefinition("SELECT * FROM c WHERE c.userId = @userId ORDER BY c.createdAt DESC")
            .WithParameter("@userId", userId);

        var results = new List<JsonElement>();
        // Use stream iterator to control JsonDocument lifecycle — the typed iterator
        // recycles its internal buffers, making JsonElement values invalid before
        // we can even clone them.
        using var iterator = _container.GetItemQueryStreamIterator(query,
            requestOptions: new QueryRequestOptions { PartitionKey = new PartitionKey(userId) });

        while (iterator.HasMoreResults)
        {
            using var response = await iterator.ReadNextAsync();
            if (!response.IsSuccessStatusCode) continue;

            using var doc = await JsonDocument.ParseAsync(response.Content);
            foreach (var element in doc.RootElement.GetProperty("Documents").EnumerateArray())
                results.Add(element.Clone());
        }

        _logger.LogInformation("Retrieved {Count} plans for user {UserId}", results.Count, userId);
        return results;
    }

    public async Task DeletePlanAsync(string planId, string userId)
    {
        await _container.DeleteItemAsync<object>(planId, new PartitionKey(userId));
        _logger.LogInformation("Deleted plan {PlanId} for user {UserId}", planId, userId);
    }
}
