"""
读取 docs/data/出差申请对象导出结果.xlsx 并导入到 Supabase business_trips 表。
用法: python scripts/import_trips.py [--no-clear]
  --no-clear  不清空表，仅追加插入（默认会先清空再导入）
"""

import argparse
import os
import sys
from pathlib import Path

import pandas as pd
import httpx

# ── 配置 ──────────────────────────────────────────────
SUPABASE_URL = os.environ.get(
    "SUPABASE_URL", "https://kwwoyzaeczecddilwajs.supabase.co"
)
SUPABASE_KEY = os.environ.get(
    "SUPABASE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3d295emFlY3plY2RkaWx3YWpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MjU4NjQsImV4cCI6MjA4NjUwMTg2NH0.N37UdA8gi1PL4F5TEIi4NPOuoWljnNCzGfXMKtFSHYY",
)

TABLE_NAME = "business_trips"
EXCEL_PATH = (
    Path(__file__).resolve().parent.parent / "docs" / "data" / "出差申请对象导出结果.xlsx"
)
SHEET_NAME = "出差申请数据"
BATCH_SIZE = 500

# Excel 列名 -> 表字段名
COLUMN_MAPPING = {
    "商机项目": "opportunity_name",
    "客户名称": "customer_name",
    "出差开始时间": "start_time",
    "出差结束时间": "end_time",
    "出差事由": "reason",
    "负责人（必填）": "employee_name",
    "提交人工号": "employee_id",
    "负责人主属部门": "department",
}


def _serialize_value(val):
    """将 pandas 标量转为 JSON 可序列化值（NaN/NaT -> None）。"""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    if pd.isna(val):
        return None
    if hasattr(val, "isoformat"):  # datetime
        return val.isoformat()
    if isinstance(val, (int, float)) and not isinstance(val, bool):
        if isinstance(val, float) and val == int(val):
            return int(val)
        return val
    return val


def main():
    parser = argparse.ArgumentParser(description="导入出差申请数据到 Supabase")
    parser.add_argument(
        "--no-clear",
        action="store_true",
        help="不清空表，仅追加插入",
    )
    args = parser.parse_args()

    if not EXCEL_PATH.exists():
        print(f"Excel 文件不存在: {EXCEL_PATH}")
        sys.exit(1)

    print("使用 Supabase REST API 导入")

    # 读取 Excel（优先指定 sheet，不存在则用第一个）
    try:
        df = pd.read_excel(EXCEL_PATH, sheet_name=SHEET_NAME)
    except ValueError:
        df = pd.read_excel(EXCEL_PATH, sheet_name=0)
    print(f"原始数据行数: {len(df)}")

    missing = [c for c in COLUMN_MAPPING if c not in df.columns]
    if missing:
        print(f"Excel 中缺少列: {missing}")
        sys.exit(1)

    df_selected = df[list(COLUMN_MAPPING.keys())].rename(columns=COLUMN_MAPPING)

    # 时间列：统一转为 ISO 字符串
    for col in ("start_time", "end_time"):
        if col in df_selected.columns:
            df_selected[col] = pd.to_datetime(df_selected[col], errors="coerce")

    # 转为记录并清理 NaN/NaT
    records = []
    for _, row in df_selected.iterrows():
        rec = {k: _serialize_value(row[k]) for k in df_selected.columns}
        records.append(rec)

    # employee_id 转为字符串便于与后端一致（若表为 text）
    for rec in records:
        if rec.get("employee_id") is not None:
            rec["employee_id"] = str(rec["employee_id"])

    print(f"待插入数据行数: {len(records)}")
    if not records:
        print("没有有效数据，退出")
        return

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    base_url = f"{SUPABASE_URL}/rest/v1/{TABLE_NAME}"

    with httpx.Client(headers=headers, timeout=60) as client:
        if not args.no_clear:
            print("正在清空旧数据...")
            # 删除所有行：id 不等于不存在的值以匹配所有（若 id 为自增整数则 neq 0 可删全部）
            resp = client.delete(base_url, params={"id": "neq.0"})
            if resp.status_code not in (200, 204):
                print(f"清空失败: {resp.status_code} {resp.text}")
                sys.exit(1)
            print("旧数据已清空")

        inserted = 0
        for i in range(0, len(records), BATCH_SIZE):
            batch = records[i : i + BATCH_SIZE]
            try:
                client.post(base_url, json=batch)
                inserted += len(batch)
                print(f"批次 {i // BATCH_SIZE + 1} 插入成功 ({len(batch)} 条)，累计 {inserted}/{len(records)}")
            except httpx.HTTPStatusError as e:
                print(f"批次 {i // BATCH_SIZE + 1} 插入失败: {e.response.status_code} {e.response.text}")
                raise

    print(f"数据导入完成，共 {inserted} 条。")


if __name__ == "__main__":
    main()
