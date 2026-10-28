"""Module 1a - Target discovery.

For each monitored website we fetch the landing page and extract the set of
hostnames it references.  That set is the real DNS work a browser has to do
when the page is loaded, and therefore the real DoQ traffic an attacker on the
path would observe.  Nothing here is hand-authored: the domain sets are
measured from the live web.
"""
from __future__ import annotations

import json
import re
import ssl
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse

from .candidates import CANDIDATES
from .config import CONFIG, MAX_DOMAINS_PER_SITE

SITES = CANDIDATES

MIN_DOMAINS = 5
MAX_SITES = 100

_HOST_RE = re.compile(r'https?://([a-zA-Z0-9][a-zA-Z0-9.\-]{2,60}\.[a-z]{2,12})')
# Hostnames that appear in markup but are never resolved during a page load.
_NOISE = re.compile(r'(^|\.)(w3\.org|schema\.org|example\.(com|org)|localhost)$')

_CTX = ssl.create_default_context()
_CTX.check_hostname = False
_CTX.verify_mode = ssl.CERT_NONE

_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


def _fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={
        "User-Agent": _UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
    })
    with urllib.request.urlopen(req, timeout=20, context=_CTX) as r:
        return r.read(2_000_000).decode("utf-8", "ignore")


def discover(url: str) -> dict:
    """Return {site, origin, domains[]} for one website."""
    origin = urlparse(url).netloc
    try:
        html = _fetch(url)
    except Exception as exc:                        # unreachable site
        return {"site": origin, "origin": origin, "domains": [origin],
                "error": f"{type(exc).__name__}: {exc}"}

    hosts = {h.lower().rstrip(".") for h in _HOST_RE.findall(html)}
    hosts = {h for h in hosts if not _NOISE.search(h) and len(h) <= 63}
    hosts.add(origin)

    # Deterministic ordering: the page's own origin first, then the rest
    # sorted so that repeated runs produce a comparable trace shape.
    rest = sorted(h for h in hosts if h != origin)
    domains = ([origin] + rest)[:MAX_DOMAINS_PER_SITE]
    return {"site": origin, "origin": origin, "domains": domains,
            "html_bytes": len(html)}


def build(path=None) -> list[dict]:
    path = path or (CONFIG / "targets.json")
    with ThreadPoolExecutor(max_workers=16) as ex:
        targets = list(ex.map(discover, SITES))
    ok = [t for t in targets if "error" not in t and len(t["domains"]) >= MIN_DOMAINS]
    failed = [t for t in targets if t not in ok]
    for t in failed:
        print(f"  skipped {t['site']}: {t.get('error', 'too few domains')}")
    targets = sorted(ok, key=lambda t: t["site"])[:MAX_SITES]
    path.write_text(json.dumps(targets, indent=2), encoding="utf-8")
    return targets


def load(path=None) -> list[dict]:
    path = path or (CONFIG / "targets.json")
    return json.loads(path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    ts = build()
    print(f"discovered {len(ts)} sites")
    for t in ts:
        print(f"  {t['site']:<28} {len(t['domains']):>2} domains  "
              f"{'ERR ' + t['error'] if 'error' in t else ''}")
