// Protege rutas con JWT. Acepta "Authorization: Bearer <token>" (clientes de API, Postman)
// o la cookie httpOnly que usa el navegador (inaccesible a JavaScript, resistente a XSS).
import { UnauthorizedError } from '../utils/errors.js';

export function createRequireAuth({ authService, config }) {
  return function requireAuth(req, _res, next) {
    const header = req.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : req.cookies?.[config.jwt.cookieName];
    if (!token) throw UnauthorizedError('AUTH_REQUIRED', 'Debes iniciar sesión para continuar.');
    req.user = authService.verifyToken(token);
    next();
  };
}
