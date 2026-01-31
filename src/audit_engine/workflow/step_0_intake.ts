/**
 * Step 0 – Document Intake & Document Dictionary.
 * Objective: Establish the single source of truth.
 */

export const STEP_0_INTAKE_PROMPT = `
--- MODULE 10_CORE_WORKFLOW (FULL LOGIC) ---

STEP 0 – DOCUMENT INTAKE & DOCUMENT DICTIONARY
Objective: Establish the single source of truth.
1. Ingest & Index all files.
2. Construct Document Dictionary:
   - Document Type MUST be one of: AGM Minutes, Committee Minutes, General Ledger, Financial Statement, Bank Statement, Tax Invoice, Invoice, Levy Position Report, Insurance Policy, Valuation Report, Other.
   - Evidence Tier: Tier 1 (External), Tier 2 (Internal-Authoritative), Tier 3 (Internal-Generated).
   - Document Origin Name: Use the exact filename provided in the Uploaded File Manifest.
   - Page Range: Identify the specific pages within the file relevant to the audit (e.g., "All" or "Pages 1-5").
3. If AGM Minutes or General Ledger is missing, FLAG as MISSING CRITICAL RECORD.
`;
