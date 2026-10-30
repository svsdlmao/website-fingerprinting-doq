"""MOD-08b - Open-world evaluation.

In the closed world the attacker knows the user visited one of the 100
monitored sites.  Here the user may also visit any of several hundred
background sites the attacker has never trained on, and the attacker must
either name the monitored site correctly or answer "unmonitored".

Protocol (as in Panchenko et al. 2016 and Sirinam et al. 2018):
  * monitored traces are split with 5-fold stratified CV, as before;
  * background sites are split into 5 folds *by site*, so every background
    site in a test fold is one the attacker has never seen;
  * the attacker is trained on monitored classes plus one extra
    "unmonitored" class, and a visit is reported as a monitored site only if
    that class wins with probability at or above a threshold.

Reported per threshold:
  TPR  monitored test visits attributed to the correct monitored site
  FPR  background test visits wrongly attributed to some monitored site
"""
from __future__ import annotations

import json
import random
import sys
import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from sklearn.model_selection import GroupKFold, StratifiedKFold

from . import defenses, features, models, preprocess
from . import targets as targets_mod
from .candidates_unmonitored import UNMONITORED
from .capture.doq_client import DoQSession, capture_visit
from .config import CONFIG, DOQ_SERVERS, METRICS, RANDOM_SEED, RAW

BG_TARGETS = CONFIG / "targets_background.json"
BG_RAW = RAW / "doq_traces_background.jsonl"
POLICIES = ["none", "rfc8467", "rfc8467_count", "adaptive", "maximal"]
THRESHOLDS = [0.0, 0.3, 0.5, 0.7]


# ------------------------------------------------------------------ collect
def collect():
    monitored = {t["site"] for t in targets_mod.load()}
    urls = [u for u in UNMONITORED
            if u.split("/")[2] not in monitored]
    with ThreadPoolExecutor(max_workers=16) as ex:
        found = list(ex.map(targets_mod.discover, urls))
    ok = [t for t in found if "error" not in t and len(t["domains"]) >= targets_mod.MIN_DOMAINS
          and t["site"] not in monitored]
    BG_TARGETS.write_text(json.dumps(ok, indent=2), encoding="utf-8")
    print(f"background: {len(ok)} usable of {len(urls)} candidates")


# ------------------------------------------------------------------ capture
def capture(n_visits: int = 2, workers: int = 6):
    bg = json.loads(BG_TARGETS.read_text(encoding="utf-8"))
    jobs = [(i, v) for v in range(n_visits) for i in range(len(bg))]
    random.Random(RANDOM_SEED).shuffle(jobs)
    chunks = [jobs[k::workers] for k in range(workers)]

    def work(arg):
        wid, part = arg
        out = []
        with DoQSession(DOQ_SERVERS[wid % len(DOQ_SERVERS)]) as sess:
            for i, v in part:
                tr = capture_visit(sess, bg[i], label=-1, visit=v)
                out.append(tr)
        return out

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=workers) as ex:
        traces = [t for part in ex.map(work, enumerate(chunks)) for t in part]
    with BG_RAW.open("w", encoding="utf-8") as fh:
        for t in traces:
            fh.write(json.dumps(t) + "\n")
    print(f"captured {len(traces)} background traces, "
          f"{sum(len(t['events']) for t in traces)} queries in {time.time()-t0:.0f}s")


# ----------------------------------------------------------------- evaluate
def evaluate():
    mon, sites, _ = preprocess.run(verbose=False)
    bg = preprocess.clean(preprocess.load_raw(BG_RAW), verbose=False)
    unk = len(sites)
    for t in bg:
        t["label"] = unk
    bg_sites = np.array([t["site"] for t in bg])
    y_mon = np.array([t["label"] for t in mon])

    mon_folds = list(StratifiedKFold(5, shuffle=True, random_state=RANDOM_SEED).split(y_mon, y_mon))
    bg_folds = list(GroupKFold(5).split(bg_sites, groups=bg_sites))

    results = {"n_monitored_sites": len(sites), "n_monitored_traces": len(mon),
               "n_background_sites": int(len(set(bg_sites))), "n_background_traces": len(bg),
               "policies": {}}
    print(f"open world: {len(sites)} monitored sites ({len(mon)} traces), "
          f"{results['n_background_sites']} background sites ({len(bg)} traces)")

    for pol in POLICIES:
        Xm, _, _ = features.matrix([defenses.apply(t, pol) for t in mon])
        Xb, _, _ = features.matrix([defenses.apply(t, pol) for t in bg])
        tp = {th: 0 for th in THRESHOLDS}; fp = {th: 0 for th in THRESHOLDS}
        n_mon_test = n_bg_test = 0
        for (mtr, mte), (btr, bte) in zip(mon_folds, bg_folds):
            X = np.vstack([Xm[mtr], Xb[btr]])
            y = np.concatenate([y_mon[mtr], np.full(len(btr), unk)])
            clf = models.build("RandomForest", unk + 1)
            clf.fit(X, y)
            cls = clf.classes_
            for Xt, truth, is_bg in ((Xm[mte], y_mon[mte], False), (Xb[bte], None, True)):
                proba = clf.predict_proba(Xt)
                top = cls[proba.argmax(1)]
                conf = proba.max(1)
                for th in THRESHOLDS:
                    flagged = (top != unk) & (conf >= th)
                    if is_bg:
                        fp[th] += int(flagged.sum())
                    else:
                        tp[th] += int((flagged & (top == truth)).sum())
            n_mon_test += len(mte); n_bg_test += len(bte)
        row = {str(th): {"tpr": tp[th] / n_mon_test, "fpr": fp[th] / n_bg_test} for th in THRESHOLDS}
        results["policies"][pol] = row
        print(f"  {defenses.PRETTY[pol]:<22}" + "  ".join(
            f"t={th:.1f}: TPR {row[str(th)]['tpr']*100:5.1f}% FPR {row[str(th)]['fpr']*100:5.1f}%"
            for th in THRESHOLDS), flush=True)

    (METRICS / "openworld.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    return results


if __name__ == "__main__":
    step = sys.argv[1] if len(sys.argv) > 1 else "all"
    if step in ("collect", "all"):
        collect()
    if step in ("capture", "all"):
        capture()
    if step in ("evaluate", "all"):
        evaluate()
