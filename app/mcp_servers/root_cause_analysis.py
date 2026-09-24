import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, Any, List, Tuple


class RootCauseAnalysisServer:
    """Explain WHY sales metrics changed for a product"""

    @staticmethod
    def analyze_decline(dataset_id: str, product_name: str) -> Dict[str, Any]:
        parquet_path = f"datasets/uploads/{dataset_id}/standardized.parquet"
        df = pd.read_parquet(parquet_path)

        if "product_name" not in df.columns:
            return {"error": "Missing product_name column"}

        product_df = df[df["product_name"] == product_name].copy()
        if len(product_df) == 0:
            return {"error": f"Product '{product_name}' not found"}

        if "date" not in product_df.columns:
            return {"error": "Missing date column for temporal analysis"}

        product_df["date"] = pd.to_datetime(product_df["date"])
        product_df = product_df.sort_values("date")

        midpoint = product_df["date"].quantile(0.5)
        early = product_df[product_df["date"] < midpoint]
        late = product_df[product_df["date"] >= midpoint]

        if len(early) == 0 or len(late) == 0:
            return {"error": "Insufficient data for comparison across time periods"}

        early_revenue = early["revenue"].sum() if "revenue" in early.columns else 0
        late_revenue = late["revenue"].sum() if "revenue" in late.columns else 0
        decline_pct = ((late_revenue - early_revenue) / early_revenue * 100) if early_revenue > 0 else 0

        root_causes = {}
        root_causes["seasonality"] = RootCauseAnalysisServer._check_seasonality(product_df)

        if "price" in df.columns:
            root_causes["pricing"] = RootCauseAnalysisServer._check_price_change(early, late)

        root_causes["competition"] = RootCauseAnalysisServer._check_competition(df, product_name, midpoint)

        if "quantity_sold" in df.columns and "revenue" in df.columns:
            root_causes["volume_change"] = RootCauseAnalysisServer._check_volume_change(early, late)

        likely_causes = RootCauseAnalysisServer._rank_causes(root_causes)

        return {
            "product": product_name,
            "revenue_change_percent": round(float(decline_pct), 2),
            "early_period_revenue": round(float(early_revenue), 2),
            "late_period_revenue": round(float(late_revenue), 2),
            "early_period": f"{early['date'].min().date()} to {early['date'].max().date()}",
            "late_period": f"{late['date'].min().date()} to {late['date'].max().date()}",
            "root_causes": root_causes,
            "likely_causes_ranked": likely_causes,
            "recommendation": RootCauseAnalysisServer._recommend_action(likely_causes, decline_pct),
        }

    @staticmethod
    def _check_seasonality(product_df: pd.DataFrame) -> Dict[str, Any]:
        product_df = product_df.copy()
        product_df["month"] = product_df["date"].dt.month

        if "revenue" not in product_df.columns:
            return {"is_seasonal": False, "data": "No revenue column"}

        monthly_avg = product_df.groupby("month")["revenue"].mean()
        if len(monthly_avg) < 3:
            return {"is_seasonal": False, "data": "Insufficient monthly data"}

        annual_avg = monthly_avg.mean()
        std = monthly_avg.std()
        cv = (std / annual_avg) if annual_avg > 0 else 0

        best_month = int(monthly_avg.idxmax())
        worst_month = int(monthly_avg.idxmin())

        return {
            "is_seasonal": cv > 0.3,
            "coefficient_of_variation": round(float(cv), 3),
            "best_month": best_month,
            "worst_month": worst_month,
            "monthly_avg_revenue": {int(k): round(float(v), 2) for k, v in monthly_avg.items()},
        }

    @staticmethod
    def _check_price_change(early: pd.DataFrame, late: pd.DataFrame) -> Dict[str, Any]:
        early_price = early["price"].mean()
        late_price = late["price"].mean()
        price_change_pct = ((late_price - early_price) / early_price * 100) if early_price > 0 else 0

        impact = "Minimal price impact"
        if price_change_pct > 10:
            impact = "Significant price increase likely reduced demand"
        elif price_change_pct > 5:
            impact = "Moderate price increase may have affected sales"
        elif price_change_pct < -10:
            impact = "Price was cut significantly - check if margins are healthy"

        return {
            "price_increased": price_change_pct > 0,
            "early_avg_price": round(float(early_price), 2),
            "late_avg_price": round(float(late_price), 2),
            "price_change_percent": round(float(price_change_pct), 2),
            "impact": impact,
        }

    @staticmethod
    def _check_competition(df: pd.DataFrame, product_name: str, midpoint) -> Dict[str, Any]:
        if "revenue" not in df.columns or "date" not in df.columns:
            return {"competition_increased": False, "data": "Insufficient columns"}

        df = df.copy()
        df["date"] = pd.to_datetime(df["date"])
        others = df[df["product_name"] != product_name]

        early_other = others[others["date"] < midpoint]["revenue"].sum()
        late_other = others[others["date"] >= midpoint]["revenue"].sum()
        other_growth = ((late_other - early_other) / early_other * 100) if early_other > 0 else 0

        top_competitor = "Unknown"
        late_others = others[others["date"] >= midpoint]
        if len(late_others) > 0:
            top = late_others.groupby("product_name")["revenue"].sum().nlargest(1)
            if len(top) > 0:
                top_competitor = str(top.index[0])

        return {
            "competition_increased": other_growth > 15,
            "competitor_revenue_growth_percent": round(float(other_growth), 2),
            "top_competitor": top_competitor,
            "impact": "Strong competitive pressure" if other_growth > 20 else "Moderate competition",
        }

    @staticmethod
    def _check_volume_change(early: pd.DataFrame, late: pd.DataFrame) -> Dict[str, Any]:
        early_qty = early["quantity_sold"].sum()
        late_qty = late["quantity_sold"].sum()
        qty_change = ((late_qty - early_qty) / early_qty * 100) if early_qty > 0 else 0

        early_rev = early["revenue"].sum()
        late_rev = late["revenue"].sum()
        rev_change = ((late_rev - early_rev) / early_rev * 100) if early_rev > 0 else 0

        price_effect = rev_change - qty_change

        if qty_change < -10:
            insight = "Losing customers - volume is declining"
        elif qty_change > 10 and rev_change < 0:
            insight = "Selling more units but at lower prices"
        elif qty_change > 0:
            insight = "Volume is healthy"
        else:
            insight = "Volume is roughly stable"

        return {
            "quantity_change_percent": round(float(qty_change), 2),
            "revenue_change_percent": round(float(rev_change), 2),
            "price_mix_effect": round(float(price_effect), 2),
            "insight": insight,
        }

    @staticmethod
    def _rank_causes(causes: Dict) -> List[Dict[str, Any]]:
        ranked = []

        if "seasonality" in causes and causes["seasonality"].get("is_seasonal"):
            ranked.append({
                "cause": "Seasonality",
                "confidence": 0.7,
                "detail": f"High revenue variance across months (CV={causes['seasonality']['coefficient_of_variation']})",
            })

        if "pricing" in causes and causes["pricing"].get("price_increased") and causes["pricing"]["price_change_percent"] > 5:
            ranked.append({
                "cause": "Price Increase",
                "confidence": 0.8,
                "detail": f"Price rose {causes['pricing']['price_change_percent']:.1f}%",
            })

        if "competition" in causes and causes["competition"].get("competition_increased"):
            ranked.append({
                "cause": "Increased Competition",
                "confidence": 0.6,
                "detail": f"Competitor revenue grew {causes['competition']['competitor_revenue_growth_percent']:.1f}%",
            })

        if "volume_change" in causes and causes["volume_change"].get("quantity_change_percent", 0) < -10:
            ranked.append({
                "cause": "Customer Loss",
                "confidence": 0.85,
                "detail": f"Volume dropped {causes['volume_change']['quantity_change_percent']:.1f}%",
            })

        ranked.sort(key=lambda x: x["confidence"], reverse=True)
        return ranked

    @staticmethod
    def _recommend_action(causes: List[Dict], decline_pct: float) -> str:
        if not causes:
            if decline_pct > 0:
                return "Product is actually growing - no action needed"
            return "No clear root cause identified - consider deeper investigation or customer surveys"

        top = causes[0]["cause"]
        recommendations = {
            "Seasonality": "Decline appears seasonal. Plan promotions for slow months and stock up for peak periods.",
            "Price Increase": "Price increase is likely hurting demand. Consider targeted discounts or a rollback for price-sensitive segments.",
            "Increased Competition": "Competitors are gaining share. Differentiate through bundling, loyalty rewards, or feature improvements.",
            "Customer Loss": "Volume is dropping. Investigate product quality, customer reviews, and run a win-back campaign.",
        }
        return recommendations.get(top, "Multiple factors at play - diversify your response strategy.")
