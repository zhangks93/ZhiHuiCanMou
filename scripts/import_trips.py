"""
读取私有出差 Excel 并导入到 Supabase business_trips 表。

用法:
  python scripts/import_trips.py --dry-run
  python scripts/import_trips.py --confirm
  python scripts/import_trips.py --input private-data/出差申请对象导出结果.xlsx --confirm
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import httpx
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = ROOT_DIR / "private-data" / "出差申请对象导出结果.xlsx"
TABLE_NAME = "business_trips"
SHEET_NAME = "出差申请数据"
BATCH_SIZE = 500

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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="导入出差申请数据到 Supabase")
    parser.add_argument("--input", default=str(DEFAULT_INPUT), help="出差 Excel 文件路径")
    parser.add_argument("--dry-run", action="store_true", help="仅解析并输出摘要，不写入数据库")
    parser.add_argument("--confirm", action="store_true", help="确认执行覆盖写入")
    parser.add_argument("--no-clear", action="store_true", help="不清空表，仅追加插入")
    return parser.parse_args()


def load_app_env() -> None:
    env_path = ROOT_DIR / "app" / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def require_supabase_env() -> tuple[str, str]:
    load_app_env()
    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_role_key:
        print("错误: 缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    return supabase_url, service_role_key


def _serialize_value(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if pd.isna(value):
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if isinstance(value, float) and value == int(value):
            return int(value)
        return value
    return value


def main() -> None:
    args = parse_args()
    excel_path = Path(args.input).resolve()
    if not excel_path.exists():
        print(f"Excel 文件不存在: {excel_path}")
        sys.exit(1)

    supabase_url, service_role_key = require_supabase_env()

    print(f"读取文件: {excel_path}")
    try:
        df = pd.read_excel(excel_path, sheet_name=SHEET_NAME)
    except ValueError:
        df = pd.read_excel(excel_path, sheet_name=0)
    print(f"原始数据行数: {len(df)}")

    missing = [column for column in COLUMN_MAPPING if column not in df.columns]
    if missing:
        print(f"Excel 中缺少列: {missing}")
        sys.exit(1)

    df_selected = df[list(COLUMN_MAPPING.keys())].rename(columns=COLUMN_MAPPING)
    for column in ("start_time", "end_time"):
        if column in df_selected.columns:
            df_selected[column] = pd.to_datetime(df_selected[column], errors="coerce")

    records = []
    for _, row in df_selected.iterrows():
        record = {key: _serialize_value(row[key]) for key in df_selected.columns}
        if record.get("employee_id") is not None:
            record["employee_id"] = str(record["employee_id"])
        records.append(record)

    print(f"待写入数据行数: {len(records)}")
    if not records:
        print("没有有效数据，退出")
        return

    print(f"目标表: {TABLE_NAME}")
    print(f"写入模式: {'追加' if args.no_clear else '覆盖'}")
    if args.dry_run:
        print("Dry run 完成，未写入数据库。")
        return
    if not args.confirm:
        print("检测到将执行写入操作。请追加 --confirm 后重试。")
        sys.exit(2)

    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    base_url = f"{supabase_url}/rest/v1/{TABLE_NAME}"

    with httpx.Client(headers=headers, timeout=60) as client:
        if not args.no_clear:
            print("正在清空旧数据...")
            response = client.delete(base_url, params={"id": "neq.0"})
            if response.status_code not in (200, 204):
                print(f"清空失败: {response.status_code} {response.text}")
                sys.exit(1)
            print("旧数据已清空")

        inserted = 0
        for index in range(0, len(records), BATCH_SIZE):
            batch = records[index : index + BATCH_SIZE]
            response = client.post(base_url, json=batch)
            response.raise_for_status()
            inserted += len(batch)
            print(f"批次 {index // BATCH_SIZE + 1} 插入成功 ({len(batch)} 条)，累计 {inserted}/{len(records)}")

    print(f"数据导入完成，共 {len(records)} 条。")


if __name__ == "__main__":
    main()
