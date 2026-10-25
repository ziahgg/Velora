// End-to-end check of the core hotel booking flow on the Expo web build, in
// headless Chrome, using the demo backend (fresh browser profile every run).
//
//   1. npm run web -- --port 8092      (in another terminal)
//   2. npm run e2e:web                 (BASE_URL defaults to http://localhost:8092)
//
// Saves a 390×844 @2x screenshot of every step to e2e-screens/ and exits
// non-zero on the first failed assertion.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { launch, sleep } from './cdp.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:8092';
const OUT = join(process.cwd(), 'e2e-screens');
mkdirSync(OUT, { recursive: true });

const helpers = `
  window.__tap = (prefix) => {
    const els = [...document.querySelectorAll('[aria-label],[role=button],[role=tab],[role=radio],[role=checkbox]')]
      .filter((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().startsWith(prefix) && e.getBoundingClientRect().width > 0);
    const el = els.pop();
    if (!el) throw new Error('Not found: ' + prefix);
    el.click();
    return true;
  };
  window.__text = () => document.body.innerText;
`;

const page = await launch(9341);
await page.size(390, 844, 2);
let step = 0;
const steps = [];

async function check(name, fn) {
  step += 1;
  const label = `${String(step).padStart(2, '0')}-${name}`;
  try {
    await fn();
    await page.shot(join(OUT, `${label}.png`));
    steps.push(`ok   ${label}`);
    console.log(`ok   ${label}`);
  } catch (e) {
    await page.shot(join(OUT, `${label}-FAILED.png`)).catch(() => undefined);
    console.log(`FAIL ${label}: ${e.message}`);
    page.close();
    process.exit(1);
  }
}

const js = (code) => page.eval(helpers + code);
const expectText = async (re, what) => {
  const t = await js('__text()');
  if (!re.test(t)) throw new Error(`expected ${what ?? re}`);
};
const expectPath = async (re) => {
  const p = await js('location.pathname');
  if (!re.test(p)) throw new Error(`expected path ${re}, got ${p}`);
};

await page.goto(BASE + '/', 9000);
await check('onboarding', async () => {
  await expectPath(/onboarding/);
  await expectText(/Stay somewhere/);
});
await check('sign-in', async () => {
  await js(`__tap('Skip')`);
  await sleep(1200);
  await expectPath(/sign-in/);
});
await check('home', async () => {
  await js(`__tap('Demo mode')`);
  await sleep(300);
  await js(`__tap('Sign in')`);
  await sleep(3000);
  await expectPath(/^\/$/);
  await expectText(/Where would you like/);
  await expectText(/Featured destinations/);
});
await check('hotel-detail', async () => {
  await js(`__tap('Grand Horizon Villa & Spa, Uluwatu')`);
  await sleep(1500);
  await expectPath(/hotel\/grand-horizon$/);
  await expectText(/\$579/, 'party-aware price $579');
});
await check('room-selection', async () => {
  await js(`__tap('Select room')`);
  await sleep(1500);
  await expectText(/Continue · \$2,316 for 4 nights/);
});
await check('review', async () => {
  await js(`__tap('Continue · $2,316')`);
  await sleep(1500);
  await expectPath(/booking\/review/);
  await expectText(/\$2,647\.60/, 'total $2,647.60');
});
await check('review-validation', async () => {
  await js(`__tap('Continue to Payment')`);
  await sleep(600);
  await expectPath(/booking\/review/); // terms not accepted → stays here
});
await check('payment', async () => {
  await js(`document.querySelector('[role=checkbox]').click()`);
  await sleep(300);
  await js(`__tap('Continue to Payment')`);
  await sleep(2500);
  await expectPath(/booking\/payment/);
  await expectText(/Amount Due/);
  await expectText(/holding your room/);
});
await check('payment-declined', async () => {
  await js(`__tap('Test card · declines')`);
  await sleep(300);
  await js(`__tap('Pay $2,647.60')`);
  await sleep(3500);
  await expectPath(/booking\/declined/);
  await expectText(/haven’t been charged/);
});
await check('confirmed', async () => {
  await js(`__tap('Try another method')`);
  await sleep(1800);
  await js(`__tap('Pay $2,647.60')`);
  await sleep(3500);
  await expectPath(/booking\/confirmed/);
  await expectText(/Booking confirmed!/);
  await expectText(/VLR-\d{5}/);
});
await check('trips-after-restart', async () => {
  await page.goto(BASE + '/trips', 6000); // full reload: data must come from storage
  await expectText(/Grand Horizon Villa & Spa/);
  await expectText(/Confirmed/);
});
await check('voucher', async () => {
  await js(`[...document.querySelectorAll('[role=button]')].find((e) => e.textContent === 'View voucher').click()`);
  await sleep(1500);
  await expectPath(/trip\//);
  await expectText(/Paid · Apple Pay/);
});

console.log(`\n${steps.length} steps passed. Screenshots: ${OUT}`);
page.close();
await sleep(200);
