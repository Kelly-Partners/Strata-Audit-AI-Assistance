/**
 * AI Attempt – build target list from System Identified + Triage.
 * System Triage – auto-populate from Phase 2-5 non-reconciled items.
 */

import type { AuditResponse, TriageItem } from "../audit_outputs/type_definitions";
import { getEffectiveExpenseSamples } from "../services/expenseRunsHelpers";

/** Tab IDs for Triage/AI Attempt – maps to area display names. Order: Balance Sheet, Levy Rec, GST & Compliance, Expenses */
export const AREA_ORDER: readonly string[] = ["assets", "levy", "gstCompliance", "expense"];
export const AREA_DISPLAY: Record<string, string> = {
  assets: "Balance Sheet",
  levy: "Levy Rec",
  gstCompliance: "GST & Compliance",
  expense: "Expense Vouching",
};

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

  // System Identified: Expense FAIL / RISK_FLAG (use effective samples for expense_runs compat)
  getEffectiveExpenseSamples(result).forEach((exp, i) => {
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

/** Map status/type to triage severity */
function severityForItem(phase: string, statusOrType: string): "low" | "medium" | "critical" {
  if (phase === "levy" || phase === "compliance") return "critical";
  if (phase === "phase4") {
    if (statusOrType === "MISSING_BANK_STMT" || statusOrType === "NO_SUPPORT") return "critical";
    return "medium";
  }
  if (phase === "expenses") return statusOrType === "FAIL" ? "critical" : "medium";
  return "medium";
}

/** Build TriageItems from Phase 2-5 non-reconciled result – for auto-populate */
export function buildSystemTriageItems(result: AuditResponse | null | undefined): TriageItem[] {
  const items: TriageItem[] = [];
  if (!result) return items;
  const now = Date.now();

  const levyVar = result.levy_reconciliation?.master_table?.Levy_Variance?.amount;
  if (levyVar != null && levyVar !== 0) {
    items.push({
      id: `sys-levy-${now}`,
      rowId: "levy-levy_variance",
      tab: "levy",
      title: `Levy Variance: $${levyVar.toLocaleString()}`,
      comment: "Calc_Closing vs CurrentYear_Net mismatch",
      severity: "critical",
      timestamp: now,
      source: "system",
    });
  }

  getEffectiveExpenseSamples(result).forEach((exp, i) => {
    if (exp.Overall_Status === "FAIL" || exp.Overall_Status === "RISK_FLAG") {
      items.push({
        id: `sys-exp-${i}-${now}`,
        rowId: `expense-exp_${i}`,
        tab: "expense",
        title: `${exp.GL_Payee} ($${exp.GL_Amount?.amount ?? 0}) – ${exp.GL_Date}`,
        comment: exp.Overall_Status,
        severity: severityForItem("expenses", exp.Overall_Status),
        timestamp: now,
        source: "system",
      });
    }
  });

  (result.assets_and_cash?.balance_sheet_verification || []).forEach((bs) => {
    if (bs.status && bs.status !== "VERIFIED") {
      const key = `${(bs.line_item || "").replace(/\s+/g, "_")}|${bs.fund || "N/A"}`;
      items.push({
        id: `sys-bs-${key}-${now}`,
        rowId: `assets-${key}`,
        tab: "assets",
        title: `${bs.line_item} – ${bs.status}`,
        comment: bs.supporting_note || bs.note || bs.status,
        severity: severityForItem("phase4", bs.status),
        timestamp: now,
        source: "system",
      });
    }
  });

  const gstVar = result.statutory_compliance?.gst_reconciliation?.GST_Rec_Variance?.amount;
  if (gstVar != null && gstVar !== 0) {
    items.push({
      id: `sys-gst-${now}`,
      rowId: "gstCompliance-gst_variance",
      tab: "gstCompliance",
      title: `GST Variance: $${gstVar.toLocaleString()}`,
      comment: "GST roll-forward variance",
      severity: "critical",
      timestamp: now,
      source: "system",
    });
  }

  return items;
}

/** Build itemKey for UserOverride – must match TriageItem rowId/tab */
export function itemKeyForOverride(phase: string, itemId: string): string {
  const tabMap: Record<string, string> = { levy: "levy", phase4: "assets", expenses: "expense", compliance: "gstCompliance" };
  const tab = tabMap[phase] ?? phase;
  return `${tab}:${itemId}`;
}

/** Merge system triage with existing; remove items now reconciled; avoid duplicates */
export function mergeTriageWithSystem(
  existing: TriageItem[],
  systemItems: TriageItem[],
  result: AuditResponse | null | undefined
): TriageItem[] {
  const reconciledKeys = new Set<string>();
  if (result) {
    const levyVar = result.levy_reconciliation?.master_table?.Levy_Variance?.amount;
    if (levyVar == null || levyVar === 0) reconciledKeys.add("levy:levy_variance");
    getEffectiveExpenseSamples(result).forEach((exp, i) => {
      if (exp.Overall_Status !== "FAIL" && exp.Overall_Status !== "RISK_FLAG") reconciledKeys.add(`expense:exp_${i}`);
    });
    (result.assets_and_cash?.balance_sheet_verification || []).forEach((bs) => {
      if (bs.status === "VERIFIED") {
        const key = `${(bs.line_item || "").replace(/\s+/g, "_")}|${bs.fund || "N/A"}`;
        reconciledKeys.add(`assets:${key}`);
      }
    });
    const gstVar = result.statutory_compliance?.gst_reconciliation?.GST_Rec_Variance?.amount;
    if (gstVar == null || gstVar === 0) reconciledKeys.add("gstCompliance:gst_variance");
  }

  const existingByKey = new Map<string, TriageItem>();
  existing.forEach((t) => {
    const phase = TAB_TO_PHASE[t.tab];
    const itemId = t.rowId.includes("-") ? t.rowId.substring(t.rowId.indexOf("-") + 1) : t.rowId;
    const key = phase ? `${t.tab}:${itemId}` : `${t.tab}:${t.rowId}`;
    existingByKey.set(key, t);
  });

  const out: TriageItem[] = [];
  existing.forEach((t) => {
    const phase = TAB_TO_PHASE[t.tab];
    const itemId = t.rowId.includes("-") ? t.rowId.substring(t.rowId.indexOf("-") + 1) : t.rowId;
    const key = phase ? `${t.tab}:${itemId}` : `${t.tab}:${t.rowId}`;
    if (reconciledKeys.has(key)) return;
    out.push(t);
  });

  systemItems.forEach((s) => {
    const itemId = s.rowId.includes("-") ? s.rowId.substring(s.rowId.indexOf("-") + 1) : s.rowId;
    const key = `${s.tab}:${itemId}`;
    if (existingByKey.has(key) || reconciledKeys.has(key)) return;
    out.push(s);
    existingByKey.set(key, s);
  });

  return out;
}
