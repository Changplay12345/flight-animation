import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useFlightStore } from '../store/flightStore';

interface TMAFeature {
  type: string;
  properties: {
    fid: number;
    id: number;
    name: string;
    icaocode: string;
    upperlimit: number;
    upperuom: string;
    lowerlimit: number;
    loweruom: string;
  };
  geometry: {
    type: string;
    coordinates: number[][][][];
  };
}

interface GeoJSONData {
  type: string;
  name: string;
  features: TMAFeature[];
}

// Color schemes for different modes
const TMA_COLOR_DARK = '#3498DB';
const TMA_COLOR_LIGHT = '#2980B9';
const TMA_COLOR_SATELLITE = '#87CEEB';

export function TMALayer() {
  const map = useMap();
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const labelsLayerRef = useRef<L.LayerGroup | null>(null);
  const geoDataRef = useRef<GeoJSONData | null>(null);
  
  const sectorLayers = useFlightStore(state => state.sectorLayers);
  const tmaLayer = sectorLayers.tma;
  const visible = tmaLayer?.visible || false;
  const labelsVisible = tmaLayer?.labelsVisible || false;
  const fillVisible = tmaLayer?.fillVisible || false;
  const opacity = tmaLayer?.opacity || 0.4;
  const lightMode = useFlightStore(state => state.lightMode);
  const satelliteMode = useFlightStore(state => state.satelliteMode);

  const getColor = (): string => {
    if (satelliteMode) return TMA_COLOR_SATELLITE;
    if (lightMode) return TMA_COLOR_LIGHT;
    return TMA_COLOR_DARK;
  };

  const getBorderColor = (): string => {
    if (satelliteMode) return '#ffffff';
    if (lightMode) return '#333333';
    return '#ffffff';
  };

  // Load GeoJSON data
  useEffect(() => {
    fetch('/tma.geojson')
      .then(res => res.json())
      .then((data: GeoJSONData) => {
        geoDataRef.current = data;
      })
      .catch(err => console.error('Failed to load TMA GeoJSON:', err));
  }, []);

  // Create/update layer when visibility or style changes
  useEffect(() => {
    if (!visible || !geoDataRef.current) {
      if (geoJsonLayerRef.current && map.hasLayer(geoJsonLayerRef.current)) {
        map.removeLayer(geoJsonLayerRef.current);
      }
      if (labelsLayerRef.current && map.hasLayer(labelsLayerRef.current)) {
        map.removeLayer(labelsLayerRef.current);
      }
      return;
    }

    // Remove existing layers
    if (geoJsonLayerRef.current && map.hasLayer(geoJsonLayerRef.current)) {
      map.removeLayer(geoJsonLayerRef.current);
    }
    if (labelsLayerRef.current && map.hasLayer(labelsLayerRef.current)) {
      map.removeLayer(labelsLayerRef.current);
    }

    // Create GeoJSON layer
    geoJsonLayerRef.current = L.geoJSON(geoDataRef.current as any, {
      style: () => ({
        fillColor: getColor(),
        weight: 2,
        opacity: 1,
        color: getBorderColor(),
        fillOpacity: fillVisible ? opacity : 0,
        dashArray: '8, 4',
        lineCap: 'square' as const,
        lineJoin: 'miter' as const,
      }),
    });

    geoJsonLayerRef.current.addTo(map);

    // Create labels layer
    if (labelsVisible) {
      labelsLayerRef.current = L.layerGroup();
      
      geoDataRef.current.features.forEach(feature => {
        const { name } = feature.properties;
        
        // Calculate centroid for label placement
        const coords = feature.geometry.coordinates[0][0];
        let sumLat = 0, sumLon = 0;
        coords.forEach((coord: number[]) => {
          sumLon += coord[0];
          sumLat += coord[1];
        });
        const centroidLat = sumLat / coords.length;
        const centroidLon = sumLon / coords.length;

        const labelClass = lightMode ? 'sector-label-light' : 'sector-label-dark';
        
        const icon = L.divIcon({
          className: `sector-label tma-label ${labelClass}`,
          html: `<div><strong>${name}</strong></div>`,
          iconSize: [100, 30],
          iconAnchor: [50, 15],
        });

        const marker = L.marker([centroidLat, centroidLon], { icon, interactive: false });
        labelsLayerRef.current?.addLayer(marker);
      });

      labelsLayerRef.current.addTo(map);
    }

    return () => {
      if (geoJsonLayerRef.current && map.hasLayer(geoJsonLayerRef.current)) {
        map.removeLayer(geoJsonLayerRef.current);
      }
      if (labelsLayerRef.current && map.hasLayer(labelsLayerRef.current)) {
        map.removeLayer(labelsLayerRef.current);
      }
    };
  }, [map, visible, labelsVisible, fillVisible, opacity, lightMode, satelliteMode]);

  return null;
}
