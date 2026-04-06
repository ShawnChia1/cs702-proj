"""
Feature engineering nodes: compute d', survey aggregates, dwell-time stats.
"""

import numpy as np
import pandas as pd
from scipy.stats import norm


def compute_participant_features(
    sessions: pd.DataFrame,
    memory_responses: pd.DataFrame,
    survey_responses: pd.DataFrame,
    post_views: pd.DataFrame,
) -> pd.DataFrame:
    """Compute per-participant feature DataFrame."""
    dprime_df = _compute_dprime(memory_responses)
    survey_df = _aggregate_survey(survey_responses)
    dwell_df = _aggregate_dwell(post_views)
    usage_df = _bin_usage(sessions)

    features = sessions[["id", "condition", "friction_frequency"]].rename(columns={"id": "session_id"})
    features["session_id"] = features["session_id"].astype(str)
    features = features.merge(dprime_df, on="session_id", how="left")
    features = features.merge(survey_df, on="session_id", how="left")
    features = features.merge(dwell_df, on="session_id", how="left")
    features = features.merge(usage_df, on="session_id", how="left")

    return features


def _compute_dprime(memory_responses: pd.DataFrame) -> pd.DataFrame:
    """Compute d' per participant with Hautus correction."""
    memory_responses = memory_responses.copy()
    memory_responses["session_id"] = memory_responses["session_id"].astype(str)
    rows = []
    for session_id, group in memory_responses.groupby("session_id"):
        old_items = group[group["memory_label"] == "old"]
        new_items = group[group["memory_label"] == "new"]

        n_old = len(old_items)
        n_new = len(new_items)
        hits = old_items["correct"].sum()
        fas = (~new_items["correct"]).sum()

        # Hautus (1995) correction: replace 0 and 1 rates
        hit_rate = hits / n_old if n_old > 0 else 0.5
        fa_rate = fas / n_new if n_new > 0 else 0.5

        if hit_rate == 1.0:
            hit_rate = (n_old - 0.5) / n_old
        if hit_rate == 0.0:
            hit_rate = 0.5 / n_old
        if fa_rate == 1.0:
            fa_rate = (n_new - 0.5) / n_new
        if fa_rate == 0.0:
            fa_rate = 0.5 / n_new

        dprime = float(norm.ppf(hit_rate) - norm.ppf(fa_rate))

        mean_rt = group["rt_ms"].mean()

        rows.append({
            "session_id": session_id,
            "dprime": dprime,
            "hit_rate": hits / n_old if n_old > 0 else None,
            "fa_rate": fas / n_new if n_new > 0 else None,
            "mean_rt_ms": mean_rt,
        })

    return pd.DataFrame(rows)


def _aggregate_survey(survey_responses: pd.DataFrame) -> pd.DataFrame:
    """Extract frustration (i2), compute satisfaction, attention."""
    survey_responses = survey_responses.copy()
    survey_responses["session_id"] = survey_responses["session_id"].astype(str)
    pivoted = survey_responses.pivot_table(
        index="session_id", columns="question_id", values="value", aggfunc="first"
    )
    # Convert string values to numeric
    for col in pivoted.columns:
        pivoted[col] = pd.to_numeric(pivoted[col], errors="coerce")

    rows = []
    for session_id, row in pivoted.iterrows():
        frustration = row.get("i2")

        # Satisfaction = mean(i1, reverse(i3), i5, i6, i7)
        sat_items = []
        if pd.notna(row.get("i1")):
            sat_items.append(row["i1"])
        if pd.notna(row.get("i3")):
            sat_items.append(6 - row["i3"])  # reverse score
        for q in ["i5", "i6", "i7"]:
            if pd.notna(row.get(q)):
                sat_items.append(row[q])
        satisfaction = np.mean(sat_items) if sat_items else None

        attention = row.get("i4")

        rows.append({
            "session_id": session_id,
            "frustration": frustration,
            "satisfaction": satisfaction,
            "attention": attention,
        })

    return pd.DataFrame(rows)


def _aggregate_dwell(post_views: pd.DataFrame) -> pd.DataFrame:
    """Mean dwell time per participant."""
    post_views = post_views.copy()
    post_views["session_id"] = post_views["session_id"].astype(str)
    return (
        post_views.groupby("session_id")["dwell_ms"]
        .mean()
        .reset_index()
        .rename(columns={"dwell_ms": "mean_dwell_ms"})
    )


def _bin_usage(sessions: pd.DataFrame) -> pd.DataFrame:
    """Map social_media_usage to ordinal."""
    usage_map = {"less-1h": 1, "1-2h": 2, "2-4h": 3, "more-4h": 4}
    df = sessions[["id", "social_media_usage"]].rename(columns={"id": "session_id"})
    df["session_id"] = df["session_id"].astype(str)
    df["usage_ordinal"] = df["social_media_usage"].map(usage_map)
    return df[["session_id", "usage_ordinal"]]
