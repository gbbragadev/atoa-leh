import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, devices } from 'playwright';
import { parseBackup } from '../src/lib/backup.ts';

const args = process.argv.slice(2), at = args.indexOf('--base-url');
const BASE = at < 0 ? 'https://atoa-leh.gbbraga-dev.workers.dev' : args[at + 1];
const OUTPUT = resolve('evidence/review-fixes-results.json');
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const report = { suite: 'Correções finais: rascunho, JSON, share, compressão e localStorage', startedAt: new Date().toISOString(), baseUrl: BASE, physicalIPhoneVerified: false, shareHardwareVerified: false, limitations: ['navigator.canShare e navigator.share são interceptados para testar os ramos reais do app; não abre painel nativo nem simula aprovação de hardware.', 'localStorage é bloqueado por getter que lança SecurityError, enquanto IndexedDB continua nativo.', 'Imagem de teste é um PNG público sintético gerado localmente; nenhum conteúdo pessoal entra nos logs.'], results: [], pageErrors: [], consoleErrors: [] };
let browser, context, page;
async function saveReport() { await mkdir(resolve('evidence'), { recursive: true }); await writeFile(OUTPUT, JSON.stringify(report, null, 2)); }
async function step(name, run) { const start = Date.now(); try { const details = await run(); report.results.push({ name, status: 'PASS', elapsedMs: Date.now() - start, details }); console.log(`PASS ${name}`); } catch (error) { report.results.push({ name, status: 'FAIL', elapsedMs: Date.now() - start, error: error.stack ?? String(error) }); console.log(`FAIL ${name}: ${error.message}`); throw error; } finally { await saveReport(); } }
async function createContext(blockLocalStorage = false) {
  if (context) await context.close(); context = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: 'pt-BR', acceptDownloads: true });
  if (blockLocalStorage) await context.addInitScript(() => { window.__localStorageBlocked = 0; Object.defineProperty(window, 'localStorage', { configurable: true, get() { window.__localStorageBlocked++; throw new DOMException('QA localStorage disabled', 'SecurityError'); } }); });
  page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', error => report.pageErrors.push(error.message)); page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  await page.goto(BASE, { waitUntil: 'networkidle' }); await page.locator('.app-shell').waitFor(); const intro = page.getByRole('dialog', { name: 'Bem-vinda ao seu cantinho' }); if (await intro.isVisible().catch(() => false)) await intro.getByRole('button', { name: 'Pular', exact: true }).tap();
}
async function records(store) { return page.evaluate(store => new Promise((done, fail) => { const request = indexedDB.open('atoa-leticia-gallery'); request.onerror = () => fail(request.error); request.onsuccess = () => { const db = request.result, tx = db.transaction(store), read = tx.objectStore(store).getAll(); tx.oncomplete = () => { db.close(); done(read.result); }; tx.onerror = () => { db.close(); fail(tx.error); }; tx.onabort = () => { db.close(); fail(tx.error); }; }; }), store); }
async function state(key) { return (await records('state')).find(item => item.key === key)?.value; }
async function poll(read, predicate, message) { const end = Date.now() + 12000; do { const value = await read(); if (predicate(value)) return value; await page.waitForTimeout(60); } while (Date.now() < end); assert.fail(message); }
async function settings() { await page.evaluate(() => { location.hash = 'settings'; }); await page.locator('.settings-page').waitFor(); }
async function exportDownload() { await page.evaluate(() => { Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }); }); const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: 'Exportar backup', exact: true }).tap(); const download = await downloading; assert.equal(await download.failure(), null); const contents = await readFile(await download.path(), 'utf8'); return { contents, data: parseBackup(contents), filename: download.suggestedFilename() }; }

try {
  browser = await chromium.launch({ headless: true }); report.browserVersion = browser.version(); await createContext();
  await step('editor-draft-survives-close-reopen-and-reload-then-clears-on-save', async () => {
    await settings(); const originalGiftHash = hash(await state('gift-content'));
    await page.getByRole('button', { name: 'Escrever ou editar', exact: true }).tap(); const editor = page.getByRole('dialog', { name: 'Escrever as palavras do presente' }); await editor.waitFor();
    const draft = { letter: 'QA draft retained locally before explicit save.', notes: 'QA note one.\n\nQA note two.' };
    const letterInput = editor.locator('textarea').nth(0), notesInput = editor.locator('textarea').nth(1);
    await letterInput.fill(draft.letter); await notesInput.fill(draft.notes);
    await poll(() => state('gift-editor-draft'), value => hash(value) === hash(draft), 'editor draft not committed to IndexedDB');
    await editor.getByRole('button', { name: 'Fechar', exact: true }).tap(); await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('.settings-page').waitFor();
    assert.equal(hash(await state('gift-content')), originalGiftHash, 'closing draft must not commit edited words');
    await page.getByRole('button', { name: 'Escrever ou editar', exact: true }).tap();
    assert.equal(hash(await letterInput.inputValue()), hash(draft.letter)); assert.equal(hash(await notesInput.inputValue()), hash(draft.notes));
    await editor.getByRole('button', { name: 'Guardar as palavras', exact: false }).tap(); await editor.waitFor({ state: 'hidden' });
    await poll(() => state('gift-editor-draft'), value => value === null, 'saved editor draft not cleared'); const gift = await state('gift-content'); assert.equal(hash(gift.letter), hash(draft.letter)); assert.equal(gift.notes.length, 2);
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('.settings-page').waitFor(); assert.equal(await state('gift-editor-draft'), null); assert.equal(hash((await state('gift-content')).letter), hash(draft.letter));
    return { draftSha256: hash(draft), closedBeforeReload: true, wordsUnchangedUntilSave: true, reopenedExactDraft: true, savedNotes: 2, draftClearedAfterSaveAndReload: true };
  });
  await step('compact-json-backup-download-fallback-is-valid', async () => {
    await settings(); const exported = await exportDownload(); assert.equal(exported.contents, JSON.stringify(JSON.parse(exported.contents)), 'downloaded JSON is compact'); assert.ok(exported.data.state.some(item => item.key === 'gift-editor-draft' && item.value === null));
    return { version: exported.data.version, bytes: Buffer.byteLength(exported.contents), prettyBytes: Buffer.byteLength(JSON.stringify(JSON.parse(exported.contents), null, 2)), compact: true, creations: exported.data.creations.length, sha256: hash(exported.contents), filename: exported.filename, nativeShareInvoked: false };
  });
  await step('json-share-branch-passes-real-file-and-cancel-is-not-an-error', async () => {
    await page.evaluate(() => { window.__reviewShare = { calls: [], canShareCalls: 0 }; Object.defineProperty(navigator, 'canShare', { configurable: true, value: data => { window.__reviewShare.canShareCalls++; return data.files.length === 1 && data.files[0] instanceof File && data.files[0].type === 'application/json'; } }); Object.defineProperty(navigator, 'share', { configurable: true, value: async data => { const file = data.files[0]; window.__reviewShare.calls.push({ name: file.name, type: file.type, size: file.size, contents: await file.text() }); } }); });
    await page.getByRole('button', { name: 'Exportar backup', exact: true }).tap(); const captured = await poll(() => page.evaluate(() => window.__reviewShare.calls[0]), Boolean, 'navigator.share branch never reached');
    const backup = parseBackup(captured.contents); assert.equal(captured.type, 'application/json'); assert.match(captured.name, /^atoa-leh-.*\.json$/); assert.equal(captured.contents, JSON.stringify(JSON.parse(captured.contents))); assert.equal(captured.size, Buffer.byteLength(captured.contents));
    await page.getByRole('button', { name: 'Exportar backup', exact: true }).waitFor({ state: 'visible' });
    await page.evaluate(() => { Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { window.__reviewShare.abortCalls = (window.__reviewShare.abortCalls ?? 0) + 1; throw new DOMException('QA cancelled share', 'AbortError'); } }); });
    await page.getByRole('button', { name: 'Exportar backup', exact: true }).tap(); await poll(() => page.evaluate(() => window.__reviewShare.abortCalls ?? 0), value => value === 1, 'abort branch never reached');
    await poll(() => page.getByRole('button', { name: 'Exportar backup', exact: true }).isEnabled(), Boolean, 'busy did not clear after cancellation'); assert.equal(await page.locator('[role="alert"]').count(), 0);
    return { mockAPIExplicit: true, actualAppShareBranch: true, canShareCalls: await page.evaluate(() => window.__reviewShare.canShareCalls), fileType: captured.type, filename: captured.name, fileBytes: captured.size, fileSha256: hash(captured.contents), backupVersion: backup.version, creations: backup.creations.length, compact: true, abortIgnoredWithoutAlert: true, physicalShareSheetTested: false };
  });
  await step('settings-photo-import-compresses-large-png-to-jpeg-at-1600px', async () => {
    const fixture = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 2400; canvas.height = 1800; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#5c8267'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#ebba76'; ctx.fillRect(400, 300, 900, 800); return canvas.toDataURL('image/png'); }); const buffer = Buffer.from(fixture.split(',')[1], 'base64'); const before = await records('creations');
    await page.locator('#photos-file').setInputFiles({ name: 'qa-large-public-image.png', mimeType: 'image/png', buffer });
    const creations = await poll(() => records('creations'), items => items.length === before.length + 1, 'settings photo import did not commit'); const item = creations.find(item => !before.some(old => old.id === item.id)); assert.match(item.dataUrl, /^data:image\/jpeg;base64,/);
    const dimensions = await page.evaluate(async dataUrl => { const image = new Image(); image.src = dataUrl; await image.decode(); return { width: image.naturalWidth, height: image.naturalHeight }; }, item.dataUrl); assert.deepEqual(dimensions, { width: 1600, height: 1200 });
    return { input: { mime: 'image/png', width: 2400, height: 1800, bytes: buffer.length }, stored: { mime: 'image/jpeg', ...dimensions, bytes: Buffer.from(item.dataUrl.split(',')[1], 'base64').length }, compressedThroughSettingsUI: true };
  });
  await createContext(true);
  await step('blocked-localstorage-does-not-cause-spurious-backup-warning', async () => {
    await settings(); assert.ok(await page.evaluate(() => window.__localStorageBlocked > 0), 'localStorage fault was actually encountered'); assert.equal(await page.locator('[role="alert"]').count(), 0); const exported = await exportDownload(); assert.equal(exported.data.creations.length, 12); assert.equal(await page.locator('[role="alert"]').count(), 0);
    const stateRecords = await records('state'); assert.ok(stateRecords.length > 2); return { localStorageDeniedReads: await page.evaluate(() => window.__localStorageBlocked), indexedDBNative: true, stateRecords: stateRecords.length, exportedCreations: exported.data.creations.length, backupValid: true, alerts: 0 };
  });
  assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.failure = error.stack ?? String(error); process.exitCode = 1; }
finally { report.endedAt = new Date().toISOString(); report.summary = { passed: report.results.filter(item => item.status === 'PASS').length, failed: report.results.filter(item => item.status === 'FAIL').length, total: report.results.length }; await saveReport(); if (context) await context.close(); if (browser) await browser.close(); console.log(JSON.stringify({ status: report.status, summary: report.summary, output: OUTPUT })); }
