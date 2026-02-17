using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using StrataAudit.Functions.Models;

namespace StrataAudit.Functions.Services;

/// <summary>
/// Calls the Azure OpenAI Responses API with GPT-5 for audit review.
/// Uses direct PDF file input via the Responses API (like Gemini's native PDF reading).
///
/// API endpoint: POST {AZURE_OPENAI_ENDPOINT}/openai/v1/responses
/// Auth: api-key header
///
/// Ported from functions/geminiReview.js — same single-stage architecture:
///   base64 PDF → GPT-5 input_file → GPT-5 reasons → JSON output
/// </summary>
public sealed class AuditReviewService : IAuditReviewService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _config;
    private readonly ILogger<AuditReviewService> _logger;
    private readonly UserInstructionBuilder _instructionBuilder;

    public AuditReviewService(
        IConfiguration config,
        ILogger<AuditReviewService> logger,
        UserInstructionBuilder instructionBuilder)
    {
        _httpClient = new HttpClient { Timeout = TimeSpan.FromMinutes(9) };
        _config = config;
        _logger = logger;
        _instructionBuilder = instructionBuilder;
    }

    public async Task<string> ExecuteReviewAsync(AuditRequest request, CancellationToken cancellationToken = default)
    {
        string endpoint = _config["AZURE_OPENAI_ENDPOINT"]
            ?? throw new InvalidOperationException("AZURE_OPENAI_ENDPOINT not configured.");
        string apiKey = _config["AZURE_OPENAI_API_KEY"]
            ?? throw new InvalidOperationException("AZURE_OPENAI_API_KEY not configured.");
        string deployment = _config["AZURE_OPENAI_DEPLOYMENT"] ?? "gpt-5";

        // Build user instruction (ported from geminiReview.js lines 38-124)
        string userInstruction = _instructionBuilder.Build(
            request.Mode,
            request.FileManifest,
            request.PreviousAudit);

        // Build the input content parts: file parts + text instruction
        var contentParts = new JsonArray();

        // Add each file as an input_file part (base64 PDF → GPT-5, like Gemini's inlineData)
        foreach (var file in request.Files)
        {
            string mimeType = file.MimeType;
            if (string.IsNullOrEmpty(mimeType) && file.Name.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
                mimeType = "application/pdf";
            if (string.IsNullOrEmpty(mimeType) && file.Name.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
                mimeType = "text/csv";
            if (string.IsNullOrEmpty(mimeType))
                mimeType = "application/pdf";

            contentParts.Add(new JsonObject
            {
                ["type"] = "input_file",
                ["filename"] = file.Name,
                ["file_data"] = $"data:{mimeType};base64,{file.Data}",
            });
        }

        // Add user instruction text
        contentParts.Add(new JsonObject
        {
            ["type"] = "input_text",
            ["text"] = userInstruction,
        });

        // Build the Responses API request body
        var requestBody = new JsonObject
        {
            ["model"] = deployment,
            ["instructions"] = request.SystemPrompt,
            ["input"] = new JsonArray
            {
                new JsonObject
                {
                    ["role"] = "user",
                    ["content"] = contentParts,
                }
            },
            // Note: GPT-5 models do not support the "temperature" parameter
            ["text"] = new JsonObject
            {
                ["format"] = new JsonObject
                {
                    ["type"] = "json_object",
                }
            },
        };

        // Call Azure OpenAI Responses API
        string url = $"{endpoint.TrimEnd('/')}/openai/v1/responses";

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, url);
        httpRequest.Headers.Add("api-key", apiKey);
        httpRequest.Content = new StringContent(
            requestBody.ToJsonString(),
            Encoding.UTF8,
            "application/json");

        _logger.LogInformation("Calling Azure OpenAI Responses API: model={Model}, mode={Mode}, files={FileCount}",
            deployment, request.Mode, request.Files.Count);

        using var response = await _httpClient.SendAsync(httpRequest, cancellationToken);

        string responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Azure OpenAI API error: {StatusCode} {Body}",
                response.StatusCode, responseBody);
            throw new InvalidOperationException(
                $"Azure OpenAI API error ({response.StatusCode}): {responseBody}");
        }

        // Parse the Responses API output
        var responseJson = JsonNode.Parse(responseBody);
        string? outputText = responseJson?["output_text"]?.GetValue<string>();

        if (string.IsNullOrWhiteSpace(outputText))
        {
            // Try alternative extraction from output array
            outputText = responseJson?["output"]?[0]?["content"]?[0]?["text"]?.GetValue<string>();
        }

        if (string.IsNullOrWhiteSpace(outputText))
        {
            throw new InvalidOperationException("Azure OpenAI returned an empty response.");
        }

        // Strip markdown code fences if present (same as geminiReview.js lines 143-147)
        string jsonString = outputText.Trim();
        if (jsonString.StartsWith("```json", StringComparison.Ordinal))
        {
            jsonString = jsonString["```json".Length..].TrimStart();
            if (jsonString.EndsWith("```", StringComparison.Ordinal))
                jsonString = jsonString[..^3].TrimEnd();
        }
        else if (jsonString.StartsWith("```", StringComparison.Ordinal))
        {
            jsonString = jsonString[3..].TrimStart();
            if (jsonString.EndsWith("```", StringComparison.Ordinal))
                jsonString = jsonString[..^3].TrimEnd();
        }

        // Validate it's valid JSON
        _ = JsonDocument.Parse(jsonString);

        _logger.LogInformation("Audit review completed successfully, response length: {Length}", jsonString.Length);

        return jsonString;
    }
}
