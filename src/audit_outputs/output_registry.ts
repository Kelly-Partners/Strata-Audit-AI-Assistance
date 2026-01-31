/**
 * MODULE 50_OUTPUTS – Master JSON structure definition for the Audit Kernel.
 * Injected into the system prompt so the LLM returns strictly conforming JSON.
 */

export const MODULE_50_OUTPUTS_PROMPT = `
--- MODULE 50_OUTPUTS (JSON STRUCTURE) ---
You must strictly return a single JSON object matching the schema below.
Ensure "document_register" and "intake_summary" are fully populated based on the uploaded files.

**CRITICAL INSTRUCTION FOR TRACEABILITY:**
1. "verbatim_quote": For every extracted figure, you MUST provide the exact text substring from the PDF where this figure was found.
2. "computation": For every CALCULATED figure, you MUST provide the formula logic.
3. "verification_steps": For expenses, provide the step-by-step adjudication logic.

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
    "status": "String"
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
    "bank_reconciliation": {
      "Source_Doc_ID": "String",
      "Bank_Stmt_Balance": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
      "Bank_Stmt_Date": "String",
      "Outstanding_Deposits": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
      "Unpresented_Cheques": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
      "Adjusted_Bank_Bal": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } },
      "GL_Bank_Balance": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
      "Bank_Rec_Variance": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "computation": { "method": "String", "expression": "String" } }
    },
    "fund_integrity": {
      "Source_Doc_ID": "String",
      "Admin_Fund_Bal": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
      "Admin_Solvency_Status": "String",
      "Admin_Action": "String",
      "Cap_Works_Bal": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
      "Cap_Integrity_Status": "String",
      "Cap_Action": "String",
      "TFN_Check_Source_ID": "String",
      "TFN_Tax_Amt": { "amount": Number, "source_doc_id": "String", "page_ref": "String", "note": "String", "verbatim_quote": "String" },
      "TFN_Status": "String",
      "TFN_Action": "String"
    },
    "investments": []
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
