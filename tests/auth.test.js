// HU-01: registro de usuarios (y sesión).
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { registerUser, setupApp } from './helpers.js';

let ctx;
before(async () => {
  ctx = await setupApp();
});
after(() => ctx.close());

describe('POST /api/auth/register', () => {
  test('registra al usuario, guarda la contraseña con bcrypt y emite un JWT', async () => {
    const res = await ctx.api
      .post('/api/auth/register')
      .send({ name: 'Ana Pérez', email: 'Ana@Correo.com', password: 'Clave123', confirmPassword: 'Clave123', phone: '300 123 4567' })
      .expect(201);

    assert.equal(res.body.user.email, 'ana@correo.com');
    assert.equal(res.body.user.phone, '3001234567');
    assert.equal(res.body.tokenType, 'Bearer');
    assert.match(res.body.token, /^[\w-]+\.[\w-]+\.[\w-]+$/);
    assert.equal(res.body.user.passwordHash, undefined, 'nunca devuelve el hash');
    assert.match(res.headers['set-cookie'][0], /c2c_token=.+HttpOnly; SameSite=Lax/);

    const { rows } = await ctx.pool.query('SELECT password_hash FROM users WHERE email = $1', ['ana@correo.com']);
    assert.match(rows[0].password_hash, /^\$2[aby]\$/, 'hash bcrypt');
    assert.notEqual(rows[0].password_hash, 'Clave123');
  });

  test('rechaza un correo ya registrado sin importar mayúsculas (409)', async () => {
    const res = await ctx.api
      .post('/api/auth/register')
      .send({ name: 'Otra Ana', email: 'ANA@correo.com', password: 'Clave123', phone: '3001112233' })
      .expect(409);
    assert.equal(res.body.error.code, 'EMAIL_TAKEN');
  });

  test('valida formato de correo, fortaleza de contraseña y campos obligatorios (400)', async () => {
    const res = await ctx.api
      .post('/api/auth/register')
      .send({ name: '', email: 'no-es-correo', password: 'corta' })
      .expect(400);
    const fields = res.body.error.details.map((d) => d.field);
    assert.deepEqual([...new Set(fields)].sort(), ['email', 'name', 'password', 'phone']);
  });

  test('rechaza contraseñas que no coinciden (400)', async () => {
    const res = await ctx.api
      .post('/api/auth/register')
      .send({ name: 'Luis', email: 'luis@correo.com', password: 'Clave123', confirmPassword: 'Clave124', phone: '3001234567' })
      .expect(400);
    assert.equal(res.body.error.details[0].field, 'confirmPassword');
  });
});

describe('Sesión', () => {
  test('login correcto, login incorrecto y /me con Bearer o cookie', async () => {
    const { user } = await registerUser(ctx.api, { email: 'sesion@correo.com' });

    const ok = await ctx.api.post('/api/auth/login').send({ email: 'SESION@correo.com', password: 'Segura123' }).expect(200);
    const bad = await ctx.api.post('/api/auth/login').send({ email: 'sesion@correo.com', password: 'Otra1234' }).expect(401);
    assert.equal(bad.body.error.code, 'INVALID_CREDENTIALS');

    const viaBearer = await ctx.api.get('/api/auth/me').set('Authorization', `Bearer ${ok.body.token}`).expect(200);
    assert.equal(viaBearer.body.user.id, user.id);
    const cookie = ok.headers['set-cookie'][0].split(';')[0];
    const viaCookie = await ctx.api.get('/api/auth/me').set('Cookie', cookie).expect(200);
    assert.equal(viaCookie.body.user.id, user.id);
  });

  test('sin token o con token alterado responde 401', async () => {
    await ctx.api.get('/api/auth/me').expect(401);
    const res = await ctx.api.get('/api/auth/me').set('Authorization', 'Bearer abc.def.ghi').expect(401);
    assert.equal(res.body.error.code, 'INVALID_TOKEN');
  });
});
