import assert from 'node:assert/strict';
import test from 'node:test';
import { BackupValidationError, MAX_BACKUP_BYTES, MAX_IMAGE_BYTES, normalizeBackup, parseBackup } from '../src/lib/backup.ts';
import { createCeramicDraft } from '../src/games/Ceramic3D.logic.ts';

const NOW = Date.UTC(2026, 8, 30, 15);
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const creation = { id: 'piece-1', createdAt: NOW - 1000, title: 'Minha flor', kind: 'atelier', dataUrl: PNG, version: 1, display: 'frame', plant: 'flower' };
const record = (key: string, value: unknown) => ({ key, value, version: 1, updatedAt: NOW - 2000 });
const backup = (state: unknown[] = [], creations: unknown[] = []) => ({ format: 'atoa-leticia', version: 2, createdAt: NOW, state, creations });
const rejects = (input: unknown) => assert.throws(() => normalizeBackup(input, NOW), BackupValidationError);

test('expanded painting, ceramics, garden and photo wall preserve their exact current data', () => {
  const state = [record('ceramic-3d', createCeramicDraft('plate')), record('atelier-brush-kind', 'watercolor'), record('photo-wall', { version: 1, background: 'cork', items: [{ creationId: 'photo-1', x: 450, y: 350, angle: -8, frame: 'arch', size: .85, fit: 'contain' }] }), record('garden-v1', { weather: 'day', ground: 'sage', items: [{ id: 'plant-1', kind: 'calathea', x: 450, y: 350, color: '#52785c', size: 1.2, rotation: 15, potStyle: 'woven', potColor: '#d7917c' }] })];
  assert.deepEqual(parseBackup(JSON.stringify(backup(state)), NOW).state, state);
});
test('expanded imports reject malformed radii and photo references before any writes', () => {
  const ceramic = createCeramicDraft(); ceramic.profile[0] = -1; rejects(backup([record('ceramic-3d', ceramic)]));
  rejects(backup([record('photo-wall', { version: 1, background: 'paper', items: [{ creationId: 'photo-1', x: 0, y: 0, angle: 0, frame: 'polaroid', size: 2 }] })]));
});

test('current backup preserves gift, settings, shelf presentation and timestamps', () => {
  const gift = { version: 1, source: 'personal', notes: ['Você e o gato cabem aqui.'], letter: 'Uma carta escrita de verdade.' };
  const input = backup([record('gift-content', gift), record('intro-seen', true), record('shelf-layout', ['piece-1']), record('settings', { nickname: 'Leh', theme: 'sage', sound: false, reducedMotion: true, letter: '', showCat: false }), record('favorites', ['atelier', 'garden']), record('last-game', 'atelier')], [creation]);
  const result = parseBackup(JSON.stringify(input), NOW);
  assert.deepEqual(result, input); assert.notEqual(result.state[0].value, gift);
  assert.equal(result.creations[0].plant, 'flower'); assert.equal(result.creations[0].display, 'frame');
});

test('valid drafts for every game normalize without losing artwork or progress', () => {
  const state = [
    record('atelier-artwork', { seed: 7, picture: 'forest', regions: { 'leaf-1': '#52785c' }, pixelSeed: 4, pixelPicture: 'cat', pixels: { '0:23': '#fff9ed' }, strokes: [{ points: [{ x: 0, y: 0 }, { x: 600, y: 600 }], color: '#bc7e8f', size: 12, erase: false }], library: { cat: { seed: 10, regions: { 'cat-body': '#e4c15c' } } } }),
    record('atelier-mode', 'free'), record('atelier-color-set', 'forest'), record('atelier-color', '#e4c15c'), record('atelier-brush', 2), record('atelier-numbers', false),
    record('crochet-piece', { seed: 0xffffffff, pattern: 'cats', stitches: { '13:13': '#e4c15c' } }), record('crochet-color', '#52785c'), record('crochet-guide', true),
    record('clay', { shape: 'vaso', color: '#d7917c', width: 110, height: 190, text: 'Leh', motifs: [{ x: 260, y: 264, type: 'flor', color: '#fff9ed' }] }),
    record('garden-v1', { weather: 'night', ground: 'sage', items: [{ id: 'plant-1', kind: 'fern', x: 350, y: 500, color: '#52785c', size: 1, rotation: -15 }] }),
    record('cats-v1', { cat: 'farofa', action: 'yarn', scene: 'rain', moment: 12 }),
    record('sand-v1', { seed: 13, tone: 'rose', strokes: [{ id: 'stroke-1', points: [{ x: 100, y: 200 }], width: 3 }], treasures: [{ id: 'shell-1', kind: 'shell', x: 300, y: 400, color: '#d7917c', angle: 22, size: 1 }] }),
    record('wordsearch-v1', { seed: 7, theme: 'plants', difficulty: 'easy', found: ['CACTO'], hint: 13 }),
    record('softword-v1', { seed: 8, guesses: ['AMORA'], hints: 3, outcome: 'playing' }), record('softword-draft-v1', 'CAL'),
    record('memory-v1', { seed: 8, count: 8, matched: ['cat', 'plant'] }),
    record('constellation', { board: ['flower', 'cat', ...Array(14).fill(null)], turn: 'flower', mode: 'duo' }),
  ];
  assert.deepEqual(normalizeBackup(backup(state), NOW).state, state);
});

test('v1 migration retains originals and carries private texts into current gift content', () => {
  const notes = ['Minha própria mensagem.'];
  const settings = { nickname: 'Lê', theme: 'rose', sound: false, reducedMotion: false, letter: 'Nossa carta original.', showCat: true };
  const old = { format: 'atoa-leticia', version: 1, createdAt: NOW, drafts: { settings, 'love-notes': notes, 'crochet-piece': { seed: 99, pattern: 'free', stitches: { '3:7': '#bc7e8f' } }, 'wordsearch-v1': { seed: 2, theme: 'garden', found: ['JARDIM'], hint: null } }, creations: [creation] };
  const result = parseBackup(JSON.stringify(old), NOW);
  assert.equal(result.version, 2); assert.deepEqual(result.creations, [creation]);
  assert.deepEqual(result.state.find(item => item.key === 'settings')?.value, settings);
  assert.deepEqual(result.state.find(item => item.key === 'love-notes')?.value, notes);
  assert.deepEqual(result.state.find(item => item.key === 'gift-content')?.value, { version: 1, source: 'personal', notes, letter: settings.letter });
  assert.deepEqual(result.state.find(item => item.key === 'crochet-piece')?.value, old.drafts['crochet-piece']);
  assert.equal((result.state.find(item => item.key === 'wordsearch-v1')?.value as { difficulty: string }).difficulty, 'normal');
});

test('v1 wrapped records retain update dates and existing gift content takes precedence', () => {
  const gift = { version: 1, source: 'provided', notes: ['Mensagem original fornecida.'] };
  const old = { format: 'atoa-leticia', version: 1, createdAt: NOW, drafts: { 'gift-content': { version: 1, value: gift, updatedAt: NOW - 10 }, 'love-notes': ['Anotação antiga.'] }, creations: [] };
  const result = normalizeBackup(old, NOW); assert.equal(result.state.length, 2); assert.equal(result.state[0].updatedAt, NOW - 10); assert.deepEqual(result.state[0].value, gift);
});

test('preserves personal cat profiles, imported photos and plant choice on clay drafts', () => {
  const cats = [{ name: 'Nome fornecido', coat: 'orange' }, { name: 'Outro nome fornecido', coat: 'cow' }, { name: 'Terceiro nome fornecido', coat: 'siamese' }];
  const gift = { version: 1, source: 'personal', notes: [], letter: 'Carta original.', cats };
  const clay = { shape: 'vaso', color: '#d7917c', width: 110, height: 190, text: '', plant: 'succulent', motifs: [] };
  const photo = { ...creation, id: 'photo-1', kind: 'photo', display: 'frame', plant: 'none' };
  const result = normalizeBackup(backup([record('gift-content', gift), record('clay', clay)], [photo]), NOW);
  assert.deepEqual(result.state[0].value, gift); assert.deepEqual(result.state[1].value, clay); assert.deepEqual(result.creations[0], photo);
  rejects(backup([record('gift-content', { ...gift, cats: [{ name: 'Nome fornecido', coat: 'unknown' }] })]));
  rejects(backup([record('gift-content', { ...gift, cats: [{ name: '   ', coat: 'cow' }] })]));
  rejects(backup([record('gift-content', { ...gift, cats: [{ name: 'Nome fornecido', coat: 'cow', private: 'unknown-field' }] })]));
  rejects(backup([record('clay', { ...clay, plant: 'unknown' })]));
});

test('unknown keys and invalid enums are rejected instead of reaching game renderers', () => {
  rejects(backup([record('made-up-key', [])]));
  rejects(backup([record('favorites', ['super-game'])])); rejects(backup([record('last-game', 'none')]));
  rejects(backup([record('cats-v1', { cat: 'real-cat', action: 'pet', scene: 'night', moment: 0 })]));
  rejects(backup([record('crochet-piece', { seed: 1, pattern: 'unsupported', stitches: {} })]));
  rejects(backup([record('atelier-mode', 'infinite-canvas')]));
  rejects(backup([record('atelier-color-set', 'unrecognized-palette')]));
  rejects(backup([record('gift-content', { version: 1, source: 'invented', notes: [] })]));
  rejects(backup([], [{ ...creation, display: 'unknown' }]));
});

test('rejects non-finite numbers, invalid seeds, board lengths, hints and coordinates', () => {
  rejects(backup([record('cats-v1', { cat: 'pantufa', action: 'pet', scene: 'night', moment: Infinity })]));
  rejects(backup([record('memory-v1', { seed: -1, count: 6, matched: [] })]));
  rejects(backup([record('memory-v1', { seed: 1.5, count: 6, matched: [] })]));
  rejects(backup([record('memory-v1', { seed: 0x100000000, count: 6, matched: [] })]));
  rejects(backup([record('constellation', { board: Array(15).fill(null), turn: 'flower', mode: 'solo' })]));
  rejects(backup([record('softword-v1', { seed: 1, guesses: [], hints: 6, outcome: 'playing' })]));
  rejects(backup([record('wordsearch-v1', { seed: 1, theme: 'garden', difficulty: 'easy', found: [], hint: 64 })]));
  rejects(backup([record('sand-v1', { seed: 1, tone: 'honey', treasures: [], strokes: [{ id: 'stroke-1', points: [{ x: 800, y: 10 }], width: 2 }] })]));
  rejects(backup([record('crochet-piece', { seed: 1, pattern: 'free', stitches: { '14:0': '#fff9ed' } })]));
  rejects(backup([record('softword-draft-v1', 'CALMAS')]));
});

test('images require supported MIME, canonical base64 and the matching binary signature', () => {
  for (const dataUrl of ['data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', 'data:image/png;base64,this-is-not-base64', 'data:image/png;base64,SGVsbG8gdGhlcmUsIGZyaWVuZA==', PNG.replace('image/png', 'image/jpeg'), PNG.replace('base64,', 'base64,\n'), 'https://example.com/image.png']) rejects(backup([], [{ ...creation, dataUrl }]));
  const large = `data:image/png;base64,${'A'.repeat(Math.ceil((MAX_IMAGE_BYTES + 1) / 3) * 4)}`;
  rejects(backup([], [{ ...creation, dataUrl: large }]));
});

test('prototype-like keys are rejected at every nesting level without polluting objects', () => {
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const rootText = `{"format":"atoa-leticia","version":2,"createdAt":${NOW},"state":[],"creations":[],"${key}":{}}`;
    assert.throws(() => parseBackup(rootText, NOW), BackupValidationError);
    const nestedText = JSON.stringify(backup([record('crochet-piece', { seed: 1, pattern: 'free', stitches: {} })])).replace('"stitches":{}', `"stitches":{"${key}":"#fff9ed"}`);
    assert.throws(() => parseBackup(nestedText, NOW), BackupValidationError);
  }
  rejects(Object.assign(Object.create({ malicious: true }), backup()));
  assert.equal(({} as { malicious?: boolean }).malicious, undefined);
});

test('duplicates, malformed records, invisible control characters and dates are rejected', () => {
  rejects(backup([record('intro-seen', true), record('intro-seen', false)])); rejects(backup([], [creation, creation]));
  rejects(backup([record('favorites', ['cats', 'cats'])])); rejects(backup([record('shelf-layout', ['piece-1', 'piece-1'])]));
  rejects(backup([{ ...record('intro-seen', true), version: 99 }]));
  rejects(backup([record('intro-seen', 'yes')]));
  rejects(backup([record('gift-content', { version: 1, source: 'personal', notes: ['a\u0000b'] })]));
  rejects(backup([], [{ ...creation, createdAt: 0 }])); rejects(backup([], [{ ...creation, createdAt: NOW + 86_400_001 }]));
  assert.throws(() => parseBackup('{"broken":', NOW), BackupValidationError);
});

test('file limit counts actual UTF-8 bytes, not only JavaScript characters', () => {
  const text = `{"format":"${'é'.repeat(MAX_BACKUP_BYTES / 2)}"}`;
  assert.ok(text.length < MAX_BACKUP_BYTES); assert.throws(() => parseBackup(text, NOW), /80 MB/);
});
