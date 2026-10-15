import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, devices } from 'playwright';
import { CERAMIC_PRESETS, profileForPreset } from '../src/games/Ceramic3D.logic.ts';
import { normalizeBackup } from '../src/lib/backup.ts';

const args = process.argv.slice(2);
const option = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1]; };
const BASE = option('--base-url', 'http://localhost:5189');
const OUTPUT = resolve(option('--output', 'evidence/expansion-results.json'));
const report = { suite: '16 cenas, materiais de pintura, cerâmica 3D e backup', startedAt: new Date().toISOString(), baseUrl: BASE, browser: 'Chromium', device: 'iPhone 13 emulado, 390x844, touch real via CDP', physicalIPhoneVerified: false, limitations: ['Não usa iPhone físico nem valida WebGL no Safari do aparelho.', 'Cor personalizada usa o input color e eventos nativos; não abre o seletor de cores do iOS.', 'Quota é uma falha injetada no put de IndexedDB, não esgotamento físico do disco.'], results: [], consoleErrors: [], pageErrors: [] };
let browser, context, page, cdp;
let savedBackup;
const SCENES = [
  ['Bigodes', ['cat', 'cats-window', 'cats-yarn', 'cats-nap']],
  ['Plantinhas', ['flowers', 'forest', 'greenhouse', 'plant-shelf', 'window-garden']],
  ['Cantinhos', ['journey', 'cozy-kitchen', 'reading-corner']],
  ['Feito à mão', ['pottery', 'crochet-basket', 'pottery-bouquet', 'pottery-table']],
];
const sha = value => createHash('sha256').update(value).digest('hex');
async function persistReport() { await mkdir(resolve('evidence'), { recursive: true }); await writeFile(OUTPUT, JSON.stringify(report, null, 2)); }
async function step(name, run) {
  const start = Date.now();
  try { const details = await run(); report.results.push({ name, status: 'PASS', elapsedMs: Date.now() - start, details }); console.log(`PASS ${name}`); }
  catch (error) { report.results.push({ name, status: 'FAIL', elapsedMs: Date.now() - start, error: error.stack ?? String(error), visibleText: await page.locator('body').innerText().catch(() => '') }); console.log(`FAIL ${name}: ${error.message}`); throw error; }
  finally { await persistReport(); }
}
async function settle() { await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))); }
async function records(store) {
  return page.evaluate(store => new Promise((done, fail) => {
    const request = indexedDB.open('atoa-leticia-gallery');
    request.onerror = () => fail(request.error);
    request.onsuccess = () => { const db = request.result, tx = db.transaction(store), read = tx.objectStore(store).getAll(); tx.oncomplete = () => { db.close(); done(read.result); }; tx.onerror = () => { db.close(); fail(tx.error); }; tx.onabort = () => { db.close(); fail(tx.error); }; };
  }), store);
}
async function state(key) { return (await records('state')).find(record => record.key === key)?.value; }
async function poll(read, predicate, message, timeout = 12000) {
  const end = Date.now() + timeout; let value;
  do { value = await read(); if (predicate(value)) return value; await page.waitForTimeout(60); } while (Date.now() < end);
  assert.fail(`${message}; latest=${JSON.stringify(value).slice(0, 1600)}`);
}
async function waitState(key, predicate) { return poll(() => state(key), value => value != null && predicate(value), `${key} did not persist`); }
async function route(hash, selector) { await page.evaluate(hash => { location.hash = hash; }, hash); if (selector) await page.locator(selector).waitFor({ state: 'visible' }); await settle(); }
async function boot() {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('.app-shell').waitFor();
  const intro = page.getByRole('dialog', { name: 'Bem-vinda ao seu cantinho' });
  if (await intro.isVisible().catch(() => false)) await intro.getByRole('button', { name: 'Pular', exact: true }).tap();
  await settle();
}
async function bounds(locator) { await locator.scrollIntoViewIfNeeded(); await settle(); const box = await locator.boundingBox(); assert.ok(box); return box; }
async function nativeColor(selector, color) {
  await page.locator(selector).evaluate((input, color) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, color); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); }, color);
  await waitState('atelier-color', value => value === color);
}
const contact = point => ({ id: 1, x: point.x, y: point.y, radiusX: 3, radiusY: 3, force: 1 });
async function touchDrag(a, b) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [contact(a)] }); await settle();
  for (let i = 1; i <= 9; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [contact({ x: a.x + (b.x - a.x) * i / 9, y: a.y + (b.y - a.y) * i / 9 })] }); await settle(); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await settle();
}
async function findPaintablePoint() {
  await bounds(page.locator('.art-coloring-svg'));
  const hit = await page.locator('.art-coloring-svg').evaluate(svg => {
    const box = svg.getBoundingClientRect();
    for (let row = 3; row <= 17; row++) for (let column = 3; column <= 17; column++) {
      const x = box.x + box.width * column / 20, y = box.y + box.height * row / 20;
      const target = document.elementFromPoint(x, y)?.closest('[data-art-region]');
      if (target && svg.contains(target)) return { x, y, id: target.getAttribute('data-art-region') };
    }
    return null;
  });
  assert.ok(hit, 'scene exposes a real touchable paint region'); return hit;
}
async function openSceneLibrary() {
  const library = page.locator('.art-scene-library');
  const closed = await library.evaluate(element => element.tagName === 'DETAILS' && !element.open);
  if (closed) await library.locator('summary').tap();
}
async function selectScene(category, id) {
  await openSceneLibrary();
  await page.locator('.art-scene-categories').getByRole('button', { name: category, exact: true }).tap();
  await page.locator(`[data-scene-id="${id}"]`).tap();
  await waitState('atelier-artwork', value => value.picture === id); await settle();
}
function pngDetails(dataUrl, expected) {
  assert.match(dataUrl, /^data:image\/png;base64,/);
  const png = Buffer.from(dataUrl.split(',')[1], 'base64');
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  if (expected) { assert.equal(width, expected); assert.equal(height, expected); }
  assert.ok(png.length > 3000, 'PNG contains substantial rendered image data');
  return { width, height, bytes: png.length, sha256: sha(png) };
}
async function saveAndInspect(buttonName, expectedSize) {
  const before = await records('creations');
  await page.getByRole('button', { name: buttonName, exact: true }).tap();
  const saved = await poll(() => records('creations'), items => items.length === before.length + 1, 'save did not commit one image');
  const item = saved.find(item => !before.some(old => old.id === item.id));
  const png = pngDetails(item.dataUrl, expectedSize);
  await route('saved', '.shelf-wall');
  const image = page.locator(`[data-creation-id="${item.id}"] img`);
  await image.waitFor();
  const decoded = await image.evaluate(async img => {
    await img.decode(); const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0); const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data; let occupied = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) occupied++;
    return { width: img.naturalWidth, height: img.naturalHeight, occupiedPixels: occupied };
  });
  assert.ok(decoded.occupiedPixels > 1000, 'saved image decodes and is not a transparent placeholder');
  const downloading = page.waitForEvent('download');
  await image.locator('..').tap();
  await page.getByRole('button', { name: 'Exportar imagem', exact: true }).tap();
  const download = await downloading; assert.equal(await download.failure(), null);
  const exported = await readFile(await download.path());
  assert.equal(sha(exported), png.sha256, 'download is the same real PNG saved on the shelf');
  await page.getByRole('button', { name: 'Fechar', exact: true }).tap();
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('.shelf-wall').waitFor();
  await page.locator(`[data-creation-id="${item.id}"] img`).waitFor();
  return { id: item.id, title: item.title, kind: item.kind, display: item.display, png, decoded, download: download.suggestedFilename(), reload: true };
}

try {
  browser = await chromium.launch({ headless: true }); report.browserVersion = browser.version();
  context = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: 'pt-BR', acceptDownloads: true });
  page = await context.newPage(); page.setDefaultTimeout(15000); cdp = await context.newCDPSession(page);
  page.on('pageerror', error => report.pageErrors.push(error.message)); page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  await boot();
  await step('sixteen-scenes-touch-color-and-library-reload', async () => {
    await page.locator('.studio-entry-paint').tap(); await page.locator('.art-scene-library').waitFor();
    await openSceneLibrary();
    const evidence = [];
    for (const [category, ids] of SCENES) {
      await page.locator('.art-scene-categories').getByRole('button', { name: category, exact: true }).tap();
      assert.deepEqual(await page.locator('[data-scene-id]').evaluateAll(nodes => nodes.map(node => node.dataset.sceneId)), ids, `${category} has its complete scenes`);
      for (const id of ids) {
        await selectScene(category, id);
        const color = evidence.length % 2 ? '#79518a' : '#477654';
        await nativeColor('input[aria-label="Cor personalizada"]', color);
        const point = await findPaintablePoint(); await page.touchscreen.tap(point.x, point.y);
        const draft = await waitState('atelier-artwork', value => value.picture === id && value.regions[point.id] === color);
        assert.equal(await page.locator(`[data-art-region="${point.id}"]`).getAttribute('fill'), color);
        evidence.push({ category, id, seed: draft.seed, region: point.id, color, regions: await page.locator('[data-art-region]').count() });
      }
    }
    assert.equal(evidence.length, 16);
    for (const entry of evidence) {
      await selectScene(entry.category, entry.id);
      const draft = await state('atelier-artwork'); assert.equal(draft.seed, entry.seed); assert.equal(draft.regions[entry.region], entry.color);
      assert.equal(await page.locator(`[data-art-region="${entry.region}"]`).getAttribute('fill'), entry.color, 'returning to scene resumes exact color');
    }
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('.art-scene-library').waitFor();
    const restored = await state('atelier-artwork');
    for (const entry of evidence) { const stored = restored.picture === entry.id ? restored : restored.library[entry.id]; assert.equal(stored.seed, entry.seed); assert.equal(stored.regions[entry.region], entry.color); }
    const creation = await saveAndInspect('Guardar na galeria', 1200);
    return { categories: 4, scenes: evidence, libraryReload: true, creation };
  });
  await step('chalk-and-watercolor-distinct-real-touch-render-and-export', async () => {
    await route('atelier', '.art-game');
    await page.getByRole('button', { name: /Outros jeitos de pintar/ }).tap();
    await page.getByRole('button', { name: 'Livre', exact: true }).tap();
    await nativeColor('input[aria-label="Cor personalizada"]', '#79518a');
    await page.locator('input[aria-label="Tamanho do pincel"]').fill('26');
    const evidence = [];
    for (const [label, kind] of [['Giz', 'chalk'], ['Aquarela', 'watercolor']]) {
      await page.getByRole('button', { name: 'Papel novo', exact: true }).tap();
      await page.getByRole('button', { name: `Pincel ${label}`, exact: true }).tap();
      const box = await bounds(page.locator('.art-free-canvas'));
      await touchDrag({ x: box.x + box.width * .3, y: box.y + box.height * .5 }, { x: box.x + box.width * .7, y: box.y + box.height * .5 });
      const draft = await waitState('atelier-artwork', value => value.strokes.length === 1 && value.strokes[0].brush === kind && value.strokes[0].points.length > 2);
      const render = await page.locator('.art-free-canvas').evaluate(canvas => {
        const ctx = canvas.getContext('2d'), data = ctx.getImageData(0, 0, 600, 600).data; let dark = 0, channelSum = 0;
        for (let y = 260; y < 340; y++) for (let x = 160; x < 440; x++) { const i = (y * 600 + x) * 4; if (data[i] < 230) dark++; channelSum += data[i] + data[i + 1] + data[i + 2]; }
        return { dataUrl: canvas.toDataURL('image/png'), darkPixels: dark, channelSum };
      });
      evidence.push({ kind, stroke: draft.strokes[0], png: pngDetails(render.dataUrl, 600), darkPixels: render.darkPixels, channelSum: render.channelSum });
    }
    assert.deepEqual(evidence[0].stroke.points, evidence[1].stroke.points, 'both materials use the same recorded touch path');
    assert.equal(evidence[0].stroke.color, evidence[1].stroke.color);
    assert.equal(evidence[0].stroke.size, evidence[1].stroke.size);
    assert.notEqual(evidence[0].png.sha256, evidence[1].png.sha256, 'same color/size/path renders different brush materials');
    assert.notEqual(evidence[0].channelSum, evidence[1].channelSum, 'actual canvas pixels differ between materials');
    const before = await state('atelier-artwork'); await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('.art-free-canvas').waitFor(); await settle();
    assert.deepEqual((await state('atelier-artwork')).strokes, before.strokes);
    assert.equal(await state('atelier-brush-kind'), 'watercolor');
    assert.equal(sha(Buffer.from((await page.locator('.art-free-canvas').evaluate(canvas => canvas.toDataURL('image/png'))).split(',')[1], 'base64')), evidence[1].png.sha256, 'watercolor drawing is identical after reload');
    const creation = await saveAndInspect('Guardar na galeria', 600);
    return { sameColor: '#79518a', sameSize: 26, brushes: evidence, creation };
  });
  await step('ceramic-nine-presets-sculpt-touch-undo-redo-rotate-stamp-png-shelf-reload', async () => {
    await route('ceramic3d', '.ceramic3d-game');
    await poll(() => page.locator('.c3-stage').getAttribute('data-webgl-state'), value => value === 'ready', 'real WebGL renderer did not start');
    assert.equal(await page.locator('.c3-preset-grid button').count(), 9);
    const presets = [];
    for (const preset of CERAMIC_PRESETS) {
      await page.locator('.c3-preset-grid').getByRole('button', { name: preset.label, exact: true }).tap();
      const draft = await waitState('ceramic-3d', value => value.preset === preset.id);
      assert.equal(draft.profile.length, 32); assert.deepEqual(draft.profile, profileForPreset(preset.id)); assert.equal(draft.height, preset.height);
      presets.push({ id: preset.id, label: preset.label, height: draft.height, profileSamples: draft.profile.length });
    }
    await page.locator('.c3-preset-grid').getByRole('button', { name: 'Vasinho', exact: true }).tap();
    const before = await waitState('ceramic-3d', value => value.preset === 'vase');
    const box = await bounds(page.locator('.c3-canvas'));
    await touchDrag({ x: box.x + box.width * .5, y: box.y + box.height * .54 }, { x: box.x + box.width * .63, y: box.y + box.height * .57 });
    const sculpted = await waitState('ceramic-3d', value => JSON.stringify(value.profile) !== JSON.stringify(before.profile));
    const changedSamples = sculpted.profile.filter((value, i) => value !== before.profile[i]).length;
    assert.ok(changedSamples > 0 && changedSamples < 32, 'touch sculpt changes a local part of the actual 32-radius profile');
    await page.getByRole('button', { name: 'Desfazer', exact: true }).tap(); await waitState('ceramic-3d', value => JSON.stringify(value.profile) === JSON.stringify(before.profile));
    await page.getByRole('button', { name: 'Refazer', exact: true }).tap(); await waitState('ceramic-3d', value => JSON.stringify(value.profile) === JSON.stringify(sculpted.profile));
    await page.getByRole('button', { name: 'Girar', exact: true }).tap();
    const rotatingBox = await bounds(page.locator('.c3-canvas'));
    await touchDrag({ x: rotatingBox.x + rotatingBox.width * .4, y: rotatingBox.y + rotatingBox.height * .5 }, { x: rotatingBox.x + rotatingBox.width * .62, y: rotatingBox.y + rotatingBox.height * .57 });
    const rotated = await waitState('ceramic-3d', value => JSON.stringify(value.view) !== JSON.stringify(sculpted.view));
    assert.deepEqual(rotated.profile, sculpted.profile, 'rotating does not sculpt'); assert.equal(rotated.height, sculpted.height);
    await page.getByRole('button', { name: 'Carimbar', exact: true }).tap();
    const stampBox = await bounds(page.locator('.c3-canvas')); await page.touchscreen.tap(stampBox.x + stampBox.width * .5, stampBox.y + stampBox.height * .54);
    const stamped = await waitState('ceramic-3d', value => value.stamps.length === 1);
    assert.equal(stamped.stamps[0].type, 'flower'); assert.deepEqual(stamped.profile, sculpted.profile);
    await page.getByRole('combobox', { name: 'Padrão do esmalte', exact: true }).selectOption('leaves');
    await page.getByRole('button', { name: 'Brilhante', exact: true }).tap();
    const final = await waitState('ceramic-3d', value => value.pattern === 'leaves' && value.finish === 'glossy');
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('.ceramic3d-game').waitFor();
    await poll(() => page.locator('.c3-stage').getAttribute('data-webgl-state'), value => value === 'ready', 'WebGL did not resume');
    assert.deepEqual(await state('ceramic-3d'), final, 'actual mold, stamp and view survive reload');
    const creation = await saveAndInspect('Guardar na prateleira', 1000); assert.equal(creation.display, 'object');
    return { presets, profileBefore: before.profile, profileAfter: sculpted.profile, changedSamples, undoRedo: true, rotationBefore: sculpted.view, rotationAfter: rotated.view, stamps: stamped.stamps, reload: true, creation };
  });
  await step('backup-new-scenes-brushes-ceramic-three-dimensional-roundtrip', async () => {
    await route('settings', '.settings-page');
    const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Exportar backup', exact: true }).tap();
    const download = await downloading; assert.equal(await download.failure(), null);
    const contents = await readFile(await download.path(), 'utf8'), data = JSON.parse(contents);
    normalizeBackup(data); savedBackup = { contents, data };
    const value = key => data.state.find(record => record.key === key)?.value;
    assert.equal(value('ceramic-3d').profile.length, 32); assert.equal(value('ceramic-3d').stamps.length, 1);
    assert.equal(Object.keys(value('atelier-artwork').library).length, 16); assert.equal(value('atelier-brush-kind'), 'watercolor');
    assert.equal(value('atelier-artwork').strokes[0].brush, 'watercolor'); assert.equal(data.creations.length, 3);
    await route('ceramic3d', '.ceramic3d-game'); await page.getByRole('button', { name: 'Outra pecinha', exact: true }).tap(); await waitState('ceramic-3d', item => item.stamps.length === 0);
    await route('atelier', '.art-game'); await page.getByRole('button', { name: 'Papel novo', exact: true }).tap(); await page.getByRole('button', { name: 'Pincel Caneta', exact: true }).tap(); await waitState('atelier-artwork', item => item.strokes.length === 0);
    await route('settings', '.settings-page'); await page.locator('#backup-file').setInputFiles({ name: 'expansion-backup.json', mimeType: 'application/json', buffer: Buffer.from(contents) });
    await page.getByRole('status').filter({ hasText: 'Cópia restaurada.' }).waitFor({ state: 'visible' });
    for (const key of ['ceramic-3d', 'atelier-artwork', 'atelier-brush-kind', 'atelier-brush', 'atelier-color']) assert.deepEqual(await state(key), value(key), `${key} is exactly restored`);
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('.settings-page').waitFor();
    for (const key of ['ceramic-3d', 'atelier-artwork', 'atelier-brush-kind']) assert.deepEqual(await state(key), value(key));
    await route('atelier', '.art-game'); assert.equal(await page.getByRole('button', { name: 'Pincel Aquarela', exact: true }).getAttribute('aria-pressed'), 'true');
    await route('ceramic3d', '.ceramic3d-game'); await poll(() => page.locator('.c3-stage').getAttribute('data-webgl-state'), value => value === 'ready', 'restored WebGL renderer did not open');
    await route('saved', '.shelf-wall'); assert.equal(await page.locator('[data-creation-id]').count(), 3);
    return { filename: download.suggestedFilename(), bytes: Buffer.byteLength(contents), validated: true, version: data.version, creations: data.creations.map(item => ({ id: item.id, kind: item.kind })), restoredKeys: ['ceramic-3d', 'atelier-artwork', 'atelier-brush-kind', 'atelier-brush', 'atelier-color'], persistedScenes: Object.keys(value('atelier-artwork').library), reload: true };
  });
  await step('ceramic-quota-failure-has-no-fake-save-and-retry-commits', async () => {
    await route('ceramic3d', '.ceramic3d-game');
    await poll(() => page.locator('.c3-stage').getAttribute('data-webgl-state'), value => value === 'ready', 'WebGL did not open for quota test');
    const before = await records('creations'), draft = await state('ceramic-3d');
    await page.evaluate(() => { const original = IDBObjectStore.prototype.put; window.__expansionQuota = { original, hits: 0 }; IDBObjectStore.prototype.put = function(...args) { if (this.name === 'creations') { window.__expansionQuota.hits++; throw new DOMException('QA injected quota', 'QuotaExceededError'); } return original.apply(this, args); }; });
    await page.getByRole('button', { name: 'Guardar na prateleira', exact: true }).tap();
    await page.locator('.c3-status').filter({ hasText: 'Não consegui guardar a peça.' }).waitFor();
    const after = await records('creations'); assert.deepEqual(after, before); assert.deepEqual(await state('ceramic-3d'), draft);
    assert.equal(await page.getByRole('status').filter({ hasText: 'Sua criação está no cantinho.' }).count(), 0, 'failed persistence never emits success toast');
    const hits = await page.evaluate(() => { const fault = window.__expansionQuota; IDBObjectStore.prototype.put = fault.original; return fault.hits; }); assert.ok(hits > 0, 'failure injection was reached');
    await page.getByRole('button', { name: 'Guardar na prateleira', exact: true }).tap();
    await poll(() => records('creations'), items => items.length === before.length + 1, 'retry did not commit');
    return { injectedQuotaHits: hits, failedSaveCreationCount: after.length, draftPreserved: true, retryCreationCount: before.length + 1 };
  });
  assert.deepEqual(report.pageErrors, [], 'no uncaught browser exceptions');
  report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.failure = error.stack ?? String(error); process.exitCode = 1; }
finally {
  report.endedAt = new Date().toISOString(); report.summary = { passed: report.results.filter(result => result.status === 'PASS').length, failed: report.results.filter(result => result.status === 'FAIL').length, total: report.results.length };
  await persistReport(); if (context) await context.close(); if (browser) await browser.close();
  console.log(JSON.stringify({ status: report.status, summary: report.summary, output: OUTPUT }));
}
