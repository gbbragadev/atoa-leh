import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Palette } from '../components/Palette';
import { randomSeed, seededRandom, svgToDataUrl } from '../lib/art';
import { usePersistentState } from '../lib/storage';
import type { GameProps } from '../lib/types';
import './nature-games.css';

type Point = { x: number; y: number };
type Stroke = { id: string; points: Point[]; width: number };
type TreasureKind = 'shell' | 'stone' | 'star' | 'glass';
type Treasure = { id: string; kind: TreasureKind; x: number; y: number; color: string; angle: number; size: number };
type SandState = { strokes: Stroke[]; treasures: Treasure[]; seed: number; tone: 'honey' | 'rose' | 'pearl' };
const TREASURES: { kind: TreasureKind; label: string }[] = [{ kind: 'shell', label: 'Concha' }, { kind: 'stone', label: 'Pedrinha' }, { kind: 'star', label: 'Estrela' }, { kind: 'glass', label: 'Vidro do mar' }];
const COLORS = { honey: { base: '#e9d4ad', line: '#b9a179', edge: '#f5e5ca' }, rose: { base: '#e5c9bc', line: '#b49180', edge: '#f4dfd5' }, pearl: { base: '#e5e3d5', line: '#aaa998', edge: '#f7f4e9' } };
function pointer(svg: SVGSVGElement, event: ReactPointerEvent<SVGSVGElement>): Point {
  const matrix = svg.getScreenCTM();
  if (matrix) { const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()); return { x: Math.min(714, Math.max(6, p.x)), y: Math.min(694, Math.max(6, p.y)) }; }
  const rect = svg.getBoundingClientRect(); return { x: (event.clientX - rect.left) * 720 / rect.width, y: (event.clientY - rect.top) * 700 / rect.height };
}
function strokePath(points: Point[]) {
  if (points.length === 1) return `M${points[0].x} ${points[0].y} l.1 .1`;
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) d += ` Q${points[i].x} ${points[i].y} ${(points[i].x + points[i + 1].x) / 2} ${(points[i].y + points[i + 1].y) / 2}`;
  const last = points[points.length - 1]; return `${d} L${last.x} ${last.y}`;
}
function TreasureArt({ kind, color }: { kind: TreasureKind; color: string }) {
  if (kind === 'shell') return <g><ellipse cy="21" rx="39" ry="7" fill="#6f674f" opacity=".12" /><path d="M-30 19 Q-60-14-28-38 Q-8-56 5-42 Q29-57 44-22 Q56 7 19 22 L8 31 L-4 29 L-11 21Z" fill={color} /><g stroke="#fff9ed" strokeWidth="2" fill="none" opacity=".65"><path d="M0 20 Q-34-17-26-37 M3 20 Q-14-28-8-43 M7 21 Q9-21 10-42 M10 22 Q31-5 32-36 M14 21 Q42 10 43-16" /></g><path d="M-7 24 Q2 17 14 25 L8 32 L-3 30Z" fill="#c2a89c" /></g>;
  if (kind === 'stone') return <g><ellipse cy="19" rx="45" ry="10" fill="#6f674f" opacity=".15" /><path d="M-46 8 Q-55-14-18-29 Q18-48 43-17 Q61 4 33 22 Q-8 33-46 8Z" fill={color} /><path d="M-28-12 Q-12-25 10-22" stroke="#fff9ed" strokeWidth="5" strokeLinecap="round" opacity=".45" /><path d="M-41 7 Q-5 27 34 11" stroke="#716d5b" strokeWidth="3" strokeLinecap="round" opacity=".22" /></g>;
  if (kind === 'glass') return <g><ellipse cy="25" rx="27" ry="7" fill="#6f674f" opacity=".12" /><path d="M-20-39 L23-20 L28 24 L-22 28 L-36-4Z" fill={color} opacity=".77" /><path d="M-18-31 L17-16 L19 4" fill="none" stroke="#fff9ed" strokeWidth="4" strokeLinecap="round" opacity=".6" /><path d="M-22 27 L-35-3 L-19-39" fill="none" stroke="#fff9ed" strokeWidth="2" opacity=".55" /></g>;
  return <g><ellipse cy="30" rx="45" ry="9" fill="#6f674f" opacity=".12" /><path d="M0-52 Q12-15 18-13 Q32-16 48-20 Q27 4 23 11 Q26 30 30 47 Q9 28-1 25 Q-19 33-36 42 Q-29 17-27 4 Q-42-8-52-25 Q-17-18-11-19Z" fill={color} />{[-1, 0, 1].map((i, index) => <path key={index} d={i === -1 ? 'M-4-14 L-35-20 M-10 8 L-27 30' : i === 0 ? 'M0-4 L0-38' : 'M11-4 L35-15 M8 11 L23 34'} stroke="#fff9ed" strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" opacity=".7" />)}<circle r="6" fill="#fff9ed" opacity=".2" /></g>;
}
function RakedStroke({ stroke, colors }: { stroke: Stroke; colors: typeof COLORS.honey }) {
  const d = strokePath(stroke.points);
  const offsets = stroke.width === 2 ? [-4, 0, 4] : [-9, -4.5, 0, 4.5, 9];
  return <g fill="none" strokeLinecap="round" strokeLinejoin="round">{offsets.map((offset, i) => <g key={i} transform={`translate(${offset} ${offset * .65})`}><path d={d} stroke={colors.line} strokeWidth={stroke.width} opacity=".67" /><path d={d} transform="translate(1.8 1.8)" stroke={colors.edge} strokeWidth={stroke.width * .75} opacity=".9" /></g>)}</g>;
}

export default function Sand({ onSave }: GameProps) {
  const [sand, setSand] = usePersistentState<SandState>('sand-v1', () => ({ strokes: [], treasures: [{ id: 'welcome-shell', kind: 'shell', x: 601, y: 576, color: '#d7917c', angle: -17, size: 1.05 }], seed: randomSeed(), tone: 'honey' }));
  const [mode, setMode] = useState<'rake' | 'stamp' | 'move'>('rake');
  const [rakeWidth, setRakeWidth] = useState(2);
  const [kind, setKind] = useState<TreasureKind>('shell');
  const [color, setColor] = useState('#d7917c');
  const [draft, setDraft] = useState<Stroke | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<SandState[]>([]);
  const [tide, setTide] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('Faça um caminho que não precisa chegar a lugar nenhum.');
  const svgRef = useRef<SVGSVGElement>(null);
  const activeStroke = useRef<Stroke | null>(null);
  const drag = useRef<{ id: string; origin: Point; start: Point; before: SandState; moved: boolean } | null>(null);
  const tideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (tideTimeout.current) clearTimeout(tideTimeout.current); }, []);
  const grains = useMemo(() => { const random = seededRandom(sand.seed); return Array.from({ length: 700 }, (_, i) => ({ id: i, x: random() * 720, y: random() * 700, radius: .45 + random() * 1.05, opacity: .08 + random() * .15 })); }, [sand.seed]);
  const remember = (before: SandState) => setHistory(old => [...old.slice(-39), before]);
  const colors = COLORS[sand.tone];
  function begin(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0 || !event.isPrimary || tide) return;
    const p = pointer(event.currentTarget, event); const id = (event.target as Element).closest('[data-treasure-id]')?.getAttribute('data-treasure-id');
    const treasure = sand.treasures.find(item => item.id === id);
    if (treasure && mode !== 'rake') { setSelected(treasure.id); drag.current = { id: treasure.id, origin: { x: treasure.x, y: treasure.y }, start: p, before: sand, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); return; }
    setSelected(null);
    if (mode === 'move') return;
    if (mode === 'stamp') {
      remember(sand); const item: Treasure = { id: `treasure-${Date.now()}-${randomSeed()}`, kind, ...p, color, angle: (randomSeed() % 45) - 22, size: .85 + (randomSeed() % 30) / 100 };
      setSand(old => ({ ...old, treasures: [...old.treasures, item] })); setSelected(item.id); setMessage('Um achadinho. A praia não vai cobrar por ele.'); return;
    }
    const stroke: Stroke = { id: `stroke-${Date.now()}-${randomSeed()}`, points: [p], width: rakeWidth }; activeStroke.current = stroke; setDraft(stroke); event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: ReactPointerEvent<SVGSVGElement>) {
    if (!event.isPrimary) return;
    const p = pointer(event.currentTarget, event);
    if (drag.current) {
      const current = drag.current; const dx = p.x - current.start.x, dy = p.y - current.start.y;
      if (!current.moved && Math.hypot(dx, dy) < 3) return; current.moved = true;
      setSand(old => ({ ...old, treasures: old.treasures.map(item => item.id === current.id ? { ...item, x: Math.max(35, Math.min(685, current.origin.x + dx)), y: Math.max(35, Math.min(665, current.origin.y + dy)) } : item) })); return;
    }
    const current = activeStroke.current; if (!current) return;
    const last = current.points[current.points.length - 1]; if (Math.hypot(last.x - p.x, last.y - p.y) < 2.4) return;
    const next = { ...current, points: [...current.points, p] }; activeStroke.current = next; setDraft(next);
  }
  function end(event: ReactPointerEvent<SVGSVGElement>) {
    if (!event.isPrimary) return;
    if (drag.current?.moved) remember(drag.current.before); drag.current = null;
    if (activeStroke.current) { const stroke = activeStroke.current; remember(sand); setSand(old => ({ ...old, strokes: [...old.strokes, stroke] })); activeStroke.current = null; setDraft(null); }
  }
  function undo() { if (!history.length) return; if (tideTimeout.current) clearTimeout(tideTimeout.current); setTide(false); setSand(history[history.length - 1]); setHistory(old => old.slice(0, -1)); setSelected(null); setMessage('Até a maré aceita voltar atrás.'); }
  function wash() {
    remember(sand); setSand(old => ({ ...old, strokes: [], treasures: [] })); setSelected(null); setTide(true); setMessage('A maré deixou uma folha nova. Desfazer traz tudo de volta.');
    if (tideTimeout.current) clearTimeout(tideTimeout.current); tideTimeout.current = setTimeout(() => setTide(false), 1050);
  }
  function remove() { if (!selected) return; remember(sand); setSand(old => ({ ...old, treasures: old.treasures.filter(item => item.id !== selected) })); setSelected(null); }
  async function save() {
    if (!svgRef.current) return; setSaving(true);
    try { const copy = svgRef.current.cloneNode(true) as SVGSVGElement; copy.querySelectorAll('[data-export-hide]').forEach(element => element.remove()); await onSave({ kind: 'sand', title: 'Uma praia só minha', dataUrl: await svgToDataUrl(copy) }); setMessage('Praia guardada. Não veio areia dentro da bolsa.'); }
    catch { setMessage('A praia não foi guardada. Tente novamente.'); } finally { setSaving(false); }
  }
  return <div className="nature-game sand-game">
    <div className="nature-intro"><span className="nature-eyebrow">destino: lugar nenhum</span><p>Desenhe na areia, espalhe achadinhos e deixe a maré recomeçar.</p></div>
    <div className="game-toolbar nature-toolbar"><div className="segmented" aria-label="Ferramenta da areia"><button type="button" aria-pressed={mode === 'rake'} onClick={() => setMode('rake')}>Rastelo</button><button type="button" aria-pressed={mode === 'stamp'} onClick={() => setMode('stamp')}>Achadinhos</button><button type="button" aria-pressed={mode === 'move'} onClick={() => setMode('move')}>Mover</button></div><div className="segmented" aria-label="Cor da areia">{(['honey', 'rose', 'pearl'] as const).map((tone, i) => <button type="button" key={tone} aria-pressed={sand.tone === tone} onClick={() => { remember(sand); setSand(old => ({ ...old, tone })); }}>{['Mel', 'Rosé', 'Pérola'][i]}</button>)}</div></div>
    <div className="nature-workspace">
      <div className="game-canvas nature-canvas sand-canvas"><svg viewBox="0 0 720 700" ref={svgRef} role="group" aria-label="Areia de bolso. Deslize o dedo para desenhar sulcos." onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
        <defs><radialGradient id="sand-shine"><stop stopColor="#fff9ed" stopOpacity=".2" /><stop offset="1" stopColor="#a38e69" stopOpacity=".08" /></radialGradient><clipPath id="sand-clip"><rect width="720" height="700" rx="28" /></clipPath></defs>
        <g clipPath="url(#sand-clip)"><rect width="720" height="700" fill={colors.base} /><rect width="720" height="700" fill="url(#sand-shine)" />
          {grains.map(grain => <circle key={grain.id} cx={grain.x} cy={grain.y} r={grain.radius} fill={colors.line} opacity={grain.opacity} />)}
          {!sand.strokes.length && !draft && <g data-export-hide="true" opacity=".42" pointerEvents="none"><path d="M65 160 Q184 95 283 154 T554 153 M64 169 Q184 104 283 163 T554 162 M63 178 Q184 113 283 172 T554 171" fill="none" stroke={colors.line} strokeWidth="2" /><text x="360" y="331" textAnchor="middle" fill="#716a58" fontFamily="Georgia, serif" fontSize="29">Pode fazer só um rabisco.</text><text x="360" y="363" textAnchor="middle" fill="#716a58" fontFamily="DM Sans, sans-serif" fontSize="17">Ou muitos. Ou nenhum.</text></g>}
          {sand.strokes.map(stroke => <RakedStroke key={stroke.id} stroke={stroke} colors={colors} />)}{draft && <RakedStroke stroke={draft} colors={colors} />}
          {sand.treasures.map(item => <g key={item.id} data-treasure-id={item.id} className={`sand-treasure ${mode === 'rake' ? 'sand-pass-through' : ''}`} transform={`translate(${item.x} ${item.y}) rotate(${item.angle}) scale(${item.size})`} role="button" tabIndex={0} aria-label={`${TREASURES.find(t => t.kind === item.kind)?.label}. Use as setas para mover.`} onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(item.id); setMode('move'); }
            if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); remember(sand); setSand(old => ({ ...old, treasures: old.treasures.filter(t => t.id !== item.id) })); setSelected(null); }
            const directions: Record<string, [number, number]> = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }; const delta = directions[event.key];
            if (delta) { event.preventDefault(); remember(sand); setSand(old => ({ ...old, treasures: old.treasures.map(t => t.id === item.id ? { ...t, x: Math.max(35, Math.min(685, t.x + delta[0])), y: Math.max(35, Math.min(665, t.y + delta[1])) } : t) })); }
          }}><rect x="-60" y="-60" width="120" height="120" fill="transparent" />{selected === item.id && <circle data-export-hide="true" r="65" fill="none" stroke="#7c8a77" strokeWidth="2" strokeDasharray="4 5" />}<TreasureArt kind={item.kind} color={item.color} /></g>)}
          <text x="41" y="664" fill="#8b7b65" fontFamily="DM Sans, sans-serif" fontSize="14" opacity=".8">a praia não tem horário de fechar</text>
          {tide && <g className="sand-tide" data-export-hide="true" pointerEvents="none"><path d="M-20-30 H740 V600 Q600 644 482 594 Q322 651 205 604 Q72 647-20 608Z" fill="#afcec7" opacity=".94" /><path d="M-20 608 Q72 647 205 604 Q322 651 482 594 Q600 644 740 600" stroke="#fff9ed" strokeWidth="14" fill="none" opacity=".8" /></g>}
        </g>
      </svg></div>
      <div className="nature-controls">
        <div><span className="control-label">Jeito do rastelo</span><div className="segmented"><button type="button" aria-pressed={rakeWidth === 2} onClick={() => { setRakeWidth(2); setMode('rake'); }}>Três pontinhas</button><button type="button" aria-pressed={rakeWidth === 3} onClick={() => { setRakeWidth(3); setMode('rake'); }}>Cinco pontinhas</button></div></div>
        <div><span className="control-label">O que a praia trouxe?</span><div className="nature-stamp-list sand-stamp-list">{TREASURES.map(treasure => <button className={`nature-stamp-button ${kind === treasure.kind && mode === 'stamp' ? 'is-active' : ''}`} type="button" key={treasure.kind} aria-pressed={kind === treasure.kind && mode === 'stamp'} onClick={() => { setKind(treasure.kind); setMode('stamp'); }}><svg viewBox="-68 -68 136 136" aria-hidden="true"><TreasureArt kind={treasure.kind} color={color} /></svg><span>{treasure.label}</span></button>)}</div></div>
        <div><span className="control-label">Cor dos achadinhos</span><Palette value={color} onChange={setColor} /></div>
        <p className="nature-side-note">Nem todo caminho precisa virar uma conquista.<br />Às vezes, só vira uma espiral bonita.</p>
      </div>
    </div>
    <div className="game-toolbar nature-actions"><button className="soft-button" type="button" onClick={undo} disabled={!history.length}>Desfazer</button><button className="soft-button" type="button" onClick={remove} disabled={!selected}>Retirar achadinho</button><button className="soft-button" type="button" onClick={wash} disabled={tide}>Trazer a maré</button><button className="primary-button" type="button" onClick={save} disabled={saving || tide}>{saving ? 'Guardando…' : 'Guardar minha praia'}</button></div>
    <p className="game-note nature-note" role="status">{message}</p><p className="nature-hint">Rastelo: deslize o dedo. Achadinhos: toque para colocar. Mover: arraste as conchas e pedrinhas.</p>
  </div>;
}
