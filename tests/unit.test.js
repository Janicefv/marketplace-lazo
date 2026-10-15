// Pruebas unitarias de piezas puras: búsqueda, firma de imágenes y firma de webhooks.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { verifyMercadoPagoSignature } from '../src/integrations/payments/mercadopago.gateway.js';
import { detectImageType } from '../src/middlewares/upload.js';
import { toPrefixTsQuery } from '../src/services/product.service.js';
import { PNG_1PX } from './helpers.js';

test('toPrefixTsQuery normaliza tildes, quita símbolos y usa prefijos', () => {
  assert.equal(toPrefixTsQuery('  Bicí  ROJA!! '), 'bici:* & roja:*');
  assert.equal(toPrefixTsQuery("café'); DROP TABLE users;--"), 'cafe:* & drop:* & table:* & users:*');
  assert.equal(toPrefixTsQuery('***'), null);
});

test('detectImageType reconoce JPEG, PNG y WEBP por sus bytes', () => {
  assert.equal(detectImageType(PNG_1PX), 'image/png');
  assert.equal(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(detectImageType(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1')), 'image/webp');
  assert.equal(detectImageType(Buffer.from('<svg onload=alert(1)>')), null);
});

test('verifyMercadoPagoSignature acepta la firma correcta y rechaza la alterada', () => {
  const secret = 'secreto-webhook';
  const manifest = 'id:123456;request-id:req-1;ts:1700000000;';
  const v1 = createHmac('sha256', secret).update(manifest).digest('hex');
  const base = { secret, requestId: 'req-1', dataId: '123456' };
  assert.equal(verifyMercadoPagoSignature({ ...base, signatureHeader: `ts=1700000000,v1=${v1}` }), true);
  assert.equal(verifyMercadoPagoSignature({ ...base, signatureHeader: `ts=1700000001,v1=${v1}` }), false);
  assert.equal(verifyMercadoPagoSignature({ ...base, signatureHeader: undefined }), false);
});
