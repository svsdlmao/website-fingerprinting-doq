// Project report generator - follows the BCSE308L project report template.
// Run twice: the first pass lays the document out, find_pages.py reads the
// real page numbers back from Word, and the second pass fills them into the
// table of contents and the lists of figures and tables.
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType, Footer,
  PageNumber, NumberFormat, LevelFormat, VerticalAlign, TableLayoutType,
} = require("docx");

const ROOT = path.join(__dirname, "..");
const ASSET = (f) => path.join(__dirname, "assets", f);
const FIG = (f) => path.join(ROOT, "results", "figures", f);
const PAGES = fs.existsSync(path.join(__dirname, "pages.json"))
  ? JSON.parse(fs.readFileSync(path.join(__dirname, "pages.json"), "utf-8")) : {};

const FONT = "Times New Roman";
const CONTENT_W = 8896;            // A4 width minus template margins, in DXA
const LINE = 276;                  // 1.15 line spacing

// --------------------------------------------------------------- registry
const tocEntries = [];   // {key, num, text, level, search}
const figures = [];      // {key, num, title}
const tables = [];       // {key, num, title}
let numInstance = 0;

// --------------------------------------------------------------- text helpers
function runs(text, base) {
  // **bold** and _italic_ inline markup
  const out = [];
  const re = /(\*\*[^*]+\*\*|_[^_]+_)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    const tok = m[0];
    if (tok.startsWith("**")) out.push(new TextRun({ text: tok.slice(2, -2), bold: true, ...base }));
    else out.push(new TextRun({ text: tok.slice(1, -1), italics: true, ...base }));
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out;
}

const P = (text, o = {}) => new Paragraph({
  alignment: o.align || AlignmentType.JUSTIFIED,
  spacing: { line: LINE, after: o.after === undefined ? 140 : o.after, before: o.before || 0 },
  indent: o.indent,
  keepNext: o.keepNext,
  pageBreakBefore: o.pageBreak,
  children: runs(text, { font: FONT, size: o.size || 24, bold: o.bold, color: o.color }),
});

const C = (text, size, bold, o = {}) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { line: o.line || LINE, after: o.after === undefined ? 120 : o.after, before: o.before || 0 },
  pageBreakBefore: o.pageBreak,
  children: [new TextRun({ text, font: FONT, size: size * 2, bold })],
});

const blank = (n = 1) => Array.from({ length: n }, () =>
  new Paragraph({ spacing: { after: 0, line: LINE }, children: [new TextRun({ text: "", font: FONT })] }));

function bullets(items) {
  return items.map((t) => new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: LINE, after: 80 },
    children: runs(t, { font: FONT, size: 24 }),
  }));
}

function numbered(items) {
  numInstance += 1;
  const inst = numInstance;
  return items.map((t) => new Paragraph({
    numbering: { reference: "numbers", level: 0, instance: inst },
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: LINE, after: 80 },
    children: runs(t, { font: FONT, size: 24 }),
  }));
}

// --------------------------------------------------------------- headings
function chapter(n, title, key) {
  tocEntries.push({ key, num: n + ".", text: title, level: 0, search: "CHAPTER " + n });
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, pageBreakBefore: true,
      spacing: { after: 120 }, children: [new TextRun({ text: "CHAPTER " + n, font: FONT, size: 32, bold: true })] }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER,
      spacing: { after: 360 }, children: [new TextRun({ text: title, font: FONT, size: 32, bold: true })] }),
  ];
}
function section(num, title, key) {
  tocEntries.push({ key, num: "", text: num + " " + title, level: 1, search: num + " " + title });
  return new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true,
    spacing: { before: 240, after: 140 },
    children: [new TextRun({ text: num + " " + title, font: FONT, size: 28, bold: true })] });
}
function subsection(num, title, key) {
  tocEntries.push({ key, num: "", text: num + " " + title, level: 2, search: num + " " + title });
  return new Paragraph({ heading: HeadingLevel.HEADING_3, keepNext: true,
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text: num + " " + title, font: FONT, size: 24, bold: true })] });
}
function minor(title) {   // run-in heading inside a section, not listed in the TOC
  return new Paragraph({ keepNext: true, spacing: { before: 160, after: 80 },
    children: [new TextRun({ text: title, font: FONT, size: 24, bold: true })] });
}

// --------------------------------------------------------------- figures & tables
function pngSize(file) {
  const b = fs.readFileSync(file);
  if (b[0] === 0x89) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  throw new Error("not a png: " + file);
}
function figure(file, num, title, widthPx = 580) {
  const [w, h] = pngSize(file);
  figures.push({ key: "fig" + num, num, title });
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 160, after: 60 },
      children: [new ImageRun({ type: "png", data: fs.readFileSync(file),
        transformation: { width: widthPx, height: Math.round(widthPx * h / w) },
        altText: { title: "Figure " + num, description: title, name: "fig" + num } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
      children: [new TextRun({ text: "Figure " + num + ": ", font: FONT, size: 20, bold: true }),
                 new TextRun({ text: title, font: FONT, size: 20 })] }),
  ];
}

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: "808080" };
const BORDERS = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
const NOB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NOBORDERS = { top: NOB, bottom: NOB, left: NOB, right: NOB, insideHorizontal: NOB, insideVertical: NOB };

function cell(text, width, o = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: o.noBorder ? { top: NOB, bottom: NOB, left: NOB, right: NOB } : BORDERS,
    shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: (Array.isArray(text) ? text : [text]).map((t) => new Paragraph({
      alignment: o.align || AlignmentType.LEFT, spacing: { after: 0, line: 252 }, keepNext: o.keepNext,
      children: runs(String(t), { font: FONT, size: o.size || 21, bold: o.bold }) })),
  });
}

function table(num, title, headers, rows, widths, o = {}) {
  tables.push({ key: "tab" + num, num, title });
  const total = widths.reduce((a, b) => a + b, 0);
  const aligns = o.aligns || widths.map(() => AlignmentType.LEFT);
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 200, after: 100 },
      children: [new TextRun({ text: "Table " + num + ": ", font: FONT, size: 20, bold: true }),
                 new TextRun({ text: title, font: FONT, size: 20 })] }),
    new Table({
      width: { size: total, type: WidthType.DXA }, columnWidths: widths,
      layout: TableLayoutType.FIXED, alignment: AlignmentType.CENTER,
      rows: [
        new TableRow({ tableHeader: true, cantSplit: true,
          children: headers.map((h, i) => cell(h, widths[i], { bold: true, fill: "E7E9EC", align: aligns[i], keepNext: true })) }),
        ...rows.map((r, ri) => new TableRow({ cantSplit: true,
          children: r.map((v, i) => cell(v, widths[i], { align: aligns[i], bold: o.boldRow && o.boldRow(r),
            keepNext: ri < rows.length - 1 })) })),
      ],
    }),
    new Paragraph({ spacing: { after: 200 }, children: [] }),
  ];
}

function codeBlock(lines, size = 16) {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [CONTENT_W],
    layout: TableLayoutType.FIXED,
    rows: [new TableRow({ children: [new TableCell({
      width: { size: CONTENT_W, type: WidthType.DXA }, borders: BORDERS,
      shading: { fill: "F4F5F7", type: ShadingType.CLEAR, color: "auto" },
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      children: lines.map((l) => new Paragraph({ spacing: { after: 0, line: 240 },
        children: [new TextRun({ text: l.length ? l : " ", font: "Courier New", size })] })),
    })] })],
  });
}

// ===================================================================== COVER
const TITLE = "Website Fingerprinting over DNS-over-QUIC: Evaluating the Limits of Padding Defences";
const STUDENTS = [["23BDS0145", "ANANT AGARWAL"], ["24BAI0107", "ARYAMAN TRIPATHI"],
                  ["24BCE0416", "SHAURYAVEER SINGH DABAS"]];

const cover = [
  ...blank(1),
  C("BCSE308L – Course Project", 18, true, { after: 360 }),
  C("Website Fingerprinting over DNS-over-QUIC:", 18, true, { after: 0 }),
  C("Evaluating the Limits of Padding Defences", 18, true, { after: 480 }),
  C("Submitted in partial fulfillment of the requirements for the Course in", 14, false, { after: 240 }),
  C("Bachelor of Technology", 19, true, { after: 60 }),
  C("in", 19, false, { after: 60 }),
  C("Computer Science and Engineering", 19, true, { after: 300 }),
  C("by", 14, false, { after: 200 }),
  new Table({
    width: { size: 7000, type: WidthType.DXA }, columnWidths: [2200, 4800],
    alignment: AlignmentType.CENTER, borders: NOBORDERS,
    rows: STUDENTS.map(([reg, name]) => new TableRow({ children: [
      cell(reg, 2200, { noBorder: true, size: 28, align: AlignmentType.LEFT }),
      cell(name, 4800, { noBorder: true, size: 28, bold: true }),
    ] })),
  }),
  ...blank(1),
  C("Under the Supervision of", 14, true, { after: 160, before: 120 }),
  C("DR. YOGANAND S.", 14, true, { after: 40 }),
  C("Assistant Professor Senior Grade-2", 13, false, { after: 40 }),
  C("Centre for Artificial Intelligence and Research (CFAIR)", 13, false, { after: 360 }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [
    new ImageRun({ type: "jpg", data: fs.readFileSync(ASSET("image1.jpeg")),
      transformation: { width: 260, height: 72 },
      altText: { title: "VIT logo", description: "Vellore Institute of Technology", name: "logo" } })] }),
  C("October 2026", 13, false),
];

// ============================================================== DECLARATION
function sigBlock(labels) {
  const w = Math.floor(CONTENT_W / labels.length);
  return new Table({
    width: { size: w * labels.length, type: WidthType.DXA }, columnWidths: labels.map(() => w),
    borders: NOBORDERS,
    rows: [new TableRow({ children: labels.map((lines) => new TableCell({
      width: { size: w, type: WidthType.DXA }, borders: { top: NOB, bottom: NOB, left: NOB, right: NOB },
      children: [
        ...blank(3),
        new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: "______________________", font: FONT, size: 24 })] }),
        ...lines.map((l, i) => new Paragraph({ spacing: { after: 20 },
          children: [new TextRun({ text: l, font: FONT, size: i === 0 ? 24 : 22, bold: i === 0 })] })),
      ],
    })) })],
  });
}

const placeDate = (withDate = true) => [
  new Paragraph({ spacing: { after: 60, line: LINE }, children: [new TextRun({ text: "Place\t: Vellore", font: FONT, size: 24 })] }),
  new Paragraph({ spacing: { after: 60, line: LINE }, children: [new TextRun({ text: "Date\t: ____________", font: FONT, size: 24 })] }),
];

const declaration = [
  C("DECLARATION", 14, true, { pageBreak: true, after: 480 }),
  new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { line: 360, after: 200 }, children: [
    new TextRun({ text: "We hereby declare that the project entitled ", font: FONT, size: 24 }),
    new TextRun({ text: "“" + TITLE + "”", font: FONT, size: 24, bold: true }),
    new TextRun({ text: " submitted by us, for the award of the course BCSE308L in Computer Science and Engineering to VIT, is a record of bonafide work carried out by us under the supervision of Dr. Yoganand S.", font: FONT, size: 24 }),
  ] }),
  new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { line: 360, after: 480 }, children: [
    new TextRun({ text: "We further declare that the work reported in this project has not been submitted and will not be submitted, either in part or in full, for the award of any other courses in this institute or any other institute or university.", font: FONT, size: 24 }),
  ] }),
  ...placeDate(),
  ...blank(1),
  new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: "Signature of the Candidates", font: FONT, size: 24, bold: true })] }),
  sigBlock([["Anant Agarwal", "23BDS0145"], ["Aryaman Tripathi", "24BAI0107"], ["Shauryaveer Singh Dabas", "24BCE0416"]]),
];

// ============================================================== CERTIFICATE
const certificate = [
  C("CERTIFICATE", 14, true, { pageBreak: true, after: 480 }),
  new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { line: 360, after: 200 }, children: [
    new TextRun({ text: "This is to certify that the project entitled ", font: FONT, size: 24 }),
    new TextRun({ text: "“" + TITLE + "”", font: FONT, size: 24, bold: true }),
    new TextRun({ text: " submitted by ", font: FONT, size: 24 }),
    new TextRun({ text: "Anant Agarwal (23BDS0145), Aryaman Tripathi (24BAI0107) and Shauryaveer Singh Dabas (24BCE0416)", font: FONT, size: 24, bold: true }),
    new TextRun({ text: ", School of Computer Science and Engineering, VIT, for the award of the degree of Bachelor of Technology in Computer Science and Engineering, is a record of bonafide work carried out by them under my supervision during Fall Semester 2026–2027, as per the VIT code of academic and research ethics.", font: FONT, size: 24 }),
  ] }),
  new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { line: 360, after: 480 }, children: [
    new TextRun({ text: "The contents of this report have not been submitted and will not be submitted either in part or in full, for the award of any other courses in this institute or any other institute or university. The project fulfills the requirements and regulations of the University and in my opinion meets the necessary standards for submission.", font: FONT, size: 24 }),
  ] }),
  ...placeDate(),
  sigBlock([["Signature of the Guide", "Dr. Yoganand S"], ["Signature of the Examiner(s)", ""]]),
];

// ========================================================= ACKNOWLEDGEMENTS
const ack = [
  C("ACKNOWLEDGEMENTS", 14, true, { pageBreak: true, after: 480 }),
  P("We thank the management of Vellore Institute of Technology for the opportunity to take on this project and for the facilities we used while working on it."),
  P("Our thanks go to Dr. Jaisankar N, Dean of the School of Computer Science and Engineering (SCOPE), and to the Heads of our respective departments for their support during the semester."),
  P("We are particularly grateful to our guide, Dr. Yoganand S. The review structure he set for the course, which asked for a working prototype with measured results by the first review rather than a plan, shaped how we approached the whole project. It is the reason we built the measurement pipeline first and wrote about it afterwards."),
  P("We also owe thanks to AdGuard for running the public DNS-over-QUIC resolver that every measurement in this report was taken against, and to the people who maintain dnspython, aioquic and scikit-learn, without which the project would have taken far longer."),
  P("Finally, thank you to our families and friends for their patience over the past few months."),
  ...blank(2),
  new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 40 }, children: [new TextRun({ text: "Anant Agarwal", font: FONT, size: 24, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 40 }, children: [new TextRun({ text: "Aryaman Tripathi", font: FONT, size: 24, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 40 }, children: [new TextRun({ text: "Shauryaveer Singh Dabas", font: FONT, size: 24, bold: true })] }),
];

// ================================================================ CHAPTERS
// (built before the TOC so that the registries are populated)
const body = [];
const add = (...xs) => xs.forEach((x) => Array.isArray(x) ? body.push(...x) : body.push(x));

// ------------------------------------------------------------- chapter 1
add(chapter(1, "INTRODUCTION", "ch1"));
add(section("1.1", "Background", "s1.1"));
add(P("Almost everything a person does on the web begins with a DNS lookup. Before a browser can fetch a page from bbc.com it has to translate that name into an IP address, and it has to do the same for every other server the page pulls images, scripts, fonts and adverts from. For most of the Internet’s history these lookups were sent in plain text over UDP port 53 [1]. Anyone sitting on the path between a user and their resolver, whether a café’s Wi-Fi operator, an Internet service provider or an employer, could read the full list of names that user looked up."));
add(P("Over the last ten years the IETF has standardised three ways of encrypting this traffic. DNS over TLS (DoT) [2] wraps DNS messages in a TLS session on port 853. DNS over HTTPS (DoH) [3] carries them inside ordinary HTTPS requests. DNS over QUIC (DoQ) [4], the most recent, sends each query on its own stream of a QUIC connection [5] over UDP port 853. QUIC sets up connections faster and avoids one slow query holding up the others behind it, which makes DoQ attractive to resolver operators, and several public resolvers now offer it."));
add(P("All three protocols encrypt the content of DNS messages. None of them, on its own, hides how long each message is, how many messages are sent, or when they are sent. The IETF noticed the first of these problems early: RFC 7830 [6] added a padding option to EDNS(0), and RFC 8467 [7] recommends padding queries to a multiple of 128 bytes and responses to a multiple of 468 bytes. Neither document says anything about the number or the timing of messages."));
add(section("1.2", "Motivations", "s1.2"));
add(P("The risk is not theoretical. Website fingerprinting, which means working out which page someone visited from the shape of their encrypted traffic, has been studied for over a decade against Tor and HTTPS [8]–[12], and more recent work has shown that encrypted DNS can be attacked in the same way [13], [14]. A page load produces a short burst of lookups. The sizes, the number and the spacing of those lookups differ from one site to the next, and that burst can act as a signature for the site."));
add(P("DoQ is newer than DoT and DoH, and because it runs over QUIC the traffic an observer sees is different again. We wanted to answer three questions about it: how much it leaks in practice, how much the standard padding policy helps, and what an effective defence would cost. We also wanted the answers to come from real traffic. Much of the related work uses simulated traces or a resolver running in a lab, and we thought it was worth checking whether the effect holds against a DoQ service that people actually use."));
add(section("1.3", "Scope of the Project", "s1.3"));
add(P("The project covers the following:", { after: 80 }));
add(bullets([
  "DNS traffic only. We do not look at the HTTPS connections that follow the lookups.",
  "A passive attacker on the network path, who can see the encrypted DoQ datagrams between a client and its resolver but cannot decrypt, change or delay them.",
  "A closed world of 100 websites, where the attacker knows the user visited one of these sites and has to say which one, and an open world, where the user may also visit any of 225 background websites the attacker has never trained on.",
  "Two ways of producing page loads: the hostnames a page\u2019s HTML refers to, and the hostnames a real browser actually resolved while loading it.",
  "Five padding policies, ranging from no padding to the defence proposed in this report, all compared on the same captured traces.",
]));
add(P("One thing is outside the scope of this report: deploying the defence inside a working DoQ client. The defences are applied to captured traffic, for the reasons given in Section 4.1, and deployment is discussed as future work in Chapter 8.", { before: 80 }));

// ------------------------------------------------------------- chapter 2
add(chapter(2, "PROJECT DESCRIPTION AND GOALS", "ch2"));
add(section("2.1", "Literature Review", "s2.1"));
add(minor("Fingerprinting encrypted tunnels"));
add(P("Cai et al. [8] showed in 2012 that the sequence of packet sizes in encrypted Tor and SSH traffic was enough to identify web pages, and that several padding-based defences of the time did not stop the attack. Panchenko et al. [9] later proposed CUMUL, which summarises a trace as the running total of its packet sizes and classifies it with a support vector machine, and evaluated it at a much larger scale than earlier work. Hayes and Danezis [10] used a Random Forest over a broad set of hand-picked features, an approach they called k-fingerprinting, and showed it held up well across different settings. Sirinam et al. [12] dropped hand-picked features altogether and trained a convolutional neural network on the raw sequence of packet directions, reaching very high accuracy against undefended Tor traffic."));
add(minor("Defences"));
add(P("Most defences add dummy packets, delay real ones, or do both. WTF-PAD [11] adds cover traffic only where a trace has unusually long gaps, which keeps its latency cost low, but the deep-learning attack in [12] was later shown to get past it to a large extent. One point comes up again and again in this literature: a defence that only changes packet sizes leaves other features, such as burst structure and timing, available to the attacker."));
add(minor("Encrypted DNS"));
add(P("Siby et al. [13] applied the attack to DNS over HTTPS. Using n-grams of TLS record sizes they identified websites from DoH traffic with high accuracy, and found that the EDNS(0) padding strategies in use at the time reduced the leak without removing it. Bushart and Rossow [14] studied DoT and DoH with RFC 8467 padding switched on and reached the conclusion in their title, that padding is not enough: the number and timing of DNS messages still identified many websites. Kosek et al. [15] gave the first measurement study of DoQ, looking at how widely it is deployed and how it performs against DoT and DoH, but they did not look at privacy. Table 2.1 summarises these works."));
add(table("2.1", "Summary of related work", ["Paper", "Method", "Limitation for this project"], [
  ["Cai et al., 2012 [8]", "Packet-size sequences from Tor and SSH, compared with an edit-distance measure", "Not DNS traffic; small closed world"],
  ["Panchenko et al., 2016 [9]", "CUMUL cumulative-size features with an SVM", "Tor and HTTPS, not DNS"],
  ["Hayes and Danezis, 2016 [10]", "Random Forest over hand-picked traffic features", "Tor only; no encrypted-DNS evaluation"],
  ["Juarez et al., 2016 [11]", "WTF-PAD adaptive cover traffic", "Later largely defeated by deep-learning attacks [12]"],
  ["Sirinam et al., 2018 [12]", "Convolutional network over packet direction sequences", "Tor only; needs large training sets"],
  ["Siby et al., 2020 [13]", "n-grams of TLS record sizes in DoH", "DoH only; channels not separated"],
  ["Bushart and Rossow, 2020 [14]", "Attack on DoT and DoH with RFC 8467 padding", "DoT and DoH, not DoQ"],
  ["Kosek et al., 2022 [15]", "Measurement of DoQ deployment and performance", "No privacy or padding analysis"],
], [2300, 3500, 3096]));
add(section("2.2", "Research Gap", "s2.2"));
add(P("Taken together, this work establishes that encrypted traffic can be fingerprinted, and that for DoT and DoH, padding message sizes is not enough on its own to stop it. When we started, three questions were still open for DoQ:", { after: 80 }));
add(numbered([
  "How much does DoQ leak when it is measured against a production resolver rather than in simulation? We could not find a public dataset of DoQ page-load traces.",
  "Once RFC 8467 padding is applied, how much of what is left comes from the number of messages and how much from their timing? Earlier work reports that padding falls short, but we did not find a breakdown that scores each channel on its own.",
  "What does it cost to close the channels that remain? A defence is only useful if the extra bandwidth and delay are acceptable, so accuracy and cost need to be reported side by side.",
]));
add(P("This project addresses all three for DoQ.", { before: 80 }));
add(section("2.3", "Objectives", "s2.3"));
add(P("**Primary objective:** to measure how much website-identifying information survives EDNS(0) padding on DNS-over-QUIC, and to design and cost a defence for whatever remains.", { after: 100 }));
add(P("**Secondary objectives:**", { after: 80 }));
add(numbered([
  "Build a pipeline that captures live DoQ traffic for a set of websites, without any synthetic traces, and that gives the same numbers every time it is run.",
  "Measure attacker accuracy with no padding, with RFC 8467 padding and with maximal fixed-length padding.",
  "Split the leak that remains after padding into its channels (size, count and timing) and measure each one separately.",
  "Propose a defence aimed at the channels that still leak, tune its parameters, and report its accuracy together with its bandwidth and latency cost.",
  "Check that the conclusions still hold when the number of websites is increased, in an open world, and on lookup sequences recorded from a real browser.",
]));
add(section("2.4", "Problem Statement", "s2.4"));
add(P("DoQ encrypts DNS messages but leaves their length, number and timing visible to anyone watching the network. Because each website triggers its own characteristic set of lookups, these three observables can reveal which site a user visited. RFC 8467 padding hides message length but does nothing about count or timing. It is not known how much protection RFC 8467 actually gives on DoQ, which channels still leak once it is applied, or what it would cost to close them. This project sets out to measure that leftover leak on live DoQ traffic, and to find a defence that brings it close to chance at a cost that is acceptable."));
add(section("2.5", "Project Plan", "s2.5"));
add(P("The work was spread over the semester as shown in Figure 2.1, with the three reviews as fixed points. The capture pipeline and a first set of results on 20 websites were ready for Review 1. The weeks between Review 1 and Review 2 went into the channel ablation, the parameter sweep and scaling the closed world up to 100 websites. Work planned for after this report is shown in grey."));
add(figure(ASSET("fig_timeline.png"), "2.1", "Project timeline across the semester"));

// ------------------------------------------------------------- chapter 3
add(chapter(3, "TECHNICAL SPECIFICATION", "ch3"));
add(section("3.1", "Requirements", "s3.1"));
add(minor("Functional requirements"));
add(bullets([
  "**FR1.** For any given website, find the set of hostnames its landing page refers to.",
  "**FR2.** Resolve those hostnames over a real RFC 9250 DoQ connection and record, for every exchange, the query and response lengths, the round-trip time and the time since the start of the page load.",
  "**FR3.** Discard incomplete page loads and label the remaining ones by website.",
  "**FR4.** Apply each padding policy to a captured page load and output the trace an attacker would see under that policy, along with the bandwidth and latency it costs.",
  "**FR5.** Extract features using only message direction, length and timing. Hostnames and record contents must never reach the classifier.",
  "**FR6.** Train and evaluate several classifiers with cross-validation and report accuracy, precision, recall, F1 score and top-3 accuracy.",
  "**FR7.** Save figures and machine-readable result files.",
]));
add(minor("Non-functional requirements"));
add(bullets([
  "**Reproducibility.** Running the pipeline twice on the same data must give exactly the same numbers.",
  "**Fair comparison.** Every policy must be evaluated on the same captured traces.",
  "**Light load on the resolver.** Queries are sent one after another on each connection, with only a few connections open at once.",
  "**Ordinary hardware.** Everything must run on a laptop, with no GPU and no special network equipment.",
]));
add(section("3.2", "Feasibility Study", "s3.2"));
add(P("**Technical feasibility.** The dnspython library includes a DoQ client built on aioquic. Our first test query to AdGuard’s public resolver (94.140.14.14, UDP port 853) came back in about half a second on a fresh connection, so capturing live traffic was practical from the start. A full capture of 100 websites with fifteen visits each took 956 seconds using six QUIC connections in parallel, and the complete evaluation takes about 17 minutes on the laptop described in Table 3.1."));
add(P("**Economic feasibility.** Every tool we used is free and open source, and the resolver is a free public service. The project needed no paid infrastructure of any kind."));
add(P("**Operational and ethical feasibility.** We only measure lookups that we generate ourselves; no other person’s traffic is captured or analysed. The queries go to a public resolver whose purpose is to answer them, at a modest rate of about 41 queries per second spread over six connections. Each website’s landing page was fetched once to build its hostname list, and sites that refused the request were left out rather than retried."));
add(section("3.3", "System Specification", "s3.3"));
add(subsection("3.3.1", "Hardware Specification", "s3.3.1"));
add(P("All development, capture and evaluation ran on a single laptop (Table 3.1). No GPU was needed: every model trains on the CPU in seconds or minutes. The one network requirement is that outbound UDP traffic on port 853 is allowed, which is not always true on institutional networks."));
add(table("3.1", "Hardware used", ["Component", "Specification"], [
  ["Processor", "13th Gen Intel Core i7-13620H (10 cores, 16 threads)"],
  ["Memory", "16 GB RAM"],
  ["Storage", "512 GB NVMe SSD"],
  ["Operating system", "Windows 11 Home"],
  ["Network", "Home broadband with outbound UDP port 853 open"],
], [2600, 6296]));
add(subsection("3.3.2", "Software Specification", "s3.3.2"));
add(table("3.2", "Software used", ["Component", "Version", "Purpose"], [
  ["Python", "3.11.9", "Language for the whole pipeline"],
  ["dnspython", "2.8.0", "RFC 9250 DoQ client"],
  ["aioquic", "1.3.0", "QUIC transport used by dnspython"],
  ["scikit-learn", "1.8.0", "Classifiers and cross-validation"],
  ["NumPy", "2.2.5", "Feature computation"],
  ["pandas", "3.0.1", "Tabular data handling"],
  ["PyTorch", "2.11.0 (CPU)", "1-D convolutional attacker"],
  ["Google Chrome", "155.0", "Headless page loads for browser-driven capture"],
  ["Matplotlib", "3.10.8", "Figures"],
  ["Git and GitHub", "2.48", "Version control and code hosting"],
  ["AdGuard DNS", "dns.adguard-dns.com", "Public DoQ resolver used for every measurement"],
], [2300, 2300, 4296]));

// ------------------------------------------------------------- chapter 4
add(chapter(4, "DESIGN APPROACH AND DETAILS", "ch4"));
add(section("4.1", "System Architecture", "s4.1"));
add(P("Figure 4.1 shows the overall design. It is a straight pipeline of seven modules. Live traffic enters at the top left, and metrics and figures come out at the bottom left."));
add(figure(ASSET("fig_architecture.png"), "4.1", "System architecture"));
add(P("The most important design decision is where the defence layer sits. It comes after capture and preprocessing, but before feature extraction. We capture each page load once, without any padding, and then each defence rewrites a copy of that page load into what an attacker would observe if the defence had been running. Every policy is therefore scored against exactly the same underlying traffic. If we had captured traffic separately for each policy instead, normal variation in network conditions between capture runs would have been mixed in with the effect of the defence, and the comparison would have been much less clean."));
add(P("Each page load is stored as one line of JSON. It holds the website name, the visit number, the resolver used and an ordered list of exchanges. For each exchange we record the hostname and record type, which are kept only for our own analysis; the length in bytes of the query and of the response; the round-trip time in milliseconds; and the time since the start of the page load."));
add(section("4.2", "Attacker Model", "s4.2"));
add(P("The attacker sits somewhere on the path between the client and the resolver and records the UDP datagrams that pass. Because DoQ is encrypted, there are only three things the attacker can see about each datagram: which direction it is going, how long it is, and when it arrives. Hostnames, record contents and response codes are never given to the classifier, even though the capture stores them."));
add(P("For lengths, we need to know what actually appears on the wire. RFC 9250 sends each DNS message with a 2-byte length prefix [4], inside a QUIC STREAM frame, inside a QUIC short-header packet. We model the length the attacker sees as the DNS message length plus 33 bytes: 2 for the length prefix, and 31 for the QUIC framing (a 1-byte header, an 8-byte connection ID, a 2-byte packet number, a 4-byte STREAM frame header and a 16-byte authentication tag). This constant is the only value in the pipeline that is modelled rather than measured. Every DNS length and every timing value comes from the live resolver. Section 7.8 checks the constant against real datagrams and finds it close but not exact."));
add(section("4.3", "Defence Design", "s4.3"));
add(P("The five policies we compare form a ladder. Each one adds a layer to the one before it, so that the difference in accuracy between two neighbouring policies can be pinned on one specific change. Table 4.1 summarises them."));
add(table("4.1", "The padding policies compared", ["Policy", "Message size", "Message count", "Timing"], [
  ["No padding", "As captured", "As captured", "As captured"],
  ["RFC 8467 block", "Queries to multiples of 128 B, responses to multiples of 468 B", "As captured", "As captured"],
  ["RFC 8467 + count", "As RFC 8467", "Padded to a multiple of 32 with decoys", "As captured"],
  ["Adaptive (proposed)", "As RFC 8467", "Padded to a multiple of 32 with decoys", "Delays rounded to 50 ms; queries every 25 ms"],
  ["Maximal", "Queries to at least 512 B, responses to at least 1024 B", "As captured", "As captured"],
], [2000, 2700, 2196, 2000]));
add(P("**Block padding.** A query of q bytes is padded to the next multiple of 128, and a response of r bytes to the next multiple of 468, as RFC 8467 recommends [7]. A 62-byte query and a 77-byte query both become 128 bytes on the wire."));
add(P("**Count normalisation.** A page load with n real lookups is topped up with decoy lookups until it has the next multiple of G, where G = 32. Each decoy copies the padded query length, padded response length and round-trip time of a real lookup chosen at random from the same page load. After block padding all lookups are the same length anyway, so on the wire a decoy cannot be told apart from a real one. No site in our set needs more than 28 lookups, so with G = 32 every page load ends up with exactly 32."));
add(P("**Timing quantisation.** Each response delay is rounded up to the next multiple of 50 ms, and queries are released on a fixed beat of one every 25 ms. After this step the spacing of messages no longer depends on how quickly the resolver answered or how the page was put together."));
add(P("In the code and figures the full three-layer policy is called “adaptive”, because the number of decoys it adds adapts to each page load. The randomness in choosing decoys is seeded from the site name, visit number and policy, so a given page load is always defended in the same way (see Section 5.2)."));

// ------------------------------------------------------------- chapter 5
add(chapter(5, "METHODOLOGY AND TESTING", "ch5"));
add(section("5.1", "Module Description", "s5.1"));
add(P("The pipeline is split into seven modules, each in its own file, as listed in Table 5.1. Any one of them can be run on its own, and run_pipeline.py runs them in order."));
add(table("5.1", "Modules of the system", ["Module", "File", "Input", "Output"], [
  ["M1 Traffic capture", "targets.py, capture/doq_client.py", "Candidate website list", "Raw page-load traces (JSONL)"],
  ["M2 Preprocessing", "preprocess.py", "Raw traces", "Clean, labelled traces"],
  ["M3 Defence layer", "defenses.py", "A trace and a policy name", "The trace as observed, plus its cost"],
  ["M4 Feature extraction", "features.py", "Observed traces", "118-column feature matrix"],
  ["M5 Attack models", "models.py, cnn.py", "Feature matrix, or raw observed sequences", "Trained classifiers"],
  ["M6 Evaluation", "evaluate.py, ablation.py, sweep.py", "Policies and models", "results.json, results.csv"],
  ["M7 Visualisation", "viz.py", "Result files", "Figures"],
  ["Wire validation", "wire_check.py, overhead_sensitivity.py", "Live QUIC datagrams", "Measured overheads, re-scored attack"],
  ["Timing sweep", "timing_sweep.py", "Delay-grid settings", "Accuracy against added latency"],
  ["Open world", "openworld.py", "225 background websites", "True- and false-positive rates"],
  ["Browser capture", "capture/browser.py, capture/browser_replay.py", "Chrome net-logs of real page loads", "Browser-driven DoQ traces"],
], [2100, 2700, 2000, 2096]));
add(minor("M1: Traffic capture"));
add(P("Capture happens in two steps. First, target discovery fetches each candidate website’s landing page and pulls out every hostname that appears in an absolute URL in the HTML. Names that a browser never actually resolves during a page load, such as w3.org and schema.org in document type declarations, are thrown away. Up to 14 hostnames are kept per site: the site’s own name first, then the rest in sorted order. We started from a list of 168 candidate websites covering news, open-source projects, universities, standards bodies, science agencies and governments. Sites that blocked automated requests or referred to fewer than five hostnames were dropped, and the first 100 of the rest in alphabetical order became the closed world. Between them they refer to 1,304 hostnames, and 83 of the 100 sites reach the 14-hostname limit."));
add(P("Second, the capture step opens one QUIC connection per worker to AdGuard’s resolver, with the correct TLS server name, and resolves each hostname for both an A record (IPv4) and an AAAA record (IPv6), the way a dual-stack client would. The DNS message ID is set to zero, as RFC 9250 requires [4]. If a query fails, the worker reconnects once and tries again. Before capture begins, the visits are shuffled across all sites. Without this step every visit to one site would run back to back, the resolver’s cache would warm up in a pattern that matched the site, and the classifier could learn the cache state instead of the traffic."));
add(minor("M2: Preprocessing"));
add(P("A page load is dropped if it has fewer than six exchanges, or fewer than 70% of the exchanges it should have had (two per hostname). The surviving traces are sorted into the order the queries were sent and given labels from 0 to N−1. In the final capture all 1,500 page loads passed these checks."));
add(minor("M3: Defence layer"));
add(P("This module implements the five policies described in Section 4.3. For each page load it also works out the cost of the defence: the extra bytes compared with the unpadded trace, the number of decoys added, and the average delay added to real lookups."));
add(minor("M4: Feature extraction"));
add(P("Each observed page load is turned into 118 numbers, grouped as shown in Table 5.2. Several of these groups are adapted from earlier fingerprinting work, in particular the cumulative-volume idea from CUMUL [9]."));
add(table("5.2", "Feature groups", ["Group", "Features", "What they describe"], [
  ["Volume", "6", "Number of exchanges, total query, response and overall bytes, response-to-query ratio, bytes per exchange"],
  ["Length statistics", "16", "Mean, standard deviation, minimum, maximum, median, quartiles and sum, for queries and for responses"],
  ["Length diversity", "4", "Number of distinct lengths and their entropy, for queries and for responses"],
  ["Length histograms", "24", "9 bins for query lengths and 15 for response lengths"],
  ["Size prefix", "40", "Lengths of the first 20 queries and the first 20 responses"],
  ["Cumulative volume", "10", "Running total of bytes, sampled at 10 evenly spaced points"],
  ["Timing", "18", "Duration, bytes per millisecond, and statistics of inter-arrival gaps and round-trip times"],
  ["**Total**", "**118**", ""],
], [2200, 1200, 5496], { aligns: [AlignmentType.LEFT, AlignmentType.CENTER, AlignmentType.LEFT] }));
add(minor("M5: Attack models"));
add(P("Four classifiers stand in for the attacker. Using several gives some assurance that a result reflects the information in the traffic and not the quirks of a single model. They are: a **Random Forest** [16] with 400 trees; **Histogram Gradient Boosting** with 300 rounds, reduced to 120 rounds when there are more than 40 classes because it builds one tree per class per round; a **multi-layer perceptron** with two hidden layers of 256 and 128 units; and **k-nearest neighbours** with k = 3 and distance weighting. The perceptron and k-nearest neighbours receive standardised features. All four come from scikit-learn [17]."));
add(P("A fifth attacker works differently. Following Deep Fingerprinting [12], a **one-dimensional convolutional neural network** reads the page load directly as a sequence rather than as a list of summary features. For each exchange it receives four values: the observed query length, the observed response length, the gap since the previous query, and the response delay. Sequences are padded with zeros to 40 exchanges. The network has three convolutional layers (32, 64 and 128 filters) followed by max pooling and a linear output layer, and is trained for 60 epochs with the Adam optimiser using PyTorch. It is scored on the same five folds as the other models."));
add(minor("M6: Evaluation and M7: Visualisation"));
add(P("Every combination of policy and model is scored with five-fold stratified cross-validation, which is described in the next section. The results are written to JSON and CSV files, and the visualisation module draws the figures used in Chapter 7 from those files."));
add(section("5.2", "Testing", "s5.2"));
add(minor("Evaluation protocol"));
add(P("We use stratified five-fold cross-validation with a fixed shuffle seed. Each fold keeps the same proportion of visits per website, and because the seed and the labels are the same for every policy, every policy is tested on exactly the same train and test splits. For each combination we report accuracy, macro-averaged precision, recall and F1 score, and top-3 accuracy, which is the fraction of page loads where the true site was among the attacker’s three most likely guesses. The baseline is random guessing, which gets 1/N of guesses right: 1% for 100 websites and 5% for 20."));
add(minor("Data quality checks"));
add(P("After every capture we checked that every site had the expected number of visits (exactly 15 each in the final capture), that no trace had been dropped, and that the average number of exchanges per page load (26.1) matched the number expected from the hostname lists. Responses with a length of zero were also checked for; there were none."));
add(minor("Reproducibility"));
add(P("This check found a real bug. During the first parameter sweep, running exactly the same command twice gave different accuracies for the same configuration: 6.8% one time and 9.8% the next. We traced it to the seed for the decoy generator, which we had built using Python’s hash() function on a tuple that included the site name. Python randomises how strings are hashed in every new process, so every run picked different decoys. We replaced hash() with a CRC32 checksum of a fixed text key. After the fix, two runs in a row gave identical results to the last decimal place, and every number in this report can be reproduced from the data in the repository."));
add(minor("Channel ablation"));
add(P("To find out which observable still identifies the site once RFC 8467 padding is applied, we retrained the Random Forest several times, each time giving it only one group of features: the exchange count alone, the volume features alone, the per-message length features alone, and the timing features alone. Comparing these scores with each other and with the score on all features shows where the leftover information sits."));
add(minor("Parameter sweep"));
add(P("The proposed defence has two main settings: the count grid G and the delay grid. We tried G = 16, 32 and 48, each with a 50 ms delay grid and 25 ms cadence and with a 100 ms delay grid and 50 ms cadence, and recorded accuracy, bandwidth and latency for all six combinations."));
add(minor("Wire validation"));
add(P("To check the 33-byte overhead assumed in Section 4.2, we instrumented the QUIC library at the two points where datagrams cross the socket, so that the exact UDP payload length of every packet our client sent and received was recorded. We then sent 770 queries for the first 30 sites one at a time, and matched each query to the largest outgoing and largest incoming datagram seen while it was in flight. The first query on the connection, which carries the handshake, was skipped. Finally, we re-ran the attack with every observed length drawn from the measured overheads instead of the modelled constant, to see whether any conclusion changed."));
add(minor("Timing sweep"));
add(P("Because the CNN turned out to exploit timing much more than the other models, we swept the delay grid of the proposed defence from 50 ms to 1 s, keeping the size and count layers fixed, and scored every setting against both the CNN and the Random Forest together with the delay it adds to each lookup."));
add(minor("Open-world protocol"));
add(P("For the open world we crawled 348 further candidate websites and kept the 225 that were usable and not already in the monitored set, then captured two visits to each over DoQ in exactly the same way as the main dataset. The background sites were split into five folds by site, and each was paired with one of the five monitored folds, so every background site seen during testing had never been seen during training. The attacker was trained on the 100 monitored classes plus one extra class for \u201Cunmonitored\u201D. A test visit counts as a monitored site only if that site is the attacker\u2019s top choice and its confidence is at least a chosen threshold; otherwise it counts as unmonitored. We report the true-positive rate, the share of monitored visits attributed to the correct site, and the false-positive rate, the share of background visits wrongly attributed to some monitored site."));
add(minor("Browser-driven capture"));
add(P("No web browser can use DNS-over-QUIC, so a browser cannot simply be pointed at a DoQ resolver. Instead we recorded what a real browser would look up. Headless Google Chrome loaded each monitored site with a fresh profile, so nothing was cached, and wrote a net-log, from which we took every hostname the page made Chrome resolve and the time at which it asked. This captures lookups made by scripts, adverts and analytics as well as those named in the HTML. Chrome\u2019s own background traffic was switched off with command-line flags; anything still resolved before the page\u2019s own hostname, and any hostname that appeared on 90% or more of all sites, was treated as Chrome\u2019s rather than the page\u2019s and removed. Each recorded sequence was then resolved over live DoQ. In the resulting trace each query leaves at the time the browser asked for it, and its response arrives one measured round trip later."));
add(P("The first attempt at this capture failed partway through, and the cause took two attempts to find. On Windows, the chrome.exe process we started can hand the page over to a separate browser process and exit straight away. Our script took that exit to mean the page had finished, read a net-log that was still being written, and moved on while the real browser kept running. Abandoned browsers built up until most page loads returned nothing. We fixed it by tracking each page load through its own temporary profile folder: a load is finished only when no process is using that folder, and if it overruns the 25-second limit, exactly those processes are ended and the partial net-log is read. Empty results were discarded and captured again."));
add(minor("Repeat captures and scale-up"));
add(P("We captured the 20-site set twice, on 20 and 23 September 2026, to see how much results move between independent captures. We then captured the 100-site set on 14 October 2026. The three runs are compared in Section 7.7."));

// ------------------------------------------------------------- chapter 6
add(chapter(6, "PROJECT DEMONSTRATION", "ch6"));
add(P("The code, the captured data and all results are in the project repository at github.com/svsdlmao/website-fingerprinting-doq. There are two ways to run it."));
add(P("**Reproducing the results.** The following command runs the whole evaluation on the data already captured, regenerates every metric and figure in Chapter 7, and needs no network connection:", { after: 100 }));
add(codeBlock(["python run_pipeline.py"], 18));
add(P("Adding the option --capture 15 first captures fresh traffic from the live resolver, which takes about 16 minutes for 100 sites.", { before: 120 }));
add(P("**Live demonstration.** The second script carries out the attack on a page load that happens while you watch:", { after: 100 }));
add(codeBlock(["python demo_live.py --site github.com"], 18));
add(P("It runs in five steps. It trains the Random Forest on the captured data; opens a real QUIC connection to the resolver; loads the chosen website’s hostnames over it; prints the direction, length and timing of each datagram, which is everything the attacker is allowed to see; and asks the classifier which site it was. It then runs the same captured page load through the proposed defence twelve times and reports how often the attacker is still right. Without the --site option it picks a website at random and hides the answer until the end.", { before: 120 }));
add(P("Figure 6.1 shows a real run against github.com. The script captured 28 encrypted exchanges in 6.8 seconds. From their lengths and timings alone, the attacker ranked github.com first with 95.8% confidence; its second guess had 1.0%. With the defence applied, it named the wrong site in all twelve attempts. The confidence varies from run to run with network conditions. In earlier runs against bbc.com we saw anything from 55.8% to 100%, but the correct site was ranked first each time."));
const demoLines = fs.readFileSync(ASSET("demo_output.txt"), "utf-8").split(/\r?\n/)
  .map((l) => l.replace(/=+$/, (m) => "=".repeat(Math.min(m.length, 66))).replace(/-{60,}/, "-".repeat(66)))
  .filter((l, i, a) => !(l.trim() === "" && (i === 0 || a[i - 1].trim() === "")));
add(new Paragraph({ pageBreakBefore: true, spacing: { before: 0 }, keepNext: true, children: [] }));
add(codeBlock(demoLines, 15));
figures.push({ key: "fig6.1", num: "6.1", title: "Output of a live demonstration run against github.com" });
add(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 240 }, children: [
  new TextRun({ text: "Figure 6.1: ", font: FONT, size: 20, bold: true }),
  new TextRun({ text: "Output of a live demonstration run against github.com", font: FONT, size: 20 })] }));

// ------------------------------------------------------------- chapter 7
add(chapter(7, "RESULT AND DISCUSSION", "ch7"));
add(section("7.1", "Dataset", "s7.1"));
add(P("Table 7.1 describes the final dataset. Every number in it was measured against the live resolver. Response lengths vary much more than query lengths, because a query only carries the name being looked up, while the response also carries any CNAME chains and every address the resolver returns."));
add(table("7.1", "The 100-site dataset", ["Property", "Value"], [
  ["Websites", "100"],
  ["Visits per website", "15"],
  ["Page-load traces", "1,500"],
  ["Live DoQ queries", "39,110"],
  ["Average exchanges per page load", "26.1"],
  ["Query message length", "24 to 79 bytes (mean 34.7)"],
  ["Response message length", "28 to 364 bytes (mean 104.7)"],
  ["Round-trip time", "36.5 ms to 5,726 ms (mean 126.0 ms)"],
  ["Capture time", "956 seconds, six parallel connections"],
  ["Resolver", "dns.adguard-dns.com, RFC 9250 over UDP port 853"],
], [4200, 4696]));
add(section("7.2", "Attack Accuracy Under Each Defence", "s7.2"));
add(P("Figure 7.1 and Table 7.2 show how each attacker did against each policy. Without padding the result is close to total: the Random Forest and Gradient Boosting models identified every one of the 1,500 page loads correctly, and the other two models got 99% or more. Against a 1% chance of guessing right, a DoQ page load with no padding works as a lookup key for the website."));
add(figure(FIG("fig1_attack_vs_defence.png"), "7.1", "Attacker accuracy for each policy and model, 100 websites"));
add(table("7.2", "Accuracy of each attacker under each policy (100 websites)", ["Policy", "RF", "GB", "MLP", "kNN", "RF top-3", "Bandwidth"], [
  ["No padding", "100.0%", "100.0%", "99.7%", "99.0%", "100.0%", "0%"],
  ["RFC 8467 block", "15.1%", "14.8%", "14.1%", "12.7%", "30.1%", "227%"],
  ["RFC 8467 + count", "10.3%", "9.6%", "9.4%", "7.8%", "20.9%", "327%"],
  ["Adaptive (proposed)", "5.5%", "5.5%", "5.5%", "5.1%", "11.9%", "327%"],
  ["Maximal", "14.9%", "14.8%", "13.9%", "12.7%", "29.7%", "692%"],
], [2196, 1050, 1050, 1050, 1050, 1150, 1350], { aligns: [AlignmentType.LEFT, ...Array(6).fill(AlignmentType.CENTER)] }));
add(P("RFC 8467 padding brings the best attacker down to 15.1%. That is a large drop, but it is still fifteen times better than guessing, and the right site is in the attacker’s top three for 30.1% of page loads. Adding count normalisation brings it down to 10.3%, and adding timing quantisation as well brings it to 5.5%. The four models agree closely under every policy, which suggests these numbers reflect how much information is in the traffic rather than the strengths of any one model."));
add(section("7.3", "Privacy Against Cost", "s7.3"));
add(P("Figure 7.2 plots each policy’s best attacker accuracy against its bandwidth cost. The most striking point is maximal padding. It makes every page load cost almost seven times its original size, three times what RFC 8467 costs, and it scores 14.9%, the same as RFC 8467 for practical purposes. Paying more for bigger padding buys nothing."));
add(figure(FIG("fig2_tradeoff.png"), "7.2", "Best attacker accuracy against bandwidth overhead for each policy", 520));
add(P("The reason becomes clear from Figure 7.3 and from the lengths in Table 7.1. The longest query in our data is 79 bytes and the longest response is 364 bytes. Under RFC 8467, every query is therefore padded to exactly 128 bytes and every response to exactly 468 bytes. Every message ends up the same length, so size carries no information at all, and making the padding bigger cannot remove information that is already gone. The table shows another sign of this: Gradient Boosting and k-nearest neighbours give exactly the same scores under RFC 8467 and under maximal padding (14.8% and 12.7%). When every message is the same length, the two feature matrices differ only by constant values, which these models ignore."));
add(figure(FIG("fig4_size_distribution.png"), "7.3", "Distribution of observed response sizes with no padding, RFC 8467 and maximal padding", 520));
add(section("7.4", "Which Channel Still Leaks", "s7.4"));
add(P("If size carries no information after RFC 8467, the 15.1% that remains must come from somewhere else. Table 7.3 shows the channel ablation that found it. The table also includes the same ablation from the 20-site run presented at Review 1."));
add(table("7.3", "Random Forest accuracy using one feature group at a time, under RFC 8467", ["Features given to the attacker", "Number", "20 sites", "100 sites"], [
  ["Exchange count only", "1", "25.0%", "8.0%"],
  ["Volume features only", "14", "25.0%", "8.0%"],
  ["Per-message length features only", "85", "25.0%", "8.0%"],
  ["Timing features only", "18", "18.7%", "10.9%"],
  ["All features", "118", "26.7%", "15.1%"],
  ["Random guessing", "", "5.0%", "1.0%"],
], [4300, 1300, 1648, 1648], { aligns: [AlignmentType.LEFT, AlignmentType.CENTER, AlignmentType.CENTER, AlignmentType.CENTER] }));
add(P("Two things stand out. First, at both scales the volume features and the 85 per-message length features score exactly the same as the exchange count on its own. Once every message has the same length, the total bytes are just the count multiplied by a constant, and the length histograms and size prefix are just different ways of recording how many messages there were. All of the information that looks like it comes from size is really information about count."));
add(P("Second, the balance between the two channels changes with scale. At 20 websites, count was the stronger channel (25.0% against 18.7% for timing). At 100 websites timing is stronger (10.9% against 8.0%). With more websites, more of them share the same number of lookups (83 of our 100 sites have the maximum of 28), so count separates them less well, while timing keeps more of its value. Neither channel on its own explains the full 15.1%, so they carry partly different information, and a defence needs to deal with both. That is why the proposed defence has a count layer and a timing layer."));
add(section("7.5", "Effect of the Proposed Defence", "s7.5"));
add(P("Figure 7.4 shows the Random Forest’s confusion matrix with no padding and with the proposed defence. With no padding there is a clean diagonal: every website is recognised as itself. With the defence, the predictions are spread almost evenly across all 100 sites."));
add(figure(FIG("fig3_confusion.png"), "7.4", "Random Forest confusion matrices with no padding and with the proposed defence"));
add(P("Figure 7.5 shows the same effect on the traffic itself. Each line is the average cumulative traffic of one website over a page load. With no padding the 100 lines spread out, and each website follows its own path. With the defence they all fall on top of one another."));
add(figure(FIG("fig5_fingerprints.png"), "7.5", "Average cumulative traffic per website, with no padding and with the proposed defence"));
add(section("7.6", "Tuning the Defence", "s7.6"));
add(P("Table 7.4 and Figure 7.6 show the parameter sweep. A count grid of 16 is not enough, because pages with 17 to 28 lookups get padded to 32 while smaller pages get padded to 16, which leaves the attacker two groups to tell apart. A grid of 32 brings every page load to the same count. A grid of 48 costs 540% in bandwidth instead of 327% and gives no further benefit. A 100 ms delay grid does no better than 50 ms and more than doubles the added latency. We therefore chose a count grid of 32 and a 50 ms delay grid."));
add(table("7.4", "Parameter sweep for the proposed defence (100 websites)", ["Count grid", "Delay grid", "Cadence", "Accuracy", "Bandwidth", "Added latency"], [
  ["16", "50 ms", "25 ms", "6.4%", "285%", "21 ms"],
  ["16", "100 ms", "50 ms", "7.1%", "285%", "51 ms"],
  ["**32**", "**50 ms**", "**25 ms**", "**5.5%**", "**327%**", "**21 ms**"],
  ["32", "100 ms", "50 ms", "5.5%", "327%", "51 ms"],
  ["48", "50 ms", "25 ms", "5.8%", "540%", "21 ms"],
  ["48", "100 ms", "50 ms", "5.5%", "540%", "51 ms"],
], [1300, 1400, 1300, 1500, 1600, 1796], { aligns: Array(6).fill(AlignmentType.CENTER) }));
add(figure(FIG("fig6_sweep.png"), "7.6", "Effect of the count grid and delay grid on accuracy and bandwidth", 500));
add(section("7.7", "Repeatability and Scale", "s7.7"));
add(P("Table 7.5 puts the three captures side by side. The order of the policies is the same in every run. In all three, maximal padding is no better than RFC 8467, and the proposed defence scores lowest."));
add(table("7.5", "Best attacker accuracy across the three captures", ["Policy", "20 sites, 20 Sep", "20 sites, 23 Sep", "100 sites, 14 Oct"], [
  ["No padding", "100.0%", "100.0%", "100.0%"],
  ["RFC 8467 block", "26.8%", "27.3%", "15.1%"],
  ["RFC 8467 + count", "22.5%", "20.8%", "10.3%"],
  ["Adaptive (proposed)", "7.8%", "10.8%", "5.5%"],
  ["Maximal", "27.8%", "28.2%", "14.9%"],
  ["Random guessing", "5.0%", "5.0%", "1.0%"],
], [2896, 2000, 2000, 2000], { aligns: [AlignmentType.LEFT, AlignmentType.CENTER, AlignmentType.CENTER, AlignmentType.CENTER] }));
add(P("The two 20-site captures show how much a single number can move between independent runs. The proposed defence scored 7.8% in one and 10.8% in the other, so a difference of around three percentage points at that scale should not be read as meaningful. The order of the policies and the conclusion about maximal padding held in both."));
add(P("The 100-site result needs care in one respect. In absolute terms the proposed defence does better at 100 sites (5.5% against 7.8% to 10.8%), but the chance of guessing right also fell, from 5% to 1%. Measured against chance, the defence is weaker at the larger scale: about 5.5 times better than guessing at 100 sites, compared with 1.6 to 2.2 times at 20 sites. With more websites to tell apart, the small differences that remain after the defence add up to more. Some information still gets through, and closing that gap is part of the future work in Chapter 8."));
add(section("7.8", "Validating the Packet-Size Model", "s7.8"));
add(P("Table 7.6 shows the overheads we measured on real datagrams. The model was close but not exact. Queries carried 30 bytes of overhead in 98% of cases, three fewer than the 33 we assumed. The most likely reason is a shorter packet number or connection ID than the typical values used in our breakdown. Responses were more interesting: about half carried 32 bytes, and most of the rest carried 38 or 39. The extra six or seven bytes are most likely QUIC acknowledgement frames that the resolver bundled into the same packet as the answer. In other words, response overhead is not a constant at all. Ten of the 769 exchanges could not be matched cleanly to a single datagram and were left out."));
add(table("7.6", "Measured QUIC overhead on 769 live exchanges", ["Direction", "Modelled", "Measured (most common values)"], [
  ["Query", "33 B", "30 B in 752 cases, 29 B in 15, 39 B in 2"],
  ["Response", "33 B", "32 B in 414 cases, 38 B in 208, 39 B in 122, other values in 15"],
], [1800, 1600, 5496]));
add(P("A fixed offset makes no difference to any classifier, because it shifts every length by the same amount. A varying offset could, so we re-ran the Random Forest with each length drawn from the measured distribution. Table 7.7 shows the result. Every policy moved by two percentage points or less, which is within the run-to-run variation seen in Section 7.7. The ordering of the policies, and the finding that maximal padding is no better than RFC 8467, did not change. The modelling simplification does not affect the conclusions."));
add(table("7.7", "Random Forest accuracy with modelled and with measured overheads", ["Policy", "Modelled overhead", "Measured overhead"], [
  ["No padding", "100.0%", "100.0%"],
  ["RFC 8467 block", "15.1%", "15.7%"],
  ["RFC 8467 + count", "10.3%", "8.4%"],
  ["Adaptive (proposed)", "5.5%", "4.3%"],
  ["Maximal", "14.9%", "16.4%"],
], [3296, 2800, 2800], { aligns: [AlignmentType.LEFT, AlignmentType.CENTER, AlignmentType.CENTER] }));
add(section("7.9", "A Stronger Attacker", "s7.9"));
add(P("Every result so far comes from attackers that see 118 summary features. Table 7.8 adds the one-dimensional CNN, which reads the page load as an ordered sequence. It is a considerably stronger attacker against every defence. Under RFC 8467 it reaches 33.7%, more than twice the best feature-based model, and against the proposed defence it reaches 13.9% instead of 5.5%."));
add(table("7.8", "Best feature-based attacker compared with the 1-D CNN (100 websites)", ["Policy", "Best of RF, GB, MLP, kNN", "1-D CNN"], [
  ["No padding", "100.0%", "99.7%"],
  ["RFC 8467 block", "15.1%", "33.7%"],
  ["RFC 8467 + count", "10.3%", "15.8%"],
  ["Adaptive (proposed)", "5.5%", "13.9%"],
  ["Maximal", "14.9%", "32.6%"],
], [3296, 2800, 2800], { aligns: [AlignmentType.LEFT, AlignmentType.CENTER, AlignmentType.CENTER] }));
add(P("Two of our conclusions hold against the stronger attacker, and one needs revising. Maximal padding is still no better than RFC 8467 (32.6% against 33.7%), so the finding that size padding has nothing more to give stands. The proposed defence is still the best of the five policies, and it still cuts the CNN\u2019s accuracy from 33.7% to 13.9%. But 13.9% is about fourteen times better than guessing, so the leak is clearly not closed. The large drop when count normalisation is added (33.7% to 15.8%) shows that the CNN gets much of its advantage from the number and order of messages. The small further drop from the timing layer (15.8% to 13.9%) suggests that rounding response delays to 50 ms leaves a good deal of timing information in place, since real delays range from 36 ms to several seconds. A stronger timing layer, tested against this attacker, is the most obvious next step."));
add(section("7.10", "Strengthening the Timing Layer", "s7.10"));
add(P("Section 7.9 suggested that most of the CNN\u2019s remaining advantage comes from timing. To test this we kept the size and count layers unchanged and widened the delay grid from 50 ms to 1 s. Table 7.9 and Figure 7.7 show the result. The bandwidth cost stays at 327% throughout, because the grid only affects timing, but the delay added to each lookup grows quickly."));
add(table("7.9", "Effect of the delay grid on the two strongest attackers (100 websites)", ["Delay grid", "1-D CNN", "Random Forest", "Added delay per lookup"], [
  ["50 ms", "13.9%", "5.5%", "21 ms"],
  ["100 ms", "15.1%", "5.5%", "51 ms"],
  ["250 ms", "9.3%", "6.2%", "179 ms"],
  ["500 ms", "6.5%", "4.0%", "406 ms"],
  ["1000 ms", "3.2%", "2.7%", "888 ms"],
], [2096, 2200, 2200, 2400], { aligns: Array(4).fill(AlignmentType.CENTER) }));
add(figure(FIG("fig7_timing.png"), "7.7", "Attacker accuracy against the delay added by the timing layer", 500));
add(P("For the CNN the trend is clear: 13.9% at 50 ms, 9.3% at 250 ms, 6.5% at 500 ms and 3.2% at 1 s, which is close to the 1% floor. The 100 ms setting scored about a point worse than 50 ms, which at this sample size is within run-to-run noise. The Random Forest, already near 5%, falls to 2.7%. This confirms that the leak the CNN exploits is mainly timing, and that it can be closed, but only by holding every response back by close to a second. A browser sends many lookups in parallel, so a page is delayed by roughly the per-lookup figure rather than by the sum of them all, but that is still a heavy price for interactive browsing. We kept 50 ms as the default because it is the cheapest setting, and report the full curve so that the trade-off is visible."));
add(section("7.11", "Open-World Evaluation", "s7.11"));
add(P("In the closed world the attacker always knows the visit was to one of the 100 monitored sites. Here it must also deal with 450 visits to 225 background sites it has never seen. Table 7.10 shows the true-positive and false-positive rates for each policy with no confidence threshold, so that the attacker simply takes its top choice, and with a threshold of 0.5."));
add(table("7.10", "Open-world results: 100 monitored and 225 unseen background websites", ["Policy", "TPR, no threshold", "FPR, no threshold", "TPR, threshold 0.5", "FPR, threshold 0.5"], [
  ["No padding", "98.6%", "2.2%", "96.6%", "0.0%"],
  ["RFC 8467 block", "13.5%", "5.6%", "6.3%", "1.3%"],
  ["RFC 8467 + count", "8.8%", "3.6%", "0.7%", "0.0%"],
  ["Adaptive (proposed)", "4.3%", "5.1%", "1.1%", "0.0%"],
  ["Maximal", "13.2%", "6.0%", "6.4%", "1.3%"],
], [2296, 1650, 1650, 1650, 1650], { aligns: [AlignmentType.LEFT, ...Array(4).fill(AlignmentType.CENTER)] }));
add(P("Without padding the attack carries over to the open world almost unchanged. With a threshold of 0.5 the attacker identified 96.6% of monitored visits correctly and did not flag a single one of the 450 background visits. With a test set of this size that means the false-positive rate is below about 0.7%, not that it is zero."));
add(P("The defences behave much as in the closed world. RFC 8467 and maximal padding still leave a usable signal: 13.5% and 13.2% of monitored visits are identified, against 5.6% and 6.0% false alarms. Under the proposed defence the attacker\u2019s correct identifications (4.3%) are no more frequent than its false alarms (5.1%), so its guesses are of little use. Raising the threshold to 0.5 removes the false alarms, but leaves only 1.1% of monitored visits identified."));
add(P("This test is still small. Real users visit far more than 225 other sites, and when background traffic heavily outnumbers visits to the monitored sites, even a low false-positive rate turns into a large number of false alarms. These results show that the closed-world conclusions carry over to an open setting; they are not an estimate of how the attack would perform on the open Internet."));
add(section("7.12", "Browser-Driven Traces", "s7.12"));
add(P("All the results so far use the hostnames a page\u2019s HTML refers to. A real browser also resolves names requested by scripts, adverts and analytics, and the set changes from one load to the next. Using the method in Section 5.2, headless Chrome loaded each monitored site five to eight times (562 page loads), and the recorded lookup sequences were replayed over live DoQ: 22,672 queries in all. One hostname, www.google.com, appeared on more than 90% of sites and was removed as Chrome\u2019s own traffic. After the usual quality checks, 75 sites still had at least five usable page loads, giving 410 traces; random guessing over 75 sites is 1.3%."));
add(P("The browser traces are very different from the crawled ones. A crawled page load always had at most 28 exchanges. A browser page load had anywhere from 6 to 498, with a median of 18, and the same site could vary a good deal from visit to visit. Table 7.11 shows how the attack and the defences fare on this traffic."));
add(table("7.11", "Results on browser-driven traces (75 websites)", ["Policy", "Random Forest", "1-D CNN", "Bandwidth"], [
  ["No padding", "98.5%", "63.2%", "0%"],
  ["RFC 8467 block", "42.9%", "34.1%", "251%"],
  ["RFC 8467 + count", "22.0%", "13.9%", "723%"],
  ["Adaptive (proposed)", "11.2%", "7.1%", "723%"],
  ["Maximal", "42.7%", "31.5%", "749%"],
], [2896, 2000, 2000, 2000], { aligns: [AlignmentType.LEFT, AlignmentType.CENTER, AlignmentType.CENTER, AlignmentType.CENTER] }));
add(P("Four points stand out. First, the undefended attack still works: the Random Forest identified 98.5% of browser page loads, even though real browsing adds far more variation than the crawled set. This goes some way towards answering the concern, listed among the limitations in Section 7.13, that the 100% figure on crawled traces was flattered by near-identical repeat visits."));
add(P("Second, RFC 8467 does much worse here than on crawled traffic. It leaves the Random Forest at 42.9%, against 15.1% on the crawled set. With page loads ranging from a handful of lookups to several hundred, the number of lookups is a far stronger signal, and size padding does nothing about it. Third, maximal padding is again no better than RFC 8467 (42.7% against 42.9%), so the central finding of this project holds on browser traffic as well."));
add(P("Fourth, the proposed defence still gives the lowest accuracy, 11.2% for the Random Forest and 7.1% for the CNN, but at a much higher price: 723% extra bandwidth instead of 327%. A count grid of 32 cannot make a 20-lookup page look like a 400-lookup page, so it leaves several groups the attacker can tell apart. Table 7.12 shows what happens when the grid is widened."));
add(table("7.12", "Wider count grids on browser traces (Random Forest)", ["Count grid", "Accuracy", "Bandwidth"], [
  ["32", "11.2%", "723%"],
  ["64", "10.0%", "1,430%"],
  ["128", "7.1%", "2,875%"],
  ["256", "6.8%", "5,814%"],
  ["512", "4.4%", "11,695%"],
], [2964, 2966, 2966], { aligns: Array(3).fill(AlignmentType.CENTER) }));
add(P("Making every page load the same length in lookups needs a grid of 512, and that costs over a hundred times the original traffic. Padding the count up to a fixed grid works for pages with a similar number of lookups, as in the crawled set, but it does not scale to real web pages. A practical defence would need something cheaper, such as grouping page loads into a few size classes on a logarithmic scale, which we did not have time to test."));
add(P("The CNN is weaker than the Random Forest on this data (63.2% without padding). With only five to eight page loads per site and sequences of very different lengths, it has too little to learn from, which is a known weakness of deep models on small datasets [12]. Its numbers on browser traces should therefore be treated as a lower bound on what a sequence model could do with more data."));
add(section("7.13", "Limitations", "s7.13"));
add(bullets([
  "**Small open world.** The open-world test uses 225 background sites with two visits each. On the real web, background traffic heavily outnumbers visits to any monitored site, so even a low false-positive rate would produce many false alarms.",
  "**Undefended accuracy on crawled traces is an upper bound.** The resolver caches its answers, so repeat visits produce almost identical traffic. The browser traces vary much more and still gave 98.5%, but they cover only 75 sites.",
  "**Browser lookups, replayed.** The browser-driven traces use the hostnames and request times of real Chrome page loads, but the queries themselves are sent by our client over DoQ, because no browser supports DoQ. Response timing is therefore our client\u2019s, not a browser\u2019s.",
  "**Defences are simulated.** The defences are applied to captured traces, not run in a real client. The timing layer in particular assumes a client that sends queries every 25 ms on separate QUIC streams. RFC 9250 allows this, but we have not implemented it, and the latency figures only count the rounding of response delays.",
  "**Packet-size model.** Section 7.8 showed that real overhead varies by a few bytes. Re-scoring with the measured values changed no conclusion, but the main pipeline still uses the modelled constant.",
  "**The defence depends on the attacker.** It holds feature-based models to 5.5%, but the CNN reaches 13.9%, and bringing the CNN close to chance needs a delay grid of about one second (Section 7.10). An attacker stronger than ours may do better again.",
  "**One vantage point.** All measurements use one resolver, one network and one location.",
  "**Small training sets.** The crawled set has 15 visits per site and the browser set only five to eight. An attacker with more visits, and the CNN in particular, would probably do better against the defences.",
  "**Count padding does not scale.** On real browser traffic the count layer costs 723% bandwidth, and fully hiding the count would cost over 11,000% (Section 7.12).",
]));

// ------------------------------------------------------------- chapter 8
add(chapter(8, "CONCLUSION", "ch8"));
add(P("We set out to measure how much DNS-over-QUIC reveals about the websites a person visits, and how well padding protects against that. Working from live traffic, about 74,000 queries to a public DoQ resolver across crawled page loads, browser page loads and an open-world background set, we found that DoQ without padding reveals the visited site almost every time: 100% on 100 crawled sites, 98.5% on real browser page loads, and 96.6% with no false alarms in the open-world test."));
add(P("The most useful result is the explanation of why padding stops helping. RFC 8467 already pads every query and every response in our data to the same length, so message size carries no further information, and padding to a larger size cannot improve on it. Maximal padding costs three times as much and scored the same in every setting we tried: crawled traffic, browser traffic, the open world, and with the CNN. What still identifies the site is how many lookups a page makes and when it makes them. On crawled pages these two channels left the best attacker at 15.1% under RFC 8467; on real browser pages, where the number of lookups varies far more, they left it at 42.9%."));
add(P("Our proposed defence adds two layers to RFC 8467: decoy lookups that bring each page load up to a fixed count, and quantised timing. It gave the lowest accuracy of the five policies in every experiment: 5.5% for the feature-based attackers and 13.9% for the CNN on crawled traffic, 11.2% and 7.1% on browser traffic, and hit rates no better than its false-alarm rate in the open world. It does not close the leak, and each of its layers has a clear cost. Hiding timing from the CNN needs response delays rounded up to about a second. Hiding the count on real pages needs bandwidth that grows far beyond what is practical."));
add(P("We also checked the one value our pipeline modelled rather than measured, the per-packet QUIC overhead. It turned out to be close to our assumption but not constant, and re-running the attack with the measured values changed no conclusion. The remaining limitations are listed in Section 7.13."));
add(minor("Future work"));
add(bullets([
  "Replace the fixed count grid with a cheaper scheme, such as padding page loads to a few size classes on a logarithmic scale, and measure its cost on browser traffic.",
  "Find a timing defence that hides timing from sequence models at much less than a second of delay per lookup, for example by sending queries at a constant rate.",
  "Implement the defence in a working DoQ client and measure its real latency, including the fixed query cadence.",
  "Collect many more browser page loads per site so that sequence models such as the CNN can be trained properly, and enlarge the open-world background set.",
  "Repeat the measurements with other resolvers and from other networks, and confirm the in-process datagram measurements with an independent packet capture.",
]));

// ------------------------------------------------------------- chapter 9
add(chapter(9, "REFERENCES", "ch9"));
const REFS = [
  "P. Mockapetris, “Domain names – implementation and specification,” RFC 1035, IETF, Nov. 1987.",
  "Z. Hu, L. Zhu, J. Heidemann, A. Mankin, D. Wessels and P. Hoffman, “Specification for DNS over Transport Layer Security (TLS),” RFC 7858, IETF, May 2016.",
  "P. Hoffman and P. McManus, “DNS Queries over HTTPS (DoH),” RFC 8484, IETF, Oct. 2018.",
  "C. Huitema, S. Dickinson and A. Mankin, “DNS over Dedicated QUIC Connections,” RFC 9250, IETF, May 2022.",
  "J. Iyengar and M. Thomson, “QUIC: A UDP-Based Multiplexed and Secure Transport,” RFC 9000, IETF, May 2021.",
  "A. Mayrhofer, “The EDNS(0) Padding Option,” RFC 7830, IETF, May 2016.",
  "A. Mayrhofer, “Padding Policies for Extension Mechanisms for DNS (EDNS(0)),” RFC 8467, IETF, Oct. 2018.",
  "X. Cai, X. C. Zhang, B. Joshi and R. Johnson, “Touching from a distance: Website fingerprinting attacks and defenses,” in Proc. ACM Conference on Computer and Communications Security (CCS), 2012.",
  "A. Panchenko, F. Lanze, A. Zinnen, M. Henze, J. Pennekamp, K. Wehrle and T. Engel, “Website fingerprinting at Internet scale,” in Proc. Network and Distributed System Security Symposium (NDSS), 2016.",
  "J. Hayes and G. Danezis, “k-fingerprinting: A robust scalable website fingerprinting technique,” in Proc. USENIX Security Symposium, 2016.",
  "M. Juarez, M. Imani, M. Perry, C. Diaz and M. Wright, “Toward an efficient website fingerprinting defense,” in Proc. European Symposium on Research in Computer Security (ESORICS), 2016.",
  "P. Sirinam, M. Imani, M. Juarez and M. Wright, “Deep fingerprinting: Undermining website fingerprinting defenses with deep learning,” in Proc. ACM Conference on Computer and Communications Security (CCS), 2018.",
  "S. Siby, M. Juarez, C. Diaz, N. Vallina-Rodriguez and C. Troncoso, “Encrypted DNS → privacy? A traffic analysis perspective,” in Proc. Network and Distributed System Security Symposium (NDSS), 2020.",
  "J. Bushart and C. Rossow, “Padding ain’t enough: Assessing the privacy guarantees of encrypted DNS,” in Proc. USENIX Workshop on Free and Open Communications on the Internet (FOCI), 2020.",
  "M. Kosek, T. V. Doan, S. Granderath and V. Bajpai, “One to rule them all? A first look at DNS over QUIC,” in Proc. Passive and Active Measurement Conference (PAM), 2022.",
  "L. Breiman, “Random forests,” Machine Learning, vol. 45, no. 1, pp. 5–32, 2001.",
  "F. Pedregosa et al., “Scikit-learn: Machine learning in Python,” Journal of Machine Learning Research, vol. 12, pp. 2825–2830, 2011.",
];
REFS.forEach((r, i) => add(new Paragraph({
  alignment: AlignmentType.JUSTIFIED, spacing: { line: LINE, after: 120 },
  indent: { left: 567, hanging: 567 },
  children: [new TextRun({ text: "[" + (i + 1) + "]\t", font: FONT, size: 24 }), new TextRun({ text: r, font: FONT, size: 24 })],
})));

// ------------------------------------------------------------- appendix
tocEntries.push({ key: "appA", num: "", text: "APPENDIX A – SAMPLE CODE", level: 0, search: "APPENDIX A" });
add(new Paragraph({ alignment: AlignmentType.CENTER, pageBreakBefore: true, heading: HeadingLevel.HEADING_1,
  spacing: { after: 360 }, children: [new TextRun({ text: "APPENDIX A – SAMPLE CODE", font: FONT, size: 28, bold: true })] }));
function codeBetween(file, startMark, endMark) {
  const lines = fs.readFileSync(path.join(ROOT, file), "utf-8").split(/\r?\n/);
  const s = lines.findIndex((l) => l.startsWith(startMark));
  const e = lines.findIndex((l, i) => i > s && l.startsWith(endMark));
  return lines.slice(s, e).filter((l, i, a) => !(i === a.length - 1 && l.trim() === ""))
    .map((l) => l.replace(/\s+$/, ""));
}
add(minor("A.1 Sending one DoQ query and measuring it (src/capture/doq_client.py)"));
add(P("This method sends a single query over the open QUIC connection and returns the measured lengths and round-trip time. If the connection has dropped, it reconnects once and retries.", { after: 100 }));
add(codeBlock(codeBetween("src/capture/doq_client.py", "    def query(", "def capture_visit("), 15));
add(minor("A.2 Applying a defence to a captured page load (src/defenses.py)"));
add(P("This function turns a captured page load into the trace an attacker would see under a given policy. It applies the three layers described in Section 4.3: block padding, count normalisation with decoys, and timing quantisation.", { after: 100, before: 160 }));
add(codeBlock(codeBetween("src/defenses.py", "def apply(", "def overhead("), 15));

// ================================================== TOC AND FRONT LISTS
const pg = (k) => PAGES[k] || "";

function tocTable() {
  const W = [900, 6896, 1100];
  const rows = [new TableRow({ tableHeader: true, children: [
    cell("Sl.No", W[0], { bold: true, align: AlignmentType.CENTER, fill: "E7E9EC" }),
    cell("Contents", W[1], { bold: true, fill: "E7E9EC" }),
    cell("Page No.", W[2], { bold: true, align: AlignmentType.CENTER, fill: "E7E9EC" })] })];
  const entries = [{ key: "abstract", num: "", text: "Abstract", level: -1 }, ...tocEntries];
  for (const e of entries) {
    const label = e.level === 1 ? "      " + e.text : e.level === 2 ? "            " + e.text : e.text;
    rows.push(new TableRow({ cantSplit: true, children: [
      cell(e.num, W[0], { align: AlignmentType.CENTER, bold: e.level <= 0 }),
      cell(label, W[1], { bold: e.level <= 0 }),
      cell(pg(e.key), W[2], { align: AlignmentType.CENTER, bold: e.level <= 0 })] }));
  }
  return new Table({ width: { size: 8896, type: WidthType.DXA }, columnWidths: W,
    layout: TableLayoutType.FIXED, rows });
}

function listTable(items, label) {
  const W = [1400, 6396, 1100];
  return new Table({ width: { size: 8896, type: WidthType.DXA }, columnWidths: W, layout: TableLayoutType.FIXED,
    rows: [new TableRow({ tableHeader: true, children: [
      cell(label + " No.", W[0], { bold: true, align: AlignmentType.CENTER, fill: "E7E9EC" }),
      cell("Title", W[1], { bold: true, fill: "E7E9EC" }),
      cell("Page No.", W[2], { bold: true, align: AlignmentType.CENTER, fill: "E7E9EC" })] }),
    ...items.map((it) => new TableRow({ cantSplit: true, children: [
      cell(it.num, W[0], { align: AlignmentType.CENTER }), cell(it.title, W[1]),
      cell(pg(it.key), W[2], { align: AlignmentType.CENTER })] }))] });
}

function twoCol(rows, w0 = 1900) {
  return new Table({ width: { size: 8896, type: WidthType.DXA }, columnWidths: [w0, 8896 - w0], borders: NOBORDERS,
    rows: rows.map(([a, b]) => new TableRow({ children: [
      cell(a, w0, { noBorder: true, size: 24, bold: true }), cell(b, 8896 - w0, { noBorder: true, size: 24 })] })) });
}

const ABBR = [
  ["AAAA", "IPv6 address record"], ["AEAD", "Authenticated Encryption with Associated Data"],
  ["CV", "Cross-Validation"], ["DNS", "Domain Name System"], ["DoH", "DNS over HTTPS"],
  ["DoQ", "DNS over QUIC"], ["DoT", "DNS over TLS"], ["EDNS(0)", "Extension Mechanisms for DNS, version 0"],
  ["GB", "Gradient Boosting"], ["IETF", "Internet Engineering Task Force"], ["ISP", "Internet Service Provider"],
  ["JSONL", "JSON Lines (one JSON record per line)"], ["kNN", "k-Nearest Neighbours"],
  ["MLP", "Multi-Layer Perceptron"], ["QUIC", "Quick UDP Internet Connections, standardised in RFC 9000"],
  ["RF", "Random Forest"], ["RFC", "Request for Comments"], ["RTT", "Round-Trip Time"],
  ["SVM", "Support Vector Machine"], ["TLS", "Transport Layer Security"], ["UDP", "User Datagram Protocol"],
  ["WF", "Website Fingerprinting"],
];
const SYMS = [
  ["N", "Number of monitored websites (20 or 100)"],
  ["q, r", "Length in bytes of a DNS query and of a DNS response"],
  ["n", "Number of real lookups in a page load"],
  ["Bq = 128", "RFC 8467 block length for queries, in bytes"],
  ["Br = 468", "RFC 8467 block length for responses, in bytes"],
  ["G = 32", "Count grid: page loads are padded to a multiple of G lookups"],
  ["Δ = 50 ms", "Delay grid: observed response delays are rounded up to a multiple of Δ"],
  ["τ = 25 ms", "Query cadence of the proposed defence"],
  ["⌈x / b⌉ × b", "x rounded up to the next multiple of b"],
  ["1/N", "Accuracy of random guessing"],
];

const abstractText = [
  "DNS-over-QUIC (DoQ), standardised as RFC 9250 in 2022, encrypts the name lookups a browser makes before it loads a web page. Encryption hides which names are looked up, but not the size, number or timing of the encrypted messages. This project measures how much of a person\u2019s browsing those three observables reveal, and whether RFC 8467, the padding policy the IETF recommends for encrypted DNS, is enough to hide it.",
  "All measurements use live traffic to AdGuard\u2019s public DoQ resolver. We captured 1,500 page loads of 100 websites from the hostnames each page refers to, 562 page loads recorded from a real Chrome browser and replayed over DoQ, and 450 visits to 225 background sites for an open-world test. Attackers were modelled by four classifiers using 118 features of message direction, length and timing, and by a one-dimensional convolutional network (CNN) reading each page load as a sequence. Five padding policies were applied to the same captured traces.",
  "Without padding the visited site was identified 100% of the time on crawled traffic and 98.5% on browser traffic, against a chance level of about 1%. RFC 8467 reduced this to 15.1% and 42.9% respectively. Padding every message to a much larger size cost three times as much bandwidth and was no better in any setting. A channel ablation explained why: after RFC 8467 every message in our data is the same length, and what still identifies a site is how many lookups it makes and when.",
  "We therefore added decoy lookups that equalise the count and quantised timing. This gave the lowest accuracy of every policy tested: 5.5% for the feature-based attackers and 13.9% for the CNN on crawled traffic, 11.2% on browser traffic, and correct identifications no more frequent than false alarms in the open world. It does not close the leak. Hiding timing from the CNN required delaying every response by up to a second, and hiding the count on real browser pages required bandwidth that grows far beyond practical levels. Measuring real QUIC datagrams showed our packet-size model to be close but not exact, and changed no conclusion.",
];

const front = [
  ...declaration, ...certificate, ...ack,
  C("TABLE OF CONTENTS", 14, true, { pageBreak: true, after: 240 }),
  tocTable(),
  C("List of Figures", 16, true, { pageBreak: true, after: 240 }),
  listTable(figures, "Figure"),
  C("List of Tables", 16, true, { pageBreak: true, after: 240 }),
  listTable(tables, "Table"),
  C("List of Abbreviations", 16, true, { pageBreak: true, after: 240 }),
  twoCol(ABBR),
  C("Symbols and Notations", 16, true, { pageBreak: true, after: 240 }),
  twoCol(SYMS, 2000),
  C("ABSTRACT", 16, true, { pageBreak: true, after: 300, line: 360 }),
  ...abstractText.map((t) => P(t, { after: 160 })),
];

// ================================================================ DOCUMENT
const footer = (fmt) => ({ default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
  children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 22 })] })] }) });
const page = { size: { width: 11906, height: 16838 },
  margin: { top: 1382, bottom: 1300, left: 1685, right: 1325, footer: 560 } };

const doc = new Document({
  creator: "Anant Agarwal, Aryaman Tripathi, Shauryaveer Singh Dabas",
  title: TITLE,
  styles: {
    default: { document: { run: { font: FONT, size: 24 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 32, bold: true }, paragraph: { outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 28, bold: true }, paragraph: { outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { font: FONT, size: 24, bold: true }, paragraph: { outlineLevel: 2 } },
    ],
  },
  numbering: { config: [
    { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•",
      alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 567, hanging: 340 } } } }] },
    { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.",
      alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 567, hanging: 340 } } } }] },
  ] },
  sections: [
    { properties: { page }, children: cover },
    { properties: { page: { ...page, pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN } } },
      footers: footer(), children: front },
    { properties: { page: { ...page, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } },
      footers: footer(), children: body },
  ],
});

// search keys for find_pages.py
const keys = [{ key: "abstract", search: "ABSTRACT" },
  ...tocEntries.map((e) => ({ key: e.key, search: e.search })),
  ...figures.map((f) => ({ key: f.key, search: "Figure " + f.num + ":" })),
  ...tables.map((t) => ({ key: t.key, search: "Table " + t.num + ":" }))];
fs.writeFileSync(path.join(__dirname, "keys.json"), JSON.stringify(keys, null, 1));

const out = path.join(__dirname, "Project_Report_WF_DoQ.docx");
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(out, buf); console.log("written " + out +
  "  (" + tocEntries.length + " toc entries, " + figures.length + " figures, " + tables.length + " tables)"); });
