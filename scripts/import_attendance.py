"""
考勤数据导入脚本
从 Excel 文件导入考勤数据到 Supabase。

用法:
  python scripts/import_attendance.py --input private-data/202601行政人员.XLS --dry-run
  python scripts/import_attendance.py --input private-data/202601一线标准.XLS --confirm
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import httpx
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent.parent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="导入考勤数据到 Supabase")
    parser.add_argument("--input", required=True, help="考勤 Excel 文件路径")
    parser.add_argument("--dry-run", action="store_true", help="仅解析并输出摘要，不写入数据库")
    parser.add_argument("--confirm", action="store_true", help="确认执行写入")
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


def detect_format(df: pd.DataFrame) -> str:
    first_val = df.iloc[0, 0] if pd.notna(df.iloc[0, 0]) else df.iloc[1, 0]
    if isinstance(first_val, (int, float)) and str(int(first_val)).startswith("8"):
        return "admin"
    fourth_val = df.iloc[0, 3] if pd.notna(df.iloc[0, 3]) else df.iloc[1, 3]
    if isinstance(fourth_val, (int, float)) and str(int(fourth_val)).startswith("8"):
        return "line"
    return "unknown"


def parse_admin_format(df: pd.DataFrame) -> list[dict]:
    if pd.isna(df.iloc[0, 0]):
        df = df.iloc[1:].reset_index(drop=True)

    records = []
    for _, row in df.iterrows():
        if pd.isna(row.iloc[0]) or pd.isna(row.iloc[1]):
            continue
        period_start = row.iloc[7]
        if pd.isna(period_start):
            continue

        leave_sum = 0
        for index in range(12, 22):
            if pd.notna(row.iloc[index]):
                leave_sum += float(row.iloc[index])

        records.append({
            "employee_no": str(int(row.iloc[0])),
            "name": row.iloc[1],
            "department_name": row.iloc[3] if pd.notna(row.iloc[3]) else None,
            "year_month": int(period_start.strftime("%Y%m")),
            "expected_days": float(row.iloc[9]) if pd.notna(row.iloc[9]) else 0,
            "actual_days": float(row.iloc[11]) if pd.notna(row.iloc[11]) else 0,
            "leave_days": leave_sum,
            "absent_days": 0,
            "late_times": int(row.iloc[22]) if pd.notna(row.iloc[22]) else 0,
            "early_leave_times": int(row.iloc[23]) if pd.notna(row.iloc[23]) else 0,
        })
    return records


def parse_line_format(df: pd.DataFrame) -> list[dict]:
    if pd.isna(df.iloc[0, 0]):
        df = df.iloc[1:].reset_index(drop=True)

    records = []
    for _, row in df.iterrows():
        if pd.isna(row.iloc[3]) or pd.isna(row.iloc[4]):
            continue

        year_month = int(row.iloc[6]) if pd.notna(row.iloc[6]) else None
        if not year_month:
            continue

        records.append({
            "employee_no": str(int(row.iloc[3])),
            "name": row.iloc[4],
            "department_name": row.iloc[1] if pd.notna(row.iloc[1]) else None,
            "year_month": year_month,
            "expected_days": float(row.iloc[7]) if pd.notna(row.iloc[7]) else 0,
            "actual_days": float(row.iloc[8]) if pd.notna(row.iloc[8]) else 0,
            "leave_days": 0,
            "absent_days": float(row.iloc[31]) if df.shape[1] > 31 and pd.notna(row.iloc[31]) else 0,
            "late_times": int(row.iloc[28]) if df.shape[1] > 28 and pd.notna(row.iloc[28]) else 0,
            "early_leave_times": int(row.iloc[29]) if df.shape[1] > 29 and pd.notna(row.iloc[29]) else 0,
        })
    return records


def import_data(excel_path: Path, dry_run: bool, confirm: bool) -> None:
    supabase_url, service_role_key = require_supabase_env()
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation,resolution=merge-duplicates",
    }
    base_url = f"{supabase_url}/rest/v1"

    print(f"读取: {excel_path}")
    df = pd.read_excel(excel_path, header=None)
    fmt = detect_format(df)
    print(f"格式: {fmt}")

    if fmt == "admin":
        records = parse_admin_format(df)
    elif fmt == "line":
        records = parse_line_format(df)
    else:
        print("错误: 无法识别格式")
        sys.exit(1)

    print(f"记录数: {len(records)}")
    if not records:
        return

    print("\n摘要:")
    print(f"  员工数: {len(set(record['employee_no'] for record in records))}")
    print(f"  年月: {records[0]['year_month']}")
    print(f"  迟到: {sum(record['late_times'] for record in records)}次")
    print(f"  早退: {sum(record['early_leave_times'] for record in records)}次")
    print(f"  旷工: {sum(record['absent_days'] for record in records)}天")

    if dry_run:
        print("\nDry run 完成，未写入数据库。")
        return
    if not confirm:
        print("\n检测到将执行写入操作。请追加 --confirm 后重试。")
        sys.exit(2)

    member_response = httpx.get(
        f"{base_url}/feishu_members?select=id,employee_no,name,department_id",
        headers=headers,
        timeout=60,
    )
    member_response.raise_for_status()
    member_map = {
        member["employee_no"]: member
        for member in member_response.json()
        if member.get("employee_no")
    }

    dept_response = httpx.get(
        f"{base_url}/feishu_departments?select=department_id,name",
        headers=headers,
        timeout=60,
    )
    dept_response.raise_for_status()
    dept_name_map = {department["name"]: department["department_id"] for department in dept_response.json()}

    attendance_records = []
    skipped = 0
    for record in records:
        member = member_map.get(record["employee_no"])
        if not member:
            skipped += 1
            continue

        dept_ids = member.get("department_id", "").split(",") if member.get("department_id") else []
        department_id = dept_ids[0] if dept_ids else None
        if not department_id and record.get("department_name"):
            department_id = dept_name_map.get(record["department_name"])
        if not department_id:
            skipped += 1
            continue

        attendance_records.append({
            "member_id": member["id"],
            "department_id": department_id,
            "year_month": record["year_month"],
            "expected_days": record["expected_days"],
            "actual_days": record["actual_days"],
            "leave_days": record["leave_days"],
            "absent_days": record["absent_days"],
            "late_times": record["late_times"],
            "early_leave_times": record["early_leave_times"],
        })

    print(f"\n匹配成功: {len(attendance_records)}")
    print(f"跳过记录: {skipped}")

    if attendance_records:
        response = httpx.post(f"{base_url}/attendance_records", headers=headers, json=attendance_records, timeout=60)
        response.raise_for_status()
        print("成功!")

    print("\n完成!")


if __name__ == "__main__":
    args = parse_args()
    import_data(Path(args.input).resolve(), args.dry_run, args.confirm)
