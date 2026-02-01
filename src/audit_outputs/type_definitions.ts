/**
 * TypeScript interfaces for Audit Outputs (Module 50 structure).
 * Used by the app and by schema_definitions for Zod validation.
 */

export interface DocumentEntry {
  Document_ID: string;
  Document_Origin_Name: string;
  Document_Name: string;
  Document_Type: string;
  Page_Range: string;
  Evidence_Tier: string;
  Relevant_Phases: string[];
  Notes?: string;
}

export interface IntakeSummary {
  total_files: number;
  missing_critical_types: string[];
  status: string;
  /** Strata Plan number (e.g. SP 12345) – extracted from minutes/financials during document dictionary recognition */
  strata_plan?: string;
  /** Financial Year – extracted from minutes/financials (format DD/MM/YYYY - DD/MM/YYYY or DD/MM/YYYY); used as global FY for all phases */
  financial_year?: string;
}

export interface TraceableValue {
  amount: number;
  source_doc_id: string;
  page_ref: string;
  note?: string;
  verbatim_quote?: string;
  computation?: { method: string; expression: string };
}

export interface LevyRecMaster {
  Source_Doc_ID: string;
  AGM_Date: string;
  Op_Arrears: TraceableValue;
  Op_Advance: TraceableValue;
  Net_Opening_Bal: TraceableValue;
  Old_Levy_Admin: TraceableValue;
  Old_Levy_Sink: TraceableValue;
  Old_Levy_Total: TraceableValue;
  New_Levy_Admin: TraceableValue;
  New_Levy_Sink: TraceableValue;
  New_Levy_Total: TraceableValue;
  Sub_Levies_Standard: TraceableValue;
  Sub_Levies_Standard_Admin?: TraceableValue;
  Sub_Levies_Standard_Sink?: TraceableValue;
  Spec_Levy_Admin: TraceableValue;
  Spec_Levy_Sink: TraceableValue;
  Spec_Levy_Total: TraceableValue;
  Plus_Interest_Chgd: TraceableValue;
  Less_Discount_Given: TraceableValue;
  Plus_Legal_Recovery: TraceableValue;
  Plus_Other_Recovery: TraceableValue;
  Sub_Admin_Net: TraceableValue;
  Sub_Sink_Net: TraceableValue;
  Total_Levies_Net: TraceableValue;
  GST_Admin: TraceableValue;
  GST_Sink: TraceableValue;
  GST_Special: TraceableValue;
  Total_GST_Raised: TraceableValue;
  Total_Gross_Inc: TraceableValue;
  Total_Receipts_Global: TraceableValue;
  Non_Levy_Income: TraceableValue;
  Effective_Levy_Receipts: TraceableValue;
  Calc_Closing: TraceableValue;
  BS_Arrears: TraceableValue;
  BS_Advance: TraceableValue;
  BS_Closing: TraceableValue;
  Levy_Variance: TraceableValue;
}

export interface HighRiskDebtor {
  Source_Doc_ID: string;
  Lot_No: string;
  Owner_Name: string;
  Arrears_Amt: TraceableValue;
  Days_Overdue: string;
  Recovery_Action: string;
}

export interface LevyReconciliation {
  master_table: LevyRecMaster;
  high_risk_debtors: HighRiskDebtor[];
}

/** Phase 4 GATE 2: Full Balance Sheet line-item verification (Owners Equity, Assets, Liabilities) */
export interface BalanceSheetVerificationItem {
  line_item: string;
  section?: "OWNERS_EQUITY" | "ASSETS" | "LIABILITIES";
  fund?: string;
  bs_amount: number;
  supporting_amount: number;
  /** Doc_ID/Page for traceability (e.g. "Sys_001/Page 2") */
  evidence_ref: string;
  status: "VERIFIED" | "VARIANCE" | "MISSING_BANK_STMT" | "TIER_3_ONLY" | "MISSING_LEVY_REPORT" | "MISSING_BREAKDOWN" | "NO_SUPPORT";
  /** AI explanation holder (same as Table E.Master Note/Source) – human-readable source context e.g. "Bank Statement p.2 as at FY end", "Current Year BS column" */
  note?: string;
}

export interface AssetsAndCash {
  /** Phase 4: Full Balance Sheet verification (Owners Equity + Assets + Liabilities) */
  balance_sheet_verification: BalanceSheetVerificationItem[];
}

export interface VerificationStep {
  rule: string;
  status: string;
  evidence_ref: string;
}

export interface ExpenseSample {
  GL_Date: string;
  GL_Payee: string;
  GL_Amount: TraceableValue;
  GL_Fund_Code: string;
  Source_Docs: { GL_ID: string; Invoice_ID: string; Minute_ID?: string };
  Doc_Status: string;
  Invoice_Status: string;
  Inv_Desc: string;
  Class_Result: string;
  Manager_Limit: number;
  Minute_Ref: string;
  Auth_Result: string;
  verification_steps?: VerificationStep[];
}

export interface GSTRecMaster {
  GST_Opening_Bal: TraceableValue;
  Total_GST_Raised: TraceableValue;
  GST_On_Payments: TraceableValue;
  GST_Theor_Mvmt: TraceableValue;
  BAS_Q1: TraceableValue;
  BAS_Q2: TraceableValue;
  BAS_Q3: TraceableValue;
  BAS_Q4: TraceableValue;
  Total_BAS_Cash: TraceableValue;
  GST_Calc_Closing: TraceableValue;
  GST_GL_Closing: TraceableValue;
  GST_Rec_Variance: TraceableValue;
  GST_Materiality: string;
}

export interface StatutoryCompliance {
  insurance: {
    Val_Doc_ID: string;
    Ins_Doc_ID: string;
    Valuation_Amount: TraceableValue;
    Valuation_Date: string;
    Policy_Amount: TraceableValue;
    Policy_No: string;
    Insurance_Gap: TraceableValue;
    Insurance_Status: string;
    Policy_Expiry: string;
    Expiry_Status: string;
  };
  gst_reconciliation: GSTRecMaster;
  income_tax: {
    GL_Doc_ID: string;
    Interest_Income: TraceableValue;
    Other_Taxable_Income: TraceableValue;
    Tax_Deductions: TraceableValue;
    Net_Taxable: TraceableValue;
    Calc_Tax: TraceableValue;
    GL_Tax_Exp: TraceableValue;
    Tax_Adj_Status: string;
  };
}

export interface IssueEntry {
  Issue_ID: string;
  Phase: string;
  Description: string;
  Resolution_Status: string;
}

export interface BoundaryEntry {
  Area: string;
  What_Is_Missing: string;
  Why_Unresolved: string;
  Required_To_Resolve: string;
}

export interface CompletionOutputs {
  issue_register: IssueEntry[];
  boundary_disclosure: BoundaryEntry[];
}

export interface AuditResponse {
  document_register: DocumentEntry[];
  intake_summary: IntakeSummary;
  levy_reconciliation?: LevyReconciliation;
  assets_and_cash?: AssetsAndCash;
  expense_samples?: ExpenseSample[];
  statutory_compliance?: StatutoryCompliance;
  completion_outputs?: CompletionOutputs;
}

export interface TriageItem {
  id: string;
  rowId: string;
  tab: string;
  title: string;
  comment: string;
  severity: "low" | "medium" | "critical";
  timestamp: number;
}

export type PlanStatus = "idle" | "processing" | "completed" | "failed";

export interface Plan {
  id: string;
  name: string;
  createdAt: number;
  status: PlanStatus;
  files: File[];
  /** Storage paths for files (used when loading from Firestore to restore PDF preview) */
  filePaths?: string[];
  result: AuditResponse | null;
  triage: TriageItem[];
  error: string | null;
}
