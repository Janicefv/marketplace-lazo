// Enrutador raíz de la API: todo lo que llega a /api desde el proxy inverso.
import { Router } from 'express';
import { notFound } from '../middlewares/error-handler.js';
import { authRoutes } from './auth.routes.js';
import { orderRoutes, paymentRoutes } from './order.routes.js';
import { categoryRoutes, productRoutes } from './product.routes.js';

export function createApiRouter(container) {
  const router = Router();

  router.get('/health', async (_req, res) => {
    let database = 'ok';
    try {
      await container.pool.query('SELECT 1');
    } catch {
      database = 'error';
    }
    res.status(database === 'ok' ? 200 : 503).json({
      status: database === 'ok' ? 'ok' : 'degradado',
      database,
      storage: container.storage.name,
      payments: container.paymentGateway.name,
      time: new Date().toISOString(),
    });
  });

  router.use('/auth', authRoutes(container));
  router.use('/categories', categoryRoutes(container));
  router.use('/products', productRoutes(container));
  router.use('/orders', orderRoutes(container));
  router.use('/payments', paymentRoutes(container));
  router.use(notFound);
  return router;
}
