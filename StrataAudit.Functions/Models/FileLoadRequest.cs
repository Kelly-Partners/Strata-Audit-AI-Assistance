using System.Text.Json.Serialization;

namespace StrataAudit.Functions.Models;

public sealed class FileLoadRequest
{
    [JsonPropertyName("filePaths")]
    public List<string> FilePaths { get; set; } = [];
}

public sealed class FileUploadRequest
{
    [JsonPropertyName("files")]
    public List<FileEntry> Files { get; set; } = [];

    [JsonPropertyName("runId")]
    public string? RunId { get; set; }
}

public sealed class FileUrlRequest
{
    [JsonPropertyName("blobPath")]
    public string BlobPath { get; set; } = string.Empty;
}
