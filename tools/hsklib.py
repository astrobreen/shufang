"""Shared resources for the annotation pipeline: HSK 3.0 word list, phrase pinyin, helpers.

Sources (all fetched from GitHub):
  drkameleon/complete-hsk-vocabulary  (MIT)   HSK 3.0 levels, CC-CEDICT definitions, frequency
  mozillazg/pinyin-data               (MIT)   single-character readings
  mozillazg/phrase-pinyin-data        (MIT)   phrase readings, used to choose polyphone readings
"""
import json, os, re, math, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
# upstream datasets are fetched by tools/fetch_sources.sh into ./vendor (override with SHUFANG_VENDOR)
SRC = os.environ.get('SHUFANG_VENDOR') or os.path.join(ROOT, 'vendor')
CONTENT = os.path.join(ROOT, 'src', 'content')
BUILD = os.path.join(ROOT, 'build')
os.makedirs(BUILD, exist_ok=True)
CJK_RE = re.compile(r'[㐀-䶿一-鿿豈-﫿]')
CJK_CH = '㐀-䶿一-鿿豈-﫿'

MARKS = {'a': 'āáǎà', 'e': 'ēéěè', 'i': 'īíǐì', 'o': 'ōóǒò', 'u': 'ūúǔù', 'ü': 'ǖǘǚǜ'}
TONE = {}
for b, ms in MARKS.items():
    for i, m in enumerate(ms):
        TONE[m] = (b, i + 1)

SYL = re.compile(
    r'^(b|p|m|f|d|t|n|l|g|k|h|j|q|x|zh|ch|sh|r|z|c|s|y|w)?'
    r'(a|o|e|ai|ei|ao|ou|an|en|ang|eng|ong|er|i|ia|ie|iao|iu|ian|in|iang|ing|iong|'
    r'u|ua|uo|uai|ui|uan|un|uang|ueng|ü|üe|üan|ün)$')
SYL_SPLIT = re.compile(
    r'(?:zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])?(?:[aeiouüv]|[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ])+(?:ng|n|r(?![aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]))?[1-5]?', re.I)


def strip_marks(s):
    """-> (ascii base with ü, tone 0-5)"""
    s = unicodedata.normalize('NFC', s.lower())
    base, tone = '', 5
    for ch in s:
        if ch in TONE:
            base += TONE[ch][0]
            tone = TONE[ch][1]
        else:
            base += ch
    return base.replace('v', 'ü'), tone


def mark(base, tone):
    """ascii-with-ü base + tone 1-5 -> tone-marked syllable"""
    base = base.replace('v', 'ü')
    if tone in (0, 5):
        return base
    vs = [(i, c) for i, c in enumerate(base) if c in 'aeiouü']
    if not vs:
        return base
    pick = None
    for pri in 'aeo':
        for i, c in vs:
            if c == pri:
                pick = i
                break
        if pick is not None:
            break
    if pick is None:
        # iu -> u, ui -> i, else last vowel
        pick = vs[-1][0]
    c = base[pick]
    return base[:pick] + MARKS[c][tone - 1] + base[pick + 1:]


def norm_syl(s):
    """accept 'xue2', 'xué', 'lv4', 'nu:3' -> tone-marked, lowercase. 'r5' -> 'er'."""
    s = s.strip().lower().replace('u:', 'ü')
    m = re.fullmatch(r'([a-zü]+?)([1-5])', s)
    if m:
        base, t = m.group(1).replace('v', 'ü'), int(m.group(2))
        if base == 'r':
            base = 'er'
        base = fix_u(base)
        return mark(base, t)
    base, t = strip_marks(s)
    if base == 'r':
        return 'er'
    return mark(fix_u(base), t) if t != 5 else fix_u(base)


def fix_u(base):
    # nu/lu with ü typed as v is handled by caller; nothing to do for plain syllables
    return base


def check_syllable(s):
    s = unicodedata.normalize('NFC', s)
    base, marks_ = '', []
    for idx, ch in enumerate(s):
        if ch in TONE:
            base += TONE[ch][0]
            marks_.append((idx, TONE[ch][0]))
        else:
            base += ch
    if not re.fullmatch(r'[a-zü]+', base):
        return 'bad characters'
    if re.fullmatch(r'(j|q|x|y)(u|ue|uan|un)', base):
        pass
    elif not SYL.match(base):
        return 'not a valid syllable shape'
    if len(marks_) > 1:
        return 'more than one tone mark'
    if marks_:
        vowels = [(i, c) for i, c in enumerate(base) if c in 'aeiouü']
        want = None
        for pri in 'aeo':
            for i, c in vowels:
                if c == pri:
                    want = i
                    break
            if want is not None:
                break
        if want is None:
            want = vowels[-1][0]
        if marks_[0][0] != want:
            return 'tone mark on wrong vowel'
    return None


_REAL = {}


def real_syllables():
    """the toneless syllables that exist in Mandarin (read from the pinyin data), so 'uo' or 'bun' are never taken for syllables"""
    if not _REAL:
        for line in open(os.path.join(SRC, 'pinyin-data', 'pinyin.txt'), encoding='utf-8'):
            if line.startswith('#') or ':' not in line:
                continue
            for x in re.split(r'[,\s]+', line.split(':', 1)[1].split('#')[0].strip()):
                if x:
                    _REAL[strip_marks(x)[0]] = 1
        for x in ('er', 'm', 'n', 'ng', 'hm', 'hng', 'ê', 'lo', 'yo', 'o'):
            _REAL[x] = 1
    return _REAL


def _valid(cand):
    try:
        n = norm_syl(cand)
    except Exception:
        return None
    b = strip_marks(n)[0]
    if check_syllable(n) is not None or b not in real_syllables() or b[0] in 'iuü':     # a syllable never starts with i, u or ü (they are written y, w, yu)
        return None
    return n


def _segs(chunk, i=0):
    """every way to cut chunk[i:] into valid syllables, longest syllable first"""
    if i >= len(chunk):
        yield []
        return
    for L in range(min(7, len(chunk) - i), 0, -1):
        cand = chunk[i:i + L]
        j = i + L
        if j < len(chunk) and chunk[j] in '12345':
            cand += chunk[j]
            j += 1
        v = _valid(cand)
        if v:
            for rest in _segs(chunk, j):
                yield [v] + rest


def split_pinyin(p, n=None):
    """'bùrú shuō' / 'ài hào' / 'wánr5' / 'lü4' -> list of tone-marked syllables; erhua r -> 'er'.
    Unparseable chunks are returned as-is so validation fails loudly."""
    p = p.strip().lower().replace("'", ' ').replace('’', ' ').replace('˙', '')
    out = []
    failed = False
    for chunk in p.split():
        i = 0
        while i < len(chunk):
            if chunk[i] == 'r' and out and (chunk[i:] in ('r', 'r5')):
                out.append('er')
                break
            got = None
            for L in range(min(7, len(chunk) - i), 0, -1):
                cand = chunk[i:i + L]
                j = i + L
                if j < len(chunk) and chunk[j] in '12345':
                    cand += chunk[j]
                    j += 1
                v = _valid(cand)
                if v:
                    got = (v, j)
                    break
            if not got:
                out.append(chunk[i:])
                failed = True
                break
            out.append(got[0])
            i = got[1]
    if n and (len(out) != n or failed) and ' ' not in p.strip() and 'r' not in p[-2:]:
        for seg in _segs(p.strip().lower()):
            if len(seg) == n:
                return seg
    elif n and (len(out) != n or failed):
        chunks = p.split()
        if all(len(list(_segs(c))) > 0 for c in chunks):
            segs = [[sg for sg in _segs(c)] for c in chunks]
            tot = sum(len(sg[0]) for sg in segs)
            if tot != n:
                # try to find per-chunk cuts whose total is n
                import itertools
                for combo in itertools.product(*[sg[:6] for sg in segs]):
                    if sum(len(x) for x in combo) == n:
                        return [y for x in combo for y in x]
    return out


# ---------------------------------------------------------------- HSK 3.0 word list
JUNK = re.compile(r'^(surname |variant of|old variant|unofficial variant|erhua variant|Japanese variant|see |also written|'
                  r'abbr\. |used in |CL:|archaic|(literary) variant)', re.I)


# senses a learner's word list should not carry: internet/street slang, vulgar or sexual senses, political jokes
SLANG = re.compile(r'slang|kiddie|pornograph|\(derog|\(vulgar|\(euphemism\)|euphemism for|prostitut|erotic|homosexual|'
                   r'menstruat|\banus\b|marijuana|Falun|Islamization|boobies|\(coll\.\) boob', re.I)


def clean_meanings(ms):
    out = []
    for m in ms:
        for seg in re.split(r';\s*', m):
            seg = seg.strip()
            if not seg or JUNK.match(seg) or SLANG.search(seg):
                continue
            seg = re.sub(r'\s*\[[^\]]*\]', '', seg)          # drop [pinyin] references
            seg = re.sub(r'\s*\(\s*\)', '', seg).strip()
            if seg and seg not in out:
                out.append(seg)
    return out


def short_gloss(ms):
    segs = clean_meanings(ms)
    if not segs:
        segs = [re.sub(r'\s*\[[^\]]*\]', '', x).strip() for x in ms if x.strip()][:1]
    if not segs:
        return ''
    g = segs[0]
    if len(segs) > 1 and len(g) + len(segs[1]) <= 26 and not g.startswith('('):
        g += '; ' + segs[1]
    g = g.replace(':', ' -').strip()
    return clip(g)


def clip(g, n=48):
    """shorten a gloss at a natural break (never mid-word, never inside a bracket, never ending on 'of the')"""
    if len(g) <= n:
        return g
    cut = g[:n]
    k = max(cut.rfind(sep) for sep in ('; ', ', ', ' - ', ' ('))
    if k < 12:
        k = cut.rfind(' ')
    if k >= 12:
        cut = cut[:k]
    cut = cut.rstrip(' ,;-:(')
    if cut.count('(') > cut.count(')'):
        p = cut.rfind('(')
        cut = cut[:p].rstrip(' ,;-:') if p >= 12 else cut + ')'
    while True:
        m = re.search(r'\s+(of|the|a|an|to|and|or|in|for|with|on|at|as|by|from|that|which|is|are|etc)$', cut)
        if not m:
            break
        cut = cut[:m.start()].rstrip(' ,;-:')
    return cut


class GlossFix:
    """Reviewed corrections to the glosses (src/content/gloss_fix.tsv).
       w <word> <pinyin> <old gloss> <new gloss>   every token with that exact gloss ('...' at the end of <old> = starts with)
       o <lesson.sentence> <word> <new gloss>       the word in one sentence (sentence numbered from 0, as in the app)
       v <word> <new gloss>                         the HSK list entry
       p <word> <pinyin>                            which reading the HSK list leads with
       A rule that matches nothing is an error, so the file cannot go stale."""

    def __init__(self, path=None):
        self.w, self.o, self.vocab, self.pins, self.used, self.rules = {}, {}, {}, {}, set(), []
        path = path or os.path.join(CONTENT, 'gloss_fix.tsv')
        if not os.path.exists(path):
            return
        for ln, line in enumerate(open(path, encoding='utf-8'), 1):
            line = line.rstrip('\n')
            if not line.strip() or line.startswith('#'):
                continue
            f = line.split('\t')
            k = f[0]
            if k == 'w' and len(f) == 5:
                self.w.setdefault((f[1], f[2]), []).append((f[3].strip(), f[4].strip(), ln))
            elif k == 'o' and len(f) == 4:
                lid, _, si = f[1].rpartition('.')
                self.o[(lid, int(si), f[2])] = (f[3].strip(), ln)
            elif k == 'p' and len(f) == 3:
                self.pins[f[1]] = (f[2].strip(), ln)
            elif k == 'v' and len(f) == 3:
                self.vocab[f[1]] = f[2].strip()
                self.rules.append(('v', f[1], ln))
            else:
                raise SystemExit(f'gloss_fix.tsv:{ln}: cannot read this line')
            self.rules.append((k, f[1] if k != 'o' else f[1] + ' ' + f[2], ln))

    def fix(self, h, py, g, lid=None, si=None):
        r = self.o.get((lid, si, h)) if lid is not None else None
        if r:
            self.used.add(r[1])
            return r[0]
        for old, new, ln in self.w.get((h, py), ()):
            ok = g.startswith(old[:-1]) if old.endswith('…') else g.strip() == old
            if ok:
                self.used.add(ln)
                return new
        return g

    def pin(self, w, e):
        r = self.pins.get(w)
        if not r:
            return None
        for f in e['forms']:
            if ' '.join(f['py']) == r[0]:
                self.used.add(r[1])
                return f
        return None

    def vocab_get(self, w, g, entry_py=None):
        if w in self.vocab:
            self.used.add(next(r[2] for r in self.rules if r[0] == 'v' and r[1] == w))
            return self.vocab[w]
        return g

    def unused(self):
        return [r for r in self.rules if r[2] not in self.used]


_cache = {}


_ODD = re.compile(r'^\(?(onom\.|archaic|old|dialect|Tw|coll\.)\b|\((old|archaic|onom\.|Tw|loanword)\)\s*$|euphemistic|erroneous|Taiwan pr|^\(literary\) variant', re.I)


def _odd(f):
    """a rare, variant or archaic entry that should not lead the HSK list"""
    raw = f['raw'] or []
    return not f['meanings'] or any(JUNK.match(m) or _ODD.search(m) for m in raw[:3])


def lead_form(w, e, pri=None):
    """The form the HSK list leads with. Usually the list's own first form; but when that one is a variant or rare reading
    (比 'bī, euphemistic variant of ...') or a single character whose usual reading is another one (要 yào, not yāo),
    the form with the usual reading. `pri` = hand-written default readings of the common polyphones."""
    fs = e['forms']
    if len(fs) == 1:
        return fs[0]

    def key(x):
        b, t = strip_marks(x)
        return b, (0 if t in (0, 5) else t)

    def match(f, ref):
        return bool(ref) and [key(x) for x in ref] == [key(x) for x in f['py']]
    ref = None
    if len(w) == 1:
        r = (pri or {}).get(w) or load_chars().get(w)
        ref = [norm_syl(r)] if r else None
        if ref and not match(fs[0], ref):
            for f in fs[1:]:
                if match(f, ref) and not _odd(f):
                    return f
    if not _odd(fs[0]):
        return fs[0]
    if len(w) > 1:
        r = load_phrases().get(w)
        ref = [norm_syl(x) for x in r] if r and len(r) == len(w) else None

    def score(f):
        return (3 if match(f, ref) else 0) - (3 if _odd(f) else 0)
    return max(fs, key=score)


def load_hsk():
    if 'hsk' in _cache:
        return _cache['hsk']
    d = json.load(open(os.path.join(SRC, 'complete-hsk-vocabulary', 'complete.json'), encoding='utf-8'))
    f7 = sorted(e['frequency'] for e in d if 'new-7' in e['level'])
    c1, c2 = f7[len(f7) // 3], f7[2 * len(f7) // 3]
    out = {}
    for e in d:
        lv = [int(l.split('-')[1]) for l in e['level'] if l.startswith('new-')]
        if not lv:
            continue
        L = min(lv)
        if L == 7:  # official band 7-9; split by frequency rank (our own estimate)
            L = 7 if e['frequency'] <= c1 else 8 if e['frequency'] <= c2 else 9
        forms = []
        for f in e['forms']:
            py = f['transcriptions']['pinyin']
            if py[:1].isupper() and len(e['forms']) > 1:
                continue
            ms = f['meanings']
            if ms and JUNK.match(ms[0]) and len(e['forms']) > 1 and not clean_meanings(ms):
                continue
            syl = [norm_syl(x) for x in split_pinyin(py, len(re.sub(r'[^\u4e00-\u9fff]', '', e['simplified'])))]
            forms.append({'py': syl, 'meanings': clean_meanings(ms), 'raw': ms, 'trad': f['traditional']})
        if not forms:
            continue
        out[e['simplified']] = {'level': L, 'band7': 'new-7' in e['level'] and not any(
            x for x in e['level'] if x.startswith('new-') and x != 'new-7'), 'freq': e['frequency'], 'pos': e['pos'], 'forms': forms}
    _cache['hsk'] = out
    return out


def load_extra_levels():
    """Words that the 2021 HSK 3.0 list does not carry but the later revision (newest-N) or HSK 2.0 (old-N) does, e.g. 表示, 春.
    Used only to label a word met in a text; they are not added to the word lists. -> {word: level}"""
    if 'extra' in _cache:
        return _cache['extra']
    d = json.load(open(os.path.join(SRC, 'complete-hsk-vocabulary', 'complete.json'), encoding='utf-8'))
    f7 = sorted(e['frequency'] for e in d if 'new-7' in e['level'])
    c1, c2 = f7[len(f7) // 3], f7[2 * len(f7) // 3]
    out = {}
    for e in d:
        if any(l.startswith('new-') for l in e['level']):
            continue
        nw = [int(l.split('-')[1]) for l in e['level'] if l.startswith('newest-')]
        old = [int(l.split('-')[1]) for l in e['level'] if l.startswith('old-')]
        L = min(nw) if nw else min(old) if old else None
        if L is None:
            continue
        if L >= 7:
            L = 7 if e['frequency'] <= c1 else 8 if e['frequency'] <= c2 else 9
        out[e['simplified']] = L
    _cache['extra'] = out
    return out


def load_phrases():
    """phrase -> list of syllables (tone-marked)"""
    if 'ph' in _cache:
        return _cache['ph']
    m = {}
    for fn in ('pinyin.txt', 'cc_cedict.txt'):
        p = os.path.join(SRC, 'phrase-pinyin-data', fn)
        for line in open(p, encoding='utf-8'):
            if line.startswith('#') or ':' not in line:
                continue
            k, v = line.rstrip('\n').split(':', 1)
            k = k.strip()
            if not k or k in m:
                continue
            m[k] = v.split('#')[0].split()
    _cache['ph'] = m
    return m


def load_chars():
    """char -> first reading (tone-marked), from kMandarin_8105 (most common reading) then cc_cedict"""
    if 'ch' in _cache:
        return _cache['ch']
    m = {}
    for fn in ('kMandarin_8105.txt', 'cc_cedict.txt'):
        p = os.path.join(SRC, 'pinyin-data', fn)
        for line in open(p, encoding='utf-8'):
            if line.startswith('#') or ':' not in line:
                continue
            try:
                head, rest = line.split(':', 1)
                py = rest.split('#')[0].strip().split(',')[0]
                ch = chr(int(head.strip()[2:], 16))
            except Exception:
                continue
            if ch not in m and py:
                m[ch] = py
    _cache['ch'] = m
    return m
