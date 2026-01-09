import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useFlightStore } from '../store/flightStore';

interface PDRFeature {
  type: string;
  properties: {
    fid: number;
    id: number;
    ident: string;
    areacode: string;
    type: string;
    name: string;
    lowerlimit: string;
    upperlimit: string;
  };
  geometry: {
    type: string;
    coordinates: number[][][][];
  };
}

interface GeoJSONData {
  type: string;
  name: string;
  features: PDRFeature[];
}

// Color schemes for different modes
const PDR_COLOR_DARK = '#E74C3C';
const PDR_COLOR_LIGHT = '#C0392B';
const PDR_COLOR_SATELLITE = '#FF6B6B';

export function PDRLayer() {
  const map = useMap();
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const labelsLayerRef = useRef<L.LayerGroup | null>(null);
  const geoDataRef = useRef<GeoJSONData | null>(null);
  
  const sectorLayers = useFlightStore(state => state.sectorLayers);
  const pdrLayer = sectorLayers.pdr;
  const visible = pdrLayer?.visible || false;
  const labelsVisible = pdrLayer?.labelsVisible || false;
  const fillVisible = pdrLayer?.fillVisible || false;
  const opacity = pdrLayer?.opacity || 0.4;
  const lightMode = useFlightStore(state => state.lightMode);
  const satelliteMode = useFlightStore(state => state.satelliteMode);

  const getColor = (): string => {
    if (satelliteMode) return PDR_COLOR_SATELLITE;
    if (lightMode) return PDR_COLOR_LIGHT;
    return PDR_COLOR_DARK;
  };

  const getBorderColor = (): string => {
    if (satelliteMode) return '#ffffff';
    if (lightMode) return '#333333';
    return '#ffffff';
  };

  // Load GeoJSON data
  useEffect(() => {
    fetch('/pdr.geojson')
      .then(res => res.json())
      .then((data: GeoJSONData) => {
        geoDataRef.current = data;
      })
      .catch(err => console.error('Failed to load PDR GeoJSON:', err));
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
        weight: 1,  // LINE WIDTH: Adjust this value to change line thickness
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
          className: `sector-label pdr-label ${labelClass}`,
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
