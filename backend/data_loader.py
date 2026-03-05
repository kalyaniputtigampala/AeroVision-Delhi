import pandas as pd
import numpy as np
from datetime import datetime
from models import AirQualityData, init_db, get_session, populate_sites
from sqlalchemy import func
import os

class DataLoader:
    def __init__(self, data_directory='data'):
        """
        Initialize data loader
        
        Args:
            data_directory: Directory containing CSV files
        """
        self.data_directory = data_directory
        self.engine = init_db()
        self.session = get_session(self.engine)
        
        # Initialize monitoring sites
        populate_sites(self.session)
    
    def load_csv_file(self, filepath, site_number, is_training=True):
        """
        Load a single CSV file into the database
        
        Args:
            filepath: Path to CSV file
            site_number: Site number (1-7)
            is_training: Whether this is training data (True) or unseen validation data (False)
        """
        print(f"\nLoading data from: {filepath}")
        print(f"Site: {site_number}, Training: {is_training}")
        
        try:
            # Read CSV file
            df = pd.read_csv(filepath)
            print(f"Loaded {len(df)} rows from CSV")
            
            # Display column names for verification
            print(f"Columns: {df.columns.tolist()}")
            
            # Create timestamp from year, month, day, hour
            df['timestamp'] = pd.to_datetime(
                df[['year', 'month', 'day', 'hour']].rename(
                    columns={'year': 'year', 'month': 'month', 'day': 'day', 'hour': 'hour'}
                )
            )
            
            # Convert to database records
            records = []
            for idx, row in df.iterrows():
                record = AirQualityData(
                    site_number=site_number,
                    year=int(row['year']),
                    month=int(row['month']),
                    day=int(row['day']),
                    hour=int(row['hour']),
                    timestamp=row['timestamp'],
                    O3_forecast=float(row['O3_forecast']) if pd.notna(row['O3_forecast']) else None,
                    NO2_forecast=float(row['NO2_forecast']) if pd.notna(row['NO2_forecast']) else None,
                    T_forecast=float(row['T_forecast']) if pd.notna(row['T_forecast']) else None,
                    q_forecast=float(row['q_forecast']) if pd.notna(row['q_forecast']) else None,
                    u_forecast=float(row['u_forecast']) if pd.notna(row['u_forecast']) else None,
                    v_forecast=float(row['v_forecast']) if pd.notna(row['v_forecast']) else None,
                    w_forecast=float(row['w_forecast']) if pd.notna(row['w_forecast']) else None,
                    NO2_satellite=float(row['NO2_satellite']) if pd.notna(row['NO2_satellite']) else None,
                    HCHO_satellite=float(row['HCHO_satellite']) if pd.notna(row['HCHO_satellite']) else None,
                    ratio_satellite=float(row['ratio_satellite']) if pd.notna(row['ratio_satellite']) else None,
                    O3_target=float(row['O3_target']) if 'O3_target' in row and pd.notna(row['O3_target']) else None,
                    NO2_target=float(row['NO2_target']) if 'NO2_target' in row and pd.notna(row['NO2_target']) else None,
                    is_training=1 if is_training else 0
                )
                records.append(record)
                
                # Batch insert for performance
                if len(records) >= 1000:
                    self.session.bulk_save_objects(records)
                    self.session.commit()
                    print(f"Inserted {len(records)} records (batch)")
                    records = []
            
            # Insert remaining records
            if records:
                self.session.bulk_save_objects(records)
                self.session.commit()
                print(f"Inserted {len(records)} records (final batch)")
            
            print(f"✓ Successfully loaded {len(df)} rows for Site {site_number}")
            return True
            
        except Exception as e:
            print(f"✗ Error loading file: {e}")
            self.session.rollback()
            return False
    
    def load_all_sites(self, site_numbers=[1, 2, 3, 4, 5, 6, 7]):
        """
        Load training data for all specified sites
        Args:
            site_numbers: List of site numbers to load
        """
        for site_num in site_numbers:
            train_file = os.path.join(self.data_directory, f'site_{site_num}_train_data.csv')
            if os.path.exists(train_file):
                self.load_csv_file(train_file, site_num, is_training=True)
            else:
                print(f"⚠ Warning: Training file not found for site {site_num}: {train_file}")
    
    def load_unseen_data(self, site_number):
        """
        Load unseen validation data for a specific site
        
        Args:
            site_number: Site number (1-7)
        """
        unseen_file = os.path.join(self.data_directory, f'site_{site_number}_unseen_input_data.csv')
        
        if os.path.exists(unseen_file):
            self.load_csv_file(unseen_file, site_number, is_training=False)
        else:
            print(f"⚠ Warning: Unseen data file not found for site {site_number}: {unseen_file}")
    
    def get_statistics(self):
        """Get database statistics"""
        stats = {}
        
        # Total records
        stats['total_records'] = self.session.query(func.count(AirQualityData.id)).scalar()
        
        # Records by site
        stats['records_by_site'] = {}
        for site_num in range(1, 8):
            count = self.session.query(func.count(AirQualityData.id)).filter(
                AirQualityData.site_number == site_num
            ).scalar()
            stats['records_by_site'][site_num] = count
        
        # Training vs test
        training_count = self.session.query(func.count(AirQualityData.id)).filter(
            AirQualityData.is_training == 1
        ).scalar()
        test_count = self.session.query(func.count(AirQualityData.id)).filter(
            AirQualityData.is_training == 0
        ).scalar()
        
        stats['training_records'] = training_count
        stats['test_records'] = test_count
        
        # Date range
        min_date = self.session.query(func.min(AirQualityData.timestamp)).scalar()
        max_date = self.session.query(func.max(AirQualityData.timestamp)).scalar()
        
        stats['date_range'] = {
            'start': min_date.isoformat() if min_date else None,
            'end': max_date.isoformat() if max_date else None
        }
        
        return stats
    
    def close(self):
        """Close database connection"""
        self.session.close()

# Example usage
if __name__ == "__main__":
    # Create data directory if it doesn't exist
    if not os.path.exists('data'):
        os.makedirs('data')
        print("Created 'data' directory. Please place your CSV files here.")
        print("\nExpected file format:")
        print("  - site_1_train_data.csv")
        print("  - site_2_train_data.csv")
        print("  - ...")
        print("  - site_1_unseen_input_data.csv")
        print("  - etc.")
    else:
        # Initialize loader
        loader = DataLoader(data_directory='data')
        
        # Load all training data
        print("\n=== Loading Training Data ===")
        loader.load_all_sites()
        
        # Get and display statistics
        print("\n=== Database Statistics ===")
        stats = loader.get_statistics()
        print(f"Total Records: {stats['total_records']}")
        print(f"Training Records: {stats['training_records']}")
        print(f"Test Records: {stats['test_records']}")
        print(f"\nRecords by Site:")
        for site, count in stats['records_by_site'].items():
            print(f"  Site {site}: {count:,} records")
        print(f"\nDate Range: {stats['date_range']['start']} to {stats['date_range']['end']}")
        
        loader.close()
        print("\n✓ Data loading complete!")