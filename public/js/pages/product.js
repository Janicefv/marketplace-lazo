// Detalle del producto con el botón "Comprar ahora" que lleva al checkout (HU-04).
import { api } from '../api.js';
import { $, h, showAlert, takeFlash } from '../dom.js';
import { formatCOP, formatMonthYear, initials, timeAgo } from '../format.js';
import { initLayout } from '../layout.js';
import { loginUrl } from '../session.js';

const id = new URLSearchParams(location.search).get('id');
const flashBox = $('#flash');
const buy = $('#buy');
const hint = $('#buy-hint');

function disableBuy(label, message) {
  buy.textContent = label;
  buy.removeAttribute('href');
  buy.setAttribute('aria-disabled', 'true');
  buy.setAttribute('role', 'link');
  hint.textContent = message;
}

function renderGallery(product) {
  const main = $('#main-image');
  const select = (image, index) => {
    main.src = image.url;
    main.alt = `${product.title}, foto ${index + 1} de ${product.images.length}`;
    for (const [i, button] of [...$('#thumbs').children].entries()) {
      button.setAttribute('aria-pressed', String(i === index));
    }
  };
  if (product.images.length > 1) {
    $('#thumbs').replaceChildren(
      ...product.images.map((image, index) =>
        h(
          'button',
          { type: 'button', 'aria-label': `Ver foto ${index + 1}`, onClick: () => select(image, index) },
          h('img', { src: image.url, alt: '' }),
        ),
      ),
    );
  }
  select(product.images[0], 0);
}

async function load() {
  if (!id) {
    $('#loading').textContent = 'No indicaste qué producto ver.';
    return;
  }
  const [user, response] = await Promise.all([initLayout(), api(`/products/${encodeURIComponent(id)}`)]);
  const product = response.data;

  document.title = `${product.title} · Lazo`;
  $('#category').replaceChildren(
    h('a', { href: `/index.html?category=${product.category.slug}` }, product.category.name),
    `, publicado ${timeAgo(product.createdAt)}`,
  );
  $('#title').textContent = product.title;
  $('#price').textContent = formatCOP(product.price);
  $('#seller-name').textContent = product.seller.name;
  $('#seller-avatar').textContent = initials(product.seller.name);
  $('#seller-since').textContent = `En Lazo desde ${formatMonthYear(product.seller.memberSince)}`;
  $('#description').textContent = product.description;
  renderGallery(product);

  const checkout = `/checkout.html?producto=${product.id}`;
  if (product.status === 'vendido') {
    disableBuy('Vendido', 'Este producto ya tiene dueño.');
    $('#title').append(' ', h('span', { class: 'badge badge--vendido' }, 'Vendido'));
  } else if (product.status === 'reservado') {
    disableBuy('En proceso de compra', 'Otra persona está pagando este producto. Si no completa el pago, volverá a estar disponible en unos minutos.');
    $('#title').append(' ', h('span', { class: 'badge badge--reservado' }, 'Reservado'));
  } else if (user && user.id === product.seller.id) {
    disableBuy('Es tu publicación', 'No puedes comprar un producto que tú publicaste.');
  } else if (!user) {
    buy.href = loginUrl(checkout);
    hint.textContent = 'Te pediremos iniciar sesión antes de pagar.';
  } else {
    buy.href = checkout;
    hint.textContent = 'Pagas con tarjeta o PSE a través de la pasarela de pagos.';
  }

  $('#loading').hidden = true;
  $('#product').hidden = false;
}

const flash = takeFlash();
if (flash) showAlert(flashBox, flash, 'success');

load().catch((err) => {
  $('#loading').hidden = true;
  showAlert(flashBox, err.status === 404 || err.status === 400 ? 'Este producto no existe o fue retirado.' : err.message);
});
