// Limita intentos de registro e inicio de sesión por IP (contra fuerza bruta).
// Es una segunda barrera: la primera está en el proxy inverso (Nginx limit_req / Vercel Firewall).
import { rateLimit } from 'express-rate-limit';

export function createAuthRateLimit(config) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.authRateLimit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({
        error: { code: 'TOO_MANY_REQUESTS', message: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
      }),
  });
}
