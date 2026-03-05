# AeroVision Delhi — AI-Powered Air Quality Forecasting for Delhi

> Hourly predictions for ground-level O₃ and NO₂ across 7 monitoring sites in Delhi
> using XGBoost ML models, real-time weather integration, and Firebase push notifications.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technology Choices & Justification](#technology-choices--justification)
4. [Project Structure](#project-structure)
5. [Prerequisites](#prerequisites)
6. [Environment Setup](#environment-setup)
7. [Backend Setup](#backend-setup)
8. [Frontend Setup](#frontend-setup)
9. [ML Model Training](#ml-model-training)
10. [Running the Data Collection Service](#running-the-data-collection-service)
11. [API Documentation](#api-documentation)
12. [Running Tests](#running-tests)
13. [Known Limitations & Future Work](#known-limitations--future-work)
14. [Data Sources](#data-sources)

---

## Project Overview

AirQ Forecast is an end-to-end air quality forecasting system built for Delhi, India.
It addresses the critical public health challenge of NO₂ and ground-level O₃ frequently
exceeding WHO safety thresholds in one of the world's most polluted megacities.

**Key capabilities:**
- 24–48 hour hourly forecasts for O₃ and NO₂ at 7 monitoring sites
- Real-time AQI dashboard with live data from WAQI / Open-Meteo APIs
- Seasonal pattern analysis using 5 years of historical data
- Interactive hotspot detection map with heatmap overlay
- Firebase Cloud Messaging push notifications (works when browser tab is closed)
- Health risk analysis and personalised daily tips

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend                           │
│  Dashboard │ Forecast │ Seasonal │ Weather │ Hotspots │ Alerts  │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP (REST API)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Flask REST API (app.py)                     │
│                                                                 │
│  /api/current    /api/forecast    /api/weather                  │
│  /api/historical /api/monthly-averages /api/sites               │
│  /api/notifications/register|preferences|unregister             │
└──────────┬──────────────────┬──────────────────┬───────────────-┘
           │                  │                  │
           ▼                  ▼                  ▼
┌──────────────────┐ ┌───────────────┐ ┌────────────────────────┐
│   PostgreSQL DB  │ │  ML Models    │ │  External APIs         │
│                  │ │  (XGBoost)    │ │                        │
│ AirQualityData   │ │  models/*.pkl │ │  WAQI (primary AQI)    │
│ MonitoringSite   │ │               │ │  Open-Meteo (fallback) │
│ Prediction       │ │  prediction_  │ │  OpenWeatherMap        │
│ UserToken        │ │  service.py   │ │  (fallback)            │
│ NotificationLog  │ └───────────────┘ └────────────────────────┘
└──────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│          data_collection_service.py  (runs separately)          │
│  - Rolling 72h backfill from Open-Meteo                         │
│  - Hourly live collection (runs every hour via schedule)        │
│  - Triggers forecast generation after each collection           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│          FCM Alert Scheduler  (APScheduler in app.py)           │
│  - Runs every 5 minutes                                         │
│  - Fetches live AQI for all 7 sites                             │
│  - Sends Firebase push notifications on threshold breach        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Choices & Justification

| Component | Technology | Why |
|-----------|-----------|-----|
| ML Model | **XGBoost** | Better than LSTM for tabular data with lag features; faster inference; more interpretable; less data required for good performance |
| Backend | **Flask** | Lightweight microservice framework; no ORM overhead of Django; clean REST API design |
| Database | **PostgreSQL** | Production-ready; supports `ARRAY` type for `monitored_sites`; concurrent connections; better than SQLite for multi-user |
| Frontend | **React** | Component ecosystem; Recharts and Leaflet libraries integrate cleanly |
| Charts | **Recharts** | Purpose-built for React; responsive; supports AreaChart, BarChart, LineChart out of the box |
| Map | **React-Leaflet + leaflet.heat** | Free, open-source; heatmap plugin; no API key needed |
| Push Notifications | **Firebase FCM** | Works when browser tab is closed; free tier sufficient; real-time delivery |
| Scheduling | **APScheduler** | Lightweight in-process scheduler; avoids needing separate Celery/Redis infrastructure |
| ORM | **SQLAlchemy** | Prevents SQL injection; type-safe queries; database-agnostic |

---

## Project Structure

```
airq-forecast/
│
├── frontend/                    # React application
│   ├── public/
│   │   └── firebase-messaging-sw.js   # FCM background message handler
│   ├── src/
│   │   ├── components/
│   │   │   ├── HomePage.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── ForecastPage.jsx
│   │   │   ├── SeasonalPatterns.jsx
│   │   │   ├── WeatherInsights.jsx
│   │   │   ├── HotspotDetection.jsx
│   │   │   ├── AlertSystem.jsx
│   │   │   ├── DailyTips.jsx
│   │   │   └── AboutPage.jsx
│   │   ├── hooks/
│   │   │   └── useFCM.js             # Firebase Cloud Messaging hook
│   │   ├── utils/
│   │   │   └── aqiHelpers.js         # Shared AQI utility functions
│   │   ├── config.js                 # API base URL and shared config
│   │   ├── firebase-config.js        # Firebase app initialisation
│   │   ├── App.js
│   │   └── App.css
│   ├── .env                          # Frontend environment variables (not in git)
│   └── package.json
│
├── backend/                     # Flask API
│   ├── app.py                   # Main Flask application & API routes
│   ├── models.py                # SQLAlchemy database models
│   ├── config.py                # Database and app configuration
│   ├── validators.py            # Input validation helpers
│   ├── prediction_service.py    # XGBoost hybrid forecast service
│   ├── data_collection_service.py  # Hourly data ingestion (run separately)
│   ├── data_loader.py           # One-time CSV historical data loader
│   ├── fcm_service.py           # Firebase push notification service
│   ├── preprocessor.py          # Data preprocessing utilities
│   ├── models/                  # Trained XGBoost model files
│   │   ├── model_O3_1h.pkl
│   │   ├── model_O3_2h.pkl
│   │   │   ... (up to 48h)
│   │   ├── model_NO2_1h.pkl
│   │   │   ... (up to 48h)
│   │   └── scaler_X.pkl
│   ├── data/                    # Historical CSV files (not in git)
│   │   ├── site_1_train_data.csv
│   │   └── ...
│   ├── tests/
│   │   └── test_aqi_calculations.py
│   ├── firebase-service-account.json  # Firebase Admin SDK (NOT in git)
│   ├── .env                           # Backend secrets (NOT in git)
│   └── requirements.txt
│
└── README.md
```

---

## Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- A Firebase project (for push notifications)

---

## Environment Setup

### Backend `.env` file
Create `backend/.env`:
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=air_quality_db
DB_USER=airq_user
DB_PASSWORD=your_secure_password_here

# External APIs
WAQI_API_KEY=your_waqi_token_here
OWM_API_KEY=your_openweathermap_key_here

# Flask
SECRET_KEY=your_flask_secret_key_here
DEBUG=True

# Firebase
FIREBASE_SERVICE_ACCOUNT_PATH=firebase-service-account.json
```

### Frontend `.env` file
Create `frontend/.env`:
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_VAPID_KEY=your_vapid_key_here
```

---

## Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate       # Linux/Mac
venv\Scripts\activate          # Windows

# Install dependencies
pip install -r requirements.txt

# Set up PostgreSQL database
psql -U postgres -c "CREATE DATABASE air_quality_db;"
psql -U postgres -c "CREATE USER airq_user WITH PASSWORD 'your_password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE air_quality_db TO airq_user;"

# Initialise database tables and monitoring sites
python models.py

# Load historical CSV data (place CSV files in backend/data/ first)
python data_loader.py

# Start the Flask API
python app.py
```

API will be available at `http://localhost:5000`

---

## Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

Frontend will be available at `http://localhost:3000`

---

## ML Model Training

Models are trained in Google Colab using `hybrid_model_training.ipynb`.

1. Upload all 7 site CSV files to Colab
2. Run all cells — training takes approximately 15-20 minutes
3. Download `hybrid_models.zip`
4. Extract and place all `.pkl` files into `backend/models/`

**Model Performance (test set, 2024 data):**

| Horizon | O₃ R² | O₃ MAE | NO₂ R² | NO₂ MAE |
|---------|--------|--------|---------|---------|
| 1 hour  | 0.882  | 9.75   | 0.718   | 10.77   |
| 6 hour  | 0.759  | 14.50  | 0.695   | 15.38   |
| 12 hour | 0.738  | 15.08  | 0.662   | 15.85   |
| 24 hour | 0.742  | 14.91  | 0.638   | 16.12   |
| 48 hour | 0.697  | 16.21  | 0.681   | 16.90   |

---

## Running the Data Collection Service

This service runs **separately** from the Flask API. It collects live hourly data
from Open-Meteo and generates fresh forecasts every hour.

```bash
cd backend
python data_collection_service.py
```

It will:
1. Backfill the last 72 hours of missing data on startup
2. Collect the current hour's data immediately
3. Generate 48-hour forecasts for all 7 sites
4. Repeat every hour automatically

---

## API Documentation

### Sites
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sites` | List all 7 monitoring sites |
| GET | `/api/sites/<site_number>` | Site details + statistics |

### Air Quality Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/current/<site_number>` | Live AQI + current O₃/NO₂ + weather |
| GET | `/api/historical/<site_number>?days=7` | Historical data (default 30 days) |
| GET | `/api/forecast/<site_number>?hours=24` | ML forecast (24 or 48 hours) |
| GET | `/api/monthly-averages/<site_number>?years=5` | Monthly averages |
| GET | `/api/weather/<site_number>` | Extended weather with AQI impact analysis |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/notifications/register` | Register FCM token + preferences |
| PUT | `/api/notifications/preferences` | Update alert preferences |
| POST | `/api/notifications/unregister` | Remove FCM token |

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/cache-status` | View in-memory AQI cache |


---

## Running Tests

```bash
cd backend
pytest tests/ -v
```

Test coverage includes:
- AQI calculation boundary values
- AQI category label correctness
- Input validation (site numbers, forecast hours, FCM registration)
- FCM cooldown logic

---

## Known Limitations & Future Work

| Limitation | Details |
|------------|---------|
| No API authentication | All endpoints are publicly accessible. API key auth is planned. |
| Simplified AQI formula | `calculate_aqi()` uses a simplified EPA formula, not the full standard |
| Recursive forecast degradation | Hours not in direct horizons (e.g. 7h, 8h) use 1h recursive model — accuracy degrades |
| Live data gap | Open-Meteo provides reanalysis values, not true ground-level measurements |
| No rate limiting | API endpoints have no rate limiting — vulnerable to abuse |

**Planned improvements:**
- API key authentication for all routes
- Rate limiting via Flask-Limiter
- Model retraining pipeline (auto-retrain monthly)
- Mobile app (React Native)

---

## Data Sources

| Source | Usage | License |
|--------|-------|---------|
| [WAQI](https://aqicn.org/api/) | Live AQI (primary) | Free for non-commercial |
| [Open-Meteo](https://open-meteo.com/) | Weather + AQI fallback | Open-source, free |
| [OpenWeatherMap](https://openweathermap.org/) | AQI second fallback | Free tier |
| Historical CSV data | 5-year training dataset | Internal / SIH 2025 |
