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
});

export const LevyRecMasterSchema = z.object({
  Source_Doc_ID: z.string(),
  AGM_Date: z.string(),
  Op_Arrears: TraceableValueSchema,
  Op_Advance: TraceableValueSchema,
  Net_Opening_Bal: TraceableValueSchema,
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
  Plus_Interest_Chgd: TraceableValueSchema,
  Less_Discount_Given: TraceableValueSchema,
  Plus_Legal_Recovery: TraceableValueSchema,
  Plus_Other_Recovery: TraceableValueSchema,
  Sub_Admin_Net: TraceableValueSchema,
  Sub_Sink_Net: TraceableValueSchema,
  Total_Levies_Net: TraceableValueSchema,
  GST_Admin: TraceableValueSchema,
  GST_Sink: TraceableValueSchema,
  GST_Special: TraceableValueSchema,
  Total_GST_Raised: TraceableValueSchema,
  Total_Gross_Inc: TraceableValueSchema,
  Total_Receipts_Global: TraceableValueSchema,
  Non_Levy_Income: TraceableValueSchema,
  Effective_Levy_Receipts: TraceableValueSchema,
  Calc_Closing: TraceableValueSchema,
  BS_Arrears: TraceableValueSchema,
  BS_Advance: TraceableValueSchema,
  BS_Closing: TraceableValueSchema,
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

const ExpenseSampleSchema = z.object({
  GL_Date: z.string(),
  GL_Payee: z.string(),
  GL_Amount: TraceableValueSchema,
  GL_Fund_Code: z.string(),
  Source_Docs: z.object({ GL_ID: z.string(), Invoice_ID: z.string(), Minute_ID: z.string().optional() }),
  Doc_Status: z.string(),
  Invoice_Status: z.string(),
  Inv_Desc: z.string(),
  Class_Result: z.string(),
  Manager_Limit: z.number(),
  Minute_Ref: z.string(),
  Auth_Result: z.string(),
  verification_steps: z.array(VerificationStepSchema).optional(),
});

const BalanceSheetVerificationItemSchema = z.object({
  line_item: z.string(),
  section: z.enum(["OWNERS_EQUITY", "ASSETS", "LIABILITIES"]).optional(),
  fund: z.string().optional(),
  bs_amount: z.number(),
  supporting_amount: z.number(),
  evidence_ref: z.string(),
  status: z.enum([
    "VERIFIED",
    "VARIANCE",
    "MISSING_BANK_STMT",
    "TIER_3_ONLY",
    "MISSING_LEVY_REPORT",
    "MISSING_BREAKDOWN",
    "NO_SUPPORT",
  ]),
  note: z.string().optional(),
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
  levy_reconciliation: LevyRecSchema.optional(),
  assets_and_cash: z
    .object({
      balance_sheet_verification: z.array(BalanceSheetVerificationItemSchema),
    })
    .optional(),
  expense_samples: z.array(ExpenseSampleSchema).optional(),
  statutory_compliance: StatutoryComplianceSchema.optional(),
  completion_outputs: CompletionOutputsSchema.optional(),
});

export type AuditResponseValidated = z.infer<typeof AuditResponseSchema>;
