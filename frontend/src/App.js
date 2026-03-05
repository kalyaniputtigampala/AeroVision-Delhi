import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import HomePage from './components/HomePage';
import AboutPage from './components/AboutPage';
import Dashboard from './components/Dashboard';
import SeasonalPatterns from './components/SeasonalPatterns';
import HotspotDetection from './components/HotspotDetection';
import AlertSystem from './components/AlertSystem';
import WeatherInsights from './components/WeatherInsights';
import ForecastPage from './components/ForecastPage';
import DailyTips from './components/DailyTips';
import {
  Wind, Home,
  LayoutDashboard,
  Calendar,
  MapPin,
  Bell,
  Cloud,
  Info,
  Sun,
  TrendingUp
} from 'lucide-react';
import './App.css';



function App() {

  return (
    <Router>
      <div className="App">
        {/* Navigation Bar */}
        <nav className="navbar">
          <div className="nav-container">
            <NavLink to="/" className="logo">
              <Wind size={32} />
              <span>AeroVision Delhi</span>
            </NavLink>
            <ul className="nav-menu">
              <li>
                <NavLink to="/" end>
                  <Home size={16} />
                  Home
                </NavLink>
              </li>

              <li>
                <NavLink to="/dashboard">
                  <LayoutDashboard size={16} />
                  Dashboard
                </NavLink>
              </li>
              <li>
                <NavLink to="/forecast">
                  <TrendingUp size={16} />
                  Forecast
                </NavLink>
              </li>

              <li>
                <NavLink to="/seasonal-patterns">
                  <Calendar size={16} />
                  Seasonal
                </NavLink>
              </li>

              <li>
                <NavLink to="/weather-insights">
                  <Cloud size={16} />
                  Weather
                </NavLink>
              </li>
              <li>
                <NavLink to="/hotspot-detection">
                  <MapPin size={16} />
                  Hotspots
                </NavLink>
              </li>


              <li>
                <NavLink to="/alerts">
                  <Bell size={16} />
                  Alerts
                </NavLink>
              </li>

              <li>
                <NavLink to="/daily-tips">
                  <Sun size={16} />
                  Tips
                </NavLink>
              </li>

              <li>
                <NavLink to="/about">
                  <Info size={16} />
                  About
                </NavLink>
              </li>
            </ul>

          </div>
        </nav>

        {/* Routes */}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/seasonal-patterns" element={<SeasonalPatterns />} />
          <Route path="/forecast" element={<ForecastPage />} />
          <Route path="/hotspot-detection" element={<HotspotDetection />} />
          <Route path="/alerts" element={<AlertSystem />} />
          <Route path="/weather-insights" element={<WeatherInsights />} />
          <Route path="/daily-tips" element={<DailyTips />} />
        </Routes>

        {/* Footer */}
        <footer className="footer">
          <div className="footer-container">

            <div className="footer-section">
              <h4>AirQ Forecast</h4>
              <p>AI-powered air quality forecasting for Delhi using XGBoost ML models predicting O₃ and NO₂ up to 48 hours ahead.</p>
            </div>

            <div className="footer-section">
              <h4>Quick Links</h4>
              <ul>
                <li><NavLink to="/">Home</NavLink></li>
                <li><NavLink to="/dashboard">Dashboard</NavLink></li>
                <li><NavLink to="/forecast">Forecast</NavLink></li>
                <li><NavLink to="/weather-insights">Weather</NavLink></li>
                <li><NavLink to="/alerts">Alerts</NavLink></li>
                <li><NavLink to="/about">About</NavLink></li>
              </ul>
            </div>

            <div className="footer-section">
              <h4>Data Sources</h4>
              <ul>
                <li><a href="https://aqicn.org" target="_blank" rel="noreferrer">WAQI Air Quality API</a></li>
                <li><a href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo Weather API</a></li>
                <li><a href="https://openweathermap.org" target="_blank" rel="noreferrer">OpenWeatherMap API</a></li>
              </ul>
            </div>

          </div>

          <div className="footer-bottom">
            <p>&copy; 2025 AirQ Forecast &nbsp;·&nbsp; Built for SIH 2025 &nbsp;·&nbsp; Data from Open-Meteo & WAQI</p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;