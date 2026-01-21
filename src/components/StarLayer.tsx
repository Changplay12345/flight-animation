import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useFlightStore } from '../store/flightStore';

interface StarLineFeature {
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

interface StarWaypointFeature {
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

interface StarLineGeoJSON {
  type: string;
  features: StarLineFeature[];
}

interface StarWaypointGeoJSON {
  type: string;
  features: StarWaypointFeature[];
}

// Thailand airport prefix only
const isThailandAirport = (airportId: string) => airportId?.startsWith('VT');

export function StarLayer() {
  const map = useMap();
  const starVisible = useFlightStore(state => state.starVisible);
  const starWaypointsVisible = useFlightStore(state => state.starWaypointsVisible);
  const starOpacity = useFlightStore(state => state.starOpacity);
  const starLineWeight = useFlightStore(state => state.starLineWeight);
  const starAirportFilter = useFlightStore(state => state.starAirportFilter);
  const lightMode = useFlightStore(state => state.lightMode);
  
  const lineLayersRef = useRef<L.Layer[]>([]);
  const waypointLayersRef = useRef<L.Marker[]>([]);
  
  const [lineData, setLineData] = useState<StarLineGeoJSON | null>(null);
  const [waypointData, setWaypointData] = useState<StarWaypointGeoJSON | null>(null);

  // Load GeoJSON data once
  useEffect(() => {
    fetch('/star/star_line.geojson')
      .then(res => res.json())
      .then(data => setLineData(data))
      .catch(err => console.error('Failed to load STAR lines:', err));
      
    fetch('/star/star_waypoint.geojson')
      .then(res => res.json())
      .then(data => setWaypointData(data))
      .catch(err => console.error('Failed to load STAR waypoints:', err));
  }, []);

  // Create custom panes
  useEffect(() => {
    if (!map.getPane('starLinePane')) {
      map.createPane('starLinePane');
      const pane = map.getPane('starLinePane');
      if (pane) pane.style.zIndex = '356';
    }
    if (!map.getPane('starWaypointPane')) {
      map.createPane('starWaypointPane');
      const pane = map.getPane('starWaypointPane');
      if (pane) pane.style.zIndex = '366';
    }
  }, [map]);

  // Render STAR lines (cyan/teal polylines)
  useEffect(() => {
    lineLayersRef.current.forEach(layer => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    });
    lineLayersRef.current = [];

    if (!starVisible || !lineData) return;

    // Cyan/teal color for STAR (different from SID pink)
    const lineColor = lightMode ? '#00838f' : '#00bcd4';

    // Parse airport filter
    const filterAirports = starAirportFilter.split(',').map(s => s.trim()).filter(s => s.length > 0);
    
    lineData.features.forEach((feature) => {
      if (!isThailandAirport(feature.properties.airport_identifier)) return;
      if (filterAirports.length > 0 && !filterAirports.some(f => feature.properties.airport_identifier.includes(f))) return;
      
      if (feature.geometry.type === 'MultiLineString') {
        feature.geometry.coordinates.forEach((lineCoords) => {
          const latlngs: [number, number][] = lineCoords.map(coord => [coord[1], coord[0]]);
          
          const polyline = L.polyline(latlngs, {
            color: lineColor,
            weight: starLineWeight,
            opacity: starOpacity,
            pane: 'starLinePane',
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
  }, [starVisible, lightMode, map, lineData, starOpacity, starLineWeight, starAirportFilter]);

  // Render STAR waypoints
  useEffect(() => {
    waypointLayersRef.current.forEach(layer => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    });
    waypointLayersRef.current = [];

    if (!starVisible || !starWaypointsVisible || !waypointData) return;

    // Cyan/teal text color for STAR
    const textColor = lightMode ? '#00838f' : '#4dd0e1';
    const starColor = lightMode ? '#00acc1' : '#00e5ff';

    // Parse airport filter
    const filterAirports = starAirportFilter.split(',').map(s => s.trim()).filter(s => s.length > 0);

    const processedWaypoints = new Set<string>();

    waypointData.features.forEach((feature) => {
      const name = feature.properties.waypoint_identifier;
      if (!name) return;
      
      // Apply airport filter
      if (filterAirports.length > 0 && feature.properties.airport_identifier && !filterAirports.some(f => feature.properties.airport_identifier?.includes(f))) return;
      
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
            className: 'star-waypoint',
            html: `<div style="
              display: flex;
              flex-direction: column;
              align-items: center;
              pointer-events: none;
            ">
              <div style="
                width: 10px;
                height: 10px;
                position: relative;
              ">
                <div style="
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%);
                  width: 10px;
                  height: 2px;
                  background: ${starColor};
                  box-shadow: 0 0 2px rgba(0,0,0,0.8);
                "></div>
                <div style="
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%) rotate(90deg);
                  width: 10px;
                  height: 2px;
                  background: ${starColor};
                  box-shadow: 0 0 2px rgba(0,0,0,0.8);
                "></div>
                <div style="
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%) rotate(45deg);
                  width: 6px;
                  height: 2px;
                  background: ${starColor};
                  box-shadow: 0 0 2px rgba(0,0,0,0.8);
                "></div>
                <div style="
                  position: absolute;
                  top: 50%;
                  left: 50%;
                  transform: translate(-50%, -50%) rotate(-45deg);
                  width: 6px;
                  height: 2px;
                  background: ${starColor};
                  box-shadow: 0 0 2px rgba(0,0,0,0.8);
                "></div>
              </div>
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
            iconAnchor: [5, 5],
          });
          
          const marker = L.marker([lat, lon], { 
            icon, 
            interactive: false,
            pane: 'starWaypointPane'
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
  }, [starVisible, starWaypointsVisible, lightMode, map, waypointData, starAirportFilter]);

  return null;
}
