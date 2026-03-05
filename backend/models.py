
from sqlalchemy import create_engine, Column, Integer, Float, DateTime, String, Index, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.dialects.postgresql import ARRAY
from datetime import datetime
from config import Config

Base = declarative_base()

# Monitoring Sites Model
class MonitoringSite(Base):
    __tablename__ = 'monitoring_sites'
    
    id = Column(Integer, primary_key=True)
    site_number = Column(Integer, unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'site_number': self.site_number,
            'name': self.name,
            'latitude': self.latitude,
            'longitude': self.longitude
        }

# Air Quality Data Model (UPDATED - No Satellite Columns)
class AirQualityData(Base):
    __tablename__ = 'air_quality_data'
    
    id = Column(Integer, primary_key=True)
    site_number = Column(Integer, nullable=False, index=True)
    
    # Temporal features
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    day = Column(Integer, nullable=False)
    hour = Column(Integer, nullable=False)
    timestamp = Column(DateTime, nullable=False, index=True)
    
    # Forecast parameters (from reanalysis/weather APIs)
    O3_forecast = Column(Float)
    NO2_forecast = Column(Float)
    T_forecast = Column(Float)  # Temperature
    q_forecast = Column(Float)  # Specific humidity
    u_forecast = Column(Float)  # U-component of wind
    v_forecast = Column(Float)  # V-component of wind
    w_forecast = Column(Float)  # W-component of wind

    
    # Target variables (ground truth from monitoring stations)
    O3_target = Column(Float)
    NO2_target = Column(Float)
    
    # Data split indicator
    is_training = Column(Integer, default=1, index=True)  # 1 for train, 0 for test/live
    
    # Composite indexes for better query performance
    __table_args__ = (
        Index('idx_site_timestamp', 'site_number', 'timestamp'),
        Index('idx_site_training', 'site_number', 'is_training'),
        Index('idx_timestamp_only', 'timestamp'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'site_number': self.site_number,
            'year': self.year,
            'month': self.month,
            'day': self.day,
            'hour': self.hour,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'O3_forecast': self.O3_forecast,
            'NO2_forecast': self.NO2_forecast,
            'T_forecast': self.T_forecast,
            'q_forecast': self.q_forecast,
            'u_forecast': self.u_forecast,
            'v_forecast': self.v_forecast,
            'w_forecast': self.w_forecast,
            'O3_target': self.O3_target,
            'NO2_target': self.NO2_target,
            'is_training': self.is_training
        }



class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True)

    site_number = Column(Integer, nullable=False, index=True)

    # When forecast was generated
    forecast_origin = Column(DateTime, nullable=False, index=True)

    # Target timestamp being predicted
    timestamp = Column(DateTime, nullable=False, index=True)

    # Forecast step (1–24 hours ahead)
    horizon = Column(Integer, nullable=False)

    # Predicted values
    O3_predicted = Column(Float)
    NO2_predicted = Column(Float)

    model_version = Column(String(50), default="xgb_v1")

    created_at = Column(DateTime, default=datetime.utcnow)

    # Composite index for fast evaluation queries
    __table_args__ = (
        Index("idx_pred_site_timestamp", "site_number", "timestamp"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "site_number": self.site_number,
            "forecast_origin": self.forecast_origin.isoformat(),
            "timestamp": self.timestamp.isoformat(),
            "horizon": self.horizon,
            "O3_predicted": self.O3_predicted,
            "NO2_predicted": self.NO2_predicted,
            "model_version": self.model_version,
            "created_at": self.created_at.isoformat(),
        }


# Database initialization
def init_db(database_url=None):
    """
    Initialize the database
    
    Args:
        database_url: PostgreSQL connection string (optional, uses config if not provided)
    """
    if database_url is None:
        database_url = Config.get_database_url()
    
    # Create engine with PostgreSQL-specific settings
    engine = create_engine(
        database_url,
        pool_size=10,  # Connection pool size
        max_overflow=20,  # Max connections beyond pool_size
        pool_pre_ping=True,  # Verify connections before using
        echo=Config.SQLALCHEMY_ECHO  # Log SQL queries if enabled
    )
    
    # Create all tables (won't recreate existing ones)
    Base.metadata.create_all(engine)
    print("✓ Database tables verified/created successfully")
    
    return engine

def get_session(engine):
    """Get a database session"""
    Session = sessionmaker(bind=engine)
    return Session()

def populate_sites(session):
    """Populate monitoring sites"""
    sites_data = [
        {'site_number': 1, 'name': 'North Delhi', 'latitude': 28.69536, 'longitude': 77.18168},
        {'site_number': 2, 'name': 'West Delhi', 'latitude': 28.5718, 'longitude': 77.07125},
        {'site_number': 3, 'name': 'South Delhi', 'latitude': 28.58278, 'longitude': 77.23441},
        {'site_number': 4, 'name': 'North-West Delhi', 'latitude': 28.82286, 'longitude': 77.10197},
        {'site_number': 5, 'name': 'South-East Delhi', 'latitude': 28.53077, 'longitude': 77.27123},
        {'site_number': 6, 'name': 'Central Delhi', 'latitude': 28.72954, 'longitude': 77.09601},
        {'site_number': 7, 'name': 'East Delhi', 'latitude': 28.71052, 'longitude': 77.24951}
    ]
    
    # Check if sites already exist
    existing = session.query(MonitoringSite).count()
    if existing == 0:
        for site_data in sites_data:
            site = MonitoringSite(**site_data)
            session.add(site)
        session.commit()
        print(f"✓ Added {len(sites_data)} monitoring sites to database")
    else:
        print(f"✓ Database already contains {existing} sites")
    
    return session.query(MonitoringSite).all()
from sqlalchemy.dialects.postgresql import ARRAY

class UserToken(Base):
    __tablename__ = 'user_tokens'
    
    id = Column(Integer, primary_key=True)
    fcm_token = Column(String(500), unique=True, nullable=False, index=True)
    aqi_threshold = Column(Integer, default=100)
    notify_critical = Column(Boolean, default=True)
    notify_high = Column(Boolean, default=True)
    notify_moderate = Column(Boolean, default=True)
    monitored_sites = Column(ARRAY(Integer), default=[1,2,3,4,5,6,7])
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'aqi_threshold': self.aqi_threshold,
            'notify_critical': self.notify_critical,
            'notify_high': self.notify_high,
            'notify_moderate': self.notify_moderate,
            'monitored_sites': self.monitored_sites,
            'created_at': self.created_at.isoformat()
        }

class NotificationLog(Base):
    __tablename__ = 'notification_log'
    
    id = Column(Integer, primary_key=True)
    token_id = Column(Integer, nullable=False, index=True)
    site_number = Column(Integer, nullable=False)
    aqi = Column(Integer, nullable=False)
    severity = Column(String(20), nullable=False)
    sent_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    __table_args__ = (
        Index('idx_notif_log_token_site', 'token_id', 'site_number', 'sent_at'),
    )

def test_connection():
    """Test database connection"""
    try:
        engine = init_db()
        session = get_session(engine)
        
        # Try a simple query
        count = session.query(MonitoringSite).count()
        session.close()
        
        print(f"✓ Database connection successful!")
        print(f"✓ Sites in database: {count}")
        return True
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        return False

if __name__ == "__main__":
    print("Testing PostgreSQL connection...")
    print(f"Database URL: {Config.get_database_url()}")
    print()
    
    # Test connection
    if test_connection():
        # Initialize and populate
        engine = init_db()
        session = get_session(engine)
        populate_sites(session)
        session.close()
        print("\n✓ Database setup complete!")
    else:
        print("\n✗ Please check your database configuration")