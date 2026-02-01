# Phase 4 Table C.3 – Owners Equity 时常不显示原因分析

## 现象

Table C.3: Full Balance Sheet Verification (Phase 4 GATE 2) 中，**Owners Equity（所有者权益）** 时常不显示。

---

## 全链路检查

### 1. UI 逻辑 (`AuditReport.tsx` Line 1011–1013)

```javascript
SECTION_ORDER.forEach((s) => {
  const g = items.filter((i) => (i.section || 'ASSETS') === s);
  if (g.length > 0) groups.push({ section: s, items: g });
});
```

- UI 只渲染**有数据的 section**；若 `section === 'OWNERS_EQUITY'` 的 item 数量为 0，则不显示 Owners Equity 区块
- **结论**：UI 逻辑正确；问题在于 AI 未产出 `section: "OWNERS_EQUITY"` 的 item

---

### 2. Phase 4 Rules (`phase_4_rules.ts`)

| Rule | 内容 | 与 Owners Equity 关系 |
|------|------|------------------------|
| **RULE 1** | OWNERS EQUITY – ROLL-FORWARD CHECK。Target: "Owners Funds at Start of Year"。Action: 检查是否等于 Prior Year Closing | 只做 roll-forward 检查，**未要求把 OE 行写入 balance_sheet_verification** |
| **RULE 5** | GENERAL VOUCHING (ALL OTHER ITEMS – **ASSETS & LIABILITIES**)。Target 含 Retained Earnings (Owners Equity) | 标题强调 Assets & Liabilities，OE 仅在 Target 末尾顺带提及，容易被忽略 |

**问题：**

- RULE 1 只描述如何验证，**没有**写「必须为每个 Owners Equity 行输出一条 `balance_sheet_verification` 记录」
- RULE 5 标题为 "ASSETS & LIABILITIES"，AI 容易只关注资产和负债
- 无明确「必须为 Owners Equity 的每一行输出一条记录」的指令

---

### 3. Phase 4 Workflow (`phase_4_assets.ts`)

```
**FULL BALANCE SHEET SCOPE – extract ALL line items:**
- **Owners Equity:** Owners Funds at Start, Retained Earnings, Accumulated Funds, etc.
- **Assets:** Cash at Bank, Term Deposits, Levy Arrears, ...
- **Liabilities:** Creditors, Accrued Expenses, ...
```

- 有提到 Owners Equity 及示例行项目
- 但没有强调「**必须先处理 Owners Equity 再处理 Assets/Liabilities**」，也未强制「**至少输出 N 条 OWNERS_EQUITY 记录**」

---

### 4. output_registry (`output_registry.ts` Line 35–44)

```
**ASSETS_AND_CASH (PHASE 4 – FULL BALANCE SHEET VERIFICATION):**
- **SCOPE:** Extract and verify EVERY line item from the FULL Balance Sheet – Owners Equity, Assets, Liabilities. **Do NOT limit to assets only.**
```

- 「Do NOT limit to assets only」说明已预判模型容易只输出 assets
- 只给出笼统要求，缺少对 Owners Equity 的**强制列举与约束**

---

### 5. Cloud Function 用户指令 (`functions/geminiReview.js` Line 61)

```
5. **MANDATORY – Phase 4 balance_sheet_verification:** You MUST populate as array. For Cash at Bank/Term Deposits: ... For Levy Arrears: Tier 2 sub-ledger. ...
```

- 仅举例 Cash、Levy Arrears 等，**未提到 Owners Equity**
- AI 容易被引导为「优先填资产/负债」，忽略 OE

---

### 6. 规则整体结构

- R2–R5 以**证据类型/验证方法**划分（Cash、Levy、Accrued、Other）
- 未按**资产负债表结构**（Owners Equity → Assets → Liabilities）组织
- AI 易按 R2→R3→R4→R5 顺序处理，而 R1 不是「往 balance_sheet_verification 填行」的规则，导致 OE 行缺失

---

### 7. 术语与识别

Strata FS 常见 OE 表述：

- Owners Funds at Start of Year
- Accumulated Funds / Retained Earnings
- Members' Funds
- Owners Corporation Funds
- Administrative Fund Equity / Capital Fund Equity

当前 prompt 中 OE 行项目名不够全，AI 可能不识别部分 OE 行。

---

## 根因归纳

| 序号 | 根因 | 位置 | 严重度 |
|------|------|------|--------|
| 1 | RULE 1 未要求把 Owners Equity 行输出到 balance_sheet_verification | phase_4_rules | 高 |
| 2 | RULE 5 标题为 "ASSETS & LIABILITIES"，OE 易被忽略 | phase_4_rules | 高 |
| 3 | 缺少「必须为 OE 的每一行输出记录」的显式指令 | phase_4_rules, phase_4_assets, output_registry | 高 |
| 4 | Cloud Function 用户指令未提及 Owners Equity | geminiReview.js | 中 |
| 5 | 未按 BS 结构强调处理顺序（OE → Assets → Liabilities） | phase_4_assets | 中 |
| 6 | OE 行项目名称术语表不全 | phase_4_rules | 低 |

---

## 建议修改方向（待用户决定）

1. **在 phase_4_rules 中补充 RULE 1 输出约束**  
   明确：RULE 1 涉及 Owners Equity 时，必须为相关每一行在 `balance_sheet_verification` 中输出一条记录，且 `section: "OWNERS_EQUITY"`。

2. **在 phase_4_assets 中增加强制要求**  
   - 例如：`You MUST include every Owners Equity line from the Balance Sheet. Do NOT skip Owners Equity.`
   - 可补充：按顺序处理 Owners Equity → Assets → Liabilities。

3. **在 output_registry 中强化 OE 约束**  
   - 例如：`balance_sheet_verification MUST include rows for every Owners Equity line (Owners Funds at Start, Retained Earnings, Accumulated Funds, etc.) with section="OWNERS_EQUITY".`

4. **在 Cloud Function userInstruction 中补充 OE**  
   - 例如：`Include Owners Equity section – Owners Funds at Start, Retained Earnings, Accumulated Funds. Do NOT omit.`

5. **在 phase_4_rules 中增加 OE 术语参考**  
   - 列举常见 OE 行项目名称，供 AI 识别和映射到 `OWNERS_EQUITY`。

---

*本分析仅作问题定位，不包含任何代码修改。*
