/**
 * Step 0 – Document Intake & Document Dictionary.
 * Objective: Establish the single source of truth.
 * Output: document_register (LIST), bs_extract (LOCKED).
 */

export const DOCUMENT_TYPES = [
  "AGM Minutes",
  "Committee Minutes",
  "General Ledger",
  "Financial Statement",
  "Bank Statement",
  "Tax Invoice",
  "Invoice",
  "Levy Position Report",
  "Insurance Policy",
  "Valuation Report",
  "Other",
] as const;

export const STEP_0_INTAKE_PROMPT = `
--- MODULE 10_CORE_WORKFLOW (REWRITE FOR MAX EXECUTION CLARITY) ---

STEP 0 – DOCUMENT INTAKE & DOCUMENT DICTIONARY
Objective: Create deterministic, auditable single source of truth for all later phases.

========================
A) INGEST AND REGISTER
========================

1) Ingest and index all files from the Uploaded File Manifest.

2) Construct document_register as a LIST (array). Each row = one file or one required placeholder.
   Required fields per row: Document_ID, Document_Type, Evidence_Tier, Document_Origin_Name, Document_Name, Page_Range, Relevant_Phases, Notes (optional).
   - Document_Type MUST be exactly one of: AGM Minutes, Committee Minutes, General Ledger, Financial Statement, Bank Statement, Tax Invoice, Invoice, Levy Position Report, Insurance Policy, Valuation Report, Other.
   - Evidence_Tier: Tier 1 (External), Tier 2 (Internal-Authoritative), Tier 3 (Internal-Generated).
   - Document_Origin_Name: Use the exact filename from the Uploaded File Manifest; if placeholder use "" or "N/A".
   - Page_Range: e.g. "All" or "Pages 1-5"; if placeholder use "" or "N/A".

3) Coverage rules (MANDATORY):
   - Every Document_Type MUST appear at least ONE row (even if missing).
   - If multiple files match a type, create one row per file.
   - Minimum rows = number of Document Types (11).

4) Critical record check (MANDATORY):
   - If AGM Minutes OR General Ledger has no file, set intake_summary.missing_critical_types to list the missing types.

========================
B) GLOBAL SETTINGS (SP AND FY)
========================

5) Populate intake_summary:
   - intake_summary.strata_plan: extract SP number from AGM Minutes, Committee Minutes, or Financial Statement.
   - intake_summary.financial_year: extract FY period from the same sources. Use the clearest explicit statement.
     Output format: Prefer "DD/MM/YYYY - DD/MM/YYYY"; else use FY end date "DD/MM/YYYY".
   - Optional: intake_summary.manager_limit from agency agreement or committee minutes; intake_summary.agm_limit from AGM minutes.

6) FY is the global audit period for ALL phases. If FY cannot be determined, set intake_summary.financial_year = "" and intake_summary.boundary_defined = true.

========================
C) CORE DATA POSITIONS (LOCKED LOCATORS)
========================

7) Output core_data_positions (use Document_ID from document_register as doc_id):
   - balance_sheet: doc_id + page_range where the Balance Sheet table is located in the Financial Statement
   - bank_statement: doc_id + page_range for bank statement as at FY end (include as_at_date if visible)
   - levy_report: doc_id + page_range for Levy Position Report or equivalent
   - levy_receipts_admin: doc_id + page_range for Admin fund receipts summary for the FY
   - levy_receipts_capital: doc_id + page_range for Capital or Sinking fund receipts summary for the FY
   - general_ledger: doc_id + page_range for GL
   - minutes_levy: doc_id + page_ref for levy rate adoption (old/new)
   - minutes_auth: doc_id + page_ref for spending authority limits
   If not found, set each key to null.

========================
D) BS EXTRACT (LOCKED SINGLE SOURCE OF TRUTH)
========================

8) **Year column identification (FIRST – use intake_summary.financial_year as FY Global):**
   - **current_year column:** Labels such as "Current year", "Current period", "Current", "This year" → maps to the FY (Global) end date.
   - **prior_year column:** Labels such as "Prior year", "Prior period", "Prior", "Previous year", "Comparative" → maps to the year immediately before FY (Global).
   - Apply the same mapping to main Balance Sheet and any Notes/schedules. Notes MUST NOT override the mapping from the main table.
   - If single-column Balance Sheet: treat as current_year; set prior_year = 0 for all rows and prior_year_label = "".

9) **Balance Sheet extraction:**
   - Scope: Main Balance Sheet table + Notes/schedules that extend BS (e.g. Receivables detail). Output only data rows with numeric amounts; include subtotals if they carry amounts.
   - For each row: extract line_item (exact), section (OWNERS_EQUITY | ASSETS | LIABILITIES), fund (Admin | Capital | Sinking | TOTAL | N/A as shown), prior_year, current_year.
   - Normalize numbers: Convert brackets to negative. Store as signed numbers as presented. Do not flip signs unless the Balance Sheet shows sign conventions.

10) Output bs_extract: { prior_year_label, current_year_label, rows: [...] }. Include every line item (Owners Equity, Assets, Liabilities).

========================
E) REGISTERED FOR GST (GLOBAL SETTING)
========================

11) **GST registration check (MANDATORY – use Balance Sheet only):**
   - Scan bs_extract.rows for GST-related line_item names. Indicators include: "GST Payable", "GST Collected", "GST Receivable", "GST Clearing", "Net GST", "GST Input", "GST Output", or any line_item containing "GST".
   - If at least one such row exists (even with $0 amount) → intake_summary.registered_for_gst = true.
   - If no GST row exists → intake_summary.registered_for_gst = false.
   - This is a global setting used by Phase 2 (Levy GST component) and Phase 5 (GST roll-forward). Phases MUST use this LOCKED value; they must NOT re-determine GST registration.

END STEP 0
`;
