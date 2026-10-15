// Traduce cualquier error a una respuesta JSON uniforme: { error: { code, message, details? } }.
// Nunca expone trazas ni detalles internos al cliente.
import multer from 'multer';
import { AppError } from '../utils/errors.js';

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: [413, 'IMAGE_TOO_LARGE', 'Cada imagen debe pesar máximo 2 MB.'],
  LIMIT_FILE_COUNT: [400, 'TOO_MANY_IMAGES', 'Puedes subir máximo 5 imágenes.'],
  LIMIT_UNEXPECTED_FILE: [400, 'TOO_MANY_IMAGES', 'Puedes subir máximo 5 imágenes.'],
};

export function notFound(req, _res, next) {
  next(new AppError(404, 'ROUTE_NOT_FOUND', `No existe la ruta ${req.method} ${req.originalUrl}.`));
}

export function errorHandler(err, req, res, _next) {
  let status = 500;
  let body = { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado. Intenta de nuevo.' };

  if (err instanceof AppError) {
    status = err.status;
    body = { code: err.code, message: err.message, ...(err.details && { details: err.details }) };
  } else if (err instanceof multer.MulterError) {
    const [s, code, message] = MULTER_MESSAGES[err.code] ?? [400, 'INVALID_UPLOAD', 'No se pudo procesar la carga.'];
    status = s;
    body = { code, message };
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    body = { code: 'INVALID_JSON', message: 'El cuerpo de la petición no es JSON válido.' };
  } else if (err.type === 'entity.too.large') {
    status = 413;
    body = { code: 'PAYLOAD_TOO_LARGE', message: 'La petición es demasiado grande.' };
  }

  if (status >= 500) console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  res.status(status).json({ error: body });
}
