// HU-03: catálogo con búsqueda por palabra clave, filtros por categoría y precio, y paginación.
// El estado vive en la URL (?search=&category=&minPrice=&maxPrice=&sort=&page=) para poder compartirla.
import { api } from '../api.js';
import { $, h, setFieldError, showAlert, takeFlash } from '../dom.js';
import { formatCOP, formatNumber, timeAgo } from '../format.js';
import { initLayout } from '../layout.js';

const FIELDS = ['search', 'category', 'minPrice', 'maxPrice', 'sort', 'page'];
const PAGE_SIZE = 12;

const form = $('#filters-form');
const results = $('#results');
const count = $('#results-count');
const title = $('#results-title');
const pagination = $('#pagination');
const searchForm = $('#search-form');
const searchInput = $('#site-search');
const priceInputs = [form.elements.minPrice, form.elements.maxPrice];
let categories = [];
let requestId = 0;

const readState = () => {
  const params = new URLSearchParams(location.search);
  return Object.fromEntries(FIELDS.map((key) => [key, params.get(key) ?? '']));
};

function writeState(state, { replace = false } = {}) {
  const params = new URLSearchParams();
  for (const key of FIELDS) if (state[key]) params.set(key, state[key]);
  const url = `${location.pathname}${params.size ? `?${params}` : ''}`;
  history[replace ? 'replaceState' : 'pushState'](null, '', url);
}

function fillControls(state) {
  searchInput.value = state.search;
  for (const radio of document.getElementsByName('category')) {
    radio.checked = radio.value === state.category;
  }
  form.elements.minPrice.value = state.minPrice;
  form.elements.maxPrice.value = state.maxPrice;
  $('#sort').value = state.sort;
}

function tile(product) {
  return h(
    'li',
    { class: 'tile' },
    h(
      'a',
      { href: `/producto.html?id=${product.id}` },
      h(
        'div',
        { class: 'tile__photo' },
        h('img', { src: product.coverImage, alt: '', loading: 'lazy', width: 400, height: 400 }),
        h('span', { class: 'etiqueta' }, formatCOP(product.price)),
      ),
      h('div', { class: 'tile__title' }, product.title),
      h('div', { class: 'tile__meta' }, `${product.category.name}, publicado ${timeAgo(product.createdAt)}`),
    ),
  );
}

function skeletons() {
  return Array.from({ length: 8 }, () =>
    h('li', { class: 'tile tile--skeleton', 'aria-hidden': 'true' }, h('div', { class: 'tile__photo' }), h('div', { class: 'tile__title' })),
  );
}

function pageLink(state, page, label, current = false) {
  const params = new URLSearchParams();
  for (const key of FIELDS) if (state[key] && key !== 'page') params.set(key, state[key]);
  if (page > 1) params.set('page', page);
  if (current) return h('span', { 'aria-current': 'page' }, label);
  return h('a', { href: `?${params}`, 'data-page': page }, label);
}

function renderPagination(state, { page, totalPages }) {
  pagination.replaceChildren();
  if (totalPages <= 1) return;
  const items = [];
  if (page > 1) items.push(pageLink(state, page - 1, 'Anterior'));
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  let previous = 0;
  for (const p of [...pages].sort((a, b) => a - b)) {
    if (p - previous > 1) items.push(h('span', { 'aria-hidden': 'true' }, '…'));
    items.push(pageLink(state, p, String(p), p === page));
    previous = p;
  }
  if (page < totalPages) items.push(pageLink(state, page + 1, 'Siguiente'));
  pagination.replaceChildren(...items);
}

function heading(state) {
  if (state.search) return `Resultados para “${state.search}”`;
  const category = categories.find((c) => c.slug === state.category);
  return category ? category.name : 'Lo que se está vendiendo';
}

async function render() {
  const state = readState();
  fillControls(state);
  // Título por defecto con la palabra final en cursiva (detalle de estilo); el resto, texto plano.
  const text = heading(state);
  if (text === 'Lo que se está vendiendo') title.replaceChildren('Lo que se está ', h('em', {}, 'vendiendo'));
  else title.textContent = text;

  const min = state.minPrice === '' ? null : Number(state.minPrice);
  const max = state.maxPrice === '' ? null : Number(state.maxPrice);
  if (min !== null && max !== null && min > max) {
    setFieldError(form.elements.maxPrice, 'El máximo debe ser mayor o igual que el mínimo.');
    return;
  }
  setFieldError(form.elements.maxPrice, null);

  const params = new URLSearchParams({ limit: PAGE_SIZE });
  for (const key of FIELDS) if (state[key]) params.set(key, state[key]);

  const current = ++requestId;
  results.setAttribute('aria-busy', 'true');
  results.replaceChildren(...skeletons());
  count.textContent = 'Buscando…';

  try {
    const response = await api(`/products?${params}`);
    if (current !== requestId) return; // Llegó una búsqueda más nueva.
    const { data, pagination: info } = response;
    count.textContent =
      info.total === 1 ? '1 producto' : `${formatNumber(info.total)} productos`;
    const filtered = ['search', 'category', 'minPrice', 'maxPrice'].some((key) => state[key]);
    if (data.length === 0 && filtered) {
      results.replaceChildren(
        h(
          'li',
          { class: 'empty' },
          h('h2', {}, 'No hay productos con esa búsqueda'),
          h('p', {}, 'Prueba con otra palabra, otra categoría o un rango de precio más amplio.'),
          h('button', { type: 'button', class: 'button button--secondary', onClick: clearAll }, 'Ver todo el catálogo'),
        ),
      );
    } else if (data.length === 0) {
      results.replaceChildren(
        h(
          'li',
          { class: 'empty' },
          h('h2', {}, 'Todavía no hay productos a la venta'),
          h('p', {}, 'Publica lo que ya no usas y sé la primera persona en vender.'),
          h('a', { class: 'button', href: '/publicar.html' }, 'Publicar un producto'),
        ),
      );
    } else {
      results.replaceChildren(...data.map(tile));
    }
    renderPagination(state, info);
  } catch (err) {
    if (current !== requestId) return;
    results.replaceChildren();
    count.textContent = '';
    showAlert($('#flash'), err.message);
  } finally {
    if (current === requestId) results.setAttribute('aria-busy', 'false');
  }
}

function update(changes) {
  writeState({ ...readState(), ...changes, page: changes.page ?? '' });
  render();
}

function clearAll() {
  writeState({});
  render();
}

async function loadCategories() {
  const { data } = await api('/categories');
  categories = data;
  $('#category-list').append(
    ...data.map((c) =>
      h('label', { class: 'choice' }, h('input', { type: 'radio', name: 'category', value: c.slug }), ` ${c.name}`),
    ),
  );
}

// Eventos ---------------------------------------------------------------
searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  update({ search: searchInput.value.trim(), sort: '' });
});

form.addEventListener('change', (event) => {
  const { name, value } = event.target;
  if (name === 'category' || name === 'sort') update({ [name]: value });
});

let priceTimer;
for (const input of priceInputs) {
  input.addEventListener('input', () => {
    clearTimeout(priceTimer);
    priceTimer = setTimeout(() => update({ minPrice: form.elements.minPrice.value, maxPrice: form.elements.maxPrice.value }), 500);
  });
}

$('#clear-filters').addEventListener('click', () => update({ category: '', minPrice: '', maxPrice: '', sort: '' }));

pagination.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-page]');
  if (!link) return;
  event.preventDefault();
  update({ page: link.dataset.page === '1' ? '' : link.dataset.page });
  $('#main').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

window.addEventListener('popstate', render);

if (matchMedia('(max-width: 860px)').matches) $('#filters').open = false;

const flash = takeFlash();
if (flash) showAlert($('#flash'), flash, 'success');

initLayout();
await loadCategories().catch(() => {});
render();
