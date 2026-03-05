// src/config.js
// ─────────────────────────────────────────────────────────────────────────────
// Central configuration for the AirQ Forecast frontend.
// All environment-specific values should live here.
// To change the backend URL, update REACT_APP_API_URL in your .env file.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base URL for all backend API calls.
 * In development: http://localhost:5000/api
 * In production:  set REACT_APP_API_URL in your .env file
 */
export const API_BASE_URL =
  process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * Firebase VAPID key for FCM push notifications.
 * Set REACT_APP_VAPID_KEY in your .env file.
 */
export const VAPID_KEY =
  process.env.REACT_APP_VAPID_KEY ||
  'BL1YjZlvMIh0X9A0LaJLExchfxiE4zBmm0a69G2wkxBFwG7v_j25kcm64N0rpzrX7J3IgTuk0KpWNSUF_wJjOHA';

/**
 * Auto-refresh interval for live data (milliseconds).
 * Default: 5 minutes
 */
export const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * AQI breakpoints and their associated colors, labels.
 * Single source of truth — import this instead of redefining in each component.
 */
export const AQI_LEVELS = [
  { max: 50,  color: '#00E400', label: 'Good',                        bg: '#f0fdf4' },
  { max: 100, color: '#FFFF00', label: 'Moderate',                    bg: '#fefce8' },
  { max: 150, color: '#FF7E00', label: 'Unhealthy for Sensitive',     bg: '#fff7ed' },
  { max: 200, color: '#FF0000', label: 'Unhealthy',                   bg: '#fef2f2' },
  { max: 300, color: '#8F3F97', label: 'Very Unhealthy',              bg: '#faf5ff' },
  { max: 999, color: '#7E0023', label: 'Hazardous',                   bg: '#fff1f2' },
];

/**
 * Returns the AQI color for a given AQI value.
 * Replaces the duplicated getAQIColor() in Dashboard, HotspotDetection, AlertSystem.
 * @param {number} aqi
 * @returns {string} hex color string
 */
export const getAQIColor = (aqi) => {
  const level = AQI_LEVELS.find(l => aqi <= l.max);
  return level ? level.color : '#7E0023';
};

/**
 * Returns the AQI label for a given AQI value.
 * @param {number} aqi
 * @returns {string} category label
 */
export const getAQILabel = (aqi) => {
  const level = AQI_LEVELS.find(l => aqi <= l.max);
  return level ? level.label : 'Hazardous';
};