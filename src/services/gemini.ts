/**
 * 步骤 7 - 前端调用 Cloud Function executeFullReview
 * URL 使用 VITE_FUNCTION_URL 或默认 australia-southeast1 的 Function URL；
 * 请求带 Authorization: Bearer <Firebase ID Token>，body 含 filePaths（后端从 Storage 拉取文件）、expectedPlanId 等。
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
import { auth } from "./firebase";

const PROJECT_ID = "strata-audit-ai-reviewer";
const DIRECT_FUNCTION_URL =
  `https://australia-southeast1-${PROJECT_ID}.cloudfunctions.net/executeFullReview`;

/** 始终用直连 URL：Hosting rewrite 有 ~60s 超时，会导致 503 first byte timeout；直连可支持 9 分钟 */
function getFunctionUrl(): string {
  const envUrl = import.meta.env.VITE_FUNCTION_URL;
  return (typeof envUrl === "string" && envUrl.trim() !== "") ? envUrl.trim() : DIRECT_FUNCTION_URL;
}

export interface CallExecuteFullReviewOptions {
  /** Storage 路径数组，后端从 Storage 拉取文件 */
  filePaths: string[];
  /** expenses_additional 时必传：本次补充证据的 runId 与 paths */
  additionalRunPaths?: { runId: string; paths: string[] };
  /** 可选：若 Cloud Function 已配置 Secret Manager 的 GEMINI_API_KEY，可不传 */
  apiKey?: string;
  previousAudit?: AuditResponse | null;
  expectedPlanId?: string;
  /** step0_only: 仅 Step 0；levy|phase4|expenses|expenses_additional|compliance|completion|aiAttempt: Call 2 单阶段（需 step0Output）；full: 完整审计（默认） */
  mode?: "step0_only" | "levy" | "phase4" | "expenses" | "expenses_additional" | "compliance" | "completion" | "aiAttempt" | "full";
  /** Call 2 时必传：Step 0 输出，作为 LOCKED 上下文注入 */
  step0Output?: AuditResponse | null;
  /** aiAttempt 时必传：待重核项列表 */
  aiAttemptTargets?: AiAttemptTarget[];
  /** aiAttempt 时可选：标记新增证据 [ADDITIONAL]，与 filePaths 一一对应 */
  fileMeta?: { batch: "initial" | "additional" }[];
}

/**
 * 调用 Cloud Function executeFullReview，返回审计结果。
 * 后端根据 filePaths 从 Storage 拉取文件，不再传 base64。
 */
export async function callExecuteFullReview(
  options: CallExecuteFullReviewOptions
): Promise<AuditResponse> {
  const {
    filePaths,
    additionalRunPaths,
    apiKey: apiKeyFromOptions,
    previousAudit,
    expectedPlanId,
    mode = "full",
    step0Output,
    aiAttemptTargets = [],
    fileMeta,
  } = options;
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Please sign in to run the audit.");
  }
  const idToken = await user.getIdToken();

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

  const body = {
    filePaths,
    ...(additionalRunPaths ? { additionalRunPaths } : {}),
    expectedPlanId,
    planId: expectedPlanId,
    userId: user.uid,
    ...(apiKeyFromOptions ? {apiKey: apiKeyFromOptions} : {}),
    systemPrompt,
    previousAudit: (mode === "levy" || mode === "phase4" || mode === "expenses" || mode === "expenses_additional" || mode === "compliance" || mode === "aiAttempt" ? step0Output : previousAudit) ?? undefined,
    mode,
    aiAttemptTargets: mode === "aiAttempt" ? aiAttemptTargets : undefined,
    ...(mode === "aiAttempt" && fileMeta?.length ? { fileMeta } : {}),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
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

export { getFunctionUrl, DIRECT_FUNCTION_URL };
