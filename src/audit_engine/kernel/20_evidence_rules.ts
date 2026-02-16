/**
 * 20_EVIDENCE (Evidence Gatekeeper). SUPREME PROTOCOL – Same authority as 00_CONSTITUTION.
 * Strict adherence to Tier 1/2/3. No inventing or hallucinating evidence.
 * Phases 2/3/4/5 and AI Attempt MUST follow these rules.
 *
 * DOCUMENT_TYPE → TIER mapping is generated from DOCUMENT_TYPES_WITH_TIER (step_0_intake).
 */

import { DOCUMENT_TYPES_WITH_TIER } from "../workflow/step_0_intake";

function buildDocumentTypeTierMapping(): string {
  const byTier = { "Tier 1": [] as string[], "Tier 2": [] as string[], "Tier 3": [] as string[] };
  for (const { type, tier } of DOCUMENT_TYPES_WITH_TIER) {
    byTier[tier].push(type);
  }
  return ["Tier 1", "Tier 2", "Tier 3"]
    .map((tier) => byTier[tier as keyof typeof byTier].map((t) => `${t} → ${tier}`).join("\n"))
    .join("\n\n");
}

const DOCUMENT_TYPE_TIER_MAPPING = buildDocumentTypeTierMapping();

export const EVIDENCE_RULES_PROMPT = `
20_EVIDENCE (Evidence Gatekeeper) – SUPREME PROTOCOL
Status: OVERRIDE AUTHORITY. Same as 00_CONSTITUTION.
Rule: Strict adherence to Tier 1/2/3. No inventing or hallucinating evidence.

========================
TIER DEFINITIONS (MANDATORY)
========================

**Tier 1 – Independent third-party evidence:**
- Bank statements
- Bank confirmations
- Supplier tax invoices
- Proof of payment records
- Insurance policies and certificates
- Building valuation reports
- Term deposit certificates
- ATO BAS lodgement

**Tier 2 – Internal-authoritative evidence:**
- AGM / EGM minutes and committee minutes
- Strata Management Agency Agreement
- Cash Management Reports
- Levy registers, levy rolls, and arrears reports
- Bank reconciliation statements
- Budget schedules and levy contribution schedules
- Recalculated levy amounts based on unit entitlements
- Internally prepared summaries, schedules, or representations

**Tier 3 – Accounting system / management-generated:**
- Financial statements
- Notes to the financial statements
- Management reports prepared for presentation
- Strata manager general ledger extracts or trial balances
- Audit reports and management letters
- Other

========================
DOCUMENT_TYPE → TIER MAPPING (MANDATORY — Step 0 MUST use this)
========================

${DOCUMENT_TYPE_TIER_MAPPING}

If a file matches multiple Document_Types, use the mapping for the primary type. If ambiguous, prefer the lower tier (Tier 3 over Tier 2, Tier 2 over Tier 1) unless the file is clearly from an external party (bank, insurer, valuer, ATO).

========================
BLACKLIST (Phase 3/4/5 Supporting Source – PROHIBITED)
========================

The following MUST NOT be used as Supporting Source when Tier 1 or Tier 2 is required:
- Financial Statement (as supporting evidence for BS line items – bs_amount comes from bs_extract only)
- Notes to the Financial Statement
- General Ledger (when Tier 1 required, e.g. Cash at Bank – use Bank Statement only; Phase 5 Insurance – use Insurance Policy/Insurance Valuation Report only)
- Phase 3: Invoice = Tier 1; Payment PAID = Tier 1; ACCRUED = Tier 2. FS/Notes/GL when Tier 1/2 required → PROHIBITED.
- Phase 4: R2 = Tier 1; R3/4 = Tier 2. FS/Notes/GL when Tier 1/2 required → PROHIBITED.
- Phase 5 Insurance: Tier 1 ONLY (Insurance Policy, Insurance Valuation Report, Certificate of Currency). Management summaries, GL, Notes → PROHIBITED.

========================
TIER 3 PERMITTED USE
========================

- Phase 4 RULE 5 (General Vouching, residual items): GL (Tier 3) may be used.
- Phase 4 RULE 2 (Cash at Bank): Tier 1 ONLY. Tier 3 → MISSING_BANK_STMT.
- Phase 4 RULE 3/4: Tier 2 primary. Tier 3 only → TIER_3_ONLY or MISSING_BREAKDOWN; never VERIFIED.

========================
NO ELEVATION
========================

Do NOT elevate Tier 2 logic to Tier 1. Do NOT use Tier 3 where Tier 1 is required.
Bank reconciliation (Tier 2) does NOT substitute for Bank Statement (Tier 1) for Cash at Bank verification.

END 20_EVIDENCE
`;
