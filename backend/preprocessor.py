import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.model_selection import train_test_split
from models import init_db, get_session, AirQualityData
import joblib
import os

class AirQualityPreprocessor:
    def __init__(self):
        self.engine = init_db()
        self.session = get_session(self.engine)
        self.scaler_features = StandardScaler()
        self.scaler_targets = MinMaxScaler()
        
        # Feature columns WITHOUT satellite data (11 features)
        self.feature_columns = [
            'year', 'month', 'day', 'hour',
            'O3_forecast', 'NO2_forecast', 'T_forecast', 'q_forecast',
            'u_forecast', 'v_forecast', 'w_forecast'
        ]
        
        # Target columns (what we predict)
        self.target_columns = ['O3_target', 'NO2_target']
    
    def load_site_data(self, site_number, is_training=True):
        """
        Load data for a specific site from database
        
        Args:
            site_number: Site number (1-7)
            is_training: Load training data (True) or test data (False)
        """
        query = self.session.query(AirQualityData).filter(
            AirQualityData.site_number == site_number,
            AirQualityData.is_training == (1 if is_training else 0)
        ).order_by(AirQualityData.timestamp)  # Keep temporal order
        
        # Convert to DataFrame
        data = pd.read_sql(query.statement, self.session.bind)
        
        if len(data) == 0:
            raise ValueError(f"No data found for Site {site_number} ({'training' if is_training else 'test'})")
        
        print(f"✓ Loaded {len(data)} records for Site {site_number} ({'training' if is_training else 'test'})")
        
        return data
    
    def check_data_quality(self, df):
        """
        Check data quality and report missing values
        """
        print("\n--- Data Quality Report ---")
        print(f"Total records: {len(df)}")
        print(f"Date range: {df['timestamp'].min()} to {df['timestamp'].max()}")
        
        # Check missing values in features
        print("\nMissing values in features:")
        for col in self.feature_columns:
            if col in df.columns:
                missing = df[col].isna().sum()
                missing_pct = (missing / len(df)) * 100
                print(f"  {col:15s}: {missing:6d} ({missing_pct:5.2f}%)")
        
        # Check missing values in targets
        print("\nMissing values in targets:")
        for col in self.target_columns:
            if col in df.columns:
                missing = df[col].isna().sum()
                missing_pct = (missing / len(df)) * 100
                print(f"  {col:15s}: {missing:6d} ({missing_pct:5.2f}%)")
        
        # Check for duplicate timestamps
        duplicates = df.duplicated(subset=['timestamp']).sum()
        if duplicates > 0:
            print(f"\n⚠ Warning: {duplicates} duplicate timestamps found")
        
        return df
    
    def handle_missing_values(self, df, method='forward_fill'):
        """
        Handle missing values in the dataset
        
        Args:
            df: DataFrame
            method: 'forward_fill', 'interpolate', or 'drop'
        """
        df_clean = df.copy()
        
        if method == 'forward_fill':
            # Forward fill then backward fill for time-series
            df_clean = df_clean.fillna(method='ffill')
            df_clean = df_clean.fillna(method='bfill')
            
        elif method == 'interpolate':
            # Linear interpolation (good for time series)
            df_clean = df_clean.interpolate(method='linear', limit_direction='both')
            
        elif method == 'drop':
            # Drop rows with any missing values in features or targets
            required_cols = self.feature_columns + self.target_columns
            df_clean = df_clean.dropna(subset=required_cols)
            print(f"  Dropped {len(df) - len(df_clean)} rows with missing values")
        
        # Fill any remaining NaN with 0 (should be rare)
        remaining_nan = df_clean[self.feature_columns + self.target_columns].isna().sum().sum()
        if remaining_nan > 0:
            print(f"  Filling {remaining_nan} remaining NaN values with 0")
            df_clean = df_clean.fillna(0)
        
        return df_clean
    
    def remove_outliers(self, df, method='iqr', threshold=3.0):
        """
        Remove extreme outliers from target variables
        
        Args:
            df: DataFrame
            method: 'iqr' or 'zscore'
            threshold: IQR multiplier or Z-score threshold
        """
        df_clean = df.copy()
        initial_len = len(df_clean)
        
        for col in self.target_columns:
            if col not in df_clean.columns:
                continue
            
            if method == 'iqr':
                # Interquartile Range method
                Q1 = df_clean[col].quantile(0.25)
                Q3 = df_clean[col].quantile(0.75)
                IQR = Q3 - Q1
                lower_bound = Q1 - threshold * IQR
                upper_bound = Q3 + threshold * IQR
                
                # Keep values within bounds
                mask = (df_clean[col] >= lower_bound) & (df_clean[col] <= upper_bound)
                df_clean = df_clean[mask]
                
            elif method == 'zscore':
                # Z-score method
                z_scores = np.abs((df_clean[col] - df_clean[col].mean()) / df_clean[col].std())
                df_clean = df_clean[z_scores < threshold]
        
        removed = initial_len - len(df_clean)
        if removed > 0:
            print(f"  Removed {removed} outlier records ({removed/initial_len*100:.2f}%)")
        
        return df_clean
    
    def create_temporal_features(self, df):
        """
        Create additional temporal features with cyclical encoding
        """
        df_temporal = df.copy()
        
        # Cyclical encoding for hour (0-23)
        df_temporal['hour_sin'] = np.sin(2 * np.pi * df_temporal['hour'] / 24)
        df_temporal['hour_cos'] = np.cos(2 * np.pi * df_temporal['hour'] / 24)
        
        # Cyclical encoding for month (1-12)
        df_temporal['month_sin'] = np.sin(2 * np.pi * (df_temporal['month'] - 1) / 12)
        df_temporal['month_cos'] = np.cos(2 * np.pi * (df_temporal['month'] - 1) / 12)
        
        # Cyclical encoding for day of month (1-31)
        df_temporal['day_sin'] = np.sin(2 * np.pi * (df_temporal['day'] - 1) / 31)
        df_temporal['day_cos'] = np.cos(2 * np.pi * (df_temporal['day'] - 1) / 31)
        
        # Season indicator (0=Winter, 1=Spring, 2=Summer, 3=Fall)
        df_temporal['season'] = df_temporal['month'].apply(self._get_season)
        
        # Weekend indicator
        if 'timestamp' in df_temporal.columns:
            df_temporal['is_weekend'] = pd.to_datetime(df_temporal['timestamp']).dt.dayofweek >= 5
            df_temporal['is_weekend'] = df_temporal['is_weekend'].astype(int)
        
        return df_temporal
    
    def _get_season(self, month):
        """Helper function to get season from month"""
        if month in [12, 1, 2]:
            return 0  # Winter
        elif month in [3, 4, 5]:
            return 1  # Spring
        elif month in [6, 7, 8]:
            return 2  # Summer
        else:
            return 3  # Fall
    
    def create_interaction_features(self, df):
        """
        Create interaction features between weather variables
        """
        df_interact = df.copy()
        
        # Wind speed (magnitude from u and v components)
        df_interact['wind_speed'] = np.sqrt(
            df_interact['u_forecast']**2 + df_interact['v_forecast']**2
        )
        
        # Wind direction (angle from u and v)
        df_interact['wind_direction'] = np.arctan2(
            df_interact['v_forecast'], df_interact['u_forecast']
        )
        
        # Temperature-humidity interaction
        df_interact['temp_humidity'] = df_interact['T_forecast'] * df_interact['q_forecast']
        
        # O3-NO2 forecast ratio (chemical relationship)
        # Avoid division by zero
        df_interact['o3_no2_ratio'] = df_interact['O3_forecast'] / (df_interact['NO2_forecast'] + 1e-6)
        
        return df_interact
    
    def prepare_data_simple(self, site_number, test_size=0.25, remove_outliers_flag=True):
        """
        Simple preprocessing pipeline WITHOUT lag features
        (Faster, uses less memory, good for LSTM with sequential data)
        
        Args:
            site_number: Site number (1-7)
            test_size: Proportion for testing (0.25 = 25%)
            remove_outliers_flag: Whether to remove outliers
        
        Returns:
            X_train, X_test, y_train, y_test, feature_names
        """
        print(f"\n{'='*70}")
        print(f"  SIMPLE PREPROCESSING - SITE {site_number}")
        print(f"{'='*70}")
        
        # Load data
        df = self.load_site_data(site_number, is_training=True)
        
        # Check data quality
        df = self.check_data_quality(df)
        
        # Create temporal features
        print("\n✓ Creating temporal features...")
        df = self.create_temporal_features(df)
        
        # Create interaction features
        print("✓ Creating interaction features...")
        df = self.create_interaction_features(df)
        
        # Handle missing values
        print("✓ Handling missing values...")
        df = self.handle_missing_values(df, method='forward_fill')
        
        # Remove outliers if requested
        if remove_outliers_flag:
            print("✓ Removing outliers...")
            df = self.remove_outliers(df, method='iqr', threshold=3.0)
        
        # Define all feature columns
        all_features = self.feature_columns.copy()
        
        # Add temporal features
        temporal_features = [
            'hour_sin', 'hour_cos', 'month_sin', 'month_cos',
            'day_sin', 'day_cos', 'season'
        ]
        if 'is_weekend' in df.columns:
            temporal_features.append('is_weekend')
        
        # Add interaction features
        interaction_features = [
            'wind_speed', 'wind_direction', 'temp_humidity', 'o3_no2_ratio'
        ]
        
        all_features.extend(temporal_features)
        all_features.extend(interaction_features)
        
        # Extract features and targets
        X = df[all_features].values
        y = df[self.target_columns].values
        
        # Temporal split (maintain chronological order)
        split_idx = int(len(X) * (1 - test_size))
        X_train, X_test = X[:split_idx], X[split_idx:]
        y_train, y_test = y[:split_idx], y[split_idx:]
        
        # Normalize features
        print("\n✓ Normalizing features...")
        X_train_scaled = self.scaler_features.fit_transform(X_train)
        X_test_scaled = self.scaler_features.transform(X_test)
        
        # Normalize targets
        y_train_scaled = self.scaler_targets.fit_transform(y_train)
        y_test_scaled = self.scaler_targets.transform(y_test)
        
        print(f"\n{'='*70}")
        print(f"  PREPROCESSING COMPLETE")
        print(f"{'='*70}")
        print(f"Training set:   {X_train_scaled.shape[0]:,} samples")
        print(f"Test set:       {X_test_scaled.shape[0]:,} samples")
        print(f"Total features: {X_train_scaled.shape[1]}")
        print(f"Targets:        {len(self.target_columns)} (O3, NO2)")
        print(f"{'='*70}\n")
        
        return X_train_scaled, X_test_scaled, y_train_scaled, y_test_scaled, all_features
    
    def prepare_data_with_lags(self, site_number, lag_hours=[24, 48, 72], test_size=0.25):
        """
        Advanced preprocessing WITH lag features
        (Better for XGBoost, uses more memory)
        
        Args:
            site_number: Site number (1-7)
            lag_hours: List of lag periods in hours [24, 48, 72] = [1d, 2d, 3d]
            test_size: Proportion for testing
        
        Returns:
            X_train, X_test, y_train, y_test, feature_names
        """
        print(f"\n{'='*70}")
        print(f"  ADVANCED PREPROCESSING WITH LAGS - SITE {site_number}")
        print(f"{'='*70}")
        
        # Load data
        df = self.load_site_data(site_number, is_training=True)
        
        # Check data quality
        df = self.check_data_quality(df)
        
        # Sort by timestamp
        df = df.sort_values('timestamp')
        
        # Create temporal features
        print("\n✓ Creating temporal features...")
        df = self.create_temporal_features(df)
        
        # Create interaction features
        print("✓ Creating interaction features...")
        df = self.create_interaction_features(df)
        
        # Add lag features
        print(f"✓ Adding lag features: {lag_hours}h...")
        for target in self.target_columns:
            if target in df.columns:
                for lag in lag_hours:
                    df[f'{target}_lag_{lag}h'] = df[target].shift(lag)
        
        # Also add lag for forecast values
        for feature in ['O3_forecast', 'NO2_forecast', 'T_forecast']:
            for lag in [24, 48]:  # Only 1-2 day lags for forecasts
                df[f'{feature}_lag_{lag}h'] = df[feature].shift(lag)
        
        # Drop rows with NaN created by lagging (first N hours)
        initial_len = len(df)
        df = df.dropna()
        print(f"  Dropped {initial_len - len(df)} initial rows due to lag creation")
        
        # Handle remaining missing values
        print("✓ Handling remaining missing values...")
        df = self.handle_missing_values(df, method='forward_fill')
        
        # Remove outliers
        print("✓ Removing outliers...")
        df = self.remove_outliers(df, method='iqr', threshold=3.0)
        
        # Define all features
        all_features = self.feature_columns.copy()
        
        # Temporal features
        temporal_features = [
            'hour_sin', 'hour_cos', 'month_sin', 'month_cos',
            'day_sin', 'day_cos', 'season'
        ]
        if 'is_weekend' in df.columns:
            temporal_features.append('is_weekend')
        
        # Interaction features
        interaction_features = [
            'wind_speed', 'wind_direction', 'temp_humidity', 'o3_no2_ratio'
        ]
        
        # Lag features
        lag_features = [col for col in df.columns if 'lag' in col]
        
        all_features.extend(temporal_features)
        all_features.extend(interaction_features)
        all_features.extend(lag_features)
        
        # Extract features and targets
        X = df[all_features].values
        y = df[self.target_columns].values
        
        # Temporal split
        split_idx = int(len(X) * (1 - test_size))
        X_train, X_test = X[:split_idx], X[split_idx:]
        y_train, y_test = y[:split_idx], y[split_idx:]
        
        # Normalize
        print("\n✓ Normalizing features...")
        X_train_scaled = self.scaler_features.fit_transform(X_train)
        X_test_scaled = self.scaler_features.transform(X_test)
        
        y_train_scaled = self.scaler_targets.fit_transform(y_train)
        y_test_scaled = self.scaler_targets.transform(y_test)
        
        print(f"\n{'='*70}")
        print(f"  PREPROCESSING COMPLETE")
        print(f"{'='*70}")
        print(f"Training set:   {X_train_scaled.shape[0]:,} samples")
        print(f"Test set:       {X_test_scaled.shape[0]:,} samples")
        print(f"Total features: {X_train_scaled.shape[1]}")
        print(f"  - Base features:        {len(self.feature_columns)}")
        print(f"  - Temporal features:    {len(temporal_features)}")
        print(f"  - Interaction features: {len(interaction_features)}")
        print(f"  - Lag features:         {len(lag_features)}")
        print(f"Targets:        {len(self.target_columns)} (O3, NO2)")
        print(f"{'='*70}\n")
        
        return X_train_scaled, X_test_scaled, y_train_scaled, y_test_scaled, all_features
    
    def save_scalers(self, site_number, output_dir='models'):
        """Save fitted scalers for later use"""
        os.makedirs(output_dir, exist_ok=True)
        
        joblib.dump(self.scaler_features, f'{output_dir}/scaler_features_site_{site_number}.pkl')
        joblib.dump(self.scaler_targets, f'{output_dir}/scaler_targets_site_{site_number}.pkl')
        
        print(f"✓ Scalers saved for Site {site_number}")
    
    def load_scalers(self, site_number, input_dir='models'):
        """Load previously saved scalers"""
        self.scaler_features = joblib.load(f'{input_dir}/scaler_features_site_{site_number}.pkl')
        self.scaler_targets = joblib.load(f'{input_dir}/scaler_targets_site_{site_number}.pkl')
        
        print(f"✓ Scalers loaded for Site {site_number}")
    
    def get_preprocessing_summary(self):
        """Get summary of preprocessing configuration"""
        return {
            'base_features': self.feature_columns,
            'target_variables': self.target_columns,
            'satellite_data_included': False,
            'scaler_features': type(self.scaler_features).__name__,
            'scaler_targets': type(self.scaler_targets).__name__,
            'note': 'Satellite data excluded due to excessive missing values'
        }

# Example usage
if __name__ == "__main__":
    preprocessor = AirQualityPreprocessor()
    
    print("\n" + "="*70)
    print("  AIR QUALITY DATA PREPROCESSOR")
    print("  (WITHOUT Satellite Data)")
    print("="*70)
    
    # Show configuration
    summary = preprocessor.get_preprocessing_summary()
    print(f"\nBase Features ({len(summary['base_features'])}):")
    for feat in summary['base_features']:
        print(f"  - {feat}")
    
    print(f"\nTarget Variables:")
    for target in summary['target_variables']:
        print(f"  - {target}")
    
    print(f"\nSatellite Data: {'Included' if summary['satellite_data_included'] else 'Excluded ✓'}")
    
    # Test preprocessing
    print("\n" + "="*70)
    print("  TESTING SIMPLE PREPROCESSING")
    print("="*70)
    
    X_train, X_test, y_train, y_test, features = preprocessor.prepare_data_simple(
        site_number=1,
        test_size=0.25,
        remove_outliers_flag=True
    )
    
    # Save scalers
    preprocessor.save_scalers(site_number=1)
    
    print("\n✓ Preprocessing test complete!")
    print(f"\nData shapes:")
    print(f"  X_train: {X_train.shape}")
    print(f"  X_test:  {X_test.shape}")
    print(f"  y_train: {y_train.shape}")
    print(f"  y_test:  {y_test.shape}")