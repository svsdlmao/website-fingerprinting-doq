"""Evaluate the attack and defences on browser-driven DoQ traces.

Same policies, same features and same 5-fold protocol as the main evaluation,
applied to traces whose lookup sequences came from real Chrome page loads.
Browser page loads trigger far more lookups than the HTML crawl found, and
the number varies from visit to visit, so the count grid of the proposed
defence is swept as well: a grid of 32 was enough to equalise the crawled
traces but may not be here.
"""
from __future__ import annotations

import json

import numpy as np
from sklearn.model_selection import StratifiedKFold, cross_val_score

from . import cnn, defenses, features, models, preprocess
from .capture.browser_replay import OUT as BROWSER_RAW
from .config import METRICS, RANDOM_SEED


def load():
    traces = preprocess.clean(preprocess.load_raw(BROWSER_RAW), verbose=True)
    traces, sites = preprocess.relabel(traces)
    keep = {s for s in sites if sum(t["site"] == s for t in traces) >= 5}
    traces = [t for t in traces if t["site"] in keep]
    traces, sites = preprocess.relabel(traces)
    return traces, sites


def run():
    traces, sites = load()
    n_ev = [len(t["events"]) for t in traces]
    y = np.array([t["label"] for t in traces])
    skf = StratifiedKFold(5, shuffle=True, random_state=RANDOM_SEED)
    cnn.SEQ_LEN = 256
    out = {"n_traces": len(traces), "n_sites": len(sites), "random_guess_pct": 100 / len(sites),
           "exchanges_per_trace": {"min": min(n_ev), "max": max(n_ev), "mean": float(np.mean(n_ev)),
                                   "median": float(np.median(n_ev))},
           "policies": {}, "count_grid": []}
    print(f"browser dataset: {len(traces)} traces, {len(sites)} sites, exchanges per trace "
          f"min {min(n_ev)} / median {np.median(n_ev):.0f} / max {max(n_ev)}", flush=True)

    def score(pol):
        d = [defenses.apply(t, pol) for t in traces]
        X, yy, _ = features.matrix(d)
        rf = float(cross_val_score(models.build("RandomForest", len(sites)), X, yy, cv=skf).mean())
        ov = [defenses.overhead(t) for t in d]
        return d, rf, float(np.mean([o["overhead_pct"] for o in ov]))

    for pol in defenses.ORDER:
        d, rf, bw = score(pol)
        cn = cnn.score(cnn.to_sequences(d), y, len(sites))
        out["policies"][pol] = {"rf": rf, "cnn": cn, "overhead_pct": bw}
        print(f"  {defenses.PRETTY[pol]:<22} RF {rf*100:5.1f}%   CNN {cn*100:5.1f}%   bw {bw:.0f}%", flush=True)

    saved = defenses.COUNT_GRID
    try:
        for g in (32, 64, 128, 256, 512):
            defenses.COUNT_GRID = g
            _, rf, bw = score("adaptive")
            out["count_grid"].append({"grid": g, "rf": rf, "overhead_pct": bw})
            print(f"  adaptive, count grid {g:>3}: RF {rf*100:5.1f}%   bw {bw:.0f}%", flush=True)
    finally:
        defenses.COUNT_GRID = saved

    (METRICS / "browser_eval.json").write_text(json.dumps(out, indent=2), encoding="utf-8")


if __name__ == "__main__":
    run()
