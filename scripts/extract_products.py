"""Extract every orderable item (item #, product, size, price) directly from the catalogue PDF.

Usage:  python3 scripts/extract_products.py public/spring-2027-flower-catalogue.pdf
Writes: data/products.json and data/verification-report.md

The PDF is only read, never modified. Anything that cannot be read cleanly is flagged, not guessed.
"""
import json, re, sys, hashlib, collections
import pdfplumber, logging
logging.disable(logging.WARNING)

PDF = sys.argv[1] if len(sys.argv) > 1 else 'public/spring-2027-flower-catalogue.pdf'
SIZE_RE = re.compile(r'^(2\.5"|4"|4\.25"|4\.5"|6"|Quart)$')
NUM_RE = re.compile(r'^#(\d+)$')
PRICE_RE = re.compile(r'^\$(\d+\.\d{2})$')

def lines_of(words, tol=3):
    rows = []
    for w in sorted(words, key=lambda w: (round(w['top']), w['x0'])):
        for r in rows:
            if abs(r['top'] - w['top']) <= tol:
                r['words'].append(w); break
        else:
            rows.append({'top': w['top'], 'words': [w]})
    for r in rows:
        r['words'].sort(key=lambda w: w['x0'])
        r['text'] = ' '.join(w['text'] for w in r['words'])
    return sorted(rows, key=lambda r: r['top'])

with pdfplumber.open(PDF) as pdf:
    npages = len(pdf.pages)
    # ---- section and family page ranges from the Table of Contents ----
    toc_text = ''
    for p in pdf.pages[:8]:
        t = p.extract_text() or ''
        if 'Table of Contents' in t:
            toc_text = t; break
    # family headings appear as the large serif heading at the top of each family's first page
    page_titles = {}
    for i, p in enumerate(pdf.pages, 1):
        words = p.extract_words(extra_attrs=['size', 'fontname'])
        big = [w for w in words if w['size'] >= 26 and w['top'] < 200]   # family heading (h2) or section heading (h1)
        if big:
            ls = lines_of(big)
            page_titles[i] = (' '.join(l['text'] for l in ls[:2]) if len(ls) > 1 and ls[1]['top'] - ls[0]['top'] < 50 else ls[0]['text'], max(w['size'] for w in big))

    items, flags = [], []
    current_family = None
    for i, p in enumerate(pdf.pages, 1):
        # use_text_flow keeps the PDF's own reading order, which follows each product card from name to price
        words = p.extract_words(extra_attrs=['size', 'fontname'], use_text_flow=True, keep_blank_chars=False)
        name_buf, last_name = [], None
        k = 0
        while k < len(words):
            w = words[k]
            is_lora = 'Lora' in w['fontname']
            if is_lora and 23.5 <= w['size'] <= 28.5 and w['top'] < 250:
                # family heading (possibly several words)
                j = k; parts = []
                while j < len(words) and 'Lora' in words[j]['fontname'] and 23.5 <= words[j]['size'] <= 28.5:
                    parts.append(words[j]['text']); j += 1
                current_family = ' '.join(parts); name_buf = []; k = j; continue
            if is_lora and 14.5 <= w['size'] < 20:
                name_buf.append(w['text']); k += 1; continue
            m = NUM_RE.match(w['text'])
            if m:
                prev = words[k - 1]['text'] if k else ''
                prev2 = words[k - 2]['text'] if k > 1 else ''
                size = prev if SIZE_RE.match(prev) else ('6 Pack' if prev == 'Pack' and prev2 == '6' else None)
                price = None
                for w2 in words[k + 1:k + 3]:
                    pm = PRICE_RE.match(w2['text'])
                    if pm: price = float(pm.group(1)); break
                if name_buf:
                    # the "How it looks planted" photo label uses the same serif font as card names
                    last_name = re.sub(r'^(How it looks planted\s*)+', '', ' '.join(name_buf)).strip(); name_buf = []
                items.append(dict(item_no=int(m.group(1)), family=current_family, name=last_name or '', size=size, price=price, page=i))
                k += 1; continue
            if not (SIZE_RE.match(w['text']) or PRICE_RE.match(w['text']) or w['text'] in ('6', 'Pack')):
                # any other text (captions, descriptions) ends a pending name
                name_buf = []
            k += 1
        # a name only carries over to the next size line of the same card
# ---- multi-size cards: second size row inherits the card's name ----
by_page = collections.defaultdict(list)
for it in items: by_page[it['page']].append(it)
for it in items:
    if not it['name']:
        prev = [x for x in by_page[it['page']] if x['item_no'] == it['item_no'] - 1 and x['name']]
        if prev: it['name'] = prev[0]['name']; it['name_inherited'] = True

# ---- verification ----
counts = collections.Counter(it['item_no'] for it in items)
dups = sorted(n for n, c in counts.items() if c > 1)
nums = sorted(counts)
missing_nums = [n for n in range(1, max(nums) + 1) if n not in counts] if nums else []
for it in items:
    problems = []
    if it['price'] is None: problems.append('price not found')
    if not it['size']: problems.append('size not found')
    if not it['name']: problems.append('name not found')
    if not it['family']: problems.append('plant family not found')
    if problems: flags.append((it['item_no'], it['page'], '; '.join(problems)))

items.sort(key=lambda x: x['item_no'])
sha = hashlib.sha256(open(PDF, 'rb').read()).hexdigest()
out = {'source_pdf': PDF.split('/')[-1], 'source_sha256': sha, 'pages': npages, 'currency': 'CAD', 'gst_rate': 0.05,
       'items': [{k: v for k, v in it.items() if k != 'name_inherited'} for it in items]}
json.dump(out, open('data/products.json', 'w'), indent=1, ensure_ascii=False)

fams = collections.OrderedDict()
for it in items: fams.setdefault(it['family'], 0); fams[it['family']] += 1
rep = [f'# Product data verification report', '',
       f'Source: `{out["source_pdf"]}` ({npages} pages)', f'SHA-256: `{sha}`', '',
       '## Summary', '',
       f'| Check | Result |', '|---|---|',
       f'| Orderable item numbers extracted | {len(items)} |',
       f'| Distinct varieties (product cards) | {len({(it["family"], it["name"]) for it in items})} |',
       f'| Plant families | {len(fams)} |',
       f'| Item numbers run | #{nums[0]} to #{nums[-1]} |' if nums else '| Item numbers | none |',
       f'| Missing numbers in that run | {", ".join(map(str, missing_nums)) or "None"} |',
       f'| Duplicate item numbers | {", ".join(map(str, dups)) or "None"} |',
       f'| Items missing a price | {sum(1 for it in items if it["price"] is None)} |',
       f'| Items needing manual review | {len(flags)} |', '',
       'The catalogue cover says 242 varieties. That counts plant varieties; several varieties are sold in two pot sizes, '
       'each with its own item number, so there are more orderable item numbers than varieties.', '']
if flags:
    rep += ['## Needs manual review', '', '| Item # | Page | Issue |', '|---|---|---|'] + [f'| {a} | {b} | {c} |' for a, b, c in flags] + ['']
rep += ['## Items per plant family', '', '| Plant family | Item numbers |', '|---|---|'] + [f'| {k} | {v} |' for k, v in fams.items()] + ['']
rep += ['## Full extracted list', '', '| Item # | Page | Plant family | Product | Size | Price (CAD) |', '|---|---|---|---|---|---|']
rep += [f'| {it["item_no"]} | {it["page"]} | {it["family"]} | {it["name"]} | {it["size"]} | ' + (f'${it["price"]:.2f}' if it['price'] is not None else 'MISSING') + ' |' for it in items]
open('data/verification-report.md', 'w').write('\n'.join(rep) + '\n')
print(f'{len(items)} items, {len(flags)} flagged, dups={dups}, missing={missing_nums[:10]}')
for f in flags[:20]: print('FLAG', f)
