/**
 * Azure audit API client - replaces src/services/gemini.ts
 * Calls the Azure Function executeFullReview endpoint.
 *
 * The request/response contract is identical to the Firebase Cloud Function version:
 * POST { files, systemPrompt, fileManifest, previousAudit, mode } → AuditResponse JSON
 *
 * Uses MSAL access token for Authorization header (replaces Firebase ID token).
 */

import {
  buildSystemPrompt,
  buildStep0Prompt,
  buildLevyPrompt,
  buildPhase4Prompt,
  buildExpensesPrompt,
  buildExpensesAdditionalPrompt,
  buildPhase5Prompt,
  buildAiAttemptPrompt,
} from "../audit_engine";
import type { AuditResponse } from "../audit_outputs/type_definitions";
import type { AiAttemptTarget } from "../audit_engine/ai_attempt_targets";
import { getAccessToken } from "./azure-auth";
import { getApiBaseUrl } from "./api-client";

function getFunctionUrl(): string {
  const base = getApiBaseUrl();
  return `${base}/api/executeFullReview`;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });

export interface CallExecuteFullReviewOptions {
  files: File[];
  filePaths?: string[];
  additionalRunPaths?: { runId: string; paths: string[] };
  previousAudit?: AuditResponse | null;
  expectedPlanId?: string;
  user?: { uid: string };
  mode?:
    | "step0_only"
    | "levy"
    | "phase4"
    | "expenses"
    | "expenses_additional"
    | "compliance"
    | "aiAttempt"
    | "full";
  step0Output?: AuditResponse | null;
  aiAttemptTargets?: AiAttemptTarget[];
  fileMeta?: { batch: "initial" | "additional" }[];
}

/**
 * Call the Azure Function executeFullReview endpoint.
 * Uses MSAL access token for auth (replaces Firebase ID token).
 */
export async function callExecuteFullReview(
  options: CallExecuteFullReviewOptions
): Promise<AuditResponse> {
  const {
    files,
    filePaths,
    additionalRunPaths,
    previousAudit,
    expectedPlanId,
    user,
    mode = "full",
    step0Output,
    aiAttemptTargets = [],
    fileMeta,
  } = options;

  // Get MSAL access token (replaces Firebase getIdToken)
  const accessToken = await getAccessToken();

  const fileManifest =
    mode === "aiAttempt" && fileMeta?.length === files.length
      ? files
          .map(
            (f, i) =>
              `File Part ${i + 1}: ${f.name}${fileMeta[i]?.batch === "additional" ? " [ADDITIONAL]" : ""}`
          )
          .join("\n")
      : files.map((f, i) => `File Part ${i + 1}: ${f.name}`).join("\n");

  const filesPayload = await Promise.all(
    files.map(async (file) => {
      const data = await fileToBase64(file);
      let mimeType = file.type || "";
      if (!mimeType && file.name.toLowerCase().endsWith(".pdf"))
        mimeType = "application/pdf";
      if (!mimeType && file.name.toLowerCase().endsWith(".csv"))
        mimeType = "text/csv";
      return {
        name: file.name,
        data,
        mimeType: mimeType || "application/pdf",
      };
    })
  );

  const url = getFunctionUrl();
  const systemPrompt =
    mode === "step0_only"
      ? buildStep0Prompt()
      : mode === "levy"
        ? buildLevyPrompt()
        : mode === "phase4"
          ? buildPhase4Prompt()
          : mode === "expenses"
            ? buildExpensesPrompt()
            : mode === "expenses_additional"
              ? buildExpensesAdditionalPrompt()
              : mode === "compliance"
                ? buildPhase5Prompt()
                : mode === "aiAttempt"
                  ? buildAiAttemptPrompt(aiAttemptTargets)
                  : buildSystemPrompt();

  const body: Record<string, unknown> = {
    files: filesPayload,
    filePaths,
    additionalRunPaths,
    expectedPlanId,
    planId: expectedPlanId,
    userId: user?.uid,
    systemPrompt,
    fileManifest,
    previousAudit:
      mode === "levy" ||
      mode === "phase4" ||
      mode === "expenses" ||
      mode === "expenses_additional" ||
      mode === "compliance" ||
      mode === "aiAttempt"
        ? step0Output
        : previousAudit ?? undefined,
    mode,
    aiAttemptTargets: mode === "aiAttempt" ? aiAttemptTargets : undefined,
    fileMeta,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    let errMessage: string;
    try {
      const errJson = JSON.parse(errText);
      errMessage = errJson.error || errText;
    } catch {
      errMessage = errText || res.statusText;
    }
    throw new Error(`Audit request failed: ${errMessage}`);
  }

  const json = (await res.json()) as AuditResponse;
  return json;
}

export { getFunctionUrl };
