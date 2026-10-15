export type Creation = { id: string; createdAt: number; kind: string; title: string; dataUrl: string; version?: 1; display?: 'frame' | 'object'; plant?: 'none' | 'fern' | 'flower' | 'succulent' };
export type CatProfile = { name: string; coat: 'orange' | 'cow' | 'siamese' };
export type GameProps = { onSave: (creation: Omit<Creation, 'id' | 'createdAt'>) => Promise<void>; soundEnabled: boolean; catProfiles?: CatProfile[]; creations?: Creation[] };
export type GameId = 'atelier' | 'crochet' | 'clay' | 'ceramic3d' | 'photowall' | 'garden' | 'cats' | 'sand' | 'wordsearch' | 'word' | 'memory' | 'constellation';
export type Settings = { nickname: string; theme: 'sage' | 'rose' | 'lavender'; sound: boolean; reducedMotion: boolean; letter: string; showCat?: boolean };
