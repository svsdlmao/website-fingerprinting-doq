"""Candidate websites for the Review-2 expansion to a 100-site closed world.

The list is deliberately over-provisioned: roughly one in six sites blocks
automated fetches or times out, so `src.targets` crawls all of these and keeps
the first MAX_SITES that return a usable set of referenced hostnames.
"""

CANDIDATES = [
    # --- news and media -------------------------------------------------
    "https://www.bbc.com/", "https://edition.cnn.com/", "https://www.theguardian.com/",
    "https://www.aljazeera.com/", "https://www.npr.org/", "https://apnews.com/",
    "https://www.dw.com/", "https://www.france24.com/", "https://www.euronews.com/",
    "https://www.scmp.com/", "https://www.japantimes.co.jp/", "https://www.thehindu.com/",
    "https://indianexpress.com/", "https://www.ndtv.com/", "https://www.abc.net.au/",
    "https://www.cbc.ca/", "https://www.rte.ie/", "https://www.irishtimes.com/",
    "https://www.straitstimes.com/", "https://www.hindustantimes.com/",
    "https://www.aa.com.tr/", "https://www.thelocal.de/",

    # --- technology press -----------------------------------------------
    "https://news.ycombinator.com/", "https://arstechnica.com/", "https://www.theverge.com/",
    "https://www.wired.com/", "https://techcrunch.com/", "https://slashdot.org/",
    "https://www.zdnet.com/", "https://www.engadget.com/",

    # --- operating systems and distributions -----------------------------
    "https://www.kernel.org/", "https://www.debian.org/", "https://ubuntu.com/",
    "https://fedoraproject.org/", "https://archlinux.org/", "https://www.opensuse.org/",
    "https://www.freebsd.org/", "https://www.openbsd.org/", "https://www.netbsd.org/",
    "https://www.gentoo.org/", "https://linuxmint.com/", "https://www.redhat.com/",
    "https://www.suse.com/", "https://almalinux.org/", "https://rockylinux.org/",

    # --- open source projects and foundations ----------------------------
    "https://www.mozilla.org/", "https://www.apache.org/", "https://nginx.org/",
    "https://www.postgresql.org/", "https://www.sqlite.org/", "https://redis.io/",
    "https://www.docker.com/", "https://kubernetes.io/", "https://www.gnome.org/",
    "https://kde.org/", "https://www.videolan.org/", "https://www.blender.org/",
    "https://gitlab.com/", "https://github.com/", "https://sourceforge.net/",
    "https://www.openssl.org/", "https://curl.se/", "https://www.wireshark.org/",

    # --- languages, libraries, docs --------------------------------------
    "https://www.ruby-lang.org/", "https://www.php.net/", "https://www.perl.org/",
    "https://go.dev/", "https://www.rust-lang.org/", "https://nodejs.org/",
    "https://pypi.org/", "https://about.readthedocs.com/", "https://jupyter.org/",
    "https://numpy.org/", "https://scipy.org/", "https://pandas.pydata.org/",
    "https://scikit-learn.org/", "https://www.tensorflow.org/", "https://pytorch.org/",
    "https://opencv.org/", "https://matplotlib.org/", "https://www.scala-lang.org/",
    "https://kotlinlang.org/", "https://www.lua.org/", "https://www.haskell.org/",

    # --- standards bodies -------------------------------------------------
    "https://www.ietf.org/", "https://www.w3.org/", "https://www.ieee.org/",
    "https://www.acm.org/", "https://www.iso.org/", "https://www.itu.int/",
    "https://www.icann.org/", "https://www.iana.org/", "https://www.rfc-editor.org/",
    "https://www.nist.gov/", "https://www.etsi.org/", "https://www.unicode.org/",

    # --- universities -----------------------------------------------------
    "https://www.mit.edu/", "https://www.harvard.edu/", "https://www.stanford.edu/",
    "https://www.berkeley.edu/", "https://www.cmu.edu/", "https://www.caltech.edu/",
    "https://www.princeton.edu/", "https://www.yale.edu/", "https://www.columbia.edu/",
    "https://www.cornell.edu/", "https://www.ox.ac.uk/", "https://www.cam.ac.uk/",
    "https://www.imperial.ac.uk/", "https://ethz.ch/", "https://www.epfl.ch/",
    "https://www.tudelft.nl/", "https://www.kth.se/", "https://www.u-tokyo.ac.jp/",
    "https://www.nus.edu.sg/", "https://www.iitb.ac.in/", "https://www.iitd.ac.in/",
    "https://iisc.ac.in/", "https://vit.ac.in/", "https://www.uct.ac.za/",

    # --- science, space, research ------------------------------------------
    "https://www.nature.com/", "https://www.science.org/", "https://arxiv.org/",
    "https://plos.org/", "https://www.biorxiv.org/", "https://www.nasa.gov/",
    "https://www.esa.int/", "https://home.cern/", "https://www.noaa.gov/",
    "https://www.usgs.gov/", "https://www.jpl.nasa.gov/", "https://www.esrf.fr/",

    # --- international organisations ----------------------------------------
    "https://www.who.int/", "https://www.un.org/", "https://www.worldbank.org/",
    "https://www.imf.org/", "https://www.oecd.org/", "https://www.unesco.org/",
    "https://www.redcross.org/", "https://www.wto.org/",

    # --- reference and archives ----------------------------------------------
    "https://www.wikipedia.org/", "https://www.wikimedia.org/", "https://www.gutenberg.org/",
    "https://archive.org/", "https://www.loc.gov/", "https://www.britannica.com/",
    "https://openlibrary.org/", "https://commons.wikimedia.org/",

    # --- government ------------------------------------------------------------
    "https://www.gov.uk/", "https://www.canada.ca/", "https://european-union.europa.eu/",
    "https://www.india.gov.in/", "https://www.usa.gov/", "https://www.bundesregierung.de/",
    "https://www.gouvernement.fr/", "https://www.govt.nz/",

    # --- infrastructure and vendors ----------------------------------------------
    "https://weather.com/", "https://www.ibm.com/", "https://www.intel.com/",
    "https://www.amd.com/", "https://www.nvidia.com/", "https://www.cisco.com/",
    "https://www.cloudflare.com/", "https://www.akamai.com/", "https://www.digitalocean.com/",
    "https://www.netlify.com/", "https://www.hetzner.com/", "https://www.ovhcloud.com/",
]
