# Phase 3 Expenses Vouching 客观分析

## 一、检索范围

- `src/audit_engine/workflow/phase_3_expenses.ts`（EXPENSE_RISK_FRAMEWORK）
- `src/audit_outputs/schema_definitions.ts`（InvoiceChecks, PaymentChecks）
- `src/audit_outputs/output_registry.ts`（MODULE 50）
- `src/audit_engine/kernel/20_evidence_rules.ts`（Evidence Tier）
- `src/services/expenseRunsHelpers.ts`（buildCombinedExpenseSamples）
- `components/AuditReport.tsx`（INV/PAY 徽章逻辑）
- `functions/geminiReview.js`（Call 2 注入）

---

## 二、Prompt 要求 vs Schema 约束

### 2.1 Invoice

| Prompt 要求 | Schema | 实际约束 |
|-------------|--------|----------|
| 必须输出 checks：sp_number, address, amount, gst_verified, payee_match, abn_valid | `InvoiceChecksSchema` 中 6 项均为 `.optional()` | 模型可完全不输出 checks |
| "Invoice validity = PASS only if **ALL available** checks pass" | - | "available" 无明确定义；若无 checks，则无可用项，语义不清 |
| "If any check fails, treat invoice as FAIL" | - | 依赖模型输出 checks；不输出则无从判断 |

### 2.2 Payment

| Prompt 要求 | Schema | 实际约束 |
|-------------|--------|----------|
| 必须输出 checks：bank_account_match, payee_match, duplicate_check, split_payment_check, amount_match, date_match | `PaymentChecksSchema` 中 6 项均为 `.optional()` | 模型可完全不输出 checks |
| "FAIL if bank_account_match, payee_match, amount_match, duplicate_check, or split_payment_check fails" | - | 同上，依赖 checks 存在 |
| "date_match failure -> RISK_FLAG" | - | 同上 |

### 2.3 Overall_Status

- Prompt：PASS = Invoice valid + (PAID 或 ACCRUED) + CORRECT fund
- Schema：`Overall_Status` 为必填 enum
- 问题：当 checks 缺失时，“invoice valid” 的判定完全由模型自行解释，缺乏硬性规则

---

## 三、UI 显示逻辑（AuditReport.tsx）

### 3.1 INV 列徽章（约 1983–1990 行）

```tsx
const keys = c ? [...] : [];
const allPassed = keys.length > 0
  ? keys.every((k) => c![k]!.passed)
  : (inv.addressed_to_strata && inv.payee_match);  // ← fallback
return allPassed ? '✅' : '⚠';
```

- **有 checks**：按所有 checks 的 passed 决定 ✅ / ⚠
- **无 checks**：只看 `addressed_to_strata && payee_match` → 其余 4 项（sp_number, amount, gst_verified, abn_valid）不参与判定，极易显绿

### 3.2 PAY 列徽章（约 1995–2003 行）

```tsx
const keys = c ? [...] : [];
const allPassed = keys.length > 0 ? ... : (pay.status === 'PAID' || pay.status === 'ACCRUED') && pay.amount_match;
if (keys.length > 0) return allPassed ? '✅' : '⚠';
return pay.status === 'PAID' ? '✅' : pay.status === 'ACCRUED' ? '⏳' : '❌';  // ← 实际走这里
```

- **有 checks**：按 checks 的 passed 决定 ✅ / ⚠
- **无 checks**：**完全忽略 `allPassed`**，只根据 `status` 决定：
  - PAID → ✅
  - ACCRUED → ⏳
  - 其余 → ❌
- 因此：PAID 时即使 `amount_match === false`，仍显示 ✅

---

## 四、追加 run 覆盖逻辑（expenseRunsHelpers.ts）

```ts
// 按 GL_ID，后 run 覆盖前 run
if (idx !== undefined) list[idx] = s;  // 覆盖
```

- 后一次 run 中同一 GL_ID 的结果会覆盖前一次
- 若第一次为 FAIL（如 BANK_STMT_MISSING），第二次补充证据后模型给出 PASS，会正确覆盖
- 若模型在第二次错误地输出 PASS（如证据仍不足），会直接覆盖掉原来的 FAIL，无“原始失败记录”保留

---

## 五、回答你的问题

> 我觉得 expenses vouching 条件过宽，并没有真正的做 check

**结论：是的，整体条件偏宽，很多地方并未真正执行细粒度 check。**

### 1. Schema 允许不做 check

- `invoice.checks`、`payment.checks` 均为 optional
- 模型可以完全不输出 checks，只输出 status、amount_match 等粗粒度字段
- 此时既没有可验证的细粒度结果，也无法依据 checks 做后处理校验

### 2. UI 在无 checks 时的宽松 fallback

- **INV**：无 checks 时只看 `addressed_to_strata && payee_match`，sp_number、amount、gst、ABN 等完全不参与
- **PAY**：无 checks 时只看 status，PAID 直接显示 ✅，**忽略 amount_match**
- 因此，即便模型输出的 checks 信息不足，UI 也会倾向于显示“通过”

### 3. Prompt 与 Schema 不一致

- Prompt 强调 checks 和 FAIL 条件，但 Schema 未强制 checks
- 模型可以合法输出“看起来合规”但缺少 checks 的结构，语义上仍满足 schema，但 audit 可信度不足

### 4. 缺乏强制校验

- 没有在应用层根据 checks 强制修正 Overall_Status
- Overall_Status 完全依赖模型输出，缺少二次校验逻辑

---

## 六、与终端摘录的对应关系

| 终端观点 | 本分析结论 |
|----------|------------|
| Schema 未含 payment.checks | ❌ 部分偏差：Schema 有 PaymentChecks，但全部 optional |
| 几乎永远走 fallback：PAID + amount_match → ✅ | ✅ 符合：PAY 无 checks 时仅看 status，PAID 即 ✅，且不检查 amount_match |
| Invoice 缺 checks 时过宽 | ✅ 符合：fallback 只依赖 addressed_to_strata 与 payee_match |
| 追加 run 覆盖失败 | ✅ 符合：后 run 按 GL_ID 覆盖，会覆盖之前的 FAIL |
| 付款核查颗粒度不足 | ✅ 符合：checks 可选，UI 在无 checks 时只依赖 status |

---

## 七、建议（优先顺序）

1. **Schema 强制 checks**：`invoice.checks`、`payment.checks` 改为必填，或至少要求若干核心项（如 amount, payee_match）必填  
2. **UI 无 checks 时收紧 fallback**：无 checks 时默认显示 ⚠ 或 RISK_FLAG，而不是 ✅  
3. **Prompt 明确“无 checks = 非 PASS”**：例如：“若未输出完整 checks，Overall_Status 不得为 PASS”  
4. **追加 run 不覆盖原始失败**：保留初次 FAIL 记录，或在 UI 中展示“Original vs Additional”对比视图  
