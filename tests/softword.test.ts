import test from 'node:test';
import assert from 'node:assert/strict';
import { SOFT_WORD_DICTIONARY, getSoftWord, evaluateGuess } from '../src/games/SoftWord.logic.ts';
import { normalizeWord } from '../src/games/WordSearch.logic.ts';

test('green letters are consumed before evaluating duplicates', () => {
  assert.deepEqual(evaluateGuess('ARARA', 'AMORA'), ['correct', 'absent', 'absent', 'correct', 'correct']);
  assert.deepEqual(evaluateGuess('CASAS', 'CASOS'), ['correct', 'correct', 'correct', 'absent', 'correct']);
  assert.deepEqual(evaluateGuess('AABBA', 'AACCC'), ['correct', 'correct', 'absent', 'absent', 'absent']);
});

test('yellow letters never exceed the remaining count in the answer', () => {
  assert.deepEqual(evaluateGuess('ARARA', 'RARAS'), ['present', 'present', 'present', 'present', 'absent']);
  assert.deepEqual(evaluateGuess('BANAL', 'ABANO'), ['present', 'present', 'present', 'present', 'absent']);
  assert.deepEqual(evaluateGuess('SEARA', 'ARARA'), ['absent', 'absent', 'correct', 'correct', 'correct']);
});

test('a fully correct answer and a word with absent letters are distinct', () => {
  assert.deepEqual(evaluateGuess('CALMA', 'CALMA'), Array(5).fill('correct'));
  assert.deepEqual(evaluateGuess('VIDRO', 'CALMA'), Array(5).fill('absent'));
});

test('every seeded answer belongs to the offline Portuguese vocabulary', () => {
  const dictionary = new Set(SOFT_WORD_DICTIONARY);
  assert.ok(dictionary.size > 500);
  assert.ok(SOFT_WORD_DICTIONARY.every(word => /^[A-Z]{5}$/.test(word)));
  for (const word of ['calma', 'gatos', 'amora', 'barro', 'limão', 'órgão', 'cafés']) assert.ok(dictionary.has(normalizeWord(word)), word);
  assert.equal(dictionary.has('XXXXX'), false);
  assert.equal(dictionary.has('QUEIJ'), false);
  for (let seed = 0; seed < 5000; seed++) {
    const answer = getSoftWord(seed);
    assert.ok(dictionary.has(answer));
    assert.equal(getSoftWord(seed), answer);
  }
});
