// Validaciones server-side (RF-4.3, NFR-SEG-5, politica de contrasenas ERS 2.4)

function validarPassword(pw) {
  if (typeof pw !== 'string') return false;
  return pw.length >= 12 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) &&
    /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw);
}

function validarCorreo(c) {
  return typeof c === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) && c.length <= 120;
}

function texto(v, max = 120) {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}

// Nombre de cliente: alfanumerico con espacios y signos basicos
function validarNombreCliente(n) {
  return texto(n, 80) && /^[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ .,&-]+$/.test(n);
}

function validarFecha(f) {
  return typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(Date.parse(f));
}

// RF-4.3: RUT chileno con digito verificador (modulo 11). Acepta 12.345.678-5 o 12345678-5
function validarRut(rut) {
  if (typeof rut !== 'string') return false;
  const limpio = rut.replace(/\./g, '').toUpperCase();
  const m = /^(\d{7,8})-([\dK])$/.exec(limpio);
  if (!m) return false;
  let suma = 0; let factor = 2;
  for (let i = m[1].length - 1; i >= 0; i--) {
    suma += Number(m[1][i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  const dv = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
  return dv === m[2];
}

// RB-8: monto en pesos chilenos, entero mayor que cero
function validarMonto(n) {
  return Number.isInteger(n) && n > 0 && n <= 1e12;
}

function validarAforo(n) {
  return Number.isInteger(n) && n > 0 && n <= 100000;
}

// Escapa HTML basico para evitar XSS almacenado en campos de texto libre
function sanear(s) {
  return String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
}

module.exports = { validarPassword, validarCorreo, texto, validarNombreCliente, validarFecha, validarRut, validarMonto, validarAforo, sanear };
