import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import type { GameProps } from '../lib/types';
import { usePersistentState } from '../lib/storage';
import { randomSeed, svgToDataUrl } from '../lib/art';
import { WORD_SEARCH_THEMES, createWordSearch, lineBetween, matchWordSelection, migrateSearchState, type SearchState, type SearchTheme, type SearchDifficulty } from './WordSearch.logic';
export { WORD_SEARCH_THEMES, createWordSearch, normalizeWord, lineBetween, matchWordSelection } from './WordSearch.logic';
import './word-games.css';

export default function WordSearch({ onSave }: GameProps) {
  const [storedState, setState] = usePersistentState<SearchState>('wordsearch-v1', () => ({ seed: randomSeed(), theme: 'garden', difficulty: 'easy', found: [], hint: null }));
  const state = useMemo(() => migrateSearchState(storedState), [storedState]);
  const board = useMemo(() => createWordSearch(state.seed, state.theme, state.difficulty), [state.seed, state.theme, state.difficulty]);
  const { letters, placements, size } = board;
  const [start, setStart] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState(0);
  const [notice, setNotice] = useState(state.hint === null ? 'Aqui as palavras se escondem. Você só procura se der vontade.' : 'Sua dica ainda está iluminada. Pode continuar de onde parou.');
  const [saving, setSaving] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ base: number; down: number; previous: boolean; pointerId: number; x: number; y: number; last: number; moved: boolean } | null>(null);
  const foundCells = new Set(placements.filter(p => state.found.includes(p.word)).flatMap(p => p.cells));
  const selection = new Set(start === null || hover === null ? [] : lineBetween(start, hover, size));
  const complete = placements.every(p => state.found.includes(p.word));

  function fresh(theme: SearchTheme = state.theme, difficulty: SearchDifficulty = state.difficulty) {
    setState({ seed: randomSeed(), theme, difficulty, found: [], hint: null }); setStart(null); setHover(null); setFocus(0);
    drag.current = null; setNotice('Outro jardim de palavras. Ele pode esperar por você.');
  }
  function choose(a: number, b: number) {
    const cells = lineBetween(a, b, size);
    const match = matchWordSelection(board, a, b);
    if (match) {
      if (state.found.includes(match.word)) setNotice(`${match.label} já ganhou um cantinho ao sol.`);
      else {
        setState(s => { const current = migrateSearchState(s); return { ...current, found: [...new Set([...current.found, match.word])], hint: null }; });
        setNotice(state.found.length + 1 === placements.length ? 'Todas apareceram! O gato fiscal de palavras aprovou a soneca.' : `${match.label} apareceu. Os bigodes do detetive agradecem.`);
      }
    } else setNotice(cells.length ? 'Essa combinação está só passeando. Tente outra quando quiser.' : state.difficulty === 'easy' ? 'Escolha uma linha reta, para o lado ou para cima.' : 'Escolha uma linha reta: para o lado, para cima ou na diagonal.');
    setStart(null); setHover(null);
  }
  function tap(cell: number) {
    if (start === null) { setStart(cell); setHover(cell); setNotice('Agora escolha a última letra. Escape cancela a seleção.'); }
    else if (start === cell) { setStart(null); setHover(null); }
    else choose(start, cell);
  }
  function cellAt(x: number, y: number) {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-word-cell]');
    return element && boardRef.current?.contains(element) ? Number(element.dataset.wordCell) : null;
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || drag.current) return;
    const cell = cellAt(event.clientX, event.clientY);
    if (cell === null) return;
    event.preventDefault();
    drag.current = { base: start ?? cell, down: cell, previous: start !== null, pointerId: event.pointerId, x: event.clientX, y: event.clientY, last: cell, moved: false };
    setStart(start ?? cell); setHover(cell); setFocus(cell);
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > 5) current.moved = true;
    const cell = cellAt(event.clientX, event.clientY);
    if (cell !== null) { current.last = cell; setHover(cell); }
  }
  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const current = drag.current;
    const moved = current.moved || Math.hypot(event.clientX - current.x, event.clientY - current.y) > 5;
    // A stationary finger keeps the pressed cell even if browser scroll anchoring moves the page.
    // A drag retains its last valid cell when the finger leaves the edge before release.
    const end = moved ? cellAt(event.clientX, event.clientY) ?? current.last : current.down;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (end !== current.down || current.previous) {
      if (current.base === end) { setStart(null); setHover(null); }
      else choose(current.base, end);
    } else setNotice('Primeira letra escolhida. Toque na última ou arraste entre elas.');
  }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, cell: number) {
    const offset: Record<string, number> = { ArrowLeft: cell % size === 0 ? 0 : -1, ArrowRight: cell % size === size - 1 ? 0 : 1, ArrowUp: -size, ArrowDown: size };
    if (event.key in offset) {
      event.preventDefault(); const next = Math.max(0, Math.min(size * size - 1, cell + offset[event.key]));
      setFocus(next); if (start !== null) setHover(next);
      boardRef.current?.querySelector<HTMLButtonElement>(`[data-word-cell="${next}"]`)?.focus();
    } else if (event.key === 'Escape') { setStart(null); setHover(null); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); tap(cell); }
  }
  function giveHint() {
    const next = placements.find(p => !state.found.includes(p.word));
    if (!next) return;
    setState(s => ({ ...migrateSearchState(s), hint: next.cells[0] }));
    setNotice(`Um pequeno empurrão: ${next.label} começa na letra iluminada.${state.difficulty === 'easy' ? ' Siga para a direita ou para baixo.' : ' Pode seguir em qualquer direção.'}`);
  }
  async function save() {
    if (!artRef.current) return;
    setSaving(true);
    try { await onSave({ kind: 'Palavras ao sol', title: 'Um jardim de palavras', dataUrl: await svgToDataUrl(artRef.current) }); setNotice('Seu jardim de palavras ficou guardado nas lembranças.'); }
    catch { setNotice('A lembrança não foi guardada. Pode tentar de novo.'); }
    finally { setSaving(false); }
  }

  return <section className="words-game words-search">
    <div className="game-toolbar">
      <div className="segmented words-theme-picker" aria-label="Tema das palavras">{WORD_SEARCH_THEMES.map(theme => <button key={theme.id} className={state.theme === theme.id ? 'active' : ''} aria-pressed={state.theme === theme.id} onClick={() => { if (state.theme !== theme.id) fresh(theme.id); }}>{theme.label}</button>)}</div>
      <button className="soft-button" onClick={() => fresh()}>Outro jardim</button>
    </div>
    <div className="words-difficulty-toolbar"><span className="control-label">Seu tamanho de jardim</span><div className="segmented" aria-label="Dificuldade do caça-palavras"><button aria-pressed={state.difficulty === 'easy'} className={state.difficulty === 'easy' ? 'active' : ''} onClick={() => { if (state.difficulty !== 'easy') fresh(state.theme, 'easy'); }}>Pequenininho · 8 × 8</button><button aria-pressed={state.difficulty === 'normal'} className={state.difficulty === 'normal' ? 'active' : ''} onClick={() => { if (state.difficulty !== 'normal') fresh(state.theme, 'normal'); }}>Mais caminhos · 10 × 10</button></div></div>
    <p className="game-note">Arraste entre a primeira e a última letra, ou toque nas duas. {state.difficulty === 'easy' ? 'Neste jardim, elas seguem para a direita ou para baixo.' : 'As palavras podem estar na diagonal e ao contrário.'}</p>
    <div className="words-search-layout">
      <div ref={boardRef} className="words-search-board game-canvas" role="grid" style={{ '--words-grid-size': size } as CSSProperties} aria-label={`Jardim de palavras, ${size} linhas e ${size} colunas`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={event => { if (drag.current?.pointerId === event.pointerId) { drag.current = null; setStart(null); setHover(null); } }}>
        {Array.from({ length: size }, (_, row) => <div className="words-search-row" role="row" key={row}>{letters.slice(row * size, row * size + size).map((letter, column) => {
          const cell = row * size + column;
          return <button role="gridcell" key={cell} data-word-cell={cell} tabIndex={focus === cell ? 0 : -1} className={`words-search-letter${foundCells.has(cell) ? ' is-found' : ''}${selection.has(cell) ? ' is-selected' : ''}${state.hint === cell ? ' is-hint' : ''}`} aria-label={`${letter}, linha ${row + 1}, coluna ${column + 1}${foundCells.has(cell) ? ', encontrada' : ''}${state.hint === cell ? ', dica' : ''}`} aria-selected={selection.has(cell)} onFocus={() => setFocus(cell)} onKeyDown={event => keyboard(event, cell)} onClick={event => { if (event.detail === 0) tap(cell); }}>{letter}</button>;
        })}</div>)}
      </div>
      <div className="words-search-side">
        <p className="words-eyebrow">Escondidas por aqui</p>
        <ul className="words-find-list">{placements.map(p => <li key={p.word} className={state.found.includes(p.word) ? 'is-found' : ''}><span className="words-find-mark" aria-hidden="true">{state.found.includes(p.word) ? '✓' : '○'}</span>{p.label}</li>)}</ul>
        <span className="words-progress">{state.found.length} de {placements.length} apareceram</span>
        <button className="soft-button" onClick={giveHint} disabled={complete}>Uma dica, por favor</button>
        <div className="words-selection-slot"><button className={`soft-button${start === null ? ' words-selection-hidden' : ''}`} disabled={start === null} aria-hidden={start === null} onClick={() => { setStart(null); setHover(null); }}>Soltar seleção</button></div>
        {complete && <button className="primary-button" disabled={saving} onClick={save}>{saving ? 'Guardando…' : 'Guardar lembrança'}</button>}
      </div>
    </div>
    <p className="words-notice" role="status" aria-live="polite">{notice}</p>
    <svg ref={artRef} className="words-save-art" aria-hidden="true" viewBox="0 0 600 660">
      <rect width="600" height="660" rx="30" fill="#faf6ec"/><text x="300" y="48" textAnchor="middle" fontSize="28" fill="#52634e" fontFamily="Georgia">Palavras ao sol</text>
      {letters.map((letter, cell) => { const step = 480 / size; return <g key={cell}><rect x={60 + cell % size * step} y={80 + Math.floor(cell / size) * step} width={step - 6} height={step - 6} rx="12" fill={foundCells.has(cell) ? '#d8e4c9' : '#eee9db'}/><text x={60 + cell % size * step + (step - 6) / 2} y={80 + Math.floor(cell / size) * step + step * .59} textAnchor="middle" fontFamily="sans-serif" fontSize={step * .42} fill="#52634e">{letter}</text></g>; })}
      <text x="300" y="596" textAnchor="middle" fontFamily="Georgia" fontSize="18" fill="#52634e">Um pequeno jardim da Leh.</text><text x="300" y="625" textAnchor="middle" fontFamily="sans-serif" fontSize="13" fill="#808779">Feito sem pressa, com carinho.</text>
    </svg>
  </section>;
}
