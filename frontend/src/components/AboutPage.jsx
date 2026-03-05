import React from 'react';
import { Database, Cpu, Satellite, TrendingUp, MapPin, Target } from 'lucide-react';
import './AboutPage.css';

const AboutPage = () => {
  return (
    <div className="about-page">
      {/* Header Section */}
      <section className="about-header">
        <div className="container">
          <h1>About Air Quality Forecasting System</h1>
          <p className="lead">
            Advanced AI/ML-based platform for 24-hour hourly forecasting of ground-level O₃ and NO₂
            in Delhi using past ground-level observations and reanalysis data
          </p>
        </div>
      </section>

      {/* Objective Section */}
      <section className="about-section objective-section">
        <div className="container">
          <h2>Project Objective</h2>
          <div className="objective-card">
            <Target size={48} />
            <h3>Forecast ground-level O₃ and NO₂ for 24-hour at hourly interval for Delhi</h3>
            <p>
              Develop accurate predictive models using 5 years of historical data
              across 7 monitoring sites in Delhi to enable proactive health protection and pollution management.
            </p>
          </div>
        </div>
      </section>

      {/* Background Section */}
      <section className="about-section">
        <div className="container">
          <h2>Background</h2>
          <p>
            Air pollution in rapidly urbanizing megacities such as Delhi poses a persistent threat
            to public health, with gaseous pollutants like Nitrogen Dioxide (NO₂) and ground-level
            Ozone (O₃) frequently surpassing global safety air quality thresholds.
          </p>
          <p>
            This challenge demands high-resolution, temporally consistent air quality datasets that
            can drive accurate forecasting. Our system integrates satellite observations with
            meteorological reanalysis data to provide hourly forecasts, enabling citizens and
            policymakers to make informed decisions.
          </p>
        </div>
      </section>

      {/* Monitoring Sites */}
      <section className="about-section sites-detail-section">
        <div className="container">
          <h2>Monitoring Sites in Delhi NCR</h2>
          <p className="section-description">
            7 strategically located monitoring stations covering different geographical zones of Delhi
          </p>
          <div className="sites-detail-grid">
            <div className="site-detail-card">
              <div className="site-header">
                <MapPin size={24} />
                <span className="site-id">Site 1</span>
              </div>
              <h4>North Delhi</h4>
              <div className="coordinates">
                <span>28.695°N</span>
                <span>77.182°E</span>
              </div>
            </div>
            <div className="site-detail-card">
              <div className="site-header">
                <MapPin size={24} />
                <span className="site-id">Site 2</span>
              </div>
              <h4>West Delhi</h4>
              <div className="coordinates">
                <span>28.572°N</span>
                <span>77.071°E</span>
              </div>
            </div>
            <div className="site-detail-card">
              <div className="site-header">
                <MapPin size={24} />
                <span className="site-id">Site 3</span>
              </div>
              <h4>South Delhi</h4>
              <div className="coordinates">
                <span>28.583°N</span>
                <span>77.234°E</span>
              </div>
            </div>
            <div className="site-detail-card">
              <div className="site-header">
                <MapPin size={24} />
                <span className="site-id">Site 4</span>
              </div>
              <h4>North-West Delhi</h4>
              <div className="coordinates">
                <span>28.823°N</span>
                <span>77.102°E</span>
              </div>
            </div>
            <div className="site-detail-card">
              <div className="site-header">
                <MapPin size={24} />
                <span className="site-id">Site 5</span>
              </div>
              <h4>South-East Delhi</h4>
              <div className="coordinates">
                <span>28.531°N</span>
                <span>77.271°E</span>
              </div>
            </div>
            <div className="site-detail-card">
              <div className="site-header">
                <MapPin size={24} />
                <span className="site-id">Site 6</span>
              </div>
              <h4>Central Delhi</h4>
              <div className="coordinates">
                <span>28.730°N</span>
                <span>77.096°E</span>
              </div>
            </div>
            <div className="site-detail-card">
              <div className="site-header">
                <MapPin size={24} />
                <span className="site-id">Site 7</span>
              </div>
              <h4>East Delhi</h4>
              <div className="coordinates">
                <span>28.711°N</span>
                <span>77.250°E</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Methodology Section */}
      <section className="about-section methodology-section">
        <div className="container">
          <h2>Our Methodology</h2>
          <div className="methodology-grid">
            <div className="methodology-card">
              <div className="method-icon">
                <Database size={40} />
              </div>
              <h3>Data Collection</h3>
              <p>
                171,679 hourly records across 7 Delhi monitoring sites.
                 Each record contains meteorological forecasts (T, q, u, v, w)
                and measured O₃ and NO₂ ground-truth targets.
              </p>
            </div>

            <div className="methodology-card">
              <div className="method-icon">
                <Satellite size={40} />
              </div>
              <h3>Feature Engineering</h3>
              <p>
                22 input features including cyclical time encodings (hourly, weekly, yearly),
                lag values at 1h, 6h, and 24h, 24-hour rolling averages, and meteorological
                forecast variables. Train/test split as 155,232 train, 15,943 test rows.
              </p>
            </div>

            <div className="methodology-card">
              <div className="method-icon">
                <Cpu size={40} />
              </div>
              <h3>XGBoost Forecasting</h3>
              <p>
                Separate XGBoost regressors trained for O₃ and NO₂ across 9 forecast horizons
                (1h to 48h). Each model uses 400 estimators, depth 5, learning rate 0.05,
                with 90% subsampling — 18 models total with a shared StandardScaler.
              </p>
            </div>

            <div className="methodology-card">
              <div className="method-icon">
                <TrendingUp size={40} />
              </div>
              <h3>Model Performance</h3>
              <p>
                O₃ achieves R² of 0.882 at 1-hour horizon, maintaining 0.697 at 48 hours.
                NO₂ reaches R² of 0.718 at 1 hour. Models evaluated on held-out data
                using MAE, RMSE, and R² metrics.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Impact Section */}
      <section className="about-section impact-section">
        <div className="container">
          <h2>Expected Impact</h2>
          <div className="impact-grid">
            <div className="impact-card">
              <h4>Public Health</h4>
              <p>Enable citizens to plan activities and protect vulnerable populations from high pollution events</p>
            </div>
            <div className="impact-card">
              <h4>Policy Making</h4>
              <p>Support evidence-based decisions for traffic control, industrial regulations, and emergency protocols</p>
            </div>
            <div className="impact-card">
              <h4>Urban Planning</h4>
              <p>Identify pollution hotspots for infrastructure development and green space allocation</p>
            </div>
            <div className="impact-card">
              <h4>Research Advancement</h4>
              <p>Contribute to understanding pollution dynamics and climate-air quality interactions in megacities</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;