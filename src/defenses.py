"""Module 3 - Padding / shaping defences applied to captured DoQ traces.

A defence is a pure function from a captured trace to the trace an on-path
attacker would *observe*.  The measured DNS wire lengths and RTTs stay
untouched on disk, so every policy is scored against exactly the same
underlying traffic.

The policies form an ablation.  Our diagnostic showed that RFC 8467 block
padding hides message *lengths* but leaves two channels open - the number of
lookups a page triggers, and the timing of those lookups.  Each policy below
closes one more of those channels, so the evaluation attributes the remaining
leak to a specific cause rather than to "padding" in general.

  none            DoQ with no EDNS(0) padding at all.
  rfc8467         Pad queries to a multiple of 128 B and responses to a
                  multiple of 468 B (RFC 8467 s4.1 recommended policy).
  rfc8467_count   ... and normalise the number of exchanges up to a fixed
                  grid with indistinguishable cover lookups.
  adaptive        ... and additionally quantise response delay and query
                  cadence onto a coarse grid.  This is our proposal.
  maximal         Pad every query to 512 B and every response to 1024 B -
                  the strongest fixed-length policy and the bandwidth
                  upper bound, shown for reference.
"""
from __future__ import annotations

import math
import random
import zlib

from .config import observed_len

# --- RFC 8467 recommended block lengths -----------------------------------
Q_BLOCK = 128
R_BLOCK = 468

# --- our additional shaping parameters ------------------------------------
COUNT_GRID = 32      # exchanges per page load are rounded up to a multiple
                     # (32 chosen by the sweep in src/sweep.py: it is the
                     #  smallest grid that covers every site's real count,
                     #  so the count channel closes completely)
RTT_GRID_MS = 50.0   # observed response delay is quantised to this grid
CADENCE_MS = 25.0    # queries are released on this cadence


def _ceil_block(n: int, block: int) -> int:
    return ((n + block - 1) // block) * block


def _ceil_to(x: float, grid: float) -> float:
    return math.ceil(x / grid) * grid if grid > 0 else x


# ------------------------------------------------------------ size policies
def _sizes_none(ev, rng):
    return ev["q_wire"], ev["r_wire"]


def _sizes_block(ev, rng):
    return _ceil_block(ev["q_wire"], Q_BLOCK), _ceil_block(ev["r_wire"], R_BLOCK)


def _sizes_maximal(ev, rng):
    return max(ev["q_wire"], 512), max(ev["r_wire"], 1024)


# Each policy is (size function, normalise count?, shape timing?)
POLICIES = {
    "none":          (_sizes_none,    False, False),
    "rfc8467":       (_sizes_block,   False, False),
    "rfc8467_count": (_sizes_block,   True,  False),
    "adaptive":      (_sizes_block,   True,  True),
    "maximal":       (_sizes_maximal, False, False),
}

PRETTY = {
    "none":          "No padding",
    "rfc8467":       "RFC 8467 block",
    "rfc8467_count": "RFC 8467 + count",
    "adaptive":      "Adaptive (proposed)",
    "maximal":       "Maximal (512/1024)",
}

# Display order used by the report and the figures.
ORDER = ["none", "rfc8467", "rfc8467_count", "adaptive", "maximal"]


def apply(trace: dict, policy: str, seed: int = 0) -> dict:
    """Return the trace as the attacker observes it under `policy`."""
    size_fn, fix_count, shape_time = POLICIES[policy]
    # NOTE: Python salts str hashing per process, so hash() here would make
    # the cover traffic - and therefore the reported accuracy - irreproducible
    # between runs.  crc32 over a stable key keeps every run identical.
    key = f"{trace['site']}|{trace['visit']}|{policy}|{seed}".encode()
    rng = random.Random(zlib.crc32(key))

    events = []
    for ev in trace["events"]:
        q_pad, r_pad = size_fn(ev, rng)
        events.append({
            **ev,
            "q_obs": observed_len(q_pad),
            "r_obs": observed_len(r_pad),
            "q_raw": observed_len(ev["q_wire"]),
            "r_raw": observed_len(ev["r_wire"]),
            "rtt_true": ev["rtt_ms"],
            "dummy": False,
        })

    # -- layer 2: hide how many lookups the page triggered ------------------
    if fix_count and events:
        target = _ceil_to(len(events), COUNT_GRID)
        span = max(e["t_ms"] for e in events) or 1.0
        while len(events) < target:
            donor = rng.choice([e for e in events if not e["dummy"]])
            events.append({
                "qname": "<cover>", "qtype": "A",
                "q_wire": 0, "r_wire": 0, "n_ans": 0, "rcode": "NOERROR",
                "rtt_ms": donor["rtt_ms"], "rtt_true": 0.0,
                "t_ms": rng.uniform(0, span), "seq": -1,
                # A cover lookup is padded to the same block as a real one,
                # so on the wire it is indistinguishable from real traffic.
                "q_obs": donor["q_obs"], "r_obs": donor["r_obs"],
                "q_raw": 0, "r_raw": 0,
                "dummy": True,
            })

    # -- layer 3: hide when the lookups happened ----------------------------
    if shape_time and events:
        for e in events:
            e["rtt_ms"] = _ceil_to(e["rtt_ms"], RTT_GRID_MS)
        events.sort(key=lambda e: e["t_ms"])
        for i, e in enumerate(events):
            # queries leave on a fixed cadence, so inter-arrival gaps no
            # longer track how fast the resolver answered
            e["t_ms"] = round(i * CADENCE_MS, 3)

    events.sort(key=lambda e: (e["t_ms"], e["seq"]))
    for i, e in enumerate(events):
        e["seq"] = i

    return {**trace, "policy": policy, "events": events}


def overhead(trace: dict) -> dict:
    """Bandwidth and latency cost of the defence applied to this trace."""
    obs = sum(e["q_obs"] + e["r_obs"] for e in trace["events"])
    raw = sum(e["q_raw"] + e["r_raw"] for e in trace["events"])
    real = [e for e in trace["events"] if not e["dummy"]]
    added = [e["rtt_ms"] - e["rtt_true"] for e in real]
    return {
        "bytes_defended": obs,
        "bytes_baseline": raw,
        "overhead_pct": 100.0 * (obs - raw) / raw if raw else 0.0,
        "added_latency_ms": (sum(added) / len(added)) if added else 0.0,
        "n_real": len(real),
        "n_dummy": len(trace["events"]) - len(real),
    }
