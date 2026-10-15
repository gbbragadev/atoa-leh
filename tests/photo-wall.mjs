import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, devices } from 'playwright';
import { normalizeBackup } from '../src/lib/backup.ts';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const BASE = option('--base-url', 'http://localhost:5189');
const OUTPUT = resolve(option('--output', 'evidence/photo-wall-results.json'));
const report = { suite: 'Mural: importação local, touch, molduras, PNG e backup', startedAt: new Date().toISOString(), baseUrl: BASE, physicalIPhoneVerified: false, device: 'Chromium real, iPhone 13 emulado 390x844, touch via CDP', limitations: ['Não verifica câmera física, galeria nativa ou seletor de arquivos de um iPhone.', 'JPEG de teste foi criado localmente a partir da ilustração pública public/images/cantinho-v2.png. Nenhuma foto privada é usada.', 'Monitoramento de rede cobre esta sessão do navegador.'], results: [], externalRequests: [], consoleErrors: [], pageErrors: [] };
let browser, context, page, cdp, photoId;
const sha = data => createHash('sha256').update(data).digest('hex');
async function writeReport() { await mkdir(resolve('evidence'), { recursive: true }); await writeFile(OUTPUT, JSON.stringify(report, null, 2)); }
async function step(name, run) { const started = Date.now(); try { const details = await run(); report.results.push({ name, status: 'PASS', elapsedMs: Date.now() - started, details }); console.log(`PASS ${name}`); } catch (error) { report.results.push({ name, status: 'FAIL', elapsedMs: Date.now() - started, error: error.stack ?? String(error), visibleText: await page.locator('body').innerText().catch(() => '') }); console.log(`FAIL ${name}: ${error.message}`); throw error; } finally { await writeReport(); } }
async function records(store) { return page.evaluate(store => new Promise((done, fail) => { const request = indexedDB.open('atoa-leticia-gallery'); request.onerror = () => fail(request.error); request.onsuccess = () => { const db = request.result, tx = db.transaction(store), read = tx.objectStore(store).getAll(); tx.oncomplete = () => { db.close(); done(read.result); }; tx.onerror = () => { db.close(); fail(tx.error); }; tx.onabort = () => { db.close(); fail(tx.error); }; }; }), store); }
async function state() { return (await records('state')).find(item => item.key === 'photo-wall')?.value; }
async function poll(read, predicate, message, timeout = 15000) { const end = Date.now() + timeout; let value; do { value = await read(); if (predicate(value)) return value; await page.waitForTimeout(60); } while (Date.now() < end); assert.fail(`${message}; latest=${JSON.stringify(value).slice(0, 1000)}`); }
async function waitWall(predicate) { return poll(state, value => value && predicate(value), 'photo-wall did not persist'); }
async function settle() { await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))); }
async function route(hash, selector) { await page.evaluate(hash => { location.hash = hash; }, hash); await page.locator(selector).waitFor(); await settle(); }
async function bounds(locator) { await locator.scrollIntoViewIfNeeded(); await settle(); const box = await locator.boundingBox(); assert.ok(box); return box; }
const contact = point => ({ id: 1, x: point.x, y: point.y, radiusX: 3, radiusY: 3, force: 1 });
async function touchDrag(a, b) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [contact(a)] }); await settle(); for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [contact({ x: a.x + (b.x - a.x) * i / 8, y: a.y + (b.y - a.y) * i / 8 })] }); await settle(); } await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await settle(); }
async function selectPhoto() { await page.locator(`[data-photo-card="${photoId}"]`).tap(); await page.locator('.photo-wall-editor').waitFor(); }
async function imageInfo(dataUrl) { return page.evaluate(async dataUrl => { const image = new Image(); image.src = dataUrl; await image.decode(); const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data; let min = 255, max = 0, occupied = 0; for (let i = 0; i < pixels.length; i += 4) { min = Math.min(min, pixels[i]); max = Math.max(max, pixels[i]); if (pixels[i + 3]) occupied++; } return { width: image.naturalWidth, height: image.naturalHeight, minRed: min, maxRed: max, occupiedPixels: occupied }; }, dataUrl); }

try {
  browser = await chromium.launch({ headless: true }); report.browserVersion = browser.version();
  context = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: 'pt-BR', acceptDownloads: true });
  const origin = new URL(BASE).origin;
  context.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== origin) report.externalRequests.push({ url: request.url(), method: request.method(), resourceType: request.resourceType() }); });
  page = await context.newPage(); cdp = await context.newCDPSession(page); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.pageErrors.push(error.message)); page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  await page.goto(`${BASE}/#photowall`, { waitUntil: 'networkidle' }); await page.locator('.app-shell').waitFor();
  const intro = page.getByRole('dialog', { name: 'Bem-vinda ao seu cantinho' }); if (await intro.isVisible().catch(() => false)) await intro.getByRole('button', { name: 'Pular', exact: true }).tap();
  await page.locator('.photo-wall-game').waitFor();
  await step('native-input-contract-and-public-jpeg-local-import', async () => {
    const gallery = page.getByLabel('Escolher fotos da galeria', { exact: true }), camera = page.getByLabel('Fotografar para o mural', { exact: true });
    assert.equal(await gallery.getAttribute('type'), 'file'); assert.equal(await gallery.getAttribute('accept'), 'image/*'); assert.equal(await gallery.evaluate(input => input.multiple), true);
    assert.equal(await camera.getAttribute('type'), 'file'); assert.equal(await camera.getAttribute('accept'), 'image/*'); assert.equal(await camera.getAttribute('capture'), 'environment');
    const fixture = await page.evaluate(async () => { const image = new Image(); image.src = '/images/cantinho-v2.png'; await image.decode(); const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0); return { width: canvas.width, height: canvas.height, dataUrl: canvas.toDataURL('image/jpeg', .93) }; });
    const bytes = Buffer.from(fixture.dataUrl.split(',')[1], 'base64'); assert.equal(bytes[0], 255); assert.equal(bytes[1], 216);
    await gallery.setInputFiles({ name: 'publica-cantinho-original.jpg', mimeType: 'image/jpeg', buffer: bytes });
    const photos = await poll(() => records('creations'), items => items.filter(item => item.kind === 'photo').length === 1, 'JPEG import did not commit one photo');
    const photo = photos.find(item => item.kind === 'photo'); photoId = photo.id; assert.match(photo.dataUrl, /^data:image\/jpeg;base64,/);
    await waitWall(value => value.items.length === 1 && value.items[0].creationId === photoId); await page.locator(`[data-photo-card="${photoId}"]`).waitFor();
    const imported = await imageInfo(photo.dataUrl); assert.ok(Math.max(imported.width, imported.height) <= 1600); assert.ok(imported.maxRed > imported.minRed + 40, 'photo contains rendered public scene');
    assert.deepEqual(report.externalRequests, [], 'no image or state data leaves this origin');
    return { gallery: { type: 'file', accept: 'image/*', multiple: true }, camera: { type: 'file', accept: 'image/*', capture: 'environment', physicallyExercised: false }, fixture: { path: 'public/images/cantinho-v2.png', sourceWidth: fixture.width, sourceHeight: fixture.height, jpegBytes: bytes.length, jpegSha256: sha(bytes) }, photo: { id: photoId, title: photo.title, bytes: Buffer.from(photo.dataUrl.split(',')[1], 'base64').length, image: imported }, externalRequests: report.externalRequests };
  });
  await step('touch-position-rotation-frames-fit-size-background-undo-and-resume', async () => {
    await selectPhoto(); const before = await state();
    const box = await bounds(page.locator(`[data-photo-card="${photoId}"]`));
    await touchDrag({ x: box.x + box.width * .5, y: box.y + box.height * .5 }, { x: box.x + box.width * .5 + 34, y: box.y + box.height * .5 - 23 });
    const moved = await waitWall(value => value.items[0].x !== before.items[0].x && value.items[0].y !== before.items[0].y);
    await page.getByRole('button', { name: 'Desfazer', exact: true }).tap(); await waitWall(value => JSON.stringify(value.items) === JSON.stringify(before.items));
    await selectPhoto(); const nextBox = await bounds(page.locator(`[data-photo-card="${photoId}"]`));
    await touchDrag({ x: nextBox.x + nextBox.width * .5, y: nextBox.y + nextBox.height * .5 }, { x: nextBox.x + nextBox.width * .5 + 34, y: nextBox.y + nextBox.height * .5 - 23 });
    const frames = [];
    for (const [label, frame] of [['Instantânea', 'polaroid'], ['Fita de papel', 'tape'], ['Arco', 'arch']]) { await page.getByRole('button', { name: label, exact: true }).tap(); await waitWall(value => value.items[0].frame === frame); assert.equal(await page.locator(`[data-photo-card="${photoId}"]`).getAttribute('data-photo-frame'), frame); frames.push(frame); }
    await page.locator('.photo-wall-adjustments input').nth(0).fill('17'); await waitWall(value => value.items[0].angle === 17);
    await page.locator('.photo-wall-adjustments input').nth(1).fill('1.2'); await waitWall(value => value.items[0].size === 1.2);
    await page.getByRole('button', { name: 'Ver foto inteira', exact: true }).tap(); await waitWall(value => value.items[0].fit === 'contain');
    assert.equal(await page.locator(`[data-photo-card="${photoId}"] image`).getAttribute('preserveAspectRatio'), 'xMidYMid meet');
    await page.getByRole('button', { name: 'Preencher moldura', exact: true }).tap(); await waitWall(value => value.items[0].fit === 'cover');
    assert.equal(await page.locator(`[data-photo-card="${photoId}"] image`).getAttribute('preserveAspectRatio'), 'xMidYMid slice');
    await page.getByRole('button', { name: 'Ver foto inteira', exact: true }).tap();
    const backgrounds = [];
    for (const [label, background] of [['Papel claro', 'paper'], ['Parede verde', 'sage'], ['Cortiça', 'cork']]) { await page.getByRole('button', { name: label, exact: true }).tap(); await waitWall(value => value.background === background); assert.equal(await page.locator('.photo-wall-stage').getAttribute('data-wall-background'), background); backgrounds.push(background); }
    const final = await state(); await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('.photo-wall-game').waitFor(); await page.locator(`[data-photo-card="${photoId}"]`).waitFor();
    assert.deepEqual(await state(), final); await selectPhoto();
    assert.equal(await page.locator('.photo-wall-adjustments input').nth(0).inputValue(), '17'); assert.equal(await page.locator('.photo-wall-adjustments input').nth(1).inputValue(), '1.2');
    return { dragBefore: before.items[0], dragAfter: moved.items[0], touchDragUndo: true, frames, backgrounds, final, reload: true };
  });
  await step('real-png-wall-export-shelf-download-and-reload', async () => {
    const before = await records('creations'); await page.getByRole('button', { name: 'Guardar mural', exact: true }).tap();
    const saved = await poll(() => records('creations'), items => items.length === before.length + 1, 'wall PNG did not commit');
    const mural = saved.find(item => item.kind === 'photowall'); assert.ok(mural); assert.match(mural.dataUrl, /^data:image\/png;base64,/);
    const bytes = Buffer.from(mural.dataUrl.split(',')[1], 'base64'); assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a'); assert.equal(bytes.readUInt32BE(16), 1800); assert.equal(bytes.readUInt32BE(20), 1400); assert.ok(bytes.length > 50000);
    const image = await imageInfo(mural.dataUrl); assert.ok(image.maxRed - image.minRed > 80); assert.ok(image.occupiedPixels > 1_000_000);
    await route('saved', '.shelf-wall'); const stored = page.locator(`[data-creation-id="${mural.id}"] img`); await stored.waitFor(); assert.equal(await stored.evaluate(async img => { await img.decode(); return img.naturalWidth; }), 1800);
    await stored.locator('..').tap(); const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Exportar imagem', exact: true }).tap(); const download = await downloading; assert.equal(await download.failure(), null); const exported = await readFile(await download.path()); assert.equal(sha(exported), sha(bytes)); await page.getByRole('button', { name: 'Fechar', exact: true }).tap();
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator(`[data-creation-id="${mural.id}"] img`).waitFor();
    return { id: mural.id, title: mural.title, kind: mural.kind, width: image.width, height: image.height, pngBytes: bytes.length, pngSha256: sha(bytes), image, shelfReload: true, download: download.suggestedFilename() };
  });
  await step('backup-restores-wall-draft-and-deleted-photo-creation', async () => {
    await route('settings', '.settings-page'); const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Exportar backup', exact: true }).tap(); const download = await downloading; const contents = await readFile(await download.path(), 'utf8'), backup = JSON.parse(contents); normalizeBackup(backup);
    const wall = backup.state.find(item => item.key === 'photo-wall').value, photo = backup.creations.find(item => item.id === photoId); assert.ok(photo); assert.equal(photo.kind, 'photo'); assert.ok(backup.creations.some(item => item.kind === 'photowall'));
    await route('photowall', '.photo-wall-game'); await page.getByRole('button', { name: 'Papel claro', exact: true }).tap(); await waitWall(value => value.background === 'paper');
    await route('saved', '.shelf-wall'); await page.locator(`[data-creation-id="${photoId}"]`).getByRole('button', { name: 'Retirar Foto da Leh da prateleira', exact: true }).tap(); await page.getByRole('dialog', { name: 'Retirar criação', exact: true }).getByRole('button', { name: 'Retirar', exact: true }).tap(); await poll(() => records('creations'), items => !items.some(item => item.id === photoId), 'photo was not removed before restore');
    await route('settings', '.settings-page'); await page.locator('#backup-file').setInputFiles({ name: 'photo-wall-backup.json', mimeType: 'application/json', buffer: Buffer.from(contents) }); await page.getByRole('status').filter({ hasText: 'Cópia restaurada.' }).waitFor();
    assert.deepEqual(await state(), wall); assert.deepEqual((await records('creations')).find(item => item.id === photoId), photo);
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('.settings-page').waitFor(); assert.deepEqual(await state(), wall);
    await route('photowall', '.photo-wall-game'); await page.locator(`[data-photo-card="${photoId}"]`).waitFor(); assert.equal(await page.locator(`[data-photo-card="${photoId}"] image`).getAttribute('href'), photo.dataUrl);
    assert.deepEqual(report.externalRequests, [], 'no import, export, photo or backup request goes outside app origin');
    return { backupFilename: download.suggestedFilename(), backupBytes: Buffer.byteLength(contents), normalizedVersion: backup.version, wallRestored: true, photoCreationRemovedAndRestored: photoId, photoSha256: sha(photo.dataUrl), reload: true, outsideOriginRequests: 0 };
  });
  assert.deepEqual(report.externalRequests, []); assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.failure = error.stack ?? String(error); process.exitCode = 1; }
finally { report.endedAt = new Date().toISOString(); report.summary = { passed: report.results.filter(item => item.status === 'PASS').length, failed: report.results.filter(item => item.status === 'FAIL').length, total: report.results.length }; await writeReport(); if (context) await context.close(); if (browser) await browser.close(); console.log(JSON.stringify({ status: report.status, summary: report.summary, output: OUTPUT })); }
