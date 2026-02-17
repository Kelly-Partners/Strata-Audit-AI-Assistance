using StrataAudit.Functions.Models;

namespace StrataAudit.Functions.Services;

/// <summary>
/// Abstraction for the AI audit review service.
/// Allows swapping between Azure OpenAI, Document Intelligence, or other providers.
/// </summary>
public interface IAuditReviewService
{
    /// <summary>
    /// Execute a full audit review using the AI model.
    /// </summary>
    /// <param name="request">The audit request containing files, prompts, and mode.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Raw JSON string of the audit response.</returns>
    Task<string> ExecuteReviewAsync(AuditRequest request, CancellationToken cancellationToken = default);
}
