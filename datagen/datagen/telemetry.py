"""
Generate telemetry events: post_views, friction_events, and raw events.
"""

from datetime import datetime, timedelta, timezone

import numpy as np


def generate_session_telemetry(rng, config, condition, condition_params, friction_frequency):
    """
    Generate post_views, friction_events, and raw events for one session.

    Returns (post_views, friction_events, raw_events, feed_started_at, feed_ended_at, feed_duration_ms).
    """
    exposure_ids = config["posts"]["exposure"]
    n_posts = len(exposure_ids)  # 20

    # Generate dwell times from log-normal
    mean_ms = condition_params["dwell_ms_mean"]
    sd_ms = condition_params["dwell_ms_sd"]
    # Convert to log-normal parameters
    mu = np.log(mean_ms**2 / np.sqrt(sd_ms**2 + mean_ms**2))
    sigma = np.sqrt(np.log(1 + (sd_ms / mean_ms) ** 2))
    dwell_times = rng.lognormal(mu, sigma, size=n_posts)
    dwell_times = np.clip(dwell_times, 500, 30000).astype(int)

    # Session start: random time in last 7 days
    base_time = datetime.now(timezone.utc) - timedelta(days=int(rng.integers(1, 8)))
    base_time = base_time.replace(
        hour=int(rng.integers(9, 22)),
        minute=int(rng.integers(0, 60)),
        second=0,
        microsecond=0,
    )

    post_views = []
    friction_events = []
    raw_events = []
    current_time = base_time

    for i, post_id in enumerate(exposure_ids):
        post_index = i + 1  # 1-based
        dwell_ms = int(dwell_times[i])

        start_ts = current_time
        end_ts = start_ts + timedelta(milliseconds=dwell_ms)

        # Determine category from post_id prefix
        prefix = post_id.rsplit("-", 1)[0]
        category = _CATEGORY_MAP.get(prefix, prefix)

        post_views.append({
            "post_id": post_id,
            "category": category,
            "start_ts": start_ts.isoformat(),
            "end_ts": end_ts.isoformat(),
            "dwell_ms": dwell_ms,
            "scroll_depth": round(float(rng.uniform(0.7, 1.0)), 2),
        })

        raw_events.append({
            "type": "post_view",
            "ts": start_ts.isoformat(),
            "payload": {
                "postId": post_id,
                "startTs": int(start_ts.timestamp() * 1000),
                "endTs": int(end_ts.timestamp() * 1000),
                "dwellMs": dwell_ms,
                "category": category,
            },
        })

        current_time = end_ts

        # Friction event check
        if condition != "control" and friction_frequency > 0:
            if post_index % friction_frequency == 0:
                friction_ev = _generate_friction_event(
                    rng, condition, condition_params, post_index, current_time
                )
                friction_events.append(friction_ev)

                raw_events.append({
                    "type": "friction_done",
                    "ts": current_time.isoformat(),
                    "payload": {
                        "frictionType": condition,
                        "triggerPostIndex": post_index,
                        "durationMs": friction_ev["duration_ms"],
                        "action": friction_ev["action"],
                    },
                })

                # Advance time by friction duration
                current_time += timedelta(milliseconds=friction_ev["duration_ms"])

        # Small inter-post gap (scroll time)
        gap_ms = int(rng.integers(200, 800))
        current_time += timedelta(milliseconds=gap_ms)

    feed_ended_at = current_time
    feed_duration_ms = int((feed_ended_at - base_time).total_seconds() * 1000)

    return (
        post_views,
        friction_events,
        raw_events,
        base_time.isoformat(),
        feed_ended_at.isoformat(),
        feed_duration_ms,
    )


def _generate_friction_event(rng, condition, condition_params, trigger_index, shown_at):
    """Generate a single friction event."""
    mean_dur = condition_params.get("friction_duration_ms_mean", 2000)
    sd_dur = condition_params.get("friction_duration_ms_sd", 500)
    duration_ms = max(500, int(rng.normal(mean_dur, sd_dur)))

    actions = condition_params.get("friction_actions", ["continue"])
    action = rng.choice(actions)

    return {
        "friction_type": condition,
        "trigger_index": trigger_index,
        "shown_at": shown_at.isoformat(),
        "duration_ms": duration_ms,
        "action": action,
    }


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
