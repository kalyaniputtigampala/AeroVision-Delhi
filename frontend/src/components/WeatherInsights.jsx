import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Thermometer, Droplets, Wind, Gauge, CloudRain,
  Sun, Layers, ArrowUp, MapPin, RefreshCw, Clock
} from 'lucide-react';
import './WeatherInsights.css';
import { API_BASE_URL} from '../config';


// ── Impact logic ──────────────────────────────────────────────────────────────
const getImpact = (key, value) => {
  if (value === null || value === undefined) return null;

  const rules = {
    temperature: () => {
      if (value >= 35) return {
        o3: { level: 'bad', text: 'Very high temps strongly accelerate O₃ formation via photochemical reactions' },
        no2: { level: 'bad', text: 'Heat speeds up NO₂ → O₃ conversion, depleting NO₂ while raising O₃' },
        overall: 'bad'
      };
      if (value >= 25) return {
        o3: { level: 'moderate', text: 'Warm temperatures moderately increase O₃ production' },
        no2: { level: 'moderate', text: 'Moderate heat promotes some NO₂ → O₃ conversion' },
        overall: 'moderate'
      };
      return {
        o3: { level: 'good', text: 'Cool temperatures slow photochemical O₃ formation' },
        no2: { level: 'good', text: 'Cool air slows NO₂ conversion reactions' },
        overall: 'good'
      };
    },
    humidity: () => {
      if (value >= 80) return {
        o3: { level: 'good', text: 'High humidity suppresses O₃ — water vapour absorbs UV and reacts with O₃' },
        no2: { level: 'bad', text: 'High humidity traps NO₂ near ground and slows dispersion' },
        overall: 'moderate'
      };
      if (value >= 50) return {
        o3: { level: 'moderate', text: 'Moderate humidity has mild suppressing effect on O₃' },
        no2: { level: 'moderate', text: 'Moderate humidity — normal NO₂ behaviour' },
        overall: 'moderate'
      };
      return {
        o3: { level: 'bad', text: 'Low humidity favours O₃ buildup — less water vapour to suppress it' },
        no2: { level: 'good', text: 'Dry air disperses NO₂ more easily' },
        overall: 'moderate'
      };
    },
    wind_speed: () => {
      if (value >= 6) return {
        o3: { level: 'good', text: 'Strong winds rapidly disperse O₃ precursors and O₃ itself' },
        no2: { level: 'good', text: 'Strong winds effectively dilute and disperse NO₂' },
        overall: 'good'
      };
      if (value >= 3) return {
        o3: { level: 'moderate', text: 'Moderate winds provide partial O₃ dispersion' },
        no2: { level: 'moderate', text: 'Moderate winds partially dilute NO₂' },
        overall: 'moderate'
      };
      return {
        o3: { level: 'bad', text: 'Calm winds allow O₃ to accumulate near ground level' },
        no2: { level: 'bad', text: 'Stagnant air causes NO₂ to build up at ground level' },
        overall: 'bad'
      };
    },
    pressure: () => {
      if (value >= 1013) return {
        o3: { level: 'bad', text: 'High pressure creates stable atmosphere trapping O₃ near ground' },
        no2: { level: 'bad', text: 'High pressure suppresses vertical mixing, concentrating NO₂' },
        overall: 'bad'
      };
      return {
        o3: { level: 'good', text: 'Low pressure promotes atmospheric mixing and O₃ dispersion' },
        no2: { level: 'good', text: 'Low pressure encourages vertical mixing, dispersing NO₂' },
        overall: 'good'
      };
    },
    precipitation: () => {
      if (value >= 1) return {
        o3: { level: 'good', text: 'Rain washes O₃ precursors from atmosphere and suppresses formation' },
        no2: { level: 'good', text: 'Rain effectively scrubs NO₂ from the air (wet deposition)' },
        overall: 'good'
      };
      return {
        o3: { level: 'moderate', text: 'No rain — O₃ precursors remain in atmosphere' },
        no2: { level: 'moderate', text: 'No wet deposition — NO₂ persists in atmosphere' },
        overall: 'moderate'
      };
    },
    solar_radiation: () => {
      if (value >= 600) return {
        o3: { level: 'bad', text: 'Intense solar radiation is the primary driver of photochemical O₃ production' },
        no2: { level: 'bad', text: 'High radiation photolysis converts NO₂ to NO + O, initiating O₃ cycle' },
        overall: 'bad'
      };
      if (value >= 300) return {
        o3: { level: 'moderate', text: 'Moderate solar radiation drives some photochemical O₃ formation' },
        no2: { level: 'moderate', text: 'Moderate radiation causes partial NO₂ photolysis' },
        overall: 'moderate'
      };
      return {
        o3: { level: 'good', text: 'Low radiation — minimal photochemical O₃ production' },
        no2: { level: 'good', text: 'Low radiation — minimal NO₂ photolysis occurring' },
        overall: 'good'
      };
    },
    uv_index: () => {
      if (value >= 8) return {
        o3: { level: 'bad', text: 'Very high UV drives intense photochemical O₃ production' },
        no2: { level: 'bad', text: 'High UV aggressively photolyzes NO₂, sustaining the O₃ formation cycle' },
        overall: 'bad'
      };
      if (value >= 4) return {
        o3: { level: 'moderate', text: 'Moderate UV index drives noticeable O₃ formation' },
        no2: { level: 'moderate', text: 'Moderate UV causes regular NO₂ photolysis rates' },
        overall: 'moderate'
      };
      return {
        o3: { level: 'good', text: 'Low UV — photochemical O₃ production is minimal' },
        no2: { level: 'good', text: 'Low UV — slow NO₂ photolysis, gas remains stable' },
        overall: 'good'
      };
    },
    boundary_layer: () => {
      if (value <= 500) return {
        o3: { level: 'bad', text: 'Very low boundary layer traps O₃ and precursors close to ground' },
        no2: { level: 'bad', text: 'Shallow mixing height concentrates NO₂ at breathing level' },
        overall: 'bad'
      };
      if (value <= 1000) return {
        o3: { level: 'moderate', text: 'Moderate mixing height — some O₃ trapping near surface' },
        no2: { level: 'moderate', text: 'Moderate boundary layer — partial NO₂ dilution' },
        overall: 'moderate'
      };
      return {
        o3: { level: 'good', text: 'High boundary layer allows O₃ to disperse vertically' },
        no2: { level: 'good', text: 'Deep mixing layer effectively dilutes NO₂ concentrations' },
        overall: 'good'
      };
    },
  };

  return rules[key] ? rules[key]() : null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const getWindDirection = (deg) => {
  if (deg === null || deg === undefined) return 'N/A';
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
};

const IMPACT_COLORS = {
  good: { bg: '#f0fdf4', border: '#86efac', text: '#15803d', badge: '#22c55e' },
  moderate: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e', badge: '#f59e0b' },
  bad: { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', badge: '#ef4444' },
};

const POLLUTANT_STATUS = (val, type) => {
  if (val === null) return { label: 'N/A', color: '#94a3b8' };
  if (type === 'O3') {
    if (val <= 60) return { label: 'Good', color: '#22c55e' };
    if (val <= 100) return { label: 'Moderate', color: '#f59e0b' };
    if (val <= 140) return { label: 'High', color: '#f97316' };
    return { label: 'Hazardous', color: '#ef4444' };
  }
  if (type === 'NO2') {
    if (val <= 40) return { label: 'Good', color: '#22c55e' };
    if (val <= 80) return { label: 'Moderate', color: '#f59e0b' };
    if (val <= 120) return { label: 'High', color: '#f97316' };
    return { label: 'Hazardous', color: '#ef4444' };
  }
};

// ── Weather card component ────────────────────────────────────────────────────
const WeatherCard = ({ icon, label, value, unit, impactKey, subtext }) => {
  const impact = getImpact(impactKey, value);
  const col = impact ? IMPACT_COLORS[impact.overall] : null;

  return (
    <div
      className="weather-card-item"
      style={col ? { borderColor: col.border } : {}}
    >
      {/* Top row */}
      <div className="wc-top">
        <div className="wc-icon">{icon}</div>
        <div className="wc-meta">
          <span className="wc-label">{label}</span>
          <span className="wc-value">
            <span style={col ? { color: col.badge } : {}}>
              {value !== null && value !== undefined ? value : '—'}
            </span>
            <span className="wc-unit"> {unit}</span>
          </span>
          {subtext && <span className="wc-subtext">{subtext}</span>}
        </div>
        {impact && (
          <span
            className="wc-badge"
            style={{ background: col.badge }}
          >
            {impact.overall === 'good' ? '✓ Good' :
              impact.overall === 'moderate' ? '~ Moderate' : '✗ Poor'}
          </span>
        )}
      </div>

      {/* Impact rows */}
      {impact && (
        <div className="wc-impacts">
          <div className="wc-impact-row">
            <span className="wc-pollutant-tag o3-tag">O₃</span>
            <span
              className="wc-impact-dot"
              style={{ background: IMPACT_COLORS[impact.o3.level].badge }}
            />
            <span className="wc-impact-text">{impact.o3.text}</span>
          </div>
          <div className="wc-impact-row">
            <span className="wc-pollutant-tag no2-tag">NO₂</span>
            <span
              className="wc-impact-dot"
              style={{ background: IMPACT_COLORS[impact.no2.level].badge }}
            />
            <span className="wc-impact-text">{impact.no2.text}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const WeatherPage = () => {
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(1);
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  const fetchSites = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/sites`);
      setSites(res.data.sites);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchWeather = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/weather/${selectedSite}`);
      setWeatherData(res.data);
      setLastUpdated(new Date());
    } catch (e) {
      setError('Failed to load weather data.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedSite]);

  useEffect(() => { fetchSites(); }, []);
  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [fetchWeather]);

  const w = weatherData?.weather || {};
  const p = weatherData?.current_pollutants || {};

  const o3Status = POLLUTANT_STATUS(p.O3, 'O3');
  const no2Status = POLLUTANT_STATUS(p.NO2, 'NO2');

  const windSpeed = w.wind_speed?.value;
  const windDir = w.wind_direction?.value;

  return (
    <div className="weather-page">

      {/* ── Page header ── */}
      <section className="weather-hero">
        <div className="container">
          <h1>Live Weather & Air Quality Impact</h1>
          <p>Real-time meteorological conditions and their effect on ground-level O₃ and NO₂</p>
        </div>
      </section>

      <div className="weather-container">

        {/* ── Controls ── */}
        <div className="weather-controls">
          <div className="site-selector-row">
            <MapPin size={20} />
            <select
              value={selectedSite}
              onChange={e => setSelectedSite(Number(e.target.value))}
              className="site-dropdown"
            >
              {sites.map(s => (
                <option key={s.site_number} value={s.site_number}>
                  {s.name} — Site {s.site_number}
                </option>
              ))}
            </select>
          </div>

          <div className="refresh-row">
            {lastUpdated && (
              <span className="last-updated-text">
                <Clock size={14} />
                Updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button className="refresh-btn-sm" onClick={fetchWeather} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'spinning' : ''} />
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && <div className="weather-error">{error}</div>}

        {!loading && weatherData && (
          <>
            {/* ── Current pollutant status banner ── */}
            <div className="pollutant-banner">
              <div className="pb-title">Current Ground-Level Pollutants</div>
              <div className="pb-cards">

                <div className="pb-card" style={{ borderColor: o3Status?.color }}>
                  <div className="pb-label">O₃ (Ozone)</div>
                  <div className="pb-value" style={{ color: o3Status?.color }}>
                    {p.O3 !== null && p.O3 !== undefined ? `${p.O3.toFixed(1)} μg/m³` : 'N/A'}
                  </div>
                  <div
                    className="pb-status-badge"
                    style={{ background: o3Status?.color }}
                  >
                    {o3Status?.label}
                  </div>
                  <div className="pb-description">
                    {o3Status?.label === 'Good' && 'Safe O₃ levels — no health concern'}
                    {o3Status?.label === 'Moderate' && 'Slightly elevated — sensitive groups take care'}
                    {o3Status?.label === 'High' && 'High O₃ — limit prolonged outdoor activity'}
                    {o3Status?.label === 'Hazardous' && 'Dangerous O₃ — stay indoors if possible'}
                  </div>
                </div>

                <div className="pb-card" style={{ borderColor: no2Status?.color }}>
                  <div className="pb-label">NO₂ (Nitrogen Dioxide)</div>
                  <div className="pb-value" style={{ color: no2Status?.color }}>
                    {p.NO2 !== null && p.NO2 !== undefined ? `${p.NO2.toFixed(1)} μg/m³` : 'N/A'}
                  </div>
                  <div
                    className="pb-status-badge"
                    style={{ background: no2Status?.color }}
                  >
                    {no2Status?.label}
                  </div>
                  <div className="pb-description">
                    {no2Status?.label === 'Good' && 'Safe NO₂ levels — no health concern'}
                    {no2Status?.label === 'Moderate' && 'Slightly elevated — ventilate indoor spaces'}
                    {no2Status?.label === 'High' && 'High NO₂ — avoid busy roads and traffic'}
                    {no2Status?.label === 'Hazardous' && 'Dangerous NO₂ — stay indoors, avoid exertion'}
                  </div>
                </div>

                <div className="pb-card aqi-card-sm">
                  <div className="pb-label">AQI</div>
                  <div className="pb-value" style={{ color: '#0891b2' }}>
                    {p.AQI ?? 'N/A'}
                  </div>
                  <div className="pb-description">Overall Air Quality Index</div>
                </div>

              </div>
            </div>

            {/* ── Weather cards grid ── */}
            <div className="weather-cards-grid">

              <WeatherCard
                icon={<Thermometer size={28} color="#f97316" />}
                label="Temperature"
                value={w.temperature?.value}
                unit="°C"
                impactKey="temperature"
              />

              <WeatherCard
                icon={<Droplets size={28} color="#3b82f6" />}
                label="Relative Humidity"
                value={w.humidity?.value}
                unit="%"
                impactKey="humidity"
              />

              <WeatherCard
                icon={<Wind size={28} color="#06b6d4" />}
                label="Wind Speed"
                value={windSpeed}
                unit="m/s"
                impactKey="wind_speed"
                subtext={windDir !== null ? `Direction: ${getWindDirection(windDir)} (${windDir}°)` : null}
              />

              <WeatherCard
                icon={<Gauge size={28} color="#8b5cf6" />}
                label="Surface Pressure"
                value={w.pressure?.value}
                unit="hPa"
                impactKey="pressure"
              />

              <WeatherCard
                icon={<CloudRain size={28} color="#64748b" />}
                label="Rainfall"
                value={w.precipitation?.value}
                unit="mm"
                impactKey="precipitation"
                subtext="Amount of rain in the current hour"
              />

              <WeatherCard
                icon={<Sun size={28} color="#eab308" />}
                label="Solar Radiation"
                value={w.solar_radiation?.value}
                unit="W/m²"
                impactKey="solar_radiation"
                subtext="0 W/m² is normal at night or on overcast days"
              />

              <WeatherCard
                icon={<Sun size={28} color="#f59e0b" />}
                label="UV Index"
                value={w.uv_index?.value}
                unit=""
                impactKey="uv_index"
                subtext="UV is 0 at night — check again during daytime hours"
              />

              <WeatherCard
                icon={<Layers size={28} color="#10b981" />}
                label="Boundary Layer Height"
                value={w.boundary_layer?.value}
                unit="m"
                impactKey="boundary_layer"
              />

              <WeatherCard
                icon={<ArrowUp size={28} color="#0891b2" />}
                label="Wind U-component (E-W)"
                value={
                  w.wind_u?.value !== null && w.wind_u?.value !== undefined
                    ? Math.round(Math.abs(w.wind_u.value) * 10) / 10
                    : null
                }
                unit="m/s"
                impactKey="wind_speed"
                subtext={
                  w.wind_u?.value !== null && w.wind_u?.value !== undefined
                    ? w.wind_u.value >= 0
                      ? `Eastward flow (→)  |  Raw value: ${w.wind_u.value} m/s`
                      : `Westward flow (←)  |  Raw value: ${w.wind_u.value} m/s`
                    : null
                }
              />

              <WeatherCard
                icon={<ArrowUp size={28} color="#14b8a6" style={{ transform: 'rotate(90deg)' }} />}
                label="Wind V-component (N-S)"
                value={
                  w.wind_v?.value !== null && w.wind_v?.value !== undefined
                    ? Math.round(Math.abs(w.wind_v.value) * 10) / 10
                    : null
                }
                unit="m/s"
                impactKey="wind_speed"
                subtext={
                  w.wind_v?.value !== null && w.wind_v?.value !== undefined
                    ? w.wind_v.value >= 0
                      ? `Northward flow (↑)  |  Raw value: ${w.wind_v.value} m/s`
                      : `Southward flow (↓)  |  Raw value: ${w.wind_v.value} m/s`
                    : null
                }
              />

            </div>

            {/* ── Impact legend ── */}
            <div className="impact-legend">
              <h3>Impact Guide</h3>
              <div className="legend-items">
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: '#22c55e' }} />
                  <span><strong>Good</strong> — Conditions favour lower O₃ / NO₂ concentrations</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: '#f59e0b' }} />
                  <span><strong>Moderate</strong> — Neutral or mixed effect on pollutant levels</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: '#ef4444' }} />
                  <span><strong>Poor</strong> — Conditions promote higher O₃ / NO₂ concentrations</span>
                </div>
              </div>
            </div>
          </>
        )}

        {loading && (
          <div className="weather-loading">
            <div className="spinner" />
            <p>Loading weather data…</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeatherPage;