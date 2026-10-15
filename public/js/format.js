// Formatos para Colombia: pesos sin decimales y fechas en español.
const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short' });
const monthYear = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' });
const relative = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
const plain = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

export const formatCOP = (value) => cop.format(value);
export const formatNumber = (value) => plain.format(value);
export const formatDateTime = (value) => dateTime.format(new Date(value));
export const formatMonthYear = (value) => monthYear.format(new Date(value));
export const shortId = (id) => id.slice(0, 8).toUpperCase();

export function timeAgo(value) {
  const seconds = (new Date(value).getTime() - Date.now()) / 1000;
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return 'hace un momento';
}

export const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
