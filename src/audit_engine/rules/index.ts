/**
 * Phase 1–5 item-level rules and guidance (priority, whitelist evidence chain, etc.).
 * Each phase_X_rules.ts exports PHASE_X_RULES_PROMPT, injected after the corresponding Phase in buildSystemPrompt.
 * To add rules: create or edit phase_X_rules.ts in this directory and wire it in this index and audit_engine/index.
 */

export * from "./types";
export {
  PHASE_1_ITEM_RULES,
  PHASE_1_RULES_PROMPT,
} from "./phase_1_rules";

export {
  PHASE_2_ITEM_RULES,
  PHASE_2_RECEIPTS_REPORT_WHITELIST,
  PHASE_2_RULES_PROMPT,
} from "./phase_2_rules";
export { PHASE_4_ITEM_RULES, PHASE_4_RULES_PROMPT } from "./phase_4_rules";
