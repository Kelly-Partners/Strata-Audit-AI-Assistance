# Step 0 扩展分析：为 Levy / BS Verification / Expenses 提供更有效信息

## 一、现状

Step 0 当前输出：
- **document_register**：Doc_ID、Origin_Name、Document_Name、Document_Type、Page_Range、Evidence_Tier、Relevant_Phases、Notes
- **intake_summary**：total_files、missing_critical_types、status、strata_plan、financial_year

Phase 2/4/3 在 Call 2 中需要从 PDF 中**自行定位**证据来源，易出现：
- 列锚定错误（Prior Year / Current Year 颠倒）
- supporting_amount 用错来源（GL + BS 代替 Bank Stmt / Levy Report）
- 漏行、漏证据类型

---

## 二、各 Phase 需要的关键信息

### 2.1 Levy Check (Phase 2)

| 需求 | 当前 Step 0 是否有 | 缺口 | 建议 Step 0 输出 |
|------|---------------------|------|-------------------|
| FY（审计期间） | ✅ intake_summary.financial_year | 格式可能不一致 | 保持；可增加 `fy_end_date`（如 "30/06/2025"）便于列锚定 |
| 列锚定 | ❌ | AI 易把 Prior/Current 列用反 | **bs_column_mapping**：`current_year_label`（如 "30 Jun 2025"）、`prior_year_label`（如 "30 Jun 2024"） |
| Balance Sheet 位置 | ⚠️ 仅知 Financial Statement | FS 常含 P&L+BS+Notes，不知 BS 具体页 | **core_data_positions.balance_sheet**：`doc_id`、`page_range`（如 "Pages 5-7"） |
| Opening/Closing 来源 | ❌ | 规则已写明用 BS，但不知道 BS 在哪 | 同上，BS 位置明确后 Levy 直接去该处取数 |
| Levy Receipts 来源 | ⚠️ document_register 有 Doc Type | 不知道哪个 doc 是 Admin Fund receipts、哪个是 Capital Fund receipts | **core_data_positions.levy_receipts**：`admin_fund_doc_id`、`admin_fund_page_range`、`capital_fund_doc_id`、`capital_fund_page_range`；若为同一报告，可 `combined_doc_id` + 说明 |
| Minutes 位置（Old/New Rate） | ⚠️ 有 AGM Minutes | 不知 Levy 采纳日、费率所在的页/段落 | **core_data_positions.minutes_levy**：`doc_id`、`page_ref`（如 "Page 3, Levy Resolution"） |

**小结**：Levy 最依赖 (1) BS 精确位置与列标签；(2) Admin / Capital 收款报告的具体文档与页码。

---

### 2.2 Balance Sheet Verification (Phase 4)

| 需求 | 当前 Step 0 是否有 | 缺口 | 建议 Step 0 输出 |
|------|---------------------|------|-------------------|
| Balance Sheet 位置 | ❌ | 同上 | **core_data_positions.balance_sheet** |
| BS 行项结构 | ❌ | 易漏行、易用错来源 | **bs_structure**：`[{ line_item, section, fund }]`，按 FS 上的顺序列出所有行 |
| Current Year 列 | ❌ | 易用 Prior 列填 bs_amount | **bs_column_mapping** |
| 证据→行项映射 | ❌ | supporting_amount 常误用 GL/BS | **evidence_map**：如 `Cash at Bank → Bank Statement (Doc_X)`，`Levy Arrears → Levy Position Report (Doc_Y)` |
| Bank Statement 位置 | ⚠️ document_register | 不知 FYE 对应的 BS 在哪份、哪页 | **core_data_positions.bank_statement**：`doc_id`、`page_range`、`as_at_date`（若可识别） |
| Levy Report 位置 | ⚠️ document_register | 同上 | **core_data_positions.levy_report**：`doc_id`、`page_range` |

**小结**：Phase 4 最需要 (1) BS 精确位置；(2) BS 行项结构表；(3) 每类证据对应的文档引用，减少“用 GL/BS 解释 BS”的污染。

---

### 2.3 Expenses Vouching (Phase 3)

| 需求 | 当前 Step 0 是否有 | 缺口 | 建议 Step 0 输出 |
|------|---------------------|------|-------------------|
| General Ledger 位置 | ⚠️ document_register | 不知 GL 页范围、费用相关部分 | **core_data_positions.general_ledger**：`doc_id`、`page_range`、可选 `expense_pages` |
| Invoice 类型文档 | ⚠️ Tax Invoice / Invoice | 多份发票时不知如何映射 | 可保持 document_register，或增加 `invoice_doc_ids[]` |
| Minutes（授权限额） | ⚠️ Committee Minutes | 不知 Manager Limit 所在位置 | **core_data_positions.minutes_auth**：`doc_id`、`page_ref` |
| 费用账户/ Fund 结构 | ❌ | 抽样策略依赖 | 可选：`gl_expense_accounts` 或 `fund_codes`（若 Step 0 能识别） |

**小结**：Phase 3 优先需要 GL 和 Minutes 中授权限额的精确定位。

---

## 三、建议 Step 0 扩展输出结构

在现有 `document_register`、`intake_summary` 基础上，增加 **core_data_positions** 和可选 **bs_structure** / **bs_column_mapping**：

```ts
// 新增 / 扩展
core_data_positions: {
  balance_sheet: { doc_id: string; page_range: string };           // BS 所在文档与页
  bank_statement: { doc_id: string; page_range: string; as_at_date?: string } | null;
  levy_report: { doc_id: string; page_range: string } | null;      // Tier 2 Levy Position
  levy_receipts_admin: { doc_id: string; page_range: string } | null;
  levy_receipts_capital: { doc_id: string; page_range: string } | null;
  general_ledger: { doc_id: string; page_range: string } | null;
  minutes_levy: { doc_id: string; page_ref: string } | null;       // Old/New Rate
  minutes_auth: { doc_id: string; page_ref: string } | null;       // Manager Limit
}

bs_column_mapping?: {  // 当 BS 有双列时
  current_year_label: string;   // 与 FYE 对应的列
  prior_year_label: string;
}

bs_structure?: Array<{  // 可选：BS 行项结构，便于 Phase 4 完整性
  line_item: string;
  section: "OWNERS_EQUITY" | "ASSETS" | "LIABILITIES";
  fund?: string;
}>;
```

---

## 四、信息优先级（实施建议）

| 优先级 | 信息 | 主要受益 Phase | 实现难度 |
|--------|------|----------------|----------|
| **P0** | core_data_positions.balance_sheet | Levy, BS Verification | 中 |
| **P0** | bs_column_mapping（current_year_label, prior_year_label） | Levy, BS Verification | 中 |
| **P1** | core_data_positions.bank_statement | BS Verification | 低 |
| **P1** | core_data_positions.levy_report | BS Verification | 低 |
| **P1** | core_data_positions.levy_receipts_admin / capital | Levy | 中 |
| **P2** | bs_structure（行项列表） | BS Verification（完整性） | 高 |
| **P2** | core_data_positions.general_ledger | Expenses | 低 |
| **P2** | core_data_positions.minutes_levy / minutes_auth | Levy, Expenses | 低 |

**建议**：先落地 P0 + P1，再视效果决定是否做 P2。

---

## 五、AI 理解信息的方式

- **显式引用**：Step 0 输出 `doc_id` + `page_range` 后，Phase 2/4/3 的 prompt 可写“直接使用 core_data_positions 中的位置，不要重新搜索”。
- **列标签**：提供 `current_year_label` 后，可用自然语言约束：“仅使用表头为 {current_year_label} 的列”。
- **行项列表**：`bs_structure` 可作为 Phase 4 的检查表，逐项验证、避免漏行。
- **证据映射**：可后续扩展为 `evidence_map: { "Cash at Bank": "Sys_002", "Levy Arrears": "Sys_003" }`，进一步约束 supporting_amount 来源。

---

## 六、与两阶段架构的衔接

- Step 0 扩展后，Call 2（Levy + BS Verification + Expenses）的 prompt 应注入 Step 0 的**完整输出**，并写明：
  - *"You MUST use core_data_positions as the authoritative source for document/page locations. Do NOT re-locate these."*
- 这样 Call 2 中的 AI 主要做“取数 + 验证”，而不是“定位 + 取数”，有助于减少列锚定和 supporting_amount 来源错误。

---

*本分析为设计文档，不包含代码修改。*
