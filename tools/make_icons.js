#!/usr/bin/env node
// Draws the Shufang icon and renders every size.  Needs playwright (npm i -D playwright).  Only run when the icon changes.
//   node tools/make_icons.js
// Writes site/icons/* (web + PWA) and android/app/src/main/res/mipmap-* (launcher icons).
//
// The glyph 书 (the shu of Shufang 书房, "study" or "book") comes from Make Me a Hanzi (Arphic Public License).  Its box is measured once (GLYPH below, in the
// font's own 1000-unit space, y pointing up) and the glyph is centred on its *bounding box*, so it sits in the middle
// of the tile whatever the font's side bearings are.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'site', 'icons');
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');

const PATHS = fs.readFileSync(path.join(__dirname, 'glyph-shu.txt'), 'utf8').trim();
const GLYPH = { x: 155.609, y: -54.444, w: 735.276, h: 870.694 };   // bounding box of PATHS (font units, y up)
const CREAM = '#FFF3E6', RED1 = '#DE3C2E', RED2 = '#B01F13';

// the glyph, centred on (256,256), `h` px tall
function glyph(h, fill, shadow) {
  const s = h / GLYPH.h;
  const cx = GLYPH.x + GLYPH.w / 2, cy = 900 - (GLYPH.y + GLYPH.h / 2);       // visual centre once flipped
  const g = `<g transform="translate(${(256 - cx * s).toFixed(2)} ${(256 - cy * s).toFixed(2)}) scale(${s.toFixed(5)})"><g transform="scale(1,-1) translate(0,-900)" fill="${fill}">${PATHS}</g></g>`;
  return shadow ? `<g filter="url(#sh)">${g}</g>` : g;
}
// 米字格, the writing grid: a cross and two diagonals, dashed
function grid(half, op) {
  const a = 256 - half, b = 256 + half, d = half * 0.96;
  return `<g stroke="${CREAM}" stroke-opacity="${op}" stroke-width="3.2" stroke-dasharray="9 9" stroke-linecap="round" fill="none">` +
    `<path d="M256 ${a} V${b} M${a} 256 H${b}"/><path d="M${256 - d} ${256 - d} L${256 + d} ${256 + d} M${256 + d} ${256 - d} L${256 - d} ${256 + d}" stroke-opacity="${op * 0.6}"/></g>`;
}
const defs = `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${RED1}"/><stop offset="1" stop-color="${RED2}"/></linearGradient>` +
  `<radialGradient id="glow" cx=".3" cy=".18" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
  `<filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="7" stdDeviation="8" flood-color="#5A0A04" flood-opacity=".35"/></filter></defs>`;
const svg = (body, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"${extra}>${defs}${body}</svg>`;
const tile = (rx) => `<rect width="512" height="512" rx="${rx}" fill="url(#bg)"/><rect width="512" height="512" rx="${rx}" fill="url(#glow)"/>`;

const art = {
  // rounded tile with a seal-like inner frame
  any: svg(tile(112) + `<rect x="38" y="38" width="436" height="436" rx="80" fill="none" stroke="${CREAM}" stroke-opacity=".32" stroke-width="5"/>` + grid(176, 0.2) + glyph(304, CREAM, true)),
  // full-bleed art for masks (maskable PWA icon, iOS): the glyph stays inside the central 60%
  full: svg(tile(0) + grid(150, 0.2) + glyph(268, CREAM, true)),
  // Android adaptive layers (108dp canvas, 66dp safe circle)
  fg: svg(grid(118, 0.24) + glyph(228, CREAM, true)),
  bg: svg(tile(0)),
  mono: svg(glyph(228, '#000', false)),
  round: svg(`<clipPath id="c"><circle cx="256" cy="256" r="256"/></clipPath><g clip-path="url(#c)">${tile(0)}${grid(150, 0.2)}${glyph(256, CREAM, true)}</g>`)
};

const jobs = [
  [art.any, path.join(OUT, 'icon.svg'), null], [art.full, path.join(OUT, 'icon-maskable.svg'), null], [art.full, path.join(OUT, 'icon-apple.svg'), null],
  [art.any, path.join(OUT, 'icon-192.png'), 192], [art.any, path.join(OUT, 'icon-512.png'), 512],
  [art.full, path.join(OUT, 'icon-maskable-512.png'), 512], [art.full, path.join(OUT, 'apple-touch-icon.png'), 180]
];
const D = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
if (fs.existsSync(path.join(ROOT, 'android'))) {
  for (const [d, k] of Object.entries(D)) {
    const dir = path.join(RES, 'mipmap-' + d);
    jobs.push([art.any, path.join(dir, 'ic_launcher.png'), Math.round(48 * k)]);
    jobs.push([art.round, path.join(dir, 'ic_launcher_round.png'), Math.round(48 * k)]);
    jobs.push([art.fg, path.join(dir, 'ic_launcher_foreground.png'), Math.round(108 * k)]);
    jobs.push([art.bg, path.join(dir, 'ic_launcher_background.png'), Math.round(108 * k)]);
    jobs.push([art.mono, path.join(dir, 'ic_launcher_monochrome.png'), Math.round(108 * k)]);
  }
}

(async () => {
  const b = await chromium.launch();
  for (const [markup, file, n] of jobs) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (n === null) { fs.writeFileSync(file, markup); continue; }
    const p = await b.newPage({ viewport: { width: n, height: n } });
    await p.setContent(`<body style="margin:0;background:transparent">${markup.replace('<svg ', `<svg width="${n}" height="${n}" `)}</body>`);
    await p.screenshot({ path: file, omitBackground: true });
    await p.close();
  }
  await b.close();
  console.log(jobs.length + ' files written');
})();
