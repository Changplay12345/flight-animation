import { useState } from 'react';
import { useFlightStore } from '../store/flightStore';

export function AirwayPanel() {
  const selectedAirway = useFlightStore(state => state.selectedAirway);
  const airwayOpacity = useFlightStore(state => state.airwayOpacity);
  const setAirwayOpacity = useFlightStore(state => state.setAirwayOpacity);
  const setAirwayPanelOpen = useFlightStore(state => state.setAirwayPanelOpen);
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setAirwayPanelOpen(false);
      setIsClosing(false);
    }, 300);
  };

  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAirwayOpacity(parseFloat(e.target.value));
  };

  if (!selectedAirway) return null;

  return (
    <div className={`airway-info-panel ${isClosing ? 'closing' : ''}`}>
      <div className="airway-panel-header">
        <h2>Airway {selectedAirway}</h2>
        <button className="close-btn" onClick={handleClose}>×</button>
      </div>
      <div className="airway-panel-content">
        <div className="airway-panel-section">
          <h3>Display Settings</h3>
          <div className="info-row">
            <span className="label">Opacity:</span>
            <div className="opacity-control">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={airwayOpacity}
                onChange={handleOpacityChange}
                className="opacity-slider"
              />
              <span className="opacity-value">{(airwayOpacity * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
        
        <div className="airway-panel-section">
          <h3>Information</h3>
          <div className="info-row">
            <span className="label">Route ID:</span>
            <span className="value">{selectedAirway}</span>
          </div>
          <div className="info-row">
            <span className="label">Type:</span>
            <span className="value">Enroute Airway</span>
          </div>
          <div className="info-row">
            <span className="label">Status:</span>
            <span className="value">Active</span>
          </div>
        </div>
        
        <div className="airway-panel-section">
          <h3>Instructions</h3>
          <div className="info-text">
            • Click on any airway segment to view its properties<br/>
            • Adjust opacity to control visibility<br/>
            • Hover over segments to highlight them
          </div>
        </div>
      </div>
    </div>
  );
}
