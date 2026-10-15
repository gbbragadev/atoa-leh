import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, Trash } from '@phosphor-icons/react';
import type { Creation } from '../lib/types';
import { GameArtwork } from './Artwork';

export default function Shelf({creations,order,onReorder,onOpen,onRemove,onCreate}:{creations:Creation[];order:string[];onReorder:(ids:string[])=>void;onOpen:(item:Creation)=>void;onRemove:(id:string)=>void;onCreate:()=>void}){
  const [columns,setColumns]=useState(window.innerWidth<=650?2:3);
  useEffect(()=>{const media=window.matchMedia('(max-width:650px)');const resize=()=>setColumns(media.matches?2:3);media.addEventListener('change',resize);return()=>media.removeEventListener('change',resize);},[]);
  const sorted=[...creations].sort((a,b)=>{const ai=order.indexOf(a.id),bi=order.indexOf(b.id);return (ai<0?order.length:ai)-(bi<0?order.length:bi)||b.createdAt-a.createdAt;});
  function move(id:string,direction:number){const ids=sorted.map(item=>item.id);const index=ids.indexOf(id);const target=index+direction;if(target<0||target>=ids.length)return;[ids[index],ids[target]]=[ids[target],ids[index]];onReorder(ids);}
  const rows=Array.from({length:Math.ceil(sorted.length/columns)},(_,i)=>sorted.slice(i*columns,(i+1)*columns));
  return <div className="shelf-wall" aria-label="Prateleira das suas criações">
    {!sorted.length?<><div className="shelf-empty"><GameArtwork kind="garden"/></div><div className="shelf-prompt"><h2>Tem lugar para as suas invenções.</h2><p>Uma peça pintada ou um desenho pela metade já pode morar aqui.</p><button className="primary-button" onClick={onCreate}>Decorar uma peça<ArrowRight size={18}/></button></div></>:rows.map((row,i)=><div className="shelf-row" key={i}>{row.map(item=><article className={`shelf-item ${item.display==='object'||item.kind==='clay'?'is-object':'is-frame'}`} key={item.id} data-creation-id={item.id}><button className="shelf-art" onClick={()=>onOpen(item)} aria-label={`Ver ${item.title}`}><img src={item.dataUrl} alt={item.title}/></button><span className="shelf-item-label">{item.title}</span><div className="shelf-item-tools"><button onClick={()=>move(item.id,-1)} disabled={sorted[0]?.id===item.id} aria-label={`Mover ${item.title} para a esquerda`}><ArrowLeft size={16}/></button><button onClick={()=>onOpen(item)} aria-label={`Abrir ${item.title}`}><Eye size={17}/></button><button onClick={()=>move(item.id,1)} disabled={sorted.at(-1)?.id===item.id} aria-label={`Mover ${item.title} para a direita`}><ArrowRight size={16}/></button><button onClick={()=>onRemove(item.id)} aria-label={`Retirar ${item.title} da prateleira`}><Trash size={16}/></button></div></article>)}</div>)}
  </div>;
}
