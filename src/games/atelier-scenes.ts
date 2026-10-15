import type { SVGProps } from 'react';
import { seededRandom } from '../lib/art';

export type SceneId = 'flowers' | 'cat' | 'pottery' | 'journey' | 'forest' | 'cats-window' | 'cats-yarn' | 'cats-nap' | 'greenhouse' | 'plant-shelf' | 'window-garden' | 'cozy-kitchen' | 'reading-corner' | 'crochet-basket' | 'pottery-bouquet' | 'pottery-table';
export type SceneCategory = 'cats' | 'plants' | 'corners' | 'handmade';
export type Region = { id: string; kind: 'path'; props: SVGProps<SVGPathElement> } | { id: string; kind: 'ellipse'; props: SVGProps<SVGEllipseElement> } | { id: string; kind: 'circle'; props: SVGProps<SVGCircleElement> };
export type Illustration = { regions: Region[]; details: string[] };
export const SCENE_CATEGORIES: { id: SceneCategory; label: string }[] = [
  { id: 'cats', label: 'Bigodes' }, { id: 'plants', label: 'Plantinhas' },
  { id: 'corners', label: 'Cantinhos' }, { id: 'handmade', label: 'Feito à mão' },
];
export const SCENES: { id: SceneId; label: string; title: string; category: SceneCategory; seed: number; note: string }[] = [
  { id: 'cat', label: 'Gatinho', title: 'Gato em horário de folga', category: 'cats', seed: 202604, note: 'O expediente deste gato acabou antes de começar.' },
  { id: 'cats-window', label: 'Gatos na janela', title: 'Três fiscais de passarinho', category: 'cats', seed: 182304, note: 'Laranja, cinza e preto. Nenhum paga aluguel.' },
  { id: 'cats-yarn', label: 'Gato e novelos', title: 'A reunião dos novelos', category: 'cats', seed: 303154, note: 'Era um projeto de crochê. Agora é do gato.' },
  { id: 'cats-nap', label: 'Soneca no sofá', title: 'Uma soneca bem organizada', category: 'cats', seed: 340218, note: 'O sofá tem dono. Você pode sentar no cantinho.' },
  { id: 'flowers', label: 'Flores', title: 'Flores sem pressa', category: 'plants', seed: 24571, note: 'Flores azuis também valem. A botânica que lute.' },
  { id: 'forest', label: 'Bosque', title: 'Um bosque só nosso', category: 'plants', seed: 71385, note: 'Sombra, cogumelos e um gato que chegou primeiro.' },
  { id: 'greenhouse', label: 'Estufa de vidro', title: 'O sol mora na estufa', category: 'plants', seed: 210089, note: 'Um lugar quentinho para suas tintas criarem raízes.' },
  { id: 'plant-shelf', label: 'Prateleira verde', title: 'Só mais uma plantinha', category: 'plants', seed: 470309, note: 'Cabe outra. A prateleira parece concordar.' },
  { id: 'window-garden', label: 'Jardim na janela', title: 'Um jardim que cabe na janela', category: 'plants', seed: 720198, note: 'A vista ficou por sua conta. O café também pode ficar.' },
  { id: 'journey', label: 'Viagem', title: 'Uma viagem de folga', category: 'corners', seed: 14557, note: 'Sem horário de chegada. Nem precisa sair de casa.' },
  { id: 'cozy-kitchen', label: 'Cozinha de tarde', title: 'Uma tarde na cozinha', category: 'corners', seed: 331704, note: 'O chá ficou pronto. A louça não tem pressa.' },
  { id: 'reading-corner', label: 'Cantinho de leitura', title: 'O livro pode esperar', category: 'corners', seed: 402577, note: 'A poltrona já entendeu a parte do descanso.' },
  { id: 'pottery', label: 'Cerâmica', title: 'Uma prateleira de cerâmica', category: 'handmade', seed: 193729, note: 'Um pouquinho torto tem muito charme.' },
  { id: 'crochet-basket', label: 'Cesta de crochê', title: 'Uma cesta cheia de possibilidades', category: 'handmade', seed: 923441, note: 'Nenhum ponto precisa ser perfeito para ficar bonito.' },
  { id: 'pottery-bouquet', label: 'Vaso com buquê', title: 'A flor escolheu este vaso', category: 'handmade', seed: 238415, note: 'Você pode dizer que fez até o vaso.' },
  { id: 'pottery-table', label: 'Mesa de cerâmica', title: 'Uma mesa de coisas feitas à mão', category: 'handmade', seed: 803416, note: 'O potinho ficou torto. O orgulho ficou inteiro.' },
];
export const SCENE_BY_ID = Object.fromEntries(SCENES.map(scene => [scene.id, scene])) as Record<SceneId, typeof SCENES[number]>;

export function makeIllustration(seed: number, picture: SceneId): Illustration {
  if (['flowers', 'cat', 'pottery', 'journey', 'forest'].includes(picture)) return makeLegacyIllustration(seed, picture);
  const random = seededRandom(seed);
  const regions: Region[] = [], details: string[] = [];
  const path = (id: string, d: string, transform?: string) => regions.push({ id, kind: 'path', props: { d, transform } });
  const ellipse = (id: string, cx: number, cy: number, rx: number, ry: number, angle = 0) => regions.push({ id, kind: 'ellipse', props: { cx, cy, rx, ry, transform: `rotate(${angle} ${cx} ${cy})` } });
  const circle = (id: string, cx: number, cy: number, r: number) => regions.push({ id, kind: 'circle', props: { cx, cy, r } });
  const box = (id: string, x: number, y: number, w: number, h: number, r = 5) => path(id, `M${x+r} ${y}H${x+w-r}Q${x+w} ${y} ${x+w} ${y+r}V${y+h-r}Q${x+w} ${y+h} ${x+w-r} ${y+h}H${x+r}Q${x} ${y+h} ${x} ${y+h-r}V${y+r}Q${x} ${y} ${x+r} ${y}Z`);
  const leaf = (id: string, x: number, y: number, w: number, h: number, direction = 1) => {
    path(id, `M${x} ${y}Q${x+w*direction} ${y-h*.12} ${x+w*direction} ${y-h}Q${x-w*.14*direction} ${y-h*.92} ${x} ${y}Z`);
    details.push(`M${x} ${y}Q${x+w*.48*direction} ${y-h*.55} ${x+w*.8*direction} ${y-h*.83}`);
  };
  const pot = (id: string, x: number, y: number, w = 48, h = 57) => {
    path(`${id}-pot`, `M${x-w} ${y}Q${x} ${y+12} ${x+w} ${y}L${x+w*.78} ${y+h}Q${x} ${y+h+16} ${x-w*.78} ${y+h}Z`);
    ellipse(`${id}-pot-rim`, x, y, w, 10);
    details.push(`M${x-w*.54} ${y+25}Q${x} ${y+34} ${x+w*.54} ${y+25}`);
  };
  const plant = (id: string, x: number, y: number, w = 48, h = 80, kind = 0) => {
    const swing = (random()-.5)*18;
    path(`${id}-plant-stem`, `M${x-3} ${y}Q${x-5+swing} ${y-h*.5} ${x+swing} ${y-h}L${x+5+swing} ${y-h}Q${x+3+swing} ${y-h*.5} ${x+3} ${y}Z`);
    if (kind === 1) {
      for (let i=0;i<5;i++) { const a=(i-2)*.46; ellipse(`${id}-leaf-${i}`,x+Math.sin(a)*w*.75,y-h*.65-Math.cos(a)*h*.26,w*.23,h*.46,-a*58); }
    } else if (kind === 2) {
      for (let i=0;i<4;i++) { const direction=i%2?1:-1; leaf(`${id}-leaf-${i}`,x+swing*.3,y-14-i*h*.2,w*(.85-i*.09),h*.44,direction); }
    } else {
      for (let i=0;i<3;i++) { leaf(`${id}-leaf-left-${i}`,x,y-7-i*h*.29,w*(1-i*.16),h*.44,-1); leaf(`${id}-leaf-right-${i}`,x+3,y-18-i*h*.27,w*(.82-i*.12),h*.4,1); }
    }
    pot(id,x,y,w*.75, Math.max(35,w*1.05));
  };
  const bloom = (id: string, x: number, y: number, r = 27) => {
    const n=5+Math.floor(random()*3), turn=random()*Math.PI;
    for(let j=0;j<n;j++){ const a=turn+j*Math.PI*2/n; ellipse(`${id}-petal-${j}`,x+Math.cos(a)*r*.64,y+Math.sin(a)*r*.64,r*.4,r*.7,a*180/Math.PI+90); }
    circle(`${id}-flower-heart`,x,y,r*.35);
  };
  const yarn = (id: string, x: number, y: number, r = 35) => {
    ellipse(`${id}-yarn`,x,y,r,r*.85,random()*30-15);
    details.push(`M${x-r*.5} ${y-r*.57}Q${x+r*.7} ${y-r*.55} ${x+r*.7} ${y+r*.3}`, `M${x-r*.75} ${y-r*.1}Q${x+r*.6} ${y+r*.1} ${x+r*.34} ${y+r*.72}`, `M${x-r*.6} ${y+r*.3}Q${x} ${y+r*.25} ${x+r*.06} ${y+r*.78}`, `M${x-r*.17} ${y-r*.75}Q${x-r*.57} ${y-r*.1} ${x+r*.48} ${y+r*.5}`);
  };
  const mug = (id: string, x: number, y: number, w = 43, h = 66) => {
    path(`${id}-handle`, `M${x+w-5} ${y-h+14}C${x+w+44} ${y-h-7} ${x+w+45} ${y-1} ${x+w-5} ${y-12}L${x+w-5} ${y-26}C${x+w+21} ${y-18} ${x+w+25} ${y-h+11} ${x+w-5} ${y-h+29}Z`);
    path(`${id}-cup`, `M${x-w} ${y-h}L${x+w} ${y-h}L${x+w-7} ${y-5}Q${x} ${y+14} ${x-w+6} ${y-5}Z`);
    ellipse(`${id}-cup-rim`, x,y-h,w,9);
  };
  const cat = (id: string, x: number, y: number, s = 1, coat: 'orange' | 'gray' | 'black' = 'orange', sleep = false) => {
    const t=`translate(${x} ${y}) scale(${s})`, X=(a:number)=>x+a*s,Y=(a:number)=>y+a*s;
    if(sleep) {
      path(`${id}-cat-${coat}-body`,'M-82 2C-109-42-63-86-3-64C28-103 92-79 103-33C135 8 71 30 14 26C-41 33-75 24-82 2Z',t);
      path(`${id}-cat-${coat}-head`,'M-87-25L-89-72L-60-58Q-41-70-20-59L7-74L8-31Q11 8-40 11Q-82 10-87-25Z',t);
      path(`${id}-cat-white-patch`,'M-50-56Q-19-46 3-59L8-31Q11 8-40 11Q-26-18-50-56Z',t);
      details.push(`M${X(-74)} ${Y(-27)}Q${X(-64)} ${Y(-17)} ${X(-54)} ${Y(-27)}`,`M${X(-29)} ${Y(-26)}Q${X(-19)} ${Y(-16)} ${X(-9)} ${Y(-26)}`,`M${X(32)} ${Y(-43)}C${X(92)} ${Y(-56)} ${X(97)} ${Y(8)} ${X(29)} ${Y(9)}`);
    } else {
      path(`${id}-cat-${coat}-tail`,'M46 56C110 72 108-16 81-28C60-33 53-8 71-5C82 7 74 34 50 28Z',t);
      ellipse(`${id}-cat-${coat}-body`,x,y+24*s,51*s,66*s);
      path(`${id}-cat-white-belly`,'M-23 77Q-35 35-14-13Q2 7 21-13Q43 31 24 77Z',t);
      path(`${id}-cat-${coat}-head`,'M-54-26L-60-89L-28-66Q0-79 28-66L60-89L54-26Q52 11 0 12Q-52 11-54-26Z',t);
      path(`${id}-cat-white-face`,'M-2-67Q13-52 27-41Q20-19 45-8Q28 12 0 12Q-23 12-39 0Q-10-22-2-67Z',t);
      path(`${id}-ear-left`,'M-49-75L-45-39L-31-60Z',t); path(`${id}-ear-right`,'M49-75L45-39L31-60Z',t);
      ellipse(`${id}-cat-white-paw-left`,x-29*s,y+77*s,24*s,13*s); ellipse(`${id}-cat-white-paw-right`,x+29*s,y+77*s,24*s,13*s);
      path(`${id}-cat-nose`,'M-8-19Q0-24 8-19L0-11Z',t);
      details.push(`M${X(-34)} ${Y(-30)}Q${X(-26)} ${Y(-39)} ${X(-17)} ${Y(-30)}`,`M${X(17)} ${Y(-30)}Q${X(26)} ${Y(-39)} ${X(34)} ${Y(-30)}`,`M${X(0)} ${Y(-11)}V${Y(-4)}Q${X(-9)} ${Y(3)} ${X(-14)} ${Y(-4)}`,`M${X(0)} ${Y(-4)}Q${X(9)} ${Y(3)} ${X(14)} ${Y(-4)}`,`M${X(-44)} ${Y(-15)}L${X(-72)} ${Y(-23)}M${X(44)} ${Y(-15)}L${X(72)} ${Y(-23)}`);
      if(coat==='orange') for(let i=0;i<3;i++) path(`${id}-cat-orange-stripe-${i}`,`M${-24+i*20}-67L${-17+i*16}-48L${-11+i*15}-67Z`,t);
    }
  };
  const window = (id: string, x: number, y: number, w: number, h: number) => {
    box(`${id}-window-frame`,x,y,w,h,11); box(`${id}-window-sky`,x+13,y+13,w-26,h-26,3);
    const sunX=x+w*(.65+random()*.13); circle(`${id}-sun`,sunX,y+h*.24,23+random()*8);
    path(`${id}-hill-far`,`M${x+13} ${y+h*.7}Q${x+w*.35} ${y+h*.36} ${x+w*.59} ${y+h*.72}Q${x+w*.8} ${y+h*.48} ${x+w-13} ${y+h*.67}V${y+h-13}H${x+13}Z`);
    box(`${id}-window-crossbar`,x+w*.5-4,y+12,8,h-24,0); box(`${id}-window-bar`,x+12,y+h*.54,w-24,7,0);
    box(`${id}-window-sill`,x-13,y+h,w+26,17,4);
  };
  const table = () => { path('tablecloth','M43 469Q300 453 557 469L545 526Q300 543 55 526Z'); details.push('M78 500Q300 512 522 500'); };

  if(picture==='cats-window') {
    window('big',97,64,405,329);
    path('curtain-left','M64 57H132Q119 223 147 376Q97 388 55 368Q77 220 64 57Z');
    path('curtain-right','M468 57H536Q523 220 545 368Q503 388 453 376Q481 223 468 57Z');
    details.push('M84 73Q94 228 81 349','M515 73Q506 228 523 349');
    box('window-bench',75,461,450,35,8); box('bench-left-leg',100,496,25,40,2);box('bench-right-leg',475,496,25,40,2);
    cat('one',190,384,.84,'orange');cat('two',310,380,.87,'gray');cat('three',425,388,.79,'black');
    details.push('M270 166Q285 149 300 166Q315 149 330 166');
  } else if(picture==='cats-yarn') {
    ellipse('braided-rug',300,487,242,48); details.push('M85 486Q302 534 518 486','M105 485Q302 519 502 485');
    box('low-shelf',64,169,202,18,3);plant('little',113,118,35,55,1);box('book-one',170,115,22,54,3);box('book-two',194,105,20,64,3);
    cat('yarn-thief',369,364,1.2,'orange');
    path('basket','M72 354Q151 370 238 354L222 469Q153 489 89 467Z');ellipse('basket-rim',155,354,84,19);
    yarn('skein-left',112,333,37);yarn('skein-middle',166,318,40);yarn('skein-right',210,339,31);
    for(let i=0;i<5;i++)details.push(`M${94+i*27} 383Q${102+i*25} 420 ${99+i*26} 461`);
    for(let i=0;i<4;i++)details.push(`M90 ${393+i*20}Q154 ${414+i*17} 226 ${393+i*20}`);
    yarn('loose',254,470,33+random()*5);details.push('M235 450C204 402 322 410 314 459C292 515 398 515 425 478','M188 348L252 230M201 350L265 242');
  } else if(picture==='cats-nap') {
    window('small',366,67,151,154);circle('moon-glow',446,122,18);
    box('sofa-back',105,222,391,197,50);box('sofa-cushion-left',109,338,183,124,25);box('sofa-cushion-right',292,338,197,124,25);
    box('sofa-arm-left',69,305,58,175,24);box('sofa-arm-right',472,305,58,175,24);box('sofa-foot-left',109,479,31,44,6);box('sofa-foot-right',457,479,31,44,6);
    path('striped-blanket','M353 273Q408 261 445 294L435 495Q391 526 339 496L347 359Z');
    for(let i=0;i<5;i++)path(`blanket-stripe-${i}`,`M${355+i*15} 280Q${367+i*15} 392 ${348+i*17} 502L${357+i*17} 501Q${376+i*15} 392 ${364+i*15} 280Z`);
    path('pillow','M129 259Q191 235 252 272L233 346Q175 357 131 329Z');
    cat('sofa-owner',259,365,1.28,'black',true);plant('floor',83,216,39,99,2);
    details.push('M156 279Q186 311 223 287','M188 173L214 173L188 195L214 195');
  } else if(picture==='greenhouse') {
    path('glass-house-frame','M80 493V185Q300-19 520 185V493Z');path('glass-house-window','M99 475V195Q300 13 501 195V475Z');
    circle('greenhouse-sun',390,148,31);path('glass-hill','M101 305Q214 211 301 302Q417 237 499 310V475H101Z');
    box('glass-center-bar',294,108,12,365,1);box('glass-left-bar',168,155,9,320,1);box('glass-right-bar',423,155,9,320,1);box('glass-horizontal-bar',99,277,402,10,1);
    box('plant-step-back',94,424,412,26,4);box('plant-step-front',68,504,464,28,4);
    plant('fern',181,356,62,119,1);plant('monstera',393,340,66,140,2);plant('seedling',293,392,35,76,0);
    plant('front-leafy',118,473,44,88,2);plant('front-spike',463,464,51,87,1);
    path('watering-can-spout','M315 449L372 412L384 429L337 479Z');path('watering-can-handle','M274 445C232 403 237 496 274 492L283 480C260 477 258 449 282 459Z');
    box('watering-can-body',273,445,66,63,15);ellipse('watering-can-top',306,445,33,9);ellipse('watering-can-sprinkle',380,420,17,9,45);
  } else if(picture==='plant-shelf') {
    box('shelf-wall',64,72,472,430,12);box('shelf-left',92,88,15,438,2);box('shelf-right',493,88,15,438,2);
    box('shelf-top-board',76,264,450,17,4);box('shelf-bottom-board',76,492,450,17,4);
    plant('top-fern',162,192,50,94,1);plant('top-leafy',302,205,45,98,0);plant('top-round',436,201,39,67,2);
    plant('bottom-monstera',174,413,63,116,2);plant('bottom-spike',340,421,53,105,1);
    path('glass-propagation-jar','M421 400H475L484 473Q449 493 413 473Z');ellipse('glass-jar-rim',449,400,28,8);
    path('water-in-jar','M416 437Q449 448 481 437L484 473Q449 493 413 473Z');
    leaf('jar-leaf',446,406,41,64,-1);leaf('jar-leaf-right',450,401,33,53,1);details.push('M449 390V449L435 465M449 447L462 469');
  } else if(picture==='window-garden') {
    window('garden',135,77,330,324);
    path('shutter-left','M62 87L119 77V400L62 414Z');path('shutter-right','M481 77L538 87V414L481 400Z');
    for(let i=0;i<7;i++){details.push(`M73 ${109+i*39}L108 ${104+i*39}`,`M492 ${104+i*39}L527 ${109+i*39}`);}
    box('garden-table',54,495,492,22,4);plant('basil',156,419,56,128,0);plant('succulent',442,434,53,72,1);
    pot('lavender',302,426,58,68);
    for(let i=0;i<5;i++){const x=264+i*19,y=333-random()*35;path(`lavender-stem-${i}`,`M299 427L${x-2} ${y}L${x+3} ${y}L307 427Z`);for(let j=0;j<3;j++)ellipse(`lavender-flower-${i}-${j}`,x,y-j*13,10-j,11,0);}
    circle('garden-bird-body',371,192,15);path('garden-bird-wing','M360 183Q375 162 386 183L371 195Z');details.push('M378 187L397 187L382 194M365 207V219');
  } else if(picture==='cozy-kitchen') {
    box('kitchen-wall',54,60,492,430,13);window('kitchen',312,88,184,185);box('kitchen-shelf',86,157,190,14,3);
    mug('shelf-cup',124,153,26,46);box('tea-jar',186,109,48,48,6);ellipse('tea-jar-lid',210,110,29,7);
    box('tile-backsplash',78,289,444,130,3);for(let i=0;i<5;i++)details.push(`M${152+i*74} 289V419`);details.push('M78 354H522');
    box('countertop',65,419,471,22,5);box('cabinet-left',80,441,198,88,7);box('cabinet-right',284,441,238,88,7);
    box('cabinet-handle-left',226,456,27,8,4);box('cabinet-handle-right',311,456,27,8,4);
    path('kettle-handle','M137 349C128 276 258 276 249 349L233 351C241 303 147 303 153 349Z');path('kettle-spout','M144 364L102 332L99 348L132 393Z');
    path('kettle-body','M140 340Q196 319 246 344L254 401Q196 431 136 402Z');ellipse('kettle-lid',193,339,36,9);circle('kettle-knob',194,329,9);
    mug('tea',355,409,34,51);ellipse('tea-saucer',357,413,56,10);plant('windowsill',442,250,30,52,0);
    path('dish-towel','M440 426L486 426L492 508Q465 521 438 507Z');for(let i=0;i<3;i++)details.push(`M${452+i*11} 442V502`);details.push('M189 287C169 270 210 261 193 247','M350 334C331 321 367 311 353 297');
  } else if(picture==='reading-corner') {
    window('reading',79,70,188,227);box('bookcase',386,77,123,279,9);
    for(let i=0;i<5;i++){box(`book-top-${i}`,399+i*19,111+random()*15,16,90,2);box(`book-bottom-${i}`,399+i*19,244+random()*12,16,78,2);}box('bookcase-board',390,215,115,11,1);
    path('lamp-shade','M283 106Q310 70 339 106L366 176Q310 199 255 176Z');box('lamp-stem',306,186,8,241,2);ellipse('lamp-base',310,436,47,12);
    box('chair-back',174,252,231,152,45);box('chair-seat',182,371,213,89,29);box('chair-arm-left',141,329,53,143,25);box('chair-arm-right',385,329,53,143,25);
    box('chair-foot-left',177,467,27,57,5);box('chair-foot-right',382,467,27,57,5);
    path('knitted-throw','M268 285Q308 276 343 289L357 493Q314 511 272 492Z');for(let i=0;i<5;i++)details.push(`M${278+i*14} 303Q${289+i*13} 389 ${279+i*15} 492`);
    path('open-book-left','M219 345Q256 322 287 350V407Q253 383 219 399Z');path('open-book-right','M287 350Q325 326 350 343V399Q320 386 287 407Z');details.push('M231 355Q260 342 276 356M231 367Q260 353 276 368M300 355Q322 344 340 351');
    plant('reading-fern',89,436,54,109,2);ellipse('reading-rug',300,531,219,21);
  } else if(picture==='crochet-basket') {
    table();path('basket-handle','M122 320C87 123 492 123 455 320L435 320C467 153 112 153 144 320Z');
    path('craft-basket','M93 325Q302 358 507 325L477 484Q300 522 122 484Z');ellipse('craft-basket-rim',300,325,207,28);
    yarn('one',176,278,59);yarn('two',283,262,62);yarn('three',400,287,66);
    path('crochet-hook','M419 275L440 132Q449 120 463 132L459 144Q451 135 451 145L431 279Z');
    for(let i=0;i<8;i++)details.push(`M${141+i*43} 366Q${154+i*39} 421 ${147+i*41} 480`);for(let i=0;i<4;i++)details.push(`M119 ${384+i*26}Q301 ${411+i*25} 492 ${384+i*26}`);
    path('square-cloth','M204 352Q315 334 419 352L431 504Q314 523 203 502Z');
    for(let row=0;row<2;row++)for(let col=0;col<3;col++){const x=240+col*70,y=389+row*73;box(`granny-background-${row}-${col}`,x-31,y-30,61,61,3);bloom(`granny-flower-${row}-${col}`,x,y,21);}
    details.push('M214 507V519M231 511V524M248 513V527M401 509V522M418 507V519');
  } else if(picture==='pottery-bouquet') {
    table();
    for(let i=0;i<5;i++){const x=177+i*61,y=193+Math.sin(i*1.5)*42+(random()-.5)*21;path(`bouquet-stem-${i}`,`M294 399Q${270+i*15} 301 ${x-3} ${y}L${x+3} ${y}Q${283+i*15} 310 303 399Z`);leaf(`bouquet-leaf-${i}`,276+i*10,343-i*13,37,63,i%2?-1:1);bloom(`bouquet-flower-${i}`,x,y,38+random()*7);}
    path('handmade-vase','M243 348Q299 365 358 348L353 388Q385 420 383 466Q375 512 300 515Q222 517 216 465Q215 418 246 388Z');ellipse('handmade-vase-mouth',300,350,57,14);
    path('vase-color-band','M218 451Q300 474 382 451L378 477Q301 500 222 477Z');details.push('M236 420Q244 399 253 393','M263 493Q286 501 307 499');
    ellipse('fruit-dish',463,486,70,23);path('dish-foot','M445 505H480L482 523Q463 533 443 523Z');
    [434,462,490].forEach((x,i)=>{path(`berry-${i}`,`M${x-12} 470Q${x} 459 ${x+12} 470Q${x+11} 487 ${x} 495Q${x-12} 486 ${x-12} 470Z`);leaf(`berry-leaf-${i}`,x,472,10,14,i%2?1:-1);});
  } else if(picture==='pottery-table') {
    path('craft-tablecloth','M53 277Q301 251 548 277L561 504Q300 546 41 504Z');
    box('clay-board',89,293,257,167,17);ellipse('clay-lump',138,344,34,27,-14);
    mug('unfinished',242,407,47,73);path('cup-decoration','M211 365Q241 348 271 365L267 388Q241 373 215 388Z');
    path('paintbrush-handle','M137 433L199 493L206 486L146 424Z');path('paintbrush-tip','M137 433Q110 433 111 402Q142 404 146 424Z');
    path('clay-tool','M314 302L352 403L362 399L329 296Z');ellipse('clay-tool-end',321,298,19,8,-23);
    ellipse('oval-tray',433,353,74,62,-8);ellipse('oval-tray-center',433,353,53,43,-8);cat('tiny-sculpture',434,346,.42,'gray');
    pot('paint-jar',427,430,39,55);ellipse('paint-in-jar',427,430,30,7);box('paintbrush-in-jar',423,370,9,59,2);
    bloom('clay-flower',356,479,31);path('little-dish','M88 478Q124 457 160 478L154 498Q125 513 93 498Z');
    details.push('M72 291Q64 369 66 438','M480 298Q515 321 519 368');
  }
  return { regions, details };
}

function makeLegacyIllustration(seed: number, picture: SceneId): { regions: Region[]; details: string[] } {
  const random = seededRandom(seed);
  const regions: Region[] = [];
  const details: string[] = [];
  const path = (id: string, d: string) => regions.push({ id, kind: 'path', props: { d } });
  const ellipse = (id: string, cx: number, cy: number, rx: number, ry: number, rotate = 0) => regions.push({ id, kind: 'ellipse', props: { cx, cy, rx, ry, transform: `rotate(${rotate} ${cx} ${cy})` } });
  const circle = (id: string, cx: number, cy: number, r: number) => regions.push({ id, kind: 'circle', props: { cx, cy, r } });

  if (picture === 'flowers') {
    const count = 5 + Math.floor(random() * 4);
    const centers: [number, number][] = [];
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI * 0.94 + (i / Math.max(count - 1, 1)) * Math.PI * 0.9;
      const length = 145 + random() * 95;
      const cx = 300 + Math.cos(angle) * length;
      const cy = 390 + Math.sin(angle) * length;
      centers.push([cx, cy]);
      path(`stem-${i}`, `M 295 460 Q ${260 + random() * 80} 330 ${cx} ${cy} L ${cx + 4} ${cy} Q ${330 + random() * 30} 365 305 460 Z`);
      const leafY = 290 + random() * 80;
      ellipse(`leaf-${i}`, 272 + (i % 2) * 60, leafY, 16, 43, i % 2 ? 45 : -45);
    }
    centers.forEach(([cx, cy], i) => {
      const petals = 5 + Math.floor(random() * 4);
      const radius = 24 + random() * 9;
      for (let j = 0; j < petals; j++) {
        const a = j * Math.PI * 2 / petals;
        ellipse(`petal-${i}-${j}`, cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, 18 + random() * 4, 31, a * 180 / Math.PI + 90);
      }
      circle(`heart-${i}`, cx, cy, 18 + random() * 4);
    });
    path('vase', 'M 233 397 Q 300 422 367 397 L 351 505 Q 300 534 249 505 Z');
    ellipse('vase-rim', 300, 398, 67, 17);
    ellipse('vase-mark', 300, 463, 26, 20);
    details.push('M 287 463 Q 300 451 313 463 Q 300 477 287 463');
    for (let i = 0; i < 4; i++) circle(`sparkle-${i}`, 89 + random() * 420, 80 + random() * 420, 5 + random() * 4);
  } else if (picture === 'cat') {
    const lean = Math.round((random() - 0.5) * 26);
    ellipse('rug', 292, 491, 197, 36);
    path('tail', `M 381 456 C 485 490 516 369 463 335 C 445 326 426 350 439 365 C 467 393 429 430 386 410 Z`);
    ellipse('body', 298 + lean, 392, 102, 107);
    ellipse('paw-left', 250 + lean, 476, 38, 22);
    ellipse('paw-right', 348 + lean, 476, 38, 22);
    path('head', `M 198 284 L 183 168 Q 194 153 252 207 Q 300 183 347 207 Q 405 153 416 168 L 402 284 Q 412 369 300 369 Q 187 369 198 284 Z`);
    path('ear-left', 'M 203 195 L 213 264 L 245 222 Z');
    path('ear-right', 'M 393 195 L 383 264 L 351 222 Z');
    ellipse('cheek-left', 228, 310, 24, 14);
    ellipse('cheek-right', 372, 310, 24, 14);
    path('nose', 'M 287 289 Q 300 282 313 289 L 300 304 Z');
    ellipse('belly', 300 + lean, 409, 47, 57);
    details.push('M 233 280 Q 246 262 259 280', 'M 341 280 Q 354 262 367 280', 'M 300 304 L 300 316 Q 284 331 275 315', 'M 300 316 Q 316 331 325 315', 'M 213 300 L 173 291', 'M 213 312 L 172 315', 'M 387 300 L 427 291', 'M 387 312 L 428 315', 'M 233 475 L 233 485 M 247 475 L 247 487', 'M 346 475 L 346 487 M 360 475 L 360 485');
    if (random() > 0.45) {
      path('hat', 'M 220 218 L 239 165 Q 299 149 361 165 L 380 218 Z');
      ellipse('hat-brim', 300, 216, 95, 13);
    } else {
      path('bow-left', 'M 293 366 Q 253 342 247 360 Q 243 389 293 377 Z');
      path('bow-right', 'M 307 366 Q 347 342 353 360 Q 357 389 307 377 Z');
      circle('bow-center', 300, 371, 11);
    }
    path('pot', 'M 80 402 L 151 402 L 142 476 L 90 476 Z');
    ellipse('pot-top', 115, 402, 39, 10);
    path('plant-stem', 'M 112 403 L 112 317 L 119 317 L 119 403 Z');
    ellipse('plant-left', 92, 355, 15, 30, -48);
    ellipse('plant-right', 139, 331, 15, 30, 48);
    circle('floating-dot', 487, 166, 9);
    path('floating-heart', 'M 471 234 C 446 215 455 194 471 204 C 487 194 496 215 471 234 Z');
  } else if (picture === 'pottery') {
    const objects = 6;
    for (let i = 0; i < objects; i++) {
      const x = 118 + (i % 3) * 180;
      const y = 285 + Math.floor(i / 3) * 218;
      const height = 78 + random() * 35;
      const width = 41 + random() * 10;
      const kind = Math.floor(random() * 3);
      if (kind === 0) {
        path(`cup-handle-${i}`, `M ${x + width - 8} ${y - height + 12} C ${x + width + 55} ${y - height - 8} ${x + width + 49} ${y - 14} ${x + width - 4} ${y - 18} L ${x + width - 4} ${y - 34} C ${x + width + 27} ${y - 34} ${x + width + 27} ${y - height + 12} ${x + width - 8} ${y - height + 29} Z`);
        path(`cup-${i}`, `M ${x - width} ${y - height} L ${x + width} ${y - height} L ${x + width - 7} ${y - 7} Q ${x} ${y + 12} ${x - width + 7} ${y - 7} Z`);
        ellipse(`cup-rim-${i}`, x, y - height, width, 12);
      } else if (kind === 1) {
        path(`vase-${i}`, `M ${x - 20} ${y - height - 20} L ${x + 20} ${y - height - 20} Q ${x + 18} ${y - height + 4} ${x + width} ${y - 46} Q ${x + width + 10} ${y + 8} ${x} ${y + 6} Q ${x - width - 10} ${y + 8} ${x - width} ${y - 46} Q ${x - 18} ${y - height + 4} ${x - 20} ${y - height - 20} Z`);
        ellipse(`vase-mouth-${i}`, x, y - height - 20, 20, 6);
      } else {
        path(`planter-${i}`, `M ${x - width} ${y - 59} L ${x + width} ${y - 59} L ${x + width - 10} ${y + 4} L ${x - width + 10} ${y + 4} Z`);
        ellipse(`planter-lip-${i}`, x, y - 59, width + 4, 9);
        path(`sprout-${i}`, `M ${x - 3} ${y - 60} L ${x - 3} ${y - height - 25} L ${x + 3} ${y - height - 25} L ${x + 3} ${y - 60} Z`);
        ellipse(`sprout-left-${i}`, x - 18, y - height, 14, 29, -45);
        ellipse(`sprout-right-${i}`, x + 18, y - height - 23, 14, 29, 45);
      }
      if (kind !== 2) {
        circle(`stamp-${i}`, x, y - 36, 15);
        details.push(`M ${x - 7} ${y - 35} Q ${x} ${y - 25} ${x + 7} ${y - 35}`);
      }
      details.push(`M ${x - 62} ${y + 16} L ${x + 70} ${y + 16}`);
    }
    details.push('M 47 303 L 553 303', 'M 47 521 L 553 521');
  } else if (picture === 'journey') {
    const cloudShift = Math.round(random() * 80);
    circle('sun', 446, 109, 35 + random() * 10);
    path('mountain-left', 'M 30 325 L 148 130 L 249 325 Z');
    path('mountain-right', 'M 204 325 L 353 156 L 475 325 Z');
    path('mountain-snow', 'M 115 184 L 148 130 L 182 186 L 163 177 L 148 192 L 134 180 Z');
    path('cloud', `M ${100 + cloudShift} 90 C ${83 + cloudShift} 89 ${83 + cloudShift} 65 ${99 + cloudShift} 63 C ${108 + cloudShift} 38 ${143 + cloudShift} 45 ${147 + cloudShift} 60 C ${169 + cloudShift} 56 ${181 + cloudShift} 87 ${160 + cloudShift} 90 Z`);
    path('hill', 'M 30 376 Q 150 270 303 351 Q 423 268 570 343 L 570 493 L 30 493 Z');
    path('road', 'M 41 493 Q 292 447 559 497 L 559 527 Q 290 485 41 523 Z');
    path('van-body', 'M 134 323 L 151 243 Q 155 228 177 228 L 400 228 Q 419 228 427 247 L 462 326 L 462 420 Q 462 435 445 435 L 146 435 Q 132 435 132 418 Z');
    path('van-bottom', 'M 132 326 L 462 326 L 462 417 Q 462 435 445 435 L 146 435 Q 132 435 132 418 Z');
    path('window-left', 'M 167 247 L 244 247 L 244 309 L 155 309 Z');
    path('window-middle', 'M 263 247 L 338 247 L 338 309 L 263 309 Z');
    path('window-right', 'M 356 247 L 400 247 Q 408 247 412 260 L 434 309 L 356 309 Z');
    circle('wheel-left', 203, 431, 33); circle('wheel-right', 400, 431, 33);
    circle('hub-left', 203, 431, 15); circle('hub-right', 400, 431, 15);
    path('bumper', 'M 123 397 L 153 397 L 153 416 L 123 416 Z');
    path('bumper-front', 'M 443 397 L 473 397 L 473 416 L 443 416 Z');
    ellipse('headlight', 449, 355, 9, 16);
    path('roof-case', 'M 230 206 Q 233 194 246 194 L 331 194 Q 344 194 347 206 L 347 225 L 230 225 Z');
    details.push('M 285 332 L 285 417', 'M 309 345 L 326 345', 'M 256 196 L 256 224', 'M 324 196 L 324 224', 'M 156 371 L 234 371', 'M 156 383 L 222 383');
    ellipse('cat-head-in-window', 299, 291, 20, 14);
    path('cat-ear-in-window-left', 'M 282 281 L 282 271 L 292 278 Z');
    path('cat-ear-in-window-right', 'M 306 278 L 316 271 L 316 282 Z');
    details.push('M 290 287 L 291 287 M 307 287 L 308 287', 'M 296 294 Q 299 298 302 294');
    for (let i = 0; i < 4; i++) {
      const x = 70 + i * 149; const y = 465 + random() * 11;
      ellipse(`road-flower-${i}`, x, y, 7, 11, i * 37); circle(`road-flower-heart-${i}`, x, y, 3);
    }
  } else {
    path('forest-hill', 'M 34 413 Q 137 352 286 397 Q 435 346 566 421 L 566 523 L 34 523 Z');
    const trees = [112, 298, 486];
    trees.forEach((x, i) => {
      const canopyY = 173 + random() * 40;
      path(`tree-trunk-${i}`, `M ${x - 16} ${canopyY + 75} L ${x + 16} ${canopyY + 75} L ${x + 22} 443 L ${x - 22} 443 Z`);
      path(`tree-canopy-${i}`, `M ${x - 79} ${canopyY + 60} C ${x - 119} ${canopyY + 18} ${x - 68} ${canopyY - 24} ${x - 43} ${canopyY - 12} C ${x - 30} ${canopyY - 70} ${x + 46} ${canopyY - 70} ${x + 47} ${canopyY - 15} C ${x + 98} ${canopyY - 22} ${x + 115} ${canopyY + 43} ${x + 67} ${canopyY + 65} C ${x + 36} ${canopyY + 97} ${x - 41} ${canopyY + 101} ${x - 79} ${canopyY + 60} Z`);
      details.push(`M ${x} 354 L ${x} 413 M ${x} 369 L ${x - 12} 357 M ${x} 392 L ${x + 13} 377`);
    });
    path('forest-path', 'M 222 523 Q 230 459 311 426 Q 331 416 313 399 L 330 397 Q 363 422 335 440 Q 280 485 307 523 Z');
    [80, 186, 417, 523].forEach((x, i) => {
      const y = 475 + (i % 2) * 17;
      path(`mushroom-stem-${i}`, `M ${x - 7} ${y - 8} L ${x + 7} ${y - 8} L ${x + 10} ${y + 20} Q ${x} ${y + 27} ${x - 10} ${y + 20} Z`);
      path(`mushroom-cap-${i}`, `M ${x - 25} ${y - 3} Q ${x} ${y - 46} ${x + 25} ${y - 3} Q ${x} ${y + 7} ${x - 25} ${y - 3} Z`);
      circle(`mushroom-dot-${i}-1`, x - 8, y - 13, 4); circle(`mushroom-dot-${i}-2`, x + 8, y - 10, 3);
    });
    path('sleepy-cat', 'M 361 476 Q 357 445 389 447 L 396 435 L 407 449 Q 450 447 461 474 Q 455 495 403 491 Q 365 493 361 476 Z');
    details.push('M 381 469 Q 389 475 397 469', 'M 415 465 Q 443 463 444 483', 'M 405 480 Q 389 490 378 480');
    circle('forest-firefly-1', 218, 265, 5); circle('forest-firefly-2', 391, 295, 4); circle('forest-firefly-3', 425, 130, 6);
  }
  return { regions, details };
}

