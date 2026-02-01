# Prompt 调用、Output 输出、Schema 定义一致性检查报告

## 1. Prompt 调用链

```
App.tsx
  └─ callExecuteFullReview() from services/gemini.ts
       └─ buildSystemPrompt() from src/audit_engine
       └─ body: { systemPrompt, fileManifest, files, ... }
  └─ POST → Cloud Function executeFullReview

functions/index.js
  └─ body.systemPrompt 必须存在
  └─ executeFullReview({ apiKey, systemPrompt, fileManifest, files, previousAudit })

functions/geminiReview.js
  └─ config.systemInstruction = systemPrompt  (作为 Gemini system prompt)
  └─ userInstruction = 附加指令 (INSTRUCTIONS 1-5 + 增量更新逻辑)
  └─ responseMimeType: "application/json"
```

**结论:** ✅ 调用链一致。前端 `buildSystemPrompt()` 生成的 system prompt 完整传入 Cloud Function，并作为 Gemini 的 systemInstruction。

---

## 2. buildSystemPrompt 拼接顺序

```
1. HIERARCHY_INTRO
2. EVIDENCE_RULES_PROMPT
3. HIERARCHY_AFTER_EVIDENCE
4. STEP_0_INTAKE_PROMPT
5. PHASE_1_VERIFY_PROMPT
6. PHASE_1_RULES_PROMPT
7. PHASE_2_REVENUE_PROMPT
8. PHASE_2_RULES_PROMPT
9. PHASE_4_ASSETS_PROMPT      ← Phase 4 在 Phase 3 之前
10. PHASE_4_RULES_PROMPT
11. PHASE_3_EXPENSES_PROMPT
12. PHASE_5_COMPLIANCE_PROMPT
13. MODULE_50_OUTPUTS_PROMPT
```

**注意:** Phase 4 在 Phase 3 之前注入，可能是刻意设计（Balance Sheet 验证优先于费用抽样）。若需 Phase 3 先于 Phase 4，需调整 `audit_engine/index.ts`。

---

## 3. Output 结构一致性

### 3.1 顶层结构

| 字段 | output_registry (prompt) | type_definitions | schema_definitions (Zod) | 前端使用 |
|------|--------------------------|------------------|--------------------------|----------|
| document_register | ✅ | ✅ DocumentEntry[] | ✅ DocumentEntrySchema[] | AuditReport |
| intake_summary | ✅ | ✅ IntakeSummary | ✅ IntakeSummarySchema | AuditReport |
| levy_reconciliation | ✅ | ✅ LevyReconciliation? | ✅ LevyRecSchema.optional() | Table E.Master |
| assets_and_cash | ✅ | ✅ AssetsAndCash? | ✅ optional | Table C.3 |
| expense_samples | ✅ | ✅ ExpenseSample[]? | ✅ optional | Table I.1 |
| statutory_compliance | ✅ | ✅ StatutoryCompliance? | ✅ optional | 多表 |
| completion_outputs | ✅ | ✅ CompletionOutputs? | ✅ optional | issue_register, boundary_disclosure |

**结论:** ✅ 顶层结构一致。

---

### 3.2 document_register

| 字段 | output_registry | type_definitions | schema_definitions |
|------|-----------------|------------------|--------------------|
| Document_ID | ✅ | ✅ | ✅ |
| Document_Origin_Name | ✅ | ✅ | ✅ |
| Document_Name | ✅ | ✅ | ✅ |
| Document_Type | ✅ | ✅ | ✅ |
| Page_Range | ✅ | ✅ | ✅ |
| Evidence_Tier | ✅ | ✅ | ✅ |
| Relevant_Phases | ✅ | ✅ | ✅ |
| Notes | ✅ (optional) | ✅ optional | ✅ optional |

**结论:** ✅ 一致。

---

### 3.3 intake_summary

| 字段 | output_registry | type_definitions | schema_definitions |
|------|-----------------|------------------|--------------------|
| total_files | ✅ | ✅ | ✅ |
| missing_critical_types | ✅ | ✅ | ✅ |
| status | ✅ | ✅ | ✅ |
| strata_plan | ✅ | ✅ optional | ✅ optional |
| financial_year | ✅ | ✅ optional | ✅ optional |

**结论:** ✅ 一致。

---

### 3.4 levy_reconciliation.master_table (TraceableValue)

| 字段 | output_registry | type_definitions | schema_definitions |
|------|-----------------|------------------|--------------------|
| amount | ✅ | ✅ | ✅ |
| source_doc_id | ✅ | ✅ | ✅ |
| page_ref | ✅ | ✅ | ✅ |
| note | ✅ | ✅ optional | ✅ optional |
| verbatim_quote | ✅ (部分字段) | ✅ optional | ✅ optional |
| computation | ✅ (计算字段) | ✅ optional | ✅ optional |

**结论:** ✅ 一致。TraceableValue 在 levy master_table 各字段中结构统一。

---

### 3.5 assets_and_cash.balance_sheet_verification

| 字段 | output_registry | type_definitions | schema_definitions | 前端 AuditReport |
|------|-----------------|------------------|--------------------|------------------|
| line_item | ✅ | ✅ | ✅ | ✅ |
| section | OWNERS_EQUITY\|ASSETS\|LIABILITIES | OWNERS_EQUITY \| ASSETS \| LIABILITIES | enum 同 | ✅ SECTION_ORDER |
| fund | Admin\|Capital\|N/A | string? | string? | ✅ |
| bs_amount | Number | number | number | ✅ ForensicCell(bsTrace) |
| supporting_amount | Number | number | number | ✅ ForensicCell(supTrace) |
| evidence_ref | Doc_ID/Page | string | string | ✅ 解析为 srcId/pageRef |
| status | VERIFIED\|VARIANCE\|... | 7 种 enum | 7 种 enum | ✅ StatusBadge |
| note | AI explanation | string? | string? | ✅ |

**结论:** ✅ 一致。section 枚举 `OWNERS_EQUITY` 在 prompt、types、schema、UI 中统一。

---

### 3.6 expense_samples

| 字段 | output_registry | type_definitions | schema_definitions |
|------|-----------------|------------------|--------------------|
| Source_Docs | GL_ID, Invoice_ID | + Minute_ID? | + Minute_ID? |
| verification_steps | ✅ | ✅ optional | ✅ optional |

**结论:** ✅ 一致。Minute_ID 为可选扩展，不影响兼容。

---

## 4. 潜在不一致点

### 4.1 functions/auditResponseSchema.json

- **用途:** 目前 **未** 被 `geminiReview.js` 使用（注释写 "不传 responseJsonSchema"）。
- **intake_summary:** `additionalProperties: false` 且未定义 `strata_plan`、`financial_year`，若用此 schema 校验，会拒绝这两个字段。
- **建议:** 若仅作文档/离线校验，可保留；若计划用于运行时校验，需同步 `output_registry` 与 `type_definitions` 的完整结构。

### 4.2 Phase 顺序

- `buildSystemPrompt` 中 Phase 4 在 Phase 3 之前。
- 若业务要求 Phase 3 → Phase 4 顺序，需调整 `audit_engine/index.ts`。

### 4.3 types.ts 导出遗留类型

- `types.ts` 导出 `BankReconciliation`, `FundIntegrity`, `Investment`，但 `type_definitions.ts` 中未定义。
- 若这些类型不再使用，建议从 `types.ts` 中移除；否则需在 `type_definitions.ts` 中补充定义。

---

## 5. 总结

| 检查项 | 状态 |
|--------|------|
| Prompt 调用链 | ✅ 一致 |
| buildSystemPrompt 拼接 | ✅ 正确 |
| output_registry ↔ type_definitions | ✅ 一致 |
| output_registry ↔ schema_definitions | ✅ 一致 |
| type_definitions ↔ 前端消费 | ✅ 一致 |
| Cloud Function userInstruction ↔ output_registry | ✅ 对齐 |
| auditResponseSchema.json | ⚠️ 未使用，与主 schema 部分不同步 |

**整体结论:** Prompt、Output、Schema 定义在主流程中保持一致。`auditResponseSchema.json` 若需用于校验，应同步更新。
