import type { CatProfile } from './types';
export type GiftContent={version:1;source:'provided'|'personal';notes:string[];letter?:string;cats?:CatProfile[]};
export const EMPTY_GIFT:GiftContent={version:1,source:'provided',notes:[]};
export function parseGift(text:string):GiftContent{
  const data=JSON.parse(text);
  if(data.demo===true)throw new Error('Este é o arquivo de exemplo. Substitua os textos e remova demo antes de importar.');
  if(data.version!==1||typeof data.letter!=='string'||!data.letter.trim()||data.letter.length>16000||!Array.isArray(data.notes)||data.notes.length>200||data.notes.some((n:unknown)=>typeof n!=='string'||!n.trim()||n.length>3000))throw new Error('Confira a carta e os bilhetes no arquivo do presente.');
  if(data.cats!==undefined&&(!Array.isArray(data.cats)||data.cats.length>3||data.cats.some((cat:unknown)=>!cat||typeof cat!=='object'||!('name' in cat)||typeof cat.name!=='string'||!cat.name.trim()||cat.name.length>40||!('coat' in cat)||!['orange','cow','siamese'].includes(cat.coat as string))))throw new Error('Confira os nomes e as pelagens dos gatos.');
  return {version:1,source:'personal',letter:data.letter,notes:data.notes,...(data.cats?{cats:data.cats}:{})};
}
