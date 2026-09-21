from fastapi import FastAPI, UploadFile, HTTPException, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import json
import uuid
from pathlib import Path
from datetime import datetime

from app.services.data_ingestion import DataIngestionService
from app.schemas.data import AnalysisRequest
from app.config import settings

app = FastAPI(title="E-Commerce Analysis Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("datasets/uploads", exist_ok=True)
os.makedirs("datasets/processed", exist_ok=True)


@app.get("/")
async def root():
    return {
        "message": "E-Commerce Product Analysis System",
        "supported_formats": list(DataIngestionService.SUPPORTED_FORMATS.keys()),
        "endpoints": {
            "upload": "POST /api/datasets/upload",
            "analyze": "POST /api/analyze",
            "metadata": "GET /api/datasets/{dataset_id}/metadata"
        }
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
