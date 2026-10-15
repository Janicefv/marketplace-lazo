// Raíz de composición: crea cada pieza una sola vez y conecta las capas
// (controladores -> servicios -> repositorios / adaptadores). Las pruebas pueden sustituir piezas.
import { attachDatabasePool } from '@vercel/functions';
import { config as defaultConfig } from './config/env.js';
import { createAuthController } from './controllers/auth.controller.js';
import { createOrderController } from './controllers/order.controller.js';
import { createProductController } from './controllers/product.controller.js';
import { createPool } from './db/pool.js';
import { createPaymentGateway } from './integrations/payments/index.js';
import { createStorage } from './integrations/storage/index.js';
import { createRequireAuth } from './middlewares/auth.js';
import { createAuthRateLimit } from './middlewares/rate-limit.js';
import { createCategoryRepository } from './repositories/category.repository.js';
import { createOrderRepository } from './repositories/order.repository.js';
import { createProductRepository } from './repositories/product.repository.js';
import { createUserRepository } from './repositories/user.repository.js';
import { createAuthService } from './services/auth.service.js';
import { createOrderService } from './services/order.service.js';
import { createPaymentService } from './services/payment.service.js';
import { createProductService } from './services/product.service.js';

export function createContainer(overrides = {}) {
  const config = overrides.config ?? defaultConfig;
  const pool = overrides.pool ?? createPool(config);
  // En Vercel (Fluid compute) cierra conexiones inactivas antes de que la función se suspenda.
  if (config.isVercel && !overrides.pool) attachDatabasePool(pool);

  const storage = overrides.storage ?? createStorage(config);
  const paymentGateway = overrides.paymentGateway ?? createPaymentGateway(config);

  // Capa de acceso a datos
  const userRepository = createUserRepository(pool);
  const categoryRepository = createCategoryRepository(pool);
  const productRepository = createProductRepository(pool);
  const orderRepository = createOrderRepository(pool);

  // Capa de negocio
  const authService = createAuthService({ userRepository, config });
  const productService = createProductService({ pool, productRepository, categoryRepository, storage });
  const orderService = createOrderService({
    pool,
    orderRepository,
    productRepository,
    userRepository,
    paymentGateway,
    config,
  });
  const paymentService = createPaymentService({ pool, orderRepository, productRepository, paymentGateway });

  // Capa de presentación de la API
  return {
    config,
    pool,
    storage,
    paymentGateway,
    requireAuth: createRequireAuth({ authService, config }),
    authRateLimit: createAuthRateLimit(config),
    authController: createAuthController({ authService, config }),
    productController: createProductController({ productService }),
    orderController: createOrderController({ orderService, paymentService }),
  };
}
