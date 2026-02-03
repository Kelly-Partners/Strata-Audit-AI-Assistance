/**
 * Phase 2 – Revenue Cycle (Levy Income).
 * Verify Completeness of Levies and Reconcile with Balance Sheet via Master Table E.
 */

export const PHASE_2_REVENUE_PROMPT = `
PHASE 2 – REVENUE CYCLE (LEVY INCOME)
Objective: Verify Completeness of Levies and Reconcile with Balance Sheet via Master Table E.

**LOCKED BS_EXTRACT – SOLE SOURCE FOR BALANCE SHEET DATA (MANDATORY):**
PriorYear_Arrears, PriorYear_Advance, CurrentYear_Arrears, CurrentYear_Advance MUST be looked up from LOCKED Step 0 bs_extract ONLY. Do NOT re-read the Balance Sheet PDF or use Levy Reports, GL, or any other source for these four fields.

1. **PriorYear_Arrears, PriorYear_Advance:** Find rows in bs_extract.rows that represent Levies in Arrears (Dr/asset) and Levies in Advance (Cr/liability). Sum prior_year amounts as needed. Use core_data_positions.balance_sheet for source_doc_id and page_ref.
2. **CurrentYear_Arrears, CurrentYear_Advance:** Same rows – use current_year amounts. Do NOT swap Prior/Current.
3. If bs_extract is missing or has no matching rows → Not Resolved – Boundary Defined.
4. **MANDATORY – Total Receipts – Admin & Capital Actual Payments (PRIMARY, REQUIRED):** You MUST use the Admin & Capital Actual Payments method. Source ONLY from document_register rows where Evidence_Tier = **Tier 2** (Cash Management Report, Levy Position Report, Levy Receipts Report, Levy Arrears Report, Levy Summary Report). Tier 3 (GL, FS, Notes, Other) is PROHIBITED. Actively find (1) Administrative Fund receipt/payment summary for the audit FY and (2) Capital/Sinking Fund receipt/payment summary for the audit FY, prefer **Cash Management Report** when available; otherwise from the whitelist. Output **Admin_Fund_Receipts** and **Capital_Fund_Receipts** as separate TraceableValue fields (each with amount, source_doc_id, page_ref, note, verbatim_quote). Total_Receipts_Global = Admin_Fund_Receipts.amount + Capital_Fund_Receipts.amount; Effective_Levy_Receipts = Total_Receipts_Global. Do NOT output Non_Levy_Income. If a single combined receipt summary segregates Admin and Capital, extract each fund total into Admin_Fund_Receipts and Capital_Fund_Receipts. If only Tier 3 evidence exists or neither Admin & Capital fund-specific reports nor a combined summary with fund segregation is available → Not Resolved – Boundary Defined.
5. Effective_Levy_Receipts MUST come from Tier 2 sources only (Admin_Fund_Receipts + Capital_Fund_Receipts). You may cross-check against Bank Statement (Tier 1) if available; do NOT use GL as source for Effective_Levy_Receipts.
6. For every line item, generate a "note" explaining the source context (e.g., "Prior Year BS closing", "Current Year BS closing", "Cash Receipts Summary p.3", "AGM Motion 3.1", "Calculated"). For every CALCULATED figure, fill "computation" (method and expression) and in "note" state the calculation content.

**(B) SUB-TOTAL (NET) – use explicit formulas (see MODULE 50_OUTPUTS):** Sub_Admin_Net = Sub_Levies_Standard_Admin + Spec_Levy_Admin + Plus_Interest_Chgd − Less_Discount_Given ONLY; Sub_Sink_Net = Sub_Levies_Standard_Sink + Spec_Levy_Sink ONLY; Total_Levies_Net = Sub_Admin_Net + Sub_Sink_Net. Do NOT add Plus_Legal_Recovery or Plus_Other_Recovery into (B). **Legal Costs Recovery and Other Recovery – do not extract:** Leave Plus_Legal_Recovery and Plus_Other_Recovery amount as 0 and note as N/A; do not fill from evidence.

**(C) MANDATORY – TOTAL GST (PHASE 2 GST COMPONENT rule set):** Use intake_summary.registered_for_gst (LOCKED from Step 0). If not registered → GST_Admin = 0, GST_Sink = 0, GST_Special = 0. If registered → GST_Admin = 10% × Sub_Levies_Standard_Admin, GST_Sink = 10% × Sub_Levies_Standard_Sink, GST_Special = 0. Total_GST_Raised = GST_Admin + GST_Sink + GST_Special. GST only on (B1) Standard Levies. Do NOT re-determine GST registration. All other calculated fields (A), (B1), (D), (E), (=), Levy_Variance must follow MODULE 50_OUTPUTS.

**MANDATORY – FINANCIAL YEAR ANCHOR (global – use intake_summary.financial_year):** FY is extracted during Step 0 from minutes and financials. Use intake_summary.financial_year as global audit period for all Phase 2 logic. If empty or boundary_defined → Not Resolved – Boundary Defined. In Call 2 mode, do NOT overwrite intake_summary; use the LOCKED value.

**MANDATORY – OLD RATE / NEW RATE LEVIES (Phase 2 rules levy_old_new_levies_source, levy_old_new_rate, levy_financial_year):** Source ONLY from minutes. You MUST time-apportion by plan's financial year. Use the FY identified above to define quarters. Identify from minutes the date the new levy rate was adopted. For each quarter (or part-quarter) in the FY, assign levy to Old Rate or New Rate by proportion (e.g. days or months at old rate vs new rate). For every Old_Levy_* and New_Levy_* value, fill "note" and, if calculated, "computation" explaining: FY used (source: minutes), quarter boundaries, minutes date for rate change, and the proportion applied (e.g. "Q1 100% old; Q2 60% old 40% new; FY from Report header").

**FINAL VERIFICATION BEFORE OUTPUT:**
Before returning the JSON, perform these checks:
1. PriorYear_Arrears and PriorYear_Advance: Verify looked up from bs_extract (prior_year amounts).
2. CurrentYear_Arrears and CurrentYear_Advance: Verify looked up from bs_extract (current_year amounts).
3. Do NOT use any source other than bs_extract for these four fields.
4. Arrears amounts = positive (Debit/Asset); Advance amounts = positive but subtracted in Net (Credit/Liability).
If any check fails, correct before output.
`;
