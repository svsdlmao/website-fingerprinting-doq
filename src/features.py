"""Module 4 - Feature extraction.

Attacker model
--------------
The adversary is passive and on-path.  DoQ is encrypted, so it can observe
*only* the direction, the byte length and the arrival time of each UDP
datagram.  Every feature below is derived exclusively from those three
quantities - hostnames, DNS record contents and response codes are never
used, even though our capture stores them for analysis.
"""
from __future__ import annotations

import math

import numpy as np

R_BINS = [0, 80, 120, 160, 200, 260, 340, 440, 560, 720, 960, 1100, 1300, 1600, 2000, 10_000]
Q_BINS = [0, 60, 80, 100, 140, 180, 260, 400, 560, 10_000]
HEAD = 20          # length of the observed size prefix
N_CUM = 10         # cumulative-volume sampling points


def _stats(xs: list[float], prefix: str) -> dict:
    if not xs:
        return {f"{prefix}_{k}": 0.0 for k in
                ("mean", "std", "min", "max", "med", "p25", "p75", "sum")}
    a = np.asarray(xs, dtype=float)
    return {
        f"{prefix}_mean": float(a.mean()),
        f"{prefix}_std": float(a.std()),
        f"{prefix}_min": float(a.min()),
        f"{prefix}_max": float(a.max()),
        f"{prefix}_med": float(np.median(a)),
        f"{prefix}_p25": float(np.percentile(a, 25)),
        f"{prefix}_p75": float(np.percentile(a, 75)),
        f"{prefix}_sum": float(a.sum()),
    }


def _entropy(xs: list[float]) -> float:
    if not xs:
        return 0.0
    _, counts = np.unique(np.asarray(xs), return_counts=True)
    p = counts / counts.sum()
    return float(-(p * np.log2(p)).sum())


def _hist(xs: list[float], bins: list[int], prefix: str) -> dict:
    h, _ = np.histogram(np.asarray(xs, dtype=float) if xs else np.zeros(0), bins=bins)
    return {f"{prefix}_bin{i}": float(v) for i, v in enumerate(h)}


def extract(trace: dict) -> dict:
    ev = trace["events"]
    q = [e["q_obs"] for e in ev]
    r = [e["r_obs"] for e in ev]
    t = [e["t_ms"] for e in ev]
    rtt = [e["rtt_ms"] for e in ev]
    tot = [a + b for a, b in zip(q, r)]

    f: dict[str, float] = {}

    # ---- volume ------------------------------------------------------
    f["n_events"] = float(len(ev))
    f["bytes_q"] = float(sum(q))
    f["bytes_r"] = float(sum(r))
    f["bytes_total"] = float(sum(tot))
    f["ratio_r_q"] = float(sum(r) / sum(q)) if sum(q) else 0.0
    f["bytes_per_event"] = float(sum(tot) / len(ev)) if ev else 0.0

    # ---- size distributions -----------------------------------------
    f.update(_stats(q, "q"))
    f.update(_stats(r, "r"))
    f["q_uniq"] = float(len(set(q)))
    f["r_uniq"] = float(len(set(r)))
    f["q_entropy"] = _entropy(q)
    f["r_entropy"] = _entropy(r)
    f.update(_hist(q, Q_BINS, "qh"))
    f.update(_hist(r, R_BINS, "rh"))

    # ---- observed size sequence (prefix) ------------------------------
    for i in range(HEAD):
        f[f"seq_q{i}"] = float(q[i]) if i < len(q) else 0.0
        f[f"seq_r{i}"] = float(r[i]) if i < len(r) else 0.0

    # ---- cumulative volume trace --------------------------------------
    if tot:
        cum = np.cumsum(np.asarray(tot, dtype=float))
        idx = np.linspace(0, len(cum) - 1, N_CUM).astype(int)
        for i, v in enumerate(cum[idx]):
            f[f"cum{i}"] = float(v)
    else:
        for i in range(N_CUM):
            f[f"cum{i}"] = 0.0

    # ---- timing --------------------------------------------------------
    dur = (max(t) - min(t)) if t else 0.0
    f["duration_ms"] = float(dur)
    f["bytes_per_ms"] = float(sum(tot) / dur) if dur > 0 else 0.0
    iat = list(np.diff(np.sort(np.asarray(t, dtype=float)))) if len(t) > 1 else []
    f.update(_stats(iat, "iat"))
    f.update(_stats(rtt, "rtt"))

    return f


def matrix(traces: list[dict]):
    """Return (X, y, feature_names) for a list of defended traces."""
    rows = [extract(t) for t in traces]
    names = sorted(rows[0].keys())
    X = np.asarray([[row[n] for n in names] for row in rows], dtype=np.float64)
    y = np.asarray([t["label"] for t in traces], dtype=np.int64)
    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
    return X, y, names
