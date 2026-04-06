"""
Main CLI entry point for synthetic data generation.

Usage:
    uv run python -m datagen --participants-per-condition 6
    uv run python -m datagen --participants-per-condition 30 --include-freq-sweep --clean
"""

import argparse
import json
import uuid

import numpy as np
import yaml

from .db import batch_insert, clean_synthetic, get_connection
from .memory import compute_rates, generate_memory_responses
from .profiles import generate_demographics, generate_participant_id
from .survey import generate_survey_responses
from .telemetry import generate_session_telemetry

CONDITIONS = ["control", "reaction", "button", "feedback", "slowdown"]
FREQ_SWEEP_CONDITIONS = ["button", "feedback"]
FREQ_SWEEP_LEVELS = [3, 5, 10, 15]
DEFAULT_FREQ = 5


def load_config():
    import os

    config_path = os.path.join(os.path.dirname(__file__), "..", "config.yaml")
    with open(config_path) as f:
        return yaml.safe_load(f)


def get_condition_params(config, condition, freq=5):
    """Get condition parameters, applying frequency modulation if needed."""
    params = dict(config["conditions"][condition])
    if freq != 5 and condition != "control":
        mod = config["frequency_modulation"].get(freq, {})
        params["dprime_mean"] *= mod.get("dprime_multiplier", 1.0)
        params["dprime_sd"] *= mod.get("dprime_multiplier", 1.0)
        params["frustration_mean"] *= mod.get("frustration_multiplier", 1.0)
        params["frustration_sd"] *= mod.get("frustration_multiplier", 1.0)
    return params


def generate_one_session(rng, config, condition, freq, conn):
    """Generate and insert all data for one synthetic participant."""
    cond_params = get_condition_params(config, condition, freq)
    participant_id = generate_participant_id()
    session_id = str(uuid.uuid4())

    # Demographics
    demo = generate_demographics(rng, config)

    # Telemetry
    post_views, friction_events, raw_events, feed_started, feed_ended, feed_duration = (
        generate_session_telemetry(rng, config, condition, cond_params, freq if condition != "control" else 0)
    )

    # Memory test
    memory_responses, target_dprime = generate_memory_responses(rng, config, cond_params)
    hit_rate, fa_rate = compute_rates(memory_responses)

    # Survey
    survey_responses = generate_survey_responses(rng, config, condition, cond_params)

    # -- Insert session --
    batch_insert(conn, "sessions", [
        "id", "participant_id", "condition", "friction_frequency",
        "feed_started_at", "feed_ended_at", "feed_duration_ms",
        "post_count", "memory_hit_rate", "memory_fa_rate",
        "completed_at", "status",
    ], [(
        session_id, participant_id, condition,
        freq if condition != "control" else None,
        feed_started, feed_ended, feed_duration,
        len(config["posts"]["exposure"]),
        hit_rate, fa_rate,
        feed_ended, "completed",
    )])

    # -- Insert demographics --
    batch_insert(conn, "demographics", [
        "session_id", "age", "gender", "social_media_usage", "platforms_used",
    ], [(
        session_id, demo["age"], demo["gender"],
        demo["social_media_usage"], demo["platforms_used"],
    )])

    # -- Insert raw events --
    event_rows = []
    for ev in raw_events:
        event_rows.append((
            session_id, ev["type"], ev["ts"], json.dumps(ev.get("payload", {})),
        ))
    batch_insert(conn, "events", ["session_id", "type", "ts", "payload"], event_rows)

    # -- Insert post_views --
    pv_rows = []
    for pv in post_views:
        pv_rows.append((
            session_id, pv["post_id"], pv["category"],
            pv["start_ts"], pv["end_ts"], pv["dwell_ms"], pv["scroll_depth"],
        ))
    batch_insert(conn, "post_views", [
        "session_id", "post_id", "category", "start_ts", "end_ts", "dwell_ms", "scroll_depth",
    ], pv_rows)

    # -- Insert friction_events --
    fe_rows = []
    for fe in friction_events:
        fe_rows.append((
            session_id, fe["friction_type"], fe["trigger_index"],
            fe["shown_at"], fe["duration_ms"], fe["action"],
        ))
    batch_insert(conn, "friction_events", [
        "session_id", "friction_type", "trigger_index", "shown_at", "duration_ms", "action",
    ], fe_rows)

    # -- Insert memory_responses --
    mr_rows = []
    for mr in memory_responses:
        mr_rows.append((
            session_id, mr["post_id"], mr["memory_label"],
            mr["participant_answer"], mr["correct"], mr["rt_ms"], mr["category"],
        ))
    batch_insert(conn, "memory_responses", [
        "session_id", "post_id", "memory_label", "participant_answer",
        "correct", "rt_ms", "category",
    ], mr_rows)

    # -- Insert survey_responses --
    sr_rows = []
    for sr in survey_responses:
        sr_rows.append((session_id, sr["question_id"], sr["value"]))
    batch_insert(conn, "survey_responses", [
        "session_id", "question_id", "value",
    ], sr_rows)

    return participant_id


def main():
    parser = argparse.ArgumentParser(description="Generate synthetic ScrollStudy data")
    parser.add_argument(
        "--participants-per-condition", type=int, required=True,
        help="Number of synthetic participants per condition",
    )
    parser.add_argument(
        "--include-freq-sweep", action="store_true",
        help="Generate additional sessions for button/feedback at freq 3, 10, 15",
    )
    parser.add_argument(
        "--clean", action="store_true",
        help="Delete all synthetic sessions (PSYN prefix) before generating",
    )
    parser.add_argument(
        "--seed", type=int, default=42,
        help="Random seed for reproducibility (default: 42)",
    )
    args = parser.parse_args()

    config = load_config()
    rng = np.random.default_rng(args.seed)
    conn = get_connection()

    if args.clean:
        deleted = clean_synthetic(conn)
        print(f"Cleaned {deleted} existing synthetic sessions")

    n = args.participants_per_condition
    total = 0

    # Main generation: all conditions at default freq
    for condition in CONDITIONS:
        freq = DEFAULT_FREQ if condition != "reaction" else 1
        for i in range(n):
            pid = generate_one_session(rng, config, condition, freq, conn)
            total += 1
        print(f"  {condition} (freq={freq}): {n} sessions")

    # Frequency sweep for RQ2
    if args.include_freq_sweep:
        for condition in FREQ_SWEEP_CONDITIONS:
            for freq in FREQ_SWEEP_LEVELS:
                if freq == DEFAULT_FREQ:
                    continue  # already generated above
                for i in range(n):
                    pid = generate_one_session(rng, config, condition, freq, conn)
                    total += 1
                print(f"  {condition} (freq={freq}): {n} sessions [freq-sweep]")

    conn.close()
    print(f"\nDone. Generated {total} synthetic sessions.")


if __name__ == "__main__":
    main()
