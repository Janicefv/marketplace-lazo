// Capa de negocio: creación y consulta de órdenes de compra (HU-04).
import { withTransaction } from '../db/pool.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
} from '../utils/errors.js';

export function createOrderService({ pool, orderRepository, productRepository, userRepository, paymentGateway, config }) {
  return {
    async create(buyerId, { productId, paymentMethod, shippingAddress }) {
      // 1) Reserva atómica: la fila del producto queda bloqueada hasta el COMMIT,
      //    así dos compradores simultáneos nunca reservan el mismo producto.
      const orderId = await withTransaction(pool, async (tx) => {
        const product = await productRepository.findForPurchase(productId, tx);
        if (!product) throw NotFoundError('PRODUCT_NOT_FOUND', 'El producto no existe.');
        if (product.sellerId === buyerId) {
          throw ForbiddenError('SELF_PURCHASE', 'No puedes comprar un producto que tú mismo publicaste.');
        }
        if (product.status === 'vendido') {
          throw ConflictError('PRODUCT_SOLD', 'Este producto ya fue vendido.');
        }
        if (product.reservationActive) {
          throw ConflictError(
            'PRODUCT_RESERVED',
            'Otro comprador está pagando este producto. Intenta de nuevo en unos minutos.',
          );
        }

        await orderRepository.expirePendingForProduct(product.id, tx);
        await productRepository.reserve(product.id, config.reservationMinutes, tx);
        return orderRepository.create(
          {
            productId: product.id,
            buyerId,
            sellerId: product.sellerId,
            amount: product.price,
            paymentMethod,
            paymentProvider: paymentGateway.name,
            shippingAddress,
            reservationMinutes: config.reservationMinutes,
          },
          tx,
        );
      });

      // 2) La llamada a la pasarela va fuera de la transacción (es una red externa).
      const order = await orderRepository.findById(orderId);
      try {
        const buyer = await userRepository.findById(buyerId);
        const checkout = await paymentGateway.createCheckout({ order, buyer });
        await orderRepository.attachCheckout(order.id, checkout.reference);
        return { order: { ...order, checkoutRef: checkout.reference }, checkoutUrl: checkout.checkoutUrl };
      } catch (err) {
        // Compensación: si no se pudo iniciar el pago, se cancela la orden y se libera el producto.
        console.error('[orders] No se pudo crear el checkout:', err.message);
        await withTransaction(pool, async (tx) => {
          await orderRepository.markCancelled(order.id, tx);
          await productRepository.release(order.product.id, tx);
        });
        throw ServiceUnavailableError(
          'PAYMENT_GATEWAY_UNAVAILABLE',
          'No fue posible iniciar el pago. Intenta de nuevo en unos minutos.',
        );
      }
    },

    // Solo el comprador o el vendedor pueden ver la orden; a cualquier otro se le responde 404.
    async getForUser(orderId, userId) {
      const order = await orderRepository.findById(orderId);
      if (!order || (order.buyer.id !== userId && order.seller.id !== userId)) {
        throw NotFoundError('ORDER_NOT_FOUND', 'La orden no existe.');
      }
      return { ...order, viewerRole: order.buyer.id === userId ? 'comprador' : 'vendedor' };
    },
  };
}
