# Phase 4 Table C.3 – Prior Year 折叠列方案分析

## 一、可行性

**可以落地**。数据已存在于 `bs_extract.rows`，`balance_sheet_verification` 与 `bs_extract.rows` 能通过 `(line_item, fund, section)` 建立映射，无需改动 schema 或 prompt。

---

## 二、数据来源

| 字段 | 来源 | 说明 |
|------|------|------|
| `prior_year` | `bs_extract.rows[].prior_year` | 匹配 `(line_item, fund, section)` |
| `prior_year_label` | `bs_extract.prior_year_label` | 如 "2023" |
| 来源说明 | 固定文案 | "From bs_extract prior_year" |

**匹配逻辑**：
```ts
const bsRows = safeData.bs_extract?.rows ?? [];
const matchKey = (i: BalanceSheetVerificationItem) =>
  `${(i.line_item || '').trim()}|${(i.fund || 'N/A')}|${(i.section || 'ASSETS')}`;
const bsRowMap = new Map(bsRows.map((r) => [matchKey(r), r]));
// 对每个 verification item:
const bsRow = bsRowMap.get(matchKey(item));
const priorYearAmount = bsRow?.prior_year ?? null;
```

---

## 三、UI 行为设计

### 3.1 三种显示模式

| 模式 | 说明 | 列宽 | 显示内容 |
|------|------|------|----------|
| **隐藏** | 用户关闭 Prior Year 列 | 0（不渲染该列） | - |
| **折叠** | 默认 | ~56px | "PY" 标签 + 小号金额（如 `1,234`） |
| **展开** | 点击表头图标展开 | ~14% | 金额 + year label + 来源文案，可带 Forensic 追溯 |

### 3.2 表头控件（卡片式）

在 Table C.3 标题区增加一个「Prior Year」卡片：

```
┌─ Prior Year ────────────────────────┐
│ ☑ Show column   [▼] Expand / [▶] Collapse │
└─────────────────────────────────────┘
```

- **Show column**：复选框，控制是否显示该列；可持久化到 `localStorage`
- **Expand / Collapse**：控制折叠 / 展开

### 3.3 折叠态单元格

```
┌─────────┐
│ PY 1,234│   ← 小号字体，右对齐
└─────────┘
```

- 无数据时：`–`
- 有 `prior_year`：显示 `PY` + 格式化金额
- 可加 tooltip：`{prior_year_label} | From bs_extract prior_year`

### 3.4 展开态单元格

- 使用 `ForensicCell` 或同等样式，`TraceableValue` 为：
  - `amount`: `bsRow.prior_year`
  - `source_doc_id`: `core_data_positions.balance_sheet.doc_id`
  - `page_ref`: `{page_range} › {prior_year_label}`
  - `note`: `From bs_extract prior_year ({line_item})`
- 支持点击金额 → PDF 定位（与现有 BS Amount 一致）

---

## 四、实现步骤

### Step 1：状态与持久化

```tsx
const [pyVisible, setPyVisible] = useState(() => {
  try {
    const v = localStorage.getItem('phase4-py-column-visible');
    return v === null ? true : v === 'true';
  } catch { return true; }
});
const [pyExpanded, setPyExpanded] = useState(false);

useEffect(() => {
  try { localStorage.setItem('phase4-py-column-visible', String(pyVisible)); } catch {}
}, [pyVisible]);
```

### Step 2：辅助函数

```tsx
function getPriorYearForItem(
  item: BalanceSheetVerificationItem,
  bsExtract: BsExtract | null
): { amount: number | null; label: string } | null {
  if (!bsExtract?.rows?.length) return null;
  const key = `${(item.line_item||'').trim()}|${(item.fund||'N/A')}|${(item.section||'ASSETS')}`;
  const row = bsExtract.rows.find(
    (r) => `${(r.line_item||'').trim()}|${(r.fund||'N/A')}|${(r.section||'ASSETS')}` === key
  );
  if (!row || row.prior_year == null) return null;
  return { amount: row.prior_year, label: bsExtract.prior_year_label || 'Prior' };
}
```

### Step 3：表头区

在 `<div className="border-b-2 border-[#004F9F] pb-3 mb-6">` 内，标题下方增加 Prior Year 控件区（仅在 `bs_extract?.rows?.length > 0` 时渲染）。

### Step 4：表格结构调整

- `colgroup`：根据 `pyVisible` 动态插入 Prior Year 列
- `thead`：增加 `<th>Prior Year</th>`（带展开/折叠图标）
- `tbody`：每行增加对应单元格，根据 `pyExpanded` 渲染折叠/展开内容
- `colSpan`：分组行 `colSpan` 从 6 调整为 7（显示 Prior Year 时）

### Step 5：边界情况

- `bs_extract` 为空：不渲染 Prior Year 列，或显示占位提示
- 匹配不到对应行：该格显示 `–`
- `prior_year === 0`：显示 `0.00`，不作为「无数据」

---

## 五、与现有架构的兼容性

| 方面 | 影响 |
|------|------|
| Schema / Types | 无变更，只用 `bs_extract.rows[].prior_year` |
| Prompt / AI | 无变更 |
| ForensicCell | 展开态复用，只需构造正确的 `TraceableValue` |
| 列顺序 | BS Amount → Prior Year (可选) → Supporting → Status → Note |

---

## 六、可选增强

1. **tooltip**：折叠态悬停显示完整 note
2. **键盘**：表头聚焦时 Enter/Space 切换展开/折叠
3. **动画**：列宽变化加 `transition` 使展开/折叠更平滑

---

## 七、小结

- 方案一可行：数据齐全，无需 schema 改动。
- 实现成本：约 80–120 行 UI + 约 20 行辅助逻辑。
- 建议先实现「显示/隐藏 + 折叠/展开」，再按需加 tooltip 和 transition。
