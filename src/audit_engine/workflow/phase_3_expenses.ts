/**
 * Phase 3 – Risk-Based Expense Audit Engine (v2.0).
 * Funnel: Scan GL → Filter by materiality & keywords → Deep dive (three-way match + fund integrity).
 */

export const EXPENSE_RISK_FRAMEWORK = `
[PHASE 3: RISK-BASED EXPENSE SAMPLING – EXPENSE_RISK_FRAMEWORK]

STEP A: SCAN & SELECT (DO NOT PICK RANDOM ITEMS)
1. MATERIALITY: Select ALL transactions with amount > $5,000 (or use intake_summary.manager_limit if higher).
2. KEYWORDS: Select ANY transaction matching: "Legal", "Solicitor", "Lawyer", "Consultant", "Reimbursement", "Emergency", "Roof", "Lift", "Defect".
3. ANOMALY: Select transactions with generic descriptions like "Services Rendered", "Miscellaneous", "Sundry", "Reimbursement" if Amount > $1,000.
4. For each selected item, output Risk_Profile: is_material (true if > $5k), risk_keywords (list of matched keywords), is_split_invoice (true if same payee has multiple transactions in short period that sum above limit), selection_reason (AI explanation).

STEP B: THREE-WAY MATCH EXECUTION
For each selected item, perform three checks and populate Three_Way_Match:

1. INVOICE VALIDITY (invoice):
   - id: Invoice document ref (Doc_ID/Page). date: Invoice date. payee_match: GL Payee matches Invoice Payee. abn_valid: ABN present and 11 digits. addressed_to_strata: Invoice MUST be addressed to "The Owners - Strata Plan X" or equivalent OC; if addressed to Manager/Owner/Agent only = FAIL (addressed_to_strata = false).

2. PAYMENT EVIDENCE (payment):
   - Search Bank Statement for the specific amount on/after the GL Date (allow ±14 days). amount_match: Bank amount matches GL within ±1% or ±$10.
   - IF FOUND in Bank -> status = "PAID", source_doc = Bank Statement ref.
   - IF NOT in Bank -> Check Creditors/Accrued Expenses report for same Payee + Amount. If found -> status = "ACCRUED", creditors_ref = report ref.
   - IF NOT in Bank AND NOT in Creditors -> status = "MISSING".
   - IF Bank Statement is missing or unreadable -> status = "BANK_STMT_MISSING" (do not use "MISSING").

3. AUTHORITY TIERING (authority):
   - Use intake_summary.manager_limit and intake_summary.agm_limit when available. If not in intake_summary, infer from Agency Agreement / Minutes.
   - TIER 1 (MANAGER): Amount < manager_limit -> required_tier = "MANAGER", limit_applied = manager_limit, status = "AUTHORISED".
   - TIER 2 (COMMITTEE): Amount >= manager_limit AND amount < agm_limit -> required_tier = "COMMITTEE". Search Committee Minutes for approval (Payee or Amount). If found -> minute_ref = "Committee Meeting DD/MM/YY Item X.X", status = "AUTHORISED". If Minutes missing -> status = "MINUTES_NOT_AVAILABLE". If not found in Minutes -> status = "UNAUTHORISED".
   - TIER 3 (GENERAL_MEETING): Amount >= agm_limit OR "Legal/Loan/Special Levy" matters -> required_tier = "GENERAL_MEETING". Search AGM/EGM Minutes. If found -> minute_ref = "AGM DD/MM/YY Item X.X", status = "AUTHORISED". If not found -> status = "UNAUTHORISED".
   - Fail Authority Test if Committee/AGM approval required but no minute_ref found (status = "UNAUTHORISED").
`;

export const PHASE_3_FUND_INTEGRITY = `
STEP C: FUND INTEGRITY (ADMIN VS CAPITAL)
- Compare GL Fund Code (e.g. "Admin - Plumbing") vs Invoice Description/Nature.
- RULES: Maintenance/Repairs = Admin. Replacement/New Assets = Capital (Sinking). Legal Advice (General) = Admin. Legal Litigation (Defects) = usually Capital. Insurance Excess for Capital Works = Capital.
- Populate Fund_Integrity: gl_fund_code, invoice_nature (AI summary of invoice content), classification_status = "CORRECT" | "MISCLASSIFIED" | "UNCERTAIN", note.
- If Admin Fund pays for Capital Works (e.g. full roof replacement) -> classification_status = "MISCLASSIFIED".
`;

export const PHASE_3_EXPENSES_PROMPT = `
PHASE 3 – RISK-BASED EXPENSE AUDIT (v2.0)
Objective: Execute MODULE 'EXPENSE_RISK_FRAMEWORK'. Do NOT sample randomly.

1. Scan the General Ledger (use core_data_positions.general_ledger) and build a **Target Sample List** from STEP A (Materiality + Keywords + Anomaly). Sort by risk: Legal/Consultant first, then >$5k, then keywords.

2. For each item in the Target Sample List, execute STEP B (Three-Way Match) and STEP C (Fund Integrity). Output GL_ID (or unique ref), GL_Date, GL_Payee, GL_Amount (TraceableValue), Risk_Profile, Three_Way_Match, Fund_Integrity, Overall_Status.

3. Overall_Status: "PASS" = Invoice valid + (PAID or ACCRUED) + AUTHORISED + CORRECT fund. "FAIL" = any of: addressed_to_strata false, payment MISSING, authority UNAUTHORISED, MISCLASSIFIED. "RISK_FLAG" = BANK_STMT_MISSING or MINUTES_NOT_AVAILABLE or UNCERTAIN fund.

4. You MUST explicitly distinguish "PAID" (found in bank) vs "ACCRUED" (found in creditors report). You MUST fail the Authority Test if Committee/AGM approval is required but no minute_ref is found.

5. Use intake_summary.manager_limit and intake_summary.agm_limit when present; otherwise infer from Agency Agreement / Minutes and state in note.
`;
