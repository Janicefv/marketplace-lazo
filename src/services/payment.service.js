// Capa de negocio: aplica el resultado de un pago a la orden y al producto (HU-04).
// Regla de oro: el estado del pago siempre se confirma con la pasarela, nunca con el navegador.
import { withTransaction } from '../db/pool.js';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors.js';

export function createPaymentService({ pool, orderRepository, productRepository, paymentGateway }) {
  // Idempotente: aplicar dos veces el mismo resultado deja la orden igual.
  async function applyResult(orderId, payment) {
    await withTransaction(pool, async (tx) => {
      const order = await orderRepository.findForPayment(orderId, tx);
      if (!order) throw NotFoundError('ORDER_NOT_FOUND', 'La orden no existe.');
      if (order.status === 'pagada' || payment.status === 'pending') return;

      if (payment.status === 'approved') {
        if (payment.amount !== order.amount || payment.currency !== order.currency) {
          console.error(`[payments] Monto no coincide en la orden ${order.id}`, payment);
          throw ConflictError('AMOUNT_MISMATCH', 'El monto pagado no coincide con el de la orden.');
        }
        // Un pago puede llegar tarde (orden vencida o reintento): solo vende si nadie más lo tomó.
        const product = await productRepository.findForPurchase(order.productId, tx);
        const takenByOther =
          product.status === 'vendido' ||
          (await orderRepository.hasOtherActivePending(order.productId, order.id, tx));
        if (takenByOther) {
          console.warn(`[payments] Pago ${payment.paymentId} aprobado sin producto: requiere reembolso`);
          await orderRepository.markRejected(order.id, payment.paymentId, { refundRequired: true }, tx);
          return;
        }
        await productRepository.markSold(order.productId, tx); // "Vendido": evita compras duplicadas.
        await orderRepository.markPaid(order.id, payment.paymentId, tx);
        return;
      }

      // Rechazado o cancelado: la orden se cierra y el producto vuelve al catálogo.
      if (order.status === 'pendiente' || order.status === 'expirada') {
        await orderRepository.markRejected(order.id, payment.paymentId, {}, tx);
        if (!(await orderRepository.hasOtherActivePending(order.productId, order.id, tx))) {
          await productRepository.release(order.productId, tx);
        }
      }
    });
    return orderRepository.findById(orderId);
  }

  async function findOwnOrder(orderId, buyerId) {
    const order = await orderRepository.findById(orderId);
    if (!order || order.buyer.id !== buyerId) throw NotFoundError('ORDER_NOT_FOUND', 'La orden no existe.');
    return order;
  }

  return {
    applyResult,

    // Pasarela simulada (sandbox): cobra y aplica el resultado en una sola llamada.
    async chargeSimulated(buyerId, { orderId, card, outcome }) {
      const order = await findOwnOrder(orderId, buyerId);
      if (order.status === 'expirada') {
        throw ConflictError('ORDER_EXPIRED', 'El tiempo para pagar esta orden terminó. Vuelve a comprar el producto.');
      }
      if (order.status !== 'pendiente') {
        throw ConflictError('ORDER_NOT_PENDING', 'Esta orden ya no admite pagos.');
      }
      const payment = paymentGateway.charge({ order, card, outcome });
      const updated = await applyResult(order.id, payment);
      return { order: updated, payment: { id: payment.paymentId, status: payment.status, reason: payment.reason } };
    },

    // Retorno desde la pasarela real: se verifica el pago directamente con su API.
    async confirm(buyerId, { orderId, paymentId }) {
      const order = await findOwnOrder(orderId, buyerId);
      if (!paymentId) return order; // La pasarela aún no reporta pago: se muestra el estado actual.
      const payment = await paymentGateway.getPayment(paymentId);
      if (payment.orderId !== order.id) {
        throw BadRequestError('PAYMENT_MISMATCH', 'El pago no corresponde a esta orden.');
      }
      return applyResult(order.id, payment);
    },

    // Webhook: la pasarela avisa; el servicio consulta el pago y lo aplica.
    async handleNotification(notification) {
      const paymentId = paymentGateway.parseNotification(notification);
      if (!paymentId) return { processed: false };
      const payment = await paymentGateway.getPayment(paymentId);
      if (!payment.orderId) return { processed: false };
      await applyResult(payment.orderId, payment);
      return { processed: true };
    },
  };
}
