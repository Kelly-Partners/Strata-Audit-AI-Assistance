/**
 * Strata Audit – 调用 Gemini 执行完整审计（Schema Mode）
 * 请求体：apiKey, systemPrompt, fileManifest, files: [{ name, data (base64), mimeType }], previousAudit?
 * 使用 responseJsonSchema 约束输出格式（由 scripts/generate-audit-schema.ts 生成）。
 */

const {GoogleGenAI} = require("@google/genai");

// 使用 Gemini 3.0 Pro（Preview），支持 Structured outputs；失败时回退到 2.5 系列。
const MODELS = ["gemini-3-pro-preview", "gemini-2.5-pro", "gemini-2.5-flash"];

// 不传 responseJsonSchema：完整 auditResponseSchema 嵌套过深，会触发 API 的 "exceeds maximum allowed nesting depth"。
// 仅用 responseMimeType: "application/json" + prompt 中的结构说明，由模型按说明输出 JSON。

/**
 * @param {object} opts
 * @param {string} opts.apiKey - Gemini API Key
 * @param {string} opts.systemPrompt - Audit Kernel system prompt（由前端 buildSystemPrompt() 传入）
 * @param {string} opts.fileManifest - "File Part 1: name1\nFile Part 2: name2..."
 * @param {Array<{name: string, data: string, mimeType?: string}>} opts.files - base64 文件列表
 * @param {object} [opts.previousAudit] - 增量更新时的当前审计结果
 * @returns {Promise<object>} AuditResponse JSON
 */
async function executeFullReview(opts) {
  const {apiKey, systemPrompt, fileManifest, files, previousAudit, mode = "full"} = opts;
  if (!apiKey || !systemPrompt || !fileManifest || !Array.isArray(files)) {
    throw new Error("Missing required: apiKey, systemPrompt, fileManifest, files");
  }

  const ai = new GoogleGenAI({apiKey});
  const fileParts = files.map((f) => ({
    inlineData: {
      data: f.data,
      mimeType: f.mimeType || "application/pdf",
    },
  }));

  const isStep0Only = mode === "step0_only";
  const isCall2Phase = mode === "levy" || mode === "phase4" || mode === "expenses" ||
    mode === "compliance" || mode === "completion" || mode === "aiAttempt";
  const call2PhaseLabels = {
    levy: "Phase 2 (Levy Reconciliation)",
    phase4: "Phase 4 (Balance Sheet Verification)",
    expenses: "Phase 3 (Expenses Vouching)",
    compliance: "Phase 5 (Statutory Compliance)",
    completion: "Phase 6 (Completion & Disclosure)",
    aiAttempt: "AI Attempt (Targeted Re-verification)",
  };
  const call2ReturnKeys = {
    levy: "\"levy_reconciliation\"",
    phase4: "\"assets_and_cash\"",
    expenses: "\"expense_samples\"",
    compliance: "\"statutory_compliance\"",
    completion: "\"completion_outputs\"",
    aiAttempt: "\"ai_attempt_updates\" and \"ai_attempt_resolution_table\"",
  };
  const userInstruction = isCall2Phase && previousAudit ?
    `
ATTACHED FILE MAPPING (Strictly map the binary parts to these names):
${fileManifest}

*** LOCKED ${mode === "completion" || mode === "aiAttempt" ? "AUDIT STATE (Step 0 + Phase 2–5 outputs)" : "STEP 0 OUTPUT"} (DO NOT RE-EXTRACT – USE AS-IS) ***
${JSON.stringify(previousAudit)}

*** CALL 2 – ${mode.toUpperCase()} ONLY ***
INSTRUCTIONS:
1. You MUST use the LOCKED context above. Do NOT re-extract document_register or intake_summary.
2. Use core_data_positions for document/page locations. Use intake_summary.financial_year as global FY.
3. Execute ${call2PhaseLabels[mode] || mode} ONLY.
4. Return ONLY ${call2ReturnKeys[mode] || mode}. No other keys.
${mode === "levy" ? `
5. [Phase 2 ONLY] Admin_Fund_Receipts and Capital_Fund_Receipts = Tier 2 ONLY. PriorYear/CurrentYear from bs_extract. Do NOT use GL as source for Effective_Levy_Receipts.
` : ""}
${mode === "phase4" ? `
5. [Phase 4 ONLY] bs_amount and line_item MUST be looked up from LOCKED bs_extract. supporting_amount per Evidence Tier: R2=Tier 1, R3/4=Tier 2, R5=Tier 3. Do NOT re-read Balance Sheet PDF. NO ELEVATION (Bank reconciliation ≠ Bank Statement).
` : ""}
${mode === "expenses" ? `
5. [Phase 3 ONLY] Apply Evidence Tier: Invoice & Payment PAID = Tier 1; ACCRUED = Tier 2 (Creditors Report); Authority = Tier 2 (Minutes). Do NOT substitute lower-tier evidence.
` : ""}
${mode === "completion" ? `
5. [Phase 6 ONLY] Aggregate issue_register from levy_reconciliation, assets_and_cash, expense_samples, statutory_compliance in the LOCKED context. Document boundary_disclosure from missing_critical_types, Not Resolved findings, boundary_defined, and bs_extract_warning.
` : ""}
${mode === "compliance" ? `
5. [Phase 5 ONLY] Apply Evidence Tier: Insurance = Tier 1 ONLY; GST = Tier 1/2; Income Tax = Tier 1/3. Use intake_summary.registered_for_gst from LOCKED context. If false or absent, output gst_reconciliation with all amounts = 0 and GST_Materiality = "N/A – Plan not registered for GST (per Step 0)".
` : ""}
${mode === "aiAttempt" ? `
5. [AI Attempt ONLY] Apply same Evidence Tier rules as initial phases. Re-verify ONLY the target items. Use [ADDITIONAL] files as new evidence. Return ai_attempt_updates (patch) AND ai_attempt_resolution_table (one row per target: item, issue_identified, ai_attempt_conduct, result, status).
` : ""}
` :
    previousAudit && !isStep0Only ?
    `
ATTACHED FILE MAPPING (Strictly map the binary parts to these names):
${fileManifest}

*** INCREMENTAL AUDIT UPDATE ***
CONTEXT: The user has provided additional evidence files.
CURRENT AUDIT STATE: ${JSON.stringify(previousAudit)}

INSTRUCTIONS:
1. Update the "document_register" with the new files. Use the exact names from the mapping above.
2. Check "missing_critical_types" in "intake_summary". If a missing doc is now provided, resolve it.
3. Return the merged JSON.
` :
    isStep0Only ?
      `
ATTACHED FILE MAPPING (Strictly map the binary parts to these names):
${fileManifest}

*** STEP 0 ONLY – DOCUMENT INTAKE ***
INSTRUCTIONS:
1. Execute Step 0 ONLY. Create the Document Dictionary. You MUST map "File Part 1" to the first name in the list above, "File Part 2" to the second, etc.
2. The "Document_Origin_Name" in the JSON MUST match the filename exactly.
3. Do NOT execute Phases 1–6. Return document_register, intake_summary, core_data_positions, and bs_extract. Do NOT include levy_reconciliation, assets_and_cash, expense_samples, statutory_compliance, or completion_outputs.
4. Extract strata_plan and financial_year from minutes/financials into intake_summary.
5. Populate core_data_positions with doc_id and page_range for each evidence type (balance_sheet, bank_statement, levy_report, etc.). Use null if not found.
6. Populate bs_extract: export the full Balance Sheet including Prior Year and Current Year columns. For each row: line_item, section, fund, prior_year, current_year. Use prior_year_label and current_year_label. This is the single source of truth for Phase 2 and Phase 4.
` :
      `
ATTACHED FILE MAPPING (Strictly map the binary parts to these names):
${fileManifest}

INSTRUCTIONS:
1. Step 0: Create the Document Dictionary. You MUST map "File Part 1" to the first name in the list above,
   "File Part 2" to the second, etc.
2. The "Document_Origin_Name" in the JSON MUST match the filename exactly.
3. Execute Phases 1-6 based on these files.
4. **MANDATORY – Step 0 bs_extract:** Export full Balance Sheet with prior_year and current_year for each line item. Single source of truth for Phase 2 and Phase 4.
5. **MANDATORY – Phase 2:** PriorYear_Arrears, PriorYear_Advance, CurrentYear_Arrears, CurrentYear_Advance MUST be looked up from LOCKED bs_extract ONLY. Do NOT use Levy Reports, GL, or any other source.
6. **MANDATORY – Phase 4 balance_sheet_verification:** bs_amount and line_item MUST be looked up from LOCKED bs_extract ONLY. supporting_amount from R2–R5 evidence (Bank Stmt, Levy Report, etc.). Fill note and supporting_note separately.
`;

  let lastError;
  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [...fileParts, {text: userInstruction}],
        },
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
        },
      });

      if (!response.text) throw new Error("Gemini returned an empty response.");

      let jsonString = response.text.trim();
      if (jsonString.startsWith("```json")) {
        jsonString = jsonString.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (jsonString.startsWith("```")) {
        jsonString = jsonString.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }
      return JSON.parse(jsonString);
    } catch (err) {
      lastError = err;
      if (err.message && err.message.startsWith("Gemini")) throw err;
      continue;
    }
  }
  throw lastError || new Error("Audit failed");
}

module.exports = {executeFullReview};
