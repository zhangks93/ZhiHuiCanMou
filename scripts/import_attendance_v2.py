"""
Import monthly HR attendance workbooks into attendance_monthly_records_v2.

Usage:
  python scripts/import_attendance_v2.py --input private-data/202603教育月度考勤汇总表(综合)-按小时计算考勤.xlsx --input private-data/202603教育月度考勤汇总表(标准)-按天计算考勤.xlsx --dry-run
  python scripts/import_attendance_v2.py --input private-data/202603教育月度考勤汇总表(综合)-按小时计算考勤.xlsx --input private-data/202603教育月度考勤汇总表(标准)-按天计算考勤.xlsx --confirm
"""

from __future__ import annotations

import argparse
import hashlib
import os
import re
import sys
from pathlib import Path
from typing import Any

import httpx
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent.parent
GROUP_ROOT = "海亮智汇后勤集团"

DAY_LEAVE_COLUMNS = [
    "事假天数",
    "病假天数",
    "长病假天数",
    "产假天数",
    "全薪假天数",
    "超休天数",
    "居家办公天数",
    "线上办公天数",
    "寒暑假天数",
    "全薪寒暑假天数",
    "带薪寒暑假天数",
]

HOUR_LEAVE_COLUMNS = [
    "事假时数",
    "病假时数",
    "长病假时数",
    "产假时数",
    "全薪假时数",
    "超休时数",
    "寒暑假休息时数",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="导入人资月度考勤 v2 数据到 Supabase")
    parser.add_argument("--input", action="append", required=True, help="考勤 Excel 文件路径，可重复传入")
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
    supabase_key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or os.getenv("VITE_SUPABASE_ANON_KEY")
    )
    if not supabase_url or not supabase_key:
        print("错误: 缺少 SUPABASE_URL/VITE_SUPABASE_URL 或 SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY")
        sys.exit(1)
    return supabase_url.rstrip("/"), supabase_key


def parse_year_month_from_filename(path: Path) -> int:
    match = re.search(r"(20\d{4})", path.name)
    if not match:
        raise ValueError(f"无法从文件名解析月份: {path.name}")
    return int(match.group(1))


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def clean_text(value: Any) -> str | None:
    if pd.isna(value):
        return None
    text = str(value).strip()
    if not text or text.lower() == "nan":
        return None
    return text


def number_value(value: Any) -> float:
    if pd.isna(value):
        return 0.0
    parsed = pd.to_numeric(value, errors="coerce")
    if pd.isna(parsed):
        return 0.0
    return float(parsed)


def int_value(value: Any) -> int:
    return int(round(number_value(value)))


def detect_attendance_type(df: pd.DataFrame, path: Path) -> tuple[str, str, list[str]]:
    columns = [str(column).strip() for column in df.columns]
    if "全月应出勤天数" in columns:
        return "standard_day", "day", DAY_LEAVE_COLUMNS
    if "全月应出勤时数" in columns:
        return "comprehensive_hour", "hour", HOUR_LEAVE_COLUMNS
    raise ValueError(f"无法识别考勤表类型: {path.name}")


def build_department_paths(row: pd.Series) -> tuple[list[str], list[str]]:
    dept_columns = [column for column in row.index if str(column).startswith("部门")]
    full_path = [value for value in (clean_text(row[column]) for column in dept_columns) if value]
    if GROUP_ROOT in full_path:
        display_path = full_path[full_path.index(GROUP_ROOT):]
    else:
        display_path = full_path
    if not display_path:
        display_path = ["未分部门"]
    return display_path, full_path


def raw_metrics_from_row(row: pd.Series) -> dict[str, Any]:
    raw: dict[str, Any] = {}
    for key, value in row.items():
        if str(key).startswith("部门") or key in {"工号", "姓名", "考勤月份"}:
            continue
        if pd.isna(value):
            continue
        if hasattr(value, "item"):
            value = value.item()
        raw[str(key)] = value
    return raw


def parse_workbook(path: Path) -> tuple[list[dict[str, Any]], int]:
    year_month_from_name = parse_year_month_from_filename(path)
    source_hash = file_hash(path)
    excel = pd.ExcelFile(path)
    records: list[dict[str, Any]] = []
    skipped_non_group = 0

    for sheet_name in excel.sheet_names:
        df = pd.read_excel(path, sheet_name=sheet_name, header=0)
        df = df.dropna(how="all")
        if df.empty:
            continue

        attendance_type, work_unit, leave_columns = detect_attendance_type(df, path)
        expected_column = "全月应出勤天数" if work_unit == "day" else "全月应出勤时数"
        actual_column = "实际出勤天数" if work_unit == "day" else "实际出勤时数"
        unqualified_column = "未满勤天数" if work_unit == "day" else "未满勤时数"
        legal_holiday_column = "在职法定节假日天数" if work_unit == "day" else "在职法定节假日时数"
        normal_column = "其中：正常班天数" if work_unit == "day" else "其中：正常班时数"
        absence_column = "旷工天数" if work_unit == "day" else "旷工时数"

        for index, row in df.iterrows():
            employee_no = clean_text(row.get("工号"))
            employee_name = clean_text(row.get("姓名"))
            if not employee_no or not employee_name:
                continue

            employee_no = re.sub(r"\.0$", "", employee_no)
            year_month = int(number_value(row.get("考勤月份"))) or year_month_from_name
            if year_month != year_month_from_name:
                raise ValueError(f"{path.name} 第 {index + 2} 行月份 {year_month} 与文件名月份 {year_month_from_name} 不一致")

            department_path, department_full_path = build_department_paths(row)
            if GROUP_ROOT not in department_full_path:
                skipped_non_group += 1
                continue

            expected = number_value(row.get(expected_column))
            normal = number_value(row.get(normal_column))
            actual = number_value(row.get(actual_column))
            unqualified = number_value(row.get(unqualified_column))
            legal_holiday = number_value(row.get(legal_holiday_column))
            approved_leave = sum(number_value(row.get(column)) for column in leave_columns if column in df.columns)
            absence = number_value(row.get(absence_column))
            qualified = actual + approved_leave + unqualified + legal_holiday
            attendance_rate = qualified / expected if expected > 0 else 0
            late_under_30 = int_value(row.get("迟到/早退(30分以内)"))
            late_30_to_120 = int_value(row.get("迟到早退(超30分钟不超2小时)"))

            records.append({
                "year_month": year_month,
                "attendance_type": attendance_type,
                "employee_no": employee_no,
                "employee_name": employee_name,
                "member_id": None,
                "work_unit": work_unit,
                "department_path": department_path,
                "department_full_path": department_full_path,
                "expected_work_amount": expected,
                "normal_work_amount": normal,
                "actual_work_amount": actual,
                "approved_leave_amount": approved_leave,
                "absence_amount": absence,
                "qualified_attendance_amount": qualified,
                "attendance_rate": attendance_rate,
                "late_under_30_count": late_under_30,
                "late_30_to_120_count": late_30_to_120,
                "late_total_count": late_under_30 + late_30_to_120,
                "missing_clock_count": int_value(row.get("未打卡次数")),
                "makeup_clock_count": int_value(row.get("补卡次数")),
                "source_file_name": path.name,
                "source_sheet_name": sheet_name,
                "source_row_number": int(index) + 2,
                "source_file_hash": source_hash,
                "raw_metrics": raw_metrics_from_row(row),
            })

    return records, skipped_non_group


def attach_member_ids(records: list[dict[str, Any]], base_url: str, headers: dict[str, str]) -> int:
    response = httpx.get(
        f"{base_url}/feishu_members?select=id,employee_no",
        headers=headers,
        timeout=60,
    )
    response.raise_for_status()
    member_map = {
        str(member["employee_no"]): member["id"]
        for member in response.json()
        if member.get("employee_no")
    }

    matched = 0
    for record in records:
        member_id = member_map.get(record["employee_no"])
        if member_id:
            record["member_id"] = member_id
            matched += 1
    return matched


def import_data(paths: list[Path], dry_run: bool, confirm: bool) -> None:
    all_records: list[dict[str, Any]] = []
    total_skipped_non_group = 0
    for path in paths:
        resolved = path.resolve()
        print(f"读取: {resolved}")
        records, skipped_non_group = parse_workbook(resolved)
        all_records.extend(records)
        total_skipped_non_group += skipped_non_group
        print(f"  解析记录: {len(records)}")
        if skipped_non_group:
            print(f"  已跳过非{GROUP_ROOT}下属员工: {skipped_non_group}")

    if not all_records:
        print("没有可导入记录。")
        return

    print("\n摘要:")
    print(f"  总记录数: {len(all_records)}")
    print(f"  跳过非{GROUP_ROOT}下属员工: {total_skipped_non_group}")
    print(f"  员工数: {len(set(record['employee_no'] for record in all_records))}")
    print(f"  月份: {', '.join(str(item) for item in sorted(set(record['year_month'] for record in all_records)))}")
    for attendance_type in sorted(set(record["attendance_type"] for record in all_records)):
        type_records = [record for record in all_records if record["attendance_type"] == attendance_type]
        print(
            f"  {attendance_type}: {len(type_records)} 人, "
            f"平均出勤率 {sum(record['attendance_rate'] for record in type_records) / len(type_records) * 100:.1f}%, "
            f"迟到/早退 {sum(record['late_total_count'] for record in type_records)} 次"
        )

    type_sets: dict[str, set[str]] = {}
    for record in all_records:
        type_sets.setdefault(record["attendance_type"], set()).add(record["employee_no"])
    if len(type_sets) > 1:
        overlap = set.intersection(*type_sets.values())
        if overlap:
            print(f"  警告: {len(overlap)} 个员工同时出现在多个考勤类型中。")

    if dry_run:
        print("\nDry run 完成，未写入数据库。")
        return
    if not confirm:
        print("\n检测到将执行写入操作。请追加 --confirm 后重试。")
        sys.exit(2)

    supabase_url, service_role_key = require_supabase_env()
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
    }
    base_url = f"{supabase_url}/rest/v1"
    matched = attach_member_ids(all_records, base_url, headers)
    print(f"\n飞书成员匹配: {matched}/{len(all_records)}")

    for year_month in sorted(set(record["year_month"] for record in all_records)):
        for attendance_type in sorted(set(record["attendance_type"] for record in all_records if record["year_month"] == year_month)):
            delete_response = httpx.delete(
                f"{base_url}/attendance_monthly_records_v2?year_month=eq.{year_month}&attendance_type=eq.{attendance_type}",
                headers=headers,
                timeout=60,
            )
            delete_response.raise_for_status()

    insert_headers = {**headers, "Prefer": "return=minimal"}
    for offset in range(0, len(all_records), 500):
        batch = all_records[offset:offset + 500]
        response = httpx.post(
            f"{base_url}/attendance_monthly_records_v2",
            headers=insert_headers,
            json=batch,
            timeout=60,
        )
        response.raise_for_status()
        print(f"  写入 {offset + len(batch)}/{len(all_records)}")

    print("\n完成!")


if __name__ == "__main__":
    args = parse_args()
    import_data([Path(item) for item in args.input], args.dry_run, args.confirm)
