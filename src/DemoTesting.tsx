import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

const THAILAND_CENTER: [number, number] = [13.5, 101.0];
const INITIAL_ZOOM = 6;

// Generate distinct colors for sectors
const getSectorColor = (name: string): string => {
  const colors: Record<string, string> = {
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
  return colors[name] || '#888888';
};

export default function DemoTesting() {
  const [geoData, setGeoData] = useState<GeoJSONData | null>(null);

  useEffect(() => {
    fetch('/bacc_geo.geojson')
      .then((res) => res.json())
      .then((data) => setGeoData(data))
      .catch((err) => console.error('Failed to load BACC GeoJSON:', err));
  }, []);

  const onEachFeature = (feature: GeoJSONFeature, layer: L.Layer) => {
    const { name, upper, lower } = feature.properties;
    const tooltipContent = `<strong>${name}</strong><br/>FL${lower} - FL${upper}`;
    
    layer.bindTooltip(tooltipContent, {
      permanent: true,
      direction: 'center',
      className: 'bacc-label',
    });
  };

  const style = (feature: GeoJSONFeature | undefined) => {
    if (!feature) return {};
    const color = getSectorColor(feature.properties.name);
    return {
      fillColor: color,
      weight: 1.5,
      opacity: 1,
      color: '#ffffff',
      fillOpacity: 0.4,
    };
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <MapContainer
        center={THAILAND_CENTER}
        zoom={INITIAL_ZOOM}
        style={{ width: '100%', height: '100%', background: '#0a0a0a' }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        
        {geoData && (
          <GeoJSON
            data={geoData as any}
            style={style as any}
            onEachFeature={onEachFeature as any}
          />
        )}
      </MapContainer>

      <style>{`
        .bacc-label {
          background: rgba(0, 0, 0, 0.8) !important;
          border: 1px solid rgba(255, 255, 255, 0.3) !important;
          border-radius: 4px !important;
          color: #fff !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          padding: 4px 8px !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5) !important;
        }
        .bacc-label::before {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
