/**
 * Call 2 – Phase-specific prompts for Levy, Phase4 (BS Verification), Expenses.
 * Each runs with Step 0 output as LOCKED context (injected in userInstruction).
 */

import { HIERARCHY_INTRO, HIERARCHY_AFTER_EVIDENCE } from "./kernel/00_constitution";
import { EVIDENCE_RULES_PROMPT } from "./kernel/20_evidence_rules";
import { PHASE_2_RULES_PROMPT, PHASE_4_RULES_PROMPT } from "./rules";
import { PHASE_2_REVENUE_PROMPT } from "./workflow/phase_2_revenue";
import { PHASE_4_ASSETS_PROMPT } from "./workflow/phase_4_assets";
import { PHASE_3_EXPENSES_PROMPT, EXPENSE_RISK_FRAMEWORK, PHASE_3_FUND_INTEGRITY, PHASE_3_ADDITIONAL_PROMPT } from "./workflow/phase_3_expenses";
import { PHASE_5_COMPLIANCE_PROMPT } from "./workflow/phase_5_compliance";
import { PHASE_AI_ATTEMPT_PROMPT } from "./workflow/phase_ai_attempt";
import { MODULE_50_OUTPUTS_PROMPT } from "../audit_outputs/output_registry";

const LOCKED_CONTEXT_INSTRUCTION = `
--- CALL 2 – LOCKED STEP 0 CONTEXT ---
The user message will contain LOCKED STEP 0 OUTPUT. You MUST use it. Do NOT re-extract document_register or intake_summary.
Use core_data_positions for document/page locations. Use intake_summary.financial_year as the global FY. Use bs_extract as the sole source for Balance Sheet data – PriorYear_*/CurrentYear_* (Phase 2) and bs_amount (Phase 4) MUST be looked up from bs_extract.
`;

/** Levy-only output: return levy_reconciliation */
const LEVY_OUTPUT_SCHEMA = `
--- OUTPUT: Return ONLY levy_reconciliation ---
You must return a JSON object with a single key "levy_reconciliation" containing master_table and high_risk_debtors.
See MODULE 50 for the full levy_reconciliation structure. Apply all Phase 2 formulas and sourcing rules.
`;

/** Phase 4 only output: return assets_and_cash */
const PHASE4_OUTPUT_SCHEMA = `
--- OUTPUT: Return ONLY assets_and_cash ---
You must return a JSON object with a single key "assets_and_cash" containing balance_sheet_verification array.
See MODULE 50 for the full assets_and_cash structure. Apply Phase 4 rules R1–R5 strictly. supporting_amount per R2–R5.
`;

/** Expenses additional output: document_register (merged) + expense_samples_additional (re-vouched items only) */
const EXPENSES_ADDITIONAL_OUTPUT_SCHEMA = `
--- OUTPUT: Return document_register AND expense_samples_additional ---
You must return a JSON object with TWO keys:

1) "document_register" – MERGED array (existing rows + new rows for attached files). Assign Document_ID for new files (continue numbering, e.g. Sys_007).
2) "expense_samples_additional" – array of expense items that were re-vouched using the new evidence. Same structure as expense_samples (GL_ID, GL_Date, GL_Payee, GL_Amount, Risk_Profile, Three_Way_Match, Fund_Integrity, Overall_Status). Include ONLY items where new evidence was matched and used.

Do NOT return items that had no new evidence.
`;

/** Expenses-only output: return expense_samples (Phase 3 v2 risk-based structure) */
const EXPENSES_OUTPUT_SCHEMA = `
--- OUTPUT: Return ONLY expense_samples ---
You must return a JSON object with a single key "expense_samples" containing an array of expense items.
Each item MUST include: GL_ID, GL_Date, GL_Payee, GL_Amount, Risk_Profile, Three_Way_Match, Fund_Integrity, Overall_Status.
See MODULE 50 for the full expense_samples (Phase 3 v2) structure. Apply EXPENSE_RISK_FRAMEWORK: Target Sample List from Step A, then Step B (Three-Way Match) and Step C (Fund Integrity) per item.
`;

/** Phase 5 only output: return statutory_compliance */
const PHASE5_OUTPUT_SCHEMA = `
--- OUTPUT: Return ONLY statutory_compliance ---
You must return a JSON object with a single key "statutory_compliance" containing { insurance, gst_reconciliation, income_tax }.
See MODULE 50 for the full statutory_compliance structure. Apply Evidence Tier: Insurance = Tier 1 ONLY; GST = Tier 1/2; Income Tax = Tier 1/3.
- gst_reconciliation: Use intake_summary.registered_for_gst (LOCKED). If false or absent → all amounts = 0, GST_Materiality = "N/A – Plan not registered for GST (per Step 0)". If true → full GST roll-forward.
`;

export function buildPhase5Prompt(): string {
  return (
    HIERARCHY_INTRO +
    EVIDENCE_RULES_PROMPT +
    HIERARCHY_AFTER_EVIDENCE +
    LOCKED_CONTEXT_INSTRUCTION +
    PHASE_5_COMPLIANCE_PROMPT +
    MODULE_50_OUTPUTS_PROMPT +
    PHASE5_OUTPUT_SCHEMA
  );
}

/** AI Attempt output: ai_attempt_updates (patch) + ai_attempt_resolution_table (5-column summary) */
const AI_ATTEMPT_OUTPUT_SCHEMA = `
--- OUTPUT: Return ai_attempt_updates AND ai_attempt_resolution_table ---
You must return a JSON object with TWO keys:

1) "ai_attempt_updates" – patch for merging (same structure as before):
{
  "levy_reconciliation": { ... } | null,
  "expense_updates": [ { "merge_key": "exp_0", "item": { ... } } ] | null,
  "balance_sheet_updates": [ { "line_item", "fund", ... } ] | null,
  "statutory_compliance": { ... } | null
}

2) "ai_attempt_resolution_table" – MANDATORY summary table, one row per target:
[
  {
    "item": "String – the unreconciled item or watchlist item (e.g. 'Levy Variance', 'exp_0: ABC Pty Ltd', 'Cash at Bank')",
    "issue_identified": "String – from verification (e.g. 'VARIANCE', 'MISSING_BANK_STMT') or note from flag when added to watchlist",
    "ai_attempt_conduct": "String – what you did (e.g. 'Re-traced PriorYear/CurrentYear from bs_extract; checked Admin/Capital receipts')",
    "result": "String – outcome (e.g. 'Reconciled', 'Explained as rounding', 'Evidence still missing')",
    "status": "String – final status (e.g. 'VERIFIED', 'VARIANCE', 'PASS', 'FAIL', 'MISSING_BANK_STMT')"
  }
]

- Output ONE row per target in the TARGET LIST. Order matches target list.
- item: concise identifier (phase + item, e.g. "Levy Variance", "exp_2: XYZ Solicitors")
- issue_identified: what was wrong before (from Phase output or user triage note)
- ai_attempt_conduct: what you checked / did during this AI Attempt
- result: human-readable outcome
- status: MUST be exactly one of these (no other values): VERIFIED, VARIANCE, PASS, FAIL, RISK_FLAG, MISSING_BANK_STMT, TIER_3_ONLY, MISSING_LEVY_REPORT, MISSING_BREAKDOWN, NO_SUPPORT, AUTHORISED, UNAUTHORISED, NO_MINUTES_FOUND, MINUTES_NOT_AVAILABLE, N/A
`;

export function buildAiAttemptPrompt(targets: { phase: string; itemId: string; description: string; source?: string }[]): string {
  const targetsText = targets.length === 0
    ? "(No targets – return empty ai_attempt_updates)"
    : targets.map((t) => `- ${t.phase}: ${t.itemId} [${t.source || "system"}] – ${t.description}`).join("\n");
  const targetsBlock = `
--- TARGET LIST (re-verify ONLY these; [system] = System Identified, [triage] = Watchlist) ---
${targetsText}
`;
  return (
    HIERARCHY_INTRO +
    EVIDENCE_RULES_PROMPT +
    HIERARCHY_AFTER_EVIDENCE +
    LOCKED_CONTEXT_INSTRUCTION +
    PHASE_AI_ATTEMPT_PROMPT +
    targetsBlock +
    MODULE_50_OUTPUTS_PROMPT +
    AI_ATTEMPT_OUTPUT_SCHEMA
  );
}

export function buildLevyPrompt(): string {
  return (
    HIERARCHY_INTRO +
    EVIDENCE_RULES_PROMPT +
    HIERARCHY_AFTER_EVIDENCE +
    LOCKED_CONTEXT_INSTRUCTION +
    PHASE_2_REVENUE_PROMPT +
    PHASE_2_RULES_PROMPT +
    MODULE_50_OUTPUTS_PROMPT +
    LEVY_OUTPUT_SCHEMA
  );
}

export function buildPhase4Prompt(): string {
  return (
    HIERARCHY_INTRO +
    EVIDENCE_RULES_PROMPT +
    HIERARCHY_AFTER_EVIDENCE +
    LOCKED_CONTEXT_INSTRUCTION +
    PHASE_4_ASSETS_PROMPT +
    PHASE_4_RULES_PROMPT +
    MODULE_50_OUTPUTS_PROMPT +
    PHASE4_OUTPUT_SCHEMA
  );
}

export function buildExpensesPrompt(): string {
  return (
    HIERARCHY_INTRO +
    EVIDENCE_RULES_PROMPT +
    HIERARCHY_AFTER_EVIDENCE +
    LOCKED_CONTEXT_INSTRUCTION +
    EXPENSE_RISK_FRAMEWORK +
    PHASE_3_FUND_INTEGRITY +
    PHASE_3_EXPENSES_PROMPT +
    MODULE_50_OUTPUTS_PROMPT +
    EXPENSES_OUTPUT_SCHEMA
  );
}

/** Build prompt for expenses additional run (supplement evidence – re-vouch only items with new evidence) */
export function buildExpensesAdditionalPrompt(): string {
  return (
    HIERARCHY_INTRO +
    EVIDENCE_RULES_PROMPT +
    HIERARCHY_AFTER_EVIDENCE +
    LOCKED_CONTEXT_INSTRUCTION +
    PHASE_3_ADDITIONAL_PROMPT +
    PHASE_3_FUND_INTEGRITY +
    MODULE_50_OUTPUTS_PROMPT +
    EXPENSES_ADDITIONAL_OUTPUT_SCHEMA
  );
}
