#!/usr/bin/env python3
"""Parse lesson DSL files in content/, validate them, emit lessons.json.

DSL
---
@lesson id=n01 level=1 type=dialogue topic=Daily life minutes=2
@title  tokens...            (tokens separated by ';')
@titleen English title
@summary One line English summary
@speakers 小美:xiǎo měi:Xiaomei; 大卫:dà wèi:David
S[小美]: tokens...           (speaker optional)
T: English translation of the sentence above
G: pattern ~ explanation ~ example zh ~ example en ~ key1,key2
Q: question ~ correct ~ wrong1 ~ wrong2 [~ wrong3]

Token = hanzi:pinyin with spaces between syllables:gloss   OR bare punctuation.
"""
import json, re, sys, glob, unicodedata, os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(HERE, 'build')
CONTENT = os.path.join(HERE, 'src', 'content', 'legacy')
CJK = re.compile(r'[㐀-䶿一-鿿豈-﫿]')

TONE = {}
for base, marks in {'a': 'āáǎà', 'e': 'ēéěè', 'i': 'īíǐì', 'o': 'ōóǒò', 'u': 'ūúǔù', 'ü': 'ǖǘǚǜ'}.items():
    for i, m in enumerate(marks):
        TONE[m] = (base, i + 1)

SYL = re.compile(
    r'^(b|p|m|f|d|t|n|l|g|k|h|j|q|x|zh|ch|sh|r|z|c|s|y|w)?'
    r'(a|o|e|ai|ei|ao|ou|an|en|ang|eng|ong|er|i|ia|ie|iao|iu|ian|in|iang|ing|iong|'
    r'u|ua|uo|uai|ui|uan|un|uang|ueng|ü|üe|üan|ün)$')


def check_syllable(s):
    """Return error string or None. s is one tone-marked syllable."""
    s = unicodedata.normalize('NFC', s)
    base = ''
    marks = []
    for idx, ch in enumerate(s):
        if ch in TONE:
            base += TONE[ch][0]
            marks.append((idx, TONE[ch][0]))
        else:
            base += ch
    if not re.fullmatch(r'[a-zü]+', base):
        return 'bad characters'
    # after j/q/x/y the umlaut is written as plain u: ju qu xu yu, jue que xue yue, juan quan xuan yuan, jun qun xun yun
    if re.fullmatch(r'(j|q|x|y)(u|ue|uan|un)', base):
        pass
    elif not SYL.match(base):
        return 'not a valid syllable shape'
    if len(marks) > 1:
        return 'more than one tone mark'
    if marks:
        # find where the mark should be
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
        if marks[0][0] != want:
            return 'tone mark on wrong vowel'
    return None


def parse_tokens(line, where, errors):
    toks = []
    for raw in line.split(';'):
        raw = raw.strip()
        if not raw:
            continue
        if ':' not in raw:
            if CJK.search(raw):
                errors.append(f'{where}: CJK token without pinyin: {raw!r}')
            toks.append({'p': raw})  # punctuation
            continue
        parts = raw.split(':')
        if len(parts) != 3:
            errors.append(f'{where}: token needs hanzi:pinyin:gloss -> {raw!r}')
            continue
        h, py, gl = [x.strip() for x in parts]
        sy = py.split()
        n = len(CJK.findall(h))
        if len(sy) != n or n != len(h):
            errors.append(f'{where}: {h!r} has {len(h)} chars / {n} cjk but {len(sy)} syllables ({py!r})')
        for s in sy:
            e = check_syllable(s)
            if e:
                errors.append(f'{where}: {h!r} syllable {s!r}: {e}')
        if not gl:
            errors.append(f'{where}: {h!r} has empty gloss')
        toks.append({'h': h, 'py': sy, 'g': gl})
    return toks


def parse_file(path, errors, lessons):
    cur = None
    last_s = None
    for ln, line in enumerate(open(path, encoding='utf-8'), 1):
        line = line.rstrip('\n')
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        where = f'{os.path.basename(path)}:{ln}'
        if line.startswith('@lesson'):
            kv = dict(re.findall(r'(\w+)=([^=]+?)(?=\s+\w+=|$)', line[len('@lesson'):].strip()))
            cur = {'id': kv.get('id'), 'level': int(kv.get('level', 0)), 'type': kv.get('type'),
                   'topic': kv.get('topic'), 'minutes': int(kv.get('minutes', 2)),
                   'title': [], 'titleEn': '', 'summary': '', 'speakers': [], 'sents': [],
                   'grammar': [], 'quiz': []}
            lessons.append(cur)
            last_s = None
            continue
        if cur is None:
            errors.append(f'{where}: content before @lesson')
            continue
        if line.startswith('@title '):
            cur['title'] = parse_tokens(line[7:], where, errors)
        elif line.startswith('@titleen '):
            cur['titleEn'] = line[9:].strip()
        elif line.startswith('@summary '):
            cur['summary'] = line[9:].strip()
        elif line.startswith('@speakers '):
            cur['speakers'] = parse_tokens(line[10:], where, errors)
        elif line.startswith('S'):
            m = re.match(r'^S(?:\[(.*?)\])?:\s*(.*)$', line)
            if not m:
                errors.append(f'{where}: bad sentence line')
                continue
            last_s = {'spk': m.group(1), 't': parse_tokens(m.group(2), where, errors), 'en': ''}
            if m.group(1) and not any(s['h'] == m.group(1) for s in cur['speakers'] if 'h' in s):
                errors.append(f'{where}: speaker {m.group(1)!r} not declared in @speakers')
            cur['sents'].append(last_s)
        elif line.startswith('T:'):
            if last_s is None:
                errors.append(f'{where}: T: before any S:')
            else:
                last_s['en'] = line[2:].strip()
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
            errors.append(f'{where}: unrecognised line: {line[:40]!r}')


def main():
    errors, lessons = [], []
    files = sorted(glob.glob(os.path.join(CONTENT, '*.txt')))
    for f in files:
        parse_file(f, errors, lessons)
    ids = set()
    for L in lessons:
        w = L['id']
        if w in ids:
            errors.append(f'duplicate lesson id {w}')
        ids.add(w)
        if not (1 <= L['level'] <= 6):
            errors.append(f'{w}: bad level')
        if L['type'] not in ('dialogue', 'story', 'article'):
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
        if not L['grammar']:
            errors.append(f'{w}: no grammar notes')
        if len(L['quiz']) < 3:
            errors.append(f'{w}: needs at least 3 quiz questions')
        words = set(t['h'] for s in L['sents'] for t in s['t'] if 'h' in t)
        for g in L['grammar']:
            for k in g['keys']:
                if k not in words:
                    errors.append(f'{w}: grammar key {k!r} is not exactly one token in the text')
    if errors:
        print(f'{len(errors)} problem(s):')
        for e in errors:
            print('  ' + e)
        if '--force' not in sys.argv:
            sys.exit(1)
    out = os.path.join(BUILD, 'lessons_legacy.json')
    json.dump(lessons, open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    chars = set(c for L in lessons for s in L['sents'] for t in s['t'] for c in t.get('h', '') if CJK.match(c))
    for L in lessons:
        for t in L['title'] + L['speakers']:
            for c in t.get('h', ''):
                if CJK.match(c):
                    chars.add(c)
    json.dump(sorted(chars), open(os.path.join(BUILD, 'chars_legacy.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    nt = sum(1 for L in lessons for s in L['sents'] for t in s['t'] if 'h' in t)
    print(f'OK: {len(lessons)} lessons, {sum(len(L["sents"]) for L in lessons)} sentences, {nt} word tokens, {len(chars)} distinct characters')
    for lv in range(1, 7):
        ls = [L for L in lessons if L['level'] == lv]
        print(f'  level {lv}: {len(ls)} lessons', [L['id'] for L in ls])


if __name__ == '__main__':
    main()
