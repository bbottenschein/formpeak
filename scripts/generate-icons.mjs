/**
 * Erzeugt App-Symbole aus dem Logo (Gipfel über „FP“) mit Playwright:
 *   node scripts/generate-icons.mjs
 * Schreibt nach public/icons/ (inkl. Favicon). Braucht Internet für die Schrift.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'public/icons/');
const POINTS = "0,160 198,0 290,88 330,60 435,155 328,95 288,128 196,55";
const FONT = '<link href="https://fonts.googleapis.com/css2?family=Barlow:ital,wght@1,800&display=block" rel="stylesheet">';
// App-Symbol: Gipfel über „FP“ (F weiß, P Limette), Inhalt auf (1 − pad) der Fläche.
const icon = (size, pad, bg = '#121110') => `<!doctype html><html><head>${FONT}<style>
html,body{margin:0}body{width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:${bg}}
.box{width:${size * (1 - pad)}px;display:flex;flex-direction:column;align-items:center}
svg{width:${size * (1 - pad) * 0.78}px;height:${size * (1 - pad) * 0.29}px;color:#bfff00;margin-bottom:-${size * (1 - pad) * 0.06}px;margin-left:${size * (1 - pad) * 0.04}px}
span{font-family:Barlow;font-weight:800;font-style:italic;font-size:${size * (1 - pad) * 0.6}px;line-height:1;color:#efebe4;letter-spacing:-0.03em}
i{color:#bfff00}</style></head><body><div class="box">
<svg viewBox="0 0 435 160" preserveAspectRatio="none"><polygon fill="currentColor" points="${POINTS}"/></svg>
<span>F<i>P</i></span></div></body></html>`;
// Benachrichtigungs-Badge: nur der Gipfel, weiß auf transparent.
const badge = (size) => `<!doctype html><html><head><style>html,body{margin:0;background:transparent}
body{width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center}
svg{width:${size * 0.86}px;height:${size * 0.4}px}</style></head><body>
<svg viewBox="0 0 435 160" preserveAspectRatio="none"><polygon fill="#fff" points="${POINTS}"/></svg></body></html>`;
(async () => {
  const b = await chromium.launch();
  const shot = async (content, size, file, omitBackground = false) => {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(content, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: OUT + file, omitBackground });
    await p.close();
  };
  await shot(icon(192, 0.2), 192, 'icon-192.png');
  await shot(icon(512, 0.2), 512, 'icon-512.png');
  await shot(icon(512, 0.38), 512, 'icon-maskable-512.png');
  await shot(icon(180, 0.2), 180, 'apple-touch-icon.png');
  await shot(icon(64, 0.08), 64, 'favicon-64.png');
  await shot(badge(96), 96, 'badge-96.png', true);
  await b.close();
  console.log('ok');
})();
