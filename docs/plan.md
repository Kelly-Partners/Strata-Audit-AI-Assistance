# Azure Migration Plan

## Overview

Full migration from Google Gemini + Firebase to Azure enterprise solution. **Migration complete.**

**Key architectural decision:** GPT-5 on Azure supports direct PDF file input via the Responses API, so no need for Azure Document Intelligence. This keeps the architecture single-stage (like Gemini), simplifying the migration.

## Phase Summary

| Phase | Component | From | To | Status |
|---|---|---|---|---|
| 1 | AI Backend | Firebase Cloud Functions + Gemini | Azure Functions (.NET 10) + GPT-5 Responses API | **Done** |
| 2 | Frontend API | `gemini.ts` (Firebase Function client) | `auditApi.ts` (Azure Function client) | **Done** |
| 3 | Authentication | Firebase Auth | Microsoft Entra ID (MSAL) | **Done** |
| 4 | Database | Firestore | Azure Cosmos DB (NoSQL API, proxied through Functions) | **Done** |
| 5 | File Storage | Firebase Cloud Storage | Azure Blob Storage (proxied through Functions) | **Done** |
| 6 | Cleanup | Remove Firebase dependencies | Azure-only codebase | **Done** |
| 7 | Prompt Admin | N/A (hardcoded prompts) | Prompt Admin & Playground page | **Done** |
| 8 | Hosting | Firebase Hosting | Azure Static Web Apps | **Done** |

### Azure Resource Provisioning Status

| Step | Resource | Status | Details |
|---|---|---|---|
| 1 | Azure OpenAI | **Deployed** | `strata-audit-openai`, model `gpt-5.1-chat` (v2025-11-13), 150K TPM |
| 2 | Azure Function App | **Deployed** | `strata-audit-functions`, .NET 10, Flex Consumption, 8 endpoints live |
| 3 | Azure Cosmos DB | **Deployed** | `strata-audit-cosmos`, NoSQL API, Serverless, db `strata-audit`, container `plans` (`/userId`) |
| 4 | Azure Blob Storage | **Deployed** | `strataauditstorage`, Standard LRS, Hot tier, container `plan-files` |
| 5 | Microsoft Entra ID | **Deployed** | App `Strata Audit AI Assistance`, client ID `5276b52b-...`, tenant `b35ee03f-...` |
| 6 | Azure Static Web Apps | **Deployed** | `strata-tax-review-assistance-web`, URL: `https://calm-bay-04b28e900.6.azurestaticapps.net` |

## Detailed Phase Notes

### Phase 1: AI Backend

**Architecture change:** Single-stage pipeline mirrors Gemini

```
Gemini:  base64 PDF → Gemini inlineData → Gemini reasons → JSON
Azure:   base64 PDF → GPT-5 input_file → GPT-5 reasons → JSON
```

**Key files created:**
- `StrataAudit.Functions/` - .NET 10 Azure Functions project
- `Functions/ExecuteFullReviewFunction.cs` - HTTP trigger (POST /api/executeFullReview), supports server-side file fetching from Blob Storage
- `Services/AuditReviewService.cs` - GPT-5 Responses API integration
- `Services/UserInstructionBuilder.cs` - Mode-switching logic with Evidence Tier enforcement per phase

**API mapping:**
| Gemini | Azure OpenAI |
|---|---|
| `inlineData: { mimeType, data }` | `input_file: { filename, file_data }` |
| `systemInstruction` | `instructions` parameter |
| `responseMimeType: "application/json"` | `text.format: { type: "json_object" }` |
| Chat Completions API | Responses API (`/openai/v1/responses`) |

### Phase 3: Authentication

**MSAL replaces Firebase Auth with these mappings:**
| Firebase | MSAL |
|---|---|
| `onAuthStateChanged(auth, callback)` | `msalOnAuthStateChanged(callback)` via event callbacks |
| `signInWithPopup(auth, GoogleAuthProvider)` | `msalInstance.loginRedirect()` |
| `signOut(auth)` | `msalInstance.logoutRedirect()` |
| `user.getIdToken()` | `msalInstance.acquireTokenSilent()` |
| `User` type | `AzureUser` adapter type |

### Phase 4: Database (Proxied)

**Cosmos DB NoSQL API replaces Firestore — all operations proxied through Azure Functions:**

| Frontend function | Azure Function endpoint | Cosmos DB operation |
|---|---|---|
| `savePlanToCosmosDB(planId, data)` | `PUT /api/plans/{planId}` | `container.items.upsert(data)` |
| `getPlansFromCosmosDB(userId)` | `GET /api/plans` | `SELECT * FROM c WHERE c.userId = @uid` |
| `deletePlanFromCosmosDB(planId, userId)` | `DELETE /api/plans/{planId}` | `container.item(id, partitionKey).delete()` |

Container: `plans` with partition key `/userId`

### Phase 5: File Storage (Proxied)

**Azure Blob Storage replaces Firebase Cloud Storage — all operations proxied through Azure Functions:**

| Frontend function | Azure Function endpoint | Blob operation |
|---|---|---|
| `uploadPlanFiles(userId, planId, files)` | `POST /api/plans/{planId}/files` | Upload base64 files to blobs |
| `uploadAdditionalRunFiles(userId, planId, runId, files)` | `POST /api/plans/{planId}/files` (with runId) | Upload additional evidence files |
| `loadPlanFilesFromStorage(filePaths)` | `POST /api/plans/{planId}/files/load` | Download blobs as base64 |
| `getFileUrl(planId, blobPath)` | `POST /api/plans/{planId}/files/url` | Generate time-limited SAS URL for PDF viewing |
| `deletePlanFilesFromStorage(userId, planId)` | `DELETE /api/plans/{planId}/files` | Delete all plan blobs |

Container: `plan-files`, path structure: `users/{userId}/plans/{planId}/{fileName}`

**Server-side file fetching:** `ExecuteFullReviewFunction` can fetch files directly from Blob Storage when `filePaths` are provided but `files[]` is empty, avoiding re-upload of large PDFs for Call 2 phases.

### Phase 7: Prompt Admin

New `PromptAdmin.tsx` component with:
- Monaco editor for prompt editing
- Phase selection dropdown
- Test runner (upload PDFs → run single phase → see results)
- Threshold controls (materiality, tolerance, GST rate, etc.)

## Build Verification

- [x] Frontend `npm run build` — passes (zero errors; chunk size warning from Monaco editor — acceptable)
- [x] Backend `dotnet build` — passes (zero errors, zero warnings)
- [x] Azure Functions deployed and live — 8 endpoints registered
- [x] Azure Static Web Apps deployed to production

## Cleanup Completed

- [x] Deleted old Firebase/Gemini files: `services/firebase.ts`, `services/gemini.ts`, `services/geminiService.ts`, `services/planPersistence.ts`
- [x] Deleted old source implementations: `src/services/firebase.ts`, `src/services/gemini.ts`, `src/services/geminiService.ts`, `src/services/planPersistence.ts`
- [x] Deleted Firebase config: `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `storage.rules`
- [x] Deleted entire `functions/` directory (old Firebase Cloud Functions)
- [x] Updated `.gitignore` for Azure project structure (secrets, .NET artifacts, IDE files)
- [x] Removed `@azure/cosmos` and `@azure/storage-blob` from frontend `package.json` (server-side only)

## Upstream Port (15 commits from main)

Ported all audit engine updates from the accountant's main branch commits to develop:

- **Evidence Tier System** — 3-tier classification elevated to Supreme Protocol, per-phase enforcement
- **P&L Extract** (`pl_extract`) — New Step 0 output for Income & Expenditure
- **Expense Phase Overhaul** — 5 selection dimensions, 6 invoice checks, 9 payment checks
- **Multi-round Expense Runs** — `expenses_additional` mode for supplementary evidence vouching
- **Levy Per-Fund Split** — Interest/Discount split into Admin/Sinking/Total, GST on special levies
- **Phase 6 Removed** — Completion now shows user resolutions, not AI-generated output
- **AI Attempt → Explain-only** — Produces resolution table but does not merge into report data
- **System Triage** — Auto-generated from Phase 2-5 non-reconciled results
- **User Resolutions** — Mark-off workflow (Resolve/Flag/Override) replacing deprecated UserOverride
- **UI Redesign** — K+P blue branding (#004F9F), semantic font tokens, shimmer skeleton

## End-to-End Verification Checklist

- [x] Azure Function responds to POST → returns expected validation error
- [x] Frontend deployed to SWA production URL
- [ ] Microsoft sign-in works, user sees dashboard
- [ ] Create plan → files upload to Blob Storage
- [ ] Run Step 0 → audit result saved to Cosmos DB
- [ ] Refresh page → plan and files persist
- [ ] Run Call 2 → four phases complete in parallel
- [ ] AI Attempt → re-verification with resolution table
- [ ] Forensic PDF viewer → SAS URL opens source document
- [ ] Prompt Admin → edit prompt → test → see results
