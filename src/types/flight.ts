export interface FlightPoint {
  t: number;
  lat: number;
  lon: number;
  heading: number;
  fl: number | null;
  acid: string | null;
  ias: number | null;      // ias_dap - indicated airspeed
  magHeading: number | null; // mag_heading_dap - magnetic heading
  rateCD: number | null;   // rate_cd - climb/descend rate (positive=climb, negative=descend)
  vert: number | null;     // vert - vertical direction (1=climb, 2=descend, 0/3=level)
}

export interface FlightMeta {
  color: string;
  visible: boolean;
  currentIdx: number;
  actype: string | null;
  dep: string | null;
  dest: string | null;
}

export interface FlightData {
  points: FlightPoint[];
  meta: FlightMeta;
}

export interface FilterState {
  searchText: string;
  searchFields: ('flight_key' | 'acid')[];
  flMin: number;
  flMax: number;
  actype: string;
  dep: string;
  dest: string;
  routeType: 'all' | 'inbound' | 'outbound' | 'domestic' | 'overfly';
}

export interface TimelineState {
  start: number;
  end: number;
  originalStart: number;
  originalEnd: number;
  current: number;
}
