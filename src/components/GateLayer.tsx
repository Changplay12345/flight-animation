import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useFlightStore } from '../store/flightStore';

interface GateFeature {
  type: string;
  properties: {
    airport_identifier: string;
    gate_identifier: string;
    gate_latitude: number;
    gate_longitude: number;
    name: string;
  };
  geometry: {
    type: string;
    coordinates: number[][];
  };
}

interface GateGeoJSON {
  type: string;
  features: GateFeature[];
}

export function GateLayer() {
  const map = useMap();
  const gatesVisible = useFlightStore(state => state.gatesVisible);
  const lightMode = useFlightStore(state => state.lightMode);
  const satelliteMode = useFlightStore(state => state.satelliteMode);
  const gateMarkersRef = useRef<L.CircleMarker[]>([]);
  const gateLabelsRef = useRef<L.Marker[]>([]);
  const [geojsonData, setGeojsonData] = useState<GateGeoJSON | null>(null);

  // Load GeoJSON data once
  useEffect(() => {
    fetch('/gateway.geojson')
      .then(res => res.json())
      .then(data => setGeojsonData(data))
      .catch(err => console.error('Failed to load gates:', err));
  }, []);

  // Render/update gates when visibility or theme changes
  useEffect(() => {
    // Clear existing
    gateMarkersRef.current.forEach(marker => {
      if (map.hasLayer(marker)) map.removeLayer(marker);
    });
    gateLabelsRef.current.forEach(label => {
      if (map.hasLayer(label)) map.removeLayer(label);
    });
    gateMarkersRef.current = [];
    gateLabelsRef.current = [];

    if (!gatesVisible || !geojsonData) return;

    // Determine colors based on mode - solid circle, contrasting text
    const dotColor = lightMode ? '#1565c0' : (satelliteMode ? '#ffeb3b' : '#00d9ff'); // Solid circle color
    const dotBorder = lightMode ? '#000' : (satelliteMode ? '#000' : '#1a1a2e'); // Border for contrast
    const labelBg = lightMode ? '#1565c0' : (satelliteMode ? '#ffeb3b' : '#00d9ff'); // Fill entire background
    const labelColor = lightMode ? '#fff' : (satelliteMode ? '#000' : '#1a1a2e'); // Contrasting text

    geojsonData.features.forEach((feature) => {
      const { gate_latitude, gate_longitude, name, airport_identifier } = feature.properties;
      
      if (!gate_latitude || !gate_longitude) return;

      // Create dot marker
      const circleMarker = L.circleMarker([gate_latitude, gate_longitude], {
        radius: 4,
        fillColor: dotColor,
        color: dotBorder,
        weight: 1,
        opacity: 1,
        fillOpacity: 0.9,
      });
      circleMarker.addTo(map);
      gateMarkersRef.current.push(circleMarker);

      // Create label (only visible at high zoom) - solid background fill
      const label = L.marker([gate_latitude, gate_longitude], {
        icon: L.divIcon({
          className: 'gate-label',
          html: `<div style="
            color: ${labelColor};
            font-size: 8px;
            font-weight: 600;
            background: ${labelBg};
            padding: 2px 4px;
            border-radius: 3px;
            white-space: nowrap;
            pointer-events: none;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          ">${name}</div>`,
          iconSize: [30, 12],
          iconAnchor: [-5, 6]
        }),
        interactive: false
      });
      label.addTo(map);
      gateLabelsRef.current.push(label);

      // Add tooltip on hover
      circleMarker.bindTooltip(`${airport_identifier} - Gate ${name}`, {
        direction: 'top',
        offset: [0, -5],
        className: 'gate-tooltip'
      });
    });

    // Handle zoom-based label visibility
    const updateLabelVisibility = () => {
      const zoom = map.getZoom();
      const showLabels = zoom >= 14; // Only show labels at zoom 14+
      
      gateLabelsRef.current.forEach(label => {
        const el = label.getElement();
        if (el) {
          el.style.display = showLabels ? 'block' : 'none';
        }
      });
    };

    map.on('zoomend', updateLabelVisibility);
    updateLabelVisibility(); // Initial check

    return () => {
      map.off('zoomend', updateLabelVisibility);
      gateMarkersRef.current.forEach(marker => {
        if (map.hasLayer(marker)) map.removeLayer(marker);
      });
      gateLabelsRef.current.forEach(label => {
        if (map.hasLayer(label)) map.removeLayer(label);
      });
    };
  }, [gatesVisible, lightMode, satelliteMode, map, geojsonData]);

  return null;
}
