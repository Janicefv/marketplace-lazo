// HU-02: publicar producto con carga de imágenes, previsualización y botón deshabilitado
// hasta que todos los campos obligatorios sean válidos.
import { api } from '../api.js';
import { $, clearFieldErrors, h, hideAlert, setBusy, setFieldError, setFlash, showAlert, showServerErrors } from '../dom.js';
import { formatNumber } from '../format.js';
import { ACCEPTED_TYPES, compressImage } from '../images.js';
import { initLayout } from '../layout.js';
import { requireSession } from '../session.js';

const MAX_IMAGES = 5;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

const form = $('#publish-form');
const submit = $('#submit');
const alertBox = $('#form-alert');
const fileInput = $('#images');
const dropzone = $('#dropzone');
const previews = $('#previews');
const { title, categoryId, price, description } = form.elements;
const images = []; // { file, url }

await initLayout();
await requireSession();

// Reglas de cada campo: devuelven el mensaje o null.
const rules = {
  title: () => (title.value.trim().length >= 5 ? null : 'El título debe tener al menos 5 caracteres.'),
  categoryId: () => (categoryId.value ? null : 'Selecciona una categoría.'),
  price: () => {
    const value = Number(price.dataset.raw ?? 0);
    if (!value) return 'Escribe un precio mayor que cero.';
    return value <= 1_000_000_000 ? null : 'El precio máximo es $1.000.000.000.';
  },
  description: () =>
    description.value.trim().length >= 20 ? null : 'La descripción debe tener al menos 20 caracteres.',
  images: () => (images.length ? null : 'Agrega al menos una foto.'),
};
const LABELS = { images: 'una foto', title: 'el título', categoryId: 'la categoría', price: 'el precio', description: 'la descripción' };

function refreshSubmit() {
  const missing = Object.keys(rules).filter((key) => rules[key]());
  submit.disabled = missing.length > 0;
  $('#missing').textContent = missing.length
    ? `Para publicar falta ${missing.map((key) => LABELS[key]).join(', ').replace(/, ([^,]*)$/, ' y $1')}.`
    : 'Todo listo para publicar.';
}

function checkField(input) {
  setFieldError(input, rules[input.name]());
}

// Contadores de caracteres
for (const [input, max] of [[title, 120], [description, 2000]]) {
  input.addEventListener('input', () => {
    $(`#${input.id}-count`).textContent = `${input.value.length}/${max}`;
    if (input.hasAttribute('aria-invalid')) checkField(input);
    refreshSubmit();
  });
  input.addEventListener('blur', () => input.value && checkField(input));
}

categoryId.addEventListener('change', () => {
  checkField(categoryId);
  refreshSubmit();
});

// Precio con separador de miles mientras se escribe: 1500000 -> 1.500.000
price.addEventListener('input', () => {
  const digits = price.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 10);
  price.dataset.raw = digits;
  price.value = digits ? formatNumber(Number(digits)) : '';
  if (price.hasAttribute('aria-invalid')) checkField(price);
  refreshSubmit();
});
price.addEventListener('blur', () => price.value && checkField(price));

// Imágenes ---------------------------------------------------------------
function renderPreviews() {
  previews.replaceChildren(
    ...images.map((image, index) =>
      h(
        'li',
        { class: 'preview' },
        h('img', { src: image.url, alt: `Foto ${index + 1} de ${images.length}` }),
        index === 0 ? h('span', { class: 'preview__cover' }, 'Portada') : null,
        h(
          'button',
          {
            type: 'button',
            class: 'preview__remove',
            'aria-label': `Quitar foto ${index + 1}`,
            onClick: () => {
              URL.revokeObjectURL(image.url);
              images.splice(index, 1);
              renderPreviews();
              refreshSubmit();
            },
          },
          '×',
        ),
        h('p', { class: 'preview__size' }, `${Math.max(1, Math.round(image.file.size / 1024))} KB`),
      ),
    ),
  );
}

async function addFiles(fileList) {
  const errors = [];
  for (const file of fileList) {
    if (images.length >= MAX_IMAGES) {
      errors.push(`Solo se permiten ${MAX_IMAGES} fotos.`);
      break;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      errors.push(`"${file.name}" no es JPG, PNG ni WEBP.`);
      continue;
    }
    try {
      const compressed = await compressImage(file);
      images.push({ file: compressed, url: URL.createObjectURL(compressed) });
    } catch {
      errors.push(`No se pudo leer "${file.name}".`);
    }
  }
  const total = images.reduce((sum, image) => sum + image.file.size, 0);
  if (total > MAX_TOTAL_BYTES) errors.push('Las fotos suman más de 4 MB. Quita alguna o usa fotos más livianas.');
  setFieldError(fileInput, errors.join(' ') || null);
  renderPreviews();
  refreshSubmit();
}

fileInput.addEventListener('change', async () => {
  await addFiles([...fileInput.files]);
  fileInput.value = ''; // Permite volver a elegir el mismo archivo.
});

for (const type of ['dragenter', 'dragover']) {
  dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    dropzone.classList.add('is-dragging');
  });
}
for (const type of ['dragleave', 'drop']) {
  dropzone.addEventListener(type, () => dropzone.classList.remove('is-dragging'));
}
dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  addFiles([...event.dataTransfer.files]);
});

// Envío -------------------------------------------------------------------
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submit.disabled) return;
  hideAlert(alertBox);
  clearFieldErrors(form);

  const body = new FormData();
  body.append('title', title.value.trim());
  body.append('categoryId', categoryId.value);
  body.append('price', price.dataset.raw);
  body.append('description', description.value.trim());
  for (const image of images) body.append('images', image.file, image.file.name);

  setBusy(submit, true, 'Publicando…');
  try {
    const { data } = await api('/products', { method: 'POST', form: body });
    setFlash('Tu producto ya está publicado. Así lo verán los compradores.');
    location.href = `/producto.html?id=${data.id}`;
  } catch (err) {
    setBusy(submit, false);
    refreshSubmit();
    if (!(err.details.length && showServerErrors(form, err.details))) showAlert(alertBox, err.message);
    if (err.status === 401) location.reload();
  }
});

// Inicio
try {
  const { data } = await api('/categories');
  categoryId.append(...data.map((c) => h('option', { value: c.id }, c.name)));
} catch (err) {
  showAlert(alertBox, err.message);
}
refreshSubmit();
