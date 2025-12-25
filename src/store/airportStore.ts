import { create } from 'zustand';

export interface Runway {
  fid: number;
  airport_identifier: string;
  runway_identifier: string;
  lat1: number;  // threshold 1
  lon1: number;
  lat2: number;  // threshold 2
  lon2: number;
  true_bearing: number;
  length: number;  // in feet
  width: number;   // in feet
}

export interface Airport {
  fid: number;
  area_code: string;
  icao_code: string;
  airport_identifier: string;
  airport_identifier_3letter: string;
  airport_name: string;
  airport_ref_latitude: number;
  airport_ref_longitude: number;
  ifr_capability: string;
  longest_runway_surface_code: string;
  elevation: number;
  transition_altitude: number;
  transition_level: number;
  speed_limit: number;
  speed_limit_altitude: number;
  iata_ata_designator: string;
  id: string;
  AP: string;
  Main: string;
  visible: boolean;
}

interface AirportStore {
  airports: Airport[];
  runways: Runway[];
  selectedAirport: Airport | null;
  airportPanelOpen: boolean;
  airportDropdownOpen: boolean;
  runwaysVisible: boolean;
  setAirports: (airports: Airport[]) => void;
  setRunways: (runways: Runway[]) => void;
  setSelectedAirport: (airport: Airport | null) => void;
  setAirportPanelOpen: (open: boolean) => void;
  setAirportDropdownOpen: (open: boolean) => void;
  setRunwaysVisible: (visible: boolean) => void;
  toggleAirportVisibility: (fid: number) => void;
  showAllAirports: () => void;
  hideAllAirports: () => void;
}

export const useAirportStore = create<AirportStore>((set) => ({
  airports: [],
  runways: [],
  selectedAirport: null,
  airportPanelOpen: false,
  airportDropdownOpen: false,
  runwaysVisible: true,
  
  setAirports: (airports) => set({ airports }),
  
  setRunways: (runways) => set({ runways }),
  
  setSelectedAirport: (airport) => set({ selectedAirport: airport, airportPanelOpen: !!airport }),
  
  setAirportPanelOpen: (open) => set({ airportPanelOpen: open, selectedAirport: open ? undefined : null }),
  
  setAirportDropdownOpen: (open) => set({ airportDropdownOpen: open }),
  
  setRunwaysVisible: (visible) => set({ runwaysVisible: visible }),
  
  toggleAirportVisibility: (fid) => set((state) => ({
    airports: state.airports.map(a => a.fid === fid ? { ...a, visible: !a.visible } : a)
  })),
  
  showAllAirports: () => set((state) => ({
    airports: state.airports.map(a => ({ ...a, visible: true }))
  })),
  
  hideAllAirports: () => set((state) => ({
    airports: state.airports.map(a => ({ ...a, visible: false }))
  })),
}));

// Parse airport CSV
export async function loadAirports(): Promise<Airport[]> {
  const response = await fetch('/Airport_with_AP_Main.csv');
  const text = await response.text();
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');
  
  const airports: Airport[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    if (values.length < headers.length) continue;
    
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h.trim()] = values[idx]?.trim() || ''; });
    
    airports.push({
      fid: parseInt(row.fid) || 0,
      area_code: row.area_code || '',
      icao_code: row.icao_code || '',
      airport_identifier: row.airport_identifier || '',
      airport_identifier_3letter: row.airport_identifier_3letter || '',
      airport_name: row.airport_name || '',
      airport_ref_latitude: parseFloat(row.airport_ref_latitude) || 0,
      airport_ref_longitude: parseFloat(row.airport_ref_longitude) || 0,
      ifr_capability: row.ifr_capability || 'N',
      longest_runway_surface_code: row.longest_runway_surface_code || '',
      elevation: parseInt(row.elevation) || 0,
      transition_altitude: parseInt(row.transition_altitude) || 0,
      transition_level: parseInt(row.transition_level) || 0,
      speed_limit: parseInt(row.speed_limit) || 0,
      speed_limit_altitude: parseInt(row.speed_limit_altitude) || 0,
      iata_ata_designator: row.iata_ata_designator || '',
      id: row.id || '',
      AP: row.AP || row.airport_name || '',
      Main: row.Main || 'N',
      visible: true,
    });
  }
  
  return airports;
}

// Parse runway CSV - pair up opposite thresholds
export async function loadRunways(): Promise<Runway[]> {
  const response = await fetch('/runway.csv');
  const text = await response.text();
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');
  
  // First pass: collect all runway entries by airport
  const byAirport: Record<string, { lat: number; lon: number; bearing: number; length: number; width: number; id: string; fid: number; num: number; suffix: string }[]> = {};
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    if (values.length < headers.length) continue;
    
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h.trim()] = values[idx]?.trim() || ''; });
    
    const airportId = row.airport_identifier || '';
    const runwayId = row.runway_identifier || '';  // e.g., "RW02L", "RW20R"
    
    // Parse runway number and suffix (L/R/C)
    const match = runwayId.match(/RW(\d+)([LRC]?)/);
    if (!match) continue;
    const num = parseInt(match[1]) || 0;
    const suffix = match[2] || '';
    
    if (!byAirport[airportId]) byAirport[airportId] = [];
    byAirport[airportId].push({
      lat: parseFloat(row.runway_latitude) || 0,
      lon: parseFloat(row.runway_longitude) || 0,
      bearing: parseFloat(row.runway_true_bearing) || 0,
      length: parseFloat(row.runway_length) || 0,
      width: parseFloat(row.runway_width) || 0,
      id: runwayId,
      fid: parseInt(row.fid) || 0,
      num,
      suffix,
    });
  }
  
  // Second pass: pair runways (opposite ends differ by 18, L pairs with R)
  const runways: Runway[] = [];
  const used = new Set<string>();
  
  for (const airportId in byAirport) {
    const entries = byAirport[airportId];
    
    for (const e1 of entries) {
      const key1 = `${airportId}-${e1.id}`;
      if (used.has(key1)) continue;
      
      // Find opposite threshold: number differs by 18, L<->R swap
      const oppositeNum = e1.num <= 18 ? e1.num + 18 : e1.num - 18;
      const oppositeSuffix = e1.suffix === 'L' ? 'R' : e1.suffix === 'R' ? 'L' : e1.suffix;
      
      const e2 = entries.find(e => 
        e.num === oppositeNum && 
        e.suffix === oppositeSuffix &&
        !used.has(`${airportId}-${e.id}`)
      );
      
      if (e2) {
        used.add(key1);
        used.add(`${airportId}-${e2.id}`);
        
        runways.push({
          fid: e1.fid,
          airport_identifier: airportId,
          runway_identifier: `${e1.id}/${e2.id}`,
          lat1: e1.lat,
          lon1: e1.lon,
          lat2: e2.lat,
          lon2: e2.lon,
          true_bearing: e1.bearing,
          length: e1.length,
          width: e1.width,
        });
      } else {
        // No pair found - calculate other end from bearing and length
        used.add(key1);
        const lengthM = e1.length * 0.3048;
        const bearingRad = (e1.bearing * Math.PI) / 180;
        const latPerMeter = 1 / 111320;
        const lonPerMeter = 1 / (111320 * Math.cos(e1.lat * Math.PI / 180));
        
        runways.push({
          fid: e1.fid,
          airport_identifier: airportId,
          runway_identifier: e1.id,
          lat1: e1.lat,
          lon1: e1.lon,
          lat2: e1.lat + Math.cos(bearingRad) * lengthM * latPerMeter,
          lon2: e1.lon + Math.sin(bearingRad) * lengthM * lonPerMeter,
          true_bearing: e1.bearing,
          length: e1.length,
          width: e1.width,
        });
      }
    }
  }
  
  return runways;
}

// Helper to convert runway surface code to readable text
export function getRunwaySurfaceText(code: string): string {
  const surfaces: Record<string, string> = {
    'H': 'Hard (Asphalt/Concrete)',
    'S': 'Soft (Grass/Dirt)',
    'W': 'Water',
    'U': 'Unknown',
    'A': 'Asphalt',
    'C': 'Concrete',
    'G': 'Grass',
    'T': 'Turf',
    'D': 'Dirt',
    'GR': 'Gravel',
  };
  return surfaces[code] || code || 'Unknown';
}
