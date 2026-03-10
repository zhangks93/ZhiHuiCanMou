"""
读取 25学年经营数据.xlsx 中的 1.1/1.2/2.1/2.2/2.3/3 sheet 页，
解析第5-139行经营数据，整理后写入 Supabase 数据库。

同时读取组织标签映射表，创建独立的 edu_org_hierarchy 表。

用法: python scripts/import_biz_data.py
"""

import os
import sys
import json
import openpyxl
import requests
from pathlib import Path

# ─── 配置 ───────────────────────────────────────────────
EXCEL_PATH = Path(__file__).parent.parent / "docs" / "data" / "25学年经营数据.xlsx"
ORG_HIERARCHY_PATH = Path(__file__).parent.parent / "docs" / "data" / "教育后勤2025经营数据看版_组织标签映射表-勿动.xlsx"

# 从 app/.env 读取 Supabase 配置
def load_env():
    env_path = Path(__file__).parent.parent / "app" / ".env"
    env = {}
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env

env = load_env()
SUPABASE_URL = env.get("VITE_SUPABASE_URL") or env.get("SUPABASE_URL", "")
SUPABASE_KEY = env.get("VITE_SUPABASE_ANON_KEY") or env.get("SUPABASE_ANON_KEY", "")
# 优先使用 service role key 以绕过 RLS
SUPABASE_SERVICE_KEY = env.get("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_KEY)

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("错误: 未找到 Supabase 配置，请检查 app/.env")
    sys.exit(1)

HEADERS = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

# ─── Sheet 映射 ──────────────────────────────────────────
SHEET_CONFIG = {
    "1.1": {
        "report_type": "fone",
        "period_type": "cumulative",
    },
    "1.2": {
        "report_type": "fone",
        "period_type": "monthly",
    },
    "2.1": {
        "report_type": "tuwei",
        "period_type": "cumulative",
    },
    "2.2": {
        "report_type": "tuwei",
        "period_type": "monthly",
    },
    "2.3": {
        "report_type": "tuwei",
        "period_type": "monthly",
    },
}

# 16 个指标大类，每类占 5 列（从 C2 开始）
METRIC_CATEGORIES = [
    ("revenue",           "营业收入",    2),
    ("catering_expense",  "餐饮支出",    7),
    ("material_cost",     "物资销售成本", 12),
    ("gross_profit",      "毛利额",      17),
    ("gross_margin",      "毛利率",      22),
    ("labor_cost",        "人力成本",    27),
    ("other_expense",     "其他支出",    32),
    ("external_revenue",  "营业外收入",  37),
    ("external_expense",  "营业外支出",  42),
    ("pretax_profit",     "税前利润",    47),
    ("pretax_margin",     "税前利润率",  52),
    ("headcount",         "职工人数",    57),
    ("per_capita_revenue","人均营收",    62),
    ("labor_cost_rate",   "人力成本率",  67),
    ("revenue_creation",  "一元创收",    72),
    ("profit_creation",   "一元创利",    77),
]

# Sheet 3 指标：营业收入 + 税前利润，各 7 列（6个月 + 合计）
SHEET3_METRICS = [
    ("revenue",      "营业收入", 2, 8),   # C2-C8
    ("pretax_profit", "税前利润", 9, 15),  # C9-C15
]

SHEET3_MONTHS = ["202601", "202602", "202603", "202604", "202605", "202606", "total"]

DATA_ROW_START = 8
DATA_ROW_END = 139


def load_org_hierarchy(excel_path: Path) -> list[dict]:
    """
    从组织标签映射表加载组织层级数据
    返回: [{node_name, level_1, level_2, level_3, label}, ...]
    """
    if not excel_path.exists():
        print(f"  警告: 组织标签映射文件不存在 {excel_path}")
        return []

    wb = openpyxl.load_workbook(str(excel_path), data_only=True)
    ws = wb.active

    rows = []
    # 第一行是表头，从第二行开始读取
    for row_idx in range(2, ws.max_row + 1):
        node_name = ws.cell(row=row_idx, column=6).value  # F列: 组织标签（节点名称）
        if not node_name:
            continue
        node_name = str(node_name).strip()

        level_1 = str(ws.cell(row=row_idx, column=2).value or "").strip() or None  # B列: 中心/区域
        level_2 = str(ws.cell(row=row_idx, column=3).value or "").strip() or None  # C列: 板块业务分类
        level_3 = str(ws.cell(row=row_idx, column=4).value or "").strip() or None  # D列: 25年业务板块-分析汇报一级
        label = str(ws.cell(row=row_idx, column=5).value or "").strip() or None    # E列: 业务板块-分析汇报二级

        rows.append({
            "node_name": node_name,
            "level_1": level_1,
            "level_2": level_2,
            "level_3": level_3,
            "label": label,
        })

    wb.close()
    print(f"  加载了 {len(rows)} 个组织节点")
    return rows


def detect_aggregation(node_name: str) -> tuple:
    """
    检测节点是否为合计/小计行，并提取聚合层级
    返回: (is_aggregated, aggregation_level)
    """
    # 总计
    if "总计" in node_name:
        return (True, "总计")

    # 集团合计
    if "集团" in node_name and "合计" in node_name:
        return (True, "集团合计")

    # 中心合计
    if "中心合计" in node_name:
        return (True, "中心合计")

    # 区域合计
    if "区域合计" in node_name:
        return (True, "区域合计")

    # 区域小计
    if "区域小计" in node_name:
        return (True, "区域小计")

    # 部门小计
    if "部门小计" in node_name:
        return (True, "部门小计")

    # 业务合计
    if "业务" in node_name and "合计" in node_name:
        return (True, "业务合计")

    # 本级小计
    if "本级小计" in node_name:
        return (True, "本级小计")

    # 存量/增量（无合计字样）
    if ("存量" in node_name or "增量" in node_name) and "合计" not in node_name and "小计" not in node_name:
        return (True, "分类")

    # 其他合计/小计
    if "合计" in node_name or "小计" in node_name:
        return (True, "合计")

    return (False, None)


def safe_num(v):
    """将 Excel 单元格值转为 float 或 None"""
    if v is None:
        return None
    if isinstance(v, str):
        v = v.strip()
        if v in ("", "/", "-", "--", "—"):
            return None
        try:
            return float(v.replace(",", ""))
        except ValueError:
            return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def upsert_batch(table: str, rows: list[dict], batch_size: int = 500):
    """分批写入 Supabase"""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    total = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        resp = requests.post(url, headers=HEADERS, data=json.dumps(batch))
        if resp.status_code not in (200, 201):
            print(f"  写入失败 (batch {i // batch_size + 1}): {resp.status_code}")
            print(f"  响应: {resp.text[:500]}")
            return total
        total += len(batch)
    return total


def clear_table(table: str):
    """清空目标表"""
    url = f"{SUPABASE_URL}/rest/v1/{table}?id=not.is.null"
    resp = requests.delete(url, headers=HEADERS)
    if resp.status_code in (200, 204):
        print(f"  已清空 {table}")
    else:
        print(f"  清空 {table} 失败: {resp.status_code} {resp.text[:200]}")


def parse_main_sheets(wb):
    """解析 sheets 1.1, 1.2, 2.1, 2.2, 2.3"""
    all_rows = []

    for sheet_code, config in SHEET_CONFIG.items():
        # 找到匹配的 sheet
        matched = [s for s in wb.sheetnames if s.startswith(sheet_code)]
        if not matched:
            print(f"  警告: 未找到 sheet {sheet_code}")
            continue
        sheet_name = matched[0]
        ws = wb[sheet_name]
        print(f"  处理 [{sheet_name}]")

        # 读取期间信息 (Row 3)
        period = str(ws.cell(row=3, column=2).value or "").strip()
        period_yoy = str(ws.cell(row=3, column=3).value or "").strip()

        sheet_rows = 0
        for row_idx in range(DATA_ROW_START, DATA_ROW_END + 1):
            node_name = ws.cell(row=row_idx, column=1).value
            if node_name is None:
                continue
            node_name = str(node_name).strip()
            if not node_name:
                continue

            for metric_en, metric_cn, start_col in METRIC_CATEGORIES:
                actual = safe_num(ws.cell(row=row_idx, column=start_col).value)
                budget = safe_num(ws.cell(row=row_idx, column=start_col + 1).value)
                rate = safe_num(ws.cell(row=row_idx, column=start_col + 2).value)
                diff = safe_num(ws.cell(row=row_idx, column=start_col + 3).value)

                # 人均营收只有4列（无同期列），其余有5列
                if metric_en == "per_capita_revenue":
                    yoy = None
                elif metric_en == "profit_creation":
                    yoy = None  # 一元创利也只有4列
                else:
                    yoy = safe_num(ws.cell(row=row_idx, column=start_col + 4).value)

                # 跳过全部为空的指标行
                if all(v is None for v in [actual, budget, rate, diff, yoy]):
                    continue

                row_data = {
                    "sheet_code": sheet_code,
                    "report_type": config["report_type"],
                    "period_type": config["period_type"],
                    "period": period,
                    "period_yoy": period_yoy if period_yoy else None,
                    "node_name": node_name,
                    "metric_category": metric_en,
                    "metric_category_cn": metric_cn,
                    "actual_value": actual,
                    "budget_value": budget,
                    "completion_rate": rate,
                    "diff_value": diff,
                    "yoy_value": yoy,
                    "sort_order": row_idx,
                }

                all_rows.append(row_data)
                sheet_rows += 1

        print(f"    -> {sheet_rows} 条指标数据")

    return all_rows


def parse_sheet3(wb):
    """解析 sheet 3（突围计划分月版）"""
    matched = [s for s in wb.sheetnames if s.startswith("3")]
    if not matched:
        print("  警告: 未找到 sheet 3")
        return []
    sheet_name = matched[0]
    ws = wb[sheet_name]
    print(f"  处理 [{sheet_name}]")

    all_rows = []
    row_count = 0

    for row_idx in range(DATA_ROW_START, DATA_ROW_END + 1):
        node_name = ws.cell(row=row_idx, column=1).value
        if node_name is None:
            continue
        node_name = str(node_name).strip()
        if not node_name:
            continue

        for metric_en, metric_cn, start_col, end_col in SHEET3_METRICS:
            col_idx = start_col
            for month in SHEET3_MONTHS:
                val = safe_num(ws.cell(row=row_idx, column=col_idx).value)
                if val is not None:
                    row_data = {
                        "node_name": node_name,
                        "metric_category": metric_en,
                        "metric_category_cn": metric_cn,
                        "month": month,
                        "plan_value": val,
                        "sort_order": row_idx,
                    }
                    all_rows.append(row_data)
                    row_count += 1
                col_idx += 1

    print(f"    -> {row_count} 条计划数据")
    return all_rows


def main():
    print(f"读取 Excel: {EXCEL_PATH}")
    if not EXCEL_PATH.exists():
        print(f"错误: 文件不存在 {EXCEL_PATH}")
        sys.exit(1)

    # 加载组织层级数据
    print(f"\n加载组织层级映射: {ORG_HIERARCHY_PATH}")
    org_hierarchy_rows = load_org_hierarchy(ORG_HIERARCHY_PATH)

    wb = openpyxl.load_workbook(str(EXCEL_PATH), data_only=True)
    print(f"共 {len(wb.sheetnames)} 个 sheet\n")

    # 清空目标表
    print("清空目标表...")
    clear_table("edu_biz_report")
    clear_table("edu_biz_monthly_plan")
    clear_table("edu_org_hierarchy")
    print()

    # 解析主报表
    print("解析经营数据报表 (1.1-2.3)...")
    report_rows = parse_main_sheets(wb)
    print(f"\n共 {len(report_rows)} 条报表数据")

    # 解析突围计划
    print("\n解析突围计划分月版 (3)...")
    plan_rows = parse_sheet3(wb)
    print(f"共 {len(plan_rows)} 条计划数据")

    # 写入 Supabase
    print("\n写入 Supabase...")

    if org_hierarchy_rows:
        n = upsert_batch("edu_org_hierarchy", org_hierarchy_rows)
        print(f"  edu_org_hierarchy: 写入 {n}/{len(org_hierarchy_rows)} 条")

    if report_rows:
        n = upsert_batch("edu_biz_report", report_rows)
        print(f"  edu_biz_report: 写入 {n}/{len(report_rows)} 条")

    if plan_rows:
        n = upsert_batch("edu_biz_monthly_plan", plan_rows)
        print(f"  edu_biz_monthly_plan: 写入 {n}/{len(plan_rows)} 条")

    print("\n完成!")
    wb.close()


if __name__ == "__main__":
    main()
