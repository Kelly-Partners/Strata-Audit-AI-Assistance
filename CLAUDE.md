# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Strata Audit AI Assistance is a financial audit application for strata/body corporate properties. It uses Azure OpenAI GPT-5 to automate audit workflows across structured phases, with a React frontend and Azure backend (Azure Functions .NET 10, Cosmos DB, Blob Storage, Entra ID auth).

## Commands

```bash
# Frontend development
npm install              # Install frontend dependencies
npm run dev              # Start Vite dev server on port 3000

# Build
npm run build            # Production build to dist/

# Utilities
npm run verify-prompts          # Validate prompt integrity
npm run generate-schema         # Generate JSON schema from Zod definitions (uses tsx)

# Azure Functions (.NET 10)
cd StrataAudit.Functions && dotnet restore     # Restore NuGet packages
cd StrataAudit.Functions && dotnet build       # Build functions
cd StrataAudit.Functions && func start         # Start Azure Functions locally (http://localhost:7071)
cd StrataAudit.Functions && func azure functionapp publish strata-audit-functions  # Deploy to Azure

# Full deployment
npm run build  # Then deploy dist/ to Azure Static Web Apps
```

## Architecture

### Execution Pipeline

The audit runs in a fixed sequence of steps, each producing structured JSON output consumed by later steps:

1. **Step 0 (Document Intake)** — Extracts `document_register`, `intake_summary`, `core_data_positions`, `bs_extract` from uploaded PDFs/CSVs
2. **Call 2 (4 parallel phases)** — Runs Phase 2 (Levy), Phase 3 (Expenses), Phase 4 (Balance Sheet), Phase 5 (Compliance) concurrently, each receiving Step 0 output as context
3. **AI Attempt** — Targeted re-verification of flagged/failed items from phases + user triage; merges partial updates back
4. **Phase 6 (Completion)** — Final compliance checks and report sign-off

Each phase call goes through: `App.tsx` → `services/auditApi.ts` → Azure Function (`StrataAudit.Functions/`) → Azure OpenAI GPT-5.1-chat Responses API with direct PDF input.

### Key Directories

- **`src/audit_engine/`** — Core audit logic: prompt builders, phase workflows, kernel rules
  - `kernel/` — Constitution (audit hierarchy) and evidence rules
  - `workflow/` — Per-phase prompt construction (`step_0_intake.ts`, `phase_1_verify.ts` through `phase_6_completion.ts`, `phase_ai_attempt.ts`)
  - `rules/` — Phase-specific item rules (evidence priority, whitelist doc types). See `rules/README.md` for adding new rules
  - `ai_attempt_targets.ts` — Builds target list for re-verification from phase results + triage items
- **`src/audit_outputs/`** — Output schema layer
  - `type_definitions.ts` — All TypeScript interfaces (`AuditResponse`, `DocumentEntry`, `BsExtract`, `LevyRecMaster`, `ExpenseSample`, etc.)
  - `schema_definitions.ts` — Zod validation schemas matching the types
  - `json_schema.ts` — JSON Schema export used for structured output
  - `output_registry.ts` — Module 50 prompt defining output structure
- **`src/services/`** — Azure service integrations (all data operations proxied through Azure Functions)
  - `api-client.ts` — Shared `apiFetch()` helper with Bearer token and base URL
  - `azure-auth.ts` — MSAL authentication (Microsoft Entra ID)
  - `azure-cosmos.ts` — Cosmos DB plan persistence (via Azure Function proxy)
  - `azure-storage.ts` — Azure Blob Storage file management (via Azure Function proxy)
  - `auditApi.ts` — Azure Function API client for audit execution
- **`services/`** — Re-export shims for convenient imports from App.tsx
- **`components/`** — `AuditReport.tsx` (tabbed report with ForensicCell), `FileUpload.tsx`, `PromptAdmin.tsx` (prompt editor & playground)
- **`StrataAudit.Functions/`** — Azure Functions backend (.NET 10, C#)
  - `Functions/ExecuteFullReviewFunction.cs` — HTTP trigger for AI audit execution
  - `Functions/PlanFunctions.cs` — Cosmos DB CRUD endpoints (GET/PUT/DELETE plans)
  - `Functions/PlanFileFunctions.cs` — Blob Storage endpoints (upload/load/delete files)
  - `Services/AuditReviewService.cs` — GPT-5 Responses API integration
  - `Services/UserInstructionBuilder.cs` — Mode-switching logic (ported from JS)
  - `Services/TokenHelper.cs` — JWT token validation and userId extraction
  - `Services/CosmosDbService.cs` — Cosmos DB data access layer
  - `Services/BlobStorageService.cs` — Blob Storage data access layer

### Critical Data Concepts

- **`bs_extract`** is the single source of truth for balance sheet figures across all phases. It is extracted once in Step 0 and referenced everywhere else.
- **Traceability**: Every amount in the audit output must include `source_doc_id`, `page_ref`, `verbatim_quote`, and `computation` — this is enforced by the kernel constitution and evidence rules.
- **Three-way match** for expenses: Invoice, Payment evidence, Authority (e.g., AGM minutes or committee approval).
- **GST detection**: Automatically determined from Balance Sheet account names during Step 0.
- **Triage items** (`TriageItem`): Users flag issues at Critical/Medium/Low severity; these feed into AI Attempt targets for re-verification.

### Prompt System

The system prompt is assembled by `buildSystemPrompt()` in `src/audit_engine/index.ts`, composing: Constitution → Evidence Rules → Phase-specific workflow prompts → Item rules → Output registry. Each Call 2 phase mode (`levy`, `phase4`, `expenses`, `compliance`) gets a tailored subset via `call2_phase_prompts.ts`.

### State Management

React local state in `App.tsx` (no Redux). Key state: `plans[]` array, `activePlanId`, `azureUser`. Plans persist to Cosmos DB (`plans` container), files to Azure Blob Storage (`users/{userId}/plans/{planId}/`).

## Tech Stack

- **Frontend**: React 19, TypeScript 5.8, Vite 6, Tailwind CSS (CDN)
- **Backend**: Azure Functions (.NET 10, C#, Flex Consumption plan)
- **AI**: Azure OpenAI GPT-5.1-chat via Responses API (direct PDF input)
- **Auth**: Microsoft Entra ID via MSAL (`@azure/msal-browser`)
- **Database**: Azure Cosmos DB NoSQL API (proxied through Azure Functions)
- **Storage**: Azure Blob Storage (proxied through Azure Functions)
- **Prompt Editor**: Monaco Editor (`@monaco-editor/react`)
- **Validation**: Zod 4 for schema validation
- **Region**: Australia East

## Azure Resources (Provisioned)

| Resource | Name | Details |
|---|---|---|
| Resource Group | `rg-strata-audit` | Australia East |
| Azure OpenAI | `strata-audit-openai` | Endpoint: `https://strata-audit-openai.openai.azure.com/` |
| Model Deployment | `gpt-5.1-chat` | Model version `2025-11-13`, 150K TPM, auto-upgrade enabled |
| Function App | `strata-audit-functions` | .NET 10, Flex Consumption, Linux, 2048 MB |
| Function Endpoint | — | `https://strata-audit-functions.azurewebsites.net/api/executefullreview` |
| Cosmos DB | `strata-audit-cosmos` | NoSQL API, Serverless, db `strata-audit`, container `plans` |
| Blob Storage | `strataauditstorage` | Standard LRS, Hot tier, container `plan-files` |
| Entra ID App | `Strata Audit AI Assistance` | SPA redirect `localhost:3000` + custom domain |
| Static Web App | `strata-tax-review-assistance-web` | Custom domain: `https://strata-tax-review-assistance.kellypartners.com` |

## Environment Variables

Frontend uses `VITE_AZURE_*` env vars (`.env.local`, not committed). Azure Functions use `AZURE_OPENAI_*` settings (`local.settings.json`, gitignored). Production secrets are configured in Azure Portal → Function App → Application Settings. Path alias `@/*` maps to project root.

**Function App settings (configured in Azure Portal):**
- `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`
- `AZURE_COSMOS_ENDPOINT`, `AZURE_COSMOS_KEY`, `AZURE_COSMOS_DATABASE`
- `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER`
- `AZURE_AD_CLIENT_ID`, `AZURE_AD_TENANT_ID`
- `CORS_ALLOWED_ORIGINS`

See Azure Portal → Function App → Application Settings for actual values. Never commit secrets to source control.

## Conventions

- Files use camelCase naming; types use PascalCase
- The codebase is bilingual — comments and docs use a mix of English and Chinese
- `constants.ts` at root re-exports `buildSystemPrompt()` from the audit engine for backward compatibility
- `types.ts` at root re-exports types from `src/audit_outputs/type_definitions.ts`
- Azure Functions backend is .NET 10 / C#; frontend is TypeScript
- `services/` directory has re-export shims that forward to `src/services/` implementations

## Documentation

- `docs/plan.md` — Full Azure migration plan with phase details
- `docs/knowledge.md` — Technical decisions, architecture knowledge, API mappings
- `README.firebase.md` — Original Firebase version README (historical reference)
