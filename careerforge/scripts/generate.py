"""
scripts/generate.py
===================
CLI generator and validator for DailyPracticeDocument and RoadmapDocument.
Runs under daily cron/GitHub Action at 00:00 UTC.
Validates documents via Pydantic V2 before writing to disk or CDN.

Usage:
  python scripts/generate.py --dry-run
  python scripts/generate.py --track frontend --date 2026-09-14
"""

import sys
import os
import json
import argparse
from datetime import datetime, timezone
from pathlib import Path

# Fix Windows console UTF-8 output if needed
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Ensure script directory is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models import DailyPracticeDocument, RoadmapDocument, PracticeQuestion


TRACKS = ["frontend", "backend", "mobile", "fullstack"]


def validate_existing_files(base_dir: Path, dry_run: bool = False) -> bool:
    """Validates all example JSON documents currently in the project."""
    print("==================================================")
    print("[INFO] Validating existing Static JSON Documents...")
    print("==================================================")

    all_passed = True
    roadmap_dir = base_dir / "data" / "example" / "roadmap"
    practice_dir = base_dir / "data" / "example" / "practice"

    # 1. Validate Roadmaps
    if roadmap_dir.exists():
        for file_path in roadmap_dir.glob("*.json"):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    raw = json.load(f)
                doc = RoadmapDocument.model_validate(raw)
                print(f"  [OK] Roadmap valid: {file_path.name} ({len(doc.nodes)} nodes)")
            except Exception as e:
                print(f"  [FAIL] Validation failed for {file_path}: {e}")
                all_passed = False

    # 2. Validate Daily Practice Sets
    if practice_dir.exists():
        for track in TRACKS:
            track_folder = practice_dir / track
            if not track_folder.exists():
                continue
            for file_path in track_folder.glob("*.json"):
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        raw = json.load(f)
                    doc = DailyPracticeDocument.model_validate(raw)
                    print(
                        f"  [OK] Practice valid: {track}/{file_path.name} "
                        f"({len(doc.questions)} questions)"
                    )
                except Exception as e:
                    print(f"  [FAIL] Practice validation failed for {file_path}: {e}")
                    all_passed = False

    return all_passed


def main():
    parser = argparse.ArgumentParser(description="CareerForge Daily Practice & Roadmap Generator")
    parser.add_argument("--dry-run", action="store_true", help="Validate and print without writing")
    parser.add_argument("--track", choices=TRACKS + ["all"], default="all", help="Target track")
    parser.add_argument("--date", help="Target UTC date (YYYY-MM-DD). Defaults to today.")

    args = parser.parse_args()

    target_date = args.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    base_dir = Path(__file__).parent.parent

    print(f"Starting generator. Date: {target_date}, Track: {args.track}, Dry Run: {args.dry_run}")

    # Validate all existing documents
    passed = validate_existing_files(base_dir, dry_run=args.dry_run)
    if not passed:
        print("\n[ERROR] One or more existing files failed schema validation!")
        sys.exit(1)

    print("\n[SUCCESS] All Static CDN documents passed validation!")
    if args.dry_run:
        print("Dry run completed successfully. Zero disk/network mutations.")
        sys.exit(0)


if __name__ == "__main__":
    main()
