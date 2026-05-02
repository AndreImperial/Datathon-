import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from analytics_case_study.config import BRAND_COLORS, CHANNEL_COLOR_MAP


LAYOUT_DEFAULTS = dict(
    font=dict(family="Arial, sans-serif", size=13),
    plot_bgcolor="white",
    paper_bgcolor="white",
    margin=dict(l=40, r=20, t=50, b=40),
)


def bar_chart(df: pd.DataFrame, x: str, y: str, title: str,
              color_col: str = None, horizontal: bool = True,
              color_map: dict = None) -> go.Figure:
    orientation = "h" if horizontal else "v"
    x_col, y_col = (y, x) if horizontal else (x, y)
    colors = [color_map.get(v, BRAND_COLORS[0]) for v in df[x]] if color_map else BRAND_COLORS[0]
    fig = go.Figure(go.Bar(
        x=df[x_col], y=df[y_col],
        orientation=orientation,
        marker_color=colors,
        text=df[y].apply(lambda v: f"${v:,.0f}" if isinstance(v, (int, float)) else v),
        textposition="outside",
    ))
    fig.update_layout(title=title, **LAYOUT_DEFAULTS)
    return fig


def donut_chart(labels: list, values: list, title: str) -> go.Figure:
    fig = go.Figure(go.Pie(
        labels=labels, values=values,
        hole=0.45,
        marker_colors=BRAND_COLORS,
    ))
    fig.update_layout(title=title, **LAYOUT_DEFAULTS)
    return fig


def funnel_chart(stages: list, values: list, title: str) -> go.Figure:
    fig = go.Figure(go.Funnel(
        y=stages, x=values,
        textinfo="value+percent initial",
        marker=dict(color=BRAND_COLORS[:len(stages)]),
    ))
    fig.update_layout(title=title, **LAYOUT_DEFAULTS)
    return fig


def line_chart(df: pd.DataFrame, x: str, y: str, color: str = None,
               title: str = "") -> go.Figure:
    if color:
        fig = px.line(df, x=x, y=y, color=color, title=title,
                      color_discrete_sequence=BRAND_COLORS)
    else:
        fig = px.line(df, x=x, y=y, title=title,
                      color_discrete_sequence=BRAND_COLORS)
    fig.update_layout(**LAYOUT_DEFAULTS)
    return fig


def scatter_chart(df: pd.DataFrame, x: str, y: str, size: str = None,
                  color: str = None, text: str = None, title: str = "") -> go.Figure:
    fig = px.scatter(df, x=x, y=y, size=size, color=color, text=text,
                     title=title, color_discrete_sequence=BRAND_COLORS)
    fig.update_traces(textposition="top center")
    fig.update_layout(**LAYOUT_DEFAULTS)
    return fig


def heatmap(df_pivot: pd.DataFrame, title: str) -> go.Figure:
    fig = go.Figure(go.Heatmap(
        z=df_pivot.values,
        x=df_pivot.columns.tolist(),
        y=df_pivot.index.tolist(),
        colorscale="Blues",
        text=[[f"{v:.1%}" if not pd.isna(v) else "" for v in row]
              for row in df_pivot.values],
        texttemplate="%{text}",
    ))
    fig.update_layout(title=title, **LAYOUT_DEFAULTS)
    return fig
