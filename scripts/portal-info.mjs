import { spawnSync } from 'node:child_process';
const cli=process.env.MAESTRI_CLI ?? 'C:/Program Files/Maestri/resources/cli/maestri.exe';
for (const expression of ['location.hash', 'document.querySelectorAll("input").length', 'Boolean(document.querySelector("#gift-file"))']) {
  const result=spawnSync(cli,['portal','evaluate','À toa, Leh — ao vivo',expression],{encoding:'utf8',windowsHide:true});
  console.log(expression, result.stdout, result.stderr);
}
