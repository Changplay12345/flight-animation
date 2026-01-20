import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useFlightStore } from '../store/flightStore';

interface FIRFeature {
  type: string;
  properties: {
    fid: number;
    id: number;
    name: string;
    descriptio: string;
  };
  geometry: {
    type: string;
    coordinates: number[][][][];
  };
}

interface GeoJSONData {
  type: string;
  name: string;
  features: FIRFeature[];
}

// Color schemes for different modes
const FIR_COLOR_DARK = '#9B59B6';
const FIR_COLOR_LIGHT = '#8E44AD';
const FIR_COLOR_SATELLITE = '#E1BEE7';

// Extended bounds to include Thailand and 1 country neighbor
const EXTENDED_BOUNDS = {
  minLat: 0.0,    // Include Malaysia, Singapore
  maxLat: 24.0,   // Include parts of China, Myanmar
  minLon: 92.0,   // Include Myanmar
  maxLon: 110.0,  // Include Cambodia, Vietnam, Laos
};

function isFeatureInBounds(feature: FIRFeature): boolean {
  try {
    const coords = feature.geometry.coordinates[0][0];
    // Check if any coordinate is within extended bounds
    for (const coord of coords) {
      const lon = coord[0];
      const lat = coord[1];
      if (lat >= EXTENDED_BOUNDS.minLat && lat <= EXTENDED_BOUNDS.maxLat &&
          lon >= EXTENDED_BOUNDS.minLon && lon <= EXTENDED_BOUNDS.maxLon) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function FIRLayer() {
  const map = useMap();
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const geoDataRef = useRef<GeoJSONData | null>(null);
  
  const sectorLayers = useFlightStore(state => state.sectorLayers);
  const firLayer = sectorLayers.fir_world;
  const visible = firLayer?.visible || false;
  const opacity = firLayer?.opacity || 0.6;
  const lightMode = useFlightStore(state => state.lightMode);
  const satelliteMode = useFlightStore(state => state.satelliteMode);

  const getColor = (): string => {
    if (satelliteMode) return FIR_COLOR_SATELLITE;
    if (lightMode) return FIR_COLOR_LIGHT;
    return FIR_COLOR_DARK;
  };

  // Load GeoJSON data and filter to Thailand region
  useEffect(() => {
    fetch('/sectors/fir.geojson')
      .then(res => res.json())
      .then((data: GeoJSONData) => {
        // Filter features to only include Thailand and neighbors
        const filteredFeatures = data.features.filter(isFeatureInBounds);
        geoDataRef.current = {
          ...data,
          features: filteredFeatures,
        };
      })
      .catch(err => console.error('Failed to load FIR GeoJSON:', err));
  }, []);

  // Create/update layer when visibility or style changes
  useEffect(() => {
    if (!visible || !geoDataRef.current) {
      if (geoJsonLayerRef.current && map.hasLayer(geoJsonLayerRef.current)) {
        map.removeLayer(geoJsonLayerRef.current);
      }
      return;
    }

    // Remove existing layer
    if (geoJsonLayerRef.current && map.hasLayer(geoJsonLayerRef.current)) {
      map.removeLayer(geoJsonLayerRef.current);
    }

    // Create GeoJSON layer - LINE ONLY, NO FILL
    geoJsonLayerRef.current = L.geoJSON(geoDataRef.current as any, {
      style: () => ({
        fillColor: 'transparent',
        weight: 1,  // LINE WIDTH: Adjust this value to change line thickness
        opacity: opacity,
        color: getColor(),
        fillOpacity: 0,
        dashArray: '8, 4',
        lineCap: 'square' as const,
        lineJoin: 'miter' as const,
      }),
    });

    geoJsonLayerRef.current.addTo(map);

    return () => {
      if (geoJsonLayerRef.current && map.hasLayer(geoJsonLayerRef.current)) {
        map.removeLayer(geoJsonLayerRef.current);
      }
    };
  }, [map, visible, opacity, lightMode, satelliteMode]);

  return null;
}
