import test from 'node:test';
import assert from 'node:assert/strict';
import { WORD_SEARCH_THEMES, createWordSearch, lineBetween, matchWordSelection, migrateSearchState, normalizeWord, type SearchDifficulty } from '../src/games/WordSearch.logic.ts';

for (const difficulty of ['easy', 'normal'] as const) {
  test(`${difficulty}: 2,500 seeded boards contain every listed word, with valid forward and reverse selections`, () => {
    const seenDirections = new Set<string>();
    for (const theme of WORD_SEARCH_THEMES) {
      for (let seed = 0; seed < 500; seed++) {
        const board = createWordSearch(seed, theme.id, difficulty);
        assert.equal(board.size, difficulty === 'easy' ? 8 : 10);
        assert.equal(board.letters.length, board.size ** 2);
        assert.equal(board.placements.length, difficulty === 'easy' ? 6 : 7);
        assert.equal(new Set(board.placements.map(word => word.word)).size, board.placements.length);
        assert.ok(board.letters.every(letter => /^[A-Z]$/.test(letter)));
        for (const placement of board.placements) {
          assert.equal(placement.word, normalizeWord(placement.label));
          assert.equal(placement.cells.length, placement.word.length);
          assert.ok(placement.cells.every(cell => cell >= 0 && cell < board.letters.length));
          assert.equal(placement.cells.map(cell => board.letters[cell]).join(''), placement.word, `${seed}/${theme.id}: ${placement.word} is really in its listed cells`);
          const first = placement.cells[0], last = placement.cells.at(-1)!;
          assert.deepEqual(lineBetween(first, last, board.size), placement.cells);
          assert.equal(matchWordSelection(board, first, last)?.word, placement.word);
          assert.equal(matchWordSelection(board, last, first)?.word, placement.word);
          const dx = Math.sign(last % board.size - first % board.size), dy = Math.sign(Math.floor(last / board.size) - Math.floor(first / board.size));
          seenDirections.add(`${dx},${dy}`);
          if (difficulty === 'easy') assert.ok((dx === 1 && dy === 0) || (dx === 0 && dy === 1), 'easy words only read right or down');
        }
      }
    }
    assert.equal(seenDirections.size, difficulty === 'easy' ? 2 : 8, 'the generator exercises all advertised directions');
  });
}

test('the same seed, theme and difficulty reconstruct exactly the same round', () => {
  for (const difficulty of ['easy', 'normal'] as SearchDifficulty[]) for (const theme of WORD_SEARCH_THEMES) {
    for (const seed of [0, 1, 43, 123456, 2147483646, 4294967295]) {
      assert.deepEqual(createWordSearch(seed, theme.id, difficulty), createWordSearch(seed, theme.id, difficulty));
    }
  }
});

test('selection rejects curves, row wrapping, off-grid indices and diagonals in easy mode', () => {
  assert.deepEqual(lineBetween(0, 12, 10), []);
  assert.deepEqual(lineBetween(9, 10, 10), []);
  assert.deepEqual(lineBetween(-1, 7, 8), []);
  assert.deepEqual(lineBetween(0, 64, 8), []);
  assert.deepEqual(lineBetween(0, 1.5, 8), []);
  assert.deepEqual(lineBetween(0, 0, 0), []);
  assert.deepEqual(lineBetween(0, 22, 10), [0, 11, 22]);
  assert.deepEqual(lineBetween(22, 0, 10), [22, 11, 0]);
  const board = createWordSearch(77, 'garden', 'easy');
  board.letters[0] = 'G'; board.letters[9] = 'A'; board.letters[18] = 'T'; board.letters[27] = 'O';
  board.placements = [{ word: 'GATO', label: 'Gato', cells: [0, 9, 18, 27] }];
  assert.equal(matchWordSelection(board, 0, 27), undefined);
  assert.equal(matchWordSelection(board, -1, 2), undefined);
});

test('saved seed, difficulty, found words and a hint survive a round trip', () => {
  for (const difficulty of ['easy', 'normal'] as const) {
    const board = createWordSearch(438, 'plants', difficulty);
    const value = { seed: 438, theme: 'plants', difficulty, found: [board.placements[0].word], hint: board.placements[1].cells[0] };
    const migrated = migrateSearchState(JSON.parse(JSON.stringify(value)));
    assert.deepEqual(migrated, value);
    assert.deepEqual(createWordSearch(migrated.seed, migrated.theme, migrated.difficulty), board);
    assert.equal(migrateSearchState({ ...value, hint: board.placements[0].cells[0] }).hint, null, 'a found word no longer needs a hint');
  }
});

test('legacy 10x10 rounds keep their seed and progress; stale/corrupt data is cleaned', () => {
  const board = createWordSearch(57, 'garden');
  const migrated = migrateSearchState({ seed: 57, theme: 'garden', found: [board.placements[0].word, board.placements[0].word, 'INVALID', null] });
  assert.equal(migrated.difficulty, 'normal');
  assert.equal(migrated.seed, 57);
  assert.deepEqual(migrated.found, [board.placements[0].word]);
  assert.equal(migrated.hint, null);
  assert.deepEqual(createWordSearch(migrated.seed, migrated.theme, migrated.difficulty), board);
  const invalid = migrateSearchState({ seed: NaN, theme: 'unknown', found: 'no', hint: 123456 }, 91);
  assert.deepEqual(invalid, { seed: 91, theme: 'garden', difficulty: 'normal', found: [], hint: null });
});

test('all promised themes and accented words are available locally', () => {
  assert.ok(WORD_SEARCH_THEMES.some(theme => /Gatos/.test(theme.label)));
  assert.ok(WORD_SEARCH_THEMES.some(theme => theme.label === 'Plantas'));
  assert.ok(WORD_SEARCH_THEMES.some(theme => theme.label === 'Cozinha'));
  assert.ok(WORD_SEARCH_THEMES.some(theme => theme.label === 'Artesanato'));
  assert.equal(normalizeWord('Crochê'), 'CROCHE');
  assert.equal(normalizeWord('Cerâmica'), 'CERAMICA');
  assert.equal(normalizeWord('Orquídea'), 'ORQUIDEA');
});
