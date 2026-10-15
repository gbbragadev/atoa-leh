import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from '../lib/types';
import { usePersistentState } from '../lib/storage';
import { PALETTE, randomSeed, seededRandom, svgToDataUrl } from '../lib/art';
import { Palette } from '../components/Palette';
import PaintViewport from '../components/PaintViewport';
import type { PaintPoint } from '../components/PaintViewport';
import { makeIllustration, SCENES, SCENE_BY_ID, SCENE_CATEGORIES } from './atelier-scenes';
import type { SceneId, SceneCategory, Region } from './atelier-scenes';
import './art-games.css';

type Mode = 'color' | 'pixels' | 'free';
type Picture = SceneId;
type BrushKind = 'pen' | 'chalk' | 'watercolor';
type PixelPicture = 'cat' | 'plant' | 'flowers';
type Point = { x: number; y: number };
type Stroke = { points: Point[]; color: string; size: number; erase: boolean; brush?: BrushKind; textureSeed?: number };
type Artwork = {
  seed: number; picture: Picture; regions: Record<string, string>;
  pixelSeed: number; pixelPicture: PixelPicture; pixels: Record<string, string>;
  strokes: Stroke[];
  library?: Partial<Record<Picture, { seed: number; regions: Record<string, string> }>>;
};

const PAPER = '#fffaf0';
const INK = '#687064';
const PIXEL_SIZE = 24;
const PICTURE_NAMES = Object.fromEntries(SCENES.map(scene => [scene.id, scene.title])) as Record<Picture, string>;
const PIXEL_NAMES: Record<PixelPicture, string> = { cat: 'Gatinho em pixels', plant: 'Minha plantinha quadradinha', flowers: 'Flores em pixels' };
const CURATED_SEEDS = Object.fromEntries(SCENES.map(scene => [scene.id, scene.seed])) as Record<Picture, number>;
const PICTURE_LABELS = Object.fromEntries(SCENES.map(scene => [scene.id, scene.label])) as Record<Picture, string>;
const COLOR_SETS = {
  workshop: { name: 'Tintinhas do ateliê', colors: PALETTE },
  sunshine: { name: 'Um dia de sol', colors: ['#e7bf55', '#f4df9b', '#cf8063', '#86a39e', '#597967', '#b2c7d1', '#e6b6a2', '#fff5dc', '#94796c', '#4c5446'] },
  forest: { name: 'Passeio no bosque', colors: ['#405c49', '#74896d', '#a9ba87', '#e4d8b7', '#b37863', '#ccaba0', '#8e8d6e', '#91a7a5', '#f5eedf', '#51473d'] },
  sweets: { name: 'Docinho de tarde', colors: ['#c894a8', '#e6bcb9', '#b1a3c7', '#a5bbac', '#e9d18f', '#9eaabf', '#cf9b81', '#f5e7d1', '#fff7ef', '#6e6368'] },
};
type ColorSet = keyof typeof COLOR_SETS;
type ArtSnapshot = { mode: Mode; artwork: Artwork };

function previewColor(region: Region, picture: Picture, index: number) {
  const id = region.id;
  if (/cat-white/.test(id)) return '#f7f3e6';
  if (/cat-black/.test(id)) return '#666b66';
  if (/cat-gray/.test(id)) return '#b4b8b4';
  if (/cat-orange-stripe/.test(id)) return '#b48359';
  if (/cat-orange/.test(id)) return '#d7ae7d';
  if (/stem|leaf|plant|sprout|canopy|hill/.test(id)) return ['#94aa83', '#b7c7a1', '#6f8968'][index % 3];
  if (/window.*(?:sky)|snow|cloud|glass-house-window/.test(id)) return '#d6e1df';
  if (/yarn|granny|blanket-stripe/.test(id)) return ['#c3a6b5', '#abc1b0', '#dfc487'][index % 3];
  if (/sofa|chair/.test(id)) return '#bac7ac';
  if (/window.*(?:frame|bar|sill)|shutter|bookcase|table/.test(id)) return '#d6b99d';
  if (/van|sun|heart|hat|vase|pot/.test(id)) return '#ecd384';
  if (/wheel|hub/.test(id)) return '#7c8377';
  if (/petal|flower|bow|mushroom/.test(id)) return ['#d9a793', '#d6b9be', '#ccbacb'][index % 3];
  if (picture === 'cat' || /cat/.test(id)) return '#e8cfac';
  return ['#e6cfb9', '#d9c6b9', '#ead8b1'][index % 3];
}

function PictureThumbnail({ picture, seed, colors }: { picture: Picture; seed?: number; colors?: Record<string, string> }) {
  const illustration = useMemo(() => makeIllustration(seed ?? CURATED_SEEDS[picture], picture), [picture, seed]);
  return <svg viewBox="0 0 600 600" aria-hidden="true" focusable="false">
    <rect width="600" height="600" fill={PAPER} />
    {illustration.regions.map((region, i) => {
      const attrs = { fill: colors?.[region.id] ?? previewColor(region, picture, i), stroke: INK, strokeWidth: 4 };
      return region.kind === 'path' ? <path key={region.id} {...region.props} {...attrs} /> : region.kind === 'ellipse' ? <ellipse key={region.id} {...region.props} {...attrs} /> : <circle key={region.id} {...region.props} {...attrs} />;
    })}
    {illustration.details.map((detail, i) => <path key={i} d={detail} fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />)}
  </svg>;
}

function makePixels(seed: number, picture: PixelPicture): number[][] {
  const random = seededRandom(seed);
  const pixels = Array.from({ length: PIXEL_SIZE }, () => Array<number>(PIXEL_SIZE).fill(0));
  const put = (x: number, y: number, color: number) => { if (pixels[y]?.[x] !== undefined) pixels[y][x] = color; };
  const rect = (x: number, y: number, w: number, h: number, color: number) => { for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) put(x + dx, y + dy, color); };
  const body = [3, 4, 5, 7][Math.floor(random() * 4)];
  const shift = Math.floor(random() * 3) - 1;
  if (picture === 'cat') {
    rect(6 + shift, 6, 12, 8, body); rect(7 + shift, 5, 10, 1, body);
    rect(6 + shift, 3, 3, 4, body); rect(15 + shift, 3, 3, 4, body);
    put(7 + shift, 4, 5); put(16 + shift, 4, 5);
    rect(8 + shift, 14, 9, 5, body); rect(7 + shift, 19, 11, 2, body);
    rect(17 + shift, 17, 3, 2, body); rect(19 + shift, 13, 2, 5, body); put(19 + shift, 12, body);
    rect(9 + shift, 15, 6, 4, 9); put(9 + shift, 9, 10); put(14 + shift, 9, 10);
    put(12 + shift, 11, 5); put(11 + shift, 12, 10); put(13 + shift, 12, 10);
    put(7 + shift, 11, 4); put(16 + shift, 11, 4);
    const stripe = [1, 4, 5, 6, 8][Math.floor(random() * 5)];
    for (let y = 6; y < 20; y++) for (let x = 6; x < 19; x++) {
      if (pixels[y][x] === body && random() < 0.16) put(x, y, stripe);
    }
    if (random() > 0.5) { put(9 + shift, 9, 10); put(10 + shift, 9, 10); put(14 + shift, 9, 10); put(15 + shift, 9, 10); }
    rect(5, 21, 16, 1, 2);
  } else if (picture === 'plant') {
    const potColor = [4, 5, 6, 7][Math.floor(random() * 4)];
    rect(7, 16, 11, 2, potColor); rect(8, 18, 9, 4, potColor); rect(9, 22, 7, 1, potColor);
    rect(12, 4, 1, 12, 1); rect(6 + shift, 9, 6, 2, 1); rect(14, 6, 5, 2, 1);
    rect(4 + shift, 7, 6, 2, 2); rect(5 + shift, 6, 4, 1, 2); rect(5 + shift, 9, 5, 2, 2);
    rect(14, 4, 6, 2, 2); rect(15, 3, 4, 1, 2); rect(15, 6, 4, 2, 2);
    rect(7, 12, 5, 2, 2); rect(8, 11, 3, 1, 2);
    put(11, 19, 9); put(14, 19, 9); put(12, 21, 9); put(13, 21, 9);
    for (let y = 18; y < 22; y++) for (let x = 9; x < 16; x++) if (pixels[y][x] === potColor && random() < .21) put(x, y, 8);
    const extraLeaves = 1 + Math.floor(random() * 3);
    for (let i = 0; i < extraLeaves; i++) {
      const leafY = 6 + i * 3;
      const left = random() > .5;
      rect(left ? 9 : 13, leafY, 3, 1, 1); rect(left ? 8 : 14, leafY - 1, 3, 1, 2);
    }
  } else {
    const centers = [[6 + Math.floor(random() * 3), 5 + Math.floor(random() * 4)], [15 + Math.floor(random() * 3), 4 + Math.floor(random() * 4)], [11 + Math.floor(random() * 3), 10 + Math.floor(random() * 3)]];
    centers.forEach(([cx, cy], i) => {
      rect(cx, cy + 2, 1, 18 - cy, 1);
      rect(cx - 3, cy + 7, 3, 2, 2);
      const flower = [4, 5, 6, 7][(i + Math.floor(random() * 4)) % 4];
      rect(cx - 1, cy - 3, 3, 2, flower); rect(cx - 1, cy + 2, 3, 2, flower);
      rect(cx - 3, cy - 1, 2, 3, flower); rect(cx + 2, cy - 1, 2, 3, flower);
      rect(cx - 1, cy - 1, 3, 3, 3);
    });
    rect(8, 20, 9, 1, body); rect(9, 21, 7, 2, body);
  }
  const decorations = 2 + Math.floor(random() * 5);
  for (let i = 0; i < decorations; i++) {
    const x = random() > .5 ? 2 + Math.floor(random() * 3) : 20 + Math.floor(random() * 2);
    const y = 2 + Math.floor(random() * 18);
    if (pixels[y][x] === 0) put(x, y, 3 + Math.floor(random() * 5));
  }
  return pixels;
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (!stroke.points.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = stroke.erase ? PAPER : stroke.color;
  ctx.fillStyle = stroke.erase ? PAPER : stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const line = (width: number) => {
    ctx.lineWidth = width;
    if (stroke.points.length === 1) {
      ctx.beginPath(); ctx.arc(stroke.points[0].x, stroke.points[0].y, width / 2, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      stroke.points.slice(1).forEach(point => ctx.lineTo(point.x, point.y)); ctx.stroke();
    }
  };
  if (stroke.erase || !stroke.brush || stroke.brush === 'pen') line(stroke.size);
  else if (stroke.brush === 'watercolor') {
    // Three translucent washes make soft edges and leave the paper visible.
    ctx.globalAlpha = .15; ctx.shadowColor = stroke.color; ctx.shadowBlur = stroke.size * .32;
    line(stroke.size * 1.25);
    ctx.shadowBlur = 0; ctx.globalAlpha = .19; line(stroke.size * .82);
    ctx.globalAlpha = .1; line(stroke.size * .4);
  } else {
    // Grain has a stable seed: reopening a chalk drawing preserves every speck.
    const random = seededRandom(stroke.textureSeed ?? 1729);
    ctx.globalAlpha = .12; line(stroke.size);
    const dab = (x: number, y: number) => {
      for (let i = 0; i < 7; i++) {
        const angle = random() * Math.PI * 2, radius = Math.sqrt(random()) * stroke.size * .48;
        ctx.globalAlpha = .12 + random() * .49;
        ctx.beginPath(); ctx.arc(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, .45 + random() * Math.max(.6, stroke.size * .055), 0, Math.PI * 2); ctx.fill();
      }
    };
    const spacing = Math.max(1.2, stroke.size * .12);
    dab(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      const a = stroke.points[i - 1], b = stroke.points[i], distance = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(distance / spacing));
      for (let j = 1; j <= steps; j++) dab(a.x + (b.x - a.x) * j / steps, a.y + (b.y - a.y) * j / steps);
    }
  }
  ctx.restore();
}

export default function Atelier({ onSave }: GameProps) {
  const [artwork, setArtwork] = usePersistentState<Artwork>('atelier-artwork', () => ({ seed: CURATED_SEEDS.cat, picture: 'cat', regions: {}, pixelSeed: randomSeed(), pixelPicture: 'cat', pixels: {}, strokes: [] }));
  const [mode, setMode] = usePersistentState<Mode>('atelier-mode', 'color');
  const [color, setColor] = usePersistentState('atelier-color', PALETTE[4]);
  const [colorSet, setColorSet] = usePersistentState<ColorSet>('atelier-color-set', 'workshop');
  const [brushSize, setBrushSize] = usePersistentState('atelier-brush', 12);
  const [brushKind, setBrushKind] = usePersistentState<BrushKind>('atelier-brush-kind', 'pen');
  const [numbers, setNumbers] = usePersistentState('atelier-numbers', true);
  const [category, setCategory] = useState<SceneCategory>(SCENE_BY_ID[artwork.picture]?.category ?? 'cats');
  const [erase, setErase] = useState(false);
  const [past, setPast] = useState<ArtSnapshot[]>([]);
  const [future, setFuture] = useState<ArtSnapshot[]>([]);
  const [showOtherWays, setShowOtherWays] = useState(mode !== 'color');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const artworkRef = useRef(artwork);
  const modeRef = useRef(mode);
  const pastRef = useRef<ArtSnapshot[]>([]);
  const futureRef = useRef<ArtSnapshot[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draftStroke = useRef<Stroke | null>(null);
  const callbacks = useRef<{ finish: () => void }>({ finish: () => {} });
  const illustration = useMemo(() => makeIllustration(artwork.seed, artwork.picture), [artwork.seed, artwork.picture]);
  const pixelGuide = useMemo(() => makePixels(artwork.pixelSeed, artwork.pixelPicture), [artwork.pixelSeed, artwork.pixelPicture]);

  const replace = (next: Artwork) => { artworkRef.current = next; setArtwork(next); };
  const updatePast = (next: ArtSnapshot[]) => { pastRef.current = next; setPast(next); };
  const updateFuture = (next: ArtSnapshot[]) => { futureRef.current = next; setFuture(next); };
  const remember = (before: Artwork, previousMode = modeRef.current) => {
    updatePast([...pastRef.current.slice(-59), { mode: previousMode, artwork: before }]); updateFuture([]);
  };
  const change = (next: Artwork) => {
    if (next === artworkRef.current) return;
    remember(artworkRef.current); replace(next); setNotice('');
  };
  const restore = (snapshot: ArtSnapshot) => {
    replace(snapshot.artwork); modeRef.current = snapshot.mode; setMode(snapshot.mode);
    if (snapshot.mode !== 'color') setShowOtherWays(true);
  };
  const undo = () => {
    finishDraft();
    const previous = pastRef.current.at(-1);
    if (!previous) return;
    updateFuture([...futureRef.current, { mode: modeRef.current, artwork: artworkRef.current }]);
    updatePast(pastRef.current.slice(0, -1)); restore(previous); setNotice('Voltou um passinho.');
  };
  const redo = () => {
    finishDraft();
    const next = futureRef.current.at(-1);
    if (!next) return;
    updatePast([...pastRef.current, { mode: modeRef.current, artwork: artworkRef.current }]);
    updateFuture(futureRef.current.slice(0, -1)); restore(next); setNotice('O passinho está de volta.');
  };
  const renderCanvas = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 600, 600); ctx.fillStyle = PAPER; ctx.fillRect(0, 0, 600, 600);
    artworkRef.current.strokes.forEach(stroke => drawStroke(ctx, stroke));
    if (draftStroke.current) drawStroke(ctx, draftStroke.current);
  };
  const boundedPoint = (point: PaintPoint): Point => ({ x: Math.max(0, Math.min(600, point.x)), y: Math.max(0, Math.min(600, point.y)) });
  const startStroke = (point: PaintPoint) => { draftStroke.current = { color, size: brushSize, erase, brush: brushKind, textureSeed: randomSeed(), points: [boundedPoint(point)] }; renderCanvas(); };
  const moveStroke = (point: PaintPoint) => {
    if (!draftStroke.current) return;
    const next = boundedPoint(point), previous = draftStroke.current.points.at(-1);
    if (previous && Math.hypot(next.x - previous.x, next.y - previous.y) < .25) return;
    draftStroke.current.points.push(next); renderCanvas();
  };
  const finishDraft = () => {
    const stroke = draftStroke.current;
    if (!stroke) return;
    draftStroke.current = null;
    change({ ...artworkRef.current, strokes: [...artworkRef.current.strokes, { ...stroke, points: [...stroke.points] }] });
    renderCanvas();
  };
  const cancelDraft = () => { draftStroke.current = null; renderCanvas(); };
  callbacks.current = { finish: finishDraft };
  useEffect(() => { artworkRef.current = artwork; modeRef.current = mode; renderCanvas(); }, [artwork, mode]);
  useEffect(() => { setCategory(SCENE_BY_ID[artwork.picture]?.category ?? 'cats'); }, [artwork.picture]);
  useEffect(() => {
    const flush = () => callbacks.current.finish();
    const visibility = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', visibility); window.addEventListener('pagehide', flush);
    return () => { document.removeEventListener('visibilitychange', visibility); window.removeEventListener('pagehide', flush); flush(); };
  }, []);
  const paint = (id: string) => {
    const current = artworkRef.current;
    const key = modeRef.current === 'pixels' ? 'pixels' : 'regions';
    const nextColor = erase ? PAPER : color;
    if (current[key][id] === nextColor) return;
    change({ ...current, [key]: { ...current[key], [id]: nextColor } });
  };
  const paintTap = (point: PaintPoint) => {
    const region = point.target?.closest('[data-art-region]');
    if (region && svgRef.current?.contains(region)) { const id = region.getAttribute('data-art-region'); if (id) paint(id); }
  };
  const chooseMode = (next: Mode) => { finishDraft(); modeRef.current = next; setMode(next); setErase(false); setNotice(''); };
  const choosePicture = (picture: Picture) => {
    if (picture === artworkRef.current.picture) return;
    const current = artworkRef.current;
    const library = { ...current.library, [current.picture]: { seed: current.seed, regions: current.regions } };
    const saved = library[picture];
    change({ ...current, picture, seed: saved?.seed ?? CURATED_SEEDS[picture], regions: saved?.regions ?? {}, library });
    setCategory(SCENE_BY_ID[picture].category);
    setNotice(saved && Object.keys(saved.regions).length ? 'Seu rascunho estava esperando por você.' : '');
  };
  const newDrawing = () => {
    finishDraft();
    if (modeRef.current === 'color') change({ ...artworkRef.current, seed: randomSeed(), regions: {} });
    else if (modeRef.current === 'pixels') change({ ...artworkRef.current, pixelSeed: randomSeed(), pixels: {} });
    else change({ ...artworkRef.current, strokes: [] });
    setNotice('Uma página fresquinha. A anterior está no Desfazer.');
  };
  const clear = () => {
    finishDraft();
    if (modeRef.current === 'color') change({ ...artworkRef.current, regions: {} });
    else if (modeRef.current === 'pixels') change({ ...artworkRef.current, pixels: {} });
    else change({ ...artworkRef.current, strokes: [] });
    setNotice('Tudo limpinho. Se bateu saudade, use Desfazer.');
  };
  const save = async () => {
    if (saving) return;
    finishDraft(); setSaving(true); setNotice('');
    const savedArtwork = artworkRef.current, savedMode = modeRef.current;
    try {
      let dataUrl: string | undefined;
      if (savedMode === 'free') dataUrl = canvasRef.current?.toDataURL('image/png');
      else if (svgRef.current) {
        const exported = svgRef.current.cloneNode(true) as SVGSVGElement;
        if (savedMode === 'pixels') {
          exported.querySelectorAll('text').forEach(number => number.remove());
          exported.querySelectorAll<SVGRectElement>('[data-unpainted="true"]').forEach(pixel => pixel.setAttribute('fill', PAPER));
        }
        dataUrl = await svgToDataUrl(exported);
      }
      if (!dataUrl) throw new Error('O desenho ainda não abriu.');
      await onSave({ kind: 'atelier', title: savedMode === 'free' ? 'Um rabisco da Leh' : savedMode === 'color' ? PICTURE_NAMES[savedArtwork.picture] : PIXEL_NAMES[savedArtwork.pixelPicture], dataUrl });
      setNotice('Guardadinho na sua galeria. Fui eu que fiz.');
    } catch { setNotice('Não consegui guardar agora. Seu rascunho continua aqui; tente novamente.'); }
    finally { setSaving(false); }
  };
  const regionProps = (id: string) => ({
    'data-art-region': id, fill: artwork.regions[id] ?? PAPER, stroke: INK, strokeWidth: 2.1,
    role: 'button', tabIndex: 0, 'aria-label': `Pintar ${id.startsWith('petal') ? 'pétala' : id.startsWith('leaf') ? 'folha' : 'região'} ${id}`,
    onKeyDown: (event: React.KeyboardEvent<SVGElement>) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); paint(id); } },
  });
  const usedNumbers = Array.from(new Set(pixelGuide.flat().filter(n => n > 0))).sort((a, b) => a - b);
  const selectedSet = COLOR_SETS[colorSet] ?? COLOR_SETS.workshop;

  return <div className="art-game">
    <div className="art-workspace">
      <div className="art-paper-area">
        {mode === 'color' && <details className="art-scene-library" aria-label="Desenhos do ateliê">
          <summary className="art-library-toggle"><span>{PICTURE_LABELS[artwork.picture]}</span><small>Trocar desenho · 16 cantinhos</small></summary>
          <div className="art-library-heading"><span className="control-label">Escolha um cantinho</span><span>16 desenhos, outras tantas versões</span></div>
          <div className="art-scene-categories" aria-label="Categorias dos desenhos">
            {SCENE_CATEGORIES.map(group => <button key={group.id} type="button" aria-pressed={category === group.id} onClick={() => setCategory(group.id)}>{group.label}</button>)}
          </div>
          <div className="art-picture-shelf" aria-label={SCENE_CATEGORIES.find(group => group.id === category)?.label}>
            {SCENES.filter(scene => scene.category === category).map(scene => {
              const picture = scene.id;
              const draft = picture === artwork.picture ? { seed: artwork.seed, regions: artwork.regions } : artwork.library?.[picture];
              const hasDraft = !!Object.keys(draft?.regions ?? {}).length;
              return <button key={picture} type="button" data-scene-id={picture} className={artwork.picture === picture ? 'is-selected' : ''} aria-pressed={artwork.picture === picture} aria-label={`Pintar ${PICTURE_LABELS[picture]}`} onClick={() => choosePicture(picture)}>
                <PictureThumbnail picture={picture} seed={draft?.seed} colors={draft?.regions} /><span>{PICTURE_LABELS[picture]}</span><small>{hasDraft ? 'seu rascunho' : 'um papel novinho'}</small>
              </button>;
            })}
          </div>
          <p className="art-current-scene"><span>Na sua mesa</span> {PICTURE_NAMES[artwork.picture]}</p>
        </details>}
        {mode === 'pixels' && <div className="art-picture-picker">
          <label className="control-label" htmlFor="art-picture">O desenho de hoje</label>
          <select id="art-picture" value={artwork.pixelPicture} onChange={event => change({ ...artworkRef.current, pixelPicture: event.target.value as PixelPicture, pixelSeed: randomSeed(), pixels: {} })}><option value="cat">Gatinho</option><option value="plant">Plantinha</option><option value="flowers">Flores</option></select>
        </div>}
        <PaintViewport className="art-paper-viewport" label={mode === 'free' ? 'Papel de desenho livre' : mode === 'color' ? PICTURE_NAMES[artwork.picture] : PIXEL_NAMES[artwork.pixelPicture]} resetKey={`${mode}:${mode === 'color' ? artwork.picture + artwork.seed : mode === 'pixels' ? artwork.pixelPicture + artwork.pixelSeed : 'free'}`} interaction={mode === 'free' ? 'draw' : 'tap'} onPaintTap={paintTap} onPaintStart={startStroke} onPaintMove={moveStroke} onPaintEnd={finishDraft} onPaintCancel={cancelDraft}>
          {mode === 'free' ? <canvas ref={canvasRef} width={600} height={600} className="art-free-canvas" aria-label="Papel para desenhar livremente com o dedo ou mouse" /> :
            <svg ref={svgRef} viewBox="0 0 600 600" className="art-coloring-svg" aria-label={mode === 'color' ? PICTURE_NAMES[artwork.picture] : PIXEL_NAMES[artwork.pixelPicture]}>
              <rect width="600" height="600" fill={PAPER} />
              {mode === 'color' ? <>
                {illustration.regions.map(region => region.kind === 'path' ? <path key={region.id} {...region.props} {...regionProps(region.id)} /> : region.kind === 'ellipse' ? <ellipse key={region.id} {...region.props} {...regionProps(region.id)} /> : <circle key={region.id} {...region.props} {...regionProps(region.id)} />)}
                {illustration.details.map((detail, i) => <path key={`detail-${i}`} d={detail} fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />)}
                <path d="M 247 558 Q 300 563 353 558" fill="none" stroke="#c6cbbb" strokeWidth="2" />
              </> : pixelGuide.map((row, y) => row.map((number, x) => {
                const id = `${x}:${y}`; const painted = artwork.pixels[id];
                return <g key={id}>
                  <rect x={12 + x * 24} y={12 + y * 24} width="24" height="24" fill={painted ?? (number ? '#e8e7dc' : PAPER)} stroke="#d9dacf" strokeWidth="0.65" data-art-region={id} data-unpainted={!painted ? 'true' : undefined} role="button" tabIndex={0} aria-label={`Pintar pixel linha ${y + 1}, coluna ${x + 1}${number ? `, sugestão cor ${number}` : ''}`} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); paint(id); } }} />
                  {numbers && number > 0 && !painted && <text x={24 + x * 24} y={28 + y * 24} textAnchor="middle" fill="#72786a" fontSize="10" fontFamily="sans-serif" pointerEvents="none">{number}</text>}
                </g>;
              }))}
            </svg>}
        </PaintViewport>
        <p className="game-note art-under-paper">{mode === 'free' ? 'Um rabisco também é arte. Principalmente se você disser que é um gato.' : mode === 'pixels' ? 'Os números são uma sugestão. Seu gato pode ser lilás.' : SCENE_BY_ID[artwork.picture].note}</p>
        <div className="art-other-ways">
          <button type="button" className="art-disclosure-button" aria-expanded={showOtherWays} aria-controls="art-other-modes" onClick={() => setShowOtherWays(value => !value)}>Outros jeitos de pintar <span aria-hidden="true">{showOtherWays ? '−' : '+'}</span></button>
          {showOtherWays && <div id="art-other-modes" className="segmented art-mode-switch" aria-label="Tipo de pintura">{([['color', 'Colorir'], ['pixels', 'Pixels'], ['free', 'Livre']] as const).map(([id, label]) => <button key={id} type="button" className={mode === id ? 'active' : ''} aria-pressed={mode === id} onClick={() => chooseMode(id)}>{label}</button>)}</div>}
          {mode !== 'color' && !showOtherWays && <button type="button" className="art-return-color" onClick={() => chooseMode('color')}>Voltar para Colorir</button>}
        </div>
      </div>
      <aside className="art-tools">
        <div className="art-tools-heading"><span className="art-eyebrow">Suas tintinhas</span><h3>Qual cor combina com agora?</h3></div>
        <label className="art-color-set"><span className="control-label">Conjunto de cores</span><select aria-label="Conjunto de cores" value={colorSet} onChange={event => setColorSet(event.target.value as ColorSet)}>{Object.entries(COLOR_SETS).map(([id, set]) => <option key={id} value={id}>{set.name}</option>)}</select></label>
        {colorSet === 'workshop' ? <Palette value={color} onChange={next => { setColor(next); setErase(false); }} /> : <div className="art-preset-palette" aria-label={selectedSet.name}>
          {selectedSet.colors.map((thread, i) => <button key={thread} type="button" style={{ backgroundColor: thread }} aria-pressed={color === thread} aria-label={`Cor ${i + 1} de ${selectedSet.name}`} onClick={() => { setColor(thread); setErase(false); }} />)}
          <label className="art-custom-color" title="Escolher outra cor">+<input type="color" value={color} onChange={event => { setColor(event.target.value); setErase(false); }} aria-label="Cor personalizada" /></label>
        </div>}
        {mode === 'pixels' && <>
          <label className="art-check"><input type="checkbox" checked={numbers} onChange={event => setNumbers(event.target.checked)} /> Mostrar números de referência</label>
          {numbers && <div className="art-number-key" aria-label="Cores dos números">{usedNumbers.map(number => <button key={number} type="button" style={{ backgroundColor: PALETTE[number - 1] }} aria-label={`Usar cor do número ${number}`} aria-pressed={color === PALETTE[number - 1]} onClick={() => { setColor(PALETTE[number - 1]); setErase(false); }}>{number}</button>)}</div>}
        </>}
        {mode === 'free' && <>
          <div className="art-brush-picker" aria-label="Material do pincel">
            {([['pen', 'Caneta', 'Traço firme'], ['chalk', 'Giz', 'Papel com textura'], ['watercolor', 'Aquarela', 'Camadas suaves']] as const).map(([id, label, hint]) => <button key={id} type="button" aria-pressed={brushKind === id} aria-label={`Pincel ${label}`} onClick={() => { finishDraft(); setBrushKind(id); setErase(false); }}>
              <span className={`art-brush-sample art-brush-sample-${id}`} aria-hidden="true" /><strong>{label}</strong><small>{hint}</small>
            </button>)}
          </div>
          <label className="art-brush-control"><span className="control-label">Tamanho do pincel <span>{brushSize}</span></span><input type="range" min="2" max="50" value={brushSize} aria-label="Tamanho do pincel" onChange={event => setBrushSize(Number(event.target.value))} /></label>
        </>}
        <div className="game-toolbar art-tool-buttons">
          <button type="button" className={`soft-button ${erase ? 'art-tool-active' : ''}`} aria-pressed={erase} onClick={() => setErase(value => !value)}>{erase ? 'Borracha ligada' : 'Borracha'}</button>
          <button type="button" className="soft-button" disabled={!past.length} onClick={undo}>Desfazer</button>
          <button type="button" className="soft-button" disabled={!future.length} onClick={redo}>Refazer</button>
          <button type="button" className="soft-button" onClick={clear}>Limpar papel</button>
          <button type="button" className="soft-button art-new-drawing" onClick={newDrawing}>{mode === 'free' ? 'Papel novo' : 'Outra versão'}</button>
        </div>
        <button type="button" className="primary-button art-save" disabled={saving} onClick={save}>{saving ? 'Guardando…' : 'Guardar na galeria'}</button>
        <p className="art-draft-note">O rascunho fica salvo neste aparelho. Pode ir buscar um café.</p>
        <p className="art-status" role="status" aria-live="polite">{notice}</p>
      </aside>
    </div>
  </div>;
}
