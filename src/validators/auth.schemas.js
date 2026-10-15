// Validación de entrada para HU-01 (registro) e inicio de sesión.
import { z } from 'zod';
import { phone, requiredText } from './common.js';

const email = z
  .string({ error: 'El correo electrónico es obligatorio.' })
  .trim()
  .toLowerCase()
  .pipe(z.email('Ingresa un correo electrónico válido.').max(254, 'El correo es demasiado largo.'));

// Fortaleza mínima: 8+ caracteres, mayúscula, minúscula y número. bcrypt solo usa 72 bytes.
export const password = z
  .string({ error: 'La contraseña es obligatoria.' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'La contraseña admite máximo 72 bytes.')
  .refine((value) => /[a-záéíóúñ]/.test(value), 'La contraseña debe incluir una letra minúscula.')
  .refine((value) => /[A-ZÁÉÍÓÚÑ]/.test(value), 'La contraseña debe incluir una letra mayúscula.')
  .refine((value) => /\d/.test(value), 'La contraseña debe incluir un número.');

export const registerSchema = z
  .object({
    name: requiredText('El nombre', 2, 80).regex(
      /^\p{L}[\p{L}\s.'-]*$/u,
      'El nombre solo puede contener letras, espacios, puntos, guiones y apóstrofos.',
    ),
    email,
    password,
    confirmPassword: z.string().optional(),
    phone,
  })
  .refine((data) => data.confirmPassword === undefined || data.confirmPassword === data.password, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden.',
  })
  .transform(({ confirmPassword: _omit, ...data }) => data);

export const loginSchema = z.object({
  email,
  password: z.string({ error: 'La contraseña es obligatoria.' }).min(1, 'La contraseña es obligatoria.').max(200),
});
