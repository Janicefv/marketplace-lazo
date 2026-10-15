// HU-04: proceso de compra con pasarela de pago (simulada).
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { publishProduct, registerUser, setupApp, shipping } from './helpers.js';

const APPROVED_CARD = { number: '4242 4242 4242 4242', holder: 'Carlos Gómez', expMonth: 12, expYear: 2030, cvc: '123' };
const DECLINED_CARD = { ...APPROVED_CARD, number: '4000 0000 0000 0002' };

let ctx;
let seller;
let buyer;
let product;

before(async () => {
  ctx = await setupApp();
  seller = await registerUser(ctx.api);
  buyer = await registerUser(ctx.api);
});
after(() => ctx.close());
beforeEach(async () => {
  product = (await publishProduct(ctx.api, seller.auth).expect(201)).body.data;
});

const buy = (auth, productId = product.id, paymentMethod = 'tarjeta') =>
  ctx.api.post('/api/orders').set(auth).send({ productId, paymentMethod, shippingAddress: shipping });

const productStatus = async (id = product.id) => (await ctx.api.get(`/api/products/${id}`)).body.data.status;

describe('POST /api/orders', () => {
  test('el vendedor no puede comprar su propio producto (403)', async () => {
    const res = await buy(seller.auth).expect(403);
    assert.equal(res.body.error.code, 'SELF_PURCHASE');
  });

  test('crea la orden, reserva el producto y devuelve la URL del checkout (201)', async () => {
    const res = await buy(buyer.auth).expect(201);
    assert.equal(res.body.data.status, 'pendiente');
    assert.equal(res.body.data.amount, product.price);
    assert.equal(res.body.checkoutUrl, `/pago-simulado.html?order=${res.body.data.id}`);
    assert.equal(await productStatus(), 'reservado');

    const search = await ctx.api.get('/api/products').expect(200);
    assert.ok(!search.body.data.some((p) => p.id === product.id), 'un producto reservado sale del catálogo');
  });

  test('un segundo comprador recibe 409 mientras el primero paga', async () => {
    const other = await registerUser(ctx.api);
    await buy(buyer.auth).expect(201);
    const res = await buy(other.auth).expect(409);
    assert.equal(res.body.error.code, 'PRODUCT_RESERVED');
  });

  test('con 8 compras simultáneas solo una gana la reserva', async () => {
    const buyers = await Promise.all(Array.from({ length: 8 }, () => registerUser(ctx.api)));
    const results = await Promise.all(buyers.map((b) => buy(b.auth)));
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [201, 409, 409, 409, 409, 409, 409, 409]);
  });

  test('requiere sesión y datos de entrega completos', async () => {
    await ctx.api.post('/api/orders').send({ productId: product.id }).expect(401);
    const res = await ctx.api
      .post('/api/orders')
      .set(buyer.auth)
      .send({ productId: product.id, paymentMethod: 'efectivo', shippingAddress: { city: 'Cali' } })
      .expect(400);
    const fields = res.body.error.details.map((d) => d.field);
    assert.ok(fields.includes('paymentMethod') && fields.includes('shippingAddress.address'));
  });
});

describe('Pago y estado "Vendido"', () => {
  test('pago aprobado: orden pagada, producto vendido y no se puede volver a comprar', async () => {
    const order = (await buy(buyer.auth).expect(201)).body.data;
    const res = await ctx.api
      .post('/api/payments/simulated/charge')
      .set(buyer.auth)
      .send({ orderId: order.id, card: APPROVED_CARD })
      .expect(200);
    assert.equal(res.body.payment.status, 'approved');
    assert.equal(res.body.data.status, 'pagada');
    assert.equal(await productStatus(), 'vendido');

    const again = await buy((await registerUser(ctx.api)).auth).expect(409);
    assert.equal(again.body.error.code, 'PRODUCT_SOLD');

    // Idempotencia: un segundo cobro sobre la orden pagada no la altera.
    await ctx.api.post('/api/payments/simulated/charge').set(buyer.auth).send({ orderId: order.id, card: APPROVED_CARD }).expect(409);
  });

  test('pago rechazado: la orden queda rechazada y el producto vuelve a estar disponible', async () => {
    const order = (await buy(buyer.auth).expect(201)).body.data;
    const res = await ctx.api
      .post('/api/payments/simulated/charge')
      .set(buyer.auth)
      .send({ orderId: order.id, card: DECLINED_CARD })
      .expect(200);
    assert.equal(res.body.payment.status, 'rejected');
    assert.equal(res.body.data.status, 'rechazada');
    assert.equal(await productStatus(), 'disponible');
  });

  test('PSE aprobado también marca el producto como vendido', async () => {
    const order = (await buy(buyer.auth, product.id, 'pse').expect(201)).body.data;
    await ctx.api.post('/api/payments/simulated/charge').set(buyer.auth).send({ orderId: order.id, outcome: 'aprobado' }).expect(200);
    assert.equal(await productStatus(), 'vendido');
  });

  test('tarjeta inválida (Luhn) responde 400 sin tocar la orden', async () => {
    const order = (await buy(buyer.auth).expect(201)).body.data;
    const res = await ctx.api
      .post('/api/payments/simulated/charge')
      .set(buyer.auth)
      .send({ orderId: order.id, card: { ...APPROVED_CARD, number: '1234 5678 9012 3456' } })
      .expect(400);
    assert.equal(res.body.error.code, 'INVALID_CARD');
    assert.equal(await productStatus(), 'reservado');
  });

  test('una reserva vencida libera el producto para otro comprador', async () => {
    const order = (await buy(buyer.auth).expect(201)).body.data;
    await ctx.pool.query(`UPDATE products SET reserved_until = now() - interval '1 minute' WHERE id = $1`, [product.id]);
    await ctx.pool.query(`UPDATE orders SET expires_at = now() - interval '1 minute' WHERE id = $1`, [order.id]);
    assert.equal(await productStatus(), 'disponible');

    const late = await ctx.api.post('/api/payments/simulated/charge').set(buyer.auth).send({ orderId: order.id, card: APPROVED_CARD }).expect(409);
    assert.equal(late.body.error.code, 'ORDER_EXPIRED');
    await buy((await registerUser(ctx.api)).auth).expect(201);
  });
});

describe('GET /api/orders/:id (recibo)', () => {
  test('lo ven comprador y vendedor; un tercero recibe 404', async () => {
    const order = (await buy(buyer.auth).expect(201)).body.data;
    const asBuyer = await ctx.api.get(`/api/orders/${order.id}`).set(buyer.auth).expect(200);
    assert.equal(asBuyer.body.data.viewerRole, 'comprador');
    assert.equal(asBuyer.body.data.shippingAddress.city, 'Bogotá');
    const asSeller = await ctx.api.get(`/api/orders/${order.id}`).set(seller.auth).expect(200);
    assert.equal(asSeller.body.data.viewerRole, 'vendedor');
    await ctx.api.get(`/api/orders/${order.id}`).set((await registerUser(ctx.api)).auth).expect(404);
  });
});
