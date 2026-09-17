import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const URL = process.env.APP_URL || 'http://localhost:8090';
const OUT = path.join(process.cwd(), 'tools', 'shots');
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: 'new',
  args: [
    '--no-sandbox',
    '--enable-unsafe-swiftshader', // Chrome gates SwiftShader WebGL behind this flag
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
  ],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.evaluateOnNewDocument(() => {
  window.__errs = [];
  const rec = (m, s) => window.__errs.push({ m: String(m), s: s ? String(s) : '' });
  window.addEventListener('error', (e) => rec(e.message, e.error && e.error.stack));
  window.addEventListener('unhandledrejection', (e) => rec(e.reason && e.reason.message || e.reason, e.reason && e.reason.stack));
  const oe = console.error; console.error = (...a) => { const er = a.find((x) => x && x.stack); rec(a.map((x) => (x && x.message) || String(x)).join(' '), er && er.stack); return oe.apply(console, a); };
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function tapText(re, t = 10000) {
  const s = Date.now();
  while (Date.now() - s < t) {
    const h = await page.evaluateHandle((p) => {
      const rx = new RegExp(p, 'i');
      const els = Array.from(document.querySelectorAll('div,span,[role="button"],button'));
      const m = els.filter((el) => rx.test((el.innerText || '').trim()) && el.offsetParent !== null);
      m.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length);
      return m[0] || null;
    }, re.source || re);
    const el = h.asElement();
    if (el) { const b = await el.boundingBox(); if (b) { await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); return true; } }
    await wait(300);
  }
  return false;
}
async function ariaRects(label) {
  return page.evaluate((lb) => {
    const vw = window.innerWidth, vh = window.innerHeight;
    return Array.from(document.querySelectorAll(`[aria-label="${lb}"]`)).map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), vis: cs.visibility, disp: cs.display, op: cs.opacity, inVP: r.x >= 0 && r.y >= 0 && r.x < vw && r.y < vh };
    });
  }, label);
}
async function tapAria(label, t = 12000) {
  const s = Date.now();
  while (Date.now() - s < t) {
    const box = await page.evaluate((lb) => {
      const vw = window.innerWidth, vh = window.innerHeight;
      const els = Array.from(document.querySelectorAll(`[aria-label="${lb}"]`));
      for (const el of els) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
        const r = el.getBoundingClientRect();
        if (r.width > 2 && r.height > 2 && r.x >= 0 && r.y >= 0 && r.x < vw && r.y < vh) {
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }
      }
      return null;
    }, label);
    if (box) { await page.mouse.click(box.x, box.y); return true; }
    await wait(300);
  }
  return false;
}
const canvases = () => page.evaluate(() => Array.from(document.querySelectorAll('canvas')).map((c) => ({ w: c.width, h: c.height, cssW: c.clientWidth, cssH: c.clientHeight })));

// probe whether a real WebGL context is available in this headless env
async function webglOk() {
  return page.evaluate(() => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    return !!gl;
  });
}
// count non-black pixels inside the largest canvas via a screenshot clip
async function boardPixels() {
  const box = await page.evaluate(() => {
    const cs = Array.from(document.querySelectorAll('canvas'));
    if (!cs.length) return null;
    cs.sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight);
    const r = cs[0].getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  if (!box || box.w < 4 || box.h < 4) return { box, nonBlack: -1 };
  const buf = await page.screenshot({ clip: { x: box.x, y: box.y, width: box.w, height: box.h } });
  // decode PNG minimally via sharp-free approach: count bytes that are clearly non-dark in the raw PNG is unreliable,
  // so instead re-open via the browser: draw the screenshot into a 2d canvas and sample.
  const b64 = buf.toString('base64');
  const nonBlack = await page.evaluate(async (data) => {
    const img = new Image();
    await new Promise((res) => { img.onload = res; img.src = 'data:image/png;base64,' + data; });
    const cv = document.createElement('canvas'); cv.width = Math.min(img.width, 300); cv.height = Math.min(img.height, 300);
    const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 20 || d[i + 1] > 20 || d[i + 2] > 20) n++;
    return n;
  }, b64);
  return { box, nonBlack };
}

try {
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 120000 });
  await wait(3500);
  console.log('WEBGL available = ' + await webglOk());
  const input = await page.$('input');
  if (input) { await input.click(); await input.type('Tester'); }
  console.log('COMENZAR=' + await tapText(/COMENZAR/)); await wait(2000);
  console.log('MANIOBRAS=' + await tapText(/PATIO DE MANIOBRAS/)); await wait(3000);
  await page.screenshot({ path: path.join(OUT, 'debug-levelselect.png') });
  const dbg = await page.evaluate(() => ({
    text: (document.body.innerText || '').replace(/\n+/g, ' | ').slice(0, 220),
    arias: Array.from(document.querySelectorAll('[aria-label]')).map((e) => e.getAttribute('aria-label')).slice(0, 12),
  }));
  console.log('LEVELSELECT text: ' + dbg.text);
  console.log('LEVELSELECT arias: ' + JSON.stringify(dbg.arias));
  console.log('NIVEL 1 rects: ' + JSON.stringify(await ariaRects('NIVEL 1')));

  for (const lvl of [1, 2, 3]) {
    console.log(`\n--- LEVEL ${lvl} ---`);
    const entered = await tapAria(`NIVEL ${lvl}`, 12000);
    console.log('enter=' + entered);
    await wait(4500);
    if (lvl === 1) { await tapText(/Saltar tutorial/); await wait(2500); }
    await page.screenshot({ path: path.join(OUT, `fixed-level-${lvl}.png`) });
    console.log('canvases=' + JSON.stringify(await canvases()));
    const bp = await boardPixels();
    console.log(`boardPixels: nonBlack=${bp.nonBlack} box=${JSON.stringify(bp.box)}`);
    // back to level select for the next iteration (icon button has aria-label "MENÚ")
    const back = (await tapAria('MENÚ', 4000)) || (await tapText(/← MENÚ|MENÚ|MENU/, 3000));
    console.log('back=' + back);
    await wait(2500);
  }
  const errs = await page.evaluate(() => window.__errs || []);
  const fontErrs = errs.filter((e) => /Not implemented on React Native Web/i.test(e.m));
  console.log(`\n=== ERRORS total=${errs.length}, "Not implemented on RN Web"=${fontErrs.length} ===`);
  for (const e of errs.slice(0, 8)) console.log(`- ${e.m}`);
} catch (e) {
  console.log('SCRIPT ERROR: ' + e.message);
} finally {
  await browser.close();
}
