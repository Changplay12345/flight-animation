// file: components/FlightFeatureCreator.tsx
import { useState, useEffect, useCallback } from 'react';
import { API_BASE, apiFetch } from '../config/api';

interface DateOption {
  date: string;
  year: number;
  month: number;
  day: number;
}

interface Dataset {
  table_name: string;
}

interface CreateResult {
  success: boolean;
  dataset_name?: string;
  row_count?: number;
  error?: string;
}

interface PreviewData {
  columns: string[];
  rows: Record<string, unknown>[];
  limit: number;
  offset: number;
  error?: string;
}

export function FlightFeatureCreator() {
  const [dates, setDates] = useState<DateOption[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [airports, setAirports] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [customName, setCustomName] = useState<string>('');
  const [airportFilter, setAirportFilter] = useState<string>('');
  const [loadingAirports, setLoadingAirports] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CreateResult | null>(null);
  const [previewDataset, setPreviewDataset] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);

  // Fetch available dates on mount
  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch(`${API_BASE}/flight-features/dates`).then(r => r.json()),
      apiFetch(`${API_BASE}/flight-features/datasets`).then(r => r.json()),
    ])
      .then(([datesData, datasetsData]) => {
        setDates(datesData);
        setDatasets(datasetsData);
        if (datesData.length > 0) {
          setSelectedDate(datesData[0].date);
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Fetch airports when date changes
  useEffect(() => {
    if (!selectedDate) return;
    setLoadingAirports(true);
    setAirports([]);
    setAirportFilter('');
    setPreviewCount(null);
    apiFetch(`${API_BASE}/flight-features/airports?date=${selectedDate}`)
      .then(r => r.json())
      .then(data => setAirports(data))
      .catch(() => setAirports([]))
      .finally(() => setLoadingAirports(false));
  }, [selectedDate]);

  // Fetch preview count when date or airport filter changes
  useEffect(() => {
    if (!selectedDate) return;
    setLoadingPreview(true);
    const params = new URLSearchParams({ date: selectedDate });
    if (airportFilter) params.set('airport', airportFilter);
    apiFetch(`${API_BASE}/flight-features/preview-count?${params}`)
      .then(r => r.json())
      .then(data => setPreviewCount(data.count ?? null))
      .catch(() => setPreviewCount(null))
      .finally(() => setLoadingPreview(false));
  }, [selectedDate, airportFilter]);

  // Refresh datasets list
  const refreshDatasets = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_BASE}/flight-features/datasets`);
      const data = await res.json();
      setDatasets(data);
    } catch (err) {
      console.error('Failed to refresh datasets:', err);
    }
  }, []);

  // Create dataset
  const handleCreate = useCallback(async () => {
    if (!selectedDate) {
      setError('Please select a date');
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const params = new URLSearchParams({ date: selectedDate });
      if (customName.trim()) {
        params.set('name', customName.trim());
      }
      if (airportFilter.trim()) {
        params.set('airport', airportFilter.trim().toUpperCase());
      }

      const res = await apiFetch(`${API_BASE}/flight-features/create?${params}`, {
        method: 'POST',
      });
      const result: CreateResult = await res.json();

      if (result.success) {
        setSuccess(result);
        setCustomName('');
        await refreshDatasets();
      } else {
        setError(result.error || 'Failed to create dataset');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }, [selectedDate, customName, refreshDatasets]);

  // Preview dataset
  const handlePreview = useCallback(async (datasetName: string) => {
    setPreviewDataset(datasetName);
    setPreview(null);

    try {
      const res = await apiFetch(`${API_BASE}/flight-features/preview?dataset=${datasetName}&limit=20`);
      const data = await res.json();
      setPreview(data);
    } catch (err) {
      setPreview({ columns: [], rows: [], limit: 20, offset: 0, error: (err as Error).message });
    }
  }, []);

  // Delete dataset
  const handleDelete = useCallback(async (datasetName: string) => {
    if (!confirm(`Delete dataset "${datasetName}"?`)) return;

    try {
      await apiFetch(`${API_BASE}/flight-features/delete?dataset=${datasetName}`, {
        method: 'DELETE',
      });
      await refreshDatasets();
      if (previewDataset === datasetName) {
        setPreviewDataset(null);
        setPreview(null);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [refreshDatasets, previewDataset]);

  return (
    <div style={styles.container} className="page-transition">
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.title}>Create Flight Feature Dataset</h1>
        <a href="#/" style={styles.backLink}>Back</a>
      </header>

      <div style={styles.content}>
        {/* Left Panel - Create Form */}
        <div style={styles.leftPanel}>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>New Dataset</h2>
            
            {loading ? (
              <div style={styles.loading}>Loading available dates...</div>
            ) : (
              <>
                {/* Date Selection */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Select sur_air Date</label>
                  <select
                    style={styles.select}
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                  >
                    {dates.map(d => (
                      <option key={d.date} value={d.date}>
                        {d.date}
                      </option>
                    ))}
                  </select>
                  <div style={styles.hint}>
                    Data from sur_air will be filtered by this date.
                    Track data will be auto-matched by start_time.
                  </div>
                </div>

                {/* Airport Filter */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Airport Filter (optional)</label>
                  <select
                    style={styles.select}
                    value={airportFilter}
                    onChange={e => setAirportFilter(e.target.value)}
                    disabled={loadingAirports}
                  >
                    <option value="">All airports (no filter)</option>
                    {airports.map(ap => (
                      <option key={ap} value={ap}>{ap}</option>
                    ))}
                  </select>
                  <div style={styles.hint}>
                    {loadingAirports ? 'Loading airports...' : `${airports.length} airports available. Includes rows where DEP or DEST matches.`}
                  </div>
                  {/* Preview count */}
                  <div style={{ ...styles.hint, marginTop: '6px', fontWeight: 600, color: '#4CAF50' }}>
                    {loadingPreview ? 'Counting rows...' : previewCount != null ? `📊 ${previewCount.toLocaleString()} rows will be included` : ''}
                  </div>
                </div>

                {/* Custom Name */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Dataset Name (optional)</label>
                  <input
                    type="text"
                    style={styles.input}
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    placeholder={`flight_data_${selectedDate.replace(/-/g, '')}${airportFilter ? '_' + airportFilter : ''}`}
                  />
                </div>

                {/* Create Button */}
                <button
                  style={{
                    ...styles.createBtn,
                    ...(creating ? styles.createBtnDisabled : {}),
                  }}
                  onClick={handleCreate}
                  disabled={creating}
                >
                  {creating ? 'Creating...' : '🚀 Create Dataset'}
                </button>

                {/* Error/Success Messages */}
                {error && <div style={styles.error}>{error}</div>}
                {success && (
                  <div style={styles.success}>
                    ✅ Created <strong>{success.dataset_name}</strong> with {success.row_count?.toLocaleString()} rows
                  </div>
                )}
              </>
            )}
          </div>

          {/* Info Card */}
          <div style={styles.card}>
            <h3 style={styles.cardSubtitle}>How it works</h3>
            <ul style={styles.infoList}>
              <li><strong>sur_air</strong> filtered by year/month/day</li>
              <li><strong>track</strong> matched by DATE(start_time)</li>
              <li>LEFT JOIN on flight_key</li>
              <li>Excludes geom column from track</li>
              <li>Saved to <code>flight_features</code> schema</li>
            </ul>
          </div>
        </div>

        {/* Right Panel - Existing Datasets */}
        <div style={styles.rightPanel}>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Existing Datasets</h2>
            
            {datasets.length === 0 ? (
              <div style={styles.emptyState}>No datasets created yet</div>
            ) : (
              <div style={styles.datasetList}>
                {datasets.map(ds => (
                  <div
                    key={ds.table_name}
                    style={{
                      ...styles.datasetItem,
                      ...(previewDataset === ds.table_name ? styles.datasetItemActive : {}),
                    }}
                  >
                    <span
                      style={styles.datasetName}
                      onClick={() => handlePreview(ds.table_name)}
                    >
                      📊 {ds.table_name}
                    </span>
                    <button
                      style={styles.deleteBtn}
                      onClick={() => handleDelete(ds.table_name)}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preview */}
          {previewDataset && (
            <div style={styles.card}>
              <h3 style={styles.cardSubtitle}>Preview: {previewDataset}</h3>
              {preview?.error ? (
                <div style={styles.error}>{preview.error}</div>
              ) : preview ? (
                <div style={styles.previewWrapper}>
                  <table style={styles.previewTable}>
                    <thead>
                      <tr>
                        {preview.columns.slice(0, 8).map(col => (
                          <th key={col} style={styles.th}>{col}</th>
                        ))}
                        {preview.columns.length > 8 && (
                          <th style={styles.th}>+{preview.columns.length - 8} more</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.slice(0, 10).map((row, i) => (
                        <tr key={i} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                          {preview.columns.slice(0, 8).map(col => (
                            <td key={col} style={styles.td}>
                              {String(row[col] ?? '')}
                            </td>
                          ))}
                          {preview.columns.length > 8 && <td style={styles.td}>...</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={styles.loading}>Loading preview...</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    maxHeight: '100vh',
    overflow: 'auto',
    backgroundColor: '#f5f7fa',
    color: '#111827',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600,
    color: '#111827',
  },
  backLink: {
    color: '#4f46e5',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: 500,
  },
  content: {
    display: 'flex',
    gap: '24px',
    padding: '24px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  leftPanel: {
    width: '400px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  rightPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #e5e7eb',
  },
  cardTitle: {
    margin: '0 0 16px 0',
    fontSize: '16px',
    fontWeight: 600,
    color: '#111827',
  },
  cardSubtitle: {
    margin: '0 0 12px 0',
    fontSize: '12px',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  formGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#374151',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    backgroundColor: '#fff',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    color: '#111827',
    fontSize: '14px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    backgroundColor: '#fff',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    color: '#111827',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  hint: {
    marginTop: '6px',
    fontSize: '12px',
    color: '#9ca3af',
  },
  createBtn: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#4f46e5',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  createBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  error: {
    marginTop: '12px',
    padding: '10px 12px',
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    borderRadius: '8px',
    fontSize: '13px',
    border: '1px solid #fecaca',
  },
  success: {
    marginTop: '12px',
    padding: '10px 12px',
    backgroundColor: '#f0fdf4',
    color: '#16a34a',
    borderRadius: '8px',
    fontSize: '13px',
    border: '1px solid #bbf7d0',
  },
  loading: {
    color: '#9ca3af',
    fontSize: '14px',
  },
  infoList: {
    margin: 0,
    paddingLeft: '20px',
    fontSize: '13px',
    lineHeight: 1.8,
    color: '#6b7280',
  },
  datasetList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  datasetItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  datasetItemActive: {
    backgroundColor: '#eef2ff',
    borderColor: '#c7d2fe',
  },
  datasetName: {
    cursor: 'pointer',
    fontSize: '14px',
    color: '#111827',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#9ca3af',
  },
  emptyState: {
    color: '#9ca3af',
    fontSize: '14px',
    textAlign: 'center',
    padding: '20px',
  },
  previewWrapper: {
    overflow: 'auto',
    maxHeight: '300px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  },
  previewTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
  },
  th: {
    backgroundColor: '#f9fafb',
    padding: '8px 10px',
    textAlign: 'left',
    fontWeight: 600,
    position: 'sticky',
    top: 0,
    whiteSpace: 'nowrap',
    color: '#374151',
    borderBottom: '1px solid #e5e7eb',
  },
  td: {
    padding: '6px 10px',
    borderBottom: '1px solid #f3f4f6',
    maxWidth: '150px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: '#4b5563',
  },
  trEven: {
    backgroundColor: '#fff',
  },
  trOdd: {
    backgroundColor: '#f9fafb',
  },
};
