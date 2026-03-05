import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from models import init_db, get_session, AirQualityData
import joblib
import os


class HybridPredictionService:

    def __init__(self):
        self.engine = init_db()
        self.session = get_session(self.engine)

        self.models = {}
        self.scaler = None
        self.available_horizons = []

    # -------------------------------------------------
    # LOAD AVAILABLE MODELS DYNAMICALLY
    # -------------------------------------------------
    def load_models(self):

        if self.models:
            return True

        try:
            model_folder = "models"

            # Detect available horizon files
            files = os.listdir(model_folder)

            o3_files = [f for f in files if f.startswith("model_O3_")]

            for f in o3_files:
                h = int(f.split("_")[2].replace("h.pkl", ""))

                o3_path = os.path.join(model_folder, f)
                no2_path = os.path.join(model_folder, f.replace("O3", "NO2"))

                if os.path.exists(no2_path):

                    self.models[f"O3_{h}"] = joblib.load(o3_path)
                    self.models[f"NO2_{h}"] = joblib.load(no2_path)

                    self.available_horizons.append(h)

            self.available_horizons = sorted(self.available_horizons)

            # Load scaler
            scaler_path = os.path.join(model_folder, "scaler_X.pkl")
            if os.path.exists(scaler_path):
                self.scaler = joblib.load(scaler_path)
            else:
                print("Scaler not found.")
                return False

            print(f"✓ Loaded horizons: {self.available_horizons}")
            return True

        except Exception as e:
            print("Error loading models:", e)
            return False

    # -------------------------------------------------
    # GET LAST 24 HOURS FROM DB
    # -------------------------------------------------
    def get_latest_data(self, site_number):

        records = self.session.query(AirQualityData).filter(
            AirQualityData.site_number == site_number,
            AirQualityData.O3_target.isnot(None),
            AirQualityData.NO2_target.isnot(None)
        ).order_by(
            AirQualityData.timestamp.desc()
        ).limit(24).all()

        if len(records) < 24:
            return None

        records = list(reversed(records))

        df = pd.DataFrame([{
            "site_number": r.site_number,
            "year": r.year,
            "month": r.month,
            "day": r.day,
            "hour": r.hour,
            "O3_forecast": r.O3_forecast,
            "NO2_forecast": r.NO2_forecast,
            "T_forecast": r.T_forecast,
            "q_forecast": r.q_forecast,
            "u_forecast": r.u_forecast,
            "v_forecast": r.v_forecast,
            "w_forecast": r.w_forecast,
            "O3_target": r.O3_target,
            "NO2_target": r.NO2_target,
            "timestamp": r.timestamp
        } for r in records])

        return df

     # -------------------------------------------------
    # BUILD FEATURE VECTOR
    # -------------------------------------------------
    def build_features(self, df):

        last = df.iloc[-1]
        now = last["timestamp"]

        hour_sin = np.sin(2*np.pi*now.hour/24)
        hour_cos = np.cos(2*np.pi*now.hour/24)

        dow = now.weekday()
        dow_sin = np.sin(2*np.pi*dow/7)
        dow_cos = np.cos(2*np.pi*dow/7)

        doy = now.timetuple().tm_yday
        doy_sin = np.sin(2*np.pi*doy/365)
        doy_cos = np.cos(2*np.pi*doy/365)

        o3_hist = df["O3_target"].values
        no2_hist = df["NO2_target"].values

        feature_names = [
            "site_number",
            "hour_sin","hour_cos",
            "dow_sin","dow_cos",
            "doy_sin","doy_cos",
            "O3_forecast","NO2_forecast",
            "T_forecast","q_forecast",
            "u_forecast","v_forecast","w_forecast",
            "O3_lag_1","O3_lag_6","O3_lag_24",
            "NO2_lag_1","NO2_lag_6","NO2_lag_24",
            "O3_roll_24","NO2_roll_24"
        ]

        features = pd.DataFrame([[
            last["site_number"],
            hour_sin, hour_cos,
            dow_sin, dow_cos,
            doy_sin, doy_cos,
            last["O3_forecast"],
            last["NO2_forecast"],
            last["T_forecast"],
            last["q_forecast"],
            last["u_forecast"],
            last["v_forecast"],
            last["w_forecast"],
            o3_hist[-1],
            o3_hist[-6],
            o3_hist[-24],
            no2_hist[-1],
            no2_hist[-6],
            no2_hist[-24],
            np.mean(o3_hist[-24:]),
            np.mean(no2_hist[-24:])
        ]], columns=feature_names)

        return features

        # -------------------------------------------------
    # HYBRID DIRECT + RECURSIVE PREDICTION (FIXED)
    # -------------------------------------------------
    def predict_next_hours(self, site_number, hours=48):

        print(f"\n=== Hybrid forecast for Site {site_number} ===")

        if not self.load_models():
            return self.generate_fallback_predictions(site_number, hours)

        df = self.get_latest_data(site_number)
        if df is None:
            return self.generate_fallback_predictions(site_number, hours)

        if self.scaler is None:
            return self.generate_fallback_predictions(site_number, hours)

        # 🔒 Safety check for minimum history
        if len(df) < 24:
            print("Not enough history for lag features.")
            return self.generate_fallback_predictions(site_number, hours)

        base_time = df["timestamp"].iloc[-1]

        # We keep a growing dataframe for recursive simulation
        working_df = df.copy()

        predictions = {}

        # -------------------------
        # STEP 1: Direct Anchors
        # -------------------------
        for h in self.available_horizons:
            if h <= hours:

                X = self.build_features(working_df)
                X_scaled = self.scaler.transform(X)

                o3_pred = self.models[f"O3_{h}"].predict(X_scaled)[0]
                no2_pred = self.models[f"NO2_{h}"].predict(X_scaled)[0]

                predictions[h] = (o3_pred, no2_pred)

        # -------------------------
        # STEP 2: Recursive Fill
        # -------------------------
        if 1 not in self.available_horizons:
            print("Model_1 required for recursive fill.")
            return self.generate_fallback_predictions(site_number, hours)

        for h in range(1, hours + 1):

            if h in predictions:
                o3_pred, no2_pred = predictions[h]
            else:
                # Use last simulated dataframe state
                X = self.build_features(working_df)
                X_scaled = self.scaler.transform(X)

                o3_pred = self.models["O3_1"].predict(X_scaled)[0]
                no2_pred = self.models["NO2_1"].predict(X_scaled)[0]

                predictions[h] = (o3_pred, no2_pred)

            # -----------------------------------
            # Append synthetic row (NO SHRINKING)
            # -----------------------------------
            future_time = base_time + timedelta(hours=h)

            last_row = working_df.iloc[-1].copy()

            last_row["timestamp"] = future_time
            last_row["year"] = future_time.year
            last_row["month"] = future_time.month
            last_row["day"] = future_time.day
            last_row["hour"] = future_time.hour

            last_row["O3_target"] = o3_pred
            last_row["NO2_target"] = no2_pred

            # Append without removing history
            working_df = pd.concat(
                [working_df, pd.DataFrame([last_row])],
                ignore_index=True
            )

        # -------------------------
        # FORMAT OUTPUT
        # -------------------------
        final_output = []

        for h in range(1, hours + 1):

            o3, no2 = predictions[h]
            future_time = base_time + timedelta(hours=h)

            final_output.append({
                "timestamp": future_time.isoformat(),
                "hour": future_time.hour,
                "horizon": h,
                "O3_predicted": float(max(0, o3)),
                "NO2_predicted": float(max(0, no2)),
                "confidence": max(0.95 - h * 0.01, 0.60),
                "model_type": "Hybrid Direct + Recursive"
            })

        print("✓ Hybrid forecast generated successfully")
        return final_output

    # -------------------------------------------------
    # FALLBACK
    # -------------------------------------------------
    def generate_fallback_predictions(self, site_number, hours=48):

        recent = self.session.query(AirQualityData).filter(
            AirQualityData.site_number == site_number
        ).order_by(
            AirQualityData.timestamp.desc()
        ).limit(168).all()

        if not recent:
            avg_o3, avg_no2 = 55.0, 40.0
        else:
            avg_o3 = np.mean([r.O3_target for r in recent if r.O3_target])
            avg_no2 = np.mean([r.NO2_target for r in recent if r.NO2_target])

        predictions = []
        now = datetime.now()

        for h in range(1, hours + 1):
            future_time = now + timedelta(hours=h)

            predictions.append({
                "timestamp": future_time.isoformat(),
                "hour": future_time.hour,
                "horizon": h,
                "O3_predicted": float(avg_o3),
                "NO2_predicted": float(avg_no2),
                "confidence": 0.5,
                "model_type": "Fallback"
            })

        return predictions

    # -------------------------------------------------
    # MODEL METADATA (UPDATED)
    # -------------------------------------------------
    def get_model_info(self, site_number):
        """
        Returns metadata about the trained models.
        """

        info = {
            "site_number": site_number,
            "models": {
                "O3": {
                    "algorithm": "XGBoost Regressor",
                    "target": "O3_target",
                    "features": "Lag features (1,6,24), rolling mean (24), cyclic time encoding (hour, day_of_week, day_of_year), meteorological forecasts",
                    "forecasting_type": "Direct Multi-Horizon",
                    "recursive_forecasting": False,
                    "horizons_trained": "1–48 hours (separate model per hour)"
                },
                "NO2": {
                    "algorithm": "XGBoost Regressor",
                    "target": "NO2_target",
                    "features": "Lag features (1,6,24), rolling mean (24), cyclic time encoding (hour, day_of_week, day_of_year), meteorological forecasts",
                    "forecasting_type": "Direct Multi-Horizon",
                    "recursive_forecasting": False,
                    "horizons_trained": "1–48 hours (separate model per hour)"
                }
            }
        }

        return info

    def close(self):
        self.session.close()
