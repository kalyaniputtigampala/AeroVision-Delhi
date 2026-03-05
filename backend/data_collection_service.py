"""
Data Collection Service (FINAL – Open-Meteo Only)

- Rolling backfill (last 72 hours): Open-Meteo AQ + Weather
- Hourly live collection: Open-Meteo AQ + Weather
- Duplicate-safe
- Temperature in Celsius
"""

import requests
import time
import schedule
from datetime import datetime, timedelta

from models import init_db, get_session, AirQualityData
from prediction_service import HybridPredictionService
from models import Prediction



class DataCollectionService:
    def __init__(self):
        # -------------------------------
        # Database
        # -------------------------------
        self.engine = init_db()
        self.session = get_session(self.engine)
        self.prediction_service = HybridPredictionService()

        # -------------------------------
        # APIs
        # -------------------------------
        self.OPENMETEO_AIR = "https://air-quality-api.open-meteo.com/v1/air-quality"
        self.OPENMETEO_WEATHER = "https://api.open-meteo.com/v1/forecast"

        # -------------------------------
        # Sites
        # -------------------------------
        self.sites = {
            1: {"name": "North Delhi", "lat": 28.69536, "lon": 77.18168},
            2: {"name": "West Delhi", "lat": 28.57180, "lon": 77.07125},
            3: {"name": "South Delhi", "lat": 28.58278, "lon": 77.23441},
            4: {"name": "North-West Delhi", "lat": 28.82286, "lon": 77.10197},
            5: {"name": "South-East Delhi", "lat": 28.53077, "lon": 77.27123},
            6: {"name": "Central Delhi", "lat": 28.72954, "lon": 77.09601},
            7: {"name": "East Delhi", "lat": 28.71052, "lon": 77.24951},
        }

    # ==========================================================
    # OPEN-METEO AIR QUALITY
    # ==========================================================
    def fetch_air_quality(self, site, past_days):
        params = {
            "latitude": site["lat"],
            "longitude": site["lon"],
            "hourly": ["ozone", "nitrogen_dioxide"],
            "past_days": past_days,
            "timezone": "Asia/Kolkata",
        }
        r = requests.get(self.OPENMETEO_AIR, params=params, timeout=30)
        r.raise_for_status()
        return r.json()["hourly"]

    # ==========================================================
    # OPEN-METEO WEATHER
    # ==========================================================
    def fetch_weather(self, site, past_days):
        params = {
            "latitude": site["lat"],
            "longitude": site["lon"],
            "hourly": [
                "temperature_2m",
                "relative_humidity_2m",
                "wind_speed_10m",
            ],
            "past_days": past_days,
            "timezone": "Asia/Kolkata",
        }
        r = requests.get(self.OPENMETEO_WEATHER, params=params, timeout=30)
        r.raise_for_status()
        return r.json()["hourly"]

    # ==========================================================
    # ROLLING BACKFILL (LAST 72 HOURS)
    # ==========================================================
    def rolling_backfill(self):
        end = datetime.now().replace(minute=0, second=0, microsecond=0)
        start = end - timedelta(hours=72)

        print(f"\n🔁 Rolling backfill {start} → {end}")

        for site_number, site in self.sites.items():
            aq = self.fetch_air_quality(site, past_days=3)
            wx = self.fetch_weather(site, past_days=3)
            inserted = 0
            for i, ts in enumerate(aq["time"]):
                ts = datetime.fromisoformat(ts)

                if ts < start or ts > end:
                    continue

                o3 = aq["ozone"][i]
                no2 = aq["nitrogen_dioxide"][i]
                temp_c = wx["temperature_2m"][i]
                temp = temp_c +273.15
                rh = wx["relative_humidity_2m"][i]
                ws = wx["wind_speed_10m"][i]

                if None in (o3, no2, temp, rh, ws):
                    continue

                exists = self.session.query(AirQualityData).filter_by(
                    site_number=site_number,
                    timestamp=ts
                ).first()

                if exists:
                    continue

                rec = AirQualityData(
                    site_number=site_number,
                    timestamp=ts,
                    year=ts.year,
                    month=ts.month,
                    day=ts.day,
                    hour=ts.hour,

                    O3_forecast=o3,
                    NO2_forecast=no2,
                    T_forecast=temp,          # Celsius
                    q_forecast=rh / 100.0,
                    u_forecast=-ws,
                    v_forecast=-ws,
                    w_forecast=0.0,

                    O3_target=o3,
                    NO2_target=no2,
                    is_training=1
                )

                self.session.add(rec)
                inserted += 1

            self.session.commit()
            print(f"✓ Site {site_number}: inserted {inserted} rows")
    # ==========================================================
    # FORECAST GENERATION
    # ==========================================================
    def generate_forecast_for_site(self, site_number, hours=48):

        print(f"🔮 Generating {hours}h forecast for Site {site_number}")

        forecast_origin = datetime.now()

        # Keep only last 3 days of predictions
        retention_days = 10
        cutoff = forecast_origin - timedelta(days=retention_days)

        self.session.query(Prediction).filter(
            Prediction.site_number == site_number,
            Prediction.forecast_origin < cutoff
        ).delete()

        forecast_data = self.prediction_service.predict_next_hours(
            site_number, hours
        )

        for pred in forecast_data:

            record = Prediction(
                site_number=site_number,
                forecast_origin=forecast_origin,
                timestamp=datetime.fromisoformat(pred["timestamp"]),
                horizon=pred["horizon"],
                O3_predicted=pred["O3_predicted"],
                NO2_predicted=pred["NO2_predicted"],
                model_version="xgb_direct_1_48_v1"
            )

            self.session.add(record)

        self.session.commit()
        print(f"✓ Stored {hours}h forecast for Site {site_number}")

    # ==========================================================
    # HOURLY LIVE COLLECTION (OPEN-METEO)
    # ==========================================================
    def collect_hourly_data(self):
        now = datetime.now().replace(minute=0, second=0, microsecond=0)
        print(f"\n⏱ Collecting live data @ {now}")

        for site_number, site in self.sites.items():
            exists = self.session.query(AirQualityData).filter_by(
                site_number=site_number,
                timestamp=now
            ).first()

            if exists:
                continue

            aq = self.fetch_air_quality(site, past_days=1)
            wx = self.fetch_weather(site, past_days=1)

            # latest hour (index 0 = current hour)
            o3 = aq["ozone"][0]
            no2 = aq["nitrogen_dioxide"][0]
            temp_c = wx["temperature_2m"][0]
            temp = temp_c +273.15
            rh = wx["relative_humidity_2m"][0]
            ws = wx["wind_speed_10m"][0]

            if None in (o3, no2, temp, rh, ws):
                continue

            rec = AirQualityData(
                site_number=site_number,
                timestamp=now,
                year=now.year,
                month=now.month,
                day=now.day,
                hour=now.hour,

                O3_forecast=o3,
                NO2_forecast=no2,
                T_forecast=temp,
                q_forecast=rh / 100.0,
                u_forecast=-ws,
                v_forecast=-ws,
                w_forecast=0.0,

                O3_target=o3,
                NO2_target=no2,
                is_training=0
            )

            self.session.add(rec)
            self.session.commit()
            print(f"✓ Site {site_number} stored")
        for site_number in self.sites:
            self.generate_forecast_for_site(site_number, hours=48)


    # ==========================================================
    # START SERVICE
    # ==========================================================
    def start(self):
        print("\n🚀 DATA COLLECTION SERVICE STARTED")

        # 1️⃣ Fix gaps
        self.rolling_backfill()

        # 2️⃣ Collect current hour
        self.collect_hourly_data()

        # 3️⃣ Schedule hourly
        schedule.every().hour.at(":00").do(self.collect_hourly_data)

        while True:
            schedule.run_pending()
            time.sleep(60)


# ==========================================================
# RUN
# ==========================================================
if __name__ == "__main__":
    # ── Functions for background thread in app.py ─────────────────────────────────
    _service_instance = None

    def run_once():
        """Run backfill + current hour collection once on startup."""
        global _service_instance
        _service_instance = DataCollectionService()
        _service_instance.rolling_backfill()
        _service_instance.collect_hourly_data()

    def schedule_collection():
        """Schedule hourly collection after run_once() has been called."""
        global _service_instance
        if _service_instance is None:
            _service_instance = DataCollectionService()
        schedule.every().hour.at(":00").do(_service_instance.collect_hourly_data)
        while True:
            schedule.run_pending()
            time.sleep(60)
    service = DataCollectionService()
    try:
        service.start()
    except KeyboardInterrupt:
        print("\n🛑 Service stopped")
