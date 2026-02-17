# Knowledge Base - Azure Migration

Critical technical decisions and architectural knowledge captured during the Azure migration.

## GPT-5 Model Selection

**Decision (Feb 2026):** Chose `gpt-5.1-chat` for the production deployment.

**Pricing comparison (AUD, per 1M tokens):**
| Model | Input | Output | Notes |
|---|---|---|---|
| gpt-5.1-chat | ~$1.79 | ~$14.29 | Available in Australia East |
| gpt-5.2-chat | ~$2.51 | ~$20.01 | **NOT available in Australia East** (would deploy to East US 2) |

**Rationale:**
- 40% cheaper than gpt-5.2-chat
- Available in Australia East (data sovereignty, lower latency)
- Adequate capability for structured financial audit tasks
- gpt-5.2-chat only available in US regions — unacceptable for Australian financial data

**Deployment details:**
- Resource: `strata-audit-openai`
- Deployment name: `gpt-5.1-chat`
- Model version: `2025-11-13`
- Rate limit: 150K TPM
- Auto-upgrade policy: Enabled
- **Warning:** Model version `2025-11-13` retiring March 31, 2026 — auto-upgrade will handle this

## GPT-5 Native PDF Support on Azure

**Finding (Feb 2026):** GPT-5 on Azure OpenAI supports direct PDF file input via the Responses API. This is the key architectural decision that simplified the entire migration.

**How it works:**
```python
# Responses API with base64 PDF input
response = client.responses.create(
    model="gpt-5.1-chat",
    input=[{
        "role": "user",
        "content": [
            {
                "type": "input_file",
                "filename": "document.pdf",
                "file_data": "data:application/pdf;base64,{base64_string}",
            },
            { "type": "input_text", "text": "Analyze this document" },
        ],
    }]
)
```

**Key constraints:**
- Must use the **Responses API** (`/openai/v1/responses`), NOT Chat Completions API
- PDF data must be formatted as data URI: `data:application/pdf;base64,{encoded}`
- The Responses API is available in `australiaeast`
- GPT-5 supports Image input, which is how PDF pages are processed internally

## Why No Azure Document Intelligence

Initially planned as a two-stage pipeline (Document Intelligence → GPT-5). Removed because:
1. GPT-5 reads PDFs natively via the Responses API
2. Single-stage architecture is simpler (same pattern as Gemini)
3. Existing prompts can be reused with minimal changes
4. Reduces cost (no Document Intelligence API calls)
5. Reduces latency (no extraction step)

**Fallback:** If GPT-5's PDF reading proves unreliable for complex financial tables, Document Intelligence can be added as a backend-only change (frontend unaffected).

## .NET 10 for Azure Functions

**Why .NET over Node.js:**
- Faster cold starts (compiled vs interpreted)
- Native Azure SDK support (`Azure.AI.OpenAI`, `Azure.Identity`)
- Better type safety and enterprise tooling
- .NET 10 is LTS (released Nov 2025)

**Deployment requirements:**
- Flex Consumption plan required for .NET 10 on Linux
- Flex Consumption also gives always-ready instances (no cold starts)
- Cold start concern is moot: audit operations take 30-120 seconds anyway

## Azure Function App

**Resource:** `strata-audit-functions` (rg: `rg-strata-audit`, Australia East)

**Configuration:**
- Runtime: .NET 10 isolated worker, Linux
- Plan: Flex Consumption, 2048 MB instance memory
- Zone redundancy: Disabled
- Basic authentication: Disabled (deploys via `func` CLI with Azure credentials)
- Function timeout: 9 minutes (accommodates GPT-5 processing)
- Max request body size: 200 MB (supports large PDF uploads)

**8 Registered Endpoints:**
| Method | Route | Purpose |
|---|---|---|
| POST | `/api/executeFullReview` | AI audit execution (GPT-5) |
| PUT | `/api/plans/{planId}` | Upsert plan document |
| GET | `/api/plans` | List all plans for authenticated user |
| DELETE | `/api/plans/{planId}` | Delete plan document |
| POST | `/api/plans/{planId}/files` | Upload files (base64 JSON body) |
| POST | `/api/plans/{planId}/files/load` | Download files by paths (returns base64) |
| POST | `/api/plans/{planId}/files/url` | Generate time-limited SAS URL for PDF viewing |
| DELETE | `/api/plans/{planId}/files` | Delete all files for a plan |

**App Settings (Azure Portal):**
- `AZURE_OPENAI_ENDPOINT` = `https://strata-audit-openai.openai.azure.com/`
- `AZURE_OPENAI_API_KEY` = (secret)
- `AZURE_OPENAI_DEPLOYMENT` = `gpt-5.1-chat`
- `AZURE_COSMOS_ENDPOINT`, `AZURE_COSMOS_KEY`, `AZURE_COSMOS_DATABASE`
- `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER`
- `AZURE_AD_CLIENT_ID`, `AZURE_AD_TENANT_ID`
- `CORS_ALLOWED_ORIGINS`

**Deployment command:**
```bash
cd StrataAudit.Functions && func azure functionapp publish strata-audit-functions
```

## Proxy Architecture Decision

**Decision (Feb 2026):** All Cosmos DB and Blob Storage operations are proxied through Azure Functions instead of using direct SDK access from the frontend.

**Rationale:**
- Cosmos DB account key in browser bundle gives full read/write access (unlike Firebase which had security rules)
- Storage SAS tokens in frontend similarly exposed
- Moving secrets server-side enforces user isolation via JWT token validation
- userId extracted from MSAL Bearer token `oid` claim (not from request body)

**Implementation:**
- 7 Azure Function proxy endpoints (3 Cosmos, 4 Blob) — see `PlanFunctions.cs` and `PlanFileFunctions.cs`
- `src/services/api-client.ts` — Shared `apiFetch()` helper with Bearer token
- `src/services/azure-cosmos.ts` and `azure-storage.ts` rewritten to call Function endpoints
- Same exported function signatures — zero changes needed in `App.tsx`
- `@azure/cosmos` and `@azure/storage-blob` removed from frontend `package.json`
- `JsonElement` pass-through in C# backend avoids deserializing 1-10MB AuditResponse payloads
- `TokenHelper.cs` — Dev mode skips JWT validation when `AZURE_AD_TENANT_ID` is empty; production validates against Azure AD OIDC

## Server-Side File Fetching

**Decision (Feb 2026):** `ExecuteFullReviewFunction` can optionally fetch files from Blob Storage when `filePaths` are provided but `files[]` is empty.

**Rationale:**
- Call 2 phases reuse the same files from Step 0
- Avoids re-uploading 10-50 MB of PDFs per phase call
- Frontend sends `filePaths` (string array of blob paths) instead of base64 data
- Backend uses `IBlobStorageService.LoadFilesAsync()` to download from Blob

**Fallback:** If `files[]` is provided (e.g., first Step 0 upload), base64 data is used directly.

## SAS URL Generation for PDF Viewing

**Decision (Feb 2026):** Added `GetFileUrl` endpoint that generates time-limited read-only SAS URLs for blobs.

**Rationale:**
- AuditReport's forensic viewer needs to display source PDFs in iframes
- iframes cannot send Authorization headers
- SAS URLs are self-authenticating and expire after 1 hour
- Backend validates that the requested blob path belongs to the authenticated user's plan

**Flow:**
```
AuditReport (click forensic cell)
  → resolveStoragePathByOriginName() finds blob path
  → getPdfUrlFn(blobPath) calls App.tsx callback
  → getFileUrl(planId, blobPath) calls POST /api/plans/{planId}/files/url
  → BlobStorageService.GenerateReadUrlAsync() generates SAS URI
  → Return URL → open in iframe
```

## Cosmos DB Provisioning

**Configuration:**
- Account: `strata-audit-cosmos`
- URI: `https://strata-audit-cosmos.documents.azure.com:443/`
- API: NoSQL
- Capacity: Serverless
- Region: Australia East
- Database: `strata-audit`
- Container: `plans` (partition key: `/userId`)

**Access:** Server-side only via Function App settings.

## Blob Storage Provisioning

**Configuration:**
- Account: `strataauditstorage`
- Performance: Standard
- Redundancy: LRS (Locally-redundant storage)
- Access tier: Hot
- Region: Australia East
- Container: `plan-files`

**Access:** Server-side only via Function App settings.

## Prompt System Architecture

The prompt system is a composable hierarchy:

```
Constitution (00_constitution.ts)
  └── Evidence Rules — Supreme Protocol (20_evidence_rules.ts)
       ├── Step 0 Intake (step_0_intake.ts) — document types with tier, pl_extract
       ├── Phase 2 Revenue (phase_2_revenue.ts) — per-fund levy, interest/discount split
       │   └── Phase 2 Rules (phase_2_rules.ts)
       ├── Phase 3 Expenses (phase_3_expenses.ts) — 5 dimensions, 6+9 checks
       │   └── Phase 3 Rules (phase_3_rules.ts)
       ├── Phase 4 Assets (phase_4_assets.ts) — BS verification with tier enforcement
       │   └── Phase 4 Rules (phase_4_rules.ts)
       ├── Phase 5 Compliance (phase_5_compliance.ts) — insurance, GST, income tax
       ├── AI Attempt (phase_ai_attempt.ts) — explain-only, resolution table
       └── Output Registry (output_registry.ts)
```

**Composition patterns:**
- `buildSystemPrompt()` - Full audit (all phases)
- `buildStep0Prompt()` - Step 0 only (document intake)
- `buildLevyPrompt()` - Call 2: Phase 2 only (with Step 0 as locked context)
- `buildPhase4Prompt()` - Call 2: Phase 4 only
- `buildExpensesPrompt()` - Call 2: Phase 3 only
- `buildExpensesAdditionalPrompt()` - Call 2: Phase 3 additional run (supplement evidence)
- `buildPhase5Prompt()` - Call 2: Phase 5 only
- `buildAiAttemptPrompt(targets)` - AI Attempt with target items

**Hardcoded thresholds in prompts:**
- Expense materiality: $5,000
- Anomaly flag: $1,000
- Variance tolerance: $1.00
- Rounding threshold: $1.00
- GST rate: 10%
- Payment date tolerance: +/-14 days
- Payment amount match: +/-1% or +/-$10

## Mode-Switching Logic

The backend (`UserInstructionBuilder.cs`) handles these instruction modes:

1. **Call 2 Phase** (`levy`, `phase4`, `expenses`, `expenses_additional`, `compliance`, `aiAttempt`)
   - Locks Step 0 output as context
   - Applies Evidence Tier enforcement instructions per phase
   - Executes only the specified phase
   - Returns only that phase's keys

2. **Incremental** (has `previousAudit` but not Step 0-only)
   - Updates document register with new files
   - Resolves previously missing critical types

3. **Step 0 Only** (`mode === "step0_only"`)
   - Document intake only
   - Returns: `document_register`, `intake_summary`, `core_data_positions`, `bs_extract`, `pl_extract`

4. **Full** (default)
   - All phases 0-5

## Request/Response Contract

**Request:** `POST /api/executeFullReview`
```json
{
  "files": [{ "name": "file.pdf", "data": "<base64>", "mimeType": "application/pdf" }],
  "filePaths": ["users/uid/plans/pid/file.pdf"],
  "additionalRunPaths": { "runId": "run-uuid", "paths": ["..."] },
  "systemPrompt": "<composed prompt>",
  "fileManifest": "File Part 1: file1.pdf\nFile Part 2: file2.pdf",
  "previousAudit": { /* AuditResponse or null */ },
  "mode": "step0_only" | "levy" | "phase4" | "expenses" | "expenses_additional" | "compliance" | "aiAttempt" | "full",
  "aiAttemptTargets": [/* targets for AI Attempt mode */],
  "planId": "plan-uuid",
  "userId": "user-oid",
  "fileMeta": [{ "batch": "initial" | "additional" }]
}
```

Notes:
- If `files` is empty but `filePaths` is provided, the backend fetches files from Blob Storage server-side
- `planId` and `userId` are used for server-side file fetching path validation
- `fileMeta` tracks which files are initial vs additional evidence

**Response:** `AuditResponse` JSON (same schema regardless of backend provider)

## MSAL Authentication Flow

```
1. App mount → initializeMsal() → handleRedirectPromise()
2. msalOnAuthStateChanged() fires with current account (null or cached)
3. User clicks "Sign in with Microsoft" → msalInstance.loginRedirect()
4. On redirect return → handleRedirectPromise() → callback fires → setAzureUser()
5. API calls → acquireTokenSilent() → Authorization: Bearer <id_token>
6. Sign out → msalInstance.logoutRedirect()
```

**AzureUser adapter:** Maps MSAL `AccountInfo` to `{ uid, email, displayName }` matching the shape App.tsx expects.

**Note:** Uses `loginRedirect()` (not `loginPopup()`) to avoid CORS issues on Azure Static Web Apps. The `getAccessToken()` function returns the `idToken` (not `accessToken`) because the SPA and backend share the same Entra ID app registration.

## Cosmos DB Data Model

**Container:** `plans` (partition key: `/userId`)

```json
{
  "id": "plan-uuid",
  "userId": "user-local-account-id",
  "name": "SP 12345 Audit",
  "createdAt": 1708099200000,
  "status": "completed",
  "filePaths": ["users/uid/plans/pid/file.pdf"],
  "fileMeta": [{ "uploadedAt": 1708099200000, "batch": "initial" }],
  "result": { /* AuditResponse */ },
  "triage": [{ /* TriageItem */ }],
  "user_resolutions": [{ "itemKey": "...", "resolutionType": "Resolved", "comment": "...", "resolvedAt": 1708099260000 }],
  "user_overrides": [{ /* deprecated, migrated to user_resolutions */ }],
  "ai_attempt_history": [{ "timestamp": 1708099260000, "targetCount": 5, "resolutionTable": [...] }],
  "additional_runs": [{ "run_id": "run-uuid", "file_paths": ["..."], "created_at": 1708099260000 }],
  "error": null,
  "updatedAt": 1708099260000
}
```

## Evidence Tier Enforcement

Each phase has specific tier requirements enforced in `UserInstructionBuilder.cs`:

| Phase | Item | Required Tier | Prohibited |
|---|---|---|---|
| Levy (Phase 2) | Admin/Capital Fund Receipts | Tier 2 ONLY | GL, FS, Notes |
| Levy (Phase 2) | PriorYear/CurrentYear Arrears/Advance | bs_extract ONLY | Levy Reports, GL |
| Phase 4 (BS) | Cash at Bank (R2) | Tier 1 (Bank Statement) | Bank Reconciliation, GL |
| Phase 4 (BS) | Creditors/Levy (R3/4) | Tier 2 | Bank Statement, GL |
| Phase 4 (BS) | Retained Surplus (R5) | Tier 3 (GL) | — |
| Expenses | Invoice validity | Tier 1 ONLY | — |
| Expenses | Payment PAID | Tier 1 ONLY (Bank Statement) | — |
| Expenses | Payment ACCRUED | Tier 2 ONLY (Creditors Report) | — |
| Compliance | Insurance adequacy | Tier 1 ONLY (Policy/Certificate) | Management summaries, GL |
| Compliance | GST roll-forward | Tier 1 (BAS/Bank) / Tier 2 (internal) | — |

## Firebase Cleanup (Completed)

All Firebase/Gemini files removed. See `README.firebase.md` for historical reference.

## Build Status

- Frontend `npm run build`: **Passes** (zero errors; chunk size warning from Monaco editor — acceptable)
- Backend `dotnet build`: **Passes** (zero errors, zero warnings)
- Azure Functions Core Tools v4.7.0 installed globally
