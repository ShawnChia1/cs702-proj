"""
Generate participant profiles: demographics, participant IDs, condition assignment.
"""

import uuid

import numpy as np

from .db import SYNTHETIC_PREFIX


def generate_participant_id():
    return f"{SYNTHETIC_PREFIX}{uuid.uuid4().hex[:8].upper()}"


def generate_demographics(rng, config):
    """Generate a single demographics dict from config distributions."""
    demo_cfg = config["demographics"]

    age = int(rng.integers(demo_cfg["age_min"], demo_cfg["age_max"] + 1))

    genders = list(demo_cfg["gender_weights"].keys())
    gender_probs = list(demo_cfg["gender_weights"].values())
    gender = rng.choice(genders, p=gender_probs)

    usages = list(demo_cfg["usage_weights"].keys())
    usage_probs = list(demo_cfg["usage_weights"].values())
    social_media_usage = rng.choice(usages, p=usage_probs)

    all_platforms = demo_cfg["platforms"]
    n_platforms = int(
        rng.integers(demo_cfg["platforms_min"], demo_cfg["platforms_max"] + 1)
    )
    platforms_used = sorted(rng.choice(all_platforms, size=n_platforms, replace=False).tolist())

    return {
        "age": age,
        "gender": gender,
        "social_media_usage": social_media_usage,
        "platforms_used": platforms_used,
    }
