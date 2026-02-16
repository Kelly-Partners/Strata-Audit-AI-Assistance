# Phase 3 Invoice & Payment 检查项——实施修正计划

## 目标

让每个 check 具备**可执行的验证规则**：明确「查什么」「跟谁比」「怎么算通过」，避免以推断替代基于证据的验证。

---

## 一、整体思路

| 层级 | 策略 |
|------|------|
| **Step 0 / Intake** | 补齐 Phase 3 所需的基础来源（如 scheme 银行账户、strata_plan） |
| **Prompt** | 逐项重写：来源 A + 来源 B + 判定条件 + 强制 evidence 要求 |
| **Schema** | 增加可选的「观察值」字段，倒逼模型先读后判；对关键 check 收紧 optional |
| **UI** | 对 missing / NOT_CHECKED 做明确展示，不默认当通过 |

---

## 二、分阶段实施

### Phase A：Step 0 补齐基础来源（低风险）

**目标**：为 bank_account_match 等提供明确来源。

| 变更 | 内容 |
|------|------|
| `intake_summary` 新增 | `scheme_bank_doc_ids?: string[]` |
| Step 0 prompt 新增 | 若 document_register 有 Bank Statement：<br>• 仅 1 份 → 视为 OC 账户，输出其 Document_ID 到 scheme_bank_doc_ids<br>• 多份 → 根据名称/Notes 判断哪份为 OC（如含 "Strata" / "Owners Corporation" / SP 号），输出对应 Document_ID<br>• 无法判断 → scheme_bank_doc_ids = []，并在 intake_summary 加 warning |
| 输出 | 后续 Phase 3 用 `intake_summary.scheme_bank_doc_ids` 限定 bank 证据范围 |

---

### Phase B：Invoice Checks 规则明确化

#### B1. gst_verified（重点）

**当前问题**：registered=false 易成自动打勾；registered=true 时 "amount correct" 无定义。

**修正方案**：

| 条件 | 验证规则（写入 Prompt） | 证据要求 |
|------|------------------------|----------|
| registered_for_gst = false | **必须读取发票**，确认无 GST 行/无 GST 金额。passed = 仅当发票明确无 GST。 | evidence.note 必须包含："Invoice shows: No GST" 或 "Invoice shows: GST $X (fail – plan not registered)" |
| registered_for_gst = true | (a) 发票显示 GST（含 GST 行 或 明确 GST-inclusive）；(b) **amount correct = 发票含税总价与 GL_Amount 一致（±1% 或 ±$10）**（与 amount check 共用比对对象）。 | evidence.note 必须包含："Invoice GST: [itemized/ inclusive]; Total $X vs GL $Y; match/mismatch" |

**本质**：registered=false 时禁止仅凭 status 判通过；registered=true 时 "amount correct" 明确为 **Invoice Total vs GL_Amount**。

#### B2. 其余 Invoice checks 收紧描述

在 prompt 中为每项增加**显式比对**描述：

| Check | 来源 A | 来源 B | 判定条件 |
|-------|--------|--------|----------|
| sp_number | Invoice 文档 | intake_summary.strata_plan | 发票上 SP 号与 strata_plan 一致；若 strata_plan 缺失 → 输出 UNCERTAIN，不默认 pass |
| address | Invoice 文档 | （规则：OC 抬头） | 抬头为 "The Owners - Strata Plan X" 或等效 OC；evidence.note 需引述实际抬头 |
| amount | Invoice 总金额 | GL_Amount（pl_extract / general_ledger） | 差异 ≤ ±1% 或 ±$10 |
| payee_match | Invoice 供应商名 | GL_Payee（pl_extract / general_ledger） | 名称一致或可识别为同一主体 |
| abn_valid | Invoice 文档 | （规则：11 位 ABN） | 存在 11 位 ABN；evidence.note 可写 "ABN: XXXXXXX" |

---

### Phase C：Payment Checks 规则明确化

#### C1. bank_account_match

**修正方案**：

- 使用 `intake_summary.scheme_bank_doc_ids`（Phase A 输出）
- Prompt 规则：
  - 若 scheme_bank_doc_ids 非空：仅当 payment 的 source_doc / evidence 来自其中某个 Document_ID 时 passed = true
  - 若 scheme_bank_doc_ids 为空且仅 1 份 Bank Statement：默认该文档为 scheme 账户
  - 若多份 Bank Statement 且 scheme_bank_doc_ids 为空：passed = false，evidence.note = "Cannot determine scheme account – Step 0 did not identify"

#### C2. duplicate_check

**修正方案**：在 Prompt 中定义方法。

| 项目 | 定义 |
|------|------|
| 扫描范围 | 同一 FY 内，scheme 银行账户（scheme_bank_doc_ids）的全部付款交易 |
| 当前付款 | Payee P、Amount A、Date D |
| 重复定义 | 存在另一笔：同一 Payee P、同一 Amount A、日期在 D ± 7 天内 |
| passed | 未发现上述重复 |
| evidence.note | "Scanned [N] bank transactions in FY; no duplicate (same payee/amount/±7d) found" 或 "Duplicate: [Doc_ID, date, amount]" |

#### C3. split_payment_check

**修正方案**：在 Prompt 中定义 "justified"。

| 条件 | 规则 |
|------|------|
| Risk_Profile.is_split_invoice = false | passed = true，evidence.note = "Not a split payment" |
| is_split_invoice = true | **Justified =** (a) 同一 payee 的拆分合计 ≤ manager_limit（无需批准），或 (b) Committee Minutes / AGM Minutes 有对应批准（含金额或项目描述） |
| 证据要求 | (a) 时 evidence.note 写 "Split sum $X ≤ manager_limit $Y"；(b) 时 evidence 必须引用 minutes 的 source_doc_id + page_ref |
| 无法验证 | 无 minutes 且 sum > manager_limit → passed = false |

---

### Phase D：Schema 与 Prompt 的强制约束

#### D1. 证据强制（Prompt 级）

- 所有 check 的 evidence 必须包含：`source_doc_id`、`page_ref`、`note`
- note 必须说明：比对了什么、结果如何（不能为空或含糊）

#### D2. 可选结构化字段（便于审计）

在 `InvoiceCheckItem` / `PaymentCheckItem` 中增加可选字段，用于记录观察值，便于复核：

```ts
// 可选扩展
interface InvoiceCheckItem {
  passed: boolean;
  evidence?: ExpenseEvidenceRef;
  /** 可选：模型读到的值，便于审计 */
  observed?: string;  // 如 "Invoice total $1100, GL $1100"
}
```

- 不做 schema 必填，仅在 prompt 中建议输出
- 先实现 prompt 与规则，再视需要扩展 schema

#### D3. checks 是否必填

- **方案 A（保守）**：保持 optional，但在 UI 将缺失 check 显示为 "NOT_CHECKED"，不作为通过依据
- **方案 B（激进）**：将 sp_number, address, amount, gst_verified, payee_match, abn_valid 等列为 required（有发票时）
- **建议**：先做方案 A，待模型稳定后再考虑 B

---

### Phase E：UI 行为调整

| 场景 | 当前 | 修正后 |
|------|------|--------|
| 无 checks | 用 addressed_to_strata、payee_match 等 fallback | 显示 "NOT_CHECKED"，不当作 PASS |
| checks 存在但某子项缺失 | 可能被忽略 | 对该子项显示 "—" 或 "NOT_CHECKED"，不计入通过 |
| Invoice 通过判定 | 依赖 fallback 或部分 checks | 仅当所有**已输出**的 checks 均 passed 时，才显示 PASS；缺失项单独标注 |

---

## 三、实施优先级与依赖

| 阶段 | 内容 | 依赖 | 风险 |
|------|------|------|------|
| **A** | Step 0 增加 scheme_bank_doc_ids | 无 | 低 |
| **B** | Invoice 各 check 规则（含 gst_verified） | 无 | 低 |
| **C** | Payment 各 check 规则 | A | 低 |
| **D** | Schema 扩展、evidence 强制 | 无 | 低 |
| **E** | UI NOT_CHECKED 逻辑 | D（可选） | 低 |

**建议顺序**：A → B → C（可并行 B/C）→ D → E

---

## 四、验收标准（示例）

- **gst_verified**：registered=false 时，若 passed，evidence.note 必须包含对发票 GST 状态的明确描述
- **bank_account_match**：多份银行对账单场景下，仅当 payment 来自 scheme_bank_doc_ids 内文档时可为 passed
- **duplicate_check**：evidence.note 必须说明扫描的交易数量及结论
- **split_payment_check**：is_split_invoice=true 时，passed 必须附带 minutes 引用或 sum ≤ manager_limit 的说明

---

## 五、后续可扩展

- 将上述规则抽取为 `phase_3_rules.ts`，与 Phase 1/2/4 规则风格统一
- 对 "equivalent OC"、"同一主体" 等模糊点做术语表（Glossary）
- 若后续有 TB/BAS 等结构化数据，可将 gst_verified 的 "amount correct" 扩展为与 BAS 比对
