import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import PolynomialFeatures
from typing import Dict, Any


class ForecastingServer:
    """Predict future sales trends using polynomial regression"""

    @staticmethod
    def forecast_sales(dataset_id: str, days_ahead: int = 30) -> Dict[str, Any]:
        parquet_path = f"datasets/uploads/{dataset_id}/standardized.parquet"
        df = pd.read_parquet(parquet_path)

        if "date" not in df.columns or "revenue" not in df.columns:
            return {"error": "Missing date or revenue columns"}

        df["date"] = pd.to_datetime(df["date"])
        daily_sales = df.groupby("date")["revenue"].sum().reset_index().sort_values("date")

        if len(daily_sales) < 7:
            return {"error": "Need at least 7 days of data for forecasting"}

        X = np.arange(len(daily_sales)).reshape(-1, 1)
        y = daily_sales["revenue"].values

        poly_features = PolynomialFeatures(degree=2)
        X_poly = poly_features.fit_transform(X)

        model = LinearRegression()
        model.fit(X_poly, y)

        future_X = np.arange(len(daily_sales), len(daily_sales) + days_ahead).reshape(-1, 1)
        future_X_poly = poly_features.transform(future_X)
        forecast = model.predict(future_X_poly)

        residuals = y - model.predict(X_poly)
        std_error = np.std(residuals)

        last_date = daily_sales["date"].max()
        future_dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=days_ahead)

        forecast_data = []
        for i, date in enumerate(future_dates):
            forecast_data.append({
                "date": str(date.date()),
                "forecast": round(float(max(0, forecast[i])), 2),
                "confidence_lower": round(float(max(0, forecast[i] - 1.96 * std_error)), 2),
                "confidence_upper": round(float(forecast[i] + 1.96 * std_error), 2),
            })

        trend_direction = "Growing" if forecast[-1] > forecast[0] else "Declining"
        trend_pct = ((forecast[-1] - forecast[0]) / abs(forecast[0]) * 100) if forecast[0] != 0 else 0

        r2 = model.score(X_poly, y)

        return {
            "forecast_days": days_ahead,
            "forecast": forecast_data,
            "model_type": "polynomial_regression_degree_2",
            "r2_score": round(float(r2), 4),
            "std_error": round(float(std_error), 2),
            "trend": {
                "direction": trend_direction,
                "change_percent": round(float(trend_pct), 2),
                "current_daily_avg": round(float(y[-7:].mean()), 2),
                "forecast_daily_avg": round(float(forecast.mean()), 2),
            },
            "historical_summary": {
                "total_days": len(daily_sales),
                "total_revenue": round(float(y.sum()), 2),
                "avg_daily_revenue": round(float(y.mean()), 2),
            },
        }

    @staticmethod
    def forecast_by_product(dataset_id: str, product_name: str, days_ahead: int = 30) -> Dict[str, Any]:
        parquet_path = f"datasets/uploads/{dataset_id}/standardized.parquet"
        df = pd.read_parquet(parquet_path)

        if "date" not in df.columns or "product_name" not in df.columns:
            return {"error": "Missing required columns (date, product_name)"}

        product_df = df[df["product_name"] == product_name].copy()
        if len(product_df) < 7:
            return {"error": f"Insufficient data for '{product_name}' (need at least 7 records)"}

        product_df["date"] = pd.to_datetime(product_df["date"])
        daily_sales = product_df.groupby("date")["revenue"].sum().reset_index().sort_values("date")

        if len(daily_sales) < 3:
            return {"error": f"Insufficient daily data points for '{product_name}'"}

        X = np.arange(len(daily_sales)).reshape(-1, 1)
        y = daily_sales["revenue"].values

        degree = min(2, len(daily_sales) - 1)
        poly_features = PolynomialFeatures(degree=degree)
        X_poly = poly_features.fit_transform(X)

        model = LinearRegression()
        model.fit(X_poly, y)

        future_X = np.arange(len(daily_sales), len(daily_sales) + days_ahead).reshape(-1, 1)
        future_X_poly = poly_features.transform(future_X)
        forecast = model.predict(future_X_poly)

        residuals = y - model.predict(X_poly)
        std_error = np.std(residuals)

        last_date = daily_sales["date"].max()
        future_dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=days_ahead)

        forecast_data = []
        for i, date in enumerate(future_dates):
            forecast_data.append({
                "date": str(date.date()),
                "forecast": round(float(max(0, forecast[i])), 2),
                "confidence_lower": round(float(max(0, forecast[i] - 1.96 * std_error)), 2),
                "confidence_upper": round(float(forecast[i] + 1.96 * std_error), 2),
            })

        health = ForecastingServer._assess_product_health(y, forecast)

        return {
            "product": product_name,
            "forecast_days": days_ahead,
            "forecast": forecast_data,
            "r2_score": round(float(model.score(X_poly, y)), 4),
            "health": health,
            "current_avg_daily_revenue": round(float(y[-7:].mean() if len(y) >= 7 else y.mean()), 2),
            "forecast_avg_daily_revenue": round(float(np.mean(forecast[:7])), 2),
        }

    @staticmethod
    def _assess_product_health(historical: np.ndarray, forecast: np.ndarray) -> str:
        hist_avg = historical[-7:].mean() if len(historical) >= 7 else historical.mean()
        forecast_avg = forecast[:7].mean() if len(forecast) >= 7 else forecast.mean()

        if hist_avg == 0:
            return "No recent sales data"

        change_pct = ((forecast_avg - hist_avg) / hist_avg) * 100

        if change_pct > 15:
            return "Strong growth trajectory"
        elif change_pct > 5:
            return "Moderate growth trajectory"
        elif change_pct > -5:
            return "Stable trajectory"
        elif change_pct > -15:
            return "Moderate decline"
        else:
            return "Significant decline - action needed"
