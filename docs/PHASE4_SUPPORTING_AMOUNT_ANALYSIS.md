# Phase 4 supporting_amount 规则污染分析

## 问题描述

**现象:** supporting_amount 未按既定规则（Bank Statement、Levy Report、breakdown report、GL per R2–R5）填写，而是使用 **GL & Balance Sheet** 来解释 Balance Sheet。

**预期:** 按行项目类型严格匹配 R2–R5 的 evidence 来源。  
**实际:** AI 普遍用 GL + BS 作为 supporting_amount，规则相互污染。

---

## 全链路检查

### 1. phase_4_rules.ts

**FOUNDATIONAL RULE:**
```
- supporting_amount is the verification evidence – from Bank Statement (R2), Levy Report (R3), breakdown report (R4), or GL (R5) per rules.
- supporting_amount is used to VERIFY bs_amount; it is NOT the source of bs_amount.
```

**RULE 2 (Cash):** TIER 1 = Bank Statement / TD Statement. "Do NOT use General Ledger (Tier 3) as primary evidence."  
**RULE 3 (Levy):** TIER 2 = Levy Position Report. "If only Tier 3 Doc found → TIER_3_ONLY."  
**RULE 4 (Accrued/Creditors):** TIER 2 = breakdown report. "PROHIBITED: GL or FS notes used alone."  
**RULE 5 (Other):** "Action: Search General Ledger (Tier 3)."

**Line 68-69:**
```
- Field "supporting_amount": The amount found in the support document.
- Field "note": AI explanation (e.g. "Bank Statement p.2 as at FY end", "Current Year BS column", "GL Cash reconciled", "Prior Year closing").
```

---

### 2. phase_4_assets.ts

```
2. **MANDATORY – supporting_amount evidence per line type (Phase 4 rules R2–R5):**
   - Cash at Bank, Term Deposits: supporting_amount MUST come from Bank Statement / TD Statement (Tier 1) ONLY. Do NOT use GL. ...
   - Levy Arrears, Levies in Advance: supporting_amount from Tier 2 Levy Position Report; if only GL → status = "TIER_3_ONLY".
   - Accrued/Prepaid/Creditors: supporting_amount from Tier 2 breakdown report; if only GL → status = "MISSING_BREAKDOWN".
   - Other items (RULE 5): supporting_amount from GL.
```

---

### 3. output_registry (MODULE_50_OUTPUTS)

```
- Cash at Bank, Term Deposits (RULE 2): supporting_amount MUST come from Bank Statement ... ONLY. Do NOT use GL.
- Levy Arrears (RULE 3): supporting_amount from Tier 2 Levy Position Report; if only GL → status = "TIER_3_ONLY".
- Accrued/Prepaid/Creditors (RULE 4): supporting_amount from Tier 2 breakdown report; if only GL → status = "MISSING_BREAKDOWN".
- Other (RULE 5): supporting_amount from GL.
```

---

### 4. functions/geminiReview.js userInstruction

```
5. supporting_amount = verification evidence per R2–R5. For Cash at Bank/Term Deposits: supporting_amount from Bank Statement (Tier 1) ONLY.
```

---

### 5. Prompt 注入顺序 (audit_engine/index.ts)

```
PHASE_4_ASSETS_PROMPT + PHASE_4_RULES_PROMPT + PHASE_3_EXPENSES_PROMPT + ... + MODULE_50_OUTPUTS_PROMPT
```

Phase 4 workflow 与 rules 相邻，MODULE_50 在最后。Phase 3 穿插在 Phase 4 之后，可能造成 Phase 3 的 GL/expense 语境干扰 Phase 4。

---

## 根因分析

### 根因 1：缺少对 Balance Sheet 作为 supporting_amount 的明确禁止

**现状:** 只写明 bs_amount 必须来自 BS，supporting_amount 来自 R2–R5 证据。  
**缺失:** 未明确写 “supporting_amount 禁止来自 Balance Sheet”。

**后果:** AI 可能认为：
- “BS 上的数用 BS 来验证” = 用 BS 填 supporting_amount（循环引用）
- “BS + GL 一起说明” = 把 BS 和 GL 都当作 supporting evidence

**建议:** 在 FOUNDATIONAL RULE 中增加：`supporting_amount must NOT come from the Balance Sheet. The Balance Sheet is the auditee; use Bank Statement, Levy Report, breakdown report, or GL per R2–R5.`

---

### 根因 2：note 示例暗示 BS 和 GL 可作为来源

**phase_4_rules Line 69:**
```
"note": ... (e.g. "Bank Statement p.2 as at FY end", "Current Year BS column", "GL Cash reconciled", "Prior Year closing").
```

**phase_4_assets Line 32:**
```
"note": ... (e.g. "Bank Statement p.2 as at FY end", "Levy Position Report p.1", "Current Year BS column", "GL Cash reconciled", ...).
```

**问题:**  
- “Current Year BS column” 适合用于说明 bs_amount 的来源，但和 supporting_amount 混在一起举例  
- “GL Cash reconciled” 可能被理解为 supporting_amount 可来自 GL（对 Cash 而言应禁止）

**后果:** AI 将 “Current Year BS column” 和 “GL” 视为可接受的 supporting 来源，导致 R2–R5 的严格区分被弱化。

---

### 根因 3：行项目 → Rule 映射不清晰，易滑向 RULE 5

**现状:** 按行项目名称推断规则，但 FS 用词多样（e.g. Contributions Receivable, Levy Debtors, Admin Fund Cash），与规则中的 “Levy Arrears”, “Cash at Bank” 等不完全一致。

**后果:**  
- 难以明确归类时，AI 倾向默认 RULE 5（GL）  
- RULE 5 覆盖 “Other”，范围较宽，容易把本应适用 R2/R3/R4 的项错误归入 R5

**建议:** 增加 line_item → rule 的术语对照表，或要求 AI 先明确 “本行适用 R2/R3/R4/R5” 再填 supporting_amount。

---

### 根因 4：RULE 5 与 R2–R4 的优先级/适用顺序不清

**现状:** R2–R5 并列描述，未强调 “先按 R2→R3→R4 匹配，都不符才用 R5”。

**后果:**  
- AI 可能优先用 R5（GL）因为表述最通用  
- 或同时考虑多条规则，导致 “GL + BS” 这种混合 evidence

**建议:** 写明 “For each line: FIRST match R2, then R3, then R4. Use R5 (GL) ONLY if the line does NOT fall under R2/R3/R4.”

---

### 根因 5：Phase 3 与 Phase 4 的语境干扰

**注入顺序:** Phase 4 之后紧跟 Phase 3 (Expenses)、Phase 5 (Compliance)。Phase 3 强调 GL、发票、费用 vouch。

**后果:**  
- Phase 4 的 “supporting_amount 按 R2–R5 分层证据” 容易被 Phase 3 的 “GL 为核心” 思路覆盖  
- 模型可能形成 “GL 是通用证据” 的偏好，再泛化到 Phase 4

---

### 根因 6：缺少 “不可用 BS 填 supporting_amount” 的显式清单

**现状:** 禁止用 GL/ledger 填 bs_amount；对 supporting_amount 只写了 “应从何处取”，未写 “禁止从何处取”。

**后果:** 模型难以排除 “用 BS 来支撑 BS” 这类无效证据链。

---

## 根因汇总

| 序号 | 根因 | 位置 | 严重度 |
|------|------|------|--------|
| 1 | 未禁止 Balance Sheet 作为 supporting_amount 来源 | phase_4_rules FOUNDATIONAL | **高** |
| 2 | note 示例含 “Current Year BS column”“GL Cash reconciled”，易被理解为 supporting 来源 | phase_4_rules, phase_4_assets | **高** |
| 3 | line_item 名称 → R2/R3/R4/R5 映射不明确，易默认 R5 | rules, workflow | 中 |
| 4 | R2–R5 的适用顺序与优先级未说明 | phase_4_rules | 中 |
| 5 | Phase 3 的 GL 语境可能干扰 Phase 4 证据层次 | audit_engine 拼接顺序 | 中 |
| 6 | 未提供 supporting_amount 的 “禁止来源” 清单 | 全流程 | 中 |

---

## 建议修改方向（待用户决定）

1. 在 FOUNDATIONAL RULE 中明确：`supporting_amount must NOT come from the Balance Sheet. PROHIBITED for supporting_amount: Balance Sheet, Financial Statement.`
2. 调整 note 示例：区分 bs_amount 与 supporting_amount 的说明，避免 “Current Year BS column” 用于 supporting_amount；“GL Cash reconciled” 仅用于 R5 适用项。
3. 增加 line_item → rule 映射表或分类指引，减少误用 R5。
4. 在 rules 中写明 R2→R3→R4→R5 的适用顺序与 “R5 仅在其他规则不适用时使用”。
5. 评估调整 prompt 顺序：将 Phase 4 相关 prompt 集中，减少 Phase 3 对 Phase 4 的干扰。

---

*本分析仅作问题定位，不包含任何代码修改。*
