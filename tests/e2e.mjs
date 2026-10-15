import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit, devices } from 'playwright';
import { createWordSearch } from '../src/games/WordSearch.logic.ts';
import { getSoftWord, evaluateGuess, SOFT_WORD_DICTIONARY } from '../src/games/SoftWord.logic.ts';
import { GAMES } from '../src/lib/catalog.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const baseUrl = option('--base-url', process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5188').replace(/\/$/, '');
const engine = option('--browser', process.env.E2E_BROWSER ?? 'chromium');
const selectedCase = option('--case', null);
const evidencePath = path.resolve(root, option('--output', 'evidence/word-e2e-results.json'));
const databaseName = 'atoa-leticia-gallery';
const results = { startedAt: new Date().toISOString(), baseUrl, engine, browserVersion: null, status: 'RUNNING', cases: [], summary: { passed: 0, failed: 0, total: 0 } };
const writeResults = async () => { await fs.mkdir(path.dirname(evidencePath), { recursive: true }); await fs.writeFile(evidencePath, JSON.stringify(results, null, 2) + '\n', 'utf8'); };

async function readRecord(page, key) {
  return page.evaluate(({ databaseName, key }) => new Promise((resolve, reject) => {
    const open = indexedDB.open(databaseName, 2);
    open.onerror = () => reject(open.error?.message ?? 'IndexedDB did not open');
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('state', 'readonly');
      const request = tx.objectStore('state').get(key);
      tx.oncomplete = () => { db.close(); resolve(request.result ?? null); };
      tx.onerror = () => { db.close(); reject(tx.error?.message ?? 'IndexedDB state read failed'); };
    };
  }), { databaseName, key });
}
async function readCreations(page) {
  return page.evaluate(databaseName => new Promise((resolve, reject) => {
    const open = indexedDB.open(databaseName, 2);
    open.onerror = () => reject(open.error?.message ?? 'IndexedDB did not open');
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('creations', 'readonly');
      const request = tx.objectStore('creations').getAll();
      tx.oncomplete = () => { db.close(); resolve(request.result); };
      tx.onerror = () => { db.close(); reject(tx.error?.message ?? 'IndexedDB creation read failed'); };
    };
  }), databaseName);
}
async function seedIsolatedRound(page, key, value) {
  // Optional deterministic fixture in this test's fresh browser context; never used in the default flow.
  await page.evaluate(({ databaseName, key, value }) => new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 2);
    request.onerror = () => reject(request.error?.message);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('state', 'readwrite');
      tx.objectStore('state').put({ key, version: 1, value, updatedAt: Date.now() });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error?.message); };
    };
  }), { databaseName, key, value });
}
async function pollState(page, key, predicate, message, timeout = 6000) {
  const until = Date.now() + timeout;
  let record;
  do {
    record = await readRecord(page, key);
    if (record && predicate(record.value)) {
      assert.equal(record.version, 1, `${key} uses a versioned state record`);
      assert.equal(typeof record.updatedAt, 'number');
      return record.value;
    }
    await page.waitForTimeout(60);
  } while (Date.now() < until);
  throw new Error(`${message}; persisted state: ${JSON.stringify(record)}`);
}
async function openGame(page, title, id) {
  const catalogGame = GAMES.find(game => game.id === id);
  assert.ok(catalogGame, `${id} exists in the actual game catalog`);
  title = catalogGame.title;
  await page.goto(`${baseUrl}/#home`, { waitUntil: 'domcontentloaded' });
  await page.locator('.home-hero').waitFor({ state: 'visible' });
  const intro = page.getByRole('dialog', { name: 'Bem-vinda ao seu cantinho', exact: true });
  const onboardingDismissed = await intro.isVisible();
  if (onboardingDismissed) await intro.getByRole('button', { name: 'Entrar no cantinho', exact: true }).tap();
  let navigationTaps = 0;
  if (id === 'wordsearch') {
    await page.locator('.studio-entry-play').tap(); navigationTaps++;
  } else {
    await page.getByRole('button', { name: 'Mais brincadeiras', exact: true }).tap(); navigationTaps++;
    await page.waitForURL(/#play$/);
    if (!['atelier', 'clay', 'wordsearch'].includes(id)) {
      await page.locator('.extras-details > summary').tap(); navigationTaps++;
    }
    await page.locator('.game-card').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).locator('.game-open').tap(); navigationTaps++;
  }
  await page.waitForURL(new RegExp(`#${id}$`));
  await page.locator('.game-page h1').waitFor({ state: 'visible' });
  assert.equal((await page.locator('.game-page h1').innerText()).trim(), title, 'the actual home controls open the chosen game');
  if (['atelier', 'clay', 'wordsearch'].includes(id)) assert.ok(navigationTaps <= 2, 'a core activity is at most two taps from home after onboarding');
  page.navigationEvidence = { navigationTaps, onboardingDismissed, title, id };
  if (id === 'wordsearch') await installWordPointerTrace(page);
}
async function installWordPointerTrace(page) {
  await page.evaluate(() => {
    window.__wordPointerEvents = [];
    for (const name of ['pointerdown', 'pointerup', 'pointercancel', 'click']) document.addEventListener(name, event => {
      const target = event.target.closest?.('[data-word-cell]');
      if (!target && !document.querySelector('.words-search-board')?.contains(event.target)) return;
      window.__wordPointerEvents.push({ event: name, cell: target?.getAttribute('data-word-cell'), hit: document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-word-cell]')?.getAttribute('data-word-cell'), detail: event.detail, x: event.clientX, y: event.clientY, pointerType: event.pointerType, scrollY: window.scrollY });
    }, true);
  });
}
async function reloadGame(page, selector) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator(selector).waitFor({ state: 'visible' });
}
async function tapWord(page, cells, reverse = false) {
  const first = reverse ? cells.at(-1) : cells[0];
  const last = reverse ? cells[0] : cells.at(-1);
  const attempt = { first, last, reverse };
  (page.wordAttempts ??= []).push(attempt);
  await page.locator(`[data-word-cell="${first}"]`).tap();
  attempt.firstNotice = await page.locator('.words-notice').innerText();
  await page.locator(`[data-word-cell="${last}"]`).tap();
  attempt.finalNotice = await page.locator('.words-notice').innerText();
}
async function dragWord(page, cells) {
  const first = page.locator(`[data-word-cell="${cells[0]}"]`);
  const last = page.locator(`[data-word-cell="${cells.at(-1)}"]`);
  await page.locator('.words-search-board').scrollIntoViewIfNeeded();
  const a = await first.boundingBox(), b = await last.boundingBox();
  assert.ok(a && b, 'both word endpoints have real browser coordinates');
  const viewport = page.viewportSize();
  assert.ok(a.y >= 0 && b.y >= 0 && a.y + a.height <= viewport.height && b.y + b.height <= viewport.height, 'both drag endpoints are inside the visible browser viewport');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
}
async function assertSavedPng(page, before, title) {
  const until = Date.now() + 10000;
  let items;
  do {
    items = await readCreations(page);
    if (items.length > before) break;
    await page.waitForTimeout(80);
  } while (Date.now() < until);
  assert.equal(items.length, before + 1, 'one real creation committed to IndexedDB');
  const item = items.sort((a, b) => b.createdAt - a.createdAt)[0];
  if (title) assert.equal(item.title, title);
  assert.ok(/^data:image\/png;base64,/.test(item.dataUrl), 'creation contains a PNG image');
  const png = Buffer.from(item.dataUrl.split(',')[1], 'base64');
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  assert.ok(width >= 500 && height >= 500, 'saved artwork has export dimensions, not a placeholder');
  assert.ok(png.length > 1500, 'saved PNG has actual drawing content');
  assert.equal(typeof item.id, 'string');
  await page.goto(`${baseUrl}/#saved`, { waitUntil: 'domcontentloaded' });
  await page.locator('.shelf-wall').waitFor({ state: 'visible' });
  const image = page.getByRole('img', { name: item.title, exact: true }).first();
  await image.waitFor({ state: 'visible' });
  assert.equal(await image.evaluate(async img => { await img.decode(); return img.complete && img.naturalWidth > 0; }), true, 'the persisted PNG really decodes in the shelf UI');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('img', { name: item.title, exact: true }).first().waitFor({ state: 'visible' });
  assert.equal((await readCreations(page)).length, before + 1, 'the shelf survives reloading');
  return { id: item.id, kind: item.kind, title: item.title, pngBytes: png.length, width, height };
}
async function tapSvgPosition(page, selector, xRatio = .5, yRatio = .5) {
  const svg = page.locator(selector);
  await svg.scrollIntoViewIfNeeded();
  const box = await svg.boundingBox();
  assert.ok(box, 'drawing has a real touch surface');
  await page.touchscreen.tap(box.x + box.width * xRatio, box.y + box.height * yRatio);
}

const cases = [
  {
    name: 'wordsearch-touch-persistence',
    run: async page => {
      await openGame(page, 'Palavras ao sol', 'wordsearch');
      await page.locator('.words-search-board').waitFor({ state: 'visible' });
      assert.equal(await page.getByRole('gridcell').count(), 64);
      await page.getByRole('button', { name: 'Plantas', exact: true }).tap();
      let state = await pollState(page, 'wordsearch-v1', value => value.theme === 'plants' && value.difficulty === 'easy', 'the plant theme was not persisted');
      const fixtureSeed = option('--wordsearch-seed', null);
      if (fixtureSeed !== null) {
        state = { ...state, seed: Number(fixtureSeed), found: [], hint: null };
        await seedIsolatedRound(page, 'wordsearch-v1', state);
        await reloadGame(page, '.words-search-board');
        await installWordPointerTrace(page);
      }
      const board = createWordSearch(state.seed, state.theme, state.difficulty);
      assert.deepEqual(await page.getByRole('gridcell').allTextContents(), board.letters, 'the actual UI grid equals its saved seeded board');
      await tapWord(page, board.placements[0].cells);
      await tapWord(page, board.placements[1].cells, true);
      state = await pollState(page, 'wordsearch-v1', value => value.found.length === 2, 'forward and reverse touches did not find their words');
      assert.equal(await page.locator('.words-find-list .is-found').count(), 2);
      await page.getByRole('button', { name: 'Uma dica, por favor', exact: true }).tap();
      const hinted = await pollState(page, 'wordsearch-v1', value => value.hint !== null, 'the hint was not persisted');
      assert.equal(await page.locator('.words-search-letter.is-hint').count(), 1);
      await reloadGame(page, '.words-search-board');
      assert.equal(await page.getByRole('gridcell').count(), 64);
      assert.deepEqual((await readRecord(page, 'wordsearch-v1')).value, hinted);
      assert.equal(await page.locator('.words-search-letter.is-hint').getAttribute('data-word-cell'), String(hinted.hint));
      assert.equal(await page.locator('.words-find-list .is-found').count(), 2);
      return { navigation: page.navigationEvidence, grid: '8x8', theme: state.theme, seed: state.seed, found: state.found, hint: hinted.hint, interaction: ['touch-forward', 'touch-reverse'], persistence: 'IndexedDB + browser reload' };
    },
  },
  {
    name: 'wordsearch-mobile-bottom-regression',
    run: async page => {
      await openGame(page, 'Caça-palavras', 'wordsearch');
      await page.getByRole('button', { name: 'Plantas', exact: true }).tap();
      const current = await pollState(page, 'wordsearch-v1', value => value.theme === 'plants', 'the regression theme did not load');
      const fixture = { ...current, seed: 1810615273, difficulty: 'easy', found: [], hint: null };
      await seedIsolatedRound(page, 'wordsearch-v1', fixture);
      await reloadGame(page, '.words-search-board');
      await installWordPointerTrace(page);
      const board = createWordSearch(fixture.seed, fixture.theme, fixture.difficulty);
      const bottomWord = board.placements.find(word => word.cells.every(cell => Math.floor(cell / board.size) === board.size - 1));
      assert.ok(bottomWord, 'this fixture really puts a word along the last row');
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const slotBefore = await page.locator('.words-selection-slot').boundingBox();
      const noticeBefore = await page.locator('.words-notice').boundingBox();
      await tapWord(page, bottomWord.cells, true);
      const found = await pollState(page, 'wordsearch-v1', value => value.found.includes(bottomWord.word), 'a reverse touch near the bottom was lost to layout/scroll changes');
      const slotAfter = await page.locator('.words-selection-slot').boundingBox();
      const noticeAfter = await page.locator('.words-notice').boundingBox();
      assert.ok(Math.abs(slotBefore.height - slotAfter.height) < 1, 'cancel controls keep the same height');
      assert.ok(Math.abs(noticeBefore.height - noticeAfter.height) < 1, 'feedback reserves a stable height');
      const events = await page.evaluate(() => window.__wordPointerEvents);
      const pointerEvents = events.filter(event => ['pointerdown', 'pointerup'].includes(event.event));
      assert.equal(pointerEvents.length, 4);
      for (let i = 0; i < pointerEvents.length; i += 2) {
        assert.equal(pointerEvents[i].cell, pointerEvents[i + 1].hit, 'the same cell stays under a stationary finger');
        assert.ok(Math.abs(pointerEvents[i].scrollY - pointerEvents[i + 1].scrollY) < 1, 'selection does not cause scroll anchoring between pointerdown and pointerup');
      }
      return { fixtureSeed: fixture.seed, bottomRow: 8, word: bottomWord.word, cells: bottomWord.cells, reverseTouchFound: found.found, pointerEvents, stableActionsHeight: slotAfter.height, stableFeedbackHeight: noticeAfter.height, navigation: page.navigationEvidence };
    },
  },
  {
    name: 'wordsearch-keyboard-and-edge-drag', desktop: true,
    run: async page => {
      await openGame(page, 'Caça-palavras', 'wordsearch');
      const fixture = { seed: 956330666, theme: 'kitchen', difficulty: 'normal', found: [], hint: null };
      await pollState(page, 'wordsearch-v1', value => typeof value.seed === 'number', 'the keyboard fixture cannot start before storage is ready');
      await seedIsolatedRound(page, 'wordsearch-v1', fixture);
      await reloadGame(page, '.words-search-board');
      const board = createWordSearch(fixture.seed, fixture.theme, fixture.difficulty);
      const keyboardWord = board.placements[1];
      const first = keyboardWord.cells[0], last = keyboardWord.cells.at(-1);
      await page.locator(`[data-word-cell="${first}"]`).focus();
      await page.keyboard.press('Enter');
      const dx = Math.sign(last % board.size - first % board.size);
      const dy = Math.sign(Math.floor(last / board.size) - Math.floor(first / board.size));
      for (let step = 1; step < keyboardWord.cells.length; step++) {
        if (dx) await page.keyboard.press(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
        if (dy) await page.keyboard.press(dy > 0 ? 'ArrowDown' : 'ArrowUp');
      }
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-word-cell')), String(last));
      await page.keyboard.press('Enter');
      await pollState(page, 'wordsearch-v1', value => value.found.includes(keyboardWord.word), 'Enter/arrows did not find the word');

      const edgeWord = board.placements[0];
      const edgeLast = edgeWord.cells.at(-1);
      assert.equal(Math.floor(edgeLast / board.size), board.size - 1, 'the fixture really ends on the bottom edge');
      await page.locator('.words-search-board').scrollIntoViewIfNeeded();
      const a = await page.locator(`[data-word-cell="${edgeWord.cells[0]}"]`).boundingBox();
      const b = await page.locator(`[data-word-cell="${edgeLast}"]`).boundingBox();
      const surface = await page.locator('.words-search-board').boundingBox();
      assert.ok(a && b && surface);
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
      await page.mouse.move(b.x + b.width / 2, surface.y + surface.height + 12);
      await page.mouse.up();
      const state = await pollState(page, 'wordsearch-v1', value => value.found.includes(edgeWord.word), 'releasing just outside the board discarded the last valid cell');
      return { fixtureSeed: fixture.seed, keyboardWord: keyboardWord.word, keyboardKeys: ['Enter', ...(dx ? [dx > 0 ? 'ArrowRight' : 'ArrowLeft'] : []), ...(dy ? [dy > 0 ? 'ArrowDown' : 'ArrowUp'] : []), 'Enter'], edgeWord: edgeWord.word, releaseOutsideBoard: true, found: state.found, navigation: page.navigationEvidence };
    },
  },
  {
    name: 'wordsearch-normal-drag-and-shelf', desktop: true,
    run: async page => {
      await openGame(page, 'Palavras ao sol', 'wordsearch');
      await page.getByRole('button', { name: 'Mais caminhos · 10 × 10', exact: true }).tap();
      await page.getByRole('button', { name: 'Cozinha', exact: true }).tap();
      let state = await pollState(page, 'wordsearch-v1', value => value.theme === 'kitchen' && value.difficulty === 'normal', 'normal kitchen round was not persisted');
      const board = createWordSearch(state.seed, state.theme, state.difficulty);
      assert.equal(await page.getByRole('gridcell').count(), 100);
      assert.deepEqual(await page.getByRole('gridcell').allTextContents(), board.letters);
      await dragWord(page, board.placements[0].cells);
      await tapWord(page, board.placements[1].cells, true);
      for (const placement of board.placements.slice(2)) await tapWord(page, placement.cells);
      state = await pollState(page, 'wordsearch-v1', value => value.found.length === 7, 'the completed 10x10 round did not persist');
      const before = (await readCreations(page)).length;
      await page.getByRole('button', { name: 'Guardar lembrança', exact: true }).tap();
      const creation = await assertSavedPng(page, before, 'Um jardim de palavras');
      return { grid: '10x10', theme: state.theme, seed: state.seed, foundCount: state.found.length, interaction: ['mouse-drag', 'touch-reverse', 'touch-forward'], creation };
    },
  },
  {
    name: 'softword-valid-invalid-physical-touch',
    run: async page => {
      await openGame(page, 'Palavra mansa', 'word');
      await page.locator('.words-keyboard').waitFor({ state: 'visible' });
      const initial = await pollState(page, 'softword-v1', value => typeof value.seed === 'number', 'the word round was not stored');
      const answer = getSoftWord(initial.seed);
      await page.keyboard.type('XXXXX');
      await page.keyboard.press('Enter');
      assert.match(await page.locator('.words-notice').innerText(), /vocabulário/);
      assert.equal((await readRecord(page, 'softword-v1')).value.guesses.length, 0, 'invalid strings do not become guesses');
      assert.equal(await page.locator('.words-word-finish').count(), 0, 'an invalid guess never reveals the answer');
      for (let i = 0; i < 5; i++) await page.keyboard.press('Backspace');
      const valid = ['CALMA', 'GATOS', 'BARRO'].find(word => word !== answer);
      assert.ok(SOFT_WORD_DICTIONARY.includes(valid));
      await page.keyboard.type(valid);
      await page.keyboard.press('Enter');
      let state = await pollState(page, 'softword-v1', value => value.guesses.length === 1, 'physical Enter did not submit a valid word after a navigation button had focus');
      assert.deepEqual(state.guesses, [valid]);
      const statuses = await page.locator('.words-guess').first().locator('.words-tile').evaluateAll(tiles => tiles.map(tile => ['correct', 'present', 'absent'].find(status => tile.classList.contains(status))));
      assert.deepEqual(statuses, evaluateGuess(valid, answer));
      await page.keyboard.type('AM');
      await pollState(page, 'softword-draft-v1', value => value === 'AM', 'the incomplete word draft did not persist');
      await reloadGame(page, '.words-keyboard');
      assert.equal((await page.locator('.words-draft').innerText()).replace(/\s/g, ''), 'AM');
      await page.getByRole('button', { name: 'Apagar última letra', exact: true }).tap();
      await page.getByRole('button', { name: 'Apagar última letra', exact: true }).tap();
      for (const letter of answer) await page.locator('.words-keyboard').getByRole('button', { name: new RegExp(`^${letter}(,|$)`) }).tap();
      await page.getByRole('button', { name: 'Enviar palavra', exact: true }).tap();
      state = await pollState(page, 'softword-v1', value => value.outcome === 'solved', 'touch keyboard did not solve the word');
      assert.equal(await page.locator('.words-word-finish strong').innerText(), answer);
      const solvedAttempts = state.guesses.length;
      await page.getByRole('button', { name: 'Mais uma, sem pressa', exact: true }).tap();
      const next = await pollState(page, 'softword-v1', value => value.seed !== initial.seed && value.guesses.length === 0, 'another word did not reset the round');
      await page.getByRole('button', { name: 'Matar a curiosidade', exact: true }).tap();
      await pollState(page, 'softword-v1', value => value.outcome === 'revealed', 'optional reveal did not persist');
      assert.equal(await page.locator('.words-word-finish strong').innerText(), getSoftWord(next.seed));
      return { invalidGuess: 'XXXXX', invalidAttempts: 0, validGuess: valid, feedback: statuses, restoredDraft: 'AM', solvedAttempts, physicalAndTouchKeyboard: true, optionalReveal: true };
    },
  },
  {
    name: 'memory-pairs-timeout-reload',
    run: async page => {
      await openGame(page, 'Pequenos pares', 'memory');
      await page.locator('.memory-board').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.memory-card').count(), 12);
      const labels = await page.locator('.memory-card-front > span').allTextContents();
      const a = 0, b = labels.findIndex((label, i) => i !== a && label === labels[a]);
      await page.locator('.memory-card').nth(a).tap();
      await page.locator('.memory-card').nth(b).tap();
      const matched = await pollState(page, 'memory-v1', value => value.matched.length === 1, 'the matched pair did not persist');
      assert.equal(await page.locator('.memory-card.is-matched').count(), 2);
      const wrongA = labels.findIndex(label => label !== labels[a]);
      const wrongB = labels.findIndex(label => label !== labels[a] && label !== labels[wrongA]);
      await page.locator('.memory-card').nth(wrongA).tap();
      await page.locator('.memory-card').nth(wrongB).tap();
      assert.equal(await page.locator('.memory-card.is-open:not(.is-matched)').count(), 2);
      await page.waitForTimeout(1350);
      assert.equal(await page.locator('.memory-card.is-open:not(.is-matched)').count(), 0);
      await reloadGame(page, '.memory-board');
      assert.equal(await page.locator('.memory-card.is-matched').count(), 2);
      assert.deepEqual((await readRecord(page, 'memory-v1')).value.matched, matched.matched);
      await page.getByRole('button', { name: '8 pares', exact: true }).tap();
      await pollState(page, 'memory-v1', value => value.count === 8 && value.matched.length === 0, '8-pair mode did not start a new round');
      assert.equal(await page.locator('.memory-card').count(), 16);
      const newLabels = await page.locator('.memory-card-front > span').allTextContents();
      const different = newLabels.findIndex(label => label !== newLabels[0]);
      await page.locator('.memory-card').nth(0).tap();
      await page.locator('.memory-card').nth(different).tap();
      await page.getByRole('button', { name: 'Misturar de novo', exact: true }).tap();
      await page.locator('.memory-card').first().tap();
      await page.waitForTimeout(1350);
      assert.equal(await page.locator('.memory-card.is-open').count(), 1, 'a cancelled timeout cannot flip a card in a new round');
      await reloadGame(page, '.memory-board');
      assert.equal(await page.locator('.memory-card.is-open').count(), 0, 'an unmatched open card does not corrupt a restored round');
      return { sixPairs: 12, eightPairs: 16, pairPersisted: matched.matched[0], mismatchClosed: true, oldTimeoutCancelled: true, reloadConsistent: true };
    },
  },
  {
    name: 'garden-plant-reload-shelf',
    run: async page => {
      await openGame(page, 'Jardim de bolso', 'garden');
      await page.locator('.garden-canvas').waitFor({ state: 'visible' });
      const before = await pollState(page, 'garden-v1', value => Array.isArray(value.items), 'garden was not stored');
      await page.getByRole('button', { name: 'Plantar no jardim', exact: true }).tap();
      await page.getByRole('button', { name: 'Lua', exact: true }).tap();
      const planted = await pollState(page, 'garden-v1', value => value.items.length === before.items.length + 1 && value.weather === 'night', 'the new plant and night scene did not persist');
      await reloadGame(page, '.garden-canvas');
      assert.equal(await page.locator('[data-garden-id]').count(), planted.items.length);
      assert.deepEqual((await readRecord(page, 'garden-v1')).value, planted);
      const galleryBefore = (await readCreations(page)).length;
      await page.getByRole('button', { name: 'Guardar jardim', exact: true }).tap();
      const creation = await assertSavedPng(page, galleryBefore, 'Meu jardim de bolso');
      return { itemsBefore: before.items.length, itemsAfter: planted.items.length, weather: planted.weather, draftReloaded: true, creation };
    },
  },
  {
    name: 'cats-pet-reload-shelf',
    run: async page => {
      await openGame(page, 'Gatos de folga', 'cats');
      await page.locator('.cats-canvas').waitFor({ state: 'visible' });
      const catName = (await page.locator('.cats-name-button').nth(1).innerText()).trim();
      await page.getByRole('button', { name: catName, exact: true }).tap();
      await page.getByRole('button', { name: 'Chuva lá fora', exact: true }).tap();
      await page.getByRole('button', { name: 'Mais uma opinião felina', exact: true }).tap();
      const state = await pollState(page, 'cats-v1', value => value.cat === 'farofa' && value.scene === 'rain' && value.moment >= 2, 'cat interaction did not persist');
      await reloadGame(page, '.cats-canvas');
      assert.deepEqual((await readRecord(page, 'cats-v1')).value, state);
      assert.ok((await page.locator('.cats-canvas > svg').getAttribute('aria-label')).includes(catName));
      const before = (await readCreations(page)).length;
      await page.getByRole('button', { name: 'Guardar esse momento', exact: true }).tap();
      const creation = await assertSavedPng(page, before, `${catName}, de folga`);
      return { cat: state.cat, catName, scene: state.scene, interactions: state.moment, draftReloaded: true, creation };
    },
  },
  {
    name: 'sand-touch-rake-reload',
    run: async page => {
      await openGame(page, 'Areia de bolso', 'sand');
      await page.locator('.sand-canvas').waitFor({ state: 'visible' });
      const initial = await pollState(page, 'sand-v1', value => Array.isArray(value.strokes), 'sand was not stored');
      await page.getByRole('button', { name: 'Achadinhos', exact: true }).tap();
      await page.locator('.sand-stamp-list button').first().tap();
      await tapSvgPosition(page, '.sand-canvas > svg', .45, .48);
      await pollState(page, 'sand-v1', value => value.treasures.length === initial.treasures.length + 1, 'the touch did not place a beach treasure');
      await page.getByRole('button', { name: 'Rastelo', exact: true }).tap();
      const svg = page.locator('.sand-canvas > svg');
      await svg.scrollIntoViewIfNeeded();
      const box = await svg.boundingBox();
      await page.mouse.move(box.x + box.width * .18, box.y + box.height * .35);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * .75, box.y + box.height * .65, { steps: 12 });
      await page.mouse.up();
      const state = await pollState(page, 'sand-v1', value => value.strokes.length === 1 && value.treasures.length === initial.treasures.length + 1, 'the actual rake gesture did not persist');
      await reloadGame(page, '.sand-canvas');
      assert.deepEqual((await readRecord(page, 'sand-v1')).value, state);
      assert.equal(await page.locator('[data-treasure-id]').count(), state.treasures.length);
      return { treasures: state.treasures.length, strokes: state.strokes.length, strokePoints: state.strokes[0].points?.length, touchPlacement: true, mouseRake: true, draftReloaded: true };
    },
  },
  {
    name: 'crochet-touch-reload-shelf',
    run: async page => {
      await openGame(page, 'Só mais um pontinho', 'crochet');
      await page.locator('.crochet-svg').waitFor({ state: 'visible' });
      await page.locator('#crochet-pattern').selectOption('cats');
      const stitch = page.locator('[data-crochet-stitch]').nth(65);
      const id = await stitch.getAttribute('data-crochet-stitch');
      await stitch.tap();
      const state = await pollState(page, 'crochet-piece', value => value.pattern === 'cats' && typeof value.stitches[id] === 'string', 'the touch did not color a stitch');
      const fill = await stitch.locator('path').first().getAttribute('fill');
      assert.equal(fill, state.stitches[id]);
      await reloadGame(page, '.crochet-svg');
      assert.deepEqual((await readRecord(page, 'crochet-piece')).value, state);
      const before = (await readCreations(page)).length;
      await page.getByRole('button', { name: 'Guardar na galeria', exact: true }).tap();
      const creation = await assertSavedPng(page, before, 'Gatinhos de crochê');
      return { pattern: state.pattern, coloredStitch: id, color: state.stitches[id], draftReloaded: true, creation };
    },
  },
  {
    name: 'constellation-duo-win-reload-shelf',
    run: async page => {
      await openGame(page, 'Flores & bigodes', 'constellation');
      await page.locator('.constellation-board').waitFor({ state: 'visible' });
      await page.getByRole('button', { name: 'Com o Gui', exact: true }).tap();
      for (const cell of [1, 5, 2, 6, 3]) await page.getByRole('button', { name: `Casa ${cell}`, exact: true }).tap();
      const state = await pollState(page, 'constellation', value => value.mode === 'duo' && value.board.filter(Boolean).length === 5, 'the duo round did not persist');
      assert.deepEqual(state.board.slice(0, 3), ['flower', 'flower', 'flower']);
      assert.match(await page.locator('.round-status').innerText(), /floresceu/);
      assert.equal(await page.locator('.constellation-board .winning').count(), 3);
      await reloadGame(page, '.constellation-board');
      assert.deepEqual((await readRecord(page, 'constellation')).value, state);
      assert.match(await page.locator('.round-status').innerText(), /floresceu/);
      const before = (await readCreations(page)).length;
      await page.getByRole('button', { name: 'Guardar tabuleiro', exact: true }).tap();
      const creation = await assertSavedPng(page, before, 'Flores & bigodes');
      return { mode: state.mode, moves: 5, winningCells: [1, 2, 3], draftReloaded: true, creation };
    },
  },
];

if (args.includes('--list')) { console.log(cases.map(test => test.name).join('\n')); process.exit(0); }
const chosen = selectedCase ? cases.filter(test => test.name === selectedCase) : cases;
if (!chosen.length) throw new Error(`Unknown --case ${selectedCase}`);
results.summary.total = chosen.length;
await writeResults();
let browser;
try {
  const launcher = engine === 'webkit' ? webkit : engine === 'chromium' ? chromium : null;
  if (!launcher) throw new Error(`Unsupported browser ${engine}; choose chromium or webkit.`);
  browser = await launcher.launch({ headless: true });
  results.browserVersion = browser.version();
  for (const test of chosen) {
    const start = Date.now();
    const record = { name: test.name, status: 'RUNNING', viewport: test.desktop ? { width: 1280, height: 900 } : { width: 390, height: 844 }, touchEnabled: true, pageErrors: [], consoleErrors: [] };
    results.cases.push(record);
    const context = await browser.newContext(test.desktop ? { viewport: record.viewport, hasTouch: true, locale: 'pt-BR' } : { ...devices['iPhone 13'], viewport: record.viewport, deviceScaleFactor: 1, locale: 'pt-BR' });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    page.on('pageerror', error => record.pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') record.consoleErrors.push(message.text()); });
    try {
      record.evidence = await test.run(page);
      record.evidence.navigation ??= page.navigationEvidence;
      assert.deepEqual(record.pageErrors, [], 'no unhandled application errors during the actual flow');
      record.status = 'PASS'; results.summary.passed++;
    } catch (error) {
      record.status = 'FAIL'; results.summary.failed++;
      record.error = { message: error.message, stack: error.stack };
      record.failedUrl = page.url();
      record.wordAttempts = page.wordAttempts;
      record.pointerEvents = await page.evaluate(() => window.__wordPointerEvents).catch(() => undefined);
      record.visibleText = (await page.locator('body').innerText().catch(() => '')).slice(0, 6000);
    } finally {
      record.durationMs = Date.now() - start;
      await context.close();
      await writeResults();
      console.log(`${record.status}: ${record.name} (${record.durationMs}ms)${record.error ? ` — ${record.error.message}` : ''}`);
    }
  }
  results.status = results.summary.failed ? 'FAIL' : 'PASS';
  process.exitCode = results.summary.failed ? 1 : 0;
} catch (error) {
  results.status = 'BLOCKED'; results.infrastructureError = { message: error.message, stack: error.stack }; process.exitCode = 1;
  console.error(error.message);
} finally {
  if (browser) await browser.close();
  results.endedAt = new Date().toISOString();
  await writeResults();
  console.log(`Evidence: ${evidencePath}`);
}
