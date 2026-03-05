// src/utils/aqiHelpers.js
// ─────────────────────────────────────────────────────────────────────────────
// Shared AQI utility functions used across Dashboard, HotspotDetection,
// AlertSystem, DailyTips and ForecastPage.
// Import from here instead of redefining in each component.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react';

/**
 * Returns the hex color string for a given AQI value
 * based on EPA standard breakpoints.
 * @param {number} aqi
 * @returns {string}
 */
export const getAQIColor = (aqi) => {
  if (aqi <= 50)  return '#00E400';
  if (aqi <= 100) return '#FFFF00';
  if (aqi <= 150) return '#FF7E00';
  if (aqi <= 200) return '#FF0000';
  if (aqi <= 300) return '#8F3F97';
  return '#7E0023';
};

/**
 * Returns the AQI category label for a given AQI value.
 * @param {number} aqi
 * @returns {string}
 */
export const getAQILabel = (aqi) => {
  if (aqi <= 50)  return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
};

/**
 * Returns the AQI category as a short string (used in alerts and tips).
 * @param {number} aqi
 * @returns {string}
 */
export const getAQICategory = (aqi) => {
  if (aqi <= 50)  return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
};

/**
 * Returns an icon and text status object for a given AQI value.
 * Used in Dashboard's current AQI section.
 * @param {number} aqi
 * @returns {{ text: string, icon: JSX.Element }}
 */
export const getAQIStatus = (aqi) => {
  if (aqi <= 50)  return { text: 'Good',                       icon: <CheckCircle /> };
  if (aqi <= 100) return { text: 'Moderate',                   icon: <AlertCircle /> };
  if (aqi <= 150) return { text: 'Unhealthy for Sensitive',    icon: <AlertCircle /> };
  if (aqi <= 200) return { text: 'Unhealthy',                  icon: <AlertCircle /> };
  if (aqi <= 300) return { text: 'Very Unhealthy',             icon: <AlertCircle /> };
  return           { text: 'Hazardous',                        icon: <XCircle /> };
};

/**
 * Returns the alert severity level string based on AQI.
 * Used in AlertSystem and FCM notification logic.
 * @param {number} aqi
 * @returns {'critical' | 'high' | 'moderate' | 'safe'}
 */
export const getAlertSeverity = (aqi) => {
  if (aqi >= 200) return 'critical';
  if (aqi >= 150) return 'high';
  if (aqi >= 100) return 'moderate';
  return 'safe';
};

/**
 * Returns a health recommendation object based on AQI value.
 * Used in AlertSystem and DailyTips.
 * @param {number} aqi
 * @returns {{ title: string, description: string }}
 */
export const getHealthRecommendation = (aqi) => {
  if (aqi <= 50)  return {
    title: 'Enjoy outdoor activities',
    description: 'Air quality is good. Great day for outdoor activities!'
  };
  if (aqi <= 100) return {
    title: 'Unusually sensitive people should consider limiting outdoor exertion',
    description: 'Air quality is acceptable for most people.'
  };
  if (aqi <= 150) return {
    title: 'Sensitive groups should reduce outdoor exertion',
    description: 'Children, elderly, and people with respiratory issues should limit prolonged outdoor activities.'
  };
  if (aqi <= 200) return {
    title: 'Everyone should reduce outdoor exertion',
    description: 'Avoid prolonged outdoor activities. Wear masks if going outside.'
  };
  if (aqi <= 300) return {
    title: 'Everyone should avoid outdoor activities',
    description: 'Stay indoors. Use air purifiers. Wear N95 masks if you must go outside.'
  };
  return {
    title: 'Health emergency — everyone should stay indoors',
    description: 'Hazardous conditions. Avoid all outdoor activities. Use air purifiers and keep windows closed.'
  };
};