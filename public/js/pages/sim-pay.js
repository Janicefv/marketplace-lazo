// Pasarela simulada (sandbox): permite demostrar HU-04 sin credenciales reales.
// Con PAYMENT_PROVIDER=mercadopago esta página no se usa: el comprador va a Mercado Pago.
import { api } from '../api.js';
import { $, h, setBusy, setFieldError, showAlert } from '../dom.js';
import { formatCOP, shortId } from '../format.js';
import { requireSession } from '../session.js';

const orderId = new URLSearchParams(location.search).get('order');
const pageAlert = $('#page-alert');
const cardForm = $('#card-form');
const pseForm = $('#pse-form');
const receiptUrl = `/confirmacion.html?order=${encodeURIComponent(orderId ?? '')}`;
let order;

await requireSession();

function startTimer(expiresAt) {
  const timer = $('#timer');
  const tick = () => {
    const left = Math.max(0, new Date(expiresAt).getTime() - Date.now());
    const minutes = Math.floor(left / 60000);
    const seconds = Math.floor((left % 60000) / 1000);
    timer.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;
    if (left === 0) {
      clearInterval(interval);
      for (const button of document.querySelectorAll('button[type="submit"]')) button.disabled = true;
      showAlert(pageAlert, 'Se acabó el tiempo para pagar. El producto volvió al catálogo.');
    }
  };
  const interval = setInterval(tick, 1000);
  tick();
}

async function charge(button, payload) {
  setBusy(button, true, 'Procesando pago…');
  try {
    await api('/payments/simulated/charge', { method: 'POST', body: { orderId, ...payload } });
    location.replace(receiptUrl); // Aprobado o rechazado, el recibo muestra el resultado.
  } catch (err) {
    setBusy(button, false);
    if (err.code === 'INVALID_CARD' || err.code === 'CARD_EXPIRED') {
      setFieldError(err.code === 'INVALID_CARD' ? cardForm.elements.number : cardForm.elements.expiry, err.message);
    } else {
      showAlert(pageAlert, err.message);
    }
  }
}

// Formato del número de tarjeta en grupos de 4.
cardForm.elements.number.addEventListener('input', (event) => {
  const digits = event.target.value.replace(/\D/g, '').slice(0, 19);
  event.target.value = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
});
cardForm.elements.expiry.addEventListener('input', (event) => {
  const digits = event.target.value.replace(/\D/g, '').slice(0, 4);
  event.target.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
});
$('#test-cards').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-number]');
  if (!button) return;
  const { number, holder, expiry, cvc } = cardForm.elements;
  number.value = button.dataset.number;
  holder.value ||= order.buyer.name;
  expiry.value ||= '12/30';
  cvc.value ||= '123';
  setFieldError(number, null);
});

cardForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const { number, holder, expiry, cvc } = cardForm.elements;
  const [month, year] = expiry.value.split('/').map(Number);
  const checks = [
    [number, number.value.replace(/\D/g, '').length >= 13 ? null : 'Escribe el número completo de la tarjeta.'],
    [holder, holder.value.trim().length >= 3 ? null : 'Escribe el nombre como aparece en la tarjeta.'],
    [expiry, month >= 1 && month <= 12 && year >= 0 ? null : 'Usa el formato MM/AA.'],
    [cvc, /^\d{3,4}$/.test(cvc.value) ? null : 'El código tiene 3 o 4 dígitos.'],
  ];
  checks.forEach(([input, message]) => setFieldError(input, message));
  const invalid = checks.find(([, message]) => message);
  if (invalid) return invalid[0].focus();

  charge($('#pay-card'), {
    card: { number: number.value, holder: holder.value.trim(), expMonth: month, expYear: 2000 + year, cvc: cvc.value },
  });
});

pseForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const { bank, outcome } = pseForm.elements;
  setFieldError(bank, bank.value ? null : 'Selecciona tu banco.');
  if (!bank.value) return bank.focus();
  charge($('#pay-pse'), { outcome: outcome.value });
});

try {
  if (!orderId) throw new Error('Falta el número de la orden.');
  order = (await api(`/orders/${encodeURIComponent(orderId)}`)).data;
  if (order.status !== 'pendiente') {
    location.replace(receiptUrl);
  } else {
    $('#amount').textContent = formatCOP(order.amount);
    $('#order-ref').replaceChildren(`Orden ${shortId(order.id)}: `, h('span', {}, order.product.title));
    const isCard = order.paymentMethod === 'tarjeta';
    cardForm.hidden = !isCard;
    pseForm.hidden = isCard;
    $(isCard ? '#pay-card' : '#pay-pse').textContent = `Pagar ${formatCOP(order.amount)}`;
    startTimer(order.expiresAt);
    $('#loading').hidden = true;
    $('#pay-panel').hidden = false;
  }
} catch (err) {
  $('#loading').hidden = true;
  showAlert(pageAlert, err.message);
}
