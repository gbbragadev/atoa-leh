import { spawn } from 'node:child_process';
import { access, mkdir, open, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = 'http://127.0.0.1:5188';
const DATABASE = 'atoa-leticia-gallery';
const LOCAL = path.join(ROOT, '.local');
const PROFILE = path.join(LOCAL, 'lehs-browser');
const GIFT = path.join(ROOT, 'personalizacao', 'presente.private.json');
const PHOTOS = path.join(LOCAL, 'referencias');
const PREVIEW_LOG = path.join(LOCAL, 'presente-preview.log');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const exists = async file => { try { await access(file); return true; } catch { return false; } };

function npmProcess(script, options = {}) {
  // Commands are fixed internal values; no file path or personal text is interpolated
  // into a shell command. Windows children do not open extra console windows.
  return process.platform === 'win32'
    ? spawn(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', `npm.cmd run ${script}${script === 'preview' ? ' -- --host 127.0.0.1 --port 5188 --strictPort' : ''}`], { cwd: ROOT, windowsHide: true, ...options })
    : spawn('npm', ['run', script, ...(script === 'preview' ? ['--', '--host', '127.0.0.1', '--port', '5188', '--strictPort'] : [])], { cwd: ROOT, ...options });
}
async function ensureBuild() {
  if (await exists(path.join(ROOT, 'dist', 'index.html'))) return;
  console.log('Preparando a versão do presente…');
  await new Promise((resolve, reject) => {
    const child = npmProcess('build', { stdio: 'inherit' });
    child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error('O build não terminou. Confira a mensagem acima e rode npm run build.')));
  });
}
function htmlTitle(html) { return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1].replace(/\s+/g, ' ').trim(); }
async function probeServer(expectedTitle) {
  try {
    const response = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(1500), cache: 'no-store' });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return 'other';
    const html = await response.text(); return htmlTitle(html) === expectedTitle && html.includes('id="root"') ? 'ours' : 'other';
  } catch { return 'offline'; }
}
async function ensurePreview() {
  const expectedTitle = htmlTitle(await readFile(path.join(ROOT, 'dist', 'index.html'), 'utf8'));
  if (!expectedTitle) throw new Error('O build não contém o título do À toa. Rode npm run build.');
  const status = await probeServer(expectedTitle);
  if (status === 'ours') return;
  if (status === 'other') throw new Error('A porta 5188 está ocupada por outro aplicativo. Libere essa porta e abra o presente novamente.');
  await mkdir(LOCAL, { recursive: true });
  const log = await open(PREVIEW_LOG, 'a'); let child;
  try {
    child = npmProcess('preview', { detached: true, stdio: ['ignore', log.fd, log.fd] });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    child.unref();
  } finally { await log.close(); }
  await writeFile(path.join(LOCAL, 'presente-preview.json'), JSON.stringify({ pid: child.pid, url: BASE_URL, startedAt: new Date().toISOString() }, null, 2), 'utf8');
  const until = Date.now() + 30_000;
  while (Date.now() < until) {
    const current = await probeServer(expectedTitle);
    if (current === 'ours') { console.log('Seu cantinho está aberto na porta 5188.'); return; }
    if (current === 'other') throw new Error('Outro aplicativo respondeu na porta 5188. O presente não foi importado.');
    await delay(250);
  }
  throw new Error('O servidor não abriu. Confira .local/presente-preview.log e rode npm run preview.');
}

async function readSetup(page) {
  return page.evaluate(databaseName => new Promise((resolve, reject) => {
    // Detection is read-only. Never create a new database to guess whether setup ran.
    const request = indexedDB.open(databaseName);
    request.onupgradeneeded = () => { request.transaction?.abort(); reject(new Error('O aplicativo ainda não preparou o armazenamento.')); };
    request.onerror = () => reject(new Error('Não foi possível ler o armazenamento do presente.'));
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('state') || !db.objectStoreNames.contains('creations')) { db.close(); reject(new Error('Abra o aplicativo atualizado antes de preparar o presente.')); return; }
      const tx = db.transaction(['state', 'creations'], 'readonly');
      const gift = tx.objectStore('state').get('gift-content'); let photoCount = 0;
      const photos = tx.objectStore('creations').openCursor();
      photos.onsuccess = () => { const cursor = photos.result; if (!cursor) return; if (cursor.value.kind === 'photo') photoCount++; cursor.continue(); };
      tx.oncomplete = () => {
        const content = gift.result?.value;
        const hasGift = !!content && (content.source === 'personal' || typeof content.letter === 'string' && !!content.letter.trim() || Array.isArray(content.notes) && content.notes.length > 0);
        db.close(); resolve({ hasGift: Boolean(hasGift), photoCount });
      };
      const failed = () => { db.close(); reject(new Error('Não foi possível conferir os arquivos já guardados.')); }; tx.onerror = failed; tx.onabort = failed;
    };
  }), DATABASE);
}
async function waitForSetup(page, predicate, label, timeout = 25_000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) { const state = await readSetup(page); if (predicate(state)) return state; await delay(150); }
  throw new Error(`${label} não terminou. Confira o aviso no aplicativo e importe o arquivo manualmente em Ajustes.`);
}
async function photoFiles() {
  if (!await exists(PHOTOS)) return [];
  const files = (await readdir(PHOTOS, { withFileTypes: true })).filter(file => file.isFile() && /^foto-\d+\.(?:jpe?g|png|webp)$/i.test(file.name)).map(file => path.join(PHOTOS, file.name)).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  for (const file of files) if ((await stat(file)).size > 15 * 1024 * 1024) throw new Error('Uma das fotos ultrapassa 15 MB. Escolha uma versão menor em Ajustes.');
  return files;
}
async function prepareGift(page) {
  await page.goto(`${BASE_URL}/#settings`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForFunction(() => !!document.querySelector('#gift-file') || Array.from(document.querySelectorAll('button')).some(button => /^pular(?:\s+introdução)?$/i.test(button.textContent?.trim() ?? '')), null, { timeout: 25_000 });
  const skip = page.getByRole('button', { name: /^Pular(?:\s+introdução)?$/i });
  if (await skip.isVisible()) { await skip.click(); await page.goto(`${BASE_URL}/#settings`, { waitUntil: 'domcontentloaded' }); }
  await page.locator('#gift-file').waitFor({ state: 'attached', timeout: 20_000 });
  await page.locator('#photos-file').waitFor({ state: 'attached', timeout: 20_000 });
  const existing = await readSetup(page);
  if (existing.hasGift) console.log('A carta e os bilhetes já estão preparados. Mantive os seus textos.');
  else if (await exists(GIFT)) {
    await page.locator('#gift-file').setInputFiles(GIFT);
    await waitForSetup(page, state => state.hasGift, 'A importação da carta'); console.log('A carta do Guilherme ficou guardada neste navegador.');
  } else console.log('O arquivo privado da carta não está aqui. Você pode escolhê-lo depois em Ajustes.');
  const latest = await readSetup(page);
  if (latest.photoCount > 0) console.log('Já existem fotos neste cantinho. Mantive a seleção atual.');
  else {
    const files = await photoFiles();
    if (files.length) {
      if (new URL(page.url()).hash !== '#settings') {
        await page.goto(`${BASE_URL}/#settings`, { waitUntil: 'domcontentloaded' });
        await page.locator('#photos-file').waitFor({ state: 'attached', timeout: 20_000 });
      }
      await page.locator('#photos-file').setInputFiles(files);
      await waitForSetup(page, state => state.photoCount >= files.length, 'A importação das fotos', 45_000); console.log(`${files.length} fotos ficaram guardadas neste navegador.`);
    } else console.log('Nenhuma foto local foi encontrada. Você pode escolhê-las depois em Ajustes.');
  }
  await page.goto(`${BASE_URL}/#love`, { waitUntil: 'domcontentloaded' });
}

async function main() {
  if (!await exists(path.join(ROOT, 'node_modules'))) throw new Error('As dependências ainda não estão instaladas. Rode npm install e abra novamente.');
  let chromium;
  try { ({ chromium } = await import('playwright')); } catch { throw new Error('O Playwright ainda não está disponível. Rode npm install e abra novamente.'); }
  await mkdir(PROFILE, { recursive: true }); await ensureBuild(); await ensurePreview();
  let context;
  try {
    context = await chromium.launchPersistentContext(PROFILE, { headless: false, viewport: null, acceptDownloads: true, args: ['--window-size=1140,850', '--disable-session-crashed-bubble'] });
  } catch (error) {
    const message = String(error);
    if (/ProcessSingleton|SingletonLock|profile.*(?:use|lock)|user data directory.*use/i.test(message)) throw new Error('A janela do presente já está aberta. Use essa janela; o perfil pessoal do Chrome não foi alterado.');
    if (/Executable doesn't exist|browser.*(?:install|not found)/i.test(message)) throw new Error('Instale o navegador do presente com npx playwright install chromium e abra novamente.');
    throw new Error('Não consegui abrir o navegador do presente. Confira a instalação do Playwright.');
  }
  const closed = new Promise(resolve => context.once('close', resolve));
  const page = context.pages().find(tab => tab.url().startsWith(BASE_URL)) ?? context.pages()[0] ?? await context.newPage();
  try { await prepareGift(page); console.log('Pronto para abrir o envelope. Esta janela é só do À toa.'); }
  catch (error) { console.error(error instanceof Error ? error.message : 'A preparação não terminou. Use os controles de Ajustes para importar seus arquivos.'); }
  if (!page.isClosed()) await page.bringToFront().catch(() => {});
  console.log('Feche a janela do aplicativo quando quiser. O servidor local continua rodando.');
  // Do not close the user's visible browser at the end of setup.
  await closed;
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'Não foi possível abrir o presente.'); process.exitCode = 1; });
