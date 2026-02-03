/**
 * Phase 5 – Statutory Compliance (GST & Tax Logic).
 * Verify Insurance adequacy, GST roll-forward, Income Tax.
 */

export const PHASE_5_COMPLIANCE_PROMPT = `
PHASE 5 – STATUTORY COMPLIANCE
Objective: Verify Insurance adequacy, GST roll-forward, and Income Tax calculations.

**GST Roll-Forward (USE LOCKED intake_summary.registered_for_gst):**
- If intake_summary.registered_for_gst is false or absent → Plan is NOT registered for GST. Output gst_reconciliation with all amounts = 0 and GST_Materiality = "N/A – Plan not registered for GST (per intake_summary.registered_for_gst from Step 0)". Do NOT attempt full GST roll-forward.
- If intake_summary.registered_for_gst is true → Perform full GST roll-forward: Opening + GST Raised - GST Paid + BAS Activity = Closing. Use Total_GST_Raised from levy_reconciliation for consistency with Phase 2.
`;
