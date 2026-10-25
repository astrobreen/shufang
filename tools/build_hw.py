#!/usr/bin/env python3
"""Build site/hw.json: the index the handwriting pad searches.

Each character's stroke centre-lines (Make Me a Hanzi medians, already in site/strokes/*.json) are
normalised the same way src/app/core.js normalises what the user draws (y flipped, centred, longest side
scaled to 1), every stroke is resampled to 8 points, and the coordinates are quantised to one character each.
"""
import glob, json, math, os
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
N, Q, BASE = 8, 90, 35          # points per stroke, quantisation steps, first character code


def resample(pts, n=N):
    seg = [math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) for i in range(1, len(pts))]
    total = sum(seg)
    if total == 0:
        return [list(pts[0]) for _ in range(n)]
    out, j, acc = [], 0, 0.0
    for k in range(n):
        t = total * k / (n - 1)
        while j < len(seg) - 1 and acc + seg[j] < t:
            acc += seg[j]; j += 1
        f = 0 if seg[j] == 0 else min(1, max(0, (t - acc) / seg[j]))
        out.append([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f])
    return out


def normalise(strokes):
    xs = [p[0] for s in strokes for p in s]; ys = [p[1] for s in strokes for p in s]
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    side = max(w, h) or 1
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    return [[[(p[0] - cx) / side, (p[1] - cy) / side] for p in s] for s in strokes]


def enc(v):
    return chr(BASE + max(0, min(Q, round((v + 0.5) * Q))))


def main():
    chars, rows = [], []
    for f in sorted(glob.glob(os.path.join(HERE, 'site', 'strokes', 's*.json'))):
        for ch, d in json.load(open(f, encoding='utf-8')).items():
            med = [[[p[0], -p[1]] for p in m] for m in d[1] if len(m) > 1]
            if not med:
                continue
            chars.append(ch)
            rows.append(''.join(enc(v) for s in normalise(med) for p in resample(s) for v in p))
    out = os.path.join(HERE, 'site', 'hw.json')
    json.dump({'n': N, 'q': Q, 'b': BASE, 'c': ''.join(chars), 's': rows}, open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('hw.json', len(chars), 'characters', round(os.path.getsize(out) / 1e6, 2), 'MB')


if __name__ == '__main__':
    main()
