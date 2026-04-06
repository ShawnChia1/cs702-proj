"""
Database connection wrapper for synthetic data generation.

Connects to local Postgres via psycopg2. Provides batch insert
and cleanup helpers.
"""

import os
import sys

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# Load .env from project root (one level up from datagen/)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

DEFAULT_DATABASE_URL = "postgres://study:studypass@localhost:5432/scrollstudy"

SYNTHETIC_PREFIX = "PSYN"


def get_connection():
    url = os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)
    try:
        conn = psycopg2.connect(url)
        conn.autocommit = False
        return conn
    except psycopg2.OperationalError as e:
        print(f"ERROR: Cannot connect to database at {url}")
        print("Is the local Postgres running? Try: docker compose up db")
        print(f"Details: {e}")
        sys.exit(1)


def batch_insert(conn, table, columns, rows, batch_size=50):
    """Insert rows in batches using execute_values for performance."""
    if not rows:
        return
    cols = ", ".join(columns)
    template = "(" + ", ".join(["%s"] * len(columns)) + ")"
    query = f"INSERT INTO {table} ({cols}) VALUES %s"
    cur = conn.cursor()
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        psycopg2.extras.execute_values(cur, query, batch, template=template)
    conn.commit()


def clean_synthetic(conn):
    """Delete all synthetic sessions (PSYN prefix). Cascades via FK."""
    cur = conn.cursor()
    cur.execute(
        "DELETE FROM sessions WHERE participant_id LIKE %s",
        (f"{SYNTHETIC_PREFIX}%",),
    )
    deleted = cur.rowcount
    conn.commit()
    return deleted
