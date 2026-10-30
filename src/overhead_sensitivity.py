"""MOD-07a (cont.) - Re-score the attack using the measured QUIC overheads.

wire_check.py showed the real per-datagram overhead is not a single constant:
queries carry about 30 B and responses 31-39 B depending on whether an ACK
frame is bundled in.  This re-runs the Random Forest with each observed
length drawn from the measured overhead distribution, to check whether the
modelled constant changed any conclusion.
"""
import json, random, zlib
from collections import Counter
import numpy as np
from sklearn.model_selection import StratifiedKFold, cross_val_score
from . import config, defenses, features, models, preprocess
from .config import METRICS, RANDOM_SEED

def main():
    wc = json.loads((METRICS / "wire_check.json").read_text(encoding="utf-8"))
    rows = wc["rows"]
    q = [r["q_udp"] - r["q_wire"] for r in rows if 0 < r["q_udp"] - r["q_wire"] < 60]
    r = [x["r_udp"] - x["r_wire"] for x in rows if 0 < x["r_udp"] - x["r_wire"] < 60]
    dropped = len(rows) - len(r)
    qd, rd = Counter(q), Counter(r)
    print(f"cleaned: {len(q)} queries, {len(r)} responses ({dropped} mismatched windows dropped)")
    print("query overhead:", sorted(qd.items()), " response overhead:", sorted(rd.items()))

    qv, qw = zip(*qd.items()); rv, rw = zip(*rd.items())
    traces, sites, _ = preprocess.run(verbose=False)
    skf = StratifiedKFold(5, shuffle=True, random_state=RANDOM_SEED)
    out = {"query_overhead_dist": dict(qd), "response_overhead_dist": dict(rd),
           "mismatched_dropped": dropped, "results": {}}
    for pol in ("none", "rfc8467", "rfc8467_count", "adaptive", "maximal"):
        res = {}
        for mode in ("modelled", "measured"):
            d = [defenses.apply(t, pol) for t in traces]
            if mode == "measured":
                for t in d:
                    rng = random.Random(zlib.crc32(f"{t['site']}|{t['visit']}|ovh".encode()))
                    for e in t["events"]:
                        base_q = e["q_obs"] - config.QUIC_OVERHEAD - config.LENGTH_PREFIX
                        base_r = e["r_obs"] - config.QUIC_OVERHEAD - config.LENGTH_PREFIX
                        e["q_obs"] = base_q + rng.choices(qv, qw)[0]
                        e["r_obs"] = base_r + rng.choices(rv, rw)[0]
            X, y, _ = features.matrix(d)
            res[mode] = float(cross_val_score(models.build("RandomForest", len(sites)), X, y, cv=skf).mean())
        out["results"][pol] = res
        print(f"  {defenses.PRETTY[pol]:<22} modelled {res['modelled']*100:5.1f}%   measured {res['measured']*100:5.1f}%")
    (METRICS / "overhead_sensitivity.json").write_text(json.dumps(out, indent=2), encoding="utf-8")

if __name__ == "__main__":
    main()
