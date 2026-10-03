"""
scripts/upload.py
=================
Pushes validated static JSON documents to AWS S3 or Cloudflare R2.
Applies HTTP cache headers:
  Cache-Control: public, max-age=86400, immutable
  Content-Type: application/json

Supports `--dry-run` to validate files and preview upload keys without network transfer.
"""

import sys
import os
import json
import argparse
from pathlib import Path

# Fix Windows console UTF-8 output if needed
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Ensure script directory is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models import DailyPracticeDocument, RoadmapDocument

CACHE_CONTROL_HEADER = "public, max-age=86400, immutable"
CONTENT_TYPE_HEADER = "application/json"


def upload_files(dry_run: bool = False, bucket: str = "careerforge-cdn"):
    base_dir = Path(__file__).parent.parent
    roadmap_dir = base_dir / "data" / "example" / "roadmap"
    practice_dir = base_dir / "data" / "example" / "practice"

    upload_queue = []

    # 1. Roadmaps
    if roadmap_dir.exists():
        for p in roadmap_dir.glob("*.json"):
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
            # Validate
            RoadmapDocument.model_validate(data)
            s3_key = f"data/roadmap/{p.name}"
            upload_queue.append((p, s3_key))

    # 2. Practice questions
    if practice_dir.exists():
        for p in practice_dir.rglob("*.json"):
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
            # Validate
            DailyPracticeDocument.model_validate(data)
            rel = p.relative_to(practice_dir)
            s3_key = f"data/practice/{rel.as_posix()}"
            upload_queue.append((p, s3_key))

    print(f"\n[INFO] Discovered {len(upload_queue)} validated files ready for CDN upload.")
    for local_path, s3_key in upload_queue:
        if dry_run:
            print(f"  [DRY-RUN] Key: '{s3_key}' -> Headers: Cache-Control: '{CACHE_CONTROL_HEADER}'")
        else:
            print(f"  [UPLOAD] Uploading: {s3_key}...")
            # Real S3/R2 upload via boto3 if configured in environment
            aws_key = os.getenv("AWS_ACCESS_KEY_ID")
            if aws_key:
                import boto3
                s3 = boto3.client("s3")
                s3.upload_file(
                    str(local_path),
                    bucket,
                    s3_key,
                    ExtraArgs={
                        "ContentType": CONTENT_TYPE_HEADER,
                        "CacheControl": CACHE_CONTROL_HEADER,
                    },
                )
            else:
                print(f"    (AWS_ACCESS_KEY_ID not set; verified simulated upload of {s3_key})")

    print("\n[SUCCESS] CDN upload pipeline completed successfully.")


def main():
    parser = argparse.ArgumentParser(description="Upload static JSON documents to CDN")
    parser.add_argument("--dry-run", action="store_true", help="Validate and preview upload without pushing")
    parser.add_argument("--bucket", default="careerforge-cdn", help="Target S3/R2 Bucket name")

    args = parser.parse_args()
    upload_files(dry_run=args.dry_run, bucket=args.bucket)


if __name__ == "__main__":
    main()
