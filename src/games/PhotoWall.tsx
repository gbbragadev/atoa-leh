import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from 'react';
import type { Creation, GameProps } from '../lib/types';
import { readStored, usePersistentState } from '../lib/storage';
import { svgToDataUrl } from '../lib/art';
import { compressPhoto } from '../lib/photos';
import './photo-wall.css';

type Background = 'paper' | 'sage' | 'cork';
type Frame = 'polaroid' | 'tape' | 'arch';
type WallItem = { creationId: string; x: number; y: number; angle: number; frame: Frame; size: number; fit?: 'cover' | 'contain' };
type WallState = { version: 1; background: Background; items: WallItem[] };
type PhotoWallProps = GameProps & { creations?: Creation[] };
const MAX_ITEMS = 100;
const FRAME_NAMES: Record<Frame, string> = { polaroid: 'Instantânea', tape: 'Fita de papel', arch: 'Arco' };
const BACKGROUND_NAMES: Record<Background, string> = { paper: 'Papel claro', sage: 'Parede verde', cork: 'Cortiça' };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function arrangedItems(photos: Creation[]): WallItem[] {
  const count = Math.min(photos.length, MAX_ITEMS);
  const columns = count <= 3 ? count : count <= 8 ? 4 : 5;
  const rows = Math.ceil(count / Math.max(1, columns));
  const cellWidth = 790 / Math.max(1, columns), cellHeight = 570 / Math.max(1, rows);
  const size = clamp(Math.min(cellWidth / 205, cellHeight / 235), .4, 1.15);
  return photos.slice(0, MAX_ITEMS).map((photo, index) => ({
    creationId: photo.id, x: 55 + cellWidth * (index % columns + .5), y: 70 + cellHeight * (Math.floor(index / columns) + .5),
    angle: [-5, 3, -2, 6, -4][index % 5], frame: (['polaroid', 'tape', 'arch'] as Frame[])[index % 3], size,
  }));
}

export default function PhotoWall({ creations = [], onSave }: PhotoWallProps) {
  const photos = creations.filter(creation => creation.kind === 'photo');
  const canInitialize = useRef(readStored<WallState | null>('photo-wall', null) === null);
  const [wall, setWall] = usePersistentState<WallState>('photo-wall', () => ({ version: 1, background: 'paper', items: arrangedItems(photos.slice(0, 12)) }));
  const wallRef = useRef(wall); wallRef.current = wall;
  const pendingPhotos = useRef(new Set<string>());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [past, setPast] = useState<WallState[]>([]);
  const [message, setMessage] = useState('Um lugar para os pequenos momentos. Até o gato saindo borrado merece uma moldura.');
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ pointerId: number; creationId: string; startX: number; startY: number; originX: number; originY: number; before: WallState; moved: boolean } | null>(null);
  const selected = wall.items.find(item => item.creationId === selectedId);
  const photoMap = new Map(photos.map(photo => [photo.id, photo]));
  const visibleItems = wall.items.filter(item => photoMap.has(item.creationId));

  function remember(before: WallState) { setPast(history => [...history.slice(-39), before]); }
  function change(next: WallState, withUndo = true) {
    if (withUndo) remember(wallRef.current);
    wallRef.current = next; setWall(next);
  }
  function editSelected(update: Partial<WallItem>) {
    if (!selectedId) return;
    change({ ...wallRef.current, items: wallRef.current.items.map(item => item.creationId === selectedId ? { ...item, ...update } : item) });
  }
  function addPhoto(photo: Creation) {
    const current = wallRef.current;
    if (current.items.some(item => item.creationId === photo.id)) { setSelectedId(photo.id); return; }
    if (current.items.length >= MAX_ITEMS) { setMessage('Este mural já tem 100 fotos. Retire uma moldura para abrir espaço; a foto continua na galeria.'); return; }
    const item: WallItem = { creationId: photo.id, x: 450 + ((current.items.length % 5) - 2) * 28, y: 340 + ((current.items.length % 3) - 1) * 25, angle: [-4, 3, 0][current.items.length % 3], frame: 'polaroid', size: .85 };
    change({ ...current, items: [...current.items, item] }); setSelectedId(photo.id);
  }

  useEffect(() => {
    if (canInitialize.current && photos.length) {
      canInitialize.current = false;
      if (!wallRef.current.items.length) change({ ...wallRef.current, items: arrangedItems(photos.slice(0, 12)) }, false);
    }
    const arrivals = photos.filter(photo => pendingPhotos.current.has(photo.dataUrl));
    if (!arrivals.length) return;
    const current = wallRef.current;
    const additions = arrivals.filter(photo => !current.items.some(item => item.creationId === photo.id)).slice(0, MAX_ITEMS - current.items.length);
    arrivals.forEach(photo => pendingPhotos.current.delete(photo.dataUrl));
    if (additions.length) {
      remember(current);
      const next = { ...current, items: [...current.items, ...additions.map((photo, index) => ({ creationId: photo.id, x: 450 + index % 4 * 25, y: 350 + index % 3 * 25, angle: [-3, 4, 0][index % 3], frame: 'polaroid' as Frame, size: .85 }))] };
      wallRef.current = next; setWall(next); setSelectedId(additions[additions.length - 1].id);
    }
    else if (arrivals.some(photo => current.items.some(item => item.creationId === photo.id))) setSelectedId(arrivals[arrivals.length - 1].id);
  }, [creations, setWall]);

  function point(event: PointerEvent<SVGSVGElement | SVGGElement>) {
    const svg = svgRef.current;
    if (!svg) return { x: 450, y: 350 };
    const matrix = svg.getScreenCTM();
    if (matrix) { const p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY; const transformed = p.matrixTransform(matrix.inverse()); return { x: transformed.x, y: transformed.y }; }
    const rect = svg.getBoundingClientRect(); return { x: (event.clientX - rect.left) / rect.width * 900, y: (event.clientY - rect.top) / rect.height * 700 };
  }
  function beginDrag(event: PointerEvent<SVGGElement>, item: WallItem) {
    if (!event.isPrimary || event.button !== 0) return;
    event.stopPropagation(); const p = point(event); setSelectedId(item.creationId);
    drag.current = { pointerId: event.pointerId, creationId: item.creationId, startX: p.x, startY: p.y, originX: item.x, originY: item.y, before: wallRef.current, moved: false };
    svgRef.current?.setPointerCapture(event.pointerId);
  }
  function moveDrag(event: PointerEvent<SVGSVGElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const p = point(event); if (Math.abs(p.x - active.startX) + Math.abs(p.y - active.startY) > 3) active.moved = true;
    if (!active.moved) return;
    const next = { ...wallRef.current, items: wallRef.current.items.map(item => item.creationId === active.creationId ? { ...item, x: clamp(active.originX + p.x - active.startX, 0, 900), y: clamp(active.originY + p.y - active.startY, 0, 700) } : item) };
    wallRef.current = next; setWall(next);
  }
  function endDrag(event: PointerEvent<SVGSVGElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    if (drag.current.moved) remember(drag.current.before);
    drag.current = null;
    if (svgRef.current?.hasPointerCapture(event.pointerId)) svgRef.current.releasePointerCapture(event.pointerId);
  }
  async function importFiles(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget, files = Array.from(input.files ?? []); input.value = '';
    if (!files.length || importing) return;
    setImporting(true); let saved = 0; const errors: string[] = [];
    for (const file of files.slice(0, MAX_ITEMS)) {
      try {
        setMessage(`Preparando foto ${saved + errors.length + 1} de ${Math.min(files.length, MAX_ITEMS)}…`);
        const dataUrl = await compressPhoto(file); pendingPhotos.current.add(dataUrl);
        try { await onSave({ kind: 'photo', title: 'Foto da Leh', dataUrl, display: 'frame', version: 1 }); saved++; }
        catch (error) { pendingPhotos.current.delete(dataUrl); throw error; }
      } catch (error) { errors.push(error instanceof Error ? error.message : 'Não consegui guardar essa foto. Tente novamente.'); }
    }
    setImporting(false);
    setMessage([saved ? `${saved === 1 ? 'Foto guardada' : `${saved} fotos guardadas`}. Arraste as molduras para deixar do seu jeitinho.` : '', ...errors.slice(0, 2), files.length > MAX_ITEMS ? 'Escolha até 100 fotos por vez.' : ''].filter(Boolean).join(' '));
  }
  async function saveWall() {
    if (!svgRef.current || saving || !visibleItems.length) return;
    setSaving(true);
    try {
      const copy = svgRef.current.cloneNode(true) as SVGSVGElement;
      copy.querySelectorAll('[data-export-hide]').forEach(element => element.remove());
      const dataUrl = await svgToDataUrl(copy);
      await onSave({ kind: 'photowall', title: 'Meu mural de momentos', dataUrl, display: 'frame', version: 1 });
      setMessage('Mural guardado na sua galeria. O gato aprovou. Aparentemente.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não consegui guardar o mural. Tente novamente.'); }
    finally { setSaving(false); }
  }
  function arrange() {
    const presentPhotos = wallRef.current.items.map(item => photoMap.get(item.creationId)).filter((photo): photo is Creation => Boolean(photo));
    const original = new Map(wallRef.current.items.map(item => [item.creationId, item]));
    change({ ...wallRef.current, items: arrangedItems(presentPhotos).map(item => ({ ...item, frame: original.get(item.creationId)?.frame ?? item.frame, fit: original.get(item.creationId)?.fit ?? 'cover' })) });
    setMessage('Uma arrumadinha no mural. As fotos continuam livres para mudar de lugar.');
  }

  return <section className="photo-wall-game" aria-label="Mural de momentos">
    <div className="photo-wall-intro"><div><span className="control-label">Reprodução por foto</span><h2>Fotografar minha peça</h2><p>Uma foto do pratinho, outra da flor, um detalhe bem de pertinho. Seu pequeno museu do cotidiano.</p></div><svg viewBox="0 0 70 70" width="62" height="62" aria-hidden="true"><path d="M12 23h12l5-8h15l5 8h9v32H12z" fill="#e5c46b" stroke="#625e4c" strokeWidth="2" strokeLinejoin="round"/><circle cx="35" cy="39" r="12" fill="#fff8e8" stroke="#625e4c" strokeWidth="2"/><circle cx="35" cy="39" r="7" fill="#8d9e88"/><circle cx="51" cy="28" r="2" fill="#625e4c"/></svg></div>
    <div className="game-toolbar photo-wall-imports">
      <label className={`primary-button photo-wall-file ${importing ? 'is-disabled' : ''}`}><span>{importing ? 'Preparando fotos…' : 'Câmera'}</span><input aria-label="Fotografar para o mural" type="file" accept="image/*" capture="environment" disabled={importing} onChange={importFiles}/></label>
      <label className={`soft-button photo-wall-file ${importing ? 'is-disabled' : ''}`}><span>Galeria do iPhone</span><input aria-label="Escolher fotos da galeria" type="file" accept="image/*" multiple disabled={importing} onChange={importFiles}/></label>
    </div>
    <p className="game-note photo-wall-import-note">As fotos ficam neste navegador. Escolha JPEG, PNG ou WebP, com até 15 MB por foto. Para vários ângulos, é só fotografar de novo.</p>
    {!visibleItems.length && photos.length > 0 && <button className="soft-button" onClick={() => change({ ...wallRef.current, items: arrangedItems(photos.slice(0, 12)) })}>Colocar minhas fotos</button>}
    <div className="photo-wall-backgrounds" role="group" aria-label="Fundo do mural">{(['paper', 'sage', 'cork'] as Background[]).map(background => <button key={background} className={`soft-button photo-wall-background photo-wall-background-${background}`} aria-pressed={wall.background === background} onClick={() => change({ ...wallRef.current, background })}><span aria-hidden="true"/>{BACKGROUND_NAMES[background]}</button>)}</div>
    <div className="photo-wall-stage-wrap">
      <svg ref={svgRef} className="game-canvas photo-wall-stage" viewBox="0 0 900 700" data-wall-count={visibleItems.length} data-wall-background={wall.background} role="img" aria-label={`Mural com ${visibleItems.length} fotos. Toque em uma moldura para selecionar e arraste para mover.`} onPointerDown={() => setSelectedId(null)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={() => { const active = drag.current; if (active?.moved) remember(active.before); drag.current = null; }}>
        <defs><pattern id="wall-paper-grain" width="47" height="53" patternUnits="userSpaceOnUse"><circle cx="4" cy="9" r=".8" fill="#7e7761" opacity=".13"/><path d="M21 32h3M36 16h2" stroke="#7e7761" strokeWidth=".7" opacity=".1"/></pattern><pattern id="wall-cork-grain" width="38" height="42" patternUnits="userSpaceOnUse"><path d="M4 3l6 2M23 17l4 3M9 31l5-2M32 37l2-3" stroke="#855f40" strokeWidth="2" opacity=".18"/><circle cx="19" cy="7" r="2" fill="#d4ad7a" opacity=".6"/></pattern></defs>
        <rect width="900" height="700" rx="22" fill={wall.background === 'paper' ? '#f7f0df' : wall.background === 'sage' ? '#bdc9b1' : '#bf9567'}/>
        <rect width="900" height="700" rx="22" fill={wall.background === 'cork' ? 'url(#wall-cork-grain)' : 'url(#wall-paper-grain)'}/>
        <path d="M24 668q26-16 40-2t38-3M799 28q28 13 46 0" fill="none" stroke={wall.background === 'cork' ? '#ebd7b6' : '#989f80'} strokeWidth="2" opacity=".45"/>
        {!visibleItems.length && <g data-export-hide="true" fill="#5f6855" textAnchor="middle"><path d="M400 271h29l12-17h40l12 17h12v69H400z" fill="none" stroke="#5f6855" strokeWidth="3"/><circle cx="452" cy="307" r="19" fill="none" stroke="#5f6855" strokeWidth="3"/><text x="450" y="389" fontSize="24" fontFamily="Georgia,serif">Tem espaço para as suas histórias.</text><text x="450" y="426" fontSize="18" fontFamily="Arial,sans-serif">Abra a câmera ou escolha uma foto.</text></g>}
        {visibleItems.map((item, index) => {
          const photo = photoMap.get(item.creationId)!; const clip = `wall-photo-clip-${index}`;
          const isSelected = item.creationId === selectedId;
          return <g key={item.creationId} data-photo-card={item.creationId} data-photo-frame={item.frame} transform={`translate(${item.x} ${item.y}) rotate(${item.angle}) scale(${item.size})`} onPointerDown={event => beginDrag(event, item)} style={{ cursor: drag.current ? 'grabbing' : 'grab' }}>
            <defs><clipPath id={clip}>{item.frame === 'arch' ? <path d="M-81 75V-22a81 81 0 0 1 162 0V75z"/> : <rect x="-81" y={item.frame === 'tape' ? -83 : -95} width="162" height={item.frame === 'tape' ? 166 : 152} rx={item.frame === 'tape' ? 2 : 0}/>}</clipPath></defs>
            <rect x="-89" y="-100" width="184" height="213" rx="3" fill="#493c2b" opacity=".14" transform="translate(3 4)"/>
            {item.frame === 'arch' ? <path d="M-92 96V-22a92 92 0 0 1 184 0V96z" fill="#f4e9d0"/> : <rect x="-92" y={item.frame === 'tape' ? -93 : -107} width="184" height={item.frame === 'tape' ? 188 : 214} rx="3" fill="#fffdf2"/>}
            <image href={photo.dataUrl} x="-81" y={item.frame === 'arch' ? -104 : item.frame === 'tape' ? -83 : -95} width="162" height={item.frame === 'arch' ? 180 : item.frame === 'tape' ? 166 : 152} preserveAspectRatio={item.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'} clipPath={`url(#${clip})`}/>
            {item.frame === 'polaroid' && <><path d="M-46 80q35-5 77-1" stroke="#bdad92" strokeWidth="1" fill="none"/><path d="M43 74c-5-9-15 0-2 9 13-9 4-18 0-9" fill="#c78e82" opacity=".7"/></>}
            {item.frame === 'tape' && <><path d="M-47-102l94 2-3 24-91-2z" fill="#e3cb82" opacity=".78"/><path d="M-50 83l92 5-1 21-95-7z" fill="#b6bd9e" opacity=".82"/></>}
            {item.frame === 'arch' && <path d="M-58 86h116" stroke="#b5ac8d" strokeWidth="1"/>}
            {isSelected && <rect data-export-hide="true" x="-100" y="-116" width="200" height="232" rx="7" fill="none" stroke="#547659" strokeWidth="3" strokeDasharray="6 5"/>}
          </g>;
        })}
      </svg>
    </div>
    <p className="game-note photo-wall-gesture-note">Toque na foto para escolher. Arraste a moldura para qualquer cantinho.</p>
    {selected && <div className="photo-wall-editor" aria-label="Editar moldura selecionada">
      <div className="photo-wall-frame-options" role="group" aria-label="Moldura">{(['polaroid', 'tape', 'arch'] as Frame[]).map(frame => <button className="soft-button" key={frame} aria-pressed={selected.frame === frame} onClick={() => editSelected({ frame })}>{FRAME_NAMES[frame]}</button>)}</div>
      <div className="photo-wall-adjustments"><label>Giro <input type="range" min="-30" max="30" step="1" value={selected.angle} onChange={event => editSelected({ angle: Number(event.target.value) })}/><output>{Math.round(selected.angle)}°</output></label><label>Tamanho <input type="range" min=".4" max="1.5" step=".05" value={selected.size} onChange={event => editSelected({ size: Number(event.target.value) })}/><output>{Math.round(selected.size * 100)}%</output></label></div>
      <div className="game-toolbar"><button className="soft-button" aria-pressed={selected.fit === 'contain'} onClick={() => editSelected({ fit: selected.fit === 'contain' ? 'cover' : 'contain' })}>{selected.fit === 'contain' ? 'Preencher moldura' : 'Ver foto inteira'}</button><button className="soft-button" onClick={() => { const current = wallRef.current; change({ ...current, items: [...current.items.filter(item => item.creationId !== selectedId), selected] }); }}>Trazer para frente</button><button className="soft-button" onClick={() => { change({ ...wallRef.current, items: wallRef.current.items.filter(item => item.creationId !== selectedId) }); setSelectedId(null); setMessage('Moldura retirada. A foto continua guardada na galeria.'); }}>Retirar do mural</button></div>
    </div>}
    <div className="game-toolbar photo-wall-actions"><button className="soft-button" disabled={!past.length} onClick={() => { const previous = past[past.length - 1]; if (!previous) return; wallRef.current = previous; setWall(previous); setPast(history => history.slice(0, -1)); }}>Desfazer</button><button className="soft-button" disabled={!visibleItems.length} onClick={arrange}>Arrumar mural</button><button className="primary-button" disabled={saving || !visibleItems.length} onClick={saveWall}>{saving ? 'Guardando…' : 'Guardar mural'}</button></div>
    <p className="game-note photo-wall-status" role="status" aria-live="polite">{message}</p>
    {photos.length > 0 && <details className="photo-wall-gallery"><summary>Suas fotos <span>{photos.length}</span></summary><p className="game-note">Toque para colocar no mural. Uma foto também pode ficar só na galeria.</p><div className="photo-wall-thumbnails">{photos.map((photo, index) => <button className="photo-wall-thumbnail" key={photo.id} onClick={() => addPhoto(photo)} aria-label={`Colocar foto ${index + 1} no mural`} aria-pressed={wall.items.some(item => item.creationId === photo.id)}><img src={photo.dataUrl} alt={`Foto ${index + 1} da sua galeria`} loading="lazy"/><span>{wall.items.some(item => item.creationId === photo.id) ? 'No mural' : 'Colocar'}</span></button>)}</div></details>}
  </section>;
}
