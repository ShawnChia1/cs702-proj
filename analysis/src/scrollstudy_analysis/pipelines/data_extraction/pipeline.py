"""Data extraction pipeline definition."""

from kedro.pipeline import Pipeline, node, pipeline

from .nodes import (
    extract_friction_events,
    extract_memory_responses,
    extract_post_views,
    extract_sessions,
    extract_survey_responses,
)


def create_pipeline(**kwargs) -> Pipeline:
    return pipeline([
        node(extract_sessions, inputs=None, outputs="raw_sessions", name="extract_sessions"),
        node(extract_post_views, inputs=None, outputs="raw_post_views", name="extract_post_views"),
        node(extract_friction_events, inputs=None, outputs="raw_friction_events", name="extract_friction_events"),
        node(extract_memory_responses, inputs=None, outputs="raw_memory_responses", name="extract_memory_responses"),
        node(extract_survey_responses, inputs=None, outputs="raw_survey_responses", name="extract_survey_responses"),
    ])
