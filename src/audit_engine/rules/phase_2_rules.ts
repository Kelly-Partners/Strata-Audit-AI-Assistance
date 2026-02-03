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

/** LOCKED bs_extract – sole source for PriorYear_Arrears, CurrentYear_Arrears, etc. (replaces column mapping). */
export const PHASE_2_BS_EXTRACT_LOOKUP = `
--- LOCKED bs_extract – SOLE SOURCE FOR LEVY BALANCE FIELDS ---
PriorYear_Arrears, PriorYear_Advance, CurrentYear_Arrears, CurrentYear_Advance MUST be looked up from LOCKED Step 0 bs_extract ONLY.

**LOOKUP RULES:**
- **PriorYear_Arrears** = Sum of prior_year from bs_extract.rows where line_item represents Levies in Arrears (Dr/asset). Match by line_item name (e.g. Levy Arrears, Contributions Receivable, Receivable--Levies--Admin, etc.). If BS shows Admin+Capital split, sum both.
- **PriorYear_Advance** = Sum of prior_year from bs_extract.rows where line_item represents Levies in Advance (Cr/liability).
- **CurrentYear_Arrears** = Sum of current_year from same Arrears rows.
- **CurrentYear_Advance** = Sum of current_year from same Advance rows.

**PROHIBITED:** Do NOT use Levy Position Report, Owner Ledger, GL, or any non-bs_extract source for these four fields.

**Arrears vs Advance (identify by Dr/Cr):** Levies in Arrears = Debit (Dr) = asset. Levies in Advance = Credit (Cr) = liability. If bs_extract has a single "Levy Receivable" with Cr, treat as Advance.
`;

/** @deprecated – kept for reference; replaced by PHASE_2_BS_EXTRACT_LOOKUP */
export const PHASE_2_COLUMN_DATE_MAP = "";

/** @deprecated – kept for reference; replaced by PHASE_2_BS_EXTRACT_LOOKUP */
export const PHASE_2_LEVY_BALANCE_COLUMN_MAP = "";

/** Phase 2 – PRIOR YEAR LEVY BALANCES – from LOCKED bs_extract */
export const PHASE_2_OPENING_LEVY_RULES_PROMPT = `
--- PHASE 2 – PRIOR YEAR LEVY BALANCES – MANDATORY (from bs_extract) ---
PriorYear_Arrears and PriorYear_Advance MUST be looked up from LOCKED bs_extract.rows (use prior_year amounts). Sole permitted source. If bs_extract missing or no matching rows → Not Resolved – Boundary Defined.

**Account Name / Terminology Reference (for matching rows in bs_extract):**
Levies in Arrears: Levy Arrears, Outstanding Levies, Levy Receivable, Owners Contributions Receivable, Unpaid Levies, Contributions Receivable, Levy Debtors, Receivable--Levies--Admin, Receivable--Levies--Capital Works.
Levies in Advance: Levy in Advance, Prepaid Levies, Owners Contributions in Advance, Levy Prepayments, Advance Levy Payments.
`;

/** Phase 2 – CURRENT YEAR LEVY BALANCES – from LOCKED bs_extract */
export const PHASE_2_CLOSING_LEVY_RULES_PROMPT = `
--- PHASE 2 – CURRENT YEAR LEVY BALANCES – MANDATORY (from bs_extract) ---
CurrentYear_Arrears and CurrentYear_Advance MUST be looked up from LOCKED bs_extract.rows (use current_year amounts). Sole permitted source. If bs_extract missing or no matching rows → Not Resolved – Boundary Defined.

**Account Name / Terminology Reference (for matching rows in bs_extract):**
Same as Prior Year – Levies in Arrears, Levy Arrears, Receivable--Levies--Admin, etc. Use current_year (not prior_year) for these fields.
`;

/** Preferred report types for Admin / Capital Fund receipt summaries (use first when available). */
export const PHASE_2_RECEIPTS_PREFERRED = ["Cash management report"] as const;

/** Whitelist of report types acceptable for Admin / Capital Fund receipt summaries (Tier 1 – Admin & Capital Actual Payments approach). */
export const PHASE_2_RECEIPTS_REPORT_WHITELIST = [
  "Levy Position Report",
  "Levy Positions",
  "Levy Position Summary",
  "Levy Position by Lot",
  "Levy Position by Owner",
  "Levy Arrears Report",
  "Arrears Report",
  "Arrears by Lot",
  "Aged Levy Arrears",
  "Outstanding Levies Report",
  "Levy Outstanding Report",
  "Owner Ledger",
  "Lot Ledger",
  "Owner Transaction Ledger",
  "Lot Transaction Report",
  "Owner Account Ledger",
  "Lot Account Ledger",
  "Levy Receipts Report",
  "Levy Payments Report",
  "Levy Collections Report",
  "Levy Received Summary",
  "Levy Payments by Lot",
  "Levy Summary Report",
  "Annual Levy Summary",
  "Levy Summary by Fund",
  "Levy Summary by Lot",
  "Levy Summary – Admin / Capital",
  "Admin Fund Levy Position",
  "Capital Works Levy Position",
  "Sinking Fund Levy Report",
  "Fund Ledger – Admin Fund",
  "Fund Ledger – Capital / Sinking Fund",
  "Accounts Receivable – Owners",
  "Owners Receivables Report",
  "Levy Receivable Report",
  "Receivables by Lot",
  "Contribution Ledger",
  "Contribution Report",
  "Owner Contributions",
  "Charges & Contributions Report",
  "Owner Charges Report",
] as const;

/** Phase 2 – TOTAL RECEIPTS (GLOBAL) – Evidence sourcing rule set (Admin & Capital Actual Payments: Admin + Capital fund receipts). */
export const PHASE_2_TOTAL_RECEIPTS_RULES_PROMPT = `
--- PHASE 2 – TOTAL RECEIPTS (GLOBAL) – MANDATORY (ADMIN & CAPITAL ACTUAL PAYMENTS) ---
RULE SET (ENFORCE): Total_Receipts_Global and Effective_Levy_Receipts MUST be sourced by actively finding **two** receipt/payment summaries for the audit FY: (1) **Administrative Fund** receipts for the year, (2) **Capital / Sinking Fund** receipts for the year. Non-compliance → Not Resolved – Boundary Defined.

**Definition:** Output **Admin_Fund_Receipts** and **Capital_Fund_Receipts** as separate TraceableValue fields. Total_Receipts_Global = Admin_Fund_Receipts.amount + Capital_Fund_Receipts.amount. Effective_Levy_Receipts = Total_Receipts_Global. Do NOT output or use Non_Levy_Income.

**Admin & Capital Actual Payments approach (PRIMARY – REQUIRED):**
- **Admin Fund:** Actively search for an **Administrative Fund** receipt or payment summary (or levy/contribution summary) for the audit financial year (intake_summary.financial_year). The report MUST be identifiable as Admin Fund (by title, section, or fund column). Output the total as **Admin_Fund_Receipts** (TraceableValue with source_doc_id, page_ref, note, verbatim_quote).
- **Capital / Sinking Fund:** Actively search for a **Capital / Sinking Fund** receipt or payment summary (or levy/contribution summary) for the same FY. The report MUST be identifiable as Capital or Sinking Fund. Output the total as **Capital_Fund_Receipts** (TraceableValue).
- **Combined:** Total_Receipts_Global = Admin_Fund_Receipts.amount + Capital_Fund_Receipts.amount. Effective_Levy_Receipts = Total_Receipts_Global.

**Preferred report types (use first when available):**
• ${PHASE_2_RECEIPTS_PREFERRED.join("\n• ")}

**Also acceptable report types (whitelist – use document_register names or equivalent):**
• ${PHASE_2_RECEIPTS_REPORT_WHITELIST.join("\n• ")}

- If a single report contains both Admin and Capital sections, extract each fund total separately and sum.
- Requirements: Must cover the audit FY; must segregate or be clearly attributable to Admin vs Capital/Sinking Fund.

**Fallback (if Admin & Capital separate fund reports are not available):**
- If evidence contains a **single combined** cash-based receipt summary that segregates Admin and Capital receipts for the FY, extract each fund total separately into **Admin_Fund_Receipts** and **Capital_Fund_Receipts**; then Total_Receipts_Global = sum; Effective_Levy_Receipts = Total_Receipts_Global.

**Prohibited Evidence (HARD STOP):**
- General Ledger alone; Trial Balance alone; Financial Statements or Notes (alone); management summaries without receipt/collection-level backing. If neither (1) Admin & Capital fund-specific receipt summaries from the preferred list or whitelist nor (2) a single combined Tier 1 cash-based receipt summary exists, mark as Not Resolved – Boundary Defined.
`;

/** Phase 2 – GST COMPONENT (STANDARD LEVIES ONLY) – Rule set */
export const PHASE_2_GST_RULES_PROMPT = `
--- PHASE 2 – GST COMPONENT (STANDARD LEVIES ONLY) – MANDATORY ---
RULE SET (ENFORCE): GST is applied only to (B1) STANDARD LEVIES. Administrative Fund and Capital / Sinking Fund calculated separately. You MUST apply this rule set.

**GST Registration (USE LOCKED intake_summary.registered_for_gst – MANDATORY):**
- The plan's GST registration status is set during Step 0 by scanning the Balance Sheet for GST accounts (e.g. GST Payable, GST Collected, GST Receivable, GST Clearing).
- You MUST use intake_summary.registered_for_gst from the LOCKED context. Do NOT re-determine GST registration from GL/TB/BS.
- If registered_for_gst is false, undefined, or absent → treat as NOT registered for GST.

**GST Application Rule:**
- If NOT registered for GST → No GST component on standard levies. GST_Admin = 0, GST_Sink = 0, GST_Special = 0.
- If registered for GST → GST_Admin = 10% × Sub_Levies_Standard_Admin; GST_Sink = 10% × Sub_Levies_Standard_Sink; GST_Special = 0 (no GST on special levies). Total_GST_Raised = GST_Admin + GST_Sink + GST_Special.

**Calculation Constraint – GST only on (B1) STANDARD LEVIES:**
GST must NOT be applied to: Opening balances, Levies in arrears, Levies paid in advance, Special levies, Interest, Recoveries, or Adjustments.
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
  lines.push(PHASE_2_BS_EXTRACT_LOOKUP);
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
