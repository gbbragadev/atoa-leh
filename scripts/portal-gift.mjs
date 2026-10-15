import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

// The real letter is read locally and imported through the app's own file input.
// It is never copied into public assets or the production build.
const portal = 'À toa, Leh — ao vivo';
const cli = process.env.MAESTRI_CLI ?? 'C:/Program Files/Maestri/resources/cli/maestri.exe';
function run(...args) {
  const result = spawnSync(cli, args, { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0 || /^error:/im.test(result.stdout ?? '')) throw new Error(result.stderr || result.stdout || 'O portal não respondeu.');
  return result.stdout;
}
run('portal', 'navigate', portal, 'http://localhost:5189/#settings');
const content = await readFile('personalizacao/presente.private.json', 'utf8');
const script = `(() => {const input=document.querySelector('#gift-file');if(!input)return 'aguarde';const transfer=new DataTransfer();transfer.items.add(new File([${JSON.stringify(content)}],'presente.private.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));return 'importado pelo controle local';})()`;
let response;
for (let attempt = 0; attempt < 20; attempt++) {
  response = run('portal', 'evaluate', portal, script);
  if (!response.includes('aguarde')) break;
  await new Promise(resolve => setTimeout(resolve, 200));
}
console.log(response.trim());
await new Promise(resolve => setTimeout(resolve, 700));
run('portal', 'navigate', portal, 'http://localhost:5189/#home');
