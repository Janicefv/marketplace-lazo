// Capa de presentación de la API: órdenes y pagos (HU-04).
import { AppError } from '../utils/errors.js';

export function createOrderController({ orderService, paymentService }) {
  return {
    async create(req, res) {
      const { order, checkoutUrl } = await orderService.create(req.user.id, req.validated.body);
      res.status(201).location(`/api/orders/${order.id}`).json({ data: order, checkoutUrl });
    },

    async getById(req, res) {
      res.json({ data: await orderService.getForUser(req.validated.params.id, req.user.id) });
    },

    async simulatedCharge(req, res) {
      const { order, payment } = await paymentService.chargeSimulated(req.user.id, req.validated.body);
      res.json({ data: order, payment });
    },

    async confirm(req, res) {
      res.json({ data: await paymentService.confirm(req.user.id, req.validated.body) });
    },

    // La pasarela reintenta mientras no reciba 2xx; una orden inexistente se reconoce y se ignora.
    async webhook(req, res) {
      try {
        const result = await paymentService.handleNotification({
          headers: req.headers,
          query: req.query,
          body: req.body,
        });
        res.json({ received: true, ...result });
      } catch (err) {
        if (err instanceof AppError && err.status === 404) return res.json({ received: true, processed: false });
        throw err;
      }
    },
  };
}
