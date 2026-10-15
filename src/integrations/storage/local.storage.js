// Adaptador de almacenamiento local: solo para desarrollo (disco del servidor).
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

export function createLocalStorage({ dir, publicPath = '/uploads' }) {
  return {
    name: 'local',

    async upload(buffer, { contentType }) {
      await mkdir(dir, { recursive: true });
      const key = `${randomUUID()}${EXTENSIONS[contentType]}`; // Nombre generado: nunca el del usuario.
      await writeFile(path.join(dir, key), buffer);
      return { url: `${publicPath}/${key}`, key };
    },

    async remove(key) {
      await unlink(path.join(dir, path.basename(key))).catch((err) => {
        if (err.code !== 'ENOENT') throw err;
      });
    },
  };
}
