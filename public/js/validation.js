// Reglas de validación del lado del cliente. Son las mismas que aplica el backend;
// aquí solo sirven para avisar antes de enviar.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PHONE_PATTERN = /^\+?\d{7,15}$/;

export const normalizePhone = (value) => value.replace(/[\s()-]/g, '');

export function passwordChecks(value) {
  return {
    length: value.length >= 8,
    lower: /[a-záéíóúñ]/.test(value),
    upper: /[A-ZÁÉÍÓÚÑ]/.test(value),
    digit: /\d/.test(value),
    symbol: /[^\p{L}\p{N}\s]/u.test(value),
  };
}

// Requisitos obligatorios: longitud, minúscula, mayúscula y número. El símbolo suma fortaleza.
export function isPasswordAcceptable(value) {
  const c = passwordChecks(value);
  return c.length && c.lower && c.upper && c.digit && new TextEncoder().encode(value).length <= 72;
}

// 0 = vacío, 1 = débil, 2 = regular, 3 = buena, 4 = fuerte
export function passwordLevel(value) {
  if (!value) return 0;
  const c = passwordChecks(value);
  if (!isPasswordAcceptable(value)) {
    const met = [c.length, c.lower, c.upper, c.digit].filter(Boolean).length;
    return met >= 3 ? 2 : 1;
  }
  return c.symbol || value.length >= 12 ? 4 : 3;
}

export const PASSWORD_LABELS = ['', 'Débil', 'Regular', 'Buena', 'Fuerte'];
