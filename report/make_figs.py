"""Extra figures for the report: system architecture and project timeline."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

OUT = "report/assets/"
C = {"cap": "#2D6A9F", "def": "#37A06E", "atk": "#D1495B", "ev": "#4C5C68"}

# ---------------------------------------------------------------- architecture
fig, ax = plt.subplots(figsize=(10, 4.4), dpi=200)
ax.set_xlim(0, 10); ax.set_ylim(0, 4.4); ax.axis("off")

def box(x, y, w, h, title, sub, col):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.08",
                                fc="white", ec=col, lw=1.8))
    ax.text(x + w / 2, y + h * 0.64, title, ha="center", va="center", fontsize=9.5, weight="bold", color="#12203A")
    ax.text(x + w / 2, y + h * 0.28, sub, ha="center", va="center", fontsize=7.6, color="#4C5C68")

def arrow(x1, y1, x2, y2):
    ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle="-|>", color="#4C5C68", lw=1.3))

top = [("Target websites", "100 landing pages", C["cap"]),
       ("M1  Capture", "crawl + live DoQ, UDP/853", C["cap"]),
       ("M2  Preprocess", "filter, order, label", C["cap"]),
       ("M3  Defence layer", "pad / count / timing", C["def"])]
bot = [("M4  Features", "118 per trace", C["atk"]),
       ("M5  Attack models", "RF, GB, MLP, kNN", C["atk"]),
       ("M6  Evaluation", "5-fold CV, cost", C["ev"]),
       ("M7  Figures", "plots + metrics", C["ev"])]
w, h, gap = 2.15, 1.05, 0.38
for i, (t, s, c) in enumerate(top):
    x = 0.1 + i * (w + gap); box(x, 2.9, w, h, t, s, c)
    if i < 3: arrow(x + w, 3.42, x + w + gap, 3.42)
for i, (t, s, c) in enumerate(bot):
    x = 0.1 + (3 - i) * (w + gap); box(x, 0.75, w, h, t, s, c)
    if i < 3: arrow(x, 1.27, x - gap, 1.27)
arrow(0.1 + 3 * (w + gap) + w / 2, 2.9, 0.1 + 3 * (w + gap) + w / 2, 1.8)
ax.text(5, 0.25, "Every padding policy in M3 is applied to the same captured traces, "
        "so differences in accuracy come from the defence alone.",
        ha="center", fontsize=8, style="italic", color="#4C5C68")
fig.savefig(OUT + "fig_architecture.png", bbox_inches="tight", facecolor="white")
plt.close(fig)

# ---------------------------------------------------------------- timeline
tasks = [
    ("Literature survey and problem framing", 1, 3, C["ev"]),
    ("Zeroth review", 3, 1, "#C98B29"),
    ("Target discovery and DoQ capture (M1)", 4, 2, C["cap"]),
    ("Preprocessing and features (M2, M4)", 5, 2, C["cap"]),
    ("Defence layer and attack models (M3, M5)", 6, 2, C["def"]),
    ("Review 1 - 20-site results", 7, 1, "#C98B29"),
    ("Channel ablation and parameter sweep", 8, 2, C["atk"]),
    ("Scale-up to 100 sites", 9, 2, C["cap"]),
    ("Review 2", 10, 1, "#C98B29"),
    ("Report writing", 10, 3, C["ev"]),
    ("Wire validation, CNN, open world (planned)", 12, 3, "#B8C2CC"),
]
fig, ax = plt.subplots(figsize=(8.2, 4.8), dpi=200)
for i, (name, start, dur, col) in enumerate(tasks):
    ax.barh(i, dur, left=start, color=col, edgecolor="white", height=0.6)
ax.set_yticks(range(len(tasks)), [t[0] for t in tasks], fontsize=10.5)
ax.invert_yaxis()
ax.set_xticks(range(1, 16), [str(k) for k in range(1, 16)], fontsize=10)
ax.set_xlabel("Semester week", fontsize=11)
ax.set_xlim(0.8, 15.2)
ax.grid(axis="x", alpha=0.25)
for s in ("top", "right"): ax.spines[s].set_visible(False)
fig.tight_layout()
fig.savefig(OUT + "fig_timeline.png", facecolor="white")
plt.close(fig)
print("ok")
