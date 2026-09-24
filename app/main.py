from fastapi import FastAPI, UploadFile, HTTPException, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional
import os
import json
import uuid
from pathlib import Path
from datetime import datetime

from app.services.data_ingestion import DataIngestionService
from app.schemas.data import AnalysisRequest
from app.config import settings

app = FastAPI(title="E-Commerce Analysis Platform", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("datasets/uploads", exist_ok=True)
os.makedirs("datasets/processed", exist_ok=True)


# --- Request Schemas ---

class DatasetRequest(BaseModel):
    dataset_id: str

class ForecastRequest(BaseModel):
    dataset_id: str
    days: int = Field(default=30, ge=7, le=365)

class ProductForecastRequest(BaseModel):
    dataset_id: str
    product_name: str
    days: int = Field(default=30, ge=7, le=365)

class RootCauseRequest(BaseModel):
    dataset_id: str
    product_name: str

class PriceScenarioRequest(BaseModel):
    dataset_id: str
    product_name: str
    price_change_pct: float = Field(..., ge=-90, le=200)

class PromotionScenarioRequest(BaseModel):
    dataset_id: str
    product_name: str
    discount_pct: float = Field(..., ge=1, le=90)
    duration_days: int = Field(default=7, ge=1, le=90)

class BundleScenarioRequest(BaseModel):
    dataset_id: str
    product_1: str
    product_2: str


# --- Core Endpoints ---

@app.get("/")
async def root():
    return {
        "message": "E-Commerce Product Analysis System v2.0",
        "supported_formats": list(DataIngestionService.SUPPORTED_FORMATS.keys()),
        "endpoints": {
            "upload": "POST /api/datasets/upload",
            "analyze": "POST /api/analyze",
            "metadata": "GET /api/datasets/{dataset_id}/metadata",
            "anomalies": "POST /api/analyze/anomalies",
            "drift": "POST /api/analyze/drift",
            "forecast": "POST /api/analyze/forecast",
            "forecast_product": "POST /api/analyze/forecast-product",
            "root_cause": "POST /api/analyze/root-cause",
            "rfm": "POST /api/analyze/rfm",
            "scenario_price": "POST /api/analyze/scenario/price",
            "scenario_promotion": "POST /api/analyze/scenario/promotion",
            "scenario_bundle": "POST /api/analyze/scenario/bundle",
        },
    }


@app.post("/api/datasets/upload")
async def upload_dataset(file: UploadFile = File(...)):
    dataset_id = str(uuid.uuid4())
    upload_dir = f"datasets/uploads/{dataset_id}"
    os.makedirs(upload_dir, exist_ok=True)

    try:
        original_path = f"{upload_dir}/original{Path(file.filename).suffix}"
        content = await file.read()
        with open(original_path, "wb") as f:
            f.write(content)

        file_format = DataIngestionService.detect_format(file.filename)
        df = DataIngestionService.load_file(original_path)
        validation = DataIngestionService.validate_data(df)

        if not validation['is_valid']:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "errors": validation['issues']}
            )

        df_clean = DataIngestionService.standardize(df)
        schema = DataIngestionService.infer_schema(df_clean)

        parquet_path = f"{upload_dir}/standardized.parquet"
        df_clean.to_parquet(parquet_path, index=False)

        metadata = {
            'dataset_id': dataset_id,
            'original_filename': file.filename,
            'original_format': file_format,
            'row_count': len(df_clean),
            'column_count': len(df_clean.columns),
            'columns': list(df_clean.columns),
            'schema': schema,
            'validation': validation,
            'created_at': datetime.utcnow().isoformat()
        }

        with open(f"{upload_dir}/metadata.json", "w") as f:
            json.dump(metadata, f, indent=2)

        return {'status': 'success', 'dataset_id': dataset_id, 'metadata': metadata}

    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "error": str(e)}
        )


@app.get("/api/datasets/{dataset_id}/metadata")
async def get_dataset_metadata(dataset_id: str):
    metadata_path = f"datasets/uploads/{dataset_id}/metadata.json"
    if not os.path.exists(metadata_path):
        raise HTTPException(status_code=404, detail="Dataset not found")
    with open(metadata_path, "r") as f:
        metadata = json.load(f)
    return metadata


@app.post("/api/analyze")
async def analyze(request: AnalysisRequest):
    from app.services.orchestrator import GroqOrchestrator

    metadata_path = f"datasets/uploads/{request.dataset_id}/metadata.json"
    if not os.path.exists(metadata_path):
        raise HTTPException(status_code=404, detail="Dataset not found")

    orchestrator = GroqOrchestrator(api_key=settings.groq_api_key)
    result = await orchestrator.analyze(request.question, request.dataset_id)
    return {"status": "success", "result": result}


# --- Advanced Analytics Endpoints ---

def _check_dataset(dataset_id: str):
    path = f"datasets/uploads/{dataset_id}/standardized.parquet"
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Dataset not found")


@app.post("/api/analyze/anomalies")
async def detect_anomalies(request: DatasetRequest):
    _check_dataset(request.dataset_id)
    from app.mcp_servers.anomaly_detection import AnomalyDetectionServer
    try:
        result = AnomalyDetectionServer.detect_anomalies(request.dataset_id)
        return {"status": "success", "result": result}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "error": str(e)})


@app.post("/api/analyze/drift")
async def detect_drift(request: DatasetRequest):
    _check_dataset(request.dataset_id)
    from app.mcp_servers.anomaly_detection import AnomalyDetectionServer
    try:
        result = AnomalyDetectionServer.detect_data_drift(request.dataset_id)
        return {"status": "success", "result": result}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "error": str(e)})


@app.post("/api/analyze/forecast")
async def forecast_sales(request: ForecastRequest):
    _check_dataset(request.dataset_id)
    from app.mcp_servers.forecasting import ForecastingServer
    try:
        result = ForecastingServer.forecast_sales(request.dataset_id, request.days)
        return {"status": "success", "result": result}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "error": str(e)})


@app.post("/api/analyze/forecast-product")
async def forecast_product(request: ProductForecastRequest):
    _check_dataset(request.dataset_id)
    from app.mcp_servers.forecasting import ForecastingServer
    try:
        result = ForecastingServer.forecast_by_product(request.dataset_id, request.product_name, request.days)
        return {"status": "success", "result": result}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "error": str(e)})


@app.post("/api/analyze/root-cause")
async def analyze_root_cause(request: RootCauseRequest):
    _check_dataset(request.dataset_id)
    from app.mcp_servers.root_cause_analysis import RootCauseAnalysisServer
    try:
        result = RootCauseAnalysisServer.analyze_decline(request.dataset_id, request.product_name)
        return {"status": "success", "result": result}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "error": str(e)})


@app.post("/api/analyze/rfm")
async def rfm_analysis(request: DatasetRequest):
    _check_dataset(request.dataset_id)
    from app.mcp_servers.rfm_analysis import RFMServer
    try:
        result = RFMServer.rfm_analysis(request.dataset_id)
        return {"status": "success", "result": result}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "error": str(e)})


@app.post("/api/analyze/scenario/price")
async def simulate_price(request: PriceScenarioRequest):
    _check_dataset(request.dataset_id)
    from app.mcp_servers.scenario_planning import ScenarioPlanningServer
    try:
        result = ScenarioPlanningServer.simulate_price_change(request.dataset_id, request.product_name, request.price_change_pct)
        return {"status": "success", "result": result}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "error": str(e)})


@app.post("/api/analyze/scenario/promotion")
async def simulate_promotion(request: PromotionScenarioRequest):
    _check_dataset(request.dataset_id)
    from app.mcp_servers.scenario_planning import ScenarioPlanningServer
    try:
        result = ScenarioPlanningServer.simulate_promotion(request.dataset_id, request.product_name, request.discount_pct, request.duration_days)
        return {"status": "success", "result": result}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "error": str(e)})


@app.post("/api/analyze/scenario/bundle")
async def analyze_bundle(request: BundleScenarioRequest):
    _check_dataset(request.dataset_id)
    from app.mcp_servers.scenario_planning import ScenarioPlanningServer
    try:
        result = ScenarioPlanningServer.bundle_analysis(request.dataset_id, request.product_1, request.product_2)
        return {"status": "success", "result": result}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "error", "error": str(e)})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
