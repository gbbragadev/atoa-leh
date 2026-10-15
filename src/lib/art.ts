export const PALETTE = ['#52785c', '#97ad83', '#e4c15c', '#d7917c', '#bc7e8f', '#9a8fb2', '#8aa9ba', '#e6d7c2', '#fff9ed', '#48473f'];
export function randomSeed() { return Math.floor(Math.random() * 2147483647); }
export function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
export async function svgToDataUrl(svg: SVGSVGElement): Promise<string> {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const viewBox = svg.viewBox.baseVal;
  const width = viewBox.width || 600, height = viewBox.height || 600;
  copy.setAttribute('width', String(width)); copy.setAttribute('height', String(height));
  const source = new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(source);
  try {
    const image = new Image();
    image.src = url; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = width * 2; canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Seu navegador não abriu o desenho. Tente novamente.');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}
export function downloadDataUrl(dataUrl: string, filename: string) {
  const anchor = document.createElement('a'); anchor.href = dataUrl; anchor.download = filename; anchor.click();
}
