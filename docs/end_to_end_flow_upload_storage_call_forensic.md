# 端到端信息流：Upload → Storage → Save → 调用 → 返回 → Reference → Forensic PDF Preview

## 1. Upload（前端）

- **入口**：`App.tsx` 中创建计划时 `createPlanAndSave(files)` → `uploadPlanFiles(storage, userId, planId, files)`。
- **实现**：`src/services/planPersistence.ts` 的 `uploadPlanFiles`。
- **路径规则**：`base = users/{userId}/plans/{planId}`，每个文件 `path = base + "/" + safeFileName(f.name, i)`；`safeFileName` 会做文件名安全化并在 `index > 0` 时加前缀 `{index}_`（如 `1_Invoice.pdf`）。
- **结果**：返回 `paths: string[]`（完整 Storage 路径）。

**一致性**：路径格式唯一，与后端、Firestore、load 使用同一约定。

---

## 2. Storage（Firebase Storage）

- **写入**：`ref(storageInstance, path)` + `uploadBytes(storageRef, f, { contentType })`。
- **路径**：与 Upload 一致，如 `users/uid/plans/planId/1_Invoice.pdf`；追加证据在 `users/uid/plans/planId/additional/run_{runId}/fileName`。
- **读取**：前端 `loadPlanFilesFromStorage` 用 `getDownloadURL(storageRef)` + fetch → Blob → `new File([blob], path.split("/").pop(), ...)`，即 **File.name = path 的 basename**（如 `1_Invoice.pdf`）。后端 `bucket.file(p).download()`，传给模型时 `name = p.split("/").pop()`，与前端一致。

**一致性**：同一 path 在上传、下载、后端拉取时一致；文件名取 path 最后一段，前后端一致。

---

## 3. Save（Firestore）

- **写入**：`savePlanToFirestore(db, planId, { ..., filePaths, fileMeta, result, ... })`。`filePaths` 为 Upload 返回的完整路径数组；追加证据的路径保存在 `additional_runs[].file_paths`。
- **订阅**：`subscribePlanDoc(db, planId, onUpdate)` 实时同步 plan（含 `filePaths`、`result`、`additional_runs`）。
- **加载**：`getPlansFromFirestore` 或 snapshot 得到 `PlanDoc`，含 `filePaths`、`result.document_register` 等。

**一致性**：Storage 路径原样写入 Firestore，无转换；调用与 Forensic 都依赖同一 `filePaths` / `additional_runs[].file_paths`。

---

## 4. 调用（Cloud Function + 后端）

- **请求**：前端 `callExecuteFullReview({ filePaths, ... })`，body 含 `filePaths`（及可选 `additionalRunPaths`）。
- **后端**：`functions/index.js` 校验 `body.filePaths` 数组非空，`basePaths = body.filePaths`，`allPaths = basePaths` 或 basePaths + additionalRunPaths；对每个 `p` 执行 `bucket.file(p).download()`，`name = p.split("/").pop()`，组成 `files = [{ name, data: base64, mimeType }, ...]`。
- **Manifest**：`fileManifest = "File Part 1: {name1}\nFile Part 2: {name2}..."`，与 `files` 顺序一致。
- **模型**：Prompt 要求 “Document_Origin_Name 与 filename 严格一致”，即 `Document_Origin_Name` = 上述 `name`（path 的 basename，如 `1_Invoice.pdf`）。

**一致性**：后端只用 path 拉文件，不依赖前端再传 base64；传给模型的 “filename” 与 Storage path 的 basename 一致，与后续 document_register 的 Document_Origin_Name 一致。

---

## 5. 返回（Response）

- **内容**：`result` 含 `document_register`（每行 `Document_ID`、`Document_Origin_Name`、Evidence_Tier 等）、各 phase 的 TraceableValue（`source_doc_id`、`page_ref`、`note`）。
- **Traceability**：所有证据引用通过 `source_doc_id` → document_register 的 `Document_ID`；展示/定位通过 `Document_Origin_Name` → 对应文件。

**一致性**：Document_Origin_Name 与后端 manifest 的 filename（path basename）一致；source_doc_id 仅指向 document_register，不直接存 path。

---

## 6. Reference（报告内引用）

- **规则**：`source_doc_id` 必须为 document_register 的 `Document_ID`（如 Sys_001）；禁止用 “-” 等占位当有实际文档时。
- **解析**：UI 用 `docs.find(d => d.Document_ID === val.source_doc_id)` 得到 `doc`，再用 `doc.Document_Origin_Name` 解析“哪个文件”。

**一致性**：引用链唯一：source_doc_id → Document_ID → Document_Origin_Name → 文件（内存 File 或 Storage path）。

---

## 7. Forensic PDF Preview（当前与修复后）

- **当前**：`ForensicCell` 与 `ExpenseForensicPopover` 通过 `findFileByName(files, doc.Document_Origin_Name)` 在 **内存 File[]** 中找文件，再用 `URL.createObjectURL(targetFile)` 在 iframe 中预览。
- **命名匹配**：`findFileByName` 做了前缀/空格/下划线等规范化（`norm()`），与 `loadPlanFilesFromStorage` 得到的 `File.name`（path basename）一致；与后端 manifest / Document_Origin_Name 一致。
- **问题**：刷新或仅从 Firestore 恢复时，若未执行 `loadPlanFilesFromStorage`，`activePlan.files` 为空，Forensic 无法找到文件，提示 “Original source file not found in current session”。

**修复**：在以 Storage 为真源的前提下，当 `files` 为空但存在 `filePaths`（及 `additional_runs[].file_paths`）时，用 **Document_Origin_Name 解析出 Storage path**，再通过 **getDownloadURL(ref(storage, path))** 得到 PDF URL，在 iframe 中预览，与 “不强制 re-load 即可运行” 的设计一致。

---

## 8. 一致性检验结果汇总

| 环节 | 一致性 | 说明 |
|------|--------|------|
| Upload → Storage path | ✅ | 同一 path 格式，safeFileName 与 path 构造一致。 |
| Storage path → Save (Firestore) | ✅ | filePaths 原样保存，无改写。 |
| Firestore filePaths → 调用 | ✅ | 前端传 filePaths，后端 bucket.file(p)，path 一致。 |
| 后端 files[] → Manifest / 模型 | ✅ | name = path.split("/").pop()，Document_Origin_Name 与 prompt 要求一致。 |
| 返回 document_register → Reference | ✅ | source_doc_id → Document_ID → Document_Origin_Name。 |
| Document_Origin_Name → 内存 File | ✅ | loadPlanFilesFromStorage 的 File.name = path basename；findFileByName 与 norm() 匹配。 |
| Document_Origin_Name → Forensic（无 files 时） | ⚠️→✅ | 修复前依赖 files；修复后可用 filePaths + getDownloadURL 按需拉取预览。 |

**结论**：端到端 path 与文件名约定一致；唯一缺口为“刷新后 Forensic 依赖内存 File”。通过“按 Document_Origin_Name 从 filePaths/additional_runs 解析 path 并用 getDownloadURL 预览”补齐后，整条链路与 Storage 为唯一真源一致。
