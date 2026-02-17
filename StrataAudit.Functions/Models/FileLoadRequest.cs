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
}
