using StrataAudit.Functions.Models;

namespace StrataAudit.Functions.Services;

public interface IBlobStorageService
{
    Task<List<string>> UploadFilesAsync(string userId, string planId, List<FileEntry> files);
    Task<List<FileEntry>> LoadFilesAsync(string userId, string planId, List<string> blobPaths);
    Task DeletePlanFilesAsync(string userId, string planId);
}
