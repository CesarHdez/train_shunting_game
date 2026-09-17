// Captures frames of a shunting move animation (landscape 844x390).
// Usage: node tools/animshot.mjs   (env: LEVEL, PREFIX, SEL="x,y", DST="x,y")
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const URL = process.env.APP_URL || 'http://localhost:8090';
const OUT = path.join(process.cwd(), 'tools', 'shots');
fs.mkdirSync(OUT, { recursive: true });
const LEVEL = process.env.LEVEL || 'NIVEL 4';
const PREFIX = process.env.PREFIX || 'switchback';
const [selX, selY] = (process.env.SEL || '338,221').split(',').map(Number);
const [dstX, dstY] = (process.env.DST || '283,158').split(',').map(Number);

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function tapText(re, t = 10000) {
  const s = Date.now();
  while (Date.now() - s < t) {
    const h = await page.evaluateHandle((p) => {
      const rx = new RegExp(p, 'i');
      const els = [...document.querySelectorAll('div,span,[role="button"],button')].filter((el) => rx.test((el.innerText || '').trim()) && el.offsetParent !== null);
      els.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length);
      return els[0] || null;
    }, re.source || re);
    const el = h.asElement();
    if (el) { const b = await el.boundingBox(); if (b) { await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); return true; } }
    await wait(300);
  }
  return false;
}
async function tapAria(label, t = 12000) {
  const s = Date.now();
  while (Date.now() - s < t) {
    const box = await page.evaluate((lb) => {
      const rx = new RegExp('^' + lb + '($|[^0-9])', 'i');
      for (const el of document.querySelectorAll('[aria-label]')) {
        if (!rx.test(el.getAttribute('aria-label') || '')) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 2 && r.height > 2 && r.x >= 0 && r.y >= 0 && r.x + r.width / 2 < innerWidth && r.y + r.height / 2 < innerHeight) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }
      return null;
    }, label);
    if (box) { await page.mouse.click(box.x, box.y); return true; }
    await wait(300);
  }
  return false;
}

try {
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 120000 });
  await wait(3500);
  const input = await page.$('input');
  if (input) { await input.click(); await input.type('Tester'); }
  await tapText(/COMENZAR/); await wait(1600);
  await tapText(/PATIO DE MANIOBRAS/); await wait(1800);
  console.log('enter=' + (await tapAria(LEVEL)));
  await wait(3500);
  await tapText(/Saltar tutorial/, 1500).catch(() => {});
  await wait(800);
  await page.screenshot({ path: path.join(OUT, `${PREFIX}-0-start.png`) });
  // Screencast streams frames continuously — far denser than page.screenshot().
  // ENTRY=1 records the FIRST tap (placing the locomotive, which now rolls in
  // from off-frame); otherwise it records the second tap (the move itself).
  const entryMode = process.env.ENTRY === '1';
  const cdp = await page.createCDPSession();
  const frames = [];
  let t0 = Date.now();
  cdp.on('Page.screencastFrame', async (f) => {
    frames.push({ t: Date.now() - t0, data: f.data });
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });

  if (entryMode) {
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, everyNthFrame: 1 });
    t0 = Date.now();
    await page.mouse.click(selX, selY);
    await wait(+(process.env.CAPTURE_MS || 4000));
  } else {
    await page.mouse.click(selX, selY);
    await wait(900);
    await page.screenshot({ path: path.join(OUT, `${PREFIX}-1-selected.png`) });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, everyNthFrame: 1 });
    t0 = Date.now();
    await page.mouse.click(dstX, dstY);
    await wait(+(process.env.CAPTURE_MS || 4000));
  }
  await cdp.send('Page.stopScreencast');
  for (const old of fs.readdirSync(OUT).filter((n) => n.startsWith(`${PREFIX}-f`))) fs.unlinkSync(path.join(OUT, old));
  frames.forEach((f, i) => fs.writeFileSync(path.join(OUT, `${PREFIX}-f${String(i).padStart(3, '0')}.jpg`), Buffer.from(f.data, 'base64')));
  console.log(`frames=${frames.length} times=${frames.map((f) => f.t).join(',')}`);
  await wait(1000);
  await page.screenshot({ path: path.join(OUT, `${PREFIX}-9-end.png`) });
} catch (e) {
  console.log('SCRIPT ERROR: ' + e.message);
} finally {
  await browser.close();
}
