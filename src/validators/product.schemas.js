// Validación de entrada para HU-02 (publicar) y HU-03 (buscar y filtrar).
import { z } from 'zod';
import { optionalQuery, requiredText } from './common.js';

// Los campos llegan como texto en multipart/form-data; price y categoryId se convierten a número.
export const publishProductSchema = z.object({
  title: requiredText('El título', 5, 120),
  description: requiredText('La descripción', 20, 2000),
  price: z.coerce
    .number({ error: 'El precio debe ser un número.' })
    .int('El precio debe ser un valor entero en pesos.')
    .min(1, 'El precio debe ser mayor que cero.')
    .max(1_000_000_000, 'El precio máximo es $1.000.000.000.'),
  categoryId: z.coerce
    .number({ error: 'Selecciona una categoría.' })
    .int('Selecciona una categoría.')
    .positive('Selecciona una categoría.'),
});

const price = z.coerce.number({ error: 'Debe ser un número.' }).int('Debe ser un entero.').min(0, 'No puede ser negativo.');

export const searchProductsSchema = z
  .object({
    search: optionalQuery(z.string().trim().max(100, 'La búsqueda admite máximo 100 caracteres.')),
    category: optionalQuery(z.string().regex(/^[a-z0-9-]{1,40}$/, 'Categoría inválida.')),
    minPrice: optionalQuery(price),
    maxPrice: optionalQuery(price),
    sort: optionalQuery(z.enum(['relevancia', 'recientes', 'precio_asc', 'precio_desc'])),
    page: optionalQuery(z.coerce.number().int().min(1).max(1000)).default(1),
    limit: optionalQuery(z.coerce.number().int().min(1).max(48)).default(12),
  })
  .refine((q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice, {
    path: ['minPrice'],
    message: 'El precio mínimo no puede ser mayor que el máximo.',
  });
