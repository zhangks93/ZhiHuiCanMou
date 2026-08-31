"""
Import visible sheets from the latest opportunity workbook into Supabase.

Dependencies:
  pip install pandas openpyxl httpx

Usage:
  python scripts/import_opportunity_ledger.py --dry-run
  python scripts/import_opportunity_ledger.py --confirm
  python scripts/import_opportunity_ledger.py --input private-data/2025学年商机项目台账.xlsx --confirm
"""

from __future__ import annotations

import argparse
import math
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import httpx
import pandas as pd
from openpyxl import load_workbook

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_XLSX_PATH = ROOT_DIR / "private-data" / "2025学年商机项目台账.xlsx"

TABLE_NAME = "opportunity_snapshot_items"

COL_REGION = "区域"
COL_OPPORTUNITY_ATTRIBUTE = "商机属性"
COL_ACQUISITION_CHANNEL = "获取途径"
COL_PROJECT_NAME = "项目名称"
COL_STAGE_LABEL = "推进阶段"
COL_REFERRER = "推荐人"
COL_MARKET_OWNER = "负责市场人员"
COL_PROGRESS_NOTE = "推进进度"
COL_WIN_PROBABILITY = "商机落地概率"
COL_EXPECTED_FINISH_DATE = "预计完成时间"
COL_FIRST_YEAR_REVENUE = "预期首年营收额"


@dataclass(slots=True)
class SheetImport:
    snapshot_date: str
    rows: list[dict[str, Any]]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import opportunity ledger workbook into Supabase.")
    parser.add_argument("--input", default=str(DEFAULT_XLSX_PATH), help="Path to the workbook.")
    parser.add_argument("--dry-run", action="store_true", help="Parse only. Do not write to Supabase.")
    parser.add_argument("--confirm", action="store_true", help="Confirm replacement writes.")
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


def require_env() -> tuple[str, str]:
    load_app_env()
    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_role_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
    return supabase_url, service_role_key


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


def parse_probability(value: Any) -> float | None:
    if is_nan(value):
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)

    text = clean_text(value)
    if text is None:
        return None

    normalized = text.replace("％", "%").replace(",", "")
    is_percent = normalized.endswith("%")
    if is_percent:
        normalized = normalized[:-1].strip()

    match = re.search(r"(-?\d+(?:\.\d+)?)", normalized)
    if not match:
        return None

    probability = float(match.group(1))
    if is_percent:
        probability /= 100.0
    return probability


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
    required = {COL_PROJECT_NAME, COL_STAGE_LABEL, COL_PROGRESS_NOTE, COL_WIN_PROBABILITY}
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
        COL_WIN_PROBABILITY,
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
                "win_probability": parse_probability(row.get(COL_WIN_PROBABILITY)),
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
    supabase_url: str,
    snapshot_date: str,
) -> None:
    response = client.delete(
        f"{supabase_url}/rest/v1/{TABLE_NAME}?snapshot_date=eq.{snapshot_date}",
        headers=headers,
    )
    response.raise_for_status()


def import_to_supabase(imports: list[SheetImport]) -> None:
    supabase_url, service_role_key = require_env()

    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    ledger_url = f"{supabase_url}/rest/v1/{TABLE_NAME}"

    with httpx.Client(timeout=30) as client:
        print(f"[1/2] Replacing snapshot rows in {TABLE_NAME}...")
        inserted_rows = 0
        for sheet_import in imports:
            delete_snapshot_rows(client, headers, supabase_url, sheet_import.snapshot_date)
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
    xlsx_path = Path(args.input).resolve()
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

    if not args.confirm:
        print("This operation replaces snapshot rows. Re-run with --confirm to execute.")
        sys.exit(2)

    import_to_supabase(imports)


if __name__ == "__main__":
    main()
