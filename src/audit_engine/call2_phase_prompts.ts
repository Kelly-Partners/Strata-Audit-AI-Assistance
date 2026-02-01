/**
 * Call 2 – Phase-specific prompts for Levy, Phase4 (BS Verification), Expenses.
 * Each runs with Step 0 output as LOCKED context (injected in userInstruction).
 */

import { HIERARCHY_INTRO, HIERARCHY_AFTER_EVIDENCE } from "./kernel/00_constitution";
import { EVIDENCE_RULES_PROMPT } from "./kernel/20_evidence_rules";
import { PHASE_2_RULES_PROMPT, PHASE_4_RULES_PROMPT } from "./rules";
import { PHASE_2_REVENUE_PROMPT } from "./workflow/phase_2_revenue";
import { PHASE_4_ASSETS_PROMPT } from "./workflow/phase_4_assets";
import { PHASE_3_EXPENSES_PROMPT } from "./workflow/phase_3_expenses";
import { MODULE_50_OUTPUTS_PROMPT } from "../audit_outputs/output_registry";

const LOCKED_CONTEXT_INSTRUCTION = `
--- CALL 2 – LOCKED STEP 0 CONTEXT ---
The user message will contain LOCKED STEP 0 OUTPUT. You MUST use it. Do NOT re-extract document_register or intake_summary.
Use core_data_positions for document/page locations. Use intake_summary.financial_year as the global FY. Use bs_column_mapping for column anchoring when BS has two columns.
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
See MODULE 50 for the full assets_and_cash structure. Apply Phase 4 rules R1–R5 strictly. support_amount per R2–R5.
`;

/** Expenses-only output: return expense_samples */
const EXPENSES_OUTPUT_SCHEMA = `
--- OUTPUT: Return ONLY expense_samples ---
You must return a JSON object with a single key "expense_samples" containing an array of sampled expense items.
See MODULE 50 for the expense_samples structure. Sample from GL, verify against Invoices and Minutes.
`;

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
    PHASE_3_EXPENSES_PROMPT +
    MODULE_50_OUTPUTS_PROMPT +
    EXPENSES_OUTPUT_SCHEMA
  );
}
