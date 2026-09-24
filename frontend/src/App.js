import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import './App.css';

const API_BASE = 'http://localhost:8000';

const QUICK_QUESTIONS = [
  { icon: '\u{1F3AF}', text: "What should I focus on this quarter?" },
  { icon: '\u{1F4C9}', text: "Which products are declining?" },
  { icon: '\u{1F504}', text: "Compare Electronics vs Accessories" },
  { icon: '\u{1F3C6}', text: "Top 5 products by revenue" },
  { icon: '\u{1F4B0}', text: "Best margin products" },
  { icon: '\u{1F4C8}', text: "Revenue trend and 30-day forecast" },
];

const SEGMENT_COLORS = {
  'Champions': '#22c55e',
  'Loyal': '#3b82f6',
  'Promising': '#8b5cf6',
  'Standard': '#6b7280',
  'At Risk': '#f59e0b',
  'Lost': '#ef4444',
};

function App() {
  const [datasetId, setDatasetId] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [fileName, setFileName] = useState('');
  const [history, setHistory] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('ea-theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  // Advanced analytics state
  const [activePanel, setActivePanel] = useState(null); // null, 'anomalies', 'forecast', 'rfm', 'whatif'
  const [panelData, setPanelData] = useState(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [whatIfTab, setWhatIfTab] = useState('price');
  const [whatIfForm, setWhatIfForm] = useState({
    product_name: '', price_change_pct: 10, discount_pct: 20,
    duration_days: 7, product_1: '', product_2: '',
  });

  const resultsEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ea-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    if (resultsEndRef.current) {
      resultsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history, loading]);

  const handleFileUpload = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setUploadStatus('uploading');
    setHistory([]);
    setMetadata(null);
    setDatasetId(null);
    setActivePanel(null);
    setPanelData(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_BASE}/api/datasets/upload`, formData);
      if (response.data.status === 'success') {
        setDatasetId(response.data.dataset_id);
        setMetadata(response.data.metadata);
        setUploadStatus('success');
      }
    } catch (error) {
      const msg = error.response?.data?.error || error.response?.data?.errors?.join(', ') || error.message;
      setUploadStatus('error: ' + msg);
    }
  };

  const handleInputChange = (e) => handleFileUpload(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleAnalyze = async () => {
    if (!datasetId || !question.trim()) return;
    const q = question.trim();
    setQuestion('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE}/api/analyze`, {
        question: q,
        dataset_id: datasetId,
        analysis_type: 'auto'
      });
      setHistory(prev => [...prev, { question: q, result: response.data.result, ts: Date.now() }]);
    } catch (error) {
      const msg = error.response?.data?.detail || error.message;
      setHistory(prev => [...prev, { question: q, error: msg, ts: Date.now() }]);
    }
    setLoading(false);
    if (textareaRef.current) textareaRef.current.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleAnalyze();
    }
  };

  const handleNewSession = () => {
    setDatasetId(null);
    setMetadata(null);
    setHistory([]);
    setUploadStatus('');
    setFileName('');
    setQuestion('');
    setActivePanel(null);
    setPanelData(null);
  };

  // --- Advanced Analytics ---
  const runAdvancedAnalysis = async (panelType) => {
    if (activePanel === panelType && panelData) {
      setActivePanel(null);
      return;
    }
    setActivePanel(panelType);
    setPanelLoading(true);
    setPanelData(null);

    try {
      let endpoint = '';
      let body = { dataset_id: datasetId };

      switch (panelType) {
        case 'anomalies':
          endpoint = '/api/analyze/anomalies';
          break;
        case 'forecast':
          endpoint = '/api/analyze/forecast';
          body.days = 30;
          break;
        case 'rfm':
          endpoint = '/api/analyze/rfm';
          break;
        case 'drift':
          endpoint = '/api/analyze/drift';
          break;
        default:
          break;
      }

      const response = await axios.post(`${API_BASE}${endpoint}`, body);
      setPanelData(response.data.result);
    } catch (error) {
      setPanelData({ error: error.response?.data?.error || error.message });
    }
    setPanelLoading(false);
  };

  const runWhatIf = async () => {
    setPanelLoading(true);
    setPanelData(null);

    try {
      let endpoint = '';
      let body = { dataset_id: datasetId };

      switch (whatIfTab) {
        case 'price':
          endpoint = '/api/analyze/scenario/price';
          body.product_name = whatIfForm.product_name;
          body.price_change_pct = parseFloat(whatIfForm.price_change_pct);
          break;
        case 'promotion':
          endpoint = '/api/analyze/scenario/promotion';
          body.product_name = whatIfForm.product_name;
          body.discount_pct = parseFloat(whatIfForm.discount_pct);
          body.duration_days = parseInt(whatIfForm.duration_days);
          break;
        case 'bundle':
          endpoint = '/api/analyze/scenario/bundle';
          body.product_1 = whatIfForm.product_1;
          body.product_2 = whatIfForm.product_2;
          break;
        default:
          break;
      }

      const response = await axios.post(`${API_BASE}${endpoint}`, body);
      setPanelData(response.data.result);
    } catch (error) {
      setPanelData({ error: error.response?.data?.error || error.message });
    }
    setPanelLoading(false);
  };

  const runRootCause = async (productName) => {
    setActivePanel('rootcause');
    setPanelLoading(true);
    setPanelData(null);

    try {
      const response = await axios.post(`${API_BASE}/api/analyze/root-cause`, {
        dataset_id: datasetId,
        product_name: productName,
      });
      setPanelData(response.data.result);
    } catch (error) {
      setPanelData({ error: error.response?.data?.error || error.message });
    }
    setPanelLoading(false);
  };

  const fmt = (v) => {
    if (v === undefined || v === null) return '-';
    if (typeof v === 'number') return v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : v.toFixed(2);
    return v;
  };

  const fmtPct = (v) => {
    if (v === undefined || v === null) return '-';
    const sign = v > 0 ? '+' : '';
    return `${sign}${v.toFixed(1)}%`;
  };

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12V7H5a2 2 0 010-4h14v4"/>
                <path d="M3 5v14a2 2 0 002 2h16v-5"/>
                <path d="M18 12a2 2 0 000 4h4v-4h-4z"/>
              </svg>
            </div>
            {sidebarOpen && <span className="logo-text">E-Analyzer</span>}
          </div>
          <div className="sidebar-header-actions">
            <button className="theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              {theme === 'dark' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                </svg>
              )}
            </button>
            <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} title={sidebarOpen ? 'Collapse' : 'Expand'}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {sidebarOpen
                  ? <><path d="M11 19l-7-7 7-7"/><path d="M18 19l-7-7 7-7"/></>
                  : <><path d="M13 5l7 7-7 7"/><path d="M6 5l7 7-7 7"/></>
                }
              </svg>
            </button>
          </div>
        </div>

        {sidebarOpen && (
          <>
            <button className="new-session-btn" onClick={handleNewSession}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New Analysis
            </button>

            {history.length > 0 && (
              <div className="sidebar-history">
                <div className="sidebar-section-label">History</div>
                {history.map((h, i) => (
                  <div key={h.ts} className="history-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                    </svg>
                    <span>{h.question.length > 32 ? h.question.slice(0, 32) + '...' : h.question}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="sidebar-footer">
              {metadata && (
                <div className="sidebar-dataset-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <span>{fileName}</span>
                </div>
              )}
              <div className="sidebar-credit">
                Powered by AI
              </div>
            </div>
          </>
        )}
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="main-inner">

          {/* Empty State / Upload */}
          {!datasetId && (
            <div className="welcome-screen">
              <div className="welcome-glow" />
              <div className="welcome-content">
                <h1 className="welcome-title">
                  <span className="gradient-text">Analyze your e-commerce data</span>
                  <br />with AI precision
                </h1>
                <p className="welcome-subtitle">
                  Upload your sales data and ask questions in plain English. Get actionable insights with anomaly detection, forecasting, RFM segmentation, and what-if scenarios.
                </p>

                <div
                  className={`upload-zone ${dragOver ? 'drag-over' : ''} ${uploadStatus === 'uploading' ? 'is-uploading' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <input type="file" onChange={handleInputChange} accept=".csv,.xlsx,.xls,.json,.parquet" />
                  <div className="upload-visual">
                    <div className="upload-icon-ring">
                      {uploadStatus === 'uploading' ? (
                        <div className="upload-spinner" />
                      ) : (
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                          <polyline points="17 8 12 3 7 8"/>
                          <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                      )}
                    </div>
                    <h3>{uploadStatus === 'uploading' ? 'Processing your data...' : 'Drop your dataset here'}</h3>
                    <p>or click to browse files</p>
                    <div className="format-chips">
                      {['CSV', 'Excel', 'JSON', 'Parquet'].map(f => (
                        <span key={f} className="format-chip">{f}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {uploadStatus.startsWith('error') && (
                  <div className="error-toast">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    {uploadStatus.replace('error: ', '')}
                  </div>
                )}

                <div className="trust-badges">
                  <div className="trust-badge">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    Data stays local
                  </div>
                  <div className="trust-badge">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                    Predictive analytics
                  </div>
                  <div className="trust-badge">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                    AI-powered
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dataset Loaded - Workspace */}
          {datasetId && (
            <div className="workspace">
              {/* Dataset Overview Bar */}
              <div className="dataset-bar">
                <div className="dataset-bar-left">
                  <div className="dataset-file-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>
                  <div>
                    <div className="dataset-file-name">{fileName}</div>
                    <div className="dataset-file-meta">{metadata?.row_count?.toLocaleString()} rows &middot; {metadata?.column_count} columns</div>
                  </div>
                </div>
                <div className="dataset-bar-stats">
                  {metadata && (
                    <>
                      <div className="mini-stat">
                        <span className="mini-stat-value">{metadata.row_count.toLocaleString()}</span>
                        <span className="mini-stat-label">Rows</span>
                      </div>
                      <div className="mini-stat">
                        <span className="mini-stat-value">{metadata.column_count}</span>
                        <span className="mini-stat-label">Cols</span>
                      </div>
                      <div className="mini-stat">
                        <span className="mini-stat-value">{metadata.validation.duplicate_rows}</span>
                        <span className="mini-stat-label">Dupes</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Column Tags */}
              {metadata && (
                <div className="columns-bar">
                  <span className="columns-label">Columns</span>
                  <div className="columns-scroll">
                    {metadata.columns.map(col => (
                      <span key={col} className="col-tag">{col}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Advanced Analytics Toolbar */}
              <div className="analytics-toolbar">
                <span className="analytics-toolbar-label">Advanced Analytics</span>
                <div className="analytics-toolbar-btns">
                  {[
                    { key: 'anomalies', label: 'Anomalies', icon: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01' },
                    { key: 'forecast', label: 'Forecast', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
                    { key: 'rfm', label: 'RFM Segments', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 7a4 4 0 100-8 4 4 0 000 8 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75' },
                    { key: 'drift', label: 'Data Drift', icon: 'M2 20h20 M5 20V10l4-6 4 8 4-4 3 4v8' },
                    { key: 'whatif', label: 'What-If', icon: 'M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3 M12 17h.01 M22 12c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2s10 4.48 10 10z' },
                  ].map(btn => (
                    <button
                      key={btn.key}
                      className={`analytics-btn ${activePanel === btn.key ? 'active' : ''}`}
                      onClick={() => btn.key === 'whatif' ? setActivePanel(activePanel === 'whatif' ? null : 'whatif') : runAdvancedAnalysis(btn.key)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d={btn.icon}/>
                      </svg>
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Analytics Panel */}
              {activePanel && (
                <div className="analytics-panel">
                  <div className="analytics-panel-header">
                    <h3 className="analytics-panel-title">
                      {activePanel === 'anomalies' && 'Anomaly Detection'}
                      {activePanel === 'forecast' && '30-Day Sales Forecast'}
                      {activePanel === 'rfm' && 'RFM Product Segmentation'}
                      {activePanel === 'drift' && 'Data Drift Analysis'}
                      {activePanel === 'whatif' && 'What-If Scenario Simulator'}
                      {activePanel === 'rootcause' && 'Root Cause Analysis'}
                    </h3>
                    <button className="analytics-panel-close" onClick={() => { setActivePanel(null); setPanelData(null); }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>

                  {panelLoading && (
                    <div className="panel-loading">
                      <div className="upload-spinner" />
                      <span>Running analysis...</span>
                    </div>
                  )}

                  {panelData?.error && (
                    <div className="error-inline">{panelData.error}</div>
                  )}

                  {/* Anomalies Panel */}
                  {activePanel === 'anomalies' && panelData && !panelData.error && (
                    <div className="panel-content">
                      <div className="panel-stats-row">
                        <div className="panel-stat">
                          <span className="panel-stat-value" style={{color: panelData.anomalies_detected > 0 ? 'var(--warning)' : 'var(--success)'}}>
                            {panelData.anomalies_detected}
                          </span>
                          <span className="panel-stat-label">Anomalies Found</span>
                        </div>
                        <div className="panel-stat">
                          <span className="panel-stat-value">{panelData.total_rows}</span>
                          <span className="panel-stat-label">Total Rows</span>
                        </div>
                        <div className="panel-stat">
                          <span className="panel-stat-value">{panelData.anomaly_percentage}%</span>
                          <span className="panel-stat-label">Anomaly Rate</span>
                        </div>
                      </div>
                      {panelData.summary && (
                        <div className="panel-tags">
                          {Object.entries(panelData.summary).map(([k, v]) => (
                            <span key={k} className={`panel-tag ${v > 0 ? 'tag-warn' : ''}`}>
                              {k.replace(/_/g, ' ')}: {v}
                            </span>
                          ))}
                        </div>
                      )}
                      {panelData.details?.length > 0 && (
                        <div className="panel-table-wrap">
                          <table className="panel-table">
                            <thead>
                              <tr>
                                <th>#</th>
                                {panelData.details[0].product_name && <th>Product</th>}
                                {panelData.details[0].revenue !== undefined && <th>Revenue</th>}
                                {panelData.details[0].quantity_sold !== undefined && <th>Qty</th>}
                                <th>Type</th>
                                <th>Score</th>
                              </tr>
                            </thead>
                            <tbody>
                              {panelData.details.slice(0, 10).map((a, i) => (
                                <tr key={i}>
                                  <td>{a.index}</td>
                                  {a.product_name && <td>{a.product_name}</td>}
                                  {a.revenue !== undefined && <td>{fmt(a.revenue)}</td>}
                                  {a.quantity_sold !== undefined && <td>{a.quantity_sold}</td>}
                                  <td><span className="anomaly-type-badge">{a.anomaly_type}</span></td>
                                  <td>{a.anomaly_score?.toFixed(3)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Forecast Panel */}
                  {activePanel === 'forecast' && panelData && !panelData.error && (
                    <div className="panel-content">
                      <div className="panel-stats-row">
                        <div className="panel-stat">
                          <span className="panel-stat-value" style={{color: panelData.trend?.direction === 'Growing' ? 'var(--success)' : 'var(--danger)'}}>
                            {panelData.trend?.direction}
                          </span>
                          <span className="panel-stat-label">Trend</span>
                        </div>
                        <div className="panel-stat">
                          <span className="panel-stat-value">{fmtPct(panelData.trend?.change_percent)}</span>
                          <span className="panel-stat-label">Forecast Change</span>
                        </div>
                        <div className="panel-stat">
                          <span className="panel-stat-value">{fmt(panelData.trend?.current_daily_avg)}</span>
                          <span className="panel-stat-label">Current Daily Avg</span>
                        </div>
                        <div className="panel-stat">
                          <span className="panel-stat-value">{fmt(panelData.trend?.forecast_daily_avg)}</span>
                          <span className="panel-stat-label">Forecast Daily Avg</span>
                        </div>
                        <div className="panel-stat">
                          <span className="panel-stat-value">{panelData.r2_score}</span>
                          <span className="panel-stat-label">Model R2</span>
                        </div>
                      </div>
                      {panelData.forecast?.length > 0 && (
                        <div className="forecast-chart">
                          <div className="forecast-bars">
                            {panelData.forecast.filter((_, i) => i % Math.ceil(panelData.forecast.length / 15) === 0).map((f, i) => {
                              const maxVal = Math.max(...panelData.forecast.map(x => x.confidence_upper));
                              const pct = maxVal > 0 ? (f.forecast / maxVal) * 100 : 0;
                              const lowerPct = maxVal > 0 ? (f.confidence_lower / maxVal) * 100 : 0;
                              const upperPct = maxVal > 0 ? (f.confidence_upper / maxVal) * 100 : 0;
                              return (
                                <div key={i} className="forecast-bar-group" title={`${f.date}: $${f.forecast.toFixed(0)} (${f.confidence_lower.toFixed(0)} - ${f.confidence_upper.toFixed(0)})`}>
                                  <div className="forecast-ci" style={{bottom: `${lowerPct}%`, height: `${upperPct - lowerPct}%`}} />
                                  <div className="forecast-bar" style={{height: `${pct}%`}} />
                                  <span className="forecast-date">{f.date.slice(5)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* RFM Panel */}
                  {activePanel === 'rfm' && panelData && !panelData.error && (
                    <div className="panel-content">
                      <div className="panel-stats-row">
                        {panelData.summary && Object.entries(panelData.summary).map(([seg, count]) => (
                          <div key={seg} className="panel-stat">
                            <span className="panel-stat-value" style={{color: SEGMENT_COLORS[seg.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())] || 'var(--text)'}}>
                              {count}
                            </span>
                            <span className="panel-stat-label">{seg.replace(/_/g, ' ')}</span>
                          </div>
                        ))}
                      </div>
                      {panelData.rfm_analysis?.length > 0 && (
                        <div className="panel-table-wrap">
                          <table className="panel-table">
                            <thead>
                              <tr>
                                <th>Product</th>
                                <th>Segment</th>
                                <th>R</th>
                                <th>F</th>
                                <th>M</th>
                                <th>Score</th>
                                <th>Revenue</th>
                                <th>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {panelData.rfm_analysis.map((p, i) => (
                                <tr key={i}>
                                  <td className="td-product">{p.product}</td>
                                  <td>
                                    <span className="segment-badge" style={{background: (SEGMENT_COLORS[p.segment] || '#6b7280') + '20', color: SEGMENT_COLORS[p.segment] || '#6b7280', borderColor: (SEGMENT_COLORS[p.segment] || '#6b7280') + '40'}}>
                                      {p.segment}
                                    </span>
                                  </td>
                                  <td>{p.r_score}</td>
                                  <td>{p.f_score}</td>
                                  <td>{p.m_score}</td>
                                  <td><strong>{p.rfm_score}</strong></td>
                                  <td>{fmt(p.monetary)}</td>
                                  <td>
                                    <button className="mini-action-btn" onClick={() => runRootCause(p.product)} title="Analyze this product">
                                      Analyze
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Drift Panel */}
                  {activePanel === 'drift' && panelData && !panelData.error && (
                    <div className="panel-content">
                      <div className="panel-stats-row">
                        <div className="panel-stat">
                          <span className="panel-stat-value" style={{color: panelData.overall_drift_detected ? 'var(--warning)' : 'var(--success)'}}>
                            {panelData.overall_drift_detected ? 'Drift Detected' : 'Stable'}
                          </span>
                          <span className="panel-stat-label">Overall Status</span>
                        </div>
                      </div>
                      {panelData.early_period && (
                        <div className="panel-tags">
                          <span className="panel-tag">Early: {panelData.early_period}</span>
                          <span className="panel-tag">Late: {panelData.late_period}</span>
                        </div>
                      )}
                      {panelData.drifts && (
                        <div className="drift-cards">
                          {Object.entries(panelData.drifts).map(([metric, data]) => (
                            <div key={metric} className={`drift-card ${data.drift_detected ? 'drift-alert' : ''}`}>
                              <div className="drift-card-title">{metric.replace(/_/g, ' ')}</div>
                              <div className="drift-card-row">
                                <span>Early avg: {fmt(data.early_mean)}</span>
                                <span>Late avg: {fmt(data.late_mean)}</span>
                              </div>
                              <div className={`drift-change ${data.change_percent > 0 ? 'positive' : 'negative'}`}>
                                {fmtPct(data.change_percent)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {panelData.recommendation && (
                        <div className="panel-recommendation">{panelData.recommendation}</div>
                      )}
                    </div>
                  )}

                  {/* Root Cause Panel */}
                  {activePanel === 'rootcause' && panelData && !panelData.error && (
                    <div className="panel-content">
                      <div className="panel-stats-row">
                        <div className="panel-stat">
                          <span className="panel-stat-value">{panelData.product}</span>
                          <span className="panel-stat-label">Product</span>
                        </div>
                        <div className="panel-stat">
                          <span className="panel-stat-value" style={{color: panelData.revenue_change_percent < 0 ? 'var(--danger)' : 'var(--success)'}}>
                            {fmtPct(panelData.revenue_change_percent)}
                          </span>
                          <span className="panel-stat-label">Revenue Change</span>
                        </div>
                        <div className="panel-stat">
                          <span className="panel-stat-value">{fmt(panelData.early_period_revenue)}</span>
                          <span className="panel-stat-label">Early Revenue</span>
                        </div>
                        <div className="panel-stat">
                          <span className="panel-stat-value">{fmt(panelData.late_period_revenue)}</span>
                          <span className="panel-stat-label">Late Revenue</span>
                        </div>
                      </div>
                      {panelData.likely_causes_ranked?.length > 0 && (
                        <div className="causes-list">
                          <h4>Ranked Root Causes</h4>
                          {panelData.likely_causes_ranked.map((c, i) => (
                            <div key={i} className="cause-item">
                              <div className="cause-rank">#{i + 1}</div>
                              <div className="cause-info">
                                <div className="cause-name">{c.cause}</div>
                                <div className="cause-detail">{c.detail}</div>
                              </div>
                              <div className="cause-confidence">
                                <div className="confidence-bar">
                                  <div className="confidence-fill" style={{width: `${c.confidence * 100}%`}} />
                                </div>
                                <span>{(c.confidence * 100).toFixed(0)}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {panelData.recommendation && (
                        <div className="panel-recommendation">{panelData.recommendation}</div>
                      )}
                    </div>
                  )}

                  {/* What-If Panel */}
                  {activePanel === 'whatif' && (
                    <div className="panel-content">
                      <div className="whatif-tabs">
                        {[
                          { key: 'price', label: 'Price Change' },
                          { key: 'promotion', label: 'Promotion' },
                          { key: 'bundle', label: 'Bundle' },
                        ].map(tab => (
                          <button key={tab.key} className={`whatif-tab ${whatIfTab === tab.key ? 'active' : ''}`} onClick={() => { setWhatIfTab(tab.key); setPanelData(null); }}>
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      <div className="whatif-form">
                        {whatIfTab === 'price' && (
                          <>
                            <input className="whatif-input" placeholder="Product name (exact)" value={whatIfForm.product_name} onChange={e => setWhatIfForm({...whatIfForm, product_name: e.target.value})} />
                            <div className="whatif-row">
                              <label>Price change %</label>
                              <input className="whatif-input small" type="number" value={whatIfForm.price_change_pct} onChange={e => setWhatIfForm({...whatIfForm, price_change_pct: e.target.value})} />
                            </div>
                          </>
                        )}
                        {whatIfTab === 'promotion' && (
                          <>
                            <input className="whatif-input" placeholder="Product name (exact)" value={whatIfForm.product_name} onChange={e => setWhatIfForm({...whatIfForm, product_name: e.target.value})} />
                            <div className="whatif-row">
                              <label>Discount %</label>
                              <input className="whatif-input small" type="number" value={whatIfForm.discount_pct} onChange={e => setWhatIfForm({...whatIfForm, discount_pct: e.target.value})} />
                            </div>
                            <div className="whatif-row">
                              <label>Duration (days)</label>
                              <input className="whatif-input small" type="number" value={whatIfForm.duration_days} onChange={e => setWhatIfForm({...whatIfForm, duration_days: e.target.value})} />
                            </div>
                          </>
                        )}
                        {whatIfTab === 'bundle' && (
                          <>
                            <input className="whatif-input" placeholder="Product 1 (exact name)" value={whatIfForm.product_1} onChange={e => setWhatIfForm({...whatIfForm, product_1: e.target.value})} />
                            <input className="whatif-input" placeholder="Product 2 (exact name)" value={whatIfForm.product_2} onChange={e => setWhatIfForm({...whatIfForm, product_2: e.target.value})} />
                          </>
                        )}
                        <button className="whatif-run-btn" onClick={runWhatIf} disabled={panelLoading}>
                          {panelLoading ? 'Simulating...' : 'Run Simulation'}
                        </button>
                      </div>

                      {/* What-If Results */}
                      {panelData && !panelData.error && activePanel === 'whatif' && (
                        <div className="whatif-results">
                          {panelData.scenario && <div className="whatif-scenario-label">{panelData.scenario}</div>}

                          {/* Price change results */}
                          {panelData.current && panelData.projected && (
                            <div className="whatif-comparison">
                              <div className="whatif-col">
                                <h4>Current</h4>
                                <div className="whatif-metric">Price: {fmt(panelData.current.price)}</div>
                                <div className="whatif-metric">Qty: {panelData.current.quantity_sold?.toLocaleString()}</div>
                                <div className="whatif-metric">Revenue: {fmt(panelData.current.revenue)}</div>
                              </div>
                              <div className="whatif-arrow">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                              </div>
                              <div className="whatif-col projected">
                                <h4>Projected</h4>
                                <div className="whatif-metric">Price: {fmt(panelData.projected.price)}</div>
                                <div className="whatif-metric">Qty: {panelData.projected.quantity_sold?.toLocaleString()}</div>
                                <div className="whatif-metric">Revenue: {fmt(panelData.projected.revenue)}</div>
                              </div>
                            </div>
                          )}

                          {/* Promotion results */}
                          {panelData.during_promotion && (
                            <div className="whatif-promo-results">
                              <div className="drift-cards">
                                <div className="drift-card">
                                  <div className="drift-card-title">During Promotion</div>
                                  <div className="drift-card-row"><span>Daily qty: {panelData.during_promotion.daily_quantity}</span></div>
                                  <div className="drift-card-row"><span>Daily revenue: {fmt(panelData.during_promotion.daily_revenue)}</span></div>
                                  <div className="drift-card-row"><span>Volume lift: {panelData.during_promotion.volume_lift_multiplier}x</span></div>
                                </div>
                                <div className="drift-card">
                                  <div className="drift-card-title">Post-Promo (30d)</div>
                                  <div className="drift-card-row"><span>Retained qty: {panelData.post_promotion_30d?.retained_daily_quantity}</span></div>
                                  <div className="drift-card-row"><span>Retention: {panelData.post_promotion_30d?.retention_rate_percent}%</span></div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Bundle results */}
                          {panelData.bundle_price && (
                            <div className="drift-cards">
                              <div className="drift-card">
                                <div className="drift-card-title">Bundle Pricing</div>
                                <div className="drift-card-row"><span>Bundle price: {fmt(panelData.bundle_price)}</span></div>
                                <div className="drift-card-row"><span>Discount: {panelData.bundle_discount_percent}%</span></div>
                              </div>
                              <div className="drift-card">
                                <div className="drift-card-title">Revenue Impact</div>
                                <div className="drift-card-row"><span>Current: {fmt(panelData.current_combined_revenue)}</span></div>
                                <div className="drift-card-row"><span>Projected: {fmt(panelData.projected_bundle_revenue)}</span></div>
                                <div className={`drift-change ${panelData.incremental_revenue > 0 ? 'positive' : 'negative'}`}>
                                  {fmtPct(panelData.incremental_percent)}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Impact / recommendation */}
                          {(panelData.changes?.revenue_change_percent !== undefined || panelData.impact?.roi_percent !== undefined) && (
                            <div className="panel-stats-row" style={{marginTop: '12px'}}>
                              {panelData.changes?.revenue_change_percent !== undefined && (
                                <div className="panel-stat">
                                  <span className="panel-stat-value" style={{color: panelData.changes.revenue_change_percent > 0 ? 'var(--success)' : 'var(--danger)'}}>
                                    {fmtPct(panelData.changes.revenue_change_percent)}
                                  </span>
                                  <span className="panel-stat-label">Revenue Impact</span>
                                </div>
                              )}
                              {panelData.impact?.roi_percent !== undefined && (
                                <div className="panel-stat">
                                  <span className="panel-stat-value" style={{color: panelData.impact.roi_percent > 0 ? 'var(--success)' : 'var(--danger)'}}>
                                    {fmtPct(panelData.impact.roi_percent)}
                                  </span>
                                  <span className="panel-stat-label">ROI</span>
                                </div>
                              )}
                            </div>
                          )}

                          {(panelData.recommendation || panelData.impact?.recommendation) && (
                            <div className="panel-recommendation">{panelData.recommendation || panelData.impact?.recommendation}</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Conversation Area */}
              <div className="conversation">
                {history.length === 0 && !loading && (
                  <div className="empty-conversation">
                    <div className="empty-icon">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                      </svg>
                    </div>
                    <h3>Ask anything about your data</h3>
                    <p>Try one of these to get started, or use the Advanced Analytics toolbar above</p>
                    <div className="quick-grid">
                      {QUICK_QUESTIONS.map(q => (
                        <button key={q.text} className="quick-card" onClick={() => { setQuestion(q.text); if(textareaRef.current) textareaRef.current.focus(); }}>
                          <span className="quick-card-icon">{q.icon}</span>
                          <span className="quick-card-text">{q.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {history.map((entry, idx) => (
                  <div key={entry.ts} className="conversation-turn" style={{ animationDelay: `${idx * 0.05}s` }}>
                    {/* User Question */}
                    <div className="msg msg-user">
                      <div className="msg-avatar user-avatar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      </div>
                      <div className="msg-bubble msg-bubble-user">{entry.question}</div>
                    </div>

                    {/* AI Response */}
                    <div className="msg msg-ai">
                      <div className="msg-avatar ai-avatar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a4 4 0 014 4v1h2a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h2V6a4 4 0 014-4z"/><line x1="9" y1="14" x2="9" y2="14.01"/><line x1="15" y1="14" x2="15" y2="14.01"/></svg>
                      </div>
                      <div className="msg-bubble msg-bubble-ai">
                        {entry.error ? (
                          <div className="error-inline">Analysis failed: {entry.error}</div>
                        ) : (
                          <>
                            <div className="findings-md">
                              <ReactMarkdown>{entry.result.findings}</ReactMarkdown>
                            </div>

                            {entry.result.analysis_depth === 'comprehensive' && (
                              <div className="analysis-badge">Comprehensive Analysis (Anomaly Detection + Forecasting + RFM + Drift)</div>
                            )}

                            {entry.result.data_summary?.stats && Object.keys(entry.result.data_summary.stats).length > 0 && (
                              <div className="metrics-strip">
                                {Object.entries(entry.result.data_summary.stats).map(([col, s]) => {
                                  const range = s.max - s.min;
                                  const meanPct = range > 0 ? ((s.mean - s.min) / range) * 100 : 50;
                                  return (
                                    <div key={col} className="metric-pill">
                                      <div className="metric-pill-header">
                                        <span className="metric-pill-name">{col.replace(/_/g, ' ')}</span>
                                        <span className="metric-pill-value">
                                          {s.mean >= 1000 ? `${(s.mean / 1000).toFixed(1)}k` : s.mean.toFixed(2)}
                                        </span>
                                      </div>
                                      <div className="metric-pill-bar">
                                        <div className="metric-pill-fill" style={{ width: `${meanPct}%` }} />
                                      </div>
                                      <div className="metric-pill-range">
                                        <span>{s.min >= 1000 ? `${(s.min / 1000).toFixed(1)}k` : s.min.toFixed(2)}</span>
                                        <span>{s.max >= 1000 ? `${(s.max / 1000).toFixed(1)}k` : s.max.toFixed(2)}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="conversation-turn">
                    <div className="msg msg-user">
                      <div className="msg-avatar user-avatar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      </div>
                      <div className="msg-bubble msg-bubble-user">{history.length === 0 ? question : history[history.length - 1]?.question}</div>
                    </div>
                    <div className="msg msg-ai">
                      <div className="msg-avatar ai-avatar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a4 4 0 014 4v1h2a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h2V6a4 4 0 014-4z"/><line x1="9" y1="14" x2="9" y2="14.01"/><line x1="15" y1="14" x2="15" y2="14.01"/></svg>
                      </div>
                      <div className="msg-bubble msg-bubble-ai">
                        <div className="skeleton-block">
                          <div className="skeleton-line w80" />
                          <div className="skeleton-line w60" />
                          <div className="skeleton-line w90" />
                          <div className="skeleton-line w45" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={resultsEndRef} />
              </div>

              {/* Input Bar - Fixed at Bottom */}
              <div className="input-bar">
                <div className="input-bar-inner">
                  <textarea
                    ref={textareaRef}
                    className="chat-input"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about your sales data..."
                    rows={1}
                    onInput={(e) => {
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                    }}
                  />
                  <button
                    className={`send-btn ${loading ? 'is-loading' : ''}`}
                    onClick={handleAnalyze}
                    disabled={loading || !question.trim()}
                    title="Analyze (Cmd+Enter)"
                  >
                    {loading ? (
                      <div className="send-spinner" />
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                    )}
                  </button>
                </div>
                <div className="input-hint">Press <kbd>Cmd</kbd> + <kbd>Enter</kbd> to send &middot; Use toolbar above for advanced analytics</div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
