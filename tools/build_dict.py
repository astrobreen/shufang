#!/usr/bin/env python3
"""CC-CEDICT -> site/dict.json: the dictionary behind the Dictionary tab (fetched on first use, then cached).

Source: CC-CEDICT (CC BY-SA 4.0), the raw cedict_ts.u8 file from krmanik/cedict-json (pinned in tools/fetch_sources.sh).
Each entry is  [simplified, traditional or '', tone-marked pinyin, [definitions], 'measure words' or '']
Definitions have their numbered pinyin converted (ge4 -> gè), traditional|simplified pairs reduced to simplified and
the 'CL:' measure-word list moved into the last field.

  python3 tools/build_dict.py          (needs ./vendor or SHUFANG_VENDOR)
"""
import json, os, re, sys
import hsklib as H

SRC = os.path.join(H.SRC, 'cedict-json', 'cedict_ts.u8')
OUT = os.path.join(H.ROOT, 'site', 'dict.json')
HAN = '㐀-䶿一-鿿豈-﫿\U00020000-\U0002fa1f'
LINE = re.compile(r'^(\S+) (\S+) \[([^\]]*)\] /(.*)/\s*$')
SYL = re.compile(r'^([A-Za-züÜ:]+?)([1-5])$')
PAIR = re.compile('([' + HAN + r']+)\|([' + HAN + r']+)')
BRACKET = re.compile(r'\[([^\]]+)\]')
MAX_DEFS, MAX_DEF_LEN = 14, 220


def syl(tok):
    """'ni3' -> 'nǐ', 'lu:4' -> 'lǜ', 'Zhong1' -> 'Zhōng', 'r5' -> 'r', anything else unchanged"""
    m = SYL.match(tok)
    if not m:
        return tok
    base, tone = m.group(1), int(m.group(2))
    cap = base[0].isupper()
    base = base.lower().replace('u:', 'ü').replace('v', 'ü')
    if base == 'r':
        return 'R' if cap else 'r'
    out = H.mark(base, tone)
    return out[0].upper() + out[1:] if cap else out


def pinyin(s):
    return ' '.join(syl(t) for t in s.split())


def clean(d):
    d = PAIR.sub(lambda m: m.group(2), d)                         # 個|个 -> 个
    d = BRACKET.sub(lambda m: '[' + pinyin(m.group(1)) + ']' if re.search(r'[1-5]\b', m.group(1)) else m.group(0), d)
    return d.strip()


def measure(d):
    out = []
    for item in d[3:].split(','):
        m = re.match(r'\s*(?:\S+?\|)?(\S+?)\[([^\]]+)\]', item)
        if m:
            out.append(m.group(1) + ' ' + pinyin(m.group(2)))
        elif item.strip():
            out.append(clean(item))
    return out


def main():
    if not os.path.exists(SRC):
        sys.exit('missing ' + SRC + '\nRun tools/fetch_sources.sh (or set SHUFANG_VENDOR).')
    entries, seen = [], set()
    for line in open(SRC, encoding='utf-8'):
        if line.startswith('#'):
            continue
        m = LINE.match(line)
        if not m:
            continue
        trad, simp, py, body = m.groups()
        if '\ufffd' in simp or '\ufffd' in trad:      # one upstream entry has a placeholder instead of a character
            continue
        defs, cl = [], []
        for d in body.split('/'):
            d = d.strip()
            if not d:
                continue
            if d.startswith('CL:'):
                cl += measure(d)
            else:
                defs.append(clean(d)[:MAX_DEF_LEN])
        if not defs:
            continue
        e = [simp, trad if trad != simp else '', pinyin(py), defs[:MAX_DEFS], ', '.join(cl)]
        key = (simp, trad, e[2], tuple(e[3]))
        if key in seen:
            continue
        seen.add(key)
        entries.append(e)
    js = json.dumps({'v': 1, 'e': entries}, ensure_ascii=False, separators=(',', ':'))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8').write(js)
    print('dict.json', len(entries), 'entries', round(len(js.encode()) / 1e6, 1), 'MB')


if __name__ == '__main__':
    main()
