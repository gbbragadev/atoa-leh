import type { Creation } from './types';
import type { StateRecord } from './storage';

export type BackupV2 = { format: 'atoa-leticia'; version: 2; createdAt: number; state: StateRecord[]; creations: Creation[] };
export const MAX_BACKUP_BYTES = 80 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_POINTS = 250_000;
const GAME_IDS = ['atelier', 'crochet', 'clay', 'ceramic3d', 'photowall', 'garden', 'cats', 'sand', 'wordsearch', 'word', 'memory', 'constellation'] as const;
const PICTURES = ['flowers', 'cat', 'pottery', 'journey', 'forest', 'cats-window', 'cats-yarn', 'cats-nap', 'greenhouse', 'plant-shelf', 'window-garden', 'cozy-kitchen', 'reading-corner', 'crochet-basket', 'pottery-bouquet', 'pottery-table'] as const;
const MEMORY_IDS = ['cat', 'plant', 'yarn', 'mug', 'flower', 'pot', 'bear', 'mobile', 'bird', 'mittens', 'shell', 'cushion', 'van', 'duck'] as const;
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
type JsonRecord = Record<string, unknown>;
type ValidationContext = { now: number; legacy: boolean; points: number };

export class BackupValidationError extends Error {
  constructor(message = 'Esta cópia tem dados inválidos. Escolha um arquivo exportado pelo À toa.') { super(message); this.name = 'BackupValidationError'; }
}
function invalid(path: string): never { throw new BackupValidationError(`Não consegui abrir esta cópia: ${path} está inválido.`); }
function object(value: unknown, path: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalid(path);
  return value as JsonRecord;
}
function fields(value: unknown, path: string, allowed: readonly string[], required: readonly string[] = allowed): JsonRecord {
  const record = object(value, path);
  if (Object.keys(record).some(key => UNSAFE_KEYS.has(key) || !allowed.includes(key)) || required.some(key => !Object.hasOwn(record, key))) invalid(path);
  return record;
}
function text(value: unknown, path: string, max: number, min = 0): string {
  if (typeof value !== 'string' || value.length < min || value.length > max || CONTROL_CHARACTERS.test(value)) invalid(path);
  return value;
}
function number(value: unknown, path: string, min: number, max: number, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) invalid(path);
  return value;
}
function boolean(value: unknown, path: string): boolean { if (typeof value !== 'boolean') invalid(path); return value; }
function enumValue(value: unknown, allowed: readonly (string | number)[], path: string) { if (!allowed.includes(value as string)) invalid(path); return value; }
function list(value: unknown, path: string, max: number, min = 0): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) invalid(path);
  for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) invalid(path);
  return value;
}
function unique(values: unknown[], path: string) { if (new Set(values).size !== values.length) invalid(path); }
function seed(value: unknown, path: string) { return number(value, path, 0, 0xffffffff, true); }
function timestamp(value: unknown, path: string, now: number) { return number(value, path, 1, Math.min(8_640_000_000_000_000, now + 86_400_000), true); }
function color(value: unknown, path: string): string { const result = text(value, path, 7, 7); if (!/^#[\da-f]{6}$/i.test(result)) invalid(path); return result; }
function identifier(value: unknown, path: string): string {
  const result = text(value, path, 160, 1);
  if (!/^[a-z\d][a-z\d._:-]*$/i.test(result) || UNSAFE_KEYS.has(result)) invalid(path);
  return result;
}
function stringList(value: unknown, path: string, max: number, itemMax: number) { return list(value, path, max).map((item, i) => text(item, `${path}[${i}]`, itemMax)); }
function points(value: unknown, path: string, width: number, height: number, context: ValidationContext) {
  const items = list(value, path, 100_000, 1); context.points += items.length;
  if (context.points > MAX_POINTS) throw new BackupValidationError('Esta cópia tem pontos de desenho demais para abrir de uma vez.');
  items.forEach((item, i) => { const p = fields(item, `${path}[${i}]`, ['x', 'y']); number(p.x, `${path}.x`, 0, width); number(p.y, `${path}.y`, 0, height); });
}
function colors(value: unknown, path: string, max: number, keyIsValid: (key: string) => boolean) {
  const record = object(value, path); if (Object.keys(record).length > max) invalid(path);
  for (const [key, item] of Object.entries(record)) { if (!keyIsValid(key) || UNSAFE_KEYS.has(key)) invalid(`${path}.${key}`); color(item, `${path}.${key}`); }
}
function gridKey(key: string, width: number): boolean {
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(key);
  return !!match && Number(match[1]) < width && Number(match[2]) < width;
}

// Cloning rejects non-JSON objects, dangerous property names and malformed numbers
// before any record can be handed to IndexedDB or a game's renderer.
function cleanJson(value: unknown, path = 'arquivo', depth = 0, count = { nodes: 0 }): unknown {
  if (depth > 30 || ++count.nodes > 2_000_000) invalid(path);
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') { if (!Number.isFinite(value)) invalid(path); return value; }
  if (typeof value === 'string') { if (value.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 64 || CONTROL_CHARACTERS.test(value)) invalid(path); return value; }
  if (Array.isArray(value)) {
    if (value.length > 250_000) invalid(path);
    const result: unknown[] = []; for (let i = 0; i < value.length; i++) { if (!Object.hasOwn(value, i)) invalid(path); result.push(cleanJson(value[i], `${path}[${i}]`, depth + 1, count)); } return result;
  }
  const record = object(value, path); const result: JsonRecord = {};
  for (const [key, item] of Object.entries(record)) { if (UNSAFE_KEYS.has(key)) invalid(`${path}.${key}`); result[key] = cleanJson(item, `${path}.${key}`, depth + 1, count); }
  return result;
}

function validateImage(value: unknown, path: string) {
  const dataUrl = text(value, path, Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 64, 1);
  const comma = dataUrl.indexOf(','); const header = dataUrl.slice(0, comma); const payload = dataUrl.slice(comma + 1);
  if (!/^data:image\/(png|jpeg|webp);base64$/.test(header) || !payload.length || payload.length % 4 !== 0 || !/^[A-Za-z\d+/]+={0,2}$/.test(payload)) invalid(path);
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  const bytes = payload.length / 4 * 3 - padding;
  if (bytes > MAX_IMAGE_BYTES || bytes < 12) invalid(path);
  let first: string;
  try { first = atob(payload.slice(0, Math.min(32, payload.length))); } catch { invalid(path); }
  const validSignature = header.includes('/png;') ? first.startsWith('\x89PNG\r\n\x1a\n') && first.slice(12, 16) === 'IHDR'
    : header.includes('/jpeg;') ? first.charCodeAt(0) === 0xff && first.charCodeAt(1) === 0xd8 && first.charCodeAt(2) === 0xff
      : first.startsWith('RIFF') && first.slice(8, 12) === 'WEBP';
  if (!validSignature) invalid(path);
  return dataUrl;
}
function creation(value: unknown, index: number, now: number): Creation {
  const path = `criações[${index}]`;
  const item = fields(value, path, ['id', 'createdAt', 'kind', 'title', 'dataUrl', 'version', 'display', 'plant'], ['id', 'createdAt', 'kind', 'title', 'dataUrl']);
  identifier(item.id, `${path}.id`); timestamp(item.createdAt, `${path}.createdAt`, now); text(item.kind, `${path}.kind`, 100, 1); text(item.title, `${path}.title`, 300, 1); validateImage(item.dataUrl, `${path}.imagem`);
  if (item.version !== undefined) enumValue(item.version, [1], `${path}.version`);
  if (item.display !== undefined) enumValue(item.display, ['frame', 'object'], `${path}.display`);
  if (item.plant !== undefined) enumValue(item.plant, ['none', 'fern', 'flower', 'succulent'], `${path}.plant`);
  return { ...item, version: 1 } as Creation;
}

function validateStateValue(key: string, value: unknown, context: ValidationContext): unknown {
  const path = `rascunhos.${key}`;
  switch (key) {
    case 'settings': {
      const item = fields(value, path, ['nickname', 'theme', 'sound', 'reducedMotion', 'letter', 'showCat'], ['nickname', 'theme', 'sound', 'reducedMotion', 'letter']);
      text(item.nickname, `${path}.nickname`, 80); enumValue(item.theme, ['sage', 'rose', 'lavender'], `${path}.theme`); boolean(item.sound, `${path}.sound`); boolean(item.reducedMotion, `${path}.reducedMotion`); text(item.letter, `${path}.letter`, 30_000);
      if (item.showCat !== undefined) boolean(item.showCat, `${path}.showCat`); return item;
    }
    case 'gift-content': {
      const item = fields(value, path, ['version', 'source', 'notes', 'letter', 'cats'], ['version', 'source', 'notes']); enumValue(item.version, [1], `${path}.version`); enumValue(item.source, ['provided', 'personal'], `${path}.source`);
      stringList(item.notes, `${path}.notes`, 1000, 5000); if (item.letter !== undefined) text(item.letter, `${path}.letter`, 30_000);
      if (item.cats !== undefined) list(item.cats, `${path}.cats`, 20).forEach((cat, index) => { const profile = fields(cat, `${path}.cats[${index}]`, ['name', 'coat']); if (!text(profile.name, `${path}.cats[${index}].name`, 80, 1).trim()) invalid(`${path}.cats[${index}].name`); enumValue(profile.coat, ['orange', 'cow', 'siamese'], `${path}.cats[${index}].coat`); }); return item;
    }
    case 'love-notes': return stringList(value, path, 1000, 5000);
    case 'gift-editor-draft': {
      if (value === null) return null;
      const item = fields(value, path, ['letter', 'notes']); text(item.letter, path, 30_000); text(item.notes, path, 100_000); return item;
    }
    case 'intro-seen': case 'atelier-numbers': case 'crochet-guide': return boolean(value, path);
    case 'favorites': { const items = list(value, path, GAME_IDS.length); items.forEach(item => enumValue(item, GAME_IDS, path)); unique(items, path); return items; }
    case 'last-game': return value === null ? null : enumValue(value, GAME_IDS, path);
    case 'shelf-layout': { const items = list(value, path, 10_000); items.forEach(item => identifier(item, path)); unique(items, path); return items; }
    case 'atelier-mode': return enumValue(value, ['color', 'pixels', 'free'], path);
    case 'atelier-color-set': return enumValue(value, ['workshop', 'sunshine', 'forest', 'sweets'], path);
    case 'atelier-color': case 'crochet-color': return color(value, path);
    case 'atelier-brush': return number(value, path, 2, 50);
    case 'atelier-brush-kind': return enumValue(value, ['pen', 'chalk', 'watercolor'], path);
    case 'atelier-artwork': {
      const item = fields(value, path, ['seed', 'picture', 'regions', 'pixelSeed', 'pixelPicture', 'pixels', 'strokes', 'library'], ['seed', 'picture', 'regions', 'pixelSeed', 'pixelPicture', 'pixels', 'strokes']);
      seed(item.seed, `${path}.seed`); seed(item.pixelSeed, `${path}.pixelSeed`); enumValue(item.picture, PICTURES, `${path}.picture`); enumValue(item.pixelPicture, ['cat', 'plant', 'flowers'], `${path}.pixelPicture`);
      const regionKey = (region: string) => /^[a-z][a-z\d_-]{0,99}$/i.test(region);
      colors(item.regions, `${path}.regions`, 20_000, regionKey); colors(item.pixels, `${path}.pixels`, 576, key => gridKey(key, 24));
      list(item.strokes, `${path}.strokes`, 50_000).forEach((stroke, i) => { const s = fields(stroke, `${path}.strokes[${i}]`, ['points', 'color', 'size', 'erase', 'brush', 'textureSeed'], ['points', 'color', 'size', 'erase']); color(s.color, path); number(s.size, path, 2, 50); boolean(s.erase, path); if (s.brush !== undefined) enumValue(s.brush, ['pen', 'chalk', 'watercolor'], path); if (s.textureSeed !== undefined) seed(s.textureSeed, path); points(s.points, `${path}.strokes[${i}].points`, 600, 600, context); });
      if (item.library !== undefined) { const library = object(item.library, `${path}.library`); for (const [picture, value] of Object.entries(library)) { enumValue(picture, PICTURES, path); const art = fields(value, `${path}.library.${picture}`, ['seed', 'regions']); seed(art.seed, path); colors(art.regions, path, 20_000, regionKey); } } return item;
    }
    case 'crochet-piece': {
      const item = fields(value, path, ['seed', 'pattern', 'stitches']); seed(item.seed, `${path}.seed`); enumValue(item.pattern, ['hearts', 'cats', 'flowers', 'free'], path); colors(item.stitches, `${path}.stitches`, 196, key => gridKey(key, 14)); return item;
    }
    case 'clay': {
      const item = fields(value, path, ['shape', 'color', 'width', 'height', 'text', 'motifs', 'plant'], ['shape', 'color', 'width', 'height', 'text', 'motifs']); enumValue(item.shape, ['vaso', 'pratinho', 'gatinho'], path); color(item.color, path); number(item.width, path, 70, 145); number(item.height, path, 140, 230); text(item.text, path, 22);
      if (item.plant !== undefined) enumValue(item.plant, ['none', 'fern', 'flower', 'succulent'], `${path}.plant`);
      list(item.motifs, `${path}.motifs`, 10_000).forEach((motif, i) => { const m = fields(motif, `${path}.motifs[${i}]`, ['x', 'y', 'type', 'color']); number(m.x, path, 0, 520); number(m.y, path, 0, 460); enumValue(m.type, ['flor', 'pata', 'coracao'], path); color(m.color, path); }); return item;
    }
    case 'photo-wall': {
      const item = fields(value, path, ['version', 'background', 'items']); enumValue(item.version, [1], path); enumValue(item.background, ['paper', 'sage', 'cork'], path);
      const ids: unknown[] = []; list(item.items, `${path}.items`, 100).forEach(photo => { const p = fields(photo, path, ['creationId', 'x', 'y', 'angle', 'frame', 'size', 'fit'], ['creationId', 'x', 'y', 'angle', 'frame', 'size']); if (p.fit !== undefined) enumValue(p.fit, ['cover', 'contain'], path); ids.push(identifier(p.creationId, path)); number(p.x, path, 0, 900); number(p.y, path, 0, 700); number(p.angle, path, -30, 30); enumValue(p.frame, ['polaroid', 'tape', 'arch'], path); number(p.size, path, .4, 1.5); }); unique(ids, path); return item;
    }
    case 'ceramic-3d': {
      const item = fields(value, path, ['version', 'preset', 'profile', 'height', 'color', 'finish', 'pattern', 'patternColor', 'stamps', 'view']);
      enumValue(item.version, [1], path); enumValue(item.preset, ['vase', 'bowl', 'plate', 'mug', 'pitcher', 'amphora', 'planter', 'bottle', 'goblet'], path);
      list(item.profile, `${path}.profile`, 32, 32).forEach(radius => number(radius, path, .18, 1.55)); number(item.height, path, .35, 2.9); color(item.color, path); color(item.patternColor, path);
      enumValue(item.finish, ['matte', 'glossy'], path); enumValue(item.pattern, ['plain', 'speckles', 'stripes', 'waves', 'petals', 'leaves', 'dots', 'patchwork', 'arches'], path);
      const view = fields(item.view, `${path}.view`, ['azimuth', 'elevation']); number(view.azimuth, path, -Math.PI, Math.PI); number(view.elevation, path, .12, 1.1);
      list(item.stamps, `${path}.stamps`, 120).forEach(stamp => { const s = fields(stamp, path, ['u', 'v', 'type', 'color', 'size']); number(s.u, path, 0, 1); number(s.v, path, 0, 1); enumValue(s.type, ['flower', 'paw', 'leaf', 'heart'], path); color(s.color, path); number(s.size, path, .025, .14); }); return item;
    }
    case 'garden-v1': {
      const item = fields(value, path, ['items', 'weather', 'ground']); enumValue(item.weather, ['day', 'night', 'rain'], path); enumValue(item.ground, ['linen', 'rose', 'sage'], path);
      const ids: unknown[] = []; list(item.items, `${path}.items`, 10_000).forEach((plant, i) => { const p = fields(plant, `${path}.items[${i}]`, ['id', 'kind', 'x', 'y', 'color', 'size', 'rotation', 'potStyle', 'potColor'], ['id', 'kind', 'x', 'y', 'color', 'size', 'rotation']); ids.push(identifier(p.id, path)); enumValue(p.kind, ['monstera', 'flower', 'cactus', 'fern', 'daisy', 'mushroom', 'butterfly', 'sunflower', 'tulip', 'lavender', 'pilea', 'ivy', 'succulent', 'calathea'], path); number(p.x, path, 0, 720); number(p.y, path, 0, 700); color(p.color, path); number(p.size, path, .1, 3); number(p.rotation, path, -360, 360); if (p.potStyle !== undefined) enumValue(p.potStyle, ['classic', 'round', 'striped', 'speckled', 'woven', 'face'], path); if (p.potColor !== undefined) color(p.potColor, path); }); unique(ids, path); return item;
    }
    case 'cats-v1': {
      const item = fields(value, path, ['cat', 'action', 'scene', 'moment']); enumValue(item.cat, ['pantufa', 'farofa', 'soneca'], path); enumValue(item.action, ['pet', 'yarn', 'feather', 'duck', 'box'], path); enumValue(item.scene, ['afternoon', 'rain', 'night'], path); number(item.moment, path, 0, Number.MAX_SAFE_INTEGER, true); return item;
    }
    case 'sand-v1': {
      const item = fields(value, path, ['strokes', 'treasures', 'seed', 'tone']); seed(item.seed, path); enumValue(item.tone, ['honey', 'rose', 'pearl'], path);
      const strokeIds: unknown[] = []; list(item.strokes, `${path}.strokes`, 50_000).forEach((stroke, i) => { const s = fields(stroke, `${path}.strokes[${i}]`, ['id', 'points', 'width']); strokeIds.push(identifier(s.id, path)); enumValue(s.width, [2, 3], path); points(s.points, `${path}.strokes[${i}].points`, 720, 700, context); }); unique(strokeIds, path);
      const treasureIds: unknown[] = []; list(item.treasures, `${path}.treasures`, 10_000).forEach((treasure, i) => { const t = fields(treasure, `${path}.treasures[${i}]`, ['id', 'kind', 'x', 'y', 'color', 'angle', 'size']); treasureIds.push(identifier(t.id, path)); enumValue(t.kind, ['shell', 'stone', 'star', 'glass'], path); number(t.x, path, 0, 720); number(t.y, path, 0, 700); color(t.color, path); number(t.angle, path, -360, 360); number(t.size, path, .1, 3); }); unique(treasureIds, path); return item;
    }
    case 'wordsearch-v1': {
      const item = fields(value, path, ['seed', 'theme', 'difficulty', 'found', 'hint'], context.legacy ? ['seed', 'theme', 'found', 'hint'] : ['seed', 'theme', 'difficulty', 'found', 'hint']);
      if (context.legacy && item.difficulty === undefined) item.difficulty = 'normal';
      seed(item.seed, path); enumValue(item.theme, ['garden', 'plants', 'kitchen', 'craft', 'cozy'], path); enumValue(item.difficulty, ['easy', 'normal'], path);
      const found = list(item.found, `${path}.found`, item.difficulty === 'easy' ? 6 : 7); found.forEach(word => { if (!/^[A-Z]{1,10}$/.test(text(word, path, 10, 1))) invalid(path); }); unique(found, path);
      if (item.hint !== null) number(item.hint, path, 0, item.difficulty === 'easy' ? 63 : 99, true); return item;
    }
    case 'softword-v1': {
      const item = fields(value, path, ['seed', 'guesses', 'hints', 'outcome']); seed(item.seed, path); enumValue(item.outcome, ['playing', 'solved', 'revealed'], path); number(item.hints, path, 0, 5, true);
      list(item.guesses, `${path}.guesses`, 10_000).forEach(guess => { if (!/^[A-Z]{5}$/.test(text(guess, path, 5, 5))) invalid(path); }); return item;
    }
    case 'softword-draft-v1': { const draft = text(value, path, 5); if (!/^[A-Z]*$/.test(draft)) invalid(path); return draft; }
    case 'memory-v1': {
      const item = fields(value, path, ['seed', 'count', 'matched']); seed(item.seed, path); enumValue(item.count, [6, 8], path);
      const matched = list(item.matched, `${path}.matched`, item.count as number); matched.forEach(id => enumValue(id, MEMORY_IDS, path)); unique(matched, path); return item;
    }
    case 'constellation': {
      const item = fields(value, path, ['board', 'turn', 'mode']); const board = list(item.board, `${path}.board`, 16, 16); board.forEach(mark => { if (mark !== null) enumValue(mark, ['flower', 'cat'], path); }); enumValue(item.turn, ['flower', 'cat'], path); enumValue(item.mode, ['solo', 'duo'], path); return item;
    }
    default: return invalid(`chave ${key}`);
  }
}

function byteSize(text: string) { return new TextEncoder().encode(text).byteLength; }
function assertFileSize(text: string) { if (text.length > MAX_BACKUP_BYTES || byteSize(text) > MAX_BACKUP_BYTES) throw new BackupValidationError('Esta cópia ultrapassa 80 MB.'); }

/** Validates a JSON-shaped value and returns an independent, current-format copy. */
export function normalizeBackup(input: unknown, now = Date.now()): BackupV2 {
  const source = object(cleanJson(input), 'arquivo');
  const legacy = source.version === 1;
  fields(source, 'arquivo', legacy ? ['format', 'version', 'createdAt', 'drafts', 'creations'] : ['format', 'version', 'createdAt', 'state', 'creations']);
  if (source.format !== 'atoa-leticia' || (!legacy && source.version !== 2)) invalid('formato');
  const createdAt = timestamp(source.createdAt, 'data da cópia', now); const context: ValidationContext = { now, legacy, points: 0 };
  let state: StateRecord[];
  if (legacy) {
    const drafts = object(source.drafts, 'rascunhos'); if (Object.keys(drafts).length > 64) invalid('rascunhos');
    state = Object.entries(drafts).map(([key, input]) => {
      let value = input; let updatedAt = createdAt;
      if (value && typeof value === 'object' && !Array.isArray(value) && Object.hasOwn(value, 'value')) {
        const wrapped = fields(value, `rascunhos.${key}`, ['key', 'version', 'value', 'updatedAt'], ['version', 'value']);
        enumValue(wrapped.version, [1], `rascunhos.${key}.version`); if (wrapped.key !== undefined && wrapped.key !== key) invalid(`rascunhos.${key}.key`);
        if (wrapped.updatedAt !== undefined) updatedAt = timestamp(wrapped.updatedAt, `rascunhos.${key}.updatedAt`, now); value = wrapped.value;
      }
      return { key, version: 1, updatedAt, value: validateStateValue(key, value, context) };
    });
    // Keep the original legacy fields too; these texts are never replaced by examples.
    if (!state.some(record => record.key === 'gift-content')) {
      const notes = state.find(record => record.key === 'love-notes')?.value as string[] | undefined;
      const settings = state.find(record => record.key === 'settings')?.value as JsonRecord | undefined;
      const letter = typeof settings?.letter === 'string' ? settings.letter : undefined;
      if (notes || letter) state.push({ key: 'gift-content', version: 1, updatedAt: createdAt, value: { version: 1, source: 'personal', notes: notes ?? [], ...(letter !== undefined ? { letter } : {}) } });
    }
  } else {
    state = list(source.state, 'rascunhos', 64).map((value, i) => {
      const record = fields(value, `rascunhos[${i}]`, ['key', 'version', 'value', 'updatedAt']); const key = text(record.key, `rascunhos[${i}].key`, 80, 1);
      enumValue(record.version, [1], `rascunhos[${i}].version`); const updatedAt = timestamp(record.updatedAt, `rascunhos[${i}].updatedAt`, now);
      return { key, version: 1, updatedAt, value: validateStateValue(key, record.value, context) };
    });
  }
  unique(state.map(record => record.key), 'chaves dos rascunhos');
  const creations = list(source.creations, 'criações', 10_000).map((item, i) => creation(item, i, now)); unique(creations.map(item => item.id), 'identificadores das criações');
  const backup: BackupV2 = { format: 'atoa-leticia', version: 2, createdAt, state, creations }; assertFileSize(JSON.stringify(backup)); return backup;
}

/** Parses and validates the entire file before any storage operation is imported. */
export function parseBackup(text: string, now = Date.now()): BackupV2 {
  if (typeof text !== 'string') invalid('arquivo'); assertFileSize(text);
  let input: unknown;
  try { input = JSON.parse(text); } catch { throw new BackupValidationError('Não consegui ler esta cópia. Escolha um arquivo JSON exportado pelo À toa.'); }
  return normalizeBackup(input, now);
}

export async function makeBackup(creations: readonly Creation[]): Promise<BackupV2> {
  const storage = await import('./storage'); await storage.flushStorage();
  return normalizeBackup({ format: 'atoa-leticia', version: 2, createdAt: Date.now(), state: storage.getStateRecords(), creations });
}

/** Imports with upserts in one transaction, preserving every unrelated local record. */
export async function restoreBackup(text: string): Promise<BackupV2> {
  const backup = parseBackup(text);
  const storage = await import('./storage'); await storage.flushStorage();
  const { openDatabase } = await import('./database'); const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['creations', 'state'], 'readwrite');
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error ?? new Error('Não consegui restaurar esta cópia.')); tx.onabort = () => reject(tx.error ?? new Error('A restauração foi cancelada.'));
    try {
      const creations = tx.objectStore('creations'); const state = tx.objectStore('state');
      backup.creations.forEach(item => creations.put(item)); backup.state.forEach(record => state.put(record));
    } catch (error) { try { tx.abort(); } catch { /* The transaction may already be aborted. */ } reject(error); }
  });
  storage.updateCache(backup.state); return backup;
}
