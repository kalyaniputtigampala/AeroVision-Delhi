import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
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
  TrendingUp,
  Menu,
  X
} from 'lucide-react';
import './App.css';

function NavBar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const close = () => setMenuOpen(false);

  return (
    <nav className="navbar">
      <div className="nav-container">
        <NavLink to="/" className="logo" onClick={close}>
          <Wind size={32} />
          <span>AeroVision Delhi</span>
        </NavLink>

        {/* Hamburger button */}
        <button
          className={`nav-toggle ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle navigation"
        >
          <span />
          <span />
          <span />
        </button>

        {/* Nav links */}
        <ul className={`nav-menu ${menuOpen ? 'open' : ''}`}>
          <li><NavLink to="/" end onClick={close}><Home size={16} />Home</NavLink></li>
          <li><NavLink to="/dashboard" onClick={close}><LayoutDashboard size={16} />Dashboard</NavLink></li>
          <li><NavLink to="/forecast" onClick={close}><TrendingUp size={16} />Forecast</NavLink></li>
          <li><NavLink to="/seasonal-patterns" onClick={close}><Calendar size={16} />Seasonal</NavLink></li>
          <li><NavLink to="/weather-insights" onClick={close}><Cloud size={16} />Weather</NavLink></li>
          <li><NavLink to="/hotspot-detection" onClick={close}><MapPin size={16} />Hotspots</NavLink></li>
          <li><NavLink to="/alerts" onClick={close}><Bell size={16} />Alerts</NavLink></li>
          <li><NavLink to="/daily-tips" onClick={close}><Sun size={16} />Tips</NavLink></li>
          <li><NavLink to="/about" onClick={close}><Info size={16} />About</NavLink></li>
        </ul>
      </div>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <div className="App">
        <NavBar />

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