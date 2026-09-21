import pandas as pd
import json
from pathlib import Path
from typing import Dict, Any


class DataIngestionService:
    """Handle multiple data formats: CSV, Excel, JSON, Parquet"""

    SUPPORTED_FORMATS = {
        '.csv': 'csv',
        '.xlsx': 'excel',
        '.xls': 'excel',
        '.json': 'json',
        '.parquet': 'parquet',
        '.tsv': 'csv',
    }

    @staticmethod
    def detect_format(filename: str) -> str:
        ext = Path(filename).suffix.lower()
        if ext not in DataIngestionService.SUPPORTED_FORMATS:
            raise ValueError(
                f"Unsupported format: {ext}. "
                f"Supported: {', '.join(DataIngestionService.SUPPORTED_FORMATS.keys())}"
            )
        return DataIngestionService.SUPPORTED_FORMATS[ext]

    @staticmethod
    def load_file(filepath: str) -> pd.DataFrame:
        format_type = DataIngestionService.detect_format(filepath)

        try:
            if format_type == 'csv':
                try:
                    df = pd.read_csv(filepath, encoding='utf-8')
                except UnicodeDecodeError:
                    df = pd.read_csv(filepath, encoding='latin-1')
            elif format_type == 'excel':
                df = pd.read_excel(filepath)
            elif format_type == 'json':
                df = pd.read_json(filepath)
            elif format_type == 'parquet':
                df = pd.read_parquet(filepath)
            else:
                raise ValueError(f"Cannot load format: {format_type}")
            return df
        except Exception as e:
            raise ValueError(f"Error loading {format_type} file: {str(e)}")

    @staticmethod
    def infer_schema(df: pd.DataFrame) -> Dict[str, Any]:
        schema = {}
        for col in df.columns:
            dtype = df[col].dtype
            missing_pct = (df[col].isnull().sum() / len(df) * 100) if len(df) > 0 else 0

            if dtype == 'object':
                try:
                    parsed = pd.to_datetime(df[col], errors='coerce')
                    if parsed.notna().sum() > len(df) * 0.5:
                        col_type = 'datetime'
                    else:
                        col_type = 'categorical'
                except Exception:
                    col_type = 'categorical'
            elif dtype in ['int64', 'int32', 'int16', 'float64', 'float32']:
                col_type = 'numeric'
            else:
                col_type = 'other'

            schema[col] = {
                'type': col_type,
                'dtype': str(dtype),
                'missing_values': int(df[col].isnull().sum()),
                'missing_percent': round(missing_pct, 2),
                'unique_values': int(df[col].nunique()),
                'sample_value': str(df[col].iloc[0]) if len(df) > 0 else None
            }
        return schema

    @staticmethod
    def validate_data(df: pd.DataFrame) -> Dict[str, Any]:
        issues = []
        warnings = []

        if len(df) == 0:
            issues.append("Dataset has no rows")
        if len(df.columns) == 0:
            issues.append("Dataset has no columns")

        dup_count = 0
        if len(df) > 0:
            for col in df.columns:
                missing_pct = df[col].isnull().sum() / len(df) * 100
                if missing_pct > 80:
                    issues.append(f"Column '{col}' is {missing_pct:.1f}% empty (too much)")
                elif missing_pct > 50:
                    warnings.append(f"Column '{col}' is {missing_pct:.1f}% empty")

            dup_count = int(df.duplicated().sum())
            if dup_count > 0:
                warnings.append(f"{dup_count} duplicate rows found")

            for col in df.columns:
                if df[col].nunique() == 1:
                    warnings.append(f"Column '{col}' has only 1 unique value")

        return {
            'is_valid': len(issues) == 0,
            'issues': issues,
            'warnings': warnings,
            'row_count': len(df),
            'column_count': len(df.columns),
            'duplicate_rows': dup_count
        }

    @staticmethod
    def standardize(df: pd.DataFrame) -> pd.DataFrame:
        df_clean = df.copy()
        df_clean = df_clean.dropna(axis=1, how='all')

        numeric_cols = df_clean.select_dtypes(include=['number']).columns
        for col in numeric_cols:
            if df_clean[col].isnull().any():
                df_clean[col] = df_clean[col].fillna(df_clean[col].median())

        categorical_cols = df_clean.select_dtypes(include=['object']).columns
        for col in categorical_cols:
            if df_clean[col].isnull().any():
                df_clean[col] = df_clean[col].fillna('Unknown')

        df_clean.columns = [
            col.lower().replace(' ', '_').replace('-', '_')
            for col in df_clean.columns
        ]
        return df_clean
