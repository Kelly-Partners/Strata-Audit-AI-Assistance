/**
 * MODULE 50_OUTPUTS – Master JSON structure definition for the Audit Kernel.
 * Injected into the system prompt so the LLM returns strictly conforming JSON.
 * Document types list is derived from DOCUMENT_TYPES (step_0_intake).
 */

import { DOCUMENT_TYPES } from "../audit_engine/workflow/step_0_intake";

export const MODULE_50_OUTPUTS_PROMPT = `
--- MODULE 50_OUTPUTS (JSON STRUCTURE) ---
You must strictly return a single JSON object matching the schema below.
Ensure "document_register" and "intake_summary" are fully populated based on the uploaded files.
**document_register**: Must be a list. Each Document Type (${DOCUMENT_TYPES.join(", ")}) MUST appear at least one row; if no file for that type, output one row with Document_Origin_Name "" or "N/A". One row per recognized file when a type has files.

**GLOBAL SETTING – SP, FY, MANAGER LIMIT & AGM LIMIT (extract during document dictionary recognition):** From minutes and financials content, extract: (1) **strata_plan** – Strata Plan number (e.g. SP 12345); (2) **financial_year** – FY in DD/MM/YYYY - DD/MM/YYYY or DD/MM/YYYY; (3) **manager_limit** – Manager single-transaction limit in dollars (from Agency Agreement or Committee Minutes); (4) **agm_limit** – Amount above which General Meeting approval required (from AGM Minutes). Populate intake_summary. **All phases MUST use intake_summary.financial_year as the LOCKED FY and must not re-determine it.** This FY is used by all phases. manager_limit/agm_limit are used by Phase 3 Step A (MATERIALITY, SPLIT_PATTERN) when available. (5) **registered_for_gst** – From Step 0 BS scan: true if bs_extract.rows contains GST account; false otherwise. Phase 2 and Phase 5 MUST use this LOCKED value.

**CRITICAL INSTRUCTION FOR TRACEABILITY:**
1. "verbatim_quote": For every extracted figure, you MUST provide the exact text substring from the PDF where this figure was found.
2. "computation": For every CALCULATED figure, you MUST provide the formula logic (method and expression) and in "note" the calculation content (e.g. which numbers were used).
3. "verification_steps": For expenses (legacy), provide the step-by-step adjudication logic.

**CRITICAL – source_doc_id MUST be Document_ID (single source of truth):**
- Every TraceableValue and evidence.source_doc_id MUST use the Document_ID from document_register (e.g. "Sys_001", "Sys_002").
- NEVER use descriptive text like "Balance Sheet (FS)", "Committee Meeting...", minute_ref text, source_doc, or creditors_ref as source_doc_id.
- For calculated fields, use exactly "CALCULATED". For empty/N/A, use "-".
- This ensures forensic traceability: source_doc_id → document_register → Document_Origin_Name → file.

**EXPENSE_SAMPLES (PHASE 3 v2 – RISK-BASED – EVIDENCE TIER MANDATORY):** Execute EXPENSE_RISK_FRAMEWORK. Use ONLY document_register rows where Evidence_Tier matches: Invoice = Tier 1; Payment PAID = Tier 1 (Bank Statement); ACCRUED = Tier 2 (Creditors Report). First scan the General Ledger and pl_extract; build Target Sample List from Step A (five dimensions: VALUE_COVERAGE, RISK_KEYWORD, MATERIALITY, ANOMALY_DESCRIPTION, SPLIT_PATTERN, RECURRING_NEAR_LIMIT). Assign selection_dimension to each item – REQUIRED. Then for each Target execute Step B (Three-Way Match) and Step C (Fund Integrity). Output each item with GL_ID, GL_Date, GL_Payee, GL_Amount, Risk_Profile (including selection_dimension), Three_Way_Match, Fund_Integrity, Overall_Status (PASS/FAIL/RISK_FLAG). Explicitly distinguish PAID (found in bank) vs ACCRUED (found in Creditors Report).

**INVOICE & PAYMENT CHECKS – REQUIRED:** invoice.checks and payment.checks are REQUIRED. Invoice: all six (sp_number, address, amount, gst_verified, payee_match, abn_valid). Payment: all nine (bank_account_match, payee_match, amount_match, reference_traceable, duplicate_check, split_payment_check, date_match, ageing_reasonableness, subsequent_payment_check); PAID uses bank/ref/dup/split/date real + ageing/subsequent N/A; ACCRUED uses payee/amount/ageing/subsequent real + others N/A. Each check MUST have: passed (boolean), evidence (source_doc_id, page_ref, note), and observed (string – actual values read, e.g. "Invoice $1100 vs GL $1100; within tolerance"). Do NOT omit checks or leave note/observed empty. **PAYMENT TRACEABILITY:** For payment checks, evidence.source_doc_id MUST be the Document_ID of Bank Statement (PAID) or Creditors Report (ACCRUED) from document_register. NEVER use "-" when a payment document exists – use the actual Document_ID.

**Forensic traceability (optional):** For each of invoice, payment and Fund_Integrity you may output an optional top-level "evidence" object with "source_doc_id", "page_ref", "note", and optionally "extracted_amount". This powers the clickable ✅/❌ forensic popover.

**LEVY MASTER TABLE – SYMBOL MAP:** (A) = PriorYear_Net (Net Prior Year Levy Position = PriorYear_Arrears - PriorYear_Advance); (B1) = Sub_Levies_Standard_Admin / Sub_Levies_Standard_Sink / Sub_Levies_Standard; (B) = Sub_Admin_Net / Sub_Sink_Net / Total_Levies_Net; (C) = Total_GST_Raised; (D) = Total_Gross_Inc = **period-only** gross (levies + GST raised in the period); (E) = Effective_Levy_Receipts; (=) = Calc_Closing; (G) = CurrentYear_Net (Net Current Year Levy Position = CurrentYear_Arrears - CurrentYear_Advance). In reconciliation: (A) and (D) are added in the closing row: (=) = A + D - E. Do NOT include (A) in the (D) cell; (D) = (B) + (C) only.

**ALL SUBTOTALS AND TOTALS MUST BE CALCULATED BY YOU:** Do not leave calculated rows blank. For every calculated field below, fill amount, note, and computation (method + expression). In "note" state the calculation in words; in "computation.expression" state the formula.

**Required formulas (levy_reconciliation.master_table):**
- **CRITICAL – BS source:** PriorYear_Arrears, PriorYear_Advance, CurrentYear_Arrears, CurrentYear_Advance MUST be looked up from LOCKED bs_extract ONLY. Do NOT use Levy Reports, GL, or any other source.
- **(A) PriorYear_Net** = PriorYear_Arrears - PriorYear_Advance. **MANDATORY:** PriorYear_Arrears and PriorYear_Advance = prior_year amounts from bs_extract.rows (match Levies in Arrears / Levies in Advance). If bs_extract missing → Not Resolved – Boundary Defined.
- **(B1) STANDARD LEVIES:** Sub_Levies_Standard_Admin = Old_Levy_Admin + New_Levy_Admin; Sub_Levies_Standard_Sink = Old_Levy_Sink + New_Levy_Sink; Sub_Levies_Standard = Old_Levy_Total + New_Levy_Total (or Sub_Levies_Standard_Admin + Sub_Levies_Standard_Sink).
- **(B) SUB-TOTAL (NET) – DO NOT INCLUDE Legal or Other Recovery:** Sub_Admin_Net = Sub_Levies_Standard_Admin + Spec_Levy_Admin + Plus_Interest_Chgd_Admin - Less_Discount_Given_Admin ONLY (do not add Plus_Legal_Recovery or Plus_Other_Recovery). Sub_Sink_Net = Sub_Levies_Standard_Sink + Spec_Levy_Sink + Plus_Interest_Chgd_Sink - Less_Discount_Given_Sink ONLY. Total_Levies_Net = Sub_Admin_Net + Sub_Sink_Net. Do not add them into Sub_Admin_Net, Sub_Sink_Net, or Total_Levies_Net.
- **INTEREST CHARGED & DISCOUNT GIVEN – Admin/Capital split (MANDATORY):** Extract **Plus_Interest_Chgd_Admin**, **Plus_Interest_Chgd_Sink**, **Plus_Interest_Chgd_Total** and **Less_Discount_Given_Admin**, **Less_Discount_Given_Sink**, **Less_Discount_Given_Total** from Tier 2 Levy Position Report, Levy Receipts Report, Cash Management Report, or Levy Arrears Report. If evidence shows split by fund (Admin vs Capital/Sinking), extract each directly. If evidence shows only a single total: allocate proportionally: Interest_Admin = Total × (Sub_Levies_Standard_Admin / Sub_Levies_Standard), Interest_Sink = Total × (Sub_Levies_Standard_Sink / Sub_Levies_Standard); same for Discount. Fill source_doc_id, page_ref, verbatim_quote, and note (include allocation method if proportional).
- **Plus_Legal_Recovery and Plus_Other_Recovery – DO NOT EXTRACT:** Do not extract or fill these two fields from evidence. Output amount 0 and note "N/A" or leave note empty for both. They appear in the table for structure only; no data is required.
- **(C) TOTAL GST – MANDATORY Phase 2 GST COMPONENT rule set:** You MUST use intake_summary.registered_for_gst (LOCKED from Step 0). If registered_for_gst is false or absent → GST_Admin = 0, GST_Sink = 0, GST_Special_Admin = 0, GST_Special_Sink = 0, GST_Special = 0. If registered_for_gst is true → GST_Admin = 10% × Sub_Levies_Standard_Admin; GST_Sink = 10% × Sub_Levies_Standard_Sink; GST_Special_Admin = 10% × Spec_Levy_Admin; GST_Special_Sink = 10% × Spec_Levy_Sink; GST_Special = GST_Special_Admin + GST_Special_Sink. Total_GST_Raised = GST_Admin + GST_Sink + GST_Special. GST applies to both (B1) Standard Levies AND Special Levies per AU strata (ATO: all levies subject to GST when registered). No GST on opening, arrears, advance, interest, recoveries. Do NOT re-determine GST registration.
- **(D) Total_Gross_Inc** = Total_Levies_Net + Total_GST_Raised (i.e. (D) = (B) + (C)). Period-only; do NOT add (A) into (D).
- **(E) Effective_Levy_Receipts – Admin & Capital Actual Payments (PRIMARY, REQUIRED – TIER 2 ONLY):** You MUST use the Admin & Capital Actual Payments method. Source ONLY from document_register rows where Evidence_Tier = Tier 2. Permitted: Cash Management Report, Levy Position Report, Levy Receipts Report, Levy Arrears Report, Levy Summary Report. Actively find (1) **Administrative Fund** receipt/payment summary for the audit FY and (2) **Capital/Sinking Fund** receipt/payment summary for the audit FY, prefer **Cash Management Report** when available. Output **Admin_Fund_Receipts** and **Capital_Fund_Receipts** as separate TraceableValue fields. **Total_Receipts_Global** = Admin_Fund_Receipts.amount + Capital_Fund_Receipts.amount. **Effective_Levy_Receipts** = Total_Receipts_Global. Tier 3 (GL, FS, Notes, Other) is PROHIBITED. Do NOT output or use Non_Levy_Income. If neither Admin & Capital fund-specific Tier 2 reports nor a combined Tier 2 summary with fund segregation is available → Not Resolved – Boundary Defined.
- **(=) Calc_Closing** = PriorYear_Net + Total_Gross_Inc - Effective_Levy_Receipts (i.e. A + D - E).
- **(G) CurrentYear_Net** = CurrentYear_Arrears - CurrentYear_Advance. **MANDATORY:** CurrentYear_Arrears and CurrentYear_Advance = current_year amounts from bs_extract.rows. PROHIBITED: Any source other than bs_extract. If not traceable → Not Resolved – Boundary Defined.
- **Levy_Variance** = Calc_Closing - CurrentYear_Net.

**ASSETS_AND_CASH (PHASE 4 – FULL BALANCE SHEET VERIFICATION – MANDATORY rule enforcement):**
- **CRITICAL – bs_amount & line_item SOURCE:** MUST be looked up from LOCKED bs_extract ONLY (from FS Balance Sheet at Step 0). Match by (line_item, fund, section). bs_amount = current_year; RULE 1: bs_amount = current_year (opening), supporting_amount = prior_year (roll-forward). When evidence missing: supporting_amount = null (do NOT use 0). **PROHIBITED:** Do NOT use GL or non-bs_extract for bs_amount. **PROHIBITED (Receivable):** If current_year blank, output 0; do NOT substitute with prior_year.
- **year_column:** Use bs_extract.current_year_label (or prior_year_label for RULE 1 only).
- **note:** "BS: From bs_extract current_year" (or "prior_year for roll-forward" for RULE 1).
- **AUDIT PERIOD ANCHOR (global – intake_summary.financial_year):** Use CURRENT YEAR column for all amounts. Prior Year column ONLY for RULE 1 roll-forward.
- **CRITICAL – CURRENT YEAR ONLY:** Do NOT extract from Prior Year column except RULE 1.
- **balance_sheet_verification**: MANDATORY array. You MUST apply Phase 4 rules (R1–R5) strictly per line type.
  - **Cash at Bank, Term Deposits (RULE 2):** supporting_amount from Bank Statement (Tier 1) ONLY. If no Tier 1 → status = "MISSING_BANK_STMT"; supporting_amount = null.
  - **Levy Arrears, Levies in Advance (RULE 3):** supporting_amount from Tier 2 Levy Position Report. If only GL → status = "TIER_3_ONLY".
  - **Accrued/Prepaid/Creditors (RULE 4):** supporting_amount from Tier 2 breakdown report. If only GL → status = "MISSING_BREAKDOWN".
  - **Other (RULE 5):** supporting_amount from GL.
- For each line: { "line_item", "section", "fund", "bs_amount", "year_column", "supporting_amount", "evidence_ref", "status", "note", "supporting_note" }.
- **note** = bs_amount source ONLY (e.g. "From BS column '2024'"). Do NOT include supporting evidence. Used for BS Amount ForensicCell.
- **supporting_note** = supporting_amount source ONLY (e.g. "Matches Bank Statement p.2", "Matches Macquarie Investment Account Statement 2036-74072"). Do NOT include "From BS column". Used for Supporting ForensicCell.

**STATUTORY_COMPLIANCE (Phase 5 – evidence tier MANDATORY):** Use only document_register rows where Evidence_Tier matches: Insurance = Tier 1 ONLY (Policy, Certificate, Insurance Valuation Report). GST = Tier 1 for BAS/Bank; Tier 2 for schedules; Tier 3 fallback only. Income Tax = Tier 1 for ATO; Tier 3 fallback when N/A. Use intake_summary.registered_for_gst from LOCKED context. If false or absent → output gst_reconciliation with all TraceableValue amounts = 0 and GST_Materiality = "N/A – Plan not registered for GST (per Step 0)". If true → perform full GST roll-forward (Opening + GST Raised - GST Paid + BAS Activity = Closing). Use Total_GST_Raised from levy_reconciliation for consistency with Phase 2.

**MANDATORY – OLD RATE LEVIES / NEW RATE LEVIES (Phase 2 rules levy_old_new_levies_source, levy_old_new_rate, levy_financial_year):** Source ONLY from minutes. You MUST time-apportion Old Rate Levies and New Rate Levies by the strata plan’s **LOCKED financial year from Step 0**. Use intake_summary.financial_year for all phases. Use that FY to define quarters. Then split levies between Old Rate and New Rate by the date the new rate was adopted (from minutes). For each quarter (or part-quarter) in the FY, assign levy to Old or New by proportion (e.g. days or months in that quarter at old rate vs new rate). For every Old_Levy_* and New_Levy_* figure, you MUST fill "note" and, if calculated, "computation" explaining: FY used (source: intake_summary.financial_year), quarter boundaries, minutes date for rate change, and the proportion applied (e.g. "Q1 100% old; Q2 60% old 40% new"). source_doc_id and page_ref must cite minutes only.

**Field source (levy_reconciliation.master_table – PriorYear_*/CurrentYear_*):** Look up from LOCKED bs_extract.rows: PriorYear_* = prior_year; CurrentYear_* = current_year. Arrears = Dr (asset); Advance = Cr (liability).

JSON SCHEMA:
{
  "document_register": [
    {
      "Document_ID": "String (e.g. Sys_001)",
      "Document_Origin_Name": "String (Exact filename from manifest)",
      "Document_Name": "String (Standardized Name)",
      "Document_Type": "String",
      "Page_Range": "String (e.g. 'Pages 1-5' or 'All')",
      "Evidence_Tier": "String (Tier 1/Tier 2/Tier 3)",
      "Relevant_Phases": ["String"],
      "Notes": "String"
    }
  ],
  "intake_summary": {
    "total_files": Number,
    "missing_critical_types": ["String"],
    "status": "String",
    "strata_plan": "String (e.g. SP 12345)",
    "financial_year": "String (e.g. 01/07/2024 - 30/06/2025 or DD/MM/YYYY)",
    "manager_limit": "Number (optional – from Agency Agreement / Minutes)",
    "agm_limit": "Number (optional – from AGM Minutes)",
    "boundary_defined": "Boolean (optional – true when FY or BS mapping ambiguous)",
    "bs_extract_warning": "String (optional – e.g. 'balance_check_failed')",
    "registered_for_gst": "Boolean (optional – true if BS contains GST account(s); false otherwise)"
  },
  "bs_extract": {
    "prior_year_label": "String",
    "current_year_label": "String",
    "rows": [
      { "line_item": "String", "section": "OWNERS_EQUITY|ASSETS|LIABILITIES", "fund": "Admin|Capital|N/A", "prior_year": Number, "current_year": Number }
    ]
  },
  "levy_reconciliation": {
    "master_table": {
       "Source_Doc_ID": "String",
       "AGM_Date": "String",
       "PriorYear_Arrears": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String (from bs_extract prior_year)", "verbatim_quote": "String" },
       "PriorYear_Advance": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String (from bs_extract prior_year)", "verbatim_quote": "String" },
       "PriorYear_Net": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "Old_Levy_Admin": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "Old_Levy_Sink": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "Old_Levy_Total": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "New_Levy_Admin": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "New_Levy_Sink": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "New_Levy_Total": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "Sub_Levies_Standard": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "Sub_Levies_Standard_Admin": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "Sub_Levies_Standard_Sink": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "Spec_Levy_Admin": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "Spec_Levy_Sink": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "Spec_Levy_Total": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "Plus_Interest_Chgd_Admin": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "Plus_Interest_Chgd_Sink": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "Plus_Interest_Chgd_Total": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "Less_Discount_Given_Admin": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "Less_Discount_Given_Sink": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "Less_Discount_Given_Total": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "Plus_Legal_Recovery": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "Plus_Other_Recovery": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "Sub_Admin_Net": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "Sub_Sink_Net": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "Total_Levies_Net": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "GST_Admin": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "GST_Sink": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "GST_Special_Admin": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "GST_Special_Sink": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "GST_Special": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "Total_GST_Raised": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "Total_Gross_Inc": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "Admin_Fund_Receipts": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "Capital_Fund_Receipts": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "Total_Receipts_Global": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "Effective_Levy_Receipts": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "Calc_Closing": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "CurrentYear_Arrears": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String (from bs_extract current_year)", "verbatim_quote": "String" },
       "CurrentYear_Advance": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String (from bs_extract current_year)", "verbatim_quote": "String" },
       "CurrentYear_Net": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "Levy_Variance": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } }
    },
    "high_risk_debtors": []
  },
  "assets_and_cash": {
    "balance_sheet_verification": [
      { "line_item": "String", "section": "OWNERS_EQUITY|ASSETS|LIABILITIES", "fund": "Admin|Capital|N/A", "bs_amount": Number, "year_column": "String", "supporting_amount": "Number or null (null when evidence missing)", "evidence_ref": "Doc_ID/Page", "status": "VERIFIED|VARIANCE|MISSING_BANK_STMT|TIER_3_ONLY|MISSING_LEVY_REPORT|MISSING_BREAKDOWN|NO_SUPPORT|GL_SUPPORTED_ONLY|SUBTOTAL_CHECK_ONLY", "note": "bs_amount from bs_extract (e.g. 'From bs_extract current_year')", "supporting_note": "supporting_amount source ONLY – e.g. 'Matches Bank Statement p.2' (do NOT include 'From BS column')" }
    ]
  },
  "expense_samples": [
    {
      "GL_ID": "String (unique ref)",
      "GL_Date": "String",
      "GL_Payee": "String",
      "GL_Amount": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "verbatim_quote": "String" },
      "Risk_Profile": { "is_material": Boolean, "risk_keywords": ["String"], "is_split_invoice": Boolean, "selection_reason": "String", "selection_dimension": "VALUE_COVERAGE|RISK_KEYWORD|MATERIALITY|ANOMALY_DESCRIPTION|SPLIT_PATTERN|RECURRING_NEAR_LIMIT|OTHER" },
      "Three_Way_Match": {
        "invoice": { "id": "String", "date": "String", "checks": { "sp_number": { "passed": Boolean, "evidence": { "source_doc_id", "page_ref", "note" }, "observed": "String" }, "address": { "passed", "evidence", "observed" }, "amount": { "passed", "evidence", "observed" }, "gst_verified": { "passed", "evidence", "observed" }, "payee_match": { "passed", "evidence", "observed" }, "abn_valid": { "passed", "evidence", "observed" } }, "payee_match": Boolean, "abn_valid": Boolean, "addressed_to_strata": Boolean, "evidence": { "source_doc_id": "String", "page_ref": "String", "note": "String", "extracted_amount": Number } },
        "payment": { "status": "PAID|ACCRUED|MISSING|BANK_STMT_MISSING", "bank_date": "String", "amount_match": Boolean, "source_doc": "String", "creditors_ref": "String", "checks": { "bank_account_match": { "passed", "evidence", "observed" }, "payee_match": { "passed", "evidence", "observed" }, "amount_match": { "passed", "evidence", "observed" }, "reference_traceable": { "passed", "evidence", "observed" }, "duplicate_check": { "passed", "evidence", "observed" }, "split_payment_check": { "passed", "evidence", "observed" }, "date_match": { "passed", "evidence", "observed" }, "ageing_reasonableness": { "passed", "evidence", "observed" }, "subsequent_payment_check": { "passed", "evidence", "observed" } }, "evidence": { "source_doc_id": "String", "page_ref": "String", "note": "String", "extracted_amount": Number } }
      },
      "Fund_Integrity": { "gl_fund_code": "String", "invoice_nature": "String", "classification_status": "CORRECT|MISCLASSIFIED|UNCERTAIN", "note": "String", "evidence": { "source_doc_id": "String", "page_ref": "String", "note": "String", "extracted_amount": Number } },
      "Overall_Status": "PASS|FAIL|RISK_FLAG"
    }
  ],
  "statutory_compliance": {
     "insurance": {
       "Val_Doc_ID": "String",
       "Ins_Doc_ID": "String",
       "Valuation_Amount": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "verbatim_quote": "String" },
       "Valuation_Date": "String",
       "Policy_Amount": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "verbatim_quote": "String" },
       "Policy_No": "String",
       "Insurance_Gap": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "computation": { "method": "String", "expression": "String" } },
       "Insurance_Status": "String",
       "Policy_Expiry": "String",
       "Expiry_Status": "String"
     },
     "gst_reconciliation": {
       "GST_Opening_Bal": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "verbatim_quote": "String" },
       "Total_GST_Raised": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "verbatim_quote": "String" },
       "GST_On_Payments": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "verbatim_quote": "String" },
       "GST_Theor_Mvmt": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "computation": { "method": "String", "expression": "String" } },
       "BAS_Q1": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "verbatim_quote": "String" },
       "BAS_Q2": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "verbatim_quote": "String" },
       "BAS_Q3": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "verbatim_quote": "String" },
       "BAS_Q4": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "verbatim_quote": "String" },
       "Total_BAS_Cash": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "computation": { "method": "String", "expression": "String" } },
       "GST_Calc_Closing": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "computation": { "method": "String", "expression": "String" } },
       "GST_GL_Closing": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "verbatim_quote": "String" },
       "GST_Rec_Variance": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "computation": { "method": "String", "expression": "String" } },
       "GST_Materiality": "String"
     },
     "income_tax": {
       "GL_Doc_ID": "String",
       "Interest_Income": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "verbatim_quote": "String" },
       "Other_Taxable_Income": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "verbatim_quote": "String" },
       "Tax_Deductions": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "verbatim_quote": "String" },
       "Net_Taxable": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "computation": { "method": "String", "expression": "String" } },
       "Calc_Tax": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "computation": { "method": "String", "expression": "String" } },
       "GL_Tax_Exp": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "verbatim_quote": "String" },
       "Tax_Adj_Status": "String"
     }
  },
  "completion_outputs": {
     "issue_register": [ { "Issue_ID": "String", "Phase": "String", "Description": "String", "Resolution_Status": "String" } ],
     "boundary_disclosure": [ { "Area": "String", "What_Is_Missing": "String", "Why_Unresolved": "String", "Required_To_Resolve": "String" } ]
  }
}
`;
