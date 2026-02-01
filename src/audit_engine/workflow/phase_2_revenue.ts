/**
 * Phase 2 – Revenue Cycle (Levy Income).
 * Verify Completeness of Levies and Reconcile with Balance Sheet via Master Table E.
 */

export const PHASE_2_REVENUE_PROMPT = `
PHASE 2 – REVENUE CYCLE (LEVY INCOME)
Objective: Verify Completeness of Levies and Reconcile with Balance Sheet via Master Table E.
1. **MANDATORY – Opening Balances (Op_Arrears, Op_Advance):** You MUST apply PHASE 2 OPENING LEVY BALANCES rule set. Source STRICTLY from Prior-Year Balance Sheet closing balances ONLY. PROHIBITED: Levy Position Reports, Owner Ledgers, GL, FS Notes. If not traceable → Not Resolved – Boundary Defined.
2. **MANDATORY – Closing Balances (BS_Arrears, BS_Advance):** You MUST apply PHASE 2 CLOSING LEVY BALANCES rule set. Source STRICTLY from Current-Year Balance Sheet closing balances ONLY. PROHIBITED: Levy Position Reports, Owner Ledgers, GL, FS Notes. If not traceable → Not Resolved – Boundary Defined.
3. Locate 'Levies in Arrears' and 'Levies in Advance' in the Balance Sheet (prior-year for opening per OPENING rule set; current-year for closing per CLOSING rule set).
4. **MANDATORY – Total Receipts (Global) & Non-Levy Income:** You MUST apply PHASE 2 TOTAL RECEIPTS (GLOBAL) rule set. Total_Receipts_Global from Tier 1 cash-based receipt summary ONLY (Cash Management Report, Trust Account Receipts Report, Cash Receipts Summary, etc.). PROHIBITED: GL alone, TB alone, FS notes. Non_Levy_Income from same source; if none, 0. Effective_Levy_Receipts = Total_Receipts_Global - Non_Levy_Income. If no Tier 1 receipt summary → Not Resolved – Boundary Defined.
5. Recompute Total Receipts and compare to Effective Levy Receipts from Bank/GL.
6. For every line item, generate a "note" explaining the source context (e.g., "Prior Year BS closing", "Current Year BS closing", "Cash Receipts Summary p.3", "AGM Motion 3.1", "Calculated"). For every CALCULATED figure, fill "computation" (method and expression) and in "note" state the calculation content.

**(B) SUB-TOTAL (NET) – use explicit formulas (see MODULE 50_OUTPUTS):** Sub_Admin_Net = Sub_Levies_Standard_Admin + Spec_Levy_Admin + Plus_Interest_Chgd − Less_Discount_Given ONLY; Sub_Sink_Net = Sub_Levies_Standard_Sink + Spec_Levy_Sink ONLY; Total_Levies_Net = Sub_Admin_Net + Sub_Sink_Net. Do NOT add Plus_Legal_Recovery or Plus_Other_Recovery into (B). **Legal Costs Recovery and Other Recovery – do not extract:** Leave Plus_Legal_Recovery and Plus_Other_Recovery amount as 0 and note as N/A; do not fill from evidence.

**(C) MANDATORY – TOTAL GST (PHASE 2 GST COMPONENT rule set):** You MUST apply. First determine GST registration from GL/TB/Balance Sheet. If not registered → GST_Admin = 0, GST_Sink = 0, GST_Special = 0. If registered → GST_Admin = 10% × Sub_Levies_Standard_Admin, GST_Sink = 10% × Sub_Levies_Standard_Sink, GST_Special = 0. Total_GST_Raised = GST_Admin + GST_Sink + GST_Special. GST only on (B1) Standard Levies. All other calculated fields (A), (B1), (D), (E), (=), Levy_Variance must follow MODULE 50_OUTPUTS.

**MANDATORY – FINANCIAL YEAR ANCHOR (global – use intake_summary.financial_year):** FY is extracted during Step 0 from minutes and financials. Populate intake_summary.strata_plan and intake_summary.financial_year first. Use as global audit period for all Phase 2 logic. If not in intake_summary, determine FY from minutes (section after "Audit Execution Report" + strata plan name) and write to intake_summary.

**MANDATORY – OLD RATE / NEW RATE LEVIES (Phase 2 rules levy_old_new_levies_source, levy_old_new_rate, levy_financial_year):** Source ONLY from minutes. You MUST time-apportion by plan's financial year. Use the FY identified above to define quarters. Identify from minutes the date the new levy rate was adopted. For each quarter (or part-quarter) in the FY, assign levy to Old Rate or New Rate by proportion (e.g. days or months at old rate vs new rate). For every Old_Levy_* and New_Levy_* value, fill "note" and, if calculated, "computation" explaining: FY used (source: minutes), quarter boundaries, minutes date for rate change, and the proportion applied (e.g. "Q1 100% old; Q2 60% old 40% new; FY from Report header").
`;
