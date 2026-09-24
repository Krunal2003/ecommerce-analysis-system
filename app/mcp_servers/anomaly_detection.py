import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from typing import Dict, Any


class AnomalyDetectionServer:
    """Detect unusual sales patterns and outliers using Isolation Forest"""

    @staticmethod
    def detect_anomalies(dataset_id: str, contamination: float = 0.05) -> Dict[str, Any]:
        parquet_path = f"datasets/uploads/{dataset_id}/standardized.parquet"
        df = pd.read_parquet(parquet_path)

        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if len(numeric_cols) < 2:
            return {"error": "Need at least 2 numeric columns for anomaly detection"}

        X = df[numeric_cols].fillna(df[numeric_cols].median()).values
        X_normalized = (X - X.mean(axis=0)) / (X.std(axis=0) + 1e-8)

        iso_forest = IsolationForest(
            contamination=min(contamination, 0.5),
            random_state=42,
            n_estimators=100,
        )
        anomaly_labels = iso_forest.fit_predict(X_normalized)
        anomaly_scores = iso_forest.decision_function(X_normalized)

        anomalous_indices = np.where(anomaly_labels == -1)[0]

        anomaly_details = []
        for idx in anomalous_indices:
            row = df.iloc[idx]
            anomaly_type = AnomalyDetectionServer._categorize_anomaly(row, df)
            detail = {
                "index": int(idx),
                "anomaly_score": float(anomaly_scores[idx]),
                "anomaly_type": anomaly_type,
            }
            for col in ["date", "product_name", "category", "revenue", "quantity_sold", "price"]:
                if col in df.columns:
                    val = row[col]
                    detail[col] = float(val) if isinstance(val, (int, float, np.floating, np.integer)) else str(val)
            anomaly_details.append(detail)

        anomaly_details.sort(key=lambda x: x["anomaly_score"])

        return {
            "anomalies_detected": len(anomalous_indices),
            "total_rows": len(df),
            "anomaly_percentage": round(len(anomalous_indices) / len(df) * 100, 2),
            "details": anomaly_details[:20],
            "summary": {
                "high_volume_anomalies": len([a for a in anomaly_details if "high_volume" in a["anomaly_type"]]),
                "low_sales_anomalies": len([a for a in anomaly_details if "low_sales" in a["anomaly_type"]]),
                "price_anomalies": len([a for a in anomaly_details if "price" in a["anomaly_type"]]),
                "other_anomalies": len([a for a in anomaly_details if a["anomaly_type"] == "other"]),
            },
        }

    @staticmethod
    def _categorize_anomaly(row: pd.Series, df: pd.DataFrame) -> str:
        anomaly_types = []

        for col, label_high, label_low in [
            ("quantity_sold", "high_volume", "low_volume"),
            ("revenue", "high_sales", "low_sales"),
            ("price", "high_price_anomaly", "low_price_anomaly"),
        ]:
            if col in row.index and col in df.columns:
                mean = df[col].mean()
                std = df[col].std()
                if std > 0:
                    if row[col] > mean + 2.5 * std:
                        anomaly_types.append(label_high)
                    elif row[col] < mean - 2.5 * std:
                        anomaly_types.append(label_low)

        return ", ".join(anomaly_types) if anomaly_types else "other"

    @staticmethod
    def detect_data_drift(dataset_id: str) -> Dict[str, Any]:
        parquet_path = f"datasets/uploads/{dataset_id}/standardized.parquet"
        df = pd.read_parquet(parquet_path)

        if "date" not in df.columns:
            return {"error": "Date column required for drift detection"}

        df["date"] = pd.to_datetime(df["date"])
        midpoint = df["date"].quantile(0.5)
        early = df[df["date"] < midpoint]
        late = df[df["date"] >= midpoint]

        if len(early) == 0 or len(late) == 0:
            return {"error": "Insufficient data for drift detection"}

        drifts = {}
        for col in ["revenue", "quantity_sold", "price"]:
            if col not in df.columns:
                continue
            early_mean = early[col].mean()
            late_mean = late[col].mean()
            change_pct = ((late_mean - early_mean) / early_mean * 100) if early_mean != 0 else 0
            drifts[col] = {
                "early_mean": round(float(early_mean), 2),
                "late_mean": round(float(late_mean), 2),
                "change_percent": round(float(change_pct), 2),
                "drift_detected": abs(change_pct) > 10,
            }

        overall_drift = any(d["drift_detected"] for d in drifts.values())
        return {
            "overall_drift_detected": overall_drift,
            "early_period": str(early["date"].min().date()) + " to " + str(early["date"].max().date()),
            "late_period": str(late["date"].min().date()) + " to " + str(late["date"].max().date()),
            "drifts": drifts,
            "recommendation": "Sales pattern has shifted significantly - investigate recent changes" if overall_drift else "Sales pattern is stable across time periods",
        }
