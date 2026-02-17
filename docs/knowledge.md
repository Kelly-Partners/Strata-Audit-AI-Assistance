# Knowledge Base - Azure Migration

Critical technical decisions and architectural knowledge captured during the Azure migration.

## GPT-5.1-chat Model Selection

**Decision (Feb 2026):** Chose `gpt-5.1-chat` over `gpt-5.2-chat` for the production deployment.

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

**Known issue (Dec 2025):** Some community reports of GPT-5 occasionally failing to recognize PDF `input_file` content. OpenAI acknowledged but couldn't reproduce. Workaround: ensure correct data URI format.

**Sources:**
- [Azure OpenAI Responses API docs](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/responses)
- [OpenAI community: GPT-5 PDF input](https://community.openai.com/t/pdf-input-file-is-not-seen-by-gpt-5-gpt-5-mini-but-sometimes-by-gpt-5-nano/1337371)
- [MS Q&A: GPT-5 file support](https://learn.microsoft.com/en-us/answers/questions/5522224/azure-openai-gpt-4-1-file-support)

## Why No Azure Document Intelligence

Initially planned as a two-stage pipeline (Document Intelligence → GPT-5). Removed because:
1. GPT-5 reads PDFs natively via the Responses API
2. Single-stage architecture is simpler (same pattern as Gemini)
3. Existing prompts can be reused with minimal changes
4. Reduces cost (no Document Intelligence API calls)
5. Reduces latency (no extraction step)

**Fallback:** If GPT-5's PDF reading proves unreliable for complex financial tables, Document Intelligence can be added as Phase 8 (backend-only change, frontend unaffected).

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

## Azure Function App Deployment

**Resource:** `strata-audit-functions` (rg: `rg-strata-audit`, Australia East)

**Configuration:**
- Runtime: .NET 10 isolated worker, Linux
- Plan: Flex Consumption, 2048 MB instance memory
- Zone redundancy: Disabled
- Basic authentication: Disabled (deploys via `func` CLI with Azure credentials)
- Endpoint: `https://strata-audit-functions.azurewebsites.net/api/executefullreview`

**App Settings (Azure Portal):**
- `AZURE_OPENAI_ENDPOINT` = `https://strata-audit-openai.openai.azure.com/`
- `AZURE_OPENAI_API_KEY` = (secret, configured in portal)
- `AZURE_OPENAI_DEPLOYMENT` = `gpt-5.1-chat`
- `CORS_ALLOWED_ORIGINS` = `http://localhost:3000` (SWA domain to add later)

**Deployment command:**
```bash
cd StrataAudit.Functions && func azure functionapp publish strata-audit-functions
```

**Verified:** Both local (`func start` on port 7071) and production endpoints return expected 400 validation error when called without files.

## Cosmos DB Provisioning (Deployed)

**Configuration:**
- Account: `strata-audit-cosmos`
- URI: `https://strata-audit-cosmos.documents.azure.com:443/`
- API: NoSQL
- Capacity: Serverless
- Region: Australia East
- Security: Key-based Authentication enabled, Service-managed encryption
- Database: `strata-audit`
- Container: `plans` (partition key: `/userId`)

**Access:** Server-side only — Function App settings `AZURE_COSMOS_ENDPOINT`, `AZURE_COSMOS_KEY`, `AZURE_COSMOS_DATABASE`. No frontend Cosmos SDK needed.

## Blob Storage Provisioning (Deployed)

**Configuration:**
- Account: `strataauditstorage`
- Performance: Standard
- Redundancy: LRS (Locally-redundant storage)
- Access tier: Hot
- Region: Australia East
- Container: `plan-files`

**Access:** Server-side only — Function App settings `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER`. No frontend Storage SDK needed.

## Proxy Architecture Decision

**Decision (Feb 2026):** All Cosmos DB and Blob Storage operations are proxied through Azure Functions instead of using direct SDK access from the frontend.

**Rationale:**
- Cosmos DB account key in browser bundle gives full read/write access (unlike Firebase which had security rules)
- Storage SAS tokens in frontend similarly exposed
- Moving secrets server-side enforces user isolation via JWT token validation
- userId extracted from MSAL Bearer token `oid` claim (not from request body)

**Implementation:**
- 6 new Azure Function endpoints (3 Cosmos, 3 Blob) — see `PlanFunctions.cs` and `PlanFileFunctions.cs`
- `src/services/api-client.ts` — Shared `apiFetch()` helper with Bearer token
- `src/services/azure-cosmos.ts` and `azure-storage.ts` rewritten to call Function endpoints
- Same exported function signatures — zero changes needed in `App.tsx`
- `@azure/cosmos` and `@azure/storage-blob` removed from frontend `package.json`
- `JsonElement` pass-through in C# backend avoids deserializing 1-10MB AuditResponse payloads
- `TokenHelper.cs` — Dev mode skips JWT validation when `AZURE_AD_TENANT_ID` is empty; production validates against Azure AD OIDC

**New Function App endpoints:**
| Method | Route | Purpose |
|---|---|---|
| PUT | `/api/plans/{planId}` | Upsert plan document |
| GET | `/api/plans` | List all plans for authenticated user |
| DELETE | `/api/plans/{planId}` | Delete plan document |
| POST | `/api/plans/{planId}/files` | Upload files (base64 JSON body) |
| POST | `/api/plans/{planId}/files/load` | Download files by paths (returns base64) |
| DELETE | `/api/plans/{planId}/files` | Delete all files for a plan |

## Prompt System Architecture

The prompt system is a composable hierarchy:

```
Constitution (00_constitution.ts)
  └── Evidence Rules (20_evidence_rules.ts)
       ├── Step 0 Intake (step_0_intake.ts)
       ├── Phase 1 Verify (phase_1_verify.ts)
       ├── Phase 2 Revenue (phase_2_revenue.ts)
       │   └── Phase 2 Rules (phase_2_rules.ts)
       ├── Phase 3 Expenses (phase_3_expenses.ts)
       │   └── Phase 3 Rules (phase_3_rules.ts)
       ├── Phase 4 Assets (phase_4_assets.ts)
       │   └── Phase 4 Rules (phase_4_rules.ts)
       ├── Phase 5 Compliance (phase_5_compliance.ts)
       ├── Phase 6 Completion (phase_6_completion.ts)
       ├── AI Attempt (phase_ai_attempt.ts)
       └── Output Registry (output_registry.ts)
```

**Composition patterns:**
- `buildSystemPrompt()` - Full audit (all phases)
- `buildStep0Prompt()` - Step 0 only (document intake)
- `buildLevyPrompt()` - Call 2: Phase 2 only (with Step 0 as locked context)
- `buildPhase4Prompt()` - Call 2: Phase 4 only
- `buildExpensesPrompt()` - Call 2: Phase 3 only
- `buildPhase5Prompt()` - Call 2: Phase 5 only
- `buildPhase6Prompt()` - Call 2: Phase 6 only
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

The backend (UserInstructionBuilder) handles 4 instruction modes:

1. **Call 2 Phase** (`levy`, `phase4`, `expenses`, `compliance`, `completion`, `aiAttempt`)
   - Locks Step 0 output as context
   - Executes only the specified phase
   - Returns only that phase's keys

2. **Incremental** (has `previousAudit` but not Step 0-only)
   - Updates document register with new files
   - Resolves previously missing critical types

3. **Step 0 Only** (`mode === "step0_only"`)
   - Document intake only
   - Returns: document_register, intake_summary, core_data_positions, bs_extract

4. **Full** (default)
   - All phases 0-6

## Request/Response Contract

The frontend-to-backend contract is unchanged from Firebase:

**Request:** `POST /api/executeFullReview`
```json
{
  "files": [{ "name": "file.pdf", "data": "<base64>", "mimeType": "application/pdf" }],
  "systemPrompt": "<composed prompt>",
  "fileManifest": "File Part 1: file1.pdf\nFile Part 2: file2.pdf",
  "previousAudit": { /* AuditResponse or null */ },
  "mode": "step0_only" | "levy" | "phase4" | "expenses" | "compliance" | "completion" | "aiAttempt" | "full",
  "aiAttemptTargets": [/* targets for AI Attempt mode */]
}
```

**Response:** `AuditResponse` JSON (same schema regardless of backend provider)

## MSAL Authentication Flow

```
1. App mount → initializeMsal() → handleRedirectPromise()
2. msalOnAuthStateChanged() fires with current account (null or cached)
3. User clicks "Sign in with Microsoft" → msalInstance.loginPopup()
4. On success → EventType.LOGIN_SUCCESS → callback fires → setAzureUser()
5. API calls → acquireTokenSilent() → Authorization: Bearer <access_token>
6. Sign out → msalInstance.logoutPopup()
```

**AzureUser adapter:** Maps MSAL `AccountInfo` to `{ uid, email, displayName }` matching the shape App.tsx expects.

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
  "error": null,
  "updatedAt": 1708099260000
}
```

## Prompt Changes (Minimal)

Only 2 wording changes needed in `UserInstructionBuilder.cs`:
1. "binary parts" → "uploaded files" (file mapping header)
2. "File Part 1" → "File 1" (file mapping instructions)

All TypeScript prompt files (`src/audit_engine/`) remain unchanged - they reference documents generically, not Gemini-specifically.

## Firebase Cleanup (Completed)

All Firebase/Gemini files have been removed from the codebase:

**Deleted service files:**
- `services/firebase.ts`, `services/gemini.ts`, `services/geminiService.ts`, `services/planPersistence.ts` (re-export shims)
- `src/services/firebase.ts`, `src/services/gemini.ts`, `src/services/geminiService.ts`, `src/services/planPersistence.ts` (implementations)

**Deleted config files:**
- `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `storage.rules`

**Deleted backend:**
- Entire `functions/` directory (Firebase Cloud Functions with `geminiReview.js`, `constants.js`, etc.)

**Kept:**
- `services/mergeAiAttemptUpdates.ts` — still actively used by App.tsx (pure logic, no Firebase dependency)
- `README.firebase.md` — historical reference for original Firebase architecture

## .gitignore Configuration

Updated `.gitignore` covers:
- **Frontend:** `node_modules/`, `dist/`, logs
- **Secrets:** `.env`, `.env.local`, `StrataAudit.Functions/local.settings.json`
- **.NET:** `bin/`, `obj/`, `*.dll`, `*.pdb`, NuGet artifacts
- **IDE:** VS Code (preserving `extensions.json`, `settings.json`, `launch.json`), JetBrains, Vim swap files
- **OS:** `.DS_Store`, `Thumbs.db`
- **Azure:** `.azure/`, development appsettings

## Build Status

- Frontend `npm run build`: **Passes** (zero errors; one warning: 1.3MB chunk from Monaco editor — acceptable)
- Backend `dotnet build`: **Passes** (zero errors, zero warnings)
- Azure Functions Core Tools v4.7.0 installed globally via `npm i -g azure-functions-core-tools@4`
