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

5. GLOBAL SETTING – SP & FY (content recognition from minutes & financials):
   - Extract **Strata Plan number** (e.g. SP 12345, Strata Plan 12345) from AGM Minutes, Committee Minutes, or Financial Statement. Populate intake_summary.strata_plan.
   - Extract **Financial Year** (FY) from the same documents. Anchor search in the section after "Audit Execution Report" and near the strata plan name. Format as DD/MM/YYYY - DD/MM/YYYY (e.g. 01/07/2024 - 30/06/2025) or DD/MM/YYYY for FY end. Populate intake_summary.financial_year.
   - This FY becomes the **global audit period** for all phases (Revenue, Assets, Expense, Compliance). Phases will use intake_summary.financial_year for time-based logic.
`;
