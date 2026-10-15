// HU-01: registro con validación en tiempo real (correo y fortaleza de contraseña)
// y mensajes claros para campos vacíos o contraseñas que no coinciden.
import { api } from '../api.js';
import { $, $$, clearFieldErrors, h, hideAlert, setBusy, setFieldError, setFlash, showAlert, showServerErrors } from '../dom.js';
import { initLayout } from '../layout.js';
import { safeReturnPath } from '../session.js';
import {
  EMAIL_PATTERN,
  PASSWORD_LABELS,
  PHONE_PATTERN,
  isPasswordAcceptable,
  normalizePhone,
  passwordChecks,
  passwordLevel,
} from '../validation.js';

const form = $('#register-form');
const alertBox = $('#form-alert');
const submit = $('#submit');
const { name, email, phone, password, confirmPassword } = form.elements;
const returnPath = safeReturnPath(new URLSearchParams(location.search).get('volver'));
$('#login-link').href = `/login.html?volver=${encodeURIComponent(returnPath)}`;

// Cada regla devuelve el mensaje de error o null.
const rules = {
  name: (v) => {
    if (!v.trim()) return 'Escribe tu nombre.';
    if (v.trim().length < 2) return 'El nombre debe tener al menos 2 caracteres.';
    if (!/^\p{L}[\p{L}\s.'-]*$/u.test(v.trim())) return 'Usa solo letras y espacios.';
    return null;
  },
  email: (v) => {
    if (!v.trim()) return 'Escribe tu correo electrónico.';
    return EMAIL_PATTERN.test(v.trim()) ? null : 'El correo debe tener el formato nombre@dominio.com.';
  },
  phone: (v) => {
    if (!v.trim()) return 'Escribe tu teléfono.';
    return PHONE_PATTERN.test(normalizePhone(v)) ? null : 'Escribe un teléfono de 7 a 15 dígitos.';
  },
  password: (v) => {
    if (!v) return 'Escribe una contraseña.';
    return isPasswordAcceptable(v) ? null : 'La contraseña aún no cumple los requisitos de la lista.';
  },
  confirmPassword: (v) => {
    if (!v) return 'Confirma tu contraseña.';
    return v === password.value ? null : 'Las contraseñas no coinciden.';
  },
};

const touched = new Set();

function validateField(input) {
  const message = rules[input.name](input.value);
  setFieldError(input, touched.has(input.name) ? message : null);
  return message;
}

// Correo: validación de formato mientras se escribe, con confirmación visible.
email.addEventListener('input', () => {
  const ok = EMAIL_PATTERN.test(email.value.trim());
  $('#email-ok').hidden = !ok;
  email.classList.toggle('is-valid', ok);
  if (ok) setFieldError(email, null);
  else if (touched.has('email') && email.value) validateField(email);
});

// Contraseña: medidor de fortaleza y lista de requisitos en vivo.
password.addEventListener('input', () => {
  const checks = passwordChecks(password.value);
  const level = passwordLevel(password.value);
  $('#password-strength').dataset.level = String(level);
  $('#strength-label').textContent = level ? `Fortaleza: ${PASSWORD_LABELS[level]}` : 'Escribe una contraseña';
  for (const item of $$('#password-checks li')) item.classList.toggle('met', checks[item.dataset.check]);
  if (touched.has('password')) validateField(password);
  if (confirmPassword.value) {
    touched.add('confirmPassword');
    validateField(confirmPassword);
  }
});

confirmPassword.addEventListener('input', () => {
  if (confirmPassword.value.length >= password.value.length || touched.has('confirmPassword')) {
    touched.add('confirmPassword');
    validateField(confirmPassword);
  }
});

for (const input of [name, email, phone, password, confirmPassword]) {
  input.addEventListener('blur', () => {
    if (input.value) {
      touched.add(input.name);
      validateField(input);
    }
  });
  if (input !== email && input !== password && input !== confirmPassword) {
    input.addEventListener('input', () => touched.has(input.name) && validateField(input));
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideAlert(alertBox);
  const inputs = [name, email, phone, password, confirmPassword];
  inputs.forEach((input) => touched.add(input.name));
  const errors = inputs.map((input) => [input, validateField(input)]).filter(([, message]) => message);

  if (errors.length) {
    alertBox.className = 'alert alert--error';
    alertBox.setAttribute('role', 'alert');
    alertBox.replaceChildren(
      h('p', {}, errors.length === 1 ? 'Revisa este campo:' : `Revisa estos ${errors.length} campos:`),
      h('ul', {}, errors.map(([input, message]) => h('li', {}, h('a', { href: `#${input.id}` }, message)))),
    );
    alertBox.hidden = false;
    errors[0][0].focus();
    return;
  }

  setBusy(submit, true, 'Creando cuenta…');
  try {
    await api('/auth/register', {
      method: 'POST',
      body: {
        name: name.value.trim(),
        email: email.value.trim(),
        phone: phone.value,
        password: password.value,
        confirmPassword: confirmPassword.value,
      },
    });
    setFlash(`Bienvenido, ${name.value.trim().split(' ')[0]}. Tu cuenta quedó creada.`);
    location.href = returnPath;
  } catch (err) {
    setBusy(submit, false);
    clearFieldErrors(form);
    if (err.code === 'EMAIL_TAKEN') {
      setFieldError(email, 'Ya hay una cuenta con este correo. Ingresa o usa otro correo.');
      $('#email-ok').hidden = true;
      email.focus();
    } else if (!(err.details.length && showServerErrors(form, err.details))) {
      showAlert(alertBox, err.message);
    }
  }
});

initLayout();
