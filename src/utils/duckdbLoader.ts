// file: utils/duckdbLoader.ts
/**
 * DuckDB WASM loader for Parquet files.
 * Used ONLY for PostgreSQL-derived datasets (not CSV uploads).
 */
import * as duckdb from '@duckdb/duckdb-wasm';
import type { FlightPoint, FlightMeta } from '../types/flight';
import { getFlightColor } from '../store/flightStore';

const CONFIG = {
  sampleDistance: 0.002, // Min distance between points (~200m)
};

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;
let initPromise: Promise<duckdb.AsyncDuckDB> | null = null;

async function initDuckDB(): Promise<duckdb.AsyncDuckDB> {
  if (db) return db;
  
  // Prevent multiple simultaneous initializations
  if (initPromise) return initPromise;

  initPromise = (async () => {
    console.log('[DuckDB] Starting initialization...');
    const startTime = performance.now();
    
    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

    const worker_url = URL.createObjectURL(
      new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
    );

    const worker = new Worker(worker_url);
    const logger = new duckdb.ConsoleLogger();
    db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(worker_url);

    console.log(`[DuckDB] Initialized in ${(performance.now() - startTime).toFixed(0)}ms`);
    return db;
  })();

  return initPromise;
}

// Pre-initialize DuckDB when module loads (background)
initDuckDB().catch(err => console.warn('[DuckDB] Pre-init failed:', err));

async function getConnection(): Promise<duckdb.AsyncDuckDBConnection> {
  if (conn) return conn;
  const database = await initDuckDB();
  conn = await database.connect();
  return conn;
}

export interface ParquetLoadResult {
  flights: Record<string, FlightPoint[]>;
  flightMeta: Record<string, FlightMeta>;
  stats: {
    minFL: number;
    maxFL: number;
    totalRows: number;
  };
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

interface RawFlightData {
  points: [number, number, number, number | null, string | null, number | null, number | null, number | null, number | null][];
  actype: string | null;
  dep: string | null;
  dest: string | null;
}

export async function loadParquetFromUrl(
  url: string,
  onProgress?: (stage: string, percent: number, rows: number) => void
): Promise<ParquetLoadResult> {
  try {
    onProgress?.('Initializing DuckDB', 5, 0);

    const connection = await getConnection();
    const database = db!;

    onProgress?.('Downloading Parquet', 10, 0);

    // Fetch the parquet file
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch parquet: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    console.log('[DuckDB] Downloaded parquet file:', uint8Array.length, 'bytes');

    onProgress?.('Registering file', 20, 0);

    // Register the file with DuckDB
    await database.registerFileBuffer('dataset.parquet', uint8Array);

    onProgress?.('Querying data', 30, 0);

    // Just select all columns and handle missing ones in JS
    console.log('[DuckDB] Running query - selecting all data...');
    const result = await connection.query(`
      SELECT * FROM 'dataset.parquet'
      WHERE flight_key IS NOT NULL 
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
    `);

  onProgress?.('Processing rows', 50, 0);

  const rawFlights: Record<string, RawFlightData> = {};
  let rowCount = 0;
  let globalMinFL = Infinity;
  let globalMaxFL = -Infinity;

  // Process results
  const rows = result.toArray();
  const totalRows = rows.length;
  
  console.log('[DuckDB] Processing', totalRows, 'rows');

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const key = row.flight_key?.toString();
    if (!key || key === 'nan' || key === 'NaN' || key === 'undefined' || key === 'null') continue;

    const lat = Number(row.latitude);
    const lon = Number(row.longitude);
    // Support both timestamp column names
    const timestamp = row.timestamp_utc || row.time_of_track;
    const t = timestamp ? new Date(timestamp).getTime() : NaN;

    if (isNaN(lat) || isNaN(lon) || isNaN(t)) continue;

    // Support both flight level column names
    const fl = Number(row.flight_level ?? row.measured_fl);

    if (!rawFlights[key]) {
      rawFlights[key] = {
        points: [],
        actype: row.actype?.toString() || null,
        dep: row.dep?.toString() || null,
        dest: row.dest?.toString() || null,
      };
    }

    const actype = row.actype?.toString();
    const dep = row.dep?.toString();
    const dest = row.dest?.toString();
    if (!rawFlights[key].actype && actype) rawFlights[key].actype = actype;
    if (!rawFlights[key].dep && dep) rawFlights[key].dep = dep;
    if (!rawFlights[key].dest && dest) rawFlights[key].dest = dest;

    const ias = Number(row.ias_dap);
    const magHeading = Number(row.mag_heading_dap ?? row.heading);
    const rateCD = Number(row.rate_cd);
    const vert = Number(row.vert);

    rawFlights[key].points.push([
      t,
      lat,
      lon,
      !isNaN(fl) ? fl : null,
      row.acid?.toString() || null,
      !isNaN(ias) ? ias : null,
      !isNaN(magHeading) ? magHeading : null,
      !isNaN(rateCD) ? rateCD : null,
      !isNaN(vert) ? vert : null,
    ]);
    rowCount++;

    if (!isNaN(fl)) {
      if (fl < globalMinFL) globalMinFL = fl;
      if (fl > globalMaxFL) globalMaxFL = fl;
    }

    // Progress update every 100k rows
    if (i % 100000 === 0) {
      const percent = 50 + (i / totalRows) * 40;
      onProgress?.('Processing rows', percent, i);
    }
  }

  onProgress?.('Building flights', 92, rowCount);

  // Build flight data structures
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

  onProgress?.('Complete', 100, sampledTotal);

  console.log(`[DuckDB] Loaded ${Object.keys(flights).length} flights, ${sampledTotal} points (${(100 * sampledTotal / rowCount).toFixed(1)}% of ${rowCount})`);

  return {
    flights,
    flightMeta,
    stats: {
      minFL: globalMinFL === Infinity ? 0 : globalMinFL,
      maxFL: globalMaxFL === -Infinity ? 500 : globalMaxFL,
      totalRows: sampledTotal,
    },
  };
  } catch (error) {
    console.error('[DuckDB] Error loading parquet:', error);
    throw error;
  }
}

export async function closeDuckDB(): Promise<void> {
  if (conn) {
    await conn.close();
    conn = null;
  }
  if (db) {
    await db.terminate();
    db = null;
  }
}
