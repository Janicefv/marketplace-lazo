// Utilidades de prueba: app real contra una base PostgreSQL de pruebas.
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { config as baseConfig } from '../src/config/env.js';
import { createContainer } from '../src/container.js';

export const TEST_DB = process.env.TEST_DATABASE_URL ?? 'postgres://postgres@localhost:5432/c2c_test';

// PNG de 1x1 píxel válido.
export const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

export async function setupApp() {
  const uploadsDir = await mkdtemp(path.join(os.tmpdir(), 'c2c-uploads-'));
  const config = {
    ...baseConfig,
    databaseUrl: TEST_DB,
    bcryptRounds: 4,
    authRateLimit: 10_000,
    storage: { cloudinaryUrl: null, localDir: uploadsDir },
    payments: { provider: 'simulated' },
  };
  const container = createContainer({ config });
  const app = createApp(container);
  await container.pool.query('TRUNCATE orders, product_images, products, users RESTART IDENTITY CASCADE');
  const server = app.listen(0);
  const close = async () => {
    server.close();
    await container.pool.end();
  };
  return { app, pool: container.pool, api: request(server), close };
}

let counter = 0;
export async function registerUser(api, overrides = {}) {
  counter += 1;
  const body = {
    name: 'Usuario Prueba',
    email: `usuario${counter}_${Date.now()}@correo.com`,
    password: 'Segura123',
    confirmPassword: 'Segura123',
    phone: '3001234567',
    ...overrides,
  };
  const res = await api.post('/api/auth/register').send(body).expect(201);
  return { ...res.body, auth: { Authorization: `Bearer ${res.body.token}` } };
}

export function publishProduct(api, auth, overrides = {}) {
  const fields = {
    title: 'Bicicleta de ruta talla M',
    description: 'Bicicleta de ruta en aluminio, cambios Shimano, muy bien cuidada.',
    price: '1500000',
    categoryId: '4',
    ...overrides,
  };
  let req = api.post('/api/products').set(auth);
  for (const [key, value] of Object.entries(fields)) req = req.field(key, value);
  return req.attach('images', PNG_1PX, { filename: 'foto.png', contentType: 'image/png' });
}

export const shipping = {
  fullName: 'Carlos Gómez',
  phone: '3109876543',
  address: 'Calle 45 # 12-30, apto 502',
  city: 'Bogotá',
  department: 'Cundinamarca',
};
