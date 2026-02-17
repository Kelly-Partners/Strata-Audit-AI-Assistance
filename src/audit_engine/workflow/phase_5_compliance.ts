/**
 * Phase 5 – Statutory Compliance (GST & Tax Logic).
 * Verify Insurance adequacy, GST roll-forward, Income Tax.
 */

export const PHASE_5_COMPLIANCE_PROMPT = `
PHASE 5 – STATUTORY COMPLIANCE
Objective: Verify Insurance adequacy, GST roll-forward, and Income Tax calculations.

**EVIDENCE TIER ENFORCEMENT (20_EVIDENCE – MANDATORY):**
Use only document_register rows where Evidence_Tier matches the required tier for each compliance area.

- **Insurance adequacy** → Tier 1 ONLY. Policy Amount and Valuation Amount MUST be sourced from document_register where Evidence_Tier = Tier 1: Insurance Policy, Certificate of Currency, Insurance Valuation Report. Do NOT use management summaries, GL, or Notes.

- **GST roll-forward** → Tier 1 for BAS lodgement and Bank Statement (GST Paid). Tier 2 for internal GST schedules. Tier 3 only when Tier 1/2 not available (e.g. GST reconciliation from GL). Use document_register Evidence_Tier to select sources.

- **Income Tax** → Tier 1 for ATO lodgement / tax return. Tier 3 for internal tax reconciliation workpapers when plan is N/A or no Tier 1 exists. Use document_register Evidence_Tier to select sources.

**GST Roll-Forward (USE LOCKED intake_summary.registered_for_gst):**
- If intake_summary.registered_for_gst is false or absent → Plan is NOT registered for GST. Output gst_reconciliation with all amounts = 0 and GST_Materiality = "N/A – Plan not registered for GST (per intake_summary.registered_for_gst from Step 0)". Do NOT attempt full GST roll-forward.
- If intake_summary.registered_for_gst is true → Perform full GST roll-forward: Opening + GST Raised - GST Paid + BAS Activity = Closing. Use Total_GST_Raised from levy_reconciliation for consistency with Phase 2.
`;
