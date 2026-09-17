// Wins NIVEL 1 (1 move) and exercises the win-summary card's dismiss/reopen paths.
// Usage: node tools/winshot.mjs
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const URL = process.env.APP_URL || 'http://localhost:8090';
const OUT = path.join(process.cwd(), 'tools', 'shots');
fs.mkdirSync(OUT, { recursive: true });
const PREFIX = process.env.PREFIX || 'win';

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => page.screenshot({ path: path.join(OUT, `${PREFIX}-${n}.png`) });

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
async function tapAria(label, t = 8000) {
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
const arias = () => page.evaluate(() => [...document.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label')));
const hasText = (s) => page.evaluate((t) => (document.body.innerText || '').toUpperCase().includes(t), s.toUpperCase());

try {
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 120000 });
  await wait(3500);
  const input = await page.$('input');
  if (input) { await input.click(); await input.type('Tester'); }
  await tapText(/COMENZAR/); await wait(1600);
  await tapText(/PATIO DE MANIOBRAS/); await wait(1800);
  console.log('enter=' + (await tapAria('NIVEL 1')));
  await wait(3500);
  await tapText(/Saltar tutorial/, 3000);
  await wait(1200);
  await shot('0-board');
  // Level 1: A sits alone on the near (bottom) track, B on the middle track.
  // Tapping A selects loco+A; tapping the middle row deposits it before B → win.
  await page.mouse.click(328, 294);
  await wait(1000);
  await page.mouse.click(400, 221);
  await wait(4000);
  await shot('1-card');
  console.log('card visible=' + (await hasText('COMPLETADO')));
  // The card is taller than a 390dp landscape viewport: scroll its ScrollView
  // so the action row (REPETIR / MENÚ / SIGUIENTE / COMPARTIR) is captured too.
  // The card is far taller than a 390dp landscape viewport (title, stars, two
  // pills, stats, a 10-row leaderboard, then the action row), so scroll its
  // ScrollView all the way down in several ticks before capturing the buttons.
  await page.mouse.move(422, 220);
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel({ deltaY: 400 });
    await wait(180);
  }
  await wait(600);
  await shot('1b-card-bottom');
  console.log('arias with card: ' + JSON.stringify(await arias()));
  console.log('close=' + (await tapAria('Cerrar resultados')));
  await wait(1200);
  await shot('2-closed');
  console.log('card after close=' + (await hasText('COMPLETADO')));
  console.log('arias after close: ' + JSON.stringify(await arias()));
  const reopened = (await tapAria('Ver resultados')) || (await tapText(/RESULTADOS/, 3000));
  console.log('reopen=' + reopened);
  await wait(1200);
  await shot('3-reopened');
  console.log('card after reopen=' + (await hasText('COMPLETADO')));
  // Backdrop tap: top-left corner, well clear of the centred card.
  await page.mouse.click(12, 200);
  await wait(1200);
  await shot('4-backdrop-closed');
  console.log('card after backdrop tap=' + (await hasText('COMPLETADO')));
} catch (e) {
  console.log('SCRIPT ERROR: ' + e.message);
} finally {
  await browser.close();
}
