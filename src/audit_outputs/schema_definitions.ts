/**
 * Zod schemas for validating Audit Outputs (e.g. LLM response or API payloads).
 * Mirrors type_definitions.ts for runtime validation.
 */

import { z } from "zod";

const ComputationSchema = z.object({
  method: z.string(),
  expression: z.string(),
});

export const TraceableValueSchema = z.object({
  amount: z.number(),
  source_doc_id: z.string(),
  page_ref: z.string(),
  note: z.string().optional(),
  verbatim_quote: z.string().optional(),
  computation: ComputationSchema.optional(),
});

export const DocumentEntrySchema = z.object({
  Document_ID: z.string(),
  Document_Origin_Name: z.string(),
  Document_Name: z.string(),
  Document_Type: z.string(),
  Page_Range: z.string(),
  Evidence_Tier: z.string(),
  Relevant_Phases: z.array(z.string()),
  Notes: z.string().optional(),
});

export const IntakeSummarySchema = z.object({
  total_files: z.number(),
  missing_critical_types: z.array(z.string()),
  status: z.string(),
  strata_plan: z.string().optional(),
  financial_year: z.string().optional(),
  manager_limit: z.number().optional(),
  agm_limit: z.number().optional(),
  boundary_defined: z.boolean().optional(),
  bs_extract_warning: z.string().optional(),
  registered_for_gst: z.boolean().optional(),
});

export const LevyRecMasterSchema = z.object({
  Source_Doc_ID: z.string(),
  AGM_Date: z.string(),
  /** PRIOR YEAR COLUMN – Levies in Arrears from Prior Year Balance Sheet column. */
  PriorYear_Arrears: TraceableValueSchema,
  /** PRIOR YEAR COLUMN – Levies in Advance from Prior Year Balance Sheet column. */
  PriorYear_Advance: TraceableValueSchema,
  /** Net Prior Year Levy Position = PriorYear_Arrears - PriorYear_Advance. */
  PriorYear_Net: TraceableValueSchema,
  Old_Levy_Admin: TraceableValueSchema,
  Old_Levy_Sink: TraceableValueSchema,
  Old_Levy_Total: TraceableValueSchema,
  New_Levy_Admin: TraceableValueSchema,
  New_Levy_Sink: TraceableValueSchema,
  New_Levy_Total: TraceableValueSchema,
  Sub_Levies_Standard: TraceableValueSchema,
  Sub_Levies_Standard_Admin: TraceableValueSchema.optional(),
  Sub_Levies_Standard_Sink: TraceableValueSchema.optional(),
  Spec_Levy_Admin: TraceableValueSchema,
  Spec_Levy_Sink: TraceableValueSchema,
  Spec_Levy_Total: TraceableValueSchema,
  Plus_Interest_Chgd_Admin: TraceableValueSchema.optional(),
  Plus_Interest_Chgd_Sink: TraceableValueSchema.optional(),
  Plus_Interest_Chgd_Total: TraceableValueSchema.optional(),
  Less_Discount_Given_Admin: TraceableValueSchema.optional(),
  Less_Discount_Given_Sink: TraceableValueSchema.optional(),
  Less_Discount_Given_Total: TraceableValueSchema.optional(),
  /** @deprecated – use Plus_Interest_Chgd_Admin/Sink/Total; kept for backward compat */
  Plus_Interest_Chgd: TraceableValueSchema.optional(),
  /** @deprecated – use Less_Discount_Given_Admin/Sink/Total; kept for backward compat */
  Less_Discount_Given: TraceableValueSchema.optional(),
  Plus_Legal_Recovery: TraceableValueSchema,
  Plus_Other_Recovery: TraceableValueSchema,
  Sub_Admin_Net: TraceableValueSchema,
  Sub_Sink_Net: TraceableValueSchema,
  Total_Levies_Net: TraceableValueSchema,
  GST_Admin: TraceableValueSchema,
  GST_Sink: TraceableValueSchema,
  GST_Special_Admin: TraceableValueSchema.optional(),
  GST_Special_Sink: TraceableValueSchema.optional(),
  GST_Special: TraceableValueSchema.optional(),
  Total_GST_Raised: TraceableValueSchema,
  Total_Gross_Inc: TraceableValueSchema,
  Admin_Fund_Receipts: TraceableValueSchema,
  Capital_Fund_Receipts: TraceableValueSchema,
  Total_Receipts_Global: TraceableValueSchema,
  Non_Levy_Income: TraceableValueSchema.optional(),
  Effective_Levy_Receipts: TraceableValueSchema,
  Calc_Closing: TraceableValueSchema,
  /** CURRENT YEAR COLUMN – Levies in Arrears from Current Year Balance Sheet column. */
  CurrentYear_Arrears: TraceableValueSchema,
  /** CURRENT YEAR COLUMN – Levies in Advance from Current Year Balance Sheet column. */
  CurrentYear_Advance: TraceableValueSchema,
  /** Net Current Year Levy Position = CurrentYear_Arrears - CurrentYear_Advance. */
  CurrentYear_Net: TraceableValueSchema,
  Levy_Variance: TraceableValueSchema,
});

export const HighRiskDebtorSchema = z.object({
  Source_Doc_ID: z.string(),
  Lot_No: z.string(),
  Owner_Name: z.string(),
  Arrears_Amt: TraceableValueSchema,
  Days_Overdue: z.string(),
  Recovery_Action: z.string(),
});

export const LevyRecSchema = z.object({
  master_table: LevyRecMasterSchema,
  high_risk_debtors: z.array(HighRiskDebtorSchema),
});

const VerificationStepSchema = z.object({
  rule: z.string(),
  status: z.string(),
  evidence_ref: z.string(),
});

const SelectionDimensionSchema = z.enum([
  "VALUE_COVERAGE",
  "RISK_KEYWORD",
  "MATERIALITY",
  "ANOMALY_DESCRIPTION",
  "SPLIT_PATTERN",
  "RECURRING_NEAR_LIMIT",
  "OTHER",
]);

/** Phase 3 v2: Risk-based expense selection */
const ExpenseRiskProfileSchema = z.object({
  is_material: z.boolean(),
  risk_keywords: z.array(z.string()),
  is_split_invoice: z.boolean(),
  selection_reason: z.string(),
  selection_dimension: SelectionDimensionSchema.optional(),
});

/** Phase 3 v2: Forensic evidence ref for expense pillars */
const ExpenseEvidenceRefSchema = z.object({
  source_doc_id: z.string().optional(),
  page_ref: z.string().optional(),
  note: z.string().optional(),
  extracted_amount: z.number().optional(),
});

/** Invoice sub-check: passed + evidence + observed value. */
const InvoiceCheckItemSchema = z.object({
  passed: z.boolean(),
  evidence: ExpenseEvidenceRefSchema.optional(),
  observed: z.string().optional(),
});

/** Invoice checks – REQUIRED per-check pass + evidence for Forensic. */
const InvoiceChecksSchema = z.object({
  sp_number: InvoiceCheckItemSchema,
  address: InvoiceCheckItemSchema,
  amount: InvoiceCheckItemSchema,
  gst_verified: InvoiceCheckItemSchema,
  payee_match: InvoiceCheckItemSchema,
  abn_valid: InvoiceCheckItemSchema,
});

/** Payment sub-check: same structure as Invoice. */
const PaymentCheckItemSchema = z.object({
  passed: z.boolean(),
  evidence: ExpenseEvidenceRefSchema.optional(),
  observed: z.string().optional(),
});

/** Payment checks – REQUIRED. PAID: bank/ref/dup/split/date + ageing/subsequent N/A. ACCRUED: payee/amount/ageing/subsequent + others N/A. */
const PaymentChecksSchema = z.object({
  bank_account_match: PaymentCheckItemSchema,
  payee_match: PaymentCheckItemSchema,
  amount_match: PaymentCheckItemSchema,
  reference_traceable: PaymentCheckItemSchema,
  duplicate_check: PaymentCheckItemSchema,
  split_payment_check: PaymentCheckItemSchema,
  date_match: PaymentCheckItemSchema,
  ageing_reasonableness: PaymentCheckItemSchema,
  subsequent_payment_check: PaymentCheckItemSchema,
});

/** Phase 3 v2: Three-way match */
const ThreeWayMatchSchema = z.object({
  invoice: z.object({
    id: z.string(),
    date: z.string(),
    checks: InvoiceChecksSchema,
    payee_match: z.boolean(),
    abn_valid: z.boolean(),
    addressed_to_strata: z.boolean(),
    evidence: ExpenseEvidenceRefSchema.optional(),
  }),
  payment: z.object({
    status: z.enum(["PAID", "ACCRUED", "MISSING", "BANK_STMT_MISSING"]),
    bank_date: z.string().optional(),
    amount_match: z.boolean(),
    source_doc: z.string().optional(),
    creditors_ref: z.string().optional(),
    checks: PaymentChecksSchema,
    evidence: ExpenseEvidenceRefSchema.optional(),
  }),
  authority: z.object({
    required_tier: z.enum(["MANAGER", "COMMITTEE", "GENERAL_MEETING"]),
    limit_applied: z.number(),
    minute_ref: z.string().optional(),
    status: z.enum(["AUTHORISED", "UNAUTHORISED", "NO_MINUTES_FOUND", "MINUTES_NOT_AVAILABLE"]),
    evidence: ExpenseEvidenceRefSchema.optional(),
  }).optional(),
});

/** Phase 3 v2: Fund classification (Admin vs Capital) */
const FundIntegritySchema = z.object({
  gl_fund_code: z.string(),
  invoice_nature: z.string(),
  classification_status: z.enum(["CORRECT", "MISCLASSIFIED", "UNCERTAIN"]),
  note: z.string().optional(),
  evidence: ExpenseEvidenceRefSchema.optional(),
});

/** Phase 3 v2: Audit Evidence Package. New fields optional for backward compat with old expense_samples. */
const ExpenseSampleSchema = z.object({
  GL_ID: z.string().optional(),
  GL_Date: z.string(),
  GL_Payee: z.string(),
  GL_Amount: TraceableValueSchema,
  Risk_Profile: ExpenseRiskProfileSchema.optional(),
  Three_Way_Match: ThreeWayMatchSchema.optional(),
  Fund_Integrity: FundIntegritySchema.optional(),
  Overall_Status: z.enum(["PASS", "FAIL", "RISK_FLAG"]).optional(),
  GL_Fund_Code: z.string().optional(),
  Source_Docs: z.object({ GL_ID: z.string(), Invoice_ID: z.string(), Minute_ID: z.string().optional() }).optional(),
  Doc_Status: z.string().optional(),
  Invoice_Status: z.string().optional(),
  Inv_Desc: z.string().optional(),
  Class_Result: z.string().optional(),
  Manager_Limit: z.number().optional(),
  Minute_Ref: z.string().optional(),
  Auth_Result: z.string().optional(),
  verification_steps: z.array(VerificationStepSchema).optional(),
});

/** Expense run – initial or additional. */
const ExpenseRunSchema = z.object({
  run_id: z.string(),
  run_type: z.enum(["initial", "additional"]),
  created_at: z.string(),
  file_paths: z.array(z.string()).optional(),
  document_ids: z.array(z.string()).optional(),
  expense_samples: z.array(ExpenseSampleSchema),
});

/** Step 0: Full Balance Sheet extract – single source of truth for Phase 2/4/5 */
const BsExtractRowSchema = z.object({
  line_item: z.string(),
  section: z.enum(["OWNERS_EQUITY", "ASSETS", "LIABILITIES"]).optional(),
  fund: z.string().optional(),
  prior_year: z.number(),
  current_year: z.number(),
});

const BsExtractSchema = z.object({
  prior_year_label: z.string(),
  current_year_label: z.string(),
  rows: z.array(BsExtractRowSchema),
});

/** Step 0: Income & Expenditure (P&L) extract – same structure as bs_extract */
const PlExtractRowSchema = z.object({
  line_item: z.string(),
  section: z.enum(["INCOME", "EXPENDITURE", "SURPLUS_DEFICIT"]).optional(),
  fund: z.string().optional(),
  prior_year: z.number(),
  current_year: z.number(),
});

const PlExtractSchema = z.object({
  prior_year_label: z.string(),
  current_year_label: z.string(),
  rows: z.array(PlExtractRowSchema),
});

/** Phase 4: bs_amount = from LOCKED bs_extract (current_year for most; prior_year for RULE 1 only); supporting_amount = from R2–R5 evidence only. */
const BalanceSheetVerificationItemSchema = z.object({
  line_item: z.string(),
  section: z.enum(["OWNERS_EQUITY", "ASSETS", "LIABILITIES"]).optional(),
  fund: z.string().optional(),
  bs_amount: z.number(),
  year_column: z.string(),
  supporting_amount: z.number().nullable().optional(), // null/empty when evidence missing; 0 only for SUBTOTAL_CHECK_ONLY
  evidence_ref: z.string(),
  status: z.enum([
    "VERIFIED",
    "VARIANCE",
    "MISSING_BANK_STMT",
    "TIER_3_ONLY",
    "MISSING_LEVY_REPORT",
    "MISSING_BREAKDOWN",
    "NO_SUPPORT",
    "GL_SUPPORTED_ONLY",
    "SUBTOTAL_CHECK_ONLY",
  ]),
  note: z.string().optional(), // bs_amount source – "From BS column 'X'"
  supporting_note: z.string().optional(), // supporting_amount source – e.g. "Matches Bank Statement p.2"
});

const GSTRecMasterSchema = z.object({
  GST_Opening_Bal: TraceableValueSchema,
  Total_GST_Raised: TraceableValueSchema,
  GST_On_Payments: TraceableValueSchema,
  GST_Theor_Mvmt: TraceableValueSchema,
  BAS_Q1: TraceableValueSchema,
  BAS_Q2: TraceableValueSchema,
  BAS_Q3: TraceableValueSchema,
  BAS_Q4: TraceableValueSchema,
  Total_BAS_Cash: TraceableValueSchema,
  GST_Calc_Closing: TraceableValueSchema,
  GST_GL_Closing: TraceableValueSchema,
  GST_Rec_Variance: TraceableValueSchema,
  GST_Materiality: z.string(),
});

const StatutoryComplianceSchema = z.object({
  insurance: z.object({
    Val_Doc_ID: z.string(),
    Ins_Doc_ID: z.string(),
    Valuation_Amount: TraceableValueSchema,
    Valuation_Date: z.string(),
    Policy_Amount: TraceableValueSchema,
    Policy_No: z.string(),
    Insurance_Gap: TraceableValueSchema,
    Insurance_Status: z.string(),
    Policy_Expiry: z.string(),
    Expiry_Status: z.string(),
  }),
  gst_reconciliation: GSTRecMasterSchema,
  income_tax: z.object({
    GL_Doc_ID: z.string(),
    Interest_Income: TraceableValueSchema,
    Other_Taxable_Income: TraceableValueSchema,
    Tax_Deductions: TraceableValueSchema,
    Net_Taxable: TraceableValueSchema,
    Calc_Tax: TraceableValueSchema,
    GL_Tax_Exp: TraceableValueSchema,
    Tax_Adj_Status: z.string(),
  }),
});

const IssueEntrySchema = z.object({
  Issue_ID: z.string(),
  Phase: z.string(),
  Description: z.string(),
  Resolution_Status: z.string(),
});

const BoundaryEntrySchema = z.object({
  Area: z.string(),
  What_Is_Missing: z.string(),
  Why_Unresolved: z.string(),
  Required_To_Resolve: z.string(),
});

const CompletionOutputsSchema = z.object({
  issue_register: z.array(IssueEntrySchema),
  boundary_disclosure: z.array(BoundaryEntrySchema),
});

/**
 * Master schema for the full Audit Response (Module 50 output).
 */
export const AuditResponseSchema = z.object({
  document_register: z.array(DocumentEntrySchema),
  intake_summary: IntakeSummarySchema,
  bs_extract: BsExtractSchema.optional(),
  pl_extract: PlExtractSchema.optional(),
  levy_reconciliation: LevyRecSchema.optional(),
  assets_and_cash: z
    .object({
      balance_sheet_verification: z.array(BalanceSheetVerificationItemSchema),
    })
    .optional(),
  expense_samples: z.array(ExpenseSampleSchema).optional(),
  expense_runs: z.array(ExpenseRunSchema).optional(),
  statutory_compliance: StatutoryComplianceSchema.optional(),
  completion_outputs: CompletionOutputsSchema.optional(),
});

export type AuditResponseValidated = z.infer<typeof AuditResponseSchema>;
