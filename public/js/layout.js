// Partes comunes de todas las páginas: estado de sesión en el encabezado y búsqueda.
import { $, h } from './dom.js';
import { getSession, loginUrl, logout } from './session.js';

export async function initLayout() {
  const params = new URLSearchParams(location.search);
  const searchInput = $('#site-search');
  if (searchInput && params.has('search')) searchInput.value = params.get('search');

  const slot = $('#session-actions');
  if (!slot) return null;

  let user = null;
  try {
    user = await getSession();
  } catch {
    // Si la API no responde, el encabezado se queda con "Ingresar".
  }

  if (user) {
    const logoutButton = h('button', { type: 'button', class: 'link-button' }, 'Salir');
    logoutButton.addEventListener('click', async () => {
      await logout();
      location.href = '/index.html';
    });
    slot.replaceChildren(
      h('a', { class: 'button', href: '/publicar.html' }, 'Vender'),
      h('span', { class: 'user-name', title: user.email }, user.name.split(' ')[0]),
      logoutButton,
    );
  } else {
    slot.replaceChildren(
      h('a', { class: 'button', href: '/publicar.html' }, 'Vender'),
      h('a', { href: loginUrl() }, 'Ingresar'),
    );
  }
  return user;
}
