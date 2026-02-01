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
  /** Manager spending limit (single transaction) – from Strata Agency Agreement or Committee Minutes; used for Phase 3 Authority Tier 1 */
  manager_limit?: number;
  /** AGM-approved limit above which General Meeting approval required – from AGM Minutes; used for Phase 3 Authority Tier 2/3 */
  agm_limit?: number;
}

/** Step 0: Location lock for a document */
export interface DocLocation {
  doc_id: string;
  page_range: string;
  as_at_date?: string;
}

/** Step 0: Minutes reference (page_ref instead of page_range) */
export interface MinutesRef {
  doc_id: string;
  page_ref: string;
}

/** Step 0: Core data positions – lock document/page locations for Phase 2/4/3 */
export interface CoreDataPositions {
  balance_sheet?: DocLocation | null;
  bank_statement?: DocLocation | null;
  levy_report?: DocLocation | null;
  levy_receipts_admin?: DocLocation | null;
  levy_receipts_capital?: DocLocation | null;
  general_ledger?: DocLocation | null;
  minutes_levy?: MinutesRef | null;
  minutes_auth?: MinutesRef | null;
}

/** Step 0: Balance Sheet column mapping (when BS has Prior/Current Year columns) */
export interface BsColumnMapping {
  current_year_label: string;
  prior_year_label: string;
}

/** Step 0: Balance Sheet line item structure */
export interface BsStructureItem {
  line_item: string;
  section: "OWNERS_EQUITY" | "ASSETS" | "LIABILITIES";
  fund?: string;
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
  /** OPENING BALANCE – Levies in Arrears at START of FY (from Prior Year BS closing). note MUST mention "Prior Year" or "prior year closing". */
  Op_Arrears: TraceableValue;
  /** OPENING BALANCE – Levies in Advance at START of FY (from Prior Year BS closing). note MUST mention "Prior Year" or "prior year closing". */
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
  /** Administrative Fund receipts for the audit FY (Admin & Capital Actual Payments method) */
  Admin_Fund_Receipts: TraceableValue;
  /** Capital / Sinking Fund receipts for the audit FY (Admin & Capital Actual Payments method) */
  Capital_Fund_Receipts: TraceableValue;
  /** Sum of Admin + Capital fund receipts; Effective_Levy_Receipts = this total */
  Total_Receipts_Global: TraceableValue;
  /** @deprecated Not used when Admin & Capital method; kept for backward compatibility */
  Non_Levy_Income?: TraceableValue;
  Effective_Levy_Receipts: TraceableValue;
  Calc_Closing: TraceableValue;
  /** CLOSING BALANCE – Levies in Arrears at END of FY (from Current Year BS closing). note MUST mention "Current Year" or "current year closing". */
  BS_Arrears: TraceableValue;
  /** CLOSING BALANCE – Levies in Advance at END of FY (from Current Year BS closing). note MUST mention "Current Year" or "current year closing". */
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
  /** MANDATORY: Column label from bs_column_mapping (e.g. "2024", "Current Year") – ensures bs_amount is from correct year */
  year_column: string;
  supporting_amount: number;
  /** Doc_ID/Page for traceability (e.g. "Sys_001/Page 2") */
  evidence_ref: string;
  status: "VERIFIED" | "VARIANCE" | "MISSING_BANK_STMT" | "TIER_3_ONLY" | "MISSING_LEVY_REPORT" | "MISSING_BREAKDOWN" | "NO_SUPPORT" | "GL_SUPPORTED_ONLY";
  /** AI explanation holder (same as Table E.Master Note/Source) – human-readable source context e.g. "Bank Statement p.2 as at FY end", "From BS column '2024'" */
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

/** Phase 3 v2: Risk-based expense – why this item was selected */
export interface ExpenseRiskProfile {
  is_material: boolean;
  risk_keywords: string[];
  is_split_invoice: boolean;
  selection_reason: string;
}

/** Optional forensic evidence for expense pillars (Source Doc, Doc ID, Context/Note, View in PDF). */
export interface ExpenseEvidenceRef {
  source_doc_id?: string;
  page_ref?: string;
  /** Context / Note: what test was performed and why this rating. */
  note?: string;
  extracted_amount?: number;
}

/** Phase 3 v2: Three-way match (Invoice / Payment / Authority) */
export interface ThreeWayMatch {
  invoice: {
    id: string;
    date: string;
    payee_match: boolean;
    abn_valid: boolean;
    addressed_to_strata: boolean;
    /** Forensic: Doc ID / page and context for Evidence Chain popover. */
    evidence?: ExpenseEvidenceRef;
  };
  payment: {
    status: "PAID" | "ACCRUED" | "MISSING" | "BANK_STMT_MISSING";
    bank_date?: string;
    amount_match: boolean;
    source_doc?: string;
    creditors_ref?: string;
    /** Forensic: page_ref and context for Evidence Chain popover. source_doc used as Doc ID when evidence not set. */
    evidence?: ExpenseEvidenceRef;
  };
  authority: {
    required_tier: "MANAGER" | "COMMITTEE" | "GENERAL_MEETING";
    limit_applied: number;
    minute_ref?: string;
    status: "AUTHORISED" | "UNAUTHORISED" | "NO_MINUTES_FOUND" | "MINUTES_NOT_AVAILABLE";
    /** Forensic: Doc ID / page and context for Evidence Chain popover. */
    evidence?: ExpenseEvidenceRef;
  };
}

/** Phase 3 v2: Admin vs Capital fund classification */
export interface FundIntegrity {
  gl_fund_code: string;
  invoice_nature: string;
  classification_status: "CORRECT" | "MISCLASSIFIED" | "UNCERTAIN";
  note?: string;
  /** Forensic: Doc ID / page for Evidence Chain popover (e.g. GL or invoice doc). */
  evidence?: ExpenseEvidenceRef;
}

/** Phase 3 v2: Audit Evidence Package (risk-based sampling + three-way match + fund integrity). New fields optional for backward compat with old expense_samples. */
export interface ExpenseSample {
  GL_ID?: string;
  GL_Date: string;
  GL_Payee: string;
  GL_Amount: TraceableValue;
  /** Present when using Phase 3 v2 (risk-based) flow */
  Risk_Profile?: ExpenseRiskProfile;
  Three_Way_Match?: ThreeWayMatch;
  Fund_Integrity?: FundIntegrity;
  Overall_Status?: "PASS" | "FAIL" | "RISK_FLAG";
  /** Legacy – present when using old expense flow */
  GL_Fund_Code?: string;
  Source_Docs?: { GL_ID: string; Invoice_ID: string; Minute_ID?: string };
  Doc_Status?: string;
  Invoice_Status?: string;
  Inv_Desc?: string;
  Class_Result?: string;
  Manager_Limit?: number;
  Minute_Ref?: string;
  Auth_Result?: string;
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
  /** Step 0: Core data positions (document/page locks for Phase 2/4/3) */
  core_data_positions?: CoreDataPositions | null;
  /** Step 0: BS column mapping when Prior/Current Year columns exist */
  bs_column_mapping?: BsColumnMapping | null;
  /** Step 0: Balance Sheet line item structure */
  bs_structure?: BsStructureItem[] | null;
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
