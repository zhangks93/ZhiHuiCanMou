"""
将 2025学年商机项目台账.xlsx 数据导入 Supabase opportunity_ledger 表

依赖安装: pip install pandas openpyxl httpx
用法: python scripts/import_opportunity_ledger.py
"""

import os
import re
import math
import pandas as pd
from datetime import datetime
import httpx

# ── 配置 ────────────────────────────────────────────────
SUPABASE_URL = os.environ.get(
    "SUPABASE_URL", "https://kwwoyzaeczecddilwajs.supabase.co"
)
SUPABASE_KEY = os.environ.get(
    "SUPABASE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3d295emFlY3plY2RkaWx3YWpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MjU4NjQsImV4cCI6MjA4NjUwMTg2NH0.N37UdA8gi1PL4F5TEIi4NPOuoWljnNCzGfXMKtFSHYY",
)
XLSX_PATH = os.path.join(
    os.path.dirname(__file__), "..", "docs", "data", "2025学年商机项目台账.xlsx"
)

# ── 映射 ────────────────────────────────────────────────
ITEM_TYPE_MAP = {
    "项目运营": "operation",
    "项目拓展": "expansion",
    "项目跟踪": "tracking",
    "跟踪项目": "tracking",
}

# 2025学年: 03-12月 → 2025年, 01-02月 → 2026年
YEAR_BOUNDARY_MONTH = 3


def parse_snapshot_date(sheet_name: str) -> str:
    month = int(sheet_name[:2])
    day = int(sheet_name[2:])
    year = 2025 if month >= YEAR_BOUNDARY_MONTH else 2026
    return f"{year}-{month:02d}-{day:02d}"


def is_nan(val) -> bool:
    if val is None:
        return True
    if isinstance(val, float) and math.isnan(val):
        return True
    return False


def parse_amount(raw) -> float | None:
    if is_nan(raw):
        return None
    s = str(raw).strip()
    if s in ("-", "", "nan", "/"):
        return None
    numbers = re.findall(r"[\d.]+", s)
    if numbers:
        return float(numbers[0])
    return None


def parse_bid_date(raw) -> str | None:
    if is_nan(raw):
        return None
    if isinstance(raw, datetime):
        return raw.strftime("%Y-%m-%d")
    s = str(raw).strip()
    if s in ("-", "", "nan", "待定", "/"):
        return None
    return None


def parse_bool(raw) -> bool:
    if is_nan(raw):
        return False
    try:
        return bool(int(raw))
    except (ValueError, TypeError):
        return False


def parse_win_probability(raw) -> float | None:
    if is_nan(raw):
        return None
    if isinstance(raw, (int, float)) and not isinstance(raw, bool):
        return float(raw)
    s = str(raw).strip()
    if s in ("-", "", "nan", "/"):
        return None
    # 从文本中提取百分比数字，取平均值
    percentages = re.findall(r"(\d+(?:\.\d+)?)\s*%", s)
    if percentages:
        avg = sum(float(p) for p in percentages) / len(percentages) / 100.0
        return round(avg, 2)
    # 尝试直接转数字
    numbers = re.findall(r"[\d.]+", s)
    if numbers:
        return float(numbers[0])
    return None


def derive_status(item_type: str, win_prob: float | None) -> str:
    if item_type == "operation":
        return "operating"
    if win_prob is not None and win_prob >= 1.0:
        return "contracted"
    return "tracking"


def safe_get(row, key, default=None):
    """安全获取 row 中的值，列不存在时返回 default"""
    try:
        val = row[key]
        return val
    except (KeyError, IndexError):
        return default


def find_header_row(xls: pd.ExcelFile, sheet_name: str) -> int:
    """找到包含 '项目名称' 的表头行号"""
    df_raw = pd.read_excel(xls, sheet_name=sheet_name, header=None)
    for i in range(min(10, len(df_raw))):
        row_vals = [str(v).strip() for v in df_raw.iloc[i] if not is_nan(v)]
        if "项目名称" in row_vals:
            return i
    return 0


def read_sheet(xls: pd.ExcelFile, sheet_name: str) -> list[dict]:
    """读取一个 sheet 并转换为 opportunity_ledger 记录列表（兼容多种列结构）"""

    # 先找到真正的表头行
    header_row = find_header_row(xls, sheet_name)
    df = pd.read_excel(xls, sheet_name=sheet_name, header=header_row)

    # 清理列名中的空白
    df.columns = [str(c).strip() for c in df.columns]
    col_names = set(df.columns)

    # 确定各字段对应的列名
    has_region = "区域" in col_names
    has_logistics = "后勤投决" in col_names
    has_group = "集团投决" in col_names
    has_bid_date = "投标时间" in col_names
    has_manager = "项目负责人就位情况" in col_names

    # 前向填充事项类型
    if "事项类型" in col_names:
        df["事项类型"] = df["事项类型"].ffill()
    if has_region:
        df["区域"] = df["区域"].ffill()

    snapshot_date = parse_snapshot_date(sheet_name)
    records = []

    for _, row in df.iterrows():
        project_name = safe_get(row, "项目名称")
        if is_nan(project_name):
            continue

        project_name = str(project_name).strip().replace("\n", "")
        if not project_name or project_name in ("/", "-"):
            continue

        # 跳过 "重点商机" 等汇总行
        item_type_raw = str(safe_get(row, "事项类型", "")).strip()
        if item_type_raw in ("重点商机",):
            continue
        if project_name == "重点商机":
            continue

        item_type = ITEM_TYPE_MAP.get(item_type_raw, "tracking")

        win_probability = parse_win_probability(safe_get(row, "获取概率"))

        region = safe_get(row, "区域") if has_region else None
        if is_nan(region):
            region = None
        else:
            region = str(region).strip() if region else None

        remark = safe_get(row, "下一步计划")
        if is_nan(remark):
            remark = None
        else:
            remark = str(remark).strip() if remark else None

        record = {
            "snapshot_date": snapshot_date,
            "item_type": item_type,
            "region": region,
            "project_name": project_name,
            "estimated_amount": parse_amount(safe_get(row, "项目体量")),
            "logistics_approved": parse_bool(safe_get(row, "后勤投决")) if has_logistics else False,
            "group_approved": parse_bool(safe_get(row, "集团投决")) if has_group else False,
            "bid_date": parse_bid_date(safe_get(row, "投标时间")) if has_bid_date else None,
            "status": derive_status(item_type, win_probability),
            "remark": remark,
            "win_probability": win_probability,
            "manager_ready": parse_bool(safe_get(row, "项目负责人就位情况")) if has_manager else False,
        }
        records.append(record)

    return records


def main():
    xlsx_path = os.path.normpath(XLSX_PATH)
    print(f"读取文件: {xlsx_path}")

    xls = pd.ExcelFile(xlsx_path)
    print(f"共 {len(xls.sheet_names)} 个 sheet: {xls.sheet_names}")

    all_records = []
    for sheet_name in xls.sheet_names:
        records = read_sheet(xls, sheet_name)
        all_records.extend(records)
        print(f"  Sheet [{sheet_name}] → {len(records)} 条记录")

    xls.close()
    print(f"\n总计 {len(all_records)} 条记录待导入")

    if not all_records:
        print("无数据，退出")
        return

    # 通过 REST API 操作 Supabase
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    base_url = f"{SUPABASE_URL}/rest/v1/opportunity_ledger"

    with httpx.Client(timeout=30) as client:
        # 先清空表中所有数据
        print("\n[1/2] 清空 opportunity_ledger 表...")
        try:
            resp = client.delete(f"{base_url}?id=gte.0", headers=headers)
            if resp.status_code in (200, 204):
                print("  > 已清空旧数据")
            else:
                print(f"  > 清空失败 (状态码 {resp.status_code})，继续导入...")
        except Exception as e:
            print(f"  > 清空失败，继续导入...")

        # 分批插入 (每批50条)
        BATCH_SIZE = 50
        inserted = 0
        print(f"\n[2/2] 开始导入 {len(all_records)} 条记录...")
        for i in range(0, len(all_records), BATCH_SIZE):
            batch = all_records[i : i + BATCH_SIZE]
            resp = client.post(base_url, headers=headers, json=batch)
            resp.raise_for_status()
            inserted += len(resp.json())
            print(f"  > 进度: {inserted}/{len(all_records)} 条")

    print(f"\n导入完成! 共插入 {inserted} 条记录到 opportunity_ledger 表")


if __name__ == "__main__":
    main()
