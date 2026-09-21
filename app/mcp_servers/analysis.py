import pandas as pd
import numpy as np
from typing import Dict, List, Any


class AnalysisServer:
    """Compute statistics, trends, correlations"""

    @staticmethod
    def descriptive_stats(dataset_id: str, columns: List[str]) -> Dict[str, Any]:
        parquet_path = f"datasets/uploads/{dataset_id}/standardized.parquet"
        df = pd.read_parquet(parquet_path)

        stats = {}
        for col in columns:
            if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
                stats[col] = {
                    "mean": float(df[col].mean()),
                    "median": float(df[col].median()),
                    "std": float(df[col].std()),
                    "min": float(df[col].min()),
                    "max": float(df[col].max()),
                    "q25": float(df[col].quantile(0.25)),
                    "q75": float(df[col].quantile(0.75))
                }
        return stats

    @staticmethod
    def product_performance(dataset_id: str) -> Dict[str, Any]:
        parquet_path = f"datasets/uploads/{dataset_id}/standardized.parquet"
        df = pd.read_parquet(parquet_path)

        if 'product_name' in df.columns and 'revenue' in df.columns:
            product_stats = df.groupby('product_name').agg({
                'revenue': ['sum', 'count', 'mean'],
                'quantity_sold': 'sum'
            }).reset_index()
            product_stats.columns = ['product_name', 'total_revenue', 'transaction_count', 'avg_revenue', 'total_quantity']
            return product_stats.to_dict(orient="records")
        return {}

    @staticmethod
    def category_performance(dataset_id: str) -> Dict[str, Any]:
        parquet_path = f"datasets/uploads/{dataset_id}/standardized.parquet"
        df = pd.read_parquet(parquet_path)

        if 'category' in df.columns and 'revenue' in df.columns:
            cat_stats = df.groupby('category').agg({
                'revenue': ['sum', 'mean'],
                'quantity_sold': ['sum', 'mean'],
            }).reset_index()
            cat_stats.columns = ['category', 'total_revenue', 'avg_revenue', 'total_quantity', 'avg_quantity']
            return cat_stats.to_dict(orient="records")
        return {}

    @staticmethod
    def trends(dataset_id: str, date_col: str = 'date') -> Dict[str, Any]:
        parquet_path = f"datasets/uploads/{dataset_id}/standardized.parquet"
        df = pd.read_parquet(parquet_path)

        if date_col not in df.columns:
            return {"error": f"Column '{date_col}' not found"}

        df['date'] = pd.to_datetime(df[date_col])
        monthly = df.groupby(df['date'].dt.to_period('M')).agg({
            'revenue': 'sum',
            'quantity_sold': 'sum'
        })
        monthly.index = monthly.index.astype(str)
        return monthly.to_dict()

    @staticmethod
    def correlations(dataset_id: str) -> Dict[str, Any]:
        parquet_path = f"datasets/uploads/{dataset_id}/standardized.parquet"
        df = pd.read_parquet(parquet_path)
        numeric_df = df.select_dtypes(include=['number'])
        if len(numeric_df.columns) < 2:
            return {"error": "Not enough numeric columns for correlation"}
        corr = numeric_df.corr().to_dict()
        return corr
