/**
 * MODULE 50_OUTPUTS – Master JSON structure definition for the Audit Kernel.
 * Injected into the system prompt so the LLM returns strictly conforming JSON.
 */

export const MODULE_50_OUTPUTS_PROMPT = `
--- MODULE 50_OUTPUTS (JSON STRUCTURE) ---
You must strictly return a single JSON object matching the schema below.
Ensure "document_register" and "intake_summary" are fully populated based on the uploaded files.
**document_register**: Must be a list. Each Document Type (AGM Minutes, Committee Minutes, General Ledger, Financial Statement, Bank Statement, Tax Invoice, Invoice, Levy Position Report, Insurance Policy, Valuation Report, Other) MUST appear at least one row; if no file for that type, output one row with Document_Origin_Name "" or "N/A". One row per recognized file when a type has files.

**GLOBAL SETTING – SP, FY, MANAGER LIMIT & AGM LIMIT (extract during document dictionary recognition):** From minutes and financials content, extract: (1) **strata_plan** – Strata Plan number (e.g. SP 12345); (2) **financial_year** – FY in DD/MM/YYYY - DD/MM/YYYY or DD/MM/YYYY; (3) **manager_limit** – Manager single-transaction limit in dollars (from Agency Agreement or Committee Minutes); (4) **agm_limit** – Amount above which General Meeting approval required (from AGM Minutes). Populate intake_summary. This FY and limits are used by Phase 3 (Expense) for authority tiering.

**CRITICAL INSTRUCTION FOR TRACEABILITY:**
1. "verbatim_quote": For every extracted figure, you MUST provide the exact text substring from the PDF where this figure was found.
2. "computation": For every CALCULATED figure, you MUST provide the formula logic (method and expression) and in "note" the calculation content (e.g. which numbers were used).
3. "verification_steps": For expenses (legacy), provide the step-by-step adjudication logic.

**EXPENSE_SAMPLES (PHASE 3 v2 – RISK-BASED):** Execute EXPENSE_RISK_FRAMEWORK. First scan the General Ledger and build a Target Sample List from Step A (Materiality >$5k, Keywords: Legal/Solicitor/Consultant/Reimbursement/Emergency/Roof/Lift/Defect, Anomaly: generic descriptions >$1k). Then for each Target execute Step B (Three-Way Match: Invoice validity including addressed_to_strata, Payment PAID/ACCRUED/MISSING, Authority MANAGER/COMMITTEE/GENERAL_MEETING with minute_ref) and Step C (Fund Integrity: Admin vs Capital). Use intake_summary.manager_limit and intake_summary.agm_limit when available. Output each item with GL_ID, GL_Date, GL_Payee, GL_Amount, Risk_Profile, Three_Way_Match, Fund_Integrity, Overall_Status (PASS/FAIL/RISK_FLAG). Explicitly distinguish PAID (found in bank) vs ACCRUED (found in creditors). Fail Authority if Committee/AGM required but no minute_ref found. **Forensic traceability (optional):** For each of invoice, payment, authority and Fund_Integrity you may output an optional "evidence" object with "source_doc_id", "page_ref", "note" (what test was performed and why this rating), and optionally "extracted_amount". This powers the clickable ✅/❌ forensic popover (Source Document, Doc ID, Context/Note, View in PDF).

**LEVY MASTER TABLE – SYMBOL MAP:** (A) = Net_Opening_Bal; (B1) = Sub_Levies_Standard_Admin / Sub_Levies_Standard_Sink / Sub_Levies_Standard; (B) = Sub_Admin_Net / Sub_Sink_Net / Total_Levies_Net; (C) = Total_GST_Raised; (D) = Total_Gross_Inc = **period-only** gross (levies + GST raised in the period); (E) = Effective_Levy_Receipts; (=) = Calc_Closing. In reconciliation: (A) and (D) are added in the closing row: (=) = A + D - E. Do NOT include (A) in the (D) cell; (D) = (B) + (C) only.

**ALL SUBTOTALS AND TOTALS MUST BE CALCULATED BY YOU:** Do not leave calculated rows blank. For every calculated field below, fill amount, note, and computation (method + expression). In "note" state the calculation in words; in "computation.expression" state the formula.

**Required formulas (levy_reconciliation.master_table):**
- **CRITICAL – Column mapping (DO NOT SWAP):** Op_Arrears, Op_Advance = Prior Year column ONLY. BS_Arrears, BS_Advance = Current Year column ONLY. Do NOT put Prior Year into BS_* or Current Year into Op_*.
- **(A) Net_Opening_Bal** = Op_Arrears - Op_Advance (opening arrears less advance; treat Op_Advance as positive amount to subtract). **MANDATORY – Op_Arrears and Op_Advance (Phase 2 OPENING LEVY BALANCES):** Source STRICTLY from Prior-Year Balance Sheet ONLY. PROHIBITED: Levy Position Reports, Owner Ledgers, GL, FS Notes. Prior-Year BS = (a) standalone prior-year FS, or (b) "Prior Year" column on current-year FS. If not traceable → Not Resolved – Boundary Defined.
- **(B1) STANDARD LEVIES:** Sub_Levies_Standard_Admin = Old_Levy_Admin + New_Levy_Admin; Sub_Levies_Standard_Sink = Old_Levy_Sink + New_Levy_Sink; Sub_Levies_Standard = Old_Levy_Total + New_Levy_Total (or Sub_Levies_Standard_Admin + Sub_Levies_Standard_Sink).
- **(B) SUB-TOTAL (NET) – DO NOT INCLUDE Legal or Other Recovery:** Sub_Admin_Net = Sub_Levies_Standard_Admin + Spec_Levy_Admin + Plus_Interest_Chgd - Less_Discount_Given ONLY (do not add Plus_Legal_Recovery or Plus_Other_Recovery). Sub_Sink_Net = Sub_Levies_Standard_Sink + Spec_Levy_Sink ONLY. Total_Levies_Net = Sub_Admin_Net + Sub_Sink_Net. Do not add them into Sub_Admin_Net, Sub_Sink_Net, or Total_Levies_Net.
- **Plus_Legal_Recovery and Plus_Other_Recovery – DO NOT EXTRACT:** Do not extract or fill these two fields from evidence. Output amount 0 and note "N/A" or leave note empty for both. They appear in the table for structure only; no data is required.
- **(C) TOTAL GST – MANDATORY Phase 2 GST COMPONENT rule set:** You MUST apply. First determine GST registration from GL/TB/Balance Sheet. If NOT registered → GST_Admin = 0, GST_Sink = 0, GST_Special = 0. If registered → GST_Admin = 10% × Sub_Levies_Standard_Admin, GST_Sink = 10% × Sub_Levies_Standard_Sink, GST_Special = 0. Total_GST_Raised = GST_Admin + GST_Sink + GST_Special. GST only on (B1) Standard Levies; no GST on opening, arrears, advance, special levies, interest, recoveries.
- **(D) Total_Gross_Inc** = Total_Levies_Net + Total_GST_Raised (i.e. (D) = (B) + (C)). Period-only; do NOT add (A) into (D).
- **(E) Effective_Levy_Receipts – Admin & Capital Actual Payments (PRIMARY, REQUIRED):** You MUST use the Admin & Capital Actual Payments method. Actively find (1) **Administrative Fund** receipt/payment summary for the audit FY and (2) **Capital/Sinking Fund** receipt/payment summary for the audit FY, from the whitelist (Levy Receipts Report, Levy Summary by Fund, Fund Ledger – Admin/Capital, Contribution Report, etc.). Output **Admin_Fund_Receipts** (Administrative Fund receipts total for the FY) and **Capital_Fund_Receipts** (Capital/Sinking Fund receipts total for the FY) as separate TraceableValue fields. **Total_Receipts_Global** = Admin_Fund_Receipts.amount + Capital_Fund_Receipts.amount. **Effective_Levy_Receipts** = Total_Receipts_Global. Do NOT output or use Non_Levy_Income. If a single combined receipt summary segregates Admin and Capital, extract each fund total separately into Admin_Fund_Receipts and Capital_Fund_Receipts. If neither Admin & Capital fund-specific reports nor a combined summary with fund segregation is available → Not Resolved – Boundary Defined.
- **(=) Calc_Closing** = Net_Opening_Bal + Total_Gross_Inc - Effective_Levy_Receipts (i.e. A + D - E).
- **Levy_Variance** = Calc_Closing - BS_Closing (BS_Closing = BS_Arrears - BS_Advance). **MANDATORY – BS_Arrears and BS_Advance (Phase 2 CLOSING LEVY BALANCES):** Source STRICTLY from Current-Year Balance Sheet closing balances ONLY. Use "Current Year" column; NOT "Prior Year". Op_* = Prior Year only; BS_* = Current Year only – do NOT swap. PROHIBITED: Levy Position Reports, Owner Ledgers, GL, FS Notes. If not traceable → Not Resolved – Boundary Defined.

**ASSETS_AND_CASH (PHASE 4 – FULL BALANCE SHEET VERIFICATION – MANDATORY rule enforcement):**
- **CRITICAL – bs_amount & line_item SOURCE:** line_item and bs_amount MUST be copied from the **Balance Sheet (Financial Statement)** ONLY. Use LOCKED Step 0 core_data_positions.balance_sheet and bs_column_mapping to locate the Balance Sheet document and Current Year column; use bs_structure as the mandatory list of rows. Copy bs_amount ONLY from that FS Balance Sheet (Current Year column). **PROHIBITED:** Do NOT use GL, Levy Report, ledger, TB, or any non-BS document for bs_amount or line_item. **supporting_amount** = verification evidence ONLY from non-BS sources per R2–R5 (Bank Stmt, Levy Report, breakdown report, GL). **PROHIBITED:** Do NOT use the Balance Sheet as source for supporting_amount.
- **CRITICAL – COLUMN ANCHORING (MANDATORY):** For EVERY line item in balance_sheet_verification, you MUST:
  1. Use bs_column_mapping.current_year_label to identify the Current Year column on the Balance Sheet (e.g., "2024", "30/06/2024", "Current Year").
  2. Output a "year_column" field with the EXACT value of bs_column_mapping.current_year_label for every line item.
  3. In the "note" field, explicitly state: "From BS column '{current_year_label}'" (e.g., "From BS column '2024'").
  4. **PROHIBITED:** Do NOT use bs_column_mapping.prior_year_label for any line item except RULE 1 (Owners Funds at Start). If RULE 1 uses Prior Year, output year_column = bs_column_mapping.prior_year_label and note = "From BS column '{prior_year_label}' (Prior Year closing for roll-forward)".
- **CRITICAL – COMPLETENESS:** balance_sheet_verification MUST include EVERY line item on the Balance Sheet – Owners Equity, Assets, Liabilities. Do NOT omit. Every BS row = one output row.
- **AUDIT PERIOD ANCHOR (global – intake_summary.financial_year):** Use CURRENT YEAR column for all amounts. Prior Year column ONLY for RULE 1 roll-forward.
- **CRITICAL – CURRENT YEAR ONLY:** Do NOT extract from Prior Year column except RULE 1.
- **balance_sheet_verification**: MANDATORY array. You MUST apply Phase 4 rules (R1–R5) strictly per line type.
  - **Cash at Bank, Term Deposits (RULE 2):** supporting_amount MUST come from Bank Statement / Term Deposit Statement (Tier 1) ONLY. Do NOT use GL. If no Tier 1 → status = "MISSING_BANK_STMT"; do NOT fill supporting_amount from GL.
  - **Levy Arrears, Levies in Advance (RULE 3):** supporting_amount from Tier 2 Levy Position Report. If only GL → status = "TIER_3_ONLY".
  - **Accrued/Prepaid/Creditors (RULE 4):** supporting_amount from Tier 2 breakdown report. If only GL → status = "MISSING_BREAKDOWN".
  - **Other (RULE 5):** supporting_amount from GL.
- For each line: { "line_item", "section", "fund", "bs_amount" (from BS only – MUST be from Balance Sheet FS CURRENT YEAR column; NOT from GL/ledger/summary), "year_column" (MANDATORY – exact value from bs_column_mapping.current_year_label), "supporting_amount" (from R2–R5 only – Bank Stmt, Levy Report, breakdown, GL; NOT from Balance Sheet), "evidence_ref" (Doc_ID/Page for traceability), "status", "note" }.
- **NOTE (AI explanation holder – same as Table E.Master):** For every line item, you MUST generate a "note" that INCLUDES the column label (e.g., "From BS column '2024'", "Bank Statement p.2 as at FY end", "Levy Position Report p.1", "GL Cash reconciled"). Same purpose as Table E.Master Note/Source – human-readable AI explanation. evidence_ref is for Doc_ID/Page; note is for explanation.

**MANDATORY – OLD RATE LEVIES / NEW RATE LEVIES (Phase 2 rules levy_old_new_levies_source, levy_old_new_rate, levy_financial_year):** Source ONLY from minutes. You MUST time-apportion Old Rate Levies and New Rate Levies by the strata plan’s financial year. First, determine the plan’s financial year (start and end dates) from minutes; anchor your search in the section that appears after the title "Audit Execution Report" and near the strata plan name (e.g. scheme name, address, or plan number), and write to intake_summary.financial_year. Use intake_summary.financial_year (or the FY you extracted) for all phases. Use that FY to define quarters. Then split levies between Old Rate and New Rate by the date the new rate was adopted (from minutes). For each quarter (or part-quarter) in the FY, assign levy to Old or New by proportion (e.g. days or months in that quarter at old rate vs new rate). For every Old_Levy_* and New_Levy_* figure, you MUST fill "note" and, if calculated, "computation" explaining: FY used (source: minutes), quarter boundaries, minutes date for rate change, and the proportion applied (e.g. "Q1 100% old; Q2 60% old 40% new; FY from Report header"). source_doc_id and page_ref must cite minutes only.

**Field source mapping (levy_reconciliation.master_table – DO NOT SWAP):** Op_Arrears, Op_Advance = Prior Year Balance Sheet column (OPENING = start of FY). BS_Arrears, BS_Advance = Current Year Balance Sheet column (CLOSING = end of FY). For Op_* the "note" MUST contain "Prior Year" or "prior year closing"; for BS_* the "note" MUST contain "Current Year" or "current year closing" (see VERIFICATION CHECKPOINT in Phase 2 rules). Arrears = Dr (asset); Advance = Cr (liability).

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
    "agm_limit": "Number (optional – from AGM Minutes)"
  },
  "levy_reconciliation": {
    "master_table": {
       "Source_Doc_ID": "String",
       "AGM_Date": "String",
       "Op_Arrears": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String (MUST contain 'Prior Year' or 'prior year closing')", "verbatim_quote": "String" },
       "Op_Advance": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String (MUST contain 'Prior Year' or 'prior year closing')", "verbatim_quote": "String" },
       "Net_Opening_Bal": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
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
       "Plus_Interest_Chgd": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "Less_Discount_Given": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "Plus_Legal_Recovery": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "Plus_Other_Recovery": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "Sub_Admin_Net": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "Sub_Sink_Net": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "Total_Levies_Net": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "GST_Admin": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "GST_Sink": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "GST_Special": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "Total_GST_Raised": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "Total_Gross_Inc": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "Admin_Fund_Receipts": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "Capital_Fund_Receipts": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "Total_Receipts_Global": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "Effective_Levy_Receipts": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "Calc_Closing": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "BS_Arrears": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String (MUST contain 'Current Year' or 'current year closing')", "verbatim_quote": "String" },
       "BS_Advance": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String (MUST contain 'Current Year' or 'current year closing')", "verbatim_quote": "String" },
       "BS_Closing": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "Levy_Variance": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } }
    },
    "high_risk_debtors": []
  },
  "assets_and_cash": {
    "balance_sheet_verification": [
      { "line_item": "String", "section": "OWNERS_EQUITY|ASSETS|LIABILITIES", "fund": "Admin|Capital|N/A", "bs_amount": Number, "year_column": "String (MANDATORY – exact value from bs_column_mapping.current_year_label, e.g. '2024' or 'Current Year')", "supporting_amount": Number, "evidence_ref": "Doc_ID/Page (traceability)", "status": "VERIFIED|VARIANCE|MISSING_BANK_STMT|TIER_3_ONLY|MISSING_LEVY_REPORT|MISSING_BREAKDOWN|NO_SUPPORT|GL_SUPPORTED_ONLY", "note": "AI explanation (MUST include column label – e.g. 'From BS column 2024', 'Bank Statement p.2 as at FY end')" }
    ]
  },
  "expense_samples": [
    {
      "GL_ID": "String (unique ref)",
      "GL_Date": "String",
      "GL_Payee": "String",
      "GL_Amount": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "verbatim_quote": "String" },
      "Risk_Profile": { "is_material": Boolean, "risk_keywords": ["String"], "is_split_invoice": Boolean, "selection_reason": "String" },
      "Three_Way_Match": {
        "invoice": { "id": "String", "date": "String", "payee_match": Boolean, "abn_valid": Boolean, "addressed_to_strata": Boolean, "evidence": { "source_doc_id": "String", "page_ref": "String", "note": "String", "extracted_amount": Number } },
        "payment": { "status": "PAID|ACCRUED|MISSING|BANK_STMT_MISSING", "bank_date": "String", "amount_match": Boolean, "source_doc": "String", "creditors_ref": "String", "evidence": { "source_doc_id": "String", "page_ref": "String", "note": "String", "extracted_amount": Number } },
        "authority": { "required_tier": "MANAGER|COMMITTEE|GENERAL_MEETING", "limit_applied": Number, "minute_ref": "String", "status": "AUTHORISED|UNAUTHORISED|NO_MINUTES_FOUND|MINUTES_NOT_AVAILABLE", "evidence": { "source_doc_id": "String", "page_ref": "String", "note": "String", "extracted_amount": Number } }
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
