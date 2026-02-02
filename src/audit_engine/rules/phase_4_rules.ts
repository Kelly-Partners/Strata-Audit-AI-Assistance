/**
 * Phase 4 – GATE 2 Verification Rules (Owners Equity, Assets, Liabilities)
 * Inject into system prompt.
 */

import type { PhaseItemRule, PhaseRulesMap } from "./types";

export const ASSET_VERIFICATION_RULES_PROMPT = `
[GATE 2 LOGIC – FULL BALANCE SHEET VERIFICATION] – STRICT ENFORCEMENT

GLOBAL RULES (DO NOT VIOLATE):
- bs_amount and line_item source = LOCKED bs_extract ONLY (extracted from FS Balance Sheet and locked at Step 0). Do NOT re-read Balance Sheet PDF.
- supporting_amount source = NON-BS evidence ONLY, per rule (Bank Stmt, Levy Report, breakdown, GL). EXCEPTION: RULE 1 supporting_amount = prior_year from bs_extract.
- tolerance_abs = 1.00.

────────────────────────────────────────
RULE 1 – OWNERS EQUITY ROLL-FORWARD
────────────────────────────────────────

Target:
- "Owners Funds at Start of Year" ONLY.

bs_amount:
- From bs_extract: use **current_year** (the opening balance as shown in Current Year column). This is the "Start of Year" figure for roll-forward.

supporting_amount:
- From bs_extract: use **prior_year** (Prior Year Closing Balance). Compare to bs_amount – they should match (opening of current = closing of prior).

Action:
- Compare bs_amount (current year opening) vs supporting_amount (prior year closing). Roll-forward check.

Status:
- |Difference| ≤ tolerance → VERIFIED
- |Difference| > tolerance → VARIANCE

────────────────────────────────────────
RULE 2 – CASH & INVESTMENTS (ASSETS)
────────────────────────────────────────

Target:
- Cash at Bank
- Term Deposits
- Investment Accounts

supporting_amount (MANDATORY – Tier 1 External):
- Bank Statement
- Term Deposit Statement
- Bank Balance Confirmation

PROHIBITED:
- Do NOT use General Ledger as primary support.

Status:
- Tier 1 found & matches → VERIFIED
- Tier 1 missing → MISSING_BANK_STMT

────────────────────────────────────────
RULE 3 – LEVY ARREARS & LEVIES IN ADVANCE
────────────────────────────────────────

Target:
- Levy Arrears (Assets)
- Levies in Advance (Assets or Liabilities)

Tier 2 Evidence (Primary):
- Levy Position Report
- Owner Balance / Aged Levies Report
- Lot-based, date-anchored at FY end

Tier 3 Evidence (Secondary):
- General Ledger ONLY (reference)

Status:
- Tier 2 found & matches → VERIFIED
- Tier 3 only → TIER_3_ONLY
- No evidence → MISSING_LEVY_REPORT

────────────────────────────────────────
RULE 4 – ACCRUED / PREPAID / CREDITORS
────────────────────────────────────────

Target:
- Accrued Expenses
- Creditors / Unpaid Invoices
- Prepaid Expenses

Tier 2 Evidence (Primary):
- Breakdown-style report
- Aged Creditors
- Prepayment Schedule

Tier 3 Evidence:
- General Ledger ONLY (reference)

Status:
- Tier 2 found & matches → VERIFIED
- Tier 3 only → MISSING_BREAKDOWN
- No evidence → NO_SUPPORT

────────────────────────────────────────
RULE 5 – GENERAL VOUCHING (RESIDUAL ONLY)
────────────────────────────────────────

Target:
- Items NOT eligible for RULES 2–4:
  • Sundry Debtors
  • Utility Deposits
  • Tax Liabilities
  • Retained Earnings
  • Other residual items

Action:
- Verify against General Ledger (Tier 3).

PROHIBITED:
- RULE 5 may NOT be used to bypass RULES 2–4.

Status:
- GL matches → GL_SUPPORTED_ONLY
- Difference > tolerance → VARIANCE

────────────────────────────────────────
SUBTOTAL HANDLING
────────────────────────────────────────

If line_item is a subtotal with numeric amount:
- status = SUBTOTAL_CHECK_ONLY
- supporting_amount MUST be 0
- evidence_ref MUST be ""

────────────────────────────────────────
MISSING EVIDENCE (MISSING_*, NO_SUPPORT)
────────────────────────────────────────

When required evidence is missing → status = MISSING_BANK_STMT | MISSING_LEVY_REPORT | MISSING_BREAKDOWN | NO_SUPPORT:
- supporting_amount MUST be empty/null. Do NOT use 0 (0 causes false match or false variance).
- evidence_ref MUST be "".
- supporting_note MUST state "Subtotal – not independently vouched"

────────────────────────────────────────
OUTPUT FIELDS
────────────────────────────────────────

- evidence_ref: Doc_ID/Page (e.g. Sys_001/Page 2) for traceability.
- note: bs_amount source ONLY – e.g. "BS: From BS column '2024'". Do NOT include supporting evidence.
- supporting_note: supporting_amount source ONLY – e.g. "Matches Bank Statement p.2 as at FY end". Do NOT include "From BS column".

END PHASE 4 RULES
`;

export const PHASE_4_ITEM_RULES: PhaseRulesMap = {};

export const PHASE_4_RULES_PROMPT = ASSET_VERIFICATION_RULES_PROMPT;
