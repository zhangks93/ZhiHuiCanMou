"""
将经营分析 chart spec JSON 渲染为可插入报告的 PNG 图片。

设计目标：
- 中文字体清晰，优先使用微软雅黑
- 学术风配色，克制、干净、适合正式报告
- 支持常见 chartType：bar / line / stacked_bar / combo_bar_line / waterfall / pie
- 输入可为 JSON 数组，或 {"charts": [...]} 对象

示例：
  python scripts/render_chart_specs.py --input docs/data/chart_specs.json --output-dir docs/charts
"""

from __future__ import annotations

import argparse
import json
import math
import re
import textwrap
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import matplotlib
import numpy as np
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.patches import Circle
from matplotlib.ticker import FuncFormatter


ACADEMIC_PALETTE = [
    "#4E79A7",  # muted report blue
    "#5F8F7B",  # desaturated green
    "#C2846E",  # soft terracotta
    "#7C88A6",  # gray blue
    "#B39B6B",  # muted ochre
    "#6E9FB8",  # dusty cyan
]
NEUTRAL_TEXT = "#233142"
SUBTLE_TEXT = "#66758A"
GRID_COLOR = "#E3E8EF"
FACE_COLOR = "#F7F8FA"
AXIS_COLOR = "#CDD5DF"
POSITIVE_COLOR = "#5F8F7B"
NEGATIVE_COLOR = "#C06C6C"


@dataclass
class ChartSpec:
    id: str
    title: str
    summary: str
    chart_type: str
    scope: str
    dimension: str
    metrics: list[str]
    unit: str
    series: list[dict[str, Any]]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render chart spec JSON files to PNG images.")
    parser.add_argument("--input", required=True, help="Path to chart spec JSON file.")
    parser.add_argument("--output-dir", required=True, help="Directory for rendered PNG files.")
    parser.add_argument("--dpi", type=int, default=220, help="PNG dpi. Default: 220")
    return parser.parse_args()


def load_specs(path: Path) -> list[ChartSpec]:
    payload = json.loads(path.read_text(encoding="utf-8"))

    if isinstance(payload, dict):
        charts = payload.get("charts")
        if not isinstance(charts, list):
            raise ValueError("JSON object must contain a 'charts' array.")
    elif isinstance(payload, list):
        charts = payload
    else:
        raise ValueError("Input JSON must be an array or an object with a 'charts' array.")

    specs: list[ChartSpec] = []
    for index, raw in enumerate(charts, start=1):
        if not isinstance(raw, dict):
            raise ValueError(f"Chart #{index} must be an object.")

        specs.append(
            ChartSpec(
                id=str(raw.get("id") or f"chart-{index}"),
                title=str(raw.get("title") or f"图表 {index}"),
                summary=str(raw.get("summary") or ""),
                chart_type=str(raw.get("chartType") or "bar"),
                scope=str(raw.get("scope") or ""),
                dimension=str(raw.get("dimension") or ""),
                metrics=[str(item) for item in raw.get("metrics", [])],
                unit=str(raw.get("unit") or ""),
                series=list(raw.get("series") or []),
            )
        )

    return specs


def configure_fonts() -> str:
    preferred = [
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\msyhbd.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
        r"C:\Windows\Fonts\simsun.ttc",
    ]
    for path_str in preferred:
        path = Path(path_str)
        if path.exists():
            font_manager.fontManager.addfont(str(path))
            font_name = font_manager.FontProperties(fname=str(path)).get_name()
            plt.rcParams["font.family"] = font_name
            plt.rcParams["font.sans-serif"] = [font_name]
            plt.rcParams["axes.unicode_minus"] = False
            return font_name

    plt.rcParams["font.family"] = "sans-serif"
    plt.rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei", "Arial Unicode MS", "DejaVu Sans"]
    plt.rcParams["axes.unicode_minus"] = False
    return plt.rcParams["font.sans-serif"][0]


def configure_theme() -> None:
    plt.style.use("default")
    plt.rcParams.update(
        {
            "figure.facecolor": FACE_COLOR,
            "axes.facecolor": FACE_COLOR,
            "axes.edgecolor": AXIS_COLOR,
            "axes.labelcolor": SUBTLE_TEXT,
            "axes.titlecolor": NEUTRAL_TEXT,
            "axes.grid": True,
            "axes.axisbelow": True,
            "grid.color": GRID_COLOR,
            "grid.linewidth": 0.9,
            "grid.alpha": 0.9,
            "grid.linestyle": "-",
            "xtick.color": NEUTRAL_TEXT,
            "ytick.color": SUBTLE_TEXT,
            "xtick.labelsize": 10,
            "ytick.labelsize": 10,
            "legend.frameon": True,
            "legend.facecolor": "#FBFCFD",
            "legend.edgecolor": "#E5EAF0",
            "legend.framealpha": 0.82,
        }
    )


def slugify(text: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9._-]+", "-", text.strip())
    value = re.sub(r"-{2,}", "-", value).strip("-")
    return value or "chart"


def to_float(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text or text.startswith("【"):
        return 0.0
    text = text.replace(",", "").replace("%", "").replace("万元", "").replace("万", "")
    try:
        return float(text)
    except ValueError:
        return 0.0


def short_wrap(text: str, width: int = 18) -> str:
    if not text:
        return ""
    return "\n".join(textwrap.wrap(text, width=width, break_long_words=False))


def build_category_union(series: list[dict[str, Any]]) -> list[str]:
    categories: list[str] = []
    seen: set[str] = set()
    for item in series:
        for point in item.get("data", []) or []:
            label = str(point.get("label") or "")
            if label and label not in seen:
                seen.add(label)
                categories.append(label)
    return categories


def get_series_values(series_item: dict[str, Any], categories: list[str]) -> list[float]:
    point_map = {
        str(point.get("label") or ""): to_float(point.get("value"))
        for point in (series_item.get("data", []) or [])
    }
    return [point_map.get(label, 0.0) for label in categories]


def format_number(value: float, unit: str) -> str:
    if unit == "%":
        return f"{value:.1f}%"
    if abs(value) >= 100:
        return f"{value:,.0f}"
    if abs(value) >= 10:
        return f"{value:,.1f}"
    return f"{value:,.2f}"


def unit_formatter(unit: str) -> FuncFormatter:
    return FuncFormatter(lambda x, _: format_number(float(x), unit))


def apply_academic_style(fig: plt.Figure, ax: plt.Axes, spec: ChartSpec) -> None:
    fig.patch.set_facecolor(FACE_COLOR)
    ax.set_facecolor(FACE_COLOR)
    ax.grid(axis="y", color=GRID_COLOR, linestyle="-", linewidth=0.9, alpha=0.9)
    ax.grid(axis="x", visible=False)
    ax.set_axisbelow(True)

    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    for spine in ("left", "bottom"):
        ax.spines[spine].set_color(AXIS_COLOR)
        ax.spines[spine].set_linewidth(0.75)

    ax.tick_params(axis="x", colors=NEUTRAL_TEXT, labelsize=10)
    ax.tick_params(axis="y", colors=SUBTLE_TEXT, labelsize=10)

    fig.suptitle(spec.title, x=0.065, y=0.955, ha="left", va="top", fontsize=16.5, fontweight="semibold", color=NEUTRAL_TEXT)

    meta_parts = []
    if spec.scope:
        meta_parts.append(f"口径: {spec.scope}")
    if spec.dimension:
        meta_parts.append(f"维度: {spec.dimension}")
    if spec.metrics:
        meta_parts.append(f"指标: {', '.join(spec.metrics)}")
    if meta_parts:
        fig.text(0.065, 0.04, "  |  ".join(meta_parts), ha="left", va="bottom", fontsize=9, color=SUBTLE_TEXT)


def annotate_bars(ax: plt.Axes, bars: Any, unit: str) -> None:
    for bar in bars:
        height = bar.get_height()
        if math.isclose(height, 0.0):
            continue
        ax.annotate(
            format_number(height, unit),
            xy=(bar.get_x() + bar.get_width() / 2, height),
            xytext=(0, 5 if height >= 0 else -12),
            textcoords="offset points",
            ha="center",
            va="bottom" if height >= 0 else "top",
            fontsize=9,
            color=SUBTLE_TEXT,
        )


def render_bar(spec: ChartSpec, output_path: Path, dpi: int) -> None:
    categories = build_category_union(spec.series)
    fig, ax = plt.subplots(figsize=(13.2, 7.8))
    apply_academic_style(fig, ax, spec)

    n_series = max(len(spec.series), 1)
    x = np.arange(len(categories))
    width = min(0.76 / n_series, 0.28)

    for idx, series_item in enumerate(spec.series):
        values = get_series_values(series_item, categories)
        offset = (idx - (n_series - 1) / 2) * width
        bars = ax.bar(
            x + offset,
            values,
            width=width * 0.92,
            label=str(series_item.get("name") or f"系列{idx + 1}"),
            color=ACADEMIC_PALETTE[idx % len(ACADEMIC_PALETTE)],
            edgecolor=FACE_COLOR,
            linewidth=0.6,
            alpha=0.9,
        )
        annotate_bars(ax, bars, str(series_item.get("unit") or spec.unit))

    ax.set_xticks(x)
    ax.set_xticklabels([short_wrap(item) for item in categories])
    ax.yaxis.set_major_formatter(unit_formatter(spec.unit))
    ax.legend(loc="upper right", fontsize=9.5, borderpad=0.5, labelspacing=0.45, handlelength=1.6)

    plt.tight_layout(rect=(0.04, 0.07, 0.98, 0.92))
    fig.savefig(output_path, dpi=dpi, facecolor=fig.get_facecolor(), bbox_inches="tight")
    plt.close(fig)


def render_line(spec: ChartSpec, output_path: Path, dpi: int) -> None:
    categories = build_category_union(spec.series)
    fig, ax = plt.subplots(figsize=(13.2, 7.8))
    apply_academic_style(fig, ax, spec)

    x = np.arange(len(categories))
    for idx, series_item in enumerate(spec.series):
        values = get_series_values(series_item, categories)
        color = ACADEMIC_PALETTE[idx % len(ACADEMIC_PALETTE)]
        ax.plot(
            x,
            values,
            label=str(series_item.get("name") or f"系列{idx + 1}"),
            color=color,
            linewidth=2.4,
            marker="o",
            markersize=5.5,
            markerfacecolor=color,
            markeredgecolor="white",
            markeredgewidth=1.1,
            alpha=0.9,
        )
        for xi, yi in zip(x, values):
            ax.annotate(format_number(yi, str(series_item.get("unit") or spec.unit)), (xi, yi), xytext=(0, 8), textcoords="offset points", ha="center", fontsize=9, color=color)

    ax.set_xticks(x)
    ax.set_xticklabels([short_wrap(item) for item in categories])
    ax.yaxis.set_major_formatter(unit_formatter(spec.unit))
    ax.legend(loc="upper right", fontsize=9.5, borderpad=0.5, labelspacing=0.45, handlelength=1.6)

    plt.tight_layout(rect=(0.04, 0.07, 0.98, 0.92))
    fig.savefig(output_path, dpi=dpi, facecolor=fig.get_facecolor(), bbox_inches="tight")
    plt.close(fig)


def render_stacked_bar(spec: ChartSpec, output_path: Path, dpi: int) -> None:
    categories = build_category_union(spec.series)
    fig, ax = plt.subplots(figsize=(13.2, 7.8))
    apply_academic_style(fig, ax, spec)

    x = np.arange(len(categories))
    bottom = np.zeros(len(categories))

    for idx, series_item in enumerate(spec.series):
        values = np.array(get_series_values(series_item, categories), dtype=float)
        bars = ax.bar(
            x,
            values,
            bottom=bottom,
            label=str(series_item.get("name") or f"系列{idx + 1}"),
            color=ACADEMIC_PALETTE[idx % len(ACADEMIC_PALETTE)],
            edgecolor=FACE_COLOR,
            linewidth=0.6,
            alpha=0.9,
        )
        bottom += values
        if len(spec.series) == 1:
            annotate_bars(ax, bars, str(series_item.get("unit") or spec.unit))

    if len(spec.series) > 1:
        for xi, total in zip(x, bottom):
            ax.annotate(format_number(float(total), spec.unit), (xi, total), xytext=(0, 8), textcoords="offset points", ha="center", fontsize=9, color=SUBTLE_TEXT)

    ax.set_xticks(x)
    ax.set_xticklabels([short_wrap(item) for item in categories])
    ax.yaxis.set_major_formatter(unit_formatter(spec.unit))
    ax.legend(loc="upper right", fontsize=9.5, borderpad=0.5, labelspacing=0.45, handlelength=1.6)

    plt.tight_layout(rect=(0.04, 0.07, 0.98, 0.92))
    fig.savefig(output_path, dpi=dpi, facecolor=fig.get_facecolor(), bbox_inches="tight")
    plt.close(fig)


def render_combo_bar_line(spec: ChartSpec, output_path: Path, dpi: int) -> None:
    categories = build_category_union(spec.series)
    fig, ax = plt.subplots(figsize=(13.4, 7.8))
    apply_academic_style(fig, ax, spec)
    ax2 = ax.twinx()
    ax2.set_facecolor("none")
    ax2.spines["top"].set_visible(False)
    ax2.spines["left"].set_visible(False)
    ax2.spines["right"].set_color(AXIS_COLOR)
    ax2.tick_params(axis="y", colors=SUBTLE_TEXT, labelsize=10)

    x = np.arange(len(categories))
    bar_series = [item for item in spec.series if str(item.get("type") or "").lower() != "line"]
    line_series = [item for item in spec.series if str(item.get("type") or "").lower() == "line"]

    bar_count = max(len(bar_series), 1)
    width = min(0.7 / bar_count, 0.26)

    for idx, series_item in enumerate(bar_series):
        values = get_series_values(series_item, categories)
        offset = (idx - (bar_count - 1) / 2) * width
        bars = ax.bar(
            x + offset,
            values,
            width=width * 0.92,
            label=str(series_item.get("name") or f"柱形{idx + 1}"),
            color=ACADEMIC_PALETTE[idx % len(ACADEMIC_PALETTE)],
            edgecolor=FACE_COLOR,
            linewidth=0.6,
            alpha=0.9,
        )
        annotate_bars(ax, bars, str(series_item.get("unit") or spec.unit))

    for idx, series_item in enumerate(line_series):
        color = ACADEMIC_PALETTE[(idx + len(bar_series)) % len(ACADEMIC_PALETTE)]
        values = get_series_values(series_item, categories)
        ax2.plot(
            x,
            values,
            label=str(series_item.get("name") or f"折线{idx + 1}"),
            color=color,
            linewidth=2.5,
            marker="o",
            markersize=5.5,
            markerfacecolor=color,
            markeredgecolor="white",
            markeredgewidth=1.1,
            alpha=0.9,
        )
        for xi, yi in zip(x, values):
            ax2.annotate(format_number(yi, str(series_item.get("unit") or "%")), (xi, yi), xytext=(0, 8), textcoords="offset points", ha="center", fontsize=9, color=color)

    ax.set_xticks(x)
    ax.set_xticklabels([short_wrap(item) for item in categories])
    ax.yaxis.set_major_formatter(unit_formatter(spec.unit))
    if line_series:
        secondary_unit = str(line_series[0].get("unit") or "%")
        ax2.yaxis.set_major_formatter(unit_formatter(secondary_unit))

    handles1, labels1 = ax.get_legend_handles_labels()
    handles2, labels2 = ax2.get_legend_handles_labels()
    ax.legend(handles1 + handles2, labels1 + labels2, loc="upper right", fontsize=9.5, borderpad=0.5, labelspacing=0.45, handlelength=1.6)

    plt.tight_layout(rect=(0.04, 0.07, 0.98, 0.92))
    fig.savefig(output_path, dpi=dpi, facecolor=fig.get_facecolor(), bbox_inches="tight")
    plt.close(fig)


def render_waterfall(spec: ChartSpec, output_path: Path, dpi: int) -> None:
    first_series = spec.series[0] if spec.series else {"data": []}
    points = list(first_series.get("data", []) or [])
    labels = [str(point.get("label") or "") for point in points]
    values = [to_float(point.get("value")) for point in points]

    cumulative = [0.0]
    for value in values[:-1]:
        cumulative.append(cumulative[-1] + value)
    starts = cumulative[:-1] + [0.0]
    heights = [abs(value) for value in values[:-1]] + [abs(values[-1]) if values else 0.0]

    fig, ax = plt.subplots(figsize=(13.2, 7.8))
    apply_academic_style(fig, ax, spec)

    x = np.arange(len(labels))
    for idx, (label, value) in enumerate(zip(labels, values)):
        if idx == 0 or idx == len(labels) - 1:
            bottom = 0
            height = value
            color = ACADEMIC_PALETTE[0]
        else:
            bottom = starts[idx]
            height = value
            color = POSITIVE_COLOR if value >= 0 else NEGATIVE_COLOR
        bar = ax.bar(x[idx], height, bottom=bottom, color=color, width=0.62, edgecolor=FACE_COLOR, linewidth=0.6, alpha=0.9)
        annotate_bars(ax, bar, spec.unit)

    running = 0.0
    for idx in range(1, len(values) - 1):
        running += values[idx - 1]
        ax.plot([x[idx - 1] + 0.31, x[idx] - 0.31], [running, running], color=AXIS_COLOR, linewidth=1.2)

    ax.set_xticks(x)
    ax.set_xticklabels([short_wrap(item) for item in labels])
    ax.yaxis.set_major_formatter(unit_formatter(spec.unit))

    plt.tight_layout(rect=(0.04, 0.07, 0.98, 0.92))
    fig.savefig(output_path, dpi=dpi, facecolor=fig.get_facecolor(), bbox_inches="tight")
    plt.close(fig)


def render_pie(spec: ChartSpec, output_path: Path, dpi: int) -> None:
    first_series = spec.series[0] if spec.series else {"data": []}
    points = list(first_series.get("data", []) or [])
    labels = [str(point.get("label") or "") for point in points]
    values = [to_float(point.get("value")) for point in points]

    fig, ax = plt.subplots(figsize=(11.2, 8.0))
    fig.patch.set_facecolor(FACE_COLOR)
    ax.set_facecolor(FACE_COLOR)

    fig.suptitle(spec.title, x=0.08, y=0.955, ha="left", va="top", fontsize=16.5, fontweight="semibold", color=NEUTRAL_TEXT)

    wedges, _ = ax.pie(
        values,
        startangle=90,
        colors=ACADEMIC_PALETTE[: len(values)],
        wedgeprops={"linewidth": 1.0, "edgecolor": FACE_COLOR},
    )
    ax.add_artist(Circle((0, 0), 0.58, fc=FACE_COLOR))
    ax.set(aspect="equal")

    total = sum(values) or 1.0
    legend_labels = [
        f"{label}  {format_number(value, spec.unit)}  ({value / total * 100:.1f}%)"
        for label, value in zip(labels, values)
    ]
    ax.legend(wedges, legend_labels, bbox_to_anchor=(1.02, 0.5), loc="center left", fontsize=9.5, borderpad=0.5, labelspacing=0.5, handlelength=1.2)

    if spec.scope or spec.dimension or spec.metrics:
        meta_parts = []
        if spec.scope:
            meta_parts.append(f"口径: {spec.scope}")
        if spec.dimension:
            meta_parts.append(f"维度: {spec.dimension}")
        if spec.metrics:
            meta_parts.append(f"指标: {', '.join(spec.metrics)}")
        fig.text(0.08, 0.04, "  |  ".join(meta_parts), ha="left", va="bottom", fontsize=9, color=SUBTLE_TEXT)

    plt.tight_layout(rect=(0.04, 0.07, 0.92, 0.92))
    fig.savefig(output_path, dpi=dpi, facecolor=fig.get_facecolor(), bbox_inches="tight")
    plt.close(fig)


def render_chart(spec: ChartSpec, output_dir: Path, dpi: int) -> Path:
    output_path = output_dir / f"{slugify(spec.id)}.png"
    chart_type = spec.chart_type.lower()

    if chart_type == "bar":
        render_bar(spec, output_path, dpi)
    elif chart_type == "line":
        render_line(spec, output_path, dpi)
    elif chart_type == "stacked_bar":
        render_stacked_bar(spec, output_path, dpi)
    elif chart_type == "combo_bar_line":
        render_combo_bar_line(spec, output_path, dpi)
    elif chart_type == "waterfall":
        render_waterfall(spec, output_path, dpi)
    elif chart_type == "pie":
        render_pie(spec, output_path, dpi)
    else:
        raise ValueError(f"Unsupported chartType: {spec.chart_type}")

    return output_path


def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    configure_theme()
    font_name = configure_fonts()
    specs = load_specs(input_path)

    outputs = []
    for spec in specs:
        outputs.append(render_chart(spec, output_dir, dpi=args.dpi))

    print(f"Loaded {len(specs)} chart specs.")
    print(f"Using font: {font_name}")
    print("Rendered files:")
    for path in outputs:
        print(f" - {path}")


if __name__ == "__main__":
    main()
