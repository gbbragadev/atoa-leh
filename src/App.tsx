import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, DownloadSimple, Envelope, Flower, Gear, Heart, House, PaintBrush, Shuffle, SpeakerHigh, SpeakerSlash, Sparkle, Sun, UploadSimple, X } from '@phosphor-icons/react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { BrandMark, GameArtwork } from './components/Artwork';
import Companion from './components/Companion';
import Shelf from './components/Shelf';
import { GAMES, GAME_BY_ID, isGameId, type GameInfo } from './lib/catalog';
import type { Creation, GameId, GameProps, Settings } from './lib/types';
import { useGallery } from './lib/gallery';
import { flushStorage, hasUnsavedChanges, readStored, retryStorage, usePersistentState } from './lib/storage';
import { EMPTY_GIFT, parseGift, type GiftContent } from './lib/gift';
import { BackupValidationError, makeBackup, MAX_BACKUP_BYTES, restoreBackup } from './lib/backup';
import { setRainSound } from './lib/sound';
import { compressPhoto } from './lib/photos';

const gameComponents = {
  atelier: lazy(() => import('./games/Atelier')),
  clay: lazy(() => import('./games/Clay')),
  ceramic3d: lazy(() => import('./games/Ceramic3D')),
  photowall: lazy(() => import('./games/PhotoWall')),
  wordsearch: lazy(() => import('./games/WordSearch')),
  garden: lazy(() => import('./games/Garden')),
  cats: lazy(() => import('./games/Cats')),
  sand: lazy(() => import('./games/Sand')),
  crochet: lazy(() => import('./games/Crochet')),
  word: lazy(() => import('./games/SoftWord')),
  memory: lazy(() => import('./games/Memory')),
  constellation: lazy(() => import('./games/Constellation')),
};
type Page = 'home' | 'play' | 'saved' | 'love' | 'settings' | GameId;
type Toast = { text: string; shelf?: boolean };
const DEFAULT_SETTINGS: Settings = { nickname: 'Leh', theme: 'sage', sound: false, reducedMotion: false, letter: '', showCat: true };
const navigation = [{ id: 'home', label: 'Meu ateliê', Icon: House }, { id: 'play', label: 'Brincadeiras', Icon: Sparkle }, { id: 'saved', label: 'Meu cantinho', Icon: Flower }, { id: 'love', label: 'Cartinhas', Icon: Envelope }] as const;
function currentPage(): Page {
  const page = window.location.hash.slice(1);
  return isGameId(page) || ['home', 'play', 'saved', 'love', 'settings'].includes(page) ? page as Page : 'home';
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
function dataBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(','); const mime = dataUrl.slice(5, dataUrl.indexOf(';')); const bytes = atob(dataUrl.slice(comma + 1));
  return new Blob([Uint8Array.from(bytes, char => char.charCodeAt(0))], { type: mime });
}
function Modal({ label, children, onClose, className = '' }: { label: string; children: ReactNode; onClose: () => void; className?: string }) {
  const element = useRef<HTMLDivElement>(null); const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null; const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const node = element.current!; (node.querySelector<HTMLElement>('[data-autofocus]') ?? node.querySelector<HTMLElement>('button,input,textarea') ?? node).focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const controls = [...node.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,textarea,select,[tabindex="0"]')].filter(control => control.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); node.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = previousOverflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className="modal-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}><div className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={label} ref={element} tabIndex={-1}><button className="icon-button modal-close" onClick={onClose} aria-label="Fechar"><X size={21}/></button>{children}</div></div>;
}
function NoteJar() { return <svg viewBox="0 0 160 160" aria-hidden="true"><path d="M46 38h68l6 16q17 96-40 96t-40-96z" fill="#faf7e7" stroke="#a5ac89" strokeWidth="2"/><rect x="45" y="27" width="70" height="14" rx="5" fill="#baa27d"/><path d="M54 84l42-12 11 42-43 12z" fill="#e8c9bf"/><path d="M67 65l43 7-7 41-42-8z" fill="#e5ddb4"/><path d="M76 92c-12-14-24 6 4 22 28-16 13-36-4-22z" fill="#b98086"/><path d="M41 59h77" stroke="#d8ddc5" strokeWidth="2"/></svg>; }

export default function App({ storageAvailable }: { storageAvailable: boolean }) {
  const [page, setPage] = useState<Page>(currentPage);
  const [settings, setSettings] = usePersistentState<Settings>('settings', DEFAULT_SETTINGS);
  const [favorites, setFavorites] = usePersistentState<GameId[]>('favorites', []);
  const [lastGame, setLastGame] = usePersistentState<GameId | null>('last-game', null);
  const [order, setOrder] = usePersistentState<string[]>('shelf-layout', []);
  const [introSeen, setIntroSeen] = usePersistentState<boolean>('intro-seen', false);
  const [gift, setGift] = usePersistentState<GiftContent>('gift-content', () => {
    const existing = readStored<GiftContent | null>('gift-content', null); if (existing) return existing;
    const old = readStored<Settings>('settings', DEFAULT_SETTINGS); const notes = readStored<string[]>('love-notes', []);
    return old.letter || notes.length ? { version: 1, source: 'personal', notes, ...(old.letter ? { letter: old.letter } : {}) } : EMPTY_GIFT;
  });
  const gallery = useGallery();
  const [sound, setSound] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [storageWarning, setStorageWarning] = useState(!storageAvailable);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Creation | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [introduction, setIntroduction] = useState(!introSeen);
  const [giftEditing, setGiftEditing] = useState(false);
  const [letterDraft, setLetterDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [giftEditorDraft, setGiftEditorDraft] = usePersistentState<{ letter: string; notes: string } | null>('gift-editor-draft', null);
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');
  const [swError, setSwError] = useState(false);
  const { offlineReady: [offlineReady], needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({ onRegisterError() { setSwError(true); } });
  const selectedGame = isGameId(page) ? GAME_BY_ID[page] : null;
  const notify = useCallback((text: string, shelf = false) => setToast({ text, shelf }), []);

  useEffect(() => {
    const route = () => { setPage(currentPage()); setError(''); window.scrollTo({ top: 0, behavior: 'instant' }); };
    window.addEventListener('hashchange', route); return () => window.removeEventListener('hashchange', route);
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = settings.theme; document.documentElement.dataset.motion = settings.reducedMotion ? 'reduced' : 'normal'; }, [settings.theme, settings.reducedMotion]);
  useEffect(() => { if (selectedGame) setLastGame(selectedGame.id); }, [selectedGame?.id, setLastGame]);
  useEffect(() => {
    const failed = () => setStorageWarning(true);
    const hidden = () => { void flushStorage(); void setRainSound(false); setSound(false); };
    const visibility = () => { if (document.hidden) hidden(); };
    window.addEventListener('atoa-storage-error', failed); window.addEventListener('pagehide', hidden); document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('atoa-storage-error', failed); window.removeEventListener('pagehide', hidden); document.removeEventListener('visibilitychange', visibility); void setRainSound(false); };
  }, []);
  useEffect(() => { if (gallery.error) setStorageWarning(true); }, [gallery.error]);
  useEffect(() => { if (!toast) return; const timeout = window.setTimeout(() => setToast(null), toast.shelf ? 8500 : 4500); return () => clearTimeout(timeout); }, [toast]);

  function go(next: Page) { window.location.hash = next; if (page === next) window.scrollTo({ top: 0, behavior: 'instant' }); }
  function favorite(id: GameId) { setFavorites(previous => previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id]); }
  function surprise() { const choices: GameId[] = ['atelier', 'clay', 'ceramic3d', 'wordsearch', 'garden', 'cats', 'sand']; go(choices[Math.floor(Math.random() * choices.length)]); }
  async function toggleSound() {
    try { await setRainSound(!sound); setSound(!sound); setSettings(previous => ({ ...previous, sound: !sound })); }
    catch { setError('Leh, o som não abriu neste navegador. O ateliê continua funcionando em silêncio.'); }
  }
  const saveCreation: GameProps['onSave'] = async creation => {
    try { await gallery.save(creation); notify('Sua criação está no cantinho.', true); }
    catch (failure) { setStorageWarning(true); throw failure; }
  };
  async function exportBackup() {
    setBusy(true); setError('');
    try {
      const backup = await makeBackup(gallery.creations);
      const filename = `atoa-leh-${new Date().toISOString().slice(0, 10)}.json`;
      const file = new File([JSON.stringify(backup)], filename, { type: 'application/json' });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title: 'Cópia do meu cantinho' });
        notify('Cópia preparada. Escolha onde guardar.');
      } else {
        download(file, filename); notify('Escolha onde guardar a cópia.');
      }
    } catch (failure) {
      if (!(failure instanceof Error && failure.name === 'AbortError')) setError(failure instanceof Error ? failure.message : 'Não consegui preparar a cópia. Seus dados continuam aqui.');
    } finally { setBusy(false); }
  }
  async function importBackup(file: File) {
    setBusy(true); setError('');
    try { if (file.size > MAX_BACKUP_BYTES) throw new BackupValidationError('Esta cópia ultrapassa 80 MB.'); await restoreBackup(await file.text()); setStorageWarning(hasUnsavedChanges()); notify('Cópia restaurada. Seu cantinho está aqui.'); }
    catch (failure) { setError(failure instanceof BackupValidationError ? failure.message : 'Não consegui gravar esta cópia. Seus dados anteriores foram preservados. Verifique o espaço do aparelho e tente novamente.'); }
    finally { setBusy(false); }
  }
  async function importGift(file: File) {
    setBusy(true); setError('');
    try { if (file.size > 1024 * 1024) throw new Error('Este arquivo de palavras é grande demais. Escolha o JSON do presente.'); const content = parseGift(await file.text()); setGift(content); await flushStorage(); if (hasUnsavedChanges()) throw new Error('As palavras apareceram aqui, mas ainda não foram gravadas. Tente guardar novamente.'); notify('Carta e bilhetes guardados neste aparelho.'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Não consegui importar as palavras.'); }
    finally { setBusy(false); }
  }
  async function importPhotos(files: FileList) {
    setBusy(true); setError(''); let saved = 0;
    try {
      for (const file of Array.from(files)) {
        const dataUrl = await compressPhoto(file);
        await new Promise<void>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(); image.onerror = () => reject(new Error('Esta imagem não abriu. Escolha outra foto.')); image.src = dataUrl; });
        await gallery.save({ kind: 'photo', title: 'Um recorte de nós', dataUrl, display: 'frame' }); saved++;
      }
      notify(`${saved === 1 ? 'Foto guardada' : `${saved} fotos guardadas`} neste aparelho.`, true);
    } catch (failure) { setError(`${saved ? `${saved} ${saved === 1 ? 'foto foi guardada' : 'fotos foram guardadas'}. ` : ''}${failure instanceof Error ? failure.message : 'Não consegui guardar as fotos.'}`); }
    finally { setBusy(false); }
  }
  function editGift() { setLetterDraft(giftEditorDraft?.letter ?? gift.letter ?? ''); setNotesDraft(giftEditorDraft?.notes ?? gift.notes.join('\n\n')); setGiftEditing(true); }
  function updateGiftDraft(field: 'letter' | 'notes', value: string) {
    if (field === 'letter') setLetterDraft(value); else setNotesDraft(value);
    setGiftEditorDraft(previous => ({ letter: previous?.letter ?? letterDraft, notes: previous?.notes ?? notesDraft, [field]: value }));
  }
  async function saveGift() {
    setBusy(true); setError('');
    try {
      const notes = notesDraft.split(/\n\s*\n/).map(text => text.trim()).filter(Boolean);
      if (letterDraft.length > 16000 || notes.length > 200 || notes.some(text => text.length > 3000)) throw new Error('Use uma carta de até 16 mil caracteres e bilhetes de até 3 mil caracteres.');
      setGift({ version: 1, source: 'personal', notes, ...(gift.cats ? { cats: gift.cats } : {}), ...(letterDraft.trim() ? { letter: letterDraft.trim() } : {}) });
      await flushStorage(); if (hasUnsavedChanges()) throw new Error('As palavras ainda não foram gravadas. Tente guardar novamente.'); setGiftEditorDraft(null); setGiftEditing(false); notify('Suas palavras foram guardadas neste aparelho.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Não consegui guardar as palavras.'); }
    finally { setBusy(false); }
  }
  async function retry() { setBusy(true); try { const draftsSaved = await retryStorage(); const galleryReadable = await gallery.refresh(); const success = draftsSaved && galleryReadable; setStorageWarning(!success); if (success) notify('Rascunhos guardados. Você já pode guardar suas peças novamente.'); } catch { setStorageWarning(true); } finally { setBusy(false); } }
  async function removeCreation() { if (!removeId) return; setBusy(true); try { await gallery.remove(removeId); setRemoveId(null); notify('Retirado do cantinho.'); } catch { setError('Não consegui retirar esta criação. Ela continua na prateleira.'); setStorageWarning(true); } finally { setBusy(false); } }
  async function updateApp() { setBusy(true); setError(''); try { await flushStorage(); if (hasUnsavedChanges()) throw new Error('Guarde as alterações antes de atualizar. Use Tentar guardar de novo.'); await updateServiceWorker(true); } catch (failure) { setError(failure instanceof Error ? failure.message : 'A atualização não abriu. Tente depois.'); } finally { setBusy(false); } }
  async function shareCreation(item: Creation) {
    const blob = dataBlob(item.dataUrl); const extension = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png'; const filename = `minha-criacao.${extension}`;
    const file = new File([blob], filename, { type: blob.type });
    try { if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: item.title }); else download(blob, filename); }
    catch (failure) { if (!(failure instanceof DOMException && failure.name === 'AbortError')) setError('Não consegui compartilhar. Você pode exportar a imagem.'); }
  }
  function closeIntroduction() { setIntroSeen(true); setIntroduction(false); }
  function GameCard({ game }: { game: GameInfo }) { return <article className="game-card"><button className="game-open" onClick={() => go(game.id)}><div className="game-preview" style={{ background: game.color }}><GameArtwork kind={game.id}/><ArrowRight className="card-arrow" size={20}/></div><div className="game-card-copy"><span className="card-tag">{game.tag}</span><h3>{game.title}</h3><p>{game.description}</p></div></button><button className={`favorite-button ${favorites.includes(game.id) ? 'is-favorite' : ''}`} onClick={() => favorite(game.id)} aria-label={`${favorites.includes(game.id) ? 'Tirar' : 'Adicionar'} ${game.title} ${favorites.includes(game.id) ? 'dos' : 'aos'} favoritos`} aria-pressed={favorites.includes(game.id)}><Heart size={19} weight={favorites.includes(game.id) ? 'fill' : 'regular'}/></button></article>; }
  const activeNav = selectedGame ? 'play' : page;
  const nickname = settings.nickname.trim() || 'Leh';
  const Game = selectedGame ? gameComponents[selectedGame.id] : null;

  return <div className={`app-shell ${selectedGame ? 'is-game' : ''}`}>
    <aside className="sidebar"><button className="brand" onClick={() => go('home')} aria-label="À toa, Leh — início"><BrandMark/><span>À toa, Leh<small className="brand-small">SEU CANTINHO, SEM PRESSA</small></span></button><div className="sidebar-divider"/><nav aria-label="Navegação principal">{navigation.map(({ id, label, Icon }) => <button key={id} className={`nav-button ${activeNav === id ? 'active' : ''}`} onClick={() => go(id)} aria-current={activeNav === id ? 'page' : undefined}><Icon size={22}/>{label}{id === 'love' && gift.notes.length > 0 && <span className="love-dot"/>}</button>)}</nav><div className="sidebar-note"><Flower size={28}/><p>Coisas boas também podem<br/>ser simples.</p></div><button className={`nav-button preferences-link ${page === 'settings' ? 'active' : ''}`} onClick={() => go('settings')}><Gear size={22}/>Preferências</button><div className="made-with-love"><Heart size={13}/>Feito com carinho, pelo Guilherme.</div></aside>
    <main className="main-content"><header className="topbar"><button className="mobile-brand brand" onClick={() => go('home')} aria-label="À toa, Leh — início"><BrandMark size={28}/><span>À toa, Leh</span></button><span className="topbar-greeting"><Sun size={22}/>Seu cantinho, sem pressa.</span><div className="topbar-actions"><button className={`icon-button ${sound ? 'sound-on' : ''}`} onClick={() => { void toggleSound(); }} aria-label={sound ? 'Desligar chuvinha' : 'Ligar chuvinha'} aria-pressed={sound}>{sound ? <SpeakerHigh size={20}/> : <SpeakerSlash size={20}/>}</button><button className="profile-button" onClick={() => go('settings')} aria-label="Abrir preferências">{nickname.charAt(0).toUpperCase()}<Heart size={12} weight="fill"/></button></div></header>
      {storageWarning && <div className="storage-warning" role="alert"><strong>Não consegui guardar algumas alterações.</strong><br/>Mantenha esta página aberta. Você pode exportar uma cópia e tentar gravar de novo.<div><button onClick={() => { void exportBackup(); }} disabled={busy}>Exportar cópia</button><button onClick={() => { void retry(); }} disabled={busy}>Tentar guardar de novo</button></div></div>}
      {error && <div className="storage-warning" role="alert">{error}<button onClick={() => setError('')} aria-label="Fechar aviso"><X size={16}/></button></div>}
      {page === 'home' && <div className="page-enter"><div className="page-heading"><div><span className="eyebrow">Pequenas invenções</span><h1>Oi, {nickname} <span className="tiny-heart">♡</span></h1></div><span className="little-sun"><Sun size={39}/></span></div><section className="home-hero"><div className="hero-copy"><span className="handwritten">Hoje cabe uma coisinha.</span><h2>Tinta, plantinha<br/>e tempo à toa.</h2><p>Escolha uma cor, invente um vasinho ou brinque um pouquinho. Pode deixar pela metade.</p><button className="primary-button surprise-button" onClick={surprise}><Shuffle size={18}/>Me dá uma coisinha pra fazer</button><span className="hero-footnote">Só abrir e mexer. O resto pode esperar.</span></div><div className="hero-art"><img src="/images/cantinho-v2.png" alt="Um cantinho aconchegante, com gatos descansando, plantas, tintas e uma pequena van amarela."/><span className="hero-caption"><Heart size={11}/>um lugar para suas invenções</span></div></section><div className="studio-entry-grid"><button className="studio-entry studio-entry-paint" onClick={() => go('atelier')}><GameArtwork kind="atelier"/><h3>Pintar</h3><p>Um desenho, todas as suas cores.</p></button><button className="studio-entry studio-entry-play" onClick={() => go('wordsearch')}><GameArtwork kind="wordsearch"/><h3>Brincar</h3><p>Uma coisinha pronta para começar.</p></button><button className="studio-entry studio-entry-shelf" onClick={() => go('saved')}><GameArtwork kind="garden"/><h3>Meu cantinho</h3><p>Suas criações têm lugar aqui.</p></button></div><div className="home-paint-actions"><button className="text-button" onClick={() => go('clay')}>Decorar uma peça <ArrowRight size={16}/></button><button className="text-button" onClick={() => go('play')}>Mais brincadeiras <ArrowRight size={16}/></button></div>{lastGame && isGameId(lastGame) && <button className="continue-card" onClick={() => go(lastGame)}><span className="continue-icon"><PaintBrush size={22}/></span><span><small>Se der vontade de voltar</small><strong>{GAME_BY_ID[lastGame].title}</strong></span><ArrowRight size={18}/></button>}{settings.showCat !== false && <Companion catProfiles={gift.cats} onHide={() => setSettings(previous => ({ ...previous, showCat: false }))}/>}{(gift.letter || gift.notes.length > 0) && <button className="love-banner" onClick={() => go('love')}><div><Envelope size={30}/><span><strong>Um pedacinho meu</strong><br/>Palavras guardadas com carinho.</span></div><ArrowRight size={19}/></button>}<p className="home-footer"><Heart size={12}/>Um presente do Guilherme para a Letícia.</p></div>}
      {page === 'play' && <div className="play-page page-enter"><div className="page-heading"><div><span className="eyebrow">Cabe um pouquinho de brincadeira</span><h1>O que dá vontade?</h1><p>Escolha, mexa e saia quando quiser.</p></div><button className="soft-button" onClick={surprise}><Shuffle size={18}/>Me surpreenda</button></div><div className="filter-row"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Todas</button><button className={filter === 'favorites' ? 'active' : ''} onClick={() => setFilter('favorites')}>Favoritas</button></div>{filter === 'favorites' ? favorites.length ? <div className="game-grid">{GAMES.filter(game => favorites.includes(game.id)).map(game => <GameCard key={game.id} game={game}/>)}</div> : <div className="empty-state"><Heart size={32}/><h2>As suas preferidas, por perto.</h2><p>Toque no coração de uma brincadeira para guardá-la aqui.</p><button className="soft-button" onClick={() => setFilter('all')}>Ver brincadeiras</button></div> : <><div className="game-grid">{GAMES.filter(game => ['wordsearch', 'atelier', 'clay', 'ceramic3d'].includes(game.id)).map(game => <GameCard key={game.id} game={game}/>)}</div><details className="extras-details"><summary>Mais brincadeiras</summary><p>Jardim, gatos, areia, fios e outras pequenas invenções.</p><div className="game-grid">{GAMES.filter(game => !['wordsearch', 'atelier', 'clay', 'ceramic3d'].includes(game.id)).map(game => <GameCard key={game.id} game={game}/>)}</div></details></>}</div>}
      {selectedGame && Game && <section className="game-page page-enter"><button className="back-link" onClick={() => go('home')}><ArrowLeft size={17}/>Voltar ao ateliê</button><div className="game-page-heading"><span className="eyebrow">{selectedGame.tag}</span><h1>{selectedGame.title}</h1><button className={`icon-button game-favorite ${favorites.includes(selectedGame.id) ? 'is-favorite' : ''}`} aria-label={`${favorites.includes(selectedGame.id) ? 'Tirar dos' : 'Adicionar aos'} favoritos`} aria-pressed={favorites.includes(selectedGame.id)} onClick={() => favorite(selectedGame.id)}><Heart size={23} weight={favorites.includes(selectedGame.id) ? 'fill' : 'regular'}/></button></div>{(page === 'clay' || page === 'ceramic3d') && <div className="ceramic-tables" aria-label="Mesas de cerâmica"><button className={page === 'clay' ? 'selected' : ''} aria-pressed={page === 'clay'} onClick={() => go('clay')}>Pintar e carimbar</button><button className={page === 'ceramic3d' ? 'selected' : ''} aria-pressed={page === 'ceramic3d'} onClick={() => go('ceramic3d')}>Moldar em 3D</button></div>}<Suspense fallback={<div className="loading-state" role="status"><BrandMark/><p>Preparando a mesa…</p></div>}><Game onSave={saveCreation} soundEnabled={sound} catProfiles={gift.cats} creations={gallery.creations}/></Suspense></section>}
      {page === 'saved' && <section className="page-enter"><div className="page-heading shelf-intro"><div><span className="eyebrow">Feito por você</span><h1>Meu cantinho</h1><p>Inteiro ou pela metade. Aqui já fica bonito.</p></div><button className="soft-button" onClick={() => go('clay')}><PaintBrush size={18}/>Decorar uma peça</button></div><Shelf creations={gallery.creations} order={order} onReorder={setOrder} onOpen={setPreview} onRemove={setRemoveId} onCreate={() => go('clay')}/><button className="soft-button" onClick={() => go('photowall')}><Flower size={18}/>Montar meu mural de fotos</button><p className="privacy-note">Suas novas criações ficam neste aparelho. Exporte uma cópia em Preferências para guardar fora do aplicativo.</p></section>}
      {page === 'love' && <section className="page-enter"><div className="page-heading"><div><span className="eyebrow">Um pedacinho meu</span><h1>Cartinhas</h1></div><button className="text-button" onClick={() => setIntroduction(true)}>Reler a abertura <ArrowRight size={17}/></button></div>{gift.letter || gift.notes.length ? <div className="love-layout">{gift.letter && <article className="letter-paper"><div className="letter-stamp"><Envelope size={24}/>Para a Leh</div><div className="letter-text">{gift.letter}</div><button className="text-button" onClick={editGift}>Editar as palavras</button></article>}<div className="love-side">{gift.notes.length > 0 && <div className="love-jar"><NoteJar/><h2>Potinho de carinho</h2><p>Um bilhete. Sem ocasião especial.</p><button className="primary-button" onClick={() => setNote(gift.notes[Math.floor(Math.random() * gift.notes.length)])}><Envelope size={18}/>Pegar um bilhete</button><button className="text-button" onClick={editGift}>Editar os bilhetes</button></div>}</div></div> : <div className="love-empty"><Envelope size={48}/><h2>Palavras também têm lugar aqui.</h2><p>Uma carta e pequenos bilhetes podem ser escritos ou importados neste aparelho, só para este cantinho.</p><button className="soft-button" onClick={editGift}>Escrever uma carta</button><button className="text-button" onClick={() => go('settings')}>Importar meu presente <ArrowRight size={17}/></button></div>}{gallery.creations.some(item => item.kind === 'photo') && <section style={{ marginTop: 30 }}><div className="section-heading"><h2>Pequenos recortes</h2></div><div className="gallery-grid">{gallery.creations.filter(item => item.kind === 'photo').map(item => <article className="creation-card" key={item.id}><button onClick={() => setPreview(item)} aria-label="Abrir foto"><img src={item.dataUrl} alt="Uma foto guardada neste aparelho"/></button></article>)}</div></section>}</section>}
      {page === 'settings' && <section className="settings-page page-enter"><div className="page-heading"><div><span className="eyebrow">Do seu jeito</span><h1>Preferências</h1></div></div><div className="settings-section"><h2>Como chamar você?</h2><label className="control-label">Seu apelido<input type="text" maxLength={80} value={settings.nickname} onChange={event => setSettings(previous => ({ ...previous, nickname: event.target.value }))}/></label></div><div className="settings-section"><h2>As cores do cantinho</h2><div className="theme-options">{([{ id: 'sage', label: 'Folhinha', color: '#58734f' }, { id: 'rose', label: 'Rosa antigo', color: '#956375' }, { id: 'lavender', label: 'Lavanda', color: '#77668c' }] as const).map(theme => <button key={theme.id} className={settings.theme === theme.id ? 'selected' : ''} onClick={() => setSettings(previous => ({ ...previous, theme: theme.id }))} aria-pressed={settings.theme === theme.id}><span style={{ background: theme.color }}>{settings.theme === theme.id && <Check size={20}/>}</span>{theme.label}</button>)}</div><label className="settings-toggle"><span><strong>Menos movimento</strong><small>Animações discretas. A preferência do aparelho também vale.</small></span><input type="checkbox" checked={settings.reducedMotion} onChange={event => setSettings(previous => ({ ...previous, reducedMotion: event.target.checked }))}/></label><label className="settings-toggle"><span><strong>Gato do ateliê</strong><small>A companhia pode ficar ou tirar uma folga.</small></span><input type="checkbox" checked={settings.showCat !== false} onChange={event => setSettings(previous => ({ ...previous, showCat: event.target.checked }))}/></label></div><div className="settings-section"><h2>Chuvinha, se der vontade</h2><p>O som começa desligado. Você liga quando quiser e ele para ao sair do app.</p><button className="soft-button" onClick={() => { void toggleSound(); }} aria-pressed={sound}>{sound ? <SpeakerHigh size={20}/> : <SpeakerSlash size={20}/>} {sound ? 'Desligar chuvinha' : 'Ligar chuvinha'}</button></div><div className="settings-section"><h2>As palavras do presente</h2><p>A carta e as fotos do presente inicial fazem parte deste site, com a autorização do Guilherme. As palavras que você editar e as fotos que adicionar ficam neste aparelho.</p><div className="game-toolbar"><button className="soft-button" onClick={editGift}>Escrever ou editar</button><button className="soft-button" disabled={busy} onClick={() => document.getElementById('gift-file')?.click()}><UploadSimple size={18}/>Importar carta e bilhetes</button><input id="gift-file" type="file" accept="application/json,.json" hidden disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void importGift(file); event.target.value = ''; }}/><button className="soft-button" disabled={busy} onClick={() => document.getElementById('photos-file')?.click()}><UploadSimple size={18}/>Importar fotos</button><input id="photos-file" type="file" multiple accept="image/png,image/jpeg,image/webp" hidden disabled={busy} onChange={event => { const files = event.target.files; if (files?.length) void importPhotos(files); event.target.value = ''; }}/></div><p className="personalization-note">Fotos de até 15 MB cada. No editor, separe os bilhetes por uma linha em branco.</p></div><div className="settings-section"><h2>Uma cópia para guardar</h2><p>Pinturas, peças, fotos, prateleira, partidas, carta e preferências vão no arquivo. O armazenamento local pode ser removido pelo navegador: guarde uma cópia fora daqui.</p><div className="game-toolbar"><button className="soft-button" onClick={() => { void exportBackup(); }} disabled={busy}><DownloadSimple size={18}/>Exportar backup</button><button className="soft-button" disabled={busy} onClick={() => document.getElementById('backup-file')?.click()}><UploadSimple size={18}/>Importar backup</button><input id="backup-file" type="file" accept="application/json,.json" hidden disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void importBackup(file); event.target.value = ''; }}/></div><p className="small-note">A importação recupera os registros da cópia e preserva as outras criações deste aparelho. Arquivos de até 80 MB.</p></div><div className="settings-section"><h2>Levar para a tela do iPhone</h2><p>Abra o endereço HTTPS no Safari. Toque em Compartilhar, depois em Adicionar à Tela de Início e confirme Adicionar. O endereço local HTTP do computador serve para prévia, mas não prepara o uso offline no iPhone.</p><p className={offlineReady ? 'offline-label' : 'offline-progress'}>{offlineReady ? <><Check size={18}/>Ateliê preparado para abrir sem conexão neste navegador.</> : swError ? 'Não consegui preparar os arquivos offline. Abra pela conexão segura e tente de novo.' : 'O primeiro preparo offline precisa de uma conexão segura. Aguarde os arquivos serem guardados.'}</p><p className="small-note">Depois do preparo, pinturas, peças e brincadeiras funcionam sem internet. Backup local e importação também. Não há conta ou envio de hábitos de uso.</p></div><p className="privacy-note">À toa, Leh. Seu cantinho, sem pressa.</p></section>}
    </main>
    {!selectedGame && <nav className="mobile-nav" aria-label="Navegação no celular">{navigation.map(({ id, label, Icon }) => <button key={id} className={activeNav === id ? 'active' : ''} onClick={() => go(id)} aria-current={activeNav === id ? 'page' : undefined}><Icon size={23} weight={activeNav === id ? 'fill' : 'regular'}/><span>{label}</span></button>)}</nav>}
    {toast && <div className="toast" role="status"><Check size={19}/><span>{toast.text}</span>{toast.shelf && <button onClick={() => { go('saved'); setToast(null); }}>Ver no cantinho <ArrowRight size={15}/></button>}<button onClick={() => setToast(null)} aria-label="Fechar confirmação"><X size={16}/></button></div>}
    {needRefresh && <div className="update-banner" role="status"><p>Tem uma versão nova do ateliê. Atualize quando der vontade; a tela vai reabrir.</p><button className="soft-button" onClick={() => { void updateApp(); }} disabled={busy}>Guardar e atualizar</button><button className="text-button" onClick={() => setNeedRefresh(false)}>Depois</button></div>}
    {introduction && <Modal label="Bem-vinda ao seu cantinho" onClose={closeIntroduction} className="intro-modal"><div className="intro-brand"><BrandMark size={52}/><div><h2>À toa, Leh</h2><small>Seu cantinho, sem pressa.</small></div></div>{gift.letter ? <div className="letter-text">{gift.letter}</div> : <><h2>Um lugar para mexer com as cores.</h2><p className="letter-text">Tem tinta, plantinhas, gatos e pequenas invenções. Pode fazer bagunça, guardar pela metade e voltar quando der vontade.</p></>}<div className="game-toolbar"><button className="primary-button" data-autofocus onClick={closeIntroduction}>Entrar no cantinho <ArrowRight size={17}/></button><button className="text-button intro-skip" onClick={closeIntroduction}>Pular</button></div></Modal>}
    {preview && <Modal label={preview.title} className="creation-modal" onClose={() => setPreview(null)}><h2>{preview.title}</h2><img src={preview.dataUrl} alt={preview.title}/><div className="game-toolbar"><button className="primary-button" onClick={() => { const blob = dataBlob(preview.dataUrl); download(blob, `minha-criacao.${blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png'}`); }}><DownloadSimple size={18}/>Exportar imagem</button><button className="soft-button" onClick={() => { void shareCreation(preview); }}>Compartilhar</button></div></Modal>}
    {removeId && <Modal label="Retirar criação" className="small-modal" onClose={() => setRemoveId(null)}><h2>Retirar da prateleira?</h2><p>Esta cópia será retirada do cantinho. O rascunho da atividade continua onde estava.</p><div className="game-toolbar"><button className="soft-button" onClick={() => setRemoveId(null)}>Deixar aqui</button><button className="primary-button" onClick={() => { void removeCreation(); }} disabled={busy}>Retirar</button></div></Modal>}
    {note && <Modal label="Um bilhete para você" className="note-modal" onClose={() => setNote(null)}><Heart className="note-heart" size={33}/><span className="eyebrow">Um pedacinho meu</span><p style={{ whiteSpace: 'pre-wrap' }}>{note}</p><span className="note-signature">Com carinho, Guilherme.</span><button className="soft-button" onClick={() => setNote(gift.notes[Math.floor(Math.random() * gift.notes.length)])}>Outro bilhete</button></Modal>}
    {giftEditing && <Modal label="Escrever as palavras do presente" className="gift-editor" onClose={() => { if (!busy) setGiftEditing(false); }}><h2>Palavras suas</h2><p>Este conteúdo fica só neste aparelho. Faça uma cópia para guardar fora daqui.</p><label className="control-label">Carta<textarea value={letterDraft} onChange={event => updateGiftDraft('letter', event.target.value)} maxLength={16000} rows={7}/></label><label className="control-label">Bilhetes, separados por uma linha em branco<textarea value={notesDraft} onChange={event => updateGiftDraft('notes', event.target.value)} rows={6}/></label>{error && <div className="storage-warning" role="alert">{error}</div>}<button className="primary-button" onClick={() => { void saveGift(); }} disabled={busy}>Guardar as palavras <Check size={18}/></button></Modal>}
  </div>;
}
