import { create } from 'zustand';
import type { FlightPoint, FlightMeta, FilterState, TimelineState } from '../types/flight';

// Dark mode colors (can include light colors)
const COLORS_DARK = [
  '#e94560', '#00d9ff', '#ffd700', '#00ff88', '#ff6b6b',
  '#4ecdc4', '#ff9f43', '#a55eea', '#26de81', '#fd79a8',
  '#74b9ff', '#ffeaa7', '#dfe6e9', '#81ecec', '#fab1a0',
  '#ff7675', '#a29bfe', '#fdcb6e', '#6c5ce7', '#00b894'
];

// Light mode colors (darker, more saturated - no yellows, whites, light grays)
const COLORS_LIGHT = [
  '#e94560', '#0088cc', '#ff5722', '#00875a', '#d32f2f',
  '#00838f', '#e65100', '#7b1fa2', '#1b5e20', '#c2185b',
  '#1565c0', '#bf360c', '#4527a0', '#006064', '#ad1457',
  '#c62828', '#512da8', '#e64a19', '#4a148c', '#00695c'
];

let currentLightMode = false;

const TIMELINE_PADDING_MS = 30000;

interface FlightStore {
  // Flight data
  flights: Record<string, FlightPoint[]>;
  flightMeta: Record<string, FlightMeta>;
  
  // Global stats
  globalMinFL: number;
  globalMaxFL: number;
  totalRowsLoaded: number;
  
  // Timeline
  timeline: TimelineState;
  
  // Animation
  isPlaying: boolean;
  speedMultiplier: number;
  
  // Trails
  trailsVisible: boolean;
  flTrailsVisible: boolean;
  showFullTrails: boolean;
  trailDecayMinutes: number; // 0 = no decay (show from start), >0 = only show last N minutes
  
  // Filter
  filter: FilterState;
  filterPanelOpen: boolean;
  
  // Locked flight (for tooltip tracking)
  lockedFlightKey: string | null;
  
  // Theme
  lightMode: boolean;
  satelliteMode: boolean;
  
  // UI State
  uiHidden: boolean;
  
  // Airways
  airwaysVisible: boolean;
  
  // Gates
  gatesVisible: boolean;
  
  // Tags (flight key labels)
  tagsVisible: boolean;
  tagDisplayOptions: {
    callsign: boolean;
    fl: boolean;
    ias: boolean;
    hdg: boolean;
  };
  
  // Airway Panel
  selectedAirway: string | null;
  airwayOpacity: number;
  airwayPanelOpen: boolean;
  airwayLabelsVisible: boolean;
  airwayVorVisible: boolean;
  airwayReportingVisible: boolean;
  
  // Options Panel
  optionsPanelOpen: boolean;
  optionsPanelTab: 'airports' | 'gates' | 'sid' | 'star' | 'pbn' | 'ils';
  
  // SID (Standard Instrument Departure)
  sidVisible: boolean;
  sidWaypointsVisible: boolean;
  sidOpacity: number;
  sidLineWeight: number;
  sidAirportFilter: string[];
  sidProcedureFilter: string[];
  
  // STAR (Standard Terminal Arrival Route)
  starVisible: boolean;
  starWaypointsVisible: boolean;
  starOpacity: number;
  starLineWeight: number;
  starAirportFilter: string[];
  starProcedureFilter: string[];
  
  // PBN (Performance Based Navigation)
  pbnVisible: boolean;
  pbnLegsVisible: boolean;
  pbnWaypointsVisible: boolean;
  pbnOpacity: number;
  pbnLineWeight: number;
  pbnAirportFilter: string[];
  pbnProcedureFilter: string[];
  
  // ILS (Instrument Landing System)
  ilsVisible: boolean;
  ilsLegsVisible: boolean;
  ilsWaypointsVisible: boolean;
  ilsOpacity: number;
  ilsLineWeight: number;
  ilsAirportFilter: string[];
  ilsProcedureFilter: string[];
  
  // Sector Layers (bacc, ctr, fir_world, bacc_subsector, pdr, tma)
  sectorLayers: Record<string, {
    visible: boolean;
    labelsVisible: boolean;
    fillVisible: boolean;
    opacity: number;
  }>;
  
  // Airport Filter (DEP/DEST color override)
  airportFilterCode: string; // Selected airport ICAO code for filtering
  
  // Airline Mode (color by airline)
  airlineModeEnabled: boolean;
  airlineColors: Record<string, string>; // airline code -> color
  selectedAirlines: string[]; // selected airlines to show
  
  // Actions
  setFlights: (flights: Record<string, FlightPoint[]>, meta: Record<string, FlightMeta>, stats: { minFL: number; maxFL: number; totalRows: number }) => void;
  setVisibility: (key: string, visible: boolean) => void;
  setAllVisibility: (visible: boolean) => void;
  invertVisibility: () => void;
  
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
  setCurrentTime: (time: number) => void;
  
  setTrailsVisible: (visible: boolean) => void;
  setFlTrailsVisible: (visible: boolean) => void;
  setShowFullTrails: (show: boolean) => void;
  setTrailDecayMinutes: (minutes: number) => void;
  
  setFilter: (filter: Partial<FilterState>) => void;
  setFilterPanelOpen: (open: boolean) => void;
  applyFilter: (matchingKeys: string[]) => void;
  clearFilter: () => void;
  
  setLockedFlight: (key: string | null) => void;
  lockToFlight: (key: string) => void;
  focusFlight: (key: string, withZoom?: boolean, jumpToStart?: boolean) => void;
  
  setLightMode: (light: boolean) => void;
  setSatelliteMode: (satellite: boolean) => void;
  setUiHidden: (hidden: boolean) => void;
  setAirwaysVisible: (visible: boolean) => void;
  setGatesVisible: (visible: boolean) => void;
  setTagsVisible: (visible: boolean) => void;
  setTagDisplayOption: (option: 'callsign' | 'fl' | 'ias' | 'hdg', enabled: boolean) => void;
  setSelectedAirway: (route: string | null) => void;
  setAirwayOpacity: (opacity: number) => void;
  setAirwayPanelOpen: (open: boolean) => void;
  setAirwayLabelsVisible: (visible: boolean) => void;
  setAirwayVorVisible: (visible: boolean) => void;
  setAirwayReportingVisible: (visible: boolean) => void;
  setOptionsPanelOpen: (open: boolean) => void;
  setOptionsPanelTab: (tab: 'airports' | 'gates' | 'sid' | 'star' | 'pbn' | 'ils') => void;
  
  setSidVisible: (visible: boolean) => void;
  setSidWaypointsVisible: (visible: boolean) => void;
  setSidOpacity: (opacity: number) => void;
  setSidLineWeight: (weight: number) => void;
  setSidAirportFilter: (filter: string[]) => void;
  setSidProcedureFilter: (filter: string[]) => void;
  
  setStarVisible: (visible: boolean) => void;
  setStarWaypointsVisible: (visible: boolean) => void;
  setStarOpacity: (opacity: number) => void;
  setStarLineWeight: (weight: number) => void;
  setStarAirportFilter: (filter: string[]) => void;
  setStarProcedureFilter: (filter: string[]) => void;
  
  setPbnVisible: (visible: boolean) => void;
  setPbnLegsVisible: (visible: boolean) => void;
  setPbnWaypointsVisible: (visible: boolean) => void;
  setPbnOpacity: (opacity: number) => void;
  setPbnLineWeight: (weight: number) => void;
  setPbnAirportFilter: (filter: string[]) => void;
  setPbnProcedureFilter: (filter: string[]) => void;
  
  setIlsVisible: (visible: boolean) => void;
  setIlsLegsVisible: (visible: boolean) => void;
  setIlsWaypointsVisible: (visible: boolean) => void;
  setIlsOpacity: (opacity: number) => void;
  setIlsLineWeight: (weight: number) => void;
  setIlsAirportFilter: (filter: string[]) => void;
  setIlsProcedureFilter: (filter: string[]) => void;
  
  setSectorLayerVisible: (layer: string, visible: boolean) => void;
  setSectorLayerLabels: (layer: string, visible: boolean) => void;
  setSectorLayerFill: (layer: string, visible: boolean) => void;
  setSectorLayerOpacity: (layer: string, opacity: number) => void;
  
  setAirportFilterCode: (code: string) => void;
  
  // Airline mode actions
  setAirlineModeEnabled: (enabled: boolean) => void;
  setAirlineColors: (colors: Record<string, string>) => void;
  setSelectedAirlines: (airlines: string[]) => void;
  
  updateTimelineBounds: (flightKeys: string[] | null) => void;
}

export const useFlightStore = create<FlightStore>((set, get) => ({
  flights: {},
  flightMeta: {},
  globalMinFL: Infinity,
  globalMaxFL: -Infinity,
  totalRowsLoaded: 0,
  
  timeline: {
    start: 0,
    end: 0,
    originalStart: 0,
    originalEnd: 0,
    current: 0,
  },
  
  isPlaying: false,
  speedMultiplier: 1.0,
  
  trailsVisible: false,
  flTrailsVisible: false,
  showFullTrails: false,
  trailDecayMinutes: 5, // Default 5 minutes decay
  
  filter: {
    searchText: '',
    searchFields: ['flight_key', 'acid'],
    flMin: 0,
    flMax: 500,
    actype: '',
    dep: '',
    dest: '',
  },
  filterPanelOpen: false,
  lockedFlightKey: null,
  lightMode: false,
  satelliteMode: false,
  uiHidden: false,
  airwaysVisible: false,
  gatesVisible: false,
  tagsVisible: false,
  tagDisplayOptions: {
    callsign: true,
    fl: false,
    ias: false,
    hdg: false,
  },
  
  // Airway Panel
  selectedAirway: null,
  airwayOpacity: 0.6,
  airwayPanelOpen: false,
  airwayLabelsVisible: false,
  airwayVorVisible: false,
  airwayReportingVisible: false,
  
  // Options Panel
  optionsPanelOpen: false,
  optionsPanelTab: 'airports' as const,
  
  // SID
  sidVisible: false,
  sidWaypointsVisible: false,
  sidOpacity: 0.7,
  sidLineWeight: 1,
  sidAirportFilter: [],
  sidProcedureFilter: [],
  
  // STAR
  starVisible: false,
  starWaypointsVisible: false,
  starOpacity: 0.7,
  starLineWeight: 1,
  starAirportFilter: [],
  starProcedureFilter: [],
  
  // PBN
  pbnVisible: false,
  pbnLegsVisible: false,
  pbnWaypointsVisible: false,
  pbnOpacity: 0.7,
  pbnLineWeight: 1,
  pbnAirportFilter: [],
  pbnProcedureFilter: [],
  
  // ILS
  ilsVisible: false,
  ilsLegsVisible: false,
  ilsWaypointsVisible: false,
  ilsOpacity: 0.7,
  ilsLineWeight: 1,
  ilsAirportFilter: [],
  ilsProcedureFilter: [],
  
  // Sector Layers
  sectorLayers: {
    bacc: { visible: false, labelsVisible: false, fillVisible: true, opacity: 0.4 },
    ctr: { visible: false, labelsVisible: false, fillVisible: true, opacity: 0.4 },
    fir_world: { visible: false, labelsVisible: false, fillVisible: true, opacity: 0.4 },
    bacc_subsector: { visible: false, labelsVisible: false, fillVisible: true, opacity: 0.4 },
    pdr: { visible: false, labelsVisible: false, fillVisible: true, opacity: 0.4 },
    tma: { visible: false, labelsVisible: false, fillVisible: true, opacity: 0.4 },
  },
  
  // Airport Filter
  airportFilterCode: '',
  
  // Airline Mode
  airlineModeEnabled: false,
  airlineColors: {},
  selectedAirlines: [],
  
  setFlights: (flights, meta, stats) => {
    const keys = Object.keys(flights);
    let minTime = Infinity;
    let maxTime = -Infinity;
    
    keys.forEach(key => {
      const points = flights[key];
      if (points.length > 0) {
        minTime = Math.min(minTime, points[0].t);
        maxTime = Math.max(maxTime, points[points.length - 1].t);
      }
    });
    
    const start = minTime - TIMELINE_PADDING_MS;
    const end = maxTime + TIMELINE_PADDING_MS;
    
    set({
      flights,
      flightMeta: meta,
      globalMinFL: stats.minFL,
      globalMaxFL: stats.maxFL,
      totalRowsLoaded: stats.totalRows,
      timeline: {
        start,
        end,
        originalStart: start,
        originalEnd: end,
        current: start,
      },
      filter: {
        ...get().filter,
        flMax: stats.maxFL || 500,
      },
    });
  },
  
  setVisibility: (key, visible) => {
    set(state => ({
      flightMeta: {
        ...state.flightMeta,
        [key]: { ...state.flightMeta[key], visible },
      },
    }));
  },
  
  setAllVisibility: (visible) => {
    set(state => {
      const newMeta = { ...state.flightMeta };
      Object.keys(newMeta).forEach(key => {
        newMeta[key] = { ...newMeta[key], visible };
      });
      return { flightMeta: newMeta };
    });
  },
  
  invertVisibility: () => {
    set(state => {
      const newMeta = { ...state.flightMeta };
      Object.keys(newMeta).forEach(key => {
        newMeta[key] = { ...newMeta[key], visible: !newMeta[key].visible };
      });
      return { flightMeta: newMeta };
    });
  },
  
  setPlaying: (playing) => set({ isPlaying: playing }),
  setSpeed: (speed) => set({ speedMultiplier: speed }),
  
  setCurrentTime: (time) => {
    const { timeline } = get();
    const clampedTime = Math.max(timeline.start, Math.min(timeline.end, time));
    set(state => ({
      timeline: { ...state.timeline, current: clampedTime },
    }));
  },
  
  setTrailsVisible: (visible) => set({ trailsVisible: visible, flTrailsVisible: visible ? false : get().flTrailsVisible }),
  setFlTrailsVisible: (visible) => set({ flTrailsVisible: visible, trailsVisible: visible ? false : get().trailsVisible }),
  setShowFullTrails: (show) => set({ showFullTrails: show }),
  setTrailDecayMinutes: (minutes) => set({ trailDecayMinutes: minutes }),
  
  setFilter: (filter) => set(state => ({ filter: { ...state.filter, ...filter } })),
  setFilterPanelOpen: (open) => set({ filterPanelOpen: open }),
  
  applyFilter: (matchingKeys) => {
    const matchSet = new Set(matchingKeys);
    set(state => {
      const newMeta = { ...state.flightMeta };
      Object.keys(newMeta).forEach(key => {
        newMeta[key] = { ...newMeta[key], visible: matchSet.has(key) };
      });
      return { flightMeta: newMeta };
    });
    get().updateTimelineBounds(matchingKeys);
  },
  
  clearFilter: () => {
    const { globalMaxFL } = get();
    set({
      filter: {
        searchText: '',
        searchFields: ['flight_key', 'acid'],
        flMin: 0,
        flMax: globalMaxFL || 500,
        actype: '',
        dep: '',
        dest: '',
      },
    });
    get().updateTimelineBounds(null);
  },
  
  setLockedFlight: (key) => set({ lockedFlightKey: key }),
  
  setLightMode: (light) => {
    currentLightMode = light;
    // Update all flight colors for the new mode
    const { flightMeta } = get();
    const keys = Object.keys(flightMeta);
    const newMeta = { ...flightMeta };
    keys.forEach((key, idx) => {
      newMeta[key] = { 
        ...newMeta[key], 
        color: light ? COLORS_LIGHT[idx % COLORS_LIGHT.length] : COLORS_DARK[idx % COLORS_DARK.length]
      };
    });
    set({ lightMode: light, flightMeta: newMeta });
  },
  
  setSatelliteMode: (satellite) => set({ satelliteMode: satellite }),
  
  setUiHidden: (hidden) => set({ uiHidden: hidden }),
  
  setAirwaysVisible: (visible) => set({ airwaysVisible: visible }),
  
  setGatesVisible: (visible) => set({ gatesVisible: visible }),
  
  setTagsVisible: (visible) => set({ tagsVisible: visible }),
  setTagDisplayOption: (option, enabled) => set((state) => ({
    tagDisplayOptions: { ...state.tagDisplayOptions, [option]: enabled }
  })),
  
  setSelectedAirway: (route) => set({ selectedAirway: route, airwayPanelOpen: !!route }),
  setAirwayOpacity: (opacity) => set({ airwayOpacity: opacity }),
  setAirwayPanelOpen: (open) => set({ airwayPanelOpen: open, selectedAirway: open ? undefined : null }),
  setAirwayLabelsVisible: (visible) => set({ airwayLabelsVisible: visible }),
  setAirwayVorVisible: (visible) => set({ airwayVorVisible: visible }),
  setAirwayReportingVisible: (visible) => set({ airwayReportingVisible: visible }),
  
  setOptionsPanelOpen: (open) => set({ optionsPanelOpen: open }),
  setOptionsPanelTab: (tab) => set({ optionsPanelTab: tab }),
  
  setSidVisible: (visible) => set({ sidVisible: visible }),
  setSidWaypointsVisible: (visible) => set({ sidWaypointsVisible: visible }),
  setSidOpacity: (opacity) => set({ sidOpacity: opacity }),
  setSidLineWeight: (weight) => set({ sidLineWeight: weight }),
  setSidAirportFilter: (filter) => set({ sidAirportFilter: filter, sidProcedureFilter: [] }),
  setSidProcedureFilter: (filter) => set({ sidProcedureFilter: filter }),
  
  setStarVisible: (visible) => set({ starVisible: visible }),
  setStarWaypointsVisible: (visible) => set({ starWaypointsVisible: visible }),
  setStarOpacity: (opacity) => set({ starOpacity: opacity }),
  setStarLineWeight: (weight) => set({ starLineWeight: weight }),
  setStarAirportFilter: (filter) => set({ starAirportFilter: filter, starProcedureFilter: [] }),
  setStarProcedureFilter: (filter) => set({ starProcedureFilter: filter }),
  
  setPbnVisible: (visible) => set({ pbnVisible: visible }),
  setPbnLegsVisible: (visible) => set({ pbnLegsVisible: visible }),
  setPbnWaypointsVisible: (visible) => set({ pbnWaypointsVisible: visible }),
  setPbnOpacity: (opacity) => set({ pbnOpacity: opacity }),
  setPbnLineWeight: (weight) => set({ pbnLineWeight: weight }),
  setPbnAirportFilter: (filter) => set({ pbnAirportFilter: filter, pbnProcedureFilter: [] }),
  setPbnProcedureFilter: (filter) => set({ pbnProcedureFilter: filter }),
  
  setIlsVisible: (visible) => set({ ilsVisible: visible }),
  setIlsLegsVisible: (visible) => set({ ilsLegsVisible: visible }),
  setIlsWaypointsVisible: (visible) => set({ ilsWaypointsVisible: visible }),
  setIlsOpacity: (opacity) => set({ ilsOpacity: opacity }),
  setIlsLineWeight: (weight) => set({ ilsLineWeight: weight }),
  setIlsAirportFilter: (filter) => set({ ilsAirportFilter: filter, ilsProcedureFilter: [] }),
  setIlsProcedureFilter: (filter) => set({ ilsProcedureFilter: filter }),
  
  setSectorLayerVisible: (layer, visible) => set(state => ({
    sectorLayers: { ...state.sectorLayers, [layer]: { ...state.sectorLayers[layer], visible } }
  })),
  setSectorLayerLabels: (layer, visible) => set(state => ({
    sectorLayers: { ...state.sectorLayers, [layer]: { ...state.sectorLayers[layer], labelsVisible: visible } }
  })),
  setSectorLayerFill: (layer, visible) => set(state => ({
    sectorLayers: { ...state.sectorLayers, [layer]: { ...state.sectorLayers[layer], fillVisible: visible } }
  })),
  setSectorLayerOpacity: (layer, opacity) => set(state => ({
    sectorLayers: { ...state.sectorLayers, [layer]: { ...state.sectorLayers[layer], opacity } }
  })),
  
  setAirportFilterCode: (code) => {
    // When enabling airport filter, disable normal trails and FL trails
    if (code) {
      set({ airportFilterCode: code, trailsVisible: false, flTrailsVisible: false });
    } else {
      set({ airportFilterCode: '' });
    }
  },
  
  // Airline mode actions
  setAirlineModeEnabled: (enabled) => set({ airlineModeEnabled: enabled }),
  setAirlineColors: (colors) => set({ airlineColors: colors }),
  setSelectedAirlines: (airlines) => set({ selectedAirlines: airlines }),
  
  lockToFlight: (key) => {
    const { lockedFlightKey, flightMeta, setVisibility } = get();
    // Toggle lock if clicking same flight
    if (lockedFlightKey === key) {
      set({ lockedFlightKey: null });
      return;
    }
    // Make sure flight is visible
    if (!flightMeta[key]?.visible) {
      setVisibility(key, true);
    }
    set({ lockedFlightKey: key });
  },
  
  // Focus on a flight: lock tooltip, make visible
  // withZoom: zoom to plane position (shift+click on map)
  // jumpToStart: jump timeline to first appearance (list/filter clicks)
  focusFlight: (key, withZoom = false, jumpToStart = false) => {
    const { flights, flightMeta, setVisibility, setCurrentTime, timeline } = get();
    const points = flights[key];
    if (!points || points.length === 0) return;
    
    // Make sure flight is visible
    if (!flightMeta[key]?.visible) {
      setVisibility(key, true);
    }
    
    // Jump timeline to flight's first appearance if requested
    if (jumpToStart) {
      const startTime = points[0].t;
      setCurrentTime(startTime);
    }
    
    // Lock tooltip to this flight
    set({ lockedFlightKey: key });
    
    // Only zoom if explicitly requested (shift+click)
    if (withZoom) {
      // Find current position based on current time
      const currentTime = jumpToStart ? points[0].t : timeline.current;
      let targetPoint = points[0];
      for (let i = 0; i < points.length; i++) {
        if (points[i].t <= currentTime) {
          targetPoint = points[i];
        } else {
          break;
        }
      }
      (window as any).focusMapOnFlight?.(targetPoint.lat, targetPoint.lon);
    }
  },
  
  updateTimelineBounds: (flightKeys) => {
    const { flights, timeline } = get();
    
    if (!flightKeys || flightKeys.length === 0) {
      set({
        timeline: {
          ...timeline,
          start: timeline.originalStart,
          end: timeline.originalEnd,
          current: Math.max(timeline.originalStart, Math.min(timeline.originalEnd, timeline.current)),
        },
      });
      return;
    }
    
    let minTime = Infinity;
    let maxTime = -Infinity;
    
    flightKeys.forEach(key => {
      const points = flights[key];
      if (points && points.length > 0) {
        minTime = Math.min(minTime, points[0].t);
        maxTime = Math.max(maxTime, points[points.length - 1].t);
      }
    });
    
    if (minTime !== Infinity && maxTime !== -Infinity) {
      const start = minTime - TIMELINE_PADDING_MS;
      const end = maxTime + TIMELINE_PADDING_MS;
      set({
        timeline: {
          ...timeline,
          start,
          end,
          current: Math.max(start, Math.min(end, timeline.current)),
        },
      });
    }
  },
}));

// Selector for visible flights
export const useVisibleFlights = () => {
  const flightMeta = useFlightStore(state => state.flightMeta);
  return Object.entries(flightMeta)
    .filter(([_, meta]) => meta.visible)
    .map(([key]) => key);
};

// Get color for a flight (uses light mode colors when in light mode)
export const getFlightColor = (index: number, lightMode = false) => {
  const colors = lightMode ? COLORS_LIGHT : COLORS_DARK;
  return colors[index % colors.length];
};

// Set current light mode for color selection
export const setColorLightMode = (light: boolean) => {
  currentLightMode = light;
};

// Get color using current light mode setting
export const getFlightColorAuto = (index: number) => {
  const colors = currentLightMode ? COLORS_LIGHT : COLORS_DARK;
  return colors[index % colors.length];
};

// Get airline code from flight key (first 3 characters)
export const getAirlineCode = (flightKey: string) => {
  return flightKey.substring(0, 3).toUpperCase();
};
