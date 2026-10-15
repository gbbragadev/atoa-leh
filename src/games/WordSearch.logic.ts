import { seededRandom } from '../lib/art.ts';

export const WORD_SEARCH_THEMES = [
  { id: 'garden', label: 'Gatos & jardim', words: ['Gatinho', 'Bigodes', 'Ronrom', 'Folhinha', 'Jardim', 'Brotinho', 'Vasinho', 'Girassol', 'Semente', 'Carinho', 'Tulipa', 'Jasmim'] },
  { id: 'plants', label: 'Plantas', words: ['Monstera', 'Samambaia', 'Jiboia', 'Orquídea', 'Violeta', 'Lavanda', 'Hortelã', 'Alecrim', 'Cacto', 'Raízes', 'Folhas', 'Semente'] },
  { id: 'kitchen', label: 'Cozinha', words: ['Biscoito', 'Caneca', 'Panela', 'Bolinho', 'Receita', 'Cacau', 'Colher', 'Amora', 'Pipoca', 'Baunilha', 'Canela', 'Geleia'] },
  { id: 'craft', label: 'Artesanato', words: ['Crochê', 'Novelo', 'Argila', 'Pincel', 'Bordado', 'Cerâmica', 'Ateliê', 'Linha', 'Tinta', 'Agulha', 'Textura', 'Retalho'] },
  { id: 'cozy', label: 'Fora do plantão', words: ['Aconchego', 'Cafuné', 'Soneca', 'Cobertor', 'Abraço', 'Caneca', 'Risada', 'Biscoito', 'Almofada', 'Chamego', 'Pijama', 'Descanso'] },
] as const;
export type SearchTheme = typeof WORD_SEARCH_THEMES[number]['id'];
export type SearchDifficulty = 'easy' | 'normal';
export type SearchState = { seed: number; theme: SearchTheme; difficulty: SearchDifficulty; found: string[]; hint: number | null };
export type Placement = { label: string; word: string; cells: number[] };
export type SearchBoard = { letters: string[]; placements: Placement[]; size: number; difficulty: SearchDifficulty; theme: SearchTheme };
export const normalizeWord = (word: string) => word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

function shuffled<T>(items: readonly T[], random: () => number) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}

export function createWordSearch(seed: number, theme: SearchTheme, difficulty: SearchDifficulty = 'normal'): SearchBoard {
  const random = seededRandom(seed);
  const size = difficulty === 'easy' ? 8 : 10;
  const count = difficulty === 'easy' ? 6 : 7;
  const themeWords = WORD_SEARCH_THEMES.find(t => t.id === theme);
  if (!themeWords) throw new RangeError('Tema de palavras desconhecido.');
  const selected = shuffled(themeWords.words.filter(word => normalizeWord(word).length <= size), random).slice(0, count)
    .map(label => ({ label, word: normalizeWord(label) })).sort((a, b) => b.word.length - a.word.length);
  const directions = difficulty === 'easy' ? [[1, 0], [0, 1]] : [[1, 0], [0, 1], [1, 1], [-1, 0], [0, -1], [-1, -1], [1, -1], [-1, 1]];
  let letters: string[] = [];
  let placements: Placement[] = [];
  for (let restart = 0; restart < 35; restart++) {
    letters = Array(size * size).fill(''); placements = [];
    for (const item of selected) {
      let placed = false;
      const candidates = shuffled(Array.from({ length: size * size }, (_, i) => i), random);
      for (const first of candidates) {
        for (const [dx, dy] of shuffled(directions, random)) {
          const x = first % size, y = Math.floor(first / size);
          const endX = x + dx * (item.word.length - 1), endY = y + dy * (item.word.length - 1);
          if (endX < 0 || endX >= size || endY < 0 || endY >= size) continue;
          const cells = Array.from({ length: item.word.length }, (_, n) => (y + dy * n) * size + x + dx * n);
          if (cells.some((cell, n) => letters[cell] && letters[cell] !== item.word[n])) continue;
          cells.forEach((cell, n) => { letters[cell] = item.word[n]; });
          placements.push({ ...item, cells }); placed = true; break;
        }
        if (placed) break;
      }
      if (!placed) break;
    }
    if (placements.length === selected.length) break;
  }
  // One word per row guarantees a complete board even for an unlucky random seed.
  if (placements.length !== selected.length) {
    letters = Array(size * size).fill('');
    placements = selected.map((item, row) => {
      const reverse = difficulty === 'normal' && random() > .5;
      const offset = Math.floor(random() * (size - item.word.length + 1));
      const cells = Array.from({ length: item.word.length }, (_, n) => row * size + offset + (reverse ? item.word.length - 1 - n : n));
      cells.forEach((cell, n) => { letters[cell] = item.word[n]; });
      return { ...item, cells };
    });
  }
  letters = letters.map(letter => letter || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(random() * 26)]);
  return { letters, placements, size, difficulty, theme };
}

export function lineBetween(a: number, b: number, size: number): number[] {
  if (!Number.isInteger(size) || size < 1 || ![a, b].every(cell => Number.isInteger(cell) && cell >= 0 && cell < size * size)) return [];
  const ax = a % size, ay = Math.floor(a / size), bx = b % size, by = Math.floor(b / size);
  const x = bx - ax, y = by - ay;
  if (x !== 0 && y !== 0 && Math.abs(x) !== Math.abs(y)) return [];
  return Array.from({ length: Math.max(Math.abs(x), Math.abs(y)) + 1 }, (_, i) => (ay + Math.sign(y) * i) * size + ax + Math.sign(x) * i);
}

export function matchWordSelection(board: SearchBoard, a: number, b: number): Placement | undefined {
  const cells = lineBetween(a, b, board.size);
  if (!cells.length || (board.difficulty === 'easy' && a % board.size !== b % board.size && Math.floor(a / board.size) !== Math.floor(b / board.size))) return undefined;
  const word = cells.map(cell => board.letters[cell]).join('');
  const reversed = word.split('').reverse().join('');
  return board.placements.find(p => p.word === word || p.word === reversed);
}

export function migrateSearchState(value: unknown, fallbackSeed = 1): SearchState {
  const record = value && typeof value === 'object' ? value as Partial<SearchState> : {};
  const theme = WORD_SEARCH_THEMES.some(t => t.id === record.theme) ? record.theme! : 'garden';
  // Older saved rounds used a 10x10 grid. Preserve their grid and progress.
  const difficulty = record.difficulty === 'easy' ? 'easy' : 'normal';
  const seed = typeof record.seed === 'number' && Number.isInteger(record.seed) && record.seed >= 0 ? record.seed : fallbackSeed;
  const board = createWordSearch(seed, theme, difficulty);
  const validWords = new Set(board.placements.map(word => word.word));
  const found = Array.isArray(record.found) ? [...new Set(record.found.filter(word => typeof word === 'string' && validWords.has(word)))] : [];
  const hint = typeof record.hint === 'number' && board.placements.some(word => !found.includes(word.word) && word.cells[0] === record.hint) ? record.hint : null;
  return { seed, theme, difficulty, found, hint };
}
