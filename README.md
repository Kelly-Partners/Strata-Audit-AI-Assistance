<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Strata Audit AI Assistance - Azure Enterprise Edition

An AI-powered strata audit engine that processes financial documents (PDFs, CSVs) through a multi-phase audit workflow using Azure OpenAI GPT-5.1-chat.

> **Migration Note:** This version has been migrated from Google Gemini + Firebase to a full Azure enterprise solution. See [README.firebase.md](README.firebase.md) for the original Firebase version documentation.

## Architecture

| Component | Technology |
|---|---|
| AI Model | Azure OpenAI GPT-5.1-chat (Responses API, direct PDF input) |
| Backend | Azure Functions (.NET 10 / C#, Flex Consumption, Linux) |
| Frontend | React + TypeScript + Vite, hosted on Azure Static Web Apps |
| Authentication | Microsoft Entra ID (MSAL) |
| Database | Azure Cosmos DB (NoSQL API) |
| File Storage | Azure Blob Storage |

### How it works

```
Frontend (React)
    |
    | POST /api/executeFullReview
    | Authorization: Bearer <MSAL token>
    | Body: { files (base64), systemPrompt, fileManifest, mode }
    v
Azure Function (.NET 10)
    |
    | Responses API with input_file (base64 PDF)
    v
Azure OpenAI GPT-5
    |
    | JSON (AuditResponse)
    v
Frontend renders audit report
```

The audit runs in phases:
1. **Step 0** - Document intake & indexing (creates document register, balance sheet extract)
2. **Call 2** - Four parallel phases: Levy Reconciliation, Balance Sheet Verification, Expenses Vouching, Statutory Compliance
3. **AI Attempt** - Targeted re-verification of flagged issues with additional evidence
4. **Phase 6** - Completion & Disclosure (aggregates all findings)

## Prerequisites

- Node.js 18+
- .NET 10 SDK (for Azure Functions backend)
- Azure Functions Core Tools v4 (`npm i -g azure-functions-core-tools@4`)
- Azure subscription with:
  - Azure OpenAI resource (`strata-audit-openai`, GPT-5.1-chat deployed, Australia East)
  - Azure Function App (`strata-audit-functions`, Flex Consumption, .NET 10, Australia East)
  - Azure Cosmos DB (NoSQL API, Serverless) — setup in progress
  - Azure Blob Storage — not yet created
  - Microsoft Entra ID app registration — not yet created

## Run Locally

### Frontend

```bash
npm install
# Copy .env.local and fill in values (see Environment Variables below)
npm run dev
```

### Backend (Azure Functions)

```bash
cd StrataAudit.Functions
dotnet restore
# Set values in local.settings.json
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

> **Note:** Cosmos DB and Blob Storage are accessed exclusively through Azure Functions (server-side). No database credentials should ever be in the frontend.

### Backend (local.settings.json)

```json
{
  "Values": {
    "AZURE_OPENAI_ENDPOINT": "https://strata-audit-openai.openai.azure.com/",
    "AZURE_OPENAI_API_KEY": "<your-key>",
    "AZURE_OPENAI_DEPLOYMENT": "gpt-5.1-chat"
  }
}
```

## Deployment

### Frontend: Azure Static Web Apps

```bash
npm run build
# Deploy dist/ folder via SWA CLI or GitHub CI/CD
swa deploy dist/ --deployment-token <token>
```

### Backend: Azure Functions

```bash
cd StrataAudit.Functions
func azure functionapp publish strata-audit-functions
```

## Project Structure

```
/                           # Frontend (React + Vite)
  App.tsx                   # Main application (auth, plan management, execution)
  src/
    audit_engine/           # Audit prompt composition system
      kernel/               # Constitution & evidence rules
      workflow/             # Phase-specific prompts (Step 0 through Phase 6)
      rules/                # Per-phase item-level rules
    audit_outputs/          # Output type definitions & Zod schemas
    services/
      azure-auth.ts         # MSAL authentication service
      azure-cosmos.ts       # Cosmos DB plan persistence
      azure-storage.ts      # Azure Blob Storage file management
      auditApi.ts           # Azure Function API client
  components/
    AuditReport.tsx         # Audit report renderer
    FileUpload.tsx          # File upload component
    PromptAdmin.tsx         # Prompt admin & playground (Phase 7)

StrataAudit.Functions/      # Backend (Azure Functions .NET 10)
  Functions/
    ExecuteFullReviewFunction.cs   # HTTP trigger endpoint
  Services/
    AuditReviewService.cs          # GPT-5 Responses API integration
    UserInstructionBuilder.cs      # Mode-switching logic (ported from JS)
  Models/
    AuditRequest.cs                # Request DTO
    FileEntry.cs                   # File entry DTO
```

## Documentation

- [plan.md](docs/plan.md) - Full Azure migration plan
- [knowledge.md](docs/knowledge.md) - Technical decisions & architecture knowledge base
- [README.firebase.md](README.firebase.md) - Original Firebase version README
