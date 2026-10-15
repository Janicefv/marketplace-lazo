// Comprime fotos en el navegador antes de subirlas: lado máximo de 1600 px y menos de ~900 KB.
// Así la publicación cabe en el límite de 4,5 MB por petición de Vercel y carga rápido en móviles.
const MAX_SIDE = 1600;
const TARGET_BYTES = 900 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const toBlob = (canvas, quality) => new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));

export async function compressImage(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= TARGET_BYTES) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff'; // Fondo blanco para PNG con transparencia.
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let blob;
  for (const quality of [0.82, 0.72, 0.6]) {
    blob = await toBlob(canvas, quality);
    if (blob.size <= TARGET_BYTES) break;
  }
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
}
