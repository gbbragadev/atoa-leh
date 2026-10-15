import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Palette } from '../components/Palette';
import { randomSeed, svgToDataUrl } from '../lib/art';
import { usePersistentState } from '../lib/storage';
import type { GameProps } from '../lib/types';
import './nature-games.css';
import './garden-expansion.css';

type PlantKind = 'monstera' | 'flower' | 'cactus' | 'fern' | 'daisy' | 'mushroom' | 'butterfly' | 'sunflower' | 'tulip' | 'lavender' | 'pilea' | 'ivy' | 'succulent' | 'calathea';
type PotStyle = 'classic' | 'round' | 'striped' | 'speckled' | 'woven' | 'face';
type GardenItem = { id: string; kind: PlantKind; x: number; y: number; color: string; size: number; rotation: number; potStyle?: PotStyle; potColor?: string };
type GardenState = { items: GardenItem[]; weather: 'day' | 'night' | 'rain'; ground: 'linen' | 'rose' | 'sage' };
const PLANTS: { kind: PlantKind; label: string }[] = [
  { kind: 'monstera', label: 'Costela-de-adão' }, { kind: 'flower', label: 'Flor inventada' },
  { kind: 'cactus', label: 'Cacto de folga' }, { kind: 'fern', label: 'Samambaia' },
  { kind: 'daisy', label: 'Margarida' }, { kind: 'mushroom', label: 'Cogumelo' }, { kind: 'butterfly', label: 'Borboleta' },
  { kind: 'sunflower', label: 'Girassol' }, { kind: 'tulip', label: 'Tulipas' }, { kind: 'lavender', label: 'Lavanda' },
  { kind: 'pilea', label: 'Pilea' }, { kind: 'ivy', label: 'Hera pendente' }, { kind: 'succulent', label: 'Suculenta' }, { kind: 'calathea', label: 'Maranta' },
];
const POTS: { style: PotStyle; label: string }[] = [{ style: 'classic', label: 'Clássico' }, { style: 'round', label: 'Barrigudinho' }, { style: 'striped', label: 'Listrado' }, { style: 'speckled', label: 'Pintinhas' }, { style: 'woven', label: 'Cestinha' }, { style: 'face', label: 'Risonho' }];
const PLANT_COLORS: Partial<Record<PlantKind, string>> = { monstera: '#52785c', fern: '#52785c', cactus: '#97ad83', flower: '#bc7e8f', daisy: '#fff9ed', sunflower: '#e4c15c', tulip: '#bc7e8f', lavender: '#9a8fb2', pilea: '#97ad83', ivy: '#52785c', succulent: '#8aa9ba', calathea: '#97ad83', mushroom: '#d7917c', butterfly: '#e4c15c' };
const legacyPotColor = (kind: PlantKind) => kind === 'cactus' ? '#e4c15c' : kind === 'fern' ? '#8aa9ba' : kind === 'daisy' ? '#97ad83' : kind === 'flower' ? '#9a8fb2' : '#d7917c';
type CompositionId = 'window' | 'sunshine' | 'woodland';
type Composition = { id: CompositionId; label: string; caption: string; weather: GardenState['weather']; ground: GardenState['ground']; items: Omit<GardenItem, 'id'>[] };
const COMPOSITIONS: Composition[] = [
  { id: 'window', label: 'Janela verde', caption: 'Folhas de todo tamanho', weather: 'day', ground: 'linen', items: [
    { kind: 'fern', x: 139, y: 495, color: '#52785c', size: 1.05, rotation: -4, potStyle: 'woven', potColor: '#c2a17b' },
    { kind: 'calathea', x: 302, y: 480, color: '#97ad83', size: 1.06, rotation: 0, potStyle: 'round', potColor: '#d7917c' },
    { kind: 'ivy', x: 561, y: 398, color: '#52785c', size: .92, rotation: 2, potStyle: 'striped', potColor: '#8aa9ba' },
    { kind: 'pilea', x: 449, y: 552, color: '#97ad83', size: .88, rotation: -3, potStyle: 'speckled', potColor: '#fff9ed' },
    { kind: 'flower', x: 235, y: 579, color: '#bc7e8f', size: .72, rotation: 5, potStyle: 'face', potColor: '#e4c15c' },
  ] },
  { id: 'sunshine', label: 'Sol de quintal', caption: 'Uma tarde amarelinha', weather: 'day', ground: 'rose', items: [
    { kind: 'sunflower', x: 158, y: 518, color: '#e4c15c', size: 1.15, rotation: -5, potStyle: 'striped', potColor: '#8aa9ba' },
    { kind: 'tulip', x: 332, y: 499, color: '#bc7e8f', size: .92, rotation: 0, potStyle: 'round', potColor: '#d7917c' },
    { kind: 'cactus', x: 558, y: 543, color: '#97ad83', size: .89, rotation: 4, potStyle: 'face', potColor: '#e4c15c' },
    { kind: 'succulent', x: 429, y: 579, color: '#8aa9ba', size: 1.1, rotation: -4, potStyle: 'speckled', potColor: '#fff9ed' },
    { kind: 'butterfly', x: 501, y: 277, color: '#d7917c', size: .69, rotation: 17 },
  ] },
  { id: 'woodland', label: 'Bosque miudinho', caption: 'Um cantinho de histórias', weather: 'rain', ground: 'sage', items: [
    { kind: 'fern', x: 145, y: 521, color: '#52785c', size: 1.17, rotation: -8, potStyle: 'woven', potColor: '#c2a17b' },
    { kind: 'monstera', x: 470, y: 482, color: '#52785c', size: .88, rotation: 6, potStyle: 'classic', potColor: '#d7917c' },
    { kind: 'lavender', x: 300, y: 565, color: '#9a8fb2', size: .97, rotation: 0, potStyle: 'round', potColor: '#fff9ed' },
    { kind: 'mushroom', x: 585, y: 587, color: '#bc7e8f', size: .79, rotation: -5 },
    { kind: 'ivy', x: 326, y: 391, color: '#97ad83', size: .74, rotation: -4, potStyle: 'speckled', potColor: '#8aa9ba' },
  ] },
];
const initialGarden = (): GardenState => ({ weather: 'day', ground: 'linen', items: [
  { id: 'first-monstera', kind: 'monstera', x: 206, y: 509, color: '#52785c', size: 1.15, rotation: -4 },
  { id: 'first-flower', kind: 'flower', x: 404, y: 526, color: '#bc7e8f', size: 0.94, rotation: 5 },
  { id: 'first-cactus', kind: 'cactus', x: 556, y: 526, color: '#97ad83', size: 0.82, rotation: 2 },
] });

function point(svg: SVGSVGElement, clientX: number, clientY: number) {
  const matrix = svg.getScreenCTM();
  if (matrix) { const p = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse()); return { x: p.x, y: p.y }; }
  const rect = svg.getBoundingClientRect(); return { x: (clientX - rect.left) * 720 / rect.width, y: (clientY - rect.top) * 700 / rect.height };
}
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function Pot({ color = '#d7917c', style = 'classic' }: { color?: string; style?: PotStyle }) {
  const rounded = style === 'round' || style === 'face' || style === 'speckled';
  return <g><ellipse cx="0" cy="9" rx={rounded ? 51 : 47} ry="10" fill="#343a29" opacity=".11" />
    <path d={rounded ? 'M-34-57 Q-53-42-49-14 Q-46 15 0 16 Q47 15 49-14 Q52-42 34-57Z' : 'M-40-55 H40 L31 4 Q0 17-31 4Z'} fill={color} />
    {style === 'striped' && <g stroke="#fff9ed" strokeWidth="7" opacity=".7"><path d="M-26-50 L-22 3 M-9-51 L-7 7 M9-51 L7 7 M26-50 L22 3" /></g>}
    {style === 'speckled' && <g fill="#77644e" opacity=".38">{[[-28, -27], [-14, -42], [9, -36], [32, -23], [-9, -7], [15, -13], [28, 2], [-29, -6], [4, 5], [25, -39], [-4, -27]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx={i % 3 === 0 ? 2.5 : 1.6} ry={i % 2 ? 2.4 : 1.4} />)}</g>}
    {style === 'woven' && <g fill="none" stroke="#fff9ed" strokeWidth="2.5" opacity=".47">{[-43, -31, -19, -7, 4].map((y, i) => <path key={i} d={`M${-37 + i * 2} ${y} H${37 - i * 2}`} />)}{[-26, -13, 0, 13, 26].map((x, i) => <path key={i} d={`M${x} -49 L${x * .77} 5`} />)}</g>}
    {style === 'face' && <g fill="none" stroke="#625747" strokeWidth="2.5" strokeLinecap="round"><path d="M-24-24 q7-8 14 0 M10-24 q7-8 14 0 M-7-12 q7 10 14 0" /><ellipse cx="-28" cy="-12" rx="6" ry="3" fill="#bc7e8f" stroke="none" opacity=".55" /><ellipse cx="28" cy="-12" rx="6" ry="3" fill="#bc7e8f" stroke="none" opacity=".55" /></g>}
    {style === 'classic' && <path d="M-22-41 L-18-2" stroke="#fff9ed" strokeWidth="5" strokeLinecap="round" opacity=".25" />}
    <ellipse cy="-56" rx="40" ry="9" fill={color} /><ellipse cy="-56" rx="40" ry="9" fill="#665744" opacity=".13" /><ellipse cy="-58" rx="31" ry="5" fill="#77644e" /></g>;
}

function PlantArt({ kind, color, potStyle = 'classic', potColor }: { kind: PlantKind; color: string; potStyle?: PotStyle; potColor?: string }) {
  const pot = <Pot style={potStyle} color={potColor ?? legacyPotColor(kind)} />;
  if (kind === 'butterfly') return <g stroke="#665e50" strokeWidth="2" strokeLinejoin="round"><path d="M0-33 C-74-97-73-4-10-17 C-56 34-4 48 0-5 C4 48 56 34 10-17 C73-4 74-97 0-33" fill={color} />
    <path d="M0-34 V8 M-1-34 Q-18-55-17-41 M1-34 Q18-55 17-41" fill="none" /><circle cx="-23" cy="-34" r="7" fill="#fff9ed" opacity=".55" /><circle cx="23" cy="-34" r="7" fill="#fff9ed" opacity=".55" /></g>;
  if (kind === 'mushroom') return <g><ellipse cy="4" rx="48" ry="9" fill="#343a29" opacity=".1" /><path d="M-17-63 Q-21-18-15 0 Q0 11 16 0 L12-64Z" fill="#efe2c7" />
    <path d="M-62-63 Q-51-124 0-125 Q47-124 64-63 Q0-41-62-63" fill={color} /><path d="M-61-63 Q0-48 64-63" fill="none" stroke="#665e50" strokeWidth="2" opacity=".4" />
    <ellipse cx="-24" cy="-92" rx="10" ry="7" fill="#fff9ed" opacity=".8" /><ellipse cx="24" cy="-90" rx="12" ry="8" fill="#fff9ed" opacity=".8" /><ellipse cx="2" cy="-110" rx="7" ry="5" fill="#fff9ed" opacity=".8" /></g>;
  if (kind === 'cactus') return <g>{pot}<path d="M-12-59 V-157 Q-12-183 8-181 Q28-180 28-158 V-61Z" fill={color} />
    <path d="M-12-114 H-31 Q-44-114-44-129 V-148 Q-44-162-55-161 Q-68-160-66-146 V-124 Q-66-91-12-92 M28-104 H44 Q58-104 58-125 V-139 Q58-153 69-152 Q80-151 79-136 V-118 Q79-84 28-84" fill={color} />
    <path d="M8-170 V-67 M-53-149 V-125 M68-139 V-117" fill="none" stroke="#fff9ed" strokeWidth="2" strokeDasharray="4 8" opacity=".65" />
    <g transform="translate(8 -181)"><path d="M0 0 Q-18-21-15-27 Q-3-30 0-14 Q4-31 16-27 Q22-18 0 0" fill="#bc7e8f" /><circle cy="-9" r="5" fill="#e4c15c" /></g></g>;
  if (kind === 'monstera') return <g>{pot}<g stroke="#435e43" strokeWidth="4" fill="none" strokeLinecap="round"><path d="M0-57 Q-7-118-40-181 M0-57 Q25-141 65-182 M0-57 Q-33-88-76-118" /></g>
    <g fill={color}><path d="M-36-176 C-91-200-103-133-55-133 C-48-132-41-146-36-176" /><path d="M-37-177 C-2-227 36-164-12-151 C-27-147-32-156-37-177" />
      <path d="M63-181 C17-230 2-161 38-155 C50-153 57-164 63-181" /><path d="M64-181 C109-205 126-147 80-145 C67-145 62-159 64-181" />
      <path d="M-74-118 C-126-143-125-86-85-82 C-65-82-70-108-74-118" /><path d="M-74-118 C-54-154-18-121-38-98 C-55-85-65-95-74-118" /></g>
    <g stroke="#fff9ed" strokeWidth="4" strokeLinecap="round" opacity=".65"><path d="M-39-173 L-65-155 M-38-174 L-15-181 M65-179 L39-181 M66-179 L91-166 M-76-116 L-100-108" /></g></g>;
  if (kind === 'fern') return <g>{pot}<g stroke={color} strokeLinecap="round" fill="none"><path d="M0-56 Q-13-179-83-153 M0-56 Q0-206 32-195 M0-56 Q39-174 87-155 M0-58 Q-46-130-79-109 M0-58 Q53-110 80-82" strokeWidth="5" />
    {[-1, 1].map(side => <g key={side} transform={`scale(${side} 1)`}>{[0, 1, 2, 3, 4].map(i => <path key={i} d={`M${12 + i * 12} ${-77 - i * 15} q-16 -24 -24 -14 m24 14 q20 -4 26 -17`} strokeWidth="9" />)}</g>)}
    <path d="M9-114 Q-14-145-21-135 M14-136 Q38-136 42-151 M20-159 Q-2-180-9-169 M25-179 Q44-180 44-192" strokeWidth="9" /></g></g>;
  if (kind === 'sunflower') return <g>{pot}<path d="M0-58 Q8-126 0-185 M1-112 Q-51-154-52-113 Q-34-89 1-112 M2-145 Q49-179 52-143 Q38-125 2-145" fill="#52785c" stroke="#52785c" strokeWidth="5" strokeLinecap="round" /><g transform="translate(0 -185)">{Array.from({ length: 14 }, (_, i) => <ellipse key={i} cy="-32" rx="10" ry="28" transform={`rotate(${i * 360 / 14})`} fill={color} />)}<circle r="28" fill="#9f7947" />{[[-12, -11], [2, -17], [14, -7], [-17, 3], [-2, 1], [12, 10], [-5, 16]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.2" fill="#e4c15c" opacity=".8" />)}</g></g>;
  if (kind === 'tulip') return <g>{pot}<g fill="none" stroke="#52785c" strokeWidth="4" strokeLinecap="round"><path d="M0-58 Q-35-105-39-150 M0-58 Q-7-131-3-188 M0-58 Q32-91 34-153" /></g><path d="M-7-64 Q-76-120-57-155 Q-13-114-7-64 M10-62 Q80-126 71-139 Q36-128 10-62" fill="#97ad83" />{[[-39, -150, -12], [-3, -190, 3], [34, -156, 13]].map(([x, y, r], i) => <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}><path d="M-25-14 L-18-36 L-3-22 L10-39 L23-17 Q28 12 0 18 Q-27 11-25-14Z" fill={color} /><path d="M-3-19 Q-11 1 0 15 M11-28 Q21-8 8 13" stroke="#fff9ed" strokeWidth="2" opacity=".4" fill="none" /></g>)}</g>;
  if (kind === 'lavender') return <g>{pot}{[-45, -25, -6, 17, 37].map((x, i) => <g key={i}><path d={`M0-58 Q${x} -100 ${x} ${-150 - i % 3 * 19}`} stroke="#6d8962" strokeWidth="3" fill="none" /><path d={`M${x * .75} -99 q-21 -24 -22 -13 q4 17 22 13 M${x * .65} -112 q19 -24 24 -14 q-4 14 -24 14`} fill="#97ad83" /><g transform={`translate(${x} ${-147 - i % 3 * 19})`}>{Array.from({ length: 6 }, (_, n) => <g key={n} transform={`translate(0 ${-n * 8})`}><ellipse cx="-5" rx="7" ry="5" transform="rotate(25)" fill={color} /><ellipse cx="5" rx="7" ry="5" transform="rotate(-25)" fill={color} /></g>)}</g></g>)}</g>;
  if (kind === 'pilea') return <g>{pot}{[[-55, -150, 28], [-17, -190, 30], [42, -174, 31], [65, -103, 25], [-35, -97, 25]].map(([x, y, r], i) => <g key={i}><path d={`M0-58 Q${x * .5} ${y + 37} ${x} ${y}`} stroke="#547c52" strokeWidth="3" fill="none" /><circle cx={x} cy={y} r={r} fill={color} /><g transform={`translate(${x} ${y})`} stroke="#fff9ed" strokeWidth="1.2" opacity=".48">{Array.from({ length: 7 }, (_, n) => <path key={n} d={`M0 0 L0 ${-r + 5}`} transform={`rotate(${n * 360 / 7})`} />)}</g><circle cx={x} cy={y} r="3" fill="#547c52" opacity=".5" /></g>)}</g>;
  if (kind === 'ivy') return <g><g fill="none" stroke="#53784f" strokeWidth="3.5" strokeLinecap="round"><path d="M-7-56 Q-100-124-90-31 Q-84 28-57 81 Q-26 107-40 123 M8-58 Q103-118 88-24 Q80 37 57 75" /></g>{[[-67, -71, -35], [-91, -36, -16], [-83, 6, -18], [-70, 43, -24], [-51, 80, -35], [-39, 110, 17], [64, -66, 34], [90, -34, 14], [81, 10, 15], [65, 46, 31], [52, 76, 32]].map(([x, y, r], i) => <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}><path d="M0 21 Q-35-2-20-20 Q-5-27 0-12 Q7-29 22-20 Q37-1 0 21" fill={color} /><path d="M0 16 V-13 M0 4 L-12-7 M0 4 L12-7" stroke="#fff9ed" strokeWidth="1.5" opacity=".45" fill="none" /></g>)}{pot}<path d="M0-57 Q-15-84-37-81 Q-57-71-33-61 Q-10-59 0-57 M0-57 Q25-90 43-78 Q51-62 0-57" fill={color} /></g>;
  if (kind === 'succulent') return <g>{pot}<g transform="translate(0 -88)">{Array.from({ length: 10 }, (_, i) => <path key={i} d="M0 10 Q-27-26 0-72 Q24-25 0 10" transform={`rotate(${i * 36})`} fill={color} stroke="#fff9ed" strokeWidth="1.5" strokeOpacity=".45" />)}{Array.from({ length: 6 }, (_, i) => <path key={i} d="M0 8 Q-18-15 0-44 Q17-14 0 8" transform={`rotate(${i * 60 + 18})`} fill={color} stroke="#fff9ed" strokeWidth="1.5" strokeOpacity=".6" />)}<circle r="8" fill="#fff9ed" opacity=".25" /></g></g>;
  if (kind === 'calathea') return <g>{pot}{[[-48, -137, -35], [-10, -175, -13], [40, -150, 29], [65, -93, 56], [-61, -89, -60]].map(([x, y, r], i) => <g key={i}><path d={`M0-57 Q${x * .4} ${y + 33} ${x} ${y}`} stroke="#52785c" strokeWidth="3" fill="none" /><g transform={`translate(${x} ${y}) rotate(${r})`}><path d="M0 35 C-47 5-30-53 0-65 C31-51 43 8 0 35" fill={color} /><path d="M0 31 V-54" stroke="#426448" strokeWidth="2" fill="none" />{[-39, -22, -5, 12].map((at, n) => <path key={n} d={`M0 ${at + 12} Q-13 ${at + 3} -21 ${at - 4} M0 ${at + 12} Q13 ${at + 3} 21 ${at - 4}`} stroke="#426448" strokeWidth="4" strokeLinecap="round" opacity=".62" fill="none" />)}</g></g>)}</g>;
  return <g>{pot}<path d="M0-58 Q7-134 0-178 M0-90 Q-38-113-49-95 Q-25-75 0-90 M3-114 Q37-148 43-125 Q38-107 3-114" fill="#52785c" stroke="#52785c" strokeWidth="4" strokeLinecap="round" />
    <g transform="translate(0 -178)">{Array.from({ length: kind === 'daisy' ? 10 : 6 }, (_, i) => <ellipse key={i} cy={kind === 'daisy' ? -25 : -26} rx={kind === 'daisy' ? 10 : 20} ry={kind === 'daisy' ? 25 : 27} transform={`rotate(${i * (kind === 'daisy' ? 36 : 60)})`} fill={color} />)}<circle r="15" fill="#e4c15c" /><circle cx="-4" cy="-3" r="2" fill="#78633c" /><circle cx="5" cy="-3" r="2" fill="#78633c" /><path d="M-4 4 Q0 8 5 4" stroke="#78633c" strokeWidth="2" strokeLinecap="round" fill="none" /></g></g>;
}

export default function Garden({ onSave }: GameProps) {
  const [garden, setGarden] = usePersistentState<GardenState>('garden-v1', initialGarden);
  const [kind, setKind] = useState<PlantKind>('flower');
  const [color, setColor] = useState('#bc7e8f');
  const [potStyle, setPotStyle] = useState<PotStyle>('classic');
  const [potColor, setPotColor] = useState('#d7917c');
  const [mode, setMode] = useState<'plant' | 'move'>('plant');
  const [size, setSize] = useState(0.95);
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<GardenState[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('Aqui até o cacto tirou férias.');
  const [replacement, setReplacement] = useState<CompositionId | 'blank' | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gardenRef = useRef(garden); gardenRef.current = garden;
  const cancelButton = useRef<HTMLButtonElement>(null);
  const replacementOpener = useRef<HTMLElement | null>(null);
  const sizeBefore = useRef<GardenState | null>(null);
  const drag = useRef<{ id: string; pointerId: number; startX: number; startY: number; x: number; y: number; before: GardenState; moved: boolean } | null>(null);
  const remember = (before: GardenState) => setHistory(old => [...old.slice(-39), before]);
  const replace = (next: GardenState) => { gardenRef.current = next; setGarden(next); };
  const change = (next: GardenState) => { remember(gardenRef.current); replace(next); };
  const selectedPlant = garden.items.find(item => item.id === selected);
  const hasPot = !['butterfly', 'mushroom'].includes(selectedPlant?.kind ?? kind);
  function selectPlant(item: GardenItem) {
    setSelected(item.id); setMode('move'); setKind(item.kind); setColor(item.color); setSize(clamp(item.size, .6, 1.4)); setPotStyle(item.potStyle ?? 'classic'); setPotColor(item.potColor ?? legacyPotColor(item.kind));
  }
  function updateSelected(patch: Partial<GardenItem>, withHistory = true) {
    if (!selected) return;
    const next = { ...gardenRef.current, items: gardenRef.current.items.map(item => item.id === selected ? { ...item, ...patch } : item) };
    if (withHistory) change(next); else replace(next);
  }
  function finishSizeGesture() { if (sizeBefore.current && sizeBefore.current !== gardenRef.current) remember(sizeBefore.current); sizeBefore.current = null; }
  function duplicateSelected() {
    const item = gardenRef.current.items.find(plant => plant.id === selected); if (!item) return;
    const copy: GardenItem = { ...item, id: `plant-${Date.now()}-${randomSeed()}`, x: clamp(item.x + 48, 40, 680), y: clamp(item.y + 16, 110, 645) };
    change({ ...gardenRef.current, items: [...gardenRef.current.items, copy] }); selectPlant(copy); setMessage('Uma irmãzinha para a planta. Não precisa dividir o sol.');
  }
  function askReplacement(next: CompositionId | 'blank') { replacementOpener.current = document.activeElement as HTMLElement; setReplacement(next); }
  function closeReplacement() { setReplacement(null); replacementOpener.current?.focus(); }
  function confirmReplacement() {
    if (!replacement) return;
    const composition = COMPOSITIONS.find(item => item.id === replacement);
    const next: GardenState = composition ? { weather: composition.weather, ground: composition.ground, items: composition.items.map(item => ({ ...item, id: `plant-${Date.now()}-${randomSeed()}` })) } : { ...gardenRef.current, items: [] };
    change(next); setSelected(null); setMode('plant'); closeReplacement(); setMessage(composition ? `${composition.label}, do seu jeito. Tudo pode mudar de lugar.` : 'Um jardim novinho para inventar. O anterior está no Desfazer.');
  }
  useEffect(() => {
    if (!replacement) return; cancelButton.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setReplacement(null); replacementOpener.current?.focus(); } };
    window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape);
  }, [replacement]);
  function plantAt(x: number, y: number) {
    const newItem: GardenItem = { id: `plant-${Date.now()}-${randomSeed()}`, kind, x: clamp(x, 40, 680), y: clamp(y, 105, 645), color, size, rotation: 0, potStyle, potColor };
    change({ ...gardenRef.current, items: [...gardenRef.current.items, newItem] }); setSelected(null);
    setMessage(kind === 'cactus' ? 'Espinhos só no desenho. Aqui ninguém precisa ser forte.' : 'Plantou. Pronto. Nem lembrete de regar vai chegar.');
  }
  function onPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0 || !event.isPrimary || drag.current || replacement) return;
    const position = point(event.currentTarget, event.clientX, event.clientY);
    const id = (event.target as Element).closest('[data-garden-id]')?.getAttribute('data-garden-id');
    const item = gardenRef.current.items.find(i => i.id === id);
    if (item) {
      selectPlant(item); drag.current = { id: item.id, pointerId: event.pointerId, startX: position.x, startY: position.y, x: item.x, y: item.y, before: gardenRef.current, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId); return;
    }
    setSelected(null);
    if (mode !== 'plant') return;
    plantAt(position.x, position.y);
  }
  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!event.isPrimary) return;
    const current = drag.current; if (!current || current.pointerId !== event.pointerId) return;
    const p = point(event.currentTarget, event.clientX, event.clientY);
    const dx = p.x - current.startX, dy = p.y - current.startY;
    if (Math.hypot(dx, dy) < 3 && !current.moved) return;
    current.moved = true;
    replace({ ...gardenRef.current, items: gardenRef.current.items.map(item => item.id === current.id ? { ...item, x: clamp(current.x + dx, 35, 685), y: clamp(current.y + dy, 100, 650) } : item) });
  }
  function finishDrag(event: ReactPointerEvent<SVGSVGElement>) { if (!event.isPrimary || drag.current?.pointerId !== event.pointerId) return; if (drag.current.moved) remember(drag.current.before); drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }
  function undo() { if (!history.length) return; replace(history[history.length - 1]); setHistory(old => old.slice(0, -1)); setSelected(null); setMessage('Voltamos um passinho. Sem bronca da samambaia.'); }
  function removeSelected() { if (!selected) return; change({ ...gardenRef.current, items: gardenRef.current.items.filter(i => i.id !== selected) }); setSelected(null); }
  function rotateSelected() { const item = gardenRef.current.items.find(i => i.id === selected); if (item) updateSelected({ rotation: (item.rotation + 15) % 360 }); }
  async function save() {
    if (!svgRef.current || saving) return; finishSizeGesture(); setSaving(true);
    try {
      const copy = svgRef.current.cloneNode(true) as SVGSVGElement; copy.querySelectorAll('[data-export-hide]').forEach(element => element.remove());
      await onSave({ kind: 'garden', title: 'Meu jardim de bolso', dataUrl: await svgToDataUrl(copy) }); setMessage('Seu jardim foi morar na galeria. Sem condomínio.');
    } catch { setMessage('O jardim não conseguiu ir para a galeria. Tente de novo.'); } finally { setSaving(false); }
  }
  const night = garden.weather === 'night';
  const ground = { linen: '#eee4ce', rose: '#efdcd4', sage: '#dce4d2' }[garden.ground];
  return <div className="nature-game garden-game nature-garden-expanded">
    <div className="nature-intro"><span className="nature-eyebrow">um mundo que não pede nada</span><p>Uma folha, uma flor e um lugar bonito para inventar do seu jeito.</p></div>
    <div className="game-toolbar nature-toolbar">
      <div className="segmented" aria-label="Modo do jardim"><button type="button" aria-pressed={mode === 'plant'} onClick={() => { setSelected(null); setMode('plant'); }}>Plantar</button><button type="button" aria-pressed={mode === 'move'} onClick={() => setMode('move')}>Arrumar</button></div>
      <div className="segmented" aria-label="Clima do jardim">{(['day', 'night', 'rain'] as const).map((weather, i) => <button type="button" key={weather} aria-pressed={garden.weather === weather} onClick={() => change({ ...garden, weather })}>{['Solzinho', 'Lua', 'Chuvinha'][i]}</button>)}</div>
    </div>
    <details className="nature-garden-inspiration"><summary>Três cantinhos para começar</summary><div className="nature-garden-compositions">{COMPOSITIONS.map(composition => <button type="button" key={composition.id} className="nature-garden-composition" onClick={() => askReplacement(composition.id)} aria-label={`Começar ${composition.label}`}><svg viewBox="0 0 180 105" aria-hidden="true"><rect width="180" height="105" rx="15" fill={composition.ground === 'sage' ? '#e2e9d8' : composition.ground === 'rose' ? '#f3e2d7' : '#f4eddd'} /><path d="M0 88 Q82 72 180 89 V105 H0Z" fill="#c8d5b8" opacity=".5" />{composition.items.slice(0, 4).map((item, index) => <g key={index} transform={`translate(${28 + index * 42} ${96 - index % 2 * 5}) scale(.28)`}><PlantArt kind={item.kind} color={item.color} potStyle={item.potStyle} potColor={item.potColor} /></g>)}</svg><strong>{composition.label}</strong><span>{composition.caption}</span></button>)}</div><p>São só pontos de partida. Cada vasinho continua seu para mexer.</p></details>
    <div className="nature-workspace">
      <div className="game-canvas nature-canvas garden-canvas">
        <svg ref={svgRef} viewBox="0 0 720 700" aria-label="Jardim de bolso. Toque para plantar e arraste as plantas para organizar." role="group" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag}>
          <defs><linearGradient id="garden-sky" x1="0" y1="0" x2="0" y2="1"><stop stopColor={night ? '#253a3c' : garden.weather === 'rain' ? '#d8e0dd' : '#f7efdb'} /><stop offset="1" stopColor={night ? '#51645e' : '#faf5e9'} /></linearGradient><pattern id="garden-dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".8" fill={night ? '#e9e7d2' : '#b9b39c'} opacity=".25" /></pattern></defs>
          <rect width="720" height="700" rx="28" fill="url(#garden-sky)" /><rect width="720" height="700" rx="28" fill="url(#garden-dots)" />
          <path d="M0 407 Q84 325 188 397 Q272 324 358 391 Q503 298 720 408 V529 H0Z" fill={night ? '#49695d' : '#d9e1cb'} opacity=".63" /><path d="M0 450 Q92 385 190 434 Q348 373 437 443 Q592 366 720 435 V558 H0Z" fill={night ? '#526f5e' : '#cad7ba'} opacity=".52" />
          <g fill={night ? '#3d5b50' : '#abc09f'} opacity=".48"><path d="M4 448 V294 Q-35 262-7 233 Q-25 201 9 187 Q39 181 45 211 Q70 219 53 247 Q83 280 30 304 V448Z" /><path d="M692 437 V289 Q664 270 678 246 Q658 219 692 208 Q722 197 735 221 Q759 247 731 275 Q750 300 711 311 V437Z" /></g>
          <path d="M0 494 Q166 455 358 493 T720 483 V700 H0Z" fill={night ? '#657464' : ground} /><path d="M0 581 Q175 554 365 579 T720 570" fill="none" stroke={night ? '#829079' : '#d7c8b0'} strokeWidth="2" />
          <path d="M68 258 Q125 233 194 258 M524 311 Q577 292 640 311" fill="none" stroke={night ? '#779084' : '#d9d3bd'} strokeWidth="2" />
          {night ? <g><path d="M590 71 A42 42 0 1 0 636 130 A38 38 0 0 1 590 71" fill="#f3dfab" />{[[88, 87], [242, 62], [449, 125], [134, 183], [536, 53], [651, 230], [335, 199]].map(([x, y], i) => <path key={i} d={`M${x - 5} ${y} h10 M${x} ${y - 5} v10`} stroke="#efe7c8" strokeWidth="2" strokeLinecap="round" />)}</g> : garden.weather === 'rain' ? <g><path d="M439 133 Q425 85 478 79 Q482 38 531 51 Q572 15 594 65 Q638 49 653 91 Q691 118 663 142Z" fill="#bbc9c5" />{Array.from({ length: 17 }, (_, i) => <path key={i} d={`M${72 + (i * 83) % 591} ${147 + (i * 69) % 271} l-7 16`} stroke="#8aa9ba" strokeWidth="3" opacity=".55" strokeLinecap="round" />)}<path d="M83 158 Q136 100 185 158" stroke="#d7917c" strokeWidth="9" fill="none" opacity=".55" /><path d="M90 158 Q136 114 178 158" stroke="#e4c15c" strokeWidth="8" fill="none" opacity=".6" /></g> : <g><circle cx="590" cy="105" r="38" fill="#e4c15c" opacity=".83" />{Array.from({ length: 8 }, (_, i) => <path key={i} transform={`rotate(${i * 45} 590 105)`} d="M590 50 V39" stroke="#e4c15c" strokeWidth="3" strokeLinecap="round" />)}<path d="M75 102 Q70 69 103 70 Q120 43 144 68 Q177 59 183 90 Q202 105 178 113H93Z" fill="#fff9ed" /></g>}
          <text x="46" y="654" fill={night ? '#e8e5d1' : '#817c67'} fontSize="15" fontFamily="DM Sans, sans-serif">jardim da Leh</text><path d="M604 647 q12-18 24 0 q12-18 24 0" stroke={night ? '#a6b497' : '#97ad83'} strokeWidth="2" fill="none" />
          {garden.items.map(item => <g key={item.id} data-garden-id={item.id} transform={`translate(${item.x} ${item.y}) rotate(${item.rotation}) scale(${item.size})`} className="garden-item" tabIndex={0} role="button" aria-label={`${PLANTS.find(p => p.kind === item.kind)?.label}. Arraste para mover ou use as setas.`} onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectPlant(item); }
            if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); change({ ...gardenRef.current, items: gardenRef.current.items.filter(i => i.id !== item.id) }); setSelected(null); }
            const directions: Record<string, [number, number]> = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] };
            if (directions[event.key]) { event.preventDefault(); const [dx, dy] = directions[event.key]; change({ ...gardenRef.current, items: gardenRef.current.items.map(i => i.id === item.id ? { ...i, x: clamp(i.x + dx, 35, 685), y: clamp(i.y + dy, 100, 650) } : i) }); }
          }}><rect x="-115" y={item.kind === 'butterfly' ? -90 : -249} width="230" height={item.kind === 'butterfly' ? 150 : item.kind === 'ivy' ? 395 : 269} fill="transparent" />{selected === item.id && <ellipse data-export-hide="true" cy="19" rx="64" ry="17" fill="none" stroke={night ? '#fff9ed' : '#697f67'} strokeWidth="2" strokeDasharray="4 5" />}<PlantArt kind={item.kind} color={item.color} potStyle={item.potStyle} potColor={item.potColor} /></g>)}
        </svg>
      </div>
      <div className="nature-controls nature-garden-controls">
        <div className="nature-garden-plant-picker"><span className="control-label">O que vai brotar?</span><div className="nature-stamp-list nature-garden-species">{PLANTS.map(plant => <button className={`nature-stamp-button ${kind === plant.kind && !selected ? 'is-active' : ''}`} key={plant.kind} type="button" aria-pressed={kind === plant.kind && !selected} onClick={() => { setKind(plant.kind); setColor(PLANT_COLORS[plant.kind] ?? color); setSelected(null); setMode('plant'); }}><svg viewBox={plant.kind === 'ivy' ? '-125 -245 250 385' : '-125 -249 250 280'} aria-hidden="true"><PlantArt kind={plant.kind} color={PLANT_COLORS[plant.kind] ?? color} potStyle={potStyle} potColor={potColor} /></svg><span>{plant.label}</span></button>)}</div><button className="soft-button nature-place-button" type="button" onClick={() => { setMode('plant'); plantAt(150 + randomSeed() % 420, 365 + randomSeed() % 190); }}>Plantar no jardim</button></div>
        {selectedPlant && <div className="nature-garden-selected"><span>Você está mexendo em</span><strong>{PLANTS.find(plant => plant.kind === selectedPlant.kind)?.label}</strong><button type="button" className="soft-button" onClick={() => { setSelected(null); setMode('plant'); }}>Voltar a plantar</button></div>}
        <div><span className="control-label">{selectedPlant ? 'Cor desta planta' : 'Uma cor para a planta'}</span><Palette value={selectedPlant?.color ?? color} onChange={next => { setColor(next); if (selectedPlant) updateSelected({ color: next }); }} /></div>
        {hasPot ? <><div className="nature-garden-pot-picker"><span className="control-label">O vasinho também tem personalidade</span><div className="nature-garden-pots">{POTS.map(pot => <button type="button" key={pot.style} className={`nature-garden-pot ${pot.style === (selectedPlant?.potStyle ?? potStyle) ? 'is-active' : ''}`} aria-pressed={pot.style === (selectedPlant?.potStyle ?? potStyle)} aria-label={`Vaso ${pot.label}`} onClick={() => { setPotStyle(pot.style); if (selectedPlant) updateSelected({ potStyle: pot.style }); }}><svg viewBox="-63 -72 126 101" aria-hidden="true"><Pot style={pot.style} color={selectedPlant?.potColor ?? potColor} /></svg><span>{pot.label}</span></button>)}</div></div><div><span className="control-label">Cor do vasinho</span><Palette value={selectedPlant?.potColor ?? potColor} onChange={next => { setPotColor(next); if (selectedPlant) updateSelected({ potColor: next }); }} /></div></> : <p className="nature-garden-free-creature">Cogumelos e borboletas preferem ficar soltos.</p>}
        <label className="nature-range control-label">{selectedPlant ? 'Tamanho desta planta' : 'Tamanho da próxima plantinha'}<input aria-label={selectedPlant ? 'Tamanho da planta selecionada' : 'Tamanho da próxima planta'} type="range" min="0.6" max="1.4" step="0.05" value={selectedPlant ? clamp(selectedPlant.size, .6, 1.4) : size} onPointerDown={() => { if (selectedPlant) sizeBefore.current = gardenRef.current; }} onPointerUp={finishSizeGesture} onPointerCancel={finishSizeGesture} onBlur={finishSizeGesture} onChange={e => { const next = Number(e.target.value); setSize(next); if (selectedPlant) updateSelected({ size: next }, !sizeBefore.current); }} /></label>
        <div><span className="control-label">Chão do jardim</span><div className="segmented">{(['linen', 'rose', 'sage'] as const).map((tone, i) => <button key={tone} type="button" aria-pressed={garden.ground === tone} onClick={() => change({ ...garden, ground: tone })}>{['Linho', 'Argila', 'Sálvia'][i]}</button>)}</div></div>
      </div>
    </div>
    <div className="game-toolbar nature-actions nature-garden-actions"><button className="soft-button" type="button" onClick={undo} disabled={!history.length}>Desfazer</button><button className="soft-button" type="button" onClick={duplicateSelected} disabled={!selected}>Duplicar planta</button><button className="soft-button" type="button" onClick={rotateSelected} disabled={!selected}>Girar planta</button><button className="soft-button" type="button" onClick={removeSelected} disabled={!selected}>Retirar planta</button><button className="soft-button" type="button" onClick={() => askReplacement('blank')}>Novo jardim</button><button className="primary-button" type="button" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar jardim'}</button></div>
    <p className="game-note nature-note" role="status">{message}</p><p className="nature-hint">Toque num espaço livre para plantar. Arraste uma plantinha para mudar de lugar. Tudo fica guardado aqui.</p>
    {replacement && <div className="nature-garden-dialog-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) closeReplacement(); }}><section className="nature-garden-dialog" role="dialog" aria-modal="true" aria-labelledby="nature-garden-replace-title" onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button'); const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}><span className="nature-eyebrow">uma nova composição</span><h2 id="nature-garden-replace-title">{replacement === 'blank' ? 'Abrir um jardim em branco?' : 'Trocar a composição do jardim?'}</h2><p>Seu jardim atual só muda quando você escolher continuar. Depois, pode usar Desfazer enquanto este jardim estiver aberto.</p><div><button ref={cancelButton} type="button" className="soft-button" onClick={closeReplacement}>Ficar com o meu</button><button type="button" className="primary-button" onClick={confirmReplacement}>{replacement === 'blank' ? 'Começar em branco' : 'Usar essa composição'}</button></div></section></div>}
  </div>;
}
