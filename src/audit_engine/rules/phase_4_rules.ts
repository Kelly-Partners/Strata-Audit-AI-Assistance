/**
 * Phase 4 – Assets 阶段的验证规则。
 * 注入到 system prompt 中。
 */

import type { PhaseItemRule, PhaseRulesMap } from "./types";

export const ASSET_VERIFICATION_RULES_PROMPT = `
   [GATE 2 LOGIC - FULL BALANCE SHEET: Owners Equity, Assets, Liabilities] – MANDATORY ENFORCEMENT
   [AUDIT PERIOD: Use CURRENT YEAR column for all amounts. Prior Year column ONLY for RULE 1 roll-forward. See Phase 4 workflow for FY anchor.]

   RULE 1: OWNERS EQUITY – ROLL-FORWARD CHECK
   - Target: "Owners Funds at Start of Year" (Admin & Capital).
   - Action: Check if this equals the "Closing Balance" of the PREVIOUS YEAR column on the Balance Sheet itself.
   - Status: If mismatch > $1.00 -> "VARIANCE". If match -> "VERIFIED".

   RULE 2: CASH & INVESTMENTS (ASSETS – EXTERNAL VERIFICATION)
   - Target: "Cash at Bank", "Term Deposits", "Investment Accounts" (Admin & Capital).
   - PERIOD: Extract from CURRENT YEAR column / Bank Statement as at FY end ONLY. Do NOT use Prior Year column or prior period statements.
   - TIER 1 EVIDENCE (MANDATORY - EXTERNAL): 
     1. Bank Statement
     2. Term Deposit / Investment Account Statement
     3. Balance Notice from Bank
   - Constraint: Do NOT use General Ledger (Tier 3) as primary evidence. 
   - Status: If Tier 1 doc found & matches -> "VERIFIED". If not found -> "MISSING_BANK_STMT".

   RULE 3: LEVY RECEIVABLES & PREPAID (ASSETS / LIABILITIES – SUB-LEDGER VERIFICATION)
   - Target: "Levy Arrears" (Assets) and "Levies in Advance" (Assets or Liabilities depending on FS presentation).
   - PERIOD: Extract from CURRENT YEAR column / report as at FY end ONLY. Do NOT use Prior Year column or prior period reports.
   - TIER 2 EVIDENCE (PRIMARY - INTERNAL AUTHORITATIVE):
     * Definition: A "Levy Position-Equivalent Report" (Lot-based, Date-anchored, Distinguishes Admin/Capital).
     * Accepted Names: Levy Position Report, Levy Arrears Report, Owner Balance Report, Owner Balances, Owner Ledger, Aged Levies, Aged Owner Balances, Aged Receivables (Levies), Levy Register, Levy Contributions by Lot, Owner Account Balances, Levy Summary by Lot.
   - TIER 3 EVIDENCE (SECONDARY - REFERENCE ONLY):
     * Examples: General Ledger, Levy posting schedules.
   - Status:
     * If Tier 2 Doc found & matches -> "VERIFIED".
     * If only Tier 3 Doc found -> "TIER_3_ONLY" (Treat as risk, Missing Sub-ledger).
     * If no evidence -> "MISSING_LEVY_REPORT".

   RULE 4: ACCRUED & PREPAID / CREDITORS (ASSETS & LIABILITIES – BREAKDOWN REQUIREMENT)
   - Target: "Accrued Expenses", "Creditors", "Unpaid Invoices" (Liabilities); "Prepaid Expenses", "Prepayments", "Insurance Prepayments" (Assets).
   - PERIOD: Extract from CURRENT YEAR column / report as at FY end ONLY. Do NOT use Prior Year column.
   - TIER 2 EVIDENCE (PRIMARY - INTERNAL AUTHORITATIVE):
     * Definition: A breakdown-style report identifying individual components as at reporting date.
     * Accepted Names: Accrued Expenses Report, Unpaid Invoices / Creditors Report, Prepaid Expenses / Allocation Schedule, Aged Creditors Report.
   - TIER 3 EVIDENCE (SECONDARY - REFERENCE ONLY):
     * General Ledger or Trial Balance.
   - PROHIBITED: GL or FS notes used alone to justify balances.
   - Status:
     * If Tier 2 found & matches -> "VERIFIED".
     * If only Tier 3 found -> "MISSING_BREAKDOWN" (Risk).
     * If no evidence -> "NO_SUPPORT".

   RULE 5: GENERAL VOUCHING (ALL OTHER ITEMS – ASSETS & LIABILITIES)
   - Target: Sundry Debtors (Assets), Utility Deposits (Assets), Tax Liabilities (Liabilities), Retained Earnings (Owners Equity), Other.
   - PERIOD: Extract from CURRENT YEAR column / GL as at FY end ONLY. Do NOT use Prior Year column.
   - Action: Search General Ledger (Tier 3).
   - Status: Compare amounts. Difference < $1.00 -> "VERIFIED", else "VARIANCE".

   - Field "supporting_amount": The amount found in the support document.
   - Field "evidence_ref": Document ID/Page (e.g. Sys_001/Page 2) for traceability.
   - Field "note": AI explanation (same as Table E.Master Note/Source). Human-readable source context (e.g. "Bank Statement p.2 as at FY end", "Current Year BS column").
`;

export const PHASE_4_ITEM_RULES: PhaseRulesMap = {};

export const PHASE_4_RULES_PROMPT = ASSET_VERIFICATION_RULES_PROMPT;
