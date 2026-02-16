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
  /** Manager spending limit – from Strata Agency Agreement or Committee Minutes; used for Phase 3 Step A (MATERIALITY, SPLIT_PATTERN) when available */
  manager_limit?: number;
  /** AGM-approved limit – from AGM Minutes; used for Phase 3 Step A (SPLIT_PATTERN) when available */
  agm_limit?: number;
  /** True when FY cannot be determined or BS year mapping is ambiguous – boundary not reliably defined */
  boundary_defined?: boolean;
  /** Set to "balance_check_failed" when Total Assets ≠ Total Liabilities + Total Equity (tolerance 1.00) */
  bs_extract_warning?: string;
  /** True if Balance Sheet contains GST account(s) (e.g. GST Payable, GST Collected, GST Receivable); false otherwise. Used by Phase 2 & 5. */
  registered_for_gst?: boolean;
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
  income_and_expenditure?: DocLocation | null;
  bank_statement?: DocLocation | null;
  levy_report?: DocLocation | null;
  levy_receipts_admin?: DocLocation | null;
  levy_receipts_capital?: DocLocation | null;
  general_ledger?: DocLocation | null;
  minutes_levy?: MinutesRef | null;
  minutes_auth?: MinutesRef | null;
}

/** Step 0: Balance Sheet column mapping (when BS has Prior/Current Year columns) – deprecated, use bs_extract */
export interface BsColumnMapping {
  current_year_label: string;
  prior_year_label: string;
}

/** Step 0: Balance Sheet line item structure – deprecated, use bs_extract */
export interface BsStructureItem {
  line_item: string;
  section: "OWNERS_EQUITY" | "ASSETS" | "LIABILITIES";
  fund?: string;
}

/** Step 0: Full Balance Sheet extract – SINGLE SOURCE OF TRUTH for Phase 2/4/5 BS-derived data */
export interface BsExtractRow {
  line_item: string;
  section?: "OWNERS_EQUITY" | "ASSETS" | "LIABILITIES";
  fund?: string;
  prior_year: number;
  current_year: number;
}

export interface BsExtract {
  prior_year_label: string;
  current_year_label: string;
  rows: BsExtractRow[];
}

/** Step 0: Income & Expenditure (P&L) line item – same structure as bs_extract rows */
export interface PlExtractRow {
  line_item: string;
  section?: "INCOME" | "EXPENDITURE" | "SURPLUS_DEFICIT";
  fund?: string;
  prior_year: number;
  current_year: number;
}

/** Step 0: Full Income & Expenditure extract – LOCKED single source for Phase 3/6 P&L-derived data */
export interface PlExtract {
  prior_year_label: string;
  current_year_label: string;
  rows: PlExtractRow[];
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
  /** PRIOR YEAR COLUMN – Levies in Arrears from Prior Year Balance Sheet column (= Opening Balance at START of FY). */
  PriorYear_Arrears: TraceableValue;
  /** PRIOR YEAR COLUMN – Levies in Advance from Prior Year Balance Sheet column (= Opening Balance at START of FY). */
  PriorYear_Advance: TraceableValue;
  /** Net Prior Year Levy Position = PriorYear_Arrears - PriorYear_Advance (= Net Opening Balance). */
  PriorYear_Net: TraceableValue;
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
  Plus_Interest_Chgd_Admin?: TraceableValue;
  Plus_Interest_Chgd_Sink?: TraceableValue;
  Plus_Interest_Chgd_Total?: TraceableValue;
  Less_Discount_Given_Admin?: TraceableValue;
  Less_Discount_Given_Sink?: TraceableValue;
  Less_Discount_Given_Total?: TraceableValue;
  /** @deprecated – use Plus_Interest_Chgd_Admin/Sink/Total; kept for backward compat */
  Plus_Interest_Chgd?: TraceableValue;
  /** @deprecated – use Less_Discount_Given_Admin/Sink/Total; kept for backward compat */
  Less_Discount_Given?: TraceableValue;
  Plus_Legal_Recovery: TraceableValue;
  Plus_Other_Recovery: TraceableValue;
  Sub_Admin_Net: TraceableValue;
  Sub_Sink_Net: TraceableValue;
  Total_Levies_Net: TraceableValue;
  GST_Admin: TraceableValue;
  GST_Sink: TraceableValue;
  GST_Special_Admin?: TraceableValue;
  GST_Special_Sink?: TraceableValue;
  GST_Special?: TraceableValue;
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
  /** CURRENT YEAR COLUMN – Levies in Arrears from Current Year Balance Sheet column (= Closing Balance at END of FY). */
  CurrentYear_Arrears: TraceableValue;
  /** CURRENT YEAR COLUMN – Levies in Advance from Current Year Balance Sheet column (= Closing Balance at END of FY). */
  CurrentYear_Advance: TraceableValue;
  /** Net Current Year Levy Position = CurrentYear_Arrears - CurrentYear_Advance (= Balance Sheet Closing). */
  CurrentYear_Net: TraceableValue;
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
  /** null/empty when evidence missing (MISSING_*); 0 only for SUBTOTAL_CHECK_ONLY */
  supporting_amount?: number | null;
  /** Doc_ID/Page for traceability (e.g. "Sys_001/Page 2") */
  evidence_ref: string;
  status: "VERIFIED" | "VARIANCE" | "MISSING_BANK_STMT" | "TIER_3_ONLY" | "MISSING_LEVY_REPORT" | "MISSING_BREAKDOWN" | "NO_SUPPORT" | "GL_SUPPORTED_ONLY" | "SUBTOTAL_CHECK_ONLY";
  /** bs_amount source context – e.g. "From BS column '2024'". Used for BS Amount ForensicCell. Do NOT include supporting evidence here. */
  note?: string;
  /** supporting_amount source context – e.g. "Matches Macquarie Investment Account Statement 2036-74072". Used for Supporting ForensicCell ONLY. Do NOT include "From BS column". */
  supporting_note?: string;
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
export type SelectionDimension =
  | "VALUE_COVERAGE"
  | "RISK_KEYWORD"
  | "MATERIALITY"
  | "ANOMALY_DESCRIPTION"
  | "SPLIT_PATTERN"
  | "RECURRING_NEAR_LIMIT"
  | "OTHER";

export interface ExpenseRiskProfile {
  is_material: boolean;
  risk_keywords: string[];
  is_split_invoice: boolean;
  selection_reason: string;
  /** Primary dimension for UI grouping – assign one per item. Use OTHER when unclear. */
  selection_dimension?: SelectionDimension;
}

/** Optional forensic evidence for expense pillars (Source Doc, Doc ID, Context/Note, View in PDF). */
export interface ExpenseEvidenceRef {
  source_doc_id?: string;
  page_ref?: string;
  /** Context / Note: what test was performed and why this rating. */
  note?: string;
  extracted_amount?: number;
}

/** Invoice sub-check: passed + evidence + observed value for forensic trace. */
export interface InvoiceCheckItem {
  passed: boolean;
  evidence?: ExpenseEvidenceRef;
  /** Observed value from document for audit trail, e.g. "Invoice $1100 vs GL $1100; within tolerance" */
  observed?: string;
}

/** Invoice checks: each sub-check REQUIRED with pass + evidence (for Forensic). */
export interface InvoiceChecks {
  sp_number: InvoiceCheckItem;
  address: InvoiceCheckItem;
  amount: InvoiceCheckItem;
  gst_verified: InvoiceCheckItem;
  payee_match: InvoiceCheckItem;
  abn_valid: InvoiceCheckItem;
}

/** Payment sub-check: passed + evidence + observed value (same structure as Invoice). */
export interface PaymentCheckItem {
  passed: boolean;
  evidence?: ExpenseEvidenceRef;
  /** Observed value for audit trail, e.g. "Bank $1100 vs GL $1100; payee ABC Pty Ltd" */
  observed?: string;
}

/** Payment checks: each sub-check REQUIRED. PAID: bank/ref/dup/split/date + ageing/subsequent N/A. ACCRUED: payee/amount/ageing/subsequent + others N/A. */
export interface PaymentChecks {
  bank_account_match: PaymentCheckItem;
  payee_match: PaymentCheckItem;
  amount_match: PaymentCheckItem;
  reference_traceable: PaymentCheckItem;
  duplicate_check: PaymentCheckItem;
  split_payment_check: PaymentCheckItem;
  date_match: PaymentCheckItem;
  ageing_reasonableness: PaymentCheckItem;
  subsequent_payment_check: PaymentCheckItem;
}

/** Phase 3 v2: Three-way match (Invoice / Payment). Authority removed – optional for backward compat. */
export interface ThreeWayMatch {
  invoice: {
    id: string;
    date: string;
    /** Per-check pass + evidence – REQUIRED. Each check links to PDF. */
    checks: InvoiceChecks;
    /** Top-level summary – keep for backward compat and quick status. */
    payee_match: boolean;
    abn_valid: boolean;
    addressed_to_strata: boolean;
    /** Legacy forensic – fallback when checks absent. */
    evidence?: ExpenseEvidenceRef;
  };
  payment: {
    status: "PAID" | "ACCRUED" | "MISSING" | "BANK_STMT_MISSING";
    bank_date?: string;
    amount_match: boolean;
    source_doc?: string;
    creditors_ref?: string;
    /** Per-check pass + evidence – REQUIRED. Same granularity as invoice. */
    checks: PaymentChecks;
    /** Forensic: page_ref and context for Evidence Chain popover. source_doc used as Doc ID when evidence not set. */
    evidence?: ExpenseEvidenceRef;
  };
  /** @deprecated Authority removed from Phase 3. Kept optional for backward compat with old data. */
  authority?: {
    required_tier: "MANAGER" | "COMMITTEE" | "GENERAL_MEETING";
    limit_applied: number;
    minute_ref?: string;
    status: "AUTHORISED" | "UNAUTHORISED" | "NO_MINUTES_FOUND" | "MINUTES_NOT_AVAILABLE";
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

/** Expense run – initial or additional. Enables multi-round evidence supplement without overwriting. */
export interface ExpenseRun {
  run_id: string;
  run_type: "initial" | "additional";
  created_at: string;
  /** For additional runs: Storage paths for this run's files */
  file_paths?: string[];
  /** For additional runs: Document_IDs from document_register for this run's new files */
  document_ids?: string[];
  expense_samples: ExpenseSample[];
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
  /** Step 0: BS column mapping when Prior/Current Year columns exist (deprecated – use bs_extract) */
  bs_column_mapping?: BsColumnMapping | null;
  /** Step 0: Balance Sheet line item structure (deprecated – use bs_extract) */
  bs_structure?: BsStructureItem[] | null;
  /** Step 0: Full BS extract – single source of truth for Phase 2/4/5. Use prior_year/current_year from rows. */
  bs_extract?: BsExtract | null;
  /** Step 0: Full Income & Expenditure (P&L) extract – LOCKED for Phase 3/6. Same year mapping as bs_extract. */
  pl_extract?: PlExtract | null;
  levy_reconciliation?: LevyReconciliation;
  assets_and_cash?: AssetsAndCash;
  /** Legacy: flat expense_samples. Prefer expense_runs when present. */
  expense_samples?: ExpenseSample[];
  /** Phase 3 multi-round: initial + additional runs. UI uses combined view. */
  expense_runs?: ExpenseRun[];
  statutory_compliance?: StatutoryCompliance;
  completion_outputs?: CompletionOutputs;
  /** AI Attempt: Resolution table (Items, Issue identified, AI Attempt conduct, Result, Status) */
  ai_attempt_resolution_table?: AiAttemptResolutionRow[];
}

/** AI Attempt Resolution row – one per target item re-verified */
export interface AiAttemptResolutionRow {
  item: string;
  issue_identified: string;
  ai_attempt_conduct: string;
  result: string;
  status: string;
}

/** Audit trail: one entry per Run AI Attempt */
export interface AiAttemptHistoryEntry {
  timestamp: number;
  targetCount: number;
  resolutionTable: AiAttemptResolutionRow[];
}

export interface TriageItem {
  id: string;
  rowId: string;
  tab: string;
  title: string;
  comment: string;
  severity: "low" | "medium" | "critical";
  timestamp: number;
  /** System-auto from Phase 2-5 non-reconciled; user = manually flagged */
  source?: "system" | "user";
}

/** User resolution – Resolved / Flag / Override with required comment. Shared by Triage & AI Attempt. */
export type ResolutionType = "Resolved" | "Flag" | "Override";

export interface UserResolution {
  itemKey: string;
  resolutionType: ResolutionType;
  comment: string;
  resolvedAt: number;
  resolvedBy?: string;
}

/** @deprecated Use UserResolution. Kept for backward compat. */
export interface UserOverride {
  itemKey: string;
  signedOffAt: number;
  signedOffBy?: string;
  note?: string;
}

export type PlanStatus = "idle" | "processing" | "completed" | "failed";

/** Per-file metadata for document timeline and batch (initial vs additional evidence) */
export interface FileMetaEntry {
  uploadedAt: number;
  batch: "initial" | "additional";
}

/** Additional run metadata – one per "Add Evidence for Vouching" run */
export interface AdditionalRunMeta {
  run_id: string;
  file_paths: string[];
  document_ids?: string[];
  created_at: number;
}

export interface Plan {
  id: string;
  name: string;
  createdAt: number;
  status: PlanStatus;
  files: File[];
  /** Storage paths for files (used when loading from Firestore to restore PDF preview) */
  filePaths?: string[];
  /** Per-file: upload time and batch (parallel to files by index) */
  fileMeta?: FileMetaEntry[];
  result: AuditResponse | null;
  triage: TriageItem[];
  /** User resolutions – Resolved/Flag/Override with comment. Shared by Triage & AI Attempt. Items move to Completion. */
  user_resolutions?: UserResolution[];
  /** @deprecated Use user_resolutions */
  user_overrides?: UserOverride[];
  /** Audit trail: one entry per Run AI Attempt (for traceability) */
  ai_attempt_history?: AiAttemptHistoryEntry[];
  /** Additional evidence runs for expense vouching (multi-round supplement) */
  additional_runs?: AdditionalRunMeta[];
  error: string | null;
}
