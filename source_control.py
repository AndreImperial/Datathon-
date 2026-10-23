"""Validate historical supplied workbook schema before analytical regeneration."""
import json
from pathlib import Path
import pandas as pd

def check_source_schema(root):
    root = Path(root)
    expected = json.loads((root / "source_schema.json").read_text(encoding="utf-8"))["sources"]
    actual_files = {file.name for file in (root / "data" / "raw").glob("*.xlsx")}
    if actual_files != set(expected):
        raise ValueError("Source file inventory drift: review source_schema.json against authoritative supplied files")
    for name, sheets in expected.items():
        with pd.ExcelFile(root / "data" / "raw" / name) as book:
            if set(book.sheet_names) != set(sheets):
                raise ValueError(f"Source sheet drift: {name}; review schema baseline")
            for sheet, columns in sheets.items():
                actual = list(pd.read_excel(book, sheet_name=sheet, nrows=0).columns)
                if actual != columns:
                    raise ValueError(f"Source column drift: {name}/{sheet}; investigate before updating source_schema.json")
    return {"schema_status": "matches historical supplied baseline", "source_date_policy": "pending owner-approved expected dates and cadence; build time is not freshness"}
