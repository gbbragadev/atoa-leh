import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const browser = await chromium.launch();
const page = await browser.newPage();
const svg = await fs.readFile('public/icon.svg', 'utf8');
await fs.mkdir('public/icons', { recursive: true });
for (const size of [192, 512, 180]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent('<style>body{margin:0}svg{width:100vw;height:100vh;display:block}</style>' + svg);
  await page.screenshot({ path: `public/icons/${size === 180 ? 'apple-touch-icon' : `icon-${size}`}.png` });
}
await page.setViewportSize({ width: 512, height: 512 });
await page.screenshot({ path: 'public/icons/maskable-512.png' });
await browser.close();
console.log('Ícones originais renderizados.');
