// Inicio de sesión: emite el JWT (cookie httpOnly) y vuelve a la página que lo pidió.
import { api } from '../api.js';
import { $, hideAlert, setBusy, setFieldError, showAlert } from '../dom.js';
import { safeReturnPath } from '../session.js';
import { EMAIL_PATTERN } from '../validation.js';

const form = $('#login-form');
const alertBox = $('#form-alert');
const submit = $('#submit');
const { email, password } = form.elements;
const returnPath = safeReturnPath(new URLSearchParams(location.search).get('volver'));
$('#register-link').href = `/registro.html?volver=${encodeURIComponent(returnPath)}`;

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideAlert(alertBox);
  const emailError = !email.value.trim()
    ? 'Escribe tu correo electrónico.'
    : EMAIL_PATTERN.test(email.value.trim())
      ? null
      : 'El correo debe tener el formato nombre@dominio.com.';
  const passwordError = password.value ? null : 'Escribe tu contraseña.';
  setFieldError(email, emailError);
  setFieldError(password, passwordError);
  if (emailError || passwordError) {
    (emailError ? email : password).focus();
    return;
  }

  setBusy(submit, true, 'Ingresando…');
  try {
    await api('/auth/login', { method: 'POST', body: { email: email.value.trim(), password: password.value } });
    location.href = returnPath;
  } catch (err) {
    setBusy(submit, false);
    showAlert(alertBox, err.message);
    password.select();
  }
});
