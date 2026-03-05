import os
from dotenv import load_dotenv
from urllib.parse import quote_plus

# Load environment variables from .env file
load_dotenv()

class Config:
    """Application configuration"""
    
    # PostgreSQL Database Configuration
    DB_HOST = os.getenv('DB_HOST', 'localhost')
    DB_PORT = os.getenv('DB_PORT', '5432')
    DB_NAME = os.getenv('DB_NAME', 'air_quality_db')
    DB_USER = os.getenv('DB_USER', 'airq_user')
    DB_PASSWORD = os.getenv('DB_PASSWORD', 'your_secure_password')
    
    # URL-encode password to handle special characters
    DB_PASSWORD_ENCODED = quote_plus(DB_PASSWORD)
    
    # Construct database URL with encoded password
    SQLALCHEMY_DATABASE_URI = f'postgresql://{DB_USER}:{DB_PASSWORD_ENCODED}@{DB_HOST}:{DB_PORT}/{DB_NAME}'
    
    # SQLAlchemy settings
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = False  # Set to True for SQL query logging
    
    # Flask settings
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    DEBUG = os.getenv('DEBUG', 'True') == 'True'
    
    @staticmethod
    def get_database_url():
        """Get the database URL"""
        return Config.SQLALCHEMY_DATABASE_URI