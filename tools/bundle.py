#!/usr/bin/env python3
"""Merge lessons, build compact data: data.json (inline), vocab.json + strokes/*.json (lazy)."""
import json, os, re, collections, sys
import hsklib as H
import annotate as A

BUILD = H.BUILD
OUT = os.path.join(H.ROOT, 'site')                  # lazily fetched data ships with the site
INLINE = os.path.join(H.ROOT, 'build', 'dist')      # the compact lesson bundle is inlined into index.html by assemble.py
os.makedirs(os.path.join(OUT, 'strokes'), exist_ok=True)
os.makedirs(INLINE, exist_ok=True)
CJK = H.CJK_RE

new = json.load(open(os.path.join(BUILD, 'lessons_new.json'), encoding='utf-8'))
old = json.load(open(os.path.join(BUILD, 'lessons_legacy.json'), encoding='utf-8'))
hsk = H.load_hsk()
QZ = json.load(open(os.path.join(BUILD, 'quiz_zh.json'), encoding='utf-8'))
CY = json.load(open(os.path.join(BUILD, 'chengyu.json'), encoding='utf-8'))
XS = json.load(open(os.path.join(BUILD, 'examples.json'), encoding='utf-8')) if os.path.exists(os.path.join(BUILD, 'examples.json')) else {}

# word level map (official where available; lexicon-defined words keep their lesson-level)
vocab_lv = {}
for L in new:
    for h, m in L['_vocab'].items():
        if m['lv'] is not None and (m['lv'] or h not in vocab_lv):
            vocab_lv[h] = m['lv']
for h, m in QZ['meta'].items():
    if m['lv'] is not None and (m['lv'] or h not in vocab_lv):
        vocab_lv[h] = m['lv']
for w, e in hsk.items():
    vocab_lv.setdefault(w, e['level'])
# words outside the list: level from their parts (plurals, reduplication, compounds); the rest are "beyond HSK" (10)
def _all_tokens():
    for L in new + old:
        for s_ in L['sents']:
            yield from s_['t']
    for rows in QZ['quiz'].values():
        for row in rows:
            for ts in row:
                yield from ts
    for c in CY:
        yield from c['ex']
for t in _all_tokens():
    h = t.get('h')
    if h and vocab_lv.get(h) is None:
        d = A.derive_level(h)
        if d:
            vocab_lv[h] = d

# ---- re-level legacy lessons
for L in old:
    L['source'] = 'Original'
    names = {t['h'] for t in L['speakers']}
    L['_names'] = names
    L['level'] = A.level_estimate(L, vocab_lv)
    L['fixed'] = False
for L in old:
    L.pop('_names')
lessons = new + old

# ---- traditional-character fallback map from the HSK list (most frequent pairing)
cm = collections.defaultdict(collections.Counter)
for w, e in hsk.items():
    for f in e['forms']:
        t = f['trad']
        if len(t) == len(w):
            for a, b in zip(w, t):
                cm[a][b] += 1
t2 = json.load(open(os.path.join(BUILD, 'trad.json'), encoding='utf-8'))['chars']
cmap = {a: c.most_common(1)[0][0] for a, c in cm.items()}
for a, b in t2.items():
    cmap.setdefault(a, b)

def trad_of(tok):
    if tok.get('t') and tok['t'] != tok['h']:
        return tok['t']
    t = ''.join(cmap.get(c, c) for c in tok['h'])
    return t if t != tok['h'] else ''

# ---- reviewed gloss corrections (src/content/gloss_fix.tsv)
GF = H.GlossFix()

# ---- compact lessons
W, WI = [], {}
CUR = [None, None]   # lesson id, sentence index while tokens are being converted
def widx(tok):
    py = ' '.join(tok['py'])
    tok = dict(tok, g=GF.fix(tok['h'], py, tok['g'], CUR[0], CUR[1]))
    lv = vocab_lv.get(tok['h'])
    if lv is None: lv = 10   # beyond the HSK lists
    key = (tok['h'], py, tok['g'], trad_of(tok))
    if key not in WI:
        WI[key] = len(W)
        W.append([tok['h'], py, tok['g'], key[3], lv])
    return WI[key]

def toks(ts):
    return [widx(t) if 'h' in t else t['p'] for t in ts]

def toks_at(lid, si, ts):
    CUR[0], CUR[1] = lid, si
    try:
        return toks(ts)
    finally:
        CUR[0] = CUR[1] = None

TY = {'dialogue': 'd', 'story': 's', 'article': 'a', 'poem': 'p', 'classic': 'c'}
out = []
for L in lessons:
    spk = [t['h'] for t in L['speakers']]
    c = {'i': L['id'], 'l': L['level'], 'y': TY[L['type']], 'c': L.get('topic') or '', 'm': L['minutes'],
         's': L.get('source') or 'Original', 't': toks(L['title']), 'te': L['titleEn'], 'su': L['summary'],
         'sp': toks(L['speakers']),
         'ss': [[spk.index(s['spk']) if s['spk'] in spk else -1, toks_at(L['id'], si, s['t']), s['en']] for si, s in enumerate(L['sents'])],
         'g': [[g['pattern'], g['expl'], g['ex'], g['exEn'], g['keys']] for g in L['grammar']],
         'q': [[q['q'], q['a'], q['w']] for q in L['quiz']]}
    z = QZ['quiz'].get(L['id'])
    if z is not None:
        assert len(z) == len(L['quiz']), f"{L['id']}: quiz_zh has {len(z)} questions, lesson has {len(L['quiz'])}"
        for zi, row in enumerate(z):
            assert len(row) == 2 + len(L['quiz'][zi]['w']), f"{L['id']} Q{zi + 1}: option count differs from the English quiz"
        c['z'] = [[toks(row[0]), toks(row[1]), [toks(x) for x in row[2:]]] for row in z]
    out.append(c)

def difficulty(c):
    ls = [W[i][4] or 9 for s in c['ss'] for i in s[1] if isinstance(i, int)]
    return sum(ls) / max(1, len(ls))
out.sort(key=lambda c: (c['l'], difficulty(c)))
# add sample ex sentence tokens for grammar? (derived in-app)

# ---- chengyu (idioms): inlined, the example sentences share the word table
CT = []
for c in CY:
    if c['topic'] not in CT: CT.append(c['topic'])
cy = [[c['h'], ' '.join(c['py']), c['lit'], c['g'], c['bg'], toks(c['ex']), c['en'], CT.index(c['topic']), c['tier'], trad_of({'h': c['h']})] for c in CY]

lessonchars_ = set(ch for w in W for ch in w[0])
T = {a: b for a, b in cmap.items() if a != b and a in lessonchars_ | set(cmap)}
data = {'W': W, 'L': out, 'T': T, 'CY': cy, 'CT': CT, 'X': {w: x[:2] for w, x in XS.items()}}
js = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
open(os.path.join(INLINE, 'data.json'), 'w', encoding='utf-8').write(js)
print('lessons', len(out), 'words', len(W), 'data.json', len(js.encode()) // 1024, 'KB')
print('by level', sorted(collections.Counter(c['l'] for c in out).items()))

# ---- full vocab (lazy)
V = {str(k): [] for k in range(1, 10)}
for w, e in sorted(hsk.items(), key=lambda kv: kv[1]['freq']):
    f = GF.pin(w, e) or H.lead_form(w, e, A.PRI)
    ms = f['meanings'] or [re.sub(r'\s*\[[^\]]*\]', '', x) for x in f['raw'][:1]]
    g = ''
    for m_ in ms[:3]:
        nxt = m_ if not g else g + '; ' + m_
        if len(nxt) > 110:
            break
        g = nxt
    if not g and ms:
        g = H.clip(ms[0], 110)
    g = GF.vocab_get(w, g)
    V[str(e['level'])].append([w, ' '.join(f['py']), g, f['trad'] if f['trad'] != w else ''])
# a flashcard sentence must read the word the way the HSK list does
def _k(py):
    out = []
    for x in py.split():
        b_, t_ = H.strip_marks(x)
        out.append([b_, 0 if t_ in (0, 5) or b_ in ('yi', 'bu') else t_])        # 一 and 不 change tone in speech
    for i in range(len(out) - 1):
        if out[i][1] == 2 and out[i + 1][1] == 3:                              # third-tone sandhi
            out[i][1] = 3
    return out
lead = {r[0]: r[1] for k_ in V for r in V[k_]}
bad = [(w, x[2], lead[w]) for w, x in XS.items() if w in lead and x[2] and _k(x[2]) != _k(lead[w])]
if bad:
    print('examples that read the word differently from the HSK list:')
    for b_ in bad[:60]:
        print('  %s: sentence %s, list %s' % b_)
    sys.exit(1)
vj = json.dumps(V, ensure_ascii=False, separators=(',', ':'))
open(os.path.join(OUT, 'vocab.json'), 'w', encoding='utf-8').write(vj)
print('vocab', {k: len(v) for k, v in V.items()}, len(vj.encode()) // 1024, 'KB')
stale = GF.unused()
if stale:
    for k_, what, ln in stale:
        print(f'gloss_fix.tsv:{ln}: {k_} {what} matches nothing')
    raise SystemExit('gloss_fix.tsv has rules that no longer apply')

# ---- strokes (lazy, sharded by HSK level of the character)
clv = {}
for w, e in hsk.items():
    for ch in w:
        if CJK.match(ch):
            clv[ch] = min(clv.get(ch, 99), e['level'])
lessonchars = set(ch for c in out for s in c['ss'] for i in s[1] if isinstance(i, int) for ch in W[i][0] if CJK.match(ch))
idiomchars = set(ch for c in CY for ch in c['h'])
want = set(clv) | lessonchars | idiomchars
info = {}
for line in open(os.path.join(H.SRC, 'makemeahanzi', 'dictionary.txt'), encoding='utf-8'):
    d = json.loads(line)
    if d['character'] in want:
        et = d.get('etymology') or {}
        info[d['character']] = [d.get('radical', ''), d.get('decomposition', ''), et.get('type', ''), (et.get('hint') or '')[:90],
                                (et.get('phonetic') or ''), (et.get('semantic') or '')]
shards = collections.defaultdict(dict)
for line in open(os.path.join(H.SRC, 'makemeahanzi', 'graphics.txt'), encoding='utf-8'):
    d = json.loads(line)
    ch = d['character']
    if ch not in want:
        continue
    lv = clv.get(ch, 9)
    sh = str(min(lv, 7))   # shard 7 = levels 7-9 and lesson-only characters
    shards[sh][ch] = [d['strokes'], d['medians']] + [info.get(ch, [])]
tot = 0
for sh, m in shards.items():
    s = json.dumps(m, ensure_ascii=False, separators=(',', ':'))
    open(os.path.join(OUT, 'strokes', f's{sh}.json'), 'w', encoding='utf-8').write(s)
    tot += len(s.encode())
    print('strokes shard', sh, len(m), len(s.encode()) // 1024, 'KB')
missing = want - set(c for m in shards.values() for c in m)
print('chars wanted', len(want), 'missing strokes', len(missing), ''.join(sorted(missing))[:60], 'total MB', round(tot / 1e6, 1))
# char -> shard index for the app
byshard = collections.defaultdict(str)
for ch, sh in sorted(idx.items() if False else {ch: sh for sh, m in shards.items() for ch in m}.items()):
    byshard[sh] += ch
open(os.path.join(OUT, 'chars.json'), 'w', encoding='utf-8').write(json.dumps(byshard, ensure_ascii=False, separators=(',', ':')))
