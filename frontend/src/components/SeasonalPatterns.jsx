import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { Calendar, TrendingUp, MapPin, Sun, Cloud, Wind, Droplets } from 'lucide-react';
import './SeasonalPatterns.css';

import { API_BASE_URL} from '../config';

const SeasonalPatterns = () => {
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(1);
  const [monthlyData, setMonthlyData] = useState([]);
  const [seasonalData, setSeasonalData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState('all');

  useEffect(() => {
    fetchSites();
  }, []);

  useEffect(() => {
    if (selectedSite) {
      fetchData();
    }
  }, [selectedSite, selectedYear]);

  const fetchSites = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/sites`);
      setSites(response.data.sites);
    } catch (err) {
      console.error('Failed to load sites', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/monthly-averages/${selectedSite}?years=5`);
      const data = response.data.monthly_averages;
      
      // Process monthly data
      setMonthlyData(processMonthlyData(data));
      
      // Process seasonal data
      setSeasonalData(processSeasonalData(data));
      
      setLoading(false);
    } catch (err) {
      console.error('Failed to load data', err);
      setLoading(false);
    }
  };

  const processMonthlyData = (data) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Group by month across all years
    const monthlyAverages = {};
    
    data.forEach(record => {
      const monthKey = record.month;
      if (!monthlyAverages[monthKey]) {
        monthlyAverages[monthKey] = { O3: [], NO2: [] };
      }
      if (record.avg_O3) monthlyAverages[monthKey].O3.push(record.avg_O3);
      if (record.avg_NO2) monthlyAverages[monthKey].NO2.push(record.avg_NO2);
    });

    // Calculate averages
    return Object.keys(monthlyAverages).map(monthNum => {
      const monthData = monthlyAverages[monthNum];
      return {
        month: months[monthNum - 1],
        monthNum: parseInt(monthNum),
        O3: monthData.O3.length ? 
          parseFloat((monthData.O3.reduce((a, b) => a + b, 0) / monthData.O3.length).toFixed(1)) : 0,
        NO2: monthData.NO2.length ? 
          parseFloat((monthData.NO2.reduce((a, b) => a + b, 0) / monthData.NO2.length).toFixed(1)) : 0
      };
    }).sort((a, b) => a.monthNum - b.monthNum);
  };

  const processSeasonalData = (data) => {
    const seasons = {
      Winter: { months: [12, 1, 2], O3: [], NO2: [] },
      Spring: { months: [3, 4, 5], O3: [], NO2: [] },
      Summer: { months: [6, 7, 8], O3: [], NO2: [] },
      Fall: { months: [9, 10, 11], O3: [], NO2: [] }
    };

    data.forEach(record => {
      Object.keys(seasons).forEach(season => {
        if (seasons[season].months.includes(record.month)) {
          if (record.avg_O3) seasons[season].O3.push(record.avg_O3);
          if (record.avg_NO2) seasons[season].NO2.push(record.avg_NO2);
        }
      });
    });

    return Object.keys(seasons).map(season => ({
      season,
      O3: seasons[season].O3.length ? 
        parseFloat((seasons[season].O3.reduce((a, b) => a + b, 0) / seasons[season].O3.length).toFixed(1)) : 0,
      NO2: seasons[season].NO2.length ? 
        parseFloat((seasons[season].NO2.reduce((a, b) => a + b, 0) / seasons[season].NO2.length).toFixed(1)) : 0
    }));
  };

  const getSeasonInfo = (season) => {
    const info = {
      Winter: { icon: <Cloud size={32} />, color: '#3b82f6', months: 'Dec - Feb' },
      Spring: { icon: <Droplets size={32} />, color: '#14b8a6', months: 'Mar - May' },
      Summer: { icon: <Sun size={32} />, color: '#f59e0b', months: 'Jun - Aug' },
      Fall: { icon: <Wind size={32} />, color: '#8b5cf6', months: 'Sep - Nov' }
    };
    return info[season];
  };

  const selectedSiteInfo = sites.find(s => s.site_number === selectedSite);

  if (loading) {
    return (
      <div className="seasonal-loading">
        <div className="spinner"></div>
        <p>Loading seasonal patterns...</p>
      </div>
    );
  }

  return (
    <div className="seasonal-patterns">
      {/* Header */}
      <section className="seasonal-header">
        <div className="container">
          <h1>Seasonal Pattern Analysis</h1>
          <p className="lead">
            Discover how air quality varies across seasons and months throughout the year
          </p>
        </div>
      </section>

      {/* Controls */}
      <div className="seasonal-container">
        <div className="seasonal-controls">
          <div className="control-group">
            <label>
              <MapPin size={20} />
              Select Location
            </label>
            <select
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
        </div>

        {/* Seasonal Overview Cards */}
        <div className="seasonal-overview">
          <h2>
            <Calendar size={24} />
            Seasonal Overview
          </h2>
          <div className="season-cards">
            {seasonalData.map((season) => {
              const info = getSeasonInfo(season.season);
              return (
                <div key={season.season} className="season-card" style={{ borderColor: info.color }}>
                  <div className="season-icon" style={{ color: info.color }}>
                    {info.icon}
                  </div>
                  <h3>{season.season}</h3>
                  <p className="season-months">{info.months}</p>
                  <div className="season-values">
                    <div className="season-value">
                      <span className="value-label">O₃ Average</span>
                      <span className="value-number" style={{ color: info.color }}>
                        {season.O3.toFixed(1)} μg/m³
                      </span>
                    </div>
                    <div className="season-value">
                      <span className="value-label">NO₂ Average</span>
                      <span className="value-number" style={{ color: info.color }}>
                        {season.NO2.toFixed(1)} μg/m³
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Monthly Trends Chart */}
        <div className="chart-section">
          <div className="section-header">
            <TrendingUp size={24} />
            <h2>Monthly Pollution Trends</h2>
          </div>
          <p className="chart-description">
            Average O₃ and NO₂ concentrations across all months (5-year average)
          </p>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" />
                <XAxis dataKey="month" stroke="#5a7a8f" />
                <YAxis stroke="#5a7a8f" label={{ value: 'Concentration (μg/m³)', angle: -90, position: 'insideLeft' }} />
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
                  dataKey="O3" 
                  stroke="#f5800b" 
                  strokeWidth={3}
                  name="O₃ (μg/m³)"
                  dot={{ fill: '#f5800b', r: 5 }}
                  activeDot={{ r: 7 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="NO2" 
                  stroke="#14b8a6" 
                  strokeWidth={3}
                  name="NO₂ (μg/m³)"
                  dot={{ fill: '#14b8a6', r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Seasonal Comparison Bar Chart */}
        <div className="chart-section">
          <div className="section-header">
            <TrendingUp size={24} />
            <h2>Seasonal Comparison</h2>
          </div>
          <p className="chart-description">
            Compare average pollution levels across different seasons
          </p>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={seasonalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" />
                <XAxis dataKey="season" stroke="#5a7a8f" />
                <YAxis stroke="#5a7a8f" label={{ value: 'Concentration (μg/m³)', angle: -90, position: 'insideLeft' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '2px solid #0891b2',
                    borderRadius: '8px' 
                  }}
                />
                <Legend />
                <Bar dataKey="O3" fill="#f5800b" name="O₃ (μg/m³)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="NO2" fill="#14b8a6" name="NO₂ (μg/m³)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Key Insights */}
        <div className="insights-section">
          <h2>Key Seasonal Insights</h2>
          <div className="insights-grid">
            <div className="insight-card">
              <h3>Peak Pollution Months</h3>
              <p>
                Winter months (December-February) typically show the highest pollution levels due to 
                temperature inversions, reduced wind speeds, and increased emissions from heating.
              </p>
            </div>
            <div className="insight-card">
              <h3>Cleaner Months</h3>
              <p>
                Monsoon season (June-September) generally experiences better air quality due to 
                rainfall washing out pollutants and increased wind circulation.
              </p>
            </div>
            <div className="insight-card">
              <h3>Ozone Patterns</h3>
              <p>
                O₃ levels peak during summer months due to higher temperatures and solar radiation, 
                which accelerate photochemical reactions in the atmosphere.
              </p>
            </div>
            <div className="insight-card">
              <h3>NO₂ Variations</h3>
              <p>
                NO₂ concentrations remain relatively stable throughout the year but spike during 
                winter due to reduced dispersion and increased vehicular emissions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeasonalPatterns;