"""Module 7 - Result visualisation."""
from __future__ import annotations

import json

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from . import defenses, features, preprocess
from .config import FIGURES, METRICS

PALETTE = ["#2D6A9F", "#D1495B", "#37A06E", "#E0A458", "#7D5BA6", "#4C5C68"]
plt.rcParams.update({
    "figure.dpi": 150, "savefig.dpi": 150, "font.size": 10,
    "axes.spines.top": False, "axes.spines.right": False,
    "axes.grid": True, "grid.alpha": 0.25, "grid.linestyle": "-",
    "axes.axisbelow": True, "figure.facecolor": "white",
})
POLICY_ORDER = defenses.ORDER


def _load():
    return json.loads((METRICS / "results.json").read_text(encoding="utf-8"))


# ------------------------------------------------------------------ fig 1
def fig_attack_vs_defence(res):
    order = ["RandomForest", "GradientBoosting", "MLP", "kNN"]
    present = {c["model"] for c in res["cells"]}
    models = [m for m in order if m in present] + sorted(present - set(order))
    pols = [p for p in POLICY_ORDER if any(c["policy"] == p for c in res["cells"])]
    acc = {(c["policy"], c["model"]): c["accuracy"] * 100 for c in res["cells"]}

    fig, ax = plt.subplots(figsize=(9, 4.6))
    w = 0.8 / len(models)
    x = np.arange(len(pols))
    for i, m in enumerate(models):
        vals = [acc.get((p, m), 0) for p in pols]
        bars = ax.bar(x + i * w - 0.4 + w / 2, vals, w,
                      label=m, color=PALETTE[i % len(PALETTE)], edgecolor="white", linewidth=0.6)
        ax.bar_label(bars, fmt="%.0f", fontsize=7, padding=2)

    ax.axhline(res["random_guess_pct"], color="#4C5C68", ls="--", lw=1.2)
    ax.text(-0.46, res["random_guess_pct"] + 3.5,
            f"random guess ({res['random_guess_pct']:.0f}%)",
            fontsize=8, color="#4C5C68", ha="left", va="bottom")
    ax.set_xticks(x, [defenses.PRETTY[p] for p in pols], fontsize=9)
    ax.set_ylabel("Attacker accuracy (%)")
    ax.set_ylim(0, 112)
    ax.set_title("Website fingerprinting accuracy on live DoQ traffic, by defence",
                 pad=28)
    ax.legend(frameon=False, ncols=len(models), fontsize=8.5,
              loc="lower center", bbox_to_anchor=(0.5, 1.005))
    fig.tight_layout()
    fig.savefig(FIGURES / "fig1_attack_vs_defence.png")
    plt.close(fig)


# ------------------------------------------------------------------ fig 2
def fig_tradeoff(res):
    # label offsets tuned so that policies sharing an x-position stay legible
    OFF = {
        "none":          (12, 6, "left"),
        "rfc8467":       (-12, 4, "right"),
        "rfc8467_count": (14, 10, "left"),
        "adaptive":      (14, -16, "left"),
        "maximal":       (-12, 6, "right"),
    }
    fig, ax = plt.subplots(figsize=(7.6, 4.8))
    for i, p in enumerate(POLICY_ORDER):
        cells = [c for c in res["cells"] if c["policy"] == p]
        if not cells:
            continue
        best = max(c["accuracy"] for c in cells) * 100
        ovh = res["overhead"][p]["overhead_pct"]
        star = p == "adaptive"
        ax.scatter(ovh, best, s=280 if star else 180, color=PALETTE[i], zorder=3,
                   marker="*" if star else "o",
                   edgecolor="white", linewidth=1.4)
        dx, dy, ha = OFF.get(p, (0, 14, "center"))
        label = defenses.PRETTY[p] + chr(10) + f"{best:.0f}% @ {ovh:.0f}% cost"
        ax.annotate(label,
                    (ovh, best), textcoords="offset points", xytext=(dx, dy),
                    ha=ha, fontsize=8.5,
                    weight="bold" if star else "normal",
                    color="#1a1a1a")

    ax.axhline(res["random_guess_pct"], color="#4C5C68", ls="--", lw=1.2)
    ax.set_xlim(-60, 760)
    ax.text(750, res["random_guess_pct"] + 2.5, "random guess (5%)",
            fontsize=8, color="#4C5C68", ha="right")
    ax.set_xlabel("Bandwidth overhead (%)")
    ax.set_ylabel("Best attacker accuracy (%)")
    ax.set_ylim(0, 116)
    ax.set_title("Privacy / cost trade-off: lower and further left is better")
    fig.tight_layout()
    fig.savefig(FIGURES / "fig2_tradeoff.png")
    plt.close(fig)


# ------------------------------------------------------------------ fig 3
def fig_confusion(res, sites):
    best_model = max(
        {c["model"] for c in res["cells"]},
        key=lambda m: np.mean([c["accuracy"] for c in res["cells"] if c["model"] == m]))
    pair = [p for p in ("none", "adaptive") if any(c["policy"] == p for c in res["cells"])]

    fig, axes = plt.subplots(1, len(pair), figsize=(5.4 * len(pair), 5.0))
    axes = np.atleast_1d(axes)
    for ax, pol in zip(axes, pair):
        cell = next(c for c in res["cells"] if c["policy"] == pol and c["model"] == best_model)
        cm = np.asarray(cell["confusion"], dtype=float)
        cm = cm / np.clip(cm.sum(axis=1, keepdims=True), 1, None)
        im = ax.imshow(cm, cmap="Blues", vmin=0, vmax=1)
        ax.set_title(f"{defenses.PRETTY[pol]}\n{best_model}: "
                     f"{cell['accuracy']*100:.1f}% accuracy", fontsize=10)
        ax.set_xlabel("predicted site")
        ax.set_ylabel("true site")
        ax.set_xticks(range(len(sites)))
        ax.set_yticks(range(len(sites)), [s[:20] for s in sites], fontsize=6)
        ax.set_xticklabels([str(i) for i in range(len(sites))], fontsize=6)
        ax.grid(False)
    fig.colorbar(im, ax=axes, fraction=0.03, pad=0.02, label="fraction of true class")
    fig.savefig(FIGURES / "fig3_confusion.png", bbox_inches="tight")
    plt.close(fig)


# ------------------------------------------------------------------ fig 4
def fig_size_distribution(traces):
    """Only the size-distinct policies are drawn: rfc8467, rfc8467+count and
    adaptive pad lengths identically, so they would plot on top of each other."""
    show = [("none", 2.4), ("rfc8467", 1.8), ("maximal", 1.8)]
    fig, ax = plt.subplots(figsize=(8, 4.4))
    for pol, lw in show:
        defended = [defenses.apply(t, pol) for t in traces]
        sizes = [e["r_obs"] for t in defended for e in t["events"]]
        ax.hist(sizes, bins=70, range=(0, 1200), histtype="step", linewidth=lw,
                color=PALETTE[defenses.ORDER.index(pol)],
                label=defenses.PRETTY[pol], density=True)
    ax.set_xlabel("Observed response datagram size (bytes)")
    ax.set_ylabel("density")
    ax.set_title("Padding collapses the response-size distribution to a single value")
    ax.legend(frameon=False, fontsize=8.5)
    ax.text(0.98, 0.55,
            "RFC 8467 + count and Adaptive (proposed)" + chr(10)
            + "pad lengths exactly as RFC 8467 does;" + chr(10)
            + "they differ in count and timing, not size.",
            transform=ax.transAxes, ha="right", va="top",
            fontsize=7.5, color="#4C5C68")
    fig.tight_layout()
    fig.savefig(FIGURES / "fig4_size_distribution.png")
    plt.close(fig)


# ------------------------------------------------------------------ fig 5
def fig_fingerprints(traces, sites):
    """Mean cumulative-byte curve per site - the fingerprint, made visible."""
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.4), sharey=True)
    for ax, pol in zip(axes, ("none", "adaptive")):
        for i, site in enumerate(sites):
            curves = []
            for t in (defenses.apply(t, pol) for t in traces if t["site"] == site):
                tot = [e["q_obs"] + e["r_obs"] for e in t["events"]]
                if not tot:
                    continue
                cum = np.cumsum(tot)
                grid = np.linspace(0, len(cum) - 1, 30).astype(int)
                curves.append(cum[grid])
            if curves:
                ax.plot(np.mean(curves, axis=0) / 1000.0, lw=1.2, alpha=0.85,
                        color=plt.cm.turbo(i / max(len(sites) - 1, 1)))
        ax.set_title(defenses.PRETTY[pol], fontsize=10)
        ax.set_xlabel("query index (normalised)")
    axes[0].set_ylabel("cumulative traffic (kB)")
    fig.suptitle("Per-site cumulative traffic profiles - one line per website", fontsize=11)
    fig.tight_layout()
    fig.savefig(FIGURES / "fig5_fingerprints.png")
    plt.close(fig)


def fig_sweep():
    """Sensitivity of the proposed defence to its two shaping parameters."""
    path = METRICS / "sweep.json"
    if not path.exists():
        return
    rows = json.loads(path.read_text(encoding="utf-8"))
    fig, ax = plt.subplots(figsize=(7.4, 4.5))
    grids = sorted({r["rtt_grid"] for r in rows})
    for i, rg in enumerate(grids):
        sel = sorted((r for r in rows if r["rtt_grid"] == rg),
                     key=lambda r: r["overhead_pct"])
        ax.plot([r["overhead_pct"] for r in sel],
                [r["accuracy"] * 100 for r in sel],
                "-o", color=PALETTE[i], lw=1.6, ms=7,
                label=f"delay grid {rg:.0f} ms")
        if i == 0:      # annotate one series only - both share the x positions
            for r in sel:
                ax.annotate(f"count grid {r['count_grid']}",
                            (r["overhead_pct"], r["accuracy"] * 100),
                            textcoords="offset points", xytext=(6, -14),
                            ha="left", fontsize=8, color="#4C5C68")
    ax.axhline(5.0, color="#4C5C68", ls="--", lw=1.2)
    ax.text(ax.get_xlim()[1], 5.6, "random guess (5%)", fontsize=8,
            color="#4C5C68", ha="right")
    ax.set_xlabel("Bandwidth overhead (%)")
    ax.set_ylabel("Attacker accuracy (%)")
    ax.set_ylim(0, 18)
    ax.set_title("Tuning the proposed defence: a count grid of 32 is the sweet spot")
    ax.legend(frameon=False, fontsize=8.5)
    fig.tight_layout()
    fig.savefig(FIGURES / "fig6_sweep.png")
    plt.close(fig)


def run():
    res = _load()
    traces, sites, _ = preprocess.run(verbose=False)
    fig_attack_vs_defence(res)
    fig_tradeoff(res)
    fig_confusion(res, sites)
    fig_size_distribution(traces)
    fig_fingerprints(traces, sites)
    fig_sweep()
    print(f"figures written to {FIGURES}")


if __name__ == "__main__":
    run()
