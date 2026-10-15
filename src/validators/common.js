// Piezas reutilizables de validación (Zod) con mensajes en español.
import { z } from 'zod';

export const requiredText = (label, min, max) =>
  z
    .string({ error: (issue) => (issue.input === undefined ? `${label} es obligatorio.` : `${label} debe ser texto.`) })
    .trim()
    .min(min, { error: `${label} debe tener al menos ${min} caracteres.`, abort: true })
    .max(max, `${label} admite máximo ${max} caracteres.`);

// Teléfono: se aceptan espacios, guiones y paréntesis, y se guarda solo con dígitos (y + opcional).
export const phone = z
  .string({ error: 'El teléfono es obligatorio.' })
  .transform((value) => value.replace(/[\s()-]/g, ''))
  .pipe(z.string().regex(/^\+?\d{7,15}$/, 'Ingresa un teléfono válido de 7 a 15 dígitos.'));

export const uuid = (label) => z.uuid(`${label} no es un identificador válido.`);

// Los parámetros de consulta llegan como texto: "" se trata como ausente.
export const optionalQuery = (schema) =>
  z.preprocess((value) => (value === '' || value === null ? undefined : value), schema.optional());

export const idParam = z.object({ id: uuid('El id') });
