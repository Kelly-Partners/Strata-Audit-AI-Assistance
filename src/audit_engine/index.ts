/**
 * Audit Engine – [THE BRAIN] Logic & Prompts.
 * Exports buildSystemPrompt() to assemble the full Strata Audit Kernel (Modules 00–60).
 */

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
