import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, devices } from 'playwright';

const BASE = process.env.PAINTING_TEST_URL ?? 'http://127.0.0.1:5188';
const EVIDENCE = resolve('evidence/painting-results.json');
const report = {
  suite: 'Pintura, cerâmica e gestos seguros',
  startedAt: new Date().toISOString(),
  url: BASE,
  browser: 'Chromium real, emulação móvel com touch via CDP',
  device: 'iPhone 13, 390 × 844 CSS pixels; não é um iPhone físico',
  limitations: ['Não valida o seletor de cores do sistema iOS, assinatura nativa ou Safari em iPhone físico. A cor personalizada usa o input color real com seu evento nativo de alteração.'],
  results: [],
  consoleErrors: [],
};
let browser;
let context;
let page;
let cdp;

const sleep = ms => new Promise(resolvePromise => setTimeout(resolvePromise, ms));
async function step(name, run) {
  const started = Date.now();
  try {
    const details = await run();
    report.results.push({ name, status: 'PASS', elapsedMs: Date.now() - started, details: details ?? {} });
    console.log(`PASS ${name}`);
  } catch (error) {
    report.results.push({ name, status: 'FAIL', elapsedMs: Date.now() - started, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}
function trackErrors(currentPage) {
  currentPage.on('pageerror', error => report.consoleErrors.push(error.message));
  currentPage.on('console', event => { if (event.type() === 'error') report.consoleErrors.push(event.text()); });
}
async function attachPage() {
  page = await context.newPage(); trackErrors(page);
  page.setDefaultTimeout(12000);
  cdp = await context.newCDPSession(page);
}
async function settle() {
  await page.evaluate(() => new Promise(resolveFrame => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
}
async function dismissIntro() {
  await page.locator('.app-shell').waitFor();
  await settle();
  const dialog = page.getByRole('dialog');
  if (await dialog.count() && await dialog.first().isVisible()) {
    const enter = dialog.first().getByRole('button', { name: /Entrar|Começar|Ficar à vontade|Abrir.*cantinho|Vamos/i });
    if (await enter.count()) await enter.first().click();
    else {
      const dismiss = dialog.first().getByRole('button', { name: /Fechar|Entendi/i });
      assert(await dismiss.count(), 'O primeiro diálogo não expôs um controle para entrar ou fechar.');
      await dismiss.first().click();
    }
  }
}
async function home() {
  const back = page.locator('.back-link:visible');
  if (await back.count()) { await back.first().click(); await page.locator('.studio-entry-shelf').waitFor(); }
  else {
    const candidates = page.getByRole('button', { name: /^(Início|Meu cantinho|Cantinho|à toa, início)$/i });
    for (const candidate of await candidates.all()) if (await candidate.isVisible()) { await candidate.click(); break; }
  }
  await settle();
  if (!await page.getByRole('button', { name: /^Pintar\b/ }).isVisible().catch(() => false)) {
    const brand = page.locator('.brand:visible');
    if (await brand.count()) await brand.first().click();
    else {
      const candidate = page.getByRole('button', { name: /^(Início|Cantinho|Meu cantinho)$/i });
      for (const button of await candidate.all()) if (await button.isVisible()) { await button.click(); break; }
    }
  }
  await settle();
}
async function openAtelier() {
  const primary = page.getByRole('button', { name: /^Pintar\b/ });
  if (await primary.count() && await primary.isVisible()) await primary.click();
  else await page.getByRole('button', { name: /Abrir Ateliê de cores/i }).click();
  await page.locator('.art-game').waitFor(); await settle();
}
async function openClay() {
  const primary = page.getByRole('button', { name: 'Decorar uma peça', exact: true });
  if (await primary.count() && await primary.isVisible()) await primary.click();
  else await page.getByRole('button', { name: /Abrir Cerâmica de sofá/i }).click();
  await page.locator('.clay-game').waitFor(); await settle();
}
async function openShelf() {
  const back = page.locator('.back-link:visible');
  if (await back.count()) await back.first().click();
  const shelfEntry = page.locator('.studio-entry-shelf:visible');
  if (await shelfEntry.count()) await shelfEntry.click();
  else {
    const labels = /^(Meu cantinho|Coisinhas guardadas|Guardados|Minha prateleira|Prateleira)$/i;
    for (const button of await page.getByRole('button', { name: labels }).all()) {
      if (await button.isVisible()) { await button.click(); break; }
    }
  }
  await page.locator('.shelf-wall').waitFor(); await settle();
}
async function records(storeName) {
  return page.evaluate(store => new Promise((resolveRecords, rejectRecords) => {
    const request = indexedDB.open('atoa-leticia-gallery');
    request.onerror = () => rejectRecords(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(store)) { db.close(); resolveRecords([]); return; }
      const transaction = db.transaction(store, 'readonly');
      const read = transaction.objectStore(store).getAll();
      transaction.oncomplete = () => { resolveRecords(read.result); db.close(); };
      transaction.onerror = () => { rejectRecords(transaction.error); db.close(); };
      transaction.onabort = () => { rejectRecords(transaction.error); db.close(); };
    };
  }), storeName);
}
async function draft(key) {
  const state = await records('state');
  const item = state.find(record => record.key === key);
  if (item) return item.value;
  return page.evaluate(name => JSON.parse(localStorage.getItem(`atoa-leticia:${name}`) ?? 'null'), key);
}
async function untilDraft(key, predicate, message) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const value = await draft(key);
    if (value && predicate(value)) return value;
    await sleep(60);
  }
  throw new Error(message);
}
async function bounds(locator) {
  await locator.scrollIntoViewIfNeeded();
  await settle();
  const box = await locator.boundingBox();
  assert(box, 'O elemento não tem área visível.'); return box;
}
async function touchRegion(regionId) {
  const target = page.locator(`.art-coloring-svg [data-art-region="${regionId}"]`);
  const box = await bounds(target);
  const position = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-art-region]')?.getAttribute('data-art-region'), position);
  assert.equal(hit, regionId, `O ponto escolhido deve atingir a região ${regionId}, encontrou ${hit}.`);
  await page.touchscreen.tap(position.x, position.y); await settle();
  return target;
}
async function customColor(locator, color) {
  await locator.scrollIntoViewIfNeeded();
  await locator.evaluate((input, next) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, color);
  assert.equal(await locator.inputValue(), color); await settle();
}
const contact = (id, x, y) => ({ id, x, y, radiusX: 3, radiusY: 3, force: 1 });
async function dispatchTouch(type, touches) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: touches });
  await settle();
}
async function drag(start, end, cancelled = false) {
  await dispatchTouch('touchStart', [contact(1, start.x, start.y)]);
  for (let i = 1; i <= 7; i++) await dispatchTouch('touchMove', [contact(1, start.x + (end.x - start.x) * i / 7, start.y + (end.y - start.y) * i / 7)]);
  await dispatchTouch(cancelled ? 'touchCancel' : 'touchEnd', []);
}
async function surfaceCenter() {
  const box = await bounds(page.locator('[data-paint-surface]'));
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}
async function chooseMode(mode) {
  const options = page.locator('#art-other-modes');
  if (!await options.count()) await page.getByRole('button', { name: /Outros jeitos de pintar/i }).click();
  await options.getByRole('button', { name: mode, exact: true }).click(); await settle();
}
async function verifyImage(image, expectedSrc) {
  await image.waitFor({ state: 'visible' });
  await page.waitForFunction(element => element.complete && element.naturalWidth > 0, await image.elementHandle());
  const actual = await image.evaluate(element => ({ width: element.naturalWidth, height: element.naturalHeight, src: element.currentSrc }));
  assert(actual.width >= 600 && actual.height >= 600, 'A imagem deve ser um PNG real exportado da arte, não placeholder.');
  assert.equal(actual.src, expectedSrc); return { width: actual.width, height: actual.height };
}
async function noOverflow(label) {
  const metrics = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  assert(metrics.document <= metrics.viewport + 1 && metrics.body <= metrics.viewport + 1, `Overflow horizontal em ${label}: ${JSON.stringify(metrics)}`);
  return metrics;
}
async function transactionEvidence() {
  const timeline = await page.evaluate(() => window.__paintingTransactions ?? []);
  const commits = timeline.filter(event => event.type === 'commit');
  const successes = timeline.filter(event => event.type === 'success');
  assert(commits.length > 0, 'A gravação deve concluir uma transação real do store creations.');
  assert(successes.length > 0, 'O fluxo deve mostrar confirmação após a gravação.');
  for (const success of successes) {
    const started = timeline.filter(event => event.type === 'start' && event.time <= success.time).at(-1);
    assert(started && commits.some(commit => commit.time >= started.time && commit.time <= success.time), 'A interface confirmou sucesso antes do commit da criação correspondente.');
  }
  const latestStart = timeline.filter(event => event.type === 'start').at(-1);
  const latestCommit = commits.find(event => event.time >= latestStart.time);
  assert(latestCommit && successes.some(event => event.time >= latestCommit.time), 'A última criação deve receber confirmação depois de seu próprio commit.');
  return timeline;
}

try {
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent });
  await context.addInitScript(() => {
    window.__paintingTransactions = [];
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      const transaction = original.apply(this, args);
      const stores = typeof args[0] === 'string' ? [args[0]] : Array.from(args[0]);
      if (stores.includes('creations') && args[1] === 'readwrite') {
        window.__paintingTransactions.push({ type: 'start', time: performance.now() });
        transaction.addEventListener('complete', () => window.__paintingTransactions.push({ type: 'commit', time: performance.now() }));
        transaction.addEventListener('abort', () => window.__paintingTransactions.push({ type: 'abort', time: performance.now() }));
      }
      return transaction;
    };
    const observe = () => {
      let previous = '';
      new MutationObserver(() => {
        const messages = Array.from(document.querySelectorAll('[role="status"]')).map(element => element.textContent.trim()).filter(text => /guardadinh|guardad[ao].*galeria|peça guardada|criação.*guardad|sua criação está no cantinho/i.test(text));
        const next = messages.join('|');
        if (next && next !== previous) window.__paintingTransactions.push({ type: 'success', time: performance.now(), messages });
        previous = next;
      }).observe(document.body, { subtree: true, childList: true, characterData: true });
    };
    if (document.body) observe(); else window.addEventListener('DOMContentLoaded', observe, { once: true });
  });
  await attachPage();
  await page.goto(BASE, { waitUntil: 'networkidle' }); await dismissIntro();

  await step('Toque real pinta uma região, Desfazer e Refazer recuperam a cor', async () => {
    await openAtelier();
    await page.getByRole('button', { name: 'Pintar Gatinho', exact: true }).click();
    const region = page.locator('.art-coloring-svg [data-art-region="belly"]');
    const original = await region.getAttribute('fill');
    await page.getByRole('button', { name: 'Cor 3', exact: true }).click();
    await touchRegion('belly');
    assert.equal(await region.getAttribute('fill'), '#e4c15c');
    await untilDraft('atelier-artwork', value => value.regions.belly === '#e4c15c', 'A cor do toque não foi gravada no rascunho.');
    await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
    assert.equal(await region.getAttribute('fill'), original);
    await page.getByRole('button', { name: 'Refazer', exact: true }).click();
    assert.equal(await region.getAttribute('fill'), '#e4c15c');
    return { original, painted: '#e4c15c', trustedTouchInput: true };
  });
  await step('Cor personalizada altera o pincel e sobrevive à volta para o desenho', async () => {
    await customColor(page.getByLabel('Cor personalizada', { exact: true }), '#9d75b5');
    await touchRegion('belly');
    assert.equal(await page.locator('[data-art-region="belly"]').getAttribute('fill'), '#9d75b5');
    await untilDraft('atelier-artwork', value => value.regions.belly === '#9d75b5', 'A cor personalizada não entrou no rascunho.');
    return { selected: '#9d75b5', nativeColorInputEvent: true };
  });
  await step('Arrastar em modo pintar não preenche nenhuma região', async () => {
    const before = await draft('atelier-artwork');
    const center = await surfaceCenter();
    await drag({ x: center.x - 34, y: center.y }, { x: center.x + 34, y: center.y + 12 });
    assert.deepEqual((await draft('atelier-artwork')).regions, before.regions);
    return { regionsBefore: Object.keys(before.regions).length, regionsAfter: Object.keys((await draft('atelier-artwork')).regions).length };
  });
  await step('Zoom e Mover arrastam o papel sem pintar', async () => {
    const before = await draft('atelier-artwork');
    await page.getByRole('button', { name: 'Aumentar desenho', exact: true }).click();
    assert(Number(await page.locator('[data-paint-scale]').getAttribute('data-paint-scale')) > 1);
    await page.getByRole('button', { name: 'Mover desenho', exact: true }).click();
    assert.equal(await page.locator('[data-paint-surface]').getAttribute('data-paint-tool'), 'move');
    const transformation = await page.locator('[data-paint-scale]').getAttribute('style');
    const center = await surfaceCenter(); await drag({ x: center.x, y: center.y }, { x: center.x + 32, y: center.y + 26 });
    assert.notEqual(await page.locator('[data-paint-scale]').getAttribute('style'), transformation);
    assert.deepEqual((await draft('atelier-artwork')).regions, before.regions);
    await page.getByRole('button', { name: 'Mover desenho', exact: true }).click();
    await page.getByRole('button', { name: 'Enquadrar desenho', exact: true }).click();
    return { zoomScale: 1.4, panChangedTransform: true, paintingChanged: false };
  });
  await step('Pinch com dois contatos CDP aproxima sem pintar', async () => {
    const before = await draft('atelier-artwork');
    const center = await surfaceCenter();
    await dispatchTouch('touchStart', [contact(1, center.x - 35, center.y), contact(2, center.x + 35, center.y)]);
    await dispatchTouch('touchMove', [contact(1, center.x - 68, center.y - 7), contact(2, center.x + 68, center.y + 7)]);
    await dispatchTouch('touchEnd', []);
    const scale = Number(await page.locator('[data-paint-scale]').getAttribute('data-paint-scale'));
    assert(scale > 1.5, `Pinch deveria ampliar o desenho; escala final ${scale}.`);
    assert.deepEqual((await draft('atelier-artwork')).regions, before.regions);
    await page.getByRole('button', { name: 'Enquadrar desenho', exact: true }).click();
    return { scale, trustedTwoPointerInput: true, paintingChanged: false };
  });
  await step('Gestos fora da arte continuam permitindo rolar a página', async () => {
    const touchActions = await page.evaluate(() => ({ surface: getComputedStyle(document.querySelector('[data-paint-surface]')).touchAction, body: getComputedStyle(document.body).touchAction }));
    assert.equal(touchActions.surface, 'none'); assert.notEqual(touchActions.body, 'none');
    await page.evaluate(() => window.scrollTo(0, 0)); await settle();
    const before = await page.evaluate(() => window.scrollY);
    await drag({ x: 3, y: 645 }, { x: 3, y: 295 }); await sleep(160);
    const after = await page.evaluate(() => window.scrollY);
    assert(after > before + 15, `O gesto fora do papel não rolou a página: ${before} → ${after}.`);
    return { touchActions, scrollBefore: before, scrollAfter: after };
  });
  await step('Desenho livre finaliza e persiste inclusive em pointercancel', async () => {
    await chooseMode('Livre');
    const before = await draft('atelier-artwork');
    const center = await surfaceCenter();
    await drag({ x: center.x - 48, y: center.y - 15 }, { x: center.x + 42, y: center.y + 16 });
    const completed = await untilDraft('atelier-artwork', value => value.strokes.length === before.strokes.length + 1, 'O traço concluído não foi persistido.');
    await drag({ x: center.x - 24, y: center.y + 40 }, { x: center.x + 38, y: center.y + 65 }, true);
    const interrupted = await untilDraft('atelier-artwork', value => value.strokes.length === before.strokes.length + 2, 'Pointercancel perdeu o traço interrompido.');
    assert(completed.strokes.at(-1).points.length > 1 && interrupted.strokes.at(-1).points.length > 1);
    return { before: before.strokes.length, completed: completed.strokes.length, afterPointerCancel: interrupted.strokes.length };
  });
  await step('Pinch em desenho livre descarta o traço provisório', async () => {
    const before = await draft('atelier-artwork');
    const center = await surfaceCenter();
    await dispatchTouch('touchStart', [contact(1, center.x - 30, center.y), contact(2, center.x + 30, center.y)]);
    await dispatchTouch('touchMove', [contact(1, center.x - 55, center.y), contact(2, center.x + 55, center.y)]);
    await dispatchTouch('touchEnd', []);
    assert.equal((await draft('atelier-artwork')).strokes.length, before.strokes.length);
    await page.getByRole('button', { name: 'Enquadrar desenho', exact: true }).click();
    return { strokes: before.strokes.length, provisionalStrokeDiscarded: true };
  });
  await step('Rascunho persiste entre telas, reload e fechar/reabrir página', async () => {
    const expected = await draft('atelier-artwork');
    await home(); await openAtelier();
    assert.deepEqual(await draft('atelier-artwork'), expected);
    const persisted = (await records('state')).find(record => record.key === 'atelier-artwork');
    assert(persisted, 'O rascunho deve estar confirmado no store state de IndexedDB.');
    assert.deepEqual(persisted.value, expected);
    await page.reload({ waitUntil: 'networkidle' }); await page.locator('.art-game').waitFor(); await settle();
    assert.deepEqual(await draft('atelier-artwork'), expected);
    await page.close(); await attachPage();
    await page.goto(`${BASE}/#atelier`, { waitUntil: 'networkidle' }); await page.locator('.art-game').waitFor(); await settle();
    assert.deepEqual(await draft('atelier-artwork'), expected);
    const canvas = await page.locator('.art-free-canvas').evaluate(element => {
      const ctx = element.getContext('2d'); const pixels = ctx.getImageData(0, 0, element.width, element.height).data;
      let nonPaper = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] !== 255 || pixels[i + 1] !== 250 || pixels[i + 2] !== 240) nonPaper++;
      return { nonPaper };
    });
    assert(canvas.nonPaper > 100, 'O canvas reaberto deve mostrar os traços persistidos.');
    return { identicalStoredDraft: true, recreatedCanvasColoredPixels: canvas.nonPaper, sameBrowserContext: true, persistenceStore: 'IndexedDB state' };
  });
  await step('Ateliê salva PNG confirmado em IndexedDB', async () => {
    await chooseMode('Colorir');
    await page.getByRole('button', { name: 'Guardar na galeria', exact: true }).click();
    await page.waitForFunction(async () => {
      const db = await new Promise((resolveDb, rejectDb) => { const request = indexedDB.open('atoa-leticia-gallery'); request.onsuccess = () => resolveDb(request.result); request.onerror = () => rejectDb(request.error); });
      const items = await new Promise(resolveItems => { const request = db.transaction('creations').objectStore('creations').getAll(); request.onsuccess = () => resolveItems(request.result); }); db.close(); return items.some(item => item.kind === 'atelier');
    });
    const item = (await records('creations')).find(creation => creation.kind === 'atelier');
    assert(item?.dataUrl.startsWith('data:image/png;base64,'));
    await page.getByText(/Guardadinho na sua galeria/i).waitFor();
    const transaction = await transactionEvidence();
    const close = page.getByRole('button', { name: 'Fechar confirmação', exact: true });
    if (await close.count()) { await close.click(); await settle(); }
    return { kind: item.kind, pngBytes: Math.floor(item.dataUrl.split(',')[1].length * .75), title: item.title, transaction };
  });
  await step('Cerâmica recebe cor, carimbo e planta; salva PNG da peça na prateleira', async () => {
    await home(); await openClay();
    await page.getByRole('button', { name: 'Cor 1', exact: true }).click();
    await page.getByLabel('Carimbo', { exact: true }).selectOption('pata');
    await page.getByLabel('Planta do vasinho', { exact: true }).selectOption('flower');
    await page.getByLabel('Texto na cerâmica', { exact: true }).fill('Leh');
    const before = await draft('clay');
    const svg = page.locator('.clay-canvas'); await bounds(svg);
    const point = await svg.evaluate(element => {
      const center = new DOMPoint(260, 295).matrixTransform(element.getScreenCTM()); return { x: center.x, y: center.y };
    });
    await page.touchscreen.tap(point.x, point.y); await settle();
    const decorated = await untilDraft('clay', value => value.motifs.length === before.motifs.length + 1, 'O carimbo do toque não ficou salvo na cerâmica.');
    assert.equal(decorated.color, '#52785c'); assert.equal(decorated.plant, 'flower'); assert.equal(decorated.text, 'Leh'); assert.equal(decorated.motifs.at(-1).type, 'pata');
    await page.getByRole('button', { name: 'Guardar no cantinho', exact: true }).click();
    let item;
    for (let i = 0; i < 100; i++) { item = (await records('creations')).find(creation => creation.kind === 'clay'); if (item) break; await sleep(50); }
    assert(item?.dataUrl.startsWith('data:image/png;base64,')); assert.equal(item.plant, 'flower'); assert.equal(item.display, 'object');
    await openShelf();
    const image = page.getByAltText(item.title, { exact: true }).first();
    const imageDetails = await verifyImage(image, item.dataUrl);
    assert(await page.locator('.shelf-item').count() >= 2, 'A prateleira deve exibir ambas as criações guardadas.');
    return { title: item.title, plant: item.plant, display: item.display, motifs: decorated.motifs.length, image: imageDetails, shelfItems: await page.locator('.shelf-item').count(), transaction: await transactionEvidence() };
  });
  await step('Prateleira e pintura suportam rotação sem overflow horizontal', async () => {
    const portraitShelf = await noOverflow('prateleira portrait');
    await page.setViewportSize({ width: 844, height: 390 }); await settle();
    const landscapeShelf = await noOverflow('prateleira landscape');
    await home(); await openAtelier();
    const landscapeArt = await noOverflow('pintura landscape');
    await page.setViewportSize({ width: 390, height: 844 }); await settle();
    const portraitArt = await noOverflow('pintura portrait');
    const buttons = page.locator('.paint-viewport-controls button');
    const sizes = await buttons.evaluateAll(elements => elements.map(element => { const rect = element.getBoundingClientRect(); return { width: rect.width, height: rect.height }; }));
    assert(sizes.every(size => size.width >= 44 && size.height >= 44), 'Controles de zoom e mover devem ter alvo de ao menos 44 px.');
    return { portraitShelf, landscapeShelf, landscapeArt, portraitArt, viewportControls: sizes };
  });
  await step('Fluxo não produziu erros JavaScript ou de console', async () => {
    assert.deepEqual(report.consoleErrors, []); return { errors: 0 };
  });
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.failure = error instanceof Error ? error.stack : String(error);
  console.error(report.failure); process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  await mkdir(resolve('evidence'), { recursive: true });
  await writeFile(EVIDENCE, JSON.stringify(report, null, 2) + '\n', 'utf8');
  if (browser) await browser.close();
  console.log(`Evidence: ${EVIDENCE}`);
}
