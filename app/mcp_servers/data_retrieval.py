import pandas as pd
from typing import List, Dict


class DataRetrievalServer:
    """Load and query standardized datasets"""

    @staticmethod
    def load_dataset(dataset_id: str, filters: dict = None) -> List[Dict]:
        parquet_path = f"datasets/uploads/{dataset_id}/standardized.parquet"
        df = pd.read_parquet(parquet_path)
        if filters:
            for col, val in filters.items():
                if col in df.columns:
                    df = df[df[col] == val]
        return df.to_dict(orient="records")

    @staticmethod
    def get_columns(dataset_id: str) -> List[str]:
        parquet_path = f"datasets/uploads/{dataset_id}/standardized.parquet"
        df = pd.read_parquet(parquet_path)
        return list(df.columns)

    @staticmethod
    def get_sample(dataset_id: str, rows: int = 5) -> List[Dict]:
        parquet_path = f"datasets/uploads/{dataset_id}/standardized.parquet"
        df = pd.read_parquet(parquet_path)
        return df.head(rows).to_dict(orient="records")
