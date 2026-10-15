// Adaptador de pagos real: Mercado Pago Checkout Pro (opera en Colombia con COP, tarjetas y PSE).
import { createHmac, timingSafeEqual } from 'node:crypto';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { UnauthorizedError } from '../../utils/errors.js';

// Para respetar el método elegido en el checkout se excluyen los demás tipos de pago.
const EXCLUDED_TYPES = {
  tarjeta: ['ticket', 'bank_transfer', 'atm'],
  pse: ['credit_card', 'debit_card', 'prepaid_card', 'ticket', 'atm'],
};

const STATUS_MAP = {
  approved: 'approved',
  authorized: 'pending',
  pending: 'pending',
  in_process: 'pending',
  in_mediation: 'pending',
  rejected: 'rejected',
  cancelled: 'rejected',
  refunded: 'rejected',
  charged_back: 'rejected',
};

// Valida la cabecera x-signature: HMAC-SHA256 de "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
export function verifyMercadoPagoSignature({ secret, signatureHeader, requestId, dataId }) {
  if (!signatureHeader || !requestId) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => part.trim().split('=').map((s) => s.trim())),
  );
  if (!parts.ts || !parts.v1) return false;
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${id};request-id:${requestId};ts:${parts.ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  const received = Buffer.from(parts.v1, 'hex');
  return received.length === expected.length / 2 && timingSafeEqual(received, Buffer.from(expected, 'hex'));
}

export function createMercadoPagoGateway({ accessToken, webhookSecret, appUrl }) {
  const client = new MercadoPagoConfig({ accessToken, options: { timeout: 8000 } });

  return {
    name: 'mercadopago',

    async createCheckout({ order, buyer }) {
      const returnUrl = `${appUrl}/confirmacion.html?order=${order.id}`;
      const preference = await new Preference(client).create({
        body: {
          items: [
            {
              id: order.product.id,
              title: order.product.title,
              quantity: 1,
              unit_price: order.amount,
              currency_id: order.currency,
            },
          ],
          payer: { name: buyer.name, email: buyer.email },
          external_reference: order.id,
          back_urls: { success: returnUrl, failure: returnUrl, pending: returnUrl },
          auto_return: 'approved',
          notification_url: `${appUrl}/api/payments/webhook`,
          payment_methods: {
            excluded_payment_types: EXCLUDED_TYPES[order.paymentMethod].map((id) => ({ id })),
            installments: 12,
          },
          expires: true,
          expiration_date_to: new Date(order.expiresAt).toISOString(),
          statement_descriptor: 'C2C MARKET',
        },
        requestOptions: { idempotencyKey: order.id },
      });
      return { reference: preference.id, checkoutUrl: preference.init_point };
    },

    async getPayment(paymentId) {
      const payment = await new Payment(client).get({ id: paymentId });
      return {
        paymentId: String(payment.id),
        orderId: payment.external_reference ?? null,
        status: STATUS_MAP[payment.status] ?? 'pending',
        amount: Number(payment.transaction_amount),
        currency: payment.currency_id,
      };
    },

    parseNotification({ headers, query, body }) {
      const type = query.type ?? query.topic ?? body?.type;
      const dataId = String(query['data.id'] ?? body?.data?.id ?? '');
      if (type !== 'payment' || !dataId) return null;
      if (webhookSecret) {
        const valid = verifyMercadoPagoSignature({
          secret: webhookSecret,
          signatureHeader: headers['x-signature'],
          requestId: headers['x-request-id'],
          dataId,
        });
        if (!valid) throw UnauthorizedError('INVALID_SIGNATURE', 'Firma de webhook inválida.');
      }
      return dataId;
    },
  };
}
