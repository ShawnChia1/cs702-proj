"""
Reporting nodes: generate plots and summary statistics.
"""

import json
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "output")

# Presentation color palette
COLORS = {
    "control": "#9CA3AF",      # gray
    "reaction": "#115E59",     # dark teal
    "button": "#059669",       # green
    "feedback": "#7C3AED",     # purple
    "slowdown": "#06B6D4",     # cyan
}

CONDITION_ORDER = ["control", "reaction", "button", "feedback", "slowdown"]
CONDITION_LABELS = {
    "control": "Control",
    "reaction": "Reaction",
    "button": "Button\nToggle",
    "feedback": "Content\nFeedback",
    "slowdown": "Adaptive\nSlowdown",
}


def _ensure_output_dir():
    os.makedirs(OUTPUT_DIR, exist_ok=True)


def plot_rq1(rq1_results: dict) -> None:
    """RQ1: Side-by-side bar charts for d' and frustration by condition."""
    _ensure_output_dir()
    cstats = rq1_results.get("condition_stats", {})

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

    # d' by condition
    conditions = [c for c in CONDITION_ORDER if c in cstats]
    x = np.arange(len(conditions))
    dprime_means = [cstats[c]["dprime_mean"] or 0 for c in conditions]
    dprime_ses = [cstats[c]["dprime_se"] or 0 for c in conditions]
    colors = [COLORS[c] for c in conditions]
    labels = [CONDITION_LABELS[c] for c in conditions]

    bars1 = ax1.bar(x, dprime_means, yerr=dprime_ses, capsize=4,
                    color=colors, edgecolor="white", linewidth=0.5)
    ax1.set_xticks(x)
    ax1.set_xticklabels(labels, fontsize=9)
    ax1.set_ylabel("d'", fontsize=12)
    ax1.set_title("d' by Condition", fontsize=14, fontweight="bold")
    ax1.set_ylim(0, max(dprime_means) * 1.3 if dprime_means else 2)

    # Add significance stars
    pairwise = rq1_results.get("pairwise", {})
    for i, cond in enumerate(conditions):
        if cond == "control":
            continue
        pw = pairwise.get(cond, {})
        sig = pw.get("significant", False)
        n = cstats[cond].get("n", 0)
        label = f"{n}"
        if sig:
            label = f"*\n{n}"
        ax1.text(i, dprime_means[i] + dprime_ses[i] + 0.05,
                 label, ha="center", va="bottom", fontsize=9)

    # Frustration by condition
    frust_means = [cstats[c]["frustration_mean"] or 0 for c in conditions]
    frust_ses = [cstats[c]["frustration_se"] or 0 for c in conditions]

    bars2 = ax2.bar(x, frust_means, yerr=frust_ses, capsize=4,
                    color=colors, edgecolor="white", linewidth=0.5)
    ax2.set_xticks(x)
    ax2.set_xticklabels(labels, fontsize=9, rotation=30, ha="right")
    ax2.set_ylabel("Frustration (i2, Likert 1-5)", fontsize=10)
    ax2.set_title("Frustration (i2 Likert, 1\u20135)", fontsize=14, fontweight="bold")
    ax2.set_ylim(0, 5.5)

    for i, cond in enumerate(conditions):
        n = cstats[cond].get("n", 0)
        ax2.text(i, frust_means[i] + frust_ses[i] + 0.1, str(n),
                 ha="center", va="bottom", fontsize=9)

    plt.tight_layout()
    path = os.path.join(OUTPUT_DIR, "rq1_dprime_frustration.png")
    fig.savefig(path, dpi=300, bbox_inches="tight")
    fig.savefig(path.replace(".png", ".svg"), bbox_inches="tight")
    plt.close(fig)


def plot_rq2(rq2_results: dict) -> None:
    """RQ2: Line chart of d' and frustration vs frequency."""
    _ensure_output_dir()
    fstats = rq2_results.get("freq_stats", {})

    fig, ax = plt.subplots(figsize=(10, 6))
    freqs = [3, 5, 10, 15]
    freq_labels = [f"freq = {f}\n(every {f} posts)" for f in freqs]

    for cond, style in [("button", "-"), ("feedback", "-")]:
        color = COLORS[cond]
        if cond not in fstats:
            continue
        dprime_vals = [fstats[cond].get(str(f), {}).get("dprime_mean") for f in freqs]
        frust_vals = [fstats[cond].get(str(f), {}).get("frustration_mean") for f in freqs]

        label_name = "Button" if cond == "button" else "Feedback"
        ax.plot(range(len(freqs)), dprime_vals, style + "o", color=color,
                label=f"{label_name} \u2014 d'", linewidth=2, markersize=6)
        ax.plot(range(len(freqs)), frust_vals, "--s", color=color,
                label=f"{label_name} \u2014 Frustration", linewidth=2, markersize=6, alpha=0.7)

    ax.set_xticks(range(len(freqs)))
    ax.set_xticklabels(freq_labels, fontsize=10)
    ax.set_ylabel("Score", fontsize=12)
    ax.set_title("d' (solid) and Frustration (dashed) by Friction\nFrequency",
                 fontsize=14, fontweight="bold")
    ax.legend(loc="upper right", fontsize=9)
    ax.set_ylim(0, 5)
    ax.grid(axis="y", alpha=0.3)

    plt.tight_layout()
    path = os.path.join(OUTPUT_DIR, "rq2_frequency_tradeoff.png")
    fig.savefig(path, dpi=300, bbox_inches="tight")
    fig.savefig(path.replace(".png", ".svg"), bbox_inches="tight")
    plt.close(fig)


def plot_rq3(rq3_results: dict) -> None:
    """RQ3: Pareto scatter — d' vs satisfaction."""
    _ensure_output_dir()
    points = rq3_results.get("points", {})
    pareto = rq3_results.get("pareto_optimal", [])

    fig, ax = plt.subplots(figsize=(8, 6))

    for cond in ["reaction", "button", "feedback", "slowdown"]:
        p = points.get(cond, {})
        if p.get("dprime_mean") is None:
            continue
        marker = "*" if cond in pareto else "o"
        size = 200 if cond in pareto else 100
        ax.scatter(p["dprime_mean"], p["satisfaction_mean"],
                   c=COLORS[cond], s=size, marker=marker,
                   label=CONDITION_LABELS[cond].replace("\n", " "),
                   edgecolors="white", linewidth=1.5, zorder=5)
        ax.annotate(CONDITION_LABELS[cond].replace("\n", " "),
                    (p["dprime_mean"], p["satisfaction_mean"]),
                    textcoords="offset points", xytext=(10, 5), fontsize=9)

    ax.set_xlabel("d' (Memory Recall)", fontsize=12)
    ax.set_ylabel("Mean Satisfaction", fontsize=12)
    ax.set_title("d' (x) vs. Mean Satisfaction (y) \u2014 5 conditions",
                 fontsize=14, fontweight="bold")
    ax.grid(alpha=0.3)
    ax.legend(fontsize=9)

    plt.tight_layout()
    path = os.path.join(OUTPUT_DIR, "rq3_pareto_scatter.png")
    fig.savefig(path, dpi=300, bbox_inches="tight")
    fig.savefig(path.replace(".png", ".svg"), bbox_inches="tight")
    plt.close(fig)


def plot_rq4_radar(rq4_results: dict) -> None:
    """RQ4: Radar chart of 7-item interface survey."""
    _ensure_output_dir()
    radar_data = rq4_results.get("radar_data", {})
    labels = rq4_results.get("radar_labels", [])

    if not labels or not radar_data:
        return

    n_vars = len(labels)
    angles = np.linspace(0, 2 * np.pi, n_vars, endpoint=False).tolist()
    angles += angles[:1]  # close the polygon

    fig, ax = plt.subplots(figsize=(7, 7), subplot_kw=dict(polar=True))

    for cond in ["reaction", "feedback", "slowdown"]:
        if cond not in radar_data:
            continue
        values = [radar_data[cond].get(l, 0) or 0 for l in labels]
        values += values[:1]
        ax.plot(angles, values, "o-", color=COLORS[cond], linewidth=2,
                label=CONDITION_LABELS[cond].replace("\n", " "), markersize=5)
        ax.fill(angles, values, color=COLORS[cond], alpha=0.1)

    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(labels, fontsize=9)
    ax.set_ylim(0, 5)
    ax.set_title("7-item Interface Survey \u2014 3 Conditions",
                 fontsize=14, fontweight="bold", pad=20)
    ax.legend(loc="lower right", bbox_to_anchor=(1.2, 0), fontsize=9)

    plt.tight_layout()
    path = os.path.join(OUTPUT_DIR, "rq4_radar_survey.png")
    fig.savefig(path, dpi=300, bbox_inches="tight")
    fig.savefig(path.replace(".png", ".svg"), bbox_inches="tight")
    plt.close(fig)


def plot_rq4_usage(rq4_results: dict) -> None:
    """RQ4: Horizontal bar chart of d' improvement by usage group."""
    _ensure_output_dir()
    usage = rq4_results.get("usage_improvement", {})

    if not usage:
        return

    fig, ax = plt.subplots(figsize=(8, 4))

    usage_order = ["less-1h", "1-2h", "2-4h", "more-4h"]
    usage_labels = ["< 1 h / day", "1\u20132 h / day", "2\u20134 h / day", "> 4 h / day"]
    bar_colors = ["#059669", "#059669", "#EAB308", "#DC2626"]

    y_pos = range(len(usage_order))
    improvements = []
    for u in usage_order:
        improvements.append(usage.get(u, {}).get("dprime_improvement", 0))

    ax.barh(y_pos, improvements, color=bar_colors, height=0.6, edgecolor="white")
    ax.set_yticks(y_pos)
    ax.set_yticklabels(usage_labels, fontsize=10)
    ax.set_xlabel("d' Improvement over Control", fontsize=11)
    ax.set_title("d' Improvement vs. Daily Usage", fontsize=14, fontweight="bold",
                 color="#059669")
    ax.invert_yaxis()

    for i, val in enumerate(improvements):
        ax.text(val + 0.02, i, f"+{val:.2f}", va="center", fontsize=10, fontweight="bold",
                color="#059669")

    ax.grid(axis="x", alpha=0.3)
    plt.tight_layout()
    path = os.path.join(OUTPUT_DIR, "rq4_usage_dprime.png")
    fig.savefig(path, dpi=300, bbox_inches="tight")
    fig.savefig(path.replace(".png", ".svg"), bbox_inches="tight")
    plt.close(fig)


def generate_summary_stats(
    rq1_results: dict, rq2_results: dict, rq3_results: dict, rq4_results: dict
) -> dict:
    """Combine all results into a single summary JSON."""
    return {
        "rq1": rq1_results,
        "rq2": rq2_results,
        "rq3": rq3_results,
        "rq4": rq4_results,
    }
