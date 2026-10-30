"""MOD-07a - Validate the modelled QUIC framing overhead against real datagrams.

The rest of the pipeline assumes that an on-path observer sees each DNS
message as a UDP payload of (DNS wire length + 33) bytes: a 2-byte RFC 9250
length prefix plus 31 bytes of QUIC framing.  This module checks that
assumption against the actual datagrams our client exchanges with the
resolver.

aioquic is instrumented at the two points where datagrams cross the socket
boundary (`datagrams_to_send` and `receive_datagram`), so every UDP payload
length is recorded exactly as it went on or came off the wire.  Each DoQ
query is sent on its own and the datagrams seen during it are matched to it:
the largest outbound datagram carries the query, the largest inbound one the
response.  The handshake query on each new connection is skipped.
"""
from __future__ import annotations

import json
import statistics
import threading
import time
from collections import Counter

import aioquic.quic.connection as qc

from . import targets as targets_mod
from .capture.doq_client import DoQSession
from .config import DOQ_SERVERS, LENGTH_PREFIX, METRICS, QUIC_OVERHEAD

_LOG: list[tuple[float, str, int]] = []
_LOCK = threading.Lock()

_orig_send = qc.QuicConnection.datagrams_to_send
_orig_recv = qc.QuicConnection.receive_datagram


def _send(self, now):
    out = _orig_send(self, now)
    t = time.perf_counter()
    with _LOCK:
        for data, _addr in out:
            _LOG.append((t, "out", len(data)))
    return out


def _recv(self, data, addr, now):
    with _LOCK:
        _LOG.append((time.perf_counter(), "in", len(data)))
    return _orig_recv(self, data, addr, now)


def run(n_sites: int = 30, verbose: bool = True) -> dict:
    qc.QuicConnection.datagrams_to_send = _send
    qc.QuicConnection.receive_datagram = _recv
    model = LENGTH_PREFIX + QUIC_OVERHEAD
    rows = []
    try:
        targets = targets_mod.load()[:n_sites]
        with DoQSession(DOQ_SERVERS[0]) as sess:
            first = True
            for t in targets:
                for domain in t["domains"]:
                    for qtype in ("A", "AAAA"):
                        with _LOCK:
                            start = len(_LOG)
                        rec = sess.query(domain, qtype)
                        time.sleep(0.02)          # let trailing datagrams land
                        with _LOCK:
                            window = _LOG[start:]
                        if rec is None or first:
                            first = False
                            continue
                        outs = [n for _, d, n in window if d == "out"]
                        ins = [n for _, d, n in window if d == "in"]
                        if not outs or not ins:
                            continue
                        rows.append({
                            "q_wire": rec["q_wire"], "r_wire": rec["r_wire"],
                            "q_udp": max(outs), "r_udp": max(ins),
                        })
    finally:
        qc.QuicConnection.datagrams_to_send = _orig_send
        qc.QuicConnection.receive_datagram = _orig_recv

    q_ovh = [r["q_udp"] - r["q_wire"] for r in rows]
    r_ovh = [r["r_udp"] - r["r_wire"] for r in rows]
    q_err = [r["q_udp"] - (r["q_wire"] + model) for r in rows]
    r_err = [r["r_udp"] - (r["r_wire"] + model) for r in rows]

    def summary(xs):
        return {"mean": round(statistics.mean(xs), 2), "median": statistics.median(xs),
                "min": min(xs), "max": max(xs), "stdev": round(statistics.pstdev(xs), 2),
                "most_common": Counter(xs).most_common(5)}

    out = {
        "n_exchanges": len(rows), "model_overhead": model,
        "query_overhead": summary(q_ovh), "response_overhead": summary(r_ovh),
        "query_error_vs_model": summary(q_err), "response_error_vs_model": summary(r_err),
        "query_within_2B": round(sum(abs(e) <= 2 for e in q_err) / len(rows) * 100, 1),
        "response_within_2B": round(sum(abs(e) <= 2 for e in r_err) / len(rows) * 100, 1),
        "rows": rows,
    }
    (METRICS / "wire_check.json").write_text(json.dumps(out, indent=2), encoding="utf-8")
    if verbose:
        print(f"{len(rows)} live exchanges measured; model overhead = {model} B")
        for k in ("query_overhead", "response_overhead"):
            print(f"  {k:<18} {out[k]}")
        print(f"  within 2 B of model: queries {out['query_within_2B']}%, "
              f"responses {out['response_within_2B']}%")
    return out


if __name__ == "__main__":
    run()
