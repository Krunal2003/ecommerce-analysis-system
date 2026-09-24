# E-Commerce Analysis System

An AI-powered strategic analytics platform for e-commerce data. Upload your sales data, ask questions in plain English, and get actionable insights with anomaly detection, predictive forecasting, RFM segmentation, root cause analysis, and what-if scenario simulation.

![Python](https://img.shields.io/badge/Python-3.11+-blue?logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-latest-009688?logo=fastapi&logoColor=white)
![Groq](https://img.shields.io/badge/LLM-Groq-orange)
![scikit--learn](https://img.shields.io/badge/ML-scikit--learn-F7931E?logo=scikitlearn&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

### Core
- **Natural Language Analysis** -- Ask questions like "What should I focus on this quarter?" and get detailed, data-backed answers
- **Multi-Format Upload** -- Supports CSV, Excel (.xlsx/.xls), JSON, and Parquet files with automatic validation
- **AI-Powered Insights** -- Groq LLM (Qwen 27B) generates findings, trends, and actionable recommendations with real numbers
- **Chat-Style Interface** -- Conversational UI with full question history

### Advanced Analytics
- **Anomaly Detection** -- Isolation Forest algorithm spots unusual sales patterns and outliers with anomaly scoring
- **Sales Forecasting** -- Polynomial regression predicts future sales with confidence intervals and trend analysis
- **RFM Segmentation** -- Scores products on Recency, Frequency, and Monetary value; segments into Champions, Loyal, Promising, At Risk, Lost
- **Root Cause Analysis** -- Explains WHY a product is declining by checking seasonality, pricing, competition, and volume changes
- **What-If Scenario Simulator** -- Simulate price changes (elasticity model), promotions (volume lift + retention), and product bundling
- **Data Drift Detection** -- Compares early vs late periods to detect shifts in revenue, quantity, or pricing patterns

### UI/UX
- **Advanced Analytics Toolbar** -- One-click access to all analytics directly from the workspace
- **Interactive What-If Panel** -- Configure and run simulations with real-time projected impact
- **RFM Table with Actions** -- Click "Analyze" on any product to trigger root cause analysis
- **Dark / Light Theme** -- Glassmorphism design with system preference detection
- **Responsive Design** -- Works on desktop, tablet, and mobile
- **Docker Ready** -- One-command deployment with Docker Compose

## Architecture

```
ecommerce-analysis-system/
├── app/                            # FastAPI backend
│   ├── main.py                     # API endpoints (15 endpoints)
│   ├── config.py                   # Settings via pydantic-settings
│   ├── schemas/                    # Pydantic request/response models
│   ├── services/
│   │   ├── data_ingestion.py       # File parsing, validation, standardization
│   │   └── orchestrator.py         # Enhanced Groq LLM orchestration (multi-tool)
│   └── mcp_servers/                # Modular analysis servers
│       ├── data_retrieval.py       # Sample data & column extraction
│       ├── analysis.py             # Descriptive stats, product/category perf
│       ├── visualization.py        # Plotly chart generation
│       ├── validation.py           # Result validation
│       ├── anomaly_detection.py    # Isolation Forest + data drift
│       ├── forecasting.py          # Polynomial regression forecasting
│       ├── root_cause_analysis.py  # Multi-factor decline analysis
│       ├── rfm_analysis.py         # RFM scoring & segmentation
│       └── scenario_planning.py    # Price/promotion/bundle simulation
├── frontend/                       # React 19 frontend
│   └── src/
│       ├── App.js                  # Main app with advanced analytics UI
│       ├── App.css                 # Full design system (dark + light themes)
│       └── index.css               # Base styles
├── test_data.csv                   # 2,200+ row sample dataset (9 months)
├── .env.example                    # Environment variables template
├── Dockerfile                      # Backend container
├── docker-compose.yml              # Full-stack orchestration
└── requirements.txt                # Python dependencies
```

### How It Works

```
User Question
    |
Groq Agent Orchestrator
    |
    ├── Data Retrieval Server (load data)
    ├── Analysis Server (descriptive stats, performance)
    ├── Anomaly Detection (Isolation Forest outlier detection)
    ├── Forecasting (polynomial regression + confidence intervals)
    ├── Root Cause Analysis (seasonality, pricing, competition, volume)
    ├── RFM Analysis (product scoring & segmentation)
    ├── Scenario Planning (price/promotion/bundle simulation)
    └── Validation Server (check results)
    |
Findings + Recommendations + Predictions + Explanations
```

1. **Upload** -- User uploads a dataset. The backend parses, validates, and stores it as Parquet.
2. **Ask** -- User types a question. The orchestrator gathers data context from all relevant analysis servers.
3. **Analyze** -- The orchestrator sends enriched context (stats + anomalies + forecast + RFM + drift) to Groq's LLM.
4. **Display** -- The frontend renders AI findings as rich Markdown with metric cards and interactive analytics panels.

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- A [Groq API key](https://console.groq.com/) (free tier available)

### 1. Clone the repo

```bash
git clone https://github.com/Krunal2003/ecommerce-analysis-system.git
cd ecommerce-analysis-system
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and add your Groq API key:

```env
GROQ_API_KEY=your_groq_api_key_here
```

> **How to get a free Groq API key:**
> 1. Go to [console.groq.com](https://console.groq.com/)
> 2. Sign up for a free account
> 3. Navigate to **API Keys** in the sidebar
> 4. Click **Create API Key** and copy it

### 3. Backend setup

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Start the backend:

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Frontend setup

Open a new terminal:

```bash
cd frontend
npm install
npm start
```

The app opens at **http://localhost:3000**.

### 5. Try it out

1. Open http://localhost:3000 in your browser
2. Upload the included `test_data.csv` (2,200+ rows of e-commerce data spanning 9 months)
3. Use the **Advanced Analytics toolbar** to run:
   - Anomaly Detection -- find outliers in your data
   - 30-Day Forecast -- predict future revenue trends
   - RFM Segmentation -- see which products are Champions vs At Risk
   - Data Drift -- check if sales patterns have shifted
   - What-If Simulator -- test price changes, promotions, or bundles
4. Ask questions like:
   - "What are the top 5 products by revenue?"
   - "Which products are declining and why?"
   - "What should I focus on this quarter?"
   - "Revenue trend and 30-day forecast"

### Docker (alternative)

```bash
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
docker-compose up --build
```

Backend at `localhost:8000`, frontend at `localhost:3000`.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check & API info |
| `POST` | `/api/datasets/upload` | Upload a dataset file |
| `GET` | `/api/datasets/{id}/metadata` | Get dataset metadata |
| `POST` | `/api/analyze` | Run AI analysis (comprehensive) |
| `POST` | `/api/analyze/anomalies` | Detect anomalies (Isolation Forest) |
| `POST` | `/api/analyze/drift` | Detect data drift over time |
| `POST` | `/api/analyze/forecast` | Forecast overall sales (N days) |
| `POST` | `/api/analyze/forecast-product` | Forecast specific product sales |
| `POST` | `/api/analyze/root-cause` | Root cause analysis for a product |
| `POST` | `/api/analyze/rfm` | RFM segmentation for all products |
| `POST` | `/api/analyze/scenario/price` | Simulate price change impact |
| `POST` | `/api/analyze/scenario/promotion` | Simulate promotion impact |
| `POST` | `/api/analyze/scenario/bundle` | Simulate product bundling |

### Example: Analyze

```bash
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"question": "Top 5 products by revenue", "dataset_id": "YOUR_ID", "analysis_type": "auto"}'
```

### Example: Forecast

```bash
curl -X POST http://localhost:8000/api/analyze/forecast \
  -H "Content-Type: application/json" \
  -d '{"dataset_id": "YOUR_ID", "days": 30}'
```

### Example: What-If Price Change

```bash
curl -X POST http://localhost:8000/api/analyze/scenario/price \
  -H "Content-Type: application/json" \
  -d '{"dataset_id": "YOUR_ID", "product_name": "Wireless Headphones", "price_change_pct": 10}'
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, ReactMarkdown, Axios |
| Backend | FastAPI, Uvicorn, Pandas, NumPy |
| ML/Analytics | scikit-learn (Isolation Forest, PolynomialFeatures, LinearRegression) |
| LLM | Groq API (Qwen 27B) |
| Data | Parquet (via PyArrow) |
| Deployment | Docker, Docker Compose |

## Sample Data

A `test_data.csv` is included with 2,200+ rows of e-commerce transactions spanning 9 months (Jan-Sep 2025). It contains 12 products across 3 categories (Electronics, Accessories, Office) with realistic seasonal patterns, growth/decline trends, and intentional anomalies for testing.

## License

MIT
