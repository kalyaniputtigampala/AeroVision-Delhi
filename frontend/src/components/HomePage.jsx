import React from 'react';
import { Link } from 'react-router-dom';
import { Wind, TrendingUp, MapPin, Bell, CloudRain, Activity, Database, Brain } from 'lucide-react';
import './HomePage.css';

const HomePage = () => {
  const features = [
    {
      icon: <TrendingUp size={32} />,
      title: "24- 48 Hour Forecasts",
      description: "Hourly predictions for NO₂ and O₃ levels using AI-powered deep learning models"
    },
    {
      icon: <Activity size={32} />,
      title: "Real-time Dashboard",
      description: "Live monitoring across 7 sites in Delhi with interactive visualizations"
    },
    {
      icon: <MapPin size={32} />,
      title: "Multi-Site Analysis",
      description: "Track pollution levels across different geographical locations in Delhi"
    },
    {
      icon: <Bell size={32} />,
      title: "Smart Alerts",
      description: "Receive notifications when AQI level exceed safety thresholds"
    },
    {
      icon: <CloudRain size={32} />,
      title: "Weather Integration",
      description: "Meteorological data including temperature, humidity, and wind patterns and others effect o3 and no2"
    },
    {
      icon: <Brain size={32} />,
      title: "AI/ML Models",
      description: "XGBoost using different lag variables  with R² > 0.85 accuracy"
    },
    {
      icon: <Wind size={32} />,
      title: "Historical Analysis",
      description: "5-year dataset analysis revealing seasonal patterns and trends in a day"
    }
  ];


  return (
    <div className="homepage">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">
            Air Quality Forecasting
            <span className="gradient-text"> for Delhi</span>
          </h1>
          <p className="hero-subtitle">
            Advanced AI-powered hourly predictions for ground-level O₃ and NO₂ using gound level observations and reanalysis data
          </p>
          <div className="hero-buttons">
            <Link to="/dashboard" className="btn btn-primary">
              <Activity size={20} />
              View Dashboard
            </Link>
            <Link to="/about" className="btn btn-secondary">
              Learn More
            </Link>
          </div>
        </div>
        
        <div className="hero-stats">
          <div className="stat-card">
            <h3>7</h3>
            <p>Monitoring Sites</p>
          </div>
          <div className="stat-card">
            <h3>24hrs</h3>
            <p>Hourly Forecasts</p>
          </div>
          <div className="stat-card">
            <h3>5 Years</h3>
            <p>Historical Data</p>
          </div>
          <div className="stat-card">
            <h3>10+</h3>
            <p>Input Parameters</p>
          </div>
        </div>
      </section>

      {/* Problem Statement */}
      <section className="problem-section">
        <div className="container">
          <h2 className="section-title">The Challenge</h2>
          <p className="section-description">
            Air pollution in Delhi poses a critical threat to public health, with gaseous pollutants like 
            Nitrogen Dioxide (NO₂) and ground-level Ozone (O₃) frequently exceeding WHO safety thresholds. 
            This system provides accurate 24-hour forecasts at hourly intervals to enable proactive health 
            protection and pollution management.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="features-section">
        <div className="container">
          <h2 className="section-title">Features & Capabilities</h2>
          <div className="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <div className="feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <h2>Ready to Monitor Air Quality?</h2>
          <p>Access real-time forecasts and protect your health with data-driven insights</p>
          <Link to="/dashboard" className="btn btn-primary btn-large">
            <Activity size={24} />
            Explore Dashboard
          </Link>
        </div>
      </section>
    </div>
  );
};

export default HomePage;