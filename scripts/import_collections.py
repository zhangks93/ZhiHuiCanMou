"""
读取教育后勤累计回款率 Excel 并导入到 Supabase edu_collection_receivables 表。

用法:
  python scripts/import_collections.py --dry-run
  python scripts/import_collections.py --confirm
  python scripts/import_collections.py --input private-data/教育后勤2025经营数据看版_2025累计回款率统计.xlsx --confirm
"""

from __future__ import annotations

import argparse
import os
import sys
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path

import httpx
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = ROOT_DIR / "private-data" / "教育后勤2025经营数据看版_2025累计回款率统计.xlsx"
TABLE_NAME = "edu_collection_receivables"
BATCH_SIZE = 500
AMOUNT_SCALE = Decimal("10000")
CENT = Decimal("0.01")
RATE_SCALE = Decimal("0.0001")

COLUMN_MAPPING = {
    "项目（单位：元）": "item_name",
    "板块业务分类": "business_category",
    "组织标签": "org_tag",
    "上学年存量应收": "prior_school_year_receivable",
    "本学年新增应收款": "current_school_year_new_receivable",
    "本学年回款金额": "current_school_year_collection_amount",
    "剩余应收": "remaining_receivable",
    "回款率": "collection_rate",
    "基本盘/增长极": "growth_base_label",
    "业务板块-分析汇报二级": "analysis_level_2",
    "业务板块-分析汇报一级": "analysis_level_1",
    "人员权限": "permission_people",
    "父记录": "parent_item_name",
}

AMOUNT_COLUMNS = [
    "prior_school_year_receivable",
    "current_school_year_new_receivable",
    "current_school_year_collection_amount",
    "remaining_receivable",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="导入累计回款率数据到 Supabase")
    parser.add_argument("--input", default=str(DEFAULT_INPUT), help="回款 Excel 文件路径")
    parser.add_argument("--sheet", default=None, help="sheet 名称；默认读取第一个 sheet")
    parser.add_argument("--dry-run", action="store_true", help="仅解析并输出摘要，不写入数据库")
    parser.add_argument("--confirm", action="store_true", help="确认执行写入")
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


def clean_text(value) -> str | None:
    if value is None or pd.isna(value):
        return None
    text = str(value).strip()
    return text or None


def parse_decimal(value) -> Decimal:
    text = clean_text(value)
    if text is None:
        return Decimal("0")
    text = text.replace(",", "").replace("，", "")
    if text.endswith("%"):
        text = text[:-1]
    try:
        return Decimal(text)
    except InvalidOperation:
        print(f"无法解析数值: {value!r}")
        sys.exit(1)


def parse_amount_to_wan(value) -> str:
    amount = (parse_decimal(value) / AMOUNT_SCALE).quantize(CENT, rounding=ROUND_HALF_UP)
    return str(amount)


def parse_rate(value) -> str | None:
    text = clean_text(value)
    if text is None:
        return None
    is_percent = text.endswith("%")
    number = parse_decimal(text)
    if is_percent:
        number = number / Decimal("100")
    return str(number.quantize(RATE_SCALE, rounding=ROUND_HALF_UP))


def resolve_sheet_name(excel_path: Path, requested_sheet: str | None) -> str:
    excel = pd.ExcelFile(excel_path)
    if requested_sheet:
        if requested_sheet not in excel.sheet_names:
            print(f"Excel 中不存在 sheet: {requested_sheet}")
            print(f"可用 sheet: {excel.sheet_names}")
            sys.exit(1)
        return requested_sheet
    return excel.sheet_names[0]


def build_records(excel_path: Path, sheet_name: str) -> list[dict]:
    df = pd.read_excel(excel_path, sheet_name=sheet_name, dtype=object)
    missing = [column for column in COLUMN_MAPPING if column not in df.columns]
    if missing:
        print(f"Excel 中缺少列: {missing}")
        sys.exit(1)

    df_selected = df[list(COLUMN_MAPPING.keys())].rename(columns=COLUMN_MAPPING)
    records: list[dict] = []
    for index, row in df_selected.iterrows():
        item_name = clean_text(row["item_name"])
        if not item_name:
            continue

        record = {
            "period_label": sheet_name,
            "row_order": len(records) + 1,
            "item_name": item_name,
            "parent_item_name": clean_text(row["parent_item_name"]),
            "business_category": clean_text(row["business_category"]),
            "org_tag": clean_text(row["org_tag"]),
            "collection_rate": parse_rate(row["collection_rate"]),
            "growth_base_label": clean_text(row["growth_base_label"]),
            "analysis_level_2": clean_text(row["analysis_level_2"]),
            "analysis_level_1": clean_text(row["analysis_level_1"]),
            "permission_people": clean_text(row["permission_people"]),
            "source_file_name": excel_path.name,
            "source_sheet_name": sheet_name,
        }
        for column in AMOUNT_COLUMNS:
            record[column] = parse_amount_to_wan(row[column])
        records.append(record)

    return records


def print_summary(records: list[dict], sheet_name: str) -> None:
    names = {record["item_name"] for record in records}
    roots = [record for record in records if not record.get("parent_item_name")]
    missing_parents = sorted({
        record["parent_item_name"]
        for record in records
        if record.get("parent_item_name") and record["parent_item_name"] not in names
    })
    total_collection = sum(Decimal(record["current_school_year_collection_amount"]) for record in records)

    print(f"期间: {sheet_name}")
    print(f"待写入数据行数: {len(records)}")
    print(f"根节点数: {len(roots)} ({', '.join(record['item_name'] for record in roots)})")
    print(f"缺失父节点: {missing_parents if missing_parents else '无'}")
    print(f"本学年回款金额合计(万元，含父级汇总行): {total_collection.quantize(CENT)}")
    rate_count = sum(1 for record in records if record["collection_rate"] is not None)
    print(f"已解析回款率行数: {rate_count}/{len(records)}")


def main() -> None:
    args = parse_args()
    excel_path = Path(args.input).resolve()
    if not excel_path.exists():
        print(f"Excel 文件不存在: {excel_path}")
        sys.exit(1)

    sheet_name = resolve_sheet_name(excel_path, args.sheet)
    print(f"读取文件: {excel_path}")
    print(f"读取 sheet: {sheet_name}")
    records = build_records(excel_path, sheet_name)
    print_summary(records, sheet_name)

    if not records:
        print("没有有效数据，退出")
        return
    if args.dry_run:
        print("Dry run 完成，未写入数据库。")
        return
    if not args.confirm:
        print("检测到将执行写入操作。请追加 --confirm 后重试。")
        sys.exit(2)

    supabase_url, service_role_key = require_supabase_env()
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    base_url = f"{supabase_url}/rest/v1/{TABLE_NAME}"

    print(f"目标表: {TABLE_NAME}")
    print(f"写入模式: {'追加' if args.no_clear else '覆盖'}")
    with httpx.Client(headers=headers, timeout=60) as client:
        if not args.no_clear:
            print("正在清空旧数据...")
            response = client.delete(base_url, params={"id": "not.is.null"})
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
