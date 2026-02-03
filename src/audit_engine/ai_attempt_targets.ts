/**
 * AI Attempt – build target list from System Identified + Triage.
 * Only these items will be re-verified when user runs AI Attempt.
 */

import type { AuditResponse, TriageItem } from "../audit_outputs/type_definitions";

export interface AiAttemptTarget {
  phase: "levy" | "phase4" | "expenses" | "compliance";
  itemId: string;
  description: string;
  source: "system" | "triage";
}

const TAB_TO_PHASE: Record<string, AiAttemptTarget["phase"]> = {
  levy: "levy",
  assets: "phase4",
  expense: "expenses",
  gstCompliance: "compliance",
};

/** Derive targets from audit result (unreconciled, unverified) and user triage */
export function buildAiAttemptTargets(
  result: AuditResponse | null | undefined,
  triage: TriageItem[] = []
): AiAttemptTarget[] {
  const targets: AiAttemptTarget[] = [];
  if (!result) return targets;

  // System Identified: Levy variance (only when chain exists and amount !== 0)
  const levyVar = result.levy_reconciliation?.master_table?.Levy_Variance?.amount;
  if (levyVar != null && levyVar !== 0) {
    targets.push({
      phase: "levy",
      itemId: "levy_variance",
      description: `Levy Variance: $${levyVar.toLocaleString()}`,
      source: "system",
    });
  }

  // System Identified: Expense FAIL / RISK_FLAG
  (result.expense_samples || []).forEach((exp, i) => {
    if (exp.Overall_Status === "FAIL" || exp.Overall_Status === "RISK_FLAG") {
      targets.push({
        phase: "expenses",
        itemId: `exp_${i}`,
        description: `${exp.GL_Payee} ($${exp.GL_Amount?.amount}) – ${exp.GL_Date}`,
        source: "system",
      });
    }
  });

  // System Identified: BS non-VERIFIED
  (result.assets_and_cash?.balance_sheet_verification || []).forEach((bs) => {
    if (bs.status && bs.status !== "VERIFIED") {
      const key = `${(bs.line_item || "").replace(/\s+/g, "_")}|${bs.fund || "N/A"}`;
      targets.push({
        phase: "phase4",
        itemId: key,
        description: `${bs.line_item} – ${bs.status}`,
        source: "system",
      });
    }
  });

  // System Identified: GST variance
  if (result.statutory_compliance?.gst_reconciliation?.GST_Rec_Variance?.amount !== 0) {
    targets.push({
      phase: "compliance",
      itemId: "gst_variance",
      description: `GST Variance: $${result.statutory_compliance.gst_reconciliation.GST_Rec_Variance.amount?.toLocaleString()}`,
      source: "system",
    });
  }

  // Triage: user-flagged items (avoid duplicates with system)
  const systemIds = new Set(targets.map((t) => `${t.phase}:${t.itemId}`));
  triage.forEach((t) => {
    const phase = TAB_TO_PHASE[t.tab] ?? null;
    if (!phase) return;
    const itemId = t.rowId.includes("-") ? t.rowId.substring(t.rowId.indexOf("-") + 1) : t.rowId;
    const key = `${phase}:${itemId}`;
    if (systemIds.has(key)) return;
    systemIds.add(key);
    targets.push({
      phase,
      itemId,
      description: `${t.title} – ${t.comment || "User flagged"}`,
      source: "triage",
    });
  });

  return targets;
}
