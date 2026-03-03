"""
读取 教育后勤2025经营数据_累计.csv 并插入到 Supabase edu_logistics_biz_data 表
用法: python scripts/import_edu_logistics_data.py
"""

import csv
import json
import os
import sys
from pathlib import Path

import httpx

# ── 配置 ──────────────────────────────────────────────
SUPABASE_URL = os.environ.get(
    "SUPABASE_URL", "https://kwwoyzaeczecddilwajs.supabase.co"
)
SUPABASE_KEY = os.environ.get(
    "SUPABASE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3d295emFlY3plY2RkaWx3YWpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MjU4NjQsImV4cCI6MjA4NjUwMTg2NH0.N37UdA8gi1PL4F5TEIi4NPOuoWljnNCzGfXMKtFSHYY",
)

CSV_PATH = Path(__file__).resolve().parent.parent / "docs" / "data" / "教育后勤2025经营数据_累计.csv"
TABLE_NAME = "edu_logistics_biz_data"
BATCH_SIZE = 50

# ── CSV 列名 → 数据库字段映射 ─────────────────────────
COLUMN_MAP = [
    "node_name",                     # 项目（单位：万元）
    "center",                        # 中心/区域
    "biz_class",                     # 板块业务分类
    "biz_level1",                    # 业务板块-分析汇报一级
    "org_tag",                       # 组织标签
    "actual_revenue",                # 实际（营收）
    "budget_revenue",                # 预算（营收）
    "revenue_completion_rate",       # 预算完成率（营收）
    "revenue_diff",                  # 预实差异（营收）
    "yoy_revenue",                   # 同期（营收）
    "actual_material",               # 实际值（物资）
    "budget_material",               # 预算值（物资）
    "material_completion_rate",      # 预算完成率（物资）
    "yoy_material",                  # 同期值（物资）
    "actual_meal",                   # 实际值（餐）
    "budget_meal",                   # 预算值（餐）
    "meal_completion_rate",          # 预算完成率（餐）
    "yoy_meal",                      # 同期值（餐）
    "actual_gross_profit",           # 实际值（毛利）
    "budget_gross_profit",           # 预算值（毛利）
    "gross_profit_completion_rate",  # 预算完成率（毛利）
    "yoy_gross_profit",              # 同期值（毛利）
    "actual_gross_margin",           # 实际（毛利率）
    "budget_gross_margin",           # 预算（毛利率）
    "gross_margin_diff",             # 预实差异（毛利率）
    "yoy_gross_margin",              # 同期（毛利率）
    "actual_labor_cost",             # 实际值（人力）
    "budget_labor_cost",             # 预算值（人力）
    "labor_cost_completion_rate",    # 预算完成率（人力）
    "yoy_labor_cost",                # 同期值（人力）
    "actual_other_cost",             # 实际值（其他）
    "budget_other_cost",             # 预算值（其他）
    "other_cost_completion_rate",    # 预算完成率（其他）
    "yoy_other_cost",                # 同期值（其他）
    "actual_external_revenue",       # 实际值（外收）
    "budget_external_revenue",       # 预算值（外收）
    "yoy_external_revenue",          # 同期值（外收）
    "actual_external_expense",       # 实际值（外支）
    "budget_external_expense",       # 预算值（外支）
    "yoy_external_expense",          # 同期值（外支）
    "actual_profit",                 # 实际（利润）
    "budget_profit",                 # 预算（利润）
    "profit_completion_rate",        # 预算完成率（利润）
    "profit_diff",                   # 预实差异（利润）
    "yoy_profit",                    # 同期（利润）
    "actual_profit_margin",          # 实际值（利润率）
    "budget_profit_margin",          # 预算值（利润率）
    "profit_margin_diff",            # 预实差异（利润率）
    "yoy_profit_margin",             # 同期值（利润率）
    "actual_labor_cost_rate",        # 实际值（人力成本率）
    "budget_labor_cost_rate",        # 预算值（人力成本率）
    "labor_cost_rate_completion",    # 预算完成率（人力成本率）
    "yoy_labor_cost_rate",           # 同期值（人力成本率）
    "actual_revenue_creation",       # 实际值（创收）
    "budget_revenue_creation",       # 预算值（创收）
    "revenue_creation_completion_rate",  # 预算完成率（创收）
    "yoy_revenue_creation",          # 同期值（创收）
    "actual_profit_creation",        # 实际值（创利）
    "budget_profit_creation",        # 预算值（创利）
    "profit_creation_completion_rate",   # 预算完成率（创利）
    "yoy_profit_creation",           # 同期值（创利）
    "actual_headcount",              # 实际值（人数）
    "budget_headcount",              # 预算值（人数）
    "headcount_diff",                # 预实差异（人数）
    "yoy_headcount",                 # 同期值（人数）
    "actual_per_capita_labor",       # 实际值（人均人力）
    "yoy_per_capita_labor",          # 同期值（人均人力）
    "budget_per_capita_labor",       # 预算值（人均人力）
    "per_capita_labor_diff",         # 预实差异（人均人力）
    "dashboard_flag",                # 看板取值标记
]

TEXT_FIELDS = {"node_name", "center", "biz_class", "biz_level1", "org_tag", "dashboard_flag"}


def parse_number(raw: str):
    if not raw or raw.strip() == "":
        return None
    s = raw.strip().replace(",", "").replace('"', "")
    if s.endswith("%"):
        s = s[:-1]
        try:
            return round(float(s) / 100, 6)
        except ValueError:
            return None
    try:
        return float(s)
    except ValueError:
        return None


def row_to_record(row: list[str]) -> dict | None:
    if not row or not row[0].strip():
        return None
    record = {}
    for i, col_name in enumerate(COLUMN_MAP):
        if i >= len(row):
            record[col_name] = None
            continue
        val = row[i].strip()
        if col_name in TEXT_FIELDS:
            record[col_name] = val if val else None
        else:
            record[col_name] = parse_number(val)
    if not record.get("node_name"):
        return None
    return record


def insert_batch(client: httpx.Client, batch: list[dict]) -> httpx.Response:
    url = f"{SUPABASE_URL}/rest/v1/{TABLE_NAME}"
    resp = client.post(url, json=batch)
    resp.raise_for_status()
    return resp


def main():
    if not CSV_PATH.exists():
        print(f"CSV 文件不存在: {CSV_PATH}")
        sys.exit(1)

    print(f"读取 CSV: {CSV_PATH}")

    records = []
    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)
        print(f"CSV 表头共 {len(header)} 列，映射 {len(COLUMN_MAP)} 个字段")
        for line_no, row in enumerate(reader, start=2):
            rec = row_to_record(row)
            if rec:
                records.append(rec)

    print(f"共解析 {len(records)} 条有效记录")
    if not records:
        print("没有有效数据，退出")
        return

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    inserted = 0
    with httpx.Client(headers=headers, timeout=30) as client:
        for i in range(0, len(records), BATCH_SIZE):
            batch = records[i : i + BATCH_SIZE]
            try:
                insert_batch(client, batch)
                inserted += len(batch)
                print(f"  已插入 {inserted}/{len(records)} 条")
            except httpx.HTTPStatusError as e:
                print(f"  批量插入第 {i+1}-{i+len(batch)} 条时出错: {e.response.status_code} {e.response.text}")
                for j, rec in enumerate(batch):
                    try:
                        insert_batch(client, [rec])
                        inserted += 1
                    except httpx.HTTPStatusError as e2:
                        print(f"    跳过第 {i+j+1} 行 [{rec.get('node_name')}]: {e2.response.text}")

    print(f"\n完成！成功插入 {inserted} 条记录到 {TABLE_NAME} 表")


if __name__ == "__main__":
    main()
