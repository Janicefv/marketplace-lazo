// HU-02: publicación de productos · HU-03: búsqueda y filtrado.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { PNG_1PX, publishProduct, registerUser, setupApp } from './helpers.js';

let ctx;
let seller;
before(async () => {
  ctx = await setupApp();
  seller = await registerUser(ctx.api);
});
after(() => ctx.close());

describe('POST /api/products (HU-02)', () => {
  test('sin token responde 401 y no procesa imágenes', async () => {
    const res = await ctx.api.post('/api/products').attach('images', PNG_1PX, 'foto.png').expect(401);
    assert.equal(res.body.error.code, 'AUTH_REQUIRED');
  });

  test('publica con imágenes, devuelve sus URLs y lo vincula al vendedor (201)', async () => {
    const res = await publishProduct(ctx.api, seller.auth).expect(201);
    const product = res.body.data;
    assert.equal(product.seller.id, seller.user.id);
    assert.equal(product.status, 'disponible');
    assert.equal(product.price, 1500000);
    assert.equal(product.images.length, 1);
    assert.match(product.images[0].url, /^\/uploads\/[0-9a-f-]{36}\.png$/);
    assert.equal(res.headers.location, `/api/products/${product.id}`);

    const image = await ctx.api.get(product.images[0].url).expect(200);
    assert.equal(image.headers['content-type'], 'image/png');
  });

  test('rechaza un archivo que dice ser PNG pero no lo es (400)', async () => {
    const res = await ctx.api
      .post('/api/products')
      .set(seller.auth)
      .field('title', 'Producto falso')
      .field('description', 'Descripción suficientemente larga para pasar.')
      .field('price', '1000')
      .field('categoryId', '1')
      .attach('images', Buffer.from('<script>alert(1)</script>'), { filename: 'x.png', contentType: 'image/png' })
      .expect(400);
    assert.equal(res.body.error.code, 'INVALID_IMAGE');
  });

  test('exige campos obligatorios, al menos una imagen y una categoría existente', async () => {
    const noImage = await ctx.api.post('/api/products').set(seller.auth).field('title', 'Algo').expect(400);
    assert.equal(noImage.body.error.details[0].field, 'images');

    const badFields = await publishProduct(ctx.api, seller.auth, { title: 'abc', price: '-5' }).expect(400);
    assert.deepEqual(badFields.body.error.details.map((d) => d.field).sort(), ['price', 'title']);

    const badCategory = await publishProduct(ctx.api, seller.auth, { categoryId: '999' }).expect(422);
    assert.equal(badCategory.body.error.code, 'UNKNOWN_CATEGORY');
  });
});

describe('GET /api/products (HU-03)', () => {
  before(async () => {
    await ctx.pool.query('TRUNCATE orders, product_images, products CASCADE');
    const items = [
      { title: 'Café de origen Huila 500 g', description: 'Café especial tostado medio, notas a panela y cítricos.', price: '38000', categoryId: '8' },
      { title: 'Portátil Lenovo ThinkPad T14', description: 'Portátil con 16 GB de RAM, SSD de 512 GB y batería nueva.', price: '2300000', categoryId: '1' },
      { title: 'Bicicleta de montaña rin 29', description: 'Bicicleta todoterreno con suspensión delantera y frenos de disco.', price: '1800000', categoryId: '4' },
      { title: 'Bicicleta infantil rin 16', description: 'Bicicleta para niños de 4 a 6 años con ruedas de apoyo.', price: '250000', categoryId: '4' },
    ];
    for (const item of items) await publishProduct(ctx.api, seller.auth, item).expect(201);
  });

  test('busca por palabra clave con coincidencia parcial y sin tildes', async () => {
    const byPrefix = await ctx.api.get('/api/products?search=bici').expect(200);
    assert.equal(byPrefix.body.pagination.total, 2);
    const noAccent = await ctx.api.get('/api/products?search=cafe').expect(200);
    assert.equal(noAccent.body.data[0].title, 'Café de origen Huila 500 g');
  });

  test('filtra por categoría y rango de precio', async () => {
    const res = await ctx.api.get('/api/products?category=deportes&minPrice=1000000&maxPrice=2000000').expect(200);
    assert.deepEqual(res.body.data.map((p) => p.title), ['Bicicleta de montaña rin 29']);
  });

  test('pagina y ordena por precio', async () => {
    const res = await ctx.api.get('/api/products?sort=precio_asc&page=2&limit=3').expect(200);
    assert.deepEqual(res.body.pagination, { page: 2, limit: 3, total: 4, totalPages: 2 });
    assert.equal(res.body.data[0].title, 'Portátil Lenovo ThinkPad T14');
  });

  test('valida los parámetros de consulta (400)', async () => {
    await ctx.api.get('/api/products?minPrice=500&maxPrice=100').expect(400);
    await ctx.api.get('/api/products?limit=1000').expect(400);
  });

  test('las consultas usan los índices (plan de ejecución)', async () => {
    await ctx.pool.query('SET enable_seqscan = off');
    const { rows } = await ctx.pool.query(
      `EXPLAIN SELECT id FROM products p WHERE p.search_vector @@ to_tsquery('spanish', 'bici:*')`,
    );
    await ctx.pool.query('SET enable_seqscan = on');
    assert.match(rows.map((r) => r['QUERY PLAN']).join('\n'), /products_search_idx/);
  });

  test('GET /api/products/:id devuelve el detalle o 404', async () => {
    const list = await ctx.api.get('/api/products?search=portatil').expect(200);
    const detail = await ctx.api.get(`/api/products/${list.body.data[0].id}`).expect(200);
    assert.equal(detail.body.data.seller.name, seller.user.name);
    assert.equal(detail.body.data.seller.email, undefined, 'no expone datos privados del vendedor');
    await ctx.api.get('/api/products/00000000-0000-4000-8000-000000000000').expect(404);
    await ctx.api.get('/api/products/no-es-uuid').expect(400);
  });
});
