"""
Import visible sheets from the workbook into Supabase.

Target tables:
1. opportunity_ledger_snapshots
2. opportunity_ledger

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
    / "\u0032\u0030\u0032\u0035\u5b66\u5e74\u5546\u673a\u9879\u76ee\u53f0\u8d26 (2).xlsx"
)

YEAR_BOUNDARY_MONTH = 3
SCHEMA_VERSION = "visible_v1"

COL_PROJECT_GROUP = "\u9879\u76ee\u5206\u7ec4"
COL_PROJECT_NAME = "\u9879\u76ee\u540d\u79f0"
COL_STAGE_LABEL = "\u63a8\u8fdb\u9636\u6bb5"
COL_PROGRESS_NOTE = "\u63a8\u8fdb\u8fdb\u5ea6"
COL_TARGET_DATE = "\u9884\u8ba1\u5b8c\u6210\u65f6\u95f4"
COL_FIRST_YEAR_REVENUE = "\u9884\u671f\u9996\u5e74\u8425\u6536\u989d"

STAGE_CODE_MAP = {
    "\u7ebf\u7d22": "lead",
    "\u5546\u673a": "opportunity",
    "\u5185\u90e8\u6295\u51b3": "internal_approval",
    "\u5ba2\u6237\u6295\u51b3": "customer_approval",
    "\u7b7e\u7ea6": "contracted",
}


@dataclass(slots=True)
class SnapshotPayload:
    sheet_name: str
    sheet_index: int
    snapshot_date: str
    source_file_name: str
    source_file_path: str
    row_count: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import opportunity ledger workbook into Supabase.")
    parser.add_argument("--xlsx", default=str(DEFAULT_XLSX_PATH), help="Path to the workbook.")
    parser.add_argument("--dry-run", action="store_true", help="Parse only. Do not write to Supabase.")
    parser.add_argument(
        "--keep-existing",
        action="store_true",
        help="Keep existing snapshots instead of deleting all snapshots before import.",
    )
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


def parse_snapshot_date(sheet_name: str) -> str:
    if not re.fullmatch(r"\d{4}", sheet_name):
        raise ValueError(f"Cannot parse snapshot date from sheet name: {sheet_name}")

    month = int(sheet_name[:2])
    day = int(sheet_name[2:])
    year = 2025 if month >= YEAR_BOUNDARY_MONTH else 2026
    return f"{year}-{month:02d}-{day:02d}"


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    renamed: dict[str, str] = {}
    unnamed_index = 0
    for col in df.columns:
        name = str(col).strip()
        if name.startswith("Unnamed:") or name == "":
            unnamed_index += 1
            renamed[col] = COL_PROJECT_GROUP if unnamed_index == 1 else f"unnamed_{unnamed_index}"
        else:
            renamed[col] = name
    return df.rename(columns=renamed)


def find_header_row(xls: pd.ExcelFile, sheet_name: str) -> int:
    raw = pd.read_excel(xls, sheet_name=sheet_name, header=None)
    for index in range(min(10, len(raw))):
        row_values = {str(v).strip() for v in raw.iloc[index] if not is_nan(v)}
        if {COL_PROJECT_NAME, COL_STAGE_LABEL}.issubset(row_values):
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


def build_snapshot_payload(
    xlsx_path: Path,
    sheet_name: str,
    sheet_index: int,
    row_count: int,
) -> SnapshotPayload:
    return SnapshotPayload(
        sheet_name=sheet_name,
        sheet_index=sheet_index,
        snapshot_date=parse_snapshot_date(sheet_name),
        source_file_name=xlsx_path.name,
        source_file_path=str(xlsx_path),
        row_count=row_count,
    )


def read_visible_sheet(
    xls: pd.ExcelFile,
    xlsx_path: Path,
    sheet_name: str,
    sheet_index: int,
) -> tuple[SnapshotPayload, list[dict[str, Any]]]:
    header_row = find_header_row(xls, sheet_name)
    df = pd.read_excel(xls, sheet_name=sheet_name, header=header_row)
    df = normalize_columns(df)

    required_columns = {
        COL_PROJECT_GROUP,
        COL_PROJECT_NAME,
        COL_STAGE_LABEL,
        COL_PROGRESS_NOTE,
        COL_TARGET_DATE,
        COL_FIRST_YEAR_REVENUE,
    }
    missing = required_columns.difference(df.columns)
    if missing:
        raise ValueError(f"Sheet [{sheet_name}] is missing columns: {sorted(missing)}")

    df[COL_PROJECT_GROUP] = df[COL_PROJECT_GROUP].ffill()

    records: list[dict[str, Any]] = []
    snapshot_date = parse_snapshot_date(sheet_name)
    for index, row in df.iterrows():
        project_name = clean_text(row.get(COL_PROJECT_NAME))
        stage_label = clean_text(row.get(COL_STAGE_LABEL))
        if not project_name or not stage_label:
            continue

        row_number = header_row + index + 2
        target_raw = clean_text(row.get(COL_TARGET_DATE))
        revenue_raw = clean_text(row.get(COL_FIRST_YEAR_REVENUE))

        records.append(
            {
                "snapshot_date": snapshot_date,
                "sheet_name": sheet_name,
                "row_number": int(row_number),
                "project_group": clean_text(row.get(COL_PROJECT_GROUP)),
                "project_name": project_name.replace("\n", ""),
                "stage_code": STAGE_CODE_MAP.get(stage_label, "unknown"),
                "stage_label": stage_label,
                "progress_note": clean_text(row.get(COL_PROGRESS_NOTE)),
                "target_date": parse_excel_date(row.get(COL_TARGET_DATE)),
                "target_date_raw": target_raw,
                "first_year_revenue": parse_amount(row.get(COL_FIRST_YEAR_REVENUE)),
                "first_year_revenue_raw": revenue_raw,
                "schema_version": SCHEMA_VERSION,
            }
        )

    snapshot = build_snapshot_payload(
        xlsx_path=xlsx_path,
        sheet_name=sheet_name,
        sheet_index=sheet_index,
        row_count=len(records),
    )
    return snapshot, records


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


def delete_all_snapshots(client: httpx.Client, headers: dict[str, str]) -> None:
    response = client.delete(
        f"{SUPABASE_URL}/rest/v1/opportunity_ledger_snapshots?id=not.is.null",
        headers=headers,
    )
    response.raise_for_status()


def import_to_supabase(
    snapshots_with_rows: list[tuple[SnapshotPayload, list[dict[str, Any]]]],
    keep_existing: bool,
) -> None:
    require_env()

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    snapshot_url = f"{SUPABASE_URL}/rest/v1/opportunity_ledger_snapshots"
    ledger_url = f"{SUPABASE_URL}/rest/v1/opportunity_ledger"

    with httpx.Client(timeout=30) as client:
        if not keep_existing:
            print("[1/3] Deleting existing snapshots...")
            delete_all_snapshots(client, headers)
            print("  Cleared opportunity_ledger_snapshots and cascaded detail rows.")
        else:
            print("[1/3] Keeping existing snapshots.")

        print("[2/3] Writing snapshots and detail rows...")
        inserted_rows = 0
        for snapshot, rows in snapshots_with_rows:
            snapshot_payload = {
                "sheet_name": snapshot.sheet_name,
                "sheet_index": snapshot.sheet_index,
                "snapshot_date": snapshot.snapshot_date,
                "source_file_name": snapshot.source_file_name,
                "source_file_path": snapshot.source_file_path,
                "row_count": snapshot.row_count,
            }
            created_snapshot = post_json(client, snapshot_url, headers, snapshot_payload)[0]
            snapshot_id = created_snapshot["id"]

            ledger_rows = [{**row, "snapshot_id": snapshot_id} for row in rows]
            batch_size = 100
            for offset in range(0, len(ledger_rows), batch_size):
                batch = ledger_rows[offset : offset + batch_size]
                result = post_json(client, ledger_url, headers, batch)
                inserted_rows += len(result)

            print(
                f"  Imported sheet [{snapshot.sheet_name}] "
                f"for snapshot {snapshot.snapshot_date}: {len(rows)} rows"
            )

        print(f"[3/3] Done. Inserted {inserted_rows} detail rows.")


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
        snapshots_with_rows: list[tuple[SnapshotPayload, list[dict[str, Any]]]] = []
        total_rows = 0
        for sheet_index, sheet_name in enumerate(visible_sheets, start=1):
            snapshot, rows = read_visible_sheet(xls, xlsx_path, sheet_name, sheet_index)
            snapshots_with_rows.append((snapshot, rows))
            total_rows += len(rows)
            print(
                f"  Sheet [{sheet_name}] -> {len(rows)} rows, "
                f"snapshot date {snapshot.snapshot_date}"
            )
    finally:
        xls.close()

    if not snapshots_with_rows:
        print("No visible sheets to import.")
        return

    print(f"Prepared {len(snapshots_with_rows)} snapshots and {total_rows} rows.")

    if args.dry_run:
        print("Dry run complete. No data written.")
        return

    import_to_supabase(snapshots_with_rows, keep_existing=args.keep_existing)


if __name__ == "__main__":
    main()
