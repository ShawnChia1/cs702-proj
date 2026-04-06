"""
Generate survey responses (Likert 1-5) for general and interface questions.
"""

import numpy as np


def _truncated_normal_likert(rng, mean, sd, size=1):
    """Sample from truncated normal, round to integer [1, 5]."""
    values = rng.normal(mean, sd, size=size)
    values = np.clip(np.round(values), 1, 5).astype(int)
    if size == 1:
        return int(values[0])
    return values.tolist()


def generate_survey_responses(rng, config, condition, condition_params):
    """
    Generate survey responses for one session.

    Returns list of dicts with question_id and value.
    """
    responses = []

    # General questions (g1-g5) — all conditions
    general = config["general_survey"]
    for qid, (mean, sd) in general.items():
        val = _truncated_normal_likert(rng, mean, sd)
        responses.append({"question_id": qid, "value": str(val)})

    # Interface questions (i1-i7) — friction conditions only
    if condition != "control":
        profile = config["survey_profiles"].get(condition, {})

        for qid in ["i1", "i2", "i3", "i4", "i5", "i6", "i7"]:
            if qid == "i2":
                # Frustration uses condition-level params
                mean = condition_params["frustration_mean"]
                sd = condition_params["frustration_sd"]
            else:
                params = profile.get(qid, [3.0, 0.8])
                mean, sd = params[0], params[1]

            val = _truncated_normal_likert(rng, mean, sd)
            responses.append({"question_id": qid, "value": str(val)})

    return responses
