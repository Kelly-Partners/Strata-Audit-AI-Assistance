/**
 * Phase 1 – Item-level rules and guidance (e.g. receipt evidence priority, whitelist evidence chain).
 * Changes here are injected via PHASE_1_RULES_PROMPT into the system prompt for the Kernel to follow.
 */

import type { PhaseItemRule, PhaseRulesMap } from "./types";

/** Phase 1 item rules definition */
export const PHASE_1_ITEM_RULES: PhaseRulesMap = {
  receipt: {
    evidencePriority: {
      bank_statement: 1,
      levy_register: 2,
      agent_receipt: 3,
      committee_minute_approval: 4,
      other: 5,
    },
    whitelistDocTypes: [
      "Bank Statement",
      "Levy Register / Receipt Summary",
      "Agent Receipt / Remittance Advice",
      "AGM/Committee Minutes (approval context)",
    ],
    requiredEvidenceTypes: ["bank_statement", "levy_register_or_agent_receipt"],
    guidance:
      "For receipt verification: prefer evidence in order bank_statement → levy_register → agent_receipt → committee_minute_approval. " +
      "Only treat as valid evidence if the document type is in the whitelist; otherwise flag as Tier 2/3 or missing.",
  },
  agm_minutes: {
    evidencePriority: {
      agm_minutes_signed: 1,
      committee_minutes: 2,
      agency_agreement: 3,
    },
    whitelistDocTypes: ["AGM Minutes (signed)", "Committee Minutes", "Agency Agreement"],
    requiredEvidenceTypes: ["agm_minutes_signed"],
    guidance:
      "Establish approved budgets and spending limits from AGM/Committee Minutes and Agency Agreement. " +
      "AGM signed minutes are Tier 1; committee minutes and agency agreement support authority.",
  },
};

/** Format Phase 1 item rules into text injected into the system prompt */
function formatPhase1RulesPrompt(): string {
  const lines: string[] = [
    "",
    "--- PHASE 1 ITEM RULES (Evidence priority & whitelist) ---",
    "Apply the following per-item rules when executing Phase 1:",
  ];
  for (const [item, rule] of Object.entries(PHASE_1_ITEM_RULES)) {
    lines.push(`- **${item}**: ${rule.guidance ?? ""}`);
    if (rule.evidencePriority && Object.keys(rule.evidencePriority).length > 0) {
      const order = Object.entries(rule.evidencePriority)
        .sort(([, a], [, b]) => a - b)
        .map(([k]) => k)
        .join(" > ");
      lines.push(`  Evidence priority (prefer in order): ${order}.`);
    }
    if (rule.whitelistDocTypes && rule.whitelistDocTypes.length > 0) {
      lines.push(`  Whitelist document types: ${rule.whitelistDocTypes.join(", ")}.`);
    }
    if (rule.requiredEvidenceTypes && rule.requiredEvidenceTypes.length > 0) {
      lines.push(`  Required evidence types: ${rule.requiredEvidenceTypes.join(", ")}.`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

export const PHASE_1_RULES_PROMPT = formatPhase1RulesPrompt();
