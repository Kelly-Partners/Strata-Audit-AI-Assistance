/**
 * Audit Engine – [THE BRAIN] Logic & Prompts.
 * Exports buildSystemPrompt(), buildStep0Prompt(), and Call 2 phase prompts.
 */

export { buildLevyPrompt, buildPhase4Prompt, buildExpensesPrompt, buildPhase5Prompt, buildAiAttemptPrompt } from "./call2_phase_prompts";

import { HIERARCHY_INTRO, HIERARCHY_AFTER_EVIDENCE } from "./kernel/00_constitution";
import { EVIDENCE_RULES_PROMPT } from "./kernel/20_evidence_rules";
import { STEP_0_INTAKE_PROMPT } from "./workflow/step_0_intake";
import { PHASE_1_RULES_PROMPT, PHASE_2_RULES_PROMPT, PHASE_4_RULES_PROMPT } from "./rules";
import { PHASE_1_VERIFY_PROMPT } from "./workflow/phase_1_verify";
import { PHASE_2_REVENUE_PROMPT } from "./workflow/phase_2_revenue";
import { PHASE_3_EXPENSES_PROMPT } from "./workflow/phase_3_expenses";
import { PHASE_4_ASSETS_PROMPT } from "./workflow/phase_4_assets";
import { PHASE_5_COMPLIANCE_PROMPT } from "./workflow/phase_5_compliance";
import { MODULE_50_OUTPUTS_PROMPT } from "../audit_outputs/output_registry";

/** Step 0 output schema – document_register + intake_summary + core_data_positions + bs_column_mapping + bs_structure */
const STEP_0_OUTPUTS_PROMPT = `
--- STEP 0 OUTPUT (JSON STRUCTURE – STEP 0 ONLY MODE) ---
You MUST return a single JSON object with these top-level keys:
- document_register: Array of document entries
- intake_summary: Object with strata_plan, financial_year, total_files, missing_critical_types, status
- core_data_positions: Object locking document/page locations (see schema)
- bs_extract: Full Balance Sheet export { prior_year_label, current_year_label, rows } – MANDATORY single source of truth for Phase 2/4/5

Do NOT include levy_reconciliation, assets_and_cash, expense_samples, statutory_compliance, or completion_outputs.

JSON SCHEMA (Step 0 only):
{
  "document_register": [
    {
      "Document_ID": "String (e.g. Sys_001)",
      "Document_Origin_Name": "String (Exact filename from manifest)",
      "Document_Name": "String (Standardized Name)",
      "Document_Type": "String (AGM Minutes | Committee Minutes | General Ledger | Financial Statement | Bank Statement | Cash Management Report | Tax Invoice | Invoice | Levy Position Report | Insurance Policy | Valuation Report | Creditors Report | Other)",
      "Page_Range": "String (e.g. 'Pages 1-5' or 'All')",
      "Evidence_Tier": "String (Tier 1/Tier 2/Tier 3)",
      "Relevant_Phases": ["String"],
      "Notes": "String"
    }
  ],
  "intake_summary": {
    "total_files": Number,
    "missing_critical_types": ["String"],
    "status": "String",
    "strata_plan": "String (e.g. SP 12345)",
    "financial_year": "String (e.g. 01/07/2024 - 30/06/2025 or DD/MM/YYYY)",
    "boundary_defined": "Boolean (optional – true when FY or BS mapping ambiguous)",
    "bs_extract_warning": "String (optional – e.g. 'balance_check_failed')",
    "registered_for_gst": "Boolean (optional – true if BS contains GST account(s); false otherwise)"
  },
  "core_data_positions": {
    "balance_sheet": { "doc_id": "String", "page_range": "String" } | null,
    "bank_statement": { "doc_id": "String", "page_range": "String", "as_at_date": "String" } | null,
    "levy_report": { "doc_id": "String", "page_range": "String" } | null,
    "levy_receipts_admin": { "doc_id": "String", "page_range": "String" } | null,
    "levy_receipts_capital": { "doc_id": "String", "page_range": "String" } | null,
    "general_ledger": { "doc_id": "String", "page_range": "String" } | null,
    "minutes_levy": { "doc_id": "String", "page_ref": "String" } | null,
    "minutes_auth": { "doc_id": "String", "page_ref": "String" } | null
  },
  "bs_extract": {
    "prior_year_label": "String (e.g. 2023)",
    "current_year_label": "String (e.g. 2024)",
    "rows": [
      { "line_item": "String", "section": "OWNERS_EQUITY|ASSETS|LIABILITIES", "fund": "Admin|Capital|N/A", "prior_year": Number, "current_year": Number }
    ]
  }
}
`;

/**
 * Builds the Step 0 only prompt – Document Intake & Dictionary.
 * Used when mode = 'step0_only'. Output is document_register + intake_summary only.
 */
export function buildStep0Prompt(): string {
  return (
    HIERARCHY_INTRO +
    EVIDENCE_RULES_PROMPT +
    HIERARCHY_AFTER_EVIDENCE +
    STEP_0_INTAKE_PROMPT +
    STEP_0_OUTPUTS_PROMPT
  );
}

/**
 * Builds the full Audit Logic Kernel system prompt (Step 0 → Phase 5 + MODULE 50).
 * Order: Constitution (00) → Evidence (20) → Hierarchy rest (10, 30, 50) → Workflow → Outputs.
 */
export function buildSystemPrompt(): string {
  return (
    HIERARCHY_INTRO +
    EVIDENCE_RULES_PROMPT +
    HIERARCHY_AFTER_EVIDENCE +
    STEP_0_INTAKE_PROMPT +
    PHASE_1_VERIFY_PROMPT +
    PHASE_1_RULES_PROMPT +
    PHASE_2_REVENUE_PROMPT +
    PHASE_2_RULES_PROMPT +
    PHASE_4_ASSETS_PROMPT +
    PHASE_4_RULES_PROMPT +
    PHASE_3_EXPENSES_PROMPT +
    PHASE_5_COMPLIANCE_PROMPT +
    MODULE_50_OUTPUTS_PROMPT
  );
}
