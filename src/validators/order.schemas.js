// Validación de entrada para HU-04 (compra) y pagos.
import { z } from 'zod';
import { phone, requiredText, uuid } from './common.js';

export const createOrderSchema = z.object({
  productId: uuid('El producto'),
  paymentMethod: z.enum(['tarjeta', 'pse'], { error: 'Selecciona un método de pago: tarjeta o PSE.' }),
  shippingAddress: z.object(
    {
      fullName: requiredText('El nombre de quien recibe', 3, 80),
      phone,
      address: requiredText('La dirección', 5, 160),
      city: requiredText('La ciudad', 2, 60),
      department: requiredText('El departamento', 2, 60),
      notes: z.string().trim().max(200, 'Las indicaciones admiten máximo 200 caracteres.').optional(),
    },
    { error: 'La dirección de entrega es obligatoria.' },
  ),
});

export const simulatedChargeSchema = z.object({
  orderId: uuid('La orden'),
  card: z
    .object({
      number: z.string().max(23),
      holder: requiredText('El nombre del titular', 3, 80),
      expMonth: z.coerce.number().int().min(1, 'Mes inválido.').max(12, 'Mes inválido.'),
      expYear: z.coerce.number().int().min(2000).max(2100),
      cvc: z.string().regex(/^\d{3,4}$/, 'El código de seguridad tiene 3 o 4 dígitos.'),
    })
    .optional(),
  outcome: z.enum(['aprobado', 'rechazado']).optional(),
});

export const confirmPaymentSchema = z.object({
  orderId: uuid('La orden'),
  paymentId: z.string().trim().max(64).regex(/^[\w-]*$/, 'Pago inválido.').optional(),
});
