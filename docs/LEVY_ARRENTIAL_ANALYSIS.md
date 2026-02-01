# Levies in Arrears & Levies in Advance – Opening/Closing 颠倒问题分析

## 问题描述

用户反馈：Table E.Master 中 Levies in Arrears 与 (Less) Levies in Advance 的 **Opening** 与 **Closing** 余额，AI 时常颠倒、识别反。

## 字段定义与来源（正确逻辑）

| 字段 | 含义 | 证据来源 | BS 列 |
|------|------|----------|-------|
| **Op_Arrears** | 期初拖欠 | Prior-Year Balance Sheet closing | **Prior Year** 列 |
| **Op_Advance** | 期初预收 | Prior-Year Balance Sheet closing | **Prior Year** 列 |
| **BS_Arrears** | 期末拖欠 | Current-Year Balance Sheet closing | **Current Year** 列 |
| **BS_Advance** | 期末预收 | Current-Year Balance Sheet closing | **Current Year** 列 |

**公式：**
- Net_Opening_Bal (A) = Op_Arrears - Op_Advance
- BS_Closing (G) = BS_Arrears - BS_Advance

---

## 潜在颠倒类型

### 类型 1：Opening / Closing 列错用
- **现象**：Op_Arrears / Op_Advance 填了 Current Year 列的数；BS_Arrears / BS_Advance 填了 Prior Year 列的数
- **后果**：期初期末对调，reconciliation 完全错误

### 类型 2：Arrears / Advance 概念互换
- **现象**：把「Levies in Advance」的金额填进 Op_Arrears / BS_Arrears；把「Levies in Arrears」的金额填进 Op_Advance / BS_Advance
- **后果**：Dr/Cr 方向反，Net_Opening_Bal 与 BS_Closing 符号错误

### 类型 3：Op 与 BS 对调
- **现象**：Op_Arrears 填了 Current Year 的 Arrears；BS_Arrears 填了 Prior Year 的 Arrears
- **后果**：等同于类型 1

---

## 全链路检查结果

### 1. Rules (`phase_2_rules.ts`)

**OPENING LEVY BALANCES (Line 42-74):**
- ✅ 明确写：Op_Arrears、Op_Advance 必须来自 Prior-Year Balance Sheet closing
- ✅ 明确写：Prior Year = (a) standalone prior-year FS, 或 (b) "Prior Year" / "Comparative" 列
- ✅ Balance direction：Arrears → Dr, Advance → Cr；单一行 Levy Receivable 若为 Cr 则视为 Advance

**CLOSING LEVY BALANCES (Line 76-109):**
- ✅ 明确写：BS_Arrears、BS_Advance 必须来自 Current-Year Balance Sheet closing
- ✅ 明确写：用 "Current Year" / "This Year" 列，**NOT** "Prior Year" / "Comparative"

**潜在问题：**
- ⚠️ Opening 与 Closing 规则分别在两段，中间无「禁止对调」的显式提醒
- ⚠️ 没有用一句话概括：**Op_* = Prior Year 列；BS_* = Current Year 列**

---

### 2. Workflow (`phase_2_revenue.ts`)

**Line 9-11:**
```
1. MANDATORY – Opening Balances (Op_Arrears, Op_Advance): Source STRICTLY from Prior-Year Balance Sheet
2. MANDATORY – Closing Balances (BS_Arrears, BS_Advance): Source STRICTLY from Current-Year Balance Sheet
3. Locate 'Levies in Arrears' and 'Levies in Advance' in the Balance Sheet (prior-year for opening; current-year for closing).
```

**潜在问题：**
- ⚠️ 第 3 点虽写了 prior-year/current-year，但未明确「不要互换」「严禁把 Prior Year 填进 BS_*」

---

### 3. Output Registry / MODULE 50 (`output_registry.ts`)

**Line 24 (Net_Opening_Bal)：**
```
Op_Arrears and Op_Advance (Phase 2 OPENING LEVY BALANCES): Source STRICTLY from Prior-Year Balance Sheet ONLY.
```

**Line 31 (Levy_Variance / BS_Closing)：**
```
BS_Arrears and BS_Advance (Phase 2 CLOSING LEVY BALANCES): Source STRICTLY from Current-Year Balance Sheet closing balances ONLY. Use "Current Year" column; NOT "Prior Year".
```

**潜在问题：**
- ⚠️ 两处各自写来源，但没有在一处集中写明「Op_* vs BS_* 的列映射」
- ⚠️ JSON Schema 中 Op_Arrears/Op_Advance 与 BS_Arrears/BS_Advance 相距较远（中间隔了大量 levy 相关字段），模型可能不自然建立「成对」对应

---

### 4. JSON Schema 字段顺序 (`output_registry.ts` Line 73-107)

```
Op_Arrears, Op_Advance, Net_Opening_Bal, ... (中间 20+ 字段) ... BS_Arrears, BS_Advance, BS_Closing, Levy_Variance
```

**潜在问题：**
- ⚠️ Op_* 与 BS_* 在 schema 中距离较远，模型可能未把「Opening vs Closing」视为强约束

---

### 5. Cloud Function 用户指令 (`functions/geminiReview.js` Line 61)

```
4. MANDATORY – Phase 2 rules: Apply OPENING LEVY BALANCES (Prior-Year BS only), CLOSING LEVY BALANCES (Current-Year BS only)...
```

**潜在问题：**
- ✅ 有简要重申，但未强调「禁止对调」或「Op_* ≠ BS_*」

---

### 6. UI 展示 (`AuditReport.tsx`)

**Opening 区域 (Line 680-711):**
- 标签："Opening Balance" → "Levies in Arrears" → "(Less) Levies in Advance" → "(A) NET OPENING"
- 数据绑定：`Op_Arrears`, `Op_Advance`

**Closing 区域 (Line 829-910):**
- 标签："Closing Balance per Balance Sheet" → "Levies in Arrears" → "Levies in Advance" → "(G) BALANCE SHEET CLOSING"
- 数据绑定：`BS_Arrears`, `BS_Advance`

**结论：**
- ✅ UI 正确绑定，不会造成前后端混淆
- ⚠️ UI 中 Closing 处未写 "(Less)"，而 Opening 处 Advance 写了 "(Less)"，可能让人误以为语义不同，但这是显示差异，不直接导致 AI 填错

---

### 7. Arrears / Advance 识别的模糊点

**Rules 中的说明：**
- Levies in Arrears: Dr
- Levies in Advance: Cr
- 若「Levy Receivable」单一科目为 Cr，则视为 Advance

**潜在问题：**
- ⚠️ 部分 FS 可能用不同表述（如 "Contributions Receivable" net of advance），模型可能把 Dr 和 Cr 的金额对调
- ⚠️ 若 BS 把 Arrears 和 Advance 分开列示，但没有明确标 Dr/Cr，模型可能按位置或习惯错误分配

---

## 根因归纳

| 序号 | 可能根因 | 位置 | 严重度 |
|------|----------|------|--------|
| 1 | 缺乏集中、醒目的「列映射」说明：Op_* = Prior Year，BS_* = Current Year | Rules + output_registry | 高 |
| 2 | 缺乏显式「禁止对调」指令 | Rules + workflow + output_registry | 高 |
| 3 | Arrears/Advance 的 Dr/Cr 说明分散，无单独「识别检查清单」 | phase_2_rules | 中 |
| 4 | Schema 中 Op_* 与 BS_* 相距远，模型易忽略成对约束 | output_registry | 中 |
| 5 | 某些 FS 用 "Comparative" 替代 "Prior Year"，术语不统一 | Rules | 低 |

---

## 建议修改方向（待用户决定）

1. **在 Rules 开头增加 CRITICAL 块**：  
   明确写出「Op_Arrears, Op_Advance = Prior Year 列 ONLY；BS_Arrears, BS_Advance = Current Year 列 ONLY。严禁互换。」

2. **在 output_registry (A) 和 (G) 公式旁**：  
   加一句「Op_* 仅来自 Prior Year；BS_* 仅来自 Current Year。」

3. **增加 Arrears vs Advance 速查**：  
   如「Arrears = 拖欠 = Dr = 资产；Advance = 预收 = Cr = 负债。若识别不清，按 Dr/Cr 判断。」

4. **在 schema 注释中**（若支持）：  
   对 Op_Arrears, Op_Advance, BS_Arrears, BS_Advance 标注来源列。

5. **在 Cloud Function userInstruction 中**：  
   加入简短提醒：「CRITICAL: Op_* from Prior Year column; BS_* from Current Year column. Do not swap.」

---

*本分析仅作问题定位，不包含任何代码修改。*
