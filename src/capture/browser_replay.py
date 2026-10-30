"""MOD-08a (cont.) - Replay browser lookup sequences over live DNS-over-QUIC.

Takes the hostname sequences recorded by `browser.py` and resolves each one
(A and AAAA) over a real QUIC connection to the DoQ resolver.  The resulting
trace combines two measured quantities:

  t_ms    when the browser asked for the name, taken from Chrome's net-log
  rtt_ms  how long the live DoQ resolver took to answer, measured here

so an observer would see each query leave at the browser's own time and its
response arrive one measured round trip later.  Hostnames that appear on
almost every site (90% or more) are dropped first: those are lookups Chrome
makes for itself, not ones caused by the page.
"""
from __future__ import annotations

import json
import random
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

from ..config import DATA, DOQ_SERVERS, QUERY_TYPES, RANDOM_SEED, RAW
from .doq_client import DoQSession

NETLOGS = DATA / "browser" / "netlogs.jsonl"
OUT = RAW / "doq_traces_browser.jsonl"
COMMON_CUTOFF = 0.9


def load_sequences():
    recs = [json.loads(l) for l in NETLOGS.open(encoding="utf-8")]
    recs = [r for r in recs if len(r["hosts"]) >= 3]
    sites = {r["site"] for r in recs}
    per_site = {}
    for r in recs:
        per_site.setdefault(r["site"], set()).update(h for h, _ in r["hosts"])
    df = Counter(h for hs in per_site.values() for h in hs)
    common = {h for h, c in df.items() if c >= COMMON_CUTOFF * len(sites)}
    for r in recs:
        r["hosts"] = [[h, t] for h, t in r["hosts"] if h not in common]
    return recs, common


def _replay(sess, rec, label):
    events, seq = [], 0
    for host, t_browser in rec["hosts"]:
        for qtype in QUERY_TYPES:
            ev = sess.query(host, qtype)
            if ev is None:
                continue
            ev["seq"] = seq
            ev["t_ms"] = float(t_browser)
            events.append(ev)
            seq += 1
    return {"site": rec["site"], "label": label, "visit": rec["visit"],
            "server": sess.server["name"], "n_domains": len(rec["hosts"]),
            "source": "browser", "events": events}


def run(workers: int = 6):
    recs, common = load_sequences()
    sites = sorted({r["site"] for r in recs})
    lab = {s: i for i, s in enumerate(sites)}
    print(f"{len(recs)} browser visits over {len(sites)} sites; "
          f"dropped {len(common)} browser-wide hostnames: {sorted(common)}", flush=True)
    jobs = list(range(len(recs)))
    random.Random(RANDOM_SEED).shuffle(jobs)
    chunks = [jobs[k::workers] for k in range(workers)]

    def work(arg):
        wid, part = arg
        out = []
        with DoQSession(DOQ_SERVERS[wid % len(DOQ_SERVERS)]) as sess:
            for n, i in enumerate(part):
                out.append(_replay(sess, recs[i], lab[recs[i]["site"]]))
                if n % 20 == 0:
                    print(f"  [w{wid}] {n}/{len(part)}", flush=True)
        return out

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=workers) as ex:
        traces = [t for part in ex.map(work, enumerate(chunks)) for t in part]
    traces.sort(key=lambda t: (t["label"], t["visit"]))
    with OUT.open("w", encoding="utf-8") as fh:
        for t in traces:
            fh.write(json.dumps(t) + "\n")
    print(f"replayed {len(traces)} browser traces, {sum(len(t['events']) for t in traces)} "
          f"live DoQ queries in {time.time()-t0:.0f}s -> {OUT}", flush=True)


if __name__ == "__main__":
    run()
