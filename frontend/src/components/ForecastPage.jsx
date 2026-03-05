import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { MapPin, Clock, TrendingUp, AlertTriangle, Info, Wind, RefreshCw } from 'lucide-react';
import './ForecastPage.css';
import { API_BASE_URL} from '../config';



// ── Risk logic for O3 ─────────────────────────────────────────────────────────
const getO3Risk = (peak) => {
  if (peak === null || peak === undefined) return null;
  if (peak <= 60) return {
    level: 'Low',
    color: '#22c55e',
    bg: '#f0fdf4',
    border: '#86efac',
    emoji: '✅',
    health: 'Safe for everyone including children and elderly.',
    cause: 'Low traffic emissions and good atmospheric dispersion are keeping O₃ levels low.',
    aqi_effect: 'O₃ at this level contributes minimally to AQI — likely keeping it in the Good (0–50) range.',
    advice: 'No precautions needed. Enjoy outdoor activities freely.'
  };
  if (peak <= 100) return {
    level: 'Moderate',
    color: '#f59e0b',
    bg: '#fffbeb',
    border: '#fcd34d',
    emoji: '⚠️',
    health: 'Unusually sensitive people may experience mild respiratory symptoms.',
    cause: 'Moderate vehicle emissions and sunlight are producing O₃ through photochemical reactions.',
    aqi_effect: 'This O₃ level pushes AQI into Moderate (51–100). Sensitive groups should be aware.',
    advice: 'Sensitive groups (asthma, elderly) should consider reducing prolonged outdoor exertion.'
  };
  if (peak <= 140) return {
    level: 'High',
    color: '#f97316',
    bg: '#fff7ed',
    border: '#fdba74',
    emoji: '🔶',
    health: 'Children, elderly, and people with respiratory conditions face health risks.',
    cause: 'High traffic, industrial emissions, and strong sunlight are driving significant photochemical O₃ production.',
    aqi_effect: 'O₃ at this level drives AQI into Unhealthy for Sensitive Groups (101–150).',
    advice: 'Limit prolonged outdoor activity. Keep windows closed during peak hours (noon–4pm).'
  };
  return {
    level: 'Hazardous',
    color: '#ef4444',
    bg: '#fef2f2',
    border: '#fca5a5',
    emoji: '🚨',
    health: 'Serious health effects for everyone. Respiratory inflammation likely with prolonged exposure.',
    cause: 'Very high emissions combined with intense solar radiation and stagnant air have produced extreme O₃.',
    aqi_effect: 'This O₃ level drives AQI into Unhealthy (151+) or worse — everyone is at risk.',
    advice: 'Stay indoors. Avoid all outdoor physical activity. Use air purifiers. Keep windows shut.'
  };
};

// ── Risk logic for NO2 ────────────────────────────────────────────────────────
const getNo2Risk = (peak) => {
  if (peak === null || peak === undefined) return null;
  if (peak <= 40) return {
    level: 'Low',
    color: '#22c55e',
    bg: '#f0fdf4',
    border: '#86efac',
    emoji: '✅',
    health: 'Safe levels. No health impacts expected for the general population.',
    cause: 'Low vehicle density and good wind dispersion are keeping NO₂ well within safe limits.',
    aqi_effect: 'NO₂ at this level has negligible AQI contribution — overall air quality remains Good.',
    advice: 'No action needed. Normal outdoor activities are safe.'
  };
  if (peak <= 80) return {
    level: 'Moderate',
    color: '#f59e0b',
    bg: '#fffbeb',
    border: '#fcd34d',
    emoji: '⚠️',
    health: 'People with asthma or lung disease may notice increased symptoms.',
    cause: 'Rush hour traffic and diesel vehicle emissions are the primary contributors to this NO₂ level.',
    aqi_effect: 'NO₂ contributes to Moderate AQI (51–100). May cause mild respiratory irritation in sensitive groups.',
    advice: 'Avoid heavy traffic areas during peak hours. Ventilate indoor spaces regularly.'
  };
  if (peak <= 120) return {
    level: 'High',
    color: '#f97316',
    bg: '#fff7ed',
    border: '#fdba74',
    emoji: '🔶',
    health: 'Short-term exposure can cause airway inflammation. Children and elderly most at risk.',
    cause: 'Heavy traffic, combustion sources, and low wind speed are concentrating NO₂ near ground level.',
    aqi_effect: 'High NO₂ pushes AQI toward Unhealthy for Sensitive Groups (101–150). Combined with O₃ it can be worse.',
    advice: 'Avoid roads and high-traffic areas. Do not exercise near busy streets. Keep indoor air filtered.'
  };
  return {
    level: 'Hazardous',
    color: '#ef4444',
    bg: '#fef2f2',
    border: '#fca5a5',
    emoji: '🚨',
    health: 'Severe respiratory effects. Can cause lung inflammation and reduced lung function in everyone.',
    cause: 'Extreme vehicle and industrial emissions combined with temperature inversion trapping pollutants near ground.',
    aqi_effect: 'Hazardous NO₂ drives AQI into Unhealthy (151+) or Very Unhealthy (201–300) range.',
    advice: 'Stay indoors with windows closed. Use N95 masks if going outside. Avoid physical exertion entirely.'
  };
};

// ── Custom tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="fp-tooltip">
      <p className="fp-tooltip-time">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <strong>{p.value?.toFixed(1)} μg/m³</strong>
        </p>
      ))}
    </div>
  );
};

// ── Peak info card ────────────────────────────────────────────────────────────
const PeakCard = ({ pollutant, peak, peakTime, risk, color }) => {
  if (!risk) return null;
  return (
    <div className="fp-peak-card" style={{ borderColor: risk.border, background: risk.bg }}>

      <div className="fp-peak-header">
        <span className="fp-peak-emoji">{risk.emoji}</span>
        <div>
          <div className="fp-peak-title">{pollutant} Peak Forecast</div>
          <div className="fp-peak-value" style={{ color: risk.color }}>
            {peak?.toFixed(1)} μg/m³
            <span className="fp-peak-badge" style={{ background: risk.color }}>
              {risk.level} Risk
            </span>
          </div>
          {peakTime && (
            <div className="fp-peak-time">
              <Clock size={13} /> Peak expected at {peakTime}
            </div>
          )}
        </div>
      </div>

      <div className="fp-peak-grid">
        <div className="fp-peak-section">
          <div className="fp-peak-section-title">
            <Info size={14} /> Health Impact
          </div>
          <p>{risk.health}</p>
        </div>
        <div className="fp-peak-section">
          <div className="fp-peak-section-title">
            <Wind size={14} /> Likely Cause
          </div>
          <p>{risk.cause}</p>
        </div>
        <div className="fp-peak-section">
          <div className="fp-peak-section-title">
            <TrendingUp size={14} /> Effect on AQI
          </div>
          <p>{risk.aqi_effect}</p>
        </div>
        <div className="fp-peak-section fp-peak-advice" style={{ borderColor: risk.border }}>
          <div className="fp-peak-section-title">
            <AlertTriangle size={14} /> Recommended Action
          </div>
          <p>{risk.advice}</p>
        </div>
      </div>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const ForecastPage = () => {
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(1);
  const [forecastHours, setForecastHours] = useState(24);
  const [forecastData, setForecastData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  const fetchSites = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/sites`);
      setSites(res.data.sites);
    } catch (e) { console.error(e); }
  };

  const fetchForecast = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(
        `${API_BASE_URL}/forecast/${selectedSite}?hours=${forecastHours}`
      );
      const processed = res.data.forecast.map(item => ({
        ...item,
        formattedTime: new Date(item.timestamp).toLocaleString('en-IN', {
          month: 'short', day: 'numeric', hour: 'numeric', hour12: true
        })
      }));
      setForecastData(processed);
      setLastUpdated(new Date());
    } catch (e) {
      setError('Failed to load forecast data.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedSite, forecastHours]);

  useEffect(() => { fetchSites(); }, []);
  useEffect(() => { fetchForecast(); }, [fetchForecast]);

  // ── Compute peaks ──────────────────────────────────────────────────
  const o3Peak = forecastData.length
    ? Math.max(...forecastData.map(d => d.O3_predicted ?? 0))
    : null;
  const no2Peak = forecastData.length
    ? Math.max(...forecastData.map(d => d.NO2_predicted ?? 0))
    : null;

  const o3PeakItem = forecastData.find(d => d.O3_predicted === o3Peak);
  const no2PeakItem = forecastData.find(d => d.NO2_predicted === no2Peak);

  const o3Risk  = getO3Risk(o3Peak);
  const no2Risk = getNo2Risk(no2Peak);

  return (
    <div className="forecast-page">

      {/* ── Hero ── */}
      <section className="fp-hero">
        <div className="container">
          <h1>Air Quality Forecast</h1>
          <p>Hourly O₃ and NO₂ predictions with health risk analysis</p>
        </div>
      </section>

      <div className="fp-container">

        {/* ── Controls ── */}
        <div className="fp-controls">
          <div className="fp-controls-left">
            <MapPin size={20} color="#0891b2" />
            <select
              value={selectedSite}
              onChange={e => setSelectedSite(Number(e.target.value))}
              className="fp-dropdown"
            >
              {sites.map(s => (
                <option key={s.site_number} value={s.site_number}>
                  {s.name} — Site {s.site_number}
                </option>
              ))}
            </select>
          </div>

          <div className="fp-controls-right">
            <div className="fp-toggle">
              <button
                className={`fp-toggle-btn ${forecastHours === 24 ? 'active' : ''}`}
                onClick={() => setForecastHours(24)}
              >
                24 Hours
              </button>
              <button
                className={`fp-toggle-btn ${forecastHours === 48 ? 'active' : ''}`}
                onClick={() => setForecastHours(48)}
              >
                48 Hours
              </button>
            </div>

            {lastUpdated && (
              <span className="fp-updated">
                <Clock size={13} />
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}

            <button className="fp-refresh" onClick={fetchForecast} disabled={loading}>
              <RefreshCw size={15} className={loading ? 'spinning' : ''} />
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && <div className="fp-error">{error}</div>}

        {!loading && forecastData.length > 0 && (
          <>
            {/* ── O3 Chart ── */}
            <div className="fp-chart-section">
              <div className="fp-chart-header">
                <div className="fp-chart-title-row">
                  <span className="fp-chart-dot" style={{ background: '#f5800b' }} />
                  <h2>O₃ (Ozone) — {forecastHours}-Hour Forecast</h2>
                </div>
                {o3Peak !== null && (
                  <span className="fp-chart-peak-badge" style={{ background: o3Risk?.color }}>
                    Peak: {o3Peak?.toFixed(1)} μg/m³
                  </span>
                )}
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <AreaChart
                  data={forecastData}
                  margin={{ top: 20, right: 30, left: 60, bottom: 60 }}
                >
                  <defs>
                    <linearGradient id="o3ForecastGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f5800b" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#f5800b" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" />
                  <XAxis
                    dataKey="formattedTime"
                    stroke="#5a7a8f"
                    angle={-40}
                    textAnchor="end"
                    height={70}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    stroke="#5a7a8f"
                    label={{
                      value: 'O₃ (μg/m³)',
                      angle: -90,
                      position: 'insideLeft',
                      offset: -45,
                      style: { textAnchor: 'middle' }
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {/* Safe threshold line */}
                  <ReferenceLine
                    y={60}
                    stroke="#22c55e"
                    strokeDasharray="5 4"
                    label={{ value: 'Safe limit', position: 'insideTopRight', fontSize: 11, fill: '#22c55e' }}
                  />
                  {/* Peak reference line */}
                  {o3Peak && (
                    <ReferenceLine
                      y={o3Peak}
                      stroke={o3Risk?.color}
                      strokeDasharray="4 3"
                      label={{ value: 'Peak', position: 'insideTopRight', fontSize: 11, fill: o3Risk?.color }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="O3_predicted"
                    stroke="#f5800b"
                    strokeWidth={2.5}
                    fill="url(#o3ForecastGrad)"
                    name="O₃ Forecast"
                    dot={false}
                    activeDot={{ r: 6, fill: '#f5800b', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* ── O3 Peak Card ── */}
            <PeakCard
              pollutant="O₃"
              peak={o3Peak}
              peakTime={o3PeakItem?.formattedTime}
              risk={o3Risk}
              color="#f5800b"
            />

            {/* ── NO2 Chart ── */}
            <div className="fp-chart-section">
              <div className="fp-chart-header">
                <div className="fp-chart-title-row">
                  <span className="fp-chart-dot" style={{ background: '#14b8a6' }} />
                  <h2>NO₂ (Nitrogen Dioxide) — {forecastHours}-Hour Forecast</h2>
                </div>
                {no2Peak !== null && (
                  <span className="fp-chart-peak-badge" style={{ background: no2Risk?.color }}>
                    Peak: {no2Peak?.toFixed(1)} μg/m³
                  </span>
                )}
              </div>

              <ResponsiveContainer width="100%" height={300}>
                <AreaChart
                  data={forecastData}
                  margin={{ top: 20, right: 30, left: 60, bottom: 60 }}
                >
                  <defs>
                    <linearGradient id="no2ForecastGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#14b8a6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" />
                  <XAxis
                    dataKey="formattedTime"
                    stroke="#5a7a8f"
                    angle={-40}
                    textAnchor="end"
                    height={70}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    stroke="#5a7a8f"
                    label={{
                      value: 'NO₂ (μg/m³)',
                      angle: -90,
                      position: 'insideLeft',
                      offset: -45,
                      style: { textAnchor: 'middle' }
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine
                    y={40}
                    stroke="#22c55e"
                    strokeDasharray="5 4"
                    label={{ value: 'Safe limit', position: 'insideTopRight', fontSize: 11, fill: '#22c55e' }}
                  />
                  {no2Peak && (
                    <ReferenceLine
                      y={no2Peak}
                      stroke={no2Risk?.color}
                      strokeDasharray="4 3"
                      label={{ value: 'Peak', position: 'insideTopRight', fontSize: 11, fill: no2Risk?.color }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="NO2_predicted"
                    stroke="#14b8a6"
                    strokeWidth={2.5}
                    fill="url(#no2ForecastGrad)"
                    name="NO₂ Forecast"
                    dot={false}
                    activeDot={{ r: 6, fill: '#14b8a6', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* ── NO2 Peak Card ── */}
            <PeakCard
              pollutant="NO₂"
              peak={no2Peak}
              peakTime={no2PeakItem?.formattedTime}
              risk={no2Risk}
              color="#14b8a6"
            />

            {/* ── Risk legend ── */}
            <div className="fp-legend">
              <h3>Risk Level Guide</h3>
              <div className="fp-legend-items">
                {[
                  { label: 'Low',       color: '#22c55e', desc: 'Safe for all. No action needed.' },
                  { label: 'Moderate',  color: '#f59e0b', desc: 'Sensitive groups should take care.' },
                  { label: 'High',      color: '#f97316', desc: 'Limit outdoor activity.' },
                  { label: 'Hazardous', color: '#ef4444', desc: 'Stay indoors. Health risk for everyone.' },
                ].map(({ label, color, desc }) => (
                  <div key={label} className="fp-legend-item">
                    <span className="fp-legend-dot" style={{ background: color }} />
                    <span><strong>{label}</strong> — {desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {loading && (
          <div className="fp-loading">
            <div className="spinner" />
            <p>Loading forecast data…</p>
          </div>
        )}

        {!loading && forecastData.length === 0 && !error && (
          <div className="fp-empty">
            <TrendingUp size={48} color="#0891b2" />
            <p>No forecast data available for this site yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForecastPage;