import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  MapContainer,
  TileLayer,
  Marker,
  Tooltip,
  useMap
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import {
  AlertTriangle,
  MapPin,
  TrendingUp
} from "lucide-react";
import "./HotspotDetection.css";
import { API_BASE_URL, getAQIColor, getAQILabel } from '../config';
const AUTO_REFRESH_MINUTES = 5;





const getHotspotLevel = (aqi) => {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy (Sensitive)";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
};

/* ================= MAP UTILS ================= */

const HeatmapLayer = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;

    const layer = L.heatLayer(points, {
      radius: 30,
      blur: 25,
      maxZoom: 12,
    }).addTo(map);

    return () => map.removeLayer(layer);
  }, [points, map]);

  return null;
};

const FixResize = () => {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 300);
  }, [map]);
  return null;
};

/* ================= AQI BOARD ICON ================= */

const createAQIBoardIcon = (aqi) =>
  L.divIcon({
    className: "",
    html: `
      <div class="aqi-board" style="background:${getAQIColor(aqi)}">
        ${aqi}
      </div>
    `,
    iconSize: [50, 28],
    iconAnchor: [25, 14],
  });

/* ================= MAIN ================= */

const HotspotDetection = () => {
  const mapRef = useRef(null);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSites();
    const interval = setInterval(fetchSites, AUTO_REFRESH_MINUTES * 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchSites = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/sites`);

      const enriched = await Promise.all(
        res.data.sites.map(async (s) => {
          const cur = await axios.get(`${API_BASE_URL}/current/${s.site_number}`);
          return { ...s, aqi: cur.data.aqi };
        })
      );

      setSites(enriched);
      setLoading(false);
    } catch (err) {
      console.error("AQI fetch failed", err);
    }
  };

  /* ===== Rankings ===== */

  const rankedSites = [...sites]
    .sort((a, b) => b.aqi - a.aqi)
    .map((site, index) => ({ ...site, rank: index + 1 }));

  const centerMapOnSite = (site) => {
    if (!mapRef.current) return;
    mapRef.current.setView(
      [site.latitude, site.longitude],
      14,
      { animate: false }
    );
  };

  const heatPoints = sites.map((s) => [
    s.latitude,
    s.longitude,
    s.aqi / 300,
  ]);

  return (
    <div className="hotspot-detection">
      <div className="hotspot-header">
        <h2>Delhi AQI Hotspot Detection</h2>
        <p>Live monitoring • WAQI overlay • Heatmap</p>
      </div>


<div className="content-80">
      {/* ================= MAP ================= */}
      <div className="map-container">
        <MapContainer
          center={[28.6139, 77.209]}
          zoom={11}
          scrollWheelZoom
          className="leaflet-map"
          whenCreated={(map) => (mapRef.current = map)}
        >
          {/* LIGHT MAP — NOT BLACK */}
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap contributors"
          />

          <FixResize />
          <HeatmapLayer points={heatPoints} />

          {sites.map((site) => (
            <Marker
              key={site.site_number}
              position={[site.latitude, site.longitude]}
              icon={createAQIBoardIcon(site.aqi)}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                <strong>{site.name}</strong>
                <br />
                AQI: {site.aqi}
                <br />
                {getHotspotLevel(site.aqi)}
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* ================= RANKINGS ================= */}
      <div className="rankings-section">
        <div className="section-header">
          <AlertTriangle size={24} />
          <h2>Hotspot Rankings</h2>
        </div>



        <div className="rankings-list">
          {rankedSites.map((site) => (
            <div
              key={site.site_number}
              className="ranking-card"
              style={{ borderLeftColor: getAQIColor(site.aqi) }}
              onClick={() => centerMapOnSite(site)}
            >
              <div
                className="rank-number"
                style={{ background: getAQIColor(site.aqi) }}
              >
                #{site.rank}
              </div>

              <div className="rank-info">
                <h4>{site.name}</h4>
                <p className="rank-coords">
                  {site.latitude.toFixed(4)}°N,{" "}
                  {site.longitude.toFixed(4)}°E
                </p>
              </div>

              <div className="rank-metrics">
                <div className="metric">
                  <span className="metric-label">AQI</span>
                  <span
                    className="metric-value"
                    style={{ color: getAQIColor(site.aqi) }}
                  >
                    {site.aqi}
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label">Level</span>
                  <span className="metric-value">
                    {getHotspotLevel(site.aqi)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ================= STATS ================= */}
      <div className="stats-overview">
        <h2>
          <TrendingUp size={22} />
          Current Statistics
        </h2>

        <div className="stats-grid">
          <div className="stat-card critical-stat">
            <h3>{rankedSites.filter(s => s.aqi > 200).length}</h3>
            <p>Critical Hotspots</p>
            <span>AQI &gt; 200</span>
          </div>

          <div className="stat-card high-stat">
            <h3>{rankedSites.filter(s => s.aqi > 150 && s.aqi <= 200).length}</h3>
            <p>High Alert</p>
            <span>AQI 151–200</span>
          </div>

          <div className="stat-card moderate-stat">
            <h3>{rankedSites.filter(s => s.aqi > 100 && s.aqi <= 150).length}</h3>
            <p>Moderate</p>
            <span>AQI 101–150</span>
          </div>

          <div className="stat-card safe-stat">
            <h3>{rankedSites.filter(s => s.aqi <= 100).length}</h3>
            <p>Safe</p>
            <span>AQI ≤ 100</span>
          </div>
        </div>
      </div>
      </div>

      {loading && <div className="map-loading">Loading live AQI data…</div>}
    </div>
  );
};

export default HotspotDetection;
