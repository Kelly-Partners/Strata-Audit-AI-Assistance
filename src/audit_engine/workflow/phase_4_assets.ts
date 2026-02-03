/**
 * Phase 4 – Full Balance Sheet Verification (Owners Equity, Assets, Liabilities).
 * Apply GATE 2 logic to every Balance Sheet line item.
 * NO bank reconciliation tables. External vouching only.
 */

export const PHASE_4_ASSETS_PROMPT = `
PHASE 4 – FULL BALANCE SHEET VERIFICATION
Objective: Extract and verify EVERY line item from the Financial Statement Balance Sheet – Owners Equity, Assets, and Liabilities.

**EVIDENCE TIER ENFORCEMENT (20_EVIDENCE – MANDATORY):**
For each line type, use ONLY document_register rows where Evidence_Tier matches the rule (R2=Tier 1, R3/4=Tier 2, R5=Tier 3).

- RULE 2 (Cash at Bank, Term Deposits, Investment Accounts): Tier 1 ONLY. Bank Statement, Term Deposit Statement, Bank Confirmation. Do NOT use Bank reconciliation (Tier 2) as substitute for Bank Statement.
- RULE 3 (Levy Arrears, Levies in Advance): Tier 2 primary. Tier 3 only → TIER_3_ONLY or MISSING_LEVY_REPORT.
- RULE 4 (Accrued/Creditors/Prepaid): Tier 2 primary. Tier 3 only → MISSING_BREAKDOWN or NO_SUPPORT.
- RULE 5 (General Vouching, residual): Tier 3 permitted (GL).

BLACKLIST (no substitute): Financial Statement, Notes to FS, General Ledger when Tier 1/2 required – MUST NOT be used as supporting source for R2/R3/R4. NO ELEVATION: Tier 2 does NOT substitute for Tier 1 (e.g. Bank reconciliation ≠ Bank Statement).

MANDATORY: You MUST apply GATE 2 logic (Phase 4 Rules R1–R5) strictly per line-item type.

────────────────────────────────────────
SECTION A – LOCKED EXTRACTION RULES (DO NOT VIOLATE)
────────────────────────────────────────

CRITICAL – bs_amount & line_item SOURCE (bs_extract ONLY):
- bs_amount and line_item MUST be looked up from LOCKED bs_extract ONLY (extracted from FS Balance Sheet at Step 0). Do NOT re-read the Balance Sheet PDF.
- Match bs_extract.rows by (line_item + fund + section) – all three must match to avoid wrong row (same line_item in different funds/sections).

PROHIBITED:
- Do NOT use General Ledger, Levy Reports, Bank Statements, or any non-bs_extract source for bs_amount or line_item.
- Do NOT substitute ledger figures if bs_extract is missing or has no matching row.

CRITICAL – COMPLETENESS SOURCE OF TRUTH:
- The authoritative row list is LOCKED bs_extract.rows. Output one balance_sheet_verification row for each row in bs_extract.rows.

DATA ROW FILTER:
- Output ONLY Balance Sheet rows that carry a numeric amount in the Current Year column.
- Do NOT output section headers or titles.
- Subtotals WITH numeric amounts MUST be included and flagged as SUBTOTAL_CHECK_ONLY.

────────────────────────────────────────
SECTION B – bs_amount FROM bs_extract (MANDATORY)
────────────────────────────────────────

For EVERY output row:
1. Find matching row in bs_extract.rows by (line_item, fund, section) – all must match.
2. year_column = bs_extract.current_year_label (or prior_year_label for RULE 1 only).
3. bs_amount = matching row's current_year (RULE 1: current_year for opening; supporting_amount = prior_year).
4. note = "BS: From bs_extract current_year" (or "prior_year for roll-forward" for RULE 1).

RULE 1 EXCEPTION – "Owners Funds at Start of Year":
- bs_amount = current_year from bs_extract (opening balance in Current Year column).
- supporting_amount = prior_year from bs_extract (Prior Year closing). Roll-forward: opening = prior closing.

PROHIBITED:
- Do NOT use prior_year for ANY other line item. All others use current_year.
- **Receivable / Levy rows:** If bs_extract.current_year is 0 or blank for that row, output bs_amount = 0. Do NOT substitute with prior_year.

────────────────────────────────────────
SECTION C – SCOPE & CLASSIFICATION
────────────────────────────────────────

FULL BALANCE SHEET SCOPE:
You MUST include EVERY Balance Sheet line item:
- OWNERS_EQUITY
- ASSETS
- LIABILITIES

Assign each line item to ONE section only.

fund field:
- fund MUST be taken from the Balance Sheet presentation (Admin, Capital, Sinking, etc.).
- If no fund split exists, output fund = "TOTAL" and explain in note.

────────────────────────────────────────
SECTION D – AUDIT PERIOD ANCHOR
────────────────────────────────────────

AUDIT PERIOD:
- Use intake_summary.financial_year as the audit period.
- CURRENT YEAR = the FY under audit.
- Prior Year = the column immediately before it.
- If empty or boundary_defined → Not Resolved. In Call 2 mode, do NOT overwrite intake_summary; use the LOCKED value.

────────────────────────────────────────
SECTION E – VERIFICATION (GATE 2 LOGIC)
────────────────────────────────────────

For EACH extracted Balance Sheet line item:
- Apply Phase 4 Rules R1–R5 (see rules prompt).
- supporting_amount is for VERIFICATION ONLY.
- supporting_amount MUST come from permitted NON-BS evidence per rule.

STRICT SOURCE SEPARATION:
- bs_amount source = bs_extract ONLY (from FS Balance Sheet, locked at Step 0).
- supporting_amount source = NON-BS evidence ONLY (except RULE 1: prior_year from bs_extract).

If required evidence is missing:
- Set appropriate MISSING_* status.
- supporting_amount = empty/null (do NOT use 0 – 0 causes false match/variance). evidence_ref = "".
- Do NOT substitute with GL.

────────────────────────────────────────
SECTION F – OUTPUT FIELDS (MANDATORY)
────────────────────────────────────────

For EACH Balance Sheet row, output ONE row with:
- line_item
- section (OWNERS_EQUITY / ASSETS / LIABILITIES)
- fund
- bs_amount
- year_column
- supporting_amount
- evidence_ref (Doc_ID/Page)
- status
- note
- supporting_note

NOTE FIELD STRUCTURE (MANDATORY – TWO SEPARATE FIELDS):
- note = bs_amount source ONLY. Example: "BS: From BS column '2024'" or "BS: From BS column 'Prior Year' (roll-forward)". Do NOT include supporting evidence.
- supporting_note = supporting_amount source ONLY. Example: "Matches Macquarie Investment Account Statement 2036-74072", "Bank Statement p.2 as at FY end". Do NOT include "From BS column".
- For SUBTOTAL_CHECK_ONLY rows: supporting_amount = 0, evidence_ref = "", supporting_note = "Subtotal – not independently vouched".
- For MISSING_* / NO_SUPPORT: supporting_amount = null (omit or null), evidence_ref = "".

Global tolerance:
- Absolute tolerance = 1.00
- Normalize signs before comparison.

END PHASE 4
`;
