// HU-04: /api/orders y /api/payments
import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { idParam } from '../validators/common.js';
import { confirmPaymentSchema, createOrderSchema, simulatedChargeSchema } from '../validators/order.schemas.js';
import { NotFoundError } from '../utils/errors.js';

export function orderRoutes({ orderController, requireAuth }) {
  const router = Router();
  router.post('/', requireAuth, validate({ body: createOrderSchema }), orderController.create);
  router.get('/:id', requireAuth, validate({ params: idParam }), orderController.getById);
  return router;
}

export function paymentRoutes({ orderController, requireAuth, paymentGateway }) {
  const router = Router();
  router.post('/webhook', orderController.webhook);
  router.post('/confirm', requireAuth, validate({ body: confirmPaymentSchema }), orderController.confirm);
  router.post(
    '/simulated/charge',
    (_req, _res, next) => {
      if (paymentGateway.name !== 'simulated') throw NotFoundError('ROUTE_NOT_FOUND', 'La pasarela simulada está desactivada.');
      next();
    },
    requireAuth,
    validate({ body: simulatedChargeSchema }),
    orderController.simulatedCharge,
  );
  return router;
}
