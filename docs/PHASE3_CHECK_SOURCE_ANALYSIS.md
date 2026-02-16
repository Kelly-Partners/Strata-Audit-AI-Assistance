# Phase 3 Expenses Vouching – 各 Check 的「查的是什么」深度分析

## 问题

每个 check 维度到底在验证什么？比对来源是否明确？是否存在「用推理代替验证」的逻辑漏洞？

以 gst_verified 为例：查的是 TB？GL？还是 "not registered for GST therefore tick as green"？

---

## 一、gst_verified 专项分析

### Prompt 定义

> gst_verified: Use intake_summary.registered_for_gst (LOCKED). If registered → invoice shows GST component and amount correct; if not registered → no GST on invoice. passed = true if consistent.

### 来源拆解

| 条件 | 应验证内容 | 实际比对来源 | 问题 |
|------|------------|--------------|------|
| registered_for_gst = true | Invoice 有 GST 且金额正确 | Invoice PDF vs ? | **「amount correct」无定义**：正确是相对谁？TB？GL？BAS？仅发票内部一致性？ |
| registered_for_gst = false | Invoice 无 GST | Invoice PDF | **易成「自动打勾」**：只要 Plan 未注册 GST，即可判 passed，不强制从发票逐项读取 |

### registered_for_gst 本身从哪来？

- Step 0：扫描 bs_extract.rows，看是否有 GST 相关 line_item
- 来源：Balance Sheet（FS），非 TB / GL / BAS
- 若 BS 无 GST 行 → registered_for_gst = false

### 漏洞归纳

1. **registered = false 时**：逻辑等价于「Plan 未注册 → 认为无 GST 要求 → 直接 passed」，模型可能不做任何发票检查。
2. **registered = true 时**：「amount correct」未指定比对对象：
   - 不是 TB（未要求比对 TB）
   - 不是 GL（未要求比对 GL）
   - 未要求比对 BAS
   - 可能被理解为「发票内部算术一致」或「看起来有 GST 即可」，缺乏可审计的明确规则。

---

## 二、Invoice checks 逐项来源与漏洞

| Check | Prompt 定义 | 比对来源 A | 比对来源 B | 漏洞 |
|-------|-------------|-----------|-----------|------|
| **sp_number** | Invoice 显示 SP 号且与 strata_plan 一致 | Invoice PDF | intake_summary.strata_plan | 来源明确；若 strata_plan 缺失，可被推断 |
| **address** | Invoice 抬头为 OC | Invoice PDF | （无外部比对） | 来源明确；"equivalent OC" 可能被宽泛解释 |
| **amount** | Invoice 金额与 GL_Amount 一致（±1%/±$10） | Invoice PDF | GL_Amount（来自 pl_extract/GL） | GL 为 Tier 3，用于断言；比对关系清晰，但 pl_extract 行级匹配规则未细化 |
| **gst_verified** | 见上 | Invoice PDF | intake_summary.registered_for_gst | 见上；「amount correct」无定义 |
| **payee_match** | GL Payee 与 Invoice Payee 一致 | GL（pl_extract） | Invoice PDF | 来源明确；GL 为 Tier 3 |
| **abn_valid** | ABN 存在且 11 位 | Invoice PDF | （无外部比对） | 来源明确 |

---

## 三、Payment checks 逐项来源与漏洞

| Check | Prompt 定义 | 比对来源 A | 比对来源 B | 漏洞 |
|-------|-------------|-----------|-----------|------|
| **bank_account_match** | 款项来自 scheme 银行账户 | Bank Statement (Tier 1) | 「scheme 账户」定义 | **来源 B 未定义**：如何确定哪些为 OC 账户、哪些为 manager/personal？多份银行对账单时如何区分？ |
| **payee_match** | 银行付款对象与 GL/Invoice 一致 | Bank Statement | GL_Payee 或 Invoice Payee | 来源明确 |
| **duplicate_check** | 无重复付款 | Bank Statement（全期） | 同 supplier/amount/日期 | **方法未定义**：是否需扫全 bank statement？跨多个账户？跨多笔交易？未指定 |
| **split_payment_check** | 非拆单或拆单已获批准 | Risk_Profile.is_split_invoice | Bank + ? | **「justified」未定义**：需 minutes？Manager 批准？仅靠模型推断 |
| **amount_match** | Bank 金额与 GL 一致（±1%/±$10） | Bank Statement | GL_Amount | 来源明确 |
| **date_match** | 付款日在 GL Date ±14 天 | Bank Statement | GL_Date | 来源明确 |

---

## 四、共性问题（所有维度）

### 1. 比对基准未写清

- 多个 check 依赖「与某物一致」，但未明确该「某物」的文档、位置、字段。
- 例：gst_verified 的 "amount correct"；bank_account_match 的 "scheme's bank account"；split_payment_check 的 "justified"。

### 2. 易被「推断」替代「验证」

- 若 registered_for_gst = false → 可推断「无需查 GST」→ 直接 passed。
- 若文档缺失或难读 → 可能用「应有」「通常」替代逐项证据。

### 3. 证据层级混用

- amount / payee_match 等用 GL（Tier 3）作为断言来源，属合理 vouching。
- 但 bank_account_match 的 "scheme account"、gst_verified 的 "correct" 未指定层级和来源，易产生不一致。

### 4. 方法论未指定

- duplicate_check：未说明扫描范围、匹配规则、容差。
- split_payment_check：未说明批准证据类型、层级。

---

## 五、结论

**是的，invoice 与 payment 各 check 维度普遍存在同类问题：**

1. **gst_verified**：registered = false 时易变成「自动打勾」；registered = true 时「amount correct」无明确比对对象（TB/GL/BAS/发票内算术均未规定）。
2. **bank_account_match**：「scheme's bank account」来源未定义。
3. **duplicate_check**：验证范围与方法未定义。
4. **split_payment_check**：「justified」的证据要求未定义。
5. 其他 check（sp_number, address, amount, payee_match, abn_valid, amount_match, date_match）在「比对什么」上相对清晰，但仍存在边界模糊（如 strata_plan 缺失、address 等价形式等）。

**本质问题**：多个 check 的「验证规则」停留在自然语言描述，缺少可执行的「来源 + 比对逻辑 + 证据层级」规范，容易导致以推断替代基于证据的验证。
