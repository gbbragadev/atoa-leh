import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from '../lib/types';
import { usePersistentState } from '../lib/storage';
import { randomSeed, svgToDataUrl } from '../lib/art';
import { normalizeWord } from './WordSearch.logic';
import { SOFT_WORD_DICTIONARY, getSoftWord, evaluateGuess, type LetterState, type WordState } from './SoftWord.logic';
export { SOFT_WORD_DICTIONARY, getSoftWord, evaluateGuess } from './SoftWord.logic';
import './word-games.css';

const validWords = new Set(SOFT_WORD_DICTIONARY);

export default function SoftWord({ onSave }: GameProps) {
  const [state, setState] = usePersistentState<WordState>('softword-v1', () => ({ seed: randomSeed(), guesses: [], hints: 0, outcome: 'playing' }));
  const [draft, setDraft] = usePersistentState<string>('softword-draft-v1', '');
  const [notice, setNotice] = useState('Até o teclado pode ir com calma.');
  const [saving, setSaving] = useState(false);
  const answer = useMemo(() => getSoftWord(state.seed), [state.seed]);
  const latestRef = useRef({ draft, state, answer });
  latestRef.current = { draft, state, answer };
  const rowsRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<SVGSVGElement>(null);
  const physicalTyping = useRef(false);
  const keyboardStates: Record<string, LetterState> = {};
  const priority = { absent: 1, present: 2, correct: 3 };
  for (const guess of state.guesses) evaluateGuess(guess, answer).forEach((status, i) => {
    if (!keyboardStates[guess[i]] || priority[status] > priority[keyboardStates[guess[i]]]) keyboardStates[guess[i]] = status;
  });
  function addLetter(letter: string) {
    if (latestRef.current.state.outcome !== 'playing') return;
    setDraft(current => current.length < 5 ? current + normalizeWord(letter) : current);
  }
  function submit() {
    const current = latestRef.current;
    if (current.state.outcome !== 'playing') return;
    if (current.draft.length !== 5) { setNotice('Faltam letrinhas: escolha uma palavra de 5 letras.'); return; }
    if (!validWords.has(current.draft)) { setNotice('Essa palavra ainda não está no nosso vocabulário. Experimente outra; nenhuma tentativa foi usada.'); return; }
    const solved = current.draft === current.answer;
    setState(s => ({ ...s, guesses: [...s.guesses, current.draft], outcome: solved ? 'solved' : 'playing' }));
    physicalTyping.current = false;
    setDraft(''); setNotice(solved ? 'Ela apareceu! O gato do dicionário fez um ronrom de aprovação.' : 'Mais uma pista. A palavra espera aqui, sem pressa nenhuma.');
  }
  useEffect(() => {
    const handle = (event: globalThis.KeyboardEvent) => {
      const element = event.target as HTMLElement | null;
      if (element?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      // Typing a word physically makes Enter submit, even after a mouse/touch button kept focus.
      // With no physical typing, Enter retains the button's normal accessible activation.
      if (event.key === 'Enter' && element?.closest('button') && !physicalTyping.current) return;
      if (event.key === 'Enter') { event.preventDefault(); submit(); }
      else if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); setDraft(current => current.slice(0, -1)); }
      else if (/^[a-zà-ÿ]$/i.test(event.key)) { event.preventDefault(); physicalTyping.current = true; addLetter(event.key); }
    };
    window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle);
  }, []);
  useEffect(() => { const rows = rowsRef.current; if (rows) rows.scrollTop = rows.scrollHeight; }, [state.guesses.length]);
  function fresh() {
    let seed = randomSeed();
    for (let i = 0; i < 10 && getSoftWord(seed) === answer; i++) seed = randomSeed();
    physicalTyping.current = false;
    setState({ seed, guesses: [], hints: 0, outcome: 'playing' }); setDraft(''); setNotice('Uma palavra nova pousou aqui. Pode chegar devagar.');
  }
  async function save() {
    if (!artRef.current) return; setSaving(true);
    try { await onSave({ kind: 'Palavra mansa', title: `Palavra do seu cantinho: ${answer.toLowerCase()}`, dataUrl: await svgToDataUrl(artRef.current) }); setNotice('Sua palavra ficou guardada nas lembranças.'); }
    catch { setNotice('Não consegui guardar agora. Pode tentar outra vez.'); }
    finally { setSaving(false); }
  }
  const labels = { correct: 'no lugar certo', present: 'em outro lugar', absent: 'fora desta palavra' };
  return <section className="words-game words-softword">
    <div className="game-toolbar"><p className="game-note">Uma palavra de cinco letras. Quantas tentativas você quiser.</p><button className="soft-button" onClick={fresh}>Outra palavra</button></div>
    <div className="words-legend"><span><i className="correct"/>Letra no lugar</span><span><i className="present"/>Letra passeando</span><span><i className="absent"/>Fora da palavra</span></div>
    <div className="words-softword-table game-canvas" ref={rowsRef} aria-label="Suas palavras">
      {state.guesses.map((guess, n) => <div className="words-guess" key={n} aria-label={`${guess}: ${evaluateGuess(guess, answer).map((status, i) => `${guess[i]} ${labels[status]}`).join(', ')}`}>{guess.split('').map((letter, i) => <span key={i} className={`words-tile ${evaluateGuess(guess, answer)[i]}`} aria-hidden="true">{letter}<small>{evaluateGuess(guess, answer)[i] === 'correct' ? '✓' : evaluateGuess(guess, answer)[i] === 'present' ? '·' : '–'}</small></span>)}</div>)}
      {state.outcome === 'playing' && <div className="words-guess words-draft" aria-label={`Palavra atual: ${draft || 'vazia'}`}>{Array.from({ length: 5 }, (_, i) => <span className={`words-tile${draft[i] ? ' has-letter' : ''}`} key={i}>{draft[i] ?? ''}</span>)}</div>}
      {state.outcome !== 'playing' && <div className="words-word-finish"><p>{state.outcome === 'solved' ? 'Você encontrou' : 'A palavra era'}</p><strong>{answer}</strong><span>{state.outcome === 'solved' ? 'Sua única tarefa agora é escolher se quer mais.' : 'Às vezes a melhor pista é matar a curiosidade.'}</span></div>}
    </div>
    {state.hints > 0 && <p className="words-hint">Um cantinho da palavra: <strong>{answer.slice(0, state.hints)}{'·'.repeat(5 - state.hints)}</strong></p>}
    <p className="words-notice" role="status" aria-live="polite">{notice}</p>
    <div className="words-keyboard" aria-label="Teclado da palavra">{['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'].map((row, n) => <div className="words-keyboard-row" key={row}>{n === 2 && <button className="words-key words-key-wide" onClick={submit} disabled={state.outcome !== 'playing'} aria-label="Enviar palavra">Enviar</button>}{row.split('').map(letter => <button className={`words-key ${keyboardStates[letter] ?? ''}`} key={letter} aria-label={`${letter}${keyboardStates[letter] ? `, ${labels[keyboardStates[letter]]}` : ''}`} disabled={state.outcome !== 'playing'} onClick={() => addLetter(letter)}>{letter}</button>)}{n === 2 && <button className="words-key words-key-wide" aria-label="Apagar última letra" onClick={() => setDraft(current => current.slice(0, -1))} disabled={state.outcome !== 'playing'}>Apagar</button>}</div>)}</div>
    <div className="words-bottom-actions">{state.outcome === 'playing' ? <><button className="soft-button" onClick={() => { setState(s => ({ ...s, hints: Math.min(5, s.hints + 1) })); setNotice('Uma letrinha abriu a janela. Dica também é carinho.'); }} disabled={state.hints >= 5}>Uma letrinha de dica</button><button className="words-text-button" onClick={() => { setState(s => ({ ...s, outcome: 'revealed' })); setDraft(''); setNotice('Curiosidade satisfeita. Nenhum gato te julgou.'); }}>Matar a curiosidade</button></> : <><button className="primary-button" onClick={fresh}>Mais uma, sem pressa</button><button className="soft-button" disabled={saving} onClick={save}>{saving ? 'Guardando…' : 'Guardar lembrança'}</button></>}</div>
    <p className="words-footnote">Acentos não mudam a resposta. O vocabulário mora no app e funciona sem internet.</p>
    <svg ref={artRef} className="words-save-art" aria-hidden="true" viewBox="0 0 600 600"><rect width="600" height="600" rx="32" fill="#faf6ec"/><path d="M100 395 Q140 285 200 340 Q230 375 260 310 Q310 240 350 320 Q400 400 500 340" stroke="#a8b590" strokeWidth="4" fill="none"/><text x="300" y="160" textAnchor="middle" fill="#657454" fontFamily="Georgia" fontSize="28">Uma palavra mansa</text>{answer.split('').map((letter, i) => <g key={i}><rect x={92 + i * 85} y="220" width="76" height="87" rx="16" fill="#dbe5cb"/><text x={130 + i * 85} y="278" textAnchor="middle" fill="#405739" fontSize="40" fontFamily="sans-serif">{letter}</text></g>)}<text x="300" y="465" textAnchor="middle" fill="#657454" fontFamily="Georgia" fontSize="19">No ritmo de Letícia.</text><text x="300" y="500" textAnchor="middle" fill="#8c8f7d" fontFamily="sans-serif" fontSize="15">Um pouquinho de nada, com carinho.</text></svg>
  </section>;
}
