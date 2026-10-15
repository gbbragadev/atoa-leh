import { useRef, useState } from 'react';
import { svgToDataUrl } from '../lib/art';
import { usePersistentState } from '../lib/storage';
import type { GameProps } from '../lib/types';
import './nature-games.css';

type CatId = 'pantufa' | 'farofa' | 'soneca';
type CatAction = 'pet' | 'yarn' | 'feather' | 'duck' | 'box';
type CatScene = 'afternoon' | 'rain' | 'night';
type CatState = { cat: CatId; action: CatAction; scene: CatScene; moment: number };
const CATS: { id: CatId; name: string; job: string }[] = [
  { id: 'pantufa', name: 'O malhado', job: 'diretor de almofadas' },
  { id: 'farofa', name: 'O laranjinha', job: 'fiscal de absolutamente nada' },
  { id: 'soneca', name: 'A sonequinha', job: 'gerente de cochilos' },
];
const ACTIONS: { id: CatAction; label: string }[] = [{ id: 'pet', label: 'Carinho' }, { id: 'yarn', label: 'Novelinho' }, { id: 'feather', label: 'Varinha' }, { id: 'duck', label: 'Patinho' }, { id: 'box', label: 'Caixinha' }];
const PHRASES: Record<CatAction, Record<CatId, string[]>> = {
  pet: {
    pantufa: ['Hoje eu trabalhei. Trabalhei minha posição no sofá.', 'Plantão encerrado. Sofá de portas abertas.', 'Se for urgente, avisa a almofada.'],
    farofa: ['Eu ia fazer alguma coisa. Felizmente passou.', 'Minha produtividade de hoje: ficar macio.', 'Pode descansar. Eu já estou dando o exemplo.'],
    soneca: ['Reunião cancelada. A pauta era cochilo.', 'Leh, querida: até flores fecham para descansar.', 'Seu currículo já é ótimo. Agora vem ser almofada.'],
  },
  yarn: {
    pantufa: ['Não é bagunça. É crochê experimental.', 'Fiz um nó. Chamei de arte contemporânea.', 'Eu apoio seu crochê. Principalmente sentado em cima.'],
    farofa: ['Uma carreira de crochê, zero carreira corporativa.', 'A receita diz: dois pontos baixos e um gato no caminho.', 'A lã está sob minha supervisão. Supervisão deitada.'],
    soneca: ['A manta é sua. A aprovação é minha.', 'Crochê: o único prazo é quando der vontade.', 'O novelo veio até mim. Eu respeito o destino.'],
  },
  feather: {
    pantufa: ['Uma pena voando. Finalmente uma demanda aceitável.', 'Caçador profissional. Jornada de três segundos.', 'Estou ocupado. Com isso aqui que não serve pra nada.'],
    farofa: ['Fui contratado para ser fofo. Isso é hora extra.', 'A pena tentou fugir. Achei uma atitude antiprofissional.', 'Movimentação intensa. Depois, seis horas de sofá.'],
    soneca: ['Por essa pena eu levanto UMA patinha.', 'É uma dança. Mas a cama participa bastante.', 'Exercício do dia feito. A patinha saiu do lugar.'],
  },
  duck: {
    pantufa: ['O patinho entrou na equipe. Cargo: quá-lidade de vida.', 'Ele não responde e-mail. Excelente contratação.', 'Se ele disser quá, a gente diz tá.'],
    farofa: ['Meu novo colega só fala quá.', 'Um patinho de borracha. Zero boletos. Respeito.', 'Amizade aprovada. Ele também tem cara de quem cochila.'],
    soneca: ['Bebê patinho, veterana sonequinha. Uma bela dupla.', 'Silêncio no berçário dos brinquedos, por favor.', 'O patinho já tomou banho. Eu optei por não participar.'],
  },
  box: {
    pantufa: ['Apartamento novo. Conceito aberto. Aluguel: um carinho.', 'Se eu couber, o projeto está aprovado.', 'Home office encerrado. Home caixa inaugurado.'],
    farofa: ['Comprei nada. Ganhei uma caixa. Excelente negócio.', 'A cobertura é de papelão, mas a vista é ótima.', 'Não é pequeno. É aconchego sob medida.'],
    soneca: ['Spa de papelão. Sem agendamento.', 'Meu retiro particular tem quatro abas.', 'Caixa vazia, agenda vazia. Que combinação.'],
  },
};
function wrapText(text: string, limit = 48) {
  const lines: string[] = []; let line = '';
  for (const word of text.split(' ')) { if (line && `${line} ${word}`.length > limit) { lines.push(line); line = word; } else line = line ? `${line} ${word}` : word; }
  if (line) lines.push(line); return lines;
}

function TinyToy({ kind, x = 0, y = 0, scale = 1 }: { kind: CatAction; x?: number; y?: number; scale?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    {kind === 'pet' && <g fill="#d7917c"><path d="M0 14 C-33-3-23-33-5-17 C12-36 39-13 0 14Z" /><path d="M-33-15 l-8-5 M32-21 l9-6" stroke="#d7917c" strokeWidth="3" strokeLinecap="round" /></g>}
    {kind === 'yarn' && <g><path d="M24 12 Q39 40 70 24 Q78 5 107 14" fill="none" stroke="#bc7e8f" strokeWidth="3" strokeLinecap="round" /><circle r="30" fill="#bc7e8f" /><g fill="none" stroke="#f5ddd9" strokeWidth="2" opacity=".8"><path d="M-25-15 Q14-18 24 16 M-28-6 Q-2-11 22 22 M-23 13 Q-11-6 11-27 M-10 27 Q-10 1 20-22 M-25 15 Q-2 28 24 13" /></g></g>}
    {kind === 'feather' && <g><path d="M-30 36 L33-40 Q65-31 60 4" stroke="#8b765c" strokeWidth="5" fill="none" strokeLinecap="round" /><path d="M60 4 Q47 37 22 22 Q27-4 60 4" fill="#8aa9ba" /><path d="M60 4 L27 24" stroke="#fff9ed" strokeWidth="2" /></g>}
    {kind === 'duck' && <g><path d="M-25 0 Q-29 35 5 36 Q38 36 37 13 Q24 28 13 4Z" fill="#e4c15c" /><circle cx="-6" cy="-6" r="21" fill="#efcf70" /><path d="M-26-8 L-43-1 L-24 4" fill="#d7917c" /><circle cx="-14" cy="-10" r="3" fill="#514c40" /><path d="M9 11 Q26 9 22 24 Q12 25 9 11" fill="#cfad4c" /></g>}
    {kind === 'box' && <g><path d="M-44-12 H44 V41 L-39 34Z" fill="#c6a882" /><path d="M-44-12 L-63-31 H17 L44-12 M44-12 L60-26 V16 L44 31" fill="#e0c6a2" /><path d="M-10-12 V37" stroke="#b38f68" strokeWidth="2" /><path d="M-30 10 H-12" stroke="#856b50" strokeWidth="3" strokeLinecap="round" /></g>}
  </g>;
}

function CatDrawing({ id, name, x, y, active, action, moment, onPet }: { id: CatId; name: string; x: number; y: number; active: boolean; action: CatAction; moment: number; onPet: () => void }) {
  const fur = { pantufa: '#fff9ed', farofa: '#d3a06a', soneca: '#e4d6bd' }[id];
  const ink = '#655747';
  const playing = active && (action === 'yarn' || action === 'feather');
  const happy = active && action === 'pet';
  return <g transform={`translate(${x} ${y})`} className={`cats-character ${active ? 'cats-character-active' : ''}`} role="button" tabIndex={0} aria-label={`Fazer carinho em ${name}`} onClick={onPet} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPet(); } }}>
    <ellipse cy="34" rx="94" ry="19" fill="#38483e" opacity=".12" />
    {active && <ellipse data-export-hide="true" cy="41" rx="91" ry="21" fill="none" stroke="#fff9ed" strokeWidth="2" strokeDasharray="4 6" />}
    <path d={playing ? 'M46 17 Q115 12 101-47 Q87-72 81-51 Q108-2 55-1' : 'M45 18 Q118 49 106 11 Q101-5 87 1 Q87 26 53 9'} stroke={id==='soneca'?'#695543':fur} strokeWidth="21" fill="none" strokeLinecap="round" />
    <path d={id==='farofa'?'M-75-2 Q-87-72-11-79 Q73-91 84-14 Q89 33 32 38 H-23 Q-76 36-75-2':'M-64-2 Q-73-72-11-79 Q61-91 70-14 Q77 33 32 38 H-23 Q-60 36-64-2'} fill={fur} />
    {id === 'soneca' && <g fill="#695543"><ellipse cx="-34" cy="18" rx="17" ry="12"/><ellipse cx="41" cy="24" rx="18" ry="11"/></g>}
    {id === 'pantufa' && <g fill="#8b928b"><path d="M-54-48 Q-45-73-24-70 L-14-48 Q-31-25-49-34Z" /><path d="M41-14 Q61-27 66-5 Q54 13 40 4Z" /><ellipse cx="30" cy="-48" rx="24" ry="17"/></g>}
    {id === 'farofa' && <g stroke="#b27f50" strokeWidth="6" fill="none" strokeLinecap="round"><path d="M13-68 L11-49 M34-62 L28-45 M-51-28 L-34-25 M-54-12 L-39-9 M51-21 L65-18" /></g>}
    <path d="M-50-67 L-51-113 Q-34-112-17-89 Q8-98 31-90 Q49-114 67-113 L65-62 Q68-24 11-17 Q-44-21-50-67" fill={fur} />
    <path d="M-45-96 L-41-74 L-23-87 M39-88 L59-97 L56-74" fill={id === 'pantufa' ? '#bc7e8f' : '#dca298'} opacity=".85" />
    {id === 'soneca' && <g fill="#695543"><path d="M-50-68L-51-113Q-34-112-17-89Q8-98 31-90Q49-114 67-113L65-62Q68-24 11-17Q-44-21-50-68Z"/><path d="M-47-106L-42-85-22-89M39-90l25-16-6 23" fill="#82624e"/></g>}
    {id==='pantufa'&&<path d="M-50-68L-51-113Q-34-112-17-89L-13-62Q-27-42-43-56Z" fill="#8b928b"/>}
    {id === 'farofa' && <g stroke="#b27f50" strokeWidth="4" strokeLinecap="round"><path d="M-7-86 L-5-73 M8-89 L8-73 M21-86 L19-74" /></g>}
    {playing ? <g fill={id==='soneca'?'#9abac9':ink}><ellipse cx="-16" cy="-57" rx="5" ry="8" /><ellipse cx="31" cy="-57" rx="5" ry="8" /></g> : <g stroke={id==='soneca'?'#c3d3da':ink} strokeWidth="3" fill="none" strokeLinecap="round"><path d={happy ? 'M-26-52 Q-16-64-6-52 M21-52 Q31-64 41-52' : 'M-26-57 Q-17-48-7-57 M21-57 Q31-48 40-57'} /></g>}
    <path d="M3-44 L13-44 L8-38Z" fill="#c38a87" /><path d="M8-38 V-32 Q0-24-7-31 M8-32 Q17-24 23-31" stroke={ink} strokeWidth="2" fill="none" strokeLinecap="round" />
    <g stroke={ink} strokeWidth="1.5" opacity=".65" strokeLinecap="round"><path d="M-29-40 L-58-47 M-30-32 L-60-32 M42-40 L74-46 M44-33 L76-30" /></g>
    <path d={playing ? 'M-24 13 Q-12-2 13-21 Q26-28 30-15 Q33-2-2 23' : 'M-31 16 Q-19 36 0 27 L20 28 Q39 21 52 24'} stroke={fur} strokeWidth="20" strokeLinecap="round" fill="none" />
    <path d={playing ? 'M18-16 L19-9 M24-19 L26-12' : 'M-12 22 L-11 28 M-5 23 L-5 29 M39 21 L39 28'} stroke={ink} strokeWidth="1.5" opacity=".5" />
    {happy && <g transform="translate(66 -107)"><g className="cats-love" key={moment}><path d="M0 8 C-22-4-14-23-2-13 C11-27 27-6 0 8" fill="#bc7e8f" /><path d="M28-5 C14-14 23-25 30-17 C37-25 47-11 28-5" fill="#d7917c" /></g></g>}
    {active && action === 'duck' && <TinyToy kind="duck" x={-64} y={16} scale={.65} />}
    {active && action === 'yarn' && <TinyToy kind="yarn" x={34} y={26} scale={.72} />}
    {active && action === 'feather' && <TinyToy kind="feather" x={33} y={-25} scale={.72} />}
    {active && action === 'box' && <g><path d="M-88 4 L0 17 L79 0 V56 L-81 48Z" fill="#c6a882" /><path d="M-88 4 L-107-12 L-19-1 L0 17 M0 17 L79 0 L96-19 L10-4Z" fill="#e0c6a2" /><path d="M0 17 V51" stroke="#aa885f" strokeWidth="2" /><path d="M-58 23 L-26 27" stroke="#aa885f" strokeWidth="4" /></g>}
  </g>;
}

export default function Cats({ onSave,catProfiles }: GameProps) {
  const [state, setState] = usePersistentState<CatState>('cats-v1', { cat: 'pantufa', action: 'pet', scene: 'afternoon', moment: 0 });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);
  const cats=CATS.map(item=>({...item,name:catProfiles?.find(profile=>profile.coat===(item.id==='pantufa'?'cow':item.id==='farofa'?'orange':'siamese'))?.name??item.name}));
  const cat = cats.find(item => item.id === state.cat) ?? cats[0];
  const phrases = PHRASES[state.action][state.cat];
  const quote = phrases[state.moment % phrases.length];
  const lines = wrapText(quote);
  const interact = (id: CatId, action: CatAction) => { setState(old => ({ ...old, cat: id, action, moment: old.moment + 1 })); setSaveMessage(''); };
  async function save() {
    if (!svgRef.current) return; setSaving(true);
    try { const copy = svgRef.current.cloneNode(true) as SVGSVGElement; copy.querySelectorAll('[data-export-hide]').forEach(element => element.remove()); await onSave({ kind: 'cats', title: `${cat.name}, de folga`, dataUrl: await svgToDataUrl(copy) }); setSaveMessage('Cartão guardado. O gato exige zero direitos de imagem.'); }
    catch { setSaveMessage('O cartão não foi guardado. Tente mais uma vez.'); } finally { setSaving(false); }
  }
  const night = state.scene === 'night';
  return <div className="nature-game cats-game">
    <div className="nature-intro"><span className="nature-eyebrow">o departamento de descanso</span><p>Três gatos, um sofá e absolutamente nenhuma pendência.</p></div>
    <div className="game-toolbar nature-toolbar"><div className="segmented" aria-label="Cenário do sofá">{(['afternoon', 'rain', 'night'] as const).map((scene, i) => <button key={scene} type="button" aria-pressed={state.scene === scene} onClick={() => setState(old => ({ ...old, scene }))}>{['Tarde mansa', 'Chuva lá fora', 'Boa noite'][i]}</button>)}</div></div>
    <div className="game-canvas nature-canvas cats-canvas"><svg viewBox="0 0 720 710" ref={svgRef} role="group" aria-label={`Sofá com ${cats.map(c=>c.name).join(', ')}. ${cat.name} diz: ${quote}`}>
      <defs><pattern id="cats-wall" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="3" cy="5" r=".8" fill={night ? '#e6d7c2' : '#afa28c'} opacity=".18" /></pattern><linearGradient id="cats-window" x1="0" y1="0" x2="0" y2="1"><stop stopColor={night ? '#263e47' : state.scene === 'rain' ? '#a9bbc1' : '#cbded4'} /><stop offset="1" stopColor={night ? '#577579' : '#f4ead0'} /></linearGradient></defs>
      <rect width="720" height="710" rx="28" fill={night ? '#636a67' : '#f2e8d8'} /><rect width="720" height="710" rx="28" fill="url(#cats-wall)" />
      <rect x="476" y="48" width="174" height="204" rx="70" fill="#d5c7b0" /><rect x="486" y="59" width="153" height="182" rx="61" fill="url(#cats-window)" />
      {night ? <g><path d="M580 80 A25 25 0 1 0 608 116 A25 25 0 0 1 580 80" fill="#efd795" /><path d="M516 142 h8 M520 138 v8 M611 174 h8 M615 170 v8 M532 92 h8 M536 88 v8" stroke="#fff2c9" strokeWidth="2" /></g> : state.scene === 'rain' ? <g stroke="#f3f0e6" strokeWidth="3" strokeLinecap="round" opacity=".8">{Array.from({ length: 10 }, (_, i) => <path key={i} d={`M${504 + i % 4 * 35} ${99 + Math.floor(i / 4) * 43} l-6 14`} />)}</g> : <g><circle cx="594" cy="109" r="24" fill="#e4c15c" /><path d="M488 182 Q524 149 562 181 Q604 153 639 185 V243 H486Z" fill="#97ad83" opacity=".6" /></g>}
      <path d="M562 59 V241 M486 160 H639" stroke="#d5c7b0" strokeWidth="8" /><rect x="469" y="241" width="188" height="13" rx="5" fill="#b99d7f" />
      <g transform="translate(139 188)"><path d="M0 52 Q15-40 59-91 M0 52 Q-5-48-32-94 M0 52 Q-33 2-64-22" stroke="#52785c" strokeWidth="5" fill="none" /><path d="M54-88 Q1-127 8-75 Q24-40 54-88 M57-89 Q100-114 99-64 Q73-35 57-89 M-30-88 Q-73-118-70-73 Q-49-43-30-88 M-30-89 Q11-111 10-66 Q-5-42-30-89 M-62-21 Q-82-55-98-23 Q-93 12-62-21" fill={night ? '#8caa84' : '#6c8b65'} /><path d="M-29 32 H31 L25 87 Q0 97-23 87Z" fill="#d7917c" /><ellipse cy="34" rx="31" ry="7" fill="#bd806d" /></g>
      <g transform="translate(283 83)"><rect x="-42" y="-5" width="98" height="91" rx="6" fill="#b89f80" /><rect x="-34" y="3" width="82" height="75" fill="#f5eedf" /><path d="M-20 60 Q-6 9 20 24 Q31 51 2 59" fill="#bc7e8f" opacity=".5" /><path d="M-8 64 Q13 7 31 45" stroke="#52785c" strokeWidth="3" fill="none" /></g>
      <path d="M0 448 Q351 413 720 441 V710 H0Z" fill={night ? '#a18f7d' : '#e0d0b6'} /><ellipse cx="367" cy="475" rx="310" ry="53" fill={night ? '#c9b79c' : '#f1e4cf'} /><path d="M135 467 Q345 503 607 465" stroke="#c0ac92" strokeWidth="2" strokeDasharray="3 6" fill="none" />
      <path d="M91 249 Q92 213 139 215 H576 Q620 218 622 251 V398 H93Z" fill={night ? '#84998b' : '#b1c3a8'} /><path d="M129 264 Q348 251 588 264" stroke="#92aa8c" strokeWidth="2" fill="none" />
      <path d="M61 330 Q58 297 82 294 Q106 294 110 322 V377 H607 V322 Q610 293 635 294 Q661 296 658 328 V433 Q658 455 629 454 H91 Q62 454 61 431Z" fill={night ? '#708577' : '#97ad83'} /><rect x="104" y="346" width="507" height="66" rx="28" fill={night ? '#93a88f' : '#c0cfb4'} /><path d="M358 352 V409" stroke="#849c7d" strokeWidth="2" /><path d="M90 452 L80 481 M630 452 L640 481" stroke="#967c60" strokeWidth="14" strokeLinecap="round" />
      <path d="M128 270 Q163 250 197 285 L179 343 Q130 350 104 318Z" fill="#d7917c" /><path d="M507 267 Q564 249 587 294 L562 344 Q507 338 486 306Z" fill="#e4c15c" opacity=".85" />
      <CatDrawing id="pantufa" name={cats[0].name} x={195} y={346} active={state.cat === 'pantufa'} action={state.action} moment={state.moment} onPet={() => interact('pantufa', 'pet')} />
      <CatDrawing id="farofa" name={cats[1].name} x={366} y={351} active={state.cat === 'farofa'} action={state.action} moment={state.moment} onPet={() => interact('farofa', 'pet')} />
      <CatDrawing id="soneca" name={cats[2].name} x={543} y={345} active={state.cat === 'soneca'} action={state.action} moment={state.moment} onPet={() => interact('soneca', 'pet')} />
      <rect x="43" y="521" width="634" height="148" rx="24" fill="#fff9ed" /><path d="M127 521 L156 499 L171 521" fill="#fff9ed" />
      <text x="76" y="555" fill="#55715a" fontFamily="DM Sans, sans-serif" fontSize="15" fontWeight="600">{cat.name} · {cat.job}</text>
      {lines.map((line, i) => <text key={i} x="76" y={590 + i * 26} fill="#514c40" fontFamily="Georgia, serif" fontSize="23">{line}</text>)}
      <text x="360" y="695" textAnchor="middle" fill={night ? '#f3e8d7' : '#8b7a65'} fontFamily="DM Sans, sans-serif" fontSize="13">folga da Leh · aprovada por unanimidade felina</text>
    </svg></div><p className="nature-sr-only" aria-live="polite">{cat.name} diz: {quote}</p>
    <div className="cats-cat-picker" aria-label="Escolher gato">{cats.map(item => <button key={item.id} className={`cats-name-button ${state.cat === item.id ? 'is-active' : ''}`} type="button" aria-pressed={state.cat === item.id} onClick={() => setState(old => ({ ...old, cat: item.id, moment: old.moment + 1 }))}><span className={`cats-coat cats-coat-${item.id}`} aria-hidden="true" /><span>{item.name}</span></button>)}</div>
    <div className="cats-toys"><span className="control-label">Um agradinho sem obrigação</span><div className="cats-toy-list">{ACTIONS.map(action => <button key={action.id} className={`cats-toy-button ${state.action === action.id ? 'is-active' : ''}`} type="button" aria-pressed={state.action === action.id} onClick={() => interact(state.cat, action.id)}><svg viewBox="-72 -51 152 111" aria-hidden="true"><TinyToy kind={action.id} /></svg><span>{action.label}</span></button>)}</div></div>
    <div className="game-toolbar nature-actions"><button className="soft-button" type="button" onClick={() => interact(state.cat, state.action)}>Mais uma opinião felina</button><button className="primary-button" type="button" onClick={save} disabled={saving}>{saving ? 'Guardando…' : 'Guardar esse momento'}</button></div>
    <p className="game-note nature-note" role="status">{saveMessage || 'Toque num gato para fazer carinho. A escala de hoje só tem sofá.'}</p>
  </div>;
}
