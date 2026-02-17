/**
 * Phase item-level rule types (priority, whitelist evidence chain, etc.).
 * Used in rules/phase_*_rules.ts to define rules and generate guidance text for the system prompt.
 */

/** Evidence priority within the chain (lower number = higher priority) */
export type EvidencePriority = number;

/** Rule for a single item: evidence priority, whitelist doc types, required evidence */
export interface PhaseItemRule {
  /** Evidence type/source -> priority (1 = highest), for sorting and prefer-first guidance */
  evidencePriority?: Record<string, EvidencePriority>;
  /** Whitelist: only these document types are valid evidence for this item */
  whitelistDocTypes?: string[];
  /** Required evidence types (all must be present) */
  requiredEvidenceTypes?: string[];
  /** Human-readable guidance, injected into the prompt */
  guidance?: string;
}

/** Map of item rules for a Phase; key = item name (e.g. receipt, agm_minutes) */
export type PhaseRulesMap = Record<string, PhaseItemRule>;
