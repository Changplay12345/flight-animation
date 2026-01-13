import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useFlightStore } from '../store/flightStore';

interface SidLineFeature {
  type: string;
  properties: {
    procedure_identifier: string;
    airport_identifier: string;
    transition_identifier: string;
  };
  geometry: {
    type: string;
    coordinates: number[][][];
  };
}

interface SidWaypointFeature {
  type: string;
  properties: {
    waypoint_identifier: string;
    altitude_description: string | null;
    altitude1: number | null;
    altitude2: number | null;
  };
  geometry: {
    type: string;
    coordinates: number[][];
  };
}

interface SidLineGeoJSON {
  type: string;
  features: SidLineFeature[];
}

interface SidWaypointGeoJSON {
  type: string;
  features: SidWaypointFeature[];
}

// Thailand bounds
const isInThailand = (lon: number, lat: number) => 
  lat >= 5.5 && lat <= 20.5 && lon >= 97.5 && lon <= 106;

export function SidLayer() {
  const map = useMap();
  const sidVisible = useFlightStore(state => state.sidVisible);
  const sidWaypointsVisible = useFlightStore(state => state.sidWaypointsVisible);
  const sidOpacity = useFlightStore(state => state.sidOpacity);
  const lightMode = useFlightStore(state => state.lightMode);
  
  const lineLayersRef = useRef<L.Layer[]>([]);
  const waypointLayersRef = useRef<L.Marker[]>([]);
  
  const [lineData, setLineData] = useState<SidLineGeoJSON | null>(null);
  const [waypointData, setWaypointData] = useState<SidWaypointGeoJSON | null>(null);

  // Load GeoJSON data once
  useEffect(() => {
    fetch('/sidline.geojson')
      .then(res => res.json())
      .then(data => setLineData(data))
      .catch(err => console.error('Failed to load SID lines:', err));
      
    fetch('/sod_waypoint.geojson')
      .then(res => res.json())
      .then(data => setWaypointData(data))
      .catch(err => console.error('Failed to load SID waypoints:', err));
  }, []);

  // Create custom panes
  useEffect(() => {
    if (!map.getPane('sidLinePane')) {
      map.createPane('sidLinePane');
      const pane = map.getPane('sidLinePane');
      if (pane) pane.style.zIndex = '360';
    }
    if (!map.getPane('sidWaypointPane')) {
      map.createPane('sidWaypointPane');
      const pane = map.getPane('sidWaypointPane');
      if (pane) pane.style.zIndex = '361';
    }
  }, [map]);

  // Render SID lines (pink/red polylines with glow)
  useEffect(() => {
    lineLayersRef.current.forEach(layer => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    });
    lineLayersRef.current = [];

    if (!sidVisible || !lineData) return;

    const lineColor = lightMode ? '#c2185b' : '#ff4081';

    lineData.features.forEach((feature) => {
      if (feature.geometry.type === 'MultiLineString') {
        feature.geometry.coordinates.forEach((lineCoords) => {
          // Check if any point is in Thailand
          const hasThailandPoint = lineCoords.some(coord => isInThailand(coord[0], coord[1]));
          if (!hasThailandPoint) return;

          const latlngs: [number, number][] = lineCoords.map(coord => [coord[1], coord[0]]);
          
          // Glow effect - wider, more transparent line behind
          const glowLine = L.polyline(latlngs, {
            color: lineColor,
            weight: 4,
            opacity: sidOpacity * 0.3,
            pane: 'sidLinePane',
          });
          glowLine.addTo(map);
          lineLayersRef.current.push(glowLine);
          
          // Main line
          const polyline = L.polyline(latlngs, {
            color: lineColor,
            weight: 1.5,
            opacity: sidOpacity,
            pane: 'sidLinePane',
          });
          polyline.addTo(map);
          lineLayersRef.current.push(polyline);
        });
      }
    });

    return () => {
      lineLayersRef.current.forEach(layer => {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      });
    };
  }, [sidVisible, lightMode, map, lineData, sidOpacity]);

  // Render SID waypoints (yellow 4-point star with labels)
  useEffect(() => {
    waypointLayersRef.current.forEach(layer => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    });
    waypointLayersRef.current = [];

    if (!sidVisible || !sidWaypointsVisible || !waypointData) return;

    const textColor = lightMode ? '#c2185b' : '#ff80ab';
    const starColor = lightMode ? '#f9a825' : '#ffeb3b';
    const bgColor = lightMode ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)';

    // Track unique waypoints to avoid duplicates
    const processedWaypoints = new Set<string>();

    waypointData.features.forEach((feature) => {
      const name = feature.properties.waypoint_identifier;
      if (!name) return;
      
      // Skip if already processed
      const waypointKey = `${name}`;
      if (processedWaypoints.has(waypointKey)) return;
      
      if (feature.geometry.type === 'MultiPoint' && feature.geometry.coordinates.length > 0) {
        feature.geometry.coordinates.forEach((coord) => {
          if (coord.length < 2) return;
          const [lon, lat] = coord;
          if (!isInThailand(lon, lat)) return;
          
          processedWaypoints.add(waypointKey);
          
          // Format altitude constraint
          let altitudeText = '';
          const altDesc = feature.properties.altitude_description;
          const alt1 = feature.properties.altitude1;
          if (altDesc && alt1) {
            if (altDesc === '+') altitudeText = `+${alt1}`;
            else if (altDesc === '-') altitudeText = `-${alt1}`;
            else if (altDesc === 'B' && feature.properties.altitude2) {
              altitudeText = `${feature.properties.altitude2}-${alt1}`;
            } else {
              altitudeText = `${alt1}`;
            }
          }
          
          // Yellow 4-point star symbol
          const icon = L.divIcon({
            className: 'sid-waypoint',
            html: `<div style="
              display: flex;
              flex-direction: column;
              align-items: center;
              pointer-events: none;
            ">
              <div style="
                width: 12px;
                height: 12px;
                position: relative;
              ">
                <div style="
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  width: 12px;
                  height: 2px;
                  background: ${starColor};
                  border: 0.5px solid rgba(0,0,0,0.5);
                "></div>
                <div style="
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%) rotate(90deg);
                  width: 12px;
                  height: 2px;
                  background: ${starColor};
                  border: 0.5px solid rgba(0,0,0,0.5);
                "></div>
                <div style="
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%) rotate(45deg);
                  width: 8px;
                  height: 2px;
                  background: ${starColor};
                  border: 0.5px solid rgba(0,0,0,0.5);
                "></div>
                <div style="
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%) rotate(-45deg);
                  width: 8px;
                  height: 2px;
                  background: ${starColor};
                  border: 0.5px solid rgba(0,0,0,0.5);
                "></div>
              </div>
              <div style="
                font-size: 8px;
                font-weight: 600;
                color: ${textColor};
                background: ${bgColor};
                padding: 0px 3px;
                border-radius: 2px;
                margin-top: 2px;
                white-space: nowrap;
                text-transform: uppercase;
              ">${name}${altitudeText ? `<br/><span style="font-size: 7px; color: ${textColor};">${altitudeText}</span>` : ''}</div>
            </div>`,
            iconSize: [0, 0],
            iconAnchor: [6, 6],
          });
          
          const marker = L.marker([lat, lon], { 
            icon, 
            interactive: false,
            pane: 'sidWaypointPane'
          });
          marker.addTo(map);
          waypointLayersRef.current.push(marker);
        });
      }
    });

    return () => {
      waypointLayersRef.current.forEach(layer => {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      });
    };
  }, [sidVisible, sidWaypointsVisible, lightMode, map, waypointData]);

  return null;
}
