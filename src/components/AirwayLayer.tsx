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
  };
  geometry: {
    type: string;
    coordinates: number[][][];
  };
}

interface AirwayGeoJSON {
  type: string;
  features: AirwayFeature[];
}

export function AirwayLayer() {
  const map = useMap();
  const airwaysVisible = useFlightStore(state => state.airwaysVisible);
  const lightMode = useFlightStore(state => state.lightMode);
  const satelliteMode = useFlightStore(state => state.satelliteMode);
  const airwayOpacity = useFlightStore(state => state.airwayOpacity);
  const airwayLayersRef = useRef<L.Polyline[]>([]);
  const [geojsonData, setGeojsonData] = useState<AirwayGeoJSON | null>(null);

  // Load GeoJSON data once
  useEffect(() => {
    fetch('/airwaysegment.geojson')
      .then(res => res.json())
      .then(data => setGeojsonData(data))
      .catch(err => console.error('Failed to load airway segments:', err));
  }, []);

  // Create custom pane for airways (below default overlayPane where trails are)
  useEffect(() => {
    if (!map.getPane('airwayPane')) {
      map.createPane('airwayPane');
      const pane = map.getPane('airwayPane');
      if (pane) {
        pane.style.zIndex = '350'; // Below overlayPane (400) where trails render
      }
    }
  }, [map]);

  // Render/update airways when visibility or theme changes
  useEffect(() => {
    // Clear existing
    airwayLayersRef.current.forEach(layer => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    });
    airwayLayersRef.current = [];

    if (!airwaysVisible || !geojsonData) return;

    // Determine colors based on mode
    const color = lightMode ? '#0d47a1' : (satelliteMode ? '#00ff88' : '#00d9ff');

    geojsonData.features.forEach((feature) => {
      if (feature.geometry.type === 'MultiLineString') {
        feature.geometry.coordinates.forEach((lineCoords) => {
          // Convert [lon, lat] to [lat, lon] for Leaflet
          const latlngs: [number, number][] = lineCoords.map(coord => [coord[1], coord[0]]);
          
          const polyline = L.polyline(latlngs, {
            color,
            weight: 0.8,
            opacity: airwayOpacity,
            pane: 'airwayPane', // Use custom pane so trails render on top
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

  return null;
}
