// Servidor local (desarrollo y Docker). En Vercel no se usa: allí src/app.js se exporta como función.
import app from '../src/app.js';
import { config } from '../src/config/env.js';

app.listen(config.port, () => {
  console.log(`[api] Marketplace C2C escuchando en http://localhost:${config.port}`);
  console.log(`[api] Pagos: ${config.payments.provider} · Imágenes: ${config.storage.cloudinaryUrl ? 'cloudinary' : 'disco local'}`);
});
