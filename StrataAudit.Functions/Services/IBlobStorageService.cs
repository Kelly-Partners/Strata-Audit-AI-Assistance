using StrataAudit.Functions.Models;

namespace StrataAudit.Functions.Services;

public interface IBlobStorageService
{
    Task<List<string>> UploadFilesAsync(string userId, string planId, List<FileEntry> files);
    Task<List<FileEntry>> LoadFilesAsync(string userId, string planId, List<string> blobPaths);
    Task DeletePlanFilesAsync(string userId, string planId);

    /// <summary>
    /// Generate a time-limited read-only SAS URL for a blob.
    /// Used by the frontend to display PDFs in iframes without auth headers.
    /// </summary>
    Task<string> GenerateReadUrlAsync(string userId, string planId, string blobPath, TimeSpan? expiry = null);
}
