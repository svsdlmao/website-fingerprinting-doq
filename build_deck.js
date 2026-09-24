// Review-1 deck generator - Website Fingerprinting over DNS-over-QUIC
const pptxgen = require("pptxgenjs");
const path = require("path");

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";            // 13.333 x 7.5 in
pres.author = "Anant Agarwal, Aryaman Tripathi, Shauryaveer Singh Dabas";
pres.title = "Website Fingerprinting over DNS-over-QUIC - Review 1";

// ---------------------------------------------------------------- palette
const NAVY = "12203A", INK = "1B2A41", TEAL = "1C7293", RED = "D1495B",
      GREEN = "37A06E", GOLD = "C98B29", MUTED = "6B7B8C", LIGHT = "F2F5F9",
      LINE = "D9E1E9", WHITE = "FFFFFF", ICE = "9FB8CD";

const HEAD = "Cambria", BODY = "Calibri";
const M = 0.62, CW = 13.333 - 2 * M, SW = 13.333, SH = 7.5;

let slideNo = 0;
const FIG = (n) => path.join(__dirname, "results", "figures", n);

// ---------------------------------------------------------------- helpers
function newSlide(dark) {
  const s = pres.addSlide();
  s.background = { color: dark ? NAVY : WHITE };
  return s;
}

function heading(s, title, kicker, dark) {
  s.addText(title, { x: M, y: 0.34, w: CW, h: 0.62, fontFace: HEAD, fontSize: 29,
    bold: true, color: dark ? WHITE : NAVY, isTextBox: true, margin: 0, valign: "middle" });
  if (kicker) {
    s.addText(kicker, { x: M, y: 0.98, w: CW, h: 0.32, fontFace: BODY, fontSize: 12.5,
      color: dark ? ICE : MUTED, isTextBox: true, margin: 0, valign: "middle" });
  }
}

function footer(s, label, dark) {
  slideNo += 1;
  s.addText(label, { x: M, y: SH - 0.44, w: 8.5, h: 0.3, fontFace: BODY, fontSize: 9,
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
    fontSize: 11, bold: true, color: WHITE, isTextBox: true, margin: 0 });
}

function dot(s, x, y, color, d) {
  const dd = d || 0.12;
  s.addShape(pres.ShapeType.ellipse, { x, y, w: dd, h: dd, fill: { color } });
}

function para(s, items, opts) {
  const runs = items.map((t, i) => ({ text: t,
    options: { breakLine: i < items.length - 1, bullet: opts.bullet === true } }));
  s.addText(runs, Object.assign({ fontFace: BODY, fontSize: 13, color: INK,
    isTextBox: true, margin: 0, paraSpaceAfter: 7, valign: "top" }, opts));
}

function takeaway(s, text, color) {
  const y = SH - 1.22;
  card(s, M, y, CW, 0.64, LIGHT, LINE);
  dot(s, M + 0.26, y + 0.26, color || TEAL, 0.13);
  s.addText(text, { x: M + 0.54, y: y, w: CW - 0.78, h: 0.64, fontFace: BODY, fontSize: 13,
    bold: true, color: INK, isTextBox: true, margin: 0, valign: "middle" });
}

// ================================================================ 1  TITLE
{
  const s = newSlide(true);
  s.addShape(pres.ShapeType.roundRect, { x: M, y: 1.05, w: 3.05, h: 0.42, rectRadius: 0.2,
    fill: { color: TEAL } });
  s.addText("REVIEW 1   .   25% IMPLEMENTATION", { x: M, y: 1.05, w: 3.05, h: 0.42,
    align: "center", valign: "middle", fontFace: BODY, fontSize: 10, bold: true,
    color: WHITE, charSpacing: 0.4, isTextBox: true, margin: 0 });

  s.addText("Website Fingerprinting over DNS-over-QUIC",
    { x: M, y: 1.70, w: CW - 0.4, h: 1.0, fontFace: HEAD, fontSize: 38, bold: true,
      color: WHITE, isTextBox: true, margin: 0, valign: "middle" });
  s.addText("Evaluating the Limits of Padding Defences",
    { x: M, y: 2.70, w: CW - 0.4, h: 0.5, fontFace: HEAD, fontSize: 20,
      color: ICE, italic: true, isTextBox: true, margin: 0, valign: "middle" });

  const names = [["Anant Agarwal", "23BDS0145"], ["Aryaman Tripathi", "24BAI0107"],
                 ["Shauryaveer Singh Dabas", "24BCE0416"]];
  names.forEach((n, i) => {
    const x = M + i * 4.05;
    chip(s, x, 4.02, 0.34, String(i + 1), TEAL);
    s.addText(n[0], { x: x + 0.46, y: 3.96, w: 3.5, h: 0.26, fontFace: BODY, fontSize: 13,
      bold: true, color: WHITE, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(n[1], { x: x + 0.46, y: 4.21, w: 3.5, h: 0.24, fontFace: BODY, fontSize: 10.5,
      color: ICE, isTextBox: true, margin: 0, valign: "middle" });
  });

  s.addText("Vellore Institute of Technology", { x: M, y: 5.30, w: 7.2, h: 0.3,
    fontFace: BODY, fontSize: 13, color: WHITE, isTextBox: true, margin: 0, valign: "middle" });
  s.addText("Course Faculty   .   Dr. Yoganand S", { x: M, y: 5.60, w: 7.2, h: 0.3,
    fontFace: BODY, fontSize: 11.5, color: ICE, isTextBox: true, margin: 0, valign: "middle" });

  card(s, SW - M - 4.3, 5.10, 4.3, 0.96, "1A2C4B", "24405F");
  s.addText("100%  to  7.8%", { x: SW - M - 4.12, y: 5.18, w: 4.0, h: 0.44, fontFace: HEAD,
    fontSize: 21, bold: true, color: GREEN, isTextBox: true, margin: 0, valign: "middle" });
  s.addText("attacker accuracy, before and after our defence",
    { x: SW - M - 4.12, y: 5.62, w: 4.0, h: 0.3, fontFace: BODY, fontSize: 10,
      color: ICE, isTextBox: true, margin: 0, valign: "middle" });
  slideNo += 1;
  s.addNotes("Review 1. Since Review 0 we have a working measurement pipeline and real results on live DNS-over-QUIC traffic captured from a public RFC 9250 resolver.");
}

// ======================================================= 2  REVIEW 0 -> 1
{
  const s = newSlide(false);
  heading(s, "From Review 0 to Review 1", "What existed then, and what runs today");

  const cols = [
    { t: "Review 0   .   proposed", c: MUTED, items: [
      "Stated the problem: DoQ hides DNS content, but perhaps not behaviour",
      "Planned a dataset, ML classifiers and a padding comparison",
      "Named the metrics: accuracy, latency, bandwidth overhead",
      "No data, no code, no measurements"] },
    { t: "Review 1   .   built and measured", c: GREEN, items: [
      "10,240 live DoQ queries captured from a real RFC 9250 resolver",
      "All 7 modules implemented; one command runs capture through to figures",
      "5 padding policies x 4 attack models, 5-fold cross-validated",
      "A tuned defence that drops the attack from 100% to 7.8%"] }];

  cols.forEach((col, i) => {
    const x = M + i * (CW / 2 + 0.16), w = CW / 2 - 0.16;
    card(s, x, 1.56, w, 3.34, i === 0 ? WHITE : LIGHT, i === 0 ? LINE : TEAL);
    dot(s, x + 0.3, 1.88, col.c, 0.14);
    s.addText(col.t, { x: x + 0.56, y: 1.74, w: w - 0.8, h: 0.38, fontFace: HEAD, fontSize: 16,
      bold: true, color: i === 0 ? MUTED : NAVY, isTextBox: true, margin: 0, valign: "middle" });
    para(s, col.items, { x: x + 0.34, y: 2.26, w: w - 0.68, h: 2.5, bullet: true,
      fontSize: 12.5, color: i === 0 ? MUTED : INK });
  });

  takeaway(s, "The proposal is now a running system, with a measurement behind every claim.", GREEN);
  footer(s, "Website Fingerprinting over DoQ   .   Review 1");
}

// ============================================================ 3 OBJECTIVES
{
  const s = newSlide(false);
  heading(s, "Objectives", "One primary goal, five measurable sub-goals");

  card(s, M, 1.54, CW, 0.94, LIGHT, TEAL);
  s.addText("PRIMARY", { x: M + 0.3, y: 1.66, w: 1.6, h: 0.26, fontFace: BODY, fontSize: 9.5,
    bold: true, color: TEAL, charSpacing: 0.6, isTextBox: true, margin: 0, valign: "middle" });
  s.addText("Measure how much website-identifying information survives EDNS(0) padding on DNS-over-QUIC, and design a defence that closes what remains.",
    { x: M + 0.3, y: 1.92, w: CW - 0.6, h: 0.48, fontFace: BODY, fontSize: 14, bold: true,
      color: NAVY, isTextBox: true, margin: 0, valign: "middle" });

  const objs = [
    "Build a reproducible capture pipeline on live DoQ traffic, not synthetic traces.",
    "Quantify the attack with no padding, with RFC 8467 padding, and with maximal padding.",
    "Isolate which traffic channel still leaks once message lengths are hidden.",
    "Propose and tune a defence that reaches near-random accuracy at an affordable cost.",
    "Report privacy and cost together: accuracy, bandwidth overhead and added latency."];
  objs.forEach((o, i) => {
    const y = 2.74 + i * 0.72;
    chip(s, M + 0.06, y, 0.34, String(i + 1), i === 4 ? GREEN : TEAL);
    s.addText(o, { x: M + 0.58, y: y - 0.05, w: CW - 0.8, h: 0.44, fontFace: BODY,
      fontSize: 13, color: INK, isTextBox: true, margin: 0, valign: "middle" });
  });
  footer(s, "Objectives");
}

// ========================================================== 4 GAP ANALYSIS
{
  const s = newSlide(false);
  heading(s, "Gap Analysis", "Gap   =   desired situation   minus   current situation");

  const cols = [
    { t: "Current situation", c: RED, items: [
      "DoQ (RFC 9250) encrypts DNS content, but datagram length, count and timing stay visible.",
      "RFC 8467 specifies padding for message size only.",
      "Most fingerprinting work targets HTTPS and Tor; DoQ-specific evidence is thin.",
      "No public DoQ page-load trace dataset exists."] },
    { t: "Desired situation", c: GREEN, items: [
      "A measured, reproducible DoQ trace dataset.",
      "Evidence of how much padding actually helps, channel by channel.",
      "A defence that addresses every leaking channel, not just size.",
      "Privacy and cost reported on the same axes."] }];

  cols.forEach((col, i) => {
    const x = M + i * (CW / 2 + 0.16), w = CW / 2 - 0.16;
    card(s, x, 1.54, w, 2.56, i === 0 ? WHITE : LIGHT, LINE);
    dot(s, x + 0.3, 1.84, col.c, 0.14);
    s.addText(col.t, { x: x + 0.56, y: 1.70, w: w - 0.8, h: 0.38, fontFace: HEAD, fontSize: 16,
      bold: true, color: NAVY, isTextBox: true, margin: 0, valign: "middle" });
    para(s, col.items, { x: x + 0.34, y: 2.20, w: w - 0.68, h: 1.9, bullet: true, fontSize: 12.5 });
  });

  card(s, M, 4.86, CW, 1.22, NAVY, NAVY);
  s.addText("THE GAP", { x: M + 0.32, y: 5.00, w: 1.6, h: 0.26, fontFace: BODY, fontSize: 9.5,
    bold: true, color: GOLD, charSpacing: 0.6, isTextBox: true, margin: 0, valign: "middle" });
  s.addText("No one has shown which channel still leaks after RFC 8467 padding on DoQ, nor what it costs to close it. That is the question this project answers.",
    { x: M + 0.32, y: 5.28, w: CW - 0.64, h: 0.62, fontFace: BODY, fontSize: 14, bold: true,
      color: WHITE, isTextBox: true, margin: 0, valign: "middle" });
  footer(s, "Gap Analysis");
}

// ====================================================== 5 PROPOSED SYSTEM
{
  const s = newSlide(false);
  heading(s, "The Proposed System", "A measurement testbed that scores attack and defence on identical traffic");

  card(s, M, 1.52, CW, 0.82, LIGHT, LINE);
  s.addText("A pipeline that captures real DoQ page-load traffic, replays it through a set of padding policies, and measures how well four classifiers can still identify the visited website.",
    { x: M + 0.3, y: 1.52, w: CW - 0.6, h: 0.82, fontFace: BODY, fontSize: 13.5, color: INK,
      isTextBox: true, margin: 0, valign: "middle" });

  s.addText("Novelty against existing work", { x: M, y: 2.54, w: CW, h: 0.34, fontFace: HEAD,
    fontSize: 16, bold: true, color: NAVY, isTextBox: true, margin: 0, valign: "middle" });

  const rows = [
    ["Padding evaluated on message size only", "Size, exchange count and timing evaluated separately"],
    ["A single padding policy, pass or fail", "Five policies forming a layered ablation"],
    ["Simulated or replayed trace datasets", "Live RFC 9250 capture from a public resolver"],
    ["Accuracy reported on its own", "Accuracy, bandwidth and latency on the same axes"]];

  const hy = 2.96, rh = 0.74;
  s.addText("EXISTING WORK", { x: M + 0.3, y: hy, w: 5.6, h: 0.3, fontFace: BODY, fontSize: 9.5,
    bold: true, color: MUTED, charSpacing: 0.6, isTextBox: true, margin: 0, valign: "middle" });
  s.addText("THIS PROJECT", { x: M + 6.5, y: hy, w: 5.6, h: 0.3, fontFace: BODY, fontSize: 9.5,
    bold: true, color: TEAL, charSpacing: 0.6, isTextBox: true, margin: 0, valign: "middle" });

  rows.forEach((r, i) => {
    const y = hy + 0.36 + i * rh;
    card(s, M, y, 5.9, rh - 0.08, WHITE, LINE);
    card(s, M + 6.2, y, 5.9, rh - 0.08, LIGHT, LINE);
    s.addText(r[0], { x: M + 0.24, y: y, w: 5.45, h: rh - 0.08, fontFace: BODY, fontSize: 12,
      color: MUTED, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(r[1], { x: M + 6.44, y: y, w: 5.45, h: rh - 0.08, fontFace: BODY, fontSize: 12,
      bold: true, color: INK, isTextBox: true, margin: 0, valign: "middle" });
  });
  footer(s, "Proposed System and Novelty");
}

// ========================================================= 6 ARCHITECTURE
{
  const s = newSlide(false);
  heading(s, "System Architecture", "Data flows left to right; the defence layer sits between capture and attacker");

  const boxes = [
    ["Live websites", "20 real landing pages", TEAL],
    ["M1  Capture", "DoQ over QUIC, UDP/853", TEAL],
    ["M2  Preprocess", "clean and label traces", TEAL],
    ["M3  Defence layer", "pad, pad count, shape time", GREEN]];
  const boxes2 = [
    ["M4  Features", "118 encrypted-traffic features", RED],
    ["M5  Attack models", "RF / GB / MLP / kNN", RED],
    ["M6  Evaluation", "5-fold CV, cost metrics", NAVY],
    ["M7  Figures", "six result plots", NAVY]];

  function rowOf(list, y) {
    const bw = 2.72, gap = 0.43;
    list.forEach((b, i) => {
      const x = M + i * (bw + gap);
      card(s, x, y, bw, 1.02, b[2] === GREEN ? LIGHT : WHITE, b[2]);
      s.addText(b[0], { x: x + 0.16, y: y + 0.12, w: bw - 0.32, h: 0.34, fontFace: BODY,
        fontSize: 13, bold: true, color: NAVY, isTextBox: true, margin: 0, valign: "middle" });
      s.addText(b[1], { x: x + 0.16, y: y + 0.46, w: bw - 0.32, h: 0.44, fontFace: BODY,
        fontSize: 10.5, color: MUTED, isTextBox: true, margin: 0, valign: "top" });
      if (i < list.length - 1) {
        s.addShape(pres.ShapeType.rightArrow, { x: x + bw + 0.09, y: y + 0.4, w: 0.25, h: 0.22,
          fill: { color: MUTED } });
      }
    });
  }
  rowOf(boxes, 1.60);
  rowOf(boxes2, 3.46);

  s.addShape(pres.ShapeType.downArrow, { x: M + 11.44, y: 2.80, w: 0.22, h: 0.54,
    fill: { color: MUTED } });

  card(s, M, 5.14, CW, 0.94, LIGHT, TEAL);
  s.addText("Every padding policy is applied to the same captured traces, so differences in attacker accuracy come from the defence alone and not from re-measurement noise.",
    { x: M + 0.3, y: 5.14, w: CW - 0.6, h: 0.94, fontFace: BODY, fontSize: 12.5, color: INK,
      isTextBox: true, margin: 0, valign: "middle" });
  footer(s, "System Architecture");
}

// ================================================= 7 MODULE IDENTIFICATION
{
  const s = newSlide(false);
  heading(s, "Module Identification", "Seven modules, each a separate file that runs on its own");

  const mods = [
    ["M1", "Traffic Capture", "src/capture/doq_client.py", TEAL],
    ["M2", "Preprocessing", "src/preprocess.py", TEAL],
    ["M3", "Defence Layer", "src/defenses.py", GREEN],
    ["M4", "Feature Extraction", "src/features.py", RED],
    ["M5", "Attack Models", "src/models.py", RED],
    ["M6", "Evaluation", "src/evaluate.py", NAVY],
    ["M7", "Visualisation", "src/viz.py", NAVY]];

  const bw = 3.87, bh = 1.32, gx = 0.26, gy = 0.30;
  mods.forEach((m, i) => {
    const r = Math.floor(i / 3), c = i % 3;
    const x = M + c * (bw + gx), y = 1.56 + r * (bh + gy);
    card(s, x, y, bw, bh, WHITE, LINE);
    chip(s, x + 0.22, y + 0.24, 0.42, m[0], m[3]);
    s.addText(m[1], { x: x + 0.76, y: y + 0.2, w: bw - 0.92, h: 0.34, fontFace: BODY,
      fontSize: 14, bold: true, color: NAVY, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(m[2], { x: x + 0.76, y: y + 0.54, w: bw - 0.92, h: 0.28, fontFace: "Courier New",
      fontSize: 10, color: MUTED, isTextBox: true, margin: 0, valign: "middle" });
  });

  const x = M + 2 * (bw + gx), y = 1.56 + 2 * (bh + gy);
  card(s, x, y, bw, bh, LIGHT, TEAL);
  s.addText("run_pipeline.py", { x: x + 0.22, y: y + 0.18, w: bw - 0.44, h: 0.34,
    fontFace: "Courier New", fontSize: 12, bold: true, color: NAVY, isTextBox: true,
    margin: 0, valign: "middle" });
  s.addText("Runs M1 through M7 end to end and writes every metric and figure.",
    { x: x + 0.22, y: y + 0.52, w: bw - 0.44, h: 0.56, fontFace: BODY, fontSize: 11,
      color: INK, isTextBox: true, margin: 0, valign: "top" });
  footer(s, "Module Identification");
}

// ================================================ 8 MODULE EXPLANATION I
{
  const s = newSlide(false);
  heading(s, "Module Explanation   .   M1 to M3", "Input, process and output of each module");

  const mods = [
    ["M1", "Traffic Capture", TEAL,
     "20 target website URLs",
     "Crawl each landing page for the hostnames it references, then resolve every hostname (A and AAAA) over one reused QUIC connection to a public DoQ resolver. Record wire length, round-trip time and offset for each exchange.",
     "400 page-load traces, JSONL"],
    ["M2", "Preprocessing", TEAL,
     "Raw capture records",
     "Drop traces damaged by resolver timeouts, require 70% completeness, sort exchanges by sequence and re-index the class labels over the sites that survived.",
     "400 clean labelled traces plus a dataset summary"],
    ["M3", "Defence Layer", GREEN,
     "One clean trace plus a policy name",
     "Pad query and response lengths to block multiples, add indistinguishable cover lookups until the exchange count reaches a fixed grid, and quantise response delay and query cadence.",
     "The same trace as the attacker would observe it"]];

  const rh = 1.45;
  mods.forEach((m, i) => {
    const y = 1.52 + i * (rh + 0.22);
    card(s, M, y, CW, rh, i === 2 ? LIGHT : WHITE, i === 2 ? GREEN : LINE);
    chip(s, M + 0.22, y + 0.2, 0.4, m[0], m[2]);
    s.addText(m[1], { x: M + 0.2, y: y + 0.66, w: 1.62, h: 0.5, fontFace: BODY, fontSize: 11.5,
      bold: true, color: NAVY, isTextBox: true, margin: 0, valign: "top", align: "left" });

    const colX = [M + 1.95, M + 4.15, M + 10.15];
    const colW = [2.05, 5.85, 1.75];
    const labels = ["INPUT", "PROCESS", "OUTPUT"];
    [m[3], m[4], m[5]].forEach((txt, j) => {
      s.addText(labels[j], { x: colX[j], y: y + 0.14, w: colW[j], h: 0.24, fontFace: BODY,
        fontSize: 8.5, bold: true, color: j === 1 ? TEAL : MUTED, charSpacing: 0.6,
        isTextBox: true, margin: 0, valign: "middle" });
      s.addText(txt, { x: colX[j], y: y + 0.40, w: colW[j], h: 0.86, fontFace: BODY,
        fontSize: 10.5, color: INK, isTextBox: true, margin: 0, valign: "top" });
    });
  });
  footer(s, "Module Explanation  .  M1 to M3");
}

// =============================================== 9 MODULE EXPLANATION II
{
  const s = newSlide(false);
  heading(s, "Module Explanation   .   M4 to M7", "Input, process and output of each module");

  const mods = [
    ["M4", "Feature Extraction", RED,
     "One observed trace",
     "Derive 118 features using only what an on-path attacker can see: direction, datagram length and arrival time. Volume, length statistics, length histograms, the observed size prefix, cumulative volume and timing.",
     "Feature matrix, 400 x 118"],
    ["M5", "Attack Models", RED,
     "Feature matrix and labels",
     "Train four classifiers that stand in for the adversary: Random Forest (400 trees), Histogram Gradient Boosting (300 iterations), an MLP (256-128) and k-nearest neighbours (k = 3).",
     "Four fitted classifiers"],
    ["M6", "Evaluation", NAVY,
     "Policies crossed with models",
     "Score every cell with 5-fold stratified cross-validation: accuracy, macro precision, recall and F1, top-3 accuracy, plus the bandwidth overhead and added latency each defence imposes.",
     "results.json and results.csv"],
    ["M7", "Visualisation", NAVY,
     "Saved metrics",
     "Render the comparison, trade-off, confusion, distribution, fingerprint and parameter-sweep figures.",
     "Six publication-ready figures"]];

  const rh = 1.12;
  mods.forEach((m, i) => {
    const y = 1.50 + i * (rh + 0.18);
    card(s, M, y, CW, rh, WHITE, LINE);
    chip(s, M + 0.22, y + 0.16, 0.38, m[0], m[2]);
    s.addText(m[1], { x: M + 0.18, y: y + 0.58, w: 1.66, h: 0.42, fontFace: BODY, fontSize: 11,
      bold: true, color: NAVY, isTextBox: true, margin: 0, valign: "top" });

    const colX = [M + 1.95, M + 4.15, M + 10.15];
    const colW = [2.05, 5.85, 1.75];
    const labels = ["INPUT", "PROCESS", "OUTPUT"];
    [m[3], m[4], m[5]].forEach((txt, j) => {
      s.addText(labels[j], { x: colX[j], y: y + 0.10, w: colW[j], h: 0.22, fontFace: BODY,
        fontSize: 8.5, bold: true, color: j === 1 ? TEAL : MUTED, charSpacing: 0.6,
        isTextBox: true, margin: 0, valign: "middle" });
      s.addText(txt, { x: colX[j], y: y + 0.33, w: colW[j], h: 0.66, fontFace: BODY,
        fontSize: 10, color: INK, isTextBox: true, margin: 0, valign: "top" });
    });
  });
  footer(s, "Module Explanation  .  M4 to M7");
}

// =========================================================== 10 ALGORITHMS
{
  const s = newSlide(false);
  heading(s, "Algorithms", "One family attacks the traffic; one algorithm defends it");

  s.addText("Attack side   .   four classifiers", { x: M, y: 1.46, w: 6.0, h: 0.32,
    fontFace: HEAD, fontSize: 15, bold: true, color: NAVY, isTextBox: true, margin: 0, valign: "middle" });

  const clf = [
    ["Random Forest", "400 trees, sqrt features", "strongest attacker"],
    ["Gradient Boosting", "300 boosting iterations", "close second"],
    ["Multi-layer Perceptron", "dense 256 - 128", "stands in for a CNN"],
    ["k-Nearest Neighbours", "k = 3, distance weighted", "similarity baseline"]];
  clf.forEach((c, i) => {
    const y = 1.90 + i * 0.84;
    card(s, M, y, 6.0, 0.64, WHITE, LINE);
    dot(s, M + 0.22, y + 0.26, i === 0 ? RED : MUTED, 0.12);
    s.addText(c[0], { x: M + 0.5, y: y + 0.04, w: 2.6, h: 0.28, fontFace: BODY, fontSize: 12.5,
      bold: true, color: NAVY, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(c[1], { x: M + 0.5, y: y + 0.32, w: 2.8, h: 0.26, fontFace: BODY, fontSize: 10,
      color: MUTED, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(c[2], { x: M + 3.5, y: y, w: 2.3, h: 0.64, align: "right", fontFace: BODY,
      fontSize: 10.5, italic: true, color: i === 0 ? RED : MUTED, isTextBox: true,
      margin: 0, valign: "middle" });
  });

  const rx = M + 6.4;
  s.addText("Defence side   .   the proposed algorithm", { x: rx, y: 1.46, w: 5.7, h: 0.32,
    fontFace: HEAD, fontSize: 15, bold: true, color: NAVY, isTextBox: true, margin: 0, valign: "middle" });

  const steps = [
    ["Block-pad", "Round each query up to a multiple of 128 B and each response to a multiple of 468 B (RFC 8467)."],
    ["Count-normalise", "Add cover lookups, padded identically, until the exchange count reaches the next multiple of 32."],
    ["Delay-quantise", "Round each observed response delay up to a 50 ms grid and release queries on a 25 ms cadence."]];
  steps.forEach((st, i) => {
    const y = 1.90 + i * 1.26;
    card(s, rx, y, 5.71, 1.02, LIGHT, GREEN);
    chip(s, rx + 0.22, y + 0.18, 0.38, String(i + 1), GREEN);
    s.addText(st[0], { x: rx + 0.72, y: y + 0.14, w: 4.8, h: 0.3, fontFace: BODY, fontSize: 12.5,
      bold: true, color: NAVY, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(st[1], { x: rx + 0.72, y: y + 0.44, w: 4.82, h: 0.5, fontFace: BODY, fontSize: 10.5,
      color: INK, isTextBox: true, margin: 0, valign: "top" });
  });

  takeaway(s, "Why the attack works: an undefended page load produces an almost unique sequence of datagram lengths, so a handful of tree splits identify the site.", RED);
  footer(s, "Algorithm Identification and Explanation");
}

// ================================================================ 11 TOOLS
{
  const s = newSlide(false);
  heading(s, "Tools and Technologies", "Everything in the stack is open source and scripted");

  const groups = [
    ["Capture", TEAL, [["Python 3.11", "pipeline language"],
                       ["dnspython", "RFC 9250 DoQ client"],
                       ["aioquic", "QUIC transport"],
                       ["AdGuard DoQ", "public resolver, UDP/853"]]],
    ["Analysis", RED, [["NumPy", "feature arithmetic"],
                       ["pandas", "tabular handling"],
                       ["scikit-learn", "RF, GB, MLP, kNN"],
                       ["JSONL", "trace storage format"]]],
    ["Reporting", NAVY, [["Matplotlib", "all six figures"],
                         ["python-pptx", "deck generation"],
                         ["Wireshark / tshark", "planned wire validation"],
                         ["Git", "version control"]]]];

  groups.forEach((g, gi) => {
    const x = M + gi * (CW / 3 + 0.08), w = CW / 3 - 0.16;
    s.addText(g[0], { x: x + 0.04, y: 1.50, w: w, h: 0.34, fontFace: HEAD, fontSize: 15,
      bold: true, color: g[1], isTextBox: true, margin: 0, valign: "middle" });
    g[2].forEach((t, i) => {
      const y = 1.94 + i * 1.00;
      card(s, x, y, w, 0.82, WHITE, LINE);
      dot(s, x + 0.22, y + 0.35, g[1], 0.12);
      s.addText(t[0], { x: x + 0.5, y: y + 0.08, w: w - 0.66, h: 0.3, fontFace: BODY,
        fontSize: 12.5, bold: true, color: NAVY, isTextBox: true, margin: 0, valign: "middle" });
      s.addText(t[1], { x: x + 0.5, y: y + 0.38, w: w - 0.66, h: 0.28, fontFace: BODY,
        fontSize: 10, color: MUTED, isTextBox: true, margin: 0, valign: "middle" });
    });
  });
  footer(s, "Tools and Technologies");
}

// =================================================== 12 25% IMPLEMENTATION
{
  const s = newSlide(false);
  heading(s, "Implementation Status", "The Review-1 milestone, item by item");

  const done = [
    "Project environment and tools configured and pinned",
    "Dataset collected, organised and loaded   .   live traffic, not synthetic",
    "Initial preprocessing complete, with completeness filtering",
    "All seven modules developed and running end to end",
    "Preliminary testing complete; early results recorded and reproducible"];
  done.forEach((d, i) => {
    const y = 1.52 + i * 0.78;
    card(s, M, y, 8.1, 0.66, WHITE, LINE);
    s.addShape(pres.ShapeType.ellipse, { x: M + 0.2, y: y + 0.19, w: 0.28, h: 0.28,
      fill: { color: GREEN } });
    s.addText("OK", { x: M + 0.2, y: y + 0.19, w: 0.28, h: 0.28, align: "center",
      valign: "middle", fontFace: BODY, fontSize: 7.5, bold: true, color: WHITE,
      isTextBox: true, margin: 0 });
    s.addText(d, { x: M + 0.6, y: y, w: 7.4, h: 0.66, fontFace: BODY, fontSize: 12.5,
      color: INK, isTextBox: true, margin: 0, valign: "middle" });
  });

  const stats = [["400", "page-load traces"], ["10,240", "live DoQ queries"],
                 ["118", "features per trace"], ["20", "monitored websites"]];
  stats.forEach((st, i) => {
    const x = M + 8.4, y = 1.52 + i * 0.95;
    card(s, x, y, 3.67, 0.82, LIGHT, LINE);
    s.addText(st[0], { x: x + 0.22, y: y, w: 1.5, h: 0.82, fontFace: HEAD, fontSize: 21,
      bold: true, color: TEAL, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(st[1], { x: x + 1.74, y: y, w: 1.8, h: 0.82, align: "right", fontFace: BODY,
      fontSize: 11, color: MUTED, isTextBox: true, margin: 0, valign: "middle" });
  });

  takeaway(s, "One command reproduces everything on this deck:   python run_pipeline.py --capture 20", GREEN);
  footer(s, "25% Implementation Milestone");
}

// =============================================================== 13 DATASET
{
  const s = newSlide(false);
  heading(s, "The Dataset", "Measured from live traffic, not generated");

  const big = [["20", "websites"], ["400", "page loads"], ["10,240", "DoQ queries"], ["213 s", "capture time"]];
  big.forEach((b, i) => {
    const x = M + i * (CW / 4 + 0.03), w = CW / 4 - 0.09;
    card(s, x, 1.50, w, 1.06, LIGHT, LINE);
    s.addText(b[0], { x: x + 0.18, y: 1.58, w: w - 0.36, h: 0.56, fontFace: HEAD, fontSize: 26,
      bold: true, color: NAVY, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(b[1], { x: x + 0.18, y: 2.12, w: w - 0.36, h: 0.32, fontFace: BODY, fontSize: 11,
      color: MUTED, isTextBox: true, margin: 0, valign: "middle" });
  });

  s.addText("What was measured", { x: M, y: 2.76, w: 6.0, h: 0.32, fontFace: HEAD, fontSize: 15,
    bold: true, color: NAVY, isTextBox: true, margin: 0, valign: "middle" });
  const meas = [["Resolver", "dns.adguard-dns.com   .   RFC 9250, UDP/853"],
                ["Query message", "24 to 64 bytes   .   mean 35.5"],
                ["Response message", "42 to 395 bytes   .   mean 111.1"],
                ["Round-trip time", "mean 78.2 ms over a reused QUIC connection"]];
  meas.forEach((m, i) => {
    const y = 3.16 + i * 0.58;
    s.addText(m[0], { x: M + 0.04, y: y, w: 1.9, h: 0.5, fontFace: BODY, fontSize: 11.5,
      bold: true, color: TEAL, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(m[1], { x: M + 1.98, y: y, w: 4.1, h: 0.5, fontFace: BODY, fontSize: 11.5,
      color: INK, isTextBox: true, margin: 0, valign: "middle" });
  });

  card(s, M + 6.4, 2.76, 5.71, 2.62, LIGHT, TEAL);
  s.addText("How a page load is represented", { x: M + 6.66, y: 2.88, w: 5.2, h: 0.32,
    fontFace: HEAD, fontSize: 14, bold: true, color: NAVY, isTextBox: true, margin: 0, valign: "middle" });
  para(s, [
    "Each landing page is crawled for the hostnames it actually references, so the domain sets are measured rather than hand-written.",
    "Every hostname is then resolved for A and AAAA over one reused QUIC connection, the way a dual-stack stub resolver behaves.",
    "Visits are interleaved across sites so resolver cache state cannot act as a label."],
    { x: M + 6.66, y: 3.26, w: 5.2, h: 2.0, bullet: true, fontSize: 11.5 });

  takeaway(s, "Only the constant 31-byte QUIC framing term is modelled. Every DNS length and every round-trip time is measured.", TEAL);
  footer(s, "Dataset");
}

// ================================================== 14 RESULT: ATTACK/DEFENCE
{
  const s = newSlide(false);
  heading(s, "Result   .   How far each defence goes", "Four attackers against five padding policies, 5-fold cross-validated");
  s.addImage({ path: FIG("fig1_attack_vs_defence.png"), x: 2.17, y: 1.46, w: 9.0, h: 4.60 });
  takeaway(s, "Undefended DoQ is perfectly fingerprintable. RFC 8467 padding cuts the attack to 26.8% - still more than five times random guessing.", RED);
  footer(s, "Results  .  attack versus defence");
}

// ==================================================== 15 RESULT: TRADE-OFF
{
  const s = newSlide(false);
  heading(s, "Result   .   Privacy against cost", "What each defence buys, and what it charges for it");
  s.addImage({ path: FIG("fig2_tradeoff.png"), x: M, y: 1.88, w: 5.78, h: 3.65 });
  s.addImage({ path: FIG("fig6_sweep.png"), x: M + 6.05, y: 1.88, w: 6.00, h: 3.65 });
  takeaway(s, "Maximal padding costs three times more than RFC 8467 and performs no better. Message size is not the channel that is still leaking.", GOLD);
  footer(s, "Results  .  privacy and cost");
}

// =================================================== 16 RESULT: CONFUSION
{
  const s = newSlide(false);
  heading(s, "Result   .   What the defence does to the attacker", "Random Forest confusion, undefended versus defended");
  s.addImage({ path: FIG("fig3_confusion.png"), x: 1.45, y: 1.46, w: 10.43, h: 4.60 });
  takeaway(s, "A clean diagonal - every site identified - becomes diffuse noise once count and timing are shaped.", GREEN);
  footer(s, "Results  .  confusion matrices");
}

// ================================================ 17 RESULT: FINGERPRINTS
{
  const s = newSlide(false);
  heading(s, "Result   .   The fingerprints themselves", "Mean cumulative traffic profile, one line per website");
  s.addImage({ path: FIG("fig5_fingerprints.png"), x: 1.17, y: 1.60, w: 11.0, h: 4.40 });
  takeaway(s, "Twenty separable traffic profiles collapse onto a single indistinguishable curve.", GREEN);
  footer(s, "Results  .  traffic profiles");
}

// ========================================================= 18 KEY FINDINGS
{
  const s = newSlide(true);
  heading(s, "Key Findings", "Five results from 10,240 live DoQ queries", true);

  const finds = [
    ["Undefended DoQ leaks completely", "100% accuracy across 20 websites - the traffic profile is effectively a lookup key.", RED],
    ["RFC 8467 padding is not enough", "26.8% accuracy, still 5.4 times random guessing, for 215% bandwidth overhead.", GOLD],
    ["More padding does not help", "Maximal padding costs 663% overhead and scores 27.8% - no better than RFC 8467.", GOLD],
    ["The residual leak is count and timing", "Exchange count alone gives 25%; every surviving length feature merely re-encodes it. Timing alone gives 18.7%.", TEAL],
    ["Closing both nearly closes the attack", "7.8% accuracy against a 5% random-guess floor, at 330% bandwidth and 13 ms added latency.", GREEN]];

  finds.forEach((f, i) => {
    const y = 1.52 + i * 0.97;
    card(s, M, y, CW, 0.86, "1A2C4B", "24405F");
    chip(s, M + 0.24, y + 0.22, 0.42, String(i + 1), f[2]);
    s.addText(f[0], { x: M + 0.82, y: y + 0.10, w: 4.9, h: 0.34, fontFace: BODY, fontSize: 13.5,
      bold: true, color: WHITE, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(f[1], { x: M + 0.82, y: y + 0.44, w: 10.9, h: 0.34, fontFace: BODY, fontSize: 11,
      color: ICE, isTextBox: true, margin: 0, valign: "middle" });
  });
  footer(s, "Key Findings", true);
}

// ================================================ 19 LIMITATIONS AND NEXT
{
  const s = newSlide(false);
  heading(s, "Limitations and Next Phase", "What this result does not yet show, and what comes before Review 2");

  card(s, M, 1.52, CW / 2 - 0.16, 3.46, WHITE, RED);
  dot(s, M + 0.3, 1.84, RED, 0.14);
  s.addText("Limitations we accept today", { x: M + 0.56, y: 1.70, w: 5.4, h: 0.38,
    fontFace: HEAD, fontSize: 15, bold: true, color: NAVY, isTextBox: true, margin: 0, valign: "middle" });
  para(s, [
    "Closed world of 20 sites. The resolver cache makes undefended traces near-deterministic, so 100% is an upper bound rather than a field estimate.",
    "Traces come from a stub resolver replaying measured domain sets, not from a real browser page load.",
    "QUIC framing is modelled as a constant 31 bytes per datagram; this is not yet checked against a packet capture.",
    "A single resolver and a single network vantage point."],
    { x: M + 0.34, y: 2.14, w: 5.35, h: 2.7, bullet: true, fontSize: 11.5 });

  const rx = M + CW / 2 + 0.16;
  card(s, rx, 1.52, CW / 2 - 0.16, 3.46, LIGHT, GREEN);
  dot(s, rx + 0.3, 1.84, GREEN, 0.14);
  s.addText("Planned before Review 2", { x: rx + 0.56, y: 1.70, w: 5.4, h: 0.38,
    fontFace: HEAD, fontSize: 15, bold: true, color: NAVY, isTextBox: true, margin: 0, valign: "middle" });
  para(s, [
    "Validate the framing model against tshark captures of the same traffic.",
    "Drive capture from a real browser and widen to an open-world setting.",
    "Add a 1-D CNN over the raw observed size sequence, replacing the MLP stand-in.",
    "Test generalisation across resolvers and across networks.",
    "Write up the count-and-timing finding for submission."],
    { x: rx + 0.34, y: 2.14, w: 5.35, h: 2.7, bullet: true, fontSize: 11.5 });

  takeaway(s, "The headline number is honest about its ceiling: the finding that matters is which channel leaks, and that holds regardless.", TEAL);
  footer(s, "Limitations and Next Phase");
}

// ============================================================ 20 REFERENCES
{
  const s = newSlide(false);
  heading(s, "References", "Standards and prior work this project builds on");

  const refs = [
    ["RFC 9250", "C. Huitema, S. Dickinson, A. Mankin. DNS over Dedicated QUIC Connections. IETF, May 2022."],
    ["RFC 8467", "A. Mayrhofer. Padding Policies for Extension Mechanisms for DNS (EDNS(0)). IETF, October 2018."],
    ["NDSS 2020", "S. Siby, M. Juarez, C. Diaz, N. Vallina-Rodriguez, C. Troncoso. Encrypted DNS Privacy? A Traffic Analysis Perspective."],
    ["PAM 2022", "M. Kosek, T. V. Doan, S. Granderath, V. Bajpai. One to Rule Them All? A First Look at DNS over QUIC."],
    ["NDSS 2016", "A. Panchenko et al. Website Fingerprinting at Internet Scale."]];

  refs.forEach((r, i) => {
    const y = 1.56 + i * 0.86;
    card(s, M, y, CW, 0.74, i % 2 === 0 ? WHITE : LIGHT, LINE);
    s.addText(r[0], { x: M + 0.24, y: y, w: 1.5, h: 0.74, fontFace: BODY, fontSize: 12,
      bold: true, color: TEAL, isTextBox: true, margin: 0, valign: "middle" });
    s.addText(r[1], { x: M + 1.8, y: y, w: CW - 2.1, h: 0.74, fontFace: BODY, fontSize: 11.5,
      color: INK, isTextBox: true, margin: 0, valign: "middle" });
  });

  s.addText("Code, captured dataset and every figure on this deck are reproducible from the project repository.",
    { x: M, y: SH - 1.06, w: CW, h: 0.4, fontFace: BODY, fontSize: 11.5, italic: true,
      color: MUTED, isTextBox: true, margin: 0, valign: "middle" });
  footer(s, "References");
}

const out = path.join(__dirname, "presentation", "Review1_WF_DoQ.pptx");
pres.writeFile({ fileName: out }).then(() => console.log("written: " + out));
