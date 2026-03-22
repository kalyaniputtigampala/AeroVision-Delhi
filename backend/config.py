import os
from dotenv import load_dotenv
from urllib.parse import quote_plus

load_dotenv()

class Config:
    # ── AWS RDS uses a single DATABASE_URL env variable ──
    # If DATABASE_URL is set (production/AWS), use it directly
    # Otherwise build it from parts (local development)
    
    _DATABASE_URL = os.getenv('DATABASE_URL')
    
    if _DATABASE_URL:
        # AWS RDS — use as-is, just ensure correct driver prefix
        SQLALCHEMY_DATABASE_URI = _DATABASE_URL.replace(
            'postgres://', 'postgresql://'
        )
    else:
        # Local development — build from parts
        DB_HOST     = os.getenv('DB_HOST', 'localhost')
        DB_PORT     = os.getenv('DB_PORT', '5432')
        DB_NAME     = os.getenv('DB_NAME', 'air_quality_db')
        DB_USER     = os.getenv('DB_USER', 'airq_user')
        DB_PASSWORD = os.getenv('DB_PASSWORD', 'your_secure_password')
        DB_PASSWORD_ENCODED = quote_plus(DB_PASSWORD)
        SQLALCHEMY_DATABASE_URI = (
            f'postgresql://{DB_USER}:{DB_PASSWORD_ENCODED}'
            f'@{DB_HOST}:{DB_PORT}/{DB_NAME}'
        )

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = False
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    DEBUG = os.getenv('DEBUG', 'False') == 'True'

    @staticmethod
    def get_database_url():
        return Config.SQLALCHEMY_DATABASE_URI