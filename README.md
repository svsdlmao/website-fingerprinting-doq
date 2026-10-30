# Website Fingerprinting over DNS-over-QUIC

**Evaluating the Limits of Padding Defences** — BCSE308L Computer Networks course project

Anant Agarwal (23BDS0145) · Aryaman Tripathi (24BAI0107) · Shauryaveer Singh Dabas (24BCE0416)
Vellore Institute of Technology · Guide: Dr. Yoganand S

---

## What this is

DNS-over-QUIC (RFC 9250) encrypts DNS, but an on-path observer still sees the
**length**, **count** and **timing** of every datagram. This project measures how
much of the visited website survives in those three channels, and how much
padding actually closes them.

Everything runs on **live DoQ traffic** to a public RFC 9250 resolver
(dns.adguard-dns.com) — about 74,000 real queries in total, no synthetic traces.

## Datasets

| Dataset | What it is | Size |
|---|---|---|
| Crawled, 100 sites | Hostnames each landing page's HTML refers to, resolved over DoQ | 1,500 page loads, 39,110 queries |
| Browser-driven, 75 sites | Hostnames a real Chrome page load resolved (from its net-log), replayed over DoQ | 410 page loads, 22,672 queries |
| Open-world background | 225 sites the attacker never trains on | 450 visits, 12,016 queries |
| Crawled, 20 sites | Review-1 dataset, captured twice for repeatability | 400 page loads each |

## Results

Best attacker accuracy (5-fold stratified CV):

| Defence | Crawled: feature models | Crawled: 1-D CNN | Browser: RF | Bandwidth (crawled) |
|---|---|---|---|---|
| No padding | **100.0 %** | 99.7 % | **98.5 %** | 0 % |
| RFC 8467 block padding | 15.1 % | 33.7 % | 42.9 % | 227 % |
| RFC 8467 + count normalisation | 10.3 % | 15.8 % | 22.0 % | 327 % |
| **Adaptive (proposed)** | **5.5 %** | **13.9 %** | **11.2 %** | 327 % (+21 ms) |
| Maximal padding (512/1024) | 14.9 % | 32.6 % | 42.7 % | 692 % |

Random guessing: 1 % (100 sites), 1.3 % (75 sites).

**Open world** (100 monitored + 225 unseen background sites, Random Forest):
undefended, the attacker names 96.6 % of monitored visits correctly with **no false
alarms** on 450 background visits (threshold 0.5). Under the proposed defence its
correct identifications (4.3 %) are no more frequent than its false alarms (5.1 %).

### Findings

1. **Undefended DoQ leaks almost completely** — on crawled traffic, real browser
   traffic and in the open world.
2. **More padding does not help.** Maximal padding costs about three times the
   bandwidth of RFC 8467 and was no better in *every* setting: crawled, browser,
   open world and against the CNN. After RFC 8467 every message in our data is
   already the same length.
3. **What still leaks is count and timing.** Under RFC 8467, count alone gives
   8.0 % and timing alone 10.9 % (100 crawled sites); every surviving "length"
   feature just re-encodes the count (`src/ablation.py`). On browser traffic, where
   pages make 6 to 498 lookups, the count leak is much larger (42.9 % under RFC 8467).
4. **The proposed defence is the best policy everywhere, but does not close the
   leak, and each layer has a real cost:**
   - hiding timing from the CNN needs delays rounded up to ~1 s
     (CNN 13.9 % → 3.2 %, +888 ms per lookup; `src/timing_sweep.py`);
   - hiding the count on browser pages needs bandwidth that explodes
     (723 % at grid 32, 11,695 % at grid 512; `src/browser_eval.py`).
5. **The packet-size model holds.** Real QUIC overhead measured on 769 live
   datagrams is 30 B for queries and 32–39 B for responses (model: 33 B);
   re-scoring with the measured values changed no conclusion (`src/wire_check.py`).

## Quick start

```bash
pip install -r requirements.txt
```

Reproduce the main results from the captured data (no network needed):

```bash
python run_pipeline.py
```

Each later experiment has its own entry point:

```bash
python -m src.cnn                    # 1-D CNN attacker
python -m src.wire_check             # measure real QUIC overhead (needs UDP/853)
python -m src.overhead_sensitivity   # re-score with measured overhead
python -m src.timing_sweep           # delay grid vs CNN and RF
python -m src.openworld evaluate     # open-world TPR / FPR
python -m src.browser_eval           # results on browser-driven traces
```

Fresh captures (need outbound UDP/853; the browser step needs Chrome):

```bash
python run_pipeline.py --discover --capture 15   # crawled dataset
python -m src.openworld collect                  # background sites
python -m src.openworld capture
python -m src.capture.browser 5                  # real Chrome page loads
python -m src.capture.browser_replay             # replay them over DoQ
```

## Live demo

```bash
python demo_live.py
```

Trains the attacker, opens a real QUIC connection, visits a site hidden from the
attacker, prints what an on-path observer sees (direction, byte length, time),
names the site, then replays the same trace through the proposed defence.
`python demo_live.py --list` shows the monitored sites.

## Modules

| | Module | File |
|---|---|---|
| M1 | Traffic capture | `src/targets.py`, `src/capture/doq_client.py` |
| M2 | Preprocessing | `src/preprocess.py` |
| M3 | Defence layer | `src/defenses.py` |
| M4 | Feature extraction (118 features) | `src/features.py` |
| M5 | Attack models: RF, GB, MLP, kNN, 1-D CNN | `src/models.py`, `src/cnn.py` |
| M6 | Evaluation, ablation, sweeps | `src/evaluate.py`, `src/ablation.py`, `src/sweep.py`, `src/timing_sweep.py` |
| M7 | Visualisation | `src/viz.py` |
| — | Wire validation | `src/wire_check.py`, `src/overhead_sensitivity.py` |
| — | Open world | `src/openworld.py`, `src/candidates_unmonitored.py` |
| — | Browser-driven capture | `src/capture/browser.py`, `src/capture/browser_replay.py`, `src/browser_eval.py` |

## Attacker model

Passive and on-path. Per datagram it sees only **direction**, **byte length** and
**arrival time**. Hostnames and record contents are stored for analysis but never
given to a classifier.

## Why browser lookups are replayed

No browser supports DNS-over-QUIC, so a browser cannot be pointed at a DoQ
resolver. Headless Chrome loads each page with a fresh profile and writes a
net-log; we take every hostname the page made it resolve and when, drop Chrome's
own traffic, and resolve that sequence over live DoQ. Queries leave at the
browser's own times; responses arrive one measured round trip later.

## Limitations

- The open world is small (225 background sites); real background traffic is far larger.
- Defences are applied to captured traces, not run in a live DoQ client.
- Browser traces use real browser lookups, but the queries are sent by our client.
- Small training sets per site, especially for browser traces (5–8 visits), which
  limits the CNN in particular.
- One resolver, one network vantage point.

## Report

The full project report is generated by `report/build_report.js`
(`report/find_pages.py` lays it out in Word and fills in page numbers).

## References

1. C. Huitema, S. Dickinson, A. Mankin. *DNS over Dedicated QUIC Connections.* RFC 9250, 2022.
2. A. Mayrhofer. *Padding Policies for Extension Mechanisms for DNS (EDNS(0)).* RFC 8467, 2018.
3. S. Siby et al. *Encrypted DNS → Privacy? A Traffic Analysis Perspective.* NDSS 2020.
4. J. Bushart, C. Rossow. *Padding Ain't Enough: Assessing the Privacy Guarantees of Encrypted DNS.* FOCI 2020.
5. M. Kosek et al. *One to Rule Them All? A First Look at DNS over QUIC.* PAM 2022.
6. A. Panchenko et al. *Website Fingerprinting at Internet Scale.* NDSS 2016.
7. P. Sirinam et al. *Deep Fingerprinting.* ACM CCS 2018.
