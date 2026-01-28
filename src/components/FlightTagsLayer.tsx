import { useEffect, useRef, useMemo } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useFlightStore } from '../store/flightStore';

interface FlightPoint {
  t: number;
  lat: number;
  lon: number;
  fl: number | null;
  ias: number | null;
  magHeading: number | null;
  acid?: string | null;
}

export function FlightTagsLayer() {
  const map = useMap();
  const tagsLayerRef = useRef<L.LayerGroup | null>(null);
  
  const tagsVisible = useFlightStore(state => state.tagsVisible);
  const tagDisplayOptions = useFlightStore(state => state.tagDisplayOptions);
  const flights = useFlightStore(state => state.flights);
  const flightMeta = useFlightStore(state => state.flightMeta);
  const timeline = useFlightStore(state => state.timeline);
  const lightMode = useFlightStore(state => state.lightMode);
  const airportFilterCode = useFlightStore(state => state.airportFilterCode);
  
  // Get current zoom level for size scaling
  const getTagSize = (zoom: number): { fontSize: number; padding: string } => {
    // Base size at zoom 6, scale down as zoom increases (more zoomed in = smaller tags)
    // Scale up slightly as zoom decreases (more zoomed out = slightly larger tags, but capped)
    if (zoom <= 4) return { fontSize: 7, padding: '1px 3px' };
    if (zoom <= 5) return { fontSize: 7, padding: '1px 3px' };
    if (zoom <= 6) return { fontSize: 8, padding: '2px 4px' };
    if (zoom <= 7) return { fontSize: 8, padding: '2px 4px' };
    if (zoom <= 8) return { fontSize: 9, padding: '2px 4px' };
    if (zoom <= 9) return { fontSize: 9, padding: '2px 5px' };
    return { fontSize: 10, padding: '2px 5px' };
  };

  // Calculate visible flights at current time
  const visibleFlights = useMemo(() => {
    const currentTime = timeline.current;
    const result: { key: string; lat: number; lon: number; color: string; fl: number | null; ias: number | null; hdg: number | null; acid: string | null }[] = [];
    
    Object.entries(flights).forEach(([key, points]) => {
      const meta = flightMeta[key];
      if (!meta?.visible) return;
      
      // When airport filter is active, only show tags for matching flights
      if (airportFilterCode) {
        const matchesDep = meta.dep?.toUpperCase() === airportFilterCode.toUpperCase();
        const matchesDest = meta.dest?.toUpperCase() === airportFilterCode.toUpperCase();
        if (!matchesDep && !matchesDest) return;
      }
      
      const flightPoints = points as FlightPoint[];
      if (!flightPoints || flightPoints.length === 0) return;
      
      // Find position at current time using binary search
      let left = 0;
      let right = flightPoints.length - 1;
      
      // Check if current time is within flight range
      if (currentTime < flightPoints[0].t || currentTime > flightPoints[right].t) return;
      
      while (left < right) {
        const mid = Math.floor((left + right) / 2);
        if (flightPoints[mid].t < currentTime) {
          left = mid + 1;
        } else {
          right = mid;
        }
      }
      
      // Get current point data
      const idx = left;
      const currentPoint = idx === 0 ? flightPoints[0] : flightPoints[idx];
      
      if (idx === 0) {
        result.push({ 
          key, 
          lat: flightPoints[0].lat, 
          lon: flightPoints[0].lon, 
          color: meta.color,
          fl: currentPoint.fl,
          ias: currentPoint.ias,
          hdg: currentPoint.magHeading,
          acid: currentPoint.acid || null
        });
      } else {
        const p1 = flightPoints[idx - 1];
        const p2 = flightPoints[idx];
        const ratio = (currentTime - p1.t) / (p2.t - p1.t);
        const lat = p1.lat + (p2.lat - p1.lat) * ratio;
        const lon = p1.lon + (p2.lon - p1.lon) * ratio;
        result.push({ 
          key, 
          lat, 
          lon, 
          color: meta.color,
          fl: currentPoint.fl,
          ias: currentPoint.ias,
          hdg: currentPoint.magHeading,
          acid: currentPoint.acid || null
        });
      }
    });
    
    return result;
  }, [flights, flightMeta, timeline.current, airportFilterCode]);

  // Update tags when visibility, time, or zoom changes
  useEffect(() => {
    // Remove existing tags
    if (tagsLayerRef.current) {
      tagsLayerRef.current.clearLayers();
      if (map.hasLayer(tagsLayerRef.current)) {
        map.removeLayer(tagsLayerRef.current);
      }
    }
    
    if (!tagsVisible) return;
    
    tagsLayerRef.current = L.layerGroup();
    const zoom = map.getZoom();
    const { fontSize, padding } = getTagSize(zoom);
    
    visibleFlights.forEach(({ key, lat, lon, fl, ias, hdg, acid }) => {
      const bgColor = lightMode ? 'rgba(255, 255, 255, 0.95)' : 'rgba(20, 20, 30, 0.9)';
      const textColor = lightMode ? '#222' : '#fff';
      const borderColor = lightMode ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.4)';
      
      // Build display text from enabled options
      const parts: string[] = [];
      if (tagDisplayOptions.callsign) {
        parts.push(acid || (key.includes('_') ? key.split('_')[0] : key));
      }
      if (tagDisplayOptions.fl) {
        parts.push(fl != null ? `FL${Math.round(fl)}` : '--');
      }
      if (tagDisplayOptions.ias) {
        parts.push(ias != null ? `${Math.round(ias)}kt` : '--');
      }
      if (tagDisplayOptions.hdg) {
        parts.push(hdg != null ? `${Math.round(hdg)}°` : '--');
      }
      const displayText = parts.length > 0 ? parts.join(' ') : '--';
      
      const icon = L.divIcon({
        className: 'flight-tag',
        html: `<div class="flight-tag-label" style="
          display: inline-block;
          font-size: ${fontSize}px;
          padding: ${padding};
          background: ${bgColor};
          color: ${textColor};
          border: 1px solid ${borderColor};
          border-radius: 3px;
          white-space: nowrap;
          font-family: 'Consolas', 'Monaco', monospace;
          font-weight: 600;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          pointer-events: none;
          line-height: 1.2;
        ">${displayText}</div>`,
        iconSize: undefined as any,
        iconAnchor: [-10, 10],
      });
      
      const marker = L.marker([lat, lon], { icon, interactive: false });
      tagsLayerRef.current?.addLayer(marker);
    });
    
    tagsLayerRef.current.addTo(map);
    
    return () => {
      if (tagsLayerRef.current && map.hasLayer(tagsLayerRef.current)) {
        map.removeLayer(tagsLayerRef.current);
      }
    };
  }, [tagsVisible, visibleFlights, lightMode, map, tagDisplayOptions]);

  // Update on zoom change
  useEffect(() => {
    if (!tagsVisible) return;
    
    const handleZoom = () => {
      // Force re-render by triggering the main effect
      if (tagsLayerRef.current) {
        tagsLayerRef.current.clearLayers();
        
        const zoom = map.getZoom();
        const { fontSize, padding } = getTagSize(zoom);
        
        visibleFlights.forEach(({ key, lat, lon, fl, ias, hdg, acid }) => {
          const bgColor = lightMode ? 'rgba(255, 255, 255, 0.95)' : 'rgba(20, 20, 30, 0.9)';
          const textColor = lightMode ? '#222' : '#fff';
          const borderColor = lightMode ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.4)';
          
          // Build display text from enabled options
          const parts: string[] = [];
          if (tagDisplayOptions.callsign) {
            parts.push(acid || (key.includes('_') ? key.split('_')[0] : key));
          }
          if (tagDisplayOptions.fl) {
            parts.push(fl != null ? `FL${Math.round(fl)}` : '--');
          }
          if (tagDisplayOptions.ias) {
            parts.push(ias != null ? `${Math.round(ias)}kt` : '--');
          }
          if (tagDisplayOptions.hdg) {
            parts.push(hdg != null ? `${Math.round(hdg)}°` : '--');
          }
          const displayText = parts.length > 0 ? parts.join(' ') : '--';
          
          const icon = L.divIcon({
            className: 'flight-tag',
            html: `<div class="flight-tag-label" style="
              display: inline-block;
              font-size: ${fontSize}px;
              padding: ${padding};
              background: ${bgColor};
              color: ${textColor};
              border: 1px solid ${borderColor};
              border-radius: 3px;
              white-space: nowrap;
              font-family: 'Consolas', 'Monaco', monospace;
              font-weight: 600;
              box-shadow: 0 1px 4px rgba(0,0,0,0.3);
              pointer-events: none;
              line-height: 1.2;
            ">${displayText}</div>`,
            iconSize: undefined as any,
            iconAnchor: [-10, 10],
          });
          
          const marker = L.marker([lat, lon], { icon, interactive: false });
          tagsLayerRef.current?.addLayer(marker);
        });
      }
    };
    
    map.on('zoomend', handleZoom);
    return () => {
      map.off('zoomend', handleZoom);
    };
  }, [tagsVisible, visibleFlights, lightMode, map, tagDisplayOptions]);

  return null;
}
