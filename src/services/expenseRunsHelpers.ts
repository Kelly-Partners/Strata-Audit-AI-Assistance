/**
 * Helpers for expense_runs (multi-round expense vouching).
 * Build combined view and normalize legacy expense_samples to runs.
 */

import type { ExpenseRun, ExpenseSample, AuditResponse } from "../audit_outputs/type_definitions";

/** Build combined expense_samples from expense_runs. Later runs override earlier for same GL_ID. Preserves initial order for stable merge_key indices. */
export function buildCombinedExpenseSamples(runs: ExpenseRun[]): ExpenseSample[] {
  if (!runs?.length) return [];
  const list: ExpenseSample[] = [];
  const indexByGlId = new Map<string, number>();
  for (let r = 0; r < runs.length; r++) {
    for (const s of runs[r].expense_samples) {
      const key = s.GL_ID ?? `_${r}_${runs[r].expense_samples.indexOf(s)}`;
      const idx = indexByGlId.get(key);
      if (idx !== undefined) {
        list[idx] = s;
      } else {
        indexByGlId.set(key, list.length);
        list.push(s);
      }
    }
  }
  return list;
}

/** Get effective expense_samples from result (expense_runs combined or legacy expense_samples). */
export function getEffectiveExpenseSamples(result: AuditResponse | null): ExpenseSample[] {
  if (!result) return [];
  if (result.expense_runs?.length) {
    return buildCombinedExpenseSamples(result.expense_runs);
  }
  return result.expense_samples ?? [];
}

/** Normalize legacy result to expense_runs format (initial run only). Used when migrating. */
export function ensureExpenseRuns(result: AuditResponse): AuditResponse {
  if (result.expense_runs?.length) return result;
  const samples = result.expense_samples;
  if (!samples?.length) return result;
  return {
    ...result,
    expense_runs: [
      {
        run_id: "initial",
        run_type: "initial",
        created_at: new Date().toISOString(),
        expense_samples: samples,
      },
    ],
  };
}
