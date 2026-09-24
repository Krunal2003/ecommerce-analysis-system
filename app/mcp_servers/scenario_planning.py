import pandas as pd
import numpy as np
from typing import Dict, Any


class ScenarioPlanningServer:
    """Simulate business decisions: pricing, promotions, bundling"""

    @staticmethod
    def simulate_price_change(dataset_id: str, product_name: str, price_change_pct: float) -> Dict[str, Any]:
        parquet_path = f"datasets/uploads/{dataset_id}/standardized.parquet"
        df = pd.read_parquet(parquet_path)

        product_df = df[df["product_name"] == product_name]
        if len(product_df) == 0:
            return {"error": f"Product '{product_name}' not found"}

        current_price = product_df["price"].mean()
        new_price = current_price * (1 + price_change_pct / 100)

        current_quantity = product_df["quantity_sold"].sum()
        current_revenue = product_df["revenue"].sum()

        # Price elasticity of demand (mid-elastic for e-commerce)
        elasticity = -1.2
        volume_change_pct = price_change_pct * elasticity
        new_quantity = current_quantity * (1 + volume_change_pct / 100)
        new_revenue = new_price * new_quantity
        revenue_change = new_revenue - current_revenue
        revenue_change_pct = (revenue_change / current_revenue * 100) if current_revenue > 0 else 0

        return {
            "scenario": f"Price {price_change_pct:+.1f}%",
            "product": product_name,
            "current": {
                "price": round(float(current_price), 2),
                "quantity_sold": int(current_quantity),
                "revenue": round(float(current_revenue), 2),
            },
            "projected": {
                "price": round(float(new_price), 2),
                "quantity_sold": int(max(0, new_quantity)),
                "revenue": round(float(max(0, new_revenue)), 2),
            },
            "changes": {
                "price_change_percent": round(float(price_change_pct), 2),
                "volume_change_percent": round(float(volume_change_pct), 2),
                "revenue_change": round(float(revenue_change), 2),
                "revenue_change_percent": round(float(revenue_change_pct), 2),
            },
            "elasticity_assumed": elasticity,
            "recommendation": ScenarioPlanningServer._recommend_pricing(revenue_change_pct, volume_change_pct),
        }

    @staticmethod
    def simulate_promotion(dataset_id: str, product_name: str, discount_pct: float, duration_days: int = 7) -> Dict[str, Any]:
        parquet_path = f"datasets/uploads/{dataset_id}/standardized.parquet"
        df = pd.read_parquet(parquet_path)

        product_df = df[df["product_name"] == product_name]
        if len(product_df) == 0:
            return {"error": f"Product '{product_name}' not found"}

        n_days = max(1, product_df["date"].nunique()) if "date" in product_df.columns else max(1, len(product_df))
        daily_avg_quantity = product_df["quantity_sold"].sum() / n_days
        current_price = product_df["price"].mean()
        daily_avg_revenue = current_price * daily_avg_quantity

        promo_price = current_price * (1 - discount_pct / 100)

        # Promotion typically lifts volume 2-4x
        volume_lift = min(2.0 + (discount_pct / 20), 5.0)
        promo_daily_qty = daily_avg_quantity * volume_lift
        promo_daily_revenue = promo_price * promo_daily_qty

        # Post-promo retention
        retention_rate = 0.35
        post_promo_daily_qty = daily_avg_quantity * (1 + (volume_lift - 1) * retention_rate)
        post_promo_daily_revenue = current_price * post_promo_daily_qty  # back to normal price

        total_window = duration_days + 30
        baseline_revenue = daily_avg_revenue * total_window
        promo_revenue = promo_daily_revenue * duration_days
        post_promo_revenue = post_promo_daily_revenue * 30
        total_revenue = promo_revenue + post_promo_revenue
        incremental = total_revenue - baseline_revenue
        roi = (incremental / baseline_revenue * 100) if baseline_revenue > 0 else 0

        return {
            "scenario": f"{discount_pct:.0f}% off for {duration_days} days",
            "product": product_name,
            "baseline": {
                "daily_quantity": round(float(daily_avg_quantity), 1),
                "daily_revenue": round(float(daily_avg_revenue), 2),
                "total_revenue_period": round(float(baseline_revenue), 2),
            },
            "during_promotion": {
                "duration_days": duration_days,
                "promo_price": round(float(promo_price), 2),
                "daily_quantity": round(float(promo_daily_qty), 1),
                "daily_revenue": round(float(promo_daily_revenue), 2),
                "volume_lift_multiplier": round(float(volume_lift), 2),
            },
            "post_promotion_30d": {
                "retained_daily_quantity": round(float(post_promo_daily_qty), 1),
                "retention_rate_percent": round(float(retention_rate * 100), 1),
                "daily_revenue": round(float(post_promo_daily_revenue), 2),
            },
            "impact": {
                "total_period_revenue": round(float(total_revenue), 2),
                "incremental_revenue": round(float(incremental), 2),
                "roi_percent": round(float(roi), 2),
                "recommendation": "Run this promotion - positive ROI expected" if incremental > 0 else "Discount too deep - try a smaller discount",
            },
        }

    @staticmethod
    def bundle_analysis(dataset_id: str, product_1: str, product_2: str) -> Dict[str, Any]:
        parquet_path = f"datasets/uploads/{dataset_id}/standardized.parquet"
        df = pd.read_parquet(parquet_path)

        p1 = df[df["product_name"] == product_1]
        p2 = df[df["product_name"] == product_2]

        if len(p1) == 0 or len(p2) == 0:
            missing = []
            if len(p1) == 0:
                missing.append(product_1)
            if len(p2) == 0:
                missing.append(product_2)
            return {"error": f"Product(s) not found: {', '.join(missing)}"}

        p1_revenue = p1["revenue"].sum()
        p2_revenue = p2["revenue"].sum()
        total_current = p1_revenue + p2_revenue

        p1_price = p1["price"].mean()
        p2_price = p2["price"].mean()

        # Bundle pricing: typically 10-15% discount on combined price
        bundle_discount = 0.12
        bundle_price = (p1_price + p2_price) * (1 - bundle_discount)

        # Bundling typically increases attachment 8-15% and AOV 10-20%
        attachment_lift = 0.10
        aov_lift = 0.15

        bundle_revenue = total_current * (1 + attachment_lift) * (1 + aov_lift)
        incremental = bundle_revenue - total_current
        incremental_pct = (incremental / total_current * 100) if total_current > 0 else 0

        return {
            "scenario": f"Bundle: {product_1} + {product_2}",
            "products": {
                product_1: {"revenue": round(float(p1_revenue), 2), "avg_price": round(float(p1_price), 2)},
                product_2: {"revenue": round(float(p2_revenue), 2), "avg_price": round(float(p2_price), 2)},
            },
            "bundle_price": round(float(bundle_price), 2),
            "bundle_discount_percent": round(float(bundle_discount * 100), 1),
            "current_combined_revenue": round(float(total_current), 2),
            "projected_bundle_revenue": round(float(bundle_revenue), 2),
            "incremental_revenue": round(float(incremental), 2),
            "incremental_percent": round(float(incremental_pct), 2),
            "assumptions": {
                "attachment_lift_percent": round(float(attachment_lift * 100), 1),
                "aov_lift_percent": round(float(aov_lift * 100), 1),
                "bundle_discount_percent": round(float(bundle_discount * 100), 1),
            },
            "recommendation": "Strong bundle candidate - projected positive uplift" if incremental > 0 else "Bundle may not be effective for these products",
        }

    @staticmethod
    def _recommend_pricing(revenue_change_pct: float, volume_change_pct: float) -> str:
        if revenue_change_pct > 5:
            return "Price change improves revenue - recommend proceeding"
        elif revenue_change_pct > 0:
            return "Modest revenue gain - consider testing with a limited rollout"
        elif volume_change_pct < -30:
            return "Volume drops too much - avoid this price change"
        else:
            return "Mixed impact - test with a small segment first"
