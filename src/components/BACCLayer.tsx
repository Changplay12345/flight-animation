import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useFlightStore } from '../store/flightStore';

interface BACCSector {
  fid: number;
  name: string;
  upper: number;
  lower: number;
  id: number;
}

interface GeoJSONFeature {
  type: string;
  properties: BACCSector;
  geometry: {
    type: string;
    coordinates: number[][][][];
  };
}

interface GeoJSONData {
  type: string;
  name: string;
  features: GeoJSONFeature[];
}

// Color schemes for different modes
const SECTOR_COLORS_DARK: Record<string, string> = {
  '1N': '#FF6B6B',
  '1S': '#4ECDC4',
  '2N': '#45B7D1',
  '2S': '#96CEB4',
  '3N': '#FFEAA7',
  '3S_lower': '#DDA0DD',
  '3S_upper': '#9B59B6',
  '4N': '#E17055',
  '4S': '#00B894',
  '5N': '#0984E3',
  '5S': '#6C5CE7',
  '6N': '#FDCB6E',
  '6S_lower': '#E84393',
  '6S_upper': '#D63031',
};

const SECTOR_COLORS_LIGHT: Record<string, string> = {
  '1N': '#C0392B',
  '1S': '#16A085',
  '2N': '#2980B9',
  '2S': '#27AE60',
  '3N': '#D35400',
  '3S_lower': '#8E44AD',
  '3S_upper': '#6C3483',
  '4N': '#E74C3C',
  '4S': '#1ABC9C',
  '5N': '#3498DB',
  '5S': '#9B59B6',
  '6N': '#F39C12',
  '6S_lower': '#E91E63',
  '6S_upper': '#C0392B',
};

const SECTOR_COLORS_SATELLITE: Record<string, string> = {
  '1N': '#FF8A80',
  '1S': '#A7FFEB',
  '2N': '#80D8FF',
  '2S': '#B9F6CA',
  '3N': '#FFE57F',
  '3S_lower': '#EA80FC',
  '3S_upper': '#B388FF',
  '4N': '#FF9E80',
  '4S': '#64FFDA',
  '5N': '#82B1FF',
  '5S': '#B39DDB',
  '6N': '#FFD180',
  '6S_lower': '#FF80AB',
  '6S_upper': '#FF5252',
};

export function BACCLayer() {
  const map = useMap();
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const labelsLayerRef = useRef<L.LayerGroup | null>(null);
  const geoDataRef = useRef<GeoJSONData | null>(null);
  
  const sectorLayers = useFlightStore(state => state.sectorLayers);
  const baccLayer = sectorLayers.bacc;
  const baccVisible = baccLayer?.visible || false;
  const baccLabelsVisible = baccLayer?.labelsVisible || false;
  const baccFillVisible = baccLayer?.fillVisible || false;
  const baccOpacity = baccLayer?.opacity || 0.4;
  const lightMode = useFlightStore(state => state.lightMode);
  const satelliteMode = useFlightStore(state => state.satelliteMode);

  const getSectorColor = (name: string): string => {
    if (satelliteMode) return SECTOR_COLORS_SATELLITE[name] || '#888888';
    if (lightMode) return SECTOR_COLORS_LIGHT[name] || '#888888';
    return SECTOR_COLORS_DARK[name] || '#888888';
  };

  const getBorderColor = (): string => {
    if (satelliteMode) return '#ffffff';
    if (lightMode) return '#333333';
    return '#ffffff';
  };

  // Load GeoJSON data
  useEffect(() => {
    fetch('/sectors/bacc_geo.geojson')
      .then(res => res.json())
      .then((data: GeoJSONData) => {
        geoDataRef.current = data;
      })
      .catch(err => console.error('Failed to load BACC GeoJSON:', err));
  }, []);

  // Create/update layer when visibility or style changes
  useEffect(() => {
    if (!baccVisible || !geoDataRef.current) {
      // Remove layers if not visible
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
      style: (feature) => {
        if (!feature) return {};
        const name = feature.properties.name;
        return {
          fillColor: getSectorColor(name),
          weight: 1,  // LINE WIDTH: Adjust this value to change line thickness
          opacity: 1,
          color: getBorderColor(),
          fillOpacity: baccFillVisible ? baccOpacity : 0,
          dashArray: '8, 4',
          lineCap: 'square',
          lineJoin: 'miter',
        };
      },
    });

    geoJsonLayerRef.current.addTo(map);

    // Create labels layer
    if (baccLabelsVisible) {
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

        const labelClass = lightMode ? 'bacc-label-light' : 'bacc-label-dark';
        
        const icon = L.divIcon({
          className: `bacc-sector-label ${labelClass}`,
          html: `<div><strong>${name}</strong></div>`,
          iconSize: [80, 30],
          iconAnchor: [40, 15],
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
  }, [map, baccVisible, baccLabelsVisible, baccFillVisible, baccOpacity, lightMode, satelliteMode]);

  return null;
}
