"""Strengthening the timing layer, tuned against the strongest attacker.

The 1-D CNN reached 13.9% against the proposed defence, against 5.5% for the
feature-based models, and most of what it exploits after count normalisation
is timing.  This sweeps the response-delay grid of the adaptive policy from
50 ms up to 1 s and scores every setting against both the CNN and the Random
Forest, together with the latency it adds.  Delays are only ever rounded *up*,
so every setting is something a real client could implement by holding
responses back.
"""
from __future__ import annotations

import json

import numpy as np
from sklearn.model_selection import StratifiedKFold, cross_val_score

from . import cnn, defenses, features, models, preprocess
from .config import METRICS, RANDOM_SEED

GRIDS = [50, 100, 250, 500, 1000]


def run():
    traces, sites, _ = preprocess.run(verbose=False)
    y = np.array([t["label"] for t in traces])
    skf = StratifiedKFold(5, shuffle=True, random_state=RANDOM_SEED)
    saved = defenses.RTT_GRID_MS
    rows = []
    try:
        for g in GRIDS:
            defenses.RTT_GRID_MS = float(g)
            d = [defenses.apply(t, "adaptive") for t in traces]
            X, yy, _ = features.matrix(d)
            rf = float(cross_val_score(models.build("RandomForest", len(sites)), X, yy, cv=skf).mean())
            cn = cnn.score(cnn.to_sequences(d), y, len(sites))
            ov = [defenses.overhead(t) for t in d]
            lat = float(np.mean([o["added_latency_ms"] for o in ov]))
            bw = float(np.mean([o["overhead_pct"] for o in ov]))
            rows.append({"delay_grid_ms": g, "rf": rf, "cnn": cn, "added_latency_ms": lat, "overhead_pct": bw})
            print(f"  delay grid {g:>5} ms   RF {rf*100:5.1f}%   CNN {cn*100:5.1f}%   "
                  f"+{lat:6.1f} ms   bw {bw:.0f}%", flush=True)
    finally:
        defenses.RTT_GRID_MS = saved
    (METRICS / "timing_sweep.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")


if __name__ == "__main__":
    run()
