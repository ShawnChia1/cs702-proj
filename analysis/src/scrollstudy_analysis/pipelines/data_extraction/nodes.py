"""
Data extraction nodes: pull completed session data from local Postgres.
"""

import os

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "..", ".env"))

DEFAULT_DATABASE_URL = "postgresql://study:studypass@localhost:5432/scrollstudy"


def _get_engine():
    url = os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)
    # psycopg2 needs postgresql:// not postgres://
    url = url.replace("postgres://", "postgresql://", 1)
    return create_engine(url)


def extract_sessions() -> pd.DataFrame:
    engine = _get_engine()
    query = """
        SELECT s.*, d.age, d.gender, d.social_media_usage, d.platforms_used
        FROM sessions s
        LEFT JOIN demographics d ON d.session_id = s.id
        WHERE s.status = 'completed'
    """
    return pd.read_sql(query, engine)


def extract_post_views() -> pd.DataFrame:
    engine = _get_engine()
    query = """
        SELECT pv.*
        FROM post_views pv
        JOIN sessions s ON pv.session_id = s.id
        WHERE s.status = 'completed'
    """
    return pd.read_sql(query, engine)


def extract_friction_events() -> pd.DataFrame:
    engine = _get_engine()
    query = """
        SELECT fe.*
        FROM friction_events fe
        JOIN sessions s ON fe.session_id = s.id
        WHERE s.status = 'completed'
    """
    return pd.read_sql(query, engine)


def extract_memory_responses() -> pd.DataFrame:
    engine = _get_engine()
    query = """
        SELECT mr.*
        FROM memory_responses mr
        JOIN sessions s ON mr.session_id = s.id
        WHERE s.status = 'completed'
    """
    return pd.read_sql(query, engine)


def extract_survey_responses() -> pd.DataFrame:
    engine = _get_engine()
    query = """
        SELECT sr.*
        FROM survey_responses sr
        JOIN sessions s ON sr.session_id = s.id
        WHERE s.status = 'completed'
    """
    return pd.read_sql(query, engine)
