import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE = 'http://localhost:8000';

function App() {
  const [datasetId, setDatasetId] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [question, setQuestion] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setUploadStatus('Uploading...');
    setResults(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await axios.post(`${API_BASE}/api/datasets/upload`, formData);
      if (response.data.status === 'success') {
        setDatasetId(response.data.dataset_id);
        setMetadata(response.data.metadata);
        setUploadStatus('Upload successful!');
      }
    } catch (error) {
      const msg = error.response?.data?.error || error.response?.data?.errors?.join(', ') || error.message;
      setUploadStatus('Upload failed: ' + msg);
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
      alert('Analysis failed: ' + msg);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '2rem' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <h1 style={{ textAlign: 'center', color: 'white', fontSize: '2.5rem', marginBottom: '2rem' }}>
          E-Commerce Product Analysis
        </h1>

        {/* Upload Section */}
        <div style={cardStyle}>
          <h2 style={{ marginBottom: '1rem' }}>1. Upload Your Data</h2>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            Supported formats: CSV, Excel (.xlsx), JSON, Parquet
          </p>
          <input
            type="file"
            onChange={handleFileUpload}
            accept=".csv,.xlsx,.xls,.json,.parquet"
            style={{ display: 'block', width: '100%', padding: '1rem', border: '2px dashed #667eea', borderRadius: '8px', cursor: 'pointer' }}
          />
          {uploadStatus && (
            <p style={{ marginTop: '0.5rem', color: uploadStatus.includes('successful') ? 'green' : 'red', fontWeight: 'bold' }}>
              {uploadStatus}
            </p>
          )}
          {metadata && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#f7f7f7', borderRadius: '8px', fontSize: '0.9rem' }}>
              <strong>Dataset Summary:</strong> {metadata.row_count} rows, {metadata.column_count} columns
              <br />
              <strong>Columns:</strong> {metadata.columns.join(', ')}
              {metadata.validation.warnings.length > 0 && (
                <div style={{ color: '#b45309', marginTop: '0.5rem' }}>
                  Warnings: {metadata.validation.warnings.join('; ')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Analysis Section */}
        {datasetId && (
          <div style={cardStyle}>
            <h2 style={{ marginBottom: '1rem' }}>2. Ask a Question</h2>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., What products should I focus on? Which categories are growing? What are the best-selling items?"
              style={{ width: '100%', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px', minHeight: '80px', fontSize: '1rem', resize: 'vertical', boxSizing: 'border-box' }}
            />
            <button
              onClick={handleAnalyze}
              disabled={loading || !question.trim()}
              style={{
                width: '100%', padding: '0.75rem', marginTop: '1rem',
                background: loading ? '#999' : '#667eea', color: 'white',
                border: 'none', borderRadius: '8px', fontSize: '1.1rem',
                fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
        )}

        {/* Results Section */}
        {results && (
          <div style={cardStyle}>
            <h2 style={{ marginBottom: '1rem' }}>3. Results & Insights</h2>
            <div style={{ padding: '1rem', background: '#f0f4ff', borderRadius: '8px', marginBottom: '1rem' }}>
              <strong>Question:</strong> {results.question}
            </div>
            <div style={{ padding: '1rem', background: '#f7f7f7', borderRadius: '8px', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
              {results.findings}
            </div>
            {results.data_summary?.stats && Object.keys(results.data_summary.stats).length > 0 && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0fff4', borderRadius: '8px' }}>
                <strong>Key Metrics:</strong>
                <table style={{ width: '100%', marginTop: '0.5rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #ddd' }}>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Metric</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem' }}>Mean</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem' }}>Min</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem' }}>Max</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(results.data_summary.stats).map(([col, s]) => (
                      <tr key={col} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem' }}>{col}</td>
                        <td style={{ textAlign: 'right', padding: '0.5rem' }}>{s.mean?.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: '0.5rem' }}>{s.min?.toFixed(2)}</td>
                        <td style={{ textAlign: 'right', padding: '0.5rem' }}>{s.max?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle = {
  background: 'white',
  borderRadius: '12px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
  padding: '1.5rem',
  marginBottom: '1.5rem',
};

export default App;
