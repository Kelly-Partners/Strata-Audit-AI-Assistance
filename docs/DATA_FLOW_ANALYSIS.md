# 数据流完整梳理：Upload → Storage → AI → 回存 → 显示 → PDF 预览 → UI

## 一、整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    前端 (React)                                          │
│  Plan { files: File[], filePaths?: string[], fileMeta?, result?, additional_runs? }     │
└───────┬──────────────────────┬──────────────────────┬──────────────────────────────────┘
        │                      │                      │
        ▼                      ▼                      ▼
   FileUpload            uploadPlanFiles        loadPlanFilesFromStorage
   (内存 File[])     →   Storage 上传      ←    (从 Storage 拉回 File[])
        │                      │                      │
        │                      ▼                      │
        │              Firestore plan 文档             │
        │              { filePaths, fileMeta,         │
        │                result, additional_runs }    │
        │                      │                      │
        │                      │ callExecuteFullReview│
        │                      │ { filePaths }        │
        └──────────────────────┼──────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              Cloud Function (index.js)                                    │
│  1. 校验 filePaths                                                                       │
│  2. bucket.file(path).download() 从 Storage 拉取                                         │
│  3. 转 base64，构建 fileManifest                                                         │
│  4. executeFullReview → Gemini                                                           │
│  5. 返回 JSON result                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、各场景数据流

### 2.1 创建计划 (handleCreatePlanConfirm)

| 步骤 | 动作 | 数据 |
|------|------|------|
| 1 | 用户选择文件 | `createDraft.files: File[]` |
| 2 | 点击 Create | `createPlan(files)` → Plan 含 `files` |
| 3 | `uploadPlanFiles(storage, uid, planId, files)` | 上传到 `users/{uid}/plans/{planId}/{safeFileName}` |
| 4 | 得到 `filePaths: string[]` | 如 `["users/uid/plans/pid/0_Invoice.pdf"]` |
| 5 | `savePlanToFirestore(db, planId, { filePaths, fileMeta })` | 持久化路径 |
| 6 | `updatePlan(id, { filePaths, fileMeta })` | 本地 state 同步 |

**路径格式**：`safeFileName(f.name, i)` → `0_Invoice.pdf`（index>0 时加前缀）

---

### 2.2 Step 0 / Call 2 / Full / AI Attempt 调用

| 步骤 | 动作 | 数据 |
|------|------|------|
| 1 | 前置条件 | `targetPlan.files.length > 0`（需有文件才能跑） |
| 2 | `uploadPlanFiles(storage, uid, planId, targetPlan.files)` | 上传到主目录，覆盖/追加 |
| 3 | 得到 `filePaths` | 用于请求体 |
| 4 | `callExecuteFullReview({ filePaths, mode, ... })` | POST body 只传路径，不传 base64 |
| 5 | 后端从 Storage 拉取 | `bucket.file(path).download()` → base64 |
| 6 | 后端构建 fileManifest | `File Part 1: 0_Invoice.pdf`（path.split("/").pop()） |
| 7 | Gemini 输出 | `Document_Origin_Name: "0_Invoice.pdf"`（与 manifest 一致） |
| 8 | `savePlanToFirestore` 写入 result、filePaths | Firestore 更新 |
| 9 | `setPlans` 更新本地 | Plan.result、Plan.filePaths |

**文件来源**：
- 新建计划后直接 Run：`targetPlan.files` 来自 createDraft
- 刷新后 Run：`targetPlan.files` 来自 `loadPlanFilesFromStorage`（见 2.5）
- 主 FileUpload 追加文件后 Run：`targetPlan.files` 含新旧所有文件

---

### 2.3 Expenses Additional（补充证据）

| 步骤 | 动作 | 数据 |
|------|------|------|
| 1 | 用户选择新文件 | `additionalFiles: File[]` |
| 2 | `uploadAdditionalRunFiles(..., runId, newFiles)` | 上传到 `users/.../plans/{planId}/additional/run_{runId}/` |
| 3 | 得到 `additionalPaths: string[]` | |
| 4 | `callExecuteFullReview({ filePaths: targetPlan.filePaths, additionalRunPaths: { runId, paths } })` | 主路径 + 补充路径 |
| 5 | 后端 `allPaths = [...basePaths, ...additionalRunPaths.paths]` | 先主后补 |
| 6 | 后端 effectiveMeta | 主文件 `batch: "initial"`，补充文件 `batch: "additional"` → manifest 带 `[ADDITIONAL]` |
| 7 | 写入 `expense_runs`、`additional_runs` | Firestore |

**依赖**：`targetPlan.filePaths` 必须已有（来自之前的 Step 0/Call 2），否则 `targetPlan.filePaths ?? []` 为空，主文件缺失。

---

### 2.4 刷新后加载计划

| 步骤 | 动作 | 数据 |
|------|------|------|
| 1 | `getPlansFromFirestore(db, uid)` | 得到 `PlanDoc[]` 含 `filePaths`、`additional_runs` |
| 2 | 映射为 Plan | `files: []`，`filePaths: p.filePaths` |
| 3 | 用户点击某计划 | `setActivePlanId(id)` |
| 4 | `useEffect` 触发 | `activePlan.filePaths?.length > 0 && activePlan.files.length === 0` |
| 5 | `loadPlanFilesFromStorage(storage, filePaths, additional_runs)` | 合并主路径 + 各 run 的 file_paths |
| 6 | 按 path 拉取 | `getDownloadURL` → fetch → blob → `new File([blob], path.split("/").pop())` |
| 7 | `updatePlan(id, { files: loaded, fileMeta })` | 本地 Plan 有 files，可跑审计、PDF 预览 |

**文件名一致性**：`path.split("/").pop()` = `0_Invoice.pdf`，与 manifest、Document_Origin_Name 一致。

---

### 2.5 PDF 预览与 Forensic 追溯

| 步骤 | 动作 | 数据 |
|------|------|------|
| 1 | AuditReport 接收 `files: File[]` | 来自 `activePlan.files` |
| 2 | ForensicCell / ExpenseForensicPopover | 用 `source_doc_id` → document_register → `Document_Origin_Name` |
| 3 | `findFileByName(files, Document_Origin_Name)` | 匹配 File.name |
| 4 | 匹配规则 | 精确匹配 → 忽略大小写 → 去掉 `\d+_` 前缀 → norm 归一化 |
| 5 | `URL.createObjectURL(targetFile)` | 内存 File → blob URL |
| 6 | `#page=N` 锚点 | 跳转到指定页 |

**一致性**：AI 的 `Document_Origin_Name` 来自 manifest 的 `path.split("/").pop()`，与 `loadPlanFilesFromStorage` 的 `File.name` 一致，`findFileByName` 可正确匹配。

---

### 2.6 UI 展示

| 组件 | 数据来源 | 说明 |
|------|----------|------|
| Evidence Files | `activePlan.files` | FileUpload 显示，支持追加 |
| AuditReport | `activePlan.result` + `activePlan.files` | 表格、ForensicCell、PDF 预览 |
| Traceable Items 数量 | `getEffectiveExpenseSamples(result).length + levy master_table` | 侧边栏 |
| Next Step 禁用 | `activePlan.files.length === 0` | 必须有 files 才能 Run |
| 骨架屏 | `status === "processing" && !result` | 有 result 时不盖住已完成内容 |

---

## 三、一致性检查（Storage 架构）

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 上传路径 ↔ 后端拉取路径 | ✅ | 同一格式 `users/{uid}/plans/{pid}/...` |
| fileManifest 文件名 ↔ Document_Origin_Name | ✅ | 均来自 path.split("/").pop() |
| Document_Origin_Name ↔ File.name (loadPlanFiles) | ✅ | 同上 |
| findFileByName 匹配 | ✅ | 支持 `0_Invoice.pdf` 与 `Invoice.pdf` 等变体 |
| expenses_additional 主+补合并 | ✅ | allPaths = basePaths + additionalPaths，effectiveMeta 正确 |
| fileMeta 与 filePaths 长度 | ⚠️ | create 时 fileMeta 与 files 等长；load 时若 meta 缺用默认，需保持长度一致 |

---

## 四、潜在漏洞与改进

### 4.1 已识别的潜在问题

| 问题 | 影响 | 建议 |
|------|------|------|
| **deletePlanFilesFromStorage 未递归** | `listAll` 仅返回直接子项，`additional/run_xxx/` 下文件不会被删除 | 递归 list 并 delete，或调用 `listAll` 对每个 prefix 再 list |
| **create 后立即 Run 的重复上传** | handleCreatePlanConfirm 已上传，Step 0 又 `uploadPlanFiles` 一次 | 可选优化：若 plan 已有 filePaths 且 files 未变，可跳过上传；当前逻辑正确但冗余 |
| **expenses_additional 时 filePaths 为空** | 若 plan 从 Firestore 加载且 filePaths 未持久化（异常流程），主文件会缺失 | 前端已有 `targetPlan.filePaths ?? []`，必要时可考虑从 Firestore plan 再读一次 |

### 4.2 逻辑融洽性

- **Run 前必须有 files**：所有 handler 都检查 `targetPlan.files.length > 0`，refresh 后依赖 `loadPlanFilesFromStorage` 回填，流程闭环。
- **filePaths 写入时机**：create 后、每次 Run 后都会 `savePlanToFirestore` 写入 filePaths，Firestore 与本地一致。
- **AI Attempt 的 fileMeta**：后端用 fileMeta 生成 `[ADDITIONAL]` 标记，与 filePaths 一一对应，逻辑正确。
- **expenses_additional 的 fileMeta**：后端用 effectiveMeta（主=initial，补=additional）构建 manifest，无需前端传 fileMeta。

---

## 五、结论

**Storage 架构改动后的数据流是完整且自洽的**。主要验证点均通过：

1. 上传 → Storage 路径 → 后端拉取 → Gemini → 返回 result，链路完整。
2. 刷新后 loadPlanFilesFromStorage 正确还原 files，供 Run 与 PDF 预览使用。
3. Document_Origin_Name 与 File.name 一致，findFileByName 可正确解析。
4. expenses_additional 主路径 + 补充路径合并与 [ADDITIONAL] 标记正确。

**建议修复**：`deletePlanFilesFromStorage` 递归删除 `additional/` 下文件，避免删除计划后 Storage 残留。
