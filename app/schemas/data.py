from pydantic import BaseModel, Field
from typing import Dict, List, Any


class DatasetMetadata(BaseModel):
    dataset_id: str
    original_filename: str
    original_format: str
    row_count: int
    column_count: int
    columns: List[str]
    schema_info: Dict[str, Any] = Field(alias="schema")
    validation: Dict[str, Any]
    created_at: str


class AnalysisRequest(BaseModel):
    question: str = Field(..., min_length=5, max_length=500)
    dataset_id: str
    analysis_type: str = "auto"


class InsightResponse(BaseModel):
    findings: str
    recommendations: List[Dict[str, Any]]
    visualizations: List[Dict[str, str]]
    metrics: Dict[str, float]
    confidence: float = Field(..., ge=0, le=1)
    caveats: List[str] = []
