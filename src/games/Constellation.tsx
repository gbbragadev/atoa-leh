import { useEffect, useRef, useState } from 'react';
import type { GameProps } from '../lib/types';
import { usePersistentState } from '../lib/storage';
import { svgToDataUrl } from '../lib/art';
import { ArrowCounterClockwise, FloppyDisk } from '@phosphor-icons/react';

type Mark = 'flower' | 'cat' | null;
type Round = { board: Mark[]; turn: 'flower' | 'cat'; mode: 'solo' | 'duo' };
const lines: number[][] = [];
for(let y=0;y<4;y++)for(let x=0;x<4;x++)for(const [dx,dy] of [[1,0],[0,1],[1,1],[-1,1]])if(x+dx*2>=0&&x+dx*2<4&&y+dy*2<4)lines.push([y*4+x,(y+dy)*4+x+dx,(y+dy*2)*4+x+dx*2]);
function result(board: Mark[]) { const line=lines.find(line=>board[line[0]]&&line.every(i=>board[i]===board[line[0]])); return line ? {winner:board[line[0]],line} : null; }
function bestMove(board: Mark[]) {
  const free=board.map((v,i)=>v===null?i:-1).filter(i=>i>=0);
  for(const mark of ['cat','flower'] as const)for(const i of free){const copy=[...board];copy[i]=mark;if(result(copy))return i;}
  return [5,6,9,10,0,3,12,15,1,2,4,7,8,11,13,14].find(i=>free.includes(i));
}
function Symbol({mark}:{mark:Mark}) {
  return mark==='flower'?<g>{Array.from({length:6},(_,i)=><ellipse key={i} cy="-13" rx="8" ry="14" transform={`rotate(${i*60})`} fill="#d69bad"/>)}<circle r="8" fill="#e4c15c"/></g>:mark==='cat'?<g fill="#d4ab7a"><path d="M-24-3l-1-27 18 14Q0-21 9-16l17-15-1 28z"/><ellipse rx="27" ry="23"/><path d="M-17-1q5 5 10 0M7-1q5 5 10 0" stroke="#625448" strokeWidth="2.5" fill="none"/><path d="M-3 7h6l-3 4z" fill="#ac7478"/></g>:null;
}
export default function Constellation({onSave}:GameProps) {
  const [round,setRound]=usePersistentState<Round>('constellation',{board:Array(16).fill(null),turn:'flower',mode:'solo'});
  const [past,setPast]=useState<Round[]>([]);
  const [error,setError]=useState('');
  const svg=useRef<SVGSVGElement>(null);
  const outcome=result(round.board); const full=round.board.every(Boolean);
  useEffect(()=>{if(round.mode!=='solo'||round.turn!=='cat'||outcome||full)return;const timer=setTimeout(()=>setRound(current=>{if(current.turn!=='cat'||current.mode!=='solo'||result(current.board))return current;const i=bestMove(current.board);if(i===undefined)return current;const board=[...current.board];board[i]='cat';return {...current,board,turn:'flower'};}),450);return()=>clearTimeout(timer);},[round,full,outcome?.winner,setRound]);
  const play=(i:number)=>{if(round.board[i]||outcome||(round.mode==='solo'&&round.turn==='cat'))return;setPast(p=>[...p,round]);const board=[...round.board];board[i]=round.turn;setRound({...round,board,turn:round.turn==='cat'?'flower':'cat'});};
  const restart=(mode=round.mode)=>{setPast(p=>[...p,round]);setRound({board:Array(16).fill(null),turn:'flower',mode});};
  async function save(){try{if(svg.current)await onSave({kind:'constellation',title:'Flores & bigodes',dataUrl:await svgToDataUrl(svg.current)});}catch{setError('Não consegui guardar o tabuleiro. Tente de novo.');}}
  return <div className="constellation-game"><p className="game-note">Uma velha com quintal maior. Junte três flores ou três gatos em linha. Eles não respeitam canteiros.</p>
    <div className="segmented" aria-label="Companhia para jogar"><button className={round.mode==='solo'?'active':''} onClick={()=>restart('solo')}>Eu e o gato</button><button className={round.mode==='duo'?'active':''} onClick={()=>restart('duo')}>Com o Gui</button></div>
    <div className="round-status" role="status">{outcome?outcome.winner==='flower'?'Seu jardim floresceu. O gato finge que deixou.':'Deu gato. Agora ele está se achando.':full?'Um empate aconchegante. Cabe todo mundo.':round.turn==='flower'?'Vez das flores':'Vez dos bigodes'}</div>
    <div className="constellation-board">{round.board.map((mark,i)=><button key={i} aria-label={`Casa ${i+1}${mark?`, ${mark==='flower'?'flor':'gato'}`:''}`} className={outcome?.line.includes(i)?'winning':''} disabled={!!mark||!!outcome||(round.mode==='solo'&&round.turn==='cat')} onClick={()=>play(i)}><svg viewBox="-40 -40 80 80" aria-hidden="true"><Symbol mark={mark}/></svg></button>)}</div>
    <svg ref={svg} viewBox="0 0 520 590" className="export-only" aria-hidden="true"><rect width="520" height="590" fill="#f5efe4"/><text x="260" y="52" textAnchor="middle" fill="#56674e" fontSize="30" fontFamily="serif">Flores &amp; bigodes</text>{round.board.map((mark,i)=><g key={i} transform={`translate(${72+i%4*125} ${145+Math.floor(i/4)*125})`}><rect x="-54" y="-54" width="108" height="108" rx="15" fill={outcome?.line.includes(i)?'#e1e8d7':'#fff9ed'}/><Symbol mark={mark}/></g>)}</svg>
    <p className="small-note">{round.mode==='duo'?'Passem o celular de um para o outro. Flores para a Leh, bigodes para o Gui.':'O gato joga aqui no celular. Pode desfazer uma rodada quando quiser.'}</p>
    <div className="game-toolbar"><button className="soft-button" disabled={!past.length} onClick={()=>{setRound(past.at(-1)!);setPast(p=>p.slice(0,-1));}}><ArrowCounterClockwise/>Desfazer</button><button className="soft-button" onClick={()=>restart()}>De novo</button><button className="primary-button" onClick={save}><FloppyDisk/>Guardar tabuleiro</button></div>{error&&<p role="alert">{error}</p>}
  </div>;
}
