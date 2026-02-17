using System.Text.Json.Serialization;

namespace StrataAudit.Functions.Models;

/// <summary>
/// Request DTO received from the frontend.
/// Matches the body sent by src/services/auditApi.ts callExecuteFullReview().
/// </summary>
public sealed class AuditRequest
{
    [JsonPropertyName("files")]
    public List<FileEntry> Files { get; set; } = [];

    [JsonPropertyName("systemPrompt")]
    public string SystemPrompt { get; set; } = string.Empty;

    [JsonPropertyName("fileManifest")]
    public string FileManifest { get; set; } = string.Empty;

    [JsonPropertyName("previousAudit")]
    public object? PreviousAudit { get; set; }

    [JsonPropertyName("mode")]
    public string Mode { get; set; } = "full";

    [JsonPropertyName("expectedPlanId")]
    public string? ExpectedPlanId { get; set; }

    [JsonPropertyName("aiAttemptTargets")]
    public List<object>? AiAttemptTargets { get; set; }

    [JsonPropertyName("filePaths")]
    public List<string>? FilePaths { get; set; }

    [JsonPropertyName("additionalRunPaths")]
    public AdditionalRunPaths? AdditionalRunPaths { get; set; }

    [JsonPropertyName("planId")]
    public string? PlanId { get; set; }

    [JsonPropertyName("userId")]
    public string? UserId { get; set; }

    [JsonPropertyName("fileMeta")]
    public List<FileMetaEntry>? FileMeta { get; set; }
}

public sealed class AdditionalRunPaths
{
    [JsonPropertyName("runId")]
    public string RunId { get; set; } = string.Empty;

    [JsonPropertyName("paths")]
    public List<string> Paths { get; set; } = [];
}

public sealed class FileMetaEntry
{
    [JsonPropertyName("batch")]
    public string Batch { get; set; } = "initial";
}
