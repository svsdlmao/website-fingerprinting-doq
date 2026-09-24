"""Module 1b - Live DNS-over-QUIC capture.

Opens real RFC 9250 QUIC connections to a public DoQ resolver and replays,
for each monitored website, the domain set discovered by `src.targets`.
Every field stored here is measured, not modelled:

  q_wire  - byte length of the DNS query message actually put on the wire
  r_wire  - byte length of the DNS response returned by the resolver
  rtt_ms  - wall-clock time between sending the query and parsing the reply
  t_ms    - offset of the query from the start of the simulated page load

A page load is represented the way a dual-stack stub resolver behaves: an A
and an AAAA lookup for every hostname the page references, issued over one
reused QUIC connection.
"""
from __future__ import annotations

import json
import random
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import dns.message
import dns.query
import dns.quic
import dns.rcode

from ..config import DOQ_SERVERS, N_VISITS, QUERY_TYPES, RANDOM_SEED, RAW
from .. import targets as targets_mod

_print_lock = threading.Lock()


def _log(msg: str) -> None:
    with _print_lock:
        print(msg, flush=True)


class DoQSession:
    """One reused QUIC connection to a DoQ resolver."""

    def __init__(self, server: dict, timeout: float = 6.0):
        self.server = server
        self.timeout = timeout
        self._mgr = None
        self._conn = None

    def __enter__(self):
        self._open()
        return self

    def __exit__(self, *exc):
        self.close()

    def _open(self):
        self.close()
        self._mgr = dns.quic.SyncQuicManager(server_name=self.server["sni"])
        self._mgr.__enter__()
        self._conn = self._mgr.connect(self.server["ip"], self.server["port"])

    def close(self):
        if self._mgr is not None:
            try:
                self._mgr.__exit__(None, None, None)
            except Exception:
                pass
        self._mgr, self._conn = None, None

    def query(self, qname: str, qtype: str) -> dict | None:
        """Issue one real DoQ query; return measured record or None."""
        q = dns.message.make_query(qname, qtype)
        q.id = 0                      # RFC 9250 s4.2.1: message ID MUST be 0
        q_wire = len(q.to_wire())
        for attempt in range(2):
            try:
                t0 = time.perf_counter()
                r = dns.query.quic(
                    q, self.server["ip"], port=self.server["port"],
                    timeout=self.timeout, connection=self._conn,
                    server_hostname=self.server["sni"],
                )
                rtt = (time.perf_counter() - t0) * 1000.0
                return {
                    "qname": qname,
                    "qtype": qtype,
                    "q_wire": q_wire,
                    "r_wire": len(r.to_wire()),
                    "rtt_ms": round(rtt, 3),
                    "rcode": dns.rcode.to_text(r.rcode()),
                    "n_ans": sum(len(rr) for rr in r.answer),
                }
            except Exception:
                if attempt == 0:
                    self._open()      # connection went away - reopen once
                    continue
                return None
        return None


def capture_visit(sess: DoQSession, target: dict, label: int, visit: int) -> dict:
    """Capture one page-load trace for one website."""
    events, seq = [], 0
    t_start = time.perf_counter()
    for domain in target["domains"]:
        for qtype in QUERY_TYPES:
            rec = sess.query(domain, qtype)
            if rec is None:
                continue
            rec["seq"] = seq
            rec["t_ms"] = round((time.perf_counter() - t_start) * 1000.0, 3)
            events.append(rec)
            seq += 1
    return {
        "site": target["site"],
        "label": label,
        "visit": visit,
        "server": sess.server["name"],
        "captured_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "n_domains": len(target["domains"]),
        "events": events,
    }


def _worker(args):
    wid, jobs, targets = args
    server = DOQ_SERVERS[wid % len(DOQ_SERVERS)]
    out = []
    with DoQSession(server) as sess:
        for label, visit in jobs:
            t = targets[label]
            tr = capture_visit(sess, t, label, visit)
            out.append(tr)
            _log(f"  [w{wid}] {t['site']:<24} visit {visit:>2}  "
                 f"{len(tr['events']):>3} queries")
    return out


def run(n_visits: int = N_VISITS, workers: int = 4, out_path=None) -> list[dict]:
    random.seed(RANDOM_SEED)
    targs = targets_mod.load()
    out_path = out_path or (RAW / "doq_traces.jsonl")

    jobs = [(lbl, v) for v in range(n_visits) for lbl in range(len(targs))]
    random.shuffle(jobs)          # interleave sites so cache state is not a label
    chunks = [jobs[i::workers] for i in range(workers)]

    t0 = time.time()
    traces = []
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for part in ex.map(_worker, [(i, c, targs) for i, c in enumerate(chunks)]):
            traces.extend(part)

    traces.sort(key=lambda t: (t["label"], t["visit"]))
    with out_path.open("w", encoding="utf-8") as fh:
        for tr in traces:
            fh.write(json.dumps(tr) + "\n")

    n_q = sum(len(t["events"]) for t in traces)
    _log(f"\ncaptured {len(traces)} traces / {n_q} live DoQ queries "
         f"in {time.time() - t0:.1f}s -> {out_path}")
    return traces


if __name__ == "__main__":
    import sys
    nv = int(sys.argv[1]) if len(sys.argv) > 1 else N_VISITS
    run(n_visits=nv)
