# tests/test_aqi_calculations.py
# ─────────────────────────────────────────────────────────────────────────────
# Unit tests for AQI calculation and category helper functions in app.py.
# Run with: pytest tests/ -v
# ─────────────────────────────────────────────────────────────────────────────

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from app import calculate_aqi, get_aqi_category


class TestCalculateAQI:
    """Tests for the calculate_aqi() helper function."""

    def test_good_aqi_low_values(self):
        """Very low O3 and NO2 should produce Good AQI (<= 50)."""
        aqi = calculate_aqi(o3=10, no2=10)
        assert aqi <= 50, f"Expected Good AQI, got {aqi}"

    def test_moderate_aqi(self):
        """Moderate O3/NO2 values should produce AQI in 51-100 range."""
        aqi = calculate_aqi(o3=80, no2=60)
        assert 51 <= aqi <= 150, f"Expected Moderate/Sensitive AQI, got {aqi}"

    def test_high_o3_dominates(self):
        """High O3 with low NO2 — O3 should dominate the AQI."""
        aqi_high_o3 = calculate_aqi(o3=200, no2=10)
        aqi_low_o3  = calculate_aqi(o3=20,  no2=10)
        assert aqi_high_o3 > aqi_low_o3, "Higher O3 should produce higher AQI"

    def test_none_values_return_zero(self):
        """None values should return AQI of 0 without crashing."""
        aqi = calculate_aqi(o3=None, no2=None)
        assert aqi == 0

    def test_aqi_capped_at_500(self):
        """Extremely high values should be capped at 500."""
        aqi = calculate_aqi(o3=9999, no2=9999)
        assert aqi <= 500, f"AQI should be capped at 500, got {aqi}"

    def test_zero_values(self):
        """Zero O3 and NO2 should return AQI of 0."""
        aqi = calculate_aqi(o3=0, no2=0)
        assert aqi == 0


class TestGetAQICategory:
    """Tests for the get_aqi_category() boundary values."""

    def test_boundary_good(self):
        label, color = get_aqi_category(50)
        assert label == 'Good'
        assert color == '#00E400'

    def test_boundary_moderate(self):
        label, color = get_aqi_category(51)
        assert label == 'Moderate'

    def test_boundary_moderate_upper(self):
        label, color = get_aqi_category(100)
        assert label == 'Moderate'

    def test_boundary_sensitive(self):
        label, color = get_aqi_category(101)
        assert 'Sensitive' in label

    def test_boundary_unhealthy(self):
        label, color = get_aqi_category(151)
        assert label == 'Unhealthy'

    def test_boundary_very_unhealthy(self):
        label, color = get_aqi_category(201)
        assert label == 'Very Unhealthy'

    def test_boundary_hazardous(self):
        label, color = get_aqi_category(301)
        assert label == 'Hazardous'
        assert color == '#7E0023'

    def test_none_aqi(self):
        label, color = get_aqi_category(None)
        assert label == 'Unknown'
        assert color == '#808080'


class TestValidators:
    """Tests for input validation helpers in validators.py."""

    def test_valid_site_numbers(self):
        from validators import validate_site_number
        for site in range(1, 8):
            valid, err = validate_site_number(site)
            assert valid is True, f"Site {site} should be valid"

    def test_invalid_site_number_zero(self):
        from validators import validate_site_number
        valid, err = validate_site_number(0)
        assert valid is False

    def test_invalid_site_number_eight(self):
        from validators import validate_site_number
        valid, err = validate_site_number(8)
        assert valid is False

    def test_forecast_hours_clamping(self):
        from validators import validate_forecast_hours
        assert validate_forecast_hours(0)  == 1,  "Below min should clamp to 1"
        assert validate_forecast_hours(100) == 48, "Above max should clamp to 48"
        assert validate_forecast_hours(24)  == 24, "Valid value should pass through"

    def test_fcm_registration_missing_token(self):
        from validators import validate_fcm_registration
        valid, _ = validate_fcm_registration({'aqi_threshold': 100})
        assert valid is False

    def test_fcm_registration_invalid_threshold(self):
        from validators import validate_fcm_registration
        valid, _ = validate_fcm_registration({
            'fcm_token': 'abc123',
            'aqi_threshold': 10  # Below minimum of 50
        })
        assert valid is False

    def test_fcm_registration_invalid_site(self):
        from validators import validate_fcm_registration
        valid, _ = validate_fcm_registration({
            'fcm_token': 'abc123',
            'monitored_sites': [1, 2, 99]  # 99 is invalid
        })
        assert valid is False

    def test_fcm_registration_valid(self):
        from validators import validate_fcm_registration
        valid, err = validate_fcm_registration({
            'fcm_token': 'valid_token_string',
            'aqi_threshold': 100,
            'notify_critical': True,
            'notify_high': True,
            'notify_moderate': False,
            'monitored_sites': [1, 2, 3]
        })
        assert valid is True


class TestFCMCooldown:
    """Tests for the FCM notification cooldown logic."""

    def test_should_notify_first_time(self):
        """
        First notification for a site should always be allowed.
        Uses a mock session with no existing log entries.
        """
        from unittest.mock import MagicMock, patch
        from fcm_service import FCMService

        mock_engine = MagicMock()
        service = FCMService.__new__(FCMService)
        service.firebase_enabled = True

        mock_session = MagicMock()
        # Simulate no recent notification log found
        mock_session.query.return_value.filter.return_value.first.return_value = None

        result = service.should_notify(mock_session, token_id=1, site_number=1, severity='high')
        assert result is True, "First notification should be allowed"

    def test_should_not_notify_within_cooldown(self):
        """
        A recent notification log entry should block the next notification.
        """
        from unittest.mock import MagicMock
        from fcm_service import FCMService

        mock_engine = MagicMock()
        service = FCMService.__new__(FCMService)
        service.firebase_enabled = True

        mock_session = MagicMock()
        # Simulate a recent log entry found (within cooldown)
        mock_session.query.return_value.filter.return_value.first.return_value = MagicMock()

        result = service.should_notify(mock_session, token_id=1, site_number=1, severity='high')
        assert result is False, "Should not notify within cooldown period"