"""Reporting pipeline definition."""

from kedro.pipeline import Pipeline, node, pipeline

from .nodes import (
    generate_summary_stats,
    plot_rq1,
    plot_rq2,
    plot_rq3,
    plot_rq4_radar,
    plot_rq4_usage,
)


def create_pipeline(**kwargs) -> Pipeline:
    return pipeline([
        node(plot_rq1, inputs="rq1_results", outputs=None, name="plot_rq1"),
        node(plot_rq2, inputs="rq2_results", outputs=None, name="plot_rq2"),
        node(plot_rq3, inputs="rq3_results", outputs=None, name="plot_rq3"),
        node(plot_rq4_radar, inputs="rq4_results", outputs=None, name="plot_rq4_radar"),
        node(plot_rq4_usage, inputs="rq4_results", outputs=None, name="plot_rq4_usage"),
        node(
            generate_summary_stats,
            inputs=["rq1_results", "rq2_results", "rq3_results", "rq4_results"],
            outputs="summary_stats",
            name="generate_summary_stats",
        ),
    ])
