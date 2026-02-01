/**
 * MODULE 50_OUTPUTS – Master JSON structure definition for the Audit Kernel.
 * Injected into the system prompt so the LLM returns strictly conforming JSON.
 */

export const MODULE_50_OUTPUTS_PROMPT = `
--- MODULE 50_OUTPUTS (JSON STRUCTURE) ---
You must strictly return a single JSON object matching the schema below.
Ensure "document_register" and "intake_summary" are fully populated based on the uploaded files.
**document_register**: Must be a list. Each Document Type (AGM Minutes, Committee Minutes, General Ledger, Financial Statement, Bank Statement, Tax Invoice, Invoice, Levy Position Report, Insurance Policy, Valuation Report, Other) MUST appear at least one row; if no file for that type, output one row with Document_Origin_Name "" or "N/A". One row per recognized file when a type has files.

**GLOBAL SETTING – SP & FY (extract during document dictionary recognition):** From minutes and financials content, extract: (1) **strata_plan** – Strata Plan number (e.g. SP 12345); (2) **financial_year** – FY in DD/MM/YYYY - DD/MM/YYYY or DD/MM/YYYY. Populate intake_summary.strata_plan and intake_summary.financial_year. This FY is the **global audit period** for all phases.

**CRITICAL INSTRUCTION FOR TRACEABILITY:**
1. "verbatim_quote": For every extracted figure, you MUST provide the exact text substring from the PDF where this figure was found.
2. "computation": For every CALCULATED figure, you MUST provide the formula logic (method and expression) and in "note" the calculation content (e.g. which numbers were used).
3. "verification_steps": For expenses, provide the step-by-step adjudication logic.

**LEVY MASTER TABLE – SYMBOL MAP:** (A) = Net_Opening_Bal; (B1) = Sub_Levies_Standard_Admin / Sub_Levies_Standard_Sink / Sub_Levies_Standard; (B) = Sub_Admin_Net / Sub_Sink_Net / Total_Levies_Net; (C) = Total_GST_Raised; (D) = Total_Gross_Inc; (E) = Effective_Levy_Receipts; (=) = Calc_Closing.

**ALL SUBTOTALS AND TOTALS MUST BE CALCULATED BY YOU:** Do not leave calculated rows blank. For every calculated field below, fill amount, note, and computation (method + expression). In "note" state the calculation in words; in "computation.expression" state the formula.

**Required formulas (levy_reconciliation.master_table):**
- **(A) Net_Opening_Bal** = Op_Arrears - Op_Advance (opening arrears less advance; treat Op_Advance as positive amount to subtract). **MANDATORY – Op_Arrears and Op_Advance (Phase 2 OPENING LEVY BALANCES):** Source STRICTLY from Prior-Year Balance Sheet ONLY. PROHIBITED: Levy Position Reports, Owner Ledgers, GL, FS Notes. Prior-Year BS = (a) standalone prior-year FS, or (b) "Prior Year" column on current-year FS. If not traceable → Not Resolved – Boundary Defined.
- **(B1) STANDARD LEVIES:** Sub_Levies_Standard_Admin = Old_Levy_Admin + New_Levy_Admin; Sub_Levies_Standard_Sink = Old_Levy_Sink + New_Levy_Sink; Sub_Levies_Standard = Old_Levy_Total + New_Levy_Total (or Sub_Levies_Standard_Admin + Sub_Levies_Standard_Sink).
- **(B) SUB-TOTAL (NET) – DO NOT INCLUDE Legal or Other Recovery:** Sub_Admin_Net = Sub_Levies_Standard_Admin + Spec_Levy_Admin + Plus_Interest_Chgd - Less_Discount_Given ONLY (do not add Plus_Legal_Recovery or Plus_Other_Recovery). Sub_Sink_Net = Sub_Levies_Standard_Sink + Spec_Levy_Sink ONLY. Total_Levies_Net = Sub_Admin_Net + Sub_Sink_Net. Do not add them into Sub_Admin_Net, Sub_Sink_Net, or Total_Levies_Net.
- **Plus_Legal_Recovery and Plus_Other_Recovery – DO NOT EXTRACT:** Do not extract or fill these two fields from evidence. Output amount 0 and note "N/A" or leave note empty for both. They appear in the table for structure only; no data is required.
- **(C) TOTAL GST – MANDATORY Phase 2 GST COMPONENT rule set:** You MUST apply. First determine GST registration from GL/TB/Balance Sheet. If NOT registered → GST_Admin = 0, GST_Sink = 0, GST_Special = 0. If registered → GST_Admin = 10% × Sub_Levies_Standard_Admin, GST_Sink = 10% × Sub_Levies_Standard_Sink, GST_Special = 0. Total_GST_Raised = GST_Admin + GST_Sink + GST_Special. GST only on (B1) Standard Levies; no GST on opening, arrears, advance, special levies, interest, recoveries.
- **(D) Total_Gross_Inc** = Total_Levies_Net + Total_GST_Raised (i.e. (D) = (B) + (C)).
- **(E) Effective_Levy_Receipts** = Total_Receipts_Global - Non_Levy_Income. **MANDATORY – Total_Receipts_Global and Non_Levy_Income (Phase 2 TOTAL RECEIPTS):** Total_Receipts_Global from Tier 1 cash-based receipt summary ONLY (Cash Management Report, Trust Account Receipts Report, Cash Receipts Summary, etc.). PROHIBITED: GL alone, TB alone, FS notes. Non_Levy_Income from same source (interest, insurance, cert fees, sundry); if none, 0. Effective_Levy_Receipts = Total_Receipts_Global - Non_Levy_Income. If no Tier 1 → Not Resolved – Boundary Defined.
- **(=) Calc_Closing** = Net_Opening_Bal + Total_Gross_Inc - Effective_Levy_Receipts (i.e. A + D - E).
- **Levy_Variance** = Calc_Closing - BS_Closing (BS_Closing = BS_Arrears - BS_Advance). **MANDATORY – BS_Arrears and BS_Advance (Phase 2 CLOSING LEVY BALANCES):** Source STRICTLY from Current-Year Balance Sheet closing balances ONLY. Use "Current Year" column; NOT "Prior Year". PROHIBITED: Levy Position Reports, Owner Ledgers, GL, FS Notes. If not traceable → Not Resolved – Boundary Defined.

**ASSETS_AND_CASH (PHASE 4 – FULL BALANCE SHEET VERIFICATION – MANDATORY rule enforcement):**
- **SCOPE:** Extract and verify EVERY line item from the FULL Balance Sheet – Owners Equity, Assets, Liabilities. Do NOT limit to assets only.
- **AUDIT PERIOD ANCHOR (global – intake_summary.financial_year):** Use CURRENT YEAR column for all amounts. Prior Year column ONLY for RULE 1 roll-forward.
- **CRITICAL – CURRENT YEAR ONLY:** Do NOT extract from Prior Year column except RULE 1.
- **balance_sheet_verification**: MANDATORY array. You MUST apply Phase 4 rules (R1–R5) strictly per line type.
  - **Cash at Bank, Term Deposits (RULE 2):** supporting_amount MUST come from Bank Statement / Term Deposit Statement (Tier 1) ONLY. Do NOT use GL. If no Tier 1 → status = "MISSING_BANK_STMT"; do NOT fill supporting_amount from GL.
  - **Levy Arrears, Levies in Advance (RULE 3):** supporting_amount from Tier 2 Levy Position Report. If only GL → status = "TIER_3_ONLY".
  - **Accrued/Prepaid/Creditors (RULE 4):** supporting_amount from Tier 2 breakdown report. If only GL → status = "MISSING_BREAKDOWN".
  - **Other (RULE 5):** supporting_amount from GL.
- For each line: { "line_item", "section", "fund", "bs_amount" (FS CURRENT YEAR), "supporting_amount" (from permitted evidence per rules), "evidence_ref" (Doc_ID/Page for traceability), "status", "note" }.
- **NOTE (AI explanation holder – same as Table E.Master):** For every line item, you MUST generate a "note" explaining the source context (e.g., "Bank Statement p.2 as at FY end", "Levy Position Report p.1", "Current Year BS column", "GL Cash reconciled", "Prior Year closing"). Same purpose as Table E.Master Note/Source – human-readable AI explanation. evidence_ref is for Doc_ID/Page; note is for explanation.

**MANDATORY – OLD RATE LEVIES / NEW RATE LEVIES (Phase 2 rules levy_old_new_levies_source, levy_old_new_rate, levy_financial_year):** Source ONLY from minutes. You MUST time-apportion Old Rate Levies and New Rate Levies by the strata plan’s financial year. First, determine the plan’s financial year (start and end dates) from minutes; anchor your search in the section that appears after the title "Audit Execution Report" and near the strata plan name (e.g. scheme name, address, or plan number), and write to intake_summary.financial_year. Use intake_summary.financial_year (or the FY you extracted) for all phases. Use that FY to define quarters. Then split levies between Old Rate and New Rate by the date the new rate was adopted (from minutes). For each quarter (or part-quarter) in the FY, assign levy to Old or New by proportion (e.g. days or months in that quarter at old rate vs new rate). For every Old_Levy_* and New_Levy_* figure, you MUST fill "note" and, if calculated, "computation" explaining: FY used (source: minutes), quarter boundaries, minutes date for rate change, and the proportion applied (e.g. "Q1 100% old; Q2 60% old 40% new; FY from Report header"). source_doc_id and page_ref must cite minutes only.

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
    "financial_year": "String (e.g. 01/07/2024 - 30/06/2025 or DD/MM/YYYY)"
  },
  "levy_reconciliation": {
    "master_table": {
       "Source_Doc_ID": "String",
       "AGM_Date": "String",
       "Op_Arrears": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "Op_Advance": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
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
       "Total_Receipts_Global": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "Non_Levy_Income": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "Effective_Levy_Receipts": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "Calc_Closing": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
       "BS_Arrears": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "BS_Advance": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "BS_Closing": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
       "Levy_Variance": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } }
    },
    "high_risk_debtors": []
  },
  "assets_and_cash": {
    "balance_sheet_verification": [
      { "line_item": "String", "section": "OWNERS_EQUITY|ASSETS|LIABILITIES", "fund": "Admin|Capital|N/A", "bs_amount": Number, "supporting_amount": Number, "evidence_ref": "Doc_ID/Page (traceability)", "status": "VERIFIED|VARIANCE|MISSING_BANK_STMT|TIER_3_ONLY|MISSING_LEVY_REPORT|MISSING_BREAKDOWN|NO_SUPPORT", "note": "AI explanation (same as Table E.Master Note/Source – e.g. Bank Statement p.2 as at FY end, Current Year BS column)" }
    ]
  },
  "expense_samples": [
    {
      "GL_Date": "String",
      "GL_Payee": "String",
      "GL_Amount": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "verbatim_quote": "String" },
      "GL_Fund_Code": "String",
      "Source_Docs": { "GL_ID": "String", "Invoice_ID": "String" },
      "Doc_Status": "FOUND/MISSING",
      "Invoice_Status": "String",
      "Inv_Desc": "String",
      "Class_Result": "String",
      "Manager_Limit": Number,
      "Minute_Ref": "String",
      "Auth_Result": "String",
      "verification_steps": [ { "rule": "String", "status": "PASS/FAIL", "evidence_ref": "String" } ]
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
