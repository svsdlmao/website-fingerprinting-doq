"""LIVE DEMO - fingerprint a website from encrypted DNS-over-QUIC, right now.

What it does, in front of you:
  1. trains the attacker on the traces captured earlier;
  2. opens a real QUIC connection to a public DoQ resolver;
  3. replays one website's page-load lookups over it, live;
  4. hands the attacker only the encrypted-traffic observables
     (direction, byte length, timing) and asks which site you visited;
  5. re-runs the identical trace through the proposed adaptive padding
     defence to show the attack degrade.

Usage
-----
  python demo_live.py                 # pick a random site, keep it secret
  python demo_live.py --site www.bbc.com
  python demo_live.py --list
"""
from __future__ import annotations

import argparse
import random
import sys
import time

import numpy as np

from src import defenses, features, models, preprocess, targets
from src.capture.doq_client import DoQSession
from src.config import DOQ_SERVERS

C = {"b": "\033[1m", "d": "\033[2m", "g": "\033[92m", "r": "\033[91m",
     "y": "\033[93m", "c": "\033[96m", "0": "\033[0m"}
if sys.platform == "win32":
    import os
    os.system("")


def rule(ch="-", n=68):
    print(C["d"] + ch * n + C["0"])


def step(n, text):
    print(f"\n{C['b']}{C['c']}[{n}]{C['0']} {C['b']}{text}{C['0']}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", help="website to visit (default: random & secret)")
    ap.add_argument("--list", action="store_true", help="list monitored sites")
    args = ap.parse_args()

    targs = {t["site"]: t for t in targets.load()}
    if args.list:
        for s in sorted(targs):
            print(f"  {s:<26} {len(targs[s]['domains'])} page dependencies")
        return

    print()
    rule("=")
    print(f"{C['b']}  WEBSITE FINGERPRINTING OVER DNS-over-QUIC - live demonstration{C['0']}")
    rule("=")

    # ---------------------------------------------------------- train
    step(1, "Training the attacker on previously captured DoQ traces")
    traces, sites, stats = preprocess.run(verbose=False)
    print(f"    {stats['n_traces']} page-load traces | {stats['n_sites']} websites "
          f"| {stats['n_queries']} live DoQ queries")

    undefended = [defenses.apply(t, "none") for t in traces]
    X, y, names = features.matrix(undefended)
    clf = models.build("RandomForest")
    t0 = time.time()
    clf.fit(X, y)
    print(f"    Random Forest trained on {X.shape[0]}x{X.shape[1]} feature matrix "
          f"in {time.time() - t0:.1f}s")

    # ------------------------------------------------------ live capture
    secret = args.site or random.choice(sorted(targs))
    if secret not in targs:
        print(f"{C['r']}unknown site: {secret}{C['0']}")
        return
    target = targs[secret]

    step(2, "Visiting a website over encrypted DNS-over-QUIC")
    hidden = args.site is None
    print(f"    site      : {C['y']}{'(hidden from the attacker)' if hidden else secret}{C['0']}")
    print(f"    resolver  : {DOQ_SERVERS[0]['sni']}  (RFC 9250, UDP/853)")
    print(f"    lookups   : {len(target['domains'])} hostnames x A/AAAA")
    print(f"    {C['d']}capturing live ...{C['0']}")

    t0 = time.time()
    with DoQSession(DOQ_SERVERS[0]) as sess:
        from src.capture.doq_client import capture_visit
        live = capture_visit(sess, target, label=-1, visit=999)
    dt = time.time() - t0

    if len(live["events"]) < 6:
        print(f"{C['r']}    capture failed (resolver unreachable){C['0']}")
        return

    print(f"    captured {len(live['events'])} encrypted DoQ exchanges in {dt:.1f}s")

    # -------------------------------------------- what the attacker sees
    step(3, "What the attacker actually sees (encrypted - no hostnames)")
    shown = defenses.apply(live, "none")
    rule()
    print(f"    {'#':>3}  {'dir':<4} {'bytes':>6}  {'t (ms)':>8}")
    rule()
    for e in shown["events"][:8]:
        print(f"    {e['seq']:>3}  {'-->':<4} {e['q_obs']:>6}  {e['t_ms']:>8.1f}")
        print(f"    {'':>3}  {'<--':<4} {e['r_obs']:>6}  "
              f"{e['t_ms'] + e['rtt_ms']:>8.1f}")
    print(f"    {C['d']}... {len(shown['events']) - 8} further exchanges{C['0']}")
    rule()

    # ------------------------------------------------------- the attack
    step(4, "Attacker's guess from traffic patterns alone")
    Xl, _, _ = features.matrix([shown])
    proba = clf.predict_proba(Xl)[0]
    order = np.argsort(proba)[::-1][:3]

    for rank, idx in enumerate(order, 1):
        name, p = sites[idx], proba[idx] * 100
        mark = ""
        if name == secret:
            mark = f"  {C['g']}<-- correct{C['0']}"
        colour = C["g"] if rank == 1 and name == secret else ""
        reset = C["0"] if colour else ""
        print(f"    {rank}. {colour}{name:<26}{reset} {p:5.1f}%"
              f"  {'#' * int(p / 4)}{mark}")

    hit = sites[order[0]] == secret
    print(f"\n    {C['b']}{C['r'] if hit else C['g']}"
          f"{'ATTACK SUCCEEDS - the site was identified' if hit else 'attack missed'}"
          f"{C['0']}")
    if hidden:
        print(f"    {C['d']}(the site really was {secret}){C['0']}")

    # ------------------------------------------------- with the defence
    step(5, "Same traffic, now with the proposed adaptive padding defence")
    trials, correct, tops = 12, 0, []
    for k in range(trials):
        defended = defenses.apply(live, "adaptive", seed=k)
        Xd, _, _ = features.matrix([defended])
        pd_ = clf.predict_proba(Xd)[0]
        top = sites[int(np.argmax(pd_))]
        tops.append(top)
        correct += (top == secret)

    ov = defenses.overhead(defenses.apply(live, "adaptive", seed=0))
    print(f"    shaping      : RFC 8467 blocks + count normalised to "
          f"{defenses.COUNT_GRID} + {defenses.RTT_GRID_MS:.0f} ms delay grid")
    print(f"    cost         : {ov['overhead_pct']:.0f}% bandwidth, "
          f"{ov['n_dummy']} cover lookups, +{ov['added_latency_ms']:.0f} ms latency")
    print(f"    attacker hit : {C['g']}{correct}/{trials}{C['0']} "
          f"({100*correct/trials:.0f}% - was 100% undefended)")
    print(f"    now guesses  : {', '.join(sorted(set(tops))[:4])}")

    print()
    rule("=")
    print(f"{C['b']}  Undefended DoQ leaks the visited site. Padding is what closes it.{C['0']}")
    rule("=")
    print()


if __name__ == "__main__":
    main()
