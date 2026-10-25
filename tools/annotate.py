#!/usr/bin/env python3
"""Annotate plain-text lessons (Chinese // English per line) into tokens with pinyin, gloss and HSK level.

Source format (texts/*.txt)
---------------------------
@lesson id=h1-01 level=1 type=dialogue topic=Daily life minutes=2 source=Original
@title 你好吗？
@titleen How are you?
@summary One line.
@speakers 小美 大卫                       (dialogues only; names must be in lexicon.tsv)
小美: 你好！你好吗？ // Hello! How are you?
G: pattern ~ explanation ~ example zh ~ example en ~ key1,key2     (keys = exact word tokens)
Q: question ~ correct ~ wrong ~ wrong ~ wrong

Inline hints inside Chinese text:
  /           force a word boundary          我/喜欢
  行[xing2]   force the reading of the preceding N characters (N = number of syllables)
"""
import json, re, sys, glob, os, math
import hsklib as H

CONTENT, BUILD = H.CONTENT, H.BUILD
CJK = H.CJK_CH
errors, warns, amb_log = [], [], []

HSK = H.load_hsk()
EXTRA = H.load_extra_levels()   # labelled but not listed: in HSK 2.0 / the later revision, absent from the 2021 list
PHR = H.load_phrases()
CH1 = H.load_chars()

# ------------------------------------------------------------------ lexicon
LEX = {}      # word -> {'forms':[{'py':[..],'g':str,'m':[..]}], 'level':int|None, 'name':bool}


def load_lexicon():
    _load_lex('lexicon.tsv', LEX)
    _load_lex('lexicon_cl.tsv', LEXCL)


def _load_lex(fn, LEX):
    p = os.path.join(CONTENT, fn)
    if not os.path.exists(p):
        return
    for ln, line in enumerate(open(p, encoding='utf-8'), 1):
        line = line.rstrip('\n')
        if not line.strip() or line.startswith('#'):
            continue
        f = line.split('\t')
        if len(f) < 3:
            errors.append(f'{fn}:{ln}: need word<TAB>pinyin<TAB>gloss')
            continue
        w, py, g = f[0].strip(), f[1].strip(), f[2].strip()
        lv = int(f[3]) if len(f) > 3 and f[3].strip().isdigit() else None  # 0 = proper noun
        syl = H.split_pinyin(py)
        if len(syl) != len(w) or any(H.check_syllable(s) for s in syl):
            errors.append(f'{fn}:{ln}: {w!r} pinyin {py!r} -> {syl} invalid')
            continue
        ent = LEX.setdefault(w, {'forms': [], 'level': lv, 'name': '(name)' in g})
        ent['forms'].append({'py': syl, 'g': g, 'm': [g]})
        if lv is not None:
            ent['level'] = lv


LEGACY = {}
LEXCL = {}
CLS = [False]
CED = {}
COMP = set()


def load_compounds():
    p = os.path.join(CONTENT, 'compounds.txt')
    if os.path.exists(p):
        for line in open(p, encoding='utf-8'):
            w = line.split('#')[0].strip()
            if w:
                COMP.add(w)


def load_cedict():
    """CC-CEDICT (CC BY-SA 4.0) via krmanik/cedict-json: fallback glosses for words outside the HSK list"""
    p = os.path.join(H.SRC, 'cedict-json', 'all_cedict.json')
    if not os.path.exists(p):
        return
    d = json.load(open(p, encoding='utf-8'))
    for w, e in d.items():
        if not re.fullmatch('[' + CJK + ']+', w):
            continue
        forms = []
        for pyn, dfn in e['definitions'].items():
            syl = [H.norm_syl(x) for x in H.split_pinyin(pyn)]
            if len(syl) != len(w) or any(H.check_syllable(x) for x in syl):
                continue
            defs = [x.strip() for x in dfn.split(';') if x.strip()]
            cm = H.clean_meanings([dfn])
            if not cm:
                continue
            proper = pyn[:1].isupper()
            flag = 'CL:' in dfn or '(idiom)' in dfn or '(literary)' in dfn or '(proverb)' in dfn
            forms.append({'py': syl, 'g': H.short_gloss([dfn]), 'm': cm[:4], 't': e.get('traditional') if e.get('traditional') != w else None,
                          'proper': proper, 'flag': flag})
        if forms:
            forms.sort(key=lambda f: f['proper'])   # common meanings before place and personal names (山上 = on the mountain, not a Taiwan township)
            CED[w] = forms


def load_legacy():
    p = os.path.join(BUILD, 'lessons_legacy.json')
    if not os.path.exists(p):
        return
    for L in json.load(open(p, encoding='utf-8')):
        for t in [x for s in L['sents'] for x in s['t']] + L['title'] + L['speakers']:
            if 'h' in t:
                e = LEGACY.setdefault(t['h'], {'forms': []})
                if not any(f['py'] == t['py'] for f in e['forms']):
                    e['forms'].append({'py': t['py'], 'g': t['g'], 'm': [t['g']]})


# ------------------------------------------------------------------ defaults for polyphones
PRI = dict(zip('了的得着地还为会没中发少重给应干教长种数传行好觉乐便空落假难调当都背处倒量差朝参担只省降转将散薄似曾强相累角切什么们子吗吧呢啊咖不一其间藏咽晕模炸塞蒙占',
               ['le', 'de', 'de', 'zhe', 'de', 'hái', 'wèi', 'huì', 'méi', 'zhōng', 'fā', 'shǎo', 'zhòng', 'gěi', 'yīng', 'gàn', 'jiāo', 'cháng', 'zhǒng', 'shù', 'chuán',
                'xíng', 'hǎo', 'jué', 'lè', 'biàn', 'kōng', 'luò', 'jiǎ', 'nán', 'diào', 'dāng', 'dōu', 'bèi', 'chù', 'dào', 'liàng', 'chà', 'cháo', 'cān', 'dān', 'zhī',
                'shěng', 'jiàng', 'zhuǎn', 'jiāng', 'sàn', 'báo', 'sì', 'céng', 'qiáng', 'xiāng', 'lèi', 'jiǎo', 'qiè', 'shén', 'me', 'men', 'zi', 'ma', 'ba', 'ne', 'a',
                'kā', 'bù', 'yī', 'qí', 'jiān', 'cáng', 'yàn', 'yūn', 'mó', 'zhà', 'sāi', 'méng', 'zhàn']))



# ------------------------------------------------------------------ levels for words outside the official list
def derive_level(w):
    """HSK level of a word that is not itself in the list, from the words it is made of; None if it cannot be derived.
    Covers plurals (孩子们), reduplication (试试, 看一看, 高高兴兴) and compounds whose parts are all in the list (好朋友).
    The level is the highest level among the parts."""
    if w in HSK:
        return HSK[w]['level']
    if w in EXTRA:
        return EXTRA[w]
    if len(w) < 2:
        return None
    if w.endswith('们') and len(w) > 2:
        return derive_level(w[:-1])
    if len(w) == 2 and w[0] == w[1]:
        return derive_level(w[0])
    if len(w) == 3 and w[1] in '一了' and w[0] == w[2]:
        return derive_level(w[0])
    if len(w) == 4 and w[0] == w[1] and w[2] == w[3]:      # AABB
        a, b, ab = derive_level(w[0]), derive_level(w[2]), derive_level(w[0] + w[2])
        return ab or (max(a, b) if a and b else None)
    if len(w) == 4 and w[:2] == w[2:]:                     # ABAB
        return derive_level(w[:2])
    # cheapest split into listed words (fewest parts); level = highest part
    best = {0: (0, 0)}
    for i in range(1, len(w) + 1):
        for j in range(i):
            if j in best and (w[j:i] in HSK or w[j:i] in EXTRA) and w[j:i] != w:
                cand = (best[j][0] + 1, max(best[j][1], HSK[w[j:i]]['level'] if w[j:i] in HSK else EXTRA[w[j:i]]))
                if i not in best or cand[0] < best[i][0]:
                    best[i] = cand
    return best[len(w)][1] if len(w) in best else None

# ------------------------------------------------------------------ candidates
def candidates(w):
    """-> list of (source, forms, level, rank) for word w"""
    out = []
    if CLS[0] and w in LEXCL:
        e = LEXCL[w]
        return [('lex', [{'py': f['py'], 'g': f['g'], 'm': f['m'], 't': None} for f in e['forms']], e['level'], 1400)]
    if w in LEX:
        e = LEX[w]
        out.append(('lex', [{'py': f['py'], 'g': f['g'], 'm': f['m'], 't': None} for f in e['forms']], e['level'], 1500))
    if w in HSK:
        e = HSK[w]
        out.append(('hsk', [{'py': f['py'], 'g': H.short_gloss(f['raw']) or (f['meanings'][0] if f['meanings'] else ''),
                             'm': f['meanings'], 't': f['trad']} for f in e['forms']], e['level'], e['freq']))
    if w in LEGACY:
        out.append(('legacy', [dict(f, t=None) for f in LEGACY[w]['forms']], None, 4000))
    if w in CED:
        out.append(('ced', CED[w], 0 if all(f['proper'] for f in CED[w]) else None, 60000))
    return out


KNOWN = set()
MAXW = 8


def coverable(w):
    """can w be split entirely into HSK/lexicon words?"""
    ok = [True] + [False] * len(w)
    for i in range(len(w)):
        if not ok[i]:
            continue
        for j in range(i + 1, min(len(w), i + MAXW) + 1):
            if w[i:j] in HSK or w[i:j] in LEX:
                ok[j] = True
    return ok[len(w)]


_cov = {}


def coverable_c(w):
    if w not in _cov:
        _cov[w] = coverable(w)
    return _cov[w]


def build_known():
    for w in list(LEGACY):
        if w not in HSK and w not in LEX and coverable(w):
            del LEGACY[w]
    KNOWN.update(LEX); KNOWN.update(HSK); KNOWN.update(LEGACY)


def segment(run):
    """min-cost segmentation of a CJK run into known words (single unknown chars allowed at a high cost)"""
    n = len(run)
    INF = 1e9
    best = [INF] * (n + 1)
    back = [None] * (n + 1)
    best[0] = 0
    for i in range(n):
        if best[i] >= INF:
            continue
        for L in range(1, min(MAXW, n - i) + 1):
            w = run[i:i + L]
            if CLS[0] and w in LEXCL:
                c = 0.9
            elif w in LEX:
                c = 0.95 + (0.1 if L == 1 else 0)
            elif w in HSK:
                rank = max(HSK[w]['freq'], 100)
                c = 1.0 + 0.12 * math.log10(rank)
                if L == 2 and rank > 12000:
                    c += 0.9
            elif w in LEGACY:
                c = 3.2
            elif w in COMP:
                c = 2.0
            elif w in CED and L == 1:
                c = 6.0
            elif w in CED and L >= 2 and (not coverable_c(w) or any(f['proper'] or f['flag'] for f in CED[w])):
                c = 2.4 if L == 2 else 2.9 if L <= 4 else 3.4
            elif L == 1:
                c = 6.0
            else:
                continue
            if best[i] + c < best[i + L]:
                best[i + L] = best[i] + c
                back[i + L] = i
    out, j = [], n
    while j > 0:
        i = back[j]
        out.append(run[i:j])
        j = i
    return out[::-1]


# ------------------------------------------------------------------ reading context
def ctx_readings(run):
    """per-char reading votes from the longest phrase match covering each char"""
    n = len(run)
    best = [None] * n
    bestlen = [0] * n
    for s in range(n):
        for L in range(min(8, n - s), 1, -1):
            ph = run[s:s + L]
            syl = PHR.get(ph)
            if syl and len(syl) == L:
                for k in range(L):
                    if L > bestlen[s + k]:
                        bestlen[s + k] = L
                        best[s + k] = syl[k]
    return [(H.norm_syl(x), bestlen[i]) if x else None for i, x in enumerate(best)]


def tone_key(s):
    b, t = H.strip_marks(s)
    return b + str(t)


NONCJK = re.compile('[^' + CJK + ']')


def rule_reading(w, text, st):
    """hand rules for the most common polyphone particles; returns tone-key string or None"""
    if len(w) != 1:
        return None
    prev = text[st - 1] if st > 0 else ''
    nxt = text[st + 1] if st + 1 < len(text) else ''
    end = (not nxt) or bool(NONCJK.match(nxt))
    if w == '得':
        if prev and prev in '我你他她它们咱还就都必' and not end:
            return 'děi'
    if w == '了' and prev in ('不', '得') and end:
        return 'liǎo'
    if w == '长' and nxt == '得':
        return 'zhǎng'
    if w == '着' and prev in '睡找猜' and (end or nxt in '了'):
        return 'zháo'
    if w == '还' and nxt in '钱书款债' and prev not in '我他你':
        return 'huán'
    if w == '过' and prev and prev in '去来看吃做听说写学走到' and (end or nxt in '了吗的吧呢'):
        return 'guo'
    if w == '地' and prev in '土天大':
        return 'dì'
    if w == '没' and nxt in '收':
        return 'mò'
    if w == '只':
        if prev and prev in '一二两三四五六七八九十百千万几每这那哪半':
            return 'zhī'
        if nxt and not end:
            return 'zhǐ'
    if w == '为' and prev and prev in '更较最极尤颇称视认作行成解当堪' and not end:
        return 'wéi'
    if w == '调' and nxt and nxt in '理节和味剂':
        return 'tiáo'
    return None


def choose_form(w, forms, ctx, idx, forced=None, text='', st=0):
    if forced is not None:
        for f in forms:
            if [tone_key(x) for x in f['py']] == [tone_key(x) for x in forced]:
                return f, True
        # reading not in the dictionary (e.g. classical readings): keep the first form's gloss
        return dict(forms[0], py=list(forced)), True
    # merge identical readings (keep first)
    uniq = []
    for f in forms:
        if not any([tone_key(x) for x in u['py']] == [tone_key(x) for x in f['py']] for u in uniq):
            uniq.append(f)
    if len(uniq) == 1:
        return uniq[0], False
    rr = rule_reading(w, text, st)
    if rr:
        for f in uniq:
            if tone_key(f['py'][0]) == tone_key(rr):
                return f, True
    best, bs, bi = None, -99, 0
    for k, f in enumerate(uniq):
        sc = 0
        for j, syl in enumerate(f['py']):
            c = ctx[idx + j] if idx + j < len(ctx) else None
            if c is None:
                continue
            wt = 0.4 if c[1] <= 2 else 0.9
            sc += wt if tone_key(c[0]) == tone_key(syl) else -wt
        if len(w) == 1:
            pri = PRI.get(w) or (CH1.get(w) and H.norm_syl(CH1[w]))
            if pri and tone_key(pri) == tone_key(f['py'][0]):
                sc += 1.0 if w in PRI else 0.8
        if sc > bs:
            best, bs, bi = f, sc, k
    return best, True


# ------------------------------------------------------------------ sentence annotation
HINT2 = re.compile(r'([' + CJK + r']+)\[([^\]]+)\]|\{([' + CJK + r']+)=([^}]*)\}')


def annotate_text(text, where, name_ok=None):
    """-> tokens list ({'h','py','g','t','lv'} or {'p'}), plus word metadata dict"""
    # 1. expand inline hints:  词[pin1 yin1]  forces a reading;  {词=gloss}  forces a one-token word with a given gloss
    forced = {}   # start index in cleaned text -> [length, syllables|None, gloss|None]
    clean = ''
    pos = 0
    for m in HINT2.finditer(text):
        clean += text[pos:m.start()]
        pos = m.end()
        if m.group(1) is not None:
            run = m.group(1)
            syl = H.split_pinyin(m.group(2))
            if len(syl) > len(run) or any(H.check_syllable(s) for s in syl):
                errors.append(f'{where}: bad reading hint {m.group(0)!r}')
                clean += run
                continue
            clean += run
            forced[len(clean) - len(syl)] = [len(syl), syl, None]
        else:
            word, gl = m.group(3), m.group(4).strip()
            if not clean.endswith(word):
                errors.append(f'{where}: gloss hint {{{word}=...}} must directly follow {word!r}')
                continue
            st_ = len(clean) - len(word)
            ent = forced.setdefault(st_, [len(word), None, None])
            if ent[0] != len(word):
                errors.append(f'{where}: gloss hint {word!r} conflicts with a reading hint')
                continue
            ent[2] = gl
    clean += text[pos:]
    # 2. split into CJK runs / others, honouring '/' boundaries
    toks = []
    i = 0
    pieces = []  # (kind, text, offset)
    k = 0
    cur = ''
    cur_off = 0
    kind = None
    for ch in clean:
        isc = bool(re.match('[' + CJK + ']', ch))
        isb = ch == '/'
        if isb:
            if cur:
                pieces.append((kind, cur, cur_off))
            cur, kind = '', None
            continue  # boundary marker is dropped (offset bookkeeping below accounts for it)
        kk = 'c' if isc else 'p'
        if kind != kk:
            if cur:
                pieces.append((kind, cur, cur_off))
            cur, kind, cur_off = '', kk, k
        if not cur:
            cur_off = k
        cur += ch
        k += 1
    if cur:
        pieces.append((kind, cur, cur_off))
    # forced hints were indexed in `clean` (with '/'); recompute offsets on slash-free text
    noslash = clean.replace('/', '')
    # map hint offsets (index in clean) to noslash index
    def to_ns(idx):
        return idx - clean[:idx].count('/')
    forced_ns = {to_ns(s): v for s, v in forced.items()}
    cjk_only = ''.join(ch if re.match('[' + CJK + ']', ch) else '\u0000' for ch in noslash)
    ctx_full = []
    # context per CJK run in noslash coordinates
    ctx_full = [None] * len(noslash)
    for m in re.finditer('[' + CJK + ']+', noslash):
        c = ctx_readings(m.group(0))
        for j, v in enumerate(c):
            ctx_full[m.start() + j] = v
    meta = {}
    for kind, text_, off in pieces:
        if kind == 'p':
            toks.append({'p': text_})
            continue
        # split run further at forced-hint boundaries
        cuts = sorted({off} | {s for s, v in forced_ns.items() if off <= s < off + len(text_)} |
                      {s + v[0] for s, v in forced_ns.items() if off < s + v[0] < off + len(text_)})
        cuts.append(off + len(text_))
        for a, b in zip(cuts, cuts[1:]):
            sub = noslash[a:b]
            if a in forced_ns and forced_ns[a][0] == len(sub):
                words = [(sub, a, forced_ns[a][1])]
            else:
                words, p_ = [], a
                for w in segment(sub):
                    words.append((w, p_, None))
                    p_ += len(w)
            for w, st, fr in words:
                cands = candidates(w)
                if not cands and st in forced_ns and forced_ns[st][2]:
                    syl_ = fr or ([H.norm_syl(CH1[w])] if len(w) == 1 and w in CH1 else None)
                    if syl_ and len(syl_) == len(w):
                        cands = [('hint', [{'py': syl_, 'g': forced_ns[st][2], 'm': [forced_ns[st][2]], 't': None}], 9, 90000)]
                if not cands:
                    ch = CH1.get(w)
                    errors.append(f'{where}: unknown word {w!r} (suggested pinyin {ch or "?"}) - add it to lexicon.tsv')
                    toks.append({'h': w, 'py': [H.norm_syl(ch)] if ch else ['?'], 'g': '?'})
                    continue
                # merge candidate forms: lexicon first, then HSK, then legacy
                forms = []
                lv = None
                for src, fs, l, rank in cands:
                    if lv is None and l is not None:
                        lv = l
                    for f in fs:
                        forms.append(dict(f, src=src))
                f, was_amb = choose_form(w, forms, ctx_full, st, fr, noslash, st)
                if f is None:
                    errors.append(f'{where}: no form of {w!r} matches reading hint {fr}')
                    continue
                if f['py'] and len(f['py']) != len(w):
                    errors.append(f'{where}: {w!r} has {len(f["py"])} syllables')
                g = f.get('g') or (f['m'][0] if f['m'] else '')
                if not g:
                    errors.append(f'{where}: {w!r} has no gloss')
                if st in forced_ns and forced_ns[st][2]:
                    g = forced_ns[st][2]
                tok = {'h': w, 'py': list(f['py']), 'g': g}
                if f.get('t') and f['t'] != w:
                    tok['t'] = f['t']
                toks.append(tok)
                if lv is None:
                    lv = derive_level(w)
                meta[w] = {'lv': lv, 'm': f['m'][:4] if f['m'] else [g], 'src': f['src']}
                if was_amb or len({tuple(tone_key(x) for x in ff['py']) for ff in forms}) > 1:
                    if len({tuple(tone_key(x) for x in ff['py']) for ff in forms}) > 1:
                        amb_log.append((where, w, ''.join(f['py']), [''.join(ff['py']) for ff in forms][:4]))
    toks = merge_numerals(toks, meta)
    sandhi(toks)
    return toks, meta


NUMCH = '零〇一二三四五六七八九十百千万'
DIG = {'零': 0, '〇': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9}


def numeral_value(s):
    """value of a Chinese numeral string, or None if it is not a plain numeral"""
    if not s or any(c not in NUMCH for c in s):
        return None
    if all(c in DIG for c in s):
        return int(''.join(str(DIG[c]) for c in s)) if len(s) <= 4 else None
    total, cur, sec = 0, None, 0
    units = {'十': 10, '百': 100, '千': 1000}
    i = 0
    val = 0
    cur = 0
    for c in s:
        if c in DIG:
            cur = DIG[c]
        elif c in units:
            val += (cur if cur else (1 if c == '十' else 0)) * units[c]
            cur = 0
            if c != '十' and cur == 0 and val == 0:
                return None
        elif c == '万':
            return None
    val += cur
    return val


def merge_numerals(toks, meta):
    out, i = [], 0
    while i < len(toks):
        t = toks[i]
        if 'h' in t and t['h'] and all(c in NUMCH for c in t['h']):
            j = i
            s_ = ''
            while j < len(toks) and 'h' in toks[j] and all(c in NUMCH for c in toks[j]['h']):
                s_ += toks[j]['h']
                j += 1
            # a trailing digit that begins a measure (e.g. 一个) is not a numeral run, so only merge when >=2 tokens/chars
            v = numeral_value(s_) if len(s_) >= 2 else None
            if v is not None and j - i >= 1 and len(s_) >= 2 and not (s_ == '一一'):
                py = [x for k in range(i, j) for x in toks[k]['py']]
                out.append({'h': s_, 'py': py, 'g': str(v)})
                meta[s_] = {'lv': 1 if v < 100 else 2, 'm': [str(v)], 'src': 'num'}
                i = j
                continue
        out.append(t)
        i += 1
    return out


def sandhi(toks):
    """Write 不 and 一 tone changes into the pinyin (bú, yí / yì), the way textbooks print them."""
    flat = []   # (token, index within token)
    for t in toks:
        if 'h' in t:
            for j in range(len(t['h'])):
                flat.append((t, j))
        else:
            flat.append((t, None))

    def tone_of(t, j):
        if j is None:
            return None
        b, tn = H.strip_marks(t['py'][j])
        return tn

    for i, (t, j) in enumerate(flat):
        if j is None:
            continue
        ch = t['h'][j]
        if ch not in '不一':
            continue
        nxt = flat[i + 1] if i + 1 < len(flat) else None
        if not nxt or nxt[1] is None:
            continue
        prev_ch = flat[i - 1][0]['h'][flat[i - 1][1]] if i > 0 and flat[i - 1][1] is not None else ''
        nch = nxt[0]['h'][nxt[1]]
        nt = tone_of(*nxt)
        b, tn = H.strip_marks(t['py'][j])
        if ch == '不' and tn == 4 and b == 'bu' and nt == 4:
            t['py'][j] = 'bú'
        elif ch == '一' and b == 'yi' and tn == 1:
            if prev_ch and prev_ch in '第零二三四五六七八九十百千万':
                continue
            if nch in '零一二三四五六七八九十月号日' and ch + nch != '一下':
                continue
            if ch + nch == '一楼':   # ground floor: an ordinal, read yī
                continue
            if nt == 4:
                t['py'][j] = 'yí'
            elif nt in (1, 2, 3):
                t['py'][j] = 'yì'
            else:
                pass


# ------------------------------------------------------------------ file parsing
def parse_file(path, lessons):
    cur = None
    base = os.path.basename(path)
    for ln, line in enumerate(open(path, encoding='utf-8'), 1):
        line = line.rstrip('\n')
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        where = f'{base}:{ln}'
        if line.startswith('@lesson'):
            kv = dict(re.findall(r'(\w+)=([^=]+?)(?=\s+\w+=|$)', line[len('@lesson'):].strip()))
            cur = {'id': kv.get('id'), 'level': int(kv.get('level', 0)), 'type': kv.get('type'),
                   'topic': kv.get('topic'), 'minutes': int(kv.get('minutes', 2)), 'source': kv.get('source', 'Original'),
                   'fixed': kv.get('fixed') == '1' or kv.get('type') in ('poem', 'classic'),
                   'title': [], 'titleEn': '', 'summary': '', 'speakers': [], 'sents': [], 'grammar': [], 'quiz': [], '_meta': {}}
            lessons.append(cur)
            CLS[0] = cur['type'] in ('poem', 'classic')
            continue
        if cur is None:
            errors.append(f'{where}: content before @lesson')
            continue
        if line.startswith('@title '):
            cur['title'], m = annotate_text(line[7:].strip(), where)
            cur['_meta'].update(m)
        elif line.startswith('@titleen '):
            cur['titleEn'] = line[9:].strip()
        elif line.startswith('@summary '):
            cur['summary'] = line[9:].strip()
        elif line.startswith('@speakers '):
            for nm in line[10:].split():
                toks, m = annotate_text(nm, where)
                cur['speakers'] += toks
                cur['_meta'].update(m)
        elif line.startswith('G:'):
            f = [x.strip() for x in line[2:].split('~')]
            if len(f) != 5:
                errors.append(f'{where}: G needs 5 fields, has {len(f)}')
            else:
                cur['grammar'].append({'pattern': f[0], 'expl': f[1], 'ex': f[2], 'exEn': f[3],
                                       'keys': [k.strip() for k in f[4].split(',') if k.strip()]})
        elif line.startswith('Q:'):
            f = [x.strip() for x in line[2:].split('~')]
            if len(f) < 4 or len(f) > 5:
                errors.append(f'{where}: Q needs 4-5 fields')
            else:
                cur['quiz'].append({'q': f[0], 'a': f[1], 'w': f[2:]})
        else:
            if '//' not in line:
                errors.append(f'{where}: sentence needs "chinese // english": {line[:40]!r}')
                continue
            zh, en = [x.strip() for x in line.split('//', 1)]
            spk = None
            m = re.match(r'^([^\s:：]{1,6})[:：]\s*(.*)$', zh)
            if m and any(s.get('h') == m.group(1) for s in cur['speakers']):
                spk, zh = m.group(1), m.group(2)
            elif m and cur['type'] == 'dialogue':
                errors.append(f'{where}: speaker {m.group(1)!r} not declared in @speakers')
            toks, meta = annotate_text(zh, where)
            cur['_meta'].update(meta)
            cur['sents'].append({'spk': spk, 't': toks, 'en': en})


def finish(lessons):
    ids = set()
    for L in lessons:
        w = L['id']
        if w in ids:
            errors.append(f'duplicate lesson id {w}')
        ids.add(w)
        if not (1 <= L['level'] <= 9):
            errors.append(f'{w}: bad level {L["level"]}')
        if L['type'] not in ('dialogue', 'story', 'article', 'poem', 'classic'):
            errors.append(f'{w}: bad type {L["type"]}')
        if not L['title'] or not L['titleEn']:
            errors.append(f'{w}: missing title')
        if not L['sents']:
            errors.append(f'{w}: no sentences')
        for i, s in enumerate(L['sents']):
            if not s['en']:
                errors.append(f'{w}: sentence {i+1} has no translation')
            if L['type'] == 'dialogue' and not s['spk']:
                errors.append(f'{w}: dialogue sentence {i+1} has no speaker')
        if len(L['quiz']) < 3:
            errors.append(f'{w}: needs at least 3 quiz questions')
        for q in L['quiz']:
            if q['a'] in q['w'] or len(set(q['w'])) != len(q['w']):
                errors.append(f'{w}: quiz question has duplicate/overlapping options: {q["q"][:40]!r}')
        words = set(t['h'] for s in L['sents'] for t in s['t'] if 'h' in t)
        for g in L['grammar']:
            for k in g['keys']:
                if k not in words:
                    errors.append(f'{w}: grammar key {k!r} is not exactly one token; tokens with those chars: {sorted(x for x in words if any(c in x for c in k))[:8]}')
        for t in [x for s in L['sents'] for x in s['t']] + L['title']:
            if 'h' in t:
                for syl in t['py']:
                    e = H.check_syllable(syl)
                    if e:
                        errors.append(f'{w}: {t["h"]!r} syllable {syl!r}: {e}')


def level_estimate(L, vocab_lv, thr=0.90):
    """lowest HSK level at which >= thr of the word tokens (names excluded) are in the list up to that level.
    Words that are in no HSK list count as level 9."""
    lv = []
    for s in L['sents']:
        for t in s['t']:
            if 'h' in t and t['h'] not in L['_names']:
                v_ = vocab_lv.get(t['h'])
                if v_ == 0:
                    continue
                lv.append(v_ or 9)
    if not lv:
        return 1
    for k in range(1, 10):
        if sum(1 for x in lv if x <= k) / len(lv) >= thr:
            return k
    return 9


def report_levels(lessons):
    """per lesson: coverage at declared level and the words above it (dev aid: python3 annotate.py --above)"""
    for L in lessons:
        lv = {}
        for h, m in L['_vocab'].items():
            lv[h] = m['lv']
        toks = [t['h'] for s in L['sents'] for t in s['t'] if 'h' in t]
        names = {t['h'] for t in L['speakers']}
        toks = [h for h in toks if h not in names and lv.get(h) != 0]
        above = []
        for h in toks:
            if (lv.get(h) or 9) > L['level'] and h not in above:
                above.append(h)
        ok = sum(1 for h in toks if (lv.get(h) or 9) <= L['level']) / max(1, len(toks))
        print(f"{L['id']} L{L['level']} {ok*100:.0f}% | " + ' '.join(f'{h}{lv.get(h) or 9}' for h in above))


def split_report(lessons):
    seen = {}
    for L in lessons:
        for s_ in L['sents']:
            ts = [t for t in s_['t'] if 'h' in t]
            idx = [i for i, t in enumerate(s_['t'])]
            toks = s_['t']
            for i in range(len(toks)):
                for n in (2, 3):
                    seg = toks[i:i + n]
                    if len(seg) < n or any('h' not in t for t in seg):
                        continue
                    w = ''.join(t['h'] for t in seg)
                    if w in CED and w not in HSK and w not in COMP and len(w) <= 4:
                        seen.setdefault(w, (CED[w][0]['g'], L['id']))
    for w, (g, lid) in sorted(seen.items()):
        print(f'  {w}\t{g[:40]}\t{lid}')



def load_quiz_zh():
    """src/content/quiz_zh.txt -> ({lesson id: [[question, correct, wrong...] as token lists]}, word meta).
    One block per lesson ("@id"), one line per question in the order of the Q: lines: question ~ correct ~ wrong ~ wrong."""
    fn = os.path.join(CONTENT, 'quiz_zh.txt')
    out, meta, cur = {}, {}, None
    if not os.path.exists(fn):
        return out, meta
    for n, line in enumerate(open(fn, encoding='utf-8'), 1):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('@'):
            cur = line[1:].strip()
            out[cur] = []
            continue
        where = f'quiz_zh.txt:{n}'
        parts = [x.strip() for x in line.split('~')]
        if cur is None or len(parts) < 3 or len(parts) > 5:
            errors.append(f'{where}: a question needs 3-5 fields')
            continue
        row = []
        for x in parts:
            toks, m = annotate_text(x, where)
            row.append(toks)
            meta.update(m)
        out[cur].append(row)
    return out, meta

def load_chengyu():
    """src/content/chengyu.txt -> list of idiom records.  Pinyin comes from the same annotator as the lessons."""
    fn = os.path.join(CONTENT, 'chengyu.txt')
    out, topic, seen = [], None, set()
    if not os.path.exists(fn):
        return out
    for n, line in enumerate(open(fn, encoding='utf-8'), 1):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if line.startswith('@'):
            topic = line[1:].strip()
            continue
        where = f'chengyu.txt:{n}'
        f = [x.strip() for x in line.split(' | ')]
        if topic is None or len(f) != 7:
            errors.append(f'{where}: expected 7 fields, got {len(f)}')
            continue
        h_raw, lit, g, bg, ex, en, tier = f
        h = re.sub(r'\[[^\]]*\]', '', h_raw)     # 词[pin1 yin1] pins a reading
        if not re.fullmatch(r'[\u4e00-\u9fff]{4}', h):
            errors.append(f'{where}: {h!r} is not four characters')
            continue
        if h in seen:
            errors.append(f'{where}: duplicate idiom {h}')
        seen.add(h)
        if tier not in ('1', '2', '3'):
            errors.append(f'{where}: tier must be 1, 2 or 3')
            continue
        if h not in ex:
            errors.append(f'{where}: the example does not contain {h}')
        ht, _ = annotate_text(h_raw, where)
        py = [s_ for t in ht if t.get('h') for s_ in t['py']]
        if len(py) != 4:
            errors.append(f'{where}: could not read {h} (got {py})')
            continue
        et, _ = annotate_text(ex, where)
        out.append({'h': h, 'py': py, 'lit': lit, 'g': g, 'bg': bg, 'ex': et, 'en': en, 'topic': topic, 'tier': int(tier)})
    return out

def main():
    load_lexicon(); load_legacy(); load_cedict(); load_compounds(); build_known()
    lessons = []
    for f in sorted(glob.glob(os.path.join(CONTENT, 'texts', '*.txt'))):
        parse_file(f, lessons)
    finish(lessons)
    quiz_zh, quiz_meta = load_quiz_zh()
    chengyu = load_chengyu()
    for L in lessons:
        L['_names'] = {t['h'] for t in L['speakers']}
        if L['id'] in quiz_zh and len(quiz_zh[L['id']]) != len(L['quiz']):
            errors.append(f"{L['id']}: quiz_zh has {len(quiz_zh[L['id']])} questions, the lesson has {len(L['quiz'])}")
    # level estimates
    vocab_lv = {}
    for L in lessons:
        for h, m in L['_meta'].items():
            if m['lv'] is not None and (m['lv'] or h not in vocab_lv):
                vocab_lv[h] = m['lv']
    rep = []
    for L in lessons:
        est = level_estimate(L, vocab_lv)
        rep.append((L['id'], L['level'], est))
        L['target'] = L['level']
        if not L.get('fixed'):
            L['level'] = est
        L['est'] = est
    if '--levels' in sys.argv:
        for r in rep:
            print(*r)
    if warns:
        print(f'{len(warns)} level warning(s):')
        for w in warns:
            print('  ' + w)
    with open(os.path.join(BUILD, 'amb_report.txt'), 'w', encoding='utf-8') as fh:
        for a in amb_log:
            fh.write(f'{a[0]}\t{a[1]}\t{a[2]}\t{" | ".join(a[3])}\n')
    if errors:
        print(f'{len(errors)} problem(s):')
        seen = set()
        for e in errors:
            k = re.sub(r'^[^:]+:\d+: ', '', e)
            if k in seen and 'unknown word' in e:
                continue
            seen.add(k)
            print('  ' + e)
        if '--force' not in sys.argv:
            sys.exit(1)
    for L in lessons:
        L['_vocab'] = L.pop('_meta')
        L.pop('_names', None)
    json.dump(lessons, open(os.path.join(BUILD, 'lessons_new.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    json.dump({'quiz': quiz_zh, 'meta': {h: {'lv': m['lv']} for h, m in quiz_meta.items()}},
              open(os.path.join(BUILD, 'quiz_zh.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    json.dump(chengyu, open(os.path.join(BUILD, 'chengyu.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'{len(chengyu)} chengyu')
    if '--splits' in sys.argv:
        split_report(lessons)
    if '--above' in sys.argv:
        report_levels(lessons)
    print(f'OK: {len(lessons)} lessons, {sum(len(L["sents"]) for L in lessons)} sentences')




if __name__ == '__main__':
    main()
