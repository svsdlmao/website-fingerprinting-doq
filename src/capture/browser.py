"""MOD-08a - Browser-driven lookup sequences.

No browser speaks DNS-over-QUIC, so a browser cannot be pointed at a DoQ
resolver directly.  Instead this module records what a real browser *would*
resolve: headless Chrome loads each landing page with a fresh profile and
writes a net-log, from which we take every hostname the page caused Chrome
to resolve and the moment it asked.  That captures lookups made by scripts,
adverts and analytics as well as by the HTML, in the order and at the times
a browser makes them.

`browser_replay.py` then resolves each recorded sequence over live DoQ.

Chrome's own background traffic (updates, sign-in, safe browsing) is
suppressed with flags, and anything still resolved before the page's own
hostname, or matching a known Chrome service, is discarded.
"""
from __future__ import annotations

import json
import os
import random
import re
import shutil
import subprocess
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import psutil

from .. import targets as targets_mod
from ..config import DATA, RANDOM_SEED

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
OUT = DATA / "browser" / "netlogs.jsonl"
LOAD_BUDGET_MS = 8000
TIMEOUT_S = 25

FLAGS = [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--disable-background-networking", "--disable-component-update", "--disable-sync",
    "--disable-default-apps", "--disable-extensions", "--no-pings", "--disable-domain-reliability",
    "--disable-client-side-phishing-detection", "--disable-breakpad", "--metrics-recording-only",
    "--disable-features=OptimizationHints,MediaRouter,AutofillServerCommunication,Translate,InterestFeedContentSuggestions",
    "--net-log-capture-mode=Default", f"--virtual-time-budget={LOAD_BUDGET_MS}", "--dump-dom",
]

# Chrome service hostnames that are not caused by the page being loaded
NOISE = re.compile(
    r"^(wpad|localhost)$|(^|\.)gvt[12]\.com$|^clients\d*\.google\.com$|^accounts\.google\.com$"
    r"|^mtalk\.google\.com$|^android\.clients\.google\.com$|^clients\d*\.googleusercontent\.com$"
    r"|^(update|clientservices|content-autofill|optimizationguide-pa|safebrowsing|"
    r"safebrowsing-cache|chromewebstore|redirector)\.googleapis\.com$")

_lock = threading.Lock()


def _parse(path: str, origin: str) -> list[list]:
    raw = open(path, encoding="utf-8", errors="ignore").read().rstrip()
    if not raw.endswith("}"):                       # net-log may be cut off at exit
        raw = raw[: raw.rfind("}") + 1] + "]}"
    try:
        d = json.loads(raw)
    except json.JSONDecodeError:
        d = json.loads(raw[: raw.rfind("}") + 1] + "]}")
    types = {v: k for k, v in d["constants"]["logEventTypes"].items()}
    seen, order = {}, []
    for e in d["events"]:
        if types.get(e["type"]) != "HOST_RESOLVER_MANAGER_REQUEST" or e.get("phase") != 1:
            continue
        h = (e.get("params", {}).get("host") or "").split("://")[-1].split(":")[0].strip("[]").lower()
        if not h or h in seen or re.match(r"^[\d.]+$", h):
            continue
        seen[h] = int(e["time"])
        order.append(h)
    if origin not in seen:
        return []
    t0 = seen[origin]
    hosts = [[h, seen[h] - t0] for h in order
             if seen[h] >= t0 and not NOISE.search(h)]
    return hosts


def _visit(job):
    site, visit = job
    tmp = tempfile.mkdtemp(prefix="wfdoq_")
    net = os.path.join(tmp, "net.json")
    try:
        subprocess.Popen([CHROME, *FLAGS, f"--user-data-dir={os.path.join(tmp, 'p')}",
                          f"--log-net-log={net}", f"https://{site}/"],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        # The chrome.exe we launch can hand over to a separate browser process
        # and exit at once, so its PID says nothing about whether the page is
        # still loading.  Track the load by its private profile folder instead:
        # it is finished when no process is using that folder any more.
        deadline = time.time() + TIMEOUT_S
        while _owners(tmp) and time.time() < deadline:
            time.sleep(1)
        for pr in _owners(tmp):          # timed out: end exactly this load's processes
            try:
                pr.kill()
            except psutil.Error:
                pass
        t_end = time.time() + 10
        while _owners(tmp) and time.time() < t_end:
            time.sleep(0.5)
        # A load cut off by the timeout still left a usable partial net-log.
        hosts = _parse(net, site) if os.path.exists(net) else []
    except Exception:
        hosts = []
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    rec = {"site": site, "visit": visit, "hosts": hosts}
    with _lock:
        if hosts:                        # empty loads are not saved, so a rerun retries them
            with OUT.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(rec) + "\n")
        print(f"  {site:<30} visit {visit:>2}  {len(hosts):>3} hostnames"
              + ("" if hosts else "  (will retry)"), flush=True)
    return rec


def _owners(tmp: str) -> list:
    out = []
    for pr in psutil.process_iter(["name", "cmdline"]):
        try:
            if pr.info["name"] == "chrome.exe" and tmp in " ".join(pr.info["cmdline"] or []):
                out.append(pr)
        except psutil.Error:
            continue
    return out


def run(n_visits: int = 5, workers: int = 6, sites: list[str] | None = None, out=None):
    global OUT
    if out is not None:
        OUT = out
    OUT.parent.mkdir(parents=True, exist_ok=True)
    sites = sites or [t["site"] for t in targets_mod.load()]
    done = set()
    if OUT.exists():
        for line in OUT.open(encoding="utf-8"):
            r = json.loads(line); done.add((r["site"], r["visit"]))
    jobs = [(s, v) for v in range(n_visits) for s in sites if (s, v) not in done]
    random.Random(RANDOM_SEED).shuffle(jobs)
    print(f"{len(jobs)} browser page loads to run ({len(done)} already done)", flush=True)
    with ThreadPoolExecutor(max_workers=workers) as ex:
        list(ex.map(_visit, jobs))


if __name__ == "__main__":
    import sys
    run(n_visits=int(sys.argv[1]) if len(sys.argv) > 1 else 5)
