"""Module 2 - Preprocessing.

Loads raw capture records, drops traces damaged by resolver timeouts, and
produces a clean, label-encoded trace list ready for defence application and
feature extraction.
"""
from __future__ import annotations

import json
from collections import Counter

from .config import PROCESSED, RAW

MIN_EVENTS = 6          # a trace with fewer live answers is unusable
MIN_COMPLETENESS = 0.7  # fraction of expected queries that must have answered


def load_raw(path=None) -> list[dict]:
    path = path or (RAW / "doq_traces.jsonl")
    with path.open(encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


def clean(traces: list[dict], verbose: bool = True) -> list[dict]:
    kept, dropped = [], Counter()
    for tr in traces:
        expected = tr["n_domains"] * 2          # A + AAAA per hostname
        n = len(tr["events"])
        if n < MIN_EVENTS:
            dropped["too_few_events"] += 1
            continue
        if expected and n / expected < MIN_COMPLETENESS:
            dropped["incomplete"] += 1
            continue
        if any(e["r_wire"] <= 0 for e in tr["events"]):
            dropped["bad_response"] += 1
            continue
        tr = dict(tr)
        tr["events"] = sorted(tr["events"], key=lambda e: e["seq"])
        kept.append(tr)

    if verbose:
        print(f"preprocess: kept {len(kept)}/{len(traces)} traces"
              + (f"  dropped={dict(dropped)}" if dropped else ""))
    return kept


def relabel(traces: list[dict]) -> tuple[list[dict], list[str]]:
    """Re-index labels to 0..K-1 over the sites that actually survived."""
    sites = sorted({t["site"] for t in traces})
    idx = {s: i for i, s in enumerate(sites)}
    for t in traces:
        t["label"] = idx[t["site"]]
    return traces, sites


def summarise(traces: list[dict], sites: list[str]) -> dict:
    per_site = Counter(t["site"] for t in traces)
    n_ev = [len(t["events"]) for t in traces]
    all_r = [e["r_wire"] for t in traces for e in t["events"]]
    all_q = [e["q_wire"] for t in traces for e in t["events"]]
    all_rtt = [e["rtt_ms"] for t in traces for e in t["events"]]
    return {
        "n_traces": len(traces),
        "n_sites": len(sites),
        "n_queries": sum(n_ev),
        "visits_per_site_min": min(per_site.values()),
        "visits_per_site_max": max(per_site.values()),
        "events_per_trace_mean": round(sum(n_ev) / len(n_ev), 2),
        "query_wire_bytes": {"min": min(all_q), "max": max(all_q),
                             "mean": round(sum(all_q) / len(all_q), 1)},
        "response_wire_bytes": {"min": min(all_r), "max": max(all_r),
                                "mean": round(sum(all_r) / len(all_r), 1)},
        "rtt_ms": {"min": round(min(all_rtt), 2), "max": round(max(all_rtt), 2),
                   "mean": round(sum(all_rtt) / len(all_rtt), 2)},
        "sites": sites,
    }


def run(verbose: bool = True):
    traces = clean(load_raw(), verbose=verbose)
    traces, sites = relabel(traces)
    stats = summarise(traces, sites)
    (PROCESSED / "dataset_summary.json").write_text(
        json.dumps(stats, indent=2), encoding="utf-8")
    with (PROCESSED / "traces_clean.jsonl").open("w", encoding="utf-8") as fh:
        for t in traces:
            fh.write(json.dumps(t) + "\n")
    return traces, sites, stats


if __name__ == "__main__":
    _, _, s = run()
    print(json.dumps({k: v for k, v in s.items() if k != "sites"}, indent=2))
