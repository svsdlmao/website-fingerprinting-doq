# Website Fingerprinting over DNS-over-QUIC

**Evaluating the Limits of Padding Defences** — Course Project, Review 1 (25% implementation)

Anant Agarwal (23BDS0145) · Aryaman Tripathi (24BAI0107) · Shauryaveer Singh Dabas (24BCE0416)
Vellore Institute of Technology · Course Faculty: Dr. Yoganand S

---

## What this is

DNS-over-QUIC (RFC 9250) encrypts DNS, but an on-path observer still sees the
**length**, **count** and **timing** of every datagram. This project measures how
much of the visited website survives in those three channels, and how much
padding actually closes them.

Everything here runs on **live DoQ traffic** captured from a public RFC 9250
resolver — no synthetic traces.

## Headline result

100-site closed world (Review 2):

| Defence | Best attacker | Bandwidth | Added latency |
|---|---|---|---|
| No padding | **100.0 %** | 0 % | 0 ms |
| RFC 8467 block padding | 15.1 % | 227 % | 0 ms |
| RFC 8467 + count normalisation | 10.3 % | 327 % | 0 ms |
| **Adaptive (proposed)** | **5.5 %** | 327 % | +21 ms |
| Maximal padding (512/1024) | 14.9 % | 692 % | 0 ms |

Random guessing over 100 sites is 1 %. Dataset: 1,500 page-load traces,
39,110 live DoQ queries, 118 features per trace, 5-fold stratified CV.

The earlier 20-site run (Review 1) is kept alongside for comparison:
`data/raw/doq_traces_20sites.jsonl`, `results/metrics/results_20sites.json`.

Findings:

1. **Undefended DoQ leaks completely.** 100 % across 100 websites — a page
   load's traffic profile is effectively a lookup key for the site.
2. **More padding does not help.** Maximal padding costs 3× the bandwidth of
   RFC 8467 and scores no better (14.9 % vs 15.1 %). This held at both 20 and
   100 sites. The size channel is already closed at RFC 8467.
3. **What still leaks is count and timing.** Under RFC 8467 at 100 sites,
   timing alone gives 10.9 % and exchange count alone 8.0 % (`src/ablation.py`).
   At 20 sites the order was reversed (count 25 %, timing 19 %) — as the
   number of sites grows, timing becomes the dominant residual channel.
4. **Closing both gets closest to the floor, but not all the way.** The
   adaptive defence reaches 5.5 %, the lowest of any policy — still about
   5× the 1 % random-guess floor, so residual leakage remains.

## Quick start

Install dependencies:

```bash
pip install dnspython aioquic scikit-learn numpy pandas matplotlib
```

Reproduce every metric and figure from the captured dataset:

```bash
python run_pipeline.py
```

Capture fresh live traffic first (about 3.5 minutes, needs outbound UDP/853):

```bash
python run_pipeline.py --capture 20
```

Re-crawl the target websites to rebuild their domain sets, then capture:

```bash
python run_pipeline.py --discover --capture 20
```

## Live demo

Fingerprints a website from encrypted DoQ traffic captured *right now*, then
replays the same trace through the proposed defence to show the attack fail:

```bash
python demo_live.py
```

It trains the attacker, opens a real QUIC connection, visits one site (hidden
from the attacker unless you pass `--site`), prints what the adversary actually
observes — direction, byte length, timestamp — and asks it to name the site.
`python demo_live.py --list` shows the monitored sites.

## Modules

| | Module | File | Role |
|---|---|---|---|
| M1 | Traffic Capture | `src/targets.py`, `src/capture/doq_client.py` | Crawl each landing page for the hostnames it references, then resolve them over live DoQ |
| M2 | Preprocessing | `src/preprocess.py` | Completeness filtering, ordering, label re-indexing |
| M3 | Defence Layer | `src/defenses.py` | Block padding, count normalisation, delay quantisation |
| M4 | Feature Extraction | `src/features.py` | 118 features from direction, length and time only |
| M5 | Attack Models | `src/models.py` | Random Forest, Gradient Boosting, MLP, kNN |
| M6 | Evaluation | `src/evaluate.py` | 5-fold CV; accuracy, F1, bandwidth and latency cost |
| M7 | Visualisation | `src/viz.py` | Six result figures |
| — | Channel ablation | `src/ablation.py` | Which observable still identifies the site after padding |
| — | Parameter sweep | `src/sweep.py` | Tunes the proposed defence's two shaping parameters |

## Attacker model

The adversary is passive and on-path. Because DoQ is encrypted it can observe
only three things per datagram: **direction**, **byte length**, **arrival time**.
Every feature in `src/features.py` is derived from those alone — hostnames,
record contents and response codes are stored during capture for analysis but
are never given to a classifier.

## What is measured vs. modelled

Measured from the live resolver: every DNS query and response wire length, every
round-trip time, every inter-arrival gap, and the set of hostnames each page
references.

Modelled: a single constant. A DoQ message travels inside a QUIC STREAM frame in
a 1-RTT short-header packet, which adds a fixed 31 bytes of framing plus a 2-byte
length prefix (`src/config.py`). Validating that constant against a `tshark`
capture is the first item of the next phase.

## Layout

```
config/targets.json          target sites and their measured domain sets
data/raw/doq_traces.jsonl    400 captured page-load traces
data/processed/              cleaned traces and dataset summary
results/metrics/             results.json, results.csv, ablation.json, sweep.json
results/figures/             six figures
src/                         M1-M7 plus ablation and sweep
run_pipeline.py              end-to-end runner
demo_live.py                 live fingerprinting demo
build_deck.js                regenerates the Review-1 deck from the current figures
```

## Limitations

- Closed world of 100 sites. The resolver cache makes undefended traces
  near-deterministic, so 100 % is an upper bound, not a field estimate.
- Traces come from a stub resolver replaying measured domain sets, not from a
  real browser page load.
- The 31-byte QUIC framing term is analytic and not yet wire-validated.
- One resolver, one network vantage point.

The finding that matters — *which channel leaks* — does not depend on the
absolute ceiling.

## References

1. C. Huitema, S. Dickinson, A. Mankin. *DNS over Dedicated QUIC Connections.*
   RFC 9250, IETF, May 2022.
2. A. Mayrhofer. *Padding Policies for Extension Mechanisms for DNS (EDNS(0)).*
   RFC 8467, IETF, October 2018.
3. S. Siby, M. Juarez, C. Diaz, N. Vallina-Rodriguez, C. Troncoso.
   *Encrypted DNS → Privacy? A Traffic Analysis Perspective.* NDSS 2020.
4. M. Kosek, T. V. Doan, S. Granderath, V. Bajpai.
   *One to Rule Them All? A First Look at DNS over QUIC.* PAM 2022.
5. A. Panchenko et al. *Website Fingerprinting at Internet Scale.* NDSS 2016.
