import json
from groq import Groq
from typing import Dict, Any

from app.mcp_servers.data_retrieval import DataRetrievalServer
from app.mcp_servers.analysis import AnalysisServer
from app.mcp_servers.visualization import VisualizationServer
from app.mcp_servers.validation import ValidationServer


class GroqOrchestrator:
    """Use Groq to orchestrate analysis with real data context"""

    def __init__(self, api_key: str):
        self.client = Groq(api_key=api_key)
        self.model = "qwen/qwen3.8-27b"

    async def analyze(self, question: str, dataset_id: str) -> Dict[str, Any]:
        # Gather real data context
        sample = DataRetrievalServer.get_sample(dataset_id, rows=10)
        columns = DataRetrievalServer.get_columns(dataset_id)

        # Get stats for numeric columns
        numeric_cols = []
        for row in sample:
            for k, v in row.items():
                if isinstance(v, (int, float)) and k not in numeric_cols:
                    numeric_cols.append(k)
        stats = AnalysisServer.descriptive_stats(dataset_id, numeric_cols) if numeric_cols else {}

        # Build context
        data_context = (
            f"Dataset columns: {columns}\n"
            f"Sample data (first 10 rows): {json.dumps(sample[:5], default=str)}\n"
            f"Statistics: {json.dumps(stats, default=str)}\n"
        )

        # Try product/category performance if applicable
        product_perf = AnalysisServer.product_performance(dataset_id)
        category_perf = AnalysisServer.category_performance(dataset_id)
        if product_perf:
            data_context += f"\nProduct performance: {json.dumps(product_perf[:10], default=str)}"
        if category_perf:
            data_context += f"\nCategory performance: {json.dumps(category_perf, default=str)}"

        system = """You are a data analysis expert specializing in e-commerce sales data.
Analyze the provided data and give specific, actionable insights.

When analyzing:
1. THINK: Understand the question
2. PLAN: What analysis is needed
3. EXECUTE: Use the data provided
4. INTERPRET: Explain findings with specific numbers
5. RECOMMEND: Suggest concrete actions

Be specific. Use actual numbers from the data. Provide actionable recommendations."""

        user_message = f"""Analyze this e-commerce dataset.

{data_context}

User Question: {question}

Provide:
1. Key findings with specific numbers
2. Trends or patterns you see
3. Actionable recommendations (at least 3)
4. Any concerns or caveats"""

        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user_message},
        ]

        max_iterations = 3
        findings = ""
        for iteration in range(max_iterations):
            response = self.client.chat.completions.create(
                model=self.model,
                max_tokens=1500,
                messages=messages
            )

            assistant_message = response.choices[0].message.content
            findings = assistant_message
            messages.append({"role": "assistant", "content": assistant_message})

            if "recommendation" in assistant_message.lower() or iteration == max_iterations - 1:
                break

            messages.append({
                "role": "user",
                "content": "Continue your analysis. Provide more specific recommendations."
            })

        # Validate the output
        validation = ValidationServer.validate_results(stats)

        return {
            "findings": findings,
            "dataset_id": dataset_id,
            "question": question,
            "data_summary": {
                "columns": columns,
                "stats": stats
            },
            "validation": validation,
            "status": "completed"
        }
