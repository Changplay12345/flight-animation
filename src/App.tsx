import { useRef, useState, useEffect, useCallback, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useFlightStore } from './store/flightStore';
import { useAirportStore, loadAirports, loadRunways, getRunwaySurfaceText } from './store/airportStore';
import type { Airport } from './store/airportStore';
import { parseCSV } from './utils/csvParser';
import { loadParquetFromUrl } from './utils/duckdbLoader';
import { flToColor } from './utils/flightLevel';
import { AirwayLayer } from './components/AirwayLayer';
import { GateLayer } from './components/GateLayer';
import { BACCLayer } from './components/BACCLayer';
import { CTRLayer } from './components/CTRLayer';
import { FIRLayer } from './components/FIRLayer';
import { PDRLayer } from './components/PDRLayer';
import { TMALayer } from './components/TMALayer';
import { FlightTagsLayer } from './components/FlightTagsLayer';
import { SidLayer } from './components/SidLayer';
import { StarLayer } from './components/StarLayer';
import { PbnLayer } from './components/PbnLayer';
import { IlsLayer } from './components/IlsLayer';
import { useAnimation } from './hooks/useAnimation';
import { DbViewer } from './components/DbViewer';
import { FlightFeatureCreator } from './components/FlightFeatureCreator';
import { API_BASE, R2_PUBLIC_URL, apiFetch } from './config/api';
import 'leaflet/dist/leaflet.css';


// ============== Hash Router Hook ==============
function useHashRoute() {
  const [route, setRoute] = useState(window.location.hash || '#/');
  useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash || '#/');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  return route;
}

// ============== Modern SaaS Dashboard Styles ==============
const styles = {
  // Layout
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f7fa',
    padding: '24px',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '32px',
    maxWidth: '440px',
    width: '100%',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    border: '1px solid #e5e7eb',
  },
  // Typography
  title: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#111827',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '24px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#374151',
    marginBottom: '6px',
    display: 'block',
  },
  // Tabs
  tabContainer: {
    display: 'flex',
    backgroundColor: '#f3f4f6',
    borderRadius: '8px',
    padding: '4px',
    marginBottom: '20px',
  },
  tab: {
    flex: 1,
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#6b7280',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  tabActive: {
    backgroundColor: '#fff',
    color: '#111827',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  // Form elements
  select: {
    width: '100%',
    padding: '10px 12px',
    backgroundColor: '#fff',
    color: '#111827',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    cursor: 'pointer',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  selectFocus: {
    borderColor: '#4f46e5',
    boxShadow: '0 0 0 3px rgba(79, 70, 229, 0.1)',
  },
  filterRow: {
    display: 'flex',
    gap: '10px',
    marginTop: '12px',
  },
  // Buttons
  btnPrimary: {
    width: '100%',
    padding: '12px 20px',
    backgroundColor: '#4f46e5',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'background-color 0.15s',
    marginTop: '16px',
  },
  btnPrimaryHover: {
    backgroundColor: '#4338ca',
  },
  btnSecondary: {
    width: '100%',
    padding: '12px 20px',
    backgroundColor: '#fff',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.15s',
    textDecoration: 'none',
    marginTop: '16px',
  },
  btnDisabled: {
    backgroundColor: '#e5e7eb',
    color: '#9ca3af',
    cursor: 'not-allowed',
  },
  btnRow: {
    display: 'flex',
    gap: '10px',
    marginTop: '12px',
  },
  // Info box
  infoBox: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '12px',
    padding: '10px 12px',
    backgroundColor: '#f9fafb',
    borderRadius: '6px',
    lineHeight: 1.5,
  },
  // Progress
  progressContainer: {
    marginBottom: '20px',
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  progressLabel: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#374151',
  },
  progressPercent: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#4f46e5',
  },
  progressBar: {
    width: '100%',
    height: '6px',
    backgroundColor: '#e5e7eb',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4f46e5',
    borderRadius: '3px',
    transition: 'width 0.2s ease',
  },
  progressDetail: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '6px',
  },
  // Links
  linkRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
    marginTop: '20px',
    paddingTop: '16px',
    borderTop: '1px solid #e5e7eb',
  },
  link: {
    fontSize: '13px',
    color: '#4f46e5',
    textDecoration: 'none',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
};

// ============== File Picker ==============
function FilePicker({ onFileLoad, setLoadingText, setLoadProgress: setParentProgress }: { 
  onFileLoad: () => void; 
  setLoadingText: (text: string | null) => void;
  setLoadProgress?: (progress: { stage: string; percent: number; rows: number; total: number } | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setFlights = useFlightStore(state => state.setFlights);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'database' | 'upload'>('database');
  
  // Dataset picker state
  const [datasets, setDatasets] = useState<string[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [depCodes, setDepCodes] = useState<string[]>([]);
  const [destCodes, setDestCodes] = useState<string[]>([]);
  const [selectedDep, setSelectedDep] = useState<string>('');
  const [selectedDest, setSelectedDest] = useState<string>('');
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [loadProgress, setLocalProgress] = useState<{ stage: string; percent: number; rows: number; total: number } | null>(null);
  
  // Update both local and parent progress
  const setLoadProgress = (p: { stage: string; percent: number; rows: number; total: number } | null) => {
    setLocalProgress(p);
    setParentProgress?.(p);
  };

  // Store dataset info with R2 URLs
  const [datasetInfo, setDatasetInfo] = useState<Record<string, string>>({});

  // Load available datasets - try tunnel first (updates manifest), fallback to R2 cache
  const loadDatasets = () => {
    const processData = (data: Array<{ table_name: string; r2_url?: string }>) => {
      const names = data.map(d => d.table_name);
      const urlMap: Record<string, string> = {};
      data.forEach(d => { if (d.r2_url) urlMap[d.table_name] = d.r2_url; });
      setDatasetInfo(urlMap);
      setDatasets(names);
      if (names.length > 0 && !selectedDataset) setSelectedDataset(names[0]);
      console.log('Loaded datasets:', names);
    };

    // Try tunnel first (this updates the manifest in R2)
    apiFetch(`${API_BASE}/flight-features/datasets`)
      .then(res => res.ok ? res.json() : Promise.reject('Tunnel not available'))
      .then(data => { if (Array.isArray(data)) processData(data); })
      .catch(() => {
        // Fallback to R2 cached manifest
        console.log('Tunnel unavailable, using R2 cache...');
        fetch(`${R2_PUBLIC_URL}/datasets.json`)
          .then(res => res.ok ? res.json() : Promise.reject('R2 cache not found'))
          .then(data => { if (Array.isArray(data)) processData(data); })
          .catch(e => console.error('Failed to load datasets:', e));
      });
  };

  useEffect(() => { loadDatasets(); }, []);

  // Load airport codes when dataset is selected (optional - needs tunnel)
  useEffect(() => {
    if (!selectedDataset) {
      setDepCodes([]);
      setDestCodes([]);
      return;
    }
    // Airport filter is optional - only works when tunnel is running
    apiFetch(`${API_BASE}/flight-features/airports-from-dataset?dataset=${selectedDataset}`)
      .then(res => res.json())
      .then(data => {
        setDepCodes(data.dep_codes || []);
        setDestCodes(data.dest_codes || []);
      })
      .catch(() => {
        // Tunnel not running - airport filter won't work but loading still works
        setDepCodes([]);
        setDestCodes([]);
      });
  }, [selectedDataset]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLoadProgress({ stage: 'Reading file', percent: 5, rows: 0, total: 0 });
    setLoadingText(`Loading ${file.name}...`);
    
    try {
      const result = await parseCSV(file, (loaded) => {
        const percent = Math.min(70, 10 + (loaded / 50000) * 60);
        setLoadProgress({ stage: 'Parsing CSV', percent, rows: loaded, total: 0 });
        setLoadingText(`Parsing... ${(loaded / 1000).toFixed(0)}k rows`);
      });
      
      setLoadProgress({ stage: 'Processing flights', percent: 85, rows: Object.keys(result.flights).length, total: 0 });
      setLoadingText(`Processing ${Object.keys(result.flights).length} flights...`);
      await new Promise(r => setTimeout(r, 50));
      
      setFlights(result.flights, result.flightMeta, result.stats);
      
      setLoadProgress({ stage: 'Initializing', percent: 95, rows: 0, total: 0 });
      setLoadingText('Initializing map...');
      await new Promise(r => setTimeout(r, 50));
      
      setLoadProgress(null);
      setLoadingText(null);
      onFileLoad();
    } catch (error) {
      console.error('Error parsing CSV:', error);
      setLoadProgress({ stage: 'Error', percent: 0, rows: 0, total: 0 });
      setLoadingText('Error loading file');
      setTimeout(() => { setLoadProgress(null); setLoadingText(null); }, 2000);
      return;
    }
  };

  const handleLoadDataset = async () => {
    if (!selectedDataset) return;
    
    setLoadingDatasets(true);
    setLoadProgress({ stage: 'Loading from R2', percent: 5, rows: 0, total: 0 });
    setLoadingText(`Loading ${selectedDataset}...`);
    
    try {
      // Use R2 URL directly from dataset list (no tunnel needed)
      const parquetUrl = datasetInfo[selectedDataset];
      
      if (!parquetUrl) {
        throw new Error('R2 URL not found for this dataset. Please refresh the page.');
      }
      
      console.log('Loading parquet from R2:', parquetUrl);
      
      const result = await loadParquetFromUrl(parquetUrl, (stage, percent, rows) => {
        setLoadProgress({ stage, percent, rows, total: 0 });
        setLoadingText(`${stage}... ${rows > 0 ? `${(rows / 1000).toFixed(0)}k rows` : ''}`);
      });
      
      setFlights(result.flights, result.flightMeta, result.stats);
      
      setLoadProgress(null);
      setLoadingText(null);
      onFileLoad();
    } catch (error) {
      console.error('Error loading dataset:', error);
      setLoadProgress({ stage: 'Error', percent: 0, rows: 0, total: 0 });
      setLoadingText(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setTimeout(() => { setLoadProgress(null); setLoadingText(null); }, 3000);
    } finally {
      setLoadingDatasets(false);
    }
  };

  return (
    <div style={styles.container} className="page-transition">
      <div style={styles.card}>
        <h1 style={styles.title}>Flight Animation Viewer</h1>
        <p style={styles.subtitle}>Load flight trajectory data for visualization</p>
        
        {/* Progress */}
        {loadProgress && (
          <div style={styles.progressContainer}>
            <div style={styles.progressHeader}>
              <span style={styles.progressLabel}>{loadProgress.stage}</span>
              <span style={styles.progressPercent}>{loadProgress.percent}%</span>
            </div>
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${loadProgress.percent}%` }} />
            </div>
            {loadProgress.total && loadProgress.total > 0 && (
              <div style={styles.progressDetail}>
                {loadProgress.rows?.toLocaleString() || 0} / {loadProgress.total.toLocaleString()} rows
              </div>
            )}
          </div>
        )}
        
        {/* Tabs */}
        <div style={styles.tabContainer}>
          <button 
            style={{ ...styles.tab, ...(activeTab === 'database' ? styles.tabActive : {}) }}
            onClick={() => setActiveTab('database')}
          >
            Database
          </button>
          <button 
            style={{ ...styles.tab, ...(activeTab === 'upload' ? styles.tabActive : {}) }}
            onClick={() => setActiveTab('upload')}
          >
            Upload CSV
          </button>
        </div>
        
        {/* Database Tab */}
        {activeTab === 'database' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={styles.label}>Dataset</label>
              <button
                onClick={() => {
                  console.log('Refreshing datasets via tunnel...');
                  apiFetch(`${API_BASE}/flight-features/datasets`)
                    .then(res => res.ok ? res.json() : Promise.reject('Tunnel not available'))
                    .then(data => {
                      if (Array.isArray(data)) {
                        const names = data.map((d: { table_name: string }) => d.table_name);
                        const urlMap: Record<string, string> = {};
                        data.forEach((d: { table_name: string; r2_url?: string }) => {
                          if (d.r2_url) urlMap[d.table_name] = d.r2_url;
                        });
                        setDatasetInfo(urlMap);
                        setDatasets(names);
                        if (names.length > 0) setSelectedDataset(names[0]);
                        alert(`Refreshed! Found ${names.length} datasets.`);
                      }
                    })
                    .catch(() => alert('Refresh failed. Make sure tunnel is running.'));
                }}
                style={{ padding: '2px 8px', fontSize: '12px', cursor: 'pointer' }}
                title="Refresh dataset list (requires tunnel)"
              >
                🔄
              </button>
            </div>
            <select 
              value={selectedDataset} 
              onChange={(e) => setSelectedDataset(e.target.value)}
              style={styles.select}
              disabled={loadingDatasets || datasets.length === 0}
            >
              <option value="">{datasets.length === 0 ? 'No datasets available' : 'Select a dataset'}</option>
              {datasets.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            
            {selectedDataset && (
              <>
                <label style={{ ...styles.label, marginTop: '12px' }}>Filter by Airport</label>
                <div style={styles.filterRow}>
                  <select 
                    value={selectedDep} 
                    onChange={(e) => setSelectedDep(e.target.value)}
                    style={{ ...styles.select, flex: 1 }}
                    disabled={loadingDatasets}
                  >
                    <option value="">All Departures</option>
                    {depCodes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select 
                    value={selectedDest} 
                    onChange={(e) => setSelectedDest(e.target.value)}
                    style={{ ...styles.select, flex: 1 }}
                    disabled={loadingDatasets}
                  >
                    <option value="">All Destinations</option>
                    {destCodes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </>
            )}
            
            <button 
              onClick={handleLoadDataset}
              disabled={!selectedDataset || loadingDatasets}
              style={{ 
                ...styles.btnPrimary, 
                ...((!selectedDataset || loadingDatasets) ? styles.btnDisabled : {})
              }}
            >
              {loadingDatasets ? 'Loading...' : 'Load Dataset'}
            </button>
            
            {datasets.length === 0 && (
              <div style={styles.infoBox}>
                No datasets found. Create one using the Dataset Creator.
              </div>
            )}
          </>
        )}
        
        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <>
            <input 
              ref={fileInputRef}
              type="file" 
              id="csv-input" 
              accept=".csv"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              style={styles.btnSecondary}
            >
              Select CSV File
            </button>
            <div style={styles.infoBox}>
              <strong>Required:</strong> flight_key, timestamp_utc, latitude, longitude<br/>
              <strong>Optional:</strong> flight_level, actype, dep, dest, ias_dap, mag_heading_dap
            </div>
          </>
        )}
        
        {/* Footer Links */}
        <div style={styles.linkRow}>
          <a href="#/db-viewer" style={styles.link}>DB Viewer</a>
          <a href="#/flight-features" style={styles.link}>Create Dataset</a>
          <a 
            href="#"
            onClick={(e) => { e.preventDefault(); setLoadingText(null); onFileLoad(); }}
            style={styles.link}
          >
            Testing Mode
          </a>
        </div>
      </div>
    </div>
  );
}

// ============== Trails Dropdown ==============
function TrailsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const trailsVisible = useFlightStore(state => state.trailsVisible);
  const setTrailsVisible = useFlightStore(state => state.setTrailsVisible);
  const flTrailsVisible = useFlightStore(state => state.flTrailsVisible);
  const setFlTrailsVisible = useFlightStore(state => state.setFlTrailsVisible);
  const showFullTrails = useFlightStore(state => state.showFullTrails);
  const setShowFullTrails = useFlightStore(state => state.setShowFullTrails);
  const trailDecayMinutes = useFlightStore(state => state.trailDecayMinutes);
  const setTrailDecayMinutes = useFlightStore(state => state.setTrailDecayMinutes);
  const tagsVisible = useFlightStore(state => state.tagsVisible);
  const setTagsVisible = useFlightStore(state => state.setTagsVisible);
  const tagDisplayOptions = useFlightStore(state => state.tagDisplayOptions);
  const setTagDisplayOption = useFlightStore(state => state.setTagDisplayOption);
  const uiHidden = useFlightStore(state => state.uiHidden);
  
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);
  
  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left });
    }
    setIsOpen(!isOpen);
  };
  
  if (uiHidden) return null;
  
  const dropdownContent = isOpen && dropdownPos && createPortal(
    <div 
      ref={dropdownRef}
      className="trails-dropdown"
      style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, zIndex: 999999 }}
    >
      <label className="trails-option-row">
        <span>Show Trails</span>
        <input type="checkbox" checked={trailsVisible} onChange={(e) => setTrailsVisible(e.target.checked)} />
      </label>
      <label className="trails-option-row">
        <span>FL Color Trails</span>
        <input type="checkbox" checked={flTrailsVisible} onChange={(e) => setFlTrailsVisible(e.target.checked)} />
      </label>
      <label className="trails-option-row">
        <span>Full Trails</span>
        <input type="checkbox" checked={showFullTrails} onChange={(e) => setShowFullTrails(e.target.checked)} />
      </label>
      <label className="trails-option-row">
        <span>Flight Tags</span>
        <input type="checkbox" checked={tagsVisible} onChange={(e) => setTagsVisible(e.target.checked)} />
      </label>
      {tagsVisible && (
        <div className="tag-options-group">
          <label className="trails-option-row tag-option">
            <span>Callsign</span>
            <input type="checkbox" checked={tagDisplayOptions.callsign} onChange={(e) => setTagDisplayOption('callsign', e.target.checked)} />
          </label>
          <label className="trails-option-row tag-option">
            <span>FL</span>
            <input type="checkbox" checked={tagDisplayOptions.fl} onChange={(e) => setTagDisplayOption('fl', e.target.checked)} />
          </label>
          <label className="trails-option-row tag-option">
            <span>IAS</span>
            <input type="checkbox" checked={tagDisplayOptions.ias} onChange={(e) => setTagDisplayOption('ias', e.target.checked)} />
          </label>
          <label className="trails-option-row tag-option">
            <span>HDG</span>
            <input type="checkbox" checked={tagDisplayOptions.hdg} onChange={(e) => setTagDisplayOption('hdg', e.target.checked)} />
          </label>
        </div>
      )}
      {!showFullTrails && (
        <div className="trails-option-row column">
          <span>Trail Decay</span>
          <select 
            value={trailDecayMinutes}
            onChange={(e) => setTrailDecayMinutes(Number(e.target.value))}
          >
            <option value={1}>1 min</option>
            <option value={2}>2 min</option>
            <option value={5}>5 min</option>
            <option value={10}>10 min</option>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={60}>1 hour</option>
            <option value={0}>No decay</option>
          </select>
        </div>
      )}
    </div>,
    document.body
  );
  
  return (
    <>
      <button 
        ref={buttonRef}
        id="btn-trails-dropdown" 
        title="Trail Options"
        className={isOpen || trailsVisible ? 'active' : ''}
        onClick={handleToggle}
      >
        ✈️ Trails
      </button>
      {dropdownContent}
    </>
  );
}

// ============== Toolbar ==============
function Toolbar() {
  const isPlaying = useFlightStore(state => state.isPlaying);
  const speedMultiplier = useFlightStore(state => state.speedMultiplier);
  const setSpeed = useFlightStore(state => state.setSpeed);
  const filterPanelOpen = useFlightStore(state => state.filterPanelOpen);
  const setFilterPanelOpen = useFlightStore(state => state.setFilterPanelOpen);
  const timeline = useFlightStore(state => state.timeline);
  
  const { play, pause, rewind } = useAnimation();
  
  const timeDisplay = useMemo(() => {
    const date = new Date(timeline.current);
    const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
    const timeStr = date.toISOString().slice(11, 19); // HH:MM:SS
    return `${dateStr} ${timeStr}`;
  }, [timeline.current]);

  return (
    <div id="toolbar">
      <div id="time-display">{timeDisplay}</div>
      <button id="btn-rewind" title="Rewind" onClick={rewind}>⏪</button>
      <button 
        id="btn-play" 
        title="Play/Pause"
        className={isPlaying ? 'active' : ''}
        onClick={() => isPlaying ? pause() : play()}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <div id="speed-control">
        <span>Speed:</span>
        <select 
          id="speed-select"
          value={speedMultiplier}
          onChange={(e) => setSpeed(Number(e.target.value))}
        >
          <option value="10">x1</option>
          <option value="20">x2</option>
          <option value="40">x5</option>
          <option value="100">x10</option>
          <option value="200">x20</option>
          <option value="500">x50</option>
          <option value="1000">x100</option>
        </select>
      </div>
      <TrailsDropdown />
      <SectorsDropdown />
      <AirwayDropdown />
      <AirportButton />
      <button 
        id="btn-filter" 
        title="Filter Flights"
        className={filterPanelOpen ? 'active' : ''}
        onClick={() => setFilterPanelOpen(!filterPanelOpen)}
      >
        🔍 Filter
      </button>
    </div>
  );
}

// ============== Airway Dropdown ==============
function AirwayDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const airwaysVisible = useFlightStore(state => state.airwaysVisible);
  const setAirwaysVisible = useFlightStore(state => state.setAirwaysVisible);
  const airwayLabelsVisible = useFlightStore(state => state.airwayLabelsVisible);
  const setAirwayLabelsVisible = useFlightStore(state => state.setAirwayLabelsVisible);
  const airwayVorVisible = useFlightStore(state => state.airwayVorVisible);
  const setAirwayVorVisible = useFlightStore(state => state.setAirwayVorVisible);
  const airwayReportingVisible = useFlightStore(state => state.airwayReportingVisible);
  const setAirwayReportingVisible = useFlightStore(state => state.setAirwayReportingVisible);
  const airwayOpacity = useFlightStore(state => state.airwayOpacity);
  const setAirwayOpacity = useFlightStore(state => state.setAirwayOpacity);
  const uiHidden = useFlightStore(state => state.uiHidden);

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left });
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  if (uiHidden) return null;

  const dropdownContent = isOpen && dropdownPos && createPortal(
    <div 
      ref={dropdownRef}
      className="airway-dropdown"
      style={{ 
        position: 'fixed',
        top: dropdownPos.top,
        left: dropdownPos.left,
        zIndex: 999999
      }}
    >
      <div className="airway-option-row">
        <span 
          className="airway-option-label"
          role="img"
          aria-label="Toggle Airways"
          onClick={() => setAirwaysVisible(!airwaysVisible)}
        >
          Airways
        </span>
        <input 
          type="checkbox" 
          checked={airwaysVisible} 
          onChange={(e) => setAirwaysVisible(e.target.checked)}
        />
      </div>
      <div className="airway-option-row">
        <span 
          className="airway-option-label"
          role="img"
          aria-label="Toggle Labels"
          onClick={() => setAirwayLabelsVisible(!airwayLabelsVisible)}
        >
          Labels
        </span>
        <input 
          type="checkbox" 
          checked={airwayLabelsVisible} 
          onChange={(e) => setAirwayLabelsVisible(e.target.checked)}
        />
      </div>
      <div className="airway-option-row">
        <span 
          className="airway-option-label"
          role="img"
          aria-label="Toggle VOR"
          onClick={() => setAirwayVorVisible(!airwayVorVisible)}
        >
          VOR
        </span>
        <input 
          type="checkbox" 
          checked={airwayVorVisible} 
          onChange={(e) => setAirwayVorVisible(e.target.checked)}
        />
      </div>
      <div className="airway-option-row">
        <span 
          className="airway-option-label"
          role="img"
          aria-label="Toggle Reporting Points"
          onClick={() => setAirwayReportingVisible(!airwayReportingVisible)}
        >
          Reporting
        </span>
        <input 
          type="checkbox" 
          checked={airwayReportingVisible} 
          onChange={(e) => setAirwayReportingVisible(e.target.checked)}
        />
      </div>
      <div className="airway-option-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="airway-option-label">Opacity</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={airwayOpacity}
            onChange={(e) => setAirwayOpacity(parseFloat(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: '11px', color: '#888', minWidth: '32px' }}>{(airwayOpacity * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      <button 
        ref={buttonRef}
        id="btn-airways" 
        title="Airway Options"
        className={isOpen || airwaysVisible ? 'active' : ''}
        onClick={handleToggle}
      >
        ✈️ Airway
      </button>
      {dropdownContent}
    </>
  );
}

// ============== Airport Button (opens Options Panel) ==============
function AirportButton() {
  const optionsPanelOpen = useFlightStore(state => state.optionsPanelOpen);
  const setOptionsPanelOpen = useFlightStore(state => state.setOptionsPanelOpen);
  const uiHidden = useFlightStore(state => state.uiHidden);
  
  if (uiHidden) return null;
  
  return (
    <button 
      id="btn-airport" 
      title="Airport & Layer Options"
      className={optionsPanelOpen ? 'active' : ''}
      onClick={() => setOptionsPanelOpen(!optionsPanelOpen)}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 6, verticalAlign: 'middle' }}>
        <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
      </svg>
      Airports
    </button>
  );
}

// ============== Multi-Select Dropdown Component ==============
interface MultiSelectOption {
  value: string;
  label: string;
}

function MultiSelectDropdown({ 
  options, 
  selected, 
  onChange, 
  placeholder,
  disabled = false
}: { 
  options: MultiSelectOption[]; 
  selected: string[]; 
  onChange: (values: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase()) ||
    opt.value.toLowerCase().includes(search.toLowerCase())
  );
  
  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };
  
  const selectAll = () => onChange(filteredOptions.map(o => o.value));
  const clearAll = () => onChange([]);
  
  return (
    <div className={`multi-select-dropdown ${disabled ? 'disabled' : ''}`} ref={dropdownRef}>
      <div className="multi-select-trigger" onClick={() => !disabled && setIsOpen(!isOpen)}>
        <span className="multi-select-text">
          {selected.length === 0 ? placeholder : `${selected.length} selected`}
        </span>
        <span className="multi-select-arrow">{isOpen ? '▲' : '▼'}</span>
      </div>
      {isOpen && !disabled && (
        <div className="multi-select-menu">
          <input
            type="text"
            className="multi-select-search"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="multi-select-actions">
            <button onClick={selectAll}>Select All</button>
            <button onClick={clearAll}>Clear</button>
          </div>
          <div className="multi-select-options">
            {filteredOptions.map(opt => (
              <label key={opt.value} className="multi-select-option">
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={() => toggleOption(opt.value)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
            {filteredOptions.length === 0 && (
              <div className="multi-select-empty">No options found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============== Airports Tab Content ==============
function AirportsTabContent() {
  const [searchTerm, setSearchTerm] = useState('');
  const airports = useAirportStore(state => state.airports);
  const toggleAirportVisibility = useAirportStore(state => state.toggleAirportVisibility);
  const showAllAirports = useAirportStore(state => state.showAllAirports);
  const hideAllAirports = useAirportStore(state => state.hideAllAirports);
  const runwaysVisible = useAirportStore(state => state.runwaysVisible);
  const setRunwaysVisible = useAirportStore(state => state.setRunwaysVisible);
  
  // Main airports = Main column === 'Y'
  const mainAirports = useMemo(() => airports.filter(a => a.Main === 'Y'), [airports]);
  const subAirports = useMemo(() => airports.filter(a => a.Main !== 'Y'), [airports]);
  
  // Filter by search term
  const filterAirports = (list: typeof airports) => {
    if (!searchTerm) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(a => 
      a.airport_identifier.toLowerCase().includes(term) ||
      a.airport_name.toLowerCase().includes(term) ||
      (a.iata_ata_designator && a.iata_ata_designator.toLowerCase().includes(term))
    );
  };
  
  const filteredMain = filterAirports(mainAirports);
  const filteredSub = filterAirports(subAirports);
  
  return (
    <div className="options-section airports-tab">
      <label className="options-row">
        <span>Show Runways</span>
        <input type="checkbox" checked={runwaysVisible} onChange={(e) => setRunwaysVisible(e.target.checked)} />
      </label>
      <div className="airport-search">
        <input 
          type="text" 
          placeholder="Search airports..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="airport-actions">
        <button onClick={showAllAirports}>Show All</button>
        <button onClick={hideAllAirports}>Hide All</button>
      </div>
      <div className="airport-list-container">
        {filteredMain.length > 0 && (
          <>
            <div className="airport-section-title">Main Airports ({filteredMain.length})</div>
            <div className="airport-list">
              {filteredMain.map(a => (
                <label 
                  key={a.fid} 
                  className={`airport-list-item main ${a.visible ? 'visible' : 'hidden'}`}
                >
                  <input 
                    type="checkbox" 
                    checked={a.visible} 
                    onChange={() => toggleAirportVisibility(a.fid)} 
                  />
                  <span className="airport-name">{a.airport_name}</span>
                  <span className="airport-code">{a.airport_identifier}</span>
                </label>
              ))}
            </div>
          </>
        )}
        {filteredSub.length > 0 && (
          <>
            <div className="airport-section-title">Other Airports ({filteredSub.length})</div>
            <div className="airport-list">
              {filteredSub.map(a => (
                <label 
                  key={a.fid} 
                  className={`airport-list-item ${a.visible ? 'visible' : 'hidden'}`}
                >
                  <input 
                    type="checkbox" 
                    checked={a.visible} 
                    onChange={() => toggleAirportVisibility(a.fid)} 
                  />
                  <span className="airport-name">{a.airport_name}</span>
                  <span className="airport-code">{a.airport_identifier}</span>
                </label>
              ))}
            </div>
          </>
        )}
        {airports.length === 0 && (
          <div className="options-empty">No airports loaded</div>
        )}
        {airports.length > 0 && filteredMain.length === 0 && filteredSub.length === 0 && (
          <div className="options-empty">No airports match "{searchTerm}"</div>
        )}
      </div>
    </div>
  );
}

// ============== Gates Tab Content ==============
function GatesTabContent() {
  const gatesVisible = useFlightStore(state => state.gatesVisible);
  const setGatesVisible = useFlightStore(state => state.setGatesVisible);
  
  return (
    <div className="options-section">
      <div className="options-row">
        <span onClick={() => setGatesVisible(!gatesVisible)}>Show Gates</span>
        <input type="checkbox" checked={gatesVisible} onChange={(e) => setGatesVisible(e.target.checked)} />
      </div>
      <div className="options-info">
        Gates are displayed at airports when zoomed in. Toggle visibility above.
      </div>
    </div>
  );
}

// ============== Options Panel (Chrome-style tabs) ==============
interface LayerData {
  airports: string[];
  procedures: { airport: string; procedure: string }[];
}

function OptionsPanel() {
  const optionsPanelOpen = useFlightStore(state => state.optionsPanelOpen);
  const setOptionsPanelOpen = useFlightStore(state => state.setOptionsPanelOpen);
  const optionsPanelTab = useFlightStore(state => state.optionsPanelTab);
  const setOptionsPanelTab = useFlightStore(state => state.setOptionsPanelTab);
  const uiHidden = useFlightStore(state => state.uiHidden);
  
  // SID state
  const sidVisible = useFlightStore(state => state.sidVisible);
  const setSidVisible = useFlightStore(state => state.setSidVisible);
  const sidWaypointsVisible = useFlightStore(state => state.sidWaypointsVisible);
  const setSidWaypointsVisible = useFlightStore(state => state.setSidWaypointsVisible);
  const sidOpacity = useFlightStore(state => state.sidOpacity);
  const setSidOpacity = useFlightStore(state => state.setSidOpacity);
  const sidLineWeight = useFlightStore(state => state.sidLineWeight);
  const setSidLineWeight = useFlightStore(state => state.setSidLineWeight);
  const sidAirportFilter = useFlightStore(state => state.sidAirportFilter);
  const setSidAirportFilter = useFlightStore(state => state.setSidAirportFilter);
  const sidProcedureFilter = useFlightStore(state => state.sidProcedureFilter);
  const setSidProcedureFilter = useFlightStore(state => state.setSidProcedureFilter);
  
  // STAR state
  const starVisible = useFlightStore(state => state.starVisible);
  const setStarVisible = useFlightStore(state => state.setStarVisible);
  const starWaypointsVisible = useFlightStore(state => state.starWaypointsVisible);
  const setStarWaypointsVisible = useFlightStore(state => state.setStarWaypointsVisible);
  const starOpacity = useFlightStore(state => state.starOpacity);
  const setStarOpacity = useFlightStore(state => state.setStarOpacity);
  const starLineWeight = useFlightStore(state => state.starLineWeight);
  const setStarLineWeight = useFlightStore(state => state.setStarLineWeight);
  const starAirportFilter = useFlightStore(state => state.starAirportFilter);
  const setStarAirportFilter = useFlightStore(state => state.setStarAirportFilter);
  const starProcedureFilter = useFlightStore(state => state.starProcedureFilter);
  const setStarProcedureFilter = useFlightStore(state => state.setStarProcedureFilter);
  
  // PBN state
  const setPbnVisible = useFlightStore(state => state.setPbnVisible);
  const pbnLegsVisible = useFlightStore(state => state.pbnLegsVisible);
  const setPbnLegsVisible = useFlightStore(state => state.setPbnLegsVisible);
  const pbnWaypointsVisible = useFlightStore(state => state.pbnWaypointsVisible);
  const setPbnWaypointsVisible = useFlightStore(state => state.setPbnWaypointsVisible);
  const pbnOpacity = useFlightStore(state => state.pbnOpacity);
  const setPbnOpacity = useFlightStore(state => state.setPbnOpacity);
  const pbnLineWeight = useFlightStore(state => state.pbnLineWeight);
  const setPbnLineWeight = useFlightStore(state => state.setPbnLineWeight);
  const pbnAirportFilter = useFlightStore(state => state.pbnAirportFilter);
  const setPbnAirportFilter = useFlightStore(state => state.setPbnAirportFilter);
  const pbnProcedureFilter = useFlightStore(state => state.pbnProcedureFilter);
  const setPbnProcedureFilter = useFlightStore(state => state.setPbnProcedureFilter);
  
  // ILS state
  const setIlsVisible = useFlightStore(state => state.setIlsVisible);
  const ilsLegsVisible = useFlightStore(state => state.ilsLegsVisible);
  const setIlsLegsVisible = useFlightStore(state => state.setIlsLegsVisible);
  const ilsWaypointsVisible = useFlightStore(state => state.ilsWaypointsVisible);
  const setIlsWaypointsVisible = useFlightStore(state => state.setIlsWaypointsVisible);
  const ilsOpacity = useFlightStore(state => state.ilsOpacity);
  const setIlsOpacity = useFlightStore(state => state.setIlsOpacity);
  const ilsLineWeight = useFlightStore(state => state.ilsLineWeight);
  const setIlsLineWeight = useFlightStore(state => state.setIlsLineWeight);
  const ilsAirportFilter = useFlightStore(state => state.ilsAirportFilter);
  const setIlsAirportFilter = useFlightStore(state => state.setIlsAirportFilter);
  const ilsProcedureFilter = useFlightStore(state => state.ilsProcedureFilter);
  const setIlsProcedureFilter = useFlightStore(state => state.setIlsProcedureFilter);

  // Layer data for dropdowns
  const [sidData, setSidData] = useState<LayerData>({ airports: [], procedures: [] });
  const [starData, setStarData] = useState<LayerData>({ airports: [], procedures: [] });
  const [pbnData, setPbnData] = useState<LayerData>({ airports: [], procedures: [] });
  const [ilsData, setIlsData] = useState<LayerData>({ airports: [], procedures: [] });

  // Load layer data on mount
  useEffect(() => {
    const loadLayerData = async (url: string): Promise<LayerData> => {
      try {
        const res = await fetch(url);
        const data = await res.json();
        const airports = new Set<string>();
        const procedures: { airport: string; procedure: string }[] = [];
        
        data.features?.forEach((f: { properties: { airport_identifier?: string; procedure_identifier?: string } }) => {
          const airport = f.properties?.airport_identifier;
          const procedure = f.properties?.procedure_identifier;
          if (airport?.startsWith('VT')) {
            airports.add(airport);
            if (procedure) {
              const key = `${airport}-${procedure}`;
              if (!procedures.some(p => `${p.airport}-${p.procedure}` === key)) {
                procedures.push({ airport, procedure });
              }
            }
          }
        });
        
        return { 
          airports: Array.from(airports).sort(), 
          procedures: procedures.sort((a, b) => a.procedure.localeCompare(b.procedure))
        };
      } catch {
        return { airports: [], procedures: [] };
      }
    };

    loadLayerData('/sid/sid_line_thai.geojson').then(setSidData);
    loadLayerData('/star/star_line.geojson').then(setStarData);
    loadLayerData('/pbn/true pbn.geojson').then(setPbnData);
    loadLayerData('/ils/True ils leg.geojson').then(setIlsData);
  }, []);

  // Get filtered procedures based on selected airports
  const getFilteredProcedures = (data: LayerData, selectedAirports: string[]) => {
    if (selectedAirports.length === 0) {
      return data.procedures.map(p => ({ value: p.procedure, label: `${p.procedure} (${p.airport})` }));
    }
    return data.procedures
      .filter(p => selectedAirports.includes(p.airport))
      .map(p => ({ value: p.procedure, label: `${p.procedure} (${p.airport})` }));
  };

  if (uiHidden || !optionsPanelOpen) return null;

  const tabs = [
    { id: 'airports' as const, label: 'Airports', icon: '✈️' },
    { id: 'gates' as const, label: 'Gates', icon: '🚪' },
    { id: 'sid' as const, label: 'SID', icon: '🛫' },
    { id: 'star' as const, label: 'STAR', icon: '🛬' },
    { id: 'pbn' as const, label: 'PBN', icon: '📍' },
    { id: 'ils' as const, label: 'ILS', icon: '📻' },
  ];

  const airportOptions = (airports: string[]) => airports.map(a => ({ value: a, label: a }));

  return (
    <div id="options-panel">
      <div className="options-header">
        <span>⚙️ Layer Options</span>
        <button onClick={() => setOptionsPanelOpen(false)}>×</button>
      </div>
      
      <div className="options-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`options-tab ${optionsPanelTab === tab.id ? 'active' : ''}`}
            onClick={() => setOptionsPanelTab(tab.id)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>
      
      <div className="options-content">
        {optionsPanelTab === 'airports' && (
          <AirportsTabContent />
        )}
        
        {optionsPanelTab === 'gates' && (
          <GatesTabContent />
        )}
        
        {optionsPanelTab === 'sid' && (
          <div className="options-section">
            <div className="options-row">
              <span onClick={() => setSidVisible(!sidVisible)}>SID Routes</span>
              <input type="checkbox" checked={sidVisible} onChange={(e) => setSidVisible(e.target.checked)} />
            </div>
            <div className="options-row">
              <span onClick={() => setSidWaypointsVisible(!sidWaypointsVisible)}>Waypoints</span>
              <input type="checkbox" checked={sidWaypointsVisible} onChange={(e) => setSidWaypointsVisible(e.target.checked)} />
            </div>
            <div className="options-row column">
              <span>Airport</span>
              <MultiSelectDropdown
                options={airportOptions(sidData.airports)}
                selected={sidAirportFilter}
                onChange={setSidAirportFilter}
                placeholder="All Airports"
              />
            </div>
            <div className="options-row column">
              <span>Procedure</span>
              <MultiSelectDropdown
                options={getFilteredProcedures(sidData, sidAirportFilter)}
                selected={sidProcedureFilter}
                onChange={setSidProcedureFilter}
                placeholder="All Procedures"
              />
            </div>
            <div className="options-row column">
              <span>Opacity</span>
              <div className="slider-row">
                <input type="range" min="0.1" max="1" step="0.1" value={sidOpacity} onChange={(e) => setSidOpacity(parseFloat(e.target.value))} />
                <span className="slider-value">{(sidOpacity * 100).toFixed(0)}%</span>
              </div>
            </div>
            <div className="options-row column">
              <span>Line Thickness</span>
              <div className="slider-row">
                <input type="range" min="0.5" max="5" step="0.5" value={sidLineWeight} onChange={(e) => setSidLineWeight(parseFloat(e.target.value))} />
                <span className="slider-value">{sidLineWeight}px</span>
              </div>
            </div>
          </div>
        )}
        
        {optionsPanelTab === 'star' && (
          <div className="options-section">
            <div className="options-row">
              <span onClick={() => setStarVisible(!starVisible)}>STAR Routes</span>
              <input type="checkbox" checked={starVisible} onChange={(e) => setStarVisible(e.target.checked)} />
            </div>
            <div className="options-row">
              <span onClick={() => setStarWaypointsVisible(!starWaypointsVisible)}>Waypoints</span>
              <input type="checkbox" checked={starWaypointsVisible} onChange={(e) => setStarWaypointsVisible(e.target.checked)} />
            </div>
            <div className="options-row column">
              <span>Airport</span>
              <MultiSelectDropdown
                options={airportOptions(starData.airports)}
                selected={starAirportFilter}
                onChange={setStarAirportFilter}
                placeholder="All Airports"
              />
            </div>
            <div className="options-row column">
              <span>Procedure</span>
              <MultiSelectDropdown
                options={getFilteredProcedures(starData, starAirportFilter)}
                selected={starProcedureFilter}
                onChange={setStarProcedureFilter}
                placeholder="All Procedures"
              />
            </div>
            <div className="options-row column">
              <span>Opacity</span>
              <div className="slider-row">
                <input type="range" min="0.1" max="1" step="0.1" value={starOpacity} onChange={(e) => setStarOpacity(parseFloat(e.target.value))} />
                <span className="slider-value">{(starOpacity * 100).toFixed(0)}%</span>
              </div>
            </div>
            <div className="options-row column">
              <span>Line Thickness</span>
              <div className="slider-row">
                <input type="range" min="0.5" max="5" step="0.5" value={starLineWeight} onChange={(e) => setStarLineWeight(parseFloat(e.target.value))} />
                <span className="slider-value">{starLineWeight}px</span>
              </div>
            </div>
          </div>
        )}
        
        {optionsPanelTab === 'pbn' && (
          <div className="options-section">
            <div className="options-row">
              <span onClick={() => setPbnLegsVisible(!pbnLegsVisible)}>PBN Routes</span>
              <input type="checkbox" checked={pbnLegsVisible} onChange={(e) => { setPbnLegsVisible(e.target.checked); if (e.target.checked) setPbnVisible(true); }} />
            </div>
            <div className="options-row">
              <span onClick={() => setPbnWaypointsVisible(!pbnWaypointsVisible)}>Waypoints</span>
              <input type="checkbox" checked={pbnWaypointsVisible} onChange={(e) => { setPbnWaypointsVisible(e.target.checked); if (e.target.checked) setPbnVisible(true); }} />
            </div>
            <div className="options-row column">
              <span>Airport</span>
              <MultiSelectDropdown
                options={airportOptions(pbnData.airports)}
                selected={pbnAirportFilter}
                onChange={setPbnAirportFilter}
                placeholder="All Airports"
              />
            </div>
            <div className="options-row column">
              <span>Procedure</span>
              <MultiSelectDropdown
                options={getFilteredProcedures(pbnData, pbnAirportFilter)}
                selected={pbnProcedureFilter}
                onChange={setPbnProcedureFilter}
                placeholder="All Procedures"
              />
            </div>
            <div className="options-row column">
              <span>Opacity</span>
              <div className="slider-row">
                <input type="range" min="0.1" max="1" step="0.1" value={pbnOpacity} onChange={(e) => setPbnOpacity(parseFloat(e.target.value))} />
                <span className="slider-value">{(pbnOpacity * 100).toFixed(0)}%</span>
              </div>
            </div>
            <div className="options-row column">
              <span>Line Thickness</span>
              <div className="slider-row">
                <input type="range" min="0.5" max="5" step="0.5" value={pbnLineWeight} onChange={(e) => setPbnLineWeight(parseFloat(e.target.value))} />
                <span className="slider-value">{pbnLineWeight}px</span>
              </div>
            </div>
          </div>
        )}
        
        {optionsPanelTab === 'ils' && (
          <div className="options-section">
            <div className="options-row">
              <span onClick={() => setIlsLegsVisible(!ilsLegsVisible)}>ILS Routes</span>
              <input type="checkbox" checked={ilsLegsVisible} onChange={(e) => { setIlsLegsVisible(e.target.checked); if (e.target.checked) setIlsVisible(true); }} />
            </div>
            <div className="options-row">
              <span onClick={() => setIlsWaypointsVisible(!ilsWaypointsVisible)}>Waypoints</span>
              <input type="checkbox" checked={ilsWaypointsVisible} onChange={(e) => { setIlsWaypointsVisible(e.target.checked); if (e.target.checked) setIlsVisible(true); }} />
            </div>
            <div className="options-row column">
              <span>Airport</span>
              <MultiSelectDropdown
                options={airportOptions(ilsData.airports)}
                selected={ilsAirportFilter}
                onChange={setIlsAirportFilter}
                placeholder="All Airports"
              />
            </div>
            <div className="options-row column">
              <span>Procedure</span>
              <MultiSelectDropdown
                options={getFilteredProcedures(ilsData, ilsAirportFilter)}
                selected={ilsProcedureFilter}
                onChange={setIlsProcedureFilter}
                placeholder="All Procedures"
              />
            </div>
            <div className="options-row column">
              <span>Opacity</span>
              <div className="slider-row">
                <input type="range" min="0.1" max="1" step="0.1" value={ilsOpacity} onChange={(e) => setIlsOpacity(parseFloat(e.target.value))} />
                <span className="slider-value">{(ilsOpacity * 100).toFixed(0)}%</span>
              </div>
            </div>
            <div className="options-row column">
              <span>Line Thickness</span>
              <div className="slider-row">
                <input type="range" min="0.5" max="5" step="0.5" value={ilsLineWeight} onChange={(e) => setIlsLineWeight(parseFloat(e.target.value))} />
                <span className="slider-value">{ilsLineWeight}px</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============== Airspace Dropdown ==============
const SECTOR_LAYERS = [
  { id: 'bacc', label: 'BACC' },
  { id: 'tma', label: 'TMA' },
  { id: 'ctr', label: 'CTR' },
  { id: 'fir_world', label: 'FIR' },
  { id: 'pdr', label: 'PDR' },
] as const;

function SectorsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeLayer, setActiveLayer] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const [layerDropdownPos, setLayerDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const layerDropdownRef = useRef<HTMLDivElement>(null);
  
  const sectorLayers = useFlightStore(state => state.sectorLayers);
  const setSectorLayerVisible = useFlightStore(state => state.setSectorLayerVisible);
  const setSectorLayerLabels = useFlightStore(state => state.setSectorLayerLabels);
  const setSectorLayerFill = useFlightStore(state => state.setSectorLayerFill);
  const setSectorLayerOpacity = useFlightStore(state => state.setSectorLayerOpacity);
  const uiHidden = useFlightStore(state => state.uiHidden);
  
  // Close on double-click outside or ESC key
  const outsideClickCountRef = useRef(0);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    if (!isOpen) {
      outsideClickCountRef.current = 0;
      return;
    }
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedInsideMain = dropdownRef.current?.contains(target) || buttonRef.current?.contains(target);
      const clickedInsideLayer = layerDropdownRef.current?.contains(target);
      
      if (!clickedInsideMain && !clickedInsideLayer) {
        outsideClickCountRef.current += 1;
        
        if (clickTimeoutRef.current) {
          clearTimeout(clickTimeoutRef.current);
        }
        
        if (outsideClickCountRef.current >= 2) {
          setIsOpen(false);
          setActiveLayer(null);
          outsideClickCountRef.current = 0;
        } else {
          // Reset click count after 500ms if no second click
          clickTimeoutRef.current = setTimeout(() => {
            outsideClickCountRef.current = 0;
          }, 500);
        }
      }
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setActiveLayer(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, [isOpen]);
  
  // Close when curtain is hidden
  useEffect(() => {
    if (uiHidden) {
      setIsOpen(false);
      setActiveLayer(null);
    }
  }, [uiHidden]);
  
  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 8, left: rect.left });
    }
    setIsOpen(!isOpen);
    setActiveLayer(null);
  };
  
  const handleLayerClick = (layerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Gates has no sub-options, don't open dropdown
    if (layerId === 'gates') return;
    if (activeLayer === layerId) {
      setActiveLayer(null);
    } else {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setLayerDropdownPos({ top: rect.bottom + 4, left: rect.left });
      setActiveLayer(layerId);
    }
  };
  
  const handleVisibilityToggle = (layerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSectorLayerVisible(layerId, !sectorLayers[layerId]?.visible);
  };
  
  const getLayerVisible = (layerId: string): boolean => {
    return sectorLayers[layerId]?.visible || false;
  };
  
  const isFirLayer = activeLayer === 'fir_world';
  
  const layerOptionsDropdown = activeLayer && layerDropdownPos && createPortal(
    <div 
      ref={layerDropdownRef}
      className="sector-layer-options"
      style={{ 
        position: 'fixed',
        top: layerDropdownPos.top,
        left: layerDropdownPos.left,
        zIndex: 1000000
      }}
    >
      {!isFirLayer && (
        <div className="sector-option-row">
          <label>Show Labels</label>
          <input 
            type="checkbox" 
            checked={sectorLayers[activeLayer]?.labelsVisible || false} 
            onChange={(e) => setSectorLayerLabels(activeLayer, e.target.checked)}
          />
        </div>
      )}
      {!isFirLayer && (
        <div className="sector-option-row">
          <label>Show Fill</label>
          <input 
            type="checkbox" 
            checked={sectorLayers[activeLayer]?.fillVisible || false} 
            onChange={(e) => setSectorLayerFill(activeLayer, e.target.checked)}
          />
        </div>
      )}
      <div className="sector-option-row">
        <label>Opacity</label>
        <div className="opacity-control">
          <input
            type="range"
            min="0.1"
            max="0.8"
            step="0.1"
            value={sectorLayers[activeLayer]?.opacity || 0.4}
            onChange={(e) => setSectorLayerOpacity(activeLayer, parseFloat(e.target.value))}
            className="opacity-slider"
          />
          <span className="opacity-value">{((sectorLayers[activeLayer]?.opacity || 0.4) * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>,
    document.body
  );
  
  const dropdownContent = isOpen && dropdownPos && createPortal(
    <div 
      ref={dropdownRef}
      className="sectors-dropdown"
      style={{ 
        position: 'fixed',
        top: dropdownPos.top,
        left: dropdownPos.left,
        zIndex: 999999
      }}
    >
      <div className="sectors-layer-list">
        {SECTOR_LAYERS.map(layer => (
          <div key={layer.id} className="sector-layer-item">
            <div 
              className={`sector-layer-name ${activeLayer === layer.id ? 'active' : ''}`}
              onClick={(e) => handleLayerClick(layer.id, e)}
              role="img"
              aria-label={layer.label}
            >
              {layer.label}
            </div>
            <div 
              className={`sector-visibility-box ${getLayerVisible(layer.id) ? 'visible' : ''}`}
              onClick={(e) => handleVisibilityToggle(layer.id, e)}
              title={getLayerVisible(layer.id) ? 'Hide' : 'Show'}
            />
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
  
  return (
    <>
      <button 
        ref={buttonRef}
        id="btn-sectors" 
        title="Airspace Layers"
        className={isOpen ? 'active' : ''}
        onClick={handleToggle}
      >
        🌐 Airspace
      </button>
      {dropdownContent}
      {layerOptionsDropdown}
    </>
  );
}

// ============== Curtain Toggle (Toggle UI) ==============
function CurtainRope() {
  const uiHidden = useFlightStore(state => state.uiHidden);
  const setUiHidden = useFlightStore(state => state.setUiHidden);
  
  return (
    <div 
      id="curtain-rope" 
      className={uiHidden ? 'ui-hidden' : ''}
      onClick={() => setUiHidden(!uiHidden)}
      title={uiHidden ? 'Show Controls' : 'Hide Controls'}
    >
      <div className="toggle-icon"></div>
    </div>
  );
}

// ============== Theme Controls (Bottom Right) ==============
function ThemeControls() {
  const [isVisible, setIsVisible] = useState(true);
  const lightMode = useFlightStore(state => state.lightMode);
  const setLightMode = useFlightStore(state => state.setLightMode);
  const satelliteMode = useFlightStore(state => state.satelliteMode);
  const setSatelliteMode = useFlightStore(state => state.setSatelliteMode);
  const uiHidden = useFlightStore(state => state.uiHidden);
  
  if (uiHidden) return null;
  
  return (
    <div className={`theme-controls ${isVisible ? 'visible' : 'hidden'}`}>
      <button 
        className="theme-toggle-btn"
        onClick={() => setIsVisible(!isVisible)}
        title={isVisible ? 'Hide Theme Controls' : 'Show Theme Controls'}
      >
        {isVisible ? '▶' : '◀'}
      </button>
      <div className="theme-buttons">
        <button 
          id="btn-theme" 
          title="Toggle Light/Dark Mode"
          className={lightMode ? 'active' : ''}
          onClick={() => setLightMode(!lightMode)}
        >
          {lightMode ? '🌙' : '☀️'}
        </button>
        <button 
          id="btn-satellite" 
          title="Toggle Satellite View"
          className={satelliteMode ? 'active' : ''}
          onClick={() => setSatelliteMode(!satelliteMode)}
        >
          🌍
        </button>
      </div>
    </div>
  );
}

// ============== Airport Info Panel ==============
function AirportInfoPanel() {
  const selectedAirport = useAirportStore(state => state.selectedAirport);
  const airportPanelOpen = useAirportStore(state => state.airportPanelOpen);
  const setSelectedAirport = useAirportStore(state => state.setSelectedAirport);
  const [isClosing, setIsClosing] = useState(false);
  
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setSelectedAirport(null);
      setIsClosing(false);
    }, 300);
  };
  
  if (!airportPanelOpen || !selectedAirport) return null;
  
  const a = selectedAirport;
  
  return (
    <div className={`airport-info-panel ${isClosing ? 'closing' : ''}`}>
      <div className="airport-panel-header">
        <h2>{a.AP || a.airport_name}</h2>
        <button className="close-btn" onClick={handleClose}>×</button>
      </div>
      <div className="airport-panel-content">
        <div className="airport-panel-section">
          <h3>Identification</h3>
          <div className="info-row"><span className="label">ICAO Code:</span><span className="value">{a.airport_identifier}</span></div>
          <div className="info-row"><span className="label">IATA Code:</span><span className="value">{a.iata_ata_designator || 'N/A'}</span></div>
          <div className="info-row"><span className="label">Airport Name:</span><span className="value">{a.airport_name}</span></div>
          <div className="info-row"><span className="label">Type:</span><span className="value">{a.Main === 'Y' ? 'Main Airport' : 'Sub Airport'}</span></div>
        </div>
        
        <div className="airport-panel-section">
          <h3>Location</h3>
          <div className="info-row"><span className="label">Latitude:</span><span className="value">{a.airport_ref_latitude.toFixed(6)}°</span></div>
          <div className="info-row"><span className="label">Longitude:</span><span className="value">{a.airport_ref_longitude.toFixed(6)}°</span></div>
          <div className="info-row"><span className="label">Elevation:</span><span className="value">{a.elevation} ft</span></div>
          <div className="info-row"><span className="label">Area Code:</span><span className="value">{a.area_code}</span></div>
        </div>
        
        <div className="airport-panel-section">
          <h3>Operations</h3>
          <div className="info-row"><span className="label">IFR Capable:</span><span className="value">{a.ifr_capability === 'Y' ? 'Yes' : 'No'}</span></div>
          <div className="info-row"><span className="label">Runway Surface:</span><span className="value">{getRunwaySurfaceText(a.longest_runway_surface_code)}</span></div>
          <div className="info-row"><span className="label">Transition Altitude:</span><span className="value">{a.transition_altitude} ft</span></div>
          <div className="info-row"><span className="label">Transition Level:</span><span className="value">{a.transition_level} ft</span></div>
        </div>
        
        <div className="airport-panel-section">
          <h3>Speed Restrictions</h3>
          <div className="info-row"><span className="label">Speed Limit:</span><span className="value">{a.speed_limit} kts</span></div>
          <div className="info-row"><span className="label">Speed Limit Altitude:</span><span className="value">{a.speed_limit_altitude} ft</span></div>
        </div>
      </div>
    </div>
  );
}

// ============== Timeline ==============
function Timeline() {
  const timelineRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  
  const timeline = useFlightStore(state => state.timeline);
  const { seekTo } = useAnimation();
  
  const progress = useMemo(() => {
    if (timeline.end === timeline.start) return 0;
    return ((timeline.current - timeline.start) / (timeline.end - timeline.start)) * 100;
  }, [timeline]);
  
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seekTo(timeline.start + ratio * (timeline.end - timeline.start));
  }, [timeline, seekTo]);
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current || !timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    let ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(timeline.start + ratio * (timeline.end - timeline.start));
  }, [timeline, seekTo]);
  
  const handleMouseUp = useCallback(() => { isDraggingRef.current = false; }, []);
  
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div id="timeline-container">
      <div id="timeline-wrapper">
        <div ref={timelineRef} id="timeline-bar" onClick={handleTimelineClick}>
          <div id="timeline-progress" style={{ width: `${progress}%` }} />
          <div 
            id="timeline-handle" 
            style={{ left: `${progress}%` }}
            onMouseDown={() => isDraggingRef.current = true}
          />
        </div>
      </div>
    </div>
  );
}

// ============== Flight Panel ==============
const FlightItem = memo(function FlightItem({ 
  flightKey, meta, isLocked, onFocus, onVisibilityChange 
}: { 
  flightKey: string; 
  meta: { visible: boolean; color: string }; 
  isLocked: boolean; 
  onFocus: () => void; 
  onVisibilityChange: (visible: boolean) => void;
}) {
  return (
    <div 
      className={`flight-item ${isLocked ? 'locked' : ''}`}
      style={isLocked ? { background: 'rgba(0, 217, 255, 0.15)' } : undefined}
      onClick={onFocus}
    >
      <input
        type="checkbox"
        checked={meta.visible}
        onChange={(e) => { e.stopPropagation(); onVisibilityChange(e.target.checked); }}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="color-dot" style={{ background: meta.color }} />
      <span className="flight-name" title={flightKey}>{flightKey}</span>
    </div>
  );
});

function FlightPanel() {
  const flights = useFlightStore(state => state.flights);
  const flightMeta = useFlightStore(state => state.flightMeta);
  const setVisibility = useFlightStore(state => state.setVisibility);
  const setAllVisibility = useFlightStore(state => state.setAllVisibility);
  const focusFlight = useFlightStore(state => state.focusFlight);
  const lockedFlightKey = useFlightStore(state => state.lockedFlightKey);
  const totalRows = useFlightStore(state => state.totalRowsLoaded);
  const uiHidden = useFlightStore(state => state.uiHidden);
  const [isOpen, setIsOpen] = useState(false);
  
  const flightKeys = useMemo(() => Object.keys(flights), [flights]);
  const flightCount = flightKeys.length;
  const pointCount = useMemo(() => (totalRows / 1000).toFixed(0), [totalRows]);
  
  const handleToggleAll = useCallback(() => {
    const allVisible = Object.values(flightMeta).every(m => m.visible);
    setAllVisibility(!allVisible);
  }, [flightMeta, setAllVisibility]);

  return (
    <>
      <button 
        id="flight-panel-toggle"
        className={uiHidden ? 'ui-hidden' : ''}
        onClick={() => setIsOpen(o => !o)}
        title="Toggle Flight List"
      >
        ✈ {flightCount}
      </button>
      <div id="flight-panel" className={`${isOpen ? 'open' : ''} ${uiHidden ? 'ui-hidden' : ''}`}>
        <div id="flight-panel-header">
          <span>Flights ({flightCount}) • {pointCount}k pts</span>
          <div>
            <button id="btn-toggle-all" onClick={handleToggleAll}>Toggle All</button>
            <button id="btn-close-panel" onClick={() => setIsOpen(false)}>✕</button>
          </div>
        </div>
        <div id="flight-list">
          {flightKeys.map(key => {
            const meta = flightMeta[key];
            if (!meta) return null;
            return (
              <FlightItem
                key={key}
                flightKey={key}
                meta={meta}
                isLocked={lockedFlightKey === key}
                onFocus={() => focusFlight(key, false, true)}
                onVisibilityChange={(v: boolean) => setVisibility(key, v)}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}

// ============== Filter Panel ==============
function FilterPanel() {
  const filterPanelOpen = useFlightStore(state => state.filterPanelOpen);
  const setFilterPanelOpen = useFlightStore(state => state.setFilterPanelOpen);
  const filter = useFlightStore(state => state.filter);
  const setFilter = useFlightStore(state => state.setFilter);
  const flights = useFlightStore(state => state.flights);
  const flightMeta = useFlightStore(state => state.flightMeta);
  const globalMaxFL = useFlightStore(state => state.globalMaxFL);
  const applyFilter = useFlightStore(state => state.applyFilter);
  const clearFilter = useFlightStore(state => state.clearFilter);
  const setAllVisibility = useFlightStore(state => state.setAllVisibility);
  const invertVisibility = useFlightStore(state => state.invertVisibility);
  const setVisibility = useFlightStore(state => state.setVisibility);
  const focusFlight = useFlightStore(state => state.focusFlight);
  const lockedFlightKey = useFlightStore(state => state.lockedFlightKey);
  
  const [depOpen, setDepOpen] = useState(false);
  const [destOpen, setDestOpen] = useState(false);
  const [actypeOpen, setActypeOpen] = useState(false);
  const [airportFilterOpen, setAirportFilterOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'filter' | 'route' | 'airline'>('filter');
  const [airlineSearch, setAirlineSearch] = useState('');
  const [flightTypeFilter, setFlightTypeFilter] = useState<'all' | 'inbound' | 'outbound' | 'domestic' | 'overfly'>('all');
  
  const airportFilterCode = useFlightStore(state => state.airportFilterCode);
  const setAirportFilterCode = useFlightStore(state => state.setAirportFilterCode);
  
  // Airline mode state
  const airlineModeEnabled = useFlightStore(state => state.airlineModeEnabled);
  const setAirlineModeEnabled = useFlightStore(state => state.setAirlineModeEnabled);
  const airlineColors = useFlightStore(state => state.airlineColors);
  const setAirlineColors = useFlightStore(state => state.setAirlineColors);
  const selectedAirlines = useFlightStore(state => state.selectedAirlines);
  const setSelectedAirlines = useFlightStore(state => state.setSelectedAirlines);
  
  // Load airlines from CSV and extract from flight keys
  const [airlinesData, setAirlinesData] = useState<Record<string, { name: string; color: string }>>({});
  
  // Extract unique airlines from flight keys (first 3 characters)
  const extractedAirlines = useMemo(() => {
    const airlines: Record<string, number> = {};
    Object.keys(flightMeta).forEach(key => {
      const airlineCode = key.substring(0, 3).toUpperCase();
      airlines[airlineCode] = (airlines[airlineCode] || 0) + 1;
    });
    return Object.entries(airlines).sort((a, b) => b[1] - a[1]);
  }, [flightMeta]);
  
  // Filtered airlines based on search
  const filteredAirlines = useMemo(() => {
    if (!airlineSearch) return extractedAirlines;
    const search = airlineSearch.toUpperCase();
    return extractedAirlines.filter(([code]) => {
      const info = airlinesData[code];
      return code.includes(search) || (info?.name?.toUpperCase().includes(search));
    });
  }, [extractedAirlines, airlineSearch, airlinesData]);
  
  // Load airlines CSV on mount
  useEffect(() => {
    fetch('/airlines.csv')
      .then(res => res.text())
      .then(text => {
        const lines = text.trim().split('\n');
        const data: Record<string, { name: string; color: string }> = {};
        lines.slice(1).forEach(line => {
          const [code, name, color] = line.split(',');
          if (code && name && color) {
            data[code.trim()] = { name: name.trim(), color: color.trim() };
          }
        });
        setAirlinesData(data);
        
        // Generate colors for airlines not in CSV
        const generatedColors: Record<string, string> = {};
        const defaultColors = [
          '#e94560', '#00d9ff', '#ffd700', '#00ff88', '#ff6b6b',
          '#4ecdc4', '#ff9f43', '#a55eea', '#26de81', '#fd79a8',
          '#74b9ff', '#ffeaa7', '#81ecec', '#fab1a0', '#ff7675',
          '#a29bfe', '#fdcb6e', '#6c5ce7', '#00b894', '#e17055'
        ];
        let colorIdx = 0;
        Object.keys(flightMeta).forEach(key => {
          const airlineCode = key.substring(0, 3).toUpperCase();
          if (!generatedColors[airlineCode]) {
            if (data[airlineCode]) {
              generatedColors[airlineCode] = data[airlineCode].color;
            } else {
              generatedColors[airlineCode] = defaultColors[colorIdx % defaultColors.length];
              colorIdx++;
            }
          }
        });
        setAirlineColors(generatedColors);
      })
      .catch(() => {
        // Generate colors if CSV fails to load
        const defaultColors = [
          '#e94560', '#00d9ff', '#ffd700', '#00ff88', '#ff6b6b',
          '#4ecdc4', '#ff9f43', '#a55eea', '#26de81', '#fd79a8'
        ];
        const generatedColors: Record<string, string> = {};
        let colorIdx = 0;
        Object.keys(flightMeta).forEach(key => {
          const airlineCode = key.substring(0, 3).toUpperCase();
          if (!generatedColors[airlineCode]) {
            generatedColors[airlineCode] = defaultColors[colorIdx % defaultColors.length];
            colorIdx++;
          }
        });
        setAirlineColors(generatedColors);
      });
  }, [flightMeta, setAirlineColors]);
  
  // Route data with counts
  const routeData = useMemo(() => {
    const depCounts: Record<string, number> = {};
    const destCounts: Record<string, number> = {};
    const actypeCounts: Record<string, number> = {};
    const routes: { dep: string; dest: string }[] = [];
    
    Object.values(flightMeta).forEach(meta => {
      if (meta.dep) depCounts[meta.dep] = (depCounts[meta.dep] || 0) + 1;
      if (meta.dest) destCounts[meta.dest] = (destCounts[meta.dest] || 0) + 1;
      if (meta.actype) actypeCounts[meta.actype] = (actypeCounts[meta.actype] || 0) + 1;
      if (meta.dep && meta.dest) routes.push({ dep: meta.dep, dest: meta.dest });
    });
    
    return { depCounts, destCounts, actypeCounts, routes };
  }, [flightMeta]);
  
  // Filtered dropdown options
  const dropdownOptions = useMemo(() => {
    const { routes, actypeCounts } = routeData;
    const validDepCounts: Record<string, number> = {};
    const validDestCounts: Record<string, number> = {};
    
    routes.forEach(r => {
      if (!filter.dest || r.dest.toUpperCase().includes(filter.dest.toUpperCase())) {
        validDepCounts[r.dep] = (validDepCounts[r.dep] || 0) + 1;
      }
      if (!filter.dep || r.dep.toUpperCase().includes(filter.dep.toUpperCase())) {
        validDestCounts[r.dest] = (validDestCounts[r.dest] || 0) + 1;
      }
    });
    
    const sortByCount = (counts: Record<string, number>) =>
      Object.entries(counts).sort((a, b) => b[1] - a[1]);
    
    return {
      deps: sortByCount(validDepCounts),
      dests: sortByCount(validDestCounts),
      actypes: sortByCount(actypeCounts),
    };
  }, [routeData, filter.dep, filter.dest]);
  
  // Get max FL for flight
  const getFlightMaxFL = useCallback((key: string) => {
    const points = flights[key];
    if (!points) return null;
    let maxFL = -Infinity;
    for (const p of points) {
      if (p.fl !== null && p.fl > maxFL) maxFL = p.fl;
    }
    return maxFL === -Infinity ? null : maxFL;
  }, [flights]);
  
  // Thailand airports for flight type filtering
  const thailandAirports = useMemo(() => new Set([
    'VTBS', 'VTBD', 'VTSP', 'VTCC', 'VTSS', 'VTUD', 'VTUK', 'VTUU', 'VTUW', 'VTPM',
    'VTPH', 'VTPO', 'VTPB', 'VTPT', 'VTPP', 'VTPI', 'VTPL', 'VTPN', 'VTSC', 'VTSB',
    'VTSF', 'VTSG', 'VTSH', 'VTSK', 'VTSM', 'VTSR', 'VTST', 'VTSE', 'VTUO', 'VTUI',
    'VTUL', 'VTUN', 'VTUQ', 'VTUV', 'VTUW', 'VTCT', 'VTCL', 'VTCN', 'VTCP', 'VTCH',
    'BKK', 'DMK', 'HKT', 'CNX', 'HDY', 'USM', 'KBV', 'CEI', 'UTP', 'UTH', 'UBP',
    'NAK', 'NST', 'SGZ', 'TDX', 'TST', 'PHS', 'HHQ', 'MAQ', 'LPT', 'PRH', 'KKC',
    'LOE', 'ROI', 'SNO', 'URT', 'NNT', 'PHY', 'THS', 'TKT', 'KOP', 'BTU'
  ]), []);
  
  // Matching flights
  const matchingFlights = useMemo(() => {
    return Object.keys(flights).filter(key => {
      const meta = flightMeta[key];
      const points = flights[key];
      if (!meta || !points || points.length === 0) return false;
      
      if (filter.searchText) {
        const searchUpper = filter.searchText.toUpperCase();
        let matches = false;
        if (filter.searchFields.includes('flight_key') && key.toUpperCase().includes(searchUpper)) matches = true;
        if (filter.searchFields.includes('acid')) {
          const acid = points[0].acid;
          if (acid && acid.toUpperCase().includes(searchUpper)) matches = true;
        }
        if (!matches) return false;
      }
      
      const maxFL = getFlightMaxFL(key);
      if (maxFL !== null && (maxFL < filter.flMin || maxFL > filter.flMax)) return false;
      if (filter.actype && meta.actype && !meta.actype.toUpperCase().includes(filter.actype.toUpperCase())) return false;
      if (filter.dep && meta.dep && !meta.dep.toUpperCase().includes(filter.dep.toUpperCase())) return false;
      if (filter.dest && meta.dest && !meta.dest.toUpperCase().includes(filter.dest.toUpperCase())) return false;
      
      // Flight type filter
      if (flightTypeFilter !== 'all') {
        const dep = meta.dep?.toUpperCase() || '';
        const dest = meta.dest?.toUpperCase() || '';
        const depInThailand = thailandAirports.has(dep);
        const destInThailand = thailandAirports.has(dest);
        
        switch (flightTypeFilter) {
          case 'inbound':
            // Destination in Thailand, Departure outside
            if (!destInThailand || depInThailand) return false;
            break;
          case 'outbound':
            // Departure in Thailand, Destination outside
            if (!depInThailand || destInThailand) return false;
            break;
          case 'domestic':
            // Both in Thailand
            if (!depInThailand || !destInThailand) return false;
            break;
          case 'overfly':
            // Neither in Thailand
            if (depInThailand || destInThailand) return false;
            break;
        }
      }
      
      return true;
    });
  }, [flights, flightMeta, filter, getFlightMaxFL, flightTypeFilter, thailandAirports]);
  
  // Get unique airports (both DEP and DEST) for airport filter dropdown - combine from routeData
  const airportOptions = useMemo(() => {
    const { depCounts, destCounts } = routeData;
    const combined: Record<string, number> = {};
    Object.entries(depCounts).forEach(([code, count]) => {
      combined[code] = (combined[code] || 0) + count;
    });
    Object.entries(destCounts).forEach(([code, count]) => {
      combined[code] = (combined[code] || 0) + count;
    });
    return Object.entries(combined).sort((a, b) => b[1] - a[1]);
  }, [routeData]);
  
  useEffect(() => {
    const handleClick = () => { setDepOpen(false); setDestOpen(false); setActypeOpen(false); setAirportFilterOpen(false); };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);
  
  if (!filterPanelOpen) return null;

  return (
    <div id="filter-panel" className="visible">
      <div className="filter-header">
        <span>🔍 Filter Flights</span>
        <button onClick={() => setFilterPanelOpen(false)}>×</button>
      </div>
      
      {/* Tab buttons */}
      <div className="filter-tabs">
        <button 
          className={`filter-tab ${filterTab === 'filter' ? 'active' : ''}`}
          onClick={() => setFilterTab('filter')}
        >
          🔍 Filter
        </button>
        <button 
          className={`filter-tab ${filterTab === 'route' ? 'active' : ''}`}
          onClick={() => setFilterTab('route')}
        >
          🛫 Route
        </button>
        <button 
          className={`filter-tab ${filterTab === 'airline' ? 'active' : ''}`}
          onClick={() => setFilterTab('airline')}
        >
          ✈️ Airlines
        </button>
      </div>
      
      {filterTab === 'filter' && (
      <>
      <div className="filter-section">
        <label>Search</label>
        <input
          type="text"
          placeholder="Flight key or ACID..."
          value={filter.searchText}
          onChange={(e) => setFilter({ searchText: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter') applyFilter(matchingFlights); }}
        />
        <div className="filter-checkboxes">
          <label>
            <input
              type="checkbox"
              checked={filter.searchFields.includes('flight_key')}
              onChange={(e) => {
                const fields = e.target.checked
                  ? [...filter.searchFields, 'flight_key']
                  : filter.searchFields.filter(f => f !== 'flight_key');
                setFilter({ searchFields: fields as ('flight_key' | 'acid')[] });
              }}
            />
            Key
          </label>
          <label>
            <input
              type="checkbox"
              checked={filter.searchFields.includes('acid')}
              onChange={(e) => {
                const fields = e.target.checked
                  ? [...filter.searchFields, 'acid']
                  : filter.searchFields.filter(f => f !== 'acid');
                setFilter({ searchFields: fields as ('flight_key' | 'acid')[] });
              }}
            />
            ACID
          </label>
        </div>
      </div>
      
      <div className="filter-section">
        <label>Aircraft Type</label>
        <div className="combobox" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            placeholder="ACTYPE"
            value={filter.actype}
            onChange={(e) => setFilter({ actype: e.target.value.toUpperCase() })}
            onFocus={() => setActypeOpen(true)}
          />
          <button className="dropdown-btn" onClick={() => setActypeOpen(!actypeOpen)}>▼</button>
          {actypeOpen && (
            <div className="dropdown-list">
              {dropdownOptions.actypes
                .filter(([actype]) => actype.toUpperCase().includes(filter.actype.toUpperCase()))
                .slice(0, 50)
                .map(([actype, count]) => (
                  <div key={actype} className="dropdown-item" onClick={() => { setFilter({ actype }); setActypeOpen(false); }}>
                    <span className="dropdown-value">{actype}</span>
                    <span className="dropdown-count">{count}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="filter-section">
        <label>Flight Level</label>
        <div className="fl-range-row">
          <span className="fl-label">Min</span>
          <input
            type="range"
            min={0}
            max={globalMaxFL || 500}
            value={filter.flMin}
            onChange={(e) => setFilter({ flMin: Math.min(Number(e.target.value), filter.flMax) })}
          />
          <input
            type="number"
            value={filter.flMin}
            onChange={(e) => setFilter({ flMin: Number(e.target.value) })}
          />
        </div>
        <div className="fl-range-row">
          <span className="fl-label">Max</span>
          <input
            type="range"
            min={0}
            max={globalMaxFL || 500}
            value={filter.flMax}
            onChange={(e) => setFilter({ flMax: Math.max(Number(e.target.value), filter.flMin) })}
          />
          <input
            type="number"
            value={filter.flMax}
            onChange={(e) => setFilter({ flMax: Number(e.target.value) })}
          />
        </div>
      </div>
      
      <div className="filter-section">
        <div className="filter-buttons">
          <button id="filter-apply" onClick={() => applyFilter(matchingFlights)}>
            Apply ({matchingFlights.length})
          </button>
          <button onClick={() => { clearFilter(); setAllVisibility(true); }}>Clear</button>
        </div>
        <div className="filter-buttons">
          <button onClick={() => setAllVisibility(true)}>Show All</button>
          <button onClick={() => setAllVisibility(false)}>Hide All</button>
          <button onClick={invertVisibility}>Invert</button>
        </div>
      </div>
      
      <div className="filter-section">
        <label>Results ({matchingFlights.length})</label>
        <div id="filter-results">
          {matchingFlights.slice(0, 50).map(key => {
            const meta = flightMeta[key];
            if (!meta) return null;
            const isLocked = lockedFlightKey === key;
            return (
              <div 
                key={key} 
                className={`filter-flight-item ${meta.visible ? 'visible' : ''} ${isLocked ? 'locked' : ''}`}
                style={isLocked ? { background: 'rgba(0, 217, 255, 0.2)' } : undefined}
              >
                <div 
                  className="flight-color" 
                  style={{ background: meta.color, cursor: 'pointer' }} 
                  onClick={() => focusFlight(key, false, true)}
                />
                <div className="flight-info" style={{ cursor: 'pointer' }} onClick={() => focusFlight(key, false, true)}>
                  <span className="flight-key">{key}</span>
                  <span className="flight-details">{meta.actype || '--'}</span>
                  <span className="flight-route">{meta.dep || '--'} → {meta.dest || '--'}</span>
                </div>
                <button 
                  className="flight-toggle" 
                  onClick={(e) => { e.stopPropagation(); setVisibility(key, !meta.visible); }}
                  title={meta.visible ? 'Hide flight' : 'Show flight'}
                >
                  {meta.visible ? '👁' : '👁‍🗨'}
                </button>
              </div>
            );
          })}
          {matchingFlights.length > 50 && (
            <div className="filter-more">+{matchingFlights.length - 50} more</div>
          )}
        </div>
      </div>
      </>
      )}
      
      {/* Route Tab */}
      {filterTab === 'route' && (
        <>
        {/* Flight Type Filter */}
        <div className="filter-section">
          <label>Flight Type</label>
          <div className="flight-type-buttons">
            <button 
              className={`flight-type-btn ${flightTypeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setFlightTypeFilter('all')}
            >
              All
            </button>
            <button 
              className={`flight-type-btn ${flightTypeFilter === 'inbound' ? 'active' : ''}`}
              onClick={() => setFlightTypeFilter('inbound')}
              title="Destination in Thailand, Departure outside"
            >
              🛬 Inbound
            </button>
            <button 
              className={`flight-type-btn ${flightTypeFilter === 'outbound' ? 'active' : ''}`}
              onClick={() => setFlightTypeFilter('outbound')}
              title="Departure in Thailand, Destination outside"
            >
              🛫 Outbound
            </button>
            <button 
              className={`flight-type-btn ${flightTypeFilter === 'domestic' ? 'active' : ''}`}
              onClick={() => setFlightTypeFilter('domestic')}
              title="Both Departure and Destination in Thailand"
            >
              🏠 Domestic
            </button>
            <button 
              className={`flight-type-btn ${flightTypeFilter === 'overfly' ? 'active' : ''}`}
              onClick={() => setFlightTypeFilter('overfly')}
              title="Neither Departure nor Destination in Thailand"
            >
              ✈️ Overfly
            </button>
          </div>
        </div>
        
        <div className="filter-section">
          <label>Route</label>
          <div className="filter-row-double">
            <div className="combobox" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                placeholder="DEP"
                value={filter.dep}
                onChange={(e) => setFilter({ dep: e.target.value.toUpperCase() })}
                onFocus={() => setDepOpen(true)}
              />
              <button className="dropdown-btn" onClick={() => setDepOpen(!depOpen)}>▼</button>
              {depOpen && (
                <div className="dropdown-list">
                  {dropdownOptions.deps
                    .filter(([dep]) => dep.toUpperCase().includes(filter.dep.toUpperCase()))
                    .slice(0, 50)
                    .map(([dep, count]) => (
                      <div key={dep} className="dropdown-item" onClick={() => { setFilter({ dep }); setDepOpen(false); }}>
                        <span className="dropdown-value">{dep}</span>
                        <span className="dropdown-count">{count}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
            <span className="arrow">→</span>
            <div className="combobox" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                placeholder="DEST"
                value={filter.dest}
                onChange={(e) => setFilter({ dest: e.target.value.toUpperCase() })}
                onFocus={() => setDestOpen(true)}
              />
              <button className="dropdown-btn" onClick={() => setDestOpen(!destOpen)}>▼</button>
              {destOpen && (
                <div className="dropdown-list">
                  {dropdownOptions.dests
                    .filter(([dest]) => dest.toUpperCase().includes(filter.dest.toUpperCase()))
                    .slice(0, 50)
                    .map(([dest, count]) => (
                      <div key={dest} className="dropdown-item" onClick={() => { setFilter({ dest }); setDestOpen(false); }}>
                        <span className="dropdown-value">{dest}</span>
                        <span className="dropdown-count">{count}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="filter-section airport-filter-section">
          <label>✈️ Airport Focus <span className="dep-color">■ DEP</span> <span className="dest-color">■ DEST</span></label>
          <div className="combobox" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              placeholder="Select airport..."
              value={airportFilterCode}
              onChange={(e) => setAirportFilterCode(e.target.value.toUpperCase())}
              onFocus={() => setAirportFilterOpen(true)}
            />
            <button className="dropdown-btn" onClick={() => setAirportFilterOpen(!airportFilterOpen)}>▼</button>
            {airportFilterCode && (
              <button className="clear-btn" onClick={() => setAirportFilterCode('')}>×</button>
            )}
            {airportFilterOpen && (
              <div className="dropdown-list">
                {airportOptions
                  .filter(([code]) => code.toUpperCase().includes(airportFilterCode.toUpperCase()))
                  .slice(0, 50)
                  .map(([code, count]) => (
                    <div key={code} className="dropdown-item" onClick={() => { setAirportFilterCode(code); setAirportFilterOpen(false); }}>
                      <span className="dropdown-value">{code}</span>
                      <span className="dropdown-count">{count}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
        </>
      )}
      
      {/* Airline Mode Tab */}
      {filterTab === 'airline' && (
        <>
        {/* Settings Section */}
        <div className="airline-settings-section">
          <label className="airline-toggle-row">
            <input
              type="checkbox"
              checked={airlineModeEnabled}
              onChange={(e) => setAirlineModeEnabled(e.target.checked)}
            />
            <span>Enable Airline Colors</span>
          </label>
        </div>
        
        {/* Search Section */}
        <div className="airline-search-section">
          <input
            type="text"
            placeholder="Search airlines..."
            value={airlineSearch}
            onChange={(e) => setAirlineSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filteredAirlines.length > 0) {
                const codes = filteredAirlines.map(([code]) => code);
                const allSelected = codes.every(c => selectedAirlines.includes(c));
                if (allSelected) {
                  setSelectedAirlines(selectedAirlines.filter(a => !codes.includes(a)));
                } else {
                  setSelectedAirlines([...new Set([...selectedAirlines, ...codes])]);
                }
              }
            }}
          />
        </div>
        
        {/* List Header with Actions */}
        <div className="airline-list-header">
          <span className="airline-count">
            {selectedAirlines.length > 0 
              ? `${selectedAirlines.length} of ${filteredAirlines.length} selected`
              : `${filteredAirlines.length} airlines`}
            {airlineSearch && ' (filtered)'}
          </span>
          <div className="airline-actions">
            <button 
              className="airline-action-btn"
              onClick={() => {
                const codes = filteredAirlines.map(([code]) => code);
                setSelectedAirlines([...new Set([...selectedAirlines, ...codes])]);
              }}
            >
              Select All
            </button>
            <button 
              className="airline-action-btn"
              onClick={() => {
                if (airlineSearch) {
                  const codes = filteredAirlines.map(([code]) => code);
                  setSelectedAirlines(selectedAirlines.filter(a => !codes.includes(a)));
                } else {
                  setSelectedAirlines([]);
                }
              }}
            >
              Clear
            </button>
          </div>
        </div>
        
        {/* Airline List */}
        <div className="airline-list">
          {filteredAirlines.map(([code, count]) => {
            const isSelected = selectedAirlines.includes(code);
            const color = airlineColors[code] || '#888';
            const airlineInfo = airlinesData[code];
            return (
              <div 
                key={code}
                className={`airline-item ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  if (isSelected) {
                    setSelectedAirlines(selectedAirlines.filter(a => a !== code));
                  } else {
                    setSelectedAirlines([...selectedAirlines, code]);
                  }
                }}
              >
                <div className="airline-color" style={{ background: color }} />
                <div className="airline-info">
                  <span className="airline-code">{code}</span>
                  <span className="airline-name">{airlineInfo?.name || 'Unknown'}</span>
                </div>
                <span className="airline-flight-count">{count}</span>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  className="airline-checkbox"
                />
              </div>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}

// ============== FL Legend ==============
function FLLegend() {
  const flTrailsVisible = useFlightStore(state => state.flTrailsVisible);
  const globalMinFL = useFlightStore(state => state.globalMinFL);
  const globalMaxFL = useFlightStore(state => state.globalMaxFL);
  
  return (
    <div id="fl-legend" className={flTrailsVisible ? 'visible' : ''}>
      <div className="legend-title">Flight Level</div>
      <div className="legend-bar" />
      <div className="legend-labels">
        <span id="fl-min">FL{Math.round(globalMinFL === Infinity ? 0 : globalMinFL)}</span>
        <span id="fl-max">FL{Math.round(globalMaxFL === -Infinity ? 500 : globalMaxFL)}</span>
      </div>
    </div>
  );
}

// ============== Flight Tooltip ==============
function FlightTooltip() {
  const lockedFlightKey = useFlightStore(state => state.lockedFlightKey);
  const flights = useFlightStore(state => state.flights);
  const flightMeta = useFlightStore(state => state.flightMeta);
  const currentTime = useFlightStore(state => state.timeline.current);
  const setLockedFlight = useFlightStore(state => state.setLockedFlight);
  
  const [hoverData, setHoverData] = useState<{
    visible: boolean;
    x: number;
    y: number;
    key: string;
  } | null>(null);

  // Register global tooltip functions
  const hideTimeoutRef = useRef<number | null>(null);
  
  useEffect(() => {
    let lastHoverKey: string | null = null;
    let lastHoverTime = 0;
    
    (window as any).showFlightTooltip = (data: { x: number; y: number; key: string }) => {
      if (useFlightStore.getState().lockedFlightKey) return;
      // Clear any pending hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      lastHoverKey = data.key;
      lastHoverTime = Date.now();
      setHoverData({ visible: true, ...data });
    };
    (window as any).moveFlightTooltip = (data: { x: number; y: number }) => {
      if (useFlightStore.getState().lockedFlightKey) return;
      // Clear any pending hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      lastHoverTime = Date.now();
      setHoverData(prev => prev ? { ...prev, ...data } : null);
    };
    (window as any).hideFlightTooltip = () => {
      if (useFlightStore.getState().lockedFlightKey) return;
      lastHoverKey = null;
      // Use a small timeout to prevent flickering when moving between flights
      hideTimeoutRef.current = window.setTimeout(() => {
        setHoverData(null);
        hideTimeoutRef.current = null;
      }, 50);
    };
    (window as any).focusOnFlight = (key: string, withZoom = false) => {
      useFlightStore.getState().focusFlight(key, withZoom);
    };
    
    // Safety check: hide tooltip if no hover activity for 500ms
    const safetyInterval = setInterval(() => {
      if (lastHoverKey && Date.now() - lastHoverTime > 500) {
        // Check if mouse is still over the marker element
        const markers = (window as any).flightMarkers;
        if (markers && markers[lastHoverKey]) {
          const el = markers[lastHoverKey].getElement?.();
          if (el && !el.matches(':hover')) {
            lastHoverKey = null;
            setHoverData(null);
          }
        }
      }
    }, 200);
    
    return () => clearInterval(safetyInterval);
  }, []);
  
  // Get current flight data
  const rawKey = lockedFlightKey || hoverData?.key;
  
  // Shorten flight key for display
  const displayKey = rawKey ? rawKey.length > 12 ? rawKey.substring(0, 12) + '...' : rawKey : '';
  const points = rawKey ? flights[rawKey] : null;
  const meta = rawKey ? flightMeta[rawKey] : null;
  
  // Interpolate current position for locked flight
  const currentPos = useMemo(() => {
    if (!points || points.length === 0) return null;
    const time = currentTime;
    
    if (time <= points[0].t) return points[0];
    if (time >= points[points.length - 1].t) return points[points.length - 1];
    
    for (let i = 0; i < points.length - 1; i++) {
      if (time >= points[i].t && time <= points[i + 1].t) {
        const ratio = (time - points[i].t) / (points[i + 1].t - points[i].t);
        // For rateCD and vert, use the non-zero value from either point (prefer non-zero)
        let rateCD = points[i].rateCD;
        if (rateCD === 0 || rateCD == null) {
          rateCD = points[i + 1].rateCD;
        }
        let vert = points[i].vert;
        if (vert === 0 || vert == null) {
          vert = points[i + 1].vert;
        }
        return {
          lat: points[i].lat + (points[i + 1].lat - points[i].lat) * ratio,
          lon: points[i].lon + (points[i + 1].lon - points[i].lon) * ratio,
          fl: points[i].fl,
          acid: points[i].acid,
          ias: points[i].ias,
          magHeading: points[i].magHeading,
          rateCD,
          vert,
        };
      }
    }
    return points[0];
  }, [points, currentTime]);
  
  // Get position for locked tooltip
  const lockedPos = useMemo(() => {
    if (!lockedFlightKey || !currentPos) return null;
    const map = (window as any).mapInstance;
    if (!map) return null;
    
    try {
      const containerPos = map.latLngToContainerPoint([currentPos.lat, currentPos.lon]);
      const mapContainer = map.getContainer().getBoundingClientRect();
      
      let x = mapContainer.left + containerPos.x + 25;
      let y = mapContainer.top + containerPos.y - 10;
      
      const maxX = window.innerWidth - 180;
      const maxY = window.innerHeight - 200;
      return { x: Math.max(10, Math.min(x, maxX)), y: Math.max(10, Math.min(y, maxY)) };
    } catch {
      return null;
    }
  }, [lockedFlightKey, currentPos]);
  
  // Clear hover when unlocking
  useEffect(() => {
    if (!lockedFlightKey) {
      setHoverData(null);
    }
  }, [lockedFlightKey]);
  
  const isVisible = lockedFlightKey ? !!lockedPos : hoverData?.visible;
  const position = lockedFlightKey ? lockedPos : hoverData;
  
  if (!isVisible || !displayKey || !position) return null;

  return (
    <div 
      id="flight-tooltip" 
      className={`visible ${lockedFlightKey ? 'locked' : ''}`} 
      style={{ left: position.x, top: position.y }}
      onClick={() => lockedFlightKey && setLockedFlight(null)}
    >
      <div className="tooltip-title" id="tooltip-title">
        {displayKey}
        {lockedFlightKey && <span style={{ marginLeft: 8, fontSize: 10, color: '#888' }}>🔒 click to unlock</span>}
      </div>
      <div className="tooltip-row"><span className="tooltip-label">ACID</span><span className="tooltip-value">{currentPos?.acid || '--'}</span></div>
      <div className="tooltip-row"><span className="tooltip-label">Type</span><span className="tooltip-value">{meta?.actype || '--'}</span></div>
      <div className="tooltip-row"><span className="tooltip-label">Route</span><span className="tooltip-value">{meta?.dep || '--'} → {meta?.dest || '--'}</span></div>
      <div className="tooltip-row"><span className="tooltip-label">FL</span><span className="tooltip-value">{currentPos?.fl ? `FL${Math.round(currentPos.fl)}` : '--'}{currentPos?.vert === 1 ? ' ↑' : currentPos?.vert === 2 ? ' ↓' : ' →'}</span></div>
      <div className="tooltip-row"><span className="tooltip-label">IAS</span><span className="tooltip-value">{currentPos?.ias != null ? `${Math.round(currentPos.ias)} kt` : '--'}</span></div>
      <div className="tooltip-row"><span className="tooltip-label">HDG</span><span className="tooltip-value">{currentPos?.magHeading != null ? `${Math.round(currentPos.magHeading)}°` : '--'}</span></div>
    </div>
  );
}

// ============== Map Components ==============
const CONFIG = {
  basemap: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  attribution: '&copy; OSM &copy; CARTO',
  polylineOpacity: 0.4,
  polylineWeight: 1.5,
  flPolylineWeight: 1.2,  // 40% thinner (was 2)
  flPolylineOpacity: 0.42, // 40% less opacity (was 0.7)
  planeSize: 20,
};

function createPlaneIcon(color: string, size = CONFIG.planeSize, lightMode = false) {
  const strokeColor = lightMode ? '#888' : '#000';
  const strokeWidth = lightMode ? '0.3' : '0.5';
  // Centered plane icon - adjusted viewBox to center the plane shape properly
  const svg = `<svg width="${size}" height="${size}" viewBox="-1 0 26 24" xmlns="http://www.w3.org/2000/svg" style="will-change: transform;">
    <path d="M12 2c-.55 0-1 .45-1 1v6L3 13v2l8-2v5l-2 1.5V21l3-1 3 1v-1.5L13 18v-5l8 2v-2l-8-4V3c0-.55-.45-1-1-1z" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
  </svg>`;
  return L.divIcon({
    html: `<div style="transform-origin: center center; will-change: transform; backface-visibility: hidden; -webkit-backface-visibility: hidden;">${svg}</div>`,
    className: 'plane-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function interpolatePosition(points: { t: number; lat: number; lon: number; heading: number; fl: number | null; acid: string | null; ias: number | null; magHeading: number | null; rateCD: number | null; vert: number | null }[], time: number) {
  if (points.length === 0) return null;
  if (time <= points[0].t) return { ...points[0], visible: time >= points[0].t - 30000 };
  if (time >= points[points.length - 1].t) return { ...points[points.length - 1], visible: time <= points[points.length - 1].t + 30000 };
  
  for (let i = 0; i < points.length - 1; i++) {
    if (time >= points[i].t && time <= points[i + 1].t) {
      const ratio = (time - points[i].t) / (points[i + 1].t - points[i].t);
      // For rateCD and vert, use the non-zero value from either point (prefer non-zero)
      let rateCD = points[i].rateCD;
      if (rateCD === 0 || rateCD == null) {
        rateCD = points[i + 1].rateCD;
      }
      let vert = points[i].vert;
      if (vert === 0 || vert == null) {
        vert = points[i + 1].vert;
      }
      return {
        lat: points[i].lat + (points[i + 1].lat - points[i].lat) * ratio,
        lon: points[i].lon + (points[i + 1].lon - points[i].lon) * ratio,
        heading: points[i].heading,
        fl: points[i].fl,
        acid: points[i].acid,
        ias: points[i].ias,
        magHeading: points[i].magHeading,
        rateCD,
        vert,
        visible: true,
      };
    }
  }
  return null;
}

// Global map rotation state
let globalMapRotation = 0;
const mapRotationListeners: Set<(rotation: number) => void> = new Set();

function MapController() {
  const map = useMap();
  const flights = useFlightStore(state => state.flights);
  const lockedFlightKey = useFlightStore(state => state.lockedFlightKey);
  const currentTime = useFlightStore(state => state.timeline.current);
  const hasInitialized = useRef(false);
  const isRotating = useRef(false);
  const startX = useRef(0);
  const startRotation = useRef(0);
  
  // Map rotation with Shift+drag
  useEffect(() => {
    const container = map.getContainer();
    const mapPane = container.querySelector('.leaflet-map-pane') as HTMLElement;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        container.style.cursor = 'grab';
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        container.style.cursor = '';
        if (isRotating.current) {
          isRotating.current = false;
          container.style.cursor = '';
        }
      }
    };
    
    const handleMouseDown = (e: MouseEvent) => {
      if (e.shiftKey && e.button === 0) {
        e.preventDefault();
        e.stopPropagation();
        isRotating.current = true;
        startX.current = e.clientX;
        startRotation.current = globalMapRotation;
        container.style.cursor = 'grabbing';
        map.dragging.disable();
      }
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (isRotating.current) {
        e.preventDefault();
        const deltaX = e.clientX - startX.current;
        const newRotation = startRotation.current + deltaX * 0.5;
        globalMapRotation = newRotation;
        
        if (mapPane) {
          mapPane.style.transform = `rotate(${newRotation}deg)`;
          mapPane.style.transformOrigin = 'center center';
        }
        
        // Notify listeners (plane icons)
        mapRotationListeners.forEach(listener => listener(newRotation));
      }
    };
    
    const handleMouseUp = () => {
      if (isRotating.current) {
        isRotating.current = false;
        container.style.cursor = '';
        map.dragging.enable();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    container.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      container.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [map]);
  
  // Register global map focus function
  useEffect(() => {
    (window as any).focusMapOnFlight = (lat: number, lon: number) => {
      map.setView([lat, lon], 10, { animate: true, duration: 0.5 });
    };
    (window as any).mapInstance = map;
    return () => {
      delete (window as any).focusMapOnFlight;
      delete (window as any).mapInstance;
    };
  }, [map]);
  
  // Follow locked flight smoothly
  useEffect(() => {
    if (!lockedFlightKey) return;
    
    const points = flights[lockedFlightKey];
    if (!points || points.length === 0) return;
    
    const pos = interpolatePosition(points, currentTime);
    if (pos && pos.visible) {
      map.panTo([pos.lat, pos.lon], { animate: true, duration: 0.3 });
    }
  }, [map, lockedFlightKey, currentTime, flights]);
  
  useEffect(() => {
    if (hasInitialized.current) return;
    const keys = Object.keys(flights);
    if (keys.length === 0) return;
    
    const bounds: [number, number][] = [];
    keys.forEach(key => {
      const pts = flights[key];
      if (pts.length > 0) {
        bounds.push([pts[0].lat, pts[0].lon]);
        if (pts.length > 1) bounds.push([pts[pts.length - 1].lat, pts[pts.length - 1].lon]);
      }
    });
    
    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] });
      hasInitialized.current = true;
    }
  }, [map, flights]);
  
  return null;
}

// Optimized flight renderer - single component manages all markers with throttled updates
function FlightRenderer() {
  const map = useMap();
  const markersRef = useRef<Record<string, L.Marker>>({});
  const polylinesRef = useRef<Record<string, L.Polyline>>({});
  const flSegmentsRef = useRef<Record<string, L.Polyline[]>>({});  // Lazy-created segments per flight
  const flVisibleRangeRef = useRef<Record<string, { start: number; end: number }>>({});  // Track visible range
  const lastMarkerUpdateRef = useRef(0);
  const lastTrailUpdateRef = useRef(0);
  const endIdxCacheRef = useRef<Record<string, number>>({});
  
  const flights = useFlightStore(state => state.flights);
  const flightMeta = useFlightStore(state => state.flightMeta);
  const trailsVisible = useFlightStore(state => state.trailsVisible);
  const flTrailsVisible = useFlightStore(state => state.flTrailsVisible);
  const globalMinFL = useFlightStore(state => state.globalMinFL);
  const globalMaxFL = useFlightStore(state => state.globalMaxFL);
  const lightMode = useFlightStore(state => state.lightMode);
  
  // Initialize markers once - chunked to avoid blocking
  useEffect(() => {
    const keys = Object.keys(flights);
    let idx = 0;
    const CHUNK = 50;
    
    const initChunk = () => {
      const end = Math.min(idx + CHUNK, keys.length);
      for (; idx < end; idx++) {
        const key = keys[idx];
        const points = flights[key];
        const meta = flightMeta[key];
        if (!points?.length || !meta || markersRef.current[key]) continue;
        
        const marker = L.marker([points[0].lat, points[0].lon], { icon: createPlaneIcon(meta.color) });
        
        marker.on('mouseover', (e) => {
          (window as any).showFlightTooltip?.({ x: e.originalEvent.clientX + 15, y: e.originalEvent.clientY + 15, key });
        });
        marker.on('mousemove', (e) => {
          (window as any).moveFlightTooltip?.({ x: e.originalEvent.clientX + 15, y: e.originalEvent.clientY + 15 });
        });
        marker.on('mouseout', () => (window as any).hideFlightTooltip?.());
        marker.on('click', (e) => (window as any).focusOnFlight?.(key, e.originalEvent.shiftKey));
        
        markersRef.current[key] = marker;
        if (!(window as any).flightMarkers) (window as any).flightMarkers = {};
        (window as any).flightMarkers[key] = marker;
      }
      if (idx < keys.length) setTimeout(initChunk, 0);
    };
    initChunk();
    
    return () => {
      Object.values(markersRef.current).forEach(m => { try { map.removeLayer(m); } catch {} });
      Object.values(polylinesRef.current).forEach(p => { try { map.removeLayer(p); } catch {} });
      Object.values(flSegmentsRef.current).forEach(segs => segs.forEach(s => { try { map.removeLayer(s); } catch {} }));
    };
  }, [map, flights, flightMeta]);
  
  // Track last icon color per marker to avoid unnecessary updates
  const lastIconColorRef = useRef<Record<string, string>>({});
  
  // Single animation loop for markers - configurable fps (default 60fps, can increase for smoother animation)
  useEffect(() => {
    let animationId: number;
    const MARKER_UPDATE_INTERVAL = 8; // ~120fps for smoother marker movement (was 16 for 60fps)
    
    const update = () => {
      const now = performance.now();
      if (now - lastMarkerUpdateRef.current >= MARKER_UPDATE_INTERVAL) {
        lastMarkerUpdateRef.current = now;
        
        const currentTime = useFlightStore.getState().timeline.current;
        const meta = useFlightStore.getState().flightMeta;
        const flTrailsOn = useFlightStore.getState().flTrailsVisible;
        const minFL = useFlightStore.getState().globalMinFL;
        const maxFL = useFlightStore.getState().globalMaxFL;
        const airportFilter = useFlightStore.getState().airportFilterCode;
        
        for (const key in flights) {
          const marker = markersRef.current[key];
          const fm = meta[key];
          if (!marker || !fm) continue;
          
          // When airport filter is active, only show flights matching DEP or DEST
          if (airportFilter) {
            const matchesDep = fm.dep?.toUpperCase() === airportFilter.toUpperCase();
            const matchesDest = fm.dest?.toUpperCase() === airportFilter.toUpperCase();
            if (!matchesDep && !matchesDest) {
              if (map.hasLayer(marker)) map.removeLayer(marker);
              continue;
            }
          }
          
          if (!fm.visible) {
            if (map.hasLayer(marker)) map.removeLayer(marker);
            continue;
          }
          
          const points = flights[key];
          const pos = interpolatePosition(points, currentTime);
          if (pos && pos.visible) {
            marker.setLatLng([pos.lat, pos.lon]);
            
            // Determine icon color - priority: airport filter > airline mode > FL trails > default
            let iconColor = fm.color;
            const airlineModeOn = useFlightStore.getState().airlineModeEnabled;
            const airlineColorsMap = useFlightStore.getState().airlineColors;
            const selectedAirlinesList = useFlightStore.getState().selectedAirlines;
            
            if (airportFilter) {
              const matchesDep = fm.dep?.toUpperCase() === airportFilter.toUpperCase();
              const matchesDest = fm.dest?.toUpperCase() === airportFilter.toUpperCase();
              if (matchesDep) iconColor = '#0088ff'; // Blue for departing
              else if (matchesDest) iconColor = '#ffcc00'; // Yellow for arriving
            } else if (airlineModeOn) {
              // Airline mode - color by airline code (first 3 chars of flight key)
              const airlineCode = key.substring(0, 3).toUpperCase();
              if (airlineColorsMap[airlineCode]) {
                iconColor = airlineColorsMap[airlineCode];
              }
              // If airlines are selected, hide flights not in selection
              if (selectedAirlinesList.length > 0 && !selectedAirlinesList.includes(airlineCode)) {
                if (map.hasLayer(marker)) map.removeLayer(marker);
                continue;
              }
            } else if (flTrailsOn && pos.fl !== null) {
              const flColor = flToColor(pos.fl, minFL, maxFL, useFlightStore.getState().lightMode);
              if (flColor) iconColor = flColor;
            }
            
            // Update icon if color changed
            if (lastIconColorRef.current[key] !== iconColor) {
              marker.setIcon(createPlaneIcon(iconColor, CONFIG.planeSize, useFlightStore.getState().lightMode));
              lastIconColorRef.current[key] = iconColor;
            }
            
            const iconEl = marker.getElement();
            if (iconEl) {
              const inner = iconEl.firstChild as HTMLElement;
              // Counter-rotate against map rotation to keep plane heading fixed relative to screen
              if (inner) inner.style.transform = `rotate(${pos.heading - globalMapRotation}deg)`;
            }
            if (!map.hasLayer(marker)) marker.addTo(map);
          } else {
            if (map.hasLayer(marker)) map.removeLayer(marker);
          }
        }
      }
      animationId = requestAnimationFrame(update);
    };
    
    animationId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationId);
  }, [map, flights]);
  
  // Pre-compute full trail coords (only once per flight)
  const fullCoordsRef = useRef<Record<string, [number, number][]>>({});
  const trailsInitializedRef = useRef(false);
  
  // Initialize full coords cache
  useEffect(() => {
    if (trailsInitializedRef.current) return;
    const keys = Object.keys(flights);
    if (keys.length === 0) return;
    
    for (const key of keys) {
      const points = flights[key];
      fullCoordsRef.current[key] = points.map(pt => [pt.lat, pt.lon] as [number, number]);
    }
    trailsInitializedRef.current = true;
  }, [flights]);
  
  // Trail update loop - throttled (configurable for performance vs smoothness)
  useEffect(() => {
    let animationId: number;
    const TRAIL_UPDATE_INTERVAL = 50; // ~20fps for smoother trails (was 100 for 10fps)
    
    const updateTrails = () => {
      const now = performance.now();
      if (now - lastTrailUpdateRef.current >= TRAIL_UPDATE_INTERVAL) { // 20fps for trails
        lastTrailUpdateRef.current = now;
        
        const currentTime = useFlightStore.getState().timeline.current;
        const meta = useFlightStore.getState().flightMeta;
        const showFull = useFlightStore.getState().showFullTrails;
        const trails = useFlightStore.getState().trailsVisible;
        const flTrails = useFlightStore.getState().flTrailsVisible;
        const decayMinutes = useFlightStore.getState().trailDecayMinutes;
        const decayMs = decayMinutes * 60 * 1000; // Convert to milliseconds
        const airportFilter = useFlightStore.getState().airportFilterCode;
        
        for (const key in flights) {
          const fm = meta[key];
          const points = flights[key];
          
          // When airport filter is active, filter flights and show trails with override colors
          if (airportFilter) {
            const matchesDep = fm?.dep?.toUpperCase() === airportFilter.toUpperCase();
            const matchesDest = fm?.dest?.toUpperCase() === airportFilter.toUpperCase();
            if (!matchesDep && !matchesDest) {
              // Hide trails for non-matching flights
              const p = polylinesRef.current[key];
              if (p && map.hasLayer(p)) map.removeLayer(p);
              const segs = flSegmentsRef.current[key];
              if (segs) segs.forEach(s => { if (map.hasLayer(s)) map.removeLayer(s); });
              continue;
            }
          }
          
          // If flight is hidden by user (filter), remove trails
          if (!fm?.visible) {
            const p = polylinesRef.current[key];
            if (p && map.hasLayer(p)) map.removeLayer(p);
            const segs = flSegmentsRef.current[key];
            if (segs) segs.forEach(s => { if (map.hasLayer(s)) map.removeLayer(s); });
            continue;
          }
          
          // Find index up to current time (with caching)
          let endIdx = endIdxCacheRef.current[key] || 0;
          while (endIdx < points.length - 1 && points[endIdx + 1].t <= currentTime) endIdx++;
          while (endIdx > 0 && points[endIdx].t > currentTime) endIdx--;
          endIdxCacheRef.current[key] = endIdx;
          
          // Find start index for decay (only show trail from decayMs ago)
          let startIdx = 0;
          if (!showFull && decayMs > 0) {
            const decayStartTime = currentTime - decayMs;
            // Find first point that is within decay window
            startIdx = 0;
            while (startIdx < points.length && points[startIdx].t < decayStartTime) startIdx++;
          }
          
          // Check if trail has fully decayed (startIdx > endIdx means no visible trail)
          const trailFullyDecayed = !showFull && decayMs > 0 && startIdx > endIdx;
          
          // Determine trail color - airport filter overrides
          let trailColor = fm.color;
          if (airportFilter) {
            const matchesDep = fm.dep?.toUpperCase() === airportFilter.toUpperCase();
            const matchesDest = fm.dest?.toUpperCase() === airportFilter.toUpperCase();
            if (matchesDep) trailColor = '#0088ff'; // Blue for departing
            else if (matchesDest) trailColor = '#ffcc00'; // Yellow for arriving
          }
          
          // Normal trails (or airport filter trails)
          if (trails || airportFilter) {
            // If trail fully decayed, remove it
            if (trailFullyDecayed) {
              const p = polylinesRef.current[key];
              if (p && map.hasLayer(p)) map.removeLayer(p);
            } else {
              if (!polylinesRef.current[key]) {
                polylinesRef.current[key] = L.polyline([], {
                  color: trailColor, weight: CONFIG.polylineWeight, opacity: CONFIG.polylineOpacity
                });
              }
              const p = polylinesRef.current[key];
              // Update trail color if airport filter is active
              if (airportFilter) {
                p.setStyle({ color: trailColor });
              }
              
              // Always update when decaying (startIdx changes even when endIdx doesn't)
              if (showFull) {
                // Use cached full coords
                p.setLatLngs(fullCoordsRef.current[key] || []);
              } else {
                // Partial trail with decay - only show from startIdx to endIdx
                const coords: [number, number][] = [];
                for (let i = startIdx; i <= endIdx; i++) {
                  coords.push([points[i].lat, points[i].lon]);
                }
                p.setLatLngs(coords);
              }
              if (!map.hasLayer(p)) p.addTo(map);
            }
          } else {
            const p = polylinesRef.current[key];
            if (p && map.hasLayer(p)) map.removeLayer(p);
          }
          
          // FL trails - per-segment colors (optimized: lazy create, only update changed)
          if (flTrails) {
            // Lazy initialize segments array
            if (!flSegmentsRef.current[key]) {
              flSegmentsRef.current[key] = new Array(points.length - 1);
              flVisibleRangeRef.current[key] = { start: -1, end: -1 };
            }
            const segs = flSegmentsRef.current[key];
            if (segs && segs.length > 0) {
              const newStart = trailFullyDecayed ? -1 : (showFull ? 0 : startIdx);
              const newEnd = trailFullyDecayed ? -1 : (showFull ? segs.length : Math.min(endIdx, segs.length));
              const prev = flVisibleRangeRef.current[key] || { start: -1, end: -1 };
              
              // Only update if range changed
              if (prev.start !== newStart || prev.end !== newEnd) {
                // Hide segments no longer in range
                if (prev.start >= 0) {
                  for (let i = prev.start; i < prev.end; i++) {
                    if ((i < newStart || i >= newEnd) && segs[i] && map.hasLayer(segs[i])) {
                      map.removeLayer(segs[i]);
                    }
                  }
                }
                // Create & show new segments in range
                if (newStart >= 0) {
                  for (let i = newStart; i < newEnd; i++) {
                    if (!segs[i]) {
                      const p1 = points[i], p2 = points[i + 1];
                      const fl = p1.fl ?? p2.fl;
                      const color = fl !== null ? (flToColor(fl, globalMinFL, globalMaxFL, useFlightStore.getState().lightMode) || '#00ff00') : '#00ff00';
                      segs[i] = L.polyline([[p1.lat, p1.lon], [p2.lat, p2.lon]], {
                        color, weight: CONFIG.flPolylineWeight, opacity: CONFIG.flPolylineOpacity
                      });
                    }
                    if (!map.hasLayer(segs[i])) segs[i].addTo(map);
                  }
                }
                flVisibleRangeRef.current[key] = { start: newStart, end: newEnd };
              }
            }
          } else {
            // Hide all and reset range
            const segs = flSegmentsRef.current[key];
            const prev = flVisibleRangeRef.current[key];
            if (segs && prev && prev.start >= 0) {
              for (let i = prev.start; i < prev.end; i++) {
                if (segs[i] && map.hasLayer(segs[i])) map.removeLayer(segs[i]);
              }
              flVisibleRangeRef.current[key] = { start: -1, end: -1 };
            }
          }
        }
      }
      animationId = requestAnimationFrame(updateTrails);
    };
    
    animationId = requestAnimationFrame(updateTrails);
    return () => cancelAnimationFrame(animationId);
  }, [map, flights, trailsVisible, flTrailsVisible, globalMinFL, globalMaxFL]);
  
  // Cleanup trails when disabled
  useEffect(() => {
    if (!trailsVisible) {
      Object.values(polylinesRef.current).forEach(p => { try { if (map.hasLayer(p)) map.removeLayer(p); } catch {} });
    }
  }, [map, trailsVisible]);
  
  // Clear FL trail segments when lightMode changes (to regenerate with new colors)
  useEffect(() => {
    Object.values(flSegmentsRef.current).forEach(segs => segs.forEach(s => { try { if (map.hasLayer(s)) map.removeLayer(s); } catch {} }));
    // Clear the cache so segments get recreated with new colors
    Object.keys(flSegmentsRef.current).forEach(key => {
      flSegmentsRef.current[key] = new Array(flSegmentsRef.current[key].length);
      flVisibleRangeRef.current[key] = { start: -1, end: -1 };
    });
    // Force icon color cache reset so icons get updated with new stroke color
    lastIconColorRef.current = {};
  }, [map, lightMode]);
  
  useEffect(() => {
    if (!flTrailsVisible) {
      Object.values(flSegmentsRef.current).forEach(segs => segs.forEach(s => { try { if (map.hasLayer(s)) map.removeLayer(s); } catch {} }));
    }
  }, [map, flTrailsVisible]);
  
  return null;
}

// ============== Runway Layer ==============
// Helper to calculate runway rectangle polygon from two threshold positions
function calculateRunwayPolygon(lat1: number, lon1: number, lat2: number, lon2: number, widthFt: number): [number, number][] {
  const widthM = widthFt * 0.3048;
  const midLat = (lat1 + lat2) / 2;
  
  // Approximate conversion
  const latPerMeter = 1 / 111320;
  const lonPerMeter = 1 / (111320 * Math.cos(midLat * Math.PI / 180));
  
  // Calculate bearing from threshold 1 to threshold 2
  const dLon = lon2 - lon1;
  const dLat = lat2 - lat1;
  const bearing = Math.atan2(dLon / lonPerMeter, dLat / latPerMeter);
  const perpRad = bearing + Math.PI / 2;
  
  // Half width offsets perpendicular to runway
  const wx = Math.sin(perpRad) * (widthM / 2) * lonPerMeter;
  const wy = Math.cos(perpRad) * (widthM / 2) * latPerMeter;
  
  // 4 corners: threshold1-left, threshold1-right, threshold2-right, threshold2-left
  return [
    [lat1 - wy, lon1 - wx],
    [lat1 + wy, lon1 + wx],
    [lat2 + wy, lon2 + wx],
    [lat2 - wy, lon2 - wx],
  ];
}

function RunwayLayer() {
  const map = useMap();
  const runways = useAirportStore(state => state.runways);
  const runwaysVisible = useAirportStore(state => state.runwaysVisible);
  const polygonsRef = useRef<L.Polygon[]>([]);
  
  useEffect(() => {
    // Clear existing polygons
    polygonsRef.current.forEach(p => { try { map.removeLayer(p); } catch {} });
    polygonsRef.current = [];
    
    if (!runwaysVisible || runways.length === 0) return;
    
    // Create runway polygons
    runways.forEach(runway => {
      const coords = calculateRunwayPolygon(
        runway.lat1,
        runway.lon1,
        runway.lat2,
        runway.lon2,
        runway.width
      );
      
      // Create custom pane for runways if not exists (below planes)
      if (!map.getPane('runwayPane')) {
        map.createPane('runwayPane');
        const pane = map.getPane('runwayPane');
        if (pane) pane.style.zIndex = '300'; // Below overlayPane (400) and markerPane (600)
      }
      
      const polygon = L.polygon(coords, {
        color: '#666666',
        fillColor: '#ffffff',
        fillOpacity: 0.3,
        weight: 1,
        pane: 'runwayPane'
      });
      
      polygon.bindTooltip(`${runway.airport_identifier} - ${runway.runway_identifier}`, {
        permanent: false,
        direction: 'top'
      });
      
      polygon.addTo(map);
      polygonsRef.current.push(polygon);
    });
    
    return () => {
      polygonsRef.current.forEach(p => { try { map.removeLayer(p); } catch {} });
      polygonsRef.current = [];
    };
  }, [map, runways, runwaysVisible]);
  
  return null;
}

// ============== Airport Layer ==============
function AirportLayer() {
  const map = useMap();
  const airports = useAirportStore(state => state.airports);
  const setSelectedAirport = useAirportStore(state => state.setSelectedAirport);
  const markersRef = useRef<Record<number, L.Marker>>({});
  const [hoveredAirport, setHoveredAirport] = useState<Airport | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  
  // Create divIcon for stable rendering (no flashing on zoom)
  const createAirportIcon = useCallback((isMain: boolean) => {
    const size = isMain ? 28 : 20;
    const imgSrc = isMain ? '/assets/Main-Air.png' : '/assets/Sub-Air.png';
    const typeClass = isMain ? 'airport-main' : 'airport-sub';
    return L.divIcon({
      className: `airport-marker-wrapper ${typeClass}`,
      html: `<img src="${imgSrc}" class="airport-marker-img" style="width:${size}px;height:${size}px;" />`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  }, []);
  
  // Initialize markers once
  useEffect(() => {
    airports.forEach(airport => {
      if (markersRef.current[airport.fid]) return;
      
      const icon = createAirportIcon(airport.Main === 'Y');
      const marker = L.marker([airport.airport_ref_latitude, airport.airport_ref_longitude], { 
        icon,
        interactive: true
      });
      
      marker.on('mouseover', (e) => {
        const el = marker.getElement();
        if (el) el.classList.add('hovered');
        setHoveredAirport(airport);
        setTooltipPos({ x: e.originalEvent.clientX, y: e.originalEvent.clientY });
      });
      
      marker.on('mouseout', () => {
        const el = marker.getElement();
        if (el) el.classList.remove('hovered');
        setHoveredAirport(null);
        setTooltipPos(null);
      });
      
      marker.on('click', () => {
        setSelectedAirport(airport);
      });
      
      markersRef.current[airport.fid] = marker;
    });
    
    return () => {
      Object.values(markersRef.current).forEach(m => { try { map.removeLayer(m); } catch {} });
      markersRef.current = {};
    };
  }, [map, airports, createAirportIcon, setSelectedAirport]);
  
  // Update visibility
  useEffect(() => {
    airports.forEach(airport => {
      const marker = markersRef.current[airport.fid];
      if (!marker) return;
      
      if (airport.visible) {
        if (!map.hasLayer(marker)) marker.addTo(map);
      } else {
        if (map.hasLayer(marker)) map.removeLayer(marker);
      }
    });
  }, [map, airports]);
  
  // Airport tooltip
  if (hoveredAirport && tooltipPos) {
    return (
      <div 
        className="airport-tooltip"
        style={{ 
          position: 'fixed',
          left: tooltipPos.x + 15,
          top: tooltipPos.y - 40,
          zIndex: 2000
        }}
      >
        <div className="airport-tooltip-name">{hoveredAirport.AP || hoveredAirport.airport_name}</div>
        <div className="airport-tooltip-code">{hoveredAirport.airport_identifier}</div>
      </div>
    );
  }
  
  return null;
}

function FlightMap({ lightMode, satelliteMode }: { lightMode: boolean; satelliteMode: boolean }) {
  return (
    <MapContainer 
      id="map" 
      center={[13.7563, 100.5018]} 
      zoom={6} 
      preferCanvas={true} 
      zoomControl={false}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <DynamicTileLayer lightMode={lightMode} satelliteMode={satelliteMode} />
      <MapController />
      <RunwayLayer />
      <FlightRenderer />
      <AirportLayer />
      <AirwayLayer />
      <SidLayer />
      <StarLayer />
      <PbnLayer />
      <IlsLayer />
      <GateLayer />
      <BACCLayer />
      <CTRLayer />
      <FIRLayer />
      <PDRLayer />
      <TMALayer />
      <FlightTagsLayer />
    </MapContainer>
  );
}

function DynamicTileLayer({ lightMode, satelliteMode }: { lightMode: boolean; satelliteMode: boolean }) {
  const map = useMap();
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  
  useEffect(() => {
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    
    let tileUrl: string;
    let attribution: string;
    
    if (satelliteMode) {
      // CartoDB Voyager with labels - simplified map with province/region names
      tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      attribution = '&copy; OpenStreetMap, &copy; CARTO';
    } else if (lightMode) {
      tileUrl = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
      attribution = CONFIG.attribution;
    } else {
      tileUrl = CONFIG.basemap;
      attribution = CONFIG.attribution;
    }
    
    tileLayerRef.current = L.tileLayer(tileUrl, { attribution, maxZoom: 20 });
    tileLayerRef.current.addTo(map);
    
    return () => {
      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current);
      }
    };
  }, [lightMode, satelliteMode, map]);
  
  return null;
}

// ============== Loading Overlay ==============
function LoadingOverlay({ text, progress }: { text: string | null; progress?: { stage: string; percent: number; rows: number; total: number } | null }) {
  if (!text && !progress) return null;
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(245, 247, 250, 0.95)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        padding: '32px 48px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
        border: '1px solid #e5e7eb',
        minWidth: '320px',
        textAlign: 'center',
      }}>
        {/* Spinner */}
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid #e5e7eb',
          borderTop: '4px solid #4f46e5',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 20px',
        }} />
        
        {/* Stage text */}
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
          {progress?.stage || text || 'Loading...'}
        </div>
        
        {/* Progress bar */}
        {progress && (
          <>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#e5e7eb',
              borderRadius: '4px',
              overflow: 'hidden',
              marginTop: '16px',
            }}>
              <div style={{
                height: '100%',
                width: `${progress.percent}%`,
                backgroundColor: '#4f46e5',
                borderRadius: '4px',
                transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '12px' }}>
              {progress.percent}%{progress.total > 0 ? ` • ${progress.rows.toLocaleString()} / ${progress.total.toLocaleString()} rows` : ''}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============== Main App ==============
function App() {
  const route = useHashRoute();
  
  // Route to DB Viewer
  if (route === '#/db-viewer') {
    return <DbViewer />;
  }
  
  // Route to Flight Feature Creator
  if (route === '#/flight-features') {
    return <FlightFeatureCreator />;
  }
  
  return <FlightApp />;
}

// ============== Flight App (Original App Logic) ==============
function FlightApp() {
  const [showApp, setShowApp] = useState(false);
  const [loadingText, setLoadingText] = useState<string | null>(null);
  const flightCount = Object.keys(useFlightStore(state => state.flights)).length;
  const lightMode = useFlightStore(state => state.lightMode);
  const satelliteMode = useFlightStore(state => state.satelliteMode);
  const setAirports = useAirportStore(state => state.setAirports);
  const setRunways = useAirportStore(state => state.setRunways);
  
  // Apply light mode class to body
  useEffect(() => {
    document.body.classList.toggle('light-mode', lightMode);
  }, [lightMode]);
  
  // Load airports and runways on mount
  useEffect(() => {
    loadAirports().then(airports => {
      setAirports(airports);
    }).catch(err => console.error('Failed to load airports:', err));
    
    loadRunways().then(runways => {
      setRunways(runways);
    }).catch(err => console.error('Failed to load runways:', err));
  }, [setAirports, setRunways]);
  
  useEffect(() => {
    if (flightCount > 0) setShowApp(true);
  }, [flightCount]);

  const [loadProgress, setLoadProgress] = useState<{ stage: string; percent: number; rows: number; total: number } | null>(null);

  if (!showApp) {
    return (
      <>
        <LoadingOverlay text={loadingText} progress={loadProgress} />
        <FilePicker onFileLoad={() => setShowApp(true)} setLoadingText={setLoadingText} setLoadProgress={setLoadProgress} />
      </>
    );
  }

  const handleBack = () => {
    setShowApp(false);
    window.location.hash = '#/';
  };

  return (
    <>
      {/* Back Button - slim triangle, respects light/dark mode */}
      <button
        onClick={handleBack}
        title="Change data source"
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          zIndex: 1001,
          width: '32px',
          height: '32px',
          padding: 0,
          backgroundColor: lightMode ? '#fff' : '#16213e',
          color: lightMode ? '#374151' : '#eee',
          border: lightMode ? '1px solid #d1d5db' : '1px solid #2d2d44',
          borderRadius: '6px',
          fontSize: '16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
        }}
      >
        ◀
      </button>
      <MainUIContainer />
      <FlightMap lightMode={lightMode} satelliteMode={satelliteMode} />
      <FlightPanel />
      <FilterPanel />
      <OptionsPanel />
      <FLLegend />
      <FlightTooltip />
      <AirportInfoPanel />
      <ThemeControls />
    </>
  );
}

// ============== Main UI Container (Toolbar + Timeline) ==============
function MainUIContainer() {
  const uiHidden = useFlightStore(state => state.uiHidden);
  
  return (
    <>
      <div id="main-ui-container" className={uiHidden ? 'hidden' : ''}>
        <Toolbar />
        <Timeline />
      </div>
      <CurtainRope />
    </>
  );
}

export default App;
