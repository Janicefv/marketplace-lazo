// Capa de presentación de la API: traduce HTTP <-> servicio de autenticación (HU-01).
export function createAuthController({ authService, config }) {
  const cookieOptions = {
    httpOnly: true,
    secure: config.isProduction, // Solo HTTPS en producción (el proxy inverso termina TLS).
    sameSite: 'lax',
    path: '/',
  };

  const sendSession = (res, status, session) => {
    res.cookie(config.jwt.cookieName, session.token, { ...cookieOptions, maxAge: config.jwt.ttlSeconds * 1000 });
    res.status(status).json(session);
  };

  return {
    async register(req, res) {
      const session = await authService.register(req.validated.body);
      sendSession(res, 201, session);
    },

    async login(req, res) {
      const session = await authService.login(req.validated.body);
      sendSession(res, 200, session);
    },

    async me(req, res) {
      res.json({ user: await authService.getProfile(req.user.id) });
    },

    logout(_req, res) {
      res.clearCookie(config.jwt.cookieName, cookieOptions);
      res.status(204).end();
    },
  };
}
