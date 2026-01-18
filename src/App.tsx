import { useRef, useState, useEffect, useCallback, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useFlightStore } from './store/flightStore';
import { useAirportStore, loadAirports, loadRunways, getRunwaySurfaceText } from './store/airportStore';
import type { Airport } from './store/airportStore';
import { parseCSV } from './utils/csvParser';
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
import 'leaflet/dist/leaflet.css';

// ============== File Picker ==============
function FilePicker({ onFileLoad, setLoadingText }: { onFileLoad: () => void; setLoadingText: (text: string | null) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setFlights = useFlightStore(state => state.setFlights);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLoadingText(`Loading ${file.name}...`);
    
    try {
      const result = await parseCSV(file, (loaded) => {
        setLoadingText(`Parsing... ${(loaded / 1000).toFixed(0)}k rows`);
      });
      
      setLoadingText(`Processing ${Object.keys(result.flights).length} flights...`);
      
      // Give UI time to update before heavy processing
      await new Promise(r => setTimeout(r, 50));
      
      setFlights(result.flights, result.flightMeta, result.stats);
      
      setLoadingText('Initializing map...');
      await new Promise(r => setTimeout(r, 50));
      
      setLoadingText(null);
      onFileLoad();
    } catch (error) {
      console.error('Error parsing CSV:', error);
      setLoadingText('Error loading file');
      setTimeout(() => setLoadingText(null), 2000);
      return;
    }
  };

  return (
    <div id="file-picker">
        <h1>✈️ Flight Animation Viewer</h1>
        <p>Select a CSV file with flight trajectory data</p>
        <label htmlFor="csv-input">Choose CSV File</label>
        <input 
          ref={fileInputRef}
          type="file" 
          id="csv-input" 
          accept=".csv"
          onChange={handleFileChange}
        />
        <div className="schema-hint">Required columns: flight_key, timestamp_utc, latitude, longitude</div>
        <button 
          className="testing-btn"
          onClick={() => {
            setLoadingText(null);
            onFileLoad();
          }}
        >
          🧪 Testing
        </button>
    </div>
  );
}

// ============== Trail Decay Control ==============
function TrailDecayControl() {
  const trailDecayMinutes = useFlightStore(state => state.trailDecayMinutes);
  const setTrailDecayMinutes = useFlightStore(state => state.setTrailDecayMinutes);
  const showFullTrails = useFlightStore(state => state.showFullTrails);
  
  // Don't show when full trails mode is on
  if (showFullTrails) return null;
  
  return (
    <div id="decay-control" title="Trail decay time (how long trails persist behind plane)">
      <span>Decay:</span>
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
  );
}

// ============== Toolbar ==============
function Toolbar() {
  const isPlaying = useFlightStore(state => state.isPlaying);
  const speedMultiplier = useFlightStore(state => state.speedMultiplier);
  const setSpeed = useFlightStore(state => state.setSpeed);
  const trailsVisible = useFlightStore(state => state.trailsVisible);
  const flTrailsVisible = useFlightStore(state => state.flTrailsVisible);
  const showFullTrails = useFlightStore(state => state.showFullTrails);
  const setTrailsVisible = useFlightStore(state => state.setTrailsVisible);
  const setFlTrailsVisible = useFlightStore(state => state.setFlTrailsVisible);
  const setShowFullTrails = useFlightStore(state => state.setShowFullTrails);
  const filterPanelOpen = useFlightStore(state => state.filterPanelOpen);
  const setFilterPanelOpen = useFlightStore(state => state.setFilterPanelOpen);
  const timeline = useFlightStore(state => state.timeline);
  const lightMode = useFlightStore(state => state.lightMode);
  const setLightMode = useFlightStore(state => state.setLightMode);
  const satelliteMode = useFlightStore(state => state.satelliteMode);
  const setSatelliteMode = useFlightStore(state => state.setSatelliteMode);
  const tagsVisible = useFlightStore(state => state.tagsVisible);
  const setTagsVisible = useFlightStore(state => state.setTagsVisible);
  const gatesVisible = useFlightStore(state => state.gatesVisible);
  const setGatesVisible = useFlightStore(state => state.setGatesVisible);
  
  const { play, pause, rewind } = useAnimation();
  
  const timeDisplay = useMemo(() => {
    const date = new Date(timeline.current);
    const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
    const timeStr = date.toISOString().slice(11, 19); // HH:MM:SS
    return `${dateStr} ${timeStr}`;
  }, [timeline.current]);

  return (
    <div id="toolbar">
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
        </select>
      </div>
      <button 
        id="btn-trails" 
        title="Toggle Flight Trails"
        className={trailsVisible ? 'active' : ''}
        onClick={() => setTrailsVisible(!trailsVisible)}
      >
        Trails
      </button>
      <button 
        id="btn-fl-trails" 
        title="Toggle Flight Level Trails"
        className={flTrailsVisible ? 'active' : ''}
        onClick={() => setFlTrailsVisible(!flTrailsVisible)}
      >
        FL Trails
      </button>
      <label id="show-all-label" title="Show full trails or only up to current time">
        <input 
          type="checkbox" 
          id="show-all-trails"
          checked={showFullTrails}
          onChange={(e) => setShowFullTrails(e.target.checked)}
        />
        <span>Full</span>
      </label>
      <TrailDecayControl />
      <SectorsDropdown />
      <AirwayDropdown />
      <SidDropdown />
      <StarDropdown />
      <PbnDropdown />
      <IlsDropdown />
      <button 
        id="btn-gates" 
        title="Toggle Airport Gates"
        className={gatesVisible ? 'active' : ''}
        onClick={() => setGatesVisible(!gatesVisible)}
      >
        🚪 Gates
      </button>
      <AirportDropdown />
      <button 
        id="btn-theme" 
        title="Toggle Light/Dark Mode"
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
      <button 
        id="btn-filter" 
        title="Filter Flights"
        className={filterPanelOpen ? 'active' : ''}
        onClick={() => setFilterPanelOpen(!filterPanelOpen)}
      >
        🔍 Filter
      </button>
      <button 
        id="btn-tags" 
        title="Toggle Flight Tags"
        className={tagsVisible ? 'active' : ''}
        onClick={() => setTagsVisible(!tagsVisible)}
      >
        🏷️ Tags
      </button>
      <div id="time-display">{timeDisplay}</div>
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

// ============== SID Dropdown ==============
function SidDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const sidVisible = useFlightStore(state => state.sidVisible);
  const setSidVisible = useFlightStore(state => state.setSidVisible);
  const sidWaypointsVisible = useFlightStore(state => state.sidWaypointsVisible);
  const setSidWaypointsVisible = useFlightStore(state => state.setSidWaypointsVisible);
  const sidOpacity = useFlightStore(state => state.sidOpacity);
  const setSidOpacity = useFlightStore(state => state.setSidOpacity);
  const sidLineWeight = useFlightStore(state => state.sidLineWeight);
  const setSidLineWeight = useFlightStore(state => state.setSidLineWeight);
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
      className="sid-dropdown"
      style={{ 
        position: 'fixed',
        top: dropdownPos.top,
        left: dropdownPos.left,
        zIndex: 999999
      }}
    >
      <div className="sid-option-row">
        <span 
          className="sid-option-label"
          onClick={() => setSidVisible(!sidVisible)}
        >
          SID Routes
        </span>
        <input 
          type="checkbox" 
          checked={sidVisible} 
          onChange={(e) => setSidVisible(e.target.checked)}
        />
      </div>
      <div className="sid-option-row">
        <span 
          className="sid-option-label"
          onClick={() => setSidWaypointsVisible(!sidWaypointsVisible)}
        >
          Waypoints
        </span>
        <input 
          type="checkbox" 
          checked={sidWaypointsVisible} 
          onChange={(e) => setSidWaypointsVisible(e.target.checked)}
        />
      </div>
      <div className="sid-option-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="sid-option-label">Opacity</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={sidOpacity}
            onChange={(e) => setSidOpacity(parseFloat(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: '11px', color: '#888', minWidth: '32px' }}>{(sidOpacity * 100).toFixed(0)}%</span>
        </div>
      </div>
      <div className="sid-option-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="sid-option-label">Line Thickness</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.5"
            value={sidLineWeight}
            onChange={(e) => setSidLineWeight(parseFloat(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: '11px', color: '#888', minWidth: '32px' }}>{sidLineWeight}px</span>
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      <button 
        ref={buttonRef}
        id="btn-sid" 
        title="SID Options"
        className={isOpen || sidVisible ? 'active' : ''}
        onClick={handleToggle}
      >
        🛫 SID
      </button>
      {dropdownContent}
    </>
  );
}

// ============== STAR Dropdown ==============
function StarDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const starVisible = useFlightStore(state => state.starVisible);
  const setStarVisible = useFlightStore(state => state.setStarVisible);
  const starWaypointsVisible = useFlightStore(state => state.starWaypointsVisible);
  const setStarWaypointsVisible = useFlightStore(state => state.setStarWaypointsVisible);
  const starOpacity = useFlightStore(state => state.starOpacity);
  const setStarOpacity = useFlightStore(state => state.setStarOpacity);
  const starLineWeight = useFlightStore(state => state.starLineWeight);
  const setStarLineWeight = useFlightStore(state => state.setStarLineWeight);
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
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  if (uiHidden) return null;

  const dropdownContent = isOpen && dropdownPos && createPortal(
    <div ref={dropdownRef} className="star-dropdown" style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, zIndex: 999999 }}>
      <div className="star-option-row">
        <span className="star-option-label" onClick={() => setStarVisible(!starVisible)}>STAR Routes</span>
        <input type="checkbox" checked={starVisible} onChange={(e) => setStarVisible(e.target.checked)} />
      </div>
      <div className="star-option-row">
        <span className="star-option-label" onClick={() => setStarWaypointsVisible(!starWaypointsVisible)}>Waypoints</span>
        <input type="checkbox" checked={starWaypointsVisible} onChange={(e) => setStarWaypointsVisible(e.target.checked)} />
      </div>
      <div className="star-option-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="star-option-label">Opacity</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
          <input type="range" min="0.1" max="1" step="0.1" value={starOpacity} onChange={(e) => setStarOpacity(parseFloat(e.target.value))} style={{ flex: 1 }} />
          <span style={{ fontSize: '11px', color: '#888', minWidth: '32px' }}>{(starOpacity * 100).toFixed(0)}%</span>
        </div>
      </div>
      <div className="star-option-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="star-option-label">Line Thickness</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
          <input type="range" min="0.5" max="5" step="0.5" value={starLineWeight} onChange={(e) => setStarLineWeight(parseFloat(e.target.value))} style={{ flex: 1 }} />
          <span style={{ fontSize: '11px', color: '#888', minWidth: '32px' }}>{starLineWeight}px</span>
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      <button ref={buttonRef} id="btn-star" title="STAR Options" className={isOpen || starVisible ? 'active' : ''} onClick={handleToggle}>
        🛬 STAR
      </button>
      {dropdownContent}
    </>
  );
}

// ============== PBN Dropdown ==============
function PbnDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const pbnVisible = useFlightStore(state => state.pbnVisible);
  const setPbnVisible = useFlightStore(state => state.setPbnVisible);
  const pbnHoldingVisible = useFlightStore(state => state.pbnHoldingVisible);
  const setPbnHoldingVisible = useFlightStore(state => state.setPbnHoldingVisible);
  const pbnLegsVisible = useFlightStore(state => state.pbnLegsVisible);
  const setPbnLegsVisible = useFlightStore(state => state.setPbnLegsVisible);
  const pbnWaypointsVisible = useFlightStore(state => state.pbnWaypointsVisible);
  const setPbnWaypointsVisible = useFlightStore(state => state.setPbnWaypointsVisible);
  const pbnOpacity = useFlightStore(state => state.pbnOpacity);
  const setPbnOpacity = useFlightStore(state => state.setPbnOpacity);
  const pbnLineWeight = useFlightStore(state => state.pbnLineWeight);
  const setPbnLineWeight = useFlightStore(state => state.setPbnLineWeight);
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
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  if (uiHidden) return null;

  const dropdownContent = isOpen && dropdownPos && createPortal(
    <div ref={dropdownRef} className="pbn-dropdown" style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, zIndex: 999999 }}>
      <div className="pbn-option-row">
        <span className="pbn-option-label" onClick={() => setPbnVisible(!pbnVisible)}>PBN Enable</span>
        <input type="checkbox" checked={pbnVisible} onChange={(e) => setPbnVisible(e.target.checked)} />
      </div>
      <div className="pbn-option-row">
        <span className="pbn-option-label" onClick={() => setPbnHoldingVisible(!pbnHoldingVisible)}>Holding Patterns</span>
        <input type="checkbox" checked={pbnHoldingVisible} onChange={(e) => setPbnHoldingVisible(e.target.checked)} />
      </div>
      <div className="pbn-option-row">
        <span className="pbn-option-label" onClick={() => setPbnLegsVisible(!pbnLegsVisible)}>IAP Legs</span>
        <input type="checkbox" checked={pbnLegsVisible} onChange={(e) => setPbnLegsVisible(e.target.checked)} />
      </div>
      <div className="pbn-option-row">
        <span className="pbn-option-label" onClick={() => setPbnWaypointsVisible(!pbnWaypointsVisible)}>Waypoints</span>
        <input type="checkbox" checked={pbnWaypointsVisible} onChange={(e) => setPbnWaypointsVisible(e.target.checked)} />
      </div>
      <div className="pbn-option-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="pbn-option-label">Opacity</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
          <input type="range" min="0.1" max="1" step="0.1" value={pbnOpacity} onChange={(e) => setPbnOpacity(parseFloat(e.target.value))} style={{ flex: 1 }} />
          <span style={{ fontSize: '11px', color: '#888', minWidth: '32px' }}>{(pbnOpacity * 100).toFixed(0)}%</span>
        </div>
      </div>
      <div className="pbn-option-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="pbn-option-label">Line Thickness</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
          <input type="range" min="0.5" max="5" step="0.5" value={pbnLineWeight} onChange={(e) => setPbnLineWeight(parseFloat(e.target.value))} style={{ flex: 1 }} />
          <span style={{ fontSize: '11px', color: '#888', minWidth: '32px' }}>{pbnLineWeight}px</span>
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      <button ref={buttonRef} id="btn-pbn" title="PBN Options" className={isOpen || pbnVisible ? 'active' : ''} onClick={handleToggle}>
        📡 PBN
      </button>
      {dropdownContent}
    </>
  );
}

// ============== ILS Dropdown ==============
function IlsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const ilsVisible = useFlightStore(state => state.ilsVisible);
  const setIlsVisible = useFlightStore(state => state.setIlsVisible);
  const ilsLegsVisible = useFlightStore(state => state.ilsLegsVisible);
  const setIlsLegsVisible = useFlightStore(state => state.setIlsLegsVisible);
  const ilsWaypointsVisible = useFlightStore(state => state.ilsWaypointsVisible);
  const setIlsWaypointsVisible = useFlightStore(state => state.setIlsWaypointsVisible);
  const ilsOpacity = useFlightStore(state => state.ilsOpacity);
  const setIlsOpacity = useFlightStore(state => state.setIlsOpacity);
  const ilsLineWeight = useFlightStore(state => state.ilsLineWeight);
  const setIlsLineWeight = useFlightStore(state => state.setIlsLineWeight);
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
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  if (uiHidden) return null;

  const dropdownContent = isOpen && dropdownPos && createPortal(
    <div ref={dropdownRef} className="ils-dropdown" style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, zIndex: 999999 }}>
      <div className="ils-option-row">
        <span className="ils-option-label" onClick={() => setIlsVisible(!ilsVisible)}>ILS Enable</span>
        <input type="checkbox" checked={ilsVisible} onChange={(e) => setIlsVisible(e.target.checked)} />
      </div>
      <div className="ils-option-row">
        <span className="ils-option-label" onClick={() => setIlsLegsVisible(!ilsLegsVisible)}>ILS Legs</span>
        <input type="checkbox" checked={ilsLegsVisible} onChange={(e) => setIlsLegsVisible(e.target.checked)} />
      </div>
      <div className="ils-option-row">
        <span className="ils-option-label" onClick={() => setIlsWaypointsVisible(!ilsWaypointsVisible)}>Waypoints</span>
        <input type="checkbox" checked={ilsWaypointsVisible} onChange={(e) => setIlsWaypointsVisible(e.target.checked)} />
      </div>
      <div className="ils-option-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="ils-option-label">Opacity</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
          <input type="range" min="0.1" max="1" step="0.1" value={ilsOpacity} onChange={(e) => setIlsOpacity(parseFloat(e.target.value))} style={{ flex: 1 }} />
          <span style={{ fontSize: '11px', color: '#888', minWidth: '32px' }}>{(ilsOpacity * 100).toFixed(0)}%</span>
        </div>
      </div>
      <div className="ils-option-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <span className="ils-option-label">Line Thickness</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
          <input type="range" min="0.5" max="5" step="0.5" value={ilsLineWeight} onChange={(e) => setIlsLineWeight(parseFloat(e.target.value))} style={{ flex: 1 }} />
          <span style={{ fontSize: '11px', color: '#888', minWidth: '32px' }}>{ilsLineWeight}px</span>
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      <button ref={buttonRef} id="btn-ils" title="ILS Options" className={isOpen || ilsVisible ? 'active' : ''} onClick={handleToggle}>
        📻 ILS
      </button>
      {dropdownContent}
    </>
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

// ============== Airport Dropdown ==============
function AirportDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const airports = useAirportStore(state => state.airports);
  const toggleAirportVisibility = useAirportStore(state => state.toggleAirportVisibility);
  const showAllAirports = useAirportStore(state => state.showAllAirports);
  const hideAllAirports = useAirportStore(state => state.hideAllAirports);
  const uiHidden = useFlightStore(state => state.uiHidden);
  
  const mainAirports = useMemo(() => airports.filter(a => a.Main === 'Y'), [airports]);
  const subAirports = useMemo(() => airports.filter(a => a.Main !== 'Y'), [airports]);
  
  // Close on click outside
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
  
  // Close when curtain is hidden
  useEffect(() => {
    if (uiHidden) setIsOpen(false);
  }, [uiHidden]);
  
  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 8, left: rect.left });
    }
    setIsOpen(!isOpen);
  };
  
  if (airports.length === 0) return null;
  
  const dropdownContent = isOpen && dropdownPos && createPortal(
    <div 
      ref={dropdownRef}
      className="airport-dropdown"
      style={{ 
        position: 'fixed',
        top: dropdownPos.top,
        left: dropdownPos.left,
        zIndex: 999999
      }}
    >
      <div className="airport-dropdown-header">
        <button onClick={showAllAirports}>Show All</button>
        <button onClick={hideAllAirports}>Hide All</button>
      </div>
      {mainAirports.length > 0 && (
        <>
          <div className="airport-section-title">Main Airports</div>
          {mainAirports.map(a => (
            <div 
              key={a.fid} 
              className={`airport-dropdown-item main ${a.visible ? 'visible' : 'hidden'}`}
              onClick={() => toggleAirportVisibility(a.fid)}
            >
              <span className="airport-icon">🔴</span>
              <span className="airport-name">{a.AP || a.airport_name}</span>
              <span className="airport-code">{a.airport_identifier}</span>
            </div>
          ))}
        </>
      )}
      {subAirports.length > 0 && (
        <>
          <div className="airport-section-title">Sub Airports</div>
          {subAirports.map(a => (
            <div 
              key={a.fid} 
              className={`airport-dropdown-item ${a.visible ? 'visible' : 'hidden'}`}
              onClick={() => toggleAirportVisibility(a.fid)}
            >
              <span className="airport-icon">🔵</span>
              <span className="airport-name">{a.AP || a.airport_name}</span>
              <span className="airport-code">{a.airport_identifier}</span>
            </div>
          ))}
        </>
      )}
    </div>,
    document.body
  );
  
  return (
    <>
      <button 
        ref={buttonRef}
        id="btn-airport" 
        title="Airport List"
        className={isOpen ? 'active' : ''}
        onClick={handleToggle}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 6, verticalAlign: 'middle' }}>
          <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
        </svg>
        Airports
      </button>
      {dropdownContent}
    </>
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
      
      return true;
    });
  }, [flights, flightMeta, filter, getFlightMaxFL]);
  
  useEffect(() => {
    const handleClick = () => { setDepOpen(false); setDestOpen(false); setActypeOpen(false); };
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
      
      <div className="filter-section">
        <label>Search</label>
        <input
          type="text"
          placeholder="Flight key or ACID..."
          value={filter.searchText}
          onChange={(e) => setFilter({ searchText: e.target.value })}
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
        
        for (const key in flights) {
          const marker = markersRef.current[key];
          const fm = meta[key];
          if (!marker || !fm) continue;
          
          if (!fm.visible) {
            if (map.hasLayer(marker)) map.removeLayer(marker);
            continue;
          }
          
          const points = flights[key];
          const pos = interpolatePosition(points, currentTime);
          if (pos && pos.visible) {
            marker.setLatLng([pos.lat, pos.lon]);
            
            // Determine icon color - use FL color when FL trails mode is on
            let iconColor = fm.color;
            if (flTrailsOn && pos.fl !== null) {
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
        
        for (const key in flights) {
          const fm = meta[key];
          const points = flights[key];
          
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
          
          // Normal trails
          if (trails) {
            // If trail fully decayed, remove it
            if (trailFullyDecayed) {
              const p = polylinesRef.current[key];
              if (p && map.hasLayer(p)) map.removeLayer(p);
            } else {
              if (!polylinesRef.current[key]) {
                polylinesRef.current[key] = L.polyline([], {
                  color: fm.color, weight: CONFIG.polylineWeight, opacity: CONFIG.polylineOpacity
                });
              }
              const p = polylinesRef.current[key];
              
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
    const imgSrc = isMain ? '/Main-Air.png' : '/Sub-Air.png';
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
function LoadingOverlay({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div id="loading">
      <div className="loading-spinner"></div>
      <div>{text}</div>
    </div>
  );
}

// ============== Main App ==============
function App() {
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

  if (!showApp) {
    return (
      <>
        <LoadingOverlay text={loadingText} />
        <FilePicker onFileLoad={() => setShowApp(true)} setLoadingText={setLoadingText} />
      </>
    );
  }

  return (
    <>
      <MainUIContainer />
      <FlightMap lightMode={lightMode} satelliteMode={satelliteMode} />
      <FlightPanel />
      <FilterPanel />
      <FLLegend />
      <FlightTooltip />
      <AirportInfoPanel />
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
