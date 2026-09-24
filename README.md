# E-Commerce Analysis System

An AI-powered e-commerce data analysis platform. Upload your sales data (CSV, Excel, JSON, or Parquet), ask questions in plain English, and get actionable insights with key metrics — instantly.

![Python](https://img.shields.io/badge/Python-3.11+-blue?logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-latest-009688?logo=fastapi&logoColor=white)
![Groq](https://img.shields.io/badge/LLM-Groq-orange)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

- **Natural Language Analysis** — Ask questions like "What should I focus on this quarter?" or "Which products are declining?" and get detailed, data-backed answers
- **Multi-Format Upload** — Supports CSV, Excel (.xlsx/.xls), JSON, and Parquet files with automatic validation
- **AI-Powered Insights** — Uses Groq LLM (Qwen 27B) to generate findings, trends, and actionable recommendations with real numbers from your data
- **Key Metrics Dashboard** — Automatic statistical summaries (mean, median, min/max, quartiles) for all numeric columns
- **Chat-Style Interface** — Conversational UI with full question history, inspired by ChatGPT and Julius AI
- **Dark / Light Theme** — Toggle between dark glassmorphism and clean light mode, with system preference detection and persistence
- **Responsive Design** — Works on desktop, tablet, and mobile
- **Docker Ready** — One-command deployment with Docker Compose

## Architecture

```
ecommerce-analysis-system/
├── app/                        # FastAPI backend
│   ├── main.py                 # API endpoints (upload, analyze, metadata)
│   ├── config.py               # Settings via pydantic-settings
│   ├── schemas/                # Pydantic request/response models
│   ├── services/
│   │   ├── data_ingestion.py   # File parsing, validation, standardization
│   │   └── orchestrator.py     # Groq LLM orchestration with data context
│   └── mcp_servers/            # Modular data processing servers
│       ├── data_retrieval.py   # Sample data & column extraction
│       ├── analysis.py         # Stats, product/category performance
│       ├── validation.py       # Result validation
│       └── visualization.py    # Visualization helpers
├── frontend/                   # React 19 frontend
│   └── src/
│       ├── App.js              # Main app with sidebar, chat UI, upload
│       ├── App.css             # Full design system (dark + light themes)
│       └── index.css           # Base styles
├── .env.example                # Environment variables template
├── Dockerfile                  # Backend container
├── docker-compose.yml          # Full-stack orchestration
├── requirements.txt            # Python dependencies
└── test_data.csv               # Sample dataset for testing
```

### How It Works

1. **Upload** — User uploads a dataset via the frontend. The backend parses, validates, and stores it as Parquet.
2. **Ask** — User types a question. The backend gathers data context (sample rows, column info, descriptive stats, product/category performance).
3. **Analyze** — The orchestrator sends the data context + question to Groq's LLM, which returns structured findings with specific numbers.
4. **Display** — The frontend renders the AI response as rich Markdown with inline metric cards.

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
2. Upload the included `test_data.csv` (sample e-commerce data)
3. Ask questions like:
   - "What are the top 5 products by revenue?"
   - "Which region is performing best?"
   - "What should I focus on this quarter?"

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
| `POST` | `/api/analyze` | Run AI analysis on a dataset |

### Example: Analyze

```bash
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"question": "Top 5 products by revenue", "dataset_id": "YOUR_ID", "analysis_type": "auto"}'
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, ReactMarkdown, Axios |
| Backend | FastAPI, Uvicorn, Pandas, NumPy |
| LLM | Groq API (Qwen 27B) |
| Data | Parquet (via PyArrow), scikit-learn, statsmodels |
| Deployment | Docker, Docker Compose |

## Sample Data

A `test_data.csv` is included with 12 rows of sample e-commerce transactions (products, categories, quantities, prices, revenue, regions) for quick testing.

## License

MIT
