// Puerto de almacenamiento de imágenes. Contrato: { name, upload(buffer, opts) -> {url, key}, remove(key) }
import { ServiceUnavailableError } from '../../utils/errors.js';
import { createCloudinaryStorage } from './cloudinary.storage.js';
import { createLocalStorage } from './local.storage.js';

export function createStorage(config) {
  if (config.storage.cloudinaryUrl) return createCloudinaryStorage({ url: config.storage.cloudinaryUrl });

  // En Vercel el disco es efímero: sin Cloudinary no se pueden guardar imágenes de forma segura.
  if (config.isVercel) {
    const unavailable = () => {
      throw ServiceUnavailableError(
        'STORAGE_NOT_CONFIGURED',
        'El almacenamiento de imágenes no está configurado (falta CLOUDINARY_URL).',
      );
    };
    return { name: 'no-configurado', upload: unavailable, remove: async () => {} };
  }

  return createLocalStorage({ dir: config.storage.localDir });
}
