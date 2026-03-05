# export_data.py - FIXED VERSION
# Run this on YOUR machine (local database) to export data to CSV files.
# Usage: python export_data.py

import os
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DB_HOST     = os.getenv('DB_HOST', 'localhost')
DB_PORT     = os.getenv('DB_PORT', '5432')
DB_NAME     = os.getenv('DB_NAME', 'air_quality_db')
DB_USER     = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

print(f"Connecting to database: {DB_HOST}:{DB_PORT}/{DB_NAME}")

try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    print("✓ Database connected successfully\n")
except Exception as e:
    print(f"✗ Database connection failed: {e}")
    exit(1)

os.makedirs('exports', exist_ok=True)

all_data = []

for site_num in range(1, 8):
    print(f"Exporting site {site_num}...", end=" ", flush=True)

    try:
        with engine.connect() as conn:
            result = conn.execute(
                text("""
                    SELECT
                        id, site_number, year, month, day, hour, timestamp,
                        "O3_forecast", "NO2_forecast", "T_forecast",
                        q_forecast, u_forecast, v_forecast, w_forecast,
                        "O3_target", "NO2_target", is_training
                    FROM air_quality_data
                    WHERE site_number = :site_num
                    ORDER BY timestamp ASC
                """),
                {"site_num": site_num}
            )
            df = pd.DataFrame(result.fetchall(), columns=result.keys())

        if df.empty:
            print("No data found, skipping.")
            continue

        filename = f"exports/site_{site_num}_data.csv"
        df.to_csv(filename, index=False)
        print(f"✓ {len(df):,} rows → {filename}")
        all_data.append(df)

    except Exception as e:
        print(f"✗ Error: {e}")

if all_data:
    combined = pd.concat(all_data, ignore_index=True)
    combined_file = "exports/all_sites_data.csv"
    combined.to_csv(combined_file, index=False)
    print(f"\n✓ Combined file: {combined_file} ({len(combined):,} total rows)")
    print("✓ Export complete! Now run: python import_data.py")
else:
    print("\n✗ No data exported. Check your local .env points to localhost.")