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
  { icon: '\u{1F4C8}', text: "Revenue trend over time" },
];

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
                  Upload your sales data and ask questions in plain English. Get actionable insights, trends, and recommendations instantly.
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
                    Instant analysis
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
                    <p>Try one of these to get started</p>
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
                <div className="input-hint">Press <kbd>Cmd</kbd> + <kbd>Enter</kbd> to send</div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
