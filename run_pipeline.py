"""End-to-end pipeline: capture -> preprocess -> defend -> classify -> report.

Usage
-----
  python run_pipeline.py                 # evaluate on the captured dataset
  python run_pipeline.py --capture 20    # re-capture 20 live visits per site first
  python run_pipeline.py --discover      # re-crawl target sites, then capture
"""
from __future__ import annotations

import argparse
import json
import time

from src import ablation, evaluate, targets, viz
from src.capture import doq_client
from src.config import METRICS


def banner(msg: str) -> None:
    print(f"\n{'=' * 72}\n{msg}\n{'=' * 72}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--discover", action="store_true",
                    help="re-crawl target websites to rebuild domain sets")
    ap.add_argument("--capture", type=int, metavar="N",
                    help="capture N fresh live DoQ visits per site")
    ap.add_argument("--workers", type=int, default=4)
    args = ap.parse_args()

    t0 = time.time()

    if args.discover:
        banner("STAGE 1  Target discovery - crawling live websites")
        ts = targets.build()
        print(f"{len(ts)} sites, "
              f"{sum(len(t['domains']) for t in ts)} distinct page dependencies")

    if args.capture:
        banner(f"STAGE 2  Live DoQ capture - {args.capture} visits per site")
        doq_client.run(n_visits=args.capture, workers=args.workers)

    banner("STAGE 3-6  Preprocess, apply defences, extract features, classify")
    res, sites = evaluate.run()

    banner("STAGE 7  Figures")
    viz.run()

    banner("STAGE 8  Channel ablation - what still leaks after padding")
    ablation.run()

    banner("SUMMARY")
    d = res["dataset"]
    print(f"dataset        : {d['n_traces']} page-load traces, {d['n_sites']} websites, "
          f"{d['n_queries']} live DoQ queries")
    print(f"features       : {res['n_features']} per trace, "
          f"{res['n_folds']}-fold stratified CV")
    print(f"random guess   : {res['random_guess_pct']:.1f}%\n")

    print(f"{'defence':<22}{'best model':<18}{'accuracy':>10}{'F1':>9}{'overhead':>11}")
    print("-" * 72)
    from src.defenses import PRETTY, ORDER
    for pol in ORDER:
        cells = [c for c in res["cells"] if c["policy"] == pol]
        if not cells:
            continue
        best = max(cells, key=lambda c: c["accuracy"])
        print(f"{PRETTY[pol]:<22}{best['model']:<18}"
              f"{best['accuracy']*100:>9.1f}%{best['f1']*100:>8.1f}%"
              f"{res['overhead'][pol]['overhead_pct']:>10.1f}%")

    print(f"\ncompleted in {time.time() - t0:.1f}s")
    print(f"metrics  -> {METRICS / 'results.json'}")
    print(f"figures  -> results/figures/")


if __name__ == "__main__":
    main()
