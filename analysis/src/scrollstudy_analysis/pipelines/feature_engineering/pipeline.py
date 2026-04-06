"""Feature engineering pipeline definition."""

from kedro.pipeline import Pipeline, node, pipeline

from .nodes import compute_participant_features


def create_pipeline(**kwargs) -> Pipeline:
    return pipeline([
        node(
            compute_participant_features,
            inputs={
                "sessions": "raw_sessions",
                "memory_responses": "raw_memory_responses",
                "survey_responses": "raw_survey_responses",
                "post_views": "raw_post_views",
            },
            outputs="participant_features",
            name="compute_participant_features",
        ),
    ])
