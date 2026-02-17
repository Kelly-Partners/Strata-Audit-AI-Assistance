# Phase 2–5 灵活调用架构构思

## 一、当前架构痛点

### 1. 多次上传 (Multiple Uploads)

| 调用 | 发送内容 | 问题 |
|------|----------|------|
| Step 0 | 全部 files (base64) | 首次上传，必要 |
| Call 2 (4 路并行) | 每次均发送 全部 files + step0Output | **同一批文件上传 4 次** |
| AI Attempt | 全部 files + 完整 result + targets | 再上传 1 次 |
| Phase 6 | 全部 files + 完整 result | 再上传 1 次 |

**影响**：大 PDF 包 × 6+ 次请求 = 带宽浪费、请求体膨胀、潜在超时。

---

### 2. 缺乏 Phase 粒度控制

- Call 2 固定跑 levy + phase4 + expenses + compliance，无法单选或部分重跑。
- 若 Phase 4 失败/需重核，只能整体重跑 Call 2。
- 无法「只跑 Phase 2」或「只跑 Phase 4」做快速验证。

---

### 3. 上下文重复传递

- 每次 Call 2 phase 均携带完整 `step0Output`（document_register、intake_summary、core_data_positions、bs_extract）。
- AI Attempt / Phase 6 携带完整 `result`（含 Step 0 + 所有 Phase 输出）。
- 增加 token 消耗与请求体大小。

---

## 二、设计目标

1. **灵活 Phase 选择**：支持选择性地运行 Phase 2/3/4/5 的子集。
2. **减少上传**：同一批文件在一次会话内只上传/传输一次。
3. **单 Phase 重跑**：支持对单个 Phase 重跑而不重跑全部。
4. **保持现有工作流**：Step 0 → Call 2 → AI Attempt → Phase 6 仍可用，作为快捷路径。

---

## 三、架构方案构思

### 方案 A：File Refs 替代 Base64（后端按需拉取）——✅ 已落地

**思路**：前端只上传到 Firebase Storage，请求体只传 `filePaths`（storage path），Cloud Function 用 Admin SDK 从 Storage 读取。

```
Frontend                          Cloud Function
   |                                    |
   |-- upload files to Storage ----------> (已有)
   |   (planId/file_xxx.pdf)              |
   |                                    |
   |-- POST { planId, mode, phase,       |
   |         filePaths: [path1, path2] } ->|
   |                                    |-- getFiles(storage, filePaths)
   |                                    |-- executePhase(files, step0)
   |<-- { levy_reconciliation } ---------|
```

**Pros**：
- 请求体不含 base64，体积小。
- 同一 plan 下多次调用可复用 Storage 中的文件。

**Cons**：
- Cloud Function 需 Storage 读权限。
- 需处理 plan 归属校验（仅本人 plan 可读）。
- 首次上传逻辑不变，但后续 Call 2/AI Attempt/Phase 6 不再传文件内容。

---

### 方案 B：批量 Phase 模式（单请求多 Phase）

**思路**：新增 mode `call2_select`，请求体带 `phases: ["levy", "phase4", "expenses", "compliance"]`，Cloud Function 内部按需执行，一次请求返回多段输出。

```
Frontend: POST {
  files,           // 仍可 base64，但只传一次
  mode: "call2_select",
  phases: ["levy", "phase4"],  // 用户勾选
  step0Output
}

Cloud Function:
  - 并行执行 levy、phase4
  - 合并返回 { levy_reconciliation, assets_and_cash }
```

**Pros**：
- 一次请求 = 一次文件上传。
- 用户可灵活选择跑哪些 Phase。
- 对前端改动较小（UI 加 Phase 勾选）。

**Cons**：
- 单次请求时间可能变长（取决于并行度）。
- 返回结构需支持「部分 key 存在」的合并逻辑（已有 merge 可复用）。

---

### 方案 C：Plan-Centric 调用（后端拉取完整上下文）

**思路**：请求只传 `planId` + `mode` + `phases`，Cloud Function 从 Firestore 读 plan（含 result、filePaths），从 Storage 读文件，无需前端传 files 或 step0Output。

```
Frontend: POST {
  planId,
  mode: "call2",
  phases: ["levy", "phase4"]
}

Cloud Function:
  1. 校验 user 对 planId 的访问权
  2. 从 Firestore 读 plan → result (含 step0), filePaths
  3. 从 Storage 读 files by filePaths
  4. 执行选中 phases，合并结果
  5. 写回 Firestore plan.result
  6. 返回增量/完整 result
```

**Pros**：
- 前端请求体极简。
- 文件与上下文均由后端统一管理。
- 天然支持「刷新后继续跑 Phase」等场景。

**Cons**：
- Cloud Function 需 Firestore + Storage 完整读权限。
- 必须保证 plan 已持久化（Step 0 完成后 result 已在 Firestore）。
- 新增/替换文件时需「增量更新」逻辑（如 AI Attempt 的 [ADDITIONAL]）。

---

### 方案 D：混合模式（常用路径优化 + 保留兼容）

**思路**：在不大改架构前提下，优先落地「减少上传」和「Phase 选择」。

| 场景 | 当前 | 优化后 |
|------|------|--------|
| Call 2 全量 | 4 次请求，4 次传 files | **方案 B**：1 次请求，phases=[2,3,4,5]，传 1 次 files |
| Call 2 部分 | 不支持 | **方案 B**：phases=[4]，仅跑 Phase 4 |
| 单 Phase 重跑 | 需重跑全部 | **方案 B**：phases=[4]，合并时只覆盖 assets_and_cash |
| 文件传输 | 每次 base64 | **方案 A（可选）**：Call 2/AI Attempt/Phase 6 用 fileRefs，Function 从 Storage 拉取 |

**实现顺序建议**：
1. 先做 **方案 B**：`call2_select` + `phases` 数组，前端加 Phase 勾选，一次请求多 Phase。
2. 再评估 **方案 A**：用 fileRefs 替代 base64，减少请求体积。
3. 若需更强「无状态前端」，再考虑 **方案 C**。

---

## 四、UI/UX 构思

### 1. Phase 选择（方案 B）

```
┌─ Call 2 配置 ─────────────────────────┐
│ 选择要执行的 Phase：                    │
│ □ Phase 2 – Levy Reconciliation       │
│ □ Phase 3 – Expenses Vouching         │
│ □ Phase 4 – Balance Sheet Verification│
│ □ Phase 5 – Statutory Compliance      │
│                                        │
│ [全选] [全不选]   [运行选中 Phase]     │
└────────────────────────────────────────┘
```

- 默认全选，与现有行为一致。
- 可只勾 Phase 4，实现「单 Phase 重跑」。
- 合并逻辑：只更新返回的 Phase 对应字段，其余保留。

### 2. 单 Phase 重跑快捷入口

在 Table C.3（Balance Sheet）或 Levy 表格旁增加：
- 「重跑 Phase 4」 / 「Re-run Phase 4」
- 点击后相当于 `phases: ["phase4"]`，其他 Phase 结果不动。

---

## 五、数据流与合并逻辑

### 合并规则（部分 Phase 返回时）

```
已有 result = {
  document_register, intake_summary, core_data_positions, bs_extract,  // Step 0
  levy_reconciliation,      // Phase 2
  assets_and_cash,          // Phase 4
  expense_samples,          // Phase 3
  statutory_compliance,     // Phase 5
}

本次只跑 phases: ["phase4"]，返回 { assets_and_cash }：
  merged = { ...已有 result, assets_and_cash: 新值 }
  其他 key 不变
```

AI Attempt 的 `mergeAiAttemptUpdates` 已是局部 patch 逻辑，可复用思路。

---

## 六、技术债务与注意事项

1. **Cloud Function 超时**：多 Phase 并行时，若总时长超 9 分钟，需考虑拆成多个 invocation 或使用 Cloud Run。
2. **Token 上限**：step0Output 较大时，4 Phase 并行会重复注入相同 context；方案 B 单请求可共享一份 context，略有优化。
3. **安全性**：方案 A/C 中，Function 必须校验 `planId` 归属当前 user，避免越权读取。

---

## 七、建议落地步骤

| 阶段 | 内容 | 预估改动 |
|------|------|----------|
| 1 | 方案 B：`call2_select` + `phases`，单请求多 Phase | gemini.ts、geminiReview.js、App.tsx |
| 2 | UI：Phase 勾选 + 「重跑 Phase X」按钮 | AuditReport.tsx、App.tsx |
| 3 | ~~方案 A（可选）：fileRefs 替代 base64~~ ✅ 已实现：filePaths 替代 base64 | gemini.ts、index.js、Storage 读逻辑 |
| 4 | 方案 C（可选）：planId 驱动、后端拉取上下文 | 需设计 Function 入口与鉴权 |

优先完成阶段 1–2，即可实现 Phase 2–5 灵活调用，并显著减少 Call 2 的请求次数与上传次数。
