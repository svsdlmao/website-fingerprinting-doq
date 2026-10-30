"""Lay the report out in Word, then record the page each heading and caption lands on."""
import json, os, re, sys
import pymupdf
import win32com.client

HERE = os.path.dirname(os.path.abspath(__file__))
DOCX = os.path.join(HERE, "Project_Report_WF_DoQ.docx")
PDF = os.path.join(HERE, "Project_Report_WF_DoQ.pdf")

import time
t0 = time.time()
word = win32com.client.DispatchEx("Word.Application")
word.Visible = False
word.DisplayAlerts = 0          # never block on a dialog
print(f"word up {time.time()-t0:.1f}s", flush=True)
try:
    d = word.Documents.Open(DOCX, ConfirmConversions=False, ReadOnly=True,
                            AddToRecentFiles=False, Visible=False, NoEncodingDialog=True)
    print(f"opened {time.time()-t0:.1f}s", flush=True)
    d.ExportAsFixedFormat(PDF, 17)
    print(f"exported {time.time()-t0:.1f}s", flush=True)
    d.Close(False)
finally:
    word.Quit()

doc = pymupdf.open(PDF)
pages = [re.sub(r"\s+", " ", pg.get_text()) for pg in doc]
norm = lambda t: re.sub(r"\s+", " ", t)

def roman(n):
    out = ""
    for v, s in [(10, "x"), (9, "ix"), (5, "v"), (4, "iv"), (1, "i")]:
        while n >= v: out += s; n -= v
    return out

ch1 = next(i for i, t in enumerate(pages) if "CHAPTER 1 " in t + " ")
label = lambda i: str(i - ch1 + 1) if i >= ch1 else roman(i)   # page index 0 is the cover

keys = json.load(open(os.path.join(HERE, "keys.json"), encoding="utf-8"))
abstract = next(i for i, t in enumerate(pages) if i > 3 and "ABSTRACT" in t)
result, ptr, missing = {}, {}, []
for k in keys:
    kind = "fig" if k["key"].startswith("fig") else "tab" if k["key"].startswith("tab") else "toc"
    start = ptr.get(kind, abstract)
    hit = next((i for i in range(start, len(pages)) if norm(k["search"]) in pages[i]), None)
    if hit is None:
        missing.append(k["search"]); continue
    result[k["key"]] = label(hit); ptr[kind] = hit
json.dump(result, open(os.path.join(HERE, "pages.json"), "w"), indent=1)
print(f"{len(doc)} pages, chapter 1 on physical page {ch1 + 1}; located {len(result)}/{len(keys)}")
if missing: print("MISSING:", missing)
