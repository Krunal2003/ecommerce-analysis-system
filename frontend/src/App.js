import React, { useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import './App.css';

const API_BASE = 'http://localhost:8000';

const QUICK_QUESTIONS = [
  "What should I focus on this quarter?",
  "Which products are declining?",
  "Compare Electronics vs Accessories",
  "Top 5 products by revenue",
];

function App() {
  const [datasetId, setDatasetId] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [question, setQuestion] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [fileName, setFileName] = useState('');

  const currentStep = !datasetId ? 1 : !results && !loading ? 2 : 3;

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFileName(selectedFile.name);
    setUploadStatus('uploading');
    setResults(null);
    setMetadata(null);
    setDatasetId(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

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

  const handleAnalyze = async () => {
    if (!datasetId || !question.trim()) return;
    setLoading(true);
    setResults(null);

    try {
      const response = await axios.post(`${API_BASE}/api/analyze`, {
        question,
        dataset_id: datasetId,
        analysis_type: 'auto'
      });
      setResults(response.data.result);
    } catch (error) {
      const msg = error.response?.data?.detail || error.message;
      setUploadStatus('error: Analysis failed - ' + msg);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleAnalyze();
    }
  };

  return (
    <div className="app-bg">
      <div className="app-container">
        {/* Header */}
        <div className="header">
          <div className="header-icon">&#x1f4ca;</div>
          <h1>E-Commerce Analyzer</h1>
          <p>AI-powered product analysis &amp; recommendations</p>
        </div>

        {/* Step Indicators */}
        <div className="steps">
          {[
            { n: 1, label: 'Upload' },
            { n: 2, label: 'Analyze' },
            { n: 3, label: 'Insights' },
          ].map(({ n, label }) => (
            <div
              key={n}
              className={`step-pill ${n === currentStep ? 'active' : ''} ${n < currentStep ? 'done' : ''}`}
            >
              <span className="step-num">{n < currentStep ? '\u2713' : n}</span>
              {label}
            </div>
          ))}
        </div>

        {/* Upload Card */}
        <div className="card" style={{ animationDelay: '0.1s' }}>
          <div className="card-title">
            <span>&#x1f4c1;</span> Upload Dataset
          </div>
          <div className="card-subtitle">
            Drop your sales data and let AI do the heavy lifting
          </div>

          <div className={`upload-zone ${datasetId ? 'has-file' : ''}`}>
            <input
              type="file"
              onChange={handleFileUpload}
              accept=".csv,.xlsx,.xls,.json,.parquet"
            />
            <div className="upload-icon">
              {datasetId ? '\u2705' : '\u2601\ufe0f'}
            </div>
            <h3>{datasetId ? fileName : 'Click to upload or drag & drop'}</h3>
            <p>{datasetId ? 'File loaded successfully' : 'Choose a file from your computer'}</p>
            <div className="format-tags">
              {['CSV', 'Excel', 'JSON', 'Parquet'].map(f => (
                <span key={f} className="format-tag">{f}</span>
              ))}
            </div>
          </div>

          {uploadStatus === 'uploading' && (
            <div style={{ marginTop: '1rem' }}>
              <span className="status-badge uploading">
                <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, margin: 0 }}></span>
                Processing...
              </span>
            </div>
          )}

          {uploadStatus.startsWith('error') && (
            <div style={{ marginTop: '1rem' }}>
              <span className="status-badge error">&#x26a0; {uploadStatus.replace('error: ', '')}</span>
            </div>
          )}

          {metadata && (
            <div className="dataset-info">
              <div className="dataset-stats">
                <div className="stat-box">
                  <div className="stat-value">{metadata.row_count.toLocaleString()}</div>
                  <div className="stat-label">Rows</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{metadata.column_count}</div>
                  <div className="stat-label">Columns</div>
                </div>
                <div className="stat-box">
                  <div className="stat-value">{metadata.validation.duplicate_rows}</div>
                  <div className="stat-label">Duplicates</div>
                </div>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>Detected columns:</div>
              <div className="columns-list">
                {metadata.columns.map(col => (
                  <span key={col} className="col-chip">{col}</span>
                ))}
              </div>
              {metadata.validation.warnings.length > 0 && (
                <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--warning)' }}>
                  &#x26a0; {metadata.validation.warnings.join(' | ')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Analysis Card */}
        {datasetId && (
          <div className="card" style={{ animationDelay: '0.2s' }}>
            <div className="card-title">
              <span>&#x1f9e0;</span> Ask Your Data
            </div>
            <div className="card-subtitle">
              Type a question or pick one below &mdash; press Cmd+Enter to analyze
            </div>

            <textarea
              className="question-area"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., What products should I stock up on? Which categories need a promo? What's my best margin product?"
            />

            <div className="quick-questions">
              {QUICK_QUESTIONS.map(q => (
                <button
                  key={q}
                  className="quick-q"
                  onClick={() => setQuestion(q)}
                >
                  {q}
                </button>
              ))}
            </div>

            <button
              className={`analyze-btn ${loading ? 'loading' : ''}`}
              onClick={handleAnalyze}
              disabled={loading || !question.trim()}
            >
              {loading ? 'Analyzing your data...' : 'Analyze with AI'}
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="card">
            <div className="loading-container">
              <div className="spinner"></div>
              <div style={{ color: 'var(--text-dim)', fontSize: '0.95rem' }}>
                Crunching numbers &amp; generating insights
              </div>
              <div className="loading-dots">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="card results-card" style={{ animationDelay: '0.1s' }}>
            <div className="card-title">
              <span>&#x2728;</span> Analysis Results
              <span className="status-badge success" style={{ marginLeft: 'auto' }}>&#x2713; Complete</span>
            </div>

            <div className="question-badge">
              <strong>Q:</strong> {results.question}
            </div>

            <div className="findings-content">
              <ReactMarkdown>{results.findings}</ReactMarkdown>
            </div>

            {/* Metrics Cards */}
            {results.data_summary?.stats && Object.keys(results.data_summary.stats).length > 0 && (
              <div className="metrics-section">
                <div className="metrics-title">
                  <span>&#x1f4ca;</span> Key Metrics
                </div>
                <div className="metrics-grid">
                  {Object.entries(results.data_summary.stats).map(([col, s]) => {
                    const range = s.max - s.min;
                    const meanPct = range > 0 ? ((s.mean - s.min) / range) * 100 : 50;
                    return (
                      <div key={col} className="metric-card">
                        <div className="metric-name">{col.replace(/_/g, ' ')}</div>
                        <div className="metric-value">
                          {s.mean >= 1000 ? `${(s.mean / 1000).toFixed(1)}k` : s.mean.toFixed(2)}
                        </div>
                        <div className="metric-bar">
                          <div className="metric-bar-fill" style={{ width: `${meanPct}%` }}></div>
                        </div>
                        <div className="metric-range">
                          <span>Min: {s.min >= 1000 ? `${(s.min / 1000).toFixed(1)}k` : s.min.toFixed(2)}</span>
                          <span>Max: {s.max >= 1000 ? `${(s.max / 1000).toFixed(1)}k` : s.max.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
