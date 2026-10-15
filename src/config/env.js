// Configuración centralizada: la única capa que lee process.env.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const env = process.env;
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const isVercel = Boolean(env.VERCEL);
const isProduction = env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production';
const port = Number(env.PORT ?? 3000);

// URL pública del sitio: la usan las pasarelas para redirigir y notificar.
function resolveAppUrl() {
  if (env.APP_URL) return env.APP_URL.replace(/\/+$/, '');
  if (env.VERCEL_ENV === 'production' && env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return `http://localhost:${port}`;
}

const DEV_JWT_SECRET = 'solo-para-desarrollo-local-cambia-esto-en-produccion';

export const config = Object.freeze({
  env: env.NODE_ENV ?? 'development',
  isProduction,
  isVercel,
  port,
  rootDir: ROOT_DIR,
  publicDir: path.join(ROOT_DIR, 'public'),
  appUrl: resolveAppUrl(),
  databaseUrl: env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/c2c',
  jwt: Object.freeze({
    secret: env.JWT_SECRET ?? DEV_JWT_SECRET,
    ttlSeconds: Number(env.JWT_TTL_SECONDS ?? 7200),
    issuer: 'c2c-marketplace',
    cookieName: 'c2c_token',
  }),
  bcryptRounds: Number(env.BCRYPT_ROUNDS ?? 12),
  authRateLimit: Number(env.AUTH_RATE_LIMIT ?? 20),
  reservationMinutes: Number(env.RESERVATION_MINUTES ?? 15),
  storage: Object.freeze({
    cloudinaryUrl: env.CLOUDINARY_URL ?? null,
    localDir: path.resolve(ROOT_DIR, env.UPLOADS_DIR ?? 'uploads'),
  }),
  payments: Object.freeze({
    provider: env.PAYMENT_PROVIDER ?? 'simulated',
    mercadoPagoAccessToken: env.MP_ACCESS_TOKEN ?? null,
    mercadoPagoWebhookSecret: env.MP_WEBHOOK_SECRET ?? null,
  }),
});

// Falla rápido si producción arranca con una configuración insegura o incompleta.
export function assertProductionConfig(cfg = config) {
  if (!cfg.isProduction) return;
  const problems = [];
  if (!env.DATABASE_URL) problems.push('DATABASE_URL es obligatoria');
  if (cfg.jwt.secret === DEV_JWT_SECRET || cfg.jwt.secret.length < 32) {
    problems.push('JWT_SECRET debe tener al menos 32 caracteres aleatorios');
  }
  if (cfg.payments.provider === 'mercadopago' && !cfg.payments.mercadoPagoAccessToken) {
    problems.push('MP_ACCESS_TOKEN es obligatoria con PAYMENT_PROVIDER=mercadopago');
  }
  if (problems.length) {
    throw new Error(`Configuración de producción inválida: ${problems.join('; ')}`);
  }
}
