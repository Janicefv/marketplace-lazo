// Sesión del usuario: se consulta a /api/auth/me (la cookie httpOnly viaja sola).
import { api } from './api.js';

let current;

export function getSession() {
  current ??= api('/auth/me')
    .then((response) => response.user)
    .catch((err) => {
      if (err.status === 401) return null;
      throw err;
    });
  return current;
}

// Solo permite volver a rutas internas (evita redirecciones abiertas a otros sitios).
export function safeReturnPath(value, fallback = '/index.html') {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : fallback;
}

export function loginUrl(returnPath = location.pathname + location.search) {
  return `/login.html?volver=${encodeURIComponent(returnPath)}`;
}

export async function requireSession() {
  const user = await getSession();
  if (!user) {
    location.replace(loginUrl());
    return new Promise(() => {}); // Detiene la página mientras redirige.
  }
  return user;
}

export async function logout() {
  await api('/auth/logout', { method: 'POST' });
  current = Promise.resolve(null);
}
