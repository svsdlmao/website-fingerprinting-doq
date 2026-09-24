"""Central configuration for the WF-over-DoQ prototype."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RAW = DATA / "raw"
PROCESSED = DATA / "processed"
RESULTS = ROOT / "results"
FIGURES = RESULTS / "figures"
METRICS = RESULTS / "metrics"
CONFIG = ROOT / "config"

for _p in (RAW, PROCESSED, FIGURES, METRICS, CONFIG):
    _p.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------- DoQ servers
# Public RFC 9250 (DNS-over-QUIC) resolvers, UDP/853.
DOQ_SERVERS = [
    {"name": "adguard",   "ip": "94.140.14.14", "port": 853, "sni": "dns.adguard-dns.com"},
    {"name": "adguard2",  "ip": "94.140.15.15", "port": 853, "sni": "dns.adguard-dns.com"},
]

# ------------------------------------------------------- QUIC framing model
# A DoQ query travels as: DNS wire message, prefixed by a 2-byte length field
# (RFC 9250 s4.2), inside a QUIC STREAM frame, inside a 1-RTT short-header
# packet.  What an on-path attacker actually observes is the UDP payload:
#
#   1  byte  short-header flags
#   8  bytes destination connection ID (typical)
#   2  bytes packet number
#   4  bytes STREAM frame header (type + stream id + length)
#   16 bytes AEAD authentication tag
#   -----
#   31 bytes of constant per-datagram overhead
#
# The DNS wire lengths themselves are *measured* from the live resolver; only
# this constant framing term is derived analytically.
QUIC_OVERHEAD = 31
LENGTH_PREFIX = 2


def observed_len(dns_wire_len: int) -> int:
    """UDP payload length an attacker sees for a DNS message of this size."""
    return dns_wire_len + LENGTH_PREFIX + QUIC_OVERHEAD


# ---------------------------------------------------------------- experiment
RANDOM_SEED = 42
N_VISITS = 12          # page-load traces captured per website
MAX_DOMAINS_PER_SITE = 14
QUERY_TYPES = ["A", "AAAA"]
