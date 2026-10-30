// Ridimensiona e comprime una foto nel browser (lato lungo max 720px).
// Resta piccola (di solito 40–120 KB) e può stare nel profilo su Firestore.
export async function compressImage(file: File, maxSize = 720, quality = 0.8): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Non riesco a leggere questa immagine. Prova con un JPG o PNG.'));
      i.src = url;
    });
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Il browser non riesce a elaborare la foto.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const webp = canvas.toDataURL('image/webp', quality);
    const out = webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality);
    if (out.length > 700_000) throw new Error('La foto è troppo pesante anche dopo la compressione. Usane una più piccola.');
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}
