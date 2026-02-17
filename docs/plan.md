# Azure Migration Plan

## Overview

Full migration from Google Gemini + Firebase to Azure enterprise solution.

**Key architectural decision:** GPT-5 on Azure supports direct PDF file input via the Responses API, so no need for Azure Document Intelligence. This keeps the architecture single-stage (like Gemini), simplifying the migration.

## Phase Summary

| Phase | Component | From | To | Status |
|---|---|---|---|---|
| 1 | AI Backend | Firebase Cloud Functions + Gemini | Azure Functions (.NET 10) + GPT-5.1-chat Responses API | Code Done |
| 2 | Frontend API | `gemini.ts` (Firebase Function client) | `auditApi.ts` (Azure Function client) | Code Done |
| 3 | Authentication | Firebase Auth | Microsoft Entra ID (MSAL) | Code Done |
| 4 | Database | Firestore | Azure Cosmos DB (NoSQL API) | Code Done |
| 5 | File Storage | Firebase Cloud Storage | Azure Blob Storage | Code Done |
| 6 | Cleanup | Remove Firebase dependencies | Azure-only codebase | Done |
| 7 | Prompt Admin | N/A (hardcoded prompts) | Prompt Admin & Playground page | Code Done |
| 8 | Hosting | Firebase Hosting | Azure Static Web Apps | Not started |

### Azure Resource Provisioning Status

| Step | Resource | Status | Details |
|---|---|---|---|
| 1 | Azure OpenAI | **Deployed** | `strata-audit-openai`, model `gpt-5.1-chat` (v2025-11-13), 150K TPM |
| 2 | Azure Function App | **Deployed** | `strata-audit-functions`, .NET 10, Flex Consumption, verified working |
| 3 | Azure Cosmos DB | **Deployed** | `strata-audit-cosmos`, NoSQL API, Serverless, db `strata-audit`, container `plans` (`/userId`) |
| 4 | Azure Blob Storage | **Deployed** | `strataauditstorage`, Standard LRS, Hot tier, container `plan-files` |
| 5 | Microsoft Entra ID | **Deployed** | App `Strata Audit AI Assistance`, client ID `5276b52b-...`, tenant `b35ee03f-...` |
| 6 | Azure Static Web Apps | **Deployed** | `strata-tax-review-assistance-web`, custom domain: `https://strata-tax-review-assistance.kellypartners.com` |

## Detailed Phase Notes

### Phase 1: AI Backend

**Architecture change:** Single-stage pipeline mirrors Gemini

```
Gemini:  base64 PDF → Gemini inlineData → Gemini reasons → JSON
Azure:   base64 PDF → GPT-5.1-chat input_file → GPT-5.1-chat reasons → JSON
```

**Key files created:**
- `StrataAudit.Functions/` - .NET 10 Azure Functions project
- `Functions/ExecuteFullReviewFunction.cs` - HTTP trigger (POST /api/executeFullReview)
- `Services/AuditReviewService.cs` - GPT-5.1-chat Responses API integration
- `Services/UserInstructionBuilder.cs` - Mode-switching logic ported from `functions/geminiReview.js`

**API mapping:**
| Gemini | Azure OpenAI |
|---|---|
| `inlineData: { mimeType, data }` | `input_file: { filename, file_data }` |
| `systemInstruction` | `instructions` parameter |
| `responseMimeType: "application/json"` | `text.format: { type: "json_object" }` |
| Chat Completions API | Responses API (`/openai/v1/responses`) |

**Deployed Azure resources:**
- OpenAI resource: `strata-audit-openai` (endpoint: `https://strata-audit-openai.openai.azure.com/`)
- Model: `gpt-5.1-chat` (v2025-11-13, 150K TPM, auto-upgrade enabled, retiring March 31 2026)
- Function App: `strata-audit-functions` (endpoint: `https://strata-audit-functions.azurewebsites.net/api/executefullreview`)
- Function App settings configured: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`
- CORS: `http://localhost:3000` (SWA domain to be added post-deployment)

### Phase 3: Authentication

**MSAL replaces Firebase Auth with these mappings:**
| Firebase | MSAL |
|---|---|
| `onAuthStateChanged(auth, callback)` | `msalOnAuthStateChanged(callback)` via event callbacks |
| `signInWithPopup(auth, GoogleAuthProvider)` | `msalInstance.loginPopup()` |
| `signInWithEmailAndPassword(auth, email, pw)` | MSAL B2C ROPC or popup |
| `signOut(auth)` | `msalInstance.logoutPopup()` |
| `user.getIdToken()` | `msalInstance.acquireTokenSilent()` |
| `User` type | `AzureUser` adapter type |

### Phase 4: Database

**Cosmos DB NoSQL API replaces Firestore — proxied through Azure Functions:**

All Cosmos DB operations are proxied through Azure Functions (no direct SDK access from frontend). The backend holds the Cosmos DB connection key server-side and extracts userId from the MSAL Bearer JWT token.

| Frontend function | Azure Function endpoint | Cosmos DB operation |
|---|---|---|
| `savePlanToCosmosDB(planId, data)` | `PUT /api/plans/{planId}` | `container.items.upsert(data)` |
| `getPlansFromCosmosDB(userId)` | `GET /api/plans` | `SELECT * FROM c WHERE c.userId = @uid` |
| `deletePlanFromCosmosDB(planId, userId)` | `DELETE /api/plans/{planId}` | `container.item(id, partitionKey).delete()` |

Container: `plans` with partition key `/userId`

### Phase 5: File Storage

**Azure Blob Storage replaces Firebase Cloud Storage — proxied through Azure Functions:**

All Blob Storage operations are proxied through Azure Functions (no direct SDK access from frontend). Files are sent as base64 JSON payloads.

| Frontend function | Azure Function endpoint | Blob operation |
|---|---|---|
| `uploadPlanFiles(userId, planId, files)` | `POST /api/plans/{planId}/files` | Upload base64 files to blobs |
| `loadPlanFilesFromStorage(filePaths)` | `POST /api/plans/{planId}/files/load` | Download blobs as base64 |
| `deletePlanFilesFromStorage(userId, planId)` | `DELETE /api/plans/{planId}/files` | Delete all plan blobs |

Container: `plan-files`, path structure: `users/{userId}/plans/{planId}/{fileName}`

### Phase 7: Prompt Admin

New `PromptAdmin.tsx` component with:
- Monaco editor for prompt editing
- Phase selection dropdown
- Test runner (upload PDFs → run single phase → see results)
- Threshold controls (materiality, tolerance, GST rate, etc.)

## Azure Resources (Manual Portal Setup)

1. **Azure OpenAI** — `strata-audit-openai`, GPT-5.1-chat deployed, Australia East ✅
2. **Azure Function App** — `strata-audit-functions`, .NET 10 isolated worker, Flex Consumption, Australia East ✅
3. **Azure Cosmos DB** — `strata-audit-cosmos`, NoSQL API, Serverless, database `strata-audit`, container `plans` (partition key `/userId`) ✅
4. **Azure Blob Storage** — `strataauditstorage`, Standard LRS, Hot tier, container `plan-files` ✅
5. **Microsoft Entra ID** — App registration `Strata Audit AI Assistance`, SPA redirect `http://localhost:3000` ✅
6. **Azure Static Web Apps** — `strata-tax-review-assistance-web`, custom domain: `https://strata-tax-review-assistance.kellypartners.com` ✅

## Build Verification

- [x] Frontend `npm run build` — passes (zero errors, one warning: 1.3MB chunk size from Monaco editor)
- [x] Backend `dotnet build` — passes (zero errors, zero warnings)
- [x] Azure Function local test (`func start` + curl) — returns expected 400 validation error
- [x] Azure Function deployed and live — returns expected 400 validation error at production URL

## Cleanup Completed

- [x] Deleted old Firebase/Gemini files: `services/firebase.ts`, `services/gemini.ts`, `services/geminiService.ts`, `services/planPersistence.ts`
- [x] Deleted old source implementations: `src/services/firebase.ts`, `src/services/gemini.ts`, `src/services/geminiService.ts`, `src/services/planPersistence.ts`
- [x] Deleted Firebase config: `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `storage.rules`
- [x] Deleted entire `functions/` directory (old Firebase Cloud Functions)
- [x] Kept `services/mergeAiAttemptUpdates.ts` (still used by App.tsx)
- [x] Updated `.gitignore` for Azure project structure (secrets, .NET artifacts, IDE files)

## End-to-End Verification Checklist

- [x] Azure Function responds to POST → returns expected validation error
- [ ] Frontend loads at SWA URL
- [ ] Microsoft sign-in works, user sees dashboard
- [ ] Create plan → files upload to Blob Storage
- [ ] Run Step 0 → audit result saved to Cosmos DB
- [ ] Refresh page → plan and files persist
- [ ] Run Call 2 → four phases complete in parallel
- [ ] AI Attempt → re-verification with additional evidence
- [ ] Phase 6 Completion → final aggregated report
- [ ] Prompt Admin → edit prompt → test → see results
