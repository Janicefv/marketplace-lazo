// Cliente HTTP del frontend: todas las llamadas pasan por /api (mismo origen, detrás del proxy inverso).
// La sesión viaja en una cookie httpOnly; JavaScript nunca toca el token.
export class ApiError extends Error {
  constructor(status, error) {
    super(error.message);
    this.status = status;
    this.code = error.code;
    this.details = error.details ?? [];
  }
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const init = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (form) {
    init.body = form; // FormData: el navegador agrega el boundary de multipart.
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError(0, {
      code: 'NETWORK_ERROR',
      message: 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.',
    });
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.error ?? { code: `HTTP_${response.status}`, message: 'Ocurrió un error inesperado. Intenta de nuevo.' },
    );
  }
  return data;
}
