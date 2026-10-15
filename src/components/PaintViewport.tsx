import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Hand, Minus, Plus, CornersOut } from '@phosphor-icons/react';
import './paint-viewport.css';

export type PaintPoint = {
  x: number;
  y: number;
  clientX: number;
  clientY: number;
  pointerType: string;
  target: Element | null;
};
export type PaintEndReason = 'up' | 'cancel' | 'hidden' | 'unmount';
export type PaintViewportProps = {
  children: ReactNode;
  className?: string;
  label?: string;
  resetKey?: string | number;
  interaction?: 'tap' | 'draw';
  contentSize?: { width: number; height: number };
  onPaintTap?: (point: PaintPoint) => void;
  onPaintStart?: (point: PaintPoint) => void;
  onPaintMove?: (point: PaintPoint) => void;
  onPaintEnd?: (point: PaintPoint | null, reason: PaintEndReason) => void;
  onPaintCancel?: () => void;
};
type Transform = { scale: number; x: number; y: number };
type Contact = { clientX: number; clientY: number; pointerType: string };
type Gesture = {
  pointerId: number;
  start: Contact;
  target: Element | null;
  transform: Transform;
  dragged: boolean;
  drawing: boolean;
};
type Pinch = { distance: number; scale: number; anchorX: number; anchorY: number };
const INITIAL: Transform = { scale: 1, x: 0, y: 0 };
const MIN_SCALE = 1;
const MAX_SCALE = 5;
const TAP_DISTANCE = 8;

/**
 * Keep pointer handlers on this viewport, not on the child SVG/canvas. In tap
 * mode a region is filled only after a stationary release; two fingers always
 * navigate. Legacy SVG onClick handlers work when onPaintTap is omitted.
 */
export default function PaintViewport(props: PaintViewportProps) {
  const { children, className = '', label = 'Área de pintura', resetKey, interaction = 'tap' } = props;
  const [transform, setTransform] = useState<Transform>(INITIAL);
  const [moving, setMoving] = useState(false);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<Transform>(INITIAL);
  const movingRef = useRef(false);
  const propsRef = useRef(props);
  const contacts = useRef(new Map<number, Contact>());
  const gesture = useRef<Gesture | null>(null);
  const pinch = useRef<Pinch | null>(null);
  const navigationOnly = useRef(false);
  const lastPoint = useRef<PaintPoint | null>(null);
  const forwardingClick = useRef(false);
  propsRef.current = props;

  const constrained = (next: Transform): Transform => {
    const surface = surfaceRef.current;
    const width = surface?.clientWidth ?? 1, height = surface?.clientHeight ?? 1;
    const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next.scale));
    return { scale, x: Math.max(width * (1 - scale), Math.min(0, next.x)), y: Math.max(height * (1 - scale), Math.min(0, next.y)) };
  };
  const update = (next: Transform) => {
    const bounded = constrained(next);
    transformRef.current = bounded;
    setTransform(bounded);
  };
  const point = (contact: Contact): PaintPoint => {
    const surface = surfaceRef.current;
    const rect = surface?.getBoundingClientRect();
    const size = propsRef.current.contentSize ?? { width: 600, height: 600 };
    const current = transformRef.current;
    const hit = document.elementFromPoint(contact.clientX, contact.clientY);
    const target = hit && surface?.contains(hit) ? hit : null;
    return {
      ...contact,
      x: ((contact.clientX - (rect?.left ?? 0) - current.x) / ((surface?.clientWidth ?? 1) * current.scale)) * size.width,
      y: ((contact.clientY - (rect?.top ?? 0) - current.y) / ((surface?.clientHeight ?? 1) * current.scale)) * size.height,
      target,
    };
  };
  const releaseCaptures = () => {
    const surface = surfaceRef.current;
    const ids = Array.from(contacts.current.keys());
    contacts.current.clear();
    ids.forEach(id => { if (surface?.hasPointerCapture(id)) surface.releasePointerCapture(id); });
  };
  const interrupt = (reason: PaintEndReason) => {
    if (gesture.current?.drawing) propsRef.current.onPaintEnd?.(lastPoint.current, reason);
    gesture.current = null; pinch.current = null; navigationOnly.current = false;
    releaseCaptures(); contacts.current.clear();
  };
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'hidden') interrupt('hidden'); };
    const onPageHide = () => interrupt('hidden');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    const resize = new ResizeObserver(() => update(transformRef.current));
    if (surfaceRef.current) resize.observe(surfaceRef.current);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      resize.disconnect(); interrupt('unmount');
    };
  }, []);
  useEffect(() => {
    interrupt('cancel'); update(INITIAL);
    movingRef.current = false; setMoving(false);
  }, [resetKey]);

  const beginPinch = () => {
    const [a, b] = Array.from(contacts.current.values());
    if (!a || !b) return;
    if (gesture.current?.drawing) propsRef.current.onPaintCancel?.();
    gesture.current = null; navigationOnly.current = true;
    const rect = surfaceRef.current?.getBoundingClientRect();
    const current = transformRef.current;
    const centerX = (a.clientX + b.clientX) / 2 - (rect?.left ?? 0);
    const centerY = (a.clientY + b.clientY) / 2 - (rect?.top ?? 0);
    pinch.current = {
      distance: Math.max(1, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)),
      scale: current.scale,
      anchorX: (centerX - current.x) / current.scale,
      anchorY: (centerY - current.y) / current.scale,
    };
  };
  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    const contact = { clientX: event.clientX, clientY: event.clientY, pointerType: event.pointerType };
    contacts.current.set(event.pointerId, contact);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (contacts.current.size >= 2) { beginPinch(); return; }
    if (navigationOnly.current) return;
    const paintPoint = point(contact);
    const drawing = !movingRef.current && propsRef.current.interaction === 'draw';
    gesture.current = { pointerId: event.pointerId, start: contact, target: paintPoint.target, transform: transformRef.current, dragged: false, drawing };
    lastPoint.current = paintPoint;
    if (drawing) propsRef.current.onPaintStart?.(paintPoint);
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!contacts.current.has(event.pointerId)) return;
    event.preventDefault(); event.stopPropagation();
    const contact = { clientX: event.clientX, clientY: event.clientY, pointerType: event.pointerType };
    contacts.current.set(event.pointerId, contact);
    if (pinch.current && contacts.current.size >= 2) {
      const [a, b] = Array.from(contacts.current.values());
      const rect = surfaceRef.current?.getBoundingClientRect();
      const centerX = (a.clientX + b.clientX) / 2 - (rect?.left ?? 0);
      const centerY = (a.clientY + b.clientY) / 2 - (rect?.top ?? 0);
      const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, pinch.current.scale * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch.current.distance));
      update({ scale: nextScale, x: centerX - pinch.current.anchorX * nextScale, y: centerY - pinch.current.anchorY * nextScale });
      return;
    }
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId || navigationOnly.current) return;
    const dx = event.clientX - active.start.clientX, dy = event.clientY - active.start.clientY;
    if (Math.hypot(dx, dy) > TAP_DISTANCE) active.dragged = true;
    if (movingRef.current) update({ scale: active.transform.scale, x: active.transform.x + dx, y: active.transform.y + dy });
    else if (active.drawing) {
      const paintPoint = point(contact); lastPoint.current = paintPoint;
      propsRef.current.onPaintMove?.(paintPoint);
    }
  };
  const end = (event: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    if (!contacts.current.has(event.pointerId)) return;
    event.preventDefault(); event.stopPropagation();
    const active = gesture.current;
    const contact = { clientX: event.clientX, clientY: event.clientY, pointerType: event.pointerType };
    const paintPoint = point(contact);
    contacts.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (active?.pointerId === event.pointerId && !navigationOnly.current) {
      if (active.drawing) propsRef.current.onPaintEnd?.(paintPoint, cancelled ? 'cancel' : 'up');
      else if (!cancelled && !movingRef.current && !active.dragged && Math.hypot(contact.clientX - active.start.clientX, contact.clientY - active.start.clientY) <= TAP_DISTANCE) {
        if (propsRef.current.onPaintTap) propsRef.current.onPaintTap(paintPoint);
        else if (active.target && paintPoint.target === active.target) {
          forwardingClick.current = true;
          active.target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: event.clientX, clientY: event.clientY, detail: 1 }));
          forwardingClick.current = false;
        }
      }
      gesture.current = null;
    }
    if (contacts.current.size < 2) pinch.current = null;
    if (!contacts.current.size) { navigationOnly.current = false; gesture.current = null; }
  };
  const zoom = (factor: number) => {
    interrupt('cancel');
    const current = transformRef.current;
    const width = surfaceRef.current?.clientWidth ?? 1, height = surfaceRef.current?.clientHeight ?? 1;
    const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, current.scale * factor));
    update({ scale, x: width / 2 - ((width / 2 - current.x) / current.scale) * scale, y: height / 2 - ((height / 2 - current.y) / current.scale) * scale });
  };
  return <div className={`paint-viewport ${className}`}>
    <div className="paint-viewport-controls" aria-label="Enquadramento do desenho">
      <div className="paint-viewport-zoom">
        <button type="button" aria-label="Diminuir desenho" disabled={transform.scale <= MIN_SCALE + .001} onClick={() => zoom(1 / 1.4)}><Minus size={17} /></button>
        <output aria-label="Ampliação do desenho">{Math.round(transform.scale * 100)}%</output>
        <button type="button" aria-label="Aumentar desenho" disabled={transform.scale >= MAX_SCALE - .001} onClick={() => zoom(1.4)}><Plus size={17} /></button>
        <button type="button" aria-label="Enquadrar desenho" onClick={() => { interrupt('cancel'); update(INITIAL); }}><CornersOut size={18} /></button>
      </div>
      <button type="button" className={`paint-viewport-tool ${moving ? 'is-moving' : ''}`} aria-label="Mover desenho" aria-pressed={moving} onClick={() => { interrupt('cancel'); movingRef.current = !movingRef.current; setMoving(movingRef.current); }}><Hand size={18} /><span>Mover</span></button>
    </div>
    <div ref={surfaceRef} className={`paint-viewport-surface ${moving ? 'is-moving' : ''}`} role="group" aria-label={label} data-paint-surface="true" data-paint-tool={moving ? 'move' : 'paint'} onPointerDownCapture={down} onPointerMoveCapture={move} onPointerUpCapture={event => end(event)} onPointerCancelCapture={event => end(event, true)} onLostPointerCapture={event => { if (contacts.current.has(event.pointerId)) interrupt('cancel'); }} onClickCapture={event => { if (event.detail !== 0 && !forwardingClick.current) event.stopPropagation(); }}>
      <div className="paint-viewport-content" style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }} data-paint-scale={transform.scale.toFixed(3)}>{children}</div>
    </div>
    <p className="paint-viewport-hint">{moving ? 'Arraste para mover. Toque em Mover para voltar a pintar.' : interaction === 'draw' ? 'Desenhe com um dedo. Com dois, aproxime e mova o papel.' : 'Toque para pintar. Use dois dedos para aproximar e mover.'}</p>
  </div>;
}
