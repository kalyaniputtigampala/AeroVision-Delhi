import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Area, AreaChart,
  BarChart, Bar, LabelList
} from 'recharts';
import {
  Wind, Droplets, Thermometer,
  TrendingUp, AlertCircle, CheckCircle, MapPin,
  Maximize2, Minimize2, RefreshCw, Activity, BarChart2, Calendar, Clock
} from 'lucide-react';
import './Dashboard.css';
import { API_BASE_URL } from '../config';


const Dashboard = () => {
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(1);
  const [forecastHours, setForecastHours] = useState(24);
  const [currentData, setCurrentData] = useState(null);
  const [forecastData, setForecastData] = useState([]);
  const [historicalData, setHistoricalData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [yearlyData, setYearlyData] = useState([]);
  const [thisYearMonthly, setThisYearMonthly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedChart, setExpandedChart] = useState(null);

  useEffect(() => { fetchSites(); }, []);
  useEffect(() => { if (selectedSite) fetchAllData(); }, [selectedSite, forecastHours]);

  const fetchSites = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/sites`);
      setSites(response.data.sites);
    } catch (err) {
      setError('Failed to load monitoring sites');
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [current, forecast, historical, monthly] = await Promise.all([
        axios.get(`${API_BASE_URL}/current/${selectedSite}`),
        axios.get(`${API_BASE_URL}/forecast/${selectedSite}?hours=${forecastHours}`),
        axios.get(`${API_BASE_URL}/historical/${selectedSite}?days=7`),
        axios.get(`${API_BASE_URL}/monthly-averages/${selectedSite}?years=5`)
      ]);
      setCurrentData(current.data);
      const processedForecast = forecast.data.forecast.map(item => ({
        ...item,
        formattedTime: new Date(item.timestamp).toLocaleString('en-IN', {
          day: 'numeric', month: 'short', hour: 'numeric'
        })
      }));
      setForecastData(processedForecast);
      setHistoricalData(processHistoricalData(historical.data.data));
      setMonthlyData(monthly.data.monthly_averages);
      setYearlyData(processYearlyData(monthly.data.monthly_averages));
      setThisYearMonthly(processThisYearMonthly(monthly.data.monthly_averages));
      setLoading(false);
    } catch (err) {
      setError('Failed to load data. Make sure the backend is running.');
      setLoading(false);
    }
  };

  const processHistoricalData = (data) => {
    const groupedByDay = {};
    data.forEach(record => {
      const date = record.timestamp.split('T')[0];
      if (!groupedByDay[date]) groupedByDay[date] = { O3: [], NO2: [], date };
      if (record.O3_target) groupedByDay[date].O3.push(record.O3_target);
      if (record.NO2_target) groupedByDay[date].NO2.push(record.NO2_target);
    });
    return Object.values(groupedByDay).map(day => ({
      date: day.date,
      O3: day.O3.length ? parseFloat((day.O3.reduce((a, b) => a + b, 0) / day.O3.length).toFixed(1)) : 0,
      NO2: day.NO2.length ? parseFloat((day.NO2.reduce((a, b) => a + b, 0) / day.NO2.length).toFixed(1)) : 0
    }));
  };

  const processYearlyData = (monthlyData) => {
    const yearlyAverages = {};
    monthlyData.forEach(record => {
      const year = record.year;
      if (!yearlyAverages[year]) yearlyAverages[year] = { year, O3: [], NO2: [] };
      if (record.avg_O3) yearlyAverages[year].O3.push(record.avg_O3);
      if (record.avg_NO2) yearlyAverages[year].NO2.push(record.avg_NO2);
    });
    return Object.values(yearlyAverages)
      .map(yearData => ({
        year: yearData.year,
        O3: yearData.O3.length ? parseFloat((yearData.O3.reduce((a, b) => a + b, 0) / yearData.O3.length).toFixed(1)) : 0,
        NO2: yearData.NO2.length ? parseFloat((yearData.NO2.reduce((a, b) => a + b, 0) / yearData.NO2.length).toFixed(1)) : 0
      }))
      .sort((a, b) => a.year - b.year);
  };

  const processThisYearMonthly = (monthlyData) => {
    const latestYear = Math.max(...monthlyData.map(d => d.year));
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthlyData
      .filter(record => record.year === latestYear)
      .map(record => ({
        month: months[record.month - 1],
        monthNum: record.month,
        O3: record.avg_O3 ? parseFloat(parseFloat(record.avg_O3).toFixed(1)) : 0,
        NO2: record.avg_NO2 ? parseFloat(parseFloat(record.avg_NO2).toFixed(1)) : 0
      }))
      .sort((a, b) => a.monthNum - b.monthNum);
  };

  const getNumericValue = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object' && value.value !== undefined) return parseFloat(value.value);
    return parseFloat(value);
  };

  const getAQIColor = (aqi) => {
    if (aqi <= 50) return '#00E400';
    if (aqi <= 100) return '#FFFF00';
    if (aqi <= 150) return '#FF7E00';
    if (aqi <= 200) return '#FF0000';
    if (aqi <= 300) return '#8F3F97';
    return '#7E0023';
  };

  const getAQIStatus = (aqi) => {
    if (aqi <= 50) return { text: 'Good', icon: <CheckCircle /> };
    if (aqi <= 100) return { text: 'Moderate', icon: <AlertCircle /> };
    if (aqi <= 150) return { text: 'Unhealthy for Sensitive', icon: <AlertCircle /> };
    if (aqi <= 200) return { text: 'Unhealthy', icon: <AlertCircle /> };
    if (aqi <= 300) return { text: 'Very Unhealthy', icon: <AlertCircle /> };
    return { text: 'Hazardous', icon: <AlertCircle /> };
  };

  const toggleExpand = (chartId) => {
    setExpandedChart(prev => prev === chartId ? null : chartId);
  };

  /* ---- Reusable Chart Card ---- */
  const ChartCard = ({ id, title, icon, children }) => {
    const isExpanded = expandedChart === id;
    const isOtherExpanded = expandedChart !== null && expandedChart !== id;
    return (
      <div
        className={`chart-section${isExpanded ? ' chart-expanded' : ''}${isOtherExpanded ? ' chart-dimmed' : ''}`}
        onClick={() => !isExpanded && toggleExpand(id)}
      >
        <div className="section-header">
          <div className="section-header-left">
            <span className="section-icon">{icon}</span>
            <h2>{title}</h2>
          </div>
          <button
            className="expand-btn"
            onClick={(e) => { e.stopPropagation(); toggleExpand(id); }}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '⤡' : '⤢'}
          </button>
        </div>
        <div className="chart-container" onClick={e => e.stopPropagation()}>
          {children}
        </div>
        {!isExpanded && <div className="chart-click-hint">Click to expand</div>}
      </div>
    );
  };

  /* ---- Loading ---- */
  if (loading && !currentData) {
    return (
      <div className="dashboard-loading">
        <div className="pbi-loader">
          <div className="pbi-loader-bar"></div>
          <div className="pbi-loader-bar"></div>
          <div className="pbi-loader-bar"></div>
          <div className="pbi-loader-bar"></div>
        </div>
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  /* ---- Error ---- */
  if (error && !currentData) {
    return (
      <div className="dashboard-error">
        <AlertCircle size={48} />
        <h2>Error Loading Dashboard</h2>
        <p>{error}</p>
        <button onClick={fetchAllData} className="retry-btn">Retry</button>
      </div>
    );
  }

  const selectedSiteInfo = sites.find(s => s.site_number === selectedSite);
  const aqiStatus = currentData ? getAQIStatus(currentData.aqi) : null;
  const o3Value = currentData ? getNumericValue(currentData.pollutants?.O3) : null;
  const no2Value = currentData ? getNumericValue(currentData.pollutants?.NO2) : null;

  const CH = (id) => (expandedChart === id ? 520 : 300);

  return (
    <div className="dashboard">

      {/* ── Power BI-style Top Bar ── */}
      <div className="pbi-topbar">
        <div className="pbi-topbar-left">
          <div className="pbi-logo"><Activity size={16} /></div>
          <span className="pbi-report-name">Air Quality Analytics</span>
          <span className="pbi-breadcrumb">/ Delhi — Real-time Monitor</span>
        </div>
        <div className="pbi-topbar-right">
          <div className="site-selector">
            <MapPin size={13} />
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(Number(e.target.value))}
              className="site-dropdown"
            >
              {sites.map(site => (
                <option key={site.site_number} value={site.site_number}>
                  {site.name} — Site {site.site_number}
                </option>
              ))}
            </select>
          </div>

          <div className="forecast-toggle">
            <div className="toggle-buttons">
              <button className={`toggle-btn ${forecastHours === 24 ? 'active' : ''}`} onClick={() => setForecastHours(24)}>
                <Clock size={12} /> 24h
              </button>
              <button className={`toggle-btn ${forecastHours === 48 ? 'active' : ''}`} onClick={() => setForecastHours(48)}>
                <Clock size={12} /> 48h
              </button>
            </div>
          </div>

          <button onClick={fetchAllData} className="refresh-btn" disabled={loading}>
            <RefreshCw size={13} className={loading ? 'spinning' : ''} />
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── KPI Strip ── */}
      {currentData && (
        <div className="kpi-strip">
          <div className="kpi-card kpi-aqi">
            <div className="kpi-label">AQI Index</div>
            <div className="kpi-value" style={{ color: getAQIColor(currentData.aqi) }}>{currentData.aqi}</div>
            <div className="kpi-sub" style={{ color: getAQIColor(currentData.aqi) }}>{aqiStatus?.text}</div>
            <div className="kpi-bar-track">
              <div className="kpi-bar-fill" style={{ width: `${Math.min(currentData.aqi / 5, 100)}%`, background: getAQIColor(currentData.aqi) }}></div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">O₃ Ozone</div>
            <div className="kpi-value kpi-o3">{o3Value !== null ? o3Value.toFixed(1) : 'N/A'}</div>
            <div className="kpi-unit">μg/m³</div>
            <div className="kpi-bar-track"><div className="kpi-bar-fill kpi-bar-o3" style={{ width: `${Math.min((o3Value || 0) / 2, 100)}%` }}></div></div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">NO₂ Nitrogen Dioxide</div>
            <div className="kpi-value kpi-no2">{no2Value !== null ? no2Value.toFixed(1) : 'N/A'}</div>
            <div className="kpi-unit">μg/m³</div>
            <div className="kpi-bar-track"><div className="kpi-bar-fill kpi-bar-no2" style={{ width: `${Math.min((no2Value || 0) / 2, 100)}%` }}></div></div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label"><Thermometer size={12} /> Temperature</div>
            <div className="kpi-value kpi-weather">
              {currentData.weather?.temperature != null ? `${currentData.weather.temperature}°C` : 'N/A'}
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label"><Droplets size={12} /> Humidity</div>
            <div className="kpi-value kpi-weather">
              {currentData.weather?.humidity ? `${(currentData.weather.humidity).toFixed(1)}%` : 'N/A'}
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label"><Wind size={12} /> Wind Speed</div>
            <div className="kpi-value kpi-weather">
              {currentData.weather?.wind_speed != null ? `${currentData.weather.wind_speed} m/s` : 'N/A'}
            </div>
          </div>
        </div>
      )}

      {/* ── Chart Grid ── */}
      <div className={`chart-grid${expandedChart ? ' has-expanded' : ''}`}>

        <ChartCard id="forecast" title={`${forecastHours}-Hour Forecast`} icon={<TrendingUp size={16} />}>
          <ResponsiveContainer width="100%" height={CH('forecast')}>
            <LineChart data={forecastData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" />
              <XAxis dataKey="formattedTime" stroke="#5a7a8f" angle={-45} textAnchor="end" height={70} tick={{ fontSize: 11 }} />
              <YAxis stroke="#5a7a8f" label={{ value: 'Concentration (μg/m³)', angle: -90, position: 'insideLeft', fontSize: 11 }} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '2px solid #0891b2', borderRadius: '8px', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="O3_predicted" stroke="#f5800b" strokeWidth={2} name="O₃ Forecast" dot={{ fill: '#f5800b', r: 3 }} />
              <Line type="monotone" dataKey="NO2_predicted" stroke="#14b8a6" strokeWidth={2} name="NO₂ Forecast" dot={{ fill: '#14b8a6', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard id="historical" title="Historical Trends (Last 7 Days)" icon={<BarChart2 size={16} />}>
          <ResponsiveContainer width="100%" height={CH('historical')}>
            <BarChart data={historicalData} margin={{ top: 25, right: 30, left: 20, bottom: 20 }} barCategoryGap="20%" barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" />
              <XAxis dataKey="date" stroke="#5a7a8f" tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} tick={{ fontSize: 11 }} />
              <YAxis stroke="#5a7a8f" label={{ value: 'Concentration (μg/m³)', angle: -90, position: 'insideLeft', offset: -5, dy: 80, fontSize: 11 }} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '2px solid #0891b2', borderRadius: '8px', fontSize: 12 }} formatter={(v, n) => [`${v} μg/m³`, n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="O3" name="O₃ (μg/m³)" fill="#f5800b" radius={[6, 6, 0, 0]}>
                <LabelList dataKey="O3" position="top" style={{ fontSize: 10, fill: '#f5800b', fontWeight: 600 }} />
              </Bar>
              <Bar dataKey="NO2" name="NO₂ (μg/m³)" fill="#14b8a6" radius={[6, 6, 0, 0]}>
                <LabelList dataKey="NO2" position="top" style={{ fontSize: 10, fill: '#14b8a6', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard id="monthly" title="Monthly Comparison (This Year)" icon={<Calendar size={16} />}>
          <ResponsiveContainer width="100%" height={CH('monthly')}>
            <AreaChart data={thisYearMonthly} margin={{ top: 20, right: 30, left: 60, bottom: 20 }}>
              <defs>
                <linearGradient id="o3Gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f5800b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f5800b" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="no2Gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" />
              <XAxis dataKey="month" stroke="#5a7a8f" tick={{ fontSize: 11 }} />
              <YAxis stroke="#5a7a8f" label={{ value: 'Concentration (μg/m³)', angle: -90, position: 'insideLeft', offset: -45, style: { textAnchor: 'middle', fontSize: 11 } }} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '2px solid #0891b2', borderRadius: '8px', fontSize: 12 }} formatter={(v, n) => [`${v} μg/m³`, n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="O3" stroke="#f5800b" strokeWidth={3} fill="url(#o3Gradient)" name="O₃ (μg/m³)" dot={{ fill: '#f5800b', stroke: '#fff', strokeWidth: 2, r: 5 }} activeDot={{ r: 7 }} />
              <Area type="monotone" dataKey="NO2" stroke="#14b8a6" strokeWidth={3} fill="url(#no2Gradient)" name="NO₂ (μg/m³)" dot={{ fill: '#14b8a6', stroke: '#fff', strokeWidth: 2, r: 5 }} activeDot={{ r: 7 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard id="yearly" title="Yearly Comparison (Last 5 Years)" icon={<TrendingUp size={16} />}>
          <ResponsiveContainer width="100%" height={CH('yearly')}>
            <BarChart data={yearlyData} margin={{ top: 25, right: 30, left: 20, bottom: 30 }} barCategoryGap="25%" barGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" />
              <XAxis dataKey="year" stroke="#5a7a8f" label={{ value: 'Year', position: 'insideBottom', offset: -15, fontSize: 11 }} tick={{ fontSize: 11 }} />
              <YAxis stroke="#5a7a8f" label={{ value: 'Average Concentration (μg/m³)', angle: -90, position: 'insideLeft', offset: -5, dy: 110, fontSize: 11 }} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '2px solid #0891b2', borderRadius: '8px', fontSize: 12 }} formatter={(v, n) => [`${v} μg/m³`, n]} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="O3" name="Avg O₃ (μg/m³)" fill="#f5800b" radius={[8, 8, 0, 0]}>
                <LabelList dataKey="O3" position="top" style={{ fontSize: 11, fill: '#f5800b', fontWeight: 700 }} />
              </Bar>
              <Bar dataKey="NO2" name="Avg NO₂ (μg/m³)" fill="#14b8a6" radius={[8, 8, 0, 0]}>
                <LabelList dataKey="NO2" position="top" style={{ fontSize: 11, fill: '#14b8a6', fontWeight: 700 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* Footer */}
      <div className="pbi-footer">
        <span>Last updated: {currentData ? new Date(currentData.timestamp).toLocaleString() : '—'}</span>
        <span>📍 {selectedSiteInfo?.name || `Site ${selectedSite}`}</span>
      </div>

      {/* Backdrop for expanded chart */}
      {expandedChart && <div className="expand-backdrop" onClick={() => setExpandedChart(null)} />}
    </div>
  );
};

export default Dashboard;