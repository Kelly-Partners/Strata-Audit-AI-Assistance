# Levy Old/New Rate + Proportion 不稳定性分析

## 一、当前规范中与「minutes + proportion」相关的全部表述

### 1. 来源（逐条）

| 文件 | 表述 |
|------|------|
| **phase_2_rules.ts** – levy_old_new_rate | Old/New rate 与 **date the new levy rate was adopted** 仅来自 minutes；用该 adoption date + 财年计算 **quarterly proportion**。 |
| **phase_2_rules.ts** – levy_old_new_levies_source | 六字段来源**仅** minutes；**要么** 直接从 minutes 摘录金额，**要么** 用 intake_summary.financial_year（LOCKED）+ minutes 的 rate adoption date 做 **quarterly proportion** 计算。 |
| **phase_2_revenue.ts** | 仅来自 minutes；**MUST time-apportion by plan's financial year**；用 FY **define quarters**；从 minutes **identify the date the new levy rate was adopted**；对**每一季度（或 part-quarter）** 按 **proportion (e.g. days or months at old rate vs new rate)** 归到 Old 或 New；note/computation 需写 FY、quarter boundaries、minutes 通过日、比例（如 "Q1 100% old; Q2 60% old 40% new"）。 |
| **output_registry.ts** (MODULE 50) | 同上：time-apportion by **LOCKED financial year**；用 FY **define quarters**；按 **date the new rate was adopted (from minutes)** 拆分；对 **each quarter (or part-quarter)** 按 **proportion (e.g. days or months in that quarter at old rate vs new rate)** 归 Old/New。 |
| **step_0_intake.ts** | financial_year 格式：Prefer **"DD/MM/YYYY - DD/MM/YYYY"**；else **FY end date "DD/MM/YYYY"**。core_data_positions.minutes_levy = doc_id + page_ref for **levy rate adoption (old/new)**。 |

### 2. 归纳

- **数据来源**：Old/New 费率、**新费率通过日**、以及（若直接摘录）金额，都**仅**来自 minutes；财年来自 **intake_summary.financial_year**（Step 0 锁定）。
- **计算路径**：若不直接摘录，则必须 **time-apportion**：用 FY 定义「季度」、用通过日把 FY 内时间分成 old/new，再按 **proportion** 把 levy 归到 Old Rate 或 New Rate。
- **比例方式**：当前仅写 **「e.g. days or months」**，未指定必须用哪一种，也未给出唯一公式。

---

## 二、会造成 variance 的不稳定点（客观分析）

### 1. 比例口径不固定：「按天」vs「按月」

- **现状**：多处写「proportion (e.g. days or months at old rate vs new rate)」「e.g. days or months in that quarter」。
- **影响**：模型可任选「按天」或「按月」。例如通过日在 4 月 15 日：
  - **按天**：4 月 = 14 天旧 + 16 天新 → 该月比例 14/30 vs 16/30。
  - **按月**：若整月归新 → 0% old / 100% new；若「半月算旧半月算新」→ 50/50。不同 run 可能选不同口径，**同一批内容会得到不同 Old_Levy / New_Levy**。
- **结论**：**是主要不稳定源之一**。

### 2. 「季度」与「part-quarter」未定义

- **现状**：只要求「Use the FY to define quarters」「For each quarter (or part-quarter)」。
- **影响**：
  - 季度边界未规定：可以是**日历季度**（1 Jul–30 Sep, 1 Oct–31 Dec…），也可以是**自 FY 起算的连续 3 个月**；对 7–6 月 FY 两者一致，对非 7–6 月或 FY 起止日不整时可能不一致。
  - 「part-quarter」未定义：通过日落在季度中间时，该段算「几天旧、几天新」的区间如何切（按天/按周/按整月）未规定，模型可自由解释。
- **结论**：**会放大比例口径的差异**（例如按天时不同 run 对「Q2」起止日理解不同，导致天数不同）。

### 3. 新费率「通过日」的取数口径不统一

- **现状**：只写「identify from minutes the date the new levy rate was adopted」。
- **影响**：minutes 里可能出现：
  - 动议通过日（motion passed 15 March）；
  - 生效日（effective from 1 April）；
  - 「下一季度起」等文字。
  模型可能有的取「通过日」、有的取「生效日」、有的取「下一季度首日」，**同一份 minutes 会得到不同 adoption date**，进而**天数/比例不同 → Old vs New 金额不同**。
- **结论**：**是另一主要不稳定源**。

### 4. 未规定唯一计算公式

- **现状**：只要求「assign levy to Old or New by proportion」并举例「Q1 100% old; Q2 60% old 40% new」，**没有**写死公式，例如：
  - `days_at_old_rate = min(adoption_date - FY_start, 0) + ...` 或
  - `Old_Levy_Total = Total_Standard_Levy × (days_at_old_rate / days_in_FY)`。
- **影响**：比例如何应用到「总 levy」上未统一：是按「整年总 levy × 时间比例」一次算，还是「每季度先算该季 levy 再按该季内比例拆」；若按季，季度总 levy 又从何来（证据 vs 倒推）。不同 run 可能采用不同计算路径，**数字必然有差异**。
- **结论**：**与 1、2 叠加会明显增加 variance**。

### 5. 「直接摘录」vs「按比例计算」二选一未约束优先级

- **现状**：levy_old_new_levies_source 写「Either the amount is extracted directly from minutes, or it is calculated by quarterly proportion」。
- **影响**：同一份 minutes 若既有「旧费率 $X、新费率 $Y」的明确数字，又有可推算的通过日，有的 run **直接摘录**，有的 run **按比例重算**，结果会不同（尤其摘录与比例结果本就不完全一致时）。
- **结论**：**会引入「同源不同路径」的 variance**。

### 6. financial_year 格式与解析

- **现状**：Step 0 要求优先 "DD/MM/YYYY - DD/MM/YYYY"，否则 FY end "DD/MM/YYYY"；Phase 2 用 intake_summary.financial_year 定义 FY 与季度。
- **影响**：若只给 end date，FY 起点需推断（如 30/06/2025 → 01/07/2024）；若格式为 "1 July 2024 - 30 June 2025" 等，模型解析可能不一致。**FY 起止日差 1 天就会改变「按天」比例**。
- **结论**：**次要但会叠加到按天比例的不稳定**。

### 7. LLM 采样与舍入

- 即使上述口径全部固定，temperature > 0 或采样仍可能导致同一逻辑下**舍入或中间步不同**，产生小幅数字差异。
- **结论**：在口径未锁定时，**会与 1–6 叠加**，你观测到的「同一批内容时常 variance」与 1–5 高度一致。

---

## 三、整体结论

- **「在财年内按季度（或 part-quarter），用天数或月数比例把该段 levy 归到 Old Rate 或 New Rate」** 的当前写法，**确实会造成明显不稳定性**：
  - **天数 vs 月数**未锁定；
  - **季度 / part-quarter** 未精确定义；
  - **通过日**取数口径未统一；
  - **比例公式**与计算路径未唯一化；
  - **直接摘录 vs 比例计算**的优先级未规定。
- 同一批内容多次运行出现 Old/New Rate Levies（以及下游 Sub_Levies_Standard、(B)、(C)）的 variance，与这些设计点一致，**属于可预期的规范层面问题**，而不仅是单次模型表现。

---

## 四、建议的规范收紧（降低 variance）

在不改变「仅 minutes 来源」「time-apportion by FY」的前提下，可从 prompt 层面做以下**可选**收紧，便于你评估是否采纳或部分采纳：

1. **锁定比例口径**  
   明确写：**Use exact calendar days within the financial year for proportion. Do not use whole months.**  
   即：只允许「按天」，并建议在 computation 中写出 `days_at_old_rate`, `days_in_FY` 等，便于审计与复现。

2. **定义季度与 part-quarter**  
   写死：**Quarters = three-month periods from FY start (Q1: months 1–3, Q2: 4–6, Q3: 7–9, Q4: 10–12 from FY start). When the adoption date falls within a quarter, split that quarter by exact days (days at old rate vs days at new rate in that quarter).**  
   这样「part-quarter」唯一化为「该季度内按天拆分」。

3. **统一「新费率通过日」**  
   增加：**Use the effective date of the new levy rate when stated in minutes (e.g. 'effective 1 April'); if only a motion date is given, use the first day of the next full quarter or next month as the adoption date and state this in the note.**  
   减少「通过日 vs 生效日 vs 下一季度」的随意选择。

4. **规定比例公式（按天）**  
   增加：**Proportion by days: Old_Levy_Total = Total_Standard_Levy_for_FY × (days_at_old_rate / days_in_FY), New_Levy_Total = Total_Standard_Levy_for_FY × (days_at_new_rate / days_in_FY), where days_in_FY = FY end date − FY start date (inclusive or exclusive, state in computation).**  
   并要求 **computation.expression** 必须写出实际使用的 FY 起止、adoption date、days_at_old_rate、days_in_FY 及最终算式。

5. **直接摘录优先**  
   增加：**If minutes explicitly state Old Rate Levies $X and New Rate Levies $Y (or equivalent by fund), use those figures directly and do not recalculate by proportion; otherwise use the day-based proportion above.**  
   减少「有明确数字却用比例重算」导致的差异。

6. **financial_year 解析**  
   在 Phase 2 或 Step 0 中补充：**If financial_year is only an end date (DD/MM/YYYY), FY start = same day in the previous year (e.g. 30/06/2025 → 01/07/2024–30/06/2025).**  
   减少 FY 起止推断不一致。

上述 1–4 直接针对「按天/按月」「季度/part-quarter」「通过日」「公式」四个不稳定点；5–6 进一步减少路径与输入解析差异。若需要，可以在 `phase_2_rules.ts`、`phase_2_revenue.ts` 和 `output_registry.ts` 中把上述表述具体改写成与现有 prompt 风格一致的句子并提交 patch.
