"""Parameter sweep for the adaptive defence (writes results/metrics/sweep.json)."""
import numpy as np, json
from src import preprocess, defenses, features, models
from sklearn.model_selection import cross_val_score, StratifiedKFold

traces, sites, _ = preprocess.run(verbose=False)
skf = StratifiedKFold(5, shuffle=True, random_state=42)
rows = []
print(f"{'count grid':>11}{'rtt grid':>10}{'cadence':>9}{'accuracy':>11}{'overhead':>11}{'+latency':>11}")
print("-"*64)
for cg in (16, 32, 48):
    for rg, cad in ((50.0, 25.0), (100.0, 50.0)):
        defenses.COUNT_GRID, defenses.RTT_GRID_MS, defenses.CADENCE_MS = cg, rg, cad
        d = [defenses.apply(t, "adaptive") for t in traces]
        X, y, _ = features.matrix(d)
        acc = max(cross_val_score(models.build(m), X, y, cv=skf).mean()
                  for m in ("RandomForest", "kNN"))
        ov = [defenses.overhead(t) for t in d]
        bw = float(np.mean([o["overhead_pct"] for o in ov]))
        lat = float(np.mean([o["added_latency_ms"] for o in ov]))
        rows.append(dict(count_grid=cg, rtt_grid=rg, cadence=cad,
                         accuracy=acc, overhead_pct=bw, added_latency_ms=lat))
        print(f"{cg:>11}{rg:>10.0f}{cad:>9.0f}{acc*100:>10.1f}%{bw:>10.1f}%{lat:>10.1f}ms")
json.dump(rows, open("results/metrics/sweep.json","w"), indent=2)
