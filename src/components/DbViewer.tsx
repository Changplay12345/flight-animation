// file: components/DbViewer.tsx
import { useState, useEffect, useCallback } from 'react';
import { API_BASE, apiFetch } from '../config/api';
const PAGE_SIZE = 50;

// Hide scrollbar CSS for webkit browsers
const hideScrollbarStyle = document.createElement('style');
hideScrollbarStyle.textContent = `.db-viewer-columns-grid::-webkit-scrollbar { display: none; }`;
if (!document.head.querySelector('[data-db-viewer-style]')) {
  hideScrollbarStyle.setAttribute('data-db-viewer-style', '');
  document.head.appendChild(hideScrollbarStyle);
}

interface Schema {
  schema_name: string;
}

interface Table {
  table_name: string;
}

interface Column {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface RowsResponse {
  columns: string[];
  rows: Record<string, unknown>[];
  limit: number;
  offset: number;
  error?: string;
}

export function DbViewer() {
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [tables, setTables] = useState<Record<string, Table[]>>({});
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(new Set());
  const [selectedTable, setSelectedTable] = useState<{ schema: string; table: string } | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [rows, setRows] = useState<RowsResponse | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [columnsExpanded, setColumnsExpanded] = useState(false);

  // Fetch schemas on mount
  useEffect(() => {
    console.log('Fetching schemas from:', `${API_BASE}/schemas`);
    apiFetch(`${API_BASE}/schemas`)
      .then(res => res.json())
      .then(data => {
        console.log('Schemas response:', data);
        setSchemas(data);
      })
      .catch(err => {
        console.error('Failed to fetch schemas:', err);
        setError(err.message);
      });
  }, []);

  // Fetch tables when schema is expanded
  const toggleSchema = useCallback(async (schemaName: string) => {
    const newExpanded = new Set(expandedSchemas);
    if (newExpanded.has(schemaName)) {
      newExpanded.delete(schemaName);
    } else {
      newExpanded.add(schemaName);
      if (!tables[schemaName]) {
        try {
          const res = await apiFetch(`${API_BASE}/tables?schema=${schemaName}`);
          const data = await res.json();
          setTables(prev => ({ ...prev, [schemaName]: data }));
        } catch (err) {
          setError((err as Error).message);
        }
      }
    }
    setExpandedSchemas(newExpanded);
  }, [expandedSchemas, tables]);

  // Fetch rows for current page
  const fetchRows = useCallback(async (schema: string, table: string, pageNum: number) => {
    setLoading(true);
    try {
      const offset = pageNum * PAGE_SIZE;
      const res = await apiFetch(`${API_BASE}/rows?schema=${schema}&table=${table}&limit=${PAGE_SIZE}&offset=${offset}`);
      const data = await res.json();
      setRows(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch columns, count, and first page when table is selected
  const selectTable = useCallback(async (schema: string, table: string) => {
    setSelectedTable({ schema, table });
    setPage(0);
    setLoading(true);
    setError(null);
    try {
      const [colRes, countRes, rowRes] = await Promise.all([
        apiFetch(`${API_BASE}/columns?schema=${schema}&table=${table}`),
        apiFetch(`${API_BASE}/count?schema=${schema}&table=${table}`),
        apiFetch(`${API_BASE}/rows?schema=${schema}&table=${table}&limit=${PAGE_SIZE}&offset=0`),
      ]);
      const colData = await colRes.json();
      const countData = await countRes.json();
      const rowData = await rowRes.json();
      setColumns(colData);
      setTotalCount(countData.count);
      setRows(rowData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle page change
  const goToPage = useCallback((newPage: number) => {
    if (!selectedTable) return;
    setPage(newPage);
    fetchRows(selectedTable.schema, selectedTable.table, newPage);
  }, [selectedTable, fetchRows]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div style={styles.container} className="page-transition">
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h2 style={styles.sidebarTitle}>Database Viewer</h2>
          <a href="#/" style={styles.backLink}>Back</a>
        </div>
        <a href="#/flight-features" style={styles.featureLink}>
          Create Dataset
        </a>
        {selectedTable?.schema === 'flight_features' && (
          <button
            style={styles.deleteDatasetBtn}
            onClick={async () => {
              if (!selectedTable || !confirm(`Delete dataset "${selectedTable.table}"?`)) return;
              try {
                await apiFetch(`${API_BASE}/flight-features/delete?dataset=${selectedTable.table}`, { method: 'DELETE' });
                setSelectedTable(null);
                setColumns([]);
                setRows(null);
                // Refresh tables
                const res = await apiFetch(`${API_BASE}/tables?schema=flight_features`);
                const data = await res.json();
                setTables(prev => ({ ...prev, flight_features: data }));
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            🗑️ Delete Dataset
          </button>
        )}
        <div style={styles.schemaList}>
          {schemas.map(s => (
            <div key={s.schema_name}>
              <div
                style={styles.schemaItem}
                onClick={() => toggleSchema(s.schema_name)}
              >
                <span style={styles.expandIcon}>
                  {expandedSchemas.has(s.schema_name) ? '−' : '+'}
                </span>
                {s.schema_name}
              </div>
              {expandedSchemas.has(s.schema_name) && tables[s.schema_name] && (
                <div style={styles.tableList}>
                  {tables[s.schema_name].map(t => (
                    <div
                      key={t.table_name}
                      style={{
                        ...styles.tableItem,
                        ...(selectedTable?.schema === s.schema_name &&
                          selectedTable?.table === t.table_name
                          ? styles.tableItemActive
                          : {}),
                      }}
                      onClick={() => selectTable(s.schema_name, t.table_name)}
                    >
                      {t.table_name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* Main Panel */}
      <main style={styles.main}>
        {error && <div style={styles.error}>Error: {error}</div>}

        {!selectedTable && !error && (
          <div style={styles.placeholder}>
            <p>Select a table from the sidebar to view data</p>
          </div>
        )}

        {selectedTable && (
          <>
            <div style={styles.tableHeader}>
              <h2 style={styles.tableName}>
                {selectedTable.schema}.{selectedTable.table}
              </h2>
              {totalCount > 0 && <span style={styles.rowCount}>{totalCount.toLocaleString()} rows</span>}
            </div>

            {loading ? (
              <div style={styles.loading}>Loading...</div>
            ) : (
              <>
                {/* Column metadata - collapsible */}
                <div style={styles.columnsSection}>
                  <h3 
                    style={styles.sectionTitleClickable}
                    onClick={() => setColumnsExpanded(!columnsExpanded)}
                  >
                    <span>{columnsExpanded ? '▼' : '▶'}</span>
                    {' '}Columns ({columns.length})
                  </h3>
                  {columnsExpanded && (
                    <div className="db-viewer-columns-grid" style={styles.columnsGrid}>
                      {columns.map(col => (
                        <div key={col.column_name} style={styles.columnCard}>
                          <div style={styles.columnName}>{col.column_name}</div>
                          <div style={styles.columnType}>{col.data_type}</div>
                          <div style={styles.columnNullable}>
                            {col.is_nullable === 'YES' ? 'nullable' : 'not null'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Data table */}
                <div style={styles.dataSection}>
                  <h3 style={styles.sectionTitle}>
                    Data Preview
                    <span style={styles.pageInfo}>
                      {' '}— Page {page + 1} of {totalPages || 1}
                    </span>
                  </h3>
                  <div style={styles.tableWrapper}>
                    <table style={styles.dataTable}>
                      <thead>
                        <tr>
                          {rows?.columns.map(col => (
                            <th key={col} style={styles.th}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows?.rows.map((row, i) => (
                          <tr key={i} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                            {rows.columns.map(col => (
                              <td key={col} style={styles.td}>
                                {String(row[col] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  <div style={styles.pagination}>
                    <button
                      style={{ ...styles.pageBtn, ...(page === 0 ? styles.pageBtnDisabled : {}) }}
                      onClick={() => goToPage(0)}
                      disabled={page === 0}
                    >
                      ⏮ First
                    </button>
                    <button
                      style={{ ...styles.pageBtn, ...(page === 0 ? styles.pageBtnDisabled : {}) }}
                      onClick={() => goToPage(page - 1)}
                      disabled={page === 0}
                    >
                      ◀ Prev
                    </button>
                    <span style={styles.pageText}>
                      Showing {(page * PAGE_SIZE + 1).toLocaleString()}–{Math.min((page + 1) * PAGE_SIZE, totalCount).toLocaleString()} of {totalCount.toLocaleString()}
                    </span>
                    <button
                      style={{ ...styles.pageBtn, ...(page >= totalPages - 1 ? styles.pageBtnDisabled : {}) }}
                      onClick={() => goToPage(page + 1)}
                      disabled={page >= totalPages - 1}
                    >
                      Next ▶
                    </button>
                    <button
                      style={{ ...styles.pageBtn, ...(page >= totalPages - 1 ? styles.pageBtnDisabled : {}) }}
                      onClick={() => goToPage(totalPages - 1)}
                      disabled={page >= totalPages - 1}
                    >
                      Last ⏭
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    backgroundColor: '#f5f7fa',
    color: '#111827',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  sidebar: {
    width: '280px',
    backgroundColor: '#fff',
    borderRight: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sidebarHeader: {
    padding: '20px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sidebarTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#111827',
  },
  backLink: {
    color: '#4f46e5',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: 500,
  },
  featureLink: {
    display: 'block',
    padding: '12px 20px',
    backgroundColor: '#f9fafb',
    color: '#4f46e5',
    textDecoration: 'none',
    fontSize: '13px',
    fontWeight: 500,
    borderBottom: '1px solid #e5e7eb',
  },
  deleteDatasetBtn: {
    display: 'block',
    width: '100%',
    padding: '10px 20px',
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    border: 'none',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'left',
  },
  schemaList: {
    flex: 1,
    overflow: 'auto',
    padding: '12px 0',
  },
  schemaItem: {
    padding: '10px 20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'background 0.15s',
    color: '#374151',
    fontSize: '14px',
  },
  expandIcon: {
    fontSize: '10px',
    width: '12px',
    color: '#9ca3af',
  },
  schemaIcon: {
    fontSize: '14px',
  },
  tableList: {
    paddingLeft: '20px',
  },
  tableItem: {
    padding: '8px 16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    borderRadius: '6px',
    margin: '2px 12px',
    transition: 'background 0.15s',
    color: '#6b7280',
  },
  tableItemActive: {
    backgroundColor: '#eef2ff',
    color: '#4f46e5',
  },
  tableIcon: {
    fontSize: '12px',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: '24px',
    backgroundColor: '#f5f7fa',
  },
  placeholder: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#9ca3af',
    fontSize: '15px',
  },
  error: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    border: '1px solid #fecaca',
  },
  tableHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
  },
  tableName: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600,
    color: '#111827',
  },
  rowCount: {
    backgroundColor: '#eef2ff',
    color: '#4f46e5',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: 500,
  },
  loading: {
    color: '#9ca3af',
    fontSize: '14px',
  },
  columnsSection: {
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '12px',
  },
  sectionTitleClickable: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '12px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  columnsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    maxHeight: '150px',
    overflow: 'auto',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  columnCard: {
    backgroundColor: '#fff',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    border: '1px solid #e5e7eb',
  },
  columnName: {
    fontWeight: 600,
    marginBottom: '2px',
    color: '#111827',
  },
  columnType: {
    color: '#4f46e5',
    fontSize: '12px',
  },
  columnNullable: {
    color: '#9ca3af',
    fontSize: '11px',
  },
  dataSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
  },
  tableWrapper: {
    flex: 1,
    overflow: 'auto',
  },
  dataTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    backgroundColor: '#f9fafb',
    padding: '12px 16px',
    textAlign: 'left',
    fontWeight: 600,
    position: 'sticky',
    top: 0,
    borderBottom: '1px solid #e5e7eb',
    color: '#374151',
  },
  td: {
    padding: '10px 16px',
    borderBottom: '1px solid #f3f4f6',
    maxWidth: '300px',
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
  pageInfo: {
    fontWeight: 400,
    color: '#9ca3af',
    fontSize: '12px',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '16px',
    borderTop: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
  },
  pageBtn: {
    backgroundColor: '#fff',
    color: '#374151',
    border: '1px solid #d1d5db',
    padding: '8px 14px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  pageBtnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  pageText: {
    color: '#6b7280',
    fontSize: '13px',
  },
};
