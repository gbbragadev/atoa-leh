import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { chromium, devices, webkit } from 'playwright';

const BASE = process.env.PERSISTENCE_TEST_URL ?? 'http://127.0.0.1:5188';
const DATABASE = 'atoa-leticia-gallery';
const EVIDENCE = resolve('evidence/persistence-results.json');
const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
const engineOption = option('--browser') ?? 'both';
const selectedCase = option('--case');
const report = {
  suite: 'Persistência, backup, falhas recuperáveis, migração e offline real',
  startedAt: new Date().toISOString(),
  baseUrl: BASE,
  device: 'Emulação iPhone 13, 390 × 844 CSS pixels, touch; Chromium e WebKit de desktop.',
  limitations: [
    'Não é um iPhone físico. Não valida seletor de arquivos nativo do iOS, compartilhamento nativo, retenção de dados pelo Safari no aparelho nem suspensão pelo sistema operacional.',
    'Segundo plano é simulado com visibilitychange/pagehide e verificação dos efeitos observáveis; fechar e reabrir uma página é real.',
    'Falhas de quota e abort são injetadas nos métodos nativos de IndexedDB; o teste observa UI, transação e registros persistidos.',
    'Atualização do service worker usa um servidor HTTP local de teste que entrega o build de produção e altera somente a versão do worker.',
  ],
  runs: [],
  summary: { passed: 0, failed: 0, blocked: 0 },
};

async function writeReport() { await mkdir(resolve('evidence'), { recursive: true }); await writeFile(EVIDENCE, JSON.stringify(report, null, 2)); }
async function poll(callback, predicate, message, timeout = 15000) {
  const end = Date.now() + timeout;
  let value;
  do { value = await callback(); if (predicate(value)) return value; await new Promise(done => setTimeout(done, 60)); } while (Date.now() < end);
  assert.fail(`${message}. Last value: ${JSON.stringify(value).slice(0, 1000)}`);
}
async function state(page, key) {
  return page.evaluate(async ({ database, key }) => {
    const db = await new Promise((done, fail) => { const request = indexedDB.open(database); request.onsuccess = () => done(request.result); request.onerror = () => fail(request.error); });
    try { return await new Promise((done, fail) => { const tx = db.transaction('state'); const request = tx.objectStore('state').get(key); tx.oncomplete = () => done(request.result?.value ?? null); tx.onabort = () => fail(tx.error); tx.onerror = () => fail(tx.error); }); } finally { db.close(); }
  }, { database: DATABASE, key });
}
async function snapshot(page) {
  return page.evaluate(async database => {
    const db = await new Promise((done, fail) => { const request = indexedDB.open(database); request.onsuccess = () => done(request.result); request.onerror = () => fail(request.error); });
    try {
      return await new Promise((done, fail) => { const tx = db.transaction(['creations', 'state']); const creations = tx.objectStore('creations').getAll(); const records = tx.objectStore('state').getAll(); tx.oncomplete = () => done({ version: db.version, creations: creations.result, state: records.result }); tx.onabort = () => fail(tx.error); tx.onerror = () => fail(tx.error); });
    } finally { db.close(); }
  }, DATABASE);
}
async function waitState(page, key, predicate) { return poll(() => state(page, key), value => value !== null && predicate(value), `${key} did not persist`); }
async function boot(page, url = BASE) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('.app-shell').waitFor();
  const intro = page.getByRole('dialog', { name: 'Bem-vinda ao seu cantinho' });
  if (await intro.isVisible().catch(() => false)) await intro.getByRole('button', { name: 'Pular', exact: true }).click();
  await waitState(page, 'intro-seen', value => value === true);
}
async function route(page, hash, selector) {
  await page.evaluate(hash => { location.hash = hash; }, hash);
  if (selector) await page.locator(selector).waitFor({ state: 'visible' });
}
async function settings(page) { await route(page, 'settings', '.settings-page'); }
async function exportBackup(page) {
  await settings(page);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar backup', exact: true }).click();
  const download = await downloading;
  assert.equal(await download.failure(), null);
  const contents = await readFile(await download.path(), 'utf8');
  const data = JSON.parse(contents);
  assert.equal(data.format, 'atoa-leticia'); assert.equal(data.version, 2);
  return { data, contents, filename: download.suggestedFilename() };
}
async function importBackup(page, backup) {
  await settings(page);
  await page.locator('#backup-file').setInputFiles({ name: 'qa-backup.json', mimeType: 'application/json', buffer: Buffer.from(typeof backup === 'string' ? backup : JSON.stringify(backup)) });
}
async function expectRestored(page) { await page.getByRole('status').filter({ hasText: 'Cópia restaurada.' }).waitFor({ state: 'visible' }); }
async function png(page, color = '#df835f') {
  return page.evaluate(color => { const canvas = document.createElement('canvas'); canvas.width = 40; canvas.height = 30; const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, 40, 30); ctx.fillStyle = '#456c56'; ctx.fillRect(7, 5, 17, 11); return canvas.toDataURL('image/png'); }, color);
}
async function createClay(page, label = 'QA piece') {
  await route(page, 'clay', '.clay-game');
  await page.getByRole('textbox', { name: 'Texto na cerâmica' }).fill(label);
  await page.getByRole('combobox', { name: 'Planta do vasinho' }).selectOption('flower');
  await page.getByRole('button', { name: 'Carimbar no centro', exact: true }).click();
  await waitState(page, 'clay', value => value.text === label && value.plant === 'flower' && value.motifs.length >= 2);
  const beforeRecords = (await snapshot(page)).creations;
  const before = beforeRecords.length;
  await page.getByRole('button', { name: 'Guardar no cantinho', exact: true }).click();
  const saved = await poll(() => snapshot(page), result => result.creations.length === before + 1, 'clay image not committed');
  await page.getByRole('status').filter({ hasText: 'Sua criação está no cantinho.' }).waitFor({ state: 'visible' });
  const creation = saved.creations.find(item => !beforeRecords.some(old => old.id === item.id));
  assert.match(creation.dataUrl, /^data:image\/png;base64,iVBOR/);
  return creation;
}
function sortRecords(records) { return [...records].sort((a, b) => (a.key ?? a.id).localeCompare(b.key ?? b.id)); }
function recordValue(backup, key) { return backup.state.find(item => item.key === key)?.value; }
function changeRecord(backup, key, value) {
  const record = backup.state.find(item => item.key === key);
  if (record) { record.value = value; record.updatedAt = Date.now(); }
  else backup.state.push({ key, version: 1, updatedAt: Date.now(), value });
}
async function patchPut(page, target) {
  await page.evaluate(target => {
    const native = IDBObjectStore.prototype.put;
    window.__qaPut = { native, mode: typeof target === 'string' ? target : target.mode, abortAfter: typeof target === 'string' ? 1 : target.abortAfter, statePuts: 0, hits: 0 };
    IDBObjectStore.prototype.put = function (...args) {
      const qa = window.__qaPut;
      if (qa.mode === 'creation-quota' && this.name === 'creations') { qa.hits++; throw new DOMException('QA simulated quota failure', 'QuotaExceededError'); }
      if (qa.mode === 'state-quota' && this.name === 'state') { qa.hits++; throw new DOMException('QA simulated quota failure', 'QuotaExceededError'); }
      const request = native.apply(this, args);
      if (qa.mode === 'import-abort' && this.name === 'state' && this.transaction.objectStoreNames.contains('creations') && ++qa.statePuts === qa.abortAfter) { qa.hits++; this.transaction.abort(); qa.mode = 'aborted'; }
      return request;
    };
  }, target);
}
async function unpatchPut(page) { return page.evaluate(() => { const hits = window.__qaPut.hits; IDBObjectStore.prototype.put = window.__qaPut.native; return hits; }); }
async function newTestContext(browser) {
  return browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: 'pt-BR', acceptDownloads: true });
}
async function prepareOffline(page) {
  await poll(() => page.evaluate(async () => !!(await navigator.serviceWorker?.getRegistration())?.active), Boolean, 'production service worker never activated', 30000);
  // A first install may become active without claiming the already open document.
  // A real reload puts the app under the active worker before connectivity is removed.
  if (!await page.evaluate(() => !!navigator.serviceWorker.controller)) {
    await page.reload({ waitUntil: 'load' }); await page.locator('.app-shell').waitFor();
  }
  await poll(() => page.evaluate(() => !!navigator.serviceWorker?.controller), Boolean, 'service worker never controlled the production page', 30000);
  const cached = await poll(() => page.evaluate(async () => { const names = await caches.keys(); const urls = []; for (const name of names) { for (const request of await (await caches.open(name)).keys()) urls.push(request.url); } return { names, urls }; }), data => data.urls.some(url => /Atelier.*\.js/.test(url)) && data.urls.some(url => /Clay.*\.js/.test(url)) && data.urls.some(url => /WordSearch.*\.js/.test(url)) && data.urls.some(url => /woff2/.test(url)), 'lazy modules and fonts not precached', 30000);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; await document.fonts.ready; });
  return cached;
}
async function proxyServer() {
  let version = 1; let blockNetwork = false; let refusedRequests = 0;
  const server = createServer(async (request, response) => {
    if (blockNetwork) { refusedRequests++; response.destroy(); return; }
    try {
      const upstream = await fetch(new URL(request.url, BASE));
      const body = await upstream.arrayBuffer();
      response.statusCode = upstream.status;
      for (const name of ['content-type', 'service-worker-allowed']) { const header = upstream.headers.get(name); if (header) response.setHeader(name, header); }
      response.setHeader('cache-control', 'no-store');
      if (new URL(request.url, BASE).pathname === '/sw.js') response.end(`/* QA worker revision ${version} */\n${Buffer.from(body).toString('utf8')}`);
      else response.end(Buffer.from(body));
    } catch (error) { response.statusCode = 502; response.end(error.message); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  return { url: `http://127.0.0.1:${server.address().port}`, update: () => { version++; }, block: () => { blockNetwork = true; }, refused: () => refusedRequests, close: () => new Promise(done => { server.close(done); server.closeAllConnections?.(); }) };
}

const cases = [
  {
    name: 'ui-backup-roundtrip-private-content-and-image',
    async run(page, browser) {
      await boot(page);
      await createClay(page, 'QA undecided vase');
      await route(page, 'atelier', '.art-game');
      await page.getByRole('button', { name: 'Cor 4', exact: true }).click();
      const region = page.locator('[data-art-region]').first();
      await region.focus(); await page.keyboard.press('Enter');
      await waitState(page, 'atelier-artwork', value => Object.keys(value.regions).length > 0);
      await page.getByRole('button', { name: 'Guardar na galeria', exact: true }).click();
      await poll(() => snapshot(page), data => data.creations.length === 2, 'unfinished drawing was not saved');
      await settings(page);
      await page.getByRole('textbox', { name: 'Seu apelido', exact: true }).fill('QA local nickname');
      await page.getByRole('button', { name: 'Lavanda', exact: true }).click();
      await page.getByRole('checkbox', { name: /Menos movimento/ }).check();
      const privateGift = { version: 1, letter: 'QA private letter. This is synthetic test content.', notes: ['QA synthetic note one.', 'QA synthetic note two.'], cats: [{ name: 'QA orange', coat: 'orange' }, { name: 'QA cow', coat: 'cow' }, { name: 'QA siamese', coat: 'siamese' }] };
      await page.locator('#gift-file').setInputFiles({ name: 'qa-private-gift.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(privateGift)) });
      await waitState(page, 'gift-content', value => value.letter === privateGift.letter);
      const image = await png(page);
      await page.locator('#photos-file').setInputFiles({ name: 'qa-private-image.png', mimeType: 'image/png', buffer: Buffer.from(image.split(',')[1], 'base64') });
      await poll(() => snapshot(page), data => data.creations.length === 3, 'imported photo did not commit');
      await route(page, 'saved', '.shelf-wall');
      await page.locator('.shelf-item').first().getByRole('button', { name: /para a direita$/ }).click();
      await waitState(page, 'shelf-layout', value => value.length === 3);
      const backup = await exportBackup(page);
      assert.equal(recordValue(backup.data, 'settings').nickname, 'QA local nickname');
      assert.equal(recordValue(backup.data, 'settings').theme, 'lavender');
      assert.equal(recordValue(backup.data, 'settings').reducedMotion, true);
      assert.equal(recordValue(backup.data, 'gift-content').letter, privateGift.letter);
      assert.equal(backup.data.creations.find(item => item.kind === 'photo').dataUrl, image);
      const target = await newTestContext(browser);
      const fresh = await target.newPage(); fresh.setDefaultTimeout(12000);
      try {
        await boot(fresh);
        const unrelated = await createClay(fresh, 'QA unrelated creation');
        await importBackup(fresh, backup.contents); await expectRestored(fresh);
        const restored = await snapshot(fresh);
        for (const item of backup.data.state) assert.deepEqual(restored.state.find(record => record.key === item.key), item, `${item.key} was not restored`);
        assert.deepEqual(sortRecords(restored.creations), sortRecords([...backup.data.creations, unrelated]), 'import also preserves unrelated creations already on this device');
        assert.equal(await fresh.getByRole('textbox', { name: 'Seu apelido' }).inputValue(), 'QA local nickname');
        assert.equal(await fresh.locator('html').getAttribute('data-theme'), 'lavender');
        await fresh.reload({ waitUntil: 'networkidle' });
        await fresh.locator('.settings-page').waitFor();
        assert.equal(await fresh.getByRole('textbox', { name: 'Seu apelido' }).inputValue(), 'QA local nickname');
        await route(fresh, 'saved', '.shelf-wall');
        await poll(() => fresh.locator('[data-creation-id] img').evaluateAll(images => images.map(image => image.complete && image.naturalWidth > 0)), images => images.length === 4 && images.every(Boolean), 'restored creation images did not decode');
        const shown = await fresh.locator('[data-creation-id]').evaluateAll(items => items.map(item => ({ id: item.dataset.creationId, image: item.querySelector('img').src, loaded: item.querySelector('img').complete && item.querySelector('img').naturalWidth > 0 })));
        assert.deepEqual(shown.map(item => item.id), [...recordValue(backup.data, 'shelf-layout'), unrelated.id]);
        for (const item of shown) { assert.equal(item.loaded, true); assert.equal(item.image, [...backup.data.creations, unrelated].find(creation => creation.id === item.id).dataUrl); }
        await route(fresh, 'clay', '.clay-game'); assert.equal(await fresh.getByRole('textbox', { name: 'Texto na cerâmica' }).inputValue(), 'QA undecided vase');
        await route(fresh, 'atelier', '.art-game'); assert.deepEqual(await state(fresh, 'atelier-artwork'), recordValue(backup.data, 'atelier-artwork'));
        await route(fresh, 'cats', '.cats-canvas');
        for (const profile of privateGift.cats) assert.equal(await fresh.getByRole('button', { name: profile.name, exact: true }).count(), 1, 'private imported cat profiles are also restored');
        await route(fresh, 'love', '.letter-paper'); assert.match(await fresh.locator('.letter-text').innerText(), /QA private letter/);
        await fresh.getByRole('button', { name: 'Pegar um bilhete', exact: true }).click(); assert.match(await fresh.getByRole('dialog', { name: 'Um bilhete para você' }).innerText(), /QA synthetic note/);
        return { exportedFile: backup.filename, stateKeys: backup.data.state.map(item => item.key), creationCount: backup.data.creations.length, unrelatedCreationPreserved: unrelated.id, fullImageBytesPreserved: true, partialDrawing: true, shelfOrderPreserved: true, privateLetterAndNotesPreserved: true, reload: true };
      } finally { await target.close(); }
    },
  },
  {
    name: 'invalid-import-preserves-database-and-live-cache',
    async run(page) {
      await boot(page); await createClay(page, 'QA untouched');
      await settings(page); await page.getByRole('textbox', { name: 'Seu apelido' }).fill('QA unchanged'); await waitState(page, 'settings', value => value.nickname === 'QA unchanged');
      const backup = await exportBackup(page); const before = await snapshot(page);
      const invalid = structuredClone(backup.data); recordValue(invalid, 'settings').theme = 'invalid-theme';
      await importBackup(page, invalid);
      await page.getByRole('alert').filter({ hasText: /inválid/ }).waitFor({ state: 'visible' });
      assert.deepEqual(await snapshot(page), before); assert.equal(await page.getByRole('textbox', { name: 'Seu apelido' }).inputValue(), 'QA unchanged');
      assert.equal(await page.getByRole('status').filter({ hasText: 'Cópia restaurada.' }).count(), 0);
      const after = await exportBackup(page);
      assert.deepEqual(sortRecords(after.data.state), sortRecords(backup.data.state)); assert.deepEqual(sortRecords(after.data.creations), sortRecords(backup.data.creations));
      return { corruptField: 'settings.theme', unchangedRecords: before.state.length + before.creations.length, liveNicknameUnchanged: true, falseSuccess: false };
    },
  },
  {
    name: 'import-abort-rolls-back-images-state-and-live-cache',
    async run(page) {
      await boot(page); await createClay(page, 'QA rollback base');
      await settings(page); await page.getByRole('textbox', { name: 'Seu apelido' }).fill('QA before rollback'); await waitState(page, 'settings', value => value.nickname === 'QA before rollback');
      const backup = await exportBackup(page); const before = await snapshot(page);
      const incoming = structuredClone(backup.data); recordValue(incoming, 'settings').nickname = 'QA SHOULD NOT APPEAR'; recordValue(incoming, 'clay').text = 'QA not committed';
      incoming.creations.push({ ...incoming.creations[0], id: 'qa-aborted-creation', title: 'QA invisible rollback image', createdAt: Date.now() });
      await patchPut(page, { mode: 'import-abort', abortAfter: incoming.state.length });
      await importBackup(page, incoming);
      await page.getByRole('alert').filter({ hasText: /restaura|cancelad|abort|gravar esta cópia/i }).waitFor({ state: 'visible' });
      assert.equal(await unpatchPut(page), 1);
      assert.deepEqual(await snapshot(page), before, 'the transaction must roll back every state and image write');
      assert.equal(await page.getByRole('textbox', { name: 'Seu apelido' }).inputValue(), 'QA before rollback');
      const after = await exportBackup(page);
      assert.deepEqual(sortRecords(after.data.state), sortRecords(backup.data.state), 'the in-memory cache must not update before transaction completion');
      assert.deepEqual(sortRecords(after.data.creations), sortRecords(backup.data.creations));
      return { abortAfterAllStateAndCreationPutsBeforeCommit: true, attemptedStateWrites: incoming.state.length, attemptedNewImage: incoming.creations.at(-1).id, databaseRolledBack: true, cacheRolledBack: true, unrelatedLocalRecordsPreserved: true };
    },
  },
  {
    name: 'creation-quota-never-confirms-a-save',
    async run(page) {
      await boot(page); await route(page, 'clay', '.clay-game');
      await page.getByRole('textbox', { name: 'Texto na cerâmica' }).fill('QA quota draft'); await waitState(page, 'clay', value => value.text === 'QA quota draft');
      const before = await snapshot(page); await patchPut(page, 'creation-quota');
      await page.getByRole('button', { name: 'Guardar no cantinho', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Não consegui guardar a peça.' }).waitFor({ state: 'visible' });
      const after = await snapshot(page); assert.deepEqual(after.creations, before.creations);
      assert.equal(await page.getByRole('status').filter({ hasText: 'Sua criação está no cantinho.' }).count(), 0);
      assert.equal(await page.getByRole('textbox', { name: 'Texto na cerâmica' }).inputValue(), 'QA quota draft');
      const failures = await unpatchPut(page); assert.equal(failures, 1);
      await page.getByRole('button', { name: 'Guardar no cantinho', exact: true }).click();
      await poll(() => snapshot(page), data => data.creations.length === before.creations.length + 1, 'retrying the actual creation save did not recover');
      await page.getByRole('status').filter({ hasText: 'Sua criação está no cantinho.' }).waitFor({ state: 'visible' });
      const retry = page.getByRole('button', { name: 'Tentar guardar de novo', exact: true });
      if (await retry.count()) await retry.click();
      await page.getByRole('alert').filter({ hasText: 'Não consegui guardar algumas alterações.' }).waitFor({ state: 'hidden' });
      return { error: 'QuotaExceededError', simulatedFailures: failures, creationsDuringFailure: after.creations.length, draftPreserved: true, falsePositive: false, explicitSaveAfterRecovery: true, persistentWarningClearedAfterRecovery: true };
    },
  },
  {
    name: 'state-quota-warning-backup-and-retry',
    async run(page) {
      await boot(page); await settings(page); await waitState(page, 'settings', value => value.nickname === 'Leh');
      await patchPut(page, 'state-quota');
      await page.getByRole('textbox', { name: 'Seu apelido' }).fill('QA memory-only');
      await page.getByRole('alert').filter({ hasText: 'Não consegui guardar algumas alterações.' }).waitFor({ state: 'visible' });
      assert.equal((await state(page, 'settings')).nickname, 'Leh');
      await route(page, 'home', '.home-hero'); assert.match(await page.getByRole('heading', { level: 1 }).innerText(), /QA memory-only/);
      assert.equal(await page.getByRole('alert').filter({ hasText: 'Não consegui guardar algumas alterações.' }).isVisible(), true);
      await settings(page); const recovery = await exportBackup(page);
      assert.equal(recordValue(recovery.data, 'settings').nickname, 'QA memory-only', 'backup includes the unsaved in-memory draft');
      const failures = await unpatchPut(page); assert.ok(failures >= 1);
      await page.getByRole('button', { name: 'Tentar guardar de novo', exact: true }).click();
      await waitState(page, 'settings', value => value.nickname === 'QA memory-only');
      await page.getByRole('alert').filter({ hasText: 'Não consegui guardar algumas alterações.' }).waitFor({ state: 'hidden' });
      await page.reload({ waitUntil: 'networkidle' }); assert.equal(await page.getByRole('textbox', { name: 'Seu apelido' }).inputValue(), 'QA memory-only');
      return { persistedDuringFailure: 'Leh', inMemoryDuringFailure: 'QA memory-only', warningSurvivedNavigation: true, recoverableBackup: true, retryCommitted: true, reloadPreserved: true, simulatedFailures: failures };
    },
  },
  {
    name: 'legacy-v1-migration-preserves-originals-and-private-gift',
    async run(page) {
      await page.route('**/__qa_fixture__', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>QA fixture origin</title>' }));
      await page.goto(`${BASE}/__qa_fixture__`);
      const image = await png(page, '#75a47b'); const createdAt = Date.now() - 60000;
      const legacySettings = { nickname: 'QA legacy', theme: 'rose', sound: true, reducedMotion: true, letter: 'QA legacy private letter' };
      const legacyClay = { shape: 'pratinho', color: '#b7987b', width: 112, height: 190, text: 'QA legacy', motifs: [{ x: 240, y: 270, type: 'pata', color: '#fff9ed' }] };
      await page.evaluate(async ({ database, image, createdAt, legacySettings, legacyClay }) => {
        localStorage.setItem('atoa-leticia:settings', JSON.stringify({ version: 1, value: legacySettings }));
        localStorage.setItem('atoa-leticia:clay', JSON.stringify(legacyClay));
        localStorage.setItem('atoa-leticia:intro-seen', 'true');
        localStorage.setItem('atoa-leticia:shelf-layout', JSON.stringify(['qa-legacy-image']));
        localStorage.setItem('atoa-leticia:love-notes', JSON.stringify(['QA legacy private note']));
        const db = await new Promise((done, fail) => { const request = indexedDB.open(database, 1); request.onupgradeneeded = () => request.result.createObjectStore('creations', { keyPath: 'id' }); request.onsuccess = () => done(request.result); request.onerror = () => fail(request.error); });
        await new Promise((done, fail) => { const tx = db.transaction('creations', 'readwrite'); tx.objectStore('creations').put({ id: 'qa-legacy-image', createdAt, title: 'QA old painted piece', kind: 'clay', dataUrl: image }); tx.oncomplete = done; tx.onerror = () => fail(tx.error); }); db.close();
      }, { database: DATABASE, image, createdAt, legacySettings, legacyClay });
      await page.unroute('**/__qa_fixture__'); await boot(page);
      await waitState(page, 'gift-content', value => value.letter === legacySettings.letter);
      const migrated = await snapshot(page); assert.equal(migrated.version, 2);
      assert.equal(migrated.creations.length, 1); assert.equal(migrated.creations[0].dataUrl, image); assert.equal(migrated.creations[0].createdAt, createdAt);
      assert.deepEqual(await state(page, 'settings'), legacySettings); assert.deepEqual(await state(page, 'clay'), legacyClay);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('atoa-leticia:settings')).value.letter), legacySettings.letter, 'legacy originals are retained');
      await route(page, 'saved', '.shelf-wall'); assert.equal(await page.locator('[data-creation-id="qa-legacy-image"] img').getAttribute('src'), image);
      await route(page, 'clay', '.clay-game'); assert.equal(await page.getByRole('textbox', { name: 'Texto na cerâmica' }).inputValue(), 'QA legacy');
      await page.reload({ waitUntil: 'networkidle' }); await page.locator('.clay-game').waitFor();
      assert.equal((await snapshot(page)).creations.length, 1); assert.equal(await page.getByRole('textbox', { name: 'Texto na cerâmica' }).inputValue(), 'QA legacy');
      const backup = await exportBackup(page); assert.equal(recordValue(backup.data, 'gift-content').notes[0], 'QA legacy private note');
      return { databaseBefore: 1, databaseAfter: migrated.version, originalImageBytesPreserved: true, localStorageOriginalsPreserved: true, migratedPrivateLetterAndNote: true, draftPreserved: true, noDuplicateCreationsAfterReload: true };
    },
  },
  {
    name: 'offline-core-and-all-lazy-games-after-home-only-preparation',
    async run(page, _browser, { engine }) {
      const context = page.context(); const requested = []; const failed = [];
      page.on('request', request => requested.push(request.url())); page.on('requestfailed', request => failed.push({ url: request.url(), error: request.failure()?.errorText }));
      const proxy = await proxyServer();
      try {
      await boot(page, proxy.url); const cached = await prepareOffline(page);
      assert.equal(requested.some(url => /\/(Atelier|Clay|WordSearch|Garden|Cats|Sand|Crochet|SoftWord|Memory|Constellation)[^/]*\.js/.test(url)), false, 'no lazy game was opened online before offline verification');
      await context.setOffline(true);
      let offlineMethod = 'Playwright context.setOffline(true), navigator offline'; let driverLimitation;
      try { await page.reload({ waitUntil: 'load' }); }
      catch (error) {
        if (engine !== 'webkit' || !error.message.includes('WebKit encountered an internal error')) throw error;
        driverLimitation = error.message;
        await context.setOffline(false);
        // This Windows WebKit port can reject navigation at the driver layer before
        // delivering it to the service worker. Deny the actual HTTP transport instead.
        proxy.block(); offlineMethod = 'HTTP transport unavailable: local origin refuses every network connection; OS navigator.onLine remains true';
        await page.reload({ waitUntil: 'load' });
      }
      await page.locator('.home-hero').waitFor({ state: 'visible' });
      const hero = await poll(() => page.locator('.hero-art img').evaluate(img => ({ complete: img.complete, width: img.naturalWidth })), image => image.complete && image.width > 0, 'offline hero image never decoded');
      await page.evaluate(() => document.fonts.ready); assert.equal(await page.evaluate(() => document.fonts.check('18px "DM Sans"') && document.fonts.check('24px Fraunces')), true);
      await route(page, 'atelier', '.art-game'); const region = page.locator('[data-art-region]').first(); await region.focus(); await page.keyboard.press('Enter');
      await waitState(page, 'atelier-artwork', value => Object.keys(value.regions).length > 0); await page.getByRole('button', { name: 'Guardar na galeria', exact: true }).click();
      await poll(() => snapshot(page), data => data.creations.length === 1, 'offline painting export not committed');
      await createClay(page, 'QA offline vase');
      await route(page, 'wordsearch', '.words-search-board'); assert.ok([64, 100].includes(await page.getByRole('gridcell').count()));
      await page.getByRole('button', { name: 'Uma dica, por favor', exact: true }).click(); await waitState(page, 'wordsearch-v1', value => value.hint !== null);
      const extras = [['garden', '.garden-canvas'], ['cats', '.cats-canvas'], ['sand', '.sand-canvas'], ['crochet', '.crochet-svg'], ['word', '.words-keyboard'], ['memory', '.memory-board'], ['constellation', '.constellation-board']];
      for (const [hash, selector] of extras) { await route(page, hash, selector); assert.equal(await page.locator(selector).isVisible(), true); }
      const backup = await exportBackup(page); assert.equal(backup.data.creations.length, 2); assert.ok(backup.data.state.find(record => record.key === 'wordsearch-v1'));
      await importBackup(page, backup.contents); await expectRestored(page);
      const origin = new URL(proxy.url).origin; const crossOrigin = requested.filter(url => /^https?:/.test(url) && new URL(url).origin !== origin); assert.deepEqual(crossOrigin, [], 'no cross-origin tracking, image, font or audio requests');
      const assetFailures = failed.filter(item => !/manifest|favicon/.test(item.url) && !(driverLimitation && item.url === `${proxy.url}/` && item.error === 'WebKit encountered an internal error')); assert.deepEqual(assetFailures, [], 'precached app resources must not fail with network unavailable');
      assert.equal(await page.locator('.topbar-actions button[aria-label="Ligar chuvinha"]').getAttribute('aria-pressed'), 'false');
      return { firstOnlinePage: 'home only; no game chunk fetched by page before offline', offlineMethod, ...(driverLimitation ? { driverLimitation } : {}), refusedNetworkRequests: proxy.refused(), navigatorOnline: await page.evaluate(() => navigator.onLine), precacheNames: cached.names, precachedFiles: cached.urls.length, cachedFonts: cached.urls.filter(url => /woff2/.test(url)).length, offlineReload: true, heroLoaded: hero, fontsLoaded: true, gamesOpenedOffline: ['atelier', 'clay', 'wordsearch', ...extras.map(item => item[0])], savedImages: backup.data.creations.length, localBackupExportAndImportOffline: true, crossOriginRequests: crossOrigin, failedAssetRequests: assetFailures };
      } finally { await proxy.close(); }
    },
  },
  {
    name: 'sound-explicit-only-and-background-draft-reopen',
    async run(page) {
      await page.addInitScript(() => {
        const NativeAudio = window.AudioContext ?? window.webkitAudioContext;
        window.__qaAudio = { created: 0, resumes: 0, suspends: 0 };
        if (!NativeAudio) return;
        class TrackedAudio extends NativeAudio {
          constructor(...args) { super(...args); window.__qaAudio.created++; }
          resume() { window.__qaAudio.resumes++; return super.resume(); }
          suspend() { window.__qaAudio.suspends++; return super.suspend(); }
        }
        window.AudioContext = TrackedAudio;
      });
      await boot(page); assert.deepEqual(await page.evaluate(() => window.__qaAudio), { created: 0, resumes: 0, suspends: 0 });
      const backup = await exportBackup(page); recordValue(backup.data, 'settings').sound = true;
      await importBackup(page, backup.data); await expectRestored(page); await page.reload({ waitUntil: 'networkidle' });
      assert.deepEqual(await page.evaluate(() => window.__qaAudio), { created: 0, resumes: 0, suspends: 0 }, 'a stored sound=true never starts audio on reload');
      assert.equal(await page.locator('.topbar-actions button[aria-label="Ligar chuvinha"]').getAttribute('aria-pressed'), 'false');
      const audioAvailable = await page.evaluate(() => typeof window.AudioContext === 'function');
      await page.locator('.topbar-actions button[aria-label="Ligar chuvinha"]').click();
      if (audioAvailable) await page.locator('.topbar-actions button[aria-label="Desligar chuvinha"]').waitFor();
      else await page.getByRole('alert').filter({ hasText: 'o som não abriu neste navegador' }).waitFor({ state: 'visible' });
      const explicit = await page.evaluate(() => window.__qaAudio);
      if (audioAvailable) { assert.equal(explicit.created, 1); assert.ok(explicit.resumes >= 1); }
      else { assert.equal(explicit.created, 0); assert.equal(await page.locator('.topbar-actions button[aria-label="Ligar chuvinha"]').getAttribute('aria-pressed'), 'false'); }
      await route(page, 'clay', '.clay-game'); await page.getByRole('textbox', { name: 'Texto na cerâmica' }).fill('QA background');
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide')); });
      await waitState(page, 'clay', value => value.text === 'QA background');
      await page.locator('.topbar-actions button[aria-label="Ligar chuvinha"]').waitFor();
      if (audioAvailable) assert.ok((await page.evaluate(() => window.__qaAudio)).suspends >= 1);
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
      assert.equal(await page.locator('.topbar-actions button[aria-label="Ligar chuvinha"]').getAttribute('aria-pressed'), 'false');
      const context = page.context(); await page.close(); const reopened = await context.newPage(); reopened.setDefaultTimeout(12000);
      try { await boot(reopened, `${BASE}/#clay`); assert.equal(await reopened.getByRole('textbox', { name: 'Texto na cerâmica' }).inputValue(), 'QA background'); return { initialSoundContexts: 0, storedSoundTrueStillOff: true, explicitSoundContexts: explicit.created, audioActivation: audioAvailable ? { status: 'VALIDATED', method: 'real AudioContext resume/suspend' } : { status: 'NOT_AVAILABLE_IN_ENGINE', reason: 'This Windows WebKit build exposes neither AudioContext nor webkitAudioContext. The app displayed its unavailable-audio message and remained silent.' }, visibilitySimulated: true, stoppedOnPagehide: audioAvailable ? true : 'not applicable: no audio context exists', realPageClosedAndReopened: true, incompleteDraftRestored: true }; } finally { await reopened.close(); }
    },
  },
  {
    name: 'waiting-service-worker-preserves-interaction-until-approved',
    async run(page) {
      const proxy = await proxyServer();
      try {
        await boot(page, proxy.url); await prepareOffline(page);
        await route(page, 'clay', '.clay-game'); await page.getByRole('textbox', { name: 'Texto na cerâmica' }).fill('QA update in progress'); await waitState(page, 'clay', value => value.text === 'QA update in progress');
        const marker = await page.evaluate(() => window.__qaRuntimeMarker = crypto.randomUUID());
        let navigations = 0; page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++; });
        proxy.update(); await page.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration(); await registration.update(); });
        await poll(() => page.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration(); return !!registration?.waiting; }), Boolean, 'new service worker never entered waiting state', 30000);
        await page.locator('.update-banner').waitFor({ state: 'visible' });
        assert.equal(await page.evaluate(() => window.__qaRuntimeMarker), marker); assert.equal(navigations, 0, 'a waiting update must not reload an interaction');
        assert.equal(await page.getByRole('textbox', { name: 'Texto na cerâmica' }).inputValue(), 'QA update in progress');
        const later = page.locator('.update-banner').getByRole('button', { name: /Depois|Agora não|Mais tarde/i });
        const postponeAvailable = await later.count() > 0;
        if (postponeAvailable) { await later.click(); assert.equal(await page.evaluate(() => window.__qaRuntimeMarker), marker); assert.equal(navigations, 0); }
        await page.reload({ waitUntil: 'networkidle' }); await page.locator('.clay-game').waitFor();
        assert.equal(await page.getByRole('textbox', { name: 'Texto na cerâmica' }).inputValue(), 'QA update in progress');
        return { workerWaited: true, automaticReloadsDuringInteraction: 0, draftPreserved: true, postponeAvailable, manualReloadRestoredDraft: true };
      } finally { await proxy.close(); }
    },
  },
];

if (args.includes('--list')) { console.log(cases.map(item => item.name).join('\n')); process.exit(0); }
const selected = selectedCase ? cases.filter(item => item.name === selectedCase) : cases;
assert.ok(selected.length, `Unknown case: ${selectedCase}`);
const engines = engineOption === 'both' ? ['chromium', 'webkit'] : [engineOption];
assert.ok(engines.every(engine => ['chromium', 'webkit'].includes(engine)), 'Use --browser chromium, webkit or both');
await writeReport();
for (const engine of engines) {
  let browser;
  const run = { engine, startedAt: new Date().toISOString(), cases: [] }; report.runs.push(run);
  try {
    browser = await (engine === 'webkit' ? webkit : chromium).launch({ headless: true }); run.version = browser.version();
    for (const test of selected) {
      const context = await newTestContext(browser); const page = await context.newPage(); page.setDefaultTimeout(15000);
      const item = { name: test.name, startedAt: new Date().toISOString(), status: 'RUNNING', pageErrors: [], consoleErrors: [] }; run.cases.push(item);
      page.on('pageerror', error => item.pageErrors.push(error.message)); page.on('console', event => { if (event.type() === 'error') item.consoleErrors.push(event.text()); });
      const start = Date.now();
      try { item.evidence = await test.run(page, browser, { engine }); assert.deepEqual(item.pageErrors, [], 'no unhandled application errors'); assert.deepEqual(item.consoleErrors.filter(message => /<path>|Problem parsing d=/.test(message)), [], 'SVG paths must render without parse errors'); item.status = 'PASS'; report.summary.passed++; }
      catch (error) { item.status = 'FAIL'; item.error = { message: error.message, stack: error.stack }; item.url = page.isClosed() ? 'closed' : page.url(); if (!page.isClosed()) item.visibleText = (await page.locator('body').innerText().catch(() => '')).slice(0, 6000); report.summary.failed++; }
      finally { item.durationMs = Date.now() - start; await context.close(); await writeReport(); console.log(`${engine} ${item.status}: ${item.name} (${item.durationMs}ms)${item.error ? ` — ${item.error.message}` : ''}`); }
    }
  } catch (error) { run.status = 'BLOCKED'; run.infrastructureError = error.message; report.summary.blocked++; console.error(`${engine} BLOCKED: ${error.message}`); }
  finally { if (browser) await browser.close(); run.endedAt = new Date().toISOString(); await writeReport(); }
}
report.endedAt = new Date().toISOString(); report.status = report.summary.failed ? 'FAIL' : report.summary.blocked ? 'BLOCKED' : 'PASS';
await writeReport(); console.log(`Evidence: ${EVIDENCE}`); process.exitCode = report.status === 'PASS' ? 0 : 1;
