# Phase 3 Expense Vouching – Prompt / Schema / Output / UI 审查与稳定化建议

## 一、当前设计摘要

- **Prompt**：EXPENSE_RISK_FRAMEWORK（Step A 六维度 → Step B/C 逐项执行）；PHASE_3_EXPENSES_PROMPT 要求建 Target Sample List 后对每项执行 Step B、Step C。
- **Schema/Output**：仅 `expense_samples[]`，每项含 Risk_Profile（含 selection_dimension）、Three_Way_Match、Fund_Integrity、Overall_Status。**无** Step A 的汇总或证明字段。
- **UI**：按 selection_dimension 分组展示，标签如「Value-weighted (cumulative ≥ 70% total expenditure)」；**不**计算、不校验 70% 或各维度是否真的执行。

---

## 二、存在的不确定性

### 1. 「累计金额 ≥ 总支出 70%」无法被系统验证

- **现状**：Step A 规则 1 要求「Sort GL by amount desc, take items until cumulative amount ≥ 70% of total」。
- **问题**：
  - 输出中**没有** `total_expenditure`、`value_coverage_cumulative_amount` 或 `value_coverage_percent`。
  - 模型可以少选几笔、仍给它们标 VALUE_COVERAGE，而系统与用户都**无法验证**是否真的达到 70%。
- **结果**：存在「偷懒」或算错的可能：少选、误标、或未按金额排序，均无法通过现有 output 发现。

### 2. 六项维度是否「都执行」无法证明

- **现状**：每笔样本只有 `selection_dimension`（和可选的 `selection_reason`），没有「Step A 各维度各选了多少」的汇总。
- **问题**：
  - 若某次运行中没有任何 RISK_KEYWORD 或 MATERIALITY，无法区分是「GL 里确实没有」还是「没跑该维度」。
  - 没有强制要求「每个维度必须跑一遍并记录 0 或 N」。
- **结果**：维度 2–6 是否真的都跑过，只能靠信任模型，无法用数据复核。

### 3. MATERIALITY 阈值未在输出中落字

- **现状**：规则 3 为 `max(manager_limit ?? 5000, total_expenditure × 0.01, 5000)`，但 output 中不包含该阈值或 total_expenditure。
- **问题**：审计时无法确认「materiality 用的是多少」「是否与 intake_summary.manager_limit 一致」，复现与复核困难。

### 4. selection_reason 未规定必须含「可验证信息」

- **现状**：Risk_Profile 有 selection_reason 和 selection_dimension，但 prompt 未要求 VALUE_COVERAGE 的 reason 必须写「累计 $X / 总 $Y (≥70%)」等。
- **问题**：即使模型写了理由，也常为泛泛描述，无法用于自动或人工校验 70%。

### 5. UI 仅展示、不校验

- **现状**：UI 按 selection_dimension 分组并显示固定标签（如「cumulative ≥ 70%」），不根据数据计算或告警。
- **问题**：用户会以为「有 VALUE_COVERAGE 这一组就代表做了 70%」，而实际是否达标不可见。

---

## 三、系统层面：如何让「真的执行」可验证、更稳定

思路：**在输出中增加 Step A 的可审计摘要，并在 prompt 中强制要求先完成 Step A 再输出，且摘要与样本一致。**

### 方案 A：新增 `step_a_sampling_summary`（推荐）

在 Phase 3 的 **JSON 输出** 中增加一个**必填**对象，仅当执行 Step A 时存在（Initial Run 必填；Additional Run 不跑 Step A 可无）：

```text
step_a_sampling_summary: {
  total_expenditure: number,           // 来自 pl_extract/GL 的当年总支出
  value_coverage_cumulative_amount: number,  // VALUE_COVERAGE 项 GL 金额之和
  value_coverage_percent: number,      // value_coverage_cumulative_amount / total_expenditure * 100
  materiality_threshold_used: number,  // max(manager_limit??5000, total*0.01, 5000)
  counts_per_dimension: {
    VALUE_COVERAGE: number,
    RISK_KEYWORD: number,
    MATERIALITY: number,
    ANOMALY_DESCRIPTION: number,
    SPLIT_PATTERN: number,
    RECURRING_NEAR_LIMIT: number,
    OTHER: number
  }
}
```

- **用途**：
  - 用 `value_coverage_percent >= 70` 校验「70% 规则」是否被满足（前端或后端可打 warning/flag）。
  - 用 `counts_per_dimension` 确认六个维度都有被考虑（0 表示该维度无命中，而非未执行）。
  - 用 `materiality_threshold_used` 与 `total_expenditure` 做审计轨迹与复现。
- **稳定性**：同一份 GL + pl_extract，若模型按要求填摘要，则 70% 与维度执行情况可复现、可检查。

### 方案 B：Prompt 中强制「先算后输出」与自检

在 **EXPENSE_RISK_FRAMEWORK** 的 Step A 和 PHASE_3_EXPENSES_PROMPT 中增加：

- **规则 1（VALUE_COVERAGE）** 后增加：  
  「You MUST compute total_expenditure from pl_extract (current year), then sort GL by amount desc and add items until the running cumulative amount ≥ 70% of total_expenditure. Output step_a_sampling_summary with total_expenditure, value_coverage_cumulative_amount, value_coverage_percent. If value_coverage_percent < 70, you have not completed rule 1 – include more items from GL (by amount desc) until ≥ 70%.」
- **规则 2–6** 后增加：  
  「For each dimension 2–6, you MUST run the selection rule and record how many items were assigned to that dimension (0 if none). Populate step_a_sampling_summary.counts_per_dimension accordingly.」
- **输出顺序**：  
  「You MUST complete Step A in full (all six dimensions and dedupe/sort) before executing Step B/C. Output step_a_sampling_summary together with expense_samples so that the summary can be verified against the sample list.」

这样从**流程**上约束「先做 Step A、再对 Target Sample List 逐项 Step B/C」，并让摘要与样本一致、可验证。

### 方案 C：前端/后端校验（与方案 A 配合）

- **后端或前端**在收到 Phase 3 结果后：
  - 若存在 `step_a_sampling_summary`：
    - 若 `value_coverage_percent < 70`：打 **warning**（例如「Value coverage reported &lt; 70% – Step A rule 1 may not be satisfied」）。
    - 可选：用 expense_samples 中 VALUE_COVERAGE 项的 GL_Amount 重算累计，与 `value_coverage_cumulative_amount` 比对；若差异超过容忍（如 1%），打 warning。
  - 不强制拒绝通过，但让「没真正执行 70%」或「摘要与样本不一致」可见，便于人工跟进。

### 方案 D：selection_reason 对 VALUE_COVERAGE 的强化（可选）

- 在 prompt 中要求：对每条 `selection_dimension = "VALUE_COVERAGE"` 的样本，`selection_reason` 必须包含可解析的数值信息，例如：  
  「Cumulative $X,XXX of $Y,YYY total (≥70%)」或 「Included in top-by-amount until cumulative ≥ 70% (sum $X of total $Y)」。
- 这样即使没有 step_a_sampling_summary，审计员也能从单条理由中做抽查；若有 summary，则可与 summary 交叉验证。

---

## 四、具体修改清单（便于落地）

| 层级 | 建议 | 说明 |
|------|------|------|
| **Schema / type_definitions** | 新增 `step_a_sampling_summary`（可选，仅 Phase 3 initial run） | 含 total_expenditure, value_coverage_cumulative_amount, value_coverage_percent, materiality_threshold_used, counts_per_dimension。 |
| **output_registry (MODULE 50)** | 在 expense_samples 说明旁增加 step_a_sampling_summary 的必填要求与字段说明 | 与 Step A 规则 1–6 对应，并写清「若 value_coverage_percent &lt; 70 则未完成规则 1」。 |
| **EXPENSE_RISK_FRAMEWORK (phase_3_expenses.ts)** | Step A 规则 1 后增加「必须计算并输出 summary；若 &lt;70% 则继续加入 GL 项直至 ≥70%」 | 同上。 |
| **EXPENSE_RISK_FRAMEWORK** | Step A 规则 6/7 后增加「必须输出 counts_per_dimension，且先完成 Step A 再执行 Step B/C」 | 确保六维度都跑过、且有记录。 |
| **call2_phase_prompts / EXPENSES_OUTPUT_SCHEMA** | 要求返回 `expense_samples` 与 `step_a_sampling_summary`（initial run） | 与 schema 一致。 |
| **UI (AuditReport)** | 若存在 step_a_sampling_summary：显示 value_coverage_percent；若 &lt; 70% 显示 warning 条 | 不改变现有分组逻辑，仅增加透明度和告警。 |
| **可选：后端/前端** | 收到结果后若 summary 存在则做 70% 与累计一致性校验，超差则 warning | 系统层面二次把关。 |

---

## 五、小结

- **不确定性**：当前无法从系统上验证「累计 ≥ 70%」是否真的执行、六维度是否都执行、materiality 阈值是否一致；仅依赖模型自觉，存在偷懒或漏跑风险。
- **稳定化方向**：  
  - **输出可验证**：通过 `step_a_sampling_summary` 把 Step A 的输入（total、阈值）和结果（70% 累计、各维度计数）固定到数据结构里。  
  - **流程可约束**：通过 prompt 强制「先完整执行 Step A → 再输出 summary + expense_samples」，并允许前端/后端用 summary 做 70% 与一致性校验。  

这样既能回答「我们如何确保 70% 和 1–6 项真的执行」，又能在不改变现有 Step B/C 与 UI 主流程的前提下，让「是否执行、是否达标」从系统层面可检查、可追溯。
