# import_data.py - FAST BULK VERSION
# Uses pandas to_sql for bulk insert instead of row-by-row
# Much faster — handles 39,000 rows per site without timeout
#
# Usage:
#   python import_data.py           <- imports all sites
#   python import_data.py --site 1  <- imports only site 1

import os
import argparse
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

parser = argparse.ArgumentParser()
parser.add_argument('--site', type=int, help='Import only a specific site (1-7)')
args = parser.parse_args()

# ── Database connection ───────────────────────────────────────────────────────
DB_HOST     = os.getenv('DB_HOST', 'localhost')
DB_PORT     = os.getenv('DB_PORT', '5432')
DB_NAME     = os.getenv('DB_NAME', 'air_quality_db')
DB_USER     = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')

# sslmode=require for Render, ignored on localhost
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?sslmode=require"

print(f"Connecting to: {DB_HOST}:{DB_PORT}/{DB_NAME}")

try:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=300,
        connect_args={"connect_timeout": 60}
    )
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    print("✓ Connected successfully\n")
except Exception as e:
    print(f"✗ Connection failed: {e}")
    exit(1)


def import_csv(filepath):
    """Bulk insert a CSV file into air_quality_data table."""

    print(f"Importing {filepath}...")

    if not os.path.exists(filepath):
        print(f"  ✗ File not found: {filepath}")
        return 0

    # Read CSV
    df = pd.read_csv(filepath)
    print(f"  Read {len(df):,} rows")

    # Drop id column — let PostgreSQL auto-generate
    if 'id' in df.columns:
        df = df.drop(columns=['id'])

    # Convert timestamp
    if 'timestamp' in df.columns:
        df['timestamp'] = pd.to_datetime(df['timestamp'])

    # Replace NaN with None
    df = df.where(pd.notnull(df), None)

    # Check how many already exist for this site
    site_num = int(df['site_number'].iloc[0])
    try:
        with engine.connect() as conn:
            existing = conn.execute(
                text("SELECT COUNT(*) FROM air_quality_data WHERE site_number = :s"),
                {"s": site_num}
            ).fetchone()[0]
    except:
        existing = 0

    if existing > 0:
        print(f"  ⚠ Site {site_num} already has {existing:,} rows — skipping.")
        print(f"    Delete them first in pgAdmin if you want to reimport.")
        return 0

    # Bulk insert in chunks of 5000 rows
    chunk_size = 5000
    total_inserted = 0

    for i in range(0, len(df), chunk_size):
        chunk = df.iloc[i:i + chunk_size]
        try:
            chunk.to_sql(
                'air_quality_data',
                engine,
                if_exists='append',
                index=False,
                method='multi'
            )
            total_inserted += len(chunk)
            print(f"  Progress: {total_inserted:,}/{len(df):,} rows inserted")
        except Exception as e:
            print(f"  ✗ Chunk error at row {i}: {e}")
            break

    print(f"  ✓ Done: {total_inserted:,} rows inserted for site {site_num}\n")
    return total_inserted


# ── Main ──────────────────────────────────────────────────────────────────────
total = 0
exports_dir = "exports"

if not os.path.exists(exports_dir):
    print("✗ 'exports/' folder not found in backend/ directory.")
    exit(1)

sites = [args.site] if args.site else range(1, 8)

for site_num in sites:
    filepath = f"{exports_dir}/site_{site_num}_data.csv"
    total += import_csv(filepath)

print(f"{'='*50}")
print(f"✓ Import complete! Total rows inserted: {total:,}")
print(f"{'='*50}")