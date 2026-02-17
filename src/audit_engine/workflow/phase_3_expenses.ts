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

If the required tier evidence is not in document_register, set the appropriate status (e.g. BANK_STMT_MISSING, MISSING) – do NOT substitute with lower-tier evidence.

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

   **MANDATORY – Extract from Tier 1 invoice document ONLY. Do NOT infer or fill missing fields from GL, intake_summary, or other documents.**

   STEP 1 – FIELD EXTRACTION (from invoice PDF only):
   Extract: invoice_number, invoice_date, supplier_name, supplier_abn, invoice_net_amount, invoice_gst_amount, invoice_gross_total, invoice_addressed_to, sp_number_visible.
   If any field cannot be located in the invoice → note which field is missing in evidence. Do NOT assume or infer from GL.

   STEP 2 – LEGAL MINIMUM CHECK:
   Fail immediately (abn_valid = false or address = false as applicable) if any of: supplier_name missing, supplier_abn missing or not 11 digits, invoice_number missing, invoice_date missing, invoice_gross_total missing.

   STEP 3 – STRATA PLAN OWNERSHIP & SP NUMBER:
   - sp_number: sp_number_visible must match intake_summary.strata_plan. passed = true only if match.
   - address: invoice_addressed_to must contain "The Owners – Strata Plan XXXX" or equivalent Owners Corporation naming. If addressed only to manager, individual, or generic entity → passed = false.

   STEP 4 – AMOUNT COMPARISON:
   Compare invoice_gross_total vs GL_Amount. Tolerance: ±$10 OR ±1%. Record difference in evidence.note. passed = true only if within tolerance.

   STEP 5 – GST CONSISTENCY:
   Use intake_summary.registered_for_gst (LOCKED). First read invoice for GST treatment.
   - If registered_for_gst = true: invoice must show GST component (itemized GST amount > 0, OR explicit "GST inclusive"/"incl GST" text). Do NOT assume compliance without visible evidence.
   - If registered_for_gst = false: invoice_gst_amount must be 0 or not shown. If invoice shows GST line → passed = false.

   STEP 6 – PAYEE MATCH:
   Normalized(supplier_name) must match GL_Payee. Minor formatting differences allowed. Different legal entity → passed = false.

   **OUTPUT:** Populate checks (REQUIRED – all six) – each with passed: boolean, evidence: { source_doc_id, page_ref, note }, and observed: string. Note MUST state what was compared and the result. Observed MUST state the actual values read (e.g. "Invoice $1100 vs GL $1100; within tolerance" for amount; "ABN 12 345 678 901" for abn_valid):
     * sp_number, address, amount, gst_verified, payee_match, abn_valid.
   - id: Invoice Doc_ID/Page. date: invoice_date from extraction.
   - Top-level: payee_match, abn_valid, addressed_to_strata (derived from checks; keep in sync).
   - Invoice validity = PASS only if ALL checks pass. Each check's evidence MUST include source_doc_id and page_ref for Forensic popover.
   - **If no Tier 1 invoice found:** set invoice.id = "", date = "", each check passed = false with note "No invoice document found". Invoice validity = FAIL.

2. PAYMENT EVIDENCE (payment) – NSW STRATA STANDARD (Observation-First):
   **GENERAL RULES:** PAID = Tier 1 Bank Statement ONLY. ACCRUED = Tier 2 Creditors ONLY. Do NOT use GL, FS, Notes, or Bank Reconciliation as Bank substitute. All checks MUST output observed values. Do NOT infer from GL or intake_summary.

   **A) PAID – STEP P1 SEARCH:** Date: GL_Date ±14 days. Amount: GL_Amount ±$10 OR ±1%. If multiple candidates: use payee, reference, account to isolate ONE.
   **STEP P2 OBSERVED (from Bank):** bank_txn_date, bank_amount, bank_payee_text, bank_reference_text, bank_account_name, bank_page_ref. Compare: gl_date, gl_amount, gl_payee, invoice_payee.
   **STEP P3 CHECKS:** bank_account_match (NSW Trust: account must indicate OC/Strata Plan). payee_match (normalized bank_payee vs invoice/gl). amount_match (bank vs gl within tolerance). reference_traceable (bank_reference_text contains invoice_number or identifiable job ref; if multiple candidates and cannot uniquely trace → FAIL; if reference absent but unique match → RISK_FLAG). duplicate_check (scan ±30 days same payee+amount; observed = found_matches_count). split_payment_check (7–14 days same payee; sum > manager_limit without authority → FAIL). date_match (within ±14 days; outside → RISK_FLAG).
   **STEP P4 STATUS:** Unique match + CRITICAL passed → "PAID". Bank exists but not found → "BANK_STMT_MISSING". CRITICAL fails → status "PAID" but Overall_Status FAIL. Bank Reconciliation without Statement → "BANK_STMT_MISSING".

   **B) ACCRUED – STEP A1 OBSERVED:** creditor_name_text, outstanding_amount, report_as_at_date, ageing_bucket (if shown), report_page_ref.
   **STEP A2 CHECKS:** payee_match (creditor vs gl/invoice). amount_match (outstanding vs gl). ageing_reasonableness (if outstanding > 90 days → RISK_FLAG; passed=true but flag). subsequent_payment_check (IF next-period bank available: search +30 to +120 days; no payment evidence for significant amount → RISK_FLAG; if no next-period bank → N/A). bank_account_match, reference_traceable, duplicate_check, split_payment_check, date_match → N/A (passed=true, note "N/A – ACCRUED").

   **C) MISSING:** IF NOT in Bank AND NOT in Creditors → status = "MISSING". Output all 9 checks with passed = false, note "No payment evidence – neither Bank nor Creditors found".
   **MANDATORY:** source_doc_id = Bank/Creditors Document_ID. payment.amount_match (top-level) must equal checks.amount_match.passed. Do NOT use Tier 3 as payment evidence.

   **OUTPUT payment.checks (REQUIRED):** PAID: bank_account_match, payee_match, amount_match, reference_traceable, duplicate_check, split_payment_check, date_match, ageing_reasonableness (N/A), subsequent_payment_check (N/A). ACCRUED: payee_match, amount_match, ageing_reasonableness, subsequent_payment_check (real); bank_account_match, reference_traceable, duplicate_check, split_payment_check, date_match (N/A). Each with passed, evidence, observed. FAIL if CRITICAL fails. RISK_FLAG: date_match outside, ageing >90d, subsequent_payment missing.

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

**MANDATORY – Evidence Tier (20_EVIDENCE):** Use only document_register rows where Evidence_Tier matches the required tier for each evidence type. Invoice & Payment (PAID) = Tier 1. ACCRUED = Tier 2 (Creditors/Aged report).

1. Scan the General Ledger (use core_data_positions.general_ledger) and pl_extract for total expenditure. Build **Target Sample List** from STEP A (five dimensions: Value coverage, Risk keyword, Materiality, Anomaly, Split/Recurring). Assign selection_dimension to each item. Sort per STEP A rule 6.

2. For each item in the Target Sample List, execute STEP B (Three-Way Match) and STEP C (Fund Integrity). Output GL_ID (or unique ref), GL_Date, GL_Payee, GL_Amount (TraceableValue), Risk_Profile, Three_Way_Match, Fund_Integrity, Overall_Status.

3. Overall_Status: "PASS" = Invoice valid (all checks pass) + (PAID or ACCRUED) + CORRECT fund. "FAIL" = any of: any invoice check failed, payment MISSING, payment CRITICAL check failed (bank_account_match, payee_match, amount_match, duplicate_check, split_payment_check), MISCLASSIFIED. "RISK_FLAG" = BANK_STMT_MISSING, UNCERTAIN fund, or payment RISK (date_match outside ±14d, ageing >90d, subsequent_payment missing, reference_traceable insufficient).

4. You MUST explicitly distinguish "PAID" (found in bank) vs "ACCRUED" (found in creditors report).
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
5. Use same Evidence Tier rules: Invoice = Tier 1; Payment PAID = Tier 1; ACCRUED = Tier 2.
`;
