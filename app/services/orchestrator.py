import json
from groq import Groq
from typing import Dict, Any

from app.mcp_servers.data_retrieval import DataRetrievalServer
from app.mcp_servers.analysis import AnalysisServer
from app.mcp_servers.visualization import VisualizationServer
from app.mcp_servers.validation import ValidationServer
from app.mcp_servers.anomaly_detection import AnomalyDetectionServer
from app.mcp_servers.forecasting import ForecastingServer
from app.mcp_servers.root_cause_analysis import RootCauseAnalysisServer
from app.mcp_servers.rfm_analysis import RFMServer
from app.mcp_servers.scenario_planning import ScenarioPlanningServer


class GroqOrchestrator:
    """Orchestrate comprehensive multi-tool analysis via Groq LLM"""

    def __init__(self, api_key: str):
        self.client = Groq(api_key=api_key)
        self.model = "qwen/qwen3.8-27b"

    async def analyze(self, question: str, dataset_id: str) -> Dict[str, Any]:
        # 1. Gather base data context
        sample = DataRetrievalServer.get_sample(dataset_id, rows=10)
        columns = DataRetrievalServer.get_columns(dataset_id)

        numeric_cols = []
        for row in sample:
            for k, v in row.items():
                if isinstance(v, (int, float)) and k not in numeric_cols:
                    numeric_cols.append(k)
        stats = AnalysisServer.descriptive_stats(dataset_id, numeric_cols) if numeric_cols else {}

        data_context = (
            f"Dataset columns: {columns}\n"
            f"Sample data (first 5 rows): {json.dumps(sample[:5], default=str)}\n"
            f"Descriptive statistics: {json.dumps(stats, default=str)}\n"
        )

        # Product/category performance
        product_perf = AnalysisServer.product_performance(dataset_id)
        category_perf = AnalysisServer.category_performance(dataset_id)
        if product_perf:
            data_context += f"\nProduct performance: {json.dumps(product_perf[:10], default=str)}"
        if category_perf:
            data_context += f"\nCategory performance: {json.dumps(category_perf, default=str)}"

        # 2. Run advanced analyses and add to context
        advanced_context = self._gather_advanced_context(question, dataset_id, product_perf)
        if advanced_context:
            data_context += "\n\n--- ADVANCED ANALYTICS ---\n" + advanced_context

        # 3. Build messages
        system = """You are an advanced e-commerce data analyst with expertise in statistical analysis, forecasting, and strategic planning.

You have access to real data and advanced analytics results including:
- Anomaly Detection (Isolation Forest)
- Sales Forecasting (polynomial regression with confidence intervals)
- RFM Segmentation (Recency/Frequency/Monetary product scoring)
- Root Cause Analysis (when products decline)
- What-If Scenario Planning (pricing, promotions, bundling)

ANALYSIS APPROACH:
1. ASSESS data quality first (anomalies, drift)
2. ANALYZE current performance with specific numbers
3. FORECAST future trends where data supports it
4. EXPLAIN root causes for any declines or anomalies
5. SEGMENT products using RFM insights
6. RECOMMEND concrete actions with projected impact

RULES:
- Always cite specific numbers from the data
- When referencing advanced analytics, explain what they mean in business terms
- Provide at least 3 actionable recommendations
- Quantify expected impact where possible
- Note any caveats or data limitations"""

        user_message = f"""Analyze this e-commerce dataset.

{data_context}

User Question: {question}

Provide:
1. Key findings with specific numbers
2. Advanced analytics insights (anomalies, forecasts, segmentation)
3. Root cause analysis for any concerning trends
4. Actionable recommendations (at least 3) with projected impact
5. Any caveats or limitations"""

        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user_message},
        ]

        max_iterations = 3
        findings = ""
        for iteration in range(max_iterations):
            response = self.client.chat.completions.create(
                model=self.model,
                max_tokens=2000,
                messages=messages,
            )

            assistant_message = response.choices[0].message.content
            findings = assistant_message
            messages.append({"role": "assistant", "content": assistant_message})

            if "recommendation" in assistant_message.lower() or iteration == max_iterations - 1:
                break

            messages.append({
                "role": "user",
                "content": "Continue your analysis. Provide more specific recommendations with projected impact.",
            })

        validation = ValidationServer.validate_results(stats)

        return {
            "findings": findings,
            "dataset_id": dataset_id,
            "question": question,
            "data_summary": {
                "columns": columns,
                "stats": stats,
            },
            "validation": validation,
            "status": "completed",
            "analysis_depth": "comprehensive",
        }

    def _gather_advanced_context(self, question: str, dataset_id: str, product_perf) -> str:
        """Run relevant advanced analyses based on the question context"""
        parts = []
        q_lower = question.lower()

        # Always run anomaly detection for data quality
        try:
            anomalies = AnomalyDetectionServer.detect_anomalies(dataset_id)
            if "error" not in anomalies:
                parts.append(
                    f"ANOMALY DETECTION: {anomalies['anomalies_detected']} anomalies found "
                    f"({anomalies['anomaly_percentage']}% of data). "
                    f"Summary: {json.dumps(anomalies['summary'], default=str)}"
                )
        except Exception:
            pass

        # Run forecasting if question relates to future/trends/forecast
        forecast_keywords = ["forecast", "predict", "future", "trend", "next", "growth", "project", "expect", "outlook"]
        if any(kw in q_lower for kw in forecast_keywords) or True:  # always useful context
            try:
                forecast = ForecastingServer.forecast_sales(dataset_id, days_ahead=30)
                if "error" not in forecast:
                    parts.append(
                        f"30-DAY FORECAST: Direction={forecast['trend']['direction']}, "
                        f"Change={forecast['trend']['change_percent']}%, "
                        f"Current daily avg=${forecast['trend']['current_daily_avg']}, "
                        f"Forecast daily avg=${forecast['trend']['forecast_daily_avg']}, "
                        f"Model R2={forecast['r2_score']}"
                    )
            except Exception:
                pass

        # Run RFM if question relates to products/segments/focus/priority
        rfm_keywords = ["rfm", "segment", "focus", "priorit", "best", "worst", "champion", "risk", "score", "rank"]
        if any(kw in q_lower for kw in rfm_keywords) or True:  # always useful
            try:
                rfm = RFMServer.rfm_analysis(dataset_id)
                if "error" not in rfm:
                    parts.append(
                        f"RFM SEGMENTATION ({rfm['total_products']} products): "
                        f"{json.dumps(rfm['summary'], default=str)}. "
                        f"Top products: {json.dumps(rfm['rfm_analysis'][:5], default=str)}"
                    )
            except Exception:
                pass

        # Run drift detection
        try:
            drift = AnomalyDetectionServer.detect_data_drift(dataset_id)
            if "error" not in drift:
                parts.append(
                    f"DATA DRIFT: {'Drift detected!' if drift['overall_drift_detected'] else 'No significant drift'}. "
                    f"Details: {json.dumps(drift['drifts'], default=str)}"
                )
        except Exception:
            pass

        # Run root cause analysis for declining products
        decline_keywords = ["declin", "drop", "fall", "down", "why", "cause", "reason", "problem", "issue"]
        if any(kw in q_lower for kw in decline_keywords) and product_perf:
            try:
                # Find the worst-performing product to analyze
                sorted_prods = sorted(product_perf, key=lambda x: x.get("total_revenue", 0))
                if sorted_prods:
                    worst = sorted_prods[0]["product_name"]
                    rca = RootCauseAnalysisServer.analyze_decline(dataset_id, worst)
                    if "error" not in rca:
                        parts.append(
                            f"ROOT CAUSE ANALYSIS for '{worst}': "
                            f"Revenue change={rca['revenue_change_percent']}%. "
                            f"Likely causes: {json.dumps(rca['likely_causes_ranked'], default=str)}. "
                            f"Recommendation: {rca['recommendation']}"
                        )
            except Exception:
                pass

        return "\n\n".join(parts)
