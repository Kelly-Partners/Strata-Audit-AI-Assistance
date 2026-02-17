# Old/New Rate Levies (Primary = amounts+dates in FY, Fallback = time-apportion) – 一致性检查报告

## 一、Prompt 一致性

| 来源 | PRIMARY | FALLBACK | 与 phase_2_revenue 一致 |
|------|---------|----------|--------------------------|
| **phase_2_revenue.ts** | 从 minutes 取具体金额与 payment/due dates；用 LOCKED intake_summary.financial_year 筛「date 落在 FY 内」；按 minutes 的 old/new 加总 → 输出六项。 | minutes 无 payment-level 时：取 adoption date，FY 划季度，按比例 (days or months) 归 Old/New。note/computation 写明方法。 | ✓ 基准 |
| **phase_2_rules.ts** (levy_old_new_rate, levy_old_new_levies_source) | 用 minutes 的 amounts + payment/due dates，按 LOCKED FY 过滤。 | 无 payment-level 时用 adoption date + FY 做 time-apportion。 | ✓ 一致 |
| **output_registry.ts** (MODULE 50) | 同上：amounts + payment/due dates；FY 过滤；sum by Old vs New。 | 无 payment-level 时 adoption date + time-apportion。note/computation 写明方法。 | ✓ 一致 |

**结论：** 三处 PRIMARY/FALLBACK 逻辑一致，无前后矛盾。

---

## 二、发现的 Bug / 不一致

### 1. output_registry.ts 第 69 行 – 与 PRIMARY 矛盾的句子（已修复）

**原问题：** 段落开头曾保留「You MUST time-apportion Old Rate Levies and New Rate Levies by the strata plan's **LOCKED financial year from Step 0**.」，与「PRIMARY 优先、FALLBACK 备用」矛盾。

**修复：** 已用 Node 脚本（UTF-8 安全）删除该句；现段落以「Source ONLY from minutes. **PRIMARY (preferred):**」开头。

---

## 三、Output / Schema

| 项目 | 检查结果 |
|------|----------|
| **master_table 六字段** | Old_Levy_Admin, Old_Levy_Sink, Old_Levy_Total, New_Levy_Admin, New_Levy_Sink, New_Levy_Total 仍为 TraceableValue；PRIMARY 与 FALLBACK 均输出同结构，无需改 schema。 |
| **TraceableValue** | amount, source_doc_id, page_ref, note, verbatim_quote, computation?；PRIMARY 可主要用 note 说明「Amounts and dates from minutes; filtered to FY; sum by old/new」；FALLBACK 用 computation。无 schema 冲突。 |
| **MODULE 50 JSON schema** | 未要求 payment/dates 等新字段；仍为六项 TraceableValue。✓ |

---

## 四、Calculation formula（(B1), (B), (C) 等）

| 公式 | 依赖 | 检查结果 |
|------|------|----------|
| **(B1)** Sub_Levies_Standard_Admin = Old_Levy_Admin + New_Levy_Admin（Sink/Total 同理） | Old_Levy_*, New_Levy_* | 仍成立；PRIMARY/FALLBACK 均产出该六项。✓ |
| **(B)** Sub_Admin_Net = Sub_Levies_Standard_Admin + Spec_Levy_Admin + Interest − Discount | (B1), Spec_Levy, Interest, Discount | 不变。✓ |
| **(C)** GST = 10% × Sub_Levies_Standard_* 等 | (B1) | 不变。✓ |
| **Interest/Discount 按比例分配** | Sub_Levies_Standard_Admin/Sink/Total | 先有 Old+New → (B1)，再算 Interest/Discount；顺序正确。✓ |

**结论：** 无公式错误，无循环依赖。

---

## 五、UI（AuditReport.tsx）

| 项目 | 检查结果 |
|------|----------|
| **Old Rate Levies 行** | 展示 master_table.Old_Levy_Admin, Old_Levy_Sink, Old_Levy_Total + note。✓ |
| **New Rate Levies 行** | 展示 New_Levy_Admin, New_Levy_Sink, New_Levy_Total + note。✓ |
| **(B1) STANDARD LEVIES** | 展示 Sub_Levies_Standard_Admin/Sink/Standard。✓ |
| **ForensicCell** | 接受 TraceableValue（含 note、可选 computation）；PRIMARY 与 FALLBACK 均适用。✓ |

**结论：** 无需改 UI；字段与结构未变。

---

## 六、调用链

| 环节 | 检查结果 |
|------|----------|
| **buildLevyPrompt()** | 拼接 PHASE_2_REVENUE_PROMPT + PHASE_2_RULES_PROMPT + MODULE_50_OUTPUTS_PROMPT + LEVY_OUTPUT_SCHEMA。✓ |
| **Call 2 mode = levy** | 传入 previousAudit（含 intake_summary.financial_year）；geminiReview 注入 LOCKED context。✓ |
| **Phase 2 输入** | LOCKED step0Output 含 financial_year；PRIMARY 所需 FY 可用。✓ |

**结论：** 调用与输入无缺漏，无 bug。

---

## 七、总结

| 类型 | 数量 | 说明 |
|------|------|------|
| **逻辑不一致/矛盾** | 0 | 已修复：output_registry 中矛盾句已删除。 |
| **Schema/公式/UI/调用** | 0 | 无 bug；PRIMARY/FALLBACK 共用同一 output 结构与下游公式。 |
| **编码问题** | 0 | 已用 search_replace 恢复 PRIMARY/FALLBACK 段落，未再用 PowerShell 改该文件。 |

**建议操作：** 无；矛盾句已移除。
