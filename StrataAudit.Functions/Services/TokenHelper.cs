using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace StrataAudit.Functions.Services;

/// <summary>
/// Extracts and validates the userId (oid claim) from the MSAL Bearer token.
/// </summary>
public static class TokenHelper
{
    private static ConfigurationManager<OpenIdConnectConfiguration>? _configManager;

    /// <summary>
    /// Extract userId from the Authorization: Bearer token.
    /// Returns the "oid" (object ID) claim which matches the frontend's account.localAccountId.
    /// </summary>
    public static async Task<string> ExtractUserIdAsync(HttpRequest req, IConfiguration config)
    {
        var authHeader = req.Headers.Authorization.ToString();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("Missing or invalid Authorization header.");

        var token = authHeader["Bearer ".Length..].Trim();

        var tenantId = config["AZURE_AD_TENANT_ID"] ?? "";
        var clientId = config["AZURE_AD_CLIENT_ID"] ?? "";

        // Dev mode: if no tenant/client configured, decode token without validation
        if (string.IsNullOrEmpty(tenantId) || string.IsNullOrEmpty(clientId))
        {
            var handler = new JwtSecurityTokenHandler();
            var jwt = handler.ReadJwtToken(token);
            var oid = jwt.Claims.FirstOrDefault(c => c.Type == "oid")?.Value;
            if (string.IsNullOrEmpty(oid))
                throw new UnauthorizedAccessException("Token missing 'oid' claim.");
            return oid;
        }

        // Production: validate token against Azure AD
        _configManager ??= new ConfigurationManager<OpenIdConnectConfiguration>(
            $"https://login.microsoftonline.com/{tenantId}/v2.0/.well-known/openid-configuration",
            new OpenIdConnectConfigurationRetriever());

        var openIdConfig = await _configManager.GetConfigurationAsync(CancellationToken.None);

        var validationParams = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuers =
            [
                $"https://login.microsoftonline.com/{tenantId}/v2.0",
                $"https://sts.windows.net/{tenantId}/"
            ],
            ValidateAudience = true,
            ValidAudiences = [clientId, $"api://{clientId}"],
            ValidateLifetime = true,
            IssuerSigningKeys = openIdConfig.SigningKeys,
        };

        var handler2 = new JwtSecurityTokenHandler();
        try
        {
            handler2.ValidateToken(token, validationParams, out _);
        }
        catch (SecurityTokenException ex)
        {
            throw new UnauthorizedAccessException($"Token validation failed: {ex.Message}", ex);
        }

        var validatedJwt = handler2.ReadJwtToken(token);
        var userId = validatedJwt.Claims.FirstOrDefault(c => c.Type == "oid")?.Value;
        if (string.IsNullOrEmpty(userId))
            throw new UnauthorizedAccessException("Token missing 'oid' claim.");

        return userId;
    }
}
