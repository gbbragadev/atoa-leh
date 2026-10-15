import type { GameId } from './types';

export type GameInfo = { id: GameId; title: string; description: string; tag: string; color: string };
export const GAMES: GameInfo[] = [
  { id: 'atelier', title: 'Pintar', description: 'Gatos, flores e pequenas cenas. Cada cor é sua.', tag: 'Tinta & papel', color: '#f2e3d9' },
  { id: 'clay', title: 'Decorar uma peça', description: 'Um vasinho ou pratinho para morar no seu cantinho.', tag: 'Cerâmica de bolso', color: '#ecd5c7' },
  { id: 'ceramic3d', title: 'Moldar com as mãos', description: 'Um torno, argila e formas que você inventa com o dedo.', tag: 'Cerâmica em 3D', color: '#eee0ca' },
  { id: 'photowall', title: 'Mural de recortes', description: 'Fotos, peças da vida real e pequenas composições suas.', tag: 'Fotos & lembranças', color: '#eae2d4' },
  { id: 'wordsearch', title: 'Caça-palavras', description: 'Palavras de gatos, plantas, cozinha e artesanato.', tag: 'Uma brincadeira', color: '#e5e9d5' },
  { id: 'garden', title: 'Jardim de janela', description: 'Arrume plantinhas que ficam bonitas, mesmo quando você sai.', tag: 'Verde por aqui', color: '#dfe6d3' },
  { id: 'cats', title: 'Hora do gato', description: 'Carinho, caixas e um expediente bastante questionável.', tag: 'Companhia felina', color: '#e5dfd0' },
  { id: 'sand', title: 'Areia de bolso', description: 'Rabisque, arrume conchinhas e apague quando quiser.', tag: 'Mexer sem pressa', color: '#eee3ce' },
  { id: 'crochet', title: 'Ponto por ponto', description: 'Faça um pequeno bordado de cores, do seu jeito.', tag: 'Fios & invenções', color: '#eee0e4' },
  { id: 'word', title: 'Uma palavra', description: 'Uma palavra de cada vez. Dicas quando der vontade.', tag: 'Letras & pistas', color: '#e6e9d9' },
  { id: 'memory', title: 'Pares de coisinhas', description: 'Encontre os pares entre coisas que deixam a casa gostosa.', tag: 'Memória', color: '#efe4d1' },
  { id: 'constellation', title: 'Gatos & flores', description: 'Uma velha conhecida com um tabuleiro diferente.', tag: 'Só ou a dois', color: '#e9e2ed' },
];
export const GAME_BY_ID = Object.fromEntries(GAMES.map(game => [game.id, game])) as Record<GameId, GameInfo>;
export function isGameId(value: string): value is GameId { return GAMES.some(game => game.id === value); }
