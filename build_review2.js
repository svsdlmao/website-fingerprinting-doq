// Review-2 deck generator - follows the CSE3002 Review-2 template structure.
// Numbers are read from results/metrics/*.json so the deck stays correct
// whenever the pipeline is re-run.
const pptxgen = require("pptxgenjs");
const path = require("path");
const fs = require("fs");

const ROOT = __dirname;
const M_ = (f) => path.join(ROOT, "results", "metrics", f);
const FIG = (n) => path.join(ROOT, "results", "figures", n);
const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf-8"));

const R = readJSON(M_("results.json"));
const PREV = fs.existsSync(M_("results_20sites.json")) ? readJSON(M_("results_20sites.json")) : null;
const ABL = fs.existsSync(M_("ablation.json")) ? readJSON(M_("ablation.json")) : null;

// ---------------------------------------------------------------- helpers
function best(res, policy) {
  const cells = res.cells.filter((c) => c.policy === policy);
  if (!cells.length) return null;
  return cells.reduce((a, b) => (b.accuracy > a.accuracy ? b : a));
}
function acc(res, policy) { const c = best(res, policy); return c ? c.accuracy * 100 : null; }
function ovh(res, policy) { const o = res.overhead[policy]; return o ? o.overhead_pct : null; }
function lat(res, policy) { const o = res.overhead[policy]; return o ? (o.added_latency_ms || 0) : 0; }
const pct = (v, d = 1) => (v === null ? "n/a" : v.toFixed(d) + "%");

const D = R.dataset;
const NSITES = D.n_sites, NTRACES = D.n_traces, NQ = D.n_queries, NFEAT = R.n_features;
const FLOOR = R.random_guess_pct;
const A_NONE = acc(R, "none"), A_RFC = acc(R, "rfc8467"),
      A_CNT = acc(R, "rfc8467_count"), A_ADP = acc(R, "adaptive"), A_MAX = acc(R, "maximal");
const O_RFC = ovh(R, "rfc8467"), O_ADP = ovh(R, "adaptive"), O_MAX = ovh(R, "maximal");
const L_ADP = lat(R, "adaptive");
const ablCount = ABL && ABL.groups["count only"] ? ABL.groups["count only"].accuracy * 100 : null;
const ablTime = ABL && ABL.groups["timing only"] ? ABL.groups["timing only"].accuracy * 100 : null;

// ---------------------------------------------------------------- palette
const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.author = "Anant Agarwal, Aryaman Tripathi, Shauryaveer Singh Dabas";
pres.title = "Website Fingerprinting over DNS-over-QUIC - Review 2";

const NAVY = "12203A", INK = "1B2A41", TEAL = "1C7293", RED = "D1495B",
      GREEN = "37A06E", GOLD = "C98B29", MUTED = "6B7B8C", LIGHT = "F2F5F9",
      LINE = "D9E1E9", WHITE = "FFFFFF", ICE = "9FB8CD";
const HEAD = "Cambria", BODY = "Calibri";
const M = 0.62, CW = 13.333 - 2 * M, SW = 13.333, SH = 7.5;
let slideNo = 0;

function newSlide(dark) {
  const s = pres.addSlide();
  s.background = { color: dark ? NAVY : WHITE };
  return s;
}
function kicker(s, text, dark) {
  s.addText(text, { x: M, y: 0.30, w: CW, h: 0.28, fontFace: BODY, fontSize: 9.5, bold: true,
    color: dark ? GOLD : TEAL, charSpacing: 0.8, isTextBox: true, margin: 0, valign: "middle" });
}
function heading(s, title, sub, dark) {
  s.addText(title, { x: M, y: 0.60, w: CW, h: 0.60, fontFace: HEAD, fontSize: 28, bold: true,
    color: dark ? WHITE : NAVY, isTextBox: true, margin: 0, valign: "middle" });
  if (sub) s.addText(sub, { x: M, y: 1.20, w: CW, h: 0.30, fontFace: BODY, fontSize: 12.5,
    color: dark ? ICE : MUTED, isTextBox: true, margin: 0, valign: "middle" });
}
function footer(s, label, dark) {
  slideNo += 1;
  s.addText(label, { x: M, y: SH - 0.44, w: 9.5, h: 0.3, fontFace: BODY, fontSize: 9,
    color: dark ? ICE : MUTED, isTextBox: true, margin: 0, valign: "middle" });
  s.addText(String(slideNo), { x: SW - M - 0.7, y: SH - 0.44, w: 0.7, h: 0.3, align: "right",
    fontFace: BODY, fontSize: 9, color: dark ? ICE : MUTED, isTextBox: true, margin: 0, valign: "middle" });
}
function card(s, x, y, w, h, fill, lineC) {
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.05,
    fill: { color: fill || LIGHT }, line: { color: lineC || LINE, width: 0.75 } });
}
function chip(s, x, y, d, label, color) {
  s.addShape(pres.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color } });
  s.addText(label, { x, y, w: d, h: d, align: "center", valign: "middle", fontFace: BODY,
    fontSize: 10.5, bold: true, color: WHITE, isTextBox: true, margin: 0 });
}
function pill(s, x, y, w, text, color) {
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h: 0.30, rectRadius: 0.15, fill: { color } });
  s.addText(text, { x, y, w, h: 0.30, align: "center", valign: "middle", fontFace: BODY,
    fontSize: 8, bold: true, color: WHITE, charSpacing: 0.3, isTextBox: true, margin: 0 });
}
function dot(s, x, y, color, d) {
  s.addShape(pres.ShapeType.ellipse, { x, y, w: d || 0.12, h: d || 0.12, fill: { color } });
}
function para(s, items, opts) {
  const runs = items.map((t, i) => ({ text: t,
    options: { breakLine: i < items.length - 1, bullet: opts.bullet === true } }));
  s.addText(runs, Object.assign({ fontFace: BODY, fontSize: 12.5, color: INK,
    isTextBox: true, margin: 0, paraSpaceAfter: 7, valign: "top" }, opts));
}
function takeaway(s, text, color) {
  const y = SH - 1.20;
  card(s, M, y, CW, 0.62, LIGHT, LINE);
  dot(s, M + 0.26, y + 0.25, color || TEAL, 0.13);
  s.addText(text, { x: M + 0.54, y, w: CW - 0.78, h: 0.62, fontFace: BODY, fontSize: 12.5,
    bold: true, color: INK, isTextBox: true, margin: 0, valign: "middle" });
}

// ============================================================== 1  TITLE
{
  const s = newSlide(true);
  pill(s, M, 1.00, 2.5, "REVIEW 2 EVALUATION", TEAL);
  s.addText("Website Fingerprinting over DNS-over-QUIC",
    { x: M, y: 1.58, w: CW - 0.4, h: 0.95, fontFace: HEAD, fontSize: 36, bold: true,
      color: WHITE, isTextBox: true, margin: 0, valign: "middle" });
  s.addText("Measuring the limits of EDNS(0) padding on a " + NSITES +
            "-site closed world of live RFC 9250 traffic",
    { x: M, y: 2.54, w: CW - 0.4, h: 0.46, fontFace: HEAD, fontSize: 17,
      color: ICE, italic: true, isTextBox: true, margin: 0, valign: "middle" });
  s.addText("CSE3002  .  COMPUTER NETWORKS PROJECT",
    { x: M, y: 3.12, w: CW, h: 0.3, fontFace: BODY, fontSize: 10.5, bold: true,
      color: GOLD, charSpacing: 0.6, isTextBox: true, margin: 0, valign: "middle" });

  s.addText("TEAM MEMBERS", { x: M, y: 3.86, w: 7.0, h: 0.26, fontFace: BODY, fontSize: 9,
    bold: true, color: ICE, charSpacing: 0.8, isTextBox: true, margin: 0, valign: "middle" });
  const names = [["Anant Agarwal", "23BDS0145"], ["Aryaman Tripathi", "24BAI0107"],
                 ["Shauryaveer Singh Dabas", "24BCE0416"]];
  names.forEach((n, i) => {
    const x = M + i * 4.05;
    chip(s, x, 4.26, 0.32, String(i + 1), TEAL);
    s.addText(n[0], { x: x + 0.44, y: 4.20, w: 3.5, h: 0.26, fontFace: BODY, fontSize: 12.5,
      bold: true, color: WHITE, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(n[1], { x: x + 0.44, y: 4.44, w: 3.5, h: 0.24, fontFace: BODY, fontSize: 10,
      color: ICE, isTextBox: true, margin: 0, valign: "middle" });
  });

  s.addText("PROJECT GUIDE", { x: M, y: 5.12, w: 7.0, h: 0.26, fontFace: BODY, fontSize: 9,
    bold: true, color: ICE, charSpacing: 0.8, isTextBox: true, margin: 0, valign: "middle" });
  s.addText("Dr. Yoganand S", { x: M, y: 5.40, w: 7.0, h: 0.32, fontFace: BODY, fontSize: 14,
    bold: true, color: WHITE, isTextBox: true, margin: 0, valign: "middle" });
  s.addText("Vellore Institute of Technology", { x: M, y: 5.72, w: 7.0, h: 0.28,
    fontFace: BODY, fontSize: 11, color: ICE, isTextBox: true, margin: 0, valign: "middle" });

  card(s, SW - M - 4.4, 4.96, 4.4, 1.08, "1A2C4B", "24405F");
  s.addText(pct(A_NONE, 1) + "  to  " + pct(A_ADP, 1),
    { x: SW - M - 4.2, y: 5.06, w: 4.0, h: 0.48, fontFace: HEAD, fontSize: 21, bold: true,
      color: GREEN, isTextBox: true, margin: 0, valign: "middle" });
  s.addText("attacker accuracy across " + NSITES + " websites, before and after our defence",
    { x: SW - M - 4.2, y: 5.54, w: 4.05, h: 0.42, fontFace: BODY, fontSize: 9.5,
      color: ICE, isTextBox: true, margin: 0, valign: "top" });
  slideNo += 1;
  s.addNotes("Review 2. The closed world has grown from 20 to " + NSITES +
             " websites, which lowers the random-guess floor to " + FLOOR.toFixed(1) + "%.");
}

// ===================================================== 2  EVALUATION SCOPE
{
  const s = newSlide(false);
  kicker(s, "EVALUATION SCOPE");
  heading(s, "Review-2 Progress Agenda", "Where each workstream stands today");

  const items = [
    ["1", "Architecture", "Seven-module pipeline, defence layer placed between capture and attacker.",
     "100% COMPLETED", GREEN],
    ["2", "Implementation", "Live DoQ capture, four attack models, five padding policies, all running end to end.",
     "100% COMPLETED", GREEN],
    ["3", "Testing & Analysis", "Scale-up from 20 to 100 sites, channel ablation and parameter sweep.",
     "REVIEW-2 FOCUS", TEAL],
    ["4", "Pending Goals", "Wire validation, 1-D CNN, open-world evaluation and the written paper.",
     "PLANNED R3", GOLD]];

  const bw = (CW - 3 * 0.26) / 4;
  items.forEach((it, i) => {
    const x = M + i * (bw + 0.26);
    card(s, x, 1.68, bw, 3.30, i === 2 ? LIGHT : WHITE, it[4]);
    chip(s, x + 0.24, 1.94, 0.44, it[0], it[4]);
    s.addText(it[1], { x: x + 0.24, y: 2.52, w: bw - 0.48, h: 0.40, fontFace: HEAD, fontSize: 15,
      bold: true, color: NAVY, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(it[2], { x: x + 0.24, y: 2.96, w: bw - 0.48, h: 1.30, fontFace: BODY, fontSize: 11,
      color: INK, isTextBox: true, margin: 0, valign: "top" });
    pill(s, x + 0.24, 4.50, bw - 0.48, it[3], it[4]);
  });

  takeaway(s, "Architecture and implementation are closed out. Review 2 is about evidence: ablation, tuning, and a repeat capture that reproduces the result.", TEAL);
  footer(s, "CSE3002  .  Review-2 Evaluation");
}

// ================================================ 3  PROBLEM & OBJECTIVES
{
  const s = newSlide(false);
  kicker(s, "PROJECT FOUNDATION");
  heading(s, "Problem Statement & Objectives", "What is broken, and what we set out to prove");

  const left = [
    ["Metadata survives encryption",
     "DoQ (RFC 9250) hides DNS content, but datagram length, count and timing stay visible to anyone on the path."],
    ["The standard only pads size",
     "RFC 8467 specifies block padding for message length alone, leaving two further channels untreated."],
    ["No DoQ dataset exists",
     "Prior fingerprinting work targets HTTPS and Tor; there is no public DoQ page-load trace corpus to test against."]];
  const right = [
    ["Quantify the leak",
     "Measure attacker accuracy on live DoQ across " + NSITES + " websites, undefended and under four padding policies."],
    ["Isolate the channel",
     "Determine which observable still identifies the site once message lengths are hidden."],
    ["Close it affordably",
     "Design a defence reaching near-random accuracy, reported with its bandwidth and latency cost."]];

  [["Problem Statement", left, RED], ["Core Objectives", right, GREEN]].forEach((col, ci) => {
    const x = M + ci * (CW / 2 + 0.16), w = CW / 2 - 0.16;
    s.addText(col[0], { x: x + 0.04, y: 1.66, w: w, h: 0.34, fontFace: HEAD, fontSize: 15.5,
      bold: true, color: NAVY, isTextBox: true, margin: 0, valign: "middle" });
    col[1].forEach((it, i) => {
      const y = 2.10 + i * 1.18;
      card(s, x, y, w, 1.04, ci === 1 ? LIGHT : WHITE, LINE);
      dot(s, x + 0.24, y + 0.26, col[2], 0.13);
      s.addText(it[0], { x: x + 0.52, y: y + 0.12, w: w - 0.76, h: 0.30, fontFace: BODY,
        fontSize: 12.5, bold: true, color: NAVY, isTextBox: true, margin: 0, valign: "middle" });
      s.addText(it[1], { x: x + 0.52, y: y + 0.42, w: w - 0.76, h: 0.54, fontFace: BODY,
        fontSize: 10.5, color: INK, isTextBox: true, margin: 0, valign: "top" });
    });
  });
  footer(s, "Problem Statement & Objectives");
}

// ================================================= 4  DESIGN & FRAMEWORK
{
  const s = newSlide(false);
  kicker(s, "DESIGN & FRAMEWORK");
  heading(s, "System Architecture & Layering", "The defence layer sits between capture and attacker, so only the policy varies");

  const layers = [
    ["MEASUREMENT LAYER", "Target discovery and live DoQ capture over QUIC (UDP/853)", TEAL],
    ["DEFENCE LAYER", "Block padding  .  count normalisation  .  delay quantisation", GREEN],
    ["ADVERSARY LAYER", "118 encrypted-traffic features  .  Random Forest / GB / MLP / kNN", RED],
    ["EVALUATION LAYER", "5-fold stratified CV  .  accuracy, F1, bandwidth and latency cost", NAVY]];

  layers.forEach((l, i) => {
    const y = 1.70 + i * 0.84;
    card(s, M, y, 7.9, 0.72, i === 1 ? LIGHT : WHITE, l[2]);
    s.addText(l[0], { x: M + 0.26, y: y + 0.08, w: 3.0, h: 0.28, fontFace: BODY, fontSize: 10.5,
      bold: true, color: l[2], charSpacing: 0.5, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(l[1], { x: M + 0.26, y: y + 0.36, w: 7.4, h: 0.30, fontFace: BODY, fontSize: 11,
      color: INK, isTextBox: true, margin: 0, valign: "middle" });
    if (i < layers.length - 1) {
      s.addShape(pres.ShapeType.downArrow, { x: M + 3.76, y: y + 0.74, w: 0.20, h: 0.10,
        fill: { color: MUTED } });
    }
  });

  const rx = M + 8.2, rw = CW - 8.2;
  const specs = [
    ["Protocol stack", "DNS-over-QUIC (RFC 9250) over QUIC/UDP port 853, with EDNS(0) padding per RFC 8467."],
    ["Topology", NSITES + " monitored websites, " + NTRACES + " page-load traces, one reused QUIC connection per worker."],
    ["Control logic", "Every policy is applied to the same captured traces, so accuracy differences come from the defence alone."]];
  specs.forEach((sp, i) => {
    const y = 1.70 + i * 1.14;
    card(s, rx, y, rw, 1.02, WHITE, LINE);
    s.addText(sp[0], { x: rx + 0.22, y: y + 0.10, w: rw - 0.44, h: 0.28, fontFace: BODY,
      fontSize: 11.5, bold: true, color: TEAL, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(sp[1], { x: rx + 0.22, y: y + 0.38, w: rw - 0.44, h: 0.56, fontFace: BODY,
      fontSize: 10, color: INK, isTextBox: true, margin: 0, valign: "top" });
  });
  footer(s, "Architecture & Layering");
}

// ================================================ 5  ENVIRONMENT & TOOLS
{
  const s = newSlide(false);
  kicker(s, "ENVIRONMENT & TOOLS");
  heading(s, "Implementation Tech Stack", "Fully scripted and open source; one command reproduces every figure");

  const tools = [
    ["dnspython + aioquic", "RFC 9250 DoQ client", "Issues real DNS-over-QUIC queries over a reused QUIC connection and records wire lengths and round-trip times.", TEAL],
    ["AdGuard public resolver", "live measurement target", "dns.adguard-dns.com on UDP/853 - a production RFC 9250 resolver, not an emulator.", TEAL],
    ["scikit-learn", "adversary models", "Random Forest, Histogram Gradient Boosting, MLP and k-NN, scored with 5-fold stratified cross-validation.", RED],
    ["NumPy + Matplotlib", "analysis and plotting", "118-feature extraction, channel ablation, parameter sweep and all result figures.", NAVY]];

  const bw = (CW - 0.78) / 4;
  tools.forEach((t, i) => {
    const x = M + i * (bw + 0.26);
    card(s, x, 1.72, bw, 2.90, WHITE, LINE);
    chip(s, x + 0.24, 1.98, 0.42, String(i + 1), t[3]);
    s.addText(t[0], { x: x + 0.24, y: 2.54, w: bw - 0.48, h: 0.40, fontFace: BODY, fontSize: 13,
      bold: true, color: NAVY, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(t[1], { x: x + 0.24, y: 2.92, w: bw - 0.48, h: 0.26, fontFace: BODY, fontSize: 9.5,
      italic: true, color: t[3], isTextBox: true, margin: 0, valign: "middle" });
    s.addText(t[2], { x: x + 0.24, y: 3.22, w: bw - 0.48, h: 1.20, fontFace: BODY, fontSize: 10,
      color: INK, isTextBox: true, margin: 0, valign: "top" });
  });

  takeaway(s, "No emulator and no synthetic traffic: every byte length and round-trip time on this deck was measured against a production resolver.", TEAL);
  footer(s, "Implementation Tech Stack");
}

// =================================================== 6  MILESTONE STATUS
{
  const s = newSlide(false);
  kicker(s, "MILESTONE STATUS");
  heading(s, "Implementation Progress", "Module-level completion against the review plan");

  const rows = [
    ["MOD-01", "Target discovery & live DoQ capture", "Review 1", "Completed", 100, GREEN],
    ["MOD-02", "Preprocessing & 118-feature extraction", "Review 1", "Completed", 100, GREEN],
    ["MOD-03", "Defence layer: padding, count, timing", "Review 2", "Completed", 100, GREEN],
    ["MOD-04", "Attack models & cross-validated evaluation", "Review 2", "Completed", 100, GREEN],
    ["MOD-05", "Channel ablation & parameter sweep", "Review 2", "Completed", 100, GREEN],
    ["MOD-06", "Scale-up to " + NSITES + "-site closed world", "Review 2", "Completed", 100, GREEN],
    ["MOD-07", "tshark wire validation & 1-D CNN", "Review 3", "In Progress", 20, GOLD],
    ["MOD-08", "Open-world evaluation & IEEE paper", "Review 3", "Pending", 10, MUTED]];

  const hy = 1.70, rh = 0.53;
  const cols = [[M + 0.18, 1.0], [M + 1.28, 5.5], [M + 6.95, 1.3], [M + 8.40, 1.4], [M + 9.95, 2.0]];
  const hdr = ["MODULE", "DESCRIPTION", "TARGET", "STATUS", "COMPLETION"];
  hdr.forEach((h, i) => {
    s.addText(h, { x: cols[i][0], y: hy, w: cols[i][1], h: 0.28, fontFace: BODY, fontSize: 8.5,
      bold: true, color: MUTED, charSpacing: 0.6, isTextBox: true, margin: 0, valign: "middle" });
  });

  rows.forEach((r, i) => {
    const y = hy + 0.34 + i * rh;
    card(s, M, y, CW, rh - 0.07, i % 2 === 0 ? WHITE : LIGHT, LINE);
    s.addText(r[0], { x: cols[0][0], y, w: cols[0][1], h: rh - 0.07, fontFace: BODY, fontSize: 10.5,
      bold: true, color: TEAL, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(r[1], { x: cols[1][0], y, w: cols[1][1], h: rh - 0.07, fontFace: BODY, fontSize: 11,
      color: INK, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(r[2], { x: cols[2][0], y, w: cols[2][1], h: rh - 0.07, fontFace: BODY, fontSize: 10.5,
      color: MUTED, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(r[3], { x: cols[3][0], y, w: cols[3][1], h: rh - 0.07, fontFace: BODY, fontSize: 10.5,
      bold: true, color: r[5], isTextBox: true, margin: 0, valign: "middle" });
    // completion bar
    const bx = cols[4][0], bwid = 1.35;
    s.addShape(pres.ShapeType.roundRect, { x: bx, y: y + 0.17, w: bwid, h: 0.12, rectRadius: 0.06,
      fill: { color: "E3E9EF" } });
    s.addShape(pres.ShapeType.roundRect, { x: bx, y: y + 0.17, w: Math.max(bwid * r[4] / 100, 0.1),
      h: 0.12, rectRadius: 0.06, fill: { color: r[5] } });
    s.addText(r[4] + "%", { x: bx + bwid + 0.08, y, w: 0.55, h: rh - 0.07, fontFace: BODY,
      fontSize: 10, bold: true, color: r[5], isTextBox: true, margin: 0, valign: "middle" });
  });

  takeaway(s, "Six of eight modules complete. Review-2 scope closed; the two remaining modules are Review-3 deliverables.", GREEN);
  footer(s, "Implementation Progress");
}

// ======================================================== 7  METHODOLOGY
{
  const s = newSlide(false);
  kicker(s, "METHODOLOGY");
  heading(s, "Experimental Testbed Setup", "How a page load is represented, and how the adversary is scored");

  const stats = [[String(NSITES), "monitored websites"], [String(NTRACES), "page-load traces"],
                 [NQ.toLocaleString("en-US"), "live DoQ queries"], [String(NFEAT), "features per trace"]];
  const bw = (CW - 0.72) / 4;
  stats.forEach((st, i) => {
    const x = M + i * (bw + 0.24);
    card(s, x, 1.70, bw, 1.08, LIGHT, LINE);
    s.addText(st[0], { x: x + 0.20, y: 1.78, w: bw - 0.40, h: 0.56, fontFace: HEAD, fontSize: 25,
      bold: true, color: NAVY, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(st[1], { x: x + 0.20, y: 2.32, w: bw - 0.40, h: 0.32, fontFace: BODY, fontSize: 10.5,
      color: MUTED, isTextBox: true, margin: 0, valign: "middle" });
  });

  s.addText("Traffic generation", { x: M, y: 2.96, w: 6.0, h: 0.32, fontFace: HEAD, fontSize: 14.5,
    bold: true, color: NAVY, isTextBox: true, margin: 0, valign: "middle" });
  para(s, [
    "Each landing page is crawled for the hostnames it actually references, so domain sets are measured, not hand-written.",
    "Every hostname is resolved for A and AAAA over one reused QUIC connection, as a dual-stack stub resolver does.",
    "Visits are interleaved across sites so resolver cache state cannot act as a hidden label."],
    { x: M + 0.04, y: 3.36, w: 5.85, h: 1.60, bullet: true, fontSize: 11 });

  const rx = M + 6.30, rw = CW - 6.30;
  s.addText("Adversary and scoring", { x: rx, y: 2.96, w: rw, h: 0.32, fontFace: HEAD,
    fontSize: 14.5, bold: true, color: NAVY, isTextBox: true, margin: 0, valign: "middle" });
  const meas = [["Observables", "direction, datagram length, arrival time - nothing else"],
                ["Baseline", "undefended DoQ, no EDNS(0) padding"],
                ["Policies", "RFC 8467, RFC 8467 + count, adaptive, maximal"],
                ["Validation", "5-fold stratified cross-validation, " + R.n_folds + " folds"],
                ["Random-guess floor", FLOOR.toFixed(1) + "% across " + NSITES + " classes"]];
  meas.forEach((m, i) => {
    const y = 3.36 + i * 0.44;
    s.addText(m[0], { x: rx, y, w: 1.95, h: 0.40, fontFace: BODY, fontSize: 11, bold: true,
      color: TEAL, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(m[1], { x: rx + 2.00, y, w: rw - 2.00, h: 0.40, fontFace: BODY, fontSize: 11,
      color: INK, isTextBox: true, margin: 0, valign: "middle" });
  });

  takeaway(s, "Only one quantity is modelled rather than measured: the constant 31-byte QUIC framing overhead per datagram.", TEAL);
  footer(s, "Experimental Testbed Setup");
}

// =================================================== 8  PERFORMANCE DATA
{
  const s = newSlide(false);
  kicker(s, "PERFORMANCE DATA");
  heading(s, "Results Analysis", "Four attackers against five padding policies, " + R.n_folds + "-fold cross-validated");

  s.addImage({ path: FIG("fig1_attack_vs_defence.png"), x: M, y: 1.66, w: 7.35, h: 3.76 });

  const rx = M + 7.65, rw = CW - 7.65;
  const findings = [
    ["Undefended DoQ leaks completely", pct(A_NONE, 1) + " across " + NSITES +
     " sites against a " + FLOOR.toFixed(1) + "% floor.", RED],
    ["More padding does not help", "Maximal padding costs " + pct(O_MAX, 0) +
     " bandwidth and scores " + pct(A_MAX, 1) + " - no better than RFC 8467.", GOLD],
    ["Our defence nearly closes it", pct(A_ADP, 1) + " at " + pct(O_ADP, 0) +
     " bandwidth and +" + L_ADP.toFixed(0) + " ms latency - the closest any policy gets to the " +
     FLOOR.toFixed(0) + "% floor, though a residual gap remains.", GREEN]];
  findings.forEach((f, i) => {
    const y = 1.66 + i * 1.30;
    card(s, rx, y, rw, 1.16, i === 2 ? LIGHT : WHITE, f[2]);
    dot(s, rx + 0.22, y + 0.26, f[2], 0.13);
    s.addText(f[0], { x: rx + 0.50, y: y + 0.12, w: rw - 0.72, h: 0.32, fontFace: BODY,
      fontSize: 12, bold: true, color: NAVY, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(f[1], { x: rx + 0.50, y: y + 0.44, w: rw - 0.72, h: 0.62, fontFace: BODY,
      fontSize: 10.5, color: INK, isTextBox: true, margin: 0, valign: "top" });
  });

  let cmp = "Residual leak after RFC 8467:  count alone " +
    (ablCount === null ? "n/a" : ablCount.toFixed(1) + "%") + "   .   timing alone " +
    (ablTime === null ? "n/a" : ablTime.toFixed(1) + "%") +
    "   .   closing both reaches " + pct(A_ADP, 1);
  if (PREV) {
    cmp += "      |      Same experiment at " + PREV.dataset.n_sites + " sites: " +
      pct(acc(PREV, "rfc8467"), 0) + " vs maximal " + pct(acc(PREV, "maximal"), 0) +
      " - the ordering reproduces at " +
      Math.round(NSITES / PREV.dataset.n_sites) + "x the class count.";
  }
  takeaway(s, cmp, TEAL);
  footer(s, "Preliminary Results Analysis");
}

// ================================================== 9  RISK & RESOLUTION
{
  const s = newSlide(false);
  kicker(s, "RISK & RESOLUTION");
  heading(s, "Key Challenges Encountered", "Two problems that changed the design, and how each was resolved");

  const ch = [
    ["Challenge 1", "Results were not reproducible",
     "Reported accuracy moved by about three points between identical runs. The cause was Python salting str hashing per process, so the cover-traffic RNG drew a different sequence every time.",
     "Seeded the defence RNG with crc32 over a stable key instead of hash(). Two consecutive runs now produce identical numbers to the decimal.", RED],
    ["Challenge 2", "Padding harder made no difference",
     "Maximal padding cost three times the bandwidth of RFC 8467 and scored no better. Simply increasing padding strength was not reducing the attack at all.",
     "Ran a channel ablation and found the size channel was already closed; the residual leak was exchange count and timing. The defence was redesigned around those two instead.", GOLD]];

  ch.forEach((c, i) => {
    const x = M + i * (CW / 2 + 0.16), w = CW / 2 - 0.16;
    card(s, x, 1.68, w, 3.72, WHITE, c[4]);
    pill(s, x + 0.24, 1.90, 1.35, c[0], c[4]);
    s.addText(c[1], { x: x + 0.24, y: 2.32, w: w - 0.48, h: 0.42, fontFace: HEAD, fontSize: 15,
      bold: true, color: NAVY, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(c[2], { x: x + 0.24, y: 2.78, w: w - 0.48, h: 1.10, fontFace: BODY, fontSize: 11,
      color: INK, isTextBox: true, margin: 0, valign: "top" });

    card(s, x + 0.24, 3.92, w - 0.48, 1.30, LIGHT, GREEN);
    s.addText("SOLUTION IMPLEMENTED", { x: x + 0.44, y: 4.04, w: w - 0.88, h: 0.26,
      fontFace: BODY, fontSize: 8.5, bold: true, color: GREEN, charSpacing: 0.6,
      isTextBox: true, margin: 0, valign: "middle" });
    s.addText(c[3], { x: x + 0.44, y: 4.30, w: w - 0.88, h: 0.84, fontFace: BODY, fontSize: 10.5,
      color: INK, isTextBox: true, margin: 0, valign: "top" });
  });

  takeaway(s, "The second challenge produced the project's main finding: the leak that matters is not message size.", GOLD);
  footer(s, "Challenges & Resolutions");
}

// ========================================================== 10  ROADMAP
{
  const s = newSlide(false);
  kicker(s, "ROADMAP");
  heading(s, "Review-3 Target Deliverables", "What closes the gap between this prototype and a publishable result");

  const items = [
    ["Wire validation & deep model",
     "Validate the 31-byte QUIC framing constant against tshark captures of the same traffic, then replace the MLP stand-in with a 1-D CNN over the raw observed size sequence."],
    ["Open-world evaluation",
     "Move beyond a closed world: detect whether a visit is one of the monitored sites at all, driven from a real browser page load rather than a stub resolver."],
    ["Paper & documentation",
     "Write up the count-and-timing finding in IEEE format, with the full test bench, the released dataset and the public GitHub repository."]];

  items.forEach((it, i) => {
    const y = 1.76 + i * 1.28;
    card(s, M, y, CW, 1.14, i === 0 ? LIGHT : WHITE, i === 0 ? TEAL : LINE);
    chip(s, M + 0.28, y + 0.32, 0.50, String(i + 1), i === 0 ? TEAL : NAVY);
    s.addText(it[0], { x: M + 1.00, y: y + 0.16, w: CW - 1.3, h: 0.36, fontFace: HEAD,
      fontSize: 15, bold: true, color: NAVY, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(it[1], { x: M + 1.00, y: y + 0.52, w: CW - 1.3, h: 0.54, fontFace: BODY,
      fontSize: 11, color: INK, isTextBox: true, margin: 0, valign: "top" });
  });

  takeaway(s, "Code, captured dataset and every figure on this deck are already public: github.com/svsdlmao/website-fingerprinting-doq", TEAL);
  footer(s, "Review-3 Roadmap");
}

// ======================================================= 11  REFERENCES
{
  const s = newSlide(false);
  kicker(s, "ACADEMIC RIGOR");
  heading(s, "Key References & RFC Standards", "Standards and prior work this project builds on");

  const refs = [
    ["RFC 9250", "C. Huitema, S. Dickinson, A. Mankin. DNS over Dedicated QUIC Connections. IETF Standards Track, May 2022."],
    ["RFC 8467", "A. Mayrhofer. Padding Policies for Extension Mechanisms for DNS (EDNS(0)). IETF, October 2018."],
    ["RFC 9000", "J. Iyengar, M. Thomson. QUIC: A UDP-Based Multiplexed and Secure Transport. IETF, May 2021."],
    ["NDSS 2020", "S. Siby, M. Juarez, C. Diaz, N. Vallina-Rodriguez, C. Troncoso. Encrypted DNS Privacy? A Traffic Analysis Perspective."],
    ["PAM 2022", "M. Kosek, T. V. Doan, S. Granderath, V. Bajpai. One to Rule Them All? A First Look at DNS over QUIC."],
    ["NDSS 2016", "A. Panchenko et al. Website Fingerprinting at Internet Scale."]];

  refs.forEach((r, i) => {
    const y = 1.72 + i * 0.74;
    card(s, M, y, CW, 0.64, i % 2 === 0 ? WHITE : LIGHT, LINE);
    s.addText(r[0], { x: M + 0.26, y, w: 1.5, h: 0.64, fontFace: BODY, fontSize: 11.5,
      bold: true, color: TEAL, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(r[1], { x: M + 1.85, y, w: CW - 2.15, h: 0.64, fontFace: BODY, fontSize: 11,
      color: INK, isTextBox: true, margin: 0, valign: "middle" });
  });
  footer(s, "References & Standards");
}

// ======================================================== 12  THANK YOU
{
  const s = newSlide(true);
  s.addText("Thank You", { x: M, y: 2.30, w: CW, h: 1.0, fontFace: HEAD, fontSize: 46,
    bold: true, color: WHITE, isTextBox: true, margin: 0, valign: "middle" });
  s.addText("Questions & Reviewer Suggestions", { x: M, y: 3.32, w: CW, h: 0.5,
    fontFace: HEAD, fontSize: 19, italic: true, color: ICE, isTextBox: true, margin: 0, valign: "middle" });

  const facts = [[String(NSITES), "websites"], [NQ.toLocaleString("en-US"), "live DoQ queries"],
                 [pct(A_NONE, 0), "undefended"], [pct(A_ADP, 1), "with our defence"]];
  const bw = (CW - 0.72) / 4;
  facts.forEach((f, i) => {
    const x = M + i * (bw + 0.24);
    card(s, x, 4.40, bw, 1.00, "1A2C4B", "24405F");
    s.addText(f[0], { x: x + 0.20, y: 4.50, w: bw - 0.40, h: 0.48, fontFace: HEAD, fontSize: 20,
      bold: true, color: i === 3 ? GREEN : WHITE, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(f[1], { x: x + 0.20, y: 4.98, w: bw - 0.40, h: 0.30, fontFace: BODY, fontSize: 10,
      color: ICE, isTextBox: true, margin: 0, valign: "middle" });
  });

  s.addText("CSE3002  .  Review-2 Evaluation Complete  .  github.com/svsdlmao/website-fingerprinting-doq",
    { x: M, y: 5.90, w: CW, h: 0.32, fontFace: BODY, fontSize: 10.5, color: ICE,
      isTextBox: true, margin: 0, valign: "middle" });
  footer(s, "CSE3002  .  Computer Networks Project", true);
}

const out = path.join(ROOT, "presentation", "Review2_WF_DoQ.pptx");
pres.writeFile({ fileName: out }).then(() => console.log("written: " + out));
