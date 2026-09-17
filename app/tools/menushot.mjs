// Captures the 5 non-gameplay screens (Login, ModeSelect, Settings, LevelSelect, Leaderboard).
// Navigates by aria-label, not by emoji text — the re-skin replaced every glyph with an SVG icon.
// Usage: node tools/menushot.mjs   (env: PREFIX, VW, VH, DSF)
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const URL = process.env.APP_URL || 'http://localhost:8090';
const OUT = path.join(process.cwd(), 'tools', 'shots');
fs.mkdirSync(OUT, { recursive: true });
const PREFIX = process.env.PREFIX || 'menu';

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport({
  width: +(process.env.VW || 844), height: +(process.env.VH || 390),
  deviceScaleFactor: +(process.env.DSF || 2), isMobile: true, hasTouch: true,
});
await page.evaluateOnNewDocument(() => {
  window.__errs = [];
  window.addEventListener('error', (e) => window.__errs.push(String(e.message)));
  window.addEventListener('unhandledrejection', (e) => window.__errs.push(String((e.reason && e.reason.message) || e.reason)));
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => page.screenshot({ path: path.join(OUT, `${PREFIX}-${n}.png`) });

async function tapAria(label, t = 6000) {
  const s = Date.now();
  while (Date.now() - s < t) {
    const box = await page.evaluate((lb) => {
      const rx = new RegExp(lb, 'i');
      for (const el of document.querySelectorAll('[aria-label]')) {
        if (!rx.test(el.getAttribute('aria-label') || '')) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
        const r = el.getBoundingClientRect();
        if (r.width > 2 && r.height > 2 && r.x >= 0 && r.y >= 0 && r.x + r.width / 2 < innerWidth && r.y + r.height / 2 < innerHeight)
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }
      return null;
    }, label);
    if (box) { await page.mouse.click(box.x, box.y); return true; }
    await wait(250);
  }
  return false;
}
async function tapText(re, t = 6000) {
  const s = Date.now();
  while (Date.now() - s < t) {
    const h = await page.evaluateHandle((p) => {
      const rx = new RegExp(p, 'i');
      const els = [...document.querySelectorAll('div,span,[role="button"],button')]
        .filter((el) => rx.test((el.innerText || '').trim()) && el.offsetParent !== null);
      els.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length);
      return els[0] || null;
    }, re.source || re);
    const el = h.asElement();
    if (el) { const b = await el.boundingBox(); if (b) { await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); return true; } }
    await wait(250);
  }
  return false;
}

try {
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 120000 });
} catch (e) {
  console.log('GOTO ERROR: ' + e.message);
}
try {
  await wait(4000);
  await shot('1-login');
  console.log('login shot');

  const input = await page.$('input');
  if (input) { await input.click(); await input.type('Camila'); }
  await wait(400);
  await shot('1b-login-filled');
  console.log('COMENZAR=' + (await tapText(/COMENZAR/)));
  await wait(2000);
  await shot('2-modeselect');

  console.log('AJUSTES=' + (await tapAria('AJUSTES')));
  await wait(1800);
  await shot('3-settings');

  console.log('back=' + ((await tapAria('Volver')) || (await tapText(/VOLVER/))));
  await wait(1800);

  console.log('mode=' + (await tapAria('PATIO DE MANIOBRAS')));
  await wait(2000);
  await shot('4-levelselect');

  console.log('puntajes=' + (await tapAria('Ver tabla de puntajes')));
  await wait(2200);
  await shot('5-leaderboard');

  const errs = await page.evaluate(() => window.__errs || []);
  console.log(`errors=${errs.length}` + (errs.length ? ': ' + errs.slice(0, 5).join(' | ') : ''));
} catch (e) {
  console.log('SCRIPT ERROR: ' + e.message);
} finally {
  await browser.close();
}
