import { useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { PALETTE, randomSeed, seededRandom, svgToDataUrl } from '../lib/art';
import type { GameProps } from '../lib/types';
import { usePersistentState } from '../lib/storage';
import { Palette } from '../components/Palette';
import './art-games.css';

type Pattern = 'hearts' | 'cats' | 'flowers' | 'free';
type CrochetPiece = { seed: number; pattern: Pattern; stitches: Record<string, string> };
const NAMES: Record<Pattern, string> = { hearts: 'Corações de linha', cats: 'Gatinhos de crochê', flowers: 'Flores ponto a ponto', free: 'Uma invenção da Leh' };
const THREAD = '#ded9c7';
const GRID = 14;

function patternColors(seed: number, pattern: Pattern): string[][] {
  const random = seededRandom(seed);
  const guide = Array.from({ length: GRID }, () => Array<string>(GRID).fill(''));
  const color = PALETTE[3 + Math.floor(random() * 4)];
  const second = PALETTE[3 + Math.floor(random() * 4)];
  const put = (x: number, y: number, value: string) => { if (guide[y]?.[x] !== undefined) guide[y][x] = value; };
  if (pattern === 'hearts') {
    const heart = ['01100110', '11111111', '11111111', '01111110', '00111100', '00011000'];
    const offset = Math.floor(random() * 3), offsetX = 2 + Math.floor(random() * 3);
    heart.forEach((row, y) => row.split('').forEach((pixel, x) => { if (pixel === '1') put(x + offsetX, y + 3 + offset, color); }));
    for (let i = 0; i < GRID; i++) { if (i % 2 === 0) { put(i, 0, random() > .5 ? second : color); put(i, 13, random() > .5 ? second : color); } }
  } else if (pattern === 'cats') {
    const cat = ['11000011', '11100111', '11111111', '11111111', '10111101', '11100111', '01111110', '00111100', '00111100', '01111110'];
    cat.forEach((row, y) => row.split('').forEach((pixel, x) => { if (pixel === '1') put(x + 3, y + 2, color); }));
    put(4, 6, PALETTE[9]); put(9, 6, PALETTE[9]); put(6, 7, PALETTE[4]); put(7, 7, PALETTE[4]);
    for (let i = 0; i < 4; i++) put(11 + (i % 2), 8 + i, color);
    for (let y = 2; y < 12; y++) for (let x = 3; x < 11; x++) if (guide[y][x] === color && random() < .15) put(x, y, second);
  } else if (pattern === 'flowers') {
    const centers = random() > 0.5 ? [[4, 4], [9, 8]] : [[8, 4], [4, 9]];
    centers.forEach(([cx, cy], i) => {
      const petal = i ? second : color;
      [[0, -2], [0, -1], [2, 0], [1, 0], [0, 2], [0, 1], [-2, 0], [-1, 0]].forEach(([dx, dy]) => put(cx + dx, cy + dy, petal));
      put(cx, cy, PALETTE[2]);
      for (let y = cy + 3; y < 13; y++) put(cx, y, PALETTE[0]);
      put(cx - 1, cy + 4, PALETTE[1]); put(cx - 2, cy + 3, PALETTE[1]);
      put(cx + 1, cy + 5, PALETTE[1]);
    });
  }
  if (pattern !== 'free') {
    for (let i = 0; i < 4; i++) {
      const x = random() > .5 ? 1 : 12, y = 2 + Math.floor(random() * 10);
      if (!guide[y][x]) put(x, y, random() > .5 ? second : PALETTE[2]);
    }
  }
  return guide;
}

export default function Crochet({ onSave }: GameProps) {
  const [piece, setPiece] = usePersistentState<CrochetPiece>('crochet-piece', () => ({ seed: randomSeed(), pattern: 'hearts', stitches: {} }));
  const [color, setColor] = usePersistentState('crochet-color', PALETTE[4]);
  const [showGuide, setShowGuide] = usePersistentState('crochet-guide', true);
  const [erase, setErase] = useState(false);
  const [history, setHistory] = useState<CrochetPiece[]>([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const pieceRef = useRef(piece);
  const gestureBefore = useRef<CrochetPiece | null>(null);
  const drawingPointer = useRef<number | null>(null);
  const guide = useMemo(() => patternColors(piece.seed, piece.pattern), [piece.seed, piece.pattern]);
  const guideColors = Array.from(new Set(guide.flat().filter(Boolean)));

  const replace = (next: CrochetPiece) => { pieceRef.current = next; setPiece(next); };
  const remember = (before: CrochetPiece) => setHistory(previous => [...previous.slice(-49), before]);
  const change = (next: CrochetPiece) => { remember(pieceRef.current); replace(next); setMessage(''); };
  const paint = (id: string) => {
    const nextColor = erase ? THREAD : color;
    if (pieceRef.current.stitches[id] === nextColor) return;
    replace({ ...pieceRef.current, stitches: { ...pieceRef.current.stitches, [id]: nextColor } });
  };
  const findStitch = (event: ReactPointerEvent<SVGSVGElement>) => {
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-crochet-stitch]');
    return element && svgRef.current?.contains(element) ? element.getAttribute('data-crochet-stitch') : null;
  };
  const start = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || drawingPointer.current !== null) return;
    const id = findStitch(event); if (!id) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    drawingPointer.current = event.pointerId; gestureBefore.current = pieceRef.current; paint(id);
  };
  const move = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drawingPointer.current !== event.pointerId) return;
    const id = findStitch(event); if (id) paint(id);
  };
  const end = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drawingPointer.current !== event.pointerId) return;
    if (gestureBefore.current && gestureBefore.current !== pieceRef.current) remember(gestureBefore.current);
    gestureBefore.current = null; drawingPointer.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const undo = () => {
    if (!history.length) return;
    replace(history[history.length - 1]); setHistory(previous => previous.slice(0, -1)); setMessage('Desfeito. Até a linha merece uma segunda chance.');
  };
  const save = async () => {
    if (!svgRef.current) return;
    setSaving(true); setMessage('');
    try {
      // The reference is hidden in the export, so the saved piece contains only her stitches.
      const exportSvg = svgRef.current.cloneNode(true) as SVGSVGElement;
      exportSvg.querySelectorAll<SVGElement>('[data-reference="true"]').forEach(element => { element.setAttribute('fill', THREAD); element.setAttribute('opacity', '1'); });
      const dataUrl = await svgToDataUrl(exportSvg);
      await onSave({ kind: 'crochet', title: NAMES[piece.pattern], dataUrl });
      setMessage('Peça guardada na galeria. Zero fios para desembaraçar.');
    } catch { setMessage('Não consegui guardar agora. Seus pontinhos continuam salvos aqui.'); }
    finally { setSaving(false); }
  };

  return <div className="crochet-game">
    <div className="crochet-workspace">
      <div className="crochet-piece-area">
        <div className="crochet-pattern-picker">
          <label className="control-label" htmlFor="crochet-pattern">Um desenho para acompanhar</label>
          <select id="crochet-pattern" value={piece.pattern} onChange={event => change({ pattern: event.target.value as Pattern, seed: randomSeed(), stitches: {} })}>
            <option value="hearts">Corações</option><option value="cats">Gatinhos</option><option value="flowers">Flores</option><option value="free">Sem molde, só vontade</option>
          </select>
        </div>
        <div className="game-canvas crochet-cloth">
          <svg ref={svgRef} viewBox="0 0 600 600" className="crochet-svg" aria-label="Malha de crochê com 14 linhas e 14 colunas; toque ou arraste para pintar os pontos" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
            <rect width="600" height="600" fill="#f1eadc" />
            <rect x="64" y="62" width="472" height="482" rx="15" fill="#d5cfbc" opacity="0.28" />
            <rect x="64" y="56" width="472" height="482" rx="15" fill="#e6dfcd" />
            {Array.from({ length: 22 }, (_, i) => <path key={`edge-${i}`} d={`M ${79 + i * 21} 57 Q ${83 + i * 21} 67 ${79 + i * 21} 76 M ${79 + i * 21} 518 Q ${83 + i * 21} 530 ${79 + i * 21} 538`} fill="none" stroke="#c7bea7" strokeWidth="4" strokeLinecap="round" />)}
            {guide.map((row, y) => row.map((reference, x) => {
              const id = `${x}:${y}`; const painted = piece.stitches[id];
              const fill = painted ?? (showGuide && reference ? reference : THREAD);
              const isReference = !painted && !!reference && showGuide;
              const px = 76 + x * 32, py = 76 + y * 32;
              return <g key={id} data-crochet-stitch={id} role="button" tabIndex={0} aria-label={`Pintar ponto linha ${y + 1}, coluna ${x + 1}`} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); const before = pieceRef.current; paint(id); if (before !== pieceRef.current) remember(before); } }}>
                <rect x={px} y={py} width="32" height="32" fill="transparent" />
                <path d={`M ${px + 5} ${py + 3} C ${px - 3} ${py + 8} ${px + 6} ${py + 24} ${px + 16} ${py + 29} C ${px + 18} ${py + 15} ${px + 11} ${py + 1} ${px + 5} ${py + 3} Z`} fill={fill} opacity={isReference ? 0.36 : 1} data-reference={isReference ? 'true' : undefined} stroke="#b9b19b" strokeWidth="0.8" />
                <path d={`M ${px + 27} ${py + 3} C ${px + 35} ${py + 8} ${px + 26} ${py + 24} ${px + 16} ${py + 29} C ${px + 14} ${py + 15} ${px + 21} ${py + 1} ${px + 27} ${py + 3} Z`} fill={fill} opacity={isReference ? 0.36 : 1} data-reference={isReference ? 'true' : undefined} stroke="#b9b19b" strokeWidth="0.8" />
                <path d={`M ${px + 5} ${py + 7} Q ${px + 8} ${py + 19} ${px + 13} ${py + 24} M ${px + 27} ${py + 7} Q ${px + 24} ${py + 19} ${px + 19} ${py + 24}`} fill="none" stroke="#fff9e8" strokeWidth="1.25" opacity="0.55" pointerEvents="none" />
              </g>;
            }))}
            <path d="M 523 527 Q 575 515 565 554 Q 560 575 535 564" fill="none" stroke="#c6baa0" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </div>
        <p className="game-note crochet-under-cloth">Toque nos pontinhos ou passe o dedo. A linha não enrosca. O gato está inconformado.</p>
      </div>
      <aside className="crochet-tools">
        <span className="art-eyebrow">Sua cestinha de linhas</span>
        <h3>Um ponto. Outro. Sem contar.</h3>
        <Palette value={color} onChange={next => { setColor(next); setErase(false); }} />
        {piece.pattern !== 'free' && <>
          <label className="art-check"><input type="checkbox" checked={showGuide} onChange={event => setShowGuide(event.target.checked)} /> Mostrar molde suave</label>
          {showGuide && <div className="crochet-reference-colors"><span>Cores do molde</span><div>{guideColors.map(thread => <button type="button" key={thread} className="crochet-thread-dot" style={{ backgroundColor: thread }} aria-label={`Usar linha ${thread}`} aria-pressed={thread === color} onClick={() => { setColor(thread); setErase(false); }} />)}</div></div>}
        </>}
        <div className="game-toolbar crochet-tool-buttons">
          <button type="button" className={`soft-button ${erase ? 'art-tool-active' : ''}`} aria-pressed={erase} onClick={() => setErase(value => !value)}>{erase ? 'Apagar ligado' : 'Apagar ponto'}</button>
          <button type="button" className="soft-button" disabled={!history.length} onClick={undo}>Desfazer</button>
          <button type="button" className="soft-button" onClick={() => { change({ ...pieceRef.current, stitches: {} }); setMessage('Malha limpinha. A anterior está no Desfazer.'); }}>Limpar malha</button>
          <button type="button" className="soft-button" onClick={() => { change({ ...pieceRef.current, seed: randomSeed(), stitches: {} }); setMessage('Outro molde para brincar. O anterior está no Desfazer.'); }}>Outro molde</button>
        </div>
        <button type="button" className="primary-button art-save" disabled={saving} onClick={save}>{saving ? 'Guardando…' : 'Guardar na galeria'}</button>
        <p className="art-draft-note">Os pontos ficam salvos neste aparelho. O molde clarinho não aparece na peça guardada.</p>
        <p className="art-status" role="status" aria-live="polite">{message}</p>
      </aside>
    </div>
  </div>;
}
