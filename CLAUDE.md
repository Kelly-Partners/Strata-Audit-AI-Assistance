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

# Frontend deployment (Azure Static Web Apps)
npm run build
npx @azure/static-web-apps-cli deploy ./dist --app-name strata-tax-review-assistance-web --env production

# Full deployment (both)
cd StrataAudit.Functions && func azure functionapp publish strata-audit-functions
cd .. && npm run build && npx @azure/static-web-apps-cli deploy ./dist --app-name strata-tax-review-assistance-web --env production
```

## Architecture

### Execution Pipeline

The audit runs in a fixed sequence of steps, each producing structured JSON output consumed by later steps:

1. **Step 0 (Document Intake)** — Extracts `document_register`, `intake_summary`, `core_data_positions`, `bs_extract`, `pl_extract` from uploaded PDFs/CSVs
2. **Call 2 (4 parallel phases)** — Runs Phase 2 (Levy), Phase 3 (Expenses), Phase 4 (Balance Sheet), Phase 5 (Compliance) concurrently, each receiving Step 0 output as locked context
3. **Expenses Additional** (optional) — Supplementary evidence vouching for expense items using additional uploaded documents
4. **AI Attempt** — Targeted re-verification of flagged/failed items from phases + user triage; produces resolution table (explain-only, does not merge into report data)

Each phase call goes through: `App.tsx` → `services/auditApi.ts` → Azure Function (`StrataAudit.Functions/`) → Azure OpenAI GPT-5 Responses API with direct PDF input.

### Evidence Tier System (Supreme Protocol)

Evidence is classified into three tiers, enforced per phase:
- **Tier 1** — Independent third-party documents (Bank Statements, Insurance Policies, ATO notices)
- **Tier 2** — Internal-authoritative documents (Levy Reports, Creditors Reports, Cash Management Reports)
- **Tier 3** — Accounting system outputs (GL, Financial Statements, Notes)

Higher-tier evidence is **required** for specific line items (e.g., Cash at Bank requires Tier 1 Bank Statement — a Bank Reconciliation at Tier 2 is NOT acceptable). Enforcement rules are defined per phase in `UserInstructionBuilder.cs` and the prompt workflow files.

### Key Directories

- **`src/audit_engine/`** — Core audit logic: prompt builders, phase workflows, kernel rules
  - `kernel/` — Constitution (audit hierarchy) and evidence rules (Supreme Protocol)
  - `workflow/` — Per-phase prompt construction (`step_0_intake.ts`, `phase_2_revenue.ts`, `phase_3_expenses.ts`, `phase_4_assets.ts`, `phase_5_compliance.ts`, `phase_ai_attempt.ts`)
  - `rules/` — Phase-specific item rules (evidence priority, whitelist doc types). See `rules/README.md` for adding new rules
  - `ai_attempt_targets.ts` — Builds target list for re-verification from phase results + triage items; includes `buildSystemTriageItems()` and `mergeTriageWithSystem()`
  - `call2_phase_prompts.ts` — Phase-specific prompt composition for Call 2 modes
- **`src/audit_outputs/`** — Output schema layer
  - `type_definitions.ts` — All TypeScript interfaces (`AuditResponse`, `DocumentEntry`, `BsExtract`, `PlExtract`, `LevyRecMaster`, `ExpenseSample`, `InvoiceChecks`, `PaymentChecks`, `UserResolution`, `ExpenseRun`, etc.)
  - `schema_definitions.ts` — Zod validation schemas matching the types
  - `json_schema.ts` — JSON Schema export used for structured output
  - `output_registry.ts` — Module 50 prompt defining output structure
- **`src/services/`** — Azure service integrations (all data operations proxied through Azure Functions)
  - `api-client.ts` — Shared `apiFetch()` helper with Bearer token and base URL
  - `azure-auth.ts` — MSAL authentication (Microsoft Entra ID)
  - `azure-cosmos.ts` — Cosmos DB plan persistence (via Azure Function proxy)
  - `azure-storage.ts` — Azure Blob Storage file management (via Azure Function proxy), includes `getFileUrl()` for SAS URL generation
  - `auditApi.ts` — Azure Function API client for audit execution
  - `expenseRunsHelpers.ts` — Multi-round expense run utilities (`getEffectiveExpenseSamples()`, `ensureExpenseRuns()`)
- **`services/`** — Re-export shims for convenient imports from App.tsx
- **`components/`** — `AuditReport.tsx` (tabbed report with ForensicCell + PDF viewer), `FileUpload.tsx`, `ReportSkeleton.tsx` (loading shimmer), `PromptAdmin.tsx` (prompt editor & playground)
- **`StrataAudit.Functions/`** — Azure Functions backend (.NET 10, C#)
  - `Functions/ExecuteFullReviewFunction.cs` — HTTP trigger for AI audit execution (supports server-side file fetching from Blob)
  - `Functions/PlanFunctions.cs` — Cosmos DB CRUD endpoints (GET/PUT/DELETE plans)
  - `Functions/PlanFileFunctions.cs` — Blob Storage endpoints (upload/load/delete/url files)
  - `Services/AuditReviewService.cs` — GPT-5 Responses API integration
  - `Services/UserInstructionBuilder.cs` — Mode-switching logic with Evidence Tier enforcement per phase
  - `Services/TokenHelper.cs` — JWT token validation and userId extraction
  - `Services/CosmosDbService.cs` — Cosmos DB data access layer
  - `Services/BlobStorageService.cs` — Blob Storage data access layer (includes SAS URL generation)

### Azure Function Endpoints

| Method | Route | Function | Purpose |
|--------|-------|----------|---------|
| POST | `/api/executeFullReview` | `executeFullReview` | AI-powered audit execution via GPT-5 |
| PUT | `/api/plans/{planId}` | `UpsertPlan` | Create/update plan document |
| GET | `/api/plans` | `GetPlans` | List all plans for authenticated user |
| DELETE | `/api/plans/{planId}` | `DeletePlan` | Delete plan document |
| POST | `/api/plans/{planId}/files` | `UploadPlanFiles` | Upload files (base64 JSON body) |
| POST | `/api/plans/{planId}/files/load` | `LoadPlanFiles` | Download files by paths (returns base64) |
| POST | `/api/plans/{planId}/files/url` | `GetFileUrl` | Generate time-limited SAS URL for PDF viewing |
| DELETE | `/api/plans/{planId}/files` | `DeletePlanFiles` | Delete all files for a plan |

### Critical Data Concepts

- **`bs_extract`** is the single source of truth for balance sheet figures across all phases. It is extracted once in Step 0 and referenced everywhere else.
- **`pl_extract`** is the single source of truth for P&L (Income & Expenditure) figures. Extracted in Step 0.
- **Evidence Tier enforcement**: Every amount must cite evidence at the correct tier. Tier violations are flagged as errors.
- **Traceability**: Every amount in the audit output must include `source_doc_id`, `page_ref`, `verbatim_quote`, and `computation` — enforced by the kernel constitution and evidence rules.
- **Expense vouching**: 5 selection dimensions (VALUE_COVERAGE, RISK_KEYWORD, MATERIALITY, ANOMALY_DESCRIPTION, SPLIT_PATTERN), 6 invoice checks, 9 payment checks. Invoice & Payment PAID = Tier 1; Payment ACCRUED = Tier 2.
- **GST detection**: Automatically determined from Balance Sheet account names during Step 0.
- **Triage items** (`TriageItem`): Users flag issues at Critical/Medium/Low severity; system auto-generates triage from non-reconciled items via `buildSystemTriageItems()`. These feed into AI Attempt targets.
- **User Resolutions** (`UserResolution`): Mark-off workflow — users can Resolve, Flag, or Override triage items with comments.
- **Multi-round expense runs** (`ExpenseRun`): Additional evidence files can be uploaded and vouched in separate rounds via `expenses_additional` mode.

### Prompt System

The system prompt is assembled by `buildSystemPrompt()` in `src/audit_engine/index.ts`, composing: Constitution → Evidence Rules (Supreme Protocol) → Phase-specific workflow prompts → Item rules → Output registry. Each Call 2 phase mode (`levy`, `phase4`, `expenses`, `expenses_additional`, `compliance`) gets a tailored subset via `call2_phase_prompts.ts`.

### State Management

React local state in `App.tsx` (no Redux). Key state: `plans[]` array, `activePlanId`, `azureUser`. Plans persist to Cosmos DB (`plans` container), files to Azure Blob Storage (`users/{userId}/plans/{planId}/`).

## Tech Stack

- **Frontend**: React 19, TypeScript 5.8, Vite 6, Tailwind CSS (CDN)
- **Backend**: Azure Functions (.NET 10, C#, Flex Consumption plan)
- **AI**: Azure OpenAI GPT-5 via Responses API (direct PDF input)
- **Auth**: Microsoft Entra ID via MSAL (`@azure/msal-browser`)
- **Database**: Azure Cosmos DB NoSQL API (proxied through Azure Functions)
- **Storage**: Azure Blob Storage (proxied through Azure Functions)
- **Prompt Editor**: Monaco Editor (`@monaco-editor/react`)
- **Validation**: Zod 4 for schema validation
- **Region**: Australia East

## Azure Resources

| Resource | Name | Details |
|---|---|---|
| Resource Group | `rg-strata-audit` | Australia East |
| Azure OpenAI | `strata-audit-openai` | Endpoint: `https://strata-audit-openai.openai.azure.com/` |
| Model Deployment | `gpt-5.1-chat` | Model version `2025-11-13`, 150K TPM, auto-upgrade enabled |
| Function App | `strata-audit-functions` | .NET 10, Flex Consumption, Linux, 2048 MB, 8 endpoints |
| Cosmos DB | `strata-audit-cosmos` | NoSQL API, Serverless, db `strata-audit`, container `plans` |
| Blob Storage | `strataauditstorage` | Standard LRS, Hot tier, container `plan-files` |
| Entra ID App | `Strata Audit AI Assistance` | SPA redirect `localhost:3000` + custom domain |
| Static Web App | `strata-tax-review-assistance-web` | URL: `https://calm-bay-04b28e900.6.azurestaticapps.net` |

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
