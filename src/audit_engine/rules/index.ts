/**
 * Phase 1–5 具体 item 的细化规则与指导（优先级、白名单证据链等）。
 * 各 phase_X_rules.ts 导出 PHASE_X_RULES_PROMPT，在 buildSystemPrompt 中接在对应 Phase 后注入。
 * 新增规则：在本目录下增加或编辑 phase_X_rules.ts，并在本 index 与 audit_engine/index 中挂接。
 */

export * from "./types";
export {
  PHASE_1_ITEM_RULES,
  PHASE_1_RULES_PROMPT,
} from "./phase_1_rules";

export { PHASE_2_ITEM_RULES, PHASE_2_RULES_PROMPT } from "./phase_2_rules";
export { PHASE_4_ITEM_RULES, PHASE_4_RULES_PROMPT } from "./phase_4_rules";
