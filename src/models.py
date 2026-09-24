"""Module 5 - Attack models.

Four classifiers stand in for the adversary.  All are trained only on
features derived from encrypted-traffic observables (see src.features).
A 1-D CNN over the raw size sequence is the planned extension for the next
phase; the MLP here is its dense stand-in.
"""
from __future__ import annotations

from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from .config import RANDOM_SEED


def build(name: str):
    if name == "RandomForest":
        return RandomForestClassifier(
            n_estimators=400, max_features="sqrt", min_samples_leaf=1,
            n_jobs=-1, random_state=RANDOM_SEED)

    if name == "GradientBoosting":
        return HistGradientBoostingClassifier(
            max_iter=300, learning_rate=0.1, max_leaf_nodes=31,
            early_stopping=False, random_state=RANDOM_SEED)

    if name == "MLP":
        return Pipeline([
            ("scale", StandardScaler()),
            ("clf", MLPClassifier(hidden_layer_sizes=(256, 128), max_iter=900,
                                  alpha=1e-3, random_state=RANDOM_SEED)),
        ])

    if name == "kNN":
        return Pipeline([
            ("scale", StandardScaler()),
            ("clf", KNeighborsClassifier(n_neighbors=3, weights="distance")),
        ])

    raise ValueError(f"unknown model: {name}")


MODELS = ["RandomForest", "GradientBoosting", "MLP", "kNN"]
