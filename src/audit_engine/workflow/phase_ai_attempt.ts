/**
 * AI Attempt – targeted re-verification & resolution.
 * Targets: System-identified (variances, FAIL, non-VERIFIED) + Watchlist (user-flagged).
 * New evidence ([ADDITIONAL] files) may have been uploaded.
 */

export const PHASE_AI_ATTEMPT_PROMPT = `
AI ATTEMPT – TARGETED RE-VERIFICATION & RESOLUTION

Objective: Re-verify and resolve ONLY the items in the TARGET LIST. Do NOT re-process the entire audit.

========================
TARGET SOURCES
========================
- **System Identified:** Unreconciled (levy variance), unverified (BS status ≠ VERIFIED), FAIL/RISK_FLAG (expense), GST variance.
- **Watchlist (Triage):** User-flagged items from the report. Treat with same resolution discipline.

Both receive AI Attempt Resolution. Use [ADDITIONAL] files when present as new evidence.

========================
RESOLUTION PROTOCOL (per target)
========================

1. **Triage (if variance is quantifiable):**
   - If |variance| < $1.00 and the issue is a material mismatch → document in note: "Nominal variance (below $1 threshold). Classified as rounding." and update status/amount accordingly.
   - Otherwise → proceed to structured re-verification.

2. **Structured Re-Verification – per phase:**

   **Levy:** Trace PriorYear_Arrears/Advance, CurrentYear_Arrears/Advance from bs_extract; Admin_Fund_Receipts, Capital_Fund_Receipts from evidence. Reconcile components. If variance remains, state in note what was checked and why unresolved.

   **BS (phase4):** Per Phase 4 rules R2–R5. Trace supporting evidence (Bank Stmt, Levy Report, breakdown, GL). If evidence found → VERIFIED; if missing → keep MISSING_* status, set supporting_note to state what is needed. Do NOT use bs_extract for supporting_amount (except RULE 1).

   **Expense:** Re-check Three-Way Match (invoice, payment, authority) and Fund Integrity. Use [ADDITIONAL] files. Update Overall_Status (PASS/FAIL/RISK_FLAG) and evidence fields. Document in note what was re-checked.

   **Compliance:** Use intake_summary.registered_for_gst (LOCKED). If false → GST reconciliation is N/A; do not attempt GST re-verification. If true → Re-check GST components. Always re-check Insurance adequacy and Income Tax. Document findings in notes.

3. **Outcome:** Use existing status/Overall_Status. Document in note/supporting_note: what was checked, evidence used, and resolution (explained vs unresolved).

========================
RULES
========================
- Process ONLY items in the target list. Do not change items not in the list.
- Return ONLY the ai_attempt_updates structure. Preserve structure of unchanged items when merging.
- Levy targets → return full levy_reconciliation. Expense → merge_key (exp_N). BS → line_item+fund for merge. Compliance → updated section.
`;
