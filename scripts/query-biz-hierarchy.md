# 经营数据树查询脚本使用说明

`scripts/query-biz-hierarchy.mjs` 用于从 Supabase 读取经营 tab 页同源数据，并整理成适合大模型输入的树状 JSON。

## 基本用法

```bash
npm run biz:hierarchy -- --period=2026-04 --period-type=cumulative --report-type=tuwei --pretty
```

常用写入文件：

```bash
npm run biz:hierarchy -- --period=2026-04 --period-type=cumulative --report-type=tuwei --pretty --output=reports/biz-tree.json
```

## 环境变量

脚本会读取以下任一组 Supabase 配置：

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

或：

```text
SUPABASE_URL
SUPABASE_ANON_KEY
```

脚本会自动尝试读取仓库根目录和 `app/` 下的 `.env`、`.env.local`。

## 参数

| 参数 | 说明 |
| --- | --- |
| `--period=<期间>` | 查询期间。月度可传 `202604` 或 `2026-04`；累计口径传 `2026-04` 会自动转换为 `<202605`。 |
| `--period-type=<cumulative\|monthly>` | 期间类型，默认 `cumulative`。 |
| `--report-type=<fone\|tuwei>` | 报表口径。`fone` 为学年预算，`tuwei` 为突围考核。 |
| `--sheet-code=<1.1,2.1>` | 可选，按 `edu_biz_report.sheet_code` 过滤。 |
| `--node-name=<组织名>` | 可选，只输出指定组织的子树。 |
| `--org-scope-key=<组织路径>` | 可选，按完整组织路径精确输出子树，适合同名组织。 |
| `--list-periods` | 只列出当前 `period-type/report-type` 下数据库里可用的 period。 |
| `--pretty` | 格式化 JSON。 |
| `--output=<路径>` | 将 JSON 写入文件；不传则输出到终端。 |
| `--raw` | 输出未精简的原始结构，主要用于调试。 |

## 查询可用期间

```bash
npm run biz:hierarchy -- --period-type=cumulative --report-type=tuwei --list-periods --pretty
```

示例输出：

```json
{
  "period_type": "cumulative",
  "report_types": ["tuwei"],
  "periods": ["<202607", "<202606", "<202605"]
}
```

累计 period 使用右开区间。例如：

| 人类语义 | 数据库 period |
| --- | --- |
| 截至 2026 年 4 月累计 | `<202605` |
| 截至 2026 年 5 月累计 | `<202606` |
| 截至 2026 年 6 月累计 | `<202607` |

## 默认输出结构

默认输出是精简后的中文 JSON，适合直接输入给大模型：

```json
{
  "元数据": {
    "输入期间": "2026-04",
    "实际查询期间": "<202605",
    "期间类型": "累计",
    "报表口径": "突围考核",
    "原始记录数": 1374,
    "组织节点数": 105
  },
  "数据": {
    "组织": "智汇后勤集团",
    "组织路径": ["智汇后勤集团"],
    "层级": "集团合计",
    "指标": {
      "营业收入": {
        "实际": 22511.51,
        "预算": 28573.52,
        "完成率": 0.7878,
        "同期": 15214.9
      }
    },
    "下级": []
  }
}
```

## 输出字段说明

节点字段：

| 字段 | 说明 |
| --- | --- |
| `组织` | 当前组织节点名称。 |
| `组织路径` | 从集团到当前节点的路径数组。 |
| `层级` | `集团合计`、`一级组织`、`二级组织`、`明细组织` 或 `未归类组织`。 |
| `指标` | 当前节点的经营指标。 |
| `下级` | 子节点数组；无子节点时省略。 |

指标字段：

| 字段 | 说明 |
| --- | --- |
| `实际` | 当前口径实际值。 |
| `预算` | 当前口径预算或考核值。 |
| `完成率` | `实际 / 预算`，保留 4 位小数。 |
| `同期` | 同期值。 |

空值字段会被省略，以减少大模型上下文噪声。

## 在其他脚本或 skill 中调用

ESM 调用示例：

```js
import { queryBizHierarchy } from './scripts/query-biz-hierarchy.mjs'

const result = await queryBizHierarchy({
  period: '2026-04',
  periodType: 'cumulative',
  reportTypes: ['tuwei'],
  nodeName: '东部区域',
})

console.log(JSON.stringify(result, null, 2))
```

如需精确定位同名组织，使用 `orgScopeKey`：

```js
const result = await queryBizHierarchy({
  period: '2026-04',
  periodType: 'cumulative',
  reportTypes: ['tuwei'],
  orgScopeKey: '智汇后勤集团 / 东部区域 / 区域配送业务',
})
```

## 原始结构调试

默认输出会删去 `hierarchy`、`orgHierarchy`、`sort_order`、`monthly_plan`、`diff` 等字段。

需要排查聚合逻辑时使用：

```bash
npm run biz:hierarchy -- --period=2026-04 --period-type=cumulative --report-type=tuwei --raw --pretty
```

## 注意事项

- `period` 必须命中数据库中真实存在的期间。拿不准时先用 `--list-periods`。
- 累计口径建议直接传自然月份如 `2026-04`，脚本会自动转换。
- 默认输出只有当前 `report-type` 口径的数据。需要比较 `fone` 和 `tuwei` 时分别调用两次。
- `--pretty` 便于人读，但会增大输出体积；skill 内部调用可以不加。
