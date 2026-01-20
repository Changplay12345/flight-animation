import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useFlightStore } from '../store/flightStore';

interface SubsectorFeature {
  type: string;
  properties: {
    fid: number;
    name: string;
  };
  geometry: {
    type: string;
    coordinates: number[][][][];
  };
}

interface GeoJSONData {
  type: string;
  name: string;
  features: SubsectorFeature[];
}

// Color schemes for different modes
const SUBSECTOR_COLORS_DARK: Record<string, string> = {
  '7N': '#00CED1',
  '8N': '#20B2AA',
  '7S': '#48D1CC',
  '8S': '#40E0D0',
};

const SUBSECTOR_COLORS_LIGHT: Record<string, string> = {
  '7N': '#008B8B',
  '8N': '#2E8B57',
  '7S': '#3CB371',
  '8S': '#2F4F4F',
};

const SUBSECTOR_COLORS_SATELLITE: Record<string, string> = {
  '7N': '#7FFFD4',
  '8N': '#66CDAA',
  '7S': '#AFEEEE',
  '8S': '#00FA9A',
};

export function BACCSubsectorLayer() {
  const map = useMap();
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const labelsLayerRef = useRef<L.LayerGroup | null>(null);
  const geoDataRef = useRef<GeoJSONData | null>(null);
  
  const sectorLayers = useFlightStore(state => state.sectorLayers);
  const subsectorLayer = sectorLayers.bacc_subsector;
  const visible = subsectorLayer?.visible || false;
  const labelsVisible = subsectorLayer?.labelsVisible || false;
  const fillVisible = subsectorLayer?.fillVisible || false;
  const opacity = subsectorLayer?.opacity || 0.4;
  const lightMode = useFlightStore(state => state.lightMode);
  const satelliteMode = useFlightStore(state => state.satelliteMode);

  const getColor = (name: string): string => {
    if (satelliteMode) return SUBSECTOR_COLORS_SATELLITE[name] || '#888888';
    if (lightMode) return SUBSECTOR_COLORS_LIGHT[name] || '#888888';
    return SUBSECTOR_COLORS_DARK[name] || '#888888';
  };

  const getBorderColor = (): string => {
    if (satelliteMode) return '#ffffff';
    if (lightMode) return '#333333';
    return '#ffffff';
  };

  // Load GeoJSON data
  useEffect(() => {
    fetch('/sectors/bacc_subsector.geojson')
      .then(res => res.json())
      .then((data: GeoJSONData) => {
        geoDataRef.current = data;
      })
      .catch(err => console.error('Failed to load BACC Subsector GeoJSON:', err));
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
      style: (feature) => {
        if (!feature) return {};
        const name = feature.properties.name;
        return {
          fillColor: getColor(name),
          weight: 2,
          opacity: 1,
          color: getBorderColor(),
          fillOpacity: fillVisible ? opacity : 0,
          dashArray: '8, 4',
          lineCap: 'square' as const,
          lineJoin: 'miter' as const,
        };
      },
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
          className: `sector-label subsector-label ${labelClass}`,
          html: `<div><strong>${name}</strong></div>`,
          iconSize: [60, 30],
          iconAnchor: [30, 15],
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
