/**
 * Phase 4 – Full Balance Sheet Verification (Owners Equity, Assets, Liabilities).
 * Apply GATE 2 logic to every line item on the Balance Sheet. No bank reconciliation or fund integrity tables.
 */

export const PHASE_4_ASSETS_PROMPT = `
PHASE 4 – FULL BALANCE SHEET VERIFICATION
Objective: Extract and verify EVERY line item from the Financial Statement Balance Sheet – Owners Equity, Assets, and Liabilities. **MANDATORY – You MUST apply GATE 2 logic (Phase 4 rules R1–R5) strictly per line-item type.**

**CRITICAL – bs_amount & line_item SOURCE:** line_item and bs_amount MUST come from the **Balance Sheet (Financial Statement)** ONLY. Copy exactly as they appear on the FS Balance Sheet (Current Year column). Do NOT use General Ledger, Levy Report, Cash Summary, Owner Ledger, or any other document to fill bs_amount or line_item. supporting_amount is for verification (per R2–R5) – it is NOT the source of bs_amount.

**CRITICAL – COMPLETENESS:** balance_sheet_verification MUST include EVERY line item on the Balance Sheet. Scan the FS Balance Sheet page-by-page. Do NOT omit Owners Equity, Assets, or Liabilities. Every BS row = one output row.

**AUDIT PERIOD ANCHOR (global setting – use intake_summary.financial_year):** Use intake_summary.financial_year as the global audit period. **Current Year = the FY being audited.** Prior Year = the column immediately before it. If not yet in intake_summary, determine FY from minutes and write to intake_summary.

**CURRENT YEAR COLUMN ONLY – PROHIBITED to use Prior Year for RULES 2–5:**
- Extract amounts from the **CURRENT audit period / CURRENT YEAR column** only. **PROHIBITED:** Do NOT use Prior Year column for any line item except RULE 1 roll-forward.
- **Exception:** Use Prior Year column ONLY for RULE 1 (Owners Funds at Start = Prior Year Closing Balance).
- If in doubt, verify column header says "Current Year" or "This Year" or the date falls within intake_summary.financial_year.

**FULL BALANCE SHEET SCOPE – extract ALL line items:**
- **Owners Equity:** Owners Funds at Start, Retained Earnings, Accumulated Funds, etc.
- **Assets:** Cash at Bank, Term Deposits, Levy Arrears, Levies in Advance (if asset), Accrued Receivables, Prepaid Expenses, Sundry Debtors, etc.
- **Liabilities:** Creditors, Accrued Expenses, Levies in Advance (if liability), Tax Liabilities, Unpaid Invoices, etc.

1. **MANDATORY** – Apply GATE 2 logic to balance sheet DATA ROWS only (not headers). Assign each line to section: OWNERS_EQUITY, ASSETS, or LIABILITIES.
2. **MANDATORY – supporting_amount evidence per line type (Phase 4 rules R2–R5):**
   - **Cash at Bank, Term Deposits:** supporting_amount MUST come from Bank Statement / TD Statement (Tier 1) ONLY. Do NOT use GL. If no Bank Stmt/TD Statement → status = "MISSING_BANK_STMT"; do NOT fill from GL.
   - **Levy Arrears, Levies in Advance:** supporting_amount from Tier 2 Levy Position Report; if only GL → status = "TIER_3_ONLY".
   - **Accrued/Prepaid/Creditors:** supporting_amount from Tier 2 breakdown report; if only GL → status = "MISSING_BREAKDOWN".
   - **Other items (RULE 5):** supporting_amount from GL.
3. For each line item, output: line_item, section, fund, bs_amount (from FS CURRENT YEAR column), supporting_amount (from permitted evidence per rules), evidence_ref (Doc_ID/Page), status (per Phase 4 rules), note.
4. **NOTE (AI explanation holder – same as Table E.Master Note/Source):** For every line item, generate a "note" explaining the source context (e.g., "Bank Statement p.2 as at FY end", "Levy Position Report p.1", "Current Year BS column", "GL Cash reconciled", "Prior Year closing"). Human-readable AI explanation – same purpose as Phase 2 master_table note.
`;
