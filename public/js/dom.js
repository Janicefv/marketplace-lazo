// Utilidades de interfaz. Todo el contenido del usuario se inserta como texto (textContent),
// nunca como HTML, para evitar XSS.
export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

// h('a', { href: '/x', class: 'link' }, 'Texto', otroNodo)
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

// Muestra el error bajo cada campo (id del campo + "-error") y marca aria-invalid.
export function setFieldError(input, message) {
  const slot = document.getElementById(`${input.id}-error`);
  if (message) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
  if (slot) slot.textContent = message ?? '';
}

export function clearFieldErrors(form) {
  for (const input of form.querySelectorAll('[aria-invalid]')) setFieldError(input, null);
}

// Errores del backend: { field: 'shippingAddress.city', message } -> input name="city".
export function showServerErrors(form, details) {
  let first = null;
  for (const { field, message } of details) {
    const name = field.split('.').pop();
    const input = form.elements.namedItem(name);
    if (input instanceof HTMLElement && !input.hasAttribute('aria-invalid')) {
      setFieldError(input, message);
      first ??= input;
    }
  }
  first?.focus();
  return first !== null;
}

export function showAlert(container, message, type = 'error') {
  container.className = `alert alert--${type}`;
  container.replaceChildren(h('p', {}, message));
  container.setAttribute('role', type === 'error' ? 'alert' : 'status');
  container.hidden = false;
}

export function hideAlert(container) {
  container.replaceChildren();
  container.hidden = true;
}

export function setBusy(button, busy, busyLabel) {
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = busyLabel;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  } else {
    button.textContent = button.dataset.label ?? button.textContent;
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

// Mensaje que sobrevive a una redirección (por ejemplo, "Cuenta creada").
export function setFlash(message) {
  sessionStorage.setItem('flash', message);
}

export function takeFlash() {
  const message = sessionStorage.getItem('flash');
  sessionStorage.removeItem('flash');
  return message;
}
