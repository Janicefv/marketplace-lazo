// Recepción segura de imágenes (HU-02): en memoria, con límites de tamaño y cantidad,
// y verificando la firma binaria del archivo (no se confía en la extensión ni en el MIME declarado).
import multer from 'multer';
import { BadRequestError } from '../utils/errors.js';

export const MAX_IMAGES = 5;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // El frontend comprime antes de enviar; Vercel acepta 4,5 MB por petición.
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function detectImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (buffer.length >= 12 && buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_IMAGES, fields: 10, fieldSize: 10_000 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      return cb(BadRequestError('INVALID_IMAGE', `"${file.originalname}" no es JPG, PNG ni WEBP.`));
    }
    cb(null, true);
  },
}).array('images', MAX_IMAGES);

export function uploadImages(req, res, next) {
  parser(req, res, (err) => {
    if (err) return next(err);
    const files = req.files ?? [];
    if (files.length === 0) {
      return next(
        BadRequestError('VALIDATION_ERROR', 'Revisa los datos enviados.', [
          { field: 'images', message: 'Agrega al menos una imagen del producto.' },
        ]),
      );
    }
    for (const file of files) {
      file.detectedType = detectImageType(file.buffer);
      if (!file.detectedType) {
        return next(BadRequestError('INVALID_IMAGE', `"${file.originalname}" no es una imagen válida.`));
      }
    }
    next();
  });
}
