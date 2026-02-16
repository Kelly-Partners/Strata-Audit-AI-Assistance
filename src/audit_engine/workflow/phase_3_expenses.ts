/**
 * Phase 3 – Risk-Based Expense Audit Engine (v2.0).
 * Funnel: Scan GL → Filter by materiality & keywords → Deep dive (three-way match + fund integrity).
 */

export const EXPENSE_RISK_FRAMEWORK = `
[PHASE 3: RISK-BASED EXPENSE SAMPLING – EXPENSE_RISK_FRAMEWORK]

**EVIDENCE TIER ENFORCEMENT (20_EVIDENCE – MANDATORY):**
Use only document_register rows where Evidence_Tier matches the required tier for each evidence type.

- **Invoice validity** → Tier 1 ONLY (Tax Invoice, supplier invoice – from document_register where Evidence_Tier = Tier 1).
- **Payment evidence (PAID)** → Tier 1 ONLY (Bank Statement – from document_register where Evidence_Tier = Tier 1). Do NOT use Bank reconciliation or GL as substitute.
- **Payment evidence (ACCRUED)** → Tier 2 ONLY (Creditors Report – from document_register where Evidence_Tier = Tier 2 and Document_Type = Creditors Report or equivalent Aged Payables report).
- **Authority (Committee/AGM approval)** → Tier 2 ONLY (Committee Minutes, AGM/EGM Minutes – from document_register where Evidence_Tier = Tier 2).

If the required tier evidence is not in document_register, set the appropriate status (e.g. BANK_STMT_MISSING, MINUTES_NOT_AVAILABLE, MISSING) – do NOT substitute with lower-tier evidence.

STEP A: SCAN & SELECT (DO NOT PICK RANDOM ITEMS) – Five dimensions, assign selection_dimension per item

1. VALUE_COVERAGE: From pl_extract (current year expenditure), sum total. Sort GL by amount desc, take items until cumulative amount ≥ 70% of total. Assign selection_dimension = "VALUE_COVERAGE".

2. RISK_KEYWORD: Select ANY transaction matching: "Legal", "Solicitor", "Lawyer", "Consultant", "Reimbursement", "Emergency", "Roof", "Lift", "Defect", "Insurance", "Remediation", "Structural", "Waterproofing", "Litigation". Assign selection_dimension = "RISK_KEYWORD". If already in VALUE_COVERAGE, keep VALUE_COVERAGE as primary.

3. MATERIALITY: Dynamic threshold = max(manager_limit ?? 5000, total_expenditure × 0.01, 5000). Select ALL transactions with amount > threshold. Assign selection_dimension = "MATERIALITY" for items not already assigned.

4. ANOMALY_DESCRIPTION: Select transactions with generic descriptions like "Services Rendered", "Miscellaneous", "Sundry", "General Expenses" if Amount > $1,000. Assign selection_dimension = "ANOMALY_DESCRIPTION".

5. SPLIT_PATTERN / RECURRING_NEAR_LIMIT: Same payee has multiple transactions in 14 days – (a) if sum > manager_limit -> is_split_invoice = true, selection_dimension = "SPLIT_PATTERN"; (b) if individual amounts near manager_limit (80%–100%) -> selection_dimension = "RECURRING_NEAR_LIMIT".

6. DEDUPE & SORT: Each GL item appears once. Primary dimension wins if item matches multiple. Sort output: VALUE_COVERAGE first, then RISK_KEYWORD, MATERIALITY, ANOMALY_DESCRIPTION, SPLIT_PATTERN, RECURRING_NEAR_LIMIT, OTHER.

7. For each selected item, output Risk_Profile: is_material, risk_keywords, is_split_invoice, selection_reason, selection_dimension (REQUIRED – one of VALUE_COVERAGE | RISK_KEYWORD | MATERIALITY | ANOMALY_DESCRIPTION | SPLIT_PATTERN | RECURRING_NEAR_LIMIT | OTHER).

STEP B: THREE-WAY MATCH EXECUTION
For each selected item, perform three checks and populate Three_Way_Match:

1. INVOICE VALIDITY (invoice) – TIER 1 ONLY:
   - Source: document_register rows with Evidence_Tier = Tier 1 (Tax Invoice, supplier invoice).
   - id: Invoice document ref (Doc_ID/Page). date: Invoice date.
   - Populate checks (each with passed: boolean + evidence: { source_doc_id, page_ref, note }) – each check links to Forensic/PDF:
     * sp_number: Invoice/cover shows SP number matching intake_summary.strata_plan. passed = true if match.
     * address: Invoice addressed to "The Owners - Strata Plan X" or equivalent OC (not Manager/Owner/Agent only). passed = true if correct.
     * amount: Invoice amount matches GL_Amount within ±1% or ±$10. passed = true if match.
   * gst_verified: Use intake_summary.registered_for_gst (LOCKED). If registered → invoice shows GST component and amount correct; if not registered → no GST on invoice. passed = true if consistent.
   * payee_match: GL Payee matches Invoice Payee. passed = true if match.
   * abn_valid: ABN present and 11 digits. passed = true if valid.
   - Top-level: payee_match, abn_valid, addressed_to_strata (derived from checks for backward compat; keep in sync).
   - Invoice validity = PASS only if ALL available checks pass (sp_number, address, amount, gst_verified, payee_match, abn_valid). If any check fails, treat invoice as FAIL. Each check's evidence MUST include source_doc_id and page_ref for PDF link in Forensic popover.

2. PAYMENT EVIDENCE (payment) – with checks (same granularity as invoice):
   - **PAID** – TIER 1 ONLY: Search Bank Statement (document_register where Evidence_Tier = Tier 1) for the specific amount on/after the GL Date (allow ±14 days). IF FOUND in Bank -> status = "PAID", source_doc = Bank Statement ref. IF Bank Statement is missing or unreadable -> status = "BANK_STMT_MISSING" (do not use "MISSING").
   - **ACCRUED** – TIER 2 ONLY: IF NOT in Bank -> Check Creditors/Accrued Expenses report (document_register where Evidence_Tier = Tier 2). If found -> status = "ACCRUED", creditors_ref = report ref.
   - IF NOT in Bank AND NOT in Creditors -> status = "MISSING".
   - Do NOT use Tier 3 (GL, FS, Notes) as payment evidence.

   Populate payment.checks (each with passed: boolean + evidence: { source_doc_id, page_ref, note }) – each check links to Forensic/PDF:
   * bank_account_match: Payment is from the scheme's bank account (not manager/personal/other). passed = true if account is OC/Strata account.
   * payee_match: Bank payee/recipient matches GL_Payee or invoice payee. passed = true if match.
   * duplicate_check: No duplicate payment (same supplier, same amount, similar date). passed = true if not duplicate.
   * split_payment_check: Not a split payment to circumvent authority limits (use Risk_Profile.is_split_invoice). passed = true if no split or split is justified.
   * amount_match: Bank amount matches GL within ±1% or ±$10. passed = true if match. Top-level amount_match must stay in sync.
   * date_match: Payment date within GL Date ±14 days. passed = true if within window.
   - FAIL if bank_account_match, payee_match, amount_match, duplicate_check, or split_payment_check fails. date_match failure -> RISK_FLAG.
   - Each check's evidence MUST include source_doc_id and page_ref for PDF link in Forensic popover.

3. AUTHORITY TIERING (authority) – COMMITTEE/AGM TIER 2 ONLY:
   - Use intake_summary.manager_limit and intake_summary.agm_limit when available. If not in intake_summary, infer from Agency Agreement / Minutes.
   - TIER 1 (MANAGER): Amount < manager_limit -> required_tier = "MANAGER", limit_applied = manager_limit, status = "AUTHORISED".
   - TIER 2 (COMMITTEE): Amount >= manager_limit AND amount < agm_limit -> required_tier = "COMMITTEE". Search Committee Minutes (document_register where Evidence_Tier = Tier 2) for approval (Payee or Amount). If found -> minute_ref = "Committee Meeting DD/MM/YY Item X.X", status = "AUTHORISED". If Minutes missing -> status = "MINUTES_NOT_AVAILABLE". If not found in Minutes -> status = "UNAUTHORISED".
   - TIER 3 (GENERAL_MEETING): Amount >= agm_limit OR "Legal/Loan/Special Levy" matters -> required_tier = "GENERAL_MEETING". Search AGM/EGM Minutes (document_register where Evidence_Tier = Tier 2) for approval. If found -> minute_ref = "AGM DD/MM/YY Item X.X", status = "AUTHORISED". If not found -> status = "UNAUTHORISED".
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

**MANDATORY – Evidence Tier (20_EVIDENCE):** Use only document_register rows where Evidence_Tier matches the required tier for each evidence type. Invoice & Payment (PAID) = Tier 1. ACCRUED = Tier 2 (Creditors/Aged report). Committee/AGM Minutes = Tier 2.

1. Scan the General Ledger (use core_data_positions.general_ledger) and pl_extract for total expenditure. Build **Target Sample List** from STEP A (five dimensions: Value coverage, Risk keyword, Materiality, Anomaly, Split/Recurring). Assign selection_dimension to each item. Sort per STEP A rule 6.

2. For each item in the Target Sample List, execute STEP B (Three-Way Match) and STEP C (Fund Integrity). Output GL_ID (or unique ref), GL_Date, GL_Payee, GL_Amount (TraceableValue), Risk_Profile, Three_Way_Match, Fund_Integrity, Overall_Status.

3. Overall_Status: "PASS" = Invoice valid (all checks pass) + (PAID or ACCRUED) + AUTHORISED + CORRECT fund. "FAIL" = any of: any invoice check failed (including payee_match or abn_valid), payment MISSING, authority UNAUTHORISED, MISCLASSIFIED. "RISK_FLAG" = BANK_STMT_MISSING or MINUTES_NOT_AVAILABLE or UNCERTAIN fund.

4. You MUST explicitly distinguish "PAID" (found in bank) vs "ACCRUED" (found in creditors report). You MUST fail the Authority Test if Committee/AGM approval is required but no minute_ref is found.

5. Use intake_summary.manager_limit and intake_summary.agm_limit when present; otherwise infer from Agency Agreement / Minutes and state in note.
`;

/** Phase 3 Additional Run – supplement vouching with new evidence. NO Step A. Only re-vouch items linked to new documents. */
export const PHASE_3_ADDITIONAL_PROMPT = `
PHASE 3 – ADDITIONAL RUN (Supplement Evidence – DO NOT RE-SCAN)

**PURPOSE:** Re-vouch expense items that now have NEW evidence (invoices/receipts). Do NOT run Step A (SCAN & SELECT). Do NOT add new items to the sample list.

**INPUT:**
- LOCKED Step 0 output (document_register, intake_summary, core_data_positions, bs_extract, pl_extract).
- PREVIOUS expense_samples (the initial or combined result from prior runs) – in the LOCKED context.
- NEW FILES: The attached file parts are NEW additional evidence (invoices/receipts for vouching).

**INSTRUCTIONS:**
1. Register the new files in document_register. Assign Document_ID (continue numbering from existing, e.g. Sys_007, Sys_008), Document_Type (typically "Tax Invoice" or "Invoice"), Evidence_Tier = "Tier 1", Document_Origin_Name = exact filename from File Part mapping. Output the MERGED document_register (existing + new rows).
2. For each new document: match it to GL items in PREVIOUS expense_samples by payee + amount + date (within ±14 days).
3. For each PREVIOUS expense item that has matching new evidence: re-execute STEP B (Three-Way Match) and STEP C (Fund Integrity) using the FULL document_register (including new rows). Output the updated item with same structure.
4. Output ONLY items that were re-vouched (items where new evidence was used). Do NOT output items that had no new evidence.
5. Use same Evidence Tier rules: Invoice = Tier 1; Payment PAID = Tier 1; ACCRUED = Tier 2; Authority = Tier 2.
`;
