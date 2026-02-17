namespace StrataAudit.Functions.Models;

/// <summary>
/// Represents a single uploaded file (base64-encoded).
/// Mirrors the frontend's { name, data, mimeType } structure.
/// </summary>
public sealed class FileEntry
{
    public string Name { get; set; } = string.Empty;
    public string Data { get; set; } = string.Empty;
    public string MimeType { get; set; } = "application/pdf";
}
