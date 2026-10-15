export async function compressPhoto(file: File): Promise<string> {
  if (file.size > 15 * 1024 * 1024) throw new Error(`${file.name}: escolha uma foto com até 15 MB.`);
  const extension = file.name.split('.').pop()?.toLowerCase();
  const supported = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type.toLowerCase()) || (!file.type && ['jpg', 'jpeg', 'png', 'webp'].includes(extension ?? ''));
  if (!supported) {
    if (['heic', 'heif'].includes(extension ?? '') || /hei[cf]/i.test(file.type)) {
      throw new Error('Essa foto está em HEIC. Exporte uma cópia em JPEG, PNG ou WebP e escolha a cópia para guardar no mural.');
    }
    throw new Error(`${file.name}: escolha uma imagem JPEG, PNG ou WebP.`);
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url;
    try { await image.decode(); } catch { throw new Error(`Não consegui abrir ${file.name}. Tente uma cópia em JPEG ou PNG.`); }
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Essa foto não tem um tamanho de imagem válido.');
    const ratio = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não consegui preparar a foto. Tente novamente.');
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', .88);
  } finally { URL.revokeObjectURL(url); }
}
