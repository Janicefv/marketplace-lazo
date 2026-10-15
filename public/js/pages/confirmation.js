// HU-04: pantalla de confirmación/recibo después del pago.
// Si la pasarela real (Mercado Pago) devuelve ?payment_id=..., el backend lo verifica con su API.
import { api } from '../api.js';
import { $, h, showAlert } from '../dom.js';
import { formatCOP, formatDateTime, shortId } from '../format.js';
import { initLayout } from '../layout.js';
import { requireSession } from '../session.js';

const params = new URLSearchParams(location.search);
const orderId = params.get('order') ?? params.get('external_reference');
const paymentId = params.get('payment_id') ?? params.get('collection_id');

const METHODS = { tarjeta: 'Tarjeta crédito o débito', pse: 'PSE' };
const VIEWS = {
  pagada: {
    tone: 'aprobado',
    icon: '✓',
    title: 'Pago aprobado',
    text: (o) => `Compraste "${o.product.title}". ${o.seller.name} recibirá tu dirección para hacer el envío.`,
  },
  rechazada: {
    tone: 'rechazado',
    icon: '!',
    title: 'Pago rechazado',
    text: (o) =>
      o.refundRequired
        ? 'Tu pago llegó cuando el producto ya tenía otro comprador. Se te devolverá el dinero.'
        : 'La pasarela no aprobó el pago y no se te cobró nada. El producto volvió a estar disponible.',
  },
  expirada: {
    tone: 'rechazado',
    icon: '!',
    title: 'Se acabó el tiempo para pagar',
    text: () => 'La reserva venció y no se te cobró nada. Si el producto sigue disponible, puedes intentarlo de nuevo.',
  },
  cancelada: {
    tone: 'rechazado',
    icon: '!',
    title: 'No se pudo iniciar el pago',
    text: () => 'La pasarela no respondió y no se te cobró nada. Intenta de nuevo en unos minutos.',
  },
  pendiente: {
    tone: 'pendiente',
    icon: '…',
    title: 'Pago en proceso',
    text: () => 'Estamos esperando la confirmación de la pasarela. Esta página se actualiza sola.',
  },
};

await initLayout();
await requireSession();

function render(order) {
  const view = VIEWS[order.status];
  $('#status').className = `status status--${view.tone}`;
  $('#status-icon').textContent = view.icon;
  $('#status-title').textContent = view.title;
  $('#status-text').textContent = view.text(order);
  document.title = `${view.title} · Lazo`;

  const a = order.shippingAddress;
  $('#r-order').textContent = shortId(order.id);
  $('#r-date').textContent = formatDateTime(order.paidAt ?? order.createdAt);
  $('#r-product').replaceChildren(h('a', { href: `/producto.html?id=${order.product.id}` }, order.product.title));
  $('#r-seller').textContent = order.seller.name;
  $('#r-buyer').textContent = order.buyer.name;
  $('#r-method').textContent = METHODS[order.paymentMethod];
  $('#r-payment').textContent = order.paymentRef ?? 'Sin pago registrado';
  $('#r-address').textContent = `${a.address}, ${a.city}, ${a.department}`;
  $('#r-total').textContent = formatCOP(order.amount);

  const actions = [];
  if (order.status === 'pagada') {
    actions.push(h('button', { type: 'button', class: 'button button--secondary', onClick: () => print() }, 'Imprimir recibo'));
    actions.push(h('a', { class: 'button', href: '/index.html' }, 'Seguir comprando'));
  } else if (order.status !== 'pendiente') {
    actions.push(h('a', { class: 'button', href: `/checkout.html?producto=${order.product.id}` }, 'Intentar de nuevo'));
    actions.push(h('a', { class: 'button button--secondary', href: '/index.html' }, 'Volver al catálogo'));
  }
  $('#actions').replaceChildren(...actions);

  const firstRender = $('#result').hidden;
  $('#loading').hidden = true;
  $('#result').hidden = false;
  if (firstRender && order.status === 'pagada') $('#receipt').classList.add('is-printing');
}

async function load() {
  if (!orderId) throw new Error('Falta el número de la orden.');
  const { data } = paymentId
    ? await api('/payments/confirm', { method: 'POST', body: { orderId, paymentId } })
    : await api(`/orders/${encodeURIComponent(orderId)}`);
  render(data);
  return data;
}

// Mientras el pago esté pendiente se consulta cada 3 s, máximo 2 minutos.
let attempts = 0;
async function poll() {
  try {
    const order = await load();
    if (order.status === 'pendiente' && attempts++ < 40) setTimeout(poll, 3000);
  } catch (err) {
    $('#loading').hidden = true;
    showAlert($('#page-alert'), err.status === 404 ? 'No encontramos esta orden en tu cuenta.' : err.message);
  }
}

poll();
