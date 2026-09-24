"""Module 6 - Evaluation.

Cross-product of {padding policy} x {attack model}, scored with stratified
k-fold cross-validation.  For each cell we report the attacker's accuracy and
macro precision/recall/F1, alongside the bandwidth cost the defence imposes.
A defence is only interesting if it drives accuracy down *and* keeps overhead
affordable, so both axes are reported together.
"""
from __future__ import annotations

import json
import warnings

import numpy as np
from sklearn.exceptions import ConvergenceWarning
from sklearn.metrics import (accuracy_score, confusion_matrix,
                             precision_recall_fscore_support, top_k_accuracy_score)
from sklearn.model_selection import StratifiedKFold

from . import defenses, features, models, preprocess
from .config import METRICS, RANDOM_SEED

warnings.filterwarnings("ignore", category=ConvergenceWarning)

N_FOLDS = 5


def evaluate_cell(X, y, model_name: str, n_classes: int) -> dict:
    skf = StratifiedKFold(n_splits=N_FOLDS, shuffle=True, random_state=RANDOM_SEED)
    y_true_all, y_pred_all = [], []
    top3 = []

    for tr_idx, te_idx in skf.split(X, y):
        clf = models.build(model_name)
        clf.fit(X[tr_idx], y[tr_idx])
        pred = clf.predict(X[te_idx])
        y_true_all.append(y[te_idx])
        y_pred_all.append(pred)
        if hasattr(clf, "predict_proba"):
            try:
                proba = clf.predict_proba(X[te_idx])
                top3.append(top_k_accuracy_score(
                    y[te_idx], proba, k=3, labels=np.arange(n_classes)))
            except Exception:
                pass

    y_true = np.concatenate(y_true_all)
    y_pred = np.concatenate(y_pred_all)
    p, r, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, average="macro", zero_division=0)

    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(p),
        "recall": float(r),
        "f1": float(f1),
        "top3_accuracy": float(np.mean(top3)) if top3 else None,
        "confusion": confusion_matrix(
            y_true, y_pred, labels=np.arange(n_classes)).tolist(),
    }


def run(policies=None, model_names=None, verbose=True):
    traces, sites, stats = preprocess.run(verbose=verbose)
    n_classes = len(sites)
    policies = policies or list(defenses.ORDER)
    model_names = model_names or models.MODELS

    baseline = 100.0 / n_classes
    results = {"dataset": stats, "random_guess_pct": baseline,
               "n_folds": N_FOLDS, "cells": [], "overhead": {}}

    for pol in policies:
        defended = [defenses.apply(t, pol) for t in traces]
        X, y, names = features.matrix(defended)
        results["n_features"] = len(names)

        ovh = [defenses.overhead(t) for t in defended]
        results["overhead"][pol] = {
            "overhead_pct": float(np.mean([o["overhead_pct"] for o in ovh])),
            "bytes_per_load": float(np.mean([o["bytes_defended"] for o in ovh])),
            "dummy_per_load": float(np.mean([o["n_dummy"] for o in ovh])),
            "added_latency_ms": float(np.mean([o["added_latency_ms"] for o in ovh])),
        }

        for mn in model_names:
            cell = evaluate_cell(X, y, mn, n_classes)
            cell.update(policy=pol, model=mn)
            results["cells"].append(cell)
            if verbose:
                print(f"  {defenses.PRETTY[pol]:<22} {mn:<17} "
                      f"acc={cell['accuracy']*100:6.2f}%  f1={cell['f1']*100:6.2f}%  "
                      f"overhead={results['overhead'][pol]['overhead_pct']:6.1f}%")

    out = METRICS / "results.json"
    out.write_text(json.dumps(results, indent=2), encoding="utf-8")

    # flat CSV for the report / slides
    lines = ["policy,model,accuracy,precision,recall,f1,top3,overhead_pct"]
    for c in results["cells"]:
        o = results["overhead"][c["policy"]]["overhead_pct"]
        lines.append(f"{c['policy']},{c['model']},{c['accuracy']:.4f},"
                     f"{c['precision']:.4f},{c['recall']:.4f},{c['f1']:.4f},"
                     f"{(c['top3_accuracy'] or 0):.4f},{o:.2f}")
    (METRICS / "results.csv").write_text("\n".join(lines), encoding="utf-8")

    if verbose:
        print(f"\nwrote {out}")
    return results, sites


if __name__ == "__main__":
    run()
