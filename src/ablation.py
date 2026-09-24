"""Channel ablation - which observable still identifies the site after padding?

RFC 8467 block padding hides message *lengths*, yet the attack still reaches
26.8%.  This module answers where that residual accuracy comes from, by
retraining the attacker on one group of features at a time:

  count only     just the number of exchanges in the page load
  volume only    total-byte features, which scale with that count
  length shape   per-message length statistics, histograms and the size prefix
  timing only    round-trip times and inter-arrival gaps
  all channels   the full 118-feature vector

The numbers it prints are the ones quoted on the Key Findings slide.
"""
from __future__ import annotations

import json

import numpy as np
from sklearn.model_selection import StratifiedKFold, cross_val_score

from . import defenses, features, models, preprocess
from .config import METRICS, RANDOM_SEED

def _timing(n):
    return n.startswith(("rtt_", "iat_", "duration", "bytes_per_ms"))


def _count(n):
    return n == "n_events"


def _volume(n):
    # Totals scale with the number of exchanges, so once every message is
    # padded to the same block these are a proxy for the count channel -
    # they are scored separately from per-message length shape for that reason.
    return not _timing(n) and (n.startswith(("bytes_", "cum")))


def _shape(n):
    return not (_timing(n) or _count(n) or _volume(n))


GROUPS = {
    "count only": _count,
    "volume only": _volume,
    "length shape": _shape,
    "timing only": _timing,
    "all channels": lambda n: True,
}


def run(policy: str = "rfc8467", model_name: str = "RandomForest", verbose: bool = True):
    traces, sites, _ = preprocess.run(verbose=False)
    defended = [defenses.apply(t, policy) for t in traces]
    X, y, names = features.matrix(defended)
    skf = StratifiedKFold(5, shuffle=True, random_state=RANDOM_SEED)

    out = {"policy": policy, "model": model_name,
           "random_guess_pct": 100.0 / len(sites), "groups": {}}

    if verbose:
        print(f"Channel ablation under '{defenses.PRETTY[policy]}' "
              f"({model_name}, 5-fold CV, {len(sites)} sites)\n")
        print(f"{'feature group':<16}{'features':>10}{'accuracy':>11}")
        print("-" * 37)

    for label, keep in GROUPS.items():
        idx = [i for i, n in enumerate(names) if keep(n)]
        if not idx:
            continue
        acc = float(cross_val_score(models.build(model_name), X[:, idx], y, cv=skf).mean())
        out["groups"][label] = {"n_features": len(idx), "accuracy": acc}
        if verbose:
            print(f"{label:<16}{len(idx):>10}{acc * 100:>10.1f}%")

    if verbose:
        print(f"\nrandom guess    {'':>10}{out['random_guess_pct']:>10.1f}%")

    (METRICS / "ablation.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
    return out


if __name__ == "__main__":
    run()
