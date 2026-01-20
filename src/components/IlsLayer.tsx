import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useFlightStore } from '../store/flightStore';

interface IlsLineFeature {
  type: string;
  properties: {
    procedure_identifier?: string;
    airport_identifier: string;
    transition_identifier?: string;
  };
  geometry: {
    type: string;
    coordinates: number[][][];
  };
}

interface IlsWaypointFeature {
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

interface IlsGeoJSON {
  type: string;
  features: IlsLineFeature[];
}

interface IlsWaypointGeoJSON {
  type: string;
  features: IlsWaypointFeature[];
}

// Thailand airport prefix only
const isThailandAirport = (airportId: string) => airportId?.startsWith('VT');

export function IlsLayer() {
  const map = useMap();
  const ilsVisible = useFlightStore(state => state.ilsVisible);
  const ilsLegsVisible = useFlightStore(state => state.ilsLegsVisible);
  const ilsWaypointsVisible = useFlightStore(state => state.ilsWaypointsVisible);
  const ilsOpacity = useFlightStore(state => state.ilsOpacity);
  const ilsLineWeight = useFlightStore(state => state.ilsLineWeight);
  const lightMode = useFlightStore(state => state.lightMode);
  
  const legsLayersRef = useRef<L.Layer[]>([]);
  const waypointLayersRef = useRef<L.Marker[]>([]);
  
  const [legsData, setLegsData] = useState<IlsGeoJSON | null>(null);
  const [waypointData, setWaypointData] = useState<IlsWaypointGeoJSON | null>(null);

  // Load GeoJSON data once
  useEffect(() => {
    fetch('/ils/True ils leg.geojson')
      .then(res => res.json())
      .then(data => setLegsData(data))
      .catch(err => console.error('Failed to load ILS legs:', err));
      
    fetch('/ils/true ils waypoint.geojson')
      .then(res => res.json())
      .then(data => setWaypointData(data))
      .catch(err => console.error('Failed to load ILS waypoints:', err));
  }, []);

  // Create custom panes
  useEffect(() => {
    if (!map.getPane('ilsLinePane')) {
      map.createPane('ilsLinePane');
      const pane = map.getPane('ilsLinePane');
      if (pane) pane.style.zIndex = '358';
    }
    if (!map.getPane('ilsWaypointPane')) {
      map.createPane('ilsWaypointPane');
      const pane = map.getPane('ilsWaypointPane');
      if (pane) pane.style.zIndex = '368';
    }
  }, [map]);

  // Render ILS legs (green color)
  useEffect(() => {
    legsLayersRef.current.forEach(layer => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    });
    legsLayersRef.current = [];

    if (!ilsVisible || !ilsLegsVisible || !legsData) return;

    const lineColor = lightMode ? '#2e7d32' : '#66bb6a';

    legsData.features.forEach((feature) => {
      if (!isThailandAirport(feature.properties.airport_identifier)) return;
      
      if (feature.geometry.type === 'MultiLineString') {
        feature.geometry.coordinates.forEach((lineCoords) => {
          const latlngs: [number, number][] = lineCoords.map(coord => [coord[1], coord[0]]);
          
          const polyline = L.polyline(latlngs, {
            color: lineColor,
            weight: ilsLineWeight,
            opacity: ilsOpacity,
            pane: 'ilsLinePane',
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
  }, [ilsVisible, ilsLegsVisible, lightMode, map, legsData, ilsOpacity, ilsLineWeight]);

  // Render ILS waypoints
  useEffect(() => {
    waypointLayersRef.current.forEach(layer => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    });
    waypointLayersRef.current = [];

    if (!ilsVisible || !ilsWaypointsVisible || !waypointData) return;

    const textColor = lightMode ? '#1b5e20' : '#a5d6a7';
    const markerColor = lightMode ? '#43a047' : '#81c784';

    const processedWaypoints = new Set<string>();

    waypointData.features.forEach((feature) => {
      const name = feature.properties.waypoint_identifier;
      if (!name) return;
      
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
            className: 'ils-waypoint',
            html: `<div style="
              display: flex;
              flex-direction: column;
              align-items: center;
              pointer-events: none;
            ">
              <div style="
                width: 0;
                height: 0;
                border-left: 5px solid transparent;
                border-right: 5px solid transparent;
                border-bottom: 8px solid ${markerColor};
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
            iconAnchor: [5, 4],
          });
          
          const marker = L.marker([lat, lon], { 
            icon, 
            interactive: false,
            pane: 'ilsWaypointPane'
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
  }, [ilsVisible, ilsWaypointsVisible, lightMode, map, waypointData]);

  return null;
}
