import { useRef, useState } from 'react';
import { ArrowCounterClockwise, FloppyDisk } from '@phosphor-icons/react';
import type { GameProps } from '../lib/types';
import { usePersistentState } from '../lib/storage';
import { svgToDataUrl } from '../lib/art';
import { Palette } from '../components/Palette';
import PaintViewport from '../components/PaintViewport';

type Piece = { shape: 'vaso' | 'pratinho' | 'gatinho'; color: string; width: number; height: number; text: string; plant?: 'none' | 'fern' | 'flower' | 'succulent'; motifs: { x: number; y: number; type: string; color: string }[] };
const initial: Piece = { shape: 'vaso', color: '#d7917c', width: 110, height: 190, text: '', motifs: [{ x: 260, y: 264, type: 'flor', color: '#fff9ed' }] };
export default function Clay({ onSave }: GameProps) {
  const [piece, setPiece] = usePersistentState<Piece>('clay', initial);
  const [history, setHistory] = useState<Piece[]>([]);
  const [future, setFuture] = useState<Piece[]>([]);
  const [ink, setInk] = useState('#fff9ed');
  const [stamp, setStamp] = useState('flor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const svg = useRef<SVGSVGElement>(null);
  const change = (next: Piece) => { setHistory(old => [...old.slice(-39), piece]); setFuture([]); setPiece(next); };
  const undo = () => { if (history.length) { setFuture(old => [...old, piece]); setPiece(history.at(-1)!); setHistory(old => old.slice(0, -1)); } };
  const redo = () => { if (future.length) { setHistory(old => [...old, piece]); setPiece(future.at(-1)!); setFuture(old => old.slice(0, -1)); } };
  const w = piece.width, top = 380 - piece.height;
  const potPath = `M${260 - w * .55} ${top} Q${260 - w * .4} ${top + 30} ${260 - w * .58} ${top + 60} C${260 - w * 1.3} 335 ${260 - w} 391 260 388 C${260 + w} 391 ${260 + w * 1.3} 335 ${260 + w * .58} ${top + 60} Q${260 + w * .4} ${top + 30} ${260 + w * .55} ${top}Z`;
  const shape = piece.shape === 'vaso' ? <path d={potPath} /> : piece.shape === 'pratinho' ? <ellipse cx="260" cy="281" rx={w * 1.4} ry={piece.height * .46} /> : <path d={`M${260-w*.75} 208 L${260-w*.85} ${top} L${260-w*.24} 206 Q260 185 ${260+w*.24} 206 L${260+w*.85} ${top} L${260+w*.75} 208 Q${260+w*1.16} 288 ${260+w*.58} 350 Q260 397 ${260-w*.58} 350 Q${260-w*1.16} 288 ${260-w*.75} 208Z`} />;
  async function save() { if (!svg.current) return; setBusy(true); setError(''); try { const copy=svg.current.cloneNode(true) as SVGSVGElement; copy.querySelectorAll('[data-clay-bg]').forEach(el=>el.remove()); const dataUrl = await svgToDataUrl(copy); await onSave({ kind: 'clay', title: piece.shape==='vaso'?'Meu vasinho':piece.shape==='pratinho'?'Meu pratinho':'Meu gatinho', display:'object', plant:piece.plant??'none', dataUrl }); } catch { setError('Não consegui guardar a peça. Seu rascunho continua aqui.'); } finally { setBusy(false); } }
  return <div className="clay-game">
    <p className="game-note">Uma pecinha de cerâmica, pintada do seu jeito. Escolha a cor e toque para carimbar.</p>
    <div className="segmented" aria-label="Tipo de peça">{(['vaso', 'pratinho', 'gatinho'] as const).map(shape => <button key={shape} className={piece.shape === shape ? 'active' : ''} onClick={() => change({ ...piece, shape })}>{shape === 'vaso' ? 'Vasinho' : shape === 'pratinho' ? 'Pratinho' : 'Gatinho'}</button>)}</div>
    <PaintViewport label="Sua peça de cerâmica" contentSize={{width:520,height:460}} onPaintTap={({clientX,clientY})=>{
      const matrix=svg.current?.getScreenCTM(); if(!matrix)return;
      const point=new DOMPoint(clientX,clientY).matrixTransform(matrix.inverse()); const {x,y}=point;
      const surface=svg.current?.querySelector<SVGGeometryElement>('[data-clay-piece] > path, [data-clay-piece] > ellipse');
      if (!surface?.isPointInFill(new DOMPoint(x,y))) return;
      change({ ...piece, motifs: [...piece.motifs, { x, y, type: stamp, color: ink }] });
    }}><svg className="game-canvas clay-canvas" viewBox="0 0 520 460" ref={svg} aria-label="Sua peça de cerâmica: toque para decorar" role="img">
      <defs><clipPath id="clay-mask">{shape}</clipPath><filter id="clay-grain"><feTurbulence baseFrequency=".6" numOctaves="2" seed="2" result="noise"/><feColorMatrix in="noise" type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".07"/></feComponentTransfer><feBlend in="SourceGraphic" mode="multiply"/></filter></defs>
      <rect data-clay-bg="true" width="520" height="460" fill="#f3eadc"/><path data-clay-bg="true" d="M30 418H490" stroke="#dccab5" strokeWidth="2"/><ellipse cx="260" cy="397" rx="151" ry="11" fill="#ccbaa3" opacity=".24"/>
      {piece.shape==='vaso'&&piece.plant&&piece.plant!=='none'&&<g><path d={`M260 ${top+14}Q237 ${top-60} 260 62`} fill="none" stroke="#638258" strokeWidth="5"/>{piece.plant==='flower'?<g transform="translate(260 62)">{Array.from({length:7},(_,i)=><ellipse key={i} cy="-17" rx="11" ry="18" transform={`rotate(${i*360/7})`} fill="#e7bc68"/>)}<circle r="12" fill="#a8804c"/></g>:Array.from({length:6},(_,i)=><g key={i} transform={`translate(254 ${top-30-i*18})`}><ellipse cx={i%2?-17:17} rx={piece.plant==='succulent'?20:27} ry={piece.plant==='succulent'?10:8} transform={`rotate(${i%2?30:-30})`} fill={i%2?'#88a17b':'#6f8f63'}/></g>)}</g>}
      <g data-clay-piece="true" fill={piece.color} stroke="#886d5d" strokeWidth="2" filter="url(#clay-grain)">{shape}</g>
      {piece.shape === 'vaso' && <ellipse cx="260" cy={top} rx={w*.55} ry="12" fill="#e5d3b9" stroke="#886d5d" strokeWidth="2"/>}
      {piece.shape === 'pratinho' && <ellipse cx="260" cy="281" rx={w*1.2} ry={piece.height*.38} fill="none" stroke="#fff9ed" strokeOpacity=".5" strokeWidth="2"/>}
      <g clipPath="url(#clay-mask)">{piece.motifs.map((m, i) => <g key={i} transform={`translate(${m.x} ${m.y})`} fill={m.color}>
        {m.type === 'flor' ? <>{Array.from({length:6}, (_,j)=><ellipse key={j} cy="-10" rx="6" ry="11" transform={`rotate(${j*60})`}/>)}<circle r="5" fill="#e4c15c"/></> : m.type === 'pata' ? <><ellipse cy="4" rx="10" ry="8"/><circle cx="-11" cy="-8" r="4"/><circle cx="-4" cy="-13" r="4"/><circle cx="5" cy="-13" r="4"/><circle cx="12" cy="-7" r="4"/></> : <path d="M0 14C-30-5-9-27 0-12C9-27 30-5 0 14Z"/>}
      </g>)}<text x="260" y="341" textAnchor="middle" fontSize="21" fontFamily="serif" fill={ink}>{piece.text}</text></g>
      {piece.shape === 'gatinho' && <g fill="none" stroke="#594d42" strokeWidth="3" strokeLinecap="round"><path d="M208 257q11-12 22 0M290 257q11-12 22 0M249 280l11 8 11-8M260 288v9q-8 10-16 1M260 297q8 10 16 1"/></g>}
    </svg></PaintViewport>
    <details className="clay-format"><summary>Mexer no formato</summary><div className="clay-controls"><label className="control-label">Largura<input type="range" aria-label="Largura da peça" min="70" max="145" value={piece.width} onChange={e => change({ ...piece, width: Number(e.target.value) })}/></label><label className="control-label">Altura<input type="range" aria-label="Altura da peça" min="140" max="230" value={piece.height} onChange={e => change({ ...piece, height: Number(e.target.value) })}/></label></div></details>
    <label className="control-label clay-color-label">Cor da massinha</label><Palette value={piece.color} onChange={color => change({ ...piece, color })}/>
    {piece.shape==='vaso'&&<label className="control-label clay-plant-picker">Uma plantinha para acompanhar<select aria-label="Planta do vasinho" value={piece.plant??'none'} onChange={e=>change({...piece,plant:e.target.value as Piece['plant']})}><option value="none">Só o vasinho</option><option value="fern">Folhinhas</option><option value="flower">Uma flor amarela</option><option value="succulent">Suculentinha</option></select></label>}
    <div className="clay-decor"><label className="control-label">Carimbo<select value={stamp} onChange={e=>setStamp(e.target.value)} aria-label="Carimbo"><option value="flor">Flor</option><option value="pata">Patinha</option><option value="coracao">Coração</option></select></label><label className="control-label">Cor do carimbo<input type="color" value={ink} onChange={e=>setInk(e.target.value)}/></label><label className="control-label clay-inscription">Um nome, se quiser<input maxLength={22} value={piece.text} onChange={e=>change({...piece,text:e.target.value})} placeholder="feito pela Leh" aria-label="Texto na cerâmica"/></label></div>
    <div className="game-toolbar"><button className="soft-button" disabled={!history.length} onClick={undo}><ArrowCounterClockwise/>Desfazer</button><button className="soft-button" disabled={!future.length} onClick={redo}>Refazer</button><button className="soft-button" onClick={()=>change({...piece,motifs:[...piece.motifs,{x:260,y:281,type:stamp,color:ink}]})}>Carimbar no centro</button><button className="soft-button" onClick={()=>change({...initial,motifs:[]})}>Outra pecinha</button><button className="primary-button" disabled={busy} onClick={save}><FloppyDisk/>{busy?'Guardando…':'Guardar no cantinho'}</button></div>{error&&<p role="alert">{error}</p>}
  </div>;
}
