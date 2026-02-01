/**
 * Phase 2 – Levy/Revenue 的细化规则（证据来源约束）。
 * Financial Year 与 Old/New Rate（采纳日、比例）仅允许从 minutes 取得，在此定义并注入 prompt。
 */

import type { PhaseItemRule, PhaseRulesMap } from "./types";

/** Phase 2 各 item 的规则定义 */
export const PHASE_2_ITEM_RULES: PhaseRulesMap = {
  levy_financial_year: {
    whitelistDocTypes: ["AGM Minutes (signed)", "Committee Minutes", "AGM Minutes", "Committee Minutes (levy context)"],
    requiredEvidenceTypes: ["minutes"],
    guidance:
      "The strata plan's **financial year** (start and end dates) must be sourced ONLY from minutes (AGM Minutes or Committee Minutes). " +
      "Do not infer FY from Financial Statement, Audit Report body, or other documents. Cite document_register ID and page_ref. " +
      "If the report header (e.g. after 'Audit Execution Report' and strata plan name) explicitly states the FY, that header context may be used only when it is clearly attributable to a minutes-backed period.",
  },
  levy_old_new_rate: {
    whitelistDocTypes: ["AGM Minutes (signed)", "Committee Minutes", "AGM Minutes", "Committee Minutes (levy context)"],
    requiredEvidenceTypes: ["minutes"],
    guidance:
      "**Old rate / New rate** and the **date the new levy rate was adopted** (for quarterly proportion) must be sourced ONLY from minutes (AGM Minutes or Committee Minutes). " +
      "Do not infer rate or adoption date from Financial Statement, Levy Register, or other documents. Cite document_register ID and page_ref. " +
      "Use this adoption date together with the plan's financial year (from levy_financial_year rule) to compute quarterly proportion for Old Rate Levies vs New Rate Levies.",
  },
  levy_old_new_levies_source: {
    whitelistDocTypes: ["AGM Minutes (signed)", "Committee Minutes", "AGM Minutes", "Committee Minutes (levy context)"],
    requiredEvidenceTypes: ["minutes"],
    guidance:
      "**Old Rate Levies** and **New Rate Levies** (master_table: Old_Levy_Admin, Old_Levy_Sink, Old_Levy_Total, New_Levy_Admin, New_Levy_Sink, New_Levy_Total): the **source** for these six fields must be ONLY minutes (AGM Minutes or Committee Minutes). " +
      "Either the amount is extracted directly from minutes, or it is calculated by quarterly proportion using FY and rate adoption date from minutes (see levy_financial_year and levy_old_new_rate). " +
      "In all cases, source_doc_id and page_ref must cite minutes; do not cite Financial Statement, Levy Register, or other documents as the source for Old Rate Levies or New Rate Levies.",
  },
  levy_subtotal_b: {
    guidance:
      "**(B) SUB-TOTAL (NET)** – use explicit formulas only (do not sum 'all lines above'): Sub_Admin_Net = Sub_Levies_Standard_Admin + Spec_Levy_Admin + Plus_Interest_Chgd - Less_Discount_Given ONLY; Sub_Sink_Net = Sub_Levies_Standard_Sink + Spec_Levy_Sink ONLY; Total_Levies_Net = Sub_Admin_Net + Sub_Sink_Net. " +
      "Do not add Plus_Legal_Recovery or Plus_Other_Recovery into (B). **Do not extract** Plus_Legal_Recovery or Plus_Other_Recovery from evidence; output amount 0 and note N/A for both. For (A), (B1), (C), (D), (E), (=), Levy_Variance use the formulas in MODULE 50_OUTPUTS.",
  },
};

/** Phase 2 – OPENING LEVY BALANCES (PRIOR-YEAR CARRY-FORWARD) – Evidence sourcing rule set */
export const PHASE_2_OPENING_LEVY_RULES_PROMPT = `
--- PHASE 2 – OPENING LEVY BALANCES (PRIOR-YEAR CARRY-FORWARD) – MANDATORY ---
RULE SET (ENFORCE): Op_Arrears and Op_Advance MUST be sourced STRICTLY from Prior-Year Balance Sheet closing balances. Non-compliance → Not Resolved – Boundary Defined.

**Applicable Line Items (master_table: Op_Arrears, Op_Advance):**
- Levies in Arrears (Administrative Fund)
- Levies in Arrears (Capital / Sinking Fund)
- Levies Paid in Advance (Administrative Fund)
- Levies Paid in Advance (Capital / Sinking Fund)

**Evidence Requirement (STRICT – Sole Permitted Source):**
- **Prior-Year Balance Sheet** = the Balance Sheet as at the end of the prior FY (last day of FY N-1). Acceptable forms: (a) standalone prior-year Financial Statement, or (b) the "Prior Year" / "Comparative" column on the current-year Financial Statement when it clearly represents audited prior-year closing.
- Validation: balance sheet date MUST agree with intake_summary.financial_year (prior year end). If FY is 01/07/2024–30/06/2025, prior year end = 30/06/2024.
- Balance direction: Levies in Arrears → Debit (Dr); Levies Paid in Advance → Credit (Cr). If a single "Levy Receivable" shows a credit balance, treat as Advance (prepayment).
- Fund segregation: Administrative Fund and Capital/Sinking Fund balances must be validated independently. If prior-year BS shows combined figure only, extract it and allocate per notes; if no breakdown exists, document as single figure and note "no fund breakdown on prior-year BS".

**Prohibited Evidence (HARD STOP – Do NOT use for Op_Arrears/Op_Advance):**
- Levy Position / Arrears Reports
- Owner / Lot Ledgers
- Receipts or Cash Collection Reports
- General Ledger / Trial Balance
- Financial Statement Notes (alone)
If opening balances are not traceable to Prior-Year Balance Sheet, mark as Not Resolved – Boundary Defined.

**Account Name / Terminology Reference (for identification only; evidence remains Prior-Year BS):**
Levies in Arrears: Levy Arrears, Outstanding Levies, Levy Receivable, Owners Contributions Receivable, Unpaid Levies, Contributions Receivable, Levy Debtors, Maintenance/Sinking Fund Arrears.
Levies in Advance: Levy in Advance, Prepaid Levies, Owners Contributions in Advance, Levy Prepayments, Advance Levy Payments.

**Failure Classification:**
- Opening balance ≠ Prior-year closing balance → Evidence Incomplete
- Debit/Credit direction inconsistent → Evidence Incomplete
- Administrative and Capital Funds not separately aligned (when BS has breakdown) → Evidence Incomplete
`;

/** Phase 2 – CLOSING LEVY BALANCES (CURRENT YEAR BALANCE CARRY-FORWARD) – Evidence sourcing rule set */
export const PHASE_2_CLOSING_LEVY_RULES_PROMPT = `
--- PHASE 2 – CLOSING LEVY BALANCES (CURRENT YEAR BALANCE CARRY-FORWARD) – MANDATORY ---
RULE SET (ENFORCE): BS_Arrears and BS_Advance MUST be sourced STRICTLY from Current-Year Balance Sheet closing balances. Non-compliance → Not Resolved – Boundary Defined.

**Applicable Line Items (master_table: BS_Arrears, BS_Advance, BS_Closing):**
- Levies in Arrears (Administrative Fund)
- Levies in Arrears (Capital / Sinking Fund)
- Levies Paid in Advance (Administrative Fund)
- Levies Paid in Advance (Capital / Sinking Fund)

**Evidence Requirement (STRICT – Sole Permitted Source):**
- **Current-Year Balance Sheet** = the Balance Sheet as at the end of the audit FY (last day of FY). Use the "Current Year" / "This Year" column; NOT the "Prior Year" / "Comparative" column.
- Validation: balance sheet date MUST agree with intake_summary.financial_year (current year end).
- Balance direction: Levies in Arrears → Debit (Dr); Levies Paid in Advance → Credit (Cr). If a single "Levy Receivable" shows a credit balance, treat as Advance (prepayment).
- Fund segregation: Administrative Fund and Capital/Sinking Fund balances must be validated independently. If current-year BS shows combined figure only, extract it and allocate per notes; if no breakdown exists, document as single figure and note "no fund breakdown on current-year BS".

**Prohibited Evidence (HARD STOP – Do NOT use for BS_Arrears/BS_Advance):**
- Levy Position / Arrears Reports
- Owner / Lot Ledgers
- Receipts or Cash Collection Reports
- General Ledger / Trial Balance
- Financial Statement Notes (alone)
If closing balances are not traceable to Current-Year Balance Sheet, mark as Not Resolved – Boundary Defined.

**Account Name / Terminology Reference (for identification only; evidence remains Current-Year BS):**
Levies in Arrears: Levy Arrears, Outstanding Levies, Levy Receivable, Owners Contributions Receivable, Unpaid Levies, Contributions Receivable, Levy Debtors, Maintenance/Sinking Fund Arrears.
Levies in Advance: Levy in Advance, Prepaid Levies, Owners Contributions in Advance, Levy Prepayments, Advance Levy Payments.

**Failure Classification:**
- Closing balance ≠ Current-year Balance Sheet closing figure → Evidence Incomplete
- Debit/Credit direction inconsistent → Evidence Incomplete
- Administrative and Capital Funds not separately aligned (when BS has breakdown) → Evidence Incomplete
`;

/** Phase 2 – TOTAL RECEIPTS (GLOBAL) – Evidence sourcing rule set */
export const PHASE_2_TOTAL_RECEIPTS_RULES_PROMPT = `
--- PHASE 2 – TOTAL RECEIPTS (GLOBAL) – MANDATORY ---
RULE SET (ENFORCE): Total_Receipts_Global MUST be sourced from Tier 1 cash-based receipt summary. Non_Levy_Income from same source. Effective_Levy_Receipts = Total_Receipts_Global - Non_Levy_Income. Non-compliance → Not Resolved – Boundary Defined.

**Definition:** Total Receipts (Global) = total cash receipts received during the audit FY in respect of levies, across Administrative Fund and Capital / Sinking Fund.

**Primary Evidence (Tier 1 – REQUIRED):**
- AI MUST source Total_Receipts_Global from a **cash-based receipt summary**, including but not limited to: Cash Management Report, Cash Receipts Summary, Receipt Summary Report, Trust Account Receipts Report, Payments & Receipts Report (Receipts section), Receipts Journal, Bank Deposit Summary. Bank Statement alone is NOT sufficient unless accompanied by allocation worksheet segregating Admin/Capital and Levy/Non-Levy.
- Requirements: Must be cash-based (actual receipts); must cover the audit financial year (intake_summary.financial_year); must include both Admin and Capital / Sinking funds.
- If combined report: Total_Receipts_Global = Admin Receipts + Capital Receipts.

**Levy vs Non-Levy Segregation (MANDATORY):**
- From the same receipt source, identify whether non-levy income exists (e.g. interest, insurance recoveries, certificate fees, sundry income).
- If non-levy exists: Non_Levy_Income = separately identified amount; Effective_Levy_Receipts = Total_Receipts_Global - Non_Levy_Income.
- If no non-levy identified: Non_Levy_Income = 0.00; Effective_Levy_Receipts = Total_Receipts_Global.

**Secondary Evidence (Tier 2 – SUPPORTING ONLY):**
- Levy Receipts Report, Owner Ledger, Levy Ledger, Levy Collection Report, General Ledger (income accounts), Trial Balance may support or explain but MUST NOT replace cash-based receipt totals as the primary source.

**Prohibited Evidence (HARD STOP):**
- General Ledger alone; Trial Balance alone; Financial Statements or Notes; Management summaries without transaction-level backing. If no Tier 1 cash-based receipt summary exists, mark as Not Resolved – Boundary Defined.
`;

/** Phase 2 – GST COMPONENT (STANDARD LEVIES ONLY) – Rule set */
export const PHASE_2_GST_RULES_PROMPT = `
--- PHASE 2 – GST COMPONENT (STANDARD LEVIES ONLY) – MANDATORY ---
RULE SET (ENFORCE): GST is applied only to (B1) STANDARD LEVIES. Administrative Fund and Capital / Sinking Fund calculated separately. You MUST apply this rule set.

**GST Registration Determination (MANDATORY FIRST STEP):**
- The plan's GST registration status MUST be assessed before applying any GST calculation.
- Determine GST registration by checking for GST accounts or indicators in: General Ledger, Trial Balance, or Balance Sheet.
- Indicators include: GST Payable, GST Collected, GST Receivable, GST Clearing, Net GST position disclosed. A GST line with $0 balance still counts as an indicator.
- If no GST indicators exist → treat the plan as NOT registered for GST.

**GST Application Rule:**
- If NOT registered for GST → No GST component on standard levies. GST_Admin = 0, GST_Sink = 0, GST_Special = 0.
- If registered for GST → GST_Admin = 10% × Sub_Levies_Standard_Admin; GST_Sink = 10% × Sub_Levies_Standard_Sink; GST_Special = 0 (no GST on special levies). Total_GST_Raised = GST_Admin + GST_Sink + GST_Special.

**Calculation Constraint – GST only on (B1) STANDARD LEVIES:**
GST must NOT be applied to: Opening balances, Levies in arrears, Levies paid in advance, Special levies, Interest, Recoveries, or Adjustments.

**Evidence Boundary:**
- GST registration status is inferred only from GL / TB / Balance Sheet structure.
- No reliance on: BAS lodgements, ATO records, GST reconciliation worksheets, Financial Statement notes alone. These are out of scope for Phase 2.
`;

/** 将 Phase 2 的 item 规则格式化为注入 system prompt 的文本 */
function formatPhase2RulesPrompt(): string {
  const lines: string[] = [
    "",
    "--- PHASE 2 ITEM RULES (Levy evidence source – minutes only) ---",
    "Apply the following sourcing rules when executing Phase 2 (Revenue/Levy):",
  ];
  for (const [item, rule] of Object.entries(PHASE_2_ITEM_RULES)) {
    lines.push(`- **${item}**: ${rule.guidance ?? ""}`);
    if (rule.whitelistDocTypes && rule.whitelistDocTypes.length > 0) {
      lines.push(`  Whitelist document types: ${rule.whitelistDocTypes.join(", ")}.`);
    }
    if (rule.requiredEvidenceTypes && rule.requiredEvidenceTypes.length > 0) {
      lines.push(`  Required evidence types: ${rule.requiredEvidenceTypes.join(", ")}.`);
    }
  }
  lines.push("");
  lines.push(PHASE_2_OPENING_LEVY_RULES_PROMPT);
  lines.push("");
  lines.push(PHASE_2_CLOSING_LEVY_RULES_PROMPT);
  lines.push("");
  lines.push(PHASE_2_TOTAL_RECEIPTS_RULES_PROMPT);
  lines.push("");
  lines.push(PHASE_2_GST_RULES_PROMPT);
  return lines.join("\n");
}

export const PHASE_2_RULES_PROMPT = formatPhase2RulesPrompt();
