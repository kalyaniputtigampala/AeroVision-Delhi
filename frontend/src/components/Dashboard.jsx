import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Area, AreaChart,
  BarChart, Bar, LabelList, Cell
} from 'recharts';
import {
  Wind, Droplets, Thermometer,
  TrendingUp, AlertCircle, CheckCircle, MapPin
} from 'lucide-react';
import './Dashboard.css';
import { API_BASE_URL} from '../config';


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

  // Fetch all sites on mount
  useEffect(() => {
    fetchSites();
  }, []);

  // Fetch data when site OR forecast hours changes
  useEffect(() => {
    if (selectedSite) {
      fetchAllData();
    }
  }, [selectedSite, forecastHours]);

  const fetchSites = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/sites`);
      setSites(response.data.sites);
    } catch (err) {
      setError('Failed to load monitoring sites');
      console.error(err);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel
      const [current, forecast, historical, monthly] = await Promise.all([
        axios.get(`${API_BASE_URL}/current/${selectedSite}`),
        axios.get(`${API_BASE_URL}/forecast/${selectedSite}?hours=${forecastHours}`),
        axios.get(`${API_BASE_URL}/historical/${selectedSite}?days=7`),
        axios.get(`${API_BASE_URL}/monthly-averages/${selectedSite}?years=5`)
      ]);

      setCurrentData(current.data);
      // Process forecast data to add formatted time for chart
      const processedForecast = forecast.data.forecast.map(item => ({
        ...item,
        formattedTime: new Date(item.timestamp).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          hour: 'numeric'
        })
      }));

      setForecastData(processedForecast);


      // Process historical data for charts
      const processedHistorical = processHistoricalData(historical.data.data);
      setHistoricalData(processedHistorical);

      setMonthlyData(monthly.data.monthly_averages);

      // Process yearly comparison (last 5 years)
      const processedYearly = processYearlyData(monthly.data.monthly_averages);
      setYearlyData(processedYearly);

      // Process this year's monthly data
      const processedThisYear = processThisYearMonthly(monthly.data.monthly_averages);
      setThisYearMonthly(processedThisYear);

      setLoading(false);
    } catch (err) {
      setError('Failed to load data. Make sure the backend is running.');
      setLoading(false);
      console.error(err);
    }
  };

  const processHistoricalData = (data) => {
    // Group by day and take average
    const groupedByDay = {};

    data.forEach(record => {
      const date = record.timestamp.split('T')[0];
      if (!groupedByDay[date]) {
        groupedByDay[date] = { O3: [], NO2: [], date };
      }
      if (record.O3_target) groupedByDay[date].O3.push(record.O3_target);
      if (record.NO2_target) groupedByDay[date].NO2.push(record.NO2_target);
    });

    // Calculate averages
    return Object.values(groupedByDay).map(day => ({
      date: day.date,
      O3: day.O3.length ? parseFloat((day.O3.reduce((a, b) => a + b, 0) / day.O3.length).toFixed(1)) : 0,
      NO2: day.NO2.length ? parseFloat((day.NO2.reduce((a, b) => a + b, 0) / day.NO2.length).toFixed(1)) : 0
    }));
  };

  const processYearlyData = (monthlyData) => {
    // Group by year and calculate yearly averages
    const yearlyAverages = {};

    monthlyData.forEach(record => {
      const year = record.year;
      if (!yearlyAverages[year]) {
        yearlyAverages[year] = { year, O3: [], NO2: [] };
      }
      if (record.avg_O3) yearlyAverages[year].O3.push(record.avg_O3);
      if (record.avg_NO2) yearlyAverages[year].NO2.push(record.avg_NO2);
    });

    // Calculate averages and format
    return Object.values(yearlyAverages)
      .map(yearData => ({
        year: yearData.year,
        O3: yearData.O3.length ?
          parseFloat((yearData.O3.reduce((a, b) => a + b, 0) / yearData.O3.length).toFixed(1)) : 0,
        NO2: yearData.NO2.length ?
          parseFloat((yearData.NO2.reduce((a, b) => a + b, 0) / yearData.NO2.length).toFixed(1)) : 0
      }))
      .sort((a, b) => a.year - b.year);
  };

  const processThisYearMonthly = (monthlyData) => {
    // Get current year from the latest data
    const latestYear = Math.max(...monthlyData.map(d => d.year));

    // Filter this year's data and format
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

  // Helper function to safely get numeric value
  const getNumericValue = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object' && value.value !== undefined) {
      return parseFloat(value.value);
    }
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

  if (loading && !currentData) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Loading dashboard data...</p>
      </div>
    );
  }

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

  // Safely extract pollutant values
  const o3Value = currentData ? getNumericValue(currentData.pollutants?.O3) : null;
  const no2Value = currentData ? getNumericValue(currentData.pollutants?.NO2) : null;

  return (
    <div className="dashboard">
      {/* Header Section */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>Air Quality Dashboard</h1>
          <p>Real-time monitoring and forecasts for Delhi</p>
        </div>

        <div className="header-controls">
          {/* Site Selector */}
          <div className="site-selector">
            <label htmlFor="site-select">
              <MapPin size={20} />
              Select Location
            </label>
            <select
              id="site-select"
              value={selectedSite}
              onChange={(e) => setSelectedSite(Number(e.target.value))}
              className="site-dropdown"
            >
              {sites.map(site => (
                <option key={site.site_number} value={site.site_number}>
                  {site.name} - Site {site.site_number}
                </option>
              ))}
            </select>
          </div>

          {/* Forecast Hours Toggle */}
          <div className="forecast-toggle">
            <label>Forecast Range</label>
            <div className="toggle-buttons">
              <button
                className={`toggle-btn ${forecastHours === 24 ? 'active' : ''}`}
                onClick={() => setForecastHours(24)}
              >
                24 Hours
              </button>
              <button
                className={`toggle-btn ${forecastHours === 48 ? 'active' : ''}`}
                onClick={() => setForecastHours(48)}
              >
                48 Hours
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Current AQI Section */}
      {currentData && (
        <div className="current-aqi-section">
          <div className="aqi-card-large">
            <div className="aqi-header">
              <h2>Current Air Quality</h2>
              <p className="location-name">
                {selectedSiteInfo?.name || `Site ${selectedSite}`}
              </p>
            </div>

            <div className="aqi-display">
              <div
                className="aqi-circle"
                style={{
                  borderColor: getAQIColor(currentData.aqi),
                  background: `linear-gradient(135deg, ${getAQIColor(currentData.aqi)}15, ${getAQIColor(currentData.aqi)}05)`
                }}
              >
                <div className="aqi-number">{currentData.aqi}</div>
                <div className="aqi-label">AQI</div>
              </div>

              <div className="aqi-details">
                <div className="aqi-status" style={{ color: getAQIColor(currentData.aqi) }}>
                  {aqiStatus?.icon}
                  <span>{aqiStatus?.text}</span>
                </div>

                <div className="pollutant-levels">
                  <div className="pollutant">
                    <span className="pollutant-name">O₃ (Ozone)</span>
                    <span className="pollutant-value">
                      {o3Value !== null ? o3Value.toFixed(1) : 'N/A'} μg/m³
                    </span>
                  </div>
                  <div className="pollutant">
                    <span className="pollutant-name">NO₂ (Nitrogen Dioxide)</span>
                    <span className="pollutant-value">
                      {no2Value !== null ? no2Value.toFixed(1) : 'N/A'} μg/m³
                    </span>
                  </div>
                </div>

                <div className="last-updated">
                  Last updated: {new Date(currentData.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Weather Info Cards */}
          <div className="weather-cards">
            <div className="weather-card">
              <Thermometer size={24} />
              <div className="weather-info">
                <span className="weather-label">Temperature</span>
                <span className="weather-value">
                  {currentData.weather?.temperature !== null && currentData.weather?.temperature !== undefined
                    ? `${currentData.weather.temperature}°C` : 'N/A'}
                </span>
              </div>
            </div>

            <div className="weather-card">
              <Droplets size={24} />
              <div className="weather-info">
                <span className="weather-label">Humidity</span>
                <span className="weather-value">
                  {currentData.weather?.humidity ?
                    `${(currentData.weather.humidity * 100).toFixed(1)}%` : 'N/A'}
                </span>
              </div>
            </div>

            <div className="weather-card">
              <Wind size={24} />
              <div className="weather-info">
                <span className="weather-label">Wind Speed</span>
                <span className="weather-value">
                  {currentData.weather?.wind_speed !== null && currentData.weather?.wind_speed !== undefined
                    ? `${currentData.weather.wind_speed} m/s` : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 24/48-Hour Forecast Chart */}
      <div className="chart-section">
        <div className="section-header">
          <TrendingUp size={24} />
          <h2>{forecastHours}-Hour Forecast</h2>
        </div>

        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={forecastData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" />
              <XAxis
                dataKey="formattedTime"
                stroke="#5a7a8f"
                angle={-45}
                textAnchor="end"
                height={70}
              />

              <YAxis
                stroke="#5a7a8f"
                label={{ value: 'Concentration (μg/m³)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '2px solid #0891b2',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="O3_predicted"
                stroke="#f5800b"
                strokeWidth={2}
                name="O₃ Forecast"
                dot={{ fill: '#f5800b', r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="NO2_predicted"
                stroke="#14b8a6"
                strokeWidth={2}
                name="NO₂ Forecast"
                dot={{ fill: '#14b8a6', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Historical Trends - Last 7 Days */}
      <div className="chart-section">
        <div className="section-header">
          <TrendingUp size={24} />
          <h2>Historical Trends (Last 7 Days)</h2>
        </div>

        <div className="chart-container">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={historicalData}
              margin={{ top: 25, right: 30, left: 20, bottom: 20 }}
              barCategoryGap="20%"
              barGap={4}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" />
              <XAxis
                dataKey="date"
                stroke="#5a7a8f"
                tickFormatter={(date) =>
                  new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                }
              />
              <YAxis
                stroke="#5a7a8f"
                label={{ value: 'Concentration (μg/m³)', angle: -90, position: 'insideLeft', offset: -5, dy: 80 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '2px solid #0891b2',
                  borderRadius: '8px'
                }}
                formatter={(value, name) => [`${value} μg/m³`, name]}
              />
              <Legend />
              <Bar dataKey="O3" name="O₃ (μg/m³)" fill="#f5800b" radius={[6, 6, 0, 0]}>
                <LabelList
                  dataKey="O3"
                  position="top"
                  style={{ fontSize: '11px', fill: '#f5800b', fontWeight: '600' }}
                />
              </Bar>
              <Bar dataKey="NO2" name="NO₂ (μg/m³)" fill="#14b8a6" radius={[6, 6, 0, 0]}>
                <LabelList
                  dataKey="NO2"
                  position="top"
                  style={{ fontSize: '11px', fill: '#14b8a6', fontWeight: '600' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Comparison - This Year */}
      {/* Monthly Comparison - This Year */}
      <div className="chart-section">
        <div className="section-header">
          <TrendingUp size={24} />
          <h2>Monthly Comparison (This Year)</h2>
        </div>

        <div className="chart-container">
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart
              data={thisYearMonthly}
              margin={{ top: 20, right: 30, left: 60, bottom: 20 }}
            >
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
              <XAxis
                dataKey="month"
                stroke="#5a7a8f"
              />
              <YAxis
                stroke="#5a7a8f"
                label={{
                  value: 'Concentration (μg/m³)',
                  angle: -90,
                  position: 'insideLeft',
                  offset: -45,
                  style: { textAnchor: 'middle' }
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '2px solid #0891b2',
                  borderRadius: '8px'
                }}
                formatter={(value, name) => [`${value} μg/m³`, name]}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="O3"
                stroke="#f5800b"
                strokeWidth={3}
                fill="url(#o3Gradient)"
                name="O₃ (μg/m³)"
                dot={{ fill: '#f5800b', stroke: '#fff', strokeWidth: 2, r: 6 }}
                activeDot={{ r: 8, stroke: '#f5800b', strokeWidth: 2 }}
              />
              <Area
                type="monotone"
                dataKey="NO2"
                stroke="#14b8a6"
                strokeWidth={3}
                fill="url(#no2Gradient)"
                name="NO₂ (μg/m³)"
                dot={{ fill: '#14b8a6', stroke: '#fff', strokeWidth: 2, r: 6 }}
                activeDot={{ r: 8, stroke: '#14b8a6', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Yearly Comparison - Last 5 Years */}
      <div className="chart-section">
        <div className="section-header">
          <TrendingUp size={24} />
          <h2>Yearly Comparison (Last 5 Years)</h2>
        </div>

        <div className="chart-container">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={yearlyData}
              margin={{ top: 25, right: 30, left: 20, bottom: 30 }}
              barCategoryGap="25%"
              barGap={6}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" />
              <XAxis
                dataKey="year"
                stroke="#5a7a8f"
                label={{ value: 'Year', position: 'insideBottom', offset: -15 }}
              />
              <YAxis
                stroke="#5a7a8f"
                label={{ value: 'Average Concentration (μg/m³)', angle: -90, position: 'insideLeft', offset: -5, dy: 110 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '2px solid #0891b2',
                  borderRadius: '8px'
                }}
                formatter={(value, name) => [`${value} μg/m³`, name]}
              />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="O3" name="Avg O₃ (μg/m³)" fill="#f5800b" radius={[8, 8, 0, 0]}>
                <LabelList
                  dataKey="O3"
                  position="top"
                  style={{ fontSize: '12px', fill: '#f5800b', fontWeight: '700' }}
                />
              </Bar>
              <Bar dataKey="NO2" name="Avg NO₂ (μg/m³)" fill="#14b8a6" radius={[8, 8, 0, 0]}>
                <LabelList
                  dataKey="NO2"
                  position="top"
                  style={{ fontSize: '12px', fill: '#14b8a6', fontWeight: '700' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="dashboard-actions">
        <button onClick={fetchAllData} className="refresh-btn" disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>
    </div>
  );
};

export default Dashboard;