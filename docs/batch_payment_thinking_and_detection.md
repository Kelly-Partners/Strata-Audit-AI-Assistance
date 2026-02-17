# Batch Payment：纳入体系思路与检测定位

## 一、问题本质（与当前架构的错位）

- **当前假设**：Phase 3 的 payment 逻辑是 **1 GL 行 ↔ 1 笔银行交易**。  
  - P1 Search：按 `GL_Date ±14d`、`GL_Amount ±$10 或 ±1%` 在银行流水中找**单笔**匹配；若多候选则用 payee/reference/account **锁定唯一一笔**。  
  - `amount_match`：银行金额 vs 单笔 GL 金额。  
  - `reference_traceable`：银行 reference 能对应到**本笔**发票/作业；多引用或无法唯一对应 → FAIL/RISK_FLAG。

- **Batch 现实**：**多笔 GL 行 ↔ 1 笔银行交易**（多张发票/多笔支出合并成一笔付款）。  
  - 银行只有一笔大额，没有与单笔 GL 金额相等的交易 → P1 按「单笔金额」搜不到 → 被判为 **No payment evidence / BANK_STMT_MISSING**。  
  - 付款事实存在，但当前体系没有「组合匹配」路径，只能报缺失。

因此：要把 batch payment 纳入体系，需要在**保持现有 PAID/ACCRUED/MISSING 语义**的前提下，增加一条 **「多对一」匹配路径**，并在证据与输出上能明确表达「本条 GL 属于某笔银行交易的组成部分」。

---

## 二、如何纳入当前架构（概念层）

### 2.1 匹配模式扩展

- 现有：**1:1**（单 GL ↔ 单 bank tx）→ 保持为 PAID 的主路径。  
- 新增：**N:1**（多 GL ↔ 单 bank tx）→ 定义为 **允许的支付形态**，而不是例外或违规。  
- 判定层级建议：  
  - 先走 **P1 单笔匹配**；  
  - 若 P1 无结果，再走 **P2 Batch 推理**（见下）；  
  - 只有两条路径都无结果时，才落 **MISSING / BANK_STMT_MISSING**。

这样「No payment evidence」只表示「既无单笔匹配也无合理 batch 匹配」，避免把 batch 误判为缺失。

### 2.2 输出与证据需要表达的内容

当前 `payment` 结构是「单笔导向」：`bank_date`、`amount_match`、单 `source_doc_id` 等。要支持 batch，需要在**不破坏现有 schema 必填项**的前提下增加「组合」信息：

- **方案 A（推荐）：在现有 status 下增加可选元数据**  
  - `payment.status` 仍为 `PAID | ACCRUED | MISSING | BANK_STMT_MISSING`。  
  - 当通过 batch 路径匹配成功时，仍标为 **PAID**，同时：  
    - 在 `payment` 下增加可选字段，例如：  
      - `payment.batch_payment?: { is_batch: true; bank_txn_total: number; bank_txn_date?: string; bank_reference?: string; gl_ids_in_batch?: string[] }`  
    - 或把「组合」信息放在 `payment.checks.amount_match.observed` / `payment.evidence.note` 中，明确写「Batch payment: this GL $X is part of bank txn total $Y; ref Z」。  
  - 优点：不引入新 status，UI 仍用 PASS/FAIL/RISK_FLAG；Forensic 可读 note/observed 或解析 `batch_payment` 展示「Batch Payment」标签与关联 GL。

- **方案 B：新增 status 值**  
  - 如 `PAID_BATCH` 或 `BATCH_PAID`。  
  - 优点：一眼区分「单笔 PAID」与「batch PAID」；缺点：所有消费 status 的地方都要处理新值，Overall_Status 规则要明确 PAID_BATCH 视同 PAID 还是单独规则。

建议：**方案 A**，用「PAID + 可选 batch 元数据 / note」表达，便于与现有 CRITICAL checks、Overall_Status、UI 一致。

### 2.3 与现有 payment checks 的关系

- **amount_match**：  
  - 1:1：银行金额 ≈ 本笔 GL 金额。  
  - Batch：银行金额 ≈ **本笔 GL 所在组合的总和**；本笔 GL 只是组合中的一部分。  
  - 规则可写为：`amount_match.passed = true` 当且仅当「存在单笔匹配」或「存在合理 batch 匹配且本笔属于该 batch」；`observed` 中写明是单笔还是 batch 及金额关系。

- **reference_traceable**：  
  - Batch 时银行 reference 可能只写总批号/总 ref，不逐条列发票。  
  - 建议：允许「部分/组合可追溯」——例如 `passed = true` 且 `note` 写「Batch payment; ref [xxx] covers multiple invoices」；若无法从 ref 区分各笔则标为 RISK_FLAG 而非直接 FAIL。

- **duplicate_check / split_payment_check**：  
  - 保持现有语义：duplicate = 重复付款；split = 多笔付款拼成一大额。  
  - Batch 是「多笔 GL 合成一笔付款」，与 split 方向相反，不冲突；batch 路径通过后，这两个 check 仍按同一银行交易是否被重复使用、是否有未授权分拆来判。

- **payee_match / date_match / bank_account_match**：  
  - Batch 下仍要求：同一 bank tx 的 payee、date、account 与「该 batch 内 GL」一致或合理对应；规则不变，只是匹配对象从「单笔」变为「该 batch 对应的那一笔银行交易」。

这样，batch 被纳入为**另一种满足 payment 证据的路径**，而不是绕过或削弱现有 checks。

### 2.4 风险与 Overall_Status

- Batch 本身**不是违规**，只是可追溯性更复杂。  
- 建议：  
  - 若 batch 组合清晰（同一 payee、日期集中、金额总和一致、ref 合理）→ **PASS**（或 PASS + 展示 Batch 标签）。  
  - 若 batch 可推断但 ref/明细不足 → **RISK_FLAG**，不判 FAIL。  
  - 只有「既无单笔也无合理 batch」时才维持 **MISSING / BANK_STMT_MISSING**，进而可能触发 FAIL。

---

## 三、如何清晰定位并检测 Batch Payment

### 3.1 何时触发 Batch 路径（入口条件）

在**同一套 Step B – Payment 证据**内，在 P1 单笔匹配之后增加判断：

- **触发条件**：对当前 GL 行（payee P, amount A, date D），在 Tier 1 银行流水中，  
  - 按「单笔金额」P1 未找到匹配（无 bank tx 满足 amount ≈ A ±tolerance 且 payee/date 合理）；**且**  
  - 银行流水存在（非 BANK_STMT_MISSING 因无文件）。  

→ 则进入 **P2 Batch 推理**，而不是直接报「No payment evidence」。

### 3.2 Batch 推理步骤（可写入 prompt 的算法思路）

1. **同 payee + 时间窗内的 GL 集合**  
   - 从当前审计上下文的 GL（或 pl_extract / 已选样本）中，取与当前行**同一 payee**、且 **GL_Date 在 D ±14 天（或 ±N 天，与现有 date_match 一致）** 的所有行。  
   - 包含当前行，得到集合 `G = { g1, g2, … }`，各自金额 `A1, A2, …`，总和 `S = Σ Ai`。

2. **在银行流水中找「总和」匹配**  
   - 在 Tier 1 银行流水中搜索：  
     - `bank_payee` 与 P 一致（或归一化匹配）；  
     - `bank_txn_date` 在 D ±14 天（或与 G 的日期范围相交）；  
     - `bank_amount ≈ S`（±$10 或 ±1%，与现有 amount 容差一致）。  
   - 若存在唯一或最合理的一笔 `B`，则视为「该 batch 对应的银行交易」。

3. **关联与一致性**  
   - 将当前 GL 行关联到 `B`，并记录：  
     - 该笔银行交易总金额 = `B.amount`；  
     - 参与该 batch 的 GL 行（GL_ID 或可区分标识）及各自金额；  
     - 总和 `S` 与 `B.amount` 的对比（observed）。  
   - 若同一 bank tx 已被其他 GL 行（同 batch）关联过，应一致：同一 batch 共享同一 `source_doc_id`、`bank_date`、`bank_txn_total`。

4. **reference_traceable 在 batch 下的处理**  
   - 若银行 reference 能识别为「批量/多发票」（例如批号、总 ref）且与 payee/金额/日期一致 → 可判 `passed = true`，note 写明 batch。  
   - 若 reference 缺失或完全无法与发票对应 → 建议 RISK_FLAG 而非 FAIL，note 写明「Batch payment; ref not itemised」。

### 3.3 清晰定位：什么是「一笔 Batch」

- **定义**：同一银行交易（同一 bank tx id / 同页同描述同金额的一笔）对应多笔 GL 行，且这些 GL 行：  
  - 同一 payee；  
  - 日期在约定时间窗内；  
  - 金额之和与该银行交易金额在容差内。  
- **定位方式**：  
  - 以**银行侧**为锚：先找到「金额 = 多笔 GL 之和」的那笔 bank tx，再反推「哪些 GL 属于这笔 batch」。  
  - 或以**GL 侧**为锚：对当前 GL 做 P1 失败后，做 P2 聚合同 payee 同窗 GL，再在银行中找总和匹配。两者在逻辑上等价，实现时选其一即可（建议以 GL 为入口，便于逐行输出）。

### 3.4 有效检测的约束（避免误判）

- **防止误把「无关大额」当 batch**：  
  - 必须满足：batch 内 GL 的 **payee 一致**、**日期窗合理**、**金额和与银行一致**。  
  - 可选：要求 batch 内至少有 2 条 GL（避免「单笔刚好等于某笔大额」被当 batch；若业务上允许 1:1 也可不强制）。

- **与 split_payment_check 区分**：  
  - Split：多笔**付款**（多笔银行交易）对应一大额支出，关注未授权拆单。  
  - Batch：多笔**支出/GL** 对应一笔付款。检测时先做 P1 单笔，再做 P2 batch，不做「把多笔 bank tx 加总去对单笔 GL」的 batch 逻辑。

- **证据链**：  
  - 每个 batch 内的 GL 行，其 `payment.evidence.source_doc_id` / `page_ref` 指向**同一笔**银行交易；  
  - `observed` / `note` 或 `batch_payment.gl_ids_in_batch` 能还原「这批 GL 共同对应哪笔 bank tx、总金额多少」，便于 Forensic 展示。

---

## 四、与现有组件的衔接（不改代码的边界）

- **Prompt（phase_3_expenses.ts / output_registry）**：  
  - 在 STEP P1 之后增加「若 P1 无单笔匹配，则执行 P2 Batch 推理」的条文；  
  - 明确 P2 的入口条件、聚合规则（同 payee、同窗、求和）、银行匹配条件、以及输出方式（PAID + batch 元数据或 note）。

- **Schema / 类型（可选）**：  
  - 若采用方案 A，在 `payment` 下增加可选 `batch_payment?: { ... }`，便于 UI 和 Forensic 解析；  
  - 若暂不扩 schema，可仅用 `amount_match.observed` 与 `evidence.note` 约定固定句式（如 "Batch payment: …"），由 UI 做简单解析显示「Batch Payment」标签。

- **UI / Forensic**：  
  - 当存在 `batch_payment` 或 note 中含 "Batch payment" 时，展示「Batch Payment」标签；  
  - Forensic 弹窗中列出「该笔银行交易对应的其他 GL 行（GL_ID / 金额）」，形成「多 GL → 单 bank tx」的可视链。

- **Overall_Status**：  
  - 保持现有规则：PAID（含 batch 情形）+ 其他 CRITICAL 通过 + 发票有效 + 基金正确 → PASS；batch 导致 reference_traceable 不足时可 RISK_FLAG，不直接 FAIL。

---

## 五、一句话结论与建议顺序

- **结论**：把 batch payment 定义为「多 GL ↔ 单 bank tx」的**允许匹配形态**，在 P1 单笔匹配失败后增加 P2 Batch 推理路径；用「PAID + 可选 batch 元数据 / note」表达，不把 batch 当缺失也不当违规，只在组合不清时 RISK_FLAG。  

- **建议落地顺序**：  
  1. 在 Phase 3 规则 / prompt 中**明确 P2 Batch 的触发条件与步骤**（同 payee、同窗、求和、银行匹配）；  
  2. 约定 **output 表达**（observed/note 或 `batch_payment` 可选字段）；  
  3. 再视需要扩展 **schema** 与 **UI/Forensic** 的展示（Batch 标签 + 关联 GL 列表）。

这样可以在不破坏现有 1:1 逻辑和 CRITICAL checks 的前提下，把 batch 纳入体系并实现可解释、可审计的检测。
