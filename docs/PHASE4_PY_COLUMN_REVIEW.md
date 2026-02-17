# Phase 4 Prior Year 列实现审查

## 一、逻辑自洽性 ✅

| 检查项 | 状态 | 说明 |
|--------|------|------|
| pyVisible 计算 | ✅ | `pyColumnVisible && !!bs_extract?.rows?.length`，二者同时满足才显示列 |
| colSpan 与列数 | ✅ | pyVisible 时 7 列、colSpan=7；否则 6 列、colSpan=6 |
| 控制卡片显示 | ✅ | 仅当 `bs_extract?.rows?.length` 时渲染，与 pyVisible 条件一致 |
| 匹配逻辑 | ✅ | `(line_item, fund, section)` 与 output_registry 一致 |

---

## 二、边界情况

| 场景 | 处理 | 正确性 |
|------|------|--------|
| prior_year === 0 | 使用 `row.prior_year == null`，0 会通过并显示 "0.00" | ✅ |
| 匹配不到 bs_extract 行 | getPriorYear 返回 null → 显示 `–` | ✅ |
| bs_extract 空但 balance_sheet_verification 有数据 | 控制卡不显示，pyVisible=false，不渲染 Prior Year 列 | ✅ |
| Total/Subtotal 行 | 通常无对应 bs_extract 行 → 显示 `–` | ✅ |
| 刷新后 Expand 状态 | 不持久化，重置为折叠 | ⚠️ 可选增强 |

---

## 三、发现的潜在问题

### 1. 文案与功能略有出入（低优先级）

- 副标题写的是 "Current Year column only"，但已增加 Prior Year 列。
- 建议：可改为 "BS Amount = Current Year; Prior Year optional" 或保持现状，取决于产品定位。

### 2. 匹配键大小写

- `matchKey` 对 line_item、fund、section 做原样拼接，未统一大小写。
- 若 AI 输出 "Admin" vs "admin"，可能匹配失败。
- 当前规则通常输出一致，风险较低；如需更稳健，可考虑对 fund/section 做 normalize。

### 3. bs_extract.rows 中同 key 重复

- 使用 `Map` 时，相同 key 会互相覆盖。
- 按 schema，`(line_item, fund, section)` 应唯一，实际重复概率低，可暂不处理。

---

## 四、功能完整性

| 功能 | 状态 |
|------|------|
| Show column 勾选 / 取消 | ✅ |
| Expand / Collapse 切换 | ✅ |
| localStorage 持久化 Show column | ✅ |
| 折叠态：PY + 金额 + tooltip | ✅ |
| 展开态：ForensicCell + PDF 追溯 | ✅ |
| prior_year=0 显示 "0.00" | ✅ |
| 无匹配时显示 `–` | ✅ |

---

## 五、结论

实现逻辑清晰，边界处理正确，与现有架构兼容。仅存在少量低优先级优化点，无阻塞问题。

**可选增强**：
1. 持久化 `pyColumnExpanded`（如存 localStorage）
2. 更新副标题以明确 Prior Year 为可选
3. 对 fund/section 做大小写或空格归一化以提高匹配稳健性
