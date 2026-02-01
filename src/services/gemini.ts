/**
 * 步骤 7 - 前端调用 Cloud Function executeFullReview
 * URL 使用 VITE_FUNCTION_URL 或默认 australia-southeast1 的 Function URL；
 * 请求带 Authorization: Bearer <Firebase ID Token>，body 含 files、expectedPlanId 及 Function 所需字段。
 */

import {
  buildSystemPrompt,
  buildStep0Prompt,
  buildLevyPrompt,
  buildPhase4Prompt,
  buildExpensesPrompt,
} from "../audit_engine";
import type { AuditResponse } from "../audit_outputs/type_definitions";
import { auth } from "./firebase";

const PROJECT_ID = "strata-audit-ai-reviewer";
const DIRECT_FUNCTION_URL =
  `https://australia-southeast1-${PROJECT_ID}.cloudfunctions.net/executeFullReview`;

/** 始终用直连 URL：Hosting rewrite 有 ~60s 超时，会导致 503 first byte timeout；直连可支持 9 分钟 */
function getFunctionUrl(): string {
  const envUrl = import.meta.env.VITE_FUNCTION_URL;
  return (typeof envUrl === "string" && envUrl.trim() !== "") ? envUrl.trim() : DIRECT_FUNCTION_URL;
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
  /** 可选：若 Cloud Function 已配置 Secret Manager 的 GEMINI_API_KEY，可不传 */
  apiKey?: string;
  previousAudit?: AuditResponse | null;
  expectedPlanId?: string;
  /** step0_only: 仅 Step 0；levy|phase4|expenses: Call 2 单阶段（需 step0Output）；full: 完整审计（默认） */
  mode?: "step0_only" | "levy" | "phase4" | "expenses" | "full";
  /** Call 2 时必传：Step 0 输出，作为 LOCKED 上下文注入 */
  step0Output?: AuditResponse | null;
}

/**
 * 调用 Cloud Function executeFullReview，返回审计结果。
 * 使用 Firebase ID Token 作为 Authorization: Bearer。
 */
export async function callExecuteFullReview(
  options: CallExecuteFullReviewOptions
): Promise<AuditResponse> {
  const {
    files,
    apiKey: apiKeyFromOptions,
    previousAudit,
    expectedPlanId,
    mode = "full",
    step0Output,
  } = options;
  const user = auth.currentUser;
  if (!user) {
    throw new Error("请先登录后再执行审计。");
  }
  const idToken = await user.getIdToken();

  const fileManifest = files.map((f, i) => `File Part ${i + 1}: ${f.name}`).join("\n");
  const filesPayload = await Promise.all(
    files.map(async (file) => {
      const data = await fileToBase64(file);
      let mimeType = file.type || "";
      if (!mimeType && file.name.toLowerCase().endsWith(".pdf")) mimeType = "application/pdf";
      if (!mimeType && file.name.toLowerCase().endsWith(".csv")) mimeType = "text/csv";
      return { name: file.name, data, mimeType: mimeType || "application/pdf" };
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
            : buildSystemPrompt();

  const body = {
    files: filesPayload,
    expectedPlanId,
    ...(apiKeyFromOptions ? {apiKey: apiKeyFromOptions} : {}),
    systemPrompt,
    fileManifest,
    previousAudit: (mode === "levy" || mode === "phase4" || mode === "expenses" ? step0Output : previousAudit) ?? undefined,
    mode,
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
    throw new Error(`审计请求失败: ${errMessage}`);
  }

  const json = (await res.json()) as AuditResponse;
  return json;
}

export { getFunctionUrl, DIRECT_FUNCTION_URL };
