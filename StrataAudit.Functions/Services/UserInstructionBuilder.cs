using System.Text.Json;

namespace StrataAudit.Functions.Services;

/// <summary>
/// Builds the user instruction text based on mode, file manifest, and previous audit state.
/// Ported from functions/geminiReview.js — includes Evidence Tier enforcement per phase.
/// </summary>
public sealed class UserInstructionBuilder
{
    private static readonly Dictionary<string, string> Call2PhaseLabels = new()
    {
        ["levy"] = "Phase 2 (Levy Reconciliation)",
        ["phase4"] = "Phase 4 (Balance Sheet Verification)",
        ["expenses"] = "Phase 3 (Expenses Vouching)",
        ["expenses_additional"] = "Phase 3 Additional Run (Supplement Evidence)",
        ["compliance"] = "Phase 5 (Statutory Compliance)",
        ["aiAttempt"] = "AI Attempt (Targeted Re-verification)",
    };

    private static readonly Dictionary<string, string> Call2ReturnKeys = new()
    {
        ["levy"] = "\"levy_reconciliation\"",
        ["phase4"] = "\"assets_and_cash\"",
        ["expenses"] = "\"expense_samples\"",
        ["expenses_additional"] = "\"document_register\" and \"expense_samples_additional\"",
        ["compliance"] = "\"statutory_compliance\"",
        ["aiAttempt"] = "\"ai_attempt_updates\" and \"ai_attempt_resolution_table\"",
    };

    /// <summary>
    /// Evidence Tier enforcement instructions per phase.
    /// These constrain which tier of evidence the AI may cite for specific line items.
    /// </summary>
    private static readonly Dictionary<string, string> EvidenceTierInstructions = new()
    {
        ["levy"] = """
EVIDENCE TIER ENFORCEMENT:
- Admin_Fund_Receipts and Capital_Fund_Receipts = Tier 2 ONLY (Cash Management Report, Levy Position Report, Levy Receipts Report, Levy Arrears Report, Levy Summary Report).
- PriorYear_Arrears, PriorYear_Advance, CurrentYear_Arrears, CurrentYear_Advance = bs_extract ONLY.
- Do NOT use GL as source for Effective_Levy_Receipts.
- Tier 3 (GL, FS, Notes, Other) is PROHIBITED for receipts amounts.
""",
        ["phase4"] = """
EVIDENCE TIER ENFORCEMENT:
- supporting_amount per Evidence Tier: R2=Tier 1 (Bank Statement, Term Deposit Certificate), R3/4=Tier 2 (Levy Report, Creditors Report), R5=Tier 3 (GL).
- NO ELEVATION: Bank reconciliation (Tier 2) does NOT substitute for Bank Statement (Tier 1) for Cash at Bank.
- BLACKLIST: Financial Statement, Notes, GL when Tier 1/2 is required.
""",
        ["expenses"] = """
EVIDENCE TIER ENFORCEMENT:
- Invoice validity = Tier 1 ONLY (source document).
- Payment PAID = Tier 1 ONLY (Bank Statement).
- Payment ACCRUED = Tier 2 ONLY (Creditors Report).
- Do NOT substitute lower-tier evidence when higher tier is required.
""",
        ["expenses_additional"] = """
EVIDENCE TIER ENFORCEMENT (same as Phase 3):
- Register attached files in document_register. Re-vouch ONLY expense items that match new evidence (by payee/amount/date +-14 days).
- Return document_register (merged: existing + new rows) AND expense_samples_additional (only re-vouched items).
- Invoice = Tier 1; Payment PAID = Tier 1; ACCRUED = Tier 2.
""",
        ["compliance"] = """
EVIDENCE TIER ENFORCEMENT:
- Insurance adequacy = Tier 1 ONLY (Insurance Policy, Certificate of Currency, Insurance Valuation Report). Management summaries/GL/Notes prohibited.
- GST roll-forward = Tier 1 for BAS/Bank Statement (GST Paid). Tier 2 for internal GST schedules. Tier 3 fallback only.
- Income Tax = Tier 1 for ATO lodgement/tax return. Tier 3 for internal workpapers when N/A.
""",
        ["aiAttempt"] = """
EVIDENCE TIER ENFORCEMENT:
- Apply the same Evidence Tier rules as initial phases:
  Levy: Admin/Capital Receipts = Tier 2 ONLY. PriorYear/CurrentYear = bs_extract.
  BS (phase4): R2 = Tier 1; R3/4 = Tier 2; R5 = Tier 3. NO ELEVATION.
  Expense: Invoice & Payment PAID = Tier 1; ACCRUED = Tier 2.
  Compliance: Insurance = Tier 1; GST = Tier 1/2; Income Tax = Tier 1/3.
""",
    };

    private static readonly HashSet<string> Call2Modes =
        ["levy", "phase4", "expenses", "expenses_additional", "compliance", "aiAttempt"];

    public string Build(string mode, string fileManifest, object? previousAudit)
    {
        bool isStep0Only = mode == "step0_only";
        bool isCall2Phase = Call2Modes.Contains(mode);

        if (isCall2Phase && previousAudit is not null)
        {
            return BuildCall2Instruction(mode, fileManifest, previousAudit);
        }

        if (previousAudit is not null && !isStep0Only)
        {
            return BuildIncrementalInstruction(fileManifest, previousAudit);
        }

        if (isStep0Only)
        {
            return BuildStep0OnlyInstruction(fileManifest);
        }

        return BuildFullInstruction(fileManifest);
    }

    private static string BuildCall2Instruction(string mode, string fileManifest, object previousAudit)
    {
        string lockedLabel = mode is "aiAttempt"
            ? "AUDIT STATE (Step 0 + Phase 2\u20135 outputs)"
            : "STEP 0 OUTPUT";

        string previousAuditJson = SerializePreviousAudit(previousAudit);

        string phaseLabel = Call2PhaseLabels.GetValueOrDefault(mode, mode);
        string returnKeys = Call2ReturnKeys.GetValueOrDefault(mode, mode);
        string evidenceTier = EvidenceTierInstructions.GetValueOrDefault(mode, string.Empty);

        string modeSpecificInstructions = mode switch
        {
            "phase4" => """

5. [Phase 4 ONLY] bs_amount and line_item MUST be looked up from LOCKED bs_extract. supporting_amount from R2-R5 (Bank Stmt, Levy Report, etc.). Do NOT re-read Balance Sheet PDF.
""",
            "compliance" => """

5. [Phase 5 ONLY] Use intake_summary.registered_for_gst from LOCKED context. If false or absent, output gst_reconciliation with all amounts = 0 and GST_Materiality = "N/A - Plan not registered for GST (per Step 0)".
""",
            "aiAttempt" => """

5. [AI Attempt ONLY] Re-verify ONLY the target items. Use [ADDITIONAL] files as new evidence. Return ai_attempt_resolution_table (one row per target: item, issue_identified, ai_attempt_conduct, result, status). Do NOT merge updates into the main report data.
""",
            "expenses_additional" => """

5. [Expenses Additional ONLY] Register new files in document_register (continue numbering from existing). Match new documents to existing expense_samples by payee + amount + date (+-14 days). Re-execute invoice and payment checks for matched items ONLY. Return document_register (merged) and expense_samples_additional (only re-vouched items).
""",
            _ => string.Empty,
        };

        return $"""
ATTACHED FILE MAPPING (Strictly map the uploaded files to these names):
{fileManifest}

*** LOCKED {lockedLabel} (DO NOT RE-EXTRACT - USE AS-IS) ***
{previousAuditJson}

*** CALL 2 - {mode.ToUpperInvariant()} ONLY ***
INSTRUCTIONS:
1. You MUST use the LOCKED context above. Do NOT re-extract document_register or intake_summary.
2. Use core_data_positions for document/page locations. Use intake_summary.financial_year as global FY.
3. Execute {phaseLabel} ONLY.
4. Return ONLY {returnKeys}. No other keys.
{modeSpecificInstructions}
{evidenceTier}
""";
    }

    private static string BuildIncrementalInstruction(string fileManifest, object previousAudit)
    {
        string previousAuditJson = SerializePreviousAudit(previousAudit);

        return $"""
ATTACHED FILE MAPPING (Strictly map the uploaded files to these names):
{fileManifest}

*** INCREMENTAL AUDIT UPDATE ***
CONTEXT: The user has provided additional evidence files.
CURRENT AUDIT STATE: {previousAuditJson}

INSTRUCTIONS:
1. Update the "document_register" with the new files. Use the exact names from the mapping above.
2. Check "missing_critical_types" in "intake_summary". If a missing doc is now provided, resolve it.
3. Return the merged JSON.
""";
    }

    private static string BuildStep0OnlyInstruction(string fileManifest)
    {
        return $"""
ATTACHED FILE MAPPING (Strictly map the uploaded files to these names):
{fileManifest}

*** STEP 0 ONLY - DOCUMENT INTAKE ***
INSTRUCTIONS:
1. Execute Step 0 ONLY. Create the Document Dictionary. You MUST map "File 1" to the first name in the list above, "File 2" to the second, etc.
2. The "Document_Origin_Name" in the JSON MUST match the filename exactly.
3. Do NOT execute Phases 1-6. Return document_register, intake_summary, core_data_positions, bs_extract, and pl_extract. Do NOT include levy_reconciliation, assets_and_cash, expense_samples, statutory_compliance, or completion_outputs.
4. Extract strata_plan and financial_year from minutes/financials into intake_summary.
5. Populate core_data_positions with doc_id and page_range for each evidence type (balance_sheet, bank_statement, levy_report, income_and_expenditure, etc.). Use null if not found.
6. Populate bs_extract: export the full Balance Sheet including Prior Year and Current Year columns. For each row: line_item, section, fund, prior_year, current_year. Use prior_year_label and current_year_label. This is the single source of truth for Phase 2 and Phase 4.
7. Populate pl_extract: export the full Income & Expenditure (P&L) statement. For each row: line_item, section (INCOME|EXPENDITURE|SURPLUS_DEFICIT), fund, prior_year, current_year. If P&L not found in documents, return rows: [].
""";
    }

    private static string BuildFullInstruction(string fileManifest)
    {
        return $"""
ATTACHED FILE MAPPING (Strictly map the uploaded files to these names):
{fileManifest}

INSTRUCTIONS:
1. Step 0: Create the Document Dictionary. You MUST map "File 1" to the first name in the list above,
   "File 2" to the second, etc.
2. The "Document_Origin_Name" in the JSON MUST match the filename exactly.
3. Execute Phases 1-5 based on these files.
4. **MANDATORY - Step 0 bs_extract:** Export full Balance Sheet with prior_year and current_year for each line item. Single source of truth for Phase 2 and Phase 4.
5. **MANDATORY - Step 0 pl_extract:** Export full Income & Expenditure (P&L). If not found, return rows: [].
6. **MANDATORY - Phase 2:** PriorYear_Arrears, PriorYear_Advance, CurrentYear_Arrears, CurrentYear_Advance MUST be looked up from LOCKED bs_extract ONLY. Do NOT use Levy Reports, GL, or any other source.
7. **MANDATORY - Phase 4 balance_sheet_verification:** bs_amount and line_item MUST be looked up from LOCKED bs_extract ONLY. supporting_amount from R2-R5 evidence (Bank Stmt, Levy Report, etc.). Fill note and supporting_note separately.
""";
    }

    private static string SerializePreviousAudit(object previousAudit)
    {
        if (previousAudit is JsonElement element)
        {
            return element.GetRawText();
        }
        return JsonSerializer.Serialize(previousAudit);
    }
}
