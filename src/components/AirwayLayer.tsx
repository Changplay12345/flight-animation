import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useFlightStore } from '../store/flightStore';

interface AirwayFeature {
  type: string;
  properties: {
    route_identifier: string;
    waypoint_identifier: string;
    waypoint_identifier_2: string;
    outbound_course?: number;
  };
  geometry: {
    type: string;
    coordinates: number[][][];
  };
}

interface VorFeature {
  type: string;
  properties: {
    waypoint_identifier: string;
  };
  geometry: {
    type: string;
    coordinates: number[][];
  };
}

interface ReportingFeature {
  type: string;
  properties: {
    waypoint_identifier: string;
  };
  geometry: {
    type: string;
    coordinates: number[][];
  };
}

interface AirwayGeoJSON {
  type: string;
  features: AirwayFeature[];
}

interface VorGeoJSON {
  type: string;
  features: VorFeature[];
}

interface ReportingGeoJSON {
  type: string;
  features: ReportingFeature[];
}

export function AirwayLayer() {
  const map = useMap();
  const airwaysVisible = useFlightStore(state => state.airwaysVisible);
  const lightMode = useFlightStore(state => state.lightMode);
  const satelliteMode = useFlightStore(state => state.satelliteMode);
  const airwayOpacity = useFlightStore(state => state.airwayOpacity);
  const airwayLabelsVisible = useFlightStore(state => state.airwayLabelsVisible);
  const airwayVorVisible = useFlightStore(state => state.airwayVorVisible);
  const airwayReportingVisible = useFlightStore(state => state.airwayReportingVisible);
  
  const airwayLayersRef = useRef<L.Layer[]>([]);
  const labelLayersRef = useRef<L.Marker[]>([]);
  const vorLayersRef = useRef<L.Marker[]>([]);
  const reportingLayersRef = useRef<L.Marker[]>([]);
  
  const [geojsonData, setGeojsonData] = useState<AirwayGeoJSON | null>(null);
  const [vorData, setVorData] = useState<VorGeoJSON | null>(null);
  const [reportingData, setReportingData] = useState<ReportingGeoJSON | null>(null);

  // Load GeoJSON data once
  useEffect(() => {
    fetch('/airways/airwaysegment.geojson')
      .then(res => res.json())
      .then(data => setGeojsonData(data))
      .catch(err => console.error('Failed to load airway segments:', err));
      
    fetch('/airways/airway_vor.geojson')
      .then(res => res.json())
      .then(data => setVorData(data))
      .catch(err => console.error('Failed to load airway VOR:', err));
      
    fetch('/airways/airways_reporting.geojson')
      .then(res => res.json())
      .then(data => setReportingData(data))
      .catch(err => console.error('Failed to load airways reporting:', err));
  }, []);

  // Create custom panes
  useEffect(() => {
    if (!map.getPane('airwayPane')) {
      map.createPane('airwayPane');
      const pane = map.getPane('airwayPane');
      if (pane) pane.style.zIndex = '350';
    }
    if (!map.getPane('airwayLabelPane')) {
      map.createPane('airwayLabelPane');
      const pane = map.getPane('airwayLabelPane');
      if (pane) pane.style.zIndex = '351';
    }
    if (!map.getPane('airwayVorPane')) {
      map.createPane('airwayVorPane');
      const pane = map.getPane('airwayVorPane');
      if (pane) pane.style.zIndex = '352';
    }
    if (!map.getPane('airwayReportingPane')) {
      map.createPane('airwayReportingPane');
      const pane = map.getPane('airwayReportingPane');
      if (pane) pane.style.zIndex = '353';
    }
  }, [map]);

  // Calculate angle between two points
  const calculateAngle = (lon1: number, lat1: number, lon2: number, lat2: number): number => {
    const dx = lon2 - lon1;
    const dy = lat2 - lat1;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    // Adjust so text reads left-to-right
    if (angle > 90) angle -= 180;
    if (angle < -90) angle += 180;
    return angle;
  };

  // Render airways
  useEffect(() => {
    airwayLayersRef.current.forEach(layer => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    });
    airwayLayersRef.current = [];

    if (!airwaysVisible || !geojsonData) return;

    const color = lightMode ? '#0d47a1' : (satelliteMode ? '#00ff88' : '#00d9ff');

    geojsonData.features.forEach((feature) => {
      if (feature.geometry.type === 'MultiLineString') {
        feature.geometry.coordinates.forEach((lineCoords) => {
          const latlngs: [number, number][] = lineCoords.map(coord => [coord[1], coord[0]]);
          
          const polyline = L.polyline(latlngs, {
            color,
            weight: 0.8,
            opacity: airwayOpacity,
            pane: 'airwayPane',
          });
          
          polyline.addTo(map);
          airwayLayersRef.current.push(polyline);
        });
      }
    });

    return () => {
      airwayLayersRef.current.forEach(layer => {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      });
    };
  }, [airwaysVisible, lightMode, satelliteMode, map, geojsonData, airwayOpacity]);

  // Render airway labels (route_identifier like L507)
  useEffect(() => {
    labelLayersRef.current.forEach(layer => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    });
    labelLayersRef.current = [];

    if (!airwaysVisible || !airwayLabelsVisible || !geojsonData) return;

    const textColor = lightMode ? '#0d47a1' : '#00d9ff';
    const bgColor = lightMode ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)';
    
    // Group segments by route_identifier to avoid duplicate labels
    const routeSegments: Record<string, { coords: number[][]; angle: number }[]> = {};
    
    geojsonData.features.forEach((feature) => {
      const routeId = feature.properties.route_identifier;
      if (!routeId) return;
      
      if (feature.geometry.type === 'MultiLineString') {
        feature.geometry.coordinates.forEach((lineCoords) => {
          if (lineCoords.length >= 2) {
            const [lon1, lat1] = lineCoords[0];
            const [lon2, lat2] = lineCoords[lineCoords.length - 1];
            const angle = calculateAngle(lon1, lat1, lon2, lat2);
            
            if (!routeSegments[routeId]) routeSegments[routeId] = [];
            routeSegments[routeId].push({ coords: lineCoords, angle });
          }
        });
      }
    });

    // Place one label per route at the middle segment
    Object.entries(routeSegments).forEach(([routeId, segments]) => {
      if (segments.length === 0) return;
      
      // Pick middle segment
      const midIdx = Math.floor(segments.length / 2);
      const segment = segments[midIdx];
      const coords = segment.coords;
      
      // Get midpoint of segment
      const midPointIdx = Math.floor(coords.length / 2);
      const [lon, lat] = coords[midPointIdx] || coords[0];
      const angle = segment.angle;
      
      const icon = L.divIcon({
        className: 'airway-label',
        html: `<div style="
          transform: rotate(${angle}deg) translateY(-12px);
          transform-origin: center center;
          font-size: 9px;
          font-weight: 600;
          color: ${textColor};
          background: ${bgColor};
          padding: 1px 4px;
          border-radius: 2px;
          white-space: nowrap;
          pointer-events: none;
          text-align: center;
        ">${routeId}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      
      const marker = L.marker([lat, lon], { 
        icon, 
        interactive: false,
        pane: 'airwayLabelPane'
      });
      marker.addTo(map);
      labelLayersRef.current.push(marker);
    });

    return () => {
      labelLayersRef.current.forEach(layer => {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      });
    };
  }, [airwaysVisible, airwayLabelsVisible, lightMode, map, geojsonData]);

  // Render VOR markers
  useEffect(() => {
    vorLayersRef.current.forEach(layer => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    });
    vorLayersRef.current = [];

    if (!airwaysVisible || !airwayVorVisible || !vorData) return;

    const textColor = lightMode ? '#1565c0' : '#4fc3f7';
    const borderColor = lightMode ? '#1565c0' : '#4fc3f7';
    const bgColor = lightMode ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)';

    // Thailand bounds: lat 5.5-20.5, lon 97.5-106
    const isInThailand = (lon: number, lat: number) => 
      lat >= 5.5 && lat <= 20.5 && lon >= 97.5 && lon <= 106;

    vorData.features.forEach((feature) => {
      const name = feature.properties.waypoint_identifier;
      if (!name) return;
      
      if (feature.geometry.type === 'MultiPoint') {
        feature.geometry.coordinates.forEach((coord) => {
          const [lon, lat] = coord;
          if (!isInThailand(lon, lat)) return;
          
          // VOR symbol: hexagon with dot
          const icon = L.divIcon({
            className: 'airway-vor',
            html: `<div style="
              display: flex;
              flex-direction: column;
              align-items: center;
              pointer-events: none;
            ">
              <div style="
                width: 12px;
                height: 12px;
                background: ${bgColor};
                border: 2px solid ${borderColor};
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
              ">
                <div style="
                  width: 4px;
                  height: 4px;
                  background: ${borderColor};
                  border-radius: 50%;
                "></div>
              </div>
              <div style="
                font-size: 8px;
                font-weight: 600;
                color: ${textColor};
                margin-top: 2px;
                white-space: nowrap;
                text-shadow: -1px -1px 0 ${lightMode ? '#fff' : '#000'}, 1px -1px 0 ${lightMode ? '#fff' : '#000'}, -1px 1px 0 ${lightMode ? '#fff' : '#000'}, 1px 1px 0 ${lightMode ? '#fff' : '#000'}, 0 0 3px ${lightMode ? '#fff' : '#000'};
              ">${name}</div>
            </div>`,
            iconSize: [0, 0],
            iconAnchor: [6, 6],
          });
          
          const marker = L.marker([lat, lon], { 
            icon, 
            interactive: false,
            pane: 'airwayVorPane'
          });
          marker.addTo(map);
          vorLayersRef.current.push(marker);
        });
      }
    });

    return () => {
      vorLayersRef.current.forEach(layer => {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      });
    };
  }, [airwaysVisible, airwayVorVisible, lightMode, map, vorData]);

  // Render Reporting Points (triangles with fixed text size)
  useEffect(() => {
    reportingLayersRef.current.forEach(layer => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    });
    reportingLayersRef.current = [];

    if (!airwaysVisible || !airwayReportingVisible || !reportingData) return;

    const textColor = lightMode ? '#6a1b9a' : '#ce93d8';
    const triangleColor = lightMode ? '#6a1b9a' : '#ce93d8';

    // Thailand bounds: lat 5.5-20.5, lon 97.5-106
    const isInThailand = (lon: number, lat: number) => 
      lat >= 5.5 && lat <= 20.5 && lon >= 97.5 && lon <= 106;

    reportingData.features.forEach((feature) => {
      const name = feature.properties.waypoint_identifier;
      if (!name) return;
      
      if (feature.geometry.type === 'MultiPoint') {
        feature.geometry.coordinates.forEach((coord) => {
          const [lon, lat] = coord;
          if (!isInThailand(lon, lat)) return;
          
          // Triangle symbol pointing up
          const icon = L.divIcon({
            className: 'airway-reporting',
            html: `<div style="
              display: flex;
              flex-direction: column;
              align-items: center;
              pointer-events: none;
            ">
              <div style="
                width: 0;
                height: 0;
                border-left: 6px solid transparent;
                border-right: 6px solid transparent;
                border-bottom: 10px solid ${triangleColor};
              "></div>
              <div style="
                font-size: 8px;
                font-weight: 600;
                color: ${textColor};
                margin-top: 2px;
                white-space: nowrap;
                text-shadow: -1px -1px 0 ${lightMode ? '#fff' : '#000'}, 1px -1px 0 ${lightMode ? '#fff' : '#000'}, -1px 1px 0 ${lightMode ? '#fff' : '#000'}, 1px 1px 0 ${lightMode ? '#fff' : '#000'}, 0 0 3px ${lightMode ? '#fff' : '#000'};
              ">${name}</div>
            </div>`,
            iconSize: [0, 0],
            iconAnchor: [6, 5],
          });
          
          const marker = L.marker([lat, lon], { 
            icon, 
            interactive: false,
            pane: 'airwayReportingPane'
          });
          marker.addTo(map);
          reportingLayersRef.current.push(marker);
        });
      }
    });

    return () => {
      reportingLayersRef.current.forEach(layer => {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      });
    };
  }, [airwaysVisible, airwayReportingVisible, lightMode, map, reportingData]);

  return null;
}
