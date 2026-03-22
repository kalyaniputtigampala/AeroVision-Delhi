import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Lightbulb, Heart, Wind, Home, Car, AlertCircle,
  ShieldCheck, Activity, Leaf, Sun, Cloud, CheckCircle, MapPin
} from 'lucide-react';
import './DailyTips.css';
import { API_BASE_URL} from '../config';



const DailyTips = () => {
  const [currentAQI, setCurrentAQI] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(1);

  useEffect(() => {
    fetchSites();
  }, []);

  useEffect(() => {
    if (selectedSite) {
      fetchCurrentAQI();
    }
  }, [selectedSite]);
  const fetchSites = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/sites`);
      setSites(res.data.sites);
    } catch (e) {
      console.error('Failed to load sites', e);
    }
  };
  const fetchCurrentAQI = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/current/${selectedSite}`);
      setCurrentAQI(res.data.aqi);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load AQI', err);
      setCurrentAQI(100);
      setLoading(false);
    }
  };

  const getAQILevel = () => {
    if (currentAQI <= 50) return 'good';
    if (currentAQI <= 100) return 'moderate';
    if (currentAQI <= 150) return 'unhealthy-sensitive';
    if (currentAQI <= 200) return 'unhealthy';
    if (currentAQI <= 300) return 'very-unhealthy';
    return 'hazardous';
  };

  const getAQICategory = () => {
    if (currentAQI <= 50) return 'Good';
    if (currentAQI <= 100) return 'Moderate';
    if (currentAQI <= 150) return 'Unhealthy for Sensitive';
    if (currentAQI <= 200) return 'Unhealthy';
    if (currentAQI <= 300) return 'Very Unhealthy';
    return 'Hazardous';
  };

  const getTipsForAQI = () => {
    const level = getAQILevel();

    const allTips = {
      health: [
        {
          level: ['good', 'moderate'],
          icon: <Heart size={24} />,
          title: 'Enjoy Outdoor Activities',
          tip: 'Air quality is acceptable. Great day for outdoor exercise, sports, and recreational activities.',
          priority: 'low'
        },
        {
          level: ['unhealthy-sensitive'],
          icon: <AlertCircle size={24} />,
          title: 'Limit Prolonged Outdoor Activities',
          tip: 'If you have respiratory issues, asthma, or heart disease, reduce prolonged or heavy outdoor exertion.',
          priority: 'medium'
        },
        {
          level: ['unhealthy', 'very-unhealthy'],
          icon: <AlertCircle size={24} />,
          title: 'Reduce Outdoor Exertion',
          tip: 'Everyone, especially children and elderly, should avoid prolonged outdoor activities. Choose indoor exercises.',
          priority: 'high'
        },
        {
          level: ['hazardous'],
          icon: <AlertCircle size={24} />,
          title: 'Stay Indoors',
          tip: 'Health emergency. Remain indoors with windows closed. Avoid all physical activities outdoors.',
          priority: 'critical'
        },
        {
          level: ['unhealthy', 'very-unhealthy', 'hazardous'],
          icon: <ShieldCheck size={24} />,
          title: 'Wear N95 Masks',
          tip: 'If you must go outside, wear properly fitted N95 or N99 masks for protection against fine particles.',
          priority: 'high'
        },
        {
          level: ['good', 'moderate'],
          icon: <Activity size={24} />,
          title: 'Stay Active',
          tip: 'Maintain your regular exercise routine. Physical activity is important for overall health.',
          priority: 'low'
        }
      ],
      home: [
        {
          level: ['good', 'moderate'],
          icon: <Wind size={24} />,
          title: 'Ventilate Your Home',
          tip: 'Open windows for 15-30 minutes to let fresh air circulate and reduce indoor pollutants.',
          priority: 'low'
        },
        {
          level: ['unhealthy-sensitive', 'unhealthy'],
          icon: <Home size={24} />,
          title: 'Keep Windows Closed',
          tip: 'Seal windows and doors to prevent outdoor pollutants from entering your home.',
          priority: 'medium'
        },
        {
          level: ['unhealthy', 'very-unhealthy', 'hazardous'],
          icon: <Wind size={24} />,
          title: 'Use Air Purifiers',
          tip: 'Run HEPA air purifiers in bedrooms and living areas. Change filters regularly for optimal performance.',
          priority: 'high'
        },
        {
          level: ['very-unhealthy', 'hazardous'],
          icon: <Home size={24} />,
          title: 'Create Clean Air Room',
          tip: 'Designate one room with air purifier as a "clean air sanctuary" where family members can retreat.',
          priority: 'high'
        },
        {
          level: ['good', 'moderate', 'unhealthy-sensitive'],
          icon: <Leaf size={24} />,
          title: 'Indoor Plants',
          tip: 'Keep air-purifying plants like snake plants, spider plants, or peace lilies to naturally filter indoor air.',
          priority: 'low'
        },
        {
          level: ['unhealthy', 'very-unhealthy', 'hazardous'],
          icon: <Home size={24} />,
          title: 'Minimize Indoor Pollution',
          tip: 'Avoid smoking, burning incense, or using harsh chemicals indoors. These add to indoor pollution.',
          priority: 'medium'
        }
      ],
      transport: [
        {
          level: ['good', 'moderate'],
          icon: <Activity size={24} />,
          title: 'Walk or Bike',
          tip: 'Choose walking or cycling for short distances. It\'s healthy and reduces vehicle emissions.',
          priority: 'low'
        },
        {
          level: ['unhealthy-sensitive', 'unhealthy'],
          icon: <Car size={24} />,
          title: 'Use AC Recirculation Mode',
          tip: 'When driving, use AC in recirculation mode to filter cabin air and reduce pollutant intake.',
          priority: 'medium'
        },
        {
          level: ['unhealthy', 'very-unhealthy'],
          icon: <Car size={24} />,
          title: 'Minimize Travel',
          tip: 'Postpone non-essential travel. If you must travel, keep car windows closed and use AC filtration.',
          priority: 'high'
        },
        {
          level: ['hazardous'],
          icon: <Car size={24} />,
          title: 'Avoid All Travel',
          tip: 'Stay home if possible. Delay all non-emergency travel until air quality improves.',
          priority: 'critical'
        },
        {
          level: ['good', 'moderate', 'unhealthy-sensitive'],
          icon: <Car size={24} />,
          title: 'Carpool or Use Public Transport',
          tip: 'Reduce emissions by sharing rides or using public transportation. Every vehicle off the road helps.',
          priority: 'low'
        },
        {
          level: ['good', 'moderate'],
          icon: <Leaf size={24} />,
          title: 'Maintain Your Vehicle',
          tip: 'Regular vehicle maintenance reduces emissions. Check tire pressure, change oil, and get emission tests.',
          priority: 'low'
        }
      ],
      prevention: [
        {
          level: ['good', 'moderate', 'unhealthy-sensitive'],
          icon: <Leaf size={24} />,
          title: 'Plant Trees',
          tip: 'Trees absorb pollutants and produce oxygen. Support or participate in tree planting initiatives.',
          priority: 'low'
        },
        {
          level: ['good', 'moderate'],
          icon: <Car size={24} />,
          title: 'Reduce Vehicle Idling',
          tip: 'Turn off your engine if stopped for more than 30 seconds. Idling wastes fuel and pollutes air.',
          priority: 'low'
        },
        {
          level: ['unhealthy', 'very-unhealthy', 'hazardous'],
          icon: <AlertCircle size={24} />,
          title: 'Report Pollution Sources',
          tip: 'Report open burning, industrial smoke, or construction dust to local authorities.',
          priority: 'medium'
        },
        {
          level: ['good', 'moderate', 'unhealthy-sensitive'],
          icon: <Home size={24} />,
          title: 'Energy Conservation',
          tip: 'Reduce energy consumption. Use LED bulbs, unplug devices, and optimize AC/heating use.',
          priority: 'low'
        },
        {
          level: ['good', 'moderate'],
          icon: <Leaf size={24} />,
          title: 'Avoid Open Burning',
          tip: 'Never burn leaves, trash, or waste. This releases harmful pollutants and worsens air quality.',
          priority: 'low'
        },
        {
          level: ['unhealthy-sensitive', 'unhealthy', 'very-unhealthy'],
          icon: <Wind size={24} />,
          title: 'Support Clean Air Policies',
          tip: 'Advocate for stricter emission standards, cleaner fuels, and better public transportation.',
          priority: 'medium'
        }
      ]
    };

    // Filter tips based on current AQI level
    const filteredTips = {};
    Object.keys(allTips).forEach(category => {
      filteredTips[category] = allTips[category].filter(tip =>
        tip.level.includes(level)
      );
    });

    return filteredTips;
  };

  const tips = getTipsForAQI();
  const categories = [
    { id: 'all', name: 'All Tips', icon: <Lightbulb size={20} /> },
    { id: 'health', name: 'Health', icon: <Heart size={20} /> },
    { id: 'home', name: 'Home', icon: <Home size={20} /> },
    { id: 'transport', name: 'Transport', icon: <Car size={20} /> },
    { id: 'prevention', name: 'Prevention', icon: <Leaf size={20} /> }
  ];

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return '#7E0023';
      case 'high': return '#FF0000';
      case 'medium': return '#FF7E00';
      default: return '#0891b2';
    }
  };

  const getFilteredTips = () => {
    if (selectedCategory === 'all') {
      return Object.entries(tips).flatMap(([category, categoryTips]) =>
        categoryTips.map(tip => ({ ...tip, category }))
      );
    }
    return tips[selectedCategory] || [];
  };

  const filteredTips = getFilteredTips();

  if (loading) {
    return (
      <div className="tips-loading">
        <div className="spinner"></div>
        <p>Loading daily tips...</p>
      </div>
    );
  }

  return (
    <div className="daily-tips">
      {/* Header */}
      <section className="tips-header">
        <div className="container">
          <h1>Daily Air Quality Tips</h1>
          <p className="lead">
            Personalized recommendations based on current air quality conditions
          </p>
        </div>
      </section>

      <div className="tips-container">
        {/* Current AQI Banner */}
        <div className="aqi-banner">
          <div className="banner-site-selector">
            <MapPin size={18} color="#0891b2" />
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
          <div className="banner-content">
            <div className="banner-icon">
              {currentAQI <= 100 ? <CheckCircle size={48} /> : <AlertCircle size={48} />}
            </div>
            <div className="banner-info">
              <h2>Today's Air Quality</h2>
              <div className="aqi-display-large">
                <span className="aqi-value">{currentAQI}</span>
                <span className="aqi-category">{getAQICategory()}</span>
              </div>
              <p className="aqi-description">
                {currentAQI <= 50 && 'Air quality is good. Enjoy outdoor activities!'}
                {currentAQI > 50 && currentAQI <= 100 && 'Air quality is acceptable for most people.'}
                {currentAQI > 100 && currentAQI <= 150 && 'Sensitive groups should take precautions.'}
                {currentAQI > 150 && currentAQI <= 200 && 'Everyone should reduce outdoor exposure.'}
                {currentAQI > 200 && currentAQI <= 300 && 'Health alert: Everyone should avoid outdoor activities.'}
                {currentAQI > 300 && 'Health emergency: Stay indoors and take all precautions.'}
              </p>
            </div>
          </div>
        </div>

        {/* Category Filter */}
        <div className="category-filter">
          <h3>Filter by Category</h3>
          <div className="filter-buttons">
            {categories.map(cat => (
              <button
                key={cat.id}
                className={`filter-btn ${selectedCategory === cat.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.icon}
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tips Grid */}
        <div className="tips-section">
          <div className="tips-section-header">
            <Lightbulb size={24} />
            <h2>
              {selectedCategory === 'all' ? 'All Recommendations' :
                categories.find(c => c.id === selectedCategory)?.name + ' Tips'}
              <span className="tip-count">({filteredTips.length})</span>
            </h2>
          </div>

          {filteredTips.length === 0 ? (
            <div className="no-tips">
              <Sun size={48} />
              <h3>No specific tips for current conditions</h3>
              <p>Air quality is good. Continue with normal activities.</p>
            </div>
          ) : (
            <div className="tips-grid">
              {filteredTips.map((tip, index) => (
                <div
                  key={index}
                  className="tip-card"
                  style={{ borderLeftColor: getPriorityColor(tip.priority) }}
                >
                  <div className="tip-icon" style={{ color: getPriorityColor(tip.priority) }}>
                    {tip.icon}
                  </div>
                  <div className="tip-content">
                    <div className="tip-header">
                      <h4>{tip.title}</h4>
                      <span
                        className="priority-badge"
                        style={{ background: getPriorityColor(tip.priority) }}
                      >
                        {tip.priority === 'critical' ? 'Critical' :
                          tip.priority === 'high' ? 'High' :
                            tip.priority === 'medium' ? 'Medium' : 'Recommended'}
                      </span>
                    </div>
                    <p>{tip.tip}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>


        {/* Emergency Contact */}
        <div className="emergency-section">
          <h2>
            <AlertCircle size={24} />
            Health Emergency Contacts
          </h2>
          <div className="emergency-cards">
            <div className="emergency-card">
              <h4>National Emergency</h4>
              <p className="emergency-number">108 / 102</p>
              <span>24/7 Ambulance Service</span>
            </div>
            <div className="emergency-card">
              <h4>Pollution Helpline</h4>
              <p className="emergency-number">011-43102030</p>
              <span>Delhi Pollution Control</span>
            </div>
            <div className="emergency-card">
              <h4>Air Quality Monitoring</h4>
              <p className="emergency-number">1800-11-0001</p>
              <span>CPCB Helpline</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyTips;