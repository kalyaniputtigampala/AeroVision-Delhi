from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime, timedelta
from models import init_db, get_session, AirQualityData, MonitoringSite, Prediction, UserToken, NotificationLog
from sqlalchemy import func, and_
import traceback
import os
from dotenv import load_dotenv
load_dotenv()
from fcm_service import FCMService
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
import atexit
import numpy as np
from validators import validate_site_number, validate_forecast_hours, validate_fcm_registration
import json
import os
import threading

# Write Firebase service account from environment variable (for Render deployment)
firebase_json = os.getenv('FIREBASE_SERVICE_ACCOUNT_JSON')
if firebase_json:
    with open('firebase-service-account.json', 'w') as f:
        f.write(firebase_json)

_aqi_cache = {}

# Import hybrid prediction service if available
try:
    from prediction_service import HybridPredictionService
    PREDICTION_SERVICE_AVAILABLE = True
    prediction_service = HybridPredictionService()
    print("✓ Hybrid Prediction Service (LSTM + XGBoost) loaded successfully")
except Exception as e:
    PREDICTION_SERVICE_AVAILABLE = False
    prediction_service = None
    print(f"⚠ Hybrid prediction service not available: {e}")
    print("  Using mock predictions. Train models to enable real forecasts.")

app = Flask(__name__)
CORS(app)

# Initialize database
engine = init_db()


# IMPORTANT: Create session per request to avoid concurrent operation issues
def get_db_session():
    """Get a new session for each request"""
    return get_session(engine)

# Test route
@app.route('/')
def home():
    return jsonify({
        "message": "Air Quality Forecast API - Hybrid ML System",
        "status": "running",
        "timestamp": datetime.now().isoformat(),
        "version": "2.1",
        "ml_models": {
            "available": PREDICTION_SERVICE_AVAILABLE,
            "o3_model": "XGBoost",
            "no2_model": "XGBoost (200 estimators)"
        }
    })
# Get all monitoring sites
@app.route('/api/sites', methods=['GET'])
def get_sites():
    session = get_db_session()
    try:
        sites = session.query(MonitoringSite).all()
        return jsonify({
            'sites': [site.to_dict() for site in sites],
            'total_sites': len(sites)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()

# Get site details
@app.route('/api/sites/<int:site_number>', methods=['GET'])
def get_site_details(site_number):
    session = get_db_session()
    try:
        site = session.query(MonitoringSite).filter(
            MonitoringSite.site_number == site_number
        ).first()
        
        if not site:
            return jsonify({'error': 'Site not found'}), 404
        
        # Get data statistics for this site
        total_records = session.query(func.count(AirQualityData.id)).filter(
            AirQualityData.site_number == site_number
        ).scalar()
        
        min_date = session.query(func.min(AirQualityData.timestamp)).filter(
            AirQualityData.site_number == site_number
        ).scalar()
        
        max_date = session.query(func.max(AirQualityData.timestamp)).filter(
            AirQualityData.site_number == site_number
        ).scalar()
        
        # Get latest reading
        latest = session.query(AirQualityData).filter(
            AirQualityData.site_number == site_number
        ).order_by(AirQualityData.timestamp.desc()).first()
        
        # Get model info if available
        model_info = None
        if PREDICTION_SERVICE_AVAILABLE and prediction_service:
            try:
                model_info = prediction_service.get_model_info(site_number)
            except:
                pass
        
        return jsonify({
            'site': site.to_dict(),
            'statistics': {
                'total_records': total_records,
                'date_range': {
                    'start': min_date.isoformat() if min_date else None,
                    'end': max_date.isoformat() if max_date else None
                },
                'latest_reading': latest.to_dict() if latest else None
            },
            'model_info': model_info
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()
def run_data_collection():
    """Run data collection service in background thread."""
    import time
    try:
        from data_collection_service import run_once, schedule_collection
        print("Starting data collection service in background...")
        run_once()  # Run immediately on startup
        schedule_collection()  # Then run hourly
    except Exception as e:
        print(f"Data collection service error: {e}")
@app.route('/api/current/<int:site_number>', methods=['GET'])
def get_current_aqi(site_number):
    valid, err = validate_site_number(site_number)
    if not valid:
        return err
    session = get_db_session()
    try:
        # 1️⃣ Fetch latest DB row
        latest = session.query(AirQualityData).filter(
            AirQualityData.site_number == site_number
        ).order_by(AirQualityData.timestamp.desc()).first()

        if not latest:
            return jsonify({'error': 'No data available'}), 404

        # 2️⃣ Fetch LIVE AQI only from WAQI
        live_aqi = fetch_live_aqi(site_number)

        if not live_aqi:
            return jsonify({'error': 'Live AQI unavailable'}), 503

        # 3️⃣ AQI category
        category, color = get_aqi_category(live_aqi["aqi"])
        # Convert units to match Weather Insights page
        temp_k = float(latest.T_forecast) if latest.T_forecast else None
        temp_c = round(temp_k - 273.15, 1) if temp_k else None

        humidity_dec = float(latest.q_forecast) if latest.q_forecast else None
        humidity_pct = round(humidity_dec * 100, 1) if humidity_dec else None

        wind_u_raw = float(latest.u_forecast) if latest.u_forecast else None
        wind_v_raw = float(latest.v_forecast) if latest.v_forecast else None

        # Wind speed magnitude (always positive)
        wind_speed = None
        if wind_u_raw is not None and wind_v_raw is not None:
            import math
            wind_speed = round(math.sqrt(wind_u_raw**2 + wind_v_raw**2), 1)

        # 4️⃣ MERGED RESPONSE
        return jsonify({
            "site_number": site_number,
            "timestamp": live_aqi["time"],   # WAQI timestamp
            "aqi": live_aqi["aqi"],           # WAQI AQI
            "category": category,
            "color": color,

            # ✅ O3 & NO2 FROM DATABASE
            "pollutants": {
                "O3": float(latest.O3_target) if latest.O3_target is not None else None,
                "NO2": float(latest.NO2_target) if latest.NO2_target is not None else None,

                # optional (still from WAQI if you want)
                "PM2.5": live_aqi["pollutants"]["pm25"],
                "PM10": live_aqi["pollutants"]["pm10"]
            },

            # Weather fully from DB
            "weather": {
                "temperature": temp_c,        # Now in °C
                "humidity": humidity_pct,     # Now in % (e.g. 65.0)
                "wind_speed": wind_speed,     # Magnitude in m/s
                "wind_u": wind_u_raw,
                "wind_v": wind_v_raw,
                "wind_w": float(latest.w_forecast) if latest.w_forecast else None
                },

            "source": "WAQI AQI + DB gases"
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()


# Get historical data for a site
@app.route('/api/historical/<int:site_number>', methods=['GET'])
def get_historical(site_number):
    session = get_db_session()
    try:
        # Get query parameters
        days = int(request.args.get('days', 30))
        limit = int(request.args.get('limit', 1000))
        
        # Get the latest date in database for this site
        max_date = session.query(func.max(AirQualityData.timestamp)).filter(
            AirQualityData.site_number == site_number
        ).scalar()
        
        if not max_date:
            return jsonify({'error': 'No data available for this site'}), 404
        
        # Calculate date range based on actual data
        end_date = max_date
        start_date = max_date - timedelta(days=days)
        
        # Query data
        data = session.query(AirQualityData).filter(
            and_(
                AirQualityData.site_number == site_number,
                AirQualityData.timestamp >= start_date,
                AirQualityData.timestamp <= end_date
            )
        ).order_by(AirQualityData.timestamp).limit(limit).all()
        
        if not data:
            return jsonify({'error': 'No historical data available in this range'}), 404
        
        # Format response with enhanced data
        formatted_data = []
        for record in data:
            record_dict = record.to_dict()
            # Add AQI calculation
            if record.O3_target and record.NO2_target:
                record_dict['aqi'] = calculate_aqi(record.O3_target, record.NO2_target)
                record_dict['aqi_category'], record_dict['aqi_color'] = get_aqi_category(record_dict['aqi'])
            formatted_data.append(record_dict)
        
        return jsonify({
            'site_number': site_number,
            'date_range': {
                'start': start_date.isoformat(),
                'end': end_date.isoformat()
            },
            'total_records': len(formatted_data),
            'data': formatted_data
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()

# Get monthly averages for a site
@app.route('/api/monthly-averages/<int:site_number>', methods=['GET'])
def get_monthly_averages(site_number):
    session = get_db_session()
    try:
        years = int(request.args.get('years', 5))
        
        # Query and group by year and month
        results = session.query(
            AirQualityData.year,
            AirQualityData.month,
            func.avg(AirQualityData.O3_target).label('avg_O3'),
            func.avg(AirQualityData.NO2_target).label('avg_NO2'),
            func.max(AirQualityData.O3_target).label('max_O3'),
            func.max(AirQualityData.NO2_target).label('max_NO2'),
            func.min(AirQualityData.O3_target).label('min_O3'),
            func.min(AirQualityData.NO2_target).label('min_NO2'),
            func.count(AirQualityData.id).label('count')
        ).filter(
            AirQualityData.site_number == site_number
        ).group_by(
            AirQualityData.year,
            AirQualityData.month
        ).order_by(
            AirQualityData.year.desc(),
            AirQualityData.month.desc()
        ).limit(years * 12).all()
        
        # Format data
        monthly_data = []
        for result in results:
            avg_aqi = calculate_aqi(result.avg_O3, result.avg_NO2) if result.avg_O3 and result.avg_NO2 else None
            category, color = get_aqi_category(avg_aqi) if avg_aqi else (None, None)
            
            monthly_data.append({
                'year': result.year,
                'month': result.month,
                'avg_O3': round(result.avg_O3, 2) if result.avg_O3 else None,
                'avg_NO2': round(result.avg_NO2, 2) if result.avg_NO2 else None,
                'max_O3': round(result.max_O3, 2) if result.max_O3 else None,
                'max_NO2': round(result.max_NO2, 2) if result.max_NO2 else None,
                'min_O3': round(result.min_O3, 2) if result.min_O3 else None,
                'min_NO2': round(result.min_NO2, 2) if result.min_NO2 else None,
                'avg_aqi': avg_aqi,
                'aqi_category': category,
                'aqi_color': color,
                'record_count': result.count
            })
        
        return jsonify({
            'site_number': site_number,
            'monthly_averages': monthly_data,
            'total_months': len(monthly_data)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()
@app.route('/api/forecast/<int:site_number>', methods=['GET'])
def get_forecast(site_number):
    valid, err = validate_site_number(site_number)
    if not valid:
        return err
    hours = int(request.args.get("hours", 24))

    # Cap to 48
    if hours > 48:
        hours = 48
    if hours < 1:
        hours = 1

    session = get_db_session()

    latest_origin_row = session.query(Prediction.forecast_origin)\
        .filter(Prediction.site_number == site_number)\
        .order_by(Prediction.forecast_origin.desc())\
        .first()

    if not latest_origin_row:
        session.close()
        return jsonify({"success": False, "message": "No forecast"}), 404

    latest_origin = latest_origin_row[0]

    forecasts = session.query(Prediction)\
        .filter(
            Prediction.site_number == site_number,
            Prediction.forecast_origin == latest_origin
        )\
        .order_by(Prediction.horizon.asc())\
        .limit(hours)\
        .all()

    forecast_list = [{
        "timestamp": f.timestamp.isoformat(),
        "horizon": f.horizon,
        "O3_predicted": float(f.O3_predicted),
        "NO2_predicted": float(f.NO2_predicted),
        "model_version": f.model_version
    } for f in forecasts]

    session.close()

    return jsonify({
        "success": True,
        "site_number": site_number,
        "forecast_origin": latest_origin.isoformat(),
        "hours": hours,
        "forecast": forecast_list
    })


# Get model information for a site
@app.route('/api/model-info/<int:site_number>', methods=['GET'])
def get_model_info(site_number):
    try:
        if not PREDICTION_SERVICE_AVAILABLE or not prediction_service:
            return jsonify({
                'site_number': site_number,
                'available': False,
                'message': 'Prediction service not available'
            }), 404
        
        info = prediction_service.get_model_info(site_number)
        return jsonify({
            'site_number': site_number,
            **info
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
@app.route("/api/evaluate/<int:site_number>")
def evaluate(site_number):

    session = get_db_session()

    from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
    import numpy as np
    from datetime import datetime, timedelta
    from sqlalchemy import and_

    evaluation = {}

    now = datetime.now()  # Use consistent timezone
    evaluation_window_days = 3
    cutoff = now - timedelta(days=evaluation_window_days)

    for h in [1, 6, 12, 24]:

        # Evaluate only:
        # 1️⃣ Correct horizon alignment
        # 2️⃣ Only timestamps that already passed
        # 3️⃣ Only recent evaluation window

        results = session.query(Prediction, AirQualityData).join(
            AirQualityData,
            and_(
                Prediction.site_number == AirQualityData.site_number,
                Prediction.timestamp == AirQualityData.timestamp
            )
        ).filter(
            Prediction.site_number == site_number,
            Prediction.horizon == h,
            Prediction.timestamp <= now,
            Prediction.timestamp >= cutoff
        ).all()

        if not results:
            continue

        # ===================== O3 =====================
        o3_actual = [row.AirQualityData.O3_target for row in results]
        o3_pred = [row.Prediction.O3_predicted for row in results]

        o3_mae = mean_absolute_error(o3_actual, o3_pred)
        o3_rmse = np.sqrt(mean_squared_error(o3_actual, o3_pred))

        if len(o3_actual) > 1 and np.var(o3_actual) > 0:
            o3_r2 = r2_score(o3_actual, o3_pred)
            if np.isnan(o3_r2):
                o3_r2 = None
        else:
            o3_r2 = None

        evaluation[f"{h}_hour_O3"] = {
            "samples": len(o3_actual),
            "MAE": round(o3_mae, 2),
            "RMSE": round(o3_rmse, 2),
            "R2": round(o3_r2, 3) if o3_r2 is not None else None
        }

        # ===================== NO2 =====================
        no2_actual = [row.AirQualityData.NO2_target for row in results]
        no2_pred = [row.Prediction.NO2_predicted for row in results]

        no2_mae = mean_absolute_error(no2_actual, no2_pred)
        no2_rmse = np.sqrt(mean_squared_error(no2_actual, no2_pred))

        if len(no2_actual) > 1 and np.var(no2_actual) > 0:
            no2_r2 = r2_score(no2_actual, no2_pred)
            if np.isnan(no2_r2):
                no2_r2 = None
        else:
            no2_r2 = None

        evaluation[f"{h}_hour_NO2"] = {
            "samples": len(no2_actual),
            "MAE": round(no2_mae, 2),
            "RMSE": round(no2_rmse, 2),
            "R2": round(no2_r2, 3) if no2_r2 is not None else None
        }

    session.close()

    if not evaluation:
        return jsonify({"message": "No past predictions available yet."})

    return jsonify(evaluation)

# Get all model metrics
@app.route('/api/model-metrics', methods=['GET'])
def get_all_model_metrics():
    try:
        import json
        all_metrics_path = 'models/all_sites_metrics.json'
        
        if not os.path.exists(all_metrics_path):
            return jsonify({
                'error': 'No models trained yet',
                'models_available': False,
                'message': 'Train models for all sites to generate comprehensive metrics'
            }), 404
        
        with open(all_metrics_path, 'r') as f:
            all_metrics = json.load(f)
        
        return jsonify({
            'all_metrics': all_metrics,
            'models_available': True,
            'total_sites': len(all_metrics),
            'generated_at': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    session = get_db_session()
    try:
        # Check database connection
        db_ok = session.query(func.count(AirQualityData.id)).scalar() is not None
        
        # Check if models are loaded
        models_loaded = 0
        if PREDICTION_SERVICE_AVAILABLE and prediction_service:
            models_loaded = len(prediction_service.models)
        
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'database': 'connected' if db_ok else 'error',
            'prediction_service': 'available' if PREDICTION_SERVICE_AVAILABLE else 'unavailable',
            'models_loaded': models_loaded,
            'version': '2.1'
        })
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 500
    finally:
        session.close()

# Helper functions
def calculate_aqi(o3, no2):
    """
    Calculate simplified AQI from O3 and NO2 values
    Based on EPA breakpoints (simplified version)
    """
    if o3 is None or no2 is None:
        return 0
    
    # O3 AQI calculation (8-hour average, in μg/m³)
    # Convert to ppb first: μg/m³ * 0.5 = ppb (approximate)
    o3_ppb = o3 * 0.5
    
    if o3_ppb <= 54:
        o3_aqi = (50 / 54) * o3_ppb
    elif o3_ppb <= 70:
        o3_aqi = 50 + ((100 - 50) / (70 - 54)) * (o3_ppb - 54)
    elif o3_ppb <= 85:
        o3_aqi = 100 + ((150 - 100) / (85 - 70)) * (o3_ppb - 70)
    elif o3_ppb <= 105:
        o3_aqi = 150 + ((200 - 150) / (105 - 85)) * (o3_ppb - 85)
    elif o3_ppb <= 200:
        o3_aqi = 200 + ((300 - 200) / (200 - 105)) * (o3_ppb - 105)
    else:
        o3_aqi = 300 + ((500 - 300) / (604 - 200)) * (o3_ppb - 200)
    
    # NO2 AQI calculation (in μg/m³)
    if no2 <= 53:
        no2_aqi = (50 / 53) * no2
    elif no2 <= 100:
        no2_aqi = 50 + ((100 - 50) / (100 - 53)) * (no2 - 53)
    elif no2 <= 360:
        no2_aqi = 100 + ((150 - 100) / (360 - 100)) * (no2 - 100)
    elif no2 <= 649:
        no2_aqi = 150 + ((200 - 150) / (649 - 360)) * (no2 - 360)
    elif no2 <= 1249:
        no2_aqi = 200 + ((300 - 200) / (1249 - 649)) * (no2 - 649)
    else:
        no2_aqi = 300 + ((500 - 300) / (2049 - 1249)) * (no2 - 1249)
    
    # Return the maximum AQI (worst pollutant)
    aqi = max(o3_aqi, no2_aqi)
    return min(int(aqi), 500)  # Cap at 500

def get_aqi_category(aqi):
    """Get AQI category and color based on EPA standards"""
    if aqi is None:
        return "Unknown", "#808080"
    
    if aqi <= 50:
        return "Good", "#00E400"
    elif aqi <= 100:
        return "Moderate", "#FFFF00"
    elif aqi <= 150:
        return "Unhealthy for Sensitive Groups", "#FF7E00"
    elif aqi <= 200:
        return "Unhealthy", "#FF0000"
    elif aqi <= 300:
        return "Very Unhealthy", "#8F3F97"
    else:
        return "Hazardous", "#7E0023"

def generate_mock_forecast(site_number, hours):
    """Generate statistical mock forecast when ML models unavailable"""
    session = get_db_session()
    try:
        # Get recent averages from database
        recent = session.query(AirQualityData).filter(
            AirQualityData.site_number == site_number,
            AirQualityData.O3_target.isnot(None),
            AirQualityData.NO2_target.isnot(None)
        ).order_by(
            AirQualityData.timestamp.desc()
        ).limit(168).all()  # Last week
        
        if not recent:
            avg_o3, avg_no2 = 55.0, 40.0
        else:
            avg_o3 = sum(r.O3_target for r in recent) / len(recent)
            avg_no2 = sum(r.NO2_target for r in recent) / len(recent)
    finally:
        session.close()
    
    predictions = []
    current_time = datetime.now()
    
    for i in range(hours):
        forecast_time = current_time + timedelta(hours=i+1)
        
        # Add diurnal variation
        hour = forecast_time.hour
        diurnal_factor = 1.0 + 0.3 * np.sin((hour - 6) * np.pi / 12)
        
        o3_pred = avg_o3 * diurnal_factor + np.random.normal(0, 5)
        no2_pred = avg_no2 * (2 - diurnal_factor) + np.random.normal(0, 3)
    
        aqi = calculate_aqi(o3_pred, no2_pred)
        category, color = get_aqi_category(aqi)
        
        predictions.append({
            'timestamp': forecast_time.isoformat(),
            'hour': hour,
            'O3_predicted': float(max(0, o3_pred)),
            'NO2_predicted': float(max(0, no2_pred)),
            'aqi': aqi,
            'aqi_category': category,
            'aqi_color': color,
            'confidence': 0.5,
            'model_o3': 'Statistical',
            'model_no2': 'Statistical'
        })
    
    return predictions

import os
import requests

# Map site_number → WAQI geo query
WAQI_SITES = {
    1: "geo:28.69536;77.18168",
    2: "geo:28.57180;77.07125",
    3: "geo:28.58278;77.23441",
    4: "geo:28.82286;77.10197",
    5: "geo:28.53077;77.27123",
    6: "geo:28.72954;77.09601",
    7: "geo:28.71052;77.24951",
}

# Lat/lon coordinates for fallback APIs
SITE_COORDS = {
    1: (28.69536, 77.18168),
    2: (28.57180, 77.07125),
    3: (28.58278, 77.23441),
    4: (28.82286, 77.10197),
    5: (28.53077, 77.27123),
    6: (28.72954, 77.09601),
    7: (28.71052, 77.24951),
}


def fetch_aqi_openmeteo(site_number):
    """Fallback 1: Open-Meteo — free, no API key needed."""
    if site_number not in SITE_COORDS:
        return None

    lat, lon = SITE_COORDS[site_number]
    url = (
        "https://air-quality-api.open-meteo.com/v1/air-quality"
        f"?latitude={lat}&longitude={lon}"
        "&hourly=pm10,pm2_5,ozone,nitrogen_dioxide,european_aqi"
        "&timezone=Asia%2FKolkata"
        "&forecast_days=1"
    )

    try:
        r = requests.get(url, timeout=10)
        data = r.json()

        hourly = data.get("hourly", {})
        times = hourly.get("time", [])
        if not times:
            return None

        # Pick the most recent past hour
        now_str = datetime.now().strftime("%Y-%m-%dT%H:00")
        idx = 0
        for i, t in enumerate(times):
            if t <= now_str:
                idx = i

        eu_aqi = hourly.get("european_aqi", [None])[idx]
        if eu_aqi is None:
            return None

        return {
            "aqi":        int(eu_aqi),
            "pollutants": {
                "o3":   hourly.get("ozone",            [None])[idx],
                "no2":  hourly.get("nitrogen_dioxide", [None])[idx],
                "pm25": hourly.get("pm2_5",            [None])[idx],
                "pm10": hourly.get("pm10",             [None])[idx],
            },
            "time":   times[idx],
            "source": "Open-Meteo"
        }

    except Exception as e:
        print(f"⚠️  Open-Meteo fallback failed for site {site_number}: {e}")
        return None


# OWM AQI is 1–5 scale; map to a comparable 0–500 range
OWM_AQI_MAP = {1: 25, 2: 75, 3: 125, 4: 175, 5: 300}

def fetch_aqi_owm(site_number):
    """Fallback 2: OpenWeatherMap Air Pollution API — free tier, needs OWM_API_KEY."""
    token = os.getenv("OWM_API_KEY")
    if not token or site_number not in SITE_COORDS:
        return None

    lat, lon = SITE_COORDS[site_number]
    url = (
        "http://api.openweathermap.org/data/2.5/air_pollution"
        f"?lat={lat}&lon={lon}&appid={token}"
    )

    try:
        r = requests.get(url, timeout=10)
        data = r.json()

        item = data.get("list", [{}])[0]
        owm_aqi = item.get("main", {}).get("aqi")
        comp    = item.get("components", {})

        if owm_aqi is None:
            return None

        return {
            "aqi":        OWM_AQI_MAP.get(int(owm_aqi), 150),
            "pollutants": {
                "o3":   comp.get("o3"),
                "no2":  comp.get("no2"),
                "pm25": comp.get("pm2_5"),
                "pm10": comp.get("pm10"),
            },
            "time":   datetime.utcfromtimestamp(item["dt"]).isoformat() if "dt" in item else datetime.now().isoformat(),
            "source": "OpenWeatherMap"
        }

    except Exception as e:
        print(f"⚠️  OWM fallback failed for site {site_number}: {e}")
        return None


def fetch_live_aqi(site_number):
    """
    Try AQI sources in order: WAQI → Open-Meteo → OpenWeatherMap
    If all fail, return last cached result with a 'cached' flag.
    Returns: { aqi, pollutants{o3,no2,pm25,pm10}, time, source }  or  None
    """

    # ── 1. WAQI (primary) ────────────────────────────────────────────
    if site_number in WAQI_SITES:
        token = os.getenv("WAQI_API_KEY")
        if token:
            try:
                url  = f"https://api.waqi.info/feed/{WAQI_SITES[site_number]}/?token={token}"
                r    = requests.get(url, timeout=15)
                data = r.json()

                if data.get("status") == "ok":
                    iaqi = data["data"].get("iaqi", {})
                    result = {
                        "aqi":        data["data"]["aqi"],
                        "pollutants": {
                            "o3":   iaqi.get("o3",   {}).get("v"),
                            "no2":  iaqi.get("no2",  {}).get("v"),
                            "pm25": iaqi.get("pm25", {}).get("v"),
                            "pm10": iaqi.get("pm10", {}).get("v"),
                        },
                        "time":   data["data"]["time"]["s"],
                        "source": "WAQI",
                        "from_cache": False
                    }
                    _aqi_cache[site_number] = {
                        **result,
                        "cached_at": datetime.now().isoformat()
                    }
                    print(f"✓ WAQI OK for site {site_number}")
                    return result
                else:
                    print(f"⚠️  WAQI failed for site {site_number}: {data.get('data')} — trying fallbacks")

            except Exception as e:
                print(f"⚠️  WAQI exception for site {site_number}: {e} — trying fallbacks")

    # ── 2. Open-Meteo (free, no key needed) ──────────────────────────
    result = fetch_aqi_openmeteo(site_number)
    if result:
        result["from_cache"] = False
        _aqi_cache[site_number] = {
            **result,
            "cached_at": datetime.now().isoformat()
        }
        print(f"✓ Open-Meteo fallback OK for site {site_number}")
        return result

    # ── 3. OpenWeatherMap ─────────────────────────────────────────────
    result = fetch_aqi_owm(site_number)
    if result:
        result["from_cache"] = False
        _aqi_cache[site_number] = {
            **result,
            "cached_at": datetime.now().isoformat()
        }
        print(f"✓ OWM fallback OK for site {site_number}")
        return result

    # ── 4. All APIs failed — return last cached result ────────────────
    if site_number in _aqi_cache:
        cached = _aqi_cache[site_number]
        print(f"⚠️  All APIs failed for site {site_number} — returning cached data from {cached['cached_at']}")
        return {
            **cached,
            "from_cache": True,
            "source": f"Cache (last live: {cached['source']} @ {cached['cached_at']})"
        }

    print(f"❌ All AQI sources failed for site {site_number} and no cache available")
    return None
@app.route('/api/cache-status', methods=['GET'])
def cache_status():
    """Check what's currently stored in the AQI in-memory cache"""
    if not _aqi_cache:
        return jsonify({
            "cache_empty": True,
            "message": "No data cached yet — cache fills on first successful API fetch",
            "sites_cached": 0
        })

    return jsonify({
        "cache_empty": False,
        "sites_cached": len(_aqi_cache),
        "cache": {
            str(site): {
                "aqi": data.get("aqi"),
                "source": data.get("source"),
                "cached_at": data.get("cached_at"),
                "from_cache": data.get("from_cache", False),
                "pollutants": data.get("pollutants")
            }
            for site, data in _aqi_cache.items()
        }
    })

# Initialize FCM service
fcm_service = None
try:
    fcm_service = FCMService(engine)
except Exception as e:
    print(f"⚠️  FCM service initialization failed: {e}")

# Register FCM token
# Register FCM token
@app.route('/api/notifications/register', methods=['POST'])
def register_token():
    valid, err = validate_site_number(site_number)
    if not valid:
        return err
    session = get_db_session()
    try:
        data = request.json
        print("📥 Registration request received:", data)  # Debug log
        
        fcm_token = data.get('fcm_token')
        
        if not fcm_token:
            return jsonify({'error': 'fcm_token required'}), 400
        
        # Check if token exists
        existing = session.query(UserToken).filter(
            UserToken.fcm_token == fcm_token
        ).first()
        
        if existing:
            # Update preferences
            existing.aqi_threshold = data.get('aqi_threshold', existing.aqi_threshold)
            existing.notify_critical = data.get('notify_critical', existing.notify_critical)
            existing.notify_high = data.get('notify_high', existing.notify_high)
            existing.notify_moderate = data.get('notify_moderate', existing.notify_moderate)
            existing.monitored_sites = data.get('monitored_sites', existing.monitored_sites)
            existing.updated_at = datetime.utcnow()
            session.commit()
            
            print("✓ Token updated:", existing.id)
            return jsonify({
                'success': True,
                'message': 'Token updated',
                'token_id': existing.id
            })
        else:
            # Create new token
            new_token = UserToken(
                fcm_token=fcm_token,
                aqi_threshold=data.get('aqi_threshold', 100),
                notify_critical=data.get('notify_critical', True),
                notify_high=data.get('notify_high', True),
                notify_moderate=data.get('notify_moderate', True),
                monitored_sites=data.get('monitored_sites', [1,2,3,4,5,6,7])
            )
            session.add(new_token)
            session.commit()
            
            print("✓ New token registered:", new_token.id)
            return jsonify({
                'success': True,
                'message': 'Token registered',
                'token_id': new_token.id
            })
    except Exception as e:
        print("❌ Registration error:", str(e))
        import traceback
        traceback.print_exc()  # Print full stack trace
        session.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()
# Update notification preferences
@app.route('/api/notifications/preferences', methods=['PUT'])
def update_preferences():
    session = get_db_session()
    try:
        data = request.json
        fcm_token = data.get('fcm_token')
        
        if not fcm_token:
            return jsonify({'error': 'fcm_token required'}), 400
        
        token_record = session.query(UserToken).filter(
            UserToken.fcm_token == fcm_token
        ).first()
        
        if not token_record:
            return jsonify({'error': 'Token not found'}), 404
        
        # Update fields
        if 'aqi_threshold' in data:
            token_record.aqi_threshold = data['aqi_threshold']
        if 'notify_critical' in data:
            token_record.notify_critical = data['notify_critical']
        if 'notify_high' in data:
            token_record.notify_high = data['notify_high']
        if 'notify_moderate' in data:
            token_record.notify_moderate = data['notify_moderate']
        if 'monitored_sites' in data:
            token_record.monitored_sites = data['monitored_sites']
        
        token_record.updated_at = datetime.utcnow()
        session.commit()
        
        return jsonify({
            'success': True,
            'preferences': token_record.to_dict()
        })
    except Exception as e:
        session.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()

# Unregister token
@app.route('/api/notifications/unregister', methods=['POST'])
def unregister_token():
    session = get_db_session()
    try:
        data = request.json
        fcm_token = data.get('fcm_token')
        
        if not fcm_token:
            return jsonify({'error': 'fcm_token required'}), 400
        
        token_record = session.query(UserToken).filter(
            UserToken.fcm_token == fcm_token
        ).first()
        
        if token_record:
            session.delete(token_record)
            session.commit()
        
        return jsonify({'success': True, 'message': 'Token unregistered'})
    except Exception as e:
        session.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()
@app.route('/api/weather/<int:site_number>', methods=['GET'])
def get_weather(site_number):
    session = get_db_session()
    try:
        # ── Reuse the exact same current data logic as /api/current ──
        latest = session.query(AirQualityData).filter(
            AirQualityData.site_number == site_number
        ).order_by(AirQualityData.timestamp.desc()).first()

        if not latest:
            return jsonify({'error': 'No data found for this site'}), 404

        if site_number not in SITE_COORDS:
            return jsonify({'error': 'Site not found'}), 404

        # ── Get O3 and NO2 the SAME way as /api/current ──
        def get_val(field):
            val = getattr(latest, field, None)
            if val is None:
                return None
            if hasattr(val, 'value'):
                return round(float(val.value), 2)
            return round(float(val), 2)

        o3_val  = get_val('O3_target')
        no2_val = get_val('NO2_target')

        lat, lon = SITE_COORDS[site_number]

        # Fetch extended weather from Open-Meteo
        url = (
            "https://api.open-meteo.com/v1/forecast"
            f"?latitude={lat}&longitude={lon}"
            "&hourly=temperature_2m,relativehumidity_2m,windspeed_10m,"
            "winddirection_10m,surface_pressure,precipitation,"
            "shortwave_radiation,uv_index,boundary_layer_height"
            "&current_weather=true"
            "&timezone=Asia%2FKolkata"
            "&forecast_days=1"
        )

        r = requests.get(url, timeout=10)
        meteo = r.json()

        # Get current hour index
        now_str = datetime.now().strftime("%Y-%m-%dT%H:00")
        hourly = meteo.get("hourly", {})
        times = hourly.get("time", [])
        idx = 0
        for i, t in enumerate(times):
            if t <= now_str:
                idx = i

        def safe_get(key):
            vals = hourly.get(key, [])
            return round(vals[idx], 2) if vals and idx < len(vals) and vals[idx] is not None else None

        # Fetch AQI for current O3/NO2 impact context
        live_aqi = fetch_live_aqi(site_number)
        current_aqi = live_aqi["aqi"] if live_aqi else None

        temp = safe_get("temperature_2m")
        humidity = safe_get("relativehumidity_2m")
        wind_speed = safe_get("windspeed_10m")
        wind_dir = safe_get("winddirection_10m")
        pressure = safe_get("surface_pressure")
        precipitation = safe_get("precipitation")
        solar_rad = safe_get("shortwave_radiation")
        uv_index = safe_get("uv_index")
        boundary_layer = safe_get("boundary_layer_height")

        # Wind U and V from DB
        wind_u = float(latest.u_forecast) if latest and latest.u_forecast else None
        wind_v = float(latest.v_forecast) if latest and latest.v_forecast else None

        return jsonify({
            "site_number": site_number,
            "timestamp": now_str,
            "current_pollutants": {
                "O3": o3_val,
                "NO2": no2_val,
                "AQI": current_aqi
            },
            "weather": {
                "temperature":      {"value": temp,           "unit": "°C"},
                "humidity":         {"value": humidity,        "unit": "%"},
                "wind_speed":       {"value": wind_speed,      "unit": "m/s"},
                "wind_direction":   {"value": wind_dir,        "unit": "°"},
                "pressure":         {"value": pressure,        "unit": "hPa"},
                "precipitation":    {"value": precipitation,   "unit": "mm"},
                "solar_radiation":  {"value": solar_rad,       "unit": "W/m²"},
                "uv_index":         {"value": uv_index,        "unit": ""},
                "boundary_layer":   {"value": boundary_layer,  "unit": "m"},
                "wind_u":           {"value": wind_u,          "unit": "m/s"},
                "wind_v":           {"value": wind_v,          "unit": "m/s"},
            }
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()
# Global scheduler variable
scheduler = None

def init_scheduler():
    """Initialize scheduler only once using file lock"""
    global scheduler, _scheduler_lock_file

    if not fcm_service or not fcm_service.firebase_enabled:
        print("⏭️  FCM service not available, skipping scheduler")
        return

    # Only run in the main Werkzeug process, not the reloader
    if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        print(f"⏭️  Skipping scheduler in reloader process - PID {os.getpid()}")
        return

    # Use a file lock to guarantee only ONE scheduler across all processes
    # Use a socket lock (works on Windows AND Linux)
    import socket
    _lock_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        _lock_socket.bind(('127.0.0.1', 47200))  # Any unused port number
        print(f"✓ Acquired scheduler lock - PID {os.getpid()}")
    except OSError:
        print(f"⏭️  Scheduler already running in another process, skipping - PID {os.getpid()}")
        return

    if scheduler is not None:
        print("⏭️  Scheduler already initialized")
        return

    scheduler = BackgroundScheduler(daemon=True)
    scheduler.start()

    try:
        scheduler.remove_job('fcm_alert_job')
    except:
        pass

    scheduler.add_job(
        func=fcm_service.check_and_send_alerts,
        trigger=IntervalTrigger(minutes=5),
        id='fcm_alert_job',
        name='Check AQI and send FCM alerts',
        replace_existing=True,
        max_instances=1
    )
    print(f"✓ FCM alert scheduler started (every 5 minutes) - PID {os.getpid()}")

    def cleanup():
        if scheduler:
            scheduler.shutdown(wait=False)
        try:
            _lock_socket.close()
            print("✓ Scheduler lock released")
        except:
            pass

    atexit.register(cleanup)

# Initialize scheduler
init_scheduler()
if __name__ == '__main__':
    print("="*70)
    print("  AIR QUALITY FORECAST API")
    print("="*70)
    print(f"  Hybrid ML System: {'✓ Active' if PREDICTION_SERVICE_AVAILABLE else '✗ Inactive'}")
    print(f"  O₃ Model: XGBoost")
    print(f"  NO₂ Model: XGBoost")
    print("="*70)
    collection_thread = threading.Thread(target=run_data_collection, daemon=True)
    collection_thread.start()

    app.run(debug=False,port=5000, host='0.0.0.0')