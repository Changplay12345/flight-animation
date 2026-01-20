import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useFlightStore } from '../store/flightStore';

interface PbnLineFeature {
  type: string;
  properties: {
    procedure_identifier?: string;
    airport_identifier: string;
    transition_identifier?: string;
    waypoint_identifier?: string;
  };
  geometry: {
    type: string;
    coordinates: number[][][] | number[][];
  };
}

interface PbnWaypointFeature {
  type: string;
  properties: {
    waypoint_identifier: string;
    altitude_description: string | null;
    altitude1: number | null;
    altitude2: number | null;
    airport_identifier?: string;
  };
  geometry: {
    type: string;
    coordinates: number[][];
  };
}

interface PbnGeoJSON {
  type: string;
  features: PbnLineFeature[];
}

interface PbnWaypointGeoJSON {
  type: string;
  features: PbnWaypointFeature[];
}

// Thailand airport prefix only
const isThailandAirport = (airportId: string) => airportId?.startsWith('VT');

export function PbnLayer() {
  const map = useMap();
  const pbnVisible = useFlightStore(state => state.pbnVisible);
  const pbnLegsVisible = useFlightStore(state => state.pbnLegsVisible);
  const pbnWaypointsVisible = useFlightStore(state => state.pbnWaypointsVisible);
  const pbnOpacity = useFlightStore(state => state.pbnOpacity);
  const pbnLineWeight = useFlightStore(state => state.pbnLineWeight);
  const lightMode = useFlightStore(state => state.lightMode);
  
  const legsLayersRef = useRef<L.Layer[]>([]);
  const waypointLayersRef = useRef<L.Marker[]>([]);
  
  const [legsData, setLegsData] = useState<PbnGeoJSON | null>(null);
  const [waypointData, setWaypointData] = useState<PbnWaypointGeoJSON | null>(null);

  // Load GeoJSON data once
  useEffect(() => {
    fetch('/pbn/true pbn.geojson')
      .then(res => res.json())
      .then(data => setLegsData(data))
      .catch(err => console.error('Failed to load PBN legs:', err));
      
    fetch('/pbn/true pbn wp.geojson')
      .then(res => res.json())
      .then(data => setWaypointData(data))
      .catch(err => console.error('Failed to load PBN waypoints:', err));
  }, []);

  // Create custom panes
  useEffect(() => {
    if (!map.getPane('pbnLinePane')) {
      map.createPane('pbnLinePane');
      const pane = map.getPane('pbnLinePane');
      if (pane) pane.style.zIndex = '357';
    }
    if (!map.getPane('pbnWaypointPane')) {
      map.createPane('pbnWaypointPane');
      const pane = map.getPane('pbnWaypointPane');
      if (pane) pane.style.zIndex = '367';
    }
  }, [map]);

  // Render PBN legs (orange color)
  useEffect(() => {
    legsLayersRef.current.forEach(layer => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    });
    legsLayersRef.current = [];

    if (!pbnVisible || !pbnLegsVisible || !legsData) return;

    const lineColor = lightMode ? '#ef6c00' : '#ffb74d';

    legsData.features.forEach((feature) => {
      if (!isThailandAirport(feature.properties.airport_identifier)) return;
      
      if (feature.geometry.type === 'MultiLineString') {
        (feature.geometry.coordinates as number[][][]).forEach((lineCoords) => {
          const latlngs: [number, number][] = lineCoords.map(coord => [coord[1], coord[0]]);
          
          const polyline = L.polyline(latlngs, {
            color: lineColor,
            weight: pbnLineWeight,
            opacity: pbnOpacity,
            pane: 'pbnLinePane',
          });
          polyline.addTo(map);
          legsLayersRef.current.push(polyline);
        });
      }
    });

    return () => {
      legsLayersRef.current.forEach(layer => {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      });
    };
  }, [pbnVisible, pbnLegsVisible, lightMode, map, legsData, pbnOpacity, pbnLineWeight]);

  // Render PBN waypoints
  useEffect(() => {
    waypointLayersRef.current.forEach(layer => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    });
    waypointLayersRef.current = [];

    if (!pbnVisible || !pbnWaypointsVisible || !waypointData) return;

    const textColor = lightMode ? '#e65100' : '#ffcc80';
    const markerColor = lightMode ? '#ff6d00' : '#ff9100';

    const processedWaypoints = new Set<string>();

    waypointData.features.forEach((feature) => {
      const name = feature.properties.waypoint_identifier;
      if (!name) return;
      
      // Filter for Thailand airports only
      if (feature.properties.airport_identifier && !isThailandAirport(feature.properties.airport_identifier)) return;
      
      const waypointKey = `${name}`;
      if (processedWaypoints.has(waypointKey)) return;
      
      if (feature.geometry.type === 'MultiPoint' && feature.geometry.coordinates.length > 0) {
        feature.geometry.coordinates.forEach((coord) => {
          if (coord.length < 2) return;
          const [lon, lat] = coord;
          
          processedWaypoints.add(waypointKey);
          
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
          
          const icon = L.divIcon({
            className: 'pbn-waypoint',
            html: `<div style="
              display: flex;
              flex-direction: column;
              align-items: center;
              pointer-events: none;
            ">
              <div style="
                width: 8px;
                height: 8px;
                background: ${markerColor};
                border: 1px solid ${lightMode ? '#000' : '#fff'};
                border-radius: 2px;
                transform: rotate(45deg);
              "></div>
              <div style="
                font-size: 9px;
                font-weight: 700;
                color: ${textColor};
                margin-top: 2px;
                white-space: nowrap;
                text-transform: uppercase;
                text-shadow: -1px -1px 0 ${lightMode ? '#fff' : '#000'}, 1px -1px 0 ${lightMode ? '#fff' : '#000'}, -1px 1px 0 ${lightMode ? '#fff' : '#000'}, 1px 1px 0 ${lightMode ? '#fff' : '#000'}, 0 0 4px ${lightMode ? '#fff' : '#000'};
              ">${name}${altitudeText ? `<br/><span style="font-size: 8px;">${altitudeText}</span>` : ''}</div>
            </div>`,
            iconSize: [0, 0],
            iconAnchor: [4, 4],
          });
          
          const marker = L.marker([lat, lon], { 
            icon, 
            interactive: false,
            pane: 'pbnWaypointPane'
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
  }, [pbnVisible, pbnWaypointsVisible, lightMode, map, waypointData]);

  return null;
}
