import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bell, AlertTriangle, CheckCircle, XCircle, MapPin, Clock, TrendingUp, BellOff, BellRing } from 'lucide-react';
import { useFCM } from '../hooks/useFCM';
import './AlertSystem.css';
import { API_BASE_URL} from '../config';


const NOTIF_STATES = {
  UNSUPPORTED: 'unsupported',
  DEFAULT: 'default',
  GRANTED: 'granted',
  DENIED: 'denied',
};

const AlertSystem = () => {
  const [sites, setSites] = useState([]);
  const [currentData, setCurrentData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [preferences, setPreferences] = useState({
    aqiThreshold: 100,
    enableNotifications: true,
    selectedSites: [],
    notifyOn: ['critical', 'high', 'moderate'],
  });
  const [loading, setLoading] = useState(true);
  const [notifPermission, setNotifPermission] = useState(NOTIF_STATES.DEFAULT);
  const [notifBannerDismissed, setNotifBannerDismissed] = useState(false);

  // FCM Hook
  const {
    fcmToken,
    fcmError,
    isRegistered,
    requestFCMToken,
    registerToken,
    updatePreferences: updateFCMPreferences,
    unregisterToken
  } = useFCM();

  // Load saved preferences from localStorage FIRST
  useEffect(() => {
    const saved = localStorage.getItem('alert_preferences');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPreferences(prev => ({ ...prev, ...parsed }));
        console.log('✓ Loaded preferences from localStorage', parsed);
      } catch (e) {
        console.error('Failed to load saved preferences', e);
      }
    }
  }, []);

  //Save preferences to localStorage whenever they change
  useEffect(() => {
    // Don't save if selectedSites is still empty (not loaded yet)
    if (preferences.selectedSites.length > 0) {
      localStorage.setItem('alert_preferences', JSON.stringify(preferences));
      console.log('✓ Preferences saved to localStorage');
    }
  }, [preferences]);

  //Re-register token with backend after page refresh
  useEffect(() => {
    if (fcmToken && isRegistered && preferences.selectedSites.length > 0) {
      registerToken(preferences);
    }
  }, [fcmToken, isRegistered, preferences.selectedSites.length]);

  //Check notification permission on mount
  useEffect(() => {
    if (!('Notification' in window)) {
      setNotifPermission(NOTIF_STATES.UNSUPPORTED);
    } else {
      setNotifPermission(Notification.permission);
    }
  }, []);

  // Fetch data on mount and every 5 minutes
  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 300000);
    return () => clearInterval(interval);
  }, []);

  // Generate in-app alerts when data changes
  useEffect(() => {
    generateAlerts();
  }, [currentData, preferences]);

  // Sync preference changes to backend
  useEffect(() => {
    if (isRegistered && fcmToken) {
      updateFCMPreferences(preferences);
    }
  }, [preferences.aqiThreshold, preferences.notifyOn, preferences.selectedSites]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const sitesResponse = await axios.get(`${API_BASE_URL}/sites`);
      const sitesList = sitesResponse.data.sites;
      setSites(sitesList);

      const saved = localStorage.getItem('alert_preferences');
      const savedPrefs = saved ? JSON.parse(saved) : null;
      const hasSavedSites = savedPrefs?.selectedSites?.length > 0;

      if (!hasSavedSites && preferences.selectedSites.length === 0) {
        setPreferences(prev => ({
          ...prev,
          selectedSites: sitesList.map(s => s.site_number),
        }));
      }

      const currentDataPromises = sitesList.map(site =>
        axios.get(`${API_BASE_URL}/current/${site.site_number}`).catch(() => null)
      );
      const responses = await Promise.all(currentDataPromises);
      const allCurrentData = responses.filter(Boolean).map(r => r.data);
      setCurrentData(allCurrentData);
    } catch (err) {
      console.error('Failed to load data', err);
    } finally {
      setLoading(false);
    }
  };

  // Request notification permission + FCM token
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      setNotifPermission(NOTIF_STATES.UNSUPPORTED);
      return;
    }

    // Request FCM token (this also requests browser permission)
    const token = await requestFCMToken();

    if (token) {
      setNotifPermission(NOTIF_STATES.GRANTED);

      // Register with backend
      const success = await registerToken(preferences);

      if (success) {
        // Show confirmation (browser notification)
        new Notification('Air Quality Alerts Enabled 🎉', {
          body: 'You will now receive push notifications even when this tab is closed.',
          icon: '/favicon.ico',
          tag: 'aq-welcome',
        });
      }
    } else {
      setNotifPermission(Notification.permission);
    }
  };

  // Disable notifications
  const disableNotifications = async () => {
    const success = await unregisterToken();
    if (success) {
      setPreferences(prev => ({ ...prev, enableNotifications: false }));
    }
  };

  // Generate in-app alerts (for UI display only)
  const generateAlerts = () => {
    const newAlerts = [];
    const now = new Date();

    currentData.forEach(data => {
      if (!preferences.selectedSites.includes(data.site_number)) return;

      const site = sites.find(s => s.site_number === data.site_number);
      if (!site) return;

      if (data.aqi >= preferences.aqiThreshold) {
        const type =
          data.aqi >= 200 ? 'critical' :
            data.aqi >= 150 ? 'high' :
              'moderate';

        newAlerts.push({
          id: `aqi-${data.site_number}`,
          type,
          site: site.name,
          siteNumber: data.site_number,
          title: 'High AQI Alert',
          message: `Current AQI is ${data.aqi} - ${getAQICategory(data.aqi)}`,
          timestamp: now,
          aqi: data.aqi,
          pollutants: data.pollutants,
        });
      }
    });

    newAlerts.sort((a, b) => {
      const severity = { critical: 3, high: 2, moderate: 1 };
      return severity[b.type] - severity[a.type];
    });

    setAlerts(newAlerts);
  };

  const getAQICategory = (aqi) => {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy for Sensitive';
    if (aqi <= 200) return 'Unhealthy';
    if (aqi <= 300) return 'Very Unhealthy';
    return 'Hazardous';
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'critical': return <XCircle size={24} />;
      case 'high': return <AlertTriangle size={24} />;
      case 'moderate': return <Bell size={24} />;
      default: return <CheckCircle size={24} />;
    }
  };

  const getAlertColor = (type) => {
    switch (type) {
      case 'critical': return '#DC2626';
      case 'high': return '#F59E0B';
      case 'moderate': return '#FFFF00';
      default: return '#00E400';
    }
  };

  const toggleSite = (siteNumber) => {
    setPreferences(prev => ({
      ...prev,
      selectedSites: prev.selectedSites.includes(siteNumber)
        ? prev.selectedSites.filter(s => s !== siteNumber)
        : [...prev.selectedSites, siteNumber],
    }));
  };

  const toggleNotifyOn = (level) => {
    setPreferences(prev => ({
      ...prev,
      notifyOn: prev.notifyOn.includes(level)
        ? prev.notifyOn.filter(l => l !== level)
        : [...prev.notifyOn, level],
    }));
  };

  const getHealthRecommendation = (aqi) => {
    if (aqi <= 50) return { title: 'Enjoy outdoor activities', description: 'Air quality is good. Great day for outdoor activities!' };
    if (aqi <= 100) return { title: 'Unusually sensitive people should consider limiting outdoor exertion', description: 'Air quality is acceptable for most people.' };
    if (aqi <= 150) return { title: 'Sensitive groups should reduce outdoor exertion', description: 'Children, elderly, and people with respiratory issues should limit prolonged outdoor activities.' };
    if (aqi <= 200) return { title: 'Everyone should reduce outdoor exertion', description: 'Avoid prolonged outdoor activities. Wear masks if going outside.' };
    if (aqi <= 300) return { title: 'Everyone should avoid outdoor activities', description: 'Stay indoors. Use air purifiers. Wear N95 masks if you must go outside.' };
    return { title: 'Health emergency — everyone should stay indoors', description: 'Hazardous conditions. Avoid all outdoor activities. Use air purifiers and keep windows closed.' };
  };

  // Notification banner
  const renderNotifBanner = () => {
    if (notifBannerDismissed) return null;

    if (fcmError) {
      return (
        <div className="notif-banner notif-banner--error">
          <BellOff size={20} />
          <span>FCM Error: {fcmError}</span>
          <button className="notif-banner__dismiss" onClick={() => setNotifBannerDismissed(true)}>✕</button>
        </div>
      );
    }

    if (notifPermission === NOTIF_STATES.UNSUPPORTED) {
      return (
        <div className="notif-banner notif-banner--warn">
          <BellOff size={20} />
          <span>Your browser does not support push notifications.</span>
          <button className="notif-banner__dismiss" onClick={() => setNotifBannerDismissed(true)}>✕</button>
        </div>
      );
    }

    if (notifPermission === NOTIF_STATES.DENIED) {
      return (
        <div className="notif-banner notif-banner--error">
          <BellOff size={20} />
          <span>
            Notifications are blocked. Open your browser's site settings and allow
            notifications for this page, then refresh.
          </span>
          <button className="notif-banner__dismiss" onClick={() => setNotifBannerDismissed(true)}>✕</button>
        </div>
      );
    }

    if (notifPermission === NOTIF_STATES.DEFAULT || !isRegistered) {
      return (
        <div className="notif-banner notif-banner--info">
          <BellRing size={20} />
          <span>Get real-time push alerts even when this tab is closed.</span>
          <button className="notif-banner__cta" onClick={requestNotificationPermission}>
            Enable Notifications
          </button>
          <button className="notif-banner__dismiss" onClick={() => setNotifBannerDismissed(true)}>✕</button>
        </div>
      );
    }

    return (
      <div className="notif-banner notif-banner--success">
        <Bell size={18} />
        <span>Push notifications are <strong>active</strong> (works even when tab is closed).</span>
        <button className="notif-banner__dismiss" onClick={() => setNotifBannerDismissed(true)}>✕</button>
      </div>
    );
  };

  // Notification settings
  const renderNotifSettings = () => (
    <div className="notif-settings">
      <h3 className="notif-settings__title">
        {isRegistered ? <Bell size={18} /> : <BellOff size={18} />}
        Push Notification Settings
      </h3>

      <div className="control-item">
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={isRegistered}
            onChange={async (e) => {
              if (e.target.checked) {
                await requestNotificationPermission();
              } else {
                await disableNotifications();
              }
            }}
          />
          Enable push notifications
        </label>
      </div>

      {isRegistered && (
        <div className="notif-levels">
          <p className="notif-levels__label">Notify me for:</p>
          <div className="notif-levels__grid">
            {[
              { key: 'critical', label: '🚨 Critical (AQI ≥ 200)', color: '#DC2626' },
              { key: 'high', label: '⚠️ High (AQI 150–199)', color: '#F59E0B' },
              { key: 'moderate', label: '🔔 Moderate (AQI < 150)', color: '#CA8A04' },
            ].map(({ key, label, color }) => (
              <label
                key={key}
                className={`notif-level-chip ${preferences.notifyOn.includes(key) ? 'notif-level-chip--active' : ''}`}
                style={{ '--chip-color': color }}
              >
                <input
                  type="checkbox"
                  checked={preferences.notifyOn.includes(key)}
                  onChange={() => toggleNotifyOn(key)}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Enable Now button — only show when not registered but permission exists */}
      {!isRegistered && (
        notifPermission === NOTIF_STATES.DEFAULT ||
        notifPermission === NOTIF_STATES.GRANTED
      ) && (
          <div style={{ marginTop: '10px' }}>
            <button className="notif-enable-btn" onClick={requestNotificationPermission}>
              <BellRing size={16} /> Enable Now
            </button>
          </div>
        )}
    </div>
  );
  if (loading) {
    return (
      <div className="alert-loading">
        <div className="spinner"></div>
        <p>Loading alert system...</p>
      </div>
    );
  }

  return (
    <div className="alert-system">
      {renderNotifBanner()}

      <section className="alert-header">
        <div className="container">
          <h1>Air Quality Alert System</h1>
          <p className="lead">
            Real-time notifications and health recommendations based on current pollution levels
          </p>
        </div>
      </section>

      <div className="alert-container">
        <div className="alert-summary">
          <div className="summary-card critical-card">
            <div className="summary-icon"><XCircle size={32} /></div>
            <div className="summary-content">
              <h3>{alerts.filter(a => a.type === 'critical').length}</h3>
              <p>Critical Alerts</p>
            </div>
          </div>
          <div className="summary-card high-card">
            <div className="summary-icon"><AlertTriangle size={32} /></div>
            <div className="summary-content">
              <h3>{alerts.filter(a => a.type === 'high').length}</h3>
              <p>High Priority</p>
            </div>
          </div>
          <div className="summary-card moderate-card">
            <div className="summary-icon"><Bell size={32} /></div>
            <div className="summary-content">
              <h3>{alerts.filter(a => a.type === 'moderate').length}</h3>
              <p>Moderate Alerts</p>
            </div>
          </div>
          <div className="summary-card safe-card">
            <div className="summary-icon"><CheckCircle size={32} /></div>
            <div className="summary-content">
              <h3>{currentData.length - alerts.length}</h3>
              <p>Safe Sites</p>
            </div>
          </div>
        </div>

        <div className="preferences-section">
          <h2><Bell size={24} />Alert Preferences</h2>

          <div className="preference-controls">
            <div className="control-item">
              <label htmlFor="threshold">AQI Alert Threshold</label>
              <div className="threshold-control">
                <input
                  id="threshold"
                  type="range"
                  min="50"
                  max="200"
                  step="10"
                  value={preferences.aqiThreshold}
                  onChange={e =>
                    setPreferences(prev => ({ ...prev, aqiThreshold: Number(e.target.value) }))
                  }
                />
                <span className="threshold-value">{preferences.aqiThreshold}</span>
              </div>
            </div>
          </div>

          {renderNotifSettings()}

          <div className="site-selection">
            <h3>Monitor These Sites</h3>
            <div className="site-checkboxes">
              {sites.map(site => (
                <label key={site.site_number} className="site-checkbox">
                  <input
                    type="checkbox"
                    checked={preferences.selectedSites.includes(site.site_number)}
                    onChange={() => toggleSite(site.site_number)}
                  />
                  <span>{site.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="alerts-section">
          <div className="section-header">
            <AlertTriangle size={24} />
            <h2>Active Alerts ({alerts.length})</h2>
          </div>

          {alerts.length === 0 ? (
            <div className="no-alerts">
              <CheckCircle size={48} />
              <h3>No Active Alerts</h3>
              <p>All monitored sites are within acceptable air quality levels</p>
            </div>
          ) : (
            <div className="alerts-list">
              {alerts.map(alert => {
                const recommendation = getHealthRecommendation(alert.aqi);
                return (
                  <div
                    key={alert.id}
                    className="alert-card"
                    style={{ borderLeftColor: getAlertColor(alert.type) }}
                  >
                    <div className="alert-icon" style={{ color: getAlertColor(alert.type) }}>
                      {getAlertIcon(alert.type)}
                    </div>
                    <div className="alert-content">
                      <div className="alert-header-info">
                        <h3>{alert.title}</h3>
                        <span className="alert-badge" style={{ background: getAlertColor(alert.type) }}>
                          {alert.type.toUpperCase()}
                        </span>
                      </div>
                      <div className="alert-details">
                        <p className="alert-site"><MapPin size={16} />{alert.site}</p>
                        <p className="alert-time"><Clock size={16} />{alert.timestamp.toLocaleTimeString()}</p>
                      </div>
                      <p className="alert-message">{alert.message}</p>
                      <div className="alert-recommendation">
                        <h4>Health Recommendation</h4>
                        <p className="recommendation-title">{recommendation.title}</p>
                        <p className="recommendation-desc">{recommendation.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="advisory-section">
          <h2><TrendingUp size={24} />General Health Advisory</h2>
          <div className="advisory-grid">
            {[
              { label: 'Good (0-50)', text: 'Air quality is satisfactory, and air pollution poses little or no risk. Enjoy outdoor activities!' },
              { label: 'Moderate (51-100)', text: 'Air quality is acceptable. Unusually sensitive people should consider limiting prolonged outdoor exertion.' },
              { label: 'Unhealthy for Sensitive (101-150)', text: 'Sensitive groups (children, elderly, respiratory issues) should reduce prolonged outdoor activities.' },
              { label: 'Unhealthy (151-200)', text: 'Everyone should limit outdoor exertion. Wear masks when going outside.' },
              { label: 'Very Unhealthy (201-300)', text: 'Everyone should avoid all outdoor activities. Stay indoors and use air purifiers.' },
              { label: 'Hazardous (300+)', text: 'Health emergency. Everyone should remain indoors. Use N95 masks if you must go outside.' },
            ].map(({ label, text }) => (
              <div key={label} className="advisory-card">
                <h3>{label}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertSystem;