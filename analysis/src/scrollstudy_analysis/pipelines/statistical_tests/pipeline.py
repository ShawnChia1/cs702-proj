"""Statistical tests pipeline definition."""

from kedro.pipeline import Pipeline, node, pipeline

from .nodes import (
    rq1_condition_effects,
    rq2_frequency_interaction,
    rq3_pareto_frontier,
    rq4_usage_moderation,
)


def create_pipeline(**kwargs) -> Pipeline:
    return pipeline([
        node(rq1_condition_effects, inputs="participant_features", outputs="rq1_results", name="rq1_condition_effects"),
        node(rq2_frequency_interaction, inputs="participant_features", outputs="rq2_results", name="rq2_frequency_interaction"),
        node(rq3_pareto_frontier, inputs="participant_features", outputs="rq3_results", name="rq3_pareto_frontier"),
        node(rq4_usage_moderation, inputs="participant_features", outputs="rq4_results", name="rq4_usage_moderation"),
    ])
