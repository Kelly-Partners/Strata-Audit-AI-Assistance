using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Sas;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using StrataAudit.Functions.Models;

namespace StrataAudit.Functions.Services;

public sealed class BlobStorageService : IBlobStorageService
{
    private readonly BlobContainerClient _containerClient;
    private readonly ILogger<BlobStorageService> _logger;

    public BlobStorageService(IConfiguration config, ILogger<BlobStorageService> logger)
    {
        _logger = logger;

        var connectionString = config["AZURE_STORAGE_CONNECTION_STRING"]
            ?? throw new InvalidOperationException("AZURE_STORAGE_CONNECTION_STRING not configured.");
        var containerName = config["AZURE_STORAGE_CONTAINER"] ?? "plan-files";

        var blobServiceClient = new BlobServiceClient(connectionString);
        _containerClient = blobServiceClient.GetBlobContainerClient(containerName);
    }

    public async Task<List<string>> UploadFilesAsync(string userId, string planId, List<FileEntry> files)
    {
        var basePath = $"users/{userId}/plans/{planId}";
        var paths = new List<string>();

        for (var i = 0; i < files.Count; i++)
        {
            var file = files[i];
            var safeName = SafeFileName(file.Name, i);
            var blobPath = $"{basePath}/{safeName}";

            var blobClient = _containerClient.GetBlobClient(blobPath);
            var data = Convert.FromBase64String(file.Data);

            await blobClient.UploadAsync(
                new BinaryData(data),
                new BlobUploadOptions
                {
                    HttpHeaders = new BlobHttpHeaders
                    {
                        ContentType = file.MimeType ?? "application/octet-stream"
                    }
                });

            paths.Add(blobPath);
        }

        _logger.LogInformation("Uploaded {Count} files for plan {PlanId}", files.Count, planId);
        return paths;
    }

    public async Task<List<FileEntry>> LoadFilesAsync(string userId, string planId, List<string> blobPaths)
    {
        var prefix = $"users/{userId}/plans/{planId}/";
        var results = new List<FileEntry>();

        foreach (var path in blobPaths)
        {
            // Security: ensure the path belongs to this user's plan
            if (!path.StartsWith(prefix, StringComparison.Ordinal))
            {
                _logger.LogWarning("Skipping unauthorized blob path: {Path}", path);
                continue;
            }

            try
            {
                var blobClient = _containerClient.GetBlobClient(path);
                var response = await blobClient.DownloadContentAsync();
                var data = Convert.ToBase64String(response.Value.Content.ToArray());
                var fileName = path.Split('/').Last();
                var contentType = response.Value.Details.ContentType ?? "application/octet-stream";

                results.Add(new FileEntry
                {
                    Name = fileName,
                    Data = data,
                    MimeType = contentType
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to download blob: {Path}", path);
            }
        }

        _logger.LogInformation("Loaded {Count} files for plan {PlanId}", results.Count, planId);
        return results;
    }

    public async Task DeletePlanFilesAsync(string userId, string planId)
    {
        var prefix = $"users/{userId}/plans/{planId}/";
        var count = 0;

        await foreach (var blob in _containerClient.GetBlobsAsync(BlobTraits.None, BlobStates.None, prefix, CancellationToken.None))
        {
            await _containerClient.DeleteBlobAsync(blob.Name);
            count++;
        }

        _logger.LogInformation("Deleted {Count} files for plan {PlanId}", count, planId);
    }

    public Task<string> GenerateReadUrlAsync(string userId, string planId, string blobPath, TimeSpan? expiry = null)
    {
        var prefix = $"users/{userId}/plans/{planId}/";
        if (!blobPath.StartsWith(prefix, StringComparison.Ordinal))
            throw new UnauthorizedAccessException($"Blob path does not belong to user's plan.");

        var blobClient = _containerClient.GetBlobClient(blobPath);

        if (!blobClient.CanGenerateSasUri)
            throw new InvalidOperationException("Storage client cannot generate SAS URIs. Ensure connection string includes account key.");

        var sasUri = blobClient.GenerateSasUri(
            BlobSasPermissions.Read,
            DateTimeOffset.UtcNow.Add(expiry ?? TimeSpan.FromHours(1)));

        _logger.LogInformation("Generated SAS URL for blob: {Path}", blobPath);
        return Task.FromResult(sasUri.ToString());
    }

    private static string SafeFileName(string name, int index)
    {
        var safe = System.Text.RegularExpressions.Regex.Replace(name, @"[^a-zA-Z0-9._\-]", "_");
        return index > 0 ? $"{index}_{safe}" : safe;
    }
}
