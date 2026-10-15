// HU-01: /api/auth
import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { loginSchema, registerSchema } from '../validators/auth.schemas.js';

export function authRoutes({ authController, requireAuth, authRateLimit }) {
  const router = Router();
  router.post('/register', authRateLimit, validate({ body: registerSchema }), authController.register);
  router.post('/login', authRateLimit, validate({ body: loginSchema }), authController.login);
  router.get('/me', requireAuth, authController.me);
  router.post('/logout', authController.logout);
  return router;
}
