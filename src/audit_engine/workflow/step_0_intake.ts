/**
 * Step 0 – Document Intake & Document Dictionary.
 * Objective: Establish the single source of truth.
 * Output: document_register as a LIST; each Document Type must appear at least one row (even if empty).
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
--- MODULE 10_CORE_WORKFLOW (FULL LOGIC) ---

STEP 0 – DOCUMENT INTAKE & DOCUMENT DICTIONARY
Objective: Establish the single source of truth.

1. Ingest & Index all files.

2. Construct Document Dictionary as a LIST. Each row = one entry (one Type slot or one recognized file).
   - Document Type MUST be exactly one of: AGM Minutes, Committee Minutes, General Ledger, Financial Statement, Bank Statement, Tax Invoice, Invoice, Levy Position Report, Insurance Policy, Valuation Report, Other.
   - Evidence Tier: Tier 1 (External), Tier 2 (Internal-Authoritative), Tier 3 (Internal-Generated).
   - Document Origin Name: Use the exact filename from the Uploaded File Manifest for that row; if the Type has no file, use "" or "N/A".
   - Page Range: Identify the specific pages within the file relevant to the audit (e.g., "All" or "Pages 1-5"); if no file, use "" or "N/A".

3. CRITICAL – LIST FORM & COVERAGE:
   - Output document_register as a list/array. Each Type and each recognized file MUST occupy its own row.
   - EVERY Document Type above MUST appear at least ONE row in document_register. If a Type has no uploaded file, still output one row for that Type with Document_Type set to that type, Document_Origin_Name "" or "N/A", and other fields as appropriate for "no file".
   - If a Type has multiple files, output one row per file (so multiple rows for that Type).
   - Minimum: one row per Type (11 types = at least 11 rows). More rows when multiple files exist for a Type.

4. If AGM Minutes or General Ledger has no file (empty row), FLAG as MISSING CRITICAL RECORD in intake_summary.

5. GLOBAL SETTING – SP, FY, MANAGER LIMIT & AGM LIMIT (content recognition from minutes & financials):
   - Extract **Strata Plan number** (e.g. SP 12345, Strata Plan 12345) from AGM Minutes, Committee Minutes, or Financial Statement. Populate intake_summary.strata_plan.
   - Extract **Financial Year** (FY) from the same documents. Anchor search in the section after "Audit Execution Report" and near the strata plan name. Format as DD/MM/YYYY - DD/MM/YYYY (e.g. 01/07/2024 - 30/06/2025) or DD/MM/YYYY for FY end. Populate intake_summary.financial_year.
   - Extract **Manager spending limit** (single transaction, in dollars) from Strata Agency Agreement or Committee Minutes (e.g. Manager may approve up to $5,000). Populate intake_summary.manager_limit if found; else omit.
   - Extract **AGM-approved limit** (amount above which General Meeting approval is required, in dollars) from AGM Minutes (e.g. Committee up to $20,000, above that AGM). Populate intake_summary.agm_limit if found; else omit.
   - This FY becomes the **global audit period** for all phases (Revenue, Assets, Expense, Compliance). Phases will use intake_summary.financial_year and intake_summary.manager_limit / agm_limit for expense authority tiering.

6. CORE DATA POSITIONS (MANDATORY for Step 0 – lock locations for Phase 2/4/3):
   - **balance_sheet**: Locate the Balance Sheet (within Financial Statement). Output doc_id (from document_register) and page_range (e.g. "Pages 5-7"). If FS has no distinct BS section, use the page(s) where BS appears.
   - **bank_statement**: Which doc + page_range contains Bank Statement as at FY end? Include as_at_date if visible.
   - **levy_report**: Which doc + page_range contains Levy Position Report or equivalent (Tier 2)?
   - **levy_receipts_admin** / **levy_receipts_capital**: Which doc(s) + page_range contain Admin Fund and Capital Fund receipt summaries for the FY? (For Admin & Capital Actual Payments.)
   - **general_ledger**: Which doc + page_range contains the GL?
   - **minutes_levy** / **minutes_auth**: Which doc + page_ref has levy rate adoption (Old/New) and manager authorization limits?
   - If a doc type is not found, set that key to null.

7. BS EXTRACT – FULL BALANCE SHEET (MANDATORY – single source of truth for Phase 2/4/5):
   - **Export the Balance Sheet in full** including Prior Year and Current Year columns. This is the ONLY permitted source for BS-derived data in Phase 2, Phase 4, and Phase 5.
   - Scan all Balance Sheet pages (main BS + any Notes/schedules that break down BS line items, e.g. Receivables detail). For each row that carries a numeric amount:
     • line_item: exact name from FS
     • section: OWNERS_EQUITY | ASSETS | LIABILITIES
     • fund: Admin | Capital | Sinking | TOTAL | N/A as shown
     • prior_year: amount from Prior Year column
     • current_year: amount from Current Year column
   - Identify Prior Year and Current Year columns by reporting date (use intake_summary.financial_year). Prior = column with date = Prior FY end; Current = column with date = Current FY end.
   - **Receivable / Levy rows (Levies in Arrears, Levies in Advance, Receivable--*):** If Current Year column is blank/empty ("–", "-", or no amount), record current_year = 0. Do NOT fill current_year from prior_year. This prevents wrong-column substitution.
   - Output bs_extract: { prior_year_label, current_year_label, rows: [...] }. Include EVERY line item (Owners Equity, Assets, Liabilities). If single-column BS, use that column for current_year and set prior_year = 0 or omit row.
`;
