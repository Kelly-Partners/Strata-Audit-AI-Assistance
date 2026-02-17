# Phase 3 全面 Review 报告

## 一、Prompt

### 1.1 EXPENSE_RISK_FRAMEWORK (phase_3_expenses.ts)

| 项目 | 状态 | 说明 |
|------|------|------|
| Invoice STEP 1-6 | ✓ | 逻辑完整，observation-first |
| Payment PAID P1-P4 | ✓ | 搜索方法、观察值、checks 定义清晰 |
| Payment ACCRUED A1-A3 | ✓ | 观察值、checks（含 ageing、subsequent） |
| reference_traceable | ✓ | FAIL/RISK_FLAG 规则明确 |

### 1.2 遗漏 / 不一致

**① 无发票时的 invoice 输出**

- 问题：当 GL item 找不到 Tier 1 发票时，未定义如何输出 invoice
- 建议：在 prompt 中补充："If no Tier 1 invoice document found for this GL item: set invoice.id = '', date = '', and for each check set passed = false with note 'No invoice document found'. Invoice validity = FAIL."

**② payment 为 MISSING 时的 checks**

- 问题：status = "MISSING"（既无 Bank 也无 Creditors）时，是否仍需输出 payment.checks？若输出，9 个 check 应如何填充？
- 建议：明确 "When status = MISSING: output all 9 checks with passed = false and note explaining 'No payment evidence – neither Bank nor Creditors found'."

**③ Overall_Status 的 FAIL 条件不完整**

- 当前 PHASE_3_EXPENSES_PROMPT (line 109): `"FAIL" = any of: any invoice check failed, payment MISSING, MISCLASSIFIED`
- 缺少：**payment CRITICAL check failed** 也应触发 FAIL
- 建议：改为 `"FAIL" = any of: any invoice check failed, payment MISSING, payment CRITICAL check failed (bank_account_match, payee_match, amount_match, duplicate_check, split_payment_check), MISCLASSIFIED`

**④ RISK_FLAG 条件不完整**

- 当前：`"RISK_FLAG" = BANK_STMT_MISSING or UNCERTAIN fund`
- 缺少：date_match 超出容差、ageing >90d、subsequent_payment missing 也会触发 RISK_FLAG
- 建议：补充 `or payment RISK_FLAG (date_match outside, ageing >90d, subsequent_payment missing)`

**⑤ payment.amount_match 顶层同步**

- 旧 prompt 曾要求 "Top-level amount_match must stay in sync"
- 当前已删除，但 type_definitions 中 `payment.amount_match: boolean` 仍存在
- 建议：在 OUTPUT 中明确 "payment.amount_match (top-level) must equal checks.amount_match.passed"

---

### 1.3 Additional Run 缺少完整 Framework

**问题**：`buildExpensesAdditionalPrompt()` 仅包含 `PHASE_3_ADDITIONAL_PROMPT + PHASE_3_FUND_INTEGRITY`，**未包含 EXPENSE_RISK_FRAMEWORK**。

- 影响：Additional run 只引用 "re-execute STEP B"，但 STEP B 的详细规则（Invoice STEP 1-6、Payment P1-P4 等）在 EXPENSE_RISK_FRAMEWORK 中
- MODULE_50 虽有 checks 要求，但缺少 invoice/ payment 的逐步执行逻辑
- 建议：在 `buildExpensesAdditionalPrompt()` 中增加 `EXPENSE_RISK_FRAMEWORK`，保证 Additional run 与 Initial run 使用同一套 check 逻辑

---

## 二、Schema

### 2.1 一致性

| 层级 | InvoiceChecks | PaymentChecks | 状态 |
|------|---------------|---------------|------|
| type_definitions | 6 项 required | 9 项 required | ✓ |
| schema_definitions (Zod) | 6 项 required | 9 项 required | ✓ |
| output_registry JSON | 6 项 | 9 项 | ✓ |

### 2.2 潜在问题

**① Three_Way_Match 与 ExpenseSample 的 optional**

- `ExpenseSample.Three_Way_Match?: ThreeWayMatch` 为 optional
- 当 `Three_Way_Match` 存在时，`invoice.checks` 和 `payment.checks` 在 schema 中为 required
- 旧数据可能 `Three_Way_Match` 存在但 `checks` 缺失或不全
- 结论：UI 用 `.filter((k) => checks[k] != null)` 处理，可兼容；schema 严格性主要用于新输出

**② 无 lenient parse 路径**

- Zod 对 expense_samples 做严格校验时，旧数据（6 个 payment checks、缺 observed 等）会失败
- 当前 geminiService 使用 `JSON.parse`，不做 Zod 校验，故不影响
- 若未来增加 Zod 校验，需考虑 lenient 或 migrate 逻辑

---

## 三、UI

### 3.1 Forensic Popover

| 项目 | 状态 |
|------|------|
| Invoice CHECK_LABELS | 6 项一致 ✓ |
| Payment PAY_CHECK_LABELS | 9 项一致 ✓ |
| subChecks 数组 key 顺序 | 与 schema 一致 ✓ |
| observed 展示 | 有 ✓ |

### 3.2 Invoice 徽章 fallback（逻辑漏洞）

- 当前：`keys.length > 0 ? keys.every(...) : (inv.addressed_to_strata && inv.payee_match)`
- 问题：当 checks 缺失时，仍用 `addressed_to_strata && payee_match` 判通过，可能误显示 ✅
- 建议（按 PHASE3_REMEDIATION_PLAN）：`keys.length === 0` 时显示 `–` 或 `?`（NOT_CHECKED），不显示 ✅

### 3.3 Payment 徽章

- 当 checks 缺失：fallback 为 `(pay.status === 'PAID' || pay.status === 'ACCRUED') && pay.amount_match`，或仅看 status
- 问题：未考虑 payment CRITICAL check 失败；且 `pay.amount_match` 在 ACCRUED 时可能未正确同步
- 建议：与 Invoice 一致，checks 缺失时显示 `–` 或 `?`，不做乐观 fallback

---

## 四、Output Registry

### 4.1 一致点

- EXPENSE_SAMPLES 引用 EXPENSE_RISK_FRAMEWORK ✓
- INVOICE & PAYMENT CHECKS – REQUIRED 覆盖 6+9 项 ✓
- JSON schema 片段包含所有 checks ✓

### 4.2 术语

- "or equivalent Aged Payables report" 与 step_0 的 Document_Type "Creditors Report" 一致 ✓

---

## 五、Workflow / Coding

### 5.1 call2_phase_prompts

- `buildExpensesPrompt()` 正确组装：EXPENSE_RISK_FRAMEWORK + PHASE_3_FUND_INTEGRITY + PHASE_3_EXPENSES_PROMPT ✓
- `buildExpensesAdditionalPrompt()` 缺少 EXPENSE_RISK_FRAMEWORK（见 1.3）

### 5.2 expenseRunsHelpers

- `buildCombinedExpenseSamples`：按 GL_ID 覆盖，逻辑正确 ✓
- `getEffectiveExpenseSamples`：优先 expense_runs ✓
- 无对 checks 结构的假设 ✓

### 5.3 其他

- step_0 Document_Type "Creditors Report" → Tier 2，与 prompt 一致 ✓

---

## 六、Bug 汇总

| # | 严重度 | 描述 |
|---|--------|------|
| 1 | 高 | Additional Run 未注入 EXPENSE_RISK_FRAMEWORK，check 逻辑可能不一致 |
| 2 | 中 | Overall_Status FAIL 条件缺少 "payment CRITICAL check failed" |
| 3 | 中 | RISK_FLAG 条件缺少 payment 相关（date_match、ageing、subsequent） |
| 4 | 中 | Invoice 徽章：checks 缺失时 fallback 判通过，可能误显示 ✅ |
| 5 | 低 | 无发票 / payment MISSING 时，invoice 与 payment 输出未在 prompt 中明确 |
| 6 | 低 | payment.amount_match 与 checks.amount_match 同步规则未在 prompt 中写清 |

---

## 七、建议修复优先级（已实施 2025-02-01）

1. **P0** ✓ 在 buildExpensesAdditionalPrompt 中增加 EXPENSE_RISK_FRAMEWORK
2. **P1** ✓ 修正 Overall_Status 的 FAIL / RISK_FLAG 条件
3. **P2** ✓ UI Invoice/Payment 徽章：checks 缺失时显示 '–'，不再用乐观 fallback
4. **P3** ✓ 在 prompt 中补充无发票、MISSING 时的输出规则及 amount_match 同步规则
