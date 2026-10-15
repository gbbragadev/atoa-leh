import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from '../lib/types';
import { usePersistentState } from '../lib/storage';
import { randomSeed, seededRandom, svgToDataUrl } from '../lib/art';
import './word-games.css';

export const MEMORY_OBJECTS = [
  { id: 'cat', name: 'Gatinho de folga', color: '#d6a384' }, { id: 'plant', name: 'Monstera feliz', color: '#7f9b73' },
  { id: 'yarn', name: 'Novelo do aconchego', color: '#be91a1' }, { id: 'mug', name: 'Caneca de cerâmica', color: '#b79b78' },
  { id: 'flower', name: 'Flor de janela', color: '#dca9a3' }, { id: 'pot', name: 'Vasinho de barro', color: '#bf8d73' },
  { id: 'bear', name: 'Ursinho companheiro', color: '#ac957f' }, { id: 'mobile', name: 'Móbile de nuvens', color: '#9aacc0' },
  { id: 'bird', name: 'Passarinho curioso', color: '#c6ad72' }, { id: 'mittens', name: 'Luvas de crochê', color: '#a9a0c0' },
  { id: 'shell', name: 'Conchinha de cerâmica', color: '#c1a296' }, { id: 'cushion', name: 'Almofada de cochilo', color: '#8ba79c' },
  { id: 'van', name: 'Kombinha ao sol', color: '#d8bb71' }, { id: 'duck', name: 'Patinho de banho', color: '#ddc17a' },
] as const;
type ObjectId = typeof MEMORY_OBJECTS[number]['id'];
type PairState = { seed: number; count: 6 | 8; matched: ObjectId[] };

export function createMemoryCards(seed: number, count: number) {
  const random = seededRandom(seed);
  const shuffle = <T,>(input: readonly T[]) => {
    const items = [...input];
    for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
    return items;
  };
  const selected = shuffle(MEMORY_OBJECTS).slice(0, count);
  return shuffle(selected.flatMap(item => [{ ...item, pair: 0 }, { ...item, pair: 1 }]));
}

function ObjectDrawing({ id, color }: { id: ObjectId; color: string }) {
  const shared = { stroke: '#5e6654', strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return <svg viewBox="0 0 100 100" width="100" height="100" aria-hidden="true" className="memory-object" fill="none" {...shared}>
    {id === 'cat' && <><path d="M24 48 L21 22 L42 35 Q51 31 60 35 L79 22 L76 49 Q85 84 50 86 Q15 85 24 48Z" fill={color}/><path d="M34 55 Q39 61 43 55 M57 55 Q61 61 66 55 M47 67 L53 67 L50 71Z"/><path d="M42 71 Q45 77 50 71 Q55 77 59 71 M22 63 L10 60 M22 70 L10 72 M78 63 L90 60 M78 70 L90 72"/></>}
    {id === 'plant' && <><path d="M49 79 L50 41 M50 65 Q32 63 28 43 M50 54 Q67 52 75 35"/><path d="M49 50 Q19 47 23 20 Q48 20 49 50Z M53 39 Q48 13 80 17 Q82 43 53 39Z M55 66 Q60 42 84 50 Q82 78 55 66Z" fill={color}/><path d="M29 32 L42 40 M67 26 L57 33 M68 59 L59 65" stroke="#edf1e4"/><path d="M32 76 L68 76 L63 94 L38 94Z" fill="#d6af92"/></>}
    {id === 'yarn' && <><circle cx="47" cy="54" r="30" fill={color}/><path d="M23 38 Q41 36 71 49 M19 49 Q42 47 72 61 M19 61 Q41 61 66 73 M39 25 Q28 46 42 83 M53 25 Q41 47 55 80 M60 29 Q48 49 64 75 M71 61 Q78 71 87 66 Q96 60 89 53"/><path d="M26 17 L71 84 M36 13 L78 78" stroke="#f4e9dc" strokeWidth="4"/><path d="M26 17 L30 13 M36 13 L40 9"/></>}
    {id === 'mug' && <><path d="M26 39 L67 39 L65 72 Q63 85 46 85 Q29 85 28 72Z" fill={color}/><path d="M67 44 Q87 41 85 57 Q84 73 67 69 M38 30 Q28 22 38 14 M53 30 Q43 22 53 14 M21 88 L77 88"/><path d="M34 51 Q46 43 60 51" stroke="#f6eadc"/></>}
    {id === 'flower' && <><path d="M50 84 L50 44 M50 67 Q24 64 23 50 Q49 50 50 67 M51 76 Q75 72 76 58 Q55 57 51 76" fill="#a5b18b"/><path d="M49 24 Q34 8 27 25 Q13 35 30 44 Q23 62 43 56 Q52 73 61 55 Q79 61 75 43 Q94 32 75 25 Q67 8 55 22Z" fill={color}/><circle cx="51" cy="38" r="11" fill="#ead195"/><path d="M32 88 L69 88"/></>}
    {id === 'pot' && <><path d="M26 48 L74 48 L67 88 L33 88Z" fill={color}/><rect x="22" y="42" width="56" height="11" rx="4" fill={color}/><path d="M50 42 L50 15 M50 31 Q28 28 29 13 Q49 13 50 31 M52 26 Q73 26 73 10 Q53 9 52 26" fill="#a3b085"/><path d="M36 63 Q50 57 65 63 M39 75 Q51 70 62 75" stroke="#e9cdb2"/></>}
    {id === 'bear' && <><circle cx="26" cy="25" r="12" fill={color}/><circle cx="74" cy="25" r="12" fill={color}/><circle cx="50" cy="42" r="28" fill={color}/><ellipse cx="50" cy="76" rx="25" ry="17" fill={color}/><ellipse cx="50" cy="51" rx="16" ry="12" fill="#ead9c4"/><path d="M45 47 L55 47 L50 52Z" fill="#5e6654"/><path d="M50 52 L50 57 M36 39 L36 40 M64 39 L64 40"/><path d="M25 72 L17 83 M75 72 L83 83"/><path d="M41 66 L50 71 L59 66 L58 76 L50 71 L42 76Z" fill="#b18b91"/></>}
    {id === 'mobile' && <><path d="M50 10 L50 22 M17 30 Q50 13 83 30 M24 28 L24 46 M50 22 L50 63 M76 28 L76 43"/><path d="M10 62 Q4 53 13 49 Q14 38 25 42 Q34 38 36 49 Q44 53 38 62Z M37 79 Q31 70 40 66 Q42 56 51 60 Q60 56 63 67 Q71 72 64 80Z M64 60 Q58 51 65 48 Q67 36 78 40 Q85 38 88 48 Q97 54 90 62Z" fill={color}/><path d="M15 60 L31 60 M44 77 L58 77" stroke="#edf0ed"/></>}
    {id === 'bird' && <><path d="M24 53 Q20 34 44 31 Q63 10 75 32 Q89 36 83 57 Q77 82 41 79 L18 69 L30 66Z" fill={color}/><path d="M79 39 L93 44 L80 48Z" fill="#d7a17e"/><circle cx="70" cy="35" r="2" fill="#5e6654"/><path d="M40 49 Q63 40 66 58 Q55 71 41 65 M43 80 L41 91 M58 79 L60 91 M34 92 L46 92 M54 92 L66 92"/></>}
    {id === 'mittens' && <><path d="M17 65 L17 32 Q17 20 27 20 Q40 20 40 32 L40 47 Q53 34 58 44 Q63 53 41 71 L40 80 L20 80Z" fill={color}/><path d="M55 73 L59 38 Q60 26 70 27 Q81 29 79 43 L78 58 Q88 50 93 58 Q98 65 78 81 L76 89 L57 87Z" fill={color}/><path d="M19 67 L41 68 M58 76 L78 79 M24 34 L33 35 M23 42 L33 43 M66 43 L74 45 M64 51 L73 53" stroke="#eee7ef"/></>}
    {id === 'shell' && <><path d="M20 64 Q7 40 30 29 Q43 9 56 23 Q83 18 88 43 Q100 57 82 70 L55 89 L46 88Z" fill={color}/><path d="M50 84 L23 49 M50 84 L35 33 M50 84 L52 27 M53 82 L73 35 M55 84 L83 53" stroke="#eee0d4"/><path d="M43 84 Q51 76 59 84 L57 93 L45 93Z" fill="#d9c5b0"/></>}
    {id === 'cushion' && <><path d="M17 23 Q48 33 80 22 Q71 51 82 80 Q49 73 17 82 Q28 51 17 23Z" fill={color}/><path d="M25 32 Q48 38 72 31 Q66 51 73 73 Q49 67 26 75 Q33 52 25 32Z"/><path d="M42 48 L50 42 L58 48 L56 59 L44 59Z" fill="#eadbd0"/><path d="M20 23 L13 17 M80 22 L87 16 M82 80 L90 87 M17 82 L10 90"/></>}
    {id === 'van' && <><path d="M14 28 Q49 17 84 28 L88 74 L12 74Z" fill={color}/><path d="M19 34 L46 32 L46 51 L16 54Z M53 32 L79 35 L83 54 L53 51Z" fill="#dfe9e0"/><path d="M12 58 Q50 70 86 58 M50 33 L50 68 M21 63 L28 63 M72 63 L79 63"/><circle cx="29" cy="78" r="9" fill="#727565"/><circle cx="72" cy="78" r="9" fill="#727565"/><circle cx="29" cy="78" r="3" fill="#eadcca"/><circle cx="72" cy="78" r="3" fill="#eadcca"/><path d="M41 25 L42 16 L62 17 L62 24"/></>}
    {id === 'duck' && <><path d="M19 58 Q25 39 44 46 Q35 28 49 19 Q68 9 76 27 Q82 39 68 48 Q84 54 79 70 Q70 90 42 82 Q15 77 19 58Z" fill={color}/><path d="M76 31 L92 34 L76 41Z" fill="#d9956d"/><circle cx="66" cy="29" r="2" fill="#5e6654"/><path d="M34 57 Q46 48 61 59 Q56 73 42 70 M12 88 Q29 96 43 88 Q56 81 69 89 Q83 95 94 87"/></>}
  </svg>;
}

export default function Memory({ onSave }: GameProps) {
  const [state, setState] = usePersistentState<PairState>('memory-v1', () => ({ seed: randomSeed(), count: 6, matched: [] }));
  const cards = useMemo(() => createMemoryCards(state.seed, state.count), [state.seed, state.count]);
  const [open, setOpen] = useState<number[]>([]);
  const [notice, setNotice] = useState('As coisinhas do cantinho vieram em dupla. Quem será vizinho de quem?');
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const artRef = useRef<SVGSVGElement>(null);
  const complete = state.matched.length === state.count;
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  function fresh(count = state.count) {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setOpen([]); setState({ seed: randomSeed(), count, matched: [] }); setNotice('Todos trocaram de lugar. Bem a cara de um gato organizando a casa.');
  }
  function flip(index: number) {
    if (open.length >= 2 || open.includes(index) || state.matched.includes(cards[index].id)) return;
    if (!open.length) { setOpen([index]); return; }
    const first = open[0]; setOpen([first, index]);
    if (cards[first].id === cards[index].id) {
      const matched = [...state.matched, cards[index].id];
      setState(s => ({ ...s, matched })); setOpen([]);
      setNotice(matched.length === state.count ? 'Todos juntos! Nem o novelo ficou sem companhia.' : `${cards[index].name}: dupla reunida. Um pequeno encontro feliz.`);
    } else {
      setNotice('Esses dois só vieram dar um oi. Já já voltam para o cobertorzinho.');
      timerRef.current = setTimeout(() => { setOpen([]); timerRef.current = null; }, 1150);
    }
  }
  async function save() {
    if (!artRef.current) return; setSaving(true);
    try { await onSave({ kind: 'Pequenos pares', title: 'Todo mundo encontrou companhia', dataUrl: await svgToDataUrl(artRef.current) }); setNotice('Esse encontro feliz ficou guardado nas lembranças.'); }
    catch { setNotice('Não foi possível guardar a lembrança agora. Tente outra vez.'); }
    finally { setSaving(false); }
  }
  const objects = cards.filter(card => card.pair === 0);
  return <section className="memory-game">
    <div className="game-toolbar"><div className="segmented" aria-label="Quantidade de pares">{([6, 8] as const).map(count => <button aria-pressed={state.count === count} className={state.count === count ? 'active' : ''} key={count} onClick={() => { if (count !== state.count) fresh(count); }}>{count} pares</button>)}</div><button className="soft-button" onClick={() => fresh()}>Misturar de novo</button></div>
    <p className="game-note">Vire duas cartas para encontrar as companheiras. Sem relógio, sem pontuação, sem bronca do novelo.</p>
    <div className={`memory-board game-canvas memory-count-${state.count}`} aria-label="Cartinhas de pequenos pares">{cards.map((card, index) => {
      const matched = state.matched.includes(card.id), visible = matched || open.includes(index);
      return <button className={`memory-card${visible ? ' is-open' : ''}${matched ? ' is-matched' : ''}`} key={`${state.seed}-${card.id}-${card.pair}`} disabled={matched || open.length >= 2} aria-pressed={visible} aria-label={`Carta ${index + 1}, ${visible ? `${card.name}${matched ? ', par encontrado' : ''}` : 'fechada'}`} onClick={() => flip(index)}>
        <span className="memory-card-inner"><span className="memory-card-back" aria-hidden="true"><svg viewBox="0 0 100 100" fill="none"><path d="M50 77 Q20 63 22 39 Q24 25 38 30 Q49 19 62 30 Q78 25 80 41 Q80 65 50 77Z" fill="#e4dec8" stroke="#8a957b" strokeWidth="2"/><path d="M50 72 L50 42 M50 61 Q31 57 34 44 Q49 43 50 61 M51 52 Q69 51 68 37 Q53 37 51 52" stroke="#8a957b" strokeWidth="2"/></svg><span>um tantinho de nada</span></span><span className="memory-card-front" aria-hidden="true"><ObjectDrawing id={card.id} color={card.color}/><span>{card.name}</span>{matched && <i className="memory-check">✓</i>}</span></span>
      </button>;
    })}</div>
    <div className="memory-footer"><span className="words-progress">{state.matched.length} de {state.count} duplinhas juntas</span>{complete && <button className="primary-button" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar lembrança'}</button>}</div>
    <p className="words-notice" role="status" aria-live="polite">{notice}</p>
    <svg ref={artRef} className="words-save-art" aria-hidden="true" viewBox="0 0 600 660"><rect width="600" height="660" rx="30" fill="#faf6ec"/><text x="300" y="65" textAnchor="middle" fontFamily="Georgia" fontSize="29" fill="#657454">Pequenos encontros felizes</text>{objects.map((object, index) => <g key={object.id} transform={`translate(${70 + index % 3 * 165}, ${110 + Math.floor(index / 3) * 160})`}><rect width="135" height="135" rx="20" fill="#eee9db"/><g transform="translate(17 8) scale(.96)"><ObjectDrawing id={object.id} color={object.color}/></g><text x="67" y="124" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fill="#657454">{object.name}</text></g>)}<text x="300" y="620" textAnchor="middle" fontFamily="Georgia" fontSize="19" fill="#657454">Para Letícia. Todo carinho tem companhia.</text></svg>
  </section>;
}
