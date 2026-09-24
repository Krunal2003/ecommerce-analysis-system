import pandas as pd
import numpy as np
from typing import Dict, Any


class RFMServer:
    """RFM Analysis: Score products on Recency, Frequency, Monetary value"""

    @staticmethod
    def rfm_analysis(dataset_id: str) -> Dict[str, Any]:
        parquet_path = f"datasets/uploads/{dataset_id}/standardized.parquet"
        df = pd.read_parquet(parquet_path)

        required = {"date", "product_name"}
        missing = required - set(df.columns)
        if missing:
            return {"error": f"Missing columns: {', '.join(missing)}"}

        df["date"] = pd.to_datetime(df["date"])
        reference_date = df["date"].max()

        agg_dict = {"date": lambda x: (reference_date - x.max()).days}
        if "revenue" in df.columns:
            agg_dict["revenue"] = "sum"
        if "quantity_sold" in df.columns:
            agg_dict["quantity_sold"] = "sum"

        rfm = df.groupby("product_name").agg(agg_dict).reset_index()
        # Add frequency as count of transactions
        freq = df.groupby("product_name").size().reset_index(name="frequency")
        rfm = rfm.merge(freq, on="product_name")

        rfm.rename(columns={"date": "recency_days"}, inplace=True)
        if "revenue" in rfm.columns:
            rfm.rename(columns={"revenue": "monetary"}, inplace=True)
        else:
            rfm["monetary"] = rfm.get("quantity_sold", 0)

        # Score each dimension 1-5 (5 = best)
        # For recency, lower days = better, so reverse labels
        rfm["r_score"] = RFMServer._safe_qcut(rfm["recency_days"], [5, 4, 3, 2, 1])
        rfm["f_score"] = RFMServer._safe_qcut(rfm["frequency"], [1, 2, 3, 4, 5])
        rfm["m_score"] = RFMServer._safe_qcut(rfm["monetary"], [1, 2, 3, 4, 5])

        rfm["rfm_score"] = rfm["r_score"] + rfm["f_score"] + rfm["m_score"]
        rfm["segment"] = rfm.apply(RFMServer._segment, axis=1)

        rfm_output = []
        for _, row in rfm.iterrows():
            entry = {
                "product": row["product_name"],
                "segment": row["segment"],
                "recency_days": int(row["recency_days"]),
                "frequency": int(row["frequency"]),
                "monetary": round(float(row["monetary"]), 2),
                "r_score": int(row["r_score"]),
                "f_score": int(row["f_score"]),
                "m_score": int(row["m_score"]),
                "rfm_score": int(row["rfm_score"]),
            }
            if "quantity_sold" in rfm.columns:
                entry["total_quantity"] = int(row["quantity_sold"])
            rfm_output.append(entry)

        segment_priority = {
            "Champions": 0, "Loyal": 1, "Promising": 2,
            "Standard": 3, "At Risk": 4, "Lost": 5,
        }
        rfm_output.sort(key=lambda x: segment_priority.get(x["segment"], 99))

        summary = {}
        for seg in segment_priority:
            summary[seg.lower().replace(" ", "_")] = len([x for x in rfm_output if x["segment"] == seg])

        return {
            "rfm_analysis": rfm_output,
            "summary": summary,
            "total_products": len(rfm_output),
        }

    @staticmethod
    def _safe_qcut(series: pd.Series, labels: list) -> pd.Series:
        """Quantile cut that handles duplicates gracefully"""
        try:
            return pd.qcut(series.rank(method="first"), q=len(labels), labels=labels, duplicates="drop").astype(int)
        except ValueError:
            # Fallback: simple rank-based scoring
            ranks = series.rank(method="first", pct=True)
            return (ranks * (len(labels) - 1) + 1).round().astype(int).clip(1, max(labels))

    @staticmethod
    def _segment(row) -> str:
        r, f, m = row["r_score"], row["f_score"], row["m_score"]

        if r >= 4 and f >= 4 and m >= 4:
            return "Champions"
        elif r >= 3 and f >= 3 and m >= 3:
            return "Loyal"
        elif r >= 4 and f >= 3:
            return "Promising"
        elif r <= 2 and f >= 3:
            return "At Risk"
        elif r <= 2:
            return "Lost"
        else:
            return "Standard"
