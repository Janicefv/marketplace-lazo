// HU-04: confirmación de dirección de entrega y selección de método de pago.
// Al enviar se crea la orden (el producto queda reservado) y se redirige a la pasarela.
import { api } from '../api.js';
import { $, clearFieldErrors, h, hideAlert, setBusy, setFieldError, showAlert, showServerErrors } from '../dom.js';
import { formatCOP } from '../format.js';
import { initLayout } from '../layout.js';
import { requireSession } from '../session.js';
import { PHONE_PATTERN, normalizePhone } from '../validation.js';

const DEPARTMENTS = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá D.C.', 'Bolívar', 'Boyacá', 'Caldas', 'Caquetá',
  'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía', 'Guaviare', 'Huila',
  'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda',
  'San Andrés y Providencia', 'Santander', 'Sucre', 'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada',
];

const form = $('#checkout-form');
const pageAlert = $('#page-alert');
const submit = $('#submit');
const productId = new URLSearchParams(location.search).get('producto');

const rules = {
  fullName: (v) => (v.trim().length >= 3 ? null : 'Escribe el nombre de quien recibe.'),
  phone: (v) => (PHONE_PATTERN.test(normalizePhone(v)) ? null : 'Escribe un teléfono de 7 a 15 dígitos.'),
  address: (v) => (v.trim().length >= 5 ? null : 'Escribe la dirección completa.'),
  city: (v) => (v.trim().length >= 2 ? null : 'Escribe la ciudad o municipio.'),
  department: (v) => (v ? null : 'Selecciona el departamento.'),
};

function stop(message) {
  $('#loading').hidden = true;
  pageAlert.className = 'alert alert--error';
  pageAlert.replaceChildren(h('p', {}, message, ' ', h('a', { href: '/index.html' }, 'Volver al catálogo')));
  pageAlert.hidden = false;
}

await initLayout();
const user = await requireSession();

async function init() {
  if (!productId) return stop('No indicaste qué producto comprar.');
  let product;
  try {
    product = (await api(`/products/${encodeURIComponent(productId)}`)).data;
  } catch {
    return stop('Este producto no existe o fue retirado.');
  }
  if (product.seller.id === user.id) return stop('No puedes comprar un producto que tú publicaste.');
  if (product.status !== 'disponible') {
    return stop(product.status === 'vendido' ? 'Este producto ya fue vendido.' : 'Otra persona está pagando este producto en este momento.');
  }

  $('#department').append(...DEPARTMENTS.map((d) => h('option', { value: d }, d)));
  form.elements.fullName.value = user.name;
  form.elements.phone.value = user.phone;
  $('#summary-image').src = product.images[0]?.url ?? '';
  $('#summary-title-text').textContent = product.title;
  $('#summary-seller').textContent = `Vende ${product.seller.name}`;
  $('#summary-price').textContent = formatCOP(product.price);
  $('#summary-total').textContent = formatCOP(product.price);
  submit.textContent = `Ir a pagar ${formatCOP(product.price)}`;

  $('#loading').hidden = true;
  form.hidden = false;
}

for (const name of Object.keys(rules)) {
  const input = form.elements[name];
  input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'blur', () => {
    if (input.value || input.hasAttribute('aria-invalid')) setFieldError(input, rules[name](input.value));
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideAlert(pageAlert);
  clearFieldErrors(form);

  let first = null;
  for (const [name, rule] of Object.entries(rules)) {
    const input = form.elements[name];
    const message = rule(input.value);
    setFieldError(input, message);
    if (message) first ??= input;
  }
  if (first) {
    first.focus();
    return;
  }

  const values = Object.fromEntries(new FormData(form));
  setBusy(submit, true, 'Reservando producto…');
  try {
    const { checkoutUrl } = await api('/orders', {
      method: 'POST',
      body: {
        productId,
        paymentMethod: values.paymentMethod,
        shippingAddress: {
          fullName: values.fullName.trim(),
          phone: values.phone,
          address: values.address.trim(),
          city: values.city.trim(),
          department: values.department,
          ...(values.notes.trim() && { notes: values.notes.trim() }),
        },
      },
    });
    location.href = checkoutUrl; // Redirección a la pasarela de pago.
  } catch (err) {
    setBusy(submit, false);
    if (!(err.details.length && showServerErrors(form, err.details))) {
      showAlert(pageAlert, err.message);
      pageAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
});

init();
