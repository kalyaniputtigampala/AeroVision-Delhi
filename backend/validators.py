# validators.py
# ─────────────────────────────────────────────────────────────────────────────
# Input validation helpers for the AirQ Forecast Flask API.
# Used to validate route parameters and request body data
# before they reach business logic or the database.
# ─────────────────────────────────────────────────────────────────────────────

from flask import jsonify

# Valid site numbers in the Delhi monitoring network
VALID_SITE_NUMBERS = {1, 2, 3, 4, 5, 6, 7}

# Forecast hour limits
MIN_FORECAST_HOURS = 1
MAX_FORECAST_HOURS = 48

# AQI threshold limits for user preferences
MIN_AQI_THRESHOLD = 50
MAX_AQI_THRESHOLD = 300


def validate_site_number(site_number):
    """
    Validate that a site number is within the known monitoring sites (1-7).

    Args:
        site_number (int): Site number from the URL route parameter.

    Returns:
        tuple: (is_valid: bool, error_response: Response or None)

    Usage:
        valid, err = validate_site_number(site_number)
        if not valid:
            return err
    """
    if site_number not in VALID_SITE_NUMBERS:
        return False, (
            jsonify({
                'error': f'Invalid site number: {site_number}. '
                         f'Valid sites are {sorted(VALID_SITE_NUMBERS)}.'
            }),
            400
        )
    return True, None


def validate_forecast_hours(hours):
    """
    Validate and clamp forecast hours to the allowed range (1-48).

    Args:
        hours (int): Requested forecast hours.

    Returns:
        int: Clamped hours value within [1, 48].
    """
    return max(MIN_FORECAST_HOURS, min(MAX_FORECAST_HOURS, hours))


def validate_fcm_registration(data):
    """
    Validate the request body for FCM token registration.

    Args:
        data (dict): Parsed JSON from request.json

    Returns:
        tuple: (is_valid: bool, error_response: Response or None)

    Checks:
        - fcm_token must be present and a non-empty string
        - aqi_threshold must be an integer between 50 and 300
        - monitored_sites must be a list of valid site numbers
        - notify_* fields must be booleans if present
    """
    if not data:
        return False, (jsonify({'error': 'Request body is required'}), 400)

    # Validate FCM token
    fcm_token = data.get('fcm_token')
    if not fcm_token or not isinstance(fcm_token, str) or len(fcm_token.strip()) == 0:
        return False, (jsonify({'error': 'fcm_token must be a non-empty string'}), 400)

    if len(fcm_token) > 500:
        return False, (jsonify({'error': 'fcm_token exceeds maximum length'}), 400)

    # Validate AQI threshold if provided
    threshold = data.get('aqi_threshold')
    if threshold is not None:
        if not isinstance(threshold, int):
            return False, (jsonify({'error': 'aqi_threshold must be an integer'}), 400)
        if not (MIN_AQI_THRESHOLD <= threshold <= MAX_AQI_THRESHOLD):
            return False, (
                jsonify({
                    'error': f'aqi_threshold must be between '
                             f'{MIN_AQI_THRESHOLD} and {MAX_AQI_THRESHOLD}'
                }),
                400
            )

    # Validate monitored_sites if provided
    monitored_sites = data.get('monitored_sites')
    if monitored_sites is not None:
        if not isinstance(monitored_sites, list):
            return False, (jsonify({'error': 'monitored_sites must be a list'}), 400)
        invalid = [s for s in monitored_sites if s not in VALID_SITE_NUMBERS]
        if invalid:
            return False, (
                jsonify({
                    'error': f'Invalid site numbers in monitored_sites: {invalid}. '
                             f'Valid sites are {sorted(VALID_SITE_NUMBERS)}.'
                }),
                400
            )

    # Validate boolean notification flags if provided
    bool_fields = ['notify_critical', 'notify_high', 'notify_moderate']
    for field in bool_fields:
        value = data.get(field)
        if value is not None and not isinstance(value, bool):
            return False, (
                jsonify({'error': f'{field} must be a boolean (true/false)'}),
                400
            )

    return True, None