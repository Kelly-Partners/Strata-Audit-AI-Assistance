<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Strata Audit AI Assistance - Azure Enterprise Edition

An AI-powered strata audit engine that processes financial documents (PDFs, CSVs) through a multi-phase audit workflow using Azure OpenAI GPT-5.

> **Migration Note:** This version has been migrated from Google Gemini + Firebase to a full Azure enterprise solution. See [README.firebase.md](README.firebase.md) for the original Firebase version documentation.

## Architecture

| Component | Technology |
|---|---|
| AI Model | Azure OpenAI GPT-5 (Responses API, direct PDF input) |
| Backend | Azure Functions (.NET 10 / C#, Flex Consumption, Linux, 8 endpoints) |
| Frontend | React 19 + TypeScript 5.8 + Vite 6, hosted on Azure Static Web Apps |
| Authentication | Microsoft Entra ID (MSAL) |
| Database | Azure Cosmos DB NoSQL API (proxied through Functions) |
| File Storage | Azure Blob Storage (proxied through Functions) |

### How it works

```
Frontend (React)
    │
    ├─ POST /api/executeFullReview ──→ Azure Function → GPT-5 → AuditResponse JSON
    ├─ PUT/GET/DELETE /api/plans/* ──→ Azure Function → Cosmos DB
    └─ POST/DELETE /api/plans/*/files/* ──→ Azure Function → Blob Storage
    │
    │  All calls include: Authorization: Bearer <MSAL token>
    │  Server extracts userId from JWT "oid" claim
    v
Frontend renders audit report with forensic PDF viewer
```

The audit runs in phases:
1. **Step 0** — Document intake & indexing (creates document register, balance sheet extract, P&L extract)
2. **Call 2** — Four parallel phases: Levy Reconciliation, Balance Sheet Verification, Expenses Vouching, Statutory Compliance
3. **Expenses Additional** (optional) — Supplementary evidence vouching with additional uploaded documents
4. **AI Attempt** — Targeted re-verification of flagged issues (explain-only, produces resolution table)

### Evidence Tier System

All evidence is classified into three tiers (Supreme Protocol, co-equal with the audit Constitution):
- **Tier 1** — Independent third-party (Bank Statements, Insurance Policies, ATO notices)
- **Tier 2** — Internal-authoritative (Levy Reports, Creditors Reports)
- **Tier 3** — Accounting system (GL, Financial Statements, Notes)

Each phase enforces specific tier requirements. Higher-tier evidence cannot be substituted with lower-tier.

## Prerequisites

- Node.js 18+
- .NET 10 SDK
- Azure Functions Core Tools v4 (`npm i -g azure-functions-core-tools@4`)
- Azure subscription with provisioned resources (see [docs/plan.md](docs/plan.md))

## Run Locally

### Frontend

```bash
npm install
# Copy .env.example to .env.local and fill in values
npm run dev
```

### Backend (Azure Functions)

```bash
cd StrataAudit.Functions
dotnet restore
# Create local.settings.json with required values (see below)
func start
```

## Environment Variables

### Frontend (.env.local)

```
# Azure Function URL (base URL without /api path)
VITE_AZURE_FUNCTION_URL=http://localhost:7071

# Azure AD Authentication (public client credentials — safe for frontend)
VITE_AZURE_AD_CLIENT_ID=<your-app-client-id>
VITE_AZURE_AD_TENANT_ID=<your-tenant-id>
```

> **Note:** Cosmos DB and Blob Storage are accessed exclusively through Azure Functions (server-side). No database or storage credentials should ever be in the frontend.

### Backend (local.settings.json)

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "dotnet-isolated",
    "AZURE_OPENAI_ENDPOINT": "https://strata-audit-openai.openai.azure.com/",
    "AZURE_OPENAI_API_KEY": "<your-key>",
    "AZURE_OPENAI_DEPLOYMENT": "gpt-5.1-chat",
    "AZURE_COSMOS_ENDPOINT": "https://strata-audit-cosmos.documents.azure.com:443/",
    "AZURE_COSMOS_KEY": "<your-key>",
    "AZURE_COSMOS_DATABASE": "strata-audit",
    "AZURE_STORAGE_CONNECTION_STRING": "<your-connection-string>",
    "AZURE_STORAGE_CONTAINER": "plan-files",
    "AZURE_AD_CLIENT_ID": "<your-app-client-id>",
    "AZURE_AD_TENANT_ID": "<your-tenant-id>"
  },
  "Host": {
    "CORS": "http://localhost:3000",
    "CORSCredentials": true
  }
}
```

## Deployment

### Backend: Azure Functions

```bash
cd StrataAudit.Functions
func azure functionapp publish strata-audit-functions
```

### Frontend: Azure Static Web Apps

```bash
npm run build
npx @azure/static-web-apps-cli deploy ./dist --app-name strata-tax-review-assistance-web --env production
```

## Project Structure

```
/                                # Frontend (React + Vite)
  App.tsx                        # Main application (auth, plan management, execution)
  src/
    audit_engine/                # Audit prompt composition system
      kernel/                    # Constitution & Evidence Rules (Supreme Protocol)
      workflow/                  # Phase-specific prompts (Step 0, Phase 2-5, AI Attempt)
      rules/                     # Per-phase item-level rules
      call2_phase_prompts.ts     # Phase-specific prompt composition for Call 2
      ai_attempt_targets.ts      # Target builder + system triage auto-generation
    audit_outputs/               # Output type definitions & Zod schemas
    services/
      api-client.ts              # Shared apiFetch() with Bearer token
      azure-auth.ts              # MSAL authentication (Entra ID)
      azure-cosmos.ts            # Cosmos DB plan persistence (via Function proxy)
      azure-storage.ts           # Blob Storage file management (via Function proxy)
      auditApi.ts                # Audit execution API client
      expenseRunsHelpers.ts      # Multi-round expense run utilities
  components/
    AuditReport.tsx              # Tabbed audit report with forensic PDF viewer
    FileUpload.tsx               # File upload with locked file support
    ReportSkeleton.tsx           # Loading shimmer placeholder
    PromptAdmin.tsx              # Prompt admin & playground

StrataAudit.Functions/           # Backend (Azure Functions .NET 10)
  Functions/
    ExecuteFullReviewFunction.cs # AI audit execution (server-side file fetching)
    PlanFunctions.cs             # Cosmos DB CRUD (Upsert, Get, Delete plans)
    PlanFileFunctions.cs         # Blob Storage (Upload, Load, Delete, SAS URL)
  Services/
    AuditReviewService.cs        # GPT-5 Responses API integration
    UserInstructionBuilder.cs    # Mode-switching with Evidence Tier enforcement
    TokenHelper.cs               # JWT validation and userId extraction
    CosmosDbService.cs           # Cosmos DB data access
    BlobStorageService.cs        # Blob Storage data access + SAS URL generation
  Models/
    AuditRequest.cs              # Request DTO
    FileEntry.cs                 # File entry DTO
    FileLoadRequest.cs           # File load/upload/URL request DTOs
```

## Documentation

- [docs/plan.md](docs/plan.md) — Azure migration plan (completed)
- [docs/knowledge.md](docs/knowledge.md) — Technical decisions & architecture knowledge
- [README.firebase.md](README.firebase.md) — Original Firebase version README (historical)
