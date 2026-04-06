"""
Generate memory test responses from target d'.

Uses signal detection theory:
  d' = Z(hit_rate) - Z(false_alarm_rate)

Given a target d', we fix the criterion c at 0 (unbiased) so:
  hit_rate = Phi(d'/2)
  fa_rate  = Phi(-d'/2)

Individual trials are Bernoulli draws from these rates.
"""

import numpy as np
from scipy.stats import norm


def _rates_from_dprime(dprime, criterion=0.0):
    """Compute hit rate and false alarm rate from d' and criterion."""
    hit_rate = norm.cdf(dprime / 2 - criterion)
    fa_rate = norm.cdf(-dprime / 2 - criterion)
    return float(hit_rate), float(fa_rate)


def generate_memory_responses(rng, config, condition_params):
    """
    Generate memory test responses for one session.

    Returns list of dicts matching memory_responses table schema.
    """
    mem_cfg = config["memory_test"]
    old_count = mem_cfg["old_count"]
    new_count = mem_cfg["new_count"]

    exposure_ids = config["posts"]["exposure"]
    distractor_ids = config["posts"]["distractor"]

    # Sample target d' for this participant
    dprime = rng.normal(condition_params["dprime_mean"], condition_params["dprime_sd"])
    dprime = max(dprime, -0.5)  # floor to prevent extreme negatives

    hit_rate, fa_rate = _rates_from_dprime(dprime)

    # Sample old items from exposure posts
    old_post_ids = rng.choice(exposure_ids, size=old_count, replace=False).tolist()

    # All distractors as new items
    new_post_ids = distractor_ids[:new_count]

    responses = []

    # Category lookup
    categories = _build_category_map(config)

    for post_id in old_post_ids:
        correct = bool(rng.random() < hit_rate)
        participant_answer = "old" if correct else "new"
        rt_ms = int(rng.lognormal(mean=7.0, sigma=0.5))  # ~1100ms median
        rt_ms = max(300, min(rt_ms, 5000))
        responses.append({
            "post_id": post_id,
            "memory_label": "old",
            "participant_answer": participant_answer,
            "correct": correct,
            "rt_ms": rt_ms,
            "category": categories.get(post_id),
        })

    for post_id in new_post_ids:
        false_alarm = bool(rng.random() < fa_rate)
        participant_answer = "old" if false_alarm else "new"
        correct = not false_alarm
        rt_ms = int(rng.lognormal(mean=7.1, sigma=0.5))  # slightly slower for new
        rt_ms = max(300, min(rt_ms, 5000))
        responses.append({
            "post_id": post_id,
            "memory_label": "new",
            "participant_answer": participant_answer,
            "correct": correct,
            "rt_ms": rt_ms,
            "category": categories.get(post_id),
        })

    # Shuffle to match the app's Fisher-Yates shuffle
    rng.shuffle(responses)

    return responses, dprime


def compute_rates(responses):
    """Compute actual hit rate and FA rate from generated responses."""
    old_items = [r for r in responses if r["memory_label"] == "old"]
    new_items = [r for r in responses if r["memory_label"] == "new"]
    hits = sum(1 for r in old_items if r["correct"])
    fas = sum(1 for r in new_items if not r["correct"])
    hit_rate = hits / len(old_items) if old_items else 0
    fa_rate = fas / len(new_items) if new_items else 0
    return hit_rate, fa_rate


# Map post IDs to categories based on prefix
_CATEGORY_MAP = {
    "art": "Art",
    "cook": "Cooking",
    "learn": "Learning",
    "sport": "Sports",
    "pd": "Personal Development",
    "ent": "Entrepreneurship",
    "tech": "Technology",
    "yoga": "Yoga",
    "res": "Research",
    "hob": "Hobbies",
}


def _build_category_map(config):
    """Build post_id -> category mapping."""
    result = {}
    all_ids = config["posts"]["exposure"] + config["posts"]["distractor"]
    for pid in all_ids:
        prefix = pid.rsplit("-", 1)[0]
        result[pid] = _CATEGORY_MAP.get(prefix, prefix)
    return result
