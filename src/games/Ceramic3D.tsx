import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ArrowCounterClockwise, ArrowClockwise, FloppyDisk, Hand, ArrowsClockwise, Flower, ArrowLeft, ArrowRight } from '@phosphor-icons/react';
import type { GameProps } from '../lib/types';
import { usePersistentState } from '../lib/storage';
import {
  CERAMIC_COLORS, CERAMIC_PRESETS, CERAMIC_PATTERN_IDS, CERAMIC_PATTERN_LABELS,
  clamp, createCeramicDraft, normalizeCeramicDraft, radiusAt, sculptProfile,
  type CeramicDraft, type CeramicPattern, type CeramicStamp, type SculptTool,
} from './Ceramic3D.logic';
import './ceramic-3d.css';

type Mode = 'sculpt' | 'rotate' | 'stamp';
type WebglState = 'starting' | 'ready' | 'unavailable' | 'lost';
type Runtime = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  piece: THREE.Group;
  body: THREE.Mesh;
  material: THREE.MeshPhysicalMaterial;
  workbench: THREE.Group;
  geometryKey: string;
  paintKey: string;
  render: () => void;
};
const TOOL_LABELS: Record<SculptTool, string> = { widen: 'Alargar', narrow: 'Afinar', smooth: 'Alisar', wave: 'Ondular' };
const STAMP_LABELS: Record<CeramicStamp['type'], string> = { flower: 'Flor', paw: 'Patinha', leaf: 'Folha', heart: 'Coração' };
const modAngle = (angle: number) => ((angle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

function stampDrawing(ctx: CanvasRenderingContext2D, type: CeramicStamp['type'], color: string, x: number, y: number, size: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size, size); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = .075;
  if (type === 'flower') {
    for (let index = 0; index < 6; index++) { ctx.save(); ctx.rotate(index * Math.PI / 3); ctx.beginPath(); ctx.ellipse(0, -.4, .19, .36, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    ctx.beginPath(); ctx.arc(0, 0, .2, 0, Math.PI * 2); ctx.fill();
  } else if (type === 'paw') {
    ctx.beginPath(); ctx.ellipse(0, .2, .42, .31, 0, 0, Math.PI * 2); ctx.fill();
    for (const [px, py] of [[-.39, -.2], [-.15, -.4], [.15, -.4], [.39, -.2]]) { ctx.beginPath(); ctx.ellipse(px, py, .13, .17, px * .8, 0, Math.PI * 2); ctx.fill(); }
  } else if (type === 'leaf') {
    ctx.beginPath(); ctx.moveTo(-.5, .5); ctx.bezierCurveTo(-.65, -.2, .15, -.65, .55, -.55); ctx.bezierCurveTo(.65, .15, -.1, .75, -.5, .5); ctx.fill();
    ctx.globalAlpha *= .6; ctx.strokeStyle = '#f8f0df'; ctx.beginPath(); ctx.moveTo(-.45, .45); ctx.lineTo(.37, -.37); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(0, .64); ctx.bezierCurveTo(-1, -.05, -.65, -.9, 0, -.36); ctx.bezierCurveTo(.65, -.9, 1, -.05, 0, .64); ctx.fill();
  }
  ctx.restore();
}

function glazeTexture(draft: CeramicDraft): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível preparar a pintura.');
  const width = canvas.width, height = canvas.height;
  ctx.fillStyle = draft.color; ctx.fillRect(0, 0, width, height);
  let seed = 1107;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  ctx.fillStyle = '#624733'; ctx.globalAlpha = .045;
  for (let dot = 0; dot < 1900; dot++) { const x = random() * width, y = random() * height; ctx.fillRect(x, y, 1 + random() * 2, 1 + random() * 2); }
  ctx.globalAlpha = 1; ctx.fillStyle = draft.patternColor; ctx.strokeStyle = draft.patternColor;
  if (draft.pattern === 'speckles') {
    ctx.globalAlpha = .65;
    for (let dot = 0; dot < 390; dot++) { ctx.beginPath(); ctx.ellipse(random() * width, random() * height, 1 + random() * 4, 1 + random() * 3, random() * Math.PI, 0, Math.PI * 2); ctx.fill(); }
  } else if (draft.pattern === 'stripes') {
    ctx.globalAlpha = .8;
    for (let row = 0; row < 7; row++) { const y = 80 + row * 150; ctx.fillRect(0, y, width, 22); ctx.globalAlpha = .4; ctx.fillRect(0, y + 35, width, 5); ctx.globalAlpha = .8; }
  } else if (draft.pattern === 'waves') {
    ctx.globalAlpha = .85; ctx.lineWidth = 13;
    for (let row = 0; row < 8; row++) { ctx.beginPath(); for (let x = 0; x <= width; x += 4) { const y = row * 144 + Math.sin(x / width * Math.PI * 12) * 20; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); }
  } else if (draft.pattern === 'petals' || draft.pattern === 'leaves') {
    ctx.globalAlpha = .83;
    for (let row = 0; row < 5; row++) for (let column = -1; column < 8; column++) stampDrawing(ctx, draft.pattern === 'petals' ? 'flower' : 'leaf', draft.patternColor, column * 146 + (row % 2) * 73, 95 + row * 208, draft.pattern === 'petals' ? 40 : 45);
  } else if (draft.pattern === 'dots') {
    ctx.globalAlpha = .75;
    for (let row = 0; row < 10; row++) for (let column = -1; column < 12; column++) { ctx.beginPath(); ctx.arc(column * 102 + (row % 2) * 51, 52 + row * 105, 12, 0, Math.PI * 2); ctx.fill(); }
  } else if (draft.pattern === 'patchwork') {
    for (let row = 0; row < 6; row++) for (let column = 0; column < 8; column++) { ctx.globalAlpha = (row + column) % 2 ? .16 : .55; ctx.fillRect(column * 128 + 5, row * 171 + 6, 117, 158); ctx.globalAlpha = .7; ctx.lineWidth = 2; ctx.strokeRect(column * 128 + 11, row * 171 + 12, 105, 145); }
  } else if (draft.pattern === 'arches') {
    ctx.globalAlpha = .75; ctx.lineWidth = 10;
    for (let row = 0; row < 6; row++) for (let column = -1; column < 9; column++) { const x = column * 128 + (row % 2) * 64, y = row * 175 + 50; ctx.beginPath(); ctx.arc(x, y, 44, Math.PI, 0); ctx.lineTo(x + 44, y + 44); ctx.moveTo(x - 44, y); ctx.lineTo(x - 44, y + 44); ctx.stroke(); }
  }
  ctx.globalAlpha = 1;
  for (const stamp of draft.stamps) {
    const x = stamp.u * width, y = (1 - stamp.v) * height, size = stamp.size * height;
    for (const offset of [-width, 0, width]) stampDrawing(ctx, stamp.type, stamp.color, x + offset, y, size);
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = THREE.RepeatWrapping; texture.anisotropy = 4;
  return texture;
}

/** A continuous section: underside, outer wall, lip, inner wall, inner floor. */
function vesselGeometry(draft: CeramicDraft): THREE.LatheGeometry {
  const thickness = .075, base = Math.min(.085, draft.height * .19);
  const preset = CERAMIC_PRESETS.find(item => item.id === draft.preset)!;
  const innerFloor = Math.max(base / draft.height, preset.floor ?? 0);
  const section = [new THREE.Vector2(0, 0), new THREE.Vector2(draft.profile[0], 0)];
  draft.profile.forEach((radius, index) => { if (index) section.push(new THREE.Vector2(radius, index / (draft.profile.length - 1) * draft.height)); });
  const top = draft.profile.at(-1)!;
  section.push(new THREE.Vector2(top - thickness / 2, draft.height + .012));
  section.push(new THREE.Vector2(Math.max(.08, top - thickness), draft.height));
  for (let index = draft.profile.length - 2; index >= 0; index--) {
    const t = index / (draft.profile.length - 1);
    if (t <= innerFloor) break;
    section.push(new THREE.Vector2(Math.max(.08, draft.profile[index] - thickness), t * draft.height));
  }
  section.push(new THREE.Vector2(Math.max(.08, radiusAt(draft.profile, innerFloor) - thickness), innerFloor * draft.height));
  section.push(new THREE.Vector2(0, innerFloor * draft.height));
  const geometry = new THREE.LatheGeometry(section, 64);
  const positions = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
  for (let index = 0; index < positions.count; index++) uv.setY(index, clamp(positions.getY(index) / draft.height, 0, 1));
  geometry.translate(0, -draft.height / 2, 0); geometry.computeBoundingSphere();
  return geometry;
}

function handleGeometry(draft: CeramicDraft): THREE.TubeGeometry {
  const h = draft.height, low = .25, high = .78;
  const bottomRadius = radiusAt(draft.profile, low), topRadius = radiusAt(draft.profile, high);
  const out = Math.max(bottomRadius, topRadius) + .45;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(topRadius - .025, (high - .5) * h, 0),
    new THREE.Vector3(out, (.73 - .5) * h, 0),
    new THREE.Vector3(out + .04, (.47 - .5) * h, 0),
    new THREE.Vector3(out - .1, (.26 - .5) * h, 0),
    new THREE.Vector3(bottomRadius - .025, (low - .5) * h, 0),
  ]);
  return new THREE.TubeGeometry(curve, 36, .065, 10, false);
}

function syncPiece(runtime: Runtime, draft: CeramicDraft) {
  const geometryKey = JSON.stringify([draft.preset, draft.profile, draft.height]);
  if (geometryKey !== runtime.geometryKey) {
    for (const child of [...runtime.piece.children]) { runtime.piece.remove(child); if (child instanceof THREE.Mesh) child.geometry.dispose(); }
    const body = new THREE.Mesh(vesselGeometry(draft), runtime.material); body.castShadow = true; body.receiveShadow = true;
    runtime.piece.add(body); runtime.body = body;
    const preset = CERAMIC_PRESETS.find(item => item.id === draft.preset)!;
    if (preset.handle || draft.preset === 'amphora') {
      const handle = new THREE.Mesh(handleGeometry(draft), runtime.material); handle.castShadow = true; handle.receiveShadow = true; runtime.piece.add(handle);
      if (draft.preset === 'amphora') { const second = new THREE.Mesh(handleGeometry(draft), runtime.material); second.rotation.y = Math.PI; second.castShadow = true; runtime.piece.add(second); }
    }
    runtime.workbench.position.y = -draft.height / 2 - .065;
    runtime.geometryKey = geometryKey;
  }
  const paintKey = JSON.stringify([draft.color, draft.patternColor, draft.pattern, draft.stamps]);
  if (paintKey !== runtime.paintKey) { runtime.material.map?.dispose(); runtime.material.map = glazeTexture(draft); runtime.material.needsUpdate = true; runtime.paintKey = paintKey; }
  runtime.material.roughness = draft.finish === 'glossy' ? .23 : .83;
  runtime.material.clearcoat = draft.finish === 'glossy' ? .75 : .05;
  runtime.material.clearcoatRoughness = draft.finish === 'glossy' ? .17 : .75;
  const maxRadius = Math.max(...draft.profile) + (draft.preset === 'mug' || draft.preset === 'pitcher' || draft.preset === 'amphora' ? .5 : 0);
  const verticalFov = runtime.camera.fov * Math.PI / 180;
  const fittingFov = Math.min(verticalFov, 2 * Math.atan(Math.tan(verticalFov / 2) * runtime.camera.aspect));
  const distance = Math.max(3.35, (Math.hypot(draft.height / 2 + .025, maxRadius) + .06) / Math.sin(fittingFov / 2) * 1.08);
  runtime.camera.position.set(Math.sin(draft.view.azimuth) * Math.cos(draft.view.elevation) * distance, Math.sin(draft.view.elevation) * distance, Math.cos(draft.view.azimuth) * Math.cos(draft.view.elevation) * distance);
  runtime.camera.lookAt(0, -.06, 0); runtime.camera.updateMatrixWorld(); runtime.render();
}

export default function Ceramic3D({ onSave }: GameProps) {
  const [stored, setStored] = usePersistentState<CeramicDraft>('ceramic-3d', createCeramicDraft);
  const draft = normalizeCeramicDraft(stored);
  const draftRef = useRef(draft); draftRef.current = draft;
  const canvasRef = useRef<HTMLCanvasElement>(null), stageRef = useRef<HTMLDivElement>(null), runtimeRef = useRef<Runtime | null>(null);
  const [webgl, setWebgl] = useState<WebglState>('starting');
  const [mode, setMode] = useState<Mode>('sculpt'), [tool, setTool] = useState<SculptTool>('widen');
  const [intensity, setIntensity] = useState(.55), [brushRadius, setBrushRadius] = useState(.2), [band, setBand] = useState(.5);
  const [stamp, setStamp] = useState<CeramicStamp['type']>('flower'), [stampSize, setStampSize] = useState(.065);
  const [history, setHistory] = useState<CeramicDraft[]>([]), [future, setFuture] = useState<CeramicDraft[]>([]);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const optionsRef = useRef({ mode, tool, intensity, brushRadius, stamp, stampSize }); optionsRef.current = { mode, tool, intensity, brushRadius, stamp, stampSize };
  const changeRef = useRef<(next: CeramicDraft) => void>(() => {}), checkpointRef = useRef<() => void>(() => {});
  const gestureRef = useRef<{ id: number; x: number; y: number; height: number | null; mode: Mode; started: boolean } | null>(null);
  const replace = (next: CeramicDraft) => { const safe = normalizeCeramicDraft(next); draftRef.current = safe; setStored(safe); };
  const checkpoint = () => { const snapshot = draftRef.current; setHistory(old => [...old.slice(-39), snapshot]); setFuture([]); setNotice(''); };
  const change = (next: CeramicDraft) => { checkpoint(); replace(next); };
  changeRef.current = replace; checkpointRef.current = checkpoint;
  const undo = () => { if (!history.length) return; const next = history.at(-1)!, current = draftRef.current; setFuture(old => [...old.slice(-39), current]); setHistory(old => old.slice(0, -1)); replace(next); setNotice('Último gesto desfeito.'); };
  const redo = () => { if (!future.length) return; const next = future.at(-1)!, current = draftRef.current; setHistory(old => [...old.slice(-39), current]); setFuture(old => old.slice(0, -1)); replace(next); setNotice('Gesto refeito.'); };

  useEffect(() => {
    const canvas = canvasRef.current, stage = stageRef.current;
    if (!canvas || !stage) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' }); }
    catch { setWebgl('unavailable'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.32;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor(0xffffff, 0);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, .1, 40);
    scene.add(new THREE.HemisphereLight('#fff3dc', '#b7aa91', 2.2));
    const key = new THREE.DirectionalLight('#fff6e5', 3.3); key.position.set(-3, 5, 4); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -3; key.shadow.camera.right = 3; key.shadow.camera.top = 3; key.shadow.camera.bottom = -3; key.shadow.normalBias = .035; key.shadow.bias = -.0004;
    scene.add(key); const fill = new THREE.DirectionalLight('#e9edff', 1.8); fill.position.set(4, 2, -3); scene.add(fill);
    const material = new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: .83, clearcoat: .05, side: THREE.DoubleSide });
    const piece = new THREE.Group(), workbench = new THREE.Group(); scene.add(piece, workbench);
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: '#c9b69b', roughness: .92 });
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.68, .12, 80), wheelMaterial); wheel.receiveShadow = true; wheel.castShadow = true; workbench.add(wheel);
    const ringMaterial = new THREE.MeshStandardMaterial({ color: '#dac9ad', roughness: .9 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.42, .011, 6, 72), ringMaterial); ring.rotation.x = Math.PI / 2; ring.position.y = .064; workbench.add(ring);
    const floorMaterial = new THREE.ShadowMaterial({ color: '#564130', opacity: .15 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), floorMaterial); floor.rotation.x = -Math.PI / 2; floor.position.y = -.09; floor.receiveShadow = true; workbench.add(floor);
    let frame = 0, alive = true;
    const render = () => { if (!alive || frame) return; frame = requestAnimationFrame(() => { frame = 0; if (alive && !renderer.getContext().isContextLost()) renderer.render(scene, camera); }); };
    const runtime: Runtime = { renderer, scene, camera, piece, body: new THREE.Mesh(), material, workbench, geometryKey: '', paintKey: '', render };
    runtimeRef.current = runtime;
    const resize = () => { const bounds = stage.getBoundingClientRect(); if (!bounds.width || !bounds.height) return; renderer.setSize(bounds.width, bounds.height, false); camera.aspect = bounds.width / bounds.height; camera.updateProjectionMatrix(); syncPiece(runtime, draftRef.current); };
    const observer = new ResizeObserver(resize); observer.observe(stage); resize(); syncPiece(runtime, draftRef.current); setWebgl('ready');
    const raycaster = new THREE.Raycaster(), point = new THREE.Vector2();
    const hit = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect(); point.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
      raycaster.setFromCamera(point, camera); return raycaster.intersectObject(runtime.body, false)[0];
    };
    const sculpt = (height: number, amount: number) => {
      const current = draftRef.current, options = optionsRef.current;
      changeRef.current({ ...current, profile: sculptProfile(current.profile, height, options.brushRadius, options.intensity, amount, options.tool) }); setBand(height);
    };
    const pointerDown = (event: PointerEvent) => {
      if (gestureRef.current || renderer.getContext().isContextLost() || event.button !== 0) return;
      const selected = optionsRef.current.mode, intersection = selected === 'rotate' ? null : hit(event);
      if (selected !== 'rotate' && !intersection) return;
      event.preventDefault(); canvas.setPointerCapture(event.pointerId);
      const height = intersection ? clamp((intersection.point.y + draftRef.current.height / 2) / draftRef.current.height, 0, 1) : null;
      gestureRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, height, mode: selected, started: selected !== 'rotate' };
      if (selected === 'sculpt' && height !== null) { checkpointRef.current(); sculpt(height, .035); }
      if (selected === 'stamp' && intersection?.uv) {
        const current = draftRef.current;
        if (current.stamps.length >= 120) { setNotice('A peça já está cheia de carinho. Desfaça um carimbo para abrir espaço.'); return; }
        checkpointRef.current(); const options = optionsRef.current;
        changeRef.current({ ...current, stamps: [...current.stamps, { u: clamp(intersection.uv.x, 0, 1), v: clamp(intersection.uv.y, 0, 1), type: options.stamp, color: current.patternColor, size: options.stampSize }] });
      }
    };
    const pointerMove = (event: PointerEvent) => {
      const gesture = gestureRef.current; if (!gesture || gesture.id !== event.pointerId) return;
      event.preventDefault(); const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      if (gesture.mode === 'rotate') {
        if (!gesture.started && Math.abs(dx) + Math.abs(dy) > 0) { checkpointRef.current(); gesture.started = true; }
        const current = draftRef.current; changeRef.current({ ...current, view: { azimuth: modAngle(current.view.azimuth - dx * .012), elevation: clamp(current.view.elevation + dy * .007, .12, 1.1) } });
      } else if (gesture.mode === 'sculpt') {
        const intersection = hit(event);
        const height = intersection ? clamp((intersection.point.y + draftRef.current.height / 2) / draftRef.current.height, 0, 1) : gesture.height;
        if (height !== null && Math.abs(dx) + Math.abs(dy) > .3) { sculpt(height, Math.min(.07, (Math.abs(dx) + Math.abs(dy) * .4) / canvas.clientWidth * 1.2 + .005)); gesture.height = height; }
      }
      gesture.x = event.clientX; gesture.y = event.clientY;
    };
    const pointerUp = (event: PointerEvent) => { if (gestureRef.current?.id !== event.pointerId) return; gestureRef.current = null; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); };
    const lost = (event: Event) => { event.preventDefault(); gestureRef.current = null; setWebgl('lost'); };
    const restored = () => { if (material.map) material.map.needsUpdate = true; material.needsUpdate = true; syncPiece(runtime, draftRef.current); setWebgl('ready'); resize(); };
    canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointermove', pointerMove); canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointercancel', pointerUp);
    canvas.addEventListener('webglcontextlost', lost); canvas.addEventListener('webglcontextrestored', restored);
    return () => {
      alive = false; cancelAnimationFrame(frame); observer.disconnect(); gestureRef.current = null;
      canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove); canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('pointercancel', pointerUp);
      canvas.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('webglcontextrestored', restored);
      scene.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
      material.map?.dispose(); material.dispose(); wheelMaterial.dispose(); ringMaterial.dispose(); floorMaterial.dispose(); renderer.dispose(); runtimeRef.current = null;
    };
  }, []);

  useEffect(() => { if (runtimeRef.current && webgl === 'ready') syncPiece(runtimeRef.current, draft); }, [stored, webgl]);

  async function save() {
    const runtime = runtimeRef.current;
    if (!runtime || webgl !== 'ready') return;
    setBusy(true); setNotice('');
    const { renderer, camera, workbench, scene } = runtime;
    const oldSize = renderer.getSize(new THREE.Vector2()), oldRatio = renderer.getPixelRatio(), oldAspect = camera.aspect;
    try {
      syncPiece(runtime, draftRef.current); workbench.visible = false;
      renderer.setPixelRatio(1); renderer.setSize(1000, 1000, false); camera.aspect = 1; camera.updateProjectionMatrix(); renderer.render(scene, camera);
      const dataUrl = renderer.domElement.toDataURL('image/png');
      const current = draftRef.current, label = CERAMIC_PRESETS.find(item => item.id === current.preset)!.label;
      // Restore the stage before awaiting IndexedDB, so the working view never flashes.
      workbench.visible = true; renderer.setPixelRatio(oldRatio); renderer.setSize(oldSize.x, oldSize.y, false); camera.aspect = oldAspect; camera.updateProjectionMatrix(); renderer.render(scene, camera);
      await onSave({ kind: 'ceramic3d', title: `${label} da Leh`, dataUrl, display: 'object', version: 1 });
      setNotice('Sua peça foi morar na prateleira. O rascunho continua no torno.');
    } catch { setNotice('Não consegui guardar a peça. Seu rascunho continua aqui; tente de novo.'); }
    finally {
      workbench.visible = true; renderer.setPixelRatio(oldRatio); renderer.setSize(oldSize.x, oldSize.y, false); camera.aspect = oldAspect; camera.updateProjectionMatrix(); runtime.render(); setBusy(false);
    }
  }

  const turn = (delta: number) => change({ ...draftRef.current, view: { ...draftRef.current.view, azimuth: modAngle(draftRef.current.view.azimuth + delta) } });
  const applyBand = () => { const current = draftRef.current; change({ ...current, profile: sculptProfile(current.profile, band, brushRadius, intensity, .1, tool) }); };
  const presetLabel = CERAMIC_PRESETS.find(item => item.id === draft.preset)!.label;
  return <div className="ceramic3d-game">
    <p className="game-note">Barro, esmalte e um tempo só seu. Molde com o dedo, gire para espiar e deixe a peça com a sua cara.</p>
    <div className="c3-layout">
      <section className="c3-workspace" aria-label="Mesa de cerâmica">
        <div className="c3-stage" ref={stageRef} data-mode={mode} data-webgl-state={webgl}>
          <canvas ref={canvasRef} className="c3-canvas" aria-label={`${presetLabel} em três dimensões. ${mode === 'rotate' ? 'Arraste para girar.' : mode === 'stamp' ? 'Toque na superfície para carimbar.' : 'Toque e arraste na superfície para moldar.'}`} role="img" tabIndex={webgl === 'ready' ? 0 : -1} onKeyDown={event => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); turn(event.key === 'ArrowLeft' ? -.22 : .22); }
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); change({ ...draftRef.current, view: { ...draftRef.current.view, elevation: clamp(draftRef.current.view.elevation + (event.key === 'ArrowUp' ? .1 : -.1), .12, 1.1) } }); }
          }}/>
          {webgl === 'starting' && <div className="c3-fallback" role="status"><p>Preparando o torno…</p></div>}
          {webgl === 'unavailable' && <div className="c3-fallback"><h2>O torno 3D não abriu neste aparelho</h2><p>A cerâmica em três dimensões precisa de um navegador com WebGL. Sua outra mesa de cerâmica está pronta para pintar e carimbar.</p><button className="primary-button" onClick={() => { window.location.hash = 'clay'; }}>Ir para a cerâmica ilustrada</button></div>}
          {webgl === 'lost' && <div className="c3-fallback" role="status"><h2>O torno deu uma pausa</h2><p>O navegador interrompeu a imagem 3D. Seu rascunho está preservado. A imagem volta quando o navegador recuperar o desenho.</p><button className="soft-button" onClick={() => { window.location.hash = 'clay'; }}>Abrir a cerâmica ilustrada</button></div>}
        </div>
        <div className="c3-modebar" aria-label="O que fazer na peça">
          <button aria-pressed={mode === 'sculpt'} onClick={() => setMode('sculpt')}><Hand size={18}/>Moldar</button>
          <button aria-pressed={mode === 'rotate'} onClick={() => setMode('rotate')}><ArrowsClockwise size={18}/>Girar</button>
          <button aria-pressed={mode === 'stamp'} onClick={() => setMode('stamp')}><Flower size={18}/>Carimbar</button>
        </div>
        <p className="c3-hint">{mode === 'rotate' ? 'Arraste para ver os lados e a boca da peça. O formato fica como está.' : mode === 'stamp' ? 'Toque no barro para colocar um carimbo. Gire a peça para decorar o outro lado.' : `Toque no barro e arraste para ${TOOL_LABELS[tool].toLowerCase()}. Cada gesto mexe só na faixa tocada.`}</p>
        <div className="c3-view-controls">
          <button className="soft-button" onClick={() => turn(-Math.PI / 5)} aria-label="Girar a peça para a esquerda"><ArrowLeft size={16}/></button>
          <label className="control-label">Espiar por cima<input type="range" min=".12" max="1.1" step=".02" value={draft.view.elevation} aria-label="Inclinação da vista da cerâmica" onPointerDown={checkpoint} onKeyDown={event => { if (event.key.startsWith('Arrow')) checkpoint(); }} onChange={event => replace({ ...draftRef.current, view: { ...draftRef.current.view, elevation: Number(event.target.value) } })}/></label>
          <button className="soft-button" onClick={() => turn(Math.PI / 5)} aria-label="Girar a peça para a direita"><ArrowRight size={16}/></button>
        </div>
      </section>
      <aside className="c3-controls" aria-label="Ferramentas do torno">
        <details className="c3-panel" open><summary>Começar com um formato</summary>
          <div className="c3-preset-grid">{CERAMIC_PRESETS.map(preset => <button key={preset.id} aria-pressed={draft.preset === preset.id} onClick={() => {
            const current = draftRef.current, next = createCeramicDraft(preset.id); change({ ...next, color: current.color, finish: current.finish, pattern: current.pattern, patternColor: current.patternColor, view: current.view });
          }}>{preset.label}</button>)}</div>
          <label className="control-label c3-slider">Altura da peça<input aria-label="Altura da peça de cerâmica" type="range" min=".35" max="2.9" step=".025" value={draft.height} onPointerDown={checkpoint} onKeyDown={event => { if (event.key.startsWith('Arrow')) checkpoint(); }} onChange={event => replace({ ...draftRef.current, height: Number(event.target.value) })}/></label>
        </details>
        <details className="c3-panel" open><summary>Mãos no barro</summary>
          <div className="c3-tools">{(Object.keys(TOOL_LABELS) as SculptTool[]).map(value => <button key={value} aria-pressed={tool === value} onClick={() => { setTool(value); setMode('sculpt'); }}>{TOOL_LABELS[value]}</button>)}</div>
          <label className="control-label c3-slider">Força do toque<input aria-label="Força da ferramenta de cerâmica" type="range" min=".1" max="1" step=".05" value={intensity} onChange={event => setIntensity(Number(event.target.value))}/></label>
          <label className="control-label c3-slider">Tamanho da faixa<input aria-label="Tamanho da faixa de moldagem" type="range" min=".04" max=".45" step=".01" value={brushRadius} onChange={event => setBrushRadius(Number(event.target.value))}/></label>
          <details className="c3-accessible-tools"><summary>Moldar pelos controles</summary><p>Também dá para escolher uma altura e aplicar a ferramenta sem arrastar.</p><label className="control-label c3-slider">Onde tocar: {band < .33 ? 'mais perto da base' : band > .66 ? 'mais perto da boca' : 'no meio da peça'}<input aria-label="Altura da faixa a moldar" type="range" min="0" max="1" step=".025" value={band} onChange={event => setBand(Number(event.target.value))}/></label><button className="soft-button" onClick={applyBand}>Aplicar {TOOL_LABELS[tool].toLowerCase()}</button></details>
        </details>
        <details className="c3-panel" open><summary>Um banho de esmalte</summary>
          <div className="c3-colors" aria-label="Cor do esmalte">{CERAMIC_COLORS.map(({ color, label }) => <button key={color} className={draft.color === color ? 'selected' : ''} style={{ backgroundColor: color }} aria-label={`Esmalte ${label.toLowerCase()}`} aria-pressed={draft.color === color} onClick={() => change({ ...draftRef.current, color })}/>) }<label className="c3-custom-color" title="Outra cor de esmalte"><span>+</span><input aria-label="Outra cor de esmalte" type="color" value={draft.color} onChange={event => change({ ...draftRef.current, color: event.target.value })}/></label></div>
          <div className="c3-finish" aria-label="Acabamento do esmalte"><button aria-pressed={draft.finish === 'matte'} onClick={() => change({ ...draftRef.current, finish: 'matte' })}>Fosco</button><button aria-pressed={draft.finish === 'glossy'} onClick={() => change({ ...draftRef.current, finish: 'glossy' })}>Brilhante</button></div>
          <div className="c3-decoration-row"><label className="control-label">Desenho do esmalte<select aria-label="Padrão do esmalte" value={draft.pattern} onChange={event => change({ ...draftRef.current, pattern: event.target.value as CeramicPattern })}>{CERAMIC_PATTERN_IDS.map(pattern => <option key={pattern} value={pattern}>{CERAMIC_PATTERN_LABELS[pattern]}</option>)}</select></label><label className="control-label">Cor dos desenhos<input aria-label="Cor dos desenhos e carimbos" type="color" value={draft.patternColor} onChange={event => change({ ...draftRef.current, patternColor: event.target.value })}/></label></div>
        </details>
        <details className="c3-panel" open={mode === 'stamp'}><summary>Pequenos carimbos</summary>
          <div className="c3-tools">{(Object.keys(STAMP_LABELS) as CeramicStamp['type'][]).map(value => <button key={value} aria-pressed={stamp === value} onClick={() => { setStamp(value); setMode('stamp'); }}>{STAMP_LABELS[value]}</button>)}</div>
          <label className="control-label c3-slider">Tamanho do carimbo<input aria-label="Tamanho do carimbo na cerâmica" type="range" min=".025" max=".14" step=".005" value={stampSize} onChange={event => setStampSize(Number(event.target.value))}/></label>
          <p className="c3-small-note">Os carimbos usam a cor dos desenhos. Toque na peça para decorar.</p>
          <button className="soft-button" disabled={!draft.stamps.length} onClick={() => change({ ...draftRef.current, stamps: [] })}>Tirar os carimbos</button>
        </details>
      </aside>
    </div>
    <div className="game-toolbar c3-actions">
      <button className="soft-button" disabled={!history.length} onClick={undo}><ArrowCounterClockwise/>Desfazer</button>
      <button className="soft-button" disabled={!future.length} onClick={redo}><ArrowClockwise/>Refazer</button>
      <button className="soft-button" onClick={() => { change(createCeramicDraft()); setNotice('Uma nova pecinha no torno. Se quiser, dá para desfazer.'); }}>Outra pecinha</button>
      <button className="primary-button" disabled={busy || webgl !== 'ready'} onClick={save}><FloppyDisk/>{busy ? 'Guardando…' : 'Guardar na prateleira'}</button>
    </div>
    <p className="c3-status" role="status" aria-live="polite">{notice || 'Seu rascunho fica no torno para quando quiser voltar.'}</p>
  </div>;
}
