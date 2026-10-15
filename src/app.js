// Aplicación Express. En Vercel este archivo es el punto de entrada (exportación por defecto):
// la API completa se convierte en una Vercel Function y /public se sirve desde la CDN.
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { assertProductionConfig } from './config/env.js';
import { createContainer } from './container.js';
import { errorHandler } from './middlewares/error-handler.js';
import { createApiRouter } from './routes/index.js';

export function createApp(container = createContainer()) {
  const { config } = container;
  assertProductionConfig(config);

  const app = express();
  app.disable('x-powered-by');
  // Detrás del proxy inverso (Vercel Edge o Nginx): confía en X-Forwarded-For / -Proto de un salto.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
        },
      },
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api', createApiRouter(container));

  // Solo en local sin Nginx: Express sirve el frontend y las imágenes subidas a disco.
  // En Vercel express.static se ignora y /public lo entrega la CDN.
  app.use('/uploads', express.static(config.storage.localDir, { maxAge: '7d', immutable: true }));
  app.use(express.static(config.publicDir));

  app.use(errorHandler);
  return app;
}

export default createApp();
