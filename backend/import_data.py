import os
import argparse
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

parser = argparse.ArgumentParser()
parser.add_argument('--site', type=int, help='Import only a specific site (1-7)')
args = parser.parse_args()

# ── Support both local and AWS RDS ──
DATABASE_URL = os.getenv('DATABASE_URL')

if DATABASE_URL:
    # AWS RDS — DATABASE_URL already set as environment variable
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://')
    if 'rds.amazonaws.com' in DATABASE_URL and 'sslmode' not in DATABASE_URL:
        DATABASE_URL += '?sslmode=require'
    print(f"Connecting using DATABASE_URL (AWS RDS mode)")
else:
    # Local — build from parts
    DB_HOST     = os.getenv('DB_HOST', 'localhost')
    DB_PORT     = os.getenv('DB_PORT', '5432')
    DB_NAME     = os.getenv('DB_NAME', 'air_quality_db')
    DB_USER     = os.getenv('DB_USER', 'postgres')
    DB_PASSWORD = os.getenv('DB_PASSWORD', '')
    DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    print(f"Connecting to database: {DB_HOST}:{DB_PORT}/{DB_NAME}")

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

os.makedirs('exports', exist_ok=True)

def import_csv(filepath):
    print(f"Importing {filepath}...")
    if not os.path.exists(filepath):
        print(f"  ✗ File not found: {filepath}")
        return 0

    df = pd.read_csv(filepath)
    print(f"  Read {len(df):,} rows")

    if 'id' in df.columns:
        df = df.drop(columns=['id'])
    if 'timestamp' in df.columns:
        df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.where(pd.notnull(df), None)

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
        return 0

    chunk_size = 5000
    total_inserted = 0
    for i in range(0, len(df), chunk_size):
        chunk = df.iloc[i:i + chunk_size]
        try:
            chunk.to_sql(
                'air_quality_data', engine,
                if_exists='append', index=False, method='multi'
            )
            total_inserted += len(chunk)
            print(f"  Progress: {total_inserted:,}/{len(df):,} rows inserted")
        except Exception as e:
            print(f"  ✗ Chunk error at row {i}: {e}")
            break

    print(f"  ✓ Done: {total_inserted:,} rows inserted for site {site_num}\n")
    return total_inserted

# ── Main ──
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