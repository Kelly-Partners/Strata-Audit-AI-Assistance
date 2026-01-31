




export interface DocumentEntry {
  Document_ID: string;
  Document_Origin_Name: string; // New field for original filename
  Document_Name: string;
  Document_Type: string;
  Page_Range: string; // Replaces Fund_Scope
  Evidence_Tier: string;
  Relevant_Phases: string[];
  Notes?: string;
}

export interface IntakeSummary {
  total_files: number;
  missing_critical_types: string[];
  status: string;
}

// New Interface for Forensic Traceability
export interface TraceableValue {
  amount: number;
  source_doc_id: string;
  page_ref: string; // e.g., "Page 12, Line 5"
  note?: string; // AI explanation of the figure's context
  verbatim_quote?: string; // New: Visual Grounding Anchor (Exact Text)
  computation?: {          // New: Calculation Logic
    method: string; 
    expression: string;
  };
}

// --- NEW MASTER TABLE E INTERFACE (Levy Rec) ---
export interface LevyRecMaster {
  Source_Doc_ID: string;
  AGM_Date: string;
  
  // OPENING
  Op_Arrears: TraceableValue;
  Op_Advance: TraceableValue;
  Net_Opening_Bal: TraceableValue;

  // STANDARD LEVIES (NET)
  Old_Levy_Admin: TraceableValue;
  Old_Levy_Sink: TraceableValue;
  Old_Levy_Total: TraceableValue;
  New_Levy_Admin: TraceableValue;
  New_Levy_Sink: TraceableValue;
  New_Levy_Total: TraceableValue;
  
  // SUB-TOTAL (B1)
  Sub_Levies_Standard: TraceableValue; // (B1) = Old + New

  // ADJUSTMENTS / VARIATIONS
  Spec_Levy_Admin: TraceableValue;
  Spec_Levy_Sink: TraceableValue;
  Spec_Levy_Total: TraceableValue;
  
  Plus_Interest_Chgd: TraceableValue;
  Less_Discount_Given: TraceableValue; // Should be negative if it reduces income
  Plus_Legal_Recovery: TraceableValue;
  Plus_Other_Recovery: TraceableValue; // Misc Levy recoveries (e.g. Debt Collection fees)
  
  // SUB-TOTALS (B) - NET
  Sub_Admin_Net: TraceableValue;
  Sub_Sink_Net: TraceableValue;
  Total_Levies_Net: TraceableValue; // (B) = B1 + Spec + Adjustments

  // GST COMPONENT
  GST_Admin: TraceableValue;
  GST_Sink: TraceableValue;
  GST_Special: TraceableValue;
  Total_GST_Raised: TraceableValue; // (C)

  // TOTAL GROSS
  Total_Gross_Inc: TraceableValue; // (D) = (B) + (C)

  // RECONCILIATION - NEW LOGIC
  Total_Receipts_Global: TraceableValue; // Total Cash from Bank/GL
  Non_Levy_Income: TraceableValue;       // Insurance Claims, Certificates, etc.
  Effective_Levy_Receipts: TraceableValue; // (E) = Total - Non-Levy
  
  Calc_Closing: TraceableValue;
  
  // BALANCE SHEET CLOSING (Granular)
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
  master_table: LevyRecMaster; // Replaces income_recomputation & balance_sheet_proof
  high_risk_debtors: HighRiskDebtor[];       
}

export interface BankReconciliation {
  Source_Doc_ID: string;
  Bank_Stmt_Balance: TraceableValue;
  Bank_Stmt_Date: string;
  Outstanding_Deposits: TraceableValue;
  Unpresented_Cheques: TraceableValue;
  Adjusted_Bank_Bal: TraceableValue;
  GL_Bank_Balance: TraceableValue;
  Bank_Rec_Variance: TraceableValue;
}

export interface FundIntegrity {
  Source_Doc_ID: string;
  Admin_Fund_Bal: TraceableValue;
  Admin_Solvency_Status: string;
  Admin_Action: string;
  Cap_Works_Bal: TraceableValue;
  Cap_Integrity_Status: string;
  Cap_Action: string;
  TFN_Check_Source_ID: string;
  TFN_Tax_Amt: TraceableValue;
  TFN_Status: string;
  TFN_Action: string;
}

export interface Investment {
  Source_Doc_ID: string;
  TD_Bank_Name: string;
  TD_Principal: TraceableValue;
  TD_Rate: number; // Rate is percentage, keep simple or traceable? Let's keep simple for now
  TD_Maturity: string;
  Calc_Interest: TraceableValue;
  GL_Interest: TraceableValue;
  Interest_Variance: TraceableValue;
}

export interface AssetsAndCash {
  bank_reconciliation: BankReconciliation; 
  fund_integrity: FundIntegrity;           
  investments: Investment[];               
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
  Source_Docs: {
    GL_ID: string;
    Invoice_ID: string;
    Minute_ID?: string;
  };
  Doc_Status: string;
  Invoice_Status: string;
  Inv_Desc: string;
  Class_Result: string;
  Manager_Limit: number;
  Minute_Ref: string;
  Auth_Result: string;
  verification_steps?: VerificationStep[]; // New: Expense Logic Chain
}

// --- NEW MASTER TABLE F INTERFACE (GST Rec) ---
export interface GSTRecMaster {
  GST_Opening_Bal: TraceableValue;
  Total_GST_Raised: TraceableValue; // Links from Levy Rec
  GST_On_Payments: TraceableValue;
  GST_Theor_Mvmt: TraceableValue;
  
  // BAS Activity
  BAS_Q1: TraceableValue;
  BAS_Q2: TraceableValue;
  BAS_Q3: TraceableValue;
  BAS_Q4: TraceableValue;
  Total_BAS_Cash: TraceableValue;

  // Closing
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
  gst_reconciliation: GSTRecMaster; // Replaces old simple structure
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

// --- NEW: TRIAGE & REVIEW TYPES ---
export interface TriageItem {
  id: string;
  rowId: string;
  tab: string;
  title: string;
  comment: string;
  severity: 'low' | 'medium' | 'critical';
  timestamp: number;
}

// --- MULTI-PLAN ARCHITECTURE TYPES ---
export type PlanStatus = 'idle' | 'processing' | 'completed' | 'failed';

export interface Plan {
  id: string;
  name: string;
  createdAt: number;
  status: PlanStatus;
  files: File[];
  result: AuditResponse | null;
  triage: TriageItem[]; // New: Sidecar storage for user review flags
  error: string | null;
}
