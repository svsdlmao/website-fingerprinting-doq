"""MOD-07b - 1-D convolutional attacker over the raw observed sequence.

The other attackers use 118 hand-crafted features.  This one, in the spirit of
Deep Fingerprinting (Sirinam et al., 2018), learns directly from the sequence
of exchanges as an observer sees them: per exchange the observed query length,
observed response length, gap since the previous query and response delay.
Sequences are zero-padded to a fixed length.  Scored with the same 5-fold
stratified split as every other model so the numbers are directly comparable.
"""
from __future__ import annotations

import json
import time

import numpy as np
import torch
import torch.nn as nn
from sklearn.model_selection import StratifiedKFold

from . import defenses, preprocess
from .config import METRICS, RANDOM_SEED

SEQ_LEN = 40
EPOCHS = 60
torch.set_num_threads(8)


def to_sequences(traces):
    X = np.zeros((len(traces), 4, SEQ_LEN), dtype=np.float32)
    for i, t in enumerate(traces):
        prev = 0.0
        for j, e in enumerate(t["events"][:SEQ_LEN]):
            X[i, 0, j] = e["q_obs"]
            X[i, 1, j] = e["r_obs"]
            X[i, 2, j] = e["t_ms"] - prev
            X[i, 3, j] = e["rtt_ms"]
            prev = e["t_ms"]
    return X


class Net(nn.Module):
    def __init__(self, n_classes):
        super().__init__()
        self.f = nn.Sequential(
            nn.Conv1d(4, 32, 5, padding=2), nn.BatchNorm1d(32), nn.ReLU(),
            nn.Conv1d(32, 64, 5, padding=2), nn.BatchNorm1d(64), nn.ReLU(), nn.MaxPool1d(2),
            nn.Conv1d(64, 128, 3, padding=1), nn.BatchNorm1d(128), nn.ReLU(),
            nn.AdaptiveMaxPool1d(1), nn.Flatten(), nn.Dropout(0.3),
            nn.Linear(128, n_classes))

    def forward(self, x):
        return self.f(x)


def score(X, y, n_classes):
    skf = StratifiedKFold(5, shuffle=True, random_state=RANDOM_SEED)
    correct = total = 0
    for tr, te in skf.split(X[:, 0, 0], y):
        torch.manual_seed(RANDOM_SEED)
        mu = X[tr].mean(axis=(0, 2), keepdims=True)
        sd = X[tr].std(axis=(0, 2), keepdims=True) + 1e-6
        xtr = torch.tensor((X[tr] - mu) / sd); ytr = torch.tensor(y[tr])
        xte = torch.tensor((X[te] - mu) / sd); yte = torch.tensor(y[te])
        net = Net(n_classes)
        opt = torch.optim.Adam(net.parameters(), lr=2e-3, weight_decay=1e-4)
        lossf = nn.CrossEntropyLoss()
        g = torch.Generator().manual_seed(RANDOM_SEED)
        for _ in range(EPOCHS):
            net.train()
            for idx in torch.randperm(len(xtr), generator=g).split(64):
                opt.zero_grad()
                lossf(net(xtr[idx]), ytr[idx]).backward()
                opt.step()
        net.eval()
        with torch.no_grad():
            correct += (net(xte).argmax(1) == yte).sum().item()
        total += len(te)
    return correct / total


def run():
    traces, sites, _ = preprocess.run(verbose=False)
    y = np.array([t["label"] for t in traces])
    out = {}
    for pol in defenses.ORDER:
        t0 = time.time()
        X = to_sequences([defenses.apply(t, pol) for t in traces])
        acc = score(X, y, len(sites))
        out[pol] = acc
        print(f"  {defenses.PRETTY[pol]:<22} CNN accuracy {acc*100:5.1f}%   ({time.time()-t0:.0f}s)", flush=True)
    (METRICS / "cnn.json").write_text(json.dumps(out, indent=2), encoding="utf-8")


if __name__ == "__main__":
    run()
