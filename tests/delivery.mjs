import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, devices } from 'playwright';
import { parseBackup } from '../src/lib/backup.ts';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const BASE = opt('--base-url', 'http://127.0.0.1:5188');
const OUTPUT = resolve(opt('--output', 'evidence/delivery-results.json'));
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const sourceText = await readFile(resolve('public/presente/inicial.json'), 'utf8');
const initial = parseBackup(sourceText);
const initialGift = initial.state.find(record => record.key === 'gift-content').value;
const report = { suite: 'Entrega automática do presente inicial', startedAt: new Date().toISOString(), baseUrl: BASE, physicalIPhoneVerified: false, device: 'Chromium mobile touch, iPhone 13 emulado 390x844', publicGiftFileSha256: hash(sourceText), contentLogged: false, results: [], pageErrors: [], consoleErrors: [], limitations: ['Não usa iPhone físico. Offline é uma interrupção real da conectividade da sessão do navegador local.', 'Carta, bilhetes e nomes não são escritos na evidência; comparações usam hashes.'] };
let browser, context, page;
async function writeReport() { await mkdir(resolve('evidence'), { recursive: true }); await writeFile(OUTPUT, JSON.stringify(report, null, 2)); }
async function step(name, run) { const start = Date.now(); try { const details = await run(); report.results.push({ name, status: 'PASS', elapsedMs: Date.now() - start, details }); console.log(`PASS ${name}`); } catch (error) { report.results.push({ name, status: 'FAIL', elapsedMs: Date.now() - start, error: error.stack ?? String(error) }); console.log(`FAIL ${name}: ${error.message}`); throw error; } finally { await writeReport(); } }
async function newContext() { if (context) await context.close(); context = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: 'pt-BR', acceptDownloads: true }); page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', error => report.pageErrors.push(error.message)); page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); }); }
async function records(store) { return page.evaluate(store => new Promise((done, fail) => { const request = indexedDB.open('atoa-leticia-gallery'); request.onerror = () => fail(request.error); request.onsuccess = () => { const db = request.result, tx = db.transaction(store), read = tx.objectStore(store).getAll(); tx.oncomplete = () => { db.close(); done(read.result); }; tx.onerror = () => { db.close(); fail(tx.error); }; tx.onabort = () => { db.close(); fail(tx.error); }; }; }), store); }
async function state(key) { return (await records('state')).find(item => item.key === key)?.value; }
async function poll(read, predicate, message, timeout = 20000) { const end = Date.now() + timeout; do { const value = await read(); if (predicate(value)) return value; await page.waitForTimeout(70); } while (Date.now() < end); assert.fail(message); }
async function route(hash, selector) { await page.evaluate(hash => { location.hash = hash; }, hash); await page.locator(selector).waitFor(); }
async function boot() { await page.goto(BASE, { waitUntil: 'networkidle' }); await page.locator('.app-shell').waitFor(); }
async function verifyWall(expected = 12) { await route('photowall', '.photo-wall-game'); await poll(() => page.locator('[data-photo-card]').count(), count => count === expected, 'mural did not show expected actual photo count'); const image = page.locator('[data-photo-card] image').first(); const href = await image.getAttribute('href'); assert.match(href, /^data:image\/(jpeg|png);base64,/); const decoded = await page.evaluate(async dataUrl => { const image = new Image(); image.src = dataUrl; await image.decode(); return { width: image.naturalWidth, height: image.naturalHeight }; }, href); assert.ok(decoded.width > 100 && decoded.height > 100); return { count: expected, firstImage: decoded, firstImageSha256: hash(href) }; }
async function seedLocalFixture({ withGift }) {
  await context.route('**/qa-delivery-empty.html', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Isolated QA fixture</title>' }));
  await page.goto(`${BASE}/qa-delivery-empty.html`);
  const localCreation = { ...initial.creations[0], id: 'qa-local-creation', title: 'QA local creation', createdAt: Date.now(), kind: 'atelier', display: 'frame' };
  const localWall = { version: 1, background: 'sage', items: [{ creationId: localCreation.id, x: 273, y: 311, angle: 14, frame: 'arch', size: 1, fit: 'contain' }] };
  // A photo kind is needed to render an existing wall item; this is an approved
  // public photo copied into an isolated QA context, never a private user file.
  localCreation.kind = 'photo';
  const localGift = { version: 1, source: 'personal', letter: 'QA personal words retained on this device.', notes: ['QA personal note.'], cats: initialGift.cats };
  const seeded = [{ key: 'intro-seen', value: true }, { key: 'photo-wall', value: localWall }, { key: 'shelf-layout', value: [localCreation.id] }, ...(withGift ? [{ key: 'gift-content', value: localGift }] : [])].map(record => ({ ...record, version: 1, updatedAt: Date.now() }));
  await page.evaluate(async ({ seeded, localCreation }) => {
    const db = await new Promise((done, fail) => { const request = indexedDB.open('atoa-leticia-gallery', 2); request.onupgradeneeded = () => { request.result.createObjectStore('state', { keyPath: 'key' }); request.result.createObjectStore('creations', { keyPath: 'id' }); }; request.onsuccess = () => done(request.result); request.onerror = () => fail(request.error); });
    await new Promise((done, fail) => { const tx = db.transaction(['state', 'creations'], 'readwrite'); seeded.forEach(record => tx.objectStore('state').put(record)); tx.objectStore('creations').put(localCreation); tx.oncomplete = done; tx.onerror = () => fail(tx.error); tx.onabort = () => fail(tx.error); }); db.close();
  }, { seeded, localCreation });
  await context.unroute('**/qa-delivery-empty.html'); return { localCreation, localWall, localGift };
}

try {
  browser = await chromium.launch({ headless: true }); report.browserVersion = browser.version();
  await newContext();
  await step('fresh-start-real-letter-three-cat-profiles-twelve-photos-and-wall', async () => {
    await boot(); const dialog = page.getByRole('dialog', { name: 'Bem-vinda ao seu cantinho' }); await dialog.waitFor();
    const actual = await dialog.locator('.letter-text').innerText(); assert.equal(hash(actual), hash(initialGift.letter), 'first opening shows the delivered actual letter');
    const gift = await state('gift-content'); assert.equal(hash(gift), hash(initialGift)); assert.equal(gift.cats.length, 3);
    await dialog.getByRole('button', { name: 'Pular', exact: true }).tap(); await page.locator('.home-hero').waitFor();
    const photos = await records('creations'); assert.equal(photos.length, 12); assert.deepEqual(photos.map(item => item.id).sort(), initial.creations.map(item => item.id).sort());
    const wall = await state('photo-wall'); assert.equal(wall.items.length, 12); const shown = await verifyWall();
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('.photo-wall-game').waitFor(); assert.equal(await page.locator('[data-photo-card]').count(), 12); assert.equal(hash(await state('photo-wall')), hash(wall));
    await route('love', '.letter-paper'); assert.equal(hash(await page.locator('.letter-paper .letter-text').innerText()), hash(initialGift.letter));
    await route('cats', '.cats-game'); assert.equal(await page.locator('.cats-name-button').count(), 3);
    return { letterSha256: hash(actual), letterMatchesDeliveredContent: true, notes: gift.notes.length, catProfiles: 3, photos: 12, photoIds: photos.map(item => item.id).sort(), wall: shown, wallReload: true, skipToHomeTaps: 1 };
  });
  await step('initial-asset-precache-and-real-offline-wall-ceramic-and-backup', async () => {
    await route('home', '.home-hero');
    await poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.active), Boolean, 'service worker did not activate');
    if (!await page.evaluate(() => !!navigator.serviceWorker.controller)) { await page.reload({ waitUntil: 'load' }); await page.locator('.home-hero').waitFor(); }
    const cached = await poll(() => page.evaluate(async () => { const entries = []; for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) entries.push(new URL(request.url).pathname); return entries; }), entries => entries.includes('/presente/inicial.json') && entries.some(path => /PhotoWall.*\.js/.test(path)) && entries.some(path => /Ceramic3D.*\.js/.test(path)), 'gift or lazy modules missing from precache');
    await context.setOffline(true);
    await page.reload({ waitUntil: 'load' }); await page.locator('.home-hero').waitFor(); const wall = await verifyWall();
    await route('ceramic3d', '.ceramic3d-game'); await poll(() => page.locator('.c3-stage').getAttribute('data-webgl-state'), value => value === 'ready', 'ceramic renderer did not open offline');
    const before = await state('ceramic-3d'); await page.getByRole('button', { name: 'Girar a peça para a direita', exact: true }).tap(); await poll(() => state('ceramic-3d'), value => value.view.azimuth !== before.view.azimuth, 'offline ceramic interaction failed');
    await route('settings', '.settings-page'); const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Exportar backup', exact: true }).tap(); const download = await downloading; assert.equal(await download.failure(), null); const contents = await readFile(await download.path(), 'utf8'); const validated = parseBackup(contents); assert.equal(validated.creations.length, 12);
    await context.setOffline(false); return { cachedAsset: '/presente/inicial.json', precacheEntries: cached.length, wall, ceramicWebGL: 'ready', ceramicOfflineInteraction: true, backupOffline: true, backupPhotos: validated.creations.length, disconnectedByBrowserContext: true };
  });
  await newContext();
  await step('existing-personal-gift-creation-and-layout-survive-reloads', async () => {
    const fixture = await seedLocalFixture({ withGift: true }); await boot(); await page.locator('.home-hero').waitFor();
    for (let reload = 0; reload < 2; reload++) {
      assert.equal(hash(await state('gift-content')), hash(fixture.localGift), 'personal gift must not be replaced by initial gift');
      assert.equal(hash(await state('photo-wall')), hash(fixture.localWall)); assert.deepEqual(await state('shelf-layout'), [fixture.localCreation.id]);
      const creations = await records('creations'); assert.equal(creations.length, 1); assert.equal(hash(creations[0]), hash(fixture.localCreation));
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('.home-hero').waitFor();
    }
    await route('love', '.letter-paper'); assert.equal(hash(await page.locator('.letter-paper .letter-text').innerText()), hash(fixture.localGift.letter));
    const wall = await verifyWall(1); return { source: 'personal', personalGiftSha256: hash(fixture.localGift), preservedCreationId: fixture.localCreation.id, creations: 1, shelfLayoutPreserved: true, wall, reloads: 2 };
  });
  await newContext();
  await step('initial-import-adds-public-gift-preserving-existing-creation-and-layout', async () => {
    const fixture = await seedLocalFixture({ withGift: false }); await boot(); await page.locator('.home-hero').waitFor();
    assert.equal(hash(await state('gift-content')), hash(initialGift)); const creations = await records('creations'); assert.equal(creations.length, 13); assert.equal(hash(creations.find(item => item.id === fixture.localCreation.id)), hash(fixture.localCreation));
    assert.equal(hash(await state('photo-wall')), hash(fixture.localWall)); assert.deepEqual(await state('shelf-layout'), [fixture.localCreation.id]);
    const readonlyAgain = parseBackup(await readFile(resolve('public/presente/inicial.json'), 'utf8')); assert.equal(hash(await readFile(resolve('public/presente/inicial.json'), 'utf8')), report.publicGiftFileSha256); assert.equal(readonlyAgain.creations.length, 12);
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('.home-hero').waitFor(); assert.equal((await records('creations')).length, 13);
    return { publicGiftImported: true, creations: 13, existingCreationPreserved: true, existingWallPreserved: true, existingShelfLayoutPreserved: true, duplicateInitialPhotosAfterReload: false, readonlyGiftValid: true, initialAssetUnchanged: true };
  });
  assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.failure = error.stack ?? String(error); process.exitCode = 1; }
finally { report.endedAt = new Date().toISOString(); report.summary = { passed: report.results.filter(item => item.status === 'PASS').length, failed: report.results.filter(item => item.status === 'FAIL').length, total: report.results.length }; await writeReport(); if (context) await context.close(); if (browser) await browser.close(); console.log(JSON.stringify({ status: report.status, summary: report.summary, output: OUTPUT })); }
