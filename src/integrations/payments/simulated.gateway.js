// Adaptador de pagos "sandbox": imita una pasarela real para desarrollo y demostraciones.
// No guarda ningún dato de tarjeta; solo decide aprobado/rechazado con tarjetas de prueba.
import { randomUUID } from 'node:crypto';
import { BadRequestError } from '../../utils/errors.js';

// Tarjetas de prueba que se rechazan (las demás válidas por Luhn se aprueban).
const DECLINED_CARDS = new Map([
  ['4000000000000002', 'Tarjeta rechazada por el banco emisor.'],
  ['4000000000009995', 'Fondos insuficientes.'],
]);

function passesLuhn(number) {
  let sum = 0;
  for (let i = 0; i < number.length; i += 1) {
    let digit = Number(number[number.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

function validateCard(card) {
  const number = String(card?.number ?? '').replace(/\D/g, '');
  if (number.length < 13 || number.length > 19 || !passesLuhn(number)) {
    throw BadRequestError('INVALID_CARD', 'El número de tarjeta no es válido.');
  }
  const now = new Date();
  const expired =
    card.expYear < now.getFullYear() ||
    (card.expYear === now.getFullYear() && card.expMonth < now.getMonth() + 1);
  if (expired) throw BadRequestError('CARD_EXPIRED', 'La tarjeta está vencida.');
  return number;
}

export function createSimulatedGateway() {
  return {
    name: 'simulated',

    async createCheckout({ order }) {
      return {
        reference: `sim_pref_${order.id}`,
        checkoutUrl: `/pago-simulado.html?order=${order.id}`,
      };
    },

    charge({ order, card, outcome }) {
      let status = 'approved';
      let reason;
      if (order.paymentMethod === 'tarjeta') {
        const number = validateCard(card);
        if (DECLINED_CARDS.has(number)) {
          status = 'rejected';
          reason = DECLINED_CARDS.get(number);
        }
      } else if (outcome === 'rechazado') {
        status = 'rejected';
        reason = 'El banco no autorizó la transacción PSE.';
      }
      return {
        paymentId: `sim_pay_${randomUUID()}`,
        orderId: order.id,
        status,
        reason,
        amount: order.amount,
        currency: order.currency,
      };
    },

    async getPayment() {
      throw BadRequestError('NOT_SUPPORTED', 'La pasarela simulada confirma los pagos al cobrar.');
    },

    parseNotification() {
      return null; // La pasarela simulada no envía webhooks.
    },
  };
}
