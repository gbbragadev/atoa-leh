import { useState } from 'react';
import type { CatProfile } from '../lib/types';
export default function Companion({onHide,catProfiles}:{onHide:()=>void;catProfiles?:CatProfile[]}){
  const [awake,setAwake]=useState(false);
  const name=catProfiles?.find(cat=>cat.coat==='orange')?.name;
  return <div className="studio-buddy"><button onClick={()=>setAwake(v=>!v)} aria-label={`Fazer carinho ${name?`em ${name}`:'no gato do ateliê'}`}><svg viewBox="0 0 90 60" aria-hidden="true"><path d="M13 36q-6-29 19-21l4-8 9 12q39-3 37 26-30 16-69-9" fill="#cfa378"/><path d="M66 32q16 5 12 13-8 8-24 5" stroke="#a77d59" strokeWidth="4" fill="none"/>{awake?<g fill="#544c3d"><circle cx="24" cy="30" r="2"/><circle cx="37" cy="30" r="2"/></g>:<path d="M20 29q5 6 9 0M32 29q5 6 9 0" fill="none" stroke="#544c3d" strokeWidth="2" strokeLinecap="round"/>}<path d="M28 35l4 0-2 3z" fill="#a46d70"/></svg></button><span>{awake?'O gato está supervisionando. Sem qualificação nenhuma.':`${name??'O gato'} leva o descanso muito a sério.`}</span><button className="hide-buddy" onClick={onHide}>Ocultar gato</button></div>;
}
