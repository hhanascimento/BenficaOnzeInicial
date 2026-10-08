/**
 * Layout acceptance check for the "everything fits the screen" layout.
 *
 * It drives the real app in headless Chromium at a range of viewport sizes
 * and fails if any scroller overflows or the pitch/slots escape their box.
 *
 *   npm run dev &                                  # app on :3000
 *   PW=/path/to/playwright node tools/layout-check.mjs [url]
 *
 * PW may be omitted when playwright is resolvable from the project.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || 'playwright');

const URL = process.argv[2] || 'http://localhost:3000/';

const SIZES = [
  [1440, 900], [1280, 800], [1280, 700], [1024, 768], [900, 900],
  [800, 600], [700, 900], [430, 932], [390, 844], [360, 640], [1280, 560],
];

const probe = async (page) => page.evaluate(() => {
  const c = document.querySelector('ion-content.game');
  const inner = c && c.shadowRoot && c.shadowRoot.querySelector('.inner-scroll');
  const pitch = document.querySelector('.pitch');
  const wrap = document.querySelector('.pitchWrap');
  const r = (el) => { const b = el.getBoundingClientRect(); return { w: +b.width.toFixed(1), h: +b.height.toFixed(1), top: +b.top.toFixed(1), bottom: +b.bottom.toFixed(1) }; };
  const slots = [...document.querySelectorAll('.slot__photo, .slot__placeholder')].map((s) => s.getBoundingClientRect());
  const p = pitch ? pitch.getBoundingClientRect() : null;
  const outside = p ? slots.filter((s) => s.left < p.left - 1 || s.right > p.right + 1 || s.top < p.top - 1 || s.bottom > p.bottom + 1).length : 0;
  return {
    doc: { sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight },
    body: { sh: document.body.scrollHeight, ch: document.body.clientHeight },
    content: inner ? { sh: inner.scrollHeight, ch: inner.clientHeight, sw: inner.scrollWidth, cw: inner.clientWidth } : null,
    wrap: wrap ? r(wrap) : null,
    pitch: pitch ? r(pitch) : null,
    outside,
    slots: slots.length,
    suggest: !!document.querySelector('.suggest'),
  };
});

const fails = [];
const browser = await chromium.launch();

for (const [w, h] of SIZES) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.pitch', { timeout: 15000 });

  const steps = [];

  // 1. initial state
  steps.push(['initial', await probe(page)]);

  // 2. autocomplete open (suggestions must not push the layout around)
  await page.click('[data-testid="guess-input"] input, [data-testid="guess-input"]');
  await page.keyboard.type('dia');
  await page.waitForTimeout(150);
  steps.push(['suggestions open', await probe(page)]);

  // 3. wrong guess -> message, 4. right guess -> chips
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);
  steps.push(['wrong guess', await probe(page)]);

  const name = await page.evaluate(() => {
    const s = document.querySelector('.suggest li button');
    return s ? s.textContent : null;
  });
  await page.fill('[data-testid="guess-input"] input', '').catch(() => {});
  if (name) {
    await page.click('[data-testid="guess-input"] input, [data-testid="guess-input"]');
    await page.keyboard.type(name);
    await page.waitForTimeout(120);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    steps.push(['correct guess', await probe(page)]);
  }

  // 5. round over -> the summary card is the tallest state of the screen
  const reveal = page.locator('[data-testid="give-up"]');
  if (await reveal.count()) {
    await reveal.first().click();
    await page.waitForTimeout(450);
    steps.push(['round finished', await probe(page)]);
  }

  // 6. "Novo Jogo" in the header -> a fresh random match, still no scrolling
  const newGame = page.locator('[data-testid="new-game"]');
  if (await newGame.count()) {
    await newGame.first().click();
    await page.waitForTimeout(450);
    steps.push(['new game', await probe(page)]);
  }

  for (const [label, m] of steps) {
    const problems = [];
    if (m.doc.sh > m.doc.ch + 1) problems.push(`document scrolls ${m.doc.sh}>${m.doc.ch}`);
    if (m.body.sh > m.body.ch + 1) problems.push(`body scrolls ${m.body.sh}>${m.body.ch}`);
    if (m.content && m.content.sh > m.content.ch + 1) problems.push(`ion-content scrolls ${m.content.sh}>${m.content.ch}`);
    if (m.content && m.content.sw > m.content.cw + 1) problems.push(`ion-content h-scrolls ${m.content.sw}>${m.content.cw}`);
    if (m.wrap && m.wrap.bottom > m.doc.ch + 1) problems.push(`pitchWrap overflows viewport (bottom ${m.wrap.bottom} > ${m.doc.ch})`);
    // the pitch must always be usable; in the post-round recap the summary
    // card takes priority, so a slightly smaller pitch is accepted there
    const floor = label === 'round finished' ? 110 : 140;
    if (m.pitch && m.pitch.w < floor) problems.push(`pitch too small to play (${m.pitch.w}px wide)`);
    if (label === 'suggestions open' && !m.suggest) problems.push('no suggestion list rendered');
    if (label !== 'suggestions open' && label !== 'correct guess' && m.suggest) problems.push('suggestion list stuck open');
    if (m.outside > 0) problems.push(`${m.outside} player photo(s) clipped by the pitch edge`);
    if (problems.length) fails.push(`${w}x${h} [${label}]: ${problems.join('; ')}`);
    console.log(
      `${w}x${h} [${label}]`.padEnd(30),
      `content ${m.content ? `${m.content.ch}px (sh ${m.content.sh})` : 'n/a'}`.padEnd(26),
      `pitch ${m.pitch ? `${m.pitch.w}x${m.pitch.h}` : 'n/a'}`.padEnd(18),
      `slots ${m.slots}`.padEnd(9),
      problems.length ? `FAIL: ${problems.join('; ')}` : 'ok',
    );
  }
  await page.close();
}

await browser.close();
console.log(fails.length ? `\nFAIL (${fails.length})\n${fails.join('\n')}` : '\nPASS: no scrolling at any tested viewport');
process.exit(fails.length ? 1 : 0);