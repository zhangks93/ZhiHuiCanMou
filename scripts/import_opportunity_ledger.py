"""
Import visible sheets from the latest opportunity workbook into Supabase.

Target table:
1. opportunity_snapshot_items

Dependencies:
  pip install pandas openpyxl httpx

Usage:
  python scripts/import_opportunity_ledger.py
  python scripts/import_opportunity_ledger.py --dry-run
"""

from __future__ import annotations

import argparse
import math
import os
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import httpx
import pandas as pd
from openpyxl import load_workbook

SUPABASE_URL = os.environ.get(
    "SUPABASE_URL", "https://kwwoyzaeczecddilwajs.supabase.co"
)
SUPABASE_KEY = os.environ.get(
    "SUPABASE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3d295emFlY3plY2RkaWx3YWpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MjU4NjQsImV4cCI6MjA4NjUwMTg2NH0.N37UdA8gi1PL4F5TEIi4NPOuoWljnNCzGfXMKtFSHYY",
)
DEFAULT_XLSX_PATH = (
    Path(__file__).resolve().parent.parent
    / "docs"
    / "data"
    / "2025学年商机项目台账.xlsx"
)

TABLE_NAME = "opportunity_snapshot_items"

COL_REGION = "区域"
COL_OPPORTUNITY_ATTRIBUTE = "商机属性"
COL_ACQUISITION_CHANNEL = "获取途径"
COL_PROJECT_NAME = "项目名称"
COL_STAGE_LABEL = "推进阶段"
COL_REFERRER = "推荐人"
COL_MARKET_OWNER = "负责市场人员"
COL_PROGRESS_NOTE = "推进进度"
COL_EXPECTED_FINISH_DATE = "预计完成时间"
COL_FIRST_YEAR_REVENUE = "预期首年营收额"


@dataclass(slots=True)
class SheetImport:
    snapshot_date: str
    rows: list[dict[str, Any]]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import opportunity ledger workbook into Supabase.")
    parser.add_argument("--xlsx", default=str(DEFAULT_XLSX_PATH), help="Path to the workbook.")
    parser.add_argument("--dry-run", action="store_true", help="Parse only. Do not write to Supabase.")
    return parser.parse_args()


def require_env() -> None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set.")


def is_nan(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and math.isnan(value):
        return True
    return False


def clean_text(value: Any) -> str | None:
    if is_nan(value):
        return None
    text = str(value).replace("\r", "").strip()
    if text in ("", "-", "/", "nan", "None"):
        return None
    return text


def infer_academic_start_year(xlsx_path: Path) -> int:
    match = re.search(r"(\d{4})学年", xlsx_path.name)
    if match:
        return int(match.group(1))
    raise ValueError(f"Cannot infer academic start year from workbook name: {xlsx_path.name}")


def parse_snapshot_date(sheet_name: str, xlsx_path: Path) -> str:
    if not re.fullmatch(r"\d{4}", sheet_name):
        raise ValueError(f"Cannot parse snapshot date from sheet name: {sheet_name}")

    month = int(sheet_name[:2])
    day = int(sheet_name[2:])
    start_year = infer_academic_start_year(xlsx_path)
    year = start_year if month >= 9 else start_year + 1
    return f"{year}-{month:02d}-{day:02d}"


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    renamed: dict[str, str] = {}
    for col in df.columns:
        renamed[col] = str(col).strip()
    return df.rename(columns=renamed)


def find_header_row(xls: pd.ExcelFile, sheet_name: str) -> int:
    raw = pd.read_excel(xls, sheet_name=sheet_name, header=None)
    required = {COL_PROJECT_NAME, COL_STAGE_LABEL, COL_PROGRESS_NOTE}
    for index in range(min(10, len(raw))):
        row_values = {str(v).strip() for v in raw.iloc[index] if not is_nan(v)}
        if required.issubset(row_values):
            return index
    return 0


def parse_excel_date(value: Any) -> str | None:
    if is_nan(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        serial = float(value)
        if serial <= 0:
            return None
        excel_epoch = datetime(1899, 12, 30)
        return (excel_epoch + timedelta(days=serial)).strftime("%Y-%m-%d")

    text = clean_text(value)
    if text is None:
        return None

    dt = pd.to_datetime(text, errors="coerce")
    if pd.notna(dt):
        return dt.strftime("%Y-%m-%d")
    return None


def parse_amount(value: Any) -> float | None:
    text = clean_text(value)
    if text is None:
        return None

    match = re.search(r"(\d+(?:\.\d+)?)", text.replace(",", ""))
    if not match:
        return None
    return float(match.group(1))


def get_visible_sheet_names(xlsx_path: Path) -> list[str]:
    workbook = load_workbook(xlsx_path, read_only=True, data_only=True)
    try:
        return [ws.title for ws in workbook.worksheets if ws.sheet_state == "visible"]
    finally:
        workbook.close()


def read_visible_sheet(
    xls: pd.ExcelFile,
    xlsx_path: Path,
    sheet_name: str,
) -> tuple[str, SheetImport]:
    header_row = find_header_row(xls, sheet_name)
    df = pd.read_excel(xls, sheet_name=sheet_name, header=header_row)
    df = normalize_columns(df)

    required_columns = {
        COL_REGION,
        COL_OPPORTUNITY_ATTRIBUTE,
        COL_ACQUISITION_CHANNEL,
        COL_PROJECT_NAME,
        COL_STAGE_LABEL,
        COL_REFERRER,
        COL_MARKET_OWNER,
        COL_PROGRESS_NOTE,
        COL_EXPECTED_FINISH_DATE,
        COL_FIRST_YEAR_REVENUE,
    }
    missing = required_columns.difference(df.columns)
    if missing:
        raise ValueError(f"Sheet [{sheet_name}] is missing columns: {sorted(missing)}")

    df[COL_REGION] = df[COL_REGION].ffill()

    snapshot_date = parse_snapshot_date(sheet_name, xlsx_path)
    records: list[dict[str, Any]] = []
    for _, row in df.iterrows():
        project_name = clean_text(row.get(COL_PROJECT_NAME))
        stage_label = clean_text(row.get(COL_STAGE_LABEL))
        if not project_name or not stage_label:
            continue

        records.append(
            {
                "snapshot_date": snapshot_date,
                "region": clean_text(row.get(COL_REGION)),
                "opportunity_attribute": clean_text(row.get(COL_OPPORTUNITY_ATTRIBUTE)),
                "acquisition_channel": clean_text(row.get(COL_ACQUISITION_CHANNEL)),
                "project_name": project_name.replace("\n", ""),
                "stage_label": stage_label,
                "referrer": clean_text(row.get(COL_REFERRER)),
                "market_owner": clean_text(row.get(COL_MARKET_OWNER)),
                "progress_note": clean_text(row.get(COL_PROGRESS_NOTE)),
                "expected_finish_date": parse_excel_date(row.get(COL_EXPECTED_FINISH_DATE)),
                "first_year_revenue": parse_amount(row.get(COL_FIRST_YEAR_REVENUE)),
            }
        )

    return sheet_name, SheetImport(snapshot_date=snapshot_date, rows=records)


def post_json(
    client: httpx.Client,
    url: str,
    headers: dict[str, str],
    payload: Any,
) -> list[dict[str, Any]]:
    response = client.post(url, headers=headers, json=payload)
    response.raise_for_status()
    data = response.json()
    return data if isinstance(data, list) else [data]


def delete_snapshot_rows(
    client: httpx.Client,
    headers: dict[str, str],
    snapshot_date: str,
) -> None:
    response = client.delete(
        f"{SUPABASE_URL}/rest/v1/{TABLE_NAME}?snapshot_date=eq.{snapshot_date}",
        headers=headers,
    )
    response.raise_for_status()


def import_to_supabase(imports: list[SheetImport]) -> None:
    require_env()

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    ledger_url = f"{SUPABASE_URL}/rest/v1/{TABLE_NAME}"

    with httpx.Client(timeout=30) as client:
        print(f"[1/2] Replacing snapshot rows in {TABLE_NAME}...")
        inserted_rows = 0
        for sheet_import in imports:
            delete_snapshot_rows(client, headers, sheet_import.snapshot_date)
            batch_size = 100
            for offset in range(0, len(sheet_import.rows), batch_size):
                batch = sheet_import.rows[offset : offset + batch_size]
                result = post_json(client, ledger_url, headers, batch)
                inserted_rows += len(result)

            print(
                f"  Replaced snapshot {sheet_import.snapshot_date}: {len(sheet_import.rows)} rows"
            )

        print(f"[2/2] Done. inserted_rows={inserted_rows}.")


def main() -> None:
    args = parse_args()
    xlsx_path = Path(args.xlsx).resolve()
    if not xlsx_path.exists():
        raise FileNotFoundError(f"Workbook not found: {xlsx_path}")

    print(f"Workbook: {xlsx_path}")
    visible_sheets = get_visible_sheet_names(xlsx_path)
    print(f"Visible sheets: {visible_sheets}")

    xls = pd.ExcelFile(xlsx_path)
    try:
        imports: list[SheetImport] = []
        total_rows = 0
        for sheet_name in visible_sheets:
            parsed_sheet_name, sheet_import = read_visible_sheet(xls, xlsx_path, sheet_name)
            imports.append(sheet_import)
            total_rows += len(sheet_import.rows)
            print(
                f"  Sheet [{parsed_sheet_name}] -> {len(sheet_import.rows)} rows, "
                f"snapshot date {sheet_import.snapshot_date}"
            )
    finally:
        xls.close()

    if not imports:
        print("No visible sheets to import.")
        return

    print(f"Prepared {len(imports)} sheets and {total_rows} rows.")

    if args.dry_run:
        print("Dry run complete. No data written.")
        return

    import_to_supabase(imports)


if __name__ == "__main__":
    main()
