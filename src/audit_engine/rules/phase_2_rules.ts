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

/** Patch A – MANDATORY column identification by DATE (not by label). Must run before filling Op_* / BS_*. */
export const PHASE_2_COLUMN_DATE_MAP = `
--- MANDATORY – COLUMN IDENTIFICATION BY DATE (DO NOT SKIP) ---
Before filling Op_Arrears, Op_Advance, BS_Arrears, or BS_Advance, you MUST perform this step. Do NOT rely on column labels like "Prior Year" / "Current Year" / "2023" / "2024" alone – map by **reporting date**.

**Step 1 – Derive FY dates from intake_summary.financial_year:**
- Parse intake_summary.financial_year (e.g. "01/07/2024 - 30/06/2025" or "30/06/2025").
- **Current FY end date** = last day of the audit FY (e.g. 30/06/2025).
- **Prior FY end date** = last day of the year before the audit FY (e.g. 30/06/2024).

**Step 2 – Identify the reporting date of EACH Balance Sheet column:**
- From the Financial Statement Balance Sheet, read the column header or footnote for each numeric column (e.g. "As at 30 June 2025", "30 Jun 2024", "2024", "2023").
- Resolve each to a single **reporting date** (the "as at" date for that column).
- If the FS has two columns, you must determine: Column_A_Date = ? ; Column_B_Date = ?.

**Step 3 – Map columns by date (not by left/right or label text):**
- **PriorYearColumn** = the column whose reporting date equals **Prior FY end date** (e.g. 30/06/2024). Use this column ONLY for Op_Arrears and Op_Advance.
- **CurrentYearColumn** = the column whose reporting date equals **Current FY end date** (e.g. 30/06/2025). Use this column ONLY for BS_Arrears and BS_Advance.

**Step 4 – If you cannot map by date:**
- If the BS has only one column, or you cannot determine which column corresponds to prior FY end vs current FY end, do NOT guess.
- Do NOT fill Op_Arrears, Op_Advance, BS_Arrears, BS_Advance from an unmapped column.
- Mark as Not Resolved – Boundary Defined (e.g. in note or completion_outputs.boundary_disclosure).

**Key:** Use **date** to decide which column is Opening (Prior) and which is Closing (Current). Ignore whether the column is left or right; ignore label wording like "This Year" / "Last Year" – only the **as at date** counts.
`;

/** CRITICAL – Column mapping for Opening vs Closing (DO NOT SWAP). Injected before OPENING and CLOSING rule sets. */
export const PHASE_2_LEVY_BALANCE_COLUMN_MAP = `
--- CRITICAL – LEVY BALANCE COLUMN MAPPING (DO NOT SWAP) ---
Apply this mapping **after** you have identified PriorYearColumn and CurrentYearColumn by date (see COLUMN IDENTIFICATION BY DATE above).

**MNEMONIC (记忆辅助):**
- **Op_** = **Op**ening Balance (期初余额) → Prior Year column (上年度列)
- **BS_** = **B**alance **S**heet Closing (期末余额) → Current Year column (本年度列)

**STRICT MAPPING (严格映射 – 绝对不可颠倒):**
1. **Op_Arrears** (Opening Arrears 期初欠费) = Prior Year column ONLY
2. **Op_Advance** (Opening Advance 期初预付) = Prior Year column ONLY
3. **BS_Arrears** (Closing Arrears 期末欠费) = Current Year column ONLY
4. **BS_Advance** (Closing Advance 期末预付) = Current Year column ONLY

**VERIFICATION CHECKPOINT (验证检查点):**
Before outputting, verify:
- Op_Arrears.note MUST mention "Prior Year" or "prior year closing"
- Op_Advance.note MUST mention "Prior Year" or "prior year closing"
- BS_Arrears.note MUST mention "Current Year" or "current year closing"
- BS_Advance.note MUST mention "Current Year" or "current year closing"

**PROHIBITED (严格禁止):**
❌ DO NOT put Prior Year figures into BS_Arrears/BS_Advance
❌ DO NOT put Current Year figures into Op_Arrears/Op_Advance
❌ DO NOT swap Arrears and Advance amounts

**Arrears vs Advance (identify by Dr/Cr):** Levies in Arrears = Debit (Dr) = asset (owners owe scheme). Levies in Advance = Credit (Cr) = liability (scheme owes future service). If a single "Levy Receivable" line shows Cr balance, treat as Advance. Do NOT swap Arrears and Advance amounts.
`;

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

**Acceptable report types (whitelist – use document_register names or equivalent):**
${PHASE_2_RECEIPTS_REPORT_WHITELIST.join("\n• ")}

- Prefer reports whose titles or content explicitly indicate **receipts**, **payments**, **collections**, **contributions**, or **levy received** for the year. If a single report contains both Admin and Capital sections, extract each fund total separately and sum.
- Requirements: Must cover the audit FY; must segregate or be clearly attributable to Admin vs Capital/Sinking Fund.

**Fallback (if Admin & Capital separate fund reports are not available):**
- If evidence contains a **single combined** cash-based receipt summary that segregates Admin and Capital receipts for the FY, extract each fund total separately into **Admin_Fund_Receipts** and **Capital_Fund_Receipts**; then Total_Receipts_Global = sum; Effective_Levy_Receipts = Total_Receipts_Global.

**Prohibited Evidence (HARD STOP):**
- General Ledger alone; Trial Balance alone; Financial Statements or Notes (alone); management summaries without receipt/collection-level backing. If neither (1) Admin & Capital fund-specific receipt summaries from the whitelist nor (2) a single combined Tier 1 cash-based receipt summary exists, mark as Not Resolved – Boundary Defined.
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
  lines.push(PHASE_2_COLUMN_DATE_MAP);
  lines.push("");
  lines.push(PHASE_2_LEVY_BALANCE_COLUMN_MAP);
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
