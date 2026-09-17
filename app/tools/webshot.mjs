import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
const URL = process.env.APP_URL || 'http://localhost:8090';
const OUT = path.join(process.cwd(), 'tools', 'shots'); fs.mkdirSync(OUT, { recursive: true });
const NAME = process.env.SHOT || 'shot.png';
const LEVEL = process.env.LEVEL || 'NIVEL 2';
const MODE = process.env.MODE || 'PATIO DE MANIOBRAS';
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
await page.setViewport({ width: +(process.env.VW || 390), height: +(process.env.VH || 844), deviceScaleFactor: +(process.env.DSF || 2), isMobile: true, hasTouch: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function tapText(re, t = 10000) { const s = Date.now(); while (Date.now() - s < t) { const h = await page.evaluateHandle((p) => { const rx = new RegExp(p, 'i'); const els = [...document.querySelectorAll('div,span,[role="button"],button')].filter((el) => rx.test((el.innerText || '').trim()) && el.offsetParent !== null); els.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length); return els[0] || null; }, re.source || re); const el = h.asElement(); if (el) { const b = await el.boundingBox(); if (b) { await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); return true; } } await wait(300); } return false; }
async function tapAria(label, t = 12000) { const s = Date.now(); while (Date.now() - s < t) { const box = await page.evaluate((lb) => { const rx = new RegExp('^' + lb + '($|[^0-9])', 'i'); for (const el of document.querySelectorAll('[aria-label]')) { if (!rx.test(el.getAttribute('aria-label') || '')) continue; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue; const r = el.getBoundingClientRect(); if (r.width > 2 && r.height > 2 && r.x >= 0 && r.y >= 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; } return null; }, label); if (box) { await page.mouse.click(box.x, box.y); return true; } await wait(300); } return false; }
// also relax the scroll-until-found check to prefix match

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 120000 }); await wait(3500);
const input = await page.$('input'); if (input) { await input.click(); await input.type('Tester'); }
await tapText(/COMENZAR/); await wait(1600);
if (process.env.STOP === 'settings') {
  const okg = await tapText(/⚙/, 4000);
  if (!okg) { await page.mouse.click(50, 60); } // fallback: top-left gear position
  await wait(1500);
  await page.screenshot({ path: path.join(OUT, NAME) });
  console.log('shot saved (settings): ' + NAME + ' gear=' + okg);
  await browser.close(); process.exit(0);
}
await tapText(new RegExp(MODE)); await wait(1800);
if (process.env.STOP === 'select') { await page.screenshot({ path: path.join(OUT, NAME) }); console.log('shot saved (level-select): ' + NAME); await browser.close(); process.exit(0); }
// Scroll the level grid down until the target level card is present, then tap it.
for (let i = 0; i < 30; i++) {
  // Must be VISIBLE, not merely present: level cards for rows below the fold
  // are already in the DOM, so a DOM-only check exits the loop without
  // scrolling and the later tap silently no-ops (tapAria needs the centre
  // inside the viewport).
  const found = await page.evaluate((lb) => { const rx = new RegExp('^' + lb + '($|[^0-9])', 'i'); return [...document.querySelectorAll('[aria-label]')].some((el) => { if (!rx.test(el.getAttribute('aria-label') || '')) return false; const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2 && r.x >= 0 && r.y >= 0 && r.x + r.width / 2 < innerWidth && r.y + r.height / 2 < innerHeight; }); }, LEVEL);
  if (found) break;
  // Small step on purpose: the visibility check above only matches while the
  // card is fully on screen, and level cards are ~350px tall in a 390px
  // landscape viewport — a big jump skips that window and scrolls to level 100.
  await page.mouse.wheel({ deltaY: 220 }); await wait(250);
}
await tapAria(LEVEL); await wait(3500);
if (process.env.SKIP === '1') { await tapText(/Saltar tutorial/, 2500).catch(() => {}); }
await wait(1200);
await page.screenshot({ path: path.join(OUT, NAME) });
console.log('shot saved: ' + NAME);
await browser.close();
