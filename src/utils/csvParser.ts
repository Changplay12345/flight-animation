import Papa from 'papaparse';
import type { FlightPoint, FlightMeta } from '../types/flight';
import { getFlightColor } from '../store/flightStore';

const CONFIG = {
  sampleDistance: 0.002, // Min distance between points (~200m)
};

interface RawFlightData {
  points: [number, number, number, number | null, string | null, number | null, number | null, number | null, number | null][];
  actype: string | null;
  dep: string | null;
  dest: string | null;
}

function computeBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => deg * Math.PI / 180;
  const toDeg = (rad: number) => rad * 180 / Math.PI;
  
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);
  
  const x = Math.sin(Δλ) * Math.cos(φ2);
  const y = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  
  let bearing = toDeg(Math.atan2(x, y));
  return (bearing + 360) % 360;
}

export interface ParseResult {
  flights: Record<string, FlightPoint[]>;
  flightMeta: Record<string, FlightMeta>;
  stats: {
    minFL: number;
    maxFL: number;
    totalRows: number;
  };
}

export function parseCSV(
  file: File,
  onProgress?: (loaded: number) => void
): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const rawFlights: Record<string, RawFlightData> = {};
    let rowCount = 0;
    let chunkCount = 0;
    let globalMinFL = Infinity;
    let globalMaxFL = -Infinity;
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      chunkSize: 1024 * 1024,
      chunk: (results) => {
        chunkCount++;
        const data = results.data as Record<string, string>[];
        
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const key = row.flight_key;
          // Skip invalid flight_key (empty, nan, undefined)
          if (!key || key === 'nan' || key === 'NaN' || key === 'undefined' || key === 'null') continue;
          
          const lat = +row.latitude;
          const lon = +row.longitude;
          // Support both time_of_track and timestamp_utc column names (prefer time_of_track)
          const t = Date.parse(row.time_of_track || row.timestamp_utc);
          
          if (lat !== lat || lon !== lon || t !== t) continue;
          
          // Support both flight_level and measured_fl column names
          const fl = +(row.flight_level || row.measured_fl);
          
          if (!rawFlights[key]) {
            rawFlights[key] = {
              points: [],
              actype: (row.actype && row.actype.trim()) || null,
              dep: (row.dep && row.dep.trim()) || null,
              dest: (row.dest && row.dest.trim()) || null,
            };
          }
          
          // Update actype/dep/dest if current row has value and stored is empty
          const actype = row.actype && row.actype.trim();
          const dep = row.dep && row.dep.trim();
          const dest = row.dest && row.dest.trim();
          if (!rawFlights[key].actype && actype) rawFlights[key].actype = actype;
          if (!rawFlights[key].dep && dep) rawFlights[key].dep = dep;
          if (!rawFlights[key].dest && dest) rawFlights[key].dest = dest;
          
          const ias = +row.ias_dap;
          const magHeading = +row.mag_heading_dap;
          const rateCD = +row.rate_cd;
          const vert = +row.vert;
          
          rawFlights[key].points.push([
            t,
            lat,
            lon,
            fl === fl ? fl : null,
            row.acid || null,
            ias === ias ? ias : null,
            magHeading === magHeading ? magHeading : null,
            rateCD === rateCD ? rateCD : null,
            vert === vert ? vert : null,
          ]);
          rowCount++;
          
          if (fl === fl) {
            if (fl < globalMinFL) globalMinFL = fl;
            if (fl > globalMaxFL) globalMaxFL = fl;
          }
        }
        
        if (chunkCount % 5 === 0 && onProgress) {
          onProgress(rowCount);
        }
      },
      complete: () => {
        const result = buildFlights(rawFlights, rowCount, globalMinFL, globalMaxFL);
        resolve(result);
      },
      error: reject,
    });
  });
}

function buildFlights(
  rawFlights: Record<string, RawFlightData>,
  rowCount: number,
  globalMinFL: number,
  globalMaxFL: number
): ParseResult {
  const minDistSq = CONFIG.sampleDistance * CONFIG.sampleDistance;
  const flights: Record<string, FlightPoint[]> = {};
  const flightMeta: Record<string, FlightMeta> = {};
  let colorIdx = 0;
  let sampledTotal = 0;
  
  for (const [key, flightData] of Object.entries(rawFlights)) {
    const raw = flightData.points;
    raw.sort((a, b) => a[0] - b[0]);
    
    // Sample by distance
    const sampled = [raw[0]];
    for (let i = 1; i < raw.length; i++) {
      const last = sampled[sampled.length - 1];
      const dlat = raw[i][1] - last[1];
      const dlon = raw[i][2] - last[2];
      if (dlat * dlat + dlon * dlon >= minDistSq) {
        sampled.push(raw[i]);
      }
    }
    if (sampled[sampled.length - 1] !== raw[raw.length - 1]) {
      sampled.push(raw[raw.length - 1]);
    }
    
    // Build points with headings
    const points: FlightPoint[] = [];
    for (let i = 0; i < sampled.length; i++) {
      const [t, lat, lon, fl, acid, ias, magHeading, rateCD, vert] = sampled[i];
      let heading = 0;
      if (i < sampled.length - 1) {
        heading = computeBearing(lat, lon, sampled[i + 1][1], sampled[i + 1][2]);
      } else if (points.length > 0) {
        heading = points[points.length - 1].heading;
      }
      points.push({ t, lat, lon, heading, fl, acid, ias, magHeading, rateCD, vert });
    }
    
    sampledTotal += points.length;
    
    flights[key] = points;
    flightMeta[key] = {
      color: getFlightColor(colorIdx),
      visible: true,
      currentIdx: 0,
      actype: flightData.actype,
      dep: flightData.dep,
      dest: flightData.dest,
    };
    colorIdx++;
  }
  
  console.log(`Loaded ${Object.keys(flights).length} flights, ${sampledTotal} points (${(100 * sampledTotal / rowCount).toFixed(1)}% of ${rowCount})`);
  
  return {
    flights,
    flightMeta,
    stats: {
      minFL: globalMinFL === Infinity ? 0 : globalMinFL,
      maxFL: globalMaxFL === -Infinity ? 500 : globalMaxFL,
      totalRows: sampledTotal,
    },
  };
}
