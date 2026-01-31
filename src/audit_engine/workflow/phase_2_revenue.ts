/**
 * Phase 2 – Revenue Cycle (Levy Income).
 * Verify Completeness of Levies and Reconcile with Balance Sheet via Master Table E.
 */

export const PHASE_2_REVENUE_PROMPT = `
PHASE 2 – REVENUE CYCLE (LEVY INCOME)
Objective: Verify Completeness of Levies and Reconcile with Balance Sheet via Master Table E.
1. Locate 'Levies in Arrears' and 'Levies in Advance' in the Balance Sheet.
2. Recompute Total Receipts and compare to Effective Levy Receipts from Bank/GL.
3. For every line item, generate a "note" explaining the source context (e.g., "Prior Year Adjustment", "AGM Motion 3.1", "Calculated").
`;
