import pandas as pd
import plotly.express as px
from typing import Dict


class VisualizationServer:
    """Generate interactive charts"""

    @staticmethod
    def sales_by_category(dataset_id: str) -> Dict[str, str]:
        parquet_path = f"datasets/uploads/{dataset_id}/standardized.parquet"
        df = pd.read_parquet(parquet_path)

        if 'category' not in df.columns or 'revenue' not in df.columns:
            return {"error": "Missing required columns"}

        category_sales = df.groupby('category')['revenue'].sum().reset_index()
        fig = px.pie(category_sales, names='category', values='revenue',
                     title='Revenue by Category')
        return {"html": fig.to_html(include_plotlyjs='cdn')}

    @staticmethod
    def product_performance(dataset_id: str, top_n: int = 10) -> Dict[str, str]:
        parquet_path = f"datasets/uploads/{dataset_id}/standardized.parquet"
        df = pd.read_parquet(parquet_path)

        if 'product_name' not in df.columns or 'revenue' not in df.columns:
            return {"error": "Missing required columns"}

        top_products = df.groupby('product_name')['revenue'].sum().nlargest(top_n).reset_index()
        fig = px.bar(top_products, x='product_name', y='revenue',
                     title=f'Top {top_n} Products by Revenue')
        fig.update_xaxes(tickangle=-45)
        return {"html": fig.to_html(include_plotlyjs='cdn')}

    @staticmethod
    def sales_trend(dataset_id: str) -> Dict[str, str]:
        parquet_path = f"datasets/uploads/{dataset_id}/standardized.parquet"
        df = pd.read_parquet(parquet_path)

        if 'date' not in df.columns or 'revenue' not in df.columns:
            return {"error": "Missing date or revenue columns"}

        df['date'] = pd.to_datetime(df['date'])
        daily_sales = df.groupby('date')['revenue'].sum().reset_index()
        fig = px.line(daily_sales, x='date', y='revenue',
                      title='Daily Revenue Trend')
        return {"html": fig.to_html(include_plotlyjs='cdn')}
