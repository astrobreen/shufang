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


def _valid(cand):
    try:
        n = norm_syl(cand)
    except Exception:
        return None
    return n if check_syllable(n) is None else None


def split_pinyin(p):
    """'bùrú shuō' / 'ài hào' / 'wánr5' / 'lü4' -> list of tone-marked syllables; erhua r -> 'er'.
    Unparseable chunks are returned as-is so validation fails loudly."""
    p = p.strip().lower().replace("'", ' ').replace('’', ' ').replace('˙', '')
    out = []
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
                break
            out.append(got[0])
            i = got[1]
    return out


# ---------------------------------------------------------------- HSK 3.0 word list
JUNK = re.compile(r'^(surname |variant of|old variant|unofficial variant|erhua variant|Japanese variant|see |also written|'
                  r'abbr\. |used in |CL:|archaic|(literary) variant)', re.I)


def clean_meanings(ms):
    out = []
    for m in ms:
        for seg in re.split(r';\s*', m):
            seg = seg.strip()
            if not seg or JUNK.match(seg):
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
    return g[:48]


_cache = {}


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
            syl = [norm_syl(x) for x in split_pinyin(py)]
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
